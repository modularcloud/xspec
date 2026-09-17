# FIX_PLAN — Phase 9 (test harness), second re-descent, compliance determination 1

Planned 2026-09-10 from: reviewer A (TEST-SPEC.md §0–8, 28 gaps), reviewer B (§9–16, 31 gaps), reviewer C (§17–18 + CERTIFICATIONS.md, 4 gaps), and the VERIFY report at 8342cdc (three red self-tests in `test/self/certification-document.test.ts`; T4.5-8, T6.5-7, T6.5-9 diagnosed product failures — allowed at this phase, no task). Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tested). Bundle: `specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`.

## Rules for every task (read before starting any of them)

- **Phase 9 scope guard.** Edit only under `test/`, `.github/`, harness configuration, `AGENTS.md` (build/lint/run knowledge only), and this file. Never touch `src/`. Product tests are expected to fail against the product; harness self-tests and certifications must pass.
- **Definition of done for a task:** `npm run typecheck` clean; `npm run format:check` clean (use the repository's format script to fix); `npm run test:self` fully green (certification included — any task touching a test named in a CERTIFICATIONS.md in-scope list re-certifies that fixture); the touched product-facing tests run against the built product (`npm run build` first, then `npx vitest run --config test/vitest.config.ts --project suite test/suite/<section file>.test.ts --reporter=verbose`) either pass or fail as a *diagnosed product failure* (a `HarnessAssertionError` whose message states what the product did wrong, TEST-SPEC H-8) — never a harness error, timeout, or crash. Commit `sdg(phase-9): <imperative summary>` ending with the two trailer lines the spawn prompt gives, push to `origin claude/xspec-ui-apis-4df8fa` (retry on network errors with 2s/4s/8s/16s backoff), then delete the finished task from this file (or the whole file when it is the last task).
- **Registration mechanics** (new test IDs): the body is a `ProductTestEntry` (`{ id, title, run }`) in the section's module under `test/suite/registry/section-*.ts`, spread into `test/suite/registry/index.ts`, mapped to its SPEC.md passages in `test/suite/registry/traceability.ts` (H-7; checked by `test/self/s1-traceability.test.ts`), and declared where the thin wrapper `test/suite/section-*.test.ts` / `test/suite/declare.ts` requires. Mirror the file set of commit 8342cdc (T6.3-5) or 24c9487 (T4.5-8): `git show --stat <sha>`.
- **Escape spellings.** The tool-parameter layer decodes `\uXXXX` in edit payloads; when a test needs the six-character source spelling (e.g. `id="a\u002Eb"`), write it as `\u002E` in the payload and verify the file bytes with `grep -c 'u002E'` afterwards.
- **Platform-gated arms.** Linux-only stagings (non-UTF-8 path bytes; permission removal) follow the existing pattern `const NU3_STAGED = process.platform === "linux"` in `test/suite/registry/section-11.5.ts`; a Linux-leg test (T13.5-7, T14-9, T14-10) must not be selected by the Windows project's registry-ID subset (E-6) unless its body is platform-safe — check the selection list before registering.
- **H-11 harness errors vs H-8 product failures.** `HarnessAssertionError` (`test/helpers/assertions.ts`) means "diagnosed product failure". An ineffective staging, an unreachable precondition, or a harness bug must surface as a distinct error class (`HarnessStagingError` in `test/helpers/permissions.ts`), never as a `HarnessAssertionError`, a pass, or a skip (H-9).
- **Infrastructure caution.** Keep each spawn's edits bounded: a few tool calls per response, modest payloads, no single giant write. Large section files (section-6.5.ts, section-13.5.ts, section-14.ts, section-12.7.ts) are edited with targeted `Edit`s, not rewrites.

Ordering: Part A turns the three red self-tests green (certification manifest/gate cluster). Part B lands shared helpers. Parts C–E are consumers, ordered by dependency; within a part, order is free. Parts A and B are complete: the CONF-VALID conformer (`test/fixtures/conf-valid/product.mjs`) now rejects `"`, `'`, `\`, `&`, and U+FFFD in segments and tags (14.4), reads attribute values verbatim, emits one 14.4 finding per offending `id`/`tags` attribute located at the attribute's own characters (name through closing quote), and emits tag sets in UTF-8 byte order with duplicates collapsed; P-1's oracle (`valueVerdict` in `test/suite/registry/section-16-p1.ts`) judges the same five characters invalid, since its alphabet already staged both quote characters.

Task 8 landed (459ea19, ca381ee): the harness vocabulary (`test/helpers/adapters/model.ts`) holds SPEC 14's 25 condition tokens — `USAGE_ERROR_CONDITION_CODE_TOKENS` names 14.24 `write-failure` and 14.25 `read-failure`, which the findings-array decode rejects and only the exit-2 error document's `code` admits — and no `refused-unresolvable-reference`. T14-6's 14.24/14.25 arms stage T14-9 (f) (`.xspec` unwritable on a stale workspace, `stageWriteRefusalUnder`) and T14-10 (g) (`specs/sub` unlistable, `stageReadRefusalOfDirectory`) through `test/helpers/permissions.ts`, Linux-gated by the NU3_STAGED pattern; a discovered source's refused content read is condition 20 (SPEC 14.25, T14-10 (a)), never `read-failure`, so Tasks 10–11 must not stage it as one. Against the built product both refusals end in exit 70 (an internal error at the `EACCES`), so T14-6 fails as a diagnosed product failure at its 14.24 arm and T14-9/T14-10 will diagnose the same.

Task 9 landed: T13.5-7 is rewritten as "interrupted or write-refused mutation: the pinned write order" — the refusal arms (a)–(f), their fixtures, stagings, twins, and pinned-state laws live in `test/suite/registry/write-refusal-staging.ts` (section-13.5.ts composes them and re-exports the hold helpers `holdPathFor`/`awaitHoldFile`, which moved there). For Task 10's T14-9 reuse: `RENAME_FIXTURE`/`MOVE_FIXTURE` (each with a prior journaled rename that makes the workspace journal-bearing — `build` creates no journal), `prepareRefusalWorkspace` (build, prior rename, `check` clean, git commit as the `impact` baseline), `completeOnTwin`, `runHeldWithStaging`/`runStaged` (staging applied at the seam, restored at exit), `refusalAt`/`refusalUnder` (the T14-9 disciplines), `expectWriteFailure` (exit 2, the error document, `code` `write-failure`, `path` among the admissible concerned paths), and the exported arms. The move fixture keeps the imported spec file under a second glob root (`docs/Other.mdx`) so `out/specs` holds exactly the two Markdown files (c) admits — SPEC 12.1 makes a regeneration rewrite every derived file, so a third `.mdx` under `specs/` would put a third refused write there. Red-checked with a stand-in that maps the product's exit-70 `EACCES` crash to the error document (AGENTS.md): every arm passes against the product's real partial states except (d), where the product rewrites the importer `src/app.ts` before removing the origin — a diagnosed product deviation from 13.5's order (the relocation's two writes precede `src/` in `files` order). Against the built product T13.5-7 fails diagnosed at arm (a)'s exit-code assertion (exit 70).

Task 10 landed: T14-9 is registered in the split module `test/suite/registry/section-14-ii.ts` (array `section14iiTests`, spread in `index.ts` after `section14ValidationTests`, declared by the wrapper `test/suite/section-14-ii.test.ts`, mapped in `traceability.ts` to "14", "12.0", "12.7", "13.3", "13.5") — the home for T14-10 too (Task 11: append it to `section14iiTests` in canonical order). Its arms are contract and recovery only (T13.5-7 asserts the per-command states): each stages through Task 9's helpers, decodes the error document with `expectWriteFailure` plus a non-empty-stderr check, and ends with `build` exit 0 and `check` clean. Arm (a) drives the child rename `b.k` → `b.k2` (referenced nowhere) so the refused rewrite of `specs/b/B.mdx` is the operation's first write and the recovery clause holds on the pinned "nothing written" state — the multi-file rename's partly applied, failing state being T13.5-7 (a)'s; (b)–(f) stage as T13.5-7 does, plus `specs/sub` unwritable for the destination's production (nothing relocated). The reporter sweep runs on one stale, session-bearing workspace of the rename fixture extended with a code group `app` (`src/app.ts` importing A's module): the nine refreshing reads and `review create` each concern `.xspec`; `check` exits 1 with 14.10 alone, `inventory` and `version` exit 0, `rename --preview` exits 0; `query nodes --group app` and `query node specs/a/A.mdx#missing` exit 2 with `code` null; a failing twin (A's `d` reference respelled) gives `ids` exit 1 with one 14.5 finding; the identity-unchanged rename under (a)'s staging exits 1 with `refused-identity-unchanged` alone and nothing written; a `--test-hold` path in a read-only directory beside the workspace exits 2 with `code` null. Through the AGENTS.md stand-in every arm passes against the product's real partial states (~40 s), and wrong-path and silent-stderr perturbations are caught at arm (a); against the built product T14-9 fails diagnosed at arm (a)'s exit-code assertion (exit 70).

Task 11 landed: T14-10 is registered beside T14-9 in `test/suite/registry/section-14-ii.ts` (`section14iiTests` = [T14_9, T14_10]; traceability "14", "10.7", "11.2", "11.5", "11.6", "12.0", "12.7", "13.3"), Linux-gated through `WRITE_REFUSALS_STAGED`, one arm per row of 14.25 through `stageReadRefusalOfFile` (mode 0o200) and `stageReadRefusalOfDirectory` (mode 0o100). Arm (a) uses its own fixture (`specs/A.mdx` → `specs/B.mdx` → `specs/C.mdx` ← `specs/D.mdx`, plus `src/app.ts` marking `A.a` under a code group) with a premise that B's `d` reference and the marker record occurrences when readable, so "no record for its spellings" is a masking, not an absence; (b)–(f) and (h) run on `RENAME_FIXTURE` via `prepareRefusalWorkspace`, (g) on the rename fixture plus `specs/sub/S.mdx` (and a second workspace with an invalid configuration for the 14.14-precedes-the-read clause). Snapshots for the nothing-modified laws are taken before staging and after restoring (a staged object cannot be snapshotted). Arm (f) stages every plain file of T13.3-2's graph-data set (`isGraphDataKey`, files only — directories keep their listing and write permission so the regeneration `ids` owes is never itself refused) and restores only the stagings whose files survive the regeneration; its preview is `move specs/c/C.mdx specs/c/D.mdx --preview --json`. The two unstageable clauses (a refused kind read; a directory above the root) are recorded in the module header and the title, asserted nowhere. Against the built product in the unprivileged namespace, each arm driven alone: (a), (c), (d), (e) pass; (b) and (g) die with exit 70 (`EACCES` at the journal `open` / the `scandir` of `specs/sub`); (f)'s `inventory` reads the unreadable record as the empty record (`"recorded": []`, findings [], exit 0); (h)'s `review list` answers `"sessions": []` at exit 0 — so T14-10 fails diagnosed at arm (b) within seconds, and no arm raises a harness error.

Task 12 landed: T12.7-3 (`test/suite/registry/section-12.7.ts`) gained, inside `runErrorConfigPathsArm`, the unoccupied-`--config` echo arms — from `work/`, `--config ./../cfg//xspec.config.ts` and an absolute `cfg/absent.config.ts`, each reported byte-for-byte as given (SPEC 14), the pair snapshot-compared as modifying nothing — and, once the malformed `cfg/xspec.config.ts` exists, the same two spellings reported canonical `../cfg/xspec.config.ts` (existence, not spelling, decides the form); plus two Linux-leg arms gated by `LINUX_LEG_STAGED` (the NU3_STAGED pattern, run last): `runErrorSymlinkWorkingDirectoryArm` (working directory `R/L`, a symlink to `R/a/b`; `--config ./../xspec.config.ts` naming the malformed `R/a/xspec.config.ts`; reported `../xspec.config.ts`) and `runErrorEnvironmentRefusalArms` (T14-6's stagings — `stageWriteRefusalUnder(.xspec)` on a stale built workspace, `stageReadRefusalOfDirectory(specs/sub)` — each `build --json` decoded by the new `assertEnvironmentRefusalDocument`: exit 2, non-empty stderr, form-exact `{"code": "write-failure", "path": ".xspec"}` / `{"code": "read-failure", "path": "specs/sub"}` with locations []). Traceability stays `["12.7"]` per the row's recorded precedent (14.24/14.25's primary tests are T14-9/T14-10, which T12.7-3 cites); T12.7-3 is in no fixture's in-scope list, so certification is untouched. Against the built product: the existing-file spellings and the symlinked working directory answer exactly as pinned, but the product canonicalizes an unoccupied `--config` value (`../cfg/xspec.config.ts`, `../cfg/absent.config.ts`) where 14 pins the argument as given, so T12.7-3 now fails diagnosed at that first new arm (a `HarnessAssertionError` showing actual vs expected path); the refusal arms would fail diagnosed at their exit-code assertion (exit 70). Behind the AGENTS.md stand-in (the unoccupied value echoed as given; exit-70 `EACCES` mapped to the error document) the whole test passes in ~6 s, and a wrong concerned path or an empty stderr on the refusal arms is caught at the write-failure arm. Self project 357 passed / 1 skipped under the unprivileged namespace.

Task 13 landed: T14-7 (`test/suite/registry/section-14.ts`) gained two stagings of its own. The destination-spelling workspace (`T14_7_SPELLING_FILES`: a root-level origin `a.mdx` under a root-level glob `*.mdx`, beside `specs/b.mdx`) drives `./a.mdx`, `specs//b.mdx`, and `specs/../specs/b.mdx` as the file form's destination and as a section form's target path (`<new-id>` `z`, colliding with nothing), each refused `refused-invalid-destination` alone — the exact one-entry multiset excludes `refused-destination-exists` and `refused-identity-unchanged` — with `path` the spelling as given. The import-cycle workspace (`specs/B.mdx` importing `A` and using the binding through `d={A.keep}`; `user` in `specs/A.mdx` referencing the moved `x` in local form) drives `move specs/A.mdx#x specs/B.mdx#x` and asserts `refused-cycle` every-participant strict through `locatedAtEach`: the local reference spelling in A (the `d={"x"}` window) then B's import declaration (the window of its own characters), path null — never a range for the import that does not yet exist. The no-unlisted-code clause is recorded at `assertRefusalReport` and in the module header rather than by new code: the form-exact decode admits only 14's codes (`forms.ts` KNOWN_CODE_TOKENS), so an unlisted code fails as an H-3 form failure before any count, and the exact multiset excludes every listed code beside the staged reasons. Against the built product the six spelling arms answer exactly as pinned, while the import-cycle arm fails diagnosed — the product locates B's import declaration `[0, 25)` alone, not the local reference spelling whose rewrite adds the closing import — and T14-7 as a whole still fails diagnosed first at its rename `refused-invalid-id` arm (the produced `a.then.kid` identity). Red-checked through the AGENTS.md stand-in with base fixes for the product's earlier deviations: the whole test passes in ~22 s, and the product's real cycle answer, an extra occupied-destination finding, an unlisted code (`refused-unresolvable-reference`), an extra would-be-import range, and a normalized `path` are each caught as a `HarnessAssertionError`. Traceability stays `["14"]` (T14-7's row). Self project 357 passed / 1 skipped (19 files) under the unprivileged namespace, run alone.

Task 14 landed: T14-11 is registered in `test/suite/registry/section-14.ts` (spread through `section14ValidationTests`, so `index.ts` and the wrapper needed nothing; traceability "14", "1.7", "5.7", "11.2", "11.4"). Fixtures are assembled from parts (`assemble`/`pin`: every offset the UTF-8 byte length of the text before the pinned part, a multibyte `é` before every pinned construct), `build --json` is decoded form-exact, and `assertExactRanges` pins the exact condition multiset, `path` null, and each condition's complete location lists as a multiset of exact `{start, end}` ranges. Arms (a)–(m) are one `RangeRuleCase` each — a `d` array entry, `d={foo}`, `d={}`, `SPEC?.a;`, 14.2 (two bearers), 14.3, 14.4 (three attributes), 14.17 (four forms in one file), 14.1, 14.15 (five forms in one workspace plus 14.7 for the marker and the `text(...)` call the collision leaves unresolved), 14.16 (four forms), 14.18, 14.20 (BOM, `Café` + 0xFF, the unclosed section, `let x = ;`); (n) drives the repeated-`d` file through `build` and `occurrences` (exactly one record, the resolving entry's span); (o) is the refused read (`stageReadRefusalOfFile`), Linux-gated by `T14_11_REFUSAL_STAGED`, run last. Against the built product (the per-arm driver, AGENTS.md): (a), (b), (d), (e), (f), (g), (i), (k), (l), (o) pass; (c) fails diagnosed (`d={}` reported 14.20 at [46, 47)), as do (h) (the repeated prop located at the second `id` alone), (j) (the collision file reports nothing — T4.5-8's deviation), (m) (every 14.20 range non-zero-length: BOM [0, 3), encoding [5, 6), the unclosed section [0, 13), `let x = ;` [8, 9)), and (n) (no 14.5 for the unresolved entry, the 14.17 at the second `d` alone) — so the registered test fails diagnosed at arm (c) in ~1 s, never as a harness error. `d={}` is not well-formed MDX under the reference grammar (attribute value expressions reject the empty expression): recorded in `specs/tmp/SPEC-PROBLEMS.md` (2026-09-11); the arm is kept as TEST-SPEC pins it. Self project 357 passed / 1 skipped (19 files) under the unprivileged namespace.

Task 15 landed: T13.5-1 (`test/suite/registry/section-13.5.ts`) gained, after its non-mutating unknown-flag arms, the `build --test-hold --json` arm — `--test-hold` being value-taking by name on every command (SPEC 12.0), `--json` is consumed as the hold path (a filesystem path resolved against the working directory, so `<root>/--json`) and JSON is out of effect: exit 2, stdout byte-empty, no hold file at `./--json`, the workspace unchanged (`assertLeavesUnchanged`); the title and module header record the arm. The CONF-CORE conformer needed no change: its `parseArgs` refuses `--test-hold` on `build` before any token is consumed and its usage errors print to stderr alone, so it passes the arm, and the certification's expected outcomes are unmoved (T13.5-1 fails on exactly VIOL-CORE-EARLYWRITE and VIOL-CORE-EARLYREFRESH, passes on the conformer and the other six). Against the built product T13.5-1 now fails diagnosed at this arm — the product reads `--json` as the JSON flag and answers the 12.7 error document on stdout (151 bytes, `code` null, `message` "build: unknown flag '--test-hold'") where 12.0 makes it the hold path — every earlier arm passing; a new diagnosed product failure beside the known ones. Self project 357 passed / 1 skipped (19 files) under the unprivileged namespace.

Task 16 landed: T13.3-2 (`test/suite/registry/section-13.3.ts`) gained the absent-record clause on its deletion arm, and the arm itself was reshaped — its whole-workspace byte compare against the post-build fixed point W0 could hold only for a product whose refresh writes a fresh record (the record is part of the graph data the operational deletion removes, and a conforming refresh leaves it absent, SPEC 13.3, while every `build` writes one; the arm predated the clause, which entered SPEC.md at 0cc11e6 and TEST-SPEC.md at 3031926), so it now follows Arm B's shape: outside the graph data byte-identical to W0 (no TypeScript or Markdown generated or removed, durables untouched), graph data present after each read and byte-identical across the nine reads (12.0), and — inside one compare-around — `inventory` reporting `recorded` exactly `[]` (new local helper `assertEmptyRecord`: the value state, never unavailable or null) and `check --json` clean (`expectFindingFreeReport`) after every read, with a premise `inventory` on the deleted state before any read (`recorded` `[]`, modifying nothing). The module header records why the deletion arm admits no build reference and that `check` clean is the product's own 14.10 comparison standing in for "as `build` would write it"; the title carries the clause; traceability gained "11.6". Green through a stand-in that empties the record the product's refresh writes (AGENTS.md); against the built product T13.3-2 now fails diagnosed at the first post-read `inventory` in ~3 s (`refreshedGraphData(null, build)` writes `build`'s eight-path record where 13.3 pins the absent record) — a new diagnosed product failure beside the known ones, no harness error. Self project 357 passed / 1 skipped (19 files) under the unprivileged namespace.

Task 17 landed: T14-2 (`test/suite/registry/section-14.ts`) gained the escape-spelled arms inside its one `build --json` sweep — counts now `{14.5: 2, 14.6: 1, 14.7: 3}` — beside the node `login` the interpreted spellings would name (T2.4-5's premise: added to `specs/base.mdx` in the initial state, so the prior valid generation exports it, and to `specs/ref.mdx` in the broken one): a fourth section `r3` with the local literal `d={"lo\u0067in"}` (14.5, located within the element's window) and a second consumer file `src/escaped.ts` holding the escape-free control `BASE.login` then the marker `BASE.lo\u0067in` (14.7, located within the statement's window, sorting after `src/app.ts`'s two in the pinned findings order), which a `ConsumerProject` rooted at that file type-checks clean (`assertNoCompileErrors`: TypeScript reads the escaped identifier as `login`, which the generated module exports — 14.7's type-error clause holds only for an escape-free spelling, SPEC 14.7, 2.4). A condition's findings are selected in (file, range start) order by the new local `findingsInSourceOrder` (`findingOf`'s exactly-one rule no longer applies to 14.5 and 14.7). Traceability gained "2.4" and "4.5"; T14-2 is in no fixture's in-scope list, so certification is untouched. Green through a stand-in that inserts the two owed findings after their originals (AGENTS.md); a wrong range on either is caught at its window. Against the built product T14-2 now fails diagnosed at the count assertion in ~1 s — it reports `14.5 x1, 14.7 x2`, resolving the interpreted spellings (`lo\u0067in` as `login`) where SPEC 2.4 reads them verbatim — a new diagnosed product failure beside the known ones, no harness error. Self project 357 passed / 1 skipped (19 files) under the unprivileged namespace.

Task 18 landed: T1.4-1 and T1.4-4 (`test/suite/registry/section-1.4.ts`) stage the rewritten 1.4 alphabet — the quote, escape, and character-reference characters (`"` inside a single-quoted value, `'`, `\`, `&`) and U+FFFD, each as its raw character between two ordinary letters in a segment and in a tag — and the verbatim spellings of SPEC 2.4: the six-character escape of `.` and the reference `&#46;` in a segment, the escape of `y` in a tag, each asserted as exactly one 14.4 finding (a product interpreting them reads `a.b`, structurally invalid at the top level, or the accepted tag `xy`, and fails the arm). Every negative arm of both tests now pins its 14.4 finding exactly at the offending attribute's own characters — name through closing quote, the attribute range of SPEC 11.4 — through a parts builder `assemble` (each pinned part's offset the UTF-8 byte length of the text before it) and `assertOnly144AtAttributes` (one finding per offending attribute, one location each, ranges compared as a multiset); the nested empty-segment arm pins exactly two findings, one at `id="a."` and one at `id="a..b"` (CERTIFICATIONS.md §CONF-VALID: the descendant spelling the malformed ancestor segment as its own prefix reports in its own attribute too). The escape spellings are built from the backslash's code point (`String.fromCodePoint(0x5c)` followed by the plain text `u002E`), so no tool layer can decode them on the way into the file — the safe pattern for the escape spellings Tasks 21, 23, 27, 33, and 41 need. Certification unchanged in shape and green: CONF-VALID passes both tests, VIOL-VALID-CTRL fails exactly at their U+0000 arms, VIOL-VALID-WIDE fails T1.4-2 and T1.4-4's boundary arm with T1.4-1 passing. Against the built product both tests fail diagnosed at their first new arm (`"` in a single-quoted value builds, exit 0); a scratch probe shows the product accepting `'`, `\`, `&`, U+FFFD, and the escape-spelled `.` and `y` in segments and tags (exit 0) and interpreting `a&#46;b` as the two-segment `a.b` (`invalid-structural-id` at [46, 58)) where 2.4 reads the reference verbatim — new diagnosed product failures beside the known ones; every pre-existing arm, now with its exact attribute range, passes against the product. Self project 357 passed / 1 skipped (19 files) under the unprivileged namespace.

Task 19 landed: P-1's alphabet (`test/suite/registry/section-16-p1.ts`) now draws `\`, `&`, and U+FFFD — each an invalid boundary class at weight 3, the quote characters' weight, grouped with them after the glob metacharacters (`AMPERSAND`, `BACKSLASH`, `REPLACEMENT_CHARACTER`, built through `cp(0x…)`): `\` and `&` are staged raw inside the quoted value, which SPEC 2.4 reads verbatim, so a draw holding one is predicted rejected on the character itself (14.4) and a product interpreting an escape or reference form answers for a value it was never given; U+FFFD is staged as the literal, validly encoded code point (EF BF BD), so 14.4 — never 14.20 — is at stake. The header's class list and its "still to land" bullet are rewritten; the both-quote redraw (`spellable`) is unchanged, TEST-SPEC P-1's "not staged" governing; the oracle needed nothing (Task 7). No self-test pins P-1's draw statistics. Measured through the AGENTS.md twin procedure on the fixed seed set (25 trials × 3 seeds per property): segments 20 accepted / 55 rejected with 4 CTRL-flip and 7 WIDE-flip draws (both unchanged from before the entries), `\` in 2 draws, `&` in 5, U+FFFD in 5 (one pure `\` draw and one pure `&` draw — the only 1.4 violation — among them), 7 accepted nested chains, one single-quoted spelling, no both-quote draw; tags 35 / 40 with 14 CTRL-flip and 5 WIDE-flip (14 and 4 before), `\` 5, `&` 5, U+FFFD 3 (three pure `&`, one pure U+FFFD), one single-quoted spelling. Certification unchanged in shape and green: P-1 passes CONF-VALID and fails exactly on VIOL-VALID-CTRL and VIOL-VALID-WIDE (CONF-VALID 12/12; each violator 9 pass / 3 fail, its expected three). Against the built product P-1 fails diagnosed in ~10 s at seed 271828183, trial 11 of the segment property: the initial falsifying draw `a\Ab` (a segment containing `\`) built with exit 0 where 1.4 rejects it, shrunk to the single-quoted `"` draw, also accepted — the known P-1 product failure, now reached through the escape character too; no harness error. Self project 357 passed / 1 skipped (19 files) under the unprivileged namespace.

---

## Part D — §1–8 arms (after Part B)

## Task 20 — T1.5-2 and T11.5-3: U+FFFD-pathed sources on both legs, staging shared

- **Source:** reviewer A gap 6; reviewer B gap 17.
- **Requirement:** TEST-SPEC.md **T1.5-2** (§1.5) — a source at `specs/A�.mdx` on either leg (the path spelled with U+FFFD; the path's bytes non-UTF-8, which decode to U+FFFD — Linux only) → condition 14.19 with the concerned path a plain string; `view` by a glob serves it with identities unavailable; it is nameable by no argument. **T11.5-3** (§11.5) — `at 'specs/A�.mdx' 0` on either leg is a malformed value, exit 2, never an answer. SPEC.md 1.5, 11.5, 12.0, 14.19.
- **Files:** `test/helpers/workspace.ts` (extract the non-UTF-8 path staging that `test/suite/registry/section-11.5.ts` performs around lines 1031–1060 and 1205 (`NU3_STAGED`) into an exported helper, e.g. `stageNonUtf8Path`, so both tests share it); `test/suite/registry/section-1.5.ts` (T1.5-2 arms); `test/suite/registry/section-11.5.ts` (T11.5-3: today the U+FFFD spelling is staged only as an *unknown* file against a non-UTF-8-pathed source; add the U+FFFD-spelled-path leg on every platform and assert exit 2 on both legs).
- **Verify:** T11.5-3's existing arms unchanged; both tests pass or fail as diagnosed; `npm run test:self` green (S-2 if the builder gains the helper — add a builder self-test case for it).

## Task 21 — T2.1-2 and T4-2: lexical specifier resolution, code-group-only targets, above-root ascent, escape-spelled specifiers

- **Source:** reviewer A gaps 7, 11.
- **Requirement:** TEST-SPEC.md **T2.1-2** (§2.1) and **T4-2** (§4); SPEC.md 2.1 (import specifiers resolved lexically against the importing file — `./sub/../BASE.xspec` resolves without `sub/` existing; `.//`, `././`, `../specs/BASE.xspec` resolve; a target that is an `.mdx` matched only by a code group, an ascent above the workspace root — even to a real `outside/BASE.mdx` — and an escape-spelled specifier `"./B\u0041SE.xspec"` are condition 14.15), 4 (generated modules resolve the same way; markers record the edges).
- **Files:** `test/suite/registry/section-2.1.ts` (T2.1-2: the lexical positives with `view` reporting `specs/BASE.mdx`; the code-group-only `.mdx` arm; the above-root arm with a real file outside; the escape-spelled arm), `test/suite/registry/section-4.ts` (T4-2: the above-root arm, `"./N\u0041ME.xspec"`, and the lexical positives `./sub/../NAME.xspec`, `.//NAME.xspec` resolving with edges recorded by the markers).
- **Verify:** both tests pass or fail as diagnosed; escape bytes verified.

## Task 22 — Register T2.4-5 (verbatim literals)

- **Source:** reviewer A gap 1.
- **Requirement:** TEST-SPEC.md **T2.4-5** (line 110): 2.4 reads every static string literal and quoted attribute value exactly as spelled — read the entry whole for its arms; SPEC.md 2.4. Excluded from certification (CERTIFICATIONS.md §Exclusions, ~line 195).
- **Files:** `test/suite/registry/section-2.4.ts` (new entry after T2.4-4), `index.ts`, `traceability.ts` ("2.4", "14" as asserted).
- **Verify:** registered (S-1 green); passes or fails as diagnosed; escape bytes verified.

## Task 23 — T2.5-3: escape- and entity-spelled coverage values are invalid, located at the attribute

- **Source:** reviewer A gap 8.
- **Requirement:** TEST-SPEC.md **T2.5-3** (line 116); SPEC.md 2.5 (values read verbatim), 14.17.
- **Files:** `test/suite/registry/section-2.5-2.6.ts` (T2.5-3).
- **Do:** arms `coverage="n\u006Fne"` and `coverage="&#110;one"` → condition 14.17, the finding located at the attribute (exact range from bytes). T2.5-3 is in no certification scope (confirm) — no fixture work.
- **Verify:** passes or fails as diagnosed; escape bytes verified.

## Task 24 — T2.7-1: a section element inside an expression container is condition 16 at the container

- **Source:** reviewer A gap 9.
- **Requirement:** TEST-SPEC.md **T2.7-1** (§2.7); SPEC.md 2.7, 14.16.
- **Files:** `test/suite/registry/section-2.7.ts`.
- **Do:** arm `{<S id="x">…</S>}`: no node `x` exists (`ids`/`query` do not list it), exactly one condition-16 finding located at the container, and `view --text` preserves the container's bytes verbatim.
- **Verify:** passes or fails as diagnosed.

## Task 25 — T3-3: a multi-line opening tag merges its lines

- **Source:** reviewer A gap 10.
- **Requirement:** TEST-SPEC.md **T3-3** (§3); SPEC.md 3 (an opening tag spanning three lines — `<S`, LF, `  id="x"`, LF, `>` — is one tag: the three lines merge, dropped or kept per the residue rule, byte-asserted). In CONF-MD's scope (CERTIFICATIONS.md lines 96–100; the scope names this arm at line 98).
- **Files:** `test/suite/registry/section-3.ts`; `test/fixtures/conf-md/` only if the conformer fails the arm (VIOL-MD-CLASS / VIOL-MD-CR outcomes must stay exactly as documented).
- **Verify:** `npm run test:self` green (CONF-MD certification re-run); passes or fails as diagnosed against the product.

## Task 26 — T4.4-1: the branding-collision message names both workspace-relative source paths

- **Source:** reviewer A gap 12.
- **Requirement:** TEST-SPEC.md **T4.4-1** (§4.4); SPEC.md 4.4 (the error **message** contains both `/`-separated workspace-relative source paths, `specs/A.mdx` and `specs/B.mdx`, as substrings — not generated-file paths, native separators, or stems).
- **Files:** `test/suite/registry/section-4.3-4.4.ts` (~555–580: today any standard rendering containing the module stem passes).
- **Do:** assert the message string contains `specs/A.mdx` and `specs/B.mdx` (exact substrings) and reject a rendering that names only stems or generated files.
- **Verify:** passes or fails as diagnosed.

## Task 27 — T4.6-3: wrapper and value forms, default exports, body-less declarations, escape-spelled names

- **Source:** reviewer A gap 13.
- **Requirement:** TEST-SPEC.md **T4.6-3** (§4.6); SPEC.md 4.6 (code locations and attribution).
- **Files:** `test/suite/registry/section-4.6.ts`.
- **Do:** arms for wrapper/value forms — `(() => …)`, `as`, `satisfies`, `!` — attributing to the declared unit; default-export forms; overloads, body-less, `abstract`, and `declare` declarations are not units (`path#f` rather than `path#f@3`, `path#C.m`, `path#C.v` rather than `@2`); `function f\u006Fo()` binds no unit (the escape-spelled name is read verbatim).
- **Verify:** passes or fails as diagnosed; escape bytes verified.

## Task 28 — T5.7-4: a chain rooted at a doubly-bound identifier records no occurrence

- **Source:** reviewer A gap 14.
- **Requirement:** TEST-SPEC.md **T5.7-4** (§5.7); SPEC.md 5.7 (reference occurrences), 4.5 (same-scope collisions, T4.5-8 at line 182).
- **Files:** `test/suite/registry/section-5.7.ts` (reuse T4.5-8's staging from `test/suite/registry/section-4.5.ts`: an identifier bound by both a spec-module import and a same-scope value declaration).
- **Do:** a member chain rooted at that identifier records **no** occurrence (`occurrences` lists none for it; the graph carries no edge from it).
- **Verify:** passes or fails as diagnosed (T4.5-8 itself is a diagnosed product failure today — T5.7-4's arm may fail the same way; state the diagnosis).

## Task 29 — T6.5-1: canonical import spellings over three geometries; same-directory relocation

- **Source:** reviewer A gap 16 (remaining clauses; the mapping's root pair is Task 5).
- **Requirement:** TEST-SPEC.md **T6.5-1** (§6.5); SPEC.md 6.5 (rewritten specifiers are canonical: `./sub/A.xspec`; an importer's quote kind kept — `'../C.xspec'`; `../x/A.xspec`; a file relocated within its own directory — `A.mdx` → `A2.mdx` — leaves its own `./C.xspec` / `.//C.xspec` specifiers untouched and unreported while every importer is rewritten, the preview's `files` holding exactly two entries).
- **Files:** `test/suite/registry/section-6.5.ts` (T6.5-1; targeted edits — the file is large).
- **Do:** the three-geometry canonical-spelling contract (one arm each, byte-asserted rewrites); the same-directory relocation arm with the preview `files` cardinality asserted through the form-exact preview decoder.
- **Verify:** passes or fails as diagnosed.
- **Depends on:** Task 5.

## Task 30 — T6.5-6: no-op rewrites are not reported and moved text is byte-identical

- **Source:** reviewer A gap 19.
- **Requirement:** TEST-SPEC.md **T6.5-6** (line 276); SPEC.md 6.5 (identity terms; a descendant `x.c` referenced as `d={"x.c"}` inside the moved subtree needs no rewrite: the origin deletion carries no `id-rewrite`/`reference-rewrite` and the moved text is byte-identical).
- **Files:** `test/suite/registry/section-6.5.ts` (T6.5-6).
- **Verify:** passes or fails as diagnosed.

## Task 31 — Register T6.5-11 (TypeScript `text(...)` calls across the move)

- **Source:** reviewer A gap 2.
- **Requirement:** TEST-SPEC.md **T6.5-11** (line 283) — read whole; SPEC.md 6.5, 4.3. Excluded from certification (CERTIFICATIONS.md §Exclusions, ~line 185).
- **Files:** a new module `test/suite/registry/section-6.5-ii.ts` (precedent: `section-10.7-i.ts`/`-ii.ts`; keeps the edit bounded — `section-6.5.ts` is very large), `index.ts`, `traceability.ts` ("6.5", "4.3" as asserted), the wrapper/declaration per the preamble.
- **Verify:** registered (S-1 green); passes or fails as diagnosed.

## Task 32 — T7-1: an occupied configuration path is condition 14.14

- **Source:** reviewer A gap 20.
- **Requirement:** TEST-SPEC.md **T7-1** (line 301); SPEC.md 7 (location), 14.14.
- **Files:** `test/suite/registry/section-7-basics.ts` (T7-1).
- **Do:** a directory named `xspec.config.ts` and, separately, a symbolic link named `xspec.config.ts` in the working directory → 14.14, exit 2, for every command but `version`, the concerned path the working directory's entry; `--config` naming such an object → exit 2.
- **Verify:** passes or fails as diagnosed.

## Task 33 — T7-2 and T7-3: verbatim literals, encoding, repeated keys, empty and U+FFFD names

- **Source:** reviewer A gaps 21, 22.
- **Requirement:** TEST-SPEC.md **T7-2** and **T7-3** (§7); SPEC.md 7 (the configuration is read verbatim — a `\u002A` in a glob is not `*`, `prod\u0075ct` is not the group `product`; non-UTF-8 content and a BOM are 14.14; a repeated key, an empty name, and a U+FFFD group/profile/rule name are 14.14; comments are permitted where the entry says), 14.14.
- **Files:** `test/suite/registry/section-7-basics.ts` (T7-2, T7-3).
- **Do:** T7-2 — the verbatim-literal arms, the encoding arms (non-UTF-8 bytes; BOM), repeated-key, empty-name, and comments arms exactly as the entry lists them; T7-3 — U+FFFD group, profile, and rule names → 14.14. Escape bytes verified.
- **Verify:** passes or fails as diagnosed.

## Task 34 — T7-4: patterns outside the root by spelling; inside-but-empty spellings; platform-ordinary spellings

- **Source:** reviewer A gap 23.
- **Requirement:** TEST-SPEC.md **T7-4** (§7); SPEC.md 7 (discovery patterns: `a/../../x`, `**/../x`, `/specs/*.mdx` escape the root by spelling → 14.14; `a/../b`, `./specs`, `specs//`, `specs/*.mdx/` are inside and match nothing; `C:/…` is an ordinary relative spelling on Linux; `a**b.mdx` as the entry states). In CONF-DISC's scope (CERTIFICATIONS.md lines 118–122; the scope names this contract at line 120).
- **Files:** `test/suite/registry/section-7-discovery.ts` (T7-4); `test/fixtures/conf-disc/` only if the conformer fails an arm (VIOL-DISC-DIALECT / SYMLINK / DERIVED outcomes must stay as documented).
- **Verify:** `npm run test:self` green (CONF-DISC re-certified); passes or fails as diagnosed against the product.

## Task 35 — T7.3-1: `outDir` value validity

- **Source:** reviewer A gap 24.
- **Requirement:** TEST-SPEC.md **T7.3-1** (§7.1–7.3); SPEC.md 7.3, 14.14.
- **Files:** `test/suite/registry/section-7.1-7.3.ts` (T7.3-1).
- **Do:** `outDir` `""`, `"/out"`, `"./out"`, `"out/../x"`, `"out//x"`, `"out/"` → 14.14 (exit 2, concerned path the configuration); `"out/sub"` valid.
- **Verify:** passes or fails as diagnosed.

## Task 36 — Configured sets are read as sets: T7.4-1, T7.5-1, T11.6-2

- **Source:** reviewer A gaps 25, 26; reviewer B gap 19.
- **Requirement:** SPEC.md 7.4, 7.5 (list-valued configuration read as a set), 11.6 and 12.7 (a set datum is byte-ordered with duplicates collapsed); TEST-SPEC.md **T7.4-1**, **T7.5-1** (§7), **T11.6-2** (§11.6).
- **Files:** `test/suite/registry/section-7.4-7.5.ts` (T7.4-1, T7.5-1), `test/suite/registry/section-11.6.ts` (T11.6-2 asserts only the default `targetTags: null` / all kinds today).
- **Do:** T7.4-1 — `targetTags: ["z","a","a"]`, `edgeKinds: ["references","depends","depends"]` → `inventory` reports `["a","z"]` / `["depends","references"]` and the coverage report equals the collapsed twin's byte for byte; T7.5-1 — rule `kinds` and selector `tags` collapsed and ordered, `check` equal to the twin; T11.6-2 — `targetTags ["z","a","a"]` → `["a","z"]`, `edgeKinds ["references","depends"]` → `["depends","references"]`, rule `kinds ["embeds","depends"]` → `["depends","embeds"]`, tags selector `["b","a","b"]` → `["a","b"]`, each compared literally (`toEqual` on the decoded arrays, no sorting in the harness).
- **Verify:** all three pass or fail as diagnosed; none is in a certification scope (confirm).

## Task 37 — Tag-set datum compared literally: T2.6-1/2/3 drop `sortedTags`; T11.4-3 tag-set form arms

- **Source:** reviewer A gap 27; reviewer B gap 15.
- **Requirement:** TEST-SPEC.md §0 **H-3** (value forms asserted, never normalized away); SPEC.md 12.7 (a tag set is emitted in byte order with duplicates collapsed — the datum, not merely the set); TEST-SPEC.md **T2.6-1/2/3** (§2.6), **T11.4-3** (§11.4: `tags="b a a"` → `["a","b"]`, `tags="z A"` → `["A","z"]`, on the view node and through `query node` and `show --json`). T2.6-1 and T2.6-2 are in CONF-VALID's scope (line 78), T11.4-3 in CONF-AVAIL's (line 151).
- **Files:** `test/suite/registry/section-2.5-2.6.ts` (`sortedTags` at ~194, applied at ~844/880/955/1103 — remove; compare the decoded arrays literally), `test/suite/registry/section-11.4.ts` (T11.4-3, ~1385: only `tags="solo"` today); `test/fixtures/conf-avail/` if the conformer does not emit byte-ordered collapsed sets (CONF-VALID's emission is Task 7).
- **Verify:** `npm run test:self` green (CONF-VALID and CONF-AVAIL re-certified, violator outcomes unchanged); the tests pass or fail as diagnosed against the product.

---

## Part E — §10–12 arms (after Part B)

## Task 38 — Register T10.1-6 (session-directory and area occupancy; `create`'s ordering)

- **Source:** reviewer B gap 1.
- **Requirement:** TEST-SPEC.md **T10.1-6** (line 350) — read whole; SPEC.md 10.1, 13.4, 14 (the occupancy conditions the entry names).
- **Files:** `test/suite/registry/section-10.1.ts` (new entry), `index.ts`, `traceability.ts` ("10.1", "13.4", "14" as asserted).
- **Verify:** registered (S-1 green); passes or fails as diagnosed.

## Task 39 — T10.7-1: `review create --name` of an existing corrupt session

- **Source:** reviewer B gap 8.
- **Requirement:** TEST-SPEC.md **T10.7-1** (§10.7); SPEC.md 10.7, 14.21.
- **Files:** `test/suite/registry/section-10.7-i.ts` (T10.7-1 stages no corrupt session today; reuse `test/helpers/adapters/session-staging.ts`).
- **Do:** stage a corrupt session file named `<name>`; `review create --name <name>` → exit 1 with exactly one condition-21 `corrupt-session` finding, no code-less refusal, nothing modified.
- **Verify:** passes or fails as diagnosed.

## Task 40 — `--file` pattern spellings on `query`, `occurrences`, `view`, `ids`: T11-2, T11.3-2, T11.4-2, T12.3-1

- **Source:** reviewer B gaps 9 (`--file` clauses), 12, 14, 22.
- **Requirement:** SPEC.md 11.1, 11.3, 11.4, 12.3, 12.0 (a `--file` pattern escaping the root by spelling — `a/../../x`, `/specs/*.mdx` — is a usage error, exit 2; an inside pattern with a `.` or empty segment — `./specs/*.mdx`, `specs//*.mdx` — is admitted and matches nothing: exit 0, no rows / empty listing); TEST-SPEC.md **T11-2** (§11.1), **T11.3-2** (§11.3), **T11.4-2** (§11.4), **T12.3-1** (§12.3).
- **Files:** `test/suite/registry/section-11.ts` (T11-2 ~834: only `../*.mdx` today), `test/suite/registry/section-11.3.ts` (T11.3-2 ~1140–1160: outside arms only), `test/suite/registry/section-11.4.ts` (T11.4-2: `nosuch/**/*.mdx` only, no outside-root arm), `test/suite/registry/section-12.3-12.5.ts` (T12.3-1: `../*.mdx` and `apecs/**` only); a shared arm table in `test/suite/registry/support.ts` (spelling → expected class) is welcome.
- **Do:** per test the arms its entry lists — outside-by-spelling → exit 2 (`code` `null`), inside-matching-nothing → exit 0 with the surface's empty answer form (form-exact decoders).
- **Verify:** the four tests pass or fail as diagnosed.

## Task 41 — 1.4's alphabet in command values: T11-2 `--tag` syntactic acceptance; T11.3-3 `--to` segments

- **Source:** reviewer B gaps 9 (`--tag` clause), 13.
- **Requirement:** SPEC.md 1.4, 12.0 (a malformed tag or identity spelling is a syntax-class usage error, exit 2, judged before configuration is loaded and before any identity reading); TEST-SPEC.md **T11-2** (§11.1: a well-formed absent tag → exit 0 empty; each malformed spelling — empty, `'a b'`, `#`, `then`, a control character, `"`, `'`, `\`, `&`, U+FFFD — → exit 2 without loading configuration), **T11.3-3** (§11.3: `--to` segments containing `"`, `'`, `\`, `&` — one arm each — and U+FFFD in the path or the id part → exit 2 before identity reading).
- **Files:** `test/suite/registry/section-11.ts` (T11-2), `test/suite/registry/section-11.3.ts` (`TO_MALFORMED` lacks all five).
- **Do:** add the arms; prove "without loading configuration" as T12.0-10 does (the same exit and error document with the configuration invalid or absent).
- **Verify:** both pass or fail as diagnosed.

## Task 42 — T11-4: `--kinds` list grammar

- **Source:** reviewer B gap 10.
- **Requirement:** TEST-SPEC.md **T11-4** (line 411); SPEC.md 11.1, 12.0 (`--kinds depends,`, `,depends`, `depends,,embeds` → exit 2; `depends,depends` reads as `depends` — answers byte-identical).
- **Files:** `test/suite/registry/section-11.ts` (T11-4 ~1152: only `--kinds nonsense` today).
- **Verify:** passes or fails as diagnosed.

## Task 43 — T11.2-6: the obstructing component is itself a discovered file

- **Source:** reviewer B gap 11.
- **Requirement:** TEST-SPEC.md **T11.2-6** (§11.2); SPEC.md 11.2, 13.4, 14.22.
- **Files:** `test/suite/registry/section-11.2.ts` (T11.2-6 stages only the outDir directory replaced by a non-source plain file today).
- **Do:** `outDir: "specs/A.mdx"` (a discovered source): `build` and `check` report condition 22 concerning `specs/A.mdx`; `view specs/A.mdx` is finding-free, exit 0.
- **Verify:** passes or fails as diagnosed.

## Task 44 — T11.4-4: `.xspec` specifier naming a code-group `.mdx`; non-canonical specifier reported canonical (CONF-AVAIL extended)

- **Source:** reviewer B gap 16; reviewer C dependency note (CONF-AVAIL's code-group wrong-kind target and BOM-masked target).
- **Requirement:** TEST-SPEC.md **T11.4-4** (§11.4); SPEC.md 11.4, 2.1, 14.15. In CONF-AVAIL's scope (CERTIFICATIONS.md line 151).
- **Files:** `test/suite/registry/section-11.4.ts` (T11.4-4: the unparseable-target arm exists; add the `.xspec` specifier designating a discovered code source — an `.mdx` matched only by a code group — and the non-canonical `./sub/../BASE.xspec` reporting `specs/BASE.mdx`); `test/fixtures/conf-avail/product.mjs` (extend the conformer to the reworked scope: the code-group wrong-kind target and the BOM-masked target, per the document's CONF-AVAIL scope text, lines 147–151; VIOL-AVAIL-NULLMARKER / OMIT / NOFILE outcomes unchanged).
- **Verify:** `npm run test:self` green (CONF-AVAIL re-certified); passes or fails as diagnosed against the product.

## Task 45 — T11.6-1: physical anchoring through a symlinked working directory

- **Source:** reviewer B gap 18.
- **Requirement:** TEST-SPEC.md **T11.6-1** (§11.6); SPEC.md 11.6, 7 (paths anchored at the physical workspace root).
- **Files:** `test/suite/registry/section-11.6.ts` (T11.6-1, ~411–806: no `symlink(` today).
- **Do:** `R/L → R/a/b` (a symlink inside the workspace): from `R/L`, `inventory` reports the root as `../..` and the configuration as `../../xspec.config.ts`; with a link located above both, `..`. Symlink creation must be an ordinary `fs.symlink` on Linux and macOS; on Windows the arm follows the harness's existing symlink handling (see T13.4-6's staging) — never a skip.
- **Verify:** passes or fails as diagnosed.

## Task 46 — U+FFFD in every argument position and normalization negatives: T12.0-5; U+FFFD arms of T6.4-3 and T6.5-5

- **Source:** reviewer B gap 20; reviewer A gaps 15 (U+FFFD clause) and 18.
- **Requirement:** SPEC.md 12.0 (a U+FFFD anywhere in an argument is a malformed value — syntax class, exit 2, judged before configuration is loaded, error document `code` `null`; `./specs/A.mdx` and `specs//A.mdx` are not normalized — exit 2); TEST-SPEC.md **T12.0-5** (§12.0: the two normalization negatives on `show` and `view`; U+FFFD in each position — node, file operand, `--file`, `--tag`, `--to`, `<new-id>`, session name, `--note`, `--base`, `--config`, `--test-hold`), **T6.4-3** (line 263: a U+FFFD or non-UTF-8 `<new-id>` → exit 2, never the `refused-invalid-id` refusal), **T6.5-5** (§6.5: destinations `specs/B�.mdx` and `specs/B.mdx#x�` → exit 2, `code` `null`).
- **Files:** `test/suite/registry/section-12.0-i.ts` (T12.0-5: four `show` arms today), `test/suite/registry/section-6.4.ts` (T6.4-3 ~1340), `test/suite/registry/section-6.5.ts` (T6.5-5). If T6.4-3's non-UTF-8 leg requires raw argv bytes the subprocess driver cannot pass (Node spawns strings), extend `test/helpers/subprocess.ts` with a Linux-only raw-bytes path (e.g. through `/bin/sh -c` with `$'\xff'` quoting) rather than dropping the leg.
- **Verify:** the three tests pass or fail as diagnosed; each U+FFFD arm proven configuration-independent (invalid or absent configuration, same outcome).
- **Depends on:** Task 6 (T6.4-3's exact-identities expectation).

## Task 47 — T12.0-10: one arm per syntax-class member, configuration-independent

- **Source:** reviewer B gap 21.
- **Requirement:** TEST-SPEC.md **T12.0-10** (line 469) — read whole; SPEC.md 12.0 (the syntax class: `--name=value`, a value-taking flag last, surplus operands, `--status`/`--strategy`/`--coverage bogus`, `--kinds` empty or with a foreign element, two exactly-one-of flags together, `--test-hold` beside `--preview`, a `view` operand beside `--file`, a `.x` session name, `+7`, a malformed `--to`, `--tag a\b`, `--file ../x`, and the rest the entry lists), each identical with the configuration invalid or missing, `code` `null`; plus `query nodes --group` of the wrong kind.
- **Files:** `test/suite/registry/section-12.0-ii.ts` (T12.0-10 stages five arms today; a table of `{argv, expectation}` rows keeps the edit bounded).
- **Verify:** passes or fails as diagnosed.

## Task 48 — Register T12.0-14 (invocation grammar)

- **Source:** reviewer B gap 2.
- **Requirement:** TEST-SPEC.md **T12.0-14** (line 473) — read whole (12.0's token rules, each arm discriminating a lenient parser: `--name=value`, `ids extra`, `ids --file --json`, `--`, `-a` names, `--kinds depends,`, and the remaining arms it lists); SPEC.md 12.0.
- **Files:** `test/suite/registry/section-12.0-ii.ts` or a new `section-12.0-iii.ts` (precedent `-i`/`-ii`), `index.ts`, `traceability.ts` ("12.0", plus each surface's passage as asserted).
- **Verify:** registered (S-1 green); passes or fails as diagnosed.

## Task 49 — Register T12.2-4 (staleness and policy on a failing workspace)

- **Source:** reviewer B gap 3.
- **Requirement:** TEST-SPEC.md **T12.2-4** (line 487) — read whole (14.10 and 14.12 confine themselves on a workspace failing validation as the entry states); SPEC.md 12.2, 13.3, 14.10, 14.12.
- **Files:** `test/suite/registry/section-12.1-12.2.ts` (new entry), `index.ts`, `traceability.ts` ("12.2", "13.3", "14" as asserted).
- **Verify:** registered (S-1 green); passes or fails as diagnosed.

---

End of plan: 49 tasks. When the last task is done, delete this file.
