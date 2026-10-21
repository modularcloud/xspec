// TEST-SPEC §13.3 (graph data) — SUITE-46: T13.3-1 (serving reads),
// T13.3-2 (refresh), T13.3-3 (the gate), T13.3-4 (determinism), T13.3-5
// (never stale: arm (a), tampered graph data).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8). Graph
// data content is opaque (H-4): these tests assert only its stated observable
// contract — location under `.xspec/`, the refresh/failure/staleness
// behaviors, and byte determinism — and byte-compare it only against the
// product's own output for identical input (the H-4 self-comparison carve-out).
//
// Operational definitions and conservative choices (noted per H-3/H-4):
// - "The graph data", operationally (T13.3-2, binding here and for T13.4-3):
//   every path under `.xspec/` except the durable `.xspec/journal` and
//   `.xspec/reviews/` and the transient lock path `.xspec/lock` with
//   everything under it (SPEC 13.4: no graph data, bearing on no comparison
//   of graph data). Tests only ever remove or compare it whole.
// - "Rewritten as `build` would write it" is asserted, in the source-edit
//   arm, as byte equality against graph data an actual `build` of the
//   identical workspace state wrote (12.0/13.3 byte determinism makes that
//   reference exact). The reference build runs *after* all durable staging
//   (session creation and resolves), so the compare never conflates refresh
//   output with any build-input difference, and the staged edit keeps the
//   generated file set identical (content-only edits to one existing
//   source), so "recorded derived-file paths are left unchanged" cannot make
//   a conforming refresh's bytes differ from the reference build's. The
//   deletion arm admits no such reference: the operational deletion removes
//   the record with the graph data, and an absent record stays absent (SPEC
//   13.3) — a conforming refresh writes graph data beside no record where
//   every `build` writes one, and the record's location inside the area is
//   unenumerated (11.6) — so no byte compare against a build's graph data
//   can hold there (a compare against the post-build state passes only a
//   product whose refresh writes a fresh record). That arm asserts instead
//   that every refreshing read rewrites the same graph-data bytes for the
//   same workspace state (12.0), that `inventory` afterwards reports
//   `recorded` exactly `[]` (11.6: the empty record, never a fresh one —
//   the same `inventory` on the deleted state before any read is the
//   premise that the deletion emptied the record), and that `check` is
//   clean: 14.10's unit form is the product's own comparison of the graph
//   data against the current sources and configuration with the recorded
//   paths excluded, so a clean `check` with every derived file still
//   matching is "as `build` would write it" as far as H-4 lets the harness
//   see, and the pair discriminates a refresh that writes a fresh record
//   from a `check` that reads the absent record as a mismatch (TEST-SPEC
//   T13.3-2). The record-survival clause itself is asserted behaviorally
//   in the
//   set-changing sub-arm (delete a source; the refresh leaves the stale
//   module in place, `check` reports 14.10 against the recorded orphan, and
//   the next `build` removes it — removal is possible only if the refresh
//   left the recorded paths unchanged, SPEC 13.3/13.4/12.1). In that
//   sub-arm's `check`, graph data itself is expected among no findings:
//   after the refresh it matches the current sources and configuration, and
//   the retained derived-file record cannot itself make it "stale" — 13.3
//   mandates the record be left unchanged, and 14.10's recorded-orphan arm
//   exists precisely because the record legitimately outlives the
//   generation set.
// - "Answers nothing" (T13.3-3) is operationalized as: exit 1 (an answering
//   read exits 0, SPEC 12.0) with the single stdout JSON document decodable
//   as the findings report (H-3) — the same report shape a failing `build`
//   emits (13.3: the gate reports exactly the findings a `build` would now
//   report, and the read exits 1 without answering, nothing evaluated past
//   it). A gated invocation's human form (the human-form note below) is
//   asked its exit code, 1, and the findings' information, never that its
//   report hold nothing else — robust matching asks presence (H-3) — so
//   its "answers nothing" rests on the exit code alone.
// - T13.3-3 probes the six gated reads with the exact staged findings
//   multiset (one 14.1, naming the broken file): the gate reports exactly
//   the findings a `build` would now report (SPEC 13.3), and `build` over
//   these sources yields exactly that finding. `check` (a read command
//   per 13.3, though it never refreshes) is probed leniently — exit 1, the
//   14.1 finding present, modifies nothing — because with invalid sources
//   the detectability of staleness findings (14.10) beside the validation
//   error is reporter-matrix territory (T14-4), not 13.3's.
// - "Modifies nothing" is everywhere the compare-around-command protocol
//   over the whole workspace root, `.git/` included (SPEC 13.3, 12.1;
//   `.git/` byte-identity around git-reading invocations is also T12.0-11's
//   subject).
// - The T13.3-1/T13.3-2 sweeps include the 11.2 surfaces (`occurrences`,
//   `view`, `at`) per their TEST-SPEC command lists. Their answers are
//   asserted at the identity/membership level — complete record sets with
//   endpoints, resolved section identities, the scoped per-file list of the
//   view document — because byte-precise span and per-file view semantics
//   are T11.3-*/T11.4-*/T11.5-*'s home; this section owns the
//   serving/refresh behaviors those answers demonstrate.
// - T13.3-2's sweeps represent `review` by `status` and by `list` (TEST-SPEC
//   T13.3-2; SPEC 10.7: `list` too answers only past the refresh, its
//   stored-status counts drawing on no graph data). `list` is asked its
//   one session, strategy, and item counts by stored status (each status
//   compared as `counts[status] ?? 0`, section-10.7-i.ts' convention,
//   whose T10.7-5 owns the listing's form) beside the sweep's graph-data
//   assertions — on the edited-source arm the stored `no-change` counts
//   standing where `status` reports alpha's and A's root items
//   invalidated (10.4).
// - T13.3-3's whole-gate arms (SPEC 13.3: the gate is over every finding a
//   `build` would report — source validation errors, journal errors, and
//   refused writes alike; beside a source validation error it reports each
//   of these with it, T14-1's pairs, not staged here): each staging holds
//   an `audit` session created while the workspace was valid — no baseline
//   to resolve, so the gate alone stands between `review status` and an
//   answer. The garbage journal line rides line 2 behind one legitimate
//   journaled entry (T6.1-3's staging, so "naming the line" has teeth and
//   refresh really must consume the journal for canonical identities, SPEC
//   5.4); that staging drives the five reads `ids`, `show`, `coverage`,
//   `review status`, and `query` only — `impact` is absent from it by
//   necessity, not oversight (TEST-SPEC T13.3-3): `impact` always takes
//   `--base` (SPEC 9), and a given baseline's resolution, which precedes
//   the gate (12.0), reads the current journal before any other cause can
//   fail it, a journal error there failing it as a usage error that
//   carries condition 13's code and concerned path — exit 2,
//   `journal-error`, never the gate's exit 1 (6.3; 12.0: a given baseline
//   is never so masked) — so no journal-error staging reaches the gate at
//   `impact`, nor at `review create --base`; that verdict is T6.3-6's, not
//   asserted here. The obstructed write path stages a plain file over the
//   emptied `markdown.outDir` directory after a successful build: the emit
//   write path's workspace-relative component `mdout` is then occupied by
//   a non-directory (13.4) — the workspace's one offending component,
//   nonexistent deeper components never being the condition — so `build`
//   would report exactly the one condition-22 finding (14.22: one finding
//   per distinct offending component); this staging alone also drives
//   `impact --base`, against a commit taken before the obstruction was
//   staged — the baseline's sources and configuration validate and the
//   journal is absent on both sides (an empty journal is a prefix of every
//   journal, 6.3) — so its baseline resolves and 14.22 is the operative
//   gate finding (12.0). Each gated read's 14.13 finding is asserted
//   form-exact as T6.1-3 asserts it (TEST-SPEC T13.3-3;
//   `assertJournalGateFinding`): `code` `journal-error`, `path` exactly
//   `.xspec/journal`, and `locations` `[]` — a journal condition carries
//   the concerned journal path and no in-source location (SPEC 14, 14.13,
//   12.7) — the line named in the message alone, by T6.1-3's H-4
//   operationalization: the message echoing the garbage text or citing
//   line/entry 2 (and, in human form, anywhere in the report: the
//   human-form note below). The never-gated contrast (`occurrences`,
//   `view`, `at` answering per 11.2, `inventory` answering whatever the
//   sources' validity, SPEC 11.6) is asserted at this module's
//   identity/membership altitude, each probe inside its own whole-root
//   compare: a gate condition is a finding of no domain file — the
//   journal and a write-path component are never domain files — so those
//   answers are complete and finding-free at exit 0, whatever journal or
//   write-path state the workspace holds (SPEC 11.2), and nothing is
//   modified.
// - T13.3-3's stale twins (TEST-SPEC T13.3-3; SPEC 13.3, 11.2: on a
//   workspace failing `build`'s validations nothing is modified, all graph
//   data byte-for-byte as it was): graph data being current on the two
//   whole-gate stagings, a refresh there would rewrite nothing, so each is
//   staged again, stale, on a fresh twin — beta's text in `specs/A.mdx`
//   edited, validly, after graph data was last written and before any read
//   (`T13_3_3_GATE_A_EDITED`: every hash over beta's text, and beta's
//   range, change, SPEC 13.3, 5.5, while alpha's construct and its `d`
//   entry stay byte-identical, so the never-gated answers asserted stand),
//   and the write-path twin's obstruction placed on a write path other
//   than graph data's own: under `markdown: { emit: true, outDir: "out" }`,
//   built, the directory `out` replaced by a plain file, a directory
//   component of every emit destination. Each read the plain staging runs,
//   and each never-gated probe, gives its outcome there and leaves the
//   whole root — T13.3-2's operational path set with it — byte-identical,
//   failing a product that decides whether to refresh by source validity
//   alone. On the write-path twin the mutating `review` subcommands meet
//   the refused-write gate alike, past their acquisition (13.5, 10.7):
//   `review create --strategy audit` under a new name, `review resolve`
//   naming alpha's item (an unblocked leaf, 10.6), and `review split`
//   naming A's root item (its scope root has children, 10.7) each exit 1
//   reporting exactly the condition-22 finding concerning `out`, inside
//   the same whole-root compare — no session created, the existing
//   session, journal, derived files, and graph data byte-identical, the
//   stale graph data unrefreshed — their item ids read through `review
//   status` before the edit, while graph data was current. Once a twin's
//   probes have run, its premise: the gate condition lifted (the journal
//   back to its legitimate line; the plain file `out` removed, a
//   nonexistent component obstructing nothing, 13.4), one refreshing read
//   (`ids --json`, exit 0) must leave graph data differing from the stale
//   state every probe faced — else the edit made nothing stale and the
//   twin discriminated nothing (H-11: failing loud, never hollowing the
//   arm out); graph data stays opaque (H-4), the product's own refresh
//   alone asked whether it changes it.
// - T13.3-3's human form (T12.0-1's information parity; SPEC 12.0: the JSON
//   form carries the same information as the human report — here the
//   gate's report, exactly the findings a `build` would report, 13.3, each
//   with its stable code and the location, path, and identities it
//   concerns, 14): after each gated invocation's JSON assertions, at its
//   state and inside its modifies-nothing compare, the same argv without
//   `--json` exits 1 as well, and its report mentions what the decoded
//   findings carry (a product-to-itself comparison, H-4;
//   `assertHumanGateReport`, through the shared human-findings check,
//   `assertHumanFindingsMentions` in human-findings.ts, and
//   helpers/adapters/human.ts): every location's file, every concerned
//   path, and every identity (an identity-or-path boundary, so `mdout`
//   never counts inside `mdout/specs/A.md`, nor the write-path twin's `out`
//   inside `out/specs/A.md`); then, in a separate call, every finding's
//   stable code (`codeMention`: case-insensitive, its words joined by one
//   character that is neither letter nor digit or by nothing, never where
//   it ends a longer code), matched with those data blanked out; then
//   every location's start and end (whole numbers, SPEC 1.7, matched with
//   the digit-holding data among those blanked out). It
//   runs at the invalid-sources workspace's six reads but `query` and at
//   its five mutating `review` subcommands — each mutating subcommand's
//   human run inside the same compare as its JSON run, so it too creates
//   no session, records no status, and decomposes nothing — at every
//   whole-gate read but `query`, the stale twins' alike, and at the
//   write-path twin's three mutating `review` subcommands, likewise inside
//   their JSON runs' compares; in the garbage-journal stagings each human
//   report must also name the garbage line, as the JSON message must (one
//   predicate over both texts, `namesGarbageLine`). `query nodes` takes no
//   human run: `query` is a JSON-only surface (SPEC 11, 12.0), its bare
//   form the very document the probe decodes; nor does the lenient `check`
//   probe (`check`'s human findings are T14-1's). Limits: no mention is
//   associated with another, so which code, location, path, and identity
//   belong to which finding stay with the JSON assertions — a datum, a
//   code, or the line naming counts wherever the report prints it; a
//   message is free text, never blanked and never compared, so a gate
//   finding's message may spell its code's words and name its concerned
//   path, and those count there (the built product's do: `missing ID`,
//   `journal error: the entry on line 2 of .xspec/journal …`, `obstructed
//   write path: … component mdout …`, and the twin's `… component out …`),
//   and a whole number it spells may stand in for an offset of its value —
//   the 14.1 location's `0` and `3` for a citation's digits (the built
//   product's 14.1 message cites `SPEC 1.3`, whose `3` stands in for the
//   location's end); and no datum here holds a character a human report
//   may quote or escape, nor does a path arise in the marked byte form (the
//   staged paths are ASCII), so every datum is asked.
// - T13.3-2's record-discipline arm (record corrupted shape-blind, T6.6-6's
//   staging via the H-3 record-staging adapter): SPEC 13.3 pins the record —
//   the recorded derived-file paths — as neither read, repaired, nor
//   replaced by a refresh, while the record's location inside the graph-data
//   area is deliberately unenumerated (13.3, 11.6), so the harness cannot
//   byte-pin which files under `.xspec/` a conforming refresh may rewrite
//   around the preserved record state. The arm therefore asserts persistence
//   through the record-consulting surface TEST-SPEC names: after every
//   refreshing read, `inventory` still reports `recorded` explicitly
//   unavailable (exit 1, the 14.23 outcome; the finding's full form is
//   T11.6-4's home), while outside the graph data the workspace stays
//   byte-identical (no TypeScript or Markdown generated or removed, sources
//   and durable files untouched); a successful `build` then replaces the
//   state (`recorded` a plain list again at exit 0, SPEC 13.3, 14.10, 12.1).
// - T13.3-5 (never stale), arm (a), tampered graph data (TEST-SPEC
//   T13.3-5; SPEC 13.3, 13.4, 11.6, 14.10, 14.23; H-3, H-4, H-10, E-5,
//   S-3): on T13.3-2's workspace, staged as T13.3-2's body stages it
//   (`stageRefreshWorkspace`: freshly built and valid, its session `s`
//   and baseline commit in place), graph data is tampered with shape-blind
//   — SPEC 13.3 enumerates no layout, so no adapter is involved (H-3) and
//   the staging never asks which file holds what. Each trial is one
//   graph-data state staged whole on a fresh byte copy of the workspace
//   (`withStagedTrial`, `restoreGraphData`), read off the product's own
//   writes (`readTamperingTrials`, the shared reading S-3's pre-product
//   check drives at stand-in file sets): per seed of the property
//   machinery's fixed seed set (helpers/property.ts
//   `DEFAULT_PROPERTY_SEEDS`, drawn through `drawFixedSeedTrials`; H-10,
//   E-5), rounds of one trial per nonempty file of T13.3-2's operational
//   path set, in key order, as many rounds as reach eight trials a seed
//   (`TAMPERING_TRIALS_PER_SEED`) — the file's byte at a seeded offset
//   changed to another value, one seeded bit of it flipped (a flipped bit
//   keeps a byte in its class, so the file readable and a digest beside its
//   content intact, far more often than an arbitrary value: only such an
//   alteration catches a product answering from stored content whose
//   digest still matches), or the file truncated at that offset — so every
//   nonempty file is altered in some trial; then,
//   where the workspace's own state and a twin's (built after alpha's own
//   text was edited, `T13_3_5_TWIN_FILES`) hold two or more files between
//   them, mixes: each path at which the states differ — a file in one
//   alone, or two files' bytes — takes a distinct index by a seeded
//   permutation (the first fixed seed), and for each bit an index needs
//   one mix takes from the twin the paths whose index has it set and
//   another those whose index has it clear, so every two differing paths,
//   their indices differing at some bit, are taken one from each state,
//   both ways round, each mix taking some from each (2·⌈log₂ d⌉ mixes over
//   d differing paths; d = 1, the one mix taking that path from the twin);
//   a path the states hold alike is the same file either way, the
//   workspace's own directories stay, and a twin's file no tree can hold
//   beside what the workspace's own state keeps is dropped, the trial's
//   description saying so. Where the states hold several files, they must
//   differ somewhere (graph data holds every hash and alpha's own text
//   enters its ownHash, SPEC 13.3, 5.5; H-11: else the mixes stage the
//   workspace's own state and discriminate nothing). The trial count
//   follows from the files the product writes, known only once staged, so
//   the trial loop carries no guard fixed in advance (S-3; none at all
//   under the suite's conservative design). Every run is on its own byte
//   copy of the staged state (`withByteCopy`, `.git` included, so
//   `impact --base` resolves), a refresh repairing the staging for every
//   later read: T13.3-2's ten reads, each under `--json`, then `inventory`
//   and `check --json`. The untampered workspace's runs, made the same way,
//   are the comparison and the premise (`observeUntampered`): each read
//   exits 0 with one JSON document and leaves the operational path set
//   byte-identical (graph data a `build` just wrote is current), its
//   `recorded` a list, `check` finding-free. On each trial
//   (`judgeTamperingTrial`): each read's exit code and stdout equal its
//   untampered run's, byte for byte; whether each read left the
//   operational path set byte-identical, its graph-data entries compared
//   whole before and after (H-4), every read alike — each refreshes by
//   13.3's one comparison exactly when graph data does not match — and
//   `inventory`'s `recorded` (the record read without refresh, 11.6: a
//   list at exit 0, or the unavailability marker at exit 1) are the two
//   observations `check`'s verdict is predicted from
//   (`assertPredictedVerdict`), never the staging (the record's files lie
//   at unenumerated paths, and a lagging or absent record is never
//   staleness, 13.3, 14.10, 14.23): exactly one
//   condition-10 finding in the unit form — `path` `".xspec"`, `locations`
//   `[]` — when `recorded` is unavailable (its form alone, 14.10's
//   exclusive unit forms) or the reads rewrote the set; beside it, where
//   `recorded` is a list, one recorded-file-form finding concerning each
//   listed path outside the untampered `recorded` list (the paths the
//   current sources generate) whose occupant 13.4's removal would remove
//   (`removalWouldRemove`: judged on the staged state at the path's exact
//   bytes, `lstat` component by component, never following a link —
//   nothing, a directory, and a discovered source's file, by device and
//   inode, left as they are); nothing else, every finding condition 10
//   with `locations` `[]` and instructing rebuilding (no recorded path's
//   occupant obstructs a rebuild write: the staging alters no occupant
//   outside graph data); exit 1 exactly when it reports a finding. Arms (b)
//   and (c) are not yet registered.

import { Buffer } from "node:buffer";
import type { BigIntStats } from "node:fs";
import * as fsp from "node:fs/promises";
import type {
  AtReport,
  DecodedDatum,
  Finding,
  ItemStatus,
  OccurrenceRecord,
  PathValue,
  SessionListReport,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  ITEM_STATUSES,
  corruptGraphDataShapeBlind,
  decodeAtReport,
  decodeCoverageReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeImpactReport,
  decodeInventoryRecordedDatum,
  decodeNodeReport,
  decodeNodeRowsReport,
  decodeOccurrencesReport,
  decodeSessionListReport,
  decodeSessionStatusReport,
  decodeViewFilesReport,
  isGraphDataKey,
  pathValueBytes,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import {
  assertAcrossDirectoriesDeterministic,
  assertRunTwiceDeterministic,
} from "../../helpers/determinism.js";
import {
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../../helpers/property.js";
import type { Gen } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type {
  DirectorySnapshot,
  SnapshotEntry,
} from "../../helpers/snapshot.js";
import {
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  diffSnapshots,
  displaySnapshotPath,
  snapshotDirectory,
  snapshotKeyBytes,
} from "../../helpers/snapshot.js";
import { guardStep, guardSyncStep } from "../../helpers/step-guards.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { copyTreeBytes } from "../../helpers/tree-copy.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { assertHumanFindingsMentions } from "./human-findings.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertFindingInstructsRebuilding,
  assertFindingLocated,
  assertSameJson,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  runCli,
  runJson,
} from "./support.js";
import { GRAPH_DATA_AREA } from "./write-refusal-staging.js";

// One spec group plus one coverage profile (SPEC 7, 7.4): `coverage` and
// `review create --coverage` need a configured profile, and `targets: "all"`
// keeps the required set at every non-root node (SPEC 8.1). T13.3-2's
// record-discipline workspace, T13.3-3's garbage-journal workspace,
// T13.3-4's two-directory workspaces, and T13.3-5's twin stage it after
// their body's first product invocation, so S-7's sweep never reaches those
// stagings against the stub: a TypeScript staged-source record
// (helpers/staged-ts.ts; S-9's TypeScript and timing clauses), staged at
// every site.
const GRAPH_CONFIG = stagedTs(
  "T13.3-2/T13.3-3/T13.3-4/T13.3-5 xspec.config.ts — one spec group and the coverage profile p (targets all)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      targets: "all",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
);

/** Stage a fresh workspace with the given files, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({ files });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// Graph-data machinery (the T13.3-2 operational definition)
// ---------------------------------------------------------------------------

// Whether a snapshot key (a `/`-separated workspace-relative path) is graph
// data: under `.xspec/`, excluding the durable `.xspec/journal` and
// `.xspec/reviews/` and the transient lock path `.xspec/lock` with
// everything under it (SPEC 13.3, 13.4; TEST-SPEC T13.3-2). The predicate's
// home is the H-3 adapter layer (record-staging.ts, whose shape-blind
// corruption shares the operational path set); re-exported here for the
// suite modules sharing T13.3-2's operational definition — T6.6-5's
// record-deleted arm and T6.6-6's corrupt-record staging (section-6.6.ts).
export { isGraphDataKey };

/** The entries of a snapshot whose keys satisfy `keep`. */
function filteredEntries(
  entries: ReadonlyMap<string, SnapshotEntry>,
  keep: (key: string) => boolean,
): Map<string, SnapshotEntry> {
  const kept = new Map<string, SnapshotEntry>();
  for (const [key, entry] of entries) {
    if (keep(key)) kept.set(key, entry);
  }
  return kept;
}

/** A snapshot's graph-data entries (see {@link isGraphDataKey}). */
function graphDataEntries(
  snapshot: DirectorySnapshot,
): Map<string, SnapshotEntry> {
  return filteredEntries(snapshot.entries, isGraphDataKey);
}

/**
 * View a filtered entry map of `source` as a snapshot for
 * `assertSnapshotsEqual`: `source`'s root, real root, and acquisition mark
 * carried over, so the compare is classified as `source`'s (H-6,
 * helpers/snapshot.ts `lockPathExclusion`).
 */
function asSnapshot(
  source: DirectorySnapshot,
  entries: ReadonlyMap<string, SnapshotEntry>,
): DirectorySnapshot {
  return { ...source, entries };
}

/**
 * Assert a snapshot holds at least one graph-data entry — after `build`,
 * graph data lives under `.xspec/` (SPEC 13.3), so an empty set means the
 * product maintains it elsewhere or not at all. Exported for T6.6-5's
 * record-staging premise (section-6.6.ts).
 */
export function assertGraphDataPresent(
  snapshot: DirectorySnapshot,
  context: string,
): void {
  if (graphDataEntries(snapshot).size === 0) {
    fail(
      `${context}: expected graph data under .xspec/ (SPEC 13.3: xspec ` +
        `maintains graph data under .xspec/, and \`build\` writes it, ` +
        `12.1); found no entry under .xspec/ outside the durable journal ` +
        `and reviews/ paths and the transient lock path`,
    );
  }
}

/**
 * Assert the inventory's record-supplied datum is the plain empty record:
 * `recorded` exactly `[]` — a value, never the unavailability marker, never
 * null (SPEC 11.6: the record is empty wherever none exists, after recorded
 * state was removed without a rebuild included; 14.23: a record's absence
 * meets no condition; 12.7: the empty list is `[]`).
 */
function assertEmptyRecord(
  recorded: ReturnType<typeof decodeInventoryRecordedDatum>,
  label: string,
  why: string,
): void {
  if (recorded.state !== "value") {
    fail(
      `${label}: ${why} — expected the plain empty record, \`recorded\` ` +
        `exactly [] (SPEC 11.6, 14.23, 12.7); got state ` +
        JSON.stringify(recorded.state),
    );
  }
  assertSameJson(
    recorded.value,
    [],
    `${label}: ${why} — \`recorded\` must be exactly [] (SPEC 11.6, 12.7)`,
  );
}

/**
 * Delete the graph data per the T13.3-2 operational definition: every path
 * under `.xspec/` except `.xspec/journal` and `.xspec/reviews/` and the
 * transient lock path `.xspec/lock` with everything under it (SPEC 13.4:
 * no graph data — spared, whatever occupies it). The area is listed by raw
 * name bytes, each name judged by {@link isGraphDataKey}, and every entry
 * of the set removed at its exact byte path, so each name the product chose
 * goes — one that is not ASCII, or not valid UTF-8, included (graph data's
 * layout is the product's, SPEC 13.3; a name read through a lossy UTF-8
 * decode would be missed without an error).
 * Exported for the suite modules sharing T13.3-2's operational definition:
 * T6.6-5's record-deleted arm (section-6.6.ts), T13.4-10's obstruction arms
 * (section-13.4.ts), and T12.2-2's and T12.2-3's missing-graph-data arms
 * (section-12.1-12.2.ts).
 */
export async function deleteGraphData(
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const kind = await workspace.kind(".xspec");
  if (kind !== "dir") {
    fail(
      `${context}: expected the .xspec/ directory to exist before deleting ` +
        `graph data (SPEC 13.3); found ${kind}`,
    );
  }
  for (const name of await workspace.readdirBytes(".xspec")) {
    // The durable journal and reviews paths and the transient lock path are
    // no graph data (T13.3-2): left as they are.
    const key = `.xspec/${Buffer.from(name).toString("latin1")}`;
    if (!isGraphDataKey(key)) continue;
    await fsp.rm(
      workspace.bytePath(Buffer.concat([Buffer.from(".xspec/"), name])),
      { recursive: true, force: true },
    );
  }
}

/**
 * Restore previously captured graph-data bytes (deleting whatever graph data
 * currently exists first) — the stale-graph staging of T13.3-2's source-edit
 * arm, and the graph-data state each trial of T13.3-5(a) stages (a
 * product-written state with one file altered, or two states' files mixed;
 * `deriveTamperingTrials`). Every captured directory and plain file is
 * restored at its key's exact bytes (`snapshotKeyBytes`), whatever the name
 * — graph data's layout is the product's (SPEC 13.3), so a name that is not
 * ASCII, or not valid UTF-8, is restored like any other — through raw
 * byte-path calls that judge no staged-source declaration: these are the
 * product's own bytes at paths it chose, never a source (13.4). A
 * filesystem error while restoring is the harness's own failure (H-11),
 * thrown as an `Error`, never diagnosed. Only plain files and directories
 * are restorable: anything else captured under `.xspec/` violates SPEC 13.4
 * (every file xspec writes is a plain file) and fails diagnosed, before
 * anything is deleted or restored.
 */
async function restoreGraphData(
  workspace: TestWorkspace,
  entries: ReadonlyMap<string, SnapshotEntry>,
  context: string,
): Promise<void> {
  // Byte order (the keys hold one byte per character): a directory's key, a
  // prefix of its contents' keys, sorts before them.
  const keys = [...entries.keys()].sort();
  for (const key of keys) {
    // The key set comes from the map itself, so `get` cannot miss.
    const entry = entries.get(key) as SnapshotEntry;
    if (entry.kind !== "dir" && entry.kind !== "file") {
      fail(
        `${context}: graph data at ${displaySnapshotPath(key)} is a ` +
          `${entry.kind} — every file xspec writes is a plain file (SPEC ` +
          `13.4), so the harness cannot restore it as staged stale graph data`,
      );
    }
  }
  await deleteGraphData(workspace, context);
  for (const key of keys) {
    const entry = entries.get(key) as SnapshotEntry;
    const abs = workspace.bytePath(snapshotKeyBytes(key));
    try {
      if (entry.kind === "dir") {
        await fsp.mkdir(abs, { recursive: true });
      } else if (entry.kind === "file") {
        await fsp.mkdir(abs.subarray(0, abs.lastIndexOf(0x2f)), {
          recursive: true,
        });
        await fsp.writeFile(abs, entry.bytes);
      }
    } catch (error) {
      throw new Error(
        `${context}: harness error: cannot restore the captured graph ` +
          `data at ${displaySnapshotPath(key)} (T13.3-2's stale-graph ` +
          `staging): ${(error as Error).message}`,
        { cause: error },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Review-session helpers (SPEC 10.6, 10.7)
// ---------------------------------------------------------------------------

/** `review status <name> --json`, decoded (SPEC 10.7). */
async function sessionStatus(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<SessionStatusReport> {
  const label = `${context} \`review status ${name} --json\``;
  return decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", name, "--json"],
      label,
    ),
    label,
  );
}

/**
 * `review list --json`, decoded (SPEC 10.7) — exit 0 (`runJson`): `list`
 * exits 1 only when a session is corrupt, and this module's sessions are
 * product-written and intact.
 */
async function sessionList(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<SessionListReport> {
  const label = `${context} \`review list --json\``;
  return decodeSessionListReport(
    await runJson(product, workspace, ["review", "list", "--json"], label),
    label,
  );
}

/**
 * Assert a `review list` answer lists exactly the one session `s`, healthy,
 * its strategy `audit` (a name SPEC 10 fixes), with the item counts by
 * stored status `expected` — counted from stored statuses, without the
 * read-time invalidation of 10.4 (SPEC 10.7), so they draw on no graph data
 * — each status compared as `counts[status] ?? 0` (whether a zero count is
 * an explicit entry is concrete shape, H-3; section-10.7-i.ts' convention),
 * and that it reports no finding: no corrupt session is listed, so the
 * listing's findings member is absent or empty (SPEC 10.7, 12.7).
 */
function assertListsSessionS(
  report: SessionListReport,
  expected: Readonly<Partial<Record<ItemStatus, number>>>,
  context: string,
): void {
  if (report.findings !== undefined && report.findings.length > 0) {
    fail(
      `${context}: the listing reports no finding — no session is corrupt ` +
        `(SPEC 10.7, 14.21); got ${JSON.stringify(report.findings)}`,
    );
  }
  if (report.sessions.length !== 1) {
    fail(
      `${context}: expected exactly the one created session "s" (SPEC ` +
        `10.7: every session is reported); got ` +
        JSON.stringify(report.sessions.map((entry) => entry.name)),
    );
  }
  const entry = report.sessions[0];
  if (entry.name !== "s" || entry.corrupt) {
    fail(
      `${context}: expected the session "s", not corrupt (SPEC 10.7); got ` +
        JSON.stringify(entry),
    );
  }
  assertSameJson(
    entry.strategy,
    "audit",
    `${context}: the session's strategy (SPEC 10.6, 10.7)`,
  );
  for (const status of ITEM_STATUSES) {
    const actual = entry.counts[status] ?? 0;
    const want = expected[status] ?? 0;
    if (actual !== want) {
      fail(
        `${context}: \`review list\` counts the session's items by stored ` +
          `status, without the read-time invalidation of 10.4 — its counts ` +
          `draw on no graph data (SPEC 10.7) — expected ${String(want)} ` +
          `item(s) stored ${status}, got ${String(actual)} (counts: ` +
          `${JSON.stringify(entry.counts)})`,
      );
    }
  }
}

/**
 * The unique status row scoped at `scope`, diagnosed loudly when missing or
 * duplicated (SPEC 10.1: at most one item per kind and scope node — audit
 * items are all `subtree-coherence`, so scope alone is unique here).
 */
function requireRowByScope(
  report: SessionStatusReport,
  scope: string,
  context: string,
): SessionStatusRow {
  const rows = report.items.filter((row) => row.scope === scope);
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one item scoped at ${scope} ` +
        `(SPEC 10.1, 10.6); found ${String(rows.length)} among ` +
        JSON.stringify(
          report.items.map((row) => ({ scope: row.scope, kind: row.kind })),
        ),
    );
  }
  return rows[0] as SessionStatusRow;
}

/** Expected observable state of one session item in a `status` report. */
interface ExpectedRow {
  readonly scope: string;
  readonly status: string;
  readonly blocked: boolean;
}

/** Assert the exact row set of a `status` report by scope (SPEC 10.7, 10.4). */
function assertStatusRows(
  report: SessionStatusReport,
  expected: readonly ExpectedRow[],
  context: string,
): void {
  if (report.items.length !== expected.length) {
    fail(
      `${context}: expected exactly ${String(expected.length)} items ` +
        `(reads never add or remove items, SPEC 10.4/10.7); got ` +
        JSON.stringify(
          report.items.map((row) => ({
            scope: row.scope,
            status: row.status,
            blocked: row.blocked,
          })),
        ),
    );
  }
  for (const want of expected) {
    const row = requireRowByScope(report, want.scope, context);
    if (row.status !== want.status || row.blocked !== want.blocked) {
      fail(
        `${context}: the item scoped at ${want.scope} must report status ` +
          `${JSON.stringify(want.status)} and blocked=${String(want.blocked)} ` +
          `(read-time invalidation against the current graph, SPEC 10.4, ` +
          `10.3); got status ${JSON.stringify(row.status)}, blocked=` +
          String(row.blocked),
      );
    }
  }
}

/** `review resolve <s> <item> --status no-change` must succeed (SPEC 10.7). */
async function resolveNoChange(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  itemId: string,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "resolve", session, itemId, "--status", "no-change"],
    0,
    `${context} \`review resolve ${session} ${itemId} --status no-change\``,
  );
}

// ---------------------------------------------------------------------------
// §11.2-surface sweep helpers (SPEC 11.3, 11.5) — the identity-level scope
// this module's sweeps assert (see the header note)
// ---------------------------------------------------------------------------

/** One sweep probe: a labeled read invocation with its answer assertions. */
interface SweepProbe {
  readonly label: string;
  readonly run: () => Promise<void>;
}

/**
 * Identity-level projection of occurrence records: referencing file, edge
 * kind, source graph-node identity (or the unavailability marker), resolved
 * target identity. Ranges stay unprojected — the decoder validates their
 * form and order, and byte-precise span semantics are T11.3-*'s home
 * (SPEC 5.7, 11.3).
 */
function occurrenceIdentitySummaries(records: readonly OccurrenceRecord[]): {
  file: PathValue;
  kind: string;
  source: string | { readonly unavailable: true };
  target: string;
}[] {
  return records.map((record) => ({
    file: record.file,
    kind: record.kind,
    source:
      "identity" in record.source ? record.source.identity : record.source,
    target: record.target,
  }));
}

/**
 * Assert an `at` answer at this module's identity level: finding-free, the
 * resolution present (only an unparseable file's resolution is unavailable,
 * and these fixtures are parseable), resolving to the expected section
 * identity with no containing occurrence (SPEC 11.5, 11.2; construct-range
 * byte precision is T11.5-*'s home).
 */
function assertAtAnswer(
  report: AtReport,
  expectedIdentity: string,
  context: string,
): void {
  if ("unavailable" in report.resolution) {
    fail(
      `${context}: the resolution must be present — the named file is ` +
        `parseable, and only an unparseable file's resolution is reported ` +
        `explicitly unavailable (SPEC 11.5, 11.2); got the unavailability ` +
        `marker`,
    );
  }
  assertSameJson(
    {
      findings: report.findings,
      identity: report.resolution.section.identity,
      occurrence: report.resolution.occurrence,
    },
    { findings: [], identity: expectedIdentity, occurrence: null },
    `${context}: a finding-free answer resolving the offset to the ` +
      `innermost enclosing section construct, the offset lying within no ` +
      `occurrence (SPEC 11.5, 11.2)`,
  );
}

// ---------------------------------------------------------------------------
// T13.3-1 — serving reads
// ---------------------------------------------------------------------------

// alpha depending on beta, then beta: T13.3-1's source — and byte for byte
// the source T13.3-2's record-discipline workspace and T13.3-3's whole-gate
// workspaces stage after their bodies' first invocations, so it is one
// staged-source record staged at every site (S-9's before-any-product
// clause; helpers/staged-mdx.ts), aliased below where each arm names it.
const ALPHA_ON_BETA_SOURCE = stagedMdx(
  "T13.3-1/T13.3-2/T13.3-3 specs/A.mdx (alpha depending on beta, then beta: T13.3-1's workspace, T13.3-2's record-discipline workspace, T13.3-3's whole-gate workspaces)",
  [
    '<S id="alpha" d={["beta"]}>',
    "Alpha depends on beta.",
    "</S>",
    "",
    '<S id="beta">',
    "Beta text.",
    "</S>",
    "",
  ].join("\n"),
);

const T13_3_1 = defineProductTest({
  id: "T13.3-1",
  title:
    "after `build`, the read commands (check, ids, show, coverage, impact, review, query, occurrences, view, at) answer without error, and graph data lives under .xspec/ (SPEC 13.3, 12.0)",
  run: async (product) => {
    await withWorkspace(
      { "xspec.config.ts": GRAPH_CONFIG, "specs/A.mdx": ALPHA_ON_BETA_SOURCE },
      async (workspace) => {
        const A_ROOT = "specs/A.mdx";
        const ALPHA = "specs/A.mdx#alpha";
        const BETA = "specs/A.mdx#beta";

        // Baseline commit of the pristine sources, so `impact --base` has a
        // resolvable, reconstructable baseline equal to the current sources.
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, "T13.3-1 `build` (SPEC 12.1)");

        // Graph data lives under `.xspec/` (SPEC 13.3): after `build`, the
        // directory exists and holds graph data (content opaque, H-4). No
        // journal or session exists yet, so everything under it is graph
        // data by the T13.3-2 operational definition.
        const afterBuild = await snapshotDirectory(workspace.root);
        assertGraphDataPresent(afterBuild, "T13.3-1 after `build`");

        // An audit session, so `review` has a session to answer about
        // (SPEC 10.6, 10.7).
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.3-1 `review create --strategy audit --name s` (SPEC 10.7)",
        );

        // Every read answers without error — and, serving from the graph
        // data `build` wrote, modifies nothing (compare-around protocol; a
        // conforming rewrite of identical bytes still passes, H-4).
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            await expectExit(
              product,
              workspace,
              ["check"],
              0,
              "T13.3-1 `check` after a clean build — no findings, exit 0 " +
                "(SPEC 12.2, 13.3)",
            );

            const idsLabel = "T13.3-1 `ids --json`";
            const ids = decodeIdsReport(
              await runJson(product, workspace, ["ids", "--json"], idsLabel),
              idsLabel,
            );
            assertSameJson(
              ids.files,
              [{ file: A_ROOT, ids: ["alpha", "beta"] }],
              `${idsLabel}: the staged IDs, served after \`build\` (SPEC ` +
                `13.3, 12.3)`,
            );

            const showLabel = `T13.3-1 \`show ${ALPHA} --json\``;
            const alpha = decodeNodeReport(
              await runJson(
                product,
                workspace,
                ["show", ALPHA, "--json"],
                showLabel,
              ),
              showLabel,
            );
            assertSameJson(
              alpha.identity,
              ALPHA,
              `${showLabel}: identity of the addressed node (SPEC 12.4)`,
            );
            assertBytesEqual(
              alpha.subtreeText,
              "Alpha depends on beta.\n",
              `${showLabel}: subtree text served from the built graph ` +
                `(SPEC 12.4, 1.6)`,
            );

            const coverageLabel = "T13.3-1 `coverage --json`";
            const coverage = decodeCoverageReport(
              await runJson(
                product,
                workspace,
                ["coverage", "--json"],
                coverageLabel,
              ),
              coverageLabel,
            );
            if (
              coverage.profiles.length !== 1 ||
              coverage.profiles[0]?.name !== "p"
            ) {
              fail(
                `${coverageLabel}: expected exactly the one configured ` +
                  `profile "p" (SPEC 8.2); got ` +
                  JSON.stringify(
                    coverage.profiles.map((profile) => profile.name),
                  ),
              );
            }
            const profile = coverage.profiles[0];
            assertSameJson(
              profile.counts,
              { required: 2, covered: 1, uncovered: 1, ignored: 1 },
              `${coverageLabel}: counts — required {alpha, beta}, beta ` +
                `covered by alpha's d edge, the root ignored (SPEC 8.1, 8.2)`,
            );
            assertSameJson(
              profile.covered,
              [{ identity: BETA, path: [ALPHA, BETA] }],
              `${coverageLabel}: the covered node and its covering path ` +
                `(SPEC 8.2)`,
            );
            assertSameJson(
              profile.uncovered,
              [ALPHA],
              `${coverageLabel}: the uncovered node (SPEC 8.2)`,
            );

            const impactLabel = `T13.3-1 \`impact --base ${base} --json\``;
            const impact = decodeImpactReport(
              await runJson(
                product,
                workspace,
                ["impact", "--base", base, "--json"],
                impactLabel,
              ),
              impactLabel,
            );
            assertSameJson(
              {
                requirements: impact.requirements,
                direct: impact.code.direct,
                transitive: impact.code.transitive,
              },
              { requirements: [], direct: [], transitive: [] },
              `${impactLabel}: current sources equal the baseline, so no ` +
                `node receives a category and no code is impacted (SPEC ` +
                `5.6, 9.3; informational, exit 0)`,
            );

            const listLabel = "T13.3-1 `review list --json`";
            const list = decodeSessionListReport(
              await runJson(
                product,
                workspace,
                ["review", "list", "--json"],
                listLabel,
              ),
              listLabel,
            );
            if (list.sessions.length !== 1) {
              fail(
                `${listLabel}: expected exactly the one created session ` +
                  `(SPEC 10.7); got ` +
                  JSON.stringify(list.sessions.map((entry) => entry.name)),
              );
            }
            const entry = list.sessions[0];
            if (entry.name !== "s" || entry.corrupt) {
              fail(
                `${listLabel}: expected the session "s", not corrupt ` +
                  `(SPEC 10.7); got ${JSON.stringify(entry)}`,
              );
            }
            assertSameJson(
              entry.strategy,
              "audit",
              `${listLabel}: the session's strategy (SPEC 10.7)`,
            );

            const status = await sessionStatus(
              product,
              workspace,
              "s",
              "T13.3-1",
            );
            assertStatusRows(
              status,
              [
                // Audit: one subtree-coherence item per node, roots
                // included; the root's blockedBy is its child sections'
                // items (SPEC 10.6).
                { scope: A_ROOT, status: "unresolved", blocked: true },
                { scope: ALPHA, status: "unresolved", blocked: false },
                { scope: BETA, status: "unresolved", blocked: false },
              ],
              "T13.3-1 `review status s --json` (SPEC 10.6, 10.7)",
            );

            const queryLabel = "T13.3-1 `query nodes`";
            const rows = decodeNodeRowsReport(
              await runJson(product, workspace, ["query", "nodes"], queryLabel),
              queryLabel,
            );
            for (const identity of [ALPHA, BETA]) {
              if (!rows.some((row) => row.identity === identity)) {
                fail(
                  `${queryLabel}: expected ${identity} among the reported ` +
                    `rows (SPEC 11); got ` +
                    JSON.stringify(rows.map((row) => row.identity).sort()),
                );
              }
            }

            // The 11.2 surfaces are read commands of 13.3 too — JSON-only,
            // answering one document when invoked bare (SPEC 11, 11.2).
            const occurrencesLabel = "T13.3-1 `occurrences`";
            const occurrences = decodeOccurrencesReport(
              await runJson(
                product,
                workspace,
                ["occurrences"],
                occurrencesLabel,
              ),
              occurrencesLabel,
            );
            assertSameJson(
              {
                findings: occurrences.findings,
                occurrences: occurrenceIdentitySummaries(
                  occurrences.occurrences,
                ),
              },
              {
                findings: [],
                occurrences: [
                  {
                    file: A_ROOT,
                    kind: "depends",
                    source: ALPHA,
                    target: BETA,
                  },
                ],
              },
              `${occurrencesLabel}: the staged d entry is the workspace's ` +
                `one reference occurrence — alpha's depends reference to ` +
                `beta, finding-free (SPEC 11.3, 5.7, 13.3)`,
            );

            const viewLabel = "T13.3-1 `view`";
            const view = decodeViewFilesReport(
              await runJson(product, workspace, ["view"], viewLabel),
              viewLabel,
            );
            assertSameJson(
              view,
              { findings: [], files: [A_ROOT] },
              `${viewLabel}: with neither operands nor --file, the request ` +
                `covers every discovered spec source — one per-file view, ` +
                `finding-free (SPEC 11.4, 12.7)`,
            );

            // Byte 30 lies inside "Alpha depends on beta." — within alpha's
            // construct (bytes 0..55), outside beta's (starting at 57) and
            // outside the d entry's occurrence span ("beta" at bytes
            // 18..24) (SPEC 11.5, 1.7).
            const atLabel = "T13.3-1 `at specs/A.mdx 30`";
            assertAtAnswer(
              decodeAtReport(
                await runJson(
                  product,
                  workspace,
                  ["at", A_ROOT, "30"],
                  atLabel,
                ),
                atLabel,
              ),
              ALPHA,
              atLabel,
            );
          },
          "T13.3-1 the read commands serve from the graph data `build` " +
            "wrote without modifying anything in the workspace (SPEC 13.3, " +
            "10.4, 12.0)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.3-2 — refresh
// ---------------------------------------------------------------------------

const T13_3_2_A_V0 = [
  '<S id="alpha">',
  "Alpha original text.",
  "</S>",
  "",
].join("\n");
// The edit adds a section carrying a same-file d reference: the edited
// sources hold exactly one reference occurrence where the pre-edit sources
// hold none, so `occurrences` (and `coverage`, via the new edge) answer
// values stale graph data cannot produce (SPEC 5.7, 8.2, 13.3).
const T13_3_2_A_V1 = [
  '<S id="alpha">',
  "Alpha revised text.",
  "</S>",
  "",
  '<S id="added" d={["alpha"]}>',
  "Added section text.",
  "</S>",
  "",
].join("\n");
// Arm B's edit is staged after arm A's product invocations, so it is a ledger
// record (S-9's before-any-product clause; helpers/staged-mdx.ts) — the same
// constant (which still spells the expected snapshot bytes in the body).
const T13_3_2_A_EDITED = stagedMdx(
  "T13.3-2 source-edit arm: specs/A.mdx revised, with a section carrying a same-file d reference added",
  T13_3_2_A_V1,
);
const T13_3_2_B = ['<S id="beta">', "Beta text.", "</S>", ""].join("\n");

// The record-discipline arm's one source: a d reference makes every
// surface's answer contentful (the one occurrence; beta covered through it),
// and the workspace is otherwise clean — a successful `build` precedes the
// corruption, so nothing but the corrupt record is wrong (SPEC 13.3, 14.23).
// Its workspace is created after the source-edit arms' invocations: the
// staged-source record holding these bytes (T13.3-1's source).
const T13_3_2_RECORD_A = ALPHA_ON_BETA_SOURCE;

/**
 * Stage T13.3-2's workspace on `workspace`, holding T13.3-2's initial files
 * (`GRAPH_CONFIG`, `T13_3_2_A_V0`, `T13_3_2_B`): a baseline commit, `build`,
 * an audit session `s` with three items resolved `no-change` — alpha's,
 * beta's, then A's root's, leaves first (audit blocking is bottom-up, SPEC
 * 10.6); B's root item stays unresolved — and a fixed-point rebuild, so the
 * on-disk graph data is exactly what `build` writes for this workspace
 * state (SPEC 12.0, 13.3 determinism). Returns the baseline commit,
 * `impact --base`'s resolvable ref (SPEC 6.3). Shared by T13.3-2's first
 * workspace and T13.3-5's (TEST-SPEC T13.3-5: "T13.3-2's workspace,
 * freshly built and valid"), `context` leading every diagnosis.
 */
async function stageRefreshWorkspace(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<string> {
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${context} staging \`build\``);
  await expectExit(
    product,
    workspace,
    ["review", "create", "--strategy", "audit", "--name", "s"],
    0,
    `${context} staging \`review create --strategy audit --name s\``,
  );
  const staged = await sessionStatus(
    product,
    workspace,
    "s",
    `${context} staging`,
  );
  const lookup = `${context} staging item lookup`;
  const alphaItem = requireRowByScope(staged, "specs/A.mdx#alpha", lookup).id;
  const betaItem = requireRowByScope(staged, "specs/B.mdx#beta", lookup).id;
  const aRootItem = requireRowByScope(staged, "specs/A.mdx", lookup).id;
  await resolveNoChange(product, workspace, "s", alphaItem, context);
  await resolveNoChange(product, workspace, "s", betaItem, context);
  await resolveNoChange(product, workspace, "s", aRootItem, context);
  await buildOk(
    product,
    workspace,
    `${context} staging fixed-point rebuild — the on-disk graph data is ` +
      "exactly what `build` writes for the current workspace state " +
      "(SPEC 12.0/13.3 determinism)",
  );
  return base;
}

const T13_3_2 = defineProductTest({
  id: "T13.3-2",
  title:
    "deleting the graph data (every path under .xspec/ except the durable journal and reviews/ and the transient lock path .xspec/lock with everything under it) or editing a source makes each of ids, show, coverage, impact, review status, review list (answering only past the refresh, its item counts by stored status drawing on no graph data — the edited source's invalidated items still counted under their stored status), query, occurrences, view, at answer from current sources and rewrite graph data as `build` would write it — while no TypeScript or Markdown is generated or removed and the recorded derived-file paths stay unchanged (a stale module stays stale, `check` reports 14.10; a later `build` removes the recorded orphan); an absent record stays absent — after a refreshing read on the deletion arm `inventory` reports `recorded` [] and, every derived file still matching, `check` is clean; with the record corrupted shape-blind instead, each refreshing read answers finding-free at exit 0, leaving the corrupt state neither read, repaired, nor replaced — `inventory` still reports `recorded` unavailable — until a successful `build` replaces the state (SPEC 13.3, 13.4, 10.7, 11.6, 12.1, 14.10, 14.23)",
  run: async (product) => {
    await withWorkspace(
      {
        "xspec.config.ts": GRAPH_CONFIG,
        "specs/A.mdx": T13_3_2_A_V0,
        "specs/B.mdx": T13_3_2_B,
      },
      async (workspace) => {
        const A_ROOT = "specs/A.mdx";
        const ALPHA = "specs/A.mdx#alpha";
        const ADDED = "specs/A.mdx#added";
        const B_ROOT = "specs/B.mdx";
        const BETA = "specs/B.mdx#beta";

        // --- Staging: baseline commit, build, an audit session with three
        // resolved items, then a fixed-point rebuild so the on-disk graph
        // data is exactly what `build` writes for this workspace state
        // (`stageRefreshWorkspace`, T13.3-5's staging too).
        const base = await stageRefreshWorkspace(product, workspace, "T13.3-2");
        const w0 = await snapshotDirectory(workspace.root);
        assertGraphDataPresent(w0, "T13.3-2 after the staging builds");
        const staleGraph = graphDataEntries(w0);

        // The ten refreshing reads (SPEC 13.3; `review` represented by
        // `status` and `list` per the T13.3-2 command list — 10.7: `list`
        // too answers only past the refresh, its stored-status counts
        // drawing on no graph data), with per-arm answer assertions
        // supplied by each arm below.
        const armAProbes: readonly SweepProbe[] = [
          {
            label: "`ids --json`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `ids --json`";
              const ids = decodeIdsReport(
                await runJson(product, workspace, ["ids", "--json"], label),
                label,
              );
              assertSameJson(
                ids.files,
                [
                  { file: A_ROOT, ids: ["alpha"] },
                  { file: B_ROOT, ids: ["beta"] },
                ],
                `${label}: the current sources' IDs (SPEC 13.3, 12.3)`,
              );
            },
          },
          {
            label: "`show`",
            run: async () => {
              const label = `T13.3-2 (deleted graph data) \`show ${ALPHA} --json\``;
              const node = decodeNodeReport(
                await runJson(
                  product,
                  workspace,
                  ["show", ALPHA, "--json"],
                  label,
                ),
                label,
              );
              assertBytesEqual(
                node.subtreeText,
                "Alpha original text.\n",
                `${label}: subtree text from the current sources (SPEC 13.3)`,
              );
            },
          },
          {
            label: "`coverage --json`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `coverage --json`";
              const coverage = decodeCoverageReport(
                await runJson(
                  product,
                  workspace,
                  ["coverage", "--json"],
                  label,
                ),
                label,
              );
              const profile = coverage.profiles.find((p) => p.name === "p");
              if (profile === undefined) {
                fail(
                  `${label}: the configured profile "p" must be reported ` +
                    `(SPEC 8.2); got ` +
                    JSON.stringify(coverage.profiles.map((p) => p.name)),
                );
              }
              assertSameJson(
                [...profile.uncovered].sort(),
                [ALPHA, BETA],
                `${label}: the current sources' uncovered nodes (SPEC 8.2, ` +
                  `13.3)`,
              );
            },
          },
          {
            label: "`impact --base`",
            run: async () => {
              const label = `T13.3-2 (deleted graph data) \`impact --base ${base} --json\``;
              const impact = decodeImpactReport(
                await runJson(
                  product,
                  workspace,
                  ["impact", "--base", base, "--json"],
                  label,
                ),
                label,
              );
              assertSameJson(
                {
                  requirements: impact.requirements,
                  direct: impact.code.direct,
                  transitive: impact.code.transitive,
                },
                { requirements: [], direct: [], transitive: [] },
                `${label}: current sources equal the baseline — no ` +
                  `categories (SPEC 5.6, 9.3, 13.3)`,
              );
            },
          },
          {
            label: "`review status`",
            run: async () => {
              const status = await sessionStatus(
                product,
                workspace,
                "s",
                "T13.3-2 (deleted graph data)",
              );
              assertStatusRows(
                status,
                [
                  { scope: A_ROOT, status: "no-change", blocked: false },
                  { scope: ALPHA, status: "no-change", blocked: false },
                  { scope: B_ROOT, status: "unresolved", blocked: false },
                  { scope: BETA, status: "no-change", blocked: false },
                ],
                "T13.3-2 (deleted graph data) `review status s --json` — " +
                  "sources unchanged, so nothing is invalidated (SPEC 10.4)",
              );
            },
          },
          {
            label: "`review list`",
            run: async () => {
              assertListsSessionS(
                await sessionList(
                  product,
                  workspace,
                  "T13.3-2 (deleted graph data)",
                ),
                { "no-change": 3, unresolved: 1 },
                "T13.3-2 (deleted graph data) `review list --json` — the " +
                  "three resolved items and B's unresolved root item, as " +
                  "stored (SPEC 10.7, 13.3)",
              );
            },
          },
          {
            label: "`query nodes`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `query nodes`";
              const rows = decodeNodeRowsReport(
                await runJson(product, workspace, ["query", "nodes"], label),
                label,
              );
              for (const identity of [ALPHA, BETA]) {
                if (!rows.some((row) => row.identity === identity)) {
                  fail(
                    `${label}: expected ${identity} among the rows (SPEC ` +
                      `11, 13.3); got ` +
                      JSON.stringify(rows.map((row) => row.identity).sort()),
                  );
                }
              }
            },
          },
          {
            label: "`occurrences`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `occurrences`";
              const report = decodeOccurrencesReport(
                await runJson(product, workspace, ["occurrences"], label),
                label,
              );
              assertSameJson(
                report,
                { findings: [], occurrences: [] },
                `${label}: no reference spelling exists in these sources — ` +
                  `the definitive empty, finding-free enumeration, answered ` +
                  `from the current sources (SPEC 11.3, 5.7, 13.3)`,
              );
            },
          },
          {
            label: "`view`",
            run: async () => {
              const label = "T13.3-2 (deleted graph data) `view`";
              const view = decodeViewFilesReport(
                await runJson(product, workspace, ["view"], label),
                label,
              );
              assertSameJson(
                view,
                { findings: [], files: [A_ROOT, B_ROOT] },
                `${label}: with neither operands nor --file the request ` +
                  `covers every discovered spec source, finding-free ` +
                  `(SPEC 11.4, 12.7, 13.3)`,
              );
            },
          },
          {
            label: "`at`",
            run: async () => {
              // Byte 20 lies inside "Alpha original text." — within
              // alpha's construct (bytes 0..40 of the pre-edit source),
              // and the source spells no occurrence (SPEC 11.5, 1.7).
              const label = "T13.3-2 (deleted graph data) `at specs/A.mdx 20`";
              assertAtAnswer(
                decodeAtReport(
                  await runJson(
                    product,
                    workspace,
                    ["at", A_ROOT, "20"],
                    label,
                  ),
                  label,
                ),
                ALPHA,
                label,
              );
            },
          },
        ];

        // --- Arm A: deletion trigger. Before each command the graph data is
        // deleted whole — the record with it (SPEC 13.3: the recorded
        // derived-file paths are part of graph data, and the operational
        // deletion removes every non-durable path under .xspec/) — and the
        // command answers from current sources. Outside the graph data the
        // workspace must stay byte-identical to the fixed point W0 (no
        // TypeScript or Markdown generated or removed, durables untouched);
        // the graph data is rewritten — present again, every read writing
        // the same bytes (12.0) — but never byte-compared against W0's: an
        // absent record stays absent (13.3), so a conforming refresh writes
        // graph data beside no record where W0 holds `build`'s (module
        // header). "As `build` would write it" is the product's own
        // comparison instead: `inventory` reports `recorded` exactly []
        // and `check` is clean afterwards (14.10, 11.6; TEST-SPEC T13.3-2).
        //
        // Premise, on the deleted state before any read: the deletion
        // emptied the record — `inventory` reports `recorded` [] (11.6: the
        // record is empty after recorded state was removed without a
        // rebuild) — and `inventory` itself neither refreshes nor writes
        // (compare-around; a refreshing inventory would leave the reads
        // below nothing to refresh, so it fails loud here rather than
        // hollowing out the arm, H-11).
        await deleteGraphData(
          workspace,
          "T13.3-2 (deleted graph data) premise",
        );
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const label =
              "T13.3-2 (deleted graph data) premise `inventory` on the " +
              "deleted state";
            assertEmptyRecord(
              decodeInventoryRecordedDatum(
                await runJson(product, workspace, ["inventory"], label),
                label,
              ),
              label,
              "the operational deletion removes the record with the graph " +
                "data, and the inventory reads an absent record as the " +
                "empty record (SPEC 13.3, 11.6, 14.23)",
            );
          },
          "T13.3-2 (deleted graph data) premise: `inventory` neither " +
            "refreshes nor writes (SPEC 11.6)",
        );
        const expectedOutsideGraphA = filteredEntries(
          w0.entries,
          (key) => !isGraphDataKey(key),
        );
        let refreshedGraphA: DirectorySnapshot | undefined;
        for (const probe of armAProbes) {
          await deleteGraphData(
            workspace,
            `T13.3-2 (deleted graph data) before ${probe.label}`,
          );
          await probe.run();
          const after = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            asSnapshot(w0, expectedOutsideGraphA),
            asSnapshot(
              after,
              filteredEntries(after.entries, (key) => !isGraphDataKey(key)),
            ),
            `T13.3-2 (deleted graph data) after ${probe.label}: outside ` +
              `the graph data the workspace must be byte-identical to the ` +
              `post-build state — no TypeScript or Markdown generated or ` +
              `removed, journal and session files untouched (SPEC 13.3, ` +
              `13.4)`,
          );
          const graphNow = graphDataEntries(after);
          if (refreshedGraphA === undefined) {
            assertGraphDataPresent(
              after,
              `T13.3-2 (deleted graph data) after ${probe.label} — the ` +
                `read must have rewritten the deleted graph data`,
            );
            refreshedGraphA = asSnapshot(after, graphNow);
          } else {
            assertSnapshotsEqual(
              refreshedGraphA,
              asSnapshot(after, graphNow),
              `T13.3-2 (deleted graph data) after ${probe.label}: every ` +
                `refreshing read rewrites the same graph-data bytes for ` +
                `the same workspace state (SPEC 13.3, 12.0)`,
            );
          }

          // An absent record stays absent (SPEC 13.3): the refresh wrote
          // graph data beside the absent record and never a record, so
          // `inventory` reports `recorded` exactly [] (11.6) — and, every
          // derived file still matching and the graph data now present and
          // matching, `check` is clean: a lagging record alone is never
          // staleness (14.10). Neither surface refreshes or writes (11.6,
          // 12.2, 13.3), so both run inside one compare-around.
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              const invLabel = `T13.3-2 (deleted graph data) \`inventory\` after ${probe.label}`;
              assertEmptyRecord(
                decodeInventoryRecordedDatum(
                  await runJson(product, workspace, ["inventory"], invLabel),
                  invLabel,
                ),
                invLabel,
                "an absent record stays absent: the refresh writes graph " +
                  "data beside the absent record and never a record (SPEC " +
                  "13.3, 11.6)",
              );
              await expectFindingFreeReport(
                product,
                workspace,
                ["check", "--json"],
                `T13.3-2 (deleted graph data) \`check --json\` after ` +
                  `${probe.label} — every derived file still matches and ` +
                  `the refreshed graph data matches the current sources ` +
                  `and configuration; a lagging (here absent) record alone ` +
                  `is never staleness (SPEC 14.10, 13.3)`,
              );
            },
            `T13.3-2 (deleted graph data) after ${probe.label}: ` +
              `\`inventory\` and \`check\` neither refresh nor write (SPEC ` +
              `11.6, 12.2, 13.3)`,
          );
        }

        // --- Arm B: source-edit trigger, content-only edit (the generated
        // file set is unchanged, so the reference build below is exact; see
        // the module header). Before each command the stale pre-edit graph
        // data is restored, so every command individually faces
        // stale-but-present graph data and must answer from the edited
        // sources.
        await workspace.file("specs/A.mdx", T13_3_2_A_EDITED);
        const expectedNonGraph = filteredEntries(
          w0.entries,
          (key) => !isGraphDataKey(key),
        );
        expectedNonGraph.set("specs/A.mdx", {
          kind: "file",
          bytes: Buffer.from(T13_3_2_A_V1, "utf8"),
        });

        const armBProbes: readonly SweepProbe[] = [
          {
            label: "`ids --json`",
            run: async () => {
              const label = "T13.3-2 (edited source) `ids --json`";
              const ids = decodeIdsReport(
                await runJson(product, workspace, ["ids", "--json"], label),
                label,
              );
              assertSameJson(
                ids.files,
                [
                  { file: A_ROOT, ids: ["alpha", "added"] },
                  { file: B_ROOT, ids: ["beta"] },
                ],
                `${label}: the edited sources' IDs — never stale data ` +
                  `(SPEC 13.3, 12.3)`,
              );
            },
          },
          {
            label: "`show`",
            run: async () => {
              // The added node exists only in the edited sources: a product
              // serving stale graph data reports an unknown node (exit 2)
              // instead of answering.
              const label = `T13.3-2 (edited source) \`show ${ADDED} --json\``;
              const node = decodeNodeReport(
                await runJson(
                  product,
                  workspace,
                  ["show", ADDED, "--json"],
                  label,
                ),
                label,
              );
              assertSameJson(
                node.identity,
                ADDED,
                `${label}: the newly added node answers (SPEC 13.3, 12.4)`,
              );
              assertBytesEqual(
                node.subtreeText,
                "Added section text.\n",
                `${label}: subtree text from the edited source (SPEC 13.3)`,
              );
            },
          },
          {
            label: "`coverage --json`",
            run: async () => {
              const label = "T13.3-2 (edited source) `coverage --json`";
              const coverage = decodeCoverageReport(
                await runJson(
                  product,
                  workspace,
                  ["coverage", "--json"],
                  label,
                ),
                label,
              );
              const profile = coverage.profiles.find((p) => p.name === "p");
              if (profile === undefined) {
                fail(
                  `${label}: the configured profile "p" must be reported ` +
                    `(SPEC 8.2); got ` +
                    JSON.stringify(coverage.profiles.map((p) => p.name)),
                );
              }
              assertSameJson(
                [...profile.uncovered].sort(),
                [ADDED, BETA],
                `${label}: the added node is required and uncovered while ` +
                  `alpha is covered through its new d edge — the answer ` +
                  `reflects the edited sources (SPEC 8.1, 8.2, 13.3)`,
              );
              assertSameJson(
                profile.covered,
                [{ identity: ALPHA, path: [ADDED, ALPHA] }],
                `${label}: alpha's covering path exists only in the edited ` +
                  `sources — the stale graph holds no dependency edge at ` +
                  `all (SPEC 8.2, 13.3)`,
              );
            },
          },
          {
            label: "`impact --base`",
            run: async () => {
              const label = `T13.3-2 (edited source) \`impact --base ${base} --json\``;
              const impact = decodeImpactReport(
                await runJson(
                  product,
                  workspace,
                  ["impact", "--base", base, "--json"],
                  label,
                ),
                label,
              );
              const findChanged = (identity: string): void => {
                const entry = impact.requirements.find((candidate) =>
                  candidate.nodes.includes(identity),
                );
                if (
                  entry === undefined ||
                  !entry.categories.some(
                    (category) => category.category === "changed",
                  ) ||
                  entry.deleted
                ) {
                  fail(
                    `${label}: expected a present-node entry for ${identity} ` +
                      `carrying the \`changed\` category (edited/added since ` +
                      `the baseline, SPEC 5.6) — stale graph data would ` +
                      `report no difference; got ` +
                      JSON.stringify(impact.requirements),
                  );
                }
              };
              findChanged(ALPHA);
              findChanged(ADDED);
            },
          },
          {
            label: "`review status`",
            run: async () => {
              const status = await sessionStatus(
                product,
                workspace,
                "s",
                "T13.3-2 (edited source)",
              );
              assertStatusRows(
                status,
                [
                  // alpha's subtree changed and A's root subtree changed:
                  // both resolved items are reported invalidated against the
                  // current graph (SPEC 10.4); the invalidated alpha item
                  // re-blocks the root item (SPEC 10.3, 10.6). B is
                  // untouched, so beta's resolution stands — a product
                  // serving stale graph data would report all three still
                  // resolved.
                  { scope: A_ROOT, status: "invalidated", blocked: true },
                  { scope: ALPHA, status: "invalidated", blocked: false },
                  { scope: B_ROOT, status: "unresolved", blocked: false },
                  { scope: BETA, status: "no-change", blocked: false },
                ],
                "T13.3-2 (edited source) `review status s --json` (SPEC " +
                  "10.4, 13.3)",
              );
            },
          },
          {
            label: "`review list`",
            run: async () => {
              // Stored statuses, never the read-time invalidation `status`
              // reports above (SPEC 10.7, 10.4): alpha's and A's root
              // items still count under their stored `no-change`, beside
              // beta's — the counts draw on no graph data, stale or
              // refreshed.
              assertListsSessionS(
                await sessionList(
                  product,
                  workspace,
                  "T13.3-2 (edited source)",
                ),
                { "no-change": 3, unresolved: 1 },
                "T13.3-2 (edited source) `review list --json` — the " +
                  "invalidated items counted under their stored status " +
                  "(SPEC 10.7, 10.4, 13.3)",
              );
            },
          },
          {
            label: "`query nodes`",
            run: async () => {
              const label = "T13.3-2 (edited source) `query nodes`";
              const rows = decodeNodeRowsReport(
                await runJson(product, workspace, ["query", "nodes"], label),
                label,
              );
              for (const identity of [ALPHA, ADDED, BETA]) {
                if (!rows.some((row) => row.identity === identity)) {
                  fail(
                    `${label}: expected ${identity} among the rows — the ` +
                      `answer reflects the edited sources (SPEC 11, 13.3); ` +
                      `got ` +
                      JSON.stringify(rows.map((row) => row.identity).sort()),
                  );
                }
              }
            },
          },
          {
            label: "`occurrences`",
            run: async () => {
              const label = "T13.3-2 (edited source) `occurrences`";
              const report = decodeOccurrencesReport(
                await runJson(product, workspace, ["occurrences"], label),
                label,
              );
              assertSameJson(
                {
                  findings: report.findings,
                  occurrences: occurrenceIdentitySummaries(report.occurrences),
                },
                {
                  findings: [],
                  occurrences: [
                    {
                      file: A_ROOT,
                      kind: "depends",
                      source: ADDED,
                      target: ALPHA,
                    },
                  ],
                },
                `${label}: the edited source's d entry is the workspace's ` +
                  `one reference occurrence — the pre-edit sources spell ` +
                  `none, so stale graph data cannot produce this answer ` +
                  `(SPEC 11.3, 5.7, 13.3)`,
              );
            },
          },
          {
            label: "`view`",
            run: async () => {
              const label = "T13.3-2 (edited source) `view`";
              const view = decodeViewFilesReport(
                await runJson(product, workspace, ["view"], label),
                label,
              );
              assertSameJson(
                view,
                { findings: [], files: [A_ROOT, B_ROOT] },
                `${label}: the whole-domain request answers finding-free ` +
                  `over the edited, valid sources (SPEC 11.4, 12.7, 13.3)`,
              );
            },
          },
          {
            label: "`at`",
            run: async () => {
              // Byte 75 lies inside "Added section text." — within the
              // added section's construct (bytes 41..94 of the edited
              // source) and outside its d entry's occurrence span ("alpha"
              // at bytes 59..66); the section exists only in the edited
              // source, so a stale answer cannot name it (SPEC 11.5, 13.3).
              const label = "T13.3-2 (edited source) `at specs/A.mdx 75`";
              assertAtAnswer(
                decodeAtReport(
                  await runJson(
                    product,
                    workspace,
                    ["at", A_ROOT, "75"],
                    label,
                  ),
                  label,
                ),
                ADDED,
                label,
              );
            },
          },
        ];

        let refreshedGraph: DirectorySnapshot | undefined;
        for (const probe of armBProbes) {
          await restoreGraphData(
            workspace,
            staleGraph,
            `T13.3-2 (edited source) staging stale graph data before ${probe.label}`,
          );
          await probe.run();
          const after = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            asSnapshot(w0, expectedNonGraph),
            asSnapshot(
              after,
              filteredEntries(after.entries, (key) => !isGraphDataKey(key)),
            ),
            `T13.3-2 (edited source) after ${probe.label}: outside the ` +
              `graph data, only the harness's own source edit may differ ` +
              `from the pre-edit state — no TypeScript or Markdown is ` +
              `generated or removed (the stale generated module stays ` +
              `stale) and durable files are untouched (SPEC 13.3, 13.4)`,
          );
          const graphNow = graphDataEntries(after);
          if (refreshedGraph === undefined) {
            refreshedGraph = asSnapshot(after, graphNow);
            assertGraphDataPresent(
              after,
              `T13.3-2 (edited source) after ${probe.label}`,
            );
          } else {
            assertSnapshotsEqual(
              refreshedGraph,
              asSnapshot(after, graphNow),
              `T13.3-2 (edited source) after ${probe.label}: every ` +
                `refreshing read rewrites the same graph-data bytes for ` +
                `the same workspace state (SPEC 13.3, 12.0)`,
            );
          }
        }

        // The stale generated module stays stale: `check` never refreshes
        // derived TypeScript and reports 14.10 for A's module (SPEC 13.3,
        // 14.10) — and reports it against the module the refresh left
        // untouched, without modifying anything (SPEC 12.2).
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const label = "T13.3-2 (edited source) `check --json`";
            const result = await runCli(product, workspace, [
              "check",
              "--json",
            ]);
            assertExitCode(
              result,
              1,
              `${label} — the stale generated module is a finding (SPEC ` +
                `14.10, 12.2)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, label),
              label,
            ).findings;
            assertStaleModuleFindings(
              findings,
              "specs/A.xspec.",
              "specs/A.xspec.ts",
              label,
            );
          },
          "T13.3-2 (edited source) `check` reports the staleness the " +
            "refresh left behind",
        );

        // The reference build: `build` regenerates everything for the edited
        // sources; its graph data is by definition "what build would write",
        // and the refreshing reads must have written exactly those bytes
        // (the content-only edit keeps the recorded derived-file path set
        // identical; see the module header).
        await buildOk(
          product,
          workspace,
          "T13.3-2 (edited source) reference `build` (SPEC 12.1)",
        );
        const afterReferenceBuild = await snapshotDirectory(workspace.root);
        if (refreshedGraph === undefined) {
          throw new Error("T13.3-2 internal error: no arm-B probe ran");
        }
        assertSnapshotsEqual(
          refreshedGraph,
          asSnapshot(
            afterReferenceBuild,
            graphDataEntries(afterReferenceBuild),
          ),
          "T13.3-2 (edited source): the graph data the refreshing reads " +
            "wrote vs the graph data `build` writes for the identical " +
            "workspace state — the refresh writes exactly what `xspec " +
            "build` would write (SPEC 13.3, 12.0)",
        );

        // --- Arm B, set-changing sub-arm: deleting a source is also a
        // source edit; the refresh must leave the orphaned module in place
        // (no TypeScript removed) and the recorded derived-file paths
        // unchanged — observed through 14.10's recorded-orphan arm and
        // through the next `build` removing the orphan (SPEC 13.3, 13.4,
        // 12.1: orphan removal relies on the recorded paths, so removal
        // proves the record survived the refresh).
        const beforeDelete = await snapshotDirectory(workspace.root);
        if (beforeDelete.entries.get("specs/B.xspec.ts")?.kind !== "file") {
          fail(
            "T13.3-2 (deleted source): staging premise — after `build`, " +
              "B.mdx's generated module specs/B.xspec.ts exists as a plain " +
              "file (SPEC 13.1)",
          );
        }
        await fsp.rm(workspace.path("specs/B.mdx"));

        const label = "T13.3-2 (deleted source) `ids --json`";
        const ids = decodeIdsReport(
          await runJson(product, workspace, ["ids", "--json"], label),
          label,
        );
        assertSameJson(
          ids.files,
          [{ file: A_ROOT, ids: ["alpha", "added"] }],
          `${label}: the deleted source is gone from the answer (SPEC 13.3, ` +
            `12.3)`,
        );
        const bKind = await workspace.kind("specs/B.xspec.ts");
        if (bKind !== "file") {
          fail(
            "T13.3-2 (deleted source): after the refreshing read, " +
              "specs/B.xspec.ts must still exist — a refresh generates and " +
              "removes no TypeScript (SPEC 13.3); found " +
              bKind,
          );
        }
        const afterDeleteRead = await snapshotDirectory(workspace.root);
        const expectedAfterDelete = filteredEntries(
          beforeDelete.entries,
          (key) => !isGraphDataKey(key),
        );
        expectedAfterDelete.delete("specs/B.mdx");
        assertSnapshotsEqual(
          asSnapshot(beforeDelete, expectedAfterDelete),
          asSnapshot(
            afterDeleteRead,
            filteredEntries(
              afterDeleteRead.entries,
              (key) => !isGraphDataKey(key),
            ),
          ),
          "T13.3-2 (deleted source) after `ids`: outside graph data, only " +
            "the harness's own deletion of specs/B.mdx differs — the " +
            "refresh removed no TypeScript or Markdown and touched no " +
            "durable file (SPEC 13.3, 13.4)",
        );

        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const checkLabel = "T13.3-2 (deleted source) `check --json`";
            const result = await runCli(product, workspace, [
              "check",
              "--json",
            ]);
            assertExitCode(
              result,
              1,
              `${checkLabel} — B's recorded derived files remain at paths ` +
                `the current sources no longer generate (SPEC 14.10)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, checkLabel),
              checkLabel,
            ).findings;
            assertStaleModuleFindings(
              findings,
              "specs/B.xspec.",
              "specs/B.xspec.ts",
              checkLabel,
            );
          },
          "T13.3-2 (deleted source) `check` reports the recorded orphans",
        );

        await buildOk(
          product,
          workspace,
          "T13.3-2 (deleted source) `build` after the refresh (SPEC 12.1)",
        );
        const leftovers = (await workspace.readdirNames("specs")).filter(
          (name) => name.startsWith("B.xspec."),
        );
        if (leftovers.length > 0) {
          fail(
            "T13.3-2 (deleted source): `build` after the refreshing read " +
              "must remove B's orphaned module and companions — orphan " +
              "removal relies on the recorded derived-file paths (SPEC " +
              "13.4, 12.1), so the refresh must have left that record " +
              "unchanged (SPEC 13.3); left over: " +
              JSON.stringify(leftovers),
          );
        }
        const aKind = await workspace.kind("specs/A.xspec.ts");
        if (aKind !== "file") {
          fail(
            "T13.3-2 (deleted source): specs/A.xspec.ts must survive the " +
              "orphan-removing rebuild — A's source still generates it " +
              "(SPEC 12.1, 13.1); found " +
              aKind,
          );
        }
      },
    );

    // --- Record discipline (SPEC 13.3, 14.23): with the record corrupted
    // shape-blind (T6.6-6's staging), each refreshing read answers
    // finding-free at exit 0 on the otherwise clean workspace, reporting
    // nothing for the record and leaving the corrupt state neither read,
    // repaired, nor replaced — `inventory` still reports `recorded`
    // explicitly unavailable after every read (the record-consulting
    // surface; see the module header for why graph-data bytes are not
    // pinned here) — until a successful `build` replaces the state.
    await withWorkspace(
      { "xspec.config.ts": GRAPH_CONFIG, "specs/A.mdx": T13_3_2_RECORD_A },
      async (workspace) => {
        const A_ROOT = "specs/A.mdx";
        const ALPHA = "specs/A.mdx#alpha";
        const BETA = "specs/A.mdx#beta";

        // Staging: a resolvable baseline for `impact --base`, a successful
        // `build` (the corruption applies only to record files the product
        // itself wrote, H-3), and an audit session for `review status`.
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, "T13.3-2 (corrupt record) `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.3-2 (corrupt record) staging `review create --strategy " +
            "audit --name s` (SPEC 10.7)",
        );
        await corruptGraphDataShapeBlind(
          workspace.root,
          "T13.3-2 (corrupt record) staging",
        );
        const corrupted = await snapshotDirectory(workspace.root);
        const outsideGraph = filteredEntries(
          corrupted.entries,
          (key) => !isGraphDataKey(key),
        );

        const recordProbes: readonly SweepProbe[] = [
          {
            label: "`ids --json`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `ids --json`";
              const ids = decodeIdsReport(
                await runJson(product, workspace, ["ids", "--json"], label),
                label,
              );
              assertSameJson(
                ids.files,
                [{ file: A_ROOT, ids: ["alpha", "beta"] }],
                `${label}: the current sources' IDs, answered finding-free ` +
                  `(SPEC 13.3, 12.3)`,
              );
            },
          },
          {
            label: "`show`",
            run: async () => {
              const label = `T13.3-2 (corrupt record) \`show ${ALPHA} --json\``;
              const node = decodeNodeReport(
                await runJson(
                  product,
                  workspace,
                  ["show", ALPHA, "--json"],
                  label,
                ),
                label,
              );
              assertBytesEqual(
                node.subtreeText,
                "Alpha depends on beta.\n",
                `${label}: subtree text from the current sources (SPEC ` +
                  `13.3, 12.4)`,
              );
            },
          },
          {
            label: "`coverage --json`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `coverage --json`";
              const coverage = decodeCoverageReport(
                await runJson(
                  product,
                  workspace,
                  ["coverage", "--json"],
                  label,
                ),
                label,
              );
              const profile = coverage.profiles.find((p) => p.name === "p");
              if (profile === undefined) {
                fail(
                  `${label}: the configured profile "p" must be reported ` +
                    `(SPEC 8.2); got ` +
                    JSON.stringify(coverage.profiles.map((p) => p.name)),
                );
              }
              assertSameJson(
                {
                  covered: profile.covered,
                  uncovered: profile.uncovered,
                },
                {
                  covered: [{ identity: BETA, path: [ALPHA, BETA] }],
                  uncovered: [ALPHA],
                },
                `${label}: beta covered through alpha's d edge, alpha ` +
                  `uncovered (SPEC 8.2, 13.3)`,
              );
            },
          },
          {
            label: "`impact --base`",
            run: async () => {
              const label = `T13.3-2 (corrupt record) \`impact --base ${base} --json\``;
              const impact = decodeImpactReport(
                await runJson(
                  product,
                  workspace,
                  ["impact", "--base", base, "--json"],
                  label,
                ),
                label,
              );
              assertSameJson(
                {
                  requirements: impact.requirements,
                  direct: impact.code.direct,
                  transitive: impact.code.transitive,
                },
                { requirements: [], direct: [], transitive: [] },
                `${label}: current sources equal the baseline — no ` +
                  `categories, no impacted code (SPEC 5.6, 9.3, 13.3)`,
              );
            },
          },
          {
            label: "`review status`",
            run: async () => {
              const status = await sessionStatus(
                product,
                workspace,
                "s",
                "T13.3-2 (corrupt record)",
              );
              assertStatusRows(
                status,
                [
                  { scope: A_ROOT, status: "unresolved", blocked: true },
                  { scope: ALPHA, status: "unresolved", blocked: false },
                  { scope: BETA, status: "unresolved", blocked: false },
                ],
                "T13.3-2 (corrupt record) `review status s --json` — the " +
                  "session answers on the passing workspace (SPEC 10.6, " +
                  "10.7, 13.3)",
              );
            },
          },
          {
            label: "`review list`",
            run: async () => {
              assertListsSessionS(
                await sessionList(
                  product,
                  workspace,
                  "T13.3-2 (corrupt record)",
                ),
                { unresolved: 3 },
                "T13.3-2 (corrupt record) `review list --json` — the " +
                  "listing answers finding-free on the passing workspace, " +
                  "reporting nothing for the record (SPEC 10.7, 13.3, " +
                  "14.23)",
              );
            },
          },
          {
            label: "`query nodes`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `query nodes`";
              const rows = decodeNodeRowsReport(
                await runJson(product, workspace, ["query", "nodes"], label),
                label,
              );
              for (const identity of [ALPHA, BETA]) {
                if (!rows.some((row) => row.identity === identity)) {
                  fail(
                    `${label}: expected ${identity} among the rows (SPEC ` +
                      `11, 13.3); got ` +
                      JSON.stringify(rows.map((row) => row.identity).sort()),
                  );
                }
              }
            },
          },
          {
            label: "`occurrences`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `occurrences`";
              const report = decodeOccurrencesReport(
                await runJson(product, workspace, ["occurrences"], label),
                label,
              );
              assertSameJson(
                {
                  findings: report.findings,
                  occurrences: occurrenceIdentitySummaries(report.occurrences),
                },
                {
                  findings: [],
                  occurrences: [
                    {
                      file: A_ROOT,
                      kind: "depends",
                      source: ALPHA,
                      target: BETA,
                    },
                  ],
                },
                `${label}: the one staged occurrence, finding-free — no ` +
                  `condition-23 finding accompanies a refreshing read's ` +
                  `answer (SPEC 11.3, 13.3, 14.23)`,
              );
            },
          },
          {
            label: "`view`",
            run: async () => {
              const label = "T13.3-2 (corrupt record) `view`";
              const view = decodeViewFilesReport(
                await runJson(product, workspace, ["view"], label),
                label,
              );
              assertSameJson(
                view,
                { findings: [], files: [A_ROOT] },
                `${label}: the whole-domain request answers finding-free — ` +
                  `nothing is reported for the record (SPEC 11.4, 13.3, ` +
                  `14.23)`,
              );
            },
          },
          {
            label: "`at`",
            run: async () => {
              // Byte 30 lies inside "Alpha depends on beta." — within
              // alpha's construct (bytes 0..55), outside the d entry's
              // occurrence span ("beta" at bytes 18..24) (SPEC 11.5, 1.7).
              const label = "T13.3-2 (corrupt record) `at specs/A.mdx 30`";
              assertAtAnswer(
                decodeAtReport(
                  await runJson(
                    product,
                    workspace,
                    ["at", A_ROOT, "30"],
                    label,
                  ),
                  label,
                ),
                ALPHA,
                label,
              );
            },
          },
        ];

        for (const probe of recordProbes) {
          await probe.run();

          // The corrupt state persists — neither read, repaired, nor
          // replaced (SPEC 13.3): the record-consulting surface still
          // reports the record-supplied datum explicitly unavailable, with
          // the 14.23 outcome's exit 1 (the finding's full form is
          // T11.6-4's home).
          const invLabel = `T13.3-2 (corrupt record) \`inventory\` after ${probe.label}`;
          const invResult = await runCli(product, workspace, ["inventory"]);
          assertExitCode(
            invResult,
            1,
            `${invLabel} — an inventory answer carrying the condition-23 ` +
              `finding exits 1 (SPEC 14.23, 11.6, 12.0)`,
          );
          const recorded = decodeInventoryRecordedDatum(
            parseJsonStdout(invResult, invLabel),
            invLabel,
          );
          if (recorded.state !== "unavailable") {
            fail(
              `${invLabel}: the record-supplied datum must still be ` +
                `explicitly unavailable — a refreshing read leaves the ` +
                `corrupt record state neither read, repaired, nor ` +
                `replaced, and it is never read as an empty record (SPEC ` +
                `13.3, 14.23, 11.6); got state ` +
                JSON.stringify(recorded.state),
            );
          }

          // Outside the graph data, nothing changed: no TypeScript or
          // Markdown generated or removed, sources and durable files
          // untouched (SPEC 13.3, 13.4; graph-data bytes stay unpinned —
          // module header).
          const after = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            asSnapshot(corrupted, outsideGraph),
            asSnapshot(
              after,
              filteredEntries(after.entries, (key) => !isGraphDataKey(key)),
            ),
            `T13.3-2 (corrupt record) after ${probe.label} and its ` +
              `inventory probe: outside the graph data the workspace must ` +
              `be byte-identical — no TypeScript or Markdown generated or ` +
              `removed, journal, session, and source files untouched ` +
              `(SPEC 13.3, 13.4)`,
          );
        }

        // Until a successful `build` replaces the state (SPEC 13.3, 14.10,
        // 12.1): afterwards the record-supplied datum is the plain recorded
        // derived-file paths again, at exit 0 on the clean workspace.
        await buildOk(
          product,
          workspace,
          "T13.3-2 (corrupt record) `build` over the corrupt-record state " +
            "— a successful build replaces the record (SPEC 12.1, 13.4, " +
            "14.10)",
        );
        const recoveredLabel =
          "T13.3-2 (corrupt record) `inventory` after the rebuild";
        const recovered = decodeInventoryRecordedDatum(
          await runJson(product, workspace, ["inventory"], recoveredLabel),
          recoveredLabel,
        );
        if (recovered.state !== "value") {
          fail(
            `${recoveredLabel}: after a successful \`build\` replaces the ` +
              `corrupt record, the record-supplied datum is the plain ` +
              `recorded derived-file paths again — never unavailability, ` +
              `never null (SPEC 13.3, 14.23, 11.6, 12.7); got state ` +
              JSON.stringify(recovered.state),
          );
        }
        if (!recovered.value.includes("specs/A.xspec.ts")) {
          fail(
            `${recoveredLabel}: the recorded derived-file paths — the ` +
              `paths as last generated, companions included — must name ` +
              `the generated module specs/A.xspec.ts (SPEC 11.6, 13.1, ` +
              `13.3); got ${JSON.stringify(recovered.value)}`,
          );
        }
      },
    );
  },
});

/**
 * Assert a `check` findings report consists solely of 14.10 staleness
 * findings against one source's generated module and companions: every
 * finding carries condition 14.10 and a file under `<prefix>`, and the
 * module `<module>` itself is among the named files (SPEC 14.10, 13.1).
 * Once the findings are condition 10 alone and concern those files, every
 * finding instructs rebuilding (`assertFindingInstructsRebuilding`: its
 * message names `build`), the correction SPEC 14.10 requires of each
 * per-file finding. Neither caller's state holds a recorded file
 * obstructing a path the rebuild writes — the one condition-10 form whose
 * correction is its manual deletion instead (SPEC 14.10, 13.4, 14.22;
 * T13.4-10's judge): T13.3-2's edited-source arm reports A's module and
 * companions, which the rebuild regenerates, as mismatched; its
 * deleted-source arm reports B's recorded module and companions, at paths
 * the current sources no longer generate, as recorded orphans — none a
 * workspace-relative directory component of any path the rebuild writes.
 */
function assertStaleModuleFindings(
  findings: readonly Finding[],
  prefix: string,
  module: string,
  context: string,
): void {
  if (findings.length === 0) {
    fail(
      `${context}: expected at least one 14.10 staleness finding (SPEC ` +
        `14.10); got none`,
    );
  }
  for (const finding of findings) {
    if (finding.condition !== "14.10") {
      fail(
        `${context}: every finding here must be condition 14.10 — the only ` +
          `staged condition is the stale/orphaned generated output (SPEC ` +
          `14.10); got ${JSON.stringify(finding.condition)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
    if (typeof finding.path !== "string" || !finding.path.startsWith(prefix)) {
      fail(
        `${context}: a 14.10 finding must name the stale derived file as ` +
          `its concerned path, all of which are ${prefix}* here (SPEC ` +
          `14.10, 13.1, 12.7); got ${JSON.stringify(finding.path)} ` +
          `(message: ${JSON.stringify(finding.message)})`,
      );
    }
  }
  if (!findings.some((finding) => finding.path === module)) {
    fail(
      `${context}: the generated module ${module} must be among the named ` +
        `stale files (SPEC 14.10, 13.1); named: ` +
        JSON.stringify(findings.map((finding) => finding.path)),
    );
  }
  for (const finding of findings) {
    assertFindingInstructsRebuilding(
      finding,
      `${context} — the finding concerning ` +
        `${JSON.stringify(finding.path)}: no recorded file obstructs a ` +
        `rebuild write on this state, so every condition-10 finding, ` +
        `mismatched module or companion and recorded orphan alike, ` +
        `instructs rebuilding (SPEC 14.10)`,
    );
  }
}

// ---------------------------------------------------------------------------
// T13.3-3 — the gate
// ---------------------------------------------------------------------------

const T13_3_3_A = [
  '<S id="alpha">',
  "Alpha intro.",
  '<S id="alpha.one">',
  "Alpha-one text.",
  "</S>",
  "</S>",
  "",
  '<S id="gamma">',
  "Gamma text.",
  "</S>",
  "",
].join("\n");
const T13_3_3_B_VALID = ['<S id="beta">', "Beta text.", "</S>", ""].join("\n");
// A non-root section without `id` — build validation condition 14.1.
const T13_3_3_B_INVALID = ["<S>", "Beta text.", "</S>", ""].join("\n");
// The invalidating edit is staged after the body's `build`, so it is a ledger
// record (S-9's before-any-product clause; helpers/staged-mdx.ts) — the same
// constant, well-formed MDX (the missing id is validation condition 14.1).
const T13_3_3_B_ID_LESS = stagedMdx(
  "T13.3-3 specs/B.mdx with its section's id removed (14.1)",
  T13_3_3_B_INVALID,
);

// --- Whole-gate arm fixtures (SPEC 13.3; see the module header) ---

const JOURNAL_PATH = ".xspec/journal";
const LF = 0x0a;

// Deliberately structureless bytes no conforming entry format accepts — the
// TEST-SPEC-sanctioned malformed-journal staging (T6.1-3's shape, H-4).
const GATE_GARBAGE_LINE = "?? harness-injected garbage: not a journal entry ??";

// One reference occurrence (alpha's d entry to beta) keeps every never-gated
// answer contentful; the sources are otherwise finding-free, so the staged
// journal/write-path state is the workspace's only build-failing condition.
// Every whole-gate workspace — the two stagings and their stale twins — is
// created after the body's first invocations, so their `.mdx` sources are
// staged-source records (S-9's before-any-product clause;
// helpers/staged-mdx.ts): A is the record holding these bytes (T13.3-1's
// source).
const T13_3_3_GATE_A = ALPHA_ON_BETA_SOURCE;
// An unreferenced section for the legitimate journaled rename (line 1).
const T13_3_3_GATE_T = stagedMdx(
  "T13.3-3 specs/T.mdx (the garbage-journal workspace's unreferenced tmp section)",
  ['<S id="tmp">', "Tmp text.", "</S>", ""].join("\n"),
);

// The obstructed-write-path workspace: emission redirected under
// `markdown.outDir`, so a plain file at `mdout` obstructs the emit write
// path `mdout/specs/A.md` at its first component (SPEC 7.3, 13.2, 13.4).
// The workspace follows the body's first product invocation: a TypeScript
// staged-source record (S-9).
const T13_3_3_OUTDIR_CONFIG = stagedTs(
  "T13.3-3 obstructed-write-path workspace xspec.config.ts — emission under outDir mdout, the coverage profile p",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "mdout" },
  coverage: [
    {
      name: "p",
      target: "main",
      targets: "all",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
);

// The stale twins' edit (TEST-SPEC T13.3-3: a section's text edited,
// validly, after graph data was last written, no read run since): beta's
// text in `T13_3_3_GATE_A`'s bytes, alpha's construct (bytes 0..55) and its
// d entry byte-identical, so every never-gated answer
// `assertNeverGatedAnswers` asserts stands, while beta's source range and
// every hash over beta's text — beta's own, the root's subtree, alpha's
// effective hash through its edge to beta (SPEC 5.5, 1.7) — change, all of
// them graph data (13.3), so the graph data `build` would now write differs
// from what the twin holds. Staged after the twin's first product
// invocation: a staged-source record (S-9).
const T13_3_3_GATE_A_EDITED = stagedMdx(
  "T13.3-3 stale twins' specs/A.mdx — beta's text edited, validly, after graph data was last written",
  [
    '<S id="alpha" d={["beta"]}>',
    "Alpha depends on beta.",
    "</S>",
    "",
    '<S id="beta">',
    "Beta text, edited after graph data was last written.",
    "</S>",
    "",
  ].join("\n"),
);

// The write-path stale twin's configuration (TEST-SPEC T13.3-3: under
// `markdown: { emit: true, outDir: "out" }`, built, the directory `out`
// replaced by a plain file, a directory component of every emit
// destination — a write path other than graph data's own), beside the spec
// group and the coverage profile p that `coverage` reads. The twin follows
// the body's first product invocation: a TypeScript staged-source record
// (S-9).
const T13_3_3_OUT_CONFIG = stagedTs(
  "T13.3-3 write-path stale twin xspec.config.ts — emission under outDir out, the coverage profile p",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" },
  coverage: [
    {
      name: "p",
      target: "main",
      targets: "all",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
);

/** Lines in a line-oriented file, either final-line convention (T6.1-3). */
function journalLineCount(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let count = 0;
  for (const byte of bytes) {
    if (byte === LF) count += 1;
  }
  if (bytes[bytes.length - 1] !== LF) count += 1;
  return count;
}

/**
 * Does a text name the garbage line (line 2)? T6.1-3's H-4
 * operationalization: the text echoing the garbage line's text, citing
 * line/entry 2, or spelling `journal:2`. The journal whole-gate arms (the
 * plain staging and its stale twin) apply it to two texts: each gated
 * read's 14.13 finding's JSON message (`assertJournalGateFinding`) — a
 * journal condition carries the journal path it concerns and no in-source
 * location (SPEC 14, 12.7), the arms asserting both, so the line is named
 * in the message alone — and that read's human report
 * (`assertHumanNamesGarbageLine`), which carries the same information
 * (T12.0-1; SPEC 12.0; the module header's T13.3-3 human-form note).
 */
function namesGarbageLine(text: string): boolean {
  if (text.includes(GATE_GARBAGE_LINE)) return true;
  if (/\b(?:line|entry)\s*#?\s*2\b/i.test(text)) return true;
  return text.includes("journal:2");
}

/**
 * A gated invocation's human form, run after its `--json` run's own
 * assertions, at that run's state and inside the caller's modifies-nothing
 * compare — T12.0-1's information parity (SPEC 12.0: the JSON form carries
 * the same information as the human report; the module header's T13.3-3
 * human-form note): the same argv without `--json` exits 1 as well, the
 * gate reporting the findings a `build` would report without answering
 * (SPEC 13.3), and its report mentions what the decoded findings carry —
 * the shared human-findings check (`assertHumanFindingsMentions`,
 * human-findings.ts): every location's file, every concerned path, and
 * every identity (an identity-or-path boundary); then, in a separate call,
 * every stable code (`codeMention`, matched with those data blanked out);
 * then every location's start and end (whole numbers, SPEC 1.7, matched
 * with the digit-holding data among those blanked out) — a message never
 * blanked and never compared (H-3). `verifyHuman`, where given, asks the
 * report more (the garbage-journal stagings: the line named, as its JSON
 * message names it). A `query` probe takes no human run: `query` is a
 * JSON-only surface (SPEC 11, 12.0), its bare form being the very document
 * the probe decodes. Robust matching (H-3): presence, never wording, and no
 * mention associated with another.
 */
async function assertHumanGateReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  findings: readonly Finding[],
  context: string,
  verifyHuman?: (human: RunResult, context: string) => void,
): Promise<void> {
  if (argv[0] === "query") return;
  const humanArgv = argv.filter((token) => token !== "--json");
  const label = `${context} — its human form \`${humanArgv.join(" ")}\``;
  const human = await expectExit(
    product,
    workspace,
    humanArgv,
    1,
    `${label} — the same exit code as the \`--json\` run at this state: 1, ` +
      `the gate reporting the findings a \`build\` would report without ` +
      `answering (SPEC 13.3, 12.0)`,
  );
  assertHumanFindingsMentions(human, findings, label);
  verifyHuman?.(human, label);
}

/**
 * The gated reads' whole-gate invocations (SPEC 13.3; `review` represented
 * by `status`, the read subcommand — the mutating subcommands are the
 * invalid-sources workspace's subject and the write-path stale twin's,
 * `runObstructedWritePathGate`): the five reads taking no baseline, plus
 * `impact --base <impactBase>` when a baseline is supplied — the
 * obstructed-write stagings alone, against a commit taken before the
 * obstruction was staged; the journal-error stagings supply none, `impact`
 * being absent from them by necessity (TEST-SPEC T13.3-3; module header).
 * Each is a `--json` run but `query nodes` (a JSON-only surface, SPEC 11),
 * so `probeWholeGate` runs each other's human form as the same argv
 * without `--json`.
 */
function gatedReadInvocations(
  alpha: string,
  impactBase?: string,
): readonly { readonly argv: readonly string[]; readonly what: string }[] {
  const impact =
    impactBase === undefined
      ? []
      : [
          {
            argv: ["impact", "--base", impactBase, "--json"],
            what: "`impact --base <ref> --json`",
          },
        ];
  return [
    { argv: ["ids", "--json"], what: "`ids --json`" },
    { argv: ["show", alpha, "--json"], what: `\`show ${alpha} --json\`` },
    { argv: ["coverage", "--json"], what: "`coverage --json`" },
    ...impact,
    {
      argv: ["review", "status", "s", "--json"],
      what: "`review status s --json`",
    },
    { argv: ["query", "nodes"], what: "`query nodes`" },
  ];
}

/** {@link probeWholeGate}'s options. */
interface WholeGateProbeOptions {
  /**
   * Asks the human report more — the garbage-journal stagings: the line
   * named, as the JSON message names it (`assertHumanNamesGarbageLine`).
   */
  readonly verifyHuman?: (human: RunResult, context: string) => void;
  /**
   * Why the run leaves graph data as it is beyond the gate's own rule,
   * appended to the modifies-nothing compare's context: a stale twin's
   * clause (`STALE_TWIN_UNCHANGED`, `STALE_TWIN_MUTATING_UNCHANGED`).
   */
  readonly unchangedWhy?: string;
}

/**
 * One whole-gate probe (SPEC 13.3): the gated invocation — a gated read, or
 * on the write-path stale twin a mutating `review` subcommand, gated past
 * its acquisition (13.5, 10.7) — reports exactly the staged gate finding,
 * exits 1, answers nothing (stdout is the findings report, the findings a
 * `build` would now report — the module's T13.3-3 operationalization), and
 * its human form — the same argv without `--json`, run after those
 * assertions at the same state (`assertHumanGateReport`; none for `query`,
 * a JSON-only surface) — exits 1 as well and mentions what the decoded
 * findings carry, `options.verifyHuman` asking it more where given; and the
 * two runs modify nothing: journal, sessions, derived files, graph data,
 * and `.git/` byte-identical around them (no session created, none
 * rewritten; `options.unchangedWhy` the stale twins' clause).
 */
async function probeWholeGate(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  counts: Readonly<Record<string, number>>,
  verifyFinding: (finding: Finding, context: string) => void,
  context: string,
  options: WholeGateProbeOptions = {},
): Promise<void> {
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runCli(product, workspace, argv);
      assertExitCode(
        result,
        1,
        `${context} — the gate is over every finding a \`build\` would ` +
          `report, source validity or not: the gated command reports it ` +
          `and exits 1 without answering (SPEC 13.3, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, context),
        context,
      ).findings;
      assertConditionCounts(
        findings,
        counts,
        `${context} — exactly the staged gate finding is reported, the ` +
          `findings a \`build\` would now report (SPEC 13.3, 14)`,
      );
      verifyFinding(findings[0] as Finding, context);
      await assertHumanGateReport(
        product,
        workspace,
        argv,
        findings,
        context,
        options.verifyHuman,
      );
    },
    `${context} — journal, sessions, derived files, and graph data must be ` +
      `byte-identical around the gated command and its human form (SPEC ` +
      `13.3)` +
      (options.unchangedWhy === undefined ? "" : `; ${options.unchangedWhy}`),
  );
}

/**
 * The never-gated contrast (SPEC 13.3, 11.2, 11.6) on a whole-gate
 * workspace staged with `T13_3_3_GATE_A` as its one occurrence-bearing spec
 * source — or, on a stale twin, with `T13_3_3_GATE_A_EDITED`, whose alpha
 * construct and d entry are byte-identical, so the same answers hold:
 * `occurrences`, `view`, and `at` answer per file — complete and
 * finding-free at exit 0, the gate condition being no domain file's finding
 * — and `inventory` answers whatever the sources' validity, none of them
 * modifying anything (whole-root byte compare per probe, `unchangedWhy`,
 * where given, appended to each compare's context: the stale twins'
 * clause).
 */
async function assertNeverGatedAnswers(
  product: ProductBinding,
  workspace: TestWorkspace,
  viewFiles: readonly string[],
  context: string,
  unchangedWhy?: string,
): Promise<void> {
  const A_ROOT = "specs/A.mdx";
  const ALPHA = "specs/A.mdx#alpha";
  const BETA = "specs/A.mdx#beta";
  const why = unchangedWhy === undefined ? "" : `; ${unchangedWhy}`;

  const occurrencesLabel = `${context} \`occurrences\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const report = decodeOccurrencesReport(
        await runJson(product, workspace, ["occurrences"], occurrencesLabel),
        occurrencesLabel,
      );
      assertSameJson(
        {
          findings: report.findings,
          occurrences: occurrenceIdentitySummaries(report.occurrences),
        },
        {
          findings: [],
          occurrences: [
            { file: A_ROOT, kind: "depends", source: ALPHA, target: BETA },
          ],
        },
        `${occurrencesLabel}: the staged occurrence, finding-free at exit 0 ` +
          `— the gate condition is no domain file's finding, so it ` +
          `accompanies no answer of this surface (SPEC 11.2, 11.3, 13.3)`,
      );
    },
    `${occurrencesLabel} answers from the current sources and modifies ` +
      `nothing — no graph data, no derived files (SPEC 11.2, 13.3)${why}`,
  );

  const viewLabel = `${context} \`view\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const view = decodeViewFilesReport(
        await runJson(product, workspace, ["view"], viewLabel),
        viewLabel,
      );
      assertSameJson(
        view,
        { findings: [], files: viewFiles },
        `${viewLabel}: the whole-domain request answers every discovered ` +
          `spec source, finding-free at exit 0, whatever journal or ` +
          `write-path state the workspace holds (SPEC 11.2, 11.4, 13.3)`,
      );
    },
    `${viewLabel} answers from the current sources and modifies nothing ` +
      `(SPEC 11.2, 13.3)${why}`,
  );

  // Byte 30 lies inside "Alpha depends on beta." — within alpha's construct
  // (bytes 0..55), outside the d entry's occurrence span ("beta" at bytes
  // 18..24) (SPEC 11.5, 1.7).
  const atLabel = `${context} \`at specs/A.mdx 30\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      assertAtAnswer(
        decodeAtReport(
          await runJson(product, workspace, ["at", A_ROOT, "30"], atLabel),
          atLabel,
        ),
        ALPHA,
        atLabel,
      );
    },
    `${atLabel} answers from the current sources and modifies nothing ` +
      `(SPEC 11.2, 11.5, 13.3)${why}`,
  );

  const inventoryLabel = `${context} \`inventory\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const recorded = decodeInventoryRecordedDatum(
        await runJson(product, workspace, ["inventory"], inventoryLabel),
        inventoryLabel,
      );
      if (recorded.state !== "value") {
        fail(
          `${inventoryLabel}: the inventory parses no sources and reads no ` +
            `journal content — it answers whatever the workspace's gate ` +
            `state, and with the record intact the record-supplied datum ` +
            `is the plain recorded derived-file paths (SPEC 11.6, 13.3, ` +
            `14.23); got state ${JSON.stringify(recorded.state)}`,
        );
      }
      if (!recorded.value.includes("specs/A.xspec.ts")) {
        fail(
          `${inventoryLabel}: the recorded derived-file paths must name ` +
            `the generated module specs/A.xspec.ts (SPEC 11.6, 13.1); got ` +
            JSON.stringify(recorded.value),
        );
      }
    },
    `${inventoryLabel} neither refreshes nor writes anything (SPEC ` +
      `11.6)${why}`,
  );
}

/**
 * The garbage-journal stagings' 14.13 finding, form-exact as T6.1-3 asserts
 * it (TEST-SPEC T13.3-3, T6.1-3; SPEC 12.7, 14, 14.13): `code`
 * `"journal-error"`, `path` exactly `".xspec/journal"` — the concerned path
 * is the journal path — and `locations` `[]`, a journal condition having no
 * in-source location, so a product reporting the bad line as a location in
 * `.xspec/journal` with `path` `null` fails; and its message names the
 * garbage line (`namesGarbageLine`), the line named in the message alone.
 */
function assertJournalGateFinding(finding: Finding, context: string): void {
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    { code: "journal-error", path: JOURNAL_PATH, locations: [] },
    `${context} — the journal error's finding, form-exact (TEST-SPEC ` +
      `T13.3-3, T6.1-3): code "journal-error", the journal path ` +
      `".xspec/journal" as its concerned path, and empty locations — a ` +
      `journal condition has no in-source location, so the line is named, ` +
      `never located (SPEC 12.7, 14, 14.13); its message: ` +
      JSON.stringify(finding.message),
  );
  if (!namesGarbageLine(finding.message)) {
    fail(
      `${context}: the 14.13 finding's message must name the malformed ` +
        `line — the garbage on line 2 (SPEC 14.13 "naming the lines"): the ` +
        `garbage line's text or a line/entry-2 citation; a journal ` +
        `condition has no in-source location, so the line is named in the ` +
        `message alone (SPEC 14, 12.7); got ${JSON.stringify(finding)}`,
    );
  }
}

/**
 * The garbage-journal stagings' human check (`WholeGateProbeOptions`'
 * `verifyHuman`): the human report names the malformed line as the 14.13
 * finding's JSON message does, anywhere in the report (robust matching,
 * H-3; the module header's T13.3-3 human-form note).
 */
function assertHumanNamesGarbageLine(human: RunResult, context: string): void {
  if (!namesGarbageLine(human.stdout)) {
    fail(
      `${context}: the human report must name the malformed line as the ` +
        `14.13 finding's JSON message does — the garbage on line 2 (SPEC ` +
        `14.13 "naming the lines"; 12.0: the JSON form carries the same ` +
        `information as the human report): the garbage line's text or a ` +
        `line/entry-2 citation, anywhere in the report (robust matching, ` +
        `H-3); got stdout of ${human.commandLine}: ` +
        `${JSON.stringify(human.stdout.slice(0, 2048))}` +
        (human.stdout.length > 2048
          ? `… (${String(human.stdout.length)} chars total)`
          : ""),
    );
  }
}

/**
 * The stale twins' clause on each read's and each never-gated probe's
 * modifies-nothing compare (TEST-SPEC T13.3-3; the module header).
 */
const STALE_TWIN_UNCHANGED =
  "on this stale twin graph data is stale — a section's text was edited, " +
  "validly, after graph data was last written, no read run since, so a " +
  "refresh would rewrite it — yet on a workspace failing `build`'s " +
  "validations, journal errors and refused writes alike, nothing is " +
  "modified, T13.3-2's operational path set byte-identical with the rest " +
  "and the stale graph data unrefreshed, failing a product that decides " +
  "whether to refresh by source validity alone (SPEC 13.3, 11.2)";

/**
 * The write-path stale twin's clause on its mutating `review` subcommands'
 * compares (TEST-SPEC T13.3-3; the module header).
 */
const STALE_TWIN_MUTATING_UNCHANGED =
  "on this stale twin the mutating `review` subcommands meet the " +
  "refused-write gate past their acquisition (SPEC 13.5, 10.7), its " +
  "report ending the subcommand: no session created, the existing " +
  "session, journal, derived files, and graph data byte-identical, the " +
  "stale graph data unrefreshed — failing a product whose mutating " +
  "subcommands gate on source validity alone and write the session (SPEC " +
  "13.3, 10.7)";

/**
 * Stage a whole-gate workspace's stale twin (TEST-SPEC T13.3-3; the module
 * header): beta's text in `specs/A.mdx` edited, validly
 * (`T13_3_3_GATE_A_EDITED`), after graph data was last written and before
 * any read — the caller runs none from its staging's last product
 * invocation on — and return the graph data the twin's probes face
 * (T13.3-2's operational path set, a view of the snapshot taken after the
 * edit) for {@link assertStaleTwinPremise}.
 */
async function stageStaleTwinEdit(
  workspace: TestWorkspace,
  context: string,
): Promise<DirectorySnapshot> {
  await workspace.file("specs/A.mdx", T13_3_3_GATE_A_EDITED);
  const staged = await snapshotDirectory(workspace.root);
  assertGraphDataPresent(
    staged,
    `${context}: staging premise — the twin's \`build\` wrote graph data, ` +
      `which the edit leaves stale`,
  );
  return asSnapshot(staged, graphDataEntries(staged));
}

/**
 * A stale twin's premise, checked once its probes have run and its caller
 * has lifted the gate condition (TEST-SPEC T13.3-3: graph data being
 * current on the plain stagings, a refresh there would rewrite nothing, so
 * the twin is staged stale; the module header): the workspace now passes
 * `build`'s validations, so a refreshing read — `ids --json`, exit 0 —
 * refreshes the stale graph data, writing what `build` would write (SPEC
 * 13.3), and graph data must then differ from `staleGraph`, the state every
 * probe faced and left byte-identical; else the staged edit made nothing
 * stale and the twin discriminated nothing (H-11: failing loud, never
 * hollowing the arm out). Graph data stays opaque (H-4): only whether the
 * product's own refresh changed it is asked.
 */
async function assertStaleTwinPremise(
  product: ProductBinding,
  workspace: TestWorkspace,
  staleGraph: DirectorySnapshot,
  context: string,
): Promise<void> {
  const label = `${context} premise \`ids --json\``;
  decodeIdsReport(
    await runJson(product, workspace, ["ids", "--json"], label),
    label,
  );
  const after = await snapshotDirectory(workspace.root);
  const changes = diffSnapshots(
    staleGraph,
    asSnapshot(after, graphDataEntries(after)),
  );
  if (changes.length === 0) {
    fail(
      `${label}: the stale twin's staging premise — with the gate ` +
        `condition lifted the workspace passes \`build\`'s validations, so ` +
        `a refreshing read rewrites stale graph data as \`build\` would ` +
        `write it (SPEC 13.3), and the staged edit changed beta's text, its ` +
        `range, and every hash over it, all graph data (SPEC 13.3, 5.5, ` +
        `1.7) — yet graph data after the read is byte-identical to the ` +
        `state the twin's probes faced: either the read answered without ` +
        `refreshing (SPEC 13.3: read results never come from stale data) ` +
        `or the staging was never stale, and the twin's probes ` +
        `discriminated nothing`,
    );
  }
}

/**
 * Whole-gate arm 1, the garbage journal line (14.13; the module header):
 * T11.2-6's garbage-journal fixture on a fresh workspace (H-1) — and, with
 * `stale`, its stale twin (TEST-SPEC T13.3-3; `stageStaleTwinEdit`). After
 * a `build`, a journaled `rename` (line 1), and an `audit` session `s`
 * created while the workspace was valid, the garbage is appended as line
 * 2; the five reads taking no baseline each report exactly the form-exact
 * journal error (`assertJournalGateFinding`), their human forms naming the
 * line, and modify nothing — `impact` is absent by necessity (a given
 * baseline's resolution reads the current journal first, and a journal
 * error there fails it, exit 2 with `journal-error`, T6.3-6), so no git
 * repository is staged: no baseline to resolve, the gate alone standing
 * between each invocation and an answer — then the never-gated contrast;
 * on the twin, its premise last, the journal back to its legitimate line.
 * Discriminates a product that gates on source validity alone and answers
 * `query` from a broken journal with exit 0 (refresh consumes the journal
 * for canonical identities, SPEC 5.4) — and, on the twin, one deciding
 * whether to refresh by source validity alone.
 */
async function runGarbageJournalGate(
  product: ProductBinding,
  stale: boolean,
): Promise<void> {
  await withWorkspace(
    {
      "xspec.config.ts": GRAPH_CONFIG,
      "specs/A.mdx": T13_3_3_GATE_A,
      "specs/T.mdx": T13_3_3_GATE_T,
    },
    async (workspace) => {
      const context = stale
        ? "T13.3-3 (garbage journal, stale twin)"
        : "T13.3-3 (garbage journal)";
      const ALPHA = "specs/A.mdx#alpha";

      await buildOk(product, workspace, `${context} staging \`build\``);
      // Journal line 1: one legitimate journaled operation — the rename of
      // the unreferenced tmp section — so the garbage lands on line 2
      // ("naming the line" has teeth, T6.1-3) and the journal really
      // participates in canonical identities (SPEC 6.1, 6.4, 5.4).
      await expectExit(
        product,
        workspace,
        ["rename", "specs/T.mdx", "tmp", "tmp2"],
        0,
        `${context} staging \`rename specs/T.mdx tmp tmp2\` — the ` +
          `legitimate journal entry (SPEC 6.4, 6.1)`,
      );
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        `${context} staging \`review create --strategy audit --name s\` ` +
          `(SPEC 10.7)`,
      );

      // Append the garbage as its own line 2 (whole-line append under
      // either final-line convention; shape-independent, H-4).
      const journalKind = await workspace.kind(JOURNAL_PATH);
      if (journalKind !== "file") {
        fail(
          `${context}: staging premise — the journaled rename brings the ` +
            `journal into existence as a plain file at ${JOURNAL_PATH} ` +
            `(SPEC 6.1, 13.4); found ${journalKind}`,
        );
      }
      const legitimate = await workspace.readBytes(JOURNAL_PATH);
      if (journalLineCount(legitimate) !== 1) {
        fail(
          `${context}: staging premise — one journaled operation yields a ` +
            `one-line journal (SPEC 6.1), so the garbage lands on line 2; ` +
            `found ${String(journalLineCount(legitimate))} line(s)`,
        );
      }
      const needsTerminator =
        legitimate.length > 0 && legitimate[legitimate.length - 1] !== LF;
      await workspace.file(
        JOURNAL_PATH,
        Buffer.concat([
          legitimate,
          Buffer.from(
            (needsTerminator ? "\n" : "") + GATE_GARBAGE_LINE + "\n",
            "utf8",
          ),
        ]),
      );

      // The stale twin: beta's text edited after graph data was last
      // written, no read run since (TEST-SPEC T13.3-3).
      const staleGraph = stale
        ? await stageStaleTwinEdit(workspace, context)
        : undefined;
      const unchangedWhy = stale ? STALE_TWIN_UNCHANGED : undefined;

      // Each gated read's one 14.13 finding, form-exact, the line named in
      // its message — and in its human form, as the JSON message must
      // (the same predicate, `namesGarbageLine`; the module header's
      // T13.3-3 human-form note).
      for (const probe of gatedReadInvocations(ALPHA)) {
        await probeWholeGate(
          product,
          workspace,
          probe.argv,
          { "14.13": 1 },
          assertJournalGateFinding,
          `${context} ${probe.what}`,
          { verifyHuman: assertHumanNamesGarbageLine, unchangedWhy },
        );
      }

      // Never-gated contrast on the same workspace (SPEC 11.2, 11.6).
      await assertNeverGatedAnswers(
        product,
        workspace,
        ["specs/A.mdx", "specs/T.mdx"],
        context,
        unchangedWhy,
      );

      if (staleGraph !== undefined) {
        // The twin's premise: the journal back to its legitimate line, the
        // gate condition lifted.
        await workspace.file(JOURNAL_PATH, legitimate);
        await assertStaleTwinPremise(
          product,
          workspace,
          staleGraph,
          `${context} (the garbage line removed)`,
        );
      }
    },
  );
}

/** One obstructed-write-path staging of T13.3-3's whole gate. */
interface WritePathGateStaging {
  /** The diagnosis context. */
  readonly context: string;
  /** The configuration record: emission on under `markdown.outDir`. */
  readonly config: StagedTs;
  /**
   * The configured `markdown.outDir`, the directory a plain file replaces —
   * the one offending component, the 14.22 finding's concerned path.
   */
  readonly outDir: string;
  /**
   * The stale twin (TEST-SPEC T13.3-3): beta's text edited before the
   * obstruction (`stageStaleTwinEdit`), and the mutating `review`
   * subcommands driven past their acquisition.
   */
  readonly stale: boolean;
}

/** Whole-gate arm 2's plain staging (T11.2-6's obstructed-write fixture). */
const WRITE_PATH_GATE: WritePathGateStaging = {
  context: "T13.3-3 (obstructed write path)",
  config: T13_3_3_OUTDIR_CONFIG,
  outDir: "mdout",
  stale: false,
};

/**
 * Its stale twin (TEST-SPEC T13.3-3: under `markdown: { emit: true,
 * outDir: "out" }`, the directory `out` replaced by a plain file).
 */
const WRITE_PATH_GATE_STALE_TWIN: WritePathGateStaging = {
  context: "T13.3-3 (obstructed write path, stale twin)",
  config: T13_3_3_OUT_CONFIG,
  outDir: "out",
  stale: true,
};

/**
 * Whole-gate arm 2, the obstructed write path (14.22; the module header):
 * after a successful build with emission on under `markdown.outDir` and an
 * `audit` session `s`, the outDir directory is replaced by a plain file —
 * the emit write path `<outDir>/specs/A.md` then has its workspace-relative
 * component `<outDir>` occupied by a non-directory, the one offending
 * component, so `build` would report exactly the one condition-22 finding
 * (SPEC 13.4, 14.22). This staging alone drives `impact --base` beside the
 * five other reads, against the commit taken before the obstruction was
 * staged (TEST-SPEC T13.3-3), each reporting exactly that finding and
 * modifying nothing; then the never-gated contrast. The stale twin
 * (`staging.stale`) edits beta's text before the obstruction
 * (`stageStaleTwinEdit`) and drives, after the reads, the three mutating
 * `review` subcommands past their acquisition (SPEC 13.5, 10.7): `create
 * --strategy audit` under a new name, `resolve` naming alpha's item (an
 * unblocked leaf, 10.6), and `split` naming A's root item (its scope root
 * has children, 10.7) — their item ids read through `review status` before
 * the edit, while graph data was current — each reporting exactly the
 * condition-22 finding concerning `out`, no session created and nothing
 * written (T6.4-6 stages `rename` and `move` on the same obstruction); its
 * premise last, the plain file removed.
 */
async function runObstructedWritePathGate(
  product: ProductBinding,
  staging: WritePathGateStaging,
): Promise<void> {
  await withWorkspace(
    { "xspec.config.ts": staging.config, "specs/A.mdx": T13_3_3_GATE_A },
    async (workspace) => {
      const { context, outDir } = staging;
      const A_ROOT = "specs/A.mdx";
      const ALPHA = "specs/A.mdx#alpha";

      await workspace.gitInit();
      // The commit taken before the obstruction is staged — `impact
      // --base`'s baseline: pristine valid sources and configuration at the
      // ref, the journal absent on both sides (an empty journal is a prefix
      // of every journal), so the baseline resolves and 14.22 is the
      // operative gate finding (SPEC 6.3, 12.0).
      const base = await workspace.gitCommitAll(
        "baseline (valid sources, before the obstruction)",
      );
      await buildOk(
        product,
        workspace,
        `${context} staging \`build\` — emits under markdown.outDir (SPEC ` +
          `7.3, 13.2, 12.1)`,
      );
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        `${context} staging \`review create --strategy audit --name s\` ` +
          `(SPEC 10.7)`,
      );

      // Staging premises: emission landed under the outDir preserving
      // workspace-relative paths (SPEC 7.3, 13.2), so the outDir is a
      // component of a path `build` writes.
      const outDirKind = await workspace.kind(outDir);
      if (outDirKind !== "dir") {
        fail(
          `${context}: staging premise — \`build\` with emission enabled ` +
            `under markdown.outDir creates the ${outDir}/ directory (SPEC ` +
            `7.3, 13.2, 13.4); found ${outDirKind}`,
        );
      }
      const emittedKind = await workspace.kind(`${outDir}/specs/A.md`);
      if (emittedKind !== "file") {
        fail(
          `${context}: staging premise — emission under outDir preserves ` +
            `workspace-relative paths, so specs/A.mdx emits ` +
            `${outDir}/specs/A.md (SPEC 7.3, 13.2); found ${emittedKind}`,
        );
      }

      // The stale twin's items for its mutating subcommands, read while
      // graph data is current — before the edit, so no read runs after it:
      // alpha's leaf item, unblocked (SPEC 10.6), for `resolve`, and A's
      // root item, its scope root holding alpha and beta (10.7), for
      // `split`.
      let items: { readonly leaf: string; readonly root: string } | undefined;
      if (staging.stale) {
        const status = await sessionStatus(
          product,
          workspace,
          "s",
          `${context} staging`,
        );
        const leaf = requireRowByScope(
          status,
          ALPHA,
          `${context} staging item lookup`,
        );
        const root = requireRowByScope(
          status,
          A_ROOT,
          `${context} staging item lookup`,
        );
        if (leaf.kind !== "subtree-coherence" || leaf.blocked) {
          fail(
            `${context}: staging premise — alpha's audit item is an ` +
              `unblocked subtree-coherence item (a leaf's, SPEC 10.6), so ` +
              `\`resolve\` names an item it would otherwise resolve (SPEC ` +
              `10.7); got ${JSON.stringify(leaf)}`,
          );
        }
        if (root.kind !== "subtree-coherence") {
          fail(
            `${context}: staging premise — A's root audit item is a ` +
              `subtree-coherence item whose scope root has children (SPEC ` +
              `10.6), so \`split\` names an item it would otherwise ` +
              `decompose (SPEC 10.7); got ${JSON.stringify(root)}`,
          );
        }
        items = { leaf: leaf.id, root: root.id };
      }
      const staleGraph = staging.stale
        ? await stageStaleTwinEdit(workspace, context)
        : undefined;
      const unchangedWhy = staging.stale ? STALE_TWIN_UNCHANGED : undefined;

      // Obstruct: replace the directory with a plain file (the emitted
      // Markdown goes with it — staleness is invisible here: 14.10 is
      // `check`-only, and `build` would refuse at the obstruction).
      await fsp.rm(workspace.path(outDir), { recursive: true, force: true });
      await workspace.file(outDir, "not a directory\n");

      const concernsOutDir = (finding: Finding, findingContext: string) => {
        assertFindingConcernsPath(
          finding,
          outDir,
          `${findingContext} — the refused write's concerned path is the ` +
            `offending component's workspace-relative path (SPEC 14.22, ` +
            `13.4)`,
        );
      };
      for (const probe of gatedReadInvocations(ALPHA, base)) {
        await probeWholeGate(
          product,
          workspace,
          probe.argv,
          { "14.22": 1 },
          concernsOutDir,
          `${context} ${probe.what}`,
          { unchangedWhy },
        );
      }

      // Never-gated contrast on the same workspace (SPEC 11.2, 11.6).
      await assertNeverGatedAnswers(
        product,
        workspace,
        [A_ROOT],
        context,
        unchangedWhy,
      );

      if (items !== undefined) {
        // The mutating `review` subcommands meet the refused-write gate
        // alike, past their acquisition (SPEC 13.5, 10.7; TEST-SPEC
        // T13.3-3), each inside one whole-root compare with its human form.
        const mutating = [
          {
            argv: [
              "review",
              "create",
              "--strategy",
              "audit",
              "--name",
              "n",
              "--json",
            ],
            what:
              "`review create --strategy audit --name n --json` (a new " +
              "name: no session created)",
          },
          {
            argv: [
              "review",
              "resolve",
              "s",
              items.leaf,
              "--status",
              "no-change",
              "--json",
            ],
            what:
              "`review resolve s <alpha's unblocked item> --status " +
              "no-change --json` (no status recorded)",
          },
          {
            argv: ["review", "split", "s", items.root, "--json"],
            what:
              "`review split s <A's root item, its scope root with " +
              "children> --json` (no decomposition)",
          },
        ];
        for (const run of mutating) {
          await probeWholeGate(
            product,
            workspace,
            run.argv,
            { "14.22": 1 },
            concernsOutDir,
            `${context} ${run.what}`,
            { unchangedWhy: STALE_TWIN_MUTATING_UNCHANGED },
          );
        }
      }

      if (staleGraph !== undefined) {
        // The twin's premise: the plain file removed — a nonexistent
        // component obstructs nothing (SPEC 13.4) — the gate condition
        // lifted.
        await fsp.rm(workspace.path(outDir));
        await assertStaleTwinPremise(
          product,
          workspace,
          staleGraph,
          `${context} (the plain file ${outDir} removed)`,
        );
      }
    },
  );
}

const T13_3_3 = defineProductTest({
  id: "T13.3-3",
  title:
    "with invalid sources, each read command and each mutating review subcommand (create under --base/--strategy audit/--coverage, resolve, split) reports the validation errors, exits 1, answers nothing, and modifies nothing — no session created, and session file, journal, derived files, and graph data byte-identical; the gate is over every finding a `build` would report: with a garbage journal line staged, ids, show, coverage, review status, and query each report exactly the journal error (14.13) naming the line, form-exact — code `journal-error`, path `.xspec/journal`, locations [] — `impact` absent from that staging by necessity, a given baseline's resolution, which precedes the gate, meeting the journal error first as a usage error (exit 2, `journal-error`, T6.3-6) — and with an obstructed write path staged, the same five and `impact --base` against a commit taken before the obstruction (its baseline resolving) each report exactly the refused write (14.22) naming its offending component — exit 1, answer nothing, and modify nothing, while on the same workspaces occurrences, view, and at answer per file finding-free at exit 0 and inventory answers, none of them modifying anything; each staging's stale twin — a section's text edited, validly, after graph data was last written, no read run since, the write-path twin's obstruction the directory `out`, its emission outDir, replaced by a plain file — gives each of those outcomes alike, graph data byte-identical around every read though a refresh would rewrite it, and on the write-path twin review create --strategy audit under a new name, review resolve naming an unblocked item, and review split naming an item whose scope root has children each exit 1 past their acquisition reporting exactly the condition-22 finding concerning `out` — no session created, the existing session, journal, derived files, and graph data byte-identical, the stale graph data unrefreshed; and at each gated `--json` run's state but `query`'s (a JSON-only surface) the human form — the same argv without `--json`, a mutating review subcommand's inside the same modifies-nothing compare — exits 1 alike and carries every finding's stable code, its location — its file and its range's start and end — its concerned path, and its identities, and in the garbage-journal stagings names the line as the JSON message does (robust matching, H-3) (SPEC 13.3, 10.7, 11.2, 11.6, 12.0, 13.5, 14, 1.7)",
  run: async (product) => {
    await withWorkspace(
      {
        "xspec.config.ts": GRAPH_CONFIG,
        "specs/A.mdx": T13_3_3_A,
        "specs/B.mdx": T13_3_3_B_VALID,
      },
      async (workspace) => {
        const ALPHA = "specs/A.mdx#alpha";
        const ALPHA_ONE = "specs/A.mdx#alpha.one";
        const GAMMA = "specs/A.mdx#gamma";

        // --- Staging while the sources are valid: a resolvable commit, a
        // build, and a session holding a resolved leaf so that `alpha`'s
        // subtree-coherence item is unblocked (its scope root has a child,
        // so `split` would apply) and `gamma`'s leaf item is unblocked and
        // unresolved (so `resolve` would apply).
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("valid baseline");
        await buildOk(product, workspace, "T13.3-3 staging `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "s"],
          0,
          "T13.3-3 staging `review create --strategy audit --name s`",
        );
        const initial = await sessionStatus(
          product,
          workspace,
          "s",
          "T13.3-3 staging",
        );
        const alphaOneItem = requireRowByScope(
          initial,
          ALPHA_ONE,
          "T13.3-3 staging item lookup",
        ).id;
        await resolveNoChange(product, workspace, "s", alphaOneItem, "T13.3-3");
        const staged = await sessionStatus(
          product,
          workspace,
          "s",
          "T13.3-3 staging (after resolving the alpha.one leaf)",
        );
        const alphaRow = requireRowByScope(
          staged,
          ALPHA,
          "T13.3-3 staging item lookup",
        );
        const gammaRow = requireRowByScope(
          staged,
          GAMMA,
          "T13.3-3 staging item lookup",
        );
        if (alphaRow.kind !== "subtree-coherence" || alphaRow.blocked) {
          fail(
            "T13.3-3 staging premise: alpha's item must be an unblocked " +
              "subtree-coherence item whose scope root has a child (its " +
              "alpha.one blocker is resolved, SPEC 10.6, 10.3), so `split` " +
              "names an item it would otherwise decompose (SPEC 10.7); got " +
              JSON.stringify(alphaRow),
          );
        }
        if (gammaRow.status !== "unresolved" || gammaRow.blocked) {
          fail(
            "T13.3-3 staging premise: gamma's leaf item must be unblocked " +
              "and unresolved (SPEC 10.6), so `resolve` names an item it " +
              "would otherwise resolve (SPEC 10.7); got " +
              JSON.stringify(gammaRow),
          );
        }

        // --- The invalidating edit: B.mdx now fails build validation with
        // exactly one condition (14.1, missing id). The baseline commit
        // predates it, so baseline resolution succeeds and the gate's
        // report is the operative outcome (SPEC 12.0, 6.3, 13.3).
        await workspace.file("specs/B.mdx", T13_3_3_B_ID_LESS);

        /**
         * Run one probe: exit 1, stdout is the findings report carrying
         * exactly the staged validation error (naming specs/B.mdx); then,
         * at the same state, its human form — the same argv without
         * `--json` (`assertHumanGateReport`; none for `query`, a JSON-only
         * surface) — exits 1 as well and mentions what the decoded
         * findings carry; and the whole workspace — session file, journal,
         * derived files, graph data, `.git/` — is byte-identical around the
         * two runs (a mutating `review` subcommand's human form included:
         * no session created, no status recorded, no decomposition).
         */
        const probeSourceGate = async (
          argv: readonly string[],
          what: string,
        ): Promise<void> => {
          const context = `T13.3-3 ${what}`;
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              const result = await runCli(product, workspace, argv);
              assertExitCode(
                result,
                1,
                `${context} — the gate reports the validation errors and ` +
                  `the command exits 1 without answering (SPEC 13.3, 12.0)`,
              );
              const findings = decodeFindingsReport(
                parseJsonStdout(result, context),
                context,
              ).findings;
              assertConditionCounts(
                findings,
                { "14.1": 1 },
                `${context} — exactly the staged validation error is ` +
                  `reported, the findings a \`build\` would now report ` +
                  `(SPEC 13.3, 14.1)`,
              );
              const finding = findings[0] as Finding;
              assertFindingLocated(
                finding,
                { file: "specs/B.mdx" },
                `${context} — the validation error identifies the broken ` +
                  `source (SPEC 14)`,
              );
              await assertHumanGateReport(
                product,
                workspace,
                argv,
                findings,
                context,
              );
            },
            context,
          );
        };

        // The six gated reads (SPEC 13.3).
        await probeSourceGate(["ids", "--json"], "`ids --json`");
        await probeSourceGate(
          ["show", ALPHA, "--json"],
          `\`show ${ALPHA} --json\``,
        );
        await probeSourceGate(["coverage", "--json"], "`coverage --json`");
        await probeSourceGate(
          ["impact", "--base", base, "--json"],
          "`impact --base <valid-ref> --json` (baseline resolution, " +
            "which precedes the gate, succeeds, so the gate's report is " +
            "the operative outcome)",
        );
        await probeSourceGate(
          ["review", "status", "s", "--json"],
          "`review status s --json`",
        );
        await probeSourceGate(["query", "nodes"], "`query nodes`");

        // `check` — a read command of 13.3, though it never refreshes:
        // exit 1 with the validation error among its findings, modifying
        // nothing. Lenient on the findings multiset (whether staleness
        // findings are detectable beside the validation error is T14-4's
        // reporter-matrix business, not 13.3's).
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const label = "T13.3-3 `check --json`";
            const result = await runCli(product, workspace, [
              "check",
              "--json",
            ]);
            assertExitCode(
              result,
              1,
              `${label} — invalid sources are findings (SPEC 12.2)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, label),
              label,
            ).findings;
            if (
              !findings.some(
                (finding) =>
                  finding.condition === "14.1" &&
                  finding.locations.some(
                    (location) => location.file === "specs/B.mdx",
                  ),
              )
            ) {
              fail(
                `${label}: the staged validation error (14.1 in ` +
                  `specs/B.mdx) must be reported (SPEC 12.2, 14.1); got ` +
                  JSON.stringify(
                    findings.map((finding) => ({
                      condition: finding.condition,
                      locations: finding.locations,
                    })),
                  ),
              );
            }
          },
          "T13.3-3 `check` with invalid sources modifies nothing",
        );

        // The mutating review subcommands observe the same rule — 13.3
        // binds `review` whole, and create/resolve/split all consult the
        // current graph (SPEC 13.3, 10.7): no session file is created, no
        // status recorded, no decomposition.
        await probeSourceGate(
          ["review", "create", "--base", base, "--name", "nb", "--json"],
          "`review create --base <valid-ref> --name nb --json` (a given " +
            "baseline's resolution precedes the gate, 12.0, so the gate's " +
            "report is the operative outcome — exit 1, not 2)",
        );
        await probeSourceGate(
          ["review", "create", "--strategy", "audit", "--name", "na", "--json"],
          "`review create --strategy audit --name na --json`",
        );
        await probeSourceGate(
          ["review", "create", "--coverage", "p", "--name", "nc", "--json"],
          "`review create --coverage p --name nc --json`",
        );
        await probeSourceGate(
          [
            "review",
            "resolve",
            "s",
            gammaRow.id,
            "--status",
            "no-change",
            "--json",
          ],
          "`review resolve s <unblocked item> --status no-change --json` " +
            "(no status recorded)",
        );
        await probeSourceGate(
          ["review", "split", "s", alphaRow.id, "--json"],
          "`review split s <unblocked splittable item> --json` (no " +
            "decomposition)",
        );
      },
    );

    // --- Whole-gate arm 1, the garbage journal line (14.13), and its stale
    // twin (TEST-SPEC T13.3-3; `runGarbageJournalGate`, the module header).
    await runGarbageJournalGate(product, false);
    await runGarbageJournalGate(product, true);

    // --- Whole-gate arm 2, the obstructed write path (14.22), and its stale
    // twin, which also drives the mutating `review` subcommands past their
    // acquisition (`runObstructedWritePathGate`, the module header).
    await runObstructedWritePathGate(product, WRITE_PATH_GATE);
    await runObstructedWritePathGate(product, WRITE_PATH_GATE_STALE_TWIN);
  },
});

// ---------------------------------------------------------------------------
// T13.3-4 — determinism
// ---------------------------------------------------------------------------

// A workspace exercising the enumerated graph-data content (SPEC 13.3):
// nested sections, a dependency edge, tags, a coverage attribute, a
// subdirectory source, and a configured coverage profile. No git: graph data
// derives from sources and configuration alone. The two-directory form's
// workspaces are created after the same-workspace form's invocations, so
// the `.mdx` entries are staged-source records (S-9's before-any-product
// clause; helpers/staged-mdx.ts), the first workspace staging them too.
const T13_3_4_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": GRAPH_CONFIG,
  "specs/A.mdx": stagedMdx(
    "T13.3-4 specs/A.mdx (the determinism workspace: nested sections, a d edge, tags, a coverage attribute)",
    [
      '<S id="alpha" d={["beta"]} tags="core deep">',
      "Alpha depends on beta.",
      '<S id="alpha.one" coverage="none">',
      "Alpha-one text.",
      "</S>",
      "</S>",
      "",
      '<S id="beta">',
      "Beta text.",
      "</S>",
      "",
    ].join("\n"),
  ),
  "specs/sub/C.mdx": stagedMdx(
    "T13.3-4 specs/sub/C.mdx (the determinism workspace's subdirectory source)",
    ['<S id="gamma" tags="edge">', "Gamma text.", "</S>", ""].join("\n"),
  ),
};

const T13_3_4 = defineProductTest({
  id: "T13.3-4",
  title:
    "graph data files are byte-deterministic across rebuilds of an identical workspace — same-workspace rebuilds and the two-directory protocol (content otherwise unasserted, H-4) (SPEC 13.3, 12.0)",
  run: async (product) => {
    // Same-workspace form: build once, then rebuild twice via the H-6
    // run-twice protocol; the graph data written by every rebuild is
    // byte-identical to the first build's.
    await withWorkspace(T13_3_4_FILES, async (workspace) => {
      await buildOk(product, workspace, "T13.3-4 initial `build`");
      const first = await snapshotDirectory(workspace.root);
      assertGraphDataPresent(first, "T13.3-4 after the initial `build`");
      const pair = await assertRunTwiceDeterministic({
        binding: product,
        run: { cwd: workspace.root, argv: ["build"] },
        context:
          "T13.3-4 H-6 run-twice determinism of `build` over the identical " +
          "workspace",
      });
      assertExitCode(
        pair.first,
        0,
        "T13.3-4 rebuilding the identical workspace succeeds (SPEC 12.1)",
      );
      const afterRebuilds = await snapshotDirectory(workspace.root);
      assertSnapshotsEqual(
        asSnapshot(first, graphDataEntries(first)),
        asSnapshot(afterRebuilds, graphDataEntries(afterRebuilds)),
        "T13.3-4: graph data after the rebuilds vs after the initial " +
          "`build` — byte-deterministic across rebuilds of an identical " +
          "workspace (SPEC 13.3, 12.0; H-4 self-comparison)",
      );
    });

    // Two-directory form (H-6): the identical workspace built in two
    // separate directories yields byte-identical graph data (workspace-
    // relative paths make the compare well-defined across directories).
    const made: TestWorkspace[] = [];
    try {
      const result = await assertAcrossDirectoriesDeterministic({
        makeWorkspace: async () => {
          const workspace = await TestWorkspace.create({
            files: T13_3_4_FILES,
          });
          made.push(workspace);
          return workspace;
        },
        binding: product,
        makeRun: (workspace) => ({ cwd: workspace.root, argv: ["build"] }),
        context:
          "T13.3-4 H-6 two-directory determinism of `build` over identical " +
          "workspaces",
      });
      assertExitCode(
        result.first,
        0,
        "T13.3-4 `build` succeeds in the two-directory protocol (SPEC 12.1)",
      );
      const snapshotFirst = await snapshotDirectory(result.firstWorkspace.root);
      const snapshotSecond = await snapshotDirectory(
        result.secondWorkspace.root,
      );
      assertGraphDataPresent(
        snapshotFirst,
        "T13.3-4 after `build` in directory 1",
      );
      assertSnapshotsEqual(
        asSnapshot(snapshotFirst, graphDataEntries(snapshotFirst)),
        asSnapshot(snapshotSecond, graphDataEntries(snapshotSecond)),
        "T13.3-4: graph data of the two directories' builds — " +
          "byte-deterministic for identical workspaces (SPEC 13.3, 12.0)",
      );
    } finally {
      for (const workspace of made) {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T13.3-5 — never stale: (a) tampered graph data
// ---------------------------------------------------------------------------

// T13.3-5(a)'s twin (TEST-SPEC T13.3-5: "a twin's built after one section's
// text was edited"): T13.3-2's sources with alpha's own text edited, built
// on a fresh workspace created after the body's first invocations, so its
// two sources are staged-source records (S-9's before-any-product clause;
// helpers/staged-mdx.ts) and its configuration `GRAPH_CONFIG`'s.
const T13_3_5_TWIN_A = stagedMdx(
  "T13.3-5 (a)'s twin specs/A.mdx (T13.3-2's alpha, its own text edited)",
  ['<S id="alpha">', "Alpha edited text.", "</S>", ""].join("\n"),
);
const T13_3_5_TWIN_B = stagedMdx(
  "T13.3-5 (a)'s twin specs/B.mdx (T13.3-2's beta, unedited)",
  T13_3_2_B,
);
const T13_3_5_TWIN_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": GRAPH_CONFIG,
  "specs/A.mdx": T13_3_5_TWIN_A,
  "specs/B.mdx": T13_3_5_TWIN_B,
};

// T13.3-2's workspace's discovered sources — its spec group's two `.mdx`
// files, its generated files excluded by name and no code group configured
// (SPEC 7, 13.4) — whose occupants 13.4's removal never removes.
const T13_3_5_SOURCES: readonly string[] = ["specs/A.mdx", "specs/B.mdx"];

// The fixed seed set T13.3-5(a)'s trials are drawn under (TEST-SPEC
// T13.3-5: "a fixed seed set in CI"; H-10, E-5): the property machinery's
// (helpers/property.ts), every draw made as `checkProperty` makes its own
// (`drawFixedSeedTrials`), so the trials are the same on every run.
const TAMPERING_SEEDS: readonly number[] = DEFAULT_PROPERTY_SEEDS;

// The single-file trials each seed draws, at the least: rounds of one
// alteration per nonempty file, as many rounds as reach this count — a
// count bounding work, never a guard (TEST-SPEC S-3). A file holding its
// content beside a digest of its inputs is caught answering from that
// content only by an alteration that leaves it readable, the digest intact
// — a byte inside a value, its one flipped bit keeping it in its class far
// more often than an arbitrary value would (for a pretty-printed JSON file
// about one flip in three, against one arbitrary value in six) — so a
// product writing few files has each altered at several offsets per seed.
const TAMPERING_TRIALS_PER_SEED = 8;

/** T13.3-5's reads, each under `--json` (TEST-SPEC T13.3-5: T13.3-2's ten). */
function neverStaleReads(base: string): readonly (readonly string[])[] {
  return [
    ["ids", "--json"],
    ["show", "specs/A.mdx#alpha", "--json"],
    ["coverage", "--json"],
    ["impact", "--base", base, "--json"],
    ["review", "status", "s", "--json"],
    ["review", "list", "--json"],
    ["query", "nodes", "--json"],
    ["occurrences", "--json"],
    ["view", "--json"],
    ["at", "specs/A.mdx", "20", "--json"],
  ];
}

/** An argv as a diagnosis spells it. */
function spelled(argv: readonly string[]): string {
  return `\`${argv.join(" ")}\``;
}

/** A byte as a diagnosis spells it. */
function hexByte(value: number): string {
  return `0x${value.toString(16).padStart(2, "0")}`;
}

/**
 * A product-written graph-data state: the plain files of T13.3-2's
 * operational path set (`isGraphDataKey`), by snapshot key with their bytes,
 * and its directories, each in byte order.
 */
export interface GraphDataState {
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly directories: readonly string[];
}

/** One trial of T13.3-5(a): the graph-data state it stages, described. */
export interface TamperingTrial {
  /** What the trial stages, its seed named (H-10). */
  readonly description: string;
  /** The staged graph data whole: every directory and file of the set. */
  readonly entries: ReadonlyMap<string, SnapshotEntry>;
}

/**
 * A snapshot's graph-data state. An entry of the set that is neither a plain
 * file nor a directory fails diagnosed: every file xspec writes is a plain
 * file (SPEC 13.4), so the state is no product-written one to tamper with.
 */
function graphDataStateOf(
  snapshot: DirectorySnapshot,
  context: string,
): GraphDataState {
  const files = new Map<string, Uint8Array>();
  const directories: string[] = [];
  for (const [key, entry] of graphDataEntries(snapshot)) {
    if (entry.kind === "file") {
      files.set(key, entry.bytes);
    } else if (entry.kind === "dir") {
      directories.push(key);
    } else {
      fail(
        `${context}: graph data at ${displaySnapshotPath(key)} is a ` +
          `${entry.kind} — every file xspec writes is a plain file (SPEC ` +
          `13.4), so this is no product-written graph-data state the ` +
          `harness can tamper with`,
      );
    }
  }
  return { files, directories };
}

/** A state's directories and files as the entries `restoreGraphData` stages. */
function stateEntries(state: GraphDataState): Map<string, SnapshotEntry> {
  const entries = new Map<string, SnapshotEntry>();
  for (const key of state.directories) entries.set(key, { kind: "dir" });
  for (const [key, bytes] of state.files) {
    entries.set(key, { kind: "file", bytes });
  }
  return entries;
}

/** Whether two states hold the same file at a path, or both none. */
function sameFile(
  first: Uint8Array | undefined,
  second: Uint8Array | undefined,
): boolean {
  if (first === undefined || second === undefined) return first === second;
  return Buffer.compare(first, second) === 0;
}

/** One drawn single-file alteration (`deriveTamperingTrials`). */
interface FileAlteration {
  readonly key: string;
  readonly offset: number;
  /** -1: the file truncated at `offset`; else the bit flipped there, 0–7. */
  readonly bit: number;
}

/**
 * One round of single-file alterations: one per nonempty file, in key order
 * — a seeded offset within the file, then a seeded choice between
 * truncating the file there and changing the byte there to another value,
 * one seeded bit of it flipped.
 */
function fileAlterations(
  nonempty: readonly (readonly [string, Uint8Array])[],
): Gen<readonly FileAlteration[]> {
  return (choices) =>
    nonempty.map(([key, bytes]) => {
      const offset = choices.intInclusive(0, bytes.length - 1);
      const truncate = choices.boolean();
      return { key, offset, bit: truncate ? -1 : choices.intInclusive(0, 7) };
    });
}

/** A seeded permutation of `0 … count - 1` (Fisher–Yates over the draws). */
function seededIndices(count: number): Gen<readonly number[]> {
  return (choices) => {
    const indices = Array.from({ length: count }, (_, index) => index);
    for (let index = count - 1; index > 0; index -= 1) {
      const other = choices.intInclusive(0, index);
      const held = indices[index] as number;
      indices[index] = indices[other] as number;
      indices[other] = held;
    }
    return indices;
  };
}

/**
 * The mixes' twin-side path sets over the paths at which the two states
 * differ, `differing[i]` holding index `indices[i]`: for each bit an index
 * needs, the mix taking from the twin the paths whose index has the bit set,
 * and the mix taking those whose index has it clear — so every two
 * differing paths, their indices differing at some bit, are taken one from
 * each state, both ways round, each mix taking some paths from each state
 * (2·⌈log₂ d⌉ mixes over d paths); one differing path alone takes the one
 * mix taking it from the twin.
 */
function mixTwinSides(
  differing: readonly string[],
  indices: readonly number[],
): string[][] {
  if (differing.length === 1) return [[...differing]];
  let bits = 0;
  while (1 << bits < differing.length) bits += 1;
  const sides: string[][] = [];
  for (let bit = 0; bit < bits; bit += 1) {
    for (const value of [1, 0]) {
      sides.push(
        differing.filter(
          (_, index) => (((indices[index] as number) >> bit) & 1) === value,
        ),
      );
    }
  }
  return sides;
}

/**
 * The directory keys strictly above `key` within the graph-data area:
 * `.xspec/a/b/c` → `.xspec/a`, `.xspec/a/b`.
 */
function graphDataAncestors(key: string): string[] {
  const segments = key.split("/");
  const ancestors: string[] = [];
  for (let length = 2; length < segments.length; length += 1) {
    ancestors.push(segments.slice(0, length).join("/"));
  }
  return ancestors;
}

/**
 * Whether a file at `key` fits a tree holding `entries`: nothing at its own
 * path, nothing below it, and no file at a directory component above it.
 */
function fitsBeside(
  entries: ReadonlyMap<string, SnapshotEntry>,
  key: string,
): boolean {
  if (entries.has(key)) return false;
  for (const other of entries.keys()) {
    if (other.startsWith(`${key}/`)) return false;
  }
  return !graphDataAncestors(key).some(
    (ancestor) => entries.get(ancestor)?.kind === "file",
  );
}

/**
 * One mix (`deriveTamperingTrials`): the workspace's own state, but at each
 * path of `fromTwin` the twin's file, or its absence, in its place. The
 * workspace's own directories stay; a twin's file no tree can hold beside
 * what the workspace's own state keeps (a directory or a file at its path,
 * a file at a directory component above it, anything below it) is dropped,
 * the description saying so.
 */
function mixTrial(
  own: GraphDataState,
  twin: GraphDataState,
  union: readonly string[],
  fromTwin: ReadonlySet<string>,
  label: string,
): TamperingTrial {
  const entries = new Map<string, SnapshotEntry>();
  for (const key of own.directories) entries.set(key, { kind: "dir" });
  for (const key of union) {
    const bytes = own.files.get(key);
    if (!fromTwin.has(key) && bytes !== undefined) {
      entries.set(key, { kind: "file", bytes });
    }
  }
  const taken: string[] = [];
  const dropped: string[] = [];
  for (const key of union) {
    if (!fromTwin.has(key)) continue;
    const bytes = twin.files.get(key);
    if (bytes === undefined) {
      taken.push(`${displaySnapshotPath(key)} (absent there)`);
    } else if (fitsBeside(entries, key)) {
      entries.set(key, { kind: "file", bytes });
      taken.push(displaySnapshotPath(key));
    } else {
      dropped.push(displaySnapshotPath(key));
    }
  }
  const droppedClause =
    dropped.length === 0
      ? ""
      : `; the twin's ${dropped.join(", ")} dropped, no tree holding it ` +
        `beside the workspace's own files and directories`;
  return {
    description:
      `${label}: from the twin ${taken.join(", ")}${droppedClause}; the ` +
      `rest the workspace's own`,
    entries,
  };
}

/**
 * T13.3-5(a)'s trials over two product-written graph-data states, the
 * workspace's own and its twin's (TEST-SPEC T13.3-5, H-3; the module
 * header): per fixed seed, rounds of one single-file alteration per
 * nonempty file of the workspace's own state (`fileAlterations`), as many
 * as reach `TAMPERING_TRIALS_PER_SEED` trials, so every nonempty file is
 * altered in some trial; then, where the two states hold two or more files
 * between them, the mixes (`mixTwinSides`, its indices permuted by the
 * first fixed seed). The count follows from the files the product writes,
 * known only once staged, so the trial loop carries no guard fixed in
 * advance (TEST-SPEC S-3; none at all under the suite's conservative design,
 * helpers/hang-guards.ts). Where the states hold several files, they must
 * differ somewhere: graph data holds every hash, and the twin's edit changes
 * alpha's own text (SPEC 13.3, 5.5) — else the mixes would stage nothing but
 * the workspace's own state, discriminating nothing (H-11: failing loud).
 */
export function deriveTamperingTrials(
  own: GraphDataState,
  twin: GraphDataState,
  context: string,
): TamperingTrial[] {
  const trials: TamperingTrial[] = [];
  const nonempty = [...own.files].filter(([, bytes]) => bytes.length > 0);
  const rounds =
    nonempty.length === 0
      ? 0
      : Math.ceil(TAMPERING_TRIALS_PER_SEED / nonempty.length);
  // Seed-major, as `checkProperty` draws its trials: `rounds` per seed.
  const drawn =
    rounds === 0
      ? []
      : drawFixedSeedTrials(fileAlterations(nonempty), rounds, TAMPERING_SEEDS);
  for (const [drawIndex, round] of drawn.entries()) {
    const seed = TAMPERING_SEEDS[Math.floor(drawIndex / rounds)] as number;
    for (const alteration of round) {
      const bytes = own.files.get(alteration.key) as Uint8Array;
      const where = displaySnapshotPath(alteration.key);
      const entries = stateEntries(own);
      if (alteration.bit < 0) {
        entries.set(alteration.key, {
          kind: "file",
          bytes: Uint8Array.from(bytes.subarray(0, alteration.offset)),
        });
        trials.push({
          description:
            `seed ${String(seed)}: ${where} truncated at offset ` +
            `${String(alteration.offset)} of its ${String(bytes.length)} bytes`,
          entries,
        });
      } else {
        const altered = Uint8Array.from(bytes);
        const was = altered[alteration.offset] as number;
        const now = was ^ (1 << alteration.bit);
        altered[alteration.offset] = now;
        entries.set(alteration.key, { kind: "file", bytes: altered });
        trials.push({
          description:
            `seed ${String(seed)}: ${where}'s byte at offset ` +
            `${String(alteration.offset)} of its ${String(bytes.length)} ` +
            `changed from ${hexByte(was)} to ${hexByte(now)} (bit ` +
            `${String(alteration.bit)} flipped)`,
          entries,
        });
      }
    }
  }
  const union = [
    ...new Set([...own.files.keys(), ...twin.files.keys()]),
  ].sort();
  if (union.length < 2) return trials;
  const differing = union.filter(
    (key) => !sameFile(own.files.get(key), twin.files.get(key)),
  );
  if (differing.length === 0) {
    fail(
      `${context}: the twin's premise — its graph data, built after ` +
        `alpha's own text was edited, differs from the workspace's: graph ` +
        `data holds every requirement node's hashes and alpha's own text ` +
        `enters its ownHash (SPEC 13.3, 5.5) — yet the two states hold the ` +
        `same ${String(union.length)} files byte for byte, so the mixes ` +
        `would stage nothing but the workspace's own state`,
    );
  }
  const seed = TAMPERING_SEEDS[0] as number;
  const indices = drawFixedSeedTrials(seededIndices(differing.length), 1, [
    seed,
  ])[0] as readonly number[];
  const sides = mixTwinSides(differing, indices);
  for (const [index, side] of sides.entries()) {
    trials.push(
      mixTrial(
        own,
        twin,
        union,
        new Set(side),
        `mix ${String(index + 1)} of ${String(sides.length)} (seed ` +
          `${String(seed)})`,
      ),
    );
  }
  return trials;
}

/**
 * T13.3-5(a)'s trials, read off what the product writes (TEST-SPEC T13.3-5,
 * S-3): the workspace's own graph-data state as it stands — freshly built
 * — and a twin's, the product's `build` run on a fresh workspace holding
 * `twinFiles` (exit 0 required: the twin's sources are valid), its state
 * read, the twin disposed; then `deriveTamperingTrials`. The shared reading
 * S-3's pre-product check drives against a stand-in build writing file sets
 * of differing counts under `.xspec/` (test/self/s3-hang-guards.test.ts),
 * every span staged one per trial it returns.
 */
export async function readTamperingTrials(
  product: ProductBinding,
  workspace: TestWorkspace,
  twinFiles: Readonly<Record<string, InitialFileContents>>,
  context: string,
): Promise<readonly TamperingTrial[]> {
  const ownSnapshot = await snapshotDirectory(workspace.root);
  const twinSnapshot = await withWorkspace(twinFiles, async (twin) => {
    await buildOk(
      product,
      twin,
      `${context}: the twin's \`build\` — its sources are valid, so it ` +
        `succeeds, writing its graph data (SPEC 12.1, 13.3)`,
    );
    return await snapshotDirectory(twin.root);
  });
  return guardSyncStep(
    `deriving ${context}'s trials (deriveTamperingTrials)`,
    () =>
      deriveTamperingTrials(
        graphDataStateOf(ownSnapshot, `${context}: the workspace's own state`),
        graphDataStateOf(twinSnapshot, `${context}: the twin's state`),
        context,
      ),
  );
}

/**
 * Run `body` on a fresh workspace holding a byte copy of the whole tree
 * `base` snapshots (helpers/tree-copy.ts `copyTreeBytes`, `.git` included,
 * so `impact --base` resolves there), checked against `base` before `body`
 * runs — a difference is a harness error, never a product verdict — and
 * handed `body` with its snapshot; then dispose of it (H-1). Nothing judges
 * the copy as a staging: its sources were staged, and judged, where they
 * were written (S-9), the rest is the product's own state and the
 * harness's tampering with it.
 */
async function withByteCopy<T>(
  base: DirectorySnapshot,
  context: string,
  body: (copy: TestWorkspace, copied: DirectorySnapshot) => Promise<T>,
): Promise<T> {
  return await withWorkspace({}, async (copy) => {
    await copyTreeBytes(Buffer.from(base.root), Buffer.from(copy.root));
    const copied = await snapshotDirectory(copy.root);
    const differences = diffSnapshots(base, copied);
    if (differences.length > 0) {
      throw new Error(
        `harness error: ${context}: the copy of ${base.root} at ` +
          `${copy.root} differs from it: ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    return await body(copy, copied);
  });
}

/**
 * Stage `trial` on a fresh byte copy of the untampered workspace — its graph
 * data replaced whole by the trial's state (`restoreGraphData`, a harness
 * step under its own guard), checked to hold exactly that state (a
 * difference is a harness error) — and run `body` with the staged state's
 * snapshot; then dispose of the copy.
 */
async function withStagedTrial<T>(
  untampered: DirectorySnapshot,
  trial: TamperingTrial,
  context: string,
  body: (staged: DirectorySnapshot) => Promise<T>,
): Promise<T> {
  return await withByteCopy(untampered, context, async (copy) => {
    await guardStep(`staging ${context} (restoreGraphData)`, () =>
      restoreGraphData(copy, trial.entries, context),
    );
    const staged = await snapshotDirectory(copy.root);
    const differences = diffSnapshots(
      asSnapshot(staged, trial.entries),
      asSnapshot(staged, graphDataEntries(staged)),
    );
    if (differences.length > 0) {
      throw new Error(
        `harness error: ${context}: the staged graph data differs from the ` +
          `trial's state: ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    return await body(staged);
  });
}

/** One read's run on its own copy of a state (`observeRead`). */
interface ReadObservation {
  readonly argv: readonly string[];
  readonly result: RunResult;
  /** Whether the run left T13.3-2's operational path set other than it was. */
  readonly rewrote: boolean;
}

/**
 * Run one read on its own byte copy of the state `base` snapshots — a
 * refresh repairs the state for every later read (TEST-SPEC T13.3-5) — and
 * observe its result and whether it rewrote anything in T13.3-2's
 * operational path set, the copy's graph-data entries compared whole
 * before and after it (H-4: opaque, compared whole, never read).
 */
async function observeRead(
  product: ProductBinding,
  base: DirectorySnapshot,
  argv: readonly string[],
  context: string,
): Promise<ReadObservation> {
  return await withByteCopy(base, context, async (copy, copied) => {
    const result = await runCli(product, copy, argv);
    const after = await snapshotDirectory(copy.root);
    const changes = diffSnapshots(
      asSnapshot(copied, graphDataEntries(copied)),
      asSnapshot(after, graphDataEntries(after)),
    );
    return { argv, result, rewrote: changes.length > 0 };
  });
}

/** A state's runs, each on its own byte copy of it (`observeState`). */
interface StateObservations {
  readonly reads: readonly ReadObservation[];
  readonly inventory: RunResult;
  readonly check: RunResult;
}

/**
 * Run T13.3-5's reads, `inventory`, and `check --json` on the state `base`
 * snapshots, each on its own byte copy of it, all at once — the runs share
 * nothing, so their order is no input to any of them — and return their
 * results once every run has settled, each bounded by its own guard (S-3):
 * a run's rejection (a harness error, a hang-guard kill) is thrown, the
 * first in that order, only then, so no run outlives its trial. Judging
 * them is the caller's, in a fixed order (E-5).
 */
async function observeState(
  product: ProductBinding,
  base: DirectorySnapshot,
  reads: readonly (readonly string[])[],
  context: string,
): Promise<StateObservations> {
  const readsPending = reads.map((argv) =>
    observeRead(product, base, argv, `${context} ${spelled(argv)}`),
  );
  const inventoryPending = withByteCopy(
    base,
    `${context} \`inventory\``,
    (copy) => runCli(product, copy, ["inventory"]),
  );
  const checkPending = withByteCopy(
    base,
    `${context} \`check --json\``,
    (copy) => runCli(product, copy, ["check", "--json"]),
  );
  const outcomes = await Promise.allSettled<
    Promise<ReadObservation> | Promise<RunResult>
  >([...readsPending, inventoryPending, checkPending]);
  for (const outcome of outcomes) {
    if (outcome.status === "rejected") throw outcome.reason;
  }
  return {
    reads: await Promise.all(readsPending),
    inventory: await inventoryPending,
    check: await checkPending,
  };
}

/**
 * `inventory`'s `recorded` from its run (SPEC 11.6: the record read without
 * refresh): a list, the inventory exiting 0, or the unavailability marker,
 * exiting 1 (14.23, 12.0: an answer carrying explicitly unavailable data
 * exits 1) — never `null`.
 */
function recordedOf(
  result: RunResult,
  label: string,
): DecodedDatum<readonly PathValue[]> {
  const recorded = decodeInventoryRecordedDatum(
    parseJsonStdout(result, label),
    label,
  );
  if (recorded.state === "null") {
    fail(
      `${label}: \`recorded\` is the recorded derived-file paths or ` +
        `explicitly unavailable, never null (SPEC 11.6, 14.23, 12.7)`,
    );
  }
  assertExitCode(
    result,
    recorded.state === "value" ? 0 : 1,
    `${label}: with \`recorded\` ` +
      `${recorded.state === "value" ? "a list" : "unavailable"} the ` +
      `inventory exits ${recorded.state === "value" ? "0" : "1"} (SPEC ` +
      `11.6, 14.23, 12.0)`,
  );
  return recorded;
}

/**
 * Whether 13.4's removal of a recorded derived file the current sources and
 * configuration no longer generate would remove what occupies the listed
 * path on the state rooted at `rootAbs` (SPEC 13.4, 14.10: an occupant the
 * removal would remove, so neither a directory nor a discovered source):
 * walked component by component at the path's exact bytes, `lstat` at
 * each, never following a link — nothing (no occupant, or a component above
 * it occupied by anything but a directory, where nothing is read) and a
 * directory are left as they are, as is a discovered source's file (by
 * device and inode, whatever spelling reaches it); anything else — a plain
 * file, a symbolic link itself, any other non-directory — is removed. A
 * path holding a NUL byte names nothing on the filesystem.
 */
async function removalWouldRemove(
  rootAbs: string,
  listed: Buffer,
  sources: readonly BigIntStats[],
): Promise<boolean> {
  if (listed.includes(0)) return false;
  const segments: Buffer[] = [];
  let start = 0;
  for (let index = 0; index <= listed.length; index += 1) {
    if (index === listed.length || listed[index] === 0x2f) {
      segments.push(listed.subarray(start, index));
      start = index + 1;
    }
  }
  let current = Buffer.from(rootAbs);
  for (const [index, segment] of segments.entries()) {
    current = Buffer.concat([current, Buffer.from([0x2f]), segment]);
    let stats: BigIntStats;
    try {
      stats = await fsp.lstat(current, { bigint: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR" || code === "ENAMETOOLONG") {
        return false;
      }
      throw new Error(
        `harness error: examining the occupant at ${current.toString()} ` +
          `(T13.3-5 (a)'s removal judgement): ${(error as Error).message}`,
        { cause: error },
      );
    }
    if (index < segments.length - 1) {
      if (!stats.isDirectory()) return false;
      continue;
    }
    if (stats.isDirectory()) return false;
    return !sources.some(
      (source) => source.dev === stats.dev && source.ino === stats.ino,
    );
  }
  return false;
}

/**
 * The listed paths `check` must report in the recorded-file form on the
 * state rooted at `rootAbs` (TEST-SPEC T13.3-5 (a)): each path `recorded`
 * lists outside the untampered workspace's `recorded` list — the paths the
 * current sources generate — whose occupant 13.4's removal would remove
 * (`removalWouldRemove`), as exact bytes. A harness step under its own
 * guard (TEST-SPEC S-3).
 */
async function predictedRecordedFindings(
  rootAbs: string,
  listed: readonly PathValue[],
  untamperedRecorded: readonly PathValue[],
  context: string,
): Promise<Buffer[]> {
  return await guardStep(
    `judging the occupants of ${context}'s recorded paths (removalWouldRemove)`,
    async () => {
      const sources: BigIntStats[] = [];
      for (const source of T13_3_5_SOURCES) {
        sources.push(
          await fsp.lstat(
            Buffer.concat([Buffer.from(rootAbs), Buffer.from(`/${source}`)]),
            { bigint: true },
          ),
        );
      }
      const generated = untamperedRecorded.map(pathValueBytes);
      const removable: Buffer[] = [];
      for (const value of listed) {
        const bytes = pathValueBytes(value);
        if (generated.some((path) => path.equals(bytes))) continue;
        if (await removalWouldRemove(rootAbs, bytes, sources)) {
          removable.push(bytes);
        }
      }
      return removable;
    },
  );
}

/** Exact path bytes as `renderPathValue` renders the path value they are. */
function renderPathBytes(bytes: Buffer): string {
  const text = bytes.toString("utf8");
  return Buffer.from(text, "utf8").equals(bytes)
    ? text
    : `bytes:${bytes.toString("hex")}`;
}

/** `check`'s predicted verdict on a staged state (`assertPredictedVerdict`). */
interface CheckPrediction {
  /** Whether the unit form is reported, and why, for the diagnosis. */
  readonly unit: boolean;
  readonly grounds: string;
  /** The recorded-file-form findings' concerned paths, as exact bytes. */
  readonly perFile: readonly Buffer[];
}

/**
 * `check --json`'s verdict, as predicted (TEST-SPEC T13.3-5 (a); SPEC 14.10,
 * 14.23, 12.2, 12.7): exactly one condition-10 finding in the unit form —
 * `path` `".xspec"`, the graph-data area (11.6) — when predicted, beside it
 * one recorded-file-form finding concerning each predicted path, and
 * nothing else: every finding condition 10 (`stale-output`), `locations`
 * `[]`, and instructing rebuilding — no recorded path's occupant obstructs a
 * rebuild write here, the staging altering no occupant outside graph data,
 * whose writes' directory components stay directories (SPEC 14.10, 13.4,
 * 14.22) — exit 1 when it reports any finding and 0 otherwise (12.0).
 */
function assertPredictedVerdict(
  result: RunResult,
  prediction: CheckPrediction,
  context: string,
): void {
  const reports = prediction.unit || prediction.perFile.length > 0;
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    assertExitCode(
      result,
      reports ? 1 : 0,
      `${context}: \`check\` exits 1 on any finding and 0 otherwise, never ` +
        `a usage error on this valid workspace (SPEC 12.0, 12.2)`,
    );
  }
  const findings = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  ).findings;
  for (const finding of findings) {
    if (finding.condition !== "14.10") {
      fail(
        `${context}: \`check\` reports condition 10 alone here — the ` +
          `derived files are the workspace's own, matching, and nothing ` +
          `but graph data was staged (SPEC 14.10, 12.2); got ` +
          `${JSON.stringify(finding.code)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  }
  const unitCount = findings.filter(
    (finding) => finding.path === GRAPH_DATA_AREA,
  ).length;
  if (unitCount !== (prediction.unit ? 1 : 0)) {
    fail(
      `${context}: exactly one condition-10 finding in the unit form, ` +
        `concerning the graph-data area ${GRAPH_DATA_AREA}, when ` +
        `\`recorded\` is unavailable or the reads rewrote T13.3-2's ` +
        `operational path set, and none otherwise (SPEC 14.10, 14.23, 13.3: ` +
        `\`check\` judges by the reads' one comparison) — here ` +
        `${prediction.grounds}, so expected ${prediction.unit ? "1" : "0"}, ` +
        `got ${String(unitCount)} (findings: ` +
        `${JSON.stringify(findings.map((finding) => renderPathValue(finding.path)))})`,
    );
  }
  const reported = findings
    .filter((finding) => finding.path !== GRAPH_DATA_AREA)
    .map((finding) => finding.path);
  const expected = [...prediction.perFile].sort(Buffer.compare);
  const reportedBytes = reported.map((value) =>
    value === null ? null : pathValueBytes(value),
  );
  const sortedReported = [...reportedBytes].sort((first, second) =>
    first === null || second === null
      ? (first === null ? 0 : 1) - (second === null ? 0 : 1)
      : Buffer.compare(first, second),
  );
  if (
    sortedReported.length !== expected.length ||
    sortedReported.some(
      (value, index) =>
        value === null || !value.equals(expected[index] as Buffer),
    )
  ) {
    fail(
      `${context}: beside the unit form, one recorded-file-form finding ` +
        `concerning each path \`recorded\` lists outside the untampered ` +
        `workspace's \`recorded\` list whose occupant 13.4's removal would ` +
        `remove, and nothing else (SPEC 14.10, 13.4, 12.7; paths compare ` +
        `byte-wise) — expected ` +
        `${JSON.stringify(expected.map(renderPathBytes))}, got ` +
        `${JSON.stringify(reported.map(renderPathValue))}`,
    );
  }
  for (const finding of findings) {
    const about = `${context} — the finding concerning ${renderPathValue(finding.path)}`;
    assertSameJson(
      finding.locations,
      [],
      `${about}: a condition-10 finding has no in-source location (SPEC ` +
        `14.10, 14, 12.7)`,
    );
    assertFindingInstructsRebuilding(
      finding,
      `${about}: no recorded path's occupant obstructs a rebuild write on ` +
        `this state, so every condition-10 finding instructs rebuilding ` +
        `(SPEC 14.10, 14)`,
    );
  }
  assertExitCode(
    result,
    reports ? 1 : 0,
    `${context}: \`check\` exits 1 when it reports any finding, and 0 ` +
      `otherwise (SPEC 12.0, 12.2)`,
  );
}

/** What the untampered workspace's runs give every trial to compare with. */
interface UntamperedObservations {
  readonly reads: readonly ReadObservation[];
  /** The untampered `recorded` list: the paths the current sources generate. */
  readonly recorded: readonly PathValue[];
}

/**
 * The untampered workspace's runs, each on its own byte copy as every
 * trial's (TEST-SPEC T13.3-5 (a): "its run's on the untampered workspace";
 * `observeState`), and their premises: freshly built and valid, the
 * workspace answers every read — exit 0, one JSON document (SPEC 12.0,
 * 13.3; T13.3-1) — leaving T13.3-2's operational path set byte-identical
 * (graph data a `build` just wrote is current, SPEC 13.3, 12.0);
 * `inventory`'s `recorded` is a list (after a successful `build` the record
 * is readable, SPEC 13.3, 11.6); and `check` is clean (SPEC 12.2, 14.10).
 */
async function observeUntampered(
  product: ProductBinding,
  untampered: DirectorySnapshot,
  reads: readonly (readonly string[])[],
): Promise<UntamperedObservations> {
  const context = "T13.3-5 (a) on the untampered workspace";
  const observed = await observeState(product, untampered, reads, context);
  for (const read of observed.reads) {
    const label = `${context} ${spelled(read.argv)}`;
    assertExitCode(
      read.result,
      0,
      `${label}: on the freshly built, valid workspace every read answers, ` +
        `exit 0 (SPEC 12.0, 13.3; T13.3-1)`,
    );
    parseJsonStdout(read.result, `${label}: its answer (SPEC 12.0)`);
    if (read.rewrote) {
      fail(
        `${label}: graph data a \`build\` just wrote is current, so the ` +
          `read refreshes nothing, leaving T13.3-2's operational path set ` +
          `byte-identical (SPEC 13.3, 12.0)`,
      );
    }
  }
  const inventoryLabel = `${context} \`inventory\``;
  const recorded = recordedOf(observed.inventory, inventoryLabel);
  if (recorded.state !== "value") {
    fail(
      `${inventoryLabel}: after a successful \`build\` the record is ` +
        `readable — \`recorded\` a list (SPEC 13.3, 11.6, 12.1); got the ` +
        `unavailability marker`,
    );
  }
  const checkLabel =
    `${context} \`check --json\` — freshly built and valid, the workspace ` +
    `is clean (SPEC 12.2, 14.10)`;
  assertExitCode(
    observed.check,
    0,
    `${checkLabel} — a finding-free report exits 0 (SPEC 12.0)`,
  );
  assertSameJson(
    decodeFindingsReport(
      parseJsonStdout(observed.check, checkLabel),
      checkLabel,
    ).findings,
    [],
    `${checkLabel} — the report is exactly {"findings": []} (SPEC 12.7)`,
  );
  return { reads: observed.reads, recorded: recorded.value };
}

/**
 * One trial's verdict on its staged state (TEST-SPEC T13.3-5 (a); the module
 * header), its runs each on its own copy (`observeState`): each read exits
 * and answers byte for byte as on the untampered workspace; the reads
 * rewrite T13.3-2's operational path set alike, all or none; and `check`'s
 * verdict is as that observation and `inventory`'s `recorded` alone
 * predict it (`assertPredictedVerdict`).
 */
async function judgeTamperingTrial(
  product: ProductBinding,
  staged: DirectorySnapshot,
  untampered: UntamperedObservations,
  context: string,
): Promise<void> {
  const observed = await observeState(
    product,
    staged,
    untampered.reads.map((read) => read.argv),
    context,
  );
  const rewrote: string[] = [];
  const untouched: string[] = [];
  for (const [index, read] of observed.reads.entries()) {
    const want = untampered.reads[index] as ReadObservation;
    const label = `${context} ${spelled(read.argv)}`;
    assertExitCode(
      read.result,
      want.result.exitCode as number,
      `${label}: its exit code equals its run's on the untampered ` +
        `workspace (SPEC 13.3: read results never come from stale data — ` +
        `graph data not matching what \`build\` would now write is ` +
        `refreshed before the answer)`,
    );
    assertBytesEqual(
      read.result.stdoutBytes,
      want.result.stdoutBytes,
      `${label}: its standard output equals its run's on the untampered ` +
        `workspace, byte for byte (SPEC 13.3, 12.0)`,
    );
    (read.rewrote ? rewrote : untouched).push(spelled(read.argv));
  }
  if (rewrote.length > 0 && untouched.length > 0) {
    fail(
      `${context}: every read refreshes by 13.3's one comparison exactly ` +
        `when graph data does not match, writing what \`build\` would write ` +
        `— so the reads rewrite T13.3-2's operational path set alike, all ` +
        `or none (SPEC 13.3); rewrote it: ${rewrote.join(", ")}; left it ` +
        `byte-identical: ${untouched.join(", ")}`,
    );
  }
  const recorded = recordedOf(observed.inventory, `${context} \`inventory\``);
  const refreshed = rewrote.length > 0;
  const grounds =
    `\`recorded\` is ${recorded.state === "value" ? "a list" : "unavailable"} ` +
    `and the reads ${refreshed ? "rewrote" : "left byte-identical"} the set`;
  const prediction: CheckPrediction = {
    unit: recorded.state !== "value" || refreshed,
    grounds,
    perFile:
      recorded.state === "value"
        ? await predictedRecordedFindings(
            staged.root,
            recorded.value,
            untampered.recorded,
            context,
          )
        : [],
  };
  assertPredictedVerdict(
    observed.check,
    prediction,
    `${context} \`check --json\``,
  );
}

const T13_3_5 = defineProductTest({
  id: "T13.3-5",
  title:
    "never stale, (a) tampered graph data, shape-blind (H-3): on T13.3-2's workspace, freshly built and valid, each trial alters one file of T13.3-2's operational path set at a seeded offset — a single byte changed to a seeded other value, one seeded bit of it flipped, or the file truncated there — in rounds of one trial per nonempty file, at least eight trials per seed of the fixed seed set (H-10, E-5), and, where the product writes several files there, further trials mix the files of the workspace's own state and a twin's built after alpha's text was edited, every two paths at which they differ taken one from each state, both ways round; on its own copy of each staged state, each of ids, show, coverage, impact, review status, review list, query, occurrences, view, and at under --json exits and answers byte for byte as on the untampered workspace, the reads rewriting the operational path set alike, all or none, and check's verdict is predicted from that observation and inventory's recorded alone — exactly one condition-10 finding in the unit form (path .xspec, locations []) when recorded is unavailable or the reads rewrote the set, beside it, where recorded is a list, one recorded-file-form finding per listed path outside the untampered recorded list whose occupant 13.4's removal would remove, and nothing else, exit 1 exactly when it reports any (SPEC 13.3, 13.4, 11.6, 14.10, 14.23)",
  run: async (product) => {
    await withWorkspace(
      {
        "xspec.config.ts": GRAPH_CONFIG,
        "specs/A.mdx": T13_3_2_A_V0,
        "specs/B.mdx": T13_3_2_B,
      },
      async (workspace) => {
        const base = await stageRefreshWorkspace(
          product,
          workspace,
          "T13.3-5 (a)",
        );
        const untampered = await snapshotDirectory(workspace.root);
        assertGraphDataPresent(
          untampered,
          "T13.3-5 (a) after the staging builds",
        );
        const baseline = await observeUntampered(
          product,
          untampered,
          neverStaleReads(base),
        );
        const trials = await readTamperingTrials(
          product,
          workspace,
          T13_3_5_TWIN_FILES,
          "T13.3-5 (a)",
        );
        for (const [index, trial] of trials.entries()) {
          const context =
            `T13.3-5 (a) trial ${String(index + 1)} of ` +
            `${String(trials.length)} (${trial.description})`;
          await withStagedTrial(untampered, trial, context, (staged) =>
            judgeTamperingTrial(product, staged, baseline, context),
          );
        }
      },
    );
  },
});

/** TEST-SPEC §13.3, in canonical ID order (SUITE-46). */
export const section133Tests: readonly ProductTestEntry[] = [
  T13_3_1,
  T13_3_2,
  T13_3_3,
  T13_3_4,
  T13_3_5,
];
