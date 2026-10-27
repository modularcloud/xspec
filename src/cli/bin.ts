#!/usr/bin/env node
// The `xspec` executable: a trivial wrapper binding the CLI entry point
// `(argv, cwd, stdout, stderr) → exit code` (cli/reruns.ts
// `runInvocation`) to the process (IMPLEMENTATION Architecture). It sets
// `process.exitCode` rather than calling `process.exit()`, so pending
// stream writes flush before the process exits. The entry runs the
// invocation on this thread and, should that attempt exhaust the call
// stack before its first effect, again from the start on a worker thread
// with a larger stack, forwarding its output (SPEC 14.20, 12.0;
// cli/reruns.ts): the exit code is the completing attempt's.
//
// The on-disk V8 compile cache (node:module `enableCompileCache`) is
// enabled before any product module loads — the entry is imported
// dynamically so the whole module graph compiles through the cache, and a
// rerun's worker enables it as well (cli/rerun-worker.ts). The cache
// changes no observable behavior (SPEC 12.0: every output is a function of
// the workspace bytes, never of timing) and lives outside the workspace
// (Node's default cache directory); it only removes repeated parse/compile
// cost from every CLI invocation. Best-effort by design: where the cache
// directory is unusable, Node silently runs without it.
//
// The working directory reaches the entry as data, read here once. A
// working directory removed before the process started has no path: the
// platform's getcwd fails with ENOENT, and the entry receives `null` — a
// working directory that holds nothing and from which no relative path
// leads anywhere — never an internal error. SPEC 12.0's exit classes then
// partition the outcome as for any other working directory: `version`
// still answers (12.6: it consults no workspace, in any working
// directory), syntax-class usage errors keep exit 2, and every other
// command meets missing configuration (7, 14.14, its concerned path `.`
// with no `--config`, 14) unless an absolute `--config` names its
// configuration, whose anchoring spellings then take the platform's
// absolute form (11.6, 14, 14.25; cli/main.ts, workspace/locate.ts).

import { enableCompileCache } from "node:module";

enableCompileCache();

const { runInvocation } = await import("./reruns.js");

/**
 * The invocation working directory, or `null` when it has no path — a
 * directory removed before the process started, at which getcwd fails with
 * ENOENT (SPEC 12.6, 7, 14, 14.25, 11.6: see the module header). Any other
 * failure propagates as the internal error it is.
 */
function invocationWorkingDirectory(): string | null {
  try {
    return process.cwd();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

try {
  process.exitCode = await runInvocation(
    process.argv.slice(2),
    invocationWorkingDirectory(),
    process.stdout,
    process.stderr,
  );
} catch (error) {
  // An internal defect, not a defined SPEC 12.0 outcome — the entry reports
  // every one its attempts meet itself (cli/reruns.ts), so this is one of
  // the entry's own, or of the working directory's read. Exit outside the
  // 0/1/2 partition so a crash can never be mistaken for a defined failure
  // class; the stack goes to stderr for diagnosis.
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`xspec: internal error: ${detail}\n`);
  process.exitCode = 70;
}
