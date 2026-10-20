// Writes `web/dist/build-info.json` after the web build: the commit this build
// is of, which the Worker reads through its assets binding and reports with the
// version in `situation.read`, and the page shows in its footer (deployment.md §4).
// Workers Builds names the commit in WORKERS_CI_COMMIT_SHA, GitHub Actions in
// GITHUB_SHA; a checkout answers `git rev-parse HEAD`; otherwise `null`.
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'web', 'dist');
if (!existsSync(dist)) {
  console.error(`write-build-info: ${dist} does not exist; run the web build first`);
  process.exit(1);
}

const sha = /^[0-9a-f]{7,40}$/;
function commit() {
  for (const name of ['WORKERS_CI_COMMIT_SHA', 'GITHUB_SHA']) {
    const value = process.env[name];
    if (value && sha.test(value)) return value;
  }
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return sha.test(head) ? head : null;
  } catch {
    return null;
  }
}

const info = { commit: commit(), built_at: new Date().toISOString() };
writeFileSync(join(dist, 'build-info.json'), `${JSON.stringify(info)}\n`);
console.log(`write-build-info: commit ${info.commit ?? 'unknown'}`);
