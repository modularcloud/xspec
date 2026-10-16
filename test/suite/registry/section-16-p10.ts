// TEST-SPEC §16 P-10 (concurrency) — PROP-08.
//
// One registered product-facing property test (C-2 "one code path"): a
// seeded, reproducible generator (helpers/property.ts, H-10; fixed seed set
// in CI, E-5) produces randomized schedules of episodes over one workspace —
// each episode exactly one mutating command (`rename`, file-form `move`, or
// `review resolve`), under `--json`, held at the `--test-hold` seam or not,
// and concurrent readers beside it:
//
//   * pre-start readers, started before the mutating command at drawn leads
//     and still running as it starts — the harness confirming, just before
//     starting it, that at least one of them has not exited (listed in the
//     process list, never a zombie, its exit unseen), starting another where
//     none has: P-10's reader rule discriminates only where a command really
//     starts while readers run (CERTIFICATIONS.md §CONF-READERS; its
//     violator VIOL-READERS-CLAIM certifies that the schedules do);
//   * held reads, run to completion while the command holds, each exit 0:
//     the workspace is valid, built, and unmodified while held;
//   * straddle reads, started just before the hold is lifted or the command
//     killed (an unheld command's, just after it starts), settled once it
//     has ended — as are the pre-start readers — each exit 0 or 1, never a
//     crash or a hang (H-8): a read overlapping a commit can see a moving
//     file at neither or both paths, so a transient validation failure is
//     legitimate, never a usage error;
//   * and a polling reader (helpers/path-poller.ts, T13.5-5's machinery)
//     over the episode's fixed path set — the journal, the session file,
//     the spec source and a move's destination, their generated modules,
//     the companions beside them (SPEC 13.1: the files beside each source
//     named `NAME.xspec.` plus a suffix, listed from the workspace and from
//     the twin's final state before the episode starts; none for a product
//     writing none), and graph data (13.3: the plain files of T13.3-2's
//     operational path set, collected likewise from the workspace and from
//     the twin's final state, which leaves out the journal, the reviews
//     directory, and the lock path with everything under it) — never the
//     lock path.
//
// Each episode's command ends one of three ways: run to its end (held and
// lifted, or unheld); killed while held; or killed past its hold, at a fixed
// fraction of its twin's lift-to-exit span after its own lift. Every kill
// follows T13.5-3's exit-collection discipline (`RunningProduct.killGroup`:
// the command started in a process group of its own, the whole group killed
// with SIGKILL, the started process's exit collected, no process of the
// group listed) before anything later runs. Each command has a reader-free
// twin: the workspace copied — the lock path aside — as the command starts,
// the same operation run there with no reader beside it, held and lifted
// alike when the command is held (its lift-to-exit span measured): an
// operation valid by construction, so the twin exits 0 (§CONF-READERS'
// staging constraint: every mutating command an operation succeeding on its
// reader-free twin). P-10's invariant families are asserted per episode:
//
//   * readers observe only prior-or-complete file states (SPEC 13.5;
//     T13.5-5's protocol) at every path but the lock path — where 13.5's
//     atomicity admits no discriminating observation (TEST-SPEC P-10,
//     recorded there as T6.5-6 records its unstageable clauses), so it is
//     never polled: every distinct state polled at a path but graph data is
//     its state before the episode or after it — the episode's one mutating
//     command writes each such path at most once (a rename rewrites the
//     source, appends one journal entry, and regenerates the module and its
//     companions, 6.4; a file move relocates the source, and its finishing
//     regeneration writes the module and companions at the destination's
//     stem and removes the origin's, 6.5, 13.4; a resolve writes the
//     session once, last, 13.5) and no reader writes one (the read menu
//     leaves out `build`; a reader's refresh writes graph data alone,
//     generating no TypeScript, 13.3). After a run the kill ended, "after"
//     is the path's state in the reader-free twin's final workspace, read
//     before the episode starts: every distinct state polled there, and the
//     state the kill left, is the path's start state or that one. The run
//     leaves every write it made complete and makes no later one (13.5: "A
//     mutating command interrupted before completion … leaves the writes
//     already made, each complete, and makes no later one"), and its one
//     write to such a path, had it made it, is the twin's: the twin runs the
//     same operation on a byte copy of the episode's start, whose sources,
//     configuration, and journal nothing but the command writes during the
//     episode (a reader's refresh writes graph data alone, above); every
//     file the operation writes is byte-deterministic for identical input
//     (12.0: "no wall-clock values, no randomness, no absolute paths, no
//     environment-dependent content"; 13.4: derived files reproducible from
//     the sources, the configuration, and the journal); and the operation
//     writes each such path at most once (above). So a partial write the
//     kill left — at the journal, a rename's source, a move's origin or
//     destination, or a module or companion beside them — fails there and
//     never passes as "after" (and after a `rename` or `move` killed past
//     its hold the schedule continues on the twin's workspace, so nothing
//     later looks at what the kill left). Graph data has an oracle of its own:
//     readers' refreshes write it too, last write wins (13.3, 13.5), so a
//     graph-data path may pass through complete states that are neither its
//     state before the episode nor its twin's after it — the product's own
//     graph data for some state of the episode's files (derived files are
//     reproducible from the sources, the configuration, and the journal,
//     13.4, 5.4; graph data byte-deterministic, 12.0): each source the
//     operation writes at its start or end state independently (a read can
//     meet a moving file at both paths or at neither), the journal at
//     either (one atomic append), and the recorded derived-file paths as
//     the start's or the twin's graph data holds them (a refresh keeps the
//     record it reads, 13.3). So every state polled at a graph-data path,
//     and its state after the episode, is its start state, its twin's final
//     state, or its state in a staged copy of the twin's final workspace
//     holding one such combination once a refreshing read (`ids --json`)
//     has run there alone: the product's own outputs, a product-to-itself
//     comparison (H-4) pinning no graph-data byte — staged lazily, only
//     once some observed state is neither the start's nor the twin's, and
//     reached only by products whose reads refresh (the CONF-CORE
//     product's never do); the journal's observations are prefix-monotone
//     (append-only, 6.1) and never absent after content (never deleted);
//   * mutual exclusion never loses a journal append or a resolution (post
//     hoc, per run; `rename` and `move` the journal's only writers, 6.1):
//     each `rename`/`move` exiting 0 added exactly one journal line, each
//     killed one at most one; each resolve exiting 0 recorded its status
//     (the status ledger, read back by a quiescent `review status` after
//     every episode and cross-checked against `review list` at the end),
//     each killed one either recorded it or left the session file
//     byte-unchanged;
//   * a run the kill ended (its collected exit SIGKILL), held or past its
//     hold, whose sources, journal, or session files differ from those its
//     twin leaves had not made its last write, so had not released (13.5):
//     `.xspec/lock` holds exactly one entry, a plain file — the dead run's
//     (T13.5-3's past-the-hold judgement) — inspected once every read the
//     episode started has been settled, its readers exited: readers write
//     nothing at the lock path (13.4) and no mutating command runs between
//     the run's end and the inspection, so the dead run's entry still
//     stands there alone (until a later mutating command takes it over),
//     while a claim a reader holds only while it runs is gone by then — the
//     inspection sees what a reader leaves behind, never what it holds while
//     it runs, which the reader rule (below) alone observes, at a command's
//     acquisition;
//   * readers never exclude a mutating command (13.5; 14.26: only another
//     run's entry, or a leftover in the gap, refuses, and a reader makes
//     none, 13.4): each command not killed is never refused `workspace-busy`
//     — but where T13.5-3's reuse check voids the trial after a kill: an
//     identifier of a killed group listed again, the trial rerun on a fresh
//     workspace a bounded number of times, exhaustion a harness error — and
//     ends exactly as its twin: exit code, standard output, and the sources,
//     journal, and session files it leaves byte-equal (H-6), derived files
//     and graph data, which readers' refreshes may rewrite last-write-wins
//     (13.3, 13.5), not compared; `.xspec/lock` is absent once the
//     episode's readers have exited — inspected then, as a killed run's is
//     (above): a released run leaves nothing there (13.5, T13.5-11).
//
// The session files compared and judged are SPEC 10.1's sessions: entries
// directly under `.xspec/reviews/` named `<session-name>.json` with a valid
// session name. Any other entry there is no session and is ignored by every
// command (10.1) — the temporary entry an atomic session write leaves when
// a kill lands before its rename among them, which stays in the workspace
// the schedule continues on — so it is neither compared with a twin nor
// counted as a write beside a command's own files (isComparedKey).
//
// Validity discipline (every twin exits 0): `rename` targets a top-level ID
// the generator's file model holds, with a fresh name; file-form `move` a
// fresh `specs/M<n>.mdx`; `resolve` an unblocked item, picked by rank from
// the preceding quiescent `review status` read (execution-time resolution,
// the P-9 pattern: item IDs are the product's), with a status other than the
// item's stored one, so that every operation changes what it writes. The
// model applies a `rename` or `move` that completes or is killed past its
// hold and no other: a command killed while held modified nothing (the hold
// precedes all modification, 13.5), and after a `rename` or `move` killed
// past its hold the schedule continues on its twin's workspace — the
// operation complete there, whatever the kill left — so no later operation
// meets a partly applied one; after any other kill it continues on the same
// workspace, whose dead entry the next command takes over. No source edit
// happens and completed renames and moves are pure (6.2), so nothing is
// ever invalidated (10.4) and every presented status equals its stored one.
//
// Certification: §CONF-READERS (P-10 in scope; the CONF-CORE product run
// deviation-free from test/fixtures/conf-readers/bin.mjs) and
// VIOL-READERS-CLAIM (bin-claim.mjs: each reader holds a claim, an entry in
// the lock directory, through a sustained interval spanning a later
// command's start-up), which fails P-10 at a refusal alone: a command
// started while a claiming reader runs, refused `workspace-busy` at its
// acquisition. Both lock-path inspections wait for the episode's readers to
// exit, by when every claim is gone, so the certification rests on the
// schedules starting commands while readers run — certifying that they do:
// a harness whose schedules never started a command while a reader runs
// would pass P-10 against the violator (a red check confirmed it, every
// pre-start reader awaited to exit before its command started and an
// unheld command's straddle reads started only once the command's entry
// stood). The workspace is fixed (one importless spec file and the audit
// session `s` — no baseline, no git, T10.6-1): P-10's search space is the
// schedule; workspace shapes belong to P-1…P-9. Leads, kill fractions, and
// every other delay are choreography only, never an assertion input (H-10):
// every assertion holds for a conforming product under every timing (E-5).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type {
  ItemStatus,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  collectGraphDataFiles,
  decodeSessionListReport,
  decodeSessionStatusReport,
  GRAPH_DATA_AREA_PATH,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  bytesEqual,
  describeByteDifference,
  fail,
} from "../../helpers/assertions.js";
import {
  applyReuseCheck,
  readListedProcess,
  runVoidableTrial,
} from "../../helpers/kill-discipline.js";
import { isLockPathBytes } from "../../helpers/lock-path.js";
import {
  assertLockDirectoryEntries,
  assertLockPathAbsent,
} from "../../helpers/lock-state.js";
import type { PolledState } from "../../helpers/path-poller.js";
import {
  ABSENT_STATE,
  describePolledState,
  PathPoller,
  polledStateKey,
  readPolledState,
} from "../../helpers/path-poller.js";
import type { Choices, Gen } from "../../helpers/property.js";
import { checkProperty, listOf } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type {
  DirectorySnapshot,
  SnapshotEntry,
} from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  describeEntry,
  describeEntryDifference,
  diffSnapshots,
  displaySnapshotPath,
  snapshotDirectory,
  snapshotKeyBytes,
} from "../../helpers/snapshot.js";
import type {
  KilledGroup,
  ProductBinding,
  RunGuards,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  DEFAULT_WAIT_FOR_FILE_TIMEOUT_MS,
  releaseHoldFile,
  rethrowHarnessError,
  runProduct,
  startProduct,
  summarizeResult,
} from "../../helpers/subprocess.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import { copyTreeBytes } from "../../helpers/tree-copy.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  buildOk,
  expectErrorDocument,
  expectExit,
  runJson,
} from "./support.js";
import { startHeldAndLift } from "./write-refusal-staging.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. Audit
// sessions need no code group and no git (SPEC 10.6).
// A TypeScript staged-source record (helpers/staged-ts.ts; S-9's TypeScript
// and timing clauses), well-formed: every trial stages it afresh, from the
// second trial on after the body's first product invocation — an initial
// file S-7's sweep never reaches, so the ledger self-test judges it before
// any product exists.
const SPECS_ONLY_CONFIG = stagedTs(
  "P-10 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

/**
 * S-9's fixed TypeScript form-vector set (TEST-SPEC 17 S-9; the §16
 * preamble): the property's one configuration file, the record above — judged
 * as a record by test/self/s9-staged-sources.test.ts too, and here beside
 * every generated configuration and code source
 * (test/self/s9-typescript-well-formedness.test.ts); P-10 composes no code
 * source.
 */
export const P10_TS_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, path: string, source: string | Uint8Array]
> = [
  [
    "P-10 configuration (SPECS_ONLY_CONFIG)",
    "xspec.config.ts",
    SPECS_ONLY_CONFIG.source,
  ],
];

// The fixed initial spec file (module header): importless and tagless, one
// top-level section with a child plus a second top-level leaf — the audit
// session holds four items (file root, `a`, `a.k`, `g`; SPEC 10.6) with a
// non-trivial `blockedBy` chain, and both `a` and `g` are rename targets: a
// workspace of CONF-CORE's shapes (§CONF-READERS' staging constraint).
// A staged-source record (helpers/staged-mdx.ts): every trial stages it
// afresh, from the second trial on after the body's first product invocation
// — an initial file S-7's sweep never reaches, so the ledger self-test judges
// it before any product exists (S-9).
const INITIAL_SOURCE_REL = "specs/A.mdx";
const INITIAL_TOP_IDS = ["a", "g"] as const;
const A_MDX = stagedMdx(
  "P-10 specs/A.mdx",
  [
    '<S id="a">',
    "Alpha text.",
    '<S id="a.k">',
    "Kid text.",
    "</S>",
    "</S>",
    "",
    '<S id="g">',
    "Gamma text.",
    "</S>",
    "",
  ].join("\n"),
);

const SESSION_NAME = "s";
const JOURNAL_REL = ".xspec/journal";
const SESSION_DIRECTORY_REL = ".xspec/reviews";
const SESSION_REL = `${SESSION_DIRECTORY_REL}/${SESSION_NAME}.json`;
const WORKSPACE_BUSY = "workspace-busy";

/** `NAME.mdx` generates `NAME.xspec.ts` beside it (SPEC 13.1). */
function moduleRelOf(sourceRel: string): string {
  return `${sourceRel.slice(0, -".mdx".length)}.xspec.ts`;
}

// ---------------------------------------------------------------------------
// Schedule model and generator

/** Statuses `resolve --status` accepts (SPEC 10.7). */
export type ResolveStatus = "no-change" | "skipped" | "updated";
const RESOLVE_STATUSES: readonly ResolveStatus[] = [
  "no-change",
  "skipped",
  "updated",
];

/**
 * How an episode's mutating command ends (module header): run to its end,
 * killed while held, or killed past its hold.
 */
export type P10Fate = "complete" | "heldKill" | "pastHoldKill";

/**
 * The concurrent-read menu (module header): CONF-CORE's read commands
 * (§CONF-READERS), fixed valid argv. `build` is left out: its module and
 * companion writes, and its graph data recording the derived files it
 * generates — a record no refresh writes (13.3) — legitimate beside a
 * mutating command under 13.5's last-write-wins, would add states the
 * polling reader's oracle does not enumerate.
 */
const READ_MENU: readonly {
  readonly argv: readonly string[];
  readonly what: string;
}[] = [
  { argv: ["check"], what: "`check`" },
  { argv: ["ids", "--json"], what: "`ids --json`" },
  { argv: ["query", "nodes"], what: "`query nodes`" },
  {
    argv: ["review", "status", SESSION_NAME, "--json"],
    what: `\`review status ${SESSION_NAME} --json\``,
  },
  { argv: ["review", "list", "--json"], what: "`review list --json`" },
];

/**
 * How long before the mutating command a pre-start reader starts, in ms —
 * choreography only, never an assertion input (H-10). A reader's own
 * start-up (65–92 ms from its start to the acquisition of a command started
 * once it is confirmed running, CONF-CORE on an idle machine) overlaps the
 * command's start at every lead, so a longer lead only puts the reader
 * further into its run as the command starts.
 */
const PRE_READER_LEADS_MS = [0, 25, 60] as const;

/**
 * The fixed fractions of a twin's lift-to-exit span at which past-the-hold
 * kills land, each after its own run's lift — T13.5-3's rule and spread
 * (E-5), drawn per episode.
 */
const PAST_THE_HOLD_KILL_FRACTIONS = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];

/** A pre-start reader: its menu read and its lead. */
export interface PreReader {
  readonly menuIndex: number;
  readonly leadMs: number;
}

interface EpisodeShape {
  readonly fate: P10Fate;
  /** Held at the seam (always, but where the command runs to its end). */
  readonly held: boolean;
  /** Past-the-hold kills only: the fraction of the twin's span; else 0. */
  readonly killFraction: number;
  /** At least one; started before the command at their leads. */
  readonly preReaders: readonly PreReader[];
  /** Indices into READ_MENU, run to completion while the command holds. */
  readonly heldReads: readonly number[];
  /** Indices into READ_MENU, started just before the lift or the kill. */
  readonly straddleReads: readonly number[];
}

export type P10Episode =
  | ({
      readonly kind: "resolve";
      readonly rank: number;
      readonly status: ResolveStatus;
    } & EpisodeShape)
  | ({
      readonly kind: "rename";
      readonly file: string;
      readonly oldId: string;
      readonly newId: string;
    } & EpisodeShape)
  | ({
      readonly kind: "move";
      readonly from: string;
      readonly to: string;
    } & EpisodeShape);

export interface P10Trial {
  readonly episodes: readonly P10Episode[];
}

const MIN_EPISODES = 2;
const MAX_EPISODES = 5;

const genReadSet: Gen<readonly number[]> = listOf(
  (c: Choices) => c.intInclusive(0, READ_MENU.length - 1),
  { max: 2 },
);

const genPreReaders: Gen<readonly PreReader[]> = listOf(
  (c: Choices) => ({
    menuIndex: c.intInclusive(0, READ_MENU.length - 1),
    leadMs: c.pick(PRE_READER_LEADS_MS),
  }),
  { min: 1, max: 3, continueProbability: 0.5 },
);

/** The trial generator (module header). Exported for dry-run instrumentation. */
export const genP10Trial: Gen<P10Trial> = (choices) => {
  // The evolving concretization model: the single spec file's current path
  // and top-level IDs. Mutated only by renames and moves the model applies
  // (completed or killed past the hold — module header), so the body's
  // execution reproduces it exactly.
  let filePath = INITIAL_SOURCE_REL;
  const topIds: string[] = [...INITIAL_TOP_IDS];
  let fresh = 1;

  const genEpisode = (): P10Episode => {
    const preReaders = genPreReaders(choices);
    const heldReads = genReadSet(choices);
    const straddleReads = genReadSet(choices);
    // Simplest first (shrinking): a resolve run to its end, unheld.
    const kind = choices.weightedPick<"resolve" | "rename" | "move">([
      [3, "resolve"],
      [3, "rename"],
      [2, "move"],
    ]);
    // Kill-leaning weights for `move` (only a handful of move episodes
    // occur across the fixed trial set, and these weights let it hold every
    // kind with every fate — a dry run over the committed seeds confirmed
    // it; weights shape generation only, never replay, so shrinking still
    // prefers the first-listed `complete`).
    const fate = choices.weightedPick<P10Fate>([
      [kind === "move" ? 2 : 3, "complete"],
      [kind === "move" ? 4 : 2, "heldKill"],
      [kind === "move" ? 2 : 3, "pastHoldKill"],
    ]);
    const held = fate !== "complete" || choices.boolean(0.6);
    const killFraction =
      fate === "pastHoldKill" ? choices.pick(PAST_THE_HOLD_KILL_FRACTIONS) : 0;
    const shape: EpisodeShape = {
      fate,
      held,
      killFraction,
      preReaders,
      heldReads: held ? heldReads : [],
      straddleReads,
    };
    if (kind === "resolve") {
      return {
        kind,
        rank: choices.intInclusive(0, 7),
        status: choices.weightedPick<ResolveStatus>([
          [2, "no-change"],
          [2, "updated"],
          [1, "skipped"],
        ]),
        ...shape,
      };
    }
    const applied = fate !== "heldKill";
    if (kind === "rename") {
      const index = choices.intInclusive(0, topIds.length - 1);
      const oldId = topIds[index];
      const newId = `r${String(fresh)}`;
      fresh += 1;
      if (applied) topIds[index] = newId;
      return { kind, file: filePath, oldId, newId, ...shape };
    }
    const from = filePath;
    const to = `specs/M${String(fresh)}.mdx`;
    fresh += 1;
    if (applied) filePath = to;
    return { kind, from, to, ...shape };
  };

  const episodes: P10Episode[] = [];
  do {
    episodes.push(genEpisode());
  } while (
    episodes.length < MIN_EPISODES ||
    (episodes.length < MAX_EPISODES && choices.boolean(0.65))
  );
  return { episodes };
};

function describeReads(episode: P10Episode): string {
  const names = (indices: readonly number[]): string =>
    indices.map((i) => READ_MENU[i].what).join(", ");
  const pre = episode.preReaders
    .map(
      (reader) =>
        `${READ_MENU[reader.menuIndex].what}@-${String(reader.leadMs)}ms`,
    )
    .join(", ");
  const held =
    episode.heldReads.length > 0 ? ` held:[${names(episode.heldReads)}]` : "";
  const straddle =
    episode.straddleReads.length > 0
      ? ` straddle:[${names(episode.straddleReads)}]`
      : "";
  return ` pre:[${pre}]${held}${straddle}`;
}

function describeFate(episode: P10Episode): string {
  const seam = episode.held ? "held" : "unheld";
  return episode.fate === "pastHoldKill"
    ? `${seam}, pastHoldKill at ${String(episode.killFraction)} of the twin's span`
    : `${seam}, ${episode.fate}`;
}

function describeEpisode(episode: P10Episode): string {
  switch (episode.kind) {
    case "resolve":
      return (
        `resolve rank ${String(episode.rank)} --status ${episode.status} ` +
        `(${describeFate(episode)})${describeReads(episode)}`
      );
    case "rename":
      return (
        `rename ${episode.file} ${episode.oldId}->${episode.newId} ` +
        `(${describeFate(episode)})${describeReads(episode)}`
      );
    case "move":
      return (
        `move ${episode.from} -> ${episode.to} ` +
        `(${describeFate(episode)})${describeReads(episode)}`
      );
  }
}

/** Compact counterexample rendering; seed replay reconstructs the rest. */
export function renderP10Trial(trial: P10Trial): string {
  return JSON.stringify(trial.episodes.map(describeEpisode));
}

// ---------------------------------------------------------------------------
// Read commands beside a mutating command

/**
 * Run one menu read to completion under the driver's hang guard, converting
 * a rejection (a hang, killed at the guard) into a diagnosed failure (H-8).
 * A harness error — an exhausted capture limit, a failure of the driver's
 * in-run evaluation (T6.5-22(a)'s check, which a menu read never prepares)
 * — is never converted: it propagates out of the property body as itself,
 * and `checkProperty` reports it with the seed (H-11). `guards` lower the
 * hang guard or the capture limit for S-8's vector alone.
 */
export async function runHeldRead(
  product: ProductBinding,
  cwd: string,
  menuIndex: number,
  context: string,
  guards: RunGuards = {},
): Promise<void> {
  const read = READ_MENU[menuIndex];
  let result: RunResult;
  try {
    result = await runProduct(product, { cwd, argv: read.argv, ...guards });
  } catch (error) {
    rethrowHarnessError(error);
    return fail(
      `${context} ${read.what}: a read command must run and terminate while ` +
        `a mutating command is held (SPEC 13.5; H-8) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assertExitCode(
    result,
    0,
    `${context} ${read.what}: read commands still run while a mutating ` +
      `command is held, and the workspace is valid, built, and unmodified ` +
      `while held, so the read succeeds (SPEC 13.5, 13.3)`,
  );
}

/** A read command started beside a mutating command. */
export interface StraddleRead {
  readonly running: RunningProduct;
  readonly what: string;
}

/**
 * Await a read started beside a mutating command — a pre-start reader or a
 * straddle read: terminated, no signal death, exit 0 or 1. A rejected run
 * fails diagnosed (H-8), except a harness error — an exhausted capture
 * limit, a failure of the driver's in-run evaluation — which propagates as
 * itself (H-11).
 */
export async function settleStraddleRead(
  read: StraddleRead,
  context: string,
): Promise<void> {
  let result: RunResult;
  try {
    result = await read.running.waitForExit();
  } catch (error) {
    rethrowHarnessError(error);
    return fail(
      `${context} ${read.what}, run beside a mutating command: a read ` +
        `command running across a mutating command's acquisition or ` +
        `commit window must terminate (SPEC 13.5; H-8: hangs are ` +
        `failures) — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    result.signal !== null ||
    (result.exitCode !== 0 && result.exitCode !== 1)
  ) {
    fail(
      `${context} ${read.what}, run beside a mutating command: a read ` +
        `overlapping a commit may see transient states (a moving file at ` +
        `neither or both paths), so exit 1 is legitimate — but never a ` +
        `crash or any other code: argv and configuration are fixed valid ` +
        `(SPEC 13.5, 12.0); got ${summarizeResult(result)}`,
    );
  }
}

async function startRead(
  product: ProductBinding,
  cwd: string,
  menuIndex: number,
): Promise<StraddleRead> {
  const read = READ_MENU[menuIndex];
  return {
    running: await startProduct(product, { cwd, argv: read.argv }),
    what: read.what,
  };
}

/**
 * Whether a started read has not exited: its exit unseen and its process
 * listed in the process list, never a zombie (helpers/kill-discipline.ts
 * `readListedProcess`).
 */
async function stillRunning(read: StraddleRead): Promise<boolean> {
  if (read.running.hasExited()) return false;
  const pid = read.running.pid;
  if (pid === undefined) return false;
  const listed = await readListedProcess(pid);
  return (
    listed !== undefined && listed.state !== "Z" && !read.running.hasExited()
  );
}

/**
 * At most this many further reads are started, one at a time, where none
 * of an episode's pre-start readers is confirmed running as its command is
 * to start; none confirmed then is a harness error (H-11) — a read runs far
 * longer than the instant between its start and that check.
 */
const EXTRA_PRE_START_READS = 3;

/**
 * Start an episode's pre-start readers, each its lead before the command
 * (in descending lead order, the harness sleeping the differences), and
 * confirm — immediately before the command starts — that at least one has
 * not exited (TEST-SPEC P-10: "the harness confirming, before starting it,
 * that they have not exited"), starting another where none has. Returns
 * every read started and how many were confirmed running.
 */
async function startPreReaders(
  product: ProductBinding,
  cwd: string,
  episode: P10Episode,
  context: string,
): Promise<{ readonly reads: StraddleRead[]; readonly confirmed: number }> {
  const ordered = [...episode.preReaders].sort((a, b) => b.leadMs - a.leadMs);
  const reads: StraddleRead[] = [];
  for (const [index, reader] of ordered.entries()) {
    reads.push(await startRead(product, cwd, reader.menuIndex));
    const gap = reader.leadMs - (ordered[index + 1]?.leadMs ?? 0);
    if (gap > 0) await sleep(gap);
  }
  let confirmed = 0;
  for (const read of reads) {
    if (await stillRunning(read)) confirmed += 1;
  }
  for (let extra = 0; confirmed === 0; extra += 1) {
    if (extra >= EXTRA_PRE_START_READS) {
      throw new Error(
        `harness error (H-11): ${context}: no pre-start reader could be ` +
          `confirmed running as the mutating command was to start, after ` +
          `${String(EXTRA_PRE_START_READS)} further reads — P-10 starts its ` +
          `commands while readers run (TEST-SPEC P-10)`,
      );
    }
    const read = await startRead(product, cwd, ordered[0].menuIndex);
    reads.push(read);
    if (await stillRunning(read)) confirmed = 1;
  }
  return { reads, confirmed };
}

// ---------------------------------------------------------------------------
// The mutating command's run

/**
 * Await a mutating command's exit. A rejected run — a hang, killed at the
 * guard — fails diagnosed (H-8), except a harness error — an exhausted
 * capture limit, a failure of the driver's in-run evaluation (T6.5-22(a)'s
 * check of a performed move) — which propagates as itself (H-11). Shared
 * with S-8's capacity vectors.
 */
export async function settleMutatingRun(
  running: RunningProduct,
  context: string,
): Promise<RunResult> {
  try {
    return await running.waitForExit();
  } catch (error) {
    rethrowHarnessError(error);
    return fail(
      `${context}: the mutating command must end on its own (SPEC 13.5; ` +
        `H-8) — ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Kill a mutating command under T13.5-3's exit-collection discipline
 * (`RunningProduct.killGroup`: the whole group SIGKILLed, the started
 * process's exit collected, no process of the group listed), converting a
 * rejection into a diagnosed failure but a harness error (H-8, H-11).
 */
async function killMutatingRun(
  running: RunningProduct,
  context: string,
): Promise<KilledGroup> {
  try {
    return await running.killGroup();
  } catch (error) {
    rethrowHarnessError(error);
    return fail(
      `${context}: the run must end on its own or by the kill, its exit ` +
        `collected (SPEC 13.5; H-8) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Await a held command's hold file — true once it appears — or the
 * command's exit before it — false (a refusal at acquisition, judged as any
 * run's end). Neither within the driver's hold-file bound fails diagnosed
 * (H-8).
 */
async function holdsOrExits(
  running: RunningProduct,
  hold: string,
  context: string,
): Promise<boolean> {
  const deadline = Date.now() + DEFAULT_WAIT_FOR_FILE_TIMEOUT_MS;
  for (;;) {
    // Found holding, the run waits on the harness from here: its own hang
    // guard stands suspended until its hold is lifted (TEST-SPEC S-3).
    if (await running.holdFileStands(hold)) return true;
    if (running.hasExited()) return false;
    if (Date.now() >= deadline) {
      fail(
        `${context}: the mutating command neither created its hold file ` +
          `nor exited within ${String(DEFAULT_WAIT_FOR_FILE_TIMEOUT_MS)} ms ` +
          `— it creates the hold file immediately after acquiring workspace ` +
          `exclusivity, or is refused there promptly (SPEC 13.5; H-8)`,
      );
    }
    await sleep(5);
  }
}

// ---------------------------------------------------------------------------
// What P-10 compares: sources, the journal, and session files

/**
 * SPEC 10.1's session-name form: one or more ASCII letters, digits, `.`,
 * `_`, and `-`, never beginning with `.`.
 */
const SESSION_NAME_FORM = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/**
 * Whether a snapshot key names a session (SPEC 10.1): an entry directly
 * under the session directory named `<session-name>.json` with a valid
 * session name, whatever its kind (one that is not a plain file is a corrupt
 * session, 10.1, 13.4 — still a session). Keys are latin1-decoded byte
 * paths, so a name holding any byte outside 10.1's ASCII characters fails
 * the form, as it does in 10.1.
 */
function isSessionKey(key: string): boolean {
  const prefix = `${SESSION_DIRECTORY_REL}/`;
  if (!key.startsWith(prefix) || !key.endsWith(".json")) return false;
  return SESSION_NAME_FORM.test(
    key.slice(prefix.length, key.length - ".json".length),
  );
}

/**
 * Whether a snapshot key is among what P-10 compares with a twin and judges
 * a killed run by — sources (and the configuration), the journal, and the
 * session files (TEST-SPEC P-10): under `.xspec/`, exactly the journal and
 * SPEC 10.1's sessions (isSessionKey), the area's and the session
 * directory's own entries aside; elsewhere, everything but a derived file,
 * whose name carries `.xspec.` (SPEC 13.1), the directories holding sources
 * included. Any other entry in the session directory is no session and is
 * ignored by every command (10.1) — the temporary entry an atomic session
 * write leaves when a kill lands before its rename among them — so it is
 * neither compared with a twin nor counted as a write beside a command's
 * own files. Graph data and derived files, which readers' refreshes may
 * rewrite last-write-wins (13.3, 13.5), are left out, and so is the lock
 * path (H-6).
 */
function isComparedKey(key: string): boolean {
  if (key === ".xspec") return false;
  if (key.startsWith(".xspec/")) {
    return key === JOURNAL_REL || isSessionKey(key);
  }
  return !path.posix.basename(key).includes(".xspec.");
}

/** A snapshot's view holding only what P-10 compares (isComparedKey). */
function comparedView(snapshot: DirectorySnapshot): DirectorySnapshot {
  const entries = new Map<string, SnapshotEntry>();
  for (const [key, entry] of snapshot.entries) {
    if (isComparedKey(key)) entries.set(key, entry);
  }
  return { ...snapshot, entries };
}

/** The compared keys at which two views hold different byte states. */
function differingKeys(
  first: DirectorySnapshot,
  second: DirectorySnapshot,
): string[] {
  const keys = new Set([...first.entries.keys(), ...second.entries.keys()]);
  return [...keys].sort().filter((key) => {
    const a = first.entries.get(key);
    const b = second.entries.get(key);
    if (a === undefined || b === undefined) return a !== b;
    return describeEntryDifference(a, b) !== undefined;
  });
}

function fileBytesAt(view: DirectorySnapshot, rel: string): Uint8Array | null {
  const entry = view.entries.get(rel);
  return entry?.kind === "file" ? entry.bytes : null;
}

/**
 * Journal entries in a journal's bytes: one entry per line (SPEC 6.1). The
 * line terminator is not byte-pinned by 6.1 (H-4: line-oriented form only),
 * so an unterminated final line still counts.
 */
function journalEntryCount(bytes: Uint8Array | null): number {
  if (bytes === null || bytes.length === 0) return 0;
  let lines = 0;
  for (const byte of bytes) {
    if (byte === 0x0a) lines += 1;
  }
  if (bytes[bytes.length - 1] !== 0x0a) lines += 1;
  return lines;
}

function isPrefix(prefix: Uint8Array, whole: Uint8Array): boolean {
  return (
    prefix.length <= whole.length &&
    bytesEqual(whole.subarray(0, prefix.length), prefix)
  );
}

/**
 * The journal a run left against the one it started with: the start's
 * bytes a prefix of the end's, and `appended` entries more — or, where
 * `appended` is "at most one", none or one (SPEC 6.1: append-only, one
 * self-contained entry per journaled operation; TEST-SPEC P-10).
 */
function assertJournalAppended(
  start: DirectorySnapshot,
  end: DirectorySnapshot,
  appended: 0 | 1 | "at most one",
  context: string,
): void {
  const before = fileBytesAt(start, JOURNAL_REL) ?? new Uint8Array(0);
  const after = fileBytesAt(end, JOURNAL_REL) ?? new Uint8Array(0);
  if (!isPrefix(before, after)) {
    fail(
      `${context}: the journal is append-only — the bytes it held as the ` +
        `command started must be a prefix of those it holds as it ends ` +
        `(SPEC 6.1)\n` +
        describeByteDifference(after, before, "as it ended", "as it started"),
    );
  }
  const added = journalEntryCount(after) - journalEntryCount(before);
  const allowed = appended === "at most one" ? [0, 1] : [appended];
  if (!allowed.includes(added)) {
    fail(
      `${context}: mutual exclusion never loses a journal append — ` +
        `\`rename\` and \`move\` are the journal's only writers (SPEC 6.1), ` +
        `each exiting 0 adding exactly one entry and each killed one at ` +
        `most one (TEST-SPEC P-10) — expected ` +
        `${appended === "at most one" ? "0 or 1" : String(appended)} ` +
        `entr${appended === 1 ? "y" : "ies"} added, found ${String(added)}`,
    );
  }
}

/**
 * The walk's exclusion for a compared snapshot: everything isComparedKey
 * leaves out is pruned before it is examined — the area walked only for the
 * journal and the session directory, the session directory only for its
 * sessions — so a snapshot taken while readers still run never meets a
 * refresh's transient files, nor reads anything under the lock path, nor
 * any entry in the session directory that is no session (SPEC 10.1).
 */
function excludeUncompared(relPathBytes: Uint8Array): boolean {
  const key = Buffer.from(relPathBytes).toString("latin1");
  return (
    key !== ".xspec" && key !== SESSION_DIRECTORY_REL && !isComparedKey(key)
  );
}

/** The compared view of the workspace at `root`, taken now. */
async function comparedSnapshot(root: string): Promise<DirectorySnapshot> {
  return comparedView(
    await snapshotDirectory(root, { exclude: excludeUncompared }),
  );
}

/** Snapshot keys rendered for a diagnosis, at most ten. */
function renderKeys(keys: readonly string[]): string {
  const shown = keys.slice(0, 10).map(displaySnapshotPath);
  if (keys.length > shown.length) {
    shown.push(`… and ${String(keys.length - shown.length)} more`);
  }
  return shown.join(", ");
}

// ---------------------------------------------------------------------------
// The reader-free twin

/** A command's reader-free twin (module header). */
interface EpisodeTwin {
  /** The twin's workspace, holding its final state. */
  readonly workspace: TestWorkspace;
  /** Its run: exit 0. */
  readonly result: RunResult;
  /** The compared view of the copy as the twin started — the command's own start. */
  readonly start: DirectorySnapshot;
  /** The compared view once the twin ended. */
  readonly final: DirectorySnapshot;
  /** A held twin's span from its lift to its exit, in ms; 0 unheld. */
  readonly spanMs: number;
}

/**
 * The reader-free twin of a command about to start on `from` (TEST-SPEC
 * P-10: "a reader-free twin copied from the workspace, the lock path aside,
 * as it starts"): `from` copied byte for byte into a fresh workspace, the
 * lock path left out unread (a difference from `from`, lock path aside, a
 * harness error), and `argv` run there with no reader beside it — held,
 * lifted as soon as its hold file appears, and its lift-to-exit span
 * measured, where the command is held (T13.5-3's twin), else unheld. Nothing
 * writes `from`'s sources, journal, or session files between the copy and
 * the command's start (only mutating commands do, and the command is the
 * episode's one), so the copy is the command's start for every compared
 * path. The twin is an operation valid by construction (the module header's
 * validity discipline; §CONF-READERS' staging constraint): it exits 0, and
 * `.xspec/lock` is absent once it ends (13.5: release on every normal end).
 * The caller owns the returned workspace.
 */
async function runTwin(
  product: ProductBinding,
  from: TestWorkspace,
  argv: readonly string[],
  held: boolean,
  context: string,
): Promise<EpisodeTwin> {
  const copy = await TestWorkspace.create({});
  try {
    await copyTreeBytes(
      Buffer.from(from.root),
      Buffer.from(copy.root),
      isLockPathBytes,
    );
    const source = await snapshotDirectory(from.root);
    const copied = await snapshotDirectory(copy.root);
    const differences = diffSnapshots(source, copied);
    if (differences.length > 0) {
      throw new Error(
        `harness error: ${context}: the twin's copy of ${from.root} at ` +
          `${copy.root} differs from it (the lock path aside): ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    let result: RunResult;
    let spanMs = 0;
    if (held) {
      const { running, liftedAt } = await startHeldAndLift(
        product,
        copy,
        argv,
        "hold-twin.tmp",
        `${context} (held, then lifted)`,
      );
      try {
        result = await running.waitForExit();
      } catch (error) {
        await running.killGroup().catch((kill: unknown) => {
          rethrowHarnessError(kill);
        });
        rethrowHarnessError(error);
        return fail(
          `${context}: once its hold is lifted the twin must proceed and ` +
            `end on its own (SPEC 13.5; H-8) — ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
      spanMs = performance.now() - liftedAt;
    } else {
      try {
        result = await runProduct(product, { cwd: copy.root, argv });
      } catch (error) {
        rethrowHarnessError(error);
        return fail(
          `${context}: the twin must end on its own (SPEC 13.5; H-8) — ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    assertExitCode(
      result,
      0,
      `${context}: the operation is valid by construction — an existing ` +
        `target, a fresh name or destination, an unblocked item with a ` +
        `new status — so with no reader beside it it succeeds (SPEC 13.5, ` +
        `6.4, 6.5, 10.7)`,
    );
    await assertLockPathAbsent(
      copy.root,
      `${context}: once the twin has ended (SPEC 13.5: release on every ` +
        `normal end; T13.5-11)`,
    );
    return {
      workspace: copy,
      result,
      start: comparedView(copied),
      final: await comparedSnapshot(copy.root),
      spanMs,
    };
  } catch (error) {
    await copy.dispose();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Quiescent accounting reads

/** Bracket a quiescent product read: journal and session bytes untouched. */
async function bracketedQuiescentRead<T>(
  workspace: TestWorkspace,
  body: () => Promise<T>,
  context: string,
): Promise<T> {
  const journalBefore = await readPolledState(workspace.path(JOURNAL_REL));
  const sessionBefore = await readPolledState(workspace.path(SESSION_REL));
  const value = await body();
  const journalAfter = await readPolledState(workspace.path(JOURNAL_REL));
  const sessionAfter = await readPolledState(workspace.path(SESSION_REL));
  if (polledStateKey(journalBefore) !== polledStateKey(journalAfter)) {
    fail(
      `${context}: the read changed ${JOURNAL_REL} from ` +
        `${describePolledState(journalBefore)} to ` +
        `${describePolledState(journalAfter)} — the journal is written only ` +
        `by \`rename\` and \`move\` (SPEC 6.1, 13.4), so P-10's journal ` +
        `accounting requires reads to leave it untouched`,
    );
  }
  if (polledStateKey(sessionBefore) !== polledStateKey(sessionAfter)) {
    fail(
      `${context}: the read changed ${SESSION_REL} — reads never write the ` +
        `session file (SPEC 10.4, 13.5), so P-10's status accounting ` +
        `requires reads to leave it untouched`,
    );
  }
  return value;
}

/** The status ledger: expected stored status per item ID (module header). */
interface StatusLedger {
  /** Item IDs learned at the post-`create` read; never changes after. */
  ids: readonly string[];
  readonly expected: Map<string, ItemStatus>;
  /**
   * A resolve killed past its hold whose landing the next quiescent read
   * adopts: its target's status is the prior one or the attempted one.
   */
  pendingKill: { readonly id: string; readonly status: ResolveStatus } | null;
}

/**
 * The quiescent accounting read (module header): `review status --json`,
 * bracketed, exit 0, decoded; the item-ID set must equal the created set and
 * every status must match the ledger — a lost resolution (or a phantom one,
 * an invalidation, a lost or duplicated item) fails here. It also refreshes
 * graph data a reader's refresh left stale (13.3), so every episode starts
 * on fresh graph data.
 */
async function accountingRead(
  product: ProductBinding,
  workspace: TestWorkspace,
  ledger: StatusLedger,
  context: string,
): Promise<SessionStatusReport> {
  const label = `${context} — quiescent \`review status ${SESSION_NAME} --json\``;
  const report = decodeSessionStatusReport(
    await bracketedQuiescentRead(
      workspace,
      () =>
        runJson(
          product,
          workspace,
          ["review", "status", SESSION_NAME, "--json"],
          label,
        ),
      label,
    ),
    label,
  );

  const observedIds = report.items.map((row) => row.id).sort();
  const expectedIds = [...ledger.ids].sort();
  if (JSON.stringify(observedIds) !== JSON.stringify(expectedIds)) {
    fail(
      `${label}: the item-ID set must never change after \`create\` in ` +
        `these schedules — no edits happen, completed renames/moves are ` +
        `pure and identity mappings duplicate no item (SPEC 6.2, 10.4), ` +
        `and re-derivation over the unchanged workspace matches every ` +
        `existing item (SPEC 10.5) — expected ` +
        `${JSON.stringify(expectedIds)}, got ${JSON.stringify(observedIds)}`,
    );
  }

  for (const row of report.items) {
    const expected = ledger.expected.get(row.id);
    if (expected === undefined) {
      throw new Error(`P-10 harness defect: no expectation for item ${row.id}`);
    }
    if (ledger.pendingKill !== null && ledger.pendingKill.id === row.id) {
      const attempted = ledger.pendingKill.status;
      if (row.status !== expected && row.status !== attempted) {
        fail(
          `${label}: item ${row.id} was the target of a resolve killed ` +
            `past its hold, so its stored status is exactly two-valued — ` +
            `the prior ${JSON.stringify(expected)} (the kill landed first) ` +
            `or the attempted ${JSON.stringify(attempted)} (the write ` +
            `landed first); atomic visibility excludes anything else (SPEC ` +
            `13.5, 10.7) — got ${JSON.stringify(row.status)}`,
        );
      }
      ledger.expected.set(row.id, row.status);
      continue;
    }
    if (row.status !== expected) {
      fail(
        `${label}: item ${row.id} must hold the status of its last ` +
          `completed resolve — mutual exclusion never loses a resolution, ` +
          `nothing in these schedules invalidates (SPEC 13.5, 6.2, 10.4), ` +
          `and presented statuses equal stored statuses — expected ` +
          `${JSON.stringify(expected)}, got ${JSON.stringify(row.status)}`,
      );
    }
  }
  ledger.pendingKill = null;
  return report;
}

/**
 * Pick the drawn resolve target from the last quiescent status rows: the
 * rank-picked unblocked item (SPEC 10.7 refuses blocked targets; re-resolving
 * a resolved item is valid). Nothing runs between that read and the resolve
 * but its twin, on a copy.
 */
function resolveTarget(
  rows: readonly SessionStatusRow[],
  rank: number,
  context: string,
): SessionStatusRow {
  const unblocked = rows.filter((row) => !row.blocked);
  if (unblocked.length === 0) {
    fail(
      `${context}: no unblocked item to resolve — the audit session always ` +
        `holds items here, and with acyclic blockedBy some item's blockers ` +
        `are all resolved (SPEC 10.1, 10.3, 10.6), so a non-empty session ` +
        `with zero unblocked items violates the blocking contract (got ` +
        `${String(rows.length)} items, all reported blocked)`,
    );
  }
  return unblocked[rank % unblocked.length];
}

/**
 * The status a resolve records: the drawn one, unless the target already
 * holds it — then the next in RESOLVE_STATUSES — so that every resolve
 * changes the session file, and a resolve killed while held always leaves
 * it short of its twin's (module header).
 */
function newStatusFor(
  drawn: ResolveStatus,
  current: ItemStatus,
): ResolveStatus {
  if (drawn !== current) return drawn;
  const index = RESOLVE_STATUSES.indexOf(drawn);
  return RESOLVE_STATUSES[(index + 1) % RESOLVE_STATUSES.length];
}

// ---------------------------------------------------------------------------
// Episodes

/** What one trial's execution holds as its episodes run. */
interface TrialState {
  /** The workspace the schedule runs on; a twin's replaces it (module header). */
  workspace: TestWorkspace;
  /** The spec file's current path (the generator's model, reproduced). */
  currentFile: string;
  /**
   * Identifiers of the groups killed on this workspace since a command last
   * ran to its end there — what T13.5-3's reuse check looks for.
   */
  killed: number[];
  /** The last quiescent status read's rows. */
  rows: readonly SessionStatusRow[];
  readonly ledger: StatusLedger;
}

/** An episode's operation, made concrete at execution time. */
interface EpisodeOperation {
  /** Its arguments, `--json` included, `--test-hold` aside. */
  readonly argv: readonly string[];
  /** A resolve's target and the status it records; null otherwise. */
  readonly resolve: {
    readonly id: string;
    readonly status: ResolveStatus;
  } | null;
}

function operationOf(
  episode: P10Episode,
  state: TrialState,
  context: string,
): EpisodeOperation {
  switch (episode.kind) {
    case "resolve": {
      const target = resolveTarget(state.rows, episode.rank, context);
      const current = state.ledger.expected.get(target.id) ?? "unresolved";
      const status = newStatusFor(episode.status, current);
      return {
        argv: [
          "review",
          "resolve",
          SESSION_NAME,
          target.id,
          "--status",
          status,
          "--json",
        ],
        resolve: { id: target.id, status },
      };
    }
    case "rename":
      if (episode.file !== state.currentFile) {
        throw new Error(
          `P-10 harness defect: the generator's file model (${episode.file}) ` +
            `and the execution's (${state.currentFile}) diverged`,
        );
      }
      return {
        argv: ["rename", episode.file, episode.oldId, episode.newId, "--json"],
        resolve: null,
      };
    case "move":
      if (episode.from !== state.currentFile) {
        throw new Error(
          `P-10 harness defect: the generator's file model (${episode.from}) ` +
            `and the execution's (${state.currentFile}) diverged`,
        );
      }
      return {
        argv: ["move", episode.from, episode.to, "--json"],
        resolve: null,
      };
  }
}

/** An episode's spec sources: its current file and a move's destination. */
function episodeSourcesOf(episode: P10Episode, currentFile: string): string[] {
  return episode.kind === "move" ? [currentFile, episode.to] : [currentFile];
}

/**
 * The derived files beside a spec source in a workspace (SPEC 13.1): the
 * plain files — an lstat-kind file, never a link or a directory — in the
 * source's directory whose names begin with `NAME.xspec.`, `NAME` the
 * source's file name without `.mdx`: the generated module `NAME.xspec.ts`
 * and its companions, every companion named `NAME.xspec.` plus a suffix.
 * Returned as workspace-relative paths in byte order; none where the
 * directory is absent. Names are read as bytes, and a matching name that is
 * not valid UTF-8 is a harness error naming the limitation (the polling
 * reader reads string paths), never a silently unpolled path.
 */
async function derivedFilesBeside(
  workspace: TestWorkspace,
  sourceRel: string,
  context: string,
): Promise<string[]> {
  const directory = path.posix.dirname(sourceRel);
  const prefix = Buffer.from(
    `${path.posix.basename(sourceRel, ".mdx")}.xspec.`,
  );
  let names: Uint8Array[];
  try {
    names = await workspace.readdirBytes(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const rels: string[] = [];
  for (const name of names) {
    const bytes = Buffer.from(name);
    if (!bytes.subarray(0, prefix.length).equals(prefix)) continue;
    let decoded: string;
    try {
      decoded = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
    } catch {
      throw new Error(
        `harness error: ${context}: the entry <name bytes ` +
          `${bytes.toString("hex")}> beside ${sourceRel} in ` +
          `${workspace.root} has a derived file's name shape (\`` +
          `${prefix.toString("utf8")}\` plus a suffix, SPEC 13.1) but is ` +
          `not valid UTF-8 — the polling reader reads string paths, so ` +
          `P-10 cannot poll it`,
      );
    }
    const rel = directory === "." ? decoded : `${directory}/${decoded}`;
    if ((await workspace.kind(rel)) === "file") rels.push(rel);
  }
  return rels;
}

/**
 * The episode's polled paths (module header): the journal, the session
 * file, the spec source and a move's destination, their generated modules,
 * the companions beside them — `derivedRels`, the files beside each of
 * those sources named `NAME.xspec.` plus a suffix (SPEC 13.1;
 * derivedFilesBeside), listed from the workspace and from the twin's final
 * state before the episode starts (none for a product writing none) — and
 * graph data — `graphDataRels`, the plain files of T13.3-2's operational
 * path set, collected likewise (graphDataRelsOf) — added without
 * duplicates. The module stays named, so one absent from both listings is
 * still polled. These are every path the episode's command may write, never
 * the lock path: its one mutating command writes each module and companion
 * at most once (6.4, 6.5), and no reader writes one (13.3: a refresh
 * generates no TypeScript); graph data, which readers' refreshes write too,
 * is judged on its own terms (judgeGraphDataPath).
 */
function polledRelsOf(
  episode: P10Episode,
  currentFile: string,
  derivedRels: readonly string[],
  graphDataRels: readonly string[],
): string[] {
  const rels = [JOURNAL_REL, SESSION_REL];
  for (const source of episodeSourcesOf(episode, currentFile)) {
    rels.push(source, moduleRelOf(source));
  }
  for (const rel of [...derivedRels, ...graphDataRels]) {
    if (!rels.includes(rel)) rels.push(rel);
  }
  return rels;
}

// ---------------------------------------------------------------------------
// Graph data: its paths, and the product's own complete states for an episode

/**
 * The plain files of T13.3-2's operational path set in a workspace
 * (`collectGraphDataFiles`: every path under `.xspec/` but the durable
 * journal and reviews paths and the lock path with everything under it), as
 * snapshot keys in byte order — none where the graph-data area holds no
 * directory (absent, or anything else, under which nothing lies, 13.4).
 */
async function graphDataKeysIn(workspace: TestWorkspace): Promise<string[]> {
  if ((await workspace.kind(GRAPH_DATA_AREA_PATH)) !== "dir") return [];
  return await collectGraphDataFiles(workspace.root);
}

/**
 * An episode's graph-data paths (module header): the graph-data files
 * (graphDataKeysIn) of its workspace and of its twin's final one together,
 * listed once the twin has run and before the episode starts, in byte
 * order, each as the workspace-relative path string the polling reader
 * reads — the UTF-8 decoding of the key's exact bytes (`snapshotKeyBytes`),
 * an ASCII key the path itself. A name that is not valid UTF-8 is a harness
 * error naming the limitation (the polling reader reads string paths),
 * never a silently unpolled path: graph data's layout is the product's
 * (SPEC 13.3).
 */
async function graphDataRelsOf(
  workspaces: readonly TestWorkspace[],
  context: string,
): Promise<string[]> {
  const keys = new Set<string>();
  for (const listed of workspaces) {
    for (const key of await graphDataKeysIn(listed)) keys.add(key);
  }
  return [...keys].sort().map((key) => {
    const bytes = snapshotKeyBytes(key);
    try {
      return new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
    } catch {
      throw new Error(
        `harness error: ${context}: the graph-data file <path bytes ` +
          `${bytes.toString("hex")}> (T13.3-2's operational path set) is ` +
          `not named in valid UTF-8 — the polling reader reads string ` +
          `paths, so P-10 cannot poll it (SPEC 13.3 leaves graph data's ` +
          `layout to the product)`,
      );
    }
  });
}

/** The staged states of an episode's graph-data paths (stagedGraphDataStates). */
interface StagedGraphData {
  /** Each graph-data path's distinct staged states, by state key. */
  readonly states: ReadonlyMap<string, ReadonlyMap<string, PolledState>>;
  /** The staged workspaces run: one per combination. */
  readonly combinations: number;
}

/** What judges an episode's graph-data paths (judgeGraphDataPath). */
interface GraphDataOracle {
  /** Each graph-data path's state in the twin's final workspace. */
  readonly twinFinal: ReadonlyMap<string, PolledState>;
  /** The staged states, computed at the first call, at most once. */
  readonly staged: () => Promise<StagedGraphData>;
}

/**
 * The state a staged workspace gives a source path or the journal: its
 * state in a compared view of the twin — a plain file's bytes, or absence.
 * Anything else there fails diagnosed: every file xspec writes is a plain
 * file (SPEC 13.4), and P-10 stages those paths' plain-file and absent
 * states alone.
 */
function stagedStateAt(
  view: DirectorySnapshot,
  key: string,
  side: string,
  context: string,
): PolledState {
  const entry = view.entries.get(key);
  if (entry === undefined) return ABSENT_STATE;
  if (entry.kind === "file") return { kind: "content", bytes: entry.bytes };
  return fail(
    `${context}: ${displaySnapshotPath(key)} ${side} is ` +
      `${describeEntry(entry)} — every file xspec writes is a plain file ` +
      `(SPEC 13.4), so the states P-10 stages for the graph data a reader ` +
      `meets are a source's and the journal's plain-file and absent states`,
  );
}

/** Each distinct state of a list, in list order. */
function distinctStates(states: readonly PolledState[]): PolledState[] {
  const keys = new Set<string>();
  return states.filter((state) => {
    const key = polledStateKey(state);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

/**
 * Write a file state at a workspace-relative byte path of a staged
 * workspace — its bytes, parent directories created, or, for absence,
 * nothing there — through raw filesystem calls: bytes the episode's
 * workspace held or the product wrote, never harness-composed text.
 */
async function stageFileState(
  copy: TestWorkspace,
  rel: Uint8Array,
  state: PolledState,
): Promise<void> {
  const abs = copy.bytePath(rel);
  if (state.kind === "absent") {
    await fsp.rm(abs, { force: true });
    return;
  }
  const slash = Buffer.from(rel).lastIndexOf(0x2f);
  if (slash > 0) {
    await fsp.mkdir(copy.bytePath(rel.subarray(0, slash)), {
      recursive: true,
    });
  }
  await fsp.writeFile(abs, state.bytes);
}

/** The refreshing read every staged workspace runs (stagedGraphDataStates). */
const STAGED_REFRESH_ARGV = ["ids", "--json"] as const;

/**
 * The graph data a product writes for every state of an episode's files a
 * concurrent reader can meet (module header): its own outputs over staged
 * copies of the episode's start and end, a product-to-itself comparison
 * (H-4) pinning no graph-data byte. D is the source paths the twin's run
 * changed — compared-view keys outside `.xspec/` whose entries in
 * `twin.start` and `twin.final` differ, each a plain file in at least one of
 * them: a rename's source, a move's origin and destination, none for a
 * resolve; J the journal's states in `twin.start` and `twin.final`; G the
 * graph-data files' states at the start (`start`, the captured start states)
 * and in the twin's final workspace (`twinFinal`) — one state, or one set,
 * where the two are equal. Every combination — each D path at its start or
 * final state independently, each J, each G: a reader reads each source and
 * the journal on either side of the command's one write to it, and a
 * refresh keeps the record it reads, the start's or the regeneration's
 * (13.3) — gets a fresh workspace holding a byte copy of the twin's final
 * workspace (the lock path left out, as `runTwin` copies), each D path and
 * the journal set to the combination's state byte for byte (or removed for
 * absence), and every graph-data file replaced by G's set: bytes the
 * workspace held or the product wrote, never harness-composed text, so no
 * S-9 judgement applies, as none applies to the twin's copy, and each
 * staged workspace holds only the episode's own files, of CONF-CORE's
 * shapes (§CONF-READERS' staging constraint). `ids --json`, a refreshing
 * read on CONF-CORE's surface, then runs there with no reader beside it:
 * exit 0, or 1 where the combination fails `build`'s validations and
 * refreshes nothing (13.3); any other end, or a run that does not end on
 * its own, fails diagnosed (H-8) — a harness error propagating as itself
 * (H-11). Each graph-data path's state there afterwards (absence where the
 * copy holds none) is a staged state of that path. For P-10 that is 8
 * combinations for a rename, 16 for a move, and 1 or 2 for a resolve.
 */
async function stagedGraphDataStates(
  product: ProductBinding,
  twin: EpisodeTwin,
  graphDataRels: readonly string[],
  start: ReadonlyMap<string, PolledState>,
  twinFinal: ReadonlyMap<string, PolledState>,
  context: string,
): Promise<StagedGraphData> {
  const sources = differingKeys(twin.start, twin.final)
    .filter((key) => key !== ".xspec" && !key.startsWith(".xspec/"))
    .filter(
      (key) =>
        twin.start.entries.get(key)?.kind === "file" ||
        twin.final.entries.get(key)?.kind === "file",
    )
    .map((key) => ({
      key,
      sides: [
        stagedStateAt(twin.start, key, "as the twin started", context),
        stagedStateAt(twin.final, key, "as the twin left it", context),
      ] as const,
    }));
  const journals = distinctStates([
    stagedStateAt(twin.start, JOURNAL_REL, "as the twin started", context),
    stagedStateAt(twin.final, JOURNAL_REL, "as the twin left it", context),
  ]);
  const graphDataSets = graphDataRels.every(
    (rel) =>
      polledStateKey(start.get(rel) ?? ABSENT_STATE) ===
      polledStateKey(twinFinal.get(rel) ?? ABSENT_STATE),
  )
    ? [start]
    : [start, twinFinal];
  const sideName = (side: number, count: number): string =>
    count === 1
      ? "unchanged"
      : side === 0
        ? "as it started"
        : "as the twin left it";
  const states = new Map<string, Map<string, PolledState>>(
    graphDataRels.map((rel) => [rel, new Map<string, PolledState>()]),
  );
  let combinations = 0;
  for (let bits = 0; bits < 2 ** sources.length; bits += 1) {
    const sides = sources.map(
      (_, index) => (bits >> (sources.length - 1 - index)) & 1,
    );
    for (const [journalSide, journal] of journals.entries()) {
      for (const [setSide, graphData] of graphDataSets.entries()) {
        combinations += 1;
        const label =
          `staged combination ${String(combinations)} — ` +
          [
            ...sources.map(
              (source, index) =>
                `${displaySnapshotPath(source.key)} ` +
                `${sideName(sides[index], 2)} ` +
                `(${describePolledState(source.sides[sides[index]])})`,
            ),
            `the journal ${sideName(journalSide, journals.length)}`,
            `graph data ${sideName(setSide, graphDataSets.length)}`,
          ].join(", ");
        const copy = await TestWorkspace.create({});
        try {
          await copyTreeBytes(
            Buffer.from(twin.workspace.root),
            Buffer.from(copy.root),
            isLockPathBytes,
          );
          for (const [index, source] of sources.entries()) {
            await stageFileState(
              copy,
              snapshotKeyBytes(source.key),
              source.sides[sides[index]],
            );
          }
          await stageFileState(copy, Buffer.from(JOURNAL_REL), journal);
          for (const key of await graphDataKeysIn(copy)) {
            await fsp.rm(copy.bytePath(snapshotKeyBytes(key)));
          }
          for (const rel of graphDataRels) {
            const state = graphData.get(rel) ?? ABSENT_STATE;
            if (state.kind === "content") {
              await stageFileState(copy, Buffer.from(rel), state);
            }
          }
          let result: RunResult;
          try {
            result = await runProduct(product, {
              cwd: copy.root,
              argv: STAGED_REFRESH_ARGV,
            });
          } catch (error) {
            rethrowHarnessError(error);
            return fail(
              `${context}: \`ids --json\` over ${label}, run alone, must ` +
                `end on its own (SPEC 13.3; H-8) — ` +
                `${error instanceof Error ? error.message : String(error)}`,
            );
          }
          if (
            result.signal !== null ||
            (result.exitCode !== 0 && result.exitCode !== 1)
          ) {
            fail(
              `${context}: \`ids --json\` over ${label}, run alone, must ` +
                `answer, exit 0, or — where that state of the episode's ` +
                `files fails \`build\`'s validations — report their ` +
                `findings, exit 1, refreshing nothing: a read's argv and ` +
                `configuration are fixed valid (SPEC 13.3, 12.0; P-10 ` +
                `stages there the graph data a concurrent reader meets); ` +
                `got ${summarizeResult(result)}`,
            );
          }
          for (const rel of graphDataRels) {
            const state = await readPolledState(copy.path(rel));
            states.get(rel)?.set(polledStateKey(state), state);
          }
        } finally {
          await copy.dispose();
        }
      }
    }
  }
  return { states, combinations };
}

/**
 * Of the content candidates, the one a diagnosis compares an observed
 * content state with byte by byte: among the candidates the observed bytes
 * are a strict prefix of — a partial write's hallmark — if any, else among
 * them all, the nearest by length (the first of equally near ones); none
 * for an absent observation.
 */
function nearestContent(
  state: PolledState,
  candidates: readonly PolledState[],
): Uint8Array | undefined {
  if (state.kind !== "content") return undefined;
  const contents = candidates.flatMap((candidate) =>
    candidate.kind === "content" ? [candidate.bytes] : [],
  );
  const extended = contents.filter(
    (bytes) =>
      bytes.length > state.bytes.length && isPrefix(state.bytes, bytes),
  );
  let nearest: Uint8Array | undefined;
  for (const bytes of extended.length > 0 ? extended : contents) {
    if (
      nearest === undefined ||
      Math.abs(bytes.length - state.bytes.length) <
        Math.abs(nearest.length - state.bytes.length)
    ) {
      nearest = bytes;
    }
  }
  return nearest;
}

/**
 * Judge one graph-data path's polled states (module header): every distinct
 * state the polling reader recorded there, and its state after the episode,
 * must be its start state, its twin's final state, or — once some observed
 * state is neither, the staged states computed then, at most once per
 * episode (stagedGraphDataStates) — its state in a staged workspace: the
 * product's own graph data for a state of the episode's files. Any other
 * state is a partial write, which a path xspec writes never holds, concurrent
 * readers and interrupted commands included (SPEC 13.5; T13.5-5's
 * protocol) — or graph data that is no byte-deterministic function of the
 * workspace's files (12.0), which the staged states assume: diagnosed with
 * the polling cycle that first observed it and the nearest candidate's byte
 * difference (nearestContent).
 */
async function judgeGraphDataPath(
  poller: PathPoller,
  rel: string,
  abs: string,
  start: PolledState,
  end: PolledState,
  twinFinal: PolledState,
  oracle: GraphDataOracle,
  context: string,
): Promise<void> {
  const observed = new Map<
    string,
    { readonly state: PolledState; readonly cycle: number | undefined }
  >();
  for (const [key, { state, firstIndex }] of poller.distinct(abs)) {
    observed.set(key, { state, cycle: firstIndex });
  }
  const endKey = polledStateKey(end);
  if (!observed.has(endKey)) {
    observed.set(endKey, { state: end, cycle: undefined });
  }
  const prior = new Set([polledStateKey(start), polledStateKey(twinFinal)]);
  const beyond = [...observed].filter(([key]) => !prior.has(key));
  if (beyond.length === 0) return;
  const { states, combinations } = await oracle.staged();
  const staged = states.get(rel) ?? new Map<string, PolledState>();
  for (const [key, { state, cycle }] of beyond) {
    if (staged.has(key)) continue;
    const nearest = nearestContent(state, [
      start,
      twinFinal,
      ...staged.values(),
    ]);
    fail(
      `${context}: ` +
        (cycle === undefined
          ? `once the episode had ended, ${rel} held`
          : `polling cycle #${String(cycle)} observed ${rel} in`) +
        ` a state that is neither its state before the episode, nor its ` +
        `reader-free twin's after it, nor the graph data the product ` +
        `writes for any state of the episode's files ` +
        `(${String(staged.size)} distinct staged state(s) over ` +
        `${String(combinations)} staged combination(s): each source the ` +
        `operation writes at its start or end state, the journal at either, ` +
        `and the start's or the twin's graph data beside them) — a partial ` +
        `write: a path xspec writes holds its prior state or the complete ` +
        `new content, concurrent readers and interrupted commands included, ` +
        `readers' refreshes writing graph data too, last write wins (SPEC ` +
        `13.5, 13.3; T13.5-5's protocol) — or else graph data that is no ` +
        `byte-deterministic function of the workspace's files (12.0: the ` +
        `staged states are the product's own outputs for them). Observed ` +
        `${describePolledState(state)}; before ` +
        `${describePolledState(start)}, the twin's ` +
        `${describePolledState(twinFinal)}.` +
        (nearest !== undefined && state.kind === "content"
          ? `\n${describeByteDifference(state.bytes, nearest, "observed", "nearest")}`
          : ""),
    );
  }
}

/**
 * The journal's order bookkeeping over the poller's observations (SPEC 6.1:
 * append-only, never deleted): each observation extends the previous one —
 * absence reads as the empty journal, and absence after content is a
 * deletion.
 */
class JournalOrder {
  violation: string | undefined;
  #last: PolledState | undefined;

  observe(state: PolledState, cycle: number): void {
    const previous = this.#last;
    this.#last = state;
    if (previous === undefined || this.violation !== undefined) return;
    if (previous.kind === "content" && state.kind === "absent") {
      this.violation =
        `cycle #${String(cycle)}: the journal was observed absent after ` +
        `content had been observed (${describePolledState(previous)}) — the ` +
        `journal is never deleted (SPEC 6.1, 13.4)`;
      return;
    }
    if (previous.kind !== "content" || state.kind !== "content") return;
    if (!isPrefix(previous.bytes, state.bytes)) {
      this.violation =
        `cycle #${String(cycle)}: a journal observation did not extend the ` +
        `previous one — the journal is append-only, so successive reads ` +
        `are prefix-monotone (SPEC 6.1, 13.5)\n` +
        describeByteDifference(
          state.bytes,
          previous.bytes,
          "later observation",
          "earlier observation",
        );
    }
  }
}

/**
 * Judge one polled path but graph data of a run the kill ended (module
 * header): every distinct state the polling reader recorded there, and its
 * state once the kill had ended the run (`end`: the run makes no write
 * after the kill, and no reader writes the path), must be its state before
 * the episode or its state in the reader-free twin's final workspace
 * (`twinFinal`) — the run leaves every write it made complete and makes no
 * later one (SPEC 13.5), and its one write to the path, had it made it, is
 * the twin's (the module header's reasons). Any other state is a partial
 * write the kill left, which never passes as "after" since the kill decided
 * the end: diagnosed with the polling cycle that first observed it (none
 * for an end state the poller never met) and the nearest candidate's byte
 * difference (nearestContent).
 */
function judgeKilledRunPath(
  poller: PathPoller,
  rel: string,
  abs: string,
  start: PolledState,
  end: PolledState,
  twinFinal: PolledState,
  context: string,
): void {
  const observed = new Map<
    string,
    { readonly state: PolledState; readonly cycle: number | undefined }
  >();
  for (const [key, { state, firstIndex }] of poller.distinct(abs)) {
    observed.set(key, { state, cycle: firstIndex });
  }
  const endKey = polledStateKey(end);
  if (!observed.has(endKey)) {
    observed.set(endKey, { state: end, cycle: undefined });
  }
  const complete = new Set([polledStateKey(start), polledStateKey(twinFinal)]);
  for (const [key, { state, cycle }] of observed) {
    if (complete.has(key)) continue;
    const nearest = nearestContent(state, [start, twinFinal]);
    fail(
      `${context}: ` +
        (cycle === undefined
          ? `once the kill had ended the run, ${rel} held`
          : `polling cycle #${String(cycle)} observed ${rel} in`) +
        ` a state that is neither its state before the episode nor its ` +
        `reader-free twin's after the operation, though a run the kill ` +
        `ended leaves every write it made complete and makes no later one ` +
        `(SPEC 13.5: "at every moment — concurrent readers and interrupted ` +
        `commands included — a path xspec writes holds either its prior ` +
        `state (the previous content, or absence) or the complete new ` +
        `content, never a partial write"; "A mutating command interrupted ` +
        `before completion, or stopped by a write the environment refuses ` +
        `(14.24), leaves the writes already made, each complete, and makes ` +
        `no later one, release (above) aside"), and the twin's state there ` +
        `is the complete content of the run's one write to the path (the ` +
        `same operation on a byte copy of the episode's start, every file ` +
        `it writes byte-deterministic for identical input, each written at ` +
        `most once: 12.0, 13.4; TEST-SPEC P-10; T13.5-5's protocol) — so a ` +
        `partial write the kill left. Observed ` +
        `${describePolledState(state)}; before ${describePolledState(start)}, ` +
        `the twin's ${describePolledState(twinFinal)}.` +
        (nearest !== undefined && state.kind === "content"
          ? `\n${describeByteDifference(state.bytes, nearest, "observed", "nearest")}`
          : ""),
    );
  }
}

/**
 * The polling reader's verdict (module header): no read error, at least one
 * cycle, the journal's order kept, and every distinct state observed at a
 * path but graph data its state before the episode or after it — prior or
 * complete, never partial (SPEC 13.5; T13.5-5's protocol) — where the kill
 * ended the run (`killedRun`), "after" its state in the reader-free twin's
 * final workspace (`twinFinalStates`, by workspace-relative path), the
 * state the kill left judged too (judgeKilledRunPath); each graph-data
 * path, which `graphData.twinFinal` names, judged on its own terms: its
 * start state, its twin's final state, or the product's own graph data for
 * a state of the episode's files (judgeGraphDataPath).
 */
async function judgePolledStates(
  poller: PathPoller,
  order: JournalOrder,
  polled: readonly { readonly rel: string; readonly abs: string }[],
  startStates: ReadonlyMap<string, PolledState>,
  twinFinalStates: ReadonlyMap<string, PolledState>,
  killedRun: boolean,
  graphData: GraphDataOracle,
  context: string,
): Promise<void> {
  if (poller.error !== undefined) {
    fail(
      `${context}: the polling reader hit an unexpected filesystem error — ` +
        poller.error,
    );
  }
  if (order.violation !== undefined) fail(`${context}: ${order.violation}`);
  if (poller.cycles === 0) {
    fail(
      `${context} staging premise: the polling reader completed zero ` +
        `cycles across the episode — the polling cadence is broken`,
    );
  }
  for (const { rel, abs } of polled) {
    const start = startStates.get(abs);
    if (start === undefined) {
      throw new Error(`P-10 harness defect: no start state for ${rel}`);
    }
    const end = await readPolledState(abs);
    const twinFinal = graphData.twinFinal.get(rel);
    if (twinFinal !== undefined) {
      await judgeGraphDataPath(
        poller,
        rel,
        abs,
        start,
        end,
        twinFinal,
        graphData,
        context,
      );
      continue;
    }
    if (killedRun) {
      const complete = twinFinalStates.get(rel);
      if (complete === undefined) {
        throw new Error(`P-10 harness defect: no twin-final state for ${rel}`);
      }
      judgeKilledRunPath(poller, rel, abs, start, end, complete, context);
      continue;
    }
    const legit = new Set([polledStateKey(start), polledStateKey(end)]);
    for (const [key, { state, firstIndex }] of poller.distinct(abs)) {
      if (legit.has(key)) continue;
      const nearest = nearestContent(state, [start, end]);
      fail(
        `${context}: polling cycle #${String(firstIndex)} observed ${rel} ` +
          `in a state that is neither its state before the episode nor its ` +
          `state after it — a concurrent reader only ever observes the ` +
          `prior state or the complete new content, never a partial write ` +
          `(SPEC 13.5; T13.5-5's protocol; the episode's one mutating ` +
          `command writes each polled path at most once). Observed ` +
          `${describePolledState(state)}; before ${describePolledState(start)}, ` +
          `after ${describePolledState(end)}.` +
          (nearest !== undefined && state.kind === "content"
            ? `\n${describeByteDifference(state.bytes, nearest, "observed", "nearest")}`
            : ""),
      );
    }
  }
}

/** Whether an exit-2 run under `--json` was refused `workspace-busy`. */
function isBusyRefusal(result: RunResult, context: string): boolean {
  if (result.exitCode !== 2) return false;
  try {
    return expectErrorDocument(result, context).code === WORKSPACE_BUSY;
  } catch {
    // No well-formed error document: the exit-code assertion diagnoses it.
    return false;
  }
}

function sameBytes(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === null || b === null) return a === b;
  return bytesEqual(a, b);
}

/**
 * What a command writes beside its own durable files, judged on its own
 * workspace over the compared view (isComparedKey; SPEC 6.1, 10.7, 13.4): a
 * resolve writes the session file alone — never the journal (6.1), never a
 * source, never another session — and `rename` and `move` never write
 * review sessions (identity mappings are applied at read time, 10.4). An
 * entry in the session directory that is no session (10.1), such as an
 * atomic write's temporary entry a kill left, is no write judged here.
 */
function assertWritesItsOwnFilesAlone(
  episode: P10Episode,
  start: DirectorySnapshot,
  end: DirectorySnapshot,
  context: string,
): void {
  if (episode.kind === "resolve") {
    const others = differingKeys(start, end).filter(
      (key) => key !== SESSION_REL,
    );
    if (others.length > 0) {
      fail(
        `${context}: a \`review resolve\` writes the session file alone — ` +
          `never the journal (its only writers are \`rename\` and ` +
          `\`move\`, SPEC 6.1), never a source (10.7, 13.4) — yet ` +
          `${renderKeys(others)} changed`,
      );
    }
    return;
  }
  if (
    !sameBytes(fileBytesAt(start, SESSION_REL), fileBytesAt(end, SESSION_REL))
  ) {
    fail(
      `${context}: \`rename\` and \`move\` never write review sessions — ` +
        `identity mappings are applied at read time, not persisted into ` +
        `sessions (SPEC 10.4, 13.4) — yet ${SESSION_REL} changed`,
    );
  }
}

/**
 * A lock-path inspection a run's judgement leaves pending (judgeKilledRun,
 * judgeEndedRun): runEpisode makes it only once every read the episode
 * started has been settled (module header).
 */
type PendingLockPathInspection = () => Promise<void>;

/**
 * Judge a run the kill ended (module header), at once: at most one journal
 * entry added; a resolve recorded its status — the session its twin leaves
 * — or left the session file byte-unchanged; nothing written beside its own
 * files; and whether its sources, journal, or session files differ from
 * those its twin leaves. Where they do, the run had not released, and the
 * lock-path inspection — `.xspec/lock` holding exactly one entry, a plain
 * file: the dead run's — is returned pending, for runEpisode to make once
 * the episode's readers have exited: a conforming product's readers write
 * nothing at the lock path (13.4) and no mutating command runs meanwhile,
 * so the dead run's entry still stands there alone, while a claim a reader
 * holds only while it runs is gone by then. Where they do not, nothing is
 * left to inspect.
 */
function judgeKilledRun(
  workspace: TestWorkspace,
  twin: EpisodeTwin,
  after: DirectorySnapshot,
  episode: P10Episode,
  context: string,
): PendingLockPathInspection | undefined {
  assertJournalAppended(
    twin.start,
    after,
    episode.kind === "resolve" ? 0 : "at most one",
    context,
  );
  assertWritesItsOwnFilesAlone(episode, twin.start, after, context);
  if (episode.kind === "resolve") {
    const now = fileBytesAt(after, SESSION_REL);
    if (
      !sameBytes(now, fileBytesAt(twin.start, SESSION_REL)) &&
      !sameBytes(now, fileBytesAt(twin.final, SESSION_REL))
    ) {
      fail(
        `${context}: a killed resolve either recorded its status — the ` +
          `session file its reader-free twin leaves — or left the session ` +
          `file byte-unchanged: the session is written once, last, each ` +
          `write complete (SPEC 13.5; TEST-SPEC P-10)`,
      );
    }
  }
  const short = differingKeys(after, twin.final);
  if (short.length === 0) return undefined;
  return async () => {
    await assertLockDirectoryEntries(
      workspace.root,
      { entries: 1 },
      `${context}: what it left at ${renderKeys(short)} differs from what ` +
        `its reader-free twin leaves, so the run had not made its last ` +
        `write and had not released — \`.xspec/lock\` holds exactly one ` +
        `entry, a plain file: the dead run's, a leftover, until a later ` +
        `mutating command takes it over, the episode's readers, every one ` +
        `exited now, having added none (SPEC 13.5: a run's entry stands ` +
        `until its release, which comes as the command ends, after its last ` +
        `write; an abnormal termination leaves it; 13.4; TEST-SPEC P-10, ` +
        `T13.5-3's past-the-hold judgement)`,
    );
  };
}

/**
 * Judge a run that ended on its own (module header), at once: never refused
 * `workspace-busy` — a refusal after a kill on this workspace meets T13.5-3's
 * reuse check, voiding the trial where a killed group's identifier is listed
 * again — and ending exactly as its reader-free twin: exit code, standard
 * output, and the sources, journal, and session files it leaves; one journal
 * entry added by a `rename` or `move`, none by a resolve. The lock-path
 * inspection — `.xspec/lock` absent, the run released — is returned
 * pending, for runEpisode to make once the episode's readers have exited: a
 * conforming product's readers write nothing at the lock path (13.4) and no
 * mutating command runs meanwhile, so nothing stands there then, while a
 * claim a reader holds only while it runs is gone by then.
 */
async function judgeEndedRun(
  state: TrialState,
  twin: EpisodeTwin,
  after: DirectorySnapshot,
  result: RunResult,
  episode: P10Episode,
  context: string,
): Promise<PendingLockPathInspection> {
  if (isBusyRefusal(result, context)) {
    const refusal = `${context} — ${summarizeResult(result)}`;
    if (state.killed.length > 0) {
      await applyReuseCheck(state.killed, refusal);
    }
    fail(
      `${refusal}: refused workspace-busy (14.26) with readers beside it and ` +
        `no killed run's entry standing — readers never exclude a mutating ` +
        `command (SPEC 13.5: every command but the mutating ones may run ` +
        `concurrently with them; 14.26: only another run's entry, or a ` +
        `leftover in the gap, refuses, and a reader makes none, 13.4; ` +
        `TEST-SPEC P-10)`,
    );
  }
  assertExitCode(
    result,
    0,
    `${context}: whatever readers run beside it, a mutating command ends ` +
      `exactly as its reader-free twin, which exited 0 (SPEC 13.5; ` +
      `TEST-SPEC P-10)`,
  );
  if (!bytesEqual(result.stdoutBytes, twin.result.stdoutBytes)) {
    fail(
      `${context}: its standard output must be byte-equal to its ` +
        `reader-free twin's (TEST-SPEC P-10; H-6)\n` +
        describeByteDifference(
          result.stdoutBytes,
          twin.result.stdoutBytes,
          "the command's",
          "its twin's",
        ),
    );
  }
  assertJournalAppended(
    twin.start,
    after,
    episode.kind === "resolve" ? 0 : 1,
    context,
  );
  assertWritesItsOwnFilesAlone(episode, twin.start, after, context);
  assertSnapshotsEqual(
    twin.final,
    after,
    `${context}: the sources, journal, and session files it leaves must be ` +
      `byte-equal to those its reader-free twin leaves (TEST-SPEC P-10; ` +
      `H-6 — derived files and graph data, which readers' refreshes may ` +
      `rewrite, not compared)`,
  );
  const root = state.workspace.root;
  return async () => {
    await assertLockPathAbsent(
      root,
      `${context}: once it has ended, released (SPEC 13.5: release on ` +
        `every normal end; T13.5-11), the episode's readers, every one ` +
        `exited now, having added no entry (13.4)`,
    );
  };
}

/**
 * Run one episode (module header) on the trial's workspace: its operation
 * made concrete, its reader-free twin run first (on a copy), the derived
 * files beside its sources and its graph data listed from both, every
 * polled path's state read at the start and in the twin's final workspace,
 * then the polling reader started, the pre-start readers started and
 * confirmed running, the command started — in a process group of its own —
 * held or not, its held and straddle reads, and its fate; the run judged at
 * once as it ends, all but the lock path; the readers then settled — every
 * pre-start and straddle read the episode started, its held reads having
 * run to completion while it held — and only then the lock path inspected
 * (judgeEndedRun's and judgeKilledRun's pending inspections: its state once
 * the readers have exited is the one the run left, a conforming product's
 * readers writing nothing there, 13.4, and no mutating command running
 * meanwhile); then the polled states judged (a run the kill ended against
 * the twin's final states, the state it left included; graph data's staged
 * states computed then, while the twin's workspace stands, where an
 * observed state needs them); the ledger and the file model updated, and —
 * after a `rename` or `move` killed past its hold — the trial continued on
 * the twin's workspace.
 */
async function runEpisode(
  product: ProductBinding,
  state: TrialState,
  episode: P10Episode,
  index: number,
  context: string,
): Promise<void> {
  const operation = operationOf(episode, state, context);
  const workspace = state.workspace;
  const twin = await runTwin(
    product,
    workspace,
    operation.argv,
    episode.held,
    `${context}: the reader-free twin`,
  );
  let adopted = false;
  try {
    // The derived files beside the episode's sources and its graph data,
    // listed before it starts: from its start and from the twin's final
    // state, which holds a move's destination's (polledRelsOf). No name met
    // mid-episode is polled (an atomic write's temporary entry is no path
    // P-10 judges).
    const derivedRels = new Set<string>();
    for (const listed of [workspace, twin.workspace]) {
      for (const source of episodeSourcesOf(episode, state.currentFile)) {
        for (const rel of await derivedFilesBeside(listed, source, context)) {
          derivedRels.add(rel);
        }
      }
    }
    const graphDataRels = await graphDataRelsOf(
      [workspace, twin.workspace],
      context,
    );
    const polled = polledRelsOf(
      episode,
      state.currentFile,
      [...derivedRels],
      graphDataRels,
    ).map((rel) => ({
      rel,
      abs: workspace.path(rel),
    }));
    const startStates = new Map<string, PolledState>();
    for (const { abs } of polled) {
      startStates.set(abs, await readPolledState(abs));
    }
    // Graph data's oracle (judgeGraphDataPath): each path's start state and
    // its twin's final state, read beside the start states, and the staged
    // states, computed only once an observed state is neither.
    const graphDataStart = new Map<string, PolledState>();
    const graphDataTwinFinal = new Map<string, PolledState>();
    for (const rel of graphDataRels) {
      graphDataStart.set(
        rel,
        startStates.get(workspace.path(rel)) ?? ABSENT_STATE,
      );
      graphDataTwinFinal.set(
        rel,
        await readPolledState(twin.workspace.path(rel)),
      );
    }
    // Every polled path's state in the twin's final workspace, read before
    // the episode starts — graph data's those just read: what a run the kill
    // ended is judged against (judgePolledStates; module header).
    const twinFinalStates = new Map<string, PolledState>(graphDataTwinFinal);
    for (const { rel } of polled) {
      if (!twinFinalStates.has(rel)) {
        twinFinalStates.set(
          rel,
          await readPolledState(twin.workspace.path(rel)),
        );
      }
    }
    let staged: Promise<StagedGraphData> | undefined;
    const graphData: GraphDataOracle = {
      twinFinal: graphDataTwinFinal,
      staged: () =>
        (staged ??= stagedGraphDataStates(
          product,
          twin,
          graphDataRels,
          graphDataStart,
          graphDataTwinFinal,
          `${context}: graph data's staged states`,
        )),
    };
    const journalAbs = workspace.path(JOURNAL_REL);
    const order = new JournalOrder();
    const poller = new PathPoller(
      polled.map(({ abs }) => abs),
      (abs, polledState, cycle) => {
        if (abs === journalAbs) order.observe(polledState, cycle);
      },
    );
    const hold = path.join(workspace.tempRoot, `hold-${String(index)}.tmp`);
    const reads: StraddleRead[] = [];
    let running: RunningProduct | undefined;
    let ended = false;
    let killedRun = false;
    poller.start();
    try {
      const pre = await startPreReaders(
        product,
        workspace.root,
        episode,
        context,
      );
      reads.push(...pre.reads);
      const runContext =
        `${context}: the command (${String(pre.confirmed)} pre-start ` +
        `reader(s) confirmed running as it started)`;
      running = await startProduct(product, {
        cwd: workspace.root,
        argv: episode.held
          ? [...operation.argv, "--test-hold", hold]
          : operation.argv,
        processGroup: true,
      });
      let killed: KilledGroup | undefined;
      let exited: RunResult | undefined;
      if (episode.held && (await holdsOrExits(running, hold, runContext))) {
        for (const menuIndex of episode.heldReads) {
          await runHeldRead(
            product,
            workspace.root,
            menuIndex,
            `${runContext}, held read`,
          );
        }
        if (running.hasExited()) {
          const outcome = await running
            .waitForExit()
            .then(summarizeResult, (error: unknown) => {
              rethrowHarnessError(error);
              return error instanceof Error ? error.message : String(error);
            });
          fail(
            `${runContext}: the mutating command must proceed only once its ` +
              `hold file is deleted, but it exited while still held (SPEC ` +
              `13.5) — ${outcome}`,
          );
        }
        for (const menuIndex of episode.straddleReads) {
          reads.push(await startRead(product, workspace.root, menuIndex));
        }
        if (episode.fate === "heldKill") {
          killed = await killMutatingRun(
            running,
            `${runContext}, killed while held`,
          );
        } else {
          await releaseHoldFile(hold);
          const liftedAt = performance.now();
          if (episode.fate === "pastHoldKill") {
            const remainingMs =
              episode.killFraction * twin.spanMs -
              (performance.now() - liftedAt);
            if (remainingMs > 0) await sleep(remainingMs);
            killed = await killMutatingRun(
              running,
              `${runContext}, killed past its hold`,
            );
          } else {
            exited = await settleMutatingRun(running, runContext);
          }
        }
      } else {
        if (!episode.held) {
          for (const menuIndex of episode.straddleReads) {
            reads.push(await startRead(product, workspace.root, menuIndex));
          }
        }
        exited = await settleMutatingRun(running, runContext);
      }
      ended = true;
      const result = killed?.result ?? exited;
      if (result === undefined) {
        throw new Error("P-10 harness defect: the command's end was lost");
      }
      killedRun = killed !== undefined && result.signal === "SIGKILL";
      const after = await comparedSnapshot(workspace.root);
      let inspectLockPath: PendingLockPathInspection | undefined;
      if (killed !== undefined && killedRun) {
        inspectLockPath = judgeKilledRun(
          workspace,
          twin,
          after,
          episode,
          `${runContext}, the run the kill ended (${episode.fate})`,
        );
        state.killed.push(...killed.identifiers);
      } else {
        inspectLockPath = await judgeEndedRun(
          state,
          twin,
          after,
          result,
          episode,
          `${runContext}, ended on its own`,
        );
        state.killed = [];
      }
      for (const read of reads) {
        await settleStraddleRead(read, `${context}: the reader`);
      }
      // The lock path is inspected only now, every read the episode started
      // settled (module header): what a reader leaves there is seen, never a
      // claim it holds only while it runs.
      if (inspectLockPath !== undefined) await inspectLockPath();
    } finally {
      if (running !== undefined && !ended) {
        await running.killGroup().catch(() => undefined);
      }
      for (const read of reads) {
        if (!read.running.hasExited()) read.running.kill();
      }
      await Promise.allSettled(reads.map((read) => read.running.waitForExit()));
      await releaseHoldFile(hold);
      await poller.stop();
    }
    await judgePolledStates(
      poller,
      order,
      polled,
      startStates,
      twinFinalStates,
      killedRun,
      graphData,
      context,
    );

    if (operation.resolve !== null) {
      if (!killedRun) {
        state.ledger.expected.set(
          operation.resolve.id,
          operation.resolve.status,
        );
      } else if (episode.fate === "pastHoldKill") {
        state.ledger.pendingKill = operation.resolve;
      }
    }
    if (episode.kind === "move" && episode.fate !== "heldKill") {
      state.currentFile = episode.to;
    }
    if (
      killedRun &&
      episode.fate === "pastHoldKill" &&
      episode.kind !== "resolve"
    ) {
      // The operation complete on the twin's workspace (module header): the
      // schedule continues there, no dead entry standing.
      await workspace.dispose();
      state.workspace = twin.workspace;
      state.killed = [];
      adopted = true;
    }
  } finally {
    if (!adopted) await twin.workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The trial body

async function runP10Trial(
  product: ProductBinding,
  trial: P10Trial,
  attempt: number,
): Promise<void> {
  const label = attempt > 1 ? `P-10 (attempt ${String(attempt)})` : "P-10";
  const state: TrialState = {
    workspace: await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [INITIAL_SOURCE_REL]: A_MDX,
      },
    }),
    currentFile: INITIAL_SOURCE_REL,
    killed: [],
    rows: [],
    ledger: { ids: [], expected: new Map(), pendingKill: null },
  };
  try {
    // --- Staging: build, create the audit session, learn the item set ---
    const workspace = state.workspace;
    await buildOk(
      product,
      workspace,
      `${label} staging \`build\` (the fixed workspace is valid)`,
    );
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", SESSION_NAME],
      0,
      `${label} staging \`review create --strategy audit --name ` +
        `${SESSION_NAME}\` (a fresh valid name; audit needs no baseline, ` +
        `SPEC 10.6)`,
    );
    const initialLabel = `${label} after \`review create\` — \`review status ${SESSION_NAME} --json\``;
    const initialReport = decodeSessionStatusReport(
      await bracketedQuiescentRead(
        workspace,
        () =>
          runJson(
            product,
            workspace,
            ["review", "status", SESSION_NAME, "--json"],
            initialLabel,
          ),
        initialLabel,
      ),
      initialLabel,
    );
    if (initialReport.items.length === 0) {
      fail(
        `${initialLabel}: staging premise — an audit session over a ` +
          `non-empty workspace holds one item per requirement node ` +
          `(SPEC 10.6), but \`status\` reports none`,
      );
    }
    state.ledger.ids = initialReport.items.map((row) => row.id);
    if (new Set(state.ledger.ids).size !== state.ledger.ids.length) {
      fail(
        `${initialLabel}: item IDs must be unique within the session ` +
          `(SPEC 10.1, 10.2) — got ${JSON.stringify(state.ledger.ids)}`,
      );
    }
    for (const row of initialReport.items) {
      if (row.status !== "unresolved") {
        fail(
          `${initialLabel}: every item enters the session \`unresolved\` ` +
            `(SPEC 10.2) — the accounting baseline — but item ${row.id} ` +
            `reports ${JSON.stringify(row.status)}`,
        );
      }
      state.ledger.expected.set(row.id, "unresolved");
    }
    state.rows = initialReport.items;
    const initialJournal = await readPolledState(workspace.path(JOURNAL_REL));
    if (
      journalEntryCount(
        initialJournal.kind === "content" ? initialJournal.bytes : null,
      ) !== 0
    ) {
      fail(
        `${label} accounting baseline: before any \`rename\` or \`move\` ` +
          `the journal has zero entries — it is written only by those ` +
          `commands and comes into existence with the first journaled ` +
          `operation (SPEC 6.1) — found ${describePolledState(initialJournal)} ` +
          `at ${JOURNAL_REL}`,
      );
    }

    // --- The schedule ---
    for (const [index, episode] of trial.episodes.entries()) {
      const context =
        `${label} episode ${String(index + 1)}/` +
        `${String(trial.episodes.length)} [${describeEpisode(episode)}]`;
      await runEpisode(product, state, episode, index, context);
      state.rows = (
        await accountingRead(
          product,
          state.workspace,
          state.ledger,
          `${context} — post-episode accounting`,
        )
      ).items;
    }

    // --- Final cross-check: stored-status counts via `review list` ---
    const listLabel = `${label} final \`review list --json\``;
    const listed = decodeSessionListReport(
      await bracketedQuiescentRead(
        state.workspace,
        () =>
          runJson(
            product,
            state.workspace,
            ["review", "list", "--json"],
            listLabel,
          ),
        listLabel,
      ),
      listLabel,
    );
    const entry = listed.sessions.find(
      (session) => session.name === SESSION_NAME,
    );
    if (listed.sessions.length !== 1 || entry === undefined) {
      fail(
        `${listLabel}: \`list\` reports exactly the created session ` +
          `${JSON.stringify(SESSION_NAME)} (SPEC 10.7, 10.1) — got ` +
          `${JSON.stringify(listed.sessions.map((session) => session.name))}`,
      );
    }
    if (entry.corrupt) {
      fail(
        `${listLabel}: the session must never read as corrupt — every write ` +
          `to it was atomic and complete (SPEC 13.5, 10.1, 14.21)`,
      );
    }
    const expectedCounts: Record<string, number> = {};
    for (const status of state.ledger.expected.values()) {
      expectedCounts[status] = (expectedCounts[status] ?? 0) + 1;
    }
    const reportedTotal = Object.values(entry.counts).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (reportedTotal !== state.ledger.ids.length) {
      fail(
        `${listLabel}: stored-status counts must cover exactly the ` +
          `session's ${String(state.ledger.ids.length)} items (SPEC 10.7) — ` +
          `reported ${JSON.stringify(entry.counts)} (total ` +
          `${String(reportedTotal)})`,
      );
    }
    for (const status of [
      "unresolved",
      "invalidated",
      "updated",
      "no-change",
      "skipped",
    ]) {
      const reported = entry.counts[status] ?? 0;
      const expected = expectedCounts[status] ?? 0;
      if (reported !== expected) {
        fail(
          `${listLabel}: \`list\` counts from stored statuses, without ` +
            `read-time invalidation (SPEC 10.7) — session statuses = ` +
            `successful resolves (P-10 accounting) — expected ` +
            `${String(expected)} ${JSON.stringify(status)} item(s), got ` +
            `${String(reported)} (expected counts ` +
            `${JSON.stringify(expectedCounts)}, reported ` +
            `${JSON.stringify(entry.counts)})`,
        );
      }
    }
  } finally {
    await state.workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// Registration

const P_10 = defineProductTest({
  id: "P-10",
  title:
    "concurrency under randomized schedules of concurrent readers and one mutating command via --test-hold and process kills (TEST-SPEC §16 P-10): episodes of `rename`, file-form `move`, and `review resolve` under `--json`, held or not, run to their end, killed while held, or killed past their hold at fixed fractions of their twin's lift-to-exit span, each kill under T13.5-3's exit-collection discipline (the command's process group SIGKILLed, its exit collected, the group gone) before anything later runs; readers started before each command at drawn leads, at least one confirmed still running (listed, never a zombie) as it starts, plus reads while it holds and straddling its lift or kill, and a polling reader over the journal, the session file, the source, its module and companions, and graph data, never the lock path; each command's reader-free twin copied from the workspace, the lock path aside, as it starts and run alone, exit 0. Readers observe only prior-or-complete states (every polled state the path's before or after the episode — after a kill, the path's before it or its reader-free twin's after the operation, the state the kill left included — at a graph-data path also the product's own graph data for a state of the episode's files; the journal prefix-monotone, never deleted; T13.5-5's protocol); nothing is lost (each `rename`/`move` exiting 0 adds exactly one journal line, each killed one at most one; each resolve exiting 0 records its status — read back by quiescent `review status` and `review list` — each killed one records it or leaves the session byte-unchanged); a killed run whose sources, journal, or session files differ from its twin's leaves `.xspec/lock` holding exactly one plain-file entry once the episode's readers have exited (T13.5-3's past-the-hold judgement); and readers never exclude a mutating command: each one not killed is never refused (a refusal after a kill voids the trial where a killed group's identifier is listed again, T13.5-3's reuse check) and ends exactly as its twin — exit code, standard output, and the sources, journal, and session files byte-equal (H-6; derived files and graph data not compared), `.xspec/lock` absent once the episode's readers have exited (SPEC 6.1, 10.7, 13.4, 13.5; E-5)",
  run: async (product) => {
    await checkProperty(
      "P-10 concurrency schedules",
      genP10Trial,
      async (trial) => {
        // T13.5-3's reuse check voids a trial (E-5), rerun on a fresh
        // workspace a bounded number of times, exhaustion a harness error.
        await runVoidableTrial("P-10 schedule", async (attempt) => {
          await runP10Trial(product, trial, attempt);
        });
      },
      { runs: 3, maxShrinkExecutions: 4, render: renderP10Trial },
    );
  },
});

/** TEST-SPEC §16 P-10, registered as PROP-08. */
export const section16P10Tests: readonly ProductTestEntry[] = [P_10];
