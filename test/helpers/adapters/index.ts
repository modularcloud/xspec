// The H-3 output-adapter layer (TEST-SPEC §0 H-3, §17 S-5) — one import
// surface for tests. SPEC.md fixes the information content of reports and
// JSON documents but not their concrete shape; every product-facing
// assertion about output content goes through this layer:
//
//   model.ts           the fixed information model tests assert against
//   decode.ts          fail-loud shape-decoding primitives
//   forms.ts           the literal SPEC 12.7 forms — findings, findings-only
//                      reports, path/range/datum value forms, the
//                      unavailability-marker walk. Form-exact (H-3): NEVER
//                      adjustable to a product's shape
//   query.ts           query node/show, rows, edges, reachable, ids
//   reports.ts         coverage, impact
//   operations.ts      the applied-mapping entry point of a successful
//                      rename/move (6.4, 6.5) — a thin alias of forms.ts's
//                      form-exact performed-operation decoder (12.7)
//   review.ts          review list/status/next/show/export
//   human.ts           robust information matching on human reports — the
//                      required information present, or absent where SPEC
//                      requires its absence
//   human-reports.ts   the human-report decoders (H-3's report forms,
//                      T12.0-15, T6.6-7): a findings report, an exit-2
//                      standard-error message, a preview, a performed
//                      rename/move report, an impact report, a `review
//                      list` and `review status` report, and a `review
//                      show` and `review next` report decoded onto the
//                      information model — each finding's code,
//                      locations, concerned path, and identities; an
//                      error's code and concerned path; a preview's
//                      plan; a performed operation's applied mapping; an
//                      impact report's categories with their entries'
//                      nodes, deletions, and attributions, and its
//                      impacted code with witness edges and paths; a
//                      listing's sessions with their strategies and
//                      counts or corruption, and its findings; a status
//                      report's items and totals; an item's fields, its
//                      payload's nodes, texts, ranges, and origin pairs,
//                      and its recorded states, or the fully-resolved
//                      report — and compared with the --json twin's
//   session-staging.ts T10.1-4 corruption transformations (shape-aware,
//                      value-blind, over product-written session files)
//   record-staging.ts  T13.3-2's operational path set (its predicate, the
//                      lock path excluded, and the collector of its plain
//                      files and directories) and T6.6-6's shape-blind
//                      corrupt-record staging (garbage over that set,
//                      product-written files only), shared by the other
//                      14.23 stagings
//   sorted-keys.ts     T13.4-1 byte-sorted-keys assertion (shape/value-blind)
//
// The adapter modules are the only place aware of concrete output shape; they
// may be adjusted to shape, never to values, and they fail loudly (a
// diagnosed test error, never a default) when required information is absent.
// forms.ts shares the fail-loud discipline but decodes shapes SPEC.md 12.7
// pins: output differing from those forms is a conformance failure, never an
// adapter fixture.

export * from "./model.js";
export * from "./decode.js";
export * from "./forms.js";
export * from "./query.js";
export * from "./reports.js";
export * from "./operations.js";
export * from "./review.js";
export * from "./human.js";
export * from "./human-reports.js";
export * from "./session-staging.js";
export * from "./record-staging.js";
export * from "./sorted-keys.js";
