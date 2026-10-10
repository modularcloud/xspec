// 13.5's machine-wide stagings I: the second user, the second mount, and the
// launcher that starts runs as the second user (TEST-SPEC H-2, E-1, E-3,
// T13.5-9; H-11). Harness machinery only: no product imports, no test
// framework dependence.
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
// - Platform: the Linux leg's. On any other platform every staging throws
//   `HarnessStagingError` at once.

import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";
import { listedAmong, processGroupMembers } from "./kill-discipline.js";
import { HarnessStagingError } from "./permissions.js";
import type { StagingMode } from "./permissions.js";
import { startProduct, summarizeResult } from "./subprocess.js";
import type { ProductBinding, RunLauncher } from "./subprocess.js";

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
  if (
    !path.isAbsolute(invocation.command) ||
    invocation.command.includes("=")
  ) {
    throw new Error(
      `the second user's launcher starts an absolute command holding no \`=\` (env -i would read one as an assignment), not ${JSON.stringify(invocation.command)}`,
    );
  }
  const assignments: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (name === "" || name.includes("=")) {
      throw new Error(
        `the second user's launcher cannot pass an environment variable named ${JSON.stringify(name)}`,
      );
    }
    assignments.push(`${name}=${value}`);
  }
  return {
    command: plan.sudo,
    args: [
      "-n",
      "--",
      "/bin/sh",
      "-c",
      'umask "$1" && shift && exec "$@"',
      "sh",
      plan.umask.toString(8).padStart(4, "0"),
      "prlimit",
      ...plan.limits,
      "--",
      "setpriv",
      `--reuid=${String(plan.user.uid)}`,
      `--regid=${String(plan.user.gid)}`,
      "--init-groups",
      "--inh-caps=-all",
      "--bounding-set=-all",
      "--",
      "env",
      "-i",
      "--",
      ...assignments,
      invocation.command,
      ...invocation.args,
    ],
  };
}

/** SIGKILL to process group `groupId` through `sudo` (the launcher's kill). */
async function killGroupThroughSudo(groupId: number): Promise<void> {
  const outcome = await runAdministrative([
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
    "second-user",
    `process group ${String(groupId)}`,
    `\`sudo -n kill -s KILL -- -${String(groupId)}\` failed (${describeOutcome(outcome)}) while the group still has listed processes`,
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
    wrap: (invocation, env) => {
      const sudoEnv: Record<string, string> = {};
      for (const [name, value] of Object.entries(process.env)) {
        if (value !== undefined) sudoEnv[name] = value;
      }
      return { ...secondUserSpawn(plan, invocation, env), env: sudoEnv };
    },
    killGroup: killGroupThroughSudo,
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
