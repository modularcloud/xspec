// The module channel's warning calibration on a Node.js release (TEST-SPEC
// T7.6-7(a), S-10, S-3). Harness code, never product code, and it imports
// none: helpers/module-channel-node.ts (`learnWarningForm`) copies these
// bytes into a fresh directory of its own under the OS temporary directory
// and runs
//
//   <release>/bin/node <this file> <report> <warnings>
//
// as a module run is run — no option before this file, a fresh HOME and
// TMPDIR, the harness's PATH, and nothing else in the environment — through
// the subprocess driver under its own hang guard, so the release prints
// warnings exactly as it prints them in a module run. `<warnings>` is a
// JSON array of the warnings to emit, each `{ type, code, message, detail }`
// (`code` and `detail` null where the warning carries none).
//
// It registers a `warning` listener on `process`, recording each warning
// the runtime delivers as the bootstrap's listener records it, and an
// `exit` listener writing the report — its protocol, the process
// identifier, and the warnings delivered — to `<report>`; then it emits
// each warning through `process.emitWarning`, in order. The release prints
// each one to standard error as it prints its own, and the driver learns
// the release's printed form from that output beside the report. Nothing
// here writes to standard output or standard error itself, sets a timer,
// or keeps the process alive.

"use strict";

const fs = require("node:fs");

/** The report's protocol, which the driver's decoder requires. */
const PROTOCOL = "xspec-warning-calibration/1";

const reportPath = process.argv[2];
const emitted = JSON.parse(process.argv[3]);
const warnings = [];

process.on("warning", (warning) => {
  const type = warning === null ? "null" : typeof warning;
  const readable = type === "object" || type === "function";
  warnings.push({
    type,
    name: readable ? readText(warning, "name") : null,
    code: readable ? readText(warning, "code") : null,
    message: readable ? readText(warning, "message") : null,
    detail: readable ? readText(warning, "detail") : null,
    stack: readable ? readText(warning, "stack") : null,
  });
});
process.on("exit", () => {
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ protocol: PROTOCOL, pid: process.pid, warnings }),
  );
});

for (const warning of emitted) {
  process.emitWarning(warning.message, {
    type: warning.type,
    code: warning.code === null ? undefined : warning.code,
    detail: warning.detail === null ? undefined : warning.detail,
  });
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
