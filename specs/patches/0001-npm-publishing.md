# Patch 0001 — npm publishing

- **Type:** Bug Report
- **Stage:** Proposed
- **Origin:** Developer seed, 2026-07-28 (written on Developer's behalf by Liaison)

## Motivation

The xspec product is complete and green on `main` of its dedicated repository (`modularcloud/xspec`), but it has never been distributed. The initial build's release was deliberately deferred by Developer decision — `specs/DEVOPS.md` records the deferral and the release-candidate commit — because the work then lived in the SDG process repository rather than the product's own. The product has since been relocated to this repository. Developer has now authorized and requested distribution: a first publish, plus a standing automated release path so distribution never lags `main` again.

## Change requested

1. **First publish.** The product is published to the public npm registry under the package name `@modularcloud/xspec`, from the `main` branch as it stands. Publishing changes nothing about product behavior: what is published is the product as already specified and implemented.
2. **Standing automated releases.** Going forward, every change that lands on the `main` branch of this repository is automatically released to npm, without Developer involvement per release. Each release carries a version greater than every previously published version, and a release happens only from a green build (per the standing DEVOPS rule: never release with red CI).
3. **Release logic recorded in `specs/DEVOPS.md`.** The standing release procedure above becomes part of `specs/DEVOPS.md`, the document PROCESS.md designates as owning how and when release, merge, and deploy actions happen. DEVOPS.md's description of the deferred initial-build release in the old repository is superseded by the reality that this repository is now the product's home.
4. **Concise manual checklist.** Everything that genuinely requires Developer's own accounts or credentials — npm organization access for the `modularcloud` scope, publish credentials, repository secrets, and similar — is collected into one concise checklist handed to Developer at the end. Everything that does not require Developer's credentials is done automatically by the process.

## Developer's working instructions (archival, from the seed)

- The process should do as much as possible automatically. Whatever genuinely requires Developer's own accounts or credentials (npm organization access, publish credentials, repository secrets, and similar) must be collected into a concise manual checklist and handed to Developer at the end.
- Publish from the `main` branch as it stands. Unrelated uncommitted docs work-in-progress in the local checkout is to be disregarded: leave it on disk, never commit it, never delete it; base all work on `origin/main`.

Archival observation from triage (not a prescription): the repository's package metadata predates the relocation — it names the package `xspec` (unscoped) and points at the old `modularcloud/sdg-claude` repository — so the published artifact's metadata will need to correctly identify the package as `@modularcloud/xspec` and this repository as its home.

## Classification rationale

- **No changes to `SPEC.md`.** SPEC.md defines product behavior through its complete interface — the `xspec` command-line executable, the `xspec.config.ts` configuration, the source-file syntax, the generated TypeScript modules, and the files xspec writes to the workspace. The distribution channel is not part of that contract, and no product behavior changes here. Per PROCESS.md, a patch that does not require changes to `SPEC.md` is classified as a bug.
- **No test harness update is targeted, and no changes to `TEST-SPEC.md` (or `CERTIFICATIONS.md`) are necessary.** There is no product misbehavior for the harness to catch: this patch introduces no product change and reports no defect. Its substance is release machinery, which PROCESS.md places under `DEVOPS.md` and the Release phase.

## Considerations for refinement

- The versioning policy for automated releases: how the strictly increasing version of each `main` release is determined, and what version the first publish carries — specified behaviorally, without prescribing tooling. Developer's instruction is maximal automation, so the policy must not require Developer involvement per release.
- The release gate: whether anything beyond green CI must hold before an automated release proceeds.
- The exact boundary of the manual checklist: which one-time setup actions can be prepared by the process versus which require Developer's own accounts, so the checklist stays minimal.

## Stage history

- 2026-07-28 — **Proposed**. Drafted from the Developer seed during triage.
