// @vitest-environment jsdom
// The creation wizard mounted (#192): the target language comes right after
// the project type; the title is named by project type; an Open Bible Stories
// project has no abbreviation field and is named <language>_obs; a taken name
// is answered at the owner for Open Bible Stories, at the abbreviation for a
// Bible.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ERROR_CATALOG } from '@tc-admin/shared/schema';
import { forgetCsrfToken } from '../src/api/client';
import { CreateProject } from '../src/CreateProject';
import { freshness, heldWorker } from './support/mounted';
import { errorOf } from './support/upload';

let worker: ReturnType<typeof heldWorker>;

beforeEach(() => {
  worker = heldWorker();
  vi.stubGlobal('fetch', worker.fetch);
  forgetCsrfToken();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

async function answerWhenSent(method: string, url: string, body: unknown, status = 200) {
  await vi.waitFor(() => expect(worker.waiting()).toContain(`${method} ${url}`));
  await worker.answer(method, url, body, status);
}

/** The wizard, with its owners and languages answered. */
async function openWizard() {
  render(<CreateProject account="tc-admin-qa" onCreated={() => {}} onFailure={() => {}} />);
  await answerWhenSent('GET', '/api/owners/writable', { owners: [{ login: 'tc-admin-qa-org', name: 'tC Admin QA', kind: 'organization' }], freshness });
  const languages = await vi.waitFor(() => {
    const waiting = worker.waiting().find(request => request.startsWith('GET /api/languages'));
    expect(waiting).toBeTruthy();
    return waiting!.slice('GET '.length);
  });
  await worker.answer('GET', languages, { languages: [{ code: 'id', title: 'Bahasa Indonesia', english: 'Indonesian', direction: 'ltr', alternates: [], tag_accepted: true }], owner_languages: null, freshness });
  fireEvent.click(document.querySelector('input[name=owner][value="tc-admin-qa-org"]')!);
}

const legends = () => [...document.querySelectorAll('legend')].map(legend => legend.textContent);

describe('the creation wizard (#192)', () => {
  test('the target language comes right after the project type, before the name', async () => {
    await openWizard();
    expect(legends().slice(0, 4)).toEqual(['Owner', 'Project type', 'Target language', 'Name']);
  });

  test('a Bible: "Bible title" with its help, and an abbreviation the manager writes', async () => {
    await openWizard();
    fireEvent.click(document.querySelector('input[name=project_type][value=bible]')!);
    const title = screen.getByLabelText('Bible title');
    expect(document.getElementById(title.getAttribute('aria-describedby')!)?.textContent).toBe('The name of this Bible in the target language.');
    expect(screen.getByLabelText('Abbreviation')).toBeTruthy();
  });

  test('W1: Open Bible Stories has no abbreviation field, its title is the story collection\'s, and its repository is <language>_obs; the plan is sent with OBS', async () => {
    await openWizard();
    fireEvent.click(document.querySelector('input[name=project_type][value=obs]')!);
    expect(screen.queryByLabelText('Abbreviation')).toBeNull();
    const title = screen.getByLabelText('Story collection title');
    expect(document.getElementById(title.getAttribute('aria-describedby')!)?.textContent).toBe('What Open Bible Stories is called in the target language. It need not be a word-for-word translation.');
    fireEvent.change(title, { target: { value: 'Cerita Alkitab Terbuka' } });
    fireEvent.change(screen.getByLabelText(/Search by name or tag/), { target: { value: 'Bahasa' } });
    fireEvent.click(await screen.findByRole('button', { name: /Bahasa Indonesia/ }));
    expect(document.querySelector('.derived code')?.textContent).toBe('id_obs');

    fireEvent.click(screen.getByRole('button', { name: 'Review before creating' }));
    await vi.waitFor(() => expect(worker.waiting()).toContain('POST /api/projects/plan'));
    expect(worker.sent.find(request => request.url === '/api/projects/plan')?.body).toMatchObject({ project_type: 'obs', abbreviation: 'OBS' });

    // A second Open Bible Stories project in the same language and owner is refused; the way out is another owner (Rich, 28 October 2026).
    const message = ERROR_CATALOG.name_taken.message.replace('<repo_name>', 'id_obs').replace('<owner>', 'tc-admin-qa-org');
    await worker.answer('POST', '/api/projects/plan', errorOf('name_taken', { owner: 'tc-admin-qa-org', repo_name: 'id_obs' }, message), 409);
    const owner = document.querySelector('legend')!.closest('fieldset')!;
    expect(owner.querySelector('[role=alert]')?.textContent).toBe(`${message} An Open Bible Stories project in this language is always named id_obs, so choose another owner.`);
  });
});
