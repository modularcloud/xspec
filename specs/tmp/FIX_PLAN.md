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
- *S-9 timing.* A `.mdx` source that a body stages after its first product invocation, or in a workspace it creates after it, is a staged-source record (`test/helpers/staged-mdx.ts`, judged by `test/self/s9-staged-sources.test.ts`); the undeclared-staging guard refuses plain contents there. Since Task 16 (dc97774) a TypeScript code source or configuration file staged there is a `StagedTs` record too (AGENTS.md's TypeScript-records bullet), and since Task 16o the guard refuses plain contents there as well (a draw-composed configuration or code source of a section-16 module is declared per draw instead: `ts.perDraw`, `{ ts: "per-draw" }`). Since Task 15 the builder judges every staged code source and configuration file at staging time (AGENTS.md's S-9 TypeScript bullet): a new staging of one TEST-SPEC declares unparseable lists it under `ts.unparseable`, a code source whose name `TS_DEFAULT_SUFFIXES` does not reach lists it under `ts.wellFormed` (or `ts.unparseable`), and a file whose well-formedness the document does not declare under `ts.unchecked`.
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

### Part C — The T-numbered tests, in TEST-SPEC order

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

**Note (from Task 42).** `test/suite/registry/section-6.5-iv.ts` exports the staging and the move: `runD21RefusedStaging(product, { ...D21_A_STAGING, moves: [D21_TWO_REASON_MOVE] }, context, perMove)` stages (a) (its premise `build` re-pinning `specs/A.md` a plain file) and hands the two-reason move to `perMove`; `D21_TWO_REASON_MOVE.findings` lists the two expected findings in 14's order (code and `path`; the exposure's `identities` `[]`).

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
  - T6.5-4's barred path characters: Task 33's cases, if not already reached through `MOVE_REFUSAL_CASES` (done at Task 33: they sit in `MOVE_REFUSAL_CASES`, which T14-7 iterates through `assertRefusalReport`, each asserting `refused-invalid-destination` alone with its `path`);
  - T6.5-20's derived-path relations and module-linking designation, through its exported stagings.

**Note (from Task 42).** T6.5-21's refused stagings are `D21_REFUSED_STAGINGS` (`test/suite/registry/section-6.5-iv.ts`; (a) with its file-form move and the two-reason move, and (b)), staged by `runD21RefusedStaging`, each move's expected findings in `move.findings` (code, `path`, and `identities` exactly where pinned); `refused-exposed-derived-file` is now in `IDENTITY_PINNED_REFUSAL_CODES`, so a T14-7 case naming it must state `identities` `[]`.

**Note (from Task 41).** Every refused staging of T6.5-20, arms (a) through (e), is an entry of the table `d20RefusedStagings` returns (`test/suite/registry/section-6.5-iv.ts`): (d)'s six module-linking designations and (e)'s after-build and section-form controls included, each staged by `runD20RefusedStaging`, as T6.6-3's twins iterate it.

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
