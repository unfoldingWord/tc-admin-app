// @vitest-environment jsdom
// The release page mounted (#188, E87): when Door43 has no release under the
// tag, the project's stored preparations are read, and one that records
// making that release is named with its date; Door43's answer stands, and the
// page offers nothing to do with a release Door43 does not have.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { forgetCsrfToken } from '../src/api/client';
import { ReleaseView } from '../src/ReleaseView';
import { errorOf } from './support/upload';
import { freshness, heldWorker, preparationOf, projectOf } from './support/mounted';

const PROJECT = projectOf('bahtraku', 'PB-Adang-Edisi-Percobaan', 'bible');
const BASE = '/api/projects/bahtraku/PB-Adang-Edisi-Percobaan';
const made = {
  ...preparationOf('bahtraku', 'PB-Adang-Edisi-Percobaan', 'v2.0.0', 'full_release'),
  release: { tag: 'v2.0.0', url: 'https://qa.door43.org/bahtraku/PB-Adang-Edisi-Percobaan/releases/tag/v2.0.0', prerelease: false },
  history: [{ at: '2026-10-07T20:18:00.000Z', from: 'ready_for_release' as const, to: 'full_release' as const, event: 'release.create' }],
};

let worker: ReturnType<typeof heldWorker>;

beforeEach(() => {
  worker = heldWorker();
  vi.stubGlobal('fetch', worker.fetch);
  forgetCsrfToken();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function answerWhenSent(method: string, url: string, body: unknown, status = 200) {
  await vi.waitFor(() => expect(worker.waiting()).toContain(`${method} ${url}`));
  await worker.answer(method, url, body, status);
}

describe('a release tC Admin made and Door43 no longer has (#188)', () => {
  test('P3: Door43 has no release under the tag and a stored preparation records making it: the page names it with its date and offers nothing to do', async () => {
    render(<ReleaseView project={PROJECT} tag="v2.0.0" onFailure={() => {}} />);
    await answerWhenSent('GET', `${BASE}/releases/v2.0.0`, { found: false, release: null });
    // Until the stored preparations answer, the page is still looking: Door43's bare answer is not shown first.
    expect(screen.getByText('Looking the release up on Door43…')).toBeTruthy();
    await answerWhenSent('GET', `${BASE}/preparations`, { preparations: [made], freshness });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe(`tC Admin made the full release v2.0.0 on ${new Date('2026-10-07T20:18:00.000Z').toLocaleDateString()}. Door43 no longer has it: it may have been deleted on Door43.`);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('P3: no stored preparation records the tag: Door43\'s answer is shown as it was', async () => {
    render(<ReleaseView project={PROJECT} tag="v9.9.9" onFailure={() => {}} />);
    await answerWhenSent('GET', `${BASE}/releases/v9.9.9`, { found: false, release: null });
    await answerWhenSent('GET', `${BASE}/preparations`, { preparations: [made], freshness });
    expect(screen.getByRole('status').textContent).toBe('Door43 has no release under the tag v9.9.9 for this project.');
  });

  test('A2: preparations the account may not read leave Door43\'s answer as it was', async () => {
    render(<ReleaseView project={PROJECT} tag="v2.0.0" onFailure={() => {}} />);
    await answerWhenSent('GET', `${BASE}/releases/v2.0.0`, { found: false, release: null });
    await answerWhenSent('GET', `${BASE}/preparations`, errorOf('permission_denied', { owner: 'bahtraku', repo: 'PB-Adang-Edisi-Percobaan' }), 403);
    expect(screen.getByRole('status').textContent).toBe('Door43 has no release under the tag v2.0.0 for this project.');
  });

  test('a session Door43 no longer accepts, answered by the preparations read, goes to the shell', async () => {
    const onFailure = vi.fn<(failure: unknown) => void>();
    render(<ReleaseView project={PROJECT} tag="v2.0.0" onFailure={onFailure} />);
    await answerWhenSent('GET', `${BASE}/releases/v2.0.0`, { found: false, release: null });
    await answerWhenSent('GET', `${BASE}/preparations`, errorOf('session_expired'), 401);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  test('R6: a release Door43 has is shown from Door43 alone; the stored preparations are not read', async () => {
    render(<ReleaseView project={PROJECT} tag="v1.1" onFailure={() => {}} />);
    await answerWhenSent('GET', `${BASE}/releases/v1.1`, { found: true, release: { tag: 'v1.1', url: 'https://qa.door43.org/bahtraku/PB-Adang-Edisi-Percobaan/releases/tag/v1.1', prerelease: false, target_sha: 'd'.repeat(40) } });
    expect(screen.getByText('Full release')).toBeTruthy();
    expect(worker.sent.map(request => request.url)).toEqual([`${BASE}/releases/v1.1`]);
  });
});
