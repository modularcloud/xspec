# FIX_PLAN — Phase 9 (test harness), 13.5 re-descent, iteration 2

Written 2026-10-10 at bb3081a (branch `claude/xspec-ui-apis-4df8fa`, standing in for `patch/external-ui-apis`). It plans from the re-descent's first compliance determination after the 13.5 jump-back, which was not clean. Its findings (the reports are in the scratchpad as `p9j_c2_report_A.txt`, `_B`, `_C`, `_D`, `_V`; read the one a task cites when its task text leaves a detail open, but take every exact spelling from the spec documents, never from a report):
- A (TEST-SPEC's T1–T6 tests): 4 gaps, cited here as A-G1 … A-G4;
- B (T7 onward): 27 gaps, B-G1 … B-G27;
- C (everything outside the T-numbered tests): 8 gaps, C-G1 … C-G8;
- D (CERTIFICATIONS.md): 14 gaps, D-1 … D-14;
- V (VERIFY): red — the three C-1 gate self-tests in `test/self/certification-document.test.ts` fail locally and in CI run 1110 (ID 38031952083); 13 document fixtures unimplemented, two violators' certified sets short, a dropped violator still wired; one AGENTS.md note (V1, Task 2).

The reports overlap heavily; every gap maps to the task(s) named in the Order section. Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tests Specified); no task changes its stage. No Bug Report applies.

Why the harness changes: the documents moved after the harness was last green (the previous Phase 9 ended at b3cc3e3). The deltas are `git diff 6b79462..7f9ac70 -- specs/SPEC.md`, `git diff 7f9ac70..e8d1140 -- specs/TEST-SPEC.md`, and `git diff 301f2f9..34df333 -- specs/CERTIFICATIONS.md`. In short: 13.5's exclusion moved from a temporary-folder lock into the in-workspace lock directory `.xspec/lock` (one plain-file entry per run, liveness judged by the identifier an entry's name records, leftovers removed at acquisition, release on every normal end); 12.7's inventory gained `lock`; 14.26 `workspace-busy` was added; TEST-SPEC added the held-state comparison, T13.5-3's kill discipline, H-4/H-6's lock-path rules, T13.4-12, T13.5-9 … T13.5-13, P-14, P-15, E-6's exclusion probe and machine-wide stagings (E-1); CERTIFICATIONS.md grew from 6 conformers and 21 violators to 9 and 30. `test/` has not changed since 3fe91f5. The Developer's settled choice of 13.5's reach (option B: every user and environment on one machine; the lock at `.xspec/lock` in the workspace) is not reopened by any task.

## Preamble — read before any task

**Phase goal and scope guards (Phase 9).** The harness must adhere to `specs/TEST-SPEC.md` and `specs/CERTIFICATIONS.md`. Every harness self-test and every certification passes: each certified test passes against its conformer and fails against each of its violators exactly as the violator's entry states (C-1, line 630). Product tests may fail, but only as diagnosed assertion failures (H-8): never a harness error, crash, hang, or false pass. Never modify product code (`src/`; `dist/` is built from it). Every task is harness work under `test/` (fixtures under `test/fixtures/` are harness code), plus `AGENTS.md` (build/run knowledge only) and, where a task says so, the test-running parts of `.github/workflows/ci.yml` (precedent: f3acd32, a Phase 9 task). If a task meets a spec defect (a contradiction, an impossible requirement), stop, log it in the matching problems file under `specs/tmp/`, commit, push, and end with `OUTCOME: PROBLEM`; never work around it.

**Known state at bb3081a (VERIFY V; CI run 1110).**
- Self project (`npm run test:self`, unprivileged, `NODE_OPTIONS` unset): 28 files, 4315 tests: 3 failed, 4312 passed, 0 skipped (125.60 s locally; 106.56 s in CI's harness-self job 114154619359). The three failures are in `test/self/certification-document.test.ts`: the count pins (the `test(` call at line 268, failing at its `expect`, line 281), the manifest mirror (line 287, failing at 301), and the in-scope registration check (line 304, failing at 314: `§CONF-RACE: T13.5-13` and `§CONF-LEFTOVER: P-15` unregistered).
- Certification: the manifest (`test/self/certification-fixtures.ts`) still mirrors CERTIFICATIONS.md as of 301f2f9: 27 fixtures (CORE 1 conformer + 8 violators, VALID 1+3, MD 1+2, DISC 1+3, AVAIL 1+3, ORPHAN 1+2), 154 PASS / 38 FAIL / 0 error / 0 hang, every outcome as that manifest states. All 27 verifications in `test/self/certification.test.ts` pass.
- Against the document: unimplemented — CONF-RACE, VIOL-RACE-LISTFIRST, CONF-READERS, VIOL-READERS-CLAIM, CONF-LEFTOVER, VIOL-LEFTOVER-FOLLOWLINK/-DOTNAMES/-BYTENAMES, VIOL-CORE-LATEHOLD/-EARLYRELEASE/-HOLDLINK/-READERENTRY/-BUILDWAIT; short — VIOL-CORE-EARLYWRITE certifies `T13.5-1, T13.5-4` (document: `T13.5-1, T13.5-2, T13.5-4, T13.5-8`), VIOL-CORE-CHATTYREADS `T13.4-5` (document: `T13.4-5, T13.5-4`); dropped but wired — VIOL-CORE-LATELOCK (`test/fixtures/conf-core/bin-latelock.mjs`).
- Registry: 344 test IDs. Unregistered though TEST-SPEC defines them: T13.4-12, T13.5-9, T13.5-10, T13.5-11, T13.5-12, T13.5-13, P-14, P-15 (T12.1-2 and T13.4-7 stay unregistered on purpose, pure cross-references).
- Suite against the built product: 345 tests in 79 files, all passing in CI (full-suite job 114154619171, 1022.71 s). Locally T6.6-3 hit its 240 s budget under load (175.18 s alone; 103.23 s in CI). The built product still keeps its lock in the temporary folder (`src/workspace/lock.ts`) and its inventory has no `lock` member, so most tasks below make product tests fail against it — expected in Phase 9, as long as every such failure is diagnosed.
- Windows leg (E-6 subset): 3 files, 9 tests, green (39.34 s, job 114157594212).
- `npm run typecheck`, `npm run build`, `npm run format:check` exit 0; both TypeScript copies 5.9.3; Vitest 4.1.10; CI runs Node 22 (locally `/opt/node22/bin/node`, v22.22.2).

**Facts for 13.5's machine-wide stagings and kills** (from Phase 8's report and the Phase 6/7 drivers' notes; the tasks that need them repeat what matters).
- CI's Linux jobs run through `.github/scripts/run-without-network.sh`: no network, the runner's own uid/gid/groups with every capability cleared, passwordless `sudo` kept (E-1, H-2). Hosted runner verification line: `uid 1001, gid 1001, groups 1001,4,100,118,999; no capabilities; the caller's resource limits; network: lo alone; administrative access: sudo; temporary directory /tmp on ext2/ext3` (`ext2/ext3` is how `stat` names ext4).
- `sudo` resets the environment and the resource limits: runs started through it (as the second user, or into a namespace) must be given both explicitly. Runs started through `sudo` have no network either. Processes started through `sudo` may be owned by root, so signalling them may itself need `sudo`.
- Mounts the harness makes stay inside the run's private mount namespace (CI's wrapper makes one): every process of the suite sees them, nothing outside does. Locally, outside that wrapper, a mount lands in the sandbox's namespace and must be removed by its test.
- T13.5-10(c)'s bracketing needs a filesystem that does not list in creation order (ext4 lists by name hash; tmpfs lists in creation order, where the arm always exhausts its attempts and becomes a harness error). The runner's `/tmp` is ext4.
- The permission stagings rely on Linux semantics for directories without read or search permission; the harness verifies each staging on itself first, and a privileged runner makes them ineffective — a harness error (H-11), never a skip.
- T13.5-10(e)'s other-machine arm needs a namespace whose first process is the harness's own (outliving the command); (f) and (g) start the product itself as the namespace's first process.
- VIOL-READERS-CLAIM fails P-10 on every run only because a reader started first adds its entry right after locating its configuration, before a later command can load configuration and discover sources and acquire; certification therefore proves that P-10 really starts commands while readers run.
- VIOL-RACE-LISTFIRST's early listing must treat a missing lock directory (or area) as holding nothing, never as a refused read (14.25); otherwise every T13.5-13 run exits 2 and the certification proves nothing.
- VIOL-CORE-BUILDWAIT's certification requires T13.5-4 to await `build`'s exit before lifting the hold.

**Run mechanics (AGENTS.md holds the recipes; read the bullets a task names before running anything).**
- Confirm `git status` is clean on `claude/xspec-ui-apis-4df8fa` before editing. Never fetch or merge `main` (it carries a newer scaffold commit this run does not adopt). Push with `git push -u origin claude/xspec-ui-apis-4df8fa`, retrying network errors with backoff (2 s, 4 s, 8 s, 16 s); never force-push; check `git log -1` before every push. If `node_modules` is missing, `npm ci` restores it. Rebuild the product (`npm run build`) only if `dist/` is missing or stale; `src/` does not change in this phase. If the permission system refuses any action, stop and report it.
- The self project, until a self-test needs administrative access (Task 11 adds the first): `unshare --map-user=1000 --map-group=1000 -- env -u NODE_OPTIONS npm run test:self` (AGENTS.md's bullet beginning "The self project — and, once the Linux-leg tests"). From Task 11 on — and whenever a product test needing `sudo` (T13.5-9, T13.5-10(e)–(g)) is registered, since S-7 sweeps every registered test — run it as CI does: the wrapper `.github/scripts/run-without-network.sh` as the sandbox user `claude` from a copy of the checkout that user owns (the same bullet's "To reproduce CI's whole inner stage" recipe), with `/opt/node22/bin` first on `PATH` (AGENTS.md records why: Task 2). Under the plain `unshare --map-user` recipe `sudo` cannot work, so such tests fail as harness errors there — a recipe limit, not a task failure.
- One self-test file: `npx vitest run --config test/vitest.config.ts --project self <file>`; one registered product test: `-t '<ID> '` (trailing space, dots escaped) on its wrapper file in the suite project, e.g. `npx vitest run --config test/vitest.config.ts --project suite test/suite/section-13.5.test.ts -t 'T13\.5-2 '`. Redirect long runs to a log in the scratchpad and grep it for `×` and the `Tests` summary; never cap the output with `head`.
- Running product tests against a fixture executable outside the manifest (a violator before its entry lands, or a conformer used as a reference): AGENTS.md's bullet beginning "To run a selection of product tests against one fixture executable" (a temporary `test/self/zz-*.test.ts` calling `runProductTests` with a `ProductBinding`; deleted before committing).
- Stand-ins around the built product: AGENTS.md's bullet beginning "Red-checking a strengthened product test against the built product (Phase 9)". Two stand-ins recur below: an *inventory-lock stand-in* (inserts `"lock": ".xspec/lock"` after `sessions` into every inventory document the built product prints, so a test's verdict can be judged apart from the built product's missing member) and *residue stand-ins* (Task 7).
- **The CONF-CORE conformer as a 13.5 reference.** From Task 13 on, `test/fixtures/conf-core/bin.mjs` implements 13.5 in full within CONF-CORE's surface (CERTIFICATIONS.md line 11): `build`, `check`, `ids`, `show`, `query`, `coverage`, the `review` read subcommands, `impact --base` (git-less), `rename`, file-form `move`, `review create --strategy audit`, `resolve`, `split`, on workspaces of one spec group of plain `.mdx` sections. A new 13.5 test whose arm stays inside that surface should pass against it; a failure there is a harness or fixture defect to diagnose — never weaken a test to pass it. It is a diagnostic aid, not a gate: it serves no `inventory`, `version`, previews of performable operations, section-form `move`, code-marker rewriting, or 11.2 surfaces.
- Certification lines against the document: VERIFY's script `python3 -I /tmp/claude-0/-home-user-xspec/2eb23683-587c-5448-b3ea-cafe63d69bff/scratchpad/p9r2v_certcmp.py specs/CERTIFICATIONS.md <log>` parses the runner's lines from a self-project log and lists every discrepancy with the document. Read it in full before relying on it; until Task 49 it also lists the fixtures not yet implemented, which is expected. If it is gone (container restarts), rebuild it from its description.
- Run the self project, a certification run, and a suite run one at a time, never two together, and check the load first (another agent may share the machine). S-2's tower vector and S-4's tooling self-tests have failed spuriously only with harness runs overlapping; such a failure is not a task failure — rerun alone.
- The scratchpad is shared across spawns: use task-specific names (`t9j2_<N>/`); the reviewers' files (`p9i2A/`, `p9r2_T7/`, `p9rd2C/`, `p9i2D/`) and VERIFY's (`p9r2v_*`) live there. Run Python with `python3 -I`.

**Spellings.** Take every exact spelling — command lines, codes, paths, quoted requirement text — from the TEST-SPEC.md, CERTIFICATIONS.md, or SPEC.md text the task cites, or from the harness code it names, never from a review report (the hand-back channel decoded escape spellings). Build any non-ASCII character in code from its code point (`String.fromCodePoint(…)`) and any non-UTF-8 file name from bytes (`Buffer.from([…])`), never as a backslash-u escape typed into an edit or a Bash payload (the tool-parameter layer decodes those inconsistently, comment text included); verify such code byte-wise afterward.

**Conventions for changed code.**
- *Registration.* A new product test is added to its module's exported array; a new module also gets a thin suite wrapper `test/suite/<module>.test.ts` (copy `test/suite/section-13.5.test.ts`'s shape) and an import in `test/suite/registry/index.ts`; and every new test gets its H-7 entry in `test/suite/registry/traceability.ts` under that file's construction rules (its `"14"` rule included; TEST-SPEC §14's index, line 587, lists 14.24 under T13.5-7, T13.5-10, T14-9; 14.25 under T13.5-10, T13.5-12, T14-10, P-14; 14.26 under T13.5-2, T13.5-8, T13.5-9, T13.5-10). S-1 must pass. S-7's sweep (`test/self/s7-red-green-sweep.test.ts`) runs every registered test against the empty stub: each new or changed test must fail there as a diagnosed assertion, never a harness error, hang, or pass. Prefer new modules for new tests (e.g. `section-13.5-ii.ts`) over growing `section-13.5.ts` (2327 lines at bb3081a).
- *Certification manifest evolution.* The manifest changes task by task, never all at once. A task that implements a fixture adds its entry, inserted at its document position relative to the entries already present; a task that changes a violator's certified set updates that entry; a task that retires a fixture removes its entry and executable. After every task, every verification `certification.test.ts` generates from the manifest must pass (0 error, 0 hang). The manifest-mirror self-test stays red until Task 49 and the registration self-test until Tasks 32 and 45 have registered T13.5-13 and P-15 — the only accepted red; every other self-test passes after every task. Each fixture-touching task records the per-fixture certification wall times (the harness-self CI job has a 20-minute budget, `ci.yml` line 66; `RUN_TIMEOUT_MS` is 600 s per verification).
- *Product verdicts.* A task changing a test lists, in its commit message, each test whose outcome against the built product changed, with its first diagnosis; every failure must be a `HarnessAssertionError` (H-8). Never adjust a test toward the built product: it predates the 13.5 revision.
- *Liveness.* Each new discriminating arm is shown live: red against a fixture or stand-in that has the fault it targets, green against a conforming reference where one exists (a conformer, the CONF-CORE reference above, or a stand-in). The task states each check's outcome before and after.
- *Kills, voids, and budgets.* Every kill of a mutating run uses Task 8's discipline; a trial voided under T13.5-3's reuse check reruns on a fresh workspace a bounded number of times, exhaustion a harness error (H-11). Every unsynchronized arm (E-5, line 648) runs a fixed trial count, rule, and spread in CI and asserts only what holds under every timing. A test's `timeoutMs` is set from its measured duration with ample margin and the measurement is recorded in AGENTS.md's timings bullet.
- *Every task ends with:* `npm run typecheck` and `npm run format:check`; the checks it names, with every outcome before and after; the full self project (per Run mechanics) showing exactly the accepted red above and the certification outcomes the task states; a commit (`sdg(phase-9): <imperative summary> (FIX_PLAN Task N)`, ending with the two trailer lines the session requires) stating honest results; removing the finished task from this plan and adding its one-line summary to its bullet in the Order section, in the same commit (a done task leaves the plan).
- *Comments and titles.* Every doc comment, module-header note, test title, and failure message a change contradicts is corrected in the same task (e.g. `section-16-p10.ts`'s header still says P-10 lies outside every certification scope; `certification.test.ts`'s header counts six conformers and twenty-one violators).
- *AGENTS.md* gets only build/run knowledge a later spawn needs (a recipe, a count or timing a later check relies on, a corrected fact), never a task narrative.

**Standing rulings.** Two Liaison rulings stand for this run: AGENTS.md's "Known residual 14.20 location gaps" and "Known SPEC 6.5 gap, deferred to a future SPEC revision (accepted for this run by ruling)" bullets. No task addresses them, and none may be added for them.

**Deleting this plan.** Only Task 50 deletes this file, with `git rm`, once no other task remains. If the permission system refuses the deletion, stop there: leave the file in place, commit nothing further for it, and report the refusal. Never move, rename, empty, or otherwise work around a refused deletion.

**Considered and not planned (do not re-raise).**
- *From reviewer A.* H-6's exclusion in T6's existing snapshot compares is not a T6-specific task: Task 7 applies H-6 uniformly across the harness, T6's compares included, and Task 42 applies it to T6.6-3's new real-operation compares. `decodeInventoryRecordedDatum` (T6.6-5, `support.ts`) reads `recorded` alone and needs no `lock`. H-5's JSON-in-effect rule is already implemented (`helpers/invocation-grammar.ts`). The new acquisition order leaves T6.4-4/T6.5-5's usage errors and T6.6-3's `--test-hold` + `--preview` expectation unchanged (exit 2, nothing modified). Its earlier rulings, recorded in iteration 221's report, stand.
- *From reviewer B.* T12.0-7, T12.0-9, T12.0-10, and T14-4 changed only in wording or pointer rows (T12.0-9's busy row stays the exit-2 representative; T14-4 leaves the 14.24–14.26 rows to the tests it points at). T13.5-4 drives no `inventory` and no preview (CONF-CORE's staging constraint; T11.6-3 and T6.6-3 assert those answers). T13.5-2's and T13.5-8's held-baseline bracket compares stay, beside the held-state comparison. T13.5-5 is unchanged; T12.0-5's hold file inside the workspace is an argument-resolution arm; T13.5-7's extra held-point kill probe is consistent with SPEC. Compares around non-acquiring commands keep the lock path (H-6 requires it).
- *From reviewer C.* H-1, H-5, H-8 … H-11, S-1 … S-9, C-2, E-4, P-1 … P-9, P-11 … P-13 are unaffected. P-8's mutating drives check only exit partition and JSON wholeness; its one modifies-nothing compare is around `build` (lock path included, the default). P-10's H-7 entry gets no `"14"` (map rule (c): it neither stages a condition nor names one, and §14's index does not list it). P-10's read menu need not draw `build` (CONF-READERS lists `build` among the readers it covers, not as something P-10 must draw). The `sudo` the job keeps gives product runs no privilege.
- *From reviewer D.* CONF-VALID, CONF-MD, CONF-AVAIL, and CONF-ORPHAN and their violators stay compliant, unchanged. CONF-DISC's behaviour stays compliant too except for one consequence reviewer D did not note: it serves `inventory` (its in-scope T7-4 decodes the full form), so the decoder's new required `lock` member needs CONF-DISC's inventory to emit it — planned inside Task 3. CONF-CORE already conforms on the wrong-kind origin errors after the hold, `review create --coverage nope` after the hold, `resolve` of a corrupt `c` (14.21, exit 1), the BOM workspace's condition-20 finding at [0,0], the dangling-link hold path, and `review create` on an unbuilt workspace; Tasks 13 and 19 keep these. HOLDLINK's and BUILDWAIT's expected failures through hang detection are producible as diagnosed failures (S-3) — no spec defect.
- *From VERIFY.* T6.6-3's local 240 s timeout under a load average of 4.4–7.6 is a load artifact (it passes alone in 175 s, 103 s in CI); Task 42 re-budgets T6.6-3 once its new arms land, nothing earlier.
- *The planner's own.* (1) The C-1 manifest is evolved task by task (Conventions), never wholesale: a wholesale switch would make every not-yet-implemented fixture's verification fail and hide regressions; the accepted red is exactly the mirror and registration self-tests. (2) CONF-CORE's lock-directory rewrite and the in-scope tests' held compares must land together (Task 13): each breaks the other's current form (the old T13.5-1/T13.5-8 compare `.xspec/` whole while held; the new held-state comparison requires the entry the old conformer never writes). (3) The CONF-CORE reference checks are diagnostics, not gates. (4) E-6's Windows half and T11.6-1's drive-mismatch half can only be verified in CI. (5) Raising the harness-self job's `timeout-minutes`, or splitting `certification.test.ts` per conformer family so Vitest runs the families in parallel, is decided in Task 49 from measured times, not before. (6) T13.5-10 is registered in Task 22 with arms (a) and (b) and completed by Tasks 23–27; a registered test with arms still to come is an accepted intermediate state, each task stating which arms exist.

**Order.** Take the topmost task unless told otherwise; the dependencies named are hard. A task too large for one spawn may be split by inserting follow-up tasks directly after it; never drop a requirement. When a task is done, its commit removes it and adds a one-line summary to its bullet here.
- *Foundations (no certification change).*
  - Task 1 (D-1, V): C-1 count pins 9/30. Independent. Done: `EXPECTED_CONFORMERS = 9`, `EXPECTED_VIOLATORS = 30`, title to match; the count test passes, the mirror and registration tests fail byte-identically to bb3081a; self project 2 failed / 4313 passed (4315, 28 files, 122.30 s), certification lines 154 PASS / 38 FAIL, 0 error, 0 hang.
  - Task 2 (V1): AGENTS.md — Node 22 on `PATH` in the `claude` wrapper recipe. Independent. Done: the recipe's `bash -c` string begins `export PATH=/opt/node22/bin:$PATH` (`node --version` through it prints v22.22.2; without the export v20.20.2, `/usr/local/bin/node`); the bullet says the whole self project runs through it once a test needs administrative access, and that its log is Vitest's colored default reporter (sudo drops `CLAUDECODE`/`AI_AGENT`), to be stripped before grepping; self project 2 failed / 4313 passed (4315, 28 files) both under `unshare --map-user` (127.48 s) and through the amended recipe (123.64 s), certification lines 154 PASS / 38 FAIL, 0 error, 0 hang.
  - Task 3 (A-G4, B-G1, C-G6b): inventory form's `lock` member; CONF-DISC emits it. Independent. Done: `decodeInventoryDocument` requires `lock` as a 12.7 path value in its 12.7 position (`InventoryDocument.lock`; the comments and T11.6-4's title count eleven members); S-5's good document carries `"lock": ".xspec/lock"` and three new vectors (absent, `null`, the number 7) are rejected — red against bb3081a's decoder (the good document at `$.lock`, the absent vector accepted) and under one-point breaks of the new one (no path-value decode: the number vector; `null` admitted: the `null` vector); CONF-DISC emits `lock` (with the decoder change alone T7-4 fails at `$.lock` against all four of its fixtures — the conformer, SYMLINK, and DERIVED verifications red, DIALECT passing only vacuously; with both, all four pass: 2.37 s, 2.61 s, 2.54 s, 1.38 s); T11.6-4's whole-document expectation and 14.23 projection carry `lock` (forced by the type; live under the stand-in's wrong-value modes); against the built product T6.1-1, T7-2, T7-4, T10.1-6, T11.6-3, T11.6-4, T14-10 now fail diagnosed at `$.lock`, and all seven pass through the inventory-lock stand-in (AGENTS.md, the bullet after the stand-in recipe); self project 2 failed / 4313 passed (4315, 28 files, 141.89 s), certification lines 154 PASS / 38 FAIL, 0 error, 0 hang.
  - Task 4 (B-G2, C-G6a): stable code `workspace-busy` (14.26). Independent. Done: `CONDITION_CODE_TOKENS` ends with `workspace-busy` (14.26) and `USAGE_ERROR_CONDITION_CODE_TOKENS` holds it beside 14.24 and 14.25 (an error document's `code`, `condition` 14.26; rejected inside a findings array by the usage-error rule; ranked after 14.25, before the refusal reasons, the code-less rank following automatically); S-5 gains an error-document vector (`path` `.xspec/lock`), a findings-array vector, comparator vectors, and one test (now 4316) pinning that each of 14.24 to 14.26 decodes as the error document's code and is rejected in a findings array as a usage error, never as an unknown token: red against bb3081a's model (3 tests: the error document at `$.error.code`, the new test, the comparator's harness-defect throw) and under the one-point break listing the token without the usage-error rule (2 tests: the findings report's new bad vector accepted, the new test); comments corrected (model.ts, forms.ts's messages, section-14.ts's count of 26 condition tokens, the fixture grammar's coded error documents); against the built product T14-4, T14-6, T12.7-3 pass before and after; self project 2 failed / 4314 passed (4316, 28 files, 140.62 s), certification lines 154 PASS / 38 FAIL, 0 error, 0 hang.
  - Task 5 (C-G7, B-G4, A-G3): lock-path predicate and H-4 grant-and-restore. Independent. Done: `test/helpers/lock-path.ts` exports `LOCK_PATH`, `isLockPathBytes`/`isLockPathKey` (exactly `.xspec/lock` and everything under it), `EXCLUDE_LOCK_PATH` and `excludingLockPath(options)` (H-6's exclusion, alone or beside a caller's own), `withOwnerGrant(absPath, "read" | "write", operation)` (on a permission refusal of a plain file whose mode lacks the owner's bit: adds that bit alone, retries, restores the exact prior mode at once even when the retry throws, grants on one path serialized; nothing granted to a directory, to a mode already holding the bit, or where the mode cannot be changed), and `readLockPathFile`, `writeLockPathFile` (in place: never creating, replacing, or following a link) and `copyLockPathFile` (exact bytes and mode, never replacing an occupant), each refusing any path but the lock path's; the snapshot walk reads lock-path plain files through the grant; new `test/self/lock-path.test.ts` (8 tests, the 6 Linux stagings verified first, so failing as root by design): red with the walk's grant removed (1 test, `EACCES` at `.xspec/lock/d/f`), with the restore skipped (4 tests: modes 0o400/0o200 where 0o000 is due), and with an over-broad predicate (5 tests); T13.5-1 and T13.4-5 still pass against the built product; self project 2 failed / 4322 passed (4324, 29 files, 122.34 s), certification lines 154 PASS / 38 FAIL, 0 error, 0 hang.
  - Task 6 (B-G6, B-G27 part): graph data never includes the lock path. After 5. Done: `isGraphDataKey` (`test/helpers/adapters/record-staging.ts`) excludes `.xspec/lock` and everything under it through `isLockPathKey` and is every graph-data classifier's one predicate — `section-13.4.ts`'s duplicate removed; `write-refusal-staging.ts`'s `isGraphDataPath` is the area itself or `isGraphDataKey` (`isAreaPath` unchanged: the lock path lies in the area, outside every derived scope); `section-13.3.ts`'s `deleteGraphData` judges each `.xspec/` name by it, sparing the lock path whatever occupies it; one exported `collectGraphDataFiles(rootAbs, onOther?)` replaces the record-staging/`section-14-ii.ts` pair (the corruption refuses a non-plain occupant through `onOther`, T14-10(f)'s staging skips it, as before); comments, failure messages, and T13.3-2's title name the lock path; S-5 gains 3 tests (now 109: the predicate's vectors, `.xspec/lock` and `.xspec/lock/x` among the non-graph data; the corruption sparing a lock directory's entries and a plain file or a symbolic link at the lock path; the collector) — red against bb3081a's helper (3 failed / 106 passed: at `.xspec/lock`, the lock entries garbled, `collectGraphDataFiles is not a function`) and with the predicate's lock line dropped (the same 3), green after; a deleted scratch probe showed bb3081a's `deleteGraphData` (deleting a lock directory and a plain file at the lock path) and `isGraphDataPath` (true at `.xspec/lock`) red, and both green after; against the built product T6.6-4, T6.6-5, T6.6-6, T11.6-4, T12.2-2, T12.2-3, T12.2-4, T13.3-1, T13.3-2, T13.3-3, T13.3-4, T13.4-2, T13.4-3, T13.4-4, T13.4-9, T13.4-10, T13.5-7, T14-4, T14-6, T14-9, T14-10 keep their outcomes and first diagnoses (19 pass; T11.6-4 and T14-10 fail diagnosed at `$.lock`, as since Task 3); self project 2 failed / 4325 passed (4327, 29 files, 132.27 s), certification lines 154 PASS / 38 FAIL, 0 error, 0 hang, all 192 outcomes as at Task 5.
  - Task 7 (B-G6, C-G7a, B-G18 part): H-6's exclusion across the harness's compares. After 5.
  - Task 8 (B-G5, C-G1a): kill discipline and voidable trials (Linux). Independent.
  - Task 9 (C-G3 part, B-G7 part, D-14g): lock-path leftover staging and dead entries. After 5, 8.
  - Task 10 (B-G3, D-14g): the held-state comparison and lock-state assertions. After 5, 9.
  - Task 11 (B-G7, C-G5): second user, bind mount, launcher. After 8.
  - Task 12 (B-G7, C-G5): fresh process-identifier namespaces. After 11.
- *CONF-CORE and its in-scope tests (certification-coupled; in this order).*
  - Task 13 (D-2, D-4, B-G3 callers): CONF-CORE's exclusivity in `.xspec/lock`; NOLOCK and STALELOCK re-based; T13.5-1's and T13.5-8's held compares become the held-state comparison. After 10.
  - Task 14 (B-G13, D-8, D-14a): T13.5-1; VIOL-CORE-HOLDLINK. After 13.
  - Task 15 (B-G14, D-14b, C-G8 part): T13.5-2; EARLYWRITE gains T13.5-2. After 4, 13.
  - Task 16 (B-G15, D-7, D-14c): T13.5-3; VIOL-CORE-EARLYRELEASE. After 8, 13.
  - Task 17 (B-G16 part, D-9, D-5 part, D-14d): T13.5-4's reads; VIOL-CORE-READERENTRY; CHATTYREADS gains T13.5-4. After 13.
  - Task 18 (B-G16 part, D-10, D-14d): T13.5-4's `build` during a hold; VIOL-CORE-BUILDWAIT. After 17.
  - Task 19 (D-3, D-5 part): CONF-CORE's configuration, discovery, and section-form surface. After 13.
  - Task 20 (B-G19 part, D-14e): T13.5-8's acquisition-first arms; EARLYWRITE gains T13.5-8. After 4, 19.
  - Task 21 (B-G19 part, D-6): T13.5-8's acquisition-after and seam-ordering arms; VIOL-CORE-LATEHOLD; VIOL-CORE-LATELOCK retired. After 20.
- *The other 13.5 and 13.4 tests.*
  - Task 22 (B-G21 part): T13.5-10 registered with (a) and (b). After 9, 10, 13.
  - Task 23 (B-G21 part): T13.5-10(c). After 22.
  - Task 24 (B-G21 part): T13.5-10(d). After 22.
  - Task 25 (B-G21 part): T13.5-10(e) on one machine, and the lock directory deleted during a hold. After 22.
  - Task 26 (B-G21 part): T13.5-10(e) another machine, (f), (g). After 12, 22.
  - Task 27 (B-G21 part): T13.5-10(h). After 22.
  - Task 28 (B-G12): T13.4-12. After 3, 9, 10.
  - Task 29 (B-G22): T13.5-11. After 10, 13.
  - Task 30 (B-G23): T13.5-12. After 10, 13, 15, 18 (it reuses their during-hold helpers).
  - Task 31 (B-G20): T13.5-9. After 10, 11, 13.
  - Task 32 (B-G24, D-11, D-14f): T13.5-13; CONF-RACE and VIOL-RACE-LISTFIRST. After 13.
  - Task 33 (B-G17): T13.5-6. After 10.
  - Task 34 (B-G18): T13.5-7. After 7, 8, 10, 16.
- *Cross-section tests.*
  - Task 35 (B-G8): T10.1-6's acquisition arm. After 3, 4.
  - Task 36 (B-G10): T11.6-3's lock-path arms. After 3, 9, 10.
  - Task 37 (B-G9, A-G1(c)): T11.6-1's member invariance, both legs. After 3.
  - Task 38 (B-G11): T12.7-3's busy error document. After 4.
  - Task 39 (B-G25): T14-6's 14.26 arm and title. After 4.
  - Task 40 (B-G26): T14-9's reporters arm at the seam, acquisition-write arms. After 7, 10, 24.
  - Task 41 (B-G27): T14-10's arm (i). After 3, 24, 30.
  - Task 42 (A-G2, A-G3): T6.6-3's acquisition-outcome arms. After 9, 10, 15, 18, 24.
  - Task 43 (A-G1(a), (b)): T1.5-1's 11.2 documents and file paths. Independent.
- *Properties.*
  - Task 44 (C-G1, D-12, D-14f): P-10; CONF-READERS and VIOL-READERS-CLAIM. After 8, 10, 13, 16.
  - Task 45 (C-G3, D-13, D-14f): P-15; CONF-LEFTOVER and its three violators. After 9, 13.
  - Task 46 (C-G2 part): P-14 registered — generators and concurrent reads. Independent of the 13.5 tasks.
  - Task 47 (C-G2 part): P-14's `build`, `check`, and mutating commands. After 46.
- *E-6, the gate, and the finish.*
  - Task 48 (C-G4): E-6's exclusion probe on both legs. After 7, 8.
  - Task 49 (D-1, D-14 closing): the C-1 gate whole; certification budget. After every fixture task (13–21, 32, 44, 45).
  - Task 50: confirm locally and in CI; record timings; delete this plan. After every task above.

## Tasks

### Task 7 — H-6's exclusion applied across the harness's compares (B-G6, C-G7a, B-G18 part)

**Requirement.** H-6 (TEST-SPEC.md line 24) in full: every comparison of written files across runs or workspaces — determinism and twin comparisons alike — excludes `.xspec/lock` and everything under it; so does every comparison of a mutating command's run against its own pre-invocation state; the exclusion reaches no further — a comparison around commands that acquire nothing (`build`, `check`, `version`, a preview, every read command, the `review` subcommands but `create`/`resolve`/`split`) includes the lock path. T13.5-11(a) (line 581) names T6.4-3, T6.5-4, T10.7-1, T10.7-10, T10.7-9, and T10.1-4's modifies-nothing compares among those excluding it. CERTIFICATIONS.md VIOL-CORE-EARLYREFRESH's note (line 37): an exclusion reaching the area whole is a defect.

**State at bb3081a.** `test/helpers/snapshot.ts` (`assertDirectoriesEqual` line 162, `assertLeavesUnchanged` line 180, `assertSnapshotsEqual` line 141, `diffSnapshots` line 96) and `test/helpers/determinism.ts` (`assertRunTwiceDeterministic` line 62, `assertAcrossDirectoriesDeterministic` line 105, `assertRunOutcomesEqual` line 161) compare the lock path like any other. Call sites: 136 `assertLeavesUnchanged` in 28 registry modules, 54 `assertSnapshotsEqual`, 14 `diffSnapshots`, 11 `assertDirectoriesEqual`, 10 determinism calls. `write-refusal-staging.ts`'s `assertPinnedState` (about lines 1340–1352) — T13.5-7(b)'s false failure: a conforming product leaves an empty `.xspec/lock` there (release's deletion refused by the read-only `.xspec`), which the whole-workspace compare rejects.

**Change.**
- Cross-run and cross-workspace compares (determinism, twins, `assertDirectoriesEqual` between two roots, and every twin snapshot pair) always exclude the lock path.
- Same-workspace before/after compares exclude it exactly when an acquiring invocation — 12.0's grammar: `rename` or `move` without `--preview`, `review create`/`resolve`/`split` — ran in that workspace between the two snapshots, and include it otherwise. A suggested design (not mandated): classify automatically — the driver records each invocation's workspace (`noteProductInvocation`, `test/helpers/product-invocations.ts`) and could record whether it acquires (`test/helpers/invocation-grammar.ts` reads command words and flags), letting `assertLeavesUnchanged` decide without touching its callers; manual snapshot pairs get an explicit choice at each site.
- Never exclude more than the lock path.
- Tests that will assert the lock path's state after a run (T13.5-11 and others) do so explicitly in their own tasks; this task changes no assertion about it.

**Verify.**
- Two residue stand-ins around the built product (Run mechanics): (i) after every acquiring invocation that exits while `.xspec` is a directory, create `.xspec/lock/zz-standin/f` — run the suite project (or, if time-bound, every module this task touched plus T13.4-5, T10.4-5, and the T6.4/T6.5/T10.7/T10.1 modules) and show each test's outcome equals its outcome against the bare built product; (ii) the same residue after a non-acquiring invocation (`check`, `ids`) — T13.4-5 and at least one other read-only compare must now fail diagnosed, showing inclusion kept. Record both result sets, with a comparison script in the scratchpad.
- Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed. If the sweep proves too large for one spawn, split it by module groups into follow-up tasks inserted right after this one.

### Task 8 — T13.5-3's kill discipline and voidable trials, as shared machinery (B-G5, C-G1a)

**Requirement.** T13.5-3 (TEST-SPEC.md line 573), its exit-collection discipline: start the held command in a process group of its own; kill the whole group with SIGKILL; collect the exit of the process started; confirm no process of the group remains listed in the process list before the next step. Its reuse check: should a later command be refused `workspace-busy`, check the process list for the killed group's identifiers — any listed again voids the trial, rerun on a fresh workspace a bounded number of times, exhaustion a harness error (H-11, line 29); a refusal with none listed fails the test. E-5 (line 648): a voided trial is no failure. Users: T11.6-3, T13.4-12, T13.5-3, T13.5-7's kill arm (no reuse check), T13.5-10, T13.5-11(d), P-10, E-6.

**State at bb3081a.** `test/helpers/subprocess.ts`: `startProduct` (line 354) spawns without `detached`; `RunningProduct.kill` (line 602) signals the direct child only; nothing in `test/` reads a process list.

**Change.**
- A run option starting the product as the leader of a new process group (POSIX `detached: true`); default behaviour unchanged.
- `RunningProduct` gains a group kill: record the group's members (every process whose process-group ID is the leader's — `/proc/<pid>/stat`, field 5), SIGKILL the group, collect the leader's exit (the run settles with signal `SIGKILL`, not a timeout), then poll the process list until no recorded member is listed (zombies count as listed), bounded — exhaustion a harness error. It returns the killed identifiers.
- A Linux process-list reader (numeric `/proc` entries) and a check whether any of a set of identifiers is listed again.
- A voidable-trial runner: a trial may declare itself void (with its reason); it is rerun from fresh state up to a bounded count; exhaustion is a harness error (a `HarnessStagingError`-like class, never a `HarnessAssertionError`) naming the reasons; any other failure propagates as is.
- A helper applying the reuse check to a later command's `workspace-busy` refusal (void if a killed identifier is listed again, diagnosed failure otherwise).
- Processes started through `sudo` are Tasks 11–12's concern (they may be root-owned); this task covers the harness's own identity. The Windows termination is Task 48's.

**Verify.** Self-tests (in `test/self/s3-subprocess-driver.test.ts` or a new file) with a stand-in Node script that spawns a grandchild in its group and sleeps: after the group kill neither is listed and the leader's exit carries `SIGKILL`; the reuse check reports a listed identifier and not a reaped one; the voidable runner passes after one void, and exhausts into the harness-error class. Red check: with the poll removed, the grandchild is still listed right after the kill (show it). Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 9 — Lock-path leftover staging and dead entries, as shared machinery (C-G3 part, B-G7 part, D-14g)

**Requirement.** The kinds the tests stage at or under the lock path: T13.5-10(b) and (c) (TEST-SPEC.md line 580), T13.4-12 (line 565), T11.6-3 (line 472), T6.6-3(c) (line 309), P-15 (line 624: varied depth and breadth; names beginning with `.` and, on Linux, names that are not valid UTF-8; plain files with every permission removed; symbolic links to files and to directories outside the workspace, and dangling ones; FIFOs; no plain file at the lock directory's top level; every generated directory listable, searchable, writable). CERTIFICATIONS.md: CONF-LEFTOVER's staging constraint (line 136: each link to a directory targets a directory holding at least one plain file, all listable, searchable, writable) and justification (line 140: S-2 does not round-trip file names, so non-UTF-8 names must be staged by bytes); the Exclusions entry (line 306): T13.5-10(b)'s link staging rides VIOL-LEFTOVER-FOLLOWLINK's certification of P-15 only insofar as it shares this machinery. "No FIFO opened" (T13.5-10, P-15).

**State at bb3081a.** No FIFO creation exists anywhere in `test/`; the workspace builder (`test/helpers/workspace.ts`) stages byte paths, files, and symlinks but no FIFOs or lock-path trees.

**Change.** A module (e.g. `test/helpers/lock-staging.ts`):
- stages a declared tree at `.xspec/lock` (or at the area's own path, for obstructions): directories at any depth, plain files with given bytes and modes (000 included), symbolic links (to a directory outside the workspace holding a file, to an outside file, dangling with its target in a writable outside directory), FIFOs (`mkfifo`; Node has no API), names as raw bytes (leading `.`, invalid UTF-8);
- records what it staged — a byte snapshot of the tree (kinds, names, contents via Task 5's grant, link targets) and of every outside link target — and offers the checks the tests need: tree byte-untouched; outside targets byte-identical; FIFO still a FIFO;
- produces a dead run's entry: on a twin workspace, start a held `rename` in its own process group, await its hold file, kill it under Task 8's discipline, and return the one plain-file entry under `.xspec/lock` (name bytes and content, read with Task 5's grant) for copying in elsewhere.
- Promptness is how "no FIFO opened" is observed (a reader opening a FIFO with no writer blocks); a test may add more, but this module never opens a staged FIFO itself.

**Verify.** Self-tests: a declared tree with every kind, a `.`-name, and a non-UTF-8 name round-trips byte-exactly (lstat kinds, modes, link targets, contents); an outside target's change is detected; a FIFO lstat-checks as a FIFO. The dead-entry helper is exercised in Task 13 against the CONF-CORE conformer (it needs a product that writes entries); here, show only that it fails diagnosed against the built product (which writes none). Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 10 — The held-state comparison and the lock-state assertions, as shared machinery (B-G3, D-14g)

**Requirement.** TEST-SPEC.md §13.5's preamble (line 569): the held-state comparison — every workspace path but `.xspec/lock` and everything under it (and `.xspec` itself where the invocation found none, acquisition then creating it) byte-identical to its pre-invocation state as the harness's own stagings during the hold and the writes of another run completing meanwhile have changed it; and `.xspec/lock` a directory holding, besides whatever the harness staged there, exactly one entry, a plain file, per held run whose entry stands. H-4 (line 22): what may be observed of entries (kind, count, one entry's byte-identity across a span, name inequality across runs). H-6 (line 24): commands that acquire nothing leave the lock path byte-identical, nothing added. CERTIFICATIONS.md: CONF-CORE's justification (line 15: both halves; the byte half excludes the lock path alone, never the area whole), VIOL-CORE-READERENTRY's note (line 95) and the Exclusions entry (line 306): one comparison machinery for every held inspection and every lock-path inclusion (T13.4-12, T11.6-3's held arm, T6.6-3(c), T13.5-4, T13.5-9 … T13.5-12).

**Change.** A module (e.g. `test/helpers/lock-state.ts`), every failure a diagnosed `HarnessAssertionError` rendering byte names readably:
- the held-state comparison: given the workspace root, the expected baseline snapshot (the caller's pre-invocation snapshot, retaken or adjusted after its own stagings or another run's completion), whether `.xspec` existed before, what the harness staged under `.xspec/lock`, and the number of held runs whose entries stand — check the byte half, then the count half (entries are plain files; anything else there is no entry); return the entries (name bytes, content read under Task 5's grant) for later identity checks;
- entry identity across a span (name and content), "the lock directory's only entry", `.xspec/lock` absent, `.xspec/lock` holding exactly a given tree;
- the inclusion check for commands that acquire nothing (whatever occupied the lock path before occupies it after, byte-identical, nothing added).

**Verify.** Self-tests over synthetic trees: an entry present, absent, or doubled; a directory, symlink, or FIFO in the lock directory not counted as an entry; `.xspec` created by acquisition accepted only when absent before; a change to `.xspec/graph.json` caught (the byte half never excludes the area); a staged occupant changed caught; a mode-000 entry read through the grant. Red-check each vector against a deliberately weakened copy (scratch only). Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 11 — Machine-wide stagings I: the second user, the second mount, and their launcher (B-G7, C-G5)

**Requirement.** H-2 (TEST-SPEC.md line 20: for 13.5's reach and identifier stagings alone, the harness controls the product run's user identity and process-identifier namespace); E-1 (line 644: made with the administrative access GitHub's hosted Linux runners grant the job, outside every product invocation, which stays unprivileged; verified on the harness itself; a runner withholding that access fails them as a harness error, never a skip); E-3 (line 646: each mount and namespace its test's own, at a path unique to the suite instance, removed by it; the second user made idempotently under a fixed name and never removed); T13.5-9 (line 579), its staging discipline and verifications: an unprivileged second identity distinct from the harness's, sharing a group with it, the workspace's directories and files group-readable and group-writable, its directories group-searchable; a bind mount of the root at a second path; verified before use — a file created through either path appears through the other, the two paths distinct mount points; the second identity's uid differs, it reads every file and lists every directory in the workspace, creates and removes a file in the root and in `.xspec`; each identity's process list lists the other's processes; an ineffective staging a harness error (H-11).

**Facts.** See the Preamble's machine-wide facts (`sudo` resets the environment and the resource limits; root-owned `sudo` processes; mounts private to CI's wrapper namespace; locally a mount lands in the sandbox's namespace). `mkdtemp` directories are mode 0700, so the second user cannot reach a workspace until the directories above its root are made traversable by the shared group.

**Change.** A module (e.g. `test/helpers/machine-staging.ts`):
- an administrative-access check (`sudo -n true`), failing as a harness error (never a skip);
- the second user: one fixed name, created idempotently (`sudo -n useradd …`, a member of the harness user's primary group; tolerate a concurrent instance creating it first), never removed;
- workspace group staging: group read/write on files, read/write/search on directories, group traversal on every directory above the root — undone by the test;
- the bind mount: at a path unique to the suite instance, made and removed with `sudo -n mount --bind` / `umount` (always removed in a `finally`), verified through `/proc/self/mountinfo` (a bind mount shares `st_dev`, so device numbers prove nothing);
- a launcher starting a product run as the second user with controlled working directory, argv, an explicit environment, and the harness's resource limits restored; its exit code, stdout, and stderr captured through the same machinery `startProduct` uses (so T12.7-1's walk and T6.5-22(a)'s check still apply); a group kill that works through it (the `sudo` process may be root-owned);
- the verifications T13.5-9 lists, each failing as a harness error.

Update AGENTS.md: the machine-staging recipe, and that the self project now runs only through the `claude` wrapper recipe (Task 2's note).

**Verify.** Self-tests (they need `sudo`, so run the self project per Run mechanics from now on): user creation is idempotent (twice in a row, and concurrently); the launcher's environment is exactly the one given (no `SUDO_*` or other injected variables); limits restored; the mount verification passes on a real bind mount and fails, as a harness error, on a plain directory; a second-user process and a harness process see each other in their process lists; a launched run's group kill leaves nothing listed. Show the harness-error path once by running a verification under the plain `unshare --map-user` recipe. Self project, through the wrapper: the accepted red only.

**Done when.** The checks hold, AGENTS.md is updated, and the commit is pushed.

### Task 12 — Machine-wide stagings II: fresh process-identifier namespaces (B-G7, C-G5)

**Requirement.** T13.5-10 (TEST-SPEC.md line 580): (e)'s other-machine arm — a fresh process-identifier namespace with its own process list whose first process is the harness's own, outliving the command; the harness verifies through that process, while the holder is held and before the command starts, that the namespace's process list lists no identifier the holder's processes bear; should the command be refused, it checks through that process whether the namespace has allocated an identifier as large as the least the holder's processes bear (void and rerun in a fresh namespace, bounded; exhaustion a harness error); (f) — product runs started as the first process of fresh namespaces, the harness verifying while each run is held that their processes bear the same in-namespace identifiers (mismatch voids, bounded); (g) — the harness verifies, while held and again before each later command, that every in-namespace identifier the held run's processes bear or bore is listed in its own process list (mismatch an ineffective staging). T13.5-3 (line 573): SIGKILL reaches a namespace's first process from outside. H-2, E-1, E-3 as in Task 11: the run drops back to the harness's uid, gid, and supplementary groups with no capabilities.

**Change.** Extend Task 11's module:
- launcher A: the product as the first process of a fresh namespace (e.g. `sudo -n unshare --pid --fork --mount-proc -- setpriv --reuid=<uid> --regid=<gid> --groups=<groups> --inh-caps=-all --bounding-set=-all -- env -i <explicit env> <node> <bin> …`);
- launcher B: a harness-owned first process (a minimal long-lived program) in a fresh namespace, outliving the commands entered into it (e.g. `sudo -n nsenter --target <pid> --pid --mount -- setpriv … -- …`);
- observations: a run's in-namespace identifiers (`/proc/<pid>/status`'s `NSpid` line), a namespace's process list and its highest allocated identifier through its first process, the harness's own process list;
- group kills through both launchers (root-owned members may need `sudo -n kill`), each confirmed gone (Task 8's discipline);
- every verification above, failing as a harness error, with the void/rerun rules left to the arms (Task 26).

**Verify.** Self-tests through the wrapper: under launcher A the product stand-in sees itself as identifier 1 and runs with `CapEff` 0 and the harness's uid/gid/groups; two launcher-A runs of the same stand-in bear the same in-namespace identifiers; a launcher-B namespace lists only its own processes; a group kill empties the namespace; the harness-error path on a missing `sudo`. Self project, through the wrapper: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 13 — CONF-CORE keeps exclusivity in `.xspec/lock`; NOLOCK and STALELOCK re-based; T13.5-1's and T13.5-8's held compares become the held-state comparison (D-2, D-4, B-G3 callers)

**Why one task.** The old in-scope tests compare `.xspec/` whole while a run is held, so a conformer writing its entry there fails them; the held-state comparison requires that entry, so the old conformer fails it. Both change together, and the violators whose switches touch acquisition (NOLOCK, STALELOCK) are re-based in the same commit so every manifest verification stays green.

**Requirement.**
- CERTIFICATIONS.md CONF-CORE Scope (line 11), the sentence beginning "Exclusivity per 13.5 in full" through "a symbolic link included"; its Contracts (same line, near the end). SPEC 13.5 (SPEC.md lines 785, 787, 789), 13.4 (line 769), 14.24–14.26 (around line 828), 12.7's error document. In short: obstruction rules (the area's path anything but a directory, a symlink included → `write-failure` concerning `.xspec`; the lock path a symlink or any occupant but a directory or plain file → `write-failure` concerning `.xspec/lock`; both remove nothing; a plain file at the lock path is a leftover, removed); the entry — a plain file whose name records the acquiring process's identifier and distinguishes the run (two runs can share an identifier, T13.5-10(f), so the name needs more than the identifier); the lock directory and the area's directory brought into existence where absent; then a listing: another plain file whose name records an identifier the process list shows (not the acquirer's own) refuses with `workspace-busy` concerning `.xspec/lock`, exit 2, nothing removed; otherwise every leftover is removed — a directory with all it holds, a symlink itself (never its target), a FIFO unopened, no file content read, an entry recording the acquirer's own identifier included; a refused read or write → `read-failure`/`write-failure` concerning `.xspec/lock` (`.xspec` for the area directory's creation); the hold file immediately after acquisition; release on every normal end — completion, refusal, failure, acquisition's failures included — deleting the entry, then the emptied lock directory, then an emptied area directory this acquisition created, refused deletions changing nothing; release reads nothing (no listing).
- CONF-RACE's scope (line 106) and CONF-LEFTOVER's scope (line 136), which share this conformer's behaviour: tolerate concurrent `mkdir` races; only the run that created the area directory deletes it; remove leftovers by their listed bytes whatever their first byte or UTF-8 validity (Buffer-encoded `readdir`/`lstat`/`unlink`/`rmdir`), at every depth, mode-000 files included, a removal finding nothing counted as done.
- VIOL-CORE-NOLOCK (lines 17–22): acquisition adds its entry and lists, leaves every live entry unaltered, removes the other leftovers, acquires; everything else unchanged. VIOL-CORE-STALELOCK (lines 39–44): any entry (a plain file named in the conformer's entry form) refuses by its presence, whatever identifier it records; other leftovers still removed; release unchanged.
- TEST-SPEC §13.5's held-state comparison (line 569) for the four test sites below.

**State at bb3081a.** `test/fixtures/conf-core/product.mjs`: `pidAlive` (line 1413), `acquireExclusivity` (line 1429: a PID file at `os.tmpdir()/xspec-conf-core-<hash>.lock`, nothing inside the workspace), `holdAtSeam` (1488), `runMutating` (2659), `CODE_TOKENS` (1996: no `write-failure`, `read-failure`, `workspace-busy`). Switches: `noMutualExclusion` (`bin-nolock.mjs`, skips acquisition), `staleLockBlocks` (`bin-stalelock.mjs`, refuses while the temp file exists), `writesBeforeHold`, `refreshBeforeExclusivity`, `partialDerivedWrites`, `chattyReads`, `persistReadInvalidation`, `lateAcquisition`. Reviewer D's hand-driven observations (`p9j_c2_report_D.txt`, gap 2) list every current divergence. Test sites in `test/suite/registry/section-13.5.ts`: T13.5-1's stale-workspace arm (`whileHeld` vs `before`, about line 509, with `excludeAllButGraphData` at line 418) and basic held arm (about line 647); T13.5-8's `refusedSeamArm` (about line 1958); T13.5-8's gate-arm compare against `heldBaseline`, a snapshot taken while held, which holds the entry release deletes (about line 2151).

**Change.**
- Fixture: implement the above in `product.mjs` at the current acquisition point (after configuration load and discovery; Task 19 adds the second discovery and moves the checks); add the three codes; re-base `noMutualExclusion` and `staleLockBlocks` on the new acquisition as their entries state; keep every other switch composing (in particular `lateAcquisition` still acquires before its hold).
- Tests: replace the four compares with Task 10's held-state comparison (the stale arm's byte half excludes the lock path alone — graph data is what it must see; `excludeAllButGraphData` goes); the gate-arm compare becomes a comparison against the pre-invocation state under H-6's exclusion (Task 7). No other test change.

**Verify.**
- Hand probes (a scratch script driving the conformer as reviewer D did): each observation in gap 2 now conforms — `.xspec/lock` holds one plain file while a `rename --test-hold` holds, and still after a SIGKILL; a second `rename --json` exits 2 with `workspace-busy` at `.xspec/lock`; leftovers (a plain file at the lock path; a tree with a dead identifier's file) are removed by a successful `rename`; a symlink at `.xspec/lock` → `write-failure`, link and target untouched; `.xspec` a plain file or a symlink → `write-failure` at `.xspec`, nothing written; a refused `rename` on a workspace without `.xspec` leaves none. Record before/after.
- Exercise Task 9's dead-entry helper against the conformer (it returns one plain-file entry).
- Certification: all 27 manifest verifications pass, 154 PASS / 38 FAIL / 0 error / 0 hang, each outcome as the manifest states. VIOL-CORE-LATELOCK must still fail exactly T13.5-8; if it does not, retire it here (remove `bin-latelock.mjs` and its manifest entry — the document dropped it; Task 21 then only adds LATEHOLD) and say so.
- Against the built product (temporary-folder lock): T13.5-1 and T13.5-8 now fail diagnosed on the count half (no entry); record.
- Self project: the accepted red only.

**Done when.** The checks hold, the commit message records the probes and certification lines, and the commit is pushed.

### Task 14 — T13.5-1 to TEST-SPEC; VIOL-CORE-HOLDLINK (B-G13, D-8, D-14a)

**Requirement.** T13.5-1 (TEST-SPEC.md line 571) in full. CERTIFICATIONS.md: VIOL-CORE-HOLDLINK (lines 82–87); CONF-CORE's justification on the dangling-link arm (line 15); VIOL-CORE-CHATTYREADS's staging constraint on T13.5-1 (line 57: the held run and its twin drive the same command sequence, no `build` or read between the mutating command's start and the final compare); D-14(a): the byte half excludes exactly `.xspec/lock` (plus `.xspec` where acquisition created it); the dangling link's target lies in a writable directory outside the workspace; a hang-guard expiry produces a diagnosed failure.

**State (after Task 13).** `T13_5_1` in `section-13.5.ts` (from line 602); its occupied-hold-path arms (from about line 824) stage a file, a directory, and a dangling link — not "a symbolic link to a file"; no arm asserts `.xspec/lock` absent afterwards; the seam-neutrality twin compare predates H-6's exclusion (Task 7 may already have switched it — confirm).

**Change.**
- Add the symbolic-link-to-a-file occupant; every occupied-hold-path arm: exit 2, nothing modified, the occupant unchanged, `.xspec/lock` absent afterwards; the dangling link's target in a writable directory outside the workspace, nothing there afterwards.
- Run each occupied-hold-path command through a bounded run that turns a hang into a diagnosed failure within the test's budget (`runBounded`, line 327 — the certification runner counts the driver's own timeout as an `error`, which C-1 rejects).
- After each held arm completes (basic and stale), `.xspec/lock` absent (Task 10's assertion); the seam-neutrality compare excludes only the lock path.
- Title updated to the new contract.
- Fixture `test/fixtures/conf-core/bin-holdlink.mjs` with a switch in `product.mjs`: hold-file creation judges the hold path through a symlink (a dangling link reads as empty: the hold file is created at the link's target and the run holds there while that path, judged through the link, holds something; a link to an existing file or directory reads as occupied — the conformer's usage error).
- Manifest: VIOL-CORE-HOLDLINK certifying `T13.5-1`, inserted at its document position.

**Verify.** Certification: the conformer passes all nine; HOLDLINK fails exactly T13.5-1, diagnosed (0 error, 0 hang); every other verification unchanged (EARLYWRITE and EARLYREFRESH still fail T13.5-1 and only their sets). Red check: with the bounded run replaced by the plain driver, HOLDLINK's T13.5-1 outcome becomes `error` (show once, then restore). Against the built product, T13.5-1 fails diagnosed. Record the CORE verifications' wall times. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 15 — T13.5-2 to TEST-SPEC; VIOL-CORE-EARLYWRITE gains T13.5-2 (B-G14, D-14b, C-G8 part)

**Requirement.** T13.5-2 (TEST-SPEC.md line 572) in full. CERTIFICATIONS.md: VIOL-CORE-EARLYWRITE (lines 24–29: it fails T13.5-2 through the held-state comparison made while command 1 holds); VIOL-CORE-NOLOCK's staging constraint (line 22: the excluded commands carry no `--test-hold`); CONF-CORE's staging constraints (line 11: the modifies-nothing compare brackets the excluded command alone, its snapshot taken while command 1 is already held; no `build` or read runs while a lock directory stands; every mutating command starts on a freshly built workspace); D-14(b): the byte half is checked while command 1 holds; the second command starts only after command 1 has exited. TEST-SPEC §14's index (line 587) lists T13.5-2 under 14.26.

**State (after Task 13).** `T13_5_2` (`section-13.5.ts`, about lines 1028–1159) runs the excluded commands without `--json`, never checks stdout, and reruns only `review create --name t` once command 1 has run.

**Change.**
- For each excluded command — `rename`, `move`, `review create`, `resolve`, `split`, each an operation succeeding on an unheld twin and composing with command 1: one run under `--json` exiting 2 promptly while command 1 still holds, stdout exactly the error document (`code` `"workspace-busy"`, `path` `".xspec/lock"`, `locations` `[]`; Task 4's form-exact decode), and one run without `--json`, exit 2, stdout empty; each modifies nothing (journal, sessions, sources), in the bracket the constraints fix.
- After each refusal, command 1's entry byte-identical (name, content) and again the lock directory's only entry (Task 10).
- The held-state comparison while command 1 holds, against command 1's pre-invocation state.
- Each excluded operation shown to succeed on an unheld twin, and to succeed once command 1 has completed (every one, not only `review create`).
- Determinism: each refused `--json` run repeated twice more, each on a fresh content-identical workspace held by a separate holder process — once recreated at the same absolute path, once at a different one — stdout and stderr byte-identical across the three runs.
- H-7: `"T13.5-2"` gains `"14"`. Title updated.
- Manifest: VIOL-CORE-EARLYWRITE certifies `T13.5-1, T13.5-2, T13.5-4` (T13.5-8 joins in Task 20).

**Verify.** Certification: conformer passes; NOLOCK fails exactly T13.5-2 and T13.5-8; EARLYWRITE exactly T13.5-1, T13.5-2, T13.5-4; every other verification unchanged. Red check: a stand-in around the conformer that rewrites the busy document's `code` to `null` fails the new arm; one that rewrites `path` likewise. Against the built product T13.5-2 fails diagnosed. S-1 passes. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 16 — T13.5-3 to TEST-SPEC; VIOL-CORE-EARLYRELEASE (B-G15, D-7, D-14c)

**Requirement.** T13.5-3 (TEST-SPEC.md line 573) in full, its past-the-hold arm included; E-5 (line 648: fixed fractions, a fixed number of kills per command in CI). CERTIFICATIONS.md: VIOL-CORE-EARLYRELEASE (lines 75–80); VIOL-CORE-STALELOCK (lines 39–44: its refusal with no identifier listed again must fail the test); VIOL-CORE-EARLYWRITE's constraint (line 28: the subsequent command succeeds whether or not the killed operation's writes landed — not a retry of the same operation); CONF-CORE's constraints (line 11: no `build` or read between the kill and the later command, nor on the past-the-hold copies — items are learned before copying; fresh built workspaces); VIOL-CORE-PARTIALWRITE (line 51: a run stopped short of its last write is judged on the lock path alone); D-14(c).

**State (after Task 13).** `T13_5_3` (`section-13.5.ts`, about lines 1165–1210) SIGKILLs the direct child of a held `rename` and checks only that a later command exits 0.

**Change.**
- Each mutating command in turn is held and killed under Task 8's discipline; between the kill and the later command, `.xspec/lock` holds exactly one plain-file entry; the later command (a different, composing operation) exits 0 and leaves `.xspec/lock` absent; the reuse check applies to a `workspace-busy` refusal (void and rerun, bounded; with no identifier listed again, the test fails).
- Past the hold, per command: on a freshly built valid workspace holding an `audit` session `s` (items learned before copying), measure the lift-to-exit span of the twin (the same operation held and lifted on an identical copy); then, each on a fresh copy, hold, lift, and kill at fixed fractions of that span (a fixed count per command in CI), the group confirmed gone before inspection, no later command; whenever some path the twin's run changed (a source, the journal, a session file, a derived file, graph data) is not yet in the twin's final state, `.xspec/lock` holds exactly one plain-file entry; a run that exited before its kill equals its twin (exit code, output, workspace, under H-6) with `.xspec/lock` absent.
- Title updated.
- Fixture `bin-earlyrelease.mjs`: a `--test-hold` run releases once its hold is lifted (an unheld run straight after acquiring), then dwells for a sustained interval — long against the rest of the run, well under the driver's 30 s hang guard (pick a value, measure, record) — then proceeds outside exclusivity.
- Manifest: VIOL-CORE-EARLYRELEASE certifying `T13.5-3`, at its document position.

**Verify.** Certification: conformer passes; STALELOCK and EARLYRELEASE each fail exactly T13.5-3 (STALELOCK on the later command, EARLYRELEASE on the past-the-hold arm), diagnosed; every other verification unchanged (EARLYWRITE and PARTIALWRITE pass T13.5-3 as their entries state). Measure and record the test's time per fixture and the CORE family's total. Against the built product T13.5-3 fails diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 17 — T13.5-4: reads during a hold under the held-state comparison; VIOL-CORE-READERENTRY; CHATTYREADS gains T13.5-4 (B-G16 part, D-9, D-5 part, D-14d)

**Requirement.** T13.5-4 (TEST-SPEC.md line 574), its reads half: while a mutating command is held, read commands run and observe the prior state — `check` clean on a clean workspace, reporting nothing for the lock path, no read command reporting the busy condition — and once each has exited, the held-state comparison holds, the holder's entry byte-identical (name, content), nothing added beside it (H-6). CERTIFICATIONS.md: VIOL-CORE-READERENTRY (lines 89–95), VIOL-CORE-CHATTYREADS (lines 53–59: certifies T13.4-5 and T13.5-4, failing T13.5-4 through the held-state comparisons after the reads), VIOL-CORE-PERSISTREADS's constraint (line 64: no stale resolution read during the hold), VIOL-CORE-PARTIALWRITE's (line 51: reads run while no `build` runs), CONF-CORE's (line 11: reads drawn from CONF-CORE's read surface, no `inventory`, no preview); D-14(d).

**State (after Task 13).** `T13_5_4` (`section-13.5.ts`, about lines 1234–1395) runs reads during the hold but makes no held-state comparison after them.

**Change.** After each read run during the hold exits: the held-state comparison and the holder's entry identity (Task 10's machinery, the same used for every lock-path inclusion); `check`'s report names nothing at or under the lock path; no read's output carries `workspace-busy`. The storm arm is unchanged. Title updated.
- Fixture `bin-readerentry.mjs`: while a directory (never a symlink to one) occupies `.xspec/lock`, `build` and each read command add their own entry (the conformer's entry form, recording their own process identifier) and leave it; acquisition removes a dead reader's entry like any leftover and refuses on a live one.
- Manifest: VIOL-CORE-READERENTRY certifying `T13.5-4`; VIOL-CORE-CHATTYREADS certifies `T13.4-5, T13.5-4`.

**Verify.** Certification: conformer passes; READERENTRY fails exactly T13.5-4; CHATTYREADS exactly T13.4-5 and T13.5-4; EARLYWRITE still exactly its three; every other verification unchanged. Against the built product T13.5-4 fails diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 18 — T13.5-4: `build` during a hold; VIOL-CORE-BUILDWAIT (B-G16 part, D-10, D-14d)

**Requirement.** T13.5-4 (TEST-SPEC.md line 574), its `build` half: on a freshly built valid workspace while a `rename` is held, `build` exits 0 while the hold stands — neither refused nor waiting the hold out — so the held-state comparison still holds once it exits, the holder's entry byte-identical; the `rename`, its hold lifted, ends exactly as on a twin with no concurrent `build` (exit code, output, final workspace, H-6). CERTIFICATIONS.md: VIOL-CORE-BUILDWAIT (lines 97–103), CONF-CORE's justification (line 15: the harness must await `build`'s exit before lifting the hold), VIOL-CORE-PARTIALWRITE's constraint (the `build` overlaps no read); D-14(d).

**Change.** Add the arm: start `build` while the `rename` holds; await its exit before lifting the hold, through a bounded run that makes a waiting `build` a diagnosed failure within the test's budget (as Task 14 does — never the driver's timeout `error`); assert exit 0, no `workspace-busy`, the held-state comparison and the entry's identity after it exits; lift; compare the `rename`'s end with a twin's that had no concurrent `build`. Title updated.
- Fixture `bin-buildwait.mjs`: once `build` has loaded configuration and discovered sources, while a directory occupies the lock path, it lists it and, while that holds another live run's entry (judged as acquisition judges), polls; it proceeds once none stands; anything else at the lock path, nothing there, or a refused listing never holds it back; it writes nothing there.
- Manifest: VIOL-CORE-BUILDWAIT certifying `T13.5-4`.

**Verify.** Certification: conformer passes; BUILDWAIT fails exactly T13.5-4, diagnosed; CHATTYREADS still exactly T13.4-5 and T13.5-4; READERENTRY and EARLYWRITE unchanged; every other verification unchanged. Red check: lifting the hold before awaiting `build` makes BUILDWAIT pass T13.5-4 (show once, then restore). Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 19 — CONF-CORE's configuration, discovery, and section-form surface (D-3, D-5 part)

**Requirement.** CERTIFICATIONS.md CONF-CORE Scope (line 11): no code group but in T13.5-8's workspaces (its wrong-kind and first-discovery arms stage one); `move`'s section form only to its argument checks (a nonexistent origin ID a usage error, exit 2, after acquisition and the hold); "Configuration and discovery (7, 12.0), as T13.5-8's acquisition-after arms stage them, each met before acquisition and reported in 12.7's error document": the configuration error of 14.14 for an unknown key in the configuration's top-level object and for a path both groups match (created by the arm), and 14.25's read failure at a discovered directory made unlistable; "the second discovery once exclusivity is held". SPEC 13.5 (line 785: acquisition once configuration is loaded and sources discovered; holding it, a second discovery fixes the sources every later check consults, a configuration error it meets reported there), 7, 12.0, 14.14, 14.25. VIOL-CORE-EARLYWRITE (line 26): the second discovery, the argument checks, baseline resolution, the gate, and the precondition are judged after acquisition and before the writes they gate, and the refusing exit is deferred until the hold is deleted. VIOL-CORE-EARLYREFRESH (line 33) keeps its early refresh.

**State (after Task 13).** `product.mjs`: `loadConfig` (line 502) reads only `specs` and ignores other keys (`code` included); `walkPlainFiles` (line 624) swallows `readdir` errors; `runMutating` (line 2659) discovers only after acquisition and the hold; `commandMove` (line 3346) refuses the section form, exit 70. Reviewer D's gap 3 lists the observed divergences.

**Change.** Parse code groups and discover code sources; refuse an unknown top-level key (`configuration-error` at the configuration file, exit 2); a first discovery before acquisition that reports the both-groups configuration error and a refused listing (`read-failure` at that directory, exit 2, nothing written); a second discovery right after the hold, fixing the sources later checks use and reporting a configuration error it meets; the section form's argument check after the hold; the wrong-kind origin errors kept after the hold. Every violator switch keeps composing, EARLYWRITE as its entry states.

**Verify.** Hand probes for each divergence in reviewer D's gap 3, now conforming, with before/after recorded (`bogus: true` → `configuration-error`; the doubly matched path → `configuration-error`; `specs/sub` unlistable → `read-failure` at `specs/sub`, nothing written; `move specs/A.mdx#nope specs/B.mdx#x --test-hold h --json` creates the hold file and, once it is deleted, exits 2 with `code` `null`; the same under EARLYWRITE's binary). Certification: every manifest verification unchanged (the current tests do not yet reach these arms). Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 20 — T13.5-8's acquisition-first arms; VIOL-CORE-EARLYWRITE gains T13.5-8 (B-G19 part, D-14e)

**Requirement.** T13.5-8 (TEST-SPEC.md line 578): "The acquisition-first and acquisition-after arms each run under `--json` twice, each run exiting 2 and modifying nothing: once while a `review resolve` is held (`--test-hold`) on the arm's workspace — holding an `audit` session `s` created while it was valid — and once with no holder and `.xspec/lock` a symbolic link to a directory outside the workspace (T13.5-10(a)), the link and its target left untouched", then the "Acquisition first — …" list in full (copy every invocation's spelling from it). CERTIFICATIONS.md: VIOL-CORE-NOLOCK's expected failures (line 21), VIOL-CORE-EARLYWRITE's (line 27: the holder's resolution, written before its hold, fails the held-state comparison made while it holds on a valid workspace), CONF-CORE's staging constraints (line 11: baseline arms on workspaces in no repository; the BOM spec source added after the workspace was built valid and after `s` was created; the code source well-formed TypeScript spelling no marker, `text` call, or specifier naming a spec module, S-9-verified; session `c` corrupt only while the run naming it executes; each modifies-nothing compare brackets one refused invocation alone; no `build` or read inside a bracket, during a hold, or while a lock directory stands; holders on freshly built workspaces or on the failing workspace); D-14(e): each holder is awaited to exit before the next mutating command; the byte half is checked on held arms.

**State (after Tasks 13 and 19).** `T13_5_8` (`section-13.5.ts`, about lines 1879–2316): `failingWorkspaceArms` asserts its held refusals by exit code only; there is no obstructed run, no code-source workspace, no `move` section-form, `--coverage`, unknown-item, or corrupt-`c` arm.

**Change.** Implement every acquisition-first invocation of the entry, each run twice under `--json` — beside a held `review resolve` → `code` `"workspace-busy"`; with no holder and `.xspec/lock` a symlink to an outside directory → `"write-failure"`, the link and its target untouched — both with `path` `".xspec/lock"`, exit 2, nothing modified (one bracket per refused invocation). Each held arm makes the held-state comparison while the holder holds. The code-source workspace's TypeScript is declared through a staged-source record S-9 verifies. Title updated to the arms the test now has.
- Manifest: VIOL-CORE-EARLYWRITE certifies `T13.5-1, T13.5-2, T13.5-4, T13.5-8` (the document's set).

**Verify.** Certification: conformer passes; NOLOCK fails exactly T13.5-2 and T13.5-8; EARLYWRITE exactly its four; HOLDLINK, EARLYRELEASE, READERENTRY, BUILDWAIT, STALELOCK, CHATTYREADS, PERSISTREADS, PARTIALWRITE, EARLYREFRESH pass T13.5-8; LATELOCK (if still wired) unchanged. Red check: a stand-in around the conformer that reports `code` `null` for the busy refusal fails the held arms. Against the built product T13.5-8 fails diagnosed. Record times. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 21 — T13.5-8's acquisition-after and seam-ordering arms; VIOL-CORE-LATEHOLD; VIOL-CORE-LATELOCK retired (B-G19 part, D-6)

**Requirement.** T13.5-8 (TEST-SPEC.md line 578): "Acquisition after — …" (a surplus operand → the syntax-class error, `code` `null`; a configuration file made invalid — by an unknown top-level key, CONF-CORE's constraint — in the held arm during the hold → `"configuration-error"`; on a workspace configured as T13.5-12(d)'s, a file created at the doubly matched path just before the run (held arm: during the hold, the holder started with the path unoccupied) → `"configuration-error"` with the configuration file's path; a discovered directory made unlistable (T14-10(g)'s staging, verified on the harness) → `"read-failure"` at that directory; each staged change undone before the holder's hold is lifted), "Seam ordering, …" (add `review create --coverage nope --name n` and `move <code> specs/C.mdx`, each exit 2 with `code` `null`, to the existing three; each creates the hold file first, the held-state comparison holding while held, exits only after its deletion, the workspace then byte-identical to its pre-invocation state, `.xspec/lock` gone), and the non-mutating boundary (unchanged). CERTIFICATIONS.md: VIOL-CORE-LATEHOLD (lines 68–73); CONF-CORE's justification (line 15: a seam wait must fail when the command exits without creating its hold file — never proceed on its exit or on a timeout).

**Change.** Implement the acquisition-after arms (each twice under `--json`, held and obstructed, never acquisition's error) and the seam-ordering additions as above, with `.xspec/lock` asserted gone after each seam-ordering run. Title updated.
- Fixture `bin-latehold.mjs`: acquisition stays where 13.5 puts it; the hold file is created only once the usage class's unknown and wrong-kind names and files and baseline resolution have passed, the second discovery preceding them; everything else as the conformer.
- Retire VIOL-CORE-LATELOCK (document dropped it): delete `bin-latelock.mjs` and its switch if unused, remove its manifest entry (unless Task 13 already did).
- Manifest: VIOL-CORE-LATEHOLD certifying `T13.5-8`, at its document position. The CORE family now matches the document's twelve violators.

**Verify.** Certification: conformer passes; LATEHOLD fails exactly T13.5-8 (its four seam-ordering arms), diagnosed; every other CORE verification unchanged; 13 CORE verifications. Compare the CORE lines with the document using VERIFY's script: no CORE discrepancy remains. Red check: a seam wait that proceeds on the command's exit makes LATEHOLD pass (show once, then restore). Against the built product T13.5-8 fails diagnosed. Record times. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 22 — T13.5-10 registered, with arms (a) obstruction and (b) leftover takeover (B-G21 part)

**Requirement.** T13.5-10 (TEST-SPEC.md line 580): its opening sentence (each arm staged on a freshly built valid workspace holding an `audit` session `s` created while it was valid — an unbuilt one where an arm says so — run with each mutating command in turn, each an operation succeeding on an unstaged twin, under `--json`, every arm staged afresh per command; every run prompt, no FIFO opened), (a) in full (four occupants of `.xspec` → `write-failure` at `".xspec"`; four occupants of `.xspec/lock` → `write-failure` at `".xspec/lock"`; nothing modified, occupants byte-identical in place, link targets untouched, nothing written through a link), and (b) in full (about ten leftover stagings, dead entries among them, and a dead entry carried in by a copy of the workspace; exit 0, result byte-equal to the twin's, `.xspec/lock` absent, every link target byte-identical; no plain file of the harness's own naming inside the lock directory). The Exclusions entry (CERTIFICATIONS.md line 306): (b)'s link staging shares P-15's leftover machinery (Task 9).

**Change.** Register T13.5-10 in a new module (e.g. `test/suite/registry/section-13.5-ii.ts`, with its suite wrapper and index import; H-7 entry with `"13.5"`, `"13.4"`, and `"14"` and whatever else traceability.ts's rules give) holding arms (a) and (b), built on Tasks 8–10's machinery; the module header and title say which arms exist so far (Tasks 23–27 add the rest).

**Verify.** Against the CONF-CORE conformer as reference (Run mechanics; every command here is in its surface): (a) and (b) pass. Red checks: a scratch copy of the conformer whose leftover removal follows directory links fails (b) on a link target; one that removes an obstruction instead of failing fails (a). Against the built product and the empty stub (S-7), T13.5-10 fails diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 23 — T13.5-10(c): a busy refusal among bracketing leftovers; a live entry unreadable or altered (B-G21 part)

**Requirement.** T13.5-10(c) (TEST-SPEC.md line 580) in full: dead entries (copied in from twins in which a held `rename` is killed under T13.5-3's discipline, twins killed both before the holder starts and while it holds) and leftovers of the harness's own naming (each a directory holding a file or a FIFO, made `-wx` once filled, the harness's own listing of each refused, verified first) bracketing the holder's entry — at least one of each kind before and after it, in byte order of name and in the order the filesystem lists the lock directory to the harness, the entry's name observed, never pinned (H-4); the harness names leftovers below and above that name in byte order, then further ones until its listing brackets the entry too, and copies in further dead entries until they bracket it in both orders — each a bounded number, exhaustion voiding the trial, rerun with a fresh holder a bounded number of times, exhaustion a harness error (H-11); each mutating command refused `workspace-busy` at `".xspec/lock"`, never `"read-failure"`, every staged leftover and dead entry byte-identical in place (permissions restored before comparing) and the holder's entry identical; once the holder completes, `.xspec/lock` holds exactly the staged leftovers, and the next mutating command removes them all. The permission arm (every permission removed from the live entry during the hold, its name and content recorded first, the harness's own read then refused — verified; each command refused alike; restored, content identical; after the holder, `.xspec/lock` absent) and the alteration arm (three separate in-place alterations — truncation, garbage of ill-formed UTF-8 of another length, a dead run's entry's content; name recorded before, content after; each command refused alike; the altered entry byte-identical and the only entry; the holder completes exit 0; `.xspec/lock` absent). H-4's grant-and-restore for the harness's own writes and reads of entries (Task 5).

**Facts.** The bracketing needs a filesystem not listing in creation order (Preamble facts): check the local temporary directory's filesystem (`stat -f -c %T` on it) before running; on tmpfs the arm exhausts into a harness error by design — run it where `/tmp` is ext4 (CI) or point the harness's workspaces at an ext4 directory, and record in AGENTS.md how to run this arm locally.

**Change.** Add arm (c) to T13.5-10 per the entry; update the title and header.

**Verify.** Against the CONF-CORE reference: passes. Red checks with scratch conformer copies: one judging entries in listing order (removing each dead entry it meets, refusing at the first live one) fails; one reading the entry's content to judge liveness fails the permission or alteration arm. Built product and S-7: diagnosed failures. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 24 — T13.5-10(d): refused reads and writes with their stated residues; determinism arms (B-G21 part)

**Requirement.** T13.5-10(d) (TEST-SPEC.md line 580) in full — each staging verified on the harness itself (T14-9's and T14-10's disciplines; `test/helpers/permissions.ts`), each run exit 2, nothing modified, release following the failure, exactly the stated residue: empty leftover lock directory `-wx` → `read-failure`, no `.xspec/lock` after; a lock directory holding a subdirectory holding a file, the subdirectory `-wx` → `read-failure` at `".xspec/lock"`, never the nested path; empty leftover lock directory `r-x` → `write-failure`, no `.xspec/lock` after; the subdirectory `r-x` → `write-failure`; after either subdirectory arm `.xspec/lock` holds exactly one occupant, a directory holding exactly the staged file (its name unasserted), and no entry; read-only `.xspec` holding no `lock` → `write-failure` at `".xspec/lock"`, none after; a plain file at the lock path with `.xspec` read-only and the file unwritable → `write-failure`, the file byte-identical in place; `.xspec` unsearchable (`rw-`) holding no `lock`, and separately an empty lock directory, under a configuration reaching nothing under `.xspec` → `read-failure` or `write-failure` at `".xspec/lock"`, `.xspec` byte-identical once its mode is restored; a lock directory unsearchable (`rw-`) holding a directory holding a file → the same codes, `.xspec/lock` holding exactly the staged directory and file, no entry; an unbuilt workspace with a read-only root → `write-failure` at `".xspec"`, no `.xspec` after, `resolve` and `split` naming the absent session `s`. The two empty-leftover-directory arms are determinism arms: each run twice and once more on a content-identical workspace at another absolute path, stdout and stderr byte-identical.

**Change.** Add arm (d) to T13.5-10, its stagings built so T14-9's acquisition-write arms (Task 40) and T14-10(i) (Task 41) can reuse them; update the title and header.

**Verify.** Against the CONF-CORE reference: passes. Red check: a scratch conformer copy skipping release after a failure at acquisition fails the residues. Built product and S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 25 — T13.5-10(e) on one machine, and the lock directory deleted during a hold (B-G21 part)

**Requirement.** T13.5-10(e) (TEST-SPEC.md line 580), its first part: with a held `rename`'s entry deleted by hand during its hold — or replaced by hand, under its name (H-4), by an occupant that is no entry, each staged separately: a directory holding a file, a FIFO, a symbolic link to a plain file outside the workspace — each mutating command (an operation composing with that `rename`) acquires, creating its own hold file while the first still holds, never refused; the replacing occupant is gone once the second run has created its hold file (the directory with all it holds, the link itself, its target byte-identical, the FIFO unopened) and the lock directory then holds that run's entry alone, named apart from the replaced entry; the holds are lifted in turn, the `rename`'s first, each exiting 0; once the `rename` completes, the second run's held-state comparison is taken against the state the completed `rename` leaves, its entry byte-identical to its state when it created its hold file and the only entry, and a further mutating command is refused `workspace-busy`, modifying nothing; once both complete, the workspace equals a twin's on which the two operations ran in turn, and `.xspec/lock` is absent. And its last part: with `.xspec/lock` and all it holds deleted by hand during the hold of each mutating command in turn, the held run, its hold lifted, ends exactly as its unstaged twin (exit 0, output and final workspace byte-equal under H-6, no `write-failure`) and leaves nothing at `.xspec/lock`.

**Change.** Add these two parts of arm (e) to T13.5-10; update the title and header (the other-machine part is Task 26).

**Verify.** Against the CONF-CORE reference: passes. Red check: a scratch conformer copy judging liveness by names alone (refusing on any name in its entry form, whatever its kind) fails the replacement stagings. Built product and S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 26 — T13.5-10(e) another machine, (f) the acquirer's own identifier, (g) the gap and its remedy (B-G21 part)

**Requirement.** T13.5-10 (TEST-SPEC.md line 580): (e)'s other-machine part (the holder a held `rename` in the harness's namespace; each mutating command started under `--test-hold` in a fresh namespace whose first process is the harness's own; the pre-start verification that the namespace lists no identifier the `rename`'s processes bear; the command takes the entry over, creating its hold file while the holder holds; the holds lifted in turn, holder first, each exit 0; the assertions of Task 25's part but the further mutating command; a `workspace-busy` refusal voids the trial only if the namespace has by then allocated an identifier as large as the least the `rename`'s processes bear — rerun in a fresh namespace, bounded, exhaustion a harness error — and otherwise fails); (f) in full (a held `rename` as the first process of a fresh namespace, killed under T13.5-3's discipline; each mutating command started the same way in another fresh namespace takes the dead entry over, exit 0, `.xspec/lock` absent after; the same in-namespace identifiers verified while each run is held — mismatch voids, bounded; the dead entry's name recorded after the kill and the later run's entry, while it is held, bearing a byte-different name — H-4's one cross-run comparison; any refusal fails); (g) in full (a held `rename` as a namespace's first process, killed; the harness verifies every in-namespace identifier its processes bore is listed in the harness's own process list, while held and before each later command — mismatch an ineffective staging; each command in the harness's namespace either proceeds — exit 0, the twin's result, `.xspec/lock` absent — or is refused `workspace-busy` with nothing modified and the entry identical, never another outcome; where refused, `.xspec/lock` is deleted by hand and the same command then proceeds, exit 0, the twin's result). E-1, E-3.

**Change.** Add these arms with Task 12's launchers and observations; update the title and header.

**Verify.** Through the `claude` wrapper recipe: against the CONF-CORE reference, passes (record which of (g)'s two outcomes it took); built product and S-7 diagnosed. Red check for (f): a scratch conformer copy naming its entry by the identifier alone fails the name inequality. Self project, through the wrapper: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 27 — T13.5-10(h): acquisition lists no directory but those 13.5 names (B-G21 part)

**Requirement.** T13.5-10(h) (TEST-SPEC.md line 580) in full: `.xspec`, holding no `lock`, made unlistable but searchable and writable before the invocation (`-wx`; the harness's own listing refused and its own creation and removal of a file in it permitted, verified first), under a configuration whose globs reach nothing under `.xspec`; each mutating command whose operation leaves no orphan — `rename`, a section-form `move`, `review create`, `resolve`, `split` — proceeds: exit 0, stdout byte-equal to its unstaged twin's, every path outside `.xspec` and the journal and session files byte-equal to the twin's, `.xspec/lock` absent once it ends; once `.xspec`'s permissions are restored, `build` exits 0 and `check` is clean. Graph data is compared nowhere here, and the file form of `move` is not run.

**Change.** Add arm (h); T13.5-10 is then complete — the title and header say so.

**Verify.** Against the CONF-CORE reference for every command but the section-form `move` (outside its surface): passes. Red check: a stand-in around the conformer that lists `.xspec` before acquiring and reports its refusal as `read-failure` fails (h). Built product and S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 28 — T13.4-12, the transient lock path (B-G12)

**Requirement.** T13.4-12 (TEST-SPEC.md line 565) in full: each readable leftover or obstruction staged in turn (a dead run's entry; a plain file at `.xspec/lock` holding garbage; a symlink there to an outside directory holding a file; a FIFO there; a lock directory holding a symlink, a FIFO, and a directory holding a file) — `check` clean (neither condition 10 nor 22), `inventory`'s `recorded` available and equal to a leftover-free twin's, finding-free, `build` exit 0; made stale, `check` equals the stale twin's findings and `ids` the twin's answer; every command prompt, the staged leftover byte-untouched and the lock path holding exactly what was staged after each command (H-6's inclusion). The clean path (no `.xspec/lock` after `build` on an unbuilt workspace, after `review create` of `s`, and after `build`, `check`, `inventory`, a `rename --preview`, `ids`, `review status s`, `version`, and after `ids` and `review status s` on an edited workspace). Unreadable leftovers (`--x` lock directory; `-w-------` entry; verified): `inventory`, `check`, `ids` answer as the twin or exit 2 with `read-failure` at `.xspec/lock`; a `move --preview` answers byte-identically to the twin, `delta` available, exit 0; never `recorded`/`delta` unavailable, condition 23, or `check`'s unit form; the entry identical and the only occupant (permissions restored to inspect). The manual remedy (each T13.5-10(a) obstruction deleted by hand; the next `rename` exits 0).

**Change.** Register T13.4-12 (in `section-13.4.ts` or a new module; H-7 entry per traceability.ts's rules), built on Tasks 8–10 (dead entries, stagings, inclusion check).

**Verify.** The built product does not touch `.xspec/lock` and so models a conforming reader except for its missing `lock` member: through the inventory-lock stand-in it should pass every arm but those needing exclusivity behaviour it lacks (record which); the CONF-CORE reference covers the `check`, `ids`, `build`, `review`, and `rename` arms (no `inventory`, `version`, or preview). Red checks: a stand-in whose `check` adds a file under `.xspec/lock` fails the inclusion; one whose `inventory` lists `.xspec/lock` in `recorded` fails. S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 29 — T13.5-11, release (B-G22)

**Requirement.** T13.5-11 (TEST-SPEC.md line 581) in full: (a) `.xspec/lock` absent after each mutating command's success; after each usage error past acquisition (an occupied hold path; an unknown old ID, origin file, profile, session, item); after each listed exit-1 refusal (a `rename` refused by validation, T6.4-3; a `move` refused for a 6.5 reason, T6.5-4; a `review create` turned back by the gate and one naming an existing session, T10.7-1; a `resolve` of a blocked item, T10.7-10; a `split` of an item of another kind, T10.7-9; a `resolve` and a `split` naming a corrupt session, T10.1-4); after a read failure past acquisition (T13.5-12(e)) and a configuration error the rediscovery meets (T13.5-12(d)); after each write failure of T13.5-7 but (b)'s; after acquisition's own read and write failures save the residue cases; and after a busy refusal it holds exactly the holder's entry. (b) the area's directory (no `.xspec`: an argument-check failure leaves none, also with `.xspec`'s read permission removed during the hold; an empty `.xspec` beforehand stays; the root read-only during the hold → twin's output, `.xspec` present and empty; an empty `.xspec/lock` beforehand → none after). (c) the lock directory `-wx` during the hold: the twin's outcome or `read-failure` at `.xspec/lock`, no `.xspec/lock` either way. (d) the lock directory `r-x` during the hold: the twin's outcome, exit 0, the entry left as the only one; restored, the next mutating command takes it over (Task 8's discipline) and succeeds, `.xspec/lock` absent.

**Change.** Register T13.5-11 (the module of Task 22, or another new one; H-7 entry). Its own body observes every ending (a) lists, staging each — reuse the staging helpers of the tests (a) names rather than restating them, but never rely on another test's assertion; T13.5-7's write-failure endings may run through `write-refusal-staging.ts`'s arms with a hook asserting the lock path. Split into follow-up tasks if (a)'s matrix is too large for one spawn.

**Verify.** Against the CONF-CORE reference, every arm within its surface passes. Red checks: a scratch conformer copy whose release lists the lock directory before deleting fails (c); one skipping release on exit 1 fails (a). Built product and S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 30 — T13.5-12, rediscovery under exclusivity (B-G23)

**Requirement.** T13.5-12 (TEST-SPEC.md line 582) in full, each arm under `--json` on a freshly built valid workspace, each change made during the hold: (a) a spec source with a `d` reference to the renamed section, and separately a code source a configured code group matches importing that section's module and holding a marker on it, created during a `rename`'s hold, are rewritten — byte-equal to a twin's where they existed before the invocation; a spec source created during `review create --strategy audit --name n`'s hold lies within the session's scope; (b) such sources present at invocation and deleted during the hold are absent from the operation — exit 0, no `read-failure`, the twin's result; (c) `specs/A.mdx` created during `rename specs/A.mdx a b`'s hold lets it proceed; deleted during the hold → the unknown-file usage error, `code` `null`; (d) a file created during the hold at a path both groups match → `configuration-error` with the configuration file's path, never the unknown-ID error; (e) a discovered directory made `--x` during the hold → `read-failure` at that directory; (d) and (e) with each mutating command; `.xspec/lock` absent after (d) and (e).

**Change.** Register T13.5-12 (H-7 entry with `"14"`); staged code sources declared through S-9-verified records. Its during-hold steps reuse T13.5-2's and T13.5-4's helpers, the `build` wait included, and its waits for the hold file are T13.5-8's (CERTIFICATIONS.md Exclusions line 306; D-14(g)).

**Verify.** The CONF-CORE reference covers the spec-source arms of (a)–(e) within its surface (no marker rewriting there); record what it covers. Red check: a stand-in or scratch conformer copy that consults its first discovery fails (a) and (c)'s creation arm. Built product and S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 31 — T13.5-9, the exclusion's reach (B-G20)

**Requirement.** T13.5-9 (TEST-SPEC.md line 579) in full: a `review resolve` started by the harness's own identity, from the root, in its environment, held; each mutating command as a second run under `--json` in each situation — (a) a different environment (`TMPDIR`, `HOME`, `XDG_RUNTIME_DIR` set for both to different existing directories, unrelated variables added to the second run's); (b) a different working directory (a subdirectory of the root; an outside directory with `--config`); (c) a different path to the root (a symlink above the root; the second mount); (d) a different user who can write the workspace — exit 2 promptly while the hold stands, nothing modified, the holder's entry identical and the only one; (a)–(c) `workspace-busy` at `".xspec/lock"`; (d) `workspace-busy`, or `write-failure`/`read-failure` at `".xspec/lock"`, never success; (d) again with a group-accessible empty `.xspec/lock` made by the harness before the holder starts → exactly `workspace-busy`, the access check made before the holder starts (failure an ineffective staging) and once held (failure leaves the lenient expectation). Its staging discipline and verifications.

**Change.** Register T13.5-9 (H-7 entry with `"14"`), using Task 11's machinery.

**Verify.** Through the `claude` wrapper recipe: against the CONF-CORE reference, passes (record (d)'s outcomes). Red check: a stand-in conformer copy keeping its exclusion state under `TMPDIR` fails (a). Built product (temporary-folder lock) and S-7: diagnosed. Self project, through the wrapper: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 32 — T13.5-13, overlapping acquisitions; CONF-RACE and VIOL-RACE-LISTFIRST (B-G24, D-11, D-14f)

**Requirement.** T13.5-13 (TEST-SPEC.md line 583) in full: the held arm — repeatedly (a fixed trial count in CI, E-5), on a freshly built workspace and on an unbuilt one, several mutating commands (renames of distinct sections, `review create` under distinct names), each with its own hold path and under `--json`, started together, unsynchronized; every hold file stands until each run has exited or created its hold file; then at most one hold file exists, each run without one exited 2 with `workspace-busy` at `".xspec/lock"` modifying nothing, the run with one exits 0 once lifted (no success acceptable); afterwards journal lines and session files exactly the success's, the workspace equal to a twin's where that operation alone ran (or the starting workspace), `.xspec/lock` absent — save, on the unbuilt workspace without a success, an empty `.xspec`. The unheld arm — renames each of a section in a file of its own, and separately `review resolve` of distinct unblocked items of one `audit` session `s`, started without `--test-hold`, at offsets from simultaneous to staggered across one run's span; each exits 0 or 2 with `workspace-busy`; afterwards `.xspec/lock` absent and the workspace equal to a twin's where the successes ran one after another in one of their orders, the harness trying each. CERTIFICATIONS.md CONF-RACE (lines 104–110: its surface and its staging constraint — every command drawn from CONF-CORE's surface, items learned through CONF-CORE's `review` reads) and VIOL-RACE-LISTFIRST (lines 112–117). The Phase 6 round-9 note: a twin per order of the successes, so keep the commands per trial few. The Phase 7 round-4 note: LISTFIRST's early listing treats a missing lock directory or area as empty.

**Change.**
- Register T13.5-13 (H-7 entry per the rules; it asserts 14.26's code). Starts must genuinely overlap (spawn every run before awaiting any).
- Fixtures: CONF-RACE's conformer — CONF-CORE's behaviour, an executable of its own (e.g. `test/fixtures/conf-race/bin.mjs` importing `../conf-core/product.mjs`); VIOL-RACE-LISTFIRST — lists the lock directory before adding its entry (a missing lock directory or area reading as empty), is refused by a live entry as the conformer is, otherwise after a sustained interval (long against the spread of runs started together, well under the hang guard; measure and record) adds its entry, removes the leftovers its listing found, and acquires without listing again.
- Manifest: CONF-RACE with in-scope `T13.5-13` and its violator, after CONF-CORE.

**Verify.** Certification: CONF-RACE passes; LISTFIRST fails exactly T13.5-13 on every run (run the self project twice and compare — E-5 requires stable results against the conformer, and the violator's failure on every run is what certifies overlap). The registration self-test now lists only `§CONF-LEFTOVER: P-15`. Built product and S-7: diagnosed. Record times. Self project: the accepted red (now: the mirror, and the registration check naming P-15 only).

**Done when.** The checks hold and the commit is pushed.

### Task 33 — T13.5-6, workspace isolation for nested roots and every mutating command (B-G17)

**Requirement.** T13.5-6 (TEST-SPEC.md line 576) in full: exclusion is per workspace for sibling workspaces and for one root inside another — an inner root `R/in` within `R`, each configuration globbing `specs/**/*.mdx` under its own root, neither discovering the other's sources nor touching a path the other writes; a mutating command held in either workspace leaves each mutating command in the other prompt and unrefused, exit 0 while the hold stands; concurrent mutations in the two workspaces leave each exactly as serial runs do. CERTIFICATIONS.md's Exclusions (line 305) keep it uncertified.

**State at bb3081a.** `T13_5_6` (`section-13.5.ts`, about lines 1657–1840) covers sibling workspaces only, one direction, `rename` only.

**Change.** Add the nested pair; for both pairs and both directions, hold a command in one workspace and run all five mutating commands in the other (each exit 0 while the hold stands); add concurrent mutations in the nested pair compared with serial runs (H-6's exclusion for the twin compares). Title updated.

**Verify.** Against the CONF-CORE reference: passes. Red check: a stand-in conformer copy that keys its exclusion by the outer root (e.g. takes the lock under the nearest `.xspec` above the working directory) fails the nested arm. Built product: its outcome recorded (it may pass — its temporary-folder lock is keyed per workspace). S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 34 — T13.5-7's lock-path residue, absences, and kill discipline (B-G18)

**Requirement.** T13.5-7 (TEST-SPEC.md line 577): (b)'s read-only `.xspec` refuses release's deletion of the emptied lock directory, which remains, empty, no outcome changed and no write failure reported, until a mutating command run once the permissions are restored proceeds unrefused and removes it; every other arm ends with `.xspec/lock` absent; the kill arm's kills under T13.5-3's discipline without the reuse check, no mutating command following, each run's group confirmed gone before `check` runs, the lock path's state after a kill being T13.5-3's past-the-hold arm's. H-6 (the exclusion for the arms' compares).

**State (after Task 7).** `write-refusal-staging.ts`: `assertPinnedState` (about lines 1340–1352) was the false failure on (b) — confirm Task 7 removed it; no arm asserts the residue or the absences; the kill arm (`section-13.5.ts` about lines 2113–2228, via `T13_5_7` at line 1849) kills the direct child only.

**Change.** Assert (b)'s residue (`.xspec/lock` present and empty), then restore the permissions, run a mutating command (unrefused, exit 0) and assert `.xspec/lock` absent; assert `.xspec/lock` absent after every other arm; move the kill arm onto Task 8's discipline (group gone before `check`, no reuse check, no mutating command after its kills), and after each kill judge the lock path with T13.5-3's past-the-hold machinery (Task 16's helper: exactly one plain-file entry wherever the run stopped short of its twin's final state, absent where it exited first) — CERTIFICATIONS.md's Exclusions (line 305) and D-14(g) require the shared machinery. Title updated.

**Verify.** T13.5-7's workspaces (embeddings, `d` references, Markdown emission) lie outside CONF-CORE's surface, so use a *lock-directory stand-in* around the built product: for each acquiring invocation it creates `.xspec` (where absent, remembering that it did), `.xspec/lock`, and one plain-file entry before running the product, and afterwards deletes the entry, then the lock directory, then a `.xspec` it created, ignoring refused deletions — a minimal model of acquisition and release. Against the bare built product (no lock directory ever), (b)'s residue assertion fails diagnosed — record; against the stand-in, (b)'s read-only `.xspec` refuses the stand-in's `rmdir` of the emptied lock directory and the arm passes, and every other arm's absence assertion passes. The kill arm still meets its existing disjunctive assertions against the built product (record outcomes). S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 35 — T10.1-6: every mutating command fails at acquisition on an occupied area path (B-G8)

**Requirement.** T10.1-6 (TEST-SPEC.md line 369), its last clause: with `.xspec` a plain file, and separately a symbolic link to a directory holding a journal and valid sessions, every mutating command — `rename`, `move`, `review create`, `resolve`, `split` — fails at acquisition first: exit 2, `code` `"write-failure"`, `path` `".xspec"`, nothing written, the plain file byte-unchanged and the link and its target byte-identical (T13.5-10(a)).

**State (after Task 3).** `section-10.1.ts`'s area arm (`assertAreaOccupied`, about line 2008) runs no mutating command.

**Change.** Add the five commands to both stagings under `--json`, asserting the error document (Task 4's decode) and the byte-identities. Title updated if it misstates the contract.

**Verify.** Against the CONF-CORE reference for the five commands (its surface): pass. Against the built product: record the outcome (diagnosed if failing). S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 36 — T11.6-3: the lock path reported unconditionally, and nothing under it listed (B-G10)

**Requirement.** T11.6-3 (TEST-SPEC.md line 472), the sentences beginning "The lock path is reported unconditionally": `lock` exactly `".xspec/lock"` before any build with `.xspec` absent; with `.xspec` a plain file and a symlink (exit 1, only T10.1-6's condition-23 finding); with a leftover at or under the lock path — a plain file at it, and a dead run's entry (a held `rename` killed under T13.5-3's discipline), a directory, and a FIFO in a lock directory; and while a mutating command is held — every other answer finding-free, exit 0, and nothing at or under the lock path appearing in `sources`, `recorded`, or `sessions`; each staged leftover untouched (H-6's inclusion).

**State (after Task 3).** `section-11.6.ts` decodes the full form (line 1664) but has no lock-path arm.

**Change.** Add the arms with Tasks 8–10's machinery; the held arm runs `inventory` while a `rename` holds and checks the lock path's inclusion afterwards. Title updated.

**Verify.** Through the inventory-lock stand-in, the built product passes every arm except the held arm's lock-directory expectations it cannot meet (record); a red check — a stand-in whose `inventory` lists `.xspec/lock/<entry>` in `recorded` — fails. S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 37 — T11.6-1: every member but `root` and `config` invariant under the working directory, both legs (B-G9, A-G1(c))

**Requirement.** T11.6-1 (TEST-SPEC.md line 470), its last sentence: on a built workspace with emission enabled, a journal, and a session, each run but the root's — from nested `a/b`, from the sibling directory under `--config`, through each link, and on the Windows leg the drive-mismatch run against a root run on that leg — reports every member but `root` and `config` (`findings`, `configuration`, `sources`, `derived`, `recorded`, `graphData`, `journal`, `sessions`, `lock`) byte-identical to the root run's, `graphData` exactly `".xspec"` and `lock` exactly `".xspec/lock"`. T1.5-1's inventory clause cross-references this arm (A-G1(c)): implementing it here closes both.

**State (after Task 3).** `section-11.6.ts` (`T11.6-1` from about line 485) and `test/helpers/e6-drive-mismatch-arm.ts` (about lines 361–370) decode only findings and anchoring.

**Change.** Add the member-invariance arm on the Linux leg and to the drive-mismatch arm (a root run on the Windows leg beside it). Title updated.

**Verify.** Linux: through the inventory-lock stand-in the built product passes; a stand-in relativizing `lock` to the working directory (`../../.xspec/lock` from `a/b`) fails. Windows: verified only in CI (Task 50 checks the leg); S-7's layer 4 still sees the drive-mismatch body fail diagnosed against the stub. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 38 — T12.7-3: the busy workspace's error document (B-G11)

**Requirement.** T12.7-3 (TEST-SPEC.md line 532): "a busy workspace → `code` `"workspace-busy"` and `path` `".xspec/lock"` (T13.5-2)", beside the write and read arms.

**State (after Task 4).** `section-12.7.ts` holds the write and read arms (about lines 3300–3380), no busy arm.

**Change.** Add the arm: a `rename` held, a second mutating command under `--json` → exit 2, stdout exactly the error document with those values (Task 4's decode).

**Verify.** Against the CONF-CORE reference: passes. Built product: diagnosed. S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 39 — T14-6: condition 26's code, and the title's count (B-G25)

**Requirement.** T14-6 (TEST-SPEC.md line 594): for each of the 26 conditions … conditions 24–26 carry `write-failure`, `read-failure`, and `workspace-busy` as the `code` of the exit-2 error document, appearing in no findings array; 14.26 staged as in T13.5-2.

**State (after Task 4).** `section-14.ts`'s T14-6 (title at about line 2915 still says 25 conditions) has no 14.26 arm.

**Change.** Add the 14.26 arm (staged as T13.5-2: a held `rename`, a second mutating command under `--json`); update the title to 26 conditions.

**Verify.** Against the CONF-CORE reference for the 14.26 arm: passes. Built product: diagnosed. S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 40 — T14-9: the reporters arm staged at the seam; acquisition's write arms (B-G26)

**Requirement.** T14-9 (TEST-SPEC.md line 597): for a mutating command the staging is applied while the command is held at the seam of 13.5, after acquisition and before any modification — acquisition's own stagings excepted, applied before the invocation (T13.5-10(d)); concerned paths, one arm each, include "acquisition's writes, staged before the invocation (T13.5-10(a), (d)) — the entry's addition, a leftover's removal, and the lock directory's creation concerning the lock path `.xspec/lock`, no entry ever named, and the area directory's creation and an occupant of the area's own path concerning `.xspec` (14.24)". H-6 (the lock path excluded from the mutating run's compare).

**State at bb3081a.** `section-14-ii.ts`'s `reportersArm` (about lines 739–916) stages `.xspec` unwritable before running `review create … --json` (about lines 758, 768–779): a conforming product then fails at acquisition with `write-failure` at `.xspec/lock` while the arm expects `.xspec` — a false failure today. No acquisition-write arms exist.

**Change.** Apply the reporters arm's staging to the mutating `review` subcommand while it is held at the seam (Task 7's exclusion covers its compare); add the five acquisition-write arms, reusing Task 24's T13.5-10(d)/(a) stagings: the entry's addition (an empty leftover lock directory `r-x`), a leftover's removal (a subdirectory `r-x` holding a file, or a plain file at the lock path under T14-9's full discipline), and the lock directory's creation (a read-only `.xspec` holding no `lock`) → `".xspec/lock"`; the area directory's creation (an unbuilt workspace, root read-only) and an occupant of the area's own path (`.xspec` a plain file) → `".xspec"`. Recovery after every arm (restore, `build` exit 0, `check` clean).

**Verify.** The CONF-CORE reference covers the acquisition arms (record); against the built product, record outcomes (diagnosed). S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 41 — T14-10's arm (i): read failures at acquisition and at the second discovery (B-G27)

**Requirement.** T14-10 (TEST-SPEC.md line 598), arm (i): at acquisition, the lock directory unlistable, and a subdirectory under it unlistable → `read-failure`, `path` `.xspec/lock`, the nested path never named, nothing modified (T13.5-10(d)); `.xspec` unsearchable, and separately the lock directory unsearchable → `read-failure`, or `write-failure` where the product meets the refusal first at a write, `path` `.xspec/lock` either way, nothing modified; and a directory the second discovery lists, made unlistable during a hold → `read-failure` at that directory (T13.5-12(e)). Each staging verified on the harness itself.

**State (after Tasks 3 and 6).** `section-14-ii.ts` has arms (a)–(h); arm (f)'s staging spares the lock path once Task 6 lands — confirm.

**Change.** Add arm (i), reusing Task 24's stagings and Task 30's during-hold staging where they exist.

**Verify.** The CONF-CORE reference covers (i)'s `rename` runs (record); built product: diagnosed. S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 42 — T6.6-3: acquisition's other outcomes beside the preview equivalence (A-G2, A-G3)

**Requirement.** T6.6-3 (TEST-SPEC.md line 309), from "Acquisition's every other outcome lies outside the equivalence likewise": (a) with, each separately, `.xspec/lock` a symlink to a directory; an empty leftover lock directory `r-x`; one `-wx`; and a lock directory holding a subdirectory holding a file, the subdirectory `-wx` — a `rename --preview` answers byte-identically to its run on an unobstructed twin, exit 0, the staging untouched, while the real operation exits 2 at `".xspec/lock"`, `"write-failure"` under the first two and `"read-failure"` under the last two; (b) with `.xspec` a plain file, the preview gives the invalid-workspace refusal (exit 1, exactly T10.1-6's condition-22 finding on `.xspec`, `mapping`, `files`, `delta` `null`) while the real operation exits 2, `"write-failure"`, `".xspec"`; (c) a preview leaves every leftover byte-untouched (a plain file at `.xspec/lock`; a directory and a FIFO in a lock directory), answering as on a leftover-free twin. The preview runs first, the real operation second (its release can clear the staging). H-4's grant (A-G3: the held arm's snapshots at about lines 1363 and 1423 read a held run's entry, which a conforming product may make unreadable). CERTIFICATIONS.md: VIOL-CORE-READERENTRY's note and the Exclusions entry on previews (line 311): (c)'s survival check shares Task 10's inclusion machinery.

**State at bb3081a.** `section-6.6.ts` (T6.6-3 at about lines 954–1536) stages nothing at or under the lock path; its held arm snapshots the whole root with a plain `readFile`.

**Change.** Add (a), (b), (c) (stagings from Tasks 9 and 24, permission stagings verified); the held arm's snapshots go through Task 10's machinery (the held-state comparison for the held run, the inclusion check for the preview), and its during-hold steps reuse T13.5-2's and T13.5-4's helpers (D-14(g)). The real-operation compares exclude the lock path (H-6). Re-budget T6.6-3's `timeoutMs` from measured times (VERIFY: 103 s in CI, 175 s alone locally, against 240 s, before these arms); record in AGENTS.md's timings bullet.

**Verify.** Built product: record outcomes (diagnosed); through the inventory-lock stand-in where relevant. Red check: a stand-in whose preview lists the lock directory and reports a refused listing as `read-failure` fails (a)'s read-failure pair. S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 43 — T1.5-1: the 11.2 documents and file paths outside identities (A-G1(a), (b))

**Requirement.** T1.5-1 (TEST-SPEC.md line 65): identities and file paths in every output — `query`, `show`, `ids`, coverage, impact, and the `occurrences`, `view`, and `at` documents (their identities, `file` members, and import targets) — workspace-relative and `/`-separated whatever the working directory (run from a nested directory and from the root; byte comparison). The inventory clause is T11.6-1's arm (Task 37). E-6 lists T1.5-1 in the Windows subset.

**State at bb3081a.** `test/suite/registry/section-1.5.ts` (about lines 208–528) runs only `query node`, `query nodes`, `show`, `ids`, `coverage`, `impact`; the fixture has no import and no code group, so file paths outside identities are vacuous (impact's code section is `{direct: [], transitive: []}`).

**Change.** Add an import (e.g. `specs/sub/B.mdx` importing `../A.xspec` with a reference through the binding: a cross-directory import target `specs/A.mdx` and an occurrence whose `file` is `specs/sub/B.mdx`) and a code group with a nested source (e.g. `src/sub/c.ts`, a named unit whose marker references `specs/sub/B.mdx#gamma`), both through S-9-verified staged-source records; run `occurrences`, `view`, and `at` (an offset inside that occurrence) from the root and from `specs/sub` (workspace-relative `<file>` operands, SPEC 12.0), stdout byte-identical, form-exact decodes, and every identity, `file` member, import target, and code-location path asserted exactly; keep `query node`/`show`'s references edge, impact's impacted code, and a coverage profile over the code group under the same comparison. T1.5-1 also runs on the Windows leg as the registered entry itself (`test/windows/e6-subset.test.ts`, line 51): the new stagings must stage identically there (no symlinks or other POSIX-only features), and that leg is verified in CI only — check the Windows job after pushing and record its T1.5-1 outcome.

**Verify.** Against the built product: record (T1.5-1 passed at bb3081a; a new failure must be diagnosed and explained). A stand-in rewriting one `file` member to `./`-prefixed or `\`-separated fails. S-9 and S-7 pass as required. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 44 — P-10 to TEST-SPEC; CONF-READERS and VIOL-READERS-CLAIM (C-G1, D-12, D-14f)

**Requirement.** P-10 (TEST-SPEC.md line 619) in full: randomized schedules of concurrent readers and one mutating command (via `--test-hold` and kills, each kill under T13.5-3's discipline before any later mutating command), readers started before a mutating command and confirmed still running as it starts among them; readers observe only prior-or-complete states at every path but the lock path (never polled); no lost append or resolution (each `rename`/`move` exiting 0 adds exactly one journal line, each killed one at most one; each resolve exiting 0 recorded its status, each killed one recorded it or left the session byte-unchanged); a run killed once its hold file appeared — held or past its hold — leaves its entry wherever its sources, journal, or session files differ from those the same operation leaves on a reader-free copy taken (lock path aside) as it started: then `.xspec/lock` holds exactly one plain-file entry until a later mutating command takes it over; readers never exclude a mutating command — each one not killed is never refused `workspace-busy` (but where the reuse check voids the trial) and ends exactly as on a reader-free twin copied (lock path aside) as it starts: exit code, stdout, sources, journal, and session files byte-equal (derived files and graph data not compared). E-5. CERTIFICATIONS.md CONF-READERS (lines 119–125: P-10's workspaces of CONF-CORE's shapes, its commands from CONF-CORE's surface, items learned through CONF-CORE's `review` reads; every mutating command an operation succeeding on its reader-free twin) and VIOL-READERS-CLAIM (lines 127–132); reviewer D's gap 12 and the Phase 7 round-2 note (CLAIM proves the overlap).

**State at bb3081a.** `test/suite/registry/section-16-p10.ts` (header lines 1–90 and on) implements the old entry: `running.kill("SIGKILL")` on the direct child; held-phase and straddle reads start only after the hold file appears; past-hold (`releaseKill`) kills only for `resolve`; no reader-free copies, no stdout comparison, no lock-path inspection; the header claims P-10 lies outside every certification scope.

**Change.** Rework the schedules and assertions per the entry: kills through Task 8 (with the reuse check and voidable trials); readers started before a mutating command and confirmed running (not exited) when it starts; past-the-hold kills for `rename` and file-form `move` as well as `resolve`, at delays under a fixed rule and spread; reader-free copies (lock path aside, Task 5's copy discipline) taken as each mutating command starts, the same operation run on the copy, and the comparisons above; a fresh workspace copy after a kill that invalidates later operations (CONF-READERS' constraint). Keep the poller over its fixed path set — T13.5-5's shared polling machinery, never polling the lock path — and the journal prefix checks (D-14(g): P-10 reuses T13.5-3's kill discipline and post-kill lock-path inspection, and T13.5-5's poller). Header and title corrected.
- Fixtures: CONF-READERS' conformer (CONF-CORE's behaviour, its own executable, e.g. `test/fixtures/conf-readers/bin.mjs`); VIOL-READERS-CLAIM (once a reader has located its configuration file it adds an entry in the conformer's form recording its own identifier — where `.xspec` and `.xspec/lock` each hold a directory or nothing, creating them as acquisition would; it dwells a sustained interval, long against the span from a reader's start to the acquisition of a command started once the reader is confirmed running, well under the hang guard — measure and record; then proceeds, and at its end deletes the entry, the emptied lock directory, and an area directory it created).
- Manifest: CONF-READERS with in-scope `P-10` and its violator, after CONF-RACE.

**Verify.** Certification: CONF-READERS passes; CLAIM fails exactly P-10 on every run (run twice). Built product: P-10's outcome recorded (diagnosed if failing). S-7: diagnosed. Record times; keep P-10 within its budget. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 45 — P-15, leftover trees; CONF-LEFTOVER and its three violators (C-G3, D-13, D-14f)

**Requirement.** P-15 (TEST-SPEC.md line 624) in full: seeded random leftover trees in `.xspec/lock` on a freshly built valid workspace holding an `audit` session `s` created while it was valid — varied depth and breadth; names beginning with `.` and, on Linux, names that are not valid UTF-8; plain files with every permission removed; symlinks to files and to directories outside the workspace, and dangling ones; FIFOs; no plain file at the lock directory's top level; every generated directory listable, searchable, writable — each draw running one mutating command drawn from the five, an operation succeeding on a leftover-free twin, under `--json`: prompt, no FIFO opened, exit 0 with the twin's result, `.xspec/lock` absent once it ends, every link target outside the workspace byte-identical, nothing written through a link. §16's preamble (line 608: seeded generators, shrinking, the seed reported on failure; fixed seeds in CI, E-5). CERTIFICATIONS.md CONF-LEFTOVER (lines 134–140: its surface — file-form `move`, `review create --strategy audit`, items learned through CONF-CORE's `review` reads; each link to a directory targets a directory holding at least one plain file, all listable, searchable, writable) and VIOL-LEFTOVER-FOLLOWLINK, -DOTNAMES, -BYTENAMES (lines 142–161); reviewer D's gap 13.

**Change.**
- Register P-15 in a new module `test/suite/registry/section-16-p15.ts` (suite wrapper, index import, H-7 entry per the rules), built on the property runner (`test/helpers/property.ts`) and Task 9's builder (byte names staged by bytes).
- Fixtures: CONF-LEFTOVER's conformer (CONF-CORE's behaviour — Task 13 already removes leftovers by raw bytes; its own executable); FOLLOWLINK (removal of a symlink to a directory, at any depth, recurses through it and empties the target, then removes the link); DOTNAMES (listings hide names beginning with `.`; at the top level such a leftover stays and the lock directory remains after release; deeper, the refused `rmdir` fails acquisition with `write-failure` at `.xspec/lock`, exit 2, nothing further removed); BYTENAMES (names decoded as UTF-8 with U+FFFD substitution and removed by the decoded name, which designates nothing — consequences as DOTNAMES').
- Manifest: CONF-LEFTOVER with in-scope `P-15` and its three violators, after CONF-READERS.

**Verify.** Certification: CONF-LEFTOVER passes; each violator fails exactly P-15 at the fixed seeds (their draws must reach a `.`-name, a non-UTF-8 name, and a directory link, nested and top-level — confirm from the draws and record); the registration self-test now passes. Built product: P-15 outcome recorded (diagnosed). S-7: diagnosed. Record times. Self project: only the manifest-mirror failure remains.

**Done when.** The checks hold and the commit is pushed.

### Task 46 — P-14 registered: generators and concurrent reads while a source flips (C-G2 part)

**Requirement.** P-14 (TEST-SPEC.md line 623), through "failing a product that, its operand check passed, reads the named file by its path and takes the file's absence for a refused read": random valid workspaces holding a spec source no other file references and, in a second series, a code source a configured code group matches that no other file imports, holding a marker on a section of a spec source (4.5); the flipped source references no identity the later `rename` renames; while refreshing reads (`ids`, `query nodes`, `occurrences`, `view` of another file — and, in the spec series, `view` of the flipped source and `at` of it at a within-file offset) run repeatedly and concurrently, the source is repeatedly removed or relocated outside every group's globs and restored, each change one atomic rename; each read's exit code and stdout equal a quiescent run's with the source present or absent — never a `read-failure` for it and never a crash; a read naming the absent source answers the unknown-file usage error (exit 2, `code` `null`), never condition 20 at offset 0. §16's preamble (line 608: generated workspaces valid by construction, each draw's forms judged by S-9's check before the product runs, a failing draw a harness error with its seed). E-5 (a fixed trial count, rule, and spread in CI). TEST-SPEC §14's index lists P-14 under 14.25 (H-7 `"14"`).

**Change.** Register P-14 in a new module `test/suite/registry/section-16-p14.ts` (suite wrapper, index import, H-7 entry with `"14"`), with seeded generators for both series (reuse the existing generators' forms where they fit), the flipper, the concurrent reads, and the quiescent references; add its MDX and TypeScript forms to S-9's fixed vector sets (`test/self/s9-fixture-well-formedness.test.ts`, `test/self/s9-typescript-well-formedness.test.ts`) and judge every draw through the property runner's `drawSources` hook. The header says `build`, `check`, and the mutating commands come in Task 47.

**Verify.** Against the built product: record P-14's outcome at the fixed seeds (a failure must be diagnosed, with its seed). A stand-in that, for a read naming a file, reports condition 20 at offset 0 when the file is missing fails the operand arm; show the flips actually reach the window by counting, per trial, reads that met the source absent and present (record). S-9 and S-7 pass as required. Record P-14's time and set its `timeoutMs`. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 47 — P-14's `build`, `check`, and mutating commands while a source flips (C-G2 part)

**Requirement.** P-14 (TEST-SPEC.md line 623), from "`build` and `check` are driven likewise": each run alone (no other xspec command beside it) from the workspace built quiescently with the source present, while it flips — `build`'s exit code, stdout, and the derived files and graph data it leaves together equal one quiescent `build`'s from that state with the source present or absent (H-6); `check`'s exit code and stdout equal one quiescent `check`'s; neither reports a `read-failure` for the vanished file or crashes. The mutating commands — a `rename` of a section in another file and `review create --strategy audit --name n`, each run alone on a fresh copy of that built workspace while the source flips — each run's exit code, stdout, and the files it leaves (sources, journal, session, derived files, graph data; the flipped paths aside; the lock path excluded per H-6) equal one quiescent run's from that state with the source present or absent; never a `read-failure` for the vanished file, never a crash.

**Change.** Extend P-14 (Task 46's module) with these arms; header and title updated to the complete property.

**Verify.** Built product: record outcomes at the fixed seeds (diagnosed, with seeds). Record times and re-set P-14's `timeoutMs`. S-7: diagnosed. Self project: the accepted red only.

**Done when.** The checks hold and the commit is pushed.

### Task 48 — E-6's exclusion probe on both legs (C-G4)

**Requirement.** E-6 (TEST-SPEC.md line 649), the sentences beginning "The `rename` is also the subset's exclusion probe": on both legs the journaled `rename` is first started with `--test-hold` (hold path outside the workspace) and, once held, killed — on Linux under T13.5-3's discipline (Task 8), on Windows by the platform's forced termination of that run and every process it started (no POSIX signal), its exit collected and every such process confirmed terminated; then `.xspec/lock` holds exactly one entry, a plain file; the `rename` is started again with `--test-hold`, takes the leftover over, and while it is held the file-form `move` runs under `--json` and exits 2 promptly, the hold still standing, `code` `"workspace-busy"`, `path` `".xspec/lock"`, modifying nothing, the held `rename`'s entry again the only entry; the hold lifted, the `rename` completes and the fixture proceeds, the `move` then run as before. The reuse check applies on both legs: a refusal of the second `rename` while a killed identifier is listed again voids the trial, rerun from a copy of the workspace taken before the kill, bounded, exhaustion a harness error; a refusal with none listed fails. `.xspec/lock` is absent after the `rename`, both journaled `move`s, `review create`, and the `resolve`. The refused `move`'s error document joins the documents compared across legs; the lock path lies outside every comparison across legs (H-6). E-2: the probe is part of the CI legs, never local-only.

**State at bb3081a.** `test/helpers/e6.ts` (`runE6RepresentativeFixture`, line 295) runs the journaled `rename` unheld; its final-tree snapshot excludes only `.git/` (line 285); the exchange (`writeE6Exchange`, `assertE6RunMatchesExchange`) carries the transcript and tree. Users: `test/suite/e6-exchange-writer.test.ts` (Linux) and `test/windows/e6-byte-identity.test.ts` (Windows); S-7's layer 4 runs the fixture against the stub.

**Change.** Add the probe to the shared fixture for both legs: on Windows, terminate with `taskkill /PID <pid> /T /F` (or an equivalent forced tree termination), enumerate the run's process tree before the kill and confirm each identifier gone after (e.g. through PowerShell's `Get-CimInstance Win32_Process`), and read Windows' process list for the reuse check; the pre-kill workspace copy for reruns; the error document into the transcript; `.xspec/lock` excluded from the tree snapshot and from every cross-leg comparison; the absences asserted. Both legs change together (the exchange format is shared).

**Verify.** Linux: the writer test against the built product — record its outcome (the built product keeps its lock in the temporary folder, so the probe fails diagnosed at the entry assertion); against the CONF-CORE reference it cannot run (the fixture needs surface CONF-CORE lacks) — instead, red/green the probe's mechanics with a stand-in modelling the entry. S-7 layer 4: still a diagnosed failure against the stub. Windows: only CI can run it — push, then read the Windows job's log (AGENTS.md's CI-reading bullet): it must fail exactly as the Linux leg does (both diagnosed) or pass where the Linux leg passes; a harness error there is a defect of this task. Self project: the accepted red only.

**Done when.** The checks hold, the Windows job's result is recorded, and the commit is pushed.

### Task 49 — The C-1 gate whole, and certification's time budget (D-1, D-14 closing)

**Requirement.** C-1 (TEST-SPEC.md line 630): for each fixture in CERTIFICATIONS.md, every in-scope test passes against the conformer and, for each violator, exactly the tests it certifies fail and all other in-scope tests pass; certification results are part of the harness's CI output. D-14's closing criterion: all 39 verifications green, every expected failure a diagnosed `fail` (0 error, 0 hang), in the harness-self CI job and in the local red-green gate (unprivileged, per AGENTS.md).

**State (expected after Tasks 1–48).** Every fixture implemented and wired; the manifest-mirror self-test the only red one (its diff showing at most order or wording).

**Change.**
- `test/self/certification-fixtures.ts` equals the document exactly: nine conformers and thirty violators in document order, each in-scope and certified set verbatim; each entry's deviation comment matches the document's current entry (the comments at bb3081a still describe the old NOLOCK, STALELOCK, and EARLYWRITE).
- `test/self/certification.test.ts`'s header ("all six conformers and all twenty-one violators") and any other stale count or description.
- Budget: measure the whole self project locally (through the wrapper) and in CI. If the harness-self job's time exceeds about 75% of its 20-minute `timeout-minutes` (`.github/workflows/ci.yml` line 66), either raise that timeout or split `certification.test.ts` per conformer family into separate files so Vitest runs the families in parallel — choose by measurement (the families' sustained intervals and kills must not overlap into flakiness; E-5), state the choice and the numbers in the commit, and record them in AGENTS.md. Also check that no verification nears `RUN_TIMEOUT_MS` (600 s).

**Verify.** Self project through the wrapper: 0 failures; certification lines summed and compared with the document by VERIFY's script — 0 discrepancies; run it twice for E-5 stability (LISTFIRST, CLAIM, and EARLYRELEASE must fail on both runs). CI on the pushed head (AGENTS.md's CI-reading bullet): harness-self green with the same certification lines.

**Done when.** The checks hold and the commit is pushed.

### Task 50 — Confirm locally and in CI; record the timings; delete this plan

**Depends on.** Every task above.

**Change and checks.**
- *Self project and certification.* Through the wrapper as `claude`, `NODE_OPTIONS` unset: 0 failures; the count in AGENTS.md's "Harness self-tests and certification only" bullet matches the run; certification lines 0 discrepancies against the document.
- *Suite against the built product.* Run the suite project alone in CI's whole inner stage (the wrapper recipe), with the JSON reporter: every failure must be a `HarnessAssertionError` (H-8) — list each failing test with its first failing arm in the commit message; T13.5-9, T13.5-10, and the other new tests must be among the diagnosed failures or passes, never errors. Compare with the per-task records the commits hold and explain any difference.
- *Windows leg.* From CI only: record its outcome; any failure must be diagnosed.
- *Timings.* Add this run's figures (self project, suite project, the slowest tests, CI's jobs) to AGENTS.md's timings bullet, in its style.
- *CI.* Before committing, check CI on the head the previous task pushed (wait for its run to complete): the harness-self job green; the full-suite job failing only on diagnosed product tests; the Windows leg's outcome recorded.
- *Delete this plan.* Once no other task remains in `specs/tmp/FIX_PLAN.md`, delete it with `git rm`, under the Preamble's "Deleting this plan" rule. If the permission system refuses, stop and report the refusal; never move, rename, or empty the file.

**Done when.** The checks hold, the commit message records them, the plan is deleted (or its refused deletion reported), and the commit is pushed.
