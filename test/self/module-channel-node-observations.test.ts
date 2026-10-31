// Self-checks for the module channel's runtime observations (TEST-SPEC 17
// preamble: internal self-tests cover harness machinery certification does
// not exercise; T7.6-6, T7.6-7(a), §7.6 Pairing, H-2, H-3, S-3, E-1;
// helpers/module-channel-node.ts, its bootstrap
// helpers/module-channel-bootstrap.cjs, and its warning calibration
// helpers/module-channel-warning-calibration.cjs). T7.6-6 and T7.6-7, 7.6's
// runtime tests registered so far (test/suite/registry/section-7.6-ii.ts),
// read these observations — T7.6-6 its own, T7.6-7 the output oracle — and
// they and S-10's checks — each observation catching the effect it exists
// for on each release and route — build on these; here the observations'
// plumbing is pinned before any product exists, on each of E-1's releases,
// so XSPEC_NODE_RELEASES_DIR must name them, as CI's harness-self job and
// AGENTS.md's recipe do (unset, every test here that runs a release fails
// as the harness error NodeReleaseError, never a skip):
// - a conforming dual stand-in, along each route on each release: the
//   route's own-key listing exactly defineConfig, every one of T7.6-6's
//   calls returning its argument by SameValue, no trap of either Proxy
//   invoked, the frozen object returned without a throw, both streams
//   empty, and the output oracle passing, the pairing met;
// - the printed form learned from each release, once per release: the
//   form renders, byte for byte, the standard error of stand-ins emitting a
//   warning of their own while loading — a CommonJS one along require, an
//   ES-module one along static import — and the oracle finds each warning's
//   stack beginning in the package's files, by path and by file URL;
// - conforming stand-ins whose manifests draw the runtime's own warnings
//   pass the oracle: DEP0128 along require (an invalid main beside
//   index.js), DEP0151 along each import route (an ES-module package's main
//   lookup), and an ES-module-only package along require on each release
//   that loads it, the experimental warning on one that prints it;
// - end to end on one release, each observation reports the deviation it
//   exists for — a CommonJS-only entry's namespace carrying default, an
//   enumerable __esModule, -0 returned as 0, arguments copied, a Proxy's
//   trap touched, a frozen object refused, a defineConfig that is no
//   function, a process ending inside a call — as problems in words, never
//   a throw (S-10's catches of each effect on every release and route are
//   its own);
// - the pure functions on vectors: the rendering, the first frame, the
//   package frame, and each problem function, each conforming vector clean
//   and each deviating one caught.
//
// The stand-in packages are small hand-written, non-xspec packages, written
// at run time into fresh directories under the OS temporary directory from
// the texts below (STAND_INS), so the committed tree holds no package of
// this file's own.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, onTestFinished, test } from "vitest";
import { ModuleStaging, runtimeArm } from "../helpers/module-channel.js";
import type { Placement } from "../helpers/module-channel.js";
import {
  assertModuleLoaded,
  CALL_CASES,
  examinationProblems,
  exportsProblems,
  identityProblems,
  learnWarningForm,
  MODULE_ROUTES,
  moduleRunProblem,
  outputProblems,
  packageFrame,
  pairingProblem,
  renderWarnings,
  runModuleRoute,
  runtimeOutputProblems,
  warningFirstFrame,
} from "../helpers/module-channel-node.js";
import type {
  CallResult,
  CapturedWarning,
  DefineConfigReading,
  LoadedModuleRun,
  ModuleRoute,
  ModuleRunRequest,
  OwnKey,
  TrapInvocation,
  WarningForm,
} from "../helpers/module-channel-node.js";
import { resolveNodeReleases } from "../helpers/node-releases.js";
import type { NodeRelease } from "../helpers/node-releases.js";
import type { ProductBinding } from "../helpers/subprocess.js";

const LF = String.fromCodePoint(0x0a);

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

/** Every one of T7.6-6's calls returning its argument. */
const ALL_RETURNED: readonly CallResult[] = CALL_CASES.map((name) => ({
  case: name,
  outcome: "returned-argument",
  returned: null,
  thrown: null,
}));

/** The import routes: each but `require`. */
const IMPORT_ROUTES: readonly ModuleRoute[] = MODULE_ROUTES.filter(
  (route) => route !== "require",
);

/** A manifest's text. */
function manifest(members: Record<string, unknown>): string {
  return `${JSON.stringify(members, null, 2)}${LF}`;
}

/** A module's text, from its lines. */
function lines(...text: string[]): string {
  return `${text.join(LF)}${LF}`;
}

/** An ES module's `defineConfig`, an identity function. */
const MODULE_DEFINE_CONFIG = [
  "export function defineConfig(settings) {",
  "  return settings;",
  "}",
];

/** A CommonJS module's `defineConfig`, an identity function. */
const COMMONJS_DEFINE_CONFIG = [
  "exports.defineConfig = function defineConfig(settings) {",
  "  return settings;",
  "};",
];

/** A CommonJS package named `name` with one entry, `index.js`, of `body`. */
function commonJsStandIn(
  name: string,
  body: readonly string[],
): Record<string, string> {
  return {
    "package.json": manifest({ name, version: "1.0.0", main: "./index.js" }),
    "index.js": lines(...body),
  };
}

/** A CommonJS package whose `defineConfig` runs `body` on `settings`. */
function commonJsDefineConfig(
  name: string,
  body: readonly string[],
): Record<string, string> {
  return commonJsStandIn(name, [
    "exports.defineConfig = function defineConfig(settings) {",
    ...body,
    "};",
  ]);
}

/**
 * The stand-in packages (module header), each a map from a file's
 * package-relative path to its text.
 */
const STAND_INS = {
  /** Conforming: an ES-module entry for import, a CommonJS one for require. */
  dual: {
    "package.json": manifest({
      name: "observation-dual-standin",
      version: "1.0.0",
      type: "module",
      main: "./index.cjs",
      exports: { ".": { import: "./index.js", require: "./index.cjs" } },
    }),
    "index.js": lines(...MODULE_DEFINE_CONFIG),
    "index.cjs": lines(...COMMONJS_DEFINE_CONFIG),
  },
  /** Emits a warning of its own while loading, from a CommonJS module. */
  commonJsWarning: commonJsStandIn("observation-commonjs-warning-standin", [
    'process.emitWarning("xspec observation self-test warning", {',
    '  type: "XspecSelfTestWarning",',
    '  code: "XSPEC_SELF_TEST",',
    '  detail: "its detail",',
    "});",
    ...COMMONJS_DEFINE_CONFIG,
  ]),
  /** Emits a warning of its own while loading, from an ES module. */
  moduleWarning: {
    "package.json": manifest({
      name: "observation-module-warning-standin",
      version: "1.0.0",
      type: "module",
      exports: "./index.js",
    }),
    "index.js": lines(
      'process.emitWarning("xspec observation self-test warning", {',
      '  type: "XspecSelfTestWarning",',
      '  code: "XSPEC_SELF_TEST",',
      "});",
      ...MODULE_DEFINE_CONFIG,
    ),
  },
  /** Conforming, its `main` invalid beside an `index.js` (DEP0128). */
  invalidMain: {
    "package.json": manifest({
      name: "observation-invalid-main-standin",
      version: "1.0.0",
      main: "./missing.js",
    }),
    "index.js": lines(...COMMONJS_DEFINE_CONFIG),
  },
  /** Conforming, an ES-module package whose `main` needs a lookup (DEP0151). */
  mainLookup: {
    "package.json": manifest({
      name: "observation-main-lookup-standin",
      version: "1.0.0",
      type: "module",
      main: "./lib",
    }),
    "lib/index.js": lines(...MODULE_DEFINE_CONFIG),
  },
  /** Conforming, serving only an ES-module entry. */
  moduleOnly: {
    "package.json": manifest({
      name: "observation-module-only-standin",
      version: "1.0.0",
      type: "module",
      exports: "./index.js",
    }),
    "index.js": lines(...MODULE_DEFINE_CONFIG),
  },
  /** A CommonJS-only entry, whose import namespace carries `default`. */
  commonJsOnly: commonJsStandIn(
    "observation-commonjs-only-standin",
    COMMONJS_DEFINE_CONFIG,
  ),
  /** An enumerable `__esModule` beside `defineConfig`. */
  enumerableEsModule: commonJsStandIn("observation-esmodule-standin", [
    "exports.__esModule = true;",
    ...COMMONJS_DEFINE_CONFIG,
  ]),
  /** Returns 0 for -0. */
  negativeZero: commonJsDefineConfig("observation-negative-zero-standin", [
    "  return Object.is(settings, -0) ? 0 : settings;",
  ]),
  /** Returns a copy of an object or array argument. */
  copying: commonJsDefineConfig("observation-copying-standin", [
    '  return settings !== null && typeof settings === "object"',
    "    ? { ...settings }",
    "    : settings;",
  ]),
  /** Lists a function argument's own keys before returning it. */
  examining: commonJsDefineConfig("observation-examining-standin", [
    '  if (typeof settings === "function") Object.keys(settings);',
    "  return settings;",
  ]),
  /** Throws on a frozen object argument. */
  frozenRefusing: commonJsDefineConfig("observation-frozen-refusing-standin", [
    '  if (settings !== null && typeof settings === "object" && Object.isFrozen(settings)) {',
    '    throw new TypeError("xspec self-test: a frozen configuration");',
    "  }",
    "  return settings;",
  ]),
  /** Exports a `defineConfig` that is no function. */
  notAFunction: commonJsStandIn("observation-not-a-function-standin", [
    "exports.defineConfig = 42;",
  ]),
  /** Exits the process when called with a boolean. */
  exitingInCall: commonJsDefineConfig("observation-exiting-standin", [
    '  if (typeof settings === "boolean") process.exit(0);',
    "  return settings;",
  ]),
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
  const directory = await freshDirectory("xspec-observation-standin-");
  for (const [name, text] of Object.entries(files)) {
    const target = path.join(directory, ...name.split("/"));
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, text, { flag: "wx" });
  }
  return directory;
}

/**
 * A binding of the certification fixtures' shape beside `packageDir`: its
 * executable is never run here.
 */
function standInBinding(packageDir: string): ProductBinding {
  return {
    label: "module-channel observation stand-in binding",
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

/** One run's request over `staged`, the project declared and alone. */
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
    context,
  };
}

/** One loaded run of a stand-in the harness expects to load. */
async function loadedRun(
  staged: StagedPackage,
  release: NodeRelease,
  route: ModuleRoute,
  context: string,
): Promise<LoadedModuleRun> {
  return assertModuleLoaded(
    await runModuleRoute(request(staged, release, route, context)),
    "stand-in",
  );
}

/** The first of E-1's releases, for the checks one release serves. */
async function firstRelease(): Promise<NodeRelease> {
  const [release] = await resolveNodeReleases();
  if (release === undefined) throw new Error("E-1 lists no release");
  return release;
}

test("a conforming dual stand-in, along each of Node.js's four routes on each of E-1's releases: the route's own-key listing is exactly defineConfig (an import namespace's string keys, a require result's enumerable keys), defineConfig is read once as a function and every one of T7.6-6's calls returns its argument by SameValue — each identity value, no argument, a further argument, the two recording Proxies, the frozen object — with no trap of either Proxy invoked; both streams are empty and the output oracle passes, the pairing met (TEST-SPEC T7.6-6, T7.6-7(a), §7.6 Pairing)", async () => {
  const releases = await resolveNodeReleases();
  const staged = await stageStandIn(
    STAND_INS.dual,
    releases,
    "observation self-test: dual",
  );
  for (const release of releases) {
    const form = await learnWarningForm(release);
    for (const route of MODULE_ROUTES) {
      const context = `observation self-test: dual, ${release.version}, ${route}`;
      const run = await loadedRun(staged, release, route, context);
      const { calls, load, warnings } = run.report;
      expect(load.value, context).toEqual({
        type: "object",
        ownKeys:
          route === "require"
            ? [DEFINE_CONFIG_KEY]
            : [DEFINE_CONFIG_KEY, TO_STRING_TAG_KEY],
      });
      expect(calls.reading, context).toEqual({
        type: "function",
        thrown: null,
      });
      expect(calls.results, context).toEqual(ALL_RETURNED);
      expect(calls.traps, context).toEqual([]);
      expect(exportsProblems(run), context).toEqual([]);
      expect(identityProblems(run), context).toEqual([]);
      expect(examinationProblems(run), context).toEqual([]);
      expect(pairingProblem(run), context).toBeNull();
      expect(run.result.stdout, context).toBe("");
      expect(run.result.stderr, context).toBe("");
      expect(warnings, context).toEqual([]);
      expect(outputProblems(run, form), context).toEqual([]);
    }
  }
});

test("the output oracle's printed form is learned from each of E-1's releases, once per release in a process: it renders, byte for byte, the standard error of a stand-in emitting a warning of its own while loading — a CommonJS one along require, carrying a code and a detail, and an ES-module one along static import, carrying a code alone — and the oracle finds each such warning's stack beginning in the package's files, its first frame naming the package's entry by path and by file URL, the pairing met and nothing else amiss (TEST-SPEC T7.6-7(a))", async () => {
  const releases = await resolveNodeReleases();
  const vectors = [
    {
      staged: await stageStandIn(
        STAND_INS.commonJsWarning,
        releases,
        "observation self-test: CommonJS warning",
      ),
      route: "require",
      entry: (placement: Placement): string =>
        path.join(placement.path, "index.js"),
    },
    {
      staged: await stageStandIn(
        STAND_INS.moduleWarning,
        releases,
        "observation self-test: ES-module warning",
      ),
      route: "static-import",
      entry: (placement: Placement): string =>
        pathToFileURL(path.join(placement.path, "index.js")).href,
    },
  ] as const;
  for (const release of releases) {
    const form = await learnWarningForm(release);
    expect(learnWarningForm(release), release.version).toBe(
      learnWarningForm(release),
    );
    expect(form.version, release.version).toBe(release.version);
    for (const hint of [form.hints.deprecation, form.hints.other]) {
      expect(hint.length, release.version).toBeGreaterThan(0);
      expect(hint.includes(LF), release.version).toBe(false);
    }
    for (const vector of vectors) {
      const context = `observation self-test: warning, ${release.version}, ${vector.route}`;
      const run = await loadedRun(
        vector.staged,
        release,
        vector.route,
        context,
      );
      const [warning] = run.report.warnings;
      expect(run.report.warnings, context).toHaveLength(1);
      if (warning === undefined) continue;
      expect(warning.name, context).toBe("XspecSelfTestWarning");
      const rendering = renderWarnings(
        run.report.warnings,
        run.report.pid,
        form,
      );
      expect(rendering.ok, context).toBe(true);
      if (!rendering.ok) continue;
      expect(Buffer.from(rendering.text, "utf8"), context).toEqual(
        Buffer.from(run.result.stderrBytes),
      );
      const frame = packageFrame(warning, run.placement);
      expect(frame, context).toContain(vector.entry(run.placement));
      expect(warningFirstFrame(warning), context).toBe(frame);
      expect(pairingProblem(run), context).toBeNull();
      const problems = outputProblems(run, form);
      expect(problems, context).toHaveLength(1);
      expect(problems[0], context).toContain(
        "begins its stack in the package's files",
      );
    }
  }
});

test("conforming stand-ins whose manifests draw the runtime's own warnings pass the output oracle on each of E-1's releases: DEP0128 along require (an invalid main beside index.js) and DEP0151 along each import route (an ES-module package's main lookup), each run's one warning that deprecation; and an ES-module-only package along require on each release that loads it, its warnings, where the release prints one, the experimental warning — 22.12.0 among E-1's releases printing it (TEST-SPEC T7.6-7(a): the release's own warnings in resolving the specifier and loading the package's files admitted)", async () => {
  const releases = await resolveNodeReleases();
  const invalidMain = await stageStandIn(
    STAND_INS.invalidMain,
    releases,
    "observation self-test: invalid main",
  );
  const mainLookup = await stageStandIn(
    STAND_INS.mainLookup,
    releases,
    "observation self-test: main lookup",
  );
  const moduleOnly = await stageStandIn(
    STAND_INS.moduleOnly,
    releases,
    "observation self-test: ES-module only",
  );
  const vectors: readonly (readonly [StagedPackage, ModuleRoute, string])[] = [
    [invalidMain, "require", "DEP0128"],
    ...IMPORT_ROUTES.map((route) => [mainLookup, route, "DEP0151"] as const),
  ];
  const printedExperimental: string[] = [];
  for (const release of releases) {
    for (const [staged, route, code] of vectors) {
      const context = `observation self-test: ${code}, ${release.version}, ${route}`;
      const run = await loadedRun(staged, release, route, context);
      expect(
        run.report.warnings.map((warning) => [warning.name, warning.code]),
        context,
      ).toEqual([["DeprecationWarning", code]]);
      expect(exportsProblems(run), context).toEqual([]);
      expect(pairingProblem(run), context).toBeNull();
      expect(await runtimeOutputProblems(run), context).toEqual([]);
    }
    const context = `observation self-test: ES-module only, ${release.version}, require`;
    const run = await runModuleRoute(
      request(moduleOnly, release, "require", context),
    );
    if (run.outcome === "load-failed") continue;
    const loaded = assertModuleLoaded(run, "stand-in");
    for (const warning of loaded.report.warnings) {
      expect(warning.name, context).toBe("ExperimentalWarning");
      printedExperimental.push(release.version);
    }
    expect(exportsProblems(loaded), context).toEqual([]);
    expect(pairingProblem(loaded), context).toBeNull();
    expect(await runtimeOutputProblems(loaded), context).toEqual([]);
  }
  expect(printedExperimental).toContain("22.12.0");
});

test("end to end on one release, each of T7.6-6's observations reports the deviation it exists for, as problems in words: a CommonJS-only entry's import namespace carrying default and an enumerable __esModule (the listings), -0 returned as 0 and object arguments copied (identity), a Proxy's traps touched and a frozen object refused (no examination), a defineConfig that is no function (no call made), and a process ending inside a call (an incomplete run naming the call) (TEST-SPEC T7.6-6, §7.6 Pairing)", async () => {
  const release = await firstRelease();
  const run = async (
    standIn: keyof typeof STAND_INS,
    route: ModuleRoute,
  ): Promise<LoadedModuleRun> => {
    const context = `observation self-test: ${standIn}, ${release.version}, ${route}`;
    const staged = await stageStandIn(STAND_INS[standIn], [release], context);
    return loadedRun(staged, release, route, context);
  };

  const commonJsOnly = await run("commonJsOnly", "static-import");
  const namespace = exportsProblems(commonJsOnly);
  expect(namespace).toHaveLength(1);
  expect(namespace[0]).toContain("own string-keyed properties");
  expect(namespace[0]).toContain('"default"');

  const esModule = await run("enumerableEsModule", "require");
  const listing = exportsProblems(esModule);
  expect(listing).toHaveLength(1);
  expect(listing[0]).toContain('"__esModule"');
  expect(pairingProblem(esModule)).toBeNull();

  const negativeZero = await run("negativeZero", "require");
  const zero = identityProblems(negativeZero);
  expect(zero).toHaveLength(1);
  expect(zero[0]).toContain("defineConfig(-0): it returned 0 (number)");
  expect(examinationProblems(negativeZero)).toEqual([]);
  expect(pairingProblem(negativeZero)).toContain("defineConfig(-0)");

  const copying = await run("copying", "require");
  expect(
    copying.report.calls.results
      .filter((result) => result.outcome !== "returned-argument")
      .map((result) => result.case),
  ).toEqual(["object", "array", "further-arguments", "frozen"]);
  expect(identityProblems(copying)).toHaveLength(3);
  const copied = examinationProblems(copying);
  expect(copied).toHaveLength(1);
  expect(copied[0]).toContain("it returned another object instead");

  const examining = await run("examining", "require");
  const { traps } = examining.report.calls;
  expect(traps.length).toBeGreaterThan(0);
  expect(traps[0]).toEqual({ proxy: "first", trap: "ownKeys" });
  expect(traps.every((invocation) => invocation.proxy === "first")).toBe(true);
  expect(identityProblems(examining)).toEqual([]);
  const examined = examinationProblems(examining);
  expect(examined).toHaveLength(1);
  expect(examined[0]).toContain("ownKeys on the first Proxy");
  expect(pairingProblem(examining)).toBeNull();

  const frozenRefusing = await run("frozenRefusing", "require");
  expect(identityProblems(frozenRefusing)).toEqual([]);
  const refused = examinationProblems(frozenRefusing);
  expect(refused).toHaveLength(1);
  expect(refused[0]).toContain(
    "defineConfig(f) with f a frozen object: it threw TypeError",
  );

  const notAFunction = await run("notAFunction", "require");
  expect(notAFunction.report.calls.reading).toEqual({
    type: "number",
    thrown: null,
  });
  expect(notAFunction.report.calls.results).toEqual([]);
  expect(exportsProblems(notAFunction)).toEqual([]);
  for (const problems of [
    identityProblems(notAFunction),
    examinationProblems(notAFunction),
  ]) {
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("a value of type number, no function");
  }
  expect(pairingProblem(notAFunction)).not.toBeNull();

  const context = `observation self-test: exitingInCall, ${release.version}, require`;
  const exiting = await runModuleRoute(
    request(
      await stageStandIn(STAND_INS.exitingInCall, [release], context),
      release,
      "require",
      context,
    ),
  );
  expect(exiting.outcome).toBe("incomplete");
  expect(exiting.report?.phase).toBe("calling");
  expect(exiting.report?.calls?.results.map((result) => result.case)).toEqual(
    CALL_CASES.slice(0, CALL_CASES.indexOf("boolean")),
  );
  expect(moduleRunProblem(exiting)).toContain(
    "loaded the module, but ended during T7.6-6's call defineConfig(false)",
  );
});

/** A form of the vectors' own, for the vectors' own release. */
const VECTOR_FORM: WarningForm = {
  version: "0.0.0",
  hints: { deprecation: "HINT FOR A DEPRECATION", other: "HINT FOR ANY OTHER" },
};

/** A placement of the vectors' own, a symbolic link to its copy. */
const VECTOR_PLACEMENT: Placement = {
  name: "xspec-config",
  holdingDir: "/s/p",
  path: "/s/p/node_modules/xspec-config",
  form: "symlink",
  copy: "/s/placed-copies/copy-1",
};

/** A captured warning, an Error's reading unless overridden. */
function captured(fields: Partial<CapturedWarning>): CapturedWarning {
  return {
    type: "object",
    name: "Warning",
    code: null,
    message: "a message",
    detail: null,
    stack: null,
    ...fields,
  };
}

/** A vector's loaded run: a conforming one unless overridden. */
function vectorRun(
  fields: {
    readonly route?: ModuleRoute;
    readonly ownKeys?: readonly OwnKey[] | null;
    readonly reading?: DefineConfigReading;
    readonly results?: readonly CallResult[];
    readonly traps?: readonly TrapInvocation[];
    readonly warnings?: readonly CapturedWarning[];
    readonly stdout?: string;
    readonly stderr?: string;
  } = {},
): LoadedModuleRun {
  const route = fields.route ?? "require";
  const stdout = fields.stdout ?? "";
  const stderr = fields.stderr ?? "";
  return {
    description: `vector run (${route})`,
    route,
    release: { version: "0.0.0", executable: "/releases/v0.0.0/bin/node" },
    placement: VECTOR_PLACEMENT,
    importingModule: "/s/p/importing-module.cjs",
    cwd: "/run/work",
    home: "/run/home",
    tmp: "/run/tmp",
    environment: { HOME: "/run/home", TMPDIR: "/run/tmp" },
    result: {
      exitCode: 0,
      signal: null,
      stdout,
      stderr,
      stdoutBytes: Buffer.from(stdout, "utf8"),
      stderrBytes: Buffer.from(stderr, "utf8"),
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
          ownKeys:
            fields.ownKeys === undefined ? [DEFINE_CONFIG_KEY] : fields.ownKeys,
        },
      },
      calls: {
        reading: fields.reading ?? { type: "function", thrown: null },
        results: fields.results ?? ALL_RETURNED,
        traps: fields.traps ?? [],
      },
      state: { subjects: [], changes: [], omitted: 0 },
      bootstrapError: null,
      warnings: fields.warnings ?? [],
      exit: { code: 0 },
    },
    reportProblem: undefined,
    effects: undefined,
  };
}

/** ALL_RETURNED with `name`'s call replaced by `result`'s fields. */
function withCall(
  name: CallResult["case"],
  result: Partial<CallResult>,
): readonly CallResult[] {
  return ALL_RETURNED.map((entry) =>
    entry.case === name ? { ...entry, ...result } : entry,
  );
}

test("the output oracle's pure functions on vectors: the release's printed forms rendered in order — the process identifier, a non-empty code bracketed, the type and message joined as the release joins them, a detail on its own line, the hint for a first deprecation or for any other first warning, a line feed after each — and a warning no Error reads as refused; the first frame read after the stack's head, a message line shaped like a frame left to the head; and a package frame named by the placement's path, its copy's, or a file URL, never by a sibling's (TEST-SPEC T7.6-7(a))", () => {
  expect(renderWarnings([], 7, VECTOR_FORM)).toEqual({ ok: true, text: "" });
  const first = captured({
    name: "XspecWarning",
    code: "XSPEC",
    message: `a message${LF}over two lines`,
    detail: `a detail${LF}over two lines`,
  });
  const deprecation = captured({
    name: "DeprecationWarning",
    code: "DEP0000",
    message: "a deprecation",
  });
  expect(renderWarnings([first, deprecation], 7, VECTOR_FORM)).toEqual({
    ok: true,
    text:
      `(node:7) [XSPEC] XspecWarning: a message${LF}over two lines${LF}` +
      `a detail${LF}over two lines${LF}HINT FOR ANY OTHER${LF}` +
      `(node:7) [DEP0000] DeprecationWarning: a deprecation${LF}`,
  });
  expect(renderWarnings([deprecation, first], 42, VECTOR_FORM)).toEqual({
    ok: true,
    text:
      `(node:42) [DEP0000] DeprecationWarning: a deprecation${LF}` +
      `HINT FOR A DEPRECATION${LF}` +
      `(node:42) [XSPEC] XspecWarning: a message${LF}over two lines${LF}` +
      `a detail${LF}over two lines${LF}`,
  });
  expect(
    renderWarnings(
      [
        captured({ code: "", message: "an empty code" }),
        captured({ name: "NoMessageWarning", message: "" }),
        captured({ name: "", message: "no name" }),
      ],
      7,
      VECTOR_FORM,
    ),
  ).toEqual({
    ok: true,
    text:
      `(node:7) Warning: an empty code${LF}HINT FOR ANY OTHER${LF}` +
      `(node:7) NoMessageWarning${LF}(node:7) no name${LF}`,
  });
  for (const refused of [
    captured({ type: "string", name: null }),
    captured({ name: null }),
    captured({ message: null }),
  ]) {
    expect(renderWarnings([first, refused], 7, VECTOR_FORM).ok).toBe(false);
  }

  const internal = "    at tryPackage (node:internal/modules/cjs/loader:1:1)";
  const shaped = "    at shaped (/s/p/node_modules/xspec-config/index.js:1:1)";
  expect(
    warningFirstFrame(
      captured({
        name: "XspecWarning",
        message: `first line${LF}${shaped}`,
        stack: `XspecWarning: first line${LF}${shaped}${LF}${internal}`,
      }),
    ),
  ).toBe(internal);
  expect(
    warningFirstFrame(captured({ stack: `Warning: a message${LF}${shaped}` })),
  ).toBe(shaped);
  expect(warningFirstFrame(captured({ stack: "Warning: a message" }))).toBe(
    null,
  );
  expect(warningFirstFrame(captured({ stack: null }))).toBe(null);
  expect(
    warningFirstFrame(
      captured({ stack: `another head${LF}${internal}${LF}${shaped}` }),
    ),
  ).toBe(internal);

  const framed = (frame: string): CapturedWarning =>
    captured({ stack: `Warning: a message${LF}${frame}` });
  for (const frame of [
    "    at f (/s/p/node_modules/xspec-config/index.js:1:9)",
    "    at f (/s/placed-copies/copy-1/lib/index.js:2:3)",
    "    at file:///s/p/node_modules/xspec-config/index.js:1:9",
    "    at file:///s/placed-copies/copy-1/index.js:1:9",
  ]) {
    expect(packageFrame(framed(frame), VECTOR_PLACEMENT), frame).toBe(frame);
  }
  for (const frame of [
    "    at f (/s/p/node_modules/xspec-config-other/index.js:1:9)",
    "    at f (/s/placed-copies/copy-10/index.js:1:9)",
    internal,
  ]) {
    expect(packageFrame(framed(frame), VECTOR_PLACEMENT), frame).toBe(null);
  }
  // A path a file URL spells otherwise: the space percent-encoded there.
  const spaced: Placement = {
    ...VECTOR_PLACEMENT,
    holdingDir: "/s/a project",
    path: "/s/a project/node_modules/xspec-config",
    form: "copy",
    copy: "/s/a project/node_modules/xspec-config",
  };
  for (const frame of [
    "    at file:///s/a%20project/node_modules/xspec-config/index.js:1:9",
    "    at f (/s/a project/node_modules/xspec-config/index.js:1:9)",
  ]) {
    expect(packageFrame(framed(frame), spaced), frame).toBe(frame);
  }
});

test("T7.6-6's and T7.6-7(a)'s problem functions on vectors: each conforming vector clean, and each deviation caught by the observation it exists for — a namespace carrying default, an enumerable __esModule (a non-enumerable one admitted), an enumerable symbol, defineConfig itself not enumerable or its enumerability unread, keys unlisted; -0 returned as 0, a read that threw, no function read; a trap invoked, a frozen object refused, the second Proxy returned; the pairing unmet; output on standard output, a stray byte on standard error, a warning beginning its stack in the package, one the oracle cannot render; and a form of another release refused (TEST-SPEC T7.6-6, T7.6-7(a), §7.6 Pairing)", () => {
  const one = (problems: readonly string[], ...mentions: string[]): void => {
    expect(problems).toHaveLength(1);
    for (const mention of mentions) expect(problems[0]).toContain(mention);
  };
  const named = (
    name: string,
    enumerable: boolean | null,
    kind: OwnKey["kind"] = "string",
  ): OwnKey => ({ kind, name, enumerable });

  expect(
    exportsProblems(
      vectorRun({
        route: "static-import",
        ownKeys: [DEFINE_CONFIG_KEY, TO_STRING_TAG_KEY],
      }),
    ),
  ).toEqual([]);
  one(
    exportsProblems(
      vectorRun({
        route: "dynamic-import-from-commonjs",
        ownKeys: [named("default", true), DEFINE_CONFIG_KEY, TO_STRING_TAG_KEY],
      }),
    ),
    "own string-keyed properties",
    '"default"',
  );
  one(
    exportsProblems(vectorRun({ route: "static-import", ownKeys: null })),
    "could not be listed",
  );
  expect(exportsProblems(vectorRun())).toEqual([]);
  expect(
    exportsProblems(
      vectorRun({ ownKeys: [DEFINE_CONFIG_KEY, named("__esModule", false)] }),
    ),
  ).toEqual([]);
  one(
    exportsProblems(
      vectorRun({ ownKeys: [named("__esModule", true), DEFINE_CONFIG_KEY] }),
    ),
    "own enumerable properties",
    '"__esModule"',
  );
  one(
    exportsProblems(
      vectorRun({
        ownKeys: [DEFINE_CONFIG_KEY, named("xspec", true, "symbol")],
      }),
    ),
    "Symbol(xspec)",
  );
  one(
    exportsProblems(vectorRun({ ownKeys: [named("defineConfig", false)] })),
    "are [], not exactly",
  );
  one(
    exportsProblems(
      vectorRun({ ownKeys: [DEFINE_CONFIG_KEY, named("other", null)] }),
    ),
    "could not be read",
  );
  one(exportsProblems(vectorRun({ ownKeys: null })), "could not be listed");

  expect(identityProblems(vectorRun())).toEqual([]);
  const zero = vectorRun({
    results: withCall("negative-zero", {
      outcome: "returned-other",
      returned: { type: "number", text: "0" },
    }),
  });
  one(identityProblems(zero), "defineConfig(-0): it returned 0 (number)");
  expect(examinationProblems(zero)).toEqual([]);
  const thrown = {
    type: "object",
    name: "TypeError",
    code: null,
    message: "a getter threw",
    stack: null,
  };
  const threw = vectorRun({ reading: { type: null, thrown }, results: [] });
  one(identityProblems(threw), "threw TypeError");
  one(examinationProblems(threw), "threw TypeError");
  const noFunction = vectorRun({
    reading: { type: "undefined", thrown: null },
    results: [],
  });
  one(identityProblems(noFunction), "is undefined, no function");

  expect(examinationProblems(vectorRun())).toEqual([]);
  const trapped = vectorRun({
    traps: [
      { proxy: "first", trap: "get" },
      { proxy: "second", trap: "has" },
    ],
  });
  one(
    examinationProblems(trapped),
    "get on the first Proxy, has on the second Proxy",
  );
  expect(identityProblems(trapped)).toEqual([]);
  expect(pairingProblem(trapped)).toBeNull();
  one(
    examinationProblems(
      vectorRun({ results: withCall("frozen", { outcome: "threw", thrown }) }),
    ),
    "defineConfig(f) with f a frozen object: it threw TypeError",
  );
  const second = vectorRun({
    results: withCall("proxies", {
      outcome: "returned-other",
      returned: { type: "function", text: "the second Proxy" },
    }),
  });
  one(examinationProblems(second), "the second Proxy (function)");
  expect(identityProblems(second)).toEqual([]);

  expect(pairingProblem(vectorRun())).toBeNull();
  expect(pairingProblem(zero)).toContain("§7.6 Pairing");
  expect(pairingProblem(second)).toContain("the second Proxy (function)");
  expect(pairingProblem(noFunction)).toContain("no function");

  const warning = captured({
    name: "DeprecationWarning",
    code: "DEP0128",
    message: "an invalid main",
    stack: `DeprecationWarning: an invalid main${LF}    at tryPackage (node:internal/modules/cjs/loader:1:1)`,
  });
  const printed = `(node:7) [DEP0128] DeprecationWarning: an invalid main${LF}HINT FOR A DEPRECATION${LF}`;
  expect(outputProblems(vectorRun(), VECTOR_FORM)).toEqual([]);
  expect(
    outputProblems(
      vectorRun({ warnings: [warning], stderr: printed }),
      VECTOR_FORM,
    ),
  ).toEqual([]);
  one(
    outputProblems(vectorRun({ stdout: "x" }), VECTOR_FORM),
    "standard output is not empty",
  );
  one(
    outputProblems(vectorRun({ stderr: "x" }), VECTOR_FORM),
    "is not exactly the release's printed forms of the 0 warning(s)",
  );
  one(
    outputProblems(
      vectorRun({ warnings: [warning], stderr: `${printed}x` }),
      VECTOR_FORM,
    ),
    "is not exactly the release's printed forms of the 1 warning(s)",
  );
  one(
    outputProblems(
      vectorRun({
        warnings: [
          {
            ...warning,
            stack: `DeprecationWarning: an invalid main${LF}    at Object.<anonymous> (/s/p/node_modules/xspec-config/index.js:1:9)`,
          },
        ],
        stderr: printed,
      }),
      VECTOR_FORM,
    ),
    "begins its stack in the package's files",
  );
  one(
    outputProblems(
      vectorRun({ warnings: [captured({ type: "string", name: null })] }),
      VECTOR_FORM,
    ),
    "the oracle knows no printed form of it",
  );
  one(outputProblems(zero, VECTOR_FORM), "§7.6 Pairing");
  expect(() =>
    outputProblems(vectorRun(), { ...VECTOR_FORM, version: "22.0.0" }),
  ).toThrow("judges no run on 0.0.0");
});
