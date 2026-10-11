// Acquisition's refused reads and writes as shared stagings (TEST-SPEC
// T13.5-10(d); the stagings T14-9's acquisition-write arms and T14-10's arm
// (i) reuse; SPEC 13.5, 14.24, 14.25), beside T13.5-10(h)'s unlistable area,
// under which acquisition proceeds. Harness machinery only: no product
// imports, no test framework dependence.
//
// Each staging is applied before the invocation, on a workspace whose lock
// path holds nothing — a freshly built one, or an unbuilt one where it says
// so — and verified on the harness itself before it returns (E-1, H-11: an
// ineffective staging, a privileged runner among its causes, is
// `HarnessStagingError`, never a pass or a skip): T14-9's discipline
// (helpers/permissions.ts `stageWriteRefusal`: the directory holding the
// path read-only and, where the path is occupied, its occupant unwritable)
// or a directory's stated mode, its effect probed as TEST-SPEC states it
// (`stageDirectoryMode`); a leftover staged at the lock path or in the lock
// directory through helpers/lock-staging.ts's `stageLeftover`, whose record
// the residue checks compare against. Never a plain file of the harness's own
// naming at the lock directory's top level (T13.5-10(b)'s caution).
//
// - `stageUnlistableLockDirectory`: an empty leftover lock directory
//   unlistable but writable (`-wx`): its listing refused, a creation in it
//   kept — so acquisition adds its entry and then meets the refused listing,
//   a read failure past the entry's addition.
// - `stageUnwritableLockDirectory`: an empty leftover lock directory refusing
//   writes (`r-x`): a creation in it refused, its listing kept — a write
//   failure at the entry's addition.
// - `stageUnlistableLeftoverDirectory`: a lock directory holding a
//   subdirectory that holds a file, the subdirectory unlistable (`-wx`): its
//   listing refused, its file reachable by name — a read failure at the
//   leftover's removal.
// - `stageUnwritableLeftoverDirectory`: the same, the subdirectory refusing
//   writes (`r-x`): its file's removal (and a creation in it) refused, its
//   listing and its file's examination kept — a write failure at the
//   leftover's removal. The lock directory stays writable, unlike under
//   T14-9's full discipline.
// - `stageReadOnlyArea`: `.xspec` read-only, holding no `lock` (T14-9's
//   discipline at the lock path) — a write failure at the lock directory's
//   creation.
// - `stageUnremovableLockFile`: a plain file at `.xspec/lock`, a leftover
//   acquisition removes, with `.xspec` read-only and the file unwritable
//   (T14-9's full discipline) — a write failure at its removal.
// - `stageUnsearchableArea`: `.xspec` unsearchable (`rw-`), holding no `lock`
//   or, separately, an empty lock directory: the examination of `.xspec/lock`
//   and a creation in `.xspec` refused, its listing kept.
// - `stageUnsearchableLockDirectory`: a lock directory unsearchable (`rw-`)
//   holding a directory that holds a file: the examination of that
//   directory's kind and a creation in the lock directory refused, its
//   listing kept.
// - `stageReadOnlyRoot`: an unbuilt workspace, no `.xspec`, its root
//   read-only (T14-9's discipline at `.xspec`) — a write failure at the area
//   directory's creation.
// - `stageUnlistableArea`: `.xspec` unlistable but searchable and writable
//   (`-wx`), holding no `lock` (T13.5-10(h)): its listing refused, a
//   creation and removal in it kept — no refusal a conforming acquisition
//   meets, which examines the lock path by name, creates the lock directory
//   and its entry, and lists the lock directory alone (SPEC 13.5).
//
// Every staging's `restore()` reinstates the modes it changed (idempotent),
// before the harness snapshots the workspace or reads the lock path. The two
// subdirectory stagings' restore finds the leftover wherever the lock
// directory then holds it: a removal may first rename the leftover within
// the lock directory, which Linux permits without permission on the leftover
// itself (T13.5-10(d)), so every directory there gets its listable mode
// back. `assertLeftoverDirectoryStands` is those arms' residue check: the lock
// directory holding exactly one occupant, a directory holding exactly the
// staged file, its name unasserted, and no entry.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fail } from "./assertions.js";
import { LOCK_PATH } from "./lock-path.js";
import type {
  LeftoverNode,
  LeftoverState,
  StagedLeftover,
  StagingWorkspace,
} from "./lock-staging.js";
import {
  AREA_PATH,
  DIRECTORY_MODE,
  describeTreeDifferences,
  readLockPathTree,
  renderLines,
  renderRel,
  stageLeftover,
} from "./lock-staging.js";
import type { PermissionStaging } from "./permissions.js";
import { stageDirectoryMode, stageWriteRefusal } from "./permissions.js";

/** What each plain file these stagings place holds. */
export const ACQUISITION_LEFTOVER_BYTES = "A leftover the harness staged.\n";

/** The subdirectory the leftover stagings place in the lock directory. */
export const LEFTOVER_DIRECTORY_NAME = "leftover-directory";

/** The plain file that subdirectory holds. */
export const LEFTOVER_FILE_NAME = "file";

/** `-wx`: unlistable, searchable and writable. */
const UNLISTABLE_MODE = 0o300;
/** `r-x`: listable and searchable, refusing writes. */
const UNWRITABLE_MODE = 0o500;
/** `rw-`: listable, unsearchable — its entries' kinds refused. */
const UNSEARCHABLE_MODE = 0o600;

/** An acquisition staging in effect: what it staged, and its undoing. */
export interface AcquisitionStaging {
  /**
   * The leftover staged at the lock path or in the lock directory, where
   * the staging stages one: its record, for the residue checks.
   */
  readonly leftover?: StagedLeftover;
  /** Reinstate every mode the staging changed; idempotent. */
  restore(): Promise<void>;
}

/** The subdirectory holding a plain file, as the leftover stagings stage it. */
const LEFTOVER_DIRECTORY: LeftoverNode = {
  kind: "dir",
  entries: [
    {
      name: LEFTOVER_FILE_NAME,
      node: { kind: "file", content: ACQUISITION_LEFTOVER_BYTES },
    },
  ],
};

function lockAbs(root: string): string {
  return path.join(root, LOCK_PATH);
}

function areaAbs(root: string): string {
  return path.join(root, AREA_PATH);
}

/** A staging's precondition: nothing at `abs` (a misuse otherwise). */
async function requireNothingAt(
  abs: string,
  what: string,
  caller: string,
): Promise<void> {
  try {
    await fsp.lstat(abs);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`${caller}: ${what} must hold nothing at ${abs}`);
}

/** Restore a directory-mode staging, then every directory in the lock directory. */
function leftoverRestore(
  root: string,
  permissions: PermissionStaging,
): () => Promise<void> {
  return async () => {
    await permissions.restore();
    await restoreLockDirectoryListings(root);
  };
}

/**
 * Every directory the lock directory holds given its listable mode back
 * (`DIRECTORY_MODE`), whatever its name: a removal may first rename the
 * leftover within the lock directory (TEST-SPEC T13.5-10(d)). Nothing to do
 * where no lock directory stands.
 */
async function restoreLockDirectoryListings(root: string): Promise<void> {
  const lock = Buffer.from(lockAbs(root));
  let names: Buffer[];
  try {
    names = await fsp.readdir(lock, { encoding: "buffer" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return;
    throw error;
  }
  for (const name of names) {
    const abs = Buffer.concat([lock, Buffer.from("/"), name]);
    let isDirectory = false;
    try {
      isDirectory = (await fsp.lstat(abs)).isDirectory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (isDirectory) await fsp.chmod(abs, DIRECTORY_MODE);
  }
}

/**
 * An empty leftover lock directory unlistable but writable (`-wx`): the
 * harness's own listing of it refused, its own creation (and removal) of a
 * file in it kept, verified first.
 */
export async function stageUnlistableLockDirectory(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  const leftover = await stageLeftover(workspace, LOCK_PATH, { kind: "dir" });
  const permissions = await stageDirectoryMode(
    lockAbs(workspace.root),
    UNLISTABLE_MODE,
    [
      { attempt: "list", refused: true },
      { attempt: "create", refused: false },
    ],
  );
  return { leftover, restore: () => permissions.restore() };
}

/**
 * An empty leftover lock directory refusing writes (`r-x`): the harness's
 * own creation of a file (and a directory) in it refused, its listing kept,
 * verified first.
 */
export async function stageUnwritableLockDirectory(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  const leftover = await stageLeftover(workspace, LOCK_PATH, { kind: "dir" });
  const permissions = await stageDirectoryMode(
    lockAbs(workspace.root),
    UNWRITABLE_MODE,
    [
      { attempt: "create", refused: true },
      { attempt: "list", refused: false },
    ],
  );
  return { leftover, restore: () => permissions.restore() };
}

/**
 * A lock directory holding a subdirectory that holds a file, the
 * subdirectory unlistable (`-wx`): the harness's own listing of it refused,
 * its file reachable by name, verified first. The lock directory itself
 * stays listable, searchable, and writable.
 */
export async function stageUnlistableLeftoverDirectory(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  const at = `${LOCK_PATH}/${LEFTOVER_DIRECTORY_NAME}`;
  const leftover = await stageLeftover(workspace, at, LEFTOVER_DIRECTORY);
  const permissions = await stageDirectoryMode(
    path.join(workspace.root, at),
    UNLISTABLE_MODE,
    [
      { attempt: "list", refused: true },
      { attempt: "examine", name: LEFTOVER_FILE_NAME, refused: false },
    ],
  );
  return { leftover, restore: leftoverRestore(workspace.root, permissions) };
}

/**
 * A lock directory holding a subdirectory that holds a file, the
 * subdirectory refusing writes (`r-x`): the harness's own removal of its
 * file (and replacement of it, and a creation beside it) refused, its
 * listing and its file's examination kept, verified first — so a leftover's
 * removal is refused. The lock directory itself stays writable.
 */
export async function stageUnwritableLeftoverDirectory(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  const at = `${LOCK_PATH}/${LEFTOVER_DIRECTORY_NAME}`;
  const leftover = await stageLeftover(workspace, at, LEFTOVER_DIRECTORY);
  const permissions = await stageDirectoryMode(
    path.join(workspace.root, at),
    UNWRITABLE_MODE,
    [
      { attempt: "remove", name: LEFTOVER_FILE_NAME },
      { attempt: "create", refused: true },
      { attempt: "list", refused: false },
      { attempt: "examine", name: LEFTOVER_FILE_NAME, refused: false },
    ],
  );
  return { leftover, restore: leftoverRestore(workspace.root, permissions) };
}

/**
 * `.xspec` read-only, holding no `lock` — T14-9's discipline at the lock
 * path, verified first: a creation in `.xspec`, and a sibling renamed over
 * `.xspec/lock`, each refused.
 */
export async function stageReadOnlyArea(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  const target = lockAbs(workspace.root);
  await requireNothingAt(target, "the lock path", "stageReadOnlyArea");
  const permissions = await stageWriteRefusal(target);
  return { restore: () => permissions.restore() };
}

/**
 * A plain file at `.xspec/lock` — a leftover acquisition removes (SPEC
 * 13.5) — with `.xspec` read-only and the file unwritable: T14-9's full
 * discipline, verified first (a creation in `.xspec`, the file's write-open
 * and appending, a sibling renamed over it, and its removal, each refused).
 */
export async function stageUnremovableLockFile(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  const leftover = await stageLeftover(workspace, LOCK_PATH, {
    kind: "file",
    content: ACQUISITION_LEFTOVER_BYTES,
  });
  const permissions = await stageWriteRefusal(lockAbs(workspace.root));
  return { leftover, restore: () => permissions.restore() };
}

/** What an unsearchable `.xspec` holds at the lock path. */
export type UnsearchableAreaHolding = "nothing" | "an empty lock directory";

/**
 * `.xspec` unsearchable (`rw-`), holding nothing at the lock path or,
 * separately, an empty lock directory: the harness's own examination of
 * `.xspec/lock` and its own creation of a file in `.xspec` each refused, its
 * listing kept, verified first.
 */
export async function stageUnsearchableArea(
  workspace: StagingWorkspace,
  holding: UnsearchableAreaHolding,
): Promise<AcquisitionStaging> {
  let leftover: StagedLeftover | undefined;
  if (holding === "an empty lock directory") {
    leftover = await stageLeftover(workspace, LOCK_PATH, { kind: "dir" });
  } else {
    await requireNothingAt(
      lockAbs(workspace.root),
      "the lock path",
      "stageUnsearchableArea",
    );
  }
  const permissions = await stageDirectoryMode(
    areaAbs(workspace.root),
    UNSEARCHABLE_MODE,
    [
      { attempt: "examine", name: "lock", refused: true },
      { attempt: "create", refused: true },
      { attempt: "list", refused: false },
    ],
  );
  return {
    ...(leftover === undefined ? {} : { leftover }),
    restore: () => permissions.restore(),
  };
}

/**
 * A lock directory unsearchable (`rw-`) holding a directory that holds a
 * file: the harness's own examination of that directory's kind, and its own
 * creation of a file in the lock directory, each refused, its listing kept,
 * verified first.
 */
export async function stageUnsearchableLockDirectory(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  const leftover = await stageLeftover(workspace, LOCK_PATH, {
    kind: "dir",
    entries: [{ name: LEFTOVER_DIRECTORY_NAME, node: LEFTOVER_DIRECTORY }],
  });
  const permissions = await stageDirectoryMode(
    lockAbs(workspace.root),
    UNSEARCHABLE_MODE,
    [
      { attempt: "examine", name: LEFTOVER_DIRECTORY_NAME, refused: true },
      { attempt: "create", refused: true },
      { attempt: "list", refused: false },
    ],
  );
  return { leftover, restore: () => permissions.restore() };
}

/**
 * An unbuilt workspace — no `.xspec` — its root read-only: T14-9's
 * discipline at `.xspec`, verified first (a creation in the root, and a
 * sibling renamed over `.xspec`, each refused).
 */
export async function stageReadOnlyRoot(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  const target = areaAbs(workspace.root);
  await requireNothingAt(
    target,
    "an unbuilt workspace's area",
    "stageReadOnlyRoot",
  );
  const permissions = await stageWriteRefusal(target);
  return { restore: () => permissions.restore() };
}

/**
 * `.xspec` unlistable but searchable and writable (`-wx`, T14-10's
 * discipline), holding nothing at the lock path (TEST-SPEC T13.5-10(h)): the
 * harness's own listing of it refused, and its own creation and removal of
 * a file in it kept, verified first.
 */
export async function stageUnlistableArea(
  workspace: StagingWorkspace,
): Promise<AcquisitionStaging> {
  await requireNothingAt(
    lockAbs(workspace.root),
    "the lock path",
    "stageUnlistableArea",
  );
  const permissions = await stageDirectoryMode(
    areaAbs(workspace.root),
    UNLISTABLE_MODE,
    [
      { attempt: "list", refused: true },
      { attempt: "create", refused: false },
    ],
  );
  return { restore: () => permissions.restore() };
}

function describeOccupant(key: string, state: LeftoverState): string {
  switch (state.kind) {
    case "file":
      return `${renderRel(key)}: a plain file — an entry, or what a leftover held`;
    case "dir":
      return `${renderRel(key)}: a directory`;
    case "symlink":
      return `${renderRel(key)}: a symbolic link`;
    case "fifo":
      return `${renderRel(key)}: a FIFO`;
    case "other":
      return `${renderRel(key)}: another kind`;
  }
}

/**
 * The residue of a subdirectory staging's run (TEST-SPEC T13.5-10(d)): the
 * lock directory holding exactly one occupant, a directory holding exactly
 * what the staged leftover held — its file, name and content, byte-identical
 * (modes aside) — and nothing else, so no entry; that directory's name
 * unasserted (the lock directory stays writable, so a removal may first
 * rename the leftover within it, and 14.24 keeps every write already made).
 * The staging's modes are restored first, so the lock path reads. Fails
 * diagnosed.
 */
export async function assertLeftoverDirectoryStands(
  root: string,
  leftover: StagedLeftover,
  context: string,
): Promise<void> {
  const tree = await readLockPathTree(root);
  const expectation =
    `${LOCK_PATH} must be a directory holding exactly one occupant — a ` +
    `directory, under whatever name, holding exactly what the staged ` +
    `leftover ${renderRel(leftover.at)} held, byte-identical — and nothing ` +
    `else, so no entry (SPEC 13.5: release deletes the run's entry, the ` +
    `lock directory still holding something; 14.24 keeps every write ` +
    `already made, a removal's renaming of the leftover within the lock ` +
    `directory among them)`;
  const lock = tree.get(LOCK_PATH);
  if (lock === undefined) {
    fail(`${context}: ${expectation}; found nothing at ${LOCK_PATH}`);
  }
  if (lock.kind !== "dir") {
    fail(`${context}: ${expectation}; found ${lock.kind} at ${LOCK_PATH}`);
  }
  const prefix = `${LOCK_PATH}/`;
  const occupants = [...tree.keys()]
    .filter(
      (key) =>
        key.startsWith(prefix) && !key.slice(prefix.length).includes("/"),
    )
    .sort();
  const [found] = occupants;
  if (
    found === undefined ||
    occupants.length !== 1 ||
    tree.get(found)?.kind !== "dir"
  ) {
    fail(
      `${context}: ${expectation}; found ` +
        (occupants.length === 0
          ? "it empty"
          : `its occupants:\n${renderLines(
              occupants.map((key) => describeOccupant(key, tree.get(key)!)),
            )}`),
    );
  }
  const staged = leftover.at.toString("latin1");
  const expected = new Map<string, LeftoverState>([
    [LOCK_PATH, { kind: "dir", mode: DIRECTORY_MODE }],
  ]);
  for (const [key, state] of leftover.tree) {
    if (key === staged || key.startsWith(`${staged}/`)) {
      expected.set(`${found}${key.slice(staged.length)}`, state);
    }
  }
  const lines = describeTreeDifferences(expected, tree);
  if (lines.length > 0) {
    fail(
      `${context}: ${expectation}; its one occupant ${renderRel(found)} ` +
        `differs from the staged leftover:\n${renderLines(lines)}`,
    );
  }
}
