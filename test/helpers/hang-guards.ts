// Hang guards for the xspec test harness (TEST-SPEC S-3, with H-8, H-10, E-5,
// and section 16's preamble). Harness machinery only: no product imports, no
// test-framework dependence.
//
// A hang guard detects non-termination and asserts nothing about speed, which
// SPEC.md leaves unbounded (H-10): it is the one place the clock can reach a
// verdict. The harness follows S-3's conservative design (AGENTS.md, "Hang
// guards (TEST-SPEC S-3)"):
//
// - Every product invocation carries its own guard: the subprocess driver's
//   hang guard (helpers/subprocess.ts — `RunOptions.timeoutMs`, default
//   `DEFAULT_TIMEOUT_MS`), which kills the run and rejects it with
//   `ProductRunTimeoutError`. The suite's margin for product speed lives in
//   these guards, where generosity costs detection nothing.
// - A span — a test, a trial loop, a property and its shrink phase, a
//   certification verification, a sweep — carries no guard of its own, as
//   S-3 admits ("a span may carry none beyond those own guards"): no
//   framework timeout (each Vitest project's `testTimeout` is 0,
//   test/vitest.config.ts, and a declaration naming one names
//   {@link NO_SPAN_GUARD}), no runner watchdog, no deadline, no trial or
//   property time budget. A span is bounded by the own guards of the
//   invocations and harness steps it spans, so nothing of its own can fire
//   while each of them is inside its own guard, whatever the span's length —
//   its count fixed by its staging or known only once staged (a shrink
//   phase, a staging per companion path) alike — and no guard of its needs
//   deriving. A count bounding work — a property's shrink-execution cap, a
//   trial count — is no guard: it ends a phase early, never a test.
// - A held run's own guard covers its own work, never the hold the harness
//   keeps standing (helpers/subprocess.ts, module header): from the moment
//   the harness finds the run's own hold standing — `waitForFile` or
//   `holdFileStands` on its `--test-hold` path — until it lifts the hold
//   (`releaseHoldFile`), the run waits on the harness, whose invocations and
//   steps meanwhile are bounded by their own guards, so the run's guard
//   stands suspended, resuming for what is left of it once the hold is
//   lifted. No guard of a held run spans what the harness drives during its
//   hold.
// - A tripped guard ends its test: the driver's rejection propagates through
//   the body, which may convert it into a diagnosed failure (H-8); a
//   property reports it with its seed, unshrunk (helpers/property.ts); and
//   the certification runner records a body ending with it unconverted as
//   the test's hang ({@link isHangGuardKill}).
// - Time limits the CI service imposes on a job or runner (E-1) are no
//   guards of the harness and lie outside this rule.

import { ProductRunTimeoutError } from "./subprocess.js";

/**
 * The framework timeout a test declaration names (Vitest's `timeout`
 * option): none. Vitest arms no timer for a timeout of 0 or less
 * (`withTimeout` in @vitest/runner), so a test declared with it is bounded
 * by the own guards of the invocations and steps it runs alone (module
 * header).
 */
export const NO_SPAN_GUARD = 0;

/**
 * Whether `thrown`, or an error in its `cause` chain, is the subprocess
 * driver's hang-guard kill ({@link ProductRunTimeoutError}): a product
 * invocation that did not terminate within its own guard, which the body
 * let propagate — a body converting it into a diagnosed failure throws
 * `HarnessAssertionError` instead. The chain is followed because a wrapper
 * names the kill as its cause (a property's report, helpers/property.ts);
 * the name fallback keeps a duplicated module from hiding one.
 */
export function isHangGuardKill(thrown: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = thrown;
  while (current instanceof Error && !seen.has(current)) {
    if (
      current instanceof ProductRunTimeoutError ||
      current.name === "ProductRunTimeoutError"
    ) {
      return true;
    }
    seen.add(current);
    current = current.cause;
  }
  return false;
}
