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
Byte identity across modules (found by Task 9): `U5_BAD_SOURCE` (~3412, staged
~3656) equals `section-6.4.ts`'s `U4_BAD_SOURCE` record `"T6.4-4/T6.6-3
specs/Bad.mdx"` byte for byte, and neither module imports the other — if T6.5-5's
site is post-invocation, reuse that record (export it from `section-6.4.ts` and
rename it with the calling ID) rather than register the bytes twice (the naming
rule: an existing record whose bytes and declaration equal a new entry's is
reused, never duplicated).
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
**Notes.** Task 9 widened this module's `withWorkspace` `files` to
`InitialFileContents` and converted the three rename sets it imports from
`section-6.4.ts` — `RENAME_REFUSAL_FILES` (`"T6.4-3/T6.6-3/T14-7 …"`),
`RENAME_USAGE_ORDERING_FILES` and `RENAME_SOLO_FILES` (`"T6.4-4/T6.6-3 …"`) — so
the before-log lacks those entries (T6.6-3's `specs/Solo.mdx` above is the rename
solo set's if reached through `runSoloUsageArm` ~1169; the move solo set's ~1239 is
Task 10's); the module's own entries and the sets it imports from `section-6.5.ts`
convert as planned.
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
form (AGENTS.md's arm-filter and stand-in recipes reach it); `RENAME_REFUSAL_FILES`
(T14-7's first workspace, ~3149) already stages records named with T14-7 (Task 9).
**Checks.** Recipes 1–5 over `section-14.test`, `section-14-ii.test`; after this task
the whole suite's initial `.mdx` entries after a body's first invocation are records,
`perDraw`, or `unchecked` — Task 24 verifies it.

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
