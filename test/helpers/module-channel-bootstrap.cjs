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
// 3. It makes T7.6-6's call values (below): the identity values, the two
//    recording Proxies, and the frozen object.
// 4. It registers a `warning` listener on `process`, recording each warning
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
// What the load handed back is then observed inside the run (TEST-SPEC
// T7.6-6), through the built-ins captured in step 1:
// - (a) Its own keys, each with its kind (a string, or a symbol named by its
//   description), and its enumerability read from its descriptor, never
//   invoking an accessor. The driver reads the route's listing from them:
//   an `import` namespace's string-keyed properties, a `require` result's
//   enumerable ones.
// - (b) and (c) `defineConfig`, read from it once, then called as a plain
//   function once per case, in the order of the driver's `CALL_CASES`: an
//   object, an array, a function, a symbol, `null`, `undefined` passed
//   explicitly, a string, a boolean, a bigint, `0`, `-0`, and `NaN`; no
//   argument; a further argument; the two Proxies; the frozen object. Each
//   call's verdict is `Object.is` of what it returned and what it must
//   return — its (first) argument, or `undefined` with no argument:
//   `returned-argument`, `returned-other` (the value described by its type
//   and, for a primitive or a harness value, its text), or `threw` (the
//   thrown value read as the report reads one).
// - Each trap either Proxy's handler runs, in order, from the moment the
//   Proxies exist to the run's end. Each Proxy's target is a function, and
//   its handler carries all thirteen traps, each recording its invocation
//   and then forwarding to the captured `Reflect` method. Nothing of the
//   bootstrap's own touches a Proxy once it is made: a returned or thrown
//   Proxy is named by identity alone.
//
// The report is one JSON document, whose members the driver's decoder
// (`decodeModuleRunReport`) reads exactly, written to the path the driver
// names: once the load and the calls have completed, or the load has
// failed, and again as the process exits, then holding the exit code and
// every warning delivered and trap invoked by then. Its phase is `loading`
// until the load hands back a value or throws, `calling` while the calls
// run — so a process ending inside a call is reported as such — and
// `completed` after. Each write goes to a sibling `.partial` file renamed
// over the report, so the driver reads a whole document or none. A process
// ending before both writes — killed by a signal, or exiting without
// running its `exit` listeners while still loading — leaves none, which
// the driver reports as such. Nothing here writes to standard output or
// standard error, sets a timer, or keeps the process alive.

"use strict";

const fs = require("node:fs");
const url = require("node:url");

// 1. The built-ins called once loading has begun.
const writeFileSync = fs.writeFileSync;
const renameSync = fs.renameSync;
const pathToFileURL = url.pathToFileURL;
const stringify = JSON.stringify;
const defineProperty = Reflect.defineProperty;
const apply = Reflect.apply;
const ownKeys = Reflect.ownKeys;
const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const is = Object.is;
const freeze = Object.freeze;
const promiseThen = Promise.prototype.then;
const stringSlice = String.prototype.slice;
const toText = String;
const ProxyConstructor = Proxy;
const symbolDescription = getOwnPropertyDescriptor(
  Symbol.prototype,
  "description",
).get;

/** The report's protocol, which the driver's decoder requires. */
const PROTOCOL = "xspec-module-run/2";

/** How much of a returned string a call's description keeps. */
const RETURNED_TEXT_LIMIT = 200;

/**
 * Every trap a Proxy handler can carry (the driver's `PROXY_TRAPS`), each
 * forwarded to its `Reflect` method, captured here.
 */
const TRAPS = [
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
];
const forwards = { __proto__: null };
for (let index = 0; index < TRAPS.length; index += 1) {
  forwards[TRAPS[index]] = Reflect[TRAPS[index]];
}

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

// 3. T7.6-6's call values.
const trapLog = [];
const firstProxy = recordingProxy("first");
const secondProxy = recordingProxy("second");
const firstArgument = { xspecArgument: "first" };
const secondArgument = { xspecArgument: "second" };
const frozenObject = freeze({ xspecFrozen: true });

/** The harness values a call may hand back in place of its own, by name. */
const KNOWN_VALUES = [
  [firstProxy, "the first Proxy"],
  [secondProxy, "the second Proxy"],
  [firstArgument, "the first of two arguments"],
  [secondArgument, "the second of two arguments"],
  [frozenObject, "the frozen object"],
];

/**
 * T7.6-6's calls, in the order of the driver's `CALL_CASES`: each case's
 * arguments, and the value the call must return.
 */
const CALLS = [
  identityCall("object", { xspecIdentity: "object" }),
  identityCall("array", ["xspec", "identity"]),
  identityCall("function", function xspecIdentity() {}),
  identityCall("symbol", Symbol("xspec identity")),
  identityCall("null", null),
  identityCall("undefined", undefined),
  identityCall("string", "xspec identity"),
  identityCall("boolean", false),
  identityCall("bigint", 10n),
  identityCall("zero", 0),
  identityCall("negative-zero", -0),
  identityCall("nan", NaN),
  { label: "no-argument", args: [], expected: undefined },
  {
    label: "further-arguments",
    args: [firstArgument, secondArgument],
    expected: firstArgument,
  },
  { label: "proxies", args: [firstProxy, secondProxy], expected: firstProxy },
  { label: "frozen", args: [frozenObject], expected: frozenObject },
];

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
  calls: null,
  bootstrapError: null,
  warnings,
  exit: null,
};

// 4. The listeners, registered before the importing module's own loading
// begins.
process.on("warning", (warning) => {
  append(warnings, describeWarning(warning));
});
process.on("exit", (code) => {
  report.exit = { code: typeof code === "number" ? code : null };
  writeReport();
});

apply(promiseThen, load(), [
  () => {
    writeReport();
  },
  (error) => {
    report.bootstrapError = describeThrown(error);
    writeReport();
  },
]);

/**
 * Load the importing module along the route, and record what its load
 * handed back and what T7.6-6's calls observed of it, or what the load
 * threw. Each phase's members are set together, with no code of the
 * package's between them, so a report written at any exit is consistent.
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
    report.phase = "completed";
    return;
  }
  const note = {
    topLevelThis: readText(importer.kind, "topLevelThis"),
    location: readText(importer.kind, "location"),
  };
  const value = describeLoaded(loaded);
  const calls = { reading: null, results: [], traps: trapLog };
  report.importingModule = note;
  report.load = { outcome: "loaded", value };
  report.calls = calls;
  report.phase = "calling";
  makeCalls(loaded, calls);
  report.phase = "completed";
}

/** What the loaded value is: its type and, for an object, its own keys. */
function describeLoaded(value) {
  const type = typeOf(value);
  return {
    type,
    ownKeys:
      type === "object" || type === "function" ? listOwnKeys(value) : null,
  };
}

/**
 * Each own key of `value`, in its own order: its kind, its name (a
 * symbol's description), and its enumerability (null where its descriptor
 * cannot be read); null where the keys cannot be listed.
 */
function listOwnKeys(value) {
  let keys;
  try {
    keys = ownKeys(value);
  } catch {
    return null;
  }
  const listing = [];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const symbol = typeof key === "symbol";
    append(listing, {
      kind: symbol ? "symbol" : "string",
      name: symbol ? describeSymbol(key) : key,
      enumerable: readEnumerable(value, key),
    });
  }
  return listing;
}

/** Whether `value`'s own property `key` is enumerable; null if unreadable. */
function readEnumerable(value, key) {
  try {
    const descriptor = getOwnPropertyDescriptor(value, key);
    return descriptor === undefined ? null : descriptor.enumerable === true;
  } catch {
    return null;
  }
}

/** A symbol's description, or null where it has none. */
function describeSymbol(symbol) {
  try {
    const description = apply(symbolDescription, symbol, []);
    return typeof description === "string" ? description : null;
  } catch {
    return null;
  }
}

/**
 * Read `defineConfig` from what the load handed back, once, and make each
 * of T7.6-6's calls with it, recording each verdict as it is reached.
 */
function makeCalls(loaded, calls) {
  let defineConfig;
  try {
    defineConfig = loaded.defineConfig;
  } catch (error) {
    calls.reading = { type: null, thrown: describeThrown(error) };
    return;
  }
  calls.reading = { type: typeOf(defineConfig), thrown: null };
  if (typeof defineConfig !== "function") return;
  for (let index = 0; index < CALLS.length; index += 1) {
    append(calls.results, makeCall(defineConfig, CALLS[index]));
  }
}

/** One call, as a plain function, and its verdict. */
function makeCall(defineConfig, call) {
  let returned;
  try {
    returned = apply(defineConfig, undefined, call.args);
  } catch (error) {
    return {
      case: call.label,
      outcome: "threw",
      returned: null,
      thrown: describeThrown(error),
    };
  }
  return is(returned, call.expected)
    ? {
        case: call.label,
        outcome: "returned-argument",
        returned: null,
        thrown: null,
      }
    : {
        case: call.label,
        outcome: "returned-other",
        returned: describeReturned(returned),
        thrown: null,
      };
}

/** A case whose one argument is the value it must return. */
function identityCall(label, value) {
  return { label, args: [value], expected: value };
}

/**
 * A value a call returned in place of its own: its type and, for a
 * primitive, its text, or, for a harness value, its name; never touching a
 * Proxy.
 */
function describeReturned(value) {
  const type = typeOf(value);
  let text;
  if (type === "object" || type === "function") {
    text = knownName(value);
  } else if (type === "number") {
    text = is(value, -0) ? "-0" : toText(value);
  } else if (type === "bigint") {
    text = `${toText(value)}n`;
  } else if (type === "string") {
    text =
      value.length > RETURNED_TEXT_LIMIT
        ? `${apply(stringSlice, value, [0, RETURNED_TEXT_LIMIT])}...`
        : value;
  } else {
    text = toText(value);
  }
  return { type, text };
}

/** The name of a harness value `value` is, or null. */
function knownName(value) {
  for (let index = 0; index < KNOWN_VALUES.length; index += 1) {
    if (is(value, KNOWN_VALUES[index][0])) return KNOWN_VALUES[index][1];
  }
  return null;
}

/** Whether `value` is one of the two recording Proxies. */
function isArgumentProxy(value) {
  return is(value, firstProxy) || is(value, secondProxy);
}

/**
 * A Proxy over a function whose handler carries every trap, each recording
 * its invocation in `trapLog` and then forwarding to `Reflect`.
 */
function recordingProxy(label) {
  const handler = { __proto__: null };
  for (let index = 0; index < TRAPS.length; index += 1) {
    const trap = TRAPS[index];
    const forward = forwards[trap];
    handler[trap] = (...args) => {
      append(trapLog, { proxy: label, trap });
      return apply(forward, undefined, args);
    };
  }
  return new ProxyConstructor(function xspecProxyTarget() {}, handler);
}

/** `typeof value`, null reading as "null". */
function typeOf(value) {
  return value === null ? "null" : typeof value;
}

/**
 * A thrown value's type, and its name, code, message, and stack; a
 * recording Proxy by its type alone, never read.
 */
function describeThrown(thrown) {
  const type = typeOf(thrown);
  const readable =
    (type === "object" || type === "function") && !isArgumentProxy(thrown);
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
  const readable =
    (described.type === "object" || described.type === "function") &&
    !isArgumentProxy(warning);
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

/** Append `value` to `array`, through no method the package can replace. */
function append(array, value) {
  defineProperty(array, array.length, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
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
