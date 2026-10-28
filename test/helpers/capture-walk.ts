// T12.7-1's marker walk over every JSON document the suite captures (TEST-
// SPEC T12.7-1, H-2, H-11; SPEC 12.7, 12.0). Harness machinery only: no
// product imports. The subprocess driver (helpers/subprocess.ts) calls
// {@link walkCapturedJsonDocument} on the captured stdout of every
// invocation with JSON output in effect (helpers/invocation-grammar.ts),
// once the run has exited and before any awaiter sees its result, so the
// walk covers every JSON document a run through the driver captures —
// documents a test only byte-compares, checks the exit code of, or never
// reads included — whichever test, property, certification run, or
// self-test performs the run. A separate module so S-3 can arm a crash of
// the walk (test/self/s3-subprocess-driver.test.ts).

import { isUtf8 } from "node:buffer";
import { assertUnavailabilityMarkerForms } from "./adapters/forms.js";
import type { RunResult } from "./subprocess.js";

/**
 * When `result`'s stdout is one JSON document as `parseJsonStdout`
 * (helpers/assertions.ts) reads one — valid UTF-8, decoded dropping
 * nothing, the whole text parsing as exactly one JSON value — run the 12.7
 * unavailability-marker walk over it (`assertUnavailabilityMarkerForms`,
 * adapters/forms.ts): a near-marker, an object of any form other than
 * `{"unavailable": true}` carrying a member named `unavailable`, throws the
 * walk's diagnosed failure (`HarnessAssertionError`), naming its JSON path
 * and the command line. Any other stdout — empty, not valid UTF-8, led by a
 * UTF-8 byte-order mark (U+FEFF, the bytes EF BB BF: no part of a JSON
 * text, so the parse meets it and throws), not exactly one JSON document —
 * holds no document to walk and passes untouched: the run's own assertions
 * judge its form (H-5). Anything else thrown is a defect in the harness
 * (H-11), which the driver reports as `HarnessEvaluationError`.
 */
export function walkCapturedJsonDocument(result: RunResult): void {
  if (!isUtf8(result.stdoutBytes)) return;
  // `ignoreBOM: true` keeps a leading U+FEFF in the text, as
  // `parseJsonStdout`'s decode does, rather than dropping it.
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
    result.stdoutBytes,
  );
  let doc: unknown;
  try {
    doc = JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
  assertUnavailabilityMarkerForms(
    doc,
    `T12.7-1, the driver's walk over every captured JSON document — stdout of ${result.commandLine}`,
  );
}
