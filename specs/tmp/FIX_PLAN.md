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

### Task 4 — Initial-file conversion: §1 (`section-1.1-1.2.ts`, `section-1.3.ts`, `section-1.4.ts`, `section-1.5.ts`, `section-1.6-1.7.ts`)

**Workspace creations to judge** (`withWorkspace(` / `TestWorkspace.create(` / helper
calls, per module): 1.1-1.2 (8), 1.3 (5 + `runStructuralArm` → `findingsOf` at ~69/164,
one workspace per arm row), 1.4 (5), 1.5 (6), 1.6-1.7 (10).
**Reachable sites (the instrumented run):**
- `section-1.3.ts` — T1.3-2 (1): specs/A.mdx
- `section-1.3.ts` — T1.3-4 (1): specs/A.mdx
- `section-1.3.ts` — T1.3-5 (2): specs/A.mdx specs/B.mdx
- `section-1.3.ts` — T1.3-6 (1): specs/A.mdx
- `section-1.4.ts` — T1.4-1 (1): specs/A.mdx
- `section-1.4.ts` — T1.4-4 (1): specs/A.mdx
- `section-1.5.ts` — T1.5-2 (2): specs/A�.mdx specs/OK.mdx
- `section-1.6-1.7.ts` — T1.6-1 (1): specs/A.mdx
- `section-1.6-1.7.ts` — T1.7-1 (1): specs/E.mdx
**Failing here (sites past the failure unreached — recipe 5):** T1.4-1, T1.4-4, T1.5-2,
T1.6-5, T1.7-2.
**Certification scope:** T1.3-1…T1.3-6, T1.4-1, T1.4-2, T1.4-4 (CONF-VALID) — run the
self project; 144/33/0/0.
**Notes.** The structural arm tables of `section-1.3.ts` compose `specs/A.mdx` from
`prefix + construct + suffix` (the shapes section's second bullet: a `source` record per
row, the parts kept for `byteWindow`); T1.5-2's Linux-leg byte path is already a
`file()` record — its `specs/OK.mdx` and the U+FFFD-spelled key are `files` entries of a
later workspace. Whole-table conversions are fine where a table's first row is the
body's first workspace.
**Checks.** Recipes 1–5 over `section-1.1-1.2.test`, `section-1.3.test`,
`section-1.4.test`, `section-1.5.test`, `section-1.6-1.7.test`.

### Task 5 — Initial-file conversion: §2 (`section-2.1.ts`, `section-2.2-2.3.ts`, `section-2.4.ts`, `section-2.5-2.6.ts`, `section-2.7.ts`)

**Workspace creations to judge:** 2.1 (11), 2.2-2.3 (11), 2.4 (10), 2.5-2.6 (9),
2.7 (10).
**Reachable sites (the instrumented run):**
- `section-2.1.ts` — T2.1-2 (7): docs/EXTRA.mdx specs/A.mdx specs/BASE.mdx specs/P1.mdx specs/P2.mdx specs/P3.mdx specs/P4.mdx
- `section-2.1.ts` — T2.1-3 (4): specs/A.mdx specs/B1.mdx specs/B2.mdx specs/BASE.mdx
- `section-2.1.ts` — T2.1-5 (1): specs/SELF.mdx
- `section-2.2-2.3.ts` — T2.3-3 (1): specs/A.mdx
- `section-2.4.ts` — T2.4-2 (2): specs/A.mdx specs/BASE.mdx
- `section-2.4.ts` — T2.4-3 (1): specs/A.mdx
- `section-2.4.ts` — T2.4-4 (2): specs/A.mdx specs/BASE.mdx
- `section-2.5-2.6.ts` — T2.5-3 (1): specs/A.mdx
- `section-2.5-2.6.ts` — T2.6-3 (1): specs/A.mdx
- `section-2.7.ts` — T2.7-1 (1): specs/A.mdx
- `section-2.7.ts` — T2.7-3 (1): specs/A.mdx
**Failing here:** T2.1-2, T2.3-3, T2.4-2, T2.4-5, T2.5-3, T2.6-1, T2.7-3, T2.7-4.
**Certification scope:** T2.6-1, T2.6-2 (CONF-VALID) — run the self project; 144/33/0/0.
**Notes.** T2.1-3 names its S-9 allowance (two imports binding one identifier in one
ESM block): the record carries `{ allowances: [...] }` and the path leaves
`mdx.allowances`. DEFERRED to Task 22 (leave plain, list as expected remainders of the
sites check): the four `UnparseableStaging` exports and every entry spread from their
`.files` — `T2_3_3_UNPARSEABLE_STAGING` (`section-2.2-2.3.ts` ~844; spread at ~1099),
`T2_4_2_UNPARSEABLE_STAGINGS` (`section-2.4.ts` ~511; ~620), `T2_7_3_SPREAD_UNPARSEABLE_STAGING`
(`section-2.7.ts` ~1406; ~1503), `T2_7_4_UNPARSEABLE_STAGINGS` (~2039). Every other
post-invocation entry converts here.
**Checks.** Recipes 1–5 over `section-2.1.test`, `section-2.2-2.3.test`,
`section-2.4.test`, `section-2.5-2.6.test`, `section-2.7.test`.

### Task 6 — Initial-file conversion: §3–§4 (`section-3.ts`, `section-4.ts`, `section-4.1-4.2.ts`, `section-4.3-4.4.ts`, `section-4.5.ts`, `section-4.6.ts`)

**Workspace creations to judge:** 3 (7), 4 (10), 4.1-4.2 (8), 4.3-4.4 (8; module
`withWorkspace` ~162), 4.5 (14; 2 records), 4.6 (6).
**Reachable sites (the instrumented run):**
- `section-3.ts` — T3-6 (2): specs/A.mdx specs/sub/B.mdx
- `section-4.ts` — T4-2 (2): specs/BASE.mdx src/NAME.mdx
- `section-4.3-4.4.ts` — T4.3-2 (1): specs/A.mdx
- `section-4.5.ts` — T4.5-2 (2): specs/MAIN.mdx specs/OTHER.mdx
- `section-4.5.ts` — T4.5-3 (1): specs/A.mdx
- `section-4.5.ts` — T4.5-4 (1): specs/A.mdx
- `section-4.5.ts` — T4.5-5 (1): specs/A.mdx
**Failing here:** T3-7, T4-2, T4-5, T4.4-1, T4.5-8, T4.5-9, T4.6-1, T4.6-3.
**Certification scope:** T3-1…T3-6 (CONF-MD) — run the self project; 144/33/0/0.
**Notes.** T4-2's `src/NAME.mdx` is an `.mdx` path to the builder wherever it lies —
a record. T4.5-8 names the two-imports allowance (as T2.1-3): `{ allowances }` on the
record.
**Checks.** Recipes 1–5 over `section-3.test`, `section-4.test`, `section-4.1-4.2.test`,
`section-4.3-4.4.test`, `section-4.5.test`, `section-4.6.test`.

### Task 7 — Initial-file conversion: §5 (`section-5.1-5.3.ts`, `section-5.4.ts`, `section-5.5.ts`, `section-5.6.ts`, `section-5.7.ts`)

**Workspace creations to judge:** 5.1-5.3 (4; `withWorkspace` ~89), 5.4 (5), 5.5 (8;
`withWorkspace` ~97; 16 records), 5.6 (7; 1 record), 5.7 (6).
**Reachable sites (the instrumented run):**
- `section-5.1-5.3.ts` — T5.3-1 (1): specs/A.mdx
- `section-5.4.ts` — T5.4-1 (1): specs/A.mdx
- `section-5.4.ts` — T5.4-2 (1): specs/A.mdx
- `section-5.5.ts` — T5.5-2 (1): specs/A.mdx
- `section-5.7.ts` — T5.7-2 (2): specs/BASE.mdx specs/MAIN.mdx
- `section-5.7.ts` — T5.7-4 (2): specs/A.mdx specs/B.mdx
**Failing here:** T5.5-5, T5.7-4.
**Certification scope:** none.
**Notes.** `section-5.4.ts`'s anchored `edit()` sites stay as they are; every T5.6-n
body stages its edits between `gitCommitAll("baseline")` and its first `buildOk`
(the previous plan's Task 8 finding) — judge its creations the same way (only
T5.6-4's arm 2 followed an invocation there).
**Checks.** Recipes 1–5 over `section-5.1-5.3.test`, `section-5.4.test`,
`section-5.5.test`, `section-5.6.test`, `section-5.7.test`.

### Task 8 — Initial-file conversion: §6.1–§6.3 (`section-6.1.ts`, `section-6.2.ts`, `section-6.3.ts`)

**Workspace creations to judge:** 6.1 (4), 6.2 (10), 6.3 (15; `withWorkspace` ~136;
3 records).
**Reachable sites (the instrumented run):**
- `section-6.1.ts` — T6.1-3 (2): specs/A.mdx specs/B.mdx
- `section-6.2.ts` — T6.2-3 (9): specs/Deps.mdx specs/Hall.mdx specs/Room.mdx specs/a.mdx specs/b.mdx specs/ca.mdx specs/cb.mdx specs/ea.mdx specs/eb.mdx
- `section-6.2.ts` — T6.2-4 (2): specs/Deps.mdx specs/a.mdx
- `section-6.3.ts` — T6.3-2 (1): specs/A.mdx
- `section-6.3.ts` — T6.3-4 (2): specs/A.mdx specs/Broken.mdx
- `section-6.3.ts` — T6.3-5 (3): inner/specs/A.mdx specs/A.mdx sub/specs/A.mdx
**Failing here:** T6.2-1, T6.2-2.
**Certification scope:** T6.1-2 (CONF-CORE) — run the self project; 144/33/0/0.
**Notes.** T6.2-3's nine-file workspace(s); T6.3-5's nested roots (`inner/specs/A.mdx`,
`sub/specs/A.mdx`) are `.mdx` paths like any other.
**Checks.** Recipes 1–5 over `section-6.1.test`, `section-6.2.test`, `section-6.3.test`.

### Task 9 — Initial-file conversion: §6.4 and §6.7 (`section-6.4.ts`, `section-6.7.ts`)

**Workspace creations to judge:** 6.4 (17; 1 record; a `stageConfigurationStateTwins`
caller; T6.4-7's H-6 fresh workspace seeded through `copyFrom` ~2415), 6.7 (3; 4
records).
**Reachable sites (the instrumented run):**
- `section-6.4.ts` — T6.4-2 (3): specs/Core.mdx specs/Other.mdx specs/Refs.mdx
- `section-6.4.ts` — T6.4-4 (7): docs/Stray.mdx specs/A.mdx specs/Anc.mdx specs/Bad.mdx specs/Broken.mdx specs/Dup.mdx specs/Solo.mdx
- `section-6.4.ts` — T6.4-5 (2): specs/Core.mdx specs/Target.mdx
- `section-6.7.ts` — T6.7-1 (2): specs/B.mdx specs/Watch.mdx
**Failing here:** T6.4-3.
**Certification scope:** none.
**Notes.** T6.4-7's fresh workspace: its `copyFrom` seedings stay (product-written
bytes); any `.mdx` entry in its initial `files` is a harness constant and converts;
its config/journal entries are not `.mdx`. The twins' file set passed to
`stageConfigurationStateTwins` converts under the calling body (its parameter is
record-accepting since Task 1).
**Checks.** Recipes 1–5 over `section-6.4.test`, `section-6.7.test`.

### Task 10 — Initial-file conversion: §6.5 (`section-6.5.ts`)

**Workspace creations to judge:** 29 (`withWorkspace` ~351; the exported record
`MOVE_PRECONDITION_BREAK`; T6.5-1's and T6.5-3's `copyFrom` seedings ~1655/~2614 stay;
a `stageConfigurationStateTwins` caller).
**Reachable sites (the instrumented run):**
- `section-6.5.ts` — T6.5-1 (7): specs/A.mdx specs/C.mdx specs/I.mdx specs/sub/A.mdx specs/w/A.mdx specs/w/C.mdx specs/y/I.mdx
- `section-6.5.ts` — T6.5-2 (8): specs/A.mdx specs/B.mdx specs/C.mdx specs/D.mdx specs/E.mdx specs/G.mdx specs/P.mdx specs/Zed.mdx
- `section-6.5.ts` — T6.5-3 (5): specs/Keep.mdx specs/Origin.mdx specs/Spare.mdx specs/Target.mdx specs/Third.mdx
- `section-6.5.ts` — T6.5-4 (4): specs/A.mdx specs/B.mdx specs/Other.mdx specs/Solo.mdx
- `section-6.5.ts` — T6.5-5 (8): docs/Stray.mdx specs/A.mdx specs/Anc.mdx specs/B.mdx specs/Bad.mdx specs/Broken.mdx specs/Dup.mdx specs/Solo.mdx
**Failing here:** T6.5-6, T6.5-7, T6.5-8, T6.5-9, T6.5-10.
**Certification scope:** none.
**Notes.** Keep the string constants `test/self/s9-fixture-well-formedness.test.ts`
imports (T6.5-2's composed forms) and create records from them. The module exports
constants to `section-6.6.ts`: a constant both modules stage post-invocation is one
record, created here and named with both IDs (the previous plan's Task 9 form).
**Checks.** Recipes 1–5 over `section-6.5.test` (the file alone runs several minutes).

### Task 11 — Initial-file conversion: §6.5-ii and §6.5-iii (`section-6.5-ii.ts`, `section-6.5-iii.ts`)

**Workspace creations to judge:** 6.5-ii (3), 6.5-iii (12 — T6.5-13's arms (b)–(l)
each `withWorkspace(arm.files, …)` from the `a13…` tables, reviewer A's pointer (c);
`a13DependentArm`).
**Reachable sites (the instrumented run):**
- `section-6.5-iii.ts` — T6.5-12 (2): specs/a.mdx specs/b.mdx
- `section-6.5-iii.ts` — T6.5-14 (2): specs/a.mdx specs/x.mdx
**Failing here:** T6.5-11 (ii); T6.5-13, T6.5-15, T6.5-16, T6.5-17, T6.5-18, T6.5-19
(iii) — most of these modules' sites are behind failures: recipe 5 is the main work.
**Certification scope:** none.
**Notes.** Keep the exported string constants the S-9 vector self-test imports
(T6.5-15…T6.5-19's composed forms) and make records from them; T6.5-13's arm tables
convert in place (one record per row per `.mdx` entry, named `"T6.5-13 arm (x) <path>"`).
**Checks.** Recipes 1–5 over `section-6.5-ii.test`, `section-6.5-iii.test`.

### Task 12 — Initial-file conversion: §6.6 (`section-6.6.ts`)

**Workspace creations to judge:** 25 (`withWorkspace` ~361; imports
`MOVE_PRECONDITION_BREAK` from 6.5).
**Reachable sites (the instrumented run):**
- `section-6.6.ts` — T6.6-2 (2): specs/Origin.mdx specs/Target.mdx
- `section-6.6.ts` — T6.6-3 (5): docs/Occ.mdx specs/A.mdx specs/B.mdx specs/Other.mdx specs/Solo.mdx
- `section-6.6.ts` — T6.6-4 (10): specs/Mv.mdx specs/Origin.mdx specs/Pal.mdx specs/Solo.mdx specs/Target.mdx specs/Third.mdx specs/User.mdx specs/a.mdx specs/b.mdx specs/x.mdx
- `section-6.6.ts` — T6.6-5 (4): specs/Mv.mdx specs/Pal.mdx specs/Solo.mdx specs/User.mdx
**Failing here:** T6.6-3, T6.6-4.
**Certification scope:** none.
**Checks.** Recipes 1–5 over `section-6.6.test`.

### Task 13 — Initial-file conversion: §7 basics, discovery, §7.1–§7.3 (`section-7-basics.ts`, `section-7-discovery.ts`, `section-7.1-7.3.ts`)

**Workspace creations to judge:** basics (15), discovery (15), 7.1-7.3 (13).
**Reachable sites (the instrumented run):**
- `section-7-basics.ts` — T7-1 (1): specs/A.mdx
- `section-7-basics.ts` — T7-2 (1): specs/A.mdx
- `section-7-basics.ts` — T7-3 (1): specs/A.mdx
- `section-7-discovery.ts` — T7-4 (7): bytes/x.mdx bytes/é.mdx bytes2/é.mdx ctl/C.mdx specs/A.mdx specs2/B.mdx sub/specs/B.mdx
- `section-7-discovery.ts` — T7-6 (4): notes/N.mdx other/unlisted.mdx specs/A.mdx specs/sub/B.mdx
- `section-7.1-7.3.ts` — T7.1-1 (1): specs/A.mdx
- `section-7.1-7.3.ts` — T7.3-1 (2): specs/A.mdx specs/sub/B.mdx
**Failing here:** T7-1, T7-2, T7-3, T7-4, T7.3-1.
**Certification scope:** T7-4, T7-5, T7-6 (CONF-DISC) — run the self project;
144/33/0/0. T7-5 is neither flagged nor failing: its creations need only the read
check.
**Notes.** A noise file no discovery reaches that is declared `unchecked` (check
T7-6's `other/unlisted.mdx`) stays plain and is an expected remainder; a key with a
non-ASCII but valid-UTF-8 name (`bytes/é.mdx`) converts like any other; files staged
OUTSIDE the root by `stageBesideRoot` are not workspace stagings and stay.
**Checks.** Recipes 1–5 over `section-7-basics.test`, `section-7-discovery.test`,
`section-7.1-7.3.test`.

### Task 14 — Initial-file conversion: §7.4–§7.5 (`section-7.4-7.5.ts`)

**Workspace creations to judge:** 12 (T7.5-5's twenty paths come from module-level
move-arm tables: wrap in place).
**Reachable sites (the instrumented run):**
- `section-7.4-7.5.ts` — T7.4-1 (5): aux/X.mdx bnd/B.mdx dualspec/D.mdx specs/A.mdx tgt/T.mdx
- `section-7.4-7.5.ts` — T7.5-1 (5): aux/X.mdx dualspec/D.mdx pol/P.mdx specs/A.mdx tgt/T.mdx
- `section-7.4-7.5.ts` — T7.5-2 (2): hi/H.mdx lo/L.mdx
- `section-7.4-7.5.ts` — T7.5-4 (6): pol/P.mdx specs/B.mdx specs/C.mdx specs/D.mdx specs/inner/A.mdx tgt/T.mdx
- `section-7.4-7.5.ts` — T7.5-5 (20): grp/abc/F.mdx m/good.mdx m/wrong.mdx pre/S.mdx pre/a$x.mdx pre/aQx.mdx pre/ax.mdx pre/d/ex.mdx pre/x.mdx tgt/P.mdx tgt/T.mdx tgt/a.mdx tgt/abc.mdx tgt/c.mdx tgt/t$0.mdx tgt/t$z.mdx tgt/t0.mdx tgt/tQz.mdx tgt/tb.mdx tg
**Failing here:** T7.4-1, T7.5-1.
**Certification scope:** none.
**Checks.** Recipes 1–5 over `section-7.4-7.5.test`.

### Task 15 — Initial-file conversion: §8, §9, §9.3, §10.1–§10.3 (`section-8.ts`, `section-9.ts`, `section-9.3.ts`, `section-10.1.ts`, `section-10.2-10.3.ts`)

**Workspace creations to judge:** 8 (9; 1 record), 9 (8; 2 records), 9.3 (5; 1 record;
`editSourceExpecting` is an `edit()` — stays), 10.1 (23; 2 records — `A_MDX_EDITED` is
shared by T10.1-1 and T10.1-6), 10.2-10.3 (9; 9 records).
**Reachable sites (the instrumented run):**
- `section-8.ts` — T8-5 (3): bnd/B.mdx oth/O.mdx tgt/T.mdx
- `section-8.ts` — T8.2-1 (2): bnd/B.mdx tgt/T.mdx
- `section-9.3.ts` — T9.3-3 (1): specs/Twice.mdx
- `section-10.1.ts` — T10.1-1 (1): specs/A.mdx
- `section-10.1.ts` — T10.1-4 (1): specs/A.mdx
- `section-10.1.ts` — T10.1-6 (1): specs/A.mdx
- `section-10.2-10.3.ts` — T10.2-2 (2): specs/A.mdx specs/U.mdx
**Failing here:** T10.1-6.
**Certification scope:** none.
**Notes.** Multi-root keys (`bnd/B.mdx`, `tgt/T.mdx`, `oth/O.mdx`) convert like any
other; the previous plan's Task 10/11 findings name the arms: T9.3-3's arm-2
workspace, T10.1-6's later twins, T10.2-2's audit and coverage arms.
**Checks.** Recipes 1–5 over `section-8.test`, `section-9.test`, `section-9.3.test`,
`section-10.1.test`, `section-10.2-10.3.test`.

### Task 16 — Initial-file conversion: §10.4–§10.7 (`section-10.4.ts`, `section-10.5.ts`, `section-10.6.ts`, `section-10.7-i.ts`, `section-10.7-ii.ts`)

**Workspace creations to judge:** 10.4 (15; 35 records — the `T10_4_1_*_STATES` tuples
hold the scenarios' EDITS; the scenario workspaces' initial entries are separate),
10.5 (10; 8 records), 10.6 (5; 3 records), 10.7-i (9; 7 records), 10.7-ii (12; 11
records).
**Reachable sites (the instrumented run):**
- `section-10.4.ts` — T10.4-1 (5): specs/C.mdx specs/D.mdx specs/M.mdx specs/P.mdx specs/U.mdx
- `section-10.4.ts` — T10.4-2 (4): specs/C.mdx specs/O.mdx specs/T.mdx specs/X.mdx
- `section-10.4.ts` — T10.4-4 (3): specs/E.mdx specs/b.mdx specs/d.mdx
- `section-10.5.ts` — T10.5-1 (2): specs/X.mdx specs/Y.mdx
- `section-10.5.ts` — T10.5-5 (1): specs/V.mdx
- `section-10.6.ts` — T10.6-2 (1): specs/F.mdx
- `section-10.7-i.ts` — T10.7-1 (1): specs/W.mdx
- `section-10.7-i.ts` — T10.7-2 (1): specs/A.mdx
- `section-10.7-ii.ts` — T10.7-7 (1): specs/A2.mdx
- `section-10.7-ii.ts` — T10.7-9 (1): specs/H.mdx
- `section-10.7-ii.ts` — T10.7-12 (2): specs/B.mdx specs/U.mdx
**Failing here:** none (every §10.4–§10.7 test passes; the site list is complete for
these modules).
**Certification scope:** T10.4-5 (CONF-CORE) — run the self project; 144/33/0/0.
**Notes.** The previous plan's Tasks 12–15 findings name the arms exactly: T10.4-1's
scenarios 2–6, T10.4-2's and T10.4-4's later arms, T10.5-1's extended and chain
fixtures, T10.5-5's sub-fixture B, T10.6-2's sub-fixture 2, T10.7-1's per-state
corrupt-session workspaces, T10.7-2's audit arm, T10.7-7's fully-resolved and payload
arms, T10.7-9's audit arm, T10.7-12's provenance and coverage arms. The session,
journal, and `.ts` entries of those workspaces stay plain.
**Checks.** Recipes 1–5 over `section-10.4.test` (~76 s), `section-10.5.test`,
`section-10.6.test`, `section-10.7-i.test`, `section-10.7-ii.test`.

### Task 17 — Initial-file conversion: §11, §11.2, §11.3 (`section-11.ts`, `section-11.2.ts`, `section-11.3.ts`)

**Workspace creations to judge:** 11 (10; a `stageConfigurationStateTwins` caller),
11.2 (13; T11.2-4's `stageEnclosure` staging 5 ~2509 and its arm tables), 11.3 (12;
1 record; a `stageConfigurationStateTwins` caller).
**Reachable sites (the instrumented run):**
- `section-11.ts` — T11-4 (1): specs/E.mdx
- `section-11.2.ts` — T11.2-4 (7): specs/CH-A.mdx specs/CH-B.mdx specs/CH-C.mdx specs/CY.mdx specs/ENCL.mdx specs/GONE.mdx specs/IMP.mdx
- `section-11.2.ts` — T11.2-5 (3): specs/C.mdx specs/D.mdx specs/E.mdx
- `section-11.2.ts` — T11.2-6 (1): specs/C.mdx
- `section-11.3.ts` — T11.3-1 (7): specs/BASE.mdx specs/MAIN.mdx specs/OK.mdx specs/R.mdx specs/SPARE.mdx specs/Zed.mdx specs/alpha.mdx
**Failing here:** T11-2, T11-6, T11-7, T11.2-6, T11.3-2, T11.3-3.
**Certification scope:** T11.2-2, T11.2-4, T11.3-4 (CONF-AVAIL) — run the self
project; 144/33/0/0 (T11.2-4 is flagged with seven paths: its conformer reaches every
one of them, so a mis-declared record here shows as a certification `error`).
**Checks.** Recipes 1–5 over `section-11.test`, `section-11.2.test`, `section-11.3.test`.

### Task 18 — Initial-file conversion: §11.4–§11.6 (`section-11.4.ts`, `section-11.5.ts`, `section-11.6.ts`)

**Workspace creations to judge:** 11.4 (11), 11.5 (4), 11.6 (13).
**Reachable sites (the instrumented run):**
- `section-11.4.ts` — T11.4-5 (5): specs/entry.mdx specs/gone.mdx specs/loop.mdx specs/main.mdx specs/vi#ew.mdx
- `section-11.6.ts` — T11.6-2 (6): aux/x.mdx specs/a.mdx specs/g.mdx specs/m.mdx specs/seul.mdx specs/sub/h.mdx
- `section-11.6.ts` — T11.6-3 (1): specs/seul.mdx
- `section-11.6.ts` — T11.6-4 (2): specs/a.mdx specs/seul.mdx
**Failing here:** T11.4-2, T11.4-3, T11.4-4, T11.4-6, T11.5-3, T11.6-2.
**Certification scope:** T11.4-1, T11.4-3, T11.4-4 (CONF-AVAIL) — run the self
project; 144/33/0/0.
**Notes.** `specs/vi#ew.mdx` is an ordinary key; `section-11.6.ts`'s `file()` sites
were all non-`.mdx` (session, journal, `.bin`, `.ts` — the previous plan's Task 16) but
its initial `.mdx` entries (`aux/x.mdx`, `specs/seul.mdx`, …) do convert.
**Checks.** Recipes 1–5 over `section-11.4.test`, `section-11.5.test`, `section-11.6.test`.

### Task 19 — Initial-file conversion: §12.0 (`section-12.0-i.ts`, `section-12.0-ii.ts`, `section-12.0-iii.ts`)

**Workspace creations to judge:** 12.0-i (11; `withWorkspace` ~138; a
`stageConfigurationStateTwins` caller), 12.0-ii (18; 1 record; `makeStoryWorkspace`'s
omega edit precedes each caller's first invocation and stays), 12.0-iii (3).
**Reachable sites (the instrumented run):**
- `section-12.0-i.ts` — T12.0-2 (1): specs/A.mdx
- `section-12.0-i.ts` — T12.0-3 (2): alt/aspecs/B.mdx specs/A.mdx
- `section-12.0-i.ts` — T12.0-5 (1): specs/A.mdx
- `section-12.0-i.ts` — T12.0-6 (3): specs/A.mdx specs/T.mdx specs/a.mdx
- `section-12.0-ii.ts` — T12.0-8 (3): specs/M.mdx specs/bnd/B.mdx specs/tgt/T.mdx
- `section-12.0-ii.ts` — T12.0-9 (2): specs/A.mdx specs/U.mdx
- `section-12.0-ii.ts` — T12.0-10 (1): specs/A.mdx
**Failing here:** T12.0-10, T12.0-14.
**Certification scope:** none.
**Notes.** The previous plan's Task 16 findings name the arms: T12.0-8's coverage and
impact arms, T12.0-9's corrupt, invalid, wrong-kind, and exclusion arms, T12.0-10's
workspaces after its twin pair; T12.0-3's `alt/aspecs/B.mdx` is an alternate root's
source.
**Checks.** Recipes 1–5 over `section-12.0-i.test`, `section-12.0-ii.test`,
`section-12.0-iii.test`.

### Task 20 — Initial-file conversion: §12.1–§12.7 (`section-12.1-12.2.ts`, `section-12.3-12.5.ts`, `section-12.6.ts`, `section-12.7.ts`)

**Workspace creations to judge:** 12.1-12.2 (19; 9 records; its `withWorkspace` and
fixture tables were widened to `FileContents` by the previous plan's Task 17 — widen
them to the record-accepting type and replace every `FAILED_BUILD_VALID_SOURCE.source`
fill with the record; T12.2-2's family workspaces 2–9; T12.2-4's arms (b)–(d)),
12.3-12.5 (6; `withWorkspace` ~149), 12.6 (5; `withWorkspace` ~112), 12.7 (18; 4
records; every §12.7 arm after each body's first — the byte-path `file()` records exist).
**Reachable sites (the instrumented run):**
- `section-12.1-12.2.ts` — T12.2-2 (3): hi/H.mdx lo/L.mdx specs/A.mdx
- `section-12.6.ts` — T12.6-2 (1): specs/A.mdx
- `section-12.7.ts` — T12.7-1 (6): specs/A.mdx specs/FOREIGNMOD.mdx specs/HOMEMOD.mdx specs/OK.mdx specs/P.mdx specs/R.mdx
- `section-12.7.ts` — T12.7-2 (4): specs/F.mdx specs/MR.mdx specs/P.mdx specs/W.mdx
**Failing here:** T12.2-4, T12.3-1, T12.7-3.
**Certification scope:** none.
**Checks.** Recipes 1–5 over `section-12.1-12.2.test`, `section-12.3-12.5.test`,
`section-12.6.test`, `section-12.7.test`.

### Task 21 — Initial-file conversion: §13 and the H-6 refusal fixtures (`section-13.1-13.2.ts`, `section-13.3.ts`, `section-13.4.ts`, `section-13.5.ts`, `write-refusal-staging.ts`)

**Workspace creations to judge:** 13.1-13.2 (5), 13.3 (9; 2 records; `restoreGraphData`
stages no `.mdx`), 13.4 (18; `withWorkspace` ~231), 13.5 (15; 4 records;
`staleWorkspaceArm`), and `write-refusal-staging.ts`'s `RENAME_FIXTURE` (~203) and
`MOVE_FIXTURE` (~272): their `decl.files` `.mdx` entries become records named with
every test that prepares the fixture (`prepareRefusalWorkspace` / `completeOnTwin`
callers — T13.5-7's arms; grep the callers), because the H-6 twin is always created
after the original's `build`.
**Reachable sites (the instrumented run):**
- `section-13.1-13.2.ts` — T13.2-1 (2): specs/A.mdx specs/sub/LIB.mdx
- `section-13.3.ts` — T13.3-3 (2): specs/A.mdx specs/T.mdx
- `section-13.3.ts` — T13.3-4 (2): specs/A.mdx specs/sub/C.mdx
- `section-13.4.ts` — T13.4-3 (2): specs/A.mdx specs/B.mdx
- `section-13.4.ts` — T13.4-8 (3): specs/A.mdx specs/S.mdx specs/sub/B.mdx
- `section-13.5.ts` — T13.5-4 (1): specs/A.mdx
- `section-13.5.ts` — T13.5-6 (2): specs/A.mdx specs/B.mdx
- `section-13.5.ts` — T13.5-7 (3): specs/a/A.mdx specs/b/B.mdx specs/c/C.mdx
- `section-13.5.ts` — T13.5-8 (1): specs/A.mdx
**Failing here:** T13.3-2, T13.4-6, T13.5-1, T13.5-7.
**Certification scope:** T13.4-5, T13.5-1, T13.5-2, T13.5-3, T13.5-4, T13.5-5, T13.5-8
(CONF-CORE) — run the self project; 144/33/0/0 (T13.5-4 and T13.5-8 are flagged: their
conformer reaches the sites).
**Notes.** `section-14-ii.ts`'s `PRECEDENCE_FIXTURE` / `LISTING_FIXTURE` are Task 23's.
The `RefusalFixture.decl` type is `WorkspaceDecl` — record-accepting since Task 1.
**Checks.** Recipes 1–5 over `section-13.1-13.2.test`, `section-13.3.test`,
`section-13.4.test`, `section-13.5.test`.

### Task 22 — The T14-11 exchange: the §2 `UnparseableStaging` exports, T14-12's arm stagings, their consumer; plus `section-14-iii.ts`'s rest and `section-15.ts`

**Requirement.** T14-11's closing clause re-stages, after its own earlier arms'
invocations, the unparseable stagings its home tests export (`T14_11_REASSERTED_STAGINGS`,
`section-14.ts` ~4479: `T2_3_3_UNPARSEABLE_STAGING`, `T2_4_2_UNPARSEABLE_STAGINGS`,
`T2_7_3_SPREAD_UNPARSEABLE_STAGING`, `T2_7_4_UNPARSEABLE_STAGINGS`, and
`T14_12_UNPARSEABLE_ARMS` through `t1412Staging` ~4466), building each workspace from
`staging.files` with `mdx: { unparseable: [file] }` for a spec source (`reassertedCase`
~4490). Task 5 deferred the home side to here so that the exports and their consumer
change together.

**Change.** `support.ts`: `UnparseableStaging.files` becomes record-accepting.
`section-14.ts`: `RangeRuleCase.files` (and whatever `runRangeRuleCase` passes to the
builder) becomes record-accepting; `reassertedCase` drops the `mdx: { unparseable:
[file] }` branch for a record entry — after this task every spec-source `file` entry is
a record, so drop the branch outright; a code-source `.ts` entry stays plain and needs
no declaration. Home side: each export's `.mdx` entries become records — the failing
`file` (spec-source) declared `unparseable`, the sources beside it well-formed unless
the home arm declares otherwise (T14-12's allowance-bearing forms carry
`{ allowances }`, "under exactly its named allowances") — named with both IDs
(`"T2.3-3/T14-11 …"`, `"T2.4-2/T14-11 <position> …"`, `"T2.7-3/T14-11 …"`,
`"T2.7-4/T14-11 <arm> …"`, `"T14-12/T14-11 (<arm>) …"`), the home bodies' own
stagings of these maps (`section-2.2-2.3.ts` ~1099, `section-2.4.ts` ~620,
`section-2.7.ts` ~1503, T14-12's arms in `section-14-iii.ts`) taking the records
through the same maps (remove the paths from those workspaces' `mdx.unparseable`).
Then `section-14-iii.ts`'s remaining post-invocation entries (T14-12's `specs/A.mdx`,
`specs/BASE.mdx`) and `section-15.ts` (1 creation — judge).
**Reachable sites (the instrumented run):**
- `section-14-iii.ts` — T14-12 (2): specs/A.mdx specs/BASE.mdx
- the expected remainders Task 5 left: the four exports' spread entries (T2.3-3,
  T2.4-2, T2.7-3 `specs/A.mdx`, and T2.7-4's — the latter behind its failure).
**Failing here:** T2.3-3, T2.4-2, T2.7-3, T2.7-4, T14-11 (arm (c); its w.n arms are
reached only through AGENTS.md's arm-filter recipe — use it to run w.1…w.n against the
built product before and after: same verdicts), T14-12.
**Certification scope:** none.
**Checks.** Recipes 1–5 over `section-2.2-2.3.test`, `section-2.4.test`,
`section-2.7.test`, `section-14.test`, `section-14-iii.test`, `section-15.test` (the
sites hook's after-log for the §2 files now empty but for `unchecked` entries).

### Task 23 — Initial-file conversion: §14 (`section-14.ts`, `section-14-ii.ts`)

**Workspace creations to judge:** 14 (44; 4 records; T14-11's own `RangeRuleCase`
tables — arms (a)–(v) and the five encoding forms, `T14_11_ENCODING_FORMS` ~4424,
whose `Uint8Array` contents are fine as record bytes — wrap in place, one record per
row per `.mdx` entry, `unparseable` where the row declares it), 14-ii (2; the
`PRECEDENCE_FIXTURE` ~657 / `LISTING_FIXTURE` ~1135 `RefusalFixture` decls: records
named with every test preparing them, as Task 21's).
**Reachable sites (the instrumented run):**
- `section-14.ts` — T14-3 (2): specs/broken.mdx specs/invalid.mdx
- `section-14.ts` — T14-4 (7): hi/H.mdx lo/L.mdx specs/a#b.mdx specs/a.mdx specs/alpha.mdx specs/bravo.mdx specs/s.mdx
- `section-14.ts` — T14-5 (1): specs/U.mdx
- `section-14.ts` — T14-6 (7): specs/A.mdx specs/BASE.mdx specs/a#b.mdx specs/a.mdx specs/alpha.mdx specs/bravo.mdx specs/s.mdx
- `section-14.ts` — T14-8 (9): specs/Col.mdx specs/CycA.mdx specs/CycB.mdx specs/Emb.mdx specs/ImpA.mdx specs/ImpB.mdx specs/One.mdx specs/Pol.mdx specs/Two.mdx
- `section-14.ts` — T14-11 (3): specs/A.mdx specs/comment-only.mdx specs/empty.mdx
- `section-14-ii.ts` — T14-10 (3): specs/a/A.mdx specs/b/B.mdx specs/c/C.mdx
**Failing here:** T14-2, T14-4, T14-6, T14-7, T14-11 (14.ts); T14-9, T14-10 (14-ii).
**Certification scope:** none.
**Notes.** T14-4/T14-6 share records already (`"T14-4/T14-6 …"`); T14-3's
`specs/broken.mdx` and `specs/invalid.mdx` are `unparseable` records (their paths
leave `mdx.unparseable`); `specs/a#b.mdx` is an ordinary key; T14-11's arm (v) prefix
form (AGENTS.md's arm-filter and stand-in recipes reach it).
**Checks.** Recipes 1–5 over `section-14.test`, `section-14-ii.test`; after this task
the whole suite's initial `.mdx` entries after a body's first invocation are records,
`perDraw`, or `unchecked` — Task 24 verifies it.

### Task 24 — The undeclared-staging guard covers initial files (last: after every conversion)

**Requirement.** S-9's timing clause is met only while every post-invocation initial
`.mdx` entry is a record (Tasks 4–23) or a declared draw (Task 3); nothing enforces
that a future entry joins the ledger. Extending the guard to `stageInitial` makes an
omission a harness error at the first run that reaches the site — the bounded surfacing
the `file()` guard already has (the previous plan's Task 18).

**Change** (`test/helpers/workspace.ts`, `test/self/s9-undeclared-staging.test.ts`,
headers, AGENTS.md):
1. `stageInitial`'s plain-contents branch, for an `.mdx` key, calls
   `guardUndeclaredStaging(rel, this.mdxDeclarations.get(mdxKey(rel)) ?? "well-formed")`
   before `checkMdx` — the same guard, one code path. At creation the per-workspace
   mark cannot be set (the root was registered an instant ago; no invocation has run in
   it), so only the per-body mark fires; outside a body context — a self-test, the E-6
   fixture, a certification runner staging outside a body — creation never refuses. The
   diagnosis names the site (extend the message with the entry kind: "an initial
   `files` entry of a workspace created after a product invocation in the running body
   of <ID>") and the remedies (a record in `files`; `mdx.perDraw` for a property draw;
   `mdx.unchecked` for P-8 mutations and noise). `create()`'s catch disposes the
   half-built workspace — nothing left behind.
2. `file()`, `edit()`, `copyFrom()` unchanged.
3. Self-tests (`s9-undeclared-staging.test.ts`, inside `runProductTestBody`): after an
   invocation in workspace 1, `TestWorkspace.create({ files: { [A]: WELL_FORMED } })`
   throws `undeclared-staging` for `A` and leaves no `xspec-harness-*` directory behind
   (compare `os.tmpdir()` listings, as the existing refusal test does, if it does);
   with a record entry → created; with `mdx: { unchecked: [A] }` → created; with
   `mdx: { perDraw: [A] }` → created; the same plain creation BEFORE any invocation in
   the body → created; outside any body context after an invocation elsewhere →
   created; a non-`.mdx` plain entry always passes. Update the headers (`workspace.ts`
   module header and `stageInitial`'s comment — "the standing observation" is closed;
   `product-invocations.ts`'s header where it describes the reach; `staged-mdx.ts`'s
   header).
4. Any site the full-suite run reveals converts under the rule in this same task —
   expect none.

**Checks.** `npx tsc -p test`; `npm run format:check`; the self project green in the
namespace, certification 144 PASS / 33 FAIL / 0 error / 0 hang (an in-scope test
reaching an undeclared initial entry against its conformer surfaces here as `error` —
convert it); the full suite against the built product (`unshare … -- npx vitest run
--config test/vitest.config.ts --project suite --reporter=verbose > <log> 2>&1`,
~15 min, never beside the self project): 337 tests, the same 82 failures
(`grep -c 'undeclared-staging' <log>` = 0; the failing-ID set `comm`-equal to the known
set — AGENTS.md's recipe), 255 passed. Red check: in a scratch-backed copy of one
converted module whose test passes, replace one record entry with its plain source,
run that test alone (`-t '<ID> '`), read the diagnosis naming the initial entry,
restore (`cp`, `cmp`). Record the extension, its message, and the run in AGENTS.md;
then delete this file (leave `specs/tmp/.gitkeep`).
