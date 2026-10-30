// The module channel's bootstrap on a Node.js release (TEST-SPEC T7.6-6,
// T7.6-7, S-10, H-2; SPEC 7.6 Runtime). Harness code, never product code,
// and it imports none: helpers/module-channel-node.ts copies these bytes
// into each run's own directory — outside the staging, the run's working
// directory, its HOME, and its TMPDIR — and runs
//
//   <release>/bin/node <this file> <importing module> <report> <route>
//
// with no option before this file and an explicit minimal environment,
// through the subprocess driver under the run's own hang guard.
//
// Before anything of the package loads, in this order:
// 1. It captures every built-in it calls once loading has begun, so that
//    what the loaded module does to the global object, a built-in
//    prototype, or `process` does not reach the report.
// 2. It reads the run's conditions — its arguments, the release's version,
//    executable, and options (`process.execArgv`), the process identifier,
//    the environment, and the working directory — which the driver checks
//    against those it set (TEST-SPEC T7.6-6's run conditions, S-10).
// 3. It registers a `warning` listener on `process`, recording each warning
//    the runtime delivers, in order (TEST-SPEC T7.6-7(a)), and an `exit`
//    listener writing the report as the process exits.
// Only then does it load the importing module, by the physical path the
// driver gives: `import()` of its file URL for an ES module (`.mjs`),
// `require` for a CommonJS module (`.cjs`). The importing module performs
// its route's load of the package and hands back what it loaded — a
// namespace, the promise of one, or a `require` result — beside a note of
// its own kind (its top-level `this`) and location (`import.meta.url`, or
// `__filename`).
//
// The report is one JSON document, whose members the driver's decoder
// (`decodeModuleRunReport`) reads exactly, written to the path the driver
// names: once the load has completed or failed, and again as the process
// exits, then holding the exit code and every warning delivered by then.
// Each write goes to a sibling `.partial` file renamed over the report, so
// the driver reads a whole document or none. A process ending before both
// writes — killed by a signal, or exiting without running its `exit`
// listeners while still loading — leaves none, which the driver reports as
// such. Nothing here writes to standard output or standard error, sets a
// timer, or keeps the process alive.

"use strict";

const fs = require("node:fs");
const url = require("node:url");

// 1. The built-ins called once loading has begun.
const writeFileSync = fs.writeFileSync;
const renameSync = fs.renameSync;
const pathToFileURL = url.pathToFileURL;
const stringify = JSON.stringify;
const getOwnPropertyNames = Object.getOwnPropertyNames;
const defineProperty = Reflect.defineProperty;
const apply = Reflect.apply;
const promiseThen = Promise.prototype.then;

/** The report's protocol, which the driver's decoder requires. */
const PROTOCOL = "xspec-module-run/1";

// 2. The run's conditions: this file's path, the importing module's, the
// report's, and the route, as the driver passed them.
const argv = process.argv.slice(1);
const importingModule = argv[1];
const reportPath = argv[2];
const route = argv[3];
const partialPath = `${reportPath}.partial`;

const environment = {};
const environmentNames = Object.keys(process.env);
for (let index = 0; index < environmentNames.length; index += 1) {
  const name = environmentNames[index];
  defineProperty(environment, name, {
    value: process.env[name],
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

const warnings = [];
const report = {
  protocol: PROTOCOL,
  argv,
  release: {
    version: process.version,
    execPath: process.execPath,
    execArgv: process.execArgv.slice(),
  },
  pid: process.pid,
  environment,
  cwd: process.cwd(),
  phase: "loading",
  importingModule: null,
  load: null,
  bootstrapError: null,
  warnings,
  exit: null,
};

// 3. The listeners, registered before the importing module's own loading
// begins.
process.on("warning", (warning) => {
  defineProperty(warnings, warnings.length, {
    value: describeWarning(warning),
    writable: true,
    enumerable: true,
    configurable: true,
  });
});
process.on("exit", (code) => {
  report.exit = { code: typeof code === "number" ? code : null };
  writeReport();
});

apply(promiseThen, load(), [
  () => {
    report.phase = "completed";
    writeReport();
  },
  (error) => {
    report.bootstrapError = describeThrown(error);
    writeReport();
  },
]);

/**
 * Load the importing module along the route, and record what its load
 * handed back, or what the load threw.
 */
async function load() {
  const asModule =
    route === "static-import" || route === "dynamic-import-from-module";
  const asCommonJs =
    route === "dynamic-import-from-commonjs" || route === "require";
  if (!asModule && !asCommonJs) {
    throw new TypeError(`no route is named ${stringify(route)}`);
  }
  let importer;
  let loaded;
  try {
    importer = asModule
      ? await import(pathToFileURL(importingModule).href)
      : require(importingModule);
    loaded =
      route === "dynamic-import-from-commonjs"
        ? await importer.loaded
        : importer.loaded;
  } catch (error) {
    report.load = { outcome: "failed", error: describeThrown(error) };
    return;
  }
  report.importingModule = {
    topLevelThis: readText(importer.kind, "topLevelThis"),
    location: readText(importer.kind, "location"),
  };
  report.load = { outcome: "loaded", value: describeValue(loaded) };
}

/** What the loaded value is, as far as confirming the load needs. */
function describeValue(value) {
  const type = value === null ? "null" : typeof value;
  let ownPropertyNames = null;
  if (type === "object" || type === "function") {
    try {
      ownPropertyNames = getOwnPropertyNames(value);
    } catch {
      ownPropertyNames = null;
    }
  }
  return { type, ownPropertyNames };
}

/** A thrown value's type, and its name, code, message, and stack. */
function describeThrown(thrown) {
  const type = thrown === null ? "null" : typeof thrown;
  const readable = type === "object" || type === "function";
  let message = null;
  if (readable) {
    message = readText(thrown, "message");
  } else if (type === "string") {
    message = thrown;
  }
  return {
    type,
    name: readable ? readText(thrown, "name") : null,
    code: readable ? readText(thrown, "code") : null,
    message,
    stack: readable ? readText(thrown, "stack") : null,
  };
}

/** A delivered warning, read as a thrown value is, and its detail. */
function describeWarning(warning) {
  const described = describeThrown(warning);
  const readable = described.type === "object" || described.type === "function";
  return {
    type: described.type,
    name: described.name,
    code: described.code,
    message: described.message,
    detail: readable ? readText(warning, "detail") : null,
    stack: described.stack,
  };
}

/** `object[key]` where it is a string; null otherwise, or where it throws. */
function readText(object, key) {
  try {
    const value = object[key];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/** Write the report whole: to a sibling file, renamed over it. */
function writeReport() {
  try {
    writeFileSync(partialPath, stringify(report));
    renameSync(partialPath, reportPath);
  } catch {
    // The report's absence is then all the driver can be told (header).
  }
}
