# FIX_PLAN — Phase 9 (test harness), third compliance determination of this re-descent

Planned 2026-09-03 from the round-3 compliance panel over the harness at 6b136ee
(branch `claude/xspec-ui-apis-4df8fa`, standing in for `patch/external-ui-apis`;
governing IP `specs/patches/0001-external-ui-apis.md`, Stage: Tested). Reviewer A
(TEST-SPEC.md §0–8) and reviewer B (§9–16): COMPLIANT. Reviewer C (§17–18 +
CERTIFICATIONS.md): one gap, S-2, planned below as two tasks. VERIFY: the Phase 9
required set is green (self-tests 345/345, every certification exact, CI
`harness-self` and `suite-windows` green); the suite is red only on T6.5-7 and
T6.5-9, both diagnosed product defects (the product does not remove an
origin-module import left without references; a `move` binds a pre-empted
identifier) — product work, out of Phase 9's scope, not planned here.

## Scope guard (Phase 9)

Every task is harness work under `test/` (plus `AGENTS.md` build/run knowledge).
Never touch `src/`; never change what any product-facing test observes. Harness
self-tests and certifications must stay green after each task; product tests may
stay red on the two diagnosed defects. Commands (AGENTS.md): `npm ci` if
`node_modules` is missing; `npm run typecheck`; `npm run format` then
`npm run format:check`; `npm run test:self` (self-tests + certification; the
certification runner's `FAIL` lines are violators' expected outcomes — read the
`×` lines and the `Tests` summary); a single self file runs as
`npx vitest run --config test/vitest.config.ts --project self test/self/<file>`;
the suite needs `npm run build` first. Commit as `sdg(phase-9): <imperative
summary>` ending with the trailer lines your spawn prompt relays; push with
`git push -u origin claude/xspec-ui-apis-4df8fa` (retry on network errors with
2s/4s/8s/16s backoff). Never merge or fetch `main`.

## The gap (reviewer C, Gap 1 — TEST-SPEC.md §17 S-2)

S-2 requires the workspace builder's scale vectors "at the suite's staged maxima —
a document nested at least at P-8's giant-nesting floor and one at the largest
document size the suite stages (deterministic fixtures and generator draws alike,
16), each read back byte-complete". The harness derives its "largest staged
document" in `test/self/staged-scale.ts` from the P-8 generators only:
`LARGEST_STAGED_INPUT_BYTES` = 196,830 (the 204-byte `specs/A.mdx` fuzz base plus
`MAX_MUTATIONS_PER_TRIAL` = 3 appended depth-4096 towers of `TOWER_BYTES` = 65,542
each), and `test/self/s2-workspace-builder.test.ts`'s second scale vector (line
~470) stages exactly that. But the deterministic fixture T1.3-7
(`test/suite/registry/section-1.3.ts`, lines ~538–585 and ~660–672) stages a far
larger file: `depthTower(DEPTH_FLOOR = 2048)` chains one-letter ids (`a`, `a.b`,
`a.b.c`, …, the innermost 4,095 characters), so its `specs/A.mdx` is
**4,225,030 bytes** — about 21× the S-2 vector. Verified in the planning round by
reproducing `depthTower`: per level k the opener is `<S id="` (7 bytes) + a
(2k−1)-byte id + `">\n` (3 bytes), then `deep.\n` (6 bytes), then `</S>\n` × D
(5 bytes each), so size = 9·D + D·(D+1) + 6 + 5·D = 4,225,030 at D = 2048; the
file is pure ASCII (bytes = characters), has 2,048 openers, 2,048 closers and
4,097 line feeds. The comments in `staged-scale.ts` (line ~45) and the S-2 vector
(line ~474) assert "every deterministic fixture is far smaller (the largest, T4.1's
~33 KiB own-text probe)" — false. Consequence: a writer truncating anywhere between
~197 KB and ~4.2 MB passes S-2 today. S-8 is not a gap (its synthetic answers —
~204 MB `view --text` blowup, `view` nested 8192 deep — exceed the answers T1.3-7
elicits: ~4.5 MB of `query subtree` rows, ~13 MB of `view`, depth 2048), but the
shared derivation must carry the corrected basis so the two gates cannot drift.

---

### Task 1 — `staged-scale.ts` carries the deterministic staged maximum (T1.3-7's tower) beside the generator maximum; S-8's pins realigned; false "far smaller" statements corrected

**Satisfies:** TEST-SPEC.md §17 S-2 ("the largest document size the suite stages
(deterministic fixtures and generator draws alike, 16)"), §17 S-8 ("over the inputs
the suite stages (deterministic fixtures and generator draws, 16, alike)"), §0 H-11
("every input the suite stages — deterministic fixtures and generator draws (16)
alike"); reviewer C Gap 1, remediation "make the staged-maximum derivation include
deterministic stagings (export T1.3-7's tower size/source, or compute it in
`staged-scale.ts`) … its shared derivation should carry the same corrected basis so
the two gates cannot drift".

**Files:** `test/suite/registry/section-1.3.ts` (exports only — no behavioral
change), `test/self/staged-scale.ts`, `test/self/s8-answer-scale-capacity.test.ts`,
`test/self/s2-workspace-builder.test.ts` (the minimal rebinding described in step 4
only — its prose and the new vector are Task 2), `AGENTS.md` (the "Staged-scale
gates" bullet).

**What is there now (at 6b136ee):**
- `staged-scale.ts` exports `GIANT_NESTING_FLOOR` (2048), `DEEPEST_STAGED_TOWER`
  (max of `NESTING_DEPTHS` = 4096), `TOWER_SOURCE`/`TOWER_BYTES`,
  `FATTEST_TERMINATOR`, `countLineFeeds`, `stagedSizeCandidates`,
  `LARGEST_BASE_FILE` (`specs/A.mdx`), `LARGEST_BASE_BYTES`,
  `LARGEST_STAGED_INPUT_BYTES` (196,830, generator-only) and
  `largestStagedDocument()` (base + 3 towers, built by concatenation). Its header
  says the derivation covers "the largest document any staged draw or deterministic
  fixture reaches" and line ~45 says every deterministic fixture is far smaller —
  both false for T1.3-7.
- `section-1.3.ts` keeps `DEPTH_FLOOR`, `DEPTH_SEGMENTS`, `interface DepthTower
  { source; ids }` and `depthTower(depth)` private (lines ~552–583); T1.3-7's `run`
  stages `depthTower(DEPTH_FLOOR).source` as `specs/A.mdx` through
  `TestWorkspace.create({ files })`. The registry index
  (`test/suite/registry/index.ts`) imports named symbols only (`section13Tests`),
  no `export *`, so new named exports collide with nothing; precedent:
  `section-16-p8.ts` exports `NESTING_DEPTHS`, `sectionTowerSource`, … for
  `staged-scale.ts`.
- `s8-answer-scale-capacity.test.ts` pins the constant in three tests: the
  derivation test (line ~146: `toBe(LARGEST_BASE_BYTES + MAX_MUTATIONS_PER_TRIAL *
  TOWER_BYTES)`, `> 190_000`, `< 200_000`, `largestStagedDocument().length`), the
  fixed-seed replay test (line ~169: `largestFile <= …` at ~190, `largestText < …`
  at ~205), and the capture gate (line ~697: `documentBytes > 500 *
  LARGEST_STAGED_INPUT_BYTES` at ~730 — 500 × 4,225,030 ≈ 2.1 GB would fail against
  the ~204 MB blowup, so that pin must stay bound to the generator maximum). Its
  header item 1 (lines ~11–15) and the section-1 comment (lines ~104–116) say the
  scale is derived "from the suite's own generators".

**Required outcome:**
1. `section-1.3.ts`: export `DEPTH_FLOOR`, `depthTower`, and the `DepthTower` type
   (keep their doc comments; nothing else changes — T1.3-7 observes exactly what it
   observed).
2. `staged-scale.ts` derives three quantities, each attained by a byte-exact,
   iteratively built document (names are suggestions):
   - the generator maximum — today's derivation and value, e.g.
     `LARGEST_GENERATED_INPUT_BYTES` (196,830) with `largestGeneratedDocument()`;
   - the deterministic maximum — `Buffer.byteLength(depthTower(DEPTH_FLOOR).source,
     "utf8")` = 4,225,030, e.g. `LARGEST_DETERMINISTIC_INPUT_BYTES` with
     `largestDeterministicDocument()` returning those bytes, and `DEPTH_FLOOR`
     re-exported (or exposed as the deterministic depth). The comment states why
     T1.3-7 is the largest deterministic staging (its file is quadratic in the
     depth because every id spells its ancestor chain) — keep a "next largest"
     statement (T4.1's ~33 KiB probe) only if you confirm it, e.g. by grepping
     `test/suite/registry/` for large `.repeat(` counts;
   - the suite's staged maximum — `LARGEST_STAGED_INPUT_BYTES = Math.max(generated,
     deterministic)` with `largestStagedDocument()` returning the larger document
     (today the deterministic one), so the name S-2's requirement text uses keeps
     meaning what it says. Rewrite the header and the line-~45 comment accordingly;
     delete the false "every deterministic fixture is far smaller" sentence.
3. `s8-answer-scale-capacity.test.ts`: (a) rebind the generator-specific pins —
   the closed-form `toBe`, the 190k/200k bounds, the generated document's length,
   both replay bounds, and the 500× blowup pin — to the generator names; (b) extend
   the derivation test with the deterministic component: the deterministic maximum
   equals `4_225_030` and equals the closed form `9·D + D·(D+1) + 6 + 5·D` at
   `D = DEPTH_FLOOR` (comment deriving it as in "The gap" above),
   `largestDeterministicDocument().length` equals it, `LARGEST_STAGED_INPUT_BYTES`
   equals `Math.max(generated, deterministic)` and `largestStagedDocument().length`
   equals that; and the cross-gate relations that keep the deterministic anchor
   inside the synthetic answer scale: `DEPTH_FLOOR >= GIANT_NESTING_FLOOR` (T1.3-7
   anchors P-8's floor, TEST-SPEC T1.3-7) and `SYNTHETIC_DEPTH >= DEPTH_FLOOR` (the
   synthetic `view`/`ids --tree` documents nest at least as deep as the anchor);
   (c) in the capture gate, beside the retained `> 500 × generated` pin, pin the
   blowup document above `LARGEST_STAGED_INPUT_BYTES` (today the deterministic
   maximum) by a documented factor: derive it from section-1.3.ts's T1.3-7 comment
   (that fixture's largest answer, ~13 MB of `view` over the ~4.2 MB input, about
   3×) with margin — a factor of 8 holds today (the blowup, ~204 MB, is ~48× the
   deterministic maximum) and trips once a grown `DEPTH_FLOOR` (a quadratic file)
   brings T1.3-7's answers near the synthetic scale — and state the derivation in
   the comment; (d) header item 1 and the section-1 comment name the deterministic
   anchor as part of the derived basis.
4. `s2-workspace-builder.test.ts`: only rebind the second scale vector (line ~470:
   the `largestStagedDocument()` call, the `toBe(LARGEST_STAGED_INPUT_BYTES)` /
   `toBe(196_830)` pins at ~481–482 and the `stat().size` pin at ~495, plus the
   import list at ~36–42) to the generator names so it keeps asserting exactly what
   it asserts today; leave its title and prose to Task 2.
5. `AGENTS.md`, "Staged-scale gates" bullet: name the three quantities and their
   values, what moves each (a generator bound — `NESTING_DEPTHS`,
   `MAX_MUTATIONS_PER_TRIAL`, `TERMINATOR_SEQUENCES`, `FUZZ_BASE_FILES` — or T1.3-7's
   `DEPTH_FLOOR`), and that S-8's pins are bound per kind.

**Verify:** `npm run typecheck`; `npm run format`; run
`test/self/s8-answer-scale-capacity.test.ts` alone (it holds ~0.6–0.8 GB in its
worker), then `test/self/s2-workspace-builder.test.ts`; `npm run test:self`
345/345 (the derivation test is extended, none added) with every certification
exact; `npm run build` then `npx vitest run --config test/vitest.config.ts
--project suite test/suite/section-1.3.test.ts` — T1.3-7 passes as before.
Non-vacuity spot check (uncommitted, restore byte-identically): make
`largestDeterministicDocument()` drop its last byte — the derivation test must fail
at the deterministic length pin, not elsewhere.

**Commit:** `sdg(phase-9): staged-scale derivation carries the deterministic staged
maximum — T1.3-7's 2048-deep chained-id tower (4,225,030 bytes) beside the
generator maximum (17 S-2, S-8; H-11) …` — summarize the pins added and rebound,
the false statements removed, and the verification results.

---

### Task 2 — S-2 stages the largest document the suite stages, T1.3-7's 4,225,030-byte tower, through the builder and reads it back byte-complete; S-2's prose corrected

**Satisfies:** TEST-SPEC.md §17 S-2 ("scale vectors at the suite's staged maxima —
… one at the largest document size the suite stages (deterministic fixtures and
generator draws alike, 16), each read back byte-complete — so a truncating writer
or recursion-limited serializer cannot silently stage shallower or smaller inputs
than declared"); §0 H-11; reviewer C Gap 1, remediation "add or extend the S-2
vector to write and read back the 4,225,030-byte T1.3-7 document byte-complete
(size, byte-for-byte, and structural counts), and correct the 'every deterministic
fixture is far smaller' statements in `s2-workspace-builder.test.ts` and
`staged-scale.ts`".

**Precondition:** Task 1 has landed (`test/self/staged-scale.ts` exports the
deterministic maximum and its byte-exact builder; `test/suite/registry/section-1.3.ts`
exports `DEPTH_FLOOR`, `depthTower`, `DepthTower`). If it has not, do Task 1 first.

**Files:** `test/self/s2-workspace-builder.test.ts`; `AGENTS.md` only if its
"Staged-scale gates" bullet describes S-2's vectors in words this task changes.

**What is there now (at 6b136ee):** the S-2 file's helpers — `utf8` (line ~48),
`makeWorkspace` (~58, wraps `TestWorkspace.create` and registers disposal),
`expectByteComplete` (~406: equal length, then the first differing offset, −1
expected), `countOccurrences` (~419: an iterative `Buffer.indexOf` scan) — and two
scale vectors: the depth-4096 P-8 tower (~436, declared through the builder's
declarative `files` path, read back with plain `fs`, opener/closer/content-line
counts asserted) and the largest generated document (~470, base workspace declared
then the mutated bytes written over `specs/A.mdx` through `workspace.file` — the
imperative path). The second vector's comment (~471–478) carries the false
"every deterministic fixture is far smaller (the largest, T4.1's own-text probe,
~33 KiB)" sentence, and the header (lines ~7–10) describes the vectors as "the
4096-deep section tower … and the largest document any draw stages". T1.3-7
stages its tower as `specs/A.mdx` through `TestWorkspace.create({ files: {
"xspec.config.ts": …, "specs/A.mdx": tower.source } })` — the declarative path.

**Required outcome:**
1. A new test, e.g. `scale vector: the largest document the suite stages —
   T1.3-7's 2048-deep chained-id tower (4 225 030 bytes), read back byte-complete`,
   placed after the two existing vectors:
   - `expected` is the deterministic maximum's bytes from `staged-scale.ts`; pin
     `expected.length` to the deterministic constant and to the literal
     `4_225_030` (an exact-size pin that moves only when T1.3-7's `DEPTH_FLOOR`
     moves — deliberately, like the existing `196_830` pin), and pin
     `DEPTH_FLOOR` to `2048` and `>= GIANT_NESTING_FLOOR`;
   - stage it exactly as T1.3-7 does: `makeWorkspace({ files: { "specs/A.mdx":
     <the tower source> } })` — the declarative path (the byte class the fixture
     exercises; the `xspec.config.ts` T1.3-7 also declares is irrelevant to the
     builder and may be omitted);
   - the builder's own listing: `readdirNames()` → `["specs"]`,
     `readdirNames("specs")` → `["A.mdx"]`, `kind("specs/A.mdx")` → `"file"`,
     `fsp.stat(abs).size` → `4_225_030`;
   - plain-`fs` read-back: `expectByteComplete(actual, expected)`; structural
     counts over `actual` proving the staged chain is the declared one end to
     end, not merely 2,048 openers of any ids: `countOccurrences(actual,
     '<S id="')` = `DEPTH_FLOOR`, `countOccurrences(actual, "</S>\n")` =
     `DEPTH_FLOOR`, `countOccurrences(actual, "deep.\n")` = 1, line feeds =
     `2 * DEPTH_FLOOR + 1` = 4,097, the outermost opener `<S id="a">\n` exactly
     once, and the innermost opener `<S id="${ids[DEPTH_FLOOR − 1]}">\n` (its id
     `2 * DEPTH_FLOOR − 1` = 4,095 characters, taken from `depthTower(DEPTH_FLOOR).ids`)
     exactly once. Build every expectation iteratively; never recurse per level.
2. The second vector's title says what it stages — the largest document any
   generator draw stages — and its comment drops the false sentence, stating
   instead that T1.3-7's deterministic document is ~21× larger and is the next
   vector's subject (and that P-2/P-3, P-4 and P-9 draws stay far smaller, if the
   staged-scale derivation still says so).
3. The header comment (lines ~7–10) lists the three vectors: P-8's 4096-deep
   tower, the largest generated document, and the largest deterministic document
   (T1.3-7's chained-id tower — the largest document the suite stages).

**Verify:** `npm run typecheck`; `npm run format`; run
`test/self/s2-workspace-builder.test.ts` alone — the new vector green in well
under a second (a 4.2 MB write and read). Non-vacuity (uncommitted, restore
byte-identically — `git checkout -- test/helpers/workspace.ts`, then `git status`
shows only the intended files): scratch-edit the builder's file-writing path in
`test/helpers/workspace.ts` to drop the final byte of any content longer than
1 MiB; the new vector must fail at its size / `expectByteComplete` pin while the
4096-tower vector (65,542 bytes) and the generated-document vector (196,830 bytes)
still pass — the exact truncation window S-2 could not see before this task. Then
`npm run test:self`: 346/346 (one test added) with every certification exact.

**Commit:** `sdg(phase-9): S-2 stages the largest document the suite stages —
T1.3-7's 4,225,030-byte chained-id tower — through the builder and reads it back
byte-complete (17 S-2; H-11) …` — name the pins, the corrected prose, and the
verification results, non-vacuity included.

---

After Task 2 the plan is complete: reviewer C's Gap 1 is closed at both the
derivation (Task 1) and the builder gate (Task 2); no other round-3 finding is
harness work.
