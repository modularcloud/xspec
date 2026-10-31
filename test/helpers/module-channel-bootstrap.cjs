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
//    prototype, or `process` does not reach the report; and from then on it
//    neither iterates an array through its prototype (no array
//    destructuring, spread, or `for...of`) nor assigns a property it has
//    not defined, so nothing the module installs there runs either, but
//    for a `toJSON` the report's serialization looks up.
// 2. It reads the run's conditions — its arguments, the release's version,
//    executable, and options (`process.execArgv`), the process identifier,
//    the environment, and the working directory — which the driver checks
//    against those it set (TEST-SPEC T7.6-6's run conditions, S-10).
// 3. It makes T7.6-6's call values (below): the identity values, the two
//    recording Proxies, and the frozen object.
// 4. It registers a `warning` listener on `process`, recording each warning
//    the runtime delivers, in order (TEST-SPEC T7.6-7(a)), and an `exit`
//    listener writing the report as the process exits.
// 5. It reads T7.6-7(c)'s process state (below) twice: once to settle it —
//    the runtime materializes some of the global object's properties on
//    their first read (lazy data properties: on 22.23.4 and later, reading
//    `FormData`'s descriptor loads the runtime's own fetch implementation,
//    which adds a symbol-keyed global), and creates `process.stdout` and
//    `process.stderr` on theirs — and then as the baseline the run's state
//    is compared against, the listeners of step 4 among it.
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
// Once the calls are made, the process state is read again and compared,
// in the run, with the baseline (TEST-SPEC T7.6-7(c): unchanged across the
// load and the calls), each difference recorded under the observation that
// found it — the names the driver's `STATE_OBSERVATIONS` lists:
// - `global-object`: the global object's own properties, string- and
//   symbol-keyed, with their descriptors, read without invoking an accessor
//   (a property added, removed, or changed in its kind, value, getter,
//   setter, or attributes, each value compared by `Object.is`);
// - `built-ins`: likewise, the own properties of the global built-in
//   constructors and namespace objects and of those constructors'
//   prototypes — here every string-keyed own data property of the global
//   object, as the baseline reads it, holding an object or a function (the
//   global object itself and `process` aside: ECMAScript's constructors and
//   namespace objects, the runtime's own, and the other built-in objects
//   and functions the global object holds, a superset of TEST-SPEC's),
//   each labeled by its key, and each such function's own `prototype` data
//   property holding an object or a function, labeled `<key>.prototype`,
//   each object observed once, under its first label;
// - `extensibility` and `prototype`: the extensibility and the prototype of
//   each of these objects, the global object and `process` included;
// - `process`: `process`'s own properties with their descriptors, read
//   likewise;
// - `environment`: `process.env`'s variables and their values;
// - `title`: the process title; `working-directory`: the working directory
//   (`process.cwd()`, called as captured in step 1); `exit-code`:
//   `process.exitCode`;
// - `stream-write`: the `write` each of `process.stdout` and
//   `process.stderr` resolves to, compared by identity;
// - `listeners`: the listeners registered on `process`, each event's in
//   order, compared by identity — the `warning` and `exit` listeners of
//   step 4 among them;
// - `timers-and-handles`: the pending timers and handles the runtime
//   reports — its active handles (`process._getActiveHandles()`), compared
//   by identity, and its pending timers and immediates
//   (`process.getActiveResourcesInfo()`'s `Timeout` and `Immediate`
//   entries), counted — never its pending requests, which its own loading
//   leaves in flight (an ES module's file handle still closing on 22.0 to
//   22.12, say).
// A read the module makes fail is a difference too. The objects compared
// are those the baseline found (a global replaced is a change of the global
// object's, the replaced object still observed); values are named by their
// type, a primitive's text, or an observed object's label, so nothing of
// the package's runs while they are described. At most `STATE_CHANGE_LIMIT`
// differences are listed, the rest counted.
//
// The report is one JSON document, whose members the driver's decoder
// (`decodeModuleRunReport`) reads exactly, written to the path the driver
// names: once the load and the calls have completed, or the load has
// failed, and again as the process exits, then holding the exit code and
// every warning delivered and trap invoked by then. Its phase is `loading`
// until the load hands back a value or throws, `calling` while the calls
// run and the state is compared — so a process ending inside a call is
// reported as such — and `completed` after, the comparison (`state`: the
// labels of the objects observed, the differences, and how many more were
// left unlisted) set with it where the module loaded, and null otherwise.
// Each write goes to a sibling `.partial` file renamed
// over the report, so the driver reads a whole document or none. A process
// ending before both writes — killed by a signal, or exiting without
// running its `exit` listeners while still loading — leaves none, which
// the driver reports as such. Nothing here writes to standard output or
// standard error, sets a timer, or keeps the process alive.

"use strict";

const fs = require("node:fs");
const url = require("node:url");
const events = require("node:events");

// 1. The built-ins called once loading has begun.
const writeFileSync = fs.writeFileSync;
const renameSync = fs.renameSync;
const pathToFileURL = url.pathToFileURL;
const stringify = JSON.stringify;
const defineProperty = Reflect.defineProperty;
const apply = Reflect.apply;
const ownKeys = Reflect.ownKeys;
const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
const getPrototypeOf = Reflect.getPrototypeOf;
const isExtensible = Reflect.isExtensible;
const hasOwn = Object.hasOwn;
const objectKeys = Object.keys;
const is = Object.is;
const freeze = Object.freeze;
const promiseThen = Promise.prototype.then;
const stringSlice = String.prototype.slice;
const arraySort = Array.prototype.sort;
const toText = String;
const ProxyConstructor = Proxy;
const MapConstructor = Map;
const mapGet = Map.prototype.get;
const mapSet = Map.prototype.set;
const mapHas = Map.prototype.has;
const symbolDescription = getOwnPropertyDescriptor(
  Symbol.prototype,
  "description",
).get;
const eventNames = events.EventEmitter.prototype.eventNames;
const rawListeners = events.EventEmitter.prototype.rawListeners;
const processCwd = process.cwd;
const getActiveResourcesInfo = process.getActiveResourcesInfo;
const getActiveHandles = process._getActiveHandles;
const globalObject = globalThis;

/** The report's protocol, which the driver's decoder requires. */
const PROTOCOL = "xspec-module-run/3";

/** How much of a returned string a call's description keeps. */
const RETURNED_TEXT_LIMIT = 200;

/** The most differences in process state a report lists (header). */
const STATE_CHANGE_LIMIT = 100;

/** How much of a string a difference's description keeps. */
const DESCRIBED_TEXT_LIMIT = 80;

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
  state: null,
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
 * threw, and, where it loaded, how the process state compares with the
 * baseline once the calls are made (header). Each phase's members are set
 * together, with no code of the package's between them, so a report written
 * at any exit is consistent.
 */
async function load() {
  const asModule =
    route === "static-import" || route === "dynamic-import-from-module";
  const asCommonJs =
    route === "dynamic-import-from-commonjs" || route === "require";
  if (!asModule && !asCommonJs) {
    throw new TypeError(`no route is named ${stringify(route)}`);
  }
  // 5. The state settled, then read as the baseline, before the importing
  // module's own loading begins.
  readState(listSubjects());
  const baseline = readState(listSubjects());
  requireReadable(baseline);
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
  const state = compareStates(baseline, readState(baseline.subjects));
  report.state = state;
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

// T7.6-7(c): the process state (header).

/**
 * The objects the state reads (header), each `{ label, object, observation
 * }`: the global object; the built-ins — each string-keyed own data
 * property of the global object holding an object or a function, the
 * global object and `process` aside, and each such function's own
 * `prototype` data property holding one, each object once, under its first
 * label; and `process`.
 */
function listSubjects() {
  const subjects = [
    {
      label: "the global object",
      object: globalObject,
      observation: "global-object",
    },
  ];
  const seen = new MapConstructor();
  apply(mapSet, seen, [globalObject, true]);
  apply(mapSet, seen, [process, true]);
  const keys = ownKeys(globalObject);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (typeof key !== "string") continue;
    const value = dataValue(globalObject, key);
    if (!isObjectLike(value) || apply(mapHas, seen, [value])) continue;
    apply(mapSet, seen, [value, true]);
    append(subjects, { label: key, object: value, observation: "built-ins" });
    if (typeof value !== "function") continue;
    const prototype = dataValue(value, "prototype");
    if (!isObjectLike(prototype) || apply(mapHas, seen, [prototype])) continue;
    apply(mapSet, seen, [prototype, true]);
    append(subjects, {
      label: `${key}.prototype`,
      object: prototype,
      observation: "built-ins",
    });
  }
  append(subjects, {
    label: "process",
    object: process,
    observation: "process",
  });
  return subjects;
}

/** `object`'s own data property `key`'s value; undefined where it has none. */
function dataValue(object, key) {
  const descriptor = getOwnPropertyDescriptor(object, key);
  return descriptor !== undefined && hasOwn(descriptor, "value")
    ? descriptor.value
    : undefined;
}

/** Whether `value` is an object or a function. */
function isObjectLike(value) {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
}

/**
 * The process state as (c) reads it (header): each subject's own
 * properties, extensibility, and prototype, and each other observation's
 * reading, every one `{ ok: true, value }`, or `{ ok: false, error }` where
 * the read threw.
 */
function readState(subjects) {
  const objects = [];
  for (let index = 0; index < subjects.length; index += 1) {
    const object = subjects[index].object;
    append(
      objects,
      attempt(() => readObject(object)),
    );
  }
  return {
    subjects,
    objects,
    environment: attempt(readEnvironment),
    title: attempt(() => process.title),
    workingDirectory: attempt(() => apply(processCwd, process, [])),
    exitCode: attempt(() => process.exitCode),
    stdoutWrite: attempt(() => process.stdout.write),
    stderrWrite: attempt(() => process.stderr.write),
    listeners: attempt(readListeners),
    pending: attempt(readPending),
  };
}

/**
 * `object`'s own properties, in its own order, each with its descriptor,
 * and its extensibility and prototype.
 */
function readObject(object) {
  const keys = ownKeys(object);
  const order = [];
  const properties = new MapConstructor();
  for (let index = 0; index < keys.length; index += 1) {
    const descriptor = readDescriptor(object, keys[index]);
    if (descriptor === null) continue;
    append(order, keys[index]);
    apply(mapSet, properties, [keys[index], descriptor]);
  }
  return {
    order,
    properties,
    extensible: isExtensible(object),
    prototype: getPrototypeOf(object),
  };
}

/**
 * `object`'s own property `key`'s descriptor, its members read as its own,
 * so no accessor is invoked and nothing inherited consulted; null where it
 * has none.
 */
function readDescriptor(object, key) {
  const descriptor = getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined) return null;
  if (hasOwn(descriptor, "get")) {
    return {
      accessor: true,
      value: undefined,
      writable: false,
      get: descriptor.get,
      set: descriptor.set,
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
    };
  }
  return {
    accessor: false,
    value: descriptor.value,
    writable: descriptor.writable,
    get: undefined,
    set: undefined,
    enumerable: descriptor.enumerable,
    configurable: descriptor.configurable,
  };
}

/** `process.env`'s variables, by name, each `[name, value]`. */
function readEnvironment() {
  const environment = process.env;
  const names = apply(arraySort, objectKeys(environment), []);
  const entries = [];
  for (let index = 0; index < names.length; index += 1) {
    append(entries, [names[index], toText(environment[names[index]])]);
  }
  return entries;
}

/** The listeners registered on `process`: each event's `[name, listeners]`. */
function readListeners() {
  const names = apply(eventNames, process, []);
  const listing = [];
  for (let index = 0; index < names.length; index += 1) {
    append(listing, [
      names[index],
      apply(rawListeners, process, [names[index]]),
    ]);
  }
  return listing;
}

/**
 * The pending timers and handles the runtime reports (header): its active
 * handles, and its pending timers and immediates, counted.
 */
function readPending() {
  const resources = apply(getActiveResourcesInfo, process, []);
  let timeouts = 0;
  let immediates = 0;
  for (let index = 0; index < resources.length; index += 1) {
    if (resources[index] === "Timeout") timeouts += 1;
    else if (resources[index] === "Immediate") immediates += 1;
  }
  return {
    handles: apply(getActiveHandles, process, []),
    timeouts,
    immediates,
  };
}

/** `read()`'s value, `{ ok: true, value }`, or what it threw. */
function attempt(read) {
  try {
    return { ok: true, value: read(), error: null };
  } catch (error) {
    return { ok: false, value: undefined, error: describeThrown(error) };
  }
}

/** Throw where the baseline could not read a part of the state. */
function requireReadable(state) {
  for (let index = 0; index < state.objects.length; index += 1) {
    const reading = state.objects[index];
    if (!reading.ok) {
      throw new TypeError(
        `the baseline could not read ${state.subjects[index].label}: ` +
          describeError(reading.error),
      );
    }
  }
  const readings = [
    ["process.env", state.environment],
    ["the process title", state.title],
    ["the working directory", state.workingDirectory],
    ["process.exitCode", state.exitCode],
    ["process.stdout.write", state.stdoutWrite],
    ["process.stderr.write", state.stderrWrite],
    ["the listeners registered on process", state.listeners],
    ["the pending timers and handles", state.pending],
  ];
  for (let index = 0; index < readings.length; index += 1) {
    if (!readings[index][1].ok) {
      throw new TypeError(
        `the baseline could not read ${readings[index][0]}: ` +
          describeError(readings[index][1].error),
      );
    }
  }
}

/**
 * How `after` differs from `baseline` (header): `{ subjects, changes,
 * omitted }` — the labels of the objects observed, each difference `{
 * observation, subject, detail }`, at most `STATE_CHANGE_LIMIT` of them, and
 * how many more were found.
 */
function compareStates(baseline, after) {
  const labels = new MapConstructor();
  const subjectLabels = [];
  for (let index = 0; index < baseline.subjects.length; index += 1) {
    const subject = baseline.subjects[index];
    apply(mapSet, labels, [subject.object, subject.label]);
    append(subjectLabels, subject.label);
  }
  const result = { subjects: subjectLabels, changes: [], omitted: 0 };
  const record = (observation, subject, detail) => {
    if (result.changes.length < STATE_CHANGE_LIMIT) {
      append(result.changes, { observation, subject, detail });
    } else {
      result.omitted += 1;
    }
  };
  for (let index = 0; index < baseline.subjects.length; index += 1) {
    const subject = baseline.subjects[index];
    const reading = after.objects[index];
    if (!reading.ok) {
      record(
        subject.observation,
        subject.label,
        `its own properties could not be read afterwards: ` +
          describeError(reading.error),
      );
      continue;
    }
    compareObject(
      subject,
      baseline.objects[index].value,
      reading.value,
      labels,
      record,
    );
  }
  const compareValue = (before, now, add) => {
    if (!is(before, now)) {
      add(
        `it changed from ${describeValue(before, labels)} to ` +
          describeValue(now, labels),
      );
    }
  };
  const compareWrite = (before, now, add) => {
    if (!is(before, now)) {
      add(
        `it now resolves to ` +
          (typeof now === "function"
            ? "another function"
            : describeValue(now, labels)) +
          `, no longer to the one it resolved to before`,
      );
    }
  };
  const readings = [
    ["environment", "process.env", "environment", compareEnvironment],
    ["title", "the process title", "title", compareValue],
    [
      "working-directory",
      "the working directory",
      "workingDirectory",
      compareValue,
    ],
    ["exit-code", "process.exitCode", "exitCode", compareValue],
    ["stream-write", "process.stdout.write", "stdoutWrite", compareWrite],
    ["stream-write", "process.stderr.write", "stderrWrite", compareWrite],
    [
      "listeners",
      "the listeners registered on process",
      "listeners",
      compareListeners,
    ],
    [
      "timers-and-handles",
      "the pending timers and handles",
      "pending",
      comparePending,
    ],
  ];
  for (let index = 0; index < readings.length; index += 1) {
    const reading = readings[index];
    const observation = reading[0];
    const subject = reading[1];
    const part = reading[2];
    const compare = reading[3];
    const now = after[part];
    const add = (detail) => {
      record(observation, subject, detail);
    };
    if (!now.ok) {
      add(`it could not be read afterwards: ${describeError(now.error)}`);
    } else {
      compare(baseline[part].value, now.value, add);
    }
  }
  return result;
}

/**
 * Each difference in one subject's own properties, its extensibility, and
 * its prototype, recorded under its observation.
 */
function compareObject(subject, before, after, labels, record) {
  const label = subject.label;
  const observation = subject.observation;
  for (let index = 0; index < before.order.length; index += 1) {
    const key = before.order[index];
    const was = apply(mapGet, before.properties, [key]);
    if (!apply(mapHas, after.properties, [key])) {
      record(
        observation,
        label,
        `its own property ${describeKey(key)} was removed: it was ` +
          describeDescriptor(was, labels),
      );
      continue;
    }
    const now = apply(mapGet, after.properties, [key]);
    if (!sameDescriptor(was, now)) {
      record(
        observation,
        label,
        `its own property ${describeKey(key)} changed from ` +
          `${describeDescriptor(was, labels)} to ` +
          describeDescriptor(now, labels),
      );
    }
  }
  for (let index = 0; index < after.order.length; index += 1) {
    const key = after.order[index];
    if (!apply(mapHas, before.properties, [key])) {
      record(
        observation,
        label,
        `an own property ${describeKey(key)} was added: ` +
          describeDescriptor(apply(mapGet, after.properties, [key]), labels),
      );
    }
  }
  if (before.extensible !== after.extensible) {
    record(
      "extensibility",
      label,
      before.extensible
        ? "it was extensible and no longer is"
        : "it was not extensible and now is",
    );
  }
  if (!is(before.prototype, after.prototype)) {
    record(
      "prototype",
      label,
      `its prototype changed from ${describeValue(before.prototype, labels)} ` +
        `to ${describeValue(after.prototype, labels)}`,
    );
  }
}

/** Whether two descriptors are alike, each value compared by `Object.is`. */
function sameDescriptor(left, right) {
  return (
    left.accessor === right.accessor &&
    is(left.value, right.value) &&
    is(left.get, right.get) &&
    is(left.set, right.set) &&
    left.writable === right.writable &&
    left.enumerable === right.enumerable &&
    left.configurable === right.configurable
  );
}

/** Each variable of `process.env` set, removed, or changed. */
function compareEnvironment(before, after, add) {
  const was = new MapConstructor();
  const now = new MapConstructor();
  for (let index = 0; index < before.length; index += 1) {
    apply(mapSet, was, [before[index][0], before[index][1]]);
  }
  for (let index = 0; index < after.length; index += 1) {
    apply(mapSet, now, [after[index][0], after[index][1]]);
  }
  for (let index = 0; index < before.length; index += 1) {
    const name = before[index][0];
    const value = before[index][1];
    if (!apply(mapHas, now, [name])) {
      add(
        `its variable ${stringify(name)} was removed: it held ` +
          describePrimitive(value, "string"),
      );
    } else if (apply(mapGet, now, [name]) !== value) {
      add(
        `its variable ${stringify(name)} changed from ` +
          `${describePrimitive(value, "string")} to ` +
          describePrimitive(apply(mapGet, now, [name]), "string"),
      );
    }
  }
  for (let index = 0; index < after.length; index += 1) {
    const name = after[index][0];
    const value = after[index][1];
    if (!apply(mapHas, was, [name])) {
      add(
        `a variable ${stringify(name)} was set to ` +
          describePrimitive(value, "string"),
      );
    }
  }
}

/** Each event whose listeners on `process` differ, by identity and order. */
function compareListeners(before, after, add) {
  const was = new MapConstructor();
  const now = new MapConstructor();
  for (let index = 0; index < before.length; index += 1) {
    apply(mapSet, was, [before[index][0], before[index][1]]);
  }
  for (let index = 0; index < after.length; index += 1) {
    apply(mapSet, now, [after[index][0], after[index][1]]);
  }
  const names = [];
  for (let index = 0; index < before.length; index += 1) {
    append(names, before[index][0]);
  }
  for (let index = 0; index < after.length; index += 1) {
    if (!apply(mapHas, was, [after[index][0]])) append(names, after[index][0]);
  }
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];
    const listenersBefore = apply(mapHas, was, [name])
      ? apply(mapGet, was, [name])
      : [];
    const listenersAfter = apply(mapHas, now, [name])
      ? apply(mapGet, now, [name])
      : [];
    let alike = listenersBefore.length === listenersAfter.length;
    for (let at = 0; alike && at < listenersBefore.length; at += 1) {
      alike = is(listenersBefore[at], listenersAfter[at]);
    }
    if (!alike) {
      add(
        `the event ${describeKey(name)} had ` +
          `${toText(listenersBefore.length)} listener(s) and has ` +
          `${toText(listenersAfter.length)}` +
          (listenersBefore.length === listenersAfter.length
            ? ", not the same ones in the same order"
            : ""),
      );
    }
  }
}

/** Each change in the active handles and the pending timers and immediates. */
function comparePending(before, after, add) {
  if (before.timeouts !== after.timeouts) {
    add(
      `${toText(before.timeouts)} timer(s) were pending (Timeout), and ` +
        `${toText(after.timeouts)} are`,
    );
  }
  if (before.immediates !== after.immediates) {
    add(
      `${toText(before.immediates)} immediate(s) were pending (Immediate), ` +
        `and ${toText(after.immediates)} are`,
    );
  }
  const was = new MapConstructor();
  const now = new MapConstructor();
  for (let index = 0; index < before.handles.length; index += 1) {
    apply(mapSet, was, [before.handles[index], true]);
  }
  for (let index = 0; index < after.handles.length; index += 1) {
    apply(mapSet, now, [after.handles[index], true]);
  }
  for (let index = 0; index < after.handles.length; index += 1) {
    if (!apply(mapHas, was, [after.handles[index]])) {
      add(
        `a handle (${describeHandle(after.handles[index])}) is active that ` +
          `was not`,
      );
    }
  }
  for (let index = 0; index < before.handles.length; index += 1) {
    if (!apply(mapHas, now, [before.handles[index]])) {
      add(
        `a handle (${describeHandle(before.handles[index])}) is no longer ` +
          `active`,
      );
    }
  }
}

/** An active handle, by its constructor's name, read from descriptors. */
function describeHandle(handle) {
  try {
    const prototype = isObjectLike(handle) ? getPrototypeOf(handle) : null;
    const constructor = isObjectLike(prototype)
      ? dataValue(prototype, "constructor")
      : undefined;
    const name =
      typeof constructor === "function"
        ? dataValue(constructor, "name")
        : undefined;
    return typeof name === "string" && name !== "" ? name : typeOf(handle);
  } catch {
    return typeOf(handle);
  }
}

/** A property key, in words: a string as JSON, a symbol by its description. */
function describeKey(key) {
  return typeof key === "symbol"
    ? `Symbol(${describeSymbol(key) ?? ""})`
    : stringify(key);
}

/** A descriptor, in words: its kind, attributes, and value or functions. */
function describeDescriptor(descriptor, labels) {
  const attributes =
    `${descriptor.enumerable ? "enumerable" : "not enumerable"}, ` +
    (descriptor.configurable ? "configurable" : "not configurable");
  return descriptor.accessor
    ? `an accessor property (${attributes}) whose getter is ` +
        `${describeValue(descriptor.get, labels)} and setter ` +
        describeValue(descriptor.set, labels)
    : `a data property (${descriptor.writable ? "writable" : "not writable"}, ` +
        `${attributes}) holding ${describeValue(descriptor.value, labels)}`;
}

/**
 * A value, in words, without running anything of the package's: an observed
 * object by its label, any other object or function by its type, a
 * primitive by its text.
 */
function describeValue(value, labels) {
  const type = typeOf(value);
  if (type === "object" || type === "function") {
    if (apply(mapHas, labels, [value])) return apply(mapGet, labels, [value]);
    return type === "function" ? "a function" : "an object";
  }
  return describePrimitive(value, type);
}

/** A primitive of type `type`, in words. */
function describePrimitive(value, type) {
  switch (type) {
    case "number":
      return is(value, -0) ? "-0" : toText(value);
    case "bigint":
      return `${toText(value)}n`;
    case "string":
      return stringify(
        value.length > DESCRIBED_TEXT_LIMIT
          ? `${apply(stringSlice, value, [0, DESCRIBED_TEXT_LIMIT])}...`
          : value,
      );
    case "symbol":
      return `Symbol(${describeSymbol(value) ?? ""})`;
    default:
      return toText(value);
  }
}

/** A thrown value's description (`describeThrown`), in words. */
function describeError(thrown) {
  const head = thrown.name ?? `a value of type ${thrown.type}`;
  return thrown.message === null
    ? head
    : `${head}: ${describePrimitive(thrown.message, "string")}`;
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
