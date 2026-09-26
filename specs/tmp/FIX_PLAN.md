# FIX_PLAN — Phase 9 (test harness), from the fifth compliance determination

Written at harness commit 8f8245c (branch `claude/xspec-ui-apis-4df8fa`), the first
compliance determination after the second plan's exhaustion. Documents unchanged
since 3265b20 (`git diff --stat 3265b20..HEAD -- specs/` empty). Governing IP:
`specs/patches/0001-external-ui-apis.md` (Stage: Tested; no stage change). Bundle:
`specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`.

## Preamble — read before any task

**Scope guards (Phase 9).** Never modify product code (`src/`). Every task below is
harness work under `test/`, `.github/`, or harness configuration. Harness self-tests
and certification MUST pass after every task; product tests MAY fail (diagnosed
assertion failures only — never a harness crash, hang, or false pass, H-8).

**Known state at 8f8245c.** Self project: 20 files, 2126 passed, 0 skipped under
`unshare --map-user=1000 --map-group=1000 -- npm run test:self`. Certification pairs:
144 PASS / 33 FAIL, exactly as CERTIFICATIONS.md documents (5 conformers, 18 violators).
The diagnosed product failures allowed at this phase are recorded in the latest commit
messages and in `AGENTS.md`'s per-task bullets — they need no plan task. The
declaration rule of the previous plan (post-Task-3) still governs every new staging:
every declared-unparseable staging is marked `mdx.unparseable` (or `mdx: "unparseable"`
on the `file()` call), and every early-error form names its S-9 allowance. Environment
facts live in `AGENTS.md` and are not repeated here: the root sandbox needs the
unprivileged user namespace for the self project; the self project and a suite run
must not run concurrently; foreground `sleep` is blocked; escape spellings are built
from code points (the tool-parameter layer decodes backslash-u spellings
inconsistently — verify bytes afterward); the stand-in wrapper red/green-check
pattern; the single-test filter `-t '<ID> '` (trailing space); the diagnostic-variant
and mutation red-check recipes; a UTF-8 `TextDecoder` strips a leading BOM unless
`ignoreBOM: true`; a wrapper cannot forward non-UTF-8 argv bytes.

**Loop conventions.** One task per Engineer spawn, in order (the order is by
dependency: Tasks 1–4 are independent of each other; Task 5 builds the mechanism
Tasks 6–17 use; Task 18 must come last, after every conversion). On completing a
task: run the checks it names, update `AGENTS.md` with anything new about building,
linting, or running, remove the task from this file, commit as
`sdg(phase-9): <imperative summary>`, push. When the last task is removed, delete
this file (leave `specs/tmp/.gitkeep`). Commit messages end with the two trailer
lines the spawn prompt gives. Never merge or fetch `main`.

**Observations recorded by the panel that need no task** (judged against the current
documents): CERTIFICATIONS.md's VIOL-CORE-PERSISTREADS sentence "T13.5-8 drives no
review read at all" is descriptively inaccurate (T13.5-8 reads `review status s --json`
on a fresh session holding no resolution) but its binding constraint holds and
certification confirms it — a document wording matter, not harness work; T10.5-4 /
T10.6-2 / T10.7-4's "then item `id`" tiebreak is unstageable with the entries' own
fixtures; P-1's header claim about blank lines inside flow tags is a comment
inaccuracy that removes no oracle coverage; T12.0-9's class-2 table needs no
14.24/14.25 rows (T14-9/T14-10 assert that exit-2 contract); `test.runIf(onLinux|onPosix)`
markers gate self-tests that run on the only CI leg running the self project, so
nothing is skipped in CI (H-9, E-2); the `deriveMdx` devlop-assertion classification is
sound (both parser builds agree on every probed verdict).

## Tasks

### Task 4 — certification self-test wording: eighteen violators, not seventeen

**Requirement.** CERTIFICATIONS.md documents 18 violators, and `EXPECTED_VIOLATORS` /
the manifest pin 18 (report C). H-8/C-1 self-tests describe what they assert.

**Observed.** `test/self/certification.test.ts`'s header comment says "seventeen
violators" and the document gate's test title says "17 violators" — stale since the
eighteenth violator landed.

**Change.** Correct both spellings to eighteen / 18 (and any other stale count in the
two certification self-test files found by `grep -n -i -E 'seventeen|\b17\b'`). No
behavioral change; nothing else in the files. **Checks:** `npx tsc -p test`; the
certification self-tests green (self project in the namespace).

### Task 5 — S-9: judge every mid-test-staged MDX source before any product exists — the staged-source ledger, its self-test, and the §14 conversion

**Requirement.** TEST-SPEC.md §17 S-9 (line 624): the well-formedness check "runs
before any product exists for the deterministic fixtures and the form vectors (H-8)";
H-8: self-tests pass before the product exists.

**Observed.** The check lives in the builder (`test/helpers/workspace.ts` `checkMdx`:
every staged `.mdx` judged at staging time against its declaration) and reaches the
self project only through S-7's sweep, which reaches each test's initial staging and
any `file()` staging made before the first product invocation — against the stub the
body fails at that invocation. Every `.mdx` staging a body (or a helper it calls) makes
AFTER a product invocation in that workspace is first judged at suite time against a
real product. The reviewer's 34 literal-`.mdx` sites undercount the class: most
mid-test edits stage through path constants (`SC_FILE`, `T2_SPEC`, `Y_FILE`, …) and
template functions (`t2Spec("Kid text v1.")`, `scSpec(...)`, `leafSpec(...)`) — about
150 sites across some 35 registry modules (`grep -n -E '\.file\(' test/suite/registry/*.ts`
lists 267 calls; `.ts`, journal, session, config, and output-path stagings among them
are outside S-9). `test/self/s9-fixture-well-formedness.test.ts` judges only exported
vector sets. Bounded today (a contradiction still throws `HarnessStagingError`, never a
product failure or a skip) — only the timing clause is unmet.

**Design** (the pattern the form vectors already use — load-time exports judged by the
self project — made uniform and mechanical; an export-based fix: it changes no
assertion of any product test and stages byte-identical sources):
1. New helper `test/helpers/staged-mdx.ts`: `interface StagedMdx { readonly name: string;
   readonly source: FileContents; readonly mdx: MdxFileDeclaration }`;
   `stagedMdx(name, source, mdx = "well-formed"): StagedMdx` appends to a module-level
   ledger at import time (duplicate name → throw); `stagedMdxLedger(): readonly StagedMdx[]`;
   `sealStagedMdxLedger()` — called once at the end of `test/suite/registry/index.ts`
   after the modules are spread; a `stagedMdx()` call after sealing throws (a run-time
   registration would escape the self-test — a harness defect, never tolerated).
2. `TestWorkspace.file(rel, contents: FileContents | StagedMdx, options?)`: a record
   supplies both the bytes and the S-9 declaration of that write; an `options.mdx`
   beside a record is a contradiction → `HarnessStagingError`. Extract the judging body
   of `checkMdx` into an exported pure `judgeMdxDeclaration(key, data, declaration): void`
   (throws `HarnessStagingError` mode `mdx-derivability` exactly as today) and have
   `checkMdx` call it — one code path for the builder and the self-test.
3. New self-test `test/self/s9-staged-sources.test.ts`: imports `../suite/registry/index.js`
   for its side effect (every registry module loads; the ledger seals); asserts the
   ledger is sealed, non-empty, uniquely named, holds no `unchecked` record (ledger
   records are deterministic fixtures; `unchecked` is P-8's mutations' alone, S-9), and
   `test.each` over the ledger: `judgeMdxDeclaration(record.name, bytes(record.source),
   record.mdx)` does not throw. Red checks of the judge itself: a hand-made ill-formed
   record declared `"well-formed"` throws `HarnessStagingError` mode `mdx-derivability`;
   a deriving record declared `"unparseable"` throws.
4. **Conversion rule (Tasks 6–17 apply it):** every `file()` call staging an `.mdx` path
   — literal, constant, or byte path — that a registered body or a helper it calls makes
   after a product invocation in that workspace passes a ledger record instead of a
   plain source. The record is created at module top level from the SAME expression
   (moved, never re-spelled; the staged bytes must be identical), named
   `"<TEST-ID> <what it stages>"`, and carries the declaration in effect for that
   write today (the call's `mdx` option if any, else the workspace-level `mdx`
   declaration for that path, else well-formed) — the self-test then verifies that
   declaration before any product exists. Arm/variant tables: type the table's source
   field `StagedMdx` (one record per row, named with the row's key). Template functions
   called with body-local state (e.g. a `write()` closure over mutable version
   variables): enumerate the versions, in order, into a module-level record table and
   index through it in the body — never reorder or re-spell. Generic replace helpers
   (read the current file, replace a substring, write): for `.mdx` targets the call
   site passes a record computed at module level from the same base constant and the
   same `from`/`to` (asserting at load that the base contains `from`), or the helper
   takes a record; `.ts` targets are unchanged. Stagings made before any product
   invocation may stay as they are (S-7 reaches them); convert them only when the same
   constant serves both. Copies of product-rewritten files into a FRESH workspace
   (section-6.4.ts ~2407, section-6.5.ts ~1654/2613) are not deterministic fixtures and
   stay as they are.
5. Pattern conversion in this task: `section-14.ts` (at 8f8245c: 1542, 2223, 2341
   `STALE_EDIT`; 1646 the id-less `<S>` edit; 3467 `T14_7_BAD_INVALID` — read each
   constant to carry its declaration: a 14.20 form is `"unparseable"`, a 14.x-finding
   form well-formed), and the `.mdx` call sites of the replace helpers in
   `section-14-ii.ts` (~279) and `write-refusal-staging.ts` (~1394).

**Checks.** `npx tsc -p test`; the self project green in the namespace (21 files; the
new self-test lists the §14 records); S-7 unaffected; T14-1/T14-3/T14-4/T14-7/T14-9/
T14-10 alone against the built product give the verdicts `AGENTS.md` records. Record
in `AGENTS.md`: the ledger, the conversion rule in one paragraph, and the single-file
run of the new self-test.

### Task 6 — Ledger conversion: §1–§5.4 modules

Apply Task 5's conversion rule to every post-invocation `.mdx` staging in:
`section-1.5.ts` (218 `IDENTITY_B_EDITED`; 654 `nonUtf8Arm.file(NON_UTF8_SPEC_PATH,
VALID_SECTION_SOURCE)` — a byte path: convert if it follows an invocation),
`section-1.6-1.7.ts` (800 `EMBED_TARGET_AFTER`), `section-2.2-2.3.ts` (385),
`section-2.4.ts` (1178; 1179 is `.ts` — leave), `section-2.5-2.6.ts` (596, 821, 1098
`variant.source` table), `section-2.7.ts` (887 `arm.source` table, 931, 1589),
`section-4.5.ts` (631; 722 — read its path), `section-5.4.ts` (303 `respelled +
REINTRO_APPENDED` — hoist if both operands are module constants; 696, 799 — read their
paths). Re-enumerate with the grep (line numbers drift). Several §2 sources are 14.20
forms exported to the S-9 self-test already (e.g. `UnparseableStaging` exports T14-11's
(w) arms re-assert): keep the exports; the record wraps the same constant and carries
`"unparseable"` where the workspace declared it. **Checks:** as Task 5's; each
converted test alone against the built product gives its recorded verdict.

### Task 7 — Ledger conversion: §5.5

`section-5.5.ts` (18 sites at 8f8245c: 509 `arm.source`, 527, 566, 589, 654
`KIND_MANUAL`, 842 `subtreeSource(arm.shape)`, 866, 899, 1093, 1142, 1177, 1194, 1233,
1250 `effectiveSource({ dualAttrs: "" })`, 1272, 1399, 1435, 1481 — the multi-line calls
need their paths read). Template outputs over module-level arm tables become record
tables built at load from the same functions and rows. **Checks:** as Task 5's;
T5.5-* alone against the built product unchanged.

### Task 8 — Ledger conversion: §5.6 and §6.7

`section-5.6.ts` (457, 593, 594, 817, 821, 944, 972, 1029, 1030, 1175, 1180) and
`section-6.7.ts` (384 `impactArmSource("a.neo")`, 463 `staleOrigin.text`, 502/503 the
`.text` of `originSource`/`watchSource` builders — records wrap the same `.text`).
**Checks:** as Task 5's.

### Task 9 — Ledger conversion: §6.3–§6.6, §8, §13, §15

`section-6.3.ts` (886 `F4_BROKEN_FILE, F4_FIXED_SOURCE, { … }` — carry its option into
the record's declaration; 1394, 1453, 1474, 1526 `r5Source(...)`), `section-6.4.ts`
(2279 `P6_OTHER_INVALID`), `section-6.5.ts` (3366 — read), `section-6.6.ts` (1042 —
read), `section-8.ts` (1081 — read), `section-13.3.ts` (368 `key, entry.bytes` table —
convert the `.mdx` rows if after an invocation; 1286 `T13_3_2_A_V1`; 2509
`T13_3_3_B_INVALID`; 2720 — read), `section-13.4.ts` (660/669 — session garbage, likely
not `.mdx`: confirm and leave), `section-13.5.ts` (425 `staged.file("specs/A.mdx",
A_MDX_EDITED)` over three workspaces — one record; 1432 — read; 1941 `BOM_FILE,
BOM_MDX, { mdx: "unparseable" }` → a record declared `"unparseable"`),
`section-15.ts` (302, 458 `specSource(...)`). Certification: T13.5-1/T13.5-4 and other
CONF-CORE in-scope tests live here — the certification totals must stay 144/33.
**Checks:** as Task 5's, certification included.

### Task 10 — Ledger conversion: §9 and §9.3

`section-9.ts` (252 `p1Source(...)`, 318 `wx.treeSource(...)`, 343 — read, 499, 500,
503, 608, 673, 767, 768, 885 — read; 502/504 are `.ts` — leave) and `section-9.3.ts`
(98 — the module's own replace helper: apply Task 5's replace-helper rule to its
`.mdx` call sites; 292, 296, 612, 616 — read; 620, 623, 697; 622/624 are `.ts`).
**Checks:** as Task 5's.

### Task 11 — Ledger conversion: §10.1–§10.3

`section-10.1.ts` (323 `A_MDX_EDITED`; 1271 `T10_1_5_B_INVALID` — carry its
declaration; 1813 the shared refusal helper `(product, workspace, name, expected, …)`
staging `A_MDX_EDITED` before `review create` — one record for every caller; 1117 —
read; the session-garbage sites are not `.mdx`) and `section-10.2-10.3.ts` (543 — read;
913, 945, 1034 `t2Spec(...)`; 1107 `t2CovSpec(...)`; 1375, 1395 — read; 1583
`t4SpecWithoutK(...)`; 1842 `t5Spec(...)`; 1980 `t6Spec(...)`). Certification:
CONF-CORE in-scope tests among §10 — totals stay 144/33. **Checks:** as Task 5's.

### Task 12 — Ledger conversion: §10.4

`section-10.4.ts` (762 `scSpec(...)` through a `write()` closure over mutable version
variables — enumerate the versions in order into a record table, Task 5's rule; 886
`pcSpec(...)`; 1023 — read; 1143 `mcSpec`; 1231 `ciSpec`; 1323 `urSpec`; 1591, 1642,
1657 `t2Spec`; 1706, 1784 `t2cSpec`; 1866 `t2oDSpec`; 1970 `t2oTSpec`, 1971 `t2oDSpec`;
2095, 2167 `t3Spec`; 2490 `T4R_WITHOUT_CHILD`; 2791 — read; 2997 `t5Spec`). T10.4-5 is
CONF-CORE in scope (VIOL-CORE-PERSISTREADS certifies it) — totals stay 144/33.
**Checks:** as Task 5's.

### Task 13 — Ledger conversion: §10.5 and §10.6

`section-10.5.ts` (496 `s15Spec`; 635 — read; 756 `ySpec`; 938 — read; 1206 `N_CURRENT`
(1207 `N_CODE` is `.ts`); 1636 `oASpec`, 1637 `oBSpec`, 1669; 1865, 1921, 2115 — read;
2192, 2283 `vSpec`; 2422, 2473 `c6Spec`) and `section-10.6.ts` (819 `b2Spec`; 1067, 1266
`rSpec`). **Checks:** as Task 5's.

### Task 14 — Ledger conversion: §10.7-i

`section-10.7-i.ts` (638 — read; 983, 984, 1160 `leafSpec(...)`; 1300 `c3Spec`; 1587,
1645 `c4KSpec`; 1733 `c5Spec`; 2080 `c6Spec`; the config and session sites are not
`.mdx`). **Checks:** as Task 5's.

### Task 15 — Ledger conversion: §10.7-ii

`section-10.7-ii.ts` (1168 `n7PbSpec`; 1680 `e8Spec`; 1807, 2001 `s9Spec`; 2133, 2265
`s9HSpec`; 2526 `r10Spec`; 2684 `c11DSpec`; 3036, 3056 `m12Spec`; 3614, 3661 `b12Spec`;
1169/3037/3038 are `.ts`). **Checks:** as Task 5's.

### Task 16 — Ledger conversion: §11, §12.0, §12.7

`section-11.2.ts` (1569 `NU_PATH_BYTES, NU_SOURCE` — a byte path: convert if `.mdx` and
after an invocation), `section-11.3.ts` (2039 `EMPTY_HOLDER_SOURCE`), `section-11.5.ts`
(1464 byte path — read), `section-11.6.ts` (1651, 1768 — read; the session sites are
not `.mdx`), `section-12.0-ii.ts` (296 `storyASource(...)`; 835, 1339
`corruptWorkspace.file(` — read; 2313 `gitroSource(...)`), `section-12.7.ts` (895, 896,
1654 byte paths — read; 1319 `UR_SOURCE`; 3053 the inline `'<S id="a">…'` literal).
T11.2-4/T11.4-* are CONF-AVAIL in scope if any of their sites is touched — totals
stay 144/33. **Checks:** as Task 5's.

### Task 17 — Ledger conversion: §12.1–§12.2

`section-12.1-12.2.ts` (597 `sourceBytes` — computed in the body: hoist to a record if
it derives from module constants alone; 688, 706, 878, 1160, 1534 the `FAILED_BUILD_*`
constants; 879, 1024, 1124, 1345 — read; 1504, 1559 `editedSource` — computed in the
body: hoist; 1809 `T12_2_4_L_INVALID` (a top-level helper) and 1934 `T12_2_4_L_VALID`;
the tampered generated-module, link-target, journal, and config sites are not
`.mdx`). CONF-VALID/CONF-MD in-scope tests may live here — totals stay 144/33.
**Checks:** as Task 5's.

### Task 18 — The undeclared-staging guard (last: after every conversion)

**Requirement.** S-9's timing clause (Task 5) is met only while every post-invocation
`.mdx` staging is a ledger record; nothing enforces that a future staging joins the
ledger. This guard makes an omission a harness error at the first run that reaches
the site (the same bounded surfacing the builder's own check has), so the ledger's
completeness is regression-guarded rather than trusted to enumeration.

**Change.**
1. A workspace learns that the product was invoked in it: `runProduct` and
   `startProduct` (`test/helpers/subprocess.ts`, the one H-2 capture path) note the
   invocation's `cwd` through a small registry of live workspace roots (register on
   `TestWorkspace.create`, unregister on `dispose`; match `cwd` equal to a root or
   inside one, comparing both the root and its realpath) — or, if a cycle-free
   import is impractical, have the registry's common invocation helpers
   (`support.ts` `runCli`/`expectExit`/`runJson`/`runFindingsReport`) and every direct
   `runProduct`/`startProduct` call site in `test/suite/` mark the workspace; the
   subprocess-level variant is preferred because it cannot be bypassed.
2. `TestWorkspace.file()` on an `.mdx` path after such an invocation, with plain
   contents (no `StagedMdx` record) and an effective declaration that is neither
   `"unchecked"` (P-8's mutations) nor the new per-draw marker below, throws
   `HarnessStagingError` of a new mode (`undeclared-staging`) naming the path and the
   rule (Task 5's).
3. Per-draw marker: property modules stage draws after invocations
   (`section-16-p4.ts` ~2239/2267, `section-16-p5-p6.ts` ~788, `section-16-p9.ts` ~1011)
   whose sources `checkProperty`'s `mdxSources` judged before the body ran (S-9's
   property clause). Add a `MdxFileDeclaration` member (e.g. `"per-draw"`) meaning
   "well-formed; judged per draw by the property runner; exempt from the guard" —
   the builder still judges it as well-formed at staging — and pass it at exactly
   those call sites; the helper header documents that it is never used outside
   `section-16-*.ts`. `section-16-p8.ts` keeps `"unchecked"`.
4. Any site the guard reveals (a body or helper staging `.mdx` after an invocation
   without a record) is converted under Task 5's rule in this same task.

**Checks.** `npx tsc -p test`; the self project green in the namespace, certification
totals 144/33 with no error (an in-scope test reaching an undeclared staging against
its conformer would surface here — convert it); the full suite against the built
product reports no `undeclared-staging` harness error (every currently reachable
site is declared; sites behind diagnosed product failures surface when the product
reaches them — the guard's intended bounded behavior). Red check: in a scratch copy
of one converted module whose test passes against the built product, replace one
record with its plain source, run that test alone, read the `undeclared-staging`
diagnosis, restore. Record the guard, its error mode, and the per-draw marker in
`AGENTS.md`.
