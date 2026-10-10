// Whole-directory byte snapshots and compares for the xspec test harness
// (TEST-SPEC H-4, H-6). Harness machinery only: no product imports.
//
// A snapshot records every entry under a directory, byte-exactly and
// normalizing nothing: regular files with their exact bytes, directories
// (empty ones included), symbolic links with their verbatim target bytes
// (never followed, never traversed — a symlinked directory is a leaf), and
// a catch-all kind for anything else. Entry names are handled as raw bytes,
// so non-UTF-8 file names (Linux staging, TEST-SPEC T1.5-2) round-trip.
// Entry permissions and timestamps are deliberately not part of a snapshot:
// H-4/H-6 assert *byte* state (file set, kinds, contents, link targets), and
// mode bits would tie compares to platform- and umask-specific metadata.
//
// The lock path `.xspec/lock` (SPEC 13.4, 13.5; helpers/lock-path.ts) and
// H-6: every comparison of two snapshots (`diffSnapshots`, and through it
// `assertSnapshotsEqual`, `assertDirectoriesEqual`, `assertLeavesUnchanged`)
// leaves out exactly what `lockPathExclusion` names, and nothing more:
// - across directories — runs or workspaces, determinism and twin
//   comparisons alike (two snapshots whose roots are different directories)
//   — the lock path `.xspec/lock` and everything under it, always, and with
//   it the lock path of every nested workspace root, a directory holding an
//   `xspec.config.ts` entry in either snapshot (SPEC 7: 13.5 places each
//   workspace's lock path under its own root);
// - within one directory — its state before and after — the lock path of
//   each workspace on which a mutating command's run acted between the two
//   snapshots (helpers/acquiring-runs.ts: the run started or ended between
//   them; the subprocess driver notes every such run), acquisition's and
//   release's writes there counting as no modification (13.5); and nothing
//   at all otherwise: around commands that acquire nothing — `build`,
//   `check`, `version`, a preview, every read command — no other run
//   acquiring, releasing, or being killed meanwhile, the lock path is
//   compared like any other path, whatever occupied it before (nothing, a
//   leftover, or a held run's entry) occupying it afterwards byte-identical
//   (13.4: no write but acquisition and release touches it).
// A snapshot records what that classification needs: its root's real path
// and the acquisition event count as its walk began. The walk itself prunes
// only what the caller's `exclude` option names — `EXCLUDE_LOCK_PATH` or
// `excludingLockPath` (helpers/lock-path.ts) where a caller's compare
// excludes the lock path whatever ran (the determinism protocol). A plain
// file at or under the lock path whose own mode refuses the walk's read (an
// entry's permissions are the product's own) is read under H-4's
// grant-and-restore (`withOwnerGrant`), its exact mode back before the
// snapshot returns; a refused read anywhere else, and every refused listing,
// stays an error.
//
// Snapshots serve the modifies-nothing and compare-around-command tests
// (`assertLeavesUnchanged`, e.g. read commands never write, refused commands
// modify nothing, `.git/` untouched around git-reading invocations) and the
// H-6 determinism protocol in determinism.ts (same command twice; identical
// workspace rebuilt in two directories).

import { Buffer } from "node:buffer";
import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import {
  acquisitionMark,
  lockPathKeyUnder,
  lockPathsActedOnBetween,
} from "./acquiring-runs.js";
import {
  bytesEqual,
  describeByteDifference,
  HarnessAssertionError,
} from "./assertions.js";
import { isLockPathBytes, LOCK_PATH, withOwnerGrant } from "./lock-path.js";

/** One directory entry as captured by a snapshot. */
export type SnapshotEntry =
  | { readonly kind: "file"; readonly bytes: Uint8Array }
  | { readonly kind: "dir" }
  | { readonly kind: "symlink"; readonly target: Uint8Array }
  | { readonly kind: "other" };

/**
 * The byte state of a directory tree. `entries` maps the `/`-separated
 * relative path of every entry — keyed by its exact bytes, latin1-encoded so
 * non-UTF-8 names are lossless — to what occupies it, in bytewise path order.
 * A view built from a snapshot (a filtered entry map) carries the snapshot's
 * `realRoot` and `acquisitionMark` over (`{ ...snapshot, entries }`), so its
 * compares are classified as the snapshot's are (H-6).
 */
export interface DirectorySnapshot {
  readonly root: string;
  /**
   * The root's real path at capture: two snapshots with one real root are
   * one directory's states; with two, a comparison across directories (H-6).
   */
  readonly realRoot: string;
  /**
   * The acquisition event count as the walk began (helpers/acquiring-runs.ts
   * `acquisitionMark`): two snapshots' marks bound the mutating commands'
   * runs that acted between them.
   */
  readonly acquisitionMark: number;
  readonly entries: ReadonlyMap<string, SnapshotEntry>;
}

export interface SnapshotOptions {
  /**
   * Omit entries whose relative byte path (`/`-separated) matches; an
   * excluded directory's whole subtree is pruned. Every compare applies
   * H-6's lock-path exclusion itself (`lockPathExclusion`); pruning the lock
   * path from the walk — `EXCLUDE_LOCK_PATH` / `excludingLockPath`
   * (helpers/lock-path.ts) — serves a compare that excludes it whatever ran.
   */
  readonly exclude?: (relPathBytes: Uint8Array) => boolean;
}

/** One difference between two snapshots ("added" = only in the second). */
export interface SnapshotChange {
  /** Exact relative path, latin1-encoded (the snapshot map key). */
  readonly key: string;
  /** Human-readable form of the relative path. */
  readonly path: string;
  readonly change: "added" | "removed" | "changed";
  readonly detail: string;
}

/**
 * Capture the byte state of the directory tree at `absDir`. The root must
 * exist and be a directory — anything else is a harness-usage error, thrown
 * as a plain `Error` (this is machinery misuse, not a product observation).
 */
export async function snapshotDirectory(
  absDir: string,
  options: SnapshotOptions = {},
): Promise<DirectorySnapshot> {
  // Taken first: a run noted while the walk proceeds counts as after it.
  const mark = acquisitionMark();
  let rootStats: Stats;
  try {
    rootStats = await fsp.stat(absDir);
  } catch (error) {
    throw new Error(
      `snapshotDirectory: cannot stat ${absDir}: ${(error as Error).message}`,
    );
  }
  if (!rootStats.isDirectory()) {
    throw new Error(`snapshotDirectory: not a directory: ${absDir}`);
  }
  const realRoot = await fsp.realpath(absDir).catch(() => path.resolve(absDir));
  const entries = new Map<string, SnapshotEntry>();
  await walk(Buffer.from(absDir), null, entries, options.exclude);
  return { root: absDir, realRoot, acquisitionMark: mark, entries };
}

/**
 * What a comparison of two snapshots leaves out under H-6 (module header):
 * `whole` when everything (the snapshots' root is a lock path, or lies under
 * one, acted on between them), else the snapshot keys of the excluded lock
 * paths, each with everything under it — none when the comparison includes
 * every entry.
 */
export interface LockPathExclusion {
  readonly whole: boolean;
  readonly keys: readonly string[];
  /** Whether the comparison leaves out the entry at snapshot key `key`. */
  excludes(key: string): boolean;
}

const CONFIG_NAME = "xspec.config.ts";

/**
 * H-6's lock-path exclusion for a comparison of two snapshots (module
 * header): across directories, the lock path of the root and of every
 * nested workspace root holding an `xspec.config.ts` entry in either
 * snapshot; within one directory, the lock path of each workspace a mutating
 * command's run acted on between the two snapshots (started or ended between
 * their acquisition marks), wherever it lies under the root; nothing else.
 */
export function lockPathExclusion(
  first: DirectorySnapshot,
  second: DirectorySnapshot,
): LockPathExclusion {
  const keys = new Set<string>();
  let whole = false;
  if (first.realRoot !== second.realRoot) {
    keys.add(LOCK_PATH);
    for (const snapshot of [first, second]) {
      for (const key of snapshot.entries.keys()) {
        if (key.endsWith(`/${CONFIG_NAME}`)) {
          keys.add(`${key.slice(0, -CONFIG_NAME.length)}${LOCK_PATH}`);
        }
      }
    }
  } else {
    for (const lockPath of lockPathsActedOnBetween(
      first.acquisitionMark,
      second.acquisitionMark,
    )) {
      const key = lockPathKeyUnder(first.realRoot, lockPath);
      if (key === "all") whole = true;
      else if (key !== undefined) keys.add(key);
    }
  }
  const sorted = [...keys].sort();
  return {
    whole,
    keys: sorted,
    excludes: (key) =>
      whole ||
      sorted.some((lock) => key === lock || key.startsWith(`${lock}/`)),
  };
}

/**
 * All differences between two snapshots, in bytewise path order, H-6's
 * lock-path exclusion applied (`lockPathExclusion`; the module header).
 * "added" and "removed" are relative to the second snapshot (added = present
 * only in `after`); for entries present in both, kind changes, file-byte
 * changes (diagnosed with the first differing offset), and symlink-target
 * changes are reported.
 */
export function diffSnapshots(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
): SnapshotChange[] {
  const exclusion = lockPathExclusion(before, after);
  const keys = [...new Set([...before.entries.keys(), ...after.entries.keys()])]
    .filter((key) => !exclusion.excludes(key))
    .sort();
  const changes: SnapshotChange[] = [];
  for (const key of keys) {
    const entryBefore = before.entries.get(key);
    const entryAfter = after.entries.get(key);
    if (entryBefore === undefined && entryAfter !== undefined) {
      changes.push({
        key,
        path: displaySnapshotPath(key),
        change: "added",
        detail: `only in the second snapshot: ${describeEntry(entryAfter)}`,
      });
    } else if (entryBefore !== undefined && entryAfter === undefined) {
      changes.push({
        key,
        path: displaySnapshotPath(key),
        change: "removed",
        detail: `only in the first snapshot: ${describeEntry(entryBefore)}`,
      });
    } else if (entryBefore !== undefined && entryAfter !== undefined) {
      const detail = describeEntryDifference(entryBefore, entryAfter);
      if (detail !== undefined) {
        changes.push({
          key,
          path: displaySnapshotPath(key),
          change: "changed",
          detail,
        });
      }
    }
  }
  return changes;
}

/**
 * Assert two snapshots are byte-identical (same entry set, kinds, file bytes,
 * and link targets), failing diagnosed with every difference (H-4/H-6,
 * normalizing nothing).
 */
export function assertSnapshotsEqual(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  context: string,
): void {
  const changes = diffSnapshots(before, after);
  if (changes.length === 0) return;
  const where =
    before.root === after.root
      ? `under ${before.root}`
      : `between ${before.root} and ${after.root}`;
  throw new HarnessAssertionError(
    `${context}: ${String(changes.length)} byte-state difference(s) ${where} (H-4/H-6, normalizing nothing${describeExclusion(lockPathExclusion(before, after))}):\n${renderChanges(changes)}`,
  );
}

/** The exclusion a compare applied, as a diagnosis clause ("" for none). */
function describeExclusion(exclusion: LockPathExclusion): string {
  if (exclusion.whole) {
    return "; the whole tree, a lock path a mutating command's run acted on, excluded (H-6)";
  }
  if (exclusion.keys.length === 0) return "";
  return `; excluded (H-6): ${exclusion.keys.map(displaySnapshotPath).join(", ")} and everything under it`;
}

/**
 * Assert two directory trees are byte-identical — the whole-directory
 * compare of the H-6 two-directory protocol and of exchanged-output
 * comparisons (relative paths make this well-defined across directories).
 */
export async function assertDirectoriesEqual(
  dirFirst: string,
  dirSecond: string,
  context: string,
  options: SnapshotOptions = {},
): Promise<void> {
  const first = await snapshotDirectory(dirFirst, options);
  const second = await snapshotDirectory(dirSecond, options);
  assertSnapshotsEqual(first, second, context);
}

/**
 * The compare-around-command protocol: snapshot `absDir`, run `action`,
 * snapshot again, and assert nothing changed — for modifies-nothing
 * assertions (read commands never write; refused commands modify nothing;
 * `.git/` byte-identical around git-reading invocations, T12.0-11). The lock
 * path of each workspace a mutating command's run acted on during `action`
 * is left out, and it alone (H-6; `lockPathExclusion`): around commands that
 * acquire nothing it is compared like any other path. Returns the action's
 * result so the caller can go on asserting it.
 */
export async function assertLeavesUnchanged<T>(
  absDir: string,
  action: () => Promise<T> | T,
  context: string,
  options: SnapshotOptions = {},
): Promise<T> {
  const before = await snapshotDirectory(absDir, options);
  const result = await action();
  const after = await snapshotDirectory(absDir, options);
  assertSnapshotsEqual(before, after, `${context} (modifies-nothing compare)`);
  return result;
}

/** Human-readable rendering of a snapshot key (hex for non-UTF-8 names). */
export function displaySnapshotPath(key: string): string {
  const bytes = snapshotKeyBytes(key);
  const text = bytes.toString("utf8");
  if (Buffer.from(text, "utf8").equals(bytes)) return text;
  return `<path bytes ${bytes.toString("hex")}>`;
}

/**
 * The exact relative path bytes a snapshot key denotes (`/`-separated; the
 * key holds them latin1-encoded, one character per byte). The rule for every
 * key — a snapshot's, or one built the same way from a byte listing: wherever
 * a key becomes a filesystem path or meets a path the product reported, it
 * goes through this function (a byte path, e.g. `TestWorkspace.bytePath`, or
 * a byte compare), never through the key's own characters — read as a UTF-8
 * path string, a key misnames every entry whose name is not ASCII (a valid
 * UTF-8 name's bytes re-encoded, a name that is not valid UTF-8 unreachable),
 * names the product chooses included (graph data, SPEC 13.3; companions,
 * 13.1). For an ASCII path the key and the path string coincide; a key is
 * rendered for a diagnosis with {@link displaySnapshotPath}.
 */
export function snapshotKeyBytes(key: string): Buffer {
  return Buffer.from(key, "latin1");
}

/** One-line description of an entry (kind, size, target). */
export function describeEntry(entry: SnapshotEntry): string {
  switch (entry.kind) {
    case "file":
      return `file (${String(entry.bytes.length)} bytes)`;
    case "dir":
      return "directory";
    case "symlink":
      return `symlink → ${JSON.stringify(Buffer.from(entry.target).toString("utf8"))}`;
    case "other":
      return "other entry (not a file, directory, or symlink)";
  }
}

/**
 * How two same-path entries differ, or undefined when byte-identical.
 * Exported for the determinism protocol's written-file compares.
 */
export function describeEntryDifference(
  before: SnapshotEntry,
  after: SnapshotEntry,
): string | undefined {
  if (before.kind !== after.kind) {
    return `kind changed: ${before.kind} → ${after.kind}`;
  }
  if (before.kind === "file" && after.kind === "file") {
    if (!bytesEqual(before.bytes, after.bytes)) {
      return `file bytes differ:\n${describeByteDifference(before.bytes, after.bytes, "first", "second")}`;
    }
  }
  if (before.kind === "symlink" && after.kind === "symlink") {
    if (!bytesEqual(before.target, after.target)) {
      return `symlink target changed: ${JSON.stringify(Buffer.from(before.target).toString("utf8"))} → ${JSON.stringify(Buffer.from(after.target).toString("utf8"))}`;
    }
  }
  return undefined;
}

const MAX_RENDERED_CHANGES = 25;
const SLASH_BUF = Buffer.from([0x2f]); // "/"

function renderChanges(changes: readonly SnapshotChange[]): string {
  const lines = changes
    .slice(0, MAX_RENDERED_CHANGES)
    .map(
      (change) =>
        `  - ${change.change} ${change.path}: ${change.detail.split("\n").join("\n    ")}`,
    );
  if (changes.length > MAX_RENDERED_CHANGES) {
    lines.push(`  … and ${String(changes.length - MAX_RENDERED_CHANGES)} more`);
  }
  return lines.join("\n");
}

async function walk(
  absDir: Buffer,
  relPrefix: Buffer | null,
  entries: Map<string, SnapshotEntry>,
  exclude: SnapshotOptions["exclude"],
): Promise<void> {
  const names = (await fsp.readdir(absDir, { encoding: "buffer" })).sort(
    Buffer.compare,
  );
  for (const name of names) {
    const rel =
      relPrefix === null ? name : Buffer.concat([relPrefix, SLASH_BUF, name]);
    if (exclude?.(rel)) continue;
    const abs = Buffer.concat([absDir, SLASH_BUF, name]);
    const stats = await fsp.lstat(abs);
    const key = rel.toString("latin1");
    if (stats.isSymbolicLink()) {
      entries.set(key, {
        kind: "symlink",
        target: await fsp.readlink(abs, { encoding: "buffer" }),
      });
    } else if (stats.isDirectory()) {
      entries.set(key, { kind: "dir" });
      await walk(abs, rel, entries, exclude);
    } else if (stats.isFile()) {
      // H-4: a lock-path file's own mode may refuse this read; it alone is
      // granted, and its mode restored at once.
      const bytes = isLockPathBytes(rel)
        ? await withOwnerGrant(abs, "read", () => fsp.readFile(abs))
        : await fsp.readFile(abs);
      entries.set(key, { kind: "file", bytes });
    } else {
      entries.set(key, { kind: "other" });
    }
  }
}
