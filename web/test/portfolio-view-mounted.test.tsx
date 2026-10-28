// @vitest-environment jsdom
// The portfolio's filters and order mounted (#24): choosing a filter narrows
// the list without reading Door43 again, the count says how many are shown,
// clearing brings them back, the order is remembered by this browser and the
// filters are not, and each project says when it last changed.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ProjectSummary } from '@tc-admin/shared/schema';
import { forgetCsrfToken } from '../src/api/client';
import { Portfolio } from '../src/Portfolio';
import { freshness, heldWorker, projectOf } from './support/mounted';

const with_ = (project: ProjectSummary, patch: Partial<ProjectSummary>): ProjectSummary => ({ ...project, ...patch });
const pendau = with_(projectOf('bahtraku', 'Perjanjian-Baru-Pendau', 'bible'), { title: 'Perjanjian Baru Pendau', language: { code: 'ums', title: 'Pendau' }, last_activity_at: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString() });
const tb1 = with_(projectOf('bahtraku', 'id_tb1', 'obs'), { title: 'Alkitab TB', language: { code: 'id', title: 'Bahasa Indonesia' }, last_activity_at: new Date(Date.now() - 60 * 60_000).toISOString() });
const portfolio = { organizations: [{ name: 'bahtraku', projects: [pendau, tb1] }], freshness, analysis: { complete: 2, pending: 0 } };

let worker: ReturnType<typeof heldWorker>;

beforeEach(() => {
  worker = heldWorker();
  vi.stubGlobal('fetch', worker.fetch);
  forgetCsrfToken();
  window.location.hash = '';
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function mount() {
  render(<Portfolio account={{ login: 'tc-admin-qa', name: 'tC Admin QA' }} onFailure={() => {}} />);
  await vi.waitFor(() => expect(worker.waiting()).toContain('GET /api/portfolio?show=supported'));
  await worker.answer('GET', '/api/portfolio?show=supported', portfolio);
}
const titles = () => screen.getAllByRole('listitem').map(item => within(item).getByText(/Pendau|Alkitab/, { selector: 'strong' }).textContent);

describe('#24: filters and order in the portfolio', () => {
  test('#24: a language filter narrows the list without reading Door43 again; the count says so; clearing brings every project back', async () => {
    await mount();
    expect(screen.getByRole('status').textContent).toBe('2 projects');
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ums' } });
    expect(titles()).toEqual(['Perjanjian Baru Pendau']);
    expect(screen.getByRole('status').textContent).toBe('Showing 1 of 2 projects');
    fireEvent.change(screen.getByLabelText('Project type'), { target: { value: 'obs' } });
    expect(screen.queryAllByRole('listitem')).toEqual([]);
    expect(screen.getByText('No project matches these filters.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the filters' }));
    expect(titles()).toHaveLength(2);
    expect(worker.sent.filter(request => request.url.startsWith('/api/portfolio'))).toHaveLength(1);
  });

  test('#24: ordered by most recent activity, the newest comes first, each says when it changed, and the order is remembered; a filter is not', async () => {
    await mount();
    expect(titles()).toEqual(['Alkitab TB', 'Perjanjian Baru Pendau']);
    fireEvent.change(screen.getByLabelText('Order within each owner'), { target: { value: 'activity' } });
    expect(titles()).toEqual(['Alkitab TB', 'Perjanjian Baru Pendau']);
    expect(screen.getByText(/changed 1 hour ago/)).toBeTruthy();
    expect(screen.getByText(/changed 3 days ago/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ums' } });
    cleanup();

    worker = heldWorker();
    vi.stubGlobal('fetch', worker.fetch);
    await mount();
    expect((screen.getByLabelText('Order within each owner') as HTMLSelectElement).value).toBe('activity');
    expect((screen.getByLabelText('Language') as HTMLSelectElement).value).toBe('');
    expect(titles()).toHaveLength(2);
  });

  test('#24: after a refresh takes a filtered language out of the list, the selector still shows it, marked, and the list and count agree (bench round 2)', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ums' } });
    expect(titles()).toEqual(['Perjanjian Baru Pendau']);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await vi.waitFor(() => expect(worker.waiting()).toContain('GET /api/portfolio?show=supported'));
    // The refreshed portfolio no longer holds the Pendau project.
    await worker.answer('GET', '/api/portfolio?show=supported', { organizations: [{ name: 'bahtraku', projects: [tb1] }], freshness, analysis: { complete: 1, pending: 0 } });
    const language = screen.getByLabelText('Language') as HTMLSelectElement;
    expect(language.value).toBe('ums');
    expect(language.selectedOptions[0]!.textContent).toBe('ums · none in the list now');
    expect(screen.queryAllByRole('listitem')).toEqual([]);
    expect(screen.getByText('No project matches these filters.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Showing 0 of 1 projects');
    fireEvent.click(screen.getByRole('button', { name: 'Clear the filters' }));
    expect(titles()).toEqual(['Alkitab TB']);
    expect(language.value).toBe('');
  });

  test('#24: ordered by name, the projects follow their repository names', async () => {
    await mount();
    fireEvent.change(screen.getByLabelText('Order within each owner'), { target: { value: 'name' } });
    expect(titles()).toEqual(['Alkitab TB', 'Perjanjian Baru Pendau']);
    fireEvent.change(screen.getByLabelText('Order within each owner'), { target: { value: 'language' } });
    expect(titles()).toEqual(['Alkitab TB', 'Perjanjian Baru Pendau']);
  });
});

describe('#195: collapsible owner groups, and what unsupported means', () => {
  const two = { organizations: [{ name: 'tc-admin-qa', projects: [with_(projectOf('tc-admin-qa', 'id_mine', 'bible'), { title: 'Alkitab Saya' })] }, { name: 'bahtraku', projects: [pendau, tb1] }], freshness, analysis: { complete: 3, pending: 0 } };
  const mountTwo = async () => {
    render(<Portfolio account={{ login: 'tc-admin-qa', name: 'tC Admin QA' }} onFailure={() => {}} />);
    await vi.waitFor(() => expect(worker.waiting()).toContain('GET /api/portfolio?show=supported'));
    await worker.answer('GET', '/api/portfolio?show=supported', two);
  };
  const group = (name: string) => screen.getByRole('region', { name });

  test('P1: a collapsed group keeps its name and count, hides its projects, opens again, and filters still count its projects', async () => {
    await mountTwo();
    const toggle = within(group('bahtraku')).getByRole('button', { name: 'bahtraku' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(group('bahtraku')).getByRole('heading', { name: 'bahtraku' })).toBeTruthy();
    expect(within(group('bahtraku')).getByText('2 projects')).toBeTruthy();
    expect(within(group('bahtraku')).queryAllByRole('listitem')).toEqual([]);
    expect(within(group('tc-admin-qa')).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('3 projects');
    fireEvent.click(toggle);
    expect(within(group('bahtraku')).getAllByRole('listitem')).toHaveLength(2);
  });

  test('P1: this browser remembers which groups are collapsed, as it remembers the order', async () => {
    await mountTwo();
    fireEvent.click(within(group('bahtraku')).getByRole('button', { name: 'bahtraku' }));
    cleanup();
    await mountTwo();
    expect(within(group('bahtraku')).getByRole('button', { name: 'bahtraku' }).getAttribute('aria-expanded')).toBe('false');
    expect(within(group('tc-admin-qa')).getByRole('button', { name: 'tc-admin-qa' }).getAttribute('aria-expanded')).toBe('true');
  });

  test('"Show all projects" says what tC Admin manages, so "unsupported" is explained', async () => {
    await mountTwo();
    const showAll = screen.getByRole('checkbox', { name: /Show all projects/ });
    expect(document.getElementById(showAll.getAttribute('aria-describedby')!)?.textContent).toBe('tC Admin manages Bible and Open Bible Stories projects in Scripture Burrito. Other projects you can write to are listed as unsupported.');
  });
});
