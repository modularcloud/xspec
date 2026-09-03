// H-3 output adapters — the applied-mapping report of a successful
// `xspec rename` / `xspec move` (SPEC.md 6.4, 6.5, 12.0; T6.4-1, T6.5-1).
//
// Shape-aware, value-blind, fail-loud (H-3) — see query.ts for the layer's
// contract: the document entry runs the 12.7 unavailability-marker walk over
// the whole raw document first (`documentRootSite`, forms.ts; T12.7-1).
// SPEC.md 6.4 fixes the report's information — "the complete
// identity mapping the operation journaled — the information of the preview's
// `mapping` (6.6), carried in JSON per 12.0" — while leaving the successful
// operation's report SHAPE unpinned (H-3 lists the applied-mapping reports of
// 6.4/6.5 among the adapter-decoded surfaces). Adjust the ASSUMED SHAPE below
// when the real product's output shape legitimately differs; never adjust
// values, and never default: a report carrying no recognizable mapping fails
// loudly — a product that journals a mapping but reports none withholds
// required information (SPEC 6.4).
//
// NOT here: the refused operation's report (a form-exact 12.7 findings-only
// report) and the `--preview` document (the form-exact 12.7 preview form) —
// both are pinned surfaces belonging to forms.ts's discipline, never to an
// adjustable adapter.
//
// ASSUMED SHAPE:
//   rename/move (success) →
//     { "mapping": [ { "from": identity, "to": identity } ... ], ... }
//   (the preview's pinned `mapping` member encoding, 12.7 — the natural
//   spelling for the same information; members beside "mapping" are ignored)

import type { AppliedMappingPair } from "./model.js";
import {
  at,
  expectArray,
  expectNonEmptyString,
  expectObject,
  requiredKey,
} from "./decode.js";
import { documentRootSite } from "./forms.js";

/**
 * Decode a successful `rename`/`move` invocation's JSON report (T6.4-1,
 * T6.5-1) into its applied mapping: every identity pair the operation
 * journaled. Pair order is not part of the information model (the report
 * shape is unpinned) — callers assert the pairs as a complete set
 * (`assertAppliedMapping`, suite support). Missing or malformed mapping
 * information rejects loudly (H-3), never defaulting to an empty mapping.
 */
export function decodeAppliedMappingReport(
  doc: unknown,
  context?: string,
): AppliedMappingPair[] {
  const site = documentRootSite(doc, "applied-mapping", context);
  const obj = expectObject(doc, site);
  const mappingSite = at(site, "mapping");
  return expectArray(requiredKey(obj, "mapping", site), mappingSite).map(
    (element, index) => {
      const pairSite = at(mappingSite, index);
      const pair = expectObject(element, pairSite);
      return {
        from: expectNonEmptyString(
          requiredKey(pair, "from", pairSite),
          at(pairSite, "from"),
        ),
        to: expectNonEmptyString(
          requiredKey(pair, "to", pairSite),
          at(pairSite, "to"),
        ),
      };
    },
  );
}
