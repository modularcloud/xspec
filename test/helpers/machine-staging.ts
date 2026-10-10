// 13.5's machine-wide stagings — I: the second user, the second mount, and
// the launcher that starts runs as the second user (TEST-SPEC H-2, E-1, E-3,
// T13.5-9; H-11); II: fresh process-identifier namespaces and the two
// launchers that start runs in them (T13.5-10(e)–(g), T13.5-3). Harness
// machinery only: no product imports, no test framework dependence.
//
// - Administrative access (E-1). These stagings are made with the
//   administrative access GitHub's hosted Linux runners grant the job —
//   passwordless `sudo`, kept by .github/scripts/run-without-network.sh —
//   outside every product invocation, which stays unprivileged.
//   `requireAdministrativeAccess` runs `sudo -n true` and requires it to exit
//   0 and print nothing (a word from `sudo` would land on the stderr of every
//   run launched through it); anything else is the harness error
//   `HarnessStagingError` (mode `administrative-access`), never a skip (H-9).
//   Every staging here checks it first.
// - The second user (T13.5-9, E-3): an unprivileged identity distinct from
//   the harness's, named `SECOND_USER_NAME`, whose primary group is the
//   harness's own primary group — the group they share. `ensureSecondUser`
//   makes it idempotently: an existing account is reused as found, a missing
//   one is made with `useradd` (no home, no group of its own, no login
//   shell). Concurrent makers — other suite instances on the machine — are
//   serialized by `flock` on `SECOND_USER_LOCK`, the check and the creation
//   one step under it: `useradd` checks the name before it locks the account
//   files, so two unserialized makers may both add it, the later
//   overwriting the earlier's uid (seen on a hosted runner). A failed step
//   is retried, bounded, while the account is still missing. It is never
//   removed. An account bearing the harness's or root's uid, or sharing no
//   group with the harness, is a staging error (mode `second-user`).
// - Group access (T13.5-9): `stageGroupAccess` makes a workspace reachable
//   through the shared group — its plain files group-readable and
//   group-writable, its directories group-listable, group-writable, and
//   group-searchable, and every directory above the root the harness owns
//   group-searchable (`mkdtemp` makes a workspace's temporary directory
//   0700) — recording every mode it changes, which `restore` reinstates (the
//   test undoes the staging). Symbolic links are never followed or changed;
//   entries made after the staging keep the modes their makers gave them.
// - The second mount (T13.5-9, E-3): `stageSecondMount` bind-mounts a root at
//   a second path unique to the suite instance — a fresh directory under one
//   the caller names, the workspace's own temporary directory — with
//   `sudo -n mount --bind`, verifies it (`verifySecondMount`), and `remove`
//   unmounts it and removes its directory (each test removes its own).
//   Mounts stay inside the mount namespace the harness runs in, which CI's
//   wrapper makes private: every process of the run sees them, through
//   `sudo` included, and nothing outside does. `verifySecondMount` reads
//   `/proc/self/mountinfo`, a bind mount sharing its source's device number
//   (so `st_dev` proves nothing): the second path must be a mount point, the
//   root must lie on another mount, and a file the harness creates through
//   either path must appear through the other.
// - The launcher (H-2): `secondUserLauncher` builds the subprocess driver's
//   `RunLauncher` for the second user. `sudo -n` runs as root a `sh` that
//   sets the harness's umask and execs `prlimit`, which restores every
//   resource limit the harness's own process has (sudo resets them; a run the
//   harness started directly would inherit them) and execs `setpriv`, which
//   drops to the second user's uid, the shared group, and the account's
//   supplementary groups, with the inheritable and bounding capability sets
//   cleared and so no capability left, and execs `env -i`, which gives the
//   run exactly the environment the driver built for it (sudo resets the
//   environment; nothing of its own — no `SUDO_*` variable — reaches the
//   run). Each stage execs the next, so the product is the process `sudo`
//   forks, in the process group `sudo` leads — the run's own, as the
//   driver's `processGroup` makes it — and its exit code, stdout, and stderr
//   are the run's, captured by the driver as any run's. Its processes are
//   root's and the second user's, which the harness's own identity may not
//   signal: the launcher kills the group with `sudo -n kill -s KILL --
//   -<group>`.
// - Verifications (T13.5-9, H-11): `verifySecondUserReach` runs a probe as
//   the second user through the launcher — harness machinery started like
//   any run, from a scratch directory outside every workspace root. Its uid
//   must differ from the harness's; it must list every directory and read
//   every file under the root (the configuration and every discovered source
//   among them), create and remove a file in each directory named (the root
//   and `.xspec`), and execute and read the binding's command and required
//   files; and its process list must list the harness's process while the
//   harness's own lists the probe's (13.5's one machine). Any failure is
//   `HarnessStagingError` (mode `second-user`), never a pass or a skip.
//   `secondUserCreatesIn` answers, without judging, whether the second user
//   can create and remove a file in one directory — T13.5-9 asks it again
//   once the holder is held, where a refusal is no staging error.
// - Fresh process-identifier namespaces (T13.5-10(e)–(g); E-1, E-3). Made
//   with `sudo` like the stagings above, outside every product invocation,
//   each run in one dropping back to the harness's own uid, gid, and
//   supplementary groups with every capability set empty (`setpriv`), with
//   the harness's umask and resource limits and exactly the driver's
//   environment (as the second user's launcher gives them). A namespace has
//   no path: each is its test's own and ends with it (E-3).
//   - Launcher A (`freshNamespaceLauncher`; (f), (g)): `unshare --pid --fork
//     --mount-proc` starts each run as the first process — identifier 1 —
//     of a fresh namespace with a process list of its own (a fresh `/proc`
//     in a mount namespace of its own, the working directory kept). It is
//     verified on the harness once per command before use: a probe started
//     through it must see itself as identifier 1 and nothing else listed,
//     as the harness's identity with no capability.
//   - Launcher B (`openHarnessNamespace`; (e)'s run on another machine): a
//     namespace made the same way whose first process is the harness's own
//     — a bash running builtins alone, so it forks nothing and allocates no
//     identifier there, and, as that namespace's reaper, reaps every orphan
//     — outliving the commands entered into it with `nsenter` (its
//     process-identifier and mount namespaces, the working directory
//     resolved there). It opens verified fresh: the first process alone
//     listed, the last identifier allocated its own. Through it the harness
//     reads the namespace's process list and the identifier it allocated
//     last (`ns_last_pid`) without disturbing either (`observe`); allocation
//     being cyclic, `hasAllocated` answers (e)'s reuse check from them.
//   - Observations from the harness's side: a run's in-namespace
//     identifiers (`inNamespaceIdentifiers`, from `/proc/<pid>/status`'s
//     NSpid lines: the field one level below the harness's own), and the
//     harness's own process list (helpers/kill-discipline.ts).
//   - Kills: a run through either launcher leads its own process group, as
//     every launched run does, and is killed through `sudo` (SIGKILL to the
//     group); SIGKILL reaches a namespace's first process from outside,
//     whose death ends every process in its namespace (T13.5-3); `killGroup`
//     confirms them all gone, as does the harness namespace's `close`.
//   - Verifications on the harness (H-11), each `HarnessStagingError` (mode
//     `pid-namespace`) when ineffective, the void and rerun rules left to
//     the arms: (e)'s `verifyNamespaceListsNone` (the namespace lists no
//     identifier the holder's processes bear), (g)'s `verifyListedByHarness`
//     (the harness's process list lists every in-namespace identifier the
//     held run's processes bear or bore), and a run lying in no namespace
//     below the harness's (`inNamespaceIdentifiers`).
// - Platform: the Linux leg's. On any other platform every staging throws
//   `HarnessStagingError` at once.

import { Buffer } from "node:buffer";
import { execFile, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import {
  confirmGroupGone,
  DEFAULT_GROUP_GONE_TIMEOUT_MS,
  descendantsOf,
  listedAmong,
  ProcessGroupLingerError,
  processGroupMembers,
} from "./kill-discipline.js";
import { HarnessStagingError } from "./permissions.js";
import type { StagingMode } from "./permissions.js";
import { startProduct, summarizeResult } from "./subprocess.js";
import type { ProductBinding, RunLauncher, RunResult } from "./subprocess.js";

const execFileAsync = promisify(execFile);

/** The second user's fixed name (E-3: made idempotently, never removed). */
export const SECOND_USER_NAME = "xspec-second";
/** The command administrative access is reached through (E-1). */
export const DEFAULT_SUDO = "sudo";

/** Bound on one administrative or lookup command. */
const COMMAND_TIMEOUT_MS = 60_000;
/**
 * The lock serializing the second user's check-and-create across every
 * harness instance on the machine (E-3). `useradd` checks the name before it
 * locks the account files, so two makers running at once may both add it,
 * the later overwriting the earlier's uid under a reader's feet (seen on a
 * hosted runner: makers read uids 1003 and 1004). A root-owned file in the
 * machine's lock directory, made by `flock` on first use, never removed.
 */
export const SECOND_USER_LOCK = "/run/lock/xspec-second-user.lock";
/** Bound on waiting for {@link SECOND_USER_LOCK}. */
const SECOND_USER_LOCK_WAIT_SECONDS = 60;
/** `useradd` attempts before a missing second user is a staging error. */
const USERADD_ATTEMPTS = 5;
/** `umount` attempts before a busy second mount is a staging error. */
const UMOUNT_ATTEMPTS = 10;
/** Bound on the second user's probe reporting, and on its release. */
const PROBE_TIMEOUT_MS = 60_000;
const SLASH = Buffer.from("/");
const SLASH_BYTE = 0x2f;

/** The harness's own uid and gid (POSIX; the Linux leg's). */
function harnessIds(): { readonly uid: number; readonly gid: number } {
  if (process.getuid === undefined || process.getgid === undefined) {
    throw new Error(
      `13.5's machine-wide stagings are the Linux leg's (TEST-SPEC E-1); this platform (${process.platform}) has no uid or gid`,
    );
  }
  return { uid: process.getuid(), gid: process.getgid() };
}

function requireLinux(mode: StagingMode, what: string): void {
  if (process.platform !== "linux") {
    throw new HarnessStagingError(
      mode,
      what,
      `13.5's machine-wide stagings are the Linux leg's (TEST-SPEC E-1); this platform is ${process.platform}`,
    );
  }
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/** How a command ended: its exit code (or spawn failure), stdout, stderr. */
interface CommandOutcome {
  /** The exit code; a spawn failure's code (`ENOENT`); null if killed. */
  readonly code: number | string | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run `file` with `args` (no shell), never throwing. */
async function runCommand(
  file: string,
  args: readonly string[],
): Promise<CommandOutcome> {
  try {
    const { stdout, stderr } = await execFileAsync(file, [...args], {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      encoding: "utf8",
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      code: failure.code ?? null,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr || (failure.message ?? ""),
    };
  }
}

function describeOutcome(outcome: CommandOutcome): string {
  const ended =
    typeof outcome.code === "number"
      ? `exit ${String(outcome.code)}`
      : outcome.code === null
        ? "killed"
        : `failed to start (${outcome.code})`;
  return `${ended}; stdout: ${JSON.stringify(outcome.stdout.slice(0, 600))}; stderr: ${JSON.stringify(outcome.stderr.slice(0, 600))}`;
}

/** `sudo -n -- <args>`: an administrative command (E-1). */
async function runAdministrative(
  args: readonly string[],
): Promise<CommandOutcome> {
  return await runCommand(DEFAULT_SUDO, ["-n", "--", ...args]);
}

/**
 * A memoized asynchronous value whose failure is forgotten, so the next
 * caller asks again.
 */
function memoized<T>(compute: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return async () => {
    pending ??= compute();
    const current = pending;
    try {
      return await current;
    } catch (error) {
      if (pending === current) pending = undefined;
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Administrative access (E-1)

/** Which command administrative access is reached through. */
export interface AdministrativeAccessOptions {
  /**
   * `sudo` by default; a self-test names another command to stage access
   * withheld (missing, refusing, or not silent) without touching `sudo`.
   */
  readonly sudo?: string;
}

const accessChecks = new Map<string, () => Promise<void>>();

/**
 * E-1: the administrative access 13.5's machine-wide stagings are made with
 * — `<sudo> -n true` exiting 0 and printing nothing — or the harness error
 * `HarnessStagingError` (mode `administrative-access`), never a skip (H-9).
 * A success is remembered per command; a failure is asked again next time.
 */
export async function requireAdministrativeAccess(
  options: AdministrativeAccessOptions = {},
): Promise<void> {
  const sudo = options.sudo ?? DEFAULT_SUDO;
  let check = accessChecks.get(sudo);
  if (check === undefined) {
    check = memoized(() => checkAdministrativeAccess(sudo));
    accessChecks.set(sudo, check);
  }
  await check();
}

async function checkAdministrativeAccess(sudo: string): Promise<void> {
  requireLinux("administrative-access", sudo);
  const outcome = await runCommand(sudo, ["-n", "true"]);
  if (outcome.code !== 0) {
    throw new HarnessStagingError(
      "administrative-access",
      sudo,
      `\`${sudo} -n true\` did not succeed (${describeOutcome(outcome)}): 13.5's machine-wide stagings (T13.5-9's second user and second mount; T13.5-10(e)–(g)'s fresh process-identifier namespaces) are made with the administrative access GitHub's hosted Linux runners grant the job (TEST-SPEC E-1, H-2); a runner withholding it fails them as a harness error, never a skip (H-9)`,
    );
  }
  if (outcome.stdout !== "" || outcome.stderr !== "") {
    throw new HarnessStagingError(
      "administrative-access",
      sudo,
      `\`${sudo} -n true\` is not silent (${describeOutcome(outcome)}): its words would land on the stderr of every run launched through it`,
    );
  }
}

// ---------------------------------------------------------------------------
// The second user (T13.5-9, E-3)

/** T13.5-9's second user, as the harness launches runs as it. */
export interface SecondUser {
  readonly name: string;
  readonly uid: number;
  /** The group it shares with the harness: the harness's primary group. */
  readonly gid: number;
}

/** An account as `getent passwd` reads it; undefined when absent. */
async function lookUpAccount(
  name: string,
): Promise<{ readonly uid: number; readonly gid: number } | undefined> {
  const outcome = await runCommand("getent", ["passwd", name]);
  // getent(1): exit 2, one or more keys not found.
  if (outcome.code === 2) return undefined;
  const fields = outcome.stdout.trim().split(":");
  const [found, , uid, gid] = fields;
  if (
    outcome.code !== 0 ||
    fields.length < 7 ||
    found !== name ||
    uid === undefined ||
    gid === undefined ||
    !/^[0-9]+$/.test(uid) ||
    !/^[0-9]+$/.test(gid)
  ) {
    throw new HarnessStagingError(
      "second-user",
      name,
      `\`getent passwd ${name}\` does not read as one account (${describeOutcome(outcome)})`,
    );
  }
  return { uid: Number(uid), gid: Number(gid) };
}

/** The names a group's entry lists as its members (`getent group`). */
async function groupMemberNames(gid: number): Promise<string[]> {
  const outcome = await runCommand("getent", ["group", String(gid)]);
  if (outcome.code === 2) return [];
  const fields = outcome.stdout.trim().split(":");
  if (outcome.code !== 0 || fields.length < 4) {
    throw new HarnessStagingError(
      "second-user",
      `group ${String(gid)}`,
      `\`getent group ${String(gid)}\` does not read as one group (${describeOutcome(outcome)})`,
    );
  }
  return (fields[3] ?? "").split(",").filter((member) => member !== "");
}

async function judgeSecondUser(account: {
  readonly uid: number;
  readonly gid: number;
}): Promise<SecondUser> {
  const harness = harnessIds();
  if (account.uid === harness.uid || account.uid === 0) {
    throw new HarnessStagingError(
      "second-user",
      SECOND_USER_NAME,
      `the account bears uid ${String(account.uid)}, ${account.uid === 0 ? "root's" : "the harness's own"}: T13.5-9's second user is an unprivileged identity distinct from the harness's`,
    );
  }
  if (
    account.gid !== harness.gid &&
    !(await groupMemberNames(harness.gid)).includes(SECOND_USER_NAME)
  ) {
    throw new HarnessStagingError(
      "second-user",
      SECOND_USER_NAME,
      `the account shares no group with the harness: its primary group is ${String(account.gid)}, not the harness's ${String(harness.gid)}, whose entry does not list it as a member (T13.5-9: the second user shares a group with the harness)`,
    );
  }
  return { name: SECOND_USER_NAME, uid: account.uid, gid: harness.gid };
}

/**
 * T13.5-9's second user, made idempotently (E-3): an existing account is
 * judged and reused; a missing one is made by `sudo -n flock
 * SECOND_USER_LOCK sh -c 'getent passwd … || useradd …'`, the check and the
 * creation one step under a lock every harness instance on the machine
 * takes, so concurrent makers never both add it; never removed. Unmemoized
 * — `ensureSecondUser` is the memoized entry; this one is what a self-test
 * runs concurrently.
 */
export async function createSecondUser(): Promise<SecondUser> {
  requireLinux("second-user", SECOND_USER_NAME);
  await requireAdministrativeAccess();
  const { gid } = harnessIds();
  const failures: string[] = [];
  for (let attempt = 1; ; attempt += 1) {
    const account = await lookUpAccount(SECOND_USER_NAME);
    if (account !== undefined) return await judgeSecondUser(account);
    if (attempt > USERADD_ATTEMPTS) {
      throw new HarnessStagingError(
        "second-user",
        SECOND_USER_NAME,
        `the account is still missing after ${String(USERADD_ATTEMPTS)} attempts at \`sudo -n useradd\`: ${failures.join("; ")}`,
      );
    }
    const outcome = await runAdministrative([
      "flock",
      "--wait",
      String(SECOND_USER_LOCK_WAIT_SECONDS),
      SECOND_USER_LOCK,
      "/bin/sh",
      "-c",
      'getent passwd "$1" > /dev/null || exec useradd --no-create-home --no-user-group --gid "$2" --shell /usr/sbin/nologin --comment "xspec harness second user" "$1"',
      "sh",
      SECOND_USER_NAME,
      String(gid),
    ]);
    if (outcome.code === 0) continue;
    // The lock not taken in time, or the account files' own lock held by
    // another tool: look again after a pause.
    failures.push(`attempt ${String(attempt)}: ${describeOutcome(outcome)}`);
    await sleep(100 * attempt);
  }
}

/**
 * T13.5-9's second user, made once per process (`createSecondUser`; a
 * failure is asked again next time). Throws `HarnessStagingError` — never a
 * skip — when it cannot be made or judged.
 */
export const ensureSecondUser: () => Promise<SecondUser> =
  memoized(createSecondUser);

// ---------------------------------------------------------------------------
// Group access (T13.5-9)

/** A group-access staging in effect. */
export interface GroupAccessStaging {
  /** The root it was staged on. */
  readonly root: string;
  /**
   * Reinstate every mode the staging changed, in reverse order of change;
   * an entry gone since is passed over. Idempotent.
   */
  restore(): Promise<void>;
}

const GROUP_FILE_BITS = 0o060;
const GROUP_DIRECTORY_BITS = 0o070;
const GROUP_SEARCH_BIT = 0o010;
const MODE_BITS = 0o7777;

/**
 * T13.5-9's group staging of a workspace (module header): plain files
 * group-readable and group-writable, directories group-listable,
 * group-writable, and group-searchable, the harness-owned directories above
 * the root group-searchable. Undone by `restore`. A failure is
 * `HarnessStagingError` (mode `group-access`), the modes already changed
 * restored first.
 */
export async function stageGroupAccess(
  root: string,
): Promise<GroupAccessStaging> {
  requireLinux("group-access", root);
  const records: { readonly target: Buffer; readonly mode: number }[] = [];
  let restoring: Promise<void> | undefined;
  const restore = async (): Promise<void> => {
    for (const record of [...records].reverse()) {
      try {
        await fsp.chmod(record.target, record.mode);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw new HarnessStagingError(
          "group-access",
          record.target.toString("utf8"),
          `restoring mode ${record.mode.toString(8)} failed: ${describeError(error)}`,
        );
      }
    }
  };
  const grant = async (
    target: Buffer,
    mode: number,
    bits: number,
  ): Promise<void> => {
    const prior = mode & MODE_BITS;
    if ((prior | bits) === prior) return;
    records.push({ target, mode: prior });
    await fsp.chmod(target, prior | bits);
  };
  const absolute = path.resolve(root);
  try {
    const rootBytes = Buffer.from(absolute);
    if (!(await fsp.lstat(rootBytes)).isDirectory()) {
      throw new HarnessStagingError(
        "group-access",
        root,
        "the root is not a directory (a symbolic link is never followed)",
      );
    }
    const pending: Buffer[] = [rootBytes];
    for (let dir = pending.pop(); dir !== undefined; dir = pending.pop()) {
      await grant(dir, (await fsp.lstat(dir)).mode, GROUP_DIRECTORY_BITS);
      for (const name of await fsp.readdir(dir, { encoding: "buffer" })) {
        const entry = Buffer.concat([dir, SLASH, name]);
        const stats = await fsp.lstat(entry);
        if (stats.isDirectory()) pending.push(entry);
        else if (stats.isFile())
          await grant(entry, stats.mode, GROUP_FILE_BITS);
      }
    }
    const { uid } = harnessIds();
    for (let dir = path.dirname(absolute); ; dir = path.dirname(dir)) {
      const stats = await fsp.lstat(dir);
      if (stats.isDirectory() && stats.uid === uid) {
        await grant(Buffer.from(dir), stats.mode, GROUP_SEARCH_BIT);
      }
      if (path.dirname(dir) === dir) break;
    }
  } catch (error) {
    await restore().catch(() => undefined);
    if (error instanceof HarnessStagingError) throw error;
    throw new HarnessStagingError(
      "group-access",
      root,
      `the staging failed: ${describeError(error)}`,
    );
  }
  return {
    root,
    restore: async () => {
      restoring ??= restore();
      await restoring;
    },
  };
}

// ---------------------------------------------------------------------------
// The second mount (T13.5-9, E-3)

/** One line of `/proc/self/mountinfo` (proc(5)'s mountinfo). */
export interface MountInfoEntry {
  readonly id: number;
  readonly parentId: number;
  /** The directory of its filesystem it mounts (field 4), decoded. */
  readonly root: Buffer;
  /** Its mount point (field 5), decoded: the path's exact bytes. */
  readonly mountPoint: Buffer;
  readonly fsType: string;
}

/** A mountinfo field with its octal escapes (`\040` a space) decoded. */
function decodeMountField(field: string): Buffer {
  return Buffer.from(
    field.replace(/\\([0-7]{3})/g, (_escape, octal: string) =>
      String.fromCharCode(Number.parseInt(octal, 8)),
    ),
    "latin1",
  );
}

/**
 * `/proc/self/mountinfo`'s lines, in order: `id parent major:minor root
 * mount-point options [optional…] - fstype source super-options`, path bytes
 * kept exact. A line not of that shape throws.
 */
export function parseMountInfo(bytes: Uint8Array): MountInfoEntry[] {
  const entries: MountInfoEntry[] = [];
  for (const line of Buffer.from(bytes).toString("latin1").split("\n")) {
    if (line === "") continue;
    const fields = line.split(" ");
    const separator = fields.indexOf("-", 6);
    const [id, parentId, , root, mountPoint] = fields;
    const fsType = fields[separator + 1];
    if (
      separator < 0 ||
      fields.length < separator + 4 ||
      id === undefined ||
      parentId === undefined ||
      root === undefined ||
      mountPoint === undefined ||
      fsType === undefined ||
      !/^[0-9]+$/.test(id) ||
      !/^[0-9]+$/.test(parentId)
    ) {
      throw new Error(
        `a /proc/self/mountinfo line does not read as proc(5)'s mountinfo: ${JSON.stringify(line.slice(0, 300))}`,
      );
    }
    entries.push({
      id: Number(id),
      parentId: Number(parentId),
      root: decodeMountField(root),
      mountPoint: decodeMountField(mountPoint),
      fsType,
    });
  }
  return entries;
}

/** Whether `prefix` is `target` or a directory above it (both absolute). */
function isPathPrefix(prefix: Buffer, target: Buffer): boolean {
  if (prefix.equals(target)) return true;
  if (prefix.length === 1 && prefix[0] === SLASH_BYTE) {
    return target[0] === SLASH_BYTE;
  }
  return (
    target.length > prefix.length &&
    target[prefix.length] === SLASH_BYTE &&
    target.subarray(0, prefix.length).equals(prefix)
  );
}

/** The mount at mount point `target` — the last listed, on top — if any. */
export function mountAt(
  entries: readonly MountInfoEntry[],
  target: Uint8Array,
): MountInfoEntry | undefined {
  const bytes = Buffer.from(target);
  return entries.findLast((entry) => entry.mountPoint.equals(bytes));
}

/**
 * The mount `target` (an absolute real path) lies on: the one whose mount
 * point is the longest prefix of it, the last listed among equals.
 */
export function mountContaining(
  entries: readonly MountInfoEntry[],
  target: Uint8Array,
): MountInfoEntry | undefined {
  const bytes = Buffer.from(target);
  let found: MountInfoEntry | undefined;
  for (const entry of entries) {
    if (!isPathPrefix(entry.mountPoint, bytes)) continue;
    if (
      found === undefined ||
      entry.mountPoint.length >= found.mountPoint.length
    ) {
      found = entry;
    }
  }
  return found;
}

async function readMountInfo(): Promise<MountInfoEntry[]> {
  return parseMountInfo(await fsp.readFile("/proc/self/mountinfo"));
}

/**
 * T13.5-9's verification of a second path to `root` (module header): the
 * second path a mount point, the root on another mount, and a file the
 * harness creates through either path appearing through the other (each
 * removed again). Anything else is `HarnessStagingError` (mode
 * `second-mount`), never a pass or a skip.
 */
export async function verifySecondMount(
  root: string,
  secondPath: string,
): Promise<void> {
  requireLinux("second-mount", secondPath);
  const realRoot = await fsp.realpath(root);
  const realSecond = await fsp.realpath(secondPath).catch(() => secondPath);
  const mounts = await readMountInfo();
  const second = mountAt(mounts, Buffer.from(realSecond));
  if (second === undefined) {
    throw new HarnessStagingError(
      "second-mount",
      secondPath,
      `not a mount point: /proc/self/mountinfo lists no mount at ${realSecond} (T13.5-9's second path to the root is a bind mount of it)`,
    );
  }
  const rootMount = mountContaining(mounts, Buffer.from(realRoot));
  if (rootMount === undefined || rootMount.id === second.id) {
    throw new HarnessStagingError(
      "second-mount",
      secondPath,
      `the root ${realRoot} lies on the second path's own mount (${String(second.id)}): the two paths are not distinct mount points`,
    );
  }
  for (const [from, to] of [
    [realRoot, realSecond],
    [realSecond, realRoot],
  ] as const) {
    const name = `.xspec-second-mount-probe-${randomBytes(6).toString("hex")}`;
    const token = randomBytes(8).toString("hex");
    await fsp.writeFile(path.join(from, name), token, { flag: "wx" });
    try {
      const seen = await fsp
        .readFile(path.join(to, name), "utf8")
        .catch(() => undefined);
      if (seen !== token) {
        throw new HarnessStagingError(
          "second-mount",
          secondPath,
          `a file created through ${from} does not appear through ${to} (${seen === undefined ? "absent" : `read as ${JSON.stringify(seen)}`}): the second path does not reach the root`,
        );
      }
    } finally {
      await fsp.rm(path.join(from, name), { force: true });
    }
  }
}

/** A second mount in effect (T13.5-9). */
export interface SecondMount {
  /** The root it mounts, as given. */
  readonly root: string;
  /** The second path to the root: the bind mount's mount point. */
  readonly path: string;
  /** Unmount it and remove its directory, verified gone. Idempotent. */
  remove(): Promise<void>;
}

async function removeMount(mountPoint: string): Promise<void> {
  const failures: string[] = [];
  for (let attempt = 1; ; attempt += 1) {
    const outcome = await runAdministrative(["umount", mountPoint]);
    if (outcome.code === 0) break;
    failures.push(`attempt ${String(attempt)}: ${describeOutcome(outcome)}`);
    if (attempt >= UMOUNT_ATTEMPTS) {
      throw new HarnessStagingError(
        "second-mount",
        mountPoint,
        `\`sudo -n umount\` failed ${String(UMOUNT_ATTEMPTS)} times — a process may still use the second path: ${failures.join("; ")}`,
      );
    }
    await sleep(100 * attempt);
  }
  if (mountAt(await readMountInfo(), Buffer.from(mountPoint)) !== undefined) {
    throw new HarnessStagingError(
      "second-mount",
      mountPoint,
      "still a mount point after `umount`",
    );
  }
  await fsp.rmdir(mountPoint);
}

/**
 * T13.5-9's second mount (module header): `root` bind-mounted at a fresh
 * directory under `parent` — a path unique to the suite instance, the
 * workspace's own temporary directory — and verified; `remove` undoes it,
 * and the test that made it calls it (E-3). A failure is
 * `HarnessStagingError` (mode `second-mount`), anything made undone first.
 */
export async function stageSecondMount(
  root: string,
  parent: string,
): Promise<SecondMount> {
  requireLinux("second-mount", root);
  await requireAdministrativeAccess();
  const realRoot = await fsp.realpath(root);
  const mountPoint = path.join(
    await fsp.realpath(parent),
    `second-mount-${randomBytes(6).toString("hex")}`,
  );
  await fsp.mkdir(mountPoint, { mode: 0o755 });
  const made = await runAdministrative([
    "mount",
    "--bind",
    realRoot,
    mountPoint,
  ]);
  if (made.code !== 0) {
    await fsp.rmdir(mountPoint).catch(() => undefined);
    throw new HarnessStagingError(
      "second-mount",
      mountPoint,
      `\`sudo -n mount --bind ${realRoot} ${mountPoint}\` failed (${describeOutcome(made)})`,
    );
  }
  let removal: Promise<void> | undefined;
  const mount: SecondMount = {
    root,
    path: mountPoint,
    remove: async () => {
      removal ??= removeMount(mountPoint);
      await removal;
    },
  };
  try {
    await verifySecondMount(realRoot, mountPoint);
  } catch (error) {
    await mount.remove().catch(() => undefined);
    throw error;
  }
  return mount;
}

// ---------------------------------------------------------------------------
// The launcher (H-2)

/**
 * `prlimit --raw --noheadings --output RESOURCE,SOFT,HARD` lines as the
 * `prlimit` options restoring each limit (`--nofile=1024:4096`). A line not
 * of that shape throws.
 */
export function prlimitOptions(rawLines: string): string[] {
  const options: string[] = [];
  for (const line of rawLines.split("\n")) {
    if (line.trim() === "") continue;
    const [resource, soft, hard, ...rest] = line.trim().split(/\s+/);
    if (
      resource === undefined ||
      soft === undefined ||
      hard === undefined ||
      rest.length > 0 ||
      !/^[A-Z]+$/.test(resource) ||
      !/^(?:[0-9]+|unlimited)$/.test(soft) ||
      !/^(?:[0-9]+|unlimited)$/.test(hard)
    ) {
      throw new Error(
        `prlimit printed a line that does not read as \`RESOURCE SOFT HARD\`: ${JSON.stringify(line)}`,
      );
    }
    options.push(`--${resource.toLowerCase()}=${soft}:${hard}`);
  }
  if (options.length === 0) throw new Error("prlimit printed no limit");
  return options;
}

/** The harness's own resource limits as `prlimit` options, read once. */
const harnessLimitOptions = memoized(async (): Promise<string[]> => {
  const outcome = await runCommand("prlimit", [
    "--pid",
    String(process.pid),
    "--raw",
    "--noheadings",
    "--output",
    "RESOURCE,SOFT,HARD",
  ]);
  if (outcome.code !== 0) {
    throw new HarnessStagingError(
      "second-user",
      "prlimit",
      `reading the harness's own resource limits failed (${describeOutcome(outcome)})`,
    );
  }
  return prlimitOptions(outcome.stdout);
});

/** What the second user's launcher starts every run with. */
export interface SecondUserSpawnPlan {
  /** The command administrative access is reached through. */
  readonly sudo: string;
  readonly user: SecondUser;
  /** The harness's resource limits, as `prlimit` options. */
  readonly limits: readonly string[];
  /** The harness's umask. */
  readonly umask: number;
}

/**
 * The second user's spawn of `invocation` (module header: the launcher):
 * `sudo -n --`, a `sh` setting the umask, `prlimit` with every limit,
 * `setpriv` to the second user with no capability, `env -i --` with exactly
 * `env`, then the command and its arguments verbatim. Throws a plain `Error`
 * for an invocation it cannot express: a command that is not absolute or
 * holds `=` (`env` would read it as an assignment), a variable whose name is
 * empty or holds `=`.
 */
export function secondUserSpawn(
  plan: SecondUserSpawnPlan,
  invocation: { readonly command: string; readonly args: readonly string[] },
  env: Readonly<Record<string, string>>,
): { command: string; args: string[] } {
  const tail = exactEnvironmentStage(
    "the second user's launcher",
    invocation,
    env,
  );
  return {
    command: plan.sudo,
    args: [
      ...rootStage(plan.umask, plan.limits),
      "setpriv",
      `--reuid=${String(plan.user.uid)}`,
      `--regid=${String(plan.user.gid)}`,
      "--init-groups",
      "--inh-caps=-all",
      "--bounding-set=-all",
      "--",
      ...tail,
    ],
  };
}

/**
 * Every launcher's first stage, `sudo`'s arguments: `-n --`, a `sh` setting
 * `umask` and execing `prlimit`, which restores `limits` (sudo resets both)
 * and execs what follows the returned `--`.
 */
function rootStage(umask: number, limits: readonly string[]): string[] {
  return [
    "-n",
    "--",
    "/bin/sh",
    "-c",
    'umask "$1" && shift && exec "$@"',
    "sh",
    umask.toString(8).padStart(4, "0"),
    "prlimit",
    ...limits,
    "--",
  ];
}

/**
 * Every launcher's last stage: `env -i --` with exactly `env`, then the
 * command and its arguments verbatim. Throws a plain `Error`, naming `who`,
 * for what it cannot express: a command that is not absolute or holds `=`
 * (`env` would read it as an assignment), a variable whose name is empty or
 * holds `=`.
 */
function exactEnvironmentStage(
  who: string,
  invocation: { readonly command: string; readonly args: readonly string[] },
  env: Readonly<Record<string, string>>,
): string[] {
  if (
    !path.isAbsolute(invocation.command) ||
    invocation.command.includes("=")
  ) {
    throw new Error(
      `${who} starts an absolute command holding no \`=\` (env -i would read one as an assignment), not ${JSON.stringify(invocation.command)}`,
    );
  }
  const assignments: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (name === "" || name.includes("=")) {
      throw new Error(
        `${who} cannot pass an environment variable named ${JSON.stringify(name)}`,
      );
    }
    assignments.push(`${name}=${value}`);
  }
  return [
    "env",
    "-i",
    "--",
    ...assignments,
    invocation.command,
    ...invocation.args,
  ];
}

/** The harness's own environment, which `sudo` itself is started with. */
function harnessEnvironment(): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) environment[name] = value;
  }
  return environment;
}

/**
 * SIGKILL to process group `groupId` through `sudo` (every launcher's kill),
 * a failure while the group still has listed processes the staging error of
 * `mode`.
 */
async function killGroupThroughSudo(
  groupId: number,
  sudo: string = DEFAULT_SUDO,
  mode: StagingMode = "second-user",
): Promise<void> {
  const outcome = await runCommand(sudo, [
    "-n",
    "--",
    "kill",
    "-s",
    "KILL",
    "--",
    `-${String(groupId)}`,
  ]);
  if (outcome.code === 0) return;
  // No process of the group left to signal (ESRCH): nothing to do.
  if ((await processGroupMembers(groupId)).length === 0) return;
  throw new HarnessStagingError(
    mode,
    `process group ${String(groupId)}`,
    `\`${sudo} -n kill -s KILL -- -${String(groupId)}\` failed (${describeOutcome(outcome)}) while the group still has listed processes`,
  );
}

/**
 * The subprocess driver's launcher for T13.5-9's second user (module
 * header): pass it as the `launcher` run option. Reads the harness's
 * resource limits and umask now; checks administrative access first.
 */
export async function secondUserLauncher(
  user: SecondUser,
): Promise<RunLauncher> {
  requireLinux("second-user", user.name);
  await requireAdministrativeAccess();
  const plan: SecondUserSpawnPlan = {
    sudo: DEFAULT_SUDO,
    user,
    limits: await harnessLimitOptions(),
    umask: process.umask(),
  };
  return {
    label: `as the second user ${user.name} (uid ${String(user.uid)}, gid ${String(user.gid)}) through sudo (H-2; TEST-SPEC T13.5-9)`,
    wrap: (invocation, env) => ({
      ...secondUserSpawn(plan, invocation, env),
      env: harnessEnvironment(),
    }),
    killGroup: (groupId) => killGroupThroughSudo(groupId),
  };
}

// ---------------------------------------------------------------------------
// Verifications (T13.5-9, H-11)

// The probe the second user runs (CommonJS, no dependency): walks a root as
// bytes — every directory listed, every plain file read, every symbolic link
// read as a link, never followed — creates and removes a file in each
// directory named, checks access to paths, and looks for the harness's
// process in its own process list; then writes its report whole (renamed
// into place) and waits for the harness's release, bounded.
const PROBE_SOURCE = `"use strict";
const fs = require("node:fs");
const path = require("node:path");
const job = JSON.parse(process.argv[2]);
const codeOf = (error) => (error && error.code) || String(error);
const shown = (bytes) => ({ text: bytes.toString("utf8"), hex: bytes.toString("hex") });
const report = {
  pid: process.pid,
  uid: process.getuid(),
  gid: process.getgid(),
  groups: process.getgroups(),
  walk: null,
  created: [],
  reach: [],
  listsHarness: null,
};
if (typeof job.walk === "string") {
  const walk = { directories: 0, files: 0, links: 0, others: 0, failures: [] };
  const slash = Buffer.from("/");
  const pending = [Buffer.from(job.walk)];
  while (pending.length > 0) {
    const dir = pending.pop();
    let names;
    try {
      names = fs.readdirSync(dir, { encoding: "buffer" });
      walk.directories += 1;
    } catch (error) {
      walk.failures.push({ path: shown(dir), op: "list", code: codeOf(error) });
      continue;
    }
    for (const name of names) {
      const entry = Buffer.concat([dir, slash, name]);
      let stats;
      try {
        stats = fs.lstatSync(entry);
      } catch (error) {
        walk.failures.push({ path: shown(entry), op: "lstat", code: codeOf(error) });
        continue;
      }
      if (stats.isDirectory()) {
        pending.push(entry);
      } else if (stats.isFile()) {
        try {
          fs.readFileSync(entry);
          walk.files += 1;
        } catch (error) {
          walk.failures.push({ path: shown(entry), op: "read", code: codeOf(error) });
        }
      } else if (stats.isSymbolicLink()) {
        try {
          fs.readlinkSync(entry);
          walk.links += 1;
        } catch (error) {
          walk.failures.push({ path: shown(entry), op: "readlink", code: codeOf(error) });
        }
      } else {
        walk.others += 1;
      }
    }
  }
  report.walk = walk;
}
for (const dir of job.createIn) {
  const probe = path.join(dir, ".xspec-second-user-probe-" + String(process.pid));
  const outcome = { dir: dir, created: false, removed: false, code: null };
  try {
    fs.writeFileSync(probe, "probe", { flag: "wx" });
    outcome.created = true;
    fs.unlinkSync(probe);
    outcome.removed = true;
  } catch (error) {
    outcome.code = codeOf(error);
  }
  report.created.push(outcome);
}
for (const item of job.reach) {
  const mode = item.execute ? fs.constants.X_OK : fs.constants.R_OK;
  try {
    fs.accessSync(item.path, mode);
    report.reach.push({ path: item.path, execute: item.execute, ok: true, code: null });
  } catch (error) {
    report.reach.push({ path: item.path, execute: item.execute, ok: false, code: codeOf(error) });
  }
}
report.listsHarness = fs.readdirSync("/proc").includes(String(job.harnessPid));
fs.writeFileSync(job.resultFile + ".tmp", JSON.stringify(report));
fs.renameSync(job.resultFile + ".tmp", job.resultFile);
const deadline = Date.now() + job.releaseTimeoutMs;
const poll = () => {
  if (fs.existsSync(job.releaseFile)) process.exit(0);
  if (Date.now() > deadline) {
    process.stderr.write("the harness never released the probe");
    process.exit(3);
  }
  setTimeout(poll, 10);
};
poll();
`;

/** What the second user's probe is asked to do. */
export interface SecondUserProbe {
  /** A root to walk: every directory listed, every plain file read. */
  readonly walk?: string;
  /** Directories to create and remove a file in. */
  readonly createIn?: readonly string[];
  /** Paths to check: executable where `execute`, readable otherwise. */
  readonly reach?: readonly {
    readonly path: string;
    readonly execute: boolean;
  }[];
}

/** A path the probe reports, as UTF-8 text and as its exact bytes in hex. */
export interface ProbePath {
  readonly text: string;
  readonly hex: string;
}

/** What the second user's probe reported, and what the harness saw of it. */
export interface SecondUserReport {
  readonly pid: number;
  readonly uid: number;
  readonly gid: number;
  readonly groups: readonly number[];
  readonly walk: {
    readonly directories: number;
    readonly files: number;
    readonly links: number;
    readonly others: number;
    readonly failures: readonly {
      readonly path: ProbePath;
      readonly op: string;
      readonly code: string;
    }[];
  } | null;
  readonly created: readonly {
    readonly dir: string;
    readonly created: boolean;
    readonly removed: boolean;
    readonly code: string | null;
  }[];
  readonly reach: readonly {
    readonly path: string;
    readonly execute: boolean;
    readonly ok: boolean;
    readonly code: string | null;
  }[];
  /** Whether the probe's process list listed the harness's process. */
  readonly listsHarness: boolean;
  /** Whether the harness's process list listed the probe's while it ran. */
  readonly listedByHarness: boolean;
}

/**
 * Run the probe as the second user, through its launcher, from a scratch
 * directory under the temporary folder the shared group may use (removed
 * after). A probe that does not report, or does not end with exit 0 and an
 * empty stderr once released, is `HarnessStagingError` (mode
 * `second-user`); the report itself is returned unjudged.
 */
export async function runSecondUserProbe(
  user: SecondUser,
  probe: SecondUserProbe,
): Promise<SecondUserReport> {
  const launcher = await secondUserLauncher(user);
  const scratch = await fsp.mkdtemp(
    path.join(os.tmpdir(), "xspec-second-user-probe-"),
  );
  try {
    await fsp.chmod(scratch, 0o770);
    const script = path.join(scratch, "probe.cjs");
    await fsp.writeFile(script, PROBE_SOURCE);
    await fsp.chmod(script, 0o640);
    const resultFile = path.join(scratch, "report.json");
    const releaseFile = path.join(scratch, "release");
    const job = {
      walk: probe.walk,
      createIn: probe.createIn ?? [],
      reach: probe.reach ?? [],
      harnessPid: process.pid,
      resultFile,
      releaseFile,
      releaseTimeoutMs: PROBE_TIMEOUT_MS,
    };
    const binding: ProductBinding = {
      label: "the second user's probe (harness machinery)",
      command: process.execPath,
      prefixArgs: [script],
    };
    const running = await startProduct(binding, {
      cwd: scratch,
      argv: [JSON.stringify(job)],
      launcher,
      timeoutMs: 2 * PROBE_TIMEOUT_MS,
    });
    try {
      try {
        await running.waitForFile(resultFile, { timeoutMs: PROBE_TIMEOUT_MS });
      } catch (error) {
        throw new HarnessStagingError(
          "second-user",
          user.name,
          `the probe run as the second user never reported: ${describeError(error)}`,
        );
      }
      const reported = JSON.parse(
        await fsp.readFile(resultFile, "utf8"),
      ) as Omit<SecondUserReport, "listedByHarness">;
      const listedByHarness = (await listedAmong([reported.pid])).length === 1;
      await fsp.writeFile(releaseFile, "");
      const result = await running.waitForExit();
      if (result.exitCode !== 0 || result.stderrBytes.length > 0) {
        throw new HarnessStagingError(
          "second-user",
          user.name,
          `the probe run as the second user ended ${summarizeResult(result)}`,
        );
      }
      return { ...reported, listedByHarness };
    } finally {
      if (!running.hasExited()) {
        await running.killGroup().catch(() => undefined);
      }
    }
  } finally {
    await fsp.rm(scratch, { recursive: true, force: true });
  }
}

/** What T13.5-9 asks the second user to reach before use. */
export interface SecondUserReach {
  /** The workspace root: every directory listed, every file read. */
  readonly root: string;
  /**
   * Directories the second user must create and remove a file in: the root
   * and `.xspec`, for T13.5-9.
   */
  readonly createIn: readonly string[];
  /** A binding it must start: its command executed, its files read. */
  readonly binding?: ProductBinding;
}

/**
 * T13.5-9's verification of the second user on the harness itself, before
 * use (module header): its uid not the harness's; it lists every directory
 * and reads every file under the root, creates and removes a file in each
 * of `createIn`, and reaches the binding; each identity's process list lists
 * the other's process. An ineffective staging is `HarnessStagingError` (mode
 * `second-user`, H-11), never a pass or a skip. Returns the probe's report.
 */
export async function verifySecondUserReach(
  user: SecondUser,
  reach: SecondUserReach,
): Promise<SecondUserReport> {
  const harness = harnessIds();
  const binding = reach.binding;
  const report = await runSecondUserProbe(user, {
    walk: reach.root,
    createIn: reach.createIn,
    reach:
      binding === undefined
        ? []
        : [
            { path: binding.command, execute: true },
            ...(binding.requiredFiles ?? []).map((file) => ({
              path: file,
              execute: false,
            })),
          ],
  });
  const problems: string[] = [];
  if (report.uid === harness.uid || report.uid !== user.uid) {
    problems.push(
      `the probe ran as uid ${String(report.uid)}, where the second user's is ${String(user.uid)} and the harness's ${String(harness.uid)}`,
    );
  }
  if (report.gid !== user.gid) {
    problems.push(
      `the probe ran with gid ${String(report.gid)}, not the shared group ${String(user.gid)}`,
    );
  }
  if (report.walk === null) {
    problems.push("the probe reported no walk of the root");
  } else if (report.walk.failures.length > 0) {
    const failures = report.walk.failures;
    problems.push(
      `the second user could not reach ${String(failures.length)} entr${failures.length === 1 ? "y" : "ies"} under the root: ` +
        failures
          .slice(0, 10)
          .map(
            (failure) => `${failure.op} ${failure.path.text} (${failure.code})`,
          )
          .join(", "),
    );
  }
  for (const outcome of report.created) {
    if (!outcome.created || !outcome.removed) {
      problems.push(
        `the second user could not create and remove a file in ${outcome.dir} (${outcome.code ?? "unknown"})`,
      );
    }
  }
  for (const item of report.reach) {
    if (!item.ok) {
      problems.push(
        `the second user cannot ${item.execute ? "execute" : "read"} ${item.path} (${item.code ?? "unknown"})`,
      );
    }
  }
  if (!report.listsHarness) {
    problems.push(
      `the second user's process list does not list the harness's process ${String(process.pid)}`,
    );
  }
  if (!report.listedByHarness) {
    problems.push(
      `the harness's process list does not list the second user's process ${String(report.pid)}`,
    );
  }
  if (problems.length > 0) {
    throw new HarnessStagingError(
      "second-user",
      reach.root,
      `T13.5-9's second-user staging is ineffective (H-11): ${problems.join("; ")}`,
    );
  }
  return report;
}

/**
 * Whether the second user can create and remove a file in `dir`, unjudged:
 * T13.5-9 asks it once the holder is held, where a refusal leaves the
 * lenient expectation rather than a staging error.
 */
export async function secondUserCreatesIn(
  user: SecondUser,
  dir: string,
): Promise<{ readonly ok: boolean; readonly code: string | null }> {
  const report = await runSecondUserProbe(user, { createIn: [dir] });
  const outcome = report.created[0];
  if (outcome === undefined) {
    throw new HarnessStagingError(
      "second-user",
      dir,
      "the probe reported no attempt at the directory",
    );
  }
  return { ok: outcome.created && outcome.removed, code: outcome.code };
}

// ---------------------------------------------------------------------------
// Fresh process-identifier namespaces (T13.5-10(e)–(g), T13.5-3; H-2, E-1,
// E-3, H-11)

/** Bound on a namespace's first process starting, and on each answer. */
const NAMESPACE_TIMEOUT_MS = 60_000;
/** Bound on the first process's stderr kept for a diagnosis. */
const NAMESPACE_STDERR_LIMIT = 64 * 1024;
/** The identifier every namespace gives its first process. */
const FIRST_IDENTIFIER = 1;

/** The identity every run started into a namespace drops back to (H-2). */
export interface HarnessIdentity {
  readonly uid: number;
  readonly gid: number;
  /** The supplementary groups, as `getgroups` lists them. */
  readonly groups: readonly number[];
}

/** The harness's own identity: its uid, gid, and supplementary groups. */
function harnessIdentity(): HarnessIdentity {
  const { uid, gid } = harnessIds();
  if (process.getgroups === undefined) {
    throw new Error(
      `13.5's machine-wide stagings are the Linux leg's (TEST-SPEC E-1); this platform (${process.platform}) has no supplementary groups`,
    );
  }
  return { uid, gid, groups: process.getgroups() };
}

/** What a namespace launcher starts every run with. */
export interface NamespaceSpawnPlan {
  /** The command administrative access is reached through. */
  readonly sudo: string;
  /** The identity every run drops back to: the harness's own. */
  readonly identity: HarnessIdentity;
  /** The harness's resource limits, as `prlimit` options. */
  readonly limits: readonly string[];
  /** The harness's umask. */
  readonly umask: number;
}

/** Which command administrative access is reached through. */
export interface NamespaceOptions {
  /**
   * `sudo` by default; a self-test names another command to stage access
   * withheld without touching `sudo`.
   */
  readonly sudo?: string;
}

/**
 * `setpriv` back to `identity` — its uid, gid, and supplementary groups —
 * with the inheritable and bounding capability sets cleared, so no
 * capability is left (H-2, E-1).
 */
function dropStage(identity: HarnessIdentity): string[] {
  return [
    "setpriv",
    `--reuid=${String(identity.uid)}`,
    `--regid=${String(identity.gid)}`,
    identity.groups.length === 0
      ? "--clear-groups"
      : `--groups=${identity.groups.map(String).join(",")}`,
    "--inh-caps=-all",
    "--bounding-set=-all",
    "--",
  ];
}

/**
 * Launcher A's spawn of `invocation` (module header): the root stage (the
 * umask, every limit), then `unshare --pid --fork --mount-proc`, whose
 * forked child — the first process of a fresh process-identifier namespace,
 * with a process list of its own (a fresh `/proc` in a mount namespace of
 * its own) — drops back to the plan's identity with no capability and execs
 * `env -i --` with exactly `env`, then the command and its arguments
 * verbatim: the command is that first process. Throws a plain `Error` for
 * an invocation it cannot express (as `secondUserSpawn` does).
 */
export function freshNamespaceSpawn(
  plan: NamespaceSpawnPlan,
  invocation: { readonly command: string; readonly args: readonly string[] },
  env: Readonly<Record<string, string>>,
): { command: string; args: string[] } {
  const tail = exactEnvironmentStage("a namespace launcher", invocation, env);
  return {
    command: plan.sudo,
    args: [
      ...rootStage(plan.umask, plan.limits),
      "unshare",
      "--pid",
      "--fork",
      "--mount-proc",
      "--",
      ...dropStage(plan.identity),
      ...tail,
    ],
  };
}

/**
 * Launcher B's spawn of `invocation` into the namespace whose first process
 * the harness's process list lists as `target` (module header): the root
 * stage, then `nsenter` into that process's process-identifier and mount
 * namespaces — forking, so the command is a process of the namespace, listed
 * in its process list — with `cwd` resolved there as the working directory
 * (entering a mount namespace resets it), then as launcher A. Throws a plain
 * `Error` for an invocation it cannot express or a `cwd` that is not
 * absolute.
 */
export function namespaceEntrySpawn(
  plan: NamespaceSpawnPlan,
  target: number,
  invocation: { readonly command: string; readonly args: readonly string[] },
  env: Readonly<Record<string, string>>,
  cwd: string,
): { command: string; args: string[] } {
  if (!Number.isInteger(target) || target < 1) {
    throw new Error(
      `a namespace launcher enters the namespace of a listed process, not ${String(target)}`,
    );
  }
  if (!path.isAbsolute(cwd)) {
    throw new Error(
      `a namespace launcher sets an absolute working directory inside the namespace, not ${JSON.stringify(cwd)}`,
    );
  }
  const tail = exactEnvironmentStage("a namespace launcher", invocation, env);
  return {
    command: plan.sudo,
    args: [
      ...rootStage(plan.umask, plan.limits),
      "nsenter",
      `--target=${String(target)}`,
      "--pid",
      "--mount",
      `--wdns=${cwd}`,
      "--",
      ...dropStage(plan.identity),
      ...tail,
    ],
  };
}

/** The plan every run `sudo` starts into a namespace follows. */
async function namespacePlan(sudo: string): Promise<NamespaceSpawnPlan> {
  return {
    sudo,
    identity: harnessIdentity(),
    limits: await harnessLimitOptions(),
    umask: process.umask(),
  };
}

// The probe launcher A's verification runs (CommonJS, no dependency):
// prints, as one JSON document, its own identifier, its status' NSpid line,
// the process list it sees (the numeric entries of `/proc`), its identity,
// and its capability sets, and exits 0.
const NAMESPACE_PROBE_SOURCE = `"use strict";
const fs = require("node:fs");
const field = (name) => {
  const line = fs
    .readFileSync("/proc/self/status", "latin1")
    .split("\\n")
    .find((candidate) => candidate.startsWith(name + ":"));
  return line === undefined ? null : line.slice(name.length + 1).trim();
};
process.stdout.write(
  JSON.stringify({
    pid: process.pid,
    nspid: field("NSpid"),
    listed: fs
      .readdirSync("/proc")
      .filter((name) => /^[1-9][0-9]*$/.test(name))
      .map(Number)
      .sort((a, b) => a - b),
    uid: process.getuid(),
    gid: process.getgid(),
    groups: process.getgroups(),
    caps: ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"].map(field),
  }),
);
`;

/** What launcher A's probe reported. */
interface NamespaceProbeReport {
  readonly pid: number;
  readonly nspid: string | null;
  readonly listed: readonly number[];
  readonly uid: number;
  readonly gid: number;
  readonly groups: readonly number[];
  readonly caps: readonly (string | null)[];
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  const left = ascending(new Set(a));
  const right = ascending(new Set(b));
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function ascending(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Launcher A's verification on the harness itself (E-1, H-11): a probe
 * started through it must run as the first process of a namespace whose
 * process list lists it alone — its own identifier 1, its NSpid line `1`
 * (the `/proc` it sees is its namespace's) — as the harness's uid, gid, and
 * supplementary groups with every capability set empty, and end with exit 0
 * and an empty stderr. Anything else is `HarnessStagingError` (mode
 * `pid-namespace`).
 */
async function verifyFreshNamespaceLauncher(
  launcher: RunLauncher,
  sudo: string,
): Promise<void> {
  const scratch = await fsp.mkdtemp(
    path.join(os.tmpdir(), "xspec-namespace-probe-"),
  );
  try {
    const script = path.join(scratch, "probe.cjs");
    await fsp.writeFile(script, NAMESPACE_PROBE_SOURCE);
    const binding: ProductBinding = {
      label: "a fresh namespace's probe (harness machinery)",
      command: process.execPath,
      prefixArgs: [script],
    };
    const running = await startProduct(binding, {
      cwd: scratch,
      launcher,
      timeoutMs: NAMESPACE_TIMEOUT_MS,
    });
    let result: RunResult;
    try {
      result = await running.waitForExit();
    } catch (error) {
      throw new HarnessStagingError(
        "pid-namespace",
        sudo,
        `the probe started as the first process of a fresh process-identifier namespace did not run to its end: ${describeError(error)}`,
      );
    } finally {
      if (!running.hasExited()) {
        await running.killGroup().catch(() => undefined);
      }
    }
    if (result.exitCode !== 0 || result.stderrBytes.length > 0) {
      throw new HarnessStagingError(
        "pid-namespace",
        sudo,
        `the probe started as the first process of a fresh process-identifier namespace ended ${summarizeResult(result)}`,
      );
    }
    const report = JSON.parse(result.stdout) as NamespaceProbeReport;
    const identity = harnessIdentity();
    const problems: string[] = [];
    if (report.pid !== FIRST_IDENTIFIER || report.nspid !== "1") {
      problems.push(
        `the probe bore identifier ${String(report.pid)} (NSpid ${JSON.stringify(report.nspid)}), not the first process's 1 in a process list of its own namespace`,
      );
    }
    if (!sameNumbers(report.listed, [FIRST_IDENTIFIER])) {
      problems.push(
        `the probe's process list listed ${report.listed.slice(0, 20).join(", ")}${report.listed.length > 20 ? ", …" : ""}, not the probe alone`,
      );
    }
    if (report.uid !== identity.uid || report.gid !== identity.gid) {
      problems.push(
        `the probe ran as uid ${String(report.uid)}, gid ${String(report.gid)}, not the harness's uid ${String(identity.uid)}, gid ${String(identity.gid)}`,
      );
    }
    if (!sameNumbers(report.groups, identity.groups)) {
      problems.push(
        `the probe's supplementary groups were ${report.groups.join(",")}, not the harness's ${identity.groups.join(",")}`,
      );
    }
    if (!report.caps.every((set) => set !== null && /^0+$/.test(set))) {
      problems.push(
        `the probe kept capabilities (CapInh, CapPrm, CapEff, CapBnd, CapAmb: ${report.caps.map(String).join(", ")})`,
      );
    }
    if (problems.length > 0) {
      throw new HarnessStagingError(
        "pid-namespace",
        sudo,
        `the fresh process-identifier namespace staging is ineffective (H-11): ${problems.join("; ")}`,
      );
    }
  } finally {
    await fsp.rm(scratch, { recursive: true, force: true });
  }
}

const freshNamespaceChecks = new Map<string, () => Promise<void>>();

/**
 * Launcher A (module header), the subprocess driver's launcher starting each
 * run as the first process of a fresh process-identifier namespace with a
 * process list of its own, as the harness's identity with no capability
 * (T13.5-10(f), (g); H-2, E-1). Checks administrative access first, then
 * verifies the launcher on the harness itself once per command (a success
 * remembered, a failure asked again): `HarnessStagingError`, never a skip.
 * Its kills — the guards', `killGroup` — go through `sudo`, SIGKILL reaching
 * the namespace's first process from outside (T13.5-3).
 */
export async function freshNamespaceLauncher(
  options: NamespaceOptions = {},
): Promise<RunLauncher> {
  const sudo = options.sudo ?? DEFAULT_SUDO;
  requireLinux("pid-namespace", "a fresh process-identifier namespace");
  await requireAdministrativeAccess({ sudo });
  const plan = await namespacePlan(sudo);
  const launcher: RunLauncher = {
    label: `as the first process of a fresh process-identifier namespace with a process list of its own, through ${sudo} (H-2; TEST-SPEC T13.5-10(f), (g))`,
    wrap: (invocation, env) => ({
      ...freshNamespaceSpawn(plan, invocation, env),
      env: harnessEnvironment(),
    }),
    killGroup: (groupId) =>
      killGroupThroughSudo(groupId, sudo, "pid-namespace"),
  };
  let check = freshNamespaceChecks.get(sudo);
  if (check === undefined) {
    check = memoized(() => verifyFreshNamespaceLauncher(launcher, sudo));
    freshNamespaceChecks.set(sudo, check);
  }
  await check();
  return launcher;
}

/**
 * The identifiers `/proc/<pid>/status`'s `NSpid` line records for a process
 * (Linux 4.1+): one per process-identifier namespace from the one the
 * process list belongs to down to the process's own, outermost first. A
 * status without that line, or a line of another shape, throws.
 */
export function parseNSpid(status: string): number[] {
  const line = status
    .split("\n")
    .find((candidate) => candidate.startsWith("NSpid:"));
  if (line === undefined) {
    throw new Error(
      "the process status has no NSpid line (Linux 4.1+), so in-namespace identifiers cannot be read",
    );
  }
  const fields = line.slice("NSpid:".length).trim().split(/\s+/);
  if (!fields.every((field) => /^[1-9][0-9]*$/.test(field))) {
    throw new Error(
      `the process status' NSpid line does not read as identifiers: ${JSON.stringify(line)}`,
    );
  }
  return fields.map(Number);
}

/** `pid`'s NSpid identifiers as its status reads now; undefined once gone. */
export async function readNSpid(pid: number): Promise<number[] | undefined> {
  let status: string;
  try {
    status = await fsp.readFile(`/proc/${String(pid)}/status`, "latin1");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ESRCH") return undefined;
    throw error;
  }
  return parseNSpid(status);
}

/**
 * How many process-identifier namespaces the harness's own NSpid line
 * spans: a process whose line spans more lies in a namespace below the
 * harness's, its identifier there the field at this index.
 */
const harnessNamespaceDepth = memoized(async (): Promise<number> => {
  const own = await readNSpid(process.pid);
  if (own === undefined || own.length === 0) {
    throw new Error("the harness cannot read its own NSpid line");
  }
  return own.length;
});

/** A process lying in a namespace below the harness's own. */
export interface NamespacedProcess {
  /** Its identifier in the harness's own process list. */
  readonly pid: number;
  /** Its identifier in the namespace one level below the harness's. */
  readonly inNamespace: number;
}

/**
 * The processes of the run started as `startedPid` — it and its descendants,
 * as the process list's parent links read now — that lie in a namespace
 * below the harness's own, ascending by in-namespace identifier.
 */
export async function namespacedProcessesOf(
  startedPid: number,
): Promise<NamespacedProcess[]> {
  requireLinux("pid-namespace", `process ${String(startedPid)}`);
  const depth = await harnessNamespaceDepth();
  const found: NamespacedProcess[] = [];
  for (const pid of [startedPid, ...(await descendantsOf(startedPid))]) {
    const nspid = await readNSpid(pid);
    const inNamespace = nspid?.[depth];
    if (inNamespace !== undefined) found.push({ pid, inNamespace });
  }
  return found.sort((a, b) => a.inNamespace - b.inNamespace || a.pid - b.pid);
}

/**
 * The in-namespace identifiers a run's processes bear now, ascending
 * (T13.5-10(f): compared across two runs; (g): verified listed in the
 * harness's own process list). `HarnessStagingError` (mode `pid-namespace`,
 * H-11) when no process of the run lies in a namespace below the harness's:
 * the staging did not take effect.
 */
export async function inNamespaceIdentifiers(run: {
  readonly pid: number | undefined;
  readonly commandLine: string;
}): Promise<number[]> {
  if (run.pid === undefined) {
    throw new Error(`${run.commandLine} was never spawned`);
  }
  const processes = await namespacedProcessesOf(run.pid);
  if (processes.length === 0) {
    throw new HarnessStagingError(
      "pid-namespace",
      run.commandLine,
      "no process of the run lies in a process-identifier namespace below the harness's own: the namespace staging did not take effect (H-11; TEST-SPEC T13.5-10(e)–(g))",
    );
  }
  return ascending(new Set(processes.map((entry) => entry.inNamespace)));
}

/**
 * T13.5-10(g)'s verification on the harness itself (H-11): every one of
 * `identifiers` — the in-namespace identifiers the held run's processes bear
 * or bore — is listed in the harness's own process list, so the dead run's
 * entry lies in 13.5's gap. A missing one is `HarnessStagingError` (mode
 * `pid-namespace`) naming it; `what` names the run.
 */
export async function verifyListedByHarness(
  identifiers: Iterable<number>,
  what: string,
): Promise<void> {
  const wanted = ascending(new Set(identifiers));
  if (wanted.length === 0) {
    throw new Error(`verifyListedByHarness(${what}): no identifier to verify`);
  }
  const listed = new Set(await listedAmong(wanted));
  const missing = wanted.filter((identifier) => !listed.has(identifier));
  if (missing.length > 0) {
    throw new HarnessStagingError(
      "pid-namespace",
      what,
      `T13.5-10(g)'s staging is ineffective (H-11): identifier(s) ${missing.join(", ")}, which ${what} bear(s) or bore in its namespace, are not listed in the harness's own process list, so its entry would not lie in 13.5's gap`,
    );
  }
}

/** A namespace's state, as its first process reads it (launcher B). */
export interface NamespaceObservation {
  /** The namespace's process list, ascending: every identifier in it. */
  readonly listed: readonly number[];
  /** The identifier the namespace allocated last (`ns_last_pid`). */
  readonly lastAllocated: number;
}

/**
 * The first process's answer to `observe` — `observed <last allocated>
 * <listed>…` — as a {@link NamespaceObservation}; an answer of another
 * shape is `HarnessStagingError` (mode `pid-namespace`).
 */
export function parseNamespaceObservation(line: string): NamespaceObservation {
  const match = /^observed ([1-9][0-9]*)((?: [1-9][0-9]*)+)$/.exec(line);
  if (match === null) {
    throw new HarnessStagingError(
      "pid-namespace",
      "the namespace's first process",
      `its answer does not read as \`observed <last allocated> <listed>…\`: ${JSON.stringify(line.slice(0, 300))}`,
    );
  }
  return {
    lastAllocated: Number(match[1]),
    listed: ascending(new Set((match[2] ?? "").trim().split(" ").map(Number))),
  };
}

/**
 * T13.5-10(e)'s reuse check, by `observation`: whether the namespace has
 * allocated an identifier as large as `identifier`. Allocation is cyclic
 * (T13.5-3): identifiers rise from 1 until they wrap at the maximum, so the
 * namespace has allocated one that large when its last allocated is, or
 * when it lists one above its last allocated — allocation has then wrapped,
 * having passed every identifier below the maximum. A wrap whose every
 * identifier above the last allocated was since freed reads as none: it
 * takes as many allocations as the maximum allows, out of reach within a
 * trial.
 */
export function hasAllocated(
  observation: NamespaceObservation,
  identifier: number,
): boolean {
  return (
    observation.lastAllocated >= identifier ||
    observation.listed.some((listed) => listed > observation.lastAllocated)
  );
}

/**
 * T13.5-10(e)'s other-machine verification on the harness itself, through
 * the namespace's first process (H-11): its process list lists none of
 * `identifiers` — those the held run's processes bear in the harness's
 * process list. A listed one is `HarnessStagingError` (mode
 * `pid-namespace`) naming it; `what` names the held run. Resolves with the
 * observation made.
 */
export async function verifyNamespaceListsNone(
  namespace: HarnessNamespace,
  identifiers: Iterable<number>,
  what: string,
): Promise<NamespaceObservation> {
  const wanted = ascending(new Set(identifiers));
  if (wanted.length === 0) {
    throw new Error(
      `verifyNamespaceListsNone(${what}): no identifier to verify`,
    );
  }
  const observation = await namespace.observe();
  const listed = wanted.filter((identifier) =>
    observation.listed.includes(identifier),
  );
  if (listed.length > 0) {
    throw new HarnessStagingError(
      "pid-namespace",
      what,
      `T13.5-10(e)'s other-machine staging is ineffective (H-11): the namespace's process list, read through its first process, lists identifier(s) ${listed.join(", ")} that ${what} bear(s) in the harness's process list`,
    );
  }
  return observation;
}

/** The shell a harness namespace's first process runs. */
const NAMESPACE_SHELL = "/bin/bash";
/** The environment it runs with. */
const NAMESPACE_SHELL_ENV: Readonly<Record<string, string>> = {
  LC_ALL: "C",
  PATH: "/usr/bin:/bin",
};

/**
 * The script a harness namespace's first process runs (module header):
 * bash builtins alone, so answering forks nothing and allocates no
 * identifier in the namespace. It prints `ready`, then answers each
 * `observe` line on its stdin with `observed <ns_last_pid> <listed>…` — the
 * identifier the namespace allocated last, then every numeric entry of the
 * `/proc` it sees, the namespace's own — and any other line with `unknown`,
 * and ends at the end of its stdin. As the namespace's first process it
 * adopts every orphan in the namespace, and bash's SIGCHLD handler reaps
 * every child, adopted or not, so a killed command leaves no zombie listed
 * there.
 */
export const NAMESPACE_FIRST_PROCESS_SCRIPT = [
  "printf 'ready\\n'",
  "while IFS= read -r request; do",
  '  if [ "$request" = observe ]; then',
  "    last=",
  "    IFS= read -r last < /proc/sys/kernel/ns_last_pid",
  "    listed=",
  "    for entry in /proc/[0-9]*; do",
  '      listed="$listed ${entry#/proc/}"',
  "    done",
  '    printf \'observed %s%s\\n\' "$last" "$listed"',
  "  else",
  "    printf 'unknown\\n'",
  "  fi",
  "done",
  "",
].join("\n");

/**
 * The arguments the namespace's shell runs its script with. `--norc`: the
 * harness's pipes to it are sockets, and a non-interactive bash whose stdin
 * is a socket would otherwise take itself for a remote shell and run the
 * user's `~/.bashrc` — commands of no one's choosing in the namespace,
 * allocating identifiers there.
 */
export const NAMESPACE_SHELL_ARGS: readonly string[] = [
  "--norc",
  "-c",
  NAMESPACE_FIRST_PROCESS_SCRIPT,
  "xspec-namespace",
];

/**
 * A fresh process-identifier namespace with a process list of its own whose
 * first process is the harness's own, outliving the commands entered into it
 * (launcher B; T13.5-10(e)'s run on another machine). Its test closes it.
 */
export interface HarnessNamespace {
  /** The first process's identifier in the harness's own process list. */
  readonly firstPid: number;
  /**
   * The subprocess driver's launcher entering each run into the namespace,
   * as the harness's identity with no capability; its kills go through
   * `sudo`.
   */
  readonly launcher: RunLauncher;
  /**
   * The namespace's process list and the identifier it allocated last, read
   * through its first process, which forks nothing to read them. An answer
   * not given within the bound, or not of its shape, is
   * `HarnessStagingError` (mode `pid-namespace`).
   */
  observe(): Promise<NamespaceObservation>;
  /**
   * Ends the namespace under T13.5-3's discipline: its first process's
   * group killed through `sudo` — SIGKILL reaching the first process from
   * outside, the kernel then killing every process in the namespace — its
   * exit collected, and none of its processes left listed. Idempotent.
   */
  close(): Promise<void>;
}

/** Whether `pending` settles within `ms`. */
async function settlesWithin(
  pending: Promise<unknown>,
  ms: number,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => {
      resolve(false);
    }, ms);
  });
  try {
    return await Promise.race([
      pending.then(
        () => true,
        () => true,
      ),
      expired,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** A harness namespace's first process, as the harness drives it. */
class FirstProcess implements HarnessNamespace {
  readonly #child: ChildProcess;
  readonly #plan: NamespaceSpawnPlan;
  #firstPid: number | undefined;
  #launcher: RunLauncher | undefined;
  /** Its stdout read so far past the last whole line. */
  #partial = "";
  /** Whole lines of its stdout not yet taken. */
  readonly #lines: string[] = [];
  /** Its stdout ended, or it never started: no more lines. */
  #ended = false;
  #stderr = "";
  #spawnError: Error | undefined;
  #wake: (() => void) | undefined;
  /** Requests are answered one at a time, in order. */
  #queue: Promise<unknown> = Promise.resolve();
  #closing: Promise<void> | undefined;
  /** Settles once the started process has exited, or failed to start. */
  readonly #exited: Promise<void>;

  constructor(child: ChildProcess, plan: NamespaceSpawnPlan) {
    this.#child = child;
    this.#plan = plan;
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      this.#partial += chunk;
      for (
        let at = this.#partial.indexOf("\n");
        at >= 0;
        at = this.#partial.indexOf("\n")
      ) {
        this.#lines.push(this.#partial.slice(0, at));
        this.#partial = this.#partial.slice(at + 1);
      }
      this.#notify();
    });
    child.stdout?.on("end", () => {
      this.#ended = true;
      this.#notify();
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (this.#stderr.length < NAMESPACE_STDERR_LIMIT) this.#stderr += chunk;
    });
    // A write to a first process that has ended fails (EPIPE); its end is
    // reported where an answer is awaited.
    child.stdin?.on("error", () => undefined);
    this.#exited = new Promise<void>((resolve) => {
      child.once("exit", () => {
        resolve();
      });
      child.once("error", (error) => {
        this.#spawnError = error;
        this.#ended = true;
        this.#notify();
        resolve();
      });
    });
  }

  get firstPid(): number {
    if (this.#firstPid === undefined) {
      throw new Error("the harness namespace's first process is not located");
    }
    return this.#firstPid;
  }

  get launcher(): RunLauncher {
    if (this.#launcher === undefined) {
      throw new Error("the harness namespace's first process is not located");
    }
    return this.#launcher;
  }

  /**
   * Waits for `ready`, locates the first process in the harness's process
   * list — the started process's one descendant bearing identifier 1 in a
   * namespace below the harness's — and verifies on itself that the
   * namespace is fresh, with a process list of its own: its first process
   * alone listed, the last identifier allocated its own. Anything else is
   * `HarnessStagingError` (mode `pid-namespace`, H-11).
   */
  async start(): Promise<void> {
    const ready = await this.#nextLine("reporting `ready`");
    if (ready !== "ready") {
      throw this.#failure(
        `reported ${JSON.stringify(ready.slice(0, 300))} where \`ready\` was due`,
      );
    }
    const startedPid = this.#child.pid;
    if (startedPid === undefined) throw this.#failure("was never spawned");
    const firsts = (await namespacedProcessesOf(startedPid)).filter(
      (entry) => entry.inNamespace === FIRST_IDENTIFIER,
    );
    const first = firsts[0];
    if (first === undefined || firsts.length !== 1) {
      throw this.#failure(
        `was not found as the one descendant of the started process (${String(startedPid)}) bearing identifier 1 in a namespace below the harness's: found ${firsts.map((entry) => String(entry.pid)).join(", ") || "none"}`,
      );
    }
    const observation = await this.observe();
    if (
      observation.lastAllocated !== FIRST_IDENTIFIER ||
      !sameNumbers(observation.listed, [FIRST_IDENTIFIER])
    ) {
      throw new HarnessStagingError(
        "pid-namespace",
        "a harness namespace",
        `the namespace is not fresh with a process list of its own (H-11): its first process, just started, read its process list as ${observation.listed.slice(0, 20).join(", ")} and the last identifier allocated as ${String(observation.lastAllocated)}, where itself alone, identifier 1, is due`,
      );
    }
    const firstPid = first.pid;
    const plan = this.#plan;
    this.#firstPid = firstPid;
    this.#launcher = {
      label: `entered into a fresh process-identifier namespace whose first process (${String(firstPid)}) is the harness's own, through ${plan.sudo} (H-2; TEST-SPEC T13.5-10(e))`,
      wrap: (invocation, env, cwd) => {
        if (this.#closing !== undefined) {
          throw new Error(
            `the harness namespace whose first process is ${String(firstPid)} is closed: nothing can be entered into it`,
          );
        }
        return {
          ...namespaceEntrySpawn(plan, firstPid, invocation, env, cwd),
          env: harnessEnvironment(),
        };
      },
      killGroup: (groupId) =>
        killGroupThroughSudo(groupId, plan.sudo, "pid-namespace"),
    };
  }

  async observe(): Promise<NamespaceObservation> {
    return await this.#serialized(async () => {
      if (this.#closing !== undefined) {
        throw new Error("observe: the harness namespace is closed");
      }
      this.#child.stdin?.write("observe\n");
      return parseNamespaceObservation(
        await this.#nextLine("answering `observe`"),
      );
    });
  }

  async close(): Promise<void> {
    this.#closing ??= this.#closeOnce();
    await this.#closing;
  }

  async #closeOnce(): Promise<void> {
    const what = "a harness namespace's first process";
    const groupId = this.#child.pid;
    try {
      if (groupId === undefined) {
        await this.#exited;
        return;
      }
      // As RunningProduct.killGroup (T13.5-3's discipline): read before the
      // members, since a reaped process's number may name another process.
      const reapedBefore =
        this.#child.exitCode !== null || this.#child.signalCode !== null;
      const members = (await processGroupMembers(groupId)).map(
        (member) => member.pid,
      );
      const descendants = reapedBefore ? [] : await descendantsOf(groupId);
      const reaped =
        this.#child.exitCode !== null || this.#child.signalCode !== null;
      if (!reaped || members.length > 0) {
        await killGroupThroughSudo(groupId, this.#plan.sudo, "pid-namespace");
      }
      const started = Date.now();
      if (!(await settlesWithin(this.#exited, DEFAULT_GROUP_GONE_TIMEOUT_MS))) {
        throw new ProcessGroupLingerError(
          what,
          groupId,
          "exit",
          Date.now() - started,
          [],
          [],
        );
      }
      await confirmGroupGone(
        groupId,
        [groupId, ...members, ...descendants],
        what,
      );
    } finally {
      this.#child.stdin?.destroy();
      this.#child.stdout?.destroy();
      this.#child.stderr?.destroy();
    }
  }

  #serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(operation, operation);
    this.#queue = result.catch(() => undefined);
    return result;
  }

  #notify(): void {
    const wake = this.#wake;
    this.#wake = undefined;
    wake?.();
  }

  /** The first process's next whole stdout line, bounded. */
  async #nextLine(what: string): Promise<string> {
    const deadline = Date.now() + NAMESPACE_TIMEOUT_MS;
    for (;;) {
      const line = this.#lines.shift();
      if (line !== undefined) return line;
      if (this.#ended) throw this.#failure(`ended before ${what}`);
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw this.#failure(
          `gave no answer within ${String(NAMESPACE_TIMEOUT_MS)} ms ${what}`,
        );
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.#wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      this.#wake = undefined;
    }
  }

  #failure(detail: string): HarnessStagingError {
    const spawnError =
      this.#spawnError === undefined
        ? ""
        : ` (${describeError(this.#spawnError)})`;
    return new HarnessStagingError(
      "pid-namespace",
      "a harness namespace's first process",
      `the first process of a fresh process-identifier namespace ${detail}${spawnError}; its stderr: ${JSON.stringify(this.#stderr.slice(0, 2000))}`,
    );
  }
}

/**
 * Launcher B (module header): opens a fresh process-identifier namespace
 * with a process list of its own whose first process is the harness's own —
 * a bash running {@link NAMESPACE_FIRST_PROCESS_SCRIPT} as the harness's
 * identity with no capability — verified fresh on the harness itself, and
 * hands back its launcher and its observations (T13.5-10(e); H-2, E-1, E-3).
 * Checks administrative access first; any failure is `HarnessStagingError`,
 * never a skip, nothing left running. The test closes it.
 */
export async function openHarnessNamespace(
  options: NamespaceOptions = {},
): Promise<HarnessNamespace> {
  const sudo = options.sudo ?? DEFAULT_SUDO;
  requireLinux("pid-namespace", "a harness namespace");
  await requireAdministrativeAccess({ sudo });
  const plan = await namespacePlan(sudo);
  const spawned = freshNamespaceSpawn(
    plan,
    {
      command: NAMESPACE_SHELL,
      args: NAMESPACE_SHELL_ARGS,
    },
    NAMESPACE_SHELL_ENV,
  );
  const child = spawn(spawned.command, spawned.args, {
    cwd: "/",
    env: harnessEnvironment(),
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });
  const namespace = new FirstProcess(child, plan);
  try {
    await namespace.start();
  } catch (error) {
    await namespace.close().catch(() => undefined);
    throw error;
  }
  return namespace;
}
