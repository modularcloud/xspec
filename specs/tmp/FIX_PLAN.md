# FIX_PLAN — Phase 9 (test harness), compliance round 2

Source: compliance review of TEST-SPEC.md §§10–18 + cross-cutting (2026-08-29). Two gaps.
Scope guard for every task: Phase 9 — harness code only (`test/`), never product code (`src/`).
Task numbering continues from FP-094 (earlier rounds' tasks, already done and cleared).

---

## FP-095 — T10.5-3: stage and assert the embedding half of SPEC 10.5's note

**Status:** TODO

**Requirement.** TEST-SPEC.md §10.5, T10.5-3: "both halves of 10.5's note staged (a new
`d` edge makes the source `metadata-changed`, a new embedding makes it `changed`): a
fixture node whose only affected target was added since the baseline gets no
`dependency-consistency` item, its new `d` edge surfacing as its own
`metadata-consistency` item; **a second node whose only affected target entered through a
new `{text(...)}` embedding likewise gets no `dependency-consistency` item — the new
embedded reference changes its own content (5.5), it is `changed`, and the change is
reviewed via its own `subtree-coherence` item**." Product-spec anchor: SPEC.md 10.5,
dependency-impact rule 2's note ("An edge to a target added since the baseline is
necessarily itself new (5.4), so that change is reviewed at its source: a new `d` edge
makes the source `metadata-changed`, a new embedding makes it `changed` (5.6)").

**Gap (reviewer finding 1).** In `test/suite/registry/section-10.5.ts`, the T10.5-3
fixture (`N_BASELINE`/`N_CURRENT`, currently lines ~919–1007) stages only the `d`-edge
half: `dep2` gains `d={"h.newt"}` in `N_CURRENT`. No node anywhere in the file gains a new
`{text(...)}` embedding (the file stages zero embeddings), and no assertion covers the
embedding half.

**Change.** Extend the T10.5-3 fixture with a second node whose only affected target
enters through a `{text(...)}` embedding new since the baseline, and assert the embedding
half. Required properties of the staging (all load-bearing under SPEC.md 10.5/5.6):

- The embedder is present in both `N_BASELINE` and `N_CURRENT`; its only change between
  the two is that its text gains a `{text(...)}` embedding of a node **added since the
  baseline** (e.g. a new top-level section `dep3` whose current text gains
  `{text("h.newt")}` — the string form resolves within the same file, TEST-SPEC T2.3-2;
  `h.newt` is already added-since-baseline in this fixture).
- The embedder carries no `d` attribute and no other embedding (so that target is its
  *only* affected target), has no `changed` ancestor (else 10.5's skipping rule absorbs
  its item), and sits at file top level (10.5 parent-consistency rule 2 creates items only
  per non-root ancestor, keeping the expected item set free of parent-consistency noise —
  same reasoning as the existing fixture comment at the top of the T10.5-3 block).
- No other node `d`-references or embeds the embedder, and the code fixture
  (`N_CODE_BASELINE`/`N_CODE_CURRENT`, `src/ci3.ts`) does not reference it — leaving the
  existing dep1/dep2/m/m2/code-impact assertions' expected values untouched.

Assertions to add (the three the TEST-SPEC statement names):

1. The embedder gets **no `dependency-consistency` item**: extend the exact
   `kindScopeSet(status)` expected set — it must gain `subtree-coherence <embedder>` and
   must NOT gain any `dependency-consistency` or `metadata-consistency` entry for the
   embedder; the existing "exactly one dependency-consistency item, scoped at dep1"
   `dcRows` check then also covers the embedder — extend its diagnosis message to cite the
   embedding half.
2. The embedder **is `changed`** (not `metadata-changed`): assert its impact category via
   the harness's existing category observable (the same surface T1.6-4 uses for
   category assertions), citing SPEC 5.5/5.6.
3. The change is **reviewed via the embedder's own `subtree-coherence` item**: covered by
   the exact `kindScopeSet` (item 1); the diagnosis messages should say so, citing
   SPEC 10.5's note.

Also update the test's `title` to mirror the amended T10.5-3 statement (both halves), per
the harness convention that titles restate the TEST-SPEC statement. No traceability
change: the test ID stays T10.5-3 (`test/suite/registry/traceability.ts` untouched).

**Verify.** `npm run typecheck` and `npm run format:check` green; `npm run test:self`
green (self-tests + certification — this is a product-facing test body, so no
certification fixture change is expected); after `npm run build`, the amended test runs
and fails-as-diagnosed against the stub product:
`npx vitest run --config test/vitest.config.ts --project suite test/suite/section-10.5.test.ts`
(Phase 9: product tests are expected to fail; failure text must be the test's own
diagnoses, not harness errors).

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
