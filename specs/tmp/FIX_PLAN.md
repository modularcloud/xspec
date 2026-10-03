# FIX_PLAN — Phase 9 (test harness), re-descent iteration 82

Written 2026-10-03 at 44c5dad (branch `claude/xspec-ui-apis-4df8fa`, standing in for `patch/external-ui-apis`). It plans from the re-descent's second compliance determination, which was not clean. Its findings:
- compliance review A (TEST-SPEC's T1–T6 tests): 3 gaps;
- B (T7 and later): 1 gap;
- C (everything outside the T-numbered tests): 3 gaps;
- D (CERTIFICATIONS.md): 1 gap;
- VERIFY V: green — every harness self-test and every certification passes, locally and in CI.

Task headings cite the gaps as A1–A3, B1, C1–C3, and D1. Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tests Specified); no task changes its stage. No Bug Report applies.

Why the harness changed in this re-descent: the documents moved after the harness was last green (Phase 9 ended at 3bfedb5). The deltas are `git diff 3311ccd..6780f53 -- specs/TEST-SPEC.md`, `git diff 3311ccd..301f2f9 -- specs/CERTIFICATIONS.md`, and `git diff 9d095d9..f31e100 -- specs/SPEC.md`. Iteration 1's plan (f0d3cd9, 66 tasks) closed every gap the first determination found; 44c5dad deleted it. The eight gaps below predate this re-descent or were left by it, and none blocks on a spec defect.

## Preamble — read before any task

**Phase goal and scope guards (Phase 9).** The harness must adhere to `specs/TEST-SPEC.md` and `specs/CERTIFICATIONS.md`. Every harness self-test and every certification passes: each certified test passes against its conformer and fails against each of its violators exactly as the violator's entry states. Product tests may fail, but only as diagnosed assertion failures (H-8): never a harness error, crash, hang, or false pass. Never modify product code (`src/`; `dist/` is built from it). Every task is harness work under `test/` (fixtures under `test/fixtures/` are harness code), plus `AGENTS.md`'s build/run facts and this plan. A spec defect that blocks a task goes to the matching problems file under `specs/tmp/`, never into a silent workaround.

**Known state at 44c5dad (VERIFY, and CI run 37116437636, "run 854").**
- Self project, run as CI runs it (no network, uid 1000, no capabilities): 25 files, 4185 tests, all passing, 0 skipped.
- Certification: all 27 fixtures pass — CORE 1 conformer and 8 violators, VALID 1 and 3, MD 1 and 2, DISC 1 and 3, AVAIL 1 and 3, ORPHAN 1 and 2. The C-1 gate (`test/self/certification-document.test.ts`, "defines exactly 6 conformers and 21 violators") passes.
- Suite against the built product (CI, no network, unprivileged): 345 tests in 79 files; 317 pass and 28 fail, every failure a diagnosed product failure. The failing IDs: P-1, P-5, T1.4-1, T1.4-4, T4-2, T6.4-3, T6.5-4, T6.5-11, T6.5-20, T6.5-21, T6.5-22, T6.5-23, T6.6-3, T7-2, T7-6, T7.1-1, T7.3-1, T12.0-5, T12.0-10, T12.7-2, T13.4-9, T13.4-10, T13.4-11, T14-4, T14-6, T14-7, T14-11, and T14-12.
- Windows leg (E-6 subset): 3 files, 9 tests, green.
- `npm run typecheck` and `npm run format:check` pass; `dist/` matches a fresh compile of `src/`.
- No self-test reads TEST-SPEC.md, so a green self project does not by itself show compliance: each task carries its own checks.

**Run mechanics (AGENTS.md holds the recipes; read the bullets a task names before running anything).**
- Run the self project under the unprivileged namespace (`unshare --map-user=1000 --map-group=1000 -- npm run test:self` in this root sandbox; a plain non-root user needs no wrapper). AGENTS.md also records how to reproduce CI's no-network stage.
- Never run the self project, a certification run, and a suite run at the same time, and check the load first (another agent may share the machine). S-2's tower vector ("the largest document the suite stages — T1.3-7's 2048-deep chained-id tower") takes 2.3–2.9 s alone, and VERIFY saw it time out at Vitest's 5000 ms default only under concurrent load (load average about 11 on 4 cores). Such a timeout is not a task failure; rerun alone.
- One registered test: `-t '<ID> '`, with the trailing space and the dots escaped.
- One certification family: `npx vitest run --config test/vitest.config.ts --project self test/self/certification.test.ts -t <FAMILY>` (CORE, VALID, MD, DISC, AVAIL, ORPHAN).
- Red/green checks of a product test: AGENTS.md's stand-in wrapper and mutation recipes (a temporary `test/self/*.test.ts` calling `runProductTests`, deleted before committing). Red checks of a new self-test vector: AGENTS.md's stash-the-helper recipe.
- A fixed-seed replay of a property's draws: `drawFixedSeedTrials(<generator>, <runs>)` from `test/helpers/property.ts`; the fixed seeds are 271828183, 314159265, and 161803399 (E-5).
- Rebuild the product (`npm run build`) only if `dist/` is stale; `src/` does not change in this phase.

**Spellings.** Take every exact spelling — code points, escape-spelled literals, byte offsets, file contents — from the TEST-SPEC.md or CERTIFICATIONS.md line the task cites, never from this plan or the review reports. The reports' channel decoded escape spellings, and the tool-parameter layer decodes backslash-u spellings inconsistently in edit and Bash payloads, comments included. So this plan names code points as `U+XXXX` and spells no escapes. Build such spellings in code from code points and verify the staged bytes byte-wise (`od -c`, a sha256 compare).

**Conventions for changed tests.**
- *Registration.* No task adds a registered test. If a split task ever does, the new test goes into its registry module's exported list with its H-7 entry in `test/suite/registry/traceability.ts`, carrying `"14"` whenever it asserts a numbered condition or a stable refusal code.
- *S-9 timing.* A `.mdx` source that a body stages after its first product invocation, or in a workspace it creates after it, is a staged-source record (`test/helpers/staged-mdx.ts`, judged by `test/self/s9-staged-sources.test.ts`). A TypeScript code source or configuration file staged there is a `StagedTs` record (`test/helpers/staged-ts.ts`). Records register at module load only. The undeclared-staging guard refuses plain contents in those places. A new arm adds records, so the self-test's record count rises with it.
- *Never-modifies compares* use the compare-around machinery (`assertLeavesUnchanged` and `snapshotDirectory` in `test/helpers/snapshot.ts`).
- *Free text.* Corrections and other free-text checks use H-3's robust matching: required information only, never exact wording.
- *Product verdicts.* The built product (Phase 10's, at c62f451) predates the SPEC changes of this re-descent. A new or strengthened arm that fails against it counts as a diagnosed product failure only once a hand-staged probe shows the product's answer contradicts the asserted SPEC behavior. A harness error, crash, or hang is a harness defect to fix in the task. An arm that passes against the product proves nothing about its liveness, so red-check it (through a violator, a stand-in wrapper, or a mutation) wherever the task says so.
- *Every task ends with:*
  - `npm run typecheck` and `npm run format:check`;
  - the touched suite files against the built product;
  - the full self project under the namespace, with 0 failures (green at 44c5dad; keep it green);
  - a commit message stating the honest results, including each product test's outcome before and after;
  - removing the finished task from this plan in the same commit (iteration 1's convention: a done task leaves the plan).
- *AGENTS.md* gets only build/run knowledge a later spawn needs (a recipe, a count or timing a later check relies on), never a task narrative.

**Standing rulings.** Two rulings stand for this run: AGENTS.md's "Known residual 14.20 location gaps" and "Known SPEC 6.5 gap, deferred to a future SPEC revision" bullets. No task here addresses them, and none may be added for them.

**Considered and not planned (do not re-raise).**
- The note from iteration 1's Task 19 (a40ce14): S-9 lists five allowances, none for a strict-mode-barred import binding such as `import let`, which T6.5-22 declares derivable. It is latent: no fixture stages such a file (reviewers A and C).
- Reviewer D's note on VIOL-DISC-DERIVED in T7-6: its code-side arm fails at the arm's own `build`, earlier than CERTIFICATIONS.md's narrative says, consistently with the document. It is a matter for a future revision of that document; the harness meets every stated staging constraint.
- The Phase 7 round-3 driver's note on VIOL-ORPHAN-THROUGHLINK (directory components resolve only through links whose target directory lies inside the workspace root): implemented and certified; reviewer D's arm-isolation experiment confirmed it.
- The header comment of `traceability.ts` lists only four refusal-reason staging tests; the map itself is complete (reviewer C). A task touching that file may fix the comment; no task is planned for it.
- P-6 drives only the file form of `move`, and P-9 uses only audit sessions; TEST-SPEC's wording does not clearly require more (reviewer C).

**Order.** Tasks are in dependency order, and each names what it depends on:
- Part A (Task 1, the certification gap D1): done and removed.
- Part B (harness machinery): done and removed. Tasks 3 and 4 gave S-9's MDX judgement spec-group files not named `.mdx` — Task 3 the mechanism (`mdx.wellFormed` and the other `mdx` lists, the `file()` `mdx` option, or an MDX record at the path declare such a file an MDX source; module header of `test/helpers/workspace.ts`), Task 4 the declarations of the suite's three such files (T7.1-1's `specs/notes.txt` and T11.6-2's `specs/note.txt` as staged-source records, T11.6-4's under `mdx.wellFormed`). Task 2 (P-8's and P-11's capture-limit errors) and Task 2b, split from it (every other conversion of a driver rejection), are done and removed: H-11's capture-limit errors.
- Part C (Tasks 5–9): the T-numbered tests, in TEST-SPEC order. Task 5 (T4.3-2's seven dynamic node-form arms each run `occurrences` on the failing workspace and assert no record) is done and removed. Task 6 (every T4.5-3 arm runs `occurrences --file src/app.ts` on its failing workspace and asserts no record, through `assertArmFailsWith`'s opt-in `noOccurrence` option, which T4.5-5 does not pass) is done and removed. Task 7 (T4.5-3's arm table gains TEST-SPEC's pinned optional-chaining spelling `SPEC?.a;`, optional on the root binding, over the shared `a`/`a.b` source; the extra arms `SPEC.a?.b;`, `SPEC.a!.b;`, and `(SPEC.a).b;` stay) is done and removed. Task 8 (T5.5-2's kind-distinction arm restaged in-line: `foo <S id="p.k">Kid text.</S> baz` at the baseline, `foo {text(B.k)} baz` after the journaled move, both composed by `kindParent` from one line head and tail, with `p`'s subtree text anchored in both states) is done and removed. Task 9 (T13.4-10's correction judged by the pure `judgeManualDeletionCorrection` in `test/helpers/adapters/human.ts`: a manual marker beside a deletion word, or an instruction to the reader to delete or remove the file, accepted; a build or xspec presented as the remover, unless negated, rejected; S-5's "correction judge" vectors) is done and removed.
- Part D (Tasks 10–13): P-8's command sweep. Task 10 is done and removed: `section-16-p8.ts` exports `COMMAND_MENU` and `P8_RUNS_PER_SEED` (12, which `P_8` passes), and `test/self/p8-fixed-seed-draws.test.ts` replays `drawFixedSeedTrials(genFuzzTrial, P8_RUNS_PER_SEED)` and asserts that an MDX section tower at least `GIANT_NESTING_FLOOR` deep is staged intact (TypeScript towers and towers a later mutation undid never count) and that every `COMMAND_MENU` form is drawn (AGENTS.md's "P-8's fixed-seed draw guard" bullet has the recipe and today's draws). Task 11 is done and removed: `COMMAND_MENU` gained eleven read-surface forms (31 in all) — `query reachable --from specs/B.mdx#b --to specs/A.mdx#a` with and without `--json`, `occurrences` unfiltered and under `--file specs/B.mdx`, `view specs/A.mdx`, `view specs/B.mdx --text`, `at specs/A.mdx <offset>` (the offset computed from the base bytes, inside `{text("a.b")}`), and `inventory` and `version` with and without `--json`; `runFuzzArm` holds every invocation for which `jsonOutputInEffect` holds (SPEC 12.0's reading: `--json` read as a flag, or a JSON-only surface, `review export` already among them for Task 12) to `assertJsonOutputConvention`, the rest to the exit partition; the guard self-test gained a fourth test pinning that reading and that every JSON-only surface the menu holds has a form without `--json`; and P-8's per-invocation hang guard is 60 s, its kill unshrunk (AGENTS.md's answer-scale bullet has the derivation and the re-measure recipe).
- Task 14 confirms the result and deletes the plan.

Take the topmost task unless told otherwise. A task too large for one spawn may be split by inserting follow-up tasks directly after it; never drop a requirement.

## Tasks

### Part D — P-8's command sweep

**Shared requirement for Tasks 10–13 (C1).**
- TEST-SPEC §16 P-8: on "mutated MDX/TS/config" inputs, "every command terminates, never emits a partial JSON document on `--json`, and always exits 0, 1, or 2 per the 12.0 partition; `build` failures modify nothing", and its giant-nesting draws "MUST include section nesting at least 2048 levels deep".
- CERTIFICATIONS.md reads P-8 the same way. Its Exclusions say "P-8 sweeps every command", and its T6.1-1 note calls "every command surface — `occurrences`, `view`, `at`, `inventory`, `version`, and the previews of 6.6 among them" "P-8's scope argument".
- `COMMAND_MENU` in `test/suite/registry/section-16-p8.ts` (about L370) holds 31 forms since Task 11 (20 before), all drawn by the fixed CI seeds from 10 runs per seed up: 129 picks at 12 leave little slack, so Tasks 12 and 13 should expect to raise the per-trial command count or weight the pick, and then re-check the floor. The gap as found — never run on P-8's inputs (Task 11 closed the first six): `inventory`, `version`, `query reachable`, `occurrences`, `view` (with and without `--text`), `at`, `review status`/`show`/`split`/`resolve`/`export`, `rename --preview`, `move --preview`, and the section form of `move`.
- P-11 drives `occurrences`, `view`, and `at` over P-8's source mutations only, never over a mutated configuration, so it does not cover them here.

**Shared mechanics.**
- A trial draws its mutations, then its commands: `listOf(pick(COMMAND_MENU))`, 2 to 4 per trial, run after the fixed `build --json` arm (`genFuzzTrial`, about L1261).
- Each seed's trials are one sequential PRNG stream. `pick` consumes one PRNG value whatever the menu's length, so adding menu forms changes only which forms the existing picks land on, never the mutation draws; raising the per-trial command count or weighting the pick does move every later trial of a seed, including the one that meets the 2048 floor (today seed 161803399, trial 9: "specs/A.mdx: replace with a depth-2048 unclosed section tower").
- `P_8` registers 12 runs per seed with a 420 s `timeoutMs`, a hang guard only (H-10). Each invocation's own hang guard is `FUZZ_COMMAND_TIMEOUT_MS` (60 s since Task 11), derived in its comment from the largest answer a menu form admits over a P-8 draw; re-derive it if a new form answers at a larger scale.
- Every new form runs under `runFuzzArm`'s assertions. Argument values name base-workspace nodes and files; after mutation they may no longer exist, a legitimate exit 2 (12.0). Take each command's grammar from SPEC (6.4, 6.5, 6.6, 10.7, 11.1, 11.3–11.6, 12.0, 12.6), never from this plan.
- *Every Part D task's checks*, beside the general ones:
  - Task 10's guard passes (`test/self/p8-fixed-seed-draws.test.ts`), P-8's own draws hitting every menu form and the floor. If the fixed seeds miss a form, raise the per-trial command count or weight the pick; never weaken the guard.
  - P-8 alone against the built product, timed under the namespace, within its `timeoutMs` with clear headroom. Adjust `timeoutMs` if needed and record the timing in AGENTS.md's section-16 property-timings bullet.
  - S-7's sweep stays green.
  - P-8 passes against the built product (it did at 44c5dad), or fails only as a diagnosed failure that a hand-staged probe confirms. A harness error is a defect to fix in the task.

### Task 12 — P-8 sweeps the review surfaces that need a session and an item (C1, part 3; TEST-SPEC §16 P-8; SPEC 10.1–10.3, 10.7, 12.0)

**Depends on.** Task 11, for the by-surface JSON rule that `review export` needs.

**Change.**
- Add `review status`, `review show`, `review split`, `review resolve`, and `review export` to P-8's sweep, each with and without `--json` (12.0: "Every command supports `--json`"; `export` is JSON-only, 10.7).
- `show`, `split`, and `resolve` need a session and an item. A form drawn independently of `review create` would only ever test the no-session usage error. So run each such form as one composite arm, each step under `runFuzzArm`'s assertions:
  1. `review create --strategy audit --name <session> --json`;
  2. a read that yields an item id (`review next <session> --json` or `review status`), decoded through the existing review adapter (`test/helpers/adapters/`);
  3. the drawn command on that item.
  When the read yields no item (the create failed on the mutated workspace, or the session holds none), use a fixed item id the session lacks: a legitimate usage error (12.0). `review resolve` takes a `--status` from 10.3's set.
- `review status` and `review export` over a created session may use the same composite, or the static menu with the menu's existing session name.
- Render each composite readably in the counterexample (`renderFuzzTrial`), so a falsified trial names every invocation it ran.

**Checks.**
- Part D's shared checks.
- The fixed seeds reach the item path, not only the usage error: on at least one fixed-seed trial, the read yields an item and the drawn command runs on it. Show this in a scratch replay against the built product and record it in the commit message.

### Task 13 — P-8 sweeps the previews and the section form of `move` (C1, part 4; TEST-SPEC §16 P-8; SPEC 6.4, 6.5, 6.6, 12.0)

**Depends on.** Task 11.

**Change.** Add, each with and without `--json` (previews support `--json` per 6.6 and are not JSON-only):
- `rename <file> <old-id> <new-id> --preview` over the menu's existing rename (`specs/A.mdx`, `c` to `c2`);
- `move <old-file> <new-file> --preview` over the existing file move (`specs/B.mdx` to `specs/moved.mdx`);
- the section form `move <file>#<id> <target-file>#<new-id>`, performed and with `--preview`, over a base-workspace section and a target file the base holds or one it lacks (6.5 creates the target file).

`--test-hold` never appears (6.6: with `--preview` it is a usage error, and P-8 drives no seam).

**Checks.**
- Part D's shared checks.
- Once all of Tasks 10–13 have landed, list in the commit message every SPEC command and form P-8 now draws, against the gap's list above; none may remain undrawn.

### Final

### Task 14 — Confirm locally and in CI; delete this plan

**Depends on.** Every task above.

**Change.**
- Under the namespace, run the full self project alone: expect 0 failures. Update AGENTS.md's self-project file and test counts and its certification totals (still 6 conformers and 21 violators, 27 fixtures, every one passing).
- Then run the suite project against the built product, alone. Every failure must be a diagnosed product failure. List each failing test with its first failing arm in the commit message, and compare the list with the 28 IDs recorded above: say which tests changed outcome and why.
- Record S-2's tower-vector timing in AGENTS.md (2.3–2.9 s alone at 44c5dad, against Vitest's 5000 ms default; it timed out only under concurrent load) if no bullet records it yet. VERIFY could not record it.
- Check CI on the pushed head: the harness-self job and the Windows leg are green; the full-suite job fails only on diagnosed product tests.
- Delete `specs/tmp/FIX_PLAN.md` once no other task remains in it.
