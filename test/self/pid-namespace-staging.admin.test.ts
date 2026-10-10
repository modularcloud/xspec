// 13.5's machine-wide stagings II (helpers/machine-staging.ts) where they
// need the administrative access GitHub's hosted Linux runners grant the job
// (TEST-SPEC H-2, E-1, E-3, T13.5-3, T13.5-10(e)–(g); H-11): this file runs
// where that access is — CI's Linux legs, through
// .github/scripts/run-without-network.sh — and fails there, as harness
// errors, never skips (H-9), where it is withheld. A machine whose harness
// runs get no administrative access leaves this file out of its command
// line (AGENTS.md: the `*.admin.test.ts` files).
//
// - Launcher A: a run is the first process of a fresh process-identifier
//   namespace with a process list of its own — it sees itself as identifier
//   1 and nothing else listed — as the harness's uid, gid, and supplementary
//   groups with every capability set empty, with exactly the environment,
//   working directory, argv, umask, and resource limits a run started
//   directly gets, its exit code, stdout, and stderr observed.
// - Two launcher-A runs of the same stand-in bear the same in-namespace
//   identifiers, as the harness reads them; a group kill through `sudo`
//   reaches the namespace's first process from outside (T13.5-3) and empties
//   the namespace, and so does the hang guard.
// - Launcher B: a namespace whose first process is the harness's own opens
//   fresh — its first process alone listed — and lists only its own
//   processes once a run is entered, which sees that same process list and
//   the working directory it was given; T13.5-10(e)'s verification passes
//   on the harness's identifiers and fails as a harness error on one the
//   namespace lists; a group kill of the entered run empties the namespace
//   but for its first process, the orphaned grandchild reaped; closing it
//   leaves nothing listed.

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
  freshNamespaceLauncher,
  hasAllocated,
  inNamespaceIdentifiers,
  namespacedProcessesOf,
  openHarnessNamespace,
  readNSpid,
  verifyListedByHarness,
  verifyNamespaceListsNone,
} from "../helpers/machine-staging.js";
import type { HarnessNamespace } from "../helpers/machine-staging.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import {
  ProductRunTimeoutError,
  runProduct,
  startProduct,
} from "../helpers/subprocess.js";
import type { ProductBinding, RunningProduct } from "../helpers/subprocess.js";

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

function sorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

// A stand-in started into a namespace. `report` prints what it was started
// with and as, and what it sees, and exits 7; `group` starts a grandchild in
// its own process group sharing its streams, writes its view (its own
// identifier, the grandchild's, its process list, its working directory)
// whole, then the hold file, and idles; `hang` idles.
const STANDIN_SOURCE = `import { spawn } from "node:child_process";
import fs from "node:fs";

const [mode, ...args] = process.argv.slice(2);
const idle = () => setInterval(() => {}, 60000);
const statusField = (name) => {
  const line = fs
    .readFileSync("/proc/self/status", "latin1")
    .split("\\n")
    .find((candidate) => candidate.startsWith(name + ":"));
  return line === undefined ? null : line.slice(name.length + 1).trim();
};
const listed = () =>
  fs
    .readdirSync("/proc")
    .filter((name) => /^[1-9][0-9]*$/.test(name))
    .map(Number)
    .sort((a, b) => a - b);
switch (mode) {
  case "report":
    process.stdout.write(
      JSON.stringify({
        env: process.env,
        argv: args,
        cwd: process.cwd(),
        pid: process.pid,
        nspid: statusField("NSpid"),
        listed: listed(),
        uid: process.getuid(),
        gid: process.getgid(),
        groups: process.getgroups(),
        umask: statusField("Umask"),
        caps: ["CapInh", "CapPrm", "CapEff", "CapBnd", "CapAmb"].map(statusField),
        limits: fs.readFileSync("/proc/self/limits", "latin1"),
      }),
    );
    process.stderr.write("to stderr");
    process.exit(7);
    break;
  case "group": {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60000)"], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    const view = { pid: process.pid, grandchild: child.pid, listed: listed(), cwd: process.cwd() };
    fs.writeFileSync(args[1] + ".tmp", JSON.stringify(view));
    fs.renameSync(args[1] + ".tmp", args[1]);
    fs.writeFileSync(args[0], "");
    idle();
    break;
  }
  default:
    idle();
}
`;

interface Report {
  readonly env: Record<string, string>;
  readonly argv: string[];
  readonly cwd: string;
  readonly pid: number;
  readonly nspid: string | null;
  readonly listed: number[];
  readonly uid: number;
  readonly gid: number;
  readonly groups: number[];
  readonly umask: string | null;
  readonly caps: (string | null)[];
  readonly limits: string;
}

interface View {
  readonly pid: number;
  readonly grandchild: number;
  readonly listed: number[];
  readonly cwd: string;
}

/** The stand-in, in a scratch directory of the harness's own. */
async function standin(): Promise<{
  scratch: string;
  binding: ProductBinding;
}> {
  const scratch = await fsp.realpath(
    await fsp.mkdtemp(path.join(os.tmpdir(), "xspec-pidns-")),
  );
  onTestFinished(() => fsp.rm(scratch, { recursive: true, force: true }));
  const script = path.join(scratch, "standin.mjs");
  await fsp.writeFile(script, STANDIN_SOURCE);
  return {
    scratch,
    binding: {
      label: "pid-namespace stand-in",
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

/** Close a harness namespace at the test's end, whatever the test did. */
function closeAtEnd(namespace: HarnessNamespace): void {
  onTestFinished(() => namespace.close());
}

test("launcher A: a run is the first process of a fresh namespace with a process list of its own — identifier 1, nothing else listed — as the harness's uid, gid, and groups with no capability, with exactly the environment, working directory, argv, umask, and limits a direct run gets; its exit code, stdout, and stderr observed (H-2; T13.5-10(f), (g))", async () => {
  const { scratch, binding } = await standin();
  const launcher = await freshNamespaceLauncher();
  const options = {
    cwd: scratch,
    argv: ["report", "a b", "x=y", ""],
    env: { XSPEC_LAUNCH_PROBE: "one two", XSPEC_LAUNCH_EQUALS: "k=v" },
  };
  const direct = await runProduct(binding, options);
  const running = await startProduct(binding, { ...options, launcher });
  killGroupAtEnd(running);
  expect(running.commandLine).toContain(
    "as the first process of a fresh process-identifier namespace",
  );
  const launched = await running.waitForExit();
  for (const result of [direct, launched]) {
    expect(result.exitCode, result.stderr).toBe(7);
    expect(result.signal).toBeNull();
    expect(result.stderr).toBe("to stderr");
  }
  const own = JSON.parse(direct.stdout) as Report;
  const theirs = JSON.parse(launched.stdout) as Report;
  expect(theirs.pid).toBe(1);
  expect(theirs.nspid).toBe("1");
  expect(theirs.listed).toEqual([1]);
  expect(own.pid).not.toBe(1);
  expect(own.listed.length).toBeGreaterThan(1);
  expect(theirs.env).toEqual(own.env);
  expect(theirs.cwd).toBe(own.cwd);
  expect(theirs.argv).toEqual(["a b", "x=y", ""]);
  expect(theirs.umask).toBe(own.umask);
  expect(theirs.limits).toBe(own.limits);
  expect(theirs.uid).toBe(harnessUid());
  expect(theirs.gid).toBe(harnessGid());
  expect(sorted(theirs.groups)).toEqual(sorted(own.groups));
  expect(theirs.caps).toEqual([
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
    "0000000000000000",
  ]);
}, 120_000);

test("two launcher-A runs of the same stand-in bear the same in-namespace identifiers; a group kill through sudo reaches each namespace's first process from outside, collects the exit as SIGKILL, and empties the namespace, and so does the hang guard (T13.5-3; T13.5-10(f), (g))", async () => {
  const { scratch, binding } = await standin();
  const launcher = await freshNamespaceLauncher();
  const seen: number[][] = [];
  for (const round of [1, 2]) {
    const hold = path.join(scratch, `group-${String(round)}.hold`);
    const viewFile = path.join(scratch, `group-${String(round)}.json`);
    const running = await startProduct(binding, {
      cwd: scratch,
      argv: ["group", hold, viewFile],
      launcher,
    });
    killGroupAtEnd(running);
    await running.waitForFile(hold);
    const view = JSON.parse(await fsp.readFile(viewFile, "utf8")) as View;
    const processes = await namespacedProcessesOf(running.pid!);
    const identifiers = await inNamespaceIdentifiers(running);
    expect(view.pid).toBe(1);
    expect(view.listed).toEqual([1, view.grandchild]);
    expect(identifiers).toEqual(view.listed);
    expect(processes.map((entry) => entry.inNamespace)).toEqual(identifiers);
    // The first process is the harness's own uid, yet SIGKILL alone reaches
    // it from outside: the kill goes to the whole group through sudo.
    const first = processes[0]!;
    expect((await readNSpid(first.pid))?.at(-1)).toBe(1);
    expect((await readListedProcess(first.pid))?.pgrp).toBe(running.pid);
    await verifyListedByHarness(identifiers, "the held stand-in");
    seen.push(identifiers);
    const killed = await running.killGroup();
    expect(killed.result.signal).toBe("SIGKILL");
    expect(killed.identifiers).toEqual(
      expect.arrayContaining(processes.map((entry) => entry.pid)),
    );
    expect(await listedAmong(processes.map((entry) => entry.pid))).toEqual([]);
  }
  expect(seen[1]).toEqual(seen[0]);

  const hanging = await startProduct(binding, {
    cwd: scratch,
    argv: ["hang"],
    launcher,
    timeoutMs: 3000,
  });
  killGroupAtEnd(hanging);
  // Read while it runs: the guard's kill must leave none of them listed.
  let namespaced: number[] = [];
  for (
    let attempt = 0;
    attempt < 100 && namespaced.length === 0;
    attempt += 1
  ) {
    namespaced = (await namespacedProcessesOf(hanging.pid!)).map(
      (entry) => entry.pid,
    );
    if (namespaced.length === 0) await new Promise((r) => setTimeout(r, 20));
  }
  expect(namespaced.length).toBeGreaterThan(0);
  expect(await rejectionOf(hanging.waitForExit())).toBeInstanceOf(
    ProductRunTimeoutError,
  );
  await confirmGroupGone(
    hanging.pid!,
    [hanging.pid!, ...namespaced],
    "the hanging stand-in",
  );
  expect(await listedAmong([hanging.pid!, ...namespaced])).toEqual([]);
}, 120_000);

test("launcher B: a namespace whose first process is the harness's own opens fresh and lists only its own processes once a run is entered — the run seeing that same list and the working directory it was given — T13.5-10(e)'s verification passing on the harness's identifiers and failing as a harness error on one the namespace lists; a group kill of the entered run empties it but for its first process; closing it leaves nothing listed", async () => {
  const { scratch, binding } = await standin();
  const namespace = await openHarnessNamespace();
  closeAtEnd(namespace);
  const firstPid = namespace.firstPid;
  expect((await readNSpid(firstPid))?.at(-1)).toBe(1);
  expect(await namespace.observe()).toEqual({ listed: [1], lastAllocated: 1 });

  const hold = path.join(scratch, "entered.hold");
  const viewFile = path.join(scratch, "entered.json");
  const running = await startProduct(binding, {
    cwd: scratch,
    argv: ["group", hold, viewFile],
    launcher: namespace.launcher,
  });
  killGroupAtEnd(running);
  expect(running.commandLine).toContain(
    "entered into a fresh process-identifier namespace whose first process",
  );
  await running.waitForFile(hold);
  const view = JSON.parse(await fsp.readFile(viewFile, "utf8")) as View;
  const identifiers = await inNamespaceIdentifiers(running);
  expect(identifiers).toEqual([view.pid, view.grandchild]);
  expect(identifiers).not.toContain(1);
  const observation = await namespace.observe();
  expect(observation.listed).toEqual([1, ...identifiers]);
  expect(view.listed).toEqual(observation.listed);
  expect(view.cwd).toBe(scratch);
  expect(observation.lastAllocated).toBe(Math.max(...identifiers));
  expect(hasAllocated(observation, Math.max(...identifiers))).toBe(true);
  expect(hasAllocated(observation, Math.max(...identifiers) + 1)).toBe(false);

  // T13.5-10(e)'s verification: the harness's own identifiers — this
  // process's and the entered run's sudo — are no identifiers there, unless
  // the namespace happens to have allocated them, which a fresh one has not.
  await verifyNamespaceListsNone(
    namespace,
    [process.pid, running.pid!],
    "the harness's own processes",
  );
  const listedThere = await rejectionOf(
    verifyNamespaceListsNone(namespace, [identifiers[0]!], "a probe"),
  );
  expect(listedThere).toBeInstanceOf(HarnessStagingError);
  expect(listedThere).not.toBeInstanceOf(HarnessAssertionError);
  expect((listedThere as HarnessStagingError).mode).toBe("pid-namespace");
  expect((listedThere as Error).message).toContain(
    `lists identifier(s) ${String(identifiers[0])} that a probe bear(s)`,
  );

  const killed = await running.killGroup();
  expect(killed.result.signal).toBe("SIGKILL");
  expect((await namespace.observe()).listed).toEqual([1]);

  await namespace.close();
  await namespace.close();
  expect(await listedAmong([firstPid])).toEqual([]);
  await expect(namespace.observe()).rejects.toThrow(/closed/);
  await expect(
    startProduct(binding, {
      cwd: scratch,
      argv: ["hang"],
      launcher: namespace.launcher,
    }),
  ).rejects.toThrow(/is closed: nothing can be entered into it/);
}, 120_000);
