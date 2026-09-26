# FIX_PLAN — Phase 9 (test harness), from the sixth compliance determination

Written at harness commit a2fa780 (branch `claude/xspec-ui-apis-4df8fa`), the first
compliance determination after the third plan's exhaustion (that plan: 1c28596 +
9c35276, executed to a2fa780; `git show dd667c8:specs/tmp/FIX_PLAN.md` holds its final
preamble — the ledger's conversion rule with every resolved sub-rule and per-task
finding — and `AGENTS.md` its run facts). Documents unchanged since 3265b20
(`git diff --stat 3265b20..HEAD -- specs/` empty). Governing IP:
`specs/patches/0001-external-ui-apis.md` (Stage: Tested; no stage change). Bundle:
`specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`.

## Preamble — read before any task

**Scope guards (Phase 9).** Never modify product code (`src/`). Every task below is
harness work under `test/` (plus `AGENTS.md`'s build/run facts). Harness self-tests and
certification MUST pass after every task; product tests MAY fail — as diagnosed
assertion failures only, never a harness crash, hang, error, or false pass (H-8). No
task changes what any product test asserts: a conversion stages byte-identical files
and leaves every verdict unchanged.

**Known state at a2fa780.** Self project: 22 files, 2326 passed, 0 skipped under
`unshare --map-user=1000 --map-group=1000 -- npm run test:self`. Certification pairs:
144 PASS / 33 FAIL / 0 error / 0 hang, exactly as CERTIFICATIONS.md documents
(5 conformers, 18 violators; the totals are summed over the `certification run against`
lines of the self run — AGENTS.md). Full suite against the built product: 337 tests,
82 failed, 255 passed — the 82 are the diagnosed product failures allowed at this phase
(recorded in the latest commit messages and AGENTS.md's per-task bullets; they need no
plan task; each conversion task names the ones in its modules, because a failing body's
later sites are reached by no run). The S-9 ledger self-test
(`test/self/s9-staged-sources.test.ts`): 187 tests over 167 records. Environment facts
live in `AGENTS.md` and are not repeated here: root sandbox → unprivileged user
namespace for the self project; the self project and a suite run never concurrently;
foreground `sleep` blocked; escape spellings built from code points and verified
byte-wise; the stand-in wrapper red/green-check pattern; the single-test filter
`-t '<ID> '` (trailing space); the diagnostic-variant and mutation red-check recipes;
the staged-bytes sha256 identity recipe (the temporary `write()` capture hook); the
certification-total summation recipe; `npx vitest list --config test/vitest.config.ts
--project self test/self/s9-staged-sources.test.ts | grep '> T'` for the ledger's
record names; a registry module's header comment ends with a blank line before the
first `import type {` line.

**The finding this plan closes (reviewer C, gaps 1 and 2; judged against the current
text).** TEST-SPEC §17 S-9: the well-formedness check "runs before any product exists
for the deterministic fixtures". The initial `.mdx` files of a workspace a registered
body creates AFTER its first product invocation — a later arm's `withWorkspace(...)` /
`TestWorkspace.create(...)`, a helper-created workspace (`stageConfigurationStateTwins`,
`prepareRefusalWorkspace`'s H-6 twin, a per-arm helper such as `runStructuralArm`) —
are deterministic fixture files, yet `TestWorkspace.create` stages them through
`stageInitial` (`test/helpers/workspace.ts`), which the undeclared-staging guard does
not cover; `WorkspaceDecl.files` takes plain `FileContents` only (no record can stand
there, so the ledger self-test never sees them); and S-7's sweep never reaches them
(the body fails at its first invocation against the stub). They are therefore first
judged at suite time, against a real product — the same shortfall the previous
determination found for post-invocation `file()` stagings, in the class the previous
plan's preamble ("Reach") explicitly left for this determination. The reviewers'
instrumented run logged 341 distinct (test, path) pairs across 121 tests reachable
against the built product; the sites behind the 82 diagnosed failures are reached by
no run. Gap 2 is the same clause for the §18 E-6 fixture: `runE6RepresentativeFixture`
(`test/helpers/e6.ts`) stages `specs/Other.mdx` (`otherSource("version one")`),
`specs/Core.mdx` (`E6_CORE_SOURCE`), and `specs/Refs.mdx` (`E6_REFS_SOURCE`) as plain
initial files; the fixture is no registry entry, so nothing judges them before the
built product does. Both gaps stand under the current text. Reviewer A's cross-scope
observation (c) and reviewer B's "standing observation" are this same class and need
no separate task. What closes it, in the harness's own terms: `WorkspaceDecl.files`
accepts a `StagedMdx` record (staged under the record's declaration, as `file()`
does); every flagged entry becomes a record; the E-6 sources become records; and,
last, `stageInitial` joins the guard under the per-body mark, so any future omission
is a harness error at the first run that reaches it.

**Order, and where the guard extension goes (the decision this plan records).** The
guard extension (Task 24) comes LAST, after every conversion, exactly as the previous
plan's Task 18 did. Extended earlier, `stageInitial`'s refusal would turn every
unconverted flagged entry into a `HarnessStagingError` at suite time — 121 tests
reporting a harness error instead of their verdicts, violating H-8 mid-plan — and,
since the certification runner runs fixture bodies under the same per-body mark, the
flagged tests in certification scope (T1.3-2, T1.3-4, T1.3-5, T1.3-6, T1.4-1, T1.4-4
for CONF-VALID; T3-6 for CONF-MD; T7-4, T7-6 for CONF-DISC; T11.2-4 for CONF-AVAIL;
T13.5-4, T13.5-8 for CONF-CORE) would error against their conformers and break the
144/33 totals every task must keep. No form of the extension "cannot fire" before the
conversions without an allowlist coupling the guard to conversion progress, so none is
introduced early; instead every conversion task verifies its own modules with the
temporary sites hook below (the reviewers' instrumentation, reproduced), and Task 24's
full-suite run is the decisive check. Tasks 1–3 build the mechanism, close gap 2, and
cover the §16 draws; Tasks 4–23 convert module by module, in order (independent of
each other except that Task 22 precedes Task 23); Task 24 last.

**Loop conventions.** One task per Engineer spawn, in order. On completing a task: run
the checks it names, update `AGENTS.md` with anything new about building, linting, or
running (and the per-task run facts, as the previous plan's bullets did), remove the
task from this file (record in the preamble any sub-rule the task had to resolve — the
next Engineer reads it), commit as `sdg(phase-9): <imperative summary>`, push
(`git push -u origin claude/xspec-ui-apis-4df8fa`, retrying on network errors with
backoff 2s, 4s, 8s, 16s). When the last task is removed, delete this file (leave
`specs/tmp/.gitkeep`). Commit messages end with the two trailer lines the spawn prompt
gives. Never merge or fetch `main`. Check `git status` / `git log -1` before editing and
before pushing; the scratchpad is shared across spawns and holds stale files (the
reviewers' instrumented harness copy under `hookrun/` is NOT the repository).

## The conversion rule, extended to initial files (governs Tasks 3–23)

**Carried over, in force** (the previous plan's preamble, `git show
dd667c8:specs/tmp/FIX_PLAN.md`, is the authority for anything not restated here): every
`file()` call staging an `.mdx` path that a registered body or a helper it calls makes
after a product invocation passes a ledger record — created at module top level from
the SAME expression (moved, never re-spelled; staged bytes identical), named
`"<TEST-ID>[/<TEST-ID>…] <what it stages>"`, carrying the declaration in effect for that
write. Reach is judged per body, against the body's FIRST product invocation, in
whatever workspace it happens (`gitInit`/`gitCommitAll` invoke no product; a compiled
consumer program, a certification fixture, or the stub does). A helper's staging is
judged under every calling body. A shared constant is one record named with every
calling test's ID. Alternations and `write()` closures enumerate into records or
`as const` tuples. Byte paths convert like string paths. Non-`.mdx` stagings stay. A
module's own replace helper keeps its diagnosis and calls `edit()`. Product-written
bytes go through anchored `edit()`; fresh-workspace seedings of product-written files
through `copyFrom()`. The declaration rule (the plan before's post-Task-3): every
declared-unparseable staging is marked `unparseable` (on the record, or
`mdx.unparseable` / `{ mdx: "unparseable" }` for a plain staging), and every
early-error form names its S-9 allowance.

**The extension (Task 1 builds it; Tasks 4–23 apply it).** Every `.mdx` entry of the
`files` map of a workspace created — by the body or by a helper it calls — AFTER the
body's first product invocation becomes a ledger record, passed as the entry's value:
`files: { "specs/A.mdx": T1_3_2_ARM_X_A }` with
`const T1_3_2_ARM_X_A = stagedMdx("T1.3-2 arm x specs/A.mdx", <the same expression>)`
at module level. The record carries the declaration that governs the entry today: the
workspace declaration's entry for the path (`mdx.unparseable` → `"unparseable"`;
`mdx.allowances[path]` → `{ allowances }`), else well-formed; that path is then REMOVED
from the workspace declaration (`create()` treats a record entry whose path the
declaration also names as a contradiction and throws, exactly as `file()` treats an
`mdx` option beside a record). An entry declared `unchecked` stays plain (a record is
never `unchecked`; the guard exempts it). A draw-derived entry of a §16 property module
is declared `perDraw` (Task 3), never a record. The one sub-rule this supersedes: a
constant serving both an initial `files` entry and a later `file()` no longer fills the
entry through `.source` — the entry takes the record itself (convert every existing
`.source` fill you meet in a module you are converting; byte-identical by
construction). The initial files of a body's FIRST workspace — created before any
product invocation — may stay plain (S-7's sweep reaches them against the stub);
converting them is neither required nor forbidden, but spend no iteration on it.

**Shapes, and how each converts (all occur in the flagged modules):**
- A body-local literal or template call in a `files` map (a later arm's
  `withWorkspace({ files: { "specs/A.mdx": spec("...") } })`): the expression moves to
  a module-level record; the entry names the record.
- A module-level arm/scenario table whose rows hold `files` maps or the parts a helper
  composes a source from (`section-1.3.ts`'s structural arms — `runStructuralArm`
  stages `arm.prefix + arm.construct + arm.suffix` as `specs/A.mdx` through
  `findingsOf`; `section-7.4-7.5.ts`'s move arms; `section-14.ts`'s `RangeRuleCase`
  tables): the entry's expression is wrapped IN PLACE —
  `"specs/A.mdx": stagedMdx("T1.3-2 arm <row key> specs/A.mdx", <expression>)` — or the
  row gains a `source: StagedMdx` field computed in place from its parts (the parts
  kept where assertions use them, e.g. `byteWindow(arm.prefix, arm.construct)`), the
  helper staging the record; it is already module level, so nothing moves; the table's
  `files` type widens to the record-accepting type. Rows whose workspace precedes the
  body's first invocation (a table's first row, when the body iterates it from a fresh
  start) may stay plain; converting the whole table uniformly is acceptable and usually
  simpler — say which in the commit message.
- A template function called with body-local state, or a `files` map a function builds
  at run time from body-local arguments: enumerate the calls, in order, into a
  module-level record table (`as const` tuple), the body indexing through it — never
  reorder or re-spell (the previous plan's Task 12 form).
- A shared base map spread into several workspaces (`...BASE_FILES`): the base map's
  `.mdx` entries become records once (named with every calling test's ID, in ID order);
  the spreads stay.
- A helper that creates workspaces from a `files` map its callers pass
  (`stageConfigurationStateTwins(files)` in `support.ts`; `prepareRefusalWorkspace` and
  `completeOnTwin` over `RefusalFixture.decl` in `write-refusal-staging.ts`; per-arm
  helpers): the helper's parameter type is (or becomes, Task 1) record-accepting; the
  CALLER's map entries convert, judged under the calling body. The twin of the H-6
  protocol is always post-invocation (the original was built first), so a
  `RefusalFixture.decl`'s `.mdx` entries are records named with every test that
  prepares that fixture.
- An `UnparseableStaging` (`support.ts`) exported by a §2 home module and re-staged by
  T14-11 (`T14_11_REASSERTED_STAGINGS`, `section-14.ts` ~4479): Task 22 alone converts
  these four exports, T14-12's arm stagings, and their consumer (`reassertedCase`'s
  `mdx: { unparseable: [file] }` goes when the entry is a record) — Task 5 leaves them
  plain and lists them as expected remaining lines of its sites check.
- A `.source` fill (`"specs/A.mdx": SOME_RECORD.source`): the record itself.
- A byte path cannot be a `files` key; a key spelled with U+FFFD (T1.5-2's
  `specs/A<U+FFFD>.mdx`, a name any filesystem holds) is an ordinary string key and
  converts like any other.
- A constant a self-test imports as a string (`test/self/s9-fixture-well-formedness.test.ts`
  judges composed forms exported by `section-6.5*.ts`): keep the exported constant and
  create the record FROM it (`stagedMdx(name, CONSTANT)`), so the self-test's import
  is untouched.

**Naming.** `"<TEST-ID>[/<TEST-ID>…] <workspace or arm> <path>"`, unique across the
registry (a duplicate name throws at module load — the first self-test run tells you):
one test staging the same path in several workspaces names each by its arm, scenario,
or state (`"T6.5-2 arm (c) specs/B.mdx"`); identical bytes one test stages at several
sites are ONE record staged at each; an existing record whose bytes and declaration
equal a new entry's is reused, never duplicated. The self-test checks every leading ID
names a registered test (or `E-6`).

**Where a task touches a shared helper.** `test/helpers/workspace.ts` (Tasks 1 and 24
only), `test/helpers/staged-mdx.ts` (Task 1 only, header text), `test/helpers/e6.ts`
(Task 2 only), `test/helpers/product-invocations.ts` (untouched),
`test/suite/registry/support.ts` (Task 1: `stageConfigurationStateTwins`'s parameter
type; Task 22: `UnparseableStaging.files`), `test/suite/registry/write-refusal-staging.ts`
(Task 21: the `RENAME_FIXTURE` / `MOVE_FIXTURE` decls), `test/helpers/property.ts`
(Task 3, only if a `mdxSources` gap is found). A conversion task never edits a helper
except where its text says so; if a module's conversion seems to need a helper change,
record the need in this preamble and stop at what the task allows.

**Certification scope (`test/self/certification-fixtures.ts`'s `inScope` lists).**
CONF-CORE: T6.1-2, T10.4-5, T13.4-5, T13.5-1, T13.5-2, T13.5-3, T13.5-4, T13.5-5,
T13.5-8. CONF-VALID: T1.3-1, T1.3-2, T1.3-3, T1.3-4, T1.3-5, T1.3-6, T1.4-1, T1.4-2,
T1.4-4, T2.6-1, T2.6-2, P-1. CONF-MD: T3-1, T3-2, T3-3, T3-4, T3-5, T3-6, P-2, P-3.
CONF-DISC: T7-4, T7-5, T7-6. CONF-AVAIL: T11.2-2, T11.2-4, T11.3-4, T11.4-1, T11.4-3,
T11.4-4. A conversion cannot change a verdict (byte identity), so the totals stay
144/33 by construction; a task touching an in-scope test runs the self project
(certification included) and confirms 144 PASS / 33 FAIL / 0 error / 0 hang — an
`error` there is a conversion mistake (a record whose declaration contradicts its
bytes, a duplicate name, a mis-staged path), never accepted.

## Recipes — the checks after each conversion task (Tasks 3–23)

1. `npx tsc -p test`; `npm run format:check` (`npm run format` if it complains).
2. The self project green in the namespace (`unshare --map-user=1000 --map-group=1000
   -- npm run test:self`, ~2–3 min; never beside a suite run): the ledger self-test
   lists the module's new records (`npx vitest list … | grep '> T'`, AGENTS.md), each
   judged; certification 144/33/0/0 (sum the `certification run against` lines).
3. The sites hook (temporary, uncommitted — the reviewers' instrumentation,
   reproduced): as the first statement of `TestWorkspace.stageInitial`
   (`test/helpers/workspace.ts`) add
   `if (process.env.P4_SITES !== undefined && isMdxPath(rel) && !(contents instanceof StagedMdx) && productInvokedInBody() !== undefined) appendFileSync(process.env.P4_SITES, productInvokedInBody() + "\t" + rel + "\n");`
   (`appendFileSync` from `node:fs`; the other names are already imported there). Run
   the task's suite files BEFORE converting with the variable set —
   `P4_SITES=<scratch>/sites-before.log unshare --map-user=1000 --map-group=1000 -- npx vitest run --config test/vitest.config.ts --project suite <file-substring…> --reporter=verbose > <scratch>/before.log 2>&1`
   — and `sort -u` the log: it must reproduce the task's reachable-site list (the same
   run, module-local; a difference is a line to re-judge, never a reason to skip it).
   After converting, run again: the log holds only the lines the task names as
   expected remainders (`unchecked` entries, `perDraw` entries, entries deferred to
   another task) — anything else converts before the task is done. Then restore the
   helper (`git checkout test/helpers/workspace.ts`; `git diff --stat` shows only the
   task's modules).
4. Byte identity: AGENTS.md's sha256 capture recipe (the temporary `write()` hook)
   over the same suite files before and after — the two logs `diff` clean (every write,
   initial entries included, identical bytes) — and every test of the task's modules
   gives its recorded verdict (the passing ones pass; the failing ones fail as the same
   diagnosed `HarnessAssertionError`: compare the failure lines of `before.log` and
   `after.log`). A record site behind a diagnosed failure is not reached — accepted;
   Task 24's guard surfaces it when the product gets there; judge such sites by reading
   the body (each task lists its failing tests).
5. Read-based enumeration for the unreached: every `TestWorkspace.create(`,
   `withWorkspace(`, `stageConfigurationStateTwins(`, `prepareRefusalWorkspace(` /
   `completeOnTwin(`, and per-arm helper call in the module, judged against its body's
   first invocation; list in the commit message the sites converted, the ones left
   plain (with the reason: first workspace, `unchecked`, deferred), and the records
   added (count).

## Site lists

Each conversion task carries the reviewers' per-test list of initial `.mdx` entries
logged under the per-body mark in the full run against the built product — one line
`<module> — <ID> (<n>): <paths>`; the whole list is also at
`<scratchpad>/hookrun/sites.txt` while that directory lasts. A listed path is one site
per workspace it appears in (a test staging `specs/A.mdx` in three later arms has three
sites under one listed path); the list is what the sites hook must reproduce before
conversion. Tests the list does not name may still hold post-invocation creations
behind a diagnosed failure or in an arm the built product never reaches — recipe 5.

## Tasks

### Task 1 — `WorkspaceDecl.files` accepts a staged-source record; `perDraw` at creation; self-tests

**Requirement.** TEST-SPEC §17 S-9's timing clause (the preamble's finding): an initial
`.mdx` file of a workspace created after the body's first invocation must be judged
before any product exists, which only a ledger record is. Nothing here changes any
test's behavior: the mechanism, its self-tests, and the type widenings alone.

**Change** (`test/helpers/workspace.ts`, `test/helpers/staged-mdx.ts` header,
`test/self/s9-staged-sources.test.ts`, `test/self/s9-undeclared-staging.test.ts`,
`test/suite/registry/support.ts`):
1. `export type InitialFileContents = FileContents | StagedMdx` (name it as you like;
   the tasks below say "the record-accepting type");
   `WorkspaceDecl.files: Readonly<Record<string, InitialFileContents>>`. In `create()`
   an entry that is a `StagedMdx` stages the record's bytes under the record's
   declaration exactly as `file()`'s record branch does (`stageInitial` gains the
   branch): a record at a non-`.mdx` key throws `HarnessStagingError("mdx-derivability",
   …)` with `file()`'s wording; a record whose key the workspace declaration names
   (`mdx.unparseable`, `mdx.unchecked`, `mdx.allowances`, or the new `mdx.perDraw`)
   throws the contradiction with `file()`'s wording ("drop the declaration entry (or
   change the record)"); a refusal leaves no temporary directory (`create()`'s existing
   catch). A plain entry stages exactly as today. Do NOT extend the guard here
   (Task 24).
2. `WorkspaceMdxDecl.perDraw?: readonly string[]` — paths whose initial contents are a
   property draw the runner judged (`helpers/property.ts` `mdxSources`; S-9's property
   clause): `resolveMdxDeclaration` maps them to the `per-draw` declaration, so they
   are judged well-formed at staging and exempt from the guard (today's `file()` guard,
   and Task 24's); a path in more than one list throws as today; the type's comment
   says it is the section-16 modules' alone, like `per-draw`.
3. `support.ts`: `stageConfigurationStateTwins(files: Readonly<Record<string,
   InitialFileContents>>)` (its `"xspec.config.ts" in files` check unchanged). Leave
   `UnparseableStaging.files` to Task 22.
4. Headers: `workspace.ts`'s module header and `stageInitial`'s comment ("the standing
   observation"), and `staged-mdx.ts`'s "What is NOT a ledger record: the initial files
   of a workspace declaration" — an initial file of a workspace created after the
   body's first invocation IS a record (the guard extension follows in Task 24); a
   body's first workspace's may stay plain.
5. Self-tests. In `s9-staged-sources.test.ts` (the "builder stages a record's bytes
   under the record's declaration" describe, or a sibling): a record in `files` stages
   its bytes (read back equal); a well-formed record and an `unparseable` record each
   stage under its own declaration (a deriving source under an `unparseable` record
   makes `create()` throw `mdx-derivability`); a record at a non-`.mdx` key throws; a
   record beside a declaration naming its path throws; `mdx: { perDraw: [A] }` judges
   well-formed at creation (an ill-formed `perDraw` entry throws `mdx-derivability`). In
   `s9-undeclared-staging.test.ts`: after an invocation, a `file()` on a `perDraw`-listed
   path with plain contents passes the guard (judged well-formed), and `create()` with a
   record entry inside a body that has invoked passes (the guard extension is Task 24's,
   but the record path must already be clean). Red-check one new assertion by mutation
   (AGENTS.md's recipe).

**Checks.** `npx tsc -p test`; `npm run format:check`; the self project in the namespace
(22 files, the count up by the new tests, certification 144/33/0/0);
`unshare … -- npx vitest run --config test/vitest.config.ts --project suite section-12.1-12.2.test -t 'T12.1-3 '`
and `… section-10.1.test -t 'T10.1-1 '` still give their recorded verdicts — nothing in
the suite changed. Record the new form (the record-accepting `files`, `perDraw`) in
AGENTS.md.

### Task 2 — E-6: the fixture's three initial sources become ledger records

**Requirement.** Reviewer C gap 2 (S-9 with §18 E-6): `specs/Other.mdx`
(`otherSource("version one")`), `specs/Core.mdx` (`E6_CORE_SOURCE`), `specs/Refs.mdx`
(`E6_REFS_SOURCE`) in `runE6RepresentativeFixture` (`test/helpers/e6.ts` ~213–223) are
judged only when `test/suite/e6-exchange-writer.test.ts` (Linux) or
`test/windows/e6-byte-identity.test.ts` (Windows) runs against the built product.

**Change** (`test/helpers/e6.ts`, `test/self/s9-staged-sources.test.ts`). Beside
`E6_OTHER_VERSION_TWO` register `E6_OTHER_VERSION_ONE = stagedMdx("E-6 specs/Other.mdx
version one", otherSource("version one"))`, `E6_CORE_RECORD = stagedMdx("E-6
specs/Core.mdx", E6_CORE_SOURCE)`, `E6_REFS_RECORD = stagedMdx("E-6 specs/Refs.mdx",
E6_REFS_SOURCE)` — the same expressions; keep the string constants where the module
uses them elsewhere (the exchange comparison, if it does) — and pass the records in
the fixture's `files`. The self-test's E-6 pin becomes exactly FOUR E-6-led records
(`expect(e6Records).toBe(4)`; its title's "for its one record" → "for its four
records"); the import order (`../helpers/e6.js` BEFORE the registry manifest) is
unchanged and still load-bearing — a record created after the seal throws. `src/app.ts`
and `xspec.config.ts` are not `.mdx` and stay plain. The Windows leg shares this code
path: the bytes are identical, so the exchange artifact's byte identity holds and
`suite-windows` stays green on push (you cannot see CI — no `gh`, no api.github.com;
the shared code path and the sha256 check below are the proof).

**Checks.** `npx tsc -p test`; `npm run format:check`; the self project (the ledger
self-test lists four `E-6 …` records: 190 tests over 170 records; certification
144/33/0/0); `unshare … -- npx vitest run --config test/vitest.config.ts --project suite e6-exchange-writer`
— the same verdict as before the change (run it before too); AGENTS.md's sha256
capture over that file before and after: identical writes. AGENTS.md: the E-6 record
count and the pin.

### Task 3 — §16: draw-derived initial files declared `perDraw`; constant ones as records

**Requirement.** The property modules create workspaces per trial
(`section-16-p1.ts` ~676, `section-16-p2-p3.ts` ~1964/1966/2110, `section-16-p4.ts`
~2183/2185, `section-16-p7.ts` ~749/1128 — check every `TestWorkspace.create(` in
`section-16-*.ts`, P-8 and P-10…P-13 included): from the second trial on the body has
invoked the product, so Task 24's guard would refuse their plain `.mdx` entries. S-9's
property clause already covers a draw: `checkProperty`'s `mdxSources` judges every
draw's sources before the body sees it (`property.ts` ~447/814/971), the initial trial
and every shrunk candidate.

**Change.** Every `.mdx` initial entry whose contents come from the draw is declared
`perDraw` (`mdx: { perDraw: [...] }` — the module knows its paths; where the map is
built by a function, derive the list from the map's `.mdx` keys with one small
module-local helper, or export `mdxPathsOf(files)` from `workspace.ts` — decide once,
say which in the commit message). Every `.mdx` initial entry that is a harness
constant (a fixed spec staged beside the draw) becomes a record (`"P-7 …"`). Before
declaring a path `perDraw`, VERIFY the module's `mdxSources` yields that path's contents
for every draw the body creates a workspace from; P-8, P-10, P-11 pass no `mdxSources` —
confirm they create no draw-derived `.mdx` workspace after their first invocation (P-8's
mutations are `unchecked`); if one does, add the `mdxSources` function to that
`checkProperty` call (the same rendering the body stages) and record it as a finding in
the preamble. Property modules never pass records for draws; `per-draw` never reaches a
record (the ledger refuses it).

**Checks.** Recipes 1–3 over `section-16-p1`, `-p2-p3`, `-p4`, `-p7` (and any other
module changed): the sites hook's "after" log holds exactly the `perDraw` entries (the
hook logs plain contents; name them as the expected remainders); the properties'
verdicts unchanged (P-1…P-5 fail diagnosed as before, at the same seed and shrink —
compare the failure lines; P-7 and the rest pass; a property module runs ~3–5 min in
the namespace); the self project green (the fixed-seed S-9 vector self-tests
unchanged). AGENTS.md: the `perDraw` form and which modules use it.
