// Self-checks for the module channel's observations of a run's effects
// (TEST-SPEC 17 preamble: internal self-tests cover harness machinery
// certification does not exercise; T7.6-7(b), (c), and (e), §7.6 Pairing,
// H-2, H-3, S-3, E-1; helpers/module-channel-node.ts and its bootstrap,
// helpers/module-channel-bootstrap.cjs). T7.6-7, whose observations these
// are (test/suite/registry/section-7.6-ii.ts, beside T7.6-6), and S-10's
// checks — each observation catching the effect it exists for on each
// release and route — build on these; here the observations' plumbing is
// pinned before any product exists, on each of E-1's releases, so
// XSPEC_NODE_RELEASES_DIR must name them, as CI's harness-self job and
// AGENTS.md's recipe do
// (unset, every test here that runs a release fails as the harness error
// NodeReleaseError, never a skip):
// - a conforming dual stand-in, along each route on each release, with
//   T7.6-7(e)'s FIFOs staged — `xspec.config.ts` in the working directory,
//   in the importing module's directory, and in HOME — leaves every
//   observation unchanged: no entry created, modified, or removed in the
//   staging, the working directory, HOME, or TMPDIR; the process state
//   unchanged across the load and the calls, its comparison observing the
//   global object, process, and ECMAScript's built-ins; each FIFO still a
//   FIFO; and no problem reported, the pairing met;
// - end to end on one release, a stand-in writing a file into TMPDIR and one
//   adding a global and starting a timer are reported, as problems in words
//   naming the place and the observations (S-10's catches of each effect on
//   every release and route are its own);
// - a place's snapshot on a directory of its own: each kind named, a FIFO
//   recorded by its kind and never opened, and a write and a rewrite found;
// - the pure functions on vectors: the comparison of two snapshots, and the
//   problem functions, each led by the pairing.
//
// The stand-in packages are small hand-written, non-xspec packages, written
// at run time into fresh directories under the OS temporary directory from
// the texts below (STAND_INS), so the committed tree holds no package of
// this file's own.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { stageFifo } from "../helpers/lock-staging.js";
import { ModuleStaging, runtimeArm } from "../helpers/module-channel.js";
import type { Placement } from "../helpers/module-channel.js";
import {
  assertModuleLoaded,
  CALL_CASES,
  comparePlaceSnapshots,
  fifoProblems,
  MODULE_ROUTES,
  prepareModuleRun,
  REQUIRED_STATE_SUBJECTS,
  RUN_FIFO_NAME,
  runtimeOutputProblems,
  snapshotPlace,
  stateProblems,
  writeProblems,
} from "../helpers/module-channel-node.js";
import type {
  CallResult,
  LoadedModuleRun,
  ModuleRoute,
  ModuleRunRequest,
  PlaceEntry,
  RunEffects,
  StateChange,
} from "../helpers/module-channel-node.js";
import { resolveNodeReleases } from "../helpers/node-releases.js";
import type { NodeRelease } from "../helpers/node-releases.js";
import type { ProductBinding } from "../helpers/subprocess.js";

const LF = String.fromCodePoint(0x0a);

/** A manifest's text. */
function manifest(members: Record<string, unknown>): string {
  return `${JSON.stringify(members, null, 2)}${LF}`;
}

/** A module's text, from its lines. */
function lines(...text: string[]): string {
  return `${text.join(LF)}${LF}`;
}

/** A CommonJS module's `defineConfig`, an identity function. */
const COMMONJS_DEFINE_CONFIG = [
  "exports.defineConfig = function defineConfig(settings) {",
  "  return settings;",
  "};",
];

/**
 * The stand-in packages (module header), each a map from a file's
 * package-relative path to its text.
 */
const STAND_INS = {
  /** Conforming: an ES-module entry for import, a CommonJS one for require. */
  dual: {
    "package.json": manifest({
      name: "effects-dual-standin",
      version: "1.0.0",
      type: "module",
      main: "./index.cjs",
      exports: { ".": { import: "./index.js", require: "./index.cjs" } },
    }),
    "index.js": lines(
      "export function defineConfig(settings) {",
      "  return settings;",
      "}",
    ),
    "index.cjs": lines(...COMMONJS_DEFINE_CONFIG),
  },
  /** Writes a file into the run's TMPDIR while it loads. */
  writing: {
    "package.json": manifest({
      name: "effects-writing-standin",
      version: "1.0.0",
      main: "./index.js",
    }),
    "index.js": lines(
      'const path = require("node:path");',
      'const os = require("node:os");',
      'require("node:fs").writeFileSync(path.join(os.tmpdir(), "xspec-written"), "written");',
      ...COMMONJS_DEFINE_CONFIG,
    ),
  },
  /** Adds a global and starts a timer while it loads. */
  stateful: {
    "package.json": manifest({
      name: "effects-stateful-standin",
      version: "1.0.0",
      main: "./index.js",
    }),
    "index.js": lines(
      "globalThis.xspecEffect = 1;",
      "setTimeout(() => {}, 200);",
      ...COMMONJS_DEFINE_CONFIG,
    ),
  },
} as const satisfies Record<string, Record<string, string>>;

/** A fresh, empty directory of this test's own, removed once it ends. */
async function freshDirectory(prefix: string): Promise<string> {
  const directory = await fsp.realpath(
    await fsp.mkdtemp(path.join(os.tmpdir(), prefix)),
  );
  onTestFinished(() => fsp.rm(directory, { recursive: true, force: true }));
  return directory;
}

/** Write `files` into a fresh package directory, returned. */
async function writeStandIn(files: Record<string, string>): Promise<string> {
  const directory = await freshDirectory("xspec-effects-standin-");
  for (const [name, text] of Object.entries(files)) {
    await fsp.writeFile(path.join(directory, name), text, { flag: "wx" });
  }
  return directory;
}

/**
 * A binding of the certification fixtures' shape beside `packageDir`: its
 * executable is never run here.
 */
function standInBinding(packageDir: string): ProductBinding {
  return {
    label: "module-channel effects stand-in binding",
    command: process.execPath,
    requiredFiles: [process.execPath],
    packageDir,
  };
}

/** A staging and its canonical placement in a CommonJS project. */
interface StagedPackage {
  readonly staging: ModuleStaging;
  readonly placement: Placement;
}

/**
 * Stage the stand-in `files` at the canonical placement in a CommonJS
 * project, for runs on `releases`; disposed of once the test ends.
 */
async function stageStandIn(
  files: Record<string, string>,
  releases: readonly NodeRelease[],
  context: string,
): Promise<StagedPackage> {
  const staging = await ModuleStaging.create(
    standInBinding(await writeStandIn(files)),
    context,
  );
  onTestFinished(() => staging.dispose());
  await staging.stageProject("project", "commonjs");
  const placement = await staging.placeCanonical(
    "project",
    runtimeArm(releases),
  );
  return { staging, placement };
}

/** One run's request over `staged`, observing its effects. */
function request(
  staged: StagedPackage,
  release: NodeRelease,
  route: ModuleRoute,
  context: string,
): ModuleRunRequest {
  return {
    staging: staged.staging,
    placement: staged.placement,
    route,
    release,
    project: "commonjs",
    alone: true,
    effects: true,
    context,
  };
}

/** The first of E-1's releases, for the checks one release serves. */
async function firstRelease(): Promise<NodeRelease> {
  const [release] = await resolveNodeReleases();
  if (release === undefined) throw new Error("E-1 lists no release");
  return release;
}

test("a conforming dual stand-in, along each of Node.js's four routes on each of E-1's releases, with T7.6-7(e)'s FIFOs staged — xspec.config.ts in the run's working directory, in the importing module's directory (staged once, found by every later run), and in its HOME — leaves every observation unchanged: no entry created, modified, or removed in the staging, the working directory, HOME, or TMPDIR; the process state unchanged across the load and the calls, its comparison observing the global object, process, and ECMAScript's global constructors, namespace objects, and prototypes; each FIFO still a FIFO; the run ended on its own; and no problem is reported, the pairing met (TEST-SPEC T7.6-7(b), (c), (e), §7.6 Pairing)", async () => {
  const releases = await resolveNodeReleases();
  const staged = await stageStandIn(
    STAND_INS.dual,
    releases,
    "effects self-test: dual",
  );
  const importingFifo = path.join(staged.placement.holdingDir, RUN_FIFO_NAME);
  for (const release of releases) {
    for (const route of MODULE_ROUTES) {
      const context = `effects self-test: dual, ${release.version}, ${route}`;
      const prepared = await prepareModuleRun(
        request(staged, release, route, context),
      );
      let loaded: LoadedModuleRun;
      try {
        expect(prepared.fifos, context).toEqual([
          path.join(prepared.cwd, RUN_FIFO_NAME),
          importingFifo,
          path.join(prepared.home, RUN_FIFO_NAME),
        ]);
        for (const fifo of prepared.fifos) {
          expect((await fsp.lstat(fifo)).isFIFO(), context).toBe(true);
        }
        loaded = assertModuleLoaded(await prepared.launch(), "stand-in");
      } finally {
        await prepared.dispose();
      }
      const effects = loaded.effects;
      expect(effects, context).toBeDefined();
      if (effects === undefined) continue;
      expect(
        effects.writes.map((writes) => [writes.place, writes.root]),
        context,
      ).toEqual([
        ["staging", staged.staging.root],
        ["working directory", loaded.cwd],
        ["HOME", loaded.home],
        ["TMPDIR", loaded.tmp],
      ]);
      expect(
        effects.writes.flatMap((writes) => writes.changes),
        context,
      ).toEqual([]);
      expect(effects.fifos, context).toEqual(
        prepared.fifos.map((fifo) => ({ path: fifo, found: "FIFO" })),
      );
      const { state } = loaded.report;
      expect(state.changes, context).toEqual([]);
      expect(state.omitted, context).toBe(0);
      for (const label of REQUIRED_STATE_SUBJECTS) {
        expect(state.subjects, context).toContain(label);
      }
      expect(stateProblems(loaded), context).toEqual([]);
      expect(writeProblems(loaded), context).toEqual([]);
      expect(fifoProblems(loaded), context).toEqual([]);
      expect(await runtimeOutputProblems(loaded), context).toEqual([]);
    }
  }
  expect((await fsp.lstat(importingFifo)).isFIFO()).toBe(true);
});

test("end to end on one release, each of T7.6-7(b)'s and (c)'s observations reports what a stand-in does while it loads, as problems in words: a file written into TMPDIR (b), naming the place and the entry created; a global added and a timer started (c), each under its observation; the FIFOs still FIFOs, and the pairing met (TEST-SPEC T7.6-7(b), (c), §7.6 Pairing)", async () => {
  const release = await firstRelease();
  const run = async (
    standIn: keyof typeof STAND_INS,
  ): Promise<LoadedModuleRun> => {
    const context = `effects self-test: ${standIn}, ${release.version}`;
    const staged = await stageStandIn(STAND_INS[standIn], [release], context);
    const prepared = await prepareModuleRun(
      request(staged, release, "require", context),
    );
    try {
      return assertModuleLoaded(await prepared.launch(), "stand-in");
    } finally {
      await prepared.dispose();
    }
  };

  const writing = await run("writing");
  expect(
    writing.effects?.writes.map((writes) => [writes.place, writes.changes]),
  ).toEqual([
    ["staging", []],
    ["working directory", []],
    ["HOME", []],
    [
      "TMPDIR",
      [
        {
          path: "xspec-written",
          change: "created",
          detail: "it is a plain file of 7 byte(s)",
        },
      ],
    ],
  ]);
  const written = writeProblems(writing);
  expect(written).toHaveLength(1);
  expect(written[0]).toContain(`in the run's TMPDIR (${writing.tmp})`);
  expect(written[0]).toContain('"xspec-written" was created');
  expect(written[0]).toContain("TEST-SPEC T7.6-7(b)");
  expect(fifoProblems(writing)).toEqual([]);
  expect(stateProblems(writing)).toEqual([]);

  const stateful = await run("stateful");
  expect(
    stateful.report.state.changes.map((change) => [
      change.observation,
      change.subject,
    ]),
  ).toEqual([
    ["global-object", "the global object"],
    ["timers-and-handles", "the pending timers and handles"],
  ]);
  const changed = stateProblems(stateful);
  expect(changed).toHaveLength(2);
  expect(changed[0]).toContain('an own property "xspecEffect" was added');
  expect(changed[1]).toContain("0 timer(s) were pending (Timeout), and 1 are");
  for (const problem of changed) {
    expect(problem).toContain("TEST-SPEC T7.6-7(c)");
  }
  expect(writeProblems(stateful)).toEqual([]);
  expect(fifoProblems(stateful)).toEqual([]);
});

test("a place's snapshot names each entry's kind — a plain file with its bytes, a directory, a symbolic link with its target, never followed, and a FIFO by its kind alone, never opened — the place itself under '.'; two snapshots of an unchanged place compare equal, and a file written and a file rewritten are found, by path (TEST-SPEC T7.6-7(b), S-3)", async () => {
  const place = await freshDirectory("xspec-effects-place-");
  const beside = await freshDirectory("xspec-effects-place-scratch-");
  await fsp.writeFile(path.join(place, "file"), "bytes", { flag: "wx" });
  await fsp.mkdir(path.join(place, "directory"));
  await fsp.writeFile(path.join(place, "directory", "inner"), "inner", {
    flag: "wx",
  });
  await fsp.symlink("directory/inner", path.join(place, "link"));
  await stageFifo({ root: place, tempRoot: beside }, "fifo");
  const before = await snapshotPlace(place, "effects self-test: place");
  expect([...before.entries()]).toEqual([
    ["", { kind: "directory", listed: true }],
    ["directory", { kind: "directory", listed: true }],
    [
      "directory/inner",
      { kind: "plain file", bytes: Buffer.from("inner", "utf8") },
    ],
    ["fifo", { kind: "FIFO" }],
    ["file", { kind: "plain file", bytes: Buffer.from("bytes", "utf8") }],
    [
      "link",
      { kind: "symbolic link", target: Buffer.from("directory/inner", "utf8") },
    ],
  ]);
  expect(
    comparePlaceSnapshots(
      before,
      await snapshotPlace(place, "effects self-test: place"),
    ),
  ).toEqual([]);
  await fsp.writeFile(path.join(place, "added"), "new", { flag: "wx" });
  await fsp.writeFile(path.join(place, "file"), "BYTES");
  const changes = comparePlaceSnapshots(
    before,
    await snapshotPlace(place, "effects self-test: place"),
  );
  expect(
    changes.map((change) => [change.path, change.change, change.detail]),
  ).toEqual([
    ["added", "created", "it is a plain file of 3 byte(s)"],
    ["file", "modified", expect.stringContaining("its bytes changed")],
  ]);
  expect(await snapshotPlace(path.join(place, "absent"), "absent")).toEqual(
    new Map(),
  );
});

test("the comparison of two snapshots, on vectors: an entry created, removed, or modified — its kind (a FIFO turned into a socket among them), a plain file's bytes, whether it reads, a directory's listing, a link's target — each reported in bytewise path order, the place itself as '.', a name that is no UTF-8 rendered by its bytes; nothing reported where nothing differs (TEST-SPEC T7.6-7(b))", () => {
  const file = (text: string | null): PlaceEntry => ({
    kind: "plain file",
    bytes: text === null ? null : Buffer.from(text, "utf8"),
  });
  const directory = (listed = true): PlaceEntry => ({
    kind: "directory",
    listed,
  });
  const link = (target: string): PlaceEntry => ({
    kind: "symbolic link",
    target: Buffer.from(target, "utf8"),
  });
  const notUtf8 = Buffer.from([0x6e, 0xff]).toString("latin1");
  const before = new Map<string, PlaceEntry>([
    ["", directory()],
    ["d", directory()],
    ["d/kept", file("same")],
    ["fifo", { kind: "FIFO" }],
    ["gone", file("was here")],
    ["link", link("a")],
    ["listing", directory()],
    ["readable", file("readable")],
    ["rewritten", file("old")],
    [notUtf8, file("n")],
  ]);
  const after = new Map<string, PlaceEntry>([
    ["", directory()],
    ["d", directory()],
    ["d/kept", file("same")],
    ["d/new", file("new")],
    ["fifo", { kind: "socket" }],
    ["link", link("b")],
    ["listing", directory(false)],
    ["readable", file(null)],
    ["rewritten", file("new")],
    [notUtf8, file("n")],
  ]);
  expect(comparePlaceSnapshots(before, before)).toEqual([]);
  const changes = comparePlaceSnapshots(before, after);
  expect(changes.map((change) => [change.path, change.change])).toEqual([
    ["d/new", "created"],
    ["fifo", "modified"],
    ["gone", "removed"],
    ["link", "modified"],
    ["listing", "modified"],
    ["readable", "modified"],
    ["rewritten", "modified"],
  ]);
  const detail = (at: string): string | undefined =>
    changes.find((change) => change.path === at)?.detail;
  expect(detail("fifo")).toBe("a FIFO became a socket");
  expect(detail("gone")).toBe("it was a plain file of 8 byte(s)");
  expect(detail("link")).toBe('its target changed from "a" to "b"');
  expect(detail("listing")).toBe("its listing is now refused");
  expect(detail("readable")).toBe("its bytes can no longer be read");
  expect(detail("rewritten")).toContain("its bytes changed");
  const rootless = new Map(after);
  rootless.delete("");
  rootless.set(notUtf8, file("N"));
  expect(
    comparePlaceSnapshots(after, rootless).map((change) => [
      change.path,
      change.change,
    ]),
  ).toEqual([
    [".", "removed"],
    ["<path bytes 6eff>", "modified"],
  ]);
});

/** Every one of T7.6-6's calls returning its argument. */
const ALL_RETURNED: readonly CallResult[] = CALL_CASES.map((name) => ({
  case: name,
  outcome: "returned-argument",
  returned: null,
  thrown: null,
}));

/** A vector's loaded run: a conforming one, observing its effects, unless overridden. */
function vectorRun(
  fields: {
    readonly results?: readonly CallResult[];
    readonly changes?: readonly StateChange[];
    readonly omitted?: number;
    readonly effects?: RunEffects | undefined;
  } = {},
): LoadedModuleRun {
  return {
    description: "vector run",
    route: "require",
    release: { version: "0.0.0", executable: "/releases/v0.0.0/bin/node" },
    placement: {
      name: "xspec-config",
      holdingDir: "/s/p",
      path: "/s/p/node_modules/xspec-config",
      form: "copy",
      copy: "/s/p/node_modules/xspec-config",
    },
    importingModule: "/s/p/importing-module-require.cjs",
    cwd: "/run/work",
    home: "/run/home",
    tmp: "/run/tmp",
    environment: { HOME: "/run/home", TMPDIR: "/run/tmp" },
    result: {
      exitCode: 0,
      signal: null,
      stdout: "",
      stderr: "",
      stdoutBytes: Buffer.alloc(0),
      stderrBytes: Buffer.alloc(0),
      commandLine: "vector",
    },
    outcome: "loaded",
    report: {
      argv: [],
      release: { version: "v0.0.0", execPath: "/node", execArgv: [] },
      pid: 7,
      environment: {},
      cwd: "/run/work",
      phase: "completed",
      importingModule: { topLevelThis: "object", location: "/s/p/i.cjs" },
      load: {
        outcome: "loaded",
        value: {
          type: "object",
          ownKeys: [{ kind: "string", name: "defineConfig", enumerable: true }],
        },
      },
      calls: {
        reading: { type: "function", thrown: null },
        results: fields.results ?? ALL_RETURNED,
        traps: [],
      },
      state: {
        subjects: [...REQUIRED_STATE_SUBJECTS],
        changes: fields.changes ?? [],
        omitted: fields.omitted ?? 0,
      },
      bootstrapError: null,
      warnings: [],
      exit: { code: 0 },
    },
    reportProblem: undefined,
    effects:
      "effects" in fields
        ? fields.effects
        : {
            writes: [
              { place: "staging", root: "/s", changes: [] },
              { place: "working directory", root: "/run/work", changes: [] },
              { place: "HOME", root: "/run/home", changes: [] },
              { place: "TMPDIR", root: "/run/tmp", changes: [] },
            ],
            fifos: [
              { path: "/run/work/xspec.config.ts", found: "FIFO" },
              { path: "/s/p/xspec.config.ts", found: "FIFO" },
              { path: "/run/home/xspec.config.ts", found: "FIFO" },
            ],
          },
  };
}

test("T7.6-7(b), (c), and (e)'s problem functions, on vectors: a conforming run reports nothing; each difference listed, each more counted, each place's change, and each FIFO no longer a FIFO in place — gone, or another kind — is a problem in words led by the run's description and citing its clause; each function reports the pairing first where defineConfig did not return its argument; and reading a run's effects that were never observed is a usage error (TEST-SPEC T7.6-7(b), (c), (e), §7.6 Pairing)", () => {
  const conforming = vectorRun();
  expect(stateProblems(conforming)).toEqual([]);
  expect(writeProblems(conforming)).toEqual([]);
  expect(fifoProblems(conforming)).toEqual([]);

  const state = stateProblems(
    vectorRun({
      changes: [
        {
          observation: "built-ins",
          subject: "Math",
          detail: 'an own property "x" was added',
        },
      ],
      omitted: 4,
    }),
  );
  expect(state).toHaveLength(2);
  expect(state[0]).toBe(
    "vector run: a global built-in object's own properties changed across " +
      'the load and the calls — Math: an own property "x" was added ' +
      "(TEST-SPEC T7.6-7(c); SPEC 7.6 Runtime: beyond the runtime's own " +
      "resolution of the specifier and loading of the package's files, " +
      "neither loading the module nor calling defineConfig has any effect — " +
      "no change to the global object or to any other state of the process)",
  );
  expect(state[1]).toContain("differs in 4 more way(s)");

  const written = writeProblems(
    vectorRun({
      effects: {
        writes: [
          {
            place: "staging",
            root: "/s",
            changes: [
              { path: "p/new", change: "created", detail: "it is a directory" },
            ],
          },
          {
            place: "HOME",
            root: "/run/home",
            changes: [
              {
                path: ".npmrc",
                change: "removed",
                detail: "it was a plain file of 1 byte(s)",
              },
            ],
          },
        ],
        fifos: [],
      },
    }),
  );
  expect(written).toEqual([
    'vector run: in the staging (/s), "p/new" was created: it is a ' +
      "directory (TEST-SPEC T7.6-7(b); SPEC 7.6 Runtime: beyond the " +
      "runtime's own resolution of the specifier and loading of the " +
      "package's files, neither loading the module nor calling defineConfig " +
      "has any effect — no filesystem write)",
    expect.stringContaining(
      `in the run's HOME (/run/home), ".npmrc" was removed`,
    ),
  ]);

  const fifos = fifoProblems(
    vectorRun({
      effects: {
        writes: [],
        fifos: [
          { path: "/run/work/xspec.config.ts", found: null },
          { path: "/s/p/xspec.config.ts", found: "plain file" },
          { path: "/run/home/xspec.config.ts", found: "FIFO" },
        ],
      },
    }),
  );
  expect(fifos).toHaveLength(2);
  expect(fifos[0]).toContain(
    "the FIFO /run/work/xspec.config.ts is gone, no longer a FIFO in place",
  );
  expect(fifos[1]).toContain(
    "the FIFO /s/p/xspec.config.ts is now a plain file",
  );
  expect(fifos[1]).toContain("TEST-SPEC T7.6-7(e), S-3");

  const copying = vectorRun({
    results: ALL_RETURNED.map((result) =>
      result.case === "object"
        ? {
            ...result,
            outcome: "returned-other",
            returned: { type: "object", text: null },
          }
        : result,
    ),
  });
  for (const problems of [
    stateProblems(copying),
    writeProblems(copying),
    fifoProblems(copying),
  ]) {
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("no absence counts in this run");
  }

  const unobserved = vectorRun({ effects: undefined });
  expect(() => writeProblems(unobserved)).toThrow("ModuleRunRequest.effects");
  expect(() => fifoProblems(unobserved)).toThrow("ModuleRunRequest.effects");
  expect(stateProblems(unobserved)).toEqual([]);
});
