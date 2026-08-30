# TEST-SPEC problems

## 2026-08-30 — P-11: the harness's recursive view decoder cannot decode the conforming answers P-11's own generator provokes

**Where:** TEST-SPEC.md §16 P-11 ("Availability robustness", reusing P-8's
generators, whose mutation menu TEST-SPEC describes as including "giant
nesting"); harness implementation `test/helpers/adapters/forms.ts`
(`decodeViewNodeForm`) as exercised by `test/suite/registry/section-16-p11.ts`.

**What happens:** P-8's shared mutation menu draws balanced section towers of
depth 512, 2048, or 4096 (`test/suite/registry/section-16-p8.ts`,
`NESTING_DEPTHS`). SPEC 11.4 requires `view` to answer with "the root node and
the full section tree", so a conforming product's answer for a depth-2048
tower is a JSON node tree nested 2048 `children` levels deep. The harness's
form decoder `decodeViewNodeForm` recurses natively per level and overflows
the call stack on that answer (`RangeError: Maximum call stack size
exceeded`), which the property machinery classifies — by its own H-8 wording —
as "a defect in the harness, not a diagnosed assertion failure", failing the
test. CI seed 271828183 hits this deterministically at trial 1 (mutations:
`specs/B.mdx: append a depth-2048 balanced section tower`, `src/app.ts: insert
UTF-16LE BOM at 0`; first arm `view`).

**Why no product change can clear it:** the product now terminates promptly
with one complete, bounded JSON document at every generator depth (verified at
512/2048/4096 and with three stacked towers: worst observed answer ~35 MB in
~4 s against the harness's 64 MB / 10 s guards). The overflow happens inside
the harness *after* a conforming answer is produced; SPEC 11.4 forbids the
product any shallower answer form, and the harness's form-exact decoder pins
the nested `children` encoding. Every conforming product fails P-11 until the
harness decodes deep trees without native recursion (or otherwise handles the
depth its own generator draws).

**Note on classification:** TEST-SPEC.md's P-11 text itself is satisfiable and
consistent; the blocking defect is in the harness implementation of the form
decoders (Phase 9 scope, which Phase 10 must not touch). Logged here because
this file is Phase 10's channel for problems in the test system. The harness's
other recursive walkers over answer documents (e.g. P-11's
`documentCarriesUnavailability`) have the same exposure once decoding
survives.

**Evidence:** local run of `npx vitest run --config test/vitest.config.ts
--project suite test/suite/section-16-p11.test.ts` at product commit
(post-fix): fails with the harness-error message above. Product-side
reproduction of the previously-hanging invocation (depth-2048 tower + BOM
file, bare `view`) now completes in ~0.9 s with a 17.9 MB document, exit 1.
