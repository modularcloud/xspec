// E-6's exclusion probe, its platform half: the held run's kill and T13.5-3's
// reuse check on each CI leg (TEST-SPEC E-6, T13.5-3, H-11; SPEC 13.5).
// Harness machinery only: no product imports, no test framework dependence.
// The probe itself — the held `rename` killed, started again to take the
// leftover over, the file-form `move` refused while it holds — is the
// representative fixture's (helpers/e6.ts).
//
// - The Linux leg: T13.5-3's exit-collection discipline as every Linux test
//   applies it (`killHeldRun`, helpers/lock-staging.ts) — the held run leads
//   a process group of its own, the whole group is killed with SIGKILL, the
//   exit of the process started is collected, and no process of the group
//   is still listed in the process list (`/proc`, a zombie counting as
//   listed) before the next step; the reuse check reads that list
//   (`applyReuseCheck`, helpers/kill-discipline.ts).
// - The Windows leg (E-6): the platform's forced termination of the run and
//   every process it started — `taskkill /PID <pid> /T /F`: TerminateProcess,
//   uncatchable, involving no POSIX signal — the run's process tree read from
//   Windows' process list while it holds, just before the kill: the started
//   process and every process descending from it, each identified by its
//   identifier and its creation time, so that a recurring identifier is
//   never taken for it (a parent link naming an identifier since reused is
//   no link: a child is never created before its parent). The exit of the
//   process started is then collected and every process of the tree
//   confirmed terminated — gone from the process list — before the next
//   step, each wait bounded, exhaustion a harness error (H-11), never a
//   diagnosed product failure. The process list is read through
//   `Get-CimInstance Win32_Process` in Windows PowerShell (present on every
//   Windows the leg runs on), its script passed encoded so that no quoting
//   intervenes, its standard input the null device; each line carries a
//   process's identifier, its parent's, and its creation time (FILETIME,
//   UTC), and an end line carries the count, so a truncated listing is a
//   harness error, never a short list. The reuse check reads the same list,
//   by identifier alone — what 13.5's gap turns on: on Windows a freed
//   identifier may recur promptly (E-6).
// - Either leg: the kill is the probe's — a run that ended on its own before
//   it, or never held, fails diagnosed — and afterwards the hold file is
//   removed and `.xspec/lock` holds exactly one entry, a plain file: the dead
//   run's, a leftover (SPEC 13.5: an abnormal termination leaves its entry).
// - Any other platform is a harness error: E-6's legs are Linux and Windows
//   (H-9: never a skip).

import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fail, HarnessAssertionError } from "./assertions.js";
import {
  applyReuseCheck,
  DEFAULT_GROUP_GONE_TIMEOUT_MS,
  voidTrial,
} from "./kill-discipline.js";
import { LOCK_PATH } from "./lock-path.js";
import type { LockEntry } from "./lock-staging.js";
import { killHeldRun } from "./lock-staging.js";
import { assertLockDirectoryEntries } from "./lock-state.js";
import type { ProductBinding, RunningProduct } from "./subprocess.js";
import {
  pathExists,
  releaseHoldFile,
  rethrowHarnessError,
  startProduct,
  summarizeResult,
} from "./subprocess.js";

/** The held run E-6's probe kills. */
export interface E6HeldKillOptions {
  /** The workspace root: the run's working directory (H-1). */
  readonly root: string;
  /** The mutating command, without `--test-hold`. */
  readonly argv: readonly string[];
  /** The hold path: absolute, outside the workspace, nothing there yet. */
  readonly holdPath: string;
  /** Names the run in every diagnosis. */
  readonly context: string;
}

/** A held run killed under its leg's discipline. */
export interface E6KilledRun {
  /**
   * Every identifier the killed run's processes bore, ascending: what
   * T13.5-3's reuse check looks for (`e6ReuseCheck`).
   */
  readonly identifiers: readonly number[];
  /** The lock directory's one entry after the kill: the dead run's. */
  readonly entry: LockEntry;
}

/**
 * Start `options.argv` with `--test-hold <holdPath>` in the workspace at
 * `options.root`, wait until it holds, and kill it under its leg's
 * discipline (module header); the hold file is removed afterwards. Fails
 * diagnosed when the run never holds, ends on its own before the kill, or
 * leaves anything at `.xspec/lock` but a directory holding exactly one
 * entry, a plain file (SPEC 13.5: an abnormal termination leaves its entry;
 * TEST-SPEC E-6). Harness errors — a run whose termination cannot be
 * confirmed, an unreadable process list — propagate as such.
 */
export async function killHeldE6Run(
  product: ProductBinding,
  options: E6HeldKillOptions,
): Promise<E6KilledRun> {
  switch (process.platform) {
    case "linux": {
      const dead = await killHeldRun(product, options);
      return { identifiers: dead.killed.identifiers, entry: dead.entry };
    }
    case "win32":
      return await killHeldWindowsRun(product, options);
    default:
      throw unsupportedPlatform("killHeldE6Run");
  }
}

/**
 * T13.5-3's reuse check on either leg, for a later command refused after
 * `killed` was killed (`refusal` describes it, its command line and
 * outcome): should any of `killed`'s identifiers be listed again in the
 * leg's process list — reused since — the trial is void (`TrialVoided`,
 * E-5), rerun by the caller; none listed, the test fails, diagnosed: a dead
 * run's leftover blocked a later command, which SPEC 13.5 forbids outside
 * its gap. Never returns.
 */
export async function e6ReuseCheck(
  killed: Pick<E6KilledRun, "identifiers">,
  refusal: string,
): Promise<never> {
  switch (process.platform) {
    case "linux":
      return await applyReuseCheck(killed.identifiers, refusal);
    case "win32":
      return await windowsReuseCheck(killed.identifiers, refusal);
    default:
      throw unsupportedPlatform("e6ReuseCheck");
  }
}

function unsupportedPlatform(what: string): Error {
  return new Error(
    `${what}: E-6's exclusion probe runs on its two CI legs, Linux and ` +
      `Windows (TEST-SPEC E-6); this platform is ${process.platform}, where ` +
      `it can neither kill a held run under T13.5-3's discipline nor read ` +
      `the process list — a harness error, never a skip (H-9)`,
  );
}

// ---------------------------------------------------------------------------
// Windows' process list

/** One process as Windows' process list reports it. */
export interface WindowsProcess {
  readonly pid: number;
  /** Its parent's identifier, as recorded when it was created. */
  readonly ppid: number;
  /**
   * Its creation time: a FILETIME (100-nanosecond intervals since 1601,
   * UTC); 0 where the list reports none (the idle process) or none a
   * FILETIME can express.
   */
  readonly created: bigint;
}

const PROCESS_LINE = /^([0-9]+) ([0-9]+) ([0-9]+)$/;
const END_LINE = /^END ([0-9]+)$/;

/**
 * Parse the process-list script's output (`readWindowsProcessList`): one
 * line `<pid> <ppid> <created>` per process, then `END <count>`, lines
 * ended by CR LF or LF. Anything else — a malformed line, no end line, a
 * count that is not the number of lines — throws: a harness error, never a
 * short list.
 */
export function parseWindowsProcessList(text: string): WindowsProcess[] {
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const last = lines.pop();
  const end = last === undefined ? null : END_LINE.exec(last);
  if (end === null) {
    throw new Error(
      `Windows' process list: the listing does not end with its END line ` +
        `(truncated or not the script's output): ${excerpt(text)}`,
    );
  }
  const processes = lines.map((line, index): WindowsProcess => {
    const match = PROCESS_LINE.exec(line);
    if (match === null) {
      throw new Error(
        `Windows' process list: line ${String(index + 1)} does not read ` +
          `as \`<pid> <ppid> <created>\`: ${JSON.stringify(line)}`,
      );
    }
    return {
      pid: Number(match[1]),
      ppid: Number(match[2]),
      created: BigInt(match[3]!),
    };
  });
  if (processes.length !== Number(end[1])) {
    throw new Error(
      `Windows' process list: ${String(processes.length)} process line(s) ` +
        `where the END line counts ${end[1]!}`,
    );
  }
  return processes;
}

/**
 * The process `rootPid` names and every process descending from it, as
 * `list` reads, ascending by identifier; empty when `list` lists no such
 * process. A parent link counts only from a parent created no later than
 * its child: Windows keeps a process's parent identifier after the parent
 * ends, and the identifier may since name another process.
 */
export function windowsProcessTree(
  list: readonly WindowsProcess[],
  rootPid: number,
): WindowsProcess[] {
  const root = list.find((entry) => entry.pid === rootPid);
  if (root === undefined) return [];
  const children = new Map<number, WindowsProcess[]>();
  for (const entry of list) {
    if (entry.ppid === entry.pid) continue;
    const siblings = children.get(entry.ppid) ?? [];
    siblings.push(entry);
    children.set(entry.ppid, siblings);
  }
  const tree: WindowsProcess[] = [root];
  const seen = new Set<number>([root.pid]);
  for (let index = 0; index < tree.length; index += 1) {
    const parent = tree[index]!;
    for (const child of children.get(parent.pid) ?? []) {
      if (seen.has(child.pid) || child.created < parent.created) continue;
      seen.add(child.pid);
      tree.push(child);
    }
  }
  return tree.sort((a, b) => a.pid - b.pid);
}

/** The process-list script: one line per process, then `END <count>`. */
const PROCESS_LIST_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$ProgressPreference = 'SilentlyContinue'",
  "$inv = [Globalization.CultureInfo]::InvariantCulture",
  "$n = 0",
  "foreach ($p in @(Get-CimInstance -ClassName Win32_Process)) {",
  "  $c = [Int64]0",
  "  if ($null -ne $p.CreationDate) {",
  "    try { $c = $p.CreationDate.ToFileTimeUtc() } catch { $c = [Int64]0 }",
  "  }",
  "  [Console]::Out.WriteLine([string]::Format($inv, '{0} {1} {2}', $p.ProcessId, $p.ParentProcessId, $c))",
  "  $n += 1",
  "}",
  "[Console]::Out.WriteLine([string]::Format($inv, 'END {0}', $n))",
].join("\n");

/** Bound on one reading of Windows' process list (PowerShell's start included). */
const PROCESS_LIST_TIMEOUT_MS = 120_000;
/** Interval between readings while a termination is confirmed. */
const WINDOWS_POLL_MS = 250;

/**
 * Windows' process list, read now: every listed process (module header).
 * A failure to read it is a harness error (H-11).
 */
export async function readWindowsProcessList(): Promise<WindowsProcess[]> {
  const encoded = Buffer.from(PROCESS_LIST_SCRIPT, "utf16le").toString(
    "base64",
  );
  const outcome = await runWindowsCommand(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    PROCESS_LIST_TIMEOUT_MS,
  );
  if (outcome.exitCode !== 0) {
    throw new Error(
      `harness error (H-11): reading Windows' process list ` +
        `(\`powershell.exe … Get-CimInstance Win32_Process\`) failed: ` +
        `${describeOutcome(outcome)}`,
    );
  }
  try {
    return parseWindowsProcessList(outcome.stdout);
  } catch (error) {
    throw new Error(
      `harness error (H-11): ${(error as Error).message}; stderr: ` +
        `${excerpt(outcome.stderr)}`,
      { cause: error },
    );
  }
}

interface CommandOutcome {
  readonly commandLine: string;
  /** Null when it ended otherwise (killed at its bound). */
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Run a Windows command to completion — its standard input the null
 * device, so nothing waits on it — killed at `timeoutMs`; a failure to
 * start rejects.
 */
async function runWindowsCommand(
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<CommandOutcome> {
  const commandLine = [command, ...args].join(" ");
  return await new Promise<CommandOutcome>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(
        new Error(
          `harness error (H-11): cannot run \`${command}\`: ${error.message}`,
          { cause: error },
        ),
      );
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        commandLine,
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function describeOutcome(outcome: CommandOutcome): string {
  return (
    `\`${outcome.commandLine.slice(0, 200)}\` ended with ` +
    `${outcome.exitCode === null ? "no exit code (killed at its bound)" : `exit code ${String(outcome.exitCode)}`}; ` +
    `stdout: ${excerpt(outcome.stdout)}; stderr: ${excerpt(outcome.stderr)}`
  );
}

function excerpt(text: string): string {
  if (text === "") return "<empty>";
  return text.length > 1000 ? `${text.slice(0, 1000)}…` : text;
}

/** A process rendered for a diagnosis. */
function describeWindowsProcess(entry: WindowsProcess): string {
  return (
    `${String(entry.pid)} (parent ${String(entry.ppid)}, created ` +
    `${entry.created.toString()})`
  );
}

// ---------------------------------------------------------------------------
// The Windows leg's kill

/** Bound on a hold's appearance: the run's start included. */
const WINDOWS_HOLD_WAIT_MS = 30_000;
/** Hang guard of the held run: never an assertion input (H-10). */
const WINDOWS_HELD_RUN_TIMEOUT_MS = 120_000;
/** taskkill's exit code for a process it did not find. */
const TASKKILL_NOT_FOUND = 128;

/**
 * The Windows leg's kill (module header): the run held, its process tree
 * read, the tree terminated by force (`taskkill /T /F`), the exit of the
 * process started collected, and every process of the tree confirmed gone
 * from the process list, each bounded.
 */
async function killHeldWindowsRun(
  product: ProductBinding,
  options: E6HeldKillOptions,
): Promise<E6KilledRun> {
  const { root, holdPath, context } = options;
  requireOutsideHoldPath(root, holdPath);
  if (await pathExists(holdPath)) {
    throw new Error(`killHeldE6Run: the hold path ${holdPath} is occupied`);
  }
  const running = await startProduct(product, {
    cwd: root,
    argv: [...options.argv, "--test-hold", holdPath],
    timeoutMs: WINDOWS_HELD_RUN_TIMEOUT_MS,
  });
  let tree: WindowsProcess[] = [];
  try {
    try {
      await running.waitForFile(holdPath, { timeoutMs: WINDOWS_HOLD_WAIT_MS });
    } catch (error) {
      rethrowHarnessError(error);
      fail(
        `${context}: the held command must create its hold file at ` +
          `${holdPath} once it holds workspace exclusivity, and hold until ` +
          `the file is deleted (SPEC 13.5), so that it can be killed while ` +
          `held — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const pid = running.pid;
    if (pid === undefined) {
      throw new Error(`killHeldE6Run: ${running.commandLine} has no pid`);
    }
    tree = windowsProcessTree(await readWindowsProcessList(), pid);
    if (running.hasExited()) await endedOnItsOwn(running, context);
    if (tree.length === 0) {
      throw new Error(
        `harness error (H-11): Windows' process list, read while ` +
          `${running.commandLine} held, does not list its process ${String(pid)}`,
      );
    }
    const kill = await runWindowsCommand(
      "taskkill.exe",
      ["/PID", String(pid), "/T", "/F"],
      PROCESS_LIST_TIMEOUT_MS,
    );
    const collected = await settlesWithin(
      running.waitForExit(),
      DEFAULT_GROUP_GONE_TIMEOUT_MS,
    );
    if (kill.exitCode !== 0) {
      if (collected && kill.exitCode === TASKKILL_NOT_FOUND) {
        // The run was gone before the kill reached it.
        await endedOnItsOwn(running, context);
      }
      throw new Error(
        `harness error (H-11): E-6's forced termination of ${context} ` +
          `failed: ${describeOutcome(kill)}`,
      );
    }
    if (!collected) {
      throw new Error(
        `harness error (H-11): E-6's forced termination: the exit of ` +
          `${running.commandLine} was not collected within ` +
          `${String(DEFAULT_GROUP_GONE_TIMEOUT_MS)} ms of \`taskkill /T /F\` ` +
          `— the next step cannot start; never a diagnosed product failure`,
      );
    }
    try {
      await running.waitForExit();
    } catch (error) {
      rethrowHarnessError(error);
      fail(
        `${context}: the held run, killed while held, ended with an error: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await confirmWindowsTreeGone(tree, running.commandLine);
  } catch (error) {
    // Whatever still runs of the tree goes before the hold is lifted and
    // the failure propagates.
    await terminateWindowsRunBestEffort(running);
    throw error;
  } finally {
    await releaseHoldFile(holdPath);
  }
  const [entry] = await assertLockDirectoryEntries(
    root,
    { entries: 1 },
    `${context}: after the kill, ${LOCK_PATH} holds exactly one entry, ` +
      `a plain file — the dead run's, a leftover (SPEC 13.5: an abnormal ` +
      `termination leaves its entry; TEST-SPEC E-6)`,
  );
  return { identifiers: tree.map((member) => member.pid), entry: entry! };
}

/** The held run ended before the kill: a diagnosed failure. */
async function endedOnItsOwn(
  running: RunningProduct,
  context: string,
): Promise<never> {
  const outcome = await running
    .waitForExit()
    .then(summarizeResult, (error: unknown) => {
      rethrowHarnessError(error);
      return error instanceof Error ? error.message : String(error);
    });
  return fail(
    `${context}: the held run ended on its own before the kill — ` +
      `${outcome} — where a held run waits until its hold file is deleted ` +
      `(SPEC 13.5)`,
  );
}

/**
 * Confirm every process of `tree` — each by identifier and creation time —
 * gone from Windows' process list, polling, bounded; exhaustion is a
 * harness error (H-11).
 */
async function confirmWindowsTreeGone(
  tree: readonly WindowsProcess[],
  what: string,
): Promise<void> {
  const started = Date.now();
  for (;;) {
    const listed = new Map(
      (await readWindowsProcessList()).map((entry) => [entry.pid, entry]),
    );
    const lingering = tree.filter(
      (entry) => listed.get(entry.pid)?.created === entry.created,
    );
    if (lingering.length === 0) return;
    const waitedMs = Date.now() - started;
    if (waitedMs >= DEFAULT_GROUP_GONE_TIMEOUT_MS) {
      throw new Error(
        `harness error (H-11): E-6's forced termination could not confirm ` +
          `the process tree of ${what} terminated: ` +
          `${lingering.map(describeWindowsProcess).join(", ")} still listed ` +
          `${String(waitedMs)} ms after \`taskkill /T /F\` — the next step ` +
          `cannot start; never a diagnosed product failure`,
      );
    }
    await sleep(WINDOWS_POLL_MS);
  }
}

/**
 * Terminate whatever still runs of `running`'s tree and collect its exit,
 * bounded — the cleanup before a verdict that does not depend on it; its
 * own failures are not that verdict's concern.
 */
async function terminateWindowsRunBestEffort(
  running: RunningProduct,
): Promise<void> {
  const pid = running.pid;
  if (!running.hasExited() && pid !== undefined) {
    await runWindowsCommand(
      "taskkill.exe",
      ["/PID", String(pid), "/T", "/F"],
      PROCESS_LIST_TIMEOUT_MS,
    ).catch(() => undefined);
  }
  await settlesWithin(running.waitForExit(), DEFAULT_GROUP_GONE_TIMEOUT_MS);
}

/** T13.5-3's reuse check on the Windows leg (`e6ReuseCheck`). */
async function windowsReuseCheck(
  killed: readonly number[],
  refusal: string,
): Promise<never> {
  const identifiers = [...new Set(killed)].sort((a, b) => a - b);
  const listed = new Set(
    (await readWindowsProcessList()).map((entry) => entry.pid),
  );
  const listedAgain = identifiers.filter((id) => listed.has(id));
  if (listedAgain.length > 0) {
    voidTrial(
      `T13.5-3's reuse check (E-6, the Windows leg): identifier(s) ` +
        `${listedAgain.join(", ")} of the killed run's process tree are ` +
        `listed again in the process list (reused), so the refusal may be ` +
        `13.5's gap — the trial is void, rerun from the workspace's copy ` +
        `taken before the kill: ${refusal}`,
    );
  }
  throw new HarnessAssertionError(
    `${refusal}: refused workspace-busy (14.26), yet no identifier of the ` +
      `killed run's process ` +
      `tree — ${identifiers.join(", ") || "none recorded"} — is listed in ` +
      `the process list: a dead run's leftover blocked a later mutating ` +
      `command, which SPEC 13.5 forbids outside its gap (TEST-SPEC E-6, ` +
      `T13.5-3's reuse check)`,
  );
}

// ---------------------------------------------------------------------------
// Shared

/** The hold path must be absolute and lie outside the workspace. */
function requireOutsideHoldPath(root: string, holdPath: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(holdPath));
  const inside =
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (!path.isAbsolute(holdPath) || inside) {
    throw new Error(
      `killHeldE6Run: the hold path ${holdPath} must be absolute and lie ` +
        `outside the workspace ${root} (TEST-SPEC §13.5's preamble)`,
    );
  }
}

/** Whether `pending` settles — resolved or rejected — within `ms`. */
export async function settlesWithin(
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
