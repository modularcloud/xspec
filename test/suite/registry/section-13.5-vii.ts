// TEST-SPEC §13.5 (concurrency and isolation), part vii — SUITE-48: T13.5-6
// (workspace isolation), registered whole.
//
// SPEC 13.5: all state is workspace-local; instances operating on different
// workspaces, one root inside another included, never interfere where the
// workspaces share no file — no source both discover, and no path one
// writes that the other reads or writes — and the mutual exclusion of
// mutating commands is per workspace, so a hold in one workspace refuses no
// run in another.
//
// Two pairs (`T13_5_6_PAIRS`), each of two workspaces differing in file
// name, IDs, and texts, so that cross-workspace interference cannot cancel
// out — SHAPE_A's `specs/A.mdx` (`a` holding `a.k`, then `g`) and SHAPE_B's
// `specs/B.mdx` (`b` holding `b.k`, then `h`), each configuration
// SPECS_ONLY_CONFIG's, one spec group globbing `specs/**/*.mdx`:
// - siblings: two workspaces in temporary directories of their own
//   (CORE_DECL and ISO_TWO_DECL);
// - nested: an inner root `R/in` within the outer root `R` (NESTED_DECL),
//   each configuration globbing `specs/**/*.mdx` under its own root, so
//   neither discovers the other's sources and neither reads or writes a path
//   the other writes — the outer root's lock path `.xspec/lock` and the
//   inner's `in/.xspec/lock` among them (SPEC 7: the upward search from the
//   inner root finds the inner configuration first).
//
// The held arms (`runT1356HeldArm`), for each pair and each direction — a
// command held in either workspace: both workspaces get the session staging
// (`build`, `review create --strategy audit --name s`, the items learned by
// `review status s --json`), `.xspec/lock` absent in each once its staging
// runs have ended; `rename <file> <top> <top>2 --test-hold <path>` holds the
// one (the hold path outside both workspaces), the held-state comparison
// holding once its hold file appears (TEST-SPEC §13.5's preamble;
// helpers/lock-state.ts `assertHeldState`, against the held workspace
// before the run started); then each of the other workspace's five
// mutating commands (`otherOperations`: `rename <file> <leaf> <leaf>2`, the
// file-form `move <file> <moveTo>`, `review create --strategy audit --name
// t`, `review resolve s <leaf's item> --status no-change`, and `review split
// s <top's item>`, each composing with those before it) runs to completion
// under a hang guard — a run waiting on the hold, killed there, a diagnosed
// failure (H-8) — and exits 0, the held command still running after each,
// so the hold stands, and `.xspec/lock` absent in the other workspace once
// each has ended (SPEC 13.5: release on every normal end). Once all five
// have ended, the held-state comparison holds again — against the held
// workspace before the run started as the other workspace's completed
// writes changed it (`baselineAfterOtherRuns`: for the nested pair's outer
// root held, its state before the hold with the inner root's subtree as the
// inner runs left it; else that state itself) — and the held run's entry
// stands unchanged, the lock directory's only one (no run in another
// workspace removing or altering it); the hold lifted, the held command
// exits 0 and `.xspec/lock` is absent in its workspace.
//
// The concurrent arms (`runT1356ConcurrentArm`), for each pair: a serial
// reference — the pair staged fresh, the first workspace's script (`script`:
// `build`, `review create --strategy audit --name s`, `review status s
// --json`, `review resolve s <leaf's item> --status no-change`, `review
// split s <top's item>`, `rename <file> <top> <top>2`, `move <file>
// <moveTo>`, `ids --json`, and `check`, every mutating command among them,
// each step exiting 0) run to completion, then the second's — and
// CONCURRENT_OFFSETS.length trials, each on a pair staged fresh, the two
// scripts started together but for an offset: for each fraction f, the
// second workspace's script starts f × span after the first's (the first's
// |f| × span after the second's for f < 0), the span the serial run of the
// first workspace's script (scheduling only, never an assertion input,
// H-10). Each step's run ends as the serial run's did — exit code, stdout,
// and stderr byte-identical (H-6: byte-identical outputs) — each pair's
// final trees equal the serial ones (H-6 across directories: every lock
// path, the nested root's included, left out; the nested pair's outer
// tree holding the inner root whole), and `.xspec/lock` is absent in both
// workspaces. Unsynchronized by design (E-5): a fixed trial count, rule,
// and spread, in CI as everywhere; every assertion holds under every timing
// and schedule against a conforming product, the two workspaces sharing no
// file.
//
// Uncertified (CERTIFICATIONS.md's Exclusions: T13.5-6's isolation is the
// harness's own H-1 obligation, its held arms positive outcomes). Every
// command is drawn from CONF-CORE's surface — `build`, `rename`, file-form
// `move`, `review create --strategy audit`, `resolve`, `split`, and the
// `review status`, `ids`, and `check` reads — on CONF-CORE-shaped
// workspaces, so the CONF-CORE conformer serves as a reference.

import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type { SessionStatusReport } from "../../helpers/adapters/index.js";
import { decodeSessionStatusReport } from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  HarnessAssertionError,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertRunOutcomesEqual } from "../../helpers/determinism.js";
import {
  assertHeldState,
  assertLockPathAbsent,
  assertOnlyEntry,
} from "../../helpers/lock-state.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type {
  DirectorySnapshot,
  SnapshotEntry,
} from "../../helpers/snapshot.js";
import {
  assertDirectoriesEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import {
  releaseHoldFile,
  rethrowHarnessError,
  startProduct,
} from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { SessionItems } from "./section-13.5.js";
import {
  CORE_A_STAGED,
  CORE_DECL,
  describeExit,
  runBounded,
  SPECS_ONLY_CONFIG,
} from "./section-13.5.js";
import { exitOnceLifted } from "./section-13.5-ii.js";
import { awaitHoldFile } from "./write-refusal-staging.js";

// ---------------------------------------------------------------------------
// The two pairs
// ---------------------------------------------------------------------------

/** One workspace's one spec source, and the names its commands use. */
interface WorkspaceShape {
  /** Its one spec source. */
  readonly file: string;
  /**
   * A top-level section holding a child: the held `rename`'s and the
   * script's, and `split`'s, its audit item's scope root keeping a child
   * (SPEC 10.7).
   */
  readonly top: string;
  /**
   * A top-level leaf, its audit item unblocked, so `resolve` applies (SPEC
   * 10.6, 10.7): the other workspace's `rename`'s while one is held.
   */
  readonly leaf: string;
  /** The file-form `move`'s destination, a path no source occupies. */
  readonly moveTo: string;
}

const SHAPE_A: WorkspaceShape = {
  file: "specs/A.mdx",
  top: "a",
  leaf: "g",
  moveTo: "specs/M.mdx",
};

const SHAPE_B: WorkspaceShape = {
  file: "specs/B.mdx",
  top: "b",
  leaf: "h",
  moveTo: "specs/N.mdx",
};

// SHAPE_B's source, differing from SHAPE_A's (CORE_A_STAGED) in file name,
// IDs, and texts. Every arm stages it in workspaces created after the body's
// first product invocation, so it is a staged-source record (S-9's
// before-any-product clause; helpers/staged-mdx.ts).
const ISO_TWO_MDX = stagedMdx(
  "T13.5-6 specs/B.mdx (b holding b.k, then h: the sibling pair's workspace 2 and the nested pair's inner root in/specs/B.mdx, in every held arm's, serial reference's, and concurrent trial's staging)",
  [
    '<S id="b">',
    "Bravo isolated text.",
    '<S id="b.k">',
    "Bravo kid text.",
    "</S>",
    "</S>",
    "",
    '<S id="h">',
    "Hotel isolated text.",
    "</S>",
    "",
  ].join("\n"),
);

/** The sibling pair's workspace 2. */
const ISO_TWO_DECL: WorkspaceDecl = {
  files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/B.mdx": ISO_TWO_MDX },
};

/** The nested pair's inner root, relative to the outer root. */
const INNER = "in";

/**
 * The nested pair: the outer root `R` holding SHAPE_A's workspace and, at
 * `R/in`, SHAPE_B's — each root its own configuration.
 */
const NESTED_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/A.mdx": CORE_A_STAGED,
    [`${INNER}/xspec.config.ts`]: SPECS_ONLY_CONFIG,
    [`${INNER}/specs/B.mdx`]: ISO_TWO_MDX,
  },
};

/** A pair's two workspaces as staged. */
interface StagedPair {
  /** The two workspaces' roots, in the pair's order. */
  readonly roots: readonly [string, string];
  /** A directory outside both workspaces, for hold paths. */
  readonly holdDir: string;
  dispose(): Promise<void>;
}

/** Two workspaces sharing no file (TEST-SPEC T13.5-6). */
export interface IsolationPair {
  /** "sibling" or "nested". */
  readonly name: string;
  /** Each workspace's name in diagnoses, in the pair's order. */
  readonly labels: readonly [string, string];
  readonly shapes: readonly [WorkspaceShape, WorkspaceShape];
  /**
   * The workspaces whose final trees the concurrent arms compare, by index:
   * both siblings; the nested pair's outer root alone, its tree holding the
   * inner root whole.
   */
  readonly treeRoots: readonly (0 | 1)[];
  /** Stage the pair afresh. */
  stage(): Promise<StagedPair>;
}

const SIBLINGS: IsolationPair = {
  name: "sibling",
  labels: ["workspace 1", "workspace 2"],
  shapes: [SHAPE_A, SHAPE_B],
  treeRoots: [0, 1],
  stage: async () => {
    const one = await TestWorkspace.create(CORE_DECL);
    let two: TestWorkspace;
    try {
      two = await TestWorkspace.create(ISO_TWO_DECL);
    } catch (error) {
      await one.dispose();
      throw error;
    }
    return {
      roots: [one.root, two.root],
      holdDir: one.tempRoot,
      dispose: async () => {
        await one.dispose();
        await two.dispose();
      },
    };
  },
};

const NESTED: IsolationPair = {
  name: "nested",
  labels: ["the outer root R", "the inner root R/in"],
  shapes: [SHAPE_A, SHAPE_B],
  treeRoots: [0],
  stage: async () => {
    const outer = await TestWorkspace.create(NESTED_DECL);
    return {
      roots: [outer.root, path.join(outer.root, INNER)],
      holdDir: outer.tempRoot,
      dispose: async () => {
        await outer.dispose();
      },
    };
  },
};

/** T13.5-6's pairs, in the order its arms take them. */
export const T13_5_6_PAIRS: readonly IsolationPair[] = [SIBLINGS, NESTED];

// ---------------------------------------------------------------------------
// Runs and the session staging
// ---------------------------------------------------------------------------

/**
 * Run `argv` in `root` to completion under `runBounded`'s hang guard — a run
 * that blocks or waits instead of exiting, killed there, a diagnosed failure
 * (H-8) — and require exit 0.
 */
async function runOk(
  product: ProductBinding,
  root: string,
  argv: readonly string[],
  context: string,
  rule: string,
): Promise<RunResult> {
  const result = await runBounded(product, root, argv, context);
  assertExitCode(result, 0, `${context}: ${rule}`);
  return result;
}

/** The one item of `report` scoped at `scope`, diagnosed when not one. */
function itemByScope(
  report: SessionStatusReport,
  scope: string,
  context: string,
): string {
  const rows = report.items.filter((row) => row.scope === scope);
  const [row] = rows;
  if (row === undefined || rows.length !== 1) {
    return fail(
      `${context}: the audit session must hold exactly one item scoped at ` +
        `\`${scope}\` (SPEC 10.6: one \`subtree-coherence\` item per ` +
        `requirement node; 10.1: at most one item per kind and scope ` +
        `node); found ${String(rows.length)}`,
    );
  }
  return row.id;
}

/**
 * The items a `review status s --json` run reports for `shape`'s workspace:
 * its leaf's and its top section's, by scope (SPEC 10.6, 10.7).
 */
function itemsOf(
  result: RunResult,
  shape: WorkspaceShape,
  context: string,
): SessionItems {
  const report = decodeSessionStatusReport(
    parseJsonStdout(result, context),
    context,
  );
  return {
    leaf: itemByScope(report, `${shape.file}#${shape.leaf}`, context),
    parent: itemByScope(report, `${shape.file}#${shape.top}`, context),
  };
}

/**
 * The held arms' session staging of the workspace at `root`, shaped
 * `shape`: `build`, `review create --strategy audit --name s` (the audit
 * session created while the workspace is valid), and the session's items
 * learned by `review status s --json`, each exiting 0 — then nothing at
 * `.xspec/lock` (SPEC 13.5: release on every normal end; T13.5-11).
 */
async function stageSession(
  product: ProductBinding,
  root: string,
  shape: WorkspaceShape,
  context: string,
): Promise<SessionItems> {
  await runOk(
    product,
    root,
    ["build"],
    `${context} staging \`build\``,
    "a freshly staged valid workspace builds (SPEC 12.0)",
  );
  await runOk(
    product,
    root,
    ["review", "create", "--strategy", "audit", "--name", "s"],
    `${context} staging \`review create --strategy audit --name s\``,
    "an audit session is created on a freshly built valid workspace (SPEC 10.6, 10.7)",
  );
  const label = `${context} staging \`review status s --json\``;
  const status = await runOk(
    product,
    root,
    ["review", "status", "s", "--json"],
    label,
    "the session's status reads (SPEC 10.7)",
  );
  const items = itemsOf(status, shape, label);
  await assertLockPathAbsent(
    root,
    `${context}: once its staging runs have ended (SPEC 13.5: release on ` +
      `every normal end; T13.5-11)`,
  );
  return items;
}

// ---------------------------------------------------------------------------
// The held arms
// ---------------------------------------------------------------------------

/** One mutating command of the other workspace while one is held. */
interface OtherOperation {
  readonly what: string;
  readonly argv: readonly string[];
}

/**
 * The other workspace's mutating commands while one is held, in the order
 * they run: SPEC 13.5's five — `rename`, the file-form `move`, and the
 * mutating `review` subcommands, `create` under `--strategy audit` — each
 * composing with those before it on the session staging, as T13.5-2's
 * excluded commands do (section-13.5.ts): the leaf's rename and the file's
 * move leave the session's items addressable by their `id`s (SPEC 10.2: an
 * item stays actionable after its nodes are moved), the leaf's item is
 * resolved before the top section's split, and that scope root keeps its
 * child (10.7).
 */
function otherOperations(
  shape: WorkspaceShape,
  items: SessionItems,
): readonly OtherOperation[] {
  return [
    {
      what: `\`rename ${shape.file} ${shape.leaf} ${shape.leaf}2\``,
      argv: ["rename", shape.file, shape.leaf, `${shape.leaf}2`],
    },
    {
      what: `\`move ${shape.file} ${shape.moveTo}\``,
      argv: ["move", shape.file, shape.moveTo],
    },
    {
      what: "`review create --strategy audit --name t`",
      argv: ["review", "create", "--strategy", "audit", "--name", "t"],
    },
    {
      what: `\`review resolve s <${shape.file}#${shape.leaf}'s item> --status no-change\``,
      argv: ["review", "resolve", "s", items.leaf, "--status", "no-change"],
    },
    {
      what: `\`review split s <${shape.file}#${shape.top}'s item>\``,
      argv: ["review", "split", "s", items.parent],
    },
  ];
}

/** The held command: `rename <file> <top> <top>2`, `--test-hold` aside. */
function heldArgv(shape: WorkspaceShape): readonly string[] {
  return ["rename", shape.file, shape.top, `${shape.top}2`];
}

/**
 * The held workspace's expected state once the other workspace's runs have
 * completed (TEST-SPEC §13.5's preamble: its pre-invocation state as the
 * writes of another run completing meanwhile changed it): `baseline` itself
 * where the other root lies outside the held one; where it lies within —
 * the nested pair's outer root held — `baseline` with the inner root's
 * subtree replaced by that subtree as it stands now (a snapshot of the
 * inner root, nothing pruned), the inner runs' writes all lying under the
 * inner root and every other path of the outer workspace as it was.
 */
async function baselineAfterOtherRuns(
  baseline: DirectorySnapshot,
  heldRoot: string,
  otherRoot: string,
): Promise<DirectorySnapshot> {
  const rel = path.relative(heldRoot, otherRoot);
  if (
    rel === "" ||
    rel === ".." ||
    rel.startsWith(`..${path.sep}`) ||
    path.isAbsolute(rel)
  ) {
    return baseline;
  }
  const prefix = `${rel.split(path.sep).join("/")}/`;
  const inner = await snapshotDirectory(otherRoot);
  const entries = new Map<string, SnapshotEntry>();
  for (const [key, entry] of baseline.entries) {
    if (!key.startsWith(prefix)) entries.set(key, entry);
  }
  for (const [key, entry] of inner.entries) {
    entries.set(`${prefix}${key}`, entry);
  }
  // Bytewise path order, as a snapshot's map keeps it (latin1 keys: one
  // UTF-16 unit per byte).
  const sorted = new Map(
    [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return { ...baseline, entries: sorted };
}

/**
 * One held arm (module header): `pair` staged fresh, its workspace `held`
 * held while the other's five mutating commands run, each exiting 0 while
 * the hold stands.
 */
export async function runT1356HeldArm(
  product: ProductBinding,
  pair: IsolationPair,
  held: 0 | 1,
): Promise<void> {
  const other = held === 0 ? 1 : 0;
  const heldLabel = pair.labels[held];
  const otherLabel = pair.labels[other];
  const arm = `T13.5-6 ${pair.name} pair, ${heldLabel} held`;
  const staged = await pair.stage();
  try {
    const heldRoot = staged.roots[held];
    const otherRoot = staged.roots[other];
    await stageSession(
      product,
      heldRoot,
      pair.shapes[held],
      `${arm}: ${heldLabel}`,
    );
    const items = await stageSession(
      product,
      otherRoot,
      pair.shapes[other],
      `${arm}: ${otherLabel}`,
    );
    const argv = heldArgv(pair.shapes[held]);
    const heldContext = `${arm}: ${heldLabel}'s held \`${argv.join(" ")} --test-hold <path>\``;
    const hold = path.join(staged.holdDir, "hold-iso.tmp");
    const baseline = await snapshotDirectory(heldRoot);
    const running = await startProduct(product, {
      cwd: heldRoot,
      argv: [...argv, "--test-hold", hold],
    });
    try {
      await awaitHoldFile(running, hold, heldContext);
      const entries = await assertHeldState(
        heldRoot,
        { baseline, heldRuns: 1 },
        `${heldContext}, once it holds, against ${heldLabel} before it started`,
      );
      const [entry] = entries;
      if (entry === undefined || entries.length !== 1) {
        throw new Error(
          `T13.5-6: assertHeldState returned ${String(entries.length)} ` +
            `entries for one held run`,
        );
      }
      for (const operation of otherOperations(pair.shapes[other], items)) {
        const context = `${arm}: ${otherLabel}'s ${operation.what} while ${heldLabel}'s command holds`;
        await runOk(
          product,
          otherRoot,
          operation.argv,
          context,
          `a mutating command held in one workspace leaves each mutating ` +
            `command in the other prompt and unrefused, exit 0 while the ` +
            `hold stands — mutual exclusion is per workspace, for sibling ` +
            `workspaces and for one root inside another alike (SPEC 13.5)`,
        );
        if (running.hasExited()) {
          fail(
            `${context}: ${heldLabel}'s held command must still be running ` +
              `once the run in ${otherLabel} has ended — the hold standing, ` +
              `that run's success is attributable to per-workspace ` +
              `exclusion alone (SPEC 13.5) — ${await describeExit(running)}`,
          );
        }
        await assertLockPathAbsent(
          otherRoot,
          `${context}, once it has ended (SPEC 13.5: release on every ` +
            `normal end; T13.5-11)`,
        );
      }
      const afterOthers = `${heldContext}, once ${otherLabel}'s five mutating commands have ended`;
      await assertHeldState(
        heldRoot,
        {
          baseline: await baselineAfterOtherRuns(baseline, heldRoot, otherRoot),
          heldRuns: 1,
        },
        `${afterOthers}, against ${heldLabel} before it started as their ` +
          `completed writes changed it — no run in another workspace ` +
          `modifying it (SPEC 13.5: instances operating on different ` +
          `workspaces never interfere)`,
      );
      await assertOnlyEntry(
        heldRoot,
        entry,
        `${afterOthers}: the held run's entry, which no run in another ` +
          `workspace removes or alters (SPEC 13.5)`,
      );
      await releaseHoldFile(hold);
      const result = await exitOnceLifted(running, heldContext);
      assertExitCode(
        result,
        0,
        `${heldContext}: completes normally once its hold is lifted (SPEC 13.5)`,
      );
      await assertLockPathAbsent(
        heldRoot,
        `${heldContext}, once it has ended (SPEC 13.5: release on every ` +
          `normal end; T13.5-11)`,
      );
    } finally {
      running.kill();
      await releaseHoldFile(hold);
    }
  } finally {
    await staged.dispose();
  }
}

// ---------------------------------------------------------------------------
// The concurrent arms
// ---------------------------------------------------------------------------

/**
 * The concurrent trials' start offsets, as fractions of the span (E-5's
 * fixed trial count, rule, and spread): the second workspace's script
 * starts f × span after the first's — the first's |f| × span after the
 * second's for f < 0 — so the scripts run together, and shifted either way
 * by a third of a script's run.
 */
const CONCURRENT_OFFSETS: readonly number[] = [0, 1 / 3, -1 / 3];

/** One step of a script: what it ran, and how it ended. */
interface ScriptRun {
  readonly what: string;
  readonly result: RunResult;
}

/**
 * The concurrent arms' script on the workspace at `root`, shaped `shape`:
 * `build`, `review create --strategy audit --name s`, `review status s
 * --json` (the items the next two steps name, by scope), `review resolve s
 * <leaf's item> --status no-change`, `review split s <top's item>`, `rename
 * <file> <top> <top>2`, `move <file> <moveTo>`, `ids --json`, and `check` —
 * each step required to exit 0, as it does alone. Returns every step's run.
 */
async function runScript(
  product: ProductBinding,
  root: string,
  shape: WorkspaceShape,
  context: string,
): Promise<readonly ScriptRun[]> {
  const runs: ScriptRun[] = [];
  const step = async (
    what: string,
    argv: readonly string[],
  ): Promise<RunResult> => {
    const result = await runOk(
      product,
      root,
      argv,
      `${context} ${what}`,
      "each step of the script succeeds on its own workspace (SPEC 13.5: " +
        "instances operating on different workspaces never interfere)",
    );
    runs.push({ what, result });
    return result;
  };
  await step("`build`", ["build"]);
  await step("`review create --strategy audit --name s`", [
    "review",
    "create",
    "--strategy",
    "audit",
    "--name",
    "s",
  ]);
  const statusWhat = "`review status s --json`";
  const status = await step(statusWhat, ["review", "status", "s", "--json"]);
  const items = itemsOf(status, shape, `${context} ${statusWhat}`);
  await step(
    `\`review resolve s <${shape.file}#${shape.leaf}'s item> --status no-change\``,
    ["review", "resolve", "s", items.leaf, "--status", "no-change"],
  );
  await step(`\`review split s <${shape.file}#${shape.top}'s item>\``, [
    "review",
    "split",
    "s",
    items.parent,
  ]);
  await step(`\`rename ${shape.file} ${shape.top} ${shape.top}2\``, [
    "rename",
    shape.file,
    shape.top,
    `${shape.top}2`,
  ]);
  await step(`\`move ${shape.file} ${shape.moveTo}\``, [
    "move",
    shape.file,
    shape.moveTo,
  ]);
  await step("`ids --json`", ["ids", "--json"]);
  await step("`check`", ["check"]);
  return runs;
}

/** A trial's offset, for diagnoses. */
function describeOffset(offset: number): string {
  if (offset === 0) return "0 (the two scripts started together)";
  const third = Math.round(Math.abs(offset) * 3);
  const fraction = `${String(third)}/3 of the span`;
  return offset > 0
    ? `+${fraction} (the second workspace's script started that much later)`
    : `-${fraction} (the first workspace's script started that much later)`;
}

/**
 * One concurrent trial: `pair` staged fresh, the two scripts started
 * `offset` × `span` apart (CONCURRENT_OFFSETS), each step's run then
 * compared with the serial reference's, the final trees with the serial
 * reference's (H-6 across directories), and nothing at `.xspec/lock` in
 * either workspace.
 */
async function concurrentTrial(
  product: ProductBinding,
  pair: IsolationPair,
  serial: StagedPair,
  serialRuns: readonly [readonly ScriptRun[], readonly ScriptRun[]],
  offset: number,
  span: number,
): Promise<void> {
  const arm = `T13.5-6 ${pair.name} pair, concurrent trial at offset ${describeOffset(offset)}`;
  const trial = await pair.stage();
  try {
    const delays = [Math.max(0, -offset) * span, Math.max(0, offset) * span];
    const settled = await Promise.allSettled(
      ([0, 1] as const).map(async (index) => {
        const delay = delays[index] ?? 0;
        if (delay > 0) await sleep(delay);
        return await runScript(
          product,
          trial.roots[index],
          pair.shapes[index],
          `${arm}: ${pair.labels[index]}'s`,
        );
      }),
    );
    // A harness error in either script — an exhausted capture limit, a
    // failed in-run evaluation — is the harness's own failure (H-11),
    // reported ahead of any diagnosed one.
    for (const outcome of settled) {
      if (outcome.status === "rejected") rethrowHarnessError(outcome.reason);
    }
    const runs: (readonly ScriptRun[])[] = [];
    for (const outcome of settled) {
      if (outcome.status === "rejected") {
        const reason = outcome.reason as unknown;
        if (reason instanceof HarnessAssertionError) throw reason;
        return fail(
          `${arm}: ${reason instanceof Error ? reason.message : String(reason)}`,
        );
      }
      runs.push(outcome.value);
    }
    for (const index of [0, 1] as const) {
      const concurrent = runs[index] ?? [];
      const reference = serialRuns[index];
      if (concurrent.length !== reference.length) {
        throw new Error(
          `T13.5-6: ${String(concurrent.length)} concurrent runs against ` +
            `${String(reference.length)} serial ones`,
        );
      }
      reference.forEach((serialRun, step) => {
        const concurrentRun = concurrent[step] as ScriptRun;
        assertRunOutcomesEqual(
          concurrentRun.result,
          serialRun.result,
          `${arm}: ${pair.labels[index]}'s ${serialRun.what} ends as the ` +
            `serial run's did — concurrent results equal serial runs ` +
            `(SPEC 13.5, 12.0; H-1, H-6: byte-identical outputs)`,
          "the concurrently driven run",
          "the serial run",
        );
      });
    }
    for (const index of pair.treeRoots) {
      await assertDirectoriesEqual(
        trial.roots[index],
        serial.roots[index],
        `${arm}: ${pair.labels[index]}'s final tree` +
          (pair.treeRoots.length === 1
            ? `, the inner root's whole within it,`
            : "") +
          ` vs the serial run's — concurrent mutations in the two ` +
          `workspaces leave each exactly as serial runs do (SPEC 13.5, ` +
          `H-1; H-6 across directories, every lock path left out)`,
      );
    }
    for (const index of [0, 1] as const) {
      await assertLockPathAbsent(
        trial.roots[index],
        `${arm}: ${pair.labels[index]}, once its script has ended (SPEC ` +
          `13.5: release on every normal end; T13.5-11)`,
      );
    }
  } finally {
    await trial.dispose();
  }
}

/**
 * The concurrent arm of `pair` (module header): the serial reference, then
 * one concurrent trial per offset of CONCURRENT_OFFSETS.
 */
export async function runT1356ConcurrentArm(
  product: ProductBinding,
  pair: IsolationPair,
): Promise<void> {
  const serial = await pair.stage();
  try {
    const context = `T13.5-6 ${pair.name} pair, serial reference:`;
    const started = performance.now();
    const first = await runScript(
      product,
      serial.roots[0],
      pair.shapes[0],
      `${context} ${pair.labels[0]}'s`,
    );
    // Scheduling only, never an assertion input (H-10).
    const span = performance.now() - started;
    const second = await runScript(
      product,
      serial.roots[1],
      pair.shapes[1],
      `${context} ${pair.labels[1]}'s`,
    );
    for (const offset of CONCURRENT_OFFSETS) {
      await concurrentTrial(
        product,
        pair,
        serial,
        [first, second],
        offset,
        span,
      );
    }
  } finally {
    await serial.dispose();
  }
}

// ---------------------------------------------------------------------------
// T13.5-6 — workspace isolation
// ---------------------------------------------------------------------------

const T13_5_6 = defineProductTest({
  id: "T13.5-6",
  title:
    "workspace isolation (SPEC 13.5, H-1): exclusion is per workspace, for sibling workspaces and for an inner root `R/in` within the outer root `R` alike, each configuration globbing `specs/**/*.mdx` under its own root so that neither discovers the other's sources nor reads or writes a path the other writes — a mutating command held in either workspace (`rename <file> <top> <top>2 --test-hold <path>`, the hold path outside both; the held-state comparison holding once it holds and again once the other workspace's commands have ended, as their writes changed it, its entry the lock directory's only one, unchanged) leaves each mutating command in the other — `rename`, file-form `move`, `review create --strategy audit`, `review resolve`, and `review split`, in turn — prompt and unrefused, exit 0 while the hold stands, the held command still running after each and `.xspec/lock` absent in the other workspace once each has ended, the held command exiting 0 once lifted; and concurrent mutations in the two workspaces leave each exactly as serial runs do — for both pairs, two scripts of `build`, the five mutating commands, and `review status`, `ids`, and `check` reads, started together and at fixed offsets of a third of a script's run either way (E-5), each step ending as in the serial reference (exit code, stdout, and stderr byte-identical), the final trees equal to the serial ones (H-6 across directories, every lock path aside), and `.xspec/lock` absent afterwards",
  run: async (product) => {
    for (const pair of T13_5_6_PAIRS) {
      await runT1356HeldArm(product, pair, 0);
      await runT1356HeldArm(product, pair, 1);
    }
    for (const pair of T13_5_6_PAIRS) {
      await runT1356ConcurrentArm(product, pair);
    }
  },
});

export const section135viiTests: readonly ProductTestEntry[] = [T13_5_6];
