# DEVOPS

This document defines how release, merge, and deploy actions are performed for this project, and when. The Release phase acts only on the authority of this document. Any situation not clearly covered here requires asking Developer first; the answer is then recorded here so it is never re-asked.

## Standing rules

- Never merge with red CI. A release candidate is a commit at which the full test suite and every CI job are green.
- Never rewrite pushed history. Ordinary commits only.
- External release artifacts require explicit Developer authorization. Two standing authorizations exist, granted by Developer on 2026-07-28: publishing `@modularcloud/xspec` to the public npm registry from green `main` commits of this repository, and the `vX.Y.Z` git tags marking those publishes. Any other kind of external artifact (deploys, GitHub Releases, publishes elsewhere) still requires fresh authorization; absent it, the default is deferral — take no external action and record the release candidate instead.

## This repository is the product's home

`modularcloud/xspec` is the xspec product's dedicated repository, and `main` is its released line. (The product was originally built in `modularcloud/sdg-claude`, the SDG process's home, where release was deliberately deferred so no artifact would brand that repository as the product's home; Developer relocated the work here on 2026-07-27, superseding that deferral and its recorded release candidate `9316048`.)

The normal Release-phase flow for a completed patch is:

1. Merge the patch's PR once CI is green on the PR head (never with red CI).
2. Nothing further. The standing npm release procedure below publishes the merged commit automatically; there is no per-release tagging, publishing, or Developer step.

## npm releases (standing procedure)

- **Artifact.** The public npm package `@modularcloud/xspec`. `package.json` must always identify the package by that name, with this repository as `repository`/`homepage`/`bugs`, and carry `publishConfig.access: public`.
- **Trigger.** Every push to `main` (a PR merge is a push). The `Release` workflow (`.github/workflows/release.yml`) runs when the `CI` workflow completes for a `main` push.
- **Gate.** The publish job runs only when that CI run concluded successfully, and it checks out exactly the commit CI validated — the never-release-with-red-CI rule is enforced mechanically. Nothing beyond green CI gates a release.
- **Versioning.** Strictly increasing, computed by `.github/scripts/next-version.mjs` with no Developer involvement: if `package.json`'s version is greater than the latest published version (or nothing is published yet), that version is released — a deliberate minor/major bump is made by landing the `package.json` change on `main`; otherwise the latest published version's patch component is incremented. The registry and the `vX.Y.Z` tags are the record of released versions; the computed bump is not committed back to `main`, so the in-repo version is the floor, not the record.
- **Tags.** Each successful publish pushes the lightweight tag `vX.Y.Z` on the released commit, using the workflow's own repository token.
- **Credentials.** Publishing authenticates with the `NPM_TOKEN` GitHub repository secret — a granular npm automation token with read/write access to the package (or the `@modularcloud` scope), created under Developer's npm account. Credentials live only in that secret, never in the repository. If the token is missing or expired, recreate it on npmjs.com and set it again with `gh secret set NPM_TOKEN`.
- **Failure handling.** A missing/invalid secret or any publish error fails the Release run loudly — a release is never silently skipped. Re-running a failed Release run publishes the commit it was gated on and is always safe: the registry refuses to republish an existing version, so duplicate attempts fail rather than corrupt the sequence. A failed run never blocks later landings, which release independently.

## Post-update actions

None defined yet (no docs-update or deploy pipelines exist). Define them here as they are introduced.
