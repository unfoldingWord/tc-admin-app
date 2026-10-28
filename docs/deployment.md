# tC Admin Build, Check, and Deploy

Status: proposed 22 September 2026, revised the same day for Cloudflare's Git integration after reading its documentation (Workers Builds, Git integration, Version URLs, monorepo and environments pages, all dated September 2026). Dashboard paths are as documented there; verify when performing them.
Audience: Rich (Cloudflare account owner), the engineer, and the agent

## 1. Shape

One Wrangler configuration at the repository root with two environments, which Cloudflare sees as two Workers:

| Worker | Wrangler environment | Door43 host | URL | Deploys when |
| --- | --- | --- | --- | --- |
| `tc-admin-qa` | `qa` | `https://qa.door43.org` | `https://tc-admin-qa.unfoldingword.workers.dev` | a commit lands on `main` |
| `tc-admin` | `production` | `https://git.door43.org` | `https://admin.translationcore.com` (the custom domain since 20 October 2026, #53, E86); `https://tc-admin.unfoldingword.workers.dev` still answers | a commit lands on the protected `production` branch |

The account's `workers.dev` subdomain is `unfoldingword` (confirmed by Rich, 22 September 2026). The account already runs this shape for translationCore mobile: `tc-mobile-staging.unfoldingword.workers.dev` and `tc-mobile.unfoldingword.workers.dev`, both connected to `unfoldingWord/tc-mobile`; tC Admin mirrors it. The OAuth callback path is `/auth/callback` on each URL (#2).

The configuration is `wrangler.jsonc` (#7). Its top level is for `wrangler dev` and points at QA, and it is named `tc-admin-qa` (decided by Rich, 1 October 2026), so a `wrangler deploy` without `--env` deploys to the QA Worker with QA settings and cannot reach production. `env.qa` and `env.production` name their Workers explicitly; the Cloudflare build commands in section 3 still pass `--env`.

Each Worker has its own KV namespaces (`SESSIONS`, `PLANS`) and its own runtime secrets (`DOOR43_CLIENT_ID`, `DOOR43_CLIENT_SECRET`, `SESSION_SIGNING_KEY`). The Door43 OAuth applications (#2) register each Worker's URL as a redirect URI.

## 2. How deployment works: Cloudflare's Git integration

Cloudflare's **Workers Builds** connects a Worker to a GitHub repository. On every push, Cloudflare clones the repository, runs a build command, then a deploy command, and records the result as a GitHub check run and, on pull requests, as a comment. Cloudflare generates and holds the API token it needs; nobody creates one and nothing goes into GitHub secrets. Deploying is therefore the same act as merging:

- **Pull request opened or updated** → the `tc-admin-qa` Worker runs a **preview build** (`npx wrangler preview --env qa`), which creates a Preview at a URL that is stable for that branch and posts it on the pull request. Previews do not touch the live QA deployment.
- **Merge to `main`** → the `tc-admin-qa` Worker runs its deploy command (`npx wrangler deploy --env qa`). QA is always the head of `main`.
- **Merge to `production`** → the `tc-admin` Worker runs `npx wrangler deploy --env production`, and the `release` workflow (`.github/workflows/release.yml`) tags the commit `v<version>` from `package.json` and publishes the GitHub release with generated notes. The `production` branch is protected: only a release pull request from `main`, approved by Rich, or a hotfix pull request from a `hotfix/<name>` branch made from `production`, can move it (ADR 0015, §4).

GitHub Actions (`.github/workflows/check.yml`) keeps running the tests and the document check on every pull request and on pushes to `main` and `production`, and stays the merge gate. Cloudflare only builds and deploys.

Two consequences to know about:

- **Door43 sign-in on a preview.** Door43 OAuth requires the exact redirect URI. Preview URLs differ per branch, so sign-in works on QA (`main`) and production, not on an arbitrary preview, unless that preview's URL is registered on the QA OAuth application. Previews are for reviewing the interface and anything that runs against fixtures; sign-in is verified on QA after merge. If a long-lived branch needs sign-in, register its preview URL once.
- **Worker names must match.** Cloudflare requires the Worker's name in the dashboard to equal the name in the Wrangler configuration in the chosen root directory. The configuration names each environment's Worker explicitly (`tc-admin-qa` for `--env qa`, `tc-admin` for `--env production`) and names the top level `tc-admin-qa`. Not yet verified: whether Workers Builds compares the dashboard name with the top-level `name` or with the name `--env` selects. If the first production build in #9 reports a name mismatch, the top level goes back to `tc-admin` and a deploy without `--env` must again be avoided.

## 3. One-time setup, in order

Nothing here can happen before #7 merges a Wrangler configuration and a minimal Worker, because a connected repository with nothing to build fails on every push.

**Now (Rich, five minutes):**

1. **Find the subdomain.** Done: `unfoldingword`, recorded in section 1.
2. **Create four KV namespaces.** Done 22 September 2026. Storage & Databases → KV → Create. Each gets a 32-character hex id, visible in the namespace's URL after `namespaces/` and on its page as "Namespace ID". The ids are identifiers, not secrets, and go into the Wrangler configuration in #7 as `kv_namespaces` bindings:

   | Namespace | Worker | Binding | Id |
   | --- | --- | --- | --- |
   | `tc-admin-qa-sessions` | `tc-admin-qa` | `SESSIONS` | `d38d8016088a41468ae07d86e43d8bd0` |
   | `tc-admin-qa-plans` | `tc-admin-qa` | `PLANS` | `4144422f84394d569ce4717c39568e2f` |
   | `tc-admin-sessions` | `tc-admin` | `SESSIONS` | `90e3158d46d74a7f9a60f48b11cab246` |
   | `tc-admin-plans` | `tc-admin` | `PLANS` | `dfb39941f93e43f6826d58bf39709ea9` |

**After #7 merges (Rich, from a clone of the repository, once):**

3. **Create the two Workers with Wrangler.** Cloudflare's documented path for Wrangler environments is to deploy once with Wrangler so the environment Workers exist, then connect the repository to each. **Done for QA on 6 October 2026 (#9):** after `npx wrangler login` as Rich, `npx wrangler deploy --env qa` from `main` created `tc-admin-qa` in the unfoldingWord account with the `SESSIONS` and `PLANS` bindings, and `wrangler secret put --env qa` set `DOOR43_CLIENT_ID`, `DOOR43_CLIENT_SECRET` (piped from `.env`, never shown), and a generated `SESSION_SIGNING_KEY`; `https://tc-admin-qa.unfoldingword.workers.dev/api/situation` answered with `configured: true`. The account is pinned as `account_id` in `wrangler.jsonc`, since the deploying credentials reach two Cloudflare accounts. **Done for production on 12 October 2026 (#9, E85):** Rich ran `npx wrangler deploy --env production` from `main` and set `DOOR43_CLIENT_ID` and `DOOR43_CLIENT_SECRET` from the production OAuth application and a `SESSION_SIGNING_KEY` (step 5 asks for one generated and different per Worker; how this one was made is not recorded); `https://tc-admin.unfoldingword.workers.dev/api/situation` answered `configured: true` for Production, and he reports that his sign-in there returned to the app (E85). **On 20 October 2026 Rich pointed the custom domain `https://admin.translationcore.com` at this Worker** (#53): it serves the same build, and `/auth/login` on it sends Door43 the callback `https://admin.translationcore.com/auth/callback`, which the production OAuth application must list beside the `workers.dev` one (E38, E86). The Worker's current version is `1c197360` (`wrangler deployments list --env production`, 12 October 2026; the first upload at 15:59 UTC and each `secret put` after it made a version); the commit it was built from is not recorded, and its bundle is the one a build of `main` at `9f25867` produces. Production is not on the hand-update cadence below: it moves only by a `npx wrangler deploy --env production` that Rich runs, until step 4 connects it to the `production` branch. **Deployed by Rich on 20 October 2026** from a checkout of the tag `v0.1.0` (the head of `production`, `544001e`, the first GitHub release), with `npm ci`, `npm run check`, `npm run build`, and `npx wrangler deploy --env production`, as he reports; the deployments list shows two uploads that day, 15:11 and 15:21 UTC, the live version being `ca6352d8`; the page serves `index-BOO8PC02.js` as before, since every change since the 10 October build is documents, and `/api/situation` answers `configured: true` for Production at `https://admin.translationcore.com` (E86). **What a Worker runs is readable:** `GET /api/situation` answers `application: { name, version, commit }`, the version from the root `package.json` and the commit from `build-info.json`, which `npm run build` writes beside the page (`scripts/write-build-info.mjs`: Workers Builds' `WORKERS_CI_COMMIT_SHA`, GitHub Actions' `GITHUB_SHA`, or the checkout's `git rev-parse HEAD`; `null` when none), and the page's footer shows the same, so a deploy is checked by its version and commit rather than by the bundle's name. **Until step 4 connects the repository, a merge to `main` deploys nothing**, and QA is brought up to date by hand from a checkout of `main` with `npm ci && npm run build && npx wrangler deploy --env qa` (Wrangler serves `web/dist`, which only the build writes and Git ignores; `wrangler secret put` is not repeated): last done on 10 October 2026 at 03:34 UTC, at Rich's request (he asked the agent to merge #169, #171, and #173 once approved and then deploy), for `main` at `00e3fcd` (#169, #171, and #173 merged: the deploy record and the pre-#167 plan check, a repository's default branch taken only from its `default_branch`, and the owner search narrowing the manager's organizations), version `b40625d3`, from a separate worktree of that commit after `npm ci`, `npm run check`, and `npm run build` there; the page served that build's bundle (`index-BOO8PC02.js`) at the first check, `/api/situation` answered `configured: true` for QA, and `E2E_HEADLESS=1 npm run e2e` signed in and passed against it; before that, 10 October 2026 at 02:20 UTC, at Rich's request, for `main` at `c8be380` (#168 merged: projects created on the default branch `main`, E79, and the QA seed script on `main`, E80), version `ab48b9d6`, from a separate worktree of that commit after `npm ci`, `npm run check`, and `npm run build` there; the page served that build's bundle (`index-DADh5bkl.js`) at the first check, `/api/situation` answered `configured: true` for QA, and `E2E_HEADLESS=1 npm run e2e` signed in and passed against it; before that, 9 October 2026 at 15:46 UTC, at Rich's request, for `main` at `39710d1` (#147 to #153 merged: the project's health findings for its branch and its latest release, the collapsed health check grouped by check, and the import screen's list of importable repositories with its filter and the 960px page), version `844d7678`, from a separate worktree of that commit so the work in progress was untouched, after `npm ci`, `npm run check`, and `npm run build` there; the page served that build's bundle (`index-CJ6bpZA0.js`) at the first check; before that, 8 October 2026 at 20:14 UTC, at Rich's request, for `main` at `3693b5e` (#138 to #144 merged: the close-outs, the revoked project, the sign-in return, `project.read` and refresh, the filters, the labels, and the end-to-end test), version `8e852ce9`, after `npm ci`, `npm run check`, and `npm run build` on that commit; the page served that build's bundle (`index-nFmuzeHh.js`) about half a minute after the deploy reported success (a check made at once still saw the old one), `/api/situation` answered `configured: true` for QA, `GET /api/projects/{owner}/{repo}` (`project.read`, new in this deploy) answered 401 `session_expired` without a session rather than 404 `unknown_operation`, and `npm run e2e` signed in and passed against it; before that, 8 October 2026 at 18:00 UTC, at Rich's request, for `main` at `b1991a2` (#136 and #137 merged: `import.apply` and the import screen), version `ad0c5287`, after `npm run check` on that commit, after which the page served that build's bundle (`index-Dxs8frW3.js`), `/api/situation` answered `configured: true` for QA, the import plan route answered 403 `csrf_rejected` to a post without the token rather than 404, and `/api/sources` answered 401 `session_expired` without a session; before that, 8 October 2026 at 12:12 UTC by Rich for `main` at `ef5fcd3` (#132 merged, bringing #131 and #133 with it), version `38758b56`, after which the page served that build's bundle with the upload screen, `/api/situation` answered `configured: true` for QA, and the upload route answered 400 to an empty request rather than 404; before that, 8 October 2026 at 08:41 UTC for `main` at `bc515fc` (#129 merged), version `1a10d703`, after `npm run check` and `npm run build` on that commit, and E67 observed on it; before that, 8 October 2026 at 01:20 UTC for `main` at `f31a14e` (#121 merged), version `941101b8`, after which `https://tc-admin-qa.unfoldingword.workers.dev` then served the web app, `/api/situation` answered `configured: true` for QA, and `/api/owners?q=` and `/api/sources` answered 401 `session_expired` without a session. Earlier: 7 October 2026 at 19:46 UTC for `ad09818` (#110 merged), version `b69d0815`, the build the demo's QA rehearsal ran on (E58); 6 October 2026 at 21:21 UTC for `d69a4c9` (#93 merged), version `dd040b2b`, after Rich found the wizard missing from QA.

   ```
   npm ci
   npx wrangler login
   npx wrangler deploy --env qa
   npx wrangler deploy --env production
   ```

   This creates `tc-admin-qa` and `tc-admin` in the dashboard.
4. **Connect the repository to each Worker.** Workers & Pages → the Worker → Settings → Builds → Connect → choose the GitHub account and `unfoldingWord-box3/tc-admin-app`. The first time, GitHub asks to install the "Cloudflare Workers and Pages" app; grant it access to this repository only. Then set, per Worker:

   | Setting | `tc-admin-qa` | `tc-admin` |
   | --- | --- | --- |
   | Production branch | `main` | `production` |
   | Root directory | repository root | repository root |
   | Build command | `npm ci && npm run build` | `npm ci && npm run build` |
   | Deploy command | `npx wrangler deploy --env qa` | `npx wrangler deploy --env production` |
   | Preview builds | enabled, `npx wrangler preview --env qa` | disabled |

5. **Runtime secrets, per Worker.** Workers & Pages → the Worker → Settings → Variables and Secrets → add `DOOR43_CLIENT_ID`, `DOOR43_CLIENT_SECRET` (from #2's OAuth applications, QA values on `tc-admin-qa`, production values on `tc-admin`), and `SESSION_SIGNING_KEY` (32 or more random bytes, base64; different per Worker). Secrets live only in Cloudflare.
6. **Protect the `production` branch on GitHub.** Repository → Settings → Branches → Add rule for `production`: require a pull request, require Rich's review. The agent creates the branch from `main` once the QA deployment is verified.

Never paste a secret into a chat with an agent. If a value must reach an agent session, it goes into the session environment's configuration as an environment variable.

## 4. Branches, releases, hotfixes, and rollback (ADR 0015)

Two long-lived branches, no `develop`. `main` is the trunk: every branch but a hotfix starts from it, every pull request but a release or a hotfix targets it, the bench reviews it, a merge deploys QA. `production` is what is live and moves only by a release or a hotfix. Both are protected on GitHub: a pull request is required, and neither can be deleted or force-pushed. The version lives in the root `package.json` (semantic, `0.x` until the pilot ends) and is the one the Worker writes as `softwareVersion`.

**A release**, when `main` holds what should go live:

1. On `main`, an ordinary pull request "Prepare v0.2.0" bumps `version` in `package.json`. The bench reviews it like any other; it may carry the release's document updates.
2. A pull request from `main` to `production`, titled "Release v0.2.0", with the generated notes or a summary in its body. It carries no commits of its own. Rich's approval is the production gate; the bench does not review it, having reviewed every piece.
3. Rich merges it **with a merge commit** (never squash or rebase), so `production` keeps `main`'s history and the next release pull request is clean.
4. On the push, Builds deploys `tc-admin`, and the `release` workflow creates the tag `v0.2.0` at the merge commit and publishes the GitHub release, its notes grouped by label (`.github/release.yml`: `enhancement` under Features, `bug` under Fixes, `documentation` under Documents). If the tag already exists, the workflow does nothing, so a push that does not bump the version makes no release.
5. Verify as in section 3 step 3: `/api/situation` configured for Production at `https://admin.translationcore.com`, the page's bundle, `npx wrangler deployments list --env production`.

**A hotfix**, when production needs a change that cannot wait for the next release, without the unreleased work on `main`:

1. Branch `hotfix/<name>` from `production`. Make the fix and bump the third number of `version` (`0.2.0` → `0.2.1`), with a test if the fix crossed an invariant.
2. A pull request to `production`, labeled `bug`. The bench reviews it; Rich merges it with a merge commit. Builds deploys, the workflow tags `v0.2.1` and publishes the release.
3. The same day, a pull request from `production` to `main`, "Back-merge v0.2.1", so `main` has the fix and the version. It merges cleanly: `production` holds nothing that did not come from `main` except hotfixes. Never leave `main` behind `production`.

**A rollback**, when a deploy must come off now:

1. `npx wrangler rollback --env production` (Rich, logged in; or Workers & Pages → `tc-admin` → Deployments → the previous version → Rollback) puts the previous version live in seconds, secrets untouched.
2. Then make the branch match: a revert pull request on `production` (`git revert -m 1 <merge commit>` on a branch from `production`), merged like a hotfix, with the version bumped in the same pull request, and back-merged to `main`. Until it merges, `production` still names the bad commit: do not retry or re-run its Workers Builds deploy. Production is never left running a version its branch does not describe.

**Who does what**

- The agent branches from `main` (from `production` only for a hotfix Rich asks for), commits, pushes, opens and labels pull requests, and, when asked, merges pull requests to `main` whose checks are green. Merging to `main` deploys QA; until Workers Builds is connected (#9), the agent deploys QA by hand from `main` after a merge, as section 3 step 3 records.
- Rich approves and merges every pull request to `production`: releases and hotfixes. Cloudflare deploys; the workflow tags and publishes.
- Rich merges anything that changes an ADR or an invariant, unless he says otherwise.
- Wrangler runs locally only for section 3 step 3, for `wrangler dev`, and for a rollback.

## 5. Local development

Copy `.env.example` to `.env` with the QA OAuth client, then `npm run dev` builds the web app and runs the Worker locally (`wrangler dev`, the top level of `wrangler.jsonc`) against QA, with local KV. For reloads while editing the interface, run `npx wrangler dev` and `npm run dev --workspace web` side by side; Vite sends `/api/` and `/auth/` to the Worker, presenting the Worker's own origin so the same-origin check on mutations passes (A4). The QA test user's credentials (`TEST_ORG`, `TEST_USER`, `TEST_PASSWORD`, `TEST_TOKEN`, E23) are for probes and the Playwright smoke test, never for the application itself, which always acts as the signed-in manager (A3).

## 6. After a QA reset

QA Door43 becomes a copy of production each Monday (E23). Observed at the 12 October 2026 reset (E82, E83): the QA Worker and its OAuth registration need nothing. Sign-in on `https://tc-admin-qa.unfoldingword.workers.dev` works as before, with the client id, secret, and signing key the Worker already holds (Q9, #4). What the reset does take away, and what to do, in order:

1. **The API token.** A token works only on the host that issued it, and the reset removes any issued on QA (E82). Since 12 October 2026 `TEST_TOKEN` is issued on production for `tc-admin-qa`, so each reset copies it to QA and nothing is reissued (E83, Rich's decision); it works on production too, where every script refuses to write by its host check. If it ever answers 401 on QA, Rich reissues it on production with `read:user`, `write:user`, `write:repository`, and `write:organization` (E49, Q28) and puts it in `.env`: never in the repository, a log, or a chat.
2. **Check sign-in.** `E2E_HEADLESS=1 npm run e2e` signs in through the deployed QA Worker (E76). If it fails on QA's authorization page, look at the QA OAuth application's settings on qa.door43.org first: E38 lists the redirect URIs it must have.
3. **Rebuild the standard test projects.** `node --env-file=.env scripts/seed-qa.mjs` (#3); a second run changes nothing. Record the run in the evidence register with the date of the reset it followed (done after the 12, 19, and 26 October 2026 resets, E83).
4. **Clear the QA Worker's stored release records.** The Worker keeps each release preparation and its `release-tag` receipt in its `PLANS` namespace on Cloudflare for 30 days, and a reset does not touch it, so afterwards the release page of such a tag says that tC Admin made a release Door43 no longer has (#188), and a preparation under way before the reset would still be listed, though its temporary branch is gone (inferred from the code; E87 found none under way). List them with `npx wrangler kv key list --binding PLANS --env qa --remote`. Only the `preparation:` and `receipt:release-tag:` keys are kept 30 days; every other key (a plan, its receipt, its attempt) lives a day or less and expires on its own. Of those two kinds, a key whose `expiration` is less than 30 days after the reset was last written before it and is stale: write those names to a JSON array of strings and delete them with `npx wrangler kv bulk delete <file> --binding PLANS --env qa --remote --force`. The listing can name a deleted key for a few minutes; `npx wrangler kv key get <name> --binding PLANS --env qa --remote` answering 404 means it is gone, and the Worker skips a listed key without a value. Leave `SESSIONS` alone: its keys are current sign-ins, which expire on their own. Local `npm run dev` does not use them: Wrangler keeps its own `PLANS` and `SESSIONS` on the machine (its bindings table says "local", Wrangler 4.146, 28 October 2026), so this step does not reach them. Done after the 26 October 2026 reset (E87).
5. **Know what else is gone.** Every repository, commit, release, and tag made on QA since the previous reset, a rehearsal's included (E58). `bahtraku/Perjanjian-Baru-Pendau` is production's again, which is the state a demo rehearsal needs ([demo-script.md](demo-script.md)). A plan or a lookup reads Door43 live, so neither is affected by what step 4 clears.

## Appendix: deploying from GitHub Actions instead

If the Git integration is ever unavailable, the alternative is a GitHub Actions workflow running Wrangler with an account-scoped API token (Cloudflare: My Profile → API Tokens → *Edit Cloudflare Workers* template plus Workers KV Storage: Edit) stored as the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, with a `production` GitHub environment requiring Rich's review. Previews would use `npx wrangler versions upload --env qa --preview-alias preview`, giving one fixed URL `preview-tc-admin-qa.<subdomain>.workers.dev` that the QA OAuth application can register. Everything else in this document stays the same.
