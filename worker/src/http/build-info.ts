// The commit the deployed build came from, read once per isolate from
// `build-info.json`, which the web build emits beside the page (web/vite.config.ts)
// and the assets binding serves. `situation.read` reports it with the version
// from package.json so a person can tell what a Worker runs (deployment.md §4).
// Absent or unreadable (a test, a build without one), the commit is `null`:
// the single-page fallback answers the page for a missing path, which is no JSON.

import type { Fetcher } from '../env';

export interface BuildInfo {
  /** The full SHA of the commit built, or `null` when the build did not record one. */
  commit: string | null;
}

let cached: Promise<BuildInfo> | undefined;

export function readBuildInfo(assets: Fetcher): Promise<BuildInfo> {
  cached ??= read(assets).catch((): BuildInfo => ({ commit: null }));
  return cached;
}

/** For tests: forget the cached answer. */
export function forgetBuildInfo(): void {
  cached = undefined;
}

async function read(assets: Fetcher): Promise<BuildInfo> {
  const response = await assets.fetch(new Request('https://assets.local/build-info.json'));
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return { commit: null };
  const body: unknown = await response.json();
  const commit = typeof body === 'object' && body !== null && 'commit' in body ? (body as { commit: unknown }).commit : null;
  return { commit: typeof commit === 'string' && /^[0-9a-f]{7,40}$/.test(commit) ? commit : null };
}
