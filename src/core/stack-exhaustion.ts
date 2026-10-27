// Call-stack exhaustion: the overflow test, the signal that defers a
// verdict, and the run state of the invocation's attempts (SPEC 14.20,
// 14.14, 12.0, 12.1; cli/reruns.ts).
//
// SPEC 14.20: well-formedness is decided by derivability alone — for
// TypeScript, by TypeScript's parser's acceptance (a stack overflow reports
// no syntax error), and name binding takes no part in it — and the
// configuration is judged by the same grammar (14.14). So a call-stack
// overflow met while parsing, binding, or analyzing a source is no verdict
// about the source: given stack enough, the same work completes. SPEC 12.0:
// the same workspace bytes give the same answer on every run, while the
// depth at which V8's stack gives out moves from run to run with how far
// the JIT has optimized the recursing functions. So an invocation that
// meets an overflow before its first effect runs again from the start on a
// larger stack (cli/reruns.ts), and the sites that would turn the overflow
// into an outcome (core/code-analysis.ts, core/config.ts) instead let it
// propagate while such a rerun is possible: only the last attempt, or an
// attempt past its first effect — which a rerun would repeat — answers
// from the overflow.
//
// The run state is data alone, no I/O (IMPLEMENTATION: core is I/O-free):
// the cli layer begins each attempt (cli/reruns.ts), and the first effect
// clears its eligibility — a byte written to standard output or standard
// error (cli/reruns.ts) or a filesystem mutation (workspace/writes.ts).
// What one attempt hands the next is whether 13.5's hold-file seam has
// engaged (workspace/lock.ts): the invocation creates its hold file once.

/** V8's message for an exhausted call stack (its `RangeError`). */
const STACK_OVERFLOW_MESSAGE = "Maximum call stack size exceeded";

/** How many `cause` links `isStackOverflow` follows (a chain may cycle). */
const CAUSE_CHAIN_LIMIT = 16;

/**
 * Whether `error` is V8's call-stack overflow — the `RangeError` whose
 * message is exactly `Maximum call stack size exceeded` — thrown directly or
 * carried as a thrown error's `cause` (a `StackExhaustion` signal carries
 * one). No other `RangeError` is one: a string or array length past V8's
 * caps, or the product's own range checks.
 */
export function isStackOverflow(error: unknown): boolean {
  let current: unknown = error;
  for (let link = 0; link < CAUSE_CHAIN_LIMIT; link += 1) {
    if (!(current instanceof Error)) return false;
    if (
      current instanceof RangeError &&
      current.message === STACK_OVERFLOW_MESSAGE
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

/**
 * The signal a site throws in place of its overflow verdict while a rerun
 * is possible (`propagateWhileRerunPossible`), carrying the overflow as its
 * `cause`. Not a `RangeError`, so no catch that judges `RangeError`s takes
 * it for an overflow to answer from; it propagates to the rerun loop
 * (cli/reruns.ts).
 */
export class StackExhaustion extends Error {
  constructor(overflow: unknown) {
    super(
      "the call stack was exhausted before the invocation's first effect; " +
        "it runs again on a larger stack (SPEC 14.20, 12.0)",
      { cause: overflow },
    );
    this.name = "StackExhaustion";
  }
}

/**
 * What an attempt hands the next one of the same invocation: whether the
 * hold-file seam (SPEC 13.5) has engaged — created its hold file — in an
 * earlier attempt, so a rerun proceeds past acquisition without creating
 * it again (workspace/lock.ts): an invocation creates its hold file once,
 * and the seam changes no other behavior (13.5) — with it or without it, a
 * rerun gives the answer stack enough gives.
 */
export interface AttemptCarry {
  readonly holdSeamEngaged: boolean;
}

/** The carry of an invocation's first attempt. */
export const FIRST_ATTEMPT: AttemptCarry = { holdSeamEngaged: false };

/** The current attempt's state (`beginAttempt`). */
const state = {
  /**
   * Whether the attempt can still be rerun: begun rerunnable, no effect
   * since. False outside any attempt, so every site answers as it always
   * has where no rerun loop runs.
   */
  rerunPossible: false,
  holdSeamEngaged: false,
};

/**
 * Begin an attempt (cli/reruns.ts): `rerunnable` false for the last one,
 * whose sites answer from an overflow; `carry` from the attempt before.
 */
export function beginAttempt(rerunnable: boolean, carry: AttemptCarry): void {
  state.rerunPossible = rerunnable;
  state.holdSeamEngaged = carry.holdSeamEngaged;
}

/**
 * Record an effect — a byte written to standard output or standard error,
 * or a filesystem mutation: a rerun would repeat it, so from here on the
 * attempt is the invocation's last, its sites answering from an overflow.
 */
export function recordEffect(): void {
  state.rerunPossible = false;
}

/** Whether the current attempt can still be rerun on a larger stack. */
export function rerunPossible(): boolean {
  return state.rerunPossible;
}

/**
 * At a site that answers from an overflow (core/code-analysis.ts,
 * core/config.ts): throw the `StackExhaustion` signal when `error` is a
 * call-stack overflow and a rerun is possible; otherwise return, the site
 * then answering as it always has.
 */
export function propagateWhileRerunPossible(error: unknown): void {
  if (state.rerunPossible && isStackOverflow(error)) {
    throw new StackExhaustion(error);
  }
}

/** Record that the hold-file seam has engaged (workspace/lock.ts). */
export function recordHoldSeamEngaged(): void {
  state.holdSeamEngaged = true;
}

/** Whether the hold-file seam has engaged in this invocation. */
export function holdSeamEngaged(): boolean {
  return state.holdSeamEngaged;
}

/** What the current attempt hands the next (`AttemptCarry`). */
export function attemptCarry(): AttemptCarry {
  return { holdSeamEngaged: state.holdSeamEngaged };
}
