# FIX_PLAN — Phase 10 (residual canonical-sidedness gap)

Source: second Phase 10 compliance panel (2026-07-24) at HEAD 5faf881. Sections 1–7 COMPLIANT;
verify fully green (485/485 locally; CI jobs harness-self, full suite, Windows E-6 all green); the
sections 8–15 reviewer confirmed the earlier canonical-identity fix (T41–T44) genuinely closed the
prior gap and found exactly one residual gap, planned here. Task numbering continues from the
closed plan: T45–T49 (completed tasks are removed from this file). Tasks execute in order; each
task ends with the full suite green.
Progress: T45 (sidedness plumbing on `GeneratedNode`) is done — the required `deleted` marker
exists at every construction site and is not yet read anywhere.

Hard constraints for every task:

- The test harness under `test/` is FROZEN, as are `specs/TEST-SPEC.md` and
  `specs/CERTIFICATIONS.md`. No task may touch them — not even to add coverage for this gap.
  The frozen harness stages no baseline-session recapture scenario, which is why the suite is
  green today despite the defect and must stay green (485/485; all three CI jobs) after every task.
- Verification of the gap itself is by scripted scratch workspaces outside the repo (T49, plus
  each task's smoke checks), never by new tests.
- Build first (`npm run build`), then `npm test`; see `AGENTS.md` for all gates
  (`npm run typecheck`, `npm run format:check`, `npm test`, `npm run test:self`).
- Branch `sdg/initial-build`, commits `sdg(phase-10): <imperative summary>`, ordinary commits only
  (never rewrite pushed history), push after each task.
- IMPLEMENTATION.md Architecture: everything below stays in the pure core (`src/core/`) plus the
  existing cli seam (`src/cli/commands/review-session.ts`); no new dependencies, no I/O in core.

## The residual gap (panel finding, condensed)

SPEC 10.4: "requirement nodes compare as canonical identities (5.4) … an identity mapping from a
journaled rename or move … by itself invalidates nothing." SPEC 10.5 fixes item content
(origin/context/impact-target sets); SPEC 10.2 fixes `baseline` at entry as the recorded-baseline
graph's values; SPEC 10.7 fixes the presented payload (a deleted node is presented absent, its
before-text from the baseline state).

In baseline (`path-blocks`) session **generation**, `canonicalNodeKey`
(`src/core/review-derive.ts`, lines 238–255, reached via `canonicalizeGeneration` from
`runSessionGenerators` in `src/cli/commands/review-session.ts`) canonicalizes a node that exists
only in the recorded baseline from its baseline identity only when **no current-graph node bears
its forward-mapped spelling** (the `present` graph-occupancy check). When that spelling was
vacated by a manual deletion (SPEC 6.6, no journal entry) and later recaptured by a journaled
rename or move (SPEC 5.4's distinct-chain case), the deleted node is instead canonicalized as the
recapturing node's canonical identity — the exact misattribution the seam's own header comment
forbids ("never by canonicalizing its forward-mapped spelling against the full journal"). The
generator knows the truth — `NodeChange.currentIdentity === null` (`src/core/changes.ts`) — but
that sidedness is dropped at the `GeneratedNode` seam. Contributing sites with the same
occupancy/current-first logic: `canonicalizeGeneration`'s `divergent`/`hasCurrent` blocker-ref
resolution (review-derive.ts lines 276–315) and `src/core/path-blocks.ts` `storedIdentity`/
`recordOfStored` (current-first spelling lookup, lines 252–265, 703–708). Audit and coverage
generation are unaffected (no baseline side); stored sessions, matching, `split`, and 14.21
handling remain correct — the defect is confined to this generation seam.

Reproductions (all steps exit 0 today; full scripts in T49):

- **A — content misattribution:** sections `a`+`b` at the baseline commit; manually delete `b`;
  `xspec build`; `xspec rename <file> a b`; `xspec review create --base <commit>`. The root
  `subtree-coherence` item's stored `origin` is `["0:specs/S.mdx", "0:specs/S.mdx#a"]` instead of
  `["0:specs/S.mdx", "0:specs/S.mdx#b"]` — the recapturer, a pure-renamed non-changed node, is
  recorded as an originating node (10.5 violated); `baseline.nodes["0:specs/S.mdx#a"]` and
  `baselineTexts["0:specs/S.mdx#a"]` carry the deleted node's baseline hashes and text
  ("Bravo text.") while node `a`'s true baseline hashes are dropped (10.2/10.4 violated); the
  presented origin entry fuses the two nodes — before "Bravo text.", after "Alpha text.",
  `present: true` on both sides — where 10.4 requires the deleted node presented absent (10.7
  payload violated).
- **B — spurious invalidation by a pure operation:** node `m` with a `d` reference to `b` at the
  baseline; delete `b` and the reference; create the session; resolve the `metadata-consistency`
  item `--status no-change`; then only `xspec rename <file> a b`. The resolved item is reported
  `invalidated` (stored context `0:…#b` vs generator-recomputed `0:…#a`), violating 10.4's
  "by itself invalidates nothing" verbatim.
- **C — traced collateral:** a manually deleted file whose path is reoccupied by a journaled
  `move` merges the deleted root's `subtree-coherence` item into the recapturing file's item
  (generation dedup on identical kind + canonical scope), silently dropping the deletion review.

## Design fixed by this plan (the reviewer's fix direction)

`canonicalNodeKey` must branch on the record's **sidedness** — the generator knows
`NodeChange.presence`/`currentIdentity` — instead of graph occupancy of the forward-mapped
spelling, with the same treatment for path-blocks' stored-spelling lookups and the blocker-ref
divergence map. Governing facts (all verifiable in `src/core/journal.ts` and review-state.ts):

- A `GeneratedNode.identity` as generated is a current-space spelling; for a baseline-only
  (deleted) record it is `replay.mapForward(baselineIdentity)` (path-blocks `storedIdentity`) and
  may collide with a present node's spelling exactly when a vacated spelling was recaptured by a
  journaled entry. Spellings are therefore ambiguous; sidedness is not.
- The correct canonical reference of a baseline-only node is
  `encodeCanonicalIdentity(canonicalAt(journal, baselineJournalLength, node.baselineIdentity))`;
  of a current-side node, `canonicalKeyOfCurrent(journal, node.identity)`. Distinct chains yield
  distinct references (SPEC 5.4), so after the fix two generated items may legitimately share a
  spelling while carrying distinct canonical scopes — that is the intended outcome (repro C).
- Code locations are never journal-mapped (SPEC 6.4/6.5), so for a code-location node both
  branches produce the same reference (`0:<location>`); the sidedness switch cannot change
  code-impact keying.
- Per SPEC 5.6, deleting a node makes its parent `changed` (structural edits originate at the
  parent), so a deleted record is never a surviving changed node nor a branch child: today's
  main-generation blocker refs (path-blocks `parentConsistencyItem`) always name present records.
  T47 is therefore correctness-by-construction per the reviewer's direction, not a reachable-bug
  chase — do not be surprised that no failing blocker scenario can be staged.
- Sessions live at `.xspec/reviews/<name>.json` (stored members `origin`, `baseline.nodes`,
  `baselineTexts` are canonical references — the unambiguous place to assert stored keys).

---

## T46 — Branch `canonicalNodeKey` on sidedness, not graph occupancy

**Satisfies:** the panel finding's core — SPEC 10.4 ("requirement nodes compare as canonical
identities (5.4) … an identity mapping from a journaled rename or move … by itself invalidates
nothing"), SPEC 10.5 (origin/context sets and the one-item-per-kind-and-canonical-scope dedup over
true canonicals), SPEC 10.2 (`baseline` fixed at entry as recorded-baseline values), SPEC 10.7
(deleted node presented absent with baseline before-text). Fixes reproductions A, B, and C's core.

1. Rewrite `canonicalNodeKey` (`src/core/review-derive.ts` lines 238–255):
   - node marked deleted, `node.baselineIdentity !== null`, `baselineJournalLength !== undefined`
     → `encodeCanonicalIdentity(canonicalAt(journal, baselineJournalLength, node.baselineIdentity))`
     — unconditionally, with no current-graph lookup;
   - node marked deleted otherwise → `xspec internal error` throw (generators emit deleted nodes
     only with a baseline identity and only in baseline sessions);
   - node not deleted → `canonicalKeyOfCurrent(journal, node.identity)`.
   The `present` graph-occupancy check is deleted entirely.
2. Ripples: the `isCodeLocation` parameter and `GenerationCanonicalization.graph` member existed
   only for the occupancy check — remove them if they fall unused (updating `canonicalNode`,
   `canonicalizeItem`, and the three `canonicalizeGeneration` call sites in
   `src/cli/commands/review-session.ts` `runSessionGenerators`, lines ~161–168, ~186–189,
   ~200–203); keeping them unused is not acceptable, but if removal ripples beyond this seam,
   keep `graph` and note why in the commit message.
3. Update the now-stale rationale text: `canonicalNodeKey`'s doc comment ("baseline identity
   recorded, absent from the current graph") and the module-header identity-policy paragraph
   (lines ~39–55) must describe the sidedness rule.
4. Verify:
   - Full gates green (the frozen harness stages no recapture scenario; all 485 must still pass —
     if any test goes red, the change broke a non-recapture path; fix before committing).
   - Smoke repro A (script per T49, scenario A): in the scratch workspace,
     `.xspec/reviews/s.json`'s root `subtree-coherence` item now stores
     `origin = ["0:specs/S.mdx", "0:specs/S.mdx#b"]`, `baseline.nodes["0:specs/S.mdx#b"]` present
     with the deleted node's hashes, `baselineTexts["0:specs/S.mdx#b"]` = "Bravo text.", and node
     `a`'s baseline state under `0:specs/S.mdx#a`.
5. Commit, push.

## T47 — Record-faithful blocker-reference canonicalization (retire `divergent`/`hasCurrent`)

**Satisfies:** the panel finding's fix direction "with the same treatment for … the blocker-ref
divergence map" — SPEC 10.5 rule 2 (`blockedBy` holds the item whose scope node is A's child on
that branch, compared per 10.4 canonical identity) and re-derivation rule 5. Per the design note,
no failing scenario is reachable today; the requirement is that the seam stop resolving refs
through spelling occupancy with a current-first tiebreak.

1. In `src/core/review-derive.ts` `canonicalizeGeneration` (lines 276–315): delete the
   `divergent`/`hasCurrent` machinery and its comment block. A generator-emitted blocker
   reference must canonicalize exactly as its target item's scope does — from the emitting
   record's sidedness. Recommended encoding: extend `GeneratedBlockerRef` with an optional
   `readonly scopeNode?: GeneratedNode` set by generator-space emitters; `mainRefKey` becomes
   `ref.scopeNode !== undefined ? canonicalNodeKey(ref.scopeNode, inputs)
   : canonicalKeyOfCurrent(journal, ref.scope)`, and canonicalized output refs drop `scopeNode`
   (emit `{kind, scope}` only, canonical space unchanged). With the map gone, `contentRefKey` and
   `mainRefKey` collapse into one function — unify them.
2. Emitters: `src/core/path-blocks.ts` `parentConsistencyItem` (blockedBy construction,
   lines ~481–484) sets `scopeNode: this.nodeOf(branch)` beside `scope:
   this.storedIdentity(branch)`. Audit's child refs (`src/core/audit.ts`) and the decomposition
   content sources' child refs name current-graph nodes — they may omit `scopeNode` (current
   canonicalization) or set it non-deleted; keep them consistent with their item scopes.
3. Invariant to preserve: every blocker reference must resolve to a generated item's canonical
   key, or `deriveSessionItems` throws (`review-derive.ts` ~lines 1057–1064). Refs built from the
   same records as their target items' scopes canonicalize identically by construction — state
   this in the seam's comment.
4. Verify: full gates green. Smoke: rerun the T49 scenario A script (unchanged results), and
   confirm `xspec review create` + `resolve --status updated` re-derivation still produce
   identical sessions in a plain rename-only workspace (pure rename invalidates nothing,
   SPEC 10.4).
5. Commit, push.

## T48 — Resolution-sided stored-spelling lookup in the decomposition content seam

**Satisfies:** the panel finding's fix direction "the same treatment for path-blocks'
stored-spelling lookups" — SPEC 10.5 re-derivation rule 2 / SPEC 10.7 (decomposition matching and
content per 10.4 canonical comparison; a dangling stored scope never aliases the distinct node
that recaptured its spelling).

1. `src/core/review-derive.ts`, `canonicalizeGeneration`'s wrapped `DecompositionContentSource`
   (lines ~349–369): the wrapper currently decodes a scope reference to a bare spelling
   (`spellingOfReference`) — lossy after a recapture. Change it to resolve the reference
   (`resolveReference`) and pass the strategy's spelling-space source both the spelling and
   whether the reference canonically resolves (an optional trailing parameter on the
   `DecompositionContentSource` methods is TS-compatible for all implementers; audit/coverage may
   ignore it). Child identities passed to `splitParentConsistencyItem` are enumerated from the
   current graph (`expandDecompositions`) and need no flag.
2. Additionally make the wrapper authoritative for the produced item's scope reference: the
   canonicalized item returned for `subtreeCoherenceItem(scopeReference)` /
   `splitParentConsistencyItem(scopeReference, …)` must carry exactly `scopeReference` as its
   canonical scope — never a decode-then-recanonicalize round trip that could land on a
   recapturing chain (`expandDecompositions` memoizes and matches by that reference; the wrapper
   already knows it).
3. `src/core/path-blocks.ts` `recordOfStored` (lines ~703–708) takes the flag: consult
   `byCurrentIdentity` only for a resolving reference and `deletedByStored` only for a
   non-resolving one — never current-first across both. `generatedNodeOfStored` (~710–714)
   forwards the flag; its no-record fallback stays non-deleted for a resolving reference, and for
   a non-resolving one the wrapper's scope override from step 2 governs the stored reference
   regardless.
4. Verify: full gates green (split/decomposition tests in the suite are the sensitive area —
   `npx vitest run --config test/vitest.config.ts --project suite` file subsets per AGENTS.md can
   narrow a failure). Smoke: in a scratch workspace, `review split` on a baseline session's root
   item, then a re-derivation (`resolve --status updated`), still yields the decomposition items
   of SPEC 10.7 with statuses kept.
5. Commit, push.

## T49 — End-to-end verification: the finding's three scenarios, full gates, CI

**Satisfies:** closure of the panel's residual finding against SPEC 10.4/10.5/10.2/10.7; the
plan's stay-green constraint (485/485 and all three CI jobs at the pushed HEAD).

1. Fresh `npm ci` + `npm run build`. Stage each scenario in a scratch git workspace outside the
   repo (e.g. under the session scratchpad): minimal `xspec.config.ts`
   (`import { defineConfig } from "xspec"` + `export default defineConfig({ specs: { specs:
   ["specs/**/*.mdx"] } })`), sources under `specs/`, `git init` + an initial commit of sources
   and config (use `git -c user.name=x -c user.email=x@x commit`; `--base` takes
   `git rev-parse HEAD`). All steps must exit 0; record exit codes and the key output.
   - **Scenario A (content misattribution):** `specs/S.mdx` with top-level sections `a`
     ("Alpha text.") and `b` ("Bravo text."); commit; edit the file deleting section `b`;
     `xspec build`; `xspec rename specs/S.mdx a b`; `xspec review create --base <commit>
     --name s`. Assert in `.xspec/reviews/s.json`: the root `subtree-coherence` item stores
     `origin = ["0:specs/S.mdx", "0:specs/S.mdx#b"]` (the pure-renamed recapturer is NOT an
     originating node); `baseline.nodes` keys the deleted node at `0:specs/S.mdx#b` (Bravo
     hashes) and node `a` at `0:specs/S.mdx#a` (its true baseline hashes, no longer dropped);
     `baselineTexts["0:specs/S.mdx#b"]` = "Bravo text.". Assert in `review export s --json` /
     `show`: the deleted origin node is presented absent on the current side with before-text
     "Bravo text." and no after-text — never fused with the present renamed node.
   - **Scenario B (no spurious invalidation):** `specs/S.mdx` with sections `a`, `b`, and `m`,
     where `m` carries a `d` reference to `b` (syntax per SPEC 2.2; adjust the reference form as
     the compiler requires — the essential shape is the baseline dependency `m -> b`); commit;
     edit deleting section `b` and `m`'s reference to it; `xspec build`; `xspec review create
     --base <commit> --name s2`; resolve `m`'s `metadata-consistency` item
     `--status no-change`; then only `xspec rename specs/S.mdx a b`. Assert `review status s2`
     and `export` still report that item `no-change` — not `invalidated` (SPEC 10.4: a journaled
     rename by itself invalidates nothing).
   - **Scenario C (deletion review not dropped):** `specs/F.mdx` and `specs/G.mdx` (each a
     top-level section plus root-level prose); commit; edit `specs/G.mdx`'s root-level prose (so
     G's root is `changed`, SPEC 5.6); delete `specs/F.mdx` entirely (manual, SPEC 6.6);
     `xspec build`; `xspec move specs/G.mdx specs/F.mdx`; `xspec review create --base <commit>
     --name s3`. Assert the session holds TWO distinct root `subtree-coherence` items — the
     deleted baseline `F` root (stored scope `0:specs/F.mdx`, presented absent) and the moved
     file's root (stored scope `0:specs/G.mdx`, presented present) — not one merged item.
   - In every scenario: `review list`, `status`, `next --json`, `show`, `export --json` all exit
     0; re-reads are byte-stable; no output reports the session corrupt (14.21); `xspec check`
     reports no session finding.
2. Run the full local gates: `npm run typecheck`, `npm run format:check`, `npm test` (485/485),
   `npm run test:self`.
3. Record in `AGENTS.md` any newly learned *build/lint/run* knowledge (nothing else belongs
   there); skip if none.
4. Commit, push, then confirm all three CI jobs (harness-self Linux, full suite Linux, Windows
   E-6) succeed at the pushed HEAD (`gh run list` / `gh run watch`). If a job fails, diagnose and
   fix within Phase 10 scope (product code only — never `test/`), commit, push, re-confirm.
5. When every assertion holds and CI is green, remove this completed plan file (commit the
   removal with the T49 verification commit or after it), closing the panel's residual finding.

---

Completion of T45–T49 closes the panel's residual finding. No spec-problems entries are needed:
SPEC 5.4, 5.6, 6.6, 10.2, 10.4, 10.5, and 10.7 are consistent and implementable as specified; the
product deviated at one generation seam.
