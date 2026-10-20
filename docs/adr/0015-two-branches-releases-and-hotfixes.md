# Two long-lived branches: `main` deploys QA, `production` deploys production; releases and hotfixes are pull requests

Status: accepted by Rich, 20 October 2026. Makes the branch model of docs/deployment.md §2 a decision and adds the release, hotfix, and rollback rules.

## Decision

1. **`main` is the trunk.** Every feature branch starts from it (`claude/<name>` for agent sessions), every pull request targets it, the review bench reviews it, and a merge deploys the QA Worker. There is no `develop` branch: `main` is always deployed somewhere a person can look at.
2. **`production` is what is live.** It moves only two ways: a **release pull request** from `main`, or a **hotfix pull request** from a branch made from `production`. Nothing else is pushed, cherry-picked, or merged onto it. Both branches are protected by GitHub rulesets: a pull request with one approving review is required, and the branch cannot be deleted or force-pushed.
3. **Deploys come from branches; tags mark them.** Cloudflare Workers Builds deploys on a push to the connected branch and has no tag trigger, so the `production` branch is the production trigger. A GitHub Actions workflow (`.github/workflows/release.yml`) runs on every push to `production`: it reads the version from the root `package.json`, and if the tag `v<version>` does not exist, it creates it at that commit and publishes a GitHub release whose notes are generated from the merged pull requests since the previous tag, grouped by label (`.github/release.yml`). Tags are never made by hand.
4. **Releases.** The version is bumped on `main` first, by an ordinary pull request ("Prepare v0.2.0") that the bench reviews. The release pull request `main` → `production` ("Release v0.2.0") carries no commits of its own; Rich's approval of it is the production gate, and the bench does not review it, having reviewed every piece. It merges with a merge commit, never a squash or a rebase, so `production` keeps `main`'s history and the next release pull request stays clean.
5. **Hotfixes.** A branch `hotfix/<name>` from `production` carries the fix and a patch bump of the version. Its pull request targets `production`, the bench reviews it, Rich merges it, Builds deploys it, and the workflow tags it. The same day, a pull request `production` → `main` ("Back-merge v0.2.1") brings the fix and the bump to `main`; it merges cleanly because `production` holds nothing that did not come from `main` except hotfixes.
6. **Rollback.** `npx wrangler rollback --env production` puts the previous version live in seconds. The branch is then made to match by a revert pull request on `production`, which is back-merged like a hotfix. Production is never left running a version its branch does not describe.
7. **Versions are semantic**, `0.x` until the pilot ends: the first number grows for a change a manager must relearn, the second for new behavior, the third for a hotfix. The version in `package.json` is the one the Worker writes as `softwareVersion` and the one the release carries, so the two cannot disagree.

## Why

This is the shape most teams use with Cloudflare's Git integration: one branch per deployed environment, previews on pull requests, and the production branch guarded by a review. A `develop` branch (git flow) adds a merge step without adding a place to look, since `main` already deploys QA. Tag-only deploys would mean replacing Workers Builds with a GitHub Actions deploy holding a Cloudflare API token to rotate (deployment.md, appendix), for no gain over a protected branch; keeping the tag as a mark the workflow makes, after the branch deploys, gives the release page and the exact commit without a second deploy path.

Hotfixes need a path that does not carry unreleased work. Branching from `production` gives one; back-merging the same day keeps `main` ahead of `production` at all times, which is what makes the next release pull request a clean fast-forward in content. Bumping the version on `main` before the release, rather than on the release branch, means a release pull request has no commits to back-merge.

An agent and a review bench are the ones doing most of the work here, so the rules are mechanical on purpose: which branch to start from is decided by the kind of change, the tag and release are made by a workflow, and the only judgment left is Rich's approval of what goes live.

## Consequences

- Milestone 2 work merges to `main` from 20 October 2026 without affecting production, which stays at `v0.1.0` until a release pull request.
- Every pull request to `main` carries one of the labels `enhancement`, `bug`, or `documentation`, so the generated release notes group it; an unlabeled one lands under "Other".
- The `check` workflow runs on pushes to `production` too, so a hotfix or release is checked where it lands as well as in its pull request.
- `wrangler deploy --env production` by hand (deployment.md §3 step 3) is for before Workers Builds is connected (#9); after that, a hand deploy of production is an exception to record.
- docs/deployment.md §2 and §4 describe the flows step by step; AGENTS.md names the branch to start from.
