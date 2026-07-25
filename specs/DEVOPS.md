# DEVOPS

This document defines how release, merge, and deploy actions are performed for this project, and when. The Release phase acts only on the authority of this document. Any situation not clearly covered here requires asking Developer first; the answer is then recorded here so it is never re-asked.

## Standing rules

- Never merge with red CI. A release candidate is a commit at which the full test suite and every CI job are green.
- Never rewrite pushed history. Ordinary commits only.
- External release artifacts — version tags, GitHub Releases, package publishes, deploys — always require explicit Developer authorization. Absent that authorization, the default is deferral: take no external action and record the release candidate instead.

## Initial build on `modularcloud/sdg-claude` (this repository)

This repository is the SDG process's home, not the product's. The `xspec` product was built here on branch `sdg/initial-build` (PR #1), and Developer will personally relocate the work to a dedicated xspec repository after the initial build completes. A release artifact created here (tag, GitHub Release, package publish) would brand the wrong repository as the product's home and would outlive the branch it points at — so none are created.

Release procedure for the initial build — **deferred**, by explicit Developer decision:

- Take no external release action from this repository.
- Do not merge PR #1. It intentionally carries a `specs/GOALS.md` merge conflict and stays open, untouched. Do not merge `main` into the branch.
- Do not create version tags, GitHub Releases, or package publishes.
- Leave branch `sdg/initial-build` and PR #1 exactly as they are.
- The deliverable is the green branch head, ready for Developer's switch-over to the dedicated xspec repository. Release candidate: commit `9316048` — full suite green locally (485/485), all three CI jobs green. Commits after it on the branch are process bookkeeping only (spec-document edits, no product code).

## Future runs in the product's own repository

Once xspec lives in its own repository, the normal release flow for a completed patch is:

1. Merge the patch's PR once CI is green on the PR head (never with red CI).
2. With explicit Developer authorization, tag the release commit; a GitHub Release and/or package publish additionally requires Developer-provided credentials.
3. Absent authorization for any external artifact, defer that artifact and record the release candidate, per the standing rules.

## Post-update actions

None defined yet (no docs-update or deploy pipelines exist). Define them here as they are introduced.
