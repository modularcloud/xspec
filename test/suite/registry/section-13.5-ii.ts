// TEST-SPEC §13.5 (concurrency and isolation), part ii — SUITE-48: T13.5-10
// (acquisition), registered with all eight of its arms: (a) obstruction,
// (b) leftover takeover, (c) the busy refusal among bracketing leftovers and
// over a live entry unreadable or altered, (d) acquisition's refused reads
// and writes, (e) interference — a held `rename`'s entry deleted or replaced
// by hand, the lock directory deleted during a hold, and the holder met by a
// run on another machine — (f) the acquirer's own identifier, (g) the gap's
// bound and its manual remedy, and (h) acquisition listing no directory but
// those 13.5 names.
//
// Every arm is staged on a freshly built valid workspace holding an `audit`
// session `s` created while it was valid — section-13.5.ts's session staging
// (`stageSessionWorkspace`: a fresh CONF-CORE-shaped workspace, `build`,
// `review create --strategy audit --name s`, the session's items read by
// `review status s --json`), `.xspec/lock` checked absent once those runs
// have ended — and run with each mutating command in turn
// (`T13_5_10_OPERATIONS`: `rename`, file-form `move`, `review create
// --strategy audit`, `review resolve`, and `review split`; beside (e)'s held
// `rename`, `T13_5_10_COMPOSING`, each composing with it; in (h),
// `T13_5_10_H_OPERATIONS`, the section form of `move` in the file form's
// place), each an operation succeeding on an unstaged twin — the same
// staging and command on a workspace of its own with nothing staged beside
// it: exit 0, `.xspec/lock` absent once it ends — under `--json`. Every arm
// is staged afresh for each command, on a fresh workspace of its own, so no
// run meets what an earlier run's takeover or release left; and every run is
// bounded (`runBounded`): it completes promptly, and a product opening a
// staged FIFO — an open with no writer blocks — fails diagnosed at the bound
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
// (d) Refused reads and writes (SPEC 13.5, 14.24, 14.25; T13.5-11): each
// staging made before the invocation and verified on the harness itself
// (helpers/acquisition-staging.ts: T14-9's discipline, or a directory's
// stated mode, each refusal and each kept permission probed as T14-10
// verifies its stagings), its modes restored once the run ends. Each command
// exits 2 with the error document's `code` `"read-failure"` or
// `"write-failure"` as stated, `path` `".xspec/lock"` — never a nested path
// — or `".xspec"`, `locations` `[]`; it modifies nothing (every path but the
// lock path byte-identical, the compare bracketing that run alone) and
// releases after the failure, leaving exactly the residue stated: an empty
// leftover lock directory unlistable but writable (`-wx`) → read failure, no
// `.xspec/lock` afterwards; a lock directory holding a subdirectory that
// holds a file, the subdirectory unlistable (`-wx`) → read failure; an empty
// leftover lock directory refusing writes (`r-x`) → write failure, no
// `.xspec/lock` afterwards; the subdirectory refusing writes (`r-x`) → write
// failure; after either subdirectory arm the lock directory holding exactly
// one occupant, a directory holding exactly the staged file under whatever
// name (a removal may first rename the leftover within the writable lock
// directory), and no entry; a read-only `.xspec` holding no `lock` → write
// failure, no `.xspec/lock` afterwards; a plain file at `.xspec/lock` under
// T14-9's full discipline → write failure, the file byte-identical in place;
// `.xspec` unsearchable (`rw-`) holding no `lock` and, separately, an empty
// lock directory, under CORE_DECL's configuration (its globs reach nothing
// under `.xspec`) → either code, `.xspec` with all it holds byte-identical
// once its mode is restored; a lock directory unsearchable (`rw-`) holding a
// directory that holds a file → either code, the lock directory holding
// exactly the staged directory and its file, no entry; and on an unbuilt
// workspace, its root read-only → write failure at `.xspec`, no `.xspec`
// afterwards, `resolve` and `split` there naming the absent session `s`
// (acquisition preceding that check, 12.0). The two empty leftover lock
// directories' arms are determinism arms: each command runs twice on its
// workspace and once more on a byte copy of it at a different absolute
// path, each run on its own staging, standard output and standard error
// byte-identical (H-6; 12.0: no diagnostic naming an entry or an absolute
// path).
//
// (e) Interference on one machine (SPEC 13.5: interference with a hold's
// entry voids that hold's exclusion; anything in the lock directory but a
// plain file is no entry, whatever its name). The holder is `rename
// specs/A.mdx a a2 --test-hold <path>`, its entry observed by the
// held-state comparison once it holds; during its hold the harness deletes
// that entry by hand, or replaces it, under its name (H-4: observed, never
// pinned), with an occupant that is no entry — a directory holding a file,
// a FIFO, or a symbolic link to a plain file outside the workspace — each
// staged separately, afresh for each command. Each command, an operation
// composing with that `rename` (`T13_5_10_COMPOSING`: `rename specs/A.mdx g
// g2`, then T13.5-10's other four), is started under `--test-hold`: it
// acquires, its hold file created while the `rename` still holds, never
// refused `workspace-busy`, and once it holds the held-state comparison
// finds its entry alone — the replacing occupant gone (the directory with
// all it holds, the link itself, its target byte-identical in place, the
// FIFO unopened: a product opening it blocks short of its hold file), its
// entry named apart from the `rename`'s. The holds are lifted in turn, the
// `rename`'s first, each exit 0. Once the `rename` completes, the workspace
// is the `rename`'s unstaged twin's final state (H-6: the lock path aside),
// and the command's held-state comparison, taken against it, finds the
// command's entry byte-identical, name and content, to its state when the
// command created its hold file, and the lock directory's only entry; a
// further mutating command — the same operation — is then refused
// `workspace-busy`, modifying nothing; and once both complete the workspace
// equals a twin's on which the two ran in turn (`pairedTwin`), `.xspec/lock`
// absent. And with `.xspec/lock` and all it holds deleted by hand during the
// hold of each of T13.5-10's commands in turn, the held run, its hold
// lifted, ends exactly as its unstaged twin does — exit 0, standard output,
// standard error, and final workspace byte-equal (H-6), no `write-failure`
// — and leaves nothing at `.xspec/lock`.
//
// (e) on another machine (SPEC 13.5: a command on another machine removing
// a hold's entry as a leftover interferes; a machine is the processes of
// one process-identifier namespace). The held `rename` is met instead by
// each composing command started under `--test-hold` in a fresh
// process-identifier namespace with its own process list whose first
// process is the harness's own, outliving the command (helpers/
// machine-staging.ts's `openHarnessNamespace`), the harness verifying on
// itself through that process, while the `rename` is held and before the
// command starts, that the namespace lists no identifier the `rename`'s
// processes bear (a listed one an ineffective staging, H-11). The command
// takes the holder's entry over — a leftover outside the gap on its
// machine — creating its hold file while the holder holds, its entry alone
// and named apart; the holds are lifted in turn, the holder's first, each
// exit 0, and the one-machine assertions follow but for the further
// command. A `workspace-busy` refusal voids the trial only where the
// namespace has by then allocated an identifier as large as the least the
// `rename`'s processes bear (allocation being cyclic, T13.5-3), rerun on a
// fresh workspace in a fresh namespace (exhaustion a harness error), and
// fails the test otherwise.
//
// (f) The acquirer's own identifier (SPEC 13.5: an entry recorded on
// another machine is a leftover, and one recording the acquiring process's
// own identifier lies outside the gap). A held `rename` started as the
// first process of a fresh process-identifier namespace with its own
// process list (helpers/machine-staging.ts's `freshNamespaceLauncher`) is
// killed under T13.5-3's discipline, the dead entry's name recorded after
// the kill; each command, started the same way in another fresh
// namespace, takes that entry over — exit 0, `.xspec/lock` absent
// afterwards, any refusal failing the test — though the identifier the
// entry records is listed there, being its own. While each run is held the
// harness verifies that their processes bear the same in-namespace
// identifiers (a mismatch voiding the trial, rerun on a fresh workspace in
// fresh namespaces), and the later run's entry, the lock directory's one
// entry by the held-state comparison, bears a name byte-different from the
// dead entry's (H-4's one comparison across runs): a product naming an
// entry by its identifier alone fails here, overwriting the leftover with
// its own entry or adopting it.
//
// (g) The gap's bound and its manual remedy (SPEC 13.5, 13.4). The same
// kill, the harness verifying on itself, while the `rename` is held and
// again before the command, that every in-namespace identifier its
// processes bear or bore is listed in the harness's own process list (a
// mismatch an ineffective staging, H-11): its entry then lies in 13.5's
// gap. Each command, in the harness's own namespace, completes promptly and
// either proceeds — exit 0, its result byte-equal to its unstaged twin's,
// `.xspec/lock` absent — or is refused — exit 2, `code` `"workspace-busy"`,
// `path` `".xspec/lock"`, `locations` `[]`, nothing modified, the entry
// byte-identical, name and content, and the only one — never another
// outcome, T13.5-3's reuse check not applying; refused, `.xspec/lock` is
// deleted by hand while no mutating command runs and the same command then
// proceeds as its twin. These three arms' namespaces are made with the
// administrative access of E-1, outside every product invocation, which
// stays unprivileged; a runner withholding it fails them as harness errors,
// never skips (H-9, H-11). They run last, so that every arm needing none
// runs first; `runT13510MachineArms` runs them alone, with the twins they
// need, for a probe where that access is (AGENTS.md).
//
// (h) Acquisition lists no directory but those 13.5 names (SPEC 13.5: it
// examines occupants' kinds and lists the lock directory and each directory
// it removes). On a fresh session staging under CORE_DECL's configuration,
// whose one glob reaches nothing under `.xspec` (as T13.5-11(b)'s and
// (c)'s), `.xspec`, holding no `lock`, is made unlistable but searchable and
// writable before the invocation (mode `-wx`, T14-10's discipline: the
// harness's own listing of it refused, and its own creation and removal of
// a file in it kept, verified first; helpers/acquisition-staging.ts's
// `stageUnlistableArea`), and each command whose operation leaves no orphan
// runs in turn — T13.5-10's commands, the section form of `move` (`move
// specs/A.mdx#g specs/A.mdx#a.g`, its unstaged twin made at its turn) in
// the file form's place: the file form is not run, removing its orphans
// relying on the record (13.4), whose readability without a listing of
// `.xspec` rests on a graph-data layout SPEC.md leaves unenumerated (13.3).
// Each proceeds: exit 0, its standard output byte-equal to its unstaged
// twin's, and, `.xspec`'s mode restored once it ends, `.xspec/lock` absent
// and every path outside `.xspec`, and the journal and the session files,
// byte-equal to the twin's — graph data compared nowhere; then `build` exits
// 0 and `check --json` is clean. A conforming acquisition learns the lock
// path's kind by examining that path, which needs only `.xspec`'s search
// permission, brings the lock directory and its entry into existence, which
// needs its write permission, and lists the lock directory alone; a refused
// listing of `.xspec` anywhere but at acquisition is condition 23's state,
// never a read failure (14.25): it refuses no real operation (6.6), and a
// refresh regenerates graph data in it (13.3). A product whose acquisition
// lists `.xspec` — to learn the lock path's kind from that listing — meets a
// refused read there, at acquisition a read failure, and fails. (h) needs
// no administrative access, so it runs before the three arms that do; the
// section form of `move` lies outside CONF-CORE's surface.
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
// the process list, and fresh process-identifier namespaces (E-1).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { AcquisitionStaging } from "../../helpers/acquisition-staging.js";
import {
  assertLeftoverDirectoryStands,
  stageReadOnlyArea,
  stageReadOnlyRoot,
  stageUnlistableArea,
  stageUnlistableLeftoverDirectory,
  stageUnlistableLockDirectory,
  stageUnremovableLockFile,
  stageUnsearchableArea,
  stageUnsearchableLockDirectory,
  stageUnwritableLeftoverDirectory,
  stageUnwritableLockDirectory,
} from "../../helpers/acquisition-staging.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
} from "../../helpers/assertions.js";
import { assertRunOutcomesEqual } from "../../helpers/determinism.js";
import {
  applyReuseCheck,
  descendantsOf,
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
  assertEntriesNamedApart,
  assertEntryUnchanged,
  assertHeldState,
  assertLockPathAbsent,
  assertLockPathHolds,
  assertOnlyEntry,
} from "../../helpers/lock-state.js";
import type { HarnessNamespace } from "../../helpers/machine-staging.js";
import {
  freshNamespaceLauncher,
  hasAllocated,
  inNamespaceIdentifiers,
  openHarnessNamespace,
  verifyListedByHarness,
  verifyNamespaceListsNone,
} from "../../helpers/machine-staging.js";
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
  RunLauncher,
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
  assertCleanCheckReport,
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
 * `rename specs/A.mdx a a2`: T13.5-10's first mutating command, and (e)'s
 * held `rename` — its unstaged twin's final state the state that `rename`
 * leaves once it completes.
 */
const RENAME_A: SessionOperation = {
  what: "`rename specs/A.mdx a a2`",
  argv: () => ["rename", "specs/A.mdx", "a", "a2"],
};

/**
 * The file form of `move`, T13.5-10's second command: its operation leaves
 * orphans — the origin's derived files — whose removal relies on the record
 * (SPEC 13.4), so (h) runs the section form in its place (`SECTION_MOVE`).
 */
const FILE_MOVE: SessionOperation = {
  what: "`move specs/A.mdx specs/B.mdx`",
  argv: () => ["move", "specs/A.mdx", "specs/B.mdx"],
};

/**
 * T13.5-10's mutating commands, in turn: each an operation succeeding on
 * the session staging (`stageSessionWorkspace`) and from CONF-CORE's
 * surface — file-form `move`, `review create` under `--strategy audit` —
 * `resolve` and `split` naming `s`'s items as that workspace's own `review
 * status s --json` read them.
 */
const T13_5_10_OPERATIONS: readonly SessionOperation[] = [
  RENAME_A,
  FILE_MOVE,
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
 * A takeover's outcome (TEST-SPEC T13.5-10(b); (g)'s proceeding command):
 * exit 0 (`exitRule` the rule its failure cites); its result byte-equal to
 * its unstaged twin's — exit code, standard output and standard error, and
 * the final workspace (H-6: the lock path aside, the compare across two
 * workspaces); `.xspec/lock` absent once it ends; every staged link's
 * target outside the workspace byte-identical, nothing removed or written
 * through a link (SPEC 13.5: a symbolic link itself, never its target;
 * 13.4: writes never traverse symbolic links).
 */
async function assertTakeover(
  root: string,
  result: RunResult,
  twin: UnstagedTwin,
  staged: readonly StagedLeftover[],
  context: string,
  exitRule: string = `a leftover MUST NOT block later commands — ` +
    `acquisition removes it and the command proceeds, exit 0 (SPEC 13.5)`,
): Promise<void> {
  assertExitCode(result, 0, `${context}: ${exitRule}`);
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
        `harness error: T13.5-10's workspace copy meets ` +
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
      `harness error: T13.5-10's copy of ${fromRoot} at ${toRoot} ` +
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
 * One mutating command refused while a held run holds — (c)'s held `review
 * resolve`, or (e)'s second run once the interfered `rename` has completed
 * (TEST-SPEC T13.5-10(c), (e)): under `--json`, bounded, exit 2 — exiting
 * while the holder still holds (SPEC 13.5: promptly, never waiting for the
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
  held: { readonly running: RunningProduct },
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
// (d) Refused reads and writes
// ---------------------------------------------------------------------------

/** The stable code of 14.25, the read failure. */
const READ_FAILURE_CODE = "read-failure";

/**
 * The items `review resolve` and `review split` name on (d)'s unbuilt
 * workspace, which holds no session: harness-prefixed names, the session `s`
 * itself absent (TEST-SPEC T13.5-10(d): `resolve` and `split` there naming
 * the absent session `s`, acquisition preceding that check, 12.0; SPEC 10.7:
 * an unknown session or item is a usage error, judged past acquisition).
 */
const ABSENT_SESSION_ITEMS: SessionItems = {
  leaf: "xspec-harness-no-such-item",
  parent: "xspec-harness-no-such-item",
};

/** One staging of (d), and what every command meets there. */
interface RefusalArm {
  readonly what: string;
  /**
   * Staged on an unbuilt workspace — no session staging, no `.xspec` —
   * rather than on the session staging (`stageArmWorkspace`).
   */
  readonly unbuilt?: true;
  /**
   * The codes a conforming acquisition reports: one, or either where it may
   * meet the refusal first at a read or at a write (14.25, 14.24).
   */
  readonly codes: readonly string[];
  /** The concerned path (12.7, 14). */
  readonly path: typeof AREA_PATH | typeof LOCK_PATH;
  /**
   * A determinism arm: run twice, and once more on a content-identical
   * workspace at a different absolute path, each run on its own staging,
   * standard output and standard error byte-identical (H-6; SPEC 12.0).
   */
  readonly determinism?: true;
  /** Stage it, verified on the harness itself (helpers/acquisition-staging.ts). */
  readonly stage: (workspace: TestWorkspace) => Promise<AcquisitionStaging>;
  /** The residue it leaves, judged once the staging's modes are restored. */
  readonly residue: Residue;
}

/** A (d) arm's residue check, judged once its staging's modes are restored. */
type Residue = (
  root: string,
  staging: AcquisitionStaging,
  context: string,
) => Promise<void>;

/** The leftover a staging's record holds (a harness error where none). */
function stagedLeftoverOf(staging: AcquisitionStaging): StagedLeftover {
  if (staging.leftover === undefined) {
    throw new Error(
      "T13.5-10(d): the arm's residue compares a staged leftover its " +
        "staging did not stage",
    );
  }
  return staging.leftover;
}

/**
 * No `.xspec/lock` afterwards (SPEC 13.5: a command failed at acquisition
 * releases — its entry deleted, then the emptied lock directory; T13.5-11).
 */
function noLockPathAfterwards(why: string): Residue {
  return (root, _staging, context) =>
    assertLockPathAbsent(
      root,
      `${context}: no ${LOCK_PATH} afterwards — ${why} (SPEC 13.5: a ` +
        `command failed at acquisition releases; T13.5-11)`,
    );
}

/** The lock path holding exactly the staged leftover, byte-identical. */
function stagingStandsAlone(why: string): Residue {
  return (root, staging, context) =>
    assertLockPathHolds(
      root,
      { staged: [stagedLeftoverOf(staging)] },
      `${context}: ${LOCK_PATH} holds exactly what was staged there, ` +
        `byte-identical, and no entry — ${why} (SPEC 13.5, 14.24)`,
    );
}

/** The subdirectory arms' residue (`assertLeftoverDirectoryStands`). */
async function leftoverDirectoryStands(
  root: string,
  staging: AcquisitionStaging,
  context: string,
): Promise<void> {
  await assertLeftoverDirectoryStands(
    root,
    stagedLeftoverOf(staging),
    `${context}: afterwards — release deleting the run's entry, the lock ` +
      `directory still holding something`,
  );
}

/** No `.xspec` afterwards on the unbuilt workspace. */
async function noAreaAfterwards(
  root: string,
  _staging: AcquisitionStaging,
  context: string,
): Promise<void> {
  try {
    await fsp.lstat(path.join(root, AREA_PATH));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  fail(
    `${context}: no ${AREA_PATH} afterwards — the write producing the ` +
      `area's directory refused, the command stopping there (SPEC 13.5, ` +
      `14.24) — but ${AREA_PATH} exists`,
  );
}

/**
 * (d)'s stagings (TEST-SPEC T13.5-10(d); SPEC 13.5, 14.24, 14.25), each
 * staged before the invocation and verified on the harness itself
 * (helpers/acquisition-staging.ts: T14-9's and T14-10's disciplines), with
 * the residue each leaves — a product skipping release after a failure at
 * acquisition leaves its entry or the emptied lock directory behind.
 */
const REFUSAL_ARMS: readonly RefusalArm[] = [
  {
    what: "an empty leftover lock directory unlistable but writable (mode `-wx`)",
    codes: [READ_FAILURE_CODE],
    path: LOCK_PATH,
    determinism: true,
    stage: stageUnlistableLockDirectory,
    residue: noLockPathAfterwards(
      "release deletes the run's entry and then the emptied directory, " +
        "which needs only `.xspec`'s write permission",
    ),
  },
  {
    what:
      "a lock directory holding a subdirectory that holds a file, the " +
      "subdirectory unlistable (`-wx`)",
    codes: [READ_FAILURE_CODE],
    path: LOCK_PATH,
    stage: stageUnlistableLeftoverDirectory,
    residue: leftoverDirectoryStands,
  },
  {
    what: "an empty leftover lock directory refusing writes (`r-x`)",
    codes: [WRITE_FAILURE_CODE],
    path: LOCK_PATH,
    determinism: true,
    stage: stageUnwritableLockDirectory,
    residue: noLockPathAfterwards(
      "no entry added, release deletes the empty directory all the same",
    ),
  },
  {
    what:
      "a lock directory holding a subdirectory that holds a file, the " +
      "subdirectory refusing writes (`r-x`), so the leftover's removal is " +
      "refused",
    codes: [WRITE_FAILURE_CODE],
    path: LOCK_PATH,
    stage: stageUnwritableLeftoverDirectory,
    residue: leftoverDirectoryStands,
  },
  {
    what: "a read-only `.xspec` holding no `lock`",
    codes: [WRITE_FAILURE_CODE],
    path: LOCK_PATH,
    stage: stageReadOnlyArea,
    residue: noLockPathAfterwards("the lock directory's creation refused"),
  },
  {
    what:
      "a plain file at `.xspec/lock` with `.xspec` read-only and the file " +
      "unwritable (T14-9's full discipline)",
    codes: [WRITE_FAILURE_CODE],
    path: LOCK_PATH,
    stage: stageUnremovableLockFile,
    residue: stagingStandsAlone(
      "the leftover's removal refused, the command stopping there (14.24)",
    ),
  },
  {
    what: "`.xspec` unsearchable (mode `rw-`) holding no `lock`",
    codes: [READ_FAILURE_CODE, WRITE_FAILURE_CODE],
    path: LOCK_PATH,
    stage: (workspace) => stageUnsearchableArea(workspace, "nothing"),
    residue: noLockPathAfterwards(
      "the lock path's examination refused, release's deletions refused " +
        "alike, which changes no outcome",
    ),
  },
  {
    what: "`.xspec` unsearchable (mode `rw-`) holding an empty lock directory",
    codes: [READ_FAILURE_CODE, WRITE_FAILURE_CODE],
    path: LOCK_PATH,
    stage: (workspace) =>
      stageUnsearchableArea(workspace, "an empty lock directory"),
    residue: stagingStandsAlone(
      "the lock path's examination refused, release's deletions refused " +
        "alike, which changes no outcome",
    ),
  },
  {
    what:
      "a lock directory unsearchable (`rw-`) holding a directory that " +
      "holds a file",
    codes: [READ_FAILURE_CODE, WRITE_FAILURE_CODE],
    path: LOCK_PATH,
    stage: stageUnsearchableLockDirectory,
    residue: stagingStandsAlone(
      "its occupants' kinds refused, as is every write and listing below it",
    ),
  },
  {
    what: "an unbuilt workspace, its root read-only",
    unbuilt: true,
    codes: [WRITE_FAILURE_CODE],
    path: AREA_PATH,
    stage: stageReadOnlyRoot,
    residue: noAreaAfterwards,
  },
];

/**
 * One (d) run: `arm` staged (verified on the harness itself), `operation`
 * under `--json`, bounded, and the staging's modes restored once it ends →
 * exit 2; the error document's `code` among `arm.codes`, `path`
 * `arm.path`, `locations` `[]`; the residue `arm.residue` states; and
 * nothing else modified — every path but the lock path byte-identical, the
 * compare bracketing this run and its staging alone (the lock path, judged
 * by the residue, pruned; modes aside, H-4). Returns the run's result.
 */
async function refusalRun(
  product: ProductBinding,
  workspace: TestWorkspace,
  items: SessionItems,
  operation: SessionOperation,
  arm: RefusalArm,
  context: string,
): Promise<RunResult> {
  const before = await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH);
  const staging = await arm.stage(workspace);
  let result: RunResult;
  try {
    result = await runBounded(
      product,
      workspace.root,
      [...operation.argv(items), "--json"],
      context,
    );
  } finally {
    await staging.restore();
  }
  assertExitCode(
    result,
    2,
    `${context}: acquisition's refused read or write is a usage error — ` +
      `exit 2 — the command stopping there and releasing (SPEC 13.5, 14.24, ` +
      `14.25, 12.0)`,
  );
  const finding = expectErrorDocument(result, context);
  const codes = arm.codes.map((code) => `"${code}"`).join(" or ");
  assertSameJson(
    { code: finding.code, path: finding.path, locations: finding.locations },
    {
      code: arm.codes.find((code) => code === finding.code) ?? arm.codes[0],
      path: arm.path,
      locations: [],
    },
    `${context}: the error document carries acquisition's failure — the ` +
      `stable code ${codes}, the concerned path "${arm.path}"` +
      (arm.path === LOCK_PATH
        ? ` (anything under the lock path concerning the lock path, never ` +
          `a nested path)`
        : ` (the write producing the area's directory)`) +
      `, and no locations (SPEC 13.5, 12.7, 14.24, 14.25; \`message\` and ` +
      `\`identities\` informational) — message: ` +
      JSON.stringify(finding.message),
  );
  await arm.residue(workspace.root, staging, context);
  assertSnapshotsEqual(
    before,
    await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH),
    `${context}: modifies nothing — every path but the lock path ` +
      `byte-identical once the staging's modes are restored, the compare ` +
      `bracketing this run alone (SPEC 13.5, 12.0; H-6: the lock path, ` +
      `judged apart, left out)`,
  );
  return result;
}

/**
 * `arm` with `operation` (TEST-SPEC T13.5-10(d)): on a fresh session
 * staging — or a fresh unbuilt workspace where the arm says so, `resolve`
 * and `split` there naming the absent session `s` — one run
 * (`refusalRun`); a determinism arm runs twice there, each on its own
 * staging, and once more on a byte copy of the workspace made before its
 * first staging (content-identical, at a different absolute path, verified
 * before use), standard output and standard error byte-identical across the
 * three (H-6; SPEC 12.0: no diagnostic naming an entry or an absolute path).
 */
async function refusalArmRuns(
  product: ProductBinding,
  operation: SessionOperation,
  arm: RefusalArm,
): Promise<void> {
  const label = `T13.5-10(d) ${operation.what} --json with ${arm.what}`;
  await withWorkspace(CORE_DECL, async (workspace) => {
    const items =
      arm.unbuilt === true
        ? ABSENT_SESSION_ITEMS
        : await stageArmWorkspace(product, workspace, label);
    if (arm.determinism !== true) {
      await refusalRun(product, workspace, items, operation, arm, label);
      return;
    }
    await withWorkspace({}, async (copy) => {
      await copyWholeWorkspace(workspace.root, copy.root);
      const first = await refusalRun(
        product,
        workspace,
        items,
        operation,
        arm,
        `${label} (a determinism arm's first run)`,
      );
      const second = await refusalRun(
        product,
        workspace,
        items,
        operation,
        arm,
        `${label} (a determinism arm's second run, on its own staging)`,
      );
      const third = await refusalRun(
        product,
        copy,
        items,
        operation,
        arm,
        `${label} (a determinism arm's run on a content-identical workspace ` +
          `at a different absolute path, on its own staging)`,
      );
      const context =
        `${label}: a determinism arm — standard output and standard error ` +
        `byte-identical across its runs (H-6; SPEC 12.0: no diagnostic ` +
        `naming an entry or an absolute path)`;
      assertRunOutcomesEqual(
        second,
        first,
        context,
        "its second run",
        "its first run",
      );
      assertRunOutcomesEqual(
        third,
        first,
        context,
        "its run at the other path",
        "its first run",
      );
    });
  });
}

// ---------------------------------------------------------------------------
// (e) Interference
// ---------------------------------------------------------------------------

/**
 * (e)'s mutating commands beside the held `rename specs/A.mdx a a2`
 * (`RENAME_A`), each an operation composing with it — succeeding once it
 * has run — so that, held while that `rename` completes and lifted after
 * it, each meets the workspace the `rename` left (SPEC 13.5: holding
 * exclusivity, past its hold, a command discovers its sources again) and
 * the two compose as they do run in turn on a twin (`pairedTwin`): `rename
 * specs/A.mdx g g2` — the `rename` of `a` leaves `g` as it is — then
 * T13.5-10's other four commands, the session's items addressable by their
 * `id`s across that `rename` (SPEC 10.2), as in T13.5-2.
 */
const T13_5_10_COMPOSING: readonly SessionOperation[] = [
  {
    what: "`rename specs/A.mdx g g2`",
    argv: () => ["rename", "specs/A.mdx", "g", "g2"],
  },
  ...T13_5_10_OPERATIONS.filter((operation) => operation !== RENAME_A),
];

/**
 * The hang guard of (e)'s held runs, whose holds span another run's start
 * and the harness's checks (H-10: never an assertion input; a held run
 * hanging once lifted fails diagnosed at it).
 */
const INTERFERENCE_HOLD_TIMEOUT_MS = 120_000;

/** What the plain file a replacing link reaches outside the workspace holds. */
const OUTSIDE_FILE_BYTES = "A plain file outside the workspace.\n";

/** One of (e)'s interferences with the held `rename`'s entry. */
interface Interference {
  readonly what: string;
  /**
   * The occupant that is no entry put in the entry's place, under its
   * name; none where the entry is deleted.
   */
  readonly replacement?: LeftoverNode;
}

/**
 * (e)'s interferences with the held `rename`'s entry, each staged
 * separately (TEST-SPEC T13.5-10(e)): the entry deleted by hand during the
 * hold, or replaced by hand, under its name (H-4: the name observed, a
 * staging choice asserting nothing), with an occupant that is no entry — a
 * directory holding a file, a FIFO, and a symbolic link to a plain file
 * outside the workspace. Anything in the lock directory but a plain file
 * is no entry and records no identifier, whatever its name (SPEC 13.5): a
 * leftover outside 13.5's gap, which acquisition removes — so a product
 * judging liveness by names alone, or learning an occupant's kind through a
 * link, refuses here and fails.
 */
const INTERFERENCES: readonly Interference[] = [
  { what: "entry deleted by hand during its hold" },
  {
    what:
      "entry replaced by hand during its hold, under its name, with a " +
      "directory holding a file",
    replacement: {
      kind: "dir",
      entries: [
        { name: "file", node: { kind: "file", content: LEFTOVER_BYTES } },
      ],
    },
  },
  {
    what: "entry replaced by hand during its hold, under its name, with a FIFO",
    replacement: { kind: "fifo" },
  },
  {
    what:
      "entry replaced by hand during its hold, under its name, with a " +
      "symbolic link to a plain file outside the workspace",
    replacement: {
      kind: "symlink",
      target: { kind: "file", content: OUTSIDE_FILE_BYTES },
    },
  },
];

/** The twin on which the held `rename` and then one of (e)'s commands ran. */
interface PairedTwin {
  readonly operation: SessionOperation;
  /** The twin workspace's state once both runs have ended. */
  readonly final: DirectorySnapshot;
}

/**
 * The twin on which `rename specs/A.mdx a a2` and then `operation` ran in
 * turn (TEST-SPEC T13.5-10(e): once both complete, the workspace equals a
 * twin's on which the two operations ran in turn): the session staging,
 * nothing staged beside it, and the two runs under `--json`, bounded, each
 * exit 0 — `operation` composing with the `rename` — `.xspec/lock` absent
 * once they have ended.
 */
async function pairedTwin(
  product: ProductBinding,
  operation: SessionOperation,
): Promise<PairedTwin> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const context =
      `T13.5-10(e): the twin on which ${RENAME_A.what} and then ` +
      `${operation.what} ran in turn`;
    const items = await stageArmWorkspace(product, workspace, context);
    for (const step of [RENAME_A, operation]) {
      const result = await runBounded(
        product,
        workspace.root,
        [...step.argv(items), "--json"],
        `${context}: ${step.what} --json`,
      );
      assertExitCode(
        result,
        0,
        `${context}: ${step.what} --json succeeds — each command (e) runs ` +
          `beside the held \`rename\` is an operation composing with it, ` +
          `succeeding once it has run (SPEC 13.5)`,
      );
    }
    await assertLockPathAbsent(
      workspace.root,
      `${context}: once both have ended (SPEC 13.5: release on every ` +
        `normal end)`,
    );
    return { operation, final: await snapshotDirectory(workspace.root) };
  });
}

/** The one entry a held-state comparison of one held run returned. */
function onlyHeldEntry(entries: readonly LockEntry[]): LockEntry {
  const [entry] = entries;
  if (entry === undefined || entries.length !== 1) {
    throw new Error(
      "T13.5-10(e): assertHeldState returned no single entry for one held run",
    );
  }
  return entry;
}

/**
 * A held run's exit once its hold is lifted: a wait it never ends — killed
 * at its hang guard — a diagnosed failure (H-8, H-10); a harness error
 * propagates as itself (H-11).
 */
async function exitOnceLifted(
  running: RunningProduct,
  context: string,
): Promise<RunResult> {
  try {
    return await running.waitForExit();
  } catch (error) {
    rethrowHarnessError(error);
    return fail(
      `${context}: once its hold file is deleted the run must proceed and ` +
        `exit (SPEC 13.5) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Stage `interference` on the held `rename`'s entry `entry` (TEST-SPEC
 * T13.5-10(e)): the entry deleted by hand — the lock directory then
 * verified empty on the harness itself — or replaced, under its name, by
 * the occupant `stageLeftover` builds there and verifies (helpers/
 * lock-staging.ts: never opening a FIFO, a link's target in a directory of
 * its own outside the workspace). Removing a name needs no permission on
 * the entry itself (H-4: its mode the product's own). Returns the
 * replacement's record, if any; an ineffective deletion is a harness error
 * (H-11).
 */
async function interfere(
  workspace: TestWorkspace,
  entry: LockEntry,
  interference: Interference,
): Promise<StagedLeftover | undefined> {
  await fsp.unlink(lockEntryAbs(workspace.root, entry.name));
  if (interference.replacement !== undefined) {
    return await stageLeftover(
      workspace,
      lockEntryRel(entry.name),
      interference.replacement,
    );
  }
  const left = await fsp.readdir(path.join(workspace.root, LOCK_PATH), {
    encoding: "buffer",
  });
  if (left.length > 0) {
    throw new Error(
      `harness error: T13.5-10(e)'s deletion of the held \`rename\`'s entry ` +
        `${renderRel(lockEntryRel(entry.name))} in ${workspace.root} left ` +
        `${String(left.length)} occupant(s) in ${LOCK_PATH}`,
    );
  }
  return undefined;
}

/**
 * Delete `.xspec/lock` and all it holds by hand (TEST-SPEC T13.5-10(e)),
 * verified on the harness itself — nothing at the lock path afterwards, an
 * ineffective deletion a harness error (H-11). Removing an entry needs the
 * lock directory's permissions alone, never the entry's own (H-4).
 */
async function deleteLockDirectory(root: string): Promise<void> {
  const abs = path.join(root, LOCK_PATH);
  await fsp.rm(abs, { recursive: true, force: true });
  if (await pathOccupied(Buffer.from(abs))) {
    throw new Error(
      `harness error: T13.5-10(e)'s deletion of ${LOCK_PATH} in ${root} ` +
        `left something there`,
    );
  }
}

/**
 * One (e) run of `paired.operation` beside the held `rename specs/A.mdx a
 * a2` whose entry `interference` deletes or replaces (TEST-SPEC
 * T13.5-10(e)), on a fresh session staging. The `rename` is started under
 * `--json --test-hold <path>` and held, the held-state comparison against
 * the workspace before it started observing its entry; `interference` is
 * staged; then the command is started likewise. It acquires — its hold file
 * created while the `rename` still holds, never refused `workspace-busy` (an
 * interfered hold excludes no run) — and once it holds the held-state
 * comparison, its baseline the same, finds its entry alone in the lock
 * directory: any replacing occupant gone, the directory with all it holds
 * and the link itself, the link's target byte-identical in place, the FIFO
 * unopened (a product opening it blocks short of its hold file, diagnosed
 * at the wait); its entry a plain file named apart from the `rename`'s (H-4:
 * 13.5's inequality). The holds are lifted in turn, the `rename`'s first,
 * exit 0. Once it completes, the workspace the command is held in is the
 * state the completed `rename` leaves — that `rename`'s unstaged twin's
 * final state (H-6: the lock path aside) — and the command's held-state
 * comparison, taken against that state, finds its entry byte-identical,
 * name and content, to its state when it created its hold file, and the
 * lock directory's only entry (SPEC 13.5: no release removes or alters a
 * live run's entry); a further mutating command — the same operation again
 * — is then refused `workspace-busy`, modifying nothing
 * (`assertBusyWhileHeld`: the second hold's exclusion intact), the entry
 * unchanged and still the only one. Lifted, the command exits 0; the
 * workspace then equals the twin's on which the two ran in turn
 * (`pairedTwin`; H-6), and `.xspec/lock` is absent.
 */
async function interferenceRun(
  product: ProductBinding,
  paired: PairedTwin,
  interference: Interference,
  renamed: UnstagedTwin,
): Promise<void> {
  const operation = paired.operation;
  await withWorkspace(CORE_DECL, async (workspace) => {
    const root = workspace.root;
    const context =
      `T13.5-10(e) ${operation.what} --json --test-hold <path> beside the ` +
      `held ${RENAME_A.what}, its ${interference.what}`;
    const items = await stageArmWorkspace(product, workspace, context);
    const renameHold = holdPathFor(workspace, "hold-rename.tmp");
    const commandHold = holdPathFor(workspace, "hold-command.tmp");
    const baseline = await snapshotDirectory(root);
    const rename = await startProduct(product, {
      cwd: root,
      argv: [...RENAME_A.argv(items), "--json", "--test-hold", renameHold],
      timeoutMs: INTERFERENCE_HOLD_TIMEOUT_MS,
    });
    let command: RunningProduct | undefined;
    try {
      const renameContext = `${context}: the held ${RENAME_A.what}`;
      await awaitHoldFile(rename, renameHold, renameContext);
      const renameEntry = onlyHeldEntry(
        await assertHeldState(
          root,
          { baseline, heldRuns: 1 },
          `${renameContext} once it holds, against the workspace before ` +
            `it started`,
        ),
      );
      const staged = await interfere(workspace, renameEntry, interference);
      command = await startProduct(product, {
        cwd: root,
        argv: [...operation.argv(items), "--json", "--test-hold", commandHold],
        timeoutMs: INTERFERENCE_HOLD_TIMEOUT_MS,
      });
      await awaitHoldFile(
        command,
        commandHold,
        `${context}: an interfered hold excludes no run — the command ` +
          `acquires, creating its hold file while the \`rename\` still ` +
          `holds, never refused "${WORKSPACE_BUSY}" (SPEC 13.5: anything in ` +
          `the lock directory but a plain file is no entry and records no ` +
          `identifier, whatever its name — a leftover acquisition removes, ` +
          `a FIFO unopened)`,
      );
      if (rename.hasExited()) {
        fail(
          `${context}: the held \`rename\` must still hold when the command ` +
            `creates its hold file, its own hold not yet lifted (SPEC 13.5) ` +
            `— ${await describeExit(rename)}`,
        );
      }
      const gone =
        interference.replacement === undefined
          ? "the `rename`'s entry deleted"
          : "the replacing occupant gone — the directory with all it " +
            "holds, the link itself, the FIFO unopened (SPEC 13.5: a " +
            "leftover acquisition removes)";
      const commandEntry = onlyHeldEntry(
        await assertHeldState(
          root,
          { baseline, heldRuns: 1 },
          `${context}, once the command holds, against the workspace ` +
            `before either started: ${gone}, the lock directory holding the ` +
            `command's entry alone`,
        ),
      );
      assertEntriesNamedApart(
        renameEntry,
        commandEntry,
        `${context}: the command's entry, once it holds, is named apart ` +
          `from the \`rename\`'s ${
            interference.replacement === undefined ? "deleted" : "replaced"
          } entry (H-4)`,
      );
      if (staged !== undefined) {
        await assertOutsideTargetsUntouched(
          [staged],
          `${context}: once the command holds, the replacing link's target ` +
            `outside the workspace is byte-identical in place`,
        );
      }
      // The holds lifted in turn, the `rename`'s first.
      await releaseHoldFile(renameHold);
      assertExitCode(
        await exitOnceLifted(rename, renameContext),
        0,
        `${renameContext}: its hold lifted, it completes, exit 0 — an ` +
          `interfered hold excludes no run, each faring as the lock ` +
          `directory then decides, its release finding its entry gone, ` +
          `which changes no outcome (SPEC 13.5)`,
      );
      const afterRename = await snapshotDirectory(root);
      assertSnapshotsEqual(
        renamed.final,
        afterRename,
        `${context}: once the \`rename\` completes, the workspace the held ` +
          `command is in is the state the completed \`rename\` leaves — its ` +
          `unstaged twin's final state (H-6: the lock path aside), the held ` +
          `command having modified nothing (SPEC 13.5: the hold comes ` +
          `before any modification)`,
      );
      const stillHeld = `${context}: the command, held once the \`rename\` has completed`;
      await assertHeldState(
        root,
        { baseline: afterRename, heldRuns: 1 },
        `${stillHeld} — its held-state comparison taken against the state ` +
          `the completed \`rename\` leaves`,
      );
      await assertOnlyEntry(
        root,
        commandEntry,
        `${stillHeld}: its entry byte-identical, name and content, to its ` +
          `state when it created its hold file, and the lock directory's ` +
          `only entry`,
      );
      await assertBusyWhileHeld(
        product,
        workspace,
        { running: command },
        operation.argv(items),
        `${context}: a further ${operation.what}, started while the command ` +
          `holds once the \`rename\` has completed — the second hold's ` +
          `exclusion intact`,
      );
      await assertOnlyEntry(
        root,
        commandEntry,
        `${stillHeld}, after the further command's refusal: its entry ` +
          `unchanged and still the lock directory's only one`,
      );
      await releaseHoldFile(commandHold);
      assertExitCode(
        await exitOnceLifted(command, `${context}: the command`),
        0,
        `${context}: the command, its hold lifted after the \`rename\` ` +
          `completed, completes, exit 0 — an operation composing with the ` +
          `\`rename\` (SPEC 13.5: past its hold it discovers its sources ` +
          `again)`,
      );
      assertSnapshotsEqual(
        paired.final,
        await snapshotDirectory(root),
        `${context}: once both complete, the workspace equals a twin's on ` +
          `which ${RENAME_A.what} and then ${operation.what} ran in turn ` +
          `(H-6: the lock path aside)`,
      );
      await assertLockPathAbsent(root, `${context}: once both have completed`);
      if (staged !== undefined) {
        await assertOutsideTargetsUntouched(
          [staged],
          `${context}: once both have completed, the replacing link's ` +
            `target outside the workspace still byte-identical in place`,
        );
      }
    } finally {
      rename.kill();
      command?.kill();
      await releaseHoldFile(renameHold);
      await releaseHoldFile(commandHold);
    }
  });
}

/**
 * One (e) run of `twin.operation` with the lock directory deleted during
 * its hold (TEST-SPEC T13.5-10(e)), on a fresh session staging: the
 * operation under `--json --test-hold <path>`, held — the held-state
 * comparison against the workspace before it started — then `.xspec/lock`
 * and all it holds deleted by hand, then the hold lifted. The run ends
 * exactly as its unstaged twin does: exit 0, no `write-failure` — its
 * release finding neither its entry nor the lock directory, which changes
 * no outcome (SPEC 13.5: interference voids the hold's exclusion alone, and
 * a deletion the environment refuses at release is no write failure, 14.24)
 * — standard output, standard error, and the final workspace byte-equal to
 * the twin's (H-6: the lock path aside), and nothing at `.xspec/lock`
 * afterwards: release brings back neither the entry nor the lock
 * directory.
 */
async function lockDirectoryDeletedRun(
  product: ProductBinding,
  twin: UnstagedTwin,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const root = workspace.root;
    const context =
      `T13.5-10(e) ${twin.operation.what} --json --test-hold <path>, ` +
      `${LOCK_PATH} and all it holds deleted by hand during its hold`;
    const items = await stageArmWorkspace(product, workspace, context);
    const hold = holdPathFor(workspace, "hold-deleted.tmp");
    const baseline = await snapshotDirectory(root);
    const running = await startProduct(product, {
      cwd: root,
      argv: [...twin.operation.argv(items), "--json", "--test-hold", hold],
      timeoutMs: INTERFERENCE_HOLD_TIMEOUT_MS,
    });
    try {
      await awaitHoldFile(running, hold, context);
      await assertHeldState(
        root,
        { baseline, heldRuns: 1 },
        `${context}, once it holds, against the workspace before it started`,
      );
      await deleteLockDirectory(root);
      await releaseHoldFile(hold);
      const result = await exitOnceLifted(running, context);
      assertExitCode(
        result,
        0,
        `${context}: its hold lifted, it ends as its unstaged twin does, ` +
          `exit 0 — no "${WRITE_FAILURE_CODE}": its release finds neither ` +
          `its entry nor the lock directory, which changes no outcome (SPEC ` +
          `13.5: interference voids the hold's exclusion alone; 14.24: a ` +
          `deletion the environment refuses at release is no write failure)`,
      );
      assertRunOutcomesEqual(
        result,
        twin.result,
        `${context}: it ends exactly as its unstaged twin does (SPEC 13.5; ` +
          `H-6)`,
        "the run whose lock directory was deleted",
        "its unstaged twin",
      );
      assertSnapshotsEqual(
        twin.final,
        await snapshotDirectory(root),
        `${context}: its final workspace is byte-equal to its unstaged ` +
          `twin's (H-6: the lock path aside)`,
      );
      await assertLockPathAbsent(
        root,
        `${context}: once it has ended — its release brings back neither ` +
          `its entry nor the lock directory`,
      );
    } finally {
      running.kill();
      await releaseHoldFile(hold);
    }
  });
}

// ---------------------------------------------------------------------------
// (e) on another machine, (f), and (g): fresh process-identifier namespaces
// ---------------------------------------------------------------------------

/** Identifiers ascending, without repeats. */
function ascendingIdentifiers(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

/** Whether two identifier lists hold the same identifiers. */
function sameIdentifiers(
  first: readonly number[],
  second: readonly number[],
): boolean {
  const a = ascendingIdentifiers(first);
  const b = ascendingIdentifiers(second);
  return a.length === b.length && a.every((value, at) => value === b[at]);
}

/**
 * The identifiers a run started in the harness's own namespace bears there
 * now — its started process's and every descendant's, as the harness's own
 * process list reads them (TEST-SPEC T13.5-10(e): those the other machine's
 * process list must not list).
 */
async function harnessIdentifiersOf(
  running: RunningProduct,
): Promise<number[]> {
  const pid = running.pid;
  if (pid === undefined) {
    throw new Error(`${running.commandLine} was never spawned`);
  }
  return ascendingIdentifiers([pid, ...(await descendantsOf(pid))]);
}

/**
 * Await `running`'s hold file at `holdPath`: undefined once it appears, or
 * the run's result should it exit first. A run still running when the wait
 * runs out fails, diagnosed under `rule` (H-8); a harness error propagates
 * as itself (H-11).
 */
async function holdOrExit(
  running: RunningProduct,
  holdPath: string,
  context: string,
  rule: string,
): Promise<RunResult | undefined> {
  try {
    await running.waitForFile(holdPath);
    return undefined;
  } catch (error) {
    rethrowHarnessError(error);
    if (!running.hasExited()) {
      return fail(
        `${context}: ${rule} — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  try {
    return await running.waitForExit();
  } catch (error) {
    rethrowHarnessError(error);
    return fail(
      `${context}: ${rule} — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * End a run started through a launcher that still runs at its trial's end,
 * through the launcher (H-2: `kill` is refused on it), its group confirmed
 * gone; what the kill meets is left to the trial's own outcome.
 */
async function endLaunchedRun(
  running: RunningProduct | undefined,
): Promise<void> {
  if (running === undefined || running.hasExited()) return;
  await running.killGroup().catch(() => undefined);
}

/**
 * (e)'s judgement of a command started on another machine that exited
 * before creating its hold file (TEST-SPEC T13.5-10(e)). Refused
 * `workspace-busy`, it is judged through the namespace's first process:
 * where the namespace has by then allocated an identifier as large as the
 * least the holder's processes bear (`holder`; allocation being cyclic,
 * T13.5-3: `hasAllocated`), the refusal may be 13.5's gap and the trial is
 * void (rerun on a fresh workspace in a fresh namespace); otherwise the
 * test fails, diagnosed — a product judging liveness beyond the acquiring
 * process's own process list, through anything its namespace shares with
 * the host, refuses here. Any other exit fails, diagnosed under `rule`.
 * Never returns.
 */
async function judgeOtherMachineExit(
  namespace: HarnessNamespace,
  result: RunResult,
  holder: readonly number[],
  context: string,
  rule: string,
): Promise<never> {
  const outcome = summarizeResult(result);
  if (
    result.exitCode !== 2 ||
    expectErrorDocument(result, context).code !== WORKSPACE_BUSY
  ) {
    return fail(`${context}: ${rule}; it exited first — ${outcome}`);
  }
  const least = Math.min(...holder);
  const observation = await namespace.observe();
  const seen =
    `its last allocated identifier ${String(observation.lastAllocated)}, ` +
    `its process list ${observation.listed.join(", ")}`;
  if (hasAllocated(observation, least)) {
    voidTrial(
      `T13.5-10(e)'s check of reused identifiers: the command's namespace ` +
        `has allocated an identifier as large as ${String(least)}, the ` +
        `least the holder's processes bear (${seen}), so the ` +
        `"${WORKSPACE_BUSY}" refusal may be 13.5's gap — the trial is ` +
        `void, rerun on a fresh workspace in a fresh namespace: ${context} ` +
        `— ${outcome}`,
    );
  }
  return fail(
    `${context}: ${rule}; it was refused "${WORKSPACE_BUSY}", though its ` +
      `namespace has allocated no identifier as large as ${String(least)}, ` +
      `the least the holder's processes bear (${seen}) — a product judging ` +
      `liveness beyond the acquiring process's own process list, through ` +
      `anything its namespace shares with the host, refuses here — ${outcome}`,
  );
}

/**
 * One run of (e)'s other-machine part for `paired.operation` (TEST-SPEC
 * T13.5-10(e); SPEC 13.5: a command on another machine removing a hold's
 * entry as a leftover interferes), a voidable trial on a fresh session
 * staging and in a fresh process-identifier namespace whose first process
 * is the harness's own, outliving the command (`openHarnessNamespace`,
 * E-1, E-3). `rename specs/A.mdx a a2 --json --test-hold <path>` is started
 * in the harness's own namespace and held, the held-state comparison
 * observing its entry; the harness verifies on itself, through the
 * namespace's first process, while the `rename` is held and before the
 * command starts, that the namespace's process list lists no identifier
 * the `rename`'s processes bear (`verifyNamespaceListsNone`; a listed one
 * an ineffective staging, H-11). The command is then started under `--json
 * --test-hold <path>` in that namespace: the holder is no run of its
 * machine, and its entry, recording an identifier the command's process
 * list does not list, is a leftover outside the gap (SPEC 13.5, 14.26). It
 * takes the entry over — creating its hold file while the holder still
 * holds, never refused `workspace-busy` (`judgeOtherMachineExit` voids or
 * fails a refusal) — and the lock directory then holds its entry alone, a
 * plain file named apart from the holder's (H-4). The holds are lifted in
 * turn, the holder's first, each exit 0, the holder's release finding its
 * entry gone, which changes no outcome; then `interferenceRun`'s assertions
 * follow but for the further mutating command, which, started in the
 * harness's namespace, would meet an entry recorded on another machine
 * whose identifier that namespace may list, in the gap: once the `rename`
 * completes the workspace is its unstaged twin's final state (H-6) and the
 * command's held-state comparison, taken against it, finds the command's
 * entry byte-identical, name and content, to its state when it created its
 * hold file, and the only entry; once both complete the workspace equals
 * the paired twin's, `.xspec/lock` absent. The namespace is closed with the
 * trial, its processes confirmed gone.
 */
async function otherMachineRun(
  product: ProductBinding,
  paired: PairedTwin,
  renamed: UnstagedTwin,
): Promise<void> {
  const operation = paired.operation;
  const label =
    `T13.5-10(e) ${operation.what} --json --test-hold <path> started on ` +
    `another machine — a fresh process-identifier namespace whose first ` +
    `process is the harness's own — beside the held ${RENAME_A.what}`;
  await runVoidableTrial(label, async (attempt) => {
    await withWorkspace(CORE_DECL, async (workspace) => {
      const root = workspace.root;
      const context = `${label} (trial ${String(attempt)})`;
      const items = await stageArmWorkspace(product, workspace, context);
      const renameHold = holdPathFor(workspace, "hold-rename.tmp");
      const commandHold = holdPathFor(workspace, "hold-command.tmp");
      const namespace = await openHarnessNamespace();
      let rename: RunningProduct | undefined;
      let command: RunningProduct | undefined;
      try {
        const baseline = await snapshotDirectory(root);
        rename = await startProduct(product, {
          cwd: root,
          argv: [...RENAME_A.argv(items), "--json", "--test-hold", renameHold],
          timeoutMs: INTERFERENCE_HOLD_TIMEOUT_MS,
        });
        const renameContext = `${context}: the held ${RENAME_A.what}`;
        await awaitHoldFile(rename, renameHold, renameContext);
        const renameEntry = onlyHeldEntry(
          await assertHeldState(
            root,
            { baseline, heldRuns: 1 },
            `${renameContext} once it holds, against the workspace before ` +
              `it started`,
          ),
        );
        const holder = await harnessIdentifiersOf(rename);
        await verifyNamespaceListsNone(
          namespace,
          holder,
          `the held ${RENAME_A.what}'s processes`,
        );
        command = await startProduct(product, {
          cwd: root,
          argv: [
            ...operation.argv(items),
            "--json",
            "--test-hold",
            commandHold,
          ],
          launcher: namespace.launcher,
          timeoutMs: INTERFERENCE_HOLD_TIMEOUT_MS,
        });
        const takeover =
          `the command, on another machine, takes the holder's entry over ` +
          `— creating its hold file while the holder still holds, never ` +
          `refused "${WORKSPACE_BUSY}" (SPEC 13.5, 14.26: the holder is no ` +
          `run of the command's machine, and its entry, recording an ` +
          `identifier the command's process list does not list, is a ` +
          `leftover outside the gap)`;
        const exited = await holdOrExit(
          command,
          commandHold,
          context,
          takeover,
        );
        if (exited !== undefined) {
          await judgeOtherMachineExit(
            namespace,
            exited,
            holder,
            context,
            takeover,
          );
        }
        if (rename.hasExited()) {
          fail(
            `${context}: the held \`rename\` must still hold when the ` +
              `command creates its hold file, its own hold not yet lifted ` +
              `(SPEC 13.5) — ${await describeExit(rename)}`,
          );
        }
        const commandEntry = onlyHeldEntry(
          await assertHeldState(
            root,
            { baseline, heldRuns: 1 },
            `${context}, once the command holds, against the workspace ` +
              `before either started: the holder's entry taken over — a ` +
              `leftover the command removed (SPEC 13.5) — the lock ` +
              `directory holding the command's entry alone`,
          ),
        );
        assertEntriesNamedApart(
          renameEntry,
          commandEntry,
          `${context}: the command's entry, once it holds, is named apart ` +
            `from the holder's (H-4)`,
        );
        // The holds lifted in turn, the holder's first.
        await releaseHoldFile(renameHold);
        assertExitCode(
          await exitOnceLifted(rename, renameContext),
          0,
          `${renameContext}: its hold lifted, it completes, exit 0 — its ` +
            `release finding its entry gone, which changes no outcome (SPEC ` +
            `13.5: an interfered hold excludes no run, each faring as the ` +
            `lock directory then decides)`,
        );
        const afterRename = await snapshotDirectory(root);
        assertSnapshotsEqual(
          renamed.final,
          afterRename,
          `${context}: once the \`rename\` completes, the workspace the held ` +
            `command is in is the state the completed \`rename\` leaves — its ` +
            `unstaged twin's final state (H-6: the lock path aside), the ` +
            `held command having modified nothing (SPEC 13.5: the hold comes ` +
            `before any modification)`,
        );
        const stillHeld = `${context}: the command, held once the \`rename\` has completed`;
        await assertHeldState(
          root,
          { baseline: afterRename, heldRuns: 1 },
          `${stillHeld} — its held-state comparison taken against the state ` +
            `the completed \`rename\` leaves`,
        );
        await assertOnlyEntry(
          root,
          commandEntry,
          `${stillHeld}: its entry byte-identical, name and content, to its ` +
            `state when it created its hold file, and the lock directory's ` +
            `only entry (SPEC 13.5: no release removes or alters a live ` +
            `run's entry)`,
        );
        await releaseHoldFile(commandHold);
        assertExitCode(
          await exitOnceLifted(command, `${context}: the command`),
          0,
          `${context}: the command, its hold lifted after the \`rename\` ` +
            `completed, completes, exit 0 — an operation composing with the ` +
            `\`rename\` (SPEC 13.5: past its hold it discovers its sources ` +
            `again)`,
        );
        assertSnapshotsEqual(
          paired.final,
          await snapshotDirectory(root),
          `${context}: once both complete, the workspace equals a twin's on ` +
            `which ${RENAME_A.what} and then ${operation.what} ran in turn ` +
            `(H-6: the lock path aside)`,
        );
        await assertLockPathAbsent(
          root,
          `${context}: once both have completed`,
        );
      } finally {
        rename?.kill();
        await endLaunchedRun(command);
        await releaseHoldFile(renameHold);
        await releaseHoldFile(commandHold);
        await namespace.close();
      }
    });
  });
}

/**
 * One run of (f) for `operation` (TEST-SPEC T13.5-10(f)), a voidable trial
 * on a fresh session staging. `rename specs/A.mdx a a2` is started under
 * `--test-hold` as the first process of a fresh process-identifier
 * namespace with its own process list (`launcher`: `freshNamespaceLauncher`,
 * E-1, E-3) and, held, killed under T13.5-3's discipline (`killHeldRun`
 * through the launcher), the in-namespace identifiers its processes bear
 * read while it is held; the dead entry — its name recorded after the
 * kill — is the lock directory's one entry (T13.5-3). `operation` is then
 * started the same way, in another fresh namespace, under `--json
 * --test-hold <path>`: the identifier the dead entry records is listed
 * there, being the acquiring process's own (SPEC 13.5: an entry recorded on
 * another machine is a leftover, and one recording the acquiring process's
 * own identifier lies outside the gap), so it takes the entry over — any
 * refusal failing the test, T13.5-3's reuse check not applying where the
 * identifier listed is the acquirer's own. While it is held the harness
 * verifies on itself that its processes bear the in-namespace identifiers
 * the killed run's bore — a mismatch voiding the trial, rerun on a fresh
 * workspace in fresh namespaces (exhaustion a harness error, H-11) — and
 * the held-state comparison finds the lock directory's one entry its own,
 * named byte-differently from the dead entry (H-4's one comparison across
 * runs; SPEC 13.5: an entry's name distinguishes its run, no other run's
 * entry ever bearing it): a product naming an entry by its identifier
 * alone overwrites the leftover with its own entry or adopts it as its
 * own, the two runs' acquiring processes bearing one identifier here.
 * Lifted, it exits 0, `.xspec/lock` absent afterwards.
 */
async function ownIdentifierRun(
  product: ProductBinding,
  operation: SessionOperation,
  launcher: RunLauncher,
): Promise<void> {
  const label =
    `T13.5-10(f) ${operation.what} --json --test-hold <path> started as ` +
    `the first process of a fresh process-identifier namespace, over the ` +
    `entry of a held ${RENAME_A.what} started and killed likewise in another`;
  await runVoidableTrial(label, async (attempt) => {
    await withWorkspace(CORE_DECL, async (workspace) => {
      const root = workspace.root;
      const context = `${label} (trial ${String(attempt)})`;
      const items = await stageArmWorkspace(product, workspace, context);
      let bore: readonly number[] = [];
      const dead = await killHeldRun(product, {
        root,
        argv: KILLED_RENAME,
        holdPath: holdPathFor(workspace, "hold-killed.tmp"),
        context:
          `${context}: the held \`rename specs/A.mdx a a2\`, the first ` +
          `process of a fresh namespace`,
        launcher,
        whileHeld: async (running) => {
          bore = await inNamespaceIdentifiers(running);
        },
      });
      const baseline = await snapshotDirectory(root);
      const hold = holdPathFor(workspace, "hold-command.tmp");
      let command: RunningProduct | undefined;
      try {
        command = await startProduct(product, {
          cwd: root,
          argv: [...operation.argv(items), "--json", "--test-hold", hold],
          launcher,
          timeoutMs: INTERFERENCE_HOLD_TIMEOUT_MS,
        });
        const takeover =
          `the command takes the dead run's entry over, creating its hold ` +
          `file — the identifier the entry records, though listed in the ` +
          `command's process list, being the acquiring process's own (SPEC ` +
          `13.5: an entry recorded on another machine is a leftover, and ` +
          `one recording the acquiring process's own identifier lies ` +
          `outside the gap) — any refusal here failing, T13.5-3's reuse ` +
          `check not applying where the identifier listed is the acquirer's ` +
          `own`;
        const exited = await holdOrExit(command, hold, context, takeover);
        if (exited !== undefined) {
          fail(
            `${context}: ${takeover}; it exited first — ` +
              summarizeResult(exited),
          );
        }
        const bears = await inNamespaceIdentifiers(command);
        if (!sameIdentifiers(bears, bore)) {
          voidTrial(
            `T13.5-10(f): the two runs' processes bear different ` +
              `in-namespace identifiers while held — the killed ` +
              `\`rename\`'s ${bore.join(", ")}, the command's ` +
              `${bears.join(", ")} — so the two acquiring processes need not ` +
              `share the identifier the entry records; the trial is void, ` +
              `rerun on a fresh workspace in fresh namespaces: ${context}`,
          );
        }
        const entry = onlyHeldEntry(
          await assertHeldState(
            root,
            { baseline, heldRuns: 1 },
            `${context}, once the command holds, against the workspace ` +
              `after the kill: the dead entry taken over — a leftover the ` +
              `command removed (SPEC 13.5) — the lock directory holding the ` +
              `command's entry alone`,
          ),
        );
        assertEntriesNamedApart(
          dead.entry,
          entry,
          `${context}: while the command is held, its entry bears a name ` +
            `byte-different from the dead run's entry, recorded after the ` +
            `kill (H-4's one comparison across runs; SPEC 13.5: an entry's ` +
            `name distinguishes its run, no other run's entry ever bearing ` +
            `it — the two runs' acquiring processes bearing one identifier ` +
            `here, a name recording the identifier alone overwrites the ` +
            `leftover or adopts it as the command's own)`,
        );
        await releaseHoldFile(hold);
        assertExitCode(
          await exitOnceLifted(command, context),
          0,
          `${context}: its hold lifted, it completes, exit 0 — the dead ` +
            `run's entry taken over (SPEC 13.5)`,
        );
        await assertLockPathAbsent(
          root,
          `${context}: once it has ended (SPEC 13.5: the leftover removed ` +
            `at acquisition, the run's own entry released)`,
        );
      } finally {
        await endLaunchedRun(command);
        await releaseHoldFile(hold);
      }
    });
  });
}

/**
 * How (g)'s command fared: it proceeded at once, or it was refused
 * `workspace-busy` and proceeded once `.xspec/lock` was deleted by hand.
 */
type GapOutcome = "proceeded" | "refused, then proceeded";

/** (g)'s outcome for one command (`runT13510MachineArms`). */
export interface GapReport {
  /** The command, as T13.5-10 names it. */
  readonly operation: string;
  readonly outcome: GapOutcome;
}

/**
 * One run of (g) for `twin.operation` (TEST-SPEC T13.5-10(g); SPEC 13.5's
 * gap and 13.4's manual remedy), on a fresh session staging. `rename
 * specs/A.mdx a a2` is started under `--test-hold` as the first process of
 * a fresh process-identifier namespace (`launcher`, as in (f)) and, held,
 * killed under T13.5-3's discipline, the harness verifying on itself —
 * while it is held, and again before the command — that every in-namespace
 * identifier its processes bear or bore is listed in the harness's own
 * process list (`verifyListedByHarness`; a mismatch an ineffective staging,
 * H-11): its entry then records an identifier, not the acquirer's own, that
 * the acquirer's process list lists — an entry in 13.5's gap. The command,
 * under `--json` in the harness's own namespace, bounded (it completes
 * promptly), either proceeds — exit 0, its result byte-equal to its
 * unstaged twin's, `.xspec/lock` absent once it ends (`assertTakeover`) —
 * or is refused — exit 2, `code` `"workspace-busy"`, `path`
 * `".xspec/lock"`, `locations` `[]`, nothing modified (the compare
 * bracketing it alone, H-6 leaving the lock path out), the entry
 * byte-identical, name and content, the lock directory's only one (SPEC
 * 13.5, 14.26: such an entry MAY refuse as a live run's entry does) — never
 * another outcome, T13.5-3's reuse check not applying. Where it is refused,
 * `.xspec/lock` is deleted by hand while no mutating command runs (13.4:
 * the remedy for a leftover that blocks), and the same command then
 * proceeds, judged alike (SPEC 13.5: such an entry refuses only until it is
 * deleted manually). Returns the outcome it took.
 */
async function gapRun(
  product: ProductBinding,
  twin: UnstagedTwin,
  launcher: RunLauncher,
): Promise<GapOutcome> {
  return await withWorkspace(CORE_DECL, async (workspace) => {
    const root = workspace.root;
    const context =
      `T13.5-10(g) ${twin.operation.what} --json, in the harness's own ` +
      `namespace, over the entry of a held ${RENAME_A.what} started as the ` +
      `first process of a fresh process-identifier namespace and killed — ` +
      `an entry in 13.5's gap`;
    const items = await stageArmWorkspace(product, workspace, context);
    let bore: readonly number[] = [];
    const dead = await killHeldRun(product, {
      root,
      argv: KILLED_RENAME,
      holdPath: holdPathFor(workspace, "hold-killed.tmp"),
      context:
        `${context}: the held \`rename specs/A.mdx a a2\`, the first ` +
        `process of a fresh namespace`,
      launcher,
      whileHeld: async (running) => {
        bore = await inNamespaceIdentifiers(running);
        await verifyListedByHarness(
          bore,
          "the held `rename specs/A.mdx a a2`, while it is held,",
        );
      },
    });
    await verifyListedByHarness(
      bore,
      "the killed `rename specs/A.mdx a a2`, before the command,",
    );
    const argv = [...twin.operation.argv(items), "--json"];
    const before = await snapshotDirectory(root);
    const result = await runBounded(product, root, argv, context);
    const either =
      `it either proceeds, exit 0, or is refused, exit 2 ` +
      `"${WORKSPACE_BUSY}" at "${LOCK_PATH}" — never another outcome (SPEC ` +
      `13.5, 14.26: an entry in the gap MAY refuse acquisitions as a live ` +
      `run's entry does; T13.5-3's reuse check not applying)`;
    if (result.exitCode === 0) {
      await assertTakeover(root, result, twin, [], context, either);
      return "proceeded";
    }
    assertExitCode(result, 2, `${context}: ${either}`);
    const finding = expectErrorDocument(result, context);
    assertSameJson(
      { code: finding.code, path: finding.path, locations: finding.locations },
      { code: WORKSPACE_BUSY, path: LOCK_PATH, locations: [] },
      `${context}: ${either} — its error document carrying the stable code ` +
        `"${WORKSPACE_BUSY}", the concerned path "${LOCK_PATH}", and no ` +
        `locations (SPEC 14.26, 12.7) — message: ` +
        JSON.stringify(finding.message),
    );
    assertSnapshotsEqual(
      before,
      await snapshotDirectory(root),
      `${context}: refused, it modifies nothing — every workspace path but ` +
        `the lock path byte-identical, the compare bracketing this run ` +
        `alone (SPEC 13.5; H-6: the lock path judged apart)`,
    );
    await assertOnlyEntry(
      root,
      dead.entry,
      `${context}: refused, the entry in the gap stands byte-identical, ` +
        `name and content, the lock directory's only entry (SPEC 13.5: no ` +
        `leftover removed once acquisition is refused; a refused run's ` +
        `release deletes its own entry)`,
    );
    // The manual remedy (13.4), while no mutating command runs.
    await deleteLockDirectory(root);
    const remedied = `${context}, run again once ${LOCK_PATH} is deleted by hand`;
    await assertTakeover(
      root,
      await runBounded(product, root, argv, remedied),
      twin,
      [],
      remedied,
      `it proceeds, exit 0 (SPEC 13.5: an entry in the gap refuses only ` +
        `until it is deleted manually; 13.4: the remedy for a leftover ` +
        `that blocks)`,
    );
    return "refused, then proceeded";
  });
}

// ---------------------------------------------------------------------------
// (h) Acquisition lists no directory but those 13.5 names
// ---------------------------------------------------------------------------

/**
 * (h)'s section-form `move` (SPEC 6.5's second form), in the file form's
 * place: `g`, a top-level leaf, moved within `specs/A.mdx` to become `a.g`,
 * the last child of `a` — an operation succeeding on the session staging
 * that leaves no orphan, every file it rewrites standing before it and none
 * relocated (SPEC 13.4). It lies outside CONF-CORE's surface (the
 * conformer's admitted section-form move exits 70).
 */
const SECTION_MOVE: SessionOperation = {
  what: "`move specs/A.mdx#g specs/A.mdx#a.g`",
  argv: () => ["move", "specs/A.mdx#g", "specs/A.mdx#a.g"],
};

/**
 * (h)'s mutating commands, in turn: each whose operation leaves no orphan —
 * T13.5-10's commands, the section form of `move` in the file form's place
 * (TEST-SPEC T13.5-10(h): the file form is not run, removing its orphans
 * relying on the record, whose readability without a listing of `.xspec`
 * rests on a graph-data layout SPEC.md leaves unenumerated, 13.3).
 */
const T13_5_10_H_OPERATIONS: readonly SessionOperation[] =
  T13_5_10_OPERATIONS.map((operation) =>
    operation === FILE_MOVE ? SECTION_MOVE : operation,
  );

/** The journal's workspace-relative path (SPEC 6.1, 13.4). */
const JOURNAL_REL = `${AREA_PATH}/journal`;

/** The session directory's workspace-relative path (SPEC 10.1). */
const REVIEWS_REL = `${AREA_PATH}/reviews`;

/**
 * Whether (h) compares the snapshot key `key` with the twin's (TEST-SPEC
 * T13.5-10(h)): every path outside `.xspec`, and the journal and the session
 * files — the session directory with all it holds, sessions alone (SPEC
 * 10.1) — graph data compared nowhere (its layout unenumerated, 13.3), the
 * lock path judged apart.
 */
function comparedInH(key: string): boolean {
  if (key !== AREA_PATH && !key.startsWith(`${AREA_PATH}/`)) return true;
  return (
    key === JOURNAL_REL ||
    key === REVIEWS_REL ||
    key.startsWith(`${REVIEWS_REL}/`)
  );
}

/** `snapshot` restricted to (h)'s compared paths (`comparedInH`). */
function comparedInHView(snapshot: DirectorySnapshot): DirectorySnapshot {
  return {
    ...snapshot,
    entries: new Map([...snapshot.entries].filter(([key]) => comparedInH(key))),
  };
}

/**
 * One (h) run for `twin.operation` (TEST-SPEC T13.5-10(h); SPEC 13.5), on a
 * fresh session staging under CORE_DECL's configuration, whose one glob
 * reaches nothing under `.xspec` (it reaches `.mdx` files under `specs/`
 * alone): `.xspec`, holding no `lock`, made unlistable but searchable and
 * writable before the invocation (`stageUnlistableArea`: mode `-wx`,
 * T14-10's discipline — the harness's own listing of it refused, its own
 * creation and removal of a file in it kept, verified first), then the
 * command under `--json`, bounded, and `.xspec`'s mode restored once it ends
 * → it proceeds: exit 0; its standard output byte-equal to its unstaged
 * twin's; `.xspec/lock` absent; every path outside `.xspec`, and the journal
 * and the session files, byte-equal to the twin's, graph data compared
 * nowhere (`comparedInH`); then `build` exits 0 and `check --json` is clean.
 * A conforming acquisition learns the lock path's kind by examining that
 * path, which needs only `.xspec`'s search permission, brings the lock
 * directory and its entry into existence, which needs its write permission,
 * and lists the lock directory alone; a refused listing of `.xspec` anywhere
 * but at acquisition is condition 23's state, never a read failure (14.25):
 * it refuses no real operation (6.6), and a refresh regenerates graph data
 * in it (13.3). A product whose acquisition lists `.xspec` — to learn the
 * lock path's kind from that listing — meets a refused read there and
 * fails.
 */
async function unlistableAreaRun(
  product: ProductBinding,
  twin: UnstagedTwin,
): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    const root = workspace.root;
    const context =
      `T13.5-10(h) ${twin.operation.what} --json with \`.xspec\`, holding ` +
      `no \`lock\`, unlistable but searchable and writable (mode \`-wx\`)`;
    const items = await stageArmWorkspace(product, workspace, context);
    const staging = await stageUnlistableArea(workspace);
    let result: RunResult;
    try {
      result = await runBounded(
        product,
        root,
        [...twin.operation.argv(items), "--json"],
        context,
      );
    } finally {
      await staging.restore();
    }
    assertExitCode(
      result,
      0,
      `${context}: acquisition lists no directory but those 13.5 names — ` +
        `it examines the lock path by name, which needs only \`.xspec\`'s ` +
        `search permission, brings the lock directory and its entry into ` +
        `existence, which needs its write permission, and lists the lock ` +
        `directory alone — so the command proceeds, exit 0 (SPEC 13.5; a ` +
        `refused listing of \`.xspec\` anywhere but at acquisition is ` +
        `condition 23's state, never a read failure, 14.25, refusing no ` +
        `real operation, 6.6)`,
    );
    assertBytesEqual(
      result.stdoutBytes,
      twin.result.stdoutBytes,
      `${context}: its standard output is byte-equal to its unstaged twin's ` +
        `(SPEC 13.5, 12.0)`,
    );
    await assertLockPathAbsent(
      root,
      `${context}: once it has ended (SPEC 13.5: release deletes its entry, ` +
        `then the emptied lock directory, neither deletion needing ` +
        `\`.xspec\`'s read permission)`,
    );
    assertSnapshotsEqual(
      comparedInHView(twin.final),
      comparedInHView(await snapshotDirectory(root)),
      `${context}: every path outside \`.xspec\`, and the journal and the ` +
        `session files, byte-equal to its unstaged twin's once \`.xspec\`'s ` +
        `mode is restored — graph data compared nowhere (SPEC 13.3: its ` +
        `layout unenumerated; H-6)`,
    );
    const restored = `${context}, once \`.xspec\`'s permissions are restored,`;
    assertExitCode(
      await runBounded(product, root, ["build"], `${restored} \`build\``),
      0,
      `${restored} \`build\` exits 0 (SPEC 12.1, 13.3: a refresh ` +
        `regenerates graph data in condition 23's state)`,
    );
    const checked = await runBounded(
      product,
      root,
      ["check", "--json"],
      `${restored} \`check --json\``,
    );
    assertExitCode(
      checked,
      0,
      `${restored} \`check --json\` is clean once \`build\` has run — exit 0 ` +
        `(SPEC 12.0, 13.3)`,
    );
    assertCleanCheckReport(checked, `${restored} \`check --json\``);
  });
}

/**
 * T13.5-10's arms whose stagings need the administrative access of E-1 —
 * (e)'s other-machine part, (f), and (g) — each command in turn, each
 * staged afresh, given T13.5-10's unstaged twins (`twins`), (e)'s paired
 * twins (`pairs`), and the held `rename`'s unstaged twin (`renamed`). A
 * runner withholding that access fails them as harness errors, never
 * skips (E-1, H-9, H-11); each namespace is its trial's own, gone with it
 * (E-3). Returns (g)'s outcome per command.
 */
async function machineArms(
  product: ProductBinding,
  twins: readonly UnstagedTwin[],
  pairs: readonly PairedTwin[],
  renamed: UnstagedTwin,
): Promise<GapReport[]> {
  for (const paired of pairs) {
    await otherMachineRun(product, paired, renamed);
  }
  const launcher = await freshNamespaceLauncher();
  for (const operation of T13_5_10_OPERATIONS) {
    await ownIdentifierRun(product, operation, launcher);
  }
  const outcomes: GapReport[] = [];
  for (const twin of twins) {
    outcomes.push({
      operation: twin.operation.what,
      outcome: await gapRun(product, twin, launcher),
    });
  }
  return outcomes;
}

/**
 * T13.5-10's arms needing administrative access alone — (e)'s
 * other-machine part, (f), and (g) — with the twins they need, against
 * `product`: for a probe run where that access is (CI's Linux legs;
 * AGENTS.md), the registered body running them last, after every arm
 * needing none. Returns (g)'s outcome per command.
 */
export async function runT13510MachineArms(
  product: ProductBinding,
): Promise<GapReport[]> {
  const twins: UnstagedTwin[] = [];
  for (const operation of T13_5_10_OPERATIONS) {
    twins.push(await unstagedTwin(product, operation));
  }
  const renamed = twins.find((twin) => twin.operation === RENAME_A);
  if (renamed === undefined) {
    throw new Error(`T13.5-10: no unstaged twin of ${RENAME_A.what}`);
  }
  const pairs: PairedTwin[] = [];
  for (const operation of T13_5_10_COMPOSING) {
    pairs.push(await pairedTwin(product, operation));
  }
  return await machineArms(product, twins, pairs, renamed);
}

// ---------------------------------------------------------------------------
// T13.5-10
// ---------------------------------------------------------------------------

const T13_5_10 = defineProductTest({
  id: "T13.5-10",
  title:
    "13.5's acquisition, arms (a) to (h): each arm staged afresh, on a fresh workspace, for each mutating command in turn (`rename specs/A.mdx a a2`, `move specs/A.mdx specs/B.mdx` (in (h) the section form, `move specs/A.mdx#g specs/A.mdx#a.g`, instead), `review create --strategy audit --name t`, `review resolve s <item> --status no-change`, `review split s <item>`; each an operation succeeding on an unstaged twin, exit 0, `.xspec/lock` absent once it ends), on a freshly built valid workspace holding an `audit` session `s` created while it was valid, run under `--json` and completing promptly, no FIFO opened: (a) obstruction — `.xspec` a plain file, a symbolic link to a directory holding a journal and sessions (the workspace's own area relocated outside it), a dangling symbolic link, or a FIFO → exit 2, `code` `\"write-failure\"`, `path` `\".xspec\"`; `.xspec/lock` a symbolic link to a directory outside the workspace holding a file, a symbolic link to a file, a dangling symbolic link, or a FIFO → exit 2, `code` `\"write-failure\"`, `path` `\".xspec/lock\"` (`locations` `[]` each) — nothing modified, the occupant byte-identical in place, a link's target untouched and nothing written through a link; (b) leftover takeover — a plain file at `.xspec/lock`, and one with every permission removed; in a lock directory a directory holding a file, a directory tree two levels deep (a directory holding a directory that holds a plain file, a symbolic link to a directory outside the workspace holding a file, a dangling symbolic link, and a FIFO), a symbolic link to a directory outside the workspace holding a file, and a FIFO; a dead run's entry (a held `rename` killed under T13.5-3's discipline), and one with every permission removed; and a dead run's entry carried into another workspace by a copy of the whole workspace made after the kill → exit 0, its result (exit code, standard output and error, and final workspace) byte-equal to its unstaged twin's (H-6), `.xspec/lock` absent once it ends, every link's target outside the workspace byte-identical — a busy refusal over a dead run's entry meeting T13.5-3's reuse check, the trial void where a killed identifier is listed again; (c) a busy refusal — during a held `review resolve`'s hold (`review resolve s <item> --status skipped --test-hold <path>`), staged afresh for each command: dead runs' entries (twins' held `rename`s killed under T13.5-3's discipline before the holder starts and while it holds, copied in, name and content) and leftovers of the harness's naming (directories holding a file or a FIFO, made `-wx` once filled, the harness's own listing of each refused) bracketing the holder's entry — at least one of each kind before it and one after it, in byte order of name and in the filesystem's listing order, its name observed, never pinned, further stagings each a bounded number, exhaustion voiding the trial, rerun with a fresh holder — → exit 2, `code` `\"workspace-busy\"`, `path` `\".xspec/lock\"`, `locations` `[]`, never `\"read-failure\"`, exiting while the holder holds, nothing modified, every staged leftover and dead entry byte-identical in place (permissions restored first) and the holder's entry byte-identical, name and content; once the holder completes (exit 0), `.xspec/lock` holds exactly the staged leftovers, and the command run once more removes them all, `.xspec/lock` absent once it ends; with no leftover staged, the holder's entry given no permission (its name and content recorded first, the harness's own read refused) → refused alike, the entry still the only one under the same name, its content byte-identical once its permissions are restored, `.xspec/lock` absent after the holder; and the holder's entry altered in place (truncated, overwritten with ill-formed UTF-8 garbage of another length, or with a dead run's entry's content; its name recorded before, its content after) → refused alike, the altered entry byte-identical as altered and the only entry, the holder completing exit 0, `.xspec/lock` absent; (d) refused reads and writes — each staging verified on the harness itself, its modes restored once the run ends: an empty leftover lock directory `-wx` → `\"read-failure\"`, or `r-x` → `\"write-failure\"`, no `.xspec/lock` afterwards (determinism arms: each run twice, and once more on a content-identical workspace at a different absolute path, each on its own staging, standard output and standard error byte-identical); a lock directory holding a subdirectory that holds a file, the subdirectory `-wx` → `\"read-failure\"`, or `r-x` → `\"write-failure\"`, the lock directory then holding exactly one occupant, a directory (its name unasserted) holding exactly the staged file, and no entry; a read-only `.xspec` holding no `lock` → `\"write-failure\"`, no `.xspec/lock` afterwards; a plain file at `.xspec/lock` with `.xspec` read-only and the file unwritable → `\"write-failure\"`, the file byte-identical in place; `.xspec` unsearchable (`rw-`) holding no `lock`, or an empty lock directory → `\"read-failure\"` or `\"write-failure\"`, `.xspec` with all it holds byte-identical; a lock directory unsearchable (`rw-`) holding a directory that holds a file → either code, exactly the staged directory and its file remaining, no entry; and an unbuilt workspace, its root read-only → `\"write-failure\"` at `\".xspec\"`, no `.xspec` afterwards, `resolve` and `split` there naming the absent session `s` — each exit 2, `path` `\".xspec/lock\"` but where stated, never a nested path, `locations` `[]`, nothing else modified; (e) interference on one machine — during the hold of `rename specs/A.mdx a a2 --test-hold <path>` its entry deleted by hand, or replaced under its name by a directory holding a file, a FIFO, or a symbolic link to a plain file outside the workspace, each command an operation composing with that `rename` (`rename specs/A.mdx g g2` in `rename`'s place) started under `--test-hold` → it acquires, its hold file created while the `rename` still holds, never refused `\"workspace-busy\"`, the replacing occupant gone (the link's target byte-identical in place, the FIFO unopened), its entry named apart from the `rename`'s and the lock directory's only one; the holds lifted in turn, the `rename`'s first, each exit 0; once the `rename` completes, the workspace is its unstaged twin's (H-6), the command's held-state comparison taken against it, its entry byte-identical, name and content, to its state when it created its hold file and the only entry, and a further mutating command refused `\"workspace-busy\"`, modifying nothing; once both complete, the workspace equals a twin's on which the two ran in turn, `.xspec/lock` absent; and `.xspec/lock` and all it holds deleted by hand during each command's hold → exit 0, its output and final workspace byte-equal to its unstaged twin's (H-6), no `\"write-failure\"`, nothing at `.xspec/lock` afterwards; (e) on another machine — each composing command started under `--test-hold` in a fresh process-identifier namespace whose first process is the harness's own, which lists no identifier the held `rename`'s processes bear → it takes the holder's entry over, its hold file created while the holder holds, its entry alone and named apart; the holds lifted in turn, the holder's first, each exit 0; the assertions above following but for the further command — a `\"workspace-busy\"` refusal voiding the trial only where the namespace has allocated an identifier as large as the least the holder's processes bear, failing otherwise; (f) the acquirer's own identifier — a held `rename` started as the first process of a fresh process-identifier namespace and killed under T13.5-3's discipline, each command started likewise in another (the two runs' in-namespace identifiers verified equal while held, a mismatch voiding the trial) → it takes the dead entry over, exit 0, `.xspec/lock` absent afterwards, its entry while held named byte-differently from the dead entry, any refusal failing; (g) the gap's bound and its manual remedy — the same kill, every in-namespace identifier the `rename`'s processes bore verified listed in the harness's own process list → each command, in the harness's namespace, either proceeds (exit 0, its result byte-equal to its unstaged twin's, `.xspec/lock` absent) or is refused (exit 2, `code` `\"workspace-busy\"`, `path` `\".xspec/lock\"`, nothing modified, the entry byte-identical, name and content), never another outcome; refused, `.xspec/lock` deleted by hand, the same command then proceeding as its twin; (h) acquisition lists no directory but those 13.5 names — `.xspec`, holding no `lock`, made unlistable but searchable and writable before the invocation (mode `-wx`; the harness's own listing of it refused, its own creation and removal of a file in it kept, verified first), under a configuration whose glob reaches nothing under `.xspec`, each command whose operation leaves no orphan (`rename`, the section-form `move`, `review create`, `resolve`, `split`; the file form not run) → it proceeds: exit 0, its standard output byte-equal to its unstaged twin's, every path outside `.xspec` and the journal and session files byte-equal to the twin's (graph data compared nowhere), `.xspec/lock` absent once it ends; and once `.xspec`'s permissions are restored, `build` exits 0 and `check` is clean — a refused listing of `.xspec` past acquisition being condition 23's state, never a read failure: no real operation refused there, a refresh regenerating graph data in it (SPEC 13.5, 13.4, 13.3, 12.0, 6.6, 14.24, 14.25, 14.26)",
  timeoutMs: 1_800_000,
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
    // (d) Refused reads and writes: each staging with each command in turn,
    // the two empty leftover lock directories' arms also determinism arms.
    for (const arm of REFUSAL_ARMS) {
      for (const operation of T13_5_10_OPERATIONS) {
        await refusalArmRuns(product, operation, arm);
      }
    }
    // (e) Interference on one machine: the held `rename`'s entry deleted or
    // replaced, each composing command beside it, each staged afresh; and
    // the lock directory deleted during each command's hold.
    const renamed = twins.find((twin) => twin.operation === RENAME_A);
    if (renamed === undefined) {
      throw new Error(`T13.5-10: no unstaged twin of ${RENAME_A.what}`);
    }
    const pairs: PairedTwin[] = [];
    for (const operation of T13_5_10_COMPOSING) {
      pairs.push(await pairedTwin(product, operation));
    }
    for (const interference of INTERFERENCES) {
      for (const paired of pairs) {
        await interferenceRun(product, paired, interference, renamed);
      }
    }
    for (const twin of twins) {
      await lockDirectoryDeletedRun(product, twin);
    }
    // (h) Acquisition lists no directory but those 13.5 names: `.xspec`
    // unlistable before each command whose operation leaves no orphan, the
    // section form of `move` in the file form's place (its twin made at its
    // turn) — before the arms needing administrative access, so that every
    // arm needing none runs first.
    for (const operation of T13_5_10_H_OPERATIONS) {
      const twin =
        twins.find((candidate) => candidate.operation === operation) ??
        (await unstagedTwin(product, operation));
      await unlistableAreaRun(product, twin);
    }
    // (e) on another machine, (f), and (g): fresh process-identifier
    // namespaces made with the administrative access of E-1 — run last, so
    // that every arm needing none runs first.
    await machineArms(product, twins, pairs, renamed);
  },
});

export const section135iiTests: readonly ProductTestEntry[] = [T13_5_10];
