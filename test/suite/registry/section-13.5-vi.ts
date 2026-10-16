// TEST-SPEC §13.5 (concurrency and isolation), part vi — SUITE-48: T13.5-13
// (overlapping acquisitions), registered whole.
//
// SPEC 13.5: of runs whose acquisitions overlap, at most one acquires —
// possibly none, the others refused with the busy error of 14.26 — because
// acquisition adds its run's entry to the lock directory `.xspec/lock`
// before the listing that judges it; exclusivity lasts from acquisition to
// release, which comes as the command ends, after its last write, so
// concurrency on one machine never loses a journal append or a resolution;
// and the one lasting residue of overlapping acquisitions is the area's
// directory left behind, empty, on a workspace that held none, its creator
// releasing while another run's entry stood in the lock directory.
//
// Every workspace is T13_5_13_DECL's — CONF-CORE-shaped (one spec group of
// plain `.mdx` sources): `specs/A.mdx` (`a` holding `a.k`, then `g`),
// `specs/B.mdx` (`b`), `specs/C.mdx` (`c`), no file referencing another's
// section — each trial on a fresh one, staged before anything starts.
//
// The held arm (HELD_TRIALS trials on a freshly built workspace, then as
// many on an unbuilt one): HELD_OPERATIONS — `rename specs/A.mdx g g2`,
// `rename specs/B.mdx b b2`, `review create --strategy audit --name t`, and
// `review create --strategy audit --name u`, operations each succeeding
// alone and composing in any order — each with a hold path of its own
// outside the workspace and under `--json`, are started together,
// unsynchronized: every run is spawned before any is awaited
// (`startRuns`). Every hold file stands until each run has either exited or
// created its hold file (`awaitExitedOrHolding`, bounded by a hang guard: a
// run doing neither by then fails diagnosed, H-8), and only then is any
// deleted. At that point at most one hold file exists; each run that
// created none has exited 2 with the 12.7 error document — `code`
// `"workspace-busy"`, `path` `".xspec/lock"`, `locations` `[]` (14.26) —
// and the run that created one is still held: the held-state comparison
// (TEST-SPEC §13.5's preamble; helpers/lock-state.ts `assertHeldState`)
// against the workspace as staged — every path but the lock path (and
// `.xspec` itself, a directory, on the unbuilt workspace) unchanged, the
// lock directory holding exactly one entry — is where the refused runs'
// "modifying nothing" is observed. Its hold lifted, the holder exits 0.
// Afterwards `.xspec/lock` is absent, the journal and the session files are
// exactly the successful operation's, and the workspace equals a twin's on
// which that operation alone ran (H-6 across directories); absent a
// success, it equals the workspace as staged — save, on the unbuilt
// workspace alone, an empty `.xspec`, 13.5's one stated residue of
// overlapping acquisitions, and nothing else. A product letting two
// overlapping acquisitions both acquire fails at the count of hold files; one
// refusing with another error fails at the refused run's error document.
//
// The unheld arm, separately for two series on a freshly built valid
// workspace — RENAME_SERIES, `rename specs/A.mdx g g2`, `rename specs/B.mdx
// b b2`, and `rename specs/C.mdx c c2` (each a section in a file of its own,
// so the operations share only the journal, derived files, and graph data),
// and RESOLVE_SERIES, `review resolve s <item> --status no-change` of the
// items of `g`, `b`, and `c` (leaf sections', unblocked from the start, 10.6)
// in the audit session `s` the staging creates while the workspace is valid
// (`review create --strategy audit --name s`, the items learned by `review
// status s --json` before anything starts) — runs the series' commands with
// no `--test-hold`, each under `--json`, unsynchronized, at offsets ranging
// from simultaneous to staggered across the span one of them takes alone:
// run j of n starts j/(n−1) × f × span after the first, for each fraction f
// of UNHELD_SPREAD_FRACTIONS, the span measured as the first command's run
// alone on its twin (scheduling only, never an assertion input, H-10). Each
// run exits 0, or exits 2 with `code` `"workspace-busy"` and `path`
// `".xspec/lock"`, never another outcome; once all have exited, `.xspec/lock`
// is absent and the workspace equals a twin's on which the successful runs'
// operations ran one after another, unheld, in one of their orders — the
// harness trying each, the order the runs exited in first — every success's
// rewritten source, journal line, and resolution present and no refused
// run's effect; a trial with a single success or none included (none: the
// workspace as staged).
//
// Twins: a fresh workspace staged as the trial's was, the operations run one
// after another, unheld, under `--json`, each required to exit 0 (the
// operations succeed alone and compose — a premise a product failing it
// fails diagnosed), `.xspec/lock` absent after them. SPEC 12.0's
// byte-determinism and 10.1's deterministic session files make one twin per
// staging and order serve every trial (`TwinCache`); the resolve series' twins
// name their own workspace's items, by scope.
//
// Unsynchronized by design (E-5): a fixed trial count, rule, and spread, in
// CI as everywhere; every assertion holds under every timing and schedule
// against a conforming product. CERTIFICATIONS.md §CONF-RACE certifies the
// test: its conformer (`test/fixtures/conf-race/bin.mjs`, the CONF-CORE
// product deviation-free) passes it whole; §VIOL-RACE-LISTFIRST, judging the
// lock directory before adding its entry, after a sustained interval, fails
// the held arm on every trial — more than one hold file standing — which
// certifies that its starts overlap; the unheld arm rides the same starts.
// Every command drawn from CONF-CORE's surface (§CONF-RACE's staging
// constraint): `build`, `rename`, `review create --strategy audit`, `review
// resolve`, and the `review status` read that learns the items.

import { setTimeout as sleep } from "node:timers/promises";
import { assertExitCode, fail } from "../../helpers/assertions.js";
import { LOCK_PATH } from "../../helpers/lock-path.js";
import { AREA_PATH } from "../../helpers/lock-staging.js";
import {
  assertHeldState,
  assertLockPathAbsent,
} from "../../helpers/lock-state.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { DirectorySnapshot } from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type {
  ProductBinding,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  pathExists,
  releaseHoldFile,
  rethrowHarnessError,
  startProduct,
  summarizeResult,
} from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  CORE_A_STAGED,
  runBounded,
  SPECS_ONLY_CONFIG,
} from "./section-13.5.js";
import { assertSameJson, buildOk, expectErrorDocument } from "./support.js";
import {
  holdPathFor,
  requireItemByScope,
  sessionStatus,
} from "./write-refusal-staging.js";

// ---------------------------------------------------------------------------
// The workspace, the operations, and the stagings
// ---------------------------------------------------------------------------

// The sources beside CORE_A_STAGED: every trial and twin workspace is created
// after the body's first product invocation, so each is a staged-source
// record (S-9's timing clause; helpers/staged-mdx.ts).
const T13_5_13_B = stagedMdx(
  "T13.5-13 specs/B.mdx (b alone, a leaf: the held arm's second rename, the unheld arm's second rename and resolve)",
  ['<S id="b">', "Bravo text.", "</S>", ""].join("\n"),
);

const T13_5_13_C = stagedMdx(
  "T13.5-13 specs/C.mdx (c alone, a leaf: the unheld arm's third rename and resolve)",
  ['<S id="c">', "Charlie text.", "</S>", ""].join("\n"),
);

/**
 * Every T13.5-13 workspace (module header): one spec group of plain `.mdx`
 * sources, three files, no file referencing another's section.
 */
export const T13_5_13_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/A.mdx": CORE_A_STAGED,
    "specs/B.mdx": T13_5_13_B,
    "specs/C.mdx": T13_5_13_C,
  },
};

/** The leaf items of `s` a staging learned, by scope (none without `s`). */
type StagedItems = ReadonlyMap<string, string>;

/** One mutating command of an arm. */
interface Operation {
  /** As diagnoses name it, item operands by their scope. */
  readonly what: string;
  /** Its arguments, `--json` and `--test-hold` aside. */
  readonly argv: (items: StagedItems) => readonly string[];
}

/** The item a staging learned for `scope` (a harness error where none). */
function itemAt(items: StagedItems, scope: string): string {
  const item = items.get(scope);
  if (item === undefined) {
    throw new Error(
      `T13.5-13: the staging learned no item scoped at ${scope}: only a ` +
        `staging creating the session \`s\` serves a \`review resolve\``,
    );
  }
  return item;
}

function renameOf(file: string, id: string): Operation {
  return {
    what: `\`rename ${file} ${id} ${id}2\``,
    argv: () => ["rename", file, id, `${id}2`],
  };
}

function reviewCreateOf(name: string): Operation {
  return {
    what: `\`review create --strategy audit --name ${name}\``,
    argv: () => ["review", "create", "--strategy", "audit", "--name", name],
  };
}

function resolveOf(scope: string): Operation {
  return {
    what: `\`review resolve s <the item of ${scope}> --status no-change\``,
    argv: (items) => [
      "review",
      "resolve",
      "s",
      itemAt(items, scope),
      "--status",
      "no-change",
    ],
  };
}

/**
 * The held arm's commands: renames of distinct sections and `review create`
 * under distinct names — each succeeding alone, on the built and the unbuilt
 * workspace (where acquisition brings `.xspec` into existence and a `review
 * create` holding exclusivity brings graph data into existence by its 13.3
 * refresh), and composing in any order.
 */
const HELD_OPERATIONS: readonly Operation[] = [
  renameOf("specs/A.mdx", "g"),
  renameOf("specs/B.mdx", "b"),
  reviewCreateOf("t"),
  reviewCreateOf("u"),
];

/** The unheld arm's renames: each of a section in a file of its own. */
const RENAME_SERIES: readonly Operation[] = [
  renameOf("specs/A.mdx", "g"),
  renameOf("specs/B.mdx", "b"),
  renameOf("specs/C.mdx", "c"),
];

/** The leaf sections whose items of `s` the resolve series names (10.6). */
const LEAF_SCOPES: readonly string[] = [
  "specs/A.mdx#g",
  "specs/B.mdx#b",
  "specs/C.mdx#c",
];

/** The unheld arm's resolves: distinct items of `s`, unblocked from the start. */
const RESOLVE_SERIES: readonly Operation[] = LEAF_SCOPES.map(resolveOf);

/** How a trial's or a twin's workspace is staged before anything starts. */
interface Staging {
  /** As diagnoses name it: `the built workspace`. */
  readonly name: string;
  /** Whether the workspace holds `.xspec` once staged. */
  readonly built: boolean;
  readonly stage: (
    product: ProductBinding,
    workspace: TestWorkspace,
    context: string,
  ) => Promise<StagedItems>;
}

const NO_ITEMS: StagedItems = new Map();

/** A freshly built workspace: `build`. */
const BUILT: Staging = {
  name: "the built workspace",
  built: true,
  stage: async (product, workspace, context) => {
    await buildOk(product, workspace, `${context} staging \`build\``);
    return NO_ITEMS;
  },
};

/** An unbuilt workspace: nothing run. */
const UNBUILT: Staging = {
  name: "the unbuilt workspace",
  built: false,
  stage: async () => NO_ITEMS,
};

/**
 * A freshly built valid workspace holding the audit session `s`, created
 * while it was valid, its leaf items learned by `review status s --json`
 * (CONF-CORE's `review` reads, §CONF-RACE's staging constraint).
 */
const WITH_SESSION: Staging = {
  name: "the built workspace holding `s`",
  built: true,
  stage: async (product, workspace, context) => {
    await buildOk(product, workspace, `${context} staging \`build\``);
    const created = await runBounded(
      product,
      workspace.root,
      ["review", "create", "--strategy", "audit", "--name", "s"],
      `${context} staging \`review create --strategy audit --name s\``,
    );
    assertExitCode(
      created,
      0,
      `${context} staging \`review create --strategy audit --name s\` ` +
        `(SPEC 10.6, 10.7)`,
    );
    const status = await sessionStatus(
      product,
      workspace,
      "s",
      `${context} staging`,
    );
    const items = new Map<string, string>();
    for (const scope of LEAF_SCOPES) {
      const row = requireItemByScope(status, scope, `${context} staging`);
      if (row.blocked) {
        fail(
          `${context} staging: the audit item of the leaf section ${scope} ` +
            `must be unblocked from the start — its \`blockedBy\` the items ` +
            `of its child sections, which a leaf has none of (SPEC 10.6, ` +
            `10.3)`,
        );
      }
      items.set(scope, row.id);
    }
    return items;
  },
};

// ---------------------------------------------------------------------------
// Trial counts, spreads, and hang guards (E-5, H-10)
// ---------------------------------------------------------------------------

/** The held arm's trials on each of the two workspaces. */
const HELD_TRIALS = 4;

/**
 * The unheld arm's spread, one trial per fraction for each series: run j of
 * n starts j/(n−1) × f × span after the first — from simultaneous (0) to
 * staggered across the span one run takes alone (1).
 */
const UNHELD_SPREAD_FRACTIONS: readonly number[] = [0, 0.1, 0.25, 0.5, 0.75, 1];

/**
 * The bound on every held-arm run's exiting or creating its hold file: a
 * run doing neither by then is waiting on another's exclusivity, or hung —
 * where 13.5 requires a run reaching acquisition to fail there promptly —
 * and fails diagnosed (H-8; a hang guard, never an assertion input, H-10).
 */
const SETTLE_TIMEOUT_MS = 60_000;

/**
 * Every run's own hang guard — a held run's, an unheld run's, a twin's, and
 * a staging command's. A held run's covers its own work alone: from the
 * moment the harness finds it holding until it lifts the hold, the guard
 * stands suspended, the run waiting on the harness (helpers/subprocess.ts;
 * TEST-SPEC S-3) — so no guard spans every other run's settling and the
 * held-state comparison (H-10: a guard, never an assertion input; a run
 * killed at it fails diagnosed, H-8).
 */
const RUN_TIMEOUT_MS = 60_000;

/** The settling poll's interval (scheduling only, H-10). */
const SETTLE_POLL_MS = 10;

// ---------------------------------------------------------------------------
// Starting runs together, and their outcomes
// ---------------------------------------------------------------------------

/** One run a trial started. */
interface StartedRun {
  readonly op: Operation;
  /** Its full arguments: the operation's, `--json`, `--test-hold` where held. */
  readonly argv: readonly string[];
  /** Its hold path, outside the workspace, in the held arm. */
  readonly hold: string | undefined;
  readonly running: RunningProduct;
  /** `performance.now()` once its exit was collected. */
  exitedAt: number | undefined;
}

/** What `startRuns` starts: an operation's arguments and its start offset. */
interface RunPlan {
  readonly op: Operation;
  readonly argv: readonly string[];
  readonly hold?: string;
  /** Milliseconds after the first start (0: together). */
  readonly offsetMs: number;
}

/**
 * Start every planned run in the workspace root, each at its offset after
 * the first — every one spawned before any is awaited, so the runs started
 * together genuinely overlap (§CONF-RACE: VIOL-RACE-LISTFIRST certifies it).
 * Where a start fails, every run started is killed and its exit collected
 * before the failure propagates.
 */
async function startRuns(
  product: ProductBinding,
  workspace: TestWorkspace,
  plans: readonly RunPlan[],
  timeoutMs: number,
): Promise<StartedRun[]> {
  const origin = performance.now();
  const settled = await Promise.allSettled(
    plans.map(async (plan): Promise<StartedRun> => {
      const wait = plan.offsetMs - (performance.now() - origin);
      if (wait > 0) await sleep(wait);
      const running = await startProduct(product, {
        cwd: workspace.root,
        argv: plan.argv,
        timeoutMs,
      });
      const run: StartedRun = {
        op: plan.op,
        argv: plan.argv,
        hold: plan.hold,
        running,
        exitedAt: undefined,
      };
      void running.waitForExit().then(
        () => {
          run.exitedAt = performance.now();
        },
        () => {
          run.exitedAt = performance.now();
        },
      );
      return run;
    }),
  );
  const runs: StartedRun[] = [];
  let failure: unknown;
  let failed = false;
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") runs.push(outcome.value);
    else if (!failed) {
      failed = true;
      failure = outcome.reason;
    }
  }
  if (failed) {
    await stopRuns(runs);
    throw failure;
  }
  return runs;
}

/**
 * Kill every run still going, lift every hold, and collect every exit, so
 * no run outlives its trial (a no-op for a run that has exited).
 */
async function stopRuns(runs: readonly StartedRun[]): Promise<void> {
  for (const run of runs) run.running.kill();
  for (const run of runs) {
    if (run.hold !== undefined) await releaseHoldFile(run.hold);
  }
  await Promise.allSettled(runs.map((run) => run.running.waitForExit()));
}

/**
 * A run's collected exit; a run killed at its hang guard is a diagnosed
 * failure (H-8), a harness error propagating as itself (H-11).
 */
async function exitOf(run: StartedRun, context: string): Promise<RunResult> {
  try {
    return await run.running.waitForExit();
  } catch (error) {
    rethrowHarnessError(error);
    return fail(
      `${context}: ${run.op.what} must terminate on its own rather than ` +
        `block or hang (SPEC 13.5: a run reaching acquisition while another ` +
        `holds fails there promptly; H-8) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * A run refused at acquisition: exit 2, its stdout the 12.7 error document —
 * `code` `"workspace-busy"`, `path` `".xspec/lock"`, `locations` `[]` (SPEC
 * 14.26, 12.7; `message` and `identities` informational).
 */
function assertBusyRefusal(
  result: RunResult,
  what: string,
  context: string,
): void {
  assertExitCode(
    result,
    2,
    `${context}: ${what}, refused at acquisition, exits 2 with the usage ` +
      `error of 14.26 — never another outcome (SPEC 13.5, 14.26, 12.0)`,
  );
  const finding = expectErrorDocument(result, `${context}: ${what}`);
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    { code: "workspace-busy", path: LOCK_PATH, locations: [] },
    `${context}: the refusal of ${what} carries the stable code ` +
      `"workspace-busy", the concerned path "${LOCK_PATH}", and no ` +
      `locations (SPEC 14.26, 12.7) — message: ` +
      `${JSON.stringify(finding.message)}`,
  );
}

// ---------------------------------------------------------------------------
// Twins and the comparisons with them
// ---------------------------------------------------------------------------

/** A twin's final state, and how long its first operation took alone. */
interface Twin {
  /** The twin workspace's whole root once its operations have run. */
  readonly after: DirectorySnapshot;
  /** Its first operation's run, spawn to exit, alone (the unheld span). */
  readonly firstSpanMs: number;
}

/** Stage a fresh T13.5-13 workspace, run `body`, dispose. */
async function withWorkspace<T>(
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create(T13_5_13_DECL);
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Twins, one per staging and order of operations (module header): a fresh
 * workspace staged as the trial's was, the operations run one after
 * another, unheld, under `--json`, each exiting 0, `.xspec/lock` absent
 * after them. Made once, when first asked for, and kept for every trial of
 * one body run.
 */
class TwinCache {
  readonly #twins = new Map<string, Promise<Twin>>();

  constructor(readonly product: ProductBinding) {}

  /** The twin of `ops` run in this order on a workspace `staging` stages. */
  async twin(staging: Staging, ops: readonly Operation[]): Promise<Twin> {
    const key = JSON.stringify([staging.name, ...ops.map((op) => op.what)]);
    let twin = this.#twins.get(key);
    if (twin === undefined) {
      twin = this.#make(staging, ops);
      this.#twins.set(key, twin);
    }
    return await twin;
  }

  async #make(staging: Staging, ops: readonly Operation[]): Promise<Twin> {
    const context =
      `T13.5-13 twin (${staging.name}; ` +
      `${ops.length === 0 ? "nothing run" : ops.map((op) => op.what).join(", then ")})`;
    return await withWorkspace(async (workspace) => {
      const items = await staging.stage(this.product, workspace, context);
      let firstSpanMs = 0;
      for (const [index, op] of ops.entries()) {
        const started = performance.now();
        const result = await runBounded(
          this.product,
          workspace.root,
          [...op.argv(items), "--json"],
          `${context} ${op.what}`,
          { timeoutMs: RUN_TIMEOUT_MS },
        );
        if (index === 0) firstSpanMs = performance.now() - started;
        assertExitCode(
          result,
          0,
          `${context}: ${op.what} succeeds, unheld${index === 0 ? "" : ", after the operations before it"} — the operations each succeed alone and compose in any order, the premise every comparison with this twin rests on (SPEC 6.4, 10.6, 10.7, 13.5)`,
        );
      }
      await assertLockPathAbsent(
        workspace.root,
        `${context}, once its operations have run`,
      );
      return { after: await snapshotDirectory(workspace.root), firstSpanMs };
    });
  }
}

/** Whether a snapshot key is the journal or lies under the session directory. */
function isJournalOrSession(key: string): boolean {
  return key === ".xspec/journal" || key.startsWith(".xspec/reviews/");
}

/**
 * Afterwards, the workspace a success left (module header): the journal and
 * the session files exactly the twin's — asserted first, for its own
 * diagnosis — then every path (H-6 across directories: the lock path left
 * out, asserted absent apart).
 */
function assertAsTwin(
  twin: Twin,
  after: DirectorySnapshot,
  context: string,
): void {
  const durable = diffSnapshots(twin.after, after).filter((change) =>
    isJournalOrSession(change.key),
  );
  if (durable.length > 0) {
    fail(
      `${context}: the journal's lines and the session files must be exactly ` +
        `the successful operations' — no append or resolution lost, none of ` +
        `a refused run's (SPEC 13.5, 6.1, 10.1); relative to the twin:\n` +
        durable
          .map((change) => `${change.change} ${change.path}: ${change.detail}`)
          .join("\n"),
    );
  }
  assertSnapshotsEqual(
    twin.after,
    after,
    `${context}: the workspace equals the twin's (SPEC 13.5; H-6, the lock ` +
      `path aside, asserted absent apart)`,
  );
}

/**
 * Absent a success, the workspace as staged (a snapshot of its own root
 * taken before anything started, the lock path left out under H-6 and
 * asserted absent apart) — save, where the staging found no `.xspec`, that
 * directory left behind empty: 13.5's one stated residue of overlapping
 * acquisitions, and nothing else.
 */
function assertAsStaged(
  staged: DirectorySnapshot,
  after: DirectorySnapshot,
  context: string,
): void {
  let view = after;
  const area = after.entries.get(AREA_PATH);
  const areaHolds = [...after.entries.keys()].some((key) =>
    key.startsWith(`${AREA_PATH}/`),
  );
  if (!staged.entries.has(AREA_PATH) && area?.kind === "dir" && !areaHolds) {
    view = {
      ...after,
      entries: new Map([...after.entries].filter(([key]) => key !== AREA_PATH)),
    };
  }
  assertSnapshotsEqual(
    staged,
    view,
    `${context}: with no success, the workspace is as staged — a refused ` +
      `run modifies nothing (SPEC 13.5, 14.26) — save that, where it held ` +
      `no ${AREA_PATH}, an empty ${AREA_PATH} may remain, 13.5's one stated ` +
      `residue of overlapping acquisitions, and nothing else may (H-6: the ` +
      `lock path aside, asserted absent apart)`,
  );
}

// ---------------------------------------------------------------------------
// The held arm
// ---------------------------------------------------------------------------

/** One-line state of a run, for diagnoses. */
async function describeRun(run: StartedRun): Promise<string> {
  if (!run.running.hasExited()) {
    return `${run.op.what}: still running${run.hold !== undefined && (await pathExists(run.hold)) ? ", its hold file created" : ""}`;
  }
  try {
    return `${run.op.what}: ${summarizeResult(await run.running.waitForExit())}`;
  } catch (error) {
    rethrowHarnessError(error);
    return `${run.op.what}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Wait until each run has either exited or created its hold file (TEST-SPEC
 * T13.5-13: every hold file stands until then), bounded by
 * SETTLE_TIMEOUT_MS: a run doing neither by then fails diagnosed (H-8).
 */
async function awaitExitedOrHolding(
  runs: readonly StartedRun[],
  context: string,
): Promise<void> {
  const deadline = performance.now() + SETTLE_TIMEOUT_MS;
  for (;;) {
    const pending: StartedRun[] = [];
    for (const run of runs) {
      if (run.running.hasExited()) continue;
      // A run found holding waits on the harness from here: its own hang
      // guard stands suspended until its hold is lifted (TEST-SPEC S-3).
      if (
        run.hold !== undefined &&
        (await run.running.holdFileStands(run.hold))
      )
        continue;
      pending.push(run);
    }
    if (pending.length === 0) return;
    if (performance.now() >= deadline) {
      const states = await Promise.all(runs.map(describeRun));
      fail(
        `${context}: each run, started together with the others, either ` +
          `exits or creates its hold file — a run reaching acquisition while ` +
          `another holds fails there promptly, never waiting for that ` +
          `holder's exclusivity to end (SPEC 13.5; H-8) — but after ` +
          `${String(SETTLE_TIMEOUT_MS)} ms ` +
          `${pending.map((run) => run.op.what).join(", ")} did neither:\n` +
          states.join("\n"),
      );
    }
    await sleep(SETTLE_POLL_MS);
  }
}

/** One held trial's outcome (probes read it; the registered body ignores it). */
export interface HeldTrialReport {
  /** The staging: `the built workspace` or `the unbuilt workspace`. */
  readonly workspace: string;
  readonly trial: number;
  /** The operation that acquired, or `null` where none did. */
  readonly success: string | null;
}

/** One trial of the held arm (module header) on a fresh workspace. */
async function heldTrial(
  product: ProductBinding,
  staging: Staging,
  trial: number,
  twins: TwinCache,
): Promise<HeldTrialReport> {
  const context =
    `T13.5-13 held arm, ${staging.name}, trial ${String(trial)} of ` +
    String(HELD_TRIALS);
  return await withWorkspace(async (workspace) => {
    await staging.stage(product, workspace, context);
    await assertLockPathAbsent(
      workspace.root,
      `${context}: staging premise, before the runs start`,
    );
    const staged = await snapshotDirectory(workspace.root);
    const plans = HELD_OPERATIONS.map((op, index): RunPlan => {
      const hold = holdPathFor(workspace, `hold-race-${String(index)}.tmp`);
      return {
        op,
        argv: [...op.argv(NO_ITEMS), "--json", "--test-hold", hold],
        hold,
        offsetMs: 0,
      };
    });
    const runs = await startRuns(product, workspace, plans, RUN_TIMEOUT_MS);
    try {
      await awaitExitedOrHolding(runs, context);
      const holding: StartedRun[] = [];
      for (const run of runs) {
        if (
          run.hold !== undefined &&
          (await run.running.holdFileStands(run.hold))
        ) {
          holding.push(run);
        }
      }
      if (holding.length > 1) {
        const states = await Promise.all(runs.map(describeRun));
        fail(
          `${context}: once every run has exited or created its hold file, ` +
            `at most one hold file exists — of runs whose acquisitions ` +
            `overlap at most one acquires, possibly none, the others ` +
            `refused (SPEC 13.5, 14.26) — but ${String(holding.length)} ` +
            `exist: ${holding.map((run) => run.op.what).join(", ")} each ` +
            `acquired:\n${states.join("\n")}`,
        );
      }
      for (const run of runs) {
        if (holding.includes(run)) continue;
        assertBusyRefusal(
          await exitOf(run, context),
          run.op.what,
          `${context} (${run.op.what} created no hold file)`,
        );
      }
      const holder = holding[0];
      if (holder?.hold === undefined) {
        await assertLockPathAbsent(
          workspace.root,
          `${context}: once every run has been refused`,
        );
        assertAsStaged(
          staged,
          await snapshotDirectory(workspace.root),
          `${context}, every run refused`,
        );
        return { workspace: staging.name, trial, success: null };
      }
      if (holder.running.hasExited()) {
        fail(
          `${context}: ${holder.op.what} created its hold file and proceeds ` +
            `only once the harness deletes it (SPEC 13.5's seam), but it ` +
            `exited first — ${await describeRun(holder)}`,
        );
      }
      await assertHeldState(
        workspace.root,
        { baseline: staged, heldRuns: 1 },
        `${context}, while ${holder.op.what} holds, every other run refused ` +
          `(modifying nothing), against the workspace as staged`,
      );
      await releaseHoldFile(holder.hold);
      assertExitCode(
        await exitOf(holder, context),
        0,
        `${context}: ${holder.op.what}, its hold lifted, completes, exit 0 ` +
          `(SPEC 13.5)`,
      );
      await assertLockPathAbsent(
        workspace.root,
        `${context}: once every run has ended`,
      );
      assertAsTwin(
        await twins.twin(staging, [holder.op]),
        await snapshotDirectory(workspace.root),
        `${context}, ${holder.op.what} the one success, against a twin on ` +
          `which it alone ran`,
      );
      return { workspace: staging.name, trial, success: holder.op.what };
    } finally {
      await stopRuns(runs);
    }
  });
}

/**
 * The held arm (module header): HELD_TRIALS trials on a freshly built
 * workspace, then as many on an unbuilt one. Exported for probes.
 */
export async function runT13513HeldArm(
  product: ProductBinding,
  twins: TwinCache = new TwinCache(product),
): Promise<HeldTrialReport[]> {
  const reports: HeldTrialReport[] = [];
  for (const staging of [BUILT, UNBUILT]) {
    for (let trial = 1; trial <= HELD_TRIALS; trial += 1) {
      reports.push(await heldTrial(product, staging, trial, twins));
    }
  }
  return reports;
}

// ---------------------------------------------------------------------------
// The unheld arm
// ---------------------------------------------------------------------------

/** One series of the unheld arm (module header). */
interface Series {
  /** As diagnoses name it. */
  readonly name: string;
  readonly staging: Staging;
  readonly ops: readonly Operation[];
}

const UNHELD_SERIES: readonly Series[] = [
  {
    name: "renames, each of a section in a file of its own",
    staging: BUILT,
    ops: RENAME_SERIES,
  },
  {
    name: "`review resolve` of distinct leaf items of `s`",
    staging: WITH_SESSION,
    ops: RESOLVE_SERIES,
  },
];

/** Every order of `items`. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const orders: T[][] = [];
  for (const [index, item] of items.entries()) {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const order of permutations(rest)) orders.push([item, ...order]);
  }
  return orders;
}

/** One unheld trial's outcome (probes read it; the body ignores it). */
export interface UnheldTrialReport {
  readonly series: string;
  /** The spread fraction of the trial's offsets. */
  readonly fraction: number;
  /** The successful operations, in the order their runs exited. */
  readonly successes: readonly string[];
}

/** One trial of the unheld arm (module header) on a fresh workspace. */
async function unheldTrial(
  product: ProductBinding,
  series: Series,
  fraction: number,
  spanMs: number,
  twins: TwinCache,
): Promise<UnheldTrialReport> {
  const context =
    `T13.5-13 unheld arm, ${series.name}, started ${String(fraction)} of ` +
    `a ${String(Math.round(spanMs))} ms span apart`;
  return await withWorkspace(async (workspace) => {
    const items = await series.staging.stage(product, workspace, context);
    await assertLockPathAbsent(
      workspace.root,
      `${context}: staging premise, before the runs start`,
    );
    const staged = await snapshotDirectory(workspace.root);
    const last = series.ops.length - 1;
    const plans = series.ops.map((op, index): RunPlan => ({
      op,
      argv: [...op.argv(items), "--json"],
      offsetMs: last === 0 ? 0 : (index * fraction * spanMs) / last,
    }));
    const runs = await startRuns(product, workspace, plans, RUN_TIMEOUT_MS);
    try {
      const successes: StartedRun[] = [];
      for (const run of runs) {
        const result = await exitOf(run, context);
        if (result.exitCode === 0) successes.push(run);
        else {
          assertBusyRefusal(
            result,
            run.op.what,
            `${context} (${run.op.what} did not exit 0: each run exits 0, ` +
              `or is refused at acquisition)`,
          );
        }
      }
      await assertLockPathAbsent(
        workspace.root,
        `${context}: once every run has exited`,
      );
      const after = await snapshotDirectory(workspace.root);
      successes.sort((x, y) => (x.exitedAt ?? 0) - (y.exitedAt ?? 0));
      const exitOrder = successes.map((run) => run.op);
      const report: UnheldTrialReport = {
        series: series.name,
        fraction,
        successes: exitOrder.map((op) => op.what),
      };
      if (exitOrder.length === 0) {
        assertAsStaged(staged, after, `${context}, every run refused`);
        return report;
      }
      const orders = [
        exitOrder,
        ...permutations(exitOrder).filter((order) =>
          order.some((op, index) => op !== exitOrder[index]),
        ),
      ];
      for (const order of orders) {
        const twin = await twins.twin(series.staging, order);
        if (diffSnapshots(twin.after, after).length === 0) return report;
      }
      assertAsTwin(
        await twins.twin(series.staging, exitOrder),
        after,
        `${context}: the workspace equals a twin's on which the successful ` +
          `runs' operations ran one after another, unheld, in one of their ` +
          `orders — none of the ${String(orders.length)} does, so a run ` +
          `acquired while another still wrote (SPEC 13.5: exclusivity lasts ` +
          `from acquisition to release, after a run's last write); compared ` +
          `with the order the runs exited in, ` +
          exitOrder.map((op) => op.what).join(", then "),
      );
      return fail(
        `${context}: no twin's state matched, yet the workspace equals the ` +
          `exit order's twin — a harness defect`,
      );
    } finally {
      await stopRuns(runs);
    }
  });
}

/**
 * The unheld arm (module header): for each series, the span its first
 * command takes alone (on its twin), then one trial per spread fraction.
 * Exported for probes.
 */
export async function runT13513UnheldArm(
  product: ProductBinding,
  twins: TwinCache = new TwinCache(product),
): Promise<UnheldTrialReport[]> {
  const reports: UnheldTrialReport[] = [];
  for (const series of UNHELD_SERIES) {
    const first = series.ops.slice(0, 1);
    const { firstSpanMs } = await twins.twin(series.staging, first);
    for (const fraction of UNHELD_SPREAD_FRACTIONS) {
      reports.push(
        await unheldTrial(product, series, fraction, firstSpanMs, twins),
      );
    }
  }
  return reports;
}

// ---------------------------------------------------------------------------
// T13.5-13
// ---------------------------------------------------------------------------

const T13_5_13 = defineProductTest({
  id: "T13.5-13",
  title:
    'overlapping acquisitions (property-style loop; unsynchronized by design, a fixed trial count, rule, and spread, E-5): held — repeatedly, on a freshly built workspace and on an unbuilt one, `rename specs/A.mdx g g2`, `rename specs/B.mdx b b2`, `review create --strategy audit --name t`, and `review create --strategy audit --name u` (each succeeding alone, composing in any order), each with its own hold path and under `--json`, are started together; every hold file stands until each run has exited or created its hold file, and then at most one hold file exists, each run that created none has exited 2 with `code` `"workspace-busy"`, `path` `".xspec/lock"`, `locations` `[]`, modifying nothing (the held-state comparison while the one holds), the run that created one exits 0 once its hold is lifted — a trial with no success acceptable — and afterwards the journal and the session files are exactly the success\'s, the workspace equals a twin\'s on which that operation alone ran (or the workspace as staged, absent a success), and `.xspec/lock` is absent, save that the unbuilt workspace without a success may keep an empty `.xspec` and nothing else; unheld — repeatedly, on a freshly built valid workspace, renames each of a section in a file of its own, and separately `review resolve s <item> --status no-change` of three leaf items of an `audit` session `s`, each under `--json` with no `--test-hold`, started at offsets from simultaneous to staggered across the span one takes alone, each exits 0 or exits 2 with `code` `"workspace-busy"` and `path` `".xspec/lock"`, and once all have exited `.xspec/lock` is absent and the workspace equals a twin\'s on which the successful runs\' operations ran one after another in one of their orders, the harness trying each (SPEC 13.5, 14.26, 12.0, H-6)',
  run: async (product) => {
    const twins = new TwinCache(product);
    await runT13513HeldArm(product, twins);
    await runT13513UnheldArm(product, twins);
  },
});

/** TEST-SPEC §13.5, part vi, in canonical ID order (SUITE-48). */
export const section135viTests: readonly ProductTestEntry[] = [T13_5_13];
