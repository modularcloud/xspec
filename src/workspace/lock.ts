// Workspace mutual exclusion and the `--test-hold` seam (SPEC 13.5).
//
// IMPLEMENTATION (Architecture): the workspace layer owns workspace mutual
// exclusion. SPEC 13.5: the commands that modify sources or durable files —
// `rename` and `move`, their `--preview` invocations excepted (6.6), and
// the mutating `review` subcommands (`create`, `resolve`, `split`) — are
// mutually exclusive per workspace among the processes of one machine (one
// process-identifier namespace): while one holds exclusivity, every other
// run against the workspace that reaches acquisition — "by any user who can
// write it, in any environment, through any path to its root directory" —
// fails there promptly, modifying nothing, with the busy refusal of 14.26,
// or with the read or write failure of 14.25 or 14.24 should the
// environment refuse a read or write acquisition makes.
//
// SPEC 13.5: "Exclusivity is kept in the workspace, in the lock directory
// `.xspec/lock` under the graph-data area (11.6), transient (13.4)" — so
// nothing here lies outside the root or is keyed by user, environment, or
// the spelling of the root's path: every run reaching the root's directory
// meets the one lock directory there.
//
// Acquisition (`acquireExclusivity`), once the configuration is loaded and
// the sources discovered (cli/commands/mutation.ts), in this order:
//
// 1. The area's own path `.xspec`: a directory is kept, and nothing there
//    is brought into existence as a directory (13.4); anything else — a
//    plain file, a symbolic link whatever it targets, any other occupant —
//    fails with the write failure concerning `.xspec`, nothing removed and
//    nothing traversed.
// 2. The lock path `.xspec/lock`: a directory is kept, and nothing there is
//    brought into existence; "a plain file at the lock path is a leftover,
//    which acquisition removes", the directory then made; anything else — a
//    symbolic link whatever it targets, any other occupant — fails with the
//    write failure concerning `.xspec/lock`, nothing removed.
// 3. The run's entry is added: "a plain file whose name records the
//    acquiring process's identifier and distinguishes the run, no other
//    run's entry ever bearing it" — here the process identifier, a hyphen,
//    and 32 random lowercase hexadecimal digits, created exclusively and
//    empty, its content opaque (13.4).
// 4. The lock directory is listed, once.
// 5. Every listed name but the run's own is judged before anything is
//    removed: "An entry there of another run alive on this machine — alive,
//    under the identifier the entry records, in the acquiring process's
//    process list — refuses acquisition (14.26), no leftover then removed".
//    An entry is a plain file whose name has the form above; its identifier
//    is listed when `process.kill(identifier, 0)` succeeds or is refused for
//    permission (another user's run) — Node's liveness probe on every
//    platform. The judgment takes names and kinds alone: "Acquisition reads
//    no file's content". An entry recording the acquiring process's own
//    identifier, one whose identifier is not listed, and a plain file whose
//    name records no identifier are leftovers; a terminated identifier
//    still listed is 13.5's gap, which refuses as a live one does, as 13.5
//    permits. Anything in the lock directory but a plain file is no entry
//    and records no identifier, whatever its name: it never refuses.
// 6. Failing a live entry, the leftovers among the names step 4 returned —
//    never a name it did not return, so a run whose entry was added since
//    is untouched — are removed: here the plain files, each unopened.
//    Anything else in the lock directory is left in place.
//
// Acquisition's refusals (13.5, 14.24, 14.25): a refused examination of the
// area's own occupant is the read failure concerning `.xspec`, and the area
// directory's refused creation the write failure concerning it; every other
// refused read — the lock path's kind, the lock directory's listing, a
// listed name's kind — is the read failure concerning `.xspec/lock`, and
// every other refused write — the lock directory's creation, the entry's
// addition, a leftover's removal — the write failure concerning
// `.xspec/lock`. Each is thrown (workspace/environment-refusal.ts) and stops
// the command at acquisition, release following; cli/main.ts renders it,
// exit 2. Acquisition reads nothing else: it examines the lock path itself
// and never lists `.xspec`.
//
// Overlap: adding the entry before listing gives 13.5's "of runs whose
// acquisitions overlap, at most one acquires — possibly none, the others
// refused (14.26)". A creation meeting an existing directory examines the
// path again (this run then did not create it), and an entry's addition
// meeting no lock directory — another run's release deleted it emptied
// meanwhile — establishes the directories again, within a small bound past
// which the run is refused as busy. Otherwise acquisition never waits or
// retries: it fails promptly (13.5).
//
// Release (`releaseExclusivity`), on every normal end — success, a refusal,
// a usage error past acquisition, a read or write failure (acquisition's
// included), the busy refusal, a hold-file error: "it deletes its entry,
// then the lock directory when that holds nothing else, and the area's
// directory too when its acquisition brought that into existence and it
// then holds nothing else". "Release reads nothing: a directory's deletion
// alone decides whether it holds anything else", and a deletion the
// environment refuses, or one finding nothing, "changes no outcome and is
// no write failure" (14.24). The lock directory's deletion is attempted
// only where acquisition found or made a directory there inside an area
// that was a directory, so release never deletes through a link. A process
// terminated abnormally leaves its entry, a leftover the next acquisition
// removes once its identifier leaves the process list.
//
// Every diagnostic is static (SPEC 12.0): never an entry's name, a process
// identifier, or an absolute path — coordination state outside 12.0's
// determinism (13.4).

import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";
import type { Dirent } from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { GRAPH_DATA_AREA, LOCK_PATH } from "../core/graph-data.js";
import type { AcquisitionWrite } from "./environment-refusal.js";
import {
  acquisitionObstruction,
  acquisitionWriteFailure,
  isAbsenceFailure,
  isFilesystemFailure,
  readFailure,
  workspaceBusy,
} from "./environment-refusal.js";

/** Poll cadence while waiting for the hold file's deletion (SPEC 13.5). */
const HOLD_POLL_MS = 10;

/**
 * How many times acquisition establishes the area, the lock directory, and
 * its entry when other runs' acquisitions and releases change them
 * meanwhile (module header); past it the run is refused as busy (14.26).
 */
const MAX_ESTABLISH_ROUNDS = 16;

/**
 * SPEC 13.5's entry form, as this product names entries: the acquiring
 * process's identifier in decimal, a hyphen, and 32 lowercase hexadecimal
 * digits of randomness, which distinguish the run. Matched against a
 * listed name's bytes read one byte per character, so a name holding any
 * byte outside ASCII never matches.
 */
const ENTRY_NAME = /^([1-9][0-9]{0,9})-[0-9a-f]{32}$/;

/** The largest identifier Node's `process.kill` accepts (a 32-bit int). */
const MAX_PROCESS_IDENTIFIER = 0x7fffffff;

const SLASH = Buffer.from("/");

/** The absolute paths acquisition and release act on. */
interface LockPaths {
  /** The graph-data area's own path, `.xspec` (SPEC 11.6). */
  readonly area: string;
  /** The lock path, `.xspec/lock` (SPEC 13.5). */
  readonly lock: string;
}

/** What acquisition established, which release undoes (SPEC 13.5). */
interface Established {
  /** This acquisition brought the area's directory into existence. */
  areaCreated: boolean;
  /**
   * Acquisition found or made a directory at the lock path, inside an
   * area that was a directory: only then does release delete it.
   */
  lockDirectory: boolean;
  /** This run's entry, once added: its absolute path and its name. */
  entry: { readonly path: string; readonly name: Buffer } | null;
}

/** A step's outcome: done, or establish everything again (module header). */
type Step = "done" | "again";

function lockPathsOf(root: string): LockPaths {
  return {
    area: path.join(root, GRAPH_DATA_AREA),
    lock: path.join(root, ...LOCK_PATH.split("/")),
  };
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | null)?.code;
}

/**
 * Turn a write of acquisition the environment refused into its write
 * failure (SPEC 14.24, 13.5); anything else — a defect of the product's
 * own — propagates unchanged.
 */
function refusedWrite(error: unknown, write: AcquisitionWrite): never {
  if (isFilesystemFailure(error)) throw acquisitionWriteFailure(write, error);
  throw error;
}

/**
 * Turn a read of acquisition the environment refused into its read failure
 * (SPEC 14.25, 13.5), concerning `concerned`; anything else propagates.
 */
function refusedRead(
  error: unknown,
  concerned: string,
  read: "listing" | "kind",
): never {
  if (isFilesystemFailure(error)) throw readFailure(concerned, read, error);
  throw error;
}

/**
 * The kind of a path's occupant, examined without following a symbolic
 * link (SPEC 13.4): `absent` when nothing occupies it. A kind read the
 * environment refuses is the read failure concerning `concerned` (SPEC
 * 14.25, 13.5).
 */
async function occupantKind(
  absolute: string | Buffer,
  concerned: string,
): Promise<"absent" | "directory" | "file" | "other"> {
  try {
    const stats = await fsp.lstat(absolute);
    if (stats.isDirectory()) return "directory";
    return stats.isFile() ? "file" : "other";
  } catch (error) {
    if (isAbsenceFailure(error)) return "absent";
    refusedRead(error, concerned, "kind");
  }
}

/**
 * Step 1 (SPEC 13.5): the area's own path `.xspec` — a directory kept,
 * nothing there brought into existence as a directory, anything else the
 * write failure concerning `.xspec`, nothing removed or traversed.
 */
async function establishArea(
  paths: LockPaths,
  held: Established,
): Promise<Step> {
  const kind = await occupantKind(paths.area, GRAPH_DATA_AREA);
  if (kind === "directory") return "done";
  if (kind !== "absent") {
    held.areaCreated = false;
    throw acquisitionObstruction("area");
  }
  try {
    await fsp.mkdir(paths.area);
  } catch (error) {
    // Another run made it meanwhile: examine it again, this run then not
    // its creator.
    if (errorCode(error) === "EEXIST") return "again";
    refusedWrite(error, "area");
  }
  held.areaCreated = true;
  return "done";
}

/**
 * Step 2 (SPEC 13.5): the lock path `.xspec/lock` — a directory kept,
 * nothing there brought into existence, a plain file a leftover removed
 * and the directory then made, anything else the write failure concerning
 * `.xspec/lock`, nothing removed.
 */
async function establishLockDirectory(
  paths: LockPaths,
  held: Established,
): Promise<Step> {
  held.lockDirectory = false;
  const kind = await occupantKind(paths.lock, LOCK_PATH);
  if (kind === "directory") {
    held.lockDirectory = true;
    return "done";
  }
  if (kind === "other") throw acquisitionObstruction("lock");
  if (kind === "file") {
    try {
      await fsp.unlink(paths.lock);
    } catch (error) {
      // Gone already: another run removed it meanwhile.
      if (!isAbsenceFailure(error)) refusedWrite(error, "lock-path-leftover");
    }
  }
  try {
    await fsp.mkdir(paths.lock);
  } catch (error) {
    // EEXIST: another run made it meanwhile, examined again. ENOENT,
    // ENOTDIR: the area changed meanwhile, established again.
    const code = errorCode(error);
    if (code === "EEXIST" || code === "ENOENT" || code === "ENOTDIR") {
      return "again";
    }
    refusedWrite(error, "lock-directory");
  }
  held.lockDirectory = true;
  return "done";
}

/**
 * Step 3 (SPEC 13.5): add this run's entry — created exclusively, empty,
 * named by the process identifier and a fresh random token (module
 * header).
 */
async function addEntry(paths: LockPaths, held: Established): Promise<Step> {
  const name = `${String(process.pid)}-${randomBytes(16).toString("hex")}`;
  const entryPath = path.join(paths.lock, name);
  let handle: fsp.FileHandle;
  try {
    handle = await fsp.open(entryPath, "wx");
  } catch (error) {
    // ENOENT, ENOTDIR: the lock directory went meanwhile — another run's
    // release deleted it emptied — so it is established again. EEXIST: the
    // name is borne already, drawn afresh.
    const code = errorCode(error);
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EEXIST") {
      return "again";
    }
    refusedWrite(error, "entry");
  }
  held.entry = { path: entryPath, name: Buffer.from(name) };
  // The entry exists once created; its content is opaque (13.4), so a
  // failure to close the empty file changes nothing.
  await handle.close().catch(() => undefined);
  return "done";
}

/**
 * The kind of a name the lock directory's listing returned: from the
 * listing itself, or — where the filesystem reports no type — examined
 * without following a link, `absent` when it is gone since (SPEC 13.5:
 * acquisition examines occupants' kinds, never content). A refused kind
 * read concerns the lock path (14.25).
 */
async function listedKind(
  lock: string,
  listed: Dirent<Buffer>,
): Promise<"absent" | "file" | "other"> {
  if (listed.isFile()) return "file";
  if (
    listed.isDirectory() ||
    listed.isSymbolicLink() ||
    listed.isFIFO() ||
    listed.isSocket() ||
    listed.isBlockDevice() ||
    listed.isCharacterDevice()
  ) {
    return "other";
  }
  const kind = await occupantKind(childPath(lock, listed.name), LOCK_PATH);
  if (kind === "absent") return "absent";
  return kind === "file" ? "file" : "other";
}

/** A lock-directory member's absolute path, as bytes (non-UTF-8 names). */
function childPath(lock: string, name: Buffer): Buffer {
  return Buffer.concat([Buffer.from(lock), SLASH, name]);
}

/**
 * The process identifier a plain file's name in the lock directory
 * records, or null when the name records none — no entry form, or an
 * identifier no process list can hold (SPEC 13.5).
 */
function recordedIdentifier(name: Buffer): number | null {
  const match = ENTRY_NAME.exec(name.toString("latin1"));
  if (match === null) return null;
  const identifier = Number(match[1]);
  return identifier <= MAX_PROCESS_IDENTIFIER ? identifier : null;
}

/**
 * Whether an identifier is listed in this process's process list (SPEC
 * 13.5): a signal-0 probe that succeeds, or that the environment refuses
 * for permission — another user's process, listed all the same.
 */
function listedInProcessList(identifier: number): boolean {
  try {
    process.kill(identifier, 0);
    return true;
  } catch (error) {
    return errorCode(error) === "EPERM";
  }
}

/**
 * Steps 4–6 (SPEC 13.5): list the lock directory once, judge every name
 * but this run's own — a plain file recording another identifier still
 * listed refuses acquisition, the busy refusal of 14.26, before anything
 * is removed — then remove the plain-file leftovers among the names that
 * listing returned (module header).
 */
async function settleLockDirectory(
  paths: LockPaths,
  held: Established,
  own: Buffer,
): Promise<Step> {
  let listing: Dirent<Buffer>[];
  try {
    listing = await fsp.readdir(paths.lock, {
      withFileTypes: true,
      encoding: "buffer",
    });
  } catch (error) {
    if (isAbsenceFailure(error)) {
      // The lock directory, and this run's entry with it, went meanwhile
      // (deleted by hand, 13.5's interference): established again.
      held.entry = null;
      return "again";
    }
    refusedRead(error, LOCK_PATH, "listing");
  }
  const leftovers: Buffer[] = [];
  for (const listed of listing) {
    if (Buffer.compare(listed.name, own) === 0) continue;
    const kind = await listedKind(paths.lock, listed);
    if (kind !== "file") continue;
    const identifier = recordedIdentifier(listed.name);
    if (
      identifier !== null &&
      identifier !== process.pid &&
      listedInProcessList(identifier)
    ) {
      // SPEC 13.5, 14.26: another run's entry, alive on this machine (or
      // in 13.5's gap) — refused promptly, no leftover removed.
      throw workspaceBusy();
    }
    leftovers.push(listed.name);
  }
  for (const name of leftovers) {
    try {
      await fsp.unlink(childPath(paths.lock, name));
    } catch (error) {
      // Gone already: another run removed it meanwhile.
      if (!isAbsenceFailure(error)) refusedWrite(error, "leftover");
    }
  }
  return "done";
}

/**
 * Acquire workspace exclusivity (SPEC 13.5; module header), recording in
 * `held` what was established so that release, which the caller runs on
 * every normal end, undoes exactly that — also when acquisition itself
 * throws: the busy refusal (14.26), or a read or write failure met at
 * acquisition (14.25, 14.24).
 */
async function acquireExclusivity(
  paths: LockPaths,
  held: Established,
): Promise<void> {
  for (let round = 0; round < MAX_ESTABLISH_ROUNDS; round += 1) {
    if ((await establishArea(paths, held)) === "again") continue;
    if ((await establishLockDirectory(paths, held)) === "again") continue;
    if ((await addEntry(paths, held)) === "again") continue;
    const entry = held.entry;
    if (entry === null) continue;
    if ((await settleLockDirectory(paths, held, entry.name)) === "again") {
      continue;
    }
    return;
  }
  // Other runs' acquisitions and releases kept changing the lock directory
  // past the bound: refused promptly, as overlapping runs may all be
  // (SPEC 13.5, 14.26).
  throw workspaceBusy();
}

/**
 * Release (SPEC 13.5; module header): delete this run's entry, then the
 * lock directory, then the area's directory where this acquisition created
 * it — each deletion attempted once, reading nothing, a refused deletion or
 * one finding nothing changing no outcome (14.24).
 */
async function releaseExclusivity(
  paths: LockPaths,
  held: Established,
): Promise<void> {
  const entry = held.entry;
  if (entry !== null) await deleteQuietly(() => fsp.unlink(entry.path));
  if (held.lockDirectory) await deleteQuietly(() => fsp.rmdir(paths.lock));
  if (held.areaCreated) await deleteQuietly(() => fsp.rmdir(paths.area));
}

/**
 * One deletion of release: whatever the environment answers, the outcome
 * stands (SPEC 13.5, 14.24) — a directory still holding something, a
 * refused deletion, or nothing to delete alike.
 */
async function deleteQuietly(deletion: () => Promise<void>): Promise<void> {
  try {
    await deletion();
  } catch {
    // Left as it is (SPEC 13.5): a leftover, or an emptied directory.
  }
}

export type HoldResult =
  { readonly ok: true } | { readonly ok: false; readonly usageMessage: string };

/**
 * The `--test-hold` seam (SPEC 13.5): immediately after acquiring workspace
 * exclusivity and before modifying anything, create an empty file at the
 * given path — creation MUST fail if anything, a symbolic link included,
 * already exists there — then proceed only once that file has been deleted.
 * `createTestHoldFile` performs the exclusive creation; any failure is the
 * usage error of 13.5/12.0 (the caller releases and modifies nothing). The
 * seam changes no other behavior and grants no access beyond the invoking
 * user's own file permissions: the file is created with the process's
 * ordinary permissions, at a path resolved against the working directory
 * (SPEC 12.0), with no directory creation.
 */
export async function createTestHoldFile(
  absolutePath: string,
  given: string,
): Promise<HoldResult> {
  let handle: fsp.FileHandle;
  try {
    // O_CREAT|O_EXCL ('wx'): fails when anything — a plain file, a
    // directory, a symbolic link even dangling — occupies the path, and
    // never creates through a link (SPEC 13.5).
    handle = await fsp.open(absolutePath, "wx");
  } catch {
    return {
      ok: false,
      usageMessage:
        `cannot create the --test-hold file at '${given}' — the hold file ` +
        `is created exclusively and creation fails if anything, a symbolic ` +
        `link included, already exists at the path (SPEC 13.5)`,
    };
  }
  await handle.close();
  return { ok: true };
}

/**
 * Wait until the hold file has been deleted (SPEC 13.5: the command
 * proceeds normally only once that file has been deleted). Polls; no
 * timeout — the deleting side owns the schedule.
 */
export async function awaitTestHoldRelease(
  absolutePath: string,
): Promise<void> {
  for (;;) {
    try {
      await fsp.lstat(absolutePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") return;
      // Transient stat failure: keep waiting rather than proceed early.
    }
    await delay(HOLD_POLL_MS);
  }
}

/** The `--test-hold <path>` value: as given, and resolved against cwd. */
export interface TestHoldSpec {
  /** The flag value verbatim, for diagnostics (argv tokens only, SPEC 12.0). */
  readonly given: string;
  /** The value resolved against the working directory (SPEC 12.0). */
  readonly absolutePath: string;
}

export type ExclusiveRunResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly usageMessage: string };

/**
 * Run a mutating command's operation under workspace exclusivity (SPEC
 * 13.5): acquire it in the workspace's lock directory — the busy refusal of
 * 14.26, or acquisition's read or write failure (14.25, 14.24), thrown
 * there — then, when `--test-hold` was given, create the hold file and
 * proceed only once it has been deleted, then run `body`; release follows
 * on every normal end, a throw from acquisition or `body` included. A
 * failure to create the hold file returns the code-less usage error with
 * nothing modified. The hold file itself is never deleted here: its
 * deletion is the external release signal.
 */
export async function withMutationExclusivity<T>(
  root: string,
  hold: TestHoldSpec | undefined,
  body: () => Promise<T>,
): Promise<ExclusiveRunResult<T>> {
  const paths = lockPathsOf(root);
  const held: Established = {
    areaCreated: false,
    lockDirectory: false,
    entry: null,
  };
  try {
    await acquireExclusivity(paths, held);
    if (hold !== undefined) {
      const created = await createTestHoldFile(hold.absolutePath, hold.given);
      if (!created.ok) return created;
      await awaitTestHoldRelease(hold.absolutePath);
    }
    return { ok: true, value: await body() };
  } finally {
    await releaseExclusivity(paths, held);
  }
}
