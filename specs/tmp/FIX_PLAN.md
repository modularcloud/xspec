# FIX_PLAN — Phase 10 (after the re-descent): product adherence to `specs/SPEC.md`

Source: the compliance determination that opened Phase 10 after Phase 9's re-descent closed at `3bfedb5` (branch `claude/xspec-ui-apis-4df8fa`, PR #7; governing IP `specs/patches/0001-external-ui-apis.md`, Stage: Tested; bundle `specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`). Reviewer A (SPEC §1–6) returned 27 gaps, reviewer B (§7–11) 16, reviewer C (§12–15) 20. VERIFY was red on 82 diagnosed product failures, exactly the known set in `AGENTS.md`'s last bullet (CI `suite-linux` red on the same 82; `harness-self` and `suite-windows` green; self project 2950/2950; certification 144 PASS / 33 FAIL / 0 error / 0 hang). The product's last change is `35acd95`. The earlier Phase 10 plan of `72ad038` was superseded by the re-descent before any of its tasks landed; its Tasks 1–3 reappear below as Tasks 30, 32, and 27. Findings are cited as A<n>, B<n>, C<n> (reviewer, gap number); where reviewers reported the same gap, it is one task.

Goal: every test passes — `npm test` locally, and CI's `harness-self`, `suite-linux`, and `suite-windows` on the PR — and the product meets SPEC.md. Tasks 27 and 53 fix SPEC departures that no test currently pins, as Task 21 (landed) did in part; they are in scope all the same.

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
| P-2 | section-16-p2-p3 | 13 (passes since Task 13 landed; its first falsified trial had been seed 271828183's trial 6, a `{}` container in `specs/B.mdx` reported 14.16) |
| P-3 | section-16-p2-p3 | 13 (passes since Task 13 landed; its counterexample, seed 271828183, had held `a{}` in `specs/C.mdx`) |
| P-4 | section-16-p4 | 3 (passes since Task 3 landed; it runs no `inventory`, so it never waited on Task 4) |
| P-5 | section-16-p5-p6 | 3 (passes since Task 3 landed; it runs no `inventory`, so it never waited on Task 4) |
| T1.4-1 | section-1.4 | 1, 5 (passes since Task 5 landed; since Task 1 its one failing arm had been the `&#46;` reference spelling) |
| T1.4-4 | section-1.4 | 1 (passes since Task 1 landed; it stages no character reference) |
| T1.5-2 | section-1.5 | 9 (passes since Task 9 landed) |
| T1.6-5 | section-1.6-1.7 | 14 (passes since Task 14 landed) |
| T1.7-2 | section-1.6-1.7 | 19, 20 (passes since Task 20 landed; since Task 19 its `occurrences` had differed only in `export @dec class`'s unit range, `export   function`'s, and `types.d.ts`'s whole-file attribution) |
| T2.1-2 | section-2.1 | 6 (passes since Task 6 landed) |
| T2.3-3 | section-2.2-2.3 | 7, 14 (passes since Task 14 landed) |
| T2.4-2 | section-2.4 | 14 (passes since Task 14 landed) |
| T2.4-5 | section-2.4 | 6 (passes since Task 6 landed) |
| T2.5-3 | section-2.5-2.6 | 5 (passes since Task 5 landed) |
| T2.6-1 | section-2.5-2.6 | 3 (passes since Task 3 landed) |
| T2.7-3 | section-2.7 | 14 (passes since Task 14 landed) |
| T2.7-4 | section-2.7 | 13, 14 (passes since Task 14 landed) |
| T3-7 | section-3 | 10 (passes since Task 10 landed) |
| T4-2 | section-4 | 6 (passes since Task 6 landed) |
| T4-5 | section-4 | 16, 17 (passes since Task 17 landed) |
| T4.4-1 | section-4.3-4.4 | 18 (passes since Task 18 landed) |
| T4.5-8 | section-4.5 | 16 (passes since Task 16 landed) |
| T4.5-9 | section-4.5 | 16, 17 (passes since Task 17 landed) |
| T4.6-1 | section-4.6 | 19 (passes since Task 19 landed) |
| T4.6-3 | section-4.6 | 20 (passes since Task 20 landed; its first failing arm had been the escape-spelled `function f\u006Fo`, attributed to `src/esc.ts#foo`) |
| T5.5-5 | section-5.5 | 3 (passes since Task 3 landed) |
| T5.7-4 | section-5.7 | 16, 17, 18 (passes since Task 18 landed: `textB(A.missing)` in `src/cross.ts` is 14.7 alone, and the resolving `textB(A.a)` records its occurrence beside its 14.11) |
| T6.2-1 | section-6.2 | 3 (passes since Task 3 landed) |
| T6.2-2 | section-6.2 | 3 (passes since Task 3 landed) |
| T6.4-3 | section-6.4 | 22 |
| T6.5-6 | section-6.5 | 26 |
| T6.5-7 | section-6.5 | 30 |
| T6.5-8 | section-6.5 | 28 (since Task 29 its first failing arm is the TS arm: the added code import carries a `;`) |
| T6.5-9 | section-6.5 | 32 |
| T6.5-10 | section-6.5 | 29 (passes since Task 29 landed, with Task 10) |
| T6.5-11 | section-6.5-ii | 28, 30, 31 |
| T6.5-13 | section-6.5-iii | 26 (since Task 29 its arms (a)–(h) hold; it stops first at arm (i)'s preview, an `id-rewrite` reported for the unchanged `id="m"` of a cross-file move keeping its ID) |
| T6.5-15 | section-6.5-iii | 34 (since Task 10 arm (a)'s three lines derive as one block; it stops first at (a)'s preview, which reports A's declaration removed) |
| T6.5-16 | section-6.5-iii | 11, 35 (since Task 11 the stock pairing rejects arm (a)'s would-be target, so the move is no longer performed: it stops at its own re-validation of the rewritten workspace, exit 1 with the would-be file's 14.20 — `got ["14.20"]` — where the single `refused-invalid-rewrite` is required) |
| T6.5-17 | section-6.5-iii | 25 |
| T6.5-18 | section-6.5-iii | 33 |
| T6.5-19 | section-6.5-iii | 26 (since Task 29 arm (a) holds and (b)'s bytes agree; it stops first at (b)'s preview, an `id-rewrite` reported for the unchanged `id="m"`) |
| T6.6-3 | section-6.6 | 23, 25, 35 |
| T6.6-4 | section-6.6 | 29 (passes since Task 29 landed, with Task 10) |
| T7-1 | section-7-basics | 36 |
| T7-2 | section-7-basics | 8, 37, 38 (since Task 8 its verbatim-literal arms hold — the escape-spelled glob discovers nothing and the escape-spelled group name is named only by its own spelling; it stops first at Task 37's byte-order-mark arm) |
| T7-3 | section-7-basics | 38 |
| T7-4 | section-7-discovery | 39, 40 |
| T7.3-1 | section-7.1-7.3 | 41 |
| T7.4-1 | section-7.4-7.5 | 4 (passes since Task 4 landed) |
| T7.5-1 | section-7.4-7.5 | 4 (passes since Task 4 landed) |
| T10.1-6 | section-10.1 | 45, 46 |
| T11-2 | section-11 | 2, 3, 40, 44 (since Task 2 its malformed-`--tag` sweep holds by hand, twins included; since Task 3 its tag sets hold and it stops first at Task 40's `--file "./specs/alpha/*.mdx"` arm) |
| T11-6 | section-11 | 19 (passes since Task 19 landed) |
| T11-7 | section-11 | 3 (passes since Task 3 landed) |
| T11.2-6 | section-11.2 | 51 |
| T11.3-2 | section-11.3 | 40 |
| T11.3-3 | section-11.3 | 1, 44 (since Task 1 its first failing arm is configuration-first) |
| T11.4-2 | section-11.4 | 40 |
| T11.4-3 | section-11.4 | 3 (passes since Task 3 landed) |
| T11.4-4 | section-11.4 | 14 (passes since Task 14 landed) |
| T11.4-6 | section-11.4 | 3 (passes since Task 3 landed) |
| T11.5-3 | section-11.5 | 9 (passes since Task 9 landed) |
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
| T14-2 | section-14 | 6 (passes since Task 6 landed) |
| T14-4 | section-14 | 51 |
| T14-6 | section-14 | 48, 49 (since Task 12 its early-error stagings hold; it stops first at the 14.24 arm, Task 48) |
| T14-7 | section-14 | 22, 23, 24, 25, 35 |
| T14-9 | section-14-ii | 48 |
| T14-10 | section-14-ii | 49, 50 |
| T14-11 | section-14 | 13, 14, 15, 16, 68 (Tasks 12–16 landed: every table arm holds — (a)–(m) and (p)–(w), (h)'s repeated `id` locating both spellings, [36,44) and [45,54), since Task 15, and (j)'s and (u)'s colliding declarations beside their imports since Task 16; it stops first at arm (n), run after the table's arms, which waits on Task 68: probed by hand, its 14.17 locates both `d` attributes since Task 15, while the second spelling's unresolved `"absent"` reports no 14.5) |
| T14-12 | section-14-iii | 14 (passes since Task 14 landed) |

Several tasks have no failing test of their own: Task 27 (preview/real agreement, which Tasks 30–32 make unobservable on today's stagings), Task 53 (a corrupt session in `review list`), Task 65 (a 14.20 offset inside a container's content more than 256 lines past the grammar's place, found while landing Task 63), Task 66 (a 14.20 offset past the blank line inside a flow tag's attribute expression on the line below a paragraph holding an open text element, found while landing Task 64), Task 67 (a 14.20 offset past the blank line after a brace line below a paragraph line holding an open text expression, found while landing Task 64), Task 69 (a repeated prop's later spellings judged on their own — 14.4 per `id` or `tags` attribute and each spelling's own 14.17 — found while landing Task 15), Task 70 (a TypeScript `text(...)` call's unresolved or non-static argument located at the argument instead of the call, found while landing Task 16), Task 71 (an abstract class member spelling a body or a function-valued initializer bound as a unit, found while landing Task 19), Task 72 (a parenthesized default export bound as a unit, found while landing Task 20), and Task 73 (a move closing several would-be cycles reported as several `refused-cycle` findings, where SPEC 14 gives one finding per reason, found while landing Task 21); Task 55 (a path beginning with U+FEFF, found while landing Task 9), Task 56 (container content the comment deletions empty but that holds a token, found while landing Task 13), Task 57 (the same for an attribute's content, which remark-mdx refused before calling acorn, found while landing Task 56), Task 58 (a 14.20 the grammar reports at a lazy line inside a flow construct's container, located since by the content before it, found while landing Task 57), and Task 59 (a 14.20 inside nested containers, whose content the fixed continuation prefixes could not collect, collected since with the prefix the content's own lines give, found while landing Task 58), Task 60 (a 14.20 tag-pairing offset after a line spelling part of the element's container prefix, probed since with that prefix's rests, and a hidden pairing failure located past a prefix's cut, found while landing Task 59), Task 61 (a 14.20 tag-pairing offset past a closing tag, typed on a line inside the element's container, that cannot pair — a prefix ending inside a tag judged since with the tag finished, found while landing Task 60), and Task 62 (a 14.20 offset at the start of a line that leaves a flow-position container's block container, where the grammar places the end of the file — located since past the container syntax that line still spells, a lone `>` a blank line of a list item in a block quote, found while landing Task 60), and Task 63 (a 14.20 offset past a brace that closes a flow expression whose content spans a blank line, text following the brace on its line — located since at the first character past the brace that the grammar rejects, found while landing Task 60), and Task 64 (a 14.20 offset past the blank line that follows a brace line below a paragraph holding an open text element — located since at that line's terminator, the bound the paragraph's text reading sets, the grammar's flow reading of the brace line never deriving, found while landing Task 62) have landed. Task 21 landed with no test of its own: `REFUSAL_CODES` (`src/core/findings.ts`) is SPEC 14's ten reasons in order, `refused-invalid-rewrite` and `refused-moved-import` included for Tasks 35 and 25 to emit, and `refused-unresolvable-reference` is gone — the moved reference to the target file's own root it reported is refused as the dependency cycle it closes, `refused-cycle` alone (hand-verified: `import B from "./B.xspec"` then `<S id="s" d={B}>` in `specs/A.mdx`, `move specs/A.mdx#s specs/B.mdx#s` exits 1 with one `refused-cycle` locating `B`, nothing modified). Task 29 landed with Task 10: once ESM blocks were bounded as stock MDX 3 bounds them, T6.6-2's move (passing before) added its import at offset 0 of an origin whose first line is `<S id="org">`, the block absorbed that line, and the move's own validation of the rewritten workspace refused it — so additions now go at an admissible offset (`placeSpecImportAdditions` in `src/core/move.ts`). Composite tests (T14-4, T14-6, T14-11, T14-12) restage fixtures from other sections, so the task that lands last may reveal a further arm; if it does, name the arm and its SPEC rule in a new task.

---

## Task 65 — A container's content running more than 256 lines past the grammar's place is located where it fails, not 256 lines on (SPEC 14's location rule for 14.20; found while landing Task 63)

**Requirement.** SPEC 14 locates a syntax failure at "the byte length of the longest whole-character prefix of the file with which some well-formed file begins".

**Observed.** Below `import A from "./A.mdx"` LF LF, `<S id="s">` LF `{[` LF, then n lines alternating `a,` and empty lines, then `]}c` LF `</S>` LF: for n up to 256 the product reports 14.20 at the `c`, as SPEC fixes (Task 63); for n = 260 it reports 553, the end of a content line, where SPEC fixes 561, the `c`; for n = 300, 553 where SPEC fixes 641 (the same at `403d37e`, before Task 63). The grammar's failure is the paragraph's text expression meeting the paragraph's end, placed on the `{[` line, and `openContainerOffset` walks at most `CONTAINER_LINES` (256) lines from there, collecting the content line by line (`collectedPastLine`, a few parses of the growing prefix each), then measures the next line as if the content could not go on past it — an early offset inside viable content. Any container whose content does not run to the end of the file, and whose grammar failure lies more than 256 lines before the content's end, is located so. No test stages the form.

**Location.** `openContainerOffset` in `src/core/mdx-syntax-failure.ts` (the `CONTAINER_LINES` walk; `contentLinePrefix` looks back as far).

**Change (a direction; the engineer designs).** Find the content's last line without a fixed walk: collection is monotone (a container still open past a line is open past every line before it), so a search over lines — galloping from the grammar's place, then bisection — finds the last line past which a `}` still falls in the container in O(log n) probes, each a parse of the prefix; keep the whole bounded.

**Verification.** Hand-probe the staging above for n from 250 to 5,000, at the top level and inside `- > ` and `> - `, with and without a final LF, checking each offset with the product's well-formedness judgement (the Task 59 and 63 bullets in `AGENTS.md`) and timing it; rerun the Task 59, 62, and 63 differentials old-versus-new, every changed offset checked so. Neighbours: `section-14.test.ts`, `section-14-iii.test.ts`, `section-2.7.test.ts`, `section-16-p8.test.ts`.

---

## Task 66 — A flow tag line below a paragraph holding an open text element, its attribute expression's content spanning a blank line, is located at that blank line (SPEC 14's location rule for 14.20; found while landing Task 64)

**Requirement.** SPEC 14 locates a syntax failure at "the byte length of the longest whole-character prefix of the file with which some well-formed file begins".

**Observed.** Below `import A from "./A.mdx"` LF LF, `a <S id="s">` LF `<b x={` LF LF `x} />` is 14.20 at 47, the `}`, where SPEC fixes 45, the blank line's terminator: `a <S id="s">` LF `<b x={` LF `x} />c</S>` derives, but no completion of `...{` LF LF does. As with Task 64's brace line, the stock grammar reads a line beginning with a tag as a flow tag first, which interrupts the paragraph (`a <S id="s">` LF `<b x={1} />` fails pairing at the line above, the element open; the same for a tag spanning lines, `<b` LF `x={1} />`), and as the paragraph's text tag only where text follows the tag on its line (`<b x={1} />c`): the flow reading never derives, and the text reading holds no blank line. Likewise `- a <S id="s">` LF `  <b x={` LF LF `  x} />c</S>` is 53 where SPEC fixes 49; `a <S id="s">` LF `<b {...` LF LF `x} />c</S>` is 48 where SPEC fixes 46; and `a <S id="s">` LF `<b` LF `x={` LF LF `x} />c</S>` is 47 where SPEC fixes 45 (each completion, `…x} />c</S>` one line up, derives by the product's judgement). No test stages the form.

**Location.** `textReadingBound` in `src/core/mdx-syntax-failure.ts` (Task 64) bounds only a container whose `{` begins its line past container syntax (`LINE_SYNTAX` before the brace); here a tag precedes the brace on its line, or the tag holding the brace began on an earlier line.

**Change (a direction; the engineer designs).** Apply the bound where the flow construct holding the container begins on the line right below the paragraph line: the brace's own line with a tag before the brace, or the line where the tag holding the brace begins (walking back over the tag's lines). Task 64's argument carries over — the flow reading interrupts the paragraph, and the text reading's attribute expression cannot span a line of container syntax and whitespace alone — and so does its guard (a paragraph holding a backtick or a bracket is left alone).

**Verification.** Hand-probe the stagings above and their `> `, `> - `, and `- > ` twins, with and without a final LF and with CRLF, each offset checked with the product's well-formedness judgement (the Task 59 bullet's oracle needs tag finishes followed by text: `x} />c</S>`, `x}>c</S>`, `...x} />c</S>`); rerun the Task 64 battery and the Task 59, 62, and 63 differentials old-versus-new, every changed offset checked so. Neighbours: `section-14.test.ts`, `section-14-iii.test.ts`, `section-2.7.test.ts`, `section-16-p8.test.ts`.

---

## Task 67 — A brace line below a paragraph line holding an open text expression, the content spanning a blank line, is located at that blank line (SPEC 14's location rule for 14.20; found while landing Task 64)

**Requirement.** SPEC 14 locates a syntax failure at "the byte length of the longest whole-character prefix of the file with which some well-formed file begins".

**Observed.** Below `import A from "./A.mdx"` LF LF, `a {` LF `{` LF LF `x}}` is 14.20 at 34 where SPEC fixes 31, the blank line's terminator: `a {` LF `{` LF `}}` derives, but no completion of `a {` LF `{` LF LF does. Read as a flow expression, the brace line interrupts the paragraph and leaves the paragraph's text expression open at its end; read as the paragraph's continuation (text following the brace line's closing brace), it is content of that text expression, which cannot span the blank line. Likewise `- a {` LF `  {` LF LF `  x}}` is 40 where SPEC fixes 35; `> a {` LF `> {` LF `>` LF `> x}} b` is 41 where SPEC fixes 36; and `a {` LF `{` LF LF is 32, its length, where SPEC fixes 31. No test stages the form.

**Location.** `src/core/mdx-syntax-failure.ts`: the grammar's failure is the paragraph's text expression meeting the paragraph's end (`unexpected-eof`), located by `openContainerOffset` and `measuredThroughLine`, which measure past the blank line.

**Change (a direction; the engineer designs).** Bound the content of a text expression open at the end of a paragraph line whose next line is a brace line as Task 64's `textReadingBound` bounds a brace line's own content: at the terminator of the first later line of container syntax and whitespace alone, where the content is still open there, unless it fails earlier. The paragraph test differs: the prefix through the line above fails as a text expression open at the end of a paragraph, not as a pairing failure.

**Verification.** Hand-probe the stagings above with `- `, `> `, `> - `, and `- > ` forms, with the expression opened at a line's start or after text, closed (text following or not) or left open, with and without a final LF and with CRLF, each offset checked with the product's well-formedness judgement (the Task 59 bullet's oracle, with `}}` finishes); rerun the Task 64 battery and the Task 59, 62, and 63 differentials old-versus-new, every changed offset checked so. Neighbours: `section-14.test.ts`, `section-14-iii.test.ts`, `section-2.7.test.ts`, `section-16-p8.test.ts`.

## Task 68 — Every `d` of a section that repeats the prop resolves per spelling (SPEC 11.2 "Resolution", 14.5, 14.8; found while landing Task 15)

**Requirement.** SPEC 11.2: "Resolution is per spelling, whatever the validity of the attribute holding it: each entry of every `d` attribute of a section that repeats the prop (14.17) resolves or not on its own — an occurrence, or a finding (14.5), beside the repetition's finding — exactly as the entries of a single `d` do."

**Observed.** T14-11 arm (n) (`runRepeatedDependencyArm` in `test/suite/registry/section-14.ts`) stages `<S id="r" d={"ok"} d={"absent"}>` below the 33-byte preamble section `ok`. Since Task 15, `build --json` reports the one 14.17 locating both `d` attributes, [43,51) and [52,64), and nothing else, and `occurrences` records the first spelling's `"ok"` alone, [46,50) → `specs/A.mdx#ok`. Both answers must also carry a 14.5 at the second spelling's expression `"absent"`, [55,63), which records no occurrence. The section model holds one dependency: `processDependencyProp` sets `section.dependency` from the first `d` spelling, a later spelling is skipped in `processAttributes`' repetition branch, and `analyzeSpecReferences` reads that one field.

**Location.** `src/core/mdx.ts`: `SpecSection.dependency` and `MutableSection.dependency` (with their `null` initializers), the repetition branch of `processAttributes`, and `processDependencyProp`. `src/core/spec-references.ts`: `analyzeSpecReferences`, the field's only reader.

**Change.** Record every braced `d` spelling of a section in tag order (for example `dependencies: readonly SpecDependencyAttribute[]`, empty where none). Analyze each in `analyzeSpecReferences` exactly as a single `d` is analyzed, so each entry of a later spelling records an occurrence, reports 14.5 through the graph, or reports 14.8 when dynamic. The repetition keeps its one 14.17 (Task 15). A quoted or valueless later spelling holds no entries; its own value-form 14.17 is Task 69's. The graph's duplicate-target collapse (SPEC 2.2, 5.2) applies across spellings as within one array literal. A section repeating `d` fails validation (14.17), so `build` writes nothing and `rename`/`move` refuse; the extra spellings show on the per-file surfaces (11.3–11.5).

**Verification.** `section-14.test.ts`: T14-11 arm (n) (the test also waits on Task 16, whose arm (j) it reaches first). Meanwhile hand-probe arm (n)'s bytes: `build --json` and `occurrences` must each carry the 14.17 at [43,51) and [52,64) and the 14.5 at [55,63), exit 1, and `occurrences` exactly the one occurrence above. Neighbours: `section-2.2-2.3.test.ts`, `section-5.7.test.ts`, `section-11.3.test.ts`, `section-11.5.test.ts`.

---

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

After Task 21 (landed: `REFUSAL_CODES` lists `refused-moved-import`).

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
- `section-6.5-iii.test.ts`: T6.5-13 (it stops first at arm (i)'s preview, an `id-rewrite` for the unchanged `id="m"`) and T6.5-19 (arm (b)'s preview, likewise). Task 29's placement already writes the bytes those arms and their successors assert, as far as the run reached; if a later arm fails on another rule, name it and its SPEC rule in a new task.
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
- `section-6.5.test.ts`: T6.5-8 (its target arm holds since Task 29).
- `section-6.5-ii.test.ts`: T6.5-11 (with Tasks 30 and 31).
- Neighbour: `section-6.6.test.ts`.

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

Task 10, its prerequisite, has landed.

**Requirement.** SPEC 6.5: in a spec source, "the removals in one block are judged together". Where they would leave the block headed by anything but a declaration at the start of its first line — a JavaScript comment or an indented declaration — the remaining declarations would derive as paragraph text (14.20). Then:
- the block's first declaration stays, "its binding unused (2.1) and no removal reported for it (6.6)";
- the other declarations are removed;
- "a block they would leave with no line at all … [has] its first declaration removed with the rest".

**Observed.** When removals would leave a block headed by a comment or an indented declaration, the first declaration is removed too. For example, `import A … // note` above `import B …` loses both lines.

**Location.** `src/core/move.ts`: `SpecImportPlan.removedImports()` (~719–812) and the removal closure (~1455–1500).

**Change.** Judge each block's removals jointly, over the block as all of them would leave it. Keep the first declaration, with no `import-removal` reported for it, when the rest would not start with a declaration at the start of the block's first line — unless no line of the block would remain.

**Verification.**
- `section-6.5-iii.test.ts`: T6.5-15 (Task 10 has landed).
- Neighbours: `section-6.5.test.ts`, `section-6.6.test.ts`.

## Task 35 — Refuse a section move whose rewrite would be invalid: `refused-invalid-rewrite` (SPEC 6.5 "Validation and refusals", 14, 6.6; A24, C19(d))

After Task 21 (landed: `REFUSAL_CODES` lists `refused-invalid-rewrite`; Tasks 10, 11, and 29 have landed too).

**Requirement.** SPEC 14, `refused-invalid-rewrite`: "the section form's exact edits would leave the origin or the target file other than well-formed MDX, or a file the rewrite must add an import to holds no admissible offset for it (6.5)". It is evaluated only over an intrinsically valid new ID, as `refused-structural-parent` is. It is one finding that locates:
- the moved section's construct in the origin file (1.7);
- for each addition that no offset admits, every reference spelling the operation roots at its binding.

Its `identities` are the workspace-relative paths of the files concerned, in byte order: each file whose would-be text is not well-formed MDX (a target file to be created included), and each file holding no admissible offset for an addition it needs. SPEC 6.5 ("Moved text and insertion", "Validation and refusals") defines the edits being judged. A preview reports exactly the same (6.6).

**Observed.** Not implemented. Before Task 11 every shape that should be refused was performed with exit 0. Since Task 11 a shape whose would-be file the stock grammar rejects is no longer performed: the move's in-memory re-validation of the rewritten workspace (step 6 in `src/cli/commands/move.ts`) exits 1 reporting that file's 14.20 and writes nothing — hand-verified for a flow section moved into a text-position parent (`foo <S id="p">bar</S> baz`: the would-be `specs/t.mdx` reported `unparseable-source`), and T6.5-16 arm (a) fails with `got ["14.20"]` — where the single `refused-invalid-rewrite` finding is required; shapes the stock grammar accepts but 6.5 still refuses (no admissible offset for an addition) are not re-observed. This covers T6.5-16's 24 refused arms and its five performed controls, T6.6-3's preview twins, and T14-7's arm. AGENTS.md's T6.5-16 bullets describe the arms.

**Location.**
- `src/core/refusal.ts`: the section-form reasons.
- `src/core/move.ts`: the planned edits, and the `admissible` flag `placeSpecImportAdditions` returns (landed with Task 29; `withImportAdditions` discards it today, the file then taking the first candidate and the rewrite failing the workspace validation).

**Change.**
- After planning, apply the exact edits in memory to the origin, the target, and any created target file.
- Judge each file with `specSourceParseFailure(file, bytes)` (`src/core/mdx.ts`, landed with Task 11: null exactly when the bytes are well-formed — the stock MDX 3 verdict `parseSpecSource` reaches, without building the model), and collect the files that lack an admissible offset for an addition they need (`admissible: false`).
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

**Verification.** `section-7-basics.test.ts`: T7-2's BOM arm, where T7-2 stops first since Task 8 landed (T7-2 also waits on Task 38).

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

## Task 69 — Every spelling of a repeated prop is judged on its own (SPEC 14.4, 2.7, 14.17; found while landing Task 15)

**Requirement.** SPEC 14.4: "one finding per `id` or `tags` attribute whose value violates it". SPEC 2.7 fixes each prop's value per attribute: "The value of `id`, `coverage`, and `tags` MUST be a static string literal in quoted attribute form", "a quoted or valueless `d` is invalid (14.17)", and "Unknown props, and `coverage` values other than `required` and `none`, are invalid (14.17)". SPEC 14 locates an attribute condition at the attribute's own characters. A repeated name's one 14.17 (Task 15) exempts no spelling from these per-attribute rules.

**Observed.** `processAttributes` in `src/core/mdx.ts` judges the first spelling of a name and skips every later one, so the findings depend on spelling order (probed at c61c114 in a scratch workspace; each case also carries the repetition's 14.17):
- `<S id="a" id="b c">` reports no 14.4, while `<S id="b c" id="a">` reports one at `id="b c"`.
- `<S id="t" tags="ok" tags="bad#tag">` reports no 14.4.
- `<S id="v" coverage="none" coverage="maybe">` reports no invalid-value 14.17, while `coverage="maybe" coverage="none"` reports one.
- The same holds for a later braced or valueless `id`, `tags`, or `coverage`, a later quoted or valueless `d`, and a later spelling of an unknown prop.

**Location.** `src/core/mdx.ts`: the repetition branch of `processAttributes`, and `processStringProp` and `processDependencyProp`, which both validate and record.

**Change.** Judge every spelling as if it stood alone: the value-form and invalid-value 14.17s, the unknown-prop 14.17, and 14.4 for an `id` or `tags` value violating 1.4. Record no interpreted value from a repeated name: the section spells no identity (11.2), its tags or coverage stay undefined, and its `d` spellings are Task 68's. Separate validation from recording in `processStringProp` (and `processDependencyProp`), so a later spelling reports without setting `section.id`, `idAttribute`, `tags`, or `coverage`. No test pins these counts: T2.7-3 asserts only the condition and window of a repeated unknown prop's findings, and every other staged repetition (T1.3-6, T6.4-4's `specs/Solo.mdx`, T11.2-2, T11.4-3, T14-11 (h) and (n)) spells valid values, so their counts hold.

**Verification.** Hand-probe the Observed cases in both spelling orders: each spelling's own finding beside the one repetition finding. Run `section-1.3.test.ts`, `section-2.7.test.ts`, `section-6.4.test.ts`, `section-11.2.test.ts`, `section-11.4.test.ts`, and `section-14.test.ts`.

## Task 70 — A TypeScript `text(...)` call's unresolved or non-static argument is located at the call, callee through closing parenthesis (SPEC 14, 5.7; found while landing Task 16)

**Requirement.** SPEC 14: "A reference spelling — unresolved (14.5–14.7), non-static or of wrong arity (14.8), or cross-module (14.11) — is located by the span its occurrence occupies or would occupy, per kind (5.7): … a TypeScript `text(...)` call, callee through closing parenthesis". SPEC 5.7: "a TypeScript `text(...)` occurrence spans the entire call expression, callee through closing parenthesis, argument included".

**Observed.** Probed at 2e7a9aa in a scratch workspace: `src/app.ts` holds `import SPEC, { text } from "../specs/A.xspec";`, a blank line, then `text(SPEC.missing);`, `text("x");`, and `` text(`x`); `` on their own lines; `specs/A.mdx` holds sections `a` and `b`. `build --json` reports the 14.7 at [53,65), the argument chain `SPEC.missing`, where the call spans [48,66); and each 14.8 at its literal alone, [73,76) and [84,87), where the calls span [68,77) and [79,88). Already located at the call: an optional call, type arguments, a wrong arity, a cross-module 14.11, and, since Task 16, a chain rooted at a colliding identifier. Since Task 18 a cross-module call whose argument does not resolve is 14.7 alone, reported through the same graph loops and so located at the argument too: T4.4-1's `textB(A.missing)` below its 85-byte import prefix reports [91,100), where the call spans [85,101); the resolving call's 14.11 is located at `occurrenceRange`, the call (`crossModuleTextFinding` in `src/core/graph.ts`).

**Location.**
- `src/core/graph.ts`: the two loops over `analysis.references` that report an unresolved reference's 14.7 at `reference.range`, for valid-path and for 14.19 code files. For an `embeds` reference, `reference.occurrenceRange` is the call; a marker's two ranges coincide.
- `src/core/code-analysis.ts`, `analyzeTextCall`: the 14.8 findings located at `argument` (a spread element, a string literal, a template literal, a non-chain argument) and the undefined-member 14.7 located at `argument`.

**Change.** Locate each of these findings at the call expression: `rangeOf(call)` in `analyzeTextCall`, and `occurrenceRange` for an `embeds` reference in the graph. Leave markers unchanged.

**Verification.** No suite test pins these ranges: T4.3-2, T4.4-1's second facet, and T5.7-4's `src/cross.ts` findings assert windows that hold both the argument and the call. Hand-probe the Observed staging (each finding at its call) and an undefined-member call (an import of a spec source whose own path is invalid, 14.19). Run `section-4.3-4.4.test.ts`, `section-5.7.test.ts`, `section-14.test.ts`, `section-2.4.test.ts`, `section-11.3.test.ts`, and `section-12.1-12.2.test.ts`.

## Task 71 — An abstract class member binds no unit, whatever body or initializer it spells (SPEC 4.6, 14.20; found while landing Task 19)

**Requirement.** SPEC 4.6: "Neither is a declaration that binds no executable code — an overload signature, a body-less method signature, an abstract member, or a declaration in an ambient context, …: none is a unit or occupies a document-order slot (below)". Units are read by the construct's own form, and SPEC 14.20 leaves TypeScript's post-parse grammar checks out of well-formedness. So a class member carrying the `abstract` modifier is well-formed, and binds no unit, even where it spells a body (`abstract m(): void {}`, TS1245 only after parsing), a function-valued initializer (`abstract p = () => {}`, TS1267), or is a constructor (`abstract constructor() {}`, TS1242). A class declaration's own `abstract` (`abstract class A`) is no abstract member: the class is a unit.

**Observed.** Probed with Task 19 landed, in a scratch workspace. `src/c.ts` holds `abstract class A {` with, in order, `abstract m(): void { SPEC.a; }`, `abstract p = () => { SPEC.b; };`, `abstract get g(): number { SPEC.a; return 1; }`, `abstract constructor() { SPEC.b; }`, and a concrete `m(): void { SPEC.b; }`. `build` exits 0. `occurrences` attributes the four abstract members' markers to `A.m`, `A.p`, `A.g`, and `A.constructor`, and the concrete method's to `A.m@2`. SPEC fixes the bare class `A` for the first four and `A.m` for the last. `unitName` rejects a method, accessor, or constructor only when it has no body, and a property only when its initializer is not a function, arrow, or class expression; it never consults the `abstract` modifier. TypeScript's emit keeps the spelled bodies and drops the property, so "binds no executable code" is read from the member's form, not from what is emitted. No test stages the form: T4.6-3's abstract getter and T14-12 arm (m)'s misplaced `abstract m(): void` are both body-less.

**Location.** `unitName` in `src/core/code-analysis.ts`: the constructor branch (Task 19), the method and accessor branch, and the property branch.

**Change.** Before the per-kind branches, return null for a class member (a node whose parent is class-like) that carries the `abstract` modifier (`hasModifier(node, ts.SyntaxKind.AbstractKeyword)`). The member then occupies no document-order slot, and markers inside it attribute to the enclosing unit.

**Verification.** Hand-probe the Observed staging. The four abstract members' markers must attribute to `A` and the concrete method's to `A.m`. `query edges --from src/c.ts#A.m@2` must exit 2 as an unknown node, and `abstract class A` must stay a unit. Run `section-4.6.test.ts`, `section-1.6-1.7.test.ts`, `section-11.test.ts`, and `section-14-iii.test.ts`.

## Task 72 — A parenthesized default export binds no unit (SPEC 4.6, 1.7; found while landing Task 20)

**Requirement.** SPEC 4.6: "Both readings are by the construct's own form: an initializer or exported expression that merely wraps one of the named forms — parenthesized, `as`-cast, `satisfies`-qualified, or non-null-asserted — is another expression and binds no unit." So `export default (() => {})`, `export default (function () {})`, `export default (function f() {})`, and `export default (class C {})` bind no unit. A marker directly inside one attributes to the file, and a method of the wrapped class expression chains from no `C` (`path#m`). The unit named `default` comes only from an unwrapped anonymous construct: `export default () => {}`, `export default function () {}`, `export default class {}`.

**Observed.** Probed with Task 20 landed, in a scratch workspace; `build` exits 0 on every file.
- `export default (() => { SPEC.p1; });` attributes to `path#default`, its range the whole export declaration.
- `export default (function named() { SPEC.p2; });` attributes to `path#named`.
- `export default (function () { … });` and `export default ((() => { … }));` attribute to `path#default`.
- `export default (class Named { m() { SPEC.p4; } });` attributes to `path#Named.m`, where SPEC gives `path#m`.
- The `as`-cast control `export default (() => { … }) as () => void;` already attributes to the file, and the unwrapped `export default () => { … };` to `path#default`.

No test stages a parenthesized default export.

**Location.** `src/core/code-analysis.ts`: `unitName`'s `ts.isExportAssignment` branch reads the exported expression through `stripParentheses`, and `unitRange`'s matching branch does the same.

**Change.** Read the exported expression as spelled, without stripping parentheses. An export assignment (never `export =`) then binds `default` exactly when its expression is an arrow function. TypeScript parses an unwrapped `export default function …` or `export default class …` as a declaration, so a function or class expression reaches an export assignment only wrapped; `unitRange`'s named-expression case becomes dead, and the `default` unit keeps the whole export declaration's range.

**Verification.** Hand-probe the Observed staging: the four parenthesized forms attribute to the file (the class expression's method to `path#m`), `query edges --from src/p1.ts#default` exits 2 as an unknown node, and the unwrapped arrow keeps `path#default` with its whole-declaration range. Run `section-4.6.test.ts` and `section-1.6-1.7.test.ts` (T1.7-2 pins the `default` arrow and the named-default forms), with `section-11.test.ts` as a neighbour.

## Task 73 — A refused move reports one `refused-cycle` finding, however many would-be cycles it closes (SPEC 14 refusal paragraph, 6.5; found while landing Task 21)

**Requirement.** SPEC 14: "A refused operation or preview reports every applicable reason together, one finding per reason — never only the first found". `refused-cycle` ("the move would create a spec import cycle or a dependency cycle (6.5)") is one reason. So a move that closes several would-be cycles — a dependency cycle beside a spec import cycle, or cycles in distinct strongly connected components — reports one `refused-cycle` finding. Under 14's cardinality rule it locates each cycle's full path: every reference spelling recording a participating dependency edge, and each participating import declaration (with Task 24, each would-be-added import by the spellings rooted at its binding). Each construct is located once, in location order. T6.5-4 and T12.7-2 assert exactly one finding per applicable reason, but none of their stagings closes two cycles. Condition 14.9 (`build`/`check`) is not this rule: there each cycle stays its own finding.

**Observed.** Probed with Task 21 landed, in a scratch workspace; `build` exits 0.
- `specs/A.mdx`: `import B from "./B.xspec"`, then `<S id="k">`, `<S id="u" d={B.q}>`, and `<S id="s" d={[B.p, "k"]}>`, each holding one line of text. `specs/B.mdx`: `<S id="p">` and `<S id="q">`.
- `move specs/A.mdx#s specs/B.mdx#p.s --preview --json` exits 1 with two `refused-cycle` findings. One is the spec import cycle `specs/A.mdx → specs/B.mdx → specs/A.mdx`, locating A's import declaration `[0,25)`. The other is the dependency cycle `specs/B.mdx#p → specs/B.mdx#p.s → specs/B.mdx#p`, locating `B.p` at `[95,98)`.

**Location.** `src/core/refusal.ts`: `evaluateMoveFileRefusals` and `evaluateMoveSectionRefusals` push both `wouldBeDependencyCycleFindings(...)` and `wouldBeImportCycleFindings(...)`. Each returns one finding per cyclic strongly connected component (`findCycles`, `src/core/graph.ts`).

**Change.** Gather both halves' cycles and emit at most one `refused-cycle` finding. Its locations are the union of every cycle's located constructs, deduplicated (one spelling can record a dependency edge of one cycle and root a would-be import of another), sorted as `sortLocations` sorts. Its message names each cycle's path. Leave 14.9's per-cycle findings alone.

**Verification.** Hand-probe the Observed staging: one `refused-cycle` finding locating `[0,25)` and `[95,98)` (and, once Task 24 lands, the `"k"` spelling rooted at the would-be import of `A`). Run `section-6.5.test.ts`, `section-6.6.test.ts`, `section-12.7.test.ts`, and `section-14.test.ts` (T14-7's cycle arms).

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
