// 13.5's machine-wide stagings I (helpers/machine-staging.ts) and the
// subprocess driver's launcher run option (helpers/subprocess.ts), pinned
// where no administrative access is needed (TEST-SPEC H-2, E-1, E-3,
// T13.5-9; H-11). What needs `sudo` — the second user made, a run launched
// as it, the second mount made and removed — is pinned in
// machine-staging.admin.test.ts, which runs where the job's administrative
// access is (CI's Linux legs).
//
// - E-1's access check fails as the harness error `HarnessStagingError`
//   (never a skip, never a `HarnessAssertionError`) when the command is
//   missing, refuses, or is not silent, asks again after a failure, and
//   remembers a silent success — each staged with a stand-in command, never
//   `sudo`;
// - `/proc/self/mountinfo`'s lines read exactly (escapes decoded, path
//   bytes kept, the containing mount the longest prefix), and the second
//   mount's verification fails as a harness error on a path that is not a
//   mount point;
// - the group staging grants the shared group exactly what T13.5-9 asks and
//   `restore` reinstates every mode;
// - the second user's launcher command line is exactly sudo, the umask, every
//   limit, setpriv to the second user with no capability, and `env -i` with
//   exactly the given environment, then the command verbatim — its umask and
//   environment fragments run here as they run there — and an invocation it
//   cannot express is refused;
// - through a stand-in launcher: a launched run is spawned by the launcher's
//   command line with the driver's environment, leads its own process group,
//   is captured like any run — its JSON stdout walked as T12.7-1 asks —
//   refuses `kill`, and is killed through the launcher — by `killGroup`,
//   whose confirmation also waits for a descendant that left the group, and
//   by the hang guard, whose failing kill settles the run with a harness
//   error.

import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  confirmGroupGone,
  listedAmong,
  ProcessGroupLingerError,
  readListedProcess,
} from "../helpers/kill-discipline.js";
import {
  mountAt,
  mountContaining,
  parseMountInfo,
  prlimitOptions,
  requireAdministrativeAccess,
  secondUserSpawn,
  stageGroupAccess,
  verifySecondMount,
} from "../helpers/machine-staging.js";
import type { SecondUserSpawnPlan } from "../helpers/machine-staging.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import { ProductRunTimeoutError, startProduct } from "../helpers/subprocess.js";
import type {
  ProductBinding,
  RunLauncher,
  RunningProduct,
} from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";

const execFileAsync = promisify(execFile);
const BACKSLASH = String.fromCharCode(92);

/** What a promise rejects with; null when it resolves. */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return await pending.then(
    () => null,
    (thrown: unknown) => thrown,
  );
}

function expectStagingError(
  error: unknown,
  mode: string,
  pattern: RegExp,
): void {
  expect(error).toBeInstanceOf(HarnessStagingError);
  expect(error).not.toBeInstanceOf(HarnessAssertionError);
  expect((error as HarnessStagingError).mode).toBe(mode);
  expect((error as Error).message).toMatch(pattern);
}

test("E-1's access check fails as HarnessStagingError — never a skip or an assertion failure — on a missing, refusing, or talking command, asks again after a failure, and remembers a silent success", async () => {
  const scratch = await fsp.mkdtemp(path.join(os.tmpdir(), "xspec-access-"));
  onTestFinished(() => fsp.rm(scratch, { recursive: true, force: true }));
  const missing = path.join(scratch, "no-such-command");
  for (const [command, pattern] of [
    [missing, /did not succeed \(failed to start \(ENOENT\)/],
    ["/bin/false", /did not succeed \(exit 1;/],
    ["/bin/echo", /is not silent \(exit 0; stdout: "true";/],
  ] as const) {
    for (let round = 1; round <= 2; round += 1) {
      expectStagingError(
        await rejectionOf(requireAdministrativeAccess({ sudo: command })),
        "administrative-access",
        pattern,
      );
    }
  }
  // Refuses once, then succeeds silently: the failure was not remembered.
  const mark = path.join(scratch, "asked");
  const flaky = path.join(scratch, "flaky");
  await fsp.writeFile(
    flaky,
    `#!/bin/sh\nif [ -e "${mark}" ]; then exit 0; fi\n: > "${mark}"\nexit 1\n`,
    { mode: 0o755 },
  );
  expectStagingError(
    await rejectionOf(requireAdministrativeAccess({ sudo: flaky })),
    "administrative-access",
    /E-1/,
  );
  await requireAdministrativeAccess({ sudo: flaky });
  // The success is remembered: the command, now refusing, is not asked.
  await fsp.rm(mark);
  await requireAdministrativeAccess({ sudo: flaky });
  await expect(fsp.stat(mark)).rejects.toThrow(/ENOENT/);
  await requireAdministrativeAccess({ sudo: "/bin/true" });
}, 30_000);

test("mountinfo lines read exactly: escapes decoded, path bytes kept, the mount at a point the last listed, the containing mount the longest prefix", () => {
  const text = [
    "22 1 0:21 / /proc rw,nosuid shared:12 - proc proc rw",
    "1 0 8:1 / / rw,relatime shared:1 - ext4 /dev/root rw",
    "30 1 0:25 / /tmp rw shared:5 - tmpfs tmpfs rw",
    `41 30 8:1 /tmp/x/work /tmp/x/second${BACKSLASH}040path rw,relatime shared:1 - ext4 /dev/root rw`,
    "42 30 0:26 / /tmp/ab rw - tmpfs tmpfs rw",
    "43 42 0:27 / /tmp/ab rw master:3 propagate_from:2 - tmpfs tmpfs rw",
    "",
  ].join("\n");
  const odd = Buffer.concat([
    Buffer.from("44 30 8:1 / /tmp/"),
    Buffer.from([0x66, 0xff]),
    Buffer.from(" rw - ext4 /dev/root rw\n"),
  ]);
  const entries = parseMountInfo(Buffer.concat([Buffer.from(text), odd]));
  expect(entries.map((entry) => entry.id)).toEqual([22, 1, 30, 41, 42, 43, 44]);
  expect(entries[3]).toEqual({
    id: 41,
    parentId: 30,
    root: Buffer.from("/tmp/x/work"),
    mountPoint: Buffer.from("/tmp/x/second path"),
    fsType: "ext4",
  });
  expect(entries[5]?.fsType).toBe("tmpfs");
  expect(entries[6]?.mountPoint).toEqual(
    Buffer.from([...Buffer.from("/tmp/"), 0x66, 0xff]),
  );
  const at = (target: string): number | undefined =>
    mountAt(entries, Buffer.from(target))?.id;
  const on = (target: string): number | undefined =>
    mountContaining(entries, Buffer.from(target))?.id;
  expect(at("/tmp/x/second path")).toBe(41);
  expect(at("/tmp/x")).toBeUndefined();
  expect(at("/tmp/ab")).toBe(43);
  expect(on("/tmp/x/work")).toBe(30);
  expect(on("/tmp/x/second path/f")).toBe(41);
  expect(on("/tmp/abc")).toBe(30);
  expect(on("/tmp/ab/c")).toBe(43);
  expect(on("/etc/hosts")).toBe(1);
  expect(on("/")).toBe(1);
  for (const bad of [
    "22 1 0:21 / /proc rw,nosuid shared:12 proc proc rw",
    "x 1 0:21 / /proc rw - proc proc rw",
    "22 1 0:21 / /proc rw -",
  ]) {
    expect(() => parseMountInfo(Buffer.from(`${bad}\n`))).toThrow(
      /does not read as proc\(5\)'s mountinfo/,
    );
  }
});

test("the second mount's verification fails as HarnessStagingError, creating nothing, where the second path is a plain directory or the root itself — not a mount point", async () => {
  const workspace = await TestWorkspace.create({ files: { "a.txt": "a" } });
  onTestFinished(() => workspace.dispose());
  const plain = path.join(workspace.tempRoot, "plain");
  await fsp.mkdir(plain);
  for (const second of [plain, workspace.root]) {
    expectStagingError(
      await rejectionOf(verifySecondMount(workspace.root, second)),
      "second-mount",
      /not a mount point: \/proc\/self\/mountinfo lists no mount at/,
    );
  }
  expect(await fsp.readdir(workspace.root)).toEqual(["a.txt"]);
  expect(await fsp.readdir(plain)).toEqual([]);
});

/** The mode bits of every entry under `root` (lstat), by byte path. */
async function modesUnder(root: string): Promise<Map<string, number>> {
  const modes = new Map<string, number>();
  const pending = [Buffer.from(root)];
  for (let dir = pending.pop(); dir !== undefined; dir = pending.pop()) {
    modes.set(dir.toString("hex"), (await fsp.lstat(dir)).mode & 0o7777);
    for (const name of await fsp.readdir(dir, { encoding: "buffer" })) {
      const entry = Buffer.concat([dir, Buffer.from("/"), name]);
      const stats = await fsp.lstat(entry);
      if (stats.isDirectory()) pending.push(entry);
      else modes.set(entry.toString("hex"), stats.mode & 0o7777);
    }
  }
  return modes;
}

test("the group staging grants the shared group read and write on plain files, list, write, and search on directories, and search on the harness-owned directories above the root, never touching a link; restore reinstates every mode", async () => {
  const workspace = await TestWorkspace.create({
    dirs: ["empty"],
    files: { "a.txt": "a", "sub/b.txt": "b", "sub/deep/c.txt": "c" },
    symlinks: { link: "a.txt" },
  });
  onTestFinished(() => workspace.dispose());
  const root = workspace.root;
  const odd = Buffer.concat([
    Buffer.from(`${root}/`),
    Buffer.from([0x66, 0xff]),
  ]);
  await fsp.writeFile(odd, "odd", { mode: 0o600 });
  await fsp.chmod(odd, 0o600);
  await fsp.chmod(path.join(root, "a.txt"), 0o600);
  await fsp.chmod(path.join(root, "sub/b.txt"), 0o400);
  await fsp.chmod(path.join(root, "sub/deep"), 0o700);
  const tempMode = (await fsp.stat(workspace.tempRoot)).mode & 0o7777;
  const tmpMode = (await fsp.stat(os.tmpdir())).mode & 0o7777;
  expect(tempMode & 0o070).toBe(0);
  const before = await modesUnder(root);
  const linkKey = Buffer.from(path.join(root, "link")).toString("hex");

  const staging = await stageGroupAccess(root);
  const after = await modesUnder(root);
  expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
  for (const [key, mode] of before) {
    const target = Buffer.from(key, "hex");
    const stats = await fsp.lstat(target);
    const expected = stats.isDirectory()
      ? mode | 0o070
      : stats.isFile()
        ? mode | 0o060
        : mode;
    expect(after.get(key), target.toString("utf8")).toBe(expected);
  }
  expect(after.get(linkKey)).toBe(before.get(linkKey));
  expect((await fsp.stat(workspace.tempRoot)).mode & 0o7777).toBe(
    tempMode | 0o010,
  );
  expect((await fsp.stat(os.tmpdir())).mode & 0o7777).toBe(tmpMode);

  // Made after the staging: never touched. Removed since: passed over.
  await fsp.writeFile(path.join(root, "late.txt"), "late", { mode: 0o600 });
  await fsp.chmod(path.join(root, "late.txt"), 0o600);
  await fsp.rm(path.join(root, "sub/deep/c.txt"));
  await staging.restore();
  await staging.restore();
  const restored = await modesUnder(root);
  const lateKey = Buffer.from(path.join(root, "late.txt")).toString("hex");
  const goneKey = Buffer.from(path.join(root, "sub/deep/c.txt")).toString(
    "hex",
  );
  expect(restored.get(lateKey)).toBe(0o600);
  restored.delete(lateKey);
  before.delete(goneKey);
  expect(restored).toEqual(before);
  expect((await fsp.stat(workspace.tempRoot)).mode & 0o7777).toBe(tempMode);
});

test("the group staging refuses a root that is not a directory as HarnessStagingError, changing nothing", async () => {
  const workspace = await TestWorkspace.create({ files: { "a.txt": "a" } });
  onTestFinished(() => workspace.dispose());
  const tempMode = (await fsp.stat(workspace.tempRoot)).mode & 0o7777;
  expectStagingError(
    await rejectionOf(stageGroupAccess(path.join(workspace.root, "a.txt"))),
    "group-access",
    /the root is not a directory/,
  );
  expect((await fsp.stat(workspace.tempRoot)).mode & 0o7777).toBe(tempMode);
});

const PLAN: SecondUserSpawnPlan = {
  sudo: "sudo",
  user: { name: "xspec-second", uid: 4242, gid: 4343 },
  limits: ["--nofile=1024:4096", "--core=0:unlimited"],
  umask: 0o027,
};

test("the second user's launcher command line: sudo, the umask, every limit, setpriv to the second user with no capability, env -i with exactly the given environment, then the command and argv verbatim; what it cannot express is refused", async () => {
  const env = { A: "1", B: "two words", C: "k=v", EMPTY: "", "-x": "dash" };
  const spawned = secondUserSpawn(
    PLAN,
    { command: "/usr/bin/node", args: ["bin.js", "a b", "x=y", "--json"] },
    env,
  );
  expect(spawned).toEqual({
    command: "sudo",
    args: [
      "-n",
      "--",
      "/bin/sh",
      "-c",
      'umask "$1" && shift && exec "$@"',
      "sh",
      "0027",
      "prlimit",
      "--nofile=1024:4096",
      "--core=0:unlimited",
      "--",
      "setpriv",
      "--reuid=4242",
      "--regid=4343",
      "--init-groups",
      "--inh-caps=-all",
      "--bounding-set=-all",
      "--",
      "env",
      "-i",
      "--",
      "A=1",
      "B=two words",
      "C=k=v",
      "EMPTY=",
      "-x=dash",
      "/usr/bin/node",
      "bin.js",
      "a b",
      "x=y",
      "--json",
    ],
  });

  // The umask fragment, run here as root runs it there.
  const fragment = spawned.args.slice(2, 7);
  expect(fragment[0]).toBe("/bin/sh");
  const umask = await execFileAsync("/bin/sh", [
    ...fragment.slice(1),
    "/bin/sh",
    "-c",
    "umask",
  ]);
  expect(umask.stdout).toBe("0027\n");
  // The environment fragment: exactly the given variables reach the command.
  const shown = secondUserSpawn(
    PLAN,
    { command: "/usr/bin/env", args: [] },
    env,
  );
  const envAt = shown.args.lastIndexOf("env");
  expect(shown.args[envAt + 1]).toBe("-i");
  const printed = await execFileAsync("env", shown.args.slice(envAt + 1), {
    env: { ...process.env, SUDO_USER: "leak", INJECTED: "leak" },
  });
  expect(printed.stdout).toBe("A=1\nB=two words\nC=k=v\nEMPTY=\n-x=dash\n");

  for (const command of ["node", "/opt/a=b/node"]) {
    expect(() => secondUserSpawn(PLAN, { command, args: [] }, {})).toThrow(
      /an absolute command holding no `=`/,
    );
  }
  for (const name of ["", "A=B"]) {
    expect(() =>
      secondUserSpawn(
        PLAN,
        { command: "/bin/true", args: [] },
        { [name]: "v" },
      ),
    ).toThrow(/cannot pass an environment variable named/);
  }
});

test("prlimit's raw lines become the options restoring each limit; a line of another shape, or none, throws", () => {
  expect(
    prlimitOptions(
      "AS unlimited unlimited\nNOFILE    1024    524288\nCORE 0 unlimited\n",
    ),
  ).toEqual([
    "--as=unlimited:unlimited",
    "--nofile=1024:524288",
    "--core=0:unlimited",
  ]);
  for (const bad of [
    "NOFILE 1024\n",
    "NOFILE 1024 2048 x\n",
    "nofile 1 2\n",
    "NOFILE -1 2\n",
  ]) {
    expect(() => prlimitOptions(bad)).toThrow(/does not read as/);
  }
  expect(() => prlimitOptions("\n")).toThrow(/no limit/);
});

// A stand-in for the launcher tests: `report` prints what it was started
// with and exits 7; `group`, `escape`, and `hang` start a grandchild — in the
// stand-in's process group, sharing its streams (`group`, `hang`), or in a
// group of its own with no stream of the run (`escape`) — record its
// identifier, then (`group`, `escape`) write the hold file, and idle; `emit`
// prints `XSPEC_EMIT` and exits 0.
const STANDIN_SOURCE = `import { spawn } from "node:child_process";
import fs from "node:fs";

const [mode, ...args] = process.argv.slice(2);
const idle = () => setInterval(() => {}, 60000);
const grandchild = (pidFile, detached) => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60000)"], {
    stdio: detached ? "ignore" : ["ignore", "inherit", "inherit"],
    detached,
  });
  fs.writeFileSync(pidFile + ".tmp", String(child.pid));
  fs.renameSync(pidFile + ".tmp", pidFile);
};
const pgrp = () => {
  const stat = fs.readFileSync("/proc/self/stat", "latin1");
  return Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[2]);
};
switch (mode) {
  case "report":
    process.stdout.write(JSON.stringify({ env: process.env, argv: args, pid: process.pid, pgrp: pgrp() }));
    process.stderr.write("to stderr");
    process.exit(7);
    break;
  case "group":
  case "escape":
    grandchild(args[1], mode === "escape");
    fs.writeFileSync(args[0], "");
    idle();
    break;
  case "hang":
    grandchild(args[0], false);
    idle();
    break;
  case "emit":
    process.stdout.write(process.env.XSPEC_EMIT ?? "");
    break;
  default:
    idle();
}
`;

/** The variable the stand-in launcher adds, marking a run it started. */
const LAUNCH_MARK = "XSPEC_STAND_IN_LAUNCHED";

interface FakeLauncher extends RunLauncher {
  /** The groups the launcher was asked to kill, in order. */
  readonly kills: number[];
}

/**
 * A stand-in launcher: as the second user's does at its last stage, hands
 * the run its environment through `env -i` — the spawn's own environment
 * unrelated — and `env` execs the command, so the command is the started
 * process itself; kills by signalling the group, failing on request after
 * recording.
 */
function fakeLauncher(failKills = false): FakeLauncher {
  const kills: number[] = [];
  return {
    kills,
    label: "through the self-test's stand-in launcher",
    wrap: (invocation, env) => ({
      command: "/usr/bin/env",
      args: [
        "-i",
        "--",
        ...Object.entries(env).map(([name, value]) => `${name}=${value}`),
        `${LAUNCH_MARK}=1`,
        invocation.command,
        ...invocation.args,
      ],
      env: { PATH: "/usr/bin:/bin", UNRELATED: "never reaches the run" },
    }),
    killGroup: async (groupId) => {
      kills.push(groupId);
      if (failKills) throw new Error("the stand-in launcher refuses to kill");
      try {
        process.kill(-groupId, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    },
  };
}

interface Standin {
  readonly workspace: TestWorkspace;
  readonly binding: ProductBinding;
}

async function standin(): Promise<Standin> {
  const workspace = await TestWorkspace.create({
    files: { "standin.mjs": STANDIN_SOURCE },
  });
  onTestFinished(() => workspace.dispose());
  return {
    workspace,
    binding: {
      label: "machine-staging stand-in",
      command: process.execPath,
      prefixArgs: [workspace.path("standin.mjs")],
    },
  };
}

/** SIGKILL a group directly at the test's end and wait for it to go. */
function reapAtEnd(running: RunningProduct, also: () => number[] = () => []) {
  onTestFinished(async () => {
    const pid = running.pid;
    const extra = also();
    for (const target of pid === undefined ? extra : [-pid, ...extra]) {
      try {
        process.kill(target, "SIGKILL");
      } catch {
        // Gone already.
      }
    }
    await running.waitForExit().catch(() => undefined);
    if (pid !== undefined) {
      await confirmGroupGone(pid, [pid, ...extra], "the stand-in's cleanup");
    }
  });
}

async function readPid(file: string): Promise<number> {
  const pid = Number((await fsp.readFile(file, "utf8")).trim());
  expect(Number.isInteger(pid) && pid > 0, `${file} names a pid`).toBe(true);
  return pid;
}

test("a launched run is spawned by the launcher's command line with exactly the driver's environment, leads a process group of its own, is captured like any run, names its launcher, and refuses kill; processGroup: false beside a launcher is refused", async () => {
  const { workspace, binding } = await standin();
  const launcher = fakeLauncher();
  const argv = ["report", "a b", "x=y"];
  const direct = await startProduct(binding, { cwd: workspace.root, argv });
  const launched = await startProduct(binding, {
    cwd: workspace.root,
    argv,
    launcher,
  });
  reapAtEnd(launched);
  expect(launched.commandLine).toMatch(
    / through the self-test's stand-in launcher$/,
  );
  expect(() => {
    launched.kill();
  }).toThrow(/started through a launcher.*kill it with killGroup/);
  const directResult = await direct.waitForExit();
  const launchedResult = await launched.waitForExit();
  for (const result of [directResult, launchedResult]) {
    expect(result.exitCode).toBe(7);
    expect(result.stderr).toBe("to stderr");
  }
  const directReport = JSON.parse(directResult.stdout) as {
    env: Record<string, string>;
    argv: string[];
  };
  const launchedReport = JSON.parse(launchedResult.stdout) as {
    env: Record<string, string>;
    argv: string[];
    pid: number;
    pgrp: number;
  };
  // The launcher's command line ran it (its mark), with exactly the
  // environment the driver built — the spawn's own never reaching it.
  expect(launchedReport.env).toEqual({
    ...directReport.env,
    [LAUNCH_MARK]: "1",
  });
  expect(directReport.env[LAUNCH_MARK]).toBeUndefined();
  expect(launchedReport.argv).toEqual(["a b", "x=y"]);
  expect(launchedReport.pid).toBe(launched.pid);
  expect(launchedReport.pgrp).toBe(launched.pid);
  expect(launcher.kills).toEqual([]);

  const refused = await rejectionOf(
    startProduct(binding, {
      cwd: workspace.root,
      argv,
      launcher,
      processGroup: false,
    }),
  );
  expect((refused as Error).message).toMatch(
    /always leads a process group of its own.*`processGroup: false` cannot stand beside it/,
  );
}, 60_000);

test("killGroup kills a launched run through its launcher, collects the exit as SIGKILL, and confirms the group gone; a descendant that left the group fails the confirmation as ProcessGroupLingerError naming it", async () => {
  const setup = await standin();
  const { workspace, binding } = setup;
  const launcher = fakeLauncher();
  const hold = path.join(workspace.tempRoot, "group.hold");
  const pidFile = path.join(workspace.tempRoot, "group.pid");
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["group", hold, pidFile],
    launcher,
  });
  reapAtEnd(running);
  await running.waitForFile(hold);
  const grandchild = await readPid(pidFile);
  const leader = running.pid!;
  expect((await readListedProcess(grandchild))?.pgrp).toBe(leader);
  const killed = await running.killGroup();
  expect(launcher.kills).toEqual([leader]);
  expect(killed.result.signal).toBe("SIGKILL");
  expect(killed.identifiers).toEqual(
    expect.arrayContaining([leader, grandchild]),
  );
  expect(await listedAmong([leader, grandchild])).toEqual([]);
  expect(await running.killGroup()).toBe(killed);
  expect(launcher.kills).toEqual([leader]);

  const escapeHold = path.join(workspace.tempRoot, "escape.hold");
  const escapePid = path.join(workspace.tempRoot, "escape.pid");
  const escaping = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["escape", escapeHold, escapePid],
    launcher,
  });
  let escaped = 0;
  reapAtEnd(escaping, () => (escaped > 0 ? [escaped] : []));
  await escaping.waitForFile(escapeHold);
  escaped = await readPid(escapePid);
  expect((await readListedProcess(escaped))?.pgrp).toBe(escaped);
  const lingering = await rejectionOf(escaping.killGroup({ timeoutMs: 1500 }));
  expect(lingering).toBeInstanceOf(ProcessGroupLingerError);
  expect((lingering as ProcessGroupLingerError).stage).toBe("listed");
  expect((lingering as ProcessGroupLingerError).lingering).toEqual([escaped]);
  expect(launcher.kills).toEqual([leader, escaping.pid]);
}, 60_000);

test("a launched run's captured stdout is walked like any run's with JSON output in effect (T12.7-1): a near-marker rejects it with the walk's diagnosed failure, naming the launched command line", async () => {
  const { workspace, binding } = await standin();
  const nearMarker = `${JSON.stringify({
    findings: [],
    nodes: [{ identity: "specs/A.mdx", tags: { unavailable: false } }],
  })}\n`;
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["emit", "--json"],
    env: { XSPEC_EMIT: nearMarker },
    launcher: fakeLauncher(),
  });
  reapAtEnd(running);
  const walked = await rejectionOf(running.waitForExit());
  expect(walked).toBeInstanceOf(HarnessAssertionError);
  const message = (walked as Error).message;
  expect(message).toContain(
    "T12.7-1, the driver's walk over every captured JSON document",
  );
  expect(message).toContain(
    "at $.nodes[0].tags: expected no object of any form other than the unavailability marker",
  );
  expect(message).toContain("through the self-test's stand-in launcher");
}, 60_000);

test("the hang guard kills a launched run's whole group through its launcher; a kill the launcher fails settles the run with a harness error, never a timeout or an assertion failure", async () => {
  const { workspace, binding } = await standin();
  const launcher = fakeLauncher();
  const pidFile = path.join(workspace.tempRoot, "hang.pid");
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["hang", pidFile],
    launcher,
    timeoutMs: 1500,
  });
  reapAtEnd(running);
  const timedOut = await rejectionOf(running.waitForExit());
  expect(timedOut).toBeInstanceOf(ProductRunTimeoutError);
  expect(launcher.kills).toEqual([running.pid]);
  const grandchild = await readPid(pidFile);
  await confirmGroupGone(running.pid!, [running.pid!, grandchild], "hang");

  const refusing = fakeLauncher(true);
  const stuck = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["idle"],
    launcher: refusing,
    timeoutMs: 1000,
  });
  reapAtEnd(stuck);
  const abandoned = await rejectionOf(stuck.waitForExit());
  expect(abandoned).toBeInstanceOf(Error);
  expect(abandoned).not.toBeInstanceOf(ProductRunTimeoutError);
  expect(abandoned).not.toBeInstanceOf(HarnessAssertionError);
  expect((abandoned as Error).message).toMatch(
    /^harness error \(H-11\): the guard's kill of .* through its launcher failed, so the run may still be running: Error: the stand-in launcher refuses to kill$/,
  );
  expect(refusing.kills).toEqual([stuck.pid]);
  expect(await listedAmong([stuck.pid!])).toEqual([stuck.pid]);
}, 60_000);
