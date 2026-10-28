// Harness-step guards for the xspec test harness (TEST-SPEC S-3, with H-11
// and E-5; helpers/hang-guards.ts holds the rest of S-3's design). Harness
// machinery only: no product imports, no test-framework dependence.
//
// S-3: "Each step of the harness's own work between invocations — staging,
// decoding, evaluation — carries a guard of its own likewise, sized to the
// work it stages, answers at H-11's scale included, with the same margin,
// its tripping a harness defect (H-11), never a product failure." A tripped
// step guard is the harness error {@link HarnessStepTimeoutError} — never a
// `HarnessAssertionError` — which every helper converting a run's rejection
// into a diagnosed failure lets through (helpers/subprocess.ts
// `rethrowHarnessError`), which `checkProperty` reports as a harness error
// with its seed (helpers/property.ts), and which the certification runner
// records as its test's `error`, never a verdict on the fixture.
//
// How a step's guard is enforced depends on whether the step yields:
//
// - An asynchronous step — workspace staging and copying, reading back
//   what a product left, snapshotting, the polling reader's last cycle —
//   runs under {@link guardStep}: a timer armed for the step's guard whose
//   expiry, the step still pending (an `fs` call blocked opening a FIFO,
//   say), rejects it with `HarnessStepTimeoutError`, ending its test there.
//   The step's own work is not cancelled — an operation in libuv's pool
//   cannot be — and its eventual outcome is observed and dropped. A step
//   whose synchronous stretches outlast the guard settles before the
//   timer's turn comes, so `guardStep` also measures the step as it settles
//   and raises the same error past its guard. A harness subprocess — git
//   scripting (helpers/workspace.ts), `mkfifo` (helpers/lock-staging.ts),
//   the staging premise's `git rev-parse` (section-6.3.ts) — is guarded by
//   `execFile`'s own `timeout`, which kills it, its kill reported through
//   {@link HarnessStepTimeoutError} as well.
// - A synchronous step — decoding and walking an answer document
//   (`parseJsonStdout`, the driver's T12.7-1 walk), an oracle's evaluation
//   (helpers/oracles/, P-2/P-3's `specSubtreeTexts`, the TypeScript
//   tooling's answers), a property's generation and its per-draw S-9 check
//   — cannot be interrupted in-process: no timer fires while it runs. The
//   conservative option is chosen over moving such steps into a worker
//   thread, which would copy every answer — H-11's ~204 MB blowup among
//   them — across threads and split the harness's module state (the
//   driver's notes, the staged-source ledger), and over rewriting them
//   into chunked asynchronous evaluation, which would reach into every
//   decoder and oracle: its guard is enforced by bounded construction, and
//   checked. Every input such a step reads is bounded — the driver's
//   capture limit (`DEFAULT_MAX_OUTPUT_BYTES`) bounds every answer, S-2's
//   staged maxima every staged source, each generator's own bounds every
//   draw — and its work is bounded by its input: every loop runs over a
//   finite structure, every walk visits each node once or stops at a cap
//   (T4.1-3's `OpaqueWalkCapError`), and S-8 drives the decoders and walks
//   at H-11's scale before any product exists. {@link guardSyncStep} runs
//   the step to completion, measures it, and raises
//   `HarnessStepTimeoutError` once it returns past its guard — what it
//   threw, if anything, the error's `cause` — so an under-sized guard, or a
//   step grown past its bound, fails loudly instead of passing slowly. A
//   synchronous step that never returns would be a defect no in-process
//   guard can end; bounded construction rules it out, and CI's job limits
//   (E-1), which lie outside S-3's rule, are its only bound.
//
// Sizing (AGENTS.md, "Hang guards (TEST-SPEC S-3)"): one guard,
// {@link DEFAULT_STEP_GUARD_MS}, serves every step, sized by the rule the
// per-invocation guards follow — at least ten times the longest the work
// it covers takes, measured unloaded at the largest scale the suite stages
// — over the largest work any step stages: the S-8 blowup's decode and
// walk at H-11's scale, and T1.3-7's staging of the largest document the
// suite stages. A call site whose step stages more passes its own guard;
// a harness subprocess's is its own `execFile` timeout.

/**
 * A harness step outlasted its own guard (TEST-SPEC S-3; module header): a
 * defect in the harness (H-11) — the step's guard sized below its work, or
 * the step stuck — never a diagnosed product failure and never a pass.
 */
export class HarnessStepTimeoutError extends Error {
  /** The step, as its call site names it. */
  readonly step: string;
  /** The step's guard. */
  readonly guardMs: number;

  constructor(
    step: string,
    guardMs: number,
    detail: string,
    options: { readonly cause?: unknown } = {},
  ) {
    super(
      `harness error (H-11): ${step} ${detail} its own guard of ` +
        `${String(guardMs)} ms (TEST-SPEC S-3: each step of the harness's ` +
        `own work carries a guard of its own, its tripping a defect in the ` +
        `harness, never a product failure)`,
      options.cause === undefined ? {} : { cause: options.cause },
    );
    this.name = "HarnessStepTimeoutError";
    this.step = step;
    this.guardMs = guardMs;
  }
}

/**
 * The guard of every harness step whose call site sizes none of its own
 * (module header; AGENTS.md, "Hang guards (TEST-SPEC S-3)"): the largest
 * steps the suite stages — T1.3-7's staging of its 4.2 MB tower, the S-8
 * blowup's ~204 MB decode and walk, a TypeScript tooling answer — each
 * take under two seconds, every other step far less, so 120 s is more than
 * ten times any of them, loaded runs included.
 */
export const DEFAULT_STEP_GUARD_MS = 120_000;

/** The elapsed time of a step, rounded for a diagnosis. */
function elapsedSince(started: number): number {
  return Math.round(performance.now() - started);
}

/**
 * Run an asynchronous harness step under its own guard (module header):
 * resolves or rejects as `work()` does; rejects with
 * {@link HarnessStepTimeoutError} once the guard expires with the step
 * still pending, its own outcome then observed and dropped, or once the
 * step settles past its guard — a rejection of its own that error's
 * `cause`.
 */
export async function guardStep<T>(
  step: string,
  work: () => Promise<T>,
  guardMs: number = DEFAULT_STEP_GUARD_MS,
): Promise<T> {
  const started = performance.now();
  const pending = work();
  // A rejection after the guard has tripped is observed, never unhandled.
  pending.catch(() => undefined);
  let timer: NodeJS.Timeout | undefined;
  let tripped: HarnessStepTimeoutError | undefined;
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      tripped = new HarnessStepTimeoutError(
        step,
        guardMs,
        `was still pending after ${String(elapsedSince(started))} ms, past`,
      );
      reject(tripped);
    }, guardMs);
  });
  let outcome: { readonly value: T } | { readonly error: unknown };
  try {
    outcome = { value: await Promise.race([pending, expired]) };
  } catch (error) {
    if (tripped !== undefined && error === tripped) throw error;
    outcome = { error };
  } finally {
    clearTimeout(timer);
  }
  const elapsedMs = performance.now() - started;
  if (elapsedMs > guardMs) {
    throw new HarnessStepTimeoutError(
      step,
      guardMs,
      `took ${String(Math.round(elapsedMs))} ms, past`,
      "error" in outcome ? { cause: outcome.error } : {},
    );
  }
  if ("error" in outcome) throw outcome.error;
  return outcome.value;
}

/**
 * Run a synchronous harness step under its own guard, enforced by bounded
 * construction and checked (module header): returns or throws as `work()`
 * does, unless the step took longer than its guard — then
 * {@link HarnessStepTimeoutError}, what it threw that error's `cause`.
 */
export function guardSyncStep<T>(
  step: string,
  work: () => T,
  guardMs: number = DEFAULT_STEP_GUARD_MS,
): T {
  const started = performance.now();
  let value: T;
  try {
    value = work();
  } catch (error) {
    const elapsedMs = performance.now() - started;
    if (elapsedMs > guardMs) {
      throw new HarnessStepTimeoutError(
        step,
        guardMs,
        `took ${String(Math.round(elapsedMs))} ms, past`,
        { cause: error },
      );
    }
    throw error;
  }
  const elapsedMs = performance.now() - started;
  if (elapsedMs > guardMs) {
    throw new HarnessStepTimeoutError(
      step,
      guardMs,
      `took ${String(Math.round(elapsedMs))} ms, past`,
    );
  }
  return value;
}

/**
 * The error a harness subprocess's `execFile` rejection stands for where
 * its own `timeout` killed it (module header): {@link HarnessStepTimeoutError}
 * naming the step, the rejection its `cause`; undefined for any other
 * rejection — an exit, a spawn failure, an exhausted `maxBuffer` (which
 * kills the child too: Node 22 sets no `killed` on that error, whose own
 * code the check excludes all the same) — which the call site reports as
 * its own.
 */
export function execFileGuardTrip(
  step: string,
  guardMs: number,
  error: unknown,
): HarnessStepTimeoutError | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const failure = error as {
    readonly killed?: unknown;
    readonly code?: unknown;
  };
  if (
    failure.killed !== true ||
    failure.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"
  ) {
    return undefined;
  }
  return new HarnessStepTimeoutError(step, guardMs, "was killed at", {
    cause: error,
  });
}
