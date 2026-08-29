# FIX_PLAN — Phase 9 (test harness), compliance round 2

Source: compliance review of TEST-SPEC.md §§10–18 + cross-cutting (2026-08-29). One gap
remains (FP-095 done: T10.5-3 now stages and asserts both halves of SPEC 10.5's note).
Scope guard for every task: Phase 9 — harness code only (`test/`), never product code (`src/`).
Task numbering continues from FP-094 (earlier rounds' tasks, already done and cleared).

---

## FP-096 — T12.0-1: JSON-only parity arm must not assert byte-identity across the two invocation forms

**Status:** TODO

**Requirement.** TEST-SPEC.md §11 preamble: "Each surface's flag-less and `--json`
invocations are asserted to carry the same information — **byte-identity between the two
forms is not asserted (SPEC.md does not require it)**." TEST-SPEC §12.0 T12.0-1: "the
JSON-only surfaces of 10.7, 11, and 12.6 emit the same single document with the flag as
without." SPEC.md 12.0's byte-determinism binds identical input only; a flagged and a
flag-less invocation are different inputs, and H-4/H-6 license byte comparison only for
identical invocations (PROCESS.md: the test spec must not add requirements — a harness
assertion beyond it is an added product requirement).

**Gap (reviewer finding 2).** In `test/suite/registry/section-12.0-i.ts`, `runSweepStory`'s
`assertJsonOnlyParity` arm (currently lines ~422–456) reruns each `jsonOnly` step without
`--json` and calls `assertBytesEqual(bare.stdoutBytes, result.stdoutBytes, …)` —
byte-identity across the flagged/flag-less pair for `query` (all six subcommands),
`occurrences`, `view`, `at`, `inventory`, `review export`, and `version`. A conforming
product whose two forms differ only in JSON formatting bytes would be failed.

**Change.** In the `assertJsonOnlyParity` arm of `runSweepStory`, replace the stdout
byte-equality with the specified assertion set:

- each form exits identically (already asserted — both runs `expectExit(..., 0, ...)`;
  keep it);
- each form emits a single JSON document as its entire stdout (already asserted —
  `parseJsonStdout` on both runs; keep it, but capture the bare run's parsed document
  instead of discarding it);
- the two decoded documents carry the same information — decode-and-compare: deep
  equality of the parsed documents in which array order is significant but object key
  order is not (key order is formatting, exactly what the fix must stop failing products
  over). Note `support.ts`'s `assertSameJson` renders via `JSON.stringify` and is
  therefore object-key-order-sensitive — canonicalize (recursively sort object keys)
  before rendering, or add a key-order-insensitive deep-equality helper, with a diagnosis
  citing SPEC 10.7/11/12.6 and TEST-SPEC §11 (same information; byte-identity not
  asserted);
- byte-identity NOT asserted: remove the `assertBytesEqual` call (and the now-unused
  import if nothing else in the module uses it).

Update the prose that argues the old operationalization so the module stays honest:

- the `SweepStoryOptions.assertJsonOnlyParity` doc comment (~lines 384–390,
  "byte-identical to the flagged run's (product-to-itself, H-4…)");
- the module-header bullet "T12.0-1's JSON-only parity arms" (~lines 36–45, which derives
  byte comparison from H-4 — the derivation TEST-SPEC §11 rejects);
- the `T12_0_1` `title` (~line 468: "…byte-identical stdout at the same exit code
  (product-to-itself, H-4)…") — reword to "same information at the same exit code, one
  JSON document as the entire stdout each way; byte-identity not asserted" mirroring
  TEST-SPEC §11/§12.0.

**Leave untouched** (not flagged; different claims): T12.0-2's stderr-invariance
`assertBytesEqual` arms (~lines 577, 635 — SPEC 12.0's "the output form never changes an
exit code or standard-error content" compares stderr, not the JSON document) and every
byte-determinism compare over identical repeated invocations elsewhere in the harness
(H-4/H-6's licensed form).

**Verify.** `npm run typecheck` and `npm run format:check` green; `npm run test:self`
green; after `npm run build`, the amended test still fails-as-diagnosed against the stub
product:
`npx vitest run --config test/vitest.config.ts --project suite test/suite/section-12.0-i.test.ts`.
