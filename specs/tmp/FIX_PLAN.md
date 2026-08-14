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

- [x] FP-032 — Implement T6.6-6: preview under a corrupt graph record.
  [R1 #11; TEST-SPEC §6.6, SPEC 14.23]
  Full preview with `delta` explicitly unavailable, a condition-23 finding
  (`unreadable-record`, concerned path the graph-data area), exit 1; the
  real operation proceeds; a refused preview reports refusal findings
  alone. Share the corrupt-record staging with FP-041 (T12.2-2's
  unreadable-record arm reuses it).
  [Done 2026-08-11: T6.6-6 registered in section-6.6.ts. The corrupt-record
  staging lives in the H-3 adapter layer per amended H-3's naming of
  T6.6-6 — NEW test/helpers/adapters/record-staging.ts:
  `corruptGraphDataShapeBlind` overwrites every product-written plain file
  of T13.3-2's operational path set with fixed garbage (files stay present
  but readable as no record — not even valid UTF-8), never creates a path,
  and fails loudly with nothing modified on a missing area, an empty set,
  or a non-plain-file occupant (SPEC 13.4); the operational predicate
  isGraphDataKey moved there (one home), section-13.3.ts re-exporting it
  for its existing importers (behavior-preserving: section-13.3 unchanged
  2 failed / 2 passed). FP-041/FP-044/FP-072 ("T6.6-6's staging") import
  `corruptGraphDataShapeBlind` from the adapters index. One workspace
  under the Markdown-emitting config, latitude-free section move
  (self-contained subtree, no outside reference to a moved node → no
  import edits, SPEC 6.5's one preview latitude): after the premise build
  (record presence asserted), the intact-record reference preview runs in
  its own modifies-nothing compare — exit 0, findings [], delta a plain
  value, mapping pinned to the exact two-pair full-1.5-identity
  expectation, files paths pinned to [Origin, Target] — then the record is
  garbled and BOTH corrupt-state previews run inside ONE whole-root
  compare (the corrupt state persists byte for byte): the move preview
  exits 1 with exactly one 14.23 finding (stable code unreadable-record;
  concerned path ".xspec" per 11.6; locations exactly [] — a
  path-concerned condition is unlocated, T12.7-1's reading, module header)
  and the full plan — mapping the exact expectation, files deep-equal to
  the intact run (the "emitted in full" operationalization, sound because
  the plan is latitude-free), delta the unavailability marker, never an
  empty-record read; the refused preview (identity-unchanged rename)
  reports exactly one refused-identity-unchanged finding — never a 14.23
  beside — with mapping/files/delta all null. Then the real move on the
  same state: exit 0, applied mapping (T6.4-1's adapter) == the previewed
  mapping, `check` exit 0 (the finishing regeneration replaced the corrupt
  record, T12.2-2's protocol). S-5 gains three record-staging guards
  (garbles-every-file positive control with durables/structure untouched
  and the not-UTF-8 premise; nothing-to-corrupt rejections; non-plain-file
  rejections, files untouched). Traceability "T6.6-6": ["6.6", "14"]
  (TEST-SPEC 14 names T6.6-6 in 14.23's primary record); CERTIFICATIONS.md
  keeps T6.6-6 in the Exclusions (shape-blind 14.23 stagings are
  self-controlled — the condition-23 finding is the in-test reachability
  control), no fixture change. Verified: red-as-diagnosed at the
  intact-record reference preview (exit 2 "unknown flag '--preview'", the
  whole 6.6 surface patch-new) with build and record-presence premises
  green; staging soundness probed against the built product — build exit 0
  (record: .xspec/graph.json), check clean, and on the garbled record the
  REAL move exits 0 with `check` clean afterward (the pre-patch machinery
  already replaces the record) while the identity-unchanged rename refuses
  exit 1 (old-shape document) leaving the garbage untouched;
  satisfiability and teeth proven by running the registered body via a
  scratch binding against a conforming shim (real-product delegation for
  build/check/real move + synthetic 12.7 preview/applied-mapping answers
  computed from the staged bytes, corruption detected shim-side) — green
  end-to-end, the real product performing the actual move on the corrupt
  record — and against six deviations: empty-record-read (red at the
  exit-1 assertion), refused-consults-record (red at the
  refusal-findings-alone count), preview-repairs (red at the
  modifies-nothing compare), located-finding (red at the
  no-path-inside-the-area locations assertion), incomplete-files (red at
  the `files` complete equality), real-refuses (red at the
  real-operation-proceeds exit). Typecheck/format clean; section-6.6 suite
  5 failed as diagnosed (T6.6-2..-5 keep their pre-existing reds); `npm
  run test:self` unchanged 4 planned mid-loop reds (certification-document
  ×3 → FP-091; S-1's 7 unmapped keys → stages G), S-5 (73 tests) and
  certification green.]

## Stage F — §§10–14 missing arms

- [x] FP-033 — T10.1-4: stage the "malformed recorded decompositions"
  corrupt-state arm. [R2 #20; TEST-SPEC §10.1]
  `test/suite/registry/section-10.1.ts`.
  [Done 2026-08-11: new arm between the creation-parameters and
  garbage-bytes states — build, create an audit session, select the
  subtree-coherence item scoped at `specs/A.mdx#a` (the one section with a
  child) from the decoded status report, have the PRODUCT perform `review
  split` on it (exit 0; post-split premise pins the original id gone —
  removed and never reused, SPEC 10.7 — so a decomposition is genuinely
  recorded durably), capture a current item id, then garble the recorded
  decompositions via the new H-3 transformation
  `stageGarbleDecompositions` (session-staging.ts: SESSION_SHAPE gains
  `decompositionsKey`; the creation-parameters garble refactored into a
  shared `garbleRecordedMember` structural-type-flip — shape-aware,
  value-blind, fail-loud, staged file stays one JSON document) and run the
  full `assertCorruptSessionContract` (six naming subcommands exit 1 +
  /corrupt/i + modifies-nothing; `list` corrupt-in-place exit 1; `check`
  14.21). S-5 gains the decompositions guards (type-flip positive control
  both directions with the rest of the session untouched; stays-parseable
  loop entry; no-member rejection): 73 → 74 tests, green. Soundness proven
  by direct probes against the built product (the suite arm is unreached:
  T10.1-4 stays red-as-diagnosed at the FIRST adapter state's `check
  --json` form-exact findings decode, the pre-existing FP-001-class
  product gap — "expected no member \"condition\""): split records
  `{"kind","scope"}` under `decompositions`; on the garbled state all six
  naming subcommands exit 1 mentioning corrupt, `list --json` exit 1 with
  `[{cor, corrupt: true}]`, `check --json` exit 1 with a 14.21 finding
  (old shape), and the whole tree is byte-unchanged across every contract
  command. Section-10.1 unchanged 3 failed / 1 passed (T10.1-2/-3 keep
  their pre-existing FP-002-class exit-2 error-document reds; T10.1-1
  green). Typecheck/format clean; `npm run test:self` unchanged 4 planned
  mid-loop reds (certification-document ×3 → FP-091; S-1's 7 unmapped
  keys → stage G), S-5 and certification green. Traceability unchanged
  (["10.1", "14"] — 14.21's primary record already rides "14"); T10.1-4
  in no certification scope.]

- [x] FP-034 — T10.4-2: add the non-scope presence recordings. [R2 #21;
  TEST-SPEC §10.4]
  `test/suite/registry/section-10.4.ts`: context arm
  (`metadata-consistency`, removed target `T` re-authored) and origin arm
  (`dependency-consistency`, origin `D` deleted with hashes/context set
  unchanged).
  [Done 2026-08-11: both arms appended to T10.4-2 (title extended, timeout
  240s → 360s), each its own git-baselined workspace. Context arm: baseline
  `D` bears `d={"tt"}` to sibling `T` in one file; one edit removes the
  reference and deletes T's section; `review create --base` derives exactly
  {metadata-consistency D, subtree-coherence root} (kindScopeSet-pinned; the
  deleted T skipped for its changed ancestor), D's item's context exactly
  [{T, absent}] via new `assertSoleContext`; resolve no-change; re-author T
  → `invalidated` with context presented [{T, present}]. Origin arm:
  X→T→D across three files (D beside sibling `e`); the d-list edit on D
  (gains `d={"e"}`) derives exactly {metadata-consistency D,
  dependency-consistency T, dependency-consistency X} — no `changed` node —
  with X's item context [{T, present}] and origin [{D, after-present}]
  (`assertSoleOrigin`); resolve no-change; one edit removes T's `d={O.d}`
  (import kept — an unused import is valid and records no edges, SPEC 2.1)
  and deletes D's section → `invalidated`, post-show pinning scope X
  present, context T present, origin D after-side absent. Arm purity is
  asserted in-test via `assertHashPremises` (extracted from
  runSensitivityArms' inline loops, now fail-loud on a missing capture):
  context arm — D.metadataHash the item's only relevant hash, unchanged
  across the re-authoring, D still metadata-changed vs baseline (5.5's iff
  pins the d-set, so the generated context set stays {T}); origin arm —
  X.ownHash/X.metadataHash/T.subtreeHash unchanged (d-prop edits touch no
  own content, 1.6/5.5) while T.metadataHash changes and T.effectiveHash
  stays changed vs baseline (context set stays {T}). NOT red against this
  repo's product: direct CLI probes of both stagings returned exactly the
  expected item sets, hash brackets, presence flips, and invalidations (the
  product records presence for every scope/context/origin node — its
  `current` holds D presence-only with hashes {}), so the suite pass
  (section-10.4 5/5) is genuine; teeth live in the purity brackets plus the
  presence-flip assertion — a product recording presence for scope nodes
  alone (or scope+context, origin arm) has no other divergence channel and
  reports no-change where the arms demand invalidated. Typecheck/format
  clean; `npm run test:self` unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1's 7 unmapped keys → stage G),
  S-5 and certification green. Traceability unchanged (["10.4"]; 1.6/5.5/
  5.6/10.5 are context with home coverage elsewhere; no numbered condition
  asserted); T10.4-2 in no certification scope.]

- [x] FP-035 — T10.7-7: assert payload source ranges for EVERY present
  node. [R2 #22; TEST-SPEC §10.7]
  Currently asserted "for present requirement nodes" only
  (section-10.7-i/ii — locate the T10.7-7 body): cover every present
  node's, requirement node and present code location alike; none for
  absent nodes.
  [Done 2026-08-13: the payload arm (section-10.7-ii.ts) now runs on
  SPECS_CODE_CONFIG with a v1 code source whose named unit `nextUnit`
  references a.k (SPEC 4.6 attribution behind a multi-byte prefix), and
  covers the range clause on every payload position: ORIGIN nodes — the
  H-3 review adapter's OriginEntry gains a node-level `sourceRange`
  (SPEC 10.7 presents every scope/context/origin node under its current
  identity and presence with its range when present; the after side IS the
  current presence, so the decode forbids a range on an after-absent entry)
  asserted via new `assertOriginRange` on every origin entry the test
  reads, and carried through `payloadProjection` so the one-payload-rule
  compares include it; CODE LOCATIONS — the walk (resolve no-change never
  re-derives) reaches the code-impact item after the two spec items and
  byte-asserts its present scope's named-unit construct range against
  precomputed offsets, no text (SPEC 1.7's review-payload half), context
  a.k subtree text + range, origin a.k pair + range; ABSENT nodes — the
  code file is then deleted (build exit 0, zero-source code group valid),
  and the SAME item id presents its scope absent: identity and absence
  alone, no text, no range (assertAbsentState), context/origin still
  present and ranged; the parent-consistency middle item's scope (own
  text + range) asserted in passing. S-5 gains the origin-range guards
  (present entry's range decoded and surfaced; range on a currently-absent
  origin node rejected), 74/74. Verified: T10.7-7 turned falsely-green →
  red-as-diagnosed at exactly the first new assertion — the first item's
  origin-entry range, undefined against a.k's `query node` range (the
  product emits no origin range and no code-impact scope range: probes
  confirmed the whole walk, item order [sc a.k, pc a, ci], presence flip
  after deletion, and every asserted text/range value against the built
  product, so downstream arms are sound and unreached until the product
  presents ranges). Traceability unchanged (["10.7"] — T1.7-1's entry
  names T10.7-7 as field-presence coverage like T11-1/T12.4-1, which
  carry no "1.7"; the range-key homes stay T1.7-*/T10.7-12). `npm run
  test:self`: unchanged 4 planned mid-loop reds (certification-document
  ×3 → FP-091; S-1's 7 unmapped keys {11.2–11.6, 12.6, 12.7} → stage G),
  S-5 and certification green; T10.7-7 in no certification scope.
  Typecheck/format clean.]

- [x] FP-036 — T11-6: add the wrong-kind / unknown-unit / disambiguator
  arms. [R2 #23; TEST-SPEC §11.1]
  `test/suite/registry/section-11.ts`: (a) `query node`/`show` on a
  code-group `path`/`path#unit` → exit 2; (b) `query edges --from/--to` and
  `reachable --from/--to` with `#unspelled-unit` → exit 2; (c) out-of-range
  `@2`; (d) `@1` unknown at every occurrence count, staged at one and at
  two occurrences.
  [Done 2026-08-13: twelve arms appended to T11-6's existing workspace (no
  new files — its code file already stages chain `Box` once and `Box.v`
  twice, getter/setter). (a) `query node` and `show` each given
  `src/code.ts` and `src/code.ts#Box.v` → 4 arms via `expectUsageError`
  (exit 2 exactly + single 12.7 error document under `--json`, the FP-002
  protocol). (b) `#ghost` (no unit spells it) in all four graph-node flag
  positions — `edges --from`/`--to`, `reachable --from`/`--to` (valid
  `specs/S.mdx#s1` as the counterpart flag). (c)+(d) ride `query edges
  --from` (the entry's primary position) behind a new premise control
  pinning the once-occurring chain as a spelled unit — `--from
  src/code.ts#Box` exit 0 with an EMPTY edge list (the check is parse-local
  over named units per TEST-SPEC T11-6, so a spelled unit is never unknown;
  empty-at-exit-0 is the module's established valid-identity/no-matching-
  edges operationalization), keeping the @-arms sharp (they fail on the
  disambiguator, never on an unknown chain): `Box@2` out-of-range, `Box@1`
  (once), `Box.v@1` (twice — the discriminating arm: a product resolving
  `@1` to the first occurrence would answer the getter's `embeds` edge at
  exit 0, an edgeless-graph-node product an empty list at exit 0; the exact
  exit-2 assertion forbids both). Title extended; traceability unchanged
  (["11.1"] — 12.0/12.4/4.6 are context with home coverage at T12.0-*/
  T12.4-*/T1.7-2; no numbered condition asserted); T11-6's unknown-unit and
  `@N` arms are named in CERTIFICATIONS.md's Exclusions (shared machinery),
  no fixture scope. Verified red-as-diagnosed by guarded solo executions of
  every new arm against the built product: the premise control passes
  (probe: `{"edges":[]}` exit 0; `Box.v`/`Box.v@2` resolve to getter embeds
  / setter references), and all 11 usage-error arms pass their exact exit-2
  assertion (the product already classifies every one correctly per its
  stderr) and fail exactly at the error-document decode ("stdout is empty"
  — the FP-002-class product gap, the same first-arm failure T11-6 already
  shows at its unknown-path arm, so the new arms are unreached in the suite
  until that closes). Section-11 unchanged 4 failed / 3 passed (T11-1/-3/-7
  green); typecheck/format clean; `npm run test:self` unchanged 4 planned
  mid-loop reds (certification-document ×3 → FP-091; S-1's 7 unmapped keys
  {11.2–11.6, 12.6, 12.7} → stage G), S-5 and certification green.]

- [x] FP-037 — T12.0-1/-3/-4: extend the shared command sweep with the new
  surfaces. [R2 #24; TEST-SPEC §12.0]
  `test/suite/registry/section-12.0-i.ts` `SWEEP_STEPS` (~line 235): add
  `occurrences`, `view`, `at`, `inventory`, `version`. T12.0-1 must also
  assert the JSON-only surfaces emit the same single document with the
  `--json` flag as without.
  [Done 2026-08-13: SWEEP_STEPS gains the five surfaces after the query
  family (mutations still last) — `occurrences`, `view`, `at specs/A.mdx 0`,
  `inventory`, `version`, each a clean-domain read over the valid story
  workspace (complete finding-free answer, exit 0; 11.2/11.6/12.6) — so all
  three sweep users drive them with `--json` (T12.0-1), with a cwd-relative
  `--config` (T12.0-3; accepted-not-consulted on version, 12.6), and under
  T12.0-4's doubled-`--config` exit-2 protocol. T12.0-1's parity arm:
  SweepStep gains a `jsonOnly` marker on the 12 JSON-only steps (the six
  query subcommands, the five new surfaces, review export — SPEC 11
  preamble, 12.6, 10.7), and under assertJsonOnlyParity (T12.0-1 only) each
  such step reruns without `--json` asserting exit 0, a single JSON document
  as the entire stdout (H-5's JSON-only clause), and stdout byte-identical
  to the flagged run's — "the same single document" operationalized as a
  product-to-itself byte compare (H-4; module header documents the reading:
  a single document as the surface's ONLY output form makes the flag inert).
  Verified: T12.0-1 turned green → red-as-diagnosed exactly at
  `occurrences --json` (exit 2 "unknown command" — the new-surface product
  gap), the six query parity arms passing before it (probe: the product
  already emits byte-identical stdout with/without the flag on query node
  and review export, so the parity assertion is satisfiable); T12.0-3 now
  red at the same step of its sweep (previously a later FP-002-class arm);
  T12.0-4 keeps its pre-existing first failure (doubled-`--config`
  error-document decode on build), new steps unreached there;
  T12.0-2/-5/-6 unchanged. Typecheck/format clean; traceability unchanged
  (all three ["12.0"]; 10.7/11/12.6 are context with home coverage at stage
  G); T12.0-1/-3/-4 in no certification scope. `npm run test:self`
  unchanged 4 planned mid-loop reds (certification-document ×3 → FP-091;
  S-1's 7 unmapped keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and
  certification green.]

- [x] FP-038 — T12.0-9: add the new exit-partition representatives.
  [R2 #25; TEST-SPEC §12.0]
  Exit 0: `version`, clean `occurrences`/`view`/`at`, `inventory`,
  successful previews. Exit 1: refused previews and answers carrying
  findings/explicitly-unavailable data (emitted in full). Exit 2:
  wrong-kind operands and the `occurrences --to` malformed-only exception.
  [Done 2026-08-13 (`test/suite/registry/section-12.0-ii.ts`): exit-0 rows
  on the story workspace after its exit-0 build (the clean-domain premise) —
  `version`, `occurrences`, `occurrences --to specs/NoSuch.mdx#nope` (the
  exception's accepted side: well-formed unknown selects the empty set,
  exit 0), `view`, `at specs/A.mdx 0`, `inventory`, and the successful
  rename preview `alpha → gamma`; exit-1 rows — refused rename and move
  previews beside their real refused twins (SPEC 6.6 refusal equivalence on
  the same state), and `occurrences`/`view`/`at` answering on the findings
  workspace (id-less `specs/U.mdx` staged beside the unresolved-reference
  file: findings 14.5 + 14.1, the section's identity explicitly
  unavailable), each such row asserting emitted-in-full at H-5's protocol
  grain via the new `emitsAnswer` row marker (stdout exactly one JSON
  document — T11.2-5 pins the full-answer contract); exit-2 rows —
  `occurrences --to a#b..c` (the exception's usage-error side: an empty
  segment), and a new wrong-kind workspace (SPEC_AND_CODE_CONFIG,
  reference-free `src/app.ts`) with `show src/app.ts` (code source where a
  requirement-node identity is required) and `view src/app.ts` (where a
  spec source is required), discovery pinned by the premise probe `query
  edges --from src/app.ts` → empty answer exit 0 (an unconfigured path
  would be unknown, exit 2). Title updated to the refreshed TEST-SPEC
  entry; module-header operationalization note extended (premise probes;
  emitted-in-full grain; previews exit-code-only, T6.6-* owning
  modifies-nothing/content). Traceability unchanged (["12.0"] — 11.2/11.6/
  6.6/12.6 are context with home coverage at stages G/H); no certification
  scope. Verified: T12.0-9 turned green → red-as-diagnosed exactly at the
  first new row (`version` → exit 2 "unknown command", the new-surface
  product gap); later arms unreached in the suite, proven sound by direct
  probes against the built product — wrong-kind arm: build exit 0, edges
  premise `{"edges":[]}` exit 0, `show src/app.ts` exit 2 with the
  wrong-kind diagnosis (genuinely green today); findings arm: build/check
  exit 1 with exactly the staged 14.5 + 14.1; all three `--preview` rows
  exit 2 "unknown flag", `occurrences`/`view`/`at`/`inventory`/`version`
  exit 2 "unknown command" — every 0/1-class row fails as diagnosed until
  the product grows the surfaces, and the two coincidental exit-2 matches
  (`view src/app.ts`, malformed `--to`) are toothed jointly by the same
  surfaces' 0/1-class rows plus T11.4-2/T11.3-3's full semantics.
  Section-12.0-ii now 4 passed / 1 failed (T12.0-9 the one red;
  T12.0-7/-8/-11/-12 stay green); typecheck/format clean; `npm run
  test:self` unchanged 4 planned mid-loop reds (certification-document ×3 →
  FP-091; S-1's 7 unmapped keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and
  certification green.]

- [x] FP-039 — T12.0-10: implement the precedence arms (test stops being
  alias-only). [R2 #26; TEST-SPEC §12.0]
  Add: gated-read usage-error precedence on a failing workspace with the
  valid-twin comparison; the `show <unparseable>#id` masking arm; the
  past-the-gate corrupt-session `resolve` arm; the within-class-2
  no-configuration arms; the configuration-error-precedes arm. Update its
  H-7 entry (see FP-003's note).
  [Done 2026-08-13 (`test/suite/registry/section-12.0-ii.ts`): T12.0-10
  registered with the four own-arm groups; the rename/move/baseline arms
  stay cross-references to T6.4-4/T6.5-5/T6.3-4 (module header rewritten;
  traceability map comment updated per FP-003's note; entry
  `"T12.0-10": ["12.0"]` — the FP-016 precedent: in no TEST-SPEC 14
  staging record, so no "14"). Gated reads: a failing workspace (valid
  A.mdx + src/app.ts with named unit `known` + unparseable Broken.mdx as
  the premise-pinned single 14.20) and a valid twin identical in
  everything the six checks consult; rows unknown-profile, code-group
  `--group`, unknown-session, `show A.mdx#unspelled`, `query node
  src/app.ts`, `edges --from src/app.ts#unspelled` each exit 2 with
  stdout exactly the 12.7 error document ("reports no validation
  findings" at H-5's protocol grain), stderr nonempty, failing/twin
  documents byte-identical ("the same exit-2 errors", H-4
  product-to-itself; stderr wording left free per the module-header
  operationalization note); five twin controls pin every name as
  resolving. Masking: `show Broken.mdx#broken` exit 1, form-exact
  findings report = exactly the one 14.20 located in Broken.mdx (the file
  contains `id="broken"`, failing scrape-and-answer and unknown-id
  products both ways). Past the gate: product-written audit session
  corrupted by garbage overwrite; premise `resolve corrupt <no-such-item>`
  exit 2 pre-corruption (T10.7-10's contract), the same argv exit 1 with
  /corrupt/i post-corruption (T10.1-4's operationalization). Within class
  2: unknown command, `ids --json --json`, `show a#b#c` on invalid-config
  and missing-config workspaces — exit 2, plain usage error (code and
  path null, 12.7), byte-identical documents across the two states — then
  `coverage no-such-profile` under invalid configuration via
  expectConfigurationError (14.14, not the unknown profile). Verified:
  suite file 12.0-ii 2 failed / 4 passed (T12.0-9 the pre-existing red;
  T12.0-10 red-as-diagnosed at the failing-premise form-exact findings
  decode — the FP-001-class gap); later arms unreached in the suite,
  proven sound by direct probes against the built product: all five twin
  controls exit 0; failing rows 1–3 already exit 2 (red only at the
  FP-002-class empty exit-2 stdout) while rows 4–6 expose a real
  precedence gap (the product gates the parse-local identity/kind/unit
  checks — exit 1 where the arms demand 2); twin rows exit 2 with the
  right classifications; masking exits 1 with the gated report (old
  shape); the corrupt arm runs genuinely green end to end; syntax rows
  1–2 already precede configuration (identical stderr across states, red
  at the missing error document) while `show a#b#c` exposes the second
  real gap (the product reports the configuration error, not the
  malformed value); config-error precedence already holds (red at the
  empty stdout alone). Typecheck/format clean; `npm run test:self`
  unchanged 4 planned mid-loop reds (certification-document ×3 → FP-091;
  S-1's 7 unmapped keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and
  certification green. No certification scope: T12.0-10 sits in
  CERTIFICATIONS.md's Exclusions only, which name exactly the in-test
  valid-twin comparison this body carries.]

- [x] FP-040 — T12.0-12: extend the git-less sweep. [R2 #27; TEST-SPEC
  §12.0]
  Add `occurrences`, `view`, `at`, `inventory`, `version`, and the
  `--preview` invocations of `rename`/`move`.
  [Done 2026-08-13: seven steps joined GITLESS_STEPS
  (section-12.0-ii.ts) — `occurrences`, bare `view`, `at specs/A.mdx 0`,
  `inventory`, `version` after the query steps (clean-domain finding-free
  answers per SPEC 11.2 and the workspace-independent 12.6 report; each a
  JSON-only surface accepting the sweep's uniform `--json` per T12.0-1),
  plus `rename … --preview` and `move … --preview` each directly before
  its real operation with identical operands (a preview succeeds exactly
  when the real operation would proceed and modifies nothing, SPEC 6.6,
  so each real step still runs at the state it saw before). Title
  extended to the full T12.0-12 surface. Traceability unchanged
  (["preamble", "12.0"]; 11.2–11.6/12.6/6.6 are carriage context with
  home coverage at stage G's §11/§12.6 tests and T6.6-*; no numbered
  condition asserted); no certification scope (T12.0-12 appears nowhere
  in CERTIFICATIONS.md). Verified: T12.0-12 turned green →
  red-as-diagnosed at the first new step (`occurrences --json` exit 2
  "unknown command" — the patch-new surface); section-12.0-ii went 2
  failed/4 passed → 3 failed/3 passed (T12.0-9/T12.0-10 keep their
  pre-existing reds); later steps unreached in the suite, proven sound by
  direct probes against the built product in sweep order on a replica
  staging: the five reads each exit 2 unknown-command, both previews exit
  2 unknown-flag `--preview` (each failure exactly the diagnosed product
  gap), while the premise build and the real rename/move at the probed
  states exit 0 — every new argv valid at its insertion point.
  Typecheck/format clean; `npm run test:self` unchanged 4 planned
  mid-loop reds (certification-document ×3 → FP-091; S-1's 7 unmapped
  keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and certification green.]

- [x] FP-041 — T12.2-2: add occupant-kind staleness and graph-data
  unit-form arms. [R2 #28; TEST-SPEC §12.2]
  `test/suite/registry/section-12.1-12.2.ts`: occupant kinds (symlink to a
  byte-identical target; directory); graph-data unit forms — missing
  (isolated: exactly one condition-10 unit-form finding, no per-file
  finding), mismatch (isolated via refresh-then-revert), unreadable-record
  (FP-032's staging → unit form alone; `build` replaces; `check` clean;
  `inventory` recovers).
  [Done 2026-08-13: occupant arms landed inside the per-file staleness
  family between the hand-deleted and edited-source arms — the module path
  occupied by a symlink to a root-level byte-identical copy (identity
  through the link pinned as the staging premise: only occupant-kind
  judgment can find it, the arm a link-following product wrongly passes)
  and by a directory, each asserted via the existing
  exactly-one-14.10-naming-the-module protocol, cleaned up between arms.
  Two new families follow (the TEST-SPEC list reading: unit forms are their
  own families): graph-data unit form — missing via section-13.3's
  `deleteGraphData` (T13.3-2's operational definition) on the freshly
  built, otherwise clean workspace; mismatch via build → text-only edit →
  one refreshing read (`ids`, exit 0) → revert, the refresh premise pinned
  by whole graph-data byte comparison before/after (graph data carries all
  four hashes, 13.3; H-4 self-comparison carve-out, content otherwise
  unread) — and unreadable record via `corruptGraphDataShapeBlind`
  (FP-032's H-3 record-staging adapter), then `build` exit 0, `check` exit
  0, and `inventory` decoded through the new scoped forms.ts
  `decodeInventoryRecordedDatum` (the `recorded` member alone as the
  FP-001 three-state datum; S-5 DECODERS guards added — marker/empty-list/
  byte-form positives, absent-member/non-marker/fabricated-value
  rejections) asserting a plain list naming specs/A.xspec.ts. Each
  unit-form state asserts `assertSingleUnitFormFinding`: exactly one
  condition-10 finding (no per-file finding beside, never the mismatch
  form beside), concerned path exactly `.xspec` (GRAPH_DATA_AREA_PATH),
  locations [], message instructing rebuilding — the T6.6-6
  operationalization, recorded in the module header. Title extended;
  timeout 240s → 300s; traceability unchanged (["12.2", "14"];
  13.3/13.4/11.6 are carriage context with home coverage at
  T13.3-*/T13.4-*/T11.6-*); no certification scope (T12.2-2 sits in
  CERTIFICATIONS.md prose only). Verified: suite file unchanged 3 failed /
  3 passed — T12.2-2 red-as-diagnosed at family 1's pre-existing
  FP-001-class form-exact decode, new arms suite-unreached — with
  soundness proven by scratch solo executions of the exact arm code plus
  direct CLI probes against the built product: both occupant stagings run
  clean and the product already judges occupants itself (exit 1, exactly
  one old-shape 14.10 naming the module both ways — red only at the form
  gap); missing/mismatch/unreadable each exit 1 with exactly one old-shape
  condition-10 finding whose concerned file is `.xspec/graph.json` — a
  path INSIDE the area where the arms demand the area path `.xspec`
  itself, a real value gap beyond the form gap; the mismatch premise held
  (refresh rewrote graph data); build-over-corrupt exit 0, check-after
  clean, and `inventory` exit 2 unknown command (the patch-new surface —
  the recovery assertion's diagnosed red at runJson's exit-0 gate).
  Typecheck/format clean; `npm run test:self` unchanged 4 planned mid-loop
  reds (certification-document ×3 → FP-091; S-1's 7 unmapped keys
  {11.2–11.6, 12.6, 12.7} → stage G), S-5 green including the new
  inventory-recorded-datum guards, certification green.]

- [x] FP-042 — T12.2-3: pin never-refreshes per state. [R2 #29; TEST-SPEC
  §12.2]
  Missing-arm state (graph data stays absent), isolated mismatch state,
  combined per-file+unit state.
  [Done 2026-08-13: T12.2-3 rebuilt as the three per-state pins on one
  workspace (section-12.1-12.2.ts) — (1) T12.2-2's missing-arm staging
  (fresh build, `deleteGraphData`), absence pinned as a staging premise so
  the whole-root compare-around positively proves graph data STAYS absent
  (`check` never rewrites it, where every refreshing read would —
  T13.3-2's cite); (2) the isolated mismatch state via T12.2-2's
  refresh-then-revert staging with both premise pins (graph data present
  after rebuild; the refresh rewrote it — H-4 self-comparison carve-out);
  (3) the edited-source-without-rebuild state, per-file + unit staleness
  together (generated files compile the old source; graph data carries all
  four hashes — the state 2 premise pin shows this edit class rewrites it).
  Each state runs plain `check` (exit 1) and `check --json` inside one
  whole-root `assertLeavesUnchanged`; the staleness report is asserted per
  state — exactly one unit-form condition-10 finding (states 1–2,
  T12.2-2's shared helper) / `assertAllStale` (state 3) — so each state's
  reachability is positively established, never assumed. No new helpers or
  adapters (S-5 untouched); traceability unchanged (["12.2"] — the
  T13.3-2/T13.3-3 precedent: the condition assertions establish the state,
  14.10's primary record is T12.2-2's). Verified: suite file unchanged 3
  failed / 3 passed — T12.2-3 red-as-diagnosed at state 1's FP-001-class
  form-exact decode, later arms suite-unreached — with soundness proven by
  a scratch probe of the exact state sequence against the built product:
  every staging premise holds (build/ids exit 0, delete leaves zero graph
  entries, the refresh rewrites graph data), all three states exit 1 on
  both `check` forms reporting only old-shape condition-10 findings
  (concerned file `.xspec/graph.json`, INSIDE the area where the unit form
  demands `.xspec` itself — the FP-041-diagnosed value gap behind the form
  gap), and the whole-root diff around the invocations is empty in every
  state — the byte pins themselves already hold, graph data staying absent
  in state 1. Typecheck/format clean; `npm run test:self` unchanged 4
  planned mid-loop reds (certification-document ×3 → FP-091; S-1's 7
  unmapped keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and certification
  green.]

- [x] FP-043 — T12.5-1: extend the dispatch sweep. [R2 #30; TEST-SPEC
  §12.5]
  `test/suite/registry/section-12.3-12.5.ts`: add `occurrences`, `view`,
  `at`, `inventory`.
  [Done 2026-08-13: four dispatch arms appended between the `query nodes`
  arm and the unknown-command arms (reads before the mutating rename/move),
  each a minimal exit-0 probe on the existing fixture, invoked bare — the
  §11 surfaces are JSON-only, one document with or without `--json` (SPEC
  11): `occurrences` decoded via the existing form-exact
  `decodeOccurrencesReport` and asserted exactly `{findings: [],
  occurrences: []}` (no reference spelling staged — the definitive empty
  enumeration, SPEC 11.3); `view` via new scoped forms.ts
  `decodeViewFilesReport` (top level `{"findings","views"}` exact, each
  per-file wrapper's five members exact and present, `file` decoded,
  path-byte order strict — a set; `root`/`imports`/`occurrences`/`comments`
  deliberately unread, T11.4-*'s subject) asserted `{findings: [], files:
  ["specs/D.mdx"]}` — the whole-domain request; `at specs/D.mdx 20` via new
  forms.ts `decodeAtReport` (the full 12.7 at form:
  `{"findings","resolution"}`, resolution and section-identity datums
  value-or-marker never null, occurrence record-or-null) asserted exactly —
  section identity specs/D.mdx#anchor, construct range {0,69}, occurrence
  null (offset 20 inside "Anchor line.": inside anchor 0..69, outside
  anchor.sub 30..64; offsets computed independently and matching `query
  node`'s probed sourceRanges); `inventory` via the existing scoped
  `decodeInventoryRecordedDatum` — recorded a plain list naming
  specs/D.xspec.ts (T12.2-2's precedent; membership, companions
  unpinned). Title, module header, and the T12.5-1 operationalization note
  updated to the ten-command list; S-5 gains both new decoders' DECODERS
  guards (positives incl. resolution/identity unavailability, byte-form
  view file, containing-occurrence record, empty views; rejections:
  absent/null members, widened markers, extra members at every level,
  out-of-order and duplicate per-file views, null section identity).
  Traceability unchanged (["12.5"]; 11.2–11.6 are dispatch context with
  home coverage at stage G's T11.*-*). Verified: suite file unchanged 2
  failed / 2 passed — T12.5-1 red-as-diagnosed now at the first new arm
  (`occurrences` exits 2 "unknown command": the whole §11 surface is
  patch-new, so all four arms hit the same dispatch gap; T12.3-1 keeps its
  pre-existing FP-002-class red), later arms suite-unreached with decode
  satisfiability proven by S-5's positive controls over the same document
  shapes and the fixture byte facts probed directly (build generates
  specs/D.xspec.ts; D.mdx spells no reference; one discovered spec
  source). Typecheck/format clean; `npm run test:self` unchanged 4 planned
  mid-loop reds (certification-document ×3 → FP-091; S-1's 7 unmapped keys
  {11.2–11.6, 12.6, 12.7} → stage G), S-5 (80) and certification green.]

- [x] FP-044 — T13.3-1/T13.3-2: extend read sweeps; add the
  record-discipline arm. [R2 #31; TEST-SPEC §13.3]
  `test/suite/registry/section-13.3.ts`: sweeps gain `occurrences`, `view`,
  `at`. T13.3-2 gains: shape-blind record corruption → refreshing reads
  answer finding-free exit 0, state neither read nor replaced, `inventory`
  reports `recorded` unavailable until `build`.
  [Done 2026-08-13: T13.3-1's serving sweep gains the three probes inside
  its leaves-unchanged block — `occurrences` (the complete record set at
  identity level via new module helpers `occurrenceIdentitySummaries`/
  `assertAtAnswer`: the one d occurrence alpha→beta, finding-free), `view`
  (scoped decode, exactly {findings [], files [specs/A.mdx]}), `at` offset
  30 → alpha with occurrence null — the identity/membership altitude
  documented in the module header (byte-precise spans and per-file view
  content are T11.3-*/T11.4-*/T11.5-*'s home; ranges still form-validated
  by the S-5-guarded decoders). T13.3-2 arm A gains the same three
  (definitive empty enumeration; both files; offset 20 → alpha), each
  followed by the existing rewritten-exactly-as-build w0 compare; arm B's
  edit now stages `<S id="added" d={["alpha"]}>` — the edited sources'
  one occurrence — so `occurrences` (added→alpha) and `coverage`
  (uncovered exactly [added, beta], covered exactly alpha via
  [added, alpha]) answer values the stale pre-edit graph cannot produce,
  `at` 75 resolves the edited-source-only identity added, `view` answers
  the whole domain finding-free. New record-discipline arm on its own
  workspace (alpha d=["beta"]+beta, git baseline, audit session):
  `corruptGraphDataShapeBlind` (T6.6-6's staging, the H-3 record-staging
  adapter), then all nine refreshing reads, each asserting the exit-0
  finding-free contentful answer, then `inventory` exit 1 with `recorded`
  still explicitly unavailable (persistence per read — neither read,
  repaired, nor replaced; the finding's full form stays T11.6-4's home),
  then outside-graph-data byte-identity against the post-corruption
  snapshot (graph-data bytes deliberately unpinned: the record's location
  inside the area is unenumerated, so a conforming refresh may rewrite
  non-record files around the preserved record state — module header
  note); after the sweep, `build` exit 0 → `inventory` exit 0 with
  `recorded` a plain list naming specs/A.xspec.ts. Traceability: T13.3-2
  gains "14" (TEST-SPEC 14's per-condition record lists it under 14.23;
  the map's construction note carries that record at passage granularity).
  Verified: typecheck/format clean; section-13.3 went 2 failed/2 passed →
  3 failed/1 passed — T13.3-1 falsely-green → red-as-diagnosed at its
  `occurrences` probe and T13.3-2's red moved earlier to arm A's
  `occurrences` probe (both exit 2 "unknown command 'occurrences'" — the
  whole §11 surface is patch-new, the FP-043-diagnosed dispatch gap;
  T13.3-3 keeps its FP-001-class red, T13.3-4 green). Suite-unreached
  arms probe-verified directly against the built product: arm B's
  review-status invalidation table, the V1 coverage/ids/show answers
  (added's construct range 41..94 confirmed), and the deleted-source
  sub-arm end-to-end under V1 (B's module survives the read, `check`
  reports 14.10 ×4 on B's derived files, the final build removes them, A
  survives); record arm: `ids` on the corrupt record answers exit 0 while
  the current product rewrites the whole record — exactly the
  replace-the-state behavior the arm discriminates — and `inventory`
  exits 2 (unknown), the arm's first diagnosed failure if reached;
  at-offsets computed mechanically (30/20/75 inside alpha/alpha/added,
  outside the occurrence spans 18..24/none/59..66). `npm run test:self`:
  unchanged 4 planned mid-loop reds (certification-document ×3 → FP-091;
  S-1's 7 unmapped keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and
  certification green (CONF-CORE 9/9, CONF-VALID 12/12, CONF-MD 8/8,
  CONF-DISC 3/3; violators failing exactly as certified). No new decoder
  (S-5 unchanged); T13.3-1/-2 in no certification scope.]

- [x] FP-045 — T13.3-3: add the whole-gate arms and the never-gated
  contrast. [R2 #32; TEST-SPEC §13.3]
  Whole-gate: garbage journal line (14.13) and obstructed write path
  (14.22) — each gated read reports it, exits 1, answers nothing, modifies
  nothing. Never-gated contrast: `occurrences`/`view`/`at` answering per
  SPEC 11.2 and `inventory` answering, on the same workspaces.
  [Done 2026-08-13: two new workspaces in T13.3-3 (section-13.3.ts).
  Journal arm: one legitimate journaled rename puts the garbage on line 2
  (T6.1-3's staging, so line naming has teeth; the 14.13 line-naming check
  mirrors T6.1-3's H-4 operationalization), and the baseline commit for
  `impact --base` is taken WITH the garbage line in place: 12.0 orders
  baseline resolution before the gate, and per 6.3 it succeeds there — the
  baseline journal is byte-identical to the current journal (append-only
  prefix invariant), zero entries replay (T6.3-4's exit-2 replay-failure
  arm is the garbage appended AFTER the baseline commit — TEST-SPEC's
  deliberate contrast), and baseline-content validation is
  source/configuration validity per T6.3-4's own "sources fail
  parse/validation" arm; SPEC 13.3's naming of `impact` among the
  journal-error-reporting gated reads is reachable only under this
  staging (module header documents the interpretation). Obstruction arm:
  after a successful build (emission under markdown.outDir) and session
  create, the mdout directory is replaced by a plain file — the emit
  write path mdout/specs/A.md's one offending component. Each of the six
  gated reads (ids, show alpha, coverage, impact --base, review status s,
  query nodes) asserts exit 1 + the form-exact findings report with
  exactly {14.13: 1} (concerned path .xspec/journal, line named) /
  {14.22: 1} (concerned path mdout), each inside a whole-root
  assertLeavesUnchanged. Never-gated contrast on both workspaces, each
  probe in its own whole-root compare: `occurrences` (exact one-record
  alpha→beta identity summary, findings []), `view` (whole domain,
  findings []), `at specs/A.mdx 30` (alpha, occurrence null), all exit 0
  whatever the gate state (11.2: a gate condition is no domain file's
  finding), and `inventory` exit 0 with `recorded` a plain list naming
  specs/A.xspec.ts (11.6). Verified: typecheck/format clean;
  section-13.3 unchanged 3 failed / 1 passed (T13.3-3 red at the same
  first FP-001-class decode; new arms suite-unreached); guarded solo runs
  of each new arm against the built product fail exactly as diagnosed —
  journal arm at the first gated probe's form-exact decode (the product
  already gates the five non-impact reads with old-shape 14.13 naming
  line 2, while `impact --base` exits 2 treating the baseline's own
  journal state as a 6.3 failure: the diagnosed precedence gap), and
  obstruction arm at the first probe's exit assertion (the product
  answers all six reads exit 0 from the obstructed workspace — the
  gates-on-source-validity-alone product the arm discriminates; its
  `build`/`check` crash exit 70 ENOTDIR on the same staging); the
  never-gated surfaces exit 2 "unknown command" (the patch-new §11
  dispatch gap). Staging premises probe-verified (rename → one-line
  journal; build emits mdout/specs/A.md preserving workspace-relative
  paths; both `review create`s succeed). `npm run test:self`: unchanged 4
  planned mid-loop reds (certification-document ×3 → FP-091; S-1's 7
  unmapped keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and certification
  green. Traceability unchanged (["13.3"] — T13.3-3 sits in TEST-SPEC
  14's per-condition record for neither 14.13 nor 14.22 (T6.1-3/T13.4-6
  are its homes), matching the landed convention that "14" rides that
  record); no new decoder (S-5 unchanged); T13.3-3 in no certification
  scope (Exclusions-shared machinery only).]

- [x] FP-046 — T13.4-6: add plain-file occupant and finding-cardinality
  arms. [R2 #33; TEST-SPEC §13.4]
  `test/suite/registry/section-13.4.ts`: occupants — a `build` write-path
  directory component; a first-emission `outDir` component. Cardinality —
  one component refusing two writes → one finding; two components → two
  findings, via `check`.
  [Done 2026-08-13: four first-emission workspaces under the existing
  OUT_CONFIG (outDir "out"; occupant staged in the declaration, so no move
  operand is involved — the destination-side contrast reporting
  `refused-invalid-destination` stays T6.5-4's, per TEST-SPEC's
  parenthetical): plain file at the outDir component `out` and, separately,
  at the deeper emit-path component `out/specs` (out a real directory —
  discriminates vet-only-the-outDir products), each asserting `build` and
  `check`; cardinality via `check` where TEST-SPEC pins it — A+B both
  emitting under occupied `out` → exactly one 14.22, and nested
  specs/one/A.mdx + specs/two/B.mdx with plain files at `out/specs/one` +
  `out/specs/two` → exactly two. All probes ride new module helpers
  `assertObstructionFindings`/`expectObstructionReport` (exit 1, form-exact
  12.7 findings report, exactly one condition-22 finding per staged
  offending component with the component as its concerned path per SPEC
  14.22's cardinality rule — per-index compare, sound because the pinned
  12.7 order among equal-code empty-location findings is concerned-path
  byte order; build-side sets exact, check-side tolerating only 14.10
  beside; every probe in a whole-root assertLeavesUnchanged); the existing
  write-path-symlink arm was refactored onto the same helpers, gaining the
  previously missing concerned-path assertion. No new adapter (S-5
  unchanged); traceability already ["13.4","14"] (T13.4-6 is 14.22's
  primary); no certification scope. Verified: typecheck/format clean;
  suite section-13.4 unchanged 1 failed / 5 passed — T13.4-6 red at the
  symlink arm's first FP-001-class form-exact decode, new arms
  suite-unreached; peeled solo runs against the built product fail each
  new arm exactly as diagnosed at its first probe's exit-code assertion
  (the product vets symlink components only and crashes exit 70 ENOTDIR on
  plain-file occupants in all four stagings — build and check alike; the
  deeper-component build even writes modules before crashing, the
  modify-while-refusing gap); occupant-free control twins build exit 0
  writing exactly the obstructed emit paths (staging premise); a
  fake-product control matrix on the two-components arm proved the helper
  green path and teeth (conforming report passes; a 14.10 beside passes;
  one-finding, per-write-duplicate, out-of-order, and extra-14.20 reports
  each fail at the intended assertion). `npm run test:self`: unchanged 4
  planned mid-loop reds (certification-document ×3 → FP-091; S-1's 7
  unmapped keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and certification
  green.]

- [x] FP-047 — T13.5-1: add the seam-neutrality arm. [R2 #34; TEST-SPEC
  §13.5]
  `test/suite/registry/section-13.5.ts`: held-then-released final workspace
  state byte-identical to the same operation without `--test-hold` on an
  identical twin.
  [Done 2026-08-13: one identical twin workspace (CORE_DECL), scoped around
  the five held arms alone, replays the held workspace's exact command
  sequence — staging `build` and the `review status` item lookup included —
  with the seam flag alone removed, and after each held-then-released arm
  the two whole trees are compared byte-identically via
  `assertDirectoriesEqual` with no exclusions (sources, journal, sessions,
  derived files, graph data; H-4 product-to-itself, H-6 across directories;
  hold paths already live outside the root). Per-arm compares make the twin
  byte-identical at each next arm's start, so every arm runs "the same
  operation on an identical twin workspace"; the sequence equality — reads
  included — is exactly what §VIOL-CORE-CHATTYREADS's passing analysis
  leans on (its appends land byte-identically on both sides), recorded as a
  header staging constraint. Arms 4/5 pass each side its own workspace's
  reported item ID (same operation by item scope, never an assumed
  cross-directory ID equality); `heldArm` gained an optional `twinArgv`.
  Title extended; traceability unchanged (["13.5"]; no numbered condition);
  no new adapter (S-5 unchanged); no certification-scope change. NOT red
  against this repo's product: suite section-13.5 7/7 — the product is
  already seam-neutral, consistent with T13.5-6's passing cross-directory
  tree compare; the pass is proven genuine by a teeth probe (twin's arm-2
  rename diverted a→a3 fails exactly at the new compare, diagnosing all 6
  divergent files across sources, journal, graph data, and generated
  modules; probe reverted). Certification: CONF-CORE conformer 9/9 with the
  new arm; violators exact — CHATTYREADS fails exactly T6.1-1+T13.4-5 while
  passing T13.5-1 (the sequence staging's proof), EARLYWRITE fails exactly
  T13.5-1 (still at the earlier while-held compare) +T13.5-4, NOLOCK/
  STALELOCK/PARTIALWRITE/PERSISTREADS exact. Typecheck/format clean;
  `npm run test:self` unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091; S-1's 7 unmapped keys {11.2–11.6,
  12.6, 12.7} → stage G).]

- [x] FP-048 — T14-4: extend the reporter matrix. [R2 #35; TEST-SPEC §14]
  `test/suite/registry/section-14.ts`: 14.21 by `check` alone beside gate
  findings; the 14.23 row (`inventory` + previews only, `check` as 14.10
  unit form, `build`/refreshing reads never); 14.14 never `version`;
  14.13/14.22 by gated reads yet accompanying no `occurrences`/`view`/`at`
  answer; every other condition accompanying `occurrences`/`view`/`at`
  answers per domain (all three for spec-source stagings; `occurrences`
  alone for 14.7/14.11/14.18).
  [Done 2026-08-13: all five rows landed, membership-only per the module
  header's matrix discipline (depth stays with T10.1-5, T6.6-6, T11.6-4,
  T12.2-2, T13.3-2/-3, T11.2-5/-6, T12.6-1/-2). (1) The 14.21 block gains
  the failing-workspace half — source edited to 14.1 after the corrupt
  session: `build` exactly {14.1}, `check` non-14.10 exactly {14.1, 14.21},
  `review status bad --json` and `review list --json` each exit 1 with the
  gate report exactly {14.1}, no 14.21 beside. (2) New 14.23 block: valid
  build, then `corruptGraphDataShapeBlind` (T6.6-6's shared staging);
  `inventory` exit 1 exactly {14.23} via a new scoped form-exact adapter
  `decodeInventoryFindings` (forms.ts, the decodeInventoryRecordedDatum
  pattern — pinned `findings` member literally decoded, every other member
  unread; S-5 DECODERS entry with conforming/old-shape/absent/null cases);
  `rename specs/a.mdx a1 a2 --preview --json` exit 1 exactly {14.23} via
  decodePreviewReport; `check` exactly {14.10: 1} (the unit form alone —
  never 14.23, no per-file finding beside on the clean workspace, no
  nonStale set-aside); `query nodes` exit 0 (reads leave the record
  unconsulted); `build` exit 0 then `check` exit 0 (the rebuild replaces
  the record). (3) `version` under the 14.14 workspace: exit 0 with a
  single JSON document (12.6 JSON-only) — never the configuration error.
  (4)+(5) Every sweep entry now carries an `answers` classification:
  spec-source stagings run `occurrences`/`view`/`at <file> 0` (offset 0 —
  resolution is total, 11.5), code-source stagings (14.7/14.11/14.18)
  `occurrences` alone, each answer decoded through the form-exact 12.7
  document decoders at exit 1 with the staged condition counted exactly
  like the build side (these surfaces never report 14.10); the
  no-domain-file entries (14.13/14.22) instead probe `query nodes` — exit 1,
  findings-only report, exactly the staged finding — while all three
  surfaces answer finding-free at exit 0 over the staged valid spec source.
  Title extended to the full entry; traceability unchanged (["14"] — 10.1/
  11.x/12.6/13.3/6.6 are carriage context with home coverage at their own
  tests, the FP-015/FP-018 precedent); no certification scope (T14-4 sits
  in CERTIFICATIONS.md's not-to-certify residue). Verified: typecheck/
  format clean; S-5 82/82 green incl. the new decoder's guards; suite
  section-14 unchanged 5 failed / 0 passed — every test red at its first
  FP-001-class form-exact decode, new arms suite-unreached; direct probes
  against the built product prove every new staging sound and every new
  arm red-as-diagnosed: the §11/12.6 surfaces and `--preview` are unknown
  commands/flags on this pre-patch product (exit 2 → diagnosed exit
  failures: inventory/preview/version/occurrences/view/at), the
  failing-side 14.21 commands report old-shape findings with conforming
  membership except `review status bad` which reports the corrupt session
  instead of the gate findings (a real behavioral gap the arm
  discriminates), the 14.22 staging's `query nodes` answers exit 0 instead
  of gating (the T13.3-3-diagnosed gate gap), the 14.13 gated read exits 1
  with the old-shape 14.13 naming the line, and the 14.23 staging's
  `check` reports exactly one old-shape 14.10 while `query nodes`/`build`/
  `check`-after exit 0 as the arms demand. `npm run test:self`: unchanged
  4 planned mid-loop reds (certification-document ×3 → FP-091; S-1's 7
  unmapped keys {11.2–11.6, 12.6, 12.7} → stage G), S-5 and certification
  green.]

## Stage G — §§10–14 missing tests (new-test convention applies)

CONF-AVAIL staging constraints (CERTIFICATIONS.md, binds the 11.x bodies
below): in-scope stagings drive only the enumerated surface — never `at`;
T11.2-4's record observations ride `occurrences`/`view`; T11.4-1 stages no
undefined datum. The six in-scope tests are marked (CONF-AVAIL) — they must
certify against FP-091's fixtures once those land.

- [x] FP-049 — Implement T10.1-5: failing-workspace gate precedence over
  session corruption, with the `check`-reports-14.21-beside-gate-findings
  discriminating pair. [R2 #1; TEST-SPEC §10.1] Registry
  `section-10.1.ts`; map `"10.1"` (+ `"14"`).
  [Done 2026-08-13: registered in section-10.1.ts with traceability
  ["10.1","14"]. One workspace in TEST-SPEC's staging order — valid build,
  audit session `cor`, T10.1-4's shape-independent garbage-bytes corruption,
  then specs/B.mdx overwritten to a childless `<S>` (exactly one 14.1, no
  masking interplay). A `build --json` gate-reference probe pins the gate's
  findings as exactly {14.1: 1} located in specs/B.mdx — the exact count
  doubling as condition 21's not-by-build half — then seven gated probes
  (`status`, `next`, `show`/`resolve --status updated`/`split` with an item
  ID no session ever held — judged only against session content, never
  reached, 12.0 — `export`, and `review list`) each assert exit 1, the
  form-exact 12.7 findings report holding exactly {14.1: 1} in specs/B.mdx
  (the exact multiset realizes "no condition-21 finding beside them"; the
  one-member decode realizes list's whole-report replacement, 10.7), inside
  whole-root modifies-nothing compares; `check` asserts 14.21 present and
  concerning `.xspec/reviews/cor.json` via the 12.7 path member together
  with the 14.1 (presence-based beside them — 14.10 detectability is
  T14-4's, the T13.3-3 precedent); a final byte-compare restates the
  corrupt session untouched across the sweep. No certification scope
  (CERTIFICATIONS.md Exclusions: T10.1-5 carries its own in-test
  check-vs-subcommand contrast). Verified: typecheck/format clean; suite
  section-10.1 went 3 failed/1 passed → 4 failed/1 passed — T10.1-5
  red-as-diagnosed at the first arm's FP-001-class form-exact decode
  ("expected no member \"condition\""); direct probes against the built
  product prove every arm sound and the deeper diagnosed gap real: the six
  naming subcommands open the corrupt session first and report the old-shape
  14.21 instead of the gate's findings (exactly the TEST-SPEC-named defect),
  while `list` gates correctly and `check` reports both conditions with
  `file` naming the session path, everything exit 1, nothing modified,
  cor.json bytes untouched. `npm run test:self`: unchanged 4 planned
  mid-loop reds (certification-document ×3 → FP-091; S-1's 7 unmapped keys
  {11.2–11.6, 12.6, 12.7} → stage G), S-5 and certification green.]

- [x] FP-050 — Implement T11.2-1: parse-local structure and per-file
  masking with no writes. [R2 #2; TEST-SPEC §11.2] New registry module(s)
  for §11.2 (+ suite wrapper, index import); map `"11.2"`.
  [Done 2026-08-13: registered in the new registry module section-11.2.ts
  (SUITE-52; wrapper + index spread) with traceability ["11.2"] (T11.2-1 in
  no TEST-SPEC 14 staging record — the FP-016 precedent; no certification
  scope — CERTIFICATIONS.md's Exclusions carry only its answer-side no-write
  compares through the machinery VIOL-CORE-CHATTYREADS certifies). One
  workspace: A parseable with findings of both levels — `d={"nosuch"}`
  (14.5) and the `d={"top"}` self-cycle (14.9), the latter's spelling
  RESOLVING and recording its depends occurrence (positions survive
  findings, 11.2/5.7) — beside the dup pair (14.3), one-segment `ha#sh`
  (14.4), unknown prop (14.17), and `<div>` (14.16); B unparseable (14.20);
  C finding-free; a multi-byte prefix shifts every A offset (1.7). The
  `build --json` gate reference pins staging integrity: exit 1, exactly
  {14.3,14.4,14.5,14.9,14.16,14.17 ×1 located in A; 14.20 ×1 in B}
  (file-granular; range precision is T14-8's). Bare `view` (JSON-only:
  entire stdout one document, no `--json`) exits 1 with the same finding
  multiset — B's 14.20 accompanying — views exactly [A, C] (B contributes
  no view): A's full positional tree byte-exact over the pinned projection
  (identity three-state per 11.2 — dup bearers and ha#sh unavailable,
  top/top.kid/gone/solo defined; construct ranges; raw attribute entries
  name/range/text, unknown prop included; the div gets no node), comment
  ranges, and the complete two-record occurrence enumeration (5.7 spans:
  the d string literal; the whole embedding container); C's view complete,
  empty lists as []. Tag-range decompositions and interpreted tags/coverage
  stay outside the projection (T11.4-1, T11.2-2/T11.4-3 homes — the form
  decode still validates their forms). Failing-side `occurrences` (same
  findings, same records, exit 1) and `at C 0` (finding-free, exit 0, root
  resolution — the per-file domain contrast) ride per T11.2-6's stated
  delegation; every invocation (gate build included) sits in a whole-root
  assertLeavesUnchanged compare — never-built workspace, so any graph-data
  or derived write surfaces. New form-exact machinery: full
  `decodeViewReport` in adapters/forms.ts (node/attribute/import/
  occurrence/comment forms, `--text` conditional presence, identity/text
  never null, attribute text byteLength = range length, document orders and
  per-file record-file equality enforced) with ViewNode/FileView/ViewReport
  model types and COVERAGE_ATTRIBUTE_VALUES; S-5 gains two DECODERS entries
  (with/without `--text`) — 86/86 green. Verified: typecheck/format clean;
  suite section-11.2 red-as-diagnosed at the first arm's FP-001-class
  form-exact decode ("expected no member \"condition\"" on the gate build;
  view/occurrences/at are unknown commands on this pre-patch product —
  further diagnosed exit failures once that closes); a direct probe of the
  staged fixture against the built product returned exactly the expected
  old-shape condition multiset; a scratch conforming fake product (deriving
  every range independently from the workspace bytes) ran the registered
  body green end-to-end, and three deviation fakes (cycle occurrence
  dropped; masked B served a view entry; view writing graph data) each
  failed diagnosed — expectations satisfiable, assertions toothed. `npm run
  test:self`: 4 planned mid-loop reds (certification-document ×3 → FP-091;
  S-1's unmapped keys narrowed 7 → 6, now {11.3, 11.4, 11.5, 11.6, 12.6,
  12.7} → stage G), S-5 and certification green.]
- [x] FP-051 — Implement T11.2-2 (CONF-AVAIL): spelled-identity /
  interpreted-data definedness matrix. [R2 #2, R3 gap 1, VERIFY; TEST-SPEC
  §11.2]
  [Done 2026-08-13: registered in section-11.2.ts (SUITE-52) with
  traceability ["11.2"] (no TEST-SPEC 14 staging record — the FP-050
  precedent). CONF-AVAIL in scope (VIOL-AVAIL-NULLMARKER and VIOL-AVAIL-OMIT
  certify it; the fixture family lands with FP-091), and its scope
  constraint is honored: NO gate-reference `build` — CERTIFICATIONS.md pins
  every command an in-scope test drives to the enumerated `view`/
  `occurrences` surface — so staging integrity rides the `view` answer's own
  exact findings multiset, the staged conditions drawn from the scope's
  stated set. One file (specs/M.mdx, multi-byte prefix), bare `view`, exit 1,
  full tree projection (identity/range/raw attribute entries per node PLUS
  this test's tags/coverage datums; `datumLeaf` defaults pin the absent-prop
  defaults — tags [] never null, coverage "required" — on every propless
  section; root the stated null/null): solo defined (+`coverage="none"` as
  the defined non-default value); repeated agreeing (`ragree` x2) and
  disagreeing (`rone`/`rtwo`), braced `id={"x"}`, valueless `id` each
  unavailable (14.17, never 14.1); no-`id` section (14.1) with child
  `orphan` (14.2 masked) AND grandchild `orphan.deep` — the deep arm
  discriminates a product checking only the immediate parent's spelling;
  duplicate `x` pair both unavailable (one 14.3 locating both) with `x.y`
  defined beneath one (defined without defined prefixes); `ha#sh` (14.4)
  with structurally-consistent child `ha#sh.kid` (own 14.4 — extending a
  malformed identity cannot avoid its segments; deliberately no 14.2
  anywhere, a condition outside CONF-AVAIL's stated set); unique `z` defined
  beside braced `id={"z"}` (contests nothing — a value-reading product
  fails the tree compare AND the count map via a second 14.3); tags matrix
  `tr`/`tm`/`ti` (repeated/braced/invalid tag `bad#tag` 14.4) and coverage
  matrix `cr`/`cm`/`ci` (repeated-agreeing/valueless/`"maybe"`) each
  interpreted-unavailable with raw spellings listed and identities STAYING
  defined (tags/coverage invalidity never undefines identity). Exact
  findings {14.1:1, 14.3:1, 14.4:3, 14.17:10 — one per afflicted element},
  every finding located in M (file granularity; range precision T14-8's);
  imports/occurrences/comments []. Verified: typecheck/format clean; suite
  section-11.2 red-as-diagnosed — T11.2-2 fails at the exit assertion
  (`view` unknown command, exit 2, the pre-patch product gap); scratch
  probe: a conforming fake re-deriving the 11.2 rules independently from the
  workspace bytes ran the registered body green end-to-end (expectations
  satisfiable, findings order accepted), and four deviation fakes each
  failed diagnosed — markers-as-null at the identity-datum decode (exactly
  VIOL-AVAIL-NULLMARKER's certified failure), take-last-value and
  no-inheritance at the tree compare, invalid-forms-contest at the count
  map (assertions toothed). `npm run test:self`: unchanged 4 planned
  mid-loop reds (certification-document x3 → FP-091; S-1's 6 unmapped keys
  {11.3–11.6, 12.6, 12.7} → stage G), S-5 and certification green.]
- [x] FP-052 — Implement T11.2-3: invalid paths (Linux leg). [R2 #2;
  TEST-SPEC §11.2]
  [Done 2026-08-13: registered in section-11.2.ts (SUITE-52) with
  traceability ["11.2"] (no TEST-SPEC 14 staging record — the FP-050/051
  precedent; 12.0/12.7/5.7/1.5 are context with home coverage at T12.0-13/
  T12.7-1/T11.3-1). NOT in CONF-AVAIL scope (its staging — `#` paths,
  non-UTF-8 path, a code group — lies outside that scope by construction),
  so the gate `build --json` rides staging integrity: exit 1 with EXACTLY
  the 14.19 multiset (every file's content deliberately condition-free, so
  later identity unavailability is attributable to the paths alone), each
  finding pinned as {code "invalid-source-path", locations [], concerned
  path} in the 12.7 order, wrapped in a whole-root snapshot compare. One
  workspace: valid `specs/OK.mdx` (the defined-side contrast and reference
  target), `specs/a#b.mdx` (nested pa > pa.kid with a tags attribute),
  Linux-staged `specs/b<0xFF>.mdx` (raw-byte filename via workspace.file;
  the T1.5-2 arm-gating precedent for the entry's leg note — the `#` arms
  run everywhere, every expectation parameterized on the staging, no test
  skip, H-9), and `src/co#de.ts` (multi-byte comment prefix; one
  text(SPEC.ok) call inside named unit useText, one bare top-level marker).
  Answers: bare `view` → exit 1, per-file views [OK, a#b, b<0xFF>] in path-
  byte order with the non-UTF-8 `file` member as the marked byte form
  composed from the staging bytes, findings EXACTLY the two spec-path 14.19s
  (the code source's concerns no domain file — the accompanies-and-no-other
  discrimination), trees pinned via T11.2-1's projection (OK defined; every
  invalid-path node identity, root included, the marker); bare `occurrences`
  → exit 1, all three 14.19s, enumeration exactly the code source's two
  records ({file, range, kind, target} present, source exactly the marker);
  `at specs/a#b.mdx` at 0 and at the kid offset → exit 1, exactly its own
  14.19, resolution root/innermost with identity the marker. "No identity
  over an invalid path is ever emitted" realized as exact-value pinning of
  every identity datum in every captured document. Verified: typecheck/
  format clean; suite section-11.2 red-as-diagnosed — T11.2-3 fails at the
  gate build's FP-001-class form-exact decode ("expected no member
  \"condition\""; the pre-patch product does fire exactly 3x 14.19 in the
  old shape on a direct probe, the old order matching the pinned one, and
  view/occurrences/at stay unknown commands); scratch probe: a conforming
  fake re-deriving every answer from the workspace bytes (own mini-parser,
  byte-wise discovery, hex from real dirent bytes) ran the registered body
  green end-to-end, and five deviation fakes each failed diagnosed —
  null-for-marker at the form decode (VIOL-AVAIL-NULLMARKER's class),
  identities-emitted-over-invalid-paths at the a#b tree compare,
  all-findings-attached at the view domain compare, lossy-plain-string
  non-UTF-8 path at the build projection, source-undefined-records-dropped
  at the enumeration compare. `npm run test:self`: unchanged 4 planned
  mid-loop reds (certification-document x3 → FP-091; S-1's 6 unmapped keys
  {11.3–11.6, 12.6, 12.7} → stage G), S-5 and certification green.]
- [x] FP-053 — Implement T11.2-4 (CONF-AVAIL): resolution and expanded-text
  poisoning; record observations ride `occurrences`/`view`. [R2 #2, R3 gap
  1, VERIFY; TEST-SPEC §11.2]
  [Done 2026-08-13: registered in section-11.2.ts (SUITE-52) with
  traceability ["11.2"] (no TEST-SPEC 14 staging record — the FP-050..052
  precedent; 11.3/11.4/5.7/1.6/3/12.7 are context with home coverage at
  T11.3-1/T11.4-5/T5.7-*/T12.7-1). CONF-AVAIL in scope (VIOL-AVAIL-
  NULLMARKER and VIOL-AVAIL-OMIT certify it; the fixture family lands with
  FP-091); scope constraints honored: the whole entry drives ONLY bare
  `view` (with/without --text) and bare `occurrences` — no gate `build`, no
  `at`, no `--file` — staging integrity riding each answer's own exact
  findings multiset, conditions drawn from the scope's stated set. Four
  stagings: (1) specs/R.mdx — duplicate `a` bearers with unique `a.b`
  beneath the first; `d={"a.b"}` on the second bearer and `{text("a.b")}`
  in an id-less section each resolve and record with `source` EXACTLY the
  marker (file/range/kind/target present) — pinned as the complete
  two-record enumeration via BOTH surfaces (never a picked bearer, never a
  dropped record, never an unavailable target — the form decode also admits
  only plain-string targets) — while `d={"a"}` records none, its 14.5
  located within the opening tag spelling it; findings exactly {14.1, 14.3
  locating BOTH bearers, 14.5}, the view tree positioning every enclosing
  construct with identities per 11.2. (2) chain CH-A embeds CH-B embeds
  CH-C with `{text("nosuch")}` in C: bare `view --text` — exactly one 14.6,
  its location's range EXACTLY the braced container (SPEC 14 pins the
  embedding form); top/mid/deep own+subtree text EXACTLY the marker,
  sibling side (expansion inserted) and ok byte-exact, every root's own
  text defined beside its poisoned subtree text; imports/occurrences/
  comments pinned whole. (3) separately staged self-embedding cycle CY.mdx:
  `{text("self")}` resolves and records (occurrence pinned), exactly one
  14.9 located at the participating spelling, self poisoned, calm and the
  root's own text defined byte-exact. (4) removal-by-form: IMP.mdx with an
  unused-binding import of GONE.xspec plus a stray <div> (14.16, located,
  preserved byte-for-byte in the enclosing text, no view node); after
  fsp.rm(GONE.mdx) the SAME pinned tree asserts text values byte-identical
  (the import removed by form) while the import entry's target flips to the
  marker and 14.15 (located at the declaration) joins 14.16 — exact counts
  both sides, exit 1 everywhere. Expected text values hand-derived per the
  rules of 3 (derivation comments beside each constant), composed from the
  staged parts. Verified: typecheck/format clean; suite section-11.2
  red-as-diagnosed — T11.2-4 fails at the first arm's exit assertion
  (`view` unknown command, exit 2, the pre-patch product gap); scratch
  probe: a conforming fake re-deriving every answer from the workspace
  bytes (own mini-parser, line-attribution rules-of-3 renderer with
  expansion-stack cycle detection) ran the registered body green
  end-to-end, and six deviation fakes each failed diagnosed —
  null-for-marker at the form decode (VIOL-AVAIL-NULLMARKER's class),
  picked-bearer and dropped-record at the enumeration compare,
  partial-expansion at the poisoned-tree compare, remove-imports-by-
  resolution at the after-deletion pinned tree, ambiguous-ref-resolves at
  the count map; direct `build --json` probes of all four stagings against
  the built product confirm the staged conditions fire in a real parser
  (14.3+14.1; 14.6; 14.9; 14.16 then 14.15+14.16 — no 14.20 anywhere; the
  absent 14.5 is exactly the pre-patch resolution-semantics gap the arm
  discriminates). `npm run test:self`: unchanged 4 planned mid-loop reds
  (certification-document x3 → FP-091; S-1's 6 unmapped keys {11.3–11.6,
  12.6, 12.7} → stage G), S-5 and certification green.]
- [x] FP-054 — Implement T11.2-5: domain/findings/exit discipline. [R2 #2;
  TEST-SPEC §11.2]
  [Done 2026-08-13: registered in section-11.2.ts (SUITE-52) with
  traceability ["11.2"] (no TEST-SPEC 14 staging record — the FP-050..053
  precedent; T14-4's and T11.5-2's citations are cross-references TO it;
  11.3–11.5/12.0/12.7 context with home coverage at T11.3-*/T11.4-*/
  T11.5-*/T12.0-13/T12.7-3). NOT in CONF-AVAIL scope — CERTIFICATIONS.md
  lists T11.2-5 expressly under Exclusions — so gate `build`, `at`, and
  `--file` all free. Two workspaces. (1) T11.2-1's A/B/C reused beside a
  discovered reference-free src/app.ts under a spec+code config (the
  wrong-kind operand; adds no finding): gate `build --json` pins the exact
  T11.2-1 multiset; `view C` → exit 0, findings [], C's complete view (the
  domain is the requested files while A/B stay invalid); `view A` → exit 1,
  findings EXACTLY A's six of both levels all located in A (B's 14.20
  excluded by exactness), full answer still emitted (views [A]: tree,
  comments, occurrences, imports pinned); then the five
  argument-checks-precede-answering arms on the failing workspace — unknown
  `view` operand, wrong-kind `view src/app.ts`, outside-root `occurrences
  --file ../…`, malformed `occurrences --to specs/A.mdx#a..b` (empty
  segment), out-of-range `at specs/A.mdx <len+1>` — each exit 2 via a new
  expectAvailabilityUsageError (JSON-only surfaces: bare invocation, single
  12.7 error document as entire stdout, stderr message present; per-surface
  matrices stay at T11.3-2/3, T11.4-2, T11.5-2). (2) cycle pair D/E (mutual
  external `d` references — the external form forces mutual imports, so the
  staged set is EXACTLY two 14.9s: dependency cycle + spec import cycle,
  each jointly violated) beside finding-free C: gate pins {14.9: 2} with
  each finding's full path — two locations, one per file, windows the
  import declarations resp. the opening tags (disjoint ordered windows pin
  the 12.7 finding order import-first); `view D` and `view E` each assert
  both findings WHOLE (the out-of-domain participant's location included)
  plus the participant's complete view (identities defined — cycle never
  undefines; import entry resolved; the resolving `d` occurrence recorded);
  `view C` → exit 0, findings [] (no participant in domain). Both
  workspaces wrapped in whole-root snapshot compares (hygiene; no-write
  contract stays T11.2-1/-6's). Verified: typecheck/format clean; suite
  section-11.2 red-as-diagnosed — T11.2-5 fails at the ws1 gate build's
  FP-001-class form-exact decode ("expected no member \"condition\"");
  scratch probe: a conforming fake re-deriving every answer from the
  workspace bytes (own config parse, glob discovery, MDX-lite parse with
  byte offsets, 11.2 definedness, resolution/occurrences, Tarjan SCC over
  contains+depends+embeds and over the import graph, 12.7 forms and order,
  per-domain attachment, argument checks) ran the registered body green
  end-to-end, and five deviation fakes each failed diagnosed — attach-all
  at `view C`'s exit-0 (domain discipline), truncate-joint at the
  whole-cycle location count (accompanies-whole), answer-past-usage at the
  unknown-file exit-2 (precedence), withhold-answer at the views-[A] pin
  (full answer), exit-zero at `view A`'s exit-1; direct `build --json`
  probes against the built product confirm both stagings fire in a real
  parser — ws1 exactly the staged multiset per home file, ws2 exactly two
  14.9s whose old-shape messages name the import cycle and the dependency
  cycle paths (and whose import-declaration location 45..70 independently
  corroborates the ByteFixture arithmetic); view/occurrences/at stay
  unknown commands (exit 2) pre-patch. `npm run test:self`: unchanged 4
  planned mid-loop reds (certification-document x3 → FP-091; S-1's 6
  unmapped keys {11.3–11.6, 12.6, 12.7} → stage G), S-5 and certification
  green.]
- [x] FP-055 — Implement T11.2-6: never-stale + gate-findings-never-attach.
  [R2 #2; TEST-SPEC §11.2]
  [Done 2026-08-14: registered in section-11.2.ts (SUITE-52) with
  traceability ["11.2"] (not in TEST-SPEC 14's staging record — 14.13's
  home is T6.1-3/T13.4-6, 14.22's T13.4-6; T14-4's and T13.3-3's citations
  are cross-references TO it). NOT in CONF-AVAIL scope — expressly an
  Exclusions entry (its answer-side no-write compares lean on the
  compare-around machinery certified via VIOL-CORE-CHATTYREADS). The
  entry's delegations honored: passing-side refresh participation stays
  T13.3-2's sweep, failing-side answering T11.2-1's, gated-read breadth
  over these fixtures T13.3-3's whole-gate arms (already landed pre-plan),
  and the occurrences/at finding-free contrast T13.3-3's never-gated sweep
  + T14-4's availability rows — this test owns the two fixtures and the
  view never-attach arm with the build/check surfacing. Fixture 1: passing
  build, then one garbage line at .xspec/journal (T12.2-2-family-7/T14-4
  staging) — `build --json` exactly {14.13: 1} concerning .xspec/journal,
  failing build modifies nothing; `check --json` the same counted over
  non-14.10 findings (the T12.2-2 set-aside: the journal feeds canonical
  identities, 5.4, so graph-data verifiability beside an unreadable
  journal is underdetermined); `view specs/C.mdx` (module C fixture
  reused) → findings [], views exactly [C] with C_TREE pinned,
  imports/occurrences/comments [], exit 0. Fixture 2: passing build under
  `markdown.outDir: "mdout"` (premise-checked: mdout/ dir, emitted
  mdout/specs/C.md — T13.3-3's arm-2 discipline), then the outDir
  directory replaced by a plain file — `build --json` exactly {14.22: 1}
  concerning `mdout`, refusal before any write; `check --json` exactly
  {14.10: 1, 14.22: 1} (valid sources make the swap-deleted emission
  DEFINITE per-file staleness — the T12.2-2 exactness position — pinning
  the swap's whole fallout; paths pinned: mdout, mdout/specs/C.md); `view`
  of the very file whose emission path is obstructed → finding-free
  complete exit 0. Every invocation under whole-root snapshot compares.
  Verified: typecheck/format clean; suite section-11.2 red-as-diagnosed —
  T11.2-6 fails at the fixture-1 gate build's FP-001-class form-exact
  decode ("expected no member \"condition\""); direct probes against the
  built product confirm the stagings fire in the real product (fixture 1:
  build/check exit 1 with exactly one old-shape 14.13 naming
  .xspec/journal and NOTHING stale beside on the pre-built workspace,
  everything unmodified; fixture 2: premise build emits mdout/specs/C.md,
  the obstructed build/check exit 70 — the pre-patch vets-no-components
  gap FP-018 also observed — and `view` stays an unknown command, exit 2);
  scratch run of the registered body against a conforming fake
  (re-deriving journal/obstruction/staleness findings and the C view from
  workspace bytes) green end-to-end, five deviation fakes each failing
  diagnosed — attach-gate at the view arm's exit-0, drop-path at the
  14.22 concerned-path pin, answer-stale at the C_TREE compare (current
  sources, not cache), write-on-view at the whole-root compare,
  miss-stale at check's exact count map. `npm run test:self`: unchanged 4
  planned mid-loop reds (certification-document x3 → FP-091; S-1's 6
  unmapped keys {11.3–11.6, 12.6, 12.7} → stage G), S-5 and certification
  green.]

- [x] FP-056 — Implement T11.3-1: `occurrences` enumeration in the
  form-exact 12.7 record form. [R2 #3; TEST-SPEC §11.3] New §11.3 registry
  module; map `"11.3"`. Uses FP-001's literal decode.
  [Done 2026-08-14: registered in new section-11.3.ts (SUITE-53; wrapper
  section-11.3.test.ts; spread into registry/index.ts) with traceability
  ["11.3"] (no TEST-SPEC 14 staging record — the FP-050..055 precedent;
  5.7/11.2/12.7 are context with home coverage at T5.7-*/T11.2-3/-4/
  T12.7-1); no certification scope. The entry's fixtures are imported,
  never copied: section-5.7.ts and section-11.2.ts now export their staging
  constants and expectation tables (export-only edits, bodies untouched;
  the T5.7-1/T5.7-4 unit tables carry a stated order contract — listed in
  occurrence order — that this test expands by position). Per fixture, the
  COMPLETE record sequence is asserted PER INDEX in occurrence order
  through bare `occurrences` (JSON-only; decodeOccurrencesReport enforces
  the exact five-member 12.7 record form, the never-null source datum, and
  the 5.7 comparator): T5.7-1's eleven records as identity-level tuples
  (both duplicate pairs adjacent — T5.7-1 pins the same multiset
  order-free, this test adds the order), T5.7-2's six with byte-precise
  own ranges, T5.7-3's six via full-record equality (every 5.7 datum
  byte-precise), T5.7-4's three resolving spellings (exit 1, staging
  integrity as the exact {14.5,14.6,14.7,14.8} count map); the
  unavailability arms restage T11.2-3's code source (OK.mdx + src/co#de.ts:
  findings exactly one 14.19 pinned {code invalid-source-path, locations
  [], path src/co#de.ts}, enumeration exactly CS_EXPECTED_OCCURRENCES) and
  T11.2-4's resolution matrix (R.mdx: counts {14.1,14.3,14.5}, enumeration
  exactly R_EXPECTED_OCCURRENCES) — `source` exactly the marker,
  file/range/kind/target present, never a picked bearer, never a dropped
  record. The body re-earns every imported claim before any product
  invocation: slice self-checks over all claimed ranges (SPAN/ORD/CS/R)
  plus claimed-sequence sortedness checks under the pinned comparator.
  Verified: typecheck/format clean; scratch probes (deleted): the
  T5.7-1/T5.7-4 tuple orders proven against mechanically derived spelling
  byte positions, and against the built product the six stagings fire as
  diagnosed (arms 1–3 build exit 0; arm 4 exactly {14.5,14.6,14.7,14.8}
  old-shape; arm 5 exactly one 14.19 naming co#de.ts; arm 6 {14.1,14.3} —
  the absent 14.5 is FP-053's diagnosed pre-patch resolution gap); suite
  section-11.3 red-as-diagnosed at the first arm (`occurrences` unknown
  command, exit 2, the pre-patch product gap; every self-check passes
  first); sections 5.7/11.2 unchanged (4 resp. 6 diagnosed reds). `npm run
  test:self`: 4 planned mid-loop reds with S-1's unmapped set narrowed
  6 → 5 keys, exactly {11.4, 11.5, 11.6, 12.6, 12.7} ("11.3" now mapped;
  certification-document ×3 → FP-091), S-5 and certification green.]
- [x] FP-057 — Implement T11.3-2: `--file` set restriction. [R2 #3;
  TEST-SPEC §11.3]
  [Done 2026-08-14: registered in section-11.3.ts (SUITE-53) with
  traceability ["11.3"] (no TEST-SPEC 14 staging record — the FP-056
  precedent; 11.1/11.2/12.0 are context with home coverage at
  T11-*/T11.2-*/T12.0-*); no certification scope (CERTIFICATIONS.md
  Exclusions name T11.3-2's matrix explicitly; CONF-AVAIL's in-scope set
  excludes it). Two self-owned fixtures. (1) A failing spec+code workspace —
  one 14.5 in specs/apple.mdx (beside a resolving reference INTO the
  excluded file and a local embedding), one 14.3 in specs/beta.mdx (beside
  a resolving local `d`), one 14.8 in src/app.ts (string-form `text` beside
  a resolving marker), plus an UNDISCOVERED unparseable decoy docs/note.mdx
  in no configured group — gate `build --json` pins the exact multiset and
  per-file homes first; then, inside one whole-root modifies-nothing
  compare: `--file "**/ap*"` (one glob admitting spec and code alike) →
  exit 1, findings exactly {14.5,14.8} located in the admitted files (never
  beta's 14.3, never a phantom 14.5 for the cross-boundary reference —
  resolution is workspace-wide, the domain restricts consultation), records
  exactly the admitted files' three tuples per index; complementary literal
  glob `specs/beta.mdx` flips the domain (exactly {14.3}, exactly beta's
  record); empty-set arms `docs/*.mdx` (matches the on-disk decoy, no
  DISCOVERED file — a filesystem-globbing product surfaces the decoy's
  14.20) and `nosuch/**/*.mdx` → each `{"findings":[],"occurrences":[]}`
  exit 0, no unknown-file usage error, whatever findings the workspace
  carries; outside-root arms `../elsewhere/**/*.mdx` and
  `specs/../../evil/*.mdx` → exit 2 via T11.2-5's usage-error protocol
  (single 12.7 error document, stderr message), newly exported from
  section-11.2.ts (export-only edit) for the per-surface matrices. (2) A
  valid conjunction workspace (P→x, P→y, Q→x): `--file specs/P.mdx` alone →
  P's two records; `--to specs/T.mdx#x` alone → the two x-targeting
  records; both → exactly the one-record intersection — each filter alone
  admits more, so union or either-alone fails the exact per-index compares;
  all exit 0 finding-free after the buildOk premise. Verified:
  typecheck/format clean; suite section-11.3 red-as-diagnosed — T11.3-2
  fails at the gate build's FP-001-class form-exact decode ("expected no
  member \"condition\"", the 14.5 leading), T11.3-1's known red unchanged;
  direct probes against the built product prove the stagings (ws1 build
  exit 1 with exactly the three old-shape findings in the right files,
  BETA.far resolving, decoy contributing nothing; ws2 build exit 0 with
  exactly the three depends edges; `occurrences` still unknown, exit 2 —
  the pre-patch gap); scratch run (deleted) of the registered body against
  a conforming fake deriving ranges from workspace bytes green end-to-end,
  six deviation fakes each failing at exactly the targeted arm —
  ignore-`--file` and whole-workspace-findings at the subset-domain
  assertions, unknown-file-error and filesystem-globbing at the empty-set
  arm, union at the conjunction's intersection compare, no-escape-check at
  the outside-root exit-2 arm. `npm run test:self`: unchanged 4 planned
  mid-loop reds (certification-document ×3 → FP-091; S-1's 5 unmapped keys
  {11.4, 11.5, 11.6, 12.6, 12.7} → stage G), S-5 and certification green;
  sections 5.7/11.2 unchanged (4 resp. 6 diagnosed reds).]
- [x] FP-058 — Implement T11.3-3: `--to` syntactic acceptance / malformed
  spellings. [R2 #3; TEST-SPEC §11.3]
  [Done 2026-08-14: registered in section-11.3.ts (SUITE-53) with
  traceability ["11.3"] (no TEST-SPEC 14 staging record — the FP-056/057
  precedent; 1.4/1.5/12.0/12.7 are context with home coverage at
  T1.4-*/T1.5-*/T12.0-*/T12.7-*); no certification scope (Exclusions name
  T11.3-2/3's matrices). Two self-owned fixtures. (1) The acceptance ground
  (failing on purpose; specs-only config): OK.mdx holds the domain's ONE
  resolving occurrence (`use`→`ok`) so every empty selection is provably the
  filter's doing (pinned by a bare-enumeration staging arm); the three
  non-resolving grounds each carry a spelling a mis-implemented product
  would resolve INTO — broken.mdx (14.20; sibling `hidden` +
  `hiddenUse d={"hidden"}` complete before the unclosed final tag, so an
  error-recovering product serves the record), dup.mdx (14.3 twin pair +
  `watcher d={"twin"}` → 14.5, so a winner-picking product serves it), and
  the undiscovered docs/other.mdx (valid `x` + `xuse d={"x"}` in no group,
  so a filesystem-resolving product serves it). Gate `build --json` pins
  {14.20,14.3,14.5} with homes; the five accepted arms (`path#id` nosuch,
  bare-path no file, undiscovered, masked, undefined bearer) each assert
  exit 1 — never an error, the T12.0-9 partition's stated exception — with
  the domain's findings as the exact multiset and occurrences exactly [];
  the six malformed arms (two `#`, `#ok` empty path, `ok..use` empty
  segment, `ok use` whitespace, `then` forbidden, trailing `OK.mdx#`) ride
  T11.2-5's exported usage-error protocol on the same failing workspace,
  each defect spelled over the DISCOVERED OK.mdx path where the form allows
  (TEST-SPEC's `a#b..c`/`a#then`/`a.mdx#` give classes, not byte-exact
  operands — the FP-018 precedent) so a resolve-first product answers and
  fails the exit; all under one whole-root modifies-nothing compare. (2)
  The exact-selection ground (valid): BASE (top ⊃ top.sub) + USE staging
  four records (useTop's d AND embedding → top, useSub → top.sub, useRoot's
  module-form d={BASE} → root), all four pinned bare first; `--to #top` →
  exactly the two top-targeting records (both kinds, never the
  descendant's, never the root's), `--to #top.sub` → exactly the
  descendant's own, bare `--to specs/BASE.mdx` → exactly the module-form
  root record (T2.2-2), never the file's section-targeted ones. Verified:
  typecheck/format clean; suite section-11.3 red-as-diagnosed — T11.3-3
  fails at the gate build's FP-001-class form-exact decode ("expected no
  member \"column\""), T11.3-1/2's known reds unchanged; direct probes
  against the built product prove the stagings (ws1 build exit 1 with
  old-shape 14.20-in-broken + 14.3-in-dup — the absent 14.5 is FP-053's
  diagnosed pre-patch resolution gap, same as T11.2-4's; ws2 build exit 0
  with exactly the four staged dependency edges incl. the module-form root
  edge; `occurrences` still unknown, exit 2 — the pre-patch gap); scratch
  run (deleted) of the registered body against a conforming fake deriving
  findings/records/selection from workspace bytes green end-to-end, ten
  deviation fakes each failing at exactly the targeted arm — ignore-to,
  unknown-node-error, and findings-follow-to at the accepted arms,
  lenient-spelling at the malformed protocol, serve-picked/recover-masked/
  fs-resolve at their non-resolving arms, prefix-select and depends-only at
  the `#top` exact compare, file-select at the bare-path compare. `npm run
  test:self`: unchanged 4 planned mid-loop reds (certification-document ×3
  → FP-091; S-1's 5 unmapped keys {11.4, 11.5, 11.6, 12.6, 12.7} → stage
  G), S-5 and certification green.]
- [x] FP-059 — Implement T11.3-4 (CONF-AVAIL): definitive emptiness.
  [R2 #3, R3 gap 1 (VIOL-AVAIL-NOFILE certifies exactly this), VERIFY;
  TEST-SPEC §11.3]
  [Done 2026-08-14: registered in section-11.3.ts (SUITE-53) with
  traceability ["11.3"] (no numbered condition asserted — finding-free
  everywhere). IN CONF-AVAIL scope (VIOL-AVAIL-NOFILE certifies exactly it;
  fixtures land with FP-091), so the body obeys the scope's staging
  constraints exactly: spec-only workspace (imports + `d` + embedding), NO
  gate-reference `build` — the validity premise rides arm 1's own empty
  findings member (no `--file` → the whole discovered set's findings
  accompany, SPEC 11.2/11.3) — no snapshot compare (graph-data/refresh
  behavior expressly out of scope; both states valid, so a conforming
  product may refresh), and exactly two `occurrences` answers, both the
  empty enumeration `{"findings":[],"occurrences":[]}` exit 0 (the
  datum-form violators' stated passing ground). One workspace, one X
  (specs/target.mdx#tgt), evolved between the arms per the entry's single
  narrative: arm 1 bare `--to X` on a nonempty other-target ground
  (teammate.mdx's local `d` + embedding → its own `mate`; X's defining
  spelling unreferenced) → absolute emptiness — an ignore-`--to`,
  enumerate-the-domain, definition-as-record, or error-on-empty product
  fails here; then holder.mdx (import + `d={TGT.tgt}`, the workspace's ONE
  resolving occurrence of X) is staged and arm 2 runs `--to X --file
  "specs/t*.mdx"` — the glob admits exactly the nonempty {target, teammate}
  domain away from holder → still empty, finding-free, exit 0. The
  restricted arm carries NO in-test positive control by design (holder lies
  outside every domain the test observes — CERTIFICATIONS' stated hazard,
  certified through VIOL-AVAIL-NOFILE, whose whole-set enumeration serves
  holder's record exactly when successfully staged). Verified:
  typecheck/format clean; direct probes against the built product prove the
  staging (both states build exit 0 with findings []; the only edge into
  `tgt` is holder#user's depends edge; `occurrences` still unknown, exit 2
  — the pre-patch gap); suite section-11.3 red-as-diagnosed — T11.3-4 fails
  at arm 1's runJson (exit 2 unknown command), siblings' known reds
  unchanged (file 4 failed / 0 passed); scratch run (deleted) of the
  registered body: conforming fake (deriving records from workspace bytes)
  green end-to-end, the nofile deviation failing exactly at arm 2's
  exact-empty enumeration compare (the certified diagnosis), ignore-to /
  error-on-empty / definition-as-record each failing at arm 1's targeted
  assertion. `npm run test:self`: unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091, its in-scope-registry gap narrowed
  to exactly {T11.4-1, T11.4-3, T11.4-4}; S-1's 5 unmapped keys {11.4,
  11.5, 11.6, 12.6, 12.7} → stage G), S-5 and certification green.]

- [x] FP-060 — Implement T11.4-1 (CONF-AVAIL): whole-domain views and
  positional tree with tag-range decomposition byte-asserted; stages no
  undefined datum. [R2 #4, R3 gap 1, VERIFY; TEST-SPEC §11.4] New §11.4
  registry module; map `"11.4"`.
  [Done 2026-08-14: new module test/suite/registry/section-11.4.ts
  (SUITE-54) + wrapper section-11.4.test.ts, spread into registry/index.ts;
  traceability "T11.4-1": ["11.4"] (the T11.2-*/T11.3-* precedent: the
  answer-borne condition counts are staging integrity, 14.16's primary
  coverage stays T2.7-1's). IN CONF-AVAIL scope, so the body obeys the
  scope's constraints exactly: spec-only workspace, ONE command — the bare
  whole-domain `view` — NO gate-reference `build` (the validity premise
  rides the answer's own findings member), no snapshot compare, and NO
  undefined datum staged: every identity spelled, well-formed, conformant
  against its POSITIONAL parent, unique — the marker-free ground
  VIOL-AVAIL-NULLMARKER's passing side stands on, while the stated `null`s
  the answers do carry (root tags/coverage; self-closing/root decomposition
  members) are exactly what decodeViewReport rejects when omitted
  (VIOL-AVAIL-OMIT's certified failure; fixtures land with FP-091). One
  workspace, three files, whole document asserted: specs/Zebra.mdx (0x5A) <
  specs/alpha.mdx (0x61) < specs/sub/leaf.mdx (0x73) pins byte order
  against case-folding/locale collation and completeness (leaf is
  section-less — root-only view, a views-only-sectioned-files product
  drops it); Zebra pins the finding-free tree — paired sections at three
  depths, self-closing leaves at depths two and three, two top-level
  sections — per node construct range + decomposition (opening AND closing
  for paired, opening only = construct range for self-closing, neither for
  the root, whose range is the whole file) byte-asserted via the
  running-offset builder behind a multi-byte prefix, projection {identity,
  range, opening, closing, children} (attributes/tags/coverage VALUES stay
  T11.4-3's; the form-exact decode already enforces their presence/forms);
  alpha pins invalid-element parenting — wrap ⊃ wrap.mid ⊃ <div> ⊃
  wrap.mid.inner parents to wrap.mid (INNERMOST, never wrap/root) and a
  top-level <em> ⊃ free parents to the root — with exactly the two 14.16
  findings (no phantom 14.2; the chain conditions read the same enclosure,
  so every identity stays a defined plain string), each located within its
  own element's whole-construct window (div's ordered before em's, 12.7),
  exit 1 with the full answer; per-file imports/occurrences/comments []
  (nothing staged). Verified: typecheck/format clean; suite section-11.4
  red-as-diagnosed against the stub (HarnessAssertionError at the bare
  `view`: exit 2 "unknown command 'view'" where 1 is demanded — the whole
  §11 surface is patch-new); scratch run (deleted) of the registered body:
  conforming fake (deriving views/findings from workspace bytes) green
  end-to-end, ten deviation fakes each failing at the targeted assertion —
  outermost/rootparent/elementnode/noclosing/chainbreak at the tree
  compare, casefold at the decode's byte-order rejection, skipempty at the
  whole-domain file-list compare, omitroot at the decode's
  null-is-never-omission rejection (the OMIT anchor), utf16 at the
  finding's byte window, misjudge (phantom 14.2) at the exact findings
  count. `npm run test:self`: the 4 planned mid-loop reds narrowed as
  scheduled — certification-document ×3 → FP-091, its in-scope-registry
  gap now exactly {T11.4-3, T11.4-4}; S-1's unmapped keys now exactly
  {11.5, 11.6, 12.6, 12.7} → stage G — S-5 and certification green
  (certification.test.ts 17/17).]
- [x] FP-061 — Implement T11.4-2: operands-vs-restriction. [R2 #4;
  TEST-SPEC §11.4]
  [Done 2026-08-14: T11.4-2 appended to test/suite/registry/section-11.4.ts
  (module header extended); traceability "T11.4-2": ["11.4"] (the T11.3-2
  precedent: gate condition counts are staging integrity, no "14";
  12.0/7 parentheticals context). NOT in CONF-AVAIL scope — a named
  Exclusions entry (the domain-and-exit matrices) — so unlike T11.4-1 it
  drives the gate-reference `build --json` (staging integrity: exactly one
  14.3 in specs/bad.mdx, one 14.8 in src/app.ts — the T11.3-2 staging
  mirror — specs/dup.mdx finding-free, docs/note.mdx an on-disk unparseable
  decoy in NO configured group) and wraps the whole sweep in one
  assertLeavesUnchanged. Arms: operands assert membership via T11.2-5's
  exported usage-error protocol — a file existing nowhere, the on-disk
  undiscovered decoy (a filesystem-resolving product accepts it), and the
  discovered code source as wrong-kind (its own 14.8 notwithstanding —
  checks precede answering), each exit 2 with the single 12.7 error
  document; `--file` restricts — the decoy glob, a nothing-at-all glob, and
  the SAME `src/app.ts` spelling that just erred as an operand each answer
  `{"findings": [], "views": []}` exit 0 (the code arm is the sharp half:
  a product reusing 11.3's spec-and-code-alike filter carries the staged
  14.8 and exits 1); combining operand with `--file`, each part
  individually valid, exit 2; `view specs/dup.mdx specs/dup.mdx` → ONE
  view, findings [], exit 0 on the failing workspace (domain = requested
  files; positive control that empty answers are the filter's doing), the
  view's substance pinned at identity level (root + `#solo`; ranges/
  attributes stay T11.4-1/-3's). Verified: typecheck/format clean; staging
  premise probed against the built product (`build --json` reports exactly
  the one 14.3 in bad.mdx and one 14.8 in app.ts, old shape); suite
  section-11.4 red-as-diagnosed (T11.4-2 fails at the gate's FP-001-class
  form-exact findings decode — "expected no member \"condition\"" — arms
  unreached until that product gap closes; T11.4-1 unchanged at `view`
  unknown-command); scratch run (deleted) of the registered body:
  conforming fake (deriving findings/views from workspace bytes) green
  end-to-end, seven deviation fakes each failing at the targeted
  assertion — fsoperand/wrongkind at the operand exit-2 arms, fsglob/
  codeglob/wsfindings at the empty-answer arms, combine at the combining
  exit-2 arm, dupview at the decode's strictly-ascending views rejection.
  `npm run test:self`: unchanged 4 planned mid-loop reds
  (certification-document ×3 → FP-091, its in-scope-registry gap still
  exactly {T11.4-3, T11.4-4}; S-1's unmapped keys exactly {11.5, 11.6,
  12.6, 12.7} → stage G), S-5 and certification green.]
- [x] FP-062 — Implement T11.4-3 (CONF-AVAIL): raw attributes and per-node
  data with stated-`null` root `tags`/`coverage`. [R2 #4, R3 gap 1, VERIFY;
  TEST-SPEC §11.4]
  [Done 2026-08-14: T11.4-3 registered in section-11.4.ts (wrapper
  auto-declares; traceability `"T11.4-3": ["11.4"]` — T11.4-3 is in no
  TEST-SPEC 14 staging record, the T11.2-2 precedent). One workspace, two
  files, two invocations, inside CONF-AVAIL's staging constraints
  (spec-only `.mdx` workspace, no `build` gate, no snapshot compare,
  `view` alone — bare + one `<file>` operand — staged conditions 14.17
  only, within the scope's stated set): specs/attrs.mdx stages the
  five-attribute tag `<S id="dup" id="dup" note="mystery" {...extras}
  tags>` plus `<S id="cov" coverage={"none"}>`; the bare view asserts
  every raw attribute entry {name, range, text} byte-exactly in tag order
  (the repeated id's BOTH entries; the spread's name the stated null, its
  text the whole braced construct; the valueless bare-name tags), exactly
  five located 14.17 beside the view (inclusion by form, never an
  omission; no 14.1/14.16/14.2/14.3 beside), and per-node
  identity/tags/coverage in every legitimate state (unavailable: the
  repeated-id identity, the valueless tags, the braced coverage; plain:
  cov/ok identities, [] and ["solo"] tags, the absent-prop default
  "required" on the spread-bearing tag and "none"; the roots' stated
  nulls); the finding-free specs/clean.mdx named as an operand exits 0
  with root tags/coverage null — the no-finding, no-exit-1 root arm
  VIOL-AVAIL-OMIT's note names. Verified: typecheck/format clean; suite
  red-as-diagnosed at the first invocation (`view` unknown command, exit
  2 — the same product gap as T11.4-1); scratch run (deleted) of the
  registered body against a workspace-deriving conforming fake green
  end-to-end, nine deviation fakes each failing at the targeted
  assertion — nullmarker at the decode's never-null identity, omit at the
  decode's absent finding-`path` member, dropinvalid/spreadname at the
  attributes compare, takefirst/readbraced/nofinding at the exact 14.17
  count, rootmarker at the root-null tree compare, cleanmarker
  (operand-invocation-only misbehavior) at the exit-0 assertion.
  `npm run test:self`: unchanged 4 planned mid-loop reds, the
  certification-document in-scope-registry gap narrowed exactly
  {T11.4-3, T11.4-4} → {T11.4-4} (rest → FP-091; S-1's unmapped keys
  {11.5, 11.6, 12.6, 12.7} → stage G); S-5, S-7, and certification
  green.]
- [x] FP-063 — Implement T11.4-4 (CONF-AVAIL): imports datum. [R2 #4, R3
  gap 1, VERIFY; TEST-SPEC §11.4]
  [Done 2026-08-14: T11.4-4 registered in section-11.4.ts (wrapper
  auto-declares; traceability `"T11.4-4": ["11.4"]` — T11.4-4 is in no
  TEST-SPEC 14 staging record, the T11.4-3 precedent). One workspace, two
  files, one bare `view`, inside CONF-AVAIL's staging constraints
  (spec-only `.mdx` workspace, no `build` gate, no snapshot compare,
  `view` alone; staged condition 14.15 within the scope's stated set):
  specs/imports.mdx opens with the six-declaration matrix, one per line
  (the §2.1 byte-window discipline), the valid first declaration's
  multi-byte identifier `BÄSE` (Ä: 2 bytes) shifting every later byte
  offset off code-point/UTF-16 counts; then the side-effect-only,
  named-only (`{ part }`), and namespace-only (`* as ns`) forms each with
  the same valid resolving specifier, the valid-form default import of the
  undiscovered `./typo.xspec`, and the bare specifier `base.xspec` (a
  suffix-keyed resolver bait). Asserted as ONE exact six-entry imports
  compare: every declaration, valid and invalid, with its byte-exact range;
  `name` the default binding's identifier ("BÄSE"/"TYPO"/"BARE") or the
  stated null for the three no-default forms (never the marker — decode
  rejects; never `part`/`ns`); `target` turning on specifier form and
  discovery ALONE — the invalid binding forms carry the plain
  "specs/base.mdx" (name null beside a defined target) while typo/bare are
  the literal marker, never null (decode rejects — VIOL-AVAIL-NULLMARKER's
  certified failure names exactly these two). Exactly five located 14.15
  beside the view (one per invalid declaration, each within its own
  declaration's end-widened window, order decode-pinned), exit 1 with the
  full answer; both root-only trees byte-asserted, prose-only
  specs/base.mdx viewed with imports []. Verified: typecheck/format clean;
  staging premise probed against the built product (`build --json` reports
  exactly the five 14.15 in imports.mdx, old shape, at byte-exactly the
  ByteFixture declaration ranges — the Ä shift visible); suite
  red-as-diagnosed at the one invocation (`view` unknown command, exit 2 —
  the same product gap as T11.4-1); scratch run (deleted) of the registered
  body: workspace-deriving conforming fake green end-to-end, eight
  deviation fakes each failing at the targeted assertion — nullmarker at
  the decode's never-null target, omitname/omittags at the decode's
  absent-member rejections, namedname/collapse at the imports compare,
  dropfinding at the exact 14.15 count, cpranges at the finding-window
  byte assertion, exit0 at the exit-1 arm. `npm run test:self`: planned
  mid-loop reds narrowed 4 → 3 exactly as predicted — the
  certification-document in-scope-registry gate went GREEN (gap {T11.4-4}
  → {}), its two fixture-manifest gates stay red → FP-091; S-1's unmapped
  keys exactly {11.5, 11.6, 12.6, 12.7} → stage G; S-5, S-7, and
  certification green.]
- [x] FP-064 — Implement T11.4-5: `--text` expansion domain. [R2 #4;
  TEST-SPEC §11.4]
  [Done 2026-08-14: T11.4-5 registered in section-11.4.ts (wrapper
  auto-declares; traceability `"T11.4-5": ["11.4"]` — in no TEST-SPEC 14
  staging record, the T11.4-3/-4 precedent; NOT in CONF-AVAIL scope — the
  Exclusions name its consultation-domain negatives — so unlike its
  siblings it drives a `build --json` staging gate per workspace, the
  T11.4-2 precedent). Four workspaces, six views: (1) the chain A→B→C with
  X beyond the boundary — A embeds B#b, B holds an unresolved `d={"ghost"}`
  (14.5) and embeds C#c, C's `{text(X.dup)}` names X's duplicate pair
  (gate-proven staged) so the spelling records no occurrence (14.6, located
  exactly at the braced container) and X is never consulted: `view
  specs/A.mdx --text` carries exactly {14.5, 14.6} — deep findings in
  consulted-never-requested files, X's 14.3 accompanying NOTHING — views
  [A] alone with alpha poisoned, the embedding-free sibling and root own
  text byte-exact, the resolved embedding's record and import entry
  pinned; without `--text` the same request consults A alone — findings
  [], exit 0, tree/imports/occurrences flag-independent (the decode
  rejects text members absent the flag); (2) entry→loop where loop#l1
  self-embeds — the one 14.9 located at the participating container in
  consulted-never-requested loop.mdx, entry's reaching values poisoned;
  (3) main→gone (unparseable): the spelling into the masked file records
  nothing (occurrences []), `view specs/main.mdx --text` carries exactly
  main's own 14.6 — never the 14.20 — while requesting gone too attaches
  the 14.20 and gone still contributes NO view (views stay [main]), the
  import entry's target the plain path both times (discovery, not
  parseability); (4) `specs/vi#ew.mdx` requested as a bare operand (`#`
  has no delimiter role, 12.0) keeps its full view — every identity the
  marker, text values plain and byte-exact (expansion definedness turns on
  occurrence-recording spellings alone), the 14.19 with locations [] and
  the file as concerned path. Verified: typecheck/format clean; every
  hand-derived text constant and byte range probed byte-identical against
  the built product on passing twins (`query node` own/subtree text;
  scratch probe, deleted), and every staged finding multiset probed
  against the failing stagings — the current product picks a winner among
  X's duplicate bearers (no 14.6), reports one-location 14.3, a wide 14.9
  location, a narrow 14.6 range, and old-shape findings, all diagnosed
  product gaps the certified T11.2-4 semantics pin; suite red-as-diagnosed
  at the chain gate's form-exact findings decode ("expected no member
  \"condition\"" — the FP-001-class gap; the `view` surface itself is the
  T11.4-1-class unknown-command gap behind it), section-11.4 now 5 failed
  / 0 passed. `npm run test:self`: unchanged 3 planned mid-loop reds
  (certification-document fixture-manifest ×2 → FP-091; S-1's unmapped
  keys exactly {11.5, 11.6, 12.6, 12.7} → stage G); S-5, S-7, and
  certification green.]
- [x] FP-065 — Implement T11.4-6: byte classification reproducing compiled
  Markdown via the P-2 oracle (`test/helpers/oracles/markdown.ts`).
  [R2 #4; TEST-SPEC §11.4]
  [Done 2026-08-14: T11.4-6 registered in section-11.4.ts (wrapper
  auto-declares; traceability `"T11.4-6": ["11.4"]` — in no TEST-SPEC 14
  staging record, the T11.4-5 precedent; NOT in CONF-AVAIL scope: its
  emission loop needs the `markdown` configuration, expressly outside that
  scope's workspaces, so the gate-reference `build` and emitted-file reads
  are free). Two workspaces. (1) The finding-free emission loop:
  specs/host.mdx (import, paired/self-closing sections with `tags`+`d`
  props, single- and multi-line comments, external + local embeddings, a
  CRLF among LF terminators, multi-byte offsets) beside embedding target
  specs/parts.mdx (own local embedding — the expansion chains two levels);
  after the `build` gate (exit 0, emitting both .md files), one bare `view`
  (exit 0, findings []) byte-asserted whole — trees with decomposition and
  attribute entries, imports, occurrences (the `d` reference spanning its
  string literal inside the tag; both embedding containers spanning their
  whole {text(...)} expressions), comments — then the classification:
  module helper `assembleAnnotationSpans` builds every annotation span from
  the DECODED view alone (tag decompositions, imports, comments,
  embeds-occurrence containers), asserting attribute ranges inside their
  opening tag and the depends occurrence inside a tag span (subsumed
  annotation bytes) and the spans disjoint/in-bounds/non-empty, compared
  exactly to the staged span set; then `reproduceMarkdown` (byte-slices the
  staged source at the view's spans, feeds the S-6-vetted P-2 oracle,
  expansions = contribution-derived subtree-text constants per SPEC 1.6/3)
  must byte-equal BOTH emitted files via assertFileBytes. A fixture
  self-check proves oracle(staged spans) === the hand-derived expected .md
  constants before any product invocation. (2) The imperfect file:
  specs/imp.mdx stages exactly {14.6: a `{text("ghost")}` no-occurrence
  spelling; 14.16: `<em>stray content</em>`} beside a valid import,
  comment, and resolving embedding into specs/tgt.mdx, gate-pinned; `view
  specs/imp.mdx` (exit 1) asserts the em contributes NO tree node and
  ghost NO occurrence record, the 14.6's one location EXACTLY the full
  braced container (assertUnresolvedEmbedding — the T14-8 pin that keeps
  the classification exact), the 14.16 located within the em's construct
  window; the classification is re-assembled from the view PLUS the
  decoded 14.6 finding's range and compared exactly to the staged spans —
  view plus findings position every removable construct, the em's bytes in
  no span (content by form, SPEC 11.2). Verified: typecheck/format clean;
  scratch probe (deleted) against the built product — W1 builds exit 0
  with BOTH emitted files byte-identical to the hand-derived expectations
  and all three expansion constants equal to `query node` subtree text
  (the contribution derivation proven against the real §3 machinery), W2
  stages exactly the {14.6, 14.16} multiset with the 14.16 in-window while
  the current product locates the 14.6 at the string literal [130, 137)
  instead of the full container [124, 139) — the diagnosed FP-064-class
  range gap the amended SPEC 14 pins; suite red-as-diagnosed at arm 1's
  first `view` invocation (unknown command, exit 2 — the T11.4-1-class
  gap; the fixture self-checks and the staging build pass before it),
  section-11.4 now 6 failed / 0 passed. `npm run test:self`: unchanged 3
  planned mid-loop reds (certification-document fixture-manifest ×2 →
  FP-091; S-1's unmapped keys exactly {11.5, 11.6, 12.6, 12.7} → stage G);
  S-5, S-7, and certification green.]

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
