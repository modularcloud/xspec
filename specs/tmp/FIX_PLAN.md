# FIX_PLAN — Phase 9 (test harness), 13.5 re-descent, determination at d0c8039

Written 2026-10-13 at d0c8039 (branch `claude/xspec-ui-apis-4df8fa`, standing in for `patch/external-ui-apis`). It plans from the compliance determination at d0c8039 — the first since the f50cf9f plan's tasks ran — which was not clean:
- A (TEST-SPEC's T1–T6 tests): compliant;
- B (T7 onward): 1 gap, cited here as RB-1 (reviewer B's G1), planned as Tasks 2–10;
- C (everything outside the T-numbered tests): 1 gap, cited here as RC-1 (reviewer C's gap 1 — not TEST-SPEC's C-1), planned as Task 1;
- D (CERTIFICATIONS.md): compliant;
- V (VERIFY): green.

Reviewer B's and reviewer C's reports are saved verbatim in the scratchpad `/tmp/claude-0/-home-user-xspec/08a79bea-e066-52cf-ac19-1be1615496b4/scratchpad/` (`<scratchpad>` below) as `p9j_d0c/report_B.txt` and `p9j_d0c/report_C.txt`. Read them when a task's text leaves a detail open, but take every exact spelling from the spec documents or the harness code, never from a report. Where this plan departs from a reviewer's proposed fix, the task says so and why (Task 5's `next`, Task 6's reach into T10.7-12, Task 7's correction data).

Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tests Specified); no task changes its stage. No Bug Report applies. No problems file exists. The specs have not moved since the previous plan was written: SPEC.md as of 7f9ac70, TEST-SPEC.md as of e8d1140, CERTIFICATIONS.md as of a3196a1. The Developer's settled choice of 13.5's reach (option B: every user and environment on one machine; the lock directory `.xspec/lock` in the workspace) is not reopened by any task.

The previous plan (written at f50cf9f, deleted at d0c8039) is `git show d0c8039^:specs/tmp/FIX_PLAN.md`; its Order section records what each of its tasks did. The plans before it are `git show f50cf9f^:specs/tmp/FIX_PLAN.md`, `git show 1418ab9^:specs/tmp/FIX_PLAN.md`, `git show a126add^:specs/tmp/FIX_PLAN.md`, and `git show 9583e3b^:specs/tmp/FIX_PLAN.md`.

## Preamble — read before any task

**Phase goal and scope guards (Phase 9).** The harness must adhere to `specs/TEST-SPEC.md` and `specs/CERTIFICATIONS.md`. Every harness self-test and every certification passes: each certified test passes against its conformer and fails against each of its violators exactly as the violator's entry states. Product tests may fail, but only as diagnosed assertion failures (H-8): never a harness error, crash, hang, or false pass. Never modify product code (`src/`; `dist/` is built from it). The tasks here are harness work: `test/suite/registry/section-16-p10.ts` and the header comment of `test/helpers/path-poller.ts` (Task 1); `test/helpers/adapters/human.ts` and `test/self/s5-output-adapters.test.ts` (Task 2); the registry modules Tasks 3–10 name (`section-10.7-i.ts`, `section-10.7-ii.ts`, `section-14.ts`, `section-9.ts`, `section-9.3.ts`, `section-6.4.ts`, `section-6.5.ts`, `section-6.6.ts`, `support.ts` where a task puts a shared helper there, and the module header of `section-12.0-i.ts`); and `AGENTS.md` (build/run knowledge only). The certification fixtures under `test/fixtures/` stay unchanged: every stand-in, mutant build, or wrapper a task uses lives in the scratchpad and is never committed. If a task meets a spec defect (a contradiction, an impossible requirement), stop, log it in the matching problems file under `specs/tmp/`, commit, push, and end with `OUTCOME: PROBLEM`; never work around it.

**Known state at d0c8039.**
- `specs/tmp/` held only `.gitkeep` before this plan. d0c8039 changed AGENTS.md and deleted the previous plan, so the harness and product trees are a1e6ae5's. `src/` has not changed since 6b79462.
- The checkout has `node_modules` (`npm ci` restores it if it goes missing) and no `dist/`. The product is not built in the checkout, so a local self-project run is a run with no product installed (H-8). No task builds the product in the checkout; keep `dist/` absent there. A product-facing check uses a build outside the checkout (Run mechanics).
- CI run 1225 (ID 38340109067) at d0c8039:
  - harness-self job 115108948053: green with no product installed; 39 files, 4444 tests, all passed; certification 186 PASS / 50 FAIL / 0 error / 0 hang; the job 346 s;
  - full-suite job 115108948221: 127 files, 4797 tests, 29 failed and 4768 passed in 1293.56 s (the job 21 min 49 s), every failure a `HarnessAssertionError` in the suite project, the same 29 IDs as runs 1220 and 1224 (`analyze_suite.py` against reviewer C's cleaned run-1224 log `<scratchpad>/revC-d08/suite1224.clean.log`: no difference) — the E-6 writer, P-10, P-14, P-15, T6.1-1, T6.6-3, T7-2, T7-4, T10.1-6, T11.6-1, T11.6-3, T11.6-4, T12.7-3, T13.4-12, T13.5-1 through T13.5-4, T13.5-6 through T13.5-13, T14-6, T14-9, and T14-10. P-10 (34.86 s) is falsified at seed 271828183, trial 2 of 3, shrunk to episode 2 of 3, a `rename` killed past its hold at 0.7 of its twin's span: `… found nothing at .xspec/lock` (the built product predates the 13.5 revision and keeps no lock in the workspace). Its cleaned log: `<scratchpad>/p9j_d0c/ci1225/suite.clean.log`;
  - Windows leg 115114390408: 2 failed, both diagnosed, as in runs 1220 and 1224 (E-6 byte identity at the exclusion probe; T11.6-1's drive-mismatch premise at `$.lock`); the job 58 s.
- Locally at d0c8039 (this determination's VERIFY, `<scratchpad>/verify-d0c8039-work/self-run.clean.log`; the unprivileged recipe, the admin files left out, `dist/` absent): 37 files, 4434 tests, all passed in 404.31 s; certification 186 / 50 / 0 / 0, 0 discrepancies (`compare_cert.py`).
- **The built product's human forms** (`<scratchpad>/engineer-verify/xspec/dist/cli/bin.js`, a build of HEAD's `src/`). These are facts about one product, never assertion inputs (H-4): no matcher may key on them. `review list` prints one line per session, `NAME STRATEGY unresolved=N updated=N no-change=N skipped=N invalidated=N`, a corrupt one `NAME corrupt` followed by its condition-21 finding line; `review status` prints `ID KIND SCOPE STATUS blocked=BOOL` rows and a `totals:` line; `review next` (item case) and `review show` print an indented item block — `item ID`, kind, status, blocked, blockedBy, reason, note, the scope, context, and origin entries with `(present)`/`(absent)`, `range: START-END`, and `text: |` blocks whose lines are indented, and `baseline:`/`current:` hash lines; a findings report prints `FILE:START-END: CODE: MESSAGE` per finding (further locations in `(also at …)`, identities in brackets) and a count line; `impact` prints `baseline COMMIT`, a heading per category with `NODES — attributed to: …` rows, then `directly impacted code:` and `transitively impacted code:` rows `LOCATION — via KIND TARGET; path: A -> B`; a performed `rename`/`move` prints `FROM -> TO` lines and a count line; a preview prints `mapping:`, `files:` (each file, then `START-END CLASS` lines), and `delta:` (`generated PATH`/`removed PATH` lines, or `delta: unavailable`). Its review item ids are `item-<n>`, so digits inside data are why numbers are matched after blanking (conventions below).
- **Reviewer B's mutant builds**, each `<scratchpad>/revB-d0c/m/<name>/dist/cli/bin.js`, made by `<scratchpad>/revB-d0c/mutate.py` from the checkout's `src/` plus `revB-d0c/specs/base.json` (the inventory `lock` member, always applied) plus the specs named after the build's name. `p13` is the 13.5 port (`revB-d0c/specs/p13.json`: `revB-d0c/p13/lock.ts`, the second discovery, the `workspace-busy` code), which passes every T7–T15 test reviewer B ran, T13.5-11, T13.5-12, and T13.4-12 included. The human-renderer mutants are the port plus one gutted renderer: `rev-humanempty` (human `review status` prints nothing; human `review list` prints only its findings), `rev-humanitem` (human `review next`, item case, and `review show` print nothing), `findings-fileonly` (each human finding line is its first location's file, or its concerned path), `impact-humanids` (human `impact` prints each requirement entry's nodes and each impacted location, nothing else), and `mapping-humanempty` (the human report of a performed `rename`/`move` prints nothing). A spec is a JSON list of `{"file", "old", "new"}` exact replacements under `src/` (`old` occurring exactly once unless a `count` is given). Rebuild one, or build a task's own, with `python3 -I <scratchpad>/revB-d0c/mutate.py <name> <scratchpad>/revB-d0c/specs/p13.json <spec.json>` (it prints the build's bin path; a task's spec files live in its own scratch directory, and its build names carry the task's prefix, e.g. `t9jd0c3-nocounts`, so no reviewer build is overwritten). All six builds above answered `version` at plan time.
- Node v22.22.0 locally (`/opt/node22/bin/node`), Vitest 4.1.10, TypeScript 5.9.3; PyYAML 6.0.1 under `python3 -I`; 4 cores.

**Run mechanics (AGENTS.md holds the recipes; read the bullets a task names before running anything).**
- Confirm `git status` is clean on `claude/xspec-ui-apis-4df8fa` before editing, and read `git log -3 --format='%h %s'`: a task interrupted after a push resumes where its text says. Never fetch or merge `main` (its newer scaffold commit 63bcb3f is not adopted in this run). Push with `git push -u origin claude/xspec-ui-apis-4df8fa`, retrying network errors with backoff (2 s, 4 s, 8 s, 16 s); never force-push, reset a pushed commit, or rewrite history; check `git log -1` before every push.
- Permission refusals: if the permission system refuses any action, stop that line of work and report the refusal verbatim; never retry it or seek the same result another way. GitHub's "GraphQL is not available" 403 is not a refusal: read GitHub through REST (`gh api repos/modularcloud/xspec/...`) or the GitHub MCP tools.
- Administrative access (Developer's standing constraint): nothing needing administrative access runs locally — no user account, mount, PID namespace, or other-user process, no `sudo` beyond AGENTS.md's documented recipe, and no inspection of `sudo`, sudoers, accounts, or credentials, directly or through a test, staging, or script. Tests needing it (`test/self/*.admin.test.ts`, T13.5-9, T13.5-10(e)–(g)) are verified only in CI; local command lines leave those files out (never skip them in code). No task here touches them.
- The self project: `unshare --map-user=1000 --map-group=1000 -- env -u NODE_OPTIONS npx vitest run --config test/vitest.config.ts --project self --exclude 'test/self/**/*.admin.test.ts'` (AGENTS.md's bullet beginning "The self project — and, once the Linux-leg tests"), redirected to a log in the scratchpad; grep the log for `×` and the `Tests` summary, never cap it with `head`. Run it alone, checking the load first (other agents may share the machine); a failure seen only while harness runs overlap is not a task failure: rerun alone.
- Certification lines against the document: `python3 -I <scratchpad>/engineer-verify/compare_cert.py specs/CERTIFICATIONS.md <log>` (VERIFY's; read its docstring) prints the PASS / FAIL / ERROR / HANG totals, the totals the document expects (186 / 50 / 0 / 0), and every discrepancy.
- **The built product, outside the checkout.** `<scratchpad>/engineer-verify/xspec/dist/cli/bin.js` is a build of `src/` identical to HEAD's: confirm first that `diff -rq <scratchpad>/engineer-verify/xspec/src /home/user/xspec/src` prints nothing and that the file exists. If either check fails, build a scratch copy instead: `mkdir -p <scratchpad>/t9jd0c_build && git -C /home/user/xspec archive HEAD | tar -x -C <scratchpad>/t9jd0c_build && cp -a /home/user/xspec/node_modules <scratchpad>/t9jd0c_build/ && npm --prefix <scratchpad>/t9jd0c_build run build`, then use `<scratchpad>/t9jd0c_build/dist/cli/bin.js`. Never run `npm run build` in the checkout.
- **Running selected product tests against a binding** (the built product, a mutant build, a fixture, or a scratch stand-in): AGENTS.md's bullets beginning "To run a selection of product tests against one fixture executable" and "Red-checking a strengthened product test against the built product (Phase 9)". Put a temporary `test/self/zz-<task>.test.ts` in place that calls `runProductTests(binding, productTestSuite.select([<ids>]))` (`test/self/certification-runner.ts`, `test/suite/registry/index.ts`; reviewer B's `<scratchpad>/revB-d0c/run/test/self/zz-revb.test.ts` is a working example taking the bin path and the IDs from environment variables — copy its pattern, never its harness tree). The binding is `{ label, command: process.execPath, prefixArgs: [<entry>, …], requiredFiles: [<entry>] }`. Print each result's status and full `diagnosis` through `console.info`. Run it alone under the namespace: `unshare --map-user=1000 --map-group=1000 -- env -u NODE_OPTIONS npx vitest run --config test/vitest.config.ts --project self test/self/zz-<task>.test.ts --disable-console-intercept > <log> 2>&1`. Delete the file before committing; `git status --short` must not list it. With a task's change stashed (`git stash`, then `git stash pop`), the untracked temporary test stays in place, so the same file runs HEAD's module.
- Reading CI: AGENTS.md's bullet beginning "Reading a CI run from this sandbox" (`gh api` for runs, jobs, steps, and check-run annotations — annotations are capped: run 1225's full-suite job carries ten of its 29 failures — so read the job's log for the full failing set; the GitHub MCP `get_job_logs` tool, loaded through ToolSearch, returns the log's download URL, which `curl -sS -o <file> '<url>'` fetches). Strip a CI log's timestamps and colour escapes before reading it: `sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z //; s/\x1b\[[0-9;]*m//g' <raw> > <clean>`. VERIFY's `python3 -I <scratchpad>/engineer-verify/analyze_suite.py <clean log> [<baseline clean log>]` lists each failing test with its error class and, given a baseline, the IDs failing in one log only. A push cancels the branch's run in progress; a job cancelled with no steps is an infrastructure event, not a verdict (AGENTS.md). CI runs on pushes to the branch; PR #7 gets no `pull_request` runs. **Wait for a CI result in the foreground**: a spawn that waits by going idle on a background monitor is handed back before the result arrives. Poll with repeated foreground Bash calls, each a bounded in-process loop inside the tool's 10-minute limit, e.g. `timeout 540 bash -c 'until [ "$(gh api repos/modularcloud/xspec/actions/runs/<run-id> --jq .status)" = completed ]; do sleep 30; done'` (a bare foreground `sleep` is blocked; a `sleep` inside `bash -c` under `timeout` is the AGENTS.md pattern). Repeat the call until the run completes.
- The scratchpad is shared across spawns: use task-specific directories (`t9jd0c_<N>/`). This plan's references (`p9j_d0c/`: the two reports and run 1225's full-suite log), the reviewers' (`revB-d0c/`, `revC-d08/` from this determination; `revB-f50/`, `revC-f50/`, `revD-f50/` and older from earlier ones), and VERIFY's (`engineer-verify/`, `verify-d0c8039-work/`, `verify-d0c8039-tools/`) files live there. Never commit anything from `revB-d0c/run/` (a private harness copy). Run Python with `python3 -I`. If `/FIX_PLAN.md.before` exists outside the checkout, leave it exactly as it is (Liaison directive, 2026-10-11; absent at d0c8039). Set every shell variable a command uses within that same command, and never write, copy, or remove through a path built from a variable that might be empty.

**Human-report parity conventions (Tasks 2–10).** The requirement all nine tasks serve: TEST-SPEC T12.0-1 — "`--json` emits exactly one JSON document as the entire standard output, carrying the same information as the human report (adapter-verified per command in the sections above; this test sweeps that every command accepts the flag; …)"; SPEC 12.0 — "Where this specification defines report content, the JSON form MUST contain the same information"; H-3 — "Human-readable reports are asserted only for required information (via robust matching), never exact wording." Reviewer B's G1: outside `coverage` (T8.2-1), `ids` and `show` (T12.3-1, T12.4-1), the fully resolved `review next` (T10.7-7), one identity of `impact` (T9-1), a failing `build`/`check`'s file (T12.0-2), and the word "corrupt" (T14-4, T13.4-6), no test reads a human report for the information its section defines, and builds with a gutted human renderer pass every test (Known state).
1. *Where.* Each task adds, in the tests it names, a run of the command's human form — the same argv without `--json` — at the same workspace state as a `--json` run whose document the test already decodes, asserting the same exit code. For a read or a preview the human run follows that JSON run directly, nothing mutating in between. For a performed `rename` or `move`, whose JSON run consumes the state, it runs on a byte copy of the pre-operation workspace (`copyTreeBytes` from `./section-13.5.js`, the lock path left out by `isLockPathBytes` from `../../helpers/lock-path.js`, the copy checked against the original as `withCopyOf` in `section-13.5.ts` checks its copies; a copy composes no source text, so S-9 has nothing to judge — P-10's twin does the same), or on a copy the test already stages and leaves at the pre-operation state.
2. *What.* The mentions are the information the command's SPEC section defines for the report, as the decoded JSON document carries it — taken from the decoded document after the test's own JSON assertions have run (a product-to-itself comparison, H-4), so they equal what those assertions checked, and covering every entry of the document, never a sample. Free text — a finding's message wording, an item's `reason` — is never compared as wording; Task 7 states what of a message is data.
3. *How* (Task 2's matchers, `test/helpers/adapters/human.ts`, all through `assertReportMentions`):
   - *literal data* — identities, paths, item ids, session names, each non-blank line of a text value (trimmed), hash strings, notes — as substrings, token-bounded where the datum can occur inside a longer one: an identity or path not followed by a word character (`[A-Za-z0-9_]`), `-`, `#`, `/`, or by `.` and a word character, and not preceded by a word character, `-`, `.`, or `/` (so `specs/T.mdx#p` does not count inside `specs/T.mdx#p.a`, nor the root's `specs/T.mdx` inside `specs/T.mdx#p`); a session name or item id not adjacent on either side to a word character or `-`, nor followed by `.` and a word character (so `a` does not count inside `a2`, nor `item-1` inside `item-10`);
   - *numbers* — counts and range offsets — as whole decimal numbers (not preceded or followed by a digit), matched only after every literal datum of the document that contains a digit — ids, identities, paths, hashes, names, text lines — has been blanked out of the text, longest first, so a digit inside a datum never stands in for a count or an offset;
   - *spec-named tokens* — statuses (10.3), strategies (`path-blocks`, `audit`, `coverage`), item kinds (10.5–10.7), the blocked state (10.3: `blocked`), change categories (5.6), `deleted` (9.3), the code groups' `direct` and `transitive` (9.2), edge kinds (5.2), preview edit classes (6.6, 12.7), `unavailable` (11.2, 12.7), `absent` (10.7: "presented absent"), `corrupt` (14.21) — case-insensitively, the token's hyphen-joined words separated by any one character that is neither letter nor digit, or by nothing (`no-change`, `No change`, `no_change`, `nochange`), not preceded by a letter (so `blocked` does not count inside `unblocked`, nor `changed` inside `unchanged`), any letters allowed after it (`direct` counts in `directly`), and `changed` not counting where it ends `metadata`, `descendant`, or `upstream` and a separator.
4. *Limits.* No mention is associated with another — no "same line", no adjacency, no order (H-3; the header of `human.ts`). What robust matching cannot ask — which count belongs to which status or session, which row is blocked, which identity is attributed to which category or lies on which path, which delta direction lists a path — stays with the JSON assertions. Each touched module's header records its human-form checks and their limits in its conservative-operationalizations list, as T8.2-1's bullet in `section-8.ts` records its own.
5. *Red checks.* Each task runs its changed tests against the built product (they pass: Known state), against `revB-d0c/m/p13` (they pass), against the human-renderer mutants it names (each fails diagnosed, naming a missing mention of the gutted class), and, with the task's change stashed, against one of those mutants (it passes: the gap, shown closed), recording every outcome and its run time.

**Spellings.** Take every exact spelling — command lines, paths, quoted requirement text — from the TEST-SPEC.md or SPEC.md text the task cites or from the harness code it names, never from a review report. Keep the existing em dashes (U+2014) of any title or comment you edit; never type a character as a backslash-u escape into an edit or a Bash payload.

**Conventions for changed code.**
- *Product verdicts.* Every test Tasks 3–10 strengthen passes against the built product before and after its task (its human renderers carry the information: Known state). P-10 fails diagnosed against it before and after Task 1, at a killed run's lock-path check (which trial and episode is timing's, E-5). The suite's failing set therefore stays run 1225's 29, every failure a `HarnessAssertionError`, and S-7's sweep (`test/self/s7-red-green-sweep.test.ts`) still meets every registered test failing diagnosed against the empty stub (no task adds a product invocation before a body's first). A different outcome is explained before the task goes on: a real product deviation the stronger check now reaches is recorded (task commit and AGENTS.md); a harness false failure is fixed.
- *Shared helpers.* A helper a task changes keeps its behavior for every other caller; certified tests (CERTIFICATIONS.md's in-scope sets) are untouched by Tasks 2–10, P-10 alone by Task 1.
- *Comments and titles.* Every doc comment, module-header note, and test title a change contradicts is corrected in the same task; each strengthened test's title gains its human-form clause.
- *AGENTS.md* gets only build/run knowledge a later spawn needs (a recipe, a count or timing a later check relies on, a corrected fact), never a task narrative. Task 2 adds one bullet for the human-report parity checks; Tasks 3–10 each append one sentence to it (the test, the human runs added, the red-check builds and outcomes, the times).
- *Temporary files.* Every temporary self-test, stand-in, spec file, injection, and log lives in the scratchpad or is deleted before committing; `git status --short` before each commit lists only the task's own files.
- *Every task ends with:* `npm run typecheck` and `npm run format:check` exiting 0; the checks it names, with every outcome; the self project (Run mechanics) with 0 failures and its counts unchanged (37 files, 4434 tests until Task 2; Task 2 records its new count, which later tasks keep), and the certification lines unchanged (186 PASS / 50 FAIL / 0 error / 0 hang, 0 discrepancies); a commit (`sdg(phase-9): <imperative summary> (FIX_PLAN Task N)`, ending with the two trailer lines the session requires) stating honest results; and a push. Each task's commit also removes the finished task from the Tasks section and adds its one-line summary to its bullet in the Order section.

**Standing rulings.** Two Liaison rulings stand for this run: AGENTS.md's "Known residual 14.20 location gaps" and "Known SPEC 6.5 gap, deferred to a future SPEC revision (accepted for this run by ruling)" bullets. No task addresses them, and none may be added for them.

**Deleting this plan.** Only Task 11 deletes this file, with `git rm`, once no other task remains (`specs/tmp/.gitkeep` stays). If the permission system refuses the deletion, stop there: leave the file in place, commit nothing further for it, and report the refusal. Never move, rename, empty, or otherwise work around a refused deletion.

**Considered and not planned (do not re-raise).**
- *From reviewer B.* (1) Making T12.0-1's own sweep assert parity for every command: T12.0-1's text places the parity in the per-command tests ("adapter-verified per command in the sections above"), and its single sweep fixture would add only weaker duplicates; Task 10 records in `section-12.0-i.ts`'s header where each command's parity is asserted. (2) The payload of the human `review next`: SPEC 10.7 requires the self-contained payload of `next --json` alone ("With `--json`, the payload MUST be self-contained"); the human `next` reports which item comes next, its id (Task 5), and `show` carries the full item in both forms (Task 6).
- *The planner's own.* (1) Human forms reviewer B did not name: refused operations' and gated reads' findings, `review create`/`resolve`/`split`, a successful `build`/`check`, and the section form of `move`. SPEC 12.0's parity applies "where this specification defines report content"; those subcommands define no success report beyond their effect; findings parity is exercised once, on the reporting contract's own fixture (Task 7, T14-1); and a section move's report is the same applied mapping as the file move's (6.5: "A successful move regenerates derived files, and reports its applied mapping, as rename does"), which Task 9 checks. (2) Free text compared as wording — a finding's message, an item's `reason` (H-3); Task 7 compares a message's data only. (3) Association across mentions (conventions 4).
- *From reviewer C.* `journalEntryCount` counting an unterminated last line stays (6.1 leaves the terminator unpinned, H-4): Task 1's killed-run judgement rejects a half-written append at the polled journal itself. An episode that ends on its own keeps its {start, end} judgement (reviewer C's own scope for the fix).
- Reviewers A and D and VERIFY found nothing to plan. Every item of the previous plans' lists of the same name still holds (`git show d0c8039^:specs/tmp/FIX_PLAN.md`, and the lists it carries forward).

**Order.** Take the topmost task unless told otherwise. Task 1 is independent of the rest. Task 2 precedes Tasks 3–10, which use its matchers; Task 10 comes last among them (its header note names Tasks 3–9's tests); Task 11 comes last. When a task is done, its commit removes it from the Tasks section and adds a one-line summary to its bullet here.
- Task 1 (RC-1): P-10 judges each polled path of a run the kill ended against its start and its reader-free twin's final state. Done: in `section-16-p10.ts`, `runEpisode` reads every polled path's state in the twin's final workspace before the episode starts (`twinFinalStates`, graph data's the states its oracle already reads), and `judgePolledStates`, told whether the kill ended the run (`killedRun`), hands each other path of such a run to `judgeKilledRunPath`: every state polled there, and the state the kill left, must be its start state or its twin-final state, else a diagnosed `fail` naming the path and the first observing cycle (or the state once the kill had ended the run), quoting 13.5's two sentences, with `nearestContent`'s byte difference against [start, twin final]; ended runs, graph data's judgement, `judgeKilledRun`, and `JournalOrder` are unchanged. The module header's prior-or-complete bullet (why the twin's final state is the complete one: the same operation on a byte copy of the start, 12.0's byte-determinism with no absolute paths, 13.4, each such path written at most once), `judgePolledStates`' and `runEpisode`'s doc comments, the title, and `path-poller.ts`'s header say so; AGENTS.md gains the killed-run judgement bullet, and the companion-polling bullet a corrected clause. Checks: typecheck and format clean; the self project, `dist/` absent, 37 files and 4434 tests passed (390.4 s), certification 186 / 50 / 0 / 0, 0 discrepancies; the scratchpad injection (`t9jd0c_1/inject.py`) fired with the module before the task and P-10 passed against CONF-READERS (the gap, 17.2 s), and with the task's module it failed P-10 diagnosed at seed 271828183's trial 2, `specs/M3.xspec.ts` at 324 of the twin's 648 bytes (13.4 s; a first run never fired, a pass); uninjected, P-10 passes against CONF-READERS (16.9 s) and `revB-d0c/m/p13` (80.0 s; 76.7 s before), fails against the built product at a killed run's `found nothing at .xspec/lock` (53.3 s), and VIOL-READERS-CLAIM fails it as before (32.4 s).
- Task 2 (RB-1): the human-report matchers — token-bounded data, whole numbers after blanking, spec-named tokens — with their S-5 vectors. Done: `human.ts` gains `identityMention`, `nameMention`, and `spellingMention` (the conventions' three boundary kinds), `numberMention`, and `specTokenMention` over the closed `SPEC_NAMED_TOKENS` (model.ts's statuses, item kinds, change categories, edge kinds, and preview edit classes, plus the strategies, `blocked`, `deleted`, `direct`, `transitive`, `unavailable`, `absent`, `corrupt`; any other token fails loudly; a token never counts where it ends a longer one, which gives `changed`'s `metadata`/`descendant`/`upstream` exclusion), each a `FormedMention` (a third `Mention` variant whose `description` names it in a diagnosis: `identity or path "…"`, `number 4`, `SPEC-named token "…"`), plus `assertReportMentions`' `{ blank }` option and the pure `blankReportData` (every occurrence one space, longest first; the diagnosis lists the data blanked and excerpts the report as given). Every matcher fails diagnosed on an empty datum, a number that is not a non-negative safe integer, an empty, malformed, or unnamed token, or an empty blanked datum. The module header states the conventions and their limits (ASCII classes; no association). Eight S-5 tests after `conditionMention`'s carry the plan's vectors and more, each table listing every vector it gets wrong. Checks: typecheck and format clean; the self project, `dist/` absent, 37 files and **4442 tests** passed (388.11 s and 360.34 s, two runs, the second on the committed tree; CI's harness-self count becomes 39 files and 4452 tests, the full suite's 127 files and 4805 tests), certification 186 / 50 / 0 / 0, 0 discrepancies; the red check (scratchpad `t9jd0c_2/redcheck.py`, its outcomes in `t9jd0c_2/redcheck2-vectors.txt`): 37 one-point breaks of `human.ts` — each boundary class and lookaround, the blanking's order, space, and option, the token's letter bound, separator, case, and tail exclusion, every input check, and both diagnoses — each failed only its own test(s), flipping exactly the vectors aimed at its rule (~3.3 s a run); with `human.ts` stashed the 8 failed and the other 109 passed; a probe applied the matchers, mentions taken from the built product's JSON documents, to its human `review list`, `review status`, `impact`, rename preview, performed rename, and `check` findings over a hand-staged workspace: every mention found.
- Task 3 (RB-1): T10.7-5 asserts `review list`'s human form. Done: `section-10.7-i.ts` gains the module-private `assertHumanSessionList`, which runs the human `review list` at a decoded listing's state, asserts the listing's exit code, and matches, from the listing, every session's name (`nameMention`), each healthy session's strategy and every status it has a nonzero stored count under (`specTokenMention`), and `corrupt` for a corrupt session in one call, and each nonzero count (`numberMention`) in a second call blanking the listing's digit-holding names (an empty listing asserts the exit code alone); T10.7-5 calls it after its clean listing (exit 0) and after its corrupt one (exit 1). The module header gains the bullet for these checks and their limits (which count belongs to which session and status, that a corrupt session's fields are absent, and which session is corrupt stay with the JSON assertions — at the corrupt state condition 21's finding may itself name the session, say "corrupt", and hold digits); the title gains its human-form clause. Checks: typecheck and format clean; the self project, `dist/` absent, 37 files and 4442 tests passed (383.61 s), certification 186 / 50 / 0 / 0, 0 discrepancies; T10.7-5, run alone through the temporary `test/self/zz-t9jd0c3.test.ts` (deleted), passed against the built product (6.95 s of test time) and `revB-d0c/m/p13` (6.11 s), and failed diagnosed at the clean listing against `rev-humanempty` (the names `B`, `a`, `a2` and every token; 4.92 s), `t9jd0c3-nocounts` (`unresolved`, `no-change`; 5.30 s), `t9jd0c3-nostrategy` (`coverage`, `path-blocks`, `audit`; 5.32 s), and the extra `t9jd0c3-nonumbers` (the counts' digits dropped: `number 1`, with `a2` blanked; 4.63 s); the extra `t9jd0c3-nocorruptline` (no `c corrupt` line) passed (5.76 s: the finding carries the name and the token, the recorded limit); with the change stashed, `rev-humanempty` passed (5.38 s: the gap). The task's specs: scratchpad `t9jd0c_3/specs/`. A permission refusal met during the task (an exploratory hand-staging's `rm -rf` of a relative glob after `cd`, flagged as `/home/user/xspec/*` and never run) was not retried; that line was dropped, and nothing in the task depended on it.
- Task 4 (RB-1): T10.7-6 asserts `review status`'s human form.
- Task 5 (RB-1): T10.7-7 asserts that the human `review next` names the item it returns.
- Task 6 (RB-1): T10.7-8 and T10.7-12 assert `review show`'s human form.
- Task 7 (RB-1): T14-1 asserts the human `build` and `check` findings.
- Task 8 (RB-1): the T9.x tests assert `impact`'s human form.
- Task 9 (RB-1): T6.4-1 and T6.5-1 assert the human report of a performed `rename` and `move`.
- Task 10 (RB-1): T6.6-4, T6.6-5, and T6.6-6 assert the human preview report; `section-12.0-i.ts`'s header names where each command's parity is asserted.
- Task 11: confirm locally and in CI; record the timings; delete this plan.

## Tasks

### Task 4 — T10.7-6 asserts `review status`'s human form (RB-1)

**Depends on.** Task 2.

**Requirement.** The conventions' requirement, and TEST-SPEC T10.7-6: "Items in item order with id, kind, scope, status, blocked state, plus totals by status (read-time invalidation applied)." SPEC 10.7: "`status <name>` reports the session's items in item order — each with id, kind, scope, status, and blocked state — plus totals by status." Reviewer B: nothing reads the human `review status`; the `rev-humanempty` build passes every test.

**State at d0c8039** (`section-10.7-i.ts`). T10.7-6 (line 2038) reads `review status s --json` (`sessionStatus`) at four stages over an audit session of `specs/T.mdx` (its root, `p`, `p.a`, `p.b`):
- A (line 2054): all unresolved, the root and `p` blocked;
- B (line 2125): the leaves resolved, the root blocked;
- C (line 2160): `p` updated, nothing blocked;
- D (line 2228): after the `p.a` edit, `p` and `p.a` invalidated, the root and `p` blocked.
No human `review status` runs.

**Change.**
1. After each stage's JSON read, at the same state, run `review status s` without `--json`: exit 0.
2. Mentions, from the decoded document:
   - every row's id (an id boundary), kind and status (spec-named tokens), and scope (an identity boundary);
   - `blocked` wherever some row is blocked;
   - every status with a nonzero total, and each nonzero total (a number, after blanking — the built product's ids `item-<n>` are why).
3. The module header bullet and its limits (which row is blocked, and which total labels which status, stay with the JSON assertions); the title.

**Verify.**
- The common checks.
- T10.7-6 passes against the built product and against `revB-d0c/m/p13`.
- Red checks (record each outcome and time):
  - `rev-humanempty`: T10.7-6 fails diagnosed at stage A;
  - `t9jd0c4-nototals` (`reviewStatusCommand`'s `totals:` line dropped): fails, naming a total — at stage A the total 4 appears nowhere else once the ids are blanked;
  - `t9jd0c4-noblocked` (each row's `blocked=…` dropped): fails at stage A, naming `blocked`;
  - with the change stashed, `rev-humanempty`: passes (the gap).
- AGENTS.md: the task's sentence.
- Commit (subject `sdg(phase-9): assert review status's human form in T10.7-6 (FIX_PLAN Task 4)`) and push.

**Done when.** The checks hold, and the commit is pushed with a message recording the results.

### Task 5 — T10.7-7 asserts that the human `review next` names the item it returns (RB-1)

**Depends on.** Task 2.

**Requirement.** The conventions' requirement, and TEST-SPEC T10.7-7: "Returns the first needing-review unblocked item in item order"; SPEC 10.7: "`next` returns the first item in the session's item order … that needs review … and is unblocked". Reviewer B: the human `review next` is read only in the fully resolved case; the `rev-humanitem` build passes every test.

**Departure from reviewer B's proposal.** Reviewer B proposed asserting the item's kind, scope, status, and payload in the human `next`. SPEC 10.7 requires the self-contained payload of `next --json` alone ("With `--json`, the payload MUST be self-contained"). What the human `next` must carry is which item comes next — the item `next` returns, identified by its id. The full item in human form is `show`'s (Task 6).

**State at d0c8039** (`test/suite/registry/section-10.7-ii.ts`). T10.7-7 (line 1063) reads `next --json` where it returns an item:
- at the order arm's four `expectNextId` reads (lines 1119–1157: p.a's, p.b's, p's, then the root's item);
- at the payload arm's four reads (lines 1260, 1373, 1408, 1480: a.k's, a's, the code location's, and that item again after the code file's deletion).
The human form runs only in the fully resolved case (`expectFullyResolvedBothForms`, line 1029, `/resolv/i`).

**Change.**
1. After each of those eight JSON reads, at the same state, run `review next <session>` without `--json`: exit 0, its report mentioning the returned item's id (an id boundary).
2. The module header bullet, its limit (the human `next` is asked only to identify its item; the departure above), and the title.

**Verify.**
- The common checks.
- T10.7-7 passes against the built product and against `revB-d0c/m/p13`.
- Red checks (record each outcome and time):
  - `rev-humanitem`: T10.7-7 fails diagnosed at the order arm's first read, naming p.a's item id;
  - `t9jd0c5-firstitem` (the human branch of `reviewNextCommand` rendering the first item in item order, whatever its status): fails, naming the expected id;
  - with the change stashed, `rev-humanitem`: passes (the gap).
- AGENTS.md: the task's sentence.
- Commit (subject `sdg(phase-9): assert the item the human review next names in T10.7-7 (FIX_PLAN Task 5)`) and push.

**Done when.** The checks hold, and the commit is pushed with a message recording the results.

### Task 6 — T10.7-8 and T10.7-12 assert `review show`'s human form (RB-1)

**Depends on.** Task 2.

**Requirement.** The conventions' requirement, and TEST-SPEC T10.7-8: "`show <name> <item-id>` reports the full item (10.2 fields plus the `next --json` text payload)". SPEC 10.7: "`show <name> <item-id>` reports the full item: every field of 10.2 plus the same self-contained text payload as `next --json`". The payload is every scope, context, and origin node under its current identity and presence, a present node's source range, the item's `baseline` and `current`, and the texts per kind; an absent node or an absent side of an origin pair is "presented absent, with no text". Reviewer B: the `rev-humanitem` build passes every test.

**Departure from reviewer B's proposal.** Reviewer B named T10.7-8 alone. T10.7-8's audit fixture has no origin pair, no absent node, and one item kind. The payload's every kind, its origin pairs, and its absent presentations are staged in T10.7-12, which reads `show --json` for every item. So this task reaches into T10.7-12 as well.

**State at d0c8039** (`section-10.7-ii.ts`).
- T10.7-8 (line 1556) reads `show --json` once (line 1583): x.k's item, the item `next` returns, unblocked, with an empty `blockedBy`.
- T10.7-12 reads `show --json` per exported item in sub-fixture A (the per-kind matrix over a path-blocks session, line 3710) and in sub-fixture C (the coverage session, line 3988). Sub-fixture B (line 3736) reads two absent-node items (`assertProvenance`, around line 3815).
- Helpers: `showItem`, `queryNode`, `collectStringLeaves`, `requireItemById`.
- No human `review show` runs.

**Change.**
1. One module-private helper runs `review show <session> <id>` without `--json` at the state of a decoded `show --json` item and asserts the item's mentions: exit 0. The mentions, from the decoded item:
   - its id, kind, and status;
   - `blocked` where it is blocked, and each `blockedBy` id;
   - its note where it has one;
   - its scope, every context identity, and every origin identity;
   - `absent` wherever the item presents a node or an origin side absent;
   - the start and end of every source range it carries (numbers, after blanking);
   - every non-blank line of every text it carries — scope, context, and origin before and after;
   - where the caller supplies `query node` captures, each captured hash that the item's `baseline` or `current` holds as a string leaf (`collectStringLeaves`; product-to-itself, no hash pinned).
   The `reason` is free text and is not compared (the conventions).
2. Call it:
   - in T10.7-8 on x.k's item, with `query node` captures of x.k taken at that state;
   - in T10.7-8 on the root's item, blocked, whose `show --json` the task adds at the same state, decoded with the item adapter;
   - in T10.7-12 at every `show` read of sub-fixtures A, B, and C.
3. The module header bullet and its limits (which text or range belongs to which payload node stays with the JSON assertions); both titles.

**Verify.**
- The common checks.
- T10.7-8 and T10.7-12 pass against the built product and against `revB-d0c/m/p13`.
- Red checks (record each outcome and time):
  - `rev-humanitem`: both tests fail diagnosed at their first human `show`;
  - `t9jd0c6-notexts` (`renderTextBlock` in `src/cli/commands/review-session.ts` rendering nothing): fails, naming a text line;
  - `t9jd0c6-noranges` (the `range:` lines dropped): fails, naming an offset;
  - `t9jd0c6-nohashes` (the `baseline:`/`current:` lines dropped): T10.7-8 fails, naming a hash;
  - `t9jd0c6-noabsent` (no `absent` anywhere in the item block: `renderNodeStateHuman`'s, `renderOriginHuman`'s, and `compactStateHuman`'s — the last renders a recorded state's absent node, so leaving it would let the `current:` line carry the token): T10.7-12 fails at sub-fixture B, naming `absent`;
  - with the change stashed, `rev-humanitem`: passes both (the gap).
- AGENTS.md: the task's sentence.
- Commit (subject `sdg(phase-9): assert review show's human form in T10.7-8 and T10.7-12 (FIX_PLAN Task 6)`) and push.

**Done when.** The checks hold, and the commit is pushed with a message recording the results.

### Task 7 — T14-1 asserts the human `build` and `check` findings (RB-1)

**Depends on.** Task 2.

**Requirement.** The conventions' requirement, and TEST-SPEC T14-1: "`build` and `check` report each of them (not only the first), and every report identifies file and location and states a correction-oriented message (information presence, not wording)". SPEC 14: "`xspec build` and `xspec check` MUST report actionable errors that identify the file, location, and correction". SPEC 1.7: "Every source range this specification outputs — … findings and refusals (14) … — uses this one convention" — a pair of byte offsets, which a human report carries as two numbers. Reviewer B: T14-1 asserts all this on `--json` only. With the `findings-fileonly` build, which cuts each human finding line to its file, 61 of 63 tests pass.

**Departure from reviewer B's proposal.** Reviewer B asked for "each finding's file, location and correction message". The message's wording is free (T14-1: "information presence, not wording"; H-3), so the human message is never compared with the JSON message's wording. What a message carries as data — the staged spellings it quotes — must be in the human report too.

**State at d0c8039** (`test/suite/registry/section-14.ts`).
- T14-1 (line 816) stages six conditions in five files (`T14_1_FILES`; the constructs `T14_1_*_CONSTRUCT`). It runs `build --json` and `check --json` (`buildFindings`, `checkFindings`), and asserts through `assertCompleteReport` (line 787): exact condition counts, each finding located within its window, and a non-blank message.
- No human run.

**Change.**
1. After each JSON run, at the same state (a failing `build` modifies nothing, 12.1; `check` writes nothing), run `build` and `check` without `--json`: exit 1.
2. Mentions, from the decoded findings, for every finding:
   - its every location's file (a path boundary), and the location's start and end (numbers, after blanking);
   - the correction's data: each of the staged spellings `two seg`, `absent.dep`, `absent.text`, `div`, and `OK.absent` — the 14.4 segment, the unresolved `d` and `text` targets, the element name, the marker chain — that the finding's JSON message contains, as a letter-bounded spelling.
3. The module header bullet ("states a correction-oriented message" in human form: the location and the message's data; never the wording) and its limits (which location and data belong to which finding stay with the JSON assertions); the title.

**Verify.**
- The common checks.
- T14-1 passes against the built product and against `revB-d0c/m/p13`. Record which spellings the built product's JSON messages quote.
- Red checks (record each outcome and time):
  - `findings-fileonly`: T14-1 fails diagnosed, naming an offset;
  - `t9jd0c7-nomessage` (`renderFindingLine` in `src/cli/report.ts` keeping the location and dropping the message): fails, naming a quoted spelling, if the built product's messages quote any. If they quote none, say so; the mutant then passes, a limit recorded in the module header;
  - with the change stashed, `findings-fileonly`: passes (the gap).
- AGENTS.md: the task's sentence.
- Commit (subject `sdg(phase-9): assert the human build and check findings in T14-1 (FIX_PLAN Task 7)`) and push.

**Done when.** The checks hold, and the commit is pushed with a message recording the results.

### Task 8 — The T9.x tests assert `impact`'s human form (RB-1)

**Depends on.** Task 2.

**Requirement.** The conventions' requirement, and SPEC 9.3: output "grouped by category, with ancestor chains collapsed alongside their attribution … followed by directly and transitively impacted code, each with one impact edge (9.2) that makes it impacted and one shortest propagation path (12.0) witnessing it"; "A node absent from the current graph is reported as deleted". SPEC 5.6: "every category MUST be attributed to its originating nodes". Reviewer B: the T9.x tests read one identity of the human report (T9-1). With the `impact-humanids` build, which prints bare identities, T9-1 through T9.3-3 all pass.

**State at d0c8039.**
- `test/suite/registry/section-9.ts` and `section-9.3.ts` decode `impact --base <ref> --json` through `impactAgainst` (`section-5.6.ts`, line 83) and assert it with `assertImpactCategories` and `assertImpactedCode`.
- Call sites with differences: `section-9.ts` lines 290 (T9-1), 357 and 378 (T9.1-1), 534, 638, 704, 798, and 923 (T9.2-1 through T9.2-5); `section-9.3.ts` lines 317 (T9.3-1), 653 and 723 (T9.3-2), and 884 and 949 (T9.3-3).
- T9-1's no-difference arms (lines 226, 245) report nothing.
- T9-1's human run (`assertReportMentions`, line 281) mentions the changed identity alone.
- `impactAgainst` is shared with T5.6, T8-5, and other tests. It stays as it is.

**Change.**
1. A helper in `section-9.ts`, exported for `section-9.3.ts`, runs `impact --base <ref>` without `--json` at the state of a decoded report: exit 0. The mentions, from the decoded report:
   - every requirement entry's nodes (identity boundaries), its `deleted` token where it is deleted, each of its categories (spec-named tokens), and each attribution identity;
   - for every impacted-code entry: its location, its edge's kind (a spec-named token) and target, and every node of its path;
   - `direct` and `transitive` wherever the respective group is non-empty.
   At an empty report it asserts exit 0 alone. `assertReportMentions` refuses an empty mention list, so the helper never calls it with one.
2. Call the helper at every call site above, after that site's JSON assertions, in place of T9-1's identity-only check. The no-difference arms keep their exit-0 human runs.
3. The module-header bullets of both modules, with their limits (which attribution or path belongs to which entry stays with the JSON assertions); the titles.

**Verify.**
- The common checks.
- Every T9.x test passes against the built product and against `revB-d0c/m/p13`.
- Red checks (record each outcome and time):
  - `impact-humanids`: every body with differences fails diagnosed, naming a category token;
  - `t9jd0c8-nokinds` (`renderImpactHuman` in `src/cli/commands/impact.ts` without the edge kind): the T9.2-x and T9.3-2 bodies fail, naming `references` or `embeds`;
  - `t9jd0c8-nocode` (the code sections dropped): T9.2-1 fails, naming a code location;
  - with the change stashed, `impact-humanids`: every T9.x test passes (the gap).
  Attributions and path nodes coincide with entry identities in most fixtures. Record in the module headers where a mutant dropping them would still pass.
- AGENTS.md: the task's sentence.
- Commit (subject `sdg(phase-9): assert impact's human form in the T9 tests (FIX_PLAN Task 8)`) and push.

**Done when.** The checks hold, and the commit is pushed with a message recording the results.

### Task 9 — T6.4-1 and T6.5-1 assert the human report of a performed `rename` and `move` (RB-1)

**Depends on.** Task 2.

**Requirement.** The conventions' requirement, and SPEC 6.4: "A successful rename's report is the applied mapping: the complete identity mapping the operation journaled — the preview's `mapping` (6.6) — carried in JSON in the applied-mapping document form of 12.7". SPEC 6.5: "A successful move regenerates derived files, and reports its applied mapping, as rename does (6.4)". TEST-SPEC T6.4-1: "The command's own report is the applied mapping — every identity pair the operation journaled". Reviewer B: no section-6 module reads a human report. With the `mapping-humanempty` build, T6.4-1 through T6.4-7, T15-1, and T12.0-1 all pass.

**State at d0c8039.**
- T6.4-1 (`test/suite/registry/section-6.4.ts`, line 682) runs `rename specs/Core.mdx core.mid core.hub --json` (line 735) on its built workspace and asserts the two pairs (`assertAppliedMapping`). It makes no copy.
- T6.5-1 (`section-6.5.ts`, line 2042) runs `runFileMoveArm` (line 1733) over each of `FILE_MOVE_ARMS`. Each arm runs the preview on a copy staged and built like the original (`previewRanges`, line 1779, which leaves the copy at the pre-move state), then the move with `--json` on the original (line 1855), asserting `arm.mapping`.

**Change.**
1. T6.4-1: before the JSON rename, at the pre-operation state its premises have just checked, make a byte copy of the workspace (the conventions' item 1). Run the same `rename` there without `--json` (exit 0); dispose of the copy.
2. T6.5-1: in each arm's preview copy, after its preview, run the same `move` without `--json` (exit 0).
3. Mentions, from the applied mapping the JSON assertions pinned: every pair's `from` and `to` identity (identity boundaries; a renamed identity occurs inside its descendants', and the root's bare path inside its sections').
4. The module-header bullets, with their limit (which `from` maps to which `to` stays with the JSON assertions); the titles.

**Verify.**
- The common checks.
- T6.4-1 and T6.5-1 pass against the built product and against `revB-d0c/m/p13`.
- Red checks (record each outcome and time):
  - `mapping-humanempty`: both fail diagnosed, naming a mapping identity;
  - `t9jd0c9-fromonly` (`emitAppliedMappingReport`'s human lines carrying `from` alone): both fail, naming a `to` identity;
  - with the change stashed, `mapping-humanempty`: both pass (the gap).
- AGENTS.md: the task's sentence.
- Commit (subject `sdg(phase-9): assert the human report of a performed rename and move (FIX_PLAN Task 9)`) and push.

**Done when.** The checks hold, and the commit is pushed with a message recording the results.

### Task 10 — T6.6-4, T6.6-5, and T6.6-6 assert the human preview report; T12.0-1's header names the parity sites (RB-1)

**Depends on.** Tasks 2–9 (Tasks 3–9 for the header note).

**Requirement.** The conventions' requirement, and SPEC 6.6. A preview "supports `--json` per 12.0 — the preview document form of 12.7 — and reports":
- the complete identity mapping;
- every file the operation would rewrite, relocate, or create, with every edit "classed as exactly one of the following and … located by a source range";
- the derived-file delta, both directions, or explicitly unavailable where the record cannot be read (14.23).

Reviewer B: no section-6 module reads a human preview.

**State at d0c8039** (`test/suite/registry/section-6.6.ts`).
- `runPreviewJson` (line 2651) runs `<operation> --preview --json` (exit 0) and decodes the form-exact preview document. T6.6-4 (line 3648) calls it at lines 3668–3809, some inside a whole-root modifies-nothing compare. T6.6-5 (line 4199) calls it at lines 4257–4602, including its graph-data-deleted arm, which asserts that the preview writes nothing.
- T6.6-6 (line 4572) decodes its full preview (exit 1, `delta` unavailable) at line 4667 directly.
- No human preview runs.
- `section-12.0-i.ts`'s module header says T12.0-1's information parity "is adapter-verified by the per-command tests in the sections above", naming none.

**Change.**
1. In `runPreviewJson`, after the decode, run the same argv without `--json`, at the same state and inside whatever compare the caller holds: exit 0. The mentions, from the decoded document:
   - every mapping pair's identities;
   - every file entry's path;
   - every edit's class (a spec-named token) and its range's start and end (numbers, after blanking);
   - every delta path, in either direction.
   The direction words are no spec-named tokens, so they are not asserted; which direction lists a path stays with the JSON assertions.
2. In T6.6-6, after its full preview's decode, the human preview: exit 1, with the same mentions, but `unavailable` in place of the delta's paths. The refused preview beside it is a refusal, outside this plan (Considered and not planned).
3. The module header bullet and its limits; the three titles.
4. `section-12.0-i.ts`'s module header: in the T12.0-1 bullet, name where each command's human parity is asserted:
   - `coverage` in T8.2-1; `ids` and `show` in T12.3-1 and T12.4-1;
   - `review list`, `status`, `next`, and `show` in T10.7-5, T10.7-6, T10.7-7, T10.7-8, and T10.7-12;
   - `build` and `check` findings in T14-1; `impact` in the T9 tests;
   - a performed `rename` and `move` in T6.4-1 and T6.5-1; previews in T6.6-4, T6.6-5, and T6.6-6;
   - the JSON-only surfaces in T12.0-1 itself.
   T12.0-1's title already defers to "the per-section tests" and stays.

**Verify.**
- The common checks.
- T6.6-4, T6.6-5, and T6.6-6 pass against the built product and against `revB-d0c/m/p13`. T6.6-5's no-write assertions still hold with the human runs inside them.
- Red checks (record each outcome and time):
  - `t9jd0c10-previewempty` (`emitPreviewReport` in `src/cli/report.ts`: the human branch printing its findings alone): all three fail diagnosed;
  - `t9jd0c10-noedits` (the `START-END CLASS` lines dropped): T6.6-4 fails, naming an edit's class or offset;
  - `t9jd0c10-nodelta` (the delta lines dropped): T6.6-5 fails, naming a delta path. T6.6-6 may still pass it: the built product's condition-23 message itself says the recorded paths are "unavailable" (`unreadableRecordFinding`, `src/core/graph-data.ts`), and robust matching cannot tell which line carries the token. Record the outcome; if it passes, record the limit in the module header;
  - with the change stashed, `t9jd0c10-previewempty`: all three pass (the gap).
- AGENTS.md: the task's sentence.
- Commit (subject `sdg(phase-9): assert the human preview report; name the human-parity sites in T12.0-1's header (FIX_PLAN Task 10)`) and push.

**Done when.** The checks hold, and the commit is pushed with a message recording the results.

### Task 11 — Confirm locally and in CI; record the timings; delete this plan

**Depends on.** Tasks 1–10 (gone from this plan, recorded in the Order section).

**Change and checks.**
- *Self project and certification.* Run the self project per Run mechanics, with `dist/` absent and the admin files left out. Expect:
  - 0 failures, at Task 2's recorded counts;
  - the counts in AGENTS.md's bullet beginning "Harness self-tests and certification only" matching the run;
  - the certification lines 186 PASS / 50 FAIL / 0 error / 0 hang, with 0 discrepancies against the document (`compare_cert.py`).
- *CI.* Before committing, find the run on the head Task 10 pushed (`gh api 'repos/modularcloud/xspec/actions/runs?branch=claude/xspec-ui-apis-4df8fa&per_page=3'`). Wait for it to complete by polling in the foreground (Run mechanics). If a job ends `cancelled` with no steps (an infrastructure event), re-run that job once (`gh api --method POST repos/modularcloud/xspec/actions/jobs/<job-id>/rerun`); if that is refused, report the refusal and stop. Never push a commit just to retrigger. Expect:
  - the harness-self job green with no product installed: 39 files, the admin files included, and Task 2's CI count of tests (4444 plus its vectors), all passed; certification with 0 discrepancies;
  - the full-suite job failing only on run 1225's 29 diagnosed product tests, plus any real product deviation a task recorded, every one a `HarnessAssertionError`, its self-project half green (`analyze_suite.py` against `<scratchpad>/p9j_d0c/ci1225/suite.clean.log`). The tests of Tasks 3–10 pass; P-10 fails diagnosed (record its seed, trial, episode, and time);
  - the Windows leg's 2 diagnosed failures, as in run 1225.
  Explain any difference before going further.
- *No local suite run.* Tasks 1–10 ran their changed product tests against the built product locally, so CI's full-suite job is the suite-wide check. Say so in the commit message.
- *Timings.* Add this run's figures to AGENTS.md's timings bullet (the bullet beginning "Timings on a 4-core machine"), in its style, replacing what they supersede:
  - the local self project;
  - the harness-self job: its self project, `certification.test.ts`, VIOL-READERS-CLAIM's and CONF-READERS' verifications, and the whole job against its 20 minutes;
  - the full-suite job and P-10's time within it;
  - the Windows leg.
- *Delete this plan.* Once no other task remains in `specs/tmp/FIX_PLAN.md`, delete it with `git rm` in the same commit, under the Preamble's "Deleting this plan" rule.
- Commit (subject `sdg(phase-9): confirm the harness locally and in CI; record the timings; delete the finished plan (FIX_PLAN Task 11)`) and push.

**Done when.** The checks hold, the commit message records them, the plan is deleted (or its refused deletion reported), and the commit is pushed.
