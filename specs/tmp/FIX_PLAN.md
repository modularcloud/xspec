# FIX_PLAN — Phase 10: product adherence to `specs/SPEC.md`

Source: two compliance reviews of the product against SPEC.md plus a red verify run
(142 failed / 495 passed; branch `claude/xspec-ui-apis-4df8fa`, PR #7). Goal: every
test passes (`npm test` locally and in CI, including the Windows E-6 leg).

**Rules for every task (read once per spawn):**

- Phase 10: never modify the test harness (`test/`). Product code (`src/`) only.
  Never couple product code to harness internals.
- Respect `specs/IMPLEMENTATION.md` (three layers: pure `core`, I/O `workspace`,
  rendering `cli`; one canonical JSON serializer; findings built as data, rendered
  once per output form; no new runtime dependencies).
- Work top to bottom. The stages are ordered by dependency: Stage A rebuilds the
  SPEC 12.7 finding/error-document forms and the stable-code model — single choke
  points that ~90 failures decode through; Stage B adds the missing command
  surfaces; Stage C makes localized behavioral fixes. A task lists its hard
  prerequisites; do not pick a task whose prerequisites are still in this file.
- Build first (`npm run build`), then run the named tests:
  `npx vitest run --config test/vitest.config.ts --project suite test/suite/<file>`
  (see `AGENTS.md`). A task's named tests are its verification; other tests may
  stay red until later tasks land. Before committing: `npm run typecheck` and
  `npm run format`. Commit `sdg(phase-10): <imperative summary>`, push.
- When a task is done, remove it from this file in the same commit. If a task
  turns out too large for one spawn, land a coherent part, and replace the task
  with precise remainder task(s) here. When the last task is removed, delete
  this file.

---

## Stage A — SPEC 12.7 report forms and the stable-code model

(A2 landed: the shared path-value representation and renderer are
`src/core/path-text.ts` — `PathText` is `string | PathBytes` (a tagged
wrapper holding a non-UTF-8 path's exact bytes, constructed only through
`pathTextOf` so a valid-UTF-8 path can never take the marked form);
`pathTextJson` renders the 12.7 value form, `renderPathText` the
deterministic human spelling `<bytes HEX>`, `comparePathTexts` the one byte
order over both forms, used by `compareFindings`/`compareLocations`. Finding
`locations[].file` and `path` are `PathText` now; Stage B surfaces reuse the
same renderer for their own path members.)

(A3 landed: jointly-violated conditions carry every participant's location —
duplicate IDs one 14.3 finding per identity locating every bearer (`mdx.ts`
`validateStructure`), import-binding collisions one 14.15 locating every
colliding declaration (`spec-references.ts` `analyzeSpecImports`,
`code-analysis.ts` `scanModuleLinks`), cycles located through their full
in-source path with identities dropped — `graph.ts` keeps an `edgeSpellings`
map (requirement-side depends/embeds edge → its 5.7 spelling spans; `d` =
the entry's own expression, MDX embedding = the full braced container),
which B8's `refused-cycle` can reuse; import cycles locate every
participating import declaration. Embedding-form no-occurrence findings
(14.6, 14.8) span the full braced container, `SpecEmbedding.range`.)

(A4 landed: the exit-2 JSON error document. The 11.6 anchoring spelling is
the shared helper `anchoredPathSpelling` in `src/workspace/anchor.ts` (B7's
inventory reuses it for `root`/`config`); `LocatedWorkspace`/`LoadedWorkspace`
carry `configAnchor`, the concerned path of every condition-14 finding.
JSON-in-effect is `jsonOutputInEffect(invocation)` in `src/cli/args.ts` —
`--json` or a `CommandSpec.jsonOnly` surface; Stage B registrations
(`version`, `occurrences`, `view`, `at`, `inventory`) must set
`jsonOnly: true` and force `{...invocation, json: true}` for their exit-1
reports as `query`/`review export` do. `usageError(invocation, io, message)`
in `src/cli/commands/common.ts` and `emitConfigurationErrors(io, jsonInEffect,
configAnchor, findings)` in `src/cli/report.ts` are the exit-2 choke points —
route every new exit-2 outcome through them.)

(A5 landed: review-operation refusals are code-less findings —
`emitReviewRefusal(json, stdout, message, identities)` in
`src/cli/commands/review-session.ts` emits `{"findings": [...]}` through
`emitFindingsReport`, one finding with `code`/`path` null, `locations` empty,
`identities` the session name (+ item id / colliding name) — informational.)

(A6 landed: a successful `rename`/`move` reports its applied mapping —
`emitAppliedMappingReport(json, stdout, mapping)` in `src/cli/report.ts`,
fed `plan.entry.mapping` (the journal entry's canonical `from`-byte order):
JSON `{"findings": [], "mapping": [{"from", "to"}...]}` — the preview
`mapping` member encoding of 12.7, which B9's success document can reuse —
human one `FROM -> TO` line per pair plus a count line.)

---

## Stage B — missing command surfaces (patch 0001)

(B2a landed: 14.19 files enter per-file analysis. Discovery carries them as
`classification.invalidSources` (`{path: PathText, bytes, kind, groups}`,
`src/core/discovery.ts`); the pipeline parses them into
`WorkspaceAnalysis.invalidPathSpecs`/`invalidPathCode` — ordinary
`SpecFileAnalysis`/`CodeAnalysis` values whose `document.file` /
`analysis.file` is the real `PathText` while `path` is a never-rendered
lossy stand-in — their per-file findings reported beside the 14.19; they
feed no nodes, hashes, or recorded inputs. Import designation consults the
whole discovered set through `SpecSourceDomain`
(`src/core/spec-references.ts`; byte-space designators for byte-path
importers, `WorkspaceContent.readInvalidSource` reads content by exact
bytes): a valid import of a 14.19 member is no finding,
`SpecImport.targetFile`/`CodeImport.targetFile` carry every valid import's
member as `PathText`, bindings of such members are `undefined-module` (MDX)
/ `target: {defined: false}` (TS), and references rooted there report their
14.5/14.6/14.7 at analysis time. References *from* invalid-path files
resolve in `buildWorkspaceGraph` (the `invalidPathSpecs`/`invalidPathCode`
inputs — findings only, local form never resolves); spec import cycles run
over path bytes with invalid-path files participating. B4/B5 answer for
these files from `invalidPathSpecs`/`invalidPathCode`; B2's occurrence
recording for them hooks into the graph's invalid-path resolution pass,
source datum explicitly unavailable.)

(B2 landed: reference occurrences are computed in the graph and persisted.
`WorkspaceGraph.occurrences` (`src/core/graph.ts`) holds one
`ReferenceOccurrence` per resolving dependency-kind spelling in occurrence
order (file path bytes via `comparePathTexts`, then range start, then end):
`file` is the referencing file's real `PathText`; `range` is the exact 5.7
span (a `d` entry's own expression; an MDX embedding's full braced
container; a TS `text(...)` call's whole call expression via the new
`CodeReference.occurrenceRange`, `src/core/code-analysis.ts`; a marker's
bare chain); `kind` is the `DependencyEdgeKind`; `source` is the source
node's IDENTITY or null (= the 11.2 explicitly-unavailable datum: sections
without a usable identity, every node of an invalid-path file — those
occurrences are recorded in the graph's invalid-path resolution pass);
`target` the resolved identity. The source datum's RANGE half joins through
the node itself: a requirement source's is `RequirementNode.section.range`
(root = whole file); a code source's range is B3's deliverable — B4 renders
`{"identity", "range"}` from the graph node, or `{"unavailable": true}` for
null. Persisted as `GraphSnapshot.occurrences` (`StoredOccurrence`,
`src/core/graph-data.ts`, format version 4 since B3): valid workspaces only, so
stored `file` is a plain string; round-trips byte-deterministically.)

(B3 landed: every code location carries its SPEC 1.7 source range.
`CodeUnit.range` (`src/core/code-analysis.ts`) is the construct binding the
unit's name — a variable declaration's own node (name through initializer,
never the multi-declaration statement), dotted-namespace units sharing the
chain's outermost declaration, a named default export the construct's own
range with the `export default ` prefix excluded (`async`/`abstract` kept),
an anonymous one's `default` unit the whole export declaration, `@N` units
their own occurrence's construct. `CodeLocationNode.range`
(`src/core/graph.ts`) carries it into the graph (whole-file location =
`0..utf8Length(text)`), persisted as `StoredCodeLocation.range`
(`src/core/graph-data.ts`, format version 4 — an old store reads as
malformed → mismatch). Verified against T1.7-2's fixture offsets at the
core level; nothing presents the range yet — B4's occurrence records and
C6's review payloads are the two presentation points, and T1.7-2 goes
green with them.)

(B4 landed: `xspec occurrences` and the shared 11.2 layer.
`src/core/availability.ts` — `discoveredDomain(classification, glob?)` builds
the `ConsultedDomain` (byte-keyed membership over the entire discovered set,
invalid-path members matched by their exact bytes), `accompanyingFindings`
selects a domain's findings (location file or concerned path in domain —
jointly-violated conditions accompany whole), `nodeSpellingProblem` is 11.3's
syntactic `--to`/node-spelling well-formedness, `selectOccurrences(graph,
domain, to?)` yields `ResolvedOccurrence`s (the source datum's range joined
through the graph node — requirement `section.range`, root = whole file; code
`range`), `availabilityExit` the any-finding-or-unavailable → 1 rule.
Identity definedness (11.2) is `definedIdentitySections(document)` in
`src/core/mdx.ts` — spells + well-formed + structural, chain-inherited,
uniqueness own-only — and graph node construction now builds nodes for
exactly those sections (winner-picking removed: on failing workspaces,
references to duplicate/malformed/structurally-invalid bearers report
14.5–14.7 and record nothing); B5's `view` per-node identity datum and B6's
`at` reuse it. Pre-answer step `prepareWorkspaceForAvailability`
(`src/workspace/availability.ts`): config errors exit 2; a failing workspace
(analysis findings, or 14.22 symlink findings over build's full write set) →
answer from the current analysis, no store or journal consequence, no write;
passing → the 13.3 refresh participation. CLI plumbing:
`prepareAnalysisForAvailability` (`src/cli/prepare.ts`);
`occurrenceRecordJson`/`unavailableJson` (`src/cli/report.ts`) — `view`/`at`
render occurrence records and unavailability markers through these.)

(B5 landed: `xspec view` (`src/cli/commands/view.ts`), registered JSON-only
with variadic `<file>` positionals — `variadicPositionals` and
`positionalConflicts` in `src/cli/args.ts` make combining operands with
`--file` a parse-level usage error. The 11.2 pre-answer step is split so
discovery-consulting argument checks precede answering AND the refresh:
`analyzeWorkspaceForAvailability`/`finishAvailabilityRefresh`
(`src/workspace/availability.ts`; `prepareWorkspaceForAvailability` still
composes both for `occurrences`), CLI face `analyzeAnalysisForAvailability`
(`src/cli/prepare.ts`) — B6's `at` must reuse this: operand membership by
`pathTextKey` over `classification` spec/code/invalid sources (unknown /
wrong-kind → exit 2), then `finishAvailabilityRefresh`, then answer. New
parse-local data: `SpecSection.attributes` (raw `{name, range, text}`
entries, spread name null) and `tagsDefined`/`coverageDefined` (11.2
three-state interpreted datums) in `src/core/mdx.ts`;
`SpecImport.designatedFile` (`src/core/spec-references.ts`) is the 11.4
import-target datum (specifier form + discovery alone, binding validity
notwithstanding). `src/core/availability.ts` adds `expansionConsultedFiles`
(the `--text` domain walk over occurrence-recording embeddings) and
`TextAvailability` (per-node own/subtree-text definedness — unresolved
spelling or embedding cycle poisons the whole value); the graph's
embedding index now also covers invalid-path files' embeddings, so the
text model expands them where resolution holds. A file's own occurrence
records = `selectOccurrences(graph, new ConsultedDomain([file]))` — B6's
`occurrence` member reuses this. P-12 stays red until B6's `at` lands, as
its own verify line records.)

(B6 landed: `xspec at` (`src/cli/commands/at.ts`), registered JSON-only with
`<file>` `<offset>` positionals. Membership mirrors `view`'s operand check
(spec/code/invalid sources by `pathTextKey`); the offset-spelling check is
syntactic and precedes the analysis; the offset bound is judged against the
parsed root's range end or, for an unparseable named file, the byte length
read via `readSourceByteLength` (`src/workspace/availability.ts`); the
unparseable file answers `{"unavailable": true}` beside its 14.20, and
identity/occurrence rendering reuses `definedIdentitySections` /
`selectOccurrences` / `occurrenceRecordJson`. Performance: the full path
costs ~0.5s per invocation (the pinned TS-compiler config parse), which
would blow P-12's 600s exhaustive sweep, so `at` also answers from a
verified store — `tryFastAt` in `src/cli/commands/at-fast.ts`, wired in
`main` beside `tryFastQuery` over `workspace/fast-read.ts`, ~0.12s,
byte-identical to the full path (usage diagnostics shared through
`src/cli/commands/at-common.ts`). If another exhaustive sweep nears its
timeout, this store-backed fast-path pattern is the lever.)

(B7 landed: `xspec inventory` (`src/cli/commands/inventory.ts`), registered
JSON-only between `at` and `rename`. The shared three-way record read is
`readDerivedFileRecord(root)` in `src/workspace/graph-data.ts` —
`DerivedFileRecord` is `{state: "absent"} | {state: "readable", paths} |
{state: "unreadable"}` (absent = empty record; a non-plain occupant or
unparseable bytes = unreadable, condition 23) — B10's delta and C4's `check`
staleness arm reuse it. `GRAPH_DATA_AREA` (`.xspec`, no trailing separator)
is exported from `src/core/graph-data.ts`: the concerned path of every 14.23
finding, and the path C5's 14.10 unit forms must switch to. Other reusable
pieces: `specSourceDerivedPaths(sourceBytes, configuration)` in
`src/core/discovery.ts` (per-source module/Markdown paths by the `NAME.mdx`
byte shape alone, total over invalid paths), `journalOccupied(root)` in
`src/workspace/journal.ts` (presence alone, lstat), `listSessionFilePaths`
in `src/workspace/reviews.ts` (well-formed session file names by name alone,
byte order of file name), and the discovery-level 14.14 exit-2 routing
inside the handler. T11.6-1..4 green on Linux; T12.2-2/3, T13.3-2/3, T14-4
inventory-adjacent arms stay red on C4/C5/C2 defects as their notes say.)

(B8 landed: the refusal contract. `src/core/refusal.ts` is the one shared
evaluation — `evaluateRenameRefusals` / `evaluateMoveFileRefusals` /
`evaluateMoveSectionRefusals` return every applicable reason together as
`Finding[]` (one finding per reason, stable codes, 12.7 concerns:
identity-concerning reasons carry `file#id` in `identities`, collisions
locate every bearer, destination reasons carry the `path` member), emitted
through `emitFindingsReport` as `{"findings": [...]}` exit 1; the
invalid-workspace precondition still reports the analysis findings alone
before any reason is evaluated. Would-be cycles and unresolvable
references are evaluated in identity space over the CURRENT graph's
edges/occurrences with the mapping applied (section form re-parented;
`findCycles` exported from `graph.ts`), locating participants at
pre-operation coordinates — reanalysis no longer leaks numbered
conditions and stays only as an unreachable-guard on the success path.
Destination facts: `assessDestinationPath` (core; pure causes +
`componentProbePaths` — destination plus its would-be Markdown emit path)
with `probeOccupant`/`nonDirectoryComponents` (`src/workspace/writes.ts`;
lstat-classified, ENOENT/ENOTDIR/ELOOP → absent) feeding the one
`refused-invalid-destination` finding — obstructed destination-side
components included, never 14.22. B9's `--preview` must call exactly this
evaluation (the CLI face is `assessAndProbeDestination` + the evaluate
functions in `rename.ts`/`move.ts`) for its refusal equivalence.)

(B9+B10 landed together: `--preview` for `rename`/`move`, delta included.
The classed edit model is `src/core/preview.ts` — the ten `PreviewEditClass`
names, `PreviewCollector` (files by path bytes, edits by start/end/class
bytes), `derivedFileDelta`. The planners collect preview edits in the same
pass as the applied edits (`RenamePlan.previewFiles`, `MoveFilePlan.…`,
`MoveSectionPlan.…`): reference rewrites span the 5.7 occurrence (a `d`
entry's `reference.range`, an embedding's `embedding.range`,
`CodeReference.occurrenceRange`), id-rewrites the attribute's own
`attributeRange`, removals the extended span (`removalSpan` over the shared
line-drop machinery), and import additions one deterministic offset shared
by preview and real edit — `offsetAfterLine`/`importAdditionEdit` in
`core/move.ts`: after the last surviving import's line, at the removed
block's line start, or offset 0 for an import-less file (the applied edit
inserts `decl\n` at exactly the previewed offset, 6.5; an import line
directly before/after JSX parses fine, so no blank-line separator). CLI:
`--preview` in `args.ts`; the handlers thread a `preview` flag through the
shared validation (every findings-refusal emits the four-member document
with `mapping`/`files`/`delta` null via `emitRefusedPreview`; the preview
returns before the unreachable-guard reanalysis and takes no exclusivity;
`--test-hold`+`--preview` exits 2 before any lock). Success is
`emitSuccessfulPreview` (`src/cli/commands/preview.ts`): B7's
`readDerivedFileRecord` (the one record consult), post-op generation set
via `generatedDerivedPaths` (`core/build.ts` — post spec paths with the
operation's path substitution applied), 14.23 → delta unavailable beside
the shared `unreadableRecordFinding` (`core/graph-data.ts`; inventory now
reuses it), exit 1 with everything else in full. T6.6-2/4/5/6 and T12.7-3
green; T6.6-3 red only on the C1-shared arms below.)

---

## Stage C — localized behavioral fixes

(C1 landed: move operand classification is parse-level —
`moveOperandsProblem` in `src/cli/args.ts` rejects, inside `parseArgv`
(syntax-determined class: reported without loading configuration, before
any lock or hold), a move operand with more than one `#` (malformed value)
and a mixed-synopsis invocation, both directions; the non-UTF-8 positional
exemption is removed, so every argument value is UTF-8-checked. The
handler's one-direction mixed check and its non-UTF-8 `<new-id>` refusal
are gone — unreachable, guarded by internal errors. T6.5-5, T6.6-3, and
T12.0-13's move arms behave; T12.0-13 still aborts earlier, at its `show
a#b#c` arm — C2's scope, see its note.)

### C2. Argument checks precede the invalid-workspace gate on gated reads

SPEC 12.0 (precedence bullet), 13.3. On a workspace failing `build`'s
validations, `ids`/`show`/`coverage`/`impact`/`review`/`query` currently emit
the gate report (exit 1) before argument checks. Required: each argument check
runs first, judged from what it consults, identically on valid and failing
workspaces — a profile/group name against configuration, a session name against
the session directory, a requirement- or graph-node identity parse-local against
the named file (a discovered path of the identity's kind; an `id` over the
file's spelled identities; a code unit over the file's named units), an
unparseable named file masking the check (gate report, exit 1). So
`show docs/none.mdx#x` (unknown file) and `query node specs/A.mdx#nope`
(unknown id in a parseable file) exit 2 on a failing workspace. Item IDs stay
behind the gate (judged against session content, which gated commands do not
read there). Files: gate sequencing in `src/workspace/pipeline.ts` and the
command handlers under `src/cli/commands/`.

The corrupt-session report is likewise gated (SPEC 14.21: reported "only on a
workspace passing `build`'s validations — on a failing one the gate's findings
are reported without any session being read"): `loadSessionForCommand`
(`src/cli/commands/review-session.ts`) currently reports the 14.21 corruption
before the refresh, so `review status <corrupt>` on a failing workspace emits
`corrupt-session` instead of the gate's findings (observed: T10.1-5 expects
`14.1 x1`, got `14.21 x1`). Required order there: session-name validity and
existence (exit 2, judged against the directory) still precede the gate; the
corruption *report* moves behind it — gate failing → gate findings alone, exit
1; gate passing → the 14.21 finding as today. Recorded-baseline resolution
(6.3, exit 2 before source validation) applies only to a readable session;
a corrupt one has no readable parameters — the corruption (or, failing
workspace, the gate) reports instead. `review list` already gates first.

Also observed by C1's spawn, same scope: a `<node>`/`<graph-node>` value with
more than one `#` must exit 2 as a malformed value on `show`/`query node`
(T12.0-13's arms — currently exit 1 via the gate), and T12.0-10's
within-class-2 arm additionally pins `show a#b#c` as reported *without
loading configuration* (byte-identical error documents with the
configuration invalid or missing) — for that one a handler-level check is
too late; C1's `moveOperandsProblem` in `src/cli/args.ts` is the
parse-level pattern (`occurrences --to` already checks its spelling in the
handler, which its arms accept).

Verify: T12.0-10 (`section-12.0*.test.ts`), T10.1-5 (`section-10.1.test.ts`).

### C3. Obstructed write path: any non-directory component, refused before modifying

SPEC 13.4, 14.22. Prereq A1 (token `obstructed-write-path`).
`symlinkComponentOf` (`src/workspace/writes.ts` ~108) detects symlink components
only; a plain-file component flows through — `build` modifies files, then
crashes ENOTDIR exit 70. Required: a workspace-relative directory component of
any path xspec writes occupied by anything other than a directory (plain file,
symlink whatever it targets, any non-directory) refuses the write, reported as
condition 22 before anything is modified; `check` reports it without writing.
One finding per distinct offending component, concerned path the component's
workspace-relative path, however many write paths it refuses. An occupant at a
derived file's own path stays a replacement, not an error; a durable file's own
path holding a non-plain-file stays 14.13/14.21; a move's destination-side
component stays `refused-invalid-destination` (B8), never condition 22.

Verify: P-8 (`section-16-p8.test.ts` or the P-8 registry file), T13.4 arms
(`section-13.4*.test.ts`).

### C4. Unreadable recorded state persists; `check` reports the exclusive unit form

SPEC 13.3, 14.23, 14.10. Prereq A1 (condition 23), B7 (shared record reader).
Today `graphDataMatchesCurrent`/`refreshedGraphData`
(`src/core/graph-data.ts` ~229–280) treat a malformed store as an ordinary
mismatch and fabricate a fresh record: after corrupting `.xspec/graph.json`,
`ids` exits 0 and rewrites the store, and `check` then exits 0. Required:

- Refreshing reads (`ids`, `show`, `coverage`, `impact`, `review`, `query`,
  `occurrences`, `view`, `at`) never consult, repair, or replace recorded state
  that exists but cannot be read as a record, and report no finding for it: they
  answer from current analysis, leave the store byte-for-byte, and the state
  persists until a successful `build` (which replaces it silently) or a
  `rename`/`move` finishing regeneration.
- `check` reports the state as staleness (14.10): the unreadable-record unit
  form — one condition-10 (`stale-output`) finding instructing rebuilding,
  concerned path the graph-data area — exclusive with the mismatch unit form
  (never both), and while it holds the recorded-file per-file form (a recorded
  derived path no longer generated), consulting no readable record, is
  undetectable and not reported; the other per-file forms report normally.

Verify: T13.3-3 (`section-13.3*.test.ts`), T12.2 arms.

### C5. 14.10 unit-form findings concern the graph-data area

SPEC 14.10, 11.6. The graph-data staleness finding names `.xspec/graph.json`
(`stalenessFindings`, `src/workspace/check.ts` ~132). Required: both unit forms'
concerned path is the graph-data area itself — `.xspec`, the 11.6 spelling, no
trailing separator — never any path inside it (the record's layout is
unenumerated, 13.3).

Verify: T12.2-2/3 arms (`section-12.2*.test.ts`), T14 arms.

### C6. Review payloads carry source ranges for every present node

SPEC 10.7 (`next --json`, `show`, `export` payload). Prereq B3 (code-location
ranges). `nodeStateJson` (`src/cli/commands/review-session.ts`) returns present
code locations as identity+presence only, and `originEntryJson` carries no
range. Required: every present scope, context, and origin node — requirement
node and code location alike — carries its source range (1.7), read from the
current graph; an absent node carries none.

Verify: T10.7-7, T10.7-12 (`section-10.7*.test.ts`).

### C7. Full-suite verification sweep

Prereq: all tasks above removed. Run `npm run typecheck`, `npm run format:check`,
`npm run build`, `npm test` (Linux full suite) — every test must pass. Push and
confirm the branch-head CI runs: harness-self, full suite (Linux), and the
Windows E-6 leg (its byte-identity test consumes the Linux run's exchange
artifact; see `AGENTS.md`). Diagnose any residual failure against SPEC.md
(property seeds are replayable: `XSPEC_PROPERTY_SEED=<seed from the failure>`);
fix small residues directly, or append precise tasks here for anything larger.
Product green + this file emptied ends the phase (delete this file when its last
task is removed).
