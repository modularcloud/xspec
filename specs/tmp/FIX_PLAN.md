# FIX_PLAN — Phase 9 (test harness), re-descent iteration 1

Written 2026-10-02 at eb8ed4f (branch `claude/xspec-ui-apis-4df8fa`, standing in for `patch/external-ui-apis`) from the re-descent's first compliance determination, which was not clean. Its findings: compliance review A (TEST-SPEC's T1–T6 tests: 30 gaps), B (T7 and later: 17 gaps), C (everything outside the T-numbered tests: 9 gaps), D (CERTIFICATIONS.md: 4 gaps), and VERIFY V (red: 3 harness self-tests). Task headings cite them as A1…A30, B1…B17, C1…C9, D1…D4, and V. Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tests Specified); no task changes its stage. No Bug Report applies.

Why the harness must change: the documents moved after the harness was last green (Phase 9 ended at 3bfedb5). The deltas: `git diff 3311ccd..6780f53 -- specs/TEST-SPEC.md`, `git diff 3311ccd..301f2f9 -- specs/CERTIFICATIONS.md`, `git diff 9d095d9..f31e100 -- specs/SPEC.md`. Phase 8's scaffolding commit eb8ed4f pinned the product's TypeScript at exactly 5.9.3 and gave the harness its own copy, imported as `typescript-5.9.3`, never `typescript` (AGENTS.md).

## Preamble — read before any task

**Phase goal and scope guards (Phase 9).** The harness must adhere to `specs/TEST-SPEC.md` and `specs/CERTIFICATIONS.md`: every harness self-test and every certification passes, each certified test passing against its conformer and failing against each of its violators exactly as the violator's entry states. Product tests may fail, but only as diagnosed assertion failures (H-8): never a harness error, crash, hang, or false pass. Never modify product code (`src/`; `dist/` is built from it). Every task is harness work under `test/` (fixtures under `test/fixtures/` are harness code), plus `AGENTS.md`'s build/run facts and this plan. A spec defect that blocks a task goes to the matching problems file under `specs/tmp/`, never into a silent workaround.

**Known state at eb8ed4f.** Self project (`unshare --map-user=1000 --map-group=1000 -- npm run test:self` in this root sandbox): 22 files, 2950 tests, 2947 passing and 3 failing. All three failures are the C-1 whole-document gate in `test/self/certification-document.test.ts`: the document defines 6 conformers and 21 violators; the manifest `test/self/certification-fixtures.ts` lacks VIOL-VALID-SEP, CONF-ORPHAN, VIOL-ORPHAN-THROUGHLINK, and VIOL-ORPHAN-LINKTARGET; and T13.4-11 is unregistered. The 23 fixtures the manifest lists all certify. Suite: 337 tests (336 registered plus the E-6 writer), all passing against the built product. CI run 36962009339 fails its two Linux jobs on the 3 gate tests alone; the Windows leg is green. `npm run typecheck` and `npm run format:check` pass. No self-test reads TEST-SPEC.md, so a green self project does not by itself show compliance: each task carries its own checks.

**Run mechanics (AGENTS.md holds the recipes; read it before running anything).** Run the self project under the unprivileged namespace above (a plain non-root user needs no wrapper). Never run the self project and a suite run at the same time: VERIFY saw S-2's 2048-deep tower vector time out at 5000 ms only under concurrent load. One registered test: `-t '<ID> '`, with the trailing space and the dots escaped. One certification family: `npx vitest run --config test/vitest.config.ts --project self test/self/certification.test.ts -t <FAMILY>` (CORE, VALID, MD, DISC, AVAIL, and ORPHAN once it exists). A fixture the manifest does not list yet: a temporary `test/self/*.test.ts` calling `runProductTests` (AGENTS.md), deleted before committing. Red/green checks of a product test: AGENTS.md's stand-in wrapper and mutation recipes. Rebuild the product (`npm run build`) only if `dist/` is stale; `src/` does not change in this phase.

**Spellings.** Take every exact spelling — code points, escape-spelled literals, byte offsets, file contents — from the TEST-SPEC.md or CERTIFICATIONS.md line the task cites, never from this plan or the review reports. The reports' channel decoded escape spellings, and the tool-parameter layer decodes backslash-u spellings inconsistently in edit and Bash payloads, comments included. So this plan names code points as `U+XXXX`, writes the backslash character in words, and spells no escapes. Build such spellings in code from code points and verify the staged bytes byte-wise (`od -c`, a sha256 compare).

**Conventions for new and changed tests.**
- *Registration.* A new registered test goes into its registry module's exported list. A new module also needs an import in `test/suite/registry/index.ts` and a thin wrapper `test/suite/<module>.test.ts` calling `declareProductTests`. Every new test needs its H-7 entry in `test/suite/registry/traceability.ts`, carrying `"14"` whenever it asserts a numbered condition or a stable refusal code (TEST-SPEC §14's per-condition index: "the H-7 map is the complete record"). S-1 checks the map, and S-7's sweep runs every registered body against the empty stub; both run in the self project.
- *S-9 timing.* A `.mdx` source that a body stages after its first product invocation, or in a workspace it creates after it, is a staged-source record (`test/helpers/staged-mdx.ts`, judged by `test/self/s9-staged-sources.test.ts`); the undeclared-staging guard refuses plain contents there. Since Task 16 (dc97774) a TypeScript code source or configuration file staged there is a `StagedTs` record too (AGENTS.md's TypeScript-records bullet), and once Task 16o lands the guard refuses plain contents there as well. Since Task 15 the builder judges every staged code source and configuration file at staging time (AGENTS.md's S-9 TypeScript bullet): a new staging of one TEST-SPEC declares unparseable lists it under `ts.unparseable`, a code source whose name `TS_DEFAULT_SUFFIXES` does not reach lists it under `ts.wellFormed` (or `ts.unparseable`), and a file whose well-formedness the document does not declare under `ts.unchecked`.
- *Never-modifies compares* use the compare-around machinery (`assertLeavesUnchanged` and `snapshotDirectory` in `test/helpers/snapshot.ts`, as T13.4-5 uses them). CERTIFICATIONS.md's VIOL-CORE-CHATTYREADS note makes the certification of T6.4-3, T6.5-4, T6.5-20, T6.5-21, T13.4-9, and T13.4-10 representative only insofar as they share it.
- *Free text.* Corrections and other free-text checks use H-3's robust matching.
- *Linux-leg arms* (staged file names holding a backslash, U+000A, U+000D, or non-UTF-8 bytes) gate themselves inside the shared body, as T12.0-5's non-UTF-8 arm does, so the Windows subset (`test/windows/e6-subset.test.ts`) skips no arm.
- *Product verdicts.* The built product (Phase 10's, at c62f451) predates these SPEC changes. A new or strengthened arm that fails against it is recorded as a diagnosed product failure only once a hand-staged probe shows the product's answer contradicts the asserted SPEC behavior. A harness error, crash, or hang is a harness defect to fix in the task. An arm that passes against the product proves nothing about its liveness: red-check it (through a violator, a stand-in wrapper, or a mutation) where the task says so.
- *Every task ends with:* `npm run typecheck`; `npm run format:check`; the touched suite files against the built product; the full self project under the namespace, with no failure from the task's own changes (since Task 9 the C-1 gate tests pass, every CERTIFICATIONS.md fixture wired; AGENTS.md records the self project's current test count and certification totals); and a commit message stating the honest results. `AGENTS.md` gets only build/run knowledge a later spawn needs (a recipe, a count or timing a later check relies on), never a task narrative.

**Standing rulings.** Two rulings stand for this run: AGENTS.md's "Known residual 14.20 location gaps" and "Known SPEC 6.5 gap, deferred to a future SPEC revision" bullets. No task here addresses them, and none may be added for them.

**Order.** Tasks are in dependency order, and each names what it depends on:
- Part A (Tasks 7–12) clears the red certification gate and brings the certification families to the current CERTIFICATIONS.md.
- Part B (Tasks 13–20) builds the machinery later tasks rely on.
- Part C (Tasks 21–61) brings the T-numbered tests to the current text, in TEST-SPEC order.
- Part D (Tasks 62–65) covers the properties, the Windows leg, and S-9's generated TypeScript forms.
- Task 66 confirms the result and deletes the plan.

Take the topmost task unless told otherwise. A task too large for one spawn may be split by inserting follow-up tasks directly after it; never drop a requirement.

## Tasks

### Part B — Shared machinery

### Notes for Tasks 16b–16o, Task 16's split (not a task; Task 16o deletes them) — S-9's TypeScript check for post-invocation stagings (TEST-SPEC S-9's timing clause, L632; H-8; S-7; C1, part 3)

Task 16 was split as its text allowed. Done at dc97774: the mechanism — `StagedTs` records (`test/helpers/staged-ts.ts`), sealed beside the MDX ledger and judged by `test/self/s9-staged-sources.test.ts`; the builder's record overloads; MDX records carrying `ts` for a code-group `.mdx` path — and the first module group (§1's five modules) plus the E-6 fixture's configuration and code source. AGENTS.md's "staged-source ledger's TypeScript records" bullet holds the conversion rule, the detector recipe that finds a module's remaining plain post-invocation TypeScript stagings, and the survey's totals.

Done since: Task 16b (§2 and §3), Task 16c (`section-4.ts`; `section-4.1-4.2.ts` has no runtime site), Task 16d (`section-4.3-4.4.ts`, `section-4.5.ts`, `section-4.6.ts`), Task 16e (§5 and §6.1–§6.4; `section-5.6.ts` has no runtime site), Task 16f (§6.5–§6.7), Task 16g (`section-7-basics.ts`), and Task 16h (`section-7-discovery.ts` and `section-7.1-7.3.ts`); `git log --grep 'Task 16[b-h]'`. Their counts are in that AGENTS.md bullet.

Task 16e also made records of shared constants that later tasks' bodies stage after an invocation, so the detector no longer logs those sites: `support.ts`'s `UNKNOWN_KEY_CONFIG` (the configuration-state twins' invalid configuration, which T6.5-5, T11-2, T11-4, and T12.0-5 stage after an invocation, as T6.4-3 does), `section-5.7.ts`'s exported `SPEC_AND_CODE_CONFIG` (T11.3-1's later workspaces), and `section-6.4.ts`'s exported `RENAME_REFUSAL_CONFIG`, `RENAME_USAGE_CONFIG`, and the `src/app.ts` of `RENAME_USAGE_ORDERING_FILES` (T6.6-3). Task 16f did likewise: `section-6.5.ts`'s exported `MOVE_REFUSAL_CONFIG` and `MOVE_DERIVED_PATH_CONFIG` and `section-6.5-iii.ts`'s exported `R16_CONFIG` (T14-7's later workspaces stage them), and `section-13.5.ts`'s one configuration, `SPECS_ONLY_CONFIG` (`CORE_DECL`'s and `ISO_TWO_DECL`'s), which T6.6-3's runs-while-held arm stages after an invocation, named for T6.6-3 and the 13.5 bodies the detector saw staging it after one. A task that finds a further body staging one of them after an invocation adds that test's ID to the record's name.

Every split task below converts its modules by that rule, then checks:
- `test/self/s9-staged-sources.test.ts` passes; AGENTS.md records its TypeScript-judgement count and the self project's test count.
- Each converted module's suite files under the namespace against the built product keep their verdicts (diagnosed failures at the same arms), with no harness error.
- The detector, run over those suite files and `test/self/certification.test.ts`, logs no plain post-invocation staging from the task's modules. A site behind a diagnosed product failure that no conformer reaches is found by reading the module, and converted all the same.
- `npm run typecheck`, `npm run format:check`, and the full self project under the namespace pass.

The survey at 3f43daa (suite plus certification) names each module's runtime sites below: tests, staged paths, and distinct byte-strings. It is a floor, not the list.

### Task 16i — TypeScript records: `section-7.4-7.5.ts`

- T7.4-1, T7.5-1, T7.5-2, and T7.5-4 through T7.5-6: 67 byte-strings.
- Paths: configurations, `src/impl.ts`, `dualcode/d.ts`, `src/good.ts`, `src/evil.ts`, `src/a$0.ts`, `src/ab.ts`, `src/a0.ts`, `hi/H.xspec.ts`, and T7.5-5's `src/end$` and `src/end` (code sources the default does not reach, `wellFormed` today).

### Task 16j — TypeScript records: §8–§10

- `section-8.ts`: T8-5 and T8.2-1. `section-9.3.ts`: T9.3-3. `section-9.ts`: no runtime site; confirm by reading.
- `section-10.1.ts`: T10.1-1, T10.1-4, and T10.1-6. `section-10.2-10.3.ts`: T10.2-2.
- `section-10.4.ts`: T10.4-1, T10.4-2, and T10.4-4, with `src/ref.ts`. `section-10.5.ts`: T10.5-1 and T10.5-5. `section-10.6.ts`: T10.6-2.
- `section-10.7-i.ts`: T10.7-1 and T10.7-2. `section-10.7-ii.ts`: T10.7-7, T10.7-9, and T10.7-12, with `src/next.ts`, `src/ref.ts`, and `src/del.ts`.
- About 23 byte-strings in all.

### Task 16k — TypeScript records: §11 and §12.0

- `section-11.ts`: T11-2 and T11-4, with `src/app.ts`. Its `stageConfigurationStateTwins` calls pass records.
- `section-11.2.ts`: T11.2-4 through T11.2-6. `section-11.3.ts`: T11.3-1 through T11.3-3, with `src/app.ts` and `src/co#de.ts`. `section-11.4.ts`: T11.4-3, T11.4-5, and T11.4-6. `section-11.5.ts`: no runtime site; confirm by reading.
- `section-11.6.ts`: T11.6-2 through T11.6-4, 8 configurations. T11.6-4's malformed configurations are `unparseable` records.
- `section-12.0-i.ts`: T12.0-2, T12.0-3, T12.0-5, and T12.0-6, with `alt/xspec.config.ts`. Its `stageConfigurationStateTwins` call passes records.
- `section-12.0-ii.ts`: T12.0-8 through T12.0-10, with `src/app.ts`. `section-12.0-iii.ts`: T12.0-14's `cfg/xspec.config.ts`.
- About 31 byte-strings in all.

### Task 16l — TypeScript records: §12.1–§13

- `section-12.1-12.2.ts`: T12.1-3, T12.1-4, T12.2-2, and T12.2-4, with `specs/A.xspec.ts`, `src/app.ts`, and `hi/H.xspec.ts`. `section-12.3-12.5.ts`: T12.3-1.
- `section-12.6.ts`: T12.6-2. Its `malformed-config.ts` is an `unparseable` record.
- `section-12.7.ts`: T12.7-1 through T12.7-3, with `src/app.ts`, `src/ref.ts`, `cfg/xspec.config.ts`, and `a/xspec.config.ts`. T12.7-3's malformed configuration and its sibling `file()` are `unparseable` records.
- `section-13.1-13.2.ts`: T13.2-1. `section-13.3.ts`: T13.3-2 through T13.3-4.
- `section-13.4.ts`: T13.4-3, T13.4-6, T13.4-8, and T13.4-11.
  - T13.4-11 fails diagnosed against the built product, so certification reached six of its stagings the suite did not.
  - T13.4-11(b)'s `specs/A.md` code source is `wellFormed` today.
  - T13.4-2's damaged derived files and T13.4-4's noise stay `unchecked` and plain.
- `section-13.5.ts`: done in Task 16f — its one configuration (`CORE_DECL`'s and `ISO_TWO_DECL`'s) is a record named for T6.6-3, T13.5-1, T13.5-4, T13.5-6, and T13.5-8, and the detector finds no plain post-invocation staging of the module's own (T13.5-7's sites are `write-refusal-staging.ts`'s, below).
- `write-refusal-staging.ts`: T13.5-7, T14-9, and T14-10, configurations and `src/app.ts`, 5 byte-strings.
- About 44 byte-strings in all.

### Task 16m — TypeScript records: §14

- `section-14.ts`: T14-2 through T14-8 and T14-11. Configurations; T14-2's `src/app.ts` and `src/escaped.ts` `file()` stagings; and T14-11's arm code sources (`src/app.ts`, `src/view.mts`, `src/exp.ts`, `src/req.ts`, `src/dyn.ts`, `src/collide*.ts`, `src/bad.ts`, …): 35 byte-strings.
  - Keep the declared-unparseable kinds as `unparseable` records. These are T14-5's TSX-only `src/view.mts`; T14-11's (m) and (v) code sources (the survey saw `src/app.ts`, `src/bad.ts`, `src/cut.ts`, `src/eof.ts`, `src/overlong.ts`, `src/prefix.ts`, and `src/surrogate.ts` declared unparseable); and T14-12's code-source arms wherever T14-4, T14-6, and T14-11's (w) restage them. `unparseableDecl` and `reassertedCase` derive the declaration from the arm's `kind`, so the records must too. T14-3's `src/brokents.ts` is staged before any invocation and stays plain.
  - A `.tsx` path's record names grammar `"tsx"`.
- `section-14-ii.ts`: T14-10, one configuration.
- `section-14-iii.ts`: T14-12, configurations and `src/app.ts`, 8 byte-strings.

### Task 16n — TypeScript records: the §16 properties' fixed files

- A property's fixed configuration or base code source, staged in every trial's workspace, is a deterministic fixture. Each later trial stages it after the body's first invocation, so it becomes a record.
- One configuration each: P-1, P-2/P-3, P-4, P-5/P-6, P-9, P-10, and P-12.
- P-8 and P-11 each have a configuration and a base `src/app.ts` as records. Their mutated files stay `unchecked` and plain.
- Not records: P-7's configurations (38 byte-strings over the fixed seeds) and P-13's configuration, `c0/U.ts`, and `c1/V.ts` (49) are composed per draw. Task 16o declares them per draw, and Task 64 judges them.
- Checks: each property against the built product at the fixed seeds keeps its verdict, P-1 failing diagnosed as now. Record a timing in AGENTS.md if one moved.

### Task 16o — The undeclared-staging guard covers code sources and configurations (Task 16's last)

**Depends on.** Tasks 16b–16n: the guard enables only once no suite staging would trip it.

**Change.**
- *The TypeScript arm.* The guard (`test/helpers/workspace.ts`, `test/helpers/product-invocations.ts`) covers the TypeScript check as it covers `.mdx`. After either mark — the workspace's or the running body's — it refuses with `HarnessStagingError` mode `undeclared-staging`:
  - plain contents at a path the TypeScript check judges, whose effective declaration is neither `unchecked` nor per-draw, staged by `file()`, as an initial `files` entry at creation (per-body mark only, as for `.mdx`), or by `copyFrom()` out of a workspace with no invocation;
  - an MDX record with no `ts` at such a path.
  
  The diagnosis names the TypeScript remedies: a `StagedTs` record, an MDX record's `ts`, `ts.unchecked`, or the per-draw declaration.
- *Draws.* Add a TypeScript per-draw declaration (`{ ts: "per-draw" }` per `file()` call, `ts.perDraw` on `create`): judged well-formed at staging, exempt from the guard, section-16 modules only. Declare P-7's and P-13's draw-composed files with it. Task 64 adds the runner's per-draw check before the product is driven.
- *Headers.* Update the module headers (`workspace.ts`, `product-invocations.ts`, `staged-ts.ts`) and AGENTS.md's guard and TypeScript-records bullets. Delete the notes block above Task 16b with this task.
- *The Windows leg.* `test/windows/e6-drive-mismatch.test.ts` stages `xspec.config.ts` and `specs/a.mdx` at creation, outside every registered body and S-7's sweep, as E-6's fixture does. The guard cannot refuse that staging, yet S-9 wants both files judged before any product exists. Make them records the S-9 self-test judges, as it judges E-6's: for example, move the two constants into a helper module that the Windows test imports and that the self-test imports before the manifest seals the ledger.

**Checks.**
- `test/self/s9-undeclared-staging.test.ts` covers a `.ts` code-source staging and an `xspec.config.ts` configuration staging. For each:
  - refused after a workspace invocation and after a body invocation, as `file()` and as an initial entry;
  - exempt as a record, `unchecked`, per-draw, `edit()`, and `copyFrom()` out of an invoked workspace;
  - the MDX record without `ts` at a code-group `.mdx` path refused.
  
  Its existing exemption line staging `src/app.ts` after an invocation must change: that path is judged now.
- Red check: on a scratch-backed copy of a converted module, make one record's staging plain (`.source`). The run reports `undeclared-staging`. Restore with `cp` and verify with `cmp`.
- The decisive check, never beside the self project: the full suite under the namespace, `--reporter=verbose` to a log.
  - `grep -c 'undeclared-staging'` gives 0;
  - the failed-ID set equals the known one (P-1, T1.4-1, T1.4-4, T7-6, T13.4-11 at dc97774, unless a task since changed it);
  - every error is a `HarnessAssertionError`.
- The full self project under the namespace passes, with certification totals unchanged.

### Task 17 — S-9's MDX check judges identifier characters and space separators by Unicode 15.1, code point by code point (TEST-SPEC S-9, L632; SPEC 14.20; C2)

**Where.** `test/helpers/mdx-derivability.ts` and `test/self/s9-fixture-well-formedness.test.ts`.

**Change.** Today the stock tables decide:
- acorn 8.17's tables, newer than 15.1, judge expressions and ESM blocks;
- micromark-extension-mdx-jsx judges JSX names one UTF-16 code unit at a time.

Judge identifier characters in expressions, ESM blocks, and JSX element and attribute names by Unicode 15.1, one code point at a time, and space separators by 15.1 too. Reviewer C's hint: TypeScript 5.9.3's `isIdentifierStart` and `isIdentifierPart` at ESNext give 15.1's verdicts (U+1C89 false, U+2EBF0 true); Node 22's own regex tables are Unicode 17. Keep S-9's named allowances and the rest of the judge unchanged.

**Checks.**
- New self-test vectors:
  - must not derive: `{` U+1C89 `}`; `<a` U+1C89 ` />`; `{` U+180E `}` (already the case today; keep it as a vector);
  - must derive: `<a` U+2EBF0 `>x</a` U+2EBF0 `>`; `<a b` U+2EBF0 `="1" />`; T14-12's MDX element and attribute names holding U+2EBF0 (L594).
- Red-check by reverting the helper.
- The self project is green: every existing vector and staged record is judged as before.
- The suite against the built product shows no new `mdx-derivability` harness error.

### Task 18 — S-6: the name analysis behind T6.5-22(a), and its fixed vector suite (TEST-SPEC §17 S-6, L629; T6.5-22, L301; C3)

**Where.** A new harness helper (for example `test/helpers/name-analysis.ts`), and a new self-test (for example `test/self/s6-name-analysis.test.ts`). The self-test must run in the self project, before any import-adding test or P-5 relies on the analysis.

**Change.** The analysis takes a receiving file: a spec source (its ESM blocks and expressions, read under ECMAScript 2024 as 14.20 fixes them), a `.ts` file, or a `.tsx` file (TypeScript 5.9.3). It returns:
- *(a) Declared names:* every name the file declares, in any scope, at value or type level.
- *(b) Referenced names,* by T6.5-22(a)'s definition: every identifier the file spells where name resolution looks it up through scope, at value or type level, whatever it resolves to. A type reference such as `Record` in an annotation counts, and so does a JSX tag name that is a value reference (`<Foo />`, never an intrinsic `<div />`). Never counted:
  - a property or member name: after `.`, a class, interface, or enum member's, a JSX attribute's;
  - an object literal's non-shorthand key;
  - a label;
  - the name an import or export specifier spells for the other module (the `text` of `{ text as t }`).
- *(c) Barred names,* by file kind:
  - in every kind of file, T6.5-22's constraint list (L301): its reserved and strict-mode-barred words, `require`, `exports`, every `__`-prefixed name, the global-object properties (clause 19's, and Annex B's `escape` and `unescape`), `Iterator`, `AsyncIterator`, and `SuppressedError`;
  - in a TSX source, `React`, and the leading identifier of the factory that any `@jsx` or `@jsxFrag` pragma in any of its comments names (the pragma's name matched regardless of ASCII case);
  - in a spec source, `S`, `Spec`, and `text`.

Expose T6.5-22(a)'s verdict for a set of added identifiers against the pre-operation file; its shape is the engineer's.

**Vectors.** Exactly the ones S-6 lists, in both directions:
- counted;
- not counted;
- barred, for each pragma form S-6 names;
- the constraint-list names in every kind of file;
- `React` in the two `.tsx` receivers (the one spelling JSX and the one spelling none), and in neither a spec source nor a `.ts` file;
- `S`, `Spec`, and `text` in a spec source, and not in a `.ts` file.

**Checks.**
- The self-test passes.
- Red-checks: dropping type-level declarations must fail the type-only `helper` vector, and collecting value references alone must fail `Record`.
- Typecheck passes.

### Task 19 — T6.5-22(a): every operation the suite performs that adds an import is held to the added-identifier assertion (TEST-SPEC T6.5-22(a), L301; A28; C4(a) rides on it)

**Depends on.** Task 18.

**Where.** Wherever the suite performs import-adding operations. Prefer one central hook that every section-form `move` exiting 0 passes through — the subprocess driver path that the registered bodies and the property runner share (`test/helpers/subprocess.ts`), or a wrapper every such move uses. The assertion then holds "whichever test performs it".

**Change.** For each file the operation changed, read every added import declaration from the post-operation bytes; the identifiers' values are otherwise unpinned. Assert, with Task 18's analysis over the pre-operation file:
- no added identifier is barred there;
- none is bound by a declaration of the pre-operation file, or referenced in it;
- the added identifiers are distinct;
- in a spec source, none is `S`, `Spec`, or `text`.

A breach is a diagnosed product failure naming the file, the identifier, and the clause.
- *Coverage today:* T6.5-3's third-file arm, T6.5-8 through T6.5-15, T6.5-16's performed controls, T6.5-17 through T6.5-19, the real runs T6.6-4(b) makes on a copy, and P-5's drawn moves.
- *Later tests* that add imports (T1.4-5(b) and (c), T6.5-22(b), T6.5-23) must get it without further wiring.

**Checks.**
- A self-test vector or a temporary stand-in shows the hook fires: a stand-in product adding `import let from …` is failed.
- The T6.5, T6.6, and P-5 suite files against the built product: verdicts unchanged, unless the product breaches a clause. Diagnose every new failure by hand.

### Task 20 — H-7: T11.2-4 maps to `"14"` (TEST-SPEC §14's per-condition index lists T11.2-4 under 14.16; H-7; C9)

**Where.** `test/suite/registry/traceability.ts`, which today reads `"T11.2-4": ["11.2"]`.

**Change.** Add `"14"`. T6.5-20, T6.5-21, T13.4-9, T13.4-10, and T13.4-11 carry `"14"` from their own tasks.

**Checks.** S-1 passes.

### Part C — The T-numbered tests, in TEST-SPEC order

### Task 21 — Register T1.4-5: identifier by characters (TEST-SPEC L61; SPEC 1.4, 2.4, 4.1, 6.4, 6.5, 14.20; A4)

**Depends on.** Task 19, since arms (b) and (c) add imports.

**Where.** `test/suite/registry/section-1.4.ts` (or a new module), and `test/suite/registry/traceability.ts`.

**Change.** Take every spelling from L61.
- *(a) Access.*
  - *Staging.* `specs/B.mdx` holds top-level sections `delete`, `default`, U+00E9, and U+1C89 followed by `x`. A spec source imports it as `B` and spells `d={B.delete}`, `{text(B.default)}`, and `d={B.`U+00E9`}`. A code source imports it as `SPEC, { text }` and spells the markers `SPEC.delete` and `SPEC.`U+00E9, plus the call `text(SPEC.default)`.
  - *Expected.* `build` and `check` exit 0 with no finding. `query edges` reports each `depends`, `embeds`, and `references` edge to its node.
  - *Consumer compile.* A consumer compiling `SPEC.delete`, `SPEC.default`, `SPEC.`U+00E9, and `SPEC["`U+1C89`x"]` type-checks through the tooling driver at 5.9.3 (`test/helpers/tooling.ts`).
- *(b) Conversion,* under T6.5-8's discipline.
  - *Staging.* Section `m` moves from `specs/a.mdx` into `specs/t.mdx`, which lacks `a.mdx`'s module. Its `d` array holds the local references `"delete"`, `"`U+00E9`"`, and `"n.2fa"`.
  - *Expected.* The array reads exactly `d={[<O>.delete, <O>.`U+00E9`, <O>.n["2fa"]]}`, its brackets, commas, and spaces unchanged. The rewritten target derives (S-9), and `build` and `check` are clean.
- *(c) Release and language level.* The same move, with the array holding `"`U+1C89`x"` and `"`U+2EBF0`"`, reads exactly `d={[<O>["`U+1C89`x"], <O>.`U+2EBF0`]}`. It derives, and `build` and `check` are clean.
- *H-7.* The passages asserted, as neighbouring entries do.

**Checks.**
- S-9 judges every staged file. S-7 passes.
- T1.4-5 against the built product (diagnose).
- Red-check (c) through a stand-in that writes `<O>.`U+1C89`x`.

### Task 22 — T1.7-2 and T4.6-1: the `using` and `await using` unit arms (TEST-SPEC L80, L193; SPEC 1.7, 4.6; A5, A14)

**Where.** `test/suite/registry/section-1.6-1.7.ts` (T1.7-2; no `using` appears anywhere in the harness today) and `section-4.6.ts` (T4.6-1).

**Change.** Exact shapes are at L80 and L193.
- *T1.7-2.* `using f = () => { SPEC.a }` spans `f = () => { SPEC.a }`, and `await using h = () => { SPEC.b }` spans `h = () => { SPEC.b }`. Neither span starts at `using` or `await`.
- *T4.6-1.* `using f = () => { SPEC.a }` at top level gives the unit `path#f`; `await using h = () => { SPEC.b }` inside an async `g` gives `path#g.h`.

Every code file must be accepted by 5.9.3 both ways.

**Checks.** S-9 and S-7 pass. Both tests against the built product (diagnose).

### Task 23 — T2.4-1 and T2.4-5: reserved-word dot access; escaped-segment and escaped-root arms (TEST-SPEC L109, L113; SPEC 2.4; A6, A7)

**Where.** `test/suite/registry/section-2.4.ts`.

**Change.** Take every spelling from L113, building the escapes from code points.
- *T2.4-1.* The reserved-word arm `BASE.delete` builds and records its edge.
- *T2.4-5(i), the MDX segment escape.* `BASE`'s module holds `login`. The `login` segment, spelled in dot access with its `g` as a backslash-u escape of U+0067, gives 14.5 in `d={…}` and 14.6 in `{text(…)}`; each records no edge and no occurrence. Beside them, the escape-free control `d={BASE.login}` records its edge.
- *T2.4-5(ii), the escaped root.* `BASE` is spelled with its `A` as a backslash-u escape of U+0041, its segments escape-free: in MDX in `d={…login}` and `{text(…login)}`, and as a marker in a code source. Each records its edge and occurrence with no finding.

**Checks.**
- S-9: the MDX derives, and the code files are accepted both ways. S-7 passes.
- T2.4-1 and T2.4-5 against the built product.

### Task 24 — T2.7-4: the Unicode 15.1 space-separator comment arms and the U+180E parse failure (TEST-SPEC L132; SPEC 2.7, 14.20; A8)

**Depends on.** Task 17 is natural to land first. It keeps `{` U+180E `}` unparseable, as the check already judges it.

**Where.** `test/suite/registry/section-2.7.ts`.

**Change.**
- *15 comment arms.* One arm per Zs space separator outside Latin-1 under Unicode 15.1: U+1680, U+2000 through U+200A, U+202F, U+205F, and U+3000. Each is `{` plus the code point plus `}`, and must behave as T2.7-2's comment does (exact expectation at L132).
- *Parse-failure arm.* `{` U+180E `}` reports 14.20 at the zero-length range at the code point's offset, declared unparseable for S-9.

**Checks.**
- S-9 judges the 15 arms derivable and the U+180E staging unparseable. S-7 passes.
- T2.7-4 against the built product.

### Task 25 — T4-2: import types, string-named module declarations, their derived-path designations, and "no other construct names a module" (TEST-SPEC L151, and T4.5-7 at L187, which defers to T4-2; SPEC 4, 4.5, 14.15; A9)

**Where.** `test/suite/registry/section-4.ts`, where `MODULE_LINKING_FORMS` lists four forms today.

**Change.** Spellings from L151; every file must be accepted by 5.9.3 both ways.
- *(i) Import types.* `type T = import("./NAME.xspec").default` and `let v: typeof import("./NAME.xspec")` each give 14.15.
- *(ii) String-named module declarations.* Each gives 14.15:
  - `declare module "./NAME.xspec" { }`, in a file holding `export {}`;
  - `module "./NAME.xspec" { }`;
  - `declare module "*.xspec" { }`.
- *(iii) Derived-path designation.* Cover every module-linking form 4 names (six) by adding the import type and the string-named module declaration to `MODULE_LINKING_FORMS`. Each form designates `./NAME.xspec.ts`, a path under `.xspec/`, and a configured Markdown emit destination while emission is enabled.
- *(iv) "No other construct names a module."*
  - *Staging.* `src/c.ts` imports `NAME.mdx`'s module and marks a node. It also holds `require("../specs/NAME.xspec")`, `require("./missing.xspec")`, the triple-slash reference, the `const p` string, and the three template-literal `import()` calls (exact list at L151).
  - *Expected.* `build` and `check` exit 0, and `query edges` lists only the marker's edge. Under a file move of `NAME.mdx`, only the import declaration's specifier is rewritten; the other seven spellings stay byte-unchanged. The preview reports exactly one `import-specifier-rewrite` for the file.

**Checks.** S-9 and S-7 pass. T4-2 and T4.5-7 against the built product.

### Task 26 — T4.3-2 and T4.5-3: the template-literal arms (TEST-SPEC L172, L183; A10, A11)

**Where.** `test/suite/registry/section-4.3-4.4.ts` (T4.3-2) and `section-4.5.ts` (T4.5-3).

**Change.**
- *T4.3-2.* Add the arm `` text(SPEC[`a`]) ``, the module holding `a`: 14.8.
- *T4.5-3.* Restage its template-literal arm as L183 pins it, `` SPEC[`login-v2`]; `` with the module holding `login-v2`; today it stages `` SPEC[`a`]; ``.

**Checks.** S-9 and S-7 pass. Both tests against the built product.

### Task 27 — T4.5-4 and T4.5-8: `using` and `await using` shadowing and module-scope collision arms (TEST-SPEC L184, L188; SPEC 4.5, 2.4, 14.15, 14.7; A12, A13)

**Where.** `test/suite/registry/section-4.5.ts`.

**Change.** Exact shapes are at L184 and L188.
- *T4.5-4.* A `using SPEC = f()` in a block and an `await using SPEC = f()` in an async function. A chain rooted at the local records no edge and raises no finding; the same chain outside that scope records its edge.
- *T4.5-8.* Module-scope `using SPEC = f()` and `await using SPEC = f()`, each beside the spec import.
  - Each gives condition 15 plus condition 7, exit 1, with no edge or occurrence, observed through `occurrences --file`.
  - The 14.15 finding locates the import and the declarator `SPEC = f()`, excluding `using` and `await using`.

**Checks.** S-9 and S-7 pass. Both tests against the built product.

### Task 28 — T5.7-2: the U+3000 / U+202F token-bound arm (TEST-SPEC L239; SPEC 5.7, 1.4; A15)

**Where.** `test/suite/registry/section-5.7.ts`: `TOKEN_BOUND_ARMS` holds only the U+00A0 and U+FEFF arms today.

**Change.** Add `d={` U+3000 `BASE.a` U+202F `}`: its occurrence spans `BASE.a` alone.

**Checks.** S-9 and S-7 pass. T5.7-2 against the built product.

### Task 29 — T6.4-2: five keepable-form rename arms (TEST-SPEC L269; SPEC 6.4, 1.4; A16)

**Where.** `test/suite/registry/section-6.4.ts`.

**Change.** Five rename arms under the whole-file byte contract; staging and expected bytes at L269.
- Dot access kept:
  - `BASE.login` renamed to `delete` gives `BASE.delete`;
  - renamed to U+00E9 gives `BASE.`U+00E9;
  - renamed to U+2EBF0 gives `BASE.`U+2EBF0.
- Double-quoted computed access:
  - `2fa` gives `BASE["2fa"]`;
  - U+1C89 followed by `x` gives `BASE["`U+1C89`x"]`.

**Checks.** S-9 and S-7 pass. T6.4-2 against the built product.

### Task 30 — T6.4-3: six barred-character `<new-id>` arms (TEST-SPEC L270; SPEC 6.4, 1.4; A17; they flow into T6.6-3 and T14-7)

**Where.** `test/suite/registry/section-6.4.ts`: `RENAME_REFUSAL_CASES` holds only the `then` and whitespace arms today. T6.6-3 (`section-6.6.ts`) and T14-7 (`section-14.ts`) iterate it.

**Change.** Run `rename specs/A.mdx a '<new-id>'` with each `<new-id>` (exact at L270): `a"b`; `a'b`; `a`, backslash, `b`; `a&b`; `a`, U+2028, `b`; and `a`, U+2029, `b`.
- Each exits 1 with `refused-invalid-id` alone, never exit 2.
- `identities` is exactly `["specs/A.mdx#<new-id>"]`, the character verbatim.
- The workspace and the journal stay byte-unchanged, checked with the compare-around machinery.

Add the arms to `RENAME_REFUSAL_CASES`, so that T6.6-3's preview twins and T14-7's code assertions cover them.

**Checks.** S-7 passes. T6.4-3, T6.6-3, and T14-7 against the built product.

### Task 31 — T6.5-1: the five-declaration specifier arm (TEST-SPEC L278; SPEC 6.5; A18)

**Where.** `test/suite/registry/section-6.5.ts`.

**Change.** Run `move specs/A.mdx specs/sub/A.mdx` under the glob `specs/**/*.mdx`, with `specs/C.mdx` discovered. The arm has five import declarations whose specifiers the move rewrites, though none records an edge (exact bytes at L278):
- the moved file's own unused `import C from "./C.xspec"` in `A.mdx`;
- the unused `import A from "./A.xspec"` in `B.mdx`;
- in `src/c.ts`: `import type T`, `import { type text as t }`, and `import "../specs/A.xspec"`.

Expected:
- each specifier is rewritten byte-exactly, keeping its quote style;
- the preview's `files` holds the relocation entry and exactly five `import-specifier-rewrite` entries;
- `build` and `check` exit 0 afterward.

**Checks.** S-9 and S-7 pass. T6.5-1 against the built product.

### Task 32 — T6.5-2: the CRLF and lone-CR terminator-kind arms (TEST-SPEC L279; SPEC 6.5, 3; A19)

**Where.** `test/suite/registry/section-6.5.ts`: `X2_ARMS`. No T6.5 module stages CR or CRLF today.

**Change.** For each terminator kind (CRLF, lone CR), add both geometries L279 names: into parent `p`, and at the end of the file at `n`. Use the exact bytes L279 gives.

**Checks.**
- Byte-verify the staged terminators.
- S-9 and S-7 pass. T6.5-2 against the built product.

### Task 33 — T6.5-4: barred `<new-id>` characters and barred destination-path characters (TEST-SPEC L281; SPEC 6.5, 7.1, 1.4, 14.19; A20; they flow into T6.6-3 and T14-7)

**Where.** `test/suite/registry/section-6.5.ts`: `MOVE_REFUSAL_CASES`, which T6.6-3 and T14-7 iterate.

**Change.** Spellings from L281.
- *(i) Barred `<new-id>` characters, section form.* One arm per character 1.4's quote-and-escape bullet bars: `"`, `'`, the backslash, `&`, U+2028, and U+2029. Each `<new-id>` is one segment carrying the character between two letters. Each arm:
  - exits 1 with `refused-invalid-id`, never exit 2;
  - reports `identities` `["<target>#<new-id>"]`.
- *(ii) Barred destination-path characters (7.1).* For each of `"`, `'`, the backslash, U+000A, U+000D, U+2028, and U+2029, one file-form arm and one section-form arm creating the target. For `'`, also one arm of each form placing it in a directory component: `specs/it's/b.mdx`, with `specs/it's` absent. Each arm:
  - is refused `refused-invalid-destination`, concerning the destination as spelled — never a usage error;
  - modifies nothing (compare-around machinery);
  - runs under the spec glob `specs/**/*.mdx`.

These destinations are operands, never staged file names, so no arm needs Linux-leg gating.

**Checks.** S-7 passes. T6.5-4, T6.6-3, and T14-7 against the built product.

### Task 34 — T6.5-7: the CRLF and lone-CR re-runs (TEST-SPEC L285; A21)

**Where.** `test/suite/registry/section-6.5.ts`: T6.5-7.

**Change.** Re-run every fixture — the MDX fixture and both code variants — with CRLF terminators and with lone-CR terminators. Compose the expected bytes by L285's rules. Its import-heading clause is already met.

**Checks.** S-9 and S-7 pass. T6.5-7 against the built product.

### Task 35 — T6.5-8: the TS arm restaged, and the terminator re-runs (TEST-SPEC L287; SPEC 6.5; A22)

**Where.** `test/suite/registry/section-6.5.ts`. T6.5-8's TS arm stages `import ORG …;`, a blank line, then top-level markers, and accepts any line start. That admits placements 6.5 now forbids as untimely, such as after `ORG.org.mv;`.

**Change.**
- *Restage* as L287 pins it: `src/c.ts` = `import O from "../specs/origin.xspec"`, U+000A, then a function `f` holding `O.x` (moved) and `O.w`. Assert the added run exactly at the start of line 2.
- *Add the CRLF and lone-CR re-runs* of all three arms, exact bytes per L287.

If T6.5-9 or T6.5-11 import this arm's exported staging, keep them building; Tasks 36 and 37 restage them.

**Checks.** S-9 and S-7 pass. T6.5-8 against the built product.

### Task 36 — T6.5-9: placement, and the type-alias name left to T6.5-22(a) (TEST-SPEC L288; A23)

**Depends on.** Tasks 19 and 35.

**Where.** `test/suite/registry/section-6.5.ts`: T6.5-9's code arm.

**Change.**
- *Restage.* The code arm becomes T6.5-8's restaged TS arm plus the lures. The import declarations (the origin's and the non-spec lures') head the file, with no blank line after them.
- *Placement.* Assert the diff-isolated added run as T6.5-8 asserts it: at the start of the line directly after one of the imports. Today no placement is asserted, and the blank line after the imports lets a conforming product insert at a line start that is not directly after an import.
- *Type alias.* Drop T6.5-9's own assertion that the fresh identifier is not the `type` alias's name (`TargetSPEC`). L288 leaves the alias to T6.5-22(a), which Task 19 asserts universally. T6.5-9 keeps the value-level lures and the compile-cleanliness assertion.

**Checks.** S-9 and S-7 pass. T6.5-9 against the built product.

### Task 37 — T6.5-11: arms (a) and (b) restaged; new arms (e) and (f) (TEST-SPEC L290; A24)

**Where.** `test/suite/registry/section-6.5-ii.ts`. Today the origin import stands first (in (b), before `T`), and any line start is accepted.

**Change.** Exact bytes at L290.
- *Restage (a):* `import K from "../specs/k.xspec"`, then `import O, { text as t } …`, then `f` holding `K.a` and `t(O.x)`.
- *Restage (b):* `import T …` first, then `import O, { text as t } …`.
- *Placement in (a) and (b):* assert the added run exactly where the origin declaration's line stood.
- *New (e):* the file holds `import { text as tt }` and lacks the default. The call becomes `tt(<X>.y)`, and the run adds only `import <X> from …`.
- *New (f):* `tt` is appended after `f`, so it is untimely. One declaration binds both, and `<Y>` is never `tt`.
- *In (e) and (f):* `build` and `check` clean, a clean compile, one `embeds` edge from `src/c.ts#f`, and preview parity.

**Checks.** S-9 and S-7 pass. T6.5-11 against the built product.

### Task 38 — T6.5-18: fixture order and placement; the type-only and callee-shadow arms (TEST-SPEC L297; A25)

**Where.** `test/suite/registry/section-6.5-iii.ts`: `a18App` and the `A18_*` section, which stage O first today.

**Change.** Exact bytes at L297.
- *Order.* `import T`, then `import O`. The added run stands exactly where O's line stood, directly after T's line.
- *Type-only (a).* `import type T`, `import O`, `let v: typeof T.z`, and `O.x` give the exact file with `import <F>` added and `<F>.y`.
- *Type-only (b).* `import T, { type text as tt }` with `textO(O.x)` gives an added `import { text as <Y> }` and the call `<Y>(T.y)`.
- *Callee shadow.* `const tt = 1` in `f` gives an added `import { text as <Y> }` and the call `<Y>(T.y)`.
- *Each arm:* clean `build` and `check`, a clean compile, the edges, and preview parity.

**Checks.** S-9 and S-7 pass. T6.5-18 against the built product.

### Task 39 — Register T6.5-20, arms (a) and (b): destination refusals over derived paths (TEST-SPEC L299; SPEC 6.5, 13.4, 14; A26, A30)

**Depends on.** None. Tasks 40 and 41 add arms (c) through (e).

**Where.**
- The registry module for the new 6.5 tests. `section-6.5-iii.ts` is 6500 lines, so a new `section-6.5-iv.ts`, with its wrapper and index import, is reasonable.
- `section-6.6.ts`: T6.6-3's preview twins.
- `traceability.ts`, with `"14"`.

**Change.** Spellings from L299.
- *The common contract, for every refused arm.*
  - It exits 1 and modifies nothing: a workspace compare-around, with the journal absent or byte-unchanged.
  - It reports exactly one `refused-invalid-destination` finding: `path` the destination as spelled, `locations` `[]`, never 14.22.
  - Its `--preview` reports the same; this is T6.6-3's twin, wired in T6.6-3.
  - Spec globs are `specs/**/*.mdx` throughout.
- *Arm (a), under a derived path the sources would generate after the move.*
  - The module-path pair, staged before any build: the file form `move specs/Z.mdx specs/A.xspec.ts/B.mdx`, and the section form creating that target.
  - The same pair under each companion path of `specs/A.mdx`, staged before any build. Read the paths from `inventory`'s `recorded` set after a scratch twin's build, as T13.4-9(e) reads them; there are none for a product writing no companions.
  - The module-path pair again, staged after a `build`: exactly one finding, the two relations meeting at one component.
  - The `outDir: "out"` pair (`move specs/Z.mdx specs/x.md/y.mdx`, and its section form), staged before any build.
- *Arm (b), a directory component of another derived path.*
  - `move specs/Z.mdx specs/a.mdx` beside `specs/a.md/b.mdx`, under `outDir: "out"`.
  - `move specs/Z.mdx specs/B.mdx` under `markdown.outDir: "specs/B.mdx/md"`, staged before any build.
  - (b)'s section-form recurrences, as L299 lists them after (d).

**Checks.** S-7 passes. T6.5-20 and T6.6-3 against the built product (diagnose).

### Task 40 — T6.5-20, arm (c): a source hidden or replaced, and its performed exemption (TEST-SPEC L299)

**Depends on.** Task 39.

**Where.** As Task 39.

**Change.** Emission is next to sources, and each refused staging is staged before any build. Spellings from L299; every code source must be accepted by 5.9.3 both ways.
- *Refused stagings, under Task 39's common contract:*
  - `move specs/Z.mdx specs/B.mdx` beside a discovered code source `specs/B.md` (a code group globbing `specs/*.md`, the file well-formed TypeScript);
  - separately, beside a discovered `specs/B.md/C.mdx`;
  - beside a discovered code source `specs/B.md/x.ts`, the only file beneath (a code group globbing `specs/**/*.ts`, the file holding `export const v = 1`);
  - `move specs/Z.mdx specs/A.mdx` beside a discovered code source `specs/A.xspec.ts/c.ts`;
  - one staging per companion path of the destination, beside `specs/A.xspec.<suffix>/c.ts`, with the paths read as T13.4-9(e) reads them.
- *The performed exemption.* `move specs/B.md/C.mdx specs/B.mdx` after a `build`: exit 0, with the effects L299 states and `check` clean.
- *Section form.* (c)'s section-form recurrences are refused alike. The exemption staging in the section form (`move specs/B.md/C.mdx#x specs/B.mdx#x`) is refused.
- *T6.6-3 twins* for every refused staging.

**Checks.** As Task 39.

### Task 41 — T6.5-20, arms (d) and (e): module-linking designation, and the derived paths a move retires (TEST-SPEC L299)

**Depends on.** Task 39.

**Where.** As Task 39.

**Change.** Spellings from L299; every code source must be accepted by 5.9.3 both ways.
- *Arm (d).* Emission is next to sources, and `src/c.ts` holds one module-linking form alone, its relative specifier `../specs/B.md`. There is one staging per form 4 names, each line followed by U+000A: `import "../specs/B.md"`, `export * from "../specs/B.md"`, `import X = require("../specs/B.md")`, `import("../specs/B.md")`, `type T = import("../specs/B.md")`, and `declare module "../specs/B.md" { }`. Each makes `move specs/Z.mdx specs/B.mdx` refused.
  - *Controls, each performed with `check` clean afterward:* emission disabled, under each of the six stagings; and emission enabled with the path named only by `require("../specs/B.md")`, by the triple-slash reference, and by the template-literal `import()`.
  - *Section form.* (d)'s section-form recurrences are refused alike.
- *Arm (e), the derived paths a file-form move retires.* `specs/A.mdx` is the only source, holding a section `x` and no import, with each staging staged before any build.
  - *Performed, exit 0 with `check` clean:* `move specs/A.mdx specs/A.xspec.ts/B.mdx`, `move specs/A.mdx specs/A.md/B.mdx`, and one staging per companion path.
  - *Refused controls:* each of those staged after a `build` instead (T6.5-4's relation alone), and the section form `move specs/A.mdx#x specs/A.xspec.ts/B.mdx#x` staged before any build.
- *T6.6-3 twins* for every refused staging.

**Checks.** As Task 39.

### Task 42 — Register T6.5-21: `refused-exposed-derived-file` (TEST-SPEC L300; SPEC 6.5, 13.4, 14; A27, A30)

**Depends on.** Task 13, and Task 39's module.

**Where.** The new 6.5 module; `section-6.6.ts` for T6.6-3's twins; `traceability.ts`, with `"14"`.

**Change.** Each arm stages `move specs/A.mdx specs/sub/A.mdx`, with emission next to sources and spec globs `specs/**/*.mdx`. Spellings from L300.
- *Refused, (a) and (b).* Each exits 1 and modifies nothing (compare-around; the journal absent or byte-unchanged). It reports exactly one finding: code `refused-exposed-derived-file`, `path` the origin's emit destination `specs/A.md`, `locations` `[]`, and `identities` `[]`. The `--preview` reports the same.
  - (a) After a `build`, with a second spec glob `specs/*.md`.
  - (b) With no build ever run: `specs/A.md` is the user's plain file, under a code group `specs/*.md`.
- *Performed controls.*
  - (c) No glob reaches `specs/A.md`.
  - (d) A symbolic link to a file outside the workspace is the occupant, with (a)'s glob present: the move succeeds, the regeneration removes the link as the link, and the target stays byte-identical. Reuse the shared link staging `stageLinkToOutsideFile` and `assertOutsideLinkTargetUnchanged` (`section-13.4.ts`; export them, or move them to `support.ts`).
  - (e) The section form in (a)'s staging: exit 0, the preview succeeding alike, with the effects L300 states and `check` clean.
- *Multi-reason order.* `move specs/A.mdx "specs/a'b.mdx"` in (a)'s staging reports `refused-invalid-destination`, then `refused-exposed-derived-file`. Export the staging: T12.7-2 asserts the same order (Task 55).

**Note (from Task 13).** The vocabulary, decoder, and comparator know the code; `IDENTITY_PINNED_REFUSAL_CODES` (`test/suite/registry/support.ts`) does not list it, so `assertRefusalIdentities` throws a harness defect on a case stating its `identities`. Asserting L300's `identities` `[]` through that path needs the code classified there, with its doc comment, or a direct assertion.

**Checks.** S-7 passes. T6.5-21 and T6.6-3 against the built product.

### Task 43 — Register T6.5-22 with its (b) lures (TEST-SPEC L301; S-6; A28)

**Depends on.** Tasks 18 and 19, and Task 14 for judging each receiving code file both ways.

**Where.** The new 6.5 module, and `traceability.ts`.

**Change.** Each lure is a section move whose receiving file needs an import of a target module named to steer a basename- or stem-derived choice onto a barred or captured name. Task 19's assertion applies to every lure, and `check` is clean after each move. The exact list is at L301:
- `specs/let.mdx`, `await`, `yield`, `eval`, `Object`, `require`, `exports`, `__x`, `escape`, `unescape`, `Iterator`, `AsyncIterator`, and `SuppressedError`, each received once by a spec source and once by a `.ts` code source;
- `specs/React.mdx`, received by a `.tsx` file whose body holds classic-runtime JSX (`<div />`) and by a `.tsx` file holding no JSX;
- `specs/h.mdx`, received by `.tsx` files carrying `/** @jsx h */` and `/* @JSX h */`; `specs/preact.mdx`, by one carrying `/** @jsx preact.h */`; and `specs/Frag.mdx`, by one carrying `/** @jsxFrag Frag */` alone;
- `specs/h.mdx` again, received by two `.tsx` files whose pragma TypeScript ignores: the line comment `// @jsx h`, and `/** @jsx h */` inside a function body after the file's first statement;
- `specs/helper.mdx`, received by a `.ts` file declaring `helper` only inside a function, and by one declaring it only as a type;
- `specs/Record.mdx`, received by a `.ts` file whose only mention of `Record` is `let r: Record<string, number> = {}`;
- `specs/test.mdx`, received by a `.ts` file calling an undeclared global `test(…)`.

Every receiving code file must be accepted by 5.9.3 both ways, and every spec source must derive.

**Checks.** S-9 and S-7 pass. T6.5-22 against the built product; diagnose each lure the product breaches.

### Task 44 — Register T6.5-23, arms (a)–(e) (TEST-SPEC L302; SPEC 6.5; A29)

**Depends on.** Tasks 14 and 19.

**Where.** The new 6.5 module; `traceability.ts`; and the preview parity check, wherever T6.6-4(b)'s machinery lives (`section-6.6.ts`).

**Change.** T6.5-23 is about 26 KB of text; read L302 whole before starting.
- *The common contract,* stated at L302 before (a):
  - Each arm is a section move of `specs/origin.mdx#x` to `specs/target.mdx#y`, or the move the arm names. Its receiver gains `import <X> from "../specs/target.xspec"`, apart from the exceptions L302 lists, value-blind in `<X>` alone (T6.5-8's discipline; Task 19's assertion).
  - `build` and `check` are clean after each move.
  - The preview's `import-addition` stands at the offset the real operation then uses (T6.6-4(b)).
  - Every code file, before and after, is accepted by 5.9.3 both as module code and as script code. Use Task 14's judge as an assertion on the post-move bytes.
- *Arms (a)–(e), exact bytes at L302:*
  - (a) the directive prologue — both stagings, including the latitude among offsets 26, 27, 64, and 65;
  - (b) file-top directives;
  - (c) a comment governing a statement, with its standard-tooling compile;
  - (d) a trailing comment, plus the forced mid-line stagings with U+00A0 and with U+2028;
  - (e) statement splitting.

Arms (f) through (p) follow in Tasks 45–47.

**Checks.** S-9 and S-7 pass. T6.5-23 against the built product (diagnose).

### Task 45 — T6.5-23, arms (f) and (g) (TEST-SPEC L302)

**Depends on.** Task 44.

**Change.** Exact bytes at L302.
- (f) Timeliness: 6.5's example; its two boundary stagings (interposing `type T = number` and `import Z = require("./z")`); its control; its two exempt-side stagings (interposing `import type { T } from "./t"` and `import "./p"`); and its precedence branch at a distance.
- (g) The spec-source side of the split rule.

**Checks.** As Task 44.

### Task 46 — T6.5-23, arms (h)–(k) (TEST-SPEC L302)

**Depends on.** Task 44.

**Change.** Exact bytes at L302.
- (h) A removed declaration's place.
- (i) A comment above the removed declaration: `// note`, and separately `// @ts-expect-error`.
- (j) A string-literal statement after the removed declaration.
- (k) A callee's timeliness, with its control.

In (h) through (j), `f` is `export function f() { O.x }`, so the origin import loses its last use. There the preview's `import-addition` must stand at the removal's end alone.

**Checks.** As Task 44.

### Task 47 — T6.5-23, arms (l)–(p) (TEST-SPEC L302)

**Depends on.** Task 44.

**Change.** Exact bytes at L302.
- (l) One added binding rooting spellings that were rooted at different bindings.
- (m) A held binding beside an added one, for one module in one file.
- (n) Nested statement lists: (d)'s file with `f` spread over lines.
- (o) Timeliness as a TypeScript source's condition alone; the receiver gains no declaration.
- (p) Whitespace between a statement's end and its line's terminator.

After this task T6.5-23 covers (a) through (p).

**Checks.** As Task 44.

### Task 48 — T7-2: the four import-modifier arms (TEST-SPEC L321; SPEC 7, 14.14; B1)

**Where.** `test/suite/registry/section-7-basics.ts`: `FORM_VIOLATIONS`.

**Change.** Add four arms. Each import below is followed by an otherwise valid `export default defineConfig({…})`, and each fails with 14.14, exit 2:
- `import type { defineConfig } from "xspec"`;
- `import { type defineConfig } from "xspec"`;
- `import defer { defineConfig } from "xspec"`;
- `import { defineConfig } from "xspec" with { type: "json" }`.

S-9 names every one of these configurations well-formed: 5.9.3 accepts each both ways.

**Checks.** S-9 (Task 14's vectors already hold these forms) and S-7 pass. T7-2 against the built product.

### Task 49 — T7.1-1: the path-character arms and the code-group control (TEST-SPEC L326; SPEC 7.1, 14.19; B4)

**Where.** `test/suite/registry/section-7.1-7.3.ts`.

**Change.** Spellings from L326.
- *Arms.* One arm per character 7.1 bars — `"`, `'`, the backslash, U+000A, U+000D, U+2028, and U+2029 — in a spec-group file name (for example `specs/a'b.mdx`). Add one more arm with `'` in a directory component (`specs/it's/a.mdx`).
  - Each gives 14.19.
  - The `"`, backslash, LF, and CR arms are Linux-leg only, gated in the body.
  - Each file stays discovered and reachable as T11.2-3's are: the finding concerns its path, and a glob-reached `view` serves its tree with every identity unavailable.
- *Control.* The code-group file `src/it's`, backslash, `x.ts` is valid: `build` and `check` exit 0, and a marker in it records its edge from the whole-file location.

**Checks.** S-9 and S-7 pass. T7.1-1 against the built product.

### Task 50 — T7.3-1: the graph-data-area `outDir` arms and their look-alikes (TEST-SPEC L328; SPEC 7.3, 14.14; B5)

**Where.** `test/suite/registry/section-7.1-7.3.ts`: `INVALID_OUTDIRS`.

**Change.**
- `".xspec"` and `".xspec/md"` each give 14.14, exit 2.
- The look-alikes `".xspec2"` and `".xspecs/md"` are valid, and emission writes each destination under them.

**Checks.** S-7 passes. T7.3-1 against the built product.

### Task 51 — T11.6-2: the invalid-path `.mdx` derived-map arms (TEST-SPEC L471; SPEC 11.6, 7.1, 13.1; B6)

**Where.** `test/suite/registry/section-11.6.ts`, which today stages only the non-`.mdx` file (null/null).

**Change.**
- `specs/a'b.mdx` gets a `derived` entry with `module` `specs/a'b.xspec.ts` and, with emission next to sources, `markdown` `specs/a'b.md`.
- On the Linux leg, a source named with non-UTF-8 bytes and ending `.mdx` has its `source`, `module`, and `markdown` each in the marked byte form: the source bytes with the final `.mdx` replaced by `.xspec.ts` or `.md`.

**Checks.** S-7 passes. T11.6-2 against the built product.

### Task 52 — T12.0-5: the positive side of the backslash (TEST-SPEC L483; SPEC 12.0; E-6 at L641; B7; C7's note)

**Where.** `test/suite/registry/section-12.0-i.ts`, which has only the negative arm today (the operand `specs`, backslash, `A.mdx`). The Windows subset reruns the whole T12.0-5 entry (`test/windows/e6-subset.test.ts`).

**Change.** Both arms are Linux-leg only, gated inside the body as the non-UTF-8 arm is (E-6: "less its Linux-leg arms"). Spellings from L483.
- *Spec side.* A discovered spec-group file `specs/a`, backslash, `b.mdx` (an invalid path). `view` and `at … 0` with that path name the file: membership holds and identities are unavailable. The exit is 1 with the condition-19 finding, never the unknown-file exit 2.
- *Code side.* A valid code source `src/a`, backslash, `b.ts` beside `src/ab.ts`, each marking a node. `occurrences --file` with the first file's path, and with the pattern `src/a`, backslash, `*.ts`, each list only the first file's occurrence.

**Checks.**
- S-9 and S-7 pass. T12.0-5 against the built product.
- Read the gating to confirm `npm run test:windows` would skip no arm.

### Task 53 — T12.0-10: two syntax-class rows (TEST-SPEC L488; SPEC 12.0, 1.4; B8)

**Where.** `test/suite/registry/section-12.0-ii.ts`: `T12_0_10_SYNTAX_ROWS`.

**Change.** Add a `--tag` spelled with U+2028, and a `--to` whose id segment carries U+2029. Each is malformed under 1.4's quote-and-escape bullet. Like the existing rows, each is a usage error reported without loading configuration: exit 2, `code` null.

**Checks.** S-7 passes. T12.0-10 against the built product.

### Task 54 — T12.2-4, arm (b): the expected orphan set comes from the record (TEST-SPEC L506; T11.6-3; B9)

**Where.** `test/suite/registry/section-12.1-12.2.ts`: `t1224DerivedListing`, which today lists `extra/E.xspec.*` from the directory.

**Change.** Take the expected set from the record, not from a listing of the written files. It is the dropped source's module, plus each companion that `inventory`'s `recorded` set lists for it after the build (T11.6-3), plus its Markdown where emitted.

**Checks.** S-7 passes. T12.2-4 against the built product.

### Task 55 — T12.7-2: T6.5-21's two-reason order (TEST-SPEC L531; SPEC 14, 12.7; B10)

**Depends on.** Tasks 13 and 42.

**Where.** `test/suite/registry/section-12.7.ts`.

**Change.** In T6.5-21(a)'s staging (reuse its exported staging), `move specs/A.mdx "specs/a'b.mdx"` reports `refused-invalid-destination`, then `refused-exposed-derived-file`.

**Checks.** S-7 passes. T12.7-2 against the built product.

### Task 56 — T13.4-4: the directory-occupant arms (TEST-SPEC L557; SPEC 13.4; B11)

**Depends on.** Nothing open. T13.4-4's link arm already stages through the shared helper `stageLinkToOutsideFile`; keep it there.

**Where.** `test/suite/registry/section-13.4.ts`.

**Change.** A directory at a derived path, holding nothing xspec discovers or generates, is replaced by the derived file. Two stagings: an empty directory, and a directory holding a file no group matches. In each, `build` exits 0, a plain file stands at the path, and `check` is clean.

**Checks.** S-7 passes. T13.4-4 against the built product.

### Task 57 — Register T13.4-9 (TEST-SPEC L562; SPEC 13.4, 14.22; B12)

**Where.** `test/suite/registry/section-13.4.ts`, and `traceability.ts` with `"14"`.

**Change.** Stagings (a) through (f), as L562 states them:
- the first five are staged before any build;
- (e) is a pair per companion path, the paths read from `inventory`'s `recorded` set of a scratch twin;
- (f) is staged after a build of `a.mdx` alone.

In each staging:
- `build` exits 1 with exactly one condition-22 finding concerning the offending derived path — `specs/a.md`, `out/a.md`, `specs/A.xspec.ts`, `specs/a.md`, (e)'s companion path, and `out/a.md` respectively — with `locations` `[]`, writing and removing nothing (compare-around machinery);
- `check` reports the same finding without writing;
- `ids` reports it with exit 1, answering nothing.

**Checks.** S-9 and S-7 pass. T13.4-9 against the built product.

### Task 58 — Register T13.4-10 (TEST-SPEC L563; SPEC 13.4, 14.22, 14.10; B13)

**Where.** `test/suite/registry/section-13.4.ts`, and `traceability.ts` with `"14"`.

**Change.**
- *Staging.* `build` with `markdown: { emit: true, outDir: "out" }` and `specs/A.mdx`, recording the emitted `out/specs/A.md`. Then reconfigure `outDir` to `"out/specs/A.md"`.
- *`build`* exits 1 with exactly one condition-22 finding concerning `out/specs/A.md`, and modifies nothing (compare-around).
- *`check`* exits 1, reporting that finding and exactly one condition-10 recorded-file finding concerning `out/specs/A.md`. Its correction is the file's manual deletion, never a rebuild (H-3's robust matching). No mismatch form is reported.
- *After deleting the file by hand,* `build` exits 0, writing `out/specs/A.md/specs/A.md`, and `check` is clean.
- *The unrecorded twin.* Graph data is deleted before the reconfiguration. The rest behaves the same, except that `check` reports the condition-22 finding alone.

**Checks.** S-7 passes. T13.4-10 against the built product.

### Task 59 — T14-7: `refused-exposed-derived-file`, and the new `refused-invalid-destination` arms (TEST-SPEC L589; B15)

**Depends on.** Tasks 13, 33, and 39–42.

**Where.** `test/suite/registry/section-14.ts`.

**Change.**
- Add a `refused-exposed-derived-file` arm over T6.5-21's staging: `path` the origin's emit destination, `locations` `[]`, `identities` `[]`.
- Assert `refused-invalid-destination`, never 14.22, for:
  - T6.5-4's barred path characters: Task 33's cases, if not already reached through `MOVE_REFUSAL_CASES`;
  - T6.5-20's derived-path relations and module-linking designation, through its exported stagings.

**Checks.** S-7 passes. T14-7 against the built product.

### Task 60 — T14-11: arm (r) widened, and the new 14.15 location arms (TEST-SPEC L593; B16)

**Where.** `test/suite/registry/section-14.ts`.

**Change.** Spellings from L593.
- *Arm (r).* U+1680 and U+3000 between the braces and `BASE.missing`, each excluded from the 14.5 range.
- *14.15 locations:*
  - `export import X = require("./A.xspec")`, located from `import`;
  - the import types `typeof import("./A.xspec").default` and `import("./A.xspec").T<number>`, each locating `import("./A.xspec")`;
  - `declare module "./A.xspec" { }`, located whole, `declare` included;
  - `export declare module "./A.xspec" { }`, located from `declare`.

**Checks.** S-9 and S-7 pass. T14-11 against the built product.

### Task 61 — T14-12: the re-descent arms (TEST-SPEC L594; SPEC 14.20; B17)

**Depends on.** Tasks 14, 15, and 17.

**Where.** `test/suite/registry/section-14-iii.ts`: `T14_12_FORM_VECTORS` and its siblings.

**Change.** Spellings from L594.
- *Release pin.* `.ts` sources holding `{ using x = f(); }`, `async function g() { await using y = h(); }`, and `import a from "./a.json" with { type: "json" };`. For each, `build` and `check` exit 0 and a marker records its edge.
- *Language level.*
  - `const ` U+2EBF0 ` = 1` with the marker `S.`U+2EBF0, pointing at section U+2EBF0: exit 0, the `references` edge recorded.
  - A configuration with `import { defineConfig as ` U+2EBF0 ` } from "xspec"` and `export default ` U+2EBF0 `({…})` loads, and `build` exits 0.
- *U+1C89 negative.* `const ` U+1C89 `x = 1` in a `.ts` gives 14.20 at the zero-length range at offset 6.
- *Code-source whitespace.* `const`, U+200B, `a = 1`, then on a later line `const`, U+0085, `b = 1`. This is well-formed: exit 0.
- *Unicode-pin MDX arms.* None of the three may be 14.20:
  - `{` U+2EBF0 `}` alone on its line gives 14.16 at the container;
  - `<a` U+2EBF0 ` />` gives 14.16 at its tag;
  - `<S id="x" a` U+2EBF0 `="v" />` gives 14.17 at that attribute.

  Export each MDX staging for S-9, as `T14_12_FORM_VECTORS` is exported, and judge it in the S-9 self-test.

**Checks.** S-9 (both judges) and S-7 pass. T14-12 against the built product.

### Part D — Properties, the Windows leg, and S-9's generated forms

### Task 62 — P-2: the full brace-whitespace set (TEST-SPEC §16 P-2, L605; S-9; C6; D's CONF-MD note)

**Where.**
- `test/suite/registry/section-16-p2-p3.ts`: `ECMASCRIPT_ONLY_WHITESPACE` (today NBSP, FEFF, LS, and PS), and the block-comment `sequence` gap, which draws only `" "`, `""`, NBSP, and LS;
- the S-9 form vectors built from that constant (`test/self/s9-fixture-well-formedness.test.ts`).

**Change.** Draw the whitespace between braces from the full set L605 names: U+FEFF, U+2028, U+2029, U+00A0, U+1680, U+2000 through U+200A, U+202F, U+205F, and U+3000. The form vectors must cover each code point.

**Checks.**
- The S-9 vectors pass.
- `-t MD`: CONF-MD's conformer passes P-2 (reviewer D probed that it handles the full set). VIOL-MD-CLASS and VIOL-MD-CR still fail exactly their tests, P-2 among them.
- P-2 and P-3 against the built product. Record P-2's timing in AGENTS.md if it moved.

### Task 63 — P-5: added imports held to T6.5-22(a), and spec basenames from the barred classes (TEST-SPEC §16 P-5, L608; C4)

**Depends on.** Tasks 18 and 19.

**Where.** `test/suite/registry/section-16-p5-p6.ts`, and `FILE_NAMES` in `section-16-p4.ts` (`A`, `B`, `C`; shared with P-4) together with the `N<k>` basenames.

**Change.**
- *(a) Added imports.* Every import a drawn move adds is held to T6.5-22(a)'s assertion: those in a created `specs/N<k>.mdx`, and those gained by files that reference into the moved subtree. Task 19's hook covers this if P-5's moves pass through it; otherwise call the assertion explicitly.
- *(b) Basenames.* The drawn spec basenames include names from every barred class: reserved and strict-mode-barred words, `require`, `exports`, a `__`-prefixed name, global-object properties (`escape` and `unescape` included), `Iterator`, `AsyncIterator`, and `SuppressedError`.
- *What must still hold:*
  - the generator's own import bindings stay derivable whatever a basename is, so choose them independently of basenames;
  - every draw stays valid by construction (§16's preamble);
  - destinations stay clear of 6.5's destination refusals. Today a specs-only configuration, no emission, and fresh `specs/N<k>.mdx` paths keep them clear.

**Checks.**
- S-9's per-draw check rejects no draw.
- P-5 against the built product at the fixed seeds; record its timing.
- P-4 still passes as before, or is adjusted if `FILE_NAMES` changes for it too.

### Task 64 — S-9's TypeScript check for generated forms: the fixed vector set and the per-draw check (TEST-SPEC S-9, L632; §16; C1, part 4)

**Depends on.** Tasks 14, 15, 16b–16o (Task 16o declares the draw-composed files per draw), 62, and 63.

**Where.**
- `test/helpers/property.ts`: `checkProperty`'s per-draw S-9 option (today `mdxSources`);
- the section-16 modules;
- the S-9 self-test files.

**Change.**
- *Fixed vector set.* A fixed set of the generated TypeScript forms is judged well-formed before any product exists. It covers every property's configuration file, P-7's capture sources, P-13's `c0/U.ts` and `c1/V.ts`, and every other code source a generator composes.
- *Per-draw check.* Each draw's code sources and configuration are judged before the product is driven on them. A failing draw is a harness error carrying its seed — never a product failure or a skipped draw.

**Checks.**
- The vector self-test passes.
- Red-check by corrupting a generator's configuration template: a harness error with the seed, before any product invocation.
- Each property against the built product at the fixed seeds, unchanged.

### Task 65 — E-6: a journaled section-form move into an existing target that gains an import (TEST-SPEC E-6, L641; C7)

**Where.** `test/helpers/e6.ts`, run by `test/suite/e6-exchange-writer.test.ts` and `test/windows/e6-byte-identity.test.ts`.

**Change.** Add a journaled section-form `move` to the representative fixture. Its moved text lands before a target parent's closing tag, in an existing target file that gains an added import. Its transcript and rewritten sources are byte-compared across the Linux and Windows legs like the other steps. This is the subset's inserted-terminator probe: every terminator 6.5 inserts is U+000A on every platform.

**Checks.**
- The E-6 writer test against the built product.
- S-9 records for any `.mdx` the step stages after an invocation.
- After the push, CI's Windows job on the new head.

### Final

### Task 66 — Confirm on the full suite and in CI; delete this plan

**Depends on.** Every task above.

**Change.**
- Under the namespace, run the full self project: expect 0 failures. Record its file and test counts and the certification pair totals (6 conformers, 21 violators) in AGENTS.md.
- Then run the suite project against the built product, alone. Every failure must be a diagnosed product failure; list each failing test with its first failing arm in the commit message.
- Check CI on the pushed head: the harness-self job and the Windows leg green.
- Delete `specs/tmp/FIX_PLAN.md` once no other task remains in it.
