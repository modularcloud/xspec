// Harness-owned wrapper for a run from a working directory it entered before
// the harness took the directory's permissions away (TEST-SPEC T14-10(k) and
// (l)(iii): "a process keeps a working directory it entered before the
// permissions went, as a wrapper may arrange between changing directory and
// running the product"; H-2's controlled working directory). Harness code,
// never product code, and it imports none: the driver
// (helpers/subprocess.ts `runProductInEnteredDirectory`) spawns it with the
// run's working directory — the spawn enters it — and an environment of its
// own, empty, so nothing the product's environment carries reaches it; once
// the harness has staged the directory and verified the staging on itself,
// the wrapper replaces itself with the product through `process.execve`
// (Node.js 22.15 and later), so the product is the very process the driver
// spawned — its process identifier, process group, file descriptors 0–2,
// exit code, and terminating signal its own — standing in the directory the
// spawn entered, with exactly the command, argv, and environment the driver
// resolved for it. It writes nothing to standard output or standard error,
// which are the product's.
//
// Its control channel is file descriptor 3, the driver's, one JSON object
// per line:
//   wrapper -> driver   {"ready":true}   once it runs;
//   driver -> wrapper   {"command":"/abs/path","args":[...],"env":{...}}
//                       once the harness has staged the directory;
//   wrapper -> driver   {"exec":true}    just before it closes the channel
//                       and execs (`process.execve` keeps descriptors 0–2
//                       alone in any case, so the product never inherits
//                       the channel; closing it first ends it before the
//                       product runs);
//   wrapper -> driver   {"failed":"..."} instead, when it cannot run the job
//                       — the command no absolute path to an executable
//                       regular file, a NUL byte where none can stand, an
//                       unreadable job, a channel closed before the job —
//                       and it then exits 70, the product never started.
// A `process.execve` that fails past those checks aborts the process,
// Node.js naming the error code on standard error ("process.execve failed
// with error code ..."), which the driver reads as the wrapper's failure,
// never the product's outcome.

import fs from "node:fs";

const CONTROL_FD = 3;
const FAILED_EXIT_CODE = 70;
const NUL = String.fromCharCode(0);

/** Write one message to the driver, whole. */
function send(message) {
  const bytes = Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
  let written = 0;
  while (written < bytes.length) {
    written += fs.writeSync(CONTROL_FD, bytes, written, bytes.length - written);
  }
}

/** The driver's next line, or undefined once it closed the channel. */
function receiveLine() {
  const chunks = [];
  const buffer = Buffer.alloc(64 * 1024);
  for (;;) {
    const count = fs.readSync(CONTROL_FD, buffer, 0, buffer.length, null);
    if (count === 0) return undefined;
    const chunk = Buffer.from(buffer.subarray(0, count));
    const newline = chunk.indexOf(0x0a);
    if (newline !== -1) {
      chunks.push(chunk.subarray(0, newline));
      return Buffer.concat(chunks).toString("utf8");
    }
    chunks.push(chunk);
  }
}

/** Report why the product cannot be started, then end without it. */
function fail(why) {
  try {
    send({ failed: why });
  } catch {
    // The driver closed the channel: its own diagnosis stands.
  }
  process.exit(FAILED_EXIT_CODE);
}

function describe(thrown) {
  if (typeof thrown === "object" && thrown !== null && "code" in thrown) {
    return String(thrown.code);
  }
  return thrown instanceof Error ? thrown.message : String(thrown);
}

/** What keeps the job from running, or undefined when nothing does. */
function problemWith(job) {
  if (typeof job !== "object" || job === null) return "the job is no object";
  const { command, args, env } = job;
  if (typeof command !== "string" || !command.startsWith("/")) {
    return `the command ${JSON.stringify(command)} is no absolute path`;
  }
  if (!Array.isArray(args) || !args.every((arg) => typeof arg === "string")) {
    return "the arguments are not all strings";
  }
  if (
    typeof env !== "object" ||
    env === null ||
    !Object.values(env).every((value) => typeof value === "string")
  ) {
    return "the environment's values are not all strings";
  }
  const texts = [command, ...args, ...Object.keys(env), ...Object.values(env)];
  if (texts.some((text) => text.includes(NUL))) {
    return "a NUL byte, which no argv or environment string can carry";
  }
  let stats;
  try {
    stats = fs.statSync(command);
  } catch (thrown) {
    return `the command ${command} cannot be examined: ${describe(thrown)}`;
  }
  if (!stats.isFile()) return `the command ${command} is no regular file`;
  try {
    fs.accessSync(command, fs.constants.X_OK);
  } catch (thrown) {
    return `the command ${command} is not executable: ${describe(thrown)}`;
  }
  return undefined;
}

let job;
try {
  send({ ready: true });
  const line = receiveLine();
  if (line === undefined) {
    fail("the driver closed the control channel before sending the job");
  }
  job = JSON.parse(line);
  const problem = problemWith(job);
  if (problem !== undefined) fail(problem);
  send({ exec: true });
  fs.closeSync(CONTROL_FD);
} catch (thrown) {
  fail(describe(thrown));
}
try {
  process.execve(job.command, [job.command, ...job.args], job.env);
} catch (thrown) {
  // Unreachable past the checks above; read as the wrapper's failure, as a
  // failed exec's own abort is.
  fs.writeSync(2, `process.execve failed: ${describe(thrown)}\n`);
  process.abort();
}
