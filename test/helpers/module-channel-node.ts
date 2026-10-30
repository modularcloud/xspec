// The module channel's Node.js release driver (TEST-SPEC H-2, T7.6-6's run
// conditions, T7.6-7, §7.6 Pairing, H-1, S-3, E-1, S-10; SPEC 7.6 Reach,
// Runtime). Harness machinery only: this module never imports product code
// and never loads a file of a package in its own process. It loads the
// `defineConfig` module, placed in a staging of the module channel
// (helpers/module-channel.ts), on a Node.js release E-1 provisions
// (helpers/node-releases.ts) along one of Node.js's routes, and reads back
// what that process observed.
//
// TEST-SPEC T7.6-6: on each release, run with no option, no environment
// variable (`NODE_OPTIONS` and `NODE_PATH` among them), no user condition,
// and no loader or customization hook, the module is loaded along each of
// Node.js's routes from a harness-written importing module in the importing
// file's place — a static `import` from an ES module (`.mjs`), a dynamic
// `import()` from an ES module and from a CommonJS module (`.cjs`), and
// `require` from a CommonJS module. T7.6-7: each run is given a fresh `HOME`
// and `TMPDIR`; the importing module reports its observations outside both
// streams and every compared path; harness-written code registers a
// `warning` listener on `process` and only then loads the importing module,
// by its physical path.
//
// - The routes (`MODULE_ROUTES`): each route's importing module is a file
//   whose kind its extension fixes — `.mjs` an ES module, `.cjs` a CommonJS
//   one, whatever any `package.json` says — named for its route
//   (`importingModuleName`) and written into the importing file's place
//   (`importingModuleText`): the directory the caller names, the
//   placement's holding directory unless it names another. It holds the
//   route's load of a specifier spelling exactly N, the placement's name,
//   and nothing else of the package's, and hands back what it loaded — the
//   namespace (static `import`), the namespace awaited at its top level
//   (dynamic `import()` from an ES module), the promise `import()` returns
//   (from a CommonJS module), or the `require` result — beside a note of
//   its own kind, its top-level `this` (`undefined` in an ES module, its
//   `module.exports` in a CommonJS one), and its location (`import.meta.url`,
//   `__filename`). The four can stand side by side in one directory, each
//   written once and found byte-equal by a later run; any other occupant of
//   such a path is a `HarnessStagingError`.
// - The bootstrap (helpers/module-channel-bootstrap.cjs, harness code that
//   imports none): a CommonJS file, which Node.js runs as one without
//   reading any `package.json`, copied byte for byte into the run's own
//   directory and run there as `<release>/bin/node <bootstrap>
//   <importing module> <report> <route>` — no option before the script —
//   through the subprocess driver (`runProduct`) under the run's own hang
//   guard (`MODULE_RUN_TIMEOUT_MS`; S-3). In order, it captures the
//   built-ins it calls once loading has begun, reads the run's conditions,
//   registers a `warning` listener on `process` (recording each warning the
//   runtime delivers, in order) and an `exit` listener, and only then loads
//   the importing module by its physical path: `import()` of its file URL
//   for an `.mjs`, `require` for a `.cjs`. It never awaits the loaded value
//   itself, so a `then` export is never called by the harness.
// - The run's own directory (`PreparedModuleRun`): a fresh directory under
//   the OS temporary directory, at its physical path, outside the staging,
//   holding the bootstrap, the report, and three fresh, empty directories —
//   the run's `HOME`, its `TMPDIR`, and its working directory, `work`, which
//   is never the importing module's directory, so that T7.6-7(e) can stage
//   a FIFO named `xspec.config.ts` in each of the three places it names,
//   and which T7.6-7(b) compares before and after the run with the staging,
//   `HOME`, and `TMPDIR`. The report lies outside all four. The directory is
//   removed when the run is disposed of; a caller staging more for a run
//   (T7.6-7's FIFOs and snapshots) does so between `prepareModuleRun` and
//   `PreparedModuleRun.launch`, then disposes of it.
// - The environment (`moduleRunEnvironment`): explicit and minimal, never
//   the ambient one filtered — `HOME` and `TMPDIR`, the run's fresh
//   directories, and `PATH`, the harness's own where it has one (kept as
//   every process environment carries it; Node.js resolves and loads no
//   module through it). Nothing else is passed: no `NODE_OPTIONS` (no
//   option, condition, loader, or hook through it), no `NODE_PATH` (no
//   global module folder beyond those H-1 verifies empty), and none of the
//   other variables bearing on module loading or the run's output
//   (`NODE_PRESERVE_SYMLINKS`, `NODE_NO_WARNINGS`, `NODE_PENDING_DEPRECATION`,
//   `NODE_REDIRECT_WARNINGS`, `NODE_COMPILE_CACHE`, `NODE_V8_COVERAGE`,
//   `NODE_DEBUG`, `FORCE_COLOR`, among them). The run is spawned with the
//   subprocess driver's environment overridden to exactly that
//   (`productEnvironment` with every other variable removed), and the
//   bootstrap's own reading of its environment must equal it.
// - Before each run (`launch`): Reach for the importing module on the
//   finished staging (`ModuleStaging.verifyReach`: physical naming, the
//   placement in place, nothing nearer, no self-reference, well-formed
//   manifests, and, where declared, the project kind and nothing else
//   installed), and H-1 under the run's exact environment, working
//   directory, and executable (`ModuleStaging.verifyIsolation`) — each a
//   `HarnessStagingError` when unmet.
// - The report (`decodeModuleRunReport`): one JSON document the bootstrap
//   writes to a path the driver names, outside both streams — once the load
//   has completed or failed, and again as the process exits, each time
//   whole (a sibling file renamed over it). Its members are read exactly:
//   the protocol, the arguments as the run saw them, the release's version,
//   executable, and options, the process identifier, the environment, the
//   working directory, the phase reached, the importing module's note of its
//   kind and location, the load's outcome (the loaded value's type and own
//   property names, or the error the load threw: its type, name, code,
//   message, and stack), a failure of the bootstrap's own, each warning
//   delivered (its type, name, code, message, detail, and stack), and the
//   exit code the `exit` listener saw. Anything else — absent members, an
//   extra one, a value of another kind, bytes that are no UTF-8 JSON — is a
//   malformed report: H-3's rule, failing loudly, never a pass.
// - The run's conditions, checked on every report that decodes (S-10 pins
//   them on stand-ins): the arguments round-trip exactly as passed; the
//   release in effect is the one provisioned (`process.version` and
//   `process.execPath`, the executable's physical path); the run carries no
//   option (`process.execArgv` empty); its environment is exactly the one
//   set; its working directory is the run's; and, where the module loaded,
//   the importing module ran as its route's kind, from its physical path. A
//   breach is a harness error (H-11): the harness sets every one of them
//   before anything of the package loads.
// - Outcomes (`ModuleRunOutcome`): `loaded`, the route's load handed back a
//   value; `load-failed`, it threw (a stub package's missing entry, an
//   ES-module-only package along `require` on a release before 22.12.0);
//   `incomplete`, the process exited before the load completed or failed
//   (`process.exit` while loading, an uncaught exception, an unsettled
//   top-level `await`), or the bootstrap's own flow failed; `no-report`,
//   the process left no report (killed by a signal, or exiting without its
//   `exit` listeners while loading); `malformed-report`. The run's exit
//   code, signal, and both streams are reported beside the outcome.
// - Attribution (`assertModuleLoaded`): a run that loads nothing, crashes,
//   or ends otherwise than on its own with exit code 0 is reported as such —
//   for a test, a diagnosed failure (`HarnessAssertionError`, H-8), the
//   module channel counting as part of the product, as S-7's stub package
//   requires; for a stand-in the harness expected to load, a harness error
//   (a plain `Error`), never a verdict. The run's hang-guard kill
//   (`ProductRunTimeoutError`) propagates unchanged — a hang ends its test
//   (S-3) — and so does every other rejection of the run's spawn, which
//   for a release E-1 provisioned is a harness error.
// - Observations beyond the load (T7.6-6's calls, T7.6-7's output, writes,
//   process state, and FIFOs) extend the bootstrap's report and this
//   module's decoder together; each absence they assert counts only where
//   the same run loaded the module and saw `defineConfig` return its
//   argument (§7.6 Pairing).
// - Every examination and write here is a harness step under its own guard
//   (helpers/step-guards.ts); the run itself is a product invocation under
//   its own (S-3). E-1 exercises the releases on the Linux leg alone, and
//   this driver serves POSIX paths alone.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fail } from "./assertions.js";
import type {
  ModuleStaging,
  Placement,
  ProjectKind,
  ReachStaging,
} from "./module-channel.js";
import { moduleNameGrammarProblem } from "./module-channel.js";
import type { NodeRelease } from "./node-releases.js";
import type { StagingMode } from "./permissions.js";
import { HarnessStagingError } from "./permissions.js";
import { guardStep, guardSyncStep } from "./step-guards.js";
import type { ProductBinding, RunGuards, RunResult } from "./subprocess.js";
import {
  DEFAULT_TIMEOUT_MS,
  productEnvironment,
  runProduct,
} from "./subprocess.js";

/** The staging mode every refusal of this module names. */
const MODE: StagingMode = "module-channel";

/** The prefix of each run's own directory under the OS temporary one. */
export const MODULE_RUN_PREFIX = "xspec-module-run-";

/** The protocol the bootstrap's report names, which the decoder requires. */
export const MODULE_RUN_PROTOCOL = "xspec-module-run/1";

/**
 * Each run's own hang guard (TEST-SPEC S-3): the subprocess driver's
 * default, sized for invocations whose call sites size none of their own.
 * A run starts a release and loads one small package: about 40 ms
 * unloaded here, staging checks included (AGENTS.md), so the guard is far
 * more than ten times the run, loaded runs included, and a run blocking on
 * a FIFO or kept alive by a timer ends at it, ending its test.
 */
export const MODULE_RUN_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

/** The bootstrap, harness code beside this module (module header). */
const BOOTSTRAP_SOURCE = fileURLToPath(
  new URL("./module-channel-bootstrap.cjs", import.meta.url),
);

/** The names in a run's own directory (module header). */
const BOOTSTRAP_NAME = "bootstrap.cjs";
const REPORT_NAME = "report.json";
const HOME_NAME = "home";
const TMPDIR_NAME = "tmp";
const WORK_NAME = "work";

const LF = String.fromCodePoint(0x0a);

/** How much of a stream a diagnosis quotes. */
const QUOTED_STREAM_LIMIT = 800;

// ---------------------------------------------------------------------------
// Routes and importing modules
// ---------------------------------------------------------------------------

/**
 * Node.js's routes (TEST-SPEC T7.6-6; SPEC 7.6 Reach): a static `import`
 * from an ES module, a dynamic `import()` from an ES module and from a
 * CommonJS module, and `require` from a CommonJS module.
 */
export type ModuleRoute =
  | "static-import"
  | "dynamic-import-from-module"
  | "dynamic-import-from-commonjs"
  | "require";

/** Every route, in TEST-SPEC T7.6-6's order. */
export const MODULE_ROUTES: readonly ModuleRoute[] = Object.freeze([
  "static-import",
  "dynamic-import-from-module",
  "dynamic-import-from-commonjs",
  "require",
]);

/** An importing module's kind, which its extension fixes. */
export type ImportingModuleKind = "module" | "commonjs";

interface RouteShape {
  readonly kind: ImportingModuleKind;
  readonly extension: ".mjs" | ".cjs";
  readonly description: string;
}

const ROUTE_SHAPES: Readonly<Record<ModuleRoute, RouteShape>> = {
  "static-import": {
    kind: "module",
    extension: ".mjs",
    description: "a static import from an ES module (.mjs)",
  },
  "dynamic-import-from-module": {
    kind: "module",
    extension: ".mjs",
    description: "a dynamic import() from an ES module (.mjs)",
  },
  "dynamic-import-from-commonjs": {
    kind: "commonjs",
    extension: ".cjs",
    description: "a dynamic import() from a CommonJS module (.cjs)",
  },
  require: {
    kind: "commonjs",
    extension: ".cjs",
    description: "require from a CommonJS module (.cjs)",
  },
};

/** The kind of `route`'s importing module. */
export function importingModuleKind(route: ModuleRoute): ImportingModuleKind {
  return ROUTE_SHAPES[route].kind;
}

/** `route`, in words, for diagnoses. */
export function describeRoute(route: ModuleRoute): string {
  return ROUTE_SHAPES[route].description;
}

/** The file name of `route`'s importing module (module header). */
export function importingModuleName(route: ModuleRoute): string {
  return `importing-module-${route}${ROUTE_SHAPES[route].extension}`;
}

/**
 * The text of `route`'s importing module loading `specifier` (module
 * header): the route's load of a specifier spelling exactly `specifier`, a
 * name of 7.6's grammar (spelled as a JSON string literal, which for such a
 * name holds no escape), handed back as `loaded`, beside its kind note,
 * `kind`. A specifier outside the grammar is a usage error.
 */
export function importingModuleText(
  route: ModuleRoute,
  specifier: string,
): string {
  const problem = moduleNameGrammarProblem(specifier);
  if (problem !== null) {
    throw new Error(
      `module channel: the specifier ${JSON.stringify(specifier)} ` +
        `${problem}; an importing module names a placement by N, a name of ` +
        `7.6's grammar`,
    );
  }
  const literal = JSON.stringify(specifier);
  const header =
    `// Harness-written importing module (xspec test harness, TEST-SPEC ` +
    `T7.6-6): ${describeRoute(route)}.`;
  const kindNote = (location: string): string[] => [
    "  topLevelThis: typeof this,",
    `  location: ${location},`,
  ];
  let lines: string[];
  switch (route) {
    case "static-import":
      lines = [
        header,
        `import * as loaded from ${literal};`,
        "",
        "export { loaded };",
        "export const kind = {",
        ...kindNote("import.meta.url"),
        "};",
      ];
      break;
    case "dynamic-import-from-module":
      lines = [
        header,
        "export const kind = {",
        ...kindNote("import.meta.url"),
        "};",
        `export const loaded = await import(${literal});`,
      ];
      break;
    case "dynamic-import-from-commonjs":
      lines = [
        header,
        "exports.kind = {",
        ...kindNote("__filename"),
        "};",
        `exports.loaded = import(${literal});`,
      ];
      break;
    case "require":
      lines = [
        header,
        "exports.kind = {",
        ...kindNote("__filename"),
        "};",
        `exports.loaded = require(${literal});`,
      ];
      break;
  }
  return `${lines.join(LF)}${LF}`;
}

// ---------------------------------------------------------------------------
// The environment
// ---------------------------------------------------------------------------

/**
 * A run's environment (module header): `HOME` and `TMPDIR` the run's fresh
 * directories, and `PATH` the harness's own (`ambient`'s, `process.env`
 * unless given) where it has a non-empty one; nothing else.
 */
export function moduleRunEnvironment(
  home: string,
  tmp: string,
  ambient: Readonly<Record<string, string | undefined>> = process.env,
): Readonly<Record<string, string>> {
  const environment: Record<string, string> = { HOME: home, TMPDIR: tmp };
  const searchPath = ambient["PATH"];
  if (searchPath !== undefined && searchPath !== "") {
    environment["PATH"] = searchPath;
  }
  return Object.freeze(environment);
}

/** The binding a release runs through (module header). */
function releaseBinding(release: NodeRelease): ProductBinding {
  return {
    label:
      `the Node.js release ${release.version} (${release.executable}), ` +
      `loading the defineConfig module through the module channel`,
    command: release.executable,
    requiredFiles: [release.executable],
  };
}

/**
 * The subprocess driver's overrides giving a run of `binding` exactly
 * `wanted`: every variable its environment would otherwise carry removed,
 * then `wanted`'s set.
 */
function exactEnvironmentOverrides(
  binding: ProductBinding,
  wanted: Readonly<Record<string, string>>,
): Readonly<Record<string, string | undefined>> {
  const entries: [string, string | undefined][] = Object.keys(
    productEnvironment(binding),
  ).map((name) => [name, undefined]);
  for (const [name, value] of Object.entries(wanted)) {
    entries.push([name, value]);
  }
  return Object.fromEntries(entries);
}

/** Whether two environments hold the same variables, each the same value. */
function sameEnvironment(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>,
): boolean {
  const leftNames = Object.keys(left).sort();
  const rightNames = Object.keys(right).sort();
  return (
    leftNames.length === rightNames.length &&
    leftNames.every(
      (name, index) => name === rightNames[index] && left[name] === right[name],
    )
  );
}

/** An environment, for a diagnosis: its variables, sorted. */
function describeEnvironment(
  environment: Readonly<Record<string, string>>,
): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(environment)
        .sort()
        .map((name) => [name, environment[name]]),
    ),
  );
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

/** A thrown value as the bootstrap reads it: its type, then strings where it has them. */
export interface ThrownDescription {
  /** `typeof` the value, `null` reading as "null". */
  readonly type: string;
  readonly name: string | null;
  readonly code: string | null;
  readonly message: string | null;
  readonly stack: string | null;
}

/** A warning the runtime delivered to the bootstrap's `warning` listener. */
export interface CapturedWarning extends ThrownDescription {
  readonly detail: string | null;
}

/** What the route's load handed back, or what it threw. */
export type LoadObservation =
  | {
      readonly outcome: "loaded";
      readonly value: {
        /** `typeof` the loaded value, `null` reading as "null". */
        readonly type: string;
        /** Its own string-keyed property names, where it is an object. */
        readonly ownPropertyNames: readonly string[] | null;
      };
    }
  | { readonly outcome: "failed"; readonly error: ThrownDescription };

/** The importing module's note of its own kind and location. */
export interface ImportingModuleNote {
  /** `typeof this` at its top level: "undefined" in an ES module. */
  readonly topLevelThis: string | null;
  /** `import.meta.url` in an ES module, `__filename` in a CommonJS one. */
  readonly location: string | null;
}

/** A decoded report (module header), its members read exactly. */
export interface ModuleRunReport {
  /** The bootstrap's path and the arguments after it, as the run saw them. */
  readonly argv: readonly string[];
  readonly release: {
    /** `process.version`: `v` and the release's version. */
    readonly version: string;
    /** `process.execPath`: the executable's physical path. */
    readonly execPath: string;
    /** `process.execArgv`: the options before the script. */
    readonly execArgv: readonly string[];
  };
  /** `process.pid`. */
  readonly pid: number;
  /** `process.env`, read before anything of the package loaded. */
  readonly environment: Readonly<Record<string, string>>;
  /** `process.cwd()`, read likewise. */
  readonly cwd: string;
  /** `completed` once the load completed or failed; `loading` before. */
  readonly phase: "loading" | "completed";
  /** Where the module loaded: the importing module's note; null otherwise. */
  readonly importingModule: ImportingModuleNote | null;
  /** The load's outcome once the phase is `completed`; null before. */
  readonly load: LoadObservation | null;
  /** A failure of the bootstrap's own flow, if any. */
  readonly bootstrapError: ThrownDescription | null;
  /** Each warning delivered to the `warning` listener, in order. */
  readonly warnings: readonly CapturedWarning[];
  /** The exit code the `exit` listener saw; null where it never ran. */
  readonly exit: { readonly code: number | null } | null;
}

/** A report's decoding: the report, or what makes it malformed. */
export type ReportDecoding =
  | { readonly ok: true; readonly report: ModuleRunReport }
  | { readonly ok: false; readonly problem: string };

/** A shape problem, thrown by the readers below and caught by the decoder. */
class ReportShapeError extends Error {}

const REPORT_MEMBERS = [
  "argv",
  "bootstrapError",
  "cwd",
  "environment",
  "exit",
  "importingModule",
  "load",
  "phase",
  "pid",
  "protocol",
  "release",
  "warnings",
];
const RELEASE_MEMBERS = ["execArgv", "execPath", "version"];
const THROWN_MEMBERS = ["code", "message", "name", "stack", "type"];
const WARNING_MEMBERS = [...THROWN_MEMBERS, "detail"];
const NOTE_MEMBERS = ["location", "topLevelThis"];

/**
 * Decode a report's bytes (module header): UTF-8 JSON holding exactly the
 * bootstrap's members, each of its kind, consistent with the phase. Never
 * throws for a malformed report: it says what makes it so.
 */
export function decodeModuleRunReport(bytes: Uint8Array): ReportDecoding {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch (error) {
    return {
      ok: false,
      problem: `its bytes are no UTF-8 JSON (${describeError(error)})`,
    };
  }
  try {
    return { ok: true, report: readReport(parsed) };
  } catch (error) {
    if (error instanceof ReportShapeError) {
      return { ok: false, problem: error.message };
    }
    throw error;
  }
}

function readReport(value: unknown): ModuleRunReport {
  const record = readRecord(value, "the report", REPORT_MEMBERS);
  if (record["protocol"] !== MODULE_RUN_PROTOCOL) {
    throw new ReportShapeError(
      `its protocol is ${JSON.stringify(record["protocol"])}, not ` +
        `${JSON.stringify(MODULE_RUN_PROTOCOL)}`,
    );
  }
  const release = readRecord(record["release"], "release", RELEASE_MEMBERS);
  const pid = record["pid"];
  if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) {
    throw new ReportShapeError(
      `its pid ${JSON.stringify(pid)} is no positive integer`,
    );
  }
  const phase = record["phase"];
  if (phase !== "loading" && phase !== "completed") {
    throw new ReportShapeError(
      `its phase ${JSON.stringify(phase)} is neither "loading" nor "completed"`,
    );
  }
  const report: ModuleRunReport = {
    argv: readStrings(record["argv"], "argv"),
    release: {
      version: readString(release["version"], "release.version"),
      execPath: readString(release["execPath"], "release.execPath"),
      execArgv: readStrings(release["execArgv"], "release.execArgv"),
    },
    pid,
    environment: readEnvironment(record["environment"]),
    cwd: readString(record["cwd"], "cwd"),
    phase,
    importingModule:
      record["importingModule"] === null
        ? null
        : readNote(record["importingModule"]),
    load: record["load"] === null ? null : readLoad(record["load"]),
    bootstrapError:
      record["bootstrapError"] === null
        ? null
        : readThrown(record["bootstrapError"], "bootstrapError"),
    warnings: readArray(record["warnings"], "warnings").map((warning, index) =>
      readWarning(warning, `warnings[${String(index)}]`),
    ),
    exit: record["exit"] === null ? null : readExit(record["exit"]),
  };
  if (report.phase === "completed") {
    if (report.load === null || report.bootstrapError !== null) {
      throw new ReportShapeError(
        "it reached the phase completed without a load outcome, or with a " +
          "failure of the bootstrap's own",
      );
    }
  } else if (report.load !== null) {
    throw new ReportShapeError(
      "it holds a load outcome while still in the phase loading",
    );
  }
  if (
    (report.importingModule !== null) !==
    (report.load?.outcome === "loaded")
  ) {
    throw new ReportShapeError(
      "it holds the importing module's note without a loaded module, or a " +
        "loaded module without the note",
    );
  }
  return report;
}

function readRecord(
  value: unknown,
  where: string,
  members: readonly string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReportShapeError(`${where} is no JSON object`);
  }
  const record = value as Record<string, unknown>;
  const found = Object.keys(record).sort();
  const wanted = [...members].sort();
  if (
    found.length !== wanted.length ||
    found.some((name, index) => name !== wanted[index])
  ) {
    throw new ReportShapeError(
      `${where} holds the members ${JSON.stringify(found)}, not exactly ` +
        JSON.stringify(wanted),
    );
  }
  return record;
}

function readArray(value: unknown, where: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ReportShapeError(`${where} is no JSON array`);
  }
  return value as readonly unknown[];
}

function readString(value: unknown, where: string): string {
  if (typeof value !== "string") {
    throw new ReportShapeError(`${where} is no string`);
  }
  return value;
}

function readNullableString(value: unknown, where: string): string | null {
  return value === null ? null : readString(value, where);
}

function readStrings(value: unknown, where: string): readonly string[] {
  return readArray(value, where).map((entry, index) =>
    readString(entry, `${where}[${String(index)}]`),
  );
}

function readEnvironment(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReportShapeError("environment is no JSON object");
  }
  const entries = Object.entries(value as Record<string, unknown>).map(
    ([name, entry]): [string, string] => [
      name,
      readString(entry, `environment[${JSON.stringify(name)}]`),
    ],
  );
  return Object.freeze(Object.fromEntries(entries));
}

function readNote(value: unknown): ImportingModuleNote {
  const record = readRecord(value, "importingModule", NOTE_MEMBERS);
  return {
    topLevelThis: readNullableString(
      record["topLevelThis"],
      "importingModule.topLevelThis",
    ),
    location: readNullableString(
      record["location"],
      "importingModule.location",
    ),
  };
}

function readThrown(value: unknown, where: string): ThrownDescription {
  const record = readRecord(value, where, THROWN_MEMBERS);
  return {
    type: readString(record["type"], `${where}.type`),
    name: readNullableString(record["name"], `${where}.name`),
    code: readNullableString(record["code"], `${where}.code`),
    message: readNullableString(record["message"], `${where}.message`),
    stack: readNullableString(record["stack"], `${where}.stack`),
  };
}

function readWarning(value: unknown, where: string): CapturedWarning {
  const record = readRecord(value, where, WARNING_MEMBERS);
  return {
    type: readString(record["type"], `${where}.type`),
    name: readNullableString(record["name"], `${where}.name`),
    code: readNullableString(record["code"], `${where}.code`),
    message: readNullableString(record["message"], `${where}.message`),
    detail: readNullableString(record["detail"], `${where}.detail`),
    stack: readNullableString(record["stack"], `${where}.stack`),
  };
}

function readLoad(value: unknown): LoadObservation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReportShapeError("load is no JSON object");
  }
  const outcome = (value as Record<string, unknown>)["outcome"];
  if (outcome === "loaded") {
    const record = readRecord(value, "load", ["outcome", "value"]);
    const loaded = readRecord(record["value"], "load.value", [
      "ownPropertyNames",
      "type",
    ]);
    return {
      outcome,
      value: {
        type: readString(loaded["type"], "load.value.type"),
        ownPropertyNames:
          loaded["ownPropertyNames"] === null
            ? null
            : readStrings(
                loaded["ownPropertyNames"],
                "load.value.ownPropertyNames",
              ),
      },
    };
  }
  if (outcome === "failed") {
    const record = readRecord(value, "load", ["error", "outcome"]);
    return { outcome, error: readThrown(record["error"], "load.error") };
  }
  throw new ReportShapeError(
    `load's outcome ${JSON.stringify(outcome)} is neither "loaded" nor ` +
      `"failed"`,
  );
}

function readExit(value: unknown): { readonly code: number | null } {
  const record = readRecord(value, "exit", ["code"]);
  const code = record["code"];
  if (code !== null && (typeof code !== "number" || !Number.isInteger(code))) {
    throw new ReportShapeError(
      `exit.code ${JSON.stringify(code)} is no integer`,
    );
  }
  return { code };
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/** One run asked of the driver ({@link prepareModuleRun}). */
export interface ModuleRunRequest {
  /** The staging, placements made (helpers/module-channel.ts). */
  readonly staging: ModuleStaging;
  /** The placement the importing module's specifier reaches: N its name. */
  readonly placement: Placement;
  /** The route the run loads the module along. */
  readonly route: ModuleRoute;
  /** The release the run loads it on (helpers/node-releases.ts). */
  readonly release: NodeRelease;
  /**
   * The importing file's place: a staging-relative directory, along its
   * physical path — the placement's holding directory unless given.
   */
  readonly importingDir?: string;
  /** The project kind the staging declares, confirmed by Reach where given. */
  readonly project?: ProjectKind;
  /** Whether nothing but the placement is installed, confirmed where set. */
  readonly alone?: boolean;
  /**
   * The run's guards: {@link MODULE_RUN_TIMEOUT_MS} and the subprocess
   * driver's capture limit unless given. Registered bodies never pass them;
   * a self-test's stand-in may lower them.
   */
  readonly guards?: RunGuards;
  /** Leads every diagnosis: the arm the run serves. */
  readonly context: string;
}

/**
 * What a run came to (module header): the route's load handed back a value
 * (`loaded`) or threw (`load-failed`); the process exited before either, or
 * the bootstrap's own flow failed (`incomplete`); it left no report
 * (`no-report`); or its report is malformed (`malformed-report`).
 */
export type ModuleRunOutcome =
  "loaded" | "load-failed" | "incomplete" | "no-report" | "malformed-report";

/** A finished run ({@link PreparedModuleRun.launch}). */
export interface ModuleRun {
  /** The run, in words, leading its diagnoses. */
  readonly description: string;
  readonly route: ModuleRoute;
  readonly release: NodeRelease;
  /** The placement its importing module's specifier reached. */
  readonly placement: Placement;
  /** The importing module, absolute and physical. */
  readonly importingModule: string;
  /** The run's working directory, `HOME`, and `TMPDIR`. */
  readonly cwd: string;
  readonly home: string;
  readonly tmp: string;
  /** The environment the run was given, exactly. */
  readonly environment: Readonly<Record<string, string>>;
  /** The process's exit code, signal, and both streams. */
  readonly result: RunResult;
  readonly outcome: ModuleRunOutcome;
  /** The decoded report; undefined for `no-report` and `malformed-report`. */
  readonly report: ModuleRunReport | undefined;
  /** What makes the report malformed, for `malformed-report`. */
  readonly reportProblem: string | undefined;
}

/** A run whose module loaded and whose process exited 0 on its own. */
export interface LoadedModuleRun extends ModuleRun {
  readonly outcome: "loaded";
  readonly report: ModuleRunReport & {
    readonly load: Extract<LoadObservation, { readonly outcome: "loaded" }>;
    readonly importingModule: ImportingModuleNote;
  };
}

/**
 * Whom a run's failure to load is charged to (module header): the product,
 * for a test's run — a diagnosed failure — or the harness, for a stand-in
 * it expected to load — a harness error.
 */
export type RunAttribution = "product" | "stand-in";

/**
 * Prepare one run (module header): the importing module written in its
 * place (or found byte-equal there), and the run's own directory made —
 * its bootstrap, and its fresh `HOME`, `TMPDIR`, and working directory.
 * Nothing runs yet: a caller may stage more in those directories before
 * {@link PreparedModuleRun.launch}, and disposes of the run once done.
 */
export async function prepareModuleRun(
  request: ModuleRunRequest,
): Promise<PreparedModuleRun> {
  return PreparedModuleRun.prepare(request);
}

/**
 * One run, start to end ({@link prepareModuleRun}, then
 * {@link PreparedModuleRun.launch}), its own directory removed afterwards
 * however it ended.
 */
export async function runModuleRoute(
  request: ModuleRunRequest,
): Promise<ModuleRun> {
  const prepared = await prepareModuleRun(request);
  try {
    return await prepared.launch();
  } finally {
    await prepared.dispose();
  }
}

/** A prepared run ({@link prepareModuleRun}): launched once, then disposed of. */
export class PreparedModuleRun {
  readonly staging: ModuleStaging;
  readonly placement: Placement;
  readonly route: ModuleRoute;
  readonly release: NodeRelease;
  /** The importing module, staging-relative. */
  readonly importingFile: string;
  /** The importing module, absolute and physical. */
  readonly importingModule: string;
  /** The run's own directory, absolute and physical. */
  readonly root: string;
  /** The run's fresh `HOME`, `TMPDIR`, and working directory. */
  readonly home: string;
  readonly tmp: string;
  readonly cwd: string;
  /** The bootstrap's copy, and the report's path. */
  readonly bootstrap: string;
  readonly reportPath: string;
  /** The run's environment, exactly ({@link moduleRunEnvironment}). */
  readonly environment: Readonly<Record<string, string>>;
  /** The run, in words, leading its diagnoses. */
  readonly description: string;
  readonly #reach: ReachStaging;
  readonly #guards: RunGuards;
  #launched = false;
  #disposed = false;

  private constructor(
    request: ModuleRunRequest,
    importingFile: string,
    root: string,
  ) {
    this.staging = request.staging;
    this.placement = request.placement;
    this.route = request.route;
    this.release = request.release;
    this.importingFile = importingFile;
    this.importingModule = request.staging.path(importingFile);
    this.root = root;
    this.home = path.join(root, HOME_NAME);
    this.tmp = path.join(root, TMPDIR_NAME);
    this.cwd = path.join(root, WORK_NAME);
    this.bootstrap = path.join(root, BOOTSTRAP_NAME);
    this.reportPath = path.join(root, REPORT_NAME);
    this.environment = moduleRunEnvironment(this.home, this.tmp);
    this.description =
      `${request.context}: the Node.js release ${request.release.version} ` +
      `loading ${request.placement.name} along ` +
      `${describeRoute(request.route)} from ${this.importingModule}`;
    this.#reach = {
      importingFile,
      placement: request.placement,
      ...(request.project === undefined ? {} : { project: request.project }),
      ...(request.alone === undefined ? {} : { alone: request.alone }),
    };
    this.#guards = request.guards ?? {};
  }

  /** See {@link prepareModuleRun}. */
  static async prepare(request: ModuleRunRequest): Promise<PreparedModuleRun> {
    const { staging, placement, route } = request;
    const importingDir =
      request.importingDir ??
      path
        .relative(staging.root, placement.holdingDir)
        .split(path.sep)
        .join("/");
    const name = importingModuleName(route);
    const importingFile =
      importingDir === "" || importingDir === "."
        ? name
        : `${importingDir}/${name}`;
    await writeImportingModule(
      staging,
      importingFile,
      importingModuleText(route, placement.name),
      request.context,
    );
    const root = await makeRunDirectory(request.context);
    try {
      const prepared = new PreparedModuleRun(request, importingFile, root);
      await guardStep(
        `making the run directories and the bootstrap under ${root} ` +
          `(${request.context})`,
        async () => {
          for (const directory of [prepared.home, prepared.tmp, prepared.cwd]) {
            await fsp.mkdir(directory);
          }
          await fsp.writeFile(
            prepared.bootstrap,
            await fsp.readFile(BOOTSTRAP_SOURCE),
            {
              flag: "wx",
            },
          );
        },
      );
      return prepared;
    } catch (error) {
      await removeRunDirectory(root, request.context);
      throw error;
    }
  }

  /**
   * Run it (module header): Reach and H-1 verified first, under the run's
   * exact environment, working directory, and executable; then the release
   * run through the subprocess driver under the run's own guard; then its
   * report read, decoded, and its conditions checked. Resolves with the run
   * whatever its outcome; rejects with the hang-guard kill, any other
   * rejection of the run's spawn, an unmet staging precondition
   * (`HarnessStagingError`), or a breach of the run's conditions (a harness
   * error).
   */
  async launch(): Promise<ModuleRun> {
    if (this.#launched || this.#disposed) {
      throw new Error(
        `module channel: a prepared run launches once, before it is ` +
          `disposed of (${this.description})`,
      );
    }
    this.#launched = true;
    await this.staging.verifyReach(this.#reach);
    const binding = releaseBinding(this.release);
    const overrides = exactEnvironmentOverrides(binding, this.environment);
    const spawnedWith = productEnvironment(binding, overrides);
    if (!sameEnvironment(spawnedWith, this.environment)) {
      throw new Error(
        `harness error (H-11): ${this.description}: the run would be ` +
          `spawned with the environment ${describeEnvironment(spawnedWith)}, ` +
          `not exactly ${describeEnvironment(this.environment)}`,
      );
    }
    await this.staging.verifyIsolation({
      environment: spawnedWith,
      cwd: this.cwd,
      executables: [this.release.executable],
    });
    const executable = await guardStep(
      `reading the physical path of ${this.release.executable} ` +
        `(${this.description})`,
      () => fsp.realpath(this.release.executable),
    );
    if ((await readReportBytes(this.reportPath, this.description)) !== null) {
      throw new Error(
        `harness error (H-11): ${this.description}: the report path ` +
          `${this.reportPath} is occupied before the run`,
      );
    }
    const result = await runProduct(binding, {
      cwd: this.cwd,
      argv: [this.bootstrap, this.importingModule, this.reportPath, this.route],
      env: overrides,
      timeoutMs: this.#guards.timeoutMs ?? MODULE_RUN_TIMEOUT_MS,
      ...(this.#guards.maxOutputBytes === undefined
        ? {}
        : { maxOutputBytes: this.#guards.maxOutputBytes }),
    });
    const bytes = await readReportBytes(this.reportPath, this.description);
    const decoding =
      bytes === null
        ? null
        : guardSyncStep(`decoding the report of ${this.description}`, () =>
            decodeModuleRunReport(bytes),
          );
    const base = {
      description: this.description,
      route: this.route,
      release: this.release,
      placement: this.placement,
      importingModule: this.importingModule,
      cwd: this.cwd,
      home: this.home,
      tmp: this.tmp,
      environment: this.environment,
      result,
    };
    if (decoding === null) {
      return {
        ...base,
        outcome: "no-report",
        report: undefined,
        reportProblem: undefined,
      };
    }
    if (!decoding.ok) {
      return {
        ...base,
        outcome: "malformed-report",
        report: undefined,
        reportProblem: decoding.problem,
      };
    }
    const report = decoding.report;
    this.#confirmConditions(report, executable);
    let outcome: ModuleRunOutcome;
    if (report.phase !== "completed" || report.load === null) {
      outcome = "incomplete";
    } else {
      outcome = report.load.outcome === "loaded" ? "loaded" : "load-failed";
    }
    return { ...base, outcome, report, reportProblem: undefined };
  }

  /** Remove the run's own directory; idempotent. */
  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await removeRunDirectory(this.root, this.description);
  }

  /**
   * The run's conditions (module header), on a report that decodes: a
   * breach is a harness error, every one of them set before anything of
   * the package loaded.
   */
  #confirmConditions(report: ModuleRunReport, executable: string): void {
    const breaches: string[] = [];
    const argv = [
      this.bootstrap,
      this.importingModule,
      this.reportPath,
      this.route,
    ];
    if (
      report.argv.length !== argv.length ||
      report.argv.some((argument, index) => argument !== argv[index])
    ) {
      breaches.push(
        `its arguments ${JSON.stringify(report.argv)} are not those passed, ` +
          JSON.stringify(argv),
      );
    }
    if (report.release.version !== `v${this.release.version}`) {
      breaches.push(
        `the release in effect reports ${report.release.version}, not ` +
          `v${this.release.version} (TEST-SPEC E-1, S-10)`,
      );
    }
    if (report.release.execPath !== executable) {
      breaches.push(
        `the running executable is ${report.release.execPath}, not ` +
          `${executable}, the provisioned release's physical path`,
      );
    }
    if (report.release.execArgv.length > 0) {
      breaches.push(
        `the run carries the options ${JSON.stringify(report.release.execArgv)}` +
          ` (TEST-SPEC T7.6-6: run with no option)`,
      );
    }
    if (!sameEnvironment(report.environment, this.environment)) {
      breaches.push(
        `the run's environment is ${describeEnvironment(report.environment)}, ` +
          `not exactly ${describeEnvironment(this.environment)} (TEST-SPEC ` +
          `T7.6-6: no environment variable, NODE_OPTIONS and NODE_PATH among ` +
          `them; T7.6-7: a fresh HOME and TMPDIR)`,
      );
    }
    if (report.cwd !== this.cwd) {
      breaches.push(
        `the run's working directory is ${report.cwd}, not ${this.cwd}`,
      );
    }
    const note = report.importingModule;
    if (note !== null) {
      const kind = importingModuleKind(this.route);
      const topLevelThis = kind === "module" ? "undefined" : "object";
      const location =
        kind === "module"
          ? pathToFileURL(this.importingModule).href
          : this.importingModule;
      if (note.topLevelThis !== topLevelThis || note.location !== location) {
        breaches.push(
          `the importing module reports its top-level this as ` +
            `${JSON.stringify(note.topLevelThis)} and its location as ` +
            `${JSON.stringify(note.location)}, where ${describeRoute(this.route)} ` +
            `runs one whose top-level this is ${JSON.stringify(topLevelThis)}, ` +
            `at ${JSON.stringify(location)}`,
        );
      }
    }
    if (breaches.length > 0) {
      throw new Error(
        `harness error (H-11): ${this.description}: the run's conditions ` +
          `were not those the harness set — ${breaches.join("; ")}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

/**
 * What keeps `run` from being a loaded run that exited 0 on its own, in
 * words, or null where nothing does.
 */
export function moduleRunProblem(run: ModuleRun): string | null {
  const ended = describeEnding(run.result);
  switch (run.outcome) {
    case "no-report":
      return `left no report: the process ${ended}`;
    case "malformed-report":
      return (
        `left a malformed report (${run.reportProblem ?? "unknown"}): the ` +
        `process ${ended}`
      );
    case "incomplete": {
      const own = run.report?.bootstrapError;
      return own !== null && own !== undefined
        ? `failed in the harness's own bootstrap (${describeThrown(own)}): ` +
            `the process ${ended}`
        : `ended before the load completed or failed: the process ${ended}`;
    }
    case "load-failed": {
      const load = run.report?.load;
      const thrown =
        load !== undefined && load !== null && load.outcome === "failed"
          ? describeThrown(load.error)
          : "unknown";
      return `did not load the module — the load threw ${thrown}; the process ${ended}`;
    }
    case "loaded":
      return run.result.exitCode === 0 && run.result.signal === null
        ? null
        : `loaded the module, but the process ${ended}, not with exit code 0 ` +
            `on its own`;
  }
}

/**
 * Require `run` to have loaded the module and exited 0 on its own (module
 * header): otherwise a diagnosed failure for `"product"`, a harness error
 * for `"stand-in"`, naming the run, what it came to, and its streams.
 */
export function assertModuleLoaded(
  run: ModuleRun,
  attribution: RunAttribution,
): LoadedModuleRun {
  const problem = moduleRunProblem(run);
  if (problem === null) return run as LoadedModuleRun;
  const diagnosis = `${run.description} ${problem}; ${describeStreams(run.result)}`;
  if (attribution === "product") {
    fail(
      `${diagnosis} (SPEC 7.6 Reach, Runtime: with the package installed ` +
        `under N, a specifier spelling exactly N designates the module along ` +
        `each of Node.js's routes, on every release, and loading it has no ` +
        `effect; TEST-SPEC T7.6-6, H-8)`,
    );
  }
  throw new Error(
    `harness error (H-11): ${diagnosis} — a stand-in the harness expected ` +
      `to load did not, so the driver's runs are not what they claim`,
  );
}

/** How a run's process ended, in words. */
function describeEnding(result: RunResult): string {
  return result.signal === null
    ? `exited with code ${String(result.exitCode)}`
    : `was killed by ${result.signal}`;
}

/** A run's streams, quoted for a diagnosis. */
function describeStreams(result: RunResult): string {
  return (
    `standard output ${quoteStream(result.stdout)}, standard error ` +
    quoteStream(result.stderr)
  );
}

function quoteStream(text: string): string {
  return text.length > QUOTED_STREAM_LIMIT
    ? `${JSON.stringify(text.slice(0, QUOTED_STREAM_LIMIT))} (truncated)`
    : JSON.stringify(text);
}

/** A thrown value as the report gives it, in words. */
export function describeThrown(thrown: ThrownDescription): string {
  const parts: string[] = [];
  if (thrown.name !== null) parts.push(thrown.name);
  if (thrown.code !== null) parts.push(`[${thrown.code}]`);
  const head =
    parts.length === 0 ? `a value of type ${thrown.type}` : parts.join(" ");
  return thrown.message === null
    ? head
    : `${head}: ${JSON.stringify(thrown.message)}`;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * Write the importing module at `importingFile`, or find it there already,
 * byte-equal (module header); any other occupant is a `HarnessStagingError`.
 * A preparation writing the same file meanwhile is found byte-equal
 * likewise once its write is whole; one caught mid-write is refused, so
 * the runs of one route in one directory are prepared one after another
 * (their launches may overlap).
 */
async function writeImportingModule(
  staging: ModuleStaging,
  importingFile: string,
  text: string,
  context: string,
): Promise<void> {
  const target = staging.path(importingFile);
  if ((await readImportingModule(target, context)) === "absent") {
    try {
      await staging.writeFile(importingFile, text);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code !== "EEXIST") {
        throw error;
      }
    }
  }
  const existing = await readImportingModule(target, context);
  if (
    existing === "absent" ||
    existing === "other" ||
    !existing.equals(Buffer.from(text))
  ) {
    throw new HarnessStagingError(
      MODE,
      target,
      `${context}: the importing module's place ${target} is occupied by ` +
        `something other than the importing module its route writes there ` +
        `(TEST-SPEC T7.6-6: a harness-written importing module in the ` +
        `importing file's place)`,
    );
  }
}

/** What occupies an importing module's place: its bytes, if a plain file. */
async function readImportingModule(
  target: string,
  context: string,
): Promise<Buffer | "absent" | "other"> {
  return guardStep(
    `reading what occupies ${target} (${context})`,
    async (): Promise<Buffer | "absent" | "other"> => {
      try {
        const stats = await fsp.lstat(target);
        return stats.isFile() ? await fsp.readFile(target) : "other";
      } catch (error) {
        if (isAbsence(error)) return "absent";
        throw error;
      }
    },
  );
}

/** A fresh run directory under the OS temporary directory, physical. */
async function makeRunDirectory(context: string): Promise<string> {
  const made = await guardStep(
    `creating a run directory under ${os.tmpdir()} (${context})`,
    () => fsp.mkdtemp(path.join(os.tmpdir(), MODULE_RUN_PREFIX)),
  );
  try {
    return await guardStep(
      `reading the physical path of the run directory ${made} (${context})`,
      () => fsp.realpath(made),
    );
  } catch (error) {
    await removeRunDirectory(made, context);
    throw error;
  }
}

/** Remove a run directory, a directory the run made unwritable first made writable. */
async function removeRunDirectory(
  directory: string,
  context: string,
): Promise<void> {
  await guardStep(
    `removing the run directory ${directory} (${context})`,
    async () => {
      try {
        await fsp.rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 2,
        });
      } catch {
        await makeDirectoriesWritable(directory);
        await fsp.rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 2,
        });
      }
    },
  );
}

/** Best-effort: give every directory under `directory` owner access. */
async function makeDirectoriesWritable(directory: string): Promise<void> {
  await fsp.chmod(directory, 0o700).catch(() => undefined);
  const entries = await fsp
    .readdir(directory, { withFileTypes: true })
    .catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await makeDirectoriesWritable(path.join(directory, entry.name));
    }
  }
}

/**
 * The report's bytes, or null where none was written. Anything at the path
 * but a plain file is no report either: it is never opened.
 */
async function readReportBytes(
  reportPath: string,
  description: string,
): Promise<Buffer | null> {
  return guardStep(`reading the report of ${description}`, async () => {
    try {
      const stats = await fsp.lstat(reportPath);
      return stats.isFile() ? await fsp.readFile(reportPath) : null;
    } catch (error) {
      if (isAbsence(error)) return null;
      throw error;
    }
  });
}

function isAbsence(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOENT";
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return typeof code === "string"
      ? `${code}: ${error.message}`
      : `${error.name}: ${error.message}`;
  }
  return String(error);
}
