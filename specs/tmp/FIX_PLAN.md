# FIX_PLAN — Phase 9 (test harness), re-descent after the jump-back, determination at 2a2b94e

Written 2026-10-16 at 2a2b94e (branch `claude/xspec-ui-apis-4df8fa`, standing in for `patch/external-ui-apis`). It plans from the compliance determination at 2a2b94e, the first since the jump-back revised SPEC.md (last changed 9523eb0), TEST-SPEC.md (80b83aa), and CERTIFICATIONS.md (c115ce1). The harness had not changed since its last convergence at 6694886 (`git diff --stat 6694886 2a2b94e -- test/` is empty), so the gaps lie almost entirely in the revised passages:
- A (TEST-SPEC's T1–T6 tests): 34 gaps, cited here as RA-1 … RA-34 (reviewer A's numbered items). A's two uncounted notes (H-2 with §4's opening paragraph; H-1's T6.3-5(c) half) are RC-1's and RC-4's.
- B (T7 onward): 88 gaps, RB-1 … RB-88 (B's numbered items 1–88).
- C (everything in TEST-SPEC outside the T-numbered tests): 8 gaps, RC-1 … RC-8.
- D (CERTIFICATIONS.md): 11 gaps, RD-G1 … RD-G11; plus D's uncounted note that T13.5-4's storm compare excludes the journal (RD-N1).
- V (VERIFY): red — the C-1 manifest test (`test/self/certification-document.test.ts`, "the fixture manifest equals CERTIFICATIONS.md"), locally and in CI; that is RD-G1.

The five reports are saved verbatim in `<scratchpad>/p9j_2a2/reports/` (`<scratchpad>` is `/tmp/claude-0/-home-user-xspec/08a79bea-e066-52cf-ac19-1be1615496b4/scratchpad`): `reviewer-A-T1-T6.md`, `reviewer-B-T7-onward.md`, `reviewer-C-outside-T-tests.md`, `reviewer-D-CERTIFICATIONS.md`, `verify.md`. Read one when a task's text leaves a detail open, but take every exact spelling from the spec documents or the harness code, never from a report. Where this plan departs from a report (a mislabelled arm, a split, an order), the task says so.

Two planning tools in `<scratchpad>/p9j_2a2/tools/` show what changed in a test since the harness last converged: `python3 -I <scratchpad>/p9j_2a2/tools/tid.py specs/TEST-SPEC.md <ID>…` prints the current entry of each ID (T-, P-, H-, S-, E-, C- IDs alike), and `python3 -I <scratchpad>/p9j_2a2/tools/tdiff.py <scratchpad>/p9j_2a2/ts-6694886.md specs/TEST-SPEC.md <ID>…` prints the word-level changes since 6694886 (NEW for a new entry). Run both, from `/home/user/xspec`, for every test a task touches before editing; the inserted runs are what the task must bring into the harness. `<scratchpad>/p9j_2a2/spec-6694886.md` and `cert-6694886.md` are the other two documents at 6694886; `diff-A.txt`, `diff-B1.txt`, `diff-B2.txt`, and `diff-C.txt` there hold `tdiff.py`'s output for every test and requirement the reviewers named, and `id-module.txt` maps each registered test ID to its registry module, both as of 2a2b94e.

Task numbers here are this plan's own: AGENTS.md's bullets and earlier commit subjects cite tasks of earlier plans ("FIX_PLAN Task 13 of the plan written at …"), unrelated to these.

Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tests Specified); no task changes its stage. No Bug Report applies. No problems file exists. This is the only plan: the Phase 10 plan written before the jump-back was retired at 2a2b94e (`git show 67e37da:specs/tmp/FIX_PLAN.md`); the previous Phase 9 plan is `git show c1ee2fc^:specs/tmp/FIX_PLAN.md`.

## Preamble — read before any task

**Phase goal and scope guards (Phase 9).** The harness must adhere to `specs/TEST-SPEC.md` and `specs/CERTIFICATIONS.md`: every harness self-test passes and every certification holds (each in-scope test passes against its conformer and fails against each violator that certifies it, every other in-scope test passing against that violator) — locally and in CI, the harness-self job green on the head. Product tests may fail, but only as diagnosed assertion failures (`HarnessAssertionError`, H-8): never a harness error, crash, hang, or false pass. Never modify product code (`src/`; `dist/` is built from it), never edit `.github/` (CI scaffolding), and never couple harness and product (the harness imports no product code, H-2). Work lives in `test/` (registry modules, helpers, adapters, oracles, self-tests, certification fixtures under `test/fixtures/`), `specs/tmp/FIX_PLAN.md`, the problems files, and `AGENTS.md` (build/run knowledge only). If a task meets a spec defect — a contradiction between documents, an impossible or untestable requirement, a test specified against behavior SPEC.md forbids — stop: append it, dated and precisely described, to the matching problems file under `specs/tmp/` (`SPEC-PROBLEMS.md`, `TEST-SPEC-PROBLEMS.md`, or `CERTIFICATIONS-PROBLEMS.md`), commit, push, and end with `OUTCOME: PROBLEM — <file>`; never work around it.

**Known state at 2a2b94e.**
- The harness tree is b5ac9a8's; `src/` last changed at 5a4617c. `specs/tmp/` holds the tracked `.gitkeep` and an untracked leftover `specs/tmp/REVIEW.md` — never stage, commit, move, or delete it, and do not report it (a Developer ruling is pending). Stage files by explicit path only, never `git add -A` or `git add .`.
- CI run 1337 (id 38898186214) at 2a2b94e: harness-self job 116963771808 failed on the C-1 manifest test alone (39 files, 4465 tests, 4464 passed, 246.53 s; `certification.test.ts` 39 tests in 207.6 s); full-suite job 116963771865: 127 files, 4818 tests, the same one failure (its self half) and every product test passing, 1232.35 s (its clean log: `<scratchpad>/p9j_2a2/ci1337/suite-linux.clean.log`); Windows leg 116971635811 green. CI limits: harness-self 20 min, full suite 90 min, Windows leg 30 min.
- CI run 1339 (id 38910332283) at a909c5d, Task 1's push — the plan's starting point: harness-self job 117004407714 green, 39 files, 4465 tests, all passed, 327.05 s (`certification.test.ts` 39 tests in 266.9 s, the S-7 file 33.2 s), the job 350 s from start to end, 29% of its 20 minutes; certification 171 PASS / 48 FAIL / 0 error / 0 hang over 39 fixtures, `compare_cert.py` 0 discrepancies, its 219 per-pair lines identical to `pairs-expected-after-task1.txt` (its clean log: `<scratchpad>/t9j2a2_1/ci1339-self.clean.log`). Its full-suite and Windows jobs were not awaited. Locally at Task 1 (load from that run alone): 37 files, 4455 tests, all passed, 446.09 s.
- Locally (VERIFY, under load from four parallel reviewers): 37 files (the two `*.admin.test.ts` files left out), 4455 tests, 1 failed (C-1), 577.89 s; log `<scratchpad>/verify-T4wEX8/self.clean.log`. AGENTS.md's unloaded figure is about 350 s.
- Certification: 9 conformers, 30 violators. The manifest at HEAD yields 236 pairs (186 PASS / 50 FAIL / 0 error / 0 hang); the document expects 219 (171 PASS / 48 FAIL / 0 / 0). `<scratchpad>/p9j_2a2/pairs-expected-after-task1.txt` holds the 219 expected per-pair lines (`<fixture>: <OUTCOME> <test>`, VERIFY's observed lines minus the T13.4-5 and T11.4-1 pairs, every outcome as observed). Every task from Task 1 on must leave the certification lines at exactly these. From Task 1 (a909c5d) on, the manifest yields the document's 219, locally and in run 1339.
- The built product passes every product test at HEAD (run 1337). Arms this plan adds may fail it — that is Phase 10's work — but only diagnosed (H-8).
- A build of HEAD's `src/` exists at `<scratchpad>/p9j_2a2/build/` (made at Task 2 by Run mechanics' recipe; `<scratchpad>/engineer-verify/xspec/` is stale). Run mechanics says how to check it and, if it fails the check, make another.
- Node v22.22.0 (`/opt/node22/bin/node`), Vitest 4.1.10, TypeScript 5.9.3; Python under `python3 -I`; 4 cores.

**Run mechanics (AGENTS.md holds the recipes; read the bullets a task names before running anything).**
- *Git.* Confirm `git status` is clean on `claude/xspec-ui-apis-4df8fa` but for the known untracked `specs/tmp/REVIEW.md`, and read `git log -3 --format='%h %s'`: a task interrupted after a push resumes where its text says. Never fetch or merge `main` (its newer scaffold commit 63bcb3f is not adopted in this run). Push with `git push -u origin claude/xspec-ui-apis-4df8fa`, retrying network errors with backoff (2 s, 4 s, 8 s, 16 s); never force-push, reset a pushed commit, or rewrite history. Commit subject `sdg(phase-9): <imperative summary> (FIX_PLAN Task N)`, ending with the session's two trailer lines.
- *Permission refusals* (Developer's standing constraint): if the permission system refuses any action, stop that line of work, never retry it or seek the same result another way, and report the refusal verbatim in the final report. GitHub's "GraphQL is not available" 403 is not a refusal: read GitHub through REST (`gh api repos/modularcloud/xspec/...`) or the GitHub MCP tools.
- *Removals* (Developer's standing constraint): name every removal target by an absolute, literal path; never put `rm` after a `cd` in the same command; never remove a relative path or a glob (such as `./*`); never build a removal target from a shell variable. For a clean scratch workspace, create a new directory with `mktemp -d` under the scratchpad instead of clearing an old one. Inside `/home/user/xspec`, remove only files created in the same spawn (a temporary runner, e.g. `rm /home/user/xspec/test/self/zz-t9j2a2_12.test.ts`), or go through git. This holds in the scratchpad too. A refused removal is a refusal: stop that line of work and report it verbatim.
- *Administrative access* (Developer's standing constraint): nothing needing administrative access runs locally — no user account, mount, PID namespace, or other-user process, no `sudo` beyond AGENTS.md's documented recipe, and no inspection of `sudo`, sudoers, accounts, or credentials, directly or through a test, staging, or script. Tests needing it (`test/self/*.admin.test.ts`, T13.5-9, T13.5-10(e)–(g)) are written locally but verified only in CI; local command lines leave the admin files out (never skip them in code), and no task selects T13.5-9 or T13.5-10 into a local runner.
- *The self project:* `env -u NODE_OPTIONS unshare --map-user=1000 --map-group=1000 -- npx vitest run --config test/vitest.config.ts --project self --exclude 'test/self/**/*.admin.test.ts'` (AGENTS.md's bullet beginning "The self project — and, once the Linux-leg tests"), run from `/home/user/xspec` and redirected to a log in the task's scratch directory; grep the log for `×` and the `Tests` summary, never cap it with `head`. Check the load first (`uptime`; other agents may share the machine); a failure seen only while harness runs overlap is rerun alone and is not a task failure. One certification family alone: append `test/self/certification.test.ts -t <FAMILY>` (`CORE`, `AVAIL`, `DISC`, …) in place of the whole project.
- *Certification lines against the document:* `python3 -I <scratchpad>/p9j_2a2/tools/compare_cert.py specs/CERTIFICATIONS.md <log>` prints the observed and expected totals and every discrepancy; `python3 -I <scratchpad>/p9j_2a2/tools/cert_compare.py specs/CERTIFICATIONS.md <log> <pairs-out>` writes the run's sorted per-pair lines, and `diff <pairs-out> <scratchpad>/p9j_2a2/pairs-expected-after-task1.txt` must print nothing. A CI log is cleaned first (*Reading CI* below).
- *The built product, outside the checkout.* Use `<scratchpad>/p9j_2a2/build/dist/cli/bin.js` once `diff -rq <scratchpad>/p9j_2a2/build/src /home/user/xspec/src` prints nothing. If the directory is absent, build it: `mkdir -p <scratchpad>/p9j_2a2/build && git -C /home/user/xspec archive HEAD | tar -x -C <scratchpad>/p9j_2a2/build && cp -a /home/user/xspec/node_modules <scratchpad>/p9j_2a2/build/ && npm --prefix <scratchpad>/p9j_2a2/build run build`. If it exists but fails the check or has no `dist/cli/bin.js`, never clear it: build the same way into `$(mktemp -d <scratchpad>/p9j_2a2/build.XXXXXX)` and replace this bullet's path in FIX_PLAN.md with the new one in the task's commit. Never run `npm run build` in the checkout; keep `dist/` absent there (a local self run is a run with no product installed, H-8). AGENTS.md's first bullets explain hand-staging a scratch workspace against a build.
- *Running selected product tests against the built product, a stand-in, or a certification fixture* (AGENTS.md's bullets beginning "To run a selection of product tests against one fixture executable" and "Red-checking a strengthened product test against the built product (Phase 9)"): a temporary `/home/user/xspec/test/self/zz-t9j2a2_<N>.test.ts`, copying the pattern of `<scratchpad>/p9j_2a2/patterns/zz-ra.test.ts.txt` (bin path, IDs, output file, prefix, and concurrency from environment variables; `runProductTests(binding, productTestSuite.select(ids), { concurrency })` with `{ label, command: process.execPath, prefixArgs: [...prefix, bin], requiredFiles: [bin] }`; each result's outcome and diagnosis printed through `console.info`) or, for fixtures by name, of `<scratchpad>/p9j_2a2/patterns/zz-revd-runner.test.ts.txt` (each `CERTIFICATION_FIXTURES` entry's `binding()`). Pass a stand-in's prefix as a JSON array in one variable (`T9J2A2_PREFIX='["<scratchpad>/t9j2a2_<N>/standin.mjs","<mode>"]'`, parsed with `JSON.parse`; `[]` for none). Run it alone under the namespace: `cd /home/user/xspec && T9J2A2_BIN=<bin> T9J2A2_IDS=<ids> T9J2A2_OUT=<scratch json> T9J2A2_PREFIX='[]' env -u NODE_OPTIONS unshare --map-user=1000 --map-group=1000 -- npx vitest run --config test/vitest.config.ts --project self test/self/zz-t9j2a2_<N>.test.ts --disable-console-intercept > <log> 2>&1`. Delete the runner before committing (Removals); `git status --short` must not list it. With a task's change stashed (`git stash push <paths>`, then `git stash pop`), the untracked runner stays in place and runs HEAD's modules.
- *A scratch-backed module copy* (temporary edits for red checks): copy the module to the task's scratch directory first; apply the edit with a small script asserting each anchor occurs exactly once; run; copy the saved file back and `cmp` it against the copy. Never `git checkout --` a file holding the task's uncommitted edits. A temporary edit is never committed.
- *Reading CI* (AGENTS.md's bullet beginning "Reading a CI run from this sandbox"): `gh api 'repos/modularcloud/xspec/actions/runs?branch=claude/xspec-ui-apis-4df8fa&per_page=3' --jq '.workflow_runs[] | [.id, .run_number, .head_sha[0:7], .status, .conclusion] | @tsv'` lists runs; `gh api repos/modularcloud/xspec/actions/runs/<run-id>/jobs` gives jobs and steps; the GitHub MCP `get_job_logs` tool (load it with ToolSearch; `job_id`, `return_content: false`) returns a signed log URL whose JSON-escaped ampersands must be turned into `&` (build the six-character escape from character codes, e.g. Python's `chr(92) + 'u0026'`), fetched with `curl -sS -o <file> '<url>'`. Clean a log before reading it: `sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z //; s/\x1b\[[0-9;]*m//g' <raw> > <clean>`. `python3 -I <scratchpad>/p9j_2a2/tools/analyze_suite.py <clean log> [<baseline clean log>]` lists each failing test with its error class and, given a baseline, the IDs failing in one log only. A push cancels the branch's run in progress; a job cancelled with no steps is an infrastructure event, not a verdict.
- *Waiting for CI:* wait in the foreground, never by going idle on a background monitor (a spawn that does is handed back before the result arrives). Poll with repeated foreground Bash calls, each a bounded in-process loop inside the tool's 10-minute limit, e.g. `timeout 540 bash -c 'until [ "$(gh api repos/modularcloud/xspec/actions/jobs/<job-id> --jq .status)" = completed ]; do sleep 30; done'` (a bare foreground `sleep` is blocked; a `sleep` inside `bash -c` under `timeout` is fine), repeating the call until the job completes. Task 1, the CI checkpoints the Order section marks, and the last task wait for CI; every other task pushes without waiting. A checkpoint waits for the harness-self job on its own push only (the full-suite and Windows jobs are the last task's): green, its counts and certification lines recorded in the commit message of a small follow-up commit (`sdg(phase-9): record CI's harness-self verdict at the checkpoint (FIX_PLAN Task N)`), pushed; red, the failure is diagnosed — a defect this plan's changes caused is fixed in the checkpoint task, or, if large, planned as a new task placed next in the Order section; an infrastructure event (a job cancelled with no steps) is re-run once (`gh api --method POST repos/modularcloud/xspec/actions/jobs/<job-id>/rerun`), a refusal of that reported and the line of work stopped.
- *Scratch space:* the scratchpad is shared across spawns; use a task-specific directory `<scratchpad>/t9j2a2_<N>/`. This plan's references live in `<scratchpad>/p9j_2a2/`; never edit them, but for the build directory as above. Run Python with `python3 -I`. Set every shell variable a command uses within that same command, and never write or copy through a path built from a variable that might be empty.

**Spellings.** Take every exact spelling — command lines, paths, quoted requirement text — from the TEST-SPEC.md, SPEC.md, or CERTIFICATIONS.md text the task cites or from the harness code it names, never from a review report or from this plan's paraphrase where they differ. Keep the existing em dashes (U+2014) of any title or comment you edit; never type a character as a backslash-u escape into an edit or a Bash payload; build exotic characters (U+FFFD, non-UTF-8 bytes, U+FF21, U+1F600, BOMs) from their code points or bytes in code, as the modules already do.

**Conventions for changed code.**
- *Product verdicts.* Run every test a task changes or adds against the built product, alone, before and after the change, and record each verdict in the commit message (pass, or the first line of its diagnosed failure, with the test's time). The product passes every test at HEAD, so a product failure must arise at an arm this task or an earlier task of this plan added or changed (an earlier task's commit message records where its arms fail) and must be a `HarnessAssertionError`; a failure anywhere else, a harness error, a crash, or a hang is a harness defect to fix before committing. A test failing early at an earlier task's arm hides the arms after it: where that happens, also run the new arms past it (a scratch-backed module copy skipping the earlier arm, or a stand-in correcting the earlier answer) so each new arm's own verdict is known.
- *Red checks.* Where the built product passes a new or changed arm and the test's TEST-SPEC text names a failing product that a thin output-rewriting stand-in can simulate, red-check the arm with such a stand-in (Run mechanics) and record which assertion caught it; where no cheap stand-in exists, or the product itself already fails the arm diagnosed, say so in the commit message instead.
- *Certified tests.* The in-scope sets: CONF-CORE T6.1-2, T10.4-5, T13.5-1–T13.5-5, T13.5-8; CONF-RACE T13.5-13; CONF-READERS P-10; CONF-LEFTOVER P-15; CONF-VALID T1.3-1–T1.3-6, T1.4-1, T1.4-2, T1.4-4, T2.6-1, T2.6-2, P-1; CONF-MD T3-1–T3-6, P-2, P-3; CONF-DISC T7-4, T7-5, T7-6; CONF-AVAIL T11.2-2, T11.2-4, T11.3-4, T11.4-3, T11.4-4; CONF-ORPHAN T13.4-11. A task changing one of these, a shared helper they use, or a fixture under `test/fixtures/` runs that family's certification alone first and then the whole self project. The conformer must pass every new arm within its stated scope: where it does not, bring the fixture to its CERTIFICATIONS.md entry (scope, staging constraints) — never weaken the arm; each violator must keep its expected outcome on the ground its entry names (verify with the fixture runner where the entry names the ground).
- *Staged sources (S-9).* Every `.mdx` or TypeScript source a body stages after its first product invocation, and every initial file of a workspace created after it, is a staged-source record (`stagedMdx`, `test/helpers/staged-mdx.ts`; `stagedTs`, `test/helpers/staged-ts.ts`; AGENTS.md's bullets beginning "The staged-source ledger", "The undeclared-staging guard", and "The staged-source ledger's TypeScript records"); an initial file of a body's first workspace, created before any invocation, stays a plain string judged by the workspace builder. A source TEST-SPEC declares unparseable (14.20) is declared so.
- *New registrations.* Each new test is a `defineProductTest` entry in the registry module of its TEST-SPEC section, spread into that module's exported list in canonical ID order; a new registry module gets its wrapper `test/suite/section-<…>.test.ts` (the three-line pattern of `test/suite/section-6.3.test.ts`) and its import and spread in `test/suite/registry/index.ts`. Each gets its H-7 entry in `test/suite/registry/traceability.ts`, built by the map header's construction rules (home passage; `"14"` where its body asserts a numbered condition or a stable code, rule (a)–(c); every other passage its entry asserts), else S-1 fails. A changed test's citations change only where it now asserts a passage it did not.
- *Shared helpers* a task changes keep their behavior for every other caller, or every caller is brought along in the same task and named in the commit message.
- *Hang guards.* From Task 18 on, follow S-3's design as Tasks 18–20 record it in AGENTS.md: never add a fixed span guard (a `timeoutMs`, a Vitest timeout, a trial-loop or property budget) apart from the guards it spans. Before Task 18 lands, a test whose new arms outgrow its `timeoutMs` may raise it, saying so in the commit message (Task 18 then makes every span compositional).
- *TypeScript tooling.* From Task 23 on, every type-checking, hover, and definition assertion runs under both of H-2's configurations, runtime under the CommonJS one alone, as Task 23's API provides.
- *Comments, messages, and titles.* Every doc comment, module-header note, diagnostic message, and test title a change contradicts is corrected in the same task; a strengthened test's title gains its new clause.
- *AGENTS.md* gets only build/run knowledge a later spawn needs (a recipe, a count or timing a later check relies on, a corrected fact), in the style of its bullets, never a task narrative; the self project's file and test counts in the bullet beginning "Harness self-tests and certification only" are kept current.
- *Temporary files.* Every temporary runner, stand-in, module copy, and log lives in the scratchpad or is deleted before committing; `git status --short` before each commit lists only the task's own files (and the known untracked `specs/tmp/REVIEW.md`).
- *Size.* If a task proves larger than one spawn can finish, complete, verify, and commit a self-contained part, rewrite the task's text in this file to state exactly what remains (its gap references kept), and push; never leave a half-made change uncommitted or a task's remainder unrecorded.
- *Every task ends with:* `npm run typecheck` and `npm run format:check` exiting 0; the checks the task names, with every outcome; the self project (Run mechanics) with 0 failures, its file and test counts recorded in the commit message (the previous task's commit message holds the previous counts; a task adding self-tests says how many); the certification lines at 171 PASS / 48 FAIL / 0 error / 0 hang with 0 discrepancies, the per-pair lines identical to `pairs-expected-after-task1.txt`; a commit stating honest results; and a push. The commit also removes the finished task from the Tasks section and appends its one-line summary to its bullet in the Order section. Done when the checks hold, the commit message records them, and the commit is pushed.

**Standing rulings.** Two known gaps are accepted residuals, deferred to Phase 11, recorded as AGENTS.md bullets: "Known residual 14.20 location gaps" and "Known SPEC 6.5 gap, deferred to a future SPEC revision (accepted for this run by ruling)". No task addresses them, none may be added for them, and neither is reported as a gap.

**Deleting this plan.** Only the last task deletes this file, with `git rm`, once no other task remains (`specs/tmp/.gitkeep` stays). If the permission system refuses the deletion, stop there: leave the file in place, commit nothing further for it, and report the refusal. Never move, rename, empty, or otherwise work around a refused deletion.

**Considered and not planned (do not re-raise).**
- T12.0-6 needs no task of its own: its casing list indexes arms other tests carry, all planned here (T2.1-2's `./B.XSPEC`, Task 31; T4-2's `B.XSPEC`, `NAME.XSPEC.ts`, and `.XSPEC/x`, Task 34; T4.6-3's declaration-file casings, Task 41; T6.5-4's `specs/B.MDX`, Task 51; T7-1's `XSPEC.config.ts`, Task 54; T7-2's `"XSPEC"`, Task 55; T7-6's `src/a.XSPEC.ts` and `.XSPEC/a.ts`, Task 56; T7.1-1's `specs/A.MDX` and T7.3-1's `.XSPEC` `outDir`s, Task 59; T14-5's `src/x.TSX`, Task 121); its own single-casing probe exists.
- Reviewer B's revised tests with no gap (T7-4's own body, T10.1-5, T10.2-3, T10.5-2, T10.5-4, T10.7-3, T11-6, T11.2-5, T11.3-3, T12.0-1, T12.2-2, T15-1), reviewer A's (T4.5-2, T4.5-4, T4.5-5), and reviewer C's checked-with-no-gap list (H-4, H-6–H-9, H-11, S-1, S-2, S-5's existing adapters, S-7–S-9, C-1's mechanics, C-2, E-1–E-4, P-1–P-8, P-10, P-11, P-12's revised oracle, P-13–P-15): unchanged by this plan except where a task's change reaches them as a shared helper.
- VERIFY's note that its local run took 577.89 s against AGENTS.md's ~350 s: load from parallel reviewers; nothing to record.

**Order.** Take the topmost remaining task unless told otherwise. The order honors every dependency a task's **Depends on** line names; tasks with no such line between them are independent but may share a module, so run them one after another. When a task is done, its commit removes it from the Tasks section and appends a one-line summary to its bullet here.

*The gate.*
- Task 1 (RD-G1, V): the C-1 manifest mirrors CERTIFICATIONS.md; CI's harness-self job green. Done: T13.4-5 left CONF-CORE's in-scope and VIOL-CORE-CHATTYREADS' certified sets, and T11.4-1 CONF-AVAIL's and VIOL-AVAIL-OMIT's (a909c5d); the CHATTYREADS, OMIT, and NULLMARKER headers and the registry comments that called either test certified (`section-6.1.ts`, `section-13.4.ts`, `section-11.4.ts`) corrected, no behavior changed; local self 37 files / 4455 tests passed (446.09 s); CI run 1339's harness-self job green (39 files / 4465 tests, 327.05 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.

*Assertions the revised TEST-SPEC contradicts (each can fail a conforming product), and D's T10.4-5 staging constraint.*
- Task 2 (RA-11): T4.1-3 admits a string token carrying no requirement text. Done: the string-node failure and the probe report's `kinds` removed (contract `{ seen, capped }`); the walk brought to the revised text — every value it reaches, primitives included, walked once (a primitive's own and inherited keys read through its wrapper with the primitive itself as receiver, so a string token's inherited `String.prototype` accessor is read for that token; without it such a leaking accessor passed once the ban went) and a throwing walk operation recording nothing (it had pushed bracketed marker strings); the fixture already met the distinctiveness premise, unchanged; comments, cap message, title, and AGENTS.md's T4.1-3 red-check bullet corrected; T4.1-3 passes the built product (2.96 s), string-token stand-ins pass, leaking ones fail at the leak assertion, a fresh-object getter still errors with `OpaqueWalkCapError`; local self 37 files / 4455 tests passed (442.26 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 3 (RB-1): T10.1-6's refused `create` on a stale twin refreshes nothing. Done: `assertCreateFollowsRefresh` became `assertCreateRefusedStaleStaysStale` — one whole-root compare around each stale twin's refused `create` admitting no change but H-6's lock-path exclusion, each change diagnosed by where it falls (graph data through `isGraphDataKey`, the session directory, the rest) — and its `check --json` brace `assertStaleTwinStillStale` (was `assertPerFileStalenessOfA`) now requires exactly one graph-data unit form (`.xspec`, locations [], naming `build`) beside the edited source's per-file staleness and the call site's `besideStaleness`; the module-header note, doc comments, contexts, the body's ordering comment, the title's ordering clause, and AGENTS.md's two T10.1-6 passages corrected, the call sites' labels and expectation values unchanged; T10.1-6 fails the built product diagnosed at its first stale twin's compare (`.xspec/graph.json` refreshed, 7.0 s), each later twin likewise when reached, and passes whole under the graph-data-restoring stand-in (26.3 s), whose `check` rewrites fail the brace at its own assertions; local self 37 files / 4455 tests passed (436.19 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 4 (RB-2): T10.7-9's new per-child items take their strategy's `blockedBy`, never the original's. Done: the audit arm's h.b new per-child item asserted `blockedBy` exactly `[]` (its child sections' items, h.b childless), never the original's stale `[h.a's item]`, the later re-derivation's `[]` kept; the path-blocks arm's per-child items asserted `blockedBy` `[]` and, a further correction revised (b) requires, origin `[]` (the `changed` nodes in their scopes; HEAD asserted `{g.a}`, origin over scope and context), g.a's `parent-consistency` item's origin kept `{g.a}`; title, comments, and diagnostics brought to the revised text, every other assertion of both arms consistent with it and kept; T10.7-9 fails the built product diagnosed at the path-blocks per-child origin (4.5 s) and, past it, at h.b's `blockedBy` (`["item-3"]`, 11.7 s), passes with both skipped (13.9 s) and whole under the export-correcting stand-in (14.7 s), whose injected per-child blocker fails it at the new per-child `blockedBy` assertion; local self 37 files / 4455 tests passed (431.21 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 5 (RB-3): T10.5-3 asserts no `reason`. Done: m2's `reason` check (tags and coverage named, its diagnostic quoting a 10.5 sentence SPEC.md no longer holds) removed, the only `reason` content check in T10.5-3; every context, scope, and origin assertion kept; the m2 comment and the title's m2 clause brought to the revised text (its payload's metadata pair T10.7-13's, its `reason` informational, 10.2, never asserted); H-7 entry (`"10.5"`) unchanged; T10.5-3 passes the built product before (2.81 s) and after (2.78 s), and stand-ins rewriting m2's `reason`, or every item's, to a neutral text naming neither change, which HEAD's module failed at the removed check, now pass (3.05 s, 3.22 s); local self 37 files / 4455 tests passed (435.55 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 6 (RB-4): T14-10(f) reads nothing back after `build`; its directory staged `-wx` and its file `-w-------`. Done: `stageGraphDataUnreadable` stages every file of T13.3-2's operational path set at 0o200 and then every directory of it at 0o300 (`-wx`, `stageDirectoryMode`: listing refused, creation kept, each verified on the harness), `.xspec` itself untouched, over the adapter layer's new one-walk `collectGraphDataEntries` (files and directories; `collectGraphDataFiles` now its files, behavior unchanged, its S-5 vector extended to the directories); its description, naming files alone where graph data holds no directory, quoted in every (f) label; the after-build `inventory` and the recovery `check` dropped, `build`'s exit 0 the arm's last assertion; comments and the title's (f) clause corrected; T14-10 passes the built product before (52.6 s) and after (49.1 s); a stand-in keeping a staged file's 0o200 through each write failed HEAD's module at the after-build `inventory` and passes now; stand-ins copying graph data into `.xspec/d/` or `.xspec/a/b/c/` pass, and their listing twins (a refused graph-data directory listing met as `read-failure`, exit 2), which HEAD's module passed, fail at (f)'s `inventory`; CONF-READERS alone as expected; local self 37 files / 4455 tests passed (360.55 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 7 (RB-5): T13.5-7(b)'s expected per-file set from a `build` on a restored copy of the stopped state. Done: `stalenessAgainstRebuiltCopy` (`write-refusal-staging.ts`, exported for Tasks 112 and 117) byte-copies the state into a fresh workspace through `copyTreeBytes` (moved from `section-13.5.ts` to `test/helpers/tree-copy.ts`, its four importers repointed, behavior unchanged), `.git` and the lock path left out and the copy checked against the original, builds the copy (exit 0 required), and returns `{ perFile, graphDataDiffers }`: every derived path whose occupant differs from the rebuilt copy's, absent included, and whether graph data does; (b) asserts the unit form and exactly that set, B's module and the graph-data difference as premises, the twin's derived files no longer consulted; the module header, doc comments, diagnostics, the title's (b) clause, and AGENTS.md corrected; H-7 entry unchanged; T13.5-7 passes the built product before (36.0 s) and after (38.2 s), the two sets coinciding there (B's module and companions: the twin and the rebuilt copy differ in graph data and the journal alone); a stand-in whose modules carry the journal's line count passes after (48.2 s) and fails HEAD's module at (b), whose twin set adds A's and C's modules; CONF-CORE and CONF-READERS alone as expected (106 pair lines); local self 37 files / 4455 tests passed (270.84 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 8 (RB-6): T14-9's graph-data staging over T13.3-2's operational path set, the journal, session directory, and lock path keeping their modes. Done: `stageGraphDataWriteRefusal` (`test/helpers/permissions.ts`, mode `graph-data-write-refusal`, over `collectGraphDataEntries`) makes `.xspec` and every directory of the set read-only and every file of it unwritable at exact bytes, the journal, `.xspec/reviews`, and `.xspec/lock` untouched, and verifies on the harness creation in `.xspec` and each directory, a write-open of each file, a rename into `.xspec`, and the first file's replacement and removal refused, the journal's append-open and a creation in `.xspec/reviews` granted where their own modes grant them, the lock path never probed; every graph-data write refusal takes it through `graphDataRefusal()` (`write-refusal-staging.ts`) — T13.5-7(f)'s refreshing reads, T14-9's reporter sweep, held `review create`, and failing twin, T13.5-11(a)'s re-run of (f), and T12.7-3's and T14-6's 14.24 arms — `stageWriteRefusalUnder` left to `specs/b`, `out/specs`, `specs/sub`; four self-tests added (`permission-staging.test.ts` 16 tests: the staging on a hand-made area with nested graph-data directories beside the journal, a session, and a lock entry; an area holding no graph data; E-1 on an unstaged twin, a file or directory left writable, a refused walk; non-UTF-8 and non-ASCII names), its unstageable and platform arms extended; module headers, doc comments, diagnostics, the T13.5-7, T13.5-11, T14-9, and T12.7-3 titles, and AGENTS.md corrected (under it release deletes its entry, the emptied lock directory's deletion refused); the five tests pass the built product alone before and after (T13.5-7 33.1/34.8 s, T14-9 32.8/33.1 s, T13.5-11 68.2/69.5 s, T12.7-3 3.4/3.4 s, T14-6 17.7/19.2 s); a stand-in append-opening the journal before each staged read fails HEAD's T13.5-7, T14-9, and T13.5-11 at their first `.xspec`-staged read (`.xspec/journal` concerned) and passes now, and one mirroring graph data into a non-UTF-8 directory below the area passes T14-9 and T13.5-7; CONF-CORE alone as expected (104 pair lines); local self 37 files / 4459 tests passed (273.00 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 9 (RD-G7): T10.4-5 observes the stored status through the byte-compare alone. Done: the `review list --json` step and its stored-count assertions dropped — a second ground against VIOL-CORE-PERSISTREADS (HEAD's module, its four session-file compares made before the reads ran, still failed it at the `list` count) — the four reads' byte-compares and the closing `resolve`'s byte change kept, nothing else reading the stored statuses while the stale resolution stands (the reads' answers coincide on both sides, the staleness never undone before the `resolve`); the title's `list` clause, the body comment, the module header's T10.4-5 note, and the manifest's PERSISTREADS comment brought to the entry's staging constraint, the unused `decodeSessionListReport` import dropped; H-7 entry unchanged; T10.4-5 passes the built product before (3.14 s) and after (2.75 s); against PERSISTREADS it fails at `status`'s byte-compare, and on a scratch-backed copy passes with `status`'s compare, or all four, made before the reads ran (the later reads compute no invalidation over the persisted `invalidated`, so write nothing), while skipping the `status` read, then `next`, then `show` moves the failure to `next`'s, `show`'s, then `export`'s byte-compare, never a `list` count; CONF-CORE alone as expected (104 pair lines); local self 37 files / 4459 tests passed (283.04 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.

*Certification fixtures brought to CERTIFICATIONS.md.*
- Task 10 (RD-G2): VIOL-CORE-CHATTYREADS appends at `check` alone. Done: the `chattyReads` switch gated on `check` alone (`checkInvocation`, the command word as `dispatchCommand` reads it) at its exits 0 and 1 — a `check` refused exit 2, or ending 70, appends nothing — where it had followed `build` and every read (`isBuildOrReadInvocation`, now READERENTRY's and READERS-CLAIM's alone); `CHATTY_READ_ENTRY` unchanged, its doc comment binding every journal validation the module makes (Task 12's included) to keep reading it inert; the deviation's doc comments, `bin-chattyreads.mjs`'s header, the manifest comment, and the two `section-13.5.ts` notes that tied T13.5-8's premise `build` to CHATTYREADS' passing side brought to the entry, no test's behavior changed; AGENTS.md's READERENTRY passage and P-10 note corrected, a CHATTYREADS hand-probe recipe added; the hand-probe (`t9j2a2_10/probe.mjs`) shows `build`, `ids`, `show`, `query nodes`, `coverage`, `impact --base x`, the review reads, and `review create` leaving `.xspec/journal` byte-identical (absent stays absent), `check` appending exactly one line at exit 0 (creating the file) and at exit 1, `check --bogus`, `check extra`, and `check --test-hold` (exit 2) nothing, the conformer unchanged, where HEAD's fixture appended at every `build` and read not exiting 2; T13.5-4 against CHATTYREADS fails at the held-state comparison once its first read during the hold (`check`) has exited (`changed .xspec/journal: file bytes differ` — 164 bytes, then 246; 0.6 s) and, its reads arm skipped on a scratch-backed copy, passes its `build` arm and storm, the storm's journal exclusion dropped too, where HEAD's fixture failed the `build` arm's held-state comparison (`.xspec/journal` 82 bytes, then 164); P-10 against CHATTYREADS now fails at an episode's journal accounting beside a `check` reader (was: the bracketed accounting read), CONF-READERS passing; CONF-CORE alone as expected (104 pair lines); local self 37 files / 4459 tests passed (275.33 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 11 (RD-N1): T13.5-4's storm compare excludes the lock path alone. Depends on Task 10. Done: the storm's clean-build `assertDirectoriesEqual` takes no exclusion of its own, leaving out H-6's alone — the lock path and everything under it, which the snapshot compare's across-directory `lockPathExclusion` applies, as the module's other twin compares rely on — so the journal is compared; `excludeJournalFile` deleted; the compare's inline comment and message, the module header's T13.5-4 note (now naming §VIOL-CORE-CHATTYREADS' constraint: no `check` on the `build` arm's or the storm's workspaces or the twins they compare against), and the title's storm clause corrected; H-7 entry unchanged; T13.5-4 passes the built product before (7.7 s) and after (7.3 s); a stand-in creating an empty `.xspec/journal` once the storm workspace's final `build` has exited passes HEAD's module and fails the new one at the storm compare (`removed .xspec/journal`), where one creating it at a `query`'s exit failed HEAD's too, at `graph.json`'s `journalHash`; with the fixture runner T13.5-4 fails READERENTRY at the reads arm's count half (2 entries) and BUILDWAIT at the `build` arm's 15 s bound, as before, CHATTYREADS and EARLYWRITE at the reads arm's byte half, the conformer passing; with the reads and `build` arms skipped on a scratch-backed copy all 13 CORE fixtures pass the storm; CONF-CORE alone as expected (104 pair lines); local self 37 files / 4459 tests passed (285.82 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 12 (RD-G3): the CONF-CORE conformer meets a journal error as condition 13 — `build`, the gate, the precondition, and a given baseline's resolution. Done: `check`'s 14.13 judgement over `readJournal` became `journalFindings` (a journal path holding anything but a plain file one finding, each line that is no `rename`/`move` entry one naming its line, every finding `path` `.xspec/journal`, `locations` `[]`), one of `loadGraph`'s validations, so `build`, the gate of every gated read and mutating `review` subcommand, and `rename`/`move`'s precondition (`rename --preview`'s too) report it beside any source finding, exit 1, writing nothing; `check` makes it itself (`judgeJournal: false`) beside staleness and sessions, and now beside the source findings where those fail; `resolveBaseline`, shared by `review create --base` (in `judgeArguments`, past acquisition and the hold) and `impact --base` (past discovery), reads the current journal first — a journal error the exit-2 error document's `code` `journal-error`, `path` `.xspec/journal`, `locations` `[]`, one error naming every offending line, otherwise the code-less unreadable baseline; `CHATTY_READ_ENTRY` stays an entry, never reported; the module header, `UsageError`'s, `loadGraph`'s, `CODE_TOKENS`', `runMutating`'s, the gated-read, gate, precondition, and baseline comments, `CHATTY_READ_ENTRY`'s doc, and LATEHOLD's two comments and `bin-latehold.mjs`'s header (its journal read included; the arm count left to Task 118) brought to the change; AGENTS.md's CONF-CORE hand-probing bullet gained the validation and the probe's recipe; the hand-probe (`t9j2a2_12/probe.mjs`) on a built CORE workspace with session `s` and a garbage line appended: `build`, `ids`, `show`, `query nodes`, `coverage`, the five review reads, `review create --strategy audit --name n` (no `n.json`), `review resolve`, `review split`, `rename specs/A.mdx a b` and `move specs/A.mdx specs/C.mdx` (sources and journal byte-identical), and `rename --preview` each exit 1 with exactly the condition-13 finding (line 1), nothing changed, where HEAD's conformer answered, created `n.json`, rewrote `s.json` at `resolve` and `split`, and performed the rename and move; `review create --base nope --name n --json` and `impact --base HEAD --json` exit 2 with `journal-error` at `.xspec/journal` (HEAD: `code` `null`), stdout empty without `--json`, the standard-error message naming the code and path; `check --json` still reports it; `review create --coverage nope` and `rename specs/A.mdx nope x` still exit 2 `code` `null`, ahead of the gate, and `review resolve s nope` now exits 1 at the gate, the item check past it; line 2 named after a `rename`'s entry, two findings for two garbage lines (one exit-2 error naming both), both findings beside a BOM-led `specs/B.mdx` (`journal-error` first), and the journal path a directory or a link the journal error at `build`, `ids`, and the baseline; under `--test-hold` the journal-staged `--base` creates the hold file first, the workspace unchanged while held, and exits 2 with `journal-error` after its deletion, `.xspec/lock` gone (the gate's and the precondition's exit 1 likewise for `review create --strategy audit` and `rename`); beside a held `review resolve` each acquisition-first command is `workspace-busy`, and with `.xspec/lock` a link `write-failure`, the holder exiting 1 at the gate after the lift; on a CHATTYREADS-appended journal `build`, `ids`, `check`, and `review status` report nothing, `review create --base` stays code-less, and `rename` performs; no product test changed; CONF-CORE alone as expected (104 pair lines, 128.86 s); the fixture runner over the CORE in-scope set before and after the change: 103 of 104 first diagnosis lines identical, PARTIALWRITE's T13.5-5 observation index alone differing (#22, #23; the same partial-file ground); local self 37 files / 4459 tests passed (272.33 s); certification 171 PASS / 48 FAIL / 0 / 0, 0 discrepancies, the per-pair lines as expected.
- Task 13 (RD-G4): the CONF-CORE conformer refreshes only past 10.7's outcomes.
- Task 14 (RD-G5): VIOL-CORE-EARLYREFRESH refreshes early only where the run reaches its session write. Depends on Task 13.
- Task 15 (RD-G6): the CONF-AVAIL conformer's cycles run over contains edges too.
- Task 16 (RD-G8, RD-G9, RD-G10): the CONF-CORE audit `split` per SPEC 10.7.
- Task 17 (RD-G11 and D's two related rules): the CONF-CORE audit `resolve` and re-derivation per SPEC 10.4, 10.5, 10.7. Depends on Task 16. CI checkpoint.

*Harness infrastructure.*
- Task 18 (RC-3): S-3 — every span guard compositional over the guards it spans, or none.
- Task 19 (RC-3): S-3 — per-invocation and harness-step guards; waits beside invocations end with them. Depends on Task 18.
- Task 20 (RC-3): S-3's pre-product checks. Depends on Tasks 18–19.
- Task 21 (RC-4): H-1's ancestor precondition, one shared check, on every arm that needs it.
- Task 22 (RB's shared infrastructure): mode-000 directory stagings and runs from a working directory entered before its permissions went. CI checkpoint.
- Task 23 (RC-1, RC-2): H-2's two fixed TypeScript configurations in the tooling driver; S-4's per-configuration probes.
- Task 24 (RC-1): §1–§2 consumers under both configurations. Depends on Task 23.
- Task 25 (RC-1): §4 consumers under both configurations. Depends on Task 23.
- Task 26 (RB-74, RC-1): T13.1-2 under both configurations. Depends on Task 23.
- Task 27 (RC-1): §6.5 and §14 consumers under both configurations; the NodeNext defaults removed. Depends on Tasks 23–26.
- Task 28 (RC-8, part): H-3's human-report adapter — the findings report and the exit-2 standard-error message, non-UTF-8 marking included; S-5 vectors. CI checkpoint.

*§1–§6.*
- Task 29 (RA-1): T1.5-2's code-group arms and located arm.
- Task 30 (RA-2): T1.7-2's property-member unit ranges.
- Task 31 (RA-3, RA-4): T2.1-2's `**`, case, and re-entering arms; T2.1-3's colliding-identifier chain.
- Task 32 (RA-5): T2.4-2's numeric-literal and parenthesized index arms.
- Task 33 (RA-6): T2.5-2's excluded-as-a-target-only arm.
- Task 34 (RA-7): T4-2's re-entering, `**`, and case arms.
- Task 35 (RA-8, RA-9): T4-4's mixed combination; T4-5's value-level pairings.
- Task 36 (RA-10): T4.1-1's built-in-member segments. Depends on Task 25.
- Task 37 (RA-12): T4.2-3's truncation with escaping. Depends on Task 25.
- Task 38 (RA-13): T4.3-2's further dynamic arguments, two-argument `check`, cross-module call.
- Task 39 (RA-14): T4.5-3's numeric-literal, parenthesized-chain, and parenthesized-index markers.
- Task 40 (RA-15): T4.5-8's type-only side.
- Task 41 (RA-16): T4.6-3's object-literal, named-expression, wrapper, namespace, and declaration-file arms.
- Task 42 (RA-17): T4.6-4's declaration-merging arms.
- Task 43 (RA-18, RA-19): T5.5-5's tie-break arm; T5.5-7 registered.
- Task 44 (RA-20): T5.7-4's type-only `text` call and value-level collision chain.
- Task 45 (RA-21): T6.1-3 at `build` and a gated `ids`, form-exact.
- Task 46 (RA-22, RA-23): T6.3-3's intermediate baseline; T6.3-4's revised failure matrix.
- Task 47 (RA-24, part): T6.3-6 registered — arms (a), (b)'s first two stagings, (d). Depends on Tasks 21, 28, 46.
- Task 48 (RA-24, rest): T6.3-6's arms (c), (e), and (b)'s refused-discovery staging. Depends on Tasks 22, 47.
- Task 49 (RA-25, RA-26): T6.4-1's twice-spelled reference; T6.4-4's would-be bearers.
- Task 50 (RA-27): T6.4-6's refused-writes precondition.
- Task 51 (RA-28, RA-29, RA-30): T6.5-2's `/ >` parent; T6.5-3's twice-spelled last reference; T6.5-4's `specs/B.MDX`.
- Task 52 (RA-31): T6.5-16(g)'s twice-spelled embedding.
- Task 53 (RA-33): T6.6-4(a)'s one reference spelled twice. CI checkpoint.

*§7–§8.*
- Task 54 (RB-24, RC-7): T7-1's `XSPEC.config.ts` probe, rerun on the Windows leg (E-6) and listed for S-7. Depends on Task 21.
- Task 55 (RB-25, RB-26): T7-2's new form arms; T7-3's code-group names.
- Task 56 (RB-27): T7-6's extension twin and casing arms (certified, CONF-DISC).
- Task 57 (RB-7): T7-7 registered.
- Task 58 (RB-8): T7-8 registered.
- Task 59 (RB-28, RB-29): T7.1-1's `specs/A.MDX`; T7.3-1's wrong-type literals and `.XSPEC` `outDir`s.
- Task 60 (RB-30, RB-31, RB-32): T7.5-1's selector globs; T7.5-2's twice-spelled edge; T7.5-4's `./src/*.ts` selector.
- Task 61 (RB-9): T8.1-1 registered, split out of T8-5. CI checkpoint.

*§10.*
- Task 62 (RB-17): T10.7-14 registered — the refusal finding form, a shared check.
- Task 63 (RB-16): T10.7-13 registered — the metadata pair.
- Task 64 (RB-33): T10.1-4's missing-`kind` arm and re-inserted decomposed original; the session adapter's re-insert operation.
- Task 65 (RB-34): T10.1-6's absent-directory, corrupt-beside, linked-journal, inventory, and baseline arms. Depends on Task 3.
- Task 66 (RB-35, RB-38): T10.2-1's item-ID form; T10.3-2's refusal in T10.7-14's form. Depends on Task 62.
- Task 67 (RB-39): T10.4-2's journal-deletion arm.
- Task 68 (RB-40): T10.4-3's K1/K2 fixture.
- Task 69 (RB-41): T10.4-4's decomposition arm.
- Task 70 (RB-10): T10.4-6 registered.
- Task 71 (RB-11): T10.4-7 registered.
- Task 72 (RB-42): T10.5-1's origin arms.
- Task 73 (RB-43): T10.5-3's current-graph, origin-counting, and one-item-per-location arms. Depends on Tasks 5, 63.
- Task 74 (RB-44): T10.5-5's matching, kept-`blockedBy`, skipping, revert, and decomposition arms. Depends on Task 62.
- Task 75 (RB-13): T10.5-7 registered.
- Task 76 (RB-14): T10.5-8 registered.
- Task 77 (RB-15): T10.5-9 registered.
- Task 78 (RB-36, RB-37): T10.2-2's re-derivation entries; T10.2-4's re-derived `current`. Depends on Tasks 71, 74, 76.
- Task 79 (RB-45): T10.6-3's leaf-parent arm and new item's `current`.
- Task 80 (RB-46): T10.7-1's case-insensitive corrupt-name arms and strategy values. Depends on Task 62.
- Task 81 (RB-47): T10.7-7's full-resolution arm. Depends on Task 63.
- Task 82 (RB-48, part): T10.7-9's path-blocks fixture — arms (a), (b), (c), (f), (g). Depends on Tasks 4, 62.
- Task 83 (RB-48, rest): T10.7-9's audit fixture — arms (a)–(e) — and its refusals. Depends on Task 82.
- Task 84 (RB-12): T10.4-8 registered. Depends on Tasks 74, 83.
- Task 85 (RB-49, RB-50): T10.7-10's note replacement; T10.7-11's kept note. Depends on Task 62.
- Task 86 (RB-51): T10.7-12's property-member locations, split context texts, joined origin pair, and provenance arms. Depends on Task 71.
- Task 87 (RB-18, part): T10.7-15 registered — fixtures A and B, arms (a) and (b). Depends on Tasks 8, 62.
- Task 88 (RB-18, part): T10.7-15's arms (c) and (d). Depends on Task 87.
- Task 89 (RB-18, rest): T10.7-15's arms (e), (f), and (g). Depends on Task 88. CI checkpoint.

*§11.*
- Task 90 (RB-52, RB-57): T11-2's row and `--file` arms; T11.3-2's `**/../x/*.mdx`.
- Task 91 (RB-53): T11.2-2's structural-validity chain arm (certified, CONF-AVAIL).
- Task 92 (RB-54): T11.2-3's target-side arm.
- Task 93 (RB-55): T11.2-4's own-versus-subtree arm (certified, CONF-AVAIL). Depends on Task 15.
- Task 94 (RB-56): T11.2-6's passing-side and mode-000 `out` arms. Depends on Task 22.
- Task 95 (RB-19): T11.2-7 registered.
- Task 96 (RB-58, RB-59): T11.4-1's multi-file order; T11.4-2's `**/../x/*.mdx` and byte-ordered operands.
- Task 97 (RB-60): T11.4-4's two-clause binding names (certified, CONF-AVAIL).
- Task 98 (RB-61, RB-62): T11.5-2's offset spellings; T11.5-3's unparseable-file offset bound.
- Task 99 (RB-63, RB-64): T11.6-1's journal path; T11.6-2's `files` selector forms.
- Task 100 (RB-65): T11.6-3's plain-file and link `.xspec`, and its order fixture.
- Task 101 (RB-66): T11.6-4's passing workspace beside a policy violation and a corrupt session. Depends on Task 94. CI checkpoint.

*§12.*
- Task 102 (RB-67): T12.0-5's `move` from `specs/`.
- Task 103 (RB-68, part): T12.0-10's unknown coverage, spelled-but-not-defined IDs, synopsis mismatches, and malformed `--to`.
- Task 104 (RB-68, rest): T12.0-10's code-unit masking, unmasked kind check, and review subcommands past the gate. Depends on Task 64.
- Task 105 (RB-69, RB-70): T12.0-13's `rename specs/a#b.mdx`; T12.0-14's leading `--json`.
- Task 106 (RB-21, part): T12.0-16 registered — its fixture, arms (a)–(c).
- Task 107 (RB-21, rest): T12.0-16's arms (d)–(f). Depends on Task 106.
- Task 108 (RB-71): T12.3-1's entry arms and `**/../x/*.mdx`.
- Task 109 (RB-72, RB-73): T12.7-1's review refusal form; T12.7-3's journal-error document and stdout without `--json`. Depends on Tasks 21, 47, 62. CI checkpoint.

*§13.*
- Task 110 (RB-75, RB-76): T13.3-2's `review list` in the sweep; T13.3-3's stale twins.
- Task 111 (RB-22, part): T13.3-5 registered — arm (a). Depends on Tasks 18, 20.
- Task 112 (RB-22, rest): T13.3-5's arms (b) and (c). Depends on Tasks 7, 111.
- Task 113 (RB-77): T13.4-5's three-session identity arm. Depends on Task 69.
- Task 114 (RB-23, part): T13.4-13 registered — arms (a)–(d).
- Task 115 (RB-23, rest): T13.4-13's arms (e)–(i). Depends on Task 114.
- Task 116 (RB-78, part): T13.5-7's rename stopped at a Markdown write; (f)'s prior-or-twin rule. Depends on Tasks 7, 8.
- Task 117 (RB-78, rest): T13.5-7's arms (g) and (h). Depends on Task 116.
- Task 118 (RB-79): T13.5-8's garbage-journal arms (certified, CONF-CORE). Depends on Tasks 12, 21. CI checkpoint.

*§14.*
- Task 119 (RB-80): T14-1's journal and obstruction pairs.
- Task 120 (RB-81): T14-4's baseline journal error; no answer beside 14.12 and 14.21. Depends on Tasks 47, 94.
- Task 121 (RB-82, RB-83): T14-5's `src/x.TSX`; T14-6's baseline code and refusal form. Depends on Tasks 47, 62.
- Task 122 (RB-84): T14-7's twice-spelled cycle arms.
- Task 123 (RA-32): T6.6-3's preview twins of T14-7's stagings and of the new refusal arms. Depends on Tasks 50, 51, 52, 122.
- Task 124 (RB-85): T14-8's twice-spelled cross-file cycles.
- Task 125 (RB-86): T14-9's baseline arms on the unwritable area; its contract rows. Depends on Tasks 8, 48, 117.
- Task 126 (RB-87, part): T14-10's arms (b), (f)'s `.xspec` `-wx`, (h), and (j). Depends on Tasks 6, 48.
- Task 127 (RB-87, rest): T14-10's arms (k) and (l)(i)–(iii). Depends on Tasks 21, 22, 126.
- Task 128 (RB-88): T14-11's container, call, chain, and parenthesized locations. CI checkpoint.

*Human forms.*
- Task 129 (RA-34): T6.6-7 registered — the preview decoder. Depends on Tasks 28, 123.
- Task 130 (RB-20, RC-8, part): T12.0-15 registered — `build`, `check`, and the gated reads; non-UTF-8 marking. Depends on Tasks 28, 29, 110, 128.
- Task 131 (RB-20, part): T12.0-15's `rename` and `move` reports. Depends on Tasks 49, 50, 51, 52, 122, 129, 130.
- Task 132 (RB-20, part): T12.0-15's `impact` reports. Depends on Task 130.
- Task 133 (RB-20, part): T12.0-15's `review` reports. Depends on Tasks 64, 80, 81, 83, 85, 130.
- Task 134 (RB-20, part): T12.0-15's `coverage`, `ids`, and `show` reports. Depends on Tasks 108, 130.
- Task 135 (RB-20, rest): T12.0-15's exit-2 errors. Depends on Tasks 48, 109, 125, 127, 130. CI checkpoint.

*§16.*
- Task 136 (RC-5): P-9's two new invariants.
- Task 137 (RC-6, part): the path-blocks generation oracle and its S-6 vectors.
- Task 138 (RC-6, rest): P-16 registered. Depends on Task 137.

*The end.*
- Task 139: confirm locally and in CI; record the timings; delete this plan.

## Tasks

### Task 13 — The CONF-CORE conformer refreshes only past 10.7's outcomes (RD-G4)

**Gap.** CERTIFICATIONS.md §CONF-CORE Scope: on a stale workspace whose sources are valid, the 13.3 refresh a mutating `review` subcommand performs comes "after the hold, past every outcome 10.7 orders before it, and before its session write" (SPEC 10.7: stale graph data stays stale). Reviewer D, on a stale valid workspace: `review resolve s nope --status skipped` exits 2 and `review create --strategy audit --name s` (an existing name) exits 1, each rewriting `.xspec/graph.json`. Cause: `proceed` (inside `runMutating`, about line 3634) calls `refreshAfterHold` before `operate`'s session read, existing-name refusal, item check, and blocked/split refusals.

**Change** (`test/fixtures/conf-core/product.mjs`): move the refresh so it runs only once every 10.7 outcome has passed — the session read (corruption), the existing-name refusal and `create`'s session-directory examination, the unknown item ID, the recorded baseline, `resolve`'s blocked refusal, `split`'s other-kind and childless refusals — and just before the session write; a run any of them turns back refreshes nothing. EARLYWRITE and LATEHOLD share this path and inherit the order ("having written nothing" on a refused run). Comments where they describe the refresh's place.

**Checks.** CONF-CORE family alone: lines unchanged (T13.5-1's stale-workspace arm still sees the refresh after the hold for a `create` that succeeds; EARLYREFRESH still fails T13.5-1). Hand-probe D's repro on a stale copy: both refused runs leave `.xspec/graph.json` byte-identical; a successful `review create --strategy audit --name n` on a stale copy refreshes it to the bytes `build` writes on a twin.

### Task 14 — VIOL-CORE-EARLYREFRESH refreshes early only where the run reaches its session write (RD-G5)

**Depends on.** Task 13.

**Gap.** CERTIFICATIONS.md §VIOL-CORE-EARLYREFRESH, Deviation: the refresh runs before exclusivity is acquired "wherever the subcommand's later checks, judged on the workspace as it stands then, let it reach its session write; a run they turn back refreshes nothing, early or late, as the conformer's does (10.7: stale graph data stays stale)". Reviewer D: `bin-earlyrefresh.mjs review create --base x --name n` exits 2 on a stale workspace having already rewritten graph data.

**Change** (`test/fixtures/conf-core/product.mjs`, the `refreshBeforeExclusivity` path): before acquiring, judge the run's later steps against the workspace as it stands — the argument checks (12.0), baseline resolution, the gate, and 10.7's outcomes — and refresh early only when all of them pass; otherwise refresh nothing, the run then meeting its outcome after acquisition and the hold as the conformer does. The violator's header and comments state the entry's wording.

**Checks.** CONF-CORE family alone: EARLYREFRESH still fails T13.5-1 alone, at its stale-workspace arm's while-held compare (fixture runner: record the first line), and passes every other in-scope test. Hand-probe: the repro above leaves graph data byte-identical; a valid `review create --strategy audit --name n --test-hold <path>` on a stale copy has graph data refreshed while held.

### Task 15 — The CONF-AVAIL conformer's cycles run over contains edges too (RD-G6)

**Gap.** CERTIFICATIONS.md §CONF-AVAIL Scope: "own and subtree text judged apart (T11.2-4)" and findings with stable codes for the staged conditions — 14.9 among them (SPEC 5.3: cycles over contains, depends, and embeds). On T11.2-4's arm in which `p.c` holds `{text("p")}` (Task 93 stages it), `view --text` on the conformer answers `"findings":[]` (the texts poisoned correctly, exit 1). Cause: the cycle pass in `test/fixtures/conf-avail/product.mjs` (from about line 1977) uses reference edges only.

**Change** (`test/fixtures/conf-avail/product.mjs`): the cycle graph adds contains edges (parent to child), so a section embedding or depending on its own ancestor reports one condition-9 finding locating its spelling (14.9's location rule as SPEC 14 states it); the violators inherit it. Comments.

**Checks.** CONF-AVAIL family alone: lines unchanged. Hand-probe: a scratch workspace in T11.2-4's shape (`p` with child `p.c` holding `{text("p")}`, and separately `{text("missing")}`): `view --text --json` on the conformer reports exactly the condition-9 finding for the first (exit 1) and the 14.6 for the second, the texts as before; NULLMARKER, OMIT, and NOFILE the same findings.

### Task 16 — The CONF-CORE audit `split` per SPEC 10.7 (RD-G8, RD-G9, RD-G10)

**Gap.** CERTIFICATIONS.md §CONF-CORE Scope — "`review` with the `audit` strategy (10.6) through `create`, `resolve`, `split`, and the read subcommands"; CONF-RACE, CONF-READERS, and CONF-LEFTOVER run the same product. Against the revised SPEC 10.5/10.7, reviewer D found in `test/fixtures/conf-core/product.mjs`:
- G8: `split`'s new per-child item inherits the original item's blockers (about line 4826). Repro: `a` > `a.b`, session `s`; add `a.c`; build; `review split s i2`: the new `a.c` item has `blockedBy` `["i3"]` and shows blocked. SPEC: in an audit session a per-child item is blocked by its own child sections' items — here by nothing.
- G9: `split` recreates an item whose kind and scope node are already recorded as decomposed. Repro: `a` > `a.b` > `a.b.c`; `review split s i3`, then `review split s i2`: a new `subtree-coherence` item for `#a.b` appears. SPEC 10.7: its decomposition applies instead, recursively, standing in for it in `blockedBy` (SPEC 10.1 now treats such an item as corruption).
- G10: `split` does not end with a re-derivation. Repro: add a top-level `z` after `create`, then split: no item for `#z` until a later `updated` resolve. SPEC 10.7/10.5: re-derivation "with which `split` ends".

**Change** (`reviewSplit`, about line 4737, and `rederive`, about line 4678): a per-child item's `blockedBy` is its child sections' items (audit); a per-child item whose kind and scope node are recorded as decomposed is not created — its decomposition applies, recursively, its items standing in for it, in the `parent-consistency` item's `blockedBy` too; every item outside the decomposition blocked by the original becomes blocked by all items of the decomposition; a decomposition item whose kind and scope node already exist is that item, reused (its `id`, status, note, and recorded state kept, taking the decomposition's scope, context, origin, `reason`, and `blockedBy`); `split` ends with a re-derivation (10.5). Read SPEC 10.5 and 10.7 in full before changing them; implement the simplest behavior that conforms within the scope. Comments.

**Checks.** The CORE, RACE, READERS, and LEFTOVER families alone, then the whole self project: lines unchanged. Hand-probe D's three repros on scratch workspaces: each now behaves as SPEC states (record the `export --json` items before and after).

### Task 17 — The CONF-CORE audit `resolve` and re-derivation per SPEC 10.4, 10.5, 10.7 (RD-G11 and D's two related rules)

**Depends on.** Task 16 (same functions).

**Gap.** CERTIFICATIONS.md §CONF-CORE Scope, as for Task 16. Reviewer D: G11 — `resolve` keeps an earlier note (about line 4652): resolve with `--note "first note"`, then again without `--note`; `export` still shows "first note" (SPEC 10.7: `resolve` sets the note to the `--note` text, removing any earlier note when `--note` is not given). And two related rules D could not observe but asked to bring into line: items a re-derivation keeps take the re-derivation's (or the decomposition's) scope, context, origin, `reason`, and `blockedBy` (10.5); and an `updated` resolve records its state after the re-derivation it triggers, against the item as re-derived (10.4).

**Change** (`reviewResolve`, about line 4626, and `rederive`): replace the note on every resolve (none when `--note` is absent); kept items take the generated fields; an `updated` resolve assigns and records once its re-derivation is done. Comments.

**Checks.** CORE, RACE, READERS, LEFTOVER families alone, then the whole self project: lines unchanged. Hand-probe G11's repro: the second resolve leaves no note in `show --json` and `export --json`. For the two related rules, a scratch audit session: an `updated` resolve after a child is added records the item's state including the child (its next `status` reads `updated`, not `invalidated`).

### Task 18 — S-3: every span guard compositional over the guards it spans, or none (RC-3)

**Gap.** TEST-SPEC S-3 (revised), with H-10, E-5, and §16's opening paragraph: "A guard spanning several invocations — a test's, a trial's, a property's, or a held run's across the invocations the harness drives during its hold — is compositional: never less than the sum of the own guards of the invocations and harness steps it spans, whatever the span's length — P-12's and T11.5-1's every-offset sweeps, P-10, P-11, P-14, and T13.5-13's trial loops included …; a span guard fixed apart from what it spans, or scaled below that bound, is a harness defect however far a given product's runs fall below it, and a span may carry none beyond those own guards. A span whose count is known only once staged — following from what the product writes, as T13.3-5(a)'s trials over the files it writes under `.xspec/` and the stagings one per companion path `recorded` lists (T6.5-20(a), (c), (e), T13.4-9(e)), or from how a failure shrinks, as a property's shrink phase … — derives any guard it carries from its invocations and steps as it stages them, never fixing one in advance. … Time limits the CI service imposes on a job or runner (E-1) are no guards of the harness and lie outside this rule; every limit the harness sets, a test framework's per-test or per-file timeout included, is a guard held to it. A tripped guard is a failure that ends its test — a property's reported with its seed (H-10), unshrunk." Observed (reviewer C): `DEFAULT_PRODUCT_TEST_TIMEOUT_MS = 120_000` (`test/helpers/registry.ts`, line 49) is every product test's Vitest timeout (`test/suite/declare.ts`) and the certification runner's watchdog (`test/self/certification-runner.ts`, `runOne`); about 101 registry entries override it with fixed constants (`timeoutMs:`); `test/self/certification.test.ts` fixes `RUN_TIMEOUT_MS = 600_000` per verification; the Windows leg's tests use the 120-s default (`test/windows/e6-subset.test.ts`, `e6-drive-mismatch.test.ts`) and fixed held-run budgets (`E6_HELD_RUN_TIMEOUT_MS`, `test/helpers/e6.ts`; `WINDOWS_HELD_RUN_TIMEOUT_MS`, `test/helpers/e6-exclusion.ts`); T6.1-1 stages about 34 invocations (a bound of at least 1,020 s at the 30-s invocation default) under 120 s; P-12 makes 1,339 `at` calls under a fixed 600 s (`section-16-p12.ts`, about line 869); `checkProperty`'s shrink phase runs inside the fixed per-test timeout (`test/helpers/property.ts`); self-tests that span stand-in invocations (the S-7 sweep, certification, S-8, the property self-tests) carry fixed Vitest timeouts.

**Design** (record the one chosen in AGENTS.md as a new bullet, "Hang guards (TEST-SPEC S-3)", which Tasks 19–20 and every later task follow). The conservative choice, which S-3 explicitly admits ("a span may carry none beyond those own guards"): spans carry no guard of their own. A test, trial loop, property, shrink phase, held run, certification verification, and sweep is then bounded by the own guards of the invocations and harness steps inside it (Task 19 completes those); Vitest 4.1.10 applies no timer when a test's timeout is `≤ 0` or `Infinity` (`withTimeout` in `node_modules/@vitest/runner/dist/chunk-artifact.js`), so a span with no guard is a Vitest timeout of `0`. The alternative — a span deadline that grows by each invocation's and step's own guard as the span stages it — is acceptable if the Engineer prefers it, provided it is compositional by construction for fixed and staged-only counts alike. Either way, a tripped invocation or step guard still ends its test at once (a property's with its seed, unshrunk).

**Change** (under the conservative design):
- `test/helpers/registry.ts`: no default span budget; `ProductTestSpec.timeoutMs` and every registry override removed (or, under the alternative, replaced by the derived deadline); `ProductTestEntry` carries whatever the chosen design needs. `test/suite/declare.ts` declares each entry with no Vitest timeout (`0`). `test/self/certification-runner.ts`'s watchdog: none beyond the invocations' own guards (its `testTimeoutMs` option and its HANG classification kept only if they remain compositional — e.g. a hang now surfaces as an invocation's diagnosed timeout or a step guard's harness error; update `certification-runner.test.ts` to the new contract); `test/self/certification.test.ts`'s `RUN_TIMEOUT_MS` likewise.
- Every fixed span budget elsewhere: trial-loop and property budgets (`test/helpers/property.ts`'s shrink phase among them; P-10's, P-11's, P-12's, P-14's, P-15's, T13.5-13's trial loops; T11.5-1's every-offset sweep), held-run spans (`E6_HELD_RUN_TIMEOUT_MS`, `WINDOWS_HELD_RUN_TIMEOUT_MS`), the Windows leg's per-test timeouts, and the self project's Vitest timeouts on tests that span invocations (search `timeout:` and `timeoutMs` across `test/`).
- Keep every per-invocation guard as it is (Task 19 sizes them).
- Comments: `registry.ts`'s header and `DEFAULT_PRODUCT_TEST_TIMEOUT_MS`'s doc comment, `declare.ts`, the runner's header, and every module comment that cites a fixed span budget (P-12's "600 s" among them).

**Checks.**
- The self project, the certification family by family where its timing changes: lines unchanged, no HANG, no ERROR.
- The suite's longest tests against the built product, each alone under the namespace (T6.1-1, P-12, P-10, P-11, P-14, T13.5-13, T14-7): each passes as at HEAD, its time recorded (none may now be cut short by a span guard).
- The Windows leg cannot run locally: typecheck covers its files; its verdict is the last task's CI check.
- `grep -rn "timeoutMs:\|timeout: [0-9]" test/` lists no span guard but those the chosen design derives (per-invocation guards excepted); record the grep in the commit message.

### Task 19 — S-3: per-invocation and harness-step guards; waits beside invocations end with them (RC-3)

**Depends on.** Task 18.

**Gap.** TEST-SPEC S-3: "Every product invocation carries its own guard, sized to the work that invocation stages, its inputs' scale included (P-8's nesting floor, H-11), with generous margin for the loaded local and CI runs E-5 covers … Each step of the harness's own work between invocations — staging, decoding, evaluation — carries a guard of its own likewise, sized to the work it stages, answers at H-11's scale included, with the same margin, its tripping a harness defect (H-11), never a product failure. … A wait or loop the harness runs only beside given invocations, its iteration count following from their timing alone — awaiting a product event, as a hold file's appearance or each run's exit (T13.5-13), confirming readers still run before a mutating command starts (P-10), T13.5-5's polling during repeated builds, or P-14's flips while reads run — ends at the latest once those invocations have all exited, so it counts as one harness step under their own guards, never as a span whose count must be fixed or derived, and any guard it carries is no less than the compositional bound over those invocations." Observed (reviewer C): harness steps carry no guards; `waitForFile` defaults to 10 s (`DEFAULT_WAIT_FOR_FILE_TIMEOUT_MS`, `test/helpers/subprocess.ts`, line 171), shorter than the 30-s run it waits on, and is used at `test/helpers/lock-staging.ts` (about line 1230), `section-12.0-i.ts` (about 1828), `section-12.0-ii.ts` (about 1632), `section-13.5-ii.ts` (about 2982), and `write-refusal-staging.ts` (about 166); P-10's `holdsOrExits` (`section-16-p10.ts`, about line 797) fails the product after a fixed 10 s.

**Change.**
- Per-invocation guards: review `DEFAULT_TIMEOUT_MS` (30 s) and every per-invocation override against the work each invocation stages (H-11's scales: P-8's nesting floor, S-8's answer scale, P-11's fuzz); raise any that a loaded CI run could approach, with generous margin; record the sizing rule in the AGENTS.md bullet Task 18 wrote.
- Harness-step guards: a guard helper for the harness's own work between invocations (staging, decoding, evaluation), sized to the work it stages (answers at H-11's scale included), whose tripping raises a harness error (H-11) — never a `HarnessAssertionError` — applied to the steps whose work can grow with input (workspace staging and copying, git scripting, snapshotting, document decoding and walking, oracle evaluation, property generation). Where a step is synchronous and cannot be interrupted in-process, state in the helper's doc comment how its guard is enforced (e.g. bounded construction, chunked async evaluation, or a worker), and choose the conservative option.
- Waits beside invocations: `waitForFile` ends as soon as the run it waits beside exits (it already rejects then) and carries no fixed timeout below the bound over that run — its own guard (pass the run's guard, or none beyond it); the same for every such wait: P-10's `holdsOrExits` and its reader confirmation, T13.5-5's polling, P-14's flips, T13.5-13's hold-file and exit waits, the lock-staging and hold-file waits at the call sites above. `test/self/s3-subprocess-driver.test.ts`'s `waitForFile` tests updated to the new contract (a live child that never creates the file is now bounded by the child's own guard).
- Comments and AGENTS.md as above.

**Checks.** The self project (P-10's certification under CONF-READERS unchanged: CLAIM still fails P-10 at the refusal, record the first line). P-10, T13.5-5, T13.5-13, P-14, and the tests at the five `waitForFile` call sites against the built product, each alone: verdicts unchanged.

### Task 20 — S-3's pre-product checks (RC-3)

**Depends on.** Tasks 18–19.

**Gap.** TEST-SPEC S-3: "guard sizing is harness behavior certification cannot exercise, so the rule is checked before any product exists (H-8): against the stand-in, a span of stand-in invocations, each taking a fixed, substantial delay, passes at a length whose total delay exceeds one invocation's own guard, while a single stand-in invocation that never terminates fails as a hang, ending its test within its own guard; for every span the suite stages — each test, trial loop, and property at the fixed seeds (E-5) — whose count its staging fixes, the most invocations and harness steps it can stage counted from its staging alone, generators run and no product driven, each wait or loop beside given invocations counted as one step and any guard it carries checked against the bound over those invocations, the guard the harness applies is no less than the compositional bound over them; and, for every span whose count is known only once staged, that derivation is exercised against stand-in stagings of differing counts — stand-in file sets under `.xspec/` for T13.3-5(a), stand-in `recorded` sets for the companion stagings, and, for each property's shrink phase, stand-ins failing the property at differing draws — the guard applied at each count no less than the bound over it; so a fixed or under-scaled span guard, P-12's among them, fails before any product exists". Today `test/self/s3-subprocess-driver.test.ts` has only the never-terminating arm (about line 428).

**Change** (`test/self/s3-subprocess-driver.test.ts`, or a new `test/self/s3-hang-guards.test.ts`):
- The delayed span: N stand-in invocations (the existing known-behavior stand-in command, given a fixed delay), N times the delay exceeding one invocation's own guard (shrink the guard for the self-test, never the delay below it), run as one span through the same machinery a registered body uses: passes.
- The never-terminating stand-in: fails as a diagnosed hang within its own guard (the existing arm, kept), the span ending there.
- Every span the suite stages: walk the registry (`productTestSuite`), the property and trial-loop machinery at the fixed seeds, and the held runs, and check that the guard each applies is no less than the compositional bound counted from its staging alone — under Task 18's conservative design, that none applies a guard at all (every entry's framework timeout `0`, no trial-loop, property, shrink-phase, or held-run budget), with every wait beside invocations bounded by those invocations' guards; under the derived alternative, the counts and bounds themselves.
- The staged-only spans: exercise T6.5-20(a)/(c)/(e)'s and T13.4-9(e)'s companion stagings with stand-in `recorded` sets of differing sizes, and each property's shrink phase with stand-ins failing at differing draws, checking the guard applied at each count (none, or the derived one) is no less than the bound. T13.3-5(a) does not exist yet: Task 111 adds its stand-in check.
- A red check of each new self-test: a scratch-backed copy restoring one fixed span guard (e.g. a 120-s entry timeout, or P-12's 600 s) makes the corresponding check fail.

**Checks.** The new self-tests pass; each red check fails as stated (record them); the self project's counts gain the new tests.

### Task 21 — H-1's ancestor precondition, one shared check (RC-4)

**Gap.** TEST-SPEC H-1 (revised): "an arm presuming nothing above its staging root — a failed upward search and its `.` concerned path (T7-1, T12.7-3, T14-10(k)), or a workspace directory that is no repository and lies inside none (T6.3-5(c), T6.3-6(b), T12.0-12) — runs only once the harness has verified, under the environment it runs the product in, that no ancestor of that root holds an entry named `xspec.config.ts` and that the root lies inside no git working tree; an unmet precondition is a harness error (H-11), never a pass, a product failure, or a skip (H-9)". Observed (reviewer C; reviewer A's uncounted note): nothing checks the `xspec.config.ts` half anywhere — T7-1 (`section-7-basics.ts`, about line 838) and T12.7-3 (`section-12.7.ts`, about line 3215) only assume it in comments; the repository half exists only at T6.3-5(c) (`assertOutsideAnyRepository`, `section-6.3.ts`, about line 1175, through `git rev-parse` under the product's isolation) and T12.0-12 (`assertNoEnclosingGitRepository`, `section-12.0-ii.ts`, about line 2574, a `.git` walk). CERTIFICATIONS.md §CONF-CORE also requires it before T13.5-8's journal-staged baseline arms.

**Change.**
- One helper in `test/helpers/` (e.g. `assertSelfContainedRoot(root, context)` in `test/helpers/workspace.ts` or a module of its own): every ancestor directory of `root` (its parent up to the filesystem root) holds no entry named `xspec.config.ts` of any kind (`lstat`, a link included), and `root` lies inside no git working tree as git itself judges it under the environment the subprocess driver gives the product (its sanitized base environment, ambient `GIT_*` dropped and the isolated git configuration pinned, as `assertOutsideAnyRepository` does today); an unmet precondition throws a harness error naming the offending ancestor or working tree — never `HarnessAssertionError`.
- Call it before every arm H-1 names that exists now: T7-1's failed-upward-search arm, T12.7-3's `.`-path arm(s), T6.3-5(c), T12.0-12's sweep, and T13.5-8's baseline arms that presume no repository; replace `assertOutsideAnyRepository` and `assertNoEnclosingGitRepository` with it. T14-10(k) and T6.3-6(b) (Tasks 127, 47) call it when added.
- A self-test (in `test/self/s2-workspace-builder.test.ts` or beside the helper): the helper passes on a fresh workspace; throws the harness error when an ancestor directory holds `xspec.config.ts` (a scratch tree), and when the root lies inside a scratch git repository.

**Checks.** The affected tests against the built product, each alone: verdicts unchanged. CONF-CORE family alone: lines unchanged (T13.5-8). The new self-tests pass.

### Task 22 — Mode-000 directory stagings; runs from a working directory entered before its permissions went (RB's shared infrastructure)

**Gap.** TEST-SPEC T14-10(k): "a working directory `R/tools` beneath a valid workspace root `R`, no glob reaching below it, entered and only then stripped of its read and search permission both (mode `000`) — a process keeps a working directory it entered before the permissions went, as a wrapper may arrange between changing directory and running the product, and a lookup of any entry there and the directory's listing are then each refused, whether spelled relative to it or walked absolutely from the filesystem root — the harness verifying on itself that its own lookup of `xspec.config.ts` there and its own listing of the directory are both refused"; T14-10(l): "the directory holding the path stripped of its read and search permission both (mode `000`, verified on the harness itself)"; T11.2-6's emit directory `out` at mode 000; T6.3-6(e)'s object store and inner `.git` at mode 000, "the harness verifying on itself … that its own listing of the store and its own read of an object file under it are refused". Reviewer B: no mode-000 staging helper exists. (`stageDirectoryMode` in `test/helpers/permissions.ts` accepts any mode bits with listing/creation/examination probes, which may serve the directory half.)

**Change.**
- In `test/helpers/permissions.ts`: a mode-000 staging of a directory (read, write, and search removed), verified on the harness itself — its listing refused and the examination of a named entry under it refused (and, where the caller names a file under it, the file's read refused) — restorable idempotently; reuse `stageDirectoryMode(target, 0o000, probes)` if it covers this, adding only what it lacks.
- In `test/helpers/subprocess.ts` (the driver; H-2's controlled working directory): a run whose working directory is entered before its permissions are removed — e.g. a harness-owned wrapper started with that working directory, which signals readiness, waits while the harness stages the directory mode 000 and verifies the staging on itself, and then runs the product so that the product inherits the entered working directory — keeping every guarantee of `runProduct` (sanitized environment, argv verbatim, exit code, separated byte-exact streams, its hang guard, the JSON walk); the wrapper is harness code (`test/helpers/` or `test/fixtures/`), never product code. Restore the mode after the run, in a `finally`.
- Self-tests (`test/self/permission-staging.test.ts`, `test/self/s3-subprocess-driver.test.ts`): the staging refuses the harness's own listing and lookup and its ineffective-staging report fires on an unstaged twin (as the module's other stagings); a stand-in run from a mode-000 working directory reports its `process.cwd()` as the entered path and its own `readdir(".")` and a lookup of `xspec.config.ts` there refused, its exit code and streams captured as usual.

**Checks.** The new self-tests pass under the namespace (they need an unprivileged runner, as every permission staging does). No product test changes in this task.

### Task 23 — H-2's two fixed TypeScript configurations in the tooling driver; S-4's per-configuration probes (RC-1, RC-2)

**Gap.** TEST-SPEC H-2 (revised): the consumer channel's configurations are fixed — "Both run TypeScript 5.9.3 … with `strict` enabled and `target` ESNext with that target's default library, every option not named here at the release's default. The *CommonJS configuration* sets `module` CommonJS under its default (`node10`) resolution. The *ES-module configuration* sets `module` ESNext with `moduleResolution` `bundler` and enables `isolatedModules` and `verbatimModuleSyntax` … Every type-checking and language-service assertion this channel makes is made under each configuration, with the same expectation: a program type-checks clean when it carries no diagnostic anywhere — in the consumer and in every generated module and companion it reaches alike — and a type-error assertion expects compilation to fail with the program's diagnostics at the consumer references under test alone … Every consumer program and TypeScript fixture file the channel compiles is valid under both configurations but for the diagnostics its assertion expects. Runtime behavior is exercised under the CommonJS configuration alone: the consumer program, with the generated module it imports, is compiled … to CommonJS JavaScript …, written outside the workspace, and that output is executed under the Node.js runtime the suite runs on, no package named `xspec` installed or resolvable; the ES-module configuration's output … is type-checked and served, never executed. A configuration in which no product could meet 13.1 is never used: ECMAScript-module `node16`/`nodenext` resolution …". S-4 (revised): "In each configuration H-2 fixes, detects a known type error, a known definition location, and a known hover text in a hand-written non-xspec fixture project compiled and served in that configuration … — among the type errors one located in a module the consumer imports, outside the consumer file, a clean verdict covering the whole program (H-2). Each configuration's module settings are detected in effect through hand-written modules the other configuration accepts: under the ES-module configuration, TypeScript's rejection of an export assignment, of an import assignment, of a type re-exported through `export { … } from` without a `type` modifier, and of a type imported without one; under the CommonJS configuration, its rejection of a top-level `await`". Observed (reviewer C): `defaultConsumerCompilerOptions()` (`test/helpers/tooling.ts`, line 242) is one configuration — target ES2022, module and moduleResolution NodeNext, `skipLibCheck: true`, `types`/`typeRoots` pointing at the repo's `@types` — so `assertNoCompileErrors` (line 791) never checks generated declaration companions, `assertCompileErrorAt` (line 810) passes if any error covers the position whatever else is reported, and `emit()` (line 641) writes JavaScript beside the sources inside the workspace; `test/self/s4-typescript-tooling.test.ts` runs each probe once, and `test/fixtures/s4-tooling/` has no imported-module type error and none of the five detection modules.

**Change** (`test/helpers/tooling.ts`, `test/self/s4-typescript-tooling.test.ts`, `test/fixtures/s4-tooling/`):
- Two exported, named configurations (e.g. `COMMONJS_CONFIGURATION`, `ES_MODULE_CONFIGURATION`), each exactly H-2's options: `strict: true`, `target: ESNext`, and `module: CommonJS` (resolution left at its default) or `module: ESNext`, `moduleResolution: Bundler`, `isolatedModules: true`, `verbatimModuleSyntax: true` — nothing else set for type checking (no `skipLibCheck`, `types`, `typeRoots`, `lib`); the runtime emit adds only what writing the CommonJS output outside the workspace needs (an `outDir` in a fresh scratch directory under the OS temporary directory, with `rootDir` where the layout requires it), never anything that changes type checking.
- `ConsumerProject` takes a configuration; a helper runs a type-checking or language-service assertion under each configuration in turn, naming the configuration in every diagnosis (e.g. `forEachConfiguration`). The clean verdict reports every diagnostic anywhere in the program (syntactic, semantic, global, and options diagnostics, every category the compiler reports), generated modules and companions included. The type-error assertion takes the expected consumer position(s) and requires compilation to fail with every diagnostic at one of them and each of them diagnosed — none elsewhere. Runtime: `emit` under the CommonJS configuration only, its output written outside the workspace, then `runConsumer` there under plain Node with no package named `xspec` resolvable (as today, `NODE_PATH` dropped; the output directory with no `node_modules` above it).
- Keep the old `defaultConsumerCompilerOptions()` path working, marked in its doc comment as the NodeNext path awaiting removal by Task 27, so the consumer tests Tasks 24–27 migrate stay green meanwhile; new code never uses it.
- S-4: every probe (the known type error at its exact location, the known definition, the known hover) under both configurations; a known type error inside an imported fixture module outside the consumer file, its clean-whole-program twin passing; the five detection modules as hand-written fixture files — under the ES-module configuration `export =`, `import … = require(…)`, a type re-exported via `export { … } from` without `type`, a type imported without `type`, each rejected (and each accepted under CommonJS); under CommonJS a top-level `await`, rejected (and accepted under the ES-module configuration) — so serving one configuration's settings for the other's fails. The existing S-4 probes (TS2440, TS2300, inert positions, missing files, markers) run under both. These are non-xspec fixture modules the tooling compiles, never sources staged for the product; if an S-9 self-test enumerates `test/fixtures/s4-tooling/`, keep its declarations true of the new files (a detection module is rejected by one configuration's checker, not by the parser).
- Comments: `tooling.ts`'s header ("Conservative defaults where IMPLEMENTATION.md is silent …" becomes H-2's fixed configurations) and the S-4 file's header.

**Checks.** S-4 passes under both configurations; red checks: with a scratch-backed copy of `tooling.ts` serving the CommonJS options for the ES-module configuration, the four ES-module detection probes fail; serving the ES-module options for CommonJS, the top-level-`await` probe fails; with `skipLibCheck` re-added, the imported-module type-error probe fails. Every consumer test still passes against the built product on the old path (no consumer migrated yet).

### Task 24 — §1–§2 consumers under both configurations (RC-1)

**Depends on.** Task 23.

**Gap.** TEST-SPEC H-2 and §4's opening paragraph (Task 23's text) bind every consumer assertion. The §1–§2 consumers still compile under the NodeNext path: T1.1-2, T1.1-3, T1.2-2 (`section-1.1-1.2.ts`), T1.4-3, T1.4-5 (`section-1.4.ts`), T1.6-3 (`section-1.6-1.7.ts`), T2.4-4, T2.4-5 (`section-2.4.ts`).

**Change.** Move each onto Task 23's API: every type-check, hover, and definition assertion under both configurations; every clean verdict whole-program; every type-error assertion at the consumer references under test alone (list every expected position); every runtime run under CommonJS with its output outside the workspace. Make each consumer program and TypeScript fixture valid under both configurations but for the diagnostics its assertion expects (e.g. no `process.stdout.write` without `@types/node` — `console.log` is in ESNext's default library; `type` modifiers where `verbatimModuleSyntax` needs them; no `export =` or `import … = require(…)`), keeping each program's meaning; staged consumer files remain S-9 records where they were. Titles gain "under both of H-2's configurations" where they name the tooling.

**Checks.** Each migrated test against the built product, alone: passes, or fails diagnosed where a configuration exposes a product defect (a generated module or companion that either configuration rejects fails "wherever the suite type-checks it", H-2) — record each with its diagnostic. With the change stashed, HEAD's tests pass it.

### Task 25 — §4 consumers under both configurations (RC-1)

**Depends on.** Task 23.

**Gap.** As Task 24, for the §4 consumers: T4-3, T4-4 (`section-4.ts`), T4.1-1, T4.1-2, T4.1-3, T4.2-3, T4.2-4 (`section-4.1-4.2.ts`), T4.3-1, T4.4-1, T4.4-2 (`section-4.3-4.4.ts`), T4.5-1 (`section-4.5.ts`). Reviewer C notes `process.stdout.write` consumers in `section-4.ts` and `section-4.3-4.4.ts`, which compile today only through the injected `@types/node`, and T4-3's compiled JavaScript written beside the sources (`section-4.ts`, about line 1262).

**Change.** As Task 24. T4.4-1/T4.4-2's branding type errors and T4-4's type-only consumer errors become exact (every diagnostic at an expected reference).

**Checks.** As Task 24.

### Task 26 — T13.1-2 under both configurations (RB-74, RC-1)

**Depends on.** Task 23.

**Gap.** TEST-SPEC §13.1, T13.1-2 (revised): both H-2 configurations — CommonJS with node10 resolution; ESNext with bundler resolution, `isolatedModules`, and `verbatimModuleSyntax`; both `strict` with target ESNext — with zero diagnostics across the whole program under each and runtime checks under CommonJS (read the entry; `tdiff.py` shows the revision). `test/suite/registry/section-13.1-13.2.ts` uses the single NodeNext configuration.

**Change.** T13.1-2 onto Task 23's API as T13.1-2's text states it (each configuration's whole-program clean verdict over the generated modules and companions; runtime under CommonJS, output outside the workspace; the ES-module configuration type-checked and served, never executed); its title and comments name both configurations.

**Checks.** As Task 24.

### Task 27 — §6.5 and §14 consumers under both configurations; the NodeNext path removed (RC-1)

**Depends on.** Tasks 23–26.

**Gap.** As Task 24, for the remaining consumers: T6.5-9 (`section-6.5.ts`), the consumer helper(s) in `section-6.5-ii.ts` and `section-6.5-v.ts` (find their callers), T6.5-17 (`section-6.5-iii.ts`), and T14-2 (`section-14.ts`). H-2: "A configuration in which no product could meet 13.1 is never used: ECMAScript-module `node16`/`nodenext` resolution …".

**Change.** Migrate them as in Task 24; then delete `defaultConsumerCompilerOptions()` and every NodeNext reference from `test/helpers/tooling.ts` (and its `types`/`typeRoots`/`skipLibCheck` defaults), so no consumer can reach it; `grep -rn "NodeNext\|nodenext\|defaultConsumerCompilerOptions\|skipLibCheck" test/` lists nothing but comments that say why these are never used. AGENTS.md's bullet on consumer fixture programs ("Consumer fixture programs are compiled through the harness's TypeScript tooling driver …") states the two configurations and the runtime output's place.

**Checks.** As Task 24; plus every consumer test across Tasks 24–27's lists, run together against the built product: verdicts as recorded by those tasks.

### Task 28 — H-3's human-report adapter: the findings report and the exit-2 standard-error message (RC-8, part)

**Gap.** TEST-SPEC H-3 (revised), "Report forms: an assertion on a report reads the form its test names; a test naming neither reads the `--json` document …; and the human report of every command that has one — every command but the JSON-only surfaces of 10.7, 11, and 12.6 — is asserted, decoded by a human-report adapter held to the rules above (shape-aware, value-blind, failing loudly when required information is absent), by T12.0-15 on the fixtures it names and by each test naming the human form"; H-5 (revised): "when it is not in effect, exit-2 stdout is empty, the standard-error message then carrying the error's stable code and concerned path wherever 14 defines them (T12.0-15)"; T12.0-15 (new; Tasks 130–135 register it): the human report "decoded by its human-report adapter (H-3) onto the information model the `--json` assertions use, carries the same information … every identity, path, code, status, category with its attribution, edit class, count, and text, and every source range as its two byte offsets (1.7)"; non-UTF-8 paths "explicitly marked, the human-report adapter telling it from a plain path string by that mark alone and recovering from it the path's exact bytes". Observed (reviewer C): `test/helpers/adapters/human.ts` is a layout-blind mention matcher that by design associates nothing (which category a node is attributed to "stays with the JSON assertions"), cannot recover the marked byte form of a non-UTF-8 path, and no assertion checks exit-2 standard error for the code and path (T12.0-2's human configuration-error arm, `section-12.0-i.ts` about lines 800–814, checks only empty stdout and non-empty stderr).

**Change.**
- A human-report decoding layer in `test/helpers/adapters/` (beside `human.ts`, whose mention matcher stays for the existing parity checks): a findings decoder taking a `build`/`check`/gated-read human report onto the same findings model the `--json` decoders produce (each finding's stable code, its locations as file plus range start and end byte offsets, its concerned path, its identities; the human report's order free), and an exit-2 decoder taking standard error onto `{ code, path }` (each may be absent where 14 defines none — a plain usage error carries neither). Paths: a plain string, or the marked byte form recognized by its mark alone and decoded to exact bytes, compared with the `--json` marked form's bytes. The layer is fitted to the human layout the built product actually emits — observe it by running the built product on the fixtures, never by reading or importing `src/` — adjusts to shape only, never to values, and fails loudly (a diagnosed `HarnessAssertionError` naming the missing datum) when required information is absent or unparseable. Later tasks add decoders for the other reports beside it (previews, performed reports, impact, review, coverage, ids, show).
- S-5 vectors (`test/self/s5-output-adapters.test.ts`): synthetic human reports and standard-error messages missing a code, a location's offsets, a concerned path, or an identity, and a non-UTF-8 path printed raw or unmarked, are each rejected loudly; a well-formed synthetic report decodes to the expected model.

**Checks.** The new S-5 vectors pass; a scratch check decodes the built product's human reports for a handful of findings (T14-11's per-condition fixtures, T1.5-2's non-UTF-8 arm on Linux) and its exit-2 standard error for T12.7-3's configuration errors, each equal to the `--json` twin's model — record the outcome (a mismatch the product causes is a product failure for T12.0-15 to report later, not a reason to bend the adapter). No product test changes in this task.

### Task 29 — T1.5-2's code-group arms and located arm (RA-1)

**Gap.** TEST-SPEC §1.5, T1.5-2 (revised): "The non-UTF-8 and U+FFFD arms are staged for a code-group file as well (`src/a�.ts` on both legs, and a non-UTF-8-named `.ts` file on the Linux leg; 14.19 covers both kinds, as for `#`): each fails with 14.19 likewise, a marker in it still recording its occurrence with `source` explicitly unavailable (T11.2-3) — the record's `file` in the marked byte form for the non-UTF-8 name and a plain string for the U+FFFD one (12.0) — failing a product that vets spec-group paths alone. A located arm (Linux leg): a non-UTF-8-named `.mdx` spec source holding a non-root section with no `id` — `build` and `check` report its condition-1 finding beside its condition 19, exit 1, the condition-1 finding's location file the path in the marked byte form (12.0, T12.7-1) and its range the section's opening tag (14.1, T14-11), failing a product that marks concerned paths alone." `T1_5_2` in `test/suite/registry/section-1.5.ts` stages spec-group arms only; T12.7-1's byte-form arm covers `build` only, with a within-construct range.

**Change** (`section-1.5.ts`): the two code-group arms (U+FFFD on every leg the test runs; the non-UTF-8 name on the Linux leg only, gated as the module's existing non-UTF-8 arm is) — a code group globbing the file, a spec source it imports, a marker in it; `build` and `check` report the 14.19 (form-exact, its concerned path plain or marked), and `occurrences` lists the marker's record with `source` exactly `{"unavailable": true}` and `file` the plain string or the marked byte form (decoded to the exact bytes); and the located arm, its 14.1 finding's location file in the marked byte form and its range exactly the opening tag's (precomputed byte offsets), beside the 14.19, exit 1, at `build` and at `check`. Staged sources are S-9 records where the Conventions require. Title and comments.

**Checks.** T1.5-2 against the built product (Linux leg, alone): record the verdict per arm.

### Task 30 — T1.7-2's property-member unit ranges (RA-2)

**Gap.** TEST-SPEC §1.7, T1.7-2 (revised): "a property member's unit runs through the `;` ending it where it spells one — in `class C { m = () => { SPEC.a }; }` the marker's occurrence carries `path#C.m`'s range spanning `m = () => { SPEC.a };`, a twin spelling no `;` (`class C { m = () => { SPEC.a } }`) ends it at the closing brace, `m = () => { SPEC.a }`, and a decorated property (`class C { @dec m = () => { SPEC.a }; }`) spans `@dec m = () => { SPEC.a };`, from its `@` through its `;` — while a method followed by a stray `;` keeps its own range: in `class C { m() { SPEC.a }; }`, `path#C.m` spans `m() { SPEC.a }` …". `OCC_EXPECTED` in `test/suite/registry/section-1.6-1.7.ts` stages no property-member unit.

**Change** (`section-1.6-1.7.ts`): four code files, one per spelling, each an S-9 TypeScript record if staged after the first invocation (and well-formed TypeScript — the decorator needs no declaration for well-formedness; check with AGENTS.md's TypeScript well-formedness bullet), their expected occurrences in `OCC_EXPECTED` with precomputed byte ranges for `path#C.m`'s `source`; the module header's T1.7-2 notes and the title.

**Checks.** T1.7-2 against the built product: record the verdict per spelling (a product extending every member through a following `;` fails the control).

### Task 31 — T2.1-2's `**`, case, and re-entering arms; T2.1-3's colliding-identifier chain (RA-3, RA-4)

**Gap.** TEST-SPEC §2.1, T2.1-2 (revised): `./**/../../specs/BASE.xspec` from `specs/` (no `specs/**` existing on disk) designates `specs/BASE.mdx` (valid, resolving; `**` an entry name raising the depth by one); `./B.XSPEC` beside a discovered `specs/B.mdx` is invalid (relative specifier not ending in `.xspec`, case-sensitive); the root-re-entering `../../<R>/specs/BASE.xspec` from `specs/` (`<R>` the root's directory name) designates nothing — 14.15, `view` reporting its target explicitly unavailable (T11.4-4), and `occurrences --file` on the failing workspace listing no record for a `d={BASE.a}` through it. T2.1-3 (revised): with `specs/A.mdx` and `specs/B.mdx` each holding `a`, `import X from "./A.xspec"` and `import X from "./B.xspec"` in separate blocks, in both declaration orders, beside `<S id="s" d={X.a}>` holding `{text(X.a)}`: `build` and `check` report the 14.15 collision locating both declarations, 14.5 for the `d` reference, and 14.6 for the embedding, exit 1; no edge and no occurrence (`occurrences --file` lists none for the two spellings). `test/suite/registry/section-2.1.ts`: `LEXICAL_IMPORTERS` lacks the `**` arm, `INVALID_SPECIFIER_ARMS` the `./B.XSPEC` and re-entering arms; `T2_1_3` lacks the chain arm.

**Change** (`section-2.1.ts`): the three T2.1-2 arms (the `**` one's `view` target `specs/BASE.mdx`; the case arm's 14.15; the re-entering arm's 14.15, unavailable `view` target, and empty `occurrences --file`) and the T2.1-3 arm in both orders, each with its exact findings form-exact (T14-11's locations for the collision's two declarations); titles and comments.

**Checks.** T2.1-2 and T2.1-3 against the built product: record verdicts per arm.

### Task 32 — T2.4-2's numeric-literal and parenthesized index arms (RA-5)

**Gap.** TEST-SPEC §2.4, T2.4-2 (revised): "a numeric-literal index, `d={BASE[1]}` and `{text(BASE[1])}` with `BASE`'s module holding a top-level section `1` (a valid segment, 1.4) — … no edge and no occurrence; … a parenthesized index, `d={BASE[("a")]}` and `{text(BASE[("a")])}`, `BASE`'s module holding `a` … — no edge and no occurrence" — each 14.8 (the test's heading: "Each fails with 14.8, in `d` and in `text(...)`"). The dynamic-form arms of `test/suite/registry/section-2.4.ts` (about lines 408–437) lack both.

**Change** (`section-2.4.ts`): the four spellings, each 14.8 (its location as the module's other dynamic arms assert it), no edge (`query edges`), no occurrence (`occurrences`); `BASE`'s module holding `1` and `a`; title and comments.

**Checks.** T2.4-2 against the built product: record verdicts.

### Task 33 — T2.5-2's excluded-as-a-target-only arm (RA-6)

**Gap.** TEST-SPEC §2.5, T2.5-2 (revised): "Excluded as a target only (2.5; 8 bars roots alone from coverage paths): spec groups `base` (file A) and `derived` (file B) — A holding `n` (`coverage="none"`, `d={B.t1}`) and `k` (`d={B.m}`), B holding the leaves `t1`, `t2`, and `m` (`coverage="none"`, `d={"t2"}`) — under profiles targeting `derived` with boundary `base`, one `direct` and one `transitive`: `t1` is covered in both modes, its covering path `n` → `t1`, a `coverage="none"` node serving as boundary node; `t2` is covered in `transitive` mode, its covering path `k` → `m` → `t2` through the ignored `m` as intermediate, and uncovered in `direct` mode; `m` is reported ignored with the `coverage="none"` reason alone (8.2)". `T2_5_2` in `test/suite/registry/section-2.5-2.6.ts` lacks it.

**Change** (`section-2.5-2.6.ts`): the arm on a workspace of its own, `coverage` per profile decoded through the coverage adapter: `t1` covered in both with path `n` → `t1`; `t2` covered (transitive, path `k` → `m` → `t2`) and uncovered (direct); `m` ignored with the `coverage="none"` reason alone; title and comments.

**Checks.** T2.5-2 against the built product: record the verdict.

### Task 34 — T4-2's re-entering, `**`, and case arms (RA-7)

**Gap.** TEST-SPEC §4, T4-2 (revised): a `.xspec` specifier "re-entering the root — `../../<R>/specs/NAME.xspec` from `src/` …(designating nothing, T2.1-2's re-entering arm)" fails with 14.15; positively, `"./**/../../specs/NAME.xspec"` from `src/` designates `specs/NAME.mdx` and markers through it record edges; "in a code source holding `import B from "../specs/B.XSPEC"` and the marker `B.a`, `specs/B.mdx` discovered and holding `<S id="a">A</S>`, the declaration is no spec module import … — `build` and `check` exit 0, no 14.15, and `B.a` records no edge and no occurrence (`query edges`, `occurrences`) …; and, in the same code source, an export declaration `export * from "../specs/B.XSPEC"` raises no 14.15 either …; in a code source `src/d.ts` of a workspace discovering `specs/NAME.mdx`, the side-effect imports `import "../specs/NAME.XSPEC.ts"` … and `import "../.XSPEC/x"` … designate no derived-file path: `build` and `check` exit 0, no 14.15". `test/suite/registry/section-4.ts` lacks all five.

**Change** (`section-4.ts`): the five arms, each on the workspace shape its clause states (the case arms on workspaces that are otherwise valid, so exit 0 is observable); `query edges` and `occurrences` where the clause names them; S-9 TypeScript records where needed (each code source well-formed TypeScript); title and comments.

**Checks.** T4-2 against the built product (it takes long; run it alone, record its time): record verdicts per arm.

### Task 35 — T4-4's mixed combination; T4-5's value-level pairings (RA-8, RA-9)

**Gap.** TEST-SPEC §4, T4-4 (revised): "With `import SPEC from "./NAME.xspec"` beside `import { type text as t } from "./NAME.xspec"`, and separately beside `import type { text as t } from "./NAME.xspec"`, the call `t(SPEC.a)`: `build` and `check` report exactly one finding, 14.18 located at `SPEC.a` (T14-11), exit 1; no edge and no occurrence — `occurrences --file` on the failing workspace lists none for the call beside the finding", each on a workspace of its own. T4-5 (revised): `specs/A.mdx` and `specs/B.mdx` each holding `a` and `b`; the value-level pairings — `import SPEC from "./A.xspec"` beside `import SPEC from "./B.xspec"`, and beside a value-level non-spec `import { SPEC } from "./t"` — each staged in both declaration orders. `T4_4` and `T4_5_PAIRINGS` in `test/suite/registry/section-4.ts` lack these, and `T4_5_FILES`' `specs/B.mdx` holds only `x`.

**Change** (`section-4.ts`): T4-4's two mixed workspaces with their exact finding, `query edges`, and `occurrences --file` assertions; T4-5's two pairings in both orders through the module's pairing machinery (the expectations T4-5 states for every pairing: the collision finding locating both declarations, no edge or occurrence for the chains), `specs/B.mdx` holding `a` and `b`; titles and comments.

**Checks.** T4-4 and T4-5 against the built product: record verdicts per arm.

### Task 36 — T4.1-1's built-in-member segments (RA-10)

**Depends on.** Task 25 (T4.1-1 on the two-configuration tooling).

**Gap.** TEST-SPEC §4.1, T4.1-1 (revised): "Segments naming built-in members are child properties like any other (1.4 forbids none of them): top-level sections `toString`, `valueOf`, `hasOwnProperty`, `name`, and `length`, each holding a child `x` — a consumer chain to each child (`SPEC.toString.x`, `SPEC.name.x`, …) type-checks, and `text(SPEC.<segment>)` returns that node's subtree text at runtime (T4.3-1)". `T4_1_1` in `test/suite/registry/section-4.1-4.2.ts` lacks it.

**Change** (`section-4.1-4.2.ts`): the five sections with children in a fixture source; a consumer referencing `SPEC.<seg>.x` for each, clean under both configurations; a runtime consumer (CommonJS) printing `text(SPEC.<seg>)` for each, compared with each node's subtree text (from `query node` or precomputed); title and comments.

**Checks.** T4.1-1 against the built product: record the verdict.

### Task 37 — T4.2-3's truncation with escaping (RA-12)

**Depends on.** Task 25.

**Gap.** TEST-SPEC §4.2, T4.2-3 (revised): "Combined with truncation (4.2: the own text is truncated to its first 1000 code points, and each `*/` in the emitted text is written `*\/`), each read as above: a node of exactly 1000 code points holding `*/` carries all 1000 code points, the `*/` written `*\/`, and no `…`; and a longer node holding `*/` before its 1000th code point carries its first 1000 code points, the `*/` written `*\/`, then `…`." `T4_2_3` in `test/suite/registry/section-4.1-4.2.ts` lacks both.

**Change** (`section-4.1-4.2.ts`): the two nodes (multi-code-unit characters as T4.2-2 uses them), each doc comment read as T4.2-3 reads it today and compared exactly; the module still parses under standard tooling (both configurations); title and comments.

**Checks.** T4.2-3 against the built product: record the verdict.

### Task 38 — T4.3-2's further dynamic arguments, two-argument `check`, and cross-module call (RA-13)

**Gap.** TEST-SPEC §4.3, T4.3-2 (revised): dynamic `text` arguments — "a computed index by numeric literal (`text(SPEC[1])`, `SPEC`'s module holding a top-level section `1` …), … a parenthesized chain (`text((SPEC.a))` and the partly parenthesized `text((SPEC).a)` …), and a parenthesized index, `text(SPEC[("a")])` …, never 14.18"; "for `text(SPEC.a, SPEC.b)` … `build` and `check` report exactly one finding, 14.8 located at the call (T14-11), no 14.18 beside it; and for its cross-module variant `text(SPEC.a, B.b)`, `B` another spec module's default binding, the same single finding, neither 14.18 nor 14.11". `T4_3_2_ARMS` in `test/suite/registry/section-4.3-4.4.ts` lacks the four dynamic arms; the two-argument arm runs `build` only; the cross-module arm is missing.

**Change** (`section-4.3-4.4.ts`): the four arms (each 14.8 at the call, never 14.18, no edge or occurrence), the two-argument arm at `check` too, and the cross-module arm at `build` and `check`; title and comments.

**Checks.** T4.3-2 against the built product: record verdicts per arm.

### Task 39 — T4.5-3's numeric-literal, parenthesized-chain, and parenthesized-index markers (RA-14)

**Gap.** TEST-SPEC §4.5, T4.5-3 (revised): markers `SPEC[1];` (`SPEC`'s module holding `1`), the whole chain parenthesized `(SPEC.a);` and the partly parenthesized `(SPEC).a;` — "located as `(SPEC.a)` and `(SPEC).a`, the parentheses included" — and the parenthesized index `SPEC[("a")];` (`SPEC`'s module holding `a`), each 14.8, no edge, no occurrence. `T4_5_3_ARMS` in `test/suite/registry/section-4.5.ts` stages only `(SPEC.a).b;`.

**Change** (`section-4.5.ts`): the four arms with their exact locations (precomputed byte ranges, the parentheses included where stated); title and comments.

**Checks.** T4.5-3 against the built product: record verdicts per arm.

### Task 40 — T4.5-8's type-only side (RA-15)

**Gap.** TEST-SPEC §4.5, T4.5-8 (revised): "Type-only side …: the same code source with the spec import type-only — `import type SPEC from "./A.xspec"` — and the call `text(SPEC.b)` left out, the marker-shaped `SPEC.a` its one spelling rooted at `SPEC` …, beside each value-level form above at module scope, one arm each; and, for the named-binding modifier, a code source holding `import { type text as t } from "./A.xspec"` and the call `t("x")` beside `function t(x: unknown) {}` and, separately, beside `const t = (x: unknown) => ""`. Every arm collides with nothing: `build` and `check` report no finding, exit 0, the workspace valid …; the marker-shaped `SPEC.a` … records no edge (`query edges` lists none from the file) and no occurrence and raises no 14.7 and no 14.8, and `t("x")`, no spec module's `text` call, raises no 14.8". `T4_5_8` in `test/suite/registry/section-4.5.ts` lacks it.

**Change** (`section-4.5.ts`): one arm per module-scope value-level colliding form the test already stages (type-only import beside each), and the two named-binding arms; each exit 0 finding-free at `build` and `check`, no edge, no occurrence; title and comments.

**Checks.** T4.5-8 against the built product: record verdicts per arm.

### Task 41 — T4.6-3's object-literal, named-expression, wrapper, namespace, and declaration-file arms (RA-16)

**Gap.** TEST-SPEC §4.6, T4.6-3 (revised), each asserted through `query edges` and the occurrence's `source` range (T1.7-2): object-literal method shorthand, getter, setter, `p: function () {…}`, and `q: () => {…}`, one file each, in a top-level `const o` (attributing to the file, `source` the entire file) and inside a function `f` (to `path#f`, `source` `f`'s declaration), never to a member- or `o`-named unit; `const f = function g() { SPEC.a }` → `path#f`; `const C = class D { m() { SPEC.a } }` → `path#C.m`; the four default-export wrappers (`export default (() => { SPEC.a })`, `… as () => void`, `… satisfies () => void`, `(…)!`) → the file, never `path#default`; `declare namespace N {}` then `namespace N { SPEC.a }` → `path#N`, never `path#N@2`; declaration-file controls `src/a.d.b/x.ts`, `x.d.tsx` (group adding `src/**/*.tsx`), `x.d.css.mts`, keeping `path#f`; single-casing controls `src/c1/x.D.ts`, `src/c2/x.d.TS` (`src/**/*.TS` added), `src/c3/x.d.MTS`, `src/c4/x.d.CTS` (`src/**/*.MTS`, `src/**/*.CTS` added), each keeping `path#f`. `T4_6_3` in `test/suite/registry/section-4.6.ts` lacks them.

**Change** (`section-4.6.ts`): every arm above with its expected unit and precomputed `source` range; the globs added to the configuration where stated; S-9 TypeScript records (every file well-formed TypeScript, a `.tsx` file judged as TSX by 14.20's byte-wise rule); title and comments. The arm count is large: if one spawn cannot finish, split per the Conventions' *Size* rule (object-literal and named-expression arms first, then wrappers and namespace, then the declaration-file controls).

**Checks.** T4.6-3 against the built product: record verdicts per arm.

### Task 42 — T4.6-4's declaration-merging arms (RA-17)

**Gap.** TEST-SPEC §4.6, T4.6-4 (revised): "two `namespace A { … }` declarations in one scope, each holding a marker directly, attribute them to `path#A` and `path#A@2` in document order, and `class C { static { SPEC.a } }` followed by `namespace C { SPEC.b }` to `path#C` and `path#C@2` — failing a product that derives units from TypeScript's merged symbols". `T4_6_4` in `test/suite/registry/section-4.6.ts` lacks both.

**Change** (`section-4.6.ts`): both arms through `query edges` (and coverage boundary membership where T4.6-4 asserts it); title and comments.

**Checks.** T4.6-4 against the built product: record verdicts.

### Task 43 — T5.5-5's tie-break arm; T5.5-7 registered (RA-18, RA-19)

**Gap.** TEST-SPEC §5.5, T5.5-5 (revised): "On T5.4-1's first fixture, after N2 is authored, a node of that file declaring `d={["b", "a"]}` — one spelling per bearer, `"b"` N1 and `"a"` N2 — reordered to `d={["a", "b"]}`, against a baseline committed just before the reorder, changes no hash on any node (`query node`, metadataHash and effectiveHash included) and yields no categories (`impact --base`)". T5.5-7 (new, "Framing"): (a) `specs/A.mdx` holding `a` and its child `a.b`, and `specs/B.mdx` importing `A` and holding `<S id="e">x{text(A.a.b)}</S>` and `<S id="f">x{text(A.a)}.b</S>`: `e`'s and `f`'s ownHashes differ, and editing `e`'s content into `f`'s spelling reports `e` `changed` (`impact --base` against a commit holding the first); (b) `<S id="g" tags="ab">t</S>` and `<S id="h" tags="a b">t</S>`: their metadataHashes differ, and editing `g`'s `tags="ab"` into `tags="a b"` reports `g` `metadata-changed`. `test/suite/registry/section-5.5.ts` lacks the tie-break arm and T5.5-7.

**Change** (`section-5.5.ts`): the T5.5-5 arm on T5.4-1's first fixture (reuse its staging; the reordered source an S-9 record); T5.5-7 registered with both arms (each pair in one valid workspace; `query node` hashes compared; the edit categorized by `impact --base`), its H-7 entry (`"5.5"`, plus `"5.6"` for the categories it asserts, per the map's rules).

**Checks.** T5.5-5 and T5.5-7 against the built product: record verdicts; S-1 and S-7 green in the self project.

### Task 44 — T5.7-4's type-only `text` call and value-level collision chain (RA-20)

**Gap.** TEST-SPEC §5.7, T5.7-4 (revised): among the spellings that record no occurrence, "a call through a type-only `text` binding (T4-4, its condition-18 finding beside it)" and "a chain rooted at an identifier two imports bind, type-only or not (T2.1-3, T4-5)". In `test/suite/registry/section-5.7.ts`, the staged `tt(TSPEC.a)` has a type-only argument and raises nothing (the type-only `text` call with an ordinary node argument, 14.18 beside it, is not staged), and only the type-only two-import collision (`src/typed.ts`) is staged, no value-level one.

**Change** (`section-5.7.ts`): a call `t(SPEC.a)` through a type-only `text` binding with an ordinary `SPEC` binding (`occurrences` lists no record for it; its 14.18 finding beside, as `occurrences` on a failing workspace reports findings), and a value-level two-import collision chain (`import X from "./A.xspec"` beside `import X from "./B.xspec"`, as T2.1-3/T4-5 stage it; no record); title and comments.

**Checks.** T5.7-4 against the built product: record the verdict.

### Task 45 — T6.1-3 at `build` and a gated `ids`, form-exact (RA-21)

**Gap.** TEST-SPEC §6.1, T6.1-3 (revised): the garbage-line journal reported "with 14.13 — as do `build` and a gated read (`ids`, answering nothing, 13.3) — each exit 1"; the directory and symbolic-link journal paths are journal errors "at the same three commands. Each such finding is asserted form-exact (12.7, H-3): `code` `"journal-error"`, `path` exactly `".xspec/journal"` …, and `locations` `[]`". `test/suite/registry/section-6.1.ts` runs `check` only.

**Change** (`section-6.1.ts`): each staging (garbage line, directory, symbolic link) runs `check`, `build`, and `ids` (`--json`), each exit 1 with exactly that one finding form-exact (`ids` answering nothing: its document the findings-only form); title and comments. Read T6.1-3's whole entry: its replay-failure sentences now point at T6.3-4 and T6.3-6 (Tasks 46–48) and need no arm here.

**Checks.** T6.1-3 against the built product: record the verdict.

### Task 46 — T6.3-3's intermediate baseline; T6.3-4's revised failure matrix (RA-22, RA-23)

**Gap.** TEST-SPEC §6.3, T6.3-3 (revised): "Impact with the intermediate commit — made after a→b, its tree holding the journal that rename wrote, one entry to the current journal's two — maps b→c through the one entry absent from it and likewise reports no changes". `test/suite/registry/section-6.3.ts` makes the intermediate commit but never runs `impact --base <intermediate>`. T6.3-4 (revised): each failure at `impact --base` and `review create --base` (the latter modifying nothing), a plain usage error, exit 2, "the error document's `code` and `path` `null`"; the prefix violation with the current journal "kept free of condition-13 errors — absent (T6.3-2), or one the product wrote on this workspace, `check` reporting no 14.13 on it — so that the outcome stays this code-less error rather than the current journal's own (T6.3-6)"; the baseline-configuration arms — "a commit `c1` whose `xspec.config.ts` is the working tree's valid configuration plus an unknown top-level key, and separately one whose `xspec.config.ts` is that configuration with its `defineConfig` call's closing parenthesis removed, not well-formed TypeScript (14.20; S-9), `c1`'s sources valid and the working tree's configuration and sources valid, its journal absent — `impact --base c1` and `review create --base c1 --name n` each exit 2 with `code` and `path` `null`, the error naming the offending file `xspec.config.ts`, no session written"; and "A garbage line in the current journal is no replay failure but condition 13, which a given baseline's resolution meets first: `journal-error` (6.3, T6.3-6)". Reviewer A: (a) no arm asserts `code` and `path` `null`; (b) the prefix, invalid-sources, and unresolvable-ref arms run `impact` only; (c) the baseline-configuration arms are missing; (d) the prefix arm does not verify with `check` that the current journal has no 14.13; and the existing garbage-replay-line arm (about lines 842–925) now belongs to T6.3-6(a) and would fail a conforming product once (a) is asserted.

**Change** (`section-6.3.ts`):
- T6.3-3: `impact --base <intermediate>` maps b→c and reports no changes.
- T6.3-4: `code` and `path` `null` on every failure arm (`--json` error document); the prefix, invalid-sources, and unresolvable-ref arms also run `review create --base … --name …`, modifying nothing (no session, sources, journal, derived files, graph data byte-identical); the prefix arm first runs `check` on the current workspace and requires no condition-13 finding; the two baseline-configuration arms (the malformed configuration an S-9 TypeScript record declared unparseable, if staged after the first invocation; the error naming `xspec.config.ts` in standard error, as the module's other arms check naming); delete the garbage-replay-line arm (T6.3-6(a), Task 47, stages it as the journal error it now is). The module header's notes on the garbage line and the title follow.

**Checks.** T6.3-3 and T6.3-4 against the built product: record verdicts per arm.

### Task 47 — T6.3-6 registered: arms (a), (b)'s first two stagings, and (d) (RA-24, part)

**Depends on.** Tasks 21 (H-1's check), 28 (the exit-2 decoder), 46.

**Gap.** TEST-SPEC §6.3, T6.3-6 (new, "A given baseline's journal read, and git data"); read it whole. Arms (a)–(d) each run at `impact --base c1` and at `review create --base c1 --name n`, `c1` a commit the repository holds, each exiting 2 modifying nothing (no session written; sources, journal, derived files, and graph data byte-identical). (a) A garbage line appended to the current journal on a workspace whose sources are valid: the error document's `code` `"journal-error"`, `path` `".xspec/journal"`, `locations` `[]`; "without JSON in effect, standard output empty and the standard-error message carrying the code and the path (T12.0-15)". (b) The same journal error beside each other cause that can fail the resolution, each run at `impact` and at `review create --name n`: an unresolvable ref (`--base nope`); a configuration lying inside no repository's working tree (T6.3-5(c)'s staging, `--base HEAD`, H-1's precondition verified); [and a refused discovery of the repository — Task 48]; each `journal-error` with `path` `".xspec/journal"`, never the code-less error. (d) (a)'s journal error on a workspace whose sources also fail `build`'s validations: exit 2 with `journal-error`, never the gate's exit 1. Not implemented anywhere today.

**Change** (`test/suite/registry/section-6.3.ts`): register T6.3-6 with (a) — including its human form through Task 28's exit-2 decoder (standard output empty, the code and path decoded from standard error) — (b)'s unresolvable-ref and no-repository stagings, and (d); its H-7 entry (`"6.3"`, `"14"`, and any passage its body asserts, per the map's rules); the title states the arms present and the module header says (c), (e), and (b)'s third staging follow in Task 48. The garbage line is shape-independent (H-4), appended to a product-written journal.

**Checks.** T6.3-6 against the built product: record verdicts per arm. S-1 and S-7 green.

### Task 48 — T6.3-6's arms (c), (e), and (b)'s refused-discovery staging (RA-24, rest)

**Depends on.** Tasks 22 (mode-000 staging), 47.

**Gap.** TEST-SPEC T6.3-6: (c) "`.xspec/journal` staged as a directory; as a symbolic link to a plain file holding a journal the product wrote; as a FIFO, never opened (T13.4-13, S-3); and as a plain file whose read permission is removed (T14-10's discipline): each `journal-error`, `path` `".xspec/journal"`, `locations` `[]`, never `read-failure` and never a code-less error"; (e) "the repository's object store staged unreadable and unsearchable (mode `000`; the harness verifying on itself, as T14-10 does, that its own listing of the store and its own read of an object file under it are refused, E-1), the workspace's sources, configuration, and journal valid and readable: `impact --base c1`, `review create --base c1 --name n`, and `review status s` naming a baseline session created before the staging each exit 2, `code` and `path` `null` … modifying nothing"; and, on T6.3-5(b)'s nested-repository fixture (the nested repository, not the submodule) with the inner `.git` directory staged mode `000` (verified on the harness), `impact --base v1` and `review create --base v1 --name n`, each run from `R` with `--config inner/xspec.config.ts`, each exit 2, `code` and `path` `null`, never `read-failure` and never an answer from the outer repository's `v1`; and (b)'s third staging — that refused discovery with a garbage line appended to the inner workspace's journal, `--base v1` from `R`: `journal-error`, `path` `".xspec/journal"`.

**Change** (`section-6.3.ts`): arms (c) (the FIFO through the existing FIFO helper in `test/helpers/lock-staging.ts`; the unreadable file through `stageReadRefusalOfFile`; Linux leg for the permission and FIFO stagings, as the module gates them), (e) (both stagings through Task 22's mode-000 staging, every staging restored in a `finally`), and (b)'s third staging; title and module header complete.

**Checks.** T6.3-6 against the built product, alone under the namespace: record verdicts per arm.

### Task 49 — T6.4-1's twice-spelled reference; T6.4-4's would-be bearers (RA-25, RA-26)

**Gap.** TEST-SPEC §6.4, T6.4-1 (revised): rename's rewrite reaches "an affected reference spelled twice included, in one `d` array and as two markers in one code source, every spelling rewritten (6.4: every reference; one edge, two occurrences, 5.2, 5.7)". T6.4-4 (revised): a rename "whose only would-be bearer's `id` is braced (`id={"x"}`, renaming `x`) or, separately, valueless (`<S id>`, renaming `true` …), each spelling none (11.2): exit 2, though the file carries a 14.17 finding, the usage error alone reported". `test/suite/registry/section-6.4.ts`: the R1 fixtures spell each affected reference once; T6.4-4 lacks both arms.

**Change** (`section-6.4.ts`): T6.4-1's twice-spelled reference in a `d` array and as two markers in one code source, each spelling rewritten byte-exactly (the expected bytes composed as the module's R1 expectations are); T6.4-4's two arms, each exit 2 with the usage error alone (no findings document beside it), nothing modified; titles and comments.

**Checks.** T6.4-1 and T6.4-4 against the built product: record verdicts.

### Task 50 — T6.4-6's refused-writes precondition (RA-27)

**Gap.** TEST-SPEC §6.4, T6.4-6 (revised): "on a valid workspace whose `specs/A.mdx` holds a top-level section `a`, under `markdown: { emit: true, outDir: "out" }`, built, the directory `out` then replaced by a plain file … a real `rename specs/A.mdx a b` and a real file-form `move specs/A.mdx specs/C.mdx` … each exit 1 with exactly the condition-22 finding concerning `out`, no refusal reason beside it — `refused-invalid-destination` included …— sources, journal, derived files, and graph data byte-identical". `test/suite/registry/section-6.4.ts` lacks it.

**Change** (`section-6.4.ts`): the arm (the `move` belongs to T6.5-4's precondition arm too; stage it here as T6.4-6 states), both commands under `--json`, each exactly that finding form-exact, the whole workspace byte-identical around each; title and comments. Its preview twin is Task 123's.

**Checks.** T6.4-6 against the built product: record the verdict.

### Task 51 — T6.5-2's `/ >` parent; T6.5-3's twice-spelled last reference; T6.5-4's `specs/B.MDX` (RA-28, RA-29, RA-30)

**Gap.** TEST-SPEC §6.5, T6.5-2 (revised): "a `<Spec id="p" / >` parent, whitespace on both sides of its `/` (deriving, S-9), becomes the same — never `<Spec id="p" >`". T6.5-3 (revised): "the last-reference arm spelling its chain twice in one `d` array, both entries rewritten and the import still removed, its binding left with no reference (6.5)". T6.5-4 (revised): "the file-form `move specs/a.mdx specs/B.MDX` under spec globs `specs/*.mdx` and `specs/*.MDX`, its destination in a spec group yet without the `.mdx` extension byte-wise (12.0: no case folding)" — refused `refused-invalid-destination`. `test/suite/registry/section-6.5.ts`: `X2_ARMS` stages only `<Spec id="p" />`; `R3_THIRD_A_SOURCE` spells `Org.org.mv` once; T6.5-4 lacks the arm.

**Change** (`section-6.5.ts`): the `/ >` arm in `X2_ARMS` (its expected bytes those of the `/>` arm, an S-9 record judged deriving); the twice-spelled `d` array in the last-reference arm (both entries rewritten, the import removed); the casing arm among T6.5-4's refusals (exactly `refused-invalid-destination`, nothing modified); titles and comments. The casing arm's preview twin is Task 123's.

**Checks.** T6.5-2, T6.5-3, and T6.5-4 against the built product: record verdicts.

### Task 52 — T6.5-16(g)'s twice-spelled embedding (RA-31)

**Gap.** TEST-SPEC §6.5, T6.5-16 (revised), arm (g): "the moved text spelling that embedding twice instead, `<S id="m">x {text(X.a)} {text(X.a)}</S>` (one edge, 5.2), both containers beside the construct (14: every spelling rooted at the lacked binding, no representative chosen)". `test/suite/registry/section-6.5-iii.ts` lacks it.

**Change** (`section-6.5-iii.ts`, the (g) family in `R16_REFUSED_ARMS`): the twice-spelled arm, its refusal finding locating both containers beside the construct (precomputed ranges), `identities` as (g)'s; title and comments. Its preview twin is Task 123's.

**Checks.** T6.5-16 against the built product: record the verdict.

### Task 53 — T6.6-4(a)'s one reference spelled twice (RA-33)

**Gap.** TEST-SPEC §6.6, T6.6-4 (revised), arm (a): reference rewrites are "one per occurrence, never one per edge: an affected reference spelled twice in one `d` array reports two, one at each entry". `test/suite/registry/section-6.6.ts` arm (a)'s `d={["core.mid", "core.mid.z"]}` names two different targets.

**Change** (`section-6.6.ts`): stage one reference spelled twice in a `d` array (e.g. `d={["core.mid", "core.mid"]}` beside the existing spelling, or a dedicated file), the preview reporting two `reference-rewrite` edits, one per entry, each spanning its entry's occurrence; title and comments.

**Checks.** T6.6-4 against the built product: record the verdict.

### Task 54 — T7-1's `XSPEC.config.ts` probe, rerun on the Windows leg and swept by S-7 (RB-24, RC-7)

**Depends on.** Task 21 (T7-1's failed-upward-search arm runs behind H-1's check).

**Gap.** TEST-SPEC §7, T7-1 (revised): "The entry's name is compared byte-wise and case-sensitively (7, 12.0): with the valid root configuration and, in a working directory beneath it, a plain file `XSPEC.config.ts` holding `)` (no well-formed TypeScript; matched by no group's glob) and no entry named `xspec.config.ts`, the search passes that directory and loads the root's configuration — `build` and then `check`, each run from there, exit 0 — a single-casing probe, stageable on any filesystem and rerun on the Windows leg (E-6)". E-6 (revised) lists "T7-1 (`XSPEC.config.ts` in a working directory beneath a valid root configuration → the root's configuration loaded)" among the Windows leg's single-casing probes. `test/suite/registry/section-7-basics.ts` stages no `XSPEC.config.ts`; `PROBES` in `test/windows/e6-subset.test.ts` (about line 55) lists T7-4, T10.1-2, T10.1-3, and T12.0-6 only; `test/self/s7-red-green-sweep.test.ts` sweeps those four out-of-registry probes.

**Change.**
- `section-7-basics.ts`: an exported probe function (in the style of `runT74SingleCasingGlobProbe`, e.g. `runT71ConfigNameCasingProbe(product)`) staging the arm — the `XSPEC.config.ts` file an S-9 TypeScript record declared unparseable if staged after a product invocation (it holds `)`) — and running `build` then `check` from the subdirectory, each exit 0; T7-1's registered body calls it.
- `test/windows/e6-subset.test.ts`: the probe joins `PROBES`, its title in the style of the others (and its Vitest timeout as Task 18 set them).
- `test/self/s7-red-green-sweep.test.ts`: the probe joins the out-of-registry probe list (its test titles' "four single-casing probes" become five), both the stub sweep and the no-product sweep.
- T7-1's title and comments; AGENTS.md's Windows-leg bullet (the one beginning "Windows-leg subset (TEST-SPEC E-6") names the fifth probe.

**Checks.** T7-1 against the built product (Linux): record the verdict; the S-7 file passes with the fifth probe failing diagnosed against the stub and the absent artifact. The Windows leg's verdict is checked by the last task's CI run (the probe must pass there against the built product).

### Task 55 — T7-2's new form arms; T7-3's code-group names (RB-25, RB-26)

**Gap.** TEST-SPEC §7, T7-2 (revised): configuration-form violations, each 14.14 — an import from the specifier `"XSPEC"` (a single-casing arm); `markdown: { emit: true, outDir: null }` and a profile's `targetTags: null` (a `null` literal outside 7's literal set), one arm each; `defineConfig()` and `defineConfig({…}, {})` (one call whose sole argument is statically literal; the second's first argument otherwise valid); a numeric-literal key `specs: { 1: ["specs/*.mdx"] }`; and among the empty names, a code group named `""`. T7-3 (revised): among the names held to 1.4's rules, a code group (beside a spec group, a profile, and a rule) — reviewer B: a code group named with U+FFFD. `test/suite/registry/section-7-basics.ts` lacks these arms (`FORM_VIOLATIONS` and T7-3's name arms).

**Change** (`section-7-basics.ts`): each new T7-2 arm as a `FORM_VIOLATIONS` row (exit 2, the error document `code` `"configuration-error"`, `path` `"xspec.config.ts"`, as the module's rows assert; each configuration file an S-9 TypeScript record where staged after an invocation, well-formed TypeScript); T7-3's code-group arm(s) as T7-3's entry states them (read it: the U+FFFD name built from its code point); titles and comments.

**Checks.** T7-2 and T7-3 against the built product: record verdicts per arm.

### Task 56 — T7-6's extension twin and casing arms (RB-27; certified, CONF-DISC)

**Gap.** TEST-SPEC §7, T7-6 (revised): "The extension twin (7.3, 13.1 …), staged separately with emission enabled next to sources: a spec glob `specs/*.txt` matching `specs/A.txt` (holding `<S id="a">A</S>`; 14.19) and a code group globbing `specs/*.md` matching plain files `specs/A.md` and `specs/A.txt.md`, each holding `)` — `check` exits 1 with exactly three findings, `specs/A.txt`'s condition 19 and a condition-20 finding for each `.md` file …. The exclusion's name tests are byte-wise and case-sensitive (13.4, 12.0): a code source `src/a.XSPEC.ts`, matched by a code glob `src/*.ts`, carries no `.xspec.` in its name, and — on the Linux leg … — a code source `.XSPEC/a.ts`, matched by a code glob `.XSPEC/*.ts` (its leading `.` spelled, 7), lies under no `.xspec/`: each is discovered — listed among `inventory`'s `sources`, and `query edges --from <path>` answering exit 0 for its whole-file location". `test/suite/registry/section-7-discovery.ts` lacks them. Reviewer D: the CONF-DISC conformer already handles both (exactly 14.19 plus two 14.20; the casing arms listed in `inventory`, `query edges` exit 0).

**Change** (`section-7-discovery.ts`): both arms as stated (the `.md` files declared unparseable S-9 records where needed; `.XSPEC/a.ts` on the Linux leg only); within CONF-DISC's staging constraints (read §CONF-DISC and its three violators' entries: each new arm's workspace must let VIOL-DISC-DERIVED fail where its entry says and DIALECT and SYMLINK pass); title and comments.

**Checks.** CONF-DISC family alone: the conformer passes T7-6; DERIVED fails it where it failed before (fixture runner: record the first line); DIALECT and SYMLINK pass it. T7-6 against the built product: record the verdict.

### Task 57 — T7-7 registered: validation on a built workspace (RB-7)

**Gap.** TEST-SPEC §7, T7-7 (new): read it whole. Two arms, each staged on a valid workspace after a `build` that leaves graph data current, every command run from the root under `--json`: (a) the root's `xspec.config.ts` replaced by a symbolic link to a file holding its byte-identical content — the target inside the workspace at a path no group matches, and separately outside it; (b) a file created that both a spec group and a code group match (a spec group globbing `src/**/*.mdx` beside a code group globbing `src/**/*`, then `src/x.mdx` created). In each, `build`, `check`, `ids`, `occurrences`, `inventory`, a `rename --preview`, and a `rename` of an operation succeeding on the unstaged twin each exit 2 with the error document — `code` `"configuration-error"`, `path` `"xspec.config.ts"` — nothing modified, `.xspec/lock` absent afterwards, and the link and its target byte-identical; `version` exits 0. Not registered.

**Change** (`test/suite/registry/section-7-basics.ts` or `section-7-discovery.ts`, whichever holds T7-1's occupancy and T7.2-1's both-groups machinery): register T7-7 with both arms (the link arms on the Linux leg if the module gates links so; the created `src/x.mdx` an S-9 record); H-7 entry (`"7"`, `"14"`); the whole-workspace snapshot compare around each command (the lock path excluded alone, H-6, and asserted absent).

**Checks.** T7-7 against the built product: record verdicts per arm. S-1, S-7 green.

### Task 58 — T7-8 registered: discovery's read scope (RB-8)

**Gap.** TEST-SPEC §7, T7-8 (new): read it whole. Under the globs `specs/**/*.mdx` and `src/**/*.ts`, on a freshly built valid workspace, a root-level `data/` and a dot-directory `specs/.cache/` each staged unlistable (T14-10's discipline, Linux leg, verified on the harness): every command that loads configuration — `build`, `check`, `ids`, `view`, `inventory`, `review list`, and a `rename` — exits and answers exactly as on a twin holding neither directory (exit code, stdout, written files byte-equal), never `read-failure`, each outcome also asserted as such a workspace gives it (H-5). The kind half: `specs/sub/` holding only `specs/sub/.keep`, and separately (with a spec glob `docs/*.mdx` added) `docs/` holding only `docs/notes.txt`, each directory staged `r--` (listing kept, search removed; verified on the harness): each representative command exits and answers as on a twin without the entry. The carve-out: with the spec glob `.xspec/*.mdx` added, `.xspec` made `-wx` (verified first): `build`, `check`, `ids`, and `view` each exit and answer as on a twin staged alike but without that glob — `build` 0 finding-free, `ids` 0 with its listing, `view` 0 finding-free, `check` asserted equal to the twin's alone; neither `inventory` nor the written files compared there. Not registered.

**Change** (`test/suite/registry/section-7-discovery.ts`): register T7-8 with the three halves, the stagings through `test/helpers/permissions.ts` (`stageReadRefusalOfDirectory` for unlistable; `stageDirectoryMode` for `r--` and `-wx`), each restored in a `finally`; twin comparisons per the entry; H-7 entry (`"7"`, `"14"` if it asserts a condition's absence by rule (c)).

**Checks.** T7-8 against the built product, alone under the namespace: record verdicts per half.

### Task 59 — T7.1-1's `specs/A.MDX`; T7.3-1's wrong-type literals and `.XSPEC` `outDir`s (RB-28, RB-29)

**Gap.** TEST-SPEC §7.1, T7.1-1 (revised): "`specs/A.MDX`, holding `<S id="a">A</S>` and matched by a spec glob `specs/*.MDX` with emission enabled, has no `.mdx` extension … — 14.19, and `inventory`'s `derived` entry for it carries `module` and `markdown` `null`". §7.3, T7.3-1 (revised): "`emit: "true"` (7.3: a boolean) and `outDir: true` (a path), one arm each — → 14.14, exit 2, never coerced"; and "on the Linux leg, are the single-casing spellings `".XSPEC"` and `".XSPEC/md"` (12.0 …)" — valid `outDir`s, emission written under them. `test/suite/registry/section-7.1-7.3.ts` lacks them.

**Change** (`section-7.1-7.3.ts`): the T7.1-1 arm (14.19 from `build`/`check`, `inventory`'s `derived` entry with `module` and `markdown` `null`); T7.3-1's two type arms (configuration error, exit 2) and the two Linux-leg `outDir` arms (each valid, `build` exit 0, the Markdown written under `.XSPEC/…`, as the module's `LOOKALIKE_OUTDIRS` arms assert); titles and comments.

**Checks.** T7.1-1 and T7.3-1 against the built product: record verdicts.

### Task 60 — T7.5-1's selector globs; T7.5-2's twice-spelled edge; T7.5-4's `./src/*.ts` selector (RB-30, RB-31, RB-32)

**Gap.** TEST-SPEC §7.5, T7.5-1 (revised): "a rule whose `from` is `{ files: "../x/*.ts" }` and one whose `from` is the capture pattern `{ files: "a/../../$1.ts" }` …, and one whose `to` is `{ files: "/src/*.ts" }` … — one arm each, each rule otherwise valid → 14.14, exit 2". T7.5-2 (revised): "An offending edge spelled twice (`d={[BASE.a, BASE.a]}`, one edge, 5.2) is exactly one finding — one per rule and offending edge (14.12)". T7.5-4 (revised): on a workspace whose `src/a.ts` holds a marker on a node of group `product`, each rule on its own such workspace built under that rule's configuration, "a `forbidden` rule from `{ files: "./src/*.ts" }` to `{ group: "product" }` loads without error and `check` reports no policy finding, exit 0, where its twin from `{ files: "src/*.ts" }` reports that edge as a violation, exit 1". `test/suite/registry/section-7.4-7.5.ts` lacks all five arms.

**Change** (`section-7.4-7.5.ts`): the five arms as stated; titles and comments.

**Checks.** T7.5-1, T7.5-2, and T7.5-4 against the built product: record verdicts.

### Task 61 — T8.1-1 registered, split out of T8-5 (RB-9)

**Gap.** TEST-SPEC §8.1, T8.1-1 (new): "One workspace asserting 8.1's required set: group restriction; `targetTags` restriction; `"leaves"` vs `"all"`; `coverage="none"` exclusion; root exclusion." T8-5 (revised) lost that sentence. The content exists as T8-5's part (b) (`test/suite/registry/section-8.ts`, about line 1160).

**Change** (`section-8.ts`): register T8.1-1 with that workspace and its assertions, moved out of T8-5; T8-5 keeps exactly what its revised entry states (read it: its root-exclusion arms and the rest); H-7 entry for T8.1-1 (`"8.1"`, plus `"8"` if the map's rules call for it); T8-5's title and citations follow its revised entry.

**Checks.** T8-5 and T8.1-1 against the built product: both pass as T8-5 did. S-1 green.

### Task 62 — T10.7-14 registered: the refusal finding form, a shared check (RB-17)

**Gap.** TEST-SPEC §10.7, T10.7-14 (new): "A review-operation refusal (10.7) carries no stable code and neither location nor concerned path (14: `locations` empty, `path` `null`). Each refusal the suite stages — `create` naming an existing session, exactly and matching it ignoring ASCII case alone (T10.7-1, T10.1-2); `resolve` of a blocked item (T10.3-2, T10.7-10); and `split` of an item of another kind and of a `subtree-coherence` item whose scope root has no children (T10.7-9) — run with `--json`, exits 1 with standard output exactly `{"findings": [f]}` (12.7: a refused operation's findings-only form), `f` exactly `{"code", "message", "locations", "path", "identities"}` with `code` `null`, `locations` `[]`, `path` `null`, and `identities` an array of strings whose content is informational (12.7) and not asserted; the session file stays byte-identical." Reviewer B: today's refusal checks never pin `path` null or the exact member set; `section-10.7-i.ts` (about line 842) deliberately leaves the concerned path unasserted.

**Change.**
- A shared check (in `test/suite/registry/support.ts` or a §10 helper module, exported): given a run, assert exit 1, stdout exactly one findings-only document holding one finding of exactly that member set with `code` `null`, `locations` `[]`, `path` `null`, `identities` an array of strings, and the session file byte-identical around the run (the caller passes its path). The existing refusal sites — T10.7-1's existing-name refusals (the deliberate gap at about line 842 closed), T10.1-2's case-insensitive collision, T10.3-2, T10.7-9's two `split` refusals, T10.7-10's blocked `resolve` — switch to it now; later tasks (T10.3-2's remaining arm in Task 66, T10.5-5, T10.7-9's new refusals, T10.7-15) use it.
- Register T10.7-14 (in `section-10.7-ii.ts`, or a new `section-10.7-iii.ts` with its wrapper and index spread if that module has grown past what one spawn can work in — it is 171 KB): one workspace staging each refusal the entry lists, each through the shared check; H-7 entry (`"10.7"`, `"12.7"`, `"14"` per the map's rules — it asserts the form of a refusal finding and the absence of a stable code).

**Checks.** T10.7-14 and every test whose refusal site switched, against the built product: record verdicts (the product may carry a concerned path today — a diagnosed failure then).

### Task 63 — T10.7-13 registered: the metadata pair (RB-16)

**Gap.** TEST-SPEC §10.7, T10.7-13 (new, "Metadata pair"): a `metadata-consistency` item's payload — `next --json`, and identically `show` and `export` — carries its scope node's metadata pair: before, the node's `d` targets, coverage attribute, and tags in the item's baseline state; after, in the current graph; each `d` target under its current identity; a side whose graph state lacks the node presented absent; coverage `"required"`/`"none"`, tags a set in byte order; `d` targets compared as a set. Fixtures (path-blocks) (a)–(d) as the entry states (`M`'s `d` `{T1, T2}` → `{T2, T3}`, no coverage → `coverage="none"`, `tags="b a"` → `tags="c b"`: context exactly `{T1, T3}`, pair before `d` `{T1, T2}`, `"required"`, `["a", "b"]`, after `d` `{T2, T3}`, `"none"`, `["b", "c"]`; (b) `G` tags-only and `H` coverage-only, contexts empty; (c) `K`'s removed reference to `T4`, then `rename` `T4`→`T9`: context and before-side present `T9`; (d) `M` deleted after (a): before side as in (a), after side absent). Not registered; reviewer B: T10.7-7's payload arm and T10.5-3 now point here.

**Change.**
- The review adapter (`test/helpers/adapters/review.ts`) decodes the metadata pair from `next --json`, `show`, and `export` payloads (unpinned shape: the adapter's latitude; the value forms — coverage token, tag set, identities — literal, H-3), failing loudly when absent; S-5 vectors for it (a payload missing a side, a tag set out of byte order, a coverage value outside the two tokens).
- Register T10.7-13 (where Task 62 put the new §10.7 tests) with (a)–(d), each pair asserted identically through the three surfaces; H-7 entry (`"10.7"`, plus `"10.4"` for the current-identity presentation if the map's rules call for it).

**Checks.** T10.7-13 against the built product: record verdicts per arm; the new S-5 vectors pass.

### Task 64 — T10.1-4's missing-`kind` arm and re-inserted decomposed original; the session adapter's re-insert operation (RB-33)

**Gap.** TEST-SPEC §10.1, T10.1-4 (revised): among the corruptions, "a missing 10.2 field — an item's `status`, and separately its `kind`, fields every item carries (10.2) …"; "an item whose kind and scope node are recorded as decomposed (10.1, 10.7) — a path-blocks session's file as the product wrote it after a `split`, with the original item's entry, copied from the pre-`split` file the product wrote, re-inserted, a state violating this invariant alone …"; the staging shape-aware and value-blind in H-3's adapter layer — "re-inserting an item entry copied from an earlier file the product wrote for the same session". `test/suite/registry/section-10.1.ts` has the missing-`status` arm only, and `test/helpers/adapters/session-staging.ts` has no re-insert operation.

**Change.**
- `session-staging.ts`: an operation re-inserting an item entry copied from an earlier product-written file of the same session into a later one (shape-aware over the sorted-key JSON objects, value-blind, failing loudly when the shape does not match), and the missing-`kind` deletion if the existing field deletion does not already cover any field by name; S-5 vectors for each (wrong shape rejected).
- `section-10.1.ts`: the missing-`kind` arm and the re-inserted-original arm (a path-blocks session in a git repository, `split` run, the pre-split file saved and its original entry re-inserted into the post-split file), each run through every surface T10.1-4 asserts for its corrupt states (corruption reported, exit 1, nothing modified; `list` reporting the session corrupt; `check` 14.21); title and comments.

**Checks.** T10.1-4 against the built product: record verdicts per arm; the new S-5 vectors pass.

### Task 65 — T10.1-6's absent-directory, corrupt-beside, linked-journal, inventory, and baseline arms (RB-34)

**Depends on.** Task 3.

**Gap.** TEST-SPEC §10.1, T10.1-6 (revised; read it whole): (1) absent session directory — on a freshly built valid workspace, which holds no `.xspec/reviews`, `review list` reports no sessions, exit 0; `review status x` exits 2 as an unknown session, `code` `null`, never `read-failure`, and so do `next`, `show`, `export`, `resolve`, and `split` naming `x` (with an item ID where they take one); none brings `.xspec/reviews` into existence; (2) the reviews link's target holding a valid `s.json` and, beside it, a corrupt `c.json` of garbage bytes, so a read through the link surfaces as 14.21; (3) the `.xspec` link whose target holds a journal the product wrote with a garbage line appended and, under its `reviews/`, valid sessions beside a corrupt one, so a read through the link adds 14.13 (and at `check` 14.21) to the answers, the journal below the link being empty; (4) `inventory` reporting `journal` exactly `{"path": ".xspec/journal", "occupied": false}` (today only `occupied`); (5) with the workspace a git repository holding a commit `c1` made before the staging (configuration and sources alone, no journal), `impact --base c1` exits 1 with exactly that condition-22 finding, the gate's, nothing written — never `journal-error`'s exit 2.

**Change** (`test/suite/registry/section-10.1.ts`): the five additions as the entry states them, each form-exact; title and comments.

**Checks.** T10.1-6 against the built product: record verdicts per arm.

### Task 66 — T10.2-1's item-ID form; T10.3-2's refusal in T10.7-14's form (RB-35, RB-38)

**Depends on.** Task 62.

**Gap.** TEST-SPEC §10.2, T10.2-1 (revised): "Item IDs (10.2: never containing U+FFFD …): every item `id` any test observes, in any `review` output — P-9's draws included — is a well-formed argument value (12.0), free of U+FFFD and of unpaired surrogates, and each representative item here is named by its `id`: `review show <name> <id>` presents that item, exit 0." `test/helpers/adapters/review.ts` (about line 197) only checks that an `id` is non-empty. T10.3-2 (revised): "`resolve` on the dependent is refused — in T10.7-14's finding form, nothing modified — until the blocker is …"; `test/suite/registry/section-10.2-10.3.ts` checks exit 1 and "unchanged" only.

**Change.** The review adapter's item-`id` decode (every site that decodes an item `id`: status rows, items, `next`, `export`, `blockedBy` entries) requires a well-formed argument value per 12.0 — no U+FFFD, no unpaired surrogate, and whatever else 12.0's argument-value rule bars — failing loudly otherwise (S-5 vectors: an id holding U+FFFD, and one holding a lone surrogate, each rejected); T10.2-1's representative items each named by its `id` through `review show`, exit 0, presenting that item. T10.3-2's refused resolve through Task 62's shared check. Titles and comments.

**Checks.** T10.2-1 and T10.3-2 against the built product: record verdicts; every other review test still decodes (the self project's S-7 sweep and a run of the §10 tests against the built product, recorded).

### Task 67 — T10.4-2's journal-deletion arm (RB-39)

**Gap.** TEST-SPEC §10.4, T10.4-2 (revised), the journal arm: "in an audit session over a file with top-level leaf sections `a` and `s`, `xspec rename` `a`→`b`; `a`'s item — presented under `b` thereafter (10.4) — is resolved `no-change`; `.xspec/journal` is then deleted manually …. Reads present the item `invalidated`, its scope node absent under `a`, the recorded identity mapped forward through the now-empty journal (10.4); once `s`'s item is resolved `updated`, a distinct item scoped at `b` enters, `unresolved`, the original keeping its `id` and stored status (`list` counting it `no-change`)." `test/suite/registry/section-10.4.ts` lacks it.

**Change** (`section-10.4.ts`): the arm as stated, every read (`status`, `show`, `export`) presenting the item as stated; title and comments.

**Checks.** T10.4-2 against the built product: record the verdict.

### Task 68 — T10.4-3's K1/K2 fixture (RB-40)

**Gap.** TEST-SPEC §10.4, T10.4-3 (revised; read it whole): path-blocks fixture — top-level `A` with children `K1` and `K2`, `K1`'s text edited before `create --base`; `K1`'s `subtree-coherence` item and then `A`'s `parent-consistency` item (context and origin `{K1}`, `blockedBy` `K1`'s item) resolved; then `K2`'s text edited, with no re-derivation. `A`'s item reads `invalidated`; `show`, `next --json`, and `export` present its `context` as exactly `{K1, K2}`, while `origin` stays `{K1}` and `blockedBy` `K1`'s item alone (as last assigned); the session file stays byte-identical; `reason` captured from `show` and `export` once both resolves are done is byte-identical after `K2`'s edit and again once `A`'s item is then resolved `no-change`. `test/suite/registry/section-10.4.ts` asserts invalidation only.

**Change** (`section-10.4.ts`): the fixture and every assertion as stated (`reason` compared byte for byte between captures, its content never asserted); title and comments.

**Checks.** T10.4-3 against the built product: record the verdict.

### Task 69 — T10.4-4's decomposition arm (RB-41)

**Gap.** TEST-SPEC §10.4, T10.4-4 (revised), decomposition arm: in an audit session over a file with top-level `a` holding `a.x` and a top-level leaf `s`, split `a`'s item; `rename` `a`→`b`; resolve `s`'s item `updated`: no `subtree-coherence` item scoped at `b` enters — the decomposition recorded against old-`a` applies to `b`, its items keeping their `id`s and statuses under the current identities, and `export` presents the recorded decomposition's scope node as `b`; then author a new top-level leaf `a` and resolve `s`'s item `updated` again: new-`a`'s `subtree-coherence` item enters, `unresolved`, and the root item's `blockedBy` gains it. `test/suite/registry/section-10.4.ts` lacks it. `export`'s decompositions are opaque in the adapter today (Task 136 decodes them for P-9; decode the scope node here as this arm needs, shared with that task).

**Change** (`section-10.4.ts`, and the review adapter's `decompositions` decode as far as this arm needs, with an S-5 vector): the arm as stated; title and comments.

**Checks.** T10.4-4 against the built product: record the verdict.

### Task 70 — T10.4-6 registered: context as last assigned (RB-10)

**Gap.** TEST-SPEC §10.4, T10.4-6 (new; read it whole): path-blocks fixture — `X`'s `d` names `T1` and `T2`, `T1` depends on `U1` and `T2` on `U2`; `U1` edited before `create --base` (`X`'s `dependency-consistency` item context `{T1}`), `U2` after it with no re-derivation (reads then present `{T1, T2}`). (a) Resolve assignment: `X`'s item resolved `no-change` reads `no-change` with context `{T1, T2}`; both upstream edits reverted, it still reads `no-change`, context exactly `{T1, T2}`. (b) Re-derivation assignment, on a twin: `X`'s item resolved `no-change` before `U2`'s edit; after it, `U1`'s item resolved `updated` (re-derivation assigns `{T1, T2}`; `X`'s item reads `invalidated`); both edits reverted: `X`'s item still `invalidated`, context `{T1, T2}`; its `reason`, captured right after the `updated` resolve from `show` and `export`, byte-identical after each revert.

**Change** (`test/suite/registry/section-10.4.ts`): register T10.4-6 with (a) and (b); H-7 entry (`"10.4"`, plus `"10.5"` for the re-derivation if the map's rules call for it).

**Checks.** T10.4-6 against the built product: record verdicts.

### Task 71 — T10.4-7 registered: recording after re-derivation; joined nodes (RB-11)

**Gap.** TEST-SPEC §10.4, T10.4-7 (new; read it whole): fixture — `X` depends on `T`, and `T` on `D1` and `D2`, each a top-level section in its own file; `D1` edited before `create --base` (`X`'s `dependency-consistency` item: context `{T}`, origin `{D1}`), `D2` after it. (a) `X`'s item resolved `updated`: `D2` joins the origin, presented `{D1, D2}`, the item reads `updated`; one edit then removes `T`'s reference to `D2` and deletes `D2`'s section: hashes unchanged, context still `{T}`, so `X`'s item reads `invalidated` through `D2`'s recorded presence alone. (b) Twin: `X`'s item resolved `no-change` before `D2`'s edit; after it, `D1`'s item resolved `updated`: `D2` joins `X`'s origin, `X`'s item still reads `no-change`, and still does after the same edit.

**Change** (`test/suite/registry/section-10.4.ts`): register T10.4-7 with (a) and (b), its fixture exported for Tasks 78 and 86 (T10.2-2's `D2` and T10.7-12's origin pair use T10.4-7(a)'s shape); H-7 entry.

**Checks.** T10.4-7 against the built product: record verdicts.

### Task 72 — T10.5-1's origin arms (RB-42)

**Gap.** TEST-SPEC §10.5, T10.5-1 (revised): each item's origin asserted beside its scope and context; the skipping arm — top-level `P` and its child `Q`, each edited, yield `P`'s `subtree-coherence` item and no item at `Q`, origin exactly `{P, Q}`; the union arm — `A` with child `X` and grandchild `Y` beneath child `K`, `X` and `Y` edited: `A`'s single item context exactly `{X, K}` and origin exactly `{X, Y}`, `K`'s item context and origin `{Y}`, `X`'s and `Y`'s `subtree-coherence` origins `{X}` and `{Y}`; the deep arm — both items' origin exactly `{C}`; and with both `B`'s and `C`'s own text edited (A → B → C): `B`'s `subtree-coherence` origin exactly `{B, C}`, `A`'s `parent-consistency` context exactly `{B}` and origin exactly `{B, C}`. Reviewer B: the A/X/K/Y union arm and the A→B→C both-edited arm are missing (and origins are not asserted beside scope and context).

**Change** (`test/suite/registry/section-10.5.ts`): every T10.5-1 item's origin asserted; the missing arms added; title and comments.

**Checks.** T10.5-1 against the built product: record verdicts.

### Task 73 — T10.5-3's current-graph, origin-counting, and one-item-per-location arms (RB-43)

**Depends on.** Tasks 5, 63.

**Gap.** TEST-SPEC §10.5, T10.5-3 (revised; read it whole): "Current-graph edges (10.5: a dependency edge in the current graph): `X` whose only `d` reference to `T` stands at the baseline alone — removed since, while an edit to `T`'s upstream `U` changed `T`'s effectiveHash — gets its `metadata-consistency` item (context `{T}`) and no `dependency-consistency` item. Origin counting: `X` depending on `T` and `T` on `U`, with `U`'s text edited and `T`'s tags edited (and, in a second staging, `T`'s coverage attribute instead …), gives `X`'s `dependency-consistency` item origin exactly `{U}` …; a twin in which `T`'s `d` set changes instead, gaining a reference to an unedited `W`, gives exactly `{T, U}`. A code location whose marker targets `T` … has origin exactly `{U}` under the first stagings and `{T, U}` under the twin. One item per location …: T9.2-4's location, impacted in both code categories, staged in a baseline (`path-blocks`) session, gets exactly one `code-impact` item, its context exactly the two targets and its origin exactly their originating nodes". `test/suite/registry/section-10.5.ts` lacks these.

**Change** (`section-10.5.ts`): the three arm families as stated (T9.2-4's location staged as T9.2-4's entry stages it); title and comments.

**Checks.** T10.5-3 against the built product: record verdicts per arm.

### Task 74 — T10.5-5's matching, kept-`blockedBy`, skipping, revert, and decomposition arms (RB-44)

**Depends on.** Task 62.

**Gap.** TEST-SPEC §10.5, T10.5-5 (revised; read it whole — `tdiff.py` shows each new sentence). Reviewer B's missing arms: (1) N/V matching — two visited top-level sections `N` and `V`; `N`'s item resolved `no-change` with `--note`, a child added under `N`, `V`'s item resolved `updated`: `N`'s item keeps its `id`, note, and `current` byte for byte; its scope and origin include the child only after the re-derivation; it reads `invalidated`, never `unresolved`; `list` counts it `no-change`. (2) A/K1/V — a path-blocks session over `A` holding `K1`, and `V`, `K1` and `V` edited before `create`; `K1`'s edit reverted and `V`'s item resolved `updated`: `A`'s item, no longer generated, keeps `blockedBy` exactly `K1`'s item in `export`, `status` reports it blocked while `K1`'s item is unresolved, its `resolve` is refused in T10.7-14's form, nothing modified, and once `K1`'s item is resolved, `A`'s reads unblocked and resolves. (3) P/Q skipping — `P` edited before `create`, its child `Q` after; `P`'s item resolved `updated` leaves no item at `Q`, `P`'s origin now `{P, Q}`. (4) Newly visited after an ancestor's revert — `P` and `Q` both edited before `create`; `Q` edited again and `P`'s edit reverted; `P`'s item resolved `updated`: `Q`'s `subtree-coherence` item and `P`'s `parent-consistency` item (context and origin `{Q}`, `blockedBy` `Q`'s item) enter, `unresolved`, `P`'s `subtree-coherence` item remaining. (5) In the decomposition sub-fixture, `context` gaining the new child (today only `blockedBy` is checked).

**Change** (`test/suite/registry/section-10.5.ts`): the five arms; the refusal in (2) through Task 62's check; T10.5-5's newly visited `Q` (T10.5-5's own P/Q arm, the one T10.2-2, T10.2-4, and T10.4-8 cite) exported for Tasks 78 and 84; title and comments. If the five do not fit one spawn, split per the *Size* rule ((1)–(2) first).

**Checks.** T10.5-5 against the built product: record verdicts per arm.

### Task 75 — T10.5-7 registered: embedding edges and a root-sourced embedding (RB-13)

**Gap.** TEST-SPEC §10.5, T10.5-7 (new; read it whole): `specs/B.mdx` holds `t`; `specs/A.mdx` imports `./B.xspec` as `B` and holds a top-level `{text(B.t)}` outside every section, a section `e` holding only `{text(B.t)}`, and a section `f` spelled `d={B.t}` holding `{text(B.t)}`; `src/show.ts` calls `text(B.t)` in `show`, `src/echo.ts` calls `text(A.e)` in `echo`; no marker. Baseline committed, `t` edited: `review create --base` yields exactly six items in the stated order with the stated contexts, origins, and empty `blockedBy`; `e`, `f`, and `specs/A.mdx`'s root get no `subtree-coherence` item; the root item's scope text in `show` and `export` is the root's own text, byte-asserted.

**Change** (`test/suite/registry/section-10.5.ts`): register T10.5-7; H-7 entry (`"10.5"`, plus `"9.2"`/`"10.7"` as its body asserts them, per the map's rules).

**Checks.** T10.5-7 against the built product: record the verdict.

### Task 76 — T10.5-8 registered: a `changed` root (RB-14)

**Gap.** TEST-SPEC §10.5, T10.5-8 (new; read it whole): `specs/R.mdx` holds top-level text, `a` with child `a.b`, and `c`; `specs/S.mdx` holds `x` with child `x.y`; after the baseline, `a.b` and `x.y` edited, a top-level `d` added to `specs/R.mdx`, and its top-level text edited: exactly three items in order — (1) `x.y`'s `subtree-coherence`, (2) `x`'s `parent-consistency`, (3) `specs/R.mdx`'s root's `subtree-coherence` (scope the root and every section; context empty; origin exactly `{specs/R.mdx, specs/R.mdx#a.b, specs/R.mdx#d}`), item (3)'s `baseline` holding the baseline hashes for the root, `a`, `a.b`, `c` and, for `d`, an entry presenting it absent with the explicit absent marker; no item at `a.b`, `a`, or `d`; item (3)'s scope text the root's subtree text, `specs/R.mdx`'s entire compiled Markdown output; a twin without the top-level-text edit yields the same three items.

**Change** (`test/suite/registry/section-10.5.ts`): register T10.5-8 with both stagings, the fixture exported for Task 78 (T10.2-2's item (3)); H-7 entry.

**Checks.** T10.5-8 against the built product: record the verdict.

### Task 77 — T10.5-9 registered: deleted and moved nodes in baseline sessions (RB-15)

**Gap.** TEST-SPEC §10.5, T10.5-9 (new; read it whole): the deleted-node fixture (`A` > `A.B` > `A.B.C`, `A.B.C` deleted: exactly `A.B`'s `subtree-coherence` item — scope `{A.B, A.B.C}`, `A.B.C` absent under its baseline identity, context the root and `A`, origin `{A.B, A.B.C}` — and `A`'s `parent-consistency` item — context `{A.B}`, origin `{A.B, A.B.C}`, `blockedBy` `A.B`'s item), with every text and `current` hash byte-equal to `query node`'s and `A.B.C`'s token in no text; the journal arm (`rename` `A.B`→`A.B2`, then `A.B2.C` deleted: the deleted node presented absent under `A.B2.C`); the audit contrast; and the present-node arm (`move specs/R.mdx#P1.M specs/R.mdx#P2.M`, then `P2.M.c` deleted: exactly `P1`'s and `P2`'s items as stated), with its twin stopping before the deletion.

**Change** (`test/suite/registry/section-10.5.ts`): register T10.5-9 with every arm; H-7 entry (`"10.5"`, `"10.4"`, `"10.6"` as asserted).

**Checks.** T10.5-9 against the built product: record verdicts per arm.

### Task 78 — T10.2-2's re-derivation entries; T10.2-4's re-derived `current` (RB-36, RB-37)

**Depends on.** Tasks 71, 74, 76.

**Gap.** TEST-SPEC §10.2, T10.2-2 (revised): in a `--base` session, T10.5-5's newly visited `Q` has a `baseline` holding `Q`'s values at the recorded baseline commit, never those at the re-derivation (each captured via `query node`); in an audit session, a section authored after `create` enters with the values at its re-derivation; T10.5-8's item (3), whose scope holds `d` added since the baseline, has an entry for `d` presenting it absent with the explicit absent marker; T10.4-7(a)'s `D2`, joining `X`'s origin at a re-derivation, has no entry in `X`'s `baseline`, while `X`'s `current` carries `D2`'s presence once the resolve records it. T10.2-4 (revised): T10.5-5's newly visited `Q`, whose item enters at `P`'s `updated` resolve, reports `current` equal to `Q`'s subtreeHash and metadataHash captured via `query node` at that resolve — never its `baseline` values — and still equal after a further edit to `Q`'s text, its item staying `unresolved`. `test/suite/registry/section-10.2-10.3.ts` lacks these.

**Change** (`section-10.2-10.3.ts`): the arms as stated, reusing the exported stagings of Tasks 71, 74, and 76; titles and comments.

**Checks.** T10.2-2 and T10.2-4 against the built product: record verdicts.

### Task 79 — T10.6-3's leaf-parent arm and new item's `current` (RB-45)

**Gap.** TEST-SPEC §10.6, T10.6-3 (revised): the new node's item appears with status `unresolved` "and its `current` equal to the new node's subtreeHash and metadataHash captured via `query node` at the re-derivation … — still equal to them after a further edit to the new section's text, its item staying `unresolved`"; existing items keep their `id`, status, note, and recorded state and take the generated scope: "the new section's parent — a leaf at `create` — had its item resolved `no-change` with `--note` before the section was authored, and the `updated` resolve is another item's; the parent's item keeps its `id`, its note, and its `current` byte-for-byte, presents after the re-derivation the scope with the child — before it, the scope as last assigned (10.4) — and reads `invalidated` …, never `unresolved`, its stored status kept"; and a new node's item enters only through a re-derivation, at an `updated` resolve or at the end of a `split`. `test/suite/registry/section-10.6.ts` lacks the leaf-parent arm (reviewer B) and the `current` capture.

**Change** (`section-10.6.ts`): the arm and the `current` assertions as stated; title and comments.

**Checks.** T10.6-3 against the built product: record the verdict.

### Task 80 — T10.7-1's case-insensitive corrupt-name arms and strategy values (RB-46)

**Depends on.** Task 62.

**Gap.** TEST-SPEC §10.7, T10.7-1 (revised; read it whole): `--strategy` values `bogus`, `path-blocks`, and `coverage` each a syntax-class error (with the configuration file invalid or missing too, `code` `null`; T12.0-10 covers `bogus` only); `create` with an existing name refused in T10.7-14's form; `review create --strategy audit --name Foo` beside a corrupt `foo.json` reports exactly one condition-21 finding concerning `.xspec/reviews/foo.json`, exit 1, no `Foo.json` written; on the Linux leg three arms each holding both `.xspec/reviews/foo.json` and `.xspec/reviews/FOO.json` — (i) both corrupt: `--name Foo` exits 1 with exactly two condition-21 findings, `FOO.json`'s then `foo.json`'s, no refusal; (ii) `foo.json` valid, `FOO.json` corrupt: `--name Foo` and `--name foo` each exactly one condition-21 finding concerning `FOO.json`, no refusal; (iii) both valid: `--name Foo` exactly one code-less refusal — nothing written in any arm (a valid `FOO.json` written by the product in a twin workspace and copied in).

**Change** (`test/suite/registry/section-10.7-i.ts`): the arms as stated (refusals through Task 62's check); title and comments.

**Checks.** T10.7-1 against the built product: record verdicts per arm.

### Task 81 — T10.7-7's full-resolution arm (RB-47)

**Depends on.** Task 63.

**Gap.** TEST-SPEC §10.7, T10.7-7 (revised): the payload carries "a `metadata-consistency` item's metadata pair (T10.7-13)"; and "Full resolution concerns the session's items alone …: an audit session with every item resolved, then a new spec source holding one section added …: `next` still exits 0 and reports the session fully resolved, no item in its JSON payload; once a resolved leaf item is re-resolved `updated`, `next` returns the new section's item, `unresolved` and the first unblocked item needing review." `test/suite/registry/section-10.7-ii.ts` lacks the full-resolution arm (and the payload's metadata pair, if T10.7-7's payload arm stages a `metadata-consistency` item — assert it through Task 63's decode).

**Change** (`section-10.7-ii.ts`): the arm (the added source an S-9 record); title and comments.

**Checks.** T10.7-7 against the built product: record the verdict.

### Task 82 — T10.7-9's path-blocks fixture: arms (a), (b), (c), (f), (g) (RB-48, part)

**Depends on.** Tasks 4, 62.

**Gap.** TEST-SPEC §10.7, T10.7-9 (revised; read it whole). The path-blocks fixture: top-level `N` with children `N.a` and `N.b`, and `M` with child `M.k`; `N`'s and `N.a`'s text edited before `create --base` (`N` visited, scope `{N, N.a, N.b}`); `N`'s item resolved `no-change`; `M.k` then edited; `N`'s item split. Path-blocks arms: (a) `N.a`'s and `N.b`'s items have empty `blockedBy`, `N`'s `parent-consistency` item's exactly those two; (b) `N.a`'s origin exactly `{N.a}`, `N.b`'s exactly empty, `N`'s `parent-consistency` item's exactly `{N, N.a}`; (c) once the split exits, `M.k`'s `subtree-coherence` item and `M`'s `parent-consistency` item (context and origin `{M.k}`, `blockedBy` `M.k`'s item) are in the session, `unresolved`, in item order; (f) a session over `P` whose only children `P.a` and `P.b` were deleted before `create`, split into absent-scoped per-child items (origins `{P.a}`, `{P.b}`, context the file root and `P`) and `P`'s `parent-consistency` item (context `{P.a, P.b}`, origin `{P, P.a, P.b}`), with the texts and hashes the arm pins (tokens absent from `P`'s scope texts; per-child scope texts and context texts the baseline subtree texts); (g) the twin nested under `G`: `G`'s `parent-consistency` item blocked by exactly `G.N`'s item before the split, then by exactly `G.N.a`'s, `G.N.b`'s, and `G.N`'s `parent-consistency` items, and still by exactly those three after `G.N.a`'s item is resolved `updated` — each read from `export`. `test/suite/registry/section-10.7-ii.ts` lacks them.

**Change** (`section-10.7-ii.ts`): the path-blocks fixture and arms (a), (b), (c), (f), (g) as stated, in a git-repository workspace for the baseline; T10.7-9(f)'s per-child item scoped at the absent `P.a` exported for Task 84 (T10.4-8(c)); title and comments.

**Checks.** T10.7-9 against the built product: record verdicts per arm.

### Task 83 — T10.7-9's audit fixture, arms (a)–(e), and its refusals (RB-48, rest)

**Depends on.** Task 82.

**Gap.** TEST-SPEC T10.7-9's audit fixture: top-level `N` with `N.a` (holding `N.a.x`) and `N.b`, and a top-level leaf `s`; after `create`, `N.b`'s item resolved `no-change` with `--note`; `N.a`'s item split; then `N.c` holding `N.c.y` authored under `N` and `N.b.z` under `N.b`; `N`'s item split. Audit arms: (a) `N.c`'s new item's `blockedBy` exactly `N.c.y`'s item; (b) every decomposition item's origin empty; (c) `N.c.y`'s and `N.b.z`'s items enter at `N`'s split; (d) recursion — no item scoped at `N.a`, now or at any later re-derivation; `N`'s `parent-consistency` item's context exactly `{N.a, N.b, N.c}` and `blockedBy` exactly `N.a.x`'s item, `N.a`'s `parent-consistency` item, `N.b`'s item, and `N.c`'s item; the root's item blocked by exactly those four, `N`'s `parent-consistency` item, and `s`'s item; (e) reuse — `N.b`'s item keeps its `id`, note, `current`, and stored status (`list` counts it `no-change`; reads `invalidated`), and takes the scope `{N.b, N.b.z}` and the `blockedBy` `N.b.z`'s item; `N.a.x`'s item and `N.a`'s `parent-consistency` item keep their `id`s. Refusals (exit 1, T10.7-14's form, nothing modified), beside the successful splits: `split` of an item of another kind; of a `subtree-coherence` item whose scope root has no children — a leaf's (`s`'s) and, in an audit session over `Q` holding `Q.r`, `Q`'s item once `Q.r` is deleted by manual edit after `create`.

**Change** (`section-10.7-ii.ts`): the audit fixture, arms (a)–(e), and the refusals through Task 62's check — the existing h/h.a/h.b audit fixture adapted or replaced as T10.7-9's text now stages it; T10.7-9's audit session exported for Task 84 (T10.4-8(b)); title and module header complete.

**Checks.** T10.7-9 against the built product: record verdicts per arm.

### Task 84 — T10.4-8 registered: items added during a session (RB-12)

**Depends on.** Tasks 74, 83.

**Gap.** TEST-SPEC §10.4, T10.4-8 (new; read it whole): (a) T10.5-5's newly visited `Q` — its item, entered at `P`'s `updated` resolve, resolved `no-change`, then `Q` edited: reads `invalidated`, `list` counting `no-change`; (b) in T10.7-9's audit session, once T10.7-9(c)–(e) are asserted, `N.c.y`'s item resolved `no-change`, then `N.c`'s likewise; `N.c.y` edited: both read `invalidated`; (c) T10.7-9(f)'s per-child item scoped at the absent `P.a`, resolved `no-change`, reads `no-change`, and still does after `P.b`'s item is resolved `updated` and the session re-derived.

**Change** (`test/suite/registry/section-10.4.ts`): register T10.4-8 reusing the exported stagings (Tasks 74, 82, 83); H-7 entry.

**Checks.** T10.4-8 against the built product: record verdicts.

### Task 85 — T10.7-10's note replacement; T10.7-11's kept note (RB-49, RB-50)

**Depends on.** Task 62.

**Gap.** TEST-SPEC §10.7, T10.7-10 (revised): resolving a blocked item refused "(exit 1, T10.7-14's finding form, nothing modified)"; "each resolve replaces the note …: a resolve with `--note n1`, then one with `--note n2`, leaves exactly `n2` in `show` and `export`; a further resolve without `--note` leaves the item no note in either". T10.7-11 (revised): an item matching by kind and scope node keeps its `id`, status, note, and recorded state — "one resolved with `--note` before the re-derivation presenting its note after it". `test/suite/registry/section-10.7-ii.ts` lacks both (and T10.7-10's refusal form).

**Change** (`section-10.7-ii.ts`): T10.7-10's note sequence and its refusal through Task 62's check; T10.7-11's note arm; titles and comments.

**Checks.** T10.7-10 and T10.7-11 against the built product: record verdicts.

### Task 86 — T10.7-12's property-member locations, split context texts, joined origin pair, and provenance arms (RB-51)

**Depends on.** Task 71.

**Gap.** TEST-SPEC §10.7, T10.7-12 (revised; read it whole): present impacted locations among them "two property members, each holding a marker on a section edited since the baseline, `m = () => { SPEC.a };`, its range running through its `;`, and a decorated `@dec n = () => { SPEC.a };`, from its `@` through its `;` (1.7)", byte-asserted; the context texts of a split-produced `parent-consistency` item (every child of the scope root); `D2`'s origin pair on T10.4-7(a)'s fixture — before its baseline text, after its current text, never the join-time text; absent-node provenance (i) on the context node with `K1`'s own item resolved `updated` (sub-fixture: top-level `A` holding `K1`, `K1` edited before `create` and deleted after it), and (iii) the resolve-time state arm (`N` holding unedited `N.c`, `N` edited before and after `create`, `N`'s item resolved `no-change`, then `N` deleted: its scope root presented absent with the resolve-time subtree text). Reviewer B: these are missing (sub-fixture B today resolves dm's item and checks px.x's scope only).

**Change** (`test/suite/registry/section-10.7-ii.ts`): the arms as stated (T10.4-7(a)'s fixture from Task 71's export); title and comments.

**Checks.** T10.7-12 against the built product: record verdicts per arm.

### Task 87 — T10.7-15 registered: fixtures A and B, arms (a) and (b) (RB-18, part)

**Depends on.** Tasks 8 (the graph-data staging), 62.

**Gap.** TEST-SPEC §10.7, T10.7-15 (new, "Outcome order past the gate"; read it whole). Fixtures: (A) `specs/A.mdx` holding top-level `P` with child `P.c`, `Q` with child `Q.r`, and leaves `s` and `u`; on the built workspace an audit session `a` created and `Q`'s item split, and a second session `x` made corrupt (T10.1-4's garbage bytes); (B) a git workspace holding top-level `G` with child `G.N`, and leaf `v`; `G.N` edited after commit `c1`, then `review create --base c1 --name b`, and the recorded baseline then made irreconstructible by T10.7-3's staging (the repository removed). Stale graph data staged by editing `u`'s (A) or `v`'s (B) text, no rebuild, no read since; each invocation on its own copy of its staged state, T13.3-2's operational path set compared around it. (a) Stale stays stale: on the stale states, the refused `resolve`/`split` runs (T10.7-14's form), the unknown-item runs (exit 2, `code` `null`), the corrupt-session runs (exactly the condition-21 finding), and `status b` (the baseline's plain usage error) each leave graph data byte-identical, `check` afterwards still reporting the unit form beside the edited source's per-file staleness. (b) The same invocations with the graph-data area also staged unwritable by T14-9's graph-data staging (Task 8; for `resolve` and `split` applied while each is held at the seam, after acquisition): each reports exactly its (a) outcome, never `write-failure`, release's refused deletions changing no outcome.

**Change.** Register T10.7-15 (where Task 62 put the new §10.7 tests) with both fixtures (exported within the module for Tasks 88–89) and arms (a) and (b), (b)'s staging `graphDataRefusal()` (`write-refusal-staging.ts`, Task 8; under it a held run's release deletes its entry and is refused the emptied lock directory's deletion); held runs through the 13.5 seam helpers the module family uses; H-7 entry (`"10.7"`, `"13.3"`, `"14"`, per the map's rules); the title and header say (c)–(g) follow in Tasks 88–89.

**Checks.** T10.7-15 against the built product, alone under the namespace: record verdicts per arm.

### Task 88 — T10.7-15's arms (c) and (d) (RB-18, part)

**Depends on.** Task 87.

**Gap.** TEST-SPEC T10.7-15: (c) graph judgements against the current workspace, each on a freshly built twin of (A) with its own unsplit audit session `a`, edited by hand with no rebuild or read before the invocation: (i) `P.c`'s item resolved `no-change`, then `P.c` edited — `resolve a <P's item> --status no-change` refused at once (T10.7-14's form); (ii) `Q.r` deleted — `split a <Q's item>` refused; (iii) a child `s.t` authored under `s` — `split a <s's item>` succeeds, the session gaining `s.t`'s `subtree-coherence` item and `s`'s `parent-consistency` item (context `{s.t}`, `blockedBy` `s.t`'s item), graph data refreshed before the session write (`check` afterwards: the per-file staleness, no unit form). (d) The recorded baseline's place: on (B)'s state, `resolve b <G's parent-consistency item> --status no-change` and `split b <G's parent-consistency item>` each exit 2 with the baseline's plain usage error, `code` and `path` `null`, never a refusal; with `b`'s file corrupted by T10.1-4's `blockedBy`-cycle staging, `status b`, `resolve b <G.N's item> --status no-change`, and `split b <G's parent-consistency item>` each exit 1 with exactly the condition-21 finding; once a source of (B) fails `build`'s validations, each of `status`, `next`, `show`, `export`, `resolve`, `split` naming `b` reports exactly the gate's findings, exit 1; and the unstageable step (the unknown item ID's place before the recorded baseline) recorded in a module comment as T6.5-6 records its unstageable clauses.

**Change** (`section-10.7-*.ts`, T10.7-15): arms (c) and (d); title and header.

**Checks.** T10.7-15 against the built product: record verdicts per arm.

### Task 89 — T10.7-15's arms (e), (f), and (g) (RB-18, rest)

**Depends on.** Task 88.

**Gap.** TEST-SPEC T10.7-15: (e) `list`'s place — on (A)'s stale state `review list` reports `x` corrupt beside `a`, exit 1, graph data refreshed; with the graph-data area staged unwritable (T14-9's graph-data staging) it exits 2, `code` `"write-failure"`, `path` `".xspec"`, stdout exactly that document; with `.xspec/reviews` staged unlistable instead (T14-10(h)'s staging) it exits 2, `code` `"read-failure"`, `path` `".xspec/reviews"`, graph data byte-identical. (f) The session directory's place: (i) behind the gate — on twins of (A) failing validation by an id-less section, `review create --strategy audit --name a`, `--name x`, and `--name A` each report exactly the gate's one condition-1 finding, exit 1, nothing written; with `.xspec/reviews` a plain file, `create --name n` likewise, never condition 22; with `.xspec/reviews` unlistable, `review list` and `create --name n` likewise, never `read-failure`; (ii) behind the errors ahead of the gate — on a git twin of (A) passing validation, `create --coverage nope --name a` and `create --base nope --name a` each exit 2 `code` and `path` `null`, and with a garbage journal line `create --base c1 --name a` exits 2 `journal-error`, never the existing-name refusal; on that twin's stale state `create --base nope --name a` exits 2 with graph data byte-identical and still stale. (g) The item ID's place behind the gate — on (f)(i)'s failing twin, `show a <unknown-id>`, `resolve a <unknown-id> --status no-change`, and `split a <unknown-id>` each report exactly the gate's finding, exit 1, never the unknown-item exit 2 they give on (A)'s stale state.

**Change** (`section-10.7-*.ts`, T10.7-15): arms (e), (f), (g), (e)'s graph-data staging `graphDataRefusal()` (Task 8); the title and header complete.

**Checks.** T10.7-15 against the built product, alone under the namespace: record verdicts per arm.

### Task 90 — T11-2's row and `--file` arms; T11.3-2's `**/../x/*.mdx` (RB-52, RB-57)

**Gap.** TEST-SPEC §11.1, T11-2 (revised): the rows are requirement nodes, one per node, never code locations — on a workspace configuring spec groups `p` (`specs/**/*.mdx`) and `q` (`specs/shared/*.mdx`) over `specs/x.mdx` and `specs/shared/S.mdx` (the latter in both groups) and a code group `app` (`src/*.ts`) over `src/x.ts` and `src/y.ts`, whose markers and `text(...)` calls at top level and inside `f` and `C`'s method `m` reference sections of both spec sources: unfiltered `query nodes` returns exactly the two spec sources' roots and sections, each once (no code location, no node repeated for its second group); `--group p` returns both sources' nodes and `--group q` those of `specs/shared/S.mdx` alone, each once; `--file 'src/*.ts'` → exit 0 with no rows; `--file '**/x.*'` returns the nodes of `specs/x.mdx` alone; among the outside-root `--file` patterns `**/../x/*.mdx` → exit 2; the inside patterns matching nothing (`./specs/*.mdx`, `specs//*.mdx`) staged over spec sources under `specs/` that each pattern's normalization matches. T11.3-2 (revised): `occurrences --file '**/../x/*.mdx'` → exit 2 (invalid flag value, T7-4), and `./specs/*.mdx` staged over discovered sources under `specs/` holding occurrences that its normalization matches. `test/suite/registry/section-11.ts` and `section-11.3.ts` lack these.

**Change** (`section-11.ts`, `section-11.3.ts`): the arms as stated; titles and comments.

**Checks.** T11-2 and T11.3-2 against the built product: record verdicts.

### Task 91 — T11.2-2's structural-validity chain arm (RB-53; certified, CONF-AVAIL)

**Gap.** TEST-SPEC §11.2, T11.2-2 (revised): "structural validity is a chain condition too (11.2 …) — a well-formed, uniquely spelled `m.n` nested inside `k`, with its structurally consistent child `m.n.o`, and separately a top-level `q.r` with its child `q.r.s`: `m.n` and `q.r` unavailable (structurally invalid), `m.n.o` and `q.r.s` unavailable by inheritance, `k` defined, beside exactly one 14.2 finding per invalid bearer (none for `m.n.o` or `q.r.s` …), and same-file `d={"m.n"}` and `{text("m.n.o")}` report 14.5 and 14.6, recording no occurrence". `test/suite/registry/section-11.2.ts` lacks it. Reviewer D: the CONF-AVAIL conformer handles the arm (14.2 per invalid bearer, 14.5/14.6, no occurrence); §CONF-AVAIL's staging constraints (no MDX comments; T11.2-2 drives `view` only) bind the new arm.

**Change** (`section-11.2.ts`): the arm through `view` (and `view --text` where the test reads texts) as the constraints allow; title and comments.

**Checks.** CONF-AVAIL family alone: the conformer passes T11.2-2; NULLMARKER and OMIT fail it (fixture runner: record the first lines; the new arm's unavailable datums are among what they mangle); NOFILE passes it. T11.2-2 against the built product: record the verdict.

### Task 92 — T11.2-3's target-side arm (RB-54)

**Gap.** TEST-SPEC §11.2, T11.2-3 (revised): "a discovered `specs/a'b.mdx` (7.1's bar, T7.1-1) holding a section `x` is imported by a spec source `specs/A.mdx` as `import B from "./a'b.xspec"` and by a code source as `import B, { text } from "../specs/a'b.xspec"` — each import valid, its target discovered (2.1, 4), `view specs/A.mdx` listing the import with target `specs/a'b.mdx`, a path and never an identity (T11.4-4). `specs/A.mdx` spells `d={B.x}`, `d={B}`, and `{text(B.x)}`, the code source the marker `B.x` and the call `text(B.x)`: `build` and `check` report 14.5 for each `d` reference, 14.6 for the embedding, and 14.7 for the marker and for the call, beside `specs/a'b.mdx`'s condition 19, exit 1; no edge and no occurrence — `occurrences` lists none for the five spellings …; `occurrences --to "specs/a'b.mdx#x"` and `occurrences --to "specs/a'b.mdx"` are accepted … and each selects nothing, the domain's findings accompanying, exit 1, never exit 2". `test/suite/registry/section-11.2.ts` lacks it.

**Change** (`section-11.2.ts`): the arm as stated; title and comments.

**Checks.** T11.2-3 against the built product: record the verdict.

### Task 93 — T11.2-4's own-versus-subtree arm (RB-55; certified, CONF-AVAIL)

**Depends on.** Task 15 (the conformer's contains-edge cycles).

**Gap.** TEST-SPEC §11.2, T11.2-4 (revised): "Own text and subtree text are judged apart …: a section `p` whose own contribution holds no embedding, with a child section `p.c` holding the unresolved `{text("missing")}` — and, staged separately, `p.c` holding `{text("p")}` instead, so that expanding `p`'s subtree re-enters `p` (an embedding cycle; 14.9 …) — under `view --text`: `p`'s own text a plain value, byte-equal to its precomputed own text …, and its subtree text explicitly unavailable; `p.c`'s own and subtree text unavailable; the file's findings accompanying, exit 1". `test/suite/registry/section-11.2.ts` lacks it. §CONF-AVAIL's staging constraint: T11.2-4 runs `occurrences` without `--file`.

**Change** (`section-11.2.ts`): both stagings under `view --text`, the findings form-exact (14.6 for the first, the one 14.9 for the second, as Task 15's conformer and SPEC 14 locate it); title and comments.

**Checks.** CONF-AVAIL family alone: the conformer passes T11.2-4; NULLMARKER and OMIT fail it; NOFILE passes it. T11.2-4 against the built product: record the verdict.

### Task 94 — T11.2-6's passing-side and mode-000 `out` arms (RB-56)

**Depends on.** Task 22.

**Gap.** TEST-SPEC §11.2, T11.2-6 (revised; read it whole): (1) on a workspace passing `build`'s validations that violates a `forbidden` rule (T7.5-2's staging, the offending `d` in `specs/A.mdx`), and separately one holding a corrupt session (T10.1-4's garbage bytes), `check` reports 14.12, respectively 14.21, exit 1, while `occurrences`, `view specs/A.mdx`, and `at specs/A.mdx 0` each answer finding-free, exit 0; (2) the judgement's reads: under `markdown: { emit: true, outDir: "out" }`, no glob reaching below `out`, `out` (holding a prior emission) staged mode `000` (the harness verifying its own listing of `out` and examination of `out/specs` refused): on a failing workspace (`specs/A.mdx` holding an id-less section) `view specs/A.mdx`, `occurrences`, and `at specs/A.mdx 0` each exit 2, `code` `"read-failure"`, `path` `out` or a path below it, stdout exactly the error document; the same on the passing side, and for `build`, `check`, `ids`, and `query nodes` on either side; the argument checks precede the judgement — with a code group `app` (`src/**/*.ts`) over `src/x.ts` added, `view specs/nope.mdx`, `view src/x.ts`, `at specs/A.mdx <length+1>`, `show specs/A.mdx#nope`, `query nodes --group app`, `coverage <unknown-profile>`, and `review status <unknown-session>` each exit 2 with its usage error, `code` and `path` `null`, never `read-failure`; restored, `build` on the passing side exits 0 and `check` is clean. `test/suite/registry/section-11.2.ts` lacks both.

**Change** (`section-11.2.ts`): both families, the mode-000 staging through Task 22's helper (Linux leg), restored in a `finally`; title and comments.

**Checks.** T11.2-6 against the built product, alone under the namespace: record verdicts per arm.

### Task 95 — T11.2-7 registered: removal by form (RB-19)

**Gap.** TEST-SPEC §11.2, T11.2-7 (new; read it whole): each arm byte-asserted under `view --text` on its failing workspace, `specs/A.mdx` a discovered spec source holding `a` — the root's and each section's own and subtree text against precomputed values, the file's findings accompanying, exit 1: (a) a root-level ESM block holding, one per line, a named `import { a } from "./A.xspec"`, a namespace `import * as N from "./A.xspec"`, a side-effect-only `import "./A.xspec"`, and a bare-specifier `import X from "x"`, each a 14.15 finding — every declaration absent from the root's own and subtree text, each line dropped with its terminator; (b) sections whose opening tags spell an unknown attribute (`<S id="u" foo="1">`), a repeated one (`<S id="r" tags="t" tags="t">`), and a spread (`<S id="p" {...q}>`), each a 14.17 finding — each tag removed whole: the section's own text its body alone, the root's subtree text carrying that body in place with no byte of either tag; (c) `import A from "./A.xspec"`, U+000A, `export const x = 1`, U+000A in one ESM block — a 14.16 finding — the import's line dropped and the export's line preserved byte for byte in the root's own and subtree text.

**Change** (`test/suite/registry/section-11.2.ts`): register T11.2-7 (each staged source well-formed MDX per S-9, its expected texts precomputed by composition); H-7 entry (`"11.2"`, `"14"`).

**Checks.** T11.2-7 against the built product: record verdicts per arm.

### Task 96 — T11.4-1's multi-file order; T11.4-2's `**/../x/*.mdx` and byte-ordered operands (RB-58, RB-59)

**Gap.** TEST-SPEC §11.4, T11.4-1 (revised): views in order by path bytes "on T11.6-3's order fixture `specs/a/B.mdx`, `specs/a/a.mdx`, `specs/z/Z.mdx`, never group-by-group discovery order or a case-folded one". T11.4-2 (revised): the outside-root `--file` glob `**/../x/*.mdx` → exit 2; the inside glob matching nothing staged over discovered sources its normalization matches; and "`view specs/z/Z.mdx specs/a/a.mdx specs/a/B.mdx` on T11.6-3's order fixture yields `specs/a/B.mdx`, `specs/a/a.mdx`, `specs/z/Z.mdx`, never operand order or a case-folded one". `test/suite/registry/section-11.4.ts` lacks them. T11.4-1 is no longer in CONF-AVAIL's scope (Task 1).

**Change** (`section-11.4.ts`): T11.6-3's order fixture's spec side (groups `tests` globbing `["specs/z/*.mdx", "specs/a/*.mdx"]` and `product` globbing `["specs/a/*.mdx"]`, the three sources; share it with Task 100 through an export from whichever module lands first), the multi-file `view` order, the operand-order arm, and the `**/../x/*.mdx` arm; titles and comments.

**Checks.** T11.4-1 and T11.4-2 against the built product: record verdicts.

### Task 97 — T11.4-4's two-clause binding names (RB-60; certified, CONF-AVAIL)

**Gap.** TEST-SPEC §11.4, T11.4-4 (revised): the binding name is "the default binding's identifier, a non-default clause beside it notwithstanding (`import X, { b } from "./BASE.xspec"` and `import Y, * as N from "./BASE.xspec"`, each a 14.15 finding, 2.1: not a single default binding → exactly `"X"` and `"Y"`, never `"b"` or `"N"` …)". `test/suite/registry/section-11.4.ts` lacks it. Reviewer D: the CONF-AVAIL conformer handles it ("X"/"Y" plus 14.15).

**Change** (`section-11.4.ts`): the two imports in `view`'s `imports` data, form-exact, beside their 14.15 findings; title and comments.

**Checks.** CONF-AVAIL family alone: the conformer passes T11.4-4; NULLMARKER and OMIT fail it; NOFILE passes it. T11.4-4 against the built product: record the verdict.

### Task 98 — T11.5-2's offset spellings; T11.5-3's unparseable-file offset bound (RB-61, RB-62)

**Gap.** TEST-SPEC §11.5, T11.5-2 (revised): `0000000000000000000000007` is accepted as 7 (no digit-count cap), and `18446744073709551617` (2^64 + 1) is the out-of-range usage error, exit 2, never a wrapped offset's resolution. T11.5-3 (revised): "on three discovered spec sources failing 14.20 — one not valid UTF-8 (a valid prefix, then `0xFF`), one beginning with a byte-order mark, and one with a syntax failure (`d={]}`) — `at <file> <n>`, `n` the file's byte length counted in its own bytes …, reports the resolution explicitly unavailable beside the file's condition-20 finding, exit 1, while `at <file> <n+1>` is the out-of-range usage error — exit 2, the error document (12.7: `code` and `path` `null`) as the entire stdout". `test/suite/registry/section-11.5.ts` lacks these.

**Change** (`section-11.5.ts`): the two spellings; the three unparseable files (declared unparseable S-9 records where staged after an invocation; byte lengths computed from the staged bytes), each at `n` and `n+1`; titles and comments.

**Checks.** T11.5-2 and T11.5-3 against the built product: record verdicts.

### Task 99 — T11.6-1's journal path; T11.6-2's `files` selector forms (RB-63, RB-64)

**Gap.** TEST-SPEC §11.6, T11.6-1 (revised): "`graphData` exactly `".xspec"`, `journal`'s `path` exactly `".xspec/journal"`, and `lock` exactly `".xspec/lock"`" in every answer (today `journal.path` is only compared with the root run's). T11.6-2 (revised): "a rule whose `from` is `{ files: "src/$1.ts" }` and whose `to` is `{ files: "specs/$1.mdx" }` … reports `from` exactly `{"files": "src/$1.ts"}` and `to` exactly `{"files": "specs/$1.mdx"}`, and a rule whose `from` is T7.5-4's inside-root spelling `{ files: "./src/*.ts" }` reports `from` exactly `{"files": "./src/*.ts"}` — each selector one member, its pattern as configured, verbatim". `test/suite/registry/section-11.6.ts` lacks both.

**Change** (`section-11.6.ts`): the literal `journal.path` pin in every T11.6-1 answer; T11.6-2's two rules form-exact; titles and comments.

**Checks.** T11.6-1 and T11.6-2 against the built product: record verdicts.

### Task 100 — T11.6-3's plain-file and link `.xspec`, and its order fixture (RB-65)

**Gap.** TEST-SPEC §11.6, T11.6-3 (revised; read it whole): `journal` exactly `{"path": ".xspec/journal", "occupied": …}` in every arm; absent → `false` before any build and on a built workspace no journaled operation has touched; "with `.xspec` no directory — a plain file, and a symbolic link to a directory holding a journal (T10.1-6) — → `false`, nothing read below such an occupant"; and the order fixture — spec groups `tests` (`["specs/z/*.mdx", "specs/a/*.mdx"]`) then `product` (`["specs/a/*.mdx"]`), code groups `web` (`web/*.ts`) then `app` (`app/*.ts`), profiles `z-cov` then `a-cov`, rules `z-rule` then `a-rule`, sources `specs/z/Z.mdx`, `specs/a/B.mdx`, `specs/a/a.mdx`, `web/w.ts`, `app/p.ts`, emission under `outDir: "out"`, built, sessions created as `a2`, `a`, `B` — with each order asserted form-exact: configuration order for groups, profiles, rules, and `tests`' globs; `sources` in byte order (`app/p.ts`, `specs/a/B.mdx`, `specs/a/a.mdx`, `specs/z/Z.mdx`, `web/w.ts`); each two-group source's `groups` `tests` then `product`; `derived` in byte order of `source`; `recorded` in byte order (every `out/` path before every `specs/` path); `sessions` `.xspec/reviews/B.json`, `.xspec/reviews/a.json`, `.xspec/reviews/a2.json`. `test/suite/registry/section-11.6.ts` lacks these.

**Change** (`section-11.6.ts`): the `.xspec` arms and the order fixture (shared with Task 96 if it landed first); title and comments.

**Checks.** T11.6-3 against the built product: record verdicts.

### Task 101 — T11.6-4's passing workspace beside a policy violation and a corrupt session (RB-66)

**Depends on.** Task 94 (T11.2-6's stagings).

**Gap.** TEST-SPEC §11.6, T11.6-4 (revised): "on a workspace passing `build`'s validations, beside a policy violation and, separately, a corrupt session (T11.2-6's stagings), `inventory` answers finding-free, exit 0, while `check` reports 14.12, respectively 14.21 — condition 23 being the only finding an inventory answer carries". `test/suite/registry/section-11.6.ts` lacks it.

**Change** (`section-11.6.ts`): both workspaces (T11.2-6's stagings, shared with Task 94's through an export), `inventory` finding-free exit 0 and `check`'s finding form-exact; title and comments.

**Checks.** T11.6-4 against the built product: record the verdict.

### Task 102 — T12.0-5's `move` from `specs/` (RB-67)

**Gap.** TEST-SPEC §12.0, T12.0-5 (revised): among the representative commands run from a subdirectory, "`move` among them, its destination naming a path nothing need occupy: run from `specs/`, the file form `move specs/A.mdx specs/B.mdx` relocates the file to the workspace-relative `specs/B.mdx`, and, on a fresh copy, the section form `move specs/A.mdx#a specs/C.mdx#a` creates its target file at `specs/C.mdx` — never at `specs/specs/…`". `test/suite/registry/section-12.0-i.ts` lacks it.

**Change** (`section-12.0-i.ts`): both forms run from `specs/`, each on its own copy, the resulting tree asserted (the destination at the workspace-relative path; nothing under `specs/specs/`); title and comments.

**Checks.** T12.0-5 against the built product: record the verdict.

### Task 103 — T12.0-10's unknown coverage, spelled-but-not-defined IDs, synopsis mismatches, and malformed `--to` (RB-68, part)

**Gap.** TEST-SPEC §12.0, T12.0-10 (revised; read it whole). On the failing workspace: `review create --coverage <unknown-profile> --name n`, `code` `null`, no session written (its argument checks following acquisition and preceding the gate); "Spelled, not defined": `show <file>#<id>` and `query node <file>#<id>` naming an ID two sections of the file both spell, and separately one whose only bearer spells it beneath an ancestor spelling no identity, pass the check (the gated report follows, exit 1, never the unknown-node exit 2), while an ID whose only would-be bearer spells none — `id={"x"}` (naming `x`), and `<S id>` (naming `true`) — fails it, exit 2, the usage error alone though the file carries a 14.17; among the syntax-class arms, the synopsis mismatches `move a.mdx b.mdx#y` and `move a.mdx b#c.mdx`; and the malformed `--to` spelled `--to 'a.mdx#x\y'` (its id segment carrying `\`) beside `--tag 'a\b'` (reviewer B: the harness uses `#a b`), a `#`-less `--to` being wholly its path part. `test/suite/registry/section-12.0-ii.ts` lacks these.

**Change** (`section-12.0-ii.ts`): the arms as stated (the syntax-class rows in `T12_0_10_SYNTAX_ROWS` or its successor; AGENTS.md's bullet beginning "Task 47's syntax-class rows" — an earlier plan's task, not this plan's — for the pattern); title and comments.

**Checks.** T12.0-10 against the built product: record verdicts per arm.

### Task 104 — T12.0-10's code-unit masking, unmasked kind check, and review subcommands past the gate (RB-68, rest)

**Depends on.** Task 64 (T10.1-4's new corrupt states).

**Gap.** TEST-SPEC T12.0-10 (revised): "Masking reaches a code unit alike …: on a workspace of its own, failing `build`'s validations through one code source alone — under a spec glob `specs/*.mdx` and a code glob `src/*.ts`, `src/bad.ts` holding `function f() {}` followed by the line `let x = ;` …, beside a parseable spec source `specs/A.mdx` holding a section `a` — `query edges --from src/bad.ts#f`, `query edges --to src/bad.ts#f`, `query reachable --from src/bad.ts#f --to specs/A.mdx#a`, and `query reachable --from specs/A.mdx#a --to src/bad.ts#f`, each run with `f` … and again with `g` in its place …, each end at the gate — its report exactly the findings `build` reports there, `src/bad.ts`'s condition 20 — exit 1, answering nothing …; the bare `query edges --from src/bad.ts` … ends at the gate alike, exit 1. The kind check asks no content question and is never masked …: `show src/bad.ts#f` and `query node src/bad.ts` … each exit 2, the usage error alone reported"; and past the gate, "`review resolve <corrupt-session> <item-id> --status updated`, `review show <corrupt-session> <item-id>`, and `review split <corrupt-session> <item-id>`, `<item-id>` an ID the session never held, each report exactly the condition-21 finding, exit 1, nothing modified, never the unknown-item exit 2 … on every corrupt state of T10.1-4, its unparseable bytes and each of its adapter-layer stagings alike". `test/suite/registry/section-12.0-ii.ts` lacks these (today `resolve` alone, past the gate).

**Change** (`section-12.0-ii.ts`): the masking workspace (`src/bad.ts` a declared-unparseable S-9 TypeScript record), its nine query runs and two kind-check runs; `show` and `split` beside `resolve` over every T10.1-4 corrupt state (reusing T10.1-4's stagings, the two new ones of Task 64 included); title and comments.

**Checks.** T12.0-10 against the built product: record verdicts per arm.

### Task 105 — T12.0-13's `rename specs/a#b.mdx`; T12.0-14's leading `--json` (RB-69, RB-70)

**Gap.** TEST-SPEC §12.0, T12.0-13 (revised): "`rename specs/a#b.mdx x y`, the file spelling a section `x`, names it likewise — its argument checks pass … and the invalid-workspace refusal follows, exit 1, the condition-19 finding among its findings, nothing modified — never the unknown-file usage error (exit 2)". T12.0-14 (revised): "`xspec review --json list` answers byte-identically to `xspec review list --json`, and `xspec query --json nodes` to `xspec query nodes --json`". `test/suite/registry/section-12.0-ii.ts` (T12.0-13) and `section-12.0-iii.ts` (T12.0-14) lack them.

**Change**: both arms as stated; titles and comments.

**Checks.** T12.0-13 and T12.0-14 against the built product: record verdicts.

### Task 106 — T12.0-16 registered: its fixture and arms (a)–(c) (RB-21, part)

**Gap.** TEST-SPEC §12.0, T12.0-16 (new, "Byte order, never UTF-16 order"; read it whole). The separating pair `Ａ` (U+FF21) and `😀` (U+1F600): byte order places a string holding `Ａ` before the same string holding `😀`, UTF-16 code-unit order the reverse. Fixture, built: spec group `specs` (`specs/*.mdx`), code group `src` (`src/*.ts`), emission enabled, profiles `pair` (`target` `specs`, `targets` `"all"`, `targetTags` `["😀", "Ａ"]`, `boundary` `src`, `mode` `direct`) and `bare`, rule `nope` (`forbidden`, `from` `{ group: "src" }`, `to` `{ tags: ["😀", "Ａ"] }`); `specs/base.mdx` with `p` spelled `tags="😀 Ａ"` whose children are, in document order, `p.😀` then `p.Ａ` (a reference to a `😀` section uses bracket notation, 2.4); `specs/Ａ.mdx` and `specs/😀.mdx` each importing `./base.xspec` as `BASE` with `x` spelling `d={BASE.p}`; `src/Ａ.ts` and `src/😀.ts` each importing `../specs/base.xspec` as `BASE` and marking `BASE.p`. (a) Tag sets: `view` reports `p`'s `tags` exactly `["Ａ", "😀"]`; `inventory` reports `pair`'s `targetTags` and `nope`'s `tags` selector list exactly so. (b) File orders: `view` with no operand and with operands `specs/😀.mdx specs/base.mdx specs/Ａ.mdx` orders `specs/base.mdx`, `specs/Ａ.mdx`, `specs/😀.mdx`; `ids` likewise; `inventory`'s `sources`, `derived`, and `recorded` (every `specs/Ａ.` before every `specs/😀.`); `occurrences` by referencing file. (c) Findings: `check` reports `nope`'s two condition-12 findings, `src/Ａ.ts`'s identities first; with `specs/Ａ.xspec.ts` and `specs/😀.xspec.ts` altered, their per-file condition-10 findings `specs/Ａ.xspec.ts`'s first; on a twin with `d={BASE.missing}`, the two condition-5 findings `specs/Ａ.mdx`'s first; on a twin with mutual unused imports, the import cycle's one condition-9 finding, `specs/Ａ.mdx`'s declaration located first.

**Change.** Register T12.0-16 in the §12.0 module that fits (e.g. `section-12.0-iii.ts`) with the fixture (every exotic character built from its code point; each source well-formed per S-9; sources staged after the first invocation as records) exported for Task 107, and arms (a)–(c), each order form-exact on 12.7's documents and through the H-3 decode elsewhere; H-7 entry (`"12.0"`, `"12.7"`, `"14"`, and the passages (a)–(c) assert, per the map's rules).

**Checks.** T12.0-16 against the built product: record verdicts per arm.

### Task 107 — T12.0-16's arms (d)–(f) (RB-21, rest)

**Depends on.** Task 106.

**Gap.** TEST-SPEC T12.0-16: (d) previews — `rename specs/base.mdx p q --preview` reports `mapping` ordered by `from` (`specs/base.mdx#p`, `…#p.Ａ`, `…#p.😀`) and `files` ordered `specs/base.mdx`, `specs/Ａ.mdx`, `specs/😀.mdx`, `src/Ａ.ts`, `src/😀.ts`, the performed rename the same `mapping`; with graph data deleted, the preview's `delta` `generated` places every `specs/Ａ.` path before every `specs/😀.` one, and with `specs`' glob narrowed to `specs/base.mdx`, its `removed` likewise. (e) Review items — with the built fixture committed and `p.😀`'s and `p.Ａ`'s own text edited, a `path-blocks` session orders its depth-1 `dependency-consistency` items `specs/Ａ.mdx#x`'s first and its `code-impact` items `src/Ａ.ts`'s first; an `audit` session on the built fixture orders `specs/base.mdx`'s items, then `specs/Ａ.mdx`'s, then `specs/😀.mdx`'s, and with `p.😀` and `p.Ａ` deleted places their absent-scope items after `specs/base.mdx`'s present-scope ones, `…#p.Ａ`'s first; a `coverage` session over `bare` orders its `uncovered-requirement` items `specs/Ａ.mdx#x`'s first — each order as `status` and `export` present it. (f) Shortest-path tie-break — `coverage pair` reports `p` covered through `src/Ａ.ts` → `specs/base.mdx#p`; `impact` against (e)'s baseline reports `src/Ａ.ts` directly impacted along `specs/base.mdx#p` → `specs/base.mdx#p.Ａ`; with `src/c.ts` added importing both spec modules and marking each `x`, `query reachable --from src/c.ts --to specs/base.mdx#p` reports the witness through `specs/Ａ.mdx#x`.

**Change**: arms (d)–(f) on Task 106's fixture; title and header complete.

**Checks.** T12.0-16 against the built product: record verdicts per arm.

### Task 108 — T12.3-1's entry arms and `**/../x/*.mdx` (RB-71)

**Gap.** TEST-SPEC §12.3, T12.3-1 (revised): `--file` with `**/../x/*.mdx` outside the root → exit 2; `./specs/*.mdx` matching nothing though its normalization matches the fixture's files under `specs/` → an empty listing; and "Entries (12.3: one per discovered spec source, none for a code source, each present even when it holds no ID): on a workspace holding a spec source of prose alone, no section in it; a spec source every one of whose sections another spec source references by `d`; and a code source a configured code group matches — `ids --json`, `ids` in human form (T12.0-15), and `ids --tree` each list the prose-only source with an empty entry and give the code source no entry; `ids --unreferenced`, in each of those forms, keeps the all-referenced source's entry, empty; and `ids --file 'src/**/*.ts'`, matching only code sources, lists no entry, exit 0". `test/suite/registry/section-12.3-12.5.ts` lacks these.

**Change** (`section-12.3-12.5.ts`): the arms (the human forms through the existing human-report matching until T12.0-15's `ids` decoder lands in Task 134, which then re-reads them through the decoder); title and comments.

**Checks.** T12.3-1 against the built product: record verdicts.

### Task 109 — T12.7-1's review refusal form; T12.7-3's journal-error document and stdout without `--json` (RB-72, RB-73)

**Depends on.** Tasks 21, 47, 62.

**Gap.** TEST-SPEC §12.7, T12.7-1 (revised): `path` `null` "for the unlocated findings 14 gives no concerned path — a policy finding and a review-operation refusal" and "a review-operation refusal carries `locations` `[]` and `path` `null` with `identities` informational (14; T10.7-14)" — the review-refusal arm (`section-12.7.ts`, about line 922) checks `code` only. T12.7-3 (revised): "a journal error failing a given baseline's resolution → `code` `"journal-error"`, `path` `".xspec/journal"`, and `locations` `[]` … (6.3, 14.13, 14; T6.3-6)"; "every other exit-2 error → `code` and `path` `null`, a plain usage error (a refused read of git data among them …)"; and among the error-document-on-stdout-without-`--json` arms, "`review export <unknown-session>` and `review export s --bogus`, `export` the one JSON-only subcommand of a command that is not JSON-only (10.7)". `test/suite/registry/section-12.7.ts` lacks these; T12.7-3's `.`-path arm runs behind H-1's check since Task 21.

**Change** (`section-12.7.ts`): T12.7-1's refusal arm through Task 62's shared check (`locations` `[]`, `path` `null`, member set); T12.7-3's journal-error arm (a given baseline over a garbage journal line, as T6.3-6(a) stages it) and the two `review export` arms (stdout exactly the error document without `--json`); titles and comments.

**Checks.** T12.7-1 and T12.7-3 against the built product: record verdicts.

### Task 110 — T13.3-2's `review list` in the sweep; T13.3-3's stale twins (RB-75, RB-76)

**Gap.** TEST-SPEC §13.3, T13.3-2 (revised): the refreshing reads include `review list` ("10.7: `list` too answers only past the refresh, its stored-status counts drawing on no graph data"). T13.3-3 (revised, now "The gate"): the journal-error finding with "its `path` `".xspec/journal"` and `locations` `[]` (T6.1-3)"; and "Graph data being current on those two stagings, a refresh there would rewrite nothing, so each is also staged stale …: on a twin of each — a section's text edited, validly, after graph data was last written, no read run since, and in the write-path twin the obstruction placed on a write path other than graph data's own: under `markdown: { emit: true, outDir: "out" }`, built, the directory `out` replaced by a plain file … — each read run above on that staging and each of `occurrences`, `view`, and `at` gives its outcome above and leaves T13.3-2's operational path set byte-identical around it …. The mutating `review` subcommands meet the refused-write gate alike, past their acquisition …: on the write-path twin, its `audit` session in place, `review create --strategy audit` under a new name, `review resolve` naming an unblocked item, and `review split` naming an item whose scope root has children each exit 1 reporting exactly the condition-22 finding concerning `out` — no session created, the existing session, journal, derived files, and graph data byte-identical, the stale graph data unrefreshed". `test/suite/registry/section-13.3.ts` lacks `review list` in T13.3-2's sweep and these T13.3-3 arms.

**Change** (`section-13.3.ts`): `review list` joins T13.3-2's refreshing reads (deletion arm, edit arm, record-corruption arm, as the module runs them); T13.3-3's journal-error finding form-exact, its two stale twins, and the three mutating subcommands on the write-path twin; titles and comments.

**Checks.** T13.3-2 and T13.3-3 against the built product: record verdicts.

### Task 111 — T13.3-5 registered: arm (a), partial tampering (RB-22, part)

**Depends on.** Tasks 18 (S-3's design for its staged-only trial count) and 20 (the S-3 check it extends).

**Gap.** TEST-SPEC §13.3, T13.3-5 (new, "Never stale"; read it whole). On T13.3-2's workspace, freshly built and valid, each read — T13.3-2's `ids`, `show`, `coverage`, `impact`, `review status`, `review list`, `query`, `occurrences`, `view`, and `at` — and `check` run under `--json` alone on its own copy of the staged state. (a) Partial tampering, shape-blind (H-3): each trial alters one file of T13.3-2's operational path set at a seeded offset (H-10; a fixed seed set in CI) — a single byte changed to a seeded other value, or the file truncated there — every nonempty file of the set altered in some trial; and, where the product writes several files there, further trials mix files from two product-written states (the workspace's own and a twin's built after one section's text was edited), each path of the union taking its file or its absence from either state by seed, the mixes together taking every two paths at which the states differ one from each state, both ways round. Each read's exit code and stdout equal its run's on the untampered workspace, byte for byte. `check`'s verdict is predicted in every trial from two observations on their own copies — whether the reads rewrite anything in the operational path set, and `inventory`'s `recorded` — exactly one condition-10 unit-form finding (`path` `".xspec"`, `locations` `[]`) when `recorded` is unavailable or the reads rewrote the set; beside it, where `recorded` is a list, one recorded-file-form finding per listed path outside the untampered workspace's `recorded` whose occupant 13.4's removal would remove; nothing else; exit 1 when any finding, else 0. S-3: the trials' count is known only once staged (the files the product writes), so any guard the span carries derives as staged.

**Change.** Register T13.3-5 in `test/suite/registry/section-13.3.ts` with arm (a): the trial generator seeded through the property machinery's fixed seeds (`test/helpers/property.ts`), the operational path set listed at exact name bytes, the per-copy observations and the prediction; under S-3's design, no fixed span guard (Task 20's stand-in check extended with T13.3-5(a)'s stand-in `.xspec` file sets of differing counts); H-7 entry (`"13.3"`, `"14"`, and the passages its reads assert).

**Checks.** T13.3-5 against the built product, alone: record the verdict, the trial count, and the time; the extended S-3 check passes.

### Task 112 — T13.3-5's arms (b) and (c) (RB-22, rest)

**Depends on.** Tasks 7 (the per-file set by comparison), 111.

**Gap.** TEST-SPEC T13.3-5: (b) "A source added after the build, no existing file edited: a new valid spec source, and separately a new code source a configured code group matches, importing an existing spec source's module and holding a marker on one of its sections …— each read's exit code and standard output equal those of the same read on a twin on which `build` ran once the source was added, `view` and `at` also run, in the spec-source arm, naming the new source; and `check` reports the findings `check` reports on that twin and, beside them, exactly one condition-10 finding per derived path at which the staged workspace's occupant differs from the twin's file — … all absent, among them — and one in the unit form …, exit 1". (c) "A journal changed alone …: `xspec rename specs/A.mdx a b` …, and `.xspec/journal` is then deleted by hand …. `check` reports exactly one condition-10 finding in the unit form …, and beside it exactly one per-file finding per derived path whose occupant differs from the one a `build` leaves on a copy of this state — the harness computing that set by comparison, as T13.5-7(b) does … — and nothing else, exit 1 …. On another copy of the state, a refreshing read answers from refreshed data: `query node specs/A.mdx` reports the ownHash that `query node specs/A.mdx` reports on a twin holding the same sources and no journal, built there — an ownHash differing from the one it reported before the deletion — and `check` afterwards reports no unit-form finding, its per-file findings as before."

**Change** (`section-13.3.ts`, T13.3-5): arms (b) (the added sources S-9 records) and (c) (the per-file set through Task 7's helper, `stalenessAgainstRebuiltCopy` in `write-refusal-staging.ts`, `{ perFile, graphDataDiffers }` against a `build` on a byte copy of the state; the refreshing read's other copy through `copyTreeBytes`, `test/helpers/tree-copy.ts`, checked against the original as that helper's callers do); title and header complete.

**Checks.** T13.3-5 against the built product: record verdicts per arm.

### Task 113 — T13.4-5's three-session identity arm (RB-77)

**Depends on.** Task 69 (the decompositions decode).

**Gap.** TEST-SPEC §13.4, T13.4-5 (revised): "`rename` and `move` never write a session file either …. Fixture: a git repository whose baseline commit holds `specs/A.mdx`, with top-level sections `a`, holding `a.x`, and `s`, and `specs/B.mdx`, with a top-level section `t`; `a.x`'s text is then edited. Three sessions …: a path-blocks session (`--base` the baseline commit) with `a.x`'s `subtree-coherence` item resolved `no-change`; an audit session with `a`'s item split … and `s`'s item resolved `no-change`; and a `coverage` session whose profile's required set, the spec group's leaves `a.x`, `s`, and `t`, is uncovered, `a.x`'s item resolved `no-change`. `xspec rename specs/A.mdx a b`, then the file-form `xspec move specs/A.mdx specs/C.mdx`, then the section-form `xspec move specs/C.mdx#s specs/B.mdx#t.s` — each exiting 0 and journaled — leave every session file byte-identical to its bytes just before the operation, while reads afterwards present the recorded nodes under their current identities …: `a.x`'s as `specs/C.mdx#b.x`, `s`'s as `specs/B.mdx#t.s`, and the audit session's recorded decomposition at `specs/C.mdx#b`." `test/suite/registry/section-13.4.ts` lacks it. T13.4-5 is no longer certified (Task 1), so this arm may use the whole review machinery.

**Change** (`section-13.4.ts`): the arm as stated (decomposition's scope node read through the review adapter's decompositions decode, Task 69's); title and comments.

**Checks.** T13.4-5 against the built product: record the verdict.

### Task 114 — T13.4-13 registered: FIFO occupants, arms (a)–(d) (RB-23, part)

**Gap.** TEST-SPEC §13.4, T13.4-13 (new, "Any other occupant: FIFOs"; read it whole). On the Linux leg, each arm on a freshly built valid workspace holding an `audit` session `s` created while valid, a FIFO at one path no glob matches, every invocation under `--json`: each completes promptly (S-3), no FIFO opened, the FIFO still in place afterward unless a `build` replaces or removes it, nothing else modified but by a successful `build`. (a) The root's `xspec.config.ts` a FIFO: `build`, `check`, `ids`, `view`, `inventory`, and a `rename` each exit 2, `code` `"configuration-error"`, `path` `"xspec.config.ts"`; `version` exits 0; and `--config alt.config.ts` naming a FIFO beside a valid root configuration: likewise, `path` `"alt.config.ts"`. (b) `.xspec/journal` a FIFO: `build`, `check`, `ids` report condition 13 concerning `.xspec/journal`, exit 1 (`ids` answering nothing), a `rename` refused with that finding alone; `inventory` reports `journal` exactly `{"path": ".xspec/journal", "occupied": true}`, finding-free, exit 0; `occurrences`, `view`, and `at … 0` answer finding-free, exit 0. (c) `.xspec/reviews/s.json` a FIFO: `check`, `review status s`, `review list` report `s` corrupt (condition 21), exit 1; `inventory` lists it, finding-free, exit 0. (d) `.xspec/reviews` a FIFO, and separately `.xspec` a FIFO: every command T10.1-6's plain-file arm runs for that path answers exactly as there (its stale-twin runs aside). Reviewer B: a FIFO helper exists in `test/helpers/lock-staging.ts` but no catch-all arm uses it.

**Change.** Register T13.4-13 in `test/suite/registry/section-13.4.ts` (or a §13.4 module with room) with (a)–(d), the FIFO through the existing helper (verifying in place and still a FIFO afterwards, never opened by the harness), T10.1-6's plain-file arm's command list reused for (d); H-7 entry (`"13.4"`, `"14"`, and the passages it asserts).

**Checks.** T13.4-13 against the built product, alone under the namespace: record verdicts per arm (a blocking open is a hang, caught by the invocation's own guard).

### Task 115 — T13.4-13's arms (e)–(i) (RB-23, rest)

**Depends on.** Task 114.

**Gap.** TEST-SPEC T13.4-13: (e) a generated module's path a FIFO: `check` exactly one per-file condition-10 finding, exit 1; `build` exits 0 replacing the FIFO with the generated plain file, byte-equal to a FIFO-free twin's; `check` then clean. (f) Under `markdown: { emit: true, outDir: "out" }`, built, `out` replaced by a FIFO: `build` exits 1 with the condition-22 finding concerning `out`, modifying nothing; `check` reports it without writing; the 11.2 surfaces answer finding-free, exit 0. (g) Under `specs/**/*.mdx`, `specs/A.mdx` holding `x`: `move specs/A.mdx other/B.mdx` and `move specs/A.mdx#x other/B.mdx#x`, `other/B.mdx` a FIFO in no spec group, each exit 1 with exactly `refused-destination-exists` and `refused-invalid-destination` concerning `other/B.mdx`; `move specs/A.mdx specs/sub/B.mdx` with `specs/sub` a FIFO, and on (f)'s configuration `move specs/A.mdx specs/new/B.mdx` with `out/specs/new` a FIFO, each exactly one `refused-invalid-destination` concerning the destination. (h) Emission next to sources, built, `specs/A.md` replaced by a FIFO, emission then disabled: `check` reports the recorded-file finding concerning `specs/A.md` and no other but, unasserted, the unit form; `build` exits 0 removing the FIFO; `check` then clean. (i) A `rename` given `--test-hold` naming a FIFO outside the workspace: exit 2, `code` and `path` `null`, nothing modified, `.xspec/lock` absent afterwards.

**Change** (T13.4-13): arms (e)–(i); title and header complete.

**Checks.** T13.4-13 against the built product, alone under the namespace: record verdicts per arm.

### Task 116 — T13.5-7's rename stopped at a Markdown write; (f)'s prior-or-twin rule (RB-78, part)

**Depends on.** Tasks 7, 8.

**Gap.** TEST-SPEC §13.5, T13.5-7 (revised; read it whole). (c)'s rename twin: "(a)'s rename on a variant of (a)'s workspace whose configuration adds `markdown: { emit: true, outDir: "out" }`, built, `out/specs/b/B.md` then deleted — `out/specs/b` holding nothing else — and `out/specs/b` staged unwritable …: A, B, and C byte-equal to the twin's, the journal holding exactly one new entry byte-equal to the twin's, and stdout under `--json` exactly the error document concerning `out/specs/b/B.md`, no `mapping` beside or instead of it; `check` reports condition-10 findings alone, `out/specs/b/B.md`'s per-file finding among them; and after the permissions are restored `impact --base <pre-rename ref>` reports no change categories (6.2) and the next `build` leaves `check` clean". (f) (reviewer B labels it (d); the clause is (f)'s): "every derived file present afterwards is complete — byte-equal either to its bytes before the invocation or to the twin's file at that path, none partial" and companions "as the comparison finds them". `test/suite/registry/write-refusal-staging.ts` (T13.5-7's machinery) lacks the rename twin and asserts (f)'s files against the twin's alone.

**Change** (`write-refusal-staging.ts` and T13.5-7's registration): the rename twin as stated (its refusal applied at the hold, after acquisition); (f)'s per-file check accepting either the prior bytes or the twin's at each path (and requiring one of the two); comments and title.

**Checks.** T13.5-7 against the built product, alone under the namespace: record verdicts per arm.

### Task 117 — T13.5-7's arms (g) and (h) (RB-78, rest)

**Depends on.** Task 116.

**Gap.** TEST-SPEC T13.5-7: (g) "A created target file is a source edit, made in its `files` place …: `move specs/a/A.mdx#x specs/n/N.mdx#x` — `x` a top-level section of `specs/a/A.mdx` that nothing references, and `specs/n` an empty directory … — with `specs/n` staged unwritable: `specs/a/A.mdx` rewritten, byte-equal to the twin's; nothing at `specs/n/N.mdx` …; the journal byte-unchanged …; derived files and graph data byte-unchanged; exit 2, stdout under `--json` exactly the error document concerning `specs/n/N.mdx` …; and `check` reporting condition 10 alone …: the graph-data unit form and one per-file finding for each derived path whose occupant differs from the one a `build` leaves on a copy of this state, permissions restored — … as in (b) …. With the two paths' byte order reversed — … `specs/z/Z.mdx` instead, moved by `move specs/z/Z.mdx#x specs/n/N.mdx#x` … — the refused creation is the run's first write: `specs/z/Z.mdx` byte-untouched, nothing at `specs/n/N.mdx`, the journal, derived files, and graph data byte-unchanged, the same error document, and `check` clean, exit 0." (h) "(c)'s workspace, built under `markdown: { emit: true, outDir: "out" }` — `out/specs` holding `A.md` alone — with emission then disabled …, and `out/specs` staged unwritable: `build` exits 2 …, `code` `"write-failure"`, `path` `"out/specs/A.md"`, the file byte-identical in place; and a rename of a section of `specs/A.mdx` on the same state, the staging applied at its hold, exits 2 with that error document alone, no `mapping` …, its source edits and journal append made … and `out/specs/A.md` byte-identical in place".

**Change** (`write-refusal-staging.ts`, T13.5-7): arms (g) — both byte orders, (g)'s per-file set through Task 7's helper, `stalenessAgainstRebuiltCopy` — and (h); title and header complete.

**Checks.** T13.5-7 against the built product, alone under the namespace: record verdicts per arm.

### Task 118 — T13.5-8's garbage-journal arms (RB-79; certified, CONF-CORE)

**Depends on.** Tasks 12 (the conformer's journal error), 21 (H-1's check).

**Gap.** TEST-SPEC §13.5, T13.5-8 (revised; `tdiff.py` shows each insertion): the acquisition-first `review create --base <unresolvable-ref> --name n` again "with a garbage line appended to the current journal (T6.3-6(a)'s staging), never `journal-error` — 6.3's journal read … is one of baseline resolution's reads, all of which follow acquisition", run under the holder and under the obstruction; a workspace "failing `build`'s validations — by a source validation error, and separately by that garbage journal line alone (14.13 …)"; and the seam-ordering arm "`review create --base <unresolvable-ref> --name n` (6.3), that `review create` again with the garbage journal line above (6.3's journal read)" — its `--test-hold` run exiting 2 after the hold with "`code` `"journal-error"` with `path` `".xspec/journal"` (T6.3-6(b): the journal read before the ref's resolution)". CERTIFICATIONS.md §CONF-CORE binds these arms by staging constraints (workspaces in no repository and inside none, H-1 verified first; T6.3-6(a)'s garbage line; the BOM source as the source validation error; brackets and quiet as §CONF-CORE states); §VIOL-CORE-LATEHOLD now names "the five arms the usage class's names and baseline resolution (its journal read included) refuse"; §VIOL-CORE-NOLOCK and §VIOL-CORE-EARLYWRITE describe these arms' outcomes.

**Change** (`test/suite/registry/section-13.5.ts`, T13.5-8): the garbage-journal arms as stated, within every CONF-CORE staging constraint; T13.5-8's title and comments; `test/self/certification-fixtures.ts`'s LATEHOLD comment ("four seam-ordering arms" becomes five, the journal-staged one named) and `bin-latehold.mjs`'s header if it counts arms.

**Checks.** CONF-CORE family alone: the conformer passes T13.5-8; NOLOCK, EARLYWRITE, and LATEHOLD fail it (fixture runner: record each first line, LATEHOLD's at one of its five seam-ordering arms); every other CORE violator passes it. T13.5-8 against the built product, alone under the namespace: record the verdict.

### Task 119 — T14-1's journal and obstruction pairs (RB-80)

**Gap.** TEST-SPEC §14, T14-1 (revised): "a freshly built valid workspace's `specs/A.mdx` is given a section with no `id` (14.1), and beside that error a garbage line is appended to the journal (H-4's shape-independent staging, T6.1-3) — and, separately, on a twin built under `markdown: { emit: true, outDir: "out" }`, the directory `out` is replaced by a plain file …, in the garbage line's place: `build` and `ids` each exit 1 reporting exactly two findings — the condition-1 finding and, beside it, the condition-13 finding (`path` `".xspec/journal"`, `locations` `[]`, T6.1-3), respectively the condition-22 finding concerning `out` (T13.4-6) — `ids` answering nothing, and `check` reports both, exit 1, nothing modified throughout". `test/suite/registry/section-14.ts` lacks it.

**Change** (`section-14.ts`): both pairs at `build`, `ids`, and `check`, form-exact (12.7 order), the workspace byte-identical around each run; title and comments.

**Checks.** T14-1 against the built product: record the verdict.

### Task 120 — T14-4's baseline journal error; no answer beside 14.12 and 14.21 (RB-81)

**Depends on.** Tasks 47, 94.

**Gap.** TEST-SPEC §14, T14-4 (revised): "14.13 delivered besides as an exit-2 error, never a finding, by a given baseline's resolution, at `impact --base` and `review create --base` (6.3, 14.13; T6.3-6); 14.12 and 14.21 likewise accompanying none of those answers, nor `inventory`'s, on a passing workspace (T11.2-6, T11.6-4)". `test/suite/registry/section-14.ts` lacks both.

**Change** (`section-14.ts`, T14-4's reporter sweep): the journal error at the two baseline commands (exit 2, `journal-error`, through T6.3-6(a)'s staging), and the passing-workspace rows — a policy violation and a corrupt session — where `occurrences`, `view`, `at`, and `inventory` answer finding-free while `check` reports 14.12, respectively 14.21 (the home-staging rows pattern, AGENTS.md's bullet beginning "T14-4's and T14-6's home-test sweep rows"; reuse T11.2-6's stagings, Task 94); title and comments.

**Checks.** T14-4 against the built product: record the verdict.

### Task 121 — T14-5's `src/x.TSX`; T14-6's baseline code and refusal form (RB-82, RB-83)

**Depends on.** Tasks 47 (T6.3-6's journal staging), 62 (the refusal check).

**Gap.** TEST-SPEC §14, T14-5 (revised): code-group files of other names each failing 14.20 identically — `.mts`, and "`src/x.TSX` (its group globbing `src/*.TSX`), whose ending differs from `.tsx` in case alone … — a single-casing arm failing a product that folds the name's case before selecting the grammar". T14-6 (revised): "condition 13 carries `journal-error` as that document's `code` too where a given baseline's resolution reports it as a usage error (6.3, 14.13; T6.3-6)"; and a review-operation refusal's `code` `null` — "the refusal's finding carrying `locations` `[]` and `path` `null` beside it (14; T10.7-14)". `test/suite/registry/section-14.ts` lacks the `.TSX` arm, the baseline `journal-error` code, and the refusal's `locations`/`path`.

**Change** (`section-14.ts`): T14-5's `.TSX` arm (the file's content the same TSX-only text the module's `.ts` arm uses, judged as plain TypeScript — a declared-unparseable S-9 record judged by 14.20's byte-wise rule, which `test/helpers/ts-derivability.ts` already applies); T14-6's two additions (the latter through Task 62's check); titles and comments.

**Checks.** T14-5 and T14-6 against the built product: record verdicts.

### Task 122 — T14-7's twice-spelled cycle arms (RB-84)

**Gap.** TEST-SPEC §14, T14-7 (revised): the import-cycle arm's added-import section "referencing `x` twice in local form (`d={["x", "x"]}`), both spellings beside the declaration, each rooted at the added binding"; and "for a dependency cycle, a move making a section the child of a node it depends on (5.3) — `move specs/A.mdx#x specs/A.mdx#p.x`, `p` and `x` top-level flow-form sections, `x` spelling its dependency on `p` twice (`d={["p", "p"]}`, one edge, 5.2), no other reason applicable — locates both entries and nothing for the containment the move would create". `test/suite/registry/section-14.ts` lacks both.

**Change** (`section-14.ts`): the two arms in T14-7's refusal machinery (`refused-cycle`, both spellings located, precomputed ranges; the human-form run each refusal arm already makes kept), exported for Task 123's preview twins; title and comments.

**Checks.** T14-7 against the built product (long; alone): record the verdict and time.

### Task 123 — T6.6-3's preview twins of T14-7's stagings and of the new refusal arms (RA-32)

**Depends on.** Tasks 50, 51, 52, 122.

**Gap.** TEST-SPEC §6.6, T6.6-3 (revised): the refused real operations of "T6.4-3, T6.4-6, T6.5-4, T6.5-6, T6.5-16, T6.5-17, T6.5-20, T6.5-21, and T14-7 — the invalid-workspace precondition, …, the same-file after-removal collision, and T14-7's own stagings (`refused-cycle` located at spellings rooted at an import the move would add, `d={["x", "x"]}` and the sibling whose characters need not change among them, and at the dependency cycle a containment would make; the non-canonical destination spellings; the identities over invalid paths) included — staged identically" each have a `--preview` twin. `test/suite/registry/section-6.6.ts` has no twins for T14-7's own stagings, nor for the arms Tasks 50 (T6.4-6's refused-writes precondition), 51 (T6.5-4's `specs/B.MDX`), 52 (T6.5-16(g)'s twice-spelled embedding), and 122 (T14-7's twice-spelled cycles) add.

**Change** (`section-6.6.ts`): a `--preview` twin of each, staged identically from the exported stagings (AGENTS.md's bullet beginning "T6.6-3's preview twins"), each reporting the real operation's findings form-exact and writing nothing; title and comments.

**Checks.** T6.6-3 against the built product: record the verdict.

### Task 124 — T14-8's twice-spelled cross-file cycles (RB-85)

**Gap.** TEST-SPEC §14, T14-8 (revised): "on the cross-file `depends` cycle `specs/A.mdx#a` → `specs/B.mdx#x` → `specs/A.mdx#a`, its first edge spelled twice in one array (`<S id="a" d={[B.x, B.x]}>`) and `specs/A.mdx` holding `import B2 from "./B.xspec"` beside `import B from "./B.xspec"`, `B2` unused, the dependency cycle's finding locates both array entries and `specs/B.mdx`'s spelling of the edge back, and the import cycle's finding both of `specs/A.mdx`'s declarations and `specs/B.mdx`'s; on a twin whose first edge is instead an `embeds` edge spelled by two `{text(B.x)}` containers in `a`, the dependency cycle's finding locates both containers, each brace through brace — each finding's `locations` exactly its participants, in 12.7 order". `test/suite/registry/section-14.ts` lacks both.

**Change** (`section-14.ts`): both stagings with precomputed locations, form-exact; title and comments.

**Checks.** T14-8 against the built product: record the verdict.

### Task 125 — T14-9's baseline arms on the unwritable area; its contract rows (RB-86)

**Depends on.** Tasks 8, 48, 117 (T13.5-7's stagings for the contract rows).

**Gap.** TEST-SPEC §14, T14-9 (revised; Task 8 brought its graph-data staging): on the stale, `.xspec`-unwritable state, "`impact --base nope`, and `impact --base` naming a commit the repository holds with the repository's object store refused (T6.3-6(e)'s staging), each exit 2 with the baseline's plain usage error, `code` and `path` `null`, never `write-failure` …, and on a writable copy of the stale state each leaves T13.3-2's operational path set byte-identical, `check` afterwards still reporting the graph-data unit form"; and the contract rows gain the rename's `out/specs/b/B.md` ((c)), the removal owed alone `out/specs/A.md` (from `build` and from a rename's finishing regeneration, (h)), and a section-form move's created target file `specs/n/N.mdx` ((g), on either side of the origin's rewrite in `files` order). `test/suite/registry/section-14-ii.ts` lacks these.

**Change** (`section-14-ii.ts`): the two baseline arms (the object-store staging from Task 48, beside Task 8's `graphDataRefusal()`), their writable-copy twins, and the three contract rows (reusing T13.5-7's stagings from Tasks 116–117 through exports); title and comments.

**Checks.** T14-9 against the built product, alone under the namespace: record the verdict.

### Task 126 — T14-10's arms (b), (f)'s `.xspec` `-wx`, (h), and (j) (RB-87, part)

**Depends on.** Tasks 6, 48.

**Gap.** TEST-SPEC §14, T14-10 (revised; read it whole): (b) the journal's refused read — "a given baseline's resolution reporting it as its usage error, exit 2, `code` `"journal-error"` (6.3; T6.3-6(c)), and the surfaces of 11.2 … — on that otherwise valid workspace `occurrences`, `view` of a spec source, and `at` on it each answer finding-free, exit 0, nothing modified, never 14.25's exit 2 — while `inventory` reports `journal` exactly `{"path": ".xspec/journal", "occupied": true}`, finding-free, exit 0"; (f)'s second half — on a freshly built valid workspace, `.xspec` itself staged `-wx` (verified on the harness first), every path under it readable: `inventory` and a `move --preview` of a valid move each answer either as on the unstaged twin (exit 0, `recorded`/`delta` available) or with that datum unavailable beside the condition-23 finding concerning `.xspec`, exit 1, every other member equal to the twin's, never `read-failure`; (h) on a workspace failing `build`'s validations, `review list` reports exactly the gate's findings instead, the listing never reached; (j) git data — every read a given or recorded baseline's resolution makes but the current journal's: no condition, the baseline unreadable, a plain usage error, exit 2, `code` and `path` `null` (T6.3-6(e)'s stagings). `test/suite/registry/section-14-ii.ts` lacks these.

**Change** (`section-14-ii.ts`): the four additions as stated (stagings through `test/helpers/permissions.ts` and Task 48's object-store staging); title and comments.

**Checks.** T14-10 against the built product, alone under the namespace: record verdicts per arm.

### Task 127 — T14-10's arms (k) and (l)(i)–(iii) (RB-87, rest)

**Depends on.** Tasks 21, 22, 126.

**Gap.** TEST-SPEC T14-10: (k) "a working directory `R/tools` beneath a valid workspace root `R`, no glob reaching below it, entered and only then stripped of its read and search permission both (mode `000`) … the harness verifying on itself that its own lookup of `xspec.config.ts` there and its own listing of the directory are both refused: `build`, `ids`, `inventory`, and `coverage <unknown-profile>` each exit 2 with the error document, `code` `"read-failure"`, `path` `"."` …, nothing modified …; the same staging with no configuration in `R` or in any ancestor (H-1) likewise, `path` `"."`, never T7-1's missing configuration; `ids extra` there is the syntax-class error, `code` `null` …; and `version` … exits 0"; (l) the kind halves under mode-000 directories — (i) `.xspec` so staged on a freshly built valid journal-bearing workspace whose repository holds `c1`: `build`, `ids`, `impact --base c1`, `occurrences`, `view specs/A.mdx`, and `at specs/A.mdx 0` each exit 2, `code` `"read-failure"`, `path` `".xspec/journal"`; `inventory` likewise, `path` `".xspec/journal"` or `".xspec/reviews"`; and on a twin also failing validation (an id-less section added before the staging), `build`, `ids`, the three surfaces, and `check` exit 2 so (`check`'s path `.xspec/journal` or `.xspec/reviews`), never exit 1 with the condition-1 finding; (ii) `.xspec/reviews` so staged with a valid session `s`: `review status s` exits 2, `read-failure`, `path` `".xspec/reviews"` or `".xspec/reviews/s.json"`; (iii) `--config xspec.config.ts` from `R`, `R` entered and then so staged: `build`, `ids`, and `inventory` each exit 2, `read-failure`, `path` `"xspec.config.ts"` or `"."`. `test/suite/registry/section-14-ii.ts` lacks them.

**Change** (`section-14-ii.ts`): (k) and (l)(i)–(iii) through Task 22's mode-000 staging and its entered-working-directory runs, (k)'s second staging behind H-1's check (Task 21); title and header complete.

**Checks.** T14-10 against the built product, alone under the namespace: record verdicts per arm.

### Task 128 — T14-11's container, call, chain, and parenthesized locations (RB-88)

**Gap.** TEST-SPEC §14, T14-11 (revised): "`d={[BASE.a,]}` is valid, one `depends` edge and one occurrence spanning `BASE.a`, no finding"; "an MDX embedding at its full braced container … under 14.8 as under 14.6 …: `{text()}` and `{ /* c */ text(BASE?.a) }`, each at the whole container, its inner whitespace and comment included"; "a TypeScript `text(...)` call callee through closing parenthesis … under 14.7 …: an unresolved `text(SPEC.missing)` and, through an aliased binding (`{ text as t }`, T5.7-2), `t(SPEC.missing)`, each at the whole call"; "an unresolved marker `SPEC.missing;` (14.7) at `SPEC.missing` alone, the `;` excluded"; and "`(SPEC.a);` (14.8, T4.5-3) located as `(SPEC.a)`, the parentheses included". `test/suite/registry/section-14.ts` lacks these.

**Change** (`section-14.ts`, T14-11's arms): the arms as stated, every range precomputed by composition (the module's `ByteFixture` style); title and comments. None of them touches a 14.20 syntax-failure location (the accepted residual).

**Checks.** T14-11 against the built product: record verdicts per arm.

### Task 129 — T6.6-7 registered: the preview decoder (RA-34)

**Depends on.** Tasks 28, 123.

**Gap.** TEST-SPEC §6.6, T6.6-7 (new, "Human form"): "Each preview of T6.6-2, T6.6-4, T6.6-5, and T6.6-6, run without `--json` on the same state, exits as its `--json` twin and writes nothing, and its report, decoded by its human-report adapter, carries the same information: the mapping's every `from` and `to` identity; every file the operation would rewrite, relocate, or create, with each of its edits' class and range — the range as its two pre-operation byte offsets (1.7), a creation's at the new file's start; and the delta's paths in both directions, or, on T6.6-6's corrupt record, the delta reported unavailable beside the condition-23 finding (`unreadable-record`, concerning the graph-data area). Each refused preview of T6.6-3 run without `--json` reports its findings — every code, location, concerned path, and identity of the `--json` twin's — exit 1". Reviewer A: T6.6-4, T6.6-5, and T6.6-6 check human previews by mention matching; T6.6-2's human previews are checked for determinism only; T6.6-6's corrupt-record human report is not checked for `unreadable-record` and `.xspec`, and its refused preview has no human-form run; T6.6-3's refused previews never run without `--json`. None decodes edit classes with their ranges (H-3's human-report adapter, Task 28).

**Change.**
- A preview decoder beside Task 28's layer (`test/helpers/adapters/`): a `rename`/`move --preview` human report onto the preview model the `--json` decode produces — mapping pairs, files with each edit's class and range offsets, the delta's two directions or its unavailability beside the condition-23 finding — fitted to the built product's human layout, value-blind, failing loudly; S-5 vectors (an edit without its range, a delta direction missing, a mapping pair half absent).
- Register T6.6-7 in `test/suite/registry/section-6.6.ts`: each preview of T6.6-2, T6.6-4, T6.6-5, and T6.6-6 rerun without `--json` on the same state (reusing those tests' stagings), its exit equal to the twin's, nothing written, its decoded model equal to the `--json` twin's decoded model; each refused preview of T6.6-3 rerun without `--json`, its findings through Task 28's findings decoder, exit 1; H-7 entry (`"6.6"`, `"12.0"`, `"14"`).

**Checks.** T6.6-7 against the built product: record the verdict (a decoded-model mismatch the product causes is a diagnosed failure); the S-5 vectors pass.

### Task 130 — T12.0-15 registered: `build`, `check`, the gated reads; non-UTF-8 marking (RB-20, RC-8, part)

**Depends on.** Tasks 28, 29, 110, 128.

**Gap.** TEST-SPEC §12.0, T12.0-15 (new, "Human-form reports"; read it whole). "On the fixtures named below, each invocation is run again without `--json` on the same pre-invocation state — a fresh copy of it for a mutating command — and exits as its `--json` twin, standard error byte-identical (T12.0-2); its report on standard output, decoded by its human-report adapter (H-3) onto the information model the `--json` assertions use, carries the same information as the `--json` document … its wording and layout free, and its order free save where SPEC.md fixes one for the report itself …". This task's fixtures: "`build` and `check` — T14-11's per-condition fixtures, T12.2-2's per-family workspaces, and T1.5-2's every arm, its located arm included, each finding's code, locations, concerned path, and identities (14), and the gated reads' reports of the same findings (T13.3-3)"; and non-UTF-8 paths: "on T1.5-2's Linux-leg non-UTF-8 arms, every human report carrying such a path — the condition-19 finding's concerned path, and the located arm's location file — presents it explicitly marked, the human-report adapter telling it from a plain path string by that mark alone and recovering from it the path's exact bytes …; each such report is byte-identical across two runs on the same state (H-6); and every valid-UTF-8 path T1.5-2's arms report — the `#` and U+FFFD arms' concerned paths among them — is presented as a plain string, never marked". Not registered.

**Change.** Register T12.0-15 in a §12.0 module (a new `test/suite/registry/section-12.0-iv.ts` with its wrapper and index spread, since it reuses stagings exported from many modules) with this family: a shared runner that runs an invocation in both forms on copies of one pre-invocation state, compares exits and standard error, and compares the human decode (Task 28's findings decoder) with the `--json` decode; the stagings imported from T14-11's, T12.2-2's, T1.5-2's, and T13.3-3's modules (export what is needed). H-7 entry (`"12.0"`, `"14"`, extended by later tasks as they assert further passages). The title and header say Tasks 131–135 add the remaining families.

**Checks.** T12.0-15 against the built product, alone under the namespace: record the verdict per fixture family.

### Task 131 — T12.0-15's `rename` and `move` reports (RB-20, part)

**Depends on.** Tasks 49, 50, 51, 52, 122, 129, 130.

**Gap.** TEST-SPEC T12.0-15's `rename` and `move` fixtures: "the performed reports of T6.4-1 and T6.5-1, the previews of T6.6-7, and the refused real operations of T6.4-3, T6.4-6, T6.5-4, T6.5-6, T6.5-16, T6.5-17, T6.5-20, T6.5-21, and T14-7: each refusal finding's code, locations, concerned path, and identities (14: a refusal renders as precisely as a finding), and the invalid-workspace refusal's findings each under its own condition's code (6.4, T6.4-6), a human refusal printing nothing or omitting any of them failing". (T6.6-7, Task 129, carries the previews; this task cites it rather than repeating them.)

**Change.** A performed-report decoder (mapping pairs) beside Task 28's layer, with S-5 vectors; T12.0-15's `rename`/`move` family over the stagings exported from those tests' modules (each mutating invocation on fresh copies of the same pre-invocation state). H-7 entry gains `"6.4"`, `"6.5"`.

**Checks.** T12.0-15 against the built product, alone: record verdicts per fixture.

### Task 132 — T12.0-15's `impact` reports (RB-20, part)

**Depends on.** Task 130.

**Gap.** TEST-SPEC T12.0-15: "`impact` — T5.6-1 through T5.6-6 and T9-1 through T9.3-3: each category with its attribution, the collapsed chains, deleted nodes under their baseline identities, and each impacted location with its witness edge and path (9.1, 9.3)".

**Change.** An impact-report decoder beside Task 28's layer (categories with attribution, collapsed chains, deleted nodes, impacted locations with witness edges and paths, order free save where SPEC fixes one), with S-5 vectors; T12.0-15's `impact` family over those tests' stagings. H-7 entry gains `"5.6"`, `"9"`, `"9.3"` as asserted.

**Checks.** T12.0-15 against the built product, alone: record verdicts per fixture.

### Task 133 — T12.0-15's `review` reports (RB-20, part)

**Depends on.** Tasks 64, 80, 81, 83, 85, 130.

**Gap.** TEST-SPEC T12.0-15: "`review` — `list` (T10.7-5, a corrupt session's report included), `status` (T10.7-6), `next` (T10.7-7: the item returned, and the fully-resolved report), `show` (T10.7-8: the full item with its text payload), the refusals of T10.7-1, T10.7-9, and T10.7-10, and `status`, `next`, `show`, `resolve`, and `split` naming each corrupt session of T10.1-4 — the condition-21 finding's code and concerned path, the corruption being the report (10.1, 14.21)"; 10.7's `list` and `status` orders are fixed for the report itself.

**Change.** Review-report decoders (list, status, next, show, refusal) beside Task 28's layer, with S-5 vectors; T12.0-15's `review` family over those tests' stagings. H-7 entry gains `"10.1"`, `"10.7"`.

**Checks.** T12.0-15 against the built product, alone: record verdicts per fixture.

### Task 134 — T12.0-15's `coverage`, `ids`, and `show` reports (RB-20, part)

**Depends on.** Tasks 108, 130.

**Gap.** TEST-SPEC T12.0-15: "`coverage` — T8.2-1, every profile's counts, node identities, covering paths, and ignored nodes' reasons; `ids` — T12.3-1, `--tree` included; and `show` — T12.4-1, its root and non-root arms"; 8.2's reasons and 12.3's listing orders are fixed for the report itself.

**Change.** Coverage, ids (flat and tree), and show decoders beside Task 28's layer, with S-5 vectors; T12.0-15's family over those tests' stagings; T12.3-1's human-form entry arms (Task 108) re-read through the `ids` decoder. H-7 entry gains `"8.2"`, `"12.3"`, `"12.4"`.

**Checks.** T12.0-15 and T12.3-1 against the built product: record verdicts.

### Task 135 — T12.0-15's exit-2 errors (RB-20, rest)

**Depends on.** Tasks 48, 109, 125, 127, 130.

**Gap.** TEST-SPEC T12.0-15: "Exit-2 errors (12.0, 14): without JSON output in effect, an exit-2 error's standard-error message is its only report, and a condition that carries a stable code and a concerned path — conditions 14, 24, 25, and 26, and condition 13 where a given baseline's resolution reports it (6.3) — carries both there …: on T12.7-3's configuration-error stagings — each concerned-path form: the file the upward search found, `.` for a failed upward search, and `--config`'s canonical anchoring and as-given forms — on T14-9's write failure, T14-10's exit-2 read failures, T6.3-6's journal errors at a given baseline, and T13.5-2's busy workspace, each invocation run again without `--json` on the same pre-invocation state exits 2 with empty standard output, and its standard-error message, decoded by a human-report adapter …, carries the stable code and the concerned path its `--json` twin's error document carries (T12.7-3) — wording free; a message omitting either fails. A plain usage error's message is asserted for neither". H-5 states the same rule suite-wide.

**Change.** T12.0-15's exit-2 family over those stagings (T13.5-2's busy workspace through its held run), each through Task 28's exit-2 decoder; T12.0-2's human configuration-error arm (`section-12.0-i.ts`, about lines 800–814, which checks only empty stdout and non-empty stderr) also asserts the code and path through the decoder (H-5). Title and header complete. H-7 entry gains `"6.3"`, `"13.5"` as asserted.

**Checks.** T12.0-15 and T12.0-2 against the built product, alone under the namespace: record verdicts per staging.

### Task 136 — P-9's two new invariants (RC-5)

**Gap.** TEST-SPEC §16, P-9 (revised): "at most one item per kind and scope node, and none whose kind and scope node are recorded as decomposed (10.1) — read from `export`'s items and recorded decompositions, scope nodes compared as canonical identities (10.4), which the harness derives from the journaled operations its own draw performed, as P-6's oracle maps identities; … immediately after any `resolve`, with no workspace edit between, a read presents the resolved item with the status just set, never `invalidated` (10.4 …)". Observed (reviewer C): `assertSessionInvariants` (`test/suite/registry/section-16-p9.ts`, about line 755) never compares items with recorded decompositions; `decodeExportReport` (`test/helpers/adapters/review.ts`, about line 449) passes `decompositions` through as opaque JSON; the `resolve` step (about line 1095) asserts exit 0 only.

**Change.**
- `review.ts`: decode each recorded decomposition's kind and scope node (completing what Task 69 decoded), failing loudly when absent; S-5 vectors.
- `section-16-p9.ts`: map scope nodes to canonical identities through the journaled operations the draw performed (P-6's oracle's mapping, `test/helpers/oracles/graph-diff.ts`, or the same rule), and assert no item's (kind, canonical scope node) is a recorded decomposition's; after each `resolve` with no workspace edit between, a read (`status` or `export`) presents that item with the status just set, never `invalidated`. If P-9's generator never performs a journaled operation, the mapping is the identity — say so in a comment, keeping the rule ready.
- The S-9 per-draw checks and fixed-seed guards stay as they are.

**Checks.** P-9 against the built product at the fixed seeds, alone: record the verdict and time; P-9 against the empty stub still fails diagnosed (S-7).

### Task 137 — The path-blocks generation oracle and its S-6 vectors (RC-6, part)

**Gap.** TEST-SPEC S-6 (revised): the path-blocks generation oracle (P-16) passes its own fixed vectors before the property trusts it — "15's worked session — its four items — with the pinned item lists of T10.5-1, T10.5-7, T10.5-8, and T10.5-9 for the path-blocks generation oracle". P-16's oracle: "an independent oracle of 10.5 [deriving] from P-6's graph-diff oracle (its categories with their originating nodes, identities mapped through the journal suffix, and 9.2's impacted code over impact edges in either graph): the same kinds and scope nodes; each item's scope set, context, and origin exactly; each item's `blockedBy` as the set of the kinds and scope nodes of the items it names; and the item order of 10.5 — scope nodes compared as canonical identities (10.4) and presented under their current identities. `reason` … and the recorded hashes are not compared." Observed: no path-blocks oracle exists in `test/helpers/oracles/`.

**Change.**
- `test/helpers/oracles/path-blocks.ts`: the oracle over P-6's graph-diff oracle's output (and the two graphs' impact edges), implementing SPEC 10.5's generation (visiting and skipping, roots visited as N, baseline-parent links for deleted nodes through the journal and current-parent links for present ones, each kind's scope, context, and origin with the `d`-target counting rule, impact edges of both kinds, blocking chains, the total order), harness code only; read SPEC 10.5 and 15 in full.
- `test/self/s6-path-blocks-oracle.test.ts`: the fixed vectors — SPEC 15's worked session (its four items) and the item lists TEST-SPEC pins in T10.5-1, T10.5-7, T10.5-8, and T10.5-9 — each built as oracle input from the vector's graphs and journal, the oracle's items equal to the pinned ones; and a red check per vector (a scratch-backed oracle copy with one rule broken fails it).

**Checks.** The new S-6 self-test passes; the red checks fail as stated (record them).

### Task 138 — P-16 registered (RC-6, rest)

**Depends on.** Task 137; S-3's design (Tasks 18–20).

**Gap.** TEST-SPEC §16, P-16 (new, "path-blocks generation"; read it whole): random valid workspaces of spec and code sources — nested sections, `d` references, `{text(...)}` embeddings (root-sourced ones included), `coverage` and `tags` attributes, and code locations bearing markers and `text(...)` calls — committed as a baseline and then changed by P-6's random interleavings of edits (own-text, metadata, and embedding edits, section and file additions and deletions, and child reorders), journaled renames, and journaled moves of both forms, the section-form ones drawn under P-5's discipline and including moves into another parent; `review create --base` against that baseline yields exactly the items the oracle derives — kinds and scope nodes, each item's scope set, context, and origin, `blockedBy` as sets of kinds and scope nodes, and the item order — `reason` and the recorded hashes not compared. Observed (reviewer C): P-16 is not registered (the registry stops at P-15); no S-9 form vectors or per-draw checks exist for its generator; no H-7 entry; S-8's scale vectors will need to cover its `review create --base`/`export` answers.

**Change.**
- A new `test/suite/registry/section-16-p16.ts` (wrapper `test/suite/section-16-p16.test.ts`, index spread): the generator composed from P-6's and P-5's generators (`section-16-p5-p6.ts`; export what is needed) plus code sources with markers and `text(...)` calls; the property through `checkProperty` at the fixed seeds (E-5), every draw valid by construction and checked by S-9's per-draw check before the product is driven (`drawSources`), the oracle of Task 137 consulted per draw; no fixed span guard (S-3's design); H-7 entry (`"10.5"`, plus the passages it asserts, e.g. `"9.2"`, `"10.4"`).
- S-9 form vectors for the generator's composed forms (`test/self/s9-*.test.ts`, as P-5's and P-6's forms are covered), and the fixed-seed draw guard pattern if the module family uses one (AGENTS.md's bullets on P-5's and P-8's fixed-seed draws).
- S-8: extend `test/self/s8-answer-scale-capacity.test.ts`'s scale derivation to P-16's `review create --base`/`export` answers (AGENTS.md's bullet beginning "Staged-scale gates").

**Checks.** P-16 against the built product at the fixed seeds, alone: record the verdict, draw count, and time; against the stub it fails diagnosed (S-7); the S-9 and S-8 self-tests pass.

### Task 139 — Confirm locally and in CI; record the timings; delete this plan

**Depends on.** Every other task (gone from this plan once done, recorded in the Order section).

**Change and checks.**
- *Self project and certification.* Run the self project per Run mechanics, `dist/` absent, the admin files left out: 0 failures; the counts in AGENTS.md's bullet beginning "Harness self-tests and certification only" matching the run; the certification lines 171 PASS / 48 FAIL / 0 error / 0 hang with 0 discrepancies (`compare_cert.py`), the per-pair lines identical to `pairs-expected-after-task1.txt` (`cert_compare.py`, `diff` empty).
- *CI.* Before committing, find the run on the branch's head (the last task's push) and wait for it to complete by polling in the foreground (Run mechanics). If a job ends `cancelled` with no steps (an infrastructure event), re-run that job once (`gh api --method POST repos/modularcloud/xspec/actions/jobs/<job-id>/rerun`); if that is refused, report the refusal and stop. Never push a commit just to retrigger. Expect:
  - the harness-self job green with no product installed (its self project including the admin files; certification with 0 discrepancies against the document) — the phase gate;
  - the full-suite job: its self half green; its product failures every one a `HarnessAssertionError` at an arm a task of this plan added or changed (`analyze_suite.py` against `<scratchpad>/p9j_2a2/ci1337/suite-linux.clean.log`, where every product test passed), each matching the verdict that task recorded; no harness error, crash, or hang; the job inside its 90 minutes;
  - the Windows leg: its probes (T7-1's new one included) passing against the built product, or failing diagnosed exactly where a task recorded a product deviation.
  Explain any difference before going further; a harness defect found here is fixed in this task (or, if large, planned as a new task above this one, the plan kept).
- *No local suite run.* Each task ran its changed tests against the built product, and S-7 sweeps every body against the stub and an absent artifact in the self project, so CI's full-suite job is the suite-wide check. Say so in the commit message.
- *Timings.* Add this run's figures to AGENTS.md's timings bullet (the one beginning "Timings on a 4-core machine"), in its style, replacing what they supersede: the local self project; the harness-self job (its self project, `certification.test.ts`, the S-7 file, the whole job against its 20 minutes); the full-suite job and its longest tests; the Windows leg.
- *Delete this plan.* Once no other task remains in `specs/tmp/FIX_PLAN.md`, delete it with `git rm` in the same commit, under the Preamble's "Deleting this plan" rule.
- Commit (subject `sdg(phase-9): confirm the harness locally and in CI; record the timings; delete the finished plan (FIX_PLAN Task 139)`) and push.
