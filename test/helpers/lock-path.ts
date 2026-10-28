// The lock path as the test harness meets it (TEST-SPEC H-4, H-6; SPEC 13.4,
// 13.5). Harness machinery only: no product imports, no test framework
// dependence.
//
// - The path. SPEC 13.5 keeps exclusivity in the lock directory `.xspec/lock`
//   under the graph-data area, transient (13.4). `isLockPathBytes` (over a
//   snapshot's relative byte path: the `exclude` slot of `SnapshotOptions`)
//   and `isLockPathKey` (over a snapshot key) match exactly `.xspec/lock` and
//   every path beginning `.xspec/lock/` — never `.xspec`, `.xspec/lockx`,
//   `.xspec/lock.tmp`, nor `x/.xspec/lock`: paths are relative to the
//   snapshot's root, a workspace root wherever the lock path is meant.
// - H-6's exclusion. Every comparison of written files across runs or
//   workspaces (determinism and twin comparisons alike), and every comparison
//   of a mutating command's run against its own pre-invocation state,
//   excludes the lock path and everything under it, and nothing more: never
//   the graph-data area whole; a comparison around commands that acquire
//   nothing includes it. Every compare of two snapshots applies that rule
//   itself (helpers/snapshot.ts `lockPathExclusion`, classifying by the
//   mutating commands' runs the subprocess driver notes,
//   helpers/acquiring-runs.ts); `EXCLUDE_LOCK_PATH`, or `excludingLockPath`
//   beside an exclusion of the caller's own, prunes the lock path from a
//   snapshot's walk for a compare that excludes it whatever ran (the
//   determinism protocol, helpers/determinism.ts).
// - H-4's grant-and-restore. An entry's permissions are the product's own
//   (13.5), so a product may make its entries unreadable to their owner.
//   Where a plain file's own mode refuses the harness's read of it (to compare
//   or copy it) or its write to it (to alter its content in place,
//   T13.5-10(c)), `withOwnerGrant` adds the owner's permission bit for that
//   access alone, retries the access, and restores the exact prior mode at
//   once — before returning, whether the access succeeded or threw — so the
//   mode is the product's again before any further product invocation or the
//   lifting of any hold. A snapshot's walk (helpers/snapshot.ts) reads every
//   plain file at or under the lock path through it; `readLockPathFile`,
//   `writeLockPathFile`, and `copyLockPathFile` serve a test's own reads,
//   in-place alterations, and copies of such files. Only there: a refused read
//   anywhere else stays an error. Nothing is granted to a directory — a
//   listing or search the harness's own staging refused under the lock path
//   (T13.4-12's `--x`, T13.5-10(d)) stays refused, those tests restoring their
//   own stagings to inspect them — nor where the owner's bit is already set
//   (the refusal is not that mode's) or the harness cannot change the mode (a
//   file it does not own): such a refusal stays an error too. Grants on one
//   path are serialized within the harness's process, so no grant ever takes
//   another's granted mode for the product's.

import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import type { SnapshotOptions } from "./snapshot.js";

/** The lock path, workspace-relative (SPEC 13.5: the lock directory). */
export const LOCK_PATH = ".xspec/lock";

const LOCK_PATH_BYTES = Buffer.from(LOCK_PATH, "latin1");
const SLASH = 0x2f;

/**
 * Whether a relative byte path (`/`-separated, as a snapshot's walk builds
 * it) is the lock path `.xspec/lock` itself or a path under it.
 */
export function isLockPathBytes(relPathBytes: Uint8Array): boolean {
  const length = LOCK_PATH_BYTES.length;
  if (relPathBytes.length < length) return false;
  for (let index = 0; index < length; index += 1) {
    if (relPathBytes[index] !== LOCK_PATH_BYTES[index]) return false;
  }
  return relPathBytes.length === length || relPathBytes[length] === SLASH;
}

/**
 * {@link isLockPathBytes} over a snapshot key (helpers/snapshot.ts: the exact
 * relative path bytes, held latin1-encoded).
 */
export function isLockPathKey(key: string): boolean {
  return key === LOCK_PATH || key.startsWith(`${LOCK_PATH}/`);
}

/**
 * Snapshot options excluding the lock path and everything under it, and
 * nothing else (H-6), from the walk itself: for a compare that excludes it
 * whatever ran — the determinism protocol's — where every other compare
 * classifies its own pair (helpers/snapshot.ts `lockPathExclusion`).
 */
export const EXCLUDE_LOCK_PATH: SnapshotOptions = Object.freeze({
  exclude: isLockPathBytes,
});

/**
 * `options` with the lock path excluded besides whatever its own `exclude`
 * prunes (H-6), e.g. a compare already excluding `.git`.
 */
export function excludingLockPath(
  options: SnapshotOptions = {},
): SnapshotOptions {
  const own = options.exclude;
  if (own === undefined) return { ...options, exclude: isLockPathBytes };
  return {
    ...options,
    exclude: (relPathBytes) =>
      isLockPathBytes(relPathBytes) || own(relPathBytes),
  };
}

/** The access a grant serves: the owner's read or write permission bit. */
export type OwnerAccess = "read" | "write";

const OWNER_BIT: Readonly<Record<OwnerAccess, number>> = {
  read: 0o400,
  write: 0o200,
};

// Reads and in-place writes of a file never follow a symbolic link, and an
// in-place write never creates the file.
const NO_FOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const READ_NO_FOLLOW = fs.constants.O_RDONLY | NO_FOLLOW;
const WRITE_IN_PLACE = fs.constants.O_WRONLY | fs.constants.O_TRUNC | NO_FOLLOW;

/**
 * Run `operation`, an access of kind `access` to the plain file at
 * `absPath`. Should a permission refusal (`EACCES`, `EPERM`) reject it while
 * the file's mode lacks the owner's bit for that access, add that bit alone,
 * run `operation` again, and restore the exact prior mode at once, whether
 * the retry resolved or threw (H-4). Every other failure propagates as is:
 * a refusal at a path holding no plain file (a directory's listing included),
 * or one with the owner's bit already set (retried once, unchanged: a
 * concurrent grant, or a refusal that is not this mode's). A mode the harness
 * cannot change, or cannot restore exactly, is a harness error.
 */
export async function withOwnerGrant<T>(
  absPath: string | Buffer,
  access: OwnerAccess,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (refusal) {
    if (!isPermissionRefusal(refusal)) throw refusal;
    return await serializedOn(absPath, () =>
      grantAndRetry(absPath, access, operation, refusal),
    );
  }
}

/**
 * The exact bytes of the plain file at `rel` — the lock path or a path under
 * it — in the workspace at `root`, read under H-4's grant. A string `rel` is
 * a UTF-8 path; bytes are taken exactly (a snapshot key's
 * `snapshotKeyBytes`, a byte listing's name).
 */
export async function readLockPathFile(
  root: string,
  rel: string | Uint8Array,
): Promise<Buffer> {
  const absPath = lockPathTarget(root, rel, "readLockPathFile");
  await expectPlainFile(absPath, "readLockPathFile");
  return await withOwnerGrant(absPath, "read", () =>
    fsp.readFile(absPath, { flag: READ_NO_FOLLOW }),
  );
}

/**
 * Replace the content of the plain file at `rel` — the lock path or a path
 * under it — in the workspace at `root` with exactly `content`, in place: the
 * file is opened without creating or replacing it, so its name and kind stay
 * as they were (T13.5-10(c)'s alteration), under H-4's grant.
 */
export async function writeLockPathFile(
  root: string,
  rel: string | Uint8Array,
  content: Uint8Array,
): Promise<void> {
  const absPath = lockPathTarget(root, rel, "writeLockPathFile");
  await expectPlainFile(absPath, "writeLockPathFile");
  await withOwnerGrant(absPath, "write", async () => {
    const handle = await fsp.open(absPath, WRITE_IN_PLACE);
    try {
      await handle.writeFile(content);
    } finally {
      await handle.close();
    }
  });
}

/**
 * Copy the plain file at `fromRel` — the lock path or a path under it — in
 * the workspace at `fromRoot` to `destination`, a new plain file (an existing
 * occupant is never replaced): its exact bytes, read under H-4's grant, and
 * its exact mode, the source's restored. The destination's parent must exist.
 */
export async function copyLockPathFile(
  fromRoot: string,
  fromRel: string | Uint8Array,
  destination: string | Buffer,
): Promise<void> {
  const absPath = lockPathTarget(fromRoot, fromRel, "copyLockPathFile");
  const mode = (await expectPlainFile(absPath, "copyLockPathFile")) & 0o7777;
  const content = await withOwnerGrant(absPath, "read", () =>
    fsp.readFile(absPath, { flag: READ_NO_FOLLOW }),
  );
  await fsp.writeFile(destination, content, { flag: "wx", mode: 0o600 });
  await fsp.chmod(destination, mode);
}

function isPermissionRefusal(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EACCES" || code === "EPERM";
}

async function grantAndRetry<T>(
  absPath: string | Buffer,
  access: OwnerAccess,
  operation: () => Promise<T>,
  refusal: unknown,
): Promise<T> {
  let stats: fs.Stats;
  try {
    stats = await fsp.lstat(absPath);
  } catch {
    throw refusal;
  }
  if (!stats.isFile()) throw refusal;
  const prior = stats.mode & 0o7777;
  const bit = OWNER_BIT[access];
  if ((prior & bit) !== 0) return await operation();
  try {
    await fsp.chmod(absPath, prior | bit);
  } catch (error) {
    throw new Error(
      `H-4 grant: cannot grant the owner ${access} permission on ` +
        `${displayPath(absPath)} (mode ${octal(prior)}) for the harness's ` +
        `${access} of it: ${(error as Error).message}`,
      { cause: refusal },
    );
  }
  let settled: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    settled = { ok: true, value: await operation() };
  } catch (error) {
    settled = { ok: false, error };
  }
  await restoreMode(
    absPath,
    prior,
    access,
    settled.ok ? undefined : settled.error,
  );
  if (!settled.ok) throw settled.error;
  return settled.value;
}

async function restoreMode(
  absPath: string | Buffer,
  prior: number,
  access: OwnerAccess,
  pending: unknown,
): Promise<void> {
  try {
    await fsp.chmod(absPath, prior);
    const restored = (await fsp.lstat(absPath)).mode & 0o7777;
    if (restored !== prior) {
      throw new Error(`its mode reads ${octal(restored)} after the restore`);
    }
  } catch (error) {
    // A file gone meanwhile keeps no mode to restore.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new Error(
      `H-4 grant: cannot restore the mode ${octal(prior)} of ` +
        `${displayPath(absPath)} after the harness's ${access} of it: ` +
        `${(error as Error).message}`,
      { cause: pending ?? error },
    );
  }
}

const grantChains = new Map<string, Promise<void>>();

async function serializedOn<T>(
  absPath: string | Buffer,
  task: () => Promise<T>,
): Promise<T> {
  const key = Buffer.from(absPath).toString("latin1");
  const previous = grantChains.get(key) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  grantChains.set(key, tail);
  try {
    await previous;
    return await task();
  } finally {
    release();
    if (grantChains.get(key) === tail) grantChains.delete(key);
  }
}

/**
 * The absolute byte path of `rel` under `root`, refusing (a harness-usage
 * error) any `rel` that is not the lock path or a well-formed path under it.
 */
function lockPathTarget(
  root: string,
  rel: string | Uint8Array,
  caller: string,
): Buffer {
  const relBytes =
    typeof rel === "string" ? Buffer.from(rel, "utf8") : Buffer.from(rel);
  if (!isLockPathBytes(relBytes) || !wellFormedRelative(relBytes)) {
    throw new Error(
      `${caller}: ${displayPath(relBytes)} is not ${LOCK_PATH} or a path ` +
        `under it (H-4's grant serves the lock path alone)`,
    );
  }
  return Buffer.concat([Buffer.from(root), Buffer.from([SLASH]), relBytes]);
}

/** No empty, `.`, or `..` segment, and no NUL byte. */
function wellFormedRelative(relBytes: Buffer): boolean {
  if (relBytes.includes(0)) return false;
  return relBytes
    .toString("latin1")
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** The mode of the plain file at `absPath`; anything else is a usage error. */
async function expectPlainFile(
  absPath: Buffer,
  caller: string,
): Promise<number> {
  const stats = await fsp.lstat(absPath);
  if (!stats.isFile()) {
    throw new Error(
      `${caller}: ${displayPath(absPath)} holds no plain file ` +
        `(${stats.isSymbolicLink() ? "a symbolic link" : stats.isDirectory() ? "a directory" : "another kind"})`,
    );
  }
  return stats.mode;
}

function displayPath(absPath: string | Uint8Array): string {
  if (typeof absPath === "string") return JSON.stringify(absPath);
  const bytes = Buffer.from(absPath);
  const text = bytes.toString("utf8");
  if (Buffer.from(text, "utf8").equals(bytes)) return JSON.stringify(text);
  return `<path bytes ${bytes.toString("hex")}>`;
}

function octal(mode: number): string {
  return `0o${mode.toString(8).padStart(3, "0")}`;
}
