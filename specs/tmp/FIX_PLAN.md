# FIX_PLAN — Phase 9 (test harness), re-descent iteration 156

Written 2026-10-07 at 34032b5 (branch `claude/xspec-ui-apis-4df8fa`, standing in for `patch/external-ui-apis`). It plans from the re-descent's eighth compliance determination, which was not clean. Its findings:
- compliance review A (TEST-SPEC's T1–T6 tests): compliant;
- B (T7 and later): compliant, with one note on AGENTS.md;
- C (everything outside the T-numbered tests): compliant;
- D (CERTIFICATIONS.md): 2 gaps, with one note for coordination on T1.3-5;
- VERIFY V: green — every harness self-test and every certification passes, locally and in CI run 934 (ID 37608172268).

Task headings cite reviewer D's gaps as D1 (its G1: the CONF-VALID conformer's finding locations) and D2 (its G2: the CONF-AVAIL conformer's), D's coordination note on T1.3-5 as D3, and reviewer B's note on two stale AGENTS.md statements as B1. Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tests Specified); no task changes its stage. No Bug Report applies.

Why the harness changes again: the documents moved after the harness was last green (Phase 9 ended at 3bfedb5). The deltas are `git diff 3311ccd..6780f53 -- specs/TEST-SPEC.md`, `git diff 3311ccd..301f2f9 -- specs/CERTIFICATIONS.md`, and `git diff 9d095d9..f31e100 -- specs/SPEC.md`; none of the three documents has changed since. The plans written at f0d3cd9, 857e51a, ad9eb42, 6a4a280, 1e2972e, 849b69d, and 765d6b4 closed every gap the first seven determinations found. Their finished texts were deleted (at 44c5dad, 4117ede, b00e7cd, and 34032b5) or sit at `deleted/specs/tmp/FIX_PLAN.md`, `deleted/specs/tmp/FIX_PLAN-2.md`, and `deleted/specs/tmp/FIX_PLAN-3.md`, each moved there with the Developer's approval. None of them is part of the harness or the product, and no task touches them. D1 and D2 are older than this re-descent: both conformers locate these conditions at the whole section (CONF-AVAIL's sites since 3b81b12, 2026-08-29; CONF-VALID's stated whole-construct choice since 298c581, 2026-09-10), and no earlier plan ruled on them. Neither blocks on a spec defect.

## Preamble — read before any task

**Phase goal and scope guards (Phase 9).** The harness must adhere to `specs/TEST-SPEC.md` and `specs/CERTIFICATIONS.md`. Every harness self-test and every certification passes: each certified test passes against its conformer and fails against each of its violators exactly as the violator's entry states. Product tests may fail, but only as diagnosed assertion failures (H-8): never a harness error, crash, hang, or false pass. Never modify product code (`src/`; `dist/` is built from it). Every task is harness work under `test/` (fixtures under `test/fixtures/` are harness code), plus `AGENTS.md`'s build/run facts and this plan. A spec defect that blocks a task goes to the matching problems file under `specs/tmp/` (`SPEC-PROBLEMS.md`, `TEST-SPEC-PROBLEMS.md`, or `CERTIFICATIONS-PROBLEMS.md`), never into a silent workaround.

**Known state at 34032b5 (VERIFY, and CI run 934, ID 37608172268).**
- Self project, run as CI runs it (no network, uid 1000, no capabilities): 27 files, 4234 tests, all passing, 0 skipped (198.74 s locally in VERIFY's run, while the reviewers' runs shared the machine; 121.93 s in CI's harness-self job).
- Certification: all 27 fixtures pass — CORE 1 conformer and 8 violators, VALID 1 and 3, MD 1 and 2, DISC 1 and 3, AVAIL 1 and 3, ORPHAN 1 and 2. The runner's lines sum to 154 PASS / 38 FAIL / 0 error / 0 hang; every FAIL is an expected outcome (each violator's FAIL set equals its Certifies list), and the C-1 gate passes. The in-scope tests: CONF-CORE T6.1-2, T10.4-5, T13.4-5, T13.5-1 through T13.5-5, and T13.5-8; CONF-VALID T1.3-1 through T1.3-6, T1.4-1, T1.4-2, T1.4-4, T2.6-1, T2.6-2, and P-1; CONF-MD T3-1 through T3-6, P-2, and P-3; CONF-DISC T7-4, T7-5, and T7-6; CONF-AVAIL T11.2-2, T11.2-4, T11.3-4, T11.4-1, T11.4-3, and T11.4-4; CONF-ORPHAN T13.4-11. Task 1 changes the CONF-VALID fixture product and Task 2 the CONF-AVAIL one (each shared by its conformer and violators); Task 3 changes only comments in T1.3-5, a CONF-VALID in-scope test (and comments and one diagnosis string in `section-14.ts`). Each must leave every certification outcome unchanged.
- Suite against the built product (local and CI, no network, unprivileged): 345 tests in 79 files; 314 pass and 31 fail, every failure a `HarnessAssertionError` (diagnosed). The failing IDs: P-1, P-5, T1.4-1, T1.4-4, T4-2, T6.4-3, T6.5-4, T6.5-11, T6.5-20, T6.5-21, T6.5-22, T6.5-23, T6.6-3, T7-2, T7-6, T7.1-1, T7.3-1, T11-1, T11-2, T11-3, T12.0-5, T12.0-10, T12.7-2, T13.4-9, T13.4-10, T13.4-11, T14-4, T14-6, T14-7, T14-11, and T14-12. T12.7-3, T13.5-7, and T14-9 pass (B1). VERIFY's local full run (`--project suite --project self` in CI's inner stage, `XSPEC_E6_EXCHANGE_DIR` set): 106 files, 4579 tests, 1526.86 s; CI's full-suite job: `npm test` in 1066.59 s. VERIFY's logs and JSON reports are in the scratchpad's `p9c8v/` (`full.json`, `full.clean.log`, `suite-linux-934.clean.log`, `ci934-failed.txt`) while it survives.
- Windows leg (E-6 subset): 3 files, 9 tests, green (41.80 s in CI).
- `npm run typecheck` and `npm run format:check` pass; both TypeScript copies are 5.9.3. A fresh compile of `src/` is identical to `dist/` (VERIFY), and `src/` has not changed since c62f451.
- The conformers' finding locations (reviewer D's probes; Tasks 1 and 2 tabulate the cases): CONF-VALID's `build --json` locates 14.1, 14.2, 14.3, and 14.17 at the whole section (opening tag through closing tag) and reports 14.3 once per repeated bearer, the first bearer never located; CONF-AVAIL's bare `view` locates 14.1, 14.2, and 14.3 at the whole section. D found CONF-VALID's 14.4 findings, and CONF-AVAIL's 14.4, 14.5, 14.6, 14.9, 14.15, 14.16, and 14.17 findings, already located as SPEC 14 fixes. Reviewer D applied both fixes to a scratch copy of 34032b5 and certification came out exactly the same (CONF-VALID 12/12, each VIOL-VALID-* 9 pass and 3 fail; CONF-AVAIL 6/6, each VIOL-AVAIL-* failing exactly its Certifies list; the grammar guard's VALID and AVAIL tables passing). No in-scope test notices the difference: T1.3-1, T1.3-2, T1.3-5, T1.3-6, T11.2-2, and T11.2-4 locate by byte window — any range inside the offending section's bytes — and leave exact ranges to T14-11, which no conformer's scope holds.
- The built product's report for T1.3-5's same-file staging (the planner's probe, `p156plan/ws` in the scratchpad: the specs-only configuration and T1.3-5's `DUP_SOURCE` at `specs/A.mdx`): `build --json` exits 1 with one `duplicate-id` finding whose two locations are the two `id` attributes, `{"start": 3, "end": 11}` and `{"start": 40, "end": 48}` — already as SPEC 14 fixes.
- No self-test reads TEST-SPEC.md or CERTIFICATIONS.md, and none probes a fixture's finding locations outside certification runs, so a green self project does not by itself show a fixture's conformance: Tasks 1 and 2 carry their own probes.

**Run mechanics (AGENTS.md holds the recipes; read the bullets a task names before running anything).**
- Confirm `git status` is clean on `claude/xspec-ui-apis-4df8fa` before editing. Never fetch or merge `main` (it carries a newer scaffold commit this run does not adopt). Push with `git push -u origin claude/xspec-ui-apis-4df8fa`, retrying network errors with backoff (2 s, 4 s, 8 s, 16 s); never force-push; check `git log -1` before every push. If `node_modules` is missing, `npm ci` restores it.
- Run the self project under the unprivileged namespace (`unshare --map-user=1000 --map-group=1000 -- npm run test:self` in this root sandbox; AGENTS.md's namespace bullet also records how to reproduce CI's no-network stage). Redirect long runs to a log in the scratchpad and grep it for `×` and the `Tests` summary; never cap the output with `head`.
- One certification family alone (AGENTS.md's "Harness self-tests and certification only" bullet): `npx vitest run --config test/vitest.config.ts --project self test/self/certification.test.ts -t VALID` (or `-t AVAIL`) under the namespace runs that conformer and its violators over their in-scope tests and skips every other family. The certification fixtures' invocation-grammar guard is `test/self/certification-fixture-grammar.test.ts` (AGENTS.md's grammar-guard bullet), one test per conformer table.
- Hand-driving a fixture: `node test/fixtures/<fixture>/bin.mjs <argv…>` with a scratch workspace as the working directory (AGENTS.md's "Certification fixture products" bullet). The violators run as `bin-<deviation>.mjs` beside it.
- Run the self project, a certification run, and a suite run one at a time, never two together, and check the load first (another agent may share the machine). S-2's tower vector has timed out only with two harness runs overlapping; such a timeout is not a task failure — rerun alone.
- One registered test: `-t '<ID> '`, with the trailing space and the dots escaped, on its wrapper file (e.g. `npx vitest run --config test/vitest.config.ts --project suite test/suite/section-1.3.test.ts -t 'T1\.3-5 '`). T1.3-5 is registered in `test/suite/registry/section-1.3.ts` (wrapper `test/suite/section-1.3.test.ts`); T14-4 and T14-8 in `test/suite/registry/section-14.ts` (wrapper `test/suite/section-14.test.ts`, about 153 s whole).
- Rebuild the product (`npm run build`) only if `dist/` is missing or stale; `src/` does not change in this phase.
- The scratchpad is shared across spawns: use task-specific file names there (`t156_<N>/`). Reviewer D's probes and trial patches (`c156D/probe_loc/`: `valid_probe.py`, `avail_probe.py`, `conf-valid.patch`, `conf-avail.patch`, `cert_patched.log`) and the planner's (`p156plan/`, with `avail_check.py`, a CONF-AVAIL probe of 14.1, 14.2, and 14.3) live there; read any you reuse in full first, and rebuild from this plan's tables if one is gone (container restarts have happened). The probes are Python scripts taking a scratch base directory as their one argument; run them with `python3 -I`.

**Spellings.** Take every exact spelling — code points, escape-spelled literals, byte offsets, file contents, command lines — from the TEST-SPEC.md, CERTIFICATIONS.md, or SPEC.md text the task cites, or from the harness code it names, never from the review reports. The reports' channel decoded escape spellings, and the tool-parameter layer decodes backslash-u spellings inconsistently in edit and Bash payloads, comments included. This plan spells no escapes and needs none: its probe sources are plain ASCII, given line by line, every line ending in one line feed. Should a task need an escape anyway, build it in code from code points and verify the staged bytes byte-wise (`od -c`, a sha256 compare).

**Conventions for changed fixtures and tests.**
- *Registration and records.* No task adds or removes a registered product test, a staged-source record, or a self-test, and no task restages a product test's inputs: the self project stays at 27 files and 4234 tests. Tasks 1 and 2 change fixture products only; Task 3 changes comments and one diagnosis string only.
- *Product verdicts.* No task is planned to change any test's outcome against the built product. Task 3 rewords one diagnosis, raised on the 14.3 tolerance branch of T14-4's sweep only when the row's findings fall outside the tolerance; the built product reports one 14.3 finding, so it never sees that diagnosis.
- *Liveness.* A fixture's in-scope tests pass whether or not its locations are exact (Known state), so Tasks 1 and 2 show their change with the probe: run before the change, it reproduces the "Reported at 34032b5" column; run after, it gives the "Required" column exactly. Task 3 changes no assertion, so it has no red check; its check is that the assertions are untouched.
- *Every task ends with:*
  - `npm run typecheck` and `npm run format:check`;
  - the checks the task names, with every outcome before and after recorded;
  - the full self project under the namespace, with 0 failures and certification lines summing to 154 PASS / 38 FAIL / 0 error / 0 hang (green at 34032b5; keep it green);
  - a commit message (`sdg(phase-9): <imperative summary> (FIX_PLAN Task N)`, with the two trailer lines the session requires) stating the honest results: each probe case's ranges before and after, each touched test's or fixture's outcomes before and after;
  - removing the finished task from this plan in the same commit and adding its one-line summary to its bullet in the Order section below (a done task leaves the plan).
- *AGENTS.md* gets only build/run knowledge a later spawn needs (a recipe, a count or timing a later check relies on, a corrected fact), never a task narrative.

**Standing rulings.** Two Liaison rulings stand for this run: AGENTS.md's "Known residual 14.20 location gaps" and "Known SPEC 6.5 gap, deferred to a future SPEC revision (accepted for this run by ruling)" bullets. No task here addresses them, and none may be added for them.

**Deleting this plan.** Only Task 4 deletes this file, with `git rm`, once no other task remains. If the permission system refuses the deletion, stop there: leave the file in place, commit nothing further for it, and report the refusal in the final report. Never move, rename, empty, or otherwise work around a refused deletion: the Developer's three earlier approvals to move a finished plan each covered that one file only.

**Considered and not planned (do not re-raise).**
- *Carried from the earlier plans.* The "Considered and not planned" lists of `deleted/specs/tmp/FIX_PLAN-3.md`, of the sixth plan's final text (`git show 715dff7:specs/tmp/FIX_PLAN.md`), and of the seventh plan's final text (`git show 107f624:specs/tmp/FIX_PLAN.md`) still stand in full at 34032b5. The harness code their items concern is unchanged except where a task below changes it, and the reviewers re-confirmed the items they own. They are not repeated here. Among them: CONF-VALID's 14.20 ranges are not zero-length, but 14.20 cannot arise in its scope (FIX_PLAN-3's list); Task 1 leaves them alone.
- *The Phase 7 round-3 certifications driver's note on VIOL-ORPHAN-THROUGHLINK* (its deviation resolves directory components only through links whose target directory lies inside the workspace root): implemented as now written (`linkedDirectoryInsideRoot` in the fixture) and certified. Reviewer D at 34032b5 confirms THROUGHLINK fails exactly T13.4-11, at arm (e)'s inside staging, and VERIFY's certification comparison (locally and in CI run 934) agrees. No task.
- *D3 — reviewer D's coordination note: "T1.3-5 accepts one or two 14.3 findings, while SPEC 14 fixes one finding that locates every bearer."* Ruled: the tolerance stays, and Task 3 corrects its stated reason. T1.3-5's same-file arm accepts one 14.3 finding or one per occurrence, every location inside one bearer's byte window; T14-4's 14.3 row (`perOccurrenceTolerated`), a reporter-membership sweep row, accepts one or two findings, all 14.3, and checks no location. SPEC 14 does fix one finding locating every bearer at its `id` attribute (its location-cardinality paragraph, in SPEC since 6040942). But TEST-SPEC places that contract in T14-8 and the exact ranges in T14-11: §14's preamble lists "the stable-code, location-cardinality, and range contracts (T14-6, T14-8, T14-11)", T14-8 stages "a triple-duplicated ID → one condition-3 finding with three locations (one per bearer, no representative chosen)", and T14-8 ends "the ranges themselves, per condition, are T14-11's". The harness's T14-8 asserts the cardinality exactly (the `section-14.ts` header: "T14-8 owns the every-participant strictness the home tests SOME-quantify"). Reviewers A and B judged T1.3-5 and T14-4 compliant at 34032b5, and the built product already reports the duplicate pair as SPEC 14 fixes (Known state). What is wrong is the reason four harness sites give for the tolerance — that SPEC leaves the count free (e.g. "SPEC 14.3 fixes no count"). The same division covers the window-based locations of the other home tests D names (T1.3-1, T1.3-2, T1.3-6, T11.2-2, T11.2-4).
- *From this determination's reviewers (34032b5).*
  - A: T6.2-3's clean-boundary arm moves `origin.mv` into the flow-position parent `tgt`, which TEST-SPEC's "or, into a flow-position parent (`b.mdx#p.y`)" allows. Naming only: T6.5-7 binds `Keep`/`TB` (MDX) and `Keep`/`ORG` (code) where TEST-SPEC writes `C`/`T2`; T4.5-9 spells its specifiers from `src/`; T2.3-2 uses a `text` call with a decoy. T4.1-3's judge rejects any observed string carrying the fixture's sentinel prefix, stricter only for fragments of requirement text, which SPEC 4.1 also bars. Titles that omit a clause their body asserts (T6.5-3's fresh-build compare and post-move `check`, T6.6-4(c)'s mapping, which includes the root) are cosmetic.
  - B: T12.0-9's exit-class sweep asserts only exit classes on its error rows, its entry's stated purpose; the keyword matchers (`/config/i`, `/build/i`, `/resolv/i`, `/corrupt/i`) each name information SPEC requires. B's note on AGENTS.md is B1, handled by Task 4.
  - C: T1.1-2's skeleton depth bound (16, `test/helpers/tooling.ts`) truncates no required comparison, both sides alike. P-1 checks exit codes and stable codes but not where its findings point; its text asks only "accepted iff valid", and T1.4-1, T1.4-4, and T14-11 check the 14.4 location. The driver would drop a walk failure on a run nobody awaits; no such run hides a failure that matters. The earlier accepted items (the `dist/`-missing driver errors, P-6's and P-9's narrower draws, the UTF-8 decode catch-alls, the Windows leg's network, the platform `runIf` gates in self-tests) are unchanged.
  - D: T13.5-4's storm compare covers the whole tree except the journal, wider than CHATTYREADS's "derived files alone" (accepted at 68f0718 and b00e7cd). CONF-MD's `query` answers omit tags, coverage, and hashes, content §CONF-MD declares out of scope, and no in-scope test consults them. CONF-CORE's exclusivity lock lives in `os.tmpdir()`, keyed by the workspace's real path, per workspace and not observable in scope. CONF-CORE's `check` on an unbuilt or stale workspace names `.xspec/graph.json` where SPEC 14.10 names `.xspec`; §CONF-CORE says nothing else in scope presents a finding beyond the BOM condition.
  - V: green; the timings it measured are recorded by Task 4 (V was read-only).
- *The planner's own.* Tasks 1 and 2 add no self-test pinning a fixture's ranges: TEST-SPEC's S-items define the self project and none covers a fixture's finding locations, and certification judges fixtures only through their in-scope tests, which locate by window by TEST-SPEC's division (D3). Each task's probe and the next compliance review check the ranges.

**Order.** Take the topmost task unless told otherwise; the dependencies below are hard. A task too large for one spawn may be split by inserting follow-up tasks directly after it; never drop a requirement. When a task is done, its commit removes it and adds a one-line summary to its bullet here.
- Task 1 (D1): the CONF-VALID conformer locates 14.1, 14.2, 14.3, and 14.17 at the ranges SPEC 14 fixes, 14.3 as one finding locating every bearer. Independent of every other task.
- Task 2 (D2): the CONF-AVAIL conformer locates 14.1 at the opening tag, and 14.2 and 14.3 at the `id` attribute. Independent of every other task.
- Task 3 (D3): T1.3-5's and T14-4's 14.3 tolerance states its true basis; no assertion changes. Independent of every other task.
- Task 4 confirms the result locally and in CI, corrects AGENTS.md's two stale verdict statements (B1), records VERIFY's timings, and deletes this plan. It depends on every task above.

## Tasks

### Task 1 — CONF-VALID: locate 14.1, 14.2, 14.3, and 14.17 at SPEC 14's ranges (D1)

**Requirement.**
- CERTIFICATIONS.md §CONF-VALID Scope: "Command surface: `build` with the error reporting of 14 for conditions 14.1–14.4 — … — and 14.17 as T1.3-6's invalid-form arms stage it: a repeated `id`, a braced value, and the valueless bare name (`<S id>`) … — (file, location, condition identity with its stable code where the report form carries one — 14, 12.7 — …)". The document's first paragraph: a conformer conforms to SPEC.md within its stated scope.
- SPEC 14, the paragraph beginning "Every condition that locates in source": "Location cardinality follows the condition's structure: a condition that several constructs jointly violate is one finding carrying a location for every participating construct … — duplicate identities locate every bearer; a repeated prop locates every attribute spelling the name"; "Ranges are exact per condition"; "An attribute condition (14.2–14.4, 14.17) locates the attribute's own characters, the attribute range of 11.4: a duplicate identity each bearer's `id` attribute, a malformed segment the `id` attribute, a malformed tag the `tags` attribute"; "A missing `id` (14.1) locates the section's opening tag, the opening-tag range of 11.4". SPEC 12.7: a finding carries one `{"file", "range"}` per offending construct, ordered by file path bytes, then range start, then range end.
- A reading aid, not a certified test (no conformer's scope holds it): TEST-SPEC T14-11 spells the same rules — "each bearer's `id` attribute for 14.2 and 14.3", 14.17's "repeated prop locating every attribute spelling the name (both `id` attributes of a twice-`id`ed tag)", and "14.1 at the section's opening-tag range".

**Where.** `test/fixtures/conf-valid/product.mjs`, shared by the conformer and VIOL-VALID-CTRL, -WIDE, and -SEP. No violator's deviation site is involved: each deviation lies in 1.4's character classes, behind 14.4, which is already exact.
- The section-tag parser (about lines 940–1038) computes each attribute's own range (`attrStart` to `j`, name through the end of its value, or the bare name alone when valueless) but keeps it only for the first quoted `id` and `tags` (`idAttr`, `tagsAttr`). A repeated or invalid-form prop is recorded in `node.invalidProps` without any range.
- `validateSections` (about lines 1065–1205): its doc comment states the whole-construct choice. `const location` (the section's `openStart` to `closeEnd`) is used for 14.17, 14.1, and 14.2. 14.3 is pushed "at each repeated occurrence": one finding per second or later bearer, the first bearer never located.
- The finding serializer (about lines 1385–1420) wraps the one `location` into `locations`. The findings comparator (about line 1353) already compares location lists element-wise.

**Change.**
- Keep every attribute's own range in the parser, so 14.17 can locate every attribute spelling the offending name.
- 14.1: the section's opening tag (`openStart` to `openEnd`, the opening-tag range of 11.4).
- 14.2: the offending section's `id` attribute (`idAttr`; a section reaching that check spells exactly one quoted `id`).
- 14.3: one finding per duplicated spelling in the file, its locations every bearer's `id` attribute, in document order. The bearers are exactly the sections that take part in the check today (`node.id !== null`): no masking or participation change. The same ID in two files stays valid (uniqueness is per file, T1.3-5's cross-file arm).
- 14.17: a repeated prop is one finding locating every attribute spelling the name, in document order; a value-form violation (a braced value, or the valueless bare name) locates its offending attribute alone. The set of 14.17 findings stays as it is (one per `invalidProps` entry); only the locations change.
- Findings may carry several ranges; serialize one `{"file", "range"}` per range, keep the 12.7 order of findings, and order the locations inside a finding by range start, then range end.
- 14.4 is already exact, and 14.20's ranges stay as they are (Considered list).
- Rewrite `validateSections`' doc comment and the 14.17 and 14.3 comments to state SPEC 14's ranges and cardinality instead of the whole-construct choice.
- Reviewer D's trial patch (`c156D/probe_loc/conf-valid.patch`) makes these changes. If it is still there, read it in full and use it as a reference, not a prescription.

**Checks.**
- *Probe.* Use reviewer D's `c156D/probe_loc/valid_probe.py`, copied to `t156_1/`, plus a case for three bearers; or rebuild it from this table. Each case is a one-file workspace: `xspec.config.ts` is the specs-only configuration with `main: ["specs/*.mdx"]`, and `specs/A.mdx` holds the lines listed, each ending in one line feed. Each case runs `node test/fixtures/conf-valid/bin.mjs build --json` from the workspace root, and each must exit 1 before and after. Ranges are byte offsets, start then end.

  | Case | `specs/A.mdx`, line by line | Required (after) | Reported at 34032b5 |
  |---|---|---|---|
  | 14.1 | `<S id="ok">`, `A.`, `</S>`, `<S>`, `No id.`, `</S>` | (20,23), the second `<S>` | (20,35) |
  | 14.2, child | `<S id="login">`, `L.`, `<S id="validCredentials">`, `X.`, `</S>`, `</S>` | (21,42), `id="validCredentials"` | (18,51) |
  | 14.2, top level | `<S id="auth.login">`, `X.`, `</S>` | (3,18) | (0,27) |
  | 14.3, two bearers | `<S id="a">`, `A.`, `</S>`, `<S id="a">`, `B.`, `</S>` | one finding: (3,9) and (22,28) | one finding: (19,37) |
  | 14.3, three bearers | the two-bearer lines, then `<S id="a">`, `C.`, `</S>` | one finding: (3,9), (22,28), and (41,47) | two findings: (19,37); (38,56) |
  | 14.17, repeated `id` | `<S id="x" id="y">`, `<S id="q.r">`, `R.`, `</S>`, `</S>` | one finding: (3,9) and (10,16) | (0,43) |
  | 14.17, braced `id` | `<S id={"x"}>`, `<S id="q.r">`, `R.`, `</S>`, `</S>` | (3,11) | (0,38) |
  | 14.17, valueless `id` | `<S id>`, `<S id="q.r">`, `R.`, `</S>`, `</S>` | (3,5) | (0,32) |
  | 14.4, control | `<S id="a" tags="ok x#y">`, `A.`, `</S>` | (10,23), unchanged | (10,23) |

  Run the probe before the change, recording any difference from the last column, and after: every case must give exactly the "Required" column, no further finding of the case's condition, and the 14.17 cases no 14.1 or 14.2 finding (the masking of 14.17 over 14.2 is unchanged). Also stage a self-closing id-less section as a control (`<S id="ok">`, `A.`, `</S>`, `<S />`): its 14.1 location is the self-closing tag's own characters, (20,25), before and after (at 34032b5 the fixture, CONF-AVAIL, and the built product all report it so).
- *Certification family.* Run `-t VALID` (Run mechanics) before and after. CONF-VALID passes its 12 in-scope tests. VIOL-VALID-CTRL, -WIDE, and -SEP each fail exactly their Certifies lists, at the arms CERTIFICATIONS.md names, with the same first-line diagnoses as before the change. `test/self/certification-fixture-grammar.test.ts` passes.
- *Every-task ending* (Conventions).

### Task 2 — CONF-AVAIL: locate 14.1 at the opening tag, and 14.2 and 14.3 at the `id` attribute (D2)

**Requirement.**
- CERTIFICATIONS.md §CONF-AVAIL Scope: "findings accompanying per 11.2/14 with stable codes and located ranges for the staged conditions (14.1, 14.3, 14.4, 14.5, 14.6, 14.9, 14.15, 14.16, 14.17, and 14.20 at offset 0 as staged above)"; the document's first paragraph: a conformer conforms to SPEC.md within its stated scope.
- SPEC 14, as Task 1 cites it: 14.1 locates the section's opening tag, the opening-tag range of 11.4; 14.3 is one finding locating each bearer's `id` attribute; 14.2 locates the `id` attribute.
- 14.2 lies outside CONF-AVAIL's staged set. It takes the same correction anyway, so that every finding the fixture reports carries SPEC 14's range; D's trial patch included it, and certification came out the same.

**Where.** `test/fixtures/conf-avail/product.mjs`, shared by the conformer and VIOL-AVAIL-NULLMARKER, -OMIT, and -NOFILE (their deviations lie in the datum forms and the `--file` restriction, not in finding locations).
- The 14.1 site (about line 1593) locates `constructRange(section)`.
- The 14.2 site (about line 1784) locates `constructRange(section)`.
- The 14.3 site (about line 1805) already reports one finding per duplicated spelling locating every bearer, but each by `constructRange(bearer)`.
- `attrRange` and `constructRange` are defined together (about line 1560), over `byteRange`. The fixture's `view` answer already reports each section's `opening` as `byteRange(record, node.openStart, node.openEnd)` (about line 2540), the range 14.1 must carry.

**Change.**
- 14.1: the section's opening tag, `openStart` to `openEnd`, the same range `view` reports as that section's `opening`.
- 14.2 and 14.3: the section's one `id` attribute (`attrRange` of the `id` entry of `section.attrs`; a section reaching either check spells exactly one quoted `id`).
- Leave every other finding site alone (D found the other staged conditions exact), and correct any comment that states the old ranges.
- Reviewer D's trial patch (`c156D/probe_loc/conf-avail.patch`) makes these changes. If it is still there, read it in full and use it as a reference, not a prescription.

**Checks.**
- *Probe.* Use reviewer D's `c156D/probe_loc/avail_probe.py` and the planner's `p156plan/avail_check.py`, copied to `t156_2/`, or rebuild them from this table. The workspaces are Task 1's one-file workspaces, each running bare `node test/fixtures/conf-avail/bin.mjs view` from the workspace root and exiting 1 before and after.

  | Case | `specs/A.mdx` | Required (after) | Reported at 34032b5 |
  |---|---|---|---|
  | 14.1 | Task 1's 14.1 case | (20,23) | (20,35) |
  | 14.2, child | Task 1's | (21,42) | (18,51) |
  | 14.2, top level | Task 1's | (3,18) | (0,27) |
  | 14.3, two bearers | Task 1's | one finding: (3,9) and (22,28) | one finding: (0,18) and (19,37) |
  | 14.1, self-closing (control) | Task 1's control | (20,25) | (20,25) |

  For each 14.1 case, also check that the finding's range equals the `opening` the same answer reports for that section. The other cases of D's probe are controls whose findings must not change: 14.4 for a malformed `id` (`<S id="a b">`, `A.`, `</S>`) at (3,11); 14.5 for `d={["nope"]}`; 14.6 for `{text("nope")}`; 14.9 for the two-section `d` cycle; 14.16 for the `<div>` element; and 14.17 for a repeated, a braced, and a valueless `id`, and for an invalid `coverage` value.
- *Certification family.* Run `-t AVAIL` before and after. CONF-AVAIL passes its 6 in-scope tests. VIOL-AVAIL-NULLMARKER, -OMIT, and -NOFILE each fail exactly their Certifies lists, with the same first-line diagnoses as before the change. `test/self/certification-fixture-grammar.test.ts` passes.
- *Every-task ending* (Conventions).

### Task 3 — State the true basis of T1.3-5's and T14-4's 14.3 tolerance (D3)

**Requirement.**
- SPEC 14, the paragraph beginning "Every condition that locates in source": "a condition that several constructs jointly violate is one finding carrying a location for every participating construct, each located in the file that contains it, so every offending spelling renders in place and no representative is chosen — duplicate identities locate every bearer".
- TEST-SPEC places that contract in T14-8 and the ranges in T14-11: §14's preamble ("the stable-code, location-cardinality, and range contracts (T14-6, T14-8, T14-11)"); T14-8 ("a triple-duplicated ID → one condition-3 finding with three locations (one per bearer, no representative chosen)"; "the ranges themselves, per condition, are T14-11's").
- Reviewer D's coordination note and the ruling on it (Considered list, D3): the tolerance stays, but the reason the harness gives for it is wrong.

**Where.** Four sites say SPEC leaves the number of 14.3 findings free:
- `test/suite/registry/section-1.3.ts`, the comment opening T1.3-5's same-file arm (about line 338): "SPEC 14.3 defines one condition over the duplicate pair; whether a product reports the duplication once or per occurrence is not fixed, so one or two findings are accepted".
- `test/suite/registry/section-14.ts`:
  - the module header's bullet on T14-4's 14.3 row (about line 69): "(the T1.3-5 operationalization; SPEC 14.3 fixes no count)";
  - the doc comment of `perOccurrenceTolerated` (about line 1304): "SPEC fixes no count for this condition";
  - the diagnosis `assertSweepFindings` raises on that branch (about line 1875): "(SPEC 14.3 fixes no count; the T1.3-5 operationalization)".

**Change.**
- Reword each site to the true basis. SPEC 14 fixes one 14.3 finding locating every bearer at its `id` attribute. T1.3-5 deliberately accepts one finding or one per occurrence, every location inside a bearer's byte window, and T14-4's sweep row one or two 14.3 findings with no location check (its rows assert reporter membership), because TEST-SPEC assigns the every-participant cardinality to T14-8 and the exact ranges to T14-11, which assert them strictly.
- The diagnosis must no longer tell its reader that SPEC leaves the count free. For example: "one finding for the defect, or one per occurrence — this sweep's tolerance; SPEC 14's single finding locating every bearer is T14-8's to assert".
- Keep the module header's later bullet ("T14-8 owns the every-participant strictness the home tests SOME-quantify", about line 256) consistent with the new wording; it is already accurate.
- Change no assertion, accepted set, staging, or title.

**Checks.**
- `grep -rn -i 'fixes no count\|once or per occurrence is not' test/` finds nothing, and `git diff` shows only comment lines and the one diagnosis string changed.
- Run `test/suite/section-1.3.test.ts` and `test/suite/section-14.test.ts` (T14-1 through T14-8 and T14-11) against the built product under the namespace, before and after. Every test keeps its outcome. The diagnosed failures among them (T14-4, T14-6, T14-7, and T14-11) keep their arms and diagnoses, unless a diagnosis is the reworded message; that is not expected, since the built product reports one 14.3 finding.
- *Every-task ending* (Conventions). The self project's certification covers T1.3-5 against CONF-VALID and its violators.

### Task 4 — Confirm locally and in CI; correct AGENTS.md's stale verdicts (B1); delete this plan

**Depends on.** Every task above.

**Change.**
- *Self project and certification.* Under the namespace, run the full self project alone and expect 0 failures.
  - Confirm the count in AGENTS.md's "Harness self-tests and certification only" bullet still holds: 27 files and 4234 tests, since no task here adds a test.
  - Add this run's timing to that bullet and to the timings bullet. VERIFY at 34032b5 measured 198.74 s locally, with the reviewers' runs sharing the machine, and 121.93 s in CI run 934. The bullets' last entries are 161 s at the seventh plan's Task 6 (107f624's trees) and 127.83 s in CI run 933.
  - Confirm the certification totals: still 6 conformers and 21 violators, 27 fixtures, every one passing, 154 PASS / 38 FAIL / 0 error / 0 hang.
- *Suite against the built product.* Run the suite project alone, inside CI's inner stage (network off, uid 1000, no capabilities; AGENTS.md's namespace bullet), with the JSON reporter.
  - Every failure must be a diagnosed product failure (`HarnessAssertionError`).
  - The expected failing set is the Preamble's 31 IDs, each at the same first failing arm as in VERIFY's run at 34032b5. Compare against `p9c8v/full.json` while it survives, else against CI run 934's full-suite log. No task here changes a product test's outcome.
  - List each failing test with its first failing arm in the commit message, and explain any difference from that set.
  - Record the run time in AGENTS.md's timings bullet, as a new entry naming the 31 failing IDs. VERIFY's figures at 34032b5: the local full run (`--project suite --project self`) took 1526.86 s in CI's inner stage, CI's full-suite job 1066.59 s, and the Windows leg 41.80 s. The bullet's last suite entry is 1178 s at the seventh plan's Task 6.
- *B1: correct two stale statements in AGENTS.md.* They are in its "Red-checking a strengthened product test against the built product (Phase 9)" bullet:
  - that the built product "today dies with exit 70 at every refused write instead of exiting 2";
  - that "against the built product T12.7-3 fails diagnosed at its first unoccupied-`--config` arm (the product canonicalizes the value to `../cfg/xspec.config.ts`)".

  At 34032b5, T12.7-3, T13.5-7, and T14-9 pass against the built product (CI run 934 and VERIFY's local run). Confirm this from this task's suite run, then correct both statements to what the run shows. Keep the recipes they sit in, and change nothing else in that bullet.
- *CI.* Check CI on the pushed head (AGENTS.md's CI-reading bullet holds the recipe). The harness-self job and the Windows leg must be green, and the full-suite job may fail only on diagnosed product tests, the same 31.
- *Delete this plan.* Once no other task remains in `specs/tmp/FIX_PLAN.md`, delete it with `git rm`, under the Preamble's "Deleting this plan" rule. If the permission system refuses, stop and report the refusal; never move, rename, or empty the file.
