# FIX_PLAN — Phase 9 (test harness), re-descent round 2

Written 2026-09-03 from the second compliance determination of this Phase 9
re-descent (checkout c574214 on `claude/xspec-ui-apis-4df8fa`, level with
origin). Panel: TEST-SPEC.md §0–8 and §9–16 COMPLIANT; §17–18 +
CERTIFICATIONS.md returned two gaps (below); VERIFY: self 343/343 with every
certification exact, `harness-self` green in CI, the suite red only on the
two diagnosed product failures T6.5-7 and T6.5-9.

Rules binding every task here (Phase 9, CLAUDE-PROCESS.md §7):

- Harness work only — `test/`, `.github/`, harness configuration, and the
  build/lint/run knowledge in `AGENTS.md`. Never touch `src/` (product
  tests are expected to fail; T6.5-7 and T6.5-9 are diagnosed product
  failures and stay red).
- All harness self-tests and certifications must pass after each task:
  `npm run build` (the tests drive `dist/cli/bin.js`), `npm run typecheck`,
  `npm run format` (Prettier formats `test/fixtures/` too, though
  `test/tsconfig.json` excludes it from the typecheck), `npm run test:self`
  (expect every test green and every certification exact — a violator's
  indented `  FAIL  T…` runner lines are its expected outcomes; look at the
  `×` lines and the final `Tests` summary). See `AGENTS.md` for timings and
  the subset-run recipes.
- Each task is one commit, `sdg(phase-9): <imperative summary>`, ending
  with the two trailer lines
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01TyZ5zUv2UCkvTkM1tkYUp2`.
  Delete the task from this file in the same commit; push with
  `git push -u origin claude/xspec-ui-apis-4df8fa` (retry on network
  errors with 2s/4s/8s/16s backoff). Never merge or fetch `main`.
- Tasks are independent of one another and may be executed in any order.

---

## Task 1 — CI: upload the E-6 exchange whenever the Linux job is not cancelled

**Satisfies:** TEST-SPEC.md §18 E-6 (the Windows leg's representative-fixture
outputs "are asserted byte-identical to the same fixture's results on the
Linux leg"), E-1 (the full suite runs in GitHub CI), and H-9 (nothing
silently skipped) — Reviewer C, Gap 1 of the round-2 determination.

**Defect.** In `.github/workflows/ci.yml`, the `suite-linux` job's step
`Upload E-6 exchange outputs for the Windows leg` carries no `if:`
condition, so GitHub skips it whenever the preceding step `Run the full
suite (network disabled after setup, E-1)` exits nonzero. Observed in run
33779679718 (commit 09852d6): the E-6 writer test
(`test/suite/e6-exchange-writer.test.ts`) passed on Linux — only the product
defects T6.5-7/T6.5-9 failed — yet the upload was `skipped`, the Windows
job's download reported `Artifact not found for name: e6-linux-outputs`, and
`test/windows/e6-byte-identity.test.ts` failed on the missing manifest while
the other 8 Windows-leg tests passed. E-6's central assertion (Linux-vs-
Windows byte identity) has therefore never executed in CI, and any unrelated
Linux product failure cascades into a spurious Windows failure — contrary to
the workflow's own comment that the Windows leg "keeps reporting its own
signal".

**Change** (workflow only; no test code changes):

1. On that upload step add `if: ${{ !cancelled() }}` (the same expression
   the `suite-windows` job already uses). Keep `uses:
   actions/upload-artifact@v4`, `name: e6-linux-outputs`, `path:
   .e6-exchange`, `include-hidden-files: true`, and `if-no-files-found:
   ignore` exactly as they are — `ignore` is what makes the step harmless
   when the suite step never ran or the writer test wrote nothing. Do not
   use `always()` (it would also run on a cancelled job).
2. Rewrite the step's comment to state the intent: the step runs regardless
   of the suite step's verdict so that an exchange written by the passing
   writer test always reaches the Windows leg even while unrelated Linux
   product tests are red (the Phase 9 red-green period included); the
   Windows byte-identity test still fails loudly (H-9) exactly when no
   exchange was written — never because some other Linux test failed. Keep
   the existing sentences about the dot-directory and
   `include-hidden-files`.
3. Revise the `suite-windows` download step's comment ("The artifact does
   not exist until the Linux leg produces outputs…") to match: the artifact
   is absent only when the Linux job produced no exchange (it died before
   its suite step, or the writer test itself did not complete).
4. Update the `AGENTS.md` CI bullet — the sentence beginning "The
   `e6-linux-outputs` upload step of the full-suite job has no `if:
   always()`, so it is skipped whenever any Linux test fails…" — to describe
   the new behavior (the step runs under `if: ${{ !cancelled() }}`; the
   Windows byte-identity verdict is meaningful whenever the Linux writer
   test completed, not only on a fully green Linux run).
5. Change nothing else in the workflow: `needs: suite-linux`, the Windows
   job's `if`, `continue-on-error: true` on the download step, and the
   `harness-self` job stay as they are.

**Verification.** (a) The YAML still parses (any YAML parser available in
`node_modules` or on the box, otherwise a careful indentation check against
the neighboring steps). (b) `npm run typecheck` and `npm run format:check`
are unaffected but must stay green. (c) Push and observe the push-triggered
CI run for the new commit (`gh run list --branch
claude/xspec-ui-apis-4df8fa --limit 3`, `gh run view <id>`, `gh api
repos/{owner}/{repo}/actions/runs/<id>/artifacts`, or the GitHub MCP
`actions_get`/`get_job_logs` tools; `suite-linux` takes ~10 min): in
`suite-linux` the upload step's conclusion is `success` (not `skipped`)
although the suite step fails on T6.5-7/T6.5-9, and the run lists an
`e6-linux-outputs` artifact; in `suite-windows` the download step succeeds
and `e6-byte-identity.test.ts` no longer fails on "Artifact not found" or a
missing manifest — it either passes or fails on an actual byte difference
between the legs, which is a product finding to report verbatim in the final
message (product tests may fail in Phase 9), not a harness gap. If the run
cannot be observed to completion within the spawn, report the run id and
what was confirmed.

---

## Task 2 — S-4: check TS2440 detection directly (import binding conflicting with a module-scope local declaration)

**Satisfies:** TEST-SPEC.md §17 S-4 — "a driver blind to a diagnostic kind
passes conformer and violator alike wherever no violator targets that kind,
so each kind's detection is checked directly" — and CERTIFICATIONS.md's
Exclusions bullet "Section 4 consumer-side and type-level tests": "T6.5-9's
compile-clean observation rides the same driver — S-4 checks each
diagnostic kind's detection directly, the import-conflicts-with-local-
declaration kind this test turns on among them". Reviewer C, Gap 2 of the
round-2 determination.

**Defect.** `test/self/s4-typescript-tooling.test.ts` checks a TS2345
argument-type error (`test/fixtures/s4-tooling/type-error.ts`), an
unresolvable import (TS2307), declaration-map definitions, hover,
definitions, and inert positions — but no arm stages an import binding that
conflicts with a module-scope local declaration (TS2440 "Import declaration
conflicts with local declaration of 'X'."), the diagnostic kind T6.5-9's
`assertNoCompileErrors` observation turns on (`test/suite/registry/
section-6.5.ts`, the comment near line 4560 and the two
`assertNoCompileErrors` calls near lines 4729 and 4758: a product-chosen
import identifier colliding with the receiving file's `const`, `function`,
or `class` is TS2440). A driver blind to TS2440 would pass T6.5-9 for a
colliding product, and no certification fixture targets that kind.

**Change** (harness self-test + fixture; no product-facing test changes):

1. Add the hand-written, non-xspec fixture
   `test/fixtures/s4-tooling/import-conflict.ts`, modeled on
   `type-error.ts`: a header comment explaining the deliberate TS2440 (and
   that `npm run typecheck` excludes fixtures, S-4 compiling it through the
   tooling driver), then `import { greet } from "./greeting.js";`, then a
   module-scope local declaration of the same identifier — a `const greet`
   (arrow function `(who: string): string => ...`; the `const` pre-emption
   T6.5-9 stages; `function`/`class` yield the identical diagnostic) — and a
   trivial use so the file is not only declarations, e.g. `export const
   conflicted: string = greet("world");`. Verified facts (scratch compile
   with the repository's TypeScript under
   `defaultConsumerCompilerOptions()` from `test/helpers/tooling.ts`): the
   sole diagnostic is TS2440, message `Import declaration conflicts with
   local declaration of 'greet'.`, spanning exactly the import clause's
   binding identifier `greet` (length 5); the local declaration and the use
   carry no diagnostic. Do not touch `greeting.ts`, `main.ts`, or
   `type-error.ts` (S-4 pins hand-counted offsets in them).
2. Add one `test(...)` to `test/self/s4-typescript-tooling.test.ts`, beside
   the TS2345 arm and in its style, titled along the lines of `S-4: detects
   an import binding conflicting with a module-scope local declaration
   (TS2440, the kind T6.5-9 turns on)`:
   - `const project = await loadFixtureProject(["greeting.ts",
     "import-conflict.ts"]);` — leave the existing `S-4 control` clean
     subset (`greeting.ts`, `main.ts`) and the TS2345 arm's root set
     unchanged, so their "exactly one error"/"zero errors" pins hold.
   - Address the import binding robustly against the header comment's
     wording: `const marker = project.locate("import-conflict.ts", "import {
     greet }", { charOffset: "import { ".length });` (the `charOffset`
     option of `ConsumerProject.locate` lands on the identifier after the
     keyword prefix; a bare `"greet"` marker is ambiguous and needs
     `index`).
   - `const diagnostic = assertCompileErrorAt(project, marker, { code:
     2440, messageIncludes: ["Import declaration conflicts with local
     declaration", "greet"] });` then pin the span as the TS2345 arm does:
     `expect(diagnostic.start).toEqual(marker)`,
     `expect(diagnostic.length).toBe("greet".length)`, and hand-counted
     `marker.line`/`marker.column` against the frozen fixture file.
   - Specificity: `expect(project.errors()).toHaveLength(1)`; the local
     declaration side carries no diagnostic — e.g. `const local =
     project.locate("import-conflict.ts", "const greet", { charOffset:
     "const ".length });` and `expect(() => assertCompileErrorAt(project,
     local, { code: 2440 })).toThrowError(HarnessAssertionError)`.
   - The clean-compile assertion diagnoses the state rather than passing:
     `expect(() => assertNoCompileErrors(project)).toThrowError(
     HarnessAssertionError)` and `.toThrowError(/TS2440/)`.
3. Extend the file's header comment (lines 1–15: "a known type error, a
   known definition location, and a known hover text") to name the fourth
   directly checked kind — an import binding conflicting with a local
   declaration (TS2440), the kind T6.5-9 turns on — citing S-4's "each
   kind's detection is checked directly" and the CERTIFICATIONS.md bullet.

**Verification.** `npx vitest run --config test/vitest.config.ts --project
self test/self/s4-typescript-tooling.test.ts` → 12/12 (was 11/11);
`npm run typecheck`; `npm run format` (Prettier formats the new fixture);
`npm run test:self` → 344/344 with every certification exact. Non-vacuity
spot check (do not commit it): temporarily rename the fixture's local
declaration so nothing collides and confirm the new arm fails at
`assertCompileErrorAt` with "compilation must fail with an error TS2440",
then restore the file. The product-facing suite is unaffected (no registry
module changes); T6.5-9 stays a diagnosed product failure.

---

## Task 3 — S-4: check TS2300 detection directly (an import binding duplicated by another import binding)

**Satisfies:** the same TEST-SPEC.md §17 S-4 sentence ("each kind's
detection is checked directly") applied to the other collision kind T6.5-9
turns on: `test/suite/registry/section-6.5.ts` (the comment near line 4566
and the assertion message near line 4767 — a product-chosen import
identifier colliding "with the import binding [is] TS2300 (duplicate
identifier)"; T6.5-9's pre-empted set includes "a non-spec import binding").
Planner-derived sibling of Reviewer C's Gap 2 (the reviewer named the
TS2440 kind CERTIFICATIONS.md cites; T6.5-9's staging turns on TS2300 as
well, and `grep -rn "2300" test/self test/helpers` finds no S-4 arm for
it). Independent of Task 2 — land either first.

**Change** (harness self-test + fixtures; no product-facing test changes):

1. Add two hand-written, non-xspec fixture files under
   `test/fixtures/s4-tooling/`: `other-greeting.ts` — a second clean module
   exporting a `greet(name: string): string` (a different body from
   `greeting.ts`'s) — and `import-duplicate.ts`, modeled on `type-error.ts`
   (header comment explaining the deliberate TS2300): `import { greet } from
   "./greeting.js";` then `import { greet } from "./other-greeting.js";`
   then a trivial use such as `export const duplicated: string =
   greet("world");`. Verified facts (scratch compile with the repository's
   TypeScript under `defaultConsumerCompilerOptions()`): exactly two
   diagnostics, both TS2300 with message `Duplicate identifier 'greet'.`,
   one spanning each import clause's binding identifier `greet` (length 5);
   nothing at the use. Leave `greeting.ts`, `main.ts`, and `type-error.ts`
   untouched. Added fixture files are inert until a test lists them as
   roots — at c574214 every consumer of `fixtureRoot` in
   `test/self/s4-typescript-tooling.test.ts` passes an explicit root-file
   list (confirm with `grep -n fixtureRoot` there); the existing `S-4
   control` (`greeting.ts`, `main.ts` → zero errors) and TS2345 (`exactly
   one error`) pins therefore hold unchanged.
2. Add one `test(...)` to `test/self/s4-typescript-tooling.test.ts` in the
   TS2345 arm's style, titled along the lines of `S-4: detects an import
   binding duplicated by another import binding (TS2300, the other
   collision kind T6.5-9 turns on)`:
   - Fixture self-check first: `assertNoCompileErrors(await
     loadFixtureProject(["greeting.ts", "other-greeting.ts"]), "s4-tooling
     duplicate-import premise")` — both modules are valid on their own, so
     the diagnostics below are the duplication's.
   - `const project = await loadFixtureProject(["greeting.ts",
     "other-greeting.ts", "import-duplicate.ts"]);`
   - Both bindings: `project.locate("import-duplicate.ts", "import { greet
     }", { index: 0, charOffset: "import { ".length })` and the same with
     `index: 1` (the marker occurs twice, so `index` is required; `charOffset`
     lands on the identifier). For each: `assertCompileErrorAt(project,
     marker, { code: 2300, messageIncludes: ["Duplicate identifier",
     "greet"] })`, then `expect(diagnostic.start).toEqual(marker)`,
     `expect(diagnostic.length).toBe("greet".length)`, and hand-counted
     `line`/`column` pins against the frozen fixture file.
   - Specificity: `expect(project.errors()).toHaveLength(2)`; the use site
     carries no diagnostic (`locate("import-duplicate.ts", 'greet("world")')`
     with `assertCompileErrorAt(..., { code: 2300 })` expected to throw
     `HarnessAssertionError`).
   - `expect(() => assertNoCompileErrors(project)).toThrowError(
     HarnessAssertionError)` and `.toThrowError(/TS2300/)`.
3. Extend the file's header comment to list this kind beside Task 2's
   (TS2440) as directly checked collision kinds T6.5-9 turns on.

**Verification.** `npx vitest run --config test/vitest.config.ts --project
self test/self/s4-typescript-tooling.test.ts` → one more passing test than
before the task; `npm run typecheck`; `npm run format`; `npm run test:self`
→ all green with every certification exact. Non-vacuity spot check (do not
commit it): temporarily change the second import to bind a different name
(`import { greet as other }`) and confirm the arm fails at
`assertCompileErrorAt` with "compilation must fail with an error TS2300",
then restore the file.
