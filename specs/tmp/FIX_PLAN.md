# FIX_PLAN — Phase 9 (test harness vs TEST-SPEC.md + CERTIFICATIONS.md)

Planned 2026-08-10 from three compliance reviews (R1: TEST-SPEC §§1–9; R2:
TEST-SPEC §§10–18 + cross-cutting; R3: CERTIFICATIONS.md) and the red VERIFY
run at sha 8294929 (`npm run test:self`: 5 failed / 222 passed —
certification-document ×3, s1-traceability ×2). Citations `[R1 #n]`,
`[R2 #n]`, `[R3 gap n]`, `[VERIFY]` name the finding a task satisfies;
TEST-SPEC.md / CERTIFICATIONS.md / SPEC.md remain the sole authority for the
full requirement text — task summaries locate the gap, they do not replace
the spec.

## How to work this plan

- Phase 9 scope guard: **never modify product code** (`src/`). Everything
  here is harness work under `test/` (fixtures included) plus this file.
- Take tasks top to bottom unless a task's "after:" note says otherwise.
  Mark a completed task `[x]` in the same commit that completes it. Never
  delete tasks; append new ones at the end if new findings arrive.
- Keep each spawn small and complete: one task (or one task plus its
  explicitly paired partner) per spawn is the intended grain.
- Verify with `npm run build && npm run test:self` (the phase gate) and, for
  suite subsets, `npx vitest run --config test/vitest.config.ts --project
  suite test/suite/<file>.test.ts` (see AGENTS.md). Product-facing tests are
  expected to FAIL against the stub product (red-as-diagnosed, H-8) — a new
  or changed product-facing test is verified by (a) failing as diagnosed
  against the stub, (b) certifying green where a CERTIFICATIONS.md fixture
  has it in scope, (c) self-tests (S-1..S-7, C-1) staying/going green per the
  task's "verify" note.
- Expected mid-loop redness: `test:self` stays partially red until the whole
  plan lands (S-1 unmapped-key list shrinks as new tests register; the
  certification-document gate stays red until FP-091). Each task's verify
  note says which failures it must clear and which may remain.

## Conventions for every new-test task (stages E, G, H)

A "new test T<x>" task always means, in one change:

1. Implement the test body per its TEST-SPEC entry (title, arms, budget) in
   the section's registry module `test/suite/registry/section-<x>.ts`
   (create the module if the section is new, export a
   `readonly ProductTestEntry[]`, and spread it into
   `test/suite/registry/index.ts`).
2. Declare it in the matching `test/suite/section-<x>.test.ts` via
   `declareProductTests` (create the thin wrapper file for new sections).
3. Add its `H7_TRACEABILITY` entry in
   `test/suite/registry/traceability.ts` (home passage per H-7, plus "14"
   when it asserts a numbered condition, plus any cross-section passages its
   TEST-SPEC entry states).
4. Decode outputs through the H-3 adapter layer — except findings arrays,
   findings-only reports, and other 12.7 form-exact surfaces, which must be
   decoded literally (FP-001's layer).
5. Confirm red-as-diagnosed against the stub product, and note any
   CERTIFICATIONS.md scope (the six CONF-AVAIL in-scope tests are called out
   in their tasks).

---

## Stage A — foundations (do these first; many tasks depend on them)

- [ ] FP-001 — Rebuild the findings decode layer as a literal, form-exact
  SPEC 12.7 decode; add the three-state datum decode; add the S-5 guards.
  [R1 #28, R2 #18, R2 #41; SPEC 12.7, TEST-SPEC §0 H-3 (amended), §17 S-5]
  - `test/helpers/adapters/reports.ts` (`decodeFinding`, ASSUMED-SHAPE
    comment at top): the current assumed finding shape
    `{"condition":"14.N","message","file"?,"location"?,...}` is wrong. SPEC
    12.7 fixes findings as `{"code","message","locations","path",
    "identities"}` with stable token codes, and amended H-3 makes findings
    arrays and findings-only reports form-exact surfaces where no adapter
    may re-map member names or shapes. Rebuild the findings assertion layer
    as a literal 12.7 decode: exact member names, `null`-vs-omission rules,
    `[]`-vs-`null` rules, the pinned findings-order comparator, duplicate
    collapse.
  - `test/helpers/adapters/model.ts` (`Finding` interface, ~line 183):
    findings must carry the stable token `code`; keep a `14.N` condition
    identity only as a value derived through a harness-pinned SPEC §14
    token→condition table so existing condition-identity assertions can be
    expressed against tokens.
  - Add a three-state datum decode helper (`plain` value / `null` /
    `{"unavailable": true}`) under `test/helpers/` — nothing decodes that
    triple today; T12.7-1 (FP-075) and the §11 tests need it.
  - `test/self/s5-output-adapters.test.ts`: add guards for the literal 12.7
    findings decode and for the structural-unavailability walk T12.7-1
    relies on.
  - Update every compile-affected call site in the same change (suite
    registry modules import the decoder widely).
  - Verify: `npm run test:self` — S-5 green; certification must not regress
    on finding shape: if a conformer fixture emits old-shape findings on an
    in-scope path, apply the minimal 12.7 form change to that fixture here
    (CONF-VALID's full behavioral rework stays FP-009).

- [ ] FP-002 — Fix the exit-2 output-stream protocol everywhere it is
  asserted: with JSON output in effect, exit-2 stdout is exactly one 12.7
  error document (`{"error": …}`); stdout is byte-empty on exit 2 only when
  JSON is NOT in effect; stderr is byte-identical across output forms.
  [R1 #26, R2 #17; SPEC 12.0/12.7, TEST-SPEC §0 H-5, T12.0-2]
  - `test/helpers/assertions.ts` `assertJsonOutputConvention` (~line 175)
    currently enforces "exit 2 → stdout byte-empty under `--json`" — invert
    to the error-document contract.
  - Call sites to sweep: `test/suite/registry/section-16-p8.ts` (P-8),
    `section-12.0-i.ts` (T12.0-2 — also ADD its missing stderr-invariance
    arm: stderr byte-identical across output forms), `section-6.3.ts` ~line
    233 (T6.3-4), `section-6.4.ts` ~line 348 (T6.4-4), `section-6.5.ts`
    ~line 409 (T6.5-5), `test/suite/registry/support.ts`
    `expectConfigurationError` ~line 95 (asserts `assertStdoutEmpty` on exit
    2 — must instead assert the single 12.7 error document; users T7-1,
    T7-2, T7-3, T7-4, T7.2-1, T7.3-1, T7.4-1, T7.5-1), `section-7.4-7.5.ts`
    ~line 590 (T7.4-1 unknown-profile arm), `section-7-basics.ts` ~line 733
    (T7-3 unknown `--from` arm).
  - Verify: affected suite files compile and fail only as red-as-diagnosed
    product assertions; `npm run test:self` no worse.

- [ ] FP-003 — Re-pin the H-7/S-1 traceability universe and apply the
  renumber/remap fixes that need no new tests.
  [VERIFY s1-traceability, R2 #39, R1 #12; TEST-SPEC §0 H-7, §17 S-1]
  - `test/self/s1-traceability.test.ts`: `EXPECTED_KEY_COUNT` 71 → 81 (line
    44) and the "preamble + 60 subsections" comment (line 39) → 70
    subsections (SPEC.md now adds subsections 5.7, 6.7, 11.1–11.6, 12.6,
    12.7). `EXPECTED_SECTION_COUNT` stays 15.
  - `test/suite/registry/section-6.6.ts` (`defineProductTest` at ~line 363):
    the manual-restructuring test exists under the retired ID `T6.6-1`;
    re-register it as `T6.7-1` (SPEC/TEST-SPEC renumber: manual
    restructuring moved 6.6 → 6.7; new §6.6 is the preview command). Update
    its title's SPEC citations accordingly and the traceability entry
    `"T6.6-1": ["6.6"]` (traceability.ts ~line 194) → `"T6.7-1": ["6.7"]`.
  - `test/suite/registry/traceability.ts`: remap T11-1..T11-7 from key
    `"11"` to `"11.1"` while keeping SPEC §11's body key `"11"` covered
    (assign §11-body coverage to the tests that assert it — §11 now has
    subsections, so fix the header comment claiming 11 has none, and review
    `SPEC_BODY_TEXT_KEY_SECTIONS` against amended H-7).
  - Note in the map comment that T12.0-10 stops being alias-only once
    FP-039 lands (its own arms make it an implemented test).
  - Verify: S-1's universe-count assertion goes green; its unmapped-key
    failure narrows to exactly {5.7, 11.2, 11.3, 11.4, 11.5, 11.6, 12.6,
    12.7} (6.7 and 11.1 become mapped here) and stays red until stages E/G
    land — state left red on purpose.

## Stage B — existing assertions that contradict the current spec

- [ ] FP-004 — Invert T10.7-12's code-impact-scope range assertion.
  [R2 #19; SPEC 10.7, 1.7]
  `test/suite/registry/section-10.7-ii.ts` ~line 638 asserts a present
  `code-impact` scope "must carry no source range". Current SPEC 10.7/1.7:
  a PRESENT code-location scope carries its source range; only a DELETED
  location's entry carries none. Invert the assertion and stage both sides
  (present location → range asserted byte-precisely; deleted location →
  no range). Verify: red-as-diagnosed against stub; no self-test change.

- [ ] FP-005 — Re-stage the two `move` destination spellings that changed
  exit class from refusal (exit 1) to usage error (exit 2).
  [R1 #25, non-UTF-8 half of R1 #22; TEST-SPEC T6.5-4 dead-letter note,
  T6.5-5]
  `test/suite/registry/section-6.5.ts`: the `#`-containing destination
  (`specs/Ha#sh.mdx`, ~line 1476) and the non-UTF-8 destination (~line
  1499) are currently asserted as exit-1 refusals under T6.5-4; TEST-SPEC
  now classifies both as exit-2 usage errors under T6.5-5. Move the arms to
  T6.5-5 and assert exit 2 with the FP-002 protocol (single 12.7 error
  document under `--json`), workspace unmodified. Verify: red-as-diagnosed;
  T6.5-4 retains no exit-class contradiction.

## Stage C — §§1–9 cross-cutting assertion sweeps (after FP-001)

- [ ] FP-006 — Sweep §§1–9 condition assertions to assert stable code
  tokens and the literal 12.7 finding form. [R1 #27, #28; TEST-SPEC §0
  ("where §14 assigns the condition or refusal reason a stable code, assert
  that exact code string"), SPEC 12.7, 14]
  No §§1–9 test asserts the SPEC 14 token strings today — the model carries
  only `condition: "14.N"`. Using FP-001's layer, make every §§1–9 test that
  asserts a numbered condition assert the exact token code string and
  decode the finding's 12.7 members literally (`code`, `message`,
  `locations`, `path`, `identities`). Sweep the registry modules for
  sections 1–5, 7, 8, 9 (section 6 refusals are FP-007). Verify: affected
  files red-as-diagnosed only; S-5/S-1 unaffected.

- [ ] FP-007 — Make §6 refusal assertions assert stable refusal codes with
  their concerned file/range/identity. [R1 #27; TEST-SPEC §§6.4–6.5, SPEC
  12.7, 14]
  `expectRefusalModifiesNothing` (defined in
  `test/suite/registry/section-6.4.ts` ~line 303 and used across
  section-6.4.ts / section-6.5.ts) asserts only exit 1 plus
  workspace-unchanged. Extend it (or its call sites) so each refusal arm
  asserts the exact stable refusal code and the concerned file/range/
  identity of the refusal finding, most acutely T6.4-3, T6.5-4, T6.5-6.
  Verify: red-as-diagnosed only.

## Stage D — §§1–9 missing arms, with paired certification-fixture reworks

- [ ] FP-008 — T1.3-6: add the invalid-`id`-form arms. [R1 #13; TEST-SPEC
  §1.3, SPEC 14.17]
  `test/suite/registry/section-1.3.ts` has no 14.17 arm. Add: a
  repeated-`id` bearer and a braced-`id` bearer (`id={"x"}`), each reporting
  14.17 and never 14.1, masking 14.2 for its immediate children, while
  grandchildren's structural checks still report. Pair with FP-009 (the
  CONF-VALID conformer must pass this arm once both land — certification
  for the family may be red between the two commits; prefer one spawn).

- [ ] FP-009 — Rework CONF-VALID to its refreshed CERTIFICATIONS.md scope.
  [R3 gap 4; CERTIFICATIONS.md CONF-VALID, SPEC 12.7, 14.17]
  `test/fixtures/conf-valid/product.mjs` (+ `bin-ctrl.mjs`/`bin-wide.mjs`
  deviations unchanged): (a) add the condition-17 path — today it emits
  only 14.1–14.4/14.20; (b) repeated `id` must report 14.17 and never 14.1
  (today it silently takes the last value), masking 14.2 for immediate
  children; (c) braced `id={"x"}` must report 14.17 (today 14.20); (d) emit
  findings in the 12.7 form with stable token codes (today
  `{"condition","file","location","message"}` with no token). After: FP-001,
  FP-008. Verify: `npm run test:self` — CONF-VALID conformer passes all
  in-scope tests, its violators still fail at least one certified test.

- [ ] FP-010 — T3-1: add the grammar-boundary arm. [R1 #15; TEST-SPEC §3]
  `test/suite/registry/section-3.ts` — the T3-1 fixture's fence (~line 92)
  contains only plain text. Add fences and an inline code span containing
  `<S id="x">`, `<div>`, `import X from "./X.xspec"`, `{text("a")}`, and
  assert: no node, no edge, no finding, bytes preserved byte-for-byte.
  Pair with FP-011 (same red-window note as FP-008/FP-009).

- [ ] FP-011 — Rework CONF-MD to its refreshed CERTIFICATIONS.md scope.
  [R3 gap 3; CERTIFICATIONS.md CONF-MD]
  `test/fixtures/conf-md/product.mjs` (+ `bin-class.mjs`/`bin-cr.mjs`):
  (a) support `check` with exit 0 on T3-1's grammar-boundary staging (today:
  exit 2 "unknown command"); (b) support `query nodes`/`query edges` with
  no-node/no-edge reports (today exit 2); (c) give `parseMdx` fence and
  inline-code-span lexer state so `<S id="x">` inside a fence is literal
  content — no node, no edge, no finding (today a spurious 14.20), bytes
  preserved. After: FP-010. Verify: CONF-MD conformer green on in-scope
  tests incl. T3-1's new arm; violators still certify.

- [ ] FP-012 — T1.7-1: add the bare-identity edge-endpoint arms. [R1 #14;
  TEST-SPEC §1.7]
  `test/suite/registry/section-1.6-1.7.ts` asserts only `query node`/`show`
  ranges; no code location, no `reachable` anywhere in the file. Add arms
  asserting endpoints-as-identities-alone on (a) `edges` rows, (b) a
  `reachable` witness path, and (c) `query node`'s incoming/outgoing edge
  lists — each traversing a code location.

- [ ] FP-013 — T4.3-2: add the zero-argument and two-argument `text(...)`
  arms. [R1 #16; TEST-SPEC §4.3, SPEC 14.8]
  `test/suite/registry/section-4.3-4.4.ts` (~line 294) has only the
  string/computed-index/optional-chaining arms. Add `text()` and
  `text("a","b")` calls in a TypeScript file, each → 14.8.

- [ ] FP-014 — T4.5-2: add the upstream (cross-file) impact arm. [R1 #17;
  TEST-SPEC §4.5]
  `test/suite/registry/section-4.5.ts` stages only the same-document
  subtreeHash edit (direct impact). Add: the marker's document bears a
  root-sourced `{text(...)}` edge into another file; an edit THERE changing
  only that root's effectiveHash leaves the location transitively impacted
  while no node of the marker's own document is `changed`.

- [ ] FP-015 — T6.4-1: assert the rename command's own report — the applied
  mapping. [R1 #18; TEST-SPEC §6.4, SPEC 12.0, H-3]
  `test/suite/registry/section-6.4.ts` asserts journal append and rewrites
  only; rename stdout is never decoded. Add: decode rename's stdout (JSON
  per 12.0, H-3 adapter) and assert the report is the applied mapping —
  every journaled identity pair.

- [ ] FP-016 — T6.4-4: add the wrong-kind and parse-local old-ID-existence
  arms. [R1 #19; TEST-SPEC §6.4]
  `test/suite/registry/section-6.4.ts`, none present today: (a) discovered
  code source passed as `<file>` → exit 2; (b) duplicate-spelling bearers →
  exit 1 via the duplicate-ID finding; (c) bearer beneath an ancestor
  spelling no identity → exit 1; (d) sole would-be bearer spelling no
  identity (repeated `id` attribute) → exit 2 beside that file's findings.

- [ ] FP-017 — T6.5-1: assert the applied-mapping report for the file-form
  move (both forms report as rename does). [R1 #20; TEST-SPEC §6.5]
  `test/suite/registry/section-6.5.ts`: decode the move command's stdout in
  both file form and section form and assert the applied mapping, exactly
  as FP-015 does for rename.

- [ ] FP-018 — T6.5-4: add the missing destination-refusal arms. [R1 #21;
  TEST-SPEC §6.5]
  `test/suite/registry/section-6.5.ts` (plain-file arm at ~line 1435 is the
  only occupancy arm): add (a) file-form destination occupied by a symbolic
  link and by a broken symbolic link; (b) section-form target path occupied
  by a directory, by a symlink resolving to a discovered spec source, and
  by an out-of-group `.mdx` file — the latter asserting BOTH
  `refused-invalid-destination` and `refused-destination-exists`; (c) empty
  `<new-id>` (`b.mdx#`) refused `refused-invalid-id`; (d) the derived-path
  arm of `refused-invalid-destination`: emission under `markdown.outDir`
  with emit-destination component `<outDir>/new` occupied by a plain file.
  Assert stable refusal codes per FP-007.

- [ ] FP-019 — T6.5-5: add the missing usage-error arms. [R1 #22; TEST-SPEC
  §6.5]
  `test/suite/registry/section-6.5.ts` (~line 1580 area has only
  nonexistent origin file/ID, ordering, masking): add (a) wrong-kind
  (code-source) origin in each form; (b) the three mixed-synopsis
  invocations `a.mdx b.mdx#y`, `a.mdx#x b.mdx`, `a.mdx b#c.mdx` → exit 2;
  (c) parse-local ID existence arms mirroring T6.4-4 (FP-016). (The
  non-UTF-8 destination operand arm arrives via FP-005's restage.) Exit-2
  protocol per FP-002.

- [ ] FP-020 — T7-2: add the string-literal group-name keys arm. [R1 #23;
  TEST-SPEC §7]
  Neither `test/suite/registry/section-7-basics.ts` nor
  `section-7.4-7.5.ts` stages quoted keys. Add: group names as string
  literals (`"my-group"`/`"test-code"`) load, discover, and resolve in a
  coverage profile and in a policy selector.

- [ ] FP-021 — T7.5-5: add the literal-`$` forms arm. [R1 #24; TEST-SPEC
  §7.5, SPEC 14.14]
  `test/suite/registry/section-7.4-7.5.ts`: stage `$0`, trailing `$`, and
  `$` before a non-digit, each in `from` and in `to`; assert they load
  without 14.14 and match only the literal bytes.

## Stage E — §§1–9 missing tests (new-test convention applies)

- [ ] FP-022 — Implement T1.7-2: code-location ranges via occurrence
  records. [R1 #1; TEST-SPEC §1.7]
  First harness use of `xspec occurrences` (it is never invoked anywhere
  today). Assert ranges against precomputed byte offsets for: whole-file,
  function/class, multi-declaration variable, dotted namespace, default
  exports, and `@2` disambiguation. Registry module
  `section-1.6-1.7.ts`; map `"1.7"`.

- [ ] FP-023 — Implement T5.7-1: occurrence units and duplicates. [R1 #2;
  TEST-SPEC §5.7]
  One record per `d` array entry / embedding / call / marker; collapsed
  edges vs distinct occurrence records. New registry module for §5.7 (e.g.
  `test/suite/registry/section-5.7.ts` + suite wrapper); map `"5.7"`.

- [ ] FP-024 — Implement T5.7-2: byte-precise occurrence spans per kind.
  [R1 #3; TEST-SPEC §5.7]
  Array-entry expression only; the whole braced `{text(...)}` container;
  callee-through-paren; bare marker chain without `;`.

- [ ] FP-025 — Implement T5.7-3: occurrence record data and total
  deterministic order. [R1 #4; TEST-SPEC §5.7, H-6]
  Record members: file, range, edge kind, source node as
  identity-plus-range, target identity. Total order: path bytes, range
  start, range end.

- [ ] FP-026 — Implement T5.7-4: no-occurrence constructs and the exit-1
  answer carrying the domain's findings. [R1 #5; TEST-SPEC §5.7]
  Imports, type-only uses, shadowed chains, dynamic/unresolving spellings
  produce no records; the exit-1 answer still carries the domain's
  findings.

- [ ] FP-027 — Implement T6.5-7: operation-side rewrite bytes for the real
  move. [R1 #6; TEST-SPEC §6.5]
  Import-removal extents (own-line import dropped with terminator;
  shared-line declaration's own characters only), double-quoted conversion
  spellings, preserved single-quote local reference — whole files
  byte-asserted against composed expected bytes. Registry
  `section-6.5.ts`; map `"6.5"`.

- [ ] FP-028 — Implement T6.6-2: preview is inert and predictive. [R1 #7;
  TEST-SPEC §6.6 (new preview section)]
  Preview modifies nothing; a subsequent real run's applied mapping equals
  the preview's `mapping`; byte-determinism; form-exact 12.7 preview
  document under `--json`. New-§6.6 tests live beside the renamed T6.7-1
  (FP-003) — keep registry module naming coherent with
  `test/suite/registry/index.ts` imports; map `"6.6"`.

- [ ] FP-029 — Implement T6.6-3: refusal/usage-error equivalence under
  `--preview`. [R1 #8; TEST-SPEC §6.6]
  Same stable codes as the real operation; exit 1 with `mapping`/`files`/
  `delta` null; exit 2 identically; preview runs to completion under
  `--test-hold` held by another command; `--test-hold` + `--preview` is a
  usage error.

- [ ] FP-030 — Implement T6.6-4: preview report content — the ten 12.7 edit
  classes. [R1 #9; TEST-SPEC §6.6, SPEC 12.7]
  All ten edit classes with byte-precise pre-operation ranges,
  class-plus-range only, tie-break comparator.

- [ ] FP-031 — Implement T6.6-5: derived-file delta both directions,
  record-based. [R1 #10; TEST-SPEC §6.6]
  Not presence-based: with graph data deleted, `generated` approaches the
  full set and the preview still writes nothing.

- [ ] FP-032 — Implement T6.6-6: preview under a corrupt graph record.
  [R1 #11; TEST-SPEC §6.6, SPEC 14.23]
  Full preview with `delta` explicitly unavailable, a condition-23 finding
  (`unreadable-record`, concerned path the graph-data area), exit 1; the
  real operation proceeds; a refused preview reports refusal findings
  alone. Share the corrupt-record staging with FP-041 (T12.2-2's
  unreadable-record arm reuses it).

## Stage F — §§10–14 missing arms

- [ ] FP-033 — T10.1-4: stage the "malformed recorded decompositions"
  corrupt-state arm. [R2 #20; TEST-SPEC §10.1]
  `test/suite/registry/section-10.1.ts`.

- [ ] FP-034 — T10.4-2: add the non-scope presence recordings. [R2 #21;
  TEST-SPEC §10.4]
  `test/suite/registry/section-10.4.ts`: context arm
  (`metadata-consistency`, removed target `T` re-authored) and origin arm
  (`dependency-consistency`, origin `D` deleted with hashes/context set
  unchanged).

- [ ] FP-035 — T10.7-7: assert payload source ranges for EVERY present
  node. [R2 #22; TEST-SPEC §10.7]
  Currently asserted "for present requirement nodes" only
  (section-10.7-i/ii — locate the T10.7-7 body): cover every present
  node's, requirement node and present code location alike; none for
  absent nodes.

- [ ] FP-036 — T11-6: add the wrong-kind / unknown-unit / disambiguator
  arms. [R2 #23; TEST-SPEC §11.1]
  `test/suite/registry/section-11.ts`: (a) `query node`/`show` on a
  code-group `path`/`path#unit` → exit 2; (b) `query edges --from/--to` and
  `reachable --from/--to` with `#unspelled-unit` → exit 2; (c) out-of-range
  `@2`; (d) `@1` unknown at every occurrence count, staged at one and at
  two occurrences.

- [ ] FP-037 — T12.0-1/-3/-4: extend the shared command sweep with the new
  surfaces. [R2 #24; TEST-SPEC §12.0]
  `test/suite/registry/section-12.0-i.ts` `SWEEP_STEPS` (~line 235): add
  `occurrences`, `view`, `at`, `inventory`, `version`. T12.0-1 must also
  assert the JSON-only surfaces emit the same single document with the
  `--json` flag as without.

- [ ] FP-038 — T12.0-9: add the new exit-partition representatives.
  [R2 #25; TEST-SPEC §12.0]
  Exit 0: `version`, clean `occurrences`/`view`/`at`, `inventory`,
  successful previews. Exit 1: refused previews and answers carrying
  findings/explicitly-unavailable data (emitted in full). Exit 2:
  wrong-kind operands and the `occurrences --to` malformed-only exception.

- [ ] FP-039 — T12.0-10: implement the precedence arms (test stops being
  alias-only). [R2 #26; TEST-SPEC §12.0]
  Add: gated-read usage-error precedence on a failing workspace with the
  valid-twin comparison; the `show <unparseable>#id` masking arm; the
  past-the-gate corrupt-session `resolve` arm; the within-class-2
  no-configuration arms; the configuration-error-precedes arm. Update its
  H-7 entry (see FP-003's note).

- [ ] FP-040 — T12.0-12: extend the git-less sweep. [R2 #27; TEST-SPEC
  §12.0]
  Add `occurrences`, `view`, `at`, `inventory`, `version`, and the
  `--preview` invocations of `rename`/`move`.

- [ ] FP-041 — T12.2-2: add occupant-kind staleness and graph-data
  unit-form arms. [R2 #28; TEST-SPEC §12.2]
  `test/suite/registry/section-12.1-12.2.ts`: occupant kinds (symlink to a
  byte-identical target; directory); graph-data unit forms — missing
  (isolated: exactly one condition-10 unit-form finding, no per-file
  finding), mismatch (isolated via refresh-then-revert), unreadable-record
  (FP-032's staging → unit form alone; `build` replaces; `check` clean;
  `inventory` recovers).

- [ ] FP-042 — T12.2-3: pin never-refreshes per state. [R2 #29; TEST-SPEC
  §12.2]
  Missing-arm state (graph data stays absent), isolated mismatch state,
  combined per-file+unit state.

- [ ] FP-043 — T12.5-1: extend the dispatch sweep. [R2 #30; TEST-SPEC
  §12.5]
  `test/suite/registry/section-12.3-12.5.ts`: add `occurrences`, `view`,
  `at`, `inventory`.

- [ ] FP-044 — T13.3-1/T13.3-2: extend read sweeps; add the
  record-discipline arm. [R2 #31; TEST-SPEC §13.3]
  `test/suite/registry/section-13.3.ts`: sweeps gain `occurrences`, `view`,
  `at`. T13.3-2 gains: shape-blind record corruption → refreshing reads
  answer finding-free exit 0, state neither read nor replaced, `inventory`
  reports `recorded` unavailable until `build`.

- [ ] FP-045 — T13.3-3: add the whole-gate arms and the never-gated
  contrast. [R2 #32; TEST-SPEC §13.3]
  Whole-gate: garbage journal line (14.13) and obstructed write path
  (14.22) — each gated read reports it, exits 1, answers nothing, modifies
  nothing. Never-gated contrast: `occurrences`/`view`/`at` answering per
  SPEC 11.2 and `inventory` answering, on the same workspaces.

- [ ] FP-046 — T13.4-6: add plain-file occupant and finding-cardinality
  arms. [R2 #33; TEST-SPEC §13.4]
  `test/suite/registry/section-13.4.ts`: occupants — a `build` write-path
  directory component; a first-emission `outDir` component. Cardinality —
  one component refusing two writes → one finding; two components → two
  findings, via `check`.

- [ ] FP-047 — T13.5-1: add the seam-neutrality arm. [R2 #34; TEST-SPEC
  §13.5]
  `test/suite/registry/section-13.5.ts`: held-then-released final workspace
  state byte-identical to the same operation without `--test-hold` on an
  identical twin.

- [ ] FP-048 — T14-4: extend the reporter matrix. [R2 #35; TEST-SPEC §14]
  `test/suite/registry/section-14.ts`: 14.21 by `check` alone beside gate
  findings; the 14.23 row (`inventory` + previews only, `check` as 14.10
  unit form, `build`/refreshing reads never); 14.14 never `version`;
  14.13/14.22 by gated reads yet accompanying no `occurrences`/`view`/`at`
  answer; every other condition accompanying `occurrences`/`view`/`at`
  answers per domain (all three for spec-source stagings; `occurrences`
  alone for 14.7/14.11/14.18).

## Stage G — §§10–14 missing tests (new-test convention applies)

CONF-AVAIL staging constraints (CERTIFICATIONS.md, binds the 11.x bodies
below): in-scope stagings drive only the enumerated surface — never `at`;
T11.2-4's record observations ride `occurrences`/`view`; T11.4-1 stages no
undefined datum. The six in-scope tests are marked (CONF-AVAIL) — they must
certify against FP-091's fixtures once those land.

- [ ] FP-049 — Implement T10.1-5: failing-workspace gate precedence over
  session corruption, with the `check`-reports-14.21-beside-gate-findings
  discriminating pair. [R2 #1; TEST-SPEC §10.1] Registry
  `section-10.1.ts`; map `"10.1"` (+ `"14"`).

- [ ] FP-050 — Implement T11.2-1: parse-local structure and per-file
  masking with no writes. [R2 #2; TEST-SPEC §11.2] New registry module(s)
  for §11.2 (+ suite wrapper, index import); map `"11.2"`.
- [ ] FP-051 — Implement T11.2-2 (CONF-AVAIL): spelled-identity /
  interpreted-data definedness matrix. [R2 #2, R3 gap 1, VERIFY; TEST-SPEC
  §11.2]
- [ ] FP-052 — Implement T11.2-3: invalid paths (Linux leg). [R2 #2;
  TEST-SPEC §11.2]
- [ ] FP-053 — Implement T11.2-4 (CONF-AVAIL): resolution and expanded-text
  poisoning; record observations ride `occurrences`/`view`. [R2 #2, R3 gap
  1, VERIFY; TEST-SPEC §11.2]
- [ ] FP-054 — Implement T11.2-5: domain/findings/exit discipline. [R2 #2;
  TEST-SPEC §11.2]
- [ ] FP-055 — Implement T11.2-6: never-stale + gate-findings-never-attach.
  [R2 #2; TEST-SPEC §11.2]

- [ ] FP-056 — Implement T11.3-1: `occurrences` enumeration in the
  form-exact 12.7 record form. [R2 #3; TEST-SPEC §11.3] New §11.3 registry
  module; map `"11.3"`. Uses FP-001's literal decode.
- [ ] FP-057 — Implement T11.3-2: `--file` set restriction. [R2 #3;
  TEST-SPEC §11.3]
- [ ] FP-058 — Implement T11.3-3: `--to` syntactic acceptance / malformed
  spellings. [R2 #3; TEST-SPEC §11.3]
- [ ] FP-059 — Implement T11.3-4 (CONF-AVAIL): definitive emptiness.
  [R2 #3, R3 gap 1 (VIOL-AVAIL-NOFILE certifies exactly this), VERIFY;
  TEST-SPEC §11.3]

- [ ] FP-060 — Implement T11.4-1 (CONF-AVAIL): whole-domain views and
  positional tree with tag-range decomposition byte-asserted; stages no
  undefined datum. [R2 #4, R3 gap 1, VERIFY; TEST-SPEC §11.4] New §11.4
  registry module; map `"11.4"`.
- [ ] FP-061 — Implement T11.4-2: operands-vs-restriction. [R2 #4;
  TEST-SPEC §11.4]
- [ ] FP-062 — Implement T11.4-3 (CONF-AVAIL): raw attributes and per-node
  data with stated-`null` root `tags`/`coverage`. [R2 #4, R3 gap 1, VERIFY;
  TEST-SPEC §11.4]
- [ ] FP-063 — Implement T11.4-4 (CONF-AVAIL): imports datum. [R2 #4, R3
  gap 1, VERIFY; TEST-SPEC §11.4]
- [ ] FP-064 — Implement T11.4-5: `--text` expansion domain. [R2 #4;
  TEST-SPEC §11.4]
- [ ] FP-065 — Implement T11.4-6: byte classification reproducing compiled
  Markdown via the P-2 oracle (`test/helpers/oracles/markdown.ts`).
  [R2 #4; TEST-SPEC §11.4]

- [ ] FP-066 — Implement T11.5-1: total `at` resolution incl. EOF offset
  and derivability from view data. [R2 #5; TEST-SPEC §11.5] New §11.5
  registry module; map `"11.5"`.
- [ ] FP-067 — Implement T11.5-2: offset spelling matrix. [R2 #5; TEST-SPEC
  §11.5]
- [ ] FP-068 — Implement T11.5-3: occurrence containment ends and imperfect
  files. [R2 #5; TEST-SPEC §11.5]

- [ ] FP-069 — Implement T11.6-1: `inventory` anchoring byte-exact, incl.
  the E-6 drive-mismatch arm (Linux side; the Windows-subset arm is
  FP-093). [R2 #6; TEST-SPEC §11.6, E-6] New §11.6 registry module; map
  `"11.6"`.
- [ ] FP-070 — Implement T11.6-2: resolved configuration/sources/derived
  map. [R2 #6; TEST-SPEC §11.6]
- [ ] FP-071 — Implement T11.6-3: record, area, durables, orders. [R2 #6;
  TEST-SPEC §11.6]
- [ ] FP-072 — Implement T11.6-4: no-parse/no-write/one-finding
  (condition-23, `recorded` unavailable). [R2 #6; TEST-SPEC §11.6, SPEC
  14.23]

- [ ] FP-073 — Implement T12.0-13: multi-`#` operand malformedness vs `#`
  in `<file>`/`--file` values (`specs/a#b.mdx` staging). [R2 #7; TEST-SPEC
  §12.0] Registry `section-12.0-i.ts` or `-ii.ts`; map `"12.0"`.

- [ ] FP-074 — Implement T12.6-1 and T12.6-2: the `version` command.
  [R2 #8; TEST-SPEC §12.6] Form-exact `{"product","interface"}` with
  `interface` exactly `"1"`; workspace/configuration independence with the
  `build`-exits-2 discriminating pair. New §12.6 registry module (may share
  a module/wrapper with §12.7 tests); map `"12.6"`.

- [ ] FP-075 — Implement T12.7-1: 12.7 value forms — range, byte-form
  paths, the `{"unavailable": true}` uniqueness walk, finding form. Uses
  FP-001's three-state datum decode; S-5 guards that walk (FP-001).
  [R2 #9, R2 #41; TEST-SPEC §12.7] New §12.7 registry module; map `"12.7"`.
- [ ] FP-076 — Implement T12.7-2: findings-array ordering + document forms.
  [R2 #9; TEST-SPEC §12.7]
- [ ] FP-077 — Implement T12.7-3: the exit-2 error document, incl. the
  `configuration-error` stable code and the anchoring-form concerned path.
  Pairs with FP-002's protocol. [R2 #9; TEST-SPEC §12.7]

- [ ] FP-078 — Implement T13.4-8: writes create missing directories
  (file-form move, section-form move target, first emission under nested
  `outDir`). [R2 #10; TEST-SPEC §13.4] Registry `section-13.4.ts`; map
  `"13.4"`.

- [ ] FP-079 — Implement T14-6: stable codes — all 23 condition tokens read
  from each condition's stated reporter; `code` `null` for plain usage
  errors and review refusals. [R2 #11; TEST-SPEC §14] Registry
  `section-14.ts`; map `"14"`.
- [ ] FP-080 — Implement T14-7: refusal reasons — each stable refusal code
  with concerned file/range/identity; all-applicable-reasons-together; the
  invalid-workspace refusal reporting numbered findings alone. [R2 #12;
  TEST-SPEC §14]
- [ ] FP-081 — Implement T14-8: location cardinality — one finding locating
  every participant (triple-duplicate ID, import collision, cycle full
  path, embedding container span); within-finding location order. [R2 #13;
  TEST-SPEC §14]

## Stage H — property layer (§16) and oracles (S-6)

- [ ] FP-082 — P-2 generator: include backticks/`~` so fenced code blocks
  and inline code spans spelling construct-like bytes are generated, with
  the oracle treating them as content. [R2 #36; TEST-SPEC §16 P-2]
  Generator/oracle: `test/helpers/oracles/markdown.ts` +
  `test/suite/registry/section-16-p2-p3.ts`. Keep the S-6 markdown-oracle
  vetted suite green (`test/self/s6-markdown-oracle.test.ts`) — extend its
  vectors for the new grammar-boundary treatment.

- [ ] FP-083 — Implement the P-5 section-move category oracle + its S-6
  vetted fixed-vector suite. [R2 #42; TEST-SPEC §16 P-5, §17 S-6; SPEC 6.2,
  5.6]
  New oracle under `test/helpers/oracles/`; vetted vectors: SPEC 6.2's
  worked straddling-line case plus the T6.2-3/T6.2-4 cases, in a new
  `test/self/s6-*-oracle.test.ts`.

- [ ] FP-084 — Generalize P-5 to random section moves using the full
  6.2/5.6 oracle. [R2 #37; TEST-SPEC §16 P-5] After FP-083.
  `test/suite/registry/section-16-p5-p6.ts` currently restricts the
  section-move arm to "clean-boundary" moves. Require: random section moves
  generally — straddling-line drops computed via the line-drop rules/P-2
  oracle, created-target-file root as added, coincident-parent purity,
  `metadata-changed` on no node — anchored by T6.2-3/T6.2-4.

- [ ] FP-085 — Implement the P-6 baseline graph-diff oracle + its S-6
  vetted suite; wire P-6 to it. [R2 #42; TEST-SPEC §16 P-6, §17 S-6; SPEC
  5.6]
  Vetted vectors: SPEC 5.6's three worked examples + the T5.6-6 case.

- [ ] FP-086 — P-7 generator: add the `$`-at-capture-boundary literal forms
  (`$0`, `$` before a non-digit, trailing `$`). [R2 #38; TEST-SPEC §16 P-7]
  `test/suite/registry/section-16-p7.ts` (+ glob-input generator); keep the
  S-6 glob-oracle suite (`test/self/s6-glob-oracle.test.ts`) green —
  `test/helpers/oracles/glob.ts` already models patterns; extend vectors if
  the oracle needs the literal-`$` forms pinned.

- [ ] FP-087 — Implement P-11: availability robustness fuzz over
  `occurrences`/`view`/`at`. [R2 #14; TEST-SPEC §16 P-11] New §16 registry
  module + wrapper; H-7 map per the passages its TEST-SPEC entry asserts.
  Property machinery: `test/helpers/property.ts` (fixed default seed set —
  see AGENTS.md).

- [ ] FP-088 — Implement P-12: `at` ≡ view-derived resolution over every
  offset; occurrence order/totality equivalence. [R2 #15; TEST-SPEC §16
  P-12]

- [ ] FP-089 — Implement the P-13 coverage-reachability oracle (independent
  SPEC 8.1/8 reachability) + its S-6 vetted suite (vectors per SPEC 15).
  [R2 #42; TEST-SPEC §16 P-13, §17 S-6]

- [ ] FP-090 — Implement P-13: coverage oracle property — random
  workspaces/profiles vs the FP-089 oracle. [R2 #16; TEST-SPEC §16 P-13]
  After FP-089.

## Stage I — CONF-AVAIL certification family

- [ ] FP-091 — Build the CONF-AVAIL fixture family, wire the manifest, and
  flip the whole-document pins. [R3 gaps 1–2, R2 #40, VERIFY; CERTIFICATIONS.md
  CONF-AVAIL; TEST-SPEC §17 C-1/C-2]
  After the six in-scope tests are registered (FP-051, FP-053, FP-059,
  FP-060, FP-062, FP-063).
  - New `test/fixtures/conf-avail/`: plain Node ESM conformer (`bin.mjs` +
    `product.mjs`, no build step/deps — see AGENTS.md and existing
    fixtures) implementing the scope CERTIFICATIONS.md states, and the
    three violators beside it (`bin-<deviation>.mjs` naming per document):
    VIOL-AVAIL-NULLMARKER (certifies T11.2-2, T11.2-4, T11.4-3, T11.4-4),
    VIOL-AVAIL-OMIT (those plus T11.4-1), VIOL-AVAIL-NOFILE (exactly
    T11.3-4).
  - `test/self/certification-fixtures.ts`: append the fifth conformer entry
    (list currently ends at CONF-DISC), in-scope IDs and violator
    `certifies` verbatim from the document.
  - `test/self/certification-document.test.ts`: pins 4 conformers/13
    violators → 5/16.
  - Verify: `npm run test:self` fully green on certification-document and
    certification (conformer passes every in-scope test; each violator
    fails at least one certified test) — this task clears the three VERIFY
    certification-document failures.

## Stage J — E-6 cross-platform legs

- [ ] FP-092 — Extend the E-6 representative fixture with the new command
  steps. [R2 #43; TEST-SPEC E-6]
  `test/helpers/e6.ts` (the `step(...)` sequence): add `occurrences`,
  `view --text`, `at`, `inventory` (invoked from a NESTED working
  directory), `version`, and `move --preview` — their path/range-dense JSON
  documents byte-compared across legs via the existing exchange
  (`test/suite/e6-exchange-writer.test.ts`, `test/windows/
  e6-byte-identity.test.ts`, `XSPEC_E6_EXCHANGE_DIR`; see AGENTS.md).

- [ ] FP-093 — Add the Windows-subset drive-mismatch anchoring arm of
  T11.6-1. [R2 #43; TEST-SPEC §11.6 (E-6 arm)] After FP-069.
  `test/windows/` (beside `e6-subset.test.ts`): the drive-mismatch
  anchoring arm runs on the Windows leg only.
