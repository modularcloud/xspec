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

### B6. `xspec at`

SPEC 11.5, 12.7. Prereqs B2, B4. Register (JSON-only). Document
`{"findings", "resolution"}`; `resolution` `{"section", "occurrence"}` or
`{"unavailable": true}` (unparseable file — parse finding accompanies, exit 1):

- `<file>` asserts membership exactly as a `view` operand (unknown / wrong-kind
  → exit 2). `<offset>` must be one or more ASCII decimal digits, read decimal,
  leading zeros permitted — sign, whitespace, or any other character is a usage
  error; an offset greater than the file's byte length is a usage error; equal
  resolves to the root.
- `section`: `{"identity", "range"}` of the innermost section construct whose
  range contains the offset (root when none — resolution is total over the
  file), identity per 11.2. `occurrence`: the containing occurrence's full
  record, `null` when the offset lies in none.

Verify: T11.5-1..3 (`section-11.5.test.ts`), P-12.

### B7. `xspec inventory`

SPEC 11.6, 12.7, 14.23. Prereqs A1–A4 (anchoring helper from A4). Register
(JSON-only). Parses no sources, never refreshes or writes, answers whatever the
sources' validity; configuration errors keep precedence. Document
`{"findings", "root", "config", "configuration", "sources", "derived",
"recorded", "graphData", "journal", "sessions"}`:

- Anchoring: `root`/`config` relative to the invocation cwd in the canonical
  spelling (ascend `..` segments, then descend, `/`-joined, no `.` segments or
  trailing separator; cwd itself `.`); only when the platform admits no relative
  path (different Windows drives) the platform's absolute drive-qualified form.
- `configuration` resolved view with every default and inferred kind explicit:
  `specs`/`code` one `{"name", "globs"}` per group; `markdown`
  `{"emit", "outDir"}` (absent key → `{"emit": false, "outDir": null}`);
  `coverage` one `{"name", "target", "targetTags", "targets", "boundary",
  "boundaryKind", "mode", "edgeKinds"}` per profile (`targetTags` null when
  absent); `policy` one `{"name", "type", "from", "to", "kinds"}` per rule, each
  selector `{"group", "kind"}`, `{"files"}`, or `{"tags"}`.
- `sources`: one `{"path", "groups"}` per discovered file, `groups`
  `{"name", "kind"}` entries. `derived`: one `{"source", "module", "markdown"}`
  per discovered spec source — `module`/`markdown` null for a spec-group file
  without `.mdx`; `markdown` null also while emission is disabled.
- `recorded`: the recorded derived-file paths in byte order — empty before any
  generation (a missing store is an empty record here), but recorded state that
  exists and cannot be read as a record is condition 23: `recorded` is
  `{"unavailable": true}`, a finding with code `unreadable-record` and concerned
  path `.xspec` accompanies, exit 1, everything else emitted in full. Implement
  the record read with a three-way outcome (absent / readable / unreadable) as a
  shared helper — the preview delta (B10) and Stage C reuse it. This is the only
  finding an inventory ever carries.
- `graphData`: `.xspec` (workspace-relative, no trailing separator). `journal`:
  `{"path", "occupied"}` — occupancy is presence of anything at the path, no
  content read. `sessions`: every directory entry under the review-session
  directory whose name is a well-formed session file name, by name alone,
  whatever occupies it, in byte order of file name. Other lists: paths byte
  order; groups/profiles/rules configuration order.

Verify: T11.6-2..4 (`section-11.6.test.ts`; T11.6-1's drive-mismatch arm is
Windows-only, `test/windows/e6-drive-mismatch.test.ts`).

### B8. `rename`/`move` refusal contract: every reason, stable codes, 12.7 form

SPEC 14 (refusal-reason paragraph), 6.4, 6.5, 12.7. Prereqs A1–A2 (codes/form),
B2 (spelling spans for locations). Replace the ad-hoc first-failure refusals
(`emitRefusal` in `src/cli/commands/rename.ts` and `move.ts`, emitting
`{"refused": …}`) with the findings report `{"findings": [...]}` (exit 1):

- Evaluate and report every applicable reason together, one finding per reason,
  each reason on its own terms — e.g. an occupied non-spec-source `.mdx` target
  outside every spec group reports both `refused-destination-exists` and
  `refused-invalid-destination` (`sectionDestinationProblem` returns one problem
  today).
- Per-reason content under the cardinality rule: `refused-invalid-id` /
  `refused-identity-unchanged` / `refused-structural-parent` /
  `refused-missing-target-parent` concern the stated identity (in
  `identities`); `refused-id-collision` locates every colliding bearer;
  `refused-unresolvable-reference` locates each rewritten reference spelling
  that would not resolve; `refused-cycle` locates the would-be cycle's full
  in-source path; `refused-destination-exists` / `refused-invalid-destination`
  concern the destination/target path (`path` member). Would-be cycles and
  unresolvable references must surface as these refusal codes — today they leak
  out of in-memory reanalysis as numbered conditions.
- `refused-invalid-destination` also covers a workspace-relative directory
  component of the destination path or of a derived path it would generate
  occupied by anything other than a directory (`symlinkComponentOf` in
  `src/workspace/writes.ts` checks symlinks only; a plain-file component
  currently crashes mid-write) — check destination-side components up front.
- The invalid-workspace refusal reports the workspace's numbered findings alone;
  no report ever mixes refusal reasons with numbered conditions. Refusal
  evaluation must be shared with `--preview` (B9) — same findings, codes, exit.

Verify: T6.4-1/3 (`section-6.4.test.ts`), T6.5-1/3/4/6 (`section-6.5*.test.ts`),
T14-7 (`section-14.test.ts`).

### B9. `--preview` for `rename`/`move`: plan surface (mapping + files/edits)

SPEC 6.6, 12.7, 13.5. Prereqs B2, B8. `--preview` is not in the command table
(exit 2 unknown flag today). Full validation and planning, zero modification (no
sources, journal, derived files, or graph data touched):

- Non-mutating under 13.5: acquires no workspace exclusivity; `--test-hold`
  together with `--preview` is a usage error (exit 2). Byte-deterministic.
- Document `{"findings", "mapping", "files", "delta"}` (delta itself is B10 —
  emit it as the record-based value or land B9+B10 together if inseparable).
  `mapping`: `{"from", "to"}` per mapped identity, by `from` bytes. `files`: one
  `{"file", "edits"}` per file the operation would rewrite, relocate, or create,
  by path bytes — `file` the pre-operation path (for target-file creation, the
  path the creation would occupy); edits `{"class", "range"}` ordered by range
  start, end, class-name bytes; classes exactly `"reference-rewrite"`,
  `"id-rewrite"`, `"import-specifier-rewrite"`, `"import-addition"`,
  `"import-removal"`, `"origin-deletion"`, `"target-insertion"`,
  `"target-parent-rewrite"`, `"file-relocation"`, `"file-creation"`.
- Exact pre-operation ranges: a rewrite spans the construct it rewrites (a
  reference occurrence's 5.7 span; the `id` attribute's own characters; the
  import specifier literal; the target parent's self-closing tag); a removal
  spans every byte removed — origin-deletion extends over each line the
  line-drop rule additionally drops (contiguous leftover whitespace +
  terminator), as does import-removal; import-addition, target-insertion, and
  file-creation are zero-length insertion points (file-creation at the new
  file's start — the one location without pre-operation coordinates, the created
  file's only edit, subsuming its entire initial content); file-relocation spans
  the entire moved file. Ranges may nest. No replacement text anywhere.
- Refusal equivalence: refused exactly when the real operation would be, same
  findings/codes/exit (shared evaluation from B8); the refused document keeps
  the preview form with `mapping`, `files`, `delta` null.
- Refactor so the real operation and the preview share one plan: in a
  pre-existing file the real import-addition offset must equal the preview's
  (6.5).

Verify: T6.6-2..5 (`section-6.6*.test.ts`), T12.7-3.

### B10. Preview derived-file delta and the condition-23 outcome

SPEC 6.6 (delta), 14.23, 12.7. Prereqs B9, B7 (shared record reader). `delta` is
`{"generated", "removed"}`, both directions one datum, paths in byte order:
derived paths the operation would newly generate (nothing currently recorded
there) and recorded derived paths left no longer generated (the pre-move module
path after a file move included). Both directions consult the recorded
derived-file paths; a preview never refreshes the record. Unreadable record →
`delta` is `{"unavailable": true}` as one datum, an `unreadable-record` finding
(concerned path `.xspec`) accompanies, exit 1, the rest of the preview emitted
in full; the real operation is not refused in that state. A refused preview
consults no record — never a condition-23 finding beside a refusal.

Verify: T6.6-6 arms (`section-6.6*.test.ts`).

---

## Stage C — localized behavioral fixes

### C1. Move operand classification is by spelling, at exit 2

SPEC 6.5 (operand classification), 12.0 (`#` split, UTF-8 arguments). Three
misroutes in `src/cli/commands/move.ts` / `src/cli/args.ts`, all currently exit
1 refusals, all usage errors (exit 2):

- An invocation mixing the two synopses' forms (one operand containing `#`, the
  other not — e.g. file-form origin with a `#`-containing destination) matches
  neither synopsis: usage error, never `fileDestinationProblem`.
- A non-UTF-8 operand value is a usage error: remove move's
  `utf8ExemptPositionals` exemption in `parseArgv` (`src/cli/args.ts` ~451) —
  no argument value may name a non-UTF-8 path (12.0).
- An operand with more than one `#` is a malformed value: usage error in
  `parseMoveArgument`, never an invalid-ID refusal.

Verify: T6.5-5 (`section-6.5*.test.ts`).

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
