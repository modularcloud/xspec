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

**Precondition (met by the previous task-iteration commit):** Task 1 has landed (`test/self/staged-scale.ts` exports the
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
