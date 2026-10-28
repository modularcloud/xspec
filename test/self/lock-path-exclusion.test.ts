// Self-checks for H-6's lock-path exclusion across the harness's compares
// (TEST-SPEC 17 preamble: internal self-tests cover harness machinery
// certification does not exercise; H-6; SPEC 13.5, 13.4, 7, 12.0). Every
// comparison of two snapshots (helpers/snapshot.ts `lockPathExclusion`,
// applied by `diffSnapshots` and everything built on it) leaves out the
// lock path `.xspec/lock` and everything under it across directories — the
// root's, and every nested workspace root's — and, within one directory,
// exactly the lock path of each workspace a mutating command's run acted on
// between the two snapshots (helpers/acquiring-runs.ts: its start or its
// end, noted by the subprocess driver), and nothing more; the determinism
// protocol leaves it out whatever the command. Asserted here: 12.0's reading
// of a mutating command (`invocationAcquires`) and of `--config`
// (`configPathArgument`); the classification over noted runs — a run
// between the snapshots, a run held throughout, a run in another workspace,
// a nested root, a `--config` root, a working directory below the root, a
// configless workspace, a snapshot rooted in the area or under the lock
// path; the near-miss names the exclusion never reaches; the
// across-directories form; and, end to end through a stub product, the
// driver's notes (a run's start before it spawns, its end before
// `waitForExit` settles, a kill included), `assertLeavesUnchanged` around a
// mutating command, a preview, and a read, and the determinism protocol.

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, expect, onTestFinished, test } from "vitest";
import {
  acquisitionMark,
  noteAcquiringRun,
} from "../helpers/acquiring-runs.js";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { assertRunTwiceDeterministic } from "../helpers/determinism.js";
import {
  configPathArgument,
  invocationAcquires,
} from "../helpers/invocation-grammar.js";
import {
  assertDirectoriesEqual,
  assertLeavesUnchanged,
  diffSnapshots,
  lockPathExclusion,
  snapshotDirectory,
} from "../helpers/snapshot.js";
import type { ArgvValue, ProductBinding } from "../helpers/subprocess.js";
import { runProduct, startProduct } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";

const CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: { main: ["specs/**/*.mdx"] },
})
`;

const RENAME = ["rename", "specs/A.mdx", "a", "a2"] as const;

async function makeWorkspace(
  files: Record<string, string> = {},
  dirs: readonly string[] = [],
): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create({ files, dirs });
  onTestFinished(() => workspace.dispose());
  return workspace;
}

/** Write `content` at workspace-relative `rel`, parents created. */
async function put(
  workspace: TestWorkspace,
  rel: string,
  content: string,
): Promise<void> {
  const abs = workspace.path(rel);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, content);
}

/** Note a run (start and end) as the driver does, without spawning one. */
async function noteRun(cwd: string, argv: readonly ArgvValue[]): Promise<void> {
  (await noteAcquiringRun(cwd, argv))?.ended();
}

const changedKeys = (
  ...pair: Parameters<typeof diffSnapshots>
): readonly string[] => diffSnapshots(...pair).map((change) => change.key);

// --- 12.0's reading of an invocation ----------------------------------------

test("invocationAcquires reads 13.5's mutating commands — rename and move without --preview, review create, resolve, split — by 12.0's grammar", () => {
  const acquiring: readonly (readonly ArgvValue[])[] = [
    RENAME,
    ["move", "specs/A.mdx", "specs/B.mdx"],
    ["move", "specs/A.mdx#a", "specs/B.mdx#b", "--json"],
    ["--json", "rename", "specs/A.mdx", "a", "a2"],
    ["review", "create", "--strategy", "audit", "--name", "s"],
    ["review", "resolve", "s", "i", "--status", "no-change"],
    ["review", "split", "s", "i"],
    ["rename", "--test-hold", "/h", "specs/A.mdx", "a", "a2"],
    // `--preview` as another flag's value, or after `--`, is no flag.
    ["rename", "specs/A.mdx", "a", "a2", "--name", "--preview"],
    ["rename", "specs/A.mdx", "a", "a2", "--", "--preview"],
    ["--", "rename", "specs/A.mdx", "a", "a2"],
    // A usage error is a mutating command's run all the same.
    ["rename"],
    ["review", "create", "--preview"],
  ];
  const acquiringNothing: readonly (readonly ArgvValue[])[] = [
    [...RENAME, "--preview"],
    ["--preview", "move", "specs/A.mdx", "specs/B.mdx"],
    ["build"],
    ["check"],
    ["ids", "--json"],
    ["version"],
    ["inventory"],
    ["query", "nodes"],
    ["review", "status", "s"],
    ["review", "list"],
    ["review", "next", "s"],
    ["review", "show", "s", "i"],
    ["review", "export", "s"],
    ["review"],
    [],
    // `--config` takes `rename` as its value: the command word is `build`.
    ["--config", "rename", "build"],
    // A token that is not valid UTF-8 is no command word.
    [Uint8Array.from([0x72, 0xff]), "specs/A.mdx", "a", "a2"],
  ];
  for (const argv of acquiring) {
    expect(invocationAcquires(argv), JSON.stringify(argv)).toBe(true);
  }
  for (const argv of acquiringNothing) {
    expect(invocationAcquires(argv), JSON.stringify(argv)).toBe(false);
  }
});

test("configPathArgument reads the --config flag's value as 12.0 reads flags", () => {
  expect(configPathArgument(["--config", "sub/x.ts", "build"])).toBe(
    "sub/x.ts",
  );
  expect(configPathArgument(["build", "--config", "--json"])).toBe("--json");
  expect(configPathArgument(["build"])).toBeUndefined();
  expect(configPathArgument(["build", "--config"])).toBeUndefined();
  expect(configPathArgument(["build", "--", "--config", "x"])).toBeUndefined();
  expect(configPathArgument(["--name", "--config", "build"])).toBeUndefined();
});

// --- the classification over noted runs ---------------------------------------

test("within one directory, a mutating command's run between the snapshots leaves out its lock path and nothing more", async () => {
  const workspace = await makeWorkspace({
    "xspec.config.ts": CONFIG,
    ".xspec/journal": "j\n",
    ".xspec/lockx": "x\n",
    ".xspec/lock.tmp": "t\n",
    "x/.xspec/lock/f": "f\n",
    ".xspec/lock/old": "o\n",
  });
  const before = await snapshotDirectory(workspace.root);
  await noteRun(workspace.root, RENAME);
  for (const rel of [
    ".xspec/lock/new/f",
    ".xspec/journal",
    ".xspec/lockx",
    ".xspec/lock.tmp",
    "x/.xspec/lock/f",
  ]) {
    await put(workspace, rel, "changed\n");
  }
  await fsp.rm(workspace.path(".xspec/lock/old"));
  const after = await snapshotDirectory(workspace.root);
  const exclusion = lockPathExclusion(before, after);
  expect(exclusion.whole).toBe(false);
  expect(exclusion.keys).toEqual([".xspec/lock"]);
  expect(exclusion.excludes(".xspec/lock")).toBe(true);
  expect(exclusion.excludes(".xspec/lock/new/f")).toBe(true);
  expect(exclusion.excludes(".xspec")).toBe(false);
  expect(exclusion.excludes(".xspec/lockx")).toBe(false);
  expect(changedKeys(before, after)).toEqual([
    ".xspec/journal",
    ".xspec/lock.tmp",
    ".xspec/lockx",
    "x/.xspec/lock/f",
  ]);
  // The other order of the arguments classifies alike.
  expect(lockPathExclusion(after, before).keys).toEqual([".xspec/lock"]);
});

test("within one directory, with no mutating command's run between the snapshots — none at all, a run held throughout, a run elsewhere — the lock path is compared", async () => {
  const workspace = await makeWorkspace({ "xspec.config.ts": CONFIG });
  const elsewhere = await makeWorkspace({ "xspec.config.ts": CONFIG });

  // Commands that acquire nothing are never noted.
  const first = await snapshotDirectory(workspace.root);
  expect(await noteAcquiringRun(workspace.root, ["check"])).toBeUndefined();
  expect(
    await noteAcquiringRun(workspace.root, [...RENAME, "--preview"]),
  ).toBeUndefined();
  await put(workspace, ".xspec/lock/e", "leftover\n");
  const second = await snapshotDirectory(workspace.root);
  expect(lockPathExclusion(first, second).keys).toEqual([]);
  expect(changedKeys(first, second)).toEqual([
    ".xspec",
    ".xspec/lock",
    ".xspec/lock/e",
  ]);

  // A run in another workspace between them.
  await noteRun(elsewhere.root, RENAME);
  await put(workspace, ".xspec/lock/e", "altered\n");
  const third = await snapshotDirectory(workspace.root);
  expect(changedKeys(second, third)).toEqual([".xspec/lock/e"]);

  // A run held throughout: started before the first snapshot, ended after
  // the second — its entry stands unchanged meanwhile (T13.5-4).
  const held = await noteAcquiringRun(workspace.root, RENAME);
  const heldFirst = await snapshotDirectory(workspace.root);
  await put(workspace, ".xspec/lock/x", "added beside the entry\n");
  const heldSecond = await snapshotDirectory(workspace.root);
  expect(changedKeys(heldFirst, heldSecond)).toEqual([".xspec/lock/x"]);
  // Its end, between the second snapshot and a third, is an event — one
  // after the first two, so their compare still includes the lock path.
  held?.ended();
  expect(changedKeys(heldFirst, heldSecond)).toEqual([".xspec/lock/x"]);
  await fsp.rm(workspace.path(".xspec/lock"), { recursive: true });
  const heldThird = await snapshotDirectory(workspace.root);
  expect(changedKeys(heldSecond, heldThird)).toEqual([]);
  expect(changedKeys(heldFirst, heldThird)).toEqual([]);
});

test("a run's lock path lies under the root SPEC 7 places it in: a nested root, a --config path's directory, the root above a subdirectory; a configless run's nowhere", async () => {
  const workspace = await makeWorkspace(
    {
      "xspec.config.ts": CONFIG,
      "in/xspec.config.ts": CONFIG,
      "cfg/xspec.config.ts": CONFIG,
    },
    ["in/sub", "specs"],
  );
  const configless = await makeWorkspace({}, ["specs"]);
  const classify = async (
    root: string,
    cwd: string,
    argv: readonly ArgvValue[],
  ): Promise<readonly string[]> => {
    const before = await snapshotDirectory(root);
    await noteRun(cwd, argv);
    const after = await snapshotDirectory(root);
    return lockPathExclusion(before, after).keys;
  };
  expect(
    await classify(workspace.root, workspace.path("in/sub"), RENAME),
  ).toEqual(["in/.xspec/lock"]);
  expect(
    await classify(workspace.root, workspace.root, [
      "--config",
      "cfg/xspec.config.ts",
      ...RENAME,
    ]),
  ).toEqual(["cfg/.xspec/lock"]);
  expect(
    await classify(workspace.root, workspace.path("specs"), RENAME),
  ).toEqual([".xspec/lock"]);
  // A run in the nested workspace leaves the outer lock path compared.
  const before = await snapshotDirectory(workspace.root);
  await noteRun(workspace.path("in"), RENAME);
  await put(workspace, ".xspec/lock/outer", "o\n");
  await put(workspace, "in/.xspec/lock/inner", "i\n");
  expect(changedKeys(before, await snapshotDirectory(workspace.root))).toEqual([
    ".xspec",
    ".xspec/lock",
    ".xspec/lock/outer",
    "in/.xspec",
  ]);
  // No configuration found upward: no lock path, nothing left out.
  expect(
    await classify(configless.root, configless.path("specs"), RENAME),
  ).toEqual([]);
});

test("a snapshot rooted in the area has the lock path at `lock`; one rooted under it is left out whole", async () => {
  const workspace = await makeWorkspace({
    "xspec.config.ts": CONFIG,
    ".xspec/journal": "j\n",
    ".xspec/lock/zz/f": "f\n",
  });
  const area = workspace.path(".xspec");
  const inside = workspace.path(".xspec/lock/zz");
  const areaBefore = await snapshotDirectory(area);
  const insideBefore = await snapshotDirectory(inside);
  await noteRun(workspace.root, RENAME);
  await put(workspace, ".xspec/lock/zz/f", "altered\n");
  const areaExclusion = lockPathExclusion(
    areaBefore,
    await snapshotDirectory(area),
  );
  expect(areaExclusion.keys).toEqual(["lock"]);
  expect(areaExclusion.excludes("journal")).toBe(false);
  const insideExclusion = lockPathExclusion(
    insideBefore,
    await snapshotDirectory(inside),
  );
  expect(insideExclusion.whole).toBe(true);
  expect(insideExclusion.excludes("f")).toBe(true);
});

test("across directories the lock path is always left out — the root's and every nested workspace root's — and nothing more", async () => {
  const files = {
    "xspec.config.ts": CONFIG,
    "in/xspec.config.ts": CONFIG,
    ".xspec/journal": "j\n",
  };
  const first = await makeWorkspace(files);
  const second = await makeWorkspace(files);
  await put(first, ".xspec/lock/a", "entry of one run\n");
  await put(second, ".xspec/lock/b", "entry of another\n");
  await put(first, "in/.xspec/lock/c", "nested entry\n");
  await put(second, "in/.xspec/lock/d/e", "another nested entry\n");
  await assertDirectoriesEqual(first.root, second.root, "lock paths alone");
  const exclusion = lockPathExclusion(
    await snapshotDirectory(first.root),
    await snapshotDirectory(second.root),
  );
  expect(exclusion.keys).toEqual([".xspec/lock", "in/.xspec/lock"]);
  // No workspace root at `in2`: its `.xspec/lock` is compared.
  await put(first, "in2/.xspec/lock/d", "not a lock path\n");
  const nearMiss = await assertDirectoriesEqual(
    first.root,
    second.root,
    "near miss",
  ).catch((error: unknown) => error);
  expect(nearMiss).toBeInstanceOf(HarnessAssertionError);
  expect((nearMiss as Error).message).toContain("in2/.xspec/lock/d");
  expect((nearMiss as Error).message).toContain(
    "excluded (H-6): .xspec/lock, in/.xspec/lock",
  );
  await fsp.rm(first.path("in2"), { recursive: true });
  await put(first, ".xspec/journal", "diverged\n");
  await expect(
    assertDirectoriesEqual(first.root, second.root, "journal"),
  ).rejects.toThrow(HarnessAssertionError);
});

// --- end to end through the subprocess driver ---------------------------------

// A stub product: writes `H6_STUB_WRITES` ([rel, content] pairs; `{pid}` in
// a name or content becomes its process ID) relative to its working
// directory, then — given `--test-hold <path>` in its argv — creates the
// hold file and waits for its deletion, then removes `H6_STUB_REMOVES`.
const STUB_SOURCE = `import * as fs from "node:fs";
import * as path from "node:path";
const fill = (text) => text.split("{pid}").join(String(process.pid));
for (const [rel, content] of JSON.parse(process.env.H6_STUB_WRITES ?? "[]")) {
  const abs = path.resolve(fill(rel));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, fill(content));
}
const at = process.argv.indexOf("--test-hold");
if (at !== -1) {
  const hold = process.argv[at + 1];
  fs.writeFileSync(hold, "", { flag: "wx" });
  const cell = new Int32Array(new SharedArrayBuffer(4));
  while (fs.existsSync(hold)) Atomics.wait(cell, 0, 0, 10);
}
for (const rel of JSON.parse(process.env.H6_STUB_REMOVES ?? "[]")) {
  fs.rmSync(path.resolve(fill(rel)), { recursive: true, force: true });
}
`;

let stubDir: string;
let stub: ProductBinding;

beforeAll(async () => {
  stubDir = await fsp.mkdtemp(path.join(os.tmpdir(), "h6-stub-"));
  const stubPath = path.join(stubDir, "stub.mjs");
  await fsp.writeFile(stubPath, STUB_SOURCE);
  stub = {
    label: "H-6 stub product",
    command: process.execPath,
    prefixArgs: [stubPath],
  };
});

afterAll(async () => {
  await fsp.rm(stubDir, { recursive: true, force: true });
});

const writes = (...pairs: (readonly [string, string])[]) => ({
  H6_STUB_WRITES: JSON.stringify(pairs),
});

test("assertLeavesUnchanged leaves out the lock path around a mutating command's run, and compares it around a preview and a read", async () => {
  const workspace = await makeWorkspace({
    "xspec.config.ts": CONFIG,
    ".xspec/journal": "j\n",
  });
  await assertLeavesUnchanged(
    workspace.root,
    () =>
      runProduct(stub, {
        cwd: workspace.root,
        argv: RENAME,
        env: writes([".xspec/lock/{pid}", "entry"]),
      }),
    "a mutating command's leftover",
  );
  for (const argv of [[...RENAME, "--preview"], ["check"], ["ids"]]) {
    await expect(
      assertLeavesUnchanged(
        workspace.root,
        () =>
          runProduct(stub, {
            cwd: workspace.root,
            argv,
            env: writes([".xspec/lock/zz/f", argv.join(" ")]),
          }),
        `a write at the lock path by \`${argv.join(" ")}\``,
      ),
    ).rejects.toThrow(/\.xspec\/lock\/zz\/f/);
  }
  // Around a mutating command, a write anywhere else still fails.
  const failure = await assertLeavesUnchanged(
    workspace.root,
    () =>
      runProduct(stub, {
        cwd: workspace.root,
        argv: ["review", "create", "--strategy", "audit", "--name", "s"],
        env: writes(
          [".xspec/lock/{pid}", "entry"],
          [".xspec/reviews/s.json", "{}\n"],
        ),
      }),
    "a mutating command's session write",
  ).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(HarnessAssertionError);
  const message = (failure as Error).message;
  expect(message).toContain(".xspec/reviews/s.json");
  expect(message).toContain("excluded (H-6): .xspec/lock");
  expect(message).not.toMatch(/added \.xspec\/lock\//);
});

test("the driver notes a mutating command's run as it starts and again before waitForExit settles — a completion and a kill alike — and nothing for a read", async () => {
  const workspace = await makeWorkspace({ "xspec.config.ts": CONFIG });
  const hold = path.join(path.dirname(workspace.root), "h6-hold.tmp");
  const atStart = acquisitionMark();
  await runProduct(stub, { cwd: workspace.root, argv: ["check"] });
  expect(acquisitionMark()).toBe(atStart);

  const held = await startProduct(stub, {
    cwd: workspace.root,
    argv: [...RENAME, "--test-hold", hold],
    env: {
      ...writes([".xspec/lock/held", "entry"]),
      H6_STUB_REMOVES: JSON.stringify([".xspec/lock"]),
    },
  });
  expect(acquisitionMark()).toBe(atStart + 1);
  await held.waitForFile(hold);
  // Held: a read's compare keeps the held run's entry in (H-6, T13.5-4).
  const whileHeld = await snapshotDirectory(workspace.root);
  await runProduct(stub, {
    cwd: workspace.root,
    argv: ["ids"],
    env: writes([".xspec/lock/beside", "added"]),
  });
  const afterRead = await snapshotDirectory(workspace.root);
  expect(changedKeys(whileHeld, afterRead)).toEqual([".xspec/lock/beside"]);
  await fsp.rm(hold);
  await held.waitForExit();
  expect(acquisitionMark()).toBe(atStart + 2);
  // The release, between the snapshots, is left out.
  expect(
    changedKeys(afterRead, await snapshotDirectory(workspace.root)),
  ).toEqual([]);

  const killed = await startProduct(stub, {
    cwd: workspace.root,
    argv: ["review", "resolve", "s", "i", "--test-hold", hold],
    env: writes([".xspec/lock/killed", "leftover"]),
  });
  await killed.waitForFile(hold);
  const beforeKill = acquisitionMark();
  killed.kill("SIGKILL");
  const result = await killed.waitForExit();
  expect(result.signal).toBe("SIGKILL");
  expect(acquisitionMark()).toBe(beforeKill + 1);
  await fsp.rm(hold);
});

test("the determinism protocol leaves the lock path out whatever the command, and compares everything else", async () => {
  const workspace = await makeWorkspace({ "xspec.config.ts": CONFIG });
  await assertRunTwiceDeterministic({
    binding: stub,
    run: {
      cwd: workspace.root,
      argv: ["build"],
      env: writes([".xspec/lock/{pid}", "{pid}"], ["out.txt", "same"]),
    },
    context: "a different lock entry per run",
  });
  expect(fs.readdirSync(workspace.path(".xspec/lock")).length).toBe(2);
  await expect(
    assertRunTwiceDeterministic({
      binding: stub,
      run: {
        cwd: workspace.root,
        argv: ["build"],
        env: writes(["out.txt", "{pid}"]),
      },
      context: "different bytes per run",
    }),
  ).rejects.toThrow(/out\.txt/);
});
