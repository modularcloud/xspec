// TEST-SPEC §13.5 (concurrency and isolation), part ii — SUITE-48: T13.5-10
// (acquisition), registered with two of its eight arms so far: (a)
// obstruction and (b) leftover takeover. Arms (c) to (h) — the busy
// refusal among bracketing leftovers and over a live entry unreadable or
// altered, acquisition's refused reads and writes, interference and another
// machine's holder, the acquirer's own identifier, the gap and its manual
// remedy, and acquisition listing no directory but those 13.5 names — are
// not yet implemented (FIX_PLAN Tasks 23 to 27 add them).
//
// Every arm is staged on a freshly built valid workspace holding an `audit`
// session `s` created while it was valid — section-13.5.ts's session staging
// (`stageSessionWorkspace`: a fresh CONF-CORE-shaped workspace, `build`,
// `review create --strategy audit --name s`, the session's items read by
// `review status s --json`), `.xspec/lock` checked absent once those runs
// have ended — and run with each mutating command in turn
// (`T13_5_10_OPERATIONS`: `rename`, file-form `move`, `review create
// --strategy audit`, `review resolve`, and `review split`), each an
// operation succeeding on an unstaged twin — the same staging and command
// on a workspace of its own with nothing staged beside it: exit 0,
// `.xspec/lock` absent once it ends — under `--json`. Every arm is staged
// afresh for each command, on a fresh workspace of its own, so no run meets
// what an earlier run's takeover or release left; and every run is bounded
// (`runBounded`): it completes promptly, and a product opening a staged
// FIFO — an open with no writer blocks — fails diagnosed at the bound
// (H-8), the harness itself never opening one (helpers/lock-staging.ts).
//
// (a) Obstruction (SPEC 13.5, 13.4, 14.24): `.xspec` a plain file, a
// symbolic link to a directory holding a journal and sessions — the
// workspace's own area as built, relocated outside the workspace behind
// the link (its session and graph data byte for byte, beside an empty
// journal: the staging runs write none, `rename` and `move` alone writing
// one, SPEC 6.1) — a dangling symbolic link, and a FIFO, the area's
// directory removed before each is staged; `.xspec/lock` a symbolic link to
// a directory outside the workspace holding a file, a symbolic link to a
// file outside it, a dangling symbolic link, and a FIFO. Each command exits
// 2 with the error document's `code` `"write-failure"`, `path` `".xspec"`
// or `".xspec/lock"` (the occupied path), `locations` `[]`, modifying
// nothing (the compare bracketing that run alone; H-6 leaves the lock path
// out of it, so the in-place check below judges an occupant there), the
// occupant byte-identical in place, every link's target untouched — nothing
// written, removed, or added through a link, a dangling link's target still
// absent — and a FIFO still a FIFO.
//
// (b) Leftover takeover (SPEC 13.5, 13.4): a plain file at `.xspec/lock`,
// and one with every permission removed; in a lock directory, a directory
// holding a file; a directory tree two levels deep — a directory holding a
// directory that holds a plain file, a symbolic link to a directory outside
// the workspace holding a file, a dangling symbolic link, and a FIFO; a
// symbolic link to a directory outside the workspace holding a file; a
// FIFO; a dead run's entry — a held `rename specs/A.mdx a a2` killed under
// T13.5-3's discipline (`killHeldRun`: its own process group, SIGKILL, its
// exit collected, the group confirmed gone) — and one with every
// permission removed, verified refused to the harness's own read first
// (E-1); and a dead run's entry carried into another workspace by a byte
// copy of the whole workspace made after the kill (13.5's entry created
// for another workspace). Each command exits 0, its result — exit code,
// standard output and standard error, and the final workspace (H-6: the
// lock path aside) — byte-equal to its unstaged twin's, `.xspec/lock`
// absent once it ends, every link's target outside the workspace
// byte-identical. Over a dead run's entry a `workspace-busy` refusal meets
// T13.5-3's reuse check: the trial is void, rerun on a fresh workspace a
// bounded number of times, where an identifier of the killed group is
// listed again (13.5's gap), and the test fails, diagnosed, where none is.
// No arm stages a plain file of the harness's own naming inside the lock
// directory — the entry form is the product's own (13.5), so such a file
// may read as an entry in 13.5's gap, which MAY refuse — so each entry here
// is a dead run's, its name and content the product's (helpers/
// lock-staging.ts refuses such a staging).
//
// CERTIFICATIONS.md: T13.5-10 lies in no certification scope (the
// Exclusions entry for T13.5-9 through T13.5-12 and T13.4-12): its stagings
// verify themselves on the harness before use, an ineffective staging a
// harness error (E-1, H-11), never a pass or a skip; and (b)'s symbolic
// links into foreign directories — its one unbraced staging, a removal
// following one deleting what the target holds — ride
// VIOL-LEFTOVER-FOLLOWLINK's certification of P-15 insofar as they share
// that leftover-staging machinery (helpers/lock-staging.ts's
// `stageLeftover`). The Linux leg's stagings: FIFOs, permission removals,
// and the process list (E-1).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { assertExitCode, fail } from "../../helpers/assertions.js";
import { assertRunOutcomesEqual } from "../../helpers/determinism.js";
import {
  applyReuseCheck,
  runVoidableTrial,
} from "../../helpers/kill-discipline.js";
import {
  copyLockPathFile,
  isLockPathBytes,
  LOCK_PATH,
} from "../../helpers/lock-path.js";
import type {
  DeadRun,
  LeftoverNode,
  OutsideChild,
  StagedLeftover,
} from "../../helpers/lock-staging.js";
import {
  AREA_PATH,
  assertFifosIntact,
  assertOutsideTargetsUntouched,
  assertStagingInPlace,
  describeTreeDifferences,
  killHeldRun,
  readLockPathTree,
  stageLeftover,
  verifyContentReadRefused,
} from "../../helpers/lock-staging.js";
import { assertLockPathAbsent } from "../../helpers/lock-state.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { DirectorySnapshot } from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { summarizeResult } from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { SessionItems, SessionOperation } from "./section-13.5.js";
import {
  CORE_DECL,
  runBounded,
  stageSessionWorkspace,
} from "./section-13.5.js";
import { assertSameJson, expectErrorDocument } from "./support.js";
import { holdPathFor, WRITE_FAILURE_CODE } from "./write-refusal-staging.js";

/** The stable code of 14.26, the busy refusal. */
const WORKSPACE_BUSY = "workspace-busy";

/**
 * T13.5-10's mutating commands, in turn: each an operation succeeding on
 * the session staging (`stageSessionWorkspace`) and from CONF-CORE's
 * surface — file-form `move`, `review create` under `--strategy audit` —
 * `resolve` and `split` naming `s`'s items as that workspace's own `review
 * status s --json` read them.
 */
const T13_5_10_OPERATIONS: readonly SessionOperation[] = [
  {
    what: "`rename specs/A.mdx a a2`",
    argv: () => ["rename", "specs/A.mdx", "a", "a2"],
  },
  {
    what: "`move specs/A.mdx specs/B.mdx`",
    argv: () => ["move", "specs/A.mdx", "specs/B.mdx"],
  },
  {
    what: "`review create --strategy audit --name t`",
    argv: () => ["review", "create", "--strategy", "audit", "--name", "t"],
  },
  {
    what: "`review resolve s <leaf item> --status no-change`",
    argv: (items) => [
      "review",
      "resolve",
      "s",
      items.leaf,
      "--status",
      "no-change",
    ],
  },
  {
    what: "`review split s <parent item>`",
    argv: (items) => ["review", "split", "s", items.parent],
  },
];

/** Stage a fresh workspace with the given declaration, run `body`, dispose. */
async function withWorkspace<T>(
  decl: WorkspaceDecl,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create(decl);
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * The session staging every arm and twin starts from, on a fresh
 * CONF-CORE-shaped workspace: `stageSessionWorkspace`, then `.xspec/lock`
 * absent once its runs have ended (SPEC 13.5: release on every normal end),
 * so that whatever an arm stages there is the arm's alone. Returns the
 * session's items.
 */
async function stageArmWorkspace(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<SessionItems> {
  const items = await stageSessionWorkspace(product, workspace, context);
  await assertLockPathAbsent(
    workspace.root,
    `${context}: once its staging runs have ended, before anything is ` +
      `staged (SPEC 13.5: release on every normal end; T13.5-11)`,
  );
  return items;
}

/** An operation's run on its unstaged twin, and the twin's final state. */
interface UnstagedTwin {
  readonly operation: SessionOperation;
  /** Its run under `--json`: exit 0. */
  readonly result: RunResult;
  /** The twin workspace's state once the run has ended. */
  readonly final: DirectorySnapshot;
}

/**
 * The unstaged twin of `operation` (TEST-SPEC T13.5-10: each command an
 * operation succeeding on an unstaged twin): the session staging, nothing
 * staged beside it, and the operation under `--json`, bounded — exit 0,
 * `.xspec/lock` absent once it ends.
 */
async function unstagedTwin(
  product: ProductBinding,
  operation: SessionOperation,
): Promise<UnstagedTwin> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const context = `T13.5-10: the unstaged twin of ${operation.what} --json`;
    const items = await stageArmWorkspace(product, workspace, context);
    const result = await runBounded(
      product,
      workspace.root,
      [...operation.argv(items), "--json"],
      context,
    );
    assertExitCode(
      result,
      0,
      `${context}: each command T13.5-10 runs is an operation succeeding on ` +
        `an unstaged twin — the same staging, nothing staged beside it ` +
        `(SPEC 13.5)`,
    );
    await assertLockPathAbsent(
      workspace.root,
      `${context}: once it has ended (SPEC 13.5: release on every normal end)`,
    );
    return {
      operation,
      result,
      final: await snapshotDirectory(workspace.root),
    };
  });
}

// ---------------------------------------------------------------------------
// (a) Obstruction
// ---------------------------------------------------------------------------

/** What a plain file staged at `.xspec` holds. */
const AREA_OCCUPANT_BYTES =
  "Not the graph-data area: an occupant left for manual deletion.\n";

/** One obstruction (a): its description, its path, and its staging. */
interface Obstruction {
  readonly what: string;
  /** The obstructed path: the write failure's concerned path. */
  readonly path: typeof AREA_PATH | typeof LOCK_PATH;
  /** Stage it on a session staging (`stageArmWorkspace`). */
  readonly stage: (workspace: TestWorkspace) => Promise<StagedLeftover>;
}

/**
 * The area's directory as the session staging left it, whose removal an
 * obstruction at `.xspec` needs: a directory (SPEC 10.1: the session lies at
 * `.xspec/reviews/s.json`; 13.3: graph data under `.xspec`), else a
 * diagnosed failure.
 */
async function requireAreaDirectory(
  workspace: TestWorkspace,
  context: string,
): Promise<string> {
  const areaAbs = path.join(workspace.root, AREA_PATH);
  let isDirectory = false;
  try {
    isDirectory = (await fsp.lstat(areaAbs)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!isDirectory) {
    fail(
      `${context}: once \`build\` and \`review create --strategy audit ` +
        `--name s\` have run, ${AREA_PATH} is a directory — graph data and ` +
        `the session \`s\` lie under it (SPEC 13.3, 10.1) — found none`,
    );
  }
  return areaAbs;
}

/**
 * Stage `node` at `.xspec` in place of the area's directory, which is
 * removed first, with all it holds (T13.5-10(a): the area's own path
 * occupied by anything but a directory).
 */
async function obstructArea(
  workspace: TestWorkspace,
  node: LeftoverNode,
  context: string,
): Promise<StagedLeftover> {
  const areaAbs = await requireAreaDirectory(workspace, context);
  await fsp.rm(areaAbs, { recursive: true });
  return await stageLeftover(workspace, AREA_PATH, node);
}

/**
 * The directory at `abs` declared as an outside target's entries, byte for
 * byte: plain files with their content, directories with theirs, names as
 * bytes. Anything else — a link, a FIFO — is beyond the relocation (an
 * outside target holds plain files and directories): a harness error.
 */
async function declareDirectory(abs: Buffer): Promise<OutsideChild[]> {
  const names = (await fsp.readdir(abs, { encoding: "buffer" })).sort(
    Buffer.compare,
  );
  const entries: OutsideChild[] = [];
  for (const name of names) {
    const child = Buffer.concat([abs, Buffer.from("/"), name]);
    const stats = await fsp.lstat(child);
    if (stats.isFile()) {
      entries.push({
        name,
        node: { kind: "file", content: await fsp.readFile(child) },
      });
    } else if (stats.isDirectory()) {
      entries.push({
        name,
        node: { kind: "dir", entries: await declareDirectory(child) },
      });
    } else {
      throw new Error(
        `harness error: T13.5-10(a)'s relocation of the area meets ` +
          `${child.toString()}, neither a plain file nor a directory, which ` +
          `a link target's declaration cannot carry`,
      );
    }
  }
  return entries;
}

/**
 * `.xspec` a symbolic link to a directory holding a journal and sessions:
 * the workspace's own area as the session staging left it — graph data and
 * the session `s`, byte for byte — declared as the link's target outside
 * the workspace, beside an empty journal where it holds none (the staging
 * runs write none: `rename` and `move` alone write one, SPEC 6.1), and the
 * area's directory then removed. A product following the link would meet
 * a workspace's whole area there, every command able to proceed through
 * it; the target is recorded, and judged untouched, as staged.
 */
async function relocateAreaBehindLink(
  workspace: TestWorkspace,
  context: string,
): Promise<StagedLeftover> {
  const areaAbs = await requireAreaDirectory(workspace, context);
  const entries = await declareDirectory(Buffer.from(areaAbs));
  const journal = Buffer.from("journal");
  if (!entries.some((entry) => Buffer.from(entry.name).equals(journal))) {
    entries.push({ name: journal, node: { kind: "file", content: "" } });
  }
  await fsp.rm(areaAbs, { recursive: true });
  return await stageLeftover(workspace, AREA_PATH, {
    kind: "symlink",
    target: { kind: "dir", entries },
  });
}

/**
 * Arm (a)'s obstructions (SPEC 13.5: where the area's own path holds
 * anything but a directory, a symbolic link included, whatever it targets,
 * or the lock path anything but a directory or a plain file, acquisition
 * removes nothing but fails with the write failure of 14.24, leaving the
 * occupant for manual deletion, 13.4). Each link's target lies in a
 * directory of its own outside the workspace (helpers/lock-staging.ts); a
 * link to a directory targets one holding a plain file.
 */
const OBSTRUCTIONS: readonly Obstruction[] = [
  {
    what: "`.xspec` a plain file",
    path: AREA_PATH,
    stage: (workspace) =>
      obstructArea(
        workspace,
        { kind: "file", content: AREA_OCCUPANT_BYTES },
        "T13.5-10(a) `.xspec` a plain file",
      ),
  },
  {
    what:
      "`.xspec` a symbolic link to a directory outside the workspace " +
      "holding a journal and sessions (the workspace's own area relocated)",
    path: AREA_PATH,
    stage: (workspace) =>
      relocateAreaBehindLink(
        workspace,
        "T13.5-10(a) `.xspec` a symbolic link to a directory",
      ),
  },
  {
    what: "`.xspec` a dangling symbolic link",
    path: AREA_PATH,
    stage: (workspace) =>
      obstructArea(
        workspace,
        { kind: "symlink", target: { kind: "dangling" } },
        "T13.5-10(a) `.xspec` a dangling symbolic link",
      ),
  },
  {
    what: "`.xspec` a FIFO",
    path: AREA_PATH,
    stage: (workspace) =>
      obstructArea(workspace, { kind: "fifo" }, "T13.5-10(a) `.xspec` a FIFO"),
  },
  {
    what:
      "`.xspec/lock` a symbolic link to a directory outside the workspace " +
      "holding a file",
    path: LOCK_PATH,
    stage: (workspace) =>
      stageLeftover(workspace, LOCK_PATH, {
        kind: "symlink",
        target: { kind: "dir" },
      }),
  },
  {
    what: "`.xspec/lock` a symbolic link to a file outside the workspace",
    path: LOCK_PATH,
    stage: (workspace) =>
      stageLeftover(workspace, LOCK_PATH, {
        kind: "symlink",
        target: { kind: "file" },
      }),
  },
  {
    what: "`.xspec/lock` a dangling symbolic link",
    path: LOCK_PATH,
    stage: (workspace) =>
      stageLeftover(workspace, LOCK_PATH, {
        kind: "symlink",
        target: { kind: "dangling" },
      }),
  },
  {
    what: "`.xspec/lock` a FIFO",
    path: LOCK_PATH,
    stage: (workspace) => stageLeftover(workspace, LOCK_PATH, { kind: "fifo" }),
  },
];

/**
 * One (a) run: on a fresh session staging, `obstruction` staged, then
 * `operation` under `--json`, bounded → exit 2, the error document's `code`
 * `"write-failure"`, `path` the obstructed path, `locations` `[]`; nothing
 * modified (the compare bracketing this run alone, H-6); the occupant
 * byte-identical in place, every link's target untouched, a FIFO still in
 * place (SPEC 13.5, 13.4, 14.24).
 */
async function obstructionRun(
  product: ProductBinding,
  operation: SessionOperation,
  obstruction: Obstruction,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context = `T13.5-10(a) ${operation.what} --json with ${obstruction.what}`;
    const items = await stageArmWorkspace(product, workspace, context);
    const staged = await obstruction.stage(workspace);
    const before = await snapshotDirectory(workspace.root);
    const result = await runBounded(
      product,
      workspace.root,
      [...operation.argv(items), "--json"],
      context,
    );
    assertExitCode(
      result,
      2,
      `${context}: acquisition removes nothing and fails with the write ` +
        `failure of 14.24 — a usage error, exit 2 — leaving the occupant for ` +
        `manual deletion, so no mutating command proceeds without ` +
        `exclusivity (SPEC 13.5, 13.4, 12.0)`,
    );
    const finding = expectErrorDocument(result, context);
    assertSameJson(
      { code: finding.code, path: finding.path, locations: finding.locations },
      { code: WRITE_FAILURE_CODE, path: obstruction.path, locations: [] },
      `${context}: the error document carries acquisition's write failure — ` +
        `the stable code "${WRITE_FAILURE_CODE}", the concerned path ` +
        `"${obstruction.path}" (the occupied path), and no locations (SPEC ` +
        `13.5, 12.7, 14.24; \`message\` and \`identities\` informational) — ` +
        `message: ${JSON.stringify(finding.message)}`,
    );
    assertSnapshotsEqual(
      before,
      await snapshotDirectory(workspace.root),
      `${context}: modifies nothing — every workspace path byte-identical, ` +
        `the compare bracketing this run alone (SPEC 13.5, 12.0; H-6)`,
    );
    await assertStagingInPlace(
      staged,
      `${context}: the occupant stays byte-identical in place, left for ` +
        `manual deletion (SPEC 13.5, 13.4)`,
    );
    await assertOutsideTargetsUntouched(
      staged,
      `${context}: nothing written, removed, or added through a link`,
    );
    await assertFifosIntact(staged, `${context}: the FIFO stays in place`);
  });
}

// ---------------------------------------------------------------------------
// (b) Leftover takeover
// ---------------------------------------------------------------------------

/** What each plain file the harness stages as (or in) a leftover holds. */
const LEFTOVER_BYTES = "A leftover the harness staged.\n";

/** One staged leftover of (b): its description, its path, and its node. */
interface Leftover {
  readonly what: string;
  /** `.xspec/lock` itself, or one occupant of the lock directory. */
  readonly at: string;
  readonly node: LeftoverNode;
}

/**
 * Arm (b)'s staged leftovers, each recording no identifier — so outside
 * 13.5's gap, none MAY refuse — each removed at acquisition (SPEC 13.5: a
 * plain file at the lock path is a leftover; in the lock directory,
 * anything that is no entry — a directory with all it holds and a symbolic
 * link itself, never its target). No plain file of the harness's own naming
 * lies at the lock directory's top level (TEST-SPEC T13.5-10(b)'s caution;
 * `stageLeftover` refuses one). The two-level tree fails a removal reaching
 * only one level into a directory; its links, and the link at the top
 * level, fail a removal following a link into its target.
 */
const LEFTOVERS: readonly Leftover[] = [
  {
    what: "a plain file at `.xspec/lock`",
    at: LOCK_PATH,
    node: { kind: "file", content: LEFTOVER_BYTES },
  },
  {
    what:
      "a plain file at `.xspec/lock` with every permission removed " +
      "(acquisition reads no file's content)",
    at: LOCK_PATH,
    node: { kind: "file", content: LEFTOVER_BYTES, mode: 0o000 },
  },
  {
    what: "a directory holding a file, in a lock directory",
    at: `${LOCK_PATH}/leftover-directory`,
    node: {
      kind: "dir",
      entries: [
        { name: "file", node: { kind: "file", content: LEFTOVER_BYTES } },
      ],
    },
  },
  {
    what:
      "a directory tree two levels deep, in a lock directory — a directory " +
      "holding a directory that holds a plain file, a symbolic link to a " +
      "directory outside the workspace holding a file, a dangling symbolic " +
      "link, and a FIFO",
    at: `${LOCK_PATH}/leftover-tree`,
    node: {
      kind: "dir",
      entries: [
        {
          name: "level-2",
          node: {
            kind: "dir",
            entries: [
              {
                name: "file",
                node: { kind: "file", content: LEFTOVER_BYTES },
              },
              {
                name: "link-to-directory",
                node: { kind: "symlink", target: { kind: "dir" } },
              },
              {
                name: "dangling-link",
                node: { kind: "symlink", target: { kind: "dangling" } },
              },
              { name: "fifo", node: { kind: "fifo" } },
            ],
          },
        },
      ],
    },
  },
  {
    what:
      "a symbolic link to a directory outside the workspace holding a " +
      "file, in a lock directory",
    at: `${LOCK_PATH}/leftover-link`,
    node: { kind: "symlink", target: { kind: "dir" } },
  },
  {
    what: "a FIFO, in a lock directory",
    at: `${LOCK_PATH}/leftover-fifo`,
    node: { kind: "fifo" },
  },
];

/**
 * A takeover's outcome (TEST-SPEC T13.5-10(b)): exit 0; its result
 * byte-equal to its unstaged twin's — exit code, standard output and
 * standard error, and the final workspace (H-6: the lock path aside, the
 * compare across two workspaces); `.xspec/lock` absent once it ends; every
 * staged link's target outside the workspace byte-identical, nothing
 * removed or written through a link (SPEC 13.5: a symbolic link itself,
 * never its target; 13.4: writes never traverse symbolic links).
 */
async function assertTakeover(
  root: string,
  result: RunResult,
  twin: UnstagedTwin,
  staged: readonly StagedLeftover[],
  context: string,
): Promise<void> {
  assertExitCode(
    result,
    0,
    `${context}: a leftover MUST NOT block later commands — acquisition ` +
      `removes it and the command proceeds, exit 0 (SPEC 13.5)`,
  );
  assertRunOutcomesEqual(
    result,
    twin.result,
    `${context}: its result is byte-equal to its unstaged twin's (SPEC ` +
      `13.5: acquisition's and release's writes modify nothing; H-6)`,
    "the run over the leftover",
    "its unstaged twin",
  );
  assertSnapshotsEqual(
    twin.final,
    await snapshotDirectory(root),
    `${context}: its final workspace is byte-equal to its unstaged twin's ` +
      `(H-6: the lock path aside)`,
  );
  await assertLockPathAbsent(
    root,
    `${context}: once it has ended — the leftover removed at acquisition, ` +
      `whole, and the run's own entry released (SPEC 13.5)`,
  );
  await assertOutsideTargetsUntouched(
    staged,
    `${context}: every link's target outside the workspace stays ` +
      `byte-identical — no removal follows a link into its target, ` +
      `deleting foreign content behind a reported success`,
  );
}

/**
 * One (b) run over a staged leftover: on a fresh session staging,
 * `leftover` staged (verified on the harness, helpers/lock-staging.ts), then
 * `operation` under `--json`, bounded, judged by `assertTakeover`.
 */
async function leftoverRun(
  product: ProductBinding,
  twin: UnstagedTwin,
  leftover: Leftover,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context = `T13.5-10(b) ${twin.operation.what} --json over ${leftover.what}`;
    const items = await stageArmWorkspace(product, workspace, context);
    const staged = await stageLeftover(workspace, leftover.at, leftover.node);
    const result = await runBounded(
      product,
      workspace.root,
      [...twin.operation.argv(items), "--json"],
      context,
    );
    await assertTakeover(workspace.root, result, twin, [staged], context);
  });
}

/** The held command whose kill leaves (b)'s dead run's entry. */
const KILLED_RENAME: readonly string[] = ["rename", "specs/A.mdx", "a", "a2"];

/**
 * Kill a held `rename specs/A.mdx a a2` in `workspace` under T13.5-3's
 * discipline (`killHeldRun`), leaving the dead run's entry, the lock
 * directory's one entry, a plain file.
 */
async function killHeldRename(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<DeadRun> {
  return await killHeldRun(product, {
    root: workspace.root,
    argv: KILLED_RENAME,
    holdPath: holdPathFor(workspace, "hold-killed.tmp"),
    context: `${context}: the held \`rename specs/A.mdx a a2\``,
  });
}

/**
 * T13.5-3's reuse check where a run over a dead run's entry is refused
 * `workspace-busy` (14.26, told by its error document): an identifier of
 * the killed group listed again voids the trial (13.5's gap), a refusal
 * with none listed fails the test, diagnosed. Any other outcome is left to
 * the takeover's judgment.
 */
async function reuseCheckOnBusy(
  result: RunResult,
  dead: DeadRun,
  context: string,
): Promise<void> {
  if (
    result.exitCode === 2 &&
    expectErrorDocument(result, context).code === WORKSPACE_BUSY
  ) {
    await applyReuseCheck(
      dead.killed.identifiers,
      `${context} — ${summarizeResult(result)}`,
    );
  }
}

/**
 * Remove every permission from a dead run's entry in place, verified on
 * the harness first: its own read must be refused (E-1; TEST-SPEC
 * T13.5-10(b): acquisition reads no file's content).
 */
async function removeEntryPermissions(
  root: string,
  dead: DeadRun,
): Promise<void> {
  const abs = Buffer.concat([
    Buffer.from(root),
    Buffer.from(`/${LOCK_PATH}/`),
    dead.entry.name,
  ]);
  await fsp.chmod(abs, 0o000);
  await verifyContentReadRefused(abs);
}

/**
 * One (b) run over a dead run's entry, as a voidable trial: on a fresh
 * session staging, a held `rename` killed under T13.5-3's discipline — the
 * entry it leaves given no permission where `unreadable` — then
 * `operation` under `--json`, bounded: a `workspace-busy` refusal meets the
 * reuse check, and every other outcome is judged by `assertTakeover`.
 */
async function deadEntryRun(
  product: ProductBinding,
  twin: UnstagedTwin,
  unreadable: boolean,
): Promise<void> {
  const label =
    `T13.5-10(b) ${twin.operation.what} --json over a dead run's entry ` +
    `(a held \`rename\` killed under T13.5-3's discipline)` +
    (unreadable ? " with every permission removed" : "");
  await runVoidableTrial(label, async (attempt) => {
    await withWorkspace(CORE_DECL, async (workspace) => {
      const context = `${label} (trial ${String(attempt)})`;
      const items = await stageArmWorkspace(product, workspace, context);
      const dead = await killHeldRename(product, workspace, context);
      if (unreadable) await removeEntryPermissions(workspace.root, dead);
      const result = await runBounded(
        product,
        workspace.root,
        [...twin.operation.argv(items), "--json"],
        context,
      );
      await reuseCheckOnBusy(result, dead, context);
      await assertTakeover(workspace.root, result, twin, [], context);
    });
  });
}

/** `name` within `dir`, byte for byte. */
function joinBytes(dir: Buffer, name: Buffer): Buffer {
  return Buffer.concat([dir, Buffer.from("/"), name]);
}

/**
 * Copy the tree under `from` into the existing directory `to` byte for byte
 * — directories (each given its mode once filled), plain files (bytes and
 * mode; a file at or under the lock path read under H-4's grant, its mode
 * the product's own), and symbolic links (targets verbatim), names as
 * bytes. Anything else is a harness error: the copy carries a workspace a
 * session staging and a kill left.
 */
async function copyTree(
  fromRoot: string,
  from: Buffer,
  to: Buffer,
  rel: Buffer,
): Promise<void> {
  const names = (await fsp.readdir(from, { encoding: "buffer" })).sort(
    Buffer.compare,
  );
  for (const name of names) {
    const source = joinBytes(from, name);
    const destination = joinBytes(to, name);
    const childRel = rel.length === 0 ? name : joinBytes(rel, name);
    const stats = await fsp.lstat(source);
    if (stats.isDirectory()) {
      await fsp.mkdir(destination);
      await copyTree(fromRoot, source, destination, childRel);
      await fsp.chmod(destination, stats.mode & 0o7777);
    } else if (stats.isFile() && isLockPathBytes(childRel)) {
      await copyLockPathFile(fromRoot, childRel, destination);
    } else if (stats.isFile()) {
      await fsp.copyFile(source, destination, fsp.constants.COPYFILE_EXCL);
      await fsp.chmod(destination, stats.mode & 0o7777);
    } else if (stats.isSymbolicLink()) {
      await fsp.symlink(
        await fsp.readlink(source, { encoding: "buffer" }),
        destination,
      );
    } else {
      throw new Error(
        `harness error: T13.5-10(b)'s workspace copy meets ` +
          `${source.toString()}, neither a directory, a plain file, nor a ` +
          `symbolic link`,
      );
    }
  }
}

/**
 * A copy of the whole workspace at `fromRoot` into the empty workspace root
 * `toRoot` — 13.5's entry created for another workspace, as a copy of the
 * workspace carries it in — checked against the original before use (every
 * path, and the lock path's tree, which the cross-directory compare leaves
 * out, H-6): a difference is a harness error, never a product verdict.
 */
async function copyWholeWorkspace(
  fromRoot: string,
  toRoot: string,
): Promise<void> {
  await copyTree(
    fromRoot,
    Buffer.from(fromRoot),
    Buffer.from(toRoot),
    Buffer.alloc(0),
  );
  const lines = [
    ...diffSnapshots(
      await snapshotDirectory(fromRoot),
      await snapshotDirectory(toRoot),
    ).map((change) => `${change.change} ${change.path}`),
    ...describeTreeDifferences(
      await readLockPathTree(fromRoot),
      await readLockPathTree(toRoot),
      "original",
    ),
  ];
  if (lines.length > 0) {
    throw new Error(
      `harness error: T13.5-10(b)'s copy of ${fromRoot} at ${toRoot} ` +
        `differs from it: ${lines.slice(0, 10).join("; ")}`,
    );
  }
}

/**
 * One (b) run over a dead run's entry carried into another workspace, as a
 * voidable trial: on a fresh session staging, a held `rename` killed under
 * T13.5-3's discipline, then a byte copy of the whole workspace made into a
 * fresh workspace of its own, and `operation` under `--json`, bounded, run
 * in the copy: a `workspace-busy` refusal meets the reuse check (the copied
 * entry records the killed run's identifier), and every other outcome is
 * judged by `assertTakeover`.
 */
async function copiedEntryRun(
  product: ProductBinding,
  twin: UnstagedTwin,
): Promise<void> {
  const label =
    `T13.5-10(b) ${twin.operation.what} --json over a dead run's entry ` +
    `carried into another workspace by a copy of the whole workspace made ` +
    `after the kill`;
  await runVoidableTrial(label, async (attempt) => {
    await withWorkspace(CORE_DECL, async (original) => {
      const context = `${label} (trial ${String(attempt)})`;
      const items = await stageArmWorkspace(product, original, context);
      const dead = await killHeldRename(product, original, context);
      await withWorkspace({}, async (copy) => {
        await copyWholeWorkspace(original.root, copy.root);
        const inCopy = `${context}, run in the copy`;
        const result = await runBounded(
          product,
          copy.root,
          [...twin.operation.argv(items), "--json"],
          inCopy,
        );
        await reuseCheckOnBusy(result, dead, inCopy);
        await assertTakeover(copy.root, result, twin, [], inCopy);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// T13.5-10
// ---------------------------------------------------------------------------

const T13_5_10 = defineProductTest({
  id: "T13.5-10",
  title:
    "13.5's acquisition, arms (a) and (b) of eight so far ((c)–(h) not yet implemented): each arm staged afresh, on a fresh workspace, for each mutating command in turn (`rename specs/A.mdx a a2`, `move specs/A.mdx specs/B.mdx`, `review create --strategy audit --name t`, `review resolve s <item> --status no-change`, `review split s <item>`; each an operation succeeding on an unstaged twin, exit 0, `.xspec/lock` absent once it ends), on a freshly built valid workspace holding an `audit` session `s` created while it was valid, run under `--json` and completing promptly, no FIFO opened: (a) obstruction — `.xspec` a plain file, a symbolic link to a directory holding a journal and sessions (the workspace's own area relocated outside it), a dangling symbolic link, or a FIFO → exit 2, `code` `\"write-failure\"`, `path` `\".xspec\"`; `.xspec/lock` a symbolic link to a directory outside the workspace holding a file, a symbolic link to a file, a dangling symbolic link, or a FIFO → exit 2, `code` `\"write-failure\"`, `path` `\".xspec/lock\"` (`locations` `[]` each) — nothing modified, the occupant byte-identical in place, a link's target untouched and nothing written through a link; (b) leftover takeover — a plain file at `.xspec/lock`, and one with every permission removed; in a lock directory a directory holding a file, a directory tree two levels deep (a directory holding a directory that holds a plain file, a symbolic link to a directory outside the workspace holding a file, a dangling symbolic link, and a FIFO), a symbolic link to a directory outside the workspace holding a file, and a FIFO; a dead run's entry (a held `rename` killed under T13.5-3's discipline), and one with every permission removed; and a dead run's entry carried into another workspace by a copy of the whole workspace made after the kill → exit 0, its result (exit code, standard output and error, and final workspace) byte-equal to its unstaged twin's (H-6), `.xspec/lock` absent once it ends, every link's target outside the workspace byte-identical — a busy refusal over a dead run's entry meeting T13.5-3's reuse check, the trial void where a killed identifier is listed again (SPEC 13.5, 13.4, 14.24)",
  timeoutMs: 600_000,
  run: async (product) => {
    const twins: UnstagedTwin[] = [];
    for (const operation of T13_5_10_OPERATIONS) {
      twins.push(await unstagedTwin(product, operation));
    }
    // (a) Obstruction: each occupant with each command in turn.
    for (const obstruction of OBSTRUCTIONS) {
      for (const operation of T13_5_10_OPERATIONS) {
        await obstructionRun(product, operation, obstruction);
      }
    }
    // (b) Leftover takeover: each staging with each command in turn.
    for (const leftover of LEFTOVERS) {
      for (const twin of twins) {
        await leftoverRun(product, twin, leftover);
      }
    }
    for (const unreadable of [false, true]) {
      for (const twin of twins) {
        await deadEntryRun(product, twin, unreadable);
      }
    }
    for (const twin of twins) {
      await copiedEntryRun(product, twin);
    }
  },
});

export const section135iiTests: readonly ProductTestEntry[] = [T13_5_10];
