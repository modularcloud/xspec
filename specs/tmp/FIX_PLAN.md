# FIX_PLAN — Phase 10 (re-descent, iteration 1): product adherence to `specs/SPEC.md`

Source: the compliance determination that opened this Phase 10 loop at `b3cc3e3` (branch `claude/xspec-ui-apis-4df8fa`, PR #7; governing IP `specs/patches/0001-external-ui-apis.md`, Stage: Tested — no task here changes the Stage; bundle `specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`). The documents changed after the product was last brought green (CI recorded at `9d095d9`): `git diff 9d095d9..f31e100 -- specs/SPEC.md`, `git diff 3311ccd..6780f53 -- specs/TEST-SPEC.md`, `git diff 3311ccd..301f2f9 -- specs/CERTIFICATIONS.md`; Phase 9 brought the harness into line, its last determination clean at `3fe91f5`. Reviewer A (SPEC 1–6) returned 10 gaps, reviewer B (7–11) 6, reviewer C (12–15) 14. VERIFY was red on 31 product tests, the same set locally and in CI run 1003's `suite-linux` job at `b3cc3e3` (every failure a `HarnessAssertionError`); `harness-self` (28 files, 4315 tests) and `suite-windows` were green, and certification had 0 discrepancies (154 PASS / 38 FAIL — the FAILs being violators' expected outcomes — / 0 error / 0 hang). The product's last change is `8a0da01`; `dist/` matches `src/`. Findings are cited as A<n>, B<n>, C<n> (reviewer, gap number); where reviewers reported the same gap, it is one task. Reviewer B also noted, uncounted and outside its scope, a wrong correction text on a refused source read; that is Task 21.

Goal: every test passes — `npm test` locally, and CI's `harness-self`, `suite-linux`, and `suite-windows` on the branch head (PR #7 is conflicted, so CI runs on branch pushes) — and the product meets SPEC.md. Tasks 18–23 fix SPEC departures that no test pins; they are in scope all the same.

Not planned: nothing. Every counted gap and B's uncounted note has a task. The two standing rulings below close their families for this run.

**Standing rulings in this run** (Liaison rulings, recorded in `AGENTS.md`), verbatim:

- "Accepted residuals for this run, by ruling: gaps in where a 14.20 syntax failure is located (SPEC 14's location rule for 14.20), in rare malformed constructs of the kind found only by constructed probes, batteries or fuzzing — the family listed in `AGENTS.md`'s "Known residual 14.20 location gaps" bullet. Do not report them, or new instances of that family, as gaps. A 14.20 located wrongly in a common, realistic construct (for example an ordinary unclosed brace or tag in plain prose) is still a gap."
- "Also accepted for this run, by ruling: SPEC 6.5 names no refusal reason for a TypeScript import removal that joins two statements through automatic semicolon insertion (`AGENTS.md`'s "Known SPEC 6.5 gap" bullet), although it says a successful move's finishing regeneration cannot fail. Report neither the SPEC's silence as a SPEC problem nor the product's handling as a product gap. When the joined text fails to parse, the product refuses such a move through its post-move re-validation's 14.20 and modifies nothing. The gap is deferred to a future SPEC revision."

**Rules for every task (read once per spawn):**

- Phase 10: never modify the test harness — nothing under `test/` (fixtures included) or `.github/`. Edit product code (`src/`), this file, the problems files, and `AGENTS.md` (build/lint/run knowledge only). Never couple the product to the harness: reading a registry module to see what a test stages or accepts is fine; importing or mirroring harness helpers is not. Leave `deleted/` (retired plan files) alone; never merge or fetch `main`.
- Respect `specs/IMPLEMENTATION.md`: pure `core`, I/O `workspace`, rendering `cli`; findings built as data and rendered once per output form; one canonical JSON serializer; remark-mdx (unified/remark) for MDX and the TypeScript compiler API, reached through `src/core/ts-module.ts`, for TypeScript; no new runtime dependency without a spec-grounded reason; no platform-specific code paths. Where code implements a numbered SPEC rule, cite the section in a comment.
- Build and run: `npm run build` (tests drive `dist/cli/bin.js`; `dist/` is untracked and CI builds it; `npm ci` first if `node_modules` is missing). The sandbox runs as root, so run suite files unprivileged, as `AGENTS.md` describes: `unshare --map-user=1000 --map-group=1000 -- npx vitest run --config test/vitest.config.ts --project suite test/suite/<module>.test.ts`, adding `-t '<ID> '` (trailing space kept, so `T6.5-2` does not also select `T6.5-20`) for one test and `--reporter=verbose` for per-test lines; CI's form also removes `NODE_OPTIONS` and the network (`AGENTS.md` has the recipe). Redirect long runs to a scratch file and read it in bounded slices. `AGENTS.md` also has timings and the scratch-workspace recipe: a hand-staged workspace outside the repository (under your scratchpad), driven with `node /home/user/xspec/dist/cli/bin.js … --json`, is the fastest way to see a finding's exact range.
- Each test stops at its first failing arm, so a test can stay red until every task the index lists for it has landed. Each task's **Verification** names the tests it should turn green once its partners are in, and what to probe by hand meanwhile. A task is done when its requirement is met (hand-verified where its tests are still blocked by other tasks) and nothing that passed before fails: run every suite file the task names, plus the neighbours it lists.
- Exact spellings: the tool-parameter layer decodes backslash-u escape spellings in edit and Bash payloads into plain characters inconsistently, comment text included. Spell special characters in code by numeric code (`0x2028`, `String.fromCodePoint(0x2ebf0)`), never as escapes inside string literals or comments, and verify written bytes byte-wise. Take every spelling from SPEC.md or TEST-SPEC.md, never from this plan's prose, which names characters by code point.
- Before committing: run `npm run typecheck`. Format product code only, with `npx prettier --write src` (never `npm run format`, which also rewrites `test/`), then run `npm run format:check`. Commit as `sdg(phase-10): <imperative summary>` (naming the task), ending the message with the trailer lines your spawn prompt gives. Check `git log -1` before every push (other agents share the checkout's remote and the scratchpad; use task-specific scratch file names). Push with `git push -u origin claude/xspec-ui-apis-4df8fa`, retrying on network errors with backoff (2 s, 4 s, 8 s, 16 s); never force-push.
- Infrastructure caution: agents in this run have died from usage-credit exhaustion, container restarts, API overloads, and single responses over the 64,000 output-token ceiling. Issue a few tool calls per response, keep payloads modest, write files in bounded pieces, and land a coherent part early rather than one giant commit.
- Task numbers are stable; never renumber. When a task is done, delete its section in the same commit and note in its index rows that it has landed. If a task is too large for one spawn, land a coherent part and replace the task with precise remainder tasks numbered `<N>a`, `<N>b`, …, updating the index rows that name `<N>`.
- Work top to bottom: execute the topmost remaining task other than Task 24; if it states a hard dependency ("after Task N") on a task not yet landed, execute that task instead. Task 24 runs last.
- A new gap that no suite test exercises goes in as a new task at the end, just above Task 24 (numbered 25 onward), not at the top — except a gap in where a 14.20 syntax failure is located (SPEC 14's location rule for 14.20), which is closed for this run: record it only as a one-line entry (staging, offset given, offset SPEC fixes) in `AGENTS.md`'s "Known residual 14.20 location gaps" bullet, never as a task, and do not work on it. Only a gap that blocks your own task or a failing test may go ahead of the remaining tasks.
- If a task collides with a harness test that pins the opposite of what SPEC.md requires, do not bend the product to the test: record the contradiction, dated and precise, in `specs/tmp/TEST-SPEC-PROBLEMS.md` (a defect in SPEC.md itself: `specs/tmp/SPEC-PROBLEMS.md`; in CERTIFICATIONS.md: `specs/tmp/CERTIFICATIONS-PROBLEMS.md`), commit, push, and end with `OUTCOME: PROBLEM — <file>`. None of the reviewers found a spec defect, and no task below is known to collide with a test.
- Record new build or run knowledge in `AGENTS.md` as you go; leave its last bullet (the known state after the previous Phase 10 plan) for Task 24 to rewrite.
- Line numbers below are approximate, taken at `b3cc3e3`; search by the names given. If the permission system refuses an action (a deletion included), stop and report it; never work around a refusal.

## Index — each failing test and the tasks it waits on

These are VERIFY's 31 failures at `b3cc3e3`, each with where it first failed then (local run and CI run 1003 alike). Each registry module is `test/suite/registry/<module>.ts`, and its suite file is `test/suite/<module>.test.ts`. Tasks 18–23 have no failing test.

| Test | Module | Tasks | First failure at `b3cc3e3` |
|---|---|---|---|
| P-1 | section-16-p1 | 1 (landed) | falsified, seed 271828183, trial 11 of 25 (a U+2028/U+2029 segment or tag accepted) |
| P-5 | section-16-p5-p6 | 15 | falsified, seed 271828183, trial 1 of 8: added `import require from "./require.xspec"` |
| T1.4-1 | section-1.4 | 1 (landed) | a segment carrying U+2028: `build --json` exits 0, expected 1 |
| T1.4-4 | section-1.4 | 1 (landed) | a tag carrying U+2028: `build --json` exits 0, expected 1 |
| T4-2 | section-4 | 9 | an import type naming a `.xspec` module builds with exit 0 |
| T6.4-3 | section-6.4 | 1 (landed) | `rename specs/A.mdx a "a<U+2028>b"` exits 0 |
| T6.5-4 | section-6.5 | 1 (landed), 6 | `move specs/A.mdx#keep "specs/B.mdx#a<U+2028>b"` exits 0; then the barred-character destination arms; since Task 1 landed, first fails at Task 6's arm: `move specs/A.mdx specs/a<U+0022>b.mdx` exits 0, expected 1 |
| T6.5-11 | section-6.5-ii | 17 | arm (f): the rewritten call reads `tt(target.y)`, an untimely `text` binding |
| T6.5-20 | section-6.5-iv | 7, 10 (and 9 for (d)'s import-type and `declare module` stagings) | arm (a): `move specs/Z.mdx specs/A.xspec.ts/B.mdx` exits 70 after modifying the workspace |
| T6.5-21 | section-6.5-iv | 8, 6 (its two-reason arm) | arm (a): `move specs/A.mdx specs/sub/A.mdx` exits 0 |
| T6.5-22 | section-6.5-iv | 15 | arm (b): 26 of 38 lures bound a barred name |
| T6.5-23 | section-6.5-v | 16, 17 | 13 of 33 stagings place or root the added declaration wrongly |
| T6.6-3 | section-6.6 | 1 (landed), 6, 7, 8, 10 | T6.4-3's U+2028 twin; past it, T6.5-20(a)'s twin; since Task 1 landed, first fails at Task 6's arm: `move specs/A.mdx specs/a<U+0022>b.mdx` exits 0, expected 1 |
| T7-2 | section-7-basics | 11 | the `import defer { defineConfig }` arm builds with exit 0, expected 2 |
| T7-6 | section-7-discovery | 5 (landed) | invalid-source arm: `check` reports 14.10 six times, expected 14.19 once |
| T7.1-1 | section-7.1-7.3 | 5 (landed) | `specs/a"b.mdx` builds with exit 0, expected 1 |
| T7.3-1 | section-7.1-7.3 | 12 | `outDir ".xspec"` builds with exit 0, expected 2 |
| T11-1 | section-11 | 13 | a root's tags reported `[]`, expected absent |
| T11-2 | section-11 | 13 | likewise |
| T11-3 | section-11 | 13 | likewise |
| T12.0-5 | section-12.0-i | 5 (landed) | `view 'specs/a\b.mdx'` exits 0 with no finding, expected 1 with condition 19 |
| T12.0-10 | section-12.0-ii | 1 (landed) | `query nodes --tag a<U+2028>b` under an invalid configuration reports `configuration-error`, expected the plain usage error |
| T12.7-2 | section-12.7 | 6, 8 | the two-reason `move specs/A.mdx "specs/a'b.mdx"` exits 0 |
| T13.4-9 | section-13.4 | 2 (landed) | (a): a derived path above a source builds with exit 0, expected condition 22 |
| T13.4-10 | section-13.4 | 4 (landed) | the recorded orphan's finding says "run `xspec build` to remove it" |
| T13.4-11 | section-13.4 | 3 (landed) | (a): a condition-10 finding for a recorded path holding a directory |
| T14-4 | section-14 | 14 (it sweeps T14-12's stagings) | U+2EBF0 in a JSX name judged one UTF-16 unit at a time: 14.20, expected 14.16 |
| T14-6 | section-14 | 14 (likewise) | likewise |
| T14-7 | section-14 | 1 (landed), 6, 7, 8, 10 | the U+2028 `rename` exits 0; since Task 1 landed, first fails at Task 6's arm: `move specs/A.mdx specs/a<U+0022>b.mdx` exits 0, expected 1 |
| T14-11 | section-14 | 9 | arm (x): 14.15 reported once, expected five times |
| T14-12 | section-14-iii | 14 | arm (af): `<a` U+2EBF0 ` />` reported 14.20, expected 14.16 |

If T14-4 or T14-6 stays red after Task 14, read its first failing arm: they sweep every condition's home staging, and the tasks a later arm waited on beside Task 14 (Tasks 1, 2, 3, 4, and 5) have landed.

## Task 6 — A move destination containing a character 7.1 bars is `refused-invalid-destination` (SPEC 6.5, 7.1, 14.19, 14, 12.0; A5, C1's second bullet)

Task 5 has landed; reuse its predicate: `barredSpecPathCharacters(path)` in `src/core/discovery.ts` names the 7.1-barred characters a path holds, in first-occurrence order (empty when none), and `BARRED_SPEC_PATH_CHARACTER_LIST` names the rule's whole list for the cause's wording.

**Requirement.** SPEC 6.5 refuses as `refused-invalid-destination` a destination file path, a target file to be created included, "containing `"`, `'`, `\`, U+000A, U+000D, U+2028, or U+2029 (7.1, 14.19)" — anywhere in the path. The refusal exits 1, modifies nothing, and reports one finding concerning the destination as spelled (`path` the destination, `locations` `[]`); `--preview` reports the same (6.6). It is never a usage error: each such spelling is a well-formed argument value (12.0). Every other applicable reason reports beside it (14) — T6.5-21's two-reason arm puts `refused-exposed-derived-file` (Task 8) after it.

**Observed.** `move specs/Z.mdx "specs/a'b.mdx" --preview` exits 0, as does each other character. `move specs/A.mdx "specs/a'b.mdx"`, `move specs/A.mdx 'specs/a\b.mdx'`, and `move specs/A.mdx#x 'specs/B"q.mdx#x'` are performed. Since Task 5 landed, such a performed move also writes the destination's module and companions, and the moved-to workspace then fails `build` with the destination's 14.19: the post-move re-validation does not re-classify the destination path, so only the up-front cause below catches it.

**Location.** `assessDestinationPath` in `src/core/refusal.ts` (~206). It checks UTF-8, `#`, the path's shape, spec and code groups, `.mdx`, and the `.xspec.`/`.xspec/` exclusion — not these characters.

**Change.** Add the cause to the one finding's causes, in the part of the function after group matching, so the destination stays probeable and every other reason is still evaluated. In the section form, the cause matters only for a target file to be created: an existing target with such a path is already a 14.19 source, the invalid-workspace precondition's case.

**Verification.**
- Should turn green, Task 1 having landed: `section-6.5.test.ts` T6.5-4 (one file-form and one section-form arm per character, and the `'`-in-a-directory arms).
- Partially: `section-6.6.test.ts` T6.6-3 and `section-14.test.ts` T14-7 (both also wait on Tasks 7, 8, 10); `section-12.7.test.ts` T12.7-2 and `section-6.5-iv.test.ts` T6.5-21's two-reason arm (both also wait on Task 8).
- Neighbours: `section-6.5-ii.test.ts`, `section-6.5-iii.test.ts`.

## Task 7 — Move destinations: the derived-path relations of `refused-invalid-destination` (SPEC 6.5, 13.4, 14.22, 14; A6 (a)–(c) and (e), C9's first four bullets)

After Task 2 (landed; reuse its relation: `derivedPathConflicts` over plain path sets, every pair of an offending derived path and a source or derived path beneath it, and `derivedPathEntries` for every spec source's module, companion, and Markdown paths tagged with role and source, both in `src/core/derived-relation.ts`; `build`'s validations merge it with the occupied-component relation in `refusedWriteFindings`, `src/workspace/build-validation.ts`).

**Requirement.** SPEC 6.5 refuses as `refused-invalid-destination` "a file-form destination or a target file to be created, or a derived path it would generate, that is a directory component of another derived path the sources would generate after the move (13.1, 13.2, 7.3) or lies under one, or a derived path it would generate that is the path of, or a directory component of the path of, a discovered source other than a relocated origin". Its consequences:
- The relations read the workspace after the move. A file move relocates its origin, so the origin's own module, companion, and Markdown paths are retired and refuse nothing (T6.5-20(e)), and the relocated origin is exempt from the source relation (T6.5-20(c)'s performed exemption). A section move relocates no origin, so the origin keeps its path and its derived paths in both relations.
- Companions count as derived paths. Each relation holds whether or not anything occupies the paths.
- The refusal is one finding with the reason's other causes, concerning the destination (`path` the destination as spelled, `locations` `[]`), exit 1, nothing modified, `--preview` alike — never 14.22, since a refused operation reports refusal reasons alone (14). Where these relations meet the occupied-component relation at one component, the move still reports exactly one `refused-invalid-destination` (T6.5-20(a) after a build).
- So the finishing regeneration "cannot fail for any validation reason" (6.5).

**Observed (T6.5-20's stagings; spec globs `specs/**/*.mdx`).**
- (a) Before any build, beside `specs/A.mdx`: `move specs/Z.mdx specs/A.xspec.ts/B.mdx` previews with exit 0. The real move relocates and appends the journal, then exits 70 ("cannot write specs/A.xspec.ts/B.xspec.ts … is a plain file"), the regeneration writing `specs/A.xspec.ts` over the new directory and so losing the moved source. Likewise under a companion path (`specs/A.xspec.impl.js/B.mdx`) and for the section move creating `specs/A.xspec.ts/B.mdx` (the origin left empty, the moved text lost). Under `outDir: "out"` beside `specs/x.mdx`, `move specs/Z.mdx specs/x.md/y.mdx` is performed, leaving 14.22.
- (b) `outDir: "out"` beside `specs/a.md/b.mdx`: `move specs/Z.mdx specs/a.mdx` is performed, leaving 14.22. With `outDir: "specs/B.mdx/md"`, `move specs/Z.mdx specs/B.mdx` exits 70 after modifying the workspace.
- (c) Emission next to sources: moves whose emit, module, or companion path is a code source's path (`specs/B.md`) or a directory component of a source's (`specs/B.md/C.mdx`, `specs/B.md/x.ts`, `specs/A.xspec.ts/c.ts`, `specs/A.xspec.impl.js/c.ts`) are performed, overwriting or deleting the source. The section-form exemption staging `move specs/B.md/C.mdx#x specs/B.mdx#x` is performed, where it must be refused.
- (e) The section-form control `move specs/A.mdx#x specs/A.xspec.ts/B.mdx#x` exits 70 after modifying the workspace.
- Correct today: the occupied-component arm after a build, (c)'s file-form exemption, and (e)'s file-form moves under the origin's own derived paths.

**Location.** In `src/core/refusal.ts`: `assessDestinationPath` (~206), `evaluateMoveFileRefusals` (~856), `evaluateMoveSectionRefusals` (~1064). Their filesystem inputs are probed by the workspace layer (`src/cli/commands/move.ts`, `src/workspace/writes.ts`). Derived paths per source: `specSourceDerivedPaths` (already called in `assessDestinationPath`), companions per 13.1.

**Change.** Before anything is modified, and identically under `--preview`, apply Task 2's relation to the post-move path sets:
- the sources after the move — in the file form the origin replaced by the destination, in the section form the target file to be created added — code sources included;
- every derived path those sources generate, the destination's included.

Keep only the violations involving the destination or a derived path it would generate, and add each as a cause of the one `refused-invalid-destination` finding.

**Verification.**
- Should turn green, with Task 10: `section-6.5-iv.test.ts` T6.5-20 — (a)–(c) and (e) here, (d) in Task 10.
- Partially: `section-6.6.test.ts` T6.6-3, `section-14.test.ts` T14-7.
- Neighbours: `section-6.5.test.ts` (T6.5-4's occupied-component and symbolic-link arms must stay one finding), `section-6.5-ii.test.ts`, `section-6.5-iii.test.ts`, `section-13.4.test.ts`.
- By hand: each staging above exits 1 with exactly one finding, the workspace byte-unchanged and the journal absent or unchanged.

## Task 8 — `refused-exposed-derived-file` (SPEC 6.5, 13.4, 7, 14, 12.7; A7, C9's last bullet)

**Requirement.** SPEC 6.5: "`refused-exposed-derived-file` — a file-form move, while Markdown emission is enabled, whose origin's emit destination — no longer an emit destination once the relocation removes the origin, so no longer excluded from discovery (13.4) — holds an occupant discovery would then yield as a source (7, 13.4)." SPEC 14 gives it one finding concerning that path: `path` the origin's emit destination, `locations` `[]`, `identities` `[]`. 14 lists it after `refused-invalid-destination` and before `refused-invalid-rewrite`, which fixes its place in a findings array (12.7). Further:
- it is judged on its own terms beside every other reason: `move specs/A.mdx "specs/a'b.mdx"` in T6.5-21(a)'s staging reports `refused-invalid-destination` then `refused-exposed-derived-file`;
- a section move relocates no origin and never meets it (T6.5-21(e));
- a symbolic link, which discovery never yields (7), and a path no glob reaches expose nothing (T6.5-21 (c), (d)).

**Observed.** `move specs/A.mdx specs/sub/A.mdx` succeeds, its preview too, in T6.5-21 (a) — after a build, `specs/A.md` holding A's Markdown and a second spec glob `specs/*.md` reaching it — and (b) — no build, a user's plain `specs/A.md`, and a code group `specs/*.md`. In (b) the next `check` then fails with 14.20 on the exposed `specs/A.md`. The code is absent from `REFUSAL_CODES` in `src/core/findings.ts` (~96). Controls (c)–(e) behave.

**Location.**
- `REFUSAL_CODES` in `src/core/findings.ts` (~96): its order is SPEC 14's listing order and drives finding order.
- `evaluateMoveFileRefusals` in `src/core/refusal.ts` (~856), and the destination probing in the workspace layer.
- Discovery's rules in `src/core/discovery.ts`: what the groups' globs match, which occupants it yields, and the exclusions (`.xspec.` file names, `.xspec/` paths, emit destinations).

**Change.**
- Add the code between `refused-invalid-destination` and `refused-invalid-rewrite`. Grep for every other enumeration of refusal codes (renderers, exit-class helpers, comments) and update it.
- In the file form, while emission is enabled, probe the occupant at the origin's emit destination without following links. Report the finding when discovery would yield it once that path is no emit destination: a plain file that some configured group's globs match and that no other exclusion covers after the move.
- Keep the check independent of the destination's validity.

**Verification.**
- Should turn green: `section-6.5-iv.test.ts` T6.5-21 (its two-reason arm with Task 6).
- Partially: `section-12.7.test.ts` T12.7-2 (with Task 6), `section-6.6.test.ts` T6.6-3, `section-14.test.ts` T14-7.
- Neighbours: `section-6.5.test.ts`, `section-14.test.ts` (T14-6's stable codes).

## Task 9 — Import types and string-named module declarations are module-linking forms (14.15), each located per SPEC 14; `export import X = require(…)` is located from `import` (SPEC 4, 4.5, 14.15, 14's location rule, 1.7; A2, C3)

**Requirement.** SPEC 4 enumerates a TypeScript file's module-linking forms: an import declaration; an export declaration with a module specifier; an `import X = require(…)` declaration; a dynamic `import()` with a static string-literal specifier; an import type (`import("…")` in a type, `typeof import("…")` included); and a string-named module declaration (`declare module "…" { … }`, `declare` or not, a module augmentation included). Under 4 and 14.15:
- every form but an import declaration whose specifier ends in `.xspec` is 14.15 — including the non-relative wildcard `declare module "*.xspec" { }`, which designates nothing;
- every form whose relative specifier designates a derived-file path (a file name containing `.xspec.`, a path under `.xspec/`, or a configured Markdown emit destination while emission is enabled) other than through an import declaration's `.xspec` specifier is 14.15;
- nothing else names a module, so none of these is read, validated, or rewritten as a specifier: a `require(…)` call's argument, a triple-slash directive (a comment), a string literal elsewhere, a non-static dynamic `import()` (template literal included). Comments, JSDoc included, are comments.

SPEC 14's location rule for these:
- an import type: from `import` through the closing parenthesis of its argument list, a `typeof` before it and a qualifier or type arguments after it excluded — `typeof import("./A.xspec").default` and `import("./A.xspec").T<number>` each locate `import("./A.xspec")`;
- a string-named module declaration: by its own characters, `declare` included and a leading `export` excluded — `export declare module "./A.xspec" { }` from `declare`;
- `export import X = require("./A.xspec")`: from `import`, the leading `export` and what separates it excluded, as 1.7 excludes one.

**Observed.** None of these is reported: `type T = import("../specs/A.xspec")`, `let v: typeof import(…)`, `declare module "../specs/A.xspec" { }` alone or beside `export {}`, `module "…" { }`, `declare module "…";`, `declare module "*.xspec" { }`, nor either new form naming a derived-file path (`../specs/A.xspec.ts`, `../specs/A.xspec.impl.js`, `../.xspec/x`, an emit destination). `export import X = require("../specs/A.xspec");` after `const z = 1;` and one line feed is located from `export` (13) instead of `import` (20). The other forms already behave.

**Location.** In `src/core/code-analysis.ts`:
- the walk (~1500–1575) returns early on interface and type-alias declarations and on every type node (`if (ts.isTypeNode(node)) return;` ~1559), and never examines module declarations;
- `visitImportCall` (~1580) and `checkDerivedSpecifier` hold the rules for a dynamic `import()`;
- the `import X = require(…)` handling (`visitImportEqualsUse` and that finding's range).

**Change.**
- Collect import types (`ts.isImportTypeNode`) wherever they stand — type aliases, interfaces, annotations, type arguments — and string-named module declarations (`ts.isModuleDeclaration` with a string-literal name) at any depth, without walking type positions as value context: 4.5's type-level exemption for bindings stands, and an import type is no value use. A separate pass over the tree is simplest.
- Judge each by the dynamic `import()`'s rules — the `.xspec` suffix and derived-file designation, the specifier read as spelled (2.4). Locate each per SPEC 14 above; compute an import type's range from its `import` keyword to the `)` closing its argument list, import attributes inside the parentheses included.
- Start the `export import … = require(…)` range at `import`.
- Record no edge and no occurrence for any of them.

**Verification.**
- Should turn green: `section-4.test.ts` T4-2, `section-14.test.ts` T14-11 (its 14.15 per-form arm (x)).
- Feeds Task 10: `section-6.5-iv.test.ts` T6.5-20(d) stages an import type and a `declare module` among its six forms, so its refusal needs this task's collection of them.
- Neighbours: `section-4.5.test.ts`, `section-4.6.test.ts`, `section-2.1.test.ts`, `section-1.6-1.7.test.ts`, `section-5.7.test.ts`, `section-16-p4.test.ts`.

## Task 10 — Move: a destination whose would-be emit path a code source's module-linking form designates is `refused-invalid-destination` (SPEC 6.5, 4, 14.15, 14; A6 (d), C9's fifth bullet)

After Task 9.

**Requirement.** SPEC 6.5's last `refused-invalid-destination` clause: "or, while Markdown emission is enabled (7.3), the path the destination would emit Markdown to (13.2) designated by the relative specifier of a code source's module-linking form, which the move would make a derived-file path (4, 14.15)". Its scope and form:
- every module-linking form of SPEC 4 counts — Task 9's set: import and export declarations, `import X = require(…)`, a static dynamic `import()`, an import type, a string-named module declaration; a `require(…)` call, a triple-slash directive, and a template-literal `import()` do not;
- it applies to a file-form destination and to a section-form target file to be created alike;
- the cause joins the one `refused-invalid-destination` finding concerning the destination (`locations` `[]`). A refused operation reports refusal reasons alone, never 14.15 (14).

**Observed.** Emission next to sources, with `src/c.ts` holding one form whose specifier is `../specs/B.md`, then `move specs/Z.mdx specs/B.mdx`:
- for an import, an export, `import =`, and a dynamic `import()`, the move is refused, but as numbered condition 15 (`invalid-import`, located in `src/c.ts`) by the post-move re-validation;
- for an import type and `declare module`, the move is performed, leaving 14.15 behind;
- the controls (emission disabled; `require(…)`, `/// <reference path>`, template-literal `import()`) behave.

**Location.**
- `evaluateMoveFileRefusals` (~856) and `evaluateMoveSectionRefusals` (~1064) in `src/core/refusal.ts`, which need each code source's module-linking specifiers as input (from the code analyses the move already holds).
- The specifier resolution `checkDerivedSpecifier` uses in `src/core/code-analysis.ts`.
- The post-move re-validation in `src/cli/commands/rewrite-validation.ts`, which must never be what reports this case.

**Change.** Have the code analysis expose every module-linking form's specifier with its file. Resolve each relative specifier lexically from its file's directory, as 14.15's derived-path check does (the resolution of 2.1 and 4). While emission is enabled, add the cause when one designates the destination's would-be Markdown emit path (`specSourceDerivedPaths(destination).markdown`).

**Verification.**
- Should turn green, with Task 7: `section-6.5-iv.test.ts` T6.5-20 — its (d) arm and (d)'s section-form stagings.
- Partially: `section-6.6.test.ts` T6.6-3, `section-14.test.ts` T14-7.
- Neighbours: `section-4.test.ts`, `section-6.5.test.ts`.

## Task 11 — A `defer` configuration import is a configuration error (SPEC 7, 14.14; B1, C14)

**Requirement.** SPEC 7: the configuration file consists of exactly an import of `defineConfig` from `"xspec"` — "optionally aliased; no `type` or `defer` modifier and no import attributes" — and a default export of one call to that binding. `import defer { defineConfig } from "xspec"`, and its aliased form `import defer { defineConfig as dc } from "xspec"`, is therefore a configuration error, exit 2 (14.14), though TypeScript 5.9.3 parses it without diagnostics.

**Observed.** Both forms, each followed by a valid `export default …(…)`, load, and `build` exits 0 with `{"findings": []}`. The `type` clause, the `type` specifier, `with {…}`, `with {}`, and `assert {…}` are already refused.

**Location.** The import-clause checks in `src/core/config.ts` (~318–345), which test `clause.isTypeOnly` alone.

**Change.** Refuse an import clause whose phase modifier is `defer` (TypeScript 5.9's `ImportClause.phaseModifier === ts.SyntaxKind.DeferKeyword`, `ts` reached through `src/core/ts-module.ts`), in the existing message style, at the clause's line, citing SPEC 7.

**Verification.**
- Should turn green: `section-7-basics.test.ts` T7-2, whose `defer` arm is its only failing arm.
- Neighbours: the rest of `section-7-basics.test.ts`, `section-14.test.ts` (T14-4's 14.14 rows).

## Task 12 — A `markdown.outDir` naming the graph-data area is a configuration error (SPEC 7.3, 14.14, 13.3, 11.6; B3, C2)

**Requirement.** SPEC 7.3: "So is an `outDir` of `.xspec` or beginning with `.xspec/`: no emit destination lies in the graph-data area (13.3), which holds graph data at unenumerated paths beside the journal (6.1) and review sessions (10.1), so graph data is the only derived file under it". 14.14 lists "a `markdown.outDir` not in workspace-relative form or naming the graph-data area or a path under it". Comparison is byte-wise (12.0): `.xspec2`, `.xspecs/md`, `out/.xspec`, and `.XSPEC` are not the area and stay valid.

**Observed.** An `outDir` of `.xspec`, `.xspec/md`, or `.xspec/reviews` builds with exit 0 and emits under `.xspec/`; the inventory then lists `.xspec/md/specs/A.md` as derived and recorded, against 11.6. The look-alikes are already accepted.

**Location.** The `outDir` validation in `src/core/config.ts` (~963–990) and `outDirSpellingProblem` in `src/core/discovery.ts` (~215).

**Change.** After the spelling check, refuse `outDir === ".xspec"` and any `outDir` beginning with `.xspec/` as a configuration error naming the graph-data area (SPEC 7.3, 14.14).

**Verification.**
- Should turn green: `section-7.1-7.3.test.ts` T7.3-1, which fails first at its `".xspec"` arm; reviewer B checked that its later arms pass.
- Neighbours: `section-7-basics.test.ts`, `section-11.6.test.ts`, `section-13.1-13.2.test.ts`.

## Task 13 — A root node's tags are reported absent on `query` and `show` (SPEC 11.1, 12.4, 12.7, 5.5; B4, C12)

**Requirement.** SPEC 11.1: `node` reports tags and the coverage attribute, and "for a root node the tags and the coverage attribute are both reported as absent (5.5)"; the rows of `nodes`, `subtree`, and `ancestors` carry "tags and coverage attribute both absent for roots". SPEC 12.4: `show` prints "tags and coverage attribute (both absent for a root node, 11)". SPEC 12.7's value forms: `null` never encodes emptiness, and `[]` is a tagless section's tag set — so `[]` for a root reports a tag set the root does not have.

**Observed.** `query node <root>` and the root rows of `query nodes`, `query subtree`, and `query ancestors` give `"tags": []`; so does `show --json <root>`; human `show <root>` prints an empty `tags:` line, identical to a tagless section's. The root's coverage is already omitted, and `view` already gives a root `tags: null`.

**Location.** `rowJson` (~98) and `nodeReportOf` (~120) in `src/cli/commands/query-core.ts` (`QueryRow.tags` ~46); `src/cli/commands/query-fast.ts` (~31, rows read from graph data); `renderNodeHuman` in `src/cli/commands/show.ts` (~52).

**Change.** On every one of these surfaces, report a root's tags as absent: omit the member exactly as `coverage` is omitted in the same objects, or give `null` (T11-1, T11-2, and T11-3 accept either) — the same choice for `query` and `show --json` — and omit the human `tags:` line for a root as its `coverage:` line is omitted. Tagless sections keep `[]`. The fast path (graph-data rows) and the analysis path must agree.

**Verification.**
- Should turn green: `section-11.test.ts` T11-1, T11-2, T11-3.
- Neighbours: `section-12.3-12.5.test.ts` (`show`), `section-11.4.test.ts`, `section-12.7.test.ts`, `section-13.3.test.ts` (the fast path).

## Task 14 — Supplementary-plane identifier characters are valid in MDX JSX names (SPEC 14.20, 2.7, 14.16, 14.17; C7)

**Requirement.** SPEC 14.20: "ECMAScript 2024 takes its identifier characters, JSX names' included, and its space separators from the latest Unicode version: here Unicode 15.1's". A JSX element or attribute name whose characters ECMAScript admits — ID_Start, then ID_Continue (JSX names also admit `-`) — under Unicode 15.1 therefore derives, supplementary-plane characters included:
- an element `<a`, U+2EBF0, ` />` alone on its line derives, and is 14.16 at the element, never 14.20;
- `<S id="x" a`, U+2EBF0, `="v">…</S>` derives, and is 14.17 (an unknown prop) at the attribute.
Expression containers and ESM blocks already accept such characters.

**Observed.** Any supplementary-plane identifier character in a JSX element or attribute name — U+2EBF0, and older ones such as U+10400 and U+1D465 — gets 14.20 ("Unexpected character U+D87A … in name"). `micromark-extension-mdx-jsx` 3.0.2, beneath `remark-mdx`, tests identifier characters one UTF-16 code unit at a time (`estree-util-is-identifier-name`'s `start`/`cont` on each code), so a surrogate pair never passes.

**Location.** The MDX parse in `src/core/mdx.ts` (`remark-mdx`, ~59) and the 14.20 locator in `src/core/mdx-syntax-failure.ts` (~60). The two must agree on what fails and where.

**Change.** Make both judge JSX names by code point under the runtime's Unicode tables (Node 22's `\p{ID_Start}`/`\p{ID_Continue}` follow Unicode 15.1), keeping `remark-mdx` as the parser (IMPLEMENTATION) and every byte offset exact (1.7, 14). The approach is yours — for instance a same-length substitution of each supplementary-plane identifier character in JSX name positions before parsing, mapped back wherever names are read, or a wrapped name tokenizer. Names must still be read as spelled, so the element above stays an invalid construct and the attribute an unknown prop. A supplementary-plane character that is no identifier character stays 14.20 in a name. Note any dependency choice in your final report.

**Verification.**
- Should turn green: `section-14-iii.test.ts` T14-12 (arm (af)); `section-14.test.ts` T14-4 and T14-6, which sweep T14-12's stagings (see the note under the index if either stays red).
- Neighbours: `section-2.7.test.ts`, `section-2.2-2.3.test.ts`, `section-1.6-1.7.test.ts`, `section-3.test.ts`, `section-16-p2-p3.test.ts`.

## Task 15 — An added import's identifiers avoid every name SPEC 6.5 bars (SPEC 6.5 "Added imports", 12.0; A8)

**Requirement.** SPEC 6.5 "Added imports" constrains each identifier an added import binds. Those not met today:
- one that module code, strict throughout, admits as a binding: no ECMAScript reserved word (`default`, `enum`, `await`, and `yield` among them), and none of `let`, `static`, `implements`, `interface`, `package`, `private`, `protected`, `public`, `eval`, and `arguments` — most already barred;
- none of `require` and `exports`, and none beginning with `__`;
- none naming a global the compiler's emitted code may read: a property ECMAScript 2024, Annex B included, defines on the global object, `Iterator`, `AsyncIterator`, or `SuppressedError`. Clause 19's properties are `globalThis`, `Infinity`, `NaN`, `undefined`; `eval`, `isFinite`, `isNaN`, `parseFloat`, `parseInt`, `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent`; the constructors `AggregateError`, `Array`, `ArrayBuffer`, `BigInt`, `BigInt64Array`, `BigUint64Array`, `Boolean`, `DataView`, `Date`, `Error`, `EvalError`, `FinalizationRegistry`, `Float32Array`, `Float64Array`, `Function`, `Int8Array`, `Int16Array`, `Int32Array`, `Map`, `Number`, `Object`, `Promise`, `Proxy`, `RangeError`, `ReferenceError`, `RegExp`, `Set`, `SharedArrayBuffer`, `String`, `Symbol`, `SyntaxError`, `TypeError`, `Uint8Array`, `Uint8ClampedArray`, `Uint16Array`, `Uint32Array`, `URIError`, `WeakMap`, `WeakRef`, `WeakSet`; and `Atomics`, `JSON`, `Math`, `Reflect`. Annex B (B.2.1) adds `escape` and `unescape`. Check this list against ECMAScript 2024 itself;
- in a TSX source (a `.tsx` file name, 14.20): `React`, and the leading identifier of a factory that a `@jsx` or `@jsxFrag` pragma in any of the file's comments names — line or block comment, anywhere in the file — the pragma's name matched regardless of ASCII case (12.0's second exception). Examples: `h` from `/** @jsx h */`, `/* @JSX h */`, or `// @jsx h`; `preact` from `@jsx preact.h`; `Frag` from `@jsxFrag Frag`.

The other constraints — bound by no declaration in any scope at value or type level, equal to no referenced name, distinct from the others added, and in a spec source none of `S`, `Spec`, `text` — already hold (T6.5-22's scope, type-level, and referenced-name lures pass).

**Observed.** `freshBindingName` bars only reserved words, `eval`, `arguments`, `S`, `Spec`, and `text`. In spec and TypeScript receivers it binds `Object` (and any other global-object property), `escape`, `unescape`, `Iterator`, `AsyncIterator`, `SuppressedError`, `require`, `exports`, and `__x`; in TSX receivers it binds `React`, with or without JSX in the file, and pragma-named factories (`h`, `preact`, `Frag`, a pragma inside a function included). P-5 added `import require from "./require.xspec"`.

**Location.** `freshBindingName`, `RESERVED_BINDING_NAMES`, and `COMPILER_PROVIDED_NAMES` in `src/core/move.ts` (~640–735), and the `taken` sets its callers build (~838, ~2297, ~2318).

**Change.** Add one barred-name predicate — the fixed sets, the `__` prefix, and, for a `.tsx` receiver, `React` plus the pragma factory names gathered from all of the file's comments (TypeScript's scanner or comment ranges give them) — and apply it in `freshBindingName` for every receiving file. Keep the choice deterministic: the stem base, then numeric suffixes.

**Verification.**
- Should turn green: `section-6.5-iv.test.ts` T6.5-22, `section-16-p5-p6.test.ts` P-5.
- Neighbours: `section-6.5.test.ts`, `section-6.5-ii.test.ts`, `section-6.5-iii.test.ts`, `section-6.5-v.test.ts`, `section-1.4.test.ts` (T1.4-5's added imports).

## Task 16 — Added-import placement in a TypeScript source: after the directive prologue, directly after a top-level statement's end with only 1.4 whitespace between (SPEC 6.5 "Added imports", 1.4; A9)

**Requirement.** SPEC 6.5's TypeScript bullet of an admissible offset: "the offset lies at or after the end of the file's directive prologue (ECMAScript's: its leading statements each a string literal alone, such as `"use client"`) and follows the end of a top-level statement with nothing but whitespace (1.4) between, so that the added line parts no comment from the statement it precedes (a `// @ts-expect-error` from the line it governs) — the prologue's end and the statement's each judged, like timeliness, over the file before the edit, a statement the rewrite removes included, so the added line can take a removed declaration's place". In detail:
- the whitespace is 1.4's six characters (U+0009, U+000A, U+000B, U+000C, U+000D, U+0020), not ECMAScript's — U+00A0 and U+2028 are no whitespace here, and U+2028 is no line terminator (3);
- offset 0 follows no statement's end, so it is never admissible in a TypeScript source;
- these conditions join the existing ones (inside no pre-edit statement; the composed file well-formed with the added line a top-level import declaration), under the existing line-start preference.

**Observed (T6.5-23).** The product takes a line start that follows a trailing comment, and judges whitespace as ECMAScript does:
- (a), the start of a line lying between two directives: inserts at 73, expected 26, 27, 64, or 65;
- (d): inserts at 46, expected 37 or 38; (d) with U+00A0: inserts at 40, expected 37;
- (e), 6.5's own shape: inserts at 130, expected one of 51, 52, 79, 80, 123, 124;
- (n), and (n) with `namespace N {`: inserts at 46, expected 37 or 38.

**Location.** In `src/core/move.ts`: `placeCodeImportAdditions` (~1531), `additionCandidates` (~1355), `admitsAddedCodeDeclarations` (~1510), and their caller in the code-file rewrite (~2790–2830).

**Change.** Filter a TypeScript source's candidates by both conditions, judged over the pre-edit file's top-level statements — TypeScript's parse of the original bytes, statements the rewrite removes included. The offset must lie at or after the prologue's end, and every byte between some top-level statement's end (its `;` included) and the offset must be 1.4 whitespace. Keep the line-start preference and determinism. Spec sources are unaffected.

**Verification.**
- Partially: `section-6.5-v.test.ts` T6.5-23 — arms (a), (d), (e), and (n) here; (f), (k), (l), (m), and (d)'s U+2028 staging wait on Task 17.
- Neighbours: `section-6.5-ii.test.ts` (T6.5-8 through T6.5-11), `section-6.5-iii.test.ts`, `section-6.5.test.ts`, `section-6.6.test.ts` (T6.6-4's addition offsets).

## Task 17 — Timeliness in a TypeScript source: re-root only at timely bindings, and add declarations where their bindings are timely (SPEC 6.5 "Reference spellings" and "Added imports"; A10)

After Task 16 (same placement code).

**Requirement.** SPEC 6.5: in a TypeScript source, a binding a rewritten spelling — a chain, or a call's callee — is rooted at must be timely for it: "a binding is timely for a spelling the operation roots — a chain, or a call's callee — when its declaration is or precedes that of the binding the spelling was rooted at before the operation, or follows it with no top-level statement between them but import declarations (positions in pre-operation coordinates, an added declaration's at its offset)". Consequences:
- an existing binding is reused only when timely, as well as unshadowed at the occurrence (as today). Where the file holds no timely binding, an added declaration's binding roots the spelling — "an import is added exactly where a file lacks a binding a spelling is rooted at" — so a file may gain a second declaration of a module it already imports;
- an added declaration's offset must make its bindings timely for every spelling rooted at them (6.5's TypeScript admissibility bullet);
- callees (`text` bindings) are judged like chain roots;
- any top-level statement other than an import declaration breaks the succession — `type T = number` and `import Z = require("./z")` included — while `import type { T } from "./t"` and `import "./p"` do not;
- spec sources have no timeliness (T6.5-23(o)).

**Observed.**
- (f), 6.5's own example: the product writes `B.m` and adds nothing, where a fresh declaration of B's module at the start of line 2 and `<X>.m` are expected; the same with `type T = number` or `import Z = require("./z")` between the two declarations.
- (m): it roots `A1.m` at the untimely `B`.
- (k) and T6.5-11(f): it roots the callee at the untimely `tb` and `tt`.
- (l): it adds the declaration after `A2`'s, past the statement `A1.m`.
- (d) with U+2028: it appends at the file's end, after `f`; expected 37.

**Location.** In `src/core/move.ts`: `existingBinding` (~2227; used ~2291 for default bindings and ~2312 for `text` bindings), the addition bookkeeping (`fresh.added`, ~2297–2320), and the placement filter Task 16 adds to `placeCodeImportAdditions`.

**Change.** Give each rooted spelling its pre-operation binding's declaration position. In TypeScript sources, make `existingBinding` skip untimely bindings; where no timely binding exists, root the spelling at the added declaration, which binds exactly the lacked default and/or `text` binding, one declaration per module. Filter placement candidates to offsets timely for every spelling rooted at the added bindings.

**Verification.**
- Should turn green, with Task 16: `section-6.5-v.test.ts` T6.5-23; `section-6.5-ii.test.ts` T6.5-11 (arm (f)).
- Neighbours: `section-6.5-iii.test.ts` (T6.5-18's shadowing), `section-6.5.test.ts`, `section-6.6.test.ts`, `section-16-p5-p6.test.ts` (P-5).

## Task 18 — `review create` with a case variant of a corrupt session's name reports the corruption (SPEC 10.1, 10.7, 14.21, 13.5; B5, C13)

**Requirement.** SPEC 10.1: a name that matches an existing session's name ignoring ASCII case "is treated at `review create` as the name of an existing session and refused (10.7)". SPEC 14.21 reports a corrupt session "by any `review` subcommand naming the session", and SPEC 13.5 orders `review create`'s "existing-name refusal (10.7), the corruption reported in that refusal's place (14.21)". So when the session a case variant collides with is corrupt, `create` reports exactly one `corrupt-session` finding concerning that session's file (for example `.xspec/reviews/foo.json`), exit 1, nothing created — as the exact-name case already does.

**Observed.** With `.xspec/reviews/foo.json` unparseable, or a directory, `review create --strategy audit --name Foo --json` exits 1 with the code-less existing-name refusal, identities `["Foo","foo"]`. `--name foo` is already correct. This gap was also open at the `9d095d9` determination.

**Location.** `src/cli/commands/review.ts`: the `existingNameIgnoringAsciiCase` branch (~237–251), just after the exact-name branch (~220–236), whose occupant handling shows how a corrupt exact-name session is reported.

**Change.** Classify the colliding session as the exact-name branch does, and when it is corrupt, report its 14.21 finding in the refusal's place. Where several sessions collide, decide deterministically (report each colliding corrupt session's 14.21, or judge the one `existingNameIgnoringAsciiCase` names) and say which in a comment.

**Verification.**
- No suite test pins it. By hand: `review create --strategy audit --name foo`, overwrite `.xspec/reviews/foo.json` with `{broken`, then `review create --strategy audit --name Foo --json`; repeat with a directory at that path; check the healthy collision still gives the code-less refusal.
- Regressions: `section-10.1.test.ts`, `section-10.7-i.test.ts`, `section-10.7-ii.test.ts`, `section-12.0-ii.test.ts` (T12.0-10's past-the-gate corruption arm).

## Task 19 — TypeScript instantiation expressions over spec bindings are dynamic references or unsupported uses (SPEC 2.4, 4.5, 14.8, 14.18; A3)

After Task 9 (same walk).

**Requirement.** SPEC 2.4: optional chaining, parentheses, and other access forms applied to a chain make it dynamic, and "a non-null assertion (`BASE.a!`), a type assertion, or any other TypeScript-only syntax is dynamic in a TypeScript source". SPEC 4.5: a non-static bare reference in expression-statement position, like a non-static `text(...)` argument, is 14.8; any other value-level use of a node or of a `text` binding is 14.18. An instantiation expression (`A.a<X>`, `A<X>`, `text<X>`) is such value-level TypeScript-only syntax, not a type position.

**Observed.** Each of these builds with exit 0 and records no finding, edge, or occurrence:
- `A.a<X>;` and `A<X>;` — expected 14.8 at the statement's expression;
- `text(A.a<X>)` — expected 14.8 at the call;
- `export const g = text<X>;`, `export const h = A.a<X>;`, `[A<X>]`, and `f(A.a<X>)` — expected 14.18.
This gap was also open at the `9d095d9` determination.

**Location.** In `src/core/code-analysis.ts`: the walk's `if (ts.isTypeNode(node)) return;` (~1559), which swallows `ExpressionWithTypeArguments`; `climbUseExpression` and `leftmostIdentifier` (~2593–2640), which list the TypeScript-only wrappers (`NonNullExpression`, `AsExpression`, `SatisfiesExpression`, `TypeAssertionExpression`) that already make a chain dynamic.

**Change.** Treat an `ExpressionWithTypeArguments` that stands outside a heritage clause as a value expression: walk its `expression`, and add it to the wrappers in `climbUseExpression` and `leftmostIdentifier`, so each spelling above is judged, and located, exactly as a non-null assertion over the same chain is. Heritage clauses keep their current handling.

**Verification.**
- No suite test pins it. By hand: each spelling above beside its non-null-assertion twin (`A.a!;`, `text(A.a!)`, `export const h = A.a!;`), comparing codes and ranges.
- Regressions: `section-2.4.test.ts`, `section-4.test.ts`, `section-4.5.test.ts`, `section-14.test.ts` (T14-11), `section-16-p4.test.ts`.

## Task 20 — In TypeScript, `text?.(A.a)` and `text<X>(A.a)` are sanctioned `text` calls (SPEC 4.5, 4.3, 14.8, 5.7, 2.3; A4)

**Requirement.** SPEC 4.5 sanctions a node "as the sole argument of a call whose callee is a spec module's `text` export", and a `text` binding "as such a callee". None of 14.8's cases applies to an optional call or to type arguments on a call whose one argument is static: 14.8 covers a non-static reference, a call without exactly one argument, and a string-form argument in a TypeScript file. 2.3's optional-call exclusion concerns MDX embeddings alone (the MDX `{text?.("a")}` stays 14.16), and type arguments are type-level (4.5). So each call records its `embeds` edge and its occurrence (4.3, 5.7; the occurrence spans callee through closing parenthesis) and reports nothing.

**Observed.** Both calls are reported as 14.8 ("an optional call is not a plain text(...) call"; "a text(...) call does not take type arguments"). This gap was also open at the `9d095d9` determination.

**Location.** `analyzeTextCall` in `src/core/code-analysis.ts` (~1852–1876).

**Change.** Drop those two 14.8 branches, so such calls take the ordinary `text` call judgement: arity, string form, static argument, cross-module call. Check that a section move carrying such a call's target into another file still rewrites the call whole over its occurrence span, as 6.5 composes a rewritten call, and that the preview's `reference-rewrite` spans it. If this reading turns out to collide with a test, stop and record it as the rules above say.

**Verification.**
- No suite test pins it. By hand: both forms (`query edges`, `occurrences`), the cross-module variant (14.11), and the MDX control.
- Regressions: `section-4.3-4.4.test.ts`, `section-4.5.test.ts`, `section-5.7.test.ts`, `section-6.5-ii.test.ts` (T6.5-11), `section-2.2-2.3.test.ts`.

## Task 21 — A discovered source whose content the environment refuses is reported with a fitting correction (SPEC 14, 14.25, 14.20; B's uncounted note)

**Requirement.** SPEC 14: `build` and `check` "MUST report actionable errors that identify the file, location, and correction". SPEC 14.25: a refused read of a discovered source's content is condition 20, its finding at offset 0, the file masked as one that fails to parse. The code and range are already right; the correction is not.

**Observed.** As uid 1000, a discovered source whose permissions refuse reading gets 14.20 at offset 0 with the message "the discovered file could not be read — it changed or vanished while the command ran; re-run the command once the workspace is quiescent" — the wrong correction for a permission refusal, which no rerun cures.

**Location.** `unreadableSourceFinding` in `src/workspace/pipeline.ts` (~527, called ~288, ~335, ~365) and the readers above it (`readSourceBytes` ~495 and `readInvalidSourceBytes` ~511), which discard the error.

**Change.** Keep the failure's kind from the reader. A file that vanished keeps the current message; a refused read (permission denied, an I/O error) says the environment refused to deliver the file's content, naming the reason (for example `EACCES`), and tells the user to make the file readable or keep it out of the configured globs, citing SPEC 14.25 and 14.20. Code and range unchanged.

**Verification.**
- No suite test pins the wording. By hand, as uid 1000 (`unshare --map-user=1000 --map-group=1000 -- …`): a source with mode 000, then the same file deleted mid-run if you can stage it.
- Regressions: `section-14-ii.test.ts` (T14-10's refused-read table, Linux leg), `section-11.2.test.ts`, `section-14.test.ts`.

## Task 22 — The human report presents a non-UTF-8 path distinguishably from every plain path (SPEC 12.0, 12.7; C10)

**Requirement.** SPEC 12.0: a workspace-relative path that is not valid UTF-8 "is presented in an explicitly marked byte form (12.7) that carries the path's exact bytes and is distinguishable from every plain path string, deterministically; a valid-UTF-8 path is never presented in the marked form". The JSON form `{"bytes": "…"}` meets this already; the human form must meet it too.

**Observed.** `renderPathText` presents such a path as `<bytes HEX>`, which a valid path can spell literally. With code globs `src/**/*.ts` and `<bytes*`, a file named `src/` + the byte 0xFF + `.ts` and a file named `<bytes 7372632fff2e7473>` both appear in human `build` output as `<bytes 7372632fff2e7473>`. This gap was also open at the `9d095d9` determination.

**Location.** `renderPathText` in `src/core/path-text.ts` (~151) and the human-output paths that call it.

**Change.** Choose a deterministic human presentation under which no plain path renders the same as any marked one — for instance, escape a plain path whose spelling could be read as the marker, or use a marker no plain path string can equal — and state the scheme in the code comment. Keep the JSON form unchanged, and keep every plain path's human presentation carrying its exact characters (12.0: the human and JSON reports carry the same information).

**Verification.**
- No suite test pins it. By hand, on Linux (stage the non-UTF-8 name with a byte-level tool, e.g. Python's `os.open` on a bytes path): the two files above render differently.
- Regressions: `section-1.5.test.ts` (T1.5-2's non-UTF-8 arm), `section-12.0-iii.test.ts`, `section-12.7.test.ts`, `section-11.6.test.ts`.

## Task 23 — Mutual exclusion holds per workspace whatever the environment or user (SPEC 13.5, 12.0; C11)

**Requirement.** SPEC 13.5: "All state is workspace-local"; the mutating commands — `rename` and `move` (their previews excepted) and `review create`, `resolve`, `split` — "are mutually exclusive per workspace: while one runs, another MUST fail promptly — without waiting for the holder's exclusivity to end — with a usage error (12.0), modifying nothing"; a terminated holder never blocks later commands. Every exit stays within 12.0's partition, never the internal-error exit. Two constraints bind the design: T13.5-1 requires the workspace byte-identical while held (the harness snapshots the whole workspace root), so nothing may appear in the tree during a hold; IMPLEMENTATION forbids platform-specific code paths.

**Observed.** `mutationLockPath` puts the lock at `os.tmpdir()/xspec-<uid>-<hash>.lock`. While `rename … --test-hold` runs under `TMPDIR=A`, a second `rename` on the same workspace under `TMPDIR=B` succeeds, and both are journaled; by the code, different users are not excluded either. With `TMPDIR` pointing at a plain file, every mutating command exits 70 ("internal error"). This gap was also open at the `9d095d9` determination.

**Location.** `src/workspace/lock.ts` (`mutationLockPath` ~94, acquisition, release, and the holder-liveness check).

**Change.** Key the exclusion on the workspace alone — a lock every process operating on the workspace finds, whatever its `TMPDIR` or user — that leaves the workspace tree byte-identical while held and recovers from a terminated holder; turn an unusable lock location into a 12.0 usage error, not exit 70. If no design meets 13.5, T13.5-1, and IMPLEMENTATION together, do not compromise silently: record the conflict, dated and precise, in `specs/tmp/SPEC-PROBLEMS.md` (or `specs/tmp/TEST-SPEC-PROBLEMS.md` if the test over-reaches), commit, push, and end with `OUTCOME: PROBLEM — <file>`.

**Verification.**
- Should stay green: `section-13.5.test.ts` (T13.5-1 through T13.5-7; T13.5-7 runs on the Linux leg as uid 1000), `section-6.6.test.ts` (T6.6-3's scheduling arm), `section-16-p10.test.ts`.
- By hand: two held mutations of one workspace under different `TMPDIR` values (the second must fail promptly with a usage error); `TMPDIR` pointing at a plain file (no exit 70); a killed holder (the next command proceeds).

## Task 24 — Confirm the full suite and CI are green, record the state, and delete this file

After every other task.

**Change.**
- Run `npm ci` if needed, then `npm run build`, `npm run typecheck`, and `npm run format:check`.
- Run the self project, then the suite project, both under the unprivileged namespace and CI's conditions (`AGENTS.md`'s recipes; run in the background and poll). Expect 0 failures, and certification at `b3cc3e3`'s figures — 154 PASS / 38 FAIL / 0 error / 0 hang, the FAILs being violators' expected outcomes — since the harness must not have changed (`git diff b3cc3e3 -- test/ .github/` empty).
- Push, then read CI on the head commit — `harness-self`, `suite-linux`, and `suite-windows` — as `AGENTS.md`'s "Reading a CI run from this sandbox" bullet describes.
- Rewrite `AGENTS.md`'s last bullet (the known state after the previous Phase 10 plan) with the new run facts, and record there this plan's opening VERIFY timings, which that read-only step could not write: local full run 1626.03 s under load; CI run 1003's `npm test` 719.51 s, harness self-tests 126.73 s, Windows leg 40.21 s.
- If anything is red, add precise new tasks above this one instead of deleting this file. When everything is green, delete `specs/tmp/FIX_PLAN.md` in the same commit; if the permission system refuses the deletion, stop and report it — never move the file or otherwise work around the refusal.

**Verification.** The runs above.
