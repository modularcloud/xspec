// S-10, the module channel's Node.js release driver (TEST-SPEC S-10, E-1,
// H-9, H-11; T7.6-6's run conditions, T7.6-7(a) and (c); the driver,
// helpers/module-channel-node.ts, its bootstrap,
// helpers/module-channel-bootstrap.cjs, and E-1's releases,
// helpers/node-releases.ts). 7.6's runtime arms (T7.6-6, T7.6-7, P-17) rest
// on a driver certification cannot check: every fixture's module answers
// alike on every release and route, so a driver serving one release or one
// route for all of them would pass conformer and violators alike and leave
// the arm on 22.0–22.11's `require` vacuous. So the driver is checked here
// directly, before any product exists, on each release E-1 provisions —
// XSPEC_NODE_RELEASES_DIR must name them, as CI's harness-self job and
// AGENTS.md's recipe do (unset, every test here fails as the harness error
// NodeReleaseError naming the variable, never a skip) — each stand-in placed
// at the canonical placement in a CommonJS project and run exactly as the
// tests run it (`runModuleRoute`, `prepareModuleRun`):
// - releases: each run's process reports the listed version, running the
//   provisioned executable's physical path with no option, and a run whose
//   provisioned executable is another release is refused as a harness error
//   naming both versions; a listed release left unprovisioned is a harness
//   error (NodeReleaseError) for every run needing it — the whole list's
//   resolution and its own — never a skip or a diagnosed failure, and so is
//   the releases' directory left unnamed;
// - run conditions: each run, on each release and along each route, carries
//   no option, an environment of exactly HOME, TMPDIR, and PATH — no
//   NODE_OPTIONS or NODE_PATH — and no user condition, loader, or hook, and
//   has a fresh HOME (and TMPDIR and working directory): its own, empty,
//   outside the staging, and removed afterwards. A stray NODE_OPTIONS —
//   carrying a user condition the dual stand-in's exports map answers and a
//   preloaded hook announcing itself through a process warning — and a
//   stray NODE_PATH, naming a folder that holds a decoy under N, each
//   answered by the release given it directly, stand in the harness's own
//   environment and reach no run;
// - routes: each importing module runs as its route's own kind, and the dual
//   stand-in, whose entries each report their own format when loaded,
//   answers the import routes from its ES-module entry and the require route
//   from its CommonJS one; the ES-module-only stand-in loads along each
//   import route on every release, and its require route fails, refused as
//   an ES module's load (ERR_REQUIRE_ESM), on each release before 22.12.0
//   and loads on each later one, each class holding at least one of E-1's
//   releases;
// - the runtime's own loading output: the two minimal stand-ins leave
//   T7.6-7(c)'s observed state unchanged along each route that loads them,
//   on each release, and their loading output there passes T7.6-7(a)'s
//   output oracle; so does the output of the stand-ins whose manifests draw
//   the release's own deprecations — an invalid main beside an index.js
//   along require (DEP0128), an ES-module package's main lookup along each
//   import route (DEP0151) — wherever the release prints one, their state
//   unchanged likewise. Which release prints which of its own warnings is
//   not pinned, nor is any warning's spelling: the minimal ES-module
//   stand-in and each deprecation stand-in must draw a warning on at least
//   one release, so that no admission is vacuous.
//
// The stand-ins, test/fixtures/s10-stand-ins/, documented here since JSON
// holds no comment: small hand-written, non-xspec packages, each exporting
// `defineConfig`, an identity function, and nothing else.
// - `dual`: no `type`; an `exports` map whose one entry lists, first, the
//   user condition `xspec-s10-user-condition` (`condition.cjs`), then
//   `import` (`index.mjs`) and `require` (`index.cjs`). Each of the three
//   files, when loaded, writes one line to standard output naming itself and
//   the kind of module it ran as, read from its own top-level `this`
//   (undefined in an ES module, `module.exports` in a CommonJS one):
//   `index.mjs: an ES module`, say.
// - `module-only`: `"type": "module"` and an `exports` string naming
//   `index.js`: the minimal ES-module stand-in, and the ES-module-only one.
// - `commonjs`: no `type`, its `main` naming `index.js`: the minimal
//   CommonJS stand-in.
// - `invalid-main`: `commonjs`'s layout, its `main` naming `./missing.js`,
//   which does not exist, beside `index.js` (DEP0128 along require).
// - `main-lookup`: `"type": "module"`, its `main` naming the directory
//   `./lib`, whose `index.js` an ES module's index lookup finds (DEP0151
//   along import).
// The strays — the preloaded hook, and the decoy under NODE_PATH, named N —
// and the stand-in executables of the releases tests are written at run
// time into fresh directories under the OS temporary directory, outside
// every staging.

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { ModuleStaging, runtimeArm } from "../helpers/module-channel.js";
import type { Placement } from "../helpers/module-channel.js";
import {
  assertModuleLoaded,
  exportsProblems,
  importingModuleKind,
  MODULE_ROUTES,
  moduleRunEnvironment,
  prepareModuleRun,
  runModuleRoute,
  runtimeOutputProblems,
  stateProblems,
} from "../helpers/module-channel-node.js";
import type {
  ImportingModuleNote,
  LoadedModuleRun,
  ModuleRoute,
  ModuleRunRequest,
  OwnKey,
} from "../helpers/module-channel-node.js";
import {
  NODE_RELEASES_DIR_VARIABLE,
  NodeReleaseError,
  readNodeReleaseList,
  resolveNodeRelease,
  resolveNodeReleases,
} from "../helpers/node-releases.js";
import type { NodeRelease } from "../helpers/node-releases.js";
import { runProduct } from "../helpers/subprocess.js";
import type { ProductBinding, RunResult } from "../helpers/subprocess.js";

const LF = String.fromCodePoint(0x0a);

/** The committed stand-ins (module header), by their directories' names. */
type StandIn =
  "dual" | "module-only" | "commonjs" | "invalid-main" | "main-lookup";

/** A committed stand-in's package directory. */
function standInDirectory(standIn: StandIn): string {
  return fileURLToPath(
    new URL(`../fixtures/s10-stand-ins/${standIn}`, import.meta.url),
  );
}

/** The user condition the dual stand-in's exports map lists first. */
const USER_CONDITION = "xspec-s10-user-condition";

/** The line each of the dual stand-in's entries writes when loaded. */
const ENTRY_LINES = {
  module: `index.mjs: an ES module${LF}`,
  commonJs: `index.cjs: a CommonJS module${LF}`,
  condition: `condition.cjs: a CommonJS module${LF}`,
} as const;

/** The line the decoy under the stray NODE_PATH writes when loaded. */
const DECOY_LINE = `NODE_PATH decoy${LF}`;

/** The code of the warning the stray hook emits wherever it runs. */
const STRAY_HOOK_CODE = "XSPEC_S10_STRAY_HOOK";

/**
 * The first release on which `require` loads an ES module without a flag
 * (TEST-SPEC E-1: 22.11.0 the last on which it cannot).
 */
const REQUIRE_MODULE_RELEASE = "22.12.0";

/** The import routes: each but `require`. */
const IMPORT_ROUTES: readonly ModuleRoute[] = MODULE_ROUTES.filter(
  (route) => route !== "require",
);

/** A loaded value's own `defineConfig` key, as the report lists it. */
const DEFINE_CONFIG_KEY: OwnKey = {
  kind: "string",
  name: "defineConfig",
  enumerable: true,
};

/** A module namespace's own `Symbol.toStringTag` key, likewise. */
const TO_STRING_TAG_KEY: OwnKey = {
  kind: "symbol",
  name: "Symbol.toStringTag",
  enumerable: false,
};

/** A module's text, from its lines. */
function lines(...text: string[]): string {
  return `${text.join(LF)}${LF}`;
}

/** A fresh, empty directory of this test's own, removed once it ends. */
async function freshDirectory(prefix: string): Promise<string> {
  const directory = await fsp.realpath(
    await fsp.mkdtemp(path.join(os.tmpdir(), prefix)),
  );
  onTestFinished(() => fsp.rm(directory, { recursive: true, force: true }));
  return directory;
}

/**
 * A binding of the certification fixtures' shape beside `packageDir`: its
 * executable is never run here.
 */
function standInBinding(packageDir: string): ProductBinding {
  return {
    label: "S-10 release-driver stand-in binding",
    command: process.execPath,
    requiredFiles: [process.execPath],
    packageDir,
  };
}

/** A stand-in staged at the canonical placement in a CommonJS project. */
interface StagedStandIn {
  readonly staging: ModuleStaging;
  readonly placement: Placement;
}

/**
 * Stage the committed stand-in `standIn` at the canonical placement in a
 * CommonJS project, for runs on `releases`; disposed of once the test ends.
 */
async function stageStandIn(
  standIn: StandIn,
  releases: readonly NodeRelease[],
  context: string,
): Promise<StagedStandIn> {
  const staging = await ModuleStaging.create(
    standInBinding(standInDirectory(standIn)),
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

/** One run's request over `staged`, the project declared and alone. */
function request(
  staged: StagedStandIn,
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
    context,
  };
}

/** One loaded run of a stand-in the harness expects to load. */
async function loadedRun(
  staged: StagedStandIn,
  release: NodeRelease,
  route: ModuleRoute,
  context: string,
): Promise<LoadedModuleRun> {
  return assertModuleLoaded(
    await runModuleRoute(request(staged, release, route, context)),
    "stand-in",
  );
}

/** Whether the exact version `version` precedes the exact version `other`. */
function precedes(version: string, other: string): boolean {
  const left = version.split(".").map(Number);
  const right = other.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const mine = left[index] ?? 0;
    const theirs = right[index] ?? 0;
    if (mine !== theirs) return mine < theirs;
  }
  return false;
}

/**
 * The note `route`'s importing module, at the physical path
 * `importingModule`, gives of its own kind and location: its top-level
 * `this` undefined and its location its file URL in an ES module, an object
 * and its path in a CommonJS one.
 */
function kindNote(
  route: ModuleRoute,
  importingModule: string,
): ImportingModuleNote {
  return importingModuleKind(route) === "module"
    ? {
        topLevelThis: "undefined",
        location: pathToFileURL(importingModule).href,
      }
    : { topLevelThis: "object", location: importingModule };
}

/** Whether `inner` is `outer` or lies under it. */
function within(inner: string, outer: string): boolean {
  return inner === outer || inner.startsWith(`${outer}${path.sep}`);
}

async function exists(entry: string): Promise<boolean> {
  return fsp.lstat(entry).then(
    () => true,
    () => false,
  );
}

/** What `work` rejects with, which it must. */
async function rejectionOf(work: () => Promise<unknown>): Promise<unknown> {
  return work().then(
    () => {
      throw new Error("expected a rejection, and the work resolved");
    },
    (error: unknown) => error,
  );
}

/** A shell script running `commands`. */
function shellScript(...commands: string[]): string {
  return `#!/bin/sh${LF}${commands.join(LF)}${LF}`;
}

/** `text` single-quoted for the shell; it may hold no single quote. */
function shellQuoted(text: string): string {
  if (text.includes("'")) {
    throw new Error(
      `S-10 self-test: ${JSON.stringify(text)} holds a single quote, which ` +
        `this file's shell scripts do not quote`,
    );
  }
  return `'${text}'`;
}

/** Write `text` at `file`, a new file every user may execute, its parents made. */
async function writeExecutable(file: string, text: string): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, text, { flag: "wx" });
  await fsp.chmod(file, 0o755);
}

/** The strays (module header), written for the placement name N. */
interface Strays {
  /** NODE_OPTIONS and NODE_PATH, as they stand in the harness's environment. */
  readonly environment: Readonly<Record<string, string>>;
  /** A fresh, empty directory outside every staging, no node_modules above it. */
  readonly outside: string;
}

/**
 * Write the strays for N `name` into a fresh directory: the preloaded hook,
 * emitting a process warning of code {@link STRAY_HOOK_CODE}; and the decoy
 * under NODE_PATH, a CommonJS package at `<folder>/N` writing
 * {@link DECOY_LINE} when loaded.
 */
async function writeStrays(name: string): Promise<Strays> {
  const directory = await freshDirectory("xspec-s10-strays-");
  const hook = path.join(directory, "hook.cjs");
  await fsp.writeFile(
    hook,
    lines(
      'process.emitWarning("xspec S-10: a stray preloaded hook ran", {',
      '  type: "XspecS10StrayHook",',
      `  code: ${JSON.stringify(STRAY_HOOK_CODE)},`,
      "});",
    ),
    { flag: "wx" },
  );
  const folder = path.join(directory, "node-path");
  const decoy = path.join(folder, ...name.split("/"));
  await fsp.mkdir(decoy, { recursive: true });
  await fsp.writeFile(
    path.join(decoy, "package.json"),
    `${JSON.stringify({ name: "s10-node-path-decoy", version: "1.0.0", main: "./index.js" }, null, 2)}${LF}`,
    { flag: "wx" },
  );
  await fsp.writeFile(
    path.join(decoy, "index.js"),
    lines(
      'process.stdout.write("NODE_PATH decoy" + String.fromCharCode(10));',
      "exports.defineConfig = function defineConfig(settings) {",
      "  return settings;",
      "};",
    ),
    { flag: "wx" },
  );
  const outside = path.join(directory, "outside");
  await fsp.mkdir(outside);
  return {
    environment: {
      NODE_OPTIONS: `--conditions=${USER_CONDITION} --require=${JSON.stringify(hook)}`,
      NODE_PATH: folder,
    },
    outside,
  };
}

/**
 * Run `release` directly, outside the driver, from `cwd` under the
 * harness's environment with `environment` set over it, requiring `name`.
 */
async function requireDirectly(
  release: NodeRelease,
  cwd: string,
  environment: Readonly<Record<string, string>>,
  name: string,
): Promise<RunResult> {
  return runProduct(
    {
      label: `the Node.js release ${release.version}, given the strays directly`,
      command: release.executable,
      requiredFiles: [release.executable],
    },
    {
      cwd,
      argv: ["--eval", `require(${JSON.stringify(name)});`],
      env: { ...environment },
    },
  );
}

/**
 * Run `work` with `values` standing in the harness's own environment,
 * restoring each variable afterwards.
 */
async function withAmbient(
  values: Readonly<Record<string, string>>,
  work: () => Promise<void>,
): Promise<void> {
  const saved = Object.keys(values).map(
    (name): [string, string | undefined] => [name, process.env[name]],
  );
  Object.assign(process.env, values);
  try {
    await work();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

test("S-10, releases: on each of E-1's releases, the release in effect is the one provisioned — each run's process reports the listed version, running the provisioned executable's physical path with no option — and a run whose provisioned executable is another release is refused as a harness error naming both versions; a listed release left unprovisioned is a harness error (NodeReleaseError) for every run needing it, the whole list's resolution and its own, each provisioned release still resolving, and so is the releases' directory left unnamed — never a skip or a diagnosed failure (TEST-SPEC S-10, E-1, H-11, H-9)", async () => {
  const releases = await resolveNodeReleases();
  const listed = await readNodeReleaseList();
  expect(releases.map((release) => release.version)).toEqual([...listed]);
  const staged = await stageStandIn(
    "commonjs",
    releases,
    "S-10 releases: commonjs",
  );
  for (const release of releases) {
    const context = `S-10 releases: commonjs, ${release.version}`;
    const run = await loadedRun(staged, release, "require", context);
    expect(run.report.release, context).toEqual({
      version: `v${release.version}`,
      execPath: await fsp.realpath(release.executable),
      execArgv: [],
    });
  }

  // A release provisioned under another's name: the first listed release's
  // executable runs the last's.
  const first = releases[0];
  const other = releases[releases.length - 1];
  if (first === undefined || other === undefined || first === other) {
    throw new Error("S-10 self-test: E-1 lists fewer than two releases");
  }
  const impostors = await freshDirectory("xspec-s10-impostor-releases-");
  const impostorPath = path.join(impostors, `v${first.version}`, "bin", "node");
  await writeExecutable(
    impostorPath,
    shellScript(`exec ${shellQuoted(other.executable)} "$@"`),
  );
  const impostor = await resolveNodeRelease(first.version, {
    environment: { [NODE_RELEASES_DIR_VARIABLE]: impostors },
  });
  expect(impostor).toEqual({
    version: first.version,
    executable: impostorPath,
  });
  const refused = await rejectionOf(() =>
    runModuleRoute(
      request(staged, impostor, "require", "S-10 releases: impostor"),
    ),
  );
  expect(refused).toBeInstanceOf(Error);
  expect(refused).not.toBeInstanceOf(HarnessAssertionError);
  const message = (refused as Error).message;
  expect(message.startsWith("harness error (H-11): ")).toBe(true);
  expect(message).toContain(
    `the release in effect reports v${other.version}, not v${first.version}`,
  );

  // A listed release left unprovisioned.
  const partial = await freshDirectory("xspec-s10-partial-releases-");
  const missing = listed[Math.floor(listed.length / 2)];
  if (missing === undefined) throw new Error("E-1 lists no release");
  const executableIn = (version: string): string =>
    path.join(partial, `v${version}`, "bin", "node");
  const provisioned = listed.filter((version) => version !== missing);
  for (const version of provisioned) {
    await writeExecutable(executableIn(version), shellScript("exit 0"));
  }
  const lookup = { environment: { [NODE_RELEASES_DIR_VARIABLE]: partial } };
  for (const resolve of [
    () => resolveNodeReleases(lookup),
    () => resolveNodeRelease(missing, lookup),
  ]) {
    const error = await rejectionOf(resolve);
    expect(error).toBeInstanceOf(NodeReleaseError);
    expect(error).not.toBeInstanceOf(HarnessAssertionError);
    expect((error as NodeReleaseError).fault).toBe("release");
    expect((error as NodeReleaseError).releases).toEqual([missing]);
    expect((error as Error).message).toContain(executableIn(missing));
  }
  for (const version of provisioned) {
    expect(await resolveNodeRelease(version, lookup)).toEqual({
      version,
      executable: executableIn(version),
    });
  }
  const unnamed = await rejectionOf(() =>
    resolveNodeReleases({ environment: {} }),
  );
  expect(unnamed).toBeInstanceOf(NodeReleaseError);
  expect(unnamed).not.toBeInstanceOf(HarnessAssertionError);
  expect((unnamed as NodeReleaseError).fault).toBe("directory");
  expect((unnamed as Error).message).toContain(
    `${NODE_RELEASES_DIR_VARIABLE} is unset`,
  );
});

test("S-10, run conditions: on each of E-1's releases and along each of Node.js's four routes, each run carries no option, an environment of exactly HOME, TMPDIR, and PATH — no NODE_OPTIONS or NODE_PATH — and no user condition, loader, or hook, and has a fresh HOME, TMPDIR, and working directory, each its own, empty, outside the staging, and removed afterwards: a stray NODE_OPTIONS carrying a user condition the dual stand-in's exports map answers and a preloaded hook announcing itself through a process warning, and a stray NODE_PATH naming a folder that holds a decoy under N — each answered by the release given it directly — stand in the harness's own environment and reach no run, which loads the dual stand-in's conditionless entry for its route, with no warning and nothing on standard error (TEST-SPEC S-10, T7.6-6's run conditions, T7.6-7)", async () => {
  const releases = await resolveNodeReleases();
  const staged = await stageStandIn(
    "dual",
    releases,
    "S-10 run conditions: dual",
  );
  const name = staged.placement.name;
  const strays = await writeStrays(name);
  // The vectors are live: each release given the strays directly answers
  // the user condition, runs the hook, and finds the decoy through
  // NODE_PATH where no node_modules holds N.
  for (const release of releases) {
    const context = `S-10 run conditions: the strays given to ${release.version} directly`;
    const answered = await requireDirectly(
      release,
      staged.placement.holdingDir,
      strays.environment,
      name,
    );
    expect(answered.stdout, context).toBe(ENTRY_LINES.condition);
    expect(answered.stderr, context).toContain(STRAY_HOOK_CODE);
    const decoy = await requireDirectly(
      release,
      strays.outside,
      strays.environment,
      name,
    );
    expect(decoy.stdout, context).toBe(DECOY_LINE);
  }
  const places = new Set<string>();
  await withAmbient(strays.environment, async () => {
    for (const release of releases) {
      for (const route of MODULE_ROUTES) {
        const context = `S-10 run conditions: dual, ${release.version}, ${route}`;
        const prepared = await prepareModuleRun(
          request(staged, release, route, context),
        );
        let run: LoadedModuleRun;
        try {
          for (const place of [prepared.home, prepared.tmp, prepared.cwd]) {
            expect(await fsp.readdir(place), context).toEqual([]);
            expect(within(place, staged.staging.root), context).toBe(false);
            expect(places.has(place), context).toBe(false);
            places.add(place);
          }
          run = assertModuleLoaded(await prepared.launch(), "stand-in");
        } finally {
          await prepared.dispose();
        }
        expect(await exists(prepared.root), context).toBe(false);
        const { report } = run;
        expect(report.release.execArgv, context).toEqual([]);
        expect(report.environment, context).toEqual(
          moduleRunEnvironment(prepared.home, prepared.tmp),
        );
        for (const variable of ["NODE_OPTIONS", "NODE_PATH"]) {
          expect(report.environment[variable], context).toBeUndefined();
        }
        expect(report.environment["HOME"], context).toBe(prepared.home);
        expect(report.cwd, context).toBe(prepared.cwd);
        expect(run.result.stdout, context).toBe(
          route === "require" ? ENTRY_LINES.commonJs : ENTRY_LINES.module,
        );
        expect(report.warnings, context).toEqual([]);
        expect(run.result.stderr, context).toBe("");
      }
    }
  });
  expect(places.size).toBe(releases.length * MODULE_ROUTES.length * 3);
});

test("S-10, routes: on each of E-1's releases, each of Node.js's four routes is the one exercised — the importing module runs as its route's own kind from its physical path, an ES module for static import and dynamic import from a module, a CommonJS module for dynamic import from CommonJS and require — and the dual stand-in, whose entries each report their own format when loaded, answers the import routes from its ES-module entry, a namespace of exactly defineConfig, and the require route from its CommonJS one, an object of exactly defineConfig; the ES-module-only stand-in loads along each import route on every release, and its require route fails, refused as an ES module's load (ERR_REQUIRE_ESM), on each release before 22.12.0 and loads on each later one, each class holding at least one of E-1's releases (TEST-SPEC S-10, T7.6-6, E-1)", async () => {
  const releases = await resolveNodeReleases();
  const dual = await stageStandIn("dual", releases, "S-10 routes: dual");
  const moduleOnly = await stageStandIn(
    "module-only",
    releases,
    "S-10 routes: ES-module only",
  );
  const refusedOn: string[] = [];
  const loadedOn: string[] = [];
  for (const release of releases) {
    for (const route of MODULE_ROUTES) {
      const context = `S-10 routes: dual, ${release.version}, ${route}`;
      const run = await loadedRun(dual, release, route, context);
      expect(run.report.release.version, context).toBe(`v${release.version}`);
      expect(run.report.importingModule, context).toEqual(
        kindNote(route, run.importingModule),
      );
      expect(run.result.stdout, context).toBe(
        route === "require" ? ENTRY_LINES.commonJs : ENTRY_LINES.module,
      );
      expect(run.report.load.value, context).toEqual({
        type: "object",
        ownKeys:
          route === "require"
            ? [DEFINE_CONFIG_KEY]
            : [DEFINE_CONFIG_KEY, TO_STRING_TAG_KEY],
      });
      expect(exportsProblems(run), context).toEqual([]);
      expect(run.result.stderr, context).toBe("");
    }
    for (const route of IMPORT_ROUTES) {
      const context = `S-10 routes: ES-module only, ${release.version}, ${route}`;
      const run = await loadedRun(moduleOnly, release, route, context);
      expect(run.report.importingModule, context).toEqual(
        kindNote(route, run.importingModule),
      );
      expect(run.report.load.value, context).toEqual({
        type: "object",
        ownKeys: [DEFINE_CONFIG_KEY, TO_STRING_TAG_KEY],
      });
    }
    const context = `S-10 routes: ES-module only, ${release.version}, require`;
    const run = await runModuleRoute(
      request(moduleOnly, release, "require", context),
    );
    if (precedes(release.version, REQUIRE_MODULE_RELEASE)) {
      refusedOn.push(release.version);
      expect(run.outcome, context).toBe("load-failed");
      const load = run.report?.load;
      expect(load?.outcome === "failed" ? load.error.code : null, context).toBe(
        "ERR_REQUIRE_ESM",
      );
    } else {
      loadedOn.push(release.version);
      const loaded = assertModuleLoaded(run, "stand-in");
      expect(loaded.report.importingModule, context).toEqual(
        kindNote("require", loaded.importingModule),
      );
      expect(exportsProblems(loaded), context).toEqual([]);
    }
  }
  expect(refusedOn.length).toBeGreaterThan(0);
  expect(loadedOn.length).toBeGreaterThan(0);
});

test("S-10, the runtime's own loading output: on each of E-1's releases, the two minimal stand-ins — one with an ES-module entry, one with a CommonJS entry — leave T7.6-7(c)'s observed state unchanged along each route that loads them, and their loading output there passes T7.6-7(a)'s output oracle, the warning a release prints for the ES-module entry's load through require admitted; and so does the loading output of the stand-ins whose manifests draw the release's own deprecations — an invalid main beside an index.js along require (DEP0128) and an ES-module package's main lookup along each import route (DEP0151) — wherever the release prints one, their state unchanged likewise, the minimal ES-module stand-in and each deprecation stand-in drawing a warning on at least one release, so the oracle admits the runtime's own loading output (TEST-SPEC S-10, T7.6-7(a), (c))", async () => {
  const releases = await resolveNodeReleases();
  const families: readonly {
    readonly standIn: StandIn;
    readonly routes: readonly ModuleRoute[];
    /** Whether it must draw a warning of the release's own on some release. */
    readonly draws: boolean;
  }[] = [
    { standIn: "module-only", routes: MODULE_ROUTES, draws: true },
    { standIn: "commonjs", routes: MODULE_ROUTES, draws: false },
    { standIn: "invalid-main", routes: ["require"], draws: true },
    { standIn: "main-lookup", routes: IMPORT_ROUTES, draws: true },
  ];
  const staged = new Map<StandIn, StagedStandIn>();
  for (const family of families) {
    staged.set(
      family.standIn,
      await stageStandIn(
        family.standIn,
        releases,
        `S-10 own output: ${family.standIn}`,
      ),
    );
  }
  const drawn = new Map<StandIn, number>();
  for (const release of releases) {
    for (const family of families) {
      const placed = staged.get(family.standIn);
      if (placed === undefined) throw new Error("a family went unstaged");
      for (const route of family.routes) {
        const context = `S-10 own output: ${family.standIn}, ${release.version}, ${route}`;
        const run = await runModuleRoute(
          request(placed, release, route, context),
        );
        if (
          family.standIn === "module-only" &&
          route === "require" &&
          precedes(release.version, REQUIRE_MODULE_RELEASE)
        ) {
          // Refused on these releases, as the routes test pins.
          expect(run.outcome, context).toBe("load-failed");
          continue;
        }
        const loaded = assertModuleLoaded(run, "stand-in");
        expect(loaded.report.state.changes, context).toEqual([]);
        expect(loaded.report.state.omitted, context).toBe(0);
        expect(stateProblems(loaded), context).toEqual([]);
        expect(await runtimeOutputProblems(loaded), context).toEqual([]);
        if (loaded.report.warnings.length > 0) {
          drawn.set(family.standIn, (drawn.get(family.standIn) ?? 0) + 1);
        }
      }
    }
  }
  for (const family of families) {
    if (family.draws) {
      expect(drawn.get(family.standIn) ?? 0, family.standIn).toBeGreaterThan(0);
    }
  }
});
