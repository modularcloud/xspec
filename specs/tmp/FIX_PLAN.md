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
- Part B (Tasks 3–4): harness machinery — S-9's MDX judgement of spec-group files not named `.mdx`. Task 2 (P-8's and P-11's capture-limit errors) and Task 2b, split from it (every other conversion of a driver rejection), are done and removed: H-11's capture-limit errors.
- Part C (Tasks 5–9): the T-numbered tests, in TEST-SPEC order.
- Part D (Tasks 10–13): P-8's command sweep.
- Task 14 confirms the result and deletes the plan.

Take the topmost task unless told otherwise. A task too large for one spawn may be split by inserting follow-up tasks directly after it; never drop a requirement.

## Tasks

### Part B — Machinery

### Task 3 — S-9 judges a spec-group file not named `.mdx` as an MDX source when the staging declares it one (C2, part 1: the mechanism; TEST-SPEC §17 S-9; SPEC 14.20, 14.19, 7.1)

**Depends on.** Nothing. Task 4 uses it.

**The requirement.** S-9: "Every MDX source this document declares well-formed — each deterministic fixture's files … — derives under the grammar 14.20 fixes … checked … before any product exists". SPEC 14.20 judges "a spec-group file that is not well-formed MDX" whatever its name. A spec-group match without `.mdx` is invalid (7.1, 14.19) but still a spec-group file, and 11.2 keeps an invalid-path file's parse-local structure, so its content is an MDX source. The harness decides MDX-ness by name alone:
- `isMdxPath` in `test/helpers/workspace.ts` (about L1335): "it ends in `.mdx`".
- A staged-source record at a non-`.mdx` path is refused (about L665: "a path S-9 does not judge takes plain contents").

No declaration can name another path as an MDX source, unlike code sources, which have `ts.wellFormed`. Today three spec-group files are never judged (Task 4).

**Where.** `test/helpers/workspace.ts`:
- `isMdxPath` and its call sites (about L546, 623, 665, 736, 923, 938, 969, 1369, 1432): the four stagings `create()`, `file()`, `edit()`, and `copyFrom()`; the staging-time judge (`judgeMdxDeclaration`); the record check; the undeclared-staging guard;
- the workspace-level `mdx` declaration type and the per-`file()` `mdx` option (about L250–330);
- the module header's S-9 paragraphs (about L40–100).

Also `test/helpers/staged-mdx.ts` and `test/self/s9-staged-sources.test.ts` if records need to carry the path's MDX-ness.

**Change.**
- Add a declaration that makes a path an MDX source whatever its name, the MDX analogue of `ts.wellFormed`. For example, a workspace `mdx` entry or a `file()` option naming the path, with the same three verdicts as an `.mdx` path (well-formed, unparseable, unchecked). The name is your choice.
- Let a staged-source record stand at such a path: the record carries the declaration, or the path is declared beside it. The builder's staging-time judge must apply to these paths exactly as to `.mdx` paths. So must the undeclared-staging guard: plain contents at a declared path after a product invocation are refused.
- Undeclared non-`.mdx` paths stay unjudged, as now.
- Document the declaration in the module header next to `ts.wellFormed`.

**Checks.**
- New self-test vectors (in the S-2 builder self-tests or the S-9 self-tests, wherever the `.mdx` vectors for the same judge live):
  - an ill-formed non-`.mdx` spec-group file declared well-formed is refused with `HarnessStagingError` (mode `mdx-derivability`), never staged;
  - a well-formed one is staged byte-exact;
  - one declared unparseable but deriving is refused;
  - plain contents at a declared path after a product invocation are refused by the undeclared-staging guard.
- Red-check the vectors with AGENTS.md's stash-the-helper recipe: with `workspace.ts` stashed, the first vector fails.
- Every existing staging is unchanged: the full self project is green.

### Task 4 — Declare the three non-`.mdx` spec-group files the suite stages as MDX sources (C2, part 2: the declarations; TEST-SPEC §17 S-9, T7.1-1, T11.6-2, T11.6-4)

**Depends on.** Task 3.

**The files.** Each is a spec-group match without `.mdx`, and each derives today, but nothing checks it. An ill-formed content would surface as a false product failure (an extra 14.20 beside the asserted findings).
- **T7.1-1's `specs/notes.txt`**: `mdxSection("n")`, in `test/suite/registry/section-7.1-7.3.ts` (about L931; the workspace with `NON_MDX_MATCH_CONFIG`). TEST-SPEC: "a spec-group match without `.mdx` → 14.19", and the arm asserts exactly `{"14.19": 1}`, so the file must be well-formed. It is staged plain, after the body's first product invocation.
- **T11.6-4's `specs/note.txt`**: one line of French prose ("pas une source xspec" and a line feed), in `test/suite/registry/section-11.6.ts` (about L2439, arm A's imperfect workspace). The body's premise `build --json` must report exactly one finding per staged construct (`IMPERFECT_PREMISE_CONDITIONS`, about L2287–2300), so the file must be well-formed.
- **T11.6-2's `specs/note.txt`**: the same content, in the same file (about L1232). `inventory` parses no sources (11.6), so declare it well-formed, or explicitly undeclared (`unchecked`) with a comment saying why.

**Change.**
- T7.1-1: stage `specs/notes.txt` as a staged-source record registered at module level, declared well-formed through Task 3's mechanism. `test/self/s9-staged-sources.test.ts` then judges it before any product exists. Keep the arm's bytes unchanged: move the expression, never re-spell it.
- T11.6-4 and T11.6-2: declare each `specs/note.txt` through Task 3's mechanism. Use a record wherever the workspace is created after a product invocation in the body, since the guard now applies there.
- Keep every assertion unchanged.

**Checks.**
- `test/self/s9-staged-sources.test.ts` passes, with its record count up by the new records.
- A red check per file: temporarily give its content an ill-formed line, for example an unclosed `<S id="n">`. Staging, or the ledger self-test for a record, must refuse it as a harness error before the product runs. Then restore it byte-for-byte.
- T7.1-1, T11.6-2, and T11.6-4 against the built product: outcomes unchanged. At 44c5dad T7.1-1 fails diagnosed (CI run 854), and T11.6-2 and T11.6-4 pass.

### Part C — The T-numbered tests

### Task 5 — T4.3-2: each dynamic node-form arm records no occurrence (A1; TEST-SPEC §4.3 T4.3-2, L172; SPEC 4.3, 5.7, 11.2, 11.3)

**Depends on.** Nothing.

**The requirement.** TEST-SPEC L172 lists the dynamic node-form arguments of `text` in a TypeScript file:
- a computed index by variable;
- a computed index by template literal;
- an optional-chaining chain;
- `text(SPEC.a!)`, `text(SPEC.a as X)`, `text(<X>SPEC.a)`, and `text(SPEC.a satisfies X)`.

It says of them: "each 14.8 located at the call (T14-11), no edge, no occurrence, the file well-formed". `T4_3_2` asserts only `build --json`'s exact `{"14.8": 1}` and the finding's location. So a product that reports the 14.8 and also records an occurrence for, say, `text(SPEC.a!)` passes. The engineer of iteration 1's Task 26 (8d5071b) flagged this for T4.3-2 and T4.5-3 and left it out of scope.

**Where.** `test/suite/registry/section-4.3-4.4.ts`:
- `T4_3_2_ARMS` (about L368–495) and `T4_3_2` (about L509);
- `occurrencesOnFailingWorkspace` (about L726), which T4.4-1 already uses;
- T4.4-1's resolving-argument arms (about L860–1000) as the pattern.

**Change.**
- Mark the seven dynamic node-form arms in the table. In each, after the `build --json` assertions, run `occurrences --file src/app.ts` on the same failing workspace. Assert:
  - exit 1, the full answer still emitted (11.2);
  - its findings exactly `{"14.8": 1}`, that finding located as `build`'s is;
  - an empty record list.
  `occurrencesOnFailingWorkspace` runs `occurrences` unfiltered; either domain gives the same verdict here, since the spec source holds no reference.
- Leave the string-argument arm and the two arity arms (zero-argument and two-argument calls) as they are. TEST-SPEC's "no edge, no occurrence" clause attaches to the dynamic node-form list. SPEC 5.7 lets an invalid call whose argument resolves record its occurrence beside its finding (the cross-module call of 14.11), so asserting none for `text("a")` would go beyond the document.
- Extend the test's title to state the no-edge, no-occurrence check for the dynamic arms.

**Checks.**
- T4.3-2 against the built product: record the outcome; it passed at 44c5dad.
- A red check through AGENTS.md's stand-in wrapper: rewrite the `occurrences` answer of one dynamic arm to carry a record (an `embeds` record spanning the call, target `specs/A.mdx#a`); T4.3-2 fails diagnosed on that arm.

### Task 6 — T4.5-3: every arm records no occurrence (A2(a); TEST-SPEC §4.5 T4.5-3, L183; SPEC 4.5, 5.7, 11.2, 11.3)

**Depends on.** Nothing.

**The requirement.** TEST-SPEC L183: "A non-static bare reference in expression-statement position fails with 14.8 …, located as the statement's expression exclusive of its terminator (T14-11), no edge and no occurrence". `T4_5_3` (about L976) runs each arm through `assertArmFailsWith` (about L364), which checks only the condition count and the location.

**Where.** `test/suite/registry/section-4.5.ts`:
- `T4_5_3_ARMS`, `T4_5_3_STAGINGS`, and `T4_5_3` (about L870–985);
- `assertArmFailsWith`, which T4.5-5 shares (about L1469, with 14.18);
- T4.5-8's `occurrences --file src/app.ts` check (about L2016–2050) as the pattern.

**Change.**
- In every T4.5-3 arm, after the `build --json` assertions, run `occurrences --file src/app.ts` on the same failing workspace. Assert:
  - exit 1, the full answer emitted (11.2);
  - findings exactly `{"14.8": 1}`, located as `build`'s;
  - an empty record list.
  This covers every arm, the harness's extra arms included (`SPEC.a?.b;`, `SPEC.a!.b;`, `(SPEC.a).b;`): each is a non-static bare reference in expression-statement position, and the clause attaches to all such references.
- Scope the change to T4.5-3: T4.5-5's 14.18 arms have no such clause in TEST-SPEC. Use a T4.5-3-only wrapper or an opt-in parameter; T4.5-5's behavior stays byte-for-byte the same.
- Extend the title to state the no-edge, no-occurrence check.

**Checks.**
- T4.5-3 and T4.5-5 against the built product: record both outcomes; both passed at 44c5dad.
- A red check through the stand-in wrapper: a record injected into one arm's `occurrences` answer makes T4.5-3 fail diagnosed.

### Task 7 — T4.5-3: add TEST-SPEC's optional-chaining spelling `SPEC?.a;` (A2(b); TEST-SPEC §4.5 T4.5-3, L183; SPEC 2.4, 4.5, 14.8)

**Depends on.** Task 6, so the new arm carries the no-occurrence check.

**The requirement.** TEST-SPEC pins the optional-chaining arm as `SPEC?.a;`, optional on the root binding. The harness stages `SPEC.a?.b;` instead, plus the extra arms `SPEC.a!.b;` and `(SPEC.a).b;`. Take the spelling from L183.

**Change.**
- Add an arm to `T4_5_3_ARMS` whose `src/app.ts` is the T4.5-3 import, a blank line, and `SPEC?.a;`, over the shared `AB_SPEC_FILES` (`specs/A.mdx` holding `a` and `a.b`), so the chain would resolve if read statically.
- It asserts what every arm asserts: exactly one 14.8, located within the statement, and (Task 6) no occurrence.
- Keep the extra arms. Add the spelling to the title's list. The new staging is a module-load record like its siblings (`stageOffendingStatements`).

**Checks.**
- `test/self/s9-staged-sources.test.ts` passes, with one record more.
- T4.5-3 against the built product: record the new arm's outcome. A failure counts only after a hand-staged probe shows the product's answer contradicts SPEC 4.5 and 14.8 for `SPEC?.a;`.

### Task 8 — T5.5-2: restage the kind-distinction arm in-line, as TEST-SPEC's fixture geometry requires (A3; TEST-SPEC §5.5 T5.5-2, L217; SPEC 1.6, 3, 5.4, 5.5, 5.6, 6.5)

**Depends on.** Nothing.

**The requirement.** TEST-SPEC L217, added at 46a6aed (Phase 6 finding O2) and never staged:
- "a child construct is replaced at its exact position by a `text(...)` embedding of the same canonical identity with identical surrounding bytes — journaled-move the child section to another file, then embed the moved node (imported form) at its former position";
- "Fixture geometry: the child construct and its replacement are in-line — within one line, flanked by content on that line (`foo <S id="c">…</S> baz` at baseline, `foo {text(X.c)} baz` after)".

L217 says why: on its own line, a construct's straddling lines drop with their terminators (3), while an own-line `{text(...)}` keeps its line. The runs would then differ too, and the arm would pass vacuously.

The harness's staging is the own-line shape L217 rules out:
- `KIND_BASELINE` (about L467) puts the child `p.k` on its own three lines between `before` and `after`.
- `KIND_MANUAL` (about L480) glues the replacement onto the next line as `{text(B.k)}after`. That is not flanked by content on both sides, and the bytes around it differ: the newline after `</S>` is gone.

**Where.** `test/suite/registry/section-5.5.ts`: `KIND_BASELINE`, `KIND_MANUAL`, the comment above them (about L455–466), and the kind arm in `T5_5_2`'s body (about L654–735).

**Change.**
- *Baseline.* `p` holds one in-line line of the TEST-SPEC shape: content, the child construct, content, all on one line. For example `foo <S id="p.k">Kid text.</S> baz`, with the child's identity satisfying 1.3 as `p`'s child, as `p.k` does today.
- *After the move.* After the journaled `move specs/A.mdx#p.k specs/B.mdx#k` (unchanged), the manual state is the same line with the construct replaced at its exact position by the imported-form embedding: `foo {text(B.k)} baz`. Every other byte of `p` is identical. The import `import B from "./B.xspec"` stands at the file's top, outside `p`, as now.
- Keep every existing assertion: `p`'s ownHash differs from baseline; `impact --base <baseline>` reports `p` as `changed`; `p` is never reported deleted.
- Rewrite the comment to state the in-line geometry and why it matters (L217).
- Both stagings stay staged-source records.

**Checks.**
- `test/self/s9-staged-sources.test.ts` passes: both new stagings derive.
- Hand-probe the built product on both states (`query node specs/A.mdx#p` before and after) and record the two ownHash values. T5.5-2 against the built product: record the outcome; it passed at 44c5dad. A failure counts only as a diagnosed product failure, after the probe.
- A red check through the stand-in wrapper: answer the after-state `query node` for `p` with the baseline's ownHash, which is what a kind-blind product would give. T5.5-2 then fails diagnosed on the kind arm.

### Task 9 — T13.4-10: the manual-deletion correction is matched for its information, not its wording (B1; TEST-SPEC §13.4 T13.4-10, L563, with §0 H-3; SPEC 14.10)

**Depends on.** Nothing.

**The requirement.**
- T13.4-10: `check`'s condition-10 recorded-file finding concerning `out/specs/A.md` has "the file's manual deletion, never a rebuild" as its correction, "asserted by H-3's robust matching".
- H-3: human reports are asserted "only for required information (via robust matching), never exact wording".
- SPEC 14.10 states the correction as "its manual deletion".

The harness's matcher requires a deletion or removal word and also one of three markers: "manual", "by hand", or "yourself". So a conforming finding that tells the reader to delete the file in plain imperative form fails the test. Reviewer B ran it on these messages, and each fails only for want of a marker:
- "…; delete it, then rebuild";
- "Delete out/specs/A.md: it … obstructs the rebuild's write of out/specs/A.md/specs/A.md";
- "…; remove it (a rebuild is refused while it obstructs …)".

The engineer of iteration 1's Task 58 (dd68bfe) flagged this risk. Neither the built product's message nor any certification depends on it.

**Where.** `test/suite/registry/section-13.4.ts`:
- `MANUAL_DELETION_MENTIONS` (about L3058);
- `REBUILD_REMEDY` (about L3070);
- `assertManualDeletionCorrection` (about L3082, called about L3252);
- the module header's account of the check.

**Change.**
- *Accept* either form as the required information:
  - an explicit manual marker beside a deletion or removal word (today's rule); or
  - an instruction to the reader to delete or remove the file: a clause opening with "delete" or "remove" (any case), at the message's start or after a clause boundary (`;`, `:`, `.`, `,`, an em dash, "then", "and", "please"), naming the path `out/specs/A.md`, "it", or "the file".
- *Reject*, as now, every clause that presents a build as what removes the file (`REBUILD_REMEDY`). Extend the rejection to xspec itself presented as the remover, e.g. "xspec will remove it", "xspec removes it", "removed by xspec".
- Make the matcher a pure exported function (in the module or a helper under `test/helpers/`) that a self-test can drive. Update the module header.

**Checks.**
- New fixed vectors under `test/self/` drive the matcher. Write complete messages, not the reviewers' elisions:
  - *Accept:* the three imperative phrasings above, and manual ones such as "delete out/specs/A.md manually", "remove it by hand", "delete the file yourself".
  - *Reject:* "run `xspec build` to remove it", "rebuild; xspec will remove out/specs/A.md", "rebuilding removes it", and a message with no deletion instruction at all.
- Red-check the vectors with the stash-the-helper recipe: today's matcher fails the imperative accept vectors.
- T13.4-10 against the built product: it fails diagnosed at 44c5dad, and the product's message ("run `xspec build` to remove it") must still be rejected. Record the first failing arm before and after; it must not move to a different arm for a harness reason.

### Part D — P-8's command sweep

**Shared requirement for Tasks 10–13 (C1).**
- TEST-SPEC §16 P-8: on "mutated MDX/TS/config" inputs, "every command terminates, never emits a partial JSON document on `--json`, and always exits 0, 1, or 2 per the 12.0 partition; `build` failures modify nothing", and its giant-nesting draws "MUST include section nesting at least 2048 levels deep".
- CERTIFICATIONS.md reads P-8 the same way. Its Exclusions say "P-8 sweeps every command", and its T6.1-1 note calls "every command surface — `occurrences`, `view`, `at`, `inventory`, `version`, and the previews of 6.6 among them" "P-8's scope argument".
- `COMMAND_MENU` in `test/suite/registry/section-16-p8.ts` (about L309) holds 20 forms, and the fixed CI seeds draw exactly those. Never run on P-8's inputs: `inventory`, `version`, `query reachable`, `occurrences`, `view` (with and without `--text`), `at`, `review status`/`show`/`split`/`resolve`/`export`, `rename --preview`, `move --preview`, and the section form of `move`.
- P-11 drives `occurrences`, `view`, and `at` over P-8's source mutations only, never over a mutated configuration, so it does not cover them here.

**Shared mechanics.**
- A trial draws its mutations, then its commands: `listOf(pick(COMMAND_MENU))`, 2 to 4 per trial, run after the fixed `build --json` arm (`genFuzzTrial`, about L1178).
- Each seed's trials are one sequential PRNG stream, so a menu change can move later draws, including the trial that meets the 2048 floor (today seed 161803399, trial 9: "specs/A.mdx: replace with a depth-2048 unclosed section tower").
- `P_8` registers 12 runs per seed with a 420 s `timeoutMs`, a hang guard only (H-10).
- Every new form runs under `runFuzzArm`'s assertions. Argument values name base-workspace nodes and files; after mutation they may no longer exist, a legitimate exit 2 (12.0). Take each command's grammar from SPEC (6.4, 6.5, 6.6, 10.7, 11.1, 11.3–11.6, 12.0, 12.6), never from this plan.
- *Every Part D task's checks*, beside the general ones:
  - Task 10's guard passes, P-8's own draws hitting every menu form and the floor. If the fixed seeds miss a form, raise the per-trial command count or weight the pick; never weaken the guard.
  - P-8 alone against the built product, timed under the namespace, within its `timeoutMs` with clear headroom. Adjust `timeoutMs` if needed and record the timing in AGENTS.md's section-16 property-timings bullet.
  - S-7's sweep stays green.
  - P-8 passes against the built product (it did at 44c5dad), or fails only as a diagnosed failure that a hand-staged probe confirms. A harness error is a defect to fix in the task.

### Task 10 — Guard P-8's own fixed-seed draws: the 2048 floor and every menu form (C1, part 1; TEST-SPEC §16 P-8, §17 S-8, E-5)

**Depends on.** Nothing. Land it before Tasks 11–13, so it catches any draw shift they cause.

**The gap.** The only floor guard is S-8's E-5 replay in `test/self/s8-answer-scale-capacity.test.ts` ("S-8: the fixed CI seed set stages within the derived scale (E-5 replay)", about L233–258). It replays 25 runs per seed (`DEFAULT_RUNS_PER_SEED`) and pools P-11's draws (`genAvailabilityTrial`) with P-8's. So it would not notice if the floor left P-8's registered 12 runs per seed, and nothing checks that the fixed seeds draw every menu form.

**Where.** `test/suite/registry/section-16-p8.ts`: the `runs: 12` literal in `P_8`'s `checkProperty` options, and `COMMAND_MENU`. The S-8 test file above, or a new `test/self/` file.

**Change.**
- Export P-8's registered run count as one constant, used by `P_8` itself, and export `COMMAND_MENU`.
- Add a self-test that replays `drawFixedSeedTrials(genFuzzTrial, <that constant>)`, P-8's draws alone. Assert:
  - the deepest staged tower among them (the `depth-<n>` mutation descriptions, as S-8 reads them) is at least `GIANT_NESTING_FLOOR` (`test/self/staged-scale.ts`);
  - every `COMMAND_MENU` entry is drawn at least once.
- Keep S-8's pooled replay for the capacity maxima unchanged.

**Checks.**
- The new test passes at today's menu.
- A red check of each assertion on its own, then restore:
  - Lower the replay run count until no fixed-seed draw reaches 2048, and confirm by the replay itself; the floor assertion fails.
  - With 1 run per seed, the three trials draw at most 12 of the 20 forms; the coverage assertion fails.

### Task 11 — P-8 sweeps the read surfaces, and the JSON-only rule applies by surface (C1, part 2; TEST-SPEC §16 P-8, §0 H-5; SPEC 11.1, 11.3–11.6, 12.0, 12.6)

**Depends on.** Task 10. (Task 2, done and removed, gave `runFuzzCommand` H-11's semantics: it converts only the hang-guard kill, and an exhausted capture limit propagates as a harness error.)

**Change.**
- Add to `COMMAND_MENU`:
  - `inventory` and `version`, each with and without `--json`;
  - `query reachable --from <a> --to <b>` over base-workspace nodes joined by a dependency path (for example `specs/B.mdx#b` to `specs/A.mdx#a`), with and without `--json`;
  - `occurrences`, unfiltered and with `--file` over a base file;
  - `view <file>` and `view <file> --text` over a base spec source;
  - `at <file> <offset>` with an in-range offset of a base file. An offset past a mutated file's end is a legitimate usage error (11.5, 12.0).
- In `runFuzzArm`, apply `assertJsonOutputConvention` (`test/helpers/assertions.ts`) to every invocation with `--json`, and to every invocation of a JSON-only surface with or without it. Per SPEC 12.0, JSON output is in effect for a JSON-only surface: on exit 0 or 1, stdout is one complete JSON document; on exit 2, it is the 12.7 error document. The JSON-only surfaces are `query`, `occurrences`, `view`, `at`, and `inventory` (11), `version` (12.6), and `review export` (10.7). Keep `assertExitPartition` for the rest.
- Give at least one form per JSON-only surface without `--json` (for example a `query nodes` form), so the by-surface rule is exercised.
- Update the module header's list of assertions.

**Checks.**
- Part D's shared checks.
- A red check of the by-surface rule: a stand-in wrapper that appends a stray byte to `version`'s stdout when no `--json` is given makes P-8 fail diagnosed on a trial drawing that form.

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
