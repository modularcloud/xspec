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
