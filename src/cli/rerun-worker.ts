// The worker side of a rerun on a larger stack (cli/reruns.ts): one attempt
// of the invocation `workerData` names, on this thread's stack, its output
// written to this thread's standard output and standard error — which reach
// the calling thread's writers — and its outcome posted back.
//
// As in the bin (cli/bin.ts), the on-disk V8 compile cache is enabled
// before any product module loads, so the rerun's module graph compiles
// through it; it changes no observable behavior (SPEC 12.0).

import { enableCompileCache } from "node:module";
import { parentPort, workerData } from "node:worker_threads";

enableCompileCache();

const { runWorkerAttempt } = await import("./reruns.js");

const outcome = await runWorkerAttempt(
  workerData,
  process.stdout,
  process.stderr,
);
parentPort?.postMessage(outcome);
