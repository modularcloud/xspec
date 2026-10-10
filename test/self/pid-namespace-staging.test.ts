// 13.5's machine-wide stagings II (helpers/machine-staging.ts): the fresh
// process-identifier namespaces of T13.5-10(e)–(g), pinned where no
// administrative access is needed (TEST-SPEC H-2, E-1, E-3, T13.5-3,
// T13.5-10; H-11). What needs `sudo` — a run started as a namespace's first
// process, a namespace whose first process is the harness's own, the kills
// that reach them — is pinned in pid-namespace-staging.admin.test.ts, which
// runs where the job's administrative access is (CI's Linux legs).
//
// - Launcher A's command line is exactly sudo, the umask, every limit,
//   `unshare --pid --fork --mount-proc`, `setpriv` back to the harness's
//   uid, gid, and supplementary groups with no capability, and `env -i` with
//   exactly the given environment, then the command verbatim; launcher B's
//   enters the first process's process-identifier and mount namespaces with
//   `nsenter`, the working directory resolved there; what they cannot
//   express is refused.
// - NSpid lines read exactly; a run lying in the harness's own namespace is
//   no namespaced run, `HarnessStagingError` (never an assertion failure).
// - The first process's answers read exactly; allocation reaches an
//   identifier when the last allocated does, or after a wrap; its script,
//   run here as a plain child, keeps its protocol.
// - T13.5-10(g)'s check that identifiers are listed in the harness's own
//   process list passes or fails as a harness error.
// - Withheld administrative access, and a stand-in `sudo` that grants it
//   but starts everything in the harness's own namespace, fail both
//   launchers as `HarnessStagingError`, the harness namespace's first
//   process killed and confirmed gone.

import { spawn } from "node:child_process";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { listedAmong } from "../helpers/kill-discipline.js";
import {
  freshNamespaceLauncher,
  freshNamespaceSpawn,
  hasAllocated,
  inNamespaceIdentifiers,
  NAMESPACE_SHELL_ARGS,
  namespacedProcessesOf,
  namespaceEntrySpawn,
  openHarnessNamespace,
  parseNamespaceObservation,
  parseNSpid,
  readNSpid,
  verifyListedByHarness,
} from "../helpers/machine-staging.js";
import type { NamespaceSpawnPlan } from "../helpers/machine-staging.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import { startProduct } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";

/** An identifier no process bears: above Linux's PID_MAX_LIMIT (2^22). */
const NEVER_LISTED = 4_194_305;

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

async function scratchDir(): Promise<string> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "xspec-pidns-"));
  onTestFinished(() => fsp.rm(dir, { recursive: true, force: true }));
  return dir;
}

const PLAN: NamespaceSpawnPlan = {
  sudo: "sudo",
  identity: { uid: 1001, gid: 1002, groups: [1002, 4, 100] },
  limits: ["--nofile=1024:4096", "--core=0:unlimited"],
  umask: 0o022,
};

const ROOT_STAGE = [
  "-n",
  "--",
  "/bin/sh",
  "-c",
  'umask "$1" && shift && exec "$@"',
  "sh",
  "0022",
  "prlimit",
  "--nofile=1024:4096",
  "--core=0:unlimited",
  "--",
];

const DROP_STAGE = [
  "setpriv",
  "--reuid=1001",
  "--regid=1002",
  "--groups=1002,4,100",
  "--inh-caps=-all",
  "--bounding-set=-all",
  "--",
];

test("launcher A's command line: sudo, the umask, every limit, unshare --pid --fork --mount-proc, setpriv back to the harness's uid, gid, and groups with no capability, env -i with exactly the given environment, then the command verbatim; no group is --clear-groups; what it cannot express is refused", () => {
  expect(
    freshNamespaceSpawn(
      PLAN,
      { command: "/usr/bin/node", args: ["bin.js", "a b", "x=y", "--json"] },
      { A: "1", C: "k=v", EMPTY: "" },
    ),
  ).toEqual({
    command: "sudo",
    args: [
      ...ROOT_STAGE,
      "unshare",
      "--pid",
      "--fork",
      "--mount-proc",
      "--",
      ...DROP_STAGE,
      "env",
      "-i",
      "--",
      "A=1",
      "C=k=v",
      "EMPTY=",
      "/usr/bin/node",
      "bin.js",
      "a b",
      "x=y",
      "--json",
    ],
  });
  const bare = freshNamespaceSpawn(
    { ...PLAN, sudo: "/opt/s", identity: { uid: 7, gid: 8, groups: [] } },
    { command: "/bin/true", args: [] },
    {},
  );
  expect(bare.command).toBe("/opt/s");
  expect(bare.args.slice(ROOT_STAGE.length + 5)).toEqual([
    "setpriv",
    "--reuid=7",
    "--regid=8",
    "--clear-groups",
    "--inh-caps=-all",
    "--bounding-set=-all",
    "--",
    "env",
    "-i",
    "--",
    "/bin/true",
  ]);
  for (const command of ["node", "/opt/a=b/node"]) {
    expect(() => freshNamespaceSpawn(PLAN, { command, args: [] }, {})).toThrow(
      /^a namespace launcher starts an absolute command holding no `=`/,
    );
  }
  for (const name of ["", "A=B"]) {
    expect(() =>
      freshNamespaceSpawn(
        PLAN,
        { command: "/bin/true", args: [] },
        { [name]: "v" },
      ),
    ).toThrow(/^a namespace launcher cannot pass an environment variable/);
  }
});

test("launcher B's command line: sudo, the umask, every limit, nsenter into the first process's process-identifier and mount namespaces with the working directory resolved there, then setpriv and env -i as launcher A; a target that is no identifier, or a relative working directory, is refused", () => {
  expect(
    namespaceEntrySpawn(
      PLAN,
      4321,
      { command: "/usr/bin/node", args: ["bin.js", "x"] },
      { A: "1" },
      "/tmp/w s/work",
    ),
  ).toEqual({
    command: "sudo",
    args: [
      ...ROOT_STAGE,
      "nsenter",
      "--target=4321",
      "--pid",
      "--mount",
      "--wdns=/tmp/w s/work",
      "--",
      ...DROP_STAGE,
      "env",
      "-i",
      "--",
      "A=1",
      "/usr/bin/node",
      "bin.js",
      "x",
    ],
  });
  const invocation = { command: "/bin/true", args: [] };
  for (const target of [0, -3, 1.5]) {
    expect(() =>
      namespaceEntrySpawn(PLAN, target, invocation, {}, "/tmp"),
    ).toThrow(/enters the namespace of a listed process/);
  }
  expect(() =>
    namespaceEntrySpawn(PLAN, 12, invocation, {}, "relative/dir"),
  ).toThrow(/an absolute working directory inside the namespace/);
  expect(() =>
    namespaceEntrySpawn(PLAN, 12, { command: "true", args: [] }, {}, "/tmp"),
  ).toThrow(/^a namespace launcher starts an absolute command/);
});

// A stand-in that writes its hold file and idles, in the harness's own
// namespace.
const HOLDER_SOURCE = `import fs from "node:fs";
fs.writeFileSync(process.argv[2], "");
setInterval(() => {}, 60000);
`;

test("NSpid lines read exactly — a status without one, or of another shape, throws — and a run lying in the harness's own namespace has no in-namespace identifier: HarnessStagingError (pid-namespace), never an assertion failure", async () => {
  expect(parseNSpid("Name:\tnode\nNSpid:\t31337\t1\nUid:\t0\n")).toEqual([
    31337, 1,
  ]);
  expect(parseNSpid("NSpid:\t42")).toEqual([42]);
  expect(() => parseNSpid("Name:\tnode\nPid:\t42\n")).toThrow(/no NSpid line/);
  for (const bad of ["NSpid:\t42 x\n", "NSpid:\t0\n", "NSpid:\n"]) {
    expect(() => parseNSpid(bad)).toThrow(/does not read as identifiers/);
  }
  const own = await readNSpid(process.pid);
  expect(own?.at(-1)).toBe(process.pid);
  expect(await readNSpid(NEVER_LISTED)).toBeUndefined();

  const workspace = await TestWorkspace.create({
    files: { "holder.mjs": HOLDER_SOURCE },
  });
  onTestFinished(() => workspace.dispose());
  const hold = path.join(workspace.tempRoot, "holder.hold");
  const running = await startProduct(
    {
      label: "a holder in the harness's own namespace",
      command: process.execPath,
      prefixArgs: [workspace.path("holder.mjs")],
    },
    { cwd: workspace.root, argv: [hold], processGroup: true },
  );
  onTestFinished(async () => {
    await running.killGroup().catch(() => undefined);
  });
  await running.waitForFile(hold);
  expect(await namespacedProcessesOf(running.pid!)).toEqual([]);
  expectStagingError(
    await rejectionOf(inNamespaceIdentifiers(running)),
    "pid-namespace",
    /no process of the run lies in a process-identifier namespace below the harness's own: the namespace staging did not take effect \(H-11/,
  );
  await running.killGroup();
});

test("the first process's answers read exactly — the last allocated identifier, then the process list, ascending — another shape failing as HarnessStagingError (pid-namespace); allocation reaches an identifier when the last allocated does, or once a listed one exceeds it (a wrap)", () => {
  expect(parseNamespaceObservation("observed 3 1 3 2")).toEqual({
    lastAllocated: 3,
    listed: [1, 2, 3],
  });
  expect(parseNamespaceObservation("observed 1 1")).toEqual({
    lastAllocated: 1,
    listed: [1],
  });
  for (const bad of [
    "observed 3",
    "observed  1",
    "observed 3 1 ",
    "observed 0 1",
    "observed x 1",
    "observed 3 01",
    "unknown",
    "ready",
    "",
  ]) {
    expectStagingError(
      (() => {
        try {
          parseNamespaceObservation(bad);
          return null;
        } catch (error) {
          return error;
        }
      })(),
      "pid-namespace",
      /its answer does not read as `observed <last allocated> <listed>…`/,
    );
  }
  const seen = { lastAllocated: 7, listed: [1, 5, 7] };
  expect(hasAllocated(seen, 1)).toBe(true);
  expect(hasAllocated(seen, 7)).toBe(true);
  expect(hasAllocated(seen, 8)).toBe(false);
  const wrapped = { lastAllocated: 3, listed: [1, 3, 32000] };
  expect(hasAllocated(wrapped, 3)).toBe(true);
  expect(hasAllocated(wrapped, 100_000)).toBe(true);
});

/** Lines of a child's stdout, taken one at a time, bounded. */
function lineReader(stream: NodeJS.ReadableStream): () => Promise<string> {
  let partial = "";
  const lines: string[] = [];
  let ended = false;
  let wake: (() => void) | undefined;
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    partial += chunk;
    for (let at = partial.indexOf("\n"); at >= 0; at = partial.indexOf("\n")) {
      lines.push(partial.slice(0, at));
      partial = partial.slice(at + 1);
    }
    wake?.();
  });
  stream.on("end", () => {
    ended = true;
    wake?.();
  });
  return async () => {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const line = lines.shift();
      if (line !== undefined) return line;
      if (ended) throw new Error("the stream ended");
      if (Date.now() > deadline) throw new Error("no line within 10 s");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 100);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
      wake = undefined;
    }
  };
}

test("the first process's script, run here as a plain child (no namespace, no sudo), keeps its protocol: ready, each observe answered with the last allocated identifier and the process list it sees — its own process among them — anything else answered unknown, and its end at the end of its stdin", async () => {
  const child = spawn("/bin/bash", [...NAMESPACE_SHELL_ARGS], {
    env: { LC_ALL: "C", PATH: "/usr/bin:/bin" },
    stdio: "pipe",
  });
  onTestFinished(() => {
    child.kill("SIGKILL");
  });
  const exited = new Promise<number | null>((resolve) => {
    child.once("close", (code) => {
      resolve(code);
    });
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const next = lineReader(child.stdout);
  expect(await next()).toBe("ready");
  for (let round = 1; round <= 2; round += 1) {
    child.stdin.write("observe\n");
    const observation = parseNamespaceObservation(await next());
    expect(observation.listed).toContain(child.pid);
    expect(Number.isInteger(observation.lastAllocated)).toBe(true);
    expect(observation.lastAllocated).toBeGreaterThan(0);
  }
  child.stdin.write("list everything\n");
  expect(await next()).toBe("unknown");
  child.stdin.end();
  expect(await exited).toBe(0);
  expect(stderr).toBe("");
});

test("T13.5-10(g)'s verification: identifiers the harness's own process list lists pass — 1, every namespace's first process, among them — and one it does not list fails as HarnessStagingError (pid-namespace) naming it, never an assertion failure", async () => {
  await verifyListedByHarness([process.pid, 1], "the harness itself");
  expectStagingError(
    await rejectionOf(verifyListedByHarness([1, NEVER_LISTED], "a held run")),
    "pid-namespace",
    new RegExp(
      `identifier\\(s\\) ${String(NEVER_LISTED)}, which a held run bear\\(s\\) or bore in its namespace, are not listed in the harness's own process list`,
    ),
  );
  await expect(verifyListedByHarness([], "nothing")).rejects.toThrow(
    /no identifier to verify/,
  );
  expect(await listedAmong([1])).toEqual([1]);
});

test("both namespace launchers fail as HarnessStagingError (administrative-access) — never a skip or an assertion failure — where administrative access is withheld: a missing, refusing, or talking command", async () => {
  const scratch = await scratchDir();
  const missing = path.join(scratch, "no-such-command");
  for (const [command, pattern] of [
    [missing, /did not succeed \(failed to start \(ENOENT\)/],
    ["/bin/false", /did not succeed \(exit 1;/],
    ["/bin/echo", /is not silent \(exit 0; stdout: "true";/],
  ] as const) {
    expectStagingError(
      await rejectionOf(freshNamespaceLauncher({ sudo: command })),
      "administrative-access",
      pattern,
    );
    expectStagingError(
      await rejectionOf(openHarnessNamespace({ sudo: command })),
      "administrative-access",
      pattern,
    );
  }
});

/**
 * A stand-in `sudo` granting access (`-n true` succeeds silently) but
 * starting every command in the harness's own namespace as the caller: a
 * kill runs as given; anything else runs from its `env -i` stage on, the
 * stand-in's identifier appended to `record` first.
 */
function ineffectiveSudo(record: string): string {
  return [
    "#!/bin/sh",
    'if [ "$#" -eq 2 ] && [ "$1" = -n ] && [ "$2" = true ]; then exit 0; fi',
    '[ "$1" = -n ] && [ "$2" = -- ] || exit 64',
    "shift 2",
    'if [ "$1" = kill ]; then exec "$@"; fi',
    `echo "$$" >> '${record}'`,
    'while [ "$#" -gt 0 ]; do',
    '  if [ "$1" = env ] && [ "$2" = -i ]; then exec "$@"; fi',
    "  shift",
    "done",
    "exit 65",
    "",
  ].join("\n");
}

test("an ineffective namespace staging — a stand-in sudo granting access but starting everything in the harness's own namespace — fails launcher A's verification on the harness and the harness namespace's start as HarnessStagingError (pid-namespace), never an assertion failure, the first process killed and confirmed gone", async () => {
  const scratch = await scratchDir();
  const record = path.join(scratch, "started");
  const sudo = path.join(scratch, "sudo");
  await fsp.writeFile(sudo, ineffectiveSudo(record), { mode: 0o755 });

  expectStagingError(
    await rejectionOf(freshNamespaceLauncher({ sudo })),
    "pid-namespace",
    /the fresh process-identifier namespace staging is ineffective \(H-11\): the probe bore identifier [0-9]+ \(NSpid "[^"]*"\), not the first process's 1 in a process list of its own namespace; the probe's process list listed .*, not the probe alone/,
  );
  // Asked again after a failure: the probe runs a second time.
  expectStagingError(
    await rejectionOf(freshNamespaceLauncher({ sudo })),
    "pid-namespace",
    /staging is ineffective/,
  );
  const probes = (await fsp.readFile(record, "utf8")).trim().split("\n");
  expect(probes).toHaveLength(2);
  await fsp.rm(record);

  expectStagingError(
    await rejectionOf(openHarnessNamespace({ sudo })),
    "pid-namespace",
    /the first process of a fresh process-identifier namespace was not found as the one descendant of the started process \([0-9]+\) bearing identifier 1 in a namespace below the harness's: found none/,
  );
  const started = (await fsp.readFile(record, "utf8")).trim().split("\n");
  expect(started).toHaveLength(1);
  expect(await listedAmong(started.map(Number))).toEqual([]);
}, 60_000);
