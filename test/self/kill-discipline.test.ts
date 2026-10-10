// T13.5-3's exit-collection discipline and reuse check, as shared machinery
// (helpers/kill-discipline.ts; the subprocess driver's `processGroup` run
// option and `RunningProduct.killGroup`, helpers/subprocess.ts), pinned
// against known-behavior stand-ins before any product-facing test trusts
// them (TEST-SPEC T13.5-3, E-5, H-11; S-3's driver):
//
// - a run started with `processGroup` leads a process group of its own,
//   while a run started without it stays in the harness's group, and
//   `killGroup` refuses it, signalling nothing;
// - the group kill reaches a grandchild in the group, collects the started
//   process's exit as a SIGKILL death, and resolves only once neither is
//   listed in the process list — a zombie counting as listed, the one an
//   exec'd `sleep` never reaps included — returning every identifier the
//   group bore, the kill made once; on a run that had already ended it
//   reports that run's own exit;
// - on a run leading its own group, the hang guard's kill reaches the whole
//   group;
// - the reuse check voids the trial when a killed identifier is listed
//   again, naming exactly the listed ones, and fails the test, diagnosed,
//   when none is; and the voidable-trial runner reruns a voided trial,
//   exhausts into the harness error `VoidedTrialsExhaustedError` (never a
//   `HarnessAssertionError`) naming every reason, and propagates any other
//   failure as is, never retried.
//
// The process list is the Linux leg's (`/proc`), as the self project's CI
// job is; on any other platform the readers throw, never a skip (H-9).

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  applyReuseCheck,
  confirmGroupGone,
  DEFAULT_VOIDABLE_ATTEMPTS,
  listedAmong,
  readListedProcess,
  readProcessList,
  runVoidableTrial,
  TrialVoided,
  voidTrial,
  VoidedTrialsExhaustedError,
} from "../helpers/kill-discipline.js";
import { ProductRunTimeoutError, startProduct } from "../helpers/subprocess.js";
import type {
  KilledGroup,
  ProductBinding,
  RunningProduct,
} from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";

// A known-behavior stand-in. `group` and `hang-group` start a grandchild in
// the stand-in's own process group — sharing its stdout and stderr, so the
// run's streams close only once both are gone — and record its identifier
// (written whole, then renamed into place) before going on.
const STANDIN_SOURCE = `import { spawn } from "node:child_process";
import fs from "node:fs";

const [mode, ...args] = process.argv.slice(2);
const idle = () => setInterval(() => {}, 60000);
const grandchild = (pidFile) => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 60000)"], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  fs.writeFileSync(pidFile + ".tmp", String(child.pid));
  fs.renameSync(pidFile + ".tmp", pidFile);
};
switch (mode) {
  case "group": {
    grandchild(args[1]);
    fs.writeFileSync(args[0], "");
    idle();
    break;
  }
  case "hang-group": {
    grandchild(args[0]);
    idle();
    break;
  }
  case "idle": {
    idle();
    break;
  }
  case "exit": {
    process.exit(Number(args[0]));
    break;
  }
  default: {
    process.stderr.write("unknown mode: " + String(mode));
    process.exit(99);
  }
}
`;

// A zombie maker: `sleep 1` in the background, its identifier recorded,
// then the shell execs `sleep 300`, which never reaps the background child,
// so that child stays a zombie of the run's group until the group's leader
// dies and the zombie's new parent reaps it. The second's margin keeps the
// child alive past the `mv`, which the shell, waiting for any child, would
// otherwise reap it during.
const ZOMBIE_SCRIPT =
  'sleep 1 & echo "$!" > "$1.tmp" && mv "$1.tmp" "$1"; exec sleep 300';

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
      label: "kill-discipline stand-in",
      command: process.execPath,
      prefixArgs: [workspace.path("standin.mjs")],
    },
  };
}

/** Kill a run's group at the test's end, whatever the test did. */
function killGroupAtEnd(running: RunningProduct): void {
  onTestFinished(async () => {
    await running.killGroup().catch(() => undefined);
  });
}

async function readPid(file: string): Promise<number> {
  const pid = Number((await fsp.readFile(file, "utf8")).trim());
  expect(Number.isInteger(pid) && pid > 0, `${file} names a pid`).toBe(true);
  return pid;
}

/** What a promise rejects with; null when it resolves. */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return await pending.then(
    () => null,
    (thrown: unknown) => thrown,
  );
}

/** A held stand-in with a grandchild in its group, started and awaited. */
async function heldGroup(
  { workspace, binding }: Standin,
  name: string,
): Promise<{ running: RunningProduct; grandchild: number }> {
  const hold = path.join(workspace.tempRoot, `${name}.hold`);
  const pidFile = path.join(workspace.tempRoot, `${name}.pid`);
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["group", hold, pidFile],
    processGroup: true,
  });
  killGroupAtEnd(running);
  await running.waitForFile(hold);
  return { running, grandchild: await readPid(pidFile) };
}

test("a run started with processGroup leads a process group of its own; one started without it stays in the harness's group, and killGroup refuses it, signalling nothing", async () => {
  const setup = await standin();
  const own = await readListedProcess(process.pid);
  expect(own).toBeDefined();

  const { running, grandchild } = await heldGroup(setup, "own-group");
  const leader = running.pid!;
  expect((await readListedProcess(leader))?.pgrp).toBe(leader);
  expect((await readListedProcess(grandchild))?.pgrp).toBe(leader);
  expect(leader).not.toBe(own!.pgrp);

  const plain = await startProduct(setup.binding, {
    cwd: setup.workspace.root,
    argv: ["idle"],
  });
  onTestFinished(async () => {
    plain.kill();
    await plain.waitForExit().catch(() => undefined);
  });
  expect((await readListedProcess(plain.pid!))?.pgrp).toBe(own!.pgrp);
  const refused = await rejectionOf(plain.killGroup());
  expect(refused).toBeInstanceOf(Error);
  expect((refused as Error).message).toMatch(
    /was not started with `processGroup: true`.*nothing was signalled/,
  );
  expect(refused).not.toBeInstanceOf(HarnessAssertionError);
  expect(plain.hasExited()).toBe(false);
  expect(await listedAmong([plain.pid!])).toEqual([plain.pid]);
}, 60_000);

test("killGroup kills the whole group, collects the started process's exit as a SIGKILL death, and resolves only once no process of the group is listed, returning every identifier it bore (T13.5-3)", async () => {
  const { running, grandchild } = await heldGroup(
    await standin(),
    "kill-group",
  );
  const leader = running.pid!;
  expect(await listedAmong([leader, grandchild])).toEqual(
    [leader, grandchild].sort((a, b) => a - b),
  );

  const killed: KilledGroup = await running.killGroup();
  // Right after the kill, before anything else runs: neither is listed.
  expect(await listedAmong([leader, grandchild])).toEqual([]);
  expect(killed.groupId).toBe(leader);
  expect(killed.identifiers).toEqual(
    [leader, grandchild].sort((a, b) => a - b),
  );
  expect(killed.result.exitCode).toBeNull();
  expect(killed.result.signal).toBe("SIGKILL");
  expect(running.hasExited()).toBe(true);
  // The run settles once, as the kill left it, and the kill is made once:
  // a later call settles as the first did, signalling nothing.
  expect((await running.waitForExit()).signal).toBe("SIGKILL");
  expect(await running.killGroup()).toBe(killed);
}, 60_000);

test("a zombie counts as listed: the process list lists an unreaped child, and killGroup waits until its new parent has reaped it (T13.5-3)", async () => {
  const { workspace } = await standin();
  const pidFile = path.join(workspace.tempRoot, "zombie.pid");
  const running = await startProduct(
    {
      label: "zombie-making shell",
      command: "/bin/sh",
      prefixArgs: ["-c", ZOMBIE_SCRIPT, "sh"],
    },
    { cwd: workspace.root, argv: [pidFile], processGroup: true },
  );
  killGroupAtEnd(running);
  await running.waitForFile(pidFile);
  const zombie = await readPid(pidFile);
  const deadline = Date.now() + 20_000;
  while ((await readListedProcess(zombie))?.state !== "Z") {
    expect(Date.now() < deadline, `${zombie} became a zombie`).toBe(true);
    await sleep(20);
  }
  expect((await readProcessList()).has(zombie)).toBe(true);
  expect((await readListedProcess(zombie))?.pgrp).toBe(running.pid);

  const killed = await running.killGroup();
  expect(killed.identifiers).toEqual(
    [running.pid!, zombie].sort((a, b) => a - b),
  );
  expect(killed.result.signal).toBe("SIGKILL");
  expect(await listedAmong([running.pid!, zombie])).toEqual([]);
}, 60_000);

test("killGroup on a run that had already ended reports that run's own exit and leaves nothing of its group listed", async () => {
  const { workspace, binding } = await standin();
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["exit", "7"],
    processGroup: true,
  });
  expect((await running.waitForExit()).exitCode).toBe(7);
  const killed = await running.killGroup();
  expect(killed.result.exitCode).toBe(7);
  expect(killed.result.signal).toBeNull();
  expect(killed.identifiers).toContain(running.pid);
  expect(await listedAmong(killed.identifiers)).toEqual([]);
}, 60_000);

test("on a run leading its own group, the hang guard kills the whole group: no process it started outlives the timeout", async () => {
  const { workspace, binding } = await standin();
  const pidFile = path.join(workspace.tempRoot, "hang.pid");
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["hang-group", pidFile],
    processGroup: true,
    timeoutMs: 5_000,
  });
  killGroupAtEnd(running);
  await running.waitForFile(pidFile);
  const grandchild = await readPid(pidFile);
  // The grandchild shares the run's streams: had the guard killed the
  // started process alone, the run would never settle.
  const outcome = await Promise.race([
    rejectionOf(running.waitForExit()),
    sleep(20_000).then(() => "unsettled 20 s after the hang guard's bound"),
  ]);
  expect(outcome).toBeInstanceOf(ProductRunTimeoutError);
  const gone = await confirmGroupGone(
    running.pid!,
    [grandchild],
    "the hung stand-in",
    { timeoutMs: 20_000 },
  );
  expect(gone).toContain(grandchild);
  expect(await listedAmong([running.pid!, grandchild])).toEqual([]);
}, 60_000);

/** The identifiers a void reason names as listed again. */
function listedAgainIn(reason: string): number[] {
  const match = /identifier\(s\) ([0-9, ]+) of the killed group/.exec(reason);
  expect(match, reason).not.toBeNull();
  return match![1]!.split(", ").map(Number);
}

test("the reuse check voids the trial when a killed identifier is listed again, naming exactly the listed ones, and fails the test, diagnosed, when none is (T13.5-3)", async () => {
  const setup = await standin();
  const { running } = await heldGroup(setup, "reuse");
  const killed = await running.killGroup();
  // A live process stands in for an identifier reused since the kill.
  const live = await startProduct(setup.binding, {
    cwd: setup.workspace.root,
    argv: ["idle"],
    processGroup: true,
  });
  killGroupAtEnd(live);
  const reused = live.pid!;

  const voided = await rejectionOf(
    applyReuseCheck([...killed.identifiers, reused], "stand-in refusal"),
  );
  expect(voided).toBeInstanceOf(TrialVoided);
  expect(voided).not.toBeInstanceOf(HarnessAssertionError);
  expect(listedAgainIn((voided as TrialVoided).reason)).toEqual([reused]);
  expect((voided as TrialVoided).reason).toContain("stand-in refusal");

  const failed = await rejectionOf(
    applyReuseCheck(killed.identifiers, "stand-in refusal"),
  );
  expect(failed).toBeInstanceOf(HarnessAssertionError);
  expect((failed as Error).message).toContain("stand-in refusal");
  expect((failed as Error).message).toContain(
    `— ${killed.identifiers.join(", ")} —`,
  );

  // Through the runner: the void reruns the trial, which then passes.
  const attempts: number[] = [];
  const verdict = await runVoidableTrial("reuse-check trial", async (n) => {
    attempts.push(n);
    if (n === 1) await applyReuseCheck([reused], "first attempt's refusal");
    return "verdict";
  });
  expect(verdict).toBe("verdict");
  expect(attempts).toEqual([1, 2]);
}, 60_000);

test("runVoidableTrial reruns a voided trial and returns the verdict of the first attempt reaching one", async () => {
  const attempts: number[] = [];
  const verdict = await runVoidableTrial("stand-in trial", async (n) => {
    attempts.push(n);
    if (n === 1) voidTrial("the first attempt's staging was void");
    return n * 10;
  });
  expect(verdict).toBe(20);
  expect(attempts).toEqual([1, 2]);
});

test("runVoidableTrial exhausts into the harness error VoidedTrialsExhaustedError, naming every reason — never a HarnessAssertionError", async () => {
  for (const attempts of [3, undefined]) {
    let calls = 0;
    const exhausted = await rejectionOf(
      runVoidableTrial(
        "stand-in trial",
        async (n) => {
          calls += 1;
          return voidTrial(`reason ${String(n)}`);
        },
        attempts === undefined ? {} : { attempts },
      ),
    );
    const expected = attempts ?? DEFAULT_VOIDABLE_ATTEMPTS;
    expect(calls).toBe(expected);
    expect(exhausted).toBeInstanceOf(VoidedTrialsExhaustedError);
    expect(exhausted).not.toBeInstanceOf(HarnessAssertionError);
    const error = exhausted as VoidedTrialsExhaustedError;
    expect(error.label).toBe("stand-in trial");
    expect(error.reasons).toEqual(
      Array.from({ length: expected }, (_, i) => `reason ${String(i + 1)}`),
    );
    expect(error.message).toContain("harness error (H-11): stand-in trial");
    for (const reason of error.reasons) expect(error.message).toContain(reason);
  }
  await expect(
    runVoidableTrial("stand-in trial", async () => 1, { attempts: 0 }),
  ).rejects.toThrow(/attempts must be a positive integer/);
});

test("runVoidableTrial propagates any other failure as is, never retried — after a void too", async () => {
  for (const failure of [
    new HarnessAssertionError("diagnosed"),
    new Error("harness defect"),
    new VoidedTrialsExhaustedError("an inner trial", ["inner reason"]),
  ]) {
    let calls = 0;
    const thrown = await rejectionOf(
      runVoidableTrial("stand-in trial", async () => {
        calls += 1;
        throw failure;
      }),
    );
    expect(thrown).toBe(failure);
    expect(calls).toBe(1);
  }
  const failure = new HarnessAssertionError("second attempt's verdict");
  let calls = 0;
  const thrown = await rejectionOf(
    runVoidableTrial("stand-in trial", async (n) => {
      calls += 1;
      if (n === 1) voidTrial("first");
      throw failure;
    }),
  );
  expect(thrown).toBe(failure);
  expect(calls).toBe(2);
});
