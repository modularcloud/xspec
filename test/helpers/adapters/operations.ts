// H-3 output adapters — the applied-mapping report of a successful
// `xspec rename` / `xspec move` (SPEC.md 6.4, 6.5, 12.7; T6.4-1, T6.5-1).
//
// The performed operation's report is a PINNED 12.7 document form — on
// success exactly `{"findings", "mapping"}`, `findings` `[]` and `mapping`
// one `{"from", "to"}` per mapped identity ordered by `from` bytes (SPEC.md
// 12.7 "`rename`/`move` performed"; H-3 lists it among the form-exact
// documents) — so it is decoded by forms.ts's `decodePerformedOperationReport`
// under forms.ts's discipline: never adjustable to a product's shape, output
// differing from 12.7 a conformance failure. This module keeps the
// applied-mapping entry point tests historically imported as a thin alias of
// that form-exact decoder: it accepts exactly what the 12.7 form admits (no
// member beside the two, no non-empty `findings`, no unordered or duplicated
// pair) and returns the decoded `mapping` alone.
//
// NOT here: the refused operation's report (the form-exact 12.7 findings-only
// report) and the `--preview` document (the form-exact 12.7 preview form) —
// both decoded in forms.ts.

import type { AppliedMappingPair } from "./model.js";
import { decodePerformedOperationReport } from "./forms.js";

/**
 * Decode a successful `rename`/`move` invocation's JSON report (T6.4-1,
 * T6.5-1) into its applied mapping — every identity pair the operation
 * journaled, in the pinned `from`-byte order — through the form-exact
 * performed-operation decoder (`decodePerformedOperationReport`, forms.ts):
 * a document of any other 12.7 form rejects loudly (H-3), never defaulting
 * to an empty mapping. Callers assert the ordered array
 * (`assertAppliedMapping`, suite support).
 */
export function decodeAppliedMappingReport(
  doc: unknown,
  context?: string,
): readonly AppliedMappingPair[] {
  return decodePerformedOperationReport(doc, context).mapping;
}
