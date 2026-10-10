// 13.5's machine-wide stagings I (helpers/machine-staging.ts) where they need
// the administrative access GitHub's hosted Linux runners grant the job
// (TEST-SPEC H-2, E-1, E-3, T13.5-9; H-11): this file runs where that access
// is — CI's Linux legs, through .github/scripts/run-without-network.sh — and
// fails there, as harness errors, never skips (H-9), where it is withheld.
// A machine whose harness runs get no administrative access leaves this file
// out of its command line (AGENTS.md: the `*.admin.test.ts` files).
//
// - The second user is made idempotently under its fixed name: makers
//   running at once agree, a maker after them finds it; it shares the
//   harness's group, its uid neither the harness's nor root's (E-3).
// - A run launched as the second user gets exactly the environment (no
//   `SUDO_*`), working directory, argv, umask, and resource limits a run
//   started directly gets, as the second user's uid and the shared group with
//   no capability, in the process group `sudo` leads — the run's own — its
//   exit code, stdout, and stderr observed.
// - The second user's verification passes on a group-staged workspace and
//   fails as a harness error where the group cannot reach it; whether the
//   second user can create and remove a file in a directory is answered
//   unjudged.
// - A launched run's processes, which the harness's own identity may not
//   signal, are killed through the launcher: `killGroup` reaches the run's
//   grandchild and leaves nothing listed, and so does the hang guard.
// - The second mount is made at a path under the workspace's own temporary
//   directory, verified, and removed.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  confirmGroupGone,
  listedAmong,
  readListedProcess,
} from "../helpers/kill-discipline.js";
import {
  createSecondUser,
  ensureSecondUser,
  mountAt,
  parseMountInfo,
  SECOND_USER_NAME,
  secondUserCreatesIn,
  secondUserLauncher,
  stageGroupAccess,
  stageSecondMount,
  verifySecondMount,
  verifySecondUserReach,
} from "../helpers/machine-staging.js";
import type { SecondMount } from "../helpers/machine-staging.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import {
  builtProductBinding,
  ProductRunTimeoutError,
  runProduct,
  startProduct,
} from "../helpers/subprocess.js";
import type { ProductBinding, RunningProduct } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";

/** What a promise rejects with; null when it resolves. */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return await pending.then(
    () => null,
    (thrown: unknown) => thrown,
  );
}

function harnessUid(): number {
  if (process.getuid === undefined) throw new Error("no uid here");
  return process.getuid();
}

function harnessGid(): number {
  if (process.getgid === undefined) throw new Error("no gid here");
  return process.getgid();
}

/** A scratch directory the shared group may use, removed at the end. */
async function sharedScratch(): Promise<string> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "xspec-machine-"));
  await fsp.chmod(dir, 0o770);
  onTestFinished(() => fsp.rm(dir, { recursive: true, force: true }));
  return dir;
}

// A stand-in run as the second user. `report` prints what it was started
// with and as, and exits 7; `group` and `hang` start a grandchild in the
// stand-in's own process group sharing its streams, record both identifiers
// (written whole, then renamed into place), then (`group`) write the hold
// file, and idle.
const STANDIN_SOURCE = `import { spawn } from "node:child_process";
import fs from "node:fs";

const [mode, ...args] = process.argv.slice(2);
const idle = () => setInterval(() => {}, 60000);
const statFields = () => {
  const stat = fs.readFileSync("/proc/self/stat", "latin1");
  return stat.slice(stat.lastIndexOf(")") + 2).split(" ");
};
const statusField = (name) => {
  const line = fs
    .readFileSync("/proc/self/status", "latin1")
    .split("\\n")
    .find((candidate) => candidate.startsWith(name + ":"));
  return line === undefined ? null : line.slice(name.length + 1).trim();
};
const recordPids = (file) => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60000)"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  fs.writeFileSync(file + ".tmp", JSON.stringify({ self: process.pid, grandchild: child.pid }));
  fs.renameSync(file + ".tmp", file);
};
switch (mode) {
  case "report": {
    const [, ppid, pgrp] = statFields();
    process.stdout.write(
      JSON.stringify({
        env: process.env,
        argv: args,
        cwd: process.cwd(),
        uid: process.getuid(),
        gid: process.getgid(),
        groups: process.getgroups(),
        umask: statusField("Umask"),
        caps: ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"].map(statusField),
        limits: fs.readFileSync("/proc/self/limits", "latin1"),
        pid: process.pid,
        ppid: Number(ppid),
        pgrp: Number(pgrp),
      }),
    );
    process.stderr.write("to stderr");
    process.exit(7);
    break;
  }
  case "group":
    recordPids(args[1]);
    fs.writeFileSync(args[0], "");
    idle();
    break;
  case "hang":
    recordPids(args[0]);
    idle();
    break;
  default:
    idle();
}
`;

interface Report {
  readonly env: Record<string, string>;
  readonly argv: string[];
  readonly cwd: string;
  readonly uid: number;
  readonly gid: number;
  readonly groups: number[];
  readonly umask: string | null;
  readonly caps: (string | null)[];
  readonly limits: string;
  readonly pid: number;
  readonly ppid: number;
  readonly pgrp: number;
}

/** The stand-in, in a scratch directory the second user may read. */
async function standin(): Promise<{
  scratch: string;
  binding: ProductBinding;
}> {
  const scratch = await sharedScratch();
  const script = path.join(scratch, "standin.mjs");
  await fsp.writeFile(script, STANDIN_SOURCE);
  await fsp.chmod(script, 0o640);
  return {
    scratch,
    binding: {
      label: "machine-staging stand-in",
      command: process.execPath,
      prefixArgs: [script],
    },
  };
}

/** Kill a launched run's group at the test's end, whatever the test did. */
function killGroupAtEnd(running: RunningProduct): void {
  onTestFinished(async () => {
    await running.killGroup().catch(() => undefined);
  });
}

async function readPids(
  file: string,
): Promise<{ readonly self: number; readonly grandchild: number }> {
  return JSON.parse(await fsp.readFile(file, "utf8")) as {
    self: number;
    grandchild: number;
  };
}

test("the second user is made idempotently under its fixed name — makers running at once agree, a maker after them finds it — sharing the harness's group, its uid neither the harness's nor root's (E-3, T13.5-9)", async () => {
  const made = await Promise.all([1, 2, 3, 4].map(() => createSecondUser()));
  const again = await createSecondUser();
  const remembered = await ensureSecondUser();
  for (const user of [...made, again, remembered]) {
    expect(user).toEqual(made[0]);
  }
  const user = made[0]!;
  expect(user.name).toBe(SECOND_USER_NAME);
  expect(user.uid).not.toBe(harnessUid());
  expect(user.uid).not.toBe(0);
  expect(user.gid).toBe(harnessGid());
}, 120_000);

test("a run launched as the second user gets exactly the environment, working directory, argv, umask, and resource limits a run started directly gets, as the second user's uid and the shared group with no capability, in the process group sudo leads; its exit code, stdout, and stderr observed (H-2)", async () => {
  const user = await ensureSecondUser();
  const { scratch, binding } = await standin();
  const launcher = await secondUserLauncher(user);
  const options = {
    cwd: scratch,
    argv: ["report", "a b", "x=y", ""],
    env: { XSPEC_LAUNCH_PROBE: "one two", XSPEC_LAUNCH_EQUALS: "k=v" },
  };
  const direct = await runProduct(binding, options);
  const running = await startProduct(binding, { ...options, launcher });
  killGroupAtEnd(running);
  expect(running.commandLine).toContain(
    `as the second user ${SECOND_USER_NAME} (uid ${String(user.uid)}`,
  );
  const launched = await running.waitForExit();
  for (const result of [direct, launched]) {
    expect(result.exitCode, result.stderr).toBe(7);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe("to stderr");
  }
  const own = JSON.parse(direct.stdout) as Report;
  const theirs = JSON.parse(launched.stdout) as Report;
  expect(theirs.env).toEqual(own.env);
  expect(Object.keys(theirs.env).filter((name) => /^SUDO_/.test(name))).toEqual(
    [],
  );
  expect(theirs.env["XSPEC_LAUNCH_PROBE"]).toBe("one two");
  expect(theirs.cwd).toBe(own.cwd);
  expect(theirs.argv).toEqual(["a b", "x=y", ""]);
  expect(theirs.umask).toBe(own.umask);
  expect(theirs.limits).toBe(own.limits);
  expect(own.uid).toBe(harnessUid());
  expect(theirs.uid).toBe(user.uid);
  expect(theirs.gid).toBe(user.gid);
  expect(theirs.groups).toContain(user.gid);
  expect(theirs.caps).toEqual([
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
  ]);
  // sudo forked the stand-in into the group it leads: the run's own.
  expect(theirs.ppid).toBe(running.pid);
  expect(theirs.pgrp).toBe(running.pid);
}, 60_000);

test("the second user's verification passes on a group-staged workspace — every directory listed and every file read, a file made and removed in the root and in .xspec, the built product reachable, each identity's process list listing the other's — and fails as HarnessStagingError where the group cannot reach the workspace (T13.5-9, H-11)", async () => {
  const user = await ensureSecondUser();
  const workspace = await TestWorkspace.create({
    dirs: [".xspec"],
    files: { "a.txt": "a", "specs/sub/b.txt": "b" },
    symlinks: { link: "a.txt" },
  });
  onTestFinished(() => workspace.dispose());
  const reach = {
    root: workspace.root,
    createIn: [workspace.root, workspace.path(".xspec")],
  };

  const unreached = await rejectionOf(verifySecondUserReach(user, reach));
  expect(unreached).toBeInstanceOf(HarnessStagingError);
  expect(unreached).not.toBeInstanceOf(HarnessAssertionError);
  expect((unreached as HarnessStagingError).mode).toBe("second-user");
  expect((unreached as Error).message).toMatch(
    /second-user staging is ineffective \(H-11\): the second user could not reach 1 entry under the root: list .*\/work \(EACCES\); the second user could not create and remove a file in .*\/work \(EACCES\)/,
  );

  const access = await stageGroupAccess(workspace.root);
  onTestFinished(() => access.restore());
  const report = await verifySecondUserReach(user, {
    ...reach,
    binding: builtProductBinding(),
  });
  expect(report.uid).toBe(user.uid);
  expect(report.walk).toEqual({
    directories: 4,
    files: 2,
    links: 1,
    others: 0,
    failures: [],
  });
  expect(report.created.map((outcome) => outcome.removed)).toEqual([
    true,
    true,
  ]);
  expect(report.reach.map((item) => item.ok)).toEqual([true, true]);
  expect(report.listsHarness).toBe(true);
  expect(report.listedByHarness).toBe(true);
  expect((await fsp.readdir(workspace.root)).sort()).toEqual(
    [".xspec", "a.txt", "link", "specs"].sort(),
  );
  expect(await fsp.readdir(workspace.path(".xspec"))).toEqual([]);
}, 120_000);

test("whether the second user can create and remove a file in a directory is answered unjudged: yes where the shared group may write, no (EACCES) where it may not", async () => {
  const user = await ensureSecondUser();
  const scratch = await sharedScratch();
  const writable = path.join(scratch, "writable");
  const readOnly = path.join(scratch, "read-only");
  await fsp.mkdir(writable);
  await fsp.chmod(writable, 0o770);
  await fsp.mkdir(readOnly);
  await fsp.chmod(readOnly, 0o750);
  expect(await secondUserCreatesIn(user, writable)).toEqual({
    ok: true,
    code: null,
  });
  expect(await secondUserCreatesIn(user, readOnly)).toEqual({
    ok: false,
    code: "EACCES",
  });
  expect(await fsp.readdir(writable)).toEqual([]);
}, 120_000);

test("a launched run's processes, which the harness's own identity may not signal, are killed through the launcher: killGroup reaches the grandchild, collects the exit as SIGKILL, and leaves nothing listed, and so does the hang guard (T13.5-3's discipline)", async () => {
  const user = await ensureSecondUser();
  const { scratch, binding } = await standin();
  const launcher = await secondUserLauncher(user);
  const hold = path.join(scratch, "group.hold");
  const pidFile = path.join(scratch, "group.pids");
  const running = await startProduct(binding, {
    cwd: scratch,
    argv: ["group", hold, pidFile],
    launcher,
  });
  killGroupAtEnd(running);
  await running.waitForFile(hold);
  const { self, grandchild } = await readPids(pidFile);
  const leader = running.pid!;
  for (const pid of [self, grandchild]) {
    expect((await readListedProcess(pid))?.pgrp).toBe(leader);
    expect(() => process.kill(pid, 0)).toThrow(/EPERM/);
  }
  expect(() => {
    running.kill();
  }).toThrow(/kill it with killGroup/);
  const killed = await running.killGroup();
  expect(killed.result.signal).toBe("SIGKILL");
  expect(killed.identifiers).toEqual(
    expect.arrayContaining([leader, self, grandchild]),
  );
  expect(await listedAmong([leader, self, grandchild])).toEqual([]);

  const hangPids = path.join(scratch, "hang.pids");
  const hanging = await startProduct(binding, {
    cwd: scratch,
    argv: ["hang", hangPids],
    launcher,
    timeoutMs: 3000,
  });
  killGroupAtEnd(hanging);
  expect(await rejectionOf(hanging.waitForExit())).toBeInstanceOf(
    ProductRunTimeoutError,
  );
  const hung = await readPids(hangPids);
  await confirmGroupGone(
    hanging.pid!,
    [hanging.pid!, hung.self, hung.grandchild],
    "the hanging stand-in",
  );
}, 120_000);

test("the second mount: a bind mount of the root at a path under the workspace's own temporary directory, verified — the same tree through either path, distinct mounts — and removed, after which the path no longer verifies (T13.5-9, E-3)", async () => {
  const workspace = await TestWorkspace.create({ files: { "a.txt": "a" } });
  let mount: SecondMount | undefined;
  onTestFinished(async () => {
    await mount?.remove();
    await workspace.dispose();
  });
  mount = await stageSecondMount(workspace.root, workspace.tempRoot);
  expect(path.dirname(mount.path)).toBe(await fsp.realpath(workspace.tempRoot));
  const mounts = parseMountInfo(await fsp.readFile("/proc/self/mountinfo"));
  expect(mountAt(mounts, Buffer.from(mount.path))).toBeDefined();
  expect(await fsp.readFile(path.join(mount.path, "a.txt"), "utf8")).toBe("a");
  await verifySecondMount(workspace.root, mount.path);
  expect(await fsp.readdir(workspace.root)).toEqual(["a.txt"]);

  const second = mount.path;
  await mount.remove();
  await mount.remove();
  const after = parseMountInfo(await fsp.readFile("/proc/self/mountinfo"));
  expect(mountAt(after, Buffer.from(second))).toBeUndefined();
  await expect(fsp.lstat(second)).rejects.toThrow(/ENOENT/);
  await fsp.mkdir(second);
  const unmounted = await rejectionOf(
    verifySecondMount(workspace.root, second),
  );
  expect(unmounted).toBeInstanceOf(HarnessStagingError);
  expect((unmounted as HarnessStagingError).mode).toBe("second-mount");
  expect(await fsp.readFile(workspace.path("a.txt"), "utf8")).toBe("a");
}, 120_000);
