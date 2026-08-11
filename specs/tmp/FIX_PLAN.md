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

- [x] FP-001 — Rebuild the findings decode layer as a literal, form-exact
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

- [x] FP-002 — Fix the exit-2 output-stream protocol everywhere it is
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

- [x] FP-003 — Re-pin the H-7/S-1 traceability universe and apply the
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
    failure narrows to exactly {5.7, 6.6, 11.2, 11.3, 11.4, 11.5, 11.6,
    12.6, 12.7} (6.7 and 11.1 become mapped here; 6.6 — Previews — joins
    the red set as planned-task fallout the original note missed: the
    retired T6.6-1's false "6.6" coverage is removed, and "6.6" stays
    unmapped until FP-028+ register T6.6-2..-6) and stays red until stages
    E/G land — state left red on purpose. [Done 2026-08-10: exactly that
    9-key set observed; T6.7-1 red-as-diagnosed under its new ID; registry
    module renamed section-6.6.ts → section-6.7.ts (wrapper too) so FP-028
    creates a fresh section-6.6.ts for the preview tests;
    SPEC_BODY_TEXT_KEY_SECTIONS reviewed against amended H-7 — unchanged.]

## Stage B — existing assertions that contradict the current spec

- [x] FP-004 — Invert T10.7-12's code-impact-scope range assertion.
  [R2 #19; SPEC 10.7, 1.7]
  `test/suite/registry/section-10.7-ii.ts` ~line 638 asserts a present
  `code-impact` scope "must carry no source range". Current SPEC 10.7/1.7:
  a PRESENT code-location scope carries its source range; only a DELETED
  location's entry carries none. Invert the assertion and stage both sides
  (present location → range asserted byte-precisely; deleted location →
  no range). Verify: red-as-diagnosed against stub; no self-test change.
  [Done 2026-08-10: `assertPresentState` now requires the range (every
  present node carries one, SPEC 10.7); the code-impact scope became the
  named unit `src/ref.ts#refUnit` per TEST-SPEC's refreshed entry, its
  construct range byte-asserted against precomputed offsets behind a
  multi-byte prefix; a second location `src/del.ts` (added v1, deleted v2)
  stages the deleted side — absent, no text, no range. T10.7-12 turned from
  falsely-green to red-as-diagnosed exactly at the range assertion (stub
  omits it); the reworked matrix including the deleted arm verified sound
  against the stub via a local probe. Traceability gains "1.7" per
  TEST-SPEC's stated delegation (T1.7-1/T1.7-2 → T10.7-12). Self-tests
  unchanged: 4 planned mid-loop reds (certification-document ×3 → FP-091;
  S-1's 9 unmapped keys → stages E/G).]

- [x] FP-005 — Re-stage the two `move` destination spellings that changed
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
  [Done 2026-08-10: both arms now live in T6.5-5's valid-workspace block —
  exit 2 via `expectMoveUsageError` (FP-002 protocol: single 12.7 error
  document under `--json`, stderr message present), each wrapped in a
  whole-root `assertLeavesUnchanged` compare; the helper widened to
  raw-byte argv (`ArgvValue`) for the Linux-leg non-UTF-8 operand while
  `expectRefusalModifiesNothing` narrowed back to strings; T6.5-4's
  title/cases now carry the dead-letter note instead of the arms; the S-3
  driver self-test's staging citation updated T6.5-4 → T6.5-5. Verified:
  T6.5-4 green against the current product (contradiction gone); T6.5-5
  red-as-diagnosed — direct probe shows the product still exits 1 with a
  refusal document on both spellings (classifies the operand as a path)
  where the arms demand exit 2; the suite test currently fails earlier at
  its first arm (exit-2 stdout empty under `--json`, the FP-002-class
  product gap). `npm run test:self`: unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1 unmapped keys → stages E/G).]

## Stage C — §§1–9 cross-cutting assertion sweeps (after FP-001)

- [x] FP-006 — Sweep §§1–9 condition assertions to assert stable code
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
  [Done 2026-08-10 — already satisfied by FP-001's landing; no code change.
  The sweep found every §§1–9 numbered-condition assertion site (1.3:
  14.1–14.4; 1.4: 14.4; 1.5: 14.19; 1.6-1.7: 14.20; 2.1: 14.15/14.9; 2.4:
  14.5–14.8; 2.5-2.6: 14.17/14.12; 2.7: 14.16/14.17/14.8; 4: 14.15;
  4.3-4.4: 14.8/14.11; 4.5: 14.8/14.18; 5.1-5.3: 14.9; 7-*: 14.14/14.12/
  14.15/14.19; 8: 14.12; sections 1.1-1.2, 2.2-2.3, 3, 4.1-4.2, 4.6,
  5.4-5.6, 9, 9.3 assert none) routing through the shared helpers FP-001
  rebuilt — `buildFindings`/`assertConditionCounts`/`assertFindingLocated`/
  `finding.condition`/`expectConfigurationError` — all on the form-exact
  12.7 decode (`decodeFindingForm`: exact five members, path forms, orders,
  collapse). The `14.N` identity exists only as the pinned-table image of
  the decode-validated token (FP-001's stated design: condition-identity
  assertions are expressed against tokens; unknown or missing codes fail
  the decode loudly), so each `"14.N"` assertion holds exactly for the one
  SPEC 14 code string; `expectConfigurationError` asserts
  `"configuration-error"` directly. No §§1–9 site asserts a condition via
  stderr text, human-report mentions (`conditionMention` is S-5-only), or
  ad-hoc JSON access. Verified: typecheck clean; `npm run test:self`
  unchanged 4 planned mid-loop reds (certification-document ×3 → FP-091;
  S-1 unmapped keys → stages E/G) with S-5 and certification green
  (CONF-VALID, emitting 12.7-form findings with stable tokens, passes its
  in-scope T1.3-*/T1.4-* tests; violators fail as certified); probe run of
  FP-001-untouched section-2.4 red-as-diagnosed at the form-exact decode
  ("expected no member \"condition\"" against the pre-12.7 product), no
  crashes.]

- [x] FP-007 — Make §6 refusal assertions assert stable refusal codes with
  their concerned file/range/identity. [R1 #27; TEST-SPEC §§6.4–6.5, SPEC
  12.7, 14]
  `expectRefusalModifiesNothing` (defined in
  `test/suite/registry/section-6.4.ts` ~line 303 and used across
  section-6.4.ts / section-6.5.ts) asserts only exit 1 plus
  workspace-unchanged. Extend it (or its call sites) so each refusal arm
  asserts the exact stable refusal code and the concerned file/range/
  identity of the refusal finding, most acutely T6.4-3, T6.5-4, T6.5-6.
  Verify: red-as-diagnosed only.
  [Done 2026-08-10: both modules' `expectRefusalModifiesNothing` now take a
  per-arm `RefusalExpectation` — run with `--json`, exit 1, stdout decoded
  as the form-exact 12.7 findings-only report, exactly one finding under the
  arm's exact stable code (each arm isolates one cause; one finding per
  applicable reason, SPEC 14), plus the reason's §14 concern via new
  support.ts helpers: `assertFindingNamesIdentity` (full 1.5 identity or
  bare ID — §14 requires identification, not spelling; refused-invalid-id,
  refused-identity-unchanged, refused-missing-target-parent,
  refused-structural-parent), `assertFindingConcernsPath` (12.7 `path`
  member equality; refused-destination-exists, refused-invalid-destination),
  `assertFindingMentionsLocation` (SOME-quantified; refused-id-collision
  locates the remaining bearer — byte windows over the staged `a.sib`/`y`
  constructs; refused-cycle's dependency arm locates the participating
  `d={"keep"}` spelling; T6.5-6's collision asserts file-only, B.mdx being
  product-rewritten). The spec-import-cycle arm pins code+form alone (the
  would-be cycle's participating import declarations exist in no
  pre-operation source, so no concern window is derivable). Precondition
  arms (T6.4-6, T6.5-4) assert the invalid-workspace refusal as exactly the
  one located 14.5 finding, no refusal reason beside it. Traceability: "14"
  added to T6.4-3/T6.5-4/T6.5-6 per TEST-SPEC 14's refusal-reason staging
  record. Verified: those four tests turned falsely-green →
  red-as-diagnosed at the form-exact decode (the stub emits `{"refused":…}`
  for refusals and old-shape `condition` findings for the gate; suite files
  6.4+6.5 went 2 failed/11 passed → 6 failed/7 passed, the other four being
  the pre-existing FP-002-class exit-2 gaps); `npm run test:self` unchanged
  4 planned mid-loop reds (certification-document ×3 → FP-091; S-1 unmapped
  keys → stages E/G), S-5 and certification green.]

## Stage D — §§1–9 missing arms, with paired certification-fixture reworks

- [x] FP-008 — T1.3-6: add the invalid-`id`-form arms. [R1 #13; TEST-SPEC
  §1.3, SPEC 14.17]
  `test/suite/registry/section-1.3.ts` has no 14.17 arm. Add: a
  repeated-`id` bearer and a braced-`id` bearer (`id={"x"}`), each reporting
  14.17 and never 14.1, masking 14.2 for its immediate children, while
  grandchildren's structural checks still report. Pair with FP-009 (the
  CONF-VALID conformer must pass this arm once both land — certification
  for the family may be red between the two commits; prefer one spawn).
  [Done 2026-08-10, one spawn/commit with FP-009: two arms appended to
  T1.3-6's body — `<S id="one" id="two">` and `<S id={"x"}>`, each behind a
  valid sibling so the bearer's location window has teeth, each holding an
  immediate child `a.b` (extends no candidate parent spelling and is
  multi-segment against the empty prefix, so a non-masking or
  value-adopting product reports an extra 14.2) with grandchild `zzz`. Each
  arm asserts exact counts {14.17: 1, 14.2: 1} — hence no 14.1, no 14.20,
  no immediate-child 14.2 — the 14.17 located within the bearer, the one
  14.2 within the grandchild. Title updated; traceability already
  ["1.3", "14"]. Suite file red-as-diagnosed against the stub (all six
  T1.3-* fail at the FP-001-class form-exact decode: the stub still emits
  `condition`-member findings, so the new arms' first decode fails the same
  way); arm soundness proven through the paired conformer: CONF-VALID
  12/12.]

- [x] FP-009 — Rework CONF-VALID to its refreshed CERTIFICATIONS.md scope.
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
  [Done 2026-08-10, same commit as FP-008. (d) had already landed with
  FP-001 (findingsDoc emits the literal 12.7 form with stable tokens);
  this task added the behavioral 14.17 path: the MDX-lite lexer now counts
  attribute occurrences per element and scans braced values (`name={...}`,
  balanced, string-aware) as well-formed MDX — never 14.20; a repeated
  prop name (one finding per name) or an `id`/`tags` value not in
  quoted-static form (braced or valueless) yields a 14.17 finding at the
  bearing element (`"14.17": "invalid-prop"` in CODE_TOKENS); an afflicted
  `id` spells no identity — never 14.1 (only a wholly absent `id` is
  14.1), own segment/structural/duplicate checks skipped, and the existing
  parent-spells-no-identity masking covers repeated/braced parents
  unchanged since `id` stays null. bin-ctrl/bin-wide untouched. Verified:
  `npm run test:self` — CONF-VALID conformer 12/12 in-scope tests pass
  (extended T1.3-6 included), VIOL-VALID-CTRL and VIOL-VALID-WIDE each
  fail exactly their three certified tests and pass T1.3-6; the 4 planned
  mid-loop reds unchanged (certification-document ×3 → FP-091; S-1's 9
  unmapped keys → stages E/G).]

- [x] FP-010 — T3-1: add the grammar-boundary arm. [R1 #15; TEST-SPEC §3]
  `test/suite/registry/section-3.ts` — the T3-1 fixture's fence (~line 92)
  contains only plain text. Add fences and an inline code span containing
  `<S id="x">`, `<div>`, `import X from "./X.xspec"`, `{text("a")}`, and
  assert: no node, no edge, no finding, bytes preserved byte-for-byte.
  Pair with FP-011 (same red-window note as FP-008/FP-009).
  [Done 2026-08-11, one spawn/commit with FP-011: the ```text fence gained a
  `<div>` line; a second ```md fence in gamma carries `<S id="x">`,
  `import X from "./X.xspec"`, `{text("a")}`; an inline code span in gamma
  carries `<S id="x">{text("a")}`. Arm asserts: `build` and `check` exit 0
  (no finding of any kind — a pattern-parsing product instead hits 14.20/
  14.16/14.15/14.6); `query nodes` identity set exactly the six staged
  requirement nodes via a new scoped identity-only decoder
  (`decodeNodeIdentityRowsReport`, adapters/query.ts, S-5-guarded — CONF-MD's
  scope pins no tags/coverage/range semantics); `query edges` set exactly
  the 4 `contains` + 3 `depends` edges (decodeEdgesReport +
  assertEdgeSetEqual); compiled bytes byte-asserted with the fence/span
  lines preserved verbatim. NOT red against this repo's product: the
  post-phase-10 product already parses fences/spans as literal (T3-1 stays
  green, a real pass — probe below proves the arm's teeth); traceability
  unchanged (T3-1 → "3"; asserts no numbered condition).]

- [x] FP-011 — Rework CONF-MD to its refreshed CERTIFICATIONS.md scope.
  [R3 gap 3; CERTIFICATIONS.md CONF-MD]
  `test/fixtures/conf-md/product.mjs` (+ `bin-class.mjs`/`bin-cr.mjs`):
  (a) support `check` with exit 0 on T3-1's grammar-boundary staging (today:
  exit 2 "unknown command"); (b) support `query nodes`/`query edges` with
  no-node/no-edge reports (today exit 2); (c) give `parseMdx` fence and
  inline-code-span lexer state so `<S id="x">` inside a fence is literal
  content — no node, no edge, no finding (today a spurious 14.20), bytes
  preserved. After: FP-010. Verify: CONF-MD conformer green on in-scope
  tests incl. T3-1's new arm; violators still certify.
  [Done 2026-08-11, same commit as FP-010. `markdownLiteralRegions` pre-scan
  (CommonMark-ish subset: >=3-backtick/tilde fences with up-to-3-space
  indent, backtick info strings without backticks, unclosed-to-EOF; inline
  spans close at an exactly-equal-length backtick run on the same line —
  single-line spans are the staged scope) feeds parseMdx, which skips whole
  regions into plain content; the scan uses plain Markdown line structure,
  deliberately outside the CERT-13 deviation hook so each violator keeps its
  single deviation. `check` = validate + cycle surface, write nothing, exit
  0/1; `query nodes`/`query edges` answer the honest whole reports (roots as
  bare paths, contains/depends/embeds, set-collapsed, byte-ordered) gated on
  validity per 13.3. No P-2 interference: the generator's prose alphabet
  excludes backticks and `~`. bin-class/bin-cr untouched. Verified:
  CONF-MD conformer 8/8 in-scope (new arm included); VIOL-MD-CLASS fails
  exactly T3-3+P-2, VIOL-MD-CR exactly T3-4+P-2, both passing T3-1;
  `npm run test:self` unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1's 9 unmapped keys → stages E/G);
  teeth probe: the pre-rework conformer on the new staging exits 1 with the
  diagnosed spurious 14.20 ("unclosed section tag") — the arm fails any
  parse-by-pattern product at `buildOk`.]

- [x] FP-012 — T1.7-1: add the bare-identity edge-endpoint arms. [R1 #14;
  TEST-SPEC §1.7]
  `test/suite/registry/section-1.6-1.7.ts` asserts only `query node`/`show`
  ranges; no code location, no `reachable` anywhere in the file. Add arms
  asserting endpoints-as-identities-alone on (a) `edges` rows, (b) a
  `reachable` witness path, and (c) `query node`'s incoming/outgoing edge
  lists — each traversing a code location.
  [Done 2026-08-11: T1.7-1 gains a second workspace (spec+code config;
  `src/app.ts#entry` --references--> `alpha` --depends--> `omega`,
  `src/app.ts#writer` --embeds--> `omega`) with the three arms: (a)
  unfiltered `query edges` pinned to the exact five-edge set, (b)
  `reachable --from src/app.ts#entry --to specs/E.mdx#omega` pinned to the
  witness path [entry, alpha, omega], (c) `query node` on alpha and omega
  pinned to exact incoming/outgoing lists — endpoint values via the H-3
  decoders (identity strings), the no-range-datum half via a new
  adapter-layer 1.7 walk in `test/helpers/adapters/query.ts`
  (`assertBareEdgeEndpoints` over whole edges/reachable documents;
  `assertNodeEdgeListsBare` scoped to the node report's edge lists so the
  node's own contractual sourceRange stays out of scope). The walk rejects
  any member named `range`/`sourceRange` and any {start,end}-bearing object,
  detector adapter-owned like the ASSUMED SHAPE. S-5 guards added
  (accepts-bare + rejects-with-path synthetic cases, missing-edges-member
  rejection). NOT red against this repo's product: it already reports bare
  endpoints — probe confirmed the exact edge set and witness path above, so
  the pass is genuine; teeth live in the S-5 rejections plus exact-value
  pinning. Traceability unchanged (T1.7-1 → ["1.7"]; no numbered condition).
  `npm run test:self`: unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1's 9 unmapped keys → stages E/G);
  suite file 1.6-1.7 shows only T1.6-5's pre-existing FP-001-class product
  gap (form-exact findings decode), T1.7-1 green.]

- [x] FP-013 — T4.3-2: add the zero-argument and two-argument `text(...)`
  arms. [R1 #16; TEST-SPEC §4.3, SPEC 14.8]
  `test/suite/registry/section-4.3-4.4.ts` (~line 294) has only the
  string/computed-index/optional-chaining arms. Add `text()` and
  `text("a","b")` calls in a TypeScript file, each → 14.8.
  [Done 2026-08-11: two arms appended to T4_3_2_ARMS — `text();` and
  `text(SPEC.a, SPEC.a.b);` — the two-argument arm passing two static
  resolvable node chains per T2.4-3's MDX precedent (the language's valid
  argument form; this task summary's literal `text("a","b")` would stage
  two further string-form-in-TS 14.8 defects, making the finding count
  ambiguous and letting an arity-tolerant product pass), so arity is each
  arm's sole defect: exactly one 14.8 asserted at the call within the
  offending statement's byte window, per TEST-SPEC §4.3 ("14.8's arity
  clause holds in either language"). Title extended to the full TEST-SPEC
  entry; traceability already ["4.3","14"], unchanged. Verified by direct
  probe against the built product: a valid one-argument control of the
  identical shape builds exit 0 (arity is the sole delta); each arm exits 1
  with exactly one 14.8 located within the computed window, no 14.18
  beside; the suite test itself stays red-as-diagnosed at the pre-existing
  FP-001-class form-exact decode (the product still emits condition-member
  findings — same first-arm failure as before, new arms unreached until
  that product gap closes). `npm run test:self`: unchanged 4 planned
  mid-loop reds (certification-document ×3 → FP-091; S-1's 9 unmapped keys
  → stages E/G).]

- [x] FP-014 — T4.5-2: add the upstream (cross-file) impact arm. [R1 #17;
  TEST-SPEC §4.5]
  `test/suite/registry/section-4.5.ts` stages only the same-document
  subtreeHash edit (direct impact). Add: the marker's document bears a
  root-sourced `{text(...)}` edge into another file; an edit THERE changing
  only that root's effectiveHash leaves the location transitively impacted
  while no node of the marker's own document is `changed`.
  [Done 2026-08-11: T4.5-2 gains a second workspace — MAIN.mdx holds
  `import OTHER from "./OTHER.xspec"` plus a top-level `{text(OTHER.
  upstream)}` outside any section (the T8-5 shape: root-sourced `embeds`
  edge, SPEC 2.3/1.2) and an untouched `local` section as in-document
  control; the same root-marker `src/app.ts`. Staging integrity pins both
  dependency edges as complete per-kind sets, so the marker's `references`
  edge is the location's only impact edge and the root-sourced `embeds`
  edge the root's only dependency edge. After baseline commit + edit of
  the embedded target's text: `assertImpactedCode` (section-9's helper) —
  direct EMPTY, transitive exactly [src/app.ts | references →
  specs/MAIN.mdx | path specs/MAIN.mdx > specs/OTHER.mdx#upstream], the
  witness forced (the `contains` step to `local` has unchanged
  effectiveHash); `assertRequirementCategories` (section-5.6's helper, the
  section-15 reuse precedent) with the complete table — `upstream`
  `changed`, OTHER root `descendant-changed` exact [upstream], MAIN root
  exactly `upstream-changed` exact [upstream], `local` uncategorized —
  which realizes "no node of the marker's document `changed`" (a product
  folding embedded text into the embedder's own content would flip MAIN
  root to `changed`/the location to direct). NOT red against this repo's
  product: impact semantics predate the patch — a direct probe of the
  staging against the built product returned byte-for-byte the expected
  edges, code groups, and category table, so the pass is genuine; teeth
  live in the exact-value pinning over the forced fixture. Traceability
  unchanged (T4.5-2 → ["4.5"]; the entry's 8/9.2 parentheticals are
  context with home coverage at T8-*/T9.2-*, no numbered condition
  asserted). Verified: section-4.5 unchanged 2 failed / 5 passed (T4.5-3/
  T4.5-5 red at the pre-existing FP-001-class form-exact product gap;
  T4.5-2 green including the new arm); `npm run test:self` unchanged 4
  planned mid-loop reds (certification-document ×3 → FP-091; S-1's 9
  unmapped keys → stages E/G).]

- [x] FP-015 — T6.4-1: assert the rename command's own report — the applied
  mapping. [R1 #18; TEST-SPEC §6.4, SPEC 12.0, H-3]
  `test/suite/registry/section-6.4.ts` asserts journal append and rewrites
  only; rename stdout is never decoded. Add: decode rename's stdout (JSON
  per 12.0, H-3 adapter) and assert the report is the applied mapping —
  every journaled identity pair.
  [Done 2026-08-11: T6.4-1's rename now runs with `--json` (runJson: exit 0,
  single JSON document as the entire stdout, 12.0) and its report decodes
  through a new adjustable H-3 adapter, `test/helpers/adapters/operations.ts`
  `decodeAppliedMappingReport` (ASSUMED SHAPE `{"mapping":[{"from","to"}…]}`,
  mirroring the preview's pinned 12.7 `mapping` member — the report shape
  itself is unpinned, adapter adjustable to shape never values, fail-loud on
  a mapping-less report; model type `AppliedMappingPair`). The test asserts
  the pairs as a complete set via support.ts `assertAppliedMapping` (order is
  shape, not information): exactly {core.mid→core.hub, core.mid.leaf→
  core.hub.leaf} in full 1.5 identity form — SPEC 6.4 pins the journaled
  mapping as the renamed ID plus prefix-replaced descendants, nothing else,
  and the fixture's post-rename identity assertions already pin those two as
  the only new identities. S-5 gains the adapter's DECODERS entry (positive
  control incl. an ignored `findings` sibling member; rejections: absent/
  null/non-array mapping — the current product's `{"findings":[]}` shape is
  the labeled absent case — pair missing from/to, empty identity, non-object
  pair). Verified: T6.4-1 turned falsely-green → red-as-diagnosed exactly at
  the applied-mapping decode ("required key \"mapping\" … absent" — probe:
  the product reports `{"findings":[]}` on successful rename and rejects
  `--preview` as unknown, the whole 6.6 surface being patch-new); section-6.4
  went 3 failed/4 passed → 4 failed/3 passed, the other three being the
  pre-existing FP-002/FP-007-class gaps (T6.4-3/-4/-6), downstream arms
  unreached until the product reports the mapping. Typecheck clean; S-5
  66/66; `npm run test:self` unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1's 9 unmapped keys → stages E/G);
  T6.4-1 in no certification scope. Traceability unchanged (["6.4"]; 12.0/
  6.6 are carriage context with home coverage elsewhere). FP-017 (move's
  applied-mapping report) reuses this adapter and helper.]

- [x] FP-016 — T6.4-4: add the wrong-kind and parse-local old-ID-existence
  arms. [R1 #19; TEST-SPEC §6.4]
  `test/suite/registry/section-6.4.ts`, none present today: (a) discovered
  code source passed as `<file>` → exit 2; (b) duplicate-spelling bearers →
  exit 1 via the duplicate-ID finding; (c) bearer beneath an ancestor
  spelling no identity → exit 1; (d) sole would-be bearer spelling no
  identity (repeated `id` attribute) → exit 2 beside that file's findings.
  [Done 2026-08-11: (a) base and ordering arms now run on
  SPEC_AND_CODE_CONFIG with a discovered, reference-free `src/app.ts`, each
  adding `rename src/app.ts a a2` → exit 2 via `expectRenameUsageError`
  (FP-002 protocol: single 12.7 error document under `--json`, stderr
  message present) beside the existing nonexistent-file/old-ID invocations —
  TEST-SPEC's "checked before source validation" covers all three, so the
  wrong-kind operand rides both arms; three parse-local arms follow the
  masking arm: (b) two top-level sections both spelling `dup` →
  `expectRefusalModifiesNothing` (the T6.4-6 protocol: exit 1 under
  `--json`, form-exact 12.7 findings-only report, exactly one 14.3 located
  in the file, whole-root snapshot compare); (c) sole bearer `kid` beneath
  an id-less `<S>` ancestor → same protocol, exactly one 14.1 (the bearer's
  14.2 masked per condition 2's rule, so the ancestor's finding is the
  workspace's only one); (d) `<S id="solo" id="solo">` sole would-be bearer
  → staging premise pinned first (`build --json` reports exactly one 14.17
  — a repeated `id` is condition 17, never 14.1, and spells no identity)
  then `rename … solo solo2` → exit 2 via the usage-error protocol.
  Title/module comments extended; traceability unchanged (["6.4","12.0"]:
  T6.4-4 appears in no TEST-SPEC 14 staging record — the masking arm's
  14.20 precedent); no certification scope. Soundness proven by direct
  probes against the built product (suite arms downstream of the first are
  unreached — T6.4-4 stays red-as-diagnosed at the base arm's exit-2
  error-document decode, the FP-002-class product gap; findings decodes the
  FP-001 class): wrong-kind exits 2 on valid and failing workspaces; dup →
  exit 1 with exactly one 14.3 in-file; anc → exit 1 with exactly one 14.1,
  no unknown-ID error (existence established by the spelled bearer); solo →
  build exactly one 14.17, rename exit 2 "unknown ID 'solo'"; both refusals
  wrote nothing. Section-6.4 unchanged 4 failed / 3 passed; `npm run
  test:self` unchanged 4 planned mid-loop reds (certification-document ×3 →
  FP-091; S-1's 9 unmapped keys → stages E/G).]

- [x] FP-017 — T6.5-1: assert the applied-mapping report for the file-form
  move (both forms report as rename does). [R1 #20; TEST-SPEC §6.5]
  `test/suite/registry/section-6.5.ts`: decode the move command's stdout in
  both file form and section form and assert the applied mapping, exactly
  as FP-015 does for rename.
  [Done 2026-08-11: both forms decode through FP-015's layer
  (`decodeAppliedMappingReport` + `assertAppliedMapping`), split as the
  journal clause already is (TEST-SPEC T6.5-1 carries the clause; module
  header documents the split). T6.5-1's file-form move now runs via
  `runJson` (`--json`: exit 0, single JSON document as the entire stdout,
  12.0) and asserts exactly four pairs — every node of the moved file, the
  implicit root included (SPEC 1.2/1.5: its identity is the path alone;
  its pair is journaled, else 6.3 replay could not unify the root across
  the move, T6.2-2's purity). T6.5-3's section-form move gained `--json`
  in R3_MOVE_ARGV (identical argv in both H-6 determinism directories, so
  that compare is unaffected) and asserts exactly the three
  prefix-replaced subtree pairs (`org.mv{,.k1,.k2}` → `tm{,.k1,.k2}`),
  no other identity mapped. Titles extended; traceability unchanged
  (both ["6.5"]; 12.0/6.4/6.6 carriage context per FP-015 precedent);
  neither test in any certification scope; no new adapter, so S-5's
  existing operations-adapter guards cover the decode. Verified: both
  tests turned falsely-green → red-as-diagnosed exactly at the
  applied-mapping decode ("required key \"mapping\" … absent" — probe:
  the product reports `{"findings":[]}` on successful move in both
  forms), downstream arms unreached until the product reports the
  mapping; section-6.5 went 3 failed/3 passed → 5 failed/1 passed
  (T6.5-2 stays green; T6.5-4/-5/-6 keep their pre-existing
  FP-002/FP-007-class reds). Typecheck clean; `npm run test:self`
  unchanged 4 planned mid-loop reds (certification-document ×3 → FP-091;
  S-1's 9 unmapped keys → stages E/G).]

- [x] FP-018 — T6.5-4: add the missing destination-refusal arms. [R1 #21;
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
  [Done 2026-08-11: all seven arms landed in T6.5-4.
  `expectRefusalModifiesNothing` widened to take one `RefusalExpectation`
  per applicable reason (counts assert the complete multiset — no reason
  beside the staged ones; per-reason concern lookup by counting key, total
  since a refusal report holds one finding per reason, SPEC 14). (a)+(b)
  ride the shared refusal workspace — occupants staged before the premise
  `build` (directory `specs/DirTarget.mdx`; symlinks `specs/SymDest.mdx`/
  `specs/LinkTarget.mdx` → B.mdx, broken `specs/GoneDest.mdx`; plain
  out-of-group `docs/Occ.mdx` in the files map), each arm
  `refused-destination-exists` concerning the occupied path, the Occ arm
  additionally `refused-invalid-destination`, both concerning
  `docs/Occ.mdx`. (c) `move specs/A.mdx#keep specs/B.mdx#` →
  `refused-invalid-id` concerning `specs/B.mdx#` (zero-segment id; exit 1,
  never the exit-2 generalization of 11.3's `--to` rule). (d) its own
  workspace (`V4_OUTDIR_CONFIG`: glob admits `new/**/*.mdx`,
  `markdown.outDir: "mdout"`; plain file at `mdout/new`; premise `build`
  exit 0 — the occupant lies under no current source's write path) →
  `move specs/Solo.mdx new/b.mdx` refused `refused-invalid-destination`
  concerning the destination path `new/b.mdx`, never 14.22, the count map
  excluding a 14.22 beside. Verified by direct probes against the built
  product (suite arms past the first are unreached — T6.5-4 stays
  red-as-diagnosed at the first arm's FP-001-class form-exact decode, the
  product still emitting `{"refused":…}`/`condition`-member shapes;
  section-6.5 unchanged 5 failed / 1 passed): both premise builds exit 0
  with every occupant present; the five occupant arms and the empty-id arm
  each exit 1 modifying nothing on exactly the staged ground (the product's
  old-shape message names the symlink/directory/broken-link occupant, the
  no-spec-group cause, the empty-segment ID); the two-reason Occ arm's
  count assertion has teeth (the current product reports only one reason);
  a control twin proves (d)'s staging — without the occupant the identical
  move succeeds and writes `mdout/new/b.md`, pinning the 13.2/7.3 emit
  shape — while with it the product exits 70 (internal error) and modifies
  the workspace: exactly the diagnosed vets-only-own-components gap the arm
  discriminates. Typecheck clean; `npm run test:self` unchanged 4 planned
  mid-loop reds (certification-document ×3 → FP-091; S-1's 9 unmapped keys
  → stages E/G), S-5 and certification green. Traceability unchanged
  (["6.5","14"] — T14-7's refusal staging record already rides "14"; 7/
  7.3/13.1/13.2/13.4 are context with home coverage elsewhere); T6.5-4 is
  in no certification scope (Exclusions-shared machinery only).]

- [x] FP-019 — T6.5-5: add the missing usage-error arms. [R1 #22; TEST-SPEC
  §6.5]
  `test/suite/registry/section-6.5.ts` (~line 1580 area has only
  nonexistent origin file/ID, ordering, masking): add (a) wrong-kind
  (code-source) origin in each form; (b) the three mixed-synopsis
  invocations `a.mdx b.mdx#y`, `a.mdx#x b.mdx`, `a.mdx b#c.mdx` → exit 2;
  (c) parse-local ID existence arms mirroring T6.4-4 (FP-016). (The
  non-UTF-8 destination operand arm arrives via FP-005's restage.) Exit-2
  protocol per FP-002.
  [Done 2026-08-11: (a) base and ordering arms now run on a new
  SPEC_AND_CODE_CONFIG (6.4's mirror) with a discovered, reference-free
  `src/app.ts`; U5_WRONG_KIND_CASES adds `move src/app.ts specs/New.mdx`
  (file form) and `move src/app.ts#noop specs/B.mdx#z` (section form — the
  id part names the file's real exported unit, discriminating a product
  that resolves code units in move origins), each exit 2 via
  `expectMoveUsageError` (FP-002 protocol), riding both arms per
  TEST-SPEC's "checked before source validation", the base-arm pair inside
  whole-root `assertLeavesUnchanged` compares (an accepting product would
  relocate the file). (b) the two missing mixed-synopsis arms `move
  specs/A.mdx specs/B.mdx#y` and `move specs/A.mdx#a specs/B.mdx` landed
  beside the FP-005-restaged `specs/Ha#sh.mdx` arm (the trio's third, kept
  as the dead-letter staging), every operand naming staged content, each in
  a whole-root modifies-nothing compare — exit 2, matches-neither by
  spelling alone. (c) three parse-local arms mirror FP-016 with identical
  sources: dup (two bearers of `dup`) → `expectRefusalModifiesNothing`,
  exactly one 14.3 located in the file, target file not created; anc (sole
  bearer `kid` beneath an id-less ancestor) → same protocol, exactly one
  14.1; solo (`<S id="solo" id="solo">`) → build premise exactly one 14.17,
  then move exit 2 beside that file's findings. Title and module header
  extended; traceability unchanged (["6.5","12.0"], the T6.4-4/FP-016
  precedent — T6.5-5 in no TEST-SPEC 14 staging record and no certification
  scope). Soundness proven by direct probes against the built product
  (suite arms past the first are unreached — T6.5-5 stays red-as-diagnosed
  at the first arm's FP-002-class exit-2 error-document gap): base build
  exit 0 with the code file; both wrong-kind forms exit 2 ("unknown file")
  modifying nothing; mixed-2 exits 2 ("names no target section");
  mixed-1 exposes a real classification gap — the product treats
  `specs/B.mdx#y` as a `#`-containing file-form destination path and
  REFUSES exit 1 where the arm demands exit 2 (matches-neither), modifying
  nothing; dup/anc exit 1 with exactly the one old-shape 14.3/14.1 finding
  (the FP-001-class form gap), creating nothing (no New.mdx, no `.xspec/`);
  solo: build reports exactly one 14.17, move exits 2 "unknown ID 'solo'".
  Typecheck clean; section-6.5 unchanged 5 failed / 1 passed (T6.5-2
  green); `npm run test:self` unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1's 9 unmapped keys → stages
  E/G), S-5 and certification green.]

- [x] FP-020 — T7-2: add the string-literal group-name keys arm. [R1 #23;
  TEST-SPEC §7]
  Neither `test/suite/registry/section-7-basics.ts` nor
  `section-7.4-7.5.ts` stages quoted keys. Add: group names as string
  literals (`"my-group"`/`"test-code"`) load, discover, and resolve in a
  coverage profile and in a policy selector.
  [Done 2026-08-11: one arm appended to T7-2 (section-7-basics.ts) — a
  config declaring spec group `"my-group"` and code group `"test-code"`
  under string-literal keys (both names non-identifiers, so only that
  spelling declares them), referenced from the coverage profile
  (`target`/`boundary`, kinds inferred) and both selectors of a forbidden
  rule. Asserted: `build` exit 0 (loads; an identifier-keys-only product
  refuses 14.14/exit 2 here — TEST-SPEC's discriminator); discovery via
  the exact `ids` listing plus whole-graph edge-set equality (2 contains +
  `p`→`a` depends + the top-level marker's src/impl.ts→`a` references edge
  — the code-group observation, T7-3's contrapositive); resolution via
  profile "quoted" reporting covered `a` with path [src/impl.ts, a] and
  uncovered `p` (counts/ignored stay T8.2-1's subject, the section-8
  discipline), and via `check --json` exit 1 with exactly one 14.12
  finding, identities [rule, p, depends, a], locations [], path null
  (SPEC 14.12's contractual enumeration). Title extended; traceability
  unchanged (["7","14"] already covers the asserted conditions; 7.4/7.5/8
  are context with home coverage at T7.4-*/T7.5-*/T8-*); no certification
  scope. Verified: direct CLI probes against the built product returned
  byte-for-byte the expected ids/edges/coverage documents and exactly the
  one old-shape policy violation (the current product already accepts
  quoted keys — those observations are genuinely green), and a scratch
  execution of the arm body ran green through build/ids/edges/coverage/
  check-exit and red exactly at the form-exact findings decode ("expected
  no member \"condition\"" — the FP-001-class product gap), so the arm is
  red-as-diagnosed there; in the suite T7-2 still fails at its first
  FORM_VIOLATIONS arm (the FP-002-class exit-2 gap), the new arm
  unreached until that closes. Typecheck/format clean; `npm run
  test:self` unchanged 4 planned mid-loop reds (certification-document ×3
  → FP-091; S-1's 9 unmapped keys → stages E/G).]

- [x] FP-021 — T7.5-5: add the literal-`$` forms arm. [R1 #24; TEST-SPEC
  §7.5, SPEC 14.14]
  `test/suite/registry/section-7.4-7.5.ts`: stage `$0`, trailing `$`, and
  `$` before a non-digit, each in `from` and in `to`; assert they load
  without 14.14 and match only the literal bytes.
  [Done 2026-08-11: six arms (e)-(j) appended to T7.5-5 — the three forms
  staged once in `from` and once in `to` per TEST-SPEC's "one arm each".
  Load-without-14.14 is each arm's `build` exit 0 (14.14 is load-enforced by
  every command; a capture-reading product refuses the `to`-side `$0`/
  trailing-`$` arms as referencing an absent capture and dies there);
  matching-only-the-literal-bytes is the exact 14.12 finding set over bait:
  every fixture stages, beside the literal-byte path, the paths a capture
  reading (`src/ab.ts` for `src/a$0.ts` — the spec's own example),
  dropped-`$` reading (`a0.ts`/`ax.mdx`/`t0.mdx`/`tz.mdx`), one-byte-wildcard
  reading (`aQx.mdx`/`tQz.mdx`), or regex-anchor reading (`src/end` for
  `src/end$`) would match instead, each bearing a same-shaped edge. The
  trailing-`$`-in-`from` arm stages the `$`-suffixed name as a code source
  under the extension-free glob `src/*` (a spec source always ends `.mdx`,
  14.19; SPEC 7.2 restricts code groups by glob alone); the
  trailing-`$`-in-`to` arm (`tgt/T.mdx$`) can match no discovered target, so
  it pins the anchor-bait edge's presence via `query edges` (T7-3's
  premise precedent) then asserts plain `check` exit 0 — zero findings.
  Title and module header extended; traceability unchanged (["7.5"] —
  T7.5-5 is in no TEST-SPEC 14 staging record, the T7.5-3/-4 precedent); no
  certification scope. Verified: direct CLI probes of all six stagings
  against the built product returned exactly the expected sets in the old
  finding shape (the matcher is already literal on every form; all six
  builds exit 0), and guarded solo executions of each arm body ran (e),
  (f), (g), (i), (j) green through build/check-exit and red exactly at the
  form-exact 12.7 findings decode ("expected no member \"condition\"" — the
  FP-001-class product gap) while (h) passed in full, so each finding-
  bearing arm is red-as-diagnosed at the known product gap with its set
  assertion proven satisfiable. In the suite T7.5-5 still fails at its
  first arm (a)'s decode, the new arms unreached until that closes;
  section-7.4-7.5 unchanged 7 failed / 1 passed (T7.4-2 green). Typecheck/
  format clean; `npm run test:self` unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1 unmapped keys → stages E/G),
  S-5 and certification green (CONF-VALID 12/12, CONF-MD 8/8, CONF-CORE
  9/9, CONF-DISC 3/3, violators failing as certified).]

## Stage E — §§1–9 missing tests (new-test convention applies)

- [x] FP-022 — Implement T1.7-2: code-location ranges via occurrence
  records. [R1 #1; TEST-SPEC §1.7]
  First harness use of `xspec occurrences` (it is never invoked anywhere
  today). Assert ranges against precomputed byte offsets for: whole-file,
  function/class, multi-declaration variable, dotted namespace, default
  exports, and `@2` disambiguation. Registry module
  `section-1.6-1.7.ts`; map `"1.7"`.
  [Done 2026-08-11: T1.7-2 registered in section-1.6-1.7.ts — one valid
  workspace, eight code files each staging one sanctioned reference inside
  one SPEC 4.6 unit shape, every file opening with multi-byte UTF-8 before
  its constructs (byte offsets diverge from code-point/UTF-16 counts); one
  bare `occurrences` invocation (11.3 is JSON-only, no `--json`) asserting
  the complete nine-record document per-index against precomputed offsets:
  whole-file (top-level marker: identity the path alone, range 0..byteLen),
  `function fn`/`class Cls` construct ranges (the class attribution via a
  `text(SPEC.alt)` property initializer — a call expression is no named
  unit, so the embed attributes to the class; also the one `embeds` arm),
  `handler` name-through-initializer inside `const one = 1, handler = …`
  (statement excluded), dotted `namespace Outer.Inner` whole-declaration
  range (the shared range pinned through the reachable unit — every body
  position lies within `Inner`, and a unit's range is reachable exactly
  through occurrences it sources, so bare `Outer` sources none; comment
  documents the reading), `export default function named` = construct's own
  range (prefix excluded) vs anonymous default = whole declaration under
  unit `default` (two files — one default export per module), getter
  `Pair.value` vs setter `Pair.value@2` each carrying its own construct.
  The document decodes through a NEW form-exact 12.7 layer
  (`decodeOccurrencesReport`/`decodeOccurrenceRecordForm` in
  adapters/forms.ts, model types in model.ts): exactly
  {"findings","occurrences"}, records exactly
  {"file","range","kind","source","target"}, kind from the dependency-kind
  vocabulary (never `contains`), `source` decoded through the S-5-guarded
  three-state datum decode with `null` rejected (defined or the
  unavailability marker, never null), the 5.7 total order enforced (file
  path bytes, start, end; identical spans reject). S-5 gains the document's
  DECODERS entry (positive controls incl. unavailable source, byte-form
  referencing file, accompanying findings, same-start tie by end; 24
  targeted rejections). A pre-product fixture self-check slices every
  claimed range back out of the staged bytes, so staging-arithmetic errors
  fail harness-side, never as wrong-but-satisfiable expectations.
  Traceability: "T1.7-2": ["1.7"] (no numbered condition asserted; 4.6/5.7/
  11.3/12.7 context with home coverage elsewhere); in no certification
  scope (CERTIFICATIONS.md Exclusions names T1.7-2 explicitly). Verified:
  red-as-diagnosed exactly at the `occurrences` invocation (exit 2 "unknown
  command 'occurrences'" — the whole 11.3 surface is patch-new) with the
  build premise green, and a scratchpad probe of the identical staging via
  `query edges --kinds references,embeds` returned byte-for-byte all nine
  expected (source identity, kind, target) triples — `#default`, `#named`,
  `#Outer.Inner`, `#Pair.value`, `#Pair.value@2`, `#Cls`, `#fn`,
  `#handler`, whole-file `src/top.ts` — against the product's pre-existing
  4.6 attribution, so only the ranges (the arm's patch-new subject) await
  the product. Section file 2 failed / 5 passed (T1.6-5 keeps its
  pre-existing FP-001-class red); typecheck/format clean; `npm run
  test:self` unchanged 4 planned mid-loop reds (certification-document ×3
  → FP-091; S-1's 9 unmapped keys → stages E/G), S-5 (243 tests now) and
  certification green.]

- [x] FP-023 — Implement T5.7-1: occurrence units and duplicates. [R1 #2;
  TEST-SPEC §5.7]
  One record per `d` array entry / embedding / call / marker; collapsed
  edges vs distinct occurrence records. New registry module for §5.7 (e.g.
  `test/suite/registry/section-5.7.ts` + suite wrapper); map `"5.7"`.
  [Done 2026-08-11: new registry module section-5.7.ts (wrapper
  section-5.7.test.ts, spread into index.ts) registering T5.7-1 — one
  workspace staging all five occurrence kinds: `tri`'s three-entry mixed
  `d` array (external chain, local string, external chain), `solo`'s
  single-reference `d={"peer"}`, `emb`'s MDX `{text(BASE.a.b)}`, and in
  src/app.ts a `text(SPEC.emb)` call, a once-spelled marker, and the
  twice-spelled marker, plus TEST-SPEC's literal duplicate pair
  `d={[BASE.a.b, BASE.a.b]}`. Premise `build` exit 0; bare `occurrences`
  (JSON-only, no `--json`) decoded through FP-022's form-exact 12.7
  layer; findings []; the complete 11-record (file, [kind], source ->
  target) multiset asserted order-free — one record per `d` array entry,
  never one for the array or the prop; one per embedding/call/marker,
  each carrying its edge kind; two per duplicate pair (byte-precise
  spans are T5.7-2's subject, the total order T5.7-3's, decode-enforced
  as 12.7 form meanwhile) — each duplicate pair additionally pinned to
  exactly two records at distinct ranges, and the collapse side pinned
  via unfiltered `query edges` against the complete 17-edge set (8
  contains + 5 depends + 2 embeds + 2 references — the dup pair and the
  twice-spelled marker one edge each). Traceability "T5.7-1": ["5.7"]
  (no numbered condition asserted; 2.2/5.2/11.3 context with home
  coverage elsewhere); in no certification scope (CERTIFICATIONS.md
  Exclusions: the TS-side occurrence enumerations sit behind the
  tooling wall). Verified: red-as-diagnosed exactly at the `occurrences`
  invocation (exit 2 "unknown command 'occurrences'" — the whole 11.3
  surface is patch-new) with the build premise green; a direct probe of
  the staging against the built product returned byte-for-byte the
  expected 17-edge set (both duplicate groups already collapse, per-unit
  4.6 attribution confirmed); satisfiability proven by running the
  registered body via a scratch binding against a shim product (real
  product + conforming occurrences answer computed from the staged
  bytes) — green through every assertion — and against a
  one-record-per-array/per-group deviation shim — red exactly at the
  multiset assertion (teeth). Typecheck/format clean; `npm run
  test:self` 4 planned mid-loop reds (certification-document ×3 →
  FP-091; S-1 unmapped keys now the 8-key set {6.6, 11.2, 11.3, 11.4,
  11.5, 11.6, 12.6, 12.7} — "5.7" mapped by this task), S-5 and
  certification green.]

- [x] FP-024 — Implement T5.7-2: byte-precise occurrence spans per kind.
  [R1 #3; TEST-SPEC §5.7]
  Array-entry expression only; the whole braced `{text(...)}` container;
  callee-through-paren; bare marker chain without `;`.
  [Done 2026-08-11: T5.7-2 registered in section-5.7.ts — one workspace,
  six occurrences, every span byte-asserted against precomputed offsets
  composed from the same string parts the files are (the T1.7-2 discipline:
  multi-byte UTF-8 before every asserted construct so byte offsets diverge
  from code-point/UTF-16 counts; a pre-product fixture self-check slices
  each claimed range back out of the staged bytes). Arms: the three-entry
  `d` array `[BASE.x , BASE.mid , "pre"]` with whitespace on BOTH sides of
  each comma — all three entry spans asserted, the middle entry the featured
  no-brackets/commas/whitespace subject, the string entry spanning its
  quotes; the MDX `{text(BASE.y)}` container brace-through-brace; the
  import-ALIASED TS callee `t(SPEC.x)` from its `t` through `)` (SPEC 4.4's
  sanctioned aliasing), `;` excluded; the marker chain `SPEC.y.leaf` alone,
  indentation, `;`, and trailing comment excluded. Records identified by
  their unique (file, kind, source, target) tuples — report order stays
  T5.7-3's subject (decode-enforced as 12.7 form meanwhile), source-node
  range data likewise; findings [] and exact count 6 pinned. Decode through
  FP-022's form-exact layer (no new adapter; S-5's existing guards cover
  it). Traceability "T5.7-2": ["5.7"] (no numbered condition; 1.7/3/4.4/
  11.3 context with home coverage elsewhere); in no certification scope
  (CERTIFICATIONS.md Exclusions: T5.7-1 through T5.7-4 behind the tooling
  wall). Verified: red-as-diagnosed exactly at the `occurrences` invocation
  (exit 2 "unknown command" — the whole 11.3 surface is patch-new) with the
  fixture self-check and build premise green; staging externally validated
  by direct probe of the built product — `build` exit 0 and `query edges`
  byte-for-byte the six expected dependency tuples (aliased callee
  attributed to src/app.ts#call included); satisfiability and teeth proven
  by running the registered body against a shim product (real product +
  conforming occurrences answer recomputed from staged bytes by anchored
  search, independent of the module's prefix arithmetic) — green through
  every assertion — and against a marker-span-includes-`;` deviation — red
  exactly at the marker span assertion. Typecheck/format clean; `npm run
  test:self` unchanged 4 planned mid-loop reds (certification-document ×3
  → FP-091; S-1's 8 unmapped keys → stages E/G), S-5 and certification
  green.]

- [x] FP-025 — Implement T5.7-3: occurrence record data and total
  deterministic order. [R1 #4; TEST-SPEC §5.7, H-6]
  Record members: file, range, edge kind, source node as
  identity-plus-range, target identity. Total order: path bytes, range
  start, range end.
  [Done 2026-08-11: T5.7-3 registered in section-5.7.ts — three referencing
  files whose paths give the byte-order clause teeth (`specs/Zed.mdx`, 0x5A,
  sorts before `specs/alpha.mdx`, 0x61, while any case-folding collation
  reverses the pair; `specs/` before `src/`), six occurrences asserted
  per-index as the complete document — every member: file, own range, kind,
  source as ONE identity-plus-range datum, target identity — against
  offsets composed from the staged files' own string parts (the
  T1.7-2/T5.7-2 discipline: multi-byte UTF-8 before every asserted
  construct; fixture self-checks slice each claimed range back out of the
  staged bytes AND re-derive the claimed sequence under the pinned
  comparator). Source-datum arms: MDX nested section `zout.zin` sourcing
  both a `d` and an embedding (identical datum, construct range strictly
  inside the parent's), the ROOT sourcing a top-level embedding (identity
  the path alone, range 0..byteLen — the T8-5 shape), TS whole-file
  (top-level marker) and innermost nested named unit `wrap.deep` (the inner
  declaration's own construct, never the enclosing `wrap`). H-6: the
  identical `occurrences` invocation twice, stdout byte-identical
  (stdoutBytes compare); no two records share a range (pairwise-distinct
  expected ranges; same-start pairs are unstageable — distinct spellings
  occupy distinct spans — so the comparator's range-end leg decides no
  staged pair, and the decode enforces it as 12.7 form over whatever a
  product emits, the T6.6-4 latitude treatment). Traceability "T5.7-3":
  ["5.7"] (no numbered condition; 1.7/4.6/11.3 context with home coverage
  elsewhere); in no certification scope (CERTIFICATIONS.md Exclusions:
  T5.7-1 through T5.7-4 behind the tooling wall). Verified:
  red-as-diagnosed exactly at the `occurrences` invocation (exit 2 "unknown
  command" — the whole 11.3 surface is patch-new) with self-checks and
  build premise green; staging externally validated by direct probe of the
  built product (`build` exit 0; `query edges` byte-for-byte the six
  dependency edges with exactly the claimed source attributions —
  root-sourced embeds, innermost nested section, whole-file and `wrap.deep`
  code sources); satisfiability and teeth proven by running the registered
  body against a shim product (real product + conforming occurrences answer
  recomputed from staged bytes by anchored search, independent of the
  module's prefix arithmetic) — green through every assertion — and against
  three deviations: case-insensitive file order, outer-section source
  attribution, run-to-run member-order jitter — each red at its diagnosed
  assertion (order decode, record[0]'s source datum, the H-6 byte compare).
  Typecheck/format clean; `npm run test:self` unchanged 4 planned mid-loop
  reds (certification-document ×3 → FP-091; S-1's 8 unmapped keys → stages
  E/G), S-5 and certification green.]

- [x] FP-026 — Implement T5.7-4: no-occurrence constructs and the exit-1
  answer carrying the domain's findings. [R1 #5; TEST-SPEC §5.7]
  Imports, type-only uses, shadowed chains, dynamic/unresolving spellings
  produce no records; the exit-1 answer still carries the domain's
  findings.
  [Done 2026-08-11: T5.7-4 registered in section-5.7.ts — one workspace
  staging every no-occurrence class beside three resolving spellings (one
  per dependency-kind surface): MDX used + never-used imports (2.1's pair),
  both T4-4 type-only forms with marker-shaped/call-shaped uses, the T4.5-4
  shadowing function re-spelling the IDENTICAL statement texts `SPEC.ok;`/
  `SPEC.absent;` rooted at the local, a dynamic `` d={`ok`} `` (template
  literal spelling an EXISTING id, so an evaluating product both drops the
  14.8 and emits a phantom resolved record — failing twice), an unresolving
  local `d={"nope"}` (14.5), an unresolving embedding `{text(BASE.gone)}`
  (14.6), an unresolving marker `SPEC.absent` (14.7). Premise pinned first:
  `build --json` reports EXACTLY {14.5, 14.6, 14.7, 14.8} ×1 — so imports/
  type-only/shadowed provably trigger nothing and the resolving spellings
  resolve — each finding located in its construct's byte window, the 14.6
  finding's range asserted EXACTLY the full braced container (SPEC 14's
  amended pinning, the span its occurrence would occupy; one spelling → one
  location). Then bare `occurrences`: exit 1 with the full answer still
  emitted (11.2), the same finding assertions on the answer's findings, and
  the complete record multiset exactly the three resolving tuples —
  phantom records fail by count/tuple, an unavailable TARGET is rejected by
  the form-exact decode itself (12.7: target is an identity string). No new
  adapter (FP-022's layer; S-5 unchanged). Traceability "T5.7-4": ["5.7",
  "14"] (numbered conditions asserted; 2.1/2.4/4.5/11.2/11.3 context with
  home coverage elsewhere); in no certification scope (Exclusions name
  T5.7-1..-4). Verified: red-as-diagnosed — in the suite T5.7-4 fails at
  the premise `build --json` form-exact findings decode (the FP-001-class
  product gap: old-shape `condition`-member findings), downstream arms
  unreached until that closes, then red at the `occurrences` invocation
  (probe: exit 2 "unknown command") and at the 14.6 container range (probe:
  the current product locates the chain `BASE.gone` [248,257) where the
  container is [242,259)); staging premise externally validated by direct
  probe of the built product — exit 1 with EXACTLY the four old-shape
  findings, correctly classified and located, nothing for imports/
  type-only/shadowed; satisfiability and teeth proven by running the
  registered body via a scratch binding against a pure-synthetic conforming
  shim (12.7-form documents recomputed from the staged bytes by anchored
  search, independent of the module's prefix arithmetic) — green through
  every assertion — and against four deviations: unavailable-target (red at
  the decode's target form), phantom-dynamic resolved record (red at the
  multiset), chain-only 14.6 range = the current product's precision (red
  at the exact container range), exit-0-with-findings (red at the exit
  assertion). Typecheck/format clean; section-5.7 now 4 registered tests,
  4 failed as diagnosed; `npm run test:self` unchanged 4 planned mid-loop
  reds (certification-document ×3 → FP-091; S-1's 8 unmapped keys → stages
  E/G), S-5 and certification green.]

- [x] FP-027 — Implement T6.5-7: operation-side rewrite bytes for the real
  move. [R1 #6; TEST-SPEC §6.5]
  Import-removal extents (own-line import dropped with terminator;
  shared-line declaration's own characters only), double-quoted conversion
  spellings, preserved single-quote local reference — whole files
  byte-asserted against composed expected bytes. Registry
  `section-6.5.ts`; map `"6.5"`.
  [Done 2026-08-11: T6.5-7 registered in section-6.5.ts — one workspace,
  TEST-SPEC's exact staging: Origin.mdx imports Target.xspec under two
  bindings (own-line `TWO`; `TB` following the retained, still-referenced
  `Keep` import on a shared line, `"; "`-separated with the removed
  declaration last and semicolonless so its own-characters span is
  rule-unique), the moved subtree `org.mv` holding every reference through
  both bindings (`d={TWO.hub}`, `{text(TB.aux)}`) plus the single-quoted
  local `d={'org.mv.leaf'}`, `Keep.keep` referenced only outside the
  subtree, no reference to a moved node outside it — so the section move
  into Target.mdx (top-level `mv`, end-of-file insertion) adds no import
  anywhere. Body: premise `build` exit 0 (pins the two-declaration
  shared-line staging parses, 2.1), plain `move` exit 0, then whole-file
  byte compares of Origin (own-line declaration's line dropped with its
  terminator; shared line kept as `import Keep from "./Keep.xspec"; ` — the
  `;` AND the separating space survive, spelled as an explicit `+ " "`
  concatenation; both pre-existing blanks around the dropped construct
  kept), Target (before-bytes + rewritten moved text + U+000A: `d={"hub"}`
  / `{text("aux")}` double-quoted conversions, `d={'mv.leaf'}` single-quote
  preserved, ids prefix-replaced), and Keep.mdx as bystander — expected
  constants independently composed from the rules of 6.5/6.4/3 with each
  delta's rule cited — plus post-move `check` exit 0 as the composition's
  soundness guard. Traceability "T6.5-7": ["6.5"] (no numbered condition;
  6.4/3/2.1 carriage context per precedent); CERTIFICATIONS.md names
  T6.5-7 in the Exclusions (no fixture scope). NOT red against this repo's
  product: the section-move rewrite machinery predates the patch — the
  probe returned byte-for-byte the composed expectation (trailing space
  included) with `check` clean, so the pass is genuine; teeth proven by a
  scratch shim-binding probe running the registered body against two
  deviations, whitespace-normalized shared line and double-quoted local
  reference — each failed as HarnessAssertionError at exactly its
  diagnosed compare (origin / target). Section-6.5 suite now 5 failed /
  2 passed (T6.5-2 and T6.5-7 green; the five reds are the pre-existing
  FP-001/FP-002-class product gaps). Typecheck/format clean; `npm run
  test:self` unchanged 4 planned mid-loop reds (certification-document ×3
  → FP-091; S-1's 8 unmapped keys → stages E/G), S-5 green, certification
  17/17.]

- [x] FP-028 — Implement T6.6-2: preview is inert and predictive. [R1 #7;
  TEST-SPEC §6.6 (new preview section)]
  Preview modifies nothing; a subsequent real run's applied mapping equals
  the preview's `mapping`; byte-determinism; form-exact 12.7 preview
  document under `--json`. New-§6.6 tests live beside the renamed T6.7-1
  (FP-003) — keep registry module naming coherent with
  `test/suite/registry/index.ts` imports; map `"6.6"`.
  [Done 2026-08-11: new registry module section-6.6.ts (wrapper
  section-6.6.test.ts, spread into index.ts) registering T6.6-2 — two arms,
  each its own workspace under a specs+markdown-emit config so the premise
  `build` materializes every derived-file kind under the compare: rename
  (`core.mid` → `core.hub`, mid-tree with a descendant and sibling local
  references) and section-form move (`org.mv` → existing-target `tm` with an
  internal DOWNWARD local reference — the shim probe caught the first
  draft's child-to-ancestor `d` as a 14.9 cycle in the combined
  contains/depends graph, SPEC 5.3 — plus a staying reference the real move
  converts to imported form). Each arm: journal-absent premise (6.1), then
  inside ONE whole-root assertLeavesUnchanged all four preview invocations —
  `--preview --json` twice and bare `--preview` twice, each pair through
  assertRunTwiceDeterministic (H-6: byte-identical stdout/stderr/exit and
  workspace state) — exit 0, stdout decoded through the NEW form-exact 12.7
  preview-document layer (forms.ts `decodePreviewReport` + model.ts types:
  exactly {"findings","mapping","files","delta"}; mapping
  `from`-byte-ordered one-per-identity; files path-byte-ordered
  one-per-file, edits {"class","range"} drawn from the ten 12.7 class names
  ordered by start/end/class-name-bytes — the
  import-addition-before-target-insertion coincidence decode-admitted;
  delta {"generated","removed"} with byte-ordered distinct paths per
  direction, or the unavailability marker via the three-state datum decode;
  mapping/files/delta null all-together-or-none — the refusal encoding,
  mixed nullity rejects), findings asserted exactly [] and the plan members
  non-null; then the subsequent real run with `--json` (exit 0, T6.4-1's
  H-3 applied-mapping adapter) asserting applied mapping == preview mapping
  as complete sets (assertAppliedMapping — the equality IS the TEST-SPEC
  operationalization; mapping/files/delta CONTENT stays T6.6-4's/T6.6-5's).
  S-5 gains the preview decoder's DECODERS entry (positive controls: full
  plan incl. nested deletion geometry and the zero-length tie-break pair,
  refused all-null, delta-unavailable-beside-full-plan, empty lists; 30
  targeted rejections incl. mixed nullity both ways, a replacement-text
  edit member, tie-break order violation, duplicate mapped
  identity/file/delta path). Traceability "T6.6-2": ["6.6"] (no numbered
  condition asserted; 6.4/6.5/6.1/12.0 carriage context per precedent);
  CERTIFICATIONS.md names T6.6-2 in the Exclusions — no fixture scope (its
  compare-around machinery is certified via VIOL-CORE-CHATTYREADS).
  Verified: red-as-diagnosed exactly at the first preview invocation (exit
  2 "unknown flag '--preview'" — the whole 6.6 surface is patch-new) with
  premises green; satisfiability and teeth proven by running the registered
  body via a scratch binding against a shim product (real product +
  conforming preview/applied-mapping answers computed from the staged
  bytes) — green through BOTH arms end-to-end, the real product performing
  the actual rename and move (both stagings proceed, exit 0, validating
  "the real operation would proceed" against the real product) — and
  against three deviations: preview-writes-a-file (red at the
  modifies-nothing compare), preview-mapping-missing-descendants (red at
  the applied-mapping equality), nondeterministic bare-form output (red at
  the H-6 byte compare). Typecheck/format clean; `npm run test:self` 4
  planned mid-loop reds (certification-document ×3 → FP-091; S-1 unmapped
  keys now the 7-key set {11.2, 11.3, 11.4, 11.5, 11.6, 12.6, 12.7} —
  "6.6" mapped by this task), S-5 (70 tests) and certification green.]

- [x] FP-029 — Implement T6.6-3: refusal/usage-error equivalence under
  `--preview`. [R1 #8; TEST-SPEC §6.6]
  Same stable codes as the real operation; exit 1 with `mapping`/`files`/
  `delta` null; exit 2 identically; preview runs to completion under
  `--test-hold` held by another command; `--test-hold` + `--preview` is a
  usage error.
  [Done 2026-08-11: T6.6-3 registered in section-6.6.ts. Refusal
  equivalence runs over T6.4-3's and T6.5-4's COMPLETE case tables staged
  identically — the stagings and expectation tables are now module-scope
  exports of section-6.4.ts (RENAME_REFUSAL_*) and section-6.5.ts
  (MOVE_REFUSAL_* + stageMoveRefusalOccupants, MOVE_DERIVED_PATH_*,
  MOVE_PRECONDITION_* — the derived-path and invalid-workspace-precondition
  arms included), consumed by the source tests and T6.6-3 alike so "staged
  identically" holds by construction (behavior-preserving refactor:
  section-6.4 unchanged 4 failed/3 passed, section-6.5 unchanged
  5 failed/2 passed, section-13.5 7/7 green). Each of the 24 refusal arms,
  inside one whole-root modifies-nothing compare: real invocation `--json`
  exit 1, form-exact 12.7 findings decode, per-arm code counts re-pinned
  (the arm still isolates its staged cause; concerned-data assertions stay
  in T6.4-3/T6.5-4), then `--preview --json` exit 1 decoded as the preview
  document (refused encoding: mapping/files/delta all null; mixed nullity
  already decode-rejected) with findings compared element-wise to the real
  report over every member except message — code, locations, path,
  identities, the contractual members (message composition unpinned, H-4;
  both sides decode-validated in 12.7's total order whose keys precede the
  message tie-break on exactly those members). Usage equivalence: every
  T6.4-4/T6.5-5 usage-error invocation (exported tables RENAME_USAGE_CASES,
  MOVE_USAGE_CASES, MOVE_WRONG_KIND_CASES, MOVE_MIXED_SYNOPSIS_CASES,
  MOVE_NON_UTF8_ARGV Linux-gated, both solo argvs) runs real-then-preview
  on the ordering-shaped staging (failing-build premise pinned, realizing
  "argument checks precede either way"), each side exit 2 with the single
  12.7 error document and stderr presence, each sweep inside a
  modifies-nothing compare; the spells-no-identity arms re-pin their
  exactly-one-14.17 premise first. Scheduling: the runs-while-held arm
  reuses T13.5-2's staging and choreography (section-13.5.ts now exports
  CORE_DECL/holdPathFor/awaitHoldFile/runBounded/describeExit — the
  CERTIFICATIONS.md Exclusions note binds exactly this sharing): while the
  real `rename a a2 --test-hold` is held, `rename g g2 --preview --json` —
  T13.5-2's refused second command, previewed — runs to completion exit 0
  (bounded run: a blocking product fails diagnosed) with findings [] and a
  non-null plan, command 1 still running, held-baseline snapshot unchanged;
  release → command 1 exits 0. `--test-hold`+`--preview` asserted for both
  operations and both flag orders: exit 2, error document, stderr, no hold
  file created, nothing modified. Traceability "T6.6-3": ["6.6", "14"]
  (TEST-SPEC 14's refusal-reason staging record names T6.6-3; map comment
  updated); CERTIFICATIONS.md keeps T6.6-3 in the Exclusions — no fixture
  scope. No new adapter (decodePreviewReport/decodeFindingsReport/
  decodeErrorDocument are S-5-guarded already; the projection is a local
  assertion). Verified: T6.6-3 red-as-diagnosed at the FIRST refusal arm's
  real-side form-exact findings decode (the stub emits `{"refused":…}` —
  the pre-existing FP-001/FP-007-class product gap), the preview-side gap
  behind it (direct probe: `--preview` is exit 2 "unknown flag '--preview'",
  the whole 6.6 surface patch-new); satisfiability and teeth proven by
  running the registered body via a scratch binding against a conforming
  shim (real-product delegation for build/held commands, synthetic 12.7
  refusal/usage/preview answers generated FROM the exported expectation
  tables, old→12.7 build-findings translation for the premises, non-UTF-8
  detected from raw /proc/self/cmdline) — green end-to-end through all
  arms, the held choreography running against the real product's lock —
  and against four deviations: preview-drops-a-finding (red at the
  same-findings compare), refused-preview-reports-a-plan (red at the
  null-plan assertion), preview-writes-a-file (red at the modifies-nothing
  compare), preview-refuses-while-held (red at the runs-while-held exit-0
  assertion). Typecheck/format clean; `npm run test:self` unchanged 4
  planned mid-loop reds (certification-document ×3 → FP-091; S-1's 7
  unmapped keys → stages E/G), S-5 and certification green.]

- [x] FP-030 — Implement T6.6-4: preview report content — the ten 12.7 edit
  classes. [R1 #9; TEST-SPEC §6.6, SPEC 12.7]
  All ten edit classes with byte-precise pre-operation ranges,
  class-plus-range only, tie-break comparator.
  [Done 2026-08-11: T6.6-4 registered in section-6.6.ts, five arms. Expected
  `mapping` and `files` are complete exact lists composed from the staged
  fixture bytes by locator helpers (unique fragments, container-scoped for
  recurring spellings; multi-byte text before every located construct), the
  edit lists in 12.7's pinned order — the order itself enforced by the
  already-S-5-guarded decodePreviewReport on every document, including the
  full comparator's class-bytes tie-break. (a) rename across MDX and TS:
  two id-rewrites (attribute's own characters — the construct-spelling
  reading, H-4-noted in the module header) plus all four 5.7 occurrence
  kinds as reference-rewrites (d entries, MDX embedding braces-included,
  TS call callee-through-paren, TS marker sans terminator), with
  unaffected-reference/id/specifier controls; (b) section move into an
  existing target: origin-deletion one contiguous range over the indented
  construct plus leftover indentation and merged-line terminator,
  id-rewrites and the moved text's reference rewrites nested inside it
  (compose-time containment self-checks), import-removal spanning the
  declaration plus its dropped terminator, target-parent-rewrite spanning
  the self-closing tag with target-insertion zero-length at the tag's end
  (the one stable pre-operation anchor, H-4), and Third.mdx's
  import-addition via a latitude slot (exactly one, zero-length, in-file;
  offset captured) pinned by the real run on the preview-pinned state
  (assertLeavesUnchanged realizes "on a copy"): the rewritten file must
  equal pre-op bytes + known reference rewrite + one added-import line
  spliced at exactly the previewed offset, fresh binding read from the one
  added declaration, then `check` exit 0 (T6.5-7's soundness-guard
  precedent); (c) file move: file-relocation spanning the whole file under
  its pre-op path beside its own specifier rewrite, importer's specifier
  rewrite, chains as controls, root pair in the mapping (T6.5-1
  precedent); (d) created target: exactly one file-creation edit at
  {0,0} under the creation path — the staged rewrite NEEDS an import
  addition there, so subsumption has teeth — moved text's rewrites in the
  origin deletion; (e) the tie-break geometry: top-level `<new-id>` into an
  existing file whose rewrite needs an import addition in that same file
  (target-insertion at EOF, addition free to coincide). Traceability
  "T6.6-4": ["6.6"] (12.7/5.7 carriage context, home coverage at
  T12.7-*/T5.7-*); CERTIFICATIONS.md keeps T6.6-4 in the Exclusions.
  Verified: red-as-diagnosed at arm (a)'s first preview invocation (exit 2
  "unknown flag '--preview'", the whole 6.6 surface patch-new; section-6.6
  suite 3 failed — T6.6-2/T6.6-3 keep their pre-existing FP-001/FP-028-class
  reds); staging probes against the built product show all five premise
  builds exit 0 and all five real operations proceeding with clean `check`
  (the preview-succeeds premise is sound; the real move's Third.mdx
  insertion observed at offset 33, binding `Target`, matching the
  reconstruction). Satisfiability and teeth proven by running the
  registered body via a scratch suite binding against a conforming shim
  (real-product delegation for build/real-move/check, canned 12.7 preview
  documents computed from the same fixture strings, arm-b addition offset
  33) — green end-to-end through all five arms — and against five
  deviations: span-off (red at (a)'s byte-precise edit equality),
  not-subsumed (red at (d)'s exactly-one-edit equality), tie-misorder on
  the coinciding zero-length pair (red at the decode's comparator),
  preview-writes-a-file (red at (b)'s modifies-nothing compare),
  offset-lie (red at (b)'s real-run reconstruction). Typecheck/format
  clean; `npm run test:self` unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1's 7 unmapped keys → stages
  E/G), S-5 and certification green.]

- [x] FP-031 — Implement T6.6-5: derived-file delta both directions,
  record-based. [R1 #10; TEST-SPEC §6.6]
  Not presence-based: with graph data deleted, `generated` approaches the
  full set and the preview still writes nothing.
  [Done 2026-08-11: T6.6-5 registered in section-6.6.ts, four arms on two
  workspaces. Expected delta sets are composed from the premise build's own
  observed writes (H-4, module header): per source the added plain files
  under the 13.1 name shape `DIR/NAME.xspec.<suffix>` (module asserted
  present; suffix set observed — implementation latitude) plus the 13.2/7.3
  Markdown destination (`NAME.md` beside the source, outDir unset), a
  partition self-check failing diagnosed on any unattributable write; a
  not-yet-existing file's paths are the origin's suffix set transposed under
  the destination name (13.1: per-source derived paths are defined by the
  name shape alone). Workspace 1 (arm (c)'s Mv/Pal/User sources under the
  Markdown-emitting config): (1) file-form move preview — `generated`
  exactly the destination's module+companions+Markdown, `removed` exactly
  the moved file's recorded set; (2) rename preview (`pal`→`pal2`,
  cross-file content rewrites) — [] both directions; (3) record-deleted
  (T13.3-2's operational definition shared from section-13.3.ts —
  isGraphDataKey/assertGraphDataPresent/deleteGraphData now exported): the
  same move preview's `generated` equals the FULL post-move regeneration
  set (staying sources' on-disk paths included) and `removed` exactly []
  (origin's on-disk paths in neither direction), findings [] (a missing
  record is nothing-recorded — never 14.23; the guard rejects the
  unavailable encoding), inside a whole-root modifies-nothing compare plus
  an explicit graph-data-still-absent sweep. Workspace 2: T6.6-4(d)'s
  staging reused verbatim — the created target's transposed
  module+companions under `generated` (no Markdown, emission disabled),
  `removed` []. Delta decode/order enforcement rides the existing
  S-5-guarded decodePreviewReport; no new adapter. Traceability "T6.6-5":
  ["6.6"] (13.1–13.3/7.3/12.7 carriage context, home coverage at
  T13.1-*/T13.3-*/T7-*/T12.7-*); CERTIFICATIONS.md keeps T6.6-5 in the
  Exclusions. Verified: red-as-diagnosed at the first preview invocation
  (exit 2 "unknown flag '--preview'"; premise build and staging observation
  pass against the current product — probes show its writes match the
  partition model exactly: module + impl.d.ts/impl.d.ts.map/impl.js
  companions, .md beside source, .xspec/graph.json). Satisfiability and
  teeth proven by running the registered body via a scratch suite binding
  against a conforming shim (real-product build delegation + sidecar
  record, canned 12.7 preview documents; green end-to-end through all four
  arms) and five deviations: presence-based generated (red at the
  record-deleted full-set equality), presence-based removed (red at removed
  []), preview-refreshes-record (red at the modifies-nothing compare),
  unavailable-on-missing (red at the unavailable guard),
  misplaced-markdown (red at the record-present set equality).
  Typecheck/format clean; `npm run test:self` unchanged 4 planned mid-loop
  reds (certification-document ×3 → FP-091; S-1's 7 unmapped keys → stages
  E/G), S-5 and certification green.]

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
