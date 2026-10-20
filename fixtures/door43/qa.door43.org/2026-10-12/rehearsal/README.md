# QA rehearsal of the demo script, 12 October 2026 (E84)

Public reads of `bahtraku/Perjanjian-Baru-Pendau` and `tc-admin-qa-org/id_demo1021` on qa.door43.org, taken after each write the browser run of `docs/demo-script.md` made through the deployed QA Worker. No credentials were used for these reads; each file is reduced to the fields the entry cites. No token, no email.

| File | After |
| --- | --- |
| `01-branches-after-prepare-v1.2.1.json` | the rehearsal's `release.prepare` (branch `temp-tca-release/v1.2.1`) |
| `02-commit-ec92c3ef.json` | the same: the snapshot commit, its parent and files |
| `03-branches-after-create-v1.2.1.json` | `release.create` of the pre-release `v1.2.1`: the branch is gone |
| `04-releases-after-create-v1.2.1.json` | the same: the releases, `v1.2.1` a pre-release |
| `05-catalog-after-create-v1.2.1.json` | the same: `prod` still `v1.2`, `preprod` `v1.2.1` |
| `06-releases-after-promote-v1.2.1.json` | step 2, `release.promote` |
| `07-catalog-after-promote-v1.2.1.json` | the same: `prod` on `v1.2.1` |
| `08-commit-2d865cbc.json` | step 4, the `v1.2.2` snapshot commit |
| `09-branches-after-prepare-v1.2.2.json` | the same: the branches |
| `10-branches-after-create-v1.2.2.json` | step 7, the pre-release `v1.2.2` created, the branch gone |
| `11-releases-after-create-v1.2.2.json` | the same: the releases with their bodies (the edited notes line) |
| `12-releases-after-promote-v1.2.2.json` | step 8, `v1.2.2` promoted |
| `13-catalog-after-promote-v1.2.2.json` | the same: `prod` on `v1.2.2` |
| `14-repo-id_demo1021.json` | step 9, the created repository |
| `15-branches-id_demo1021.json` | the same: `main` alone |
| `16-health-id_demo1021.json` | the same: health `info`, `release_needed` |
| `17-catalog-entry-id_demo1021-main.json` | the same: the catalog entry once indexed |
| `18-commit-da0906fe.json` | S8, the `v2.0.0` snapshot commit removing 3 John |
| `19-branches-after-create-v2.0.0.json` | S8, `v2.0.0` created: `master` the only branch |
| `20-releases-after-create-v2.0.0.json` | the same: the releases |
| `21-catalog-after-create-v2.0.0.json` | the same: `prod` on `v2.0.0` |
| `22-3JN-at-v1.2.2-and-v2.0.0.json` | the same: 3 John present at `v1.2.2`, absent at `v2.0.0` |
| `23-metadata-v2.0.0-summary.json` | the same: `v2.0.0`'s `metadata.json` counts |
| `24-health-v2.0.0.json` | the same: health at the tag |
| `finished-at.txt` | the time of the last read |
