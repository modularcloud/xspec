// The CLI entry point: an invocation's attempts, and its reruns on larger
// stacks (SPEC 14.20, 14.14, 12.0, 12.1; IMPLEMENTATION Architecture).
//
// IMPLEMENTATION: the entry point is a function `(argv, cwd, stdout,
// stderr) → exit code` — `runInvocation` — and the bin (bin.ts) a trivial
// wrapper around it. An invocation runs `main` (cli/main.ts) as one attempt
// or more, each from the start with the same arguments and the same
// working-directory value (a path, or null): the first on the calling
// thread and, should it meet a call-stack overflow before its first
// effect, the next on a fresh `node:worker_threads` Worker with a larger
// stack, `RERUN_STACK_SIZES_MB` in order, the last size the last attempt.
//
// Why: SPEC 14.20 decides well-formedness by derivability alone — a
// TypeScript source is well-formed exactly when TypeScript's parser accepts
// it, name binding taking no part in the verdict, and an MDX source exactly
// when its grammar's productions derive it, however deep its expressions
// nest or long its reference chains run — so a call-stack overflow — in
// TypeScript's recursive parser or binder, in acorn's recursive descent or
// remark-mdx's walks over what it parsed, third-party recursion no rewrite
// of the product changes, or in the product's own walks — is no verdict
// about the file; and SPEC 12.0 gives the same workspace bytes the same
// answer on every run, while the calling thread's stack (under 1 MB) gives
// out at a depth that moves from run to run with how far V8's JIT has
// optimized the recursing functions.
// An attempt that completes gives the bytes stack enough gives, whichever
// it is; only the last answers from an overflow (core/stack-exhaustion.ts).
// Why not a large stack for every invocation: it only moves the bound, and
// a worker costs its start and a second load of the module graph, paid
// here only by the invocations that need it; why a whole rerun rather than
// a worker per file: a file's analysis does not cross threads (V8's
// structured clone recurses as deep as the trees it would carry, and the
// analysis context holds functions).
//
// Effects (core/stack-exhaustion.ts): an attempt stays rerunnable until
// its first effect — the first byte written to standard output or standard
// error (`effectRecording` wraps its writers) or its first filesystem
// mutation (workspace/writes.ts) — so no rerun repeats one. Every command
// analyzes its sources before it writes or answers anything (cli/main.ts),
// so an overflow in that analysis always arrives while a rerun is possible.
// Workspace exclusivity is no effect: an attempt that unwinds releases it
// (SPEC 13.5; workspace/lock.ts), and the rerun acquires afresh, past a
// hold-file seam that engages once per invocation (`AttemptCarry`).
//
// A worker's standard output and standard error reach this invocation's
// writers byte for byte, in order, under backpressure: each forwarded
// chunk is the text the worker wrote, read back as the UTF-8 it was
// written in, and the next is taken once the writer has taken it. Its
// outcome — an exit code, or exhaustion with what the next attempt needs —
// is posted back, and the attempt settles once the worker has exited and
// all its output is written. A worker that cannot be
// started at a size (`ERR_WORKER_INIT_FAILED`: a thread the platform
// cannot create, or an isolate it cannot set up) counts as an exhausted
// attempt; when the last size cannot start, the last attempt runs on the
// largest stack that started, or on the calling thread when none did. A
// worker that ends without an outcome — its heap exhausted, say — is an
// internal error, as it would be on the calling thread.

import type { Readable } from "node:stream";
import type { Worker } from "node:worker_threads";
import type { AttemptCarry } from "../core/stack-exhaustion.js";
import {
  attemptCarry,
  beginAttempt,
  FIRST_ATTEMPT,
  isStackOverflow,
  recordEffect,
  rerunPossible,
} from "../core/stack-exhaustion.js";
import type { CliWriter } from "./io.js";
import { main } from "./main.js";

/**
 * The stack sizes of the reruns, in MB (`resourceLimits.stackSizeMb`), the
 * last one the last attempt's. Measured on Node 22: the calling thread's
 * default stack (984 KB) recurses about 12,500 plain frames, 64 MB about
 * 836,000, and 1024 MB about 13.4 million; 64 MB already parses and binds
 * a 20,000-term `&&` chain, 20,000 nested parentheses, 5000 nested
 * functions, and a 20,000-branch `else if` chain. A thread's stack is
 * reserved (Linux, macOS) or committed (Windows) whole when the thread is
 * created, so the larger size is taken only where the smaller ran out.
 */
const RERUN_STACK_SIZES_MB: readonly number[] = [64, 1024];

/** The invocation an attempt runs: the entry's arguments, as given. */
interface AttemptRequest {
  readonly argv: readonly string[];
  readonly cwd: string | null;
}

/** What an attempt ends in. */
type AttemptOutcome =
  | { readonly kind: "completed"; readonly exitCode: number }
  | { readonly kind: "exhausted"; readonly carry: AttemptCarry };

/** What a worker is started with (`workerData`). */
interface WorkerAttemptData {
  readonly request: AttemptRequest;
  readonly rerunnable: boolean;
  readonly carry: AttemptCarry;
}

/** What a worker attempt came to, as the calling thread sees it. */
type WorkerAttempt =
  | { readonly kind: "unstarted" }
  | { readonly kind: "attempted"; readonly outcome: AttemptOutcome }
  | { readonly kind: "failed"; readonly error: unknown };

/**
 * The CLI entry point (IMPLEMENTATION Architecture; module header): run
 * the invocation — its first attempt on the calling thread, its reruns on
 * workers with larger stacks — and return its exit code. Every output goes
 * through `stdout` and `stderr`; the working directory arrives as data, a
 * path or null (cli/bin.ts), and every attempt receives the same value.
 * SPEC 12.0's codes are 0, 1, and 2; 70 reports an internal defect.
 */
export async function runInvocation(
  argv: readonly string[],
  cwd: string | null,
  stdout: CliWriter,
  stderr: CliWriter,
): Promise<number> {
  const request: AttemptRequest = { argv: [...argv], cwd };
  const first = await runAttempt(request, true, FIRST_ATTEMPT, stdout, stderr);
  if (first.kind === "completed") return first.exitCode;
  let carry = first.carry;
  let largestStarted: number | null = null;
  for (const [index, stackSizeMb] of RERUN_STACK_SIZES_MB.entries()) {
    const rerunnable = index < RERUN_STACK_SIZES_MB.length - 1;
    const data: WorkerAttemptData = { request, rerunnable, carry };
    const attempt = await attemptOnWorker(stackSizeMb, data, stdout, stderr);
    if (attempt.kind === "unstarted") continue;
    if (attempt.kind === "failed")
      return reportInternalError(stderr, attempt.error);
    largestStarted = stackSizeMb;
    if (attempt.outcome.kind === "completed") return attempt.outcome.exitCode;
    carry = attempt.outcome.carry;
  }
  // The last size could not start: the last attempt runs on the largest
  // stack that did, or on the calling thread when none did.
  if (largestStarted !== null) {
    const data: WorkerAttemptData = { request, rerunnable: false, carry };
    const attempt = await attemptOnWorker(largestStarted, data, stdout, stderr);
    if (attempt.kind === "failed")
      return reportInternalError(stderr, attempt.error);
    if (attempt.kind === "attempted") return exitCodeOf(attempt.outcome);
  }
  return exitCodeOf(await runAttempt(request, false, carry, stdout, stderr));
}

/**
 * The worker side of a rerun (cli/rerun-worker.ts): one attempt of the
 * invocation `data` names, its output written to this thread's `stdout`
 * and `stderr` — forwarded to the calling thread's writers — and its
 * outcome returned for posting back.
 */
export async function runWorkerAttempt(
  data: unknown,
  stdout: CliWriter,
  stderr: CliWriter,
): Promise<AttemptOutcome> {
  if (!isWorkerAttemptData(data)) {
    throw new Error("a rerun worker was started without its attempt");
  }
  return runAttempt(data.request, data.rerunnable, data.carry, stdout, stderr);
}

/**
 * One attempt of `main` on this thread: `rerunnable` false for the last.
 * An attempt that meets a call-stack overflow while still rerunnable — no
 * effect yet (core/stack-exhaustion.ts) — is exhausted, writing nothing;
 * any other throw escaping `main` is an internal defect, reported on
 * standard error with exit 70 (outside SPEC 12.0's partition, so a crash
 * is never mistaken for a defined failure class).
 */
async function runAttempt(
  request: AttemptRequest,
  rerunnable: boolean,
  carry: AttemptCarry,
  stdout: CliWriter,
  stderr: CliWriter,
): Promise<AttemptOutcome> {
  beginAttempt(rerunnable, carry);
  try {
    const exitCode = await main(
      request.argv,
      request.cwd,
      effectRecording(stdout),
      effectRecording(stderr),
    );
    return { kind: "completed", exitCode };
  } catch (error) {
    if (rerunPossible() && isStackOverflow(error)) {
      return { kind: "exhausted", carry: attemptCarry() };
    }
    return { kind: "completed", exitCode: reportInternalError(stderr, error) };
  }
}

/**
 * `writer`, each byte it is handed an effect (core/stack-exhaustion.ts): a
 * rerun would write it again.
 */
function effectRecording(writer: CliWriter): CliWriter {
  return {
    write(chunk, callback) {
      if (chunk.length > 0) recordEffect();
      return callback === undefined
        ? writer.write(chunk)
        : writer.write(chunk, callback);
    },
  };
}

/** An internal defect: its stack on standard error, exit 70. */
function reportInternalError(stderr: CliWriter, error: unknown): 70 {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  stderr.write(`xspec: internal error: ${detail}\n`);
  return 70;
}

/** The exit code of the last attempt, which no overflow leaves exhausted. */
function exitCodeOf(outcome: AttemptOutcome): number {
  if (outcome.kind === "completed") return outcome.exitCode;
  // Unreachable: an attempt begun not rerunnable is never exhausted.
  throw new Error("the last attempt ended exhausted");
}

/**
 * Run one attempt on a fresh worker with a `stackSizeMb` stack, forwarding
 * its standard output and standard error to `stdout` and `stderr`, and
 * settle once it has exited and its output is written.
 */
async function attemptOnWorker(
  stackSizeMb: number,
  data: WorkerAttemptData,
  stdout: CliWriter,
  stderr: CliWriter,
): Promise<WorkerAttempt> {
  const threads = await import("node:worker_threads");
  let worker: Worker;
  try {
    worker = new threads.Worker(new URL("./rerun-worker.js", import.meta.url), {
      workerData: data,
      resourceLimits: { stackSizeMb },
      stdout: true,
      stderr: true,
    });
  } catch (error) {
    if (isWorkerStartFailure(error)) return { kind: "unstarted" };
    throw error;
  }
  const forwarded = Promise.all([
    forward(worker.stdout, stdout),
    forward(worker.stderr, stderr),
  ]);
  // What the worker reports before it exits: its outcome, or the error that
  // ended it (an uncaught throw, its heap exhausted, a failed start).
  const reported: { outcome: AttemptOutcome | null; failure: unknown } = {
    outcome: null,
    failure: null,
  };
  worker.on("message", (message: unknown) => {
    if (isAttemptOutcome(message)) reported.outcome = message;
  });
  worker.on("error", (error: unknown) => {
    reported.failure = error;
  });
  const exitCode = await new Promise<number>((resolve) => {
    worker.on("exit", resolve);
  });
  await forwarded;
  if (reported.outcome !== null) {
    return { kind: "attempted", outcome: reported.outcome };
  }
  if (isWorkerStartFailure(reported.failure)) return { kind: "unstarted" };
  return {
    kind: "failed",
    error:
      reported.failure ??
      new Error(
        `a rerun worker exited (code ${String(exitCode)}) without an outcome`,
      ),
  };
}

/**
 * Forward a worker's output stream to `sink` until it ends: each chunk the
 * text the worker wrote — read as UTF-8, the encoding it was written in,
 * so the bytes `sink` writes are the bytes the worker's writes would have
 * been — and the next read only once `sink` has taken it.
 */
function forward(source: Readable, sink: CliWriter): Promise<void> {
  source.setEncoding("utf8");
  return new Promise((resolve) => {
    source.on("data", (chunk: string) => {
      source.pause();
      sink.write(chunk, () => {
        source.resume();
      });
    });
    source.on("end", () => {
      resolve();
    });
  });
}

/** Whether `error` is a worker that could not be started (module header). */
function isWorkerStartFailure(error: unknown): boolean {
  return (
    (error as NodeJS.ErrnoException | null)?.code === "ERR_WORKER_INIT_FAILED"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAttemptCarry(value: unknown): value is AttemptCarry {
  return isRecord(value) && typeof value["holdSeamEngaged"] === "boolean";
}

function isWorkerAttemptData(value: unknown): value is WorkerAttemptData {
  if (!isRecord(value)) return false;
  const request = value["request"];
  if (!isRecord(request)) return false;
  const argv = request["argv"];
  const cwd = request["cwd"];
  return (
    Array.isArray(argv) &&
    argv.every((token) => typeof token === "string") &&
    (cwd === null || typeof cwd === "string") &&
    typeof value["rerunnable"] === "boolean" &&
    isAttemptCarry(value["carry"])
  );
}

function isAttemptOutcome(value: unknown): value is AttemptOutcome {
  if (!isRecord(value)) return false;
  switch (value["kind"]) {
    case "completed":
      return typeof value["exitCode"] === "number";
    case "exhausted":
      return isAttemptCarry(value["carry"]);
    default:
      return false;
  }
}
