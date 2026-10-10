// Lock-path leftovers and obstructions, and dead runs' entries, as shared
// machinery (TEST-SPEC T13.5-10(a)-(c), (e), T13.4-12, T11.6-3, T6.6-3(c),
// P-15, T13.5-3, H-4, E-1; CERTIFICATIONS.md CONF-LEFTOVER's staging
// constraints and justification, and the Exclusions entry for T13.5-9
// through T13.5-12 and T13.4-12: T13.5-10(b)'s link staging rides
// VIOL-LEFTOVER-FOLLOWLINK's certification of P-15 insofar as it shares this
// machinery; SPEC 13.4, 13.5). Harness machinery only: no product imports,
// no test framework dependence.
//
// - Staging. `stageLeftover(workspace, at, node)` builds a declared node at
//   `at`: the area's own path `.xspec` (an obstruction: a plain file, a
//   symbolic link, or a FIFO; T13.5-10(a), T11.6-3), the lock path
//   `.xspec/lock` itself (a plain file or an obstruction at it, or a lock
//   directory holding a declared tree), or one occupant of the lock
//   directory, `.xspec/lock/<name>`, beside whatever it already holds
//   (T13.5-10(c), (e)) — creating `.xspec` and the lock directory where
//   absent, and never replacing an occupant. A node is a directory holding
//   declared entries at any depth, a plain file with exact content and mode
//   (every permission removed included), a symbolic link — to a directory
//   outside the workspace holding a plain file, to a plain file outside it,
//   or dangling, its target absent from a writable directory outside it — or
//   a FIFO (made by `mkfifo`: Node has no API for it). Names are exact
//   bytes — a string is its UTF-8 — so names beginning with `.` and names
//   that are not valid UTF-8 (the Linux leg) are staged as such and never
//   decoded (CONF-LEFTOVER's justification: S-2 round-trips file content,
//   not file names, and tooling handling names as text stages a
//   replacement-character spelling, leaving the class unreached). Each link
//   target lies in a directory of its own beside the workspace root, in the
//   workspace's temporary directory, so it is disposed with the workspace.
// - Cautions the staging enforces, as usage errors. No plain file of the
//   harness's own naming at the lock directory's top level (T13.5-10(b),
//   (c); P-15): the entry form is the product's own (13.5), so such a file
//   may read as an entry whose recorded identifier lies in 13.5's gap, which
//   MAY refuse — a dead run's entry is carried in by `copyEntryIn`, its name
//   and content the product's. And each link to a directory targets a
//   directory holding at least one plain file, every directory staged here
//   listable, searchable, and writable (CONF-LEFTOVER's staging constraint:
//   an empty target leaves a removal that follows the link nothing to
//   delete).
// - Self-verification (E-1, H-11). Before returning, a staging verifies on
//   the harness itself that it took effect as declared: the staged tree and
//   every outside directory, read back without following a link or opening a
//   FIFO, hold exactly the declared names (byte for byte), kinds, contents,
//   link targets, and modes; and each plain file whose declared mode
//   withholds the owner's read refuses the harness's own read — a permission
//   removal, verified as T14-10's stagings are (T13.5-10(b): acquisition
//   reads no file's content). An ineffective staging — a privileged runner,
//   a filesystem that rewrites names — is `HarnessStagingError` (mode
//   `lock-path-leftover`): a harness error, never a diagnosed product
//   failure, a pass, or a skip.
// - The record. A staging returns what it staged: the byte state of the
//   staged path and everything under it (kinds, names, contents — read under
//   H-4's grant at and under the lock path — link targets, and modes) and of
//   each outside directory its links reach. The checks compare against it,
//   each failure a diagnosed `HarnessAssertionError` rendering byte names
//   readably: `assertStagingInPlace` (the staged path holds exactly what was
//   staged — kind, name, content, and a link's target alike, nothing added
//   under it, nothing removed; modes aside, H-4's byte state: T13.4-12,
//   T13.5-10(a), (c), T6.6-3(c)), `assertOutsideTargetsUntouched` (every
//   link's target byte-identical, nothing written through a link: 13.4;
//   T13.5-10(a), (b), P-15), and `assertFifosIntact` (each staged FIFO still
//   a FIFO in place). Nothing here ever opens a staged FIFO: whether a
//   product opens one is observed by its promptness (a reader opening a FIFO
//   with no writer blocks; T13.5-10, P-15).
// - Dead runs' entries (T13.5-3; T13.5-10(b), (c), T13.4-12, T11.6-3,
//   T13.5-11(d)). `killHeldRun` starts a mutating command — a held `rename`
//   succeeding there — under `--test-hold` in a process group of its own,
//   awaits its hold file, kills it under T13.5-3's exit-collection
//   discipline (`RunningProduct.killGroup`, helpers/kill-discipline.ts), and
//   returns the lock directory's one entry, a plain file — its name bytes,
//   content (read under H-4's grant), and mode — with the killed group, whose
//   identifiers T13.5-3's reuse check looks for. Anything else at
//   `.xspec/lock` after the kill — nothing, no directory, no entry or
//   several, an entry that is no plain file — fails, diagnosed (13.5:
//   abnormal termination leaves its entry). `copyEntryIn` carries such an
//   entry into another workspace's lock directory, name, content, and mode:
//   13.5's entry created for another workspace, as a copy of the workspace
//   carries it in.
// - Platform: the Linux leg's (FIFOs, names that are not valid UTF-8,
//   permission removals, the process list). On any other platform every
//   staging throws `HarnessStagingError` at once.

import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import type { Stats } from "node:fs";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { describeByteDifference, fail } from "./assertions.js";
import { isLockPathBytes, LOCK_PATH, withOwnerGrant } from "./lock-path.js";
import { HarnessStagingError } from "./permissions.js";
import type { StagingMode } from "./permissions.js";
import type { ArgvValue, KilledGroup, ProductBinding } from "./subprocess.js";
import {
  pathExists,
  releaseHoldFile,
  rethrowHarnessError,
  startProduct,
  summarizeResult,
} from "./subprocess.js";

const execFileAsync = promisify(execFile);

/** The graph-data area's own path, workspace-relative (SPEC 13.3, 13.4). */
export const AREA_PATH = ".xspec";

const STAGING: StagingMode = "lock-path-leftover";
const SLASH = 0x2f;
const NUL = 0x00;
const DOT = 0x2e;
const AREA_BYTES = Buffer.from(AREA_PATH, "latin1");
const LOCK_BYTES = Buffer.from(LOCK_PATH, "latin1");
const LOCK_PREFIX = Buffer.from(`${LOCK_PATH}/`, "latin1");
const EMPTY = Buffer.alloc(0);

/** A staged plain file's mode unless declared. */
export const DEFAULT_FILE_MODE = 0o644;
/** Every directory staged here: listable, searchable, and writable. */
export const DIRECTORY_MODE = 0o755;
/** A staged FIFO's mode unless declared. */
export const DEFAULT_FIFO_MODE = 0o644;
const OWNER_READ = 0o400;

// A plain file is read without following a link and without blocking: a
// FIFO met where a plain file stood is refused by the open's own check below,
// never waited on.
const NO_FOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const NON_BLOCK = fs.constants.O_NONBLOCK ?? 0;
const READ_PLAIN = fs.constants.O_RDONLY | NO_FOLLOW | NON_BLOCK;

/** A name in a staged tree: a string (staged as its UTF-8 bytes) or exact bytes. */
export type LeftoverName = string | Uint8Array;

/** One named entry of a staged directory. */
export interface LeftoverChild {
  readonly name: LeftoverName;
  readonly node: LeftoverNode;
}

/** What a staging puts at a path. */
export type LeftoverNode =
  | {
      readonly kind: "file";
      /** Exact content (a string is its UTF-8); default empty. */
      readonly content?: string | Uint8Array;
      /**
       * Permission bits (default 0o644). A mode withholding the owner's read
       * is a permission removal, verified refused on the harness itself.
       */
      readonly mode?: number;
    }
  | {
      readonly kind: "dir";
      /** Its entries, at any depth; names unique within it. */
      readonly entries?: readonly LeftoverChild[];
    }
  | { readonly kind: "symlink"; readonly target: OutsideTarget }
  | { readonly kind: "fifo"; readonly mode?: number };

/** A symbolic link's target, outside the workspace, in a directory of its own. */
export type OutsideTarget =
  | {
      readonly kind: "dir";
      /**
       * What the target directory holds — at least one plain file somewhere
       * in it (CONF-LEFTOVER's staging constraint); default one plain file.
       */
      readonly entries?: readonly OutsideChild[];
    }
  | { readonly kind: "file"; readonly content?: string | Uint8Array }
  /** Its target absent from a writable directory outside the workspace. */
  | { readonly kind: "dangling" };

/** One named entry of an outside target directory. */
export interface OutsideChild {
  readonly name: LeftoverName;
  readonly node: OutsideNode;
}

/** What an outside target directory holds: plain files and directories. */
export type OutsideNode =
  | { readonly kind: "file"; readonly content?: string | Uint8Array }
  | { readonly kind: "dir"; readonly entries?: readonly OutsideChild[] };

/**
 * What occupies one path, as read back: never following a link, never
 * opening a FIFO, a plain file's content read whole (at and under the lock
 * path, under H-4's grant).
 */
export type LeftoverState =
  | { readonly kind: "file"; readonly bytes: Buffer; readonly mode: number }
  | { readonly kind: "dir"; readonly mode: number }
  | { readonly kind: "symlink"; readonly target: Buffer }
  | { readonly kind: "fifo"; readonly mode: number }
  | { readonly kind: "other"; readonly mode: number };

/**
 * A tree's state: each path's exact relative bytes, held latin1-encoded (as
 * a snapshot key, helpers/snapshot.ts), to what occupies it.
 */
export type LeftoverTree = ReadonlyMap<string, LeftoverState>;

/** An outside directory a staged link reaches, as staged. */
export interface OutsideRecord {
  /** The link's workspace-relative key. */
  readonly link: string;
  /** The link's target exactly as stored: an absolute path. */
  readonly target: Buffer;
  /** The directory holding the target (outside the workspace), absolute. */
  readonly dir: string;
  /** That directory's state: keys relative to it, `""` the directory itself. */
  readonly tree: LeftoverTree;
}

/** What a staging staged: the record its checks compare against. */
export interface StagedLeftover {
  /** The workspace root the staging lies in. */
  readonly root: string;
  /** The staged path, workspace-relative bytes. */
  readonly at: Buffer;
  /** The staged path and everything under it: workspace-relative keys. */
  readonly tree: LeftoverTree;
  /** Each staged link's outside directory. */
  readonly outside: readonly OutsideRecord[];
  /** The key of every FIFO staged. */
  readonly fifos: readonly string[];
  /** `.xspec` and the lock directory, where the staging created them. */
  readonly createdParents: readonly string[];
}

/**
 * Where a staging lies: the workspace root and, beside it, a temporary
 * directory outside it (a `TestWorkspace`'s `tempRoot`) holding every link
 * target's directory and the FIFOs' scratch.
 */
export interface StagingWorkspace {
  readonly root: string;
  readonly tempRoot: string;
}

/**
 * A lock directory's entry as read back: a plain file whose name and
 * content are the product's own, opaque (13.4, H-4).
 */
export interface LockEntry {
  /** The entry's name, exactly as the filesystem lists it. */
  readonly name: Buffer;
  /** Its exact content. */
  readonly content: Buffer;
  /** Its permission bits, as the product left them. */
  readonly mode: number;
}

/** A held run killed under T13.5-3's discipline, and the entry it left. */
export interface DeadRun {
  /** The lock directory's one entry after the kill: the dead run's. */
  readonly entry: LockEntry;
  /** The killed group: its identifiers serve T13.5-3's reuse check. */
  readonly killed: KilledGroup;
}

/** The held mutating command `killHeldRun` starts and kills. */
export interface HeldRunOptions {
  /** The workspace root: the run's working directory (H-1). */
  readonly root: string;
  /**
   * The mutating command — an operation succeeding there, a `rename` where
   * TEST-SPEC says a held `rename` — without `--test-hold`.
   */
  readonly argv: readonly ArgvValue[];
  /** The hold path: absolute, outside the workspace, nothing there yet. */
  readonly holdPath: string;
  /** Names the run in every diagnosis. */
  readonly context: string;
}

// ---------------------------------------------------------------------------
// Staging

/** Where a staging lies, resolved from its `at`. */
type Place = "area" | "lock" | "occupant";

/** What a staging gathers while it builds, checked once it is read back. */
interface Building {
  readonly workspace: StagingWorkspace;
  readonly expected: Map<string, LeftoverState>;
  readonly outside: PendingOutside[];
  readonly fifos: string[];
  /** Plain files whose declared mode withholds the owner's read. */
  readonly removals: Buffer[];
}

interface PendingOutside {
  readonly link: string;
  readonly target: Buffer;
  readonly dir: string;
  readonly expected: Map<string, LeftoverState>;
}

/**
 * Stage `node` at `at` in the workspace: `.xspec` (an obstruction — a plain
 * file, a symbolic link, or a FIFO), `.xspec/lock` itself, or
 * `.xspec/lock/<name>`, one occupant of the lock directory beside whatever
 * it holds. `.xspec` and the lock directory are created where absent; an
 * occupant at `at` is never replaced (a usage error), nor is a
 * non-directory at a parent. Verified before it returns (module header):
 * exactly as declared, each permission removal refused to the harness
 * itself — else `HarnessStagingError`. Returns the record the checks use.
 */
export async function stageLeftover(
  workspace: StagingWorkspace,
  at: LeftoverName,
  node: LeftoverNode,
): Promise<StagedLeftover> {
  const atBytes = toBytes(at);
  const place = placeOf(atBytes);
  requireLinux(renderRel(atBytes));
  refuseHarnessNamedEntries(place, node, atBytes);
  return await stage(workspace, atBytes, place, node, true);
}

/**
 * Carry a lock directory's entry — a dead run's (`killHeldRun`), or a
 * synthetic one a self-test declares — into the workspace's lock directory
 * under its own name: a plain file of its exact content and mode, beside
 * whatever the lock directory holds (created, with `.xspec`, where absent),
 * never replacing an occupant. 13.5's entry created for another workspace,
 * as a copy of the workspace carries it in (T13.5-10(c)); its mode is the
 * product's own, so no permission removal is verified (H-4).
 */
export async function copyEntryIn(
  workspace: StagingWorkspace,
  entry: LockEntry,
): Promise<StagedLeftover> {
  const name = nameBytes(entry.name);
  const atBytes = Buffer.concat([LOCK_PREFIX, name]);
  requireLinux(renderRel(atBytes));
  return await stage(
    workspace,
    atBytes,
    placeOf(atBytes),
    { kind: "file", content: entry.content, mode: entry.mode },
    false,
  );
}

async function stage(
  workspace: StagingWorkspace,
  atBytes: Buffer,
  place: Place,
  node: LeftoverNode,
  verifyRemovals: boolean,
): Promise<StagedLeftover> {
  const shown = renderRel(atBytes);
  if (place === "area" && node.kind === "dir") {
    throw new Error(
      `stageLeftover: ${shown} takes an obstruction — a plain file, a ` +
        `symbolic link, or a FIFO — never a directory (the area itself)`,
    );
  }
  // The whole declaration is judged before anything is made, so a refused
  // staging stages nothing.
  validateNode(node, atBytes);
  if (isInside(workspace.root, path.join(workspace.tempRoot, "outside-"))) {
    throw new Error(
      `stageLeftover: ${workspace.tempRoot} lies inside the workspace ` +
        `${workspace.root}; link targets and FIFO scratch must lie outside ` +
        `it (a TestWorkspace's tempRoot, beside the root)`,
    );
  }
  const rootBytes = Buffer.from(workspace.root);
  const createdParents = await ensureParents(rootBytes, place);
  const abs = joinBytes(rootBytes, atBytes);
  if (await pathExists(abs)) {
    throw new Error(
      `stageLeftover: ${shown} is occupied in ${workspace.root}; a staging ` +
        `never replaces an occupant (clear it first)`,
    );
  }
  const building: Building = {
    workspace,
    expected: new Map(),
    outside: [],
    fifos: [],
    removals: [],
  };
  await build(building, abs, atBytes, node);

  // Read back: the staging took effect exactly as declared (E-1).
  const tree = await captureTree(rootBytes, atBytes, true);
  const mismatch = diffTrees(building.expected, tree, true, renderRel);
  if (mismatch.length > 0) {
    throw new HarnessStagingError(
      STAGING,
      shown,
      `the staged tree does not read back as declared — the staging is ` +
        `ineffective here (names, kinds, contents, link targets, modes):\n` +
        mismatch.map((line) => `  - ${line}`).join("\n"),
    );
  }
  const outside: OutsideRecord[] = [];
  for (const pending of building.outside) {
    const outsideTree = await captureTree(
      Buffer.from(pending.dir),
      EMPTY,
      false,
    );
    const outsideMismatch = diffTrees(
      pending.expected,
      outsideTree,
      true,
      outsideRenderer(pending.dir),
    );
    if (outsideMismatch.length > 0) {
      throw new HarnessStagingError(
        STAGING,
        shown,
        `the outside target of ${renderRel(Buffer.from(pending.link, "latin1"))} ` +
          `does not read back as declared:\n` +
          outsideMismatch.map((line) => `  - ${line}`).join("\n"),
      );
    }
    outside.push({
      link: pending.link,
      target: pending.target,
      dir: pending.dir,
      tree: outsideTree,
    });
  }
  if (verifyRemovals) {
    for (const removal of building.removals) {
      await verifyContentReadRefused(removal);
    }
  }
  return {
    root: workspace.root,
    at: atBytes,
    tree,
    outside,
    fifos: building.fifos,
    createdParents,
  };
}

async function build(
  building: Building,
  abs: Buffer,
  rel: Buffer,
  node: LeftoverNode,
): Promise<void> {
  const key = rel.toString("latin1");
  switch (node.kind) {
    case "file": {
      const content = contentBytes(node.content);
      const mode = checkedMode(node.mode ?? DEFAULT_FILE_MODE, rel);
      await fsp.writeFile(abs, content, { flag: "wx", mode: 0o600 });
      await fsp.chmod(abs, mode);
      building.expected.set(key, { kind: "file", bytes: content, mode });
      if ((mode & OWNER_READ) === 0) building.removals.push(abs);
      return;
    }
    case "dir": {
      const entries = node.entries ?? [];
      await fsp.mkdir(abs, { mode: 0o700 });
      building.expected.set(key, { kind: "dir", mode: DIRECTORY_MODE });
      for (const child of entries) {
        const name = nameBytes(child.name);
        await build(
          building,
          joinBytes(abs, name),
          joinBytes(rel, name),
          child.node,
        );
      }
      await fsp.chmod(abs, DIRECTORY_MODE);
      return;
    }
    case "symlink": {
      const pending = await stageOutside(building.workspace, node.target, key);
      await fsp.symlink(pending.target, abs);
      building.expected.set(key, { kind: "symlink", target: pending.target });
      building.outside.push(pending);
      return;
    }
    case "fifo": {
      const mode = checkedMode(node.mode ?? DEFAULT_FIFO_MODE, rel);
      await makeFifo(building.workspace, abs, mode);
      building.expected.set(key, { kind: "fifo", mode });
      building.fifos.push(key);
      return;
    }
  }
}

/**
 * A link target in a fresh directory of its own beside the workspace root:
 * a directory holding the declared entries, a plain file, or — dangling —
 * nothing at the target, the directory itself writable.
 */
async function stageOutside(
  workspace: StagingWorkspace,
  target: OutsideTarget,
  link: string,
): Promise<PendingOutside> {
  const dir = await fsp.mkdtemp(path.join(workspace.tempRoot, "outside-"));
  await fsp.chmod(dir, DIRECTORY_MODE);
  const expected = new Map<string, LeftoverState>([
    ["", { kind: "dir", mode: DIRECTORY_MODE }],
  ]);
  const dirBytes = Buffer.from(dir);
  switch (target.kind) {
    case "dir": {
      const entries = target.entries ?? DEFAULT_OUTSIDE_ENTRIES;
      const name = Buffer.from("target", "latin1");
      await buildOutside(dirBytes, name, { kind: "dir", entries }, expected);
      return { link, target: joinBytes(dirBytes, name), dir, expected };
    }
    case "file": {
      const name = Buffer.from("target", "latin1");
      await buildOutside(
        dirBytes,
        name,
        { kind: "file", content: target.content ?? DEFAULT_OUTSIDE_CONTENT },
        expected,
      );
      return { link, target: joinBytes(dirBytes, name), dir, expected };
    }
    case "dangling":
      return {
        link,
        target: joinBytes(dirBytes, Buffer.from("absent", "latin1")),
        dir,
        expected,
      };
  }
}

const DEFAULT_OUTSIDE_CONTENT = "Held outside the workspace.\n";
const DEFAULT_OUTSIDE_ENTRIES: readonly OutsideChild[] = [
  {
    name: "held.txt",
    node: { kind: "file", content: DEFAULT_OUTSIDE_CONTENT },
  },
];

async function buildOutside(
  base: Buffer,
  rel: Buffer,
  node: OutsideNode,
  expected: Map<string, LeftoverState>,
): Promise<void> {
  const abs = joinBytes(base, rel);
  const key = rel.toString("latin1");
  if (node.kind === "file") {
    const content = contentBytes(node.content);
    await fsp.writeFile(abs, content, { flag: "wx", mode: 0o600 });
    await fsp.chmod(abs, DEFAULT_FILE_MODE);
    expected.set(key, {
      kind: "file",
      bytes: content,
      mode: DEFAULT_FILE_MODE,
    });
    return;
  }
  const entries = node.entries ?? [];
  await fsp.mkdir(abs, { mode: 0o700 });
  expected.set(key, { kind: "dir", mode: DIRECTORY_MODE });
  for (const child of entries) {
    await buildOutside(
      base,
      joinBytes(rel, nameBytes(child.name)),
      child.node,
      expected,
    );
  }
  await fsp.chmod(abs, DIRECTORY_MODE);
}

function holdsPlainFile(entries: readonly OutsideChild[]): boolean {
  return entries.some(
    (child) =>
      child.node.kind === "file" || holdsPlainFile(child.node.entries ?? []),
  );
}

/**
 * Judge a whole declaration before anything is made: every name a name,
 * unique within its directory; every mode a set of permission bits; every
 * link to a directory reaching a plain file. A usage error otherwise.
 */
function validateNode(node: LeftoverNode, rel: Buffer): void {
  switch (node.kind) {
    case "file":
    case "fifo":
      if (node.mode !== undefined) checkedMode(node.mode, rel);
      return;
    case "dir": {
      const entries = node.entries ?? [];
      refuseDuplicateNames(entries, rel);
      for (const child of entries) {
        validateNode(child.node, joinBytes(rel, nameBytes(child.name)));
      }
      return;
    }
    case "symlink":
      validateOutside(node.target, rel);
      return;
  }
}

function validateOutside(target: OutsideTarget, rel: Buffer): void {
  if (target.kind !== "dir") return;
  const entries = target.entries ?? DEFAULT_OUTSIDE_ENTRIES;
  if (!holdsPlainFile(entries)) {
    throw new Error(
      `stageLeftover: the directory the link ${renderRel(rel)} targets must ` +
        `hold at least one plain file (CONF-LEFTOVER's staging constraint: ` +
        `an empty target leaves a removal that follows the link nothing to ` +
        `delete)`,
    );
  }
  const visit = (children: readonly OutsideChild[], at: Buffer): void => {
    refuseDuplicateNames(children, at);
    for (const child of children) {
      const name = nameBytes(child.name);
      if (child.node.kind === "dir") {
        visit(child.node.entries ?? [], joinBytes(at, name));
      }
    }
  };
  visit(entries, rel);
}

/**
 * Make a FIFO of `mode` at `abs`: `mkfifo` in a scratch directory beside
 * the workspace root (an ASCII name, whatever `abs`'s bytes), then a hard
 * link at `abs` — which never replaces an occupant — and the scratch name
 * removed. Neither step opens the FIFO.
 */
async function makeFifo(
  workspace: StagingWorkspace,
  abs: Buffer,
  mode: number,
): Promise<void> {
  const scratch = await fsp.mkdtemp(path.join(workspace.tempRoot, "fifo-"));
  const made = path.join(scratch, "fifo");
  try {
    try {
      await execFileAsync("mkfifo", [
        "-m",
        mode.toString(8).padStart(4, "0"),
        made,
      ]);
    } catch (error) {
      throw new HarnessStagingError(
        STAGING,
        renderAbs(abs),
        `\`mkfifo\` could not make a FIFO (the Linux leg's coreutils): ` +
          `${(error as Error).message}`,
      );
    }
    await fsp.link(made, abs);
  } finally {
    await fsp.rm(scratch, { recursive: true, force: true });
  }
  await fsp.chmod(abs, mode);
}

/** Create `.xspec` and the lock directory where `place` needs them. */
async function ensureParents(
  rootBytes: Buffer,
  place: Place,
): Promise<string[]> {
  const parents: Buffer[] =
    place === "area"
      ? []
      : place === "lock"
        ? [AREA_BYTES]
        : [AREA_BYTES, LOCK_BYTES];
  const created: string[] = [];
  for (const parent of parents) {
    const abs = joinBytes(rootBytes, parent);
    const stats = await lstatOrUndefined(abs);
    if (stats === undefined) {
      await fsp.mkdir(abs, { mode: 0o700 });
      await fsp.chmod(abs, DIRECTORY_MODE);
      created.push(parent.toString("latin1"));
    } else if (!stats.isDirectory()) {
      throw new Error(
        `stageLeftover: ${renderRel(parent)} is ${kindName(stats)}, not a ` +
          `directory, so nothing can be staged under it`,
      );
    }
  }
  return created;
}

/**
 * T13.5-10(b)'s caution and P-15's rule: no plain file of the harness's own
 * naming at the lock directory's top level (a dead run's entry comes in by
 * `copyEntryIn`). A plain file at the lock path itself is a leftover the
 * tests stage (T13.5-10(b), T13.4-12), never inside the lock directory.
 */
function refuseHarnessNamedEntries(
  place: Place,
  node: LeftoverNode,
  atBytes: Buffer,
): void {
  const topLevelFile =
    (place === "occupant" && node.kind === "file") ||
    (place === "lock" &&
      node.kind === "dir" &&
      (node.entries ?? []).some((child) => child.node.kind === "file"));
  if (topLevelFile) {
    throw new Error(
      `stageLeftover: ${renderRel(atBytes)} would put a plain file of the ` +
        `harness's own naming at the lock directory's top level — the entry ` +
        `form is the product's own (SPEC 13.5), so such a file may read as ` +
        `an entry whose recorded identifier lies in 13.5's gap, which MAY ` +
        `refuse (TEST-SPEC T13.5-10(b), P-15); stage a directory, a link, or ` +
        `a FIFO there, or carry a dead run's entry in with copyEntryIn`,
    );
  }
}

function refuseDuplicateNames(
  entries: readonly { readonly name: LeftoverName }[],
  rel: Buffer,
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = nameBytes(entry.name).toString("latin1");
    if (seen.has(key)) {
      throw new Error(
        `stageLeftover: ${renderRel(rel)} declares the name ` +
          `${renderName(nameBytes(entry.name))} twice`,
      );
    }
    seen.add(key);
  }
}

/**
 * Where `at` lies: exactly `.xspec`, exactly `.xspec/lock`, or one name
 * under the lock directory — anything else a usage error.
 */
function placeOf(atBytes: Buffer): Place {
  if (atBytes.equals(AREA_BYTES)) return "area";
  if (atBytes.equals(LOCK_BYTES)) return "lock";
  if (
    atBytes.length > LOCK_PREFIX.length &&
    atBytes.subarray(0, LOCK_PREFIX.length).equals(LOCK_PREFIX)
  ) {
    nameBytes(atBytes.subarray(LOCK_PREFIX.length));
    return "occupant";
  }
  throw new Error(
    `stageLeftover: ${renderRel(atBytes)} is neither the area's own path ` +
      `${AREA_PATH}, the lock path ${LOCK_PATH}, nor one occupant of the ` +
      `lock directory (${LOCK_PATH}/<name>)`,
  );
}

/** A path or name as bytes: a string's UTF-8, bytes copied exactly. */
function toBytes(value: LeftoverName): Buffer {
  return typeof value === "string"
    ? Buffer.from(value, "utf8")
    : Buffer.from(value);
}

/**
 * One name's exact bytes, validated: nonempty, no `/`, no NUL, never `.` or
 * `..` (a name beginning with `.` is fine, as is one that is not UTF-8).
 */
function nameBytes(name: LeftoverName): Buffer {
  const bytes = toBytes(name);
  const invalid =
    bytes.length === 0 ||
    bytes.includes(SLASH) ||
    bytes.includes(NUL) ||
    (bytes.length === 1 && bytes[0] === DOT) ||
    (bytes.length === 2 && bytes[0] === DOT && bytes[1] === DOT);
  if (invalid) {
    throw new Error(
      `stageLeftover: ${renderName(bytes)} is no name (empty, \`.\`, \`..\`, ` +
        `or holding a \`/\` or a NUL byte)`,
    );
  }
  return bytes;
}

function contentBytes(content: string | Uint8Array | undefined): Buffer {
  if (content === undefined) return Buffer.alloc(0);
  return toBytes(content);
}

function checkedMode(mode: number, rel: Buffer): number {
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o777) {
    throw new Error(
      `stageLeftover: ${renderRel(rel)}'s mode ${String(mode)} is no set of ` +
        `permission bits (0 to 0o777)`,
    );
  }
  return mode;
}

function requireLinux(shown: string): void {
  if (process.platform !== "linux") {
    throw new HarnessStagingError(
      STAGING,
      shown,
      `lock-path leftovers are the Linux leg's stagings (FIFOs, names that ` +
        `are not valid UTF-8, permission removals); this platform is ` +
        `${process.platform}`,
    );
  }
}

/**
 * E-1 verification of a permission removal on a plain file (exported for
 * the tests that remove one themselves, e.g. from an entry): the harness's
 * own read of `absPath` must be refused (`EACCES`, `EPERM`); a read that
 * succeeds — a privileged runner — or fails otherwise is an ineffective
 * staging, `HarnessStagingError`. Never follows a link, never blocks.
 */
export async function verifyContentReadRefused(
  absPath: string | Uint8Array,
): Promise<void> {
  const target = typeof absPath === "string" ? absPath : Buffer.from(absPath);
  const shown = typeof target === "string" ? target : renderAbs(target);
  let handle: fsp.FileHandle;
  try {
    handle = await fsp.open(target, READ_PLAIN);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") return;
    throw new HarnessStagingError(
      STAGING,
      shown,
      `the harness's own read failed with ${code ?? String(error)} rather ` +
        `than a permission refusal, so the permission removal is unverified`,
    );
  }
  await handle.close();
  throw new HarnessStagingError(
    STAGING,
    shown,
    `the harness's own read of a file with every read permission removed ` +
      `succeeded, so the staging is ineffective — a privileged runner (E-1 ` +
      `requires an unprivileged identity: CI runs through ` +
      `.github/scripts/run-without-network.sh; as root, run under ` +
      `\`unshare --map-user=<uid> --map-group=<gid>\`, see AGENTS.md)`,
  );
}

// ---------------------------------------------------------------------------
// Reading back

/**
 * The state of `rel` under `base` and of everything under it, read without
 * following a link or opening a FIFO: nothing at `rel` reads as an empty
 * tree. `grant` reads a plain file at or under the lock path under H-4's
 * grant (a workspace-rooted read); an outside directory's read takes none.
 * A listing the environment refuses is a harness error: a test restores its
 * own staging's permissions before inspecting it (T13.5-10(c)).
 */
async function captureTree(
  base: Buffer,
  rel: Buffer,
  grant: boolean,
): Promise<Map<string, LeftoverState>> {
  const tree = new Map<string, LeftoverState>();
  await captureInto(base, rel, grant, tree);
  return tree;
}

async function captureInto(
  base: Buffer,
  rel: Buffer,
  grant: boolean,
  tree: Map<string, LeftoverState>,
): Promise<void> {
  const abs = rel.length === 0 ? base : joinBytes(base, rel);
  const stats = await lstatOrUndefined(abs);
  if (stats === undefined) return;
  const key = rel.toString("latin1");
  const mode = stats.mode & 0o7777;
  if (stats.isSymbolicLink()) {
    tree.set(key, {
      kind: "symlink",
      target: await fsp.readlink(abs, { encoding: "buffer" }),
    });
  } else if (stats.isFile()) {
    const read = (): Promise<Buffer> => readPlainFile(abs);
    const bytes =
      grant && isLockPathBytes(rel)
        ? await withOwnerGrant(abs, "read", read)
        : await read();
    tree.set(key, { kind: "file", bytes, mode });
  } else if (stats.isFIFO()) {
    tree.set(key, { kind: "fifo", mode });
  } else if (stats.isDirectory()) {
    tree.set(key, { kind: "dir", mode });
    let names: Buffer[];
    try {
      names = await fsp.readdir(abs, { encoding: "buffer" });
    } catch (error) {
      throw new Error(
        `cannot list ${renderAbs(abs)} to read it back ` +
          `(${(error as NodeJS.ErrnoException).code ?? String(error)}): a ` +
          `test restores its own staging's permissions before inspecting it`,
        { cause: error },
      );
    }
    for (const name of names.sort(Buffer.compare)) {
      await captureInto(
        base,
        rel.length === 0 ? name : joinBytes(rel, name),
        grant,
        tree,
      );
    }
  } else {
    tree.set(key, { kind: "other", mode });
  }
}

/** A plain file's bytes: no link followed, a FIFO never waited on. */
async function readPlainFile(abs: Buffer): Promise<Buffer> {
  const handle = await fsp.open(abs, READ_PLAIN);
  try {
    if (!(await handle.stat()).isFile()) {
      throw new Error(`${renderAbs(abs)} is no longer a plain file`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

/**
 * Every difference between two trees, in bytewise key order: added and
 * removed paths, kind changes, content and link-target changes, and — where
 * `modes` — permission changes.
 */
function diffTrees(
  before: LeftoverTree,
  after: LeftoverTree,
  modes: boolean,
  render: (key: string) => string,
): string[] {
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  const lines: string[] = [];
  for (const key of keys) {
    const was = before.get(key);
    const now = after.get(key);
    if (was === undefined && now !== undefined) {
      lines.push(`added ${render(key)}: ${describeState(now)}`);
    } else if (was !== undefined && now === undefined) {
      lines.push(`removed ${render(key)}: was ${describeState(was)}`);
    } else if (was !== undefined && now !== undefined) {
      const detail = describeStateChange(was, now, modes);
      if (detail !== undefined) lines.push(`changed ${render(key)}: ${detail}`);
    }
  }
  return lines;
}

function describeState(state: LeftoverState): string {
  switch (state.kind) {
    case "file":
      return `plain file (${String(state.bytes.length)} bytes, mode ${octal(state.mode)})`;
    case "dir":
      return `directory (mode ${octal(state.mode)})`;
    case "symlink":
      return `symbolic link to ${renderAbs(state.target)}`;
    case "fifo":
      return `FIFO (mode ${octal(state.mode)})`;
    case "other":
      return "another kind (no file, directory, link, or FIFO)";
  }
}

function describeStateChange(
  was: LeftoverState,
  now: LeftoverState,
  modes: boolean,
): string | undefined {
  if (was.kind !== now.kind) {
    return `kind changed: ${describeState(was)} → ${describeState(now)}`;
  }
  if (
    was.kind === "file" &&
    now.kind === "file" &&
    !was.bytes.equals(now.bytes)
  ) {
    return `content changed: ${describeByteDifference(now.bytes, was.bytes, "now", "staged")}`;
  }
  if (
    was.kind === "symlink" &&
    now.kind === "symlink" &&
    !was.target.equals(now.target)
  ) {
    return `link target changed: ${renderAbs(was.target)} → ${renderAbs(now.target)}`;
  }
  if (modes && was.kind !== "symlink" && now.kind !== "symlink") {
    if (was.mode !== now.mode) {
      return `mode ${octal(now.mode)} where ${octal(was.mode)} was declared`;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Checks

function asList(
  staged: StagedLeftover | readonly StagedLeftover[],
): readonly StagedLeftover[] {
  return Array.isArray(staged) ? staged : [staged as StagedLeftover];
}

/**
 * Each staging's path holds exactly what was staged — kind, name, content,
 * and a link's target alike; nothing added under it, nothing removed — byte
 * state, modes aside (H-4; T13.4-12: the lock path holding after each
 * command exactly what was staged; T13.5-10(a), (c): the occupant
 * byte-identical in place). Fails diagnosed, naming every difference.
 */
export async function assertStagingInPlace(
  staged: StagedLeftover | readonly StagedLeftover[],
  context: string,
): Promise<void> {
  const lines: string[] = [];
  for (const one of asList(staged)) {
    const now = await captureTree(Buffer.from(one.root), one.at, true);
    for (const line of diffTrees(one.tree, now, false, renderRel)) {
      lines.push(line);
    }
  }
  if (lines.length === 0) return;
  fail(
    `${context}: what the harness staged at or under the lock path (or at ` +
      `the area's own path) is no longer byte-identical in place — kind, ` +
      `name, content, and a link's target alike, nothing added or removed ` +
      `(SPEC 13.4, 13.5; H-4):\n${renderLines(lines)}`,
  );
}

/**
 * Every staged link's target — the outside directory holding it, and all it
 * holds — byte-identical to its staged state: nothing written, removed, or
 * added through a link, a dangling link's target still absent (SPEC 13.4:
 * writes never traverse symbolic links; 13.5: a symbolic link itself, never
 * its target). Fails diagnosed, naming every difference and its link.
 */
export async function assertOutsideTargetsUntouched(
  staged: StagedLeftover | readonly StagedLeftover[],
  context: string,
): Promise<void> {
  const lines: string[] = [];
  for (const one of asList(staged)) {
    for (const record of one.outside) {
      const now = await captureTree(Buffer.from(record.dir), EMPTY, false);
      for (const line of diffTrees(
        record.tree,
        now,
        false,
        outsideRenderer(record.dir),
      )) {
        lines.push(
          `${line} (outside the workspace; the target of the link ` +
            `${renderRel(Buffer.from(record.link, "latin1"))})`,
        );
      }
    }
  }
  if (lines.length === 0) return;
  fail(
    `${context}: a symbolic link's target outside the workspace changed — ` +
      `a removal or a write followed a link (SPEC 13.4: writes never ` +
      `traverse symbolic links; 13.5: a symbolic link is removed itself, ` +
      `never its target):\n${renderLines(lines)}`,
  );
}

/**
 * Each staged FIFO still a FIFO in place (where a test expects the staging
 * to survive: an obstruction, a busy refusal, a command acquiring nothing).
 * Fails diagnosed, naming what each path holds instead.
 */
export async function assertFifosIntact(
  staged: StagedLeftover | readonly StagedLeftover[],
  context: string,
): Promise<void> {
  const lines: string[] = [];
  for (const one of asList(staged)) {
    for (const key of one.fifos) {
      const rel = Buffer.from(key, "latin1");
      const stats = await lstatOrUndefined(
        joinBytes(Buffer.from(one.root), rel),
      );
      if (stats === undefined) {
        lines.push(`${renderRel(rel)}: nothing there`);
      } else if (!stats.isFIFO()) {
        lines.push(`${renderRel(rel)}: ${kindName(stats)}`);
      }
    }
  }
  if (lines.length === 0) return;
  fail(
    `${context}: a staged FIFO is no longer a FIFO in place:\n` +
      renderLines(lines),
  );
}

// ---------------------------------------------------------------------------
// Dead runs' entries

/**
 * Start `options.argv` — a mutating command succeeding in the workspace,
 * under `--test-hold <holdPath>` — in a process group of its own, await its
 * hold file, and kill it under T13.5-3's exit-collection discipline
 * (`killGroup`: SIGKILL to the whole group, its exit collected, no process
 * of the group still listed); the hold file is removed afterwards. Returns
 * the lock directory's one entry, a plain file — its name bytes, its
 * content read under H-4's grant, its mode — and the killed group. Fails
 * diagnosed when the run never holds (it exits first, or the wait runs
 * out), ends on its own before the kill, or leaves anything at
 * `.xspec/lock` but a directory holding exactly one entry, a plain file
 * (SPEC 13.5: abnormal termination leaves its entry; TEST-SPEC T13.5-3).
 * Harness errors (a lingering group, the capture limit) propagate as such.
 */
export async function killHeldRun(
  binding: ProductBinding,
  options: HeldRunOptions,
): Promise<DeadRun> {
  const { root, holdPath, context } = options;
  if (!path.isAbsolute(holdPath) || isInside(root, holdPath)) {
    throw new Error(
      `killHeldRun: the hold path ${holdPath} must be absolute and lie ` +
        `outside the workspace ${root} (TEST-SPEC §13.5's preamble)`,
    );
  }
  if (await pathExists(holdPath)) {
    throw new Error(`killHeldRun: the hold path ${holdPath} is occupied`);
  }
  const running = await startProduct(binding, {
    cwd: root,
    argv: [...options.argv, "--test-hold", holdPath],
    processGroup: true,
  });
  let killed: KilledGroup;
  try {
    try {
      await running.waitForFile(holdPath);
    } catch (error) {
      rethrowHarnessError(error);
      // Whatever still runs of the group goes before the verdict.
      await running.killGroup().catch((kill: unknown) => {
        rethrowHarnessError(kill);
      });
      fail(
        `${context}: the held command must create its hold file at ` +
          `${holdPath} once it holds workspace exclusivity, and hold until ` +
          `the file is deleted (SPEC 13.5), so that it can be killed while ` +
          `held — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    killed = await running.killGroup();
  } finally {
    await releaseHoldFile(holdPath);
  }
  if (killed.result.signal !== "SIGKILL") {
    fail(
      `${context}: the held run ended on its own before the kill — ` +
        `${summarizeResult(killed.result)} — where a held run waits until ` +
        `its hold file is deleted (SPEC 13.5)`,
    );
  }
  return { entry: await readDeadEntry(root, context), killed };
}

/** The lock directory's one entry after a kill, or a diagnosed failure. */
async function readDeadEntry(
  root: string,
  context: string,
): Promise<LockEntry> {
  const rootBytes = Buffer.from(root);
  const lockAbs = joinBytes(rootBytes, LOCK_BYTES);
  const expectation =
    `after the kill, ${LOCK_PATH} is a directory holding exactly one ` +
    `entry, a plain file — the dead run's, a leftover (SPEC 13.5: an ` +
    `abnormal termination leaves its entry; TEST-SPEC T13.5-3)`;
  const lock = await lstatOrUndefined(lockAbs);
  if (lock === undefined) {
    fail(`${context}: ${expectation}; found nothing at ${LOCK_PATH}`);
  }
  if (!lock.isDirectory()) {
    fail(`${context}: ${expectation}; found ${kindName(lock)} at ${LOCK_PATH}`);
  }
  const names = (await fsp.readdir(lockAbs, { encoding: "buffer" })).sort(
    Buffer.compare,
  );
  if (names.length !== 1) {
    fail(
      `${context}: ${expectation}; found ` +
        (names.length === 0
          ? "an empty lock directory"
          : `${String(names.length)} entries: ${names.map(renderName).join(", ")}`),
    );
  }
  const name = Buffer.from(names[0]!);
  const entryRel = Buffer.concat([LOCK_PREFIX, name]);
  const stats = await fsp.lstat(joinBytes(rootBytes, entryRel));
  if (!stats.isFile()) {
    fail(
      `${context}: ${expectation}; its one entry ${renderName(name)} is ` +
        `${kindName(stats)}, no plain file`,
    );
  }
  const entryAbs = joinBytes(rootBytes, entryRel);
  const content = await withOwnerGrant(entryAbs, "read", () =>
    readPlainFile(entryAbs),
  );
  return { name, content, mode: stats.mode & 0o7777 };
}

// ---------------------------------------------------------------------------
// Paths and rendering

/** `name` within `dir`, byte for byte. */
function joinBytes(dir: Buffer, name: Buffer): Buffer {
  return Buffer.concat([dir, Buffer.from([SLASH]), name]);
}

async function lstatOrUndefined(abs: Buffer): Promise<Stats | undefined> {
  try {
    return await fsp.lstat(abs);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Whether `candidate` is `root` or lies under it. */
function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function kindName(stats: Stats): string {
  if (stats.isSymbolicLink()) return "a symbolic link";
  if (stats.isDirectory()) return "a directory";
  if (stats.isFile()) return "a plain file";
  if (stats.isFIFO()) return "a FIFO";
  return "another kind";
}

/** A path's bytes for a diagnosis: each segment as text, or its hex. */
function renderBytes(bytes: Buffer): string {
  const segments: string[] = [];
  let start = 0;
  for (let end = 0; end <= bytes.length; end += 1) {
    if (end < bytes.length && bytes[end] !== SLASH) continue;
    const segment = bytes.subarray(start, end);
    const text = segment.toString("utf8");
    segments.push(
      Buffer.from(text, "utf8").equals(segment)
        ? text
        : `<bytes ${segment.toString("hex")}>`,
    );
    start = end + 1;
  }
  return segments.join("/");
}

/** A workspace-relative path (bytes, or a latin1 key's bytes) rendered. */
function renderRel(rel: Buffer | string): string {
  const bytes = typeof rel === "string" ? Buffer.from(rel, "latin1") : rel;
  return JSON.stringify(renderBytes(bytes));
}

function renderAbs(abs: Buffer): string {
  return JSON.stringify(renderBytes(abs));
}

function renderName(name: Buffer): string {
  return JSON.stringify(renderBytes(name));
}

/** Keys of an outside directory's tree rendered under that directory. */
function outsideRenderer(dir: string): (key: string) => string {
  return (key) =>
    key === ""
      ? JSON.stringify(dir)
      : JSON.stringify(`${dir}/${renderBytes(Buffer.from(key, "latin1"))}`);
}

function renderLines(lines: readonly string[]): string {
  return lines
    .map((line) => `  - ${line.split("\n").join("\n    ")}`)
    .join("\n");
}

function octal(mode: number): string {
  return `0o${mode.toString(8).padStart(3, "0")}`;
}
