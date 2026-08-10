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
//   review.ts          review list/status/next/show/export
//   human.ts           robust required-information matching on human reports
//   session-staging.ts T10.1-4 corruption transformations (shape-aware,
//                      value-blind, over product-written session files)
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
export * from "./review.js";
export * from "./human.js";
export * from "./session-staging.js";
export * from "./sorted-keys.js";
