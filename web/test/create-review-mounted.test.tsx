// @vitest-environment jsdom
// The review before creating, mounted (#193): the project's details read in
// plain words from the plan's metadata, and `metadata.json` itself only when
// the manager opens "Show metadata.json". The plan is one recorded on QA (E49).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { OPERATIONS } from '@tc-admin/shared/schema';
import { forgetCsrfToken } from '../src/api/client';
import { CreateProject } from '../src/CreateProject';
import { BIBLE_METADATA } from './support/create-plans';
import { freshness, heldWorker } from './support/mounted';

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

async function answerWhenSent(method: string, url: string, body: unknown) {
  await vi.waitFor(() => expect(worker.waiting()).toContain(`${method} ${url}`));
  await worker.answer(method, url, body);
}

/** The wizard filled in for a New Testament Bible and its review asked for. */
async function reviewABible() {
  render(<CreateProject account="tc-admin-qa" onCreated={() => {}} onFailure={() => {}} />);
  await answerWhenSent('GET', '/api/owners/writable', { owners: [{ login: 'tc-admin-qa-org', name: 'tC Admin QA', kind: 'organization' }], freshness });
  const languages = await vi.waitFor(() => {
    const waiting = worker.waiting().find(request => request.startsWith('GET /api/languages'));
    expect(waiting).toBeTruthy();
    return waiting!.slice('GET '.length);
  });
  await worker.answer('GET', languages, { languages: [{ code: 'id', title: 'Bahasa Indonesia', english: 'Indonesian', direction: 'ltr', alternates: [], tag_accepted: true }], owner_languages: null, freshness });
  fireEvent.click(document.querySelector('input[name=owner][value="tc-admin-qa-org"]')!);
  fireEvent.click(document.querySelector('input[name=project_type][value=bible]')!);
  fireEvent.change(screen.getByLabelText('Project title'), { target: { value: 'tC Admin probe 2026-10-06 0633' } });
  fireEvent.change(screen.getByLabelText('Abbreviation'), { target: { value: 'tcap0633' } });
  fireEvent.change(screen.getByLabelText(/Search by name or tag/), { target: { value: 'Bahasa' } });
  fireEvent.click(await screen.findByRole('button', { name: /Bahasa Indonesia/ }));
  fireEvent.click(document.querySelector('input[name=testament_scope][value=nt]')!);
  fireEvent.click(screen.getByRole('button', { name: 'Review before creating' }));
  const plan = OPERATIONS['project.create.plan'].output.parse({
    id: 'plan-1', operation: 'project.create.plan', created_at: '2026-10-06T06:33:49.000Z', expires_at: '2026-10-06T07:03:49.000Z',
    bound_to: { default_branch_sha: null, release_tag: null, release_tag_sha: null },
    preview: { repo_name: 'id_tcap0633', metadata_json: BIBLE_METADATA, files: [{ path: 'metadata.json', size: 2, md5: '0'.repeat(32) }] },
    would_write: [{ kind: 'repo', target: 'tc-admin-qa-org/id_tcap0633' }], warnings: [],
  });
  await answerWhenSent('POST', '/api/projects/plan', plan);
}

describe('the review before creating (#193)', () => {
  test('W1: the project\'s details are listed in plain words, read from the plan', async () => {
    await reviewABible();
    const details = screen.getByLabelText("The project's details");
    const pairs = within(details).getAllByRole('term').map(term => `${term.textContent}: ${term.nextElementSibling?.textContent}`);
    expect(pairs).toContain('Title: tC Admin probe 2026-10-06 0633');
    expect(pairs).toContain('Testament scope: New Testament (27 books)');
    expect(pairs).toContain('Translation type: First translation');
    expect(pairs).toContain('License: CC BY-SA 4.0, in ingredients/license.md');
  });

  test('W1: metadata.json is shown only when the manager asks for it, and is the plan\'s, unchanged', async () => {
    await reviewABible();
    const disclosure = screen.getByText('Show metadata.json').closest('details')!;
    expect(disclosure.open).toBe(false);
    fireEvent.click(screen.getByText('Show metadata.json'));
    expect(disclosure.open).toBe(true);
    expect(JSON.parse(disclosure.querySelector('pre')!.textContent!)).toEqual(BIBLE_METADATA);
  });
});
