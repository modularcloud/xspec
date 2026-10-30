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
//   `HOME`, and `TMPDIR` (a run asked to observe its effects, below). The
//   report lies outside all four. The directory is removed when the run is
//   disposed of; a caller staging more for a run does so between
//   `prepareModuleRun` and `PreparedModuleRun.launch`, then disposes of it.
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
//   and T7.6-6's calls have completed, or the load has failed, and again as
//   the process exits, each time whole (a sibling file renamed over it).
//   Its members are read exactly: the protocol, the arguments as the run
//   saw them, the release's version, executable, and options, the process
//   identifier, the environment, the working directory, the phase reached
//   (`loading`, `calling`, `completed`), the importing module's note of its
//   kind and location, the load's outcome (the loaded value's type and own
//   keys — each key's kind, name, and enumerability — or the error the load
//   threw: its type, name, code, message, and stack), T7.6-6's calls
//   (below), T7.6-7(c)'s comparison of the process state (below; present
//   exactly where the module loaded and the phase completed), a failure of
//   the bootstrap's own, each warning delivered (its type, name, code,
//   message, detail, and stack), and the exit code the `exit` listener saw.
//   Anything else — absent members, an extra one, a value of another kind,
//   members inconsistent with the phase, calls out of `CALL_CASES`' order,
//   an observation of its own, bytes that are no UTF-8 JSON — is a
//   malformed report: H-3's rule, failing loudly, never a pass.
// - The run's conditions, checked on every report that decodes (S-10 pins
//   them on stand-ins): the arguments round-trip exactly as passed; the
//   release in effect is the one provisioned (`process.version` and
//   `process.execPath`, the executable's physical path); the run carries no
//   option (`process.execArgv` empty); its environment is exactly the one
//   set; its working directory is the run's; where the module loaded, the
//   importing module ran as its route's kind, from its physical path; and,
//   where the state was compared, it observed the global object, `process`,
//   and ECMAScript's global constructors and namespace objects with each
//   constructor's prototype (`REQUIRED_STATE_SUBJECTS`), so that no
//   comparison passes over an empty set. A breach is a harness error
//   (H-11): the harness sets every one of them before anything of the
//   package loads.
// - Outcomes (`ModuleRunOutcome`): `loaded`, the route's load handed back a
//   value; `load-failed`, it threw (a stub package's missing entry, an
//   ES-module-only package along `require` on a release before 22.12.0);
//   `incomplete`, the process exited before the load completed or failed
//   (`process.exit` while loading, an uncaught exception, an unsettled
//   top-level `await`) or during T7.6-6's calls, or the bootstrap's own
//   flow failed; `no-report`,
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
// - T7.6-6's observations, made inside the run by the bootstrap once the
//   load has handed back a value (its header), and read here as problems
//   in words, each led by the run's description, none thrown, so that a
//   test may run every arm and fail once naming each:
//   (a) `exportsProblems`: the route's listing from the loaded value's own
//       keys — an `import` namespace's string-keyed properties exactly
//       `defineConfig` (a CommonJS-only entry's namespace, carrying
//       `default`, fails), a `require` result's enumerable properties,
//       string- and symbol-keyed alike, exactly `defineConfig` (an
//       enumerable `__esModule` fails);
//   (b) `identityProblems`: `defineConfig`, read once from the loaded
//       value, a function, and each identity case of `CALL_CASES` — every
//       value T7.6-6 names, no argument, a further argument — returning
//       what it must, compared by `Object.is` inside the run;
//   (c) `examinationProblems`: the call with two recording Proxies over
//       functions returning the first, no trap of either invoked through
//       the run's end, and the call with a frozen object returning it
//       without a throw.
// - Pairing (§7.6; `pairingProblem`): each absence a runtime arm asserts
//   counts only where the same run loaded the module and saw `defineConfig`
//   return its argument — here, in every one of T7.6-6's calls, the
//   conservative reading — so a missing or stub package fails every arm.
// - The output oracle (T7.6-7(a); `outputProblems`, `runtimeOutputProblems`):
//   standard output empty, and standard error, byte for byte, exactly the
//   release's printed forms of the warnings the bootstrap's listener
//   captured, in order (`renderWarnings`): each `(node:<pid>) `, its
//   bracketed code and a space where it carries a non-empty one, its type
//   and message as the release joins them (`<type>: <message>`, either
//   alone where the other is empty), a line feed and its detail where it
//   carries one, the first warning followed by a line feed and the hint
//   line the release appends to it, and each ended by a line feed; and no
//   captured warning's stack beginning in the package's files, its first
//   frame (`warningFirstFrame`: the first line after the stack's head that
//   is a frame) naming a path under the placement or its copy, by path or
//   file URL (`packageFrame`). A warning the oracle cannot render — no
//   object whose name and message are strings, which the runtime's own
//   warnings always are — fails it. Each release's printed form is learned
//   from the release itself (`learnWarningForm`, once per release in a
//   process): a calibration script (helpers/module-channel-warning-
//   calibration.cjs, harness code beside the bootstrap) run on the release
//   as a module run is — copied into a fresh directory of its own, through
//   the subprocess driver under the run's guard, with a fresh `HOME` and
//   `TMPDIR`, the harness's `PATH`, and no option — emits known warnings
//   through `process.emitWarning` in three runs, a warning of a type of
//   its own first, a `DeprecationWarning` first, and an
//   `ExperimentalWarning` first, which between them carry and lack a code
//   and a detail and span lines in their messages and details. The hint
//   lines are read off the release's standard error after the first
//   warning's form (the release appends one hint to a first deprecation
//   and another to any other first warning), and the whole of each run's
//   standard error must then render exactly from its captured warnings, so
//   a release printing a warning in any other form — the separators and
//   the line structure above included — fails the calibration as a harness
//   error naming the release, never a verdict.
// - T7.6-7(c), process state (`stateProblems`): observed in every run, by
//   the bootstrap (its header) — the state read once to settle what the
//   runtime materializes on a first read, then as the baseline, both after
//   the `warning` and `exit` listeners are registered and before the
//   importing module's own loading begins, and again once T7.6-6's calls
//   are made, compared in the run, each difference recorded under the
//   observation that found it (`STATE_OBSERVATIONS`): the global object's
//   own properties with their descriptors, read without invoking accessors
//   (`global-object`); the own properties of the built-ins — every
//   string-keyed own data property of the global object holding an object
//   or a function, ECMAScript's constructors and namespace objects and the
//   runtime's own among them, a superset of TEST-SPEC's "global built-in
//   constructors and namespace objects", and each such function's own
//   prototype (`built-ins`); the extensibility and the prototype of each of
//   them, the global object and `process` included (`extensibility`,
//   `prototype`); `process`'s own properties with their descriptors
//   (`process`); `process.env` (`environment`); the process title
//   (`title`); the working directory (`working-directory`);
//   `process.exitCode` (`exit-code`); the `write` each of `process.stdout`
//   and `process.stderr` resolves to (`stream-write`); the listeners
//   registered on `process` (`listeners`); and the runtime's active handles
//   and pending timers and immediates — never its pending requests, which
//   its own loading leaves in flight (`timers-and-handles`). None may
//   differ. No probe found the runtime's own loading changing any of them,
//   on any of E-1's releases and routes, its own warnings printed included
//   (S-10 pins it on stand-ins).
// - T7.6-7(b) and (e), writes and FIFOs (`writeProblems`, `fifoProblems`):
//   observed in a run asked to (`ModuleRunRequest.effects`). Before it is
//   launched, a FIFO named `xspec.config.ts` is staged in the run's working
//   directory, in the importing module's directory (in the staging, staged
//   once and found there by a later run), and in its `HOME`
//   (helpers/lock-staging.ts `stageFifo`: `mkfifo` beside, then a hard link,
//   read back as a FIFO of its mode, never opened); then each of the four
//   places — the staging, the placement included, the working directory,
//   `HOME`, and `TMPDIR` — is snapshotted (`snapshotPlace`): every entry
//   under it and the place itself, by its kind — a plain file with its
//   bytes, a directory, a symbolic link with its target, never followed,
//   and a FIFO, a socket, or a device by its kind alone, never opened (S-3)
//   — a read the entry's mode refuses recorded as such. Once the run ends,
//   each place is snapshotted again and compared entry by entry
//   (`comparePlaceSnapshots`: an entry created, removed, or modified — its
//   kind, a plain file's bytes, a link's target), and each FIFO's path is
//   read back, still a FIFO or not. A dedicated walk, not
//   helpers/snapshot.ts's, names every kind (a FIFO turned into a socket is
//   a change there) and records a refused read instead of throwing, and no
//   lock path is left out: no product command runs here. That a FIFO stayed
//   unopened is observed by the run's promptness — a reader opening a FIFO
//   no writer holds blocks, so a run that opens one ends at its guard
//   (S-3), its kill propagating unchanged — as the rest of the harness
//   observes it (helpers/lock-staging.ts); no test observes a system call.
//   Such a run compares the whole staging: while it is launched, the
//   driver refuses to write into that staging for another run (an
//   importing module, a FIFO) as a usage error, so prepare every run of a
//   staging before launching one that observes its effects, or run them
//   one after another.
// - T7.6-7(d), network: every run is network-denied by the environment it
//   inherits, as every product invocation is — CI's Linux jobs run inside
//   `.github/scripts/run-without-network.sh` (E-1) — so an attempted access
//   fails rather than reaching a network; nothing here observes it.
// - Each of T7.6-7's absences counts only under the pairing above:
//   `stateProblems`, `writeProblems`, and `fifoProblems` each report
//   `pairingProblem` first, as `outputProblems` does.
// - Every examination and write here is a harness step under its own guard
//   (helpers/step-guards.ts); the run itself is a product invocation under
//   its own (S-3). E-1 exercises the releases on the Linux leg alone, and
//   this driver serves POSIX paths alone.

import { Buffer } from "node:buffer";
import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bytesEqual, describeByteDifference, fail } from "./assertions.js";
import { stageFifo } from "./lock-staging.js";
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
import { displaySnapshotPath } from "./snapshot.js";
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
export const MODULE_RUN_PROTOCOL = "xspec-module-run/3";

/** The name of each of T7.6-7(e)'s FIFOs (module header). */
export const RUN_FIFO_NAME = "xspec.config.ts";

/** The prefix of each warning calibration's directory (module header). */
export const WARNING_CALIBRATION_PREFIX = "xspec-warning-calibration-";

/** The protocol the calibration's report names, which its decoder requires. */
export const WARNING_CALIBRATION_PROTOCOL = "xspec-warning-calibration/1";

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

/** The warning calibration, harness code beside this module (module header). */
const CALIBRATION_SOURCE = fileURLToPath(
  new URL("./module-channel-warning-calibration.cjs", import.meta.url),
);

/** The names in a run's own directory (module header). */
const CALIBRATION_NAME = "calibration.cjs";
const BOOTSTRAP_NAME = "bootstrap.cjs";
const REPORT_NAME = "report.json";
const HOME_NAME = "home";
const TMPDIR_NAME = "tmp";
const WORK_NAME = "work";

const LF = String.fromCodePoint(0x0a);

/** `/`, joining the names of a snapshot key's path (module header). */
const SLASH_BYTES = Buffer.from([0x2f]);

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

/** One own key of a loaded value, as the bootstrap lists it. */
export interface OwnKey {
  readonly kind: "string" | "symbol";
  /** The key itself, or a symbol's description (null where it has none). */
  readonly name: string | null;
  /** Whether its descriptor is enumerable; null where none could be read. */
  readonly enumerable: boolean | null;
}

/** What the route's load handed back, or what it threw. */
export type LoadObservation =
  | {
      readonly outcome: "loaded";
      readonly value: {
        /** `typeof` the loaded value, `null` reading as "null". */
        readonly type: string;
        /**
         * Its own keys in their own order, where it is an object or a
         * function whose keys could be listed; null otherwise.
         */
        readonly ownKeys: readonly OwnKey[] | null;
      };
    }
  | { readonly outcome: "failed"; readonly error: ThrownDescription };

/**
 * T7.6-6's calls, in the order the bootstrap makes them (its header): an
 * object, an array, a function, a symbol, `null`, `undefined` passed
 * explicitly, a string, a boolean, a bigint, `0`, `-0`, and `NaN`, each
 * returning itself; no argument, returning `undefined`; a further
 * argument, returning the first; two recording Proxies, returning the
 * first; and a frozen object, returning itself.
 */
export const CALL_CASES = Object.freeze([
  "object",
  "array",
  "function",
  "symbol",
  "null",
  "undefined",
  "string",
  "boolean",
  "bigint",
  "zero",
  "negative-zero",
  "nan",
  "no-argument",
  "further-arguments",
  "proxies",
  "frozen",
] as const);

/** One of T7.6-6's calls. */
export type CallCase = (typeof CALL_CASES)[number];

/** T7.6-6(b)'s calls: each but (c)'s Proxies and frozen object. */
export const IDENTITY_CASES: readonly CallCase[] = Object.freeze(
  CALL_CASES.filter((name) => name !== "proxies" && name !== "frozen"),
);

/** Every trap a Proxy handler can carry, each recorded by the bootstrap's. */
export const PROXY_TRAPS = Object.freeze([
  "apply",
  "construct",
  "defineProperty",
  "deleteProperty",
  "get",
  "getOwnPropertyDescriptor",
  "getPrototypeOf",
  "has",
  "isExtensible",
  "ownKeys",
  "preventExtensions",
  "set",
  "setPrototypeOf",
] as const);

/** One trap a Proxy handler can carry. */
export type ProxyTrap = (typeof PROXY_TRAPS)[number];

/** A value a call returned in place of its own. */
export interface ReturnedValue {
  /** `typeof` it, `null` reading as "null". */
  readonly type: string;
  /** A primitive's text, or a harness value's name; null otherwise. */
  readonly text: string | null;
}

/** The verdict of one of T7.6-6's calls, reached by `Object.is` in the run. */
export type CallOutcome = "returned-argument" | "returned-other" | "threw";

/** One of T7.6-6's calls, as the bootstrap made it. */
export interface CallResult {
  readonly case: CallCase;
  readonly outcome: CallOutcome;
  /** For `returned-other`, what it returned; null otherwise. */
  readonly returned: ReturnedValue | null;
  /** For `threw`, what it threw; null otherwise. */
  readonly thrown: ThrownDescription | null;
}

/** One trap a recording Proxy's handler ran. */
export interface TrapInvocation {
  readonly proxy: "first" | "second";
  readonly trap: ProxyTrap;
}

/** How reading `defineConfig` from the loaded value went: one of the two. */
export interface DefineConfigReading {
  /** `typeof` the value read, `null` reading as "null"; null if it threw. */
  readonly type: string | null;
  readonly thrown: ThrownDescription | null;
}

/** T7.6-6's calls, as the bootstrap made them (its header). */
export interface CallsObservation {
  /** The read of `defineConfig`; null while it was unfinished. */
  readonly reading: DefineConfigReading | null;
  /** Each call made, in `CALL_CASES`' order: all of them, once completed. */
  readonly results: readonly CallResult[];
  /** Each trap either Proxy's handler ran, in order, through the run's end. */
  readonly traps: readonly TrapInvocation[];
}

/** The importing module's note of its own kind and location. */
export interface ImportingModuleNote {
  /** `typeof this` at its top level: "undefined" in an ES module. */
  readonly topLevelThis: string | null;
  /** `import.meta.url` in an ES module, `__filename` in a CommonJS one. */
  readonly location: string | null;
}

/**
 * T7.6-7(c)'s observations (module header; the bootstrap's header), each
 * the name the bootstrap records a difference under.
 */
export const STATE_OBSERVATIONS = Object.freeze([
  "global-object",
  "built-ins",
  "extensibility",
  "prototype",
  "process",
  "environment",
  "title",
  "working-directory",
  "exit-code",
  "stream-write",
  "listeners",
  "timers-and-handles",
] as const);

/** One of T7.6-7(c)'s observations. */
export type StateObservationName = (typeof STATE_OBSERVATIONS)[number];

/** One difference the bootstrap found in the process state. */
export interface StateChange {
  /** The observation that found it. */
  readonly observation: StateObservationName;
  /**
   * What differs: an observed object by its label ("the global object",
   * "Array", "Array.prototype", "process"), or another observation's
   * subject ("process.env", "process.stdout.write", ...).
   */
  readonly subject: string;
  /** How it differs, in words. */
  readonly detail: string;
}

/** T7.6-7(c)'s comparison, as the bootstrap made it (its header). */
export interface StateObservation {
  /** The labels of the objects observed: the global object, each built-in, `process`. */
  readonly subjects: readonly string[];
  /** Each difference listed, at most the bootstrap's limit. */
  readonly changes: readonly StateChange[];
  /** How many differences were found beyond those listed. */
  readonly omitted: number;
}

/** ECMAScript's global namespace objects: ECMA-262's, and ECMA-402's `Intl`. */
const ECMASCRIPT_NAMESPACES = ["Atomics", "Intl", "JSON", "Math", "Reflect"];

/**
 * ECMAScript's global constructors (ECMA-262's, `Iterator` among them),
 * each of which every one of E-1's releases holds as a data property.
 */
const ECMASCRIPT_CONSTRUCTORS = [
  "AggregateError",
  "Array",
  "ArrayBuffer",
  "BigInt",
  "BigInt64Array",
  "BigUint64Array",
  "Boolean",
  "DataView",
  "Date",
  "Error",
  "EvalError",
  "FinalizationRegistry",
  "Float32Array",
  "Float64Array",
  "Function",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Iterator",
  "Map",
  "Number",
  "Object",
  "Promise",
  "Proxy",
  "RangeError",
  "ReferenceError",
  "RegExp",
  "Set",
  "SharedArrayBuffer",
  "String",
  "Symbol",
  "SyntaxError",
  "TypeError",
  "Uint8Array",
  "Uint8ClampedArray",
  "Uint16Array",
  "Uint32Array",
  "URIError",
  "WeakMap",
  "WeakRef",
  "WeakSet",
];

/**
 * The labels every compared state must have observed (module header): the
 * global object, `process`, ECMAScript's global namespace objects and
 * constructors, and each constructor's prototype, `Proxy` (which has none)
 * aside.
 */
export const REQUIRED_STATE_SUBJECTS: readonly string[] = Object.freeze([
  "the global object",
  "process",
  ...ECMASCRIPT_NAMESPACES,
  ...ECMASCRIPT_CONSTRUCTORS,
  ...ECMASCRIPT_CONSTRUCTORS.filter((name) => name !== "Proxy").map(
    (name) => `${name}.prototype`,
  ),
]);

/** How far a run got (module header). */
export type ModuleRunPhase = "loading" | "calling" | "completed";

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
  /**
   * `loading` until the load handed back a value or threw; `calling` while
   * T7.6-6's calls ran; `completed` once they, or a failed load, ended.
   */
  readonly phase: ModuleRunPhase;
  /** Where the module loaded: the importing module's note; null otherwise. */
  readonly importingModule: ImportingModuleNote | null;
  /** The load's outcome from the phase `calling` on; null before. */
  readonly load: LoadObservation | null;
  /** Where the module loaded: T7.6-6's calls; null otherwise. */
  readonly calls: CallsObservation | null;
  /**
   * Where the module loaded and the phase completed: T7.6-7(c)'s
   * comparison of the process state; null otherwise.
   */
  readonly state: StateObservation | null;
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
  "calls",
  "cwd",
  "environment",
  "exit",
  "importingModule",
  "load",
  "phase",
  "pid",
  "protocol",
  "release",
  "state",
  "warnings",
];
const RELEASE_MEMBERS = ["execArgv", "execPath", "version"];
const STATE_MEMBERS = ["changes", "omitted", "subjects"];
const STATE_CHANGE_MEMBERS = ["detail", "observation", "subject"];
const THROWN_MEMBERS = ["code", "message", "name", "stack", "type"];
const WARNING_MEMBERS = [...THROWN_MEMBERS, "detail"];
const NOTE_MEMBERS = ["location", "topLevelThis"];
const OWN_KEY_MEMBERS = ["enumerable", "kind", "name"];
const CALLS_MEMBERS = ["reading", "results", "traps"];
const READING_MEMBERS = ["thrown", "type"];
const RESULT_MEMBERS = ["case", "outcome", "returned", "thrown"];
const RETURNED_MEMBERS = ["text", "type"];
const TRAP_MEMBERS = ["proxy", "trap"];
const CALL_OUTCOMES: readonly CallOutcome[] = [
  "returned-argument",
  "returned-other",
  "threw",
];

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
  if (phase !== "loading" && phase !== "calling" && phase !== "completed") {
    throw new ReportShapeError(
      `its phase ${JSON.stringify(phase)} is none of "loading", "calling", ` +
        `and "completed"`,
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
    calls: record["calls"] === null ? null : readCalls(record["calls"]),
    state: record["state"] === null ? null : readState(record["state"]),
    bootstrapError:
      record["bootstrapError"] === null
        ? null
        : readThrown(record["bootstrapError"], "bootstrapError"),
    warnings: readArray(record["warnings"], "warnings").map((warning, index) =>
      readWarning(warning, `warnings[${String(index)}]`),
    ),
    exit: record["exit"] === null ? null : readExit(record["exit"]),
  };
  checkPhase(report);
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

/**
 * The members each phase holds (module header): `loading`, neither a load
 * outcome, calls, nor a state compared; `calling`, a loaded module and its
 * calls so far, no state compared yet; `completed`, a load outcome, no
 * failure of the bootstrap's own, and, for a loaded module, the state
 * compared, `defineConfig` read, and every call made where it is a
 * function, none otherwise.
 */
function checkPhase(report: ModuleRunReport): void {
  const loaded = report.load?.outcome === "loaded";
  switch (report.phase) {
    case "loading":
      if (
        report.load !== null ||
        report.calls !== null ||
        report.state !== null
      ) {
        throw new ReportShapeError(
          "it holds a load outcome, calls, or a state compared while still " +
            "in the phase loading",
        );
      }
      return;
    case "calling":
      if (!loaded || report.calls === null || report.state !== null) {
        throw new ReportShapeError(
          "it reached the phase calling without a loaded module and its " +
            "calls, or with a state compared",
        );
      }
      return;
    case "completed": {
      if (report.load === null || report.bootstrapError !== null) {
        throw new ReportShapeError(
          "it reached the phase completed without a load outcome, or with a " +
            "failure of the bootstrap's own",
        );
      }
      const calls = report.calls;
      if ((calls !== null) !== loaded) {
        throw new ReportShapeError(
          "it holds calls without a loaded module, or a loaded module " +
            "without calls",
        );
      }
      if ((report.state !== null) !== loaded) {
        throw new ReportShapeError(
          "it holds a state compared without a loaded module, or a loaded " +
            "module whose state was not compared",
        );
      }
      if (calls === null) return;
      const callable = calls.reading?.type === "function";
      if (
        calls.reading === null ||
        calls.results.length !== (callable ? CALL_CASES.length : 0)
      ) {
        throw new ReportShapeError(
          `it reached the phase completed with defineConfig unread, or with ` +
            `${String(calls.results.length)} calls made where ` +
            `${callable ? "all of them" : "none"} must be`,
        );
      }
      return;
    }
  }
}

function readCalls(value: unknown): CallsObservation {
  const record = readRecord(value, "calls", CALLS_MEMBERS);
  const reading =
    record["reading"] === null ? null : readReading(record["reading"]);
  const results = readArray(record["results"], "calls.results").map(
    (entry, index) => readCallResult(entry, `calls.results[${String(index)}]`),
  );
  const traps = readArray(record["traps"], "calls.traps").map((entry, index) =>
    readTrap(entry, `calls.traps[${String(index)}]`),
  );
  results.forEach((result, index) => {
    if (result.case !== CALL_CASES[index]) {
      throw new ReportShapeError(
        `calls.results[${String(index)}] is the call ` +
          `${JSON.stringify(result.case)}, where the bootstrap's order ` +
          `(CALL_CASES) puts ${JSON.stringify(CALL_CASES[index] ?? null)}`,
      );
    }
  });
  if (results.length > 0 && reading?.type !== "function") {
    throw new ReportShapeError(
      "calls.results holds calls made with no function read as defineConfig",
    );
  }
  return { reading, results, traps };
}

function readState(value: unknown): StateObservation {
  const record = readRecord(value, "state", STATE_MEMBERS);
  const omitted = record["omitted"];
  if (
    typeof omitted !== "number" ||
    !Number.isSafeInteger(omitted) ||
    omitted < 0
  ) {
    throw new ReportShapeError(
      `state.omitted ${JSON.stringify(omitted)} is no non-negative integer`,
    );
  }
  return {
    subjects: readStrings(record["subjects"], "state.subjects"),
    changes: readArray(record["changes"], "state.changes").map((entry, index) =>
      readStateChange(entry, `state.changes[${String(index)}]`),
    ),
    omitted,
  };
}

function readStateChange(value: unknown, where: string): StateChange {
  const record = readRecord(value, where, STATE_CHANGE_MEMBERS);
  const observation = record["observation"];
  if (!STATE_OBSERVATIONS.some((name) => name === observation)) {
    throw new ReportShapeError(
      `${where}.observation ${JSON.stringify(observation)} is none of ` +
        "STATE_OBSERVATIONS",
    );
  }
  return {
    observation: observation as StateObservationName,
    subject: readString(record["subject"], `${where}.subject`),
    detail: readString(record["detail"], `${where}.detail`),
  };
}

function readReading(value: unknown): DefineConfigReading {
  const record = readRecord(value, "calls.reading", READING_MEMBERS);
  const type = readNullableString(record["type"], "calls.reading.type");
  const thrown =
    record["thrown"] === null
      ? null
      : readThrown(record["thrown"], "calls.reading.thrown");
  if ((type === null) === (thrown === null)) {
    throw new ReportShapeError(
      "calls.reading holds both a type and a thrown value, or neither",
    );
  }
  return { type, thrown };
}

function readCallResult(value: unknown, where: string): CallResult {
  const record = readRecord(value, where, RESULT_MEMBERS);
  const callCase = record["case"];
  if (!CALL_CASES.some((name) => name === callCase)) {
    throw new ReportShapeError(
      `${where}.case ${JSON.stringify(callCase)} is none of CALL_CASES`,
    );
  }
  const outcome = record["outcome"];
  if (!CALL_OUTCOMES.some((name) => name === outcome)) {
    throw new ReportShapeError(
      `${where}.outcome ${JSON.stringify(outcome)} is none of ` +
        JSON.stringify(CALL_OUTCOMES),
    );
  }
  const returned =
    record["returned"] === null
      ? null
      : readReturned(record["returned"], `${where}.returned`);
  const thrown =
    record["thrown"] === null
      ? null
      : readThrown(record["thrown"], `${where}.thrown`);
  if (
    (returned !== null) !== (outcome === "returned-other") ||
    (thrown !== null) !== (outcome === "threw")
  ) {
    throw new ReportShapeError(
      `${where} holds a returned or thrown value its outcome ` +
        `${JSON.stringify(outcome)} does not, or lacks one it does`,
    );
  }
  return {
    case: callCase as CallCase,
    outcome: outcome as CallOutcome,
    returned,
    thrown,
  };
}

function readReturned(value: unknown, where: string): ReturnedValue {
  const record = readRecord(value, where, RETURNED_MEMBERS);
  return {
    type: readString(record["type"], `${where}.type`),
    text: readNullableString(record["text"], `${where}.text`),
  };
}

function readTrap(value: unknown, where: string): TrapInvocation {
  const record = readRecord(value, where, TRAP_MEMBERS);
  const proxy = record["proxy"];
  const trap = record["trap"];
  if (proxy !== "first" && proxy !== "second") {
    throw new ReportShapeError(
      `${where}.proxy ${JSON.stringify(proxy)} is neither "first" nor "second"`,
    );
  }
  if (!PROXY_TRAPS.some((name) => name === trap)) {
    throw new ReportShapeError(
      `${where}.trap ${JSON.stringify(trap)} is none of PROXY_TRAPS`,
    );
  }
  return { proxy, trap: trap as ProxyTrap };
}

function readOwnKey(value: unknown, where: string): OwnKey {
  const record = readRecord(value, where, OWN_KEY_MEMBERS);
  const kind = record["kind"];
  if (kind !== "string" && kind !== "symbol") {
    throw new ReportShapeError(
      `${where}.kind ${JSON.stringify(kind)} is neither "string" nor "symbol"`,
    );
  }
  const name =
    kind === "string"
      ? readString(record["name"], `${where}.name`)
      : readNullableString(record["name"], `${where}.name`);
  const enumerable = record["enumerable"];
  if (enumerable !== null && typeof enumerable !== "boolean") {
    throw new ReportShapeError(
      `${where}.enumerable ${JSON.stringify(enumerable)} is no boolean`,
    );
  }
  return { kind, name, enumerable };
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
      "ownKeys",
      "type",
    ]);
    return {
      outcome,
      value: {
        type: readString(loaded["type"], "load.value.type"),
        ownKeys:
          loaded["ownKeys"] === null
            ? null
            : readArray(loaded["ownKeys"], "load.value.ownKeys").map(
                (key, index) =>
                  readOwnKey(key, `load.value.ownKeys[${String(index)}]`),
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
   * Whether the run also observes T7.6-7(b) and (e) (module header): its
   * FIFOs staged before it, and the staging, its working directory, `HOME`,
   * and `TMPDIR` snapshotted around it ({@link ModuleRun.effects}). Such a
   * run compares the whole staging, so the driver refuses to prepare
   * another run into that staging while it is launched.
   */
  readonly effects?: boolean;
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
  /**
   * T7.6-7(b) and (e)'s observations, for a run asked for them
   * ({@link ModuleRunRequest.effects}); undefined otherwise.
   */
  readonly effects: RunEffects | undefined;
}

/** A run whose module loaded and whose process exited 0 on its own. */
export interface LoadedModuleRun extends ModuleRun {
  readonly outcome: "loaded";
  readonly report: ModuleRunReport & {
    readonly load: Extract<LoadObservation, { readonly outcome: "loaded" }>;
    readonly importingModule: ImportingModuleNote;
    readonly calls: CallsObservation & {
      readonly reading: DefineConfigReading;
    };
    readonly state: StateObservation;
  };
}

/** The places T7.6-7(b) compares around a run (module header). */
export type RunPlace = "staging" | "working directory" | "HOME" | "TMPDIR";

/** An entry's kind, by name (T7.6-7(b): a FIFO compared by its kind alone). */
export type PlaceEntryKind =
  | "plain file"
  | "directory"
  | "symbolic link"
  | "FIFO"
  | "socket"
  | "character device"
  | "block device"
  | "entry of another kind";

/** One entry of a place, as {@link snapshotPlace} records it. */
export type PlaceEntry =
  | {
      readonly kind: "plain file";
      /** Its bytes; null where its mode refused the read. */
      readonly bytes: Uint8Array | null;
    }
  | {
      readonly kind: "directory";
      /** Whether it could be listed (its entries recorded). */
      readonly listed: boolean;
    }
  | { readonly kind: "symbolic link"; readonly target: Uint8Array }
  | { readonly kind: OtherPlaceEntryKind };

/** The kinds of entry compared by their kind alone: never opened. */
export type OtherPlaceEntryKind = Exclude<
  PlaceEntryKind,
  "plain file" | "directory" | "symbolic link"
>;

/**
 * A place's entries (module header), each keyed by its path's bytes
 * relative to the place, latin1-encoded and `/`-separated (helpers/
 * snapshot.ts's keys), the place itself under `""`.
 */
export type PlaceSnapshot = ReadonlyMap<string, PlaceEntry>;

/** One entry created, modified, or removed in a place. */
export interface PlaceChange {
  /** Its path in the place, for a diagnosis: `.` for the place itself. */
  readonly path: string;
  readonly change: "created" | "modified" | "removed";
  /** What it was, is, or became, in words. */
  readonly detail: string;
}

/** One place T7.6-7(b) compared, and what changed in it. */
export interface PlaceWrites {
  readonly place: RunPlace;
  /** The place's root, absolute and physical. */
  readonly root: string;
  readonly changes: readonly PlaceChange[];
}

/** One of T7.6-7(e)'s FIFOs, read back after the run. */
export interface FifoAfter {
  /** Its absolute path. */
  readonly path: string;
  /** What occupies the path afterwards: its kind, or null for nothing. */
  readonly found: PlaceEntryKind | null;
}

/** T7.6-7(b) and (e)'s observations of a run (module header). */
export interface RunEffects {
  /** (b): each of the four places, and what changed in it. */
  readonly writes: readonly PlaceWrites[];
  /** (e): each FIFO staged, and what its path holds afterwards. */
  readonly fifos: readonly FifoAfter[];
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
 * its bootstrap, and its fresh `HOME`, `TMPDIR`, and working directory —
 * and, for a run observing its effects, T7.6-7(e)'s FIFOs staged. Nothing
 * runs yet: a caller may stage more in those directories before
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
  /** Whether it observes T7.6-7(b) and (e) ({@link ModuleRunRequest.effects}). */
  readonly #effects: boolean;
  readonly #fifos: string[] = [];
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
    this.#effects = request.effects === true;
  }

  /**
   * T7.6-7(e)'s FIFOs, absolute — in the working directory, in the
   * importing module's directory, and in `HOME` — for a run observing its
   * effects; none otherwise.
   */
  get fifos(): readonly string[] {
    return this.#fifos;
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
    const root = await makeScratchDirectory(MODULE_RUN_PREFIX, request.context);
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
      if (prepared.#effects) await prepared.#stageFifos(importingDir);
      return prepared;
    } catch (error) {
      await removeRunDirectory(root, request.context);
      throw error;
    }
  }

  /**
   * Run it (module header): Reach and H-1 verified first, under the run's
   * exact environment, working directory, and executable; then the release
   * run through the subprocess driver under the run's own guard — for a run
   * observing its effects, its four places snapshotted just before and
   * just after, and its FIFOs read back; then its report read, decoded, and
   * its conditions checked. Resolves with the run whatever its outcome;
   * rejects with the hang-guard kill, any other rejection of the run's
   * spawn, an unmet staging precondition (`HarnessStagingError`), or a
   * breach of the run's conditions (a harness error).
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
    const spawn = (): Promise<RunResult> =>
      runProduct(binding, {
        cwd: this.cwd,
        argv: [
          this.bootstrap,
          this.importingModule,
          this.reportPath,
          this.route,
        ],
        env: overrides,
        timeoutMs: this.#guards.timeoutMs ?? MODULE_RUN_TIMEOUT_MS,
        ...(this.#guards.maxOutputBytes === undefined
          ? {}
          : { maxOutputBytes: this.#guards.maxOutputBytes }),
      });
    const { result, effects } = this.#effects
      ? await this.#observeEffects(spawn)
      : { result: await spawn(), effects: undefined };
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
      effects,
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
   * Stage T7.6-7(e)'s FIFOs (module header): `xspec.config.ts` in the
   * working directory and in `HOME`, fresh for the run, and in the
   * importing module's directory, `importingDir` in the staging — found
   * there already as a FIFO, staged by an earlier run, or staged now; any
   * other occupant a `HarnessStagingError`.
   */
  async #stageFifos(importingDir: string): Promise<void> {
    const inStaging =
      importingDir === "" || importingDir === "."
        ? RUN_FIFO_NAME
        : `${importingDir}/${RUN_FIFO_NAME}`;
    const stagingFifo = this.staging.path(inStaging);
    const occupant = await guardStep(
      `reading what occupies ${stagingFifo} (${this.description})`,
      () => readEntryKind(stagingFifo),
    );
    if (occupant === null) {
      refuseWhileObserved(
        this.staging,
        `the FIFO ${stagingFifo}`,
        this.description,
      );
      await guardStep(
        `staging the FIFO ${stagingFifo} (${this.description})`,
        () =>
          stageFifo(
            { root: this.staging.root, tempRoot: this.root },
            inStaging,
          ),
      );
    } else if (occupant !== "FIFO") {
      throw new HarnessStagingError(
        MODE,
        stagingFifo,
        `${this.description}: the place of T7.6-7(e)'s FIFO in the ` +
          `importing module's directory, ${stagingFifo}, is occupied by ` +
          `${withArticle(occupant)} (TEST-SPEC T7.6-7(e): a FIFO named ` +
          `${RUN_FIFO_NAME} in the importing module's directory)`,
      );
    }
    for (const directory of [this.cwd, this.home]) {
      await guardStep(
        `staging the FIFO ${path.join(directory, RUN_FIFO_NAME)} ` +
          `(${this.description})`,
        () =>
          stageFifo({ root: directory, tempRoot: this.root }, RUN_FIFO_NAME),
      );
    }
    this.#fifos.push(
      path.join(this.cwd, RUN_FIFO_NAME),
      stagingFifo,
      path.join(this.home, RUN_FIFO_NAME),
    );
  }

  /**
   * Spawn the run observing T7.6-7(b) and (e) (module header): the four
   * places snapshotted just before it and just after, compared, and each
   * FIFO read back; the staging held as observed meanwhile, so that no
   * other run is prepared into it.
   */
  async #observeEffects(
    spawn: () => Promise<RunResult>,
  ): Promise<{ result: RunResult; effects: RunEffects }> {
    const places: readonly (readonly [RunPlace, string])[] = [
      ["staging", this.staging.root],
      ["working directory", this.cwd],
      ["HOME", this.home],
      ["TMPDIR", this.tmp],
    ];
    observedLaunches.set(
      this.staging,
      (observedLaunches.get(this.staging) ?? 0) + 1,
    );
    try {
      const before: PlaceSnapshot[] = [];
      for (const [, root] of places) {
        before.push(await snapshotPlace(root, this.description));
      }
      const result = await spawn();
      const writes: PlaceWrites[] = [];
      for (const [index, [place, root]] of places.entries()) {
        writes.push({
          place,
          root,
          changes: comparePlaceSnapshots(
            before[index] ?? new Map(),
            await snapshotPlace(root, this.description),
          ),
        });
      }
      const fifos: FifoAfter[] = [];
      for (const fifo of this.#fifos) {
        fifos.push({
          path: fifo,
          found: await guardStep(
            `reading back the FIFO ${fifo} (${this.description})`,
            () => readEntryKind(fifo),
          ),
        });
      }
      return { result, effects: { writes, fifos } };
    } finally {
      const count = (observedLaunches.get(this.staging) ?? 1) - 1;
      if (count > 0) observedLaunches.set(this.staging, count);
      else observedLaunches.delete(this.staging);
    }
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
    const state = report.state;
    if (state !== null) {
      const missing = REQUIRED_STATE_SUBJECTS.filter(
        (label) => !state.subjects.includes(label),
      );
      if (missing.length > 0) {
        breaches.push(
          `its comparison of the process state observed none of ` +
            `${JSON.stringify(missing)} (TEST-SPEC T7.6-7(c): the global ` +
            `object, process, and the global built-in constructors and ` +
            `namespace objects with those constructors' prototypes)`,
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
      if (own !== null && own !== undefined) {
        return (
          `failed in the harness's own bootstrap (${describeThrown(own)}): ` +
          `the process ${ended}`
        );
      }
      const calls = run.report?.calls;
      if (
        run.report?.phase === "calling" &&
        calls !== null &&
        calls !== undefined
      ) {
        const next = CALL_CASES[calls.results.length];
        const during =
          calls.reading === null
            ? "while reading defineConfig from what the route loaded"
            : next === undefined
              ? "after T7.6-6's calls to defineConfig"
              : `during T7.6-6's call ${describeCallCase(next)}`;
        return `loaded the module, but ended ${during}: the process ${ended}`;
      }
      return `ended before the load completed or failed: the process ${ended}`;
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
// T7.6-6's observations, and pairing
// ---------------------------------------------------------------------------

/** SPEC 7.6 Runtime's export clause, which T7.6-6(a)'s problems cite. */
const EXPORTS_CITATION =
  "(TEST-SPEC T7.6-6(a); SPEC 7.6 Runtime: the module's exports are " +
  "exactly defineConfig — an import namespace holds that one export, and a " +
  "require result has that one own enumerable property, symbol-keyed " +
  "properties counted as well as string-keyed ones)";

/** SPEC 7.6 Runtime's return clause, which T7.6-6(b)'s problems cite. */
const IDENTITY_CITATION =
  "(TEST-SPEC T7.6-6(b); SPEC 7.6 Runtime: defineConfig returns its first " +
  "argument, the very value passed, whatever it is; undefined when called " +
  "with none; any further arguments ignored)";

/** SPEC 7.6 Runtime's return clause, which T7.6-6(c)'s problems cite. */
const EXAMINATION_CITATION =
  "(TEST-SPEC T7.6-6(c); SPEC 7.6 Runtime: defineConfig returns its first " +
  "argument and does nothing else, that value neither examined, copied, nor " +
  "modified)";

/** SPEC 7.6 Runtime's effect clause, which T7.6-7(a)'s problems cite. */
const OUTPUT_CITATION =
  "(TEST-SPEC T7.6-7(a); SPEC 7.6 Runtime: beyond the runtime's own " +
  "resolution of the specifier and loading of the package's files, neither " +
  "loading the module nor calling defineConfig has any effect — no output " +
  "on standard output or standard error)";

const CALL_CASE_DESCRIPTIONS: Readonly<Record<CallCase, string>> = {
  object: "defineConfig(v) with v an object",
  array: "defineConfig(v) with v an array",
  function: "defineConfig(v) with v a function",
  symbol: "defineConfig(v) with v a symbol",
  null: "defineConfig(null)",
  undefined: "defineConfig(undefined), undefined passed explicitly",
  string: "defineConfig(v) with v a string",
  boolean: "defineConfig(false)",
  bigint: "defineConfig(10n)",
  zero: "defineConfig(0)",
  "negative-zero": "defineConfig(-0)",
  nan: "defineConfig(NaN)",
  "no-argument": "defineConfig() with no argument, which returns undefined",
  "further-arguments":
    "defineConfig(a, b) with a further argument, which returns a",
  proxies:
    "defineConfig(p, q) with p and q Proxies over functions whose every " +
    "trap records its invocation, which returns p itself",
  frozen: "defineConfig(f) with f a frozen object",
};

/** One of T7.6-6's calls, in words. */
export function describeCallCase(name: CallCase): string {
  return CALL_CASE_DESCRIPTIONS[name];
}

/** One of T7.6-6's calls and what it came to, in words. */
function describeCallResult(result: CallResult): string {
  const call = describeCallCase(result.case);
  switch (result.outcome) {
    case "returned-argument":
      return `${call}: it returned its argument`;
    case "threw":
      return (
        `${call}: it threw ` +
        (result.thrown === null ? "a value" : describeThrown(result.thrown))
      );
    case "returned-other":
      return `${call}: it returned ${describeReturned(result.returned)} instead`;
  }
}

/** A value a call returned in place of its own, in words. */
function describeReturned(returned: ReturnedValue | null): string {
  if (returned === null) return "another value";
  if (returned.text === null) return `another ${returned.type}`;
  return returned.type === "string"
    ? `the string ${JSON.stringify(returned.text)}`
    : `${returned.text} (${returned.type})`;
}

/** A loaded value's type, in words. */
function describeValueType(type: string): string {
  return type === "null" || type === "undefined"
    ? type
    : `a value of type ${type}`;
}

/** Own keys, in words. */
function describeKeys(keys: readonly OwnKey[]): string {
  const described = keys.map((key) =>
    key.kind === "symbol"
      ? `Symbol(${key.name ?? ""})`
      : JSON.stringify(key.name),
  );
  return `[${described.join(", ")}]`;
}

/**
 * What keeps T7.6-6's calls from having been made — `defineConfig`'s read
 * threw, or read no function — in words, or null where nothing does.
 */
function readingFault(run: LoadedModuleRun): string | null {
  const { reading } = run.report.calls;
  if (reading.thrown !== null) {
    return (
      `reading defineConfig from what the route loaded threw ` +
      `${describeThrown(reading.thrown)}, so none of T7.6-6's calls was made`
    );
  }
  if (reading.type !== "function") {
    return (
      `defineConfig, read from what the route loaded, is ` +
      `${describeValueType(reading.type ?? "undefined")}, no function, so ` +
      `none of T7.6-6's calls was made`
    );
  }
  return null;
}

/**
 * T7.6-6(a) on `run` (module header): the route's listing of the loaded
 * value's own keys exactly `defineConfig`. Each problem in words, led by
 * the run's description; none where it holds.
 */
export function exportsProblems(run: LoadedModuleRun): string[] {
  const { value } = run.report.load;
  if (run.route === "require") {
    if (value.ownKeys === null) {
      return [
        `${run.description}: the require result is ` +
          `${describeValueType(value.type)} whose own keys could not be ` +
          `listed, not one whose own enumerable properties are exactly ` +
          `"defineConfig" ${EXPORTS_CITATION}`,
      ];
    }
    const problems: string[] = [];
    const unread = value.ownKeys.filter((key) => key.enumerable === null);
    if (unread.length > 0) {
      problems.push(
        `${run.description}: whether the require result's own properties ` +
          `${describeKeys(unread)} are enumerable could not be read ` +
          EXPORTS_CITATION,
      );
    }
    const enumerable = value.ownKeys.filter((key) => key.enumerable === true);
    const [only] = enumerable;
    if (
      enumerable.length !== 1 ||
      only?.kind !== "string" ||
      only.name !== "defineConfig"
    ) {
      problems.push(
        `${run.description}: the require result's own enumerable ` +
          `properties, string- and symbol-keyed alike, are ` +
          `${describeKeys(enumerable)}, not exactly "defineConfig" ` +
          EXPORTS_CITATION,
      );
    }
    return problems;
  }
  if (value.ownKeys === null) {
    return [
      `${run.description}: the import namespace is ` +
        `${describeValueType(value.type)} whose own keys could not be listed ` +
        EXPORTS_CITATION,
    ];
  }
  const strings = value.ownKeys.filter((key) => key.kind === "string");
  const [only] = strings;
  return strings.length === 1 && only?.name === "defineConfig"
    ? []
    : [
        `${run.description}: the import namespace's own string-keyed ` +
          `properties are ${describeKeys(strings)}, not exactly ` +
          `"defineConfig" ${EXPORTS_CITATION}`,
      ];
}

/**
 * T7.6-6(b) on `run` (module header): `defineConfig` a function, and each
 * identity case returning what it must by SameValue. Each problem in words,
 * led by the run's description; none where it holds.
 */
export function identityProblems(run: LoadedModuleRun): string[] {
  const fault = readingFault(run);
  if (fault !== null) {
    return [`${run.description}: ${fault} ${IDENTITY_CITATION}`];
  }
  return run.report.calls.results
    .filter(
      (result) =>
        IDENTITY_CASES.includes(result.case) &&
        result.outcome !== "returned-argument",
    )
    .map(
      (result) =>
        `${run.description}: ${describeCallResult(result)}, compared by ` +
        `SameValue ${IDENTITY_CITATION}`,
    );
}

/**
 * T7.6-6(c) on `run` (module header): the call with the two recording
 * Proxies returning the first, no trap of either invoked through the run's
 * end, and the call with a frozen object returning it without a throw. Each
 * problem in words, led by the run's description; none where it holds.
 */
export function examinationProblems(run: LoadedModuleRun): string[] {
  const fault = readingFault(run);
  if (fault !== null) {
    return [`${run.description}: ${fault} ${EXAMINATION_CITATION}`];
  }
  const problems = run.report.calls.results
    .filter(
      (result) =>
        !IDENTITY_CASES.includes(result.case) &&
        result.outcome !== "returned-argument",
    )
    .map(
      (result) =>
        `${run.description}: ${describeCallResult(result)} ` +
        EXAMINATION_CITATION,
    );
  const { traps } = run.report.calls;
  if (traps.length > 0) {
    const invoked = traps.map(
      (invocation) => `${invocation.trap} on the ${invocation.proxy} Proxy`,
    );
    problems.push(
      `${run.description}: ${describeCallCase("proxies")}, yet its Proxies' ` +
        `handlers ran ${String(traps.length)} trap(s) through the run's end ` +
        `— ${invoked.join(", ")} — where none may run ${EXAMINATION_CITATION}`,
    );
  }
  return problems;
}

/**
 * §7.6 Pairing on `run` (module header): an absence a runtime arm asserts
 * counts only where the run loaded the module and saw `defineConfig` return
 * its argument, here in every one of T7.6-6's calls. The problem in words,
 * led by the run's description, or null where the pairing holds.
 */
export function pairingProblem(run: LoadedModuleRun): string | null {
  const fault = readingFault(run);
  const unmet =
    fault === null
      ? run.report.calls.results
          .filter((result) => result.outcome !== "returned-argument")
          .map((result) => describeCallResult(result))
      : [fault];
  if (unmet.length === 0) return null;
  return (
    `${run.description}: no absence counts in this run, which never saw ` +
    `defineConfig return its argument in every one of T7.6-6's calls — ` +
    `${unmet.join("; ")} (TEST-SPEC §7.6 Pairing: an absence a runtime arm ` +
    `asserts counts only where the same run loaded the module and saw ` +
    `defineConfig return its argument)`
  );
}

// ---------------------------------------------------------------------------
// The output oracle (T7.6-7(a))
// ---------------------------------------------------------------------------

/** A release's printed form of warnings (module header), learned from it. */
export interface WarningForm {
  /** The release whose form this is. */
  readonly version: string;
  /**
   * The hint line the release appends to the first warning it prints: to a
   * `DeprecationWarning`, and to any other.
   */
  readonly hints: { readonly deprecation: string; readonly other: string };
}

/** A rendering of a run's warnings, or why the oracle cannot render them. */
export type WarningRendering =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly problem: string };

/** A warning's type and message as the release joins them (module header). */
function joinedText(name: string, message: string): string {
  if (name === "") return message;
  if (message === "") return name;
  return `${name}: ${message}`;
}

/**
 * The head of `warning`'s printed form (module header) — all of it but the
 * hint line and the closing line feed — or null where the oracle cannot
 * render it.
 */
function printedHead(warning: CapturedWarning, pid: number): string | null {
  if (
    warning.type !== "object" ||
    warning.name === null ||
    warning.message === null
  ) {
    return null;
  }
  const code =
    warning.code !== null && warning.code !== "" ? `[${warning.code}] ` : "";
  const detail = warning.detail === null ? "" : `${LF}${warning.detail}`;
  return (
    `(node:${String(pid)}) ${code}` +
    `${joinedText(warning.name, warning.message)}${detail}`
  );
}

/** A captured warning, in words. */
function describeCapturedWarning(warning: CapturedWarning): string {
  const code = warning.code === null ? "" : `[${warning.code}] `;
  const name = warning.name ?? `a value of type ${warning.type}`;
  return warning.message === null
    ? `${code}${name}`
    : `${code}${name}: ${JSON.stringify(warning.message)}`;
}

/**
 * The release's printed forms of `warnings`, in order, as a process `pid`
 * prints them under `form` (module header).
 */
export function renderWarnings(
  warnings: readonly CapturedWarning[],
  pid: number,
  form: WarningForm,
): WarningRendering {
  let text = "";
  for (const [index, warning] of warnings.entries()) {
    const head = printedHead(warning, pid);
    if (head === null) {
      return {
        ok: false,
        problem:
          `the run's warning ${String(index + 1)}, ` +
          `${describeCapturedWarning(warning)}, is no object whose name and ` +
          `message are strings, as the runtime's own warnings are, so the ` +
          `oracle knows no printed form of it`,
      };
    }
    const hint =
      index === 0
        ? `${LF}${warning.name === "DeprecationWarning" ? form.hints.deprecation : form.hints.other}`
        : "";
    text += `${head}${hint}${LF}`;
  }
  return { ok: true, text };
}

/**
 * The first frame of `warning`'s stack (module header): the first line after
 * the stack's head — its type and message as the release joins them — that
 * is a frame, an indented line beginning `at `; after the first line where
 * the stack begins otherwise; null where there is none.
 */
export function warningFirstFrame(warning: CapturedWarning): string | null {
  const { stack } = warning;
  if (stack === null) return null;
  const head =
    warning.name !== null && warning.message !== null
      ? joinedText(warning.name, warning.message)
      : null;
  let rest: string;
  if (
    head !== null &&
    stack.startsWith(head) &&
    (stack.length === head.length || stack.charAt(head.length) === LF)
  ) {
    rest = stack.slice(head.length);
  } else {
    const firstBreak = stack.indexOf(LF);
    rest = firstBreak === -1 ? "" : stack.slice(firstBreak);
  }
  for (const line of rest.split(LF)) {
    const trimmed = line.trimStart();
    if (trimmed.length < line.length && trimmed.startsWith("at ")) {
      return line;
    }
  }
  return null;
}

/**
 * `warning`'s first frame where it names one of the package's files — a
 * path under the placement or the copy it reaches, by path or file URL —
 * or null.
 */
export function packageFrame(
  warning: CapturedWarning,
  placement: Placement,
): string | null {
  const frame = warningFirstFrame(warning);
  if (frame === null) return null;
  for (const root of new Set([placement.path, placement.copy])) {
    if (
      frame.includes(`${root}${path.sep}`) ||
      frame.includes(`${pathToFileURL(root).href}/`)
    ) {
      return frame;
    }
  }
  return null;
}

/**
 * T7.6-7(a) on `run` under its release's `form` (module header): the
 * pairing; standard output empty; standard error exactly the release's
 * printed forms of the warnings the run emits, in order; and no warning's
 * stack beginning in the package's files. Each problem in words, led by
 * the run's description; none where it holds.
 */
export function outputProblems(
  run: LoadedModuleRun,
  form: WarningForm,
): string[] {
  if (form.version !== run.release.version) {
    throw new Error(
      `module channel: the printed form learned from the Node.js release ` +
        `${form.version} judges no run on ${run.release.version} ` +
        `(${run.description})`,
    );
  }
  const problems: string[] = [];
  const pairing = pairingProblem(run);
  if (pairing !== null) problems.push(pairing);
  if (run.result.stdoutBytes.length > 0) {
    problems.push(
      `${run.description}: standard output is not empty: ` +
        `${quoteStream(run.result.stdout)} ${OUTPUT_CITATION}`,
    );
  }
  const { warnings, pid } = run.report;
  const rendering = renderWarnings(warnings, pid, form);
  if (!rendering.ok) {
    problems.push(
      `${run.description}: ${rendering.problem}; standard error ` +
        `${quoteStream(run.result.stderr)} ${OUTPUT_CITATION}`,
    );
  } else if (!bytesEqual(run.result.stderrBytes, rendering.text)) {
    problems.push(
      `${run.description}: standard error is not exactly the release's ` +
        `printed forms of the ${String(warnings.length)} warning(s) the run ` +
        `emits, in order — ` +
        describeByteDifference(
          run.result.stderrBytes,
          Buffer.from(rendering.text, "utf8"),
          "standard error",
          "printed forms",
        ) +
        ` — standard error ${quoteStream(run.result.stderr)}, the printed ` +
        `forms ${quoteStream(rendering.text)} ${OUTPUT_CITATION}`,
    );
  }
  warnings.forEach((warning, index) => {
    const frame = packageFrame(warning, run.placement);
    if (frame !== null) {
      problems.push(
        `${run.description}: the run's warning ${String(index + 1)}, ` +
          `${describeCapturedWarning(warning)}, begins its stack in the ` +
          `package's files, its first frame ${JSON.stringify(frame)}: a ` +
          `warning the module emits, which the runtime's own loading never ` +
          `does ${OUTPUT_CITATION}`,
      );
    }
  });
  return problems;
}

/**
 * {@link outputProblems} under the form learned from `run`'s release
 * ({@link learnWarningForm}).
 */
export async function runtimeOutputProblems(
  run: LoadedModuleRun,
): Promise<string[]> {
  return outputProblems(run, await learnWarningForm(run.release));
}

// ---------------------------------------------------------------------------
// T7.6-7(b), (c), and (e)
// ---------------------------------------------------------------------------

/** SPEC 7.6 Runtime's effect clause, which T7.6-7(c)'s problems cite. */
const STATE_CITATION =
  "(TEST-SPEC T7.6-7(c); SPEC 7.6 Runtime: beyond the runtime's own " +
  "resolution of the specifier and loading of the package's files, neither " +
  "loading the module nor calling defineConfig has any effect — no change " +
  "to the global object or to any other state of the process)";

/** SPEC 7.6 Runtime's effect clause, which T7.6-7(b)'s problems cite. */
const WRITES_CITATION =
  "(TEST-SPEC T7.6-7(b); SPEC 7.6 Runtime: beyond the runtime's own " +
  "resolution of the specifier and loading of the package's files, neither " +
  "loading the module nor calling defineConfig has any effect — no " +
  "filesystem write)";

/** SPEC 7.6 Runtime's effect clause, which T7.6-7(e)'s problems cite. */
const FIFOS_CITATION =
  "(TEST-SPEC T7.6-7(e), S-3; SPEC 7.6 Runtime: beyond the runtime's own " +
  "resolution of the specifier and loading of the package's files, neither " +
  "loading the module nor calling defineConfig has any effect — no " +
  "filesystem read outside the package)";

const STATE_OBSERVATION_DESCRIPTIONS: Readonly<
  Record<StateObservationName, string>
> = {
  "global-object": "the global object's own properties",
  "built-ins": "a global built-in object's own properties",
  extensibility: "an observed object's extensibility",
  prototype: "an observed object's prototype",
  process: "process's own properties",
  environment: "process.env",
  title: "the process title",
  "working-directory": "the working directory",
  "exit-code": "process.exitCode",
  "stream-write": "the write a standard stream resolves to",
  listeners: "the listeners registered on process",
  "timers-and-handles": "the pending timers and handles",
};

/** One of T7.6-7(c)'s observations, in words. */
export function describeStateObservation(name: StateObservationName): string {
  return STATE_OBSERVATION_DESCRIPTIONS[name];
}

/**
 * T7.6-7(c) on `run` (module header): the pairing, and the process state
 * unchanged across the load and the calls, as the bootstrap compared it.
 * Each problem in words, led by the run's description; none where it
 * holds.
 */
export function stateProblems(run: LoadedModuleRun): string[] {
  const problems: string[] = [];
  const pairing = pairingProblem(run);
  if (pairing !== null) problems.push(pairing);
  const { changes, omitted } = run.report.state;
  for (const change of changes) {
    problems.push(
      `${run.description}: ${describeStateObservation(change.observation)} ` +
        `changed across the load and the calls — ${change.subject}: ` +
        `${change.detail} ${STATE_CITATION}`,
    );
  }
  if (omitted > 0) {
    problems.push(
      `${run.description}: the process state differs in ${String(omitted)} ` +
        `more way(s) beyond those listed ${STATE_CITATION}`,
    );
  }
  return problems;
}

/** `run`'s effects, which a run must have been asked to observe. */
function requireEffects(run: ModuleRun, reader: string): RunEffects {
  if (run.effects === undefined) {
    throw new Error(
      `module channel: ${reader} reads T7.6-7(b) and (e)'s observations, ` +
        `which ${run.description} was not asked to make ` +
        `(ModuleRunRequest.effects)`,
    );
  }
  return run.effects;
}

/** A place, in words, with its root. */
function describePlace(writes: PlaceWrites): string {
  return writes.place === "staging"
    ? `the staging (${writes.root})`
    : writes.place === "working directory"
      ? `the run's working directory (${writes.root})`
      : `the run's ${writes.place} (${writes.root})`;
}

/**
 * T7.6-7(b) on `run`, a run observing its effects (module header): the
 * pairing, and no entry created, modified, or removed in the staging, the
 * working directory, `HOME`, or `TMPDIR`. Each problem in words, led by
 * the run's description; none where it holds.
 */
export function writeProblems(run: LoadedModuleRun): string[] {
  const effects = requireEffects(run, "writeProblems");
  const problems: string[] = [];
  const pairing = pairingProblem(run);
  if (pairing !== null) problems.push(pairing);
  for (const writes of effects.writes) {
    for (const change of writes.changes) {
      problems.push(
        `${run.description}: in ${describePlace(writes)}, ` +
          `${JSON.stringify(change.path)} was ${change.change}: ` +
          `${change.detail} ${WRITES_CITATION}`,
      );
    }
  }
  return problems;
}

/**
 * T7.6-7(e) on `run`, a run observing its effects (module header): the
 * pairing, and each FIFO still a FIFO in place — and, the run having ended
 * within its guard, unopened. Each problem in words, led by the run's
 * description; none where it holds.
 */
export function fifoProblems(run: LoadedModuleRun): string[] {
  const effects = requireEffects(run, "fifoProblems");
  const problems: string[] = [];
  const pairing = pairingProblem(run);
  if (pairing !== null) problems.push(pairing);
  for (const fifo of effects.fifos) {
    if (fifo.found === "FIFO") continue;
    problems.push(
      `${run.description}: the FIFO ${fifo.path} is ` +
        (fifo.found === null ? "gone" : `now ${withArticle(fifo.found)}`) +
        `, no longer a FIFO in place ${FIFOS_CITATION}`,
    );
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Learning each release's printed form (module header)
// ---------------------------------------------------------------------------

/** One warning a calibration run emits through `process.emitWarning`. */
export interface CalibrationWarning {
  /** Its type, the `type` option. */
  readonly type: string;
  /** Its code, the `code` option; null for none. */
  readonly code: string | null;
  readonly message: string;
  /** Its detail, the `detail` option; null for none. */
  readonly detail: string | null;
}

/** Which kind of warning a calibration run emits first (module header). */
export type CalibrationKind = "other" | "deprecation" | "experimental";

/** The warnings each calibration run emits, in order (module header). */
export const WARNING_CALIBRATIONS: Readonly<
  Record<CalibrationKind, readonly CalibrationWarning[]>
> = Object.freeze({
  other: Object.freeze([
    {
      type: "XspecCalibrationWarning",
      code: "XSPEC_CALIBRATION",
      message: `xspec calibration: a message${LF}over two lines`,
      detail: `its detail${LF}over two lines`,
    },
    {
      type: "Warning",
      code: null,
      message: "xspec calibration: a warning with no code and no detail",
      detail: null,
    },
    {
      type: "DeprecationWarning",
      code: "XSPEC_CALIBRATION_DEPRECATION",
      message: "xspec calibration: a later deprecation",
      detail: null,
    },
  ]),
  deprecation: Object.freeze([
    {
      type: "DeprecationWarning",
      code: "XSPEC_CALIBRATION_DEPRECATION",
      message: "xspec calibration: a first deprecation",
      detail: "its detail",
    },
    {
      type: "ExperimentalWarning",
      code: null,
      message: `xspec calibration: a later experimental feature${LF}over two lines`,
      detail: null,
    },
  ]),
  experimental: Object.freeze([
    {
      type: "ExperimentalWarning",
      code: null,
      message: `xspec calibration: a first experimental feature${LF}over two lines`,
      detail: null,
    },
    {
      type: "XspecCalibrationWarning",
      code: "XSPEC_CALIBRATION",
      message: "xspec calibration: a later warning",
      detail: `its detail${LF}over two lines`,
    },
  ]),
});

/** The forms learned in this process, by release (module header). */
const warningForms = new Map<string, Promise<WarningForm>>();

/**
 * The printed form of warnings on `release`, learned from the release
 * itself (module header): once per release in a process, a learning that
 * fails being forgotten. Rejects with a harness error where the release
 * prints a warning in a form the oracle does not know.
 */
export function learnWarningForm(release: NodeRelease): Promise<WarningForm> {
  const key = `${release.version}${LF}${release.executable}`;
  const known = warningForms.get(key);
  if (known !== undefined) return known;
  const learning = calibrateWarningForm(release);
  warningForms.set(key, learning);
  learning.catch(() => {
    if (warningForms.get(key) === learning) warningForms.delete(key);
  });
  return learning;
}

/** One calibration run's observations. */
interface CalibrationRun {
  /** The run, in words, leading its harness errors. */
  readonly context: string;
  readonly pid: number;
  /** The warnings delivered to its listener: exactly those it emitted. */
  readonly warnings: readonly CapturedWarning[];
  /** Its standard error, as UTF-8. */
  readonly stderr: string;
}

async function calibrateWarningForm(
  release: NodeRelease,
): Promise<WarningForm> {
  const other = await runCalibration(release, "other");
  const deprecation = await runCalibration(release, "deprecation");
  const experimental = await runCalibration(release, "experimental");
  const form: WarningForm = Object.freeze({
    version: release.version,
    hints: Object.freeze({
      deprecation: learnHint(deprecation),
      other: learnHint(other),
    }),
  });
  for (const calibration of [other, deprecation, experimental]) {
    confirmCalibration(form, calibration);
  }
  return form;
}

/**
 * Run the calibration script on `release` (module header), emitting
 * `kind`'s warnings, and read what it printed and what its listener was
 * delivered. Every departure from a clean run is a harness error.
 */
async function runCalibration(
  release: NodeRelease,
  kind: CalibrationKind,
): Promise<CalibrationRun> {
  const context =
    `learning how the Node.js release ${release.version} prints warnings ` +
    `(the calibration emitting ${kind === "other" ? "a warning of its own type" : `a ${kind} warning`} first)`;
  const root = await makeScratchDirectory(WARNING_CALIBRATION_PREFIX, context);
  try {
    const script = path.join(root, CALIBRATION_NAME);
    const reportPath = path.join(root, REPORT_NAME);
    const home = path.join(root, HOME_NAME);
    const tmp = path.join(root, TMPDIR_NAME);
    const cwd = path.join(root, WORK_NAME);
    await guardStep(
      `making the calibration's directories and script under ${root} ` +
        `(${context})`,
      async () => {
        for (const directory of [home, tmp, cwd]) {
          await fsp.mkdir(directory);
        }
        await fsp.writeFile(script, await fsp.readFile(CALIBRATION_SOURCE), {
          flag: "wx",
        });
      },
    );
    const binding = releaseBinding(release);
    const emitted = WARNING_CALIBRATIONS[kind];
    const result = await runProduct(binding, {
      cwd,
      argv: [script, reportPath, JSON.stringify(emitted)],
      env: exactEnvironmentOverrides(binding, moduleRunEnvironment(home, tmp)),
      timeoutMs: MODULE_RUN_TIMEOUT_MS,
    });
    const harnessError = (problem: string): Error =>
      new Error(
        `harness error (H-11): ${context}: ${problem}; the process ` +
          `${describeEnding(result)}, ${describeStreams(result)}`,
      );
    if (result.exitCode !== 0 || result.signal !== null) {
      throw harnessError("the calibration did not exit with code 0 on its own");
    }
    if (result.stdoutBytes.length > 0) {
      throw harnessError("the calibration wrote to standard output");
    }
    const bytes = await readReportBytes(reportPath, context);
    if (bytes === null) throw harnessError("the calibration left no report");
    const decoding = guardSyncStep(
      `decoding the calibration's report (${context})`,
      () => decodeCalibrationReport(bytes),
    );
    if (!decoding.ok) {
      throw harnessError(`its report is malformed (${decoding.problem})`);
    }
    const { pid, warnings } = decoding;
    const delivered = warnings.map((warning) => ({
      type: warning.name,
      code: warning.code,
      message: warning.message,
      detail: warning.detail,
    }));
    const asEmitted =
      warnings.length === emitted.length &&
      warnings.every((warning, index) => {
        const wanted = emitted[index];
        return (
          wanted !== undefined &&
          warning.type === "object" &&
          warning.name === wanted.type &&
          warning.code === wanted.code &&
          warning.message === wanted.message &&
          warning.detail === wanted.detail
        );
      });
    if (!asEmitted) {
      throw harnessError(
        `the warnings its listener was delivered, ` +
          `${JSON.stringify(delivered)}, are not those it emitted, ` +
          JSON.stringify(emitted),
      );
    }
    const stderr = guardSyncStep(
      `decoding the calibration's standard error (${context})`,
      () => {
        try {
          return new TextDecoder("utf-8", { fatal: true }).decode(
            result.stderrBytes,
          );
        } catch {
          return null;
        }
      },
    );
    if (stderr === null) throw harnessError("its standard error is no UTF-8");
    return { context, pid, warnings, stderr };
  } finally {
    await removeRunDirectory(root, context);
  }
}

/** A calibration report's decoding: its members, or what makes it malformed. */
type CalibrationDecoding =
  | {
      readonly ok: true;
      readonly pid: number;
      readonly warnings: readonly CapturedWarning[];
    }
  | { readonly ok: false; readonly problem: string };

/**
 * Decode a calibration report's bytes: UTF-8 JSON holding exactly the
 * protocol, the process identifier, and the warnings delivered, each read
 * as a module run's report reads one.
 */
function decodeCalibrationReport(bytes: Uint8Array): CalibrationDecoding {
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
    const record = readRecord(parsed, "the calibration's report", [
      "pid",
      "protocol",
      "warnings",
    ]);
    if (record["protocol"] !== WARNING_CALIBRATION_PROTOCOL) {
      throw new ReportShapeError(
        `its protocol is ${JSON.stringify(record["protocol"])}, not ` +
          JSON.stringify(WARNING_CALIBRATION_PROTOCOL),
      );
    }
    const pid = record["pid"];
    if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0) {
      throw new ReportShapeError(
        `its pid ${JSON.stringify(pid)} is no positive integer`,
      );
    }
    const warnings = readArray(record["warnings"], "warnings").map(
      (warning, index) => readWarning(warning, `warnings[${String(index)}]`),
    );
    return { ok: true, pid, warnings };
  } catch (error) {
    if (error instanceof ReportShapeError) {
      return { ok: false, problem: error.message };
    }
    throw error;
  }
}

/**
 * The hint line `calibration`'s release appends to its first warning: the
 * line after that warning's form at the head of its standard error.
 */
function learnHint(calibration: CalibrationRun): string {
  const [first] = calibration.warnings;
  const head = first === undefined ? null : printedHead(first, calibration.pid);
  if (head === null) {
    throw calibrationError(calibration, "its first warning cannot be rendered");
  }
  const lead = `${head}${LF}`;
  const { stderr } = calibration;
  if (!stderr.startsWith(lead)) {
    throw calibrationError(
      calibration,
      `its standard error does not begin with the first warning's form ` +
        `${JSON.stringify(lead)}, so the release prints warnings in a form ` +
        `the oracle does not know`,
    );
  }
  const end = stderr.indexOf(LF, lead.length);
  if (end <= lead.length) {
    throw calibrationError(
      calibration,
      "no hint line follows the first warning's form",
    );
  }
  return stderr.slice(lead.length, end);
}

/**
 * Require `calibration`'s whole standard error to be what `form` renders
 * from the warnings its listener was delivered.
 */
function confirmCalibration(
  form: WarningForm,
  calibration: CalibrationRun,
): void {
  const rendering = renderWarnings(calibration.warnings, calibration.pid, form);
  if (!rendering.ok) throw calibrationError(calibration, rendering.problem);
  if (rendering.text !== calibration.stderr) {
    throw calibrationError(
      calibration,
      `its standard error is not what the learned form renders from its ` +
        `warnings, so the release prints warnings in a form the oracle does ` +
        `not know — ` +
        describeByteDifference(
          Buffer.from(calibration.stderr, "utf8"),
          Buffer.from(rendering.text, "utf8"),
          "standard error",
          "rendered",
        ),
    );
  }
}

function calibrationError(calibration: CalibrationRun, problem: string): Error {
  return new Error(
    `harness error (H-11): ${calibration.context}: ${problem}; standard ` +
      `error ${quoteStream(calibration.stderr)}`,
  );
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
    refuseWhileObserved(staging, `the importing module ${target}`, context);
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

/**
 * The launches observing their effects in flight, by staging (module
 * header): while one is, nothing is written into its staging for another
 * run.
 */
const observedLaunches = new WeakMap<ModuleStaging, number>();

/**
 * Refuse, as a usage error, to write `what` into `staging` while a run
 * observing its effects is launched on it (module header): that run's
 * comparison of the staging would charge the write to its module.
 */
function refuseWhileObserved(
  staging: ModuleStaging,
  what: string,
  context: string,
): void {
  if ((observedLaunches.get(staging) ?? 0) === 0) return;
  throw new Error(
    `module channel: ${what} would be written into the staging ` +
      `${staging.root} while a run observing its effects is launched on it, ` +
      `whose comparison of the staging would charge the write to its module ` +
      `(TEST-SPEC T7.6-7(b)); prepare every run of a staging before ` +
      `launching one that observes its effects, or run them one after ` +
      `another (${context})`,
  );
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

/**
 * A fresh directory named with `prefix` under the OS temporary directory,
 * physical: a run's own, or a warning calibration's.
 */
async function makeScratchDirectory(
  prefix: string,
  context: string,
): Promise<string> {
  const made = await guardStep(
    `creating a directory under ${os.tmpdir()} (${context})`,
    () => fsp.mkdtemp(path.join(os.tmpdir(), prefix)),
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
 * A place's entries (module header): `root` itself, under `""`, and every
 * entry under it, each by its kind — a plain file with its bytes (null
 * where its mode refuses the read), a directory (whether it lists), a
 * symbolic link with its target, never followed, and a FIFO, a socket, or a
 * device by its kind alone, never opened (TEST-SPEC T7.6-7(b), S-3). An
 * absent root yields no entry. One harness step under its own guard.
 */
export async function snapshotPlace(
  root: string,
  context: string,
): Promise<PlaceSnapshot> {
  return guardStep(`snapshotting ${root} (${context})`, async () => {
    const entries = new Map<string, PlaceEntry>();
    await recordPlaceEntry(Buffer.from(root), null, entries);
    return entries;
  });
}

/** Record the entry at `abs` (`rel` in the place; null for its root), and those under it. */
async function recordPlaceEntry(
  abs: Buffer,
  rel: Buffer | null,
  entries: Map<string, PlaceEntry>,
): Promise<void> {
  let stats: Stats;
  try {
    stats = await fsp.lstat(abs);
  } catch (error) {
    if (isAbsence(error)) return;
    throw error;
  }
  const key = rel === null ? "" : rel.toString("latin1");
  if (stats.isFile()) {
    let bytes: Buffer | null;
    try {
      bytes = await fsp.readFile(abs);
    } catch (error) {
      if (!isRefusal(error)) throw error;
      bytes = null;
    }
    entries.set(key, { kind: "plain file", bytes });
    return;
  }
  if (stats.isSymbolicLink()) {
    entries.set(key, {
      kind: "symbolic link",
      target: await fsp.readlink(abs, { encoding: "buffer" }),
    });
    return;
  }
  if (!stats.isDirectory()) {
    entries.set(key, { kind: otherKind(stats) });
    return;
  }
  let names: Buffer[] | null;
  try {
    names = (await fsp.readdir(abs, { encoding: "buffer" })).sort(
      Buffer.compare,
    );
  } catch (error) {
    if (!isRefusal(error)) throw error;
    names = null;
  }
  entries.set(key, { kind: "directory", listed: names !== null });
  for (const name of names ?? []) {
    await recordPlaceEntry(
      Buffer.concat([abs, SLASH_BYTES, name]),
      rel === null ? name : Buffer.concat([rel, SLASH_BYTES, name]),
      entries,
    );
  }
}

/**
 * How a place changed between two snapshots (module header), entry by
 * entry in bytewise path order: an entry created, removed, or modified —
 * its kind, a plain file's bytes, a symbolic link's target, or whether a
 * plain file reads or a directory lists.
 */
export function comparePlaceSnapshots(
  before: PlaceSnapshot,
  after: PlaceSnapshot,
): PlaceChange[] {
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes: PlaceChange[] = [];
  for (const key of keys) {
    const was = before.get(key);
    const now = after.get(key);
    const shown = key === "" ? "." : displaySnapshotPath(key);
    if (was === undefined && now !== undefined) {
      changes.push({
        path: shown,
        change: "created",
        detail: `it is ${describePlaceEntry(now)}`,
      });
    } else if (was !== undefined && now === undefined) {
      changes.push({
        path: shown,
        change: "removed",
        detail: `it was ${describePlaceEntry(was)}`,
      });
    } else if (was !== undefined && now !== undefined) {
      const detail = placeEntryDifference(was, now);
      if (detail !== null) {
        changes.push({ path: shown, change: "modified", detail });
      }
    }
  }
  return changes;
}

/** An entry of a place, in words. */
function describePlaceEntry(entry: PlaceEntry): string {
  switch (entry.kind) {
    case "plain file":
      return entry.bytes === null
        ? "a plain file whose bytes could not be read"
        : `a plain file of ${String(entry.bytes.length)} byte(s)`;
    case "directory":
      return entry.listed
        ? "a directory"
        : "a directory whose listing was refused";
    case "symbolic link":
      return (
        `a symbolic link to ` +
        JSON.stringify(Buffer.from(entry.target).toString("utf8"))
      );
    default:
      return withArticle(entry.kind);
  }
}

/** How two entries at one path differ, in words; null where they do not. */
function placeEntryDifference(was: PlaceEntry, now: PlaceEntry): string | null {
  if (was.kind !== now.kind) {
    return `${describePlaceEntry(was)} became ${describePlaceEntry(now)}`;
  }
  if (was.kind === "plain file" && now.kind === "plain file") {
    if (was.bytes === null || now.bytes === null) {
      if (was.bytes === now.bytes) return null;
      return was.bytes === null
        ? "its bytes, which could not be read before, now can be"
        : "its bytes can no longer be read";
    }
    return bytesEqual(was.bytes, now.bytes)
      ? null
      : `its bytes changed — ${describeByteDifference(was.bytes, now.bytes, "before", "after")}`;
  }
  if (was.kind === "directory" && now.kind === "directory") {
    if (was.listed === now.listed) return null;
    return now.listed
      ? "its listing, refused before, now succeeds"
      : "its listing is now refused";
  }
  if (was.kind === "symbolic link" && now.kind === "symbolic link") {
    return bytesEqual(was.target, now.target)
      ? null
      : `its target changed from ` +
          `${JSON.stringify(Buffer.from(was.target).toString("utf8"))} to ` +
          JSON.stringify(Buffer.from(now.target).toString("utf8"));
  }
  return null;
}

/** What occupies `abs`, by its kind, read without following or opening it; null for nothing. */
async function readEntryKind(abs: string): Promise<PlaceEntryKind | null> {
  try {
    return entryKind(await fsp.lstat(abs));
  } catch (error) {
    if (isAbsence(error)) return null;
    throw error;
  }
}

/** An entry's kind, from its `lstat`. */
function entryKind(stats: Stats): PlaceEntryKind {
  if (stats.isFile()) return "plain file";
  if (stats.isDirectory()) return "directory";
  if (stats.isSymbolicLink()) return "symbolic link";
  return otherKind(stats);
}

/** The kind of an entry that is no plain file, directory, or symbolic link. */
function otherKind(stats: Stats): OtherPlaceEntryKind {
  if (stats.isFIFO()) return "FIFO";
  if (stats.isSocket()) return "socket";
  if (stats.isCharacterDevice()) return "character device";
  if (stats.isBlockDevice()) return "block device";
  return "entry of another kind";
}

/** An entry's kind with its indefinite article. */
function withArticle(kind: PlaceEntryKind): string {
  return kind === "entry of another kind" ? `an ${kind}` : `a ${kind}`;
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

/** Whether `error` is an entry's mode refusing a read or a listing. */
function isRefusal(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EACCES" || code === "EPERM";
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
