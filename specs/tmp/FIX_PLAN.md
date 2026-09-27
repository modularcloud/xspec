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
each other except that Task 22 precedes Task 23); Task 23b (found by Task 3: the
declaration P-12's unparseable draw needs to survive the guard) before Task 24; Task 24
last.

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

**Resolved by Task 1 (79308be; the mechanism).** The record-accepting type is
`InitialFileContents = FileContents | StagedMdx` (`test/helpers/workspace.ts`);
`WorkspaceDecl.files: Readonly<Record<string, InitialFileContents>>`. `create()` stages
a record entry under the record's declaration through the private `recordStaging`
shared with `file()`'s record branch: a record at a non-`.mdx` key throws
`mdx-derivability` ("not an `.mdx` path"); a record whose path the workspace `mdx`
declaration names in ANY of its lists — `unparseable`, `unchecked`, `allowances`,
`perDraw` — throws the contradiction ("drop the declaration entry (or change the
record)"). Consequence for Tasks 3–23: when an initial entry becomes a record, its
path LEAVES the workspace `mdx` declaration (the record carries the declaration —
the former entry's, else well-formed); an entry for a plain sibling path stays.
`WorkspaceMdxDecl.perDraw` is a path list like `unchecked`, resolved to `per-draw`
(judged well-formed at creation; a later plain `file()` of the path is exempt from
the guard; a path in two lists throws). The guard is unchanged (Task 24).
`stageConfigurationStateTwins` takes `Readonly<Record<string, InitialFileContents>>`.
Self-tests: `s9-staged-sources.test.ts` 192 tests (five new, in the describe "the
builder stages an initial `files` record under the record's declaration"),
`s9-undeclared-staging.test.ts` 13 tests; a contradicting record's `create()` refusal
is exercised through a fresh unsealed ledger and a fresh builder (`vi.resetModules()`),
since the sealed registry ledger holds no such record. Known state after Task 1: self
project 22 files, 2332 passed; certification 144/33/0/0; T12.1-3 and T10.1-1 keep
their verdicts.

**Resolved by Task 2 (the E-6 records).** `test/helpers/e6.ts` registers four records:
`E-6 specs/Other.mdx version one — the initial source`, ``E-6 specs/Other.mdx version two
— the leaf edit before `impact` `` (unchanged), `E-6 specs/Core.mdx`, and `E-6
specs/Refs.mdx`; the three initial ones are passed in the fixture's `files`;
`E6_CORE_SOURCE` and `E6_REFS_SOURCE` stay string constants beside their records (the
`at` step derives its byte offset from the former). The self-test's E-6 pin is 4; the
import order (`../helpers/e6.js` before the manifest) is unchanged. The fixture runs
under no per-body mark (its suite test calls it directly), so Task 24's extension will
never reach its initial files — the records are the sole mechanism there. Known state
after Task 2: the S-9 self-test 195 tests over 170 records (166 `T…` + 4 `E-6`); self
project 22 files, 2335 passed; certification 144/33/0/0; the exchange test passes
against the built product with identical writes (6). Task 2's "190 tests over 170
records" had been counted from the a2fa780 baseline, before Task 1's five self-tests:
a later task's expected counts add to 195 tests / 170 records.

**Resolved by Task 3 (the §16 draws and constants).** The `perDraw` lists are derived
from the rendered map by `mdxPathsOf(files)`, exported from `test/helpers/workspace.ts`
beside `isMdxPath` (the plain `.mdx` keys in map order, record entries left out — the
decision the task asked for, taken once: one definition for the seven modules whose
generators build the map; self-tested in `s9-staged-sources.test.ts`); P-1's
`inStagedWorkspace` lists its one fixed path literally, and `section-16-p5-p6.ts`
wraps its three sites in a module-local `drawWorkspace(rendered)`. Coverage verified by
reading: every `mdxSources` renders the same map its body stages (P-1's
`segmentSource(splitSegments(draw), quoteKindFor(draw))` is the body's
`segmentsVerdict(draw).segments`; P-5's `initTrialState` clones the model; P-7's drawn
paths and targets always end in `.mdx` and its code sources never — the path alphabet
spells no `m`, `d`, or `x`); no `mdxSources` had to be added. The task's `"P-7 …"`
record example was wrong — P-7 stages no harness-constant `.mdx` (its `mdxSection(id)`
contents are index-derived per draw and judged by its `mdxSources`), so they are
`perDraw`; the constants are P-8's base sources, shared with P-11, and P-10's
`A_MDX`: `FUZZ_BASE_RECORDS` in `section-16-p8.ts` (`"P-8/P-11 specs/A.mdx"`,
`"P-8/P-11 specs/B.mdx"`, from `BASE_SPEC_A`/`BASE_SPEC_B`, which stay strings in the
exported `FUZZ_BASE_FILES` for the mutators; P-8 stages `fuzzBaseWorkspaceFiles()`,
P-11 substitutes the record for each unmutated `.mdx` entry of `trial.files` — a path
outside `mutatedMdxPaths(trial)` — while its mutated ones stay `unchecked`), and
`"P-10 specs/A.mdx"` (`A_MDX` wrapped in place). P-8, P-10, and P-11 create no
draw-derived well-formed `.mdx` workspace (P-8 the constant base then `unchecked`
mutations; P-10 the constant alone; P-11 `unchecked` mutations beside the constants).
Finding: P-12's break-parse twist stays a plain `unparseable` initial entry — Task 23b.
Checks (the sites hook with a third, declaration column — `JSON.stringify(this.
mdxDeclarations.get(mdxKey(rel)) ?? "well-formed")` — so the "after" log shows every
remaining plain entry's declaration; AGENTS.md): the eleven §16 suite files in one run
(~11 min, 4 workers) give identical verdicts and diagnoses before and after (P-1…P-5
fail diagnosed at the same seeds, trials, and shrinks; P-6…P-13 pass); the sha256
capture logs are identical (3655 writes each); the "after" sites log holds 0
`"well-formed"` lines — 2205 `"per-draw"` (P-1 37, P-2 906, P-3 305, P-4 600, P-5 118,
P-6 24, P-7 139, P-9 12, P-12 14, P-13 50), P-11's 36 `"unchecked"`, P-12's 1
`"unparseable"` — where the "before" log's 2313 `"well-formed"` lines included P-8's
70, P-10's 8, and P-11's 34 (the record conversions). Known state after Task 3: the
S-9 self-test 199 tests over 173 records (166 `T…`, 4 `E-6`, 3 `P-…`); self project
22 files, 2339 passed, 0 skipped under the namespace (~141 s; 2335 + the three record tests + the `mdxPathsOf` test); certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 4 (the §1 modules; 7a80081, b9fd0e4, and the task's closing
commit).** Fifty-two records: `section-1.3.ts` 11 — the structural arm table's
rows through `structuralArm(recordName, parts)`, which composes
`prefix + construct + suffix` in place (`StructuralArm extends StructuralArmParts`
with `source: StagedMdx`; the parts stay for `byteWindow`), T1.3-3's arm hoisted
from its body to the module-level `SKIPPED_LEVEL_ARM` (a table type whose
`source` is required cannot be met by a body-local literal — a run-time record
throws), `TOP_LEVEL_MULTI_SEGMENT` (through the builder) and
`TOP_LEVEL_ONE_SEGMENT_SOURCE`, `CROSS_FILE_A`/`CROSS_FILE_B`, and the
invalid-form arms through `invalidIdFormArm()` (the bearer plus the shared
`FORM_*` parts); `section-1.4.ts` 38 — a template function called over
module-level constant tables enumerates as a COMPUTED module-level table, the
same call in the same order evaluated once at load
(`INVALID_SEGMENT_FIXTURES = INVALID_SEGMENT_ARMS.map((arm) => ({ arm, fixture:
staged(name, segmentStaging(arm.segment, arm.quote)) }))`, likewise
`VALID_TAG_FIXTURES` and `INVALID_TAG_FIXTURES`; the body destructures
`{ arm, fixture }`; `StagedAssembled` pairs an `Assembled` with its record and
`expectSingle144` stages the record while asserting over `pinned`) — the
hand-written `as const` tuple remains the form for closures over mutable state
(the previous plan's Task 12); a record's name carries the arm's own diagnostic
`name` (`` `T1.4-1 arm ${arm.name} specs/A.mdx` ``: unique per table, no raw
control characters since the names spell code points as `U+XXXX`);
`section-1.6-1.7.ts` 3 — `EXTENDED_SOURCE`, T1.6-5's code-arm
`VALID_SECTION_SOURCE` (unreached behind the spec arm's diagnosed failure,
judged by reading), `ENDPOINT_SPEC_SOURCE`, each wrapped in place.
`section-1.5.ts` adds none: T1.5-2's existing byte-path record, renamed
`T1.5-2 the valid section source at every arm's spec path`, replaces its three
`.source` fills (a record already serving a later `file()` is reused at the
initial-file sites and renamed for every site it serves). `section-1.1-1.2.ts`
needs nothing: every body's creations precede its first invocation (T1.1-2
creates all three forms before its first `buildOk`) and the later `file()`
calls are non-`.mdx`. First-workspace rows of converted tables converted
uniformly (T1.3-3, T1.3-4's multi-segment arm, T1.4-4's first valid tag arm);
every other first workspace stays plain. Both `findingsOf` helpers take
`string | StagedMdx`. Checks: the sites hook logged the task's 11 (test, path)
pairs (39 lines, all `"well-formed"`) before and 0 lines after; the sha256
capture over the five files run together (173 writes; one log for a
multi-file run is compared SORTED, since the 4 workers interleave their lines)
identical; 27 tests, 22 pass and 5 fail — T1.4-1, T1.4-4, T1.5-2, T1.6-5,
T1.7-2 — with identical diagnoses (the `HarnessAssertionError:` lines of the
two verbose logs, extracted and `diff`ed). Known state after Task 4: the S-9
self-test 251 tests over 225 records (218 `T…`, 4 `E-6`, 3 `P-…`); self project
22 files, 2391 passed, 0 skipped under the namespace (~137 s; 2339 + the 52 record tests); certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 5 (the §2 modules; the first commit converts, the second
records).** Eighty-eight records: `section-2.1.ts` 28 — `VALID_BASE_FILES`'s
`specs/BASE.mdx` as ONE record named with both callers
(`"T2.1-2/T2.1-3 specs/BASE.mdx"`, spread into T2.1-2's first workspace too);
a runner two tests drive over two arm tables (`runInvalidImportArm` over
`INVALID_SPECIFIER_ARMS` and `INVALID_BINDING_ARMS`) gets a staging-table
function taking the test ID — `invalidImportStagings(testId, arms)` pairs each
row with its `specs/A.mdx` record (`arm.importLine + IMPORTING_FILE_REST`),
one computed table per test, the runner taking the pair; the two
`docs/EXTRA.mdx` entries wrapped in the arm rows (the code-group one's
`export {};` derives — an ESM block, judged well-formed at creation before the
conversion too); the lexical importers as `LEXICAL_IMPORTER_FILES`
(`Object.fromEntries` over the table, once at load); the duplicate-binding rows
composed by `duplicateBindingArm(name, separator)` carrying
`{ allowances: ["duplicate-import-binding"] }`, so the path left the workspace
declaration and `withWorkspace`'s `mdx` parameter went with its one caller;
B1/B2 one record each staged in both arms; T2.1-3's two-names arm and T2.1-5's
`SELF_IMPORT_SOURCE` wrapped in place. `section-2.2-2.3.ts` 10 — T2.3-3's two
form tables through `t233ArmStagings(kind, sectionId, forms)`, each row
carrying the body's former `arm` label verbatim (`` `T2.3-3 ${kind}
${JSON.stringify(form)} (${label})` `` plus the path; a JSON-stringified form
spells LF as `\n`, so no raw control characters) so the diagnoses are
unchanged. `section-2.4.ts` 20 — where one table mixes well-formed and
deferred-unparseable arms (T2.4-2), the computed table is a discriminated
union: `DYNAMIC_FORM_STAGINGS`'s well-formed member carries `records: { d,
text }`, its TypeScript-only member `unparseableAt`, the body branching on
`entry.records !== undefined` (no non-null assertion, the deferred stagings
staying plain); a string map an `UnparseableStaging` export spreads
(`DYNAMIC_ARM_BASE_FILES`, typed `Record<string, string>` until Task 22) keeps
its string form and the record is made FROM it (`DYNAMIC_ARM_BASE_RECORDS`) —
the well-formed sibling beside a deferred unparseable staging converts NOW, so
a task's expected remainders are the unparseable entries alone; T2.4-3's rows
through `arityArm(name, construct)`; T2.4-4's `SEGMENT_EXACT_BASE`,
`T2_4_4_TEXT_SOURCE`, `T2_4_4_POSITIVE_SOURCE` wrapped in place
(`T2_4_4_D_SOURCE`, the first workspace's, plain). `section-2.5-2.6.ts` 6 —
`INVALID_COVERAGE_STAGINGS` (the five `coverageStaging` calls, once at load)
and `T2_6_3_SELECT_SOURCE`. `section-2.7.ts` 24 — `FOREIGN_CONSTRUCT_STAGINGS`
and `INVALID_PROP_STAGINGS` (computed tables over the literal arm tables), the
three enclosed-construct arms through `enclosedConstructArm(recordName, parts)`
(`EnclosedConstructArm extends EnclosedConstructArmParts` with
`source: StagedMdx`; a module-level arm constant that a runner taking the test
ID stages is named for the test whose body stages it — T2.7-4's expression arm
`"T2.7-4 …"`), `REPEATED_UNKNOWN_SOURCE`, `T2_7_3_DOUBLE_QUOTED`. The
valueless-`tags` arm's record holds the same bytes as the exported
`VALUELESS_TAGS_FIXTURE.source` that T11.4-3 stages (`section-11.4.ts`'s
`SHARED`): Task 18 reuses and renames it (`"T2.7-3/T11.4-3 …"`) if that
staging is post-invocation. Left plain: every body's first workspace (first
rows of converted tables converted uniformly: T2.1-3's first binding arm,
T2.3-3's first embedding form, T2.4-2's first form in `d`, T2.4-3's zero-argument
arm, T2.7-1's first foreign construct, T2.7-3's first invalid prop); deferred to
Task 22, plain and declared `unparseable`: T2.3-3's `{text("a") text("b")}`,
T2.4-2's two TypeScript-only forms in both positions, T2.7-3's `{...a, b}`,
T2.7-4's five unparseable comment arms. Checks: the sites hook logged the
task's 22 (test, path) pairs (107 lines, 25 distinct with the declaration
column) before and exactly the two reached remainders after (T2.4-2's and
T2.7-3's `specs/A.mdx` `"unparseable"`; T2.3-3's and T2.7-4's lie behind their
failures); the sha256 capture over the five files (273 writes, compared
sorted) identical; 29 tests, 21 pass and 8 fail — T2.1-2, T2.3-3, T2.4-2,
T2.4-5, T2.5-3, T2.6-1, T2.7-3, T2.7-4 — with identical diagnoses. Known state
after Task 5: the S-9 self-test 339 tests over 313 records (306 `T…`, 4 `E-6`,
3 `P-…`); self project 22 files, 2479 passed, 0 skipped under the
namespace (~137 s; 2391 + the 88 record tests); certification
144 PASS / 33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 6 (the §3–§4 modules; the first commit converts, the second
records).** Twenty records: `section-3.ts` 2 — T3-6's `SCOPE_A_SOURCE` /
`SCOPE_B_SOURCE` wrapped in place (the variant loop's first workspace converted
uniformly). `section-4.ts` 6 — `T4_2_BASE_FILES`'s `specs/BASE.mdx` (spread into
all 35 arm workspaces), `COLOCATED_SPEC_SOURCE` as `"T4-2 src/NAME.mdx"` (the
escape-spelled arm's `extraFiles` and the lexical positives), the two `extraFiles`
`.mdx` entries wrapped in their arm rows (`InvalidTsImportArm.extraFiles` widened;
the FIRST arm's `docs/EXTRA.mdx` — the body's first workspace — converted
uniformly; the first duplicate-binding arm's `specs/OTHER.mdx` lies behind T4-2's
failure at the escape-spelled arm, judged by reading), `T4_5_FILES`'s two sources.
`section-4.3-4.4.ts` 3 — `T4_3_2_SPEC_FILES`'s `specs/A.mdx`; `T4_4_SPEC_FILES`'s
two sources named `"T4.4-1/T4.4-2 …"` (T4.4-2 stages them in its first workspace
only; T4.4-1's facet 3 stages the `B` record at the invalid path `specs/B#.mdx` —
`recordStaging` requires an `.mdx` path, not the path the name states, so a record
staged at a second path is named for both). `section-4.5.ts` 8 — `AB_SPEC_FILES`'s
`specs/A.mdx` as ONE record named with all five staging tests
(`"T4.5-3/T4.5-4/T4.5-5/T4.5-6/T4.5-7 specs/A.mdx"`: a shared map's record carries
every caller's ID even where a caller stages it in its first workspace only —
T4.5-6, T4.5-7); T4.5-2's upstream arm — `T4_5_2_UPSTREAM_MAIN_SOURCE` wrapped in
place, `T4_5_2_UPSTREAM_OTHER_V1` from the template call
`upstreamOtherSource("Upstream behavior, v1.")` moved to module level beside the
existing `_V2` edit record; `T4_5_8_AB_SOURCE`, one record for the identical bytes
T4.5-8 stages at `specs/A.mdx` (`T4_5_8_SPEC_FILES`) and `specs/BASE.mdx`
(`T4_5_8_BASE_FILES`) — the two former string constants collapsed into it; the two
`specs/COL.mdx` layouts: a per-arm staging function composing an `.mdx` source
from module-level parts and an arm row (`stageSpecSourceCollision`) returns
`source: StagedMdx` — the record named `` `T4.5-8 specs/COL.mdx with ${arm.name}` ``
carrying `{ allowances: ["duplicate-import-binding"] }` — and is called once at
load from the computed table `T4_5_8_SPEC_SOURCE_STAGINGS` (`{ arm, staged }`
pairs), the assertion helper taking the pair and the body iterating the table;
the allowance left the workspace declaration, so `withWorkspace`'s `mdx`
parameter and the `WorkspaceMdxDecl` import went with the one caller (as Task 5's
`section-2.1.ts`); `T4_5_9_FILES`'s two sources. `section-4.6.ts` 1 —
`T4_6_3_DECLARATION_SPEC_SOURCE` (the `flatMap` over the arm table) wrapped in
place. `section-4.1-4.2.ts` needs nothing (seven tests, one workspace each, at
body start). Left plain: every body's first workspace (T3-1…T3-5, T3-7, T4-1,
T4-3, T4-4, T4.3-1, T4.5-1's and T4.5-2's `PRINT_SPEC_SOURCE`, T4.6-1, T4.6-2,
T4.6-4). Observation for the next determination, outside the rule's shapes and
not converted: T4-2's above-root arm stages `outside/NAME.mdx` at the workspace
root's PARENT through `support.ts`'s `stageBesideRoot` — a raw `fsp.writeFile`,
neither a `files` entry nor a `file()` staging — so no builder path judges it and
Task 24's guard will not see it; TEST-SPEC T4-2 names the file ("a real
`outside/NAME.mdx`") and asserts resolution never reaches it; converting it needs
`stageBesideRoot` to take a record (a helper change this plan does not schedule).
Checks: the sites hook logged the task's 10 (test, path) pairs (36 lines, all
`"well-formed"`) before and nothing after (the hook appends lazily, so an empty
result is a missing log file); the sha256 capture over the six files (235
writes, compared sorted) identical; 36 tests, 28 pass and 8 fail — T3-7, T4-2,
T4-5, T4.4-1, T4.5-8, T4.5-9, T4.6-1, T4.6-3 — with identical diagnoses; red
check: an unclosed tag spliced into `T4_5_8_MDX_BODY_PREFIX` fails both
`specs/COL.mdx` records in the S-9 self-test. Known state after Task 6: the S-9
self-test 359 tests over 333 records (326 `T…`, 4 `E-6`, 3 `P-…`); self project
22 files, 2499 passed, 0 skipped under the namespace (~136 s; 2479 + the 20
record tests); certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23
`certification run against` lines.

**Resolved by Task 7 (the §5 modules; the first commit converts, the second
records).** Eighteen records: `section-5.1-5.3.ts` 7 — T5.3-1's arm table, the
`.mdx` entries wrapped in their rows (`"T5.3-1 cross-file depends cycle
specs/A.mdx"` / `specs/B.mdx`, the mixed, self-depends, self-embeds, and two
grandparent arms' `specs/A.mdx`; the first arm's converted uniformly),
`CycleArm.files` and `withWorkspace`'s `files` widened. `section-5.4.ts` 2 —
`JOURNALED_BASELINE` (T5.4-1's fixture 2) and `MOVE_A_SOURCE` (T5.4-2's move
fixture) wrapped in place; the anchored `edit()` sites untouched.
`section-5.5.ts` 1 — `KIND_BASELINE` (T5.5-2's second workspace) wrapped in
place; T5.5-1's H-6 two-directory protocol creates BOTH workspaces before either
run (`assertAcrossDirectoriesDeterministic` calls `makeWorkspace` twice, then
runs), so `RICH_FILES` stays plain. `section-5.6.ts` none (one workspace per
body, the edits between `gitCommitAll("baseline")` and the first `build`).
`section-5.7.ts` 8 — `TOKEN_BASE_SOURCE` wrapped in place and the five
token-bound `specs/MAIN.mdx` sources as the computed table
`TOKEN_BOUND_STAGINGS` (`{ arm, source, main }`: `tokenBoundSource(arm)` once
at load, the string kept for the byte-range self-check and the record made
from it, named `` `T5.7-2 token bounds: ${arm.what} specs/MAIN.mdx` ``;
`assertTokenBoundArm` takes the pair), `COLLISION_A_SOURCE` /
`COLLISION_B_SOURCE` (T5.7-4's collision helper) wrapped in place. Sub-rule
applied: a composed source whose shape the product's grammar widenings might
accept where the stock parser does not (the five comment/whitespace `d`
values) is probed with `deriveMdx` BEFORE conversion (a scratch `.mts`,
AGENTS.md) so the record's declaration is known — all five derive, no
allowance named. Left plain: every body's first workspace (T5.2-1, T5.3-2,
T5.4-1's fixture 1, T5.4-2's rename fixture, T5.5-1's two directories, T5.5-2's
matrix workspace, T5.5-3…T5.5-6, every T5.6-n, T5.7-1, T5.7-2's span
workspace, T5.7-3, T5.7-4's entry workspace). Checks: the sites hook logged the
task's 8 (test, path) pairs (20 lines, all `"well-formed"`) before and nothing
after; the sha256 capture over the five files (154 writes, compared sorted)
identical; 21 tests, 19 pass and 2 fail — T5.5-5, T5.7-4 — with identical
diagnoses (T5.5-5's line begins with the adapter's label, not the test ID, so
the diagnosis extraction uses `HarnessAssertionError: [^`]{0,160}`); red
check: an unclosed tag spliced into `TOKEN_TAG_POST` fails the five MAIN
records as `mdx-derivability` while the BASE record passes. Known state after
Task 7: the S-9 self-test 377 tests over 351 records (344 `T…`, 4 `E-6`,
3 `P-…`); self project 22 files, 2517 passed, 0 skipped under the
namespace (~134 s; 2499 + the 18 record tests); certification 144 PASS /
33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 8 (the §6.1–§6.3 modules; 0a93d2d converts, the closing
commit records).** Thirty records: `section-6.1.ts` 2 — `CORE_FILES`'s
`specs/A.mdx` and `specs/B.mdx` wrapped in place, named with every calling
test (`"T6.1-1/T6.1-2/T6.1-3 …"`; T6.1-3's second and third arms are the
post-invocation sites, T6.1-1's sweep workspace and T6.1-2's two directories
— both created before its first `rename` — precede any invocation; the map's
type widened to `InitialFileContents`). `section-6.2.ts` 23 — T6.2-3's
impure-boundary arm (`T6_2_3_ROOM` made FROM the exported `I3_ROOM_SOURCE`,
which `s9-fixture-well-formedness.test.ts` imports as a string;
`I3_HALL_SOURCE`, `I3_DEPS_SOURCE` wrapped in place), its impure matrix
(below), its sibling stagings (d)/(e) (the six `D3_*`/`E3_*` sources wrapped
in place); T6.2-4's `F1_SOURCE`/`F2_SOURCE`/`F3_SOURCE` wrapped in place
(`PureFinalPositionStaging.source: StagedMdx`; shape (1)'s workspace, the
body's first, converted uniformly), the dependents through the computed table
`PURE_FINAL_POSITION_RUNS` (`{ staging, deps }` over `[F1_STAGING,
F2_STAGING]`, `p4DepsSource(staging.idPre, "moved node")` once at load, the
runner taking the pair), the twin's `T6_2_4_TWIN_DEPS`. `section-6.3.ts` 5
new, 1 reused — `J2_SOURCE`, `F4_SOURCE`, `F4_INVALID_SOURCE` wrapped in place
(T6.3-2's and T6.3-4's first arms converted uniformly), `F4_BROKEN_SOURCE`
carrying `"unparseable"`, `T6_3_5_WITH_EXTRA`; the existing inner-v1 record
reused at four initial-file sites as `T6_3_5_WITHOUT_EXTRA`. Sub-rules
applied: (i) a composition a per-cell helper performs from a module-level row
(`runImpureStaging`'s `originSource` from `shape`) moves into a computed table
keyed by the row — `M3_ORIGIN_STAGINGS` (`{ shape, origin }`), ONE record per
shape staged at both destinations (identical bytes), the helper taking the
pair and the body iterating the table; a row field staged verbatim
(`ImpureDestination.source`) is wrapped in place instead; (ii) a body-local
template call a single-use runner both stages and later compares
(`runChangedTwinStaging`'s `depsSource`) moves to a module-level record, the
comparison reading `.source`; (iii) a workspace `mdx.unparseable` entry for an
initial file becomes the record's declaration and leaves the workspace
declaration; where that was the module's only use of `withWorkspace`'s `mdx`
parameter, the parameter and its `WorkspaceMdxDecl` import go (Tasks 5–6's
precedent); (iv) an existing record whose bytes equal a new initial entry's is
reused and renamed for every site it serves — its identifier too, when the
old name misdescribes the wider use. Read-based enumeration: T6.2-1 and
T6.2-2 (diagnosed failures) each create one workspace at body start and call
no creating helper — nothing behind their failures. Left plain: T6.2-1's,
T6.2-2's, T6.2-3's clean-boundary, T6.3-1's, and T6.3-3's workspaces; arm
(a)'s pre-invocation `file()` edit in T6.3-5. Checks: the sites hook logged the
task's 19 (test, path) pairs (57 lines: 56 `"well-formed"`, T6.3-4's
`specs/Broken.mdx` `"unparseable"`) before and nothing after; the sha256
capture over the three files (133 writes, compared sorted) identical; 12
tests, 10 pass and 2 fail — T6.2-1, T6.2-2 — with identical diagnoses; red
check: `<S>` for `</S>` in the origin template fails the five `specs/ca.mdx`
records as `mdx-derivability`, the three other matrix records pass. Known
state after Task 8: the S-9 self-test 407 tests over 381 records (374 `T…`,
4 `E-6`, 3 `P-…`); self project 22 files, 2547 passed, 0 skipped under
the namespace (~138 s; 2517 + the 30 record tests); certification 144 PASS /
33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 9 (the §6.4 and §6.7 modules; d6d25e6 converts, the closing
commit records).** Nineteen records: `section-6.4.ts` 17 — T6.4-2's body-local
staging maps hoisted to module level as `T6_4_2_L_FILES` / `T6_4_2_M_FILES` (the
`.mdx` entries records named `"T6.4-2 arms 1 and 2 <path>"` / `"T6.4-2 arms 3 and
4 <path>"` — the same `coreL`/`refsL`/`coreM`/`refsM` calls and
`OTHER_MDX_L`/`OTHER_MDX_M`, moved — the `.ts` entries plain, arm 1's workspace
converted uniformly; `runMinimalEditArm`'s `sources` widened, its untouched-file
compare reading a record's bytes through `.source` so its message selection is
unchanged); `RENAME_REFUSAL_FILES`'s two entries as records made from `V3_SOURCE`
and `TWO_BEARER_COLLISION_SOURCE` (both kept as strings for the location windows),
named `"T6.4-3/T6.6-3/T14-7 specs/A.mdx"` / `"… specs/B.mdx"` (T6.4-3 stages the
set again for its configuration-state twins after its premise `build` — behind its
diagnosed failure at the first refusal case, judged by reading; T6.6-3 and T14-7
stage it in their first workspaces); the seven `U4_*` sources wrapped in place —
`"T6.4-4/T6.6-3 specs/A.mdx"`, `"… specs/Bad.mdx"`, `"… docs/Stray.mdx"`, `"…
specs/Solo.mdx"` (the exported `RENAME_USAGE_ORDERING_FILES` / `RENAME_SOLO_FILES`
sets T6.6-3 stages too, their types widened), `"T6.4-4 masking arm
specs/Broken.mdx"` carrying `"unparseable"` (the workspace declaration
`{ unparseable: [U4_BROKEN_FILE] }` removed and, it being the module's only use,
`withWorkspace`'s `mdx` parameter and the `WorkspaceMdxDecl` import with it —
Task 8's sub-rule (iii)), `"T6.4-4 duplicate-spellings arm specs/Dup.mdx"`,
`"T6.4-4 undefined-ancestor arm specs/Anc.mdx"` (the base arm's workspace, the
body's first, converted uniformly); `T5_CORE_SOURCE` / `T5_TARGET_SOURCE` wrapped
in place as `"T6.4-5 specs/Core.mdx"` / `"T6.4-5 specs/Target.mdx"` (the move
arm's twins follow the rename arm; the rename arm's workspace converted
uniformly). `section-6.7.ts` 2 — the validation arm's initial origin
(`originSource("b.mid", "b.mid").text`) and stale watcher (`staleWatch.text`; the
builder's `prefix`/`construct` still pin the byte window) as
`T6_7_1_INITIAL_ORIGIN` / `T6_7_1_STALE_WATCH`. Sub-rules applied: (i) an
exported string set that another registry module's string-typed helper consumes
converts in place, the consumer's parameter widened to `InitialFileContents` —
a type-only touch of `section-6.6.ts`'s `withWorkspace` (one import, one type;
its own conversion stays Task 12's), the form Task 10's note prescribes (one
record, created in the exporting module, named with every staging test's ID); a
consumer spreading the set into a `WorkspaceDecl` (`section-14.ts`'s T14-7) needs
nothing; (ii) a body-local staging map a runner both stages and compares against
(`runMinimalEditArm`'s `touched`) hoists to a module-level record-bearing map,
the runner reading a record's bytes through `.source` (`StagedMdx` imported as a
value); (iii) a byte-identical source in a module a later task converts
(`section-6.5.ts`'s `U5_BAD_SOURCE` equals `U4_BAD_SOURCE`; neither module imports
the other) is left to that task, which reuses the record by export rather than
registering the bytes twice (Task 10's note). Left plain: T6.4-1's, T6.4-6's, and
T6.4-7's workspaces (each the body's first; T6.4-7's fresh twin holds no initial
files — `copyFrom` seedings of product-written bytes) and T6.7-1's impact arm
(`gitInit`/`gitCommitAll` invoke no product; its first `build` follows).
Read-based enumeration: the 17 creation sites of `section-6.4.ts` and the 3 of
`section-6.7.ts` judged; T6.4-3's twins the one unreached site. Checks: the sites
hook logged 23 lines (14 distinct (test, path) pairs — the task's list;
`specs/Broken.mdx` `"unparseable"`, the rest `"well-formed"`) before and no file
after; the sha256 capture over the two suite files (81 writes, compared sorted)
identical; 8 tests, 7 pass and 1 fail — T6.4-3 — with an identical diagnosis; red
check: an unclosed tag spliced into `T5_TARGET_SOURCE` fails `"T6.4-5
specs/Target.mdx"` as `mdx-derivability` while the Core record passes. Known
state after Task 9: the S-9 self-test 426 tests over 400 records (393 `T…`,
4 `E-6`, 3 `P-…`); self project 22 files, 2566 passed, 0 skipped under the
namespace (~137 s; 2547 + the 19 record tests); certification 144 PASS /
33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 10 (the §6.5 module; 4637836 converts, the closing commit
records).** Forty-nine records, seven of `section-6.4.ts`'s reused. `section-6.5.ts`:
T6.5-1 7 — `fileMoveArm` composes each geometry's sources as before and registers
the `.mdx` ones through the memoizing module-level `t651Record` (a `Map<string,
StagedMdx>`; the record named for its composition inputs — `"T6.5-1 the moved file
importing <own imports> and embedding <binding>"`, `"T6.5-1 the spec importer
importing <specifier>"` — and reused where a later geometry composes the same
bytes: arms (a) and (c) share the moved file, (a) and (d) the importer, so identical
bytes are ONE record staged at each site; a same-name/different-bytes composition
throws at load), `C_SOURCE` wrapped in place, arm (a)'s workspace converted
uniformly, `rewrites[].source` keeping the strings for the byte contract; T6.5-2
10 — the shared and in-line origins wrapped in place, the self-closing arm's origin
and the G, C, D, E, P sources wrapped in their rows, the Beta holder two arms spell
identically hoisted to `X2_B_HOLDER` (one record), `X2_ZED_STAGED` made from the
string the bystander compare uses; T6.5-3 6 — `R3_FILES`'s four sources and the two
third-file sources wrapped in place, `runThirdFileArm`'s `source: StagedMdx` (the
determinism directories are both created before the first run; the third-file arms
follow); T6.5-4 5 — `V4_A_STAGED`/`V4_B_STAGED` made from the window strings, Occ,
Other-valid, and Solo wrapped in place, named `"T6.5-4/T6.6-3/T14-7 …"` (T14-7
spreads `MOVE_REFUSAL_FILES` and `MOVE_DERIVED_PATH_FILES` after its first
invocation, T6.6-3 all five sets) and `"T6.5-4/T6.6-3 precondition arm
specs/Other.mdx as staged (valid)"`; T6.5-5 1 new (`"T6.5-5/T6.6-3 specs/B.mdx"`)
and 7 reused — the U5 sources mirror T6.4-4's byte for byte, so `section-6.4.ts`
exports `U4_SOURCE`, `U4_BAD_SOURCE`, `U4_BROKEN_SOURCE`, `U4_STRAY_SOURCE`,
`U4_DUP_SOURCE`, `U4_ANC_SOURCE`, `U4_SOLO_SOURCE`, renamed with T6.5-5
(`"T6.4-4/T6.5-5/T6.6-3 specs/A.mdx"`, `"T6.4-4/T6.5-5 masking arm
specs/Broken.mdx"`, …), and `section-6.5.ts` aliases them (`const U5_A_SOURCE =
U4_SOURCE;`), the masking arm's `{ unparseable: [U5_BROKEN] }` declaration,
`withWorkspace`'s `mdx` parameter, and the `WorkspaceMdxDecl` import removed; T6.6-3
2 — `MOVE_IDENTITY_FILES_AFTER`, T6.5-6's post-move state that T6.6-3 alone stages
after its first invocation, its entries `"T6.6-3 identity-terms twins specs/A.mdx"`
/ `"… specs/B.mdx"` made from the strings T6.5-6 asserts, created in the exporting
module; T6.5-8 6, T6.5-9 4, T6.5-10 8 — behind their diagnosed failures, judged by
reading; the strings the compares and occurrence spans use kept, records made from
them; `"T6.5-8/T6.5-9 …"` for the two sources `A9_FILES` shares. Every string-typed
files map and arm `files` field widened to `InitialFileContents`. Sub-rules
applied: (i) a helper composing a row's sources from a geometry, where several rows
compose identical bytes, registers them through a memoizing module-level record
function named for exactly the composition inputs the bytes are a function of —
one record per byte sequence, staged at every site, created at load like a
computed table; (ii) a constant byte-identical to another registry module's record
is reused by exporting that record, renaming it with the calling ID, and aliasing
it in the consumer — the consumer's spelling deleted, never re-spelled, the sha256
capture proving identity; (iii) an exported set only another module stages after
its first invocation converts in the exporting module, its records named with the
staging test alone — so Task 12's before-log lacks the eight sets `section-6.6.ts`
imports from `section-6.5.ts`, and Task 23's T14-7 stages records at its second and
third workspaces already. Left plain: T6.5-6's and T6.5-7's workspaces (each the
body's only one), the `copyFrom` seedings of T6.5-1's and T6.5-3's fresh
directories, every `.ts` and `mdout/new` entry. Read-based enumeration: the 29
creation sites judged; T6.5-8's MDX arms, T6.5-9's spec-source arm, and T6.5-10's
arms (b), (c), (c)-sibling the unreached post-invocation sites. Checks: the sites
hook logged 74 lines (32 distinct (test, path) pairs — the task's list;
`specs/Broken.mdx` `"unparseable"`, the rest `"well-formed"`) before and no file
after; the sha256 capture over the suite file (172 writes) identical; 10 tests, 5
pass and 5 fail — T6.5-6, T6.5-7, T6.5-8, T6.5-9, T6.5-10 — with identical
diagnoses; red check: an unclosed tag spliced into `movedFileSource`'s `"A holder
text."` fails the three moved-file records as `mdx-derivability` while the other
file's and the three importers' pass. Known state after Task 10: the S-9 self-test
475 tests over 449 records (442 `T…`, 4 `E-6`, 3 `P-…`); self project 22 files,
2615 passed, 0 skipped under the namespace (~132 s; 2566 + the 49 record tests);
certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23 `certification run
against` lines.

**Resolved by Task 11 (the §6.5-ii and §6.5-iii modules; the first commit converts,
the closing commit records).** Eighty-three records: `section-6.5-ii.ts` 2 —
`ORIGIN_BEFORE` / `TARGET_BEFORE` wrapped in place (`"T6.5-11 specs/origin.mdx"` /
`"… specs/target.mdx"`; every arm stages them through `armFiles`, the first arm's
workspace converted uniformly). `section-6.5-iii.ts` 81 — T6.5-12 3 (`R12_ORIGIN_BEFORE`
wrapped in place, `R12Arm.targetBefore: StagedMdx` wrapped in each row, named by the
row's `name`); T6.5-14 2 (the declarations arm's `F14_DECL_ORIGIN_BEFORE` wrapped in
place, `F14_THIRD_STAGED` made from the string the untouched-file compare keeps; the
local arm's workspace, the body's first, left plain); T6.5-13 22 — `a13CrossArm`'s
`target` typed `StagedMdx`, its origin and third module the module-level
`A13_ORIGIN_STAGED` / `A13_THIRD_STAGED`, every per-arm target, origin, and third file
a `*_STAGED` record made from its string (the strings stay for the offsets the preview
edits pin) or wrapped in place where nothing else reads it (`A13_G_ORIGIN_BEFORE`,
`A13_K_ORIGIN_BEFORE`), `a13ParagraphHeadedArm`'s composed target registered inside it
(`"T6.5-13 arm (l) specs/b.mdx"`, `"… (l, indented) …"`), `A13_DEPENDENT_STAGED` for
(h) and (j), `A13_ARMS`'s first arm converted uniformly; T6.5-19 2 (`A19_A_STAGED`,
`A19_B_ORIGIN_STAGED`, the arms sharing T6.5-13's records otherwise); T6.5-15 11 —
the computed table `J15_STAGINGS` (`{ arm, staging, origin, target }`, `j15Compose`
once at load, the vectors and the runner reading it, the body iterating it) and the
modules as the record map `J15_MODULES` (`j15Module(binding)` the kept generator,
`j15SharedModule` holding `A` and `B` to T6.5-13's third and fourth records at load,
`"T6.5-15 specs/C.mdx …"` its own); T6.5-16 37 — `R16_FLOW_ORIGIN_STAGED`,
`R16_TEXT_PARENT_STAGED`, the per-arm origins registered inside `r16ArmA` / `r16ArmB`
(the arm `key` hoisted and spelled in the name), `R16MovedShape.staged` and
`R16Parent.staged` computed in place through `r16MovedShape(ids, name, origin, moved,
staged?)` (a passed record held to the composition's bytes at load) and the hoisted
parent constants, the (d) family's origins through the memoizing `r16DOrigin(remainder)`
(named for the remainder, `JSON.stringify`ed; the list-marker origin is the
missing-parent applicability arm's too), the (e), (f), (g), (h), (i), collision,
insertion, and created-target sources wrapped in place or registered in their rows,
`r16ArmGTop`'s `target: StagedMdx`; T6.5-17 4 (the origins of `M17_A_FILES`, (b), (c),
and the control). Every string-typed `files` map and arm `files` field widened to
`InitialFileContents` (six interfaces, `withWorkspace`); the S-9 vectors read a record's
text through the module-local `stagedText()` (`R16_FORM_VECTORS`, `M17_FORM_VECTORS`),
so `test/self/s9-fixture-well-formedness.test.ts`'s imports are untouched. Sub-rules
applied: (i) byte-identical sources ACROSS tests and paths are ONE record named with
every staging test in ID order and every path — `<S id="a">\nA text.\n</S>\n`
(`A13_THIRD_SOURCE` = the former `R16_G_THIRD_SOURCE` = `M17_X_SOURCE` = T6.5-15's
`specs/A.mdx`) is `"T6.5-13/T6.5-15/T6.5-16/T6.5-17/T6.5-19/T6.6-3/T6.6-4/T14-7 the
module holding a alone (specs/x.mdx; T6.5-15's specs/A.mdx)"`, likewise the fourth
module `b`, the existing target `k` (`A13_EXISTING_TARGET` = `R16_K`), the (a) target
(`A13_A_TARGET` = `M17_TARGET_SOURCE` = `R16_G_CONTROL_TARGET`), and (d)'s `para` /
`para\n` (T6.5-16's top-level (g) twin's targets) — the consumer constants aliased
(`const R16_K = A13_EXISTING_TARGET;`, `M17_X_STAGED = A13_THIRD_STAGED`, …) or
deleted, never re-spelled; (ii) a record's ID list carries every test that stages it
anywhere: T6.6-3 restages `R16_REFUSED_ARMS`, `R16_ALONE_ARMS`, and `M17_REFUSED_ARMS`
after its first workspace, T6.6-4 the four `A13_TIE_BREAK_ARMS` ((b), (d), (d,
terminated), (g)) in its arm (e), T14-7 every `R16_REFUSED_ARMS` arm but the
`refused-id-collision` one and every `M17_REFUSED_ARMS` arm — so the collision arm's
target is `"T6.5-16/T6.6-3 …"` and the controls `"T6.5-16 …"`; (iii) a consumer module
that reads an exported arm's `files` entry as text takes the record's `.source`: a
value-level touch of `section-6.6.ts` — `tieBreakPlan` reads the origin through
`StagedMdx` (one value import) and `expectRefusedArmPreviewTwin`'s `files` widened —
its own conversion staying Task 12's; `section-14.ts` needs nothing (T14-7 spreads
`arm.files` into `WorkspaceDecl`). Left plain: T6.5-14's local arm and T6.5-18's
workspace (each the body's first), every `.ts` and `xspec.config.ts` entry. Read-based
enumeration: the 3 `withWorkspace` sites of `section-6.5-ii.ts` and the 12 of
`section-6.5-iii.ts` judged; behind their diagnosed failures at the first arm — T6.5-11,
T6.5-13, T6.5-15, T6.5-16, T6.5-17, T6.5-19 — every later arm's site is unreached.
Checks: the sites hook logged the task's 4 (test, path) pairs (4 lines, all
`"well-formed"`) before and no file after; the sha256 capture over the two suite files
(40 writes, compared sorted) identical; 9 tests, 2 pass and 7 fail — T6.5-11, T6.5-13,
T6.5-15, T6.5-16, T6.5-17, T6.5-18, T6.5-19 — with identical diagnoses (~21 s a run).
Known state after Task 11: the S-9 self-test 558 tests over 532 records
(525 `T…`, 4 `E-6`, 3 `P-…`); self project 22 files, 2698 passed, 0 skipped
under the namespace (~141 s; 2615 + the 83 record tests); certification 144 PASS /
33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 12 (the §6.6 module; e921f44 converts, the closing commit
records).** Eight records, one of `section-6.5.ts`'s reused. `section-6.6.ts`:
T6.6-2's move arm — `P2_ORIGIN_SOURCE` wrapped in place (`"T6.6-2 move arm
specs/Origin.mdx"`); its target holds the bytes of T6.5-8/T6.5-9's plain target, so
`section-6.5.ts`'s `A8_PLAIN_TARGET` is exported, renamed
`"T6.5-8/T6.5-9/T6.6-2/T6.6-6 specs/Target.mdx (the plain target)"`, and aliased as
`P2_TARGET_SOURCE` and `R6_TARGET_SOURCE` (T6.6-6's first workspace stages the same
bytes — aliased rather than left as a second spelling of a record's bytes; Task 10's
sub-rule (ii), the name carrying T6.6-6 as Task 6's first-workspace-only callers do);
T6.6-4's arm (b) — `B4_ORIGIN_STAGED`, `B4_TARGET_STAGED`, `B4_THIRD_STAGED`, made
from the strings `armBPlan` and the real-run byte assertion (`preSource`) keep; arm
(c), shared with T6.6-5's two file-form arms — `C4_MV_STAGED`, `C4_PAL_STAGED` (the
expression moved from the deleted `C4_PAL_SOURCE`, nothing else reading it),
`C4_USER_STAGED`, named `"T6.6-4/T6.6-5 …"`, T6.6-5's first workspace converted
uniformly; arm (d), shared with T6.6-5's created-target arm — `D4_SOLO_STAGED`. Arm
(e)'s `A13_TIE_BREAK_ARMS` and every set T6.6-3 stages were records already (Tasks
9–11), so T6.6-3 logged nothing before. Left plain: T6.6-2's rename arm, T6.6-4's
arm (a), T6.6-6's origin (each its body's first workspace). Read-based enumeration:
the 25 creation sites judged; the one unreached post-invocation site is T6.6-3's
scheduling workspace (`TestWorkspace.create(CORE_DECL)`, behind its diagnosed failure
at the identity-terms arm), which stages `section-13.5.ts`'s exported `CORE_DECL` —
its `specs/A.mdx` (`A_MDX`) converts in the exporting module under Task 21, its
record named with T6.6-3 beside the §13.5 tests (Task 10's sub-rule (iii); Task 21's
notes updated). Observation, not converted: `section-5.5.ts`'s `RICH_FILES` spells the
plain target's bytes at `specs/B.mdx` in T5.5-1's two pre-invocation directories
(Task 7 left them plain). Checks: the sites hook logged the task's 13 (test, path)
lines (all `"well-formed"`) before and no file after; the sha256 capture over the
suite file (60 writes) identical; 5 tests, 3 pass and 2 fail — T6.6-3, T6.6-4 — with
identical diagnoses (~47 s a run); red check: an unclosed `mv` tag fails
`"T6.6-4/T6.6-5 specs/Mv.mdx"` alone as `mdx-derivability` among the ledger
self-test's 70 `-t 'T6\.6-'` tests. Known state after Task 12: the S-9 self-test 566
tests over 540 records (533 `T…`, 4 `E-6`, 3 `P-…`); self project 22 files, 2706
passed, 0 skipped under the namespace (~137 s; 2698 + the 8 record tests);
certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23 `certification run
against` lines.

**Resolved by Task 13 (the §7 basics, discovery, and §7.1–7.3 modules; 362a689
converts, the closing commit records).** Seventeen records. `section-7-basics.ts` 5 —
the minimal sources `mdxSection("a")` and `mdxSection("b")`, staged byte-identically
after a body's first invocation by tests of all three modules, are ONE record each
(Task 11's sub-rule (i)), created and EXPORTED by the first module in registry order
and imported by the two others (Task 10's sub-rule (ii)): `SECTION_A_SOURCE`
`"T7-1/T7-2/T7-3/T7-4/T7-6/T7.1-1/T7.3-1 specs/A.mdx (the minimal section a)"` and
`SECTION_B_SOURCE` `"T7-3/T7-4/T7-6/T7.3-1 the minimal section b (specs/sub/B.mdx;
T7-4's specs2/B.mdx)"`; `expectConfigRefused`'s one staging site serves every arm
(the first included), and T7-1's no-configuration and occupancy workspaces, T7-2's
four later workspaces and `configurationViewOf`, and T7-3's (b)–(d) take them;
`QUOTED_KEYS_FILES`'s literal (`"T7-2 string-literal keys specs/A.mdx"`),
`PRODUCT_MDX`, and `OTHER_MDX` wrapped in place, the maps widened.
`section-7-discovery.ts` 12 — sub-rule applied: a probe table a run-time map builder
(`probeFiles`) renders from module-level rows gains a `source: StagedMdx` row field
(`DiscoveryProbe.source?`, required by `StagedProbe`), the builder staging
`probe.source ?? mdxSection(probe.id)` and returning the record-accepting map, the
later workspaces' tables typed `StagedProbe[]` and the first workspace's
(`SEMANTICS_PROBES`) left plain rows; a probe id several tables share is one record
(`SECTION_C_SOURCE` for the casing and inside-root controls, `SECTION_N_SOURCE`
`"T7-4/T7-6 …"` for T7-4's `a/N.mdx` and T7-6's `notes/N.mdx`); the `b/M.mdx`
decoy's record is made from the kept string `M_SOURCE`, which `BESIDE_ROOT_MATCH`
still writes beside the root through `stageBesideRoot` (Task 6's observation: a raw
write outside the builder, no record site); the byte and configuration-directory
probes are per-probe records named with the path as spelled (the `é` paths
included); T7-6's import-arm sources wrapped in place and `UNLISTED_SOURCE` for
`other/unlisted.mdx` — the task's `unchecked` premise was stale (the entry carries no
declaration; it converts, and nothing remains for the sites check).
`section-7.1-7.3.ts` 0 new — `expectConfigRefused`'s one site, T7.1-1's
non-`.mdx`-match workspace, `EMISSION_FILES` (T7.3-1's five emission workspaces, the
first included), the two destination maps, and (g) take the imported records, the
maps widened. Left plain: T7-1's `LOCATION_FILES`, T7-4's semantics probes, T7-5's
link workspace, T7-6's (a), T7.1-1's `TWO_GROUP_FILES`, T7.2-1's overlap workspace
(each its body's first); the files written beside the root (T7-4's `x/M.mdx`, T7-5's
`outside/X.mdx`); `specs/notes.txt` (no `.mdx` path). Read-based enumeration: the
15 + 15 + 13 creation sites judged; behind the diagnosed failures — T7-4's
inside-root arms (the reachable list lacks `b/M.mdx` and `a/N.mdx`), T7-1's occupancy
workspace, T7-2's and T7-3's later arms — every site is a record. For the next
tasks: `section-7.4-7.5.ts` (Task 14) spells the same `mdxSection` template and
stages `"specs/A.mdx": mdxSection("a")` at two sites (T7.4-1's and T7.5-1's reachable
lists name `specs/A.mdx`) — where such a site is post-invocation, reuse
`SECTION_A_SOURCE` by import and rename it with the staging IDs in ID order (likewise
`SECTION_B_SOURCE` for `mdxSection("b")`), never re-spell; `section-12.6.ts`'s
`VALID_SOURCE` (Task 20; T12.6-2's post-invocation `specs/A.mdx`) is byte-identical to
`SECTION_A_SOURCE` — reuse by import and rename (`"…/T12.6-2 …"`). Checks: the sites
hook logged the task's 17 (test, path) pairs (57 lines, all `"well-formed"`) before
and no file after; the sha256 capture over the three suite files (171 writes,
compared sorted) identical; 9 tests, 4 pass (T7-5, T7-6, T7.1-1, T7.2-1) and 5 fail —
T7-1, T7-2, T7-3, T7-4, T7.3-1 — with identical diagnoses (~20 s a run); red check:
an unclosed tag spliced into `section-7-basics.ts`'s `mdxSection` template fails the
A, B, and O records as `mdx-derivability` while the 14 others (discovery's own
template) pass. Known state after Task 13: the S-9 self-test 583 tests over 557
records (550 `T…`, 4 `E-6`, 3 `P-…`); self project 22 files, 2723 passed, 0 skipped
under the namespace (~140 s; 2706 + the 17 record tests); certification
144 PASS / 33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 14 (the §7.4–7.5 module; d2e5db5 converts, the closing commit
records).** Twenty-six records, two of the other §7 modules' reused. Reused:
`section-7-basics.ts`'s `SECTION_A_SOURCE` (`mdxSection("a")`), imported and renamed
`"T7-1/T7-2/T7-3/T7-4/T7-6/T7.1-1/T7.3-1/T7.4-1/T7.5-1/T7.5-5 specs/A.mdx (the minimal
section a; T7.5-5's tgt/a.mdx)"` — `MATRIX_FILES`' and `DUAL_FILES`' `specs/A.mdx`,
`CAPTURE_STAR_FILES`' `tgt/a.mdx`; `section-7-discovery.ts`'s `SECTION_C_SOURCE`
(`mdxSection("c")` — the three §7 templates are byte-identical, so Task 13's
module-local record holds the same bytes), now exported and renamed `"T7-4/T7.5-4/T7.5-5
the minimal section c (T7-4's ctl/C.mdx, the control source; T7.5-4's specs/C.mdx;
T7.5-5's tgt/c.mdx)"` — `SELECTOR_FILES_FILES`' `specs/C.mdx`, `CAPTURE_STAR_FILES`'
`tgt/c.mdx`; the module spells no `mdxSection("b")`, so `SECTION_B_SOURCE` is untouched.
This module's minimal sections, one record per byte sequence named with every staging
test in ID order and every path: x (`"T7.4-1/T7.5-1/T7.5-5 the minimal section x
(aux/X.mdx; T7.5-5's tgt/abc.mdx)"`), d (`"T7.4-1/T7.5-1/T7.5-4 … (dualspec/D.mdx;
T7.5-4's specs/D.mdx)"`), t (`"T7.5-1/T7.5-4/T7.5-5 tgt/T.mdx (the minimal section t)"`:
the set-reading rule fixture, the tags selector, T7.5-5's (c), (h), (i)), g and w (the
mirror fixture), p (`tgt/P.mdx` of (e) and (g), `tgt/t$0.mdx` of (f), `tgt/t$z.mdx` of
(j)), q (`tgt/tb.mdx`; `tgt/tz.mdx`), r (`tgt/t0.mdx`; `tgt/tQz.mdx`); the eighteen
literal-bodied sources wrapped in place or hoisted (below), named by fixture or arm
letter. Sub-rules applied: (i) a fixture-builder function called at module level
(`setReadingProfileFiles(targetTags, edgeKinds)`, `setReadingRuleFiles(kinds, tags)`)
whose `.mdx` values are parameter-independent literals — the spelled workspace and its
collapsed twin stage the same bytes — moves those literals to module-level records
declared BEFORE the function (the module-level call follows the definition, and a
`const` record is unusable until initialized), one record each staged in both
spellings (`"T7.4-1 set reading tgt/T.mdx (the spelled profile and its collapsed
twin)"`, `"… bnd/B.mdx …"`, `"T7.5-1 set reading pol/P.mdx (the spelled rule and its
collapsed twin)"`), the builder's return type widened; (ii) a module whose template a
third module spells byte-identically imports the OTHER modules' records for the ids
they already hold (A from basics, C from discovery — exported and renamed) and
registers its own ids once each; (iii) the task's "move arms" were a stale premise —
`PROFILE_MATRIX` / `RULE_MATRIX` rows hold configuration field lines, not files; the
`.mdx` entries live in the shared `MATRIX_FILES` / `DUAL_FILES` maps, converted by the
shared-map rule (the first arm's workspace served by the same map). The four `files`
parameters and the two builder return types widened to `InitialFileContents`; the
module declares no workspace `mdx` list. Left plain: each body's first workspace —
T7.4-2's `SEMANTICS_FILES`, T7.5-2's `FORBIDDEN_FILES`, T7.5-3's `ALLOWED_ONLY_FILES`,
T7.5-4's `SELECTOR_KIND_FILES`, T7.5-5's `CAPTURE_PAIR_FILES`, T7.5-6's
`BUILD_VS_CHECK_FILES` (their `mdxSection` calls too, as Task 13 left
`LOCATION_FILES`') — and T7.5-6's tampered generated module (no `.mdx` path).
Read-based enumeration: the 11 `withWorkspace` sites (12 creations with the
`TestWorkspace.create` inside it) judged; T7.4-1 and T7.5-1 fail at their set-reading
`inventory` assertion in their LAST workspace, so nothing lies behind the diagnosed
failures. Observation for the next determination, not acted on (outside the task): a
one-off probe over the sealed ledger (AGENTS.md's recipe) finds 28 groups of
byte-identical records under different names across modules, registered separately by
earlier tasks — e.g. `"T1.5-2 the valid section source at every arm's spec path"` =
`"T1.6-5 code arm specs/OK.mdx"`; `"T2.1-2/T2.1-3 specs/BASE.mdx"` = `"T4-2
specs/BASE.mdx"` = `"T4-2 src/NAME.mdx"`; `"T4.3-2 specs/A.mdx"` =
`"T4.5-3/T4.5-4/T4.5-5/T4.5-6/T4.5-7 specs/A.mdx"`; `"T6.1-1/T6.1-2/T6.1-3 specs/A.mdx"`
= `"T6.3-2 specs/A.mdx"`; `"T10.2-2 specs/A.mdx with the kid text at v2 (--base arm)"` =
`"T10.3-2 specs/A.mdx with the kid text at v2"` — each judged by the self-test all the
same (S-9 is satisfied; the naming rule's "reused, never duplicated" was applied within
a task's modules and where a module knew of another's record); none of this task's 26
records duplicates another's bytes. Checks: the sites hook logged the task's 38 (test,
path) pairs (120 lines, all `"well-formed"`) before and no file after; the sha256
capture over the suite file (255 writes) identical; 8 tests, 6 pass and 2 fail —
T7.4-1, T7.5-1 — with identical diagnoses (~35 s a run); red check: an unclosed tag
spliced into this module's `mdxSection` template fails exactly its eight
template-built records as `mdx-derivability` while the A and C records and the 18
literal-bodied ones pass. Known state after Task 14: the S-9 self-test 609 tests over
583 records (576 `T…`, 4 `E-6`, 3 `P-…`); self project 22 files, 2749 passed, 0 skipped
under the namespace (~140 s; 2723 + the 26 record tests); certification 144 PASS /
33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 15 (the §8, §9, §9.3, and §10.1–10.3 modules; b1a7666 converts, the
closing commit records).** Nine records. `section-8.ts` 5 — T8-5's required-set fixture
(arm (b), after arm (a)'s invocations): `REQUIRED_SET_FILES`' `tgt/T.mdx`, `bnd/B.mdx`,
`oth/O.mdx` wrapped in place (`"T8-5 required-set fixture tgt/T.mdx"`, …); T8.2-1's
covered fixture (the "0 otherwise" arm, after the report workspace's invocations):
`CHECK_GREEN_FILES`' `tgt/T.mdx` and `bnd/B.mdx` wrapped in place (`"T8.2-1 covered
fixture tgt/T.mdx"`, …). `section-9.ts` 0 — its seven bodies create one workspace each,
at body start (nothing converts; its `withWorkspace` untouched). `section-9.3.ts` 1 —
T9.3-3's arm-2 baseline, `D2_BASELINE` wrapped in place (`"T9.3-3 arm 2 specs/Twice.mdx
(the baseline)"`); `editSourceExpecting` is an `edit()`. `section-10.1.ts` 1 — the
shared `CORE_FILES` / `COVERAGE_FILES` `specs/A.mdx` as ONE record made FROM `A_MDX`
(the string stays for the `A_MDX_EDITED` staleness edit), `A_MDX_STAGED`
`"T10.1-1/T10.1-2/T10.1-3/T10.1-4/T10.1-5/T10.1-6 specs/A.mdx"`: the post-invocation
sites are T10.1-1's determinism twins (`TestWorkspace.create({ files: CORE_FILES })`),
T10.1-4's per-state workspaces after the first, and T10.1-6's occupancy twins after the
first; T10.1-2 and T10.1-3 stage the map in their single workspaces and their exported
probe runners (the Windows leg's `e6-subset.test.ts`); T10.1-5's inline map takes the
record at `specs/A.mdx` (the same constant in the body's first workspace — the record
rather than a plain spelling of its bytes; `T10_1_5_B_VALID` stays plain).
`section-10.2-10.3.ts` 2 — T10.2-2's audit and coverage arms' initial files as
`T10_2_2_KID_E0` (`"T10.2-2 specs/A.mdx with the kid text at e0 (audit arm)"`) and
`T10_2_2_UNCOVERED_E0` (`"T10.2-2 specs/U.mdx with the uncovered leaf at e0 (coverage
arm)"`), the template calls moved to module level beside the arms' edit records; the
`--base` arm's v0 entry stays plain. The four converted modules' `withWorkspace` `files`
parameters and the §8 and §10.1 maps widened to `InitialFileContents`; none declares a
workspace `mdx` list. Left plain: every body's first workspace (T8-1…T8-4, T8-5's
root-exclusion, T8.2-1's report, T9-1…T9.2-5, T9.3-1, T9.3-2, T9.3-3's arm 1, T10.2-1,
T10.2-2's `--base` arm, T10.2-3, T10.2-4, T10.3-1, T10.3-2). Read-based enumeration: the
9 + 8 + 5 + 23 + 9 creation sites judged; behind T10.1-6's diagnosed failure (its second
workspace) lie five more `CORE_FILES` twins — records by the same map. Observation for
the determination, not acted on: the ledger-wide duplicate-bytes probe (AGENTS.md) shows
the new §10.1 record holds the bytes of `"T6.1-1/T6.1-2/T6.1-3 specs/A.mdx"` and
`"T6.3-2 specs/A.mdx"` (Task 8's, registered separately) — Task 14's 28 cross-module
groups are 28 still, that one grown to three members; the record is registered in its
own module, as this task prescribed and as Task 14 left the groups, and none of the
other eight new records duplicates any record's bytes. Checks: the sites hook logged the
task's 11 (test, path) pairs (22 lines, all `"well-formed"`) before and no file after;
the sha256 capture over the five suite files (179 writes, compared sorted) identical;
28 tests, 27 pass and 1 fails — T10.1-6 — with an identical diagnosis (~75 s a run);
red check: an unclosed tag spliced into the required-set `tgt/T.mdx` body and into
`t2Spec("Kid text e0.")` fails exactly those two records as `mdx-derivability`, the
other 18 under the sections' filter pass. Known state after Task 15: the S-9 self-test
618 tests over 592 records (585 `T…`, 4 `E-6`, 3 `P-…`); self project 22 files, 2758
passed, 0 skipped under the namespace (~125 s; 2749 + the 9 record tests); certification
144 PASS / 33 FAIL / 0 error / 0 hang over the 23 `certification run against` lines.

**Resolved by Task 16 (the §10.4–10.7 modules; e660a9c converts, the closing commit
records).** Twenty-one new records, one existing record reused. `section-10.4.ts` 12 —
T10.4-1's five later scenarios' initial files as `T10_4_1_PC_INITIAL`, `_DC_`, `_MC_`,
`_CI_`, `_UR_` (`"T10.4-1 parent-consistency specs/P.mdx at the baseline (the
scenario's initial source)"`, …: the same template calls moved to module level beside
each scenario's state table; the subtree-coherence scenario's S, the body's first
workspace, plain); T10.4-2's context arm (`T10_4_2_C_INITIAL`) and origin arm
(`T2O_X_SOURCE` wrapped in place, `T10_4_2_T_INITIAL`, `T10_4_2_O_INITIAL`; the first
arm's X plain); T10.4-4's move and reintroduction arms (`T4M_B_SOURCE`, `T4M_D_SOURCE`,
`T4I_SOURCE` wrapped in place; the rename arm's `T4R_SOURCE` plain). `section-10.5.ts`
3 — `T10_5_1_X1_INITIAL`, `T10_5_1_Y_INITIAL` (T10.5-1's extended and chain fixtures),
`T10_5_5_V_INITIAL` (T10.5-5's decomposition sub-fixture). `section-10.6.ts` 0 new —
the split sub-fixture's `F_SOURCE` spelled byte for byte the bytes of the existing
`T10_6_2_B_WITHOUT_FE` record (`b2Spec(false)`: a > a.b, then s), found by the
ledger-wide duplicate-bytes probe after a first conversion had registered it as a
second record; it is that record — aliased (`const F_SOURCE = T10_6_2_B_WITHOUT_FE;`
after the record), renamed `"T10.6-2 specs/B.mdx with the f and e sections deleted
(the split sub-fixture's initial specs/F.mdx: the same bytes)"`, the literal spelling
deleted (the naming rule's "reused, never duplicated", within one test).
`section-10.7-i.ts` 2 — `W1_SOURCE` wrapped in place, ONE record staged by T10.7-1's
first workspace and by each corrupt-session state's workspace (`"T10.7-1 specs/W.mdx
(the flag-exclusivity workspace's initial source and each corrupt-session state's)"`);
`T10_7_2_A_LEAF`, the `leafSpec("a", "Aye text.")` call T10.7-2's coverage arm (the
body's first workspace) and audit arm spell identically, hoisted once and staged at
both (the coverage arm's G plain). `section-10.7-ii.ts` 4 — `T10_7_7_A2_KID_V0`
(T10.7-7's payload arm; the empty-session arm stages no file), `T10_7_9_H_INITIAL`
(T10.7-9's audit arm), `T10_7_12_B_T0` and `U12_SOURCE` wrapped in place (T10.7-12's
provenance and coverage sub-fixtures). The five `withWorkspace` `files` parameters
widened to `InitialFileContents`; no module declares a workspace `mdx` list. Sub-rule
applied: a new initial-file record whose bytes and declaration equal an existing
record's of the SAME module is that record, aliased and renamed for both sites — run
the duplicate-bytes probe (AGENTS.md) BEFORE a task's closing commit, since a
same-module duplicate is a conversion mistake the S-9 self-test does not flag (a
cross-module group stays Task 14's observation). Left plain: every body's first
workspace (T10.4-1's S, T10.4-2's X, T10.4-3, T10.4-4's R, T10.4-5, T10.5-1's SPEC 15
files, T10.5-2…T10.5-4, T10.5-5's W, T10.5-6, T10.6-1, T10.6-2's B and a, T10.6-3,
T10.7-1's first W workspace — the same record —, T10.7-2's G, T10.7-3…T10.7-6,
T10.7-7's `N7_FILE`, T10.7-8, T10.7-9's G, T10.7-10, T10.7-11, T10.7-12's `M12_FILE`),
every session, journal, and `.ts` entry. Read-based enumeration: the 14 + 9 + 4 + 8 +
11 `withWorkspace` sites judged (the task's 15/10/5/9/12 count each module's
`TestWorkspace.create` helper too; T10.7-1's corrupt-session loop is one site); no
§10.4–10.7 test fails, so nothing lies behind a diagnosed failure. Checks: the sites
hook logged the task's 22 (test, path) pairs (25 lines, all `"well-formed"`) before
and no file after; the sha256 capture over the five suite files (198 writes, compared
sorted) identical, and `section-10.6.test` re-captured after the F.mdx reuse
(identical); 26 tests, 26 pass before and after with identical verdict lines (~94 s a
run); red check: an unclosed tag spliced into the U.mdx initial record and into the
F.mdx source fails exactly those two as `mdx-derivability` under the ledger
self-test's `-t 'T10\.[4-7]-'` filter (85 tests). Known state after Task 16: the S-9
self-test 639 tests over 613 records (606 `T…`, 4 `E-6`, 3 `P-…`); self project 22
files, 2779 passed, 0 skipped under the namespace (~120 s; 2758 + the 21
record tests); certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23
`certification run against` lines; the ledger-wide duplicate-bytes probe 613 records
in 28 groups, none changed since Task 15.

**Resolved by Task 17 (the §11, §11.2, and §11.3 modules; the first commit
converts, the closing commit records).** Twenty-seven new records, one existing
record reused. `section-11.ts` 3 — T11-2's shared map `T11_2_FILES` (spread into
its workspace and its configuration-state twins, the twins behind its diagnosed
failure): `T11_2_A_STAGED` / `T11_2_B_STAGED` (`"T11-2 specs/alpha/A.mdx"`,
`"T11-2 specs/beta/B.mdx"`) made from the strings the range pins use; T11-4's
`T11_4_SOURCE` wrapped in place (`"T11-4 specs/E.mdx"`; its map spread into the
workspace and the reached twins); the two maps and `withWorkspace`'s `files`
widened; T11-7's two directories are both created before either run
(`assertAcrossDirectoriesDeterministic`, Task 7's T5.5-1 precedent), so
`T11_7_FILES` stays plain. `section-11.2.ts` 13 — the finding-free `specs/C.mdx`
that T11.2-1, T11.2-5, and T11.2-6 stage (T11.2-6's third fixture at
`specs/A.mdx` too) is ONE record `C_STAGED` (`"T11.2-1/T11.2-5/T11.2-6
specs/C.mdx (…)"`) staged at all seven sites; `OK_STAGED` (`"T11.2-3/T11.3-1
specs/OK.mdx …"`) and `R_STAGED` (`"T11.2-4/T11.3-1 specs/R.mdx …"`) exported
beside the kept `OK_SOURCE` / `R_SOURCE` strings, T11.2-3's and T11.2-4's first
workspaces taking them; T11.2-4's later workspaces — `CH_A_STAGED` /
`CH_B_STAGED` / `CH_C_STAGED`, `CY_STAGED`, `IMP_STAGED` / `GONE_STAGED`, and
the enclosure rows' `EnclosureStaging.staged`, registered inside
`stageEnclosure` from the same `f.source` it returns (`` `T11.2-4 specs/ENCL.mdx
(${label})` ``; two module-level calls); T11.2-5's `D_STAGED` / `E_STAGED`.
Every `ByteFixture`-derived source keeps its string (the sliceChecks read it)
and the record is made from it. `section-11.3.ts` 5 — T11.3-2's `CONJ_T_SOURCE`
/ `CONJ_P_SOURCE` / `CONJ_Q_SOURCE` and T11.3-3's `SEL_BASE_SOURCE` /
`SEL_USE_SOURCE` wrapped in place (each body's second workspace, behind its
diagnosed failure in the first); T11.3-1's later workspaces take the imported
records. `section-5.7.ts` 6 new, 1 reused — the fixtures T11.3-1 restages:
`SPAN_BASE_STAGED` / `SPAN_MAIN_STAGED` (`"T5.7-2/T11.3-1 …"`), `ORD_ZED_STAGED`
/ `ORD_ALPHA_STAGED` (`"T5.7-3/T11.3-1 …"`), `NO_OCC_SPARE_STAGED` /
`NO_OCC_MAIN_STAGED` (`"T5.7-4/T11.3-1 …"`), exported records made from the kept
strings, T5.7-2's, T5.7-3's, and T5.7-4's first workspaces taking them too (the
record rather than a plain spelling of its bytes); `NO_OCC_BASE_STAGED` is an
alias of the token-bounds base record `TOKEN_BASE_SOURCE` — same module, same
bytes: the duplicate-bytes probe found the first conversion's second record
(Task 16's sub-rule) — renamed `"T5.7-2/T5.7-4/T11.3-1 specs/BASE.mdx (…)"`,
the `NO_OCC_BASE_SOURCE` literal deleted. Sub-rules applied: (i) a
`stageConfigurationStateTwins` call that PRECEDES the body's first invocation
(T11.3-3's twins, created before the gate `build --json`) is a pre-invocation
site — its map stays plain, S-7's sweep reaching it; (ii) an exported string
constant another module stages post-invocation converts in the exporting module
as a record made FROM the string wherever that module's pins read the string
(`X_STAGED` beside `X_SOURCE`), the consumer importing the record and keeping
the string import only where it reads it (`R_SOURCE`); (iii) a same-module
byte-identical record the probe finds is aliased after the record and renamed
(Task 16), a cross-module one recorded (Task 14). Left plain: every body's
first workspace (T11-1, T11-3, T11-5, T11-6, T11-7's pair, T11.2-1…T11.2-3,
T11.2-4's matrix workspace otherwise, T11.2-5's and T11.2-6's first fixtures
otherwise, T11.3-1's T5.7-1 fixture, T11.3-2's and T11.3-3's first workspaces
with their `unparseable` declarations, T11.3-4), T11.3-3's twins, every
non-`.mdx` entry. Read-based enumeration: the 10 + 13 + 12 creation sites
judged. Observation for the determination, not acted on: `NO_OCC_SPARE_STAGED`
spells `"T6.5-3 specs/Spare.mdx"`'s bytes — a 29th cross-module group. Checks:
the sites hook logged the task's 19 (test, path) pairs (23 lines, all
`"well-formed"`) before and no file after; the sha256 capture over the four
suite files (`section-5.7.test` included; 152 writes, compared sorted)
identical; 21 tests, 14 pass and 7 fail — T11-2, T11-6, T11-7, T11.2-6,
T11.3-2, T11.3-3, T5.7-4 — with identical verdict lines and diagnoses (~24 s a
run); red check: an unclosed tag spliced into `T11_4_LEAF` and into
`CONJ_T_SOURCE` fails exactly those two records as `mdx-derivability` under the
ledger self-test's `-t 'T11[-.]|T5\.7-'` filter (37 tests). Known state after
Task 17: the S-9 self-test 666 tests over 640 records (633 `T…`, 4 `E-6`, 3
`P-…`); self project 22 files, 2806 passed, 0 skipped under the namespace
(~120 s; 2779 + the 27 record tests); certification 144 PASS / 33 FAIL /
0 error / 0 hang over the 23 `certification run against` lines; the
ledger-wide duplicate-bytes probe 640 records in 29 groups.

**Resolved by Task 18 (the §11.4, §11.5, and §11.6 modules; 65da001 converts, the
closing commit records).** Seventeen new records, one existing record reused.
`section-11.4.ts` 7 new, 1 reused — T11.4-3's shared workspace (its third, after
invocations 1 and 2; behind its diagnosed failure, judged by reading) stages
T2.7-3's valueless-`tags` arm record — Task 5's note resolved: the staging IS
post-invocation, so `section-2.7.ts` exports the record as `VALUELESS_TAGS_STAGED`
(made from `VALUELESS_TAGS_FIXTURE.source`; the exported fixture keeps its string
for its offsets), renamed ``"T2.7-3/T11.4-3 a valueless `tags` (`<S id="x" tags>`,
the file T11.4-3 shares) specs/A.mdx"``, the arm row carrying it as
`InvalidPropArm.shared` with the arm's name spelled once
(`VALUELESS_TAGS_ARM_NAME`) and the computed table taking `arm.shared ??
stagedMdx(…)` — sub-rule: a computed record table one of whose rows another test
stages by import takes an optional row field naming the shared record (Task 13's
`DiscoveryProbe.source?` form), the record created before the table from the
exported constant; T11.4-5's cycle workspace (`CYE_STAGED`, `CYL_STAGED`), masked
workspace (`MKM_STAGED`; `MK_GONE_SOURCE` wrapped in place carrying
`"unparseable"`, the `mdx: { unparseable: [MK_GONE_FILE] }` declaration removed),
and invalid-path workspace (`IP_STAGED` at `specs/vi#ew.mdx`, an ordinary key);
T11.4-6's imperfect workspace (`BCT_SOURCE` wrapped in place, `BCI_STAGED`; behind
its diagnosed failure). Every `ByteFixture`-derived source keeps its string (the
slice checks read it) and the record is made from it (Task 17's form).
`section-11.5.ts` 1 — T11.5-3's configuration-less twin (behind its diagnosed
failure): `RC_STAGED` (`"T11.5-3 specs/A<U+FFFD>.mdx (…)"`, the U+FFFD spelled as
the test's contexts spell it) made from `RC_SOURCE`, the operand workspace taking
the record too. `section-11.6.ts` 9 — `ANCHOR_SOURCE` wrapped in place
(`"T11.6-1/T11.6-4 specs/a.mdx (…)"`: T11.6-1's first workspace and T11.6-4's
invalid-configuration workspace); T11.6-2's emit, outDir, disabled, and sets
workspaces' six inline literals hoisted to module-level records named by workspace
and path; T11.6-3's sessions workspace and T11.6-4's corrupt-record workspace
likewise (the literals moved by a script extracting them from the module text,
never re-spelled — AGENTS.md). Left plain: every body's first workspace (T11.4-1,
T11.4-2, T11.4-3's matrix, T11.4-4, T11.4-5's chain, T11.4-6's emission, T11.5-1,
T11.5-2, T11.5-3's operand workspace otherwise, T11.6-1, T11.6-2's defaults,
T11.6-3's record, T11.6-4's imperfect), their `unparseable` declarations (T11.4-2,
T11.4-4, T11.5-3, T11.6-4) staying; the file-less `create({})` twins (T11.6-1's far
tree, T11.6-4's missing configuration). Read-based enumeration: the 11 + 4 + 13
creation sites judged; behind the diagnosed failures lie T11.4-3's shared,
T11.4-6's imperfect, and T11.5-3's configuration-less workspaces — records;
T11.6-2 fails at or after its last (sets) workspace, all six later paths reached.
Checks: the sites hook logged the task's 14 (test, path) pairs plus T2.7-3's
deferred `specs/A.mdx` `"unparseable"` (15 lines; `section-2.7.test` run beside the
three §11 files for the reused record's byte identity) before and that one
remainder alone after; the sha256 capture over the four suite files (152 writes,
compared sorted) identical; 17 tests, 9 pass and 8 fail — T11.4-2, T11.4-3,
T11.4-4, T11.4-6, T11.5-3, T11.6-2, T2.7-3, T2.7-4 — with identical verdict lines
and diagnoses (~57 s a run); red check: an unclosed tag spliced into the
`aux/x.mdx` record (section-11.6.ts) and the `specs/tgt.mdx` record
(section-11.4.ts) fails exactly those two as `mdx-derivability` under the ledger
self-test's `-t 'T11\.[456]-|T2\.7-3'` filter (34 tests). Known state after
Task 18: the S-9 self-test 683 tests over 657 records (650 `T…`, 4 `E-6`, 3 `P-…`);
self project 22 files, 2823 passed, 0 skipped under the namespace (~117 s; 2806 +
the 17 record tests); certification 144 PASS / 33 FAIL / 0 error / 0 hang over the
23 `certification run against` lines; the ledger-wide duplicate-bytes probe 657
records in the same 29 groups.

**Resolved by Task 19 (the §12.0 modules; 8a4583f converts, the closing commit
records).** Thirteen records. `section-12.0-i.ts` 7 — `STREAMS_VALID_SOURCE` (the
minimal section a: `<S id="a">`, `Alpha text.`) wrapped in place and EXPORTED as ONE
record for every §12.0 site spelling its bytes (`"T12.0-2/T12.0-3/T12.0-9/T12.0-10/T12.0-14
specs/A.mdx (the minimal section a: …)"`: T12.0-2's usage- and configuration-error
arms, T12.0-3's relative-resolution workspace, T12.0-9's corrupt-session and
configuration-error arms, T12.0-10's past-the-gate workspace, T12.0-14's grammar
workspace — the `section-12.0-ii.ts` and `section-12.0-iii.ts` spellings deleted,
`GRAMMAR_SOURCE` with them); `STREAMS_INVALID_SOURCE` likewise (`"T12.0-2/T12.0-9 …"`:
T12.0-2's first workspace, T12.0-9's findings arm by import); `ALT_SOURCE` (T12.0-3's
`alt/aspecs/B.mdx`), `ADDRESSING_SOURCE` (T12.0-5's first workspace and its
configuration-state twins, one record), `CASE_SOURCE` (T12.0-6's casing workspace; the
NFC/NFD tag constants untouched), and the two-casing workspace's literals moved to
module level (`T12_0_6_UPPER_CASING` / `T12_0_6_LOWER_CASING`). `section-12.0-ii.ts`
5 — T12.0-8's coverage arm (`TIE_BOUNDARY_SOURCE`, `TIE_TARGET_SOURCE` wrapped in
place) and impact arm (`T12_0_8_M_V1`, the template call moved beside the existing v2
edit record); T12.0-9's findings-arm `specs/U.mdx` (`T12_0_9_U_SOURCE`); the minimal
section alpha that T12.0-9's wrong-kind and exclusion arms and T12.0-10's precedence
pair and syntax workspace spell identically — ONE record `ALPHA_SECTION_STAGED`
(`"T12.0-9/T12.0-10 …"`), `PRECEDENCE_TWIN_FILES` / `PRECEDENCE_FAILING_FILES` widened
(the precedence pair precedes T12.0-10's first `build`; its `specs/Broken.mdx` stays
plain under the workspace `unparseable` declaration). `section-12.0-iii.ts` 1 —
T12.0-14's `--config`-first workspace's `cfg/specs/B.mdx` (`T12_0_14_CFG_B_SOURCE`, the
literal moved; behind the diagnosed failure at `--json ids`, judged by reading). No new
sub-rule: a byte sequence several modules of one task spell is ONE record created and
exported by the first module in registry order and imported by the others (Task 13's
form), named with every staging test, first-workspace callers included (T12.0-14's
grammar workspace; Task 12's "aliased rather than left as a second spelling"). Left
plain: T12.0-1's, T12.0-3's, and T12.0-4's sweep workspaces (`createSweepWorkspace`,
each its body's first), T12.0-6's single-casing probe (its first; the Windows leg
reruns it), T12.0-7's two story workspaces (both before its first invocation),
T12.0-9's story workspace and its omega edit, T12.0-8's reachable arm, T12.0-11's,
T12.0-12's, and T12.0-13's single workspaces, T12.0-10's `specs/Broken.mdx` and its
file-less missing-configuration twin, every session, `.ts`, and configuration entry.
Read-based enumeration: 12 + 19 + 2 creation call sites judged; T12.0-10 fails at its
syntax rows in its last workspace pair (both later sites reached), T12.0-14 at
`--json ids` in its first workspace (its second workspace the one unreached site, a
record). Recovery: the conversion was drafted by an iteration that died before
committing; this one re-verified it — the before side re-run from HEAD's copies of the
three modules, the after side from the working tree it committed. Observation for the
determination, not acted on (Task 14's class): the duplicate-bytes probe finds 670
records in 30 groups — `STREAMS_VALID_SOURCE` joins the §6.3 `specs/A.mdx` group,
`T12_0_14_CFG_B_SOURCE` the §6.1/§6.5 `specs/B.mdx` group, and `ALT_SOURCE` forms a
30th with `"T10.7-2 specs/B.mdx with leaf b (…)"`; none within the §12.0 modules (Task
21's notes updated: `section-13.4.ts`'s `RELOCATED_MDX` spells `STREAMS_VALID_SOURCE`'s
bytes). Checks: the sites hook logged the task's 13 (test, path) pairs (20 lines, all
`"well-formed"`) before and no file after; the sha256 capture over the three suite
files (85 writes, compared sorted) identical; 14 tests, 12 pass and 2 fail — T12.0-10,
T12.0-14 — with identical verdict lines and diagnoses (~62 s a run); red check: an
unclosed tag spliced into the addressing record and the coverage arm's
`specs/tgt/T.mdx` record fails exactly those two as `mdx-derivability` under the
ledger self-test's `-t 'T12\.0-'` filter (14 tests). Known state after Task 19: the
S-9 self-test 696 tests over 670 records (663 `T…`, 4 `E-6`, 3 `P-…`); self project
22 files, 2836 passed, 0 skipped under the namespace (~88 s; 2823 + the 13 record
tests); certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23
`certification run against` lines; the ledger-wide duplicate-bytes probe 670 records
in 30 groups.

**Resolved by Task 20 (the §12.1–§12.7 modules; b38740e converts, the closing commit
records).** Sixteen records net (seventeen new, two existing collapsed into one, one of
another module's reused). `section-12.1-12.2.ts` +4 net — the valid a1 source
(`<S id="a1">`, `Alpha behavior.`) was spelled three times with identical bytes: as
T12.1-3's `T12_1_3_ALPHA_SOURCE` record, as `FAILED_BUILD_VALID_SOURCE` (both from the
previous plan — a same-module group of the duplicate-bytes probe), and inline in
`PRODUCTS_FILES`; it is now ONE record `VALID_A1_SOURCE` in the shared section
(`"T12.1-1/T12.1-3/T12.1-4/T12.2-1/T12.2-2/T12.2-3 specs/A.mdx (the valid a1 source: …)"`),
both old spellings deleted, every `.source` fill of an initial entry (`REGEN_FILES`,
T12.1-4's workspace, T12.2-2's families 1–4, 7, 9, T12.2-3's workspace) and
`PRODUCTS_FILES` (T12.1-1's and T12.2-1's one workspace) taking the record; T12.2-2's
families 5, 6, 8 (after family 1's invocations) — `REFERENCES_FAMILY_FILES`' and
`CYCLE_FAMILY_FILES`' `specs/A.mdx` and `POLICY_FAMILY_FILES`' `lo/L.mdx` wrapped in
place, its `hi/H.mdx`, spelled byte-identically by T12.2-4's fixture, hoisted to ONE
record `POLICY_HI_SOURCE` (`"T12.2-2/T12.2-4 hi/H.mdx (…)"`); T12.2-4's shared fixture
map (arms (b)–(d) behind its diagnosed failure at arm (a), judged by reading; converted
uniformly) — `T12_2_4_L_VALID` itself (renamed for its initial and repair sites) and
`extra/E.mdx` wrapped in place; every map and `withWorkspace`'s `files` widened to
`InitialFileContents`. `section-12.3-12.5.ts` 1 — T12.3-1's restricted-tree
`T12_3_1_T` wrapped in place (its second workspace, behind its diagnosed failure in the
first). `section-12.6.ts` 0 new — `VALID_SOURCE` aliased to `section-7-basics.ts`'s
`SECTION_A_SOURCE` by import (the spelling deleted), the record renamed
`"T7-1/T7-2/T7-3/T7-4/T7-6/T7.1-1/T7.3-1/T7.4-1/T7.5-1/T7.5-5/T12.6-1/T12.6-2 specs/A.mdx
(the minimal section a; T7.5-5's tgt/a.mdx)"` — the task's note named T12.6-2 alone, but
T12.6-1's (and T12.6-2's first) workspace stages the same aliased constant, so the name
carries every calling test (Tasks 6 and 12). `section-12.7.ts` 11 — T12.7-1:
`POLICY_SOURCE` wrapped in place and T12.7-2's byte-identical `IDS_SOURCE` aliased to
it (`"T12.7-1/T12.7-2 specs/P.mdx (…)"`), the cross-module arm's HOMEMOD/FOREIGNMOD and
the review-refusal arm's `specs/R.mdx` literals moved to module-level records,
`T12_7_1_UR_BASELINE` made from `UR_BASELINE_SOURCE` (the self-check's string),
`OK_SOURCE` wrapped in place and T12.7-2's first-workspace `ORD_OK_SOURCE` aliased to it
(`"T12.7-1/T12.7-2 specs/OK.mdx (…)"`); T12.7-2: `T12_7_2_MR` and `T12_7_2_DF_F` made
from the strings the slice checks read, `DF_W_SOURCE` wrapped in place; T12.7-3 (behind
its diagnosed failure in the config-paths arm, judged by reading): `ERR_SOURCE` (every
arm's `specs/A.mdx`, the first arm's included) and `ERR_SUB_SOURCE` wrapped in place.
Sub-rules applied: (i) a pre-existing same-module group of byte-identical RECORDS in a
module being converted collapses into one record staged at every site (Tasks 16–17's
alias-and-rename rule applied to two old records; here a new identifier replaces both,
since each old identifier misdescribed the wider use — Task 8's (iv)); (ii) a record
name never spells ` > ` (the `vitest list` separator — `grep '> T'` must keep one name
per line): `"… (grand holding grand.par …)"`, `"… (keep holding keep.sub …)"`. Left
plain: every body's first workspace otherwise (T12.1-3's and T12.2-2 family 1's and
`PRODUCTS_FILES`' `specs/B.mdx` — no record holds their bytes —, T12.3-1's ordering
workspace, T12.3-2, T12.4-1, T12.5-1, T12.7-1's located-findings and T12.7-2's
condition-ordering workspaces but the aliased `ok`), every configuration and `.ts`
entry. Read-based enumeration: 19 + 6 + 5 + 18 creation sites judged (each count with
its module's `withWorkspace` helper). Observation for the determination, not acted on
(Task 14's class): the duplicate-bytes probe finds 686 records in 31 groups — the
§12.1-12.2 same-module group gone, two new cross-module groups (the cycles family's
`specs/A.mdx` = `"T5.3-1 self-depends specs/A.mdx"`; `ERR_SOURCE` = `"T3-6
specs/A.mdx"`); Task 23's notes updated (`section-14.ts` spells three of this task's
records' bytes). Checks: the sites hook logged the task's 14 (test, path) pairs (20
lines, all `"well-formed"`) before and no file after; the sha256 capture over the four
suite files (120 writes, compared sorted) identical; 16 tests, 13 pass and 3 fail —
T12.2-4, T12.3-1, T12.7-3 — with identical verdict lines and diagnoses (full blocks,
temporary paths normalized; ~22 s a run); red check: an unclosed tag spliced into the
valid-a1, restricted-tree, and `specs/sub/S.mdx` records fails exactly those three as
`mdx-derivability` under the ledger self-test's `-t 'T12\.[1-7]-'` filter (30 tests).
Known state after Task 20: the S-9 self-test 712 tests over 686 records (679 `T…`,
4 `E-6`, 3 `P-…`); self project 22 files, 2852 passed, 0 skipped under the namespace
(~90 s; 2836 + the 16 record tests); certification 144 PASS / 33 FAIL / 0 error /
0 hang over the 23 `certification run against` lines; the ledger-wide duplicate-bytes
probe 686 records in 31 groups.

**Resolved by Task 21 (the §13 modules and the H-6 refusal fixtures; 31d884c converts,
the closing commit records).** Fifteen records, one of another module's reused.
`section-13.1-13.2.ts` 2 — T13.2-1's `EMISSION_SOURCES` entries wrapped in place (the
outDir arm follows the default arm's invocations; the default arm's workspace
converted uniformly). `section-13.3.ts` 4 — the alpha-on-beta source, spelled three
times with identical bytes (T13.3-1's only workspace, T13.3-2's record-discipline
workspace, T13.3-3's two whole-gate workspaces), is ONE record `ALPHA_ON_BETA_SOURCE`
(`"T13.3-1/T13.3-2/T13.3-3 specs/A.mdx (…)"`), `T13_3_2_RECORD_A` / `T13_3_3_GATE_A`
aliased after it, the literals deleted (Task 20's sub-rule (i) applied to three
strings); `T13_3_3_GATE_T` and `T13_3_4_FILES`' two sources wrapped in place.
`section-13.5.ts` 2 — `CORE_A_STAGED`, made from the kept `A_MDX` string (the
`.replace` source of `A_MDX_EDITED`), EXPORTED and staged by `CORE_DECL`, named with
every staging test, first-workspace callers included (`"T6.6-3/T13.4-1/…/T13.4-6/
T13.5-1/T13.5-2/T13.5-3/T13.5-4/T13.5-6/T13.5-8 specs/A.mdx (the CONF-CORE-shaped
source …)"`): `section-13.4.ts`'s `A_MDX` spelled the same bytes, so its literal is
deleted and it aliases the import (`const A_MDX = CORE_A_STAGED;`). Sub-rule applied:
where one task's modules spell a byte sequence and one of them needs the STRING (here
§13.5's `.replace`), the record lives in that module, made from the kept string, and
the others import the record — rather than Task 19's "first module in registry order",
which would leave the string-needing module a second spelling or a narrowing read;
§13.5 is also the module the plan's note named and T6.6-3 already imports from.
`ISO_TWO_MDX` wrapped in place; T13.5-5's first-workspace `pollSource(POLL_TEXT_ONE)`
takes the existing state-one record (renamed `"… in state one (the initial source;
the alternation's state one)"`). `section-13.4.ts` 2 — `B_MDX` wrapped in place, T13.4-3's
inline spelling of its bytes (`walkOrphanBoundary`'s `specs/B.mdx`) replaced by it
(`"T13.4-3/T13.4-6/T13.4-8 the minimal section b (…)"`); `SECTION_ORIGIN_MDX` wrapped in
place; `RELOCATED_MDX` aliased to `section-12.0-i.ts`'s `STREAMS_VALID_SOURCE` (renamed
`"T12.0-2/T12.0-3/T12.0-9/T12.0-10/T12.0-14/T13.4-8 …"`), the file-form move's compare
reading `.source`. `write-refusal-staging.ts` 5 — `RENAME_A`/`RENAME_B`/`RENAME_C`
(`"T13.5-7/T14-9/T14-10 the rename fixture …"`) and `MOVE_OTHER`/`MOVE_A` (`"T13.5-7/T14-9
the move fixture …"`) wrapped in place: T14-9's and T14-10's arms (`section-14-ii.ts`)
prepare them too, and its `PRECEDENCE_FIXTURE`/`LISTING_FIXTURE` spread the rename
fixture's files (T14-10 never prepares the move fixture). Left plain: T13.1-1's and
T13.1-2's workspaces, T13.3-2's and T13.3-3's first workspaces (no record holds their
bytes), `MOVE_APP`, every configuration entry. Read-based enumeration: 5 + 9 + 18 + 15
creation sites and `prepareRefusalWorkspace`'s one judged; behind the diagnosed
failures — T13.3-2's record-discipline workspace (after its deletion arm), T13.4-6's
seven later workspaces (after its first arm), T13.5-1's stale arm (after its `build
--test-hold --json` arm), T13.5-7's later arms (after (a)), T14-9's twins and later
arms (after (a)), T6.6-3's scheduling workspace — each stages records now.
Observation for the determination, not acted on (Task 14's class): the duplicate-bytes
probe finds 701 records in 32 groups — `B_MDX` joins the §6.1/§6.5/§12.0-iii
`<S id="b">` group (four members now) and `CORE_A_STAGED` forms a 32nd with `"P-10
specs/A.mdx"` (`section-16-p10.ts`); none within this task's modules. Checks: the sites
hook logged 27 lines before — the task's 18 (test, path) pairs plus T14-10's three
rename-fixture pairs (Task 23's list), all `"well-formed"` — and no file after; the
sha256 capture over the four §13 suite files, `section-14-ii.test`, and
`section-6.6.test` (207 writes, compared sorted) identical; 29 tests, 21 pass and 8
fail — T13.3-2, T13.4-6, T13.5-1, T13.5-7, T14-9, T14-10, T6.6-3, T6.6-4 — with identical
verdict lines and diagnoses (full blocks, temporary paths normalized and the product's
temporary-file names `.xspec.tmp-<pid>-<n>` too, which T13.5-7's and T14-9's exit-70
diagnoses quote; ~43 s a run); red check: an unclosed tag spliced into the T13.2-1 A,
T13.3-4 C, T13.4-8 S, T13.5-6 B, and move-fixture Other records fails exactly those
five as `mdx-derivability` in the S-9 self-test. Known state after Task 21: the S-9
self-test 727 tests over 701 records (694 `T…`, 4 `E-6`, 3 `P-…`); self project 22
files, 2867 passed, 0 skipped under the namespace (~90 s; 2852 + the 15 record tests);
certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23 `certification run
against` lines; the ledger-wide duplicate-bytes probe 701 records in 32 groups.

**Resolved by Task 22 (the T14-11 exchange, `section-14-iii.ts`, `section-15.ts`; 53331cd
converts, the closing commit records).** Twenty-nine records, one renamed. The four §2
exports, T14-12's arm stagings, and their consumer changed in one commit: `support.ts`'s
`UnparseableStaging.files` and `section-14.ts`'s `RangeRuleCase.files` take
`InitialFileContents`, and `reassertedCase`'s `mdx: { unparseable: [file] }` branch is
gone outright (every spec-source entry of a re-staged map is a record carrying
`unparseable`; a `.ts` entry stays plain). `section-2.2-2.3.ts` 1 — the T2.3-3 export's
`specs/A.mdx` (`"T2.3-3/T14-11 unparseable form … specs/A.mdx"`), the home arm's `mdx`
dropped. `section-2.4.ts` 4 new, 1 renamed — the string map `DYNAMIC_ARM_BASE_FILES`,
kept by Task 5 only for the export to spread, folded into `DYNAMIC_ARM_BASE_RECORDS`
(the literal moved; `"T2.4-2/T14-11 specs/BASE.mdx"`); Task 5's discriminated union
collapsed into one interface once every entry carries `records` (the TypeScript-only
forms' declared `unparseable`, `"T2.4-2/T14-11 <form> in <position> specs/A.mdx"`;
the well-formed names unchanged), the body branching on
`arm.unparseableAt`; `T2_4_2_UNPARSEABLE_STAGINGS` moved AFTER the computed table and
derived from it, so the export and the home arm stage one record per bytes — in the
same order, since T14-11's `w.<n>` numbering follows the exports' order (w.2–w.5);
`runUnparseableFormArm` takes the record; `withWorkspace`'s orphaned `mdx` parameter
removed. `section-2.7.ts` 6 — the T2.7-3 spread export's `specs/A.mdx`
(`"T2.7-3/T14-11 …"`); T2.7-4's `UnparseableCommentArm.source` became the record
itself (`unparseableCommentArm(name, source, offset, rule)` registers `"T2.7-4/T14-11
<arm> specs/A.mdx"`, `unparseableInSection` composing through it — the offset computed
from the string first); both home arms' `mdx` dropped; the orphaned `mdx` parameter
removed. `section-14-iii.ts` 18 — `BASE_STAGED` (the BASE module beside (b), (g), (t):
one record), `NOPE_STAGED` ((b), `{ allowances: ["undefined-export"] }`), the nine
spec-form arms' files, `A_STAGED` (the code arms' spec source, (l)–(q): one record),
the six negative spec arms' failing files (`unparseable`, created in
`specUnparseableArm`); `UnparseableArm.files` and both `extraFiles` widened;
`specFormDecl`, `unparseableDecl`, and `NOPE_DECL` carry no `mdx`; the strings the S-9
vector self-test imports (`T14_12_FORM_VECTORS`, `T14_12_UNPARSEABLE_VECTORS`) kept.
Sub-rules: (i) a record staged through a declaration another module's loop sweeps —
T14-4's and T14-6's `SWEEP_ENTRIES` spread `T14_12_REPORTER_STAGINGS` after their own
invocations — is named with the sweeping tests too: the task's `"T14-12/T14-11 …"`
became `"T14-4/T14-6/T14-11/T14-12 (<arm>) …"` (ID order; T14-11 only where it
re-stages: the negative arms, the BASE and code-arm sources), `"T14-4/T14-6/T14-12 …"`
for (b) and the swept 14.16 forms, `"T14-12 …"` for (g) and (j); (ii) a module-level
table of object-literal rows (no sibling property to compute a record from) splits into
a row table and a computed arm table — `SPEC_FORM_ROWS` and `SPEC_FORM_ARMS =
SPEC_FORM_ROWS.map((row) => ({ ...row, source: stagedMdx(…) }))`, the declaration from
the row's allowances — the name's ID list computed by the SAME predicate that selects
the sweeping consumer (`isSweptSpecForm`, shared with the reporter filter); (iii) the
red check for an `unparseable` record is to make it derive or flip its declaration
(an unclosed tag spliced in keeps it unparseable — no red); (iv) the builder self-test
`someUnparseableRecord()` borrows the ledger's FIRST unparseable record, now T2.3-3's,
so a red check making that record derive fails that self-test too (expected). Left
plain: T14-12's (a) workspace (the body's first; its allowance declaration stays), every
configuration and `.ts` entry; `section-15.ts`'s one creation (T15-1's only workspace,
created before its first invocation — judged, nothing to convert). Read-based
enumeration: 9 + 1 (`section-2.2-2.3.ts`), 9, 9, 5, 1 creation sites and
`section-14.ts`'s `runRangeRuleArm` (the (w) arms) and the two sweeps'
`withWorkspace(entry.decl, …)`; behind the diagnosed failures — T2.3-3's unparseable
arm, T2.4-2's three later TypeScript-only stagings, T2.7-4's five, T14-11's
(w.1)–(w.19), T14-12's (c)–(w), T14-4's and T14-6's T14-12 entries — each stages
records now; Task 23's notes updated (the sweeps' T14-12 entries and T14-11's (w) arms
stage records already). Observation for the determination, not acted on (Task 14's class): the
duplicate-bytes probe finds 730 records in 33 groups — `A_STAGED` forms a new
cross-module group with `"T4.5-9 specs/A.mdx"` (`section-4.5.ts`); none within this
task's modules. Checks: the sites hook logged, besides Task 23's `section-14.ts` lines,
the task's two T14-12 pairs, T14-6's two `NOPE_DECL` pairs, and Task 5's two remainders
(T2.4-2's and T2.7-3's `specs/A.mdx` `"unparseable"`) before, and none of them after;
the sha256 capture over `section-2.2-2.3.test`, `section-2.4.test`, `section-2.7.test`,
`section-14.test`, `section-14-iii.test`, `section-15.test` (335 writes, compared
sorted) identical; 28 tests, 17 pass and 11 fail — T2.3-3, T2.4-2, T2.4-5, T2.7-3,
T2.7-4, T14-2, T14-4, T14-6, T14-7, T14-11, T14-12 — with identical verdicts and
diagnoses (~42 s a run); the per-arm diagnostic variant (AGENTS.md) reaching every
re-staged site behind a failure gave identical per-arm logs (107 lines, T14-4's and
T14-6's entries with their `build` findings) and captures (478 writes) before and
after; red check: 19 records fail as `mdx-derivability` in the S-9 self-test (the
unparseable ones made deriving or declared well-formed, the two BASE records spliced,
(b)'s allowance dropped), plus the borrowing builder self-test. Known state after
Task 22: the S-9 self-test 756 tests over 730 records (723 `T…`, 4 `E-6`, 3 `P-…`);
self project 22 files, 2896 passed, 0 skipped under the namespace (~90 s; 2867 + the
29 record tests); certification 144 PASS / 33 FAIL / 0 error / 0 hang over the 23
`certification run against` lines; the ledger-wide duplicate-bytes probe 730 records
in 33 groups.

**Resolved by Task 23 (the §14 modules; c782148 converts, the closing commit
records).** Sixty-six records, seven existing ones renamed (six of other modules,
exported there — two hoisted out of a table or map first). `section-14.ts` 65 —
T14-3's configuration-error arm (`specs/invalid.mdx`; `specs/broken.mdx`
`unparseable`, the workspace `mdx` dropped); the sweep table `SWEEP_ENTRIES`
converted uniformly (T14-6's first entry, its body's first workspace, included):
`specArm` takes a `StagedMdx` (its conditional `mdx.unparseable` for 14.20 gone — the
14.20 record declares it), the ten literal-bodied entries wrapped in place
(`"T14-4/T14-6 sweep specs/a.mdx (<condition>, <label>)"`), 14.11's alpha/bravo and
14.19's `specs/a#b.mdx` wrapped in place, `codeArm`'s spec source one record
`CODE_ARM_SPEC_SOURCE`; the minimal valid a1 source spelled five times (the 14.13 and
14.22 entries, `VALID_SPECS_DECL`, `BOGUS_KEY_DECL`, `READ_REFUSAL_DECL`) ONE record
`VALID_A1_BEHAVIOR` declared before the table, the other spellings deleted; the 14.1
entry's bytes were `T14_4_ID_LESS_EDIT`'s (a same-module duplicate, Task 20's sub-rule
(i)): one record `ID_LESS_A_SOURCE`, moved before the table (a `const` used by the
table must precede it) and renamed for both sites; `READ_REFUSAL_DECL`'s
`specs/sub/b.mdx`; T14-5's `T14_5_SPEC_SOURCE` wrapped in place (both arms); T14-7's
multi, import-cycle A, sibling A, and invalid-workspace R records made from the kept
window strings (`T14_7_*_STAGED`), cycle B, sibling B/C, the invalid-path A, the
spelling origin `a.mdx`, and the valid Bad twin wrapped in place; T14-8's Col (its
`duplicate-import-binding` allowance moved from the workspace `mdx` to the record),
One, Two, CycA/CycB, ImpA/ImpB, Emb, Pol; T14-11's `RangeRuleCase` table converted
uniformly ((a) included): every `.mdx` entry wrapped in place, `unparseable` for (c),
(m), (v), the orphaned `RangeRuleCase.mdx` field and `runRangeRuleArm`'s `mdx` removed
(`WorkspaceMdxDecl` no longer imported), `T14_11_A_MDX` one record named for its
`specs/A.mdx` and `specs/BASE.mdx` sites, (v)'s computed `T14_11_ENCODING_FILES` rows
carrying `contents` (a record for each spec source, bytes for each code source), (n)'s
and (o)'s sources module-level records. `section-14-ii.ts` 1 — arm (g)'s
`LISTING_FIXTURE` `specs/sub/S.mdx` (`"T14-10 …"`: the prepared workspace and the
invalid-configuration one). Reused by import and renamed (the note's byte-identical
spellings): `VALID_A1_SOURCE` and `POLICY_HI_SOURCE` exported from
`section-12.1-12.2.ts`, the policy family's `lo/L.mdx` hoisted there to
`POLICY_LO_SOURCE`, and T5.3-1's self-depends record — 14.9's primary test, the note's
first-named of the two — hoisted in `section-5.1-5.3.ts` to `SELF_DEPENDS_STAGED`,
each named `"…/T14-4/T14-6 …"` with the `specs/a.mdx` site. Sub-rule applied (found by
the duplicate-bytes probe before the closing commit): a new entry whose bytes equal a
record the SAME test already stages elsewhere is that record (the naming rule's "identical
bytes one test stages at several sites are ONE record"), even across modules — T14-7's
destination-component `specs/Src.mdx` is `section-6.5.ts`'s `V4_SOLO_SOURCE` (T14-7
stages it through `MOVE_DERIVED_PATH_FILES`) and its spelling arm's `specs/b.mdx` is
`section-6.5-iii.ts`'s `A13_FOURTH_STAGED` (through the M17 arms), both exported and
renamed for the new path; a byte-identical record of ANOTHER test stays Task 14's
observation. Left plain (each its body's first workspace): T14-1's, T14-2's, T14-3's
masking workspace (its `mdx.unparseable` stays), T14-8's triple-duplicate workspace,
T14-10's arm (a) `SOURCE_DECL`; every configuration and code entry. Read-based
enumeration: the 44 creation sites of `section-14.ts` and `section-14-ii.ts`'s 2
creations and 18 `prepareRefusalWorkspace` calls; behind the diagnosed failures —
T14-4's and T14-6's later sweep entries and dedicated arms, T14-7's every arm after the
first, T14-10's (g), T14-11's (d)–(v), (n), (o) — each stages records now.
Observation for the determination, not acted on (Task 14's class): the duplicate-bytes
probe finds 796 records in 36 groups — three new cross-test groups: T14-11 (q)'s
`specs/A.mdx` = `"T14-12 (g) …"` (`section-14-iii.ts`), T14-7's sibling `specs/B.mdx` =
`"T6.5-9 spec-source arm specs/text.mdx"`, the sweep's 14.4 source = `"T12.2-2
specs/B.mdx with an invalid ID segment (14.4) …"`. Checks: the sites hook logged 57
lines (27 (test, path) pairs, the plan's list) before in the plain run and 114 lines
(51 pairs) in a per-arm diagnostic variant (`withWorkspace` swallowing its body's
failure in `section-14.ts`; T14-9's and T14-10's arms wrapped, arm (g)'s first block
too), and no file after in either; the sha256 capture over `section-14.test`,
`section-14-ii.test`, `section-5.1-5.3.test`, `section-12.1-12.2.test`,
`section-6.5.test`, `section-6.5-iii.test`, and `section-6.6.test` (514 writes,
compared sorted) identical, the variant's (609 writes; 205 per-arm lines) identical;
44 tests, 23 pass and 21 fail — T12.2-4, T14-2, T14-4, T14-6, T14-7, T14-9, T14-10,
T14-11, T6.5-6…T6.5-10, T6.5-13, T6.5-15…T6.5-19, T6.6-3, T6.6-4 — with identical
verdicts and diagnoses; red check: an unclosed tag spliced into four new records
(`VALID_A1_BEHAVIOR`, sibling C, `T14_11_A_MDX`, the T14-10 listing source) and the
sweep's 14.20 source made to derive fail exactly those five as `mdx-derivability`.
Known state after Task 23: the S-9 self-test 822 tests over 796 records (789 `T…`,
4 `E-6`, 3 `P-…`); self project 22 files, 2962 passed, 0 skipped under the namespace
(~91 s; 2896 + the 66 record tests); certification 144 PASS / 33 FAIL / 0 error /
0 hang over the 23 `certification run against` lines; the ledger-wide duplicate-bytes
probe 796 records in 36 groups.

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

**Where a task touches a shared helper.** `test/helpers/workspace.ts` (Tasks 1 and 24;
Task 3 added `mdxPathsOf` alone; Task 23b adds the per-draw unparseable declaration),
`test/helpers/staged-mdx.ts` (Task 1 only, header text; Task 23b where its validator
names the refused members), `test/helpers/e6.ts`
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

### Task 23b — P-12's break-parse twist: a guard-exempt, builder-judged-unparseable declaration for a draw's initial file (before Task 24)

**Requirement (found by Task 3).** `section-16-p12.ts`'s `runP12Trial` stages the
trial's composed files as plain initial entries and declares the break-parse twist's
file (`trial.unparseable`, a drawn path of `FILE_POOL`) `mdx.unparseable`: the builder
judges it must-not-derive at creation, inside the body, and a failure surfaces as a
harness error with the seed through the runner's rethrow of `HarnessStagingError` —
S-9's draw clause holds today. But no declaration Task 3 could give it survives Task 24:
`perDraw` is judged well-formed at creation (it would refuse the twist), a record can
never stand for a draw, and the runner's `stagedP12Sources` excludes the file because
`checkDrawMdx` judges every source as must-derive. Task 24's guard exempts only
`unchecked` and `per-draw`, so from the second trial on it would refuse the twist entry
(`undeclared-staging`) — a harness error in P-12 where the plan expects 0 such lines
and the same 82 failures. Task 3 left the entry declared `unparseable` (the one
truthful declaration available) and its path out of the `perDraw` list
(`mdxPathsOf(files).filter((path) => path !== trial.unparseable)`), so the Task 3 sites
hook logs exactly one `"unparseable"` line per P-12 trial after the first.

**Change** (`test/helpers/workspace.ts`; `test/helpers/staged-mdx.ts` where its
validator names the refused members; `test/suite/registry/section-16-p12.ts`;
`test/self/s9-staged-sources.test.ts`; `test/self/s9-undeclared-staging.test.ts`;
headers; AGENTS.md). Give the workspace declaration a per-draw unparseable form — the
minimal shape: `WorkspaceMdxDecl.perDrawUnparseable?: readonly string[]` resolving to
a new `MdxFileDeclaration` member `"per-draw-unparseable"`, which `judgeMdxDeclaration`
judges exactly as `unparseable` (must not derive; spelled "declared unparseable per
draw"), `guardUndeclaredStaging` exempts as it exempts `per-draw`, a record refuses as
it refuses `per-draw` (`StagedMdx.mdx` excludes it), `resolveMdxDeclaration` names in
the two-list contradiction, and `file()` accepts as an option (section-16 modules
only). `runP12Trial` then declares `mdx: { perDraw: <the other .mdx paths>,
perDrawUnparseable: trial.unparseable === undefined ? [] : [trial.unparseable] }`.
Optional, so the runner's first line covers the twist too: `DrawSource` gains an
optional fourth element `"unparseable"`, `checkDrawMdx` judging such a source as
must-not-derive, and `stagedP12Sources` returns the twist file marked so instead of
filtering it out (then `test/self/property-infrastructure.test.ts` gains the red
check: a deriving source marked unparseable is a harness error carrying the seed).
Self-tests follow the `perDraw` tests' pattern for the new list (a listed non-deriving
entry created; a deriving one refused with the unparseable diagnosis; a path in two
lists, or not an MDX source, throws), plus the guard exemption after an invocation
(`s9-undeclared-staging.test.ts`), the record refusal, and the judge.

**Checks.** Recipes 1–2; P-12 alone against the built product (`-t 'P-12 '`, ~6 min,
PASS unchanged at the fixed seeds) with the Task 3 sites hook (AGENTS.md) showing its
twist lines declared `"per-draw-unparseable"` and no `"unparseable"` or
`"well-formed"` line; Task 24's checks are then expected to hold with no P-12
exception. Record the form in AGENTS.md beside the `perDraw` bullet.

### Task 24 — The undeclared-staging guard covers initial files (last: after every conversion)

**Requirement.** S-9's timing clause is met only while every post-invocation initial
`.mdx` entry is a record (Tasks 4–23) or a declared draw (Tasks 3 and 23b); nothing enforces
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
   of <ID>") and the remedies (a record in `files`; `mdx.perDraw` — or Task 23b's
   `mdx.perDrawUnparseable` — for a property draw; `mdx.unchecked` for P-8 mutations
   and noise). `create()`'s catch disposes the
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
