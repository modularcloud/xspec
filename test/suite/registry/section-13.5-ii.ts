// TEST-SPEC §13.5 (concurrency and isolation), part ii — SUITE-48: T13.5-10
// (acquisition), registered with three of its eight arms so far: (a)
// obstruction, (b) leftover takeover, and (c) the busy refusal among
// bracketing leftovers and over a live entry unreadable or altered. Arms
// (d) to (h) — acquisition's refused reads and writes, interference and
// another machine's holder, the acquirer's own identifier, the gap and its
// manual remedy, and acquisition listing no directory but those 13.5 names
// — are not yet implemented (FIX_PLAN Tasks 24 to 27 add them).
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
// (c) A busy refusal (SPEC 13.5, 14.26) removes nothing and lists no
// directory but the lock directory, whatever order acquisition meets the
// lock directory's contents in. The holder is `review resolve s <leaf item>
// --status skipped --test-hold <path>`, its entry observed by the held-state
// comparison once it holds (TEST-SPEC §13.5's preamble; H-4: never pinned).
// Among bracketing leftovers, a voidable trial: leftovers of the harness's
// naming, each a directory holding a plain file or a FIFO, made unlistable
// once filled (mode `-wx`, T14-10's discipline, the harness's own listing of
// each refused, verified), named below (`+xspec-harness-leftover-<n>`) and
// above (`~…`) the entry's name in byte order, further ones until the
// listing brackets the entry too; then dead runs' entries — held `rename`s
// killed under T13.5-3's discipline in a twin workspace staged alike, two
// before the holder starts and one while it holds (each kill leaving one
// entry, which the next held `rename` there removes as a leftover once it
// is recorded), copied in, name and content (`copyEntryIn`: 13.5's entry
// created for another workspace) — and further twins killed while it holds
// until one listing shows both kinds bracketing the entry — at least one of
// each before it and one after it — in byte order of name and in the order
// the filesystem lists the lock directory to the harness (`opendir`'s:
// Node's `readdir` sorts names bytewise), each a bounded number, exhaustion
// voiding the trial, rerun with a fresh holder on fresh workspaces
// (exhaustion of the reruns a harness error, H-11).
// That order is creation order on tmpfs, where the arm never brackets, so
// (c) runs where the temporary directory is ext4, which lists by name hash
// (AGENTS.md). The command is then refused — exit 2, `code`
// `"workspace-busy"`, `path` `".xspec/lock"`, `locations` `[]`, never
// `"read-failure"`, exiting while the holder holds, modifying nothing (the
// compare bracketing it alone, the lock path pruned) — and, the leftovers'
// listing restored, the held-state comparison holds with every staged
// leftover and dead entry byte-identical in place beside the holder's
// entry, byte-identical, name and content. Once the holder completes, exit
// 0, `.xspec/lock` holds exactly the staged leftovers; the command run once
// more removes them all, `.xspec/lock` absent once it ends (a busy refusal
// there meets T13.5-3's reuse check over every killed group). With no
// leftover staged, the live entry is then made unreadable — every
// permission removed once its name and content are recorded, the harness's
// own read verified refused — or altered in place under H-4's grant, its
// name and kind unchanged, in three stagings: truncated, overwritten with
// ill-formed UTF-8 garbage of a length other than its own, and overwritten
// with a dead run's entry's content (a twin's killed `rename`), the altered
// content read back. Each command is refused alike, the held-state
// comparison holding, the entry the lock directory's only one under its
// name — its content byte-identical once its permissions are restored, or
// byte-identical as altered — and once the holder completes, exit 0,
// `.xspec/lock` is absent.
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
  voidTrial,
} from "../../helpers/kill-discipline.js";
import {
  copyLockPathFile,
  EXCLUDE_LOCK_PATH,
  isLockPathBytes,
  LOCK_PATH,
  readLockPathFile,
  writeLockPathFile,
} from "../../helpers/lock-path.js";
import type {
  DeadRun,
  LeftoverNode,
  LockEntry,
  OutsideChild,
  StagedLeftover,
} from "../../helpers/lock-staging.js";
import {
  AREA_PATH,
  assertFifosIntact,
  assertOutsideTargetsUntouched,
  assertStagingInPlace,
  copyEntryIn,
  describeTreeDifferences,
  DIRECTORY_MODE,
  killHeldRun,
  readLockPathTree,
  renderRel,
  stageLeftover,
  verifyContentReadRefused,
} from "../../helpers/lock-staging.js";
import {
  assertEntryUnchanged,
  assertHeldState,
  assertLockPathAbsent,
  assertLockPathHolds,
} from "../../helpers/lock-state.js";
import { verifyReadRefusalOfDirectory } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { DirectorySnapshot } from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type {
  ProductBinding,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  releaseHoldFile,
  rethrowHarnessError,
  startProduct,
  summarizeResult,
} from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { SessionItems, SessionOperation } from "./section-13.5.js";
import {
  CORE_DECL,
  describeExit,
  runBounded,
  stageSessionWorkspace,
} from "./section-13.5.js";
import { assertSameJson, expectErrorDocument } from "./support.js";
import {
  awaitHoldFile,
  holdPathFor,
  WRITE_FAILURE_CODE,
} from "./write-refusal-staging.js";

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
 * T13.5-3's reuse check where a run over dead runs' entries is refused
 * `workspace-busy` (14.26, told by its error document): an identifier of
 * the killed groups (`killed`) listed again voids the trial (13.5's gap), a
 * refusal with none listed fails the test, diagnosed. Any other outcome is
 * left to the caller's judgment.
 */
async function reuseCheckOnBusy(
  result: RunResult,
  killed: Iterable<number>,
  context: string,
): Promise<void> {
  if (
    result.exitCode === 2 &&
    expectErrorDocument(result, context).code === WORKSPACE_BUSY
  ) {
    await applyReuseCheck(killed, `${context} — ${summarizeResult(result)}`);
  }
}

/** Every permission removed: the harness's own read then refused (E-1). */
const NO_PERMISSION = 0o000;

/** The lock directory's entry `name` in the workspace at `root`, absolute. */
function lockEntryAbs(root: string, name: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(root),
    Buffer.from(`/${LOCK_PATH}/`),
    name,
  ]);
}

/** The lock directory's entry `name`, workspace-relative bytes. */
function lockEntryRel(name: Buffer): Buffer {
  return Buffer.concat([Buffer.from(`${LOCK_PATH}/`), name]);
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
  const abs = lockEntryAbs(root, dead.entry.name);
  await fsp.chmod(abs, NO_PERMISSION);
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
      await reuseCheckOnBusy(result, dead.killed.identifiers, context);
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
        await reuseCheckOnBusy(result, dead.killed.identifiers, inCopy);
        await assertTakeover(copy.root, result, twin, [], inCopy);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// (c) A busy refusal
// ---------------------------------------------------------------------------

/**
 * The held `review resolve` of every (c) staging, `--test-hold` aside: the
 * session's unblocked leaf item resolved `--status skipped` (T13.5-8's
 * holder), an operation succeeding on the session staging (SPEC 10.7: it
 * applies to an unblocked item whatever its status).
 */
function heldResolveArgv(items: SessionItems): readonly string[] {
  return ["review", "resolve", "s", items.leaf, "--status", "skipped"];
}

/**
 * The held `review resolve`'s hang guard: its hold spans the twins the
 * bracketing kills — each a session staging and a held `rename` killed,
 * bounded below — so it is ample beside them (H-10: a hang guard, never an
 * assertion input; a holder hanging once lifted fails diagnosed at it).
 */
const HELD_RESOLVE_TIMEOUT_MS = 300_000;

/** A (c) staging's held `review resolve`, as `withHeldResolve` hands it. */
interface HeldResolve {
  readonly running: RunningProduct;
  /**
   * Its entry as the held-state comparison observed it once it held — name
   * bytes, content, and mode, recorded before any staging (H-4: observed,
   * never pinned).
   */
  readonly entry: LockEntry;
  /** The workspace's state just before it started: the comparison's baseline. */
  readonly baseline: DirectorySnapshot;
}

/**
 * Run `body` while `review resolve s <leaf item> --status skipped
 * --test-hold <path>` holds the session staging (TEST-SPEC T13.5-10(c)):
 * the workspace's state taken just before it starts, its hold file awaited
 * (the hold path outside the workspace), and the held-state comparison
 * made against that state once it holds (TEST-SPEC §13.5's preamble),
 * observing its entry; then the hold lifted and the holder required to
 * complete, exit 0, before anything else starts — so the refusals while it
 * held are its alone (SPEC 13.5). A wait it never ends fails diagnosed
 * (H-8); a harness error propagates as itself (H-11); a void raised in
 * `body` kills it and propagates.
 */
async function withHeldResolve<T>(
  product: ProductBinding,
  workspace: TestWorkspace,
  items: SessionItems,
  context: string,
  body: (held: HeldResolve) => Promise<T>,
): Promise<T> {
  const hold = holdPathFor(workspace, "hold-resolve.tmp");
  const baseline = await snapshotDirectory(workspace.root);
  const running = await startProduct(product, {
    cwd: workspace.root,
    argv: [...heldResolveArgv(items), "--test-hold", hold],
    timeoutMs: HELD_RESOLVE_TIMEOUT_MS,
  });
  try {
    await awaitHoldFile(running, hold, context);
    const [entry] = await assertHeldState(
      workspace.root,
      { baseline, heldRuns: 1 },
      `${context} once it holds, against the workspace before it started`,
    );
    if (entry === undefined) {
      throw new Error(
        "T13.5-10(c): assertHeldState returned no entry for one held run",
      );
    }
    const value = await body({ running, entry, baseline });
    await releaseHoldFile(hold);
    let result: RunResult;
    try {
      result = await running.waitForExit();
    } catch (error) {
      rethrowHarnessError(error);
      return fail(
        `${context}: once its hold file is deleted the holder must proceed ` +
          `and exit (SPEC 13.5) — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    assertExitCode(
      result,
      0,
      `${context}: once its hold is lifted it completes its resolution, ` +
        `exit 0 (SPEC 10.7, 13.5), so the refusals while it held are ` +
        `attributable to it alone`,
    );
    return value;
  } finally {
    running.kill();
    await releaseHoldFile(hold);
  }
}

/**
 * One mutating command refused while the held `review resolve` holds
 * (TEST-SPEC T13.5-10(c)): under `--json`, bounded, exit 2 — exiting while
 * the holder still holds (SPEC 13.5: promptly, never waiting for the
 * holder's exclusivity to end) — the error document's `code`
 * `"workspace-busy"`, `path` `".xspec/lock"`, `locations` `[]` (14.26,
 * 12.7), never `"read-failure"` (14.25: acquisition lists the lock
 * directory and each directory it removes, and reads no file's content,
 * no leftover removed once a live run's entry refuses); modifying nothing —
 * the compare bracketing this run alone, the lock path pruned (H-6: the run
 * reaches acquisition; the lock directory, unlistable stagings and all, is
 * judged apart once the run has ended).
 */
async function assertBusyWhileHeld(
  product: ProductBinding,
  workspace: TestWorkspace,
  held: HeldResolve,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const before = await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH);
  const result = await runBounded(
    product,
    workspace.root,
    [...argv, "--json"],
    context,
  );
  assertExitCode(
    result,
    2,
    `${context}: an entry of a run alive on this machine refuses ` +
      `acquisition — the usage error of 14.26, exit 2 — no leftover then ` +
      `removed (SPEC 13.5, 14.26, 12.0)`,
  );
  if (held.running.hasExited()) {
    fail(
      `${context}: the holder must still hold when the refused command ` +
        `exits — the refusal is prompt, never a wait for the holder's ` +
        `exclusivity to end (SPEC 13.5) — ${await describeExit(held.running)}`,
    );
  }
  const finding = expectErrorDocument(result, context);
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    { code: WORKSPACE_BUSY, path: LOCK_PATH, locations: [] },
    `${context}: the busy refusal's error document carries the stable code ` +
      `"${WORKSPACE_BUSY}", the concerned path "${LOCK_PATH}", and no ` +
      `locations — never "read-failure" (14.25): acquisition judges the live ` +
      `entry by its name alone, lists no directory but the lock directory ` +
      `before refusing, and reads no file's content (SPEC 13.5, 14.26, 12.7; ` +
      `\`message\` and \`identities\` informational) — message: ` +
      JSON.stringify(finding.message),
  );
  assertSnapshotsEqual(
    before,
    await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH),
    `${context}: modifies nothing — every workspace path but the lock path ` +
      `byte-identical, the compare bracketing this run alone (SPEC 13.5; ` +
      `H-6: the lock path, judged apart, left out)`,
  );
}

/**
 * A dead run's entry taken from a twin workspace (TEST-SPEC T13.5-10(c)):
 * a fresh session staging of its own, a held `rename specs/A.mdx a a2`
 * killed there under T13.5-3's discipline (`killHeldRename`), the twin then
 * disposed — its entry's name, content, and mode, and the killed group.
 */
async function deadRunOfTwin(
  product: ProductBinding,
  context: string,
): Promise<DeadRun> {
  return await withWorkspace(CORE_DECL, async (twin) => {
    await stageArmWorkspace(product, twin, context);
    return await killHeldRename(product, twin, context);
  });
}

/** What a leftover of the harness's own naming in (c) carries: a tag. */
const BRACKET_LEFTOVER_TAG = "xspec-harness-leftover";
const PLUS = 0x2b; // "+"
const TILDE = 0x7e; // "~"
const SLASH_BYTE = 0x2f; // "/"

/** `-wx`: a leftover directory made unlistable once filled (T14-10's discipline). */
const UNLISTABLE_MODE = 0o300;

/**
 * A name of the harness's own choosing below `entry` in byte order, one per
 * `n`: `+xspec-harness-leftover-<n>` where the entry's name begins with a
 * byte above `+`; else the entry's leading bytes up to the first that can
 * be lowered, that byte lowered (past `/`, which no name holds), then the
 * tag. A name made only of the byte 0x01 has nothing below it but its own
 * prefixes: a harness error.
 */
function nameBelow(entry: Buffer, n: number): Buffer {
  const tag = Buffer.from(`${BRACKET_LEFTOVER_TAG}-${String(n)}`, "latin1");
  if ((entry[0] ?? 0) > PLUS) return Buffer.concat([Buffer.from([PLUS]), tag]);
  for (let at = 0; at < entry.length; at += 1) {
    let lowered = (entry[at] ?? 0) - 1;
    if (lowered === SLASH_BYTE) lowered -= 1;
    if (lowered > 0) {
      return Buffer.concat([
        entry.subarray(0, at),
        Buffer.from([lowered]),
        tag,
      ]);
    }
  }
  throw new Error(
    `harness error: T13.5-10(c) can name no leftover below the holder's ` +
      `entry ${renderRel(entry)} in byte order`,
  );
}

/**
 * A name of the harness's own choosing above `entry` in byte order, one per
 * `n`: `~xspec-harness-leftover-<n>` where the entry's name begins with a
 * byte below `~`; else the entry's name extended by `-` and the tag.
 */
function nameAbove(entry: Buffer, n: number): Buffer {
  const tag = Buffer.from(`${BRACKET_LEFTOVER_TAG}-${String(n)}`, "latin1");
  if ((entry[0] ?? 0) < TILDE) {
    return Buffer.concat([Buffer.from([TILDE]), tag]);
  }
  return Buffer.concat([entry, Buffer.from("-", "latin1"), tag]);
}

/** A leftover of the harness's naming in (c): its record and its path. */
interface BracketLeftover {
  readonly staged: StagedLeftover;
  /** The directory, absolute bytes. */
  readonly abs: Buffer;
}

/**
 * Stage, in the lock directory under `name`, a leftover of the harness's
 * own naming — a directory holding a plain file, or a FIFO where
 * `holdsFifo` (never a plain file at the lock directory's top level: (b)'s
 * caution) — then make it unlistable once filled (mode `-wx`, T14-10's
 * discipline) and verify on the harness itself that its own listing is
 * refused while its occupant stays reachable by name (E-1:
 * `HarnessStagingError` otherwise).
 */
async function stageUnlistableLeftover(
  workspace: TestWorkspace,
  name: Buffer,
  holdsFifo: boolean,
): Promise<BracketLeftover> {
  const child = holdsFifo ? "fifo" : "file";
  const staged = await stageLeftover(workspace, lockEntryRel(name), {
    kind: "dir",
    entries: [
      {
        name: child,
        node: holdsFifo
          ? { kind: "fifo" }
          : { kind: "file", content: LEFTOVER_BYTES },
      },
    ],
  });
  const abs = lockEntryAbs(workspace.root, name);
  await fsp.chmod(abs, UNLISTABLE_MODE);
  await verifyReadRefusalOfDirectory(abs, child);
  return { staged, abs };
}

/**
 * Restore each leftover directory's staged mode (listable, `DIRECTORY_MODE`)
 * — before its comparison and before the next mutating command removes it;
 * one no longer a directory there is left to the comparison's diagnosis.
 */
async function restoreListing(
  leftovers: readonly BracketLeftover[],
): Promise<void> {
  for (const leftover of leftovers) {
    let isDirectory = false;
    try {
      isDirectory = (await fsp.lstat(leftover.abs)).isDirectory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (isDirectory) await fsp.chmod(leftover.abs, DIRECTORY_MODE);
  }
}

/** The lock directory's names in the two orders (c) brackets in. */
interface LockDirectoryOrders {
  /** Byte order of name. */
  readonly byteOrder: readonly Buffer[];
  /**
   * The order the filesystem lists the lock directory to the harness:
   * `opendir`'s, never sorted — Node's `readdir` sorts its names bytewise.
   */
  readonly listingOrder: readonly Buffer[];
}

async function lockDirectoryOrders(root: string): Promise<LockDirectoryOrders> {
  const listingOrder: Buffer[] = [];
  const dir = await fsp.opendir(path.join(root, LOCK_PATH), {
    encoding: "latin1",
  });
  for await (const dirent of dir) {
    listingOrder.push(Buffer.from(dirent.name, "latin1"));
  }
  return { byteOrder: [...listingOrder].sort(Buffer.compare), listingOrder };
}

/** Whether `order` places one of `names` before `entry` and one after it. */
function brackets(
  order: readonly Buffer[],
  entry: Buffer,
  names: ReadonlySet<string>,
): boolean {
  const at = order.findIndex((name) => name.equals(entry));
  const among = (name: Buffer): boolean => names.has(name.toString("latin1"));
  return (
    at >= 0 && order.slice(0, at).some(among) && order.slice(at + 1).some(among)
  );
}

// (c)'s bracketing bounds (TEST-SPEC T13.5-10(c): each a bounded number,
// exhaustion voiding the trial, rerun with a fresh holder a bounded number
// of times). The holder's entry takes a place in the listing order that
// names placed at random reach slowly where it lies near one end — `k` of
// them miss one side of it with probability 2/(k+1) over the places it may
// take — so the cheap leftovers come first, screening out such a place
// before any twin dies for it, and the twins follow. By simulation a trial
// runs out about once in seven (at the leftovers 8.7%, at the dead entries
// 4.8%), and no simulated test of 10^5 exhausts its attempts.

/** Twins (c) kills before the holder starts. */
const DEAD_BEFORE_HOLDER = 2;
/** Twins (c) kills once the holder holds, before any further one. */
const DEAD_WHILE_HOLDING = 1;
/** Further leftovers (c) names until its listing brackets the entry. */
const FURTHER_LEFTOVERS = 20;
/** Further dead runs' entries (c) copies in until they bracket the entry. */
const FURTHER_DEAD_ENTRIES = 17;
/** Attempts of one (c) bracketing trial, each with a fresh holder. */
const BRACKETING_ATTEMPTS = 8;

/** The staging (c)'s bracketing builds while the holder holds. */
interface Bracketing {
  /** The leftovers of the harness's naming, in staging order. */
  readonly leftovers: BracketLeftover[];
  /** Every dead run whose entry is copied in (its killed group included). */
  readonly dead: DeadRun[];
  /** The copied-in dead runs' entries, as staged. */
  readonly copied: StagedLeftover[];
}

/** Whether both orders place one of `names` before `entry` and one after it. */
function bracketedInBoth(
  orders: LockDirectoryOrders,
  entry: Buffer,
  names: ReadonlySet<string>,
): boolean {
  return (
    brackets(orders.byteOrder, entry, names) &&
    brackets(orders.listingOrder, entry, names)
  );
}

/**
 * The lock directory's orders, the holder's entry required among them: it
 * stands until the holder's release (SPEC 13.5), so its absence while the
 * holder holds fails diagnosed.
 */
async function ordersListingEntry(
  root: string,
  entry: Buffer,
  context: string,
): Promise<LockDirectoryOrders> {
  const orders = await lockDirectoryOrders(root);
  if (!orders.listingOrder.some((name) => name.equals(entry))) {
    fail(
      `${context}: the holder's entry ${renderRel(lockEntryRel(entry))} ` +
        `must stand in the lock directory until its release (SPEC 13.5), ` +
        `but the lock directory no longer lists it while the holder holds`,
    );
  }
  return orders;
}

/**
 * Bracket the holder's entry `entry` (TEST-SPEC T13.5-10(c)). First the
 * leftovers of the harness's naming, below and above the entry's name in
 * byte order, each made unlistable once filled, then further ones until the
 * filesystem's listing places one before the entry and one after it too.
 * Then the dead runs' entries — the twins in `bracketing.dead`, killed in
 * the twin workspace `twin` before the holder started, and one killed there
 * now, while it holds — copied in, name and content (13.5's entry created
 * for another workspace, as a copy of the workspace carries it in), and
 * further twins killed there while it holds, each copied in, until the dead
 * entries bracket the entry in byte order and in the listing order alike.
 * Each further staging is a bounded number, exhaustion voiding the trial (a
 * filesystem listing in creation order never brackets the earlier-made
 * entry). Returns once one listing shows both kinds bracketing it in both
 * orders: the staging verified on the harness before use (E-1).
 */
async function bracketHolderEntry(
  product: ProductBinding,
  workspace: TestWorkspace,
  twin: TestWorkspace,
  entry: Buffer,
  bracketing: Bracketing,
  context: string,
): Promise<void> {
  const leftoverNames = new Set<string>();
  let counter = 0;
  const addLeftover = async (below: boolean): Promise<void> => {
    let name: Buffer;
    do {
      counter += 1;
      name = below ? nameBelow(entry, counter) : nameAbove(entry, counter);
    } while (await pathOccupied(lockEntryAbs(workspace.root, name)));
    const holdsFifo = bracketing.leftovers.length % 2 === 1;
    bracketing.leftovers.push(
      await stageUnlistableLeftover(workspace, name, holdsFifo),
    );
    leftoverNames.add(name.toString("latin1"));
  };
  await addLeftover(true);
  await addLeftover(false);
  for (let further = 0; ; further += 1) {
    const orders = await ordersListingEntry(workspace.root, entry, context);
    if (bracketedInBoth(orders, entry, leftoverNames)) break;
    if (further === FURTHER_LEFTOVERS) {
      voidTrial(
        `T13.5-10(c)'s bracketing: after ${String(FURTHER_LEFTOVERS)} ` +
          `further leftovers of the harness's naming the lock directory's ` +
          `listing still places none of them before the holder's entry, or ` +
          `none after it — the entry's place lies near one end of the ` +
          `listing order, and on a filesystem listing in creation order ` +
          `(tmpfs) every trial ends so, so (c) is staged where the listing ` +
          `order is not creation order (ext4 lists by name hash; AGENTS.md)`,
      );
    }
    await addLeftover(further % 2 === 0);
  }
  const deadNames = new Set<string>();
  const killAndCopyIn = async (run?: DeadRun): Promise<void> => {
    const dead =
      run ??
      (await killHeldRename(
        product,
        twin,
        `${context}: a twin's held \`rename\`, killed while the holder holds`,
      ));
    if (run === undefined) bracketing.dead.push(dead);
    bracketing.copied.push(await copyEntryIn(workspace, dead.entry));
    deadNames.add(dead.entry.name.toString("latin1"));
  };
  for (const run of [...bracketing.dead]) await killAndCopyIn(run);
  for (let twinRun = 1; twinRun <= DEAD_WHILE_HOLDING; twinRun += 1) {
    await killAndCopyIn();
  }
  for (let further = 0; ; further += 1) {
    const orders = await ordersListingEntry(workspace.root, entry, context);
    if (bracketedInBoth(orders, entry, deadNames)) {
      if (!bracketedInBoth(orders, entry, leftoverNames)) {
        voidTrial(
          `T13.5-10(c)'s bracketing: the leftovers that bracketed the ` +
            `holder's entry no longer do in the listing that the dead ` +
            `entries bracket it in — the filesystem's listing order shifted`,
        );
      }
      return;
    }
    if (further === FURTHER_DEAD_ENTRIES) {
      voidTrial(
        `T13.5-10(c)'s bracketing: after ${String(FURTHER_DEAD_ENTRIES)} ` +
          `further dead runs' entries (twins killed while the holder holds) ` +
          `the dead entries still miss one side of the holder's entry in ` +
          `byte order of name or in the lock directory's listing order — ` +
          `the product's own names fell on one side`,
      );
    }
    await killAndCopyIn();
  }
}

/** Whether anything, a dangling link included, lies at `abs`. */
async function pathOccupied(abs: Buffer): Promise<boolean> {
  try {
    await fsp.lstat(abs);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * One (c) run among bracketing leftovers, as a voidable trial (TEST-SPEC
 * T13.5-10(c)): on a fresh session staging, beside a twin workspace staged
 * alike, twins' held `rename`s killed in the twin before the holder starts
 * (each kill under T13.5-3's discipline leaving one dead run's entry, the
 * next held `rename` removing it as a leftover once it is recorded); the
 * held `review resolve`; once it holds, the bracketing
 * (`bracketHolderEntry`, its further twins killed while it holds); then
 * `operation` refused (`assertBusyWhileHeld`); the leftovers' listing
 * restored, and the held-state comparison — every staged leftover and dead
 * run's entry byte-identical in place beside exactly one entry, the
 * holder's, byte-identical, name and content; once the holder completes,
 * `.xspec/lock` holding exactly the staged leftovers (release deleting its
 * entry, the lock directory still holding something); and `operation` once
 * more, the next mutating command, removing them all — `.xspec/lock` absent
 * once it ends, a busy refusal there meeting T13.5-3's reuse check over
 * every killed group. A void reruns the trial with a fresh holder on fresh
 * workspaces (`runVoidableTrial`, `BRACKETING_ATTEMPTS` attempts: their
 * exhaustion a harness error, H-11).
 */
async function bracketingRun(
  product: ProductBinding,
  operation: SessionOperation,
): Promise<void> {
  const label =
    `T13.5-10(c) ${operation.what} --json during a held \`review resolve\`'s ` +
    `hold, its entry bracketed by dead runs' entries and unlistable ` +
    `leftovers of the harness's naming in byte order and in the ` +
    `filesystem's listing order`;
  await runVoidableTrial(
    label,
    async (attempt) => {
      await withWorkspace(CORE_DECL, async (workspace) => {
        const context = `${label} (trial ${String(attempt)})`;
        const items = await stageArmWorkspace(product, workspace, context);
        const bracketing: Bracketing = { leftovers: [], dead: [], copied: [] };
        await withWorkspace(CORE_DECL, async (twin) => {
          await stageArmWorkspace(
            product,
            twin,
            `${context}: the twin workspace`,
          );
          for (let twinRun = 1; twinRun <= DEAD_BEFORE_HOLDER; twinRun += 1) {
            bracketing.dead.push(
              await killHeldRename(
                product,
                twin,
                `${context}: a twin's held \`rename\`, killed before the ` +
                  `holder starts`,
              ),
            );
          }
          try {
            await withHeldResolve(
              product,
              workspace,
              items,
              `${context}: the held \`review resolve s <leaf item> --status skipped\``,
              async (held) => {
                await bracketHolderEntry(
                  product,
                  workspace,
                  twin,
                  held.entry.name,
                  bracketing,
                  context,
                );
                await assertBusyWhileHeld(
                  product,
                  workspace,
                  held,
                  operation.argv(items),
                  context,
                );
                await restoreListing(bracketing.leftovers);
                await assertHeldState(
                  workspace.root,
                  {
                    baseline: held.baseline,
                    heldRuns: 1,
                    staged: [
                      ...bracketing.leftovers.map(
                        (leftover) => leftover.staged,
                      ),
                      ...bracketing.copied,
                    ],
                  },
                  `${context}: after the refusal, the leftovers' listing ` +
                    `restored — every staged leftover, each dead run's entry ` +
                    `included, byte-identical in place, no leftover removed ` +
                    `(SPEC 13.5: an entry of a run alive on this machine ` +
                    `refuses acquisition, no leftover then removed)`,
                );
                await assertEntryUnchanged(
                  workspace.root,
                  held.entry,
                  `${context}: after the refusal, the holder's entry`,
                );
              },
            );
          } finally {
            await restoreListing(bracketing.leftovers);
          }
        });
        await assertLockPathHolds(
          workspace.root,
          {
            staged: [
              ...bracketing.leftovers.map((leftover) => leftover.staged),
              ...bracketing.copied,
            ],
          },
          `${context}: once the holder has completed, ${LOCK_PATH} holds ` +
            `exactly the staged leftovers — release deleting its entry, the ` +
            `lock directory still holding something (SPEC 13.5)`,
        );
        const next =
          `${context}: then ${operation.what} --json once more, the next ` +
          `mutating command`;
        const result = await runBounded(
          product,
          workspace.root,
          [...operation.argv(items), "--json"],
          next,
        );
        await reuseCheckOnBusy(
          result,
          bracketing.dead.flatMap((run) => run.killed.identifiers),
          next,
        );
        await assertLockPathAbsent(
          workspace.root,
          `${next}: it removes every leftover — each dead run's entry, and ` +
            `each directory with all it holds — and releases (SPEC 13.5)`,
        );
      });
    },
    { attempts: BRACKETING_ATTEMPTS },
  );
}

/**
 * Restore an entry's recorded mode after (c)'s permission removal; an entry
 * gone meanwhile is left to the checks' diagnosis.
 */
async function restoreEntryMode(abs: Buffer, mode: number): Promise<void> {
  try {
    await fsp.chmod(abs, mode);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/**
 * One (c) run over the live entry made unreadable (TEST-SPEC
 * T13.5-10(c): a busy refusal judges the live entry by its name alone): on
 * a fresh session staging with no leftover staged, the held `review
 * resolve`'s entry — its name and content recorded once it holds — given
 * no permission, the harness's own read then verified refused (E-1); then
 * `operation` refused alike (`assertBusyWhileHeld`), the held-state
 * comparison holding with the entry still the lock directory's only one
 * under the same name; the entry's mode restored, its content
 * byte-identical; and once the holder completes, `.xspec/lock` absent.
 */
async function permissionRun(
  product: ProductBinding,
  operation: SessionOperation,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      `T13.5-10(c) ${operation.what} --json during a held \`review ` +
      `resolve\`'s hold, every permission removed from its entry`;
    const items = await stageArmWorkspace(product, workspace, context);
    await withHeldResolve(
      product,
      workspace,
      items,
      `${context}: the held \`review resolve s <leaf item> --status skipped\``,
      async (held) => {
        const abs = lockEntryAbs(workspace.root, held.entry.name);
        await fsp.chmod(abs, NO_PERMISSION);
        try {
          await verifyContentReadRefused(abs);
          await assertBusyWhileHeld(
            product,
            workspace,
            held,
            operation.argv(items),
            context,
          );
          const [only] = await assertHeldState(
            workspace.root,
            { baseline: held.baseline, heldRuns: 1 },
            `${context}: after the refusal`,
          );
          if (only === undefined || !only.name.equals(held.entry.name)) {
            fail(
              `${context}: after the refusal the lock directory's one entry ` +
                `must still be the holder's, under the same name ` +
                `${renderRel(lockEntryRel(held.entry.name))} (SPEC 13.5: no ` +
                `acquisition or release removes or alters a live run's ` +
                `entry); it is ` +
                (only === undefined
                  ? "missing"
                  : renderRel(lockEntryRel(only.name))),
            );
          }
        } finally {
          await restoreEntryMode(abs, held.entry.mode);
        }
        await assertEntryUnchanged(
          workspace.root,
          held.entry,
          `${context}: its permissions restored, the holder's entry`,
        );
      },
    );
    await assertLockPathAbsent(
      workspace.root,
      `${context}: once the holder has completed`,
    );
  });
}

/** One of (c)'s in-place alterations of the live entry's content. */
interface Alteration {
  readonly what: string;
  /**
   * Prepared before the holder starts: the content the entry is
   * overwritten with, given the entry as observed once it holds.
   */
  readonly prepare: (
    product: ProductBinding,
    context: string,
  ) => Promise<(entry: LockEntry) => Buffer>;
}

/** Garbage of the harness's choosing: ill-formed UTF-8 throughout. */
const GARBAGE_BYTES: readonly number[] = [
  0xff, 0xc3, 0x28, 0xa0, 0xa1, 0xe2, 0x28, 0xa1, 0xf0, 0x28, 0x8c, 0xbc, 0xc0,
  0x80,
];

/**
 * The garbage alteration's content for `entry`: `GARBAGE_BYTES`, one byte
 * longer where the entry's content has their length — so its length is
 * never the entry's — verified ill-formed UTF-8 (a harness error otherwise).
 */
function garbageFor(entry: LockEntry): Buffer {
  const garbage = Buffer.from(
    entry.content.length === GARBAGE_BYTES.length
      ? [...GARBAGE_BYTES, 0xff]
      : GARBAGE_BYTES,
  );
  let wellFormed = true;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(garbage);
  } catch {
    wellFormed = false;
  }
  if (wellFormed || garbage.length === entry.content.length) {
    throw new Error(
      "harness error: T13.5-10(c)'s garbage must be ill-formed UTF-8 of a " +
        "length other than the entry's",
    );
  }
  return garbage;
}

/**
 * (c)'s three alterations, each staged separately (TEST-SPEC
 * T13.5-10(c)): truncation to zero length; garbage, ill-formed UTF-8 of a
 * length other than the entry's; and a dead run's entry's content, taken
 * from a twin workspace in which a held `rename` is killed under T13.5-3's
 * discipline. A staging leaving the content as it was (a product's entries
 * empty, or a dead run's content the holder's own) alters nothing, its
 * expectation the same.
 */
const ALTERATIONS: readonly Alteration[] = [
  {
    what: "truncated to zero length",
    prepare: () => Promise.resolve(() => Buffer.alloc(0)),
  },
  {
    what:
      "overwritten with garbage — ill-formed UTF-8 of a length other than " +
      "the entry's",
    prepare: () => Promise.resolve(garbageFor),
  },
  {
    what:
      "overwritten with a dead run's entry's content (a held `rename` " +
      "killed under T13.5-3's discipline in a twin workspace)",
    prepare: async (product, context) => {
      const run = await deadRunOfTwin(
        product,
        `${context}: the twin, its held \`rename\` killed`,
      );
      return () => Buffer.from(run.entry.content);
    },
  },
];

/**
 * One (c) run over the live entry altered in place (TEST-SPEC
 * T13.5-10(c): a live entry's content bears on no judgment — its
 * alteration is 13.5's interference, each run faring as the lock
 * directory then decides): on a fresh session staging with no leftover
 * staged, the held `review resolve`'s entry — its name recorded once it
 * holds — overwritten in place under H-4's grant, its name and kind
 * unchanged, its altered content read back; then `operation` refused alike
 * (`assertBusyWhileHeld`), the held-state comparison holding and the
 * altered entry byte-identical as altered, name and content, the lock
 * directory's only entry; and once the holder completes, exit 0,
 * `.xspec/lock` absent (release deletes its entry, reading nothing).
 */
async function alterationRun(
  product: ProductBinding,
  operation: SessionOperation,
  alteration: Alteration,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      `T13.5-10(c) ${operation.what} --json during a held \`review ` +
      `resolve\`'s hold, its entry ${alteration.what}`;
    const items = await stageArmWorkspace(product, workspace, context);
    const contentFor = await alteration.prepare(product, context);
    await withHeldResolve(
      product,
      workspace,
      items,
      `${context}: the held \`review resolve s <leaf item> --status skipped\``,
      async (held) => {
        const rel = lockEntryRel(held.entry.name);
        await writeLockPathFile(workspace.root, rel, contentFor(held.entry));
        const altered: LockEntry = {
          ...held.entry,
          content: await readLockPathFile(workspace.root, rel),
        };
        await assertBusyWhileHeld(
          product,
          workspace,
          held,
          operation.argv(items),
          context,
        );
        await assertHeldState(
          workspace.root,
          { baseline: held.baseline, heldRuns: 1 },
          `${context}: after the refusal (the altered entry still standing)`,
        );
        await assertEntryUnchanged(
          workspace.root,
          altered,
          `${context}: after the refusal, the altered entry — byte-identical ` +
            `as altered, the lock directory's only entry`,
        );
      },
    );
    await assertLockPathAbsent(
      workspace.root,
      `${context}: once the holder, its hold lifted, has completed (SPEC ` +
        `13.5: release deletes its entry, reading nothing)`,
    );
  });
}

// ---------------------------------------------------------------------------
// T13.5-10
// ---------------------------------------------------------------------------

const T13_5_10 = defineProductTest({
  id: "T13.5-10",
  title:
    "13.5's acquisition, arms (a), (b), and (c) of eight so far ((d)–(h) not yet implemented): each arm staged afresh, on a fresh workspace, for each mutating command in turn (`rename specs/A.mdx a a2`, `move specs/A.mdx specs/B.mdx`, `review create --strategy audit --name t`, `review resolve s <item> --status no-change`, `review split s <item>`; each an operation succeeding on an unstaged twin, exit 0, `.xspec/lock` absent once it ends), on a freshly built valid workspace holding an `audit` session `s` created while it was valid, run under `--json` and completing promptly, no FIFO opened: (a) obstruction — `.xspec` a plain file, a symbolic link to a directory holding a journal and sessions (the workspace's own area relocated outside it), a dangling symbolic link, or a FIFO → exit 2, `code` `\"write-failure\"`, `path` `\".xspec\"`; `.xspec/lock` a symbolic link to a directory outside the workspace holding a file, a symbolic link to a file, a dangling symbolic link, or a FIFO → exit 2, `code` `\"write-failure\"`, `path` `\".xspec/lock\"` (`locations` `[]` each) — nothing modified, the occupant byte-identical in place, a link's target untouched and nothing written through a link; (b) leftover takeover — a plain file at `.xspec/lock`, and one with every permission removed; in a lock directory a directory holding a file, a directory tree two levels deep (a directory holding a directory that holds a plain file, a symbolic link to a directory outside the workspace holding a file, a dangling symbolic link, and a FIFO), a symbolic link to a directory outside the workspace holding a file, and a FIFO; a dead run's entry (a held `rename` killed under T13.5-3's discipline), and one with every permission removed; and a dead run's entry carried into another workspace by a copy of the whole workspace made after the kill → exit 0, its result (exit code, standard output and error, and final workspace) byte-equal to its unstaged twin's (H-6), `.xspec/lock` absent once it ends, every link's target outside the workspace byte-identical — a busy refusal over a dead run's entry meeting T13.5-3's reuse check, the trial void where a killed identifier is listed again; (c) a busy refusal — during a held `review resolve`'s hold (`review resolve s <item> --status skipped --test-hold <path>`), staged afresh for each command: dead runs' entries (twins' held `rename`s killed under T13.5-3's discipline before the holder starts and while it holds, copied in, name and content) and leftovers of the harness's naming (directories holding a file or a FIFO, made `-wx` once filled, the harness's own listing of each refused) bracketing the holder's entry — at least one of each kind before it and one after it, in byte order of name and in the filesystem's listing order, its name observed, never pinned, further stagings each a bounded number, exhaustion voiding the trial, rerun with a fresh holder — → exit 2, `code` `\"workspace-busy\"`, `path` `\".xspec/lock\"`, `locations` `[]`, never `\"read-failure\"`, exiting while the holder holds, nothing modified, every staged leftover and dead entry byte-identical in place (permissions restored first) and the holder's entry byte-identical, name and content; once the holder completes (exit 0), `.xspec/lock` holds exactly the staged leftovers, and the command run once more removes them all, `.xspec/lock` absent once it ends; with no leftover staged, the holder's entry given no permission (its name and content recorded first, the harness's own read refused) → refused alike, the entry still the only one under the same name, its content byte-identical once its permissions are restored, `.xspec/lock` absent after the holder; and the holder's entry altered in place (truncated, overwritten with ill-formed UTF-8 garbage of another length, or with a dead run's entry's content; its name recorded before, its content after) → refused alike, the altered entry byte-identical as altered and the only entry, the holder completing exit 0, `.xspec/lock` absent (SPEC 13.5, 13.4, 14.24, 14.26)",
  timeoutMs: 900_000,
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
    // (c) A busy refusal: among bracketing leftovers, over the live entry
    // made unreadable, and over it altered in place — each staged afresh
    // for each command in turn.
    for (const operation of T13_5_10_OPERATIONS) {
      await bracketingRun(product, operation);
    }
    for (const operation of T13_5_10_OPERATIONS) {
      await permissionRun(product, operation);
    }
    for (const alteration of ALTERATIONS) {
      for (const operation of T13_5_10_OPERATIONS) {
        await alterationRun(product, operation, alteration);
      }
    }
  },
});

export const section135iiTests: readonly ProductTestEntry[] = [T13_5_10];
