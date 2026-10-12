# FIX_PLAN — Phase 9 (test harness), 13.5 re-descent, determination at 2d9cdf6

Written 2026-10-12 at 2d9cdf6 (branch `claude/xspec-ui-apis-4df8fa`, standing in for `patch/external-ui-apis`). It plans from the re-descent's compliance determination at 2d9cdf6 — the first since the iteration-59 plan's tasks ran — which was not clean:
- A (TEST-SPEC's T1–T6 tests): compliant;
- B (T7 onward): compliant;
- C (everything outside the T-numbered tests): 1 gap, cited here as RC-1 (reviewer C's gap 1 — not TEST-SPEC's C-1) and planned as Tasks 1 and 2;
- D (CERTIFICATIONS.md): compliant;
- V (VERIFY): green — every harness self-test and all 39 certifications pass, locally and in CI (runs 1213 and 1214).

Reviewer C's report is in the scratchpad `/tmp/claude-0/-home-user-xspec/08a79bea-e066-52cf-ac19-1be1615496b4/scratchpad/` (`<scratchpad>` below) as `p9j_2d9/report_C.txt`; read it when a task's text leaves a detail open, but take every exact spelling from the spec documents or the harness code, never from a report.

Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tests Specified); no task changes its stage. No Bug Report applies. No problems file exists. The specs have not moved since the previous plan was written: SPEC.md as of 7f9ac70, TEST-SPEC.md as of e8d1140, CERTIFICATIONS.md as of a3196a1. The Developer's settled choice of 13.5's reach (option B: every user and environment on one machine; the lock directory `.xspec/lock` in the workspace) is not reopened by any task.

The previous plan (written at acfff0b from iteration 59's determination, deleted at 1418ab9) is `git show 1418ab9^:specs/tmp/FIX_PLAN.md`; its Order section records what each of its tasks did. The plans before it are `git show a126add^:specs/tmp/FIX_PLAN.md` and `git show 9583e3b^:specs/tmp/FIX_PLAN.md`.

## Preamble — read before any task

**Phase goal and scope guards (Phase 9).** The harness must adhere to `specs/TEST-SPEC.md` and `specs/CERTIFICATIONS.md`. Every harness self-test and every certification passes: each certified test passes against its conformer and fails against each of its violators exactly as the violator's entry states. Product tests may fail, but only as diagnosed assertion failures (H-8): never a harness error, crash, hang, or false pass. Never modify product code (`src/`; `dist/` is built from it). The tasks here are harness work: `test/self/machine-staging.admin.test.ts` (Task 1), the `harness-self` job of `.github/workflows/ci.yml` (Task 2 — TEST-SPEC §18 and C-1 make CI part of the harness, and Phase 9 has changed this workflow before, f3acd32), and `AGENTS.md` (build/run knowledge only). If a task meets a spec defect (a contradiction, an impossible requirement), stop, log it in the matching problems file under `specs/tmp/`, commit, push, and end with `OUTCOME: PROBLEM`; never work around it.

**Known state at 2d9cdf6.**
- `specs/tmp/` held only `.gitkeep` before this plan. 2d9cdf6 changed `specs/PHILOSOPHY.md` alone, so the harness and product trees are 1418ab9's.
- The checkout has no `node_modules` (`npm ci` restores it) and no `dist/`: the product is not built here, so a local self-project run is a run with no product installed (H-8). No task in this plan builds the product locally; keep it that way. If you find `dist/` present, leave it and say so in your report: your local run is then no no-product run, and CI's harness-self job (from Task 2 on) is the no-product check.
- CI run 1214 (ID 38311990208) at 2d9cdf6:
  - harness-self job 115019658560: green; 39 files, 4444 tests, all passed in 298.29 s; the job 5 min 26 s of its 20 minutes, its "Build the product" step ~4 s; `test/self/machine-staging.admin.test.ts` 7 tests passed (3966 ms), `test/self/pid-namespace-staging.admin.test.ts` 3 tests passed (3959 ms); certification 186 PASS / 50 FAIL / 0 error / 0 hang, 0 discrepancies against the document (its cleaned log: `<scratchpad>/p9j_2d9/hs1214.clean.log`);
  - full-suite job 115019658959: 127 files, 4797 tests, 29 failed and 4768 passed in 1477.03 s (24 min 55 s of its 60), every failure a `HarnessAssertionError` in the suite project, its self-project half green: the E-6 writer, P-10, P-14, P-15, T6.1-1, T6.6-3, T7-2, T7-4, T10.1-6, T11.6-1, T11.6-3, T11.6-4, T12.7-3, T13.4-12, T13.5-1 through T13.5-4, T13.5-6 through T13.5-13, T14-6, T14-9, and T14-10 — the same set as runs 1204 to 1213 (the built product predates the 13.5 revision; its cleaned log: `<scratchpad>/engineer-verify/ci-1214-linux.clean.log`);
  - Windows leg 115027831907: 3 files, 9 tests, 2 failed, both diagnosed (E-6's byte-identity test; T11.6-1's drive-mismatch arm).
  - Run 1213 (1418ab9) gave the same results.
- Locally (VERIFY, the unprivileged recipe, the admin files left out): 37 files, 4434 tests, all passed in 381.92 s; certification 186 PASS / 50 FAIL / 0 error / 0 hang, 0 discrepancies.
- Node v22.22.0 locally (`/opt/node22/bin/node`), Vitest 4.1.10, TypeScript 5.9.3; PyYAML 6.0.1 under `python3 -I`.

**Run mechanics (AGENTS.md holds the recipes; read the bullets a task names before running anything).**
- Confirm `git status` is clean on `claude/xspec-ui-apis-4df8fa` before editing, and read `git log -3 --format='%h %s'`: a task interrupted after a push resumes where its text says. Never fetch or merge `main` (its newer scaffold commit 63bcb3f is not adopted in this run). Push with `git push -u origin claude/xspec-ui-apis-4df8fa`, retrying network errors with backoff (2 s, 4 s, 8 s, 16 s); never force-push, reset a pushed commit, or rewrite history; check `git log -1` before every push.
- Permission refusals: if the permission system refuses any action, stop that line of work and report the refusal verbatim; never retry it or seek the same result another way. GitHub's "GraphQL is not available" 403 is not a refusal: read GitHub through REST (`gh api repos/modularcloud/xspec/...`) or the GitHub MCP tools.
- Administrative access (Developer's standing constraint): nothing needing administrative access runs locally — no user account, mount, PID namespace, or other-user process, no `sudo` beyond AGENTS.md's documented recipe, and no inspection of `sudo`, sudoers, accounts, or credentials, directly or through a test, staging, or script. Tests needing it (`test/self/*.admin.test.ts`, T13.5-9, T13.5-10(e)–(g)) are written locally and verified only in CI; local command lines leave those files out (never skip them in code).
- The self project: `unshare --map-user=1000 --map-group=1000 -- env -u NODE_OPTIONS npx vitest run --config test/vitest.config.ts --project self --exclude 'test/self/**/*.admin.test.ts'` (AGENTS.md's bullet beginning "The self project — and, once the Linux-leg tests"), redirected to a log in the scratchpad; grep the log for `×` and the `Tests` summary, never cap it with `head`. Run it alone, checking the load first (other agents may share the machine); a failure seen only while harness runs overlap is not a task failure: rerun alone.
- Certification lines against the document: `python3 -I <scratchpad>/engineer-verify/compare_cert.py specs/CERTIFICATIONS.md <log>` (VERIFY's; read its docstring) prints the PASS / FAIL / ERROR / HANG totals, the totals the document expects (186 / 50 / 0 / 0), and every discrepancy. It parses a log with ANSI escapes and CI timestamps stripped.
- Reading CI: AGENTS.md's bullet beginning "Reading a CI run from this sandbox" (`gh api` for runs, jobs, steps, and check-run annotations; the GitHub MCP `get_job_logs` tool, loaded through ToolSearch, for a job's log). Strip a CI log's timestamps and colour escapes before reading it: `sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z //; s/\x1b\[[0-9;]*m//g' <raw> > <clean>`. VERIFY's `python3 -I <scratchpad>/engineer-verify/analyze_suite.py <clean log> [<baseline clean log>]` lists each failing test with its error class and, given a baseline, the IDs failing in one log only. A push cancels the branch's run in progress; a job cancelled with no steps is an infrastructure event, not a verdict (AGENTS.md). CI runs on pushes to the branch; PR #7 gets no `pull_request` runs.
- The scratchpad is shared across spawns: use task-specific directories (`t9j2d9_<N>/`); this plan's references (`p9j_2d9/`), the reviewers' (`revA/`, `revB/`, `revC/`), and VERIFY's (`engineer-verify/`, `ci/`) files live there. Run Python with `python3 -I`. If `/FIX_PLAN.md.before` exists outside the checkout, leave it exactly as it is (Liaison directive, 2026-10-11; absent at 2d9cdf6). Set every shell variable a command uses within that same command, and never write, copy, or remove through a path built from a variable that might be empty.

**Spellings.** Take every exact spelling — command lines, paths, quoted requirement text — from the TEST-SPEC.md text the task cites or from the harness code it names, never from a review report. Keep the existing em dashes (U+2014) of any title or comment you edit; never type a character as a backslash-u escape into an edit or a Bash payload.

**Conventions for changed code.**
- *No product verdict moves.* No task here changes a product-facing test or a helper one uses: the suite's failing set must stay run 1214's 29, every failure a `HarnessAssertionError`, and S-7's sweep (`test/self/s7-red-green-sweep.test.ts`) stays as it is.
- *Comments and titles.* Every doc comment, module-header note, workflow comment, and test title a change contradicts is corrected in the same task.
- *AGENTS.md* gets only build/run knowledge a later spawn needs (a recipe, a count or timing a later check relies on, a corrected fact), never a task narrative.
- *CI-verified tasks.* An `*.admin.test.ts` file and the workflow can be verified only in CI, so Tasks 1 and 2 commit and push their change with the task still in this plan, read that push's harness-self job to completion, and then, in a further commit, remove the finished task from this plan and add its one-line summary (the run's number and ID, its results) to its bullet in the Order section (the pattern of b9601fb and ddbe755). That push cancels the earlier run's other jobs; Task 3 reads the final head's run in full. The one probe committed to the branch is Task 2's, because CI is the only place it can run; Task 2's last commit reverts it.
- *Every task ends with:* `npm run typecheck` and `npm run format:check` exiting 0; the checks it names, with every outcome; the self project (Run mechanics) with 0 failures and the certification lines unchanged (186 PASS / 50 FAIL / 0 error / 0 hang, 0 discrepancies); commits (`sdg(phase-9): <imperative summary> (FIX_PLAN Task N)`, each ending with the two trailer lines the session requires) stating honest results; and a push.

**Standing rulings.** Two Liaison rulings stand for this run: AGENTS.md's "Known residual 14.20 location gaps" and "Known SPEC 6.5 gap, deferred to a future SPEC revision (accepted for this run by ruling)" bullets. No task addresses them, and none may be added for them.

**Deleting this plan.** Only Task 3 deletes this file, with `git rm`, once no other task remains (`specs/tmp/.gitkeep` stays). If the permission system refuses the deletion, stop there: leave the file in place, commit nothing further for it, and report the refusal. Never move, rename, empty, or otherwise work around a refused deletion.

**Superseded.** The previous plan's "Considered and not planned" item from reviewer C — "(3) `test/self/machine-staging.admin.test.ts` checks that the second user can reach the built executable, so it needs `dist/`; CI builds the product first, and no product behaviour is relied on" — no longer holds: this determination's reviewer C reads H-8's "Self-tests (17) and certification MUST pass before the product exists" as binding that self-test (RC-1). Every other item of that list, and of the lists it carries forward, still holds.

**Considered and not planned (do not re-raise).** New at this determination, from reviewer C: P-9's audit-only sessions (P-9 names no strategy; the audit design exercises create, split, resolve-time re-derivation, and the at-most-one rule); no network denial on the Windows leg (E-1's network sentence concerns the full suite on Linux runners; a network-dependent product fails there, and E-6's byte-identity comparison catches any divergence); E-6's "the kill and the refusal modify nothing" (the reason the cross-leg comparison is sound, not a separate assertion; the refusal's modifying nothing is asserted). Reviewers A, B, and D and VERIFY found nothing to plan.

**Order.** Take the topmost task unless told otherwise; Task 3 comes last. When a task is done, its commit removes it from the Tasks section and adds a one-line summary to its bullet here.
- Task 1 (RC-1): `test/self/machine-staging.admin.test.ts` verifies the second user's reach against the harness-owned empty stub, never the built product. Done (06a291c, then the commit recording it): CI run 1216 (ID 38317788073) at 06a291c, harness-self job 115038699006 green in 4 min 38 s of its 20 (still building the product, ~3 s, until Task 2): 39 files, 4444 tests, all passed in 257.48 s; `machine-staging.admin.test.ts` 7 tests passed (3777 ms), the reach test's pinned list (Node executable, the stub readable) among them, so no Fallback; `pid-namespace-staging.admin.test.ts` 3 passed (3792 ms); certification 186 PASS / 50 FAIL / 0 error / 0 hang, 0 discrepancies. Locally (`dist/` absent, the admin files left out): 37 files, 4434 tests, all passed in 360.47 s, the same certification lines.
- Task 2 (RC-1): CI's harness-self job runs the self project and certification with no product installed, shown red against a probe that restores Task 1's fault.
- Task 3: confirm locally and in CI; record the timings; delete this plan.

## Tasks

### Task 2 — CI's harness-self job runs the self project and certification with no product installed (RC-1)

**Depends on.** Task 1 (gone from this plan, recorded in the Order section).

**Requirement.** H-8: "Self-tests (17) and certification MUST pass before the product exists." In this repository the product already exists, so that property can be checked only by running the self project and certification with no product installed. The `*.admin.test.ts` files run only in CI, so CI is the only place it can be checked for them. Reviewer C, on RC-1: "the test passes in CI only because the harness-self job runs `npm run build` first". The header comment of `.github/workflows/ci.yml` calls the harness-self job "the signal that must be green before the product exists (red-green)", yet the job builds the product before `npm run test:self`. No CI job runs the self project without the product, so a self-test that needs `dist/` passes in CI unnoticed. TEST-SPEC §18 (E-1) and C-1 ("Certification results are part of the harness's CI output") make this job harness CI.

**State at 2d9cdf6.**
- `.github/workflows/ci.yml`, job `harness-self` (lines 63–79), runs these steps in order:
  1. `actions/checkout@v4`;
  2. `actions/setup-node@v4` (Node 22, npm cache);
  3. `npm ci`;
  4. "Typecheck both programs (product and harness)" (`npm run typecheck`, which is `tsc -p src --noEmit && tsc -p test` and emits nothing);
  5. "Build the product" (`npm run build`, ~4 s);
  6. "Run harness self-tests and certification (network disabled, unprivileged, administrative access kept)" (`bash .github/scripts/run-without-network.sh npm run test:self`).
- The header comment's `harness-self` paragraph is lines 5–10.
- Nothing else would install the product: `dist/` is git-ignored (`.gitignore`), and `package.json` has no lifecycle script that builds on install.
- The `suite-linux` job's `npm test` runs the self project again with the product built, and keeps doing so.
- AGENTS.md's CI bullet (beginning "CI: `.github/workflows/ci.yml`") and its self-tests bullet (beginning "Harness self-tests and certification only (TEST-SPEC 17): `npm run test:self`.") say nothing about a build in this job.

**Change.**
- In the `harness-self` job only, remove the "Build the product" step, and in its place, before the self step, add:
  ```yaml
      - name: Confirm no product is installed (H-8; self-tests and certification run before the product exists)
        run: |
          if [ -e dist ]; then
            echo "::error::dist/ exists, but this job runs the harness self-tests and certification with no product installed (TEST-SPEC H-8)"
            exit 1
          fi
  ```
  (Indented as the job's other steps are. The step name carries no `: `, which a plain YAML scalar cannot hold; a scratch copy of the workflow with this step parses, `<scratchpad>/p9j_2d9/ci-snippet-check.yml`.) Keep every other step, the job's name, and `timeout-minutes: 20` as they are. Leave `suite-linux`, `suite-windows`, `on:`, `concurrency:`, and `release.yml` unchanged: their product-facing tests need the product.
- Rewrite the header's `harness-self` paragraph. It says the job runs with no product installed: it builds nothing and confirms `dist/` absent first, so a self-test or certification that needs the built product fails here (H-8). It is still "the signal that must be green before the product exists (red-green)", and `suite-linux` runs the self project again with the product built.
- AGENTS.md:
  - In the CI bullet, say that the harness-self job installs no product: it does not build, and a step confirms `dist/` absent before the self project and certification run. The full-suite and Windows jobs build it first.
  - In the self-tests bullet's opening sentence, add that `npm run test:self` needs no product build (H-8), and that CI's harness-self job runs it with no `dist/`.

**Verify: red against a probe, then green.** The probe is a temporary commit that restores Task 1's fault, so the new job is shown failing exactly where a self-test needs the product. On resuming after an interruption, read `git log -3 --format='%h %s'` and `git status` first. If the head is commit A (subject below) with no probe after it, continue at step 2. If the head is this task's probe commit (its subject begins `sdg(phase-9): add a temporary probe`), push it if `git status` shows it unpushed, and continue at step 3. If it is the probe's revert, this task is done.
1. Commit the change (commit A; subject `sdg(phase-9): run CI's harness-self job with no product installed (FIX_PLAN Task 2)`) after these checks:
   - `npm run typecheck` and `npm run format:check`;
   - `python3 -I -c 'import sys, yaml; w = yaml.safe_load(open(sys.argv[1])); print([s.get("name") or s.get("run") or s.get("uses") for s in w["jobs"]["harness-self"]["steps"]])' .github/workflows/ci.yml` parses the workflow and lists the harness-self job's steps: no build, with the no-product step before the self step;
   - `git diff` touches only the harness-self job, the header paragraph, and AGENTS.md;
   - the local self project, per Conventions.
2. Commit the temporary probe (commit P; subject `sdg(phase-9): add a temporary probe: bind the second-user reach self-test to the built product again, with no product installed (FIX_PLAN Task 2)`). In `test/self/machine-staging.admin.test.ts`, change only the reach arm's `binding:` back to `builtProductBinding()`, imported from `../helpers/subprocess.js`. Change nothing else. Typecheck and format must still pass.
3. Push A and P together, in one push. Read P's run's harness-self job to completion (~6 min) and expect all of the following:
   - its steps include no build, and the no-product step succeeds;
   - the self step fails on exactly one test, the reach test;
   - that test's error is a `HarnessStagingError` whose message contains `the second user cannot read` and `/dist/cli/bin.js (ENOENT)` (read from the job's annotations or its log);
   - every other test passes (4443, the file's other six tests and `pid-namespace-staging.admin.test.ts` among them);
   - certification shows 186 PASS / 50 FAIL / 0 error / 0 hang with 0 discrepancies.

   Save the log to `t9j2d9_2/`. If the job ends `cancelled` with no steps (an infrastructure event), re-run that job once (`gh api --method POST repos/modularcloud/xspec/actions/jobs/<job-id>/rerun`). If that is refused, report the refusal and stop. Never push a commit just to retrigger.
4. If any other test or certification fails in step 3, a further H-8 dependence on the product has been found. Add a task for it to this plan, before Task 3, citing H-8 and the run, and carry on.
5. Revert the probe as commit R: `git revert --no-commit <P>`, then commit with the convention's subject (`sdg(phase-9): remove the temporary probe; record CI run <N> for the no-product harness-self job (FIX_PLAN Task 2)`), never git's default message. In the same commit, Task 2 leaves this plan, and its Order bullet records P's run (number, ID, the failing test and its diagnosis, the counts, the job's duration). Check that `git diff <A> HEAD -- test .github` is empty, so R's harness tree is A's. Push. Task 3 reads R's run.

**Done when.** The checks hold, A, P, and R are pushed, and their messages record the results.

### Task 3 — Confirm locally and in CI; record the timings; delete this plan

**Depends on.** Tasks 1 and 2 (gone from this plan, recorded in the Order section), and any task Task 2 added.

**Change and checks.**
- *Self project and certification.* Run the self project per Run mechanics, with `dist/` absent and the admin files left out. Expect:
  - 0 failures (37 files, 4434 tests unless a task recorded a change);
  - the counts in AGENTS.md's bullet beginning "Harness self-tests and certification only" match the run;
  - the certification lines 186 PASS / 50 FAIL / 0 error / 0 hang, with 0 discrepancies against the document (`compare_cert.py`).
- *CI.* Before committing, read the run on the head Task 2 pushed (commit R, or the last commit of a task it added) and wait for it to complete. Expect:
  - the harness-self job green with no product installed: no build step, and the no-product step succeeded; 39 files, 4444 tests, all passed, the admin files included (`machine-staging.admin.test.ts` 7, `pid-namespace-staging.admin.test.ts` 3); certification with 0 discrepancies;
  - the full-suite job failing only on run 1214's 29 diagnosed product tests, every one a `HarnessAssertionError`, its self-project half green (`analyze_suite.py` against run 1214's cleaned log);
  - the Windows leg's 2 diagnosed failures, as in run 1214.

  Explain any difference before going further.
- *No local suite run.* No task here changed a product-facing test or a helper one uses, so CI's full-suite job is the suite check. Say so in the commit message.
- *Timings.* Add this run's figures to AGENTS.md's timings bullet (the bullet beginning "Timings on a 4-core machine"), in its style, replacing what they supersede: the local self project; the harness-self job, now without a build step (its self project, `certification.test.ts`, and the whole job against its 20 minutes); the full-suite job; and the Windows leg.
- *Delete this plan.* Once no other task remains in `specs/tmp/FIX_PLAN.md`, delete it with `git rm` in the same commit, under the Preamble's "Deleting this plan" rule.

**Done when.** The checks hold, the commit message records them, the plan is deleted (or its refused deletion reported), and the commit is pushed.
