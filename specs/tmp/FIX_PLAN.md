# FIX_PLAN — Phase 10 (after the re-descent): product adherence to `specs/SPEC.md`

Source: the compliance determination that opened Phase 10 after Phase 9's re-descent closed at `3bfedb5` (branch `claude/xspec-ui-apis-4df8fa`, PR #7; governing IP `specs/patches/0001-external-ui-apis.md`, Stage: Tested; bundle `specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`). Reviewer A (SPEC §1–6) returned 27 gaps, reviewer B (§7–11) 16, reviewer C (§12–15) 20. VERIFY was red on 82 diagnosed product failures, exactly the known set in `AGENTS.md`'s last bullet (CI `suite-linux` red on the same 82; `harness-self` and `suite-windows` green; self project 2950/2950; certification 144 PASS / 33 FAIL / 0 error / 0 hang). The product's last change is `35acd95`. The earlier Phase 10 plan of `72ad038` was superseded by the re-descent before any of its tasks landed; its Tasks 1–3 reappear below as Tasks 30, 32, and 27. Findings are cited as A<n>, B<n>, C<n> (reviewer, gap number); where reviewers reported the same gap, it is one task.

Goal: every test passes — `npm test` locally, and CI's `harness-self`, `suite-linux`, and `suite-windows` on the PR — and the product meets SPEC.md. Tasks 21 (in part), 27, and 53 fix SPEC departures that no test currently pins; they are in scope all the same.

Not planned: reviewer B's explicit non-gap (`query` reports a root's `tags` as `[]` and omits its coverage): 12.7 fixes no `query` form and T11-1/T11-2 assert `[]`, so the reviewer did not count it.

**Rules for every task (read once per spawn):**

- Phase 10: never modify the test harness — nothing under `test/` (fixtures included) or `.github/`. Edit product code (`src/`), this file, the problems files, and `AGENTS.md` (build/lint/run knowledge only). Never couple the product to the harness: reading a registry module to see what a test stages is fine; importing or mirroring harness helpers is not.
- Respect `specs/IMPLEMENTATION.md`: pure `core`, I/O `workspace`, rendering `cli`; findings built as data and rendered once per output form; one canonical JSON serializer; remark-mdx (unified/remark, acorn beneath it) for MDX and the TypeScript compiler API for TypeScript; no new runtime dependency without a spec-grounded reason; no platform-specific code paths. Where code implements a numbered SPEC rule, cite the section in a comment.
- Build and run: `npm run build` (tests drive `dist/cli/bin.js`; `dist/` is untracked and CI builds it; `npm ci` first if `node_modules` is missing). The sandbox runs as root, so run suite files as `unshare --map-user=1000 --map-group=1000 -- npx vitest run --config test/vitest.config.ts --project suite test/suite/<module>.test.ts`, adding `-t '<ID> '` (trailing space kept, so `T6.5-1` does not also select `T6.5-10`) for one test and `--reporter=verbose` for per-test lines. `AGENTS.md` has timings and the scratch-workspace recipe: a hand-staged workspace outside the repository (under your scratchpad), driven with `node /home/user/xspec/dist/cli/bin.js … --json`, is the fastest way to see a finding's exact range.
- Many tests fail on several gaps and stop at their first failing arm, so a test can stay red until every task the index below lists for it has landed. Each task's **Verification** names the tests it should turn green once its partners are in, and what to probe by hand meanwhile. A task is done when its requirement is met (hand-verified where its tests are still blocked by other tasks) and nothing that passed before fails: run every suite file the task names, plus the neighbours it lists. For changes to shared parsing or analysis (Tasks 1, 3, 5–20), also run the §16 property files the task names.
- Before committing: run `npm run typecheck`. Format product code only, with `npx prettier --write src` (never `npm run format`, which also rewrites `test/`), then run `npm run format:check`. Commit as `sdg(phase-10): <imperative summary>`, ending the message with the trailer lines your spawn prompt gives. Push with `git push -u origin claude/xspec-ui-apis-4df8fa`, retrying on network errors with backoff (2 s, 4 s, 8 s, 16 s).
- Infrastructure caution: agents in this run have died from usage-credit exhaustion, container restarts, API overloads, and single responses over the 64,000 output-token ceiling. Issue a few tool calls per response, keep payloads modest, write files in bounded pieces, and land a coherent part early rather than one giant commit.
- Task numbers are stable; never renumber. When a task is done, delete its section in the same commit. An index entry naming a deleted task means that task has landed. If a task is too large for one spawn, land a coherent part and replace the task with precise remainder tasks numbered `<N>a`, `<N>b`, …, updating the index rows that name `<N>`. When the last task is removed, delete this file.
- Work top to bottom unless a task says otherwise; stated dependencies ("after Task N") are hard.
- If a task collides with a harness test that pins the opposite of what SPEC.md requires, do not bend the product to the test. Record the contradiction, dated and precise, in `specs/tmp/TEST-SPEC-PROBLEMS.md` and end with `OUTCOME: PROBLEM`. A defect in SPEC.md itself goes to `specs/tmp/SPEC-PROBLEMS.md` the same way. None of the reviewers found a spec defect, and none of the tasks below is known to collide with a test.
- Leave the known-failing list in `AGENTS.md`'s last bullet alone until Task 54, which rewrites it. Record any other new build or run knowledge as you go.
- Line numbers below are approximate, taken at `3bfedb5`; search by the names given.

## Index — each failing test and the tasks it waits on

These are VERIFY's 82 failures at `3bfedb5`. Each registry module is `test/suite/registry/<module>.ts`, and its suite file is `test/suite/<module>.test.ts`.

| Test | Module | Tasks |
|---|---|---|
| P-1 | section-16-p1 | 1 (passes since Task 1 landed) |
| P-2 | section-16-p2-p3 | 10, 13 |
| P-3 | section-16-p2-p3 | 10, 13 |
| P-4 | section-16-p4 | 3 (passes since Task 3 landed; it runs no `inventory`, so it never waited on Task 4) |
| P-5 | section-16-p5-p6 | 3 (passes since Task 3 landed; it runs no `inventory`, so it never waited on Task 4) |
| T1.4-1 | section-1.4 | 1, 5 (since Task 1 only its last arm fails: the `&#46;` reference spelling) |
| T1.4-4 | section-1.4 | 1 (passes since Task 1 landed; it stages no character reference) |
| T1.5-2 | section-1.5 | 9 |
| T1.6-5 | section-1.6-1.7 | 14 |
| T1.7-2 | section-1.6-1.7 | 19, 20 |
| T2.1-2 | section-2.1 | 6 |
| T2.3-3 | section-2.2-2.3 | 7, 14 |
| T2.4-2 | section-2.4 | 12, 14 |
| T2.4-5 | section-2.4 | 6 |
| T2.5-3 | section-2.5-2.6 | 5 |
| T2.6-1 | section-2.5-2.6 | 3 (passes since Task 3 landed) |
| T2.7-3 | section-2.7 | 14 |
| T2.7-4 | section-2.7 | 13, 14 |
| T3-7 | section-3 | 10 |
| T4-2 | section-4 | 6 |
| T4-5 | section-4 | 16, 17 |
| T4.4-1 | section-4.3-4.4 | 18 |
| T4.5-8 | section-4.5 | 16 |
| T4.5-9 | section-4.5 | 16, 17 |
| T4.6-1 | section-4.6 | 19 |
| T4.6-3 | section-4.6 | 20 |
| T5.5-5 | section-5.5 | 3 (passes since Task 3 landed) |
| T5.7-4 | section-5.7 | 16, 17, 18 |
| T6.2-1 | section-6.2 | 3 (passes since Task 3 landed) |
| T6.2-2 | section-6.2 | 3 (passes since Task 3 landed) |
| T6.4-3 | section-6.4 | 22 |
| T6.5-6 | section-6.5 | 26 |
| T6.5-7 | section-6.5 | 30 |
| T6.5-8 | section-6.5 | 28, 29 |
| T6.5-9 | section-6.5 | 32 |
| T6.5-10 | section-6.5 | 29 |
| T6.5-11 | section-6.5-ii | 28, 30, 31 |
| T6.5-13 | section-6.5-iii | 29 |
| T6.5-15 | section-6.5-iii | 10, 34 |
| T6.5-16 | section-6.5-iii | 10, 11, 29, 35 |
| T6.5-17 | section-6.5-iii | 25 |
| T6.5-18 | section-6.5-iii | 33 |
| T6.5-19 | section-6.5-iii | 29 |
| T6.6-3 | section-6.6 | 23, 25, 35 |
| T6.6-4 | section-6.6 | 29 |
| T7-1 | section-7-basics | 36 |
| T7-2 | section-7-basics | 8, 37, 38 |
| T7-3 | section-7-basics | 38 |
| T7-4 | section-7-discovery | 39, 40 |
| T7.3-1 | section-7.1-7.3 | 41 |
| T7.4-1 | section-7.4-7.5 | 4 (passes since Task 4 landed) |
| T7.5-1 | section-7.4-7.5 | 4 (passes since Task 4 landed) |
| T10.1-6 | section-10.1 | 45, 46 |
| T11-2 | section-11 | 2, 3, 40, 44 (since Task 2 its malformed-`--tag` sweep holds by hand, twins included; since Task 3 its tag sets hold and it stops first at Task 40's `--file "./specs/alpha/*.mdx"` arm) |
| T11-6 | section-11 | 19 |
| T11-7 | section-11 | 3 (passes since Task 3 landed) |
| T11.2-6 | section-11.2 | 51 |
| T11.3-2 | section-11.3 | 40 |
| T11.3-3 | section-11.3 | 1, 44 (since Task 1 its first failing arm is configuration-first) |
| T11.4-2 | section-11.4 | 40 |
| T11.4-3 | section-11.4 | 3 (passes since Task 3 landed) |
| T11.4-4 | section-11.4 | 14 |
| T11.4-6 | section-11.4 | 3 (passes since Task 3 landed) |
| T11.5-3 | section-11.5 | 9 |
| T11.6-2 | section-11.6 | 4 (passes since Task 4 landed) |
| T12.0-10 | section-12.0-ii | 44 (its `--tag 'a\b'` row holds since Task 2) |
| T12.0-14 | section-12.0-iii | 43 |
| T12.2-4 | section-12.1-12.2 | 52 |
| T12.3-1 | section-12.3-12.5 | 40 |
| T12.7-3 | section-12.7 | 42 |
| T13.3-2 | section-13.3 | 47 |
| T13.4-6 | section-13.4 | 51 |
| T13.5-1 | section-13.5 | 43 |
| T13.5-7 | section-13.5 | 48 |
| T14-2 | section-14 | 6 |
| T14-4 | section-14 | 51 |
| T14-6 | section-14 | 12, 48, 49 |
| T14-7 | section-14 | 22, 23, 24, 25, 35 |
| T14-9 | section-14-ii | 48 |
| T14-10 | section-14-ii | 49, 50 |
| T14-11 | section-14 | 12, 13, 14, 15, 16 |
| T14-12 | section-14-iii | 10, 11, 12, 14 |

Several tasks have no failing test of their own: Task 21 (the undefined refusal code), Task 27 (preview/real agreement, which Tasks 30–32 make unobservable on today's stagings), and Task 53 (a corrupt session in `review list`). Composite tests (T14-4, T14-6, T14-11, T14-12) restage fixtures from other sections, so the task that lands last may reveal a further arm; if it does, name the arm and its SPEC rule in a new task.

---

## Task 5 — Quoted attribute values are read verbatim, with no character-reference decoding (SPEC 2.4, 2.7, 2.5, 2.6, 1.4, 14.4, 14.17; A2, first part)

**Requirement.** SPEC 2.4: "The value of such a literal, and of a quoted attribute value (2.7), is the characters between its delimiters exactly as spelled — no escape sequence or character reference is interpreted — … so a spelling containing `\` or `&` names no valid identity or tag (1.4), and a `coverage` value spelled with an escape or character reference is neither `required` nor `none` (14.17)."

**Observed.** remark-mdx decodes character references in quoted attribute values, and the product validates the decoded text. Each of these is accepted:
- `coverage="&#110;one"` reads as `none` (14.17 required);
- `id="a&#46;b"` reads as `a.b` (14.4 required);
- `tags="x&#121;"` reads as `xy` (14.4 required).

**Location.** `src/core/mdx.ts`:
- `SpecAttributeValue.value`, documented as "the decoded characters of the quoted form" (~69–75);
- the section builder's prop validation (~1780–1895), which takes `id`, `coverage`, and `tags` from the mdast attribute's decoded value.

**Change.**
- Take every quoted attribute value from the source characters between its quotes (its `valueRange`), never from the parser's decoded value. This covers `id`, `coverage`, `tags`, and any other string prop that is read.
- Update the doc comment.
- Confirm rename and move's in-place ID rewrite (6.4) stays byte-exact.
- With Task 1 in place, a verbatim `&` then fails 1.4.
- `attributeProblems` in `src/core/mdx.ts` (Task 1) judges `id`/`tags` with one 14.4 finding per attribute and restores a U+0000 that remark-mdx decoded to U+FFFD; once values are the raw characters that restoration is a no-op, and the helper can judge the raw values alone.

**Verification.**
- Should turn green: `section-2.5-2.6.test.ts` (T2.5-3).
- `section-1.4.test.ts`: T1.4-1, whose one failing arm since Task 1 is the `&#46;` reference spelling (T1.4-4 already passes).
- Neighbours: `section-1.1-1.2.test.ts`, `section-1.3.test.ts`, `section-2.7.test.ts`, `section-6.4.test.ts`.

## Task 6 — String literals, chain segments, and import specifiers are read as spelled (SPEC 2.4, 2.1, 4, 4.5, 14.5–14.7, 14.15; A2, C12)

**Requirement.** SPEC 2.4 (Task 5's rule) covers every static string literal: `d` and `text(...)` string arguments, computed-access indices, and import specifiers in spec and TypeScript sources alike. It also says: "A segment's identifier is likewise read as spelled: one carrying a Unicode escape sequence (`.login`) spells a name containing `\`, which no segment contains (1.4), so the reference names no node and does not resolve (14.5–14.7) — which binding roots a chain is the language's scoping question (2.1, 4.5), not a spelling one." A specifier spelled with an escape designates no source (14.15).

**Observed.** The shared analyzer reads cooked (escape-decoded) values:
- `d={"login"}`, `{text("login")}`, `BASE["a"]`, `d={BASE.login}`, and the TypeScript marker `BASE.login` all resolve and record edges. T14-2 requires 14.5 and 14.7.
- `import BASE from "./BASE.xspec"` resolves in spec and TypeScript sources; 14.15 is required.

**Location.**
- `src/core/spec-references.ts`: acorn's `Literal.value` and `Identifier.name` are cooked; use `raw` or the source slice.
- `src/core/code-analysis.ts`: TypeScript's `StringLiteral.text` and `Identifier.text`/`escapedText` are cooked; use the node's source characters (`getText()` or positions), minus the delimiters.
- The import readers on both sides: spec-source ESM imports (`mdx.ts`, `spec-references.ts`) and TypeScript imports (`code-analysis.ts`).

**Change.**
- Read every string-literal value and every chain segment name from its exact source characters: between the delimiters for literals, the identifier's own span for names.
- Keep root-binding resolution as the language scopes it: an escaped root identifier still names its binding (2.4, 4.5).
- Results: an escape-spelled specifier designates no source (14.15). A segment spelled with `\` names no node, so the reference is unresolved: 14.5 in `d`, 14.6 in `text(...)`, 14.7 in TypeScript.
- Generated modules need no change.

**Verification.**
- Should turn green: `section-2.4.test.ts` (T2.4-5), `section-2.1.test.ts` (T2.1-2), `section-4.test.ts` (T4-2; T4-5 waits on Tasks 16–17), `section-14.test.ts` (T14-2).
- `section-1.4.test.ts`: the escape arms of T1.4-1 and T1.4-4 already pass since Task 1 (remark-mdx leaves a backslash in a quoted attribute value undecoded); keep them green.
- Neighbours: `section-2.2-2.3.test.ts`, `section-4.5.test.ts`, `section-5.7.test.ts`, `section-11.3.test.ts`, `section-16-p1.test.ts`.

## Task 7 — An embedding's callee is `text` spelled plainly; a parenthesized or escaped callee is an invalid container (SPEC 2.3, 2.4, 14.16; A5)

**Requirement.** SPEC 2.3: "An embedding is an expression container, in flow or text position, whose one expression (14.20) is a call — optional chaining excluded — whose callee is the identifier `text` itself, spelled plainly, neither parenthesized nor escaped (2.4) …; a container holding any other expression is invalid (14.16)."

**Observed.**
- `{(text)("a")}` is treated as an embedding and reported 14.8; it must be 14.16 at the container.
- `{text("a")}` is accepted as an embedding; it must be 14.16.

**Location.** `classifyExpression` in `src/core/mdx.ts` (~1494–1546). Its test, `expression.callee.type === "Identifier" && expression.callee.name === "text"`, sees acorn's cooked name, and acorn drops the parentheses.

**Change.** Accept an embedding only when both hold:
- the callee's own source characters are exactly `text`;
- the call expression begins at the callee, so no parenthesis precedes it (for example, `expression.start === callee.start`).

Also exclude optional calls (`text?.(…)`) if they are not already excluded. Everything else is 14.16 at the whole container.

**Verification.** `section-2.2-2.3.test.ts`: T2.3-3's classification arms; its later 14.20-offset arms wait on Task 14. Neighbours: `section-2.7.test.ts`, `section-3.test.ts`, `section-5.7.test.ts`.

## Task 8 — Configuration literals are read verbatim (SPEC 7, 2.4, 14.14; B2)

**Requirement.** SPEC 2.4's as-spelled rule covers "every configuration literal (7)". SPEC 7: a key is repeated when "an identifier key and a string-literal key [spell] the same name". The comparison is between spelled names.

**Observed.**
- The glob `"specs/*.mdx"` is read as `specs/*.mdx`: it discovers files, and `inventory` reports the interpreted glob.
- A group keyed `"product"` becomes `product`, so `target: "product"` resolves.

**Location.** `src/core/config.ts` ~543: `reduceLiteral` returns `{ kind: "string", value: expr.text }`, which is TypeScript's cooked text. Check the object reducer's string-literal keys too.

**Change.** Take each string literal's value, and each string-literal key, from its source characters between the delimiters. Whatever rule the verbatim `\` then breaks decides the outcome. For example, `target: "product"` then names no group, which is 14.14.

**Verification.** `section-7-basics.test.ts`: T7-2's literal arms (T7-2 also waits on Tasks 37 and 38). Neighbours: `section-7-discovery.test.ts`, `section-7.1-7.3.test.ts`, `section-7.4-7.5.test.ts`, `section-11.6.test.ts`.

## Task 9 — A source path containing U+FFFD is invalid (SPEC 14.19, 7, 1.5, 11.2; A3, B14)

**Requirement.** SPEC 14.19: a discovered spec or code source "whose workspace-relative path contains `#` or U+FFFD or is not valid UTF-8 (7)" has an invalid source path. No identity is defined, emitted, or resolved against over such a path (1.5, 11.2). The 14.19 finding accompanies the answers of 11.2's surfaces for that file.

**Observed.** `specs/A�.mdx` (valid UTF-8 bytes `EF BF BD`) gets no 14.19 from `build`, although the non-UTF-8-named file does get one. `view --file` emits the identities `specs/A�.mdx` and `…#u` with no finding, exit 0.

**Location.** `src/core/discovery.ts` ~440–480: the path-validity checks (`#` ~450, non-UTF-8 ~465, missing `.mdx` ~479).

**Change.**
- Add the U+FFFD rule beside the `#` rule, applied to the path decoded from a UTF-8-valid name, with an actionable message.
- Make every downstream "valid path" decision use the same predicate, so no identity is defined for such a file in `view`, `occurrences`, `at`, `ids`, or `query`.

**Verification.** `section-1.5.test.ts` (T1.5-2), `section-11.5.test.ts` (T11.5-3). Neighbours: `section-7-discovery.test.ts`, `section-11.2.test.ts`, `section-11.4.test.ts`.

## Task 10 — ESM blocks are bounded exactly as stock MDX 3 bounds them (SPEC 14.20, 2.1, 2.7, 3, 6.5; A7, C14 first shape)

**Requirement.** SPEC 14.20: well-formed MDX is MDX 3's syntax, decided by derivability alone, and an ESM block is one ECMAScript 2024 module holding import and export declarations only. SPEC 6.5 ("Import edits") spells out the line-sensitive bounds: an ESM block "cannot interrupt a paragraph, so the line after a paragraph line is paragraph text, and it runs to the next blank line or the file's end, so a line followed by a non-blank line absorbs it — one holding no declaration leaving the block underivable". Comments inside a block belong to the block, as in 6.5's example of `import A …`, `// note`, `import B …` on successive lines.

**Observed.** The product's `widenedEsmConstruct` ends a block at the first line boundary where the accumulated text is a complete program. That breaks both ways:
- Well-formed files are misread. An import after an own-line `// note`, or after a `/* c */ ` prefix, becomes paragraph text: its binding goes missing (14.8) and the import stays in the compiled Markdown. This fails T3-7, T6.5-15(a), and P-2 (seeds 271828183 and 1).
- Files that are not well-formed are accepted. An import line directly followed by a prose line, `const x = 1`, or `<S …>` builds with no finding, where 14.20 is required at the start of the following line. This fails T14-12's ESM arm.

**Location.** `src/core/mdx.ts`:
- the header's widening 2 (~27–31);
- `widenedEsmConstruct` and `tokenizeWidenedEsm` (~630–822);
- the registration in `xspecGrammarWidenings` (~917–929).

Consumers of `SpecEsmBlock` assume one block per statement today (see the widening's comment). Those consumers are Markdown compilation (3), import validation, `view`'s `imports`, and the move's `SpecImportPlan` in `src/core/move.ts`.

**Change.**
- Remove widening 2, so the stock `mdxjsEsm` construct (remark-mdx with the product's acorn) bounds blocks. Map its failures to 14.20 through `parseFailureFinding` as today.
- Re-check every block consumer against multi-statement, comment-bearing blocks. Markdown compilation must remove the whole block, comments included (3). Import validation and `view`'s `imports` stay per declaration.
- Leave the acorn layer (Task 12) and tag pairing (Task 11) alone here.

**Verification.**
- Should turn green: `section-3.test.ts` (T3-7).
- `section-16-p2-p3.test.ts`: P-2 and P-3 on the seeds this fixes; the `{}` seeds wait on Task 13.
- `section-14-iii.test.ts`: T14-12's ESM-block arm.
- `section-6.5-iii.test.ts`: T6.5-15 arm (a) (the test waits on Task 34).
- Neighbours: `section-2.1.test.ts`, `section-4.test.ts`, `section-6.5.test.ts`, `section-6.6.test.ts`, `section-11.4.test.ts`, `section-16-p8.test.ts`.

## Task 11 — Section tags pair exactly as stock MDX 3 pairs them (SPEC 14.20, 1.1, 3, 6.5; A8 first bullet, C14 second shape)

**Requirement.** SPEC 14.20: well-formedness is derivability under MDX 3 and nothing else. MDX 3 pairs a text-position tag within its paragraph; the stock parser says "Expected a closing tag for `<S>` … before the end of `paragraph`". SPEC 6.5's admissibility rule and `refused-invalid-rewrite` (Tasks 29 and 35) judge would-be files by that same grammar.

**Observed.** `flatJsxTagExtension` (widening 3) makes every tag token a leaf, and the document builder pairs tags across construct boundaries. So shapes that stock MDX 3 rejects are accepted:
- `<S id="x">Text`, a blank line, then `more</S>`;
- `foo <S id="p">bar</S> baz` receiving a moved flow section.

**Location.** `src/core/mdx.ts`:
- the header's widening 3 (~32–39);
- `exitFlatJsxTag`, `ignoreClosingMarker`, and `flatJsxTagExtension` (~825–907);
- the builder's flat pairing (~1330–1490).

**Change.** Decide well-formedness by the stock grammar, in one of two ways:
- drop widening 3 and build the section tree from stock `mdxJsxFlowElement`/`mdxJsxTextElement` nodes; or
- keep the flat builder for the model, but first judge the file by the stock pairing (the same pipeline without `flatJsxTagExtension`) and report its failure as 14.20.

Either way:
- Expose the judgement as a pure core function over a file's text; Tasks 29 and 35 judge would-be files with it.
- Mind scale. The suite stages section towers 4096 deep (TEST-SPEC H-11; P-8, P-11), so avoid unbounded recursion (AGENTS.md: a plain recursive function gets about 9.9k frames) and keep parses per file few.

**Verification.**
- `section-14-iii.test.ts`: T14-12's text-position arm (T14-12 also waits on Tasks 10, 12, 14).
- Neighbours: `section-1.1-1.2.test.ts`, `section-1.3.test.ts`, `section-1.6-1.7.test.ts`, `section-3.test.ts`, `section-6.5-iii.test.ts`, `section-16-p2-p3.test.ts`, `section-16-p8.test.ts`, `section-16-p11.test.ts`.

## Task 12 — Brace and ESM content derive exactly as ECMAScript 2024 with JSX derives them: no TypeScript syntax, no early errors (SPEC 14.20, 2.4, 2.7, 14.8, 14.15, 14.16; A6, A8 second bullet, C13, C14 third shape)

**Requirement.**
- SPEC 14.20: well-formedness "is decided by derivability alone". No rule beyond derivability takes part, and it names what that excludes: "ECMAScript's static-semantic early errors — a duplicate lexically declared name (two imports binding one identifier; an import and an export declaration binding one name), an export naming no declaration, an assignment to a target that is not simple (`1 = 2`), a strict-mode restriction (`let` as an identifier reference, a legacy octal literal)". So a file failing only such rules "is well-formed and proceeds".
- SPEC 2.4: "a form the grammar does not derive is a parse failure of the file (14.20), never a dynamic reference — so a non-null assertion (`BASE.a!`), a type assertion, or any other TypeScript-only syntax" between a spec source's braces is 14.20.

**Observed.**
- `xspecAcornExtension` parses a postfix `!` as `TSNonNullExpression`, so `d={BASE.a!}`, `d={BASE!.a}`, and `{text(BASE.a!)}` report 14.8 where 14.20 is required.
- Conversely, acorn's early errors become 14.20, where each file is well-formed and must reach its ordinary outcome:
  - `export { nope }` after a valid import: exactly one 14.16 at the whole statement, the import still listed by `view`, the embedding still recorded;
  - `{1 = 2}`, `{let}`, and `{010}`: 14.16 each;
  - `d={(1 = 2)}` and `d={010}`: 14.8.
- Today only duplicate import bindings at module scope are tolerated.

**Location.** `src/core/mdx.ts`:
- `xspecAcornExtension` (~361–427) and `specAcorn`, shared by the ESM construct and remark-mdx's expression parsing;
- `ESM_ACORN_OPTIONS`.

Acorn raises most static-semantic errors through `raiseRecoverable`, and some through `raise`: for example "Assigning to rvalue", legacy octal and `let` under strict mode, and the undefined-export check at the end of `parseTopLevel`. Verify each against acorn 8's source in `node_modules/acorn`.

**Change.**
- Remove the non-null-assertion rule.
- Suppress all of ECMAScript's early errors (the SPEC's list is illustrative) while keeping every genuine syntax failure.
- The newly accepted constructs then reach their ordinary outcomes: an export statement is 14.16 (the whole statement), a non-embedding container is 14.16, a non-static `d` or `text` argument is 14.8, and duplicate bindings are 14.15.
- The static-reference analyzer must tolerate the trees acorn now returns.

**Verification.**
- `section-2.4.test.ts`: T2.4-2 (its 14.20-offset arms wait on Task 14).
- `section-14-iii.test.ts`: T14-12's positive arms.
- `section-14.test.ts`: T14-6's early-error stagings, and T14-11's (w) re-assertion of T2.4-2's forms (with Task 14).
- Neighbours: `section-2.1.test.ts`, `section-2.7.test.ts`, `section-4.test.ts`, `section-11.4.test.ts`, `section-16-p2-p3.test.ts`, `section-16-p8.test.ts`.

## Task 13 — Empty expression containers are MDX comments (SPEC 2.7, 14.20, 14.16; A4, C16)

**Requirement.**
- SPEC 2.7 and 14.20 make the empty expression an MDX comment, which 14.16 exempts. The empty expression is whitespace and comments alone between the braces of a container in flow or text position.
- SPEC 14.20 takes the whitespace for this judgement from ECMAScript 2024's WhiteSpace and LineTerminator: "U+00A0, U+FEFF, U+2028, and U+2029 included, U+0085 and U+200B not".
- SPEC 14.20 also fixes the comment-deletion procedure: block comments first, then line comments.

**Observed.** These are all reported 14.16:
- `{}`;
- containers holding only whitespace, whether ASCII, U+00A0, U+FEFF, U+2028, or U+2029.

`{/* c */}` already works.

**Location.** `classifyExpression` in `src/core/mdx.ts` (~1494–1514): an empty-body program with no comments is reported 14.16.

**Change.**
- Classify every container whose content is whitespace and comments alone as an MDX comment, like `{/* … */}`. The parser has already derived such a container.
- Record it in `comments`, so it reaches `view`'s `comments` and Markdown removal (3).
- Check how remark-mdx represents an empty or whitespace-only container (estree absent, or an empty program) and cover both.
- The attribute value `d={}` stays 14.20; Task 14 fixes its location.

**Verification.**
- `section-2.7.test.ts`: T2.7-4's content classes. Its offsets wait on Task 14.
- `section-16-p2-p3.test.ts`: P-3, and P-2 together with Task 10.
- `section-14.test.ts`: T14-11's (w) re-assertion of T2.7-4's forms (with Task 14).
- Neighbours: `section-3.test.ts`, `section-11.4.test.ts`.

## Task 14 — A 14.20 finding carries one zero-length range at the failure's offset (SPEC 14 location rule, 14.20, 1.6; A9, C15, and B's note on T11.4-4)

After Tasks 10–13, which change where parse failures arise.

**Requirement.** SPEC 14: "An unparseable source (14.20) carries one zero-length range at the failure's offset":
- for a refused read (14.25), 0;
- for an encoding failure, the byte length of the longest well-formed UTF-8 prefix;
- for a byte-order mark, 0;
- for a syntax failure, "the byte length of the longest whole-character prefix of the file with which some well-formed file begins — the file's byte length when the whole file is such a prefix".

SPEC 14.20 places `d={}`'s failure at its closing brace, and makes `010` and `09` 14.20 in a TypeScript source.

**Observed.** Every 14.20 range is non-empty, and syntax offsets are often wrong. Reported pairs (product, then required):

| Case | Product | Required |
|---|---|---|
| encoding failure | [21,22) | [21,21) |
| byte-order mark (also T11.4-4) | [0,3) | [0,0) |
| `{...a, b}`, A's staging | [17,18) | [15,15) |
| `{...a, b}`, C's staging (the comma) | 58 | 56 |
| `d={ /* c */ }` (the closing brace) | 46 | 55 |
| `d={}` | 13..14 | zero-length, at its closing brace |
| `010` in a `.ts` file | 10..13 | 11..11 |
| `09` in a `.ts` file | 10..12 | 11..11 |

**Location.**
- `parseFailureFinding` and the `MdxGrammarError` sites in `src/core/mdx.ts`.
- The encoding and BOM path through `decodeSourceBytes` in `src/core/source-text.ts`.
- The syntax-diagnostic finding in `src/core/code-analysis.ts`.

**Change.**
- Emit `{start: o, end: o}` for every 14.20.
- Compute `o` per the rule. For a syntax failure `o` is the longest viable prefix. That is usually the parser's failure position, but not always: a parser may report the offending token's start or a whole diagnostic span. For example, TypeScript flags `010` at its start, while the prefix ending at `0` is viable and the one ending at `01` is not.
- Implement the rule for the forms the tests pin — T1.6-5 and T14-11's (w) family in the registry — without special-casing test inputs.

**Verification.**
- Should turn green: `section-1.6-1.7.test.ts` (T1.6-5), `section-2.7.test.ts` (T2.7-3), `section-11.4.test.ts` (T11.4-4).
- `section-2.7.test.ts` (T2.7-4, with Task 13), `section-2.2-2.3.test.ts` (T2.3-3, with Task 7), `section-2.4.test.ts` (T2.4-2, with Task 12).
- `section-14.test.ts`: T14-11 arm (c) and the (w) family. `section-14-iii.test.ts`: T14-12, with Tasks 10–12.
- Neighbours: `section-14-ii.test.ts` (T14-10's refused-read arm stays at 0..0), `section-16-p8.test.ts`.

## Task 15 — A repeated prop locates every attribute spelling the name (SPEC 14 location cardinality, 14.17, 2.7; C18)

**Requirement.** SPEC 14: "a repeated prop locates every attribute spelling the name".

**Observed.** `<S id="h1" coverage="none" coverage="none">` gives one 14.17 finding located at 27..42 only, the repetition. The first spelling, 11..26, must be located as well.

**Location.** `src/core/mdx.ts`: the repeated-prop check in the section builder's attribute loop.

**Change.** Give one 14.17 finding per repeated name, with one location per attribute spelling that name, the first included, in 12.7 location order. Leave the other 14.17 forms unchanged.

**Verification.** `section-14.test.ts`: T14-11 arm (h) (the test also waits on Tasks 12–14 and 16). Neighbours: `section-2.5-2.6.test.ts`, `section-2.7.test.ts`, `section-11.4.test.ts`.

## Task 16 — A value-level declaration colliding with a spec import binding is 14.15, and chains rooted at it resolve nothing (SPEC 2.4, 2.1, 4.5, 5.7, 14.15, 14.18; A10, C17)

**Requirement.**
- SPEC 2.4: an identifier bound by a spec module import and, in the same scope, by another binding roots no resolving chain. That other binding is "a non-import declaration binding it at value level: a variable, function, class, or enum declaration, or a namespace declaration binding a value; in a spec source, a declaration an export statement holds". Such a chain yields "no edge, no occurrence (5.7)", and its spelling reports as unresolved (14.5–14.7) beside the collision finding (14.15).
- Type-level declarations (an interface, a type alias, a namespace binding no value) collide with nothing, and an inner-scope declaration shadows instead (4.5).
- SPEC 14's location list for 14.15 locates each colliding non-import declaration by the construct binding the name. A variable declarator is located by its own characters, from its name or binding pattern through its initializer.
- A call through a colliding `text` is no `text` call (4.5; 14.11's note): it records no `embeds` edge or occurrence, and a node passed to it is unsupported usage (14.18).

**Observed.**
- In a `.ts` file, beside `import BASE from "../specs/B.xspec"`, a colliding `const BASE = 1`, `let`, `function BASE() {}`, `class`, `enum`, or value namespace gives no finding, and `BASE.a` still resolves.
- In a spec source, `export const BASE = 1` beside the import gives only 14.16, and `d={BASE.a}` still resolves.
- `function text() {}` or `const text = …` beside a `text` import still records `embeds` edges and occurrences.

**Location.**
- `src/core/code-analysis.ts`: the import-binding table and the module-scope walker (~1022–1090, ~1575–1660).
- `src/core/spec-references.ts`: spec-source bindings (~584–592).
- `processEsm` in `src/core/mdx.ts`, which records an export statement only as 14.16.

**Change.**
- Collect the module scope's value-level declarations: every name a declarator's binding pattern binds, plus functions, classes, enums, and value namespaces; in a spec source, also every name an export statement declares.
- Where one binds a spec import's identifier, report one 14.15 per collided identifier. It locates every colliding declaration: imports by their import ranges, other declarations per 14's rule.
- Treat that binding as colliding:
  - chains rooted at it are unresolved — 14.5 or 14.6 in spec sources, 14.7 in TypeScript — with no edge and no occurrence;
  - calls through a colliding `text` are plain calls: no `embeds`, and 14.18 at a node argument.

**Verification.**
- Should turn green: `section-4.5.test.ts` (T4.5-8).
- With Task 17: `section-4.5.test.ts` (T4.5-9), `section-4.test.ts` (T4-5). With Tasks 17 and 18: `section-5.7.test.ts` (T5.7-4).
- `section-14.test.ts`: T14-11 arms (j) and (u).
- Neighbours: `section-2.1.test.ts`, `section-4.6.test.ts`, `section-6.5.test.ts`.

## Task 17 — Import-import collisions leave chains unresolved and `text` calls unsupported, never silently dropped (SPEC 4.5, 2.4, 14.7, 14.18, 14.15, 14.11; A11)

**Requirement.**
- SPEC 4.5: an identifier bound by two imports roots its chains at no binding, "its chains unresolved (14.7) beside the collision (14.15), whether or not either import is type-only (4): the type-only exemption reaches a chain the language roots at one binding, and a colliding identifier roots it at none".
- SPEC 14.11: "a call through a colliding `text` identifier (4.5), no `text` call, is never this condition". Its node argument is therefore 14.18.
- SPEC 2.4 states the same for spec sources: chains rooted at a colliding identifier are unresolved, 14.5 in a `d` value and 14.6 in a `text(...)` argument.

**Observed.** 14.15 is reported, but:
- chains through a value import that collides with a type-only import are silently dropped, with no 14.7;
- `text(SPEC.a)` and `text(B.a)` through a colliding `text` omit the 14.18 at the node argument.

**Location.**
- `src/core/code-analysis.ts`: the `"poisoned"` binding kind and its masking checks. The `72ad038` plan located these at ~28, ~225, ~422–424, ~610, ~643, ~814, ~896–897, ~1157, ~1188, ~1205–1207, and "a poisoned callee masks its arguments" at ~1313–1315; the product is unchanged since.
- `src/core/spec-references.ts`: the poisoned binding (~584–592) and `EmbeddingReference.reference === null` (~716–726).

**Change.**
- Replace masking with unresolved reporting. A marker or chain rooted at a colliding identifier reports 14.7 in TypeScript, 14.5 in a `d` value, or 14.6 in a `text(...)` argument, at the spelling's own range, with no edge and no occurrence.
- Treat a call through a colliding `text` as a plain call, with 14.18 at a node argument.
- Apply the same rule on the spec-source side, per 2.4; T14-12 stages two imports binding one identifier.
- Keep the 14.15 findings as they are.

**Verification.** With Task 16:
- `section-4.test.ts` (T4-5);
- `section-4.5.test.ts` (T4.5-9);
- `section-5.7.test.ts` (T5.7-4, with Task 18 as well).

Neighbours: `section-2.1.test.ts`, `section-11.3.test.ts`, `section-14-iii.test.ts`.

## Task 18 — A cross-module `text` call keeps its `embeds` edge and occurrence; an unresolved argument is 14.7 alone (SPEC 14.11, 5.7, 4.4; A12)

**Requirement.** SPEC 14.11:
- A node passed to the `text` export of another spec module: "its edge and occurrence stand (5.7)".
- A call whose argument is not exactly one resolving static node reference "is that condition alone, whatever spec module the chain's root binding designates, so `textB(A.missing)` is condition 7 only and `textB(A.a!)` condition 8 only".

**Observed.**
- A resolving cross-module call records no `embeds` occurrence beside its 14.11.
- `textB(A.missing)` gets 14.11 instead of 14.7 alone.

**Location.** `src/core/code-analysis.ts`: the handling of TypeScript `text(...)` calls, covering the cross-module check and occurrence recording.

**Change.**
- Whenever the argument resolves, record the call's `embeds` edge and occurrence, sourced at its unit (4.6) and targeting the argument's node. Add 14.11 beside it when the modules differ.
- When the argument is unresolved (14.7) or not static (14.8), report that condition alone.

**Verification.**
- Should turn green: `section-4.3-4.4.test.ts` (T4.4-1).
- With Tasks 16 and 17: `section-5.7.test.ts` (T5.7-4).
- Neighbours: `section-9.test.ts`, `section-11.3.test.ts`, `section-12.3-12.5.test.ts`.

## Task 19 — A class constructor is a named code unit `C.constructor` (SPEC 4.6, 1.7; A13(a), and B's note on T11-6)

**Requirement.** SPEC 4.6 counts "a constructor — a unit named `constructor`, `path#C.constructor` in a class `C`" among the named code units. Its range is the constructor member's own characters (1.7). T1.7-2's constructor arm pins that range.

**Observed.** Markers inside a constructor attribute to `src/code.ts#C`, and `query edges --from src/code.ts#C.constructor` exits 2 as an unknown node.

**Location.** `src/core/code-analysis.ts`: the unit walker, including named-unit collection (~997), `unitRange` (~1021), and class-member handling.

**Change.** Bind a unit named `constructor` for each constructor implementation, nested in its class's chain. Skip overload signatures and ambient contexts. Give it a document-order slot like other members, so the `@N` suffixes of 4.6 apply.

**Verification.**
- Should turn green: `section-4.6.test.ts` (T4.6-1), `section-11.test.ts` (T11-6).
- With Task 20: `section-1.6-1.7.test.ts` (T1.7-2's constructor arm).
- Neighbours: `section-4.5.test.ts`, `section-5.7.test.ts`, `section-11.3.test.ts`.

## Task 20 — Code-unit binding and ranges: leading `export` excluded; escape-spelled names and declaration files bind nothing (SPEC 4.6, 1.7, 2.4; A13(b)–(d))

**Requirement.** SPEC 4.6:
- A named unit binds "a plain identifier name — an identifier spelled without escape sequences, read as spelled (2.4)". A name spelled with an escape sequence (`f`) binds no unit.
- A declaration in an ambient context binds no unit, "whether a `declare` modifier introduces it or its file is a declaration file, ambient by kind — by TypeScript's file-name rule". The whole sentence continues in 4.6.

SPEC 1.7 and 14 define a function or class unit's range as the construct binding the name. A leading non-default `export`, and the whitespace after it, are not part of it: `export function f`, `export   function`, `export @dec class`. `@dec export class` starts at its `@`. T1.7-2's title lists the pinned forms.

**Observed.**
- Function and class ranges include a leading `export` and the whitespace after it.
- `foo` binds `#foo`, and `method` binds `#K.method`.
- Functions in `x.d.ts` and `x.d.css.ts` bind units. Their markers must attribute to the whole file, while the control `x.dts.ts` keeps `path#f`.

**Location.** `src/core/code-analysis.ts`:
- `unitRange` (~1021);
- the unit-name reader: TypeScript's `Identifier.text` is cooked, so compare the identifier's source characters;
- the file-level ambient decision, which should follow TypeScript's own declaration-file-name rule (e.g. `ts.isDeclarationFileName`).

**Change.**
- Start function and class unit ranges after a non-default `export` keyword and its whitespace; decorators that precede `export` keep their `@` start.
- Skip names whose spelling differs from their cooked text.
- Treat every declaration in a declaration file as ambient: no units and no document-order slots, so markers attribute to the whole file.

**Verification.**
- Should turn green: `section-4.6.test.ts` (T4.6-3).
- With Task 19: `section-1.6-1.7.test.ts` (T1.7-2).
- Neighbours: `section-4.5.test.ts`, `section-5.7.test.ts`, `section-11.test.ts`.

## Task 21 — The refusal-code table is exactly SPEC 14's ten reasons; `refused-unresolvable-reference` goes (SPEC 14, 6.4, 12.7; A27)

**Requirement.**
- SPEC 14: "Stable codes cover exactly these conditions and the refusal reasons below, and no more."
- The reasons, in order: `refused-invalid-id`, `refused-identity-unchanged`, `refused-id-collision`, `refused-structural-parent`, `refused-cycle`, `refused-destination-exists`, `refused-missing-target-parent`, `refused-invalid-destination`, `refused-invalid-rewrite`, `refused-moved-import`. 12.7 orders findings by this list.
- SPEC 6.4: "Every rewritten reference resolves by construction … so no refusal reason exists for it."

**Observed.**
- `REFUSAL_CODES` (`src/core/findings.ts` ~85–98) holds `refused-unresolvable-reference` and lacks the last two reasons.
- `src/core/refusal.ts` (~1069–1096) emits `refused-unresolvable-reference`: moving a section that holds a reference to the target file's root produces it beside `refused-cycle`.
- No test pins this.

**Change.**
- Set `REFUSAL_CODES` to SPEC's ten reasons, in order. Tasks 25 and 35 emit the two new codes.
- Delete the unresolvable-reference check and its header note (~26).
- Confirm that the staging above now reports `refused-cycle` alone.
- If some staging reveals a rewritten reference that cannot resolve, fix it as a move-planning bug, never as a refusal.

**Verification.**
- The hand staging above.
- `section-6.5.test.ts`, `section-6.5-ii.test.ts`, `section-6.5-iii.test.ts`, `section-6.6.test.ts`.
- `section-14.test.ts`: T14-7 should fail only on the arms Tasks 22–25 and 35 own.

## Task 22 — `refused-invalid-id` concerns the new identity alone (SPEC 14 refusal list, 6.4; A15, C19(a))

**Requirement.** SPEC 14, `refused-invalid-id`: "concerning the new identity alone: an ID the prefix replacement produces is in intrinsic form exactly when the new ID is … so no produced identity reports separately".

**Observed.** `rename specs/A.mdx a a.then` reports the identities `["specs/A.mdx#a.then","specs/A.mdx#a.then.c"]`; T6.4-3's staging adds `a.then.kid` the same way. The first identity alone is required.

**Location.** `src/core/refusal.ts` ~399: the invalid-ID finding's identities.

**Change.** Carry exactly one identity over the destination file, spelled verbatim: `<file>#<new-id>` for a rename, `<target-file>#<new-id>` for a section move.

**Verification.**
- Should turn green: `section-6.4.test.ts` (T6.4-3).
- `section-14.test.ts`: T14-7's invalid-ID arm.
- Neighbour: `section-6.6.test.ts`.

## Task 23 — The exact file self-move reports `refused-identity-unchanged` alone (SPEC 14, 6.5; A16, C19(b))

**Requirement.** SPEC 14: `refused-destination-exists` applies to an occupied destination "unless it is the origin path itself, the exact self-move, which `refused-identity-unchanged` alone reports (6.5)".

**Observed.** `move specs/A.mdx specs/A.mdx` reports `refused-destination-exists` beside `refused-identity-unchanged`.

**Location.** `src/core/refusal.ts`, the file-form reasons (~847–861, ~956–1002).

**Change.** Skip the destination-occupied reason when the destination equals the origin byte-wise (12.0). A spelling such as `./specs/A.mdx` for the origin `specs/A.mdx` stays `refused-invalid-destination`'s (14).

**Verification.**
- `section-6.6.test.ts`: T6.6-3 (also waits on Tasks 25 and 35).
- `section-14.test.ts`: T14-7's self-move arm.
- Neighbour: `section-6.5.test.ts`.

## Task 24 — `refused-cycle` locates each import the move would add by the spellings rooted at its binding (SPEC 14 refusal list, 6.5; A26, C19(c))

**Requirement.** SPEC 14, `refused-cycle`, for a spec import cycle: each participating import declaration existing before the operation is located "by its own characters". Each participating import the operation would add, "which exists in no pre-operation coordinates", is located "by every reference spelling the operation roots at its binding (6.5), whether or not the spelling's characters change".

**Observed.** When an import the move would add closes the cycle, the finding locates only the existing declarations. For example, it has `[specs/B.mdx 0,25]` but lacks A's rooted `d={"x"}` spelling, `[specs/A.mdx 33,36]`. When both participating imports would be added, the finding has no locations at all.

**Location.** `src/core/refusal.ts`: the two `refused-cycle` sites (~520–650). `src/core/graph.ts` (~1102).

**Change.** For each would-be-added import in the cycle, add the pre-operation location of every reference spelling the operation roots at its binding: moved-text spellings, and the file's own spellings that the plan re-roots there.

**Verification.**
- `section-14.test.ts`: T14-7's cycle arm.
- Neighbours: `section-6.5.test.ts`, `section-6.5-iii.test.ts`, `section-6.6.test.ts`.

## Task 25 — Moving a section that holds an import declaration is refused as `refused-moved-import` (SPEC 6.5 "Validation and refusals", 14, 6.6; A25, C19(e))

After Task 21.

**Requirement.**
- SPEC 6.5 refuses a section move whose moved text holds an import declaration; "such a section is movable once the declaration stands outside it".
- SPEC 14, `refused-moved-import`: "one finding locating each such declaration in the origin file by its own characters, the import range of 11.4, its `identities` empty".
- A preview reports exactly the same (6.6).

**Observed.** `move` and `move --preview` of such a section crash with exit 70: "xspec internal error: overlapping move deletions".

**Location.**
- `src/core/refusal.ts`: the section-form reasons.
- `src/core/move.ts` ~449: the throw.

**Change.**
- Add the reason, evaluated over the pre-operation origin. Locate every import declaration inside the moved section's construct, one location each.
- Report it together with every other applicable reason (14).
- Keep the internal-error throw only as an unreachable guard.

**Verification.**
- Should turn green: `section-6.5-iii.test.ts` (T6.5-17).
- `section-6.6.test.ts`: T6.6-3, with Tasks 23 and 35.
- `section-14.test.ts`: T14-7's moved-import arm.

## Task 26 — A move rewrites and previews only spellings whose characters change (SPEC 6.5 "Reference spellings", 6.6; A17)

**Requirement.** SPEC 6.5: "A rewrite is made, and reported (6.6), exactly when it changes the construct's characters". In particular, "a cross-file section move keeping its ID rewrites no `id` attribute and no local-form reference inside the moved text to a node of the moved subtree".

**Observed.** A cross-file section move that keeps its ID reports `id-rewrite` and `reference-rewrite` edits for spellings it does not change. The bytes the real move writes are correct.

**Location.**
- `src/core/move.ts`: the section-form edit assembly and its `preview.add(…)` calls.
- `src/core/preview.ts`.

**Change.** Emit an edit and its preview entry only where the replacement differs from the current characters.

**Verification.**
- Should turn green: `section-6.5.test.ts` (T6.5-6).
- Neighbours: `section-6.5-ii.test.ts`, `section-6.6.test.ts`.

## Task 27 — A preview succeeds exactly when the real operation would (SPEC 6.6; A22; the `72ad038` plan's Task 3)

**Requirement.** SPEC 6.6: "A preview is refused exactly when — reporting what, and exiting as — the real operation would be refused, and succeeds exactly when the real operation would proceed."

**Observed.** On the stagings of T6.5-9 and T6.5-11, as the product stands, the two disagree:
- The real move re-analyzes its would-be result and exits 1 with numbered findings (14.11, 14.18), writing nothing.
- `--preview` reports success.

The plan bugs behind those findings are Tasks 30–32. The preview skips the refusing step either way, so the equivalence is not guaranteed.

**Location.**
- `src/cli/commands/move.ts`:
  - `runMoveFile` returns `emitSuccessfulPreview` (~412) before `reanalyzeMoved` (~431);
  - `runMoveSection` does the same (~649 before ~667), with its checks at ~674–698.
- `src/cli/commands/rename.ts` has the same shape (~224 before ~240; checks at ~241–262).

**Change.**
- In all three paths, run the in-memory re-validation before emitting a successful preview.
- When the re-validation reports findings, refuse the preview exactly as the real operation refuses: the same findings and exit code, in the refused-preview form, with `mapping`, `files`, and `delta` set to `null`.
- The preview still modifies nothing and takes no exclusivity.

**Verification.**
- Before Tasks 30–32 land, T6.5-9's staging shows the fix by hand: the preview and the real move then report the same thing.
- `section-6.4.test.ts`, `section-6.5.test.ts`, `section-6.6.test.ts`.

## Task 28 — Added TypeScript import declarations have no statement terminator (SPEC 6.5 "Import edits"; A19, first half)

**Requirement.** SPEC 6.5 spells an added import exactly. In a TypeScript source it is `import X from "…"`, `import { text as Y } from "…"`, or `import X, { text as Y } from "…"`, "single spaces as shown, no statement terminator, the specifier double-quoted".

**Observed.** Declarations added to code files end with `;`.

**Location.** `src/core/move.ts`: the code-file assembly loop (~1724–1770, "Code files: chain retargets plus added imports").

**Change.** Drop the `;`. The declaration stays on a line of its own, followed by U+000A, per 6.5's insertion rule.

**Verification.**
- `section-6.5.test.ts`: T6.5-8 (its target arm waits on Task 29).
- `section-6.5-ii.test.ts`: T6.5-11 (with Tasks 30 and 31).
- Neighbour: `section-6.6.test.ts`.

## Task 29 — Spec-source import additions go at an admissible offset (SPEC 6.5 "Import edits" and "Composition and admissibility", 6.6, 14.20; A18)

After Tasks 10 and 11.

**Requirement.** SPEC 6.5 (Import edits): an added import is inserted as a line of its own "at an admissible offset". An offset is admissible when the file, as every edit of the rewrite leaves it, is well-formed under its grammar (14.20), with the added line an import declaration. In a spec source, that is:
- a declaration of an ESM block standing inside no section construct, either one the line begins or one it joins whose other lines were an ESM block's before the edit;
- the grammar bounds the block line-sensitively (Task 10).

The "Composition and admissibility" paragraph fixes the choice among admissible offsets and the order of insertions that share one; read it whole (T6.6-4(e)'s tie-break arms pin it). SPEC 6.6 reports the `import-addition` at the chosen offset.

**Observed.** In a spec source with no ESM block, the declaration always goes at offset 0, never at the admissible line-start or mid-line offset. That holds even where it then absorbs the next non-blank line, or a paragraph of declarations. The product's own `build` and `check` accept the result because of the widened grammar (Tasks 10–11). As a consequence, the receiving root is never `changed` in T6.5-13 (h) and (j).

**Location.** `src/core/move.ts`: the spec-file import-edit closure (~1455–1500). Its addition offset is placed after the last surviving import, at a removed import's line start, or else at 0.

**Change.**
- Choose the offset per 6.5:
  - join an existing top-level ESM block that stands outside every section;
  - otherwise use a line start, or a mid-line insertion with its preceding U+000A, where the file as all edits leave it stays well-formed with the new line heading an ESM block. That means not directly after a paragraph line, and not directly before a non-blank line the block would absorb.
- Follow "Composition and admissibility"'s preference and ordering.
- Judge well-formedness with Task 11's stock-grammar function.
- Where no offset is admissible, the move is refused (Task 35); leave a clear hook for that.

**Verification.**
- Should turn green: `section-6.5.test.ts` (T6.5-10), `section-6.5-iii.test.ts` (T6.5-13, T6.5-19), `section-6.6.test.ts` (T6.6-4).
- `section-6.5.test.ts`: T6.5-8's target arm (with Task 28).
- Neighbour: `section-6.5-ii.test.ts`.

## Task 30 — Remove departed spec-module imports from code sources (SPEC 6.5 "Import edits", 6.6; A19, second half; the `72ad038` plan's Task 1)

**Requirement.** SPEC 6.5: "an existing spec module import is removed exactly when an occurrence used a binding of its before the rewrite and none uses any binding of its after it". This holds in code sources too; the joint-block exception applies to spec sources only (Task 34).
- An occurrence uses a binding when its chain is rooted at it, or, for a TypeScript `text(...)` call, when its callee is that binding.
- A removal's extent is the declaration plus the lines it leaves empty (3).

SPEC 6.6 reports each removal as an `import-removal` spanning every byte it removes.

**Observed.** Imports are never removed from code files, even after their last occurrence moved away. This is seen in T6.5-7's own-line and shared-line variants and in T6.5-11.

**Location.** `src/core/move.ts`:
- The spec side's `SpecImportPlan` (~719–812: `beforeRefs`, `departures`, `arrivals`, `removedImports()`), applied at ~1455–1500 through `removalSpan`.
- The code-file reference loop (~1348–1410) and assembly loop (~1724–1770), which have no such bookkeeping.

**Change.**
- Per code file, count uses per import binding before and after the rewrite: chains by root binding, `text` calls by callee binding.
- Remove a spec-module import declaration when its bindings had uses before and have none after. Emit a deletion edit with `removalSpan`'s extent, and `preview.add(path, "import-removal", span)`.
- Anchor additions so none lands inside a removed declaration.

**Verification.**
- Should turn green: `section-6.5.test.ts` (T6.5-7).
- `section-6.5-ii.test.ts`: T6.5-11 (with Tasks 28 and 31).
- Neighbour: `section-6.6.test.ts`.

## Task 31 — A TypeScript `text(...)` call whose target moves to another module is re-rooted whole (SPEC 6.5 "Reference spellings", 4.4, 5.7, 14.11; A20)

**Requirement.** SPEC 6.5: "A call whose target the section form carries into another file is rooted, callee and argument, at bindings of the module its target joins and so rewritten whole, over its occurrence's span (5.7), and is never the cross-module call of 14.11."
- The callee is rooted at that module's `text` binding: an existing one that no local declaration shadows at the occurrence, or else one an added declaration gives.
- The added spelling is `import { text as Y } from "…"`, `import X, { text as Y } from "…"`, or `{ text }` where the identifier is `text` itself.

**Observed.** The callee keeps the origin module's `text` binding and no `{ text as Y }` binding is added, so the call becomes cross-module. The real move then refuses with 14.11. The preview's `reference-rewrite` spans only the argument.

**Location.** `src/core/move.ts`: the code-file reference loop (~1348–1410) and addition assembly (~1724–1770).

**Change.**
- For a call whose target moves to another module, root the argument at that module's default binding and the callee at its `text` binding. Add or extend the import per 6.5's spellings (Task 28 drops the terminator).
- Emit one `reference-rewrite` over the occurrence's full span.
- Leave untouched every call whose target keeps its module, including every call under a file move.

**Verification.**
- `section-6.5-ii.test.ts`: T6.5-11 (with Tasks 28 and 30).
- Neighbours: `section-4.3-4.4.test.ts`, `section-6.5.test.ts`, `section-6.6.test.ts`.

## Task 32 — Fresh identifiers in code files collide with no module-scope binding (SPEC 6.5 "Import edits", 2.1, 4; A21, first bullet; the `72ad038` plan's Task 2)

**Requirement.** SPEC 6.5: "An added import binds fresh identifiers — colliding with no binding already in the file (2.1, 4), distinct from the others added there".

**Observed.** Fresh identifiers are checked only against import bindings, so they can collide with module-scope `const`, `function`, `class`, or `type` names. T6.5-9 pre-empts `Target`, `target`, `TARGET`, `TargetSpec`, `TargetSPEC`, `ORG1`, `ORG2`, and `ORG_`.

**Location.**
- `src/core/move.ts` ~1389–1401: the code-file `taken` set, and `freshBindingName` (~649).
- `src/core/code-analysis.ts`: `CodeAnalysis` (~176) exposes no module-scope names.

**Change.**
- Extend the analysis with every identifier bound at the file's module scope, value- and type-level: variables (destructuring included), functions, classes, enums, interfaces, type aliases, namespaces, `declare` forms, and every binding of every import. Task 16 may already collect the value-level part.
- Seed `taken` from it.
- Keep the candidate derivation deterministic.

**Verification.**
- Should turn green: `section-6.5.test.ts` (T6.5-9).
- Neighbours: `section-6.5-ii.test.ts`, `section-6.6.test.ts`.

## Task 33 — A re-rooted code reference uses a binding that no local declaration shadows at the occurrence (SPEC 6.5 "Reference spellings", 4.5; A21, second bullet)

**Requirement.** SPEC 6.5: each chosen binding "is one the file already holds that no local declaration shadows at the occurrence (4.5)". Where the file holds none, it is the binding of the declaration the operation adds.

**Observed.** A rewritten reference is rooted by name at a binding that a local declaration shadows. For example, it produces `T.y` under `const T = 1`.

**Location.** `src/core/move.ts`: the code-file reference loop (~1348–1410) chooses bindings by name only.

**Change.**
- For each occurrence, choose an existing binding of the target module that is not shadowed in that occurrence's scope.
- If none qualifies, add an import whose fresh identifier is also unshadowed at every occurrence it roots.
- To support this, the analysis must expose the names declared in each occurrence's enclosing inner scopes.

**Verification.**
- Should turn green: `section-6.5-iii.test.ts` (T6.5-18).
- Neighbours: `section-6.5.test.ts`, `section-6.6.test.ts`.

## Task 34 — Joint import removal keeps a block's first declaration when the block would otherwise be headed by a comment or an indented declaration (SPEC 6.5 "Import edits", 3, 14.20; A23)

After Task 10.

**Requirement.** SPEC 6.5: in a spec source, "the removals in one block are judged together". Where they would leave the block headed by anything but a declaration at the start of its first line — a JavaScript comment or an indented declaration — the remaining declarations would derive as paragraph text (14.20). Then:
- the block's first declaration stays, "its binding unused (2.1) and no removal reported for it (6.6)";
- the other declarations are removed;
- "a block they would leave with no line at all … [has] its first declaration removed with the rest".

**Observed.** When removals would leave a block headed by a comment or an indented declaration, the first declaration is removed too. For example, `import A … // note` above `import B …` loses both lines.

**Location.** `src/core/move.ts`: `SpecImportPlan.removedImports()` (~719–812) and the removal closure (~1455–1500).

**Change.** Judge each block's removals jointly, over the block as all of them would leave it. Keep the first declaration, with no `import-removal` reported for it, when the rest would not start with a declaration at the start of the block's first line — unless no line of the block would remain.

**Verification.**
- `section-6.5-iii.test.ts`: T6.5-15 (arm (a) also needs Task 10).
- Neighbours: `section-6.5.test.ts`, `section-6.6.test.ts`.

## Task 35 — Refuse a section move whose rewrite would be invalid: `refused-invalid-rewrite` (SPEC 6.5 "Validation and refusals", 14, 6.6; A24, C19(d))

After Tasks 10, 11, 21, and 29.

**Requirement.** SPEC 14, `refused-invalid-rewrite`: "the section form's exact edits would leave the origin or the target file other than well-formed MDX, or a file the rewrite must add an import to holds no admissible offset for it (6.5)". It is evaluated only over an intrinsically valid new ID, as `refused-structural-parent` is. It is one finding that locates:
- the moved section's construct in the origin file (1.7);
- for each addition that no offset admits, every reference spelling the operation roots at its binding.

Its `identities` are the workspace-relative paths of the files concerned, in byte order: each file whose would-be text is not well-formed MDX (a target file to be created included), and each file holding no admissible offset for an addition it needs. SPEC 6.5 ("Moved text and insertion", "Validation and refusals") defines the edits being judged. A preview reports exactly the same (6.6).

**Observed.** Not implemented: every shape that should be refused is performed with exit 0. For example, a flow section moved into a text-position parent (`foo <S id="p">bar</S> baz`) leaves a target file the stock parser rejects. This covers T6.5-16's 24 refused arms and its five performed controls, T6.6-3's preview twins, and T14-7's arm. AGENTS.md's T6.5-16 bullets describe the arms.

**Location.**
- `src/core/refusal.ts`: the section-form reasons.
- `src/core/move.ts`: the planned edits, and Task 29's admissibility hook.

**Change.**
- After planning, apply the exact edits in memory to the origin, the target, and any created target file.
- Judge each file with Task 11's stock-grammar function, and collect the files that lack an admissible offset for an addition they need (Task 29).
- Report the single finding as specified, beside every other applicable reason.
- The preview reports the same finding.

**Verification.**
- Should turn green: `section-6.5-iii.test.ts` (T6.5-16).
- `section-6.6.test.ts`: T6.6-3 (with Tasks 23 and 25).
- `section-14.test.ts`: T14-7 (with Tasks 22–25).
- Neighbours: `section-6.5.test.ts`, `section-6.5-ii.test.ts`.

## Task 36 — The configuration path is judged by what occupies it (SPEC 7, 14.14; B1)

**Requirement.** SPEC 7:
- "The upward search stops at the nearest directory — the working directory itself first — holding an entry named `xspec.config.ts`, whatever occupies it."
- "The configuration file is the occupant of the path so found or named, read only when it is a plain file: any other occupant — a directory, a symbolic link whatever it targets, or anything else — is missing or invalid configuration (14.14), never read through."

**Observed.**
- A directory named `xspec.config.ts` in the working directory is skipped: the search continues upward and loads the ancestor's configuration (exit 0).
- A symlink occupant is read through (exit 0).
- `--config <symlink>` is read through (exit 0).
- `--config <directory>` already exits 2.

**Location.** `src/workspace/locate.ts`:
- `isFile` (~78) calls `fsp.stat`, which follows links.
- `searchUpward` (~91–100) continues past occupants that are not files.
- `locateWorkspace` (~108–120).

**Change.**
- Classify occupants with `lstat`.
- Stop the search at the first directory holding an entry of that name, whatever it is.
- An occupant, found or named, that is not a plain file is a configuration error (14.14) concerning that path, in 14's anchoring form.
- Do not treat a refused read, of a directory during the search or of an occupant's kind, as absence. Its 14.25 reporting is Task 49's.

**Verification.** `section-7-basics.test.ts` (T7-1). Neighbours: `section-11.6.test.ts`, `section-12.0-i.test.ts`, `section-12.7.test.ts`.

## Task 37 — A configuration file beginning with a byte-order mark is invalid (SPEC 7, 14.14; B3)

**Requirement.** SPEC 7: the configuration file's bytes "MUST be valid UTF-8 and MUST NOT begin with a byte-order mark". A file that violates this encoding rule is a configuration error (14.14).

**Observed.** A configuration file beginning with a BOM loads (exit 0).

**Location.** The configuration read in `src/workspace/config.ts`, or the parse entry in `src/core/config.ts`.

**Change.** Before parsing, reject a leading `EF BB BF` with a 14.14 error naming the file (exit 2).

**Verification.** `section-7-basics.test.ts`: T7-2's BOM arm (T7-2 also waits on Tasks 8 and 38).

## Task 38 — Group, profile, and rule names are non-empty and free of U+FFFD (SPEC 7, 14.14; B4, B5)

**Requirement.** SPEC 7: "an empty group, profile, or rule name (`""`)" is a configuration error, and "A group, profile, or rule name containing U+FFFD is a configuration error (14.14)".

**Observed.** Each of these loads with exit 0 instead of failing:
- a spec group named `""`, a profile with `name: ""`, and a rule with `name: ""`;
- the same three names containing U+FFFD.

**Location.** `src/core/config.ts`: the group reducers for `specs` and `code`, the coverage-profile reducer (~974–1034), and the policy-rule reducer.

**Change.** Add both checks to every name reader. Report each failure as 14.14 with an actionable message giving the key and line; all errors go into the one error document.

**Verification.** `section-7-basics.test.ts`: T7-2's empty-name arms and T7-3. Neighbours: `section-7.1-7.3.test.ts`, `section-7.4-7.5.test.ts`.

## Task 39 — A `**` segment leaves the outside-root depth unchanged (SPEC 7, 11.1, 11.3, 11.4, 12.0, 12.3, 14.14; B6)

**Requirement.** SPEC 7 decides whether a glob lies outside the root by its spelling alone. Read the `/`-separated segments from a depth of zero:
- a `..` segment lowers the depth by one;
- "a `.` segment, an empty segment …, and a `**` segment, which may match no segment at all, leave it unchanged";
- every other segment raises the depth by one.

"A glob beginning with `/`, or whose depth ever falls below zero, is outside the root". For configured globs and policy `files` selectors that is 14.14. For a `--file` pattern it is a usage error of the syntax class, exit 2 (11.1, 11.3, 11.4, 12.0).

**Observed.**
- Configured globs `**/../x/*.mdx` and `specs/**/../../x.mdx` load (exit 0).
- A policy selector `files: "**/../x"` loads.
- `--file '**/../x'` answers with exit 0 on `query nodes`, `occurrences`, and `view`.

**Location.** `src/core/glob.ts`: `resolveSegments` (~138–167) resolves `..` lexically against the preceding segments, `**` included.

**Change.** Implement the outside-root decision as the SPEC's pure depth count, separate from matching. Use it for configuration globs, policy selectors, and every `--file`, `ids --file` included.

**Verification.**
- `section-7-discovery.test.ts`: T7-4's outside-root arms (its inside-root arms need Task 40).
- Neighbours: `section-7.4-7.5.test.ts`, `section-11.test.ts`, `section-11.3.test.ts`, `section-11.4.test.ts`, `section-12.3-12.5.test.ts`.

## Task 40 — Inside-root `.`, `..`, and empty glob segments match nothing (SPEC 7, 12.0, 12.3, 11.1, 11.3, 11.4, 7.5; B7, C3)

**Requirement.**
- SPEC 7: "every other glob is inside, its `.`, `..`, and empty segments matching nothing".
- SPEC 12.0: arguments that name files or globs "are read as spelled and compared byte-wise against workspace-relative paths (below; 7), which no normalization touches: `./specs/A.mdx`, `specs//A.mdx`, and `specs\A.mdx` name or match no discovered file".

**Observed.** These spellings match what their normalized forms match: `./specs/*.mdx`, `specs//*.mdx`, `specs/./*.mdx`, `specs/../specs/*.mdx`, and `specs/**/../*.mdx`. So do `./apecs/*.mdx`-style spellings. This happens:
- as configured globs, which then discover sources;
- as policy `files` selectors, which then produce violations;
- as `--file` on `ids`, `query nodes`, `occurrences`, and `view`. These must return an empty, finding-free answer with exit 0.

**Location.** `src/core/glob.ts`: `resolveSegments` drops `.` and empty segments and pops on `..`; its output feeds the matcher.

**Change.** Stop normalizing and match segments as spelled. A `.`, `..`, or empty pattern segment matches no path segment, since discovered paths never contain one. Keep Task 39's outside-root decision separate.

**Verification.**
- Should turn green: `section-11.3.test.ts` (T11.3-2), `section-11.4.test.ts` (T11.4-2), `section-12.3-12.5.test.ts` (T12.3-1).
- With Task 39: `section-7-discovery.test.ts` (T7-4).
- `section-11.test.ts`: T11-2's `--file` arms (T11-2 also waits on Task 44).
- Neighbours: `section-7-basics.test.ts`, `section-7.4-7.5.test.ts`.

## Task 41 — `markdown.outDir` spelling is enforced (SPEC 7.3, 14.14; B8)

**Requirement.** SPEC 7.3: `outDir` is "spelled as one or more non-empty `/`-separated segments", none of them `.` or `..`. An empty value, a leading `/`, or a `.`, `..`, or empty segment is a configuration error (14.14).

**Observed.** These are accepted: `""`, `"./out"`, `"out/../x"`, `"out//x"`, `"out/"`, and `"out/."`. Only a leading `/` or an escaping `..` is refused.

**Location.** `src/core/config.ts` ~852–870, which checks `resolvesInsideRoot(outDirNode.value)`.

**Change.** Replace that check with the segment rule, applied to the verbatim literal (Task 8).

**Verification.** `section-7.1-7.3.test.ts` (T7.3-1). Neighbours: `section-11.6.test.ts`, `section-13.4.test.ts`.

## Task 42 — An unoccupied `--config` path is echoed exactly as given (SPEC 14 concerned path, 12.0, 12.7; C5)

**Requirement.** SPEC 14: a configuration error's concerned path is the found or named configuration path, in the anchoring form of 11.6. The exception: "a `--config` path nothing occupies — the one concerned path no physical resolution (11.6) can spell — is reported as the argument value exactly as given (12.0)".

**Observed.**
- `--config ./../cfg//xspec.config.ts`, naming nothing, is reported as `../cfg/xspec.config.ts`.
- An unoccupied absolute `--config` path is reported as a relative path.

**Location.** `src/workspace/locate.ts`: `failure(message, configAnchor)` (~67), the `--config` branch (~117), and the anchoring helper they use.

**Change.** When nothing occupies the named path, carry the argument value verbatim as the concerned path. Keep physical anchoring for occupied paths.

**Verification.** `section-12.7.test.ts` (T12.7-3). Neighbours: `section-7-basics.test.ts`, `section-11.6.test.ts`.

## Task 43 — Parse arguments by SPEC 12.0's invocation grammar (SPEC 12.0; C1)

**Requirement.** SPEC 12.0, "Invocation grammar":
- Flag tokens "may stand anywhere among the arguments — before the command word, between it and its operands, or after them".
- "The token `--` ends flag reading: it is dropped, and every later token is a non-flag token".
- "A flag's arity is fixed by its name, the same for every command — known before the command word is identified … and a `--` token naming no flag of any command takes no value".
- Once flags, their values, and any `--` are removed, the remaining tokens must match the synopsis exactly. A surplus token is a usage error of the syntax class.

The JSON bullet adds: JSON output is in effect exactly when "a `--json` token read as a flag, not as another flag's value" is given (or the surface is JSON-only).

**Observed.**
- (a) Flags before the command word or the subcommand are refused, exit 2:
  - `xspec --json ids` and `xspec --config cfg/xspec.config.ts build` fail with "expected a command before any flags";
  - `xspec query --json nodes` fails with "missing subcommand".
- (b) `--` is not treated as the end of flags:
  - `ids --` fails with "unknown flag '--'"; it must behave as `ids`;
  - `ids -- --json` puts the error document on stdout; it must be a surplus-operand error, with JSON not in effect and stdout empty.
- (c) `build --file --json`, `build --test-hold --json`, and `ids --file --json extra` put the error document on stdout, although `--json` is a flag's value in each. The cause is a literal `argv.includes("--json")` scan.

**Location.** `src/cli/args.ts`: `parseArgv` (header ~1–40, per-command flag tables ~250–330, checks ~755–830), and wherever JSON-in-effect is decided (`src/cli/main.ts`).

**Change.** Parse in stages:
1. Walk all tokens using one global arity table: every flag of every command, each value-taking or not. Strip flags with their values, and honour `--`.
2. Decide JSON-in-effect from that walk: a `--json` read as a flag, including a repeated one.
3. Match the remaining tokens to the command, subcommand, and operands.
4. Check each flag against the command's accepted set.

Keep usage-error precedence and messages deterministic.

**Verification.** `section-12.0-iii.test.ts` (T12.0-14), `section-13.5.test.ts` (T13.5-1). Neighbours: `section-12.0-i.test.ts`, `section-12.0-ii.test.ts`, `section-12.6.test.ts`, `section-12.7.test.ts`.

## Task 44 — Report syntax-class usage errors without loading configuration (SPEC 12.0; B13, C2)

After Tasks 1, 2, 39, and 43.

**Requirement.** SPEC 12.0: "an error the invocation's arguments alone determine — the syntax class — is reported without loading configuration". The class includes:
- `--test-hold` beside `--preview` (6.6);
- `<file>` operands beside `--file` (11.4);
- "a session name outside the form of 10.1";
- "an `<offset>` spelled as anything but decimal digits (11.5)";
- "a `--to` or `--tag` spelling malformed as an identity or tag (11.3, 11.1)";
- "a `--file` pattern outside the workspace root (11.1) — decided by its spelling alone (7)".

The error document then carries `code` and `path` as `null`.

**Observed.** With an invalid configuration, each of these reports `configuration-error` instead:
- `--test-hold` with `--preview`, on `rename` and on `move`;
- `review status .x`, and `review create … --name .x`;
- `occurrences --to a#b#c`, `--to 'specs/OK.mdx#ok#use'`, and `--to a.mdx#then`;
- (`query nodes --tag then` and `--tag 'a\b'` — resolved by Task 2, whose tag rule runs at parse level in `src/cli/args.ts`, the `tagValue` flag field: every malformed `--tag` now exits 2 with the plain usage error, byte-identically under an invalid or missing configuration);
- `--file ../x` and `--file a/../../x`, on `ids`, `query nodes`, `occurrences`, and `view`.

With a missing configuration, all of the above fail the same way, and so does `at <file> +7`.

**Location.**
- `src/cli/args.ts`: the parse-level checks.
- `src/cli/main.ts`: the dispatch order.
- `src/cli/commands/gated-args.ts`.
- `src/cli/commands/occurrences.ts` ~78, where `nodeSpellingProblem` runs after loading.
- The review session-name check, and `at`'s offset check.

**Change.** Move every syntax-class check into the parse stage, before the configuration is located, as one table of per-command spelling checks:
- Task 1's identity rules for `--to`;
- Task 2's tag rule for `--tag` (already parse-level: `tagValue` in `src/cli/args.ts`; fold it into the table);
- Task 39's depth rule for `--file`;
- 10.1's session-name form;
- the offset's digits-only spelling;
- the co-occurrence rules.

Leave the non-syntax usage errors (unknown node, offset beyond the file's length, unknown session) after configuration, in 12.0's order.

**Verification.**
- Should turn green: `section-12.0-ii.test.ts` (T12.0-10), `section-11.3.test.ts` (T11.3-3, with Task 1), `section-11.test.ts` (T11-2, with Task 40).
- Neighbours: `section-10.7-i.test.ts`, `section-11.5.test.ts`, `section-12.0-i.test.ts`, `section-12.0-iii.test.ts`.

## Task 45 — A symlinked session directory holds no sessions for every `review` subcommand (SPEC 13.4, 10.1, 10.7, 12.0; B15, C9)

**Requirement.**
- SPEC 13.4: "Reads traverse none either: below a workspace-relative directory component occupied by anything other than a directory — a symbolic link included, whatever it targets — nothing is read … the session directory so placed holds no sessions (10.1)".
- An unknown session name is a usage error (10.7, 12.0).

**Observed.** Staging: `.xspec/reviews` is a symlink to a directory holding a valid `s.json`.
- `review status s`, `next s`, `show s item-1`, and `export s` answer from the linked session, exit 0.
- `resolve s item-1` gives a "blocked" refusal, and `split s item-1` gives a 14.22 finding, both exit 1.
- All six must exit 2 with an unknown-session usage error.
- Already correct: `list`, `create`, `check`, `ids`, `inventory`, and a plain-file occupant.

**Location.** `src/workspace/reviews.ts`:
- `loadSession` (~178–230) and `loadAllSessions` read through `readdir` and `readFile` without classifying the directory.
- `listSessionNames` (~93) and `sessionOccupied` (~156) — follow whatever `list` already does.

**Change.** Before any session read, classify `.xspec` and `.xspec/reviews` with `lstat`, in one helper shared by all six subcommands and by `list`. A non-directory occupant at either path means no sessions, so every session name is unknown (exit 2).

**Verification.**
- `section-10.1.test.ts`: T10.1-6's reviews arms (its area arms need Task 46).
- Neighbours: `section-10.7-i.test.ts`, `section-10.7-ii.test.ts`, `section-13.4.test.ts`.

## Task 46 — A non-directory `.xspec` holds no journal and no sessions, and its record is unreadable (SPEC 13.4, 11.6, 14.23, 14.10, 10.1; B16)

After Task 45.

**Requirement.**
- SPEC 13.4, continuing Task 45's rule: "the journal so placed is empty (6.1) and unoccupied to the inventory (11.6), and the session directory so placed holds no sessions (10.1)".
- The same passage continues: "the record alone, whose container the graph-data area is, reads instead as unreadable under such an occupant of the area's own path (14.23)".
- Consequences:
  - `inventory` reports that state as 14.23 (11.6);
  - `check` reports it as 14.10's unreadable-record unit form.

**Observed.**
- `.xspec` as a plain file: `inventory` reports `recorded` as `[]`, no finding, exit 0.
- `.xspec` as a symlink to a directory: `inventory` reports `journal.occupied` `true`, lists `.xspec/reviews/s.json` under `sessions`, and reads `recorded` through the link, all with no finding and exit 0.
- Required in both cases:
  - `occupied` is `false` and `sessions` is `[]`;
  - `recorded` is `{"unavailable": true}`;
  - one condition-23 finding concerning `.xspec`, exit 1.
- `check` on the symlinked area reports only 14.22 and omits 14.10's unreadable-record unit form.

**Location.**
- `src/cli/commands/inventory.ts`.
- `src/workspace/graph-data.ts` (the record read), `src/workspace/journal.ts`, `src/workspace/reviews.ts`, `src/workspace/check.ts`.

**Change.** Classify the area path with `lstat` once per command, sharing Task 45's helper, and derive every consequence from it:
- journal: unoccupied and empty;
- sessions: none;
- record: unreadable (condition 23), wherever the record is consulted:
  - on `inventory`, the finding plus the unavailable datum;
  - on previews (6.6);
  - on `check`, 14.10's unit form beside the 14.22 it already reports.

**Verification.**
- `section-10.1.test.ts`: T10.1-6.
- Neighbours: `section-11.6.test.ts`, `section-12.1-12.2.test.ts`, `section-13.4.test.ts`, `section-14.test.ts`.

## Task 47 — A refreshing read leaves an absent record absent (SPEC 13.3; C8)

**Requirement.** SPEC 13.3: "The record is left unchanged in every state — an absent record stays absent, the empty record (11.6), whatever graph data the refresh writes beside it".

**Observed.** After the graph data is deleted, running `ids --json` and then `inventory` shows `recorded` as the eight generated paths. It must be `[]`.

**Location.** `src/workspace/refresh.ts` (the refresh writes graph data, record included) and `src/core/graph-data.ts` (record serialization).

**Change.** Refresh must carry the record over exactly as it found it:
- absent stays absent, in whatever graph-data layout keeps `inventory`'s `recorded` at `[]` and keeps `check`'s recorded-file comparisons correct;
- present stays unchanged;
- unreadable stays untouched, as it already does.

**Verification.**
- `section-13.3.test.ts`: T13.3-2.
- Neighbours: `section-11.6.test.ts`, `section-12.1-12.2.test.ts`, `section-13.4.test.ts`.

## Task 48 — A write the environment refuses is condition 24: exit 2 with the `write-failure` error document (SPEC 14.24, 13.5, 13.3, 12.0, 12.7; C6)

**Requirement.** SPEC 14.24 covers every write xspec makes that the environment refuses: a file's creation, replacement, append, relocation, or removal. It is reported "by the command making the write — `build` (12.1), `rename` and `move` (6.4, 6.5), the refreshing reads of 13.3, and the mutating `review` subcommands (10.7, 13.5) — as a usage error (12.0), not a finding".
- The command stops at the refused write: it attempts no later write, leaves every earlier write complete (13.5), and exits 2.
- The concerned path is the file the write would have produced or removed. A relocation is two writes, each with its own path. A graph-data write concerns the graph-data area, `.xspec`.
- The stable code is `write-failure`.
- `check`, and every other command that writes nothing, never reports it.

**Observed.** `CONDITION_CODES` (`src/core/findings.ts` ~57–81) stops at 23. Every refused write ends in exit 70 ("internal error: EACCES") with no error document:
- `build`, with a derived directory unwritable;
- the refreshing reads `ids`, `query nodes`, and `view`, with `.xspec` unwritable;
- `rename`, with the source directory unwritable, and again with the journal unwritable after the source edits;
- a file-form `move` failing at the origin's removal;
- `review resolve` and `review create`, with the session directory unwritable.

The write order itself matched 13.5 in every staging.

**Location.**
- `src/core/findings.ts`: the code table and the `ConditionNumber` type.
- `src/workspace/writes.ts`: every write helper — `writeDerivedFile`, `writeSourceFile`, `removeSourceFile`, `removeDerivedFile`, `writeDurableFile`, `appendDurableFile`, and the temp-file-plus-rename path.
- The graph-data and session writers.
- `src/cli/main.ts`: the exit-70 catch.
- `src/cli/report.ts`: the error document.

**Change.**
- Add conditions 24 (`write-failure`) and 25 (`read-failure`) to the code table. Task 49 also uses 25.
- Turn any errno a write raises into a typed write-failure error carrying the workspace-relative concerned path (`.xspec` for graph data). Propagate it to the CLI and render the 12.7 error document: exit 2, and stdout empty without `--json`.
- Keep earlier writes and attempt no later ones.
- A hold file that cannot be created stays 13.5's usage error, not this condition.

**Verification.**
- `section-13.5.test.ts` (T13.5-7), `section-14-ii.test.ts` (T14-9), and `section-14.test.ts` (T14-6's condition-24 arm).
- These tests need the unprivileged namespace; AGENTS.md explains why.
- Neighbours: `section-6.4.test.ts`, `section-10.7-ii.test.ts`, `section-12.1-12.2.test.ts`, `section-13.3.test.ts`.

## Task 49 — A refused read of a directory listing or occupant kind is condition 25: exit 2 with `read-failure` (SPEC 14.25, 12.0, 7, 10.1, 11.6; C7(b), C7(c))

After Task 48.

**Requirement.** SPEC 14.25 treats these refused reads as condition 25, a usage error, "like a write failure":
- "a directory discovery lists (7)";
- "the session directory (10.1)";
- "the directories the upward search and the anchoring resolution examine (7, 11.6)";
- "a path occupant's kind wherever else xspec examines one".

The command stops at the read and exits 2. The error document carries the code `read-failure` and the concerned path: workspace-relative, or in anchoring form above the root. An object's nonexistence is never this condition.

**Observed.**
- A discovered directory that cannot be listed (`specs/sub` with mode `--x`) makes every configuration-loading command exit 70.
- An unlistable session directory is read as holding no sessions: `review list`, `check`, and `inventory` exit 0, and `review status s` fails with an unknown-session error.

**Location.**
- `src/workspace/discovery.ts`: the directory walk.
- `src/workspace/reviews.ts`: the `readdir` calls (~100, ~133, ~162, ~191).
- `src/workspace/locate.ts`: the upward search.
- The anchoring helpers.

**Change.** At these reads, treat only `ENOENT` and `ENOTDIR` as absence. Every other errno raises a typed read-failure error carrying the concerned path, rendered with Task 48's machinery.

**Verification.**
- `section-14-ii.test.ts`: T14-10's directory arms (T14-10 also waits on Task 50).
- `section-14.test.ts`: T14-6's condition-25 arm.
- Neighbours: `section-7-discovery.test.ts`, `section-10.1.test.ts`, `section-11.6.test.ts`.

## Task 50 — Refused reads of journal and graph-data content take those objects' own conditions (SPEC 14.25, 14.13, 14.23, 11.6, 6.6, 13.3; C7(a), C7(d))

**Requirement.** SPEC 14.25 assigns each object's refused content read its own condition:
- the journal's refused content is condition 13;
- a refused read of the graph-data area's own occupant, or of anything under the area other than the durable paths and the session directory, "is the state of condition 23". That state is:
  - unreadable recorded state "to every surface consulting the record (11.6, 6.6, 13.4)";
  - "staleness to `check` (14.10)";
  - "graph data that does not match to a refreshing read, which regenerates it (13.3)".

**Observed.**
- Journal content refused (mode `0o200`): `build`, `check`, `ids`, and `rename` exit 70. Required: a condition-13 finding concerning `.xspec/journal`, exit 1, with `ids` answering nothing.
- Graph data unreadable (`.xspec/graph.json`, mode `-w-`): it is read as the empty record.
  - `inventory` reports `recorded` as `[]`, with no finding and exit 0.
  - `move --preview` computes its `delta` against an empty record, exit 0.
  - Required: `{"unavailable": true}`, the `unreadable-record` finding concerning `.xspec`, and exit 1.

**Location.**
- `src/workspace/journal.ts` (the journal read) and `src/workspace/graph-data.ts` (the record read).
- `src/cli/commands/inventory.ts`.
- The previews' delta computation (`src/cli/commands/preview.ts`, `move.ts`, `rename.ts`).
- `src/workspace/refresh.ts` and `src/workspace/check.ts`.

**Change.**
- Report a refused journal content read as 14.13, as the gate reports a malformed journal.
- Route a refused record read through the unreadable-record state wherever the record is consulted, reusing the path a corrupt record already takes.
- A refreshing read regenerates the graph data, as it does on a mismatch (13.3).

**Verification.**
- `section-14-ii.test.ts`: T14-10, together with Task 49.
- Neighbours: `section-6.1.test.ts`, `section-6.6.test.ts`, `section-11.6.test.ts`, `section-12.1-12.2.test.ts`, `section-13.3.test.ts`.

## Task 51 — `check` reports none of 14.10's mismatch forms where a refused write (14.22) fails `build`'s validations (SPEC 14.10, 13.3, 14.22; C10, and B's note on T11.2-6)

**Requirement.** SPEC 14.10: the per-file mismatch forms, and the graph-data mismatch unit form, are "undetectable … on a workspace failing build's validations". SPEC 13.3 counts a refused write (14.22) among those validations.

**Observed.**
- Staging: a fresh valid workspace whose `markdown.outDir` component `out` is a symlink or a plain file.
  - `check` reports 14.22, plus 14.10 for every never-generated module, companion, and Markdown file, plus the graph-data unit form.
  - `build` is already correct: 14.22 alone, exit 1.
- T11.2-6 shows the same on its obstructed-write-path fixtures.

**Location.** `src/workspace/check.ts`: the 14.10 comparisons and the gate.

**Change.**
- For 14.10's purposes, treat 14.22 like every other validation failure of `build`, and suppress the mismatch forms.
- Keep the forms 14.10 reports "whatever the sources' validity": the recorded-file form and the unreadable-record form (Task 52).

**Verification.**
- `section-14.test.ts` (T14-4), `section-13.4.test.ts` (T13.4-6), `section-11.2.test.ts` (T11.2-6).
- Neighbours: `section-12.1-12.2.test.ts`, `section-13.3.test.ts`.

## Task 52 — On a workspace failing validation, `check` reports no 14.12 and still reports 14.10's validity-independent forms (SPEC 14.10, 14.12, 7.5; C11)

**Requirement.**
- SPEC 14.10: the recorded-file form and the unreadable-record unit form are "reported whatever the sources' validity".
- SPEC 14.12 and 7.5: no policy violation is detectable on a workspace failing validation.

**Observed.** Staging: one unresolved `d` reference.
- A policy-violating edge is still reported as 14.12.
- A recorded orphan (a derived path whose source has left the configuration) gets no 14.10.
- A corrupt record gets no 14.10 unit form.
- The valid controls report both 14.10 forms.

**Location.** `src/workspace/check.ts`.

**Change.** On a failing workspace:
- skip policy evaluation;
- still compare the record against the generated-path set (the recorded-file form);
- still report an unreadable record's unit form.

**Verification.**
- `section-12.1-12.2.test.ts` (T12.2-4).
- Neighbours: `section-7.4-7.5.test.ts`, `section-14.test.ts`.

## Task 53 — `review list` reports a corrupt session as a 14.21 finding (SPEC 14, 14.21, 12.7; C20)

**Requirement.**
- SPEC 14: "Every reported condition carries a stable machine-readable code".
- SPEC 14.21 names `review list` among the reporters of a corrupt session (exit 1).
- SPEC 12.7: wherever a document carries findings, they form the array member `"findings"`, in the finding form.

**Observed.**
- `review list --json` gives `{"sessions":[{"corrupt":true,"name":"s"}]}` with exit 1.
- It carries no `corrupt-session` finding and no concerned path.
- No test fails on this: T14-4 checks only exit 1 and `/corrupt/i`.

**Location.** The `list` rendering in `src/cli/commands/review-session.ts` and `src/cli/commands/review.ts`.

**Change.**
- Add a `findings` member holding one 14.21 finding per corrupt session. Its concerned path is the session file, workspace-relative.
- Keep the `sessions` listing.
- The human output names the code as well.
- First read 10.7 and 12.7 for the list document's members.

**Verification.**
- By hand: a corrupt `s.json` yields the finding.
- `section-10.1.test.ts`, `section-10.7-i.test.ts`, and `section-14.test.ts` (T14-4's `review list` arm, which checks exit 1 and `/corrupt/i`, must keep passing).

## Task 54 — Confirm the full suite and CI are green, record the state, and delete this file

After every other task.

**Change.**
- Run `npm ci` if needed, then `npm run build`, `npm run typecheck`, and `npm run format:check`.
- Run the self project, then the suite project, both under the unprivileged namespace (AGENTS.md's recipes; run in the background and poll). Expect 0 failures.
- Push, then read CI on the head commit: `harness-self`, `suite-linux`, and `suite-windows`.
- Rewrite `AGENTS.md`'s last bullet with the new run facts; it currently lists the 82 known failures.
- Add VERIFY's note to `AGENTS.md`: the failed-ID recipe there greps the `×` lines for `> ID`, which finds nothing on a CI log. On a CI log, extract the IDs from the ` FAIL ` summary lines instead.
- If anything is red, add precise new tasks instead of deleting this file. When everything is green, delete `specs/tmp/FIX_PLAN.md`.

**Verification.** The runs above.
