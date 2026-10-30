// Self-checks for the module channel's Node.js release driver (TEST-SPEC 17
// preamble: internal self-tests cover harness machinery certification does
// not exercise; H-2, T7.6-6's run conditions, T7.6-7, §7.6 Pairing, H-1,
// S-3, E-1; helpers/module-channel-node.ts and its bootstrap,
// helpers/module-channel-bootstrap.cjs). No runtime test of 7.6 is
// registered yet, and S-10's checks of the driver — each release's
// identity, each route's entry, each observation's catch — build on these;
// here the driver's own plumbing is pinned before any product exists, on
// each of E-1's releases, so XSPEC_NODE_RELEASES_DIR must name them, as
// CI's harness-self job and AGENTS.md's recipe do (unset, every test here
// fails as the harness error NodeReleaseError, never a skip):
// - a dual stand-in package loads along each of Node.js's four routes on
//   each provisioned release, each importing module running as its route's
//   kind from the importing file's place, with an environment of exactly
//   HOME, TMPDIR, and PATH — HOME and TMPDIR fresh for each run — no option,
//   the run's own working directory, and nothing on either stream;
// - the observation channel round-trips: the report on disk decodes to
//   what the driver returns, holding the arguments the driver passed, from
//   a place outside the staging, the working directory, HOME, and TMPDIR,
//   and a warning the stand-in emits comes back with its type, code,
//   message, detail, and stack;
// - a stray NODE_OPTIONS (a user condition the dual stand-in's exports map
//   would answer), NODE_PATH, NODE_PRESERVE_SYMLINKS, and NODE_NO_WARNINGS
//   in the ambient environment reach no run;
// - each way a run can fail to load is reported as such — a package with no
//   entry (S-7's stub package), a module exiting while it loads, one killed
//   by a signal, one overwriting the report, one setting a nonzero exit
//   code — as a diagnosed failure for a product and a harness error for a
//   stand-in, and a run kept alive ends at its own guard;
// - the importing modules' place: each route's file written once, found
//   byte-equal by a later run, and any other occupant refused;
// - the report's decoder, on vectors: exactly the bootstrap's members, each
//   of its kind, consistent with its phase, or a malformed report.
//
// The stand-in packages are small hand-written, non-xspec packages, written
// at run time into fresh directories under the OS temporary directory from
// the texts below (STAND_INS), so the committed tree holds no package of
// this file's own; S-7's stub package (test/fixtures/empty-stub-package/)
// is the one committed directory placed here.

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
  CALL_CASES,
  decodeModuleRunReport,
  importingModuleKind,
  importingModuleName,
  importingModuleText,
  MODULE_ROUTES,
  MODULE_RUN_PREFIX,
  MODULE_RUN_PROTOCOL,
  moduleRunEnvironment,
  prepareModuleRun,
  runModuleRoute,
} from "../helpers/module-channel-node.js";
import type {
  ModuleRoute,
  ModuleRun,
  ModuleRunRequest,
} from "../helpers/module-channel-node.js";
import { resolveNodeReleases } from "../helpers/node-releases.js";
import type { NodeRelease } from "../helpers/node-releases.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import { ProductRunTimeoutError, runProduct } from "../helpers/subprocess.js";
import type { ProductBinding } from "../helpers/subprocess.js";

const LF = String.fromCodePoint(0x0a);

/** S-7's stub package: a manifest naming no entry. */
const STUB_PACKAGE_DIR = fileURLToPath(
  new URL("../fixtures/empty-stub-package", import.meta.url),
);

/** The harness's bootstrap, which each run's directory holds a copy of. */
const BOOTSTRAP_SOURCE = fileURLToPath(
  new URL("../helpers/module-channel-bootstrap.cjs", import.meta.url),
);

/** The user condition a stray NODE_OPTIONS would carry into a run. */
const STRAY_CONDITION = "xspec-stray-condition";

/** A loaded value's own `defineConfig` key, as the report lists it. */
const DEFINE_CONFIG_KEY = {
  kind: "string",
  name: "defineConfig",
  enumerable: true,
} as const;

/** A module namespace's own `Symbol.toStringTag` key, likewise. */
const TO_STRING_TAG_KEY = {
  kind: "symbol",
  name: "Symbol.toStringTag",
  enumerable: false,
} as const;

/** A manifest's text. */
function manifest(members: Record<string, unknown>): string {
  return `${JSON.stringify(members, null, 2)}${LF}`;
}

/** A module's text, from its lines. */
function lines(...text: string[]): string {
  return `${text.join(LF)}${LF}`;
}

/**
 * The stand-in packages (module header), each a map from file name to text.
 * Every one but `dual` is a CommonJS package with one entry, `index.js`.
 */
const STAND_INS = {
  /**
   * A dual package: an ES-module entry for `import`, a CommonJS one for
   * `require`, each exporting exactly `defineConfig`, an identity function;
   * and, first in its exports map, an entry for the stray user condition,
   * exporting `strayCondition` alone, which no run without the condition
   * reaches.
   */
  dual: {
    "package.json": manifest({
      name: "node-driver-dual-standin",
      version: "1.0.0",
      type: "module",
      main: "./index.cjs",
      exports: {
        ".": {
          [STRAY_CONDITION]: "./stray.cjs",
          import: "./index.js",
          require: "./index.cjs",
        },
      },
    }),
    "index.js": lines(
      "export function defineConfig(settings) {",
      "  return settings;",
      "}",
    ),
    "index.cjs": lines(
      "exports.defineConfig = function defineConfig(settings) {",
      "  return settings;",
      "};",
    ),
    "stray.cjs": lines("exports.strayCondition = true;"),
  },
  /** Emits one process warning while it loads, through the runtime's facility. */
  warning: commonJsStandIn("node-driver-warning-standin", [
    'process.emitWarning("xspec driver self-test warning", {',
    '  type: "XspecSelfTestWarning",',
    '  code: "XSPEC_SELF_TEST",',
    '  detail: "its detail",',
    "});",
  ]),
  /** Exits while it loads, its exit code 0. */
  exiting: commonJsStandIn("node-driver-exiting-standin", ["process.exit(0);"]),
  /** Kills its own process with SIGKILL while it loads. */
  killed: commonJsStandIn("node-driver-killed-standin", [
    'process.kill(process.pid, "SIGKILL");',
  ]),
  /**
   * Overwrites the report as the process exits: its own `exit` listener,
   * registered after the bootstrap's, writes text that is no JSON to the
   * report's path, the third argument after the executable.
   */
  tampering: commonJsStandIn("node-driver-tampering-standin", [
    'process.on("exit", () => {',
    '  require("node:fs").writeFileSync(process.argv[3], "not a report");',
    "});",
  ]),
  /** Sets the process's exit code to 3 while it loads. */
  exitCode: commonJsStandIn("node-driver-exit-code-standin", [
    "process.exitCode = 3;",
  ]),
  /** Keeps the process alive with an interval timer it starts while loading. */
  lingering: commonJsStandIn("node-driver-lingering-standin", [
    "setInterval(() => {}, 1000);",
  ]),
} as const satisfies Record<string, Record<string, string>>;

/**
 * A CommonJS stand-in named `name`: `index.js` exporting `defineConfig`, an
 * identity function, after `effect`'s statements.
 */
function commonJsStandIn(
  name: string,
  effect: readonly string[],
): Record<string, string> {
  return {
    "package.json": manifest({ name, version: "1.0.0", main: "./index.js" }),
    "index.js": lines(
      ...effect,
      "exports.defineConfig = function defineConfig(settings) {",
      "  return settings;",
      "};",
    ),
  };
}

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
  const directory = await freshDirectory("xspec-node-driver-standin-");
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
    label: "module-channel Node.js driver stand-in binding",
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
 * Stage `packageDir` at the canonical placement in the CommonJS project
 * `project`, for runs on `releases`; disposed of once the test ends.
 */
async function stagePackage(
  packageDir: string,
  releases: readonly NodeRelease[],
  context: string,
): Promise<StagedPackage> {
  const staging = await ModuleStaging.create(
    standInBinding(packageDir),
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

/** The first of E-1's releases, for the vectors one release serves. */
async function firstRelease(): Promise<NodeRelease> {
  const [release] = await resolveNodeReleases();
  if (release === undefined) throw new Error("E-1 lists no release");
  return release;
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

/** The error `work` throws, which it must. */
function thrownBy(work: () => unknown): unknown {
  try {
    work();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw, and nothing was thrown");
}

/** Expect `run`'s failure to load charged to the product, then the harness. */
function expectChargedBothWays(run: ModuleRun, mentions: string): void {
  const diagnosed = thrownBy(() => assertModuleLoaded(run, "product"));
  expect(diagnosed).toBeInstanceOf(HarnessAssertionError);
  expect((diagnosed as Error).message).toContain(run.description);
  expect((diagnosed as Error).message).toContain(mentions);
  const harness = thrownBy(() => assertModuleLoaded(run, "stand-in"));
  expect(harness).toBeInstanceOf(Error);
  expect(harness).not.toBeInstanceOf(HarnessAssertionError);
  expect((harness as Error).message.startsWith("harness error (H-11): ")).toBe(
    true,
  );
  expect((harness as Error).message).toContain(mentions);
}

test("a dual stand-in package loads along each of Node.js's four routes on each of E-1's releases: each importing module runs as its route's kind from the importing file's place, under exactly HOME, TMPDIR, and PATH — HOME and TMPDIR fresh for each run — with no option, in the run's own working directory outside the staging, nothing on either stream, and each run's directory removed afterwards (TEST-SPEC T7.6-6's run conditions, T7.6-7, H-2, E-1)", async () => {
  const releases = await resolveNodeReleases();
  const dual = await writeStandIn(STAND_INS.dual);
  const staged = await stagePackage(dual, releases, "driver self-test: dual");
  const fresh = new Set<string>();
  for (const release of releases) {
    for (const route of MODULE_ROUTES) {
      const context = `driver self-test: dual, ${release.version}, ${route}`;
      const run = await runModuleRoute(
        request(staged, release, route, context),
      );
      const loaded = assertModuleLoaded(run, "stand-in");
      const report = loaded.report;
      expect(report.load.value, context).toEqual({
        type: "object",
        ownKeys:
          route === "require"
            ? [DEFINE_CONFIG_KEY]
            : [DEFINE_CONFIG_KEY, TO_STRING_TAG_KEY],
      });
      expect(run.result.stdout, context).toBe("");
      expect(run.result.stderr, context).toBe("");
      expect(report.warnings, context).toEqual([]);
      expect(report.exit, context).toEqual({ code: 0 });
      expect(report.release.version, context).toBe(`v${release.version}`);
      expect(report.release.execPath, context).toBe(
        await fsp.realpath(release.executable),
      );
      expect(report.release.execArgv, context).toEqual([]);
      expect(run.environment, context).toEqual(
        moduleRunEnvironment(run.home, run.tmp),
      );
      expect(Object.keys(report.environment).sort(), context).toEqual(
        process.env["PATH"] === undefined || process.env["PATH"] === ""
          ? ["HOME", "TMPDIR"]
          : ["HOME", "PATH", "TMPDIR"],
      );
      expect(report.environment, context).toEqual(run.environment);
      expect(report.environment["HOME"], context).toBe(run.home);
      expect(report.environment["TMPDIR"], context).toBe(run.tmp);
      expect(report.cwd, context).toBe(run.cwd);
      expect(path.dirname(run.importingModule), context).toBe(
        staged.placement.holdingDir,
      );
      expect(path.basename(run.importingModule), context).toBe(
        importingModuleName(route),
      );
      expect(report.importingModule, context).toEqual(
        importingModuleKind(route) === "module"
          ? {
              topLevelThis: "undefined",
              location: pathToFileURL(run.importingModule).href,
            }
          : { topLevelThis: "object", location: run.importingModule },
      );
      for (const place of [run.cwd, run.home, run.tmp]) {
        expect(within(place, staged.staging.root), context).toBe(false);
        expect(fresh.has(place), context).toBe(false);
        fresh.add(place);
        expect(await exists(place), context).toBe(false);
      }
      expect(run.cwd, context).not.toBe(path.dirname(run.importingModule));
      expect(
        path.basename(path.dirname(run.cwd)).startsWith(MODULE_RUN_PREFIX),
        context,
      ).toBe(true);
    }
  }
  expect(fresh.size).toBe(releases.length * MODULE_ROUTES.length * 3);
});

test("the observation channel round-trips: each run's report, written outside the staging, its working directory, HOME, and TMPDIR, decodes on disk to what the driver returns, holding the arguments the driver passed, from a bootstrap byte-equal to the harness's; and a warning the stand-in emits while loading comes back with its type, code, message, detail, and a stack beginning in the package, the release printing it with the run's process identifier (TEST-SPEC T7.6-7(a), H-3)", async () => {
  const release = await firstRelease();
  const warning = await writeStandIn(STAND_INS.warning);
  const staged = await stagePackage(
    warning,
    [release],
    "driver self-test: warning",
  );
  const bootstrap = await fsp.readFile(BOOTSTRAP_SOURCE);
  for (const route of MODULE_ROUTES) {
    const context = `driver self-test: warning, ${route}`;
    const prepared = await prepareModuleRun(
      request(staged, release, route, context),
    );
    try {
      expect(await fsp.readFile(prepared.bootstrap), context).toEqual(
        bootstrap,
      );
      for (const place of [
        staged.staging.root,
        prepared.cwd,
        prepared.home,
        prepared.tmp,
      ]) {
        expect(within(prepared.reportPath, place), context).toBe(false);
      }
      expect(await exists(prepared.reportPath), context).toBe(false);
      const run = await prepared.launch();
      const loaded = assertModuleLoaded(run, "stand-in");
      expect(
        decodeModuleRunReport(await fsp.readFile(prepared.reportPath)),
        context,
      ).toEqual({ ok: true, report: run.report });
      expect(loaded.report.argv, context).toEqual([
        prepared.bootstrap,
        prepared.importingModule,
        prepared.reportPath,
        route,
      ]);
      expect(loaded.report.warnings, context).toHaveLength(1);
      const [captured] = loaded.report.warnings;
      expect({ ...captured, stack: null }, context).toEqual({
        type: "object",
        name: "XspecSelfTestWarning",
        code: "XSPEC_SELF_TEST",
        message: "xspec driver self-test warning",
        detail: "its detail",
        stack: null,
      });
      const frames = (captured?.stack ?? "").split(LF);
      expect(frames[1], context).toContain(
        path.join(staged.placement.path, "index.js"),
      );
      expect(run.result.stdout, context).toBe("");
      expect(run.result.stderr, context).toContain(
        `(node:${String(loaded.report.pid)}) [XSPEC_SELF_TEST] ` +
          "XspecSelfTestWarning: xspec driver self-test warning",
      );
    } finally {
      await prepared.dispose();
    }
    expect(await exists(prepared.root), context).toBe(false);
  }
});

test("a stray NODE_OPTIONS carrying a user condition the stand-in's exports map answers, a stray NODE_PATH, NODE_PRESERVE_SYMLINKS, and NODE_NO_WARNINGS in the ambient environment reach no run, on each of E-1's releases, along static import and require: each run's environment stays exactly its own, and each loads the conditionless entry (TEST-SPEC T7.6-6: no option, no environment variable, no user condition; S-10)", async () => {
  const releases = await resolveNodeReleases();
  const dual = await writeStandIn(STAND_INS.dual);
  const staged = await stagePackage(
    dual,
    releases,
    "driver self-test: stray environment",
  );
  // The vector is live: the release given the condition itself loads the
  // condition's entry from the project.
  const [first] = releases;
  if (first === undefined) throw new Error("E-1 lists no release");
  const answered = await runProduct(
    {
      label: `the Node.js release ${first.version}, given the stray condition`,
      command: first.executable,
      requiredFiles: [first.executable],
    },
    {
      cwd: staged.placement.holdingDir,
      argv: [
        `--conditions=${STRAY_CONDITION}`,
        "--eval",
        "process.stdout.write(Object.keys(require(" +
          `${JSON.stringify(staged.placement.name)})).join(","));`,
      ],
      env: { NODE_OPTIONS: undefined, NODE_PATH: undefined },
    },
  );
  expect(answered.stdout).toBe("strayCondition");
  const strayPath = await freshDirectory("xspec-node-driver-stray-path-");
  const strays: Record<string, string> = {
    NODE_OPTIONS: `--conditions=${STRAY_CONDITION}`,
    NODE_PATH: strayPath,
    NODE_PRESERVE_SYMLINKS: "1",
    NODE_NO_WARNINGS: "1",
  };
  const saved = Object.keys(strays).map(
    (name): [string, string | undefined] => [name, process.env[name]],
  );
  Object.assign(process.env, strays);
  try {
    for (const release of releases) {
      for (const route of ["static-import", "require"] as const) {
        const context = `driver self-test: stray environment, ${release.version}, ${route}`;
        const run = await runModuleRoute(
          request(staged, release, route, context),
        );
        const loaded = assertModuleLoaded(run, "stand-in");
        expect(
          loaded.report.load.value.ownKeys
            ?.filter((key) => key.kind === "string")
            .map((key) => key.name),
          context,
        ).toEqual(["defineConfig"]);
        for (const name of Object.keys(strays)) {
          expect(loaded.report.environment[name], context).toBeUndefined();
        }
        expect(loaded.report.environment, context).toEqual(run.environment);
        expect(loaded.report.release.execArgv, context).toEqual([]);
      }
    }
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("each way a run can fail to load is reported as such — a package naming no entry (S-7's stub package) along each route, a module exiting while it loads, one killing its own process, one overwriting the report, one setting exit code 3 — each a diagnosed failure for a product and a harness error for a stand-in; and a run its module keeps alive ends at its own guard, its directory removed (TEST-SPEC H-8, H-3, S-3, §7.6 Pairing)", async () => {
  const release = await firstRelease();
  const stub = await stagePackage(
    STUB_PACKAGE_DIR,
    [release],
    "driver self-test: stub package",
  );
  for (const route of MODULE_ROUTES) {
    const context = `driver self-test: stub package, ${route}`;
    const run = await runModuleRoute(request(stub, release, route, context));
    expect(run.outcome, context).toBe("load-failed");
    const load = run.report?.load;
    expect(load?.outcome, context).toBe("failed");
    if (load?.outcome === "failed") {
      expect(load.error.code, context).toBe(
        route === "require" ? "MODULE_NOT_FOUND" : "ERR_MODULE_NOT_FOUND",
      );
    }
    expect(run.report?.importingModule, context).toBeNull();
    expectChargedBothWays(run, "did not load the module");
  }

  const vectors: readonly {
    readonly standIn: keyof typeof STAND_INS;
    readonly check: (run: ModuleRun) => void;
    readonly mentions: string;
  }[] = [
    {
      standIn: "exiting",
      check: (run) => {
        expect(run.outcome).toBe("incomplete");
        expect(run.report?.phase).toBe("loading");
        expect(run.report?.exit).toEqual({ code: 0 });
        expect(run.result.exitCode).toBe(0);
      },
      mentions: "ended before the load completed or failed",
    },
    {
      standIn: "killed",
      check: (run) => {
        expect(run.outcome).toBe("no-report");
        expect(run.report).toBeUndefined();
        expect(run.result.signal).toBe("SIGKILL");
      },
      mentions: "left no report: the process was killed by SIGKILL",
    },
    {
      standIn: "tampering",
      check: (run) => {
        expect(run.outcome).toBe("malformed-report");
        expect(run.reportProblem).toContain("no UTF-8 JSON");
        expect(run.result.exitCode).toBe(0);
      },
      mentions: "left a malformed report",
    },
    {
      standIn: "exitCode",
      check: (run) => {
        expect(run.outcome).toBe("loaded");
        expect(run.report?.exit).toEqual({ code: 3 });
        expect(run.result.exitCode).toBe(3);
      },
      mentions: "exited with code 3, not with exit code 0 on its own",
    },
  ];
  for (const vector of vectors) {
    const context = `driver self-test: ${vector.standIn}`;
    const packageDir = await writeStandIn(STAND_INS[vector.standIn]);
    const staged = await stagePackage(packageDir, [release], context);
    const run = await runModuleRoute(
      request(staged, release, "require", context),
    );
    vector.check(run);
    expectChargedBothWays(run, vector.mentions);
  }

  const lingering = await stagePackage(
    await writeStandIn(STAND_INS.lingering),
    [release],
    "driver self-test: lingering",
  );
  const prepared = await prepareModuleRun({
    ...request(lingering, release, "require", "driver self-test: lingering"),
    guards: { timeoutMs: 3_000 },
  });
  try {
    await expect(prepared.launch()).rejects.toBeInstanceOf(
      ProductRunTimeoutError,
    );
  } finally {
    await prepared.dispose();
  }
  expect(await exists(prepared.root)).toBe(false);
});

test("the importing modules' place: each route's file, named for its route and naming the placement by a specifier spelling exactly N, stands beside the others in the importing file's directory, written once and found byte-equal by a later run; any other occupant of its path is a HarnessStagingError, and a specifier outside 7.6's grammar a usage error (TEST-SPEC T7.6-6: a harness-written importing module in the importing file's place; SPEC 7.6 Reach)", async () => {
  const release = await firstRelease();
  const dual = await writeStandIn(STAND_INS.dual);
  const staged = await stagePackage(
    dual,
    [release],
    "driver self-test: importing modules",
  );
  const name = staged.placement.name;
  for (const route of MODULE_ROUTES) {
    const text = importingModuleText(route, name);
    expect(text, route).toContain(JSON.stringify(name));
    for (const round of [1, 2]) {
      const context = `driver self-test: importing modules, ${route}, run ${String(round)}`;
      assertModuleLoaded(
        await runModuleRoute(request(staged, release, route, context)),
        "stand-in",
      );
    }
    expect(
      await fsp.readFile(
        path.join(staged.placement.holdingDir, importingModuleName(route)),
        "utf8",
      ),
      route,
    ).toBe(text);
  }
  expect((await fsp.readdir(staged.placement.holdingDir)).sort()).toEqual(
    [
      ...MODULE_ROUTES.map((route) => importingModuleName(route)),
      "node_modules",
      "package.json",
    ].sort(),
  );
  await staged.staging.writeFile(
    `project/sub/${importingModuleName("require")}`,
    `// not the importing module${LF}`,
  );
  await expect(
    prepareModuleRun({
      ...request(staged, release, "require", "driver self-test: occupied"),
      importingDir: "project/sub",
    }),
  ).rejects.toBeInstanceOf(HarnessStagingError);
  expect(() => importingModuleText("require", "Not A Name")).toThrow(
    "7.6's grammar",
  );
});

test("the report's decoder reads exactly the bootstrap's members, each of its kind and consistent with the phase — T7.6-6's own-key listing and calls among them — and says what makes any other report malformed — a missing or extra member, another protocol, a value of another kind, a phase of its own, a load outcome or calls inconsistent with the phase or the note, calls out of the bootstrap's order or unfinished at completion, a call verdict inconsistent with its values, a trap or proxy of its own, bytes that are no UTF-8 or no JSON (TEST-SPEC H-3: failing loudly when required information is absent)", () => {
  const encode = (value: unknown): Uint8Array =>
    new TextEncoder().encode(JSON.stringify(value));
  const thrown = {
    type: "object",
    name: "Error",
    code: "MODULE_NOT_FOUND",
    message: "Cannot find module",
    stack: "Error: Cannot find module",
  };
  const warning = {
    type: "object",
    name: "DeprecationWarning",
    code: "DEP0128",
    message: "Invalid 'main' field",
    detail: null,
    stack: "DeprecationWarning: Invalid 'main' field",
  };
  const returned = (name: string): Record<string, unknown> => ({
    case: name,
    outcome: "returned-argument",
    returned: null,
    thrown: null,
  });
  const results = CALL_CASES.map(returned);
  const calls = {
    reading: { type: "function", thrown: null },
    results,
    traps: [],
  };
  const withResults = (
    altered: readonly Record<string, unknown>[],
  ): Record<string, unknown> => ({ ...calls, results: altered });
  const valid = {
    protocol: MODULE_RUN_PROTOCOL,
    argv: ["/run/bootstrap.cjs", "/staging/importing.cjs", "/run/r", "require"],
    release: { version: "v22.0.0", execPath: "/node", execArgv: [] },
    pid: 4242,
    environment: { HOME: "/run/home", TMPDIR: "/run/tmp" },
    cwd: "/run/work",
    phase: "completed",
    importingModule: { topLevelThis: "object", location: "/staging/i.cjs" },
    load: {
      outcome: "loaded",
      value: { type: "object", ownKeys: [DEFINE_CONFIG_KEY] },
    },
    calls,
    bootstrapError: null,
    warnings: [warning],
    exit: { code: 0 },
  };
  const omit = (
    record: Record<string, unknown>,
    member: string,
  ): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(record).filter(([name]) => name !== member),
    );
  const failedLoad = {
    ...valid,
    load: { outcome: "failed", error: thrown },
    importingModule: null,
    calls: null,
  };
  const loading = {
    ...valid,
    phase: "loading",
    load: null,
    importingModule: null,
    calls: null,
  };
  const listing = (ownKeys: unknown): Record<string, unknown> => ({
    ...valid,
    load: { outcome: "loaded", value: { type: "object", ownKeys } },
  });
  const decodes: readonly [string, unknown][] = [
    ["a loaded report", valid],
    ["a failed load", failedLoad],
    ["a run ending while loading", loading],
    ["a bootstrap failure", { ...loading, bootstrapError: thrown, exit: null }],
    [
      "a run ending while reading defineConfig",
      {
        ...valid,
        phase: "calling",
        calls: { ...calls, reading: null, results: [] },
      },
    ],
    [
      "a run ending during the calls",
      { ...valid, phase: "calling", calls: withResults(results.slice(0, 3)) },
    ],
    [
      "a bootstrap failure during the calls",
      {
        ...valid,
        phase: "calling",
        calls: withResults(results.slice(0, 1)),
        bootstrapError: thrown,
        exit: null,
      },
    ],
    [
      "a defineConfig that is no function",
      {
        ...valid,
        calls: {
          ...calls,
          reading: { type: "undefined", thrown: null },
          results: [],
        },
      },
    ],
    [
      "a read of defineConfig that threw",
      {
        ...valid,
        calls: { ...calls, reading: { type: null, thrown }, results: [] },
      },
    ],
    [
      "calls returning another value or throwing, and traps invoked",
      {
        ...valid,
        calls: {
          ...withResults([
            {
              ...returned("object"),
              outcome: "returned-other",
              returned: { type: "object", text: null },
            },
            { ...returned("array"), outcome: "threw", thrown },
            ...results.slice(2),
          ]),
          traps: [
            { proxy: "first", trap: "get" },
            { proxy: "second", trap: "ownKeys" },
          ],
        },
      },
    ],
    [
      "a symbol key with no description, and a key whose enumerability is unknown",
      listing([
        DEFINE_CONFIG_KEY,
        { kind: "symbol", name: null, enumerable: false },
        { kind: "string", name: "other", enumerable: null },
      ]),
    ],
    [
      "a loaded value whose keys are not listed",
      {
        ...valid,
        load: { outcome: "loaded", value: { type: "number", ownKeys: null } },
      },
    ],
  ];
  for (const [label, value] of decodes) {
    expect(decodeModuleRunReport(encode(value)).ok, label).toBe(true);
  }
  expect(decodeModuleRunReport(encode(valid))).toEqual({
    ok: true,
    report: omit(valid, "protocol"),
  });
  const malformed: readonly [string, unknown][] = [
    ["a missing member", omit(valid, "pid")],
    ["an extra member", { ...valid, extra: 1 }],
    ["another protocol", { ...valid, protocol: "xspec-module-run/0" }],
    ["a number for a string", { ...valid, cwd: 1 }],
    [
      "an environment value of another kind",
      { ...valid, environment: { HOME: 1 } },
    ],
    ["a phase of its own", { ...valid, phase: "started" }],
    [
      "completed without a load",
      { ...valid, load: null, importingModule: null },
    ],
    ["a load while still loading", { ...valid, phase: "loading" }],
    [
      "completed with a bootstrap failure",
      { ...valid, bootstrapError: thrown },
    ],
    [
      "the note without a loaded module",
      { ...valid, load: { outcome: "failed", error: thrown } },
    ],
    ["a loaded module without the note", { ...valid, importingModule: null }],
    ["a load outcome of its own", { ...valid, load: { outcome: "skipped" } }],
    [
      "a warning missing its detail",
      { ...valid, warnings: [omit(warning, "detail")] },
    ],
    ["an argument of another kind", { ...valid, argv: [1] }],
    ["an exit code that is no integer", { ...valid, exit: { code: 1.5 } }],
    ["a process identifier of zero", { ...valid, pid: 0 }],
    ["an array for the report", [valid]],
    ["the previous protocol", { ...valid, protocol: "xspec-module-run/1" }],
    ["calls while still loading", { ...loading, calls }],
    ["calls without a loaded module", { ...failedLoad, calls }],
    ["a loaded module without calls", { ...valid, calls: null }],
    [
      "the phase calling without calls",
      { ...valid, phase: "calling", calls: null },
    ],
    [
      "completed with defineConfig unread",
      { ...valid, calls: { ...calls, reading: null, results: [] } },
    ],
    [
      "completed with a call missing",
      { ...valid, calls: withResults(results.slice(0, -1)) },
    ],
    [
      "calls out of the bootstrap's order",
      {
        ...valid,
        calls: withResults([
          ...results.slice(1, 2),
          ...results.slice(0, 1),
          ...results.slice(2),
        ]),
      },
    ],
    [
      "a call of its own",
      { ...valid, calls: withResults([...results, returned("another")]) },
    ],
    [
      "calls made with no function read",
      {
        ...valid,
        calls: { ...calls, reading: { type: "object", thrown: null } },
      },
    ],
    [
      "a reading with both a type and a thrown value",
      { ...valid, calls: { ...calls, reading: { type: "function", thrown } } },
    ],
    [
      "a returned value beside the outcome returned-argument",
      {
        ...valid,
        calls: withResults([
          { ...returned("object"), returned: { type: "object", text: null } },
          ...results.slice(1),
        ]),
      },
    ],
    [
      "the outcome threw without the thrown value",
      {
        ...valid,
        calls: withResults([
          { ...returned("object"), outcome: "threw" },
          ...results.slice(1),
        ]),
      },
    ],
    [
      "a call outcome of its own",
      {
        ...valid,
        calls: withResults([
          { ...returned("object"), outcome: "returned" },
          ...results.slice(1),
        ]),
      },
    ],
    [
      "a trap of its own",
      {
        ...valid,
        calls: { ...calls, traps: [{ proxy: "first", trap: "call" }] },
      },
    ],
    [
      "a proxy of its own",
      {
        ...valid,
        calls: { ...calls, traps: [{ proxy: "third", trap: "get" }] },
      },
    ],
    [
      "a string key with no name",
      listing([{ kind: "string", name: null, enumerable: true }]),
    ],
    [
      "a key of another kind",
      listing([{ kind: "number", name: "0", enumerable: true }]),
    ],
    [
      "an enumerability that is no boolean",
      listing([{ ...DEFINE_CONFIG_KEY, enumerable: "yes" }]),
    ],
    [
      "the previous listing of names",
      {
        ...valid,
        load: {
          outcome: "loaded",
          value: { type: "object", ownPropertyNames: ["defineConfig"] },
        },
      },
    ],
  ];
  for (const [label, value] of malformed) {
    const decoding = decodeModuleRunReport(encode(value));
    expect(decoding.ok, label).toBe(false);
  }
  expect(decodeModuleRunReport(Uint8Array.of(0xff, 0xfe)).ok).toBe(false);
  expect(
    decodeModuleRunReport(new TextEncoder().encode("not a report")).ok,
  ).toBe(false);
});
