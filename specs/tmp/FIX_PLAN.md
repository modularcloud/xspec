# FIX_PLAN — Phase 10 (after the re-descent): product adherence to `specs/SPEC.md`

Source: the compliance determination that opened Phase 10 after Phase 9's re-descent closed at `3bfedb5` (branch `claude/xspec-ui-apis-4df8fa`, PR #7; governing IP `specs/patches/0001-external-ui-apis.md`, Stage: Tested; bundle `specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`). Reviewer A (SPEC §1–6) returned 27 gaps, reviewer B (§7–11) 16, reviewer C (§12–15) 20. VERIFY was red on 82 diagnosed product failures, exactly the known set in `AGENTS.md`'s last bullet (CI `suite-linux` red on the same 82; `harness-self` and `suite-windows` green; self project 2950/2950; certification 144 PASS / 33 FAIL / 0 error / 0 hang). The product's last change is `35acd95`. The earlier Phase 10 plan of `72ad038` was superseded by the re-descent before any of its tasks landed; its Tasks 1–3 reappear below as Tasks 30, 32, and 27. Findings are cited as A<n>, B<n>, C<n> (reviewer, gap number); where reviewers reported the same gap, it is one task.

Goal: every test passes — `npm test` locally, and CI's `harness-self`, `suite-linux`, and `suite-windows` on the PR — and the product meets SPEC.md. Task 53 fixes a SPEC departure that no test currently pins, as Tasks 21 (in part) and 27 (both landed) did; it is in scope all the same.

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
| T6.4-3 | section-6.4 | 22 (passes since Task 22 landed) |
| T6.5-6 | section-6.5 | 26 (passes since Task 26 landed: the kept-ID move's preview reports the origin's `origin-deletion` and the target's `target-insertion` alone, no `id-rewrite` or `reference-rewrite` for the unchanged `id='x.c'`, `id="x"`, `id="x.u"`, and `d={"x.c"}`) |
| T6.5-7 | section-6.5 | 30 (passes since Task 30 landed: the own-line and shared-line code variants' origin-module imports are removed with 6.5's exact extent) |
| T6.5-8 | section-6.5 | 28 (passes since Task 28 landed; since Task 29 its one failing arm had been the TS arm, the added code import carrying a `;`) |
| T6.5-9 | section-6.5 | 32 (passes since Task 32 landed: an added declaration's fresh identifiers avoid every identifier the receiving code file spells — `CodeAnalysis.spelledNames`, every scope's bindings, value- and type-level, imports included — so the TS arm binds `Target2`, passing over the pre-empted `const`, `function`, `class`, `type` alias, and non-spec import bindings) |
| T6.5-10 | section-6.5 | 29 (passes since Task 29 landed, with Task 10) |
| T6.5-11 | section-6.5-ii | 28, 30, 31 (passes since Task 31 landed: each arm's call is rewritten whole, `t(O.x)` becoming `targetText(target.y)` — `targetText(T.y)` in (b), through its existing `T` — the added declaration binding exactly the lacked bindings, and the origin import removed with its line in (a), (b), and (d)) |
| T6.5-13 | section-6.5-iii | 26 (passes since Task 26 landed; since Task 29 its arms (a)–(h) had held and it had stopped first at arm (i)'s preview, an `id-rewrite` reported for the unchanged `id="m"` of a cross-file move keeping its ID) |
| T6.5-15 | section-6.5-iii | 34 (passes since Task 34 landed: a spec source's removals are judged per ESM block — `SpecImportPlan.removedImports(bytes)` and `removalsLeaveBlockHeaded` in `src/core/move.ts` — so where they would leave the block headed by anything but a kept declaration opening its first line, the block's first declaration stays, unreported, in arms (a), (b), and (c)) |
| T6.5-16 | section-6.5-iii | 11, 35 (passes since Task 35 landed: the refusal evaluation composes the section form's exact edits as the plan composes them — `judgeMoveSectionRewrite` in `src/core/move.ts`, called from `evaluateMoveSectionRefusals` under an intrinsically valid new ID — judging the origin always, the target (a created one included) where an insertion point exists, and every spec source's additions for an admissible offset, so every refused arm reports the one `refused-invalid-rewrite` beside its other reasons, and the alone arms and controls hold) |
| T6.5-17 | section-6.5-iii | 25 (passes since Task 25 landed: each refused arm reports the single `refused-moved-import` locating each declaration's own characters, `refused-invalid-id` beside it in (d), previewed alike; the control (e) is performed as composed) |
| T6.5-18 | section-6.5-iii | 33 (passes since Task 33 landed: a re-rooted chain root or `text` callee takes the first existing target-module binding that no local declaration shadows at the occurrence — `CodeReference.shadowedImportNames`, the checker's value-level resolution of each import-bound identifier at the chain's root — so the marker in `f`, where `const T = 1` shadows the import, becomes `target.y` under an added `import target from "../specs/target.xspec"`) |
| T6.5-19 | section-6.5-iii | 26 (passes since Task 26 landed; since Task 29 it had stopped first at arm (b)'s preview, an `id-rewrite` reported for the unchanged `id="m"`) |
| T6.6-3 | section-6.6 | 23, 25, 35 (passes since Task 35 landed: its `--preview` replays of T6.5-16's refused and alone arms report the real operation's findings, and the replays of T6.5-17's arms, run after them, hold since Task 25 — `refused-moved-import` alone, the would-be text judged well-formed with its additions admitted) |
| T6.6-4 | section-6.6 | 29 (passes since Task 29 landed, with Task 10) |
| T7-1 | section-7-basics | 36 (passes since Task 36 landed: `occupantOf` in `src/workspace/locate.ts` classifies the found or named configuration path by `lstat`, so the upward search stops at the nearest entry named `xspec.config.ts` whatever occupies it, and a directory or symbolic-link occupant, found or named, is 14.14 concerning that entry in the anchoring form, never read through) |
| T7-2 | section-7-basics | 8, 37, 38 (passes since Task 38 landed: `checkConfiguredName` in `src/core/config.ts` refuses an empty or U+FFFD-bearing group name — a `specs` or `code` key — and profile or rule `name`, each one 14.14 giving the key and its line, so the empty-name arms, a spec group `""` and a profile and a rule named `""`, exit 2 naming the file; since Task 8 its verbatim-literal arms had held, and since Task 37 its encoding and repeated-key arms) |
| T7-3 | section-7-basics | 38 (passes since Task 38 landed: its U+FFFD-name arms — a spec group key, a profile name, and a rule name, each the encoded code point `EF BF BD` between two letters — are each 14.14, exit 2 naming the file) |
| T7-4 | section-7-discovery | 39, 40 (passes since Task 40 landed: an inside glob is matched as spelled, each `.`, `..`, or empty segment the `never` pattern segment of `parseSegment` in `src/core/glob.ts`, matching no path segment, so the inside-root arms `a/../b/*.mdx`, `./specs/*.mdx`, `specs//*.mdx`, and `specs/*.mdx/` each discover nothing beside the control; since Task 39 its outside-root arms had held — `**/../x/*.mdx`, `a/../../x/*.mdx`, `/specs/*.mdx`, and `../x/*.mdx` each 14.14, exit 2, the depth count `globLiesOutsideRoot` deciding by spelling alone) |
| T7.3-1 | section-7.1-7.3 | 41 (passes since Task 41 landed: `outDirSpellingProblem` in `src/core/discovery.ts` judges `markdown.outDir`'s verbatim literal by spelling alone, so `""`, `/out`, `./out`, `out/../x`, `out//x`, `out/`, `../out`, and `docs/../../out` are each 14.14, exit 2 naming `xspec.config.ts`, nothing written; `out/sub` redirects the emission) |
| T7.4-1 | section-7.4-7.5 | 4 (passes since Task 4 landed) |
| T7.5-1 | section-7.4-7.5 | 4 (passes since Task 4 landed) |
| T10.1-6 | section-10.1 | 45, 46 (passes since Task 46 landed: below the graph-data area's own path `.xspec` holding a plain file, or a symbolic link to a directory holding a journal, graph data, and a valid session, nothing is read — `readableOccupant` in `src/workspace/writes.ts` classifies the journal's path absent there (`journalOccupant` in `src/workspace/journal.ts`, which every current-journal read consults, baseline replay's and the fast path's included), and `loadGraphData` in `src/workspace/graph-data.ts` classifies the area first, a non-directory occupant making the record unreadable (since Task 47 through `readStoredFile`, which `readDerivedFileRecord` shares for the record's own file) — so `inventory --json` reports `recorded` unavailable, `journal.occupied` false, and `sessions` `[]` beside the one condition-23 finding concerning `.xspec`, exit 1, and `check` the unreadable-record unit form beside the one 14.22; since Task 45 its session-directory arms and three stale twins had held) |
| T11-2 | section-11 | 2, 3, 40 (passes since Task 40 landed: its inside `--file` spellings, `./specs/alpha/*.mdx` and its twins, answer no rows, exit 0; it never waited on Task 44 — its outside-root `--file` arms run on a valid workspace, and its twin sweep under an invalid and a missing configuration covers only the malformed `--tag` values Task 2 judges at parse level; since Task 3 its tag sets had held) |
| T11-6 | section-11 | 19 (passes since Task 19 landed) |
| T11-7 | section-11 | 3 (passes since Task 3 landed) |
| T11.2-6 | section-11.2 | 51 (passes since Task 51 landed: on its obstructed-write-path fixture, `mdout` a plain file after a build, `check` reports the one 14.22 concerning `mdout` alone — the deleted `mdout/specs/C.md` is a per-file mismatch 14.10 leaves unreported on a workspace failing `build`'s validations; `checkCommand` in `src/cli/commands/check.ts` consults `mismatchStalenessFindings` only where `obstructedWritePathFindings` finds nothing) |
| T11.3-2 | section-11.3 | 40 (passes since Task 40 landed: `./specs/*.mdx` and `specs//*.mdx` admit the empty set, an empty, finding-free answer, exit 0) |
| T11.3-3 | section-11.3 | 1, 44 (passes since Task 44 landed: every malformed `--to` spelling — the `requirement-node` spelling rule `spellingProblem` in `src/cli/args.ts` applies, `nodeSpellingProblem` beneath it — is the plain usage error, byte-identical with the configuration invalid or missing; since Task 1 its first failing arm had been configuration-first) |
| T11.4-2 | section-11.4 | 40 (passes since Task 40 landed) |
| T11.4-3 | section-11.4 | 3 (passes since Task 3 landed) |
| T11.4-4 | section-11.4 | 14 (passes since Task 14 landed) |
| T11.4-6 | section-11.4 | 3 (passes since Task 3 landed) |
| T11.5-3 | section-11.5 | 9 (passes since Task 9 landed) |
| T11.6-2 | section-11.6 | 4 (passes since Task 4 landed) |
| T12.0-10 | section-12.0-ii | 44 (passes since Task 44 landed: `parseArgv` in `src/cli/args.ts` judges the whole syntax class before `main` locates the configuration — each flag's `spelling` and each command's `operandSpellings` name a `SpellingRule`, and `PREVIEW_FLAG.excludes` refuses `--test-hold` beside `--preview` — so the `--test-hold`, `.x` session-name, `+7` offset, malformed `--to`, and outside-root `--file` rows report the plain usage error under an invalid and a missing configuration alike, no hold file created; its `--tag 'a\b'` row had held since Task 2) |
| T12.0-14 | section-12.0-iii | 43 (passes since Task 43 landed: `parseArgv` in `src/cli/args.ts` reads the tokens in stages — `walkTokens` strips flags anywhere, each flag's arity fixed by its name across commands (`FLAG_ARITY`, a name of no command taking no value), and honours `--`; JSON output is in effect exactly for a `--json` the walk reads as a flag, or a JSON-only surface; then `matchCommand` matches the remaining words to the synopsis and each walked flag is checked against the command's accepted set — so `--json ids`, `--config cfg/xspec.config.ts build`, and `ids --` run, while `ids -- --json`, `build --file --json`, and `ids --file --json extra` exit 2 with stdout empty) |
| T12.2-4 | section-12.1-12.2 | 52 |
| T12.3-1 | section-12.3-12.5 | 40 (passes since Task 40 landed) |
| T12.7-3 | section-12.7 | 42, 48, 49 (passes since Task 49 landed: its last arm, the Linux-leg 14.25 one — `build --json` with `specs/sub` unlistable — exits 2 with `{"code": "read-failure", "path": "specs/sub"}`, the discovery walk's refused listing raised through `performRead` in `src/workspace/environment-refusal.ts` (`walk` in `src/workspace/discovery.ts`); since Task 42 every configuration arm had held — an unoccupied `--config` path, `./../cfg//xspec.config.ts` and an absolute one, reported byte-for-byte as given, the same spellings reporting `../cfg/xspec.config.ts` once the malformed file exists — with the search-failure, single-finding, usage, and linked-working-directory arms, and since Task 48 its 14.24 arm, `{"code": "write-failure", "path": ".xspec"}`) |
| T13.3-2 | section-13.3 | 47 (passes since Task 47 landed: the graph-data area holds the snapshot with its derivation inputs at `.xspec/graph.json` and the recorded derived-file paths apart at `.xspec/record.json` — `GRAPH_DATA_PATH` and `DERIVED_FILE_RECORD_PATH` in `src/core/graph-data.ts`, both read through `readStoredFile` in `src/workspace/graph-data.ts` — and a refreshing read writes the snapshot file alone (`assessWorkspaceRead` in `src/workspace/refresh.ts`, `finishAvailabilityRefresh` in `src/workspace/availability.ts`), so after the deletion arm's refresh `inventory` reports `recorded` `[]` and `check` is clean, a readable record stays byte-for-byte, and an unreadable one stays untouched while the refresh rewrites the snapshot beside it) |
| T13.4-6 | section-13.4 | 51 (passes since Task 51 landed: on the never-built workspaces whose `out` is a symbolic link or a plain file, `check` reports the 14.22 findings alone, no per-file 14.10 for the never-generated module, companions, or Markdown and no graph-data mismatch unit form) |
| T13.5-1 | section-13.5 | 43 (passes since Task 43 landed: `build --test-hold --json` consumes `--json` as the hold path, `--test-hold` being value-taking by name, and exits 2 as an unknown flag to `build`, stdout empty, no hold file) |
| T13.5-7 | section-13.5 | 48 (passes since Task 48 landed: every write primitive of `src/workspace/writes.ts` runs its filesystem mutations through `performWrite`, which turns a failure the filesystem reports into the typed `EnvironmentRefusal` of `src/workspace/environment-refusal.ts` — its 12.7 finding `write-failure`, concerning the file the write would have produced or removed, or `.xspec` for graph data — thrown at the write and rendered by `main`'s catch (`src/cli/main.ts`, `emitEnvironmentRefusal` in `src/cli/report.ts`) as exit 2 with the error document; and `rename` and `move` make their source writes in the preview's `files` order, a relocation producing the destination and then removing the origin (`orderSourceWrites` in `src/core/edits.ts`, `performSourceWrites` in `src/workspace/writes.ts`), so arm (d)'s refused origin removal leaves `src/app.ts` unrewritten — the file-form move had removed the origin only after every rewrite) |
| T14-2 | section-14 | 6 (passes since Task 6 landed) |
| T14-4 | section-14 | 51 (passes since Task 51 landed: its sweep's 14.22 entry, `symbolic link in a write path`, reports the one 14.22 alone in `check`) |
| T14-6 | section-14 | 48, 49 (passes since Task 49 landed: its condition-25 arm, `build --json` with `specs/sub` unlistable, exits 2 with the `read-failure` error document; since Task 12 its early-error stagings had held, and since Task 48 its 14.24 arm, `build --json` on the stale workspace with `.xspec` unwritable exiting 2 with the `write-failure` document) |
| T14-7 | section-14 | 22, 23, 24, 25, 35 (passes since Task 35 landed: its invalid-rewrite arms, T6.5-16's refused arms minus the collision arm, report the one `refused-invalid-rewrite`; its moved-import, invalid-path, and exact self-move arms, run after them, hold — the self-moves' would-be texts, judged, are well-formed, so `refused-identity-unchanged` stays alone) |
| T14-9 | section-14-ii | 48 (passes since Task 48 landed: each arm's refused write exits 2 with the `write-failure` document and a stderr diagnostic, the concerned path the refused file's — `specs/b/B.mdx`, `.xspec/journal`, a Markdown file under `out/specs`, `specs/A.mdx` for the origin removal, `specs/sub/B.mdx` for the destination's production, `.xspec/reviews/s.json`, a derived path under `specs/b/` — and every refreshing read and `review create` on the stale workspace with `.xspec` unwritable reports `.xspec`, while `check`, `inventory`, `version`, and the previews write nothing) |
| T14-10 | section-14-ii | 49, 50 (passes since Task 50 landed: a refused content read takes the object's own condition — (b), with `.xspec/journal` unreadable, `build`, `check`, `ids`, and a `rename` exit 1 with the one 14.13 concerning `.xspec/journal` (`readJournalContent` and `refusedJournal` in `src/workspace/journal.ts`), `inventory` exit 0 with `journal.occupied` true; (f), with every graph-data file unreadable, `inventory` and `move --preview` report `recorded` and `delta` unavailable beside the one 14.23 concerning `.xspec`, exit 1, `check` the unreadable-record unit form alone, `ids` regenerates and answers, and after `build` `recorded` is in full (`readStoredFile` in `src/workspace/graph-data.ts` reads a refused kind or content read as unreadable); since Task 49 its directory arms (g) and (h) had held, with (c), (d), and (e)) |
| T14-11 | section-14 | 13, 14, 15, 16, 68 (Tasks 12–16 landed: every table arm holds — (a)–(m) and (p)–(w), (h)'s repeated `id` locating both spellings, [36,44) and [45,54), since Task 15, and (j)'s and (u)'s colliding declarations beside their imports since Task 16; it stops first at arm (n), run after the table's arms, which waits on Task 68: probed by hand, its 14.17 locates both `d` attributes since Task 15, while the second spelling's unresolved `"absent"` reports no 14.5) |
| T14-12 | section-14-iii | 14 (passes since Task 14 landed) |

Several tasks have no failing test of their own: Task 53 (a corrupt session in `review list`), Task 65 (a 14.20 offset inside a container's content more than 256 lines past the grammar's place, found while landing Task 63), Task 66 (a 14.20 offset past the blank line inside a flow tag's attribute expression on the line below a paragraph holding an open text element, found while landing Task 64), Task 67 (a 14.20 offset past the blank line after a brace line below a paragraph line holding an open text expression, found while landing Task 64), Task 69 (a repeated prop's later spellings judged on their own — 14.4 per `id` or `tags` attribute and each spelling's own 14.17 — found while landing Task 15), Task 70 (a TypeScript `text(...)` call's unresolved or non-static argument located at the argument instead of the call, found while landing Task 16), Task 71 (an abstract class member spelling a body or a function-valued initializer bound as a unit, found while landing Task 19), Task 72 (a parenthesized default export bound as a unit, found while landing Task 20), Task 73 (a move closing several would-be cycles reported as several `refused-cycle` findings, where SPEC 14 gives one finding per reason, found while landing Task 21), Task 74 (a refused move's import-cycle finding locating an existing declaration the rewrite removes, found while landing Task 24), Task 75 (an import added to a code file anchored after the line of its last spec-module import even where that line ends inside a block comment or a function body, found while landing Task 28), Task 76 (a code file's existing `import { default as X }` binding of the target module ignored by the re-rooting, which adds a redundant import, found while landing Task 30), Task 77 (a `--config` path through a symbolic link among its directory components anchored by the link's lexical relation instead of the physical root, found while landing Task 36), Task 78 (a journal append cut short by exhausted storage leaving a partial entry, where 13.5 pins the journal's prior bytes, found while landing Task 48), Task 79 (a mutating command acquiring exclusivity before discovering its sources, where 13.5 puts discovery first, found while landing Task 49), Task 80 (a recorded derived file below a symbolic link at a directory component, which `check` reports as remaining by reading through the link, found while landing Task 51), and Task 81 (an obstructed write path left unreported beside source validation errors and journal errors, found while landing Task 51); Task 55 (a path beginning with U+FEFF, found while landing Task 9), Task 56 (container content the comment deletions empty but that holds a token, found while landing Task 13), Task 57 (the same for an attribute's content, which remark-mdx refused before calling acorn, found while landing Task 56), Task 58 (a 14.20 the grammar reports at a lazy line inside a flow construct's container, located since by the content before it, found while landing Task 57), and Task 59 (a 14.20 inside nested containers, whose content the fixed continuation prefixes could not collect, collected since with the prefix the content's own lines give, found while landing Task 58), Task 60 (a 14.20 tag-pairing offset after a line spelling part of the element's container prefix, probed since with that prefix's rests, and a hidden pairing failure located past a prefix's cut, found while landing Task 59), Task 61 (a 14.20 tag-pairing offset past a closing tag, typed on a line inside the element's container, that cannot pair — a prefix ending inside a tag judged since with the tag finished, found while landing Task 60), and Task 62 (a 14.20 offset at the start of a line that leaves a flow-position container's block container, where the grammar places the end of the file — located since past the container syntax that line still spells, a lone `>` a blank line of a list item in a block quote, found while landing Task 60), and Task 63 (a 14.20 offset past a brace that closes a flow expression whose content spans a blank line, text following the brace on its line — located since at the first character past the brace that the grammar rejects, found while landing Task 60), and Task 64 (a 14.20 offset past the blank line that follows a brace line below a paragraph holding an open text element — located since at that line's terminator, the bound the paragraph's text reading sets, the grammar's flow reading of the brace line never deriving, found while landing Task 62) have landed. Task 21 landed with no test of its own: `REFUSAL_CODES` (`src/core/findings.ts`) is SPEC 14's ten reasons in order, `refused-invalid-rewrite` and `refused-moved-import` included for Tasks 35 and 25 to emit, and `refused-unresolvable-reference` is gone — the moved reference to the target file's own root it reported is refused as the dependency cycle it closes, `refused-cycle` alone (hand-verified: `import B from "./B.xspec"` then `<S id="s" d={B}>` in `specs/A.mdx`, `move specs/A.mdx#s specs/B.mdx#s` exits 1 with one `refused-cycle` locating `B`, nothing modified). Task 27 landed with no test of its own: `rename` and `move` run the in-memory re-validation of the rewritten workspace and the 14.22 write-set check (`validateRewrittenWorkspace` in `src/cli/commands/rewrite-validation.ts`, beside the shared `emitFindingsRefusal`) for the preview as for the real operation, and emit a successful preview only past them, so a preview is refused with exactly the real operation's findings and exit, `mapping`, `files`, and `delta` null (SPEC 6.6); the preview derives those build outputs over no record (the record supplies only the orphan set, which no validation reads) and consults the record for its delta alone, once validated — hand-verified on T6.5-9's staging, where until Task 32 the real move exits 1 with `unknown-ts-reference`, `invalid-import`, and `unsupported-node-usage` in `src/app.ts`: its `--preview`, which had exited 0 with the plan, now reports the same three findings, exit 1, nothing modified. Task 29 landed with Task 10: once ESM blocks were bounded as stock MDX 3 bounds them, T6.6-2's move (passing before) added its import at offset 0 of an origin whose first line is `<S id="org">`, the block absorbed that line, and the move's own validation of the rewritten workspace refused it — so additions now go at an admissible offset (`placeSpecImportAdditions` in `src/core/move.ts`). Composite tests (T14-4, T14-6, T14-11, T14-12) restage fixtures from other sections, so the task that lands last may reveal a further arm; if it does, name the arm and its SPEC rule in a new task.

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

## Task 52 — On a workspace failing validation, `check` reports no 14.12 and still reports 14.10's validity-independent forms (SPEC 14.10, 14.12, 7.5; C11)

**Requirement.**
- SPEC 14.10: the recorded-file form and the unreadable-record unit form are "reported whatever the sources' validity".
- SPEC 14.12 and 7.5: no policy violation is detectable on a workspace failing validation.

**Observed.** Staging: one unresolved `d` reference.
- A policy-violating edge is still reported as 14.12.
- A recorded orphan (a derived path whose source has left the configuration) gets no 14.10.
- A corrupt record gets no 14.10 unit form.
- The valid controls report both 14.10 forms.

**Location.** `checkCommand` in `src/cli/commands/check.ts`, and `src/workspace/check.ts`. Since Task 51 the staleness forms are split: `mismatchStalenessFindings` (per file and the graph-data mismatch unit form), consulted only on a workspace with no analysis finding and no 14.22, and `recordStalenessFindings` (the unreadable-record unit form and the recorded-file form over an `orphans` list), which already reports beside a 14.22. Both still run only inside `checkCommand`'s `analysis.findings.length === 0` branch, because `orphans` comes from `computeBuildOutputs`.

**Change.** On a failing workspace — any source validation finding, journal error (14.13), or 14.22 (SPEC 13.3, 14.12: "a workspace passing `build`'s validations") —
- skip policy evaluation (today `evaluatePolicy` runs whatever the findings, a 14.22 workspace included);
- still compare the record against the generated-path set (the recorded-file form), that set derived from discovery and configuration alone (13.1, 7.3, 11.6) where `computeBuildOutputs` cannot run, and pass the resulting orphans to `recordStalenessFindings`;
- still report an unreadable record's unit form (`recordStalenessFindings`).

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

**Verification.** Hand-probe the Observed staging: one `refused-cycle` finding locating `[0,25)` and `[95,98)` and the `"k"` spelling rooted at the would-be import of `A` (since Task 24 landed, the import-cycle finding locates `[0,25)` and `"k"`; on a re-staging whose section texts are `K text.`, `U text.`, and `S text.`, `"k"` sits at `[104,107)` and `B.p` at `[99,102)`). Run `section-6.5.test.ts`, `section-6.6.test.ts`, `section-12.7.test.ts`, and `section-14.test.ts` (T14-7's cycle arms).

## Task 74 — A refused move's spec import cycle locates only the existing import declarations the rewrite keeps (SPEC 14 refusal list, 6.5 "Import edits"; found while landing Task 24)

**Requirement.** SPEC 14, `refused-cycle`, for a spec import cycle: "each participating import declaration existing before the operation by its own characters". The would-be cycle runs through the post-operation import relation. SPEC 6.5 ("Import edits") removes an existing spec module import "exactly when an occurrence used a binding of its before the rewrite and none uses any binding of its after it". A declaration the rewrite removes stands in no post-operation file: it does not participate and is not located. A declaration the rewrite keeps participates even when its binding is left unused — an import already unused before the operation (2.1), and, since Task 34 landed, a block's first declaration the joint-removal rule keeps.

**Observed.** Probed with Task 24 landed, in a scratch workspace with a specs-only configuration; `build` exits 0.
- `specs/A.mdx`: `import X from "./B.xspec"`, `import Y from "./B.xspec"`, a blank line, then `<S id="keep">` and `<S id="m" d={[X.b, "keep"]}>`, each holding one line of text. `specs/B.mdx`: `import C from "./C.xspec"`, a blank line, then `<S id="b" d={C.c}>`. `specs/C.mdx`: `<S id="c">`.
- `move specs/A.mdx#m specs/C.mdx#m --preview --json` exits 1 with one `refused-cycle` for `specs/A.mdx → specs/B.mdx → specs/C.mdx → specs/A.mdx`. It locates `[specs/A.mdx 0,25]` (X), `[26,51]` (Y), `[103,109]` (`"keep"`, rooted at C's added import of A), and `[specs/B.mdx 0,25]`. X's only use departs with `m`, so the rewrite removes X, and the finding should not locate it.
- The model keeps an existing import's edge only when its binding was already unused, or when a spelling homed in its file still targets its module. So a first declaration the joint-removal rule keeps (Task 34, landed), its binding left unused, contributes no edge, and a cycle it closes escapes the refusal and meets the post-move re-validation guard in `src/cli/commands/move.ts` instead. Probed with Task 34 landed: `specs/A.mdx` holding `import X from "./B.xspec"`, `// note`, a blank line, then `<S id="keep">` and `<S id="m" d={[X.b, "keep"]}>`, each holding one line of text, and `specs/B.mdx` holding `<S id="b">`; `build` exits 0. `move specs/A.mdx#m specs/B.mdx#m`, with or without `--preview`, exits 1 with one 14.9 `cycle` (`specs/A.mdx → specs/B.mdx → specs/A.mdx`, locating `[specs/A.mdx 0,25]` and the would-be added import `[specs/B.mdx 56,81]`), nothing modified. SPEC 14 requires one `refused-cycle` locating X's declaration `[specs/A.mdx 0,25]` — X stays, as removing it would leave `// note` heading the block — and the moved `"keep"` `[specs/A.mdx 76,82]`, rooted at B's added import of A.

**Location.**
- `src/core/refusal.ts`: `wouldBeImportCycleFindings` — its `existingImports` helper, and the loop keeping already-unreferenced imports.
- `src/core/move.ts`: `SpecImportPlan` — `bindingFor` roots every arrival at the first import designating the module; `removedImports(bytes)` decides the removals, each ESM block's judged together by `removalsLeaveBlockHeaded`.

**Change.**
- Make the would-be relation's existing declarations exactly those the rewrite keeps, and locate only those.
- Prefer deriving them from the plan's own import bookkeeping (`SpecImportPlan`'s removals, its joint-removal rule included) over a second model, so the refusal and the rewrite cannot disagree.

**Verification.** No suite test pins it. Hand-probe both Observed stagings: in the first, X absent and Y, `"keep"`, and B's import located; in the second, one `refused-cycle` in place of the 14.9. Run `section-14.test.ts` (T14-7's cycle arms), `section-6.5.test.ts`, and `section-6.6.test.ts`.

## Task 75 — An import added to a code file stands at an admissible offset, a top-level declaration of the file as the rewrite leaves it (SPEC 6.5 "Import edits"; found while landing Task 28)

**Requirement.** SPEC 6.5: an added import is inserted "at an admissible offset: one at which the file, as every edit of the rewrite leaves it, is well-formed under its grammar (14.20) with the added line an import declaration — a top-level declaration in a TypeScript source". The choice among admissible offsets is latitude, exercised deterministically, a line-start offset taken over any other; a file holding none refuses the move (`refused-invalid-rewrite`; Task 35 landed judging spec sources alone — `judgeMoveSectionRewrite` passes no code analyses, a TypeScript source's end admitting a top-level declaration whatever the other edits leave). The preview reports the offset the real operation inserts at (6.6).

**Observed.** Probed with Task 28 landed, in a scratch workspace under `test/helpers/e6.ts`'s `E6_CONFIG`: T6.5-8's TS-arm origin (`specs/Origin.mdx`: `org` holding `org.mv` and `org.stay`), `specs/Target.mdx` holding `<S id="tgt">`, and a `src/app.ts` that `build` passes clean. The code-file loop anchors every addition after the line of the file's last spec-module import, whatever that line's end lies inside.
- `src/app.ts` is `import ORG from "../specs/Origin.xspec"; /* a`, `b */`, `ORG.org.mv;`, `ORG.org.stay;`, one per line. `move specs/Origin.mdx#org.mv specs/Target.mdx#mv` exits 0. The declaration lands inside the block comment (offset 46; the preview's `import-addition` likewise), and the marker becomes `Target.mv;`, rooted at nothing. `check` is clean, and `query edges` has lost the file's `references` edge to the moved node.
- `src/app.ts` is `import ORG from "../specs/Origin.xspec"; export function f() {`, `  ORG.org.mv;`, `}`, `ORG.org.stay;`. The same move exits 0, the declaration inserted inside `f`'s body. TypeScript's parser accepts that (the top-level rule is a post-parse check, 14.20), and `f`'s edge to the moved node is lost likewise.
- The terminator-free spelling adds no hazard of its own. TypeScript 5.9's parser reads `with`/`assert` import attributes only without a preceding line break, so the line after an added declaration is never absorbed into it (checked: `import A from "./a"`, U+000A, `with (Math) {}` parses as two statements, no diagnostic).

**Location.** `src/core/move.ts`: the code-file assembly loop ("Code files: chain and callee retargets, import removals, and added imports") and the preview's `import-addition` beside it. Since Task 30 its candidates are `offsetAfterLine(bytes, anchor.range.end)`, then the first removed import's line start, then 0, the first that `editsComposition(…).positionOf` places outside every other edit's range taken; the line start is judged over that composition, and `composeAddition` inserts the lines. Task 30 kept the anchor, so both Observed stagings behave as before.

**Change.**
- Take the first admissible offset of a deterministic candidate order over line starts (e.g. the current anchor, then the file's start, then the other line starts in byte order). A candidate is admissible when the file, every edit of the rewrite applied (the addition included), parses with no syntax diagnostic (TSX for `.tsx`, 14.20) and its top-level `statements` hold an import declaration spanning exactly each added declaration's characters.
- Report the chosen offset in the preview, as now. A code file always holds an admissible offset (its end), so no code file meets `refused-invalid-rewrite`; if the candidate order ever finds none, that is an internal error, never a refusal to add.
- Tasks 30 (removals), 31 (`text` bindings: an added declaration may bind `{ text as Y }`, rendered by `importDeclarationLine`), 32 (freshness: `taken` seeded from `CodeAnalysis.spelledNames`), and 33 (shadowing: each existing binding is chosen per occurrence by `existingBinding`, unshadowed there) landed; the reference loop before the assembly is settled.

**Verification.** No suite test pins it. Hand-probe both Observed stagings: each move adds the declaration at a top-level line start, the moved marker keeps its `references` edge under the new identity, `check` is clean, and the preview's `import-addition` offset equals the real insertion's. Run `section-6.5.test.ts` (T6.5-8's TS arm, T6.5-9), `section-6.5-ii.test.ts`, `section-6.5-iii.test.ts` (T6.5-18), and `section-6.6.test.ts`.

## Task 76 — A default-export binding spelled as a named import roots re-rooted code chains (SPEC 6.5 "Reference spellings" and "Import edits", 4; found while landing Task 30)

**Requirement.** SPEC 4: "The permitted bindings from a spec module are the default export and the named `text` export, each optionally aliased", so `import { default as X } from "…"` binds the module's default export as `X`. SPEC 6.5 roots a rewritten chain at "a binding the file already holds that no local declaration shadows at the occurrence", and "an import is added exactly where a file lacks a binding a spelling is rooted at". An added import's fresh identifiers collide "with no binding already in the file".

**Observed.** Probed with Task 30 landed, in a scratch workspace under a specs-plus-code configuration (T6.5-11's `CONFIG`). `specs/Origin.mdx` holds `org` with `org.mv` and `org.stay`, and `specs/Target.mdx` holds `<S id="tgt">`. `src/app.ts` is `import { default as TGT } from "../specs/Target.xspec";`, `import ORG from "../specs/Origin.xspec";`, `TGT.tgt;`, `ORG.org.mv;`, one per line, and `build` passes it clean. `move specs/Origin.mdx#org.mv specs/Target.mdx#mv` exits 0. It adds `import Target from "../specs/Target.xspec"` and rewrites the marker to `Target.mv;`, where 6.5 requires `TGT.mv;` and no addition. The ORG import is removed correctly. `check` is clean.

**Location.**
- `src/core/code-analysis.ts`, the spec-module import scan: an `{ default as X }` element (`imported === "default"`) registers its role but enters neither `CodeImport.defaultBinding` nor `textBindings`.
- `src/core/move.ts`, the code-file reference loop: since Task 33 a chain's existing root binding is `existingBinding(reference, defaultBindingsOf)` — the first binding, in document order, of a valid target-module import that is value-level and that no local declaration shadows at the occurrence (`CodeReference.shadowedImportNames`) — and `defaultBindingsOf` yields `defaultBinding` alone. The shadowing judgement already covers `X`: the analysis judges every binding of every spec module import (`importBindings` in `CodeAnalyzer`), `{ default as X }` elements included. The fresh-name `taken` seed no longer misses `X` either: since Task 32 it is every identifier the file spells (`CodeAnalysis.spelledNames`).

**Change.**
- Expose every default-export binding of a spec module import, the named `{ default as X }` form included (for example, a `nodeBindings` list beside `textBindings`, each with its `typeOnly`).
- Choose the existing target-module binding from that list, value-level and unshadowed at the occurrence: have `defaultBindingsOf` yield it.
- Keep the choice deterministic, e.g. the first such binding in document order.
- Tasks 31, 32, and 33 landed: `existingBinding` chooses a moved call's callee binding (`textBindingsOf`) and a chain's root binding the same way, per occurrence, and fresh identifiers avoid every identifier the file spells.

**Verification.** No suite test pins it. Hand-probe the Observed staging: after the move `src/app.ts` reads `import { default as TGT } from "../specs/Target.xspec";`, `TGT.tgt;`, `TGT.mv;`, with no addition and the ORG line dropped. `query edges` lists the marker's `references` edge to `specs/Target.mdx#mv`, and `check` is clean. Run `section-6.5.test.ts`, `section-6.5-ii.test.ts`, `section-6.5-iii.test.ts`, and `section-6.6.test.ts`.

## Task 77 — A `--config` path through a symbolic link anchors on the physical root (SPEC 11.6, 14, 7; found while landing Task 36)

**Requirement.** SPEC 11.6: "The working directory and the workspace root enter this spelling as physical directory paths, every symbolic link among their components resolved, and the configuration file as its own name under the root so spelled: a link between the working directory and the root spells the physical relation; a link above both changes nothing." SPEC 14: a configuration error's concerned path is the found or named configuration path in that anchoring form, whatever occupies it (7) — the one exception, a `--config` path nothing occupies, echoed as given, landed with Task 42: `locateWorkspace`'s absent branch reports `configFlag` itself as the failure's `concernedPath`.

**Observed.**
- From a root holding a valid `a/b/xspec.config.ts` and the link `L` → `a/b`, `inventory --json --config L/xspec.config.ts` reports `config` `L/xspec.config.ts` (and `root` `L`): the link's lexical relation. SPEC 11.6's physical spelling is `a/b/xspec.config.ts` (and `a/b`).
- The same lexical spelling reaches every configuration error's concerned path for such a `--config` value — a malformed file, or since Task 36 a directory or symbolic-link occupant, under a linked directory component — and an absolute `--config` value through a linked prefix (macOS's `/var` → `/private/var`) is spelled against the physical working directory by its lexical form.
- The upward search is unaffected: it ascends from `process.cwd()`, already physical, so the found entry's directory is too.

**Location.** `src/workspace/locate.ts`: `locateWorkspace`'s `--config` branch, which anchors `path.resolve(cwd, configFlag)` lexically; `anchoredPathSpelling` in `src/workspace/anchor.ts`; the inventory's `root`/`config` anchoring, which reads the located workspace's anchor.

**Change.** For an occupied `--config` path, resolve the entry's parent directory physically (`fsp.realpath`) and anchor the entry as its own name under that directory — for the inventory's `root` as for every concerned path. Never resolve the entry itself: a symbolic-link occupant is reported as the entry (7). A refused read during the resolution is condition 25 (SPEC 14.25: "the directories the upward search and the anchoring resolution examine"): throw `readFailure` from `src/workspace/environment-refusal.ts` (Task 49, landed) concerning the directory in its anchoring form, as `occupantOf` in `src/workspace/locate.ts` does for the upward search; an unoccupied path stays echoed as given (Task 42, landed) — judge occupancy before any resolution that could fail on it.

**Verification.** No suite test stages a link among a `--config` path's directory components (T11.6-1's physical arms reach the root by the upward search or by an absolute `--config` over the realpath'd root; T12.7-3's resolves `./../xspec.config.ts` against a linked working directory); hand-probe the staging above. Neighbours: `section-11.6.test.ts`, `section-12.7.test.ts`, `section-7-basics.test.ts`, `section-12.0-i.test.ts`.

## Task 78 — A refused journal append leaves the journal as it was, never a partial entry (SPEC 13.5, 14.24, 6.1; found while landing Task 48)

**Requirement.** SPEC 13.5: "file writes are atomic in their observable effect: at every moment — concurrent readers and interrupted commands included — a path xspec writes holds either its prior state (the previous content, or absence) or the complete new content, never a partial write"; a mutating command "stopped by a write the environment refuses (14.24), leaves the writes already made, each complete". SPEC 14.24 lists exhausted storage among the refusals, and the journal append is the operation's commit point (13.5): stopped there, the operation leaves no entry.

**Observed.** `appendDurableFile` in `src/workspace/writes.ts` makes the first append — the journal absent — as one temp-file-plus-rename creation, but every later append as `O_APPEND` writes of the entry's bytes in a loop. Storage exhausted part-way through the line makes a write return short and the next one fail with `ENOSPC`: since Task 48 the failure is reported as the `write-failure` concerning `.xspec/journal`, exit 2, but the journal keeps the partial line — neither its prior bytes nor the complete new entry — and every later read reports it as a journal error (14.13) instead of the "no entry" 13.5 pins. A concurrent reader can likewise observe a partly copied line. No suite test stages exhausted storage; T13.5-7 (b) and T14-9 (b) refuse the append by permission, before any byte is written.

**Location.** `appendDurableFile` in `src/workspace/writes.ts` (its only caller is `appendJournalEntry` in `src/workspace/journal.ts`).

**Change.** Make every append one atomic replacement: read the journal's current bytes (appends run under workspace exclusivity, 13.5, so no rival appender races the read) and write them followed by the new line through `replaceWithFile` — the temp file beside the journal, then one rename — inside `performWrite`, so a refused append (the temp write cut short included) leaves the journal byte-for-byte as it was and reports `write-failure` concerning `.xspec/journal`. The bytes stay line-oriented, so textual merging (13.4) is unaffected. A refused read of the prior bytes is the journal's own condition (14.25 → 14.13): since Task 50, `readJournalContent` in `src/workspace/journal.ts` separates a refused content read from absence (`refusedJournal` renders the 14.13), and `rename`/`move` already hold the validated journal's bytes, `analysis.journal.rawBytes`, from which their post-append model is built — an append can compose from those rather than read again.

**Verification.** No suite test stages exhausted storage; hand-probe, where the sandbox permits mounting, on a small filesystem that fills part-way through the entry (a size-limited `tmpfs` over a scratch workspace's `.xspec`, then a `rename` whose entry does not fit) that the journal stays byte-for-byte and `check` reports no 14.13; otherwise review the change against the write layer's other atomic writes. Neighbours: `section-13.5.test.ts` (T13.5-7 (b)), `section-14-ii.test.ts` (T14-9 (b)), `section-6.1.test.ts`, `section-6.4.test.ts`.

## Task 79 — A mutating command discovers its sources before acquiring exclusivity (SPEC 13.5, 12.0, 14.14, 14.25; found while landing Task 49)

**Requirement.** SPEC 13.5: "A mutating command acquires exclusivity once its configuration is loaded and its sources discovered (7, 14.14) and before every later check and read — the argument checks of 12.0, baseline resolution (6.3), the gate and refresh of 13.3, and its own validation". So a discovery-level configuration error (14.14: "A file matched by both a spec group and a code group is a configuration error", 7.2) and a discovery read the environment refuses (14.25) are met before acquisition: neither waits on the `--test-hold` seam nor yields to the exclusion error of another holder (12.0: a configuration error precedes every other error of exit class 2, the exclusivity error included; a read failure is met at the read, in the command's read order).

**Observed.** `rename`, `move`, and the mutating `review` subcommands (`create`, `resolve`, `split`) call `withMutationExclusivity` (`src/workspace/lock.ts`) around their whole operation, and discovery runs inside it: `analyzeWorkspace` in `runRename` (`src/cli/commands/rename.ts`) and in `move.ts`; `analyzeGraphForRead` in `runCreate` (`review.ts`) and in `loadSessionForCommand` (`review-session.ts`) for `resolve` and `split`. So `rename specs/b/B.mdx b b2 --test-hold <path> --json` with a discovered directory unlistable creates the hold file and waits for its deletion before exiting 2 with `read-failure`, and while another mutating command holds the workspace it reports the exclusion error where the read failure, or a spec/code overlap's configuration error, is required.

**Location.** The callers of `withMutationExclusivity` above. `analyzeWorkspace` (`src/workspace/pipeline.ts`) is `discoverSources` followed by `analyzeWorkspaceContent`; `analyzeWorkspaceForRead` (`src/workspace/refresh.ts`) and `analyzeGraphForRead` (`src/cli/prepare.ts`) wrap it.

**Change.** Discover before acquiring — reporting the classification's configuration errors (exit 2), a refused listing raising its read failure (Task 49) — and hand the classification to the analysis made under exclusivity, so every later read (source content, journal, sessions, baseline, the gate and refresh) follows acquisition, "so the workspace it validates is the one it rewrites" (13.5). A `--preview` acquires nothing and keeps its order.

**Verification.** No suite test stages a discovery-level error beside a hold or a holder: T13.5-8 pins acquisition before the argument checks, the baseline, and the gate. Hand-probe with AGENTS.md's permission recipe: the staging above exits 2 with `read-failure` at once, no hold file created; a spec/code overlap under `--test-hold` exits 2 with `configuration-error` at once. Neighbours: `section-13.5.test.ts`, `section-6.4.test.ts`, `section-6.5.test.ts`, `section-10.7-i.test.ts`, `section-10.7-ii.test.ts`, `section-12.0-ii.test.ts`.

## Task 80 — A recorded derived file below a symbolic link at a directory component remains nowhere to `check` (SPEC 13.4, 14.10; found while landing Task 51)

**Requirement.**
- SPEC 13.4: "Reads traverse none either: below a workspace-relative directory component occupied by anything other than a directory — a symbolic link included, whatever it targets — nothing is read, the path holding nothing (14.25's absence, never its refusal)".
- SPEC 14.10's recorded-file form reports a recorded derived file *remaining* at a path the current sources and configuration no longer generate.

**Observed.** Hand probe, a scratch workspace driven by `dist/cli/bin.js`: `markdown: { emit: true, outDir: "old" }` and `specs/A.mdx`; `build`; change `outDir` to `"out"`; `mv old real-old; ln -s real-old old`.
- `check --json` reports a `stale-output` concerning `old/specs/A.md`, beside the expected `out/specs/A.md` (missing) and the `.xspec` unit form: it read the recorded path through the link.
- `build` then exits 0 and leaves `real-old/specs/A.md` untouched (`removeDerivedFile` skips a path below an obstructed component); `check` is clean afterwards.
- No suite test stages a recorded path below a link; T13.4-3's orphan boundary uses none.

**Location.** The orphan loop of `recordStalenessFindings` in `src/workspace/check.ts`. Its `comparedOccupant` classifies by `lstat` of the whole path (`classifyOccupant` in `src/workspace/writes.ts`), which follows a link at a directory component. A plain-file component already reads as absent (`ENOTDIR`).

**Change.**
- Judge each recorded path by the read side of 13.4, as `readableOccupant` in `src/workspace/writes.ts` does: its workspace-relative directory components shallowest first, so a path below a non-directory component is absent and reports nothing.
- The per-file mismatch forms need no change: a link at a component of a generated path is a 14.22, beside which Task 51 leaves those forms unreported.
- Decide by SPEC 14.25 what a refused kind read of such a component is here: 14.25 makes "a derived file's content or kind that `check` compares" condition 10, and "a path occupant's kind wherever else xspec examines one" condition 25.

**Verification.** Hand-probe the staging above (no finding for `old/specs/A.md`) and a control without the link (the finding stays). Neighbours: `section-12.1-12.2.test.ts` (T12.2-2), `section-13.4.test.ts`, `section-13.3.test.ts`, `section-10.1.test.ts`.

## Task 81 — `build`, `check`, and the gate of 13.3 report an obstructed write path beside source validation errors and journal errors (SPEC 14, 14.22, 13.3, 13.1, 14.10; found while landing Task 51)

**Requirement.**
- SPEC 14: "When several error conditions are present, they MUST report each of them, not only the first; a condition goes unreported only where another error makes it undetectable".
- SPEC 14.22 judges paths, never generated content: `build`'s write paths are "the derived files the current sources and configuration generate (13.1, 13.2) and graph data (13.3)", and `check` and the gate of 13.3 "judge exactly `build`'s".
- That path set is defined on a failing workspace. SPEC 13.1: "Per-source derived paths are defined by this `NAME.mdx` name shape alone". SPEC 14.10: "the set of generated paths alone, a set discovery and configuration define on any workspace (13.1, 7.3, 11.6)".
- SPEC 13.3: the gate reports "the findings a `build` would now report".

**Observed.** Hand probe: `markdown: { emit: true, outDir: "out" }`, a valid `specs/A.mdx`, `out` a plain file.
- Alone: `build` and `check` report the one 14.22 concerning `out`.
- Adding `specs/B.mdx` with an unresolved `d={missing}`: `build`, `check`, and `ids` report the 14.8 alone.
- With a garbage `.xspec/journal` instead: they report the 14.13 alone.

**Location.** `buildCommand` in `src/cli/commands/build.ts`, `checkCommand` in `src/cli/commands/check.ts`, and `analyzeWorkspaceForRead` in `src/workspace/refresh.ts`. Each runs `obstructedWritePathFindings` over `computeBuildOutputs(...).writePaths` inside a no-analysis-findings branch.

**Change.**
- On a workspace with source or journal findings, judge the write-path set that discovery and configuration define: modules and companions per 13.1, Markdown per 7.3, and graph data's own paths.
- Report its 14.22 findings beside the validation findings. A failing `build` still modifies nothing.
- Task 52 needs the same generated-path set for the recorded-file form; share it.
- Judge `rename`/`move`'s invalid-workspace refusal (6.4, 6.5; T14-7: "the workspace's numbered findings alone") by the same reading.
- First confirm that no suite test pins the validation findings alone on such a staging; if one does, record the contradiction per the rules above.

**Verification.** Hand-probe the stagings above: the 14.22 beside the 14.8, and beside the 14.13, for `build`, `check`, and `ids`. Neighbours: `section-13.4.test.ts`, `section-11.2.test.ts`, `section-13.3.test.ts` (T13.3-3), `section-14.test.ts`, `section-10.1.test.ts`, `section-12.1-12.2.test.ts`.

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
