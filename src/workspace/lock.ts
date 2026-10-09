// Workspace mutual exclusion and the `--test-hold` seam (SPEC 13.5).
//
// IMPLEMENTATION (Architecture): the workspace layer owns workspace mutual
// exclusion. SPEC 13.5: commands that modify sources or durable files —
// `rename`, `move`, and the mutating `review` subcommands (`create`,
// `resolve`, `split`) — are mutually exclusive per workspace: while one
// runs, another MUST fail promptly with a usage error (12.0) without
// modifying anything. Exclusivity ends when the holding command's process
// terminates, normally or abnormally; a terminated holder MUST NOT block
// later commands. All other commands never touch this module.
//
// Mechanism — a liveness-checked lock file outside the workspace tree:
//
// - Location: the OS temporary directory, keyed by the SHA-256 of the
//   workspace root's canonical (realpath) absolute path and scoped to the
//   invoking user. Keying by canonical root makes exclusion per workspace —
//   instances operating on different workspaces MUST NOT interfere (SPEC
//   13.5), and one workspace reached through different path spellings still
//   maps to one lock.
// - Outside the tree, deliberately: a refused command modifies nothing, and
//   a holding command modifies nothing before the `--test-hold` seam — as
//   observed by concurrent readers of the workspace, whole tree included
//   (SPEC 13.5 gives readers a byte-consistent view at every moment). A
//   lock file inside the workspace would itself be such a modification.
//   The lock is transient cross-process coordination, not workspace state:
//   the state SPEC 13.3/13.4 make workspace-local (graph data, derived
//   files, durable files) all stays under the root.
// - Liveness, not mere existence: the lock file records the holder's
//   process ID, and an existing lock whose recorded process is no longer
//   alive is stale — taken over, never honored. A bare lock file would
//   outlive an abnormally terminated holder and block later commands,
//   which SPEC 13.5 forbids ("a terminated holder MUST NOT block").
//   Release on normal completion unlinks the file eagerly.
// - Takeover is single-winner: a stale lock is displaced by an atomic
//   rename to a stealer-private name, so of several concurrent takeover
//   attempts exactly one wins the rename (the others see ENOENT and
//   re-evaluate); the winner re-verifies the displaced content before
//   proceeding and restores a lock it displaced wrongly. Acquisition is
//   bounded: it either acquires, or fails promptly with the usage error —
//   it never blocks (SPEC 13.5, 12.0).
// - An unusable lock location — the temporary directory missing, not a
//   directory, unwritable, or full, or the lock's path occupied by
//   something other than a plain file — fails the command with a usage
//   error (12.0) naming the cause, modifying nothing, as a hold file that
//   cannot be created does (13.5); never the internal-error exit, which
//   lies outside 12.0's exit partition. Every exit stays within it: a
//   release the environment refuses is left to the stale-lock takeover
//   (the entry records a process that is dead once this one exits).
//
// Conservative notes (IMPLEMENTATION: where the documents are silent,
// choose conservatively): process-ID liveness is the standard lock-file
// discipline; a recycled process ID can in principle make a dead holder
// look alive until the recycling process exits — never blocking forever,
// and never losing an append, which is the side SPEC 13.5 guards
// ("concurrency never loses a journal append or a resolution").
// The user-scoped lock name confines exclusion to the invoking user's own
// processes; the seam likewise "grants no access beyond the invoking
// user's own file permissions" (SPEC 13.5).
// Reach, an open conflict pending a SPEC decision: only the mutating
// commands sharing the invoking user and the temporary directory find
// this lock, while SPEC 13.5 excludes every process operating on the
// workspace. No location outside the workspace is shared that widely, and
// the workspace holds no lock entry: 13.4 classifies every file xspec
// writes there as derived or durable, and a held command leaves the
// workspace untouched.

import { createHash } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

/** SPEC 13.5/12.0: the prompt refusal while another mutating command runs. */
const HELD_MESSAGE =
  "another mutating command is running in this workspace — `rename`, " +
  "`move`, and the mutating `review` subcommands are mutually exclusive " +
  "per workspace; retry once it completes (SPEC 13.5)";

/**
 * SPEC 13.5/12.0: the usage error when the lock cannot be kept where it
 * lives. Fixed text: no path and no error code, both environment-dependent
 * content (12.0); the variables named are the ones Node.js reads for the
 * temporary directory on every platform.
 */
const UNUSABLE_MESSAGE =
  "cannot acquire workspace exclusivity — the per-workspace lock that " +
  "`rename`, `move`, and the mutating `review` subcommands take lives in " +
  "the operating system's temporary directory (named by TMPDIR, TMP, or " +
  "TEMP), and it can be neither created nor taken over there: the " +
  "directory is missing, not a directory, unwritable, or full, or the " +
  "lock's path is occupied by something other than a lock file; point the " +
  "temporary directory at a writable directory and retry; nothing was " +
  "modified (SPEC 13.5)";

/** SPEC 13.5/12.0: the lock is keyed by the root's canonical path. */
const UNRESOLVABLE_ROOT_MESSAGE =
  "cannot acquire workspace exclusivity — the workspace root's canonical " +
  "path, which keys the per-workspace lock, cannot be resolved; nothing " +
  "was modified (SPEC 13.5)";

/** Bounded acquisition: fail promptly rather than ever block (SPEC 13.5). */
const MAX_ACQUIRE_ATTEMPTS = 10;

/**
 * Grace before treating a content-less lock file as stale: a live acquirer
 * writes its process ID immediately after creating the file, so an entry
 * unreadable twice, this far apart, is a crash remnant (or foreign junk),
 * not a lock mid-write.
 */
const UNREADABLE_GRACE_MS = 25;

/** Poll cadence while waiting for the hold file's deletion (SPEC 13.5). */
const HOLD_POLL_MS = 10;

/** An acquired lock: `release` unlinks it on normal completion. */
export interface MutationLock {
  release(): Promise<void>;
}

export type AcquireResult =
  | { readonly ok: true; readonly lock: MutationLock }
  | { readonly ok: false; readonly usageMessage: string };

/**
 * The lock file's absolute path for a workspace root: in the OS temporary
 * directory, named by the invoking user's ID and the SHA-256 of the root's
 * canonical absolute path (UTF-8). Per-workspace by construction (SPEC
 * 13.5: instances on different workspaces never interfere).
 */
export async function mutationLockPath(root: string): Promise<string> {
  const canonical = await fsp.realpath(root);
  const digest = createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex")
    .slice(0, 32);
  const uid = process.getuid?.() ?? "u";
  return path.join(os.tmpdir(), `xspec-${String(uid)}-${digest}.lock`);
}

/** Whether a process with this ID is alive (EPERM = alive, foreign owner). */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Whether a filesystem error says nothing occupies the path. */
function isAbsence(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * The process ID a lock file records, or null when the plain file there is
 * unreadable or does not hold a well-formed entry, or "absent" when nothing
 * occupies the path (the holder released, or a rival stole it), or
 * "unusable" when the occupant is no plain file — a directory, a symbolic
 * link (never followed), anything else — or its kind cannot be read: no
 * lock, and nothing this command may displace.
 */
async function readLockHolder(
  lockPath: string,
): Promise<number | null | "absent" | "unusable"> {
  try {
    const stats = await fsp.lstat(lockPath);
    if (!stats.isFile()) return "unusable";
  } catch (error) {
    return isAbsence(error) ? "absent" : "unusable";
  }
  let text: string;
  try {
    text = await fsp.readFile(lockPath, "utf8");
  } catch (error) {
    if (isAbsence(error)) return "absent";
    return null; // an unreadable plain file: judged like a malformed entry
  }
  const match = /^([0-9]{1,15})\n?$/.exec(text);
  if (match === null) return null;
  const pid = Number.parseInt(match[1]!, 10);
  return pid > 0 ? pid : null;
}

/**
 * Displace a stale lock file: atomically rename it to a stealer-private
 * name (exactly one concurrent stealer wins the rename), re-verify that
 * what was displaced really was the stale entry, and remove it. When the
 * displaced content turns out to belong to a live holder — the file was
 * replaced between the staleness verdict and the rename — restore it if
 * the lock path is still free. Returns "freed" when the path was freed for
 * this caller, "retry" when the next attempt must re-evaluate the path,
 * and "unusable" when the environment refuses the displacement itself.
 */
async function stealStaleLock(
  lockPath: string,
): Promise<"freed" | "retry" | "unusable"> {
  const privatePath = `${lockPath}.steal-${String(process.pid)}`;
  try {
    await fsp.rename(lockPath, privatePath);
  } catch (error) {
    // Nothing there: a rival stealer won, or the holder released —
    // re-evaluate. Any other refusal leaves the stale entry in place.
    return isAbsence(error) ? "retry" : "unusable";
  }
  const displaced = await readLockHolder(privatePath);
  if (heldByLiveRival(displaced)) {
    // Displaced a live lock (replaced under us): restore without ever
    // clobbering a rival's fresh lock — link creates only when the path is
    // free.
    try {
      await fsp.link(privatePath, lockPath);
    } catch {
      // The path was re-occupied meanwhile; the live holder's entry cannot
      // be restored without displacing the new one. Fall through: the next
      // attempt re-evaluates whatever now holds the path.
    }
    await removeQuietly(privatePath);
    return "retry";
  }
  await removeQuietly(privatePath);
  return "freed";
}

/**
 * Whether a recorded holder is a live process other than this one. This
 * process records its own ID only once it has acquired, so an entry naming
 * it during acquisition is a dead predecessor's whose ID was reused: stale.
 */
function heldByLiveRival(
  holder: number | null | "absent" | "unusable",
): boolean {
  return (
    typeof holder === "number" && holder !== process.pid && processAlive(holder)
  );
}

/**
 * Remove a lock-area file, best effort: a removal the environment refuses
 * leaves an entry this command no longer needs — a displaced stale entry
 * under a private name, or its own entry, which records a process that is
 * dead once this one exits and is then taken over (SPEC 13.5).
 */
async function removeQuietly(filePath: string): Promise<void> {
  try {
    await fsp.rm(filePath, { force: true });
  } catch {
    // Left in place (above).
  }
}

/**
 * Acquire workspace exclusivity for a mutating command (SPEC 13.5), or
 * fail promptly — never block — with the usage-error message (12.0) when
 * another mutating command holds the workspace. Callers acquire before
 * modifying any source or durable file and release on completion; a killed
 * holder releases by dying (the next acquirer detects the dead process and
 * takes the lock over). A lock location the environment makes unusable is
 * the same usage error class with its own message (module header): every
 * outcome stays within 12.0's exit partition.
 */
export async function acquireMutationLock(
  root: string,
): Promise<AcquireResult> {
  let lockPath: string;
  try {
    lockPath = await mutationLockPath(root);
  } catch {
    return { ok: false, usageMessage: UNRESOLVABLE_ROOT_MESSAGE };
  }
  const entry = `${String(process.pid)}\n`;
  // The refusal to report should every bounded attempt fail: the last
  // obstacle met — a holder (pathological contention) or an unusable
  // location. An unusable location is retried within the bound, since a
  // refusal can be momentary (a name whose removal is still pending).
  let refusal = HELD_MESSAGE;
  for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
    let handle: fsp.FileHandle;
    try {
      // O_CREAT|O_EXCL: atomic claim — fails on any occupant.
      handle = await fsp.open(lockPath, "wx");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        refusal = UNUSABLE_MESSAGE; // the directory refuses the creation
        await delay(UNREADABLE_GRACE_MS);
        continue;
      }
      let holder = await readLockHolder(lockPath);
      if (holder === null) {
        // Possibly a lock whose process-ID write is a moment away: give a
        // live acquirer far more time than the create-to-write window
        // before judging the entry a crash remnant.
        await delay(UNREADABLE_GRACE_MS);
        holder = await readLockHolder(lockPath);
      }
      if (holder === "absent") continue; // released meanwhile: retry
      if (holder === "unusable") {
        refusal = UNUSABLE_MESSAGE; // no lock there, and nothing to displace
        await delay(UNREADABLE_GRACE_MS);
        continue;
      }
      if (heldByLiveRival(holder)) {
        // SPEC 13.5: fail promptly with a usage error, modifying nothing.
        return { ok: false, usageMessage: HELD_MESSAGE };
      }
      // A terminated holder MUST NOT block later commands (SPEC 13.5).
      // A freed path is progress, not an obstacle: the refusal stays the
      // last obstacle met (an entry-less claim of this command's own, say).
      const stolen = await stealStaleLock(lockPath);
      if (stolen === "unusable") {
        refusal = UNUSABLE_MESSAGE;
        await delay(UNREADABLE_GRACE_MS);
      } else if (stolen === "retry") {
        refusal = HELD_MESSAGE; // a rival moved first: contention
      }
      continue;
    }
    if (!(await writeLockEntry(handle, entry))) {
      // The claim is made but its entry cannot be recorded. The entry-less
      // file is left as it is — removing it by path could remove a rival's
      // fresh lock — and is judged a crash remnant after the grace, then
      // taken over (by the next attempt here, or by a later command).
      refusal = UNUSABLE_MESSAGE;
      await delay(UNREADABLE_GRACE_MS);
      continue;
    }
    return {
      ok: true,
      lock: {
        release: async () => {
          // Owner-checked release: unlink only our own entry, never a
          // successor's (a stale takeover can only follow our death, but
          // the check costs nothing and guards the pathological case).
          // Best effort: a refused removal leaves an entry that is stale
          // once this process exits (removeQuietly).
          if ((await readLockHolder(lockPath)) === Number(process.pid)) {
            await removeQuietly(lockPath);
          }
        },
      },
    };
  }
  // Still prompt: the bound reached, never a block (SPEC 13.5).
  return { ok: false, usageMessage: refusal };
}

/**
 * Write this process's entry into the lock file just claimed and close it;
 * false when the environment refuses the write (exhausted storage, an I/O
 * error), the handle closed either way.
 */
async function writeLockEntry(
  handle: fsp.FileHandle,
  entry: string,
): Promise<boolean> {
  let written = true;
  try {
    await handle.writeFile(entry);
  } catch {
    written = false;
  }
  try {
    await handle.close();
  } catch {
    written = false;
  }
  return written;
}

export type HoldResult =
  { readonly ok: true } | { readonly ok: false; readonly usageMessage: string };

/**
 * The `--test-hold` seam (SPEC 13.5): immediately after acquiring workspace
 * exclusivity and before modifying anything, create an empty file at the
 * given path — creation MUST fail if anything, a symbolic link included,
 * already exists there — then proceed only once that file has been deleted.
 * `createTestHoldFile` performs the exclusive creation; any failure is the
 * usage error of 13.5/12.0 (the caller releases the lock and modifies
 * nothing). The seam changes no other behavior and grants no access beyond
 * the invoking user's own file permissions: the file is created with the
 * process's ordinary permissions, at a path resolved against the working
 * directory (SPEC 12.0), with no directory creation.
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
 * 13.5): acquire the workspace's mutation lock — failing promptly with the
 * usage error when another mutating command runs — then, when `--test-hold`
 * was given, create the hold file and proceed only once it has been
 * deleted, then run `body`, releasing the lock on every completion path.
 * A failure to create the hold file releases the lock and returns the
 * usage error with nothing modified. The hold file itself is never deleted
 * here: its deletion is the external release signal.
 */
export async function withMutationExclusivity<T>(
  root: string,
  hold: TestHoldSpec | undefined,
  body: () => Promise<T>,
): Promise<ExclusiveRunResult<T>> {
  const acquired = await acquireMutationLock(root);
  if (!acquired.ok) return acquired;
  try {
    if (hold !== undefined) {
      const created = await createTestHoldFile(hold.absolutePath, hold.given);
      if (!created.ok) return created;
      await awaitTestHoldRelease(hold.absolutePath);
    }
    return { ok: true, value: await body() };
  } finally {
    await acquired.lock.release();
  }
}
