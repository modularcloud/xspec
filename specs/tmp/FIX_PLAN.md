# FIX_PLAN — Phase 9 (test harness), second re-descent, compliance determination 1

Planned 2026-09-10 from: reviewer A (TEST-SPEC.md §0–8, 28 gaps), reviewer B (§9–16, 31 gaps), reviewer C (§17–18 + CERTIFICATIONS.md, 4 gaps), and the VERIFY report at 8342cdc (three red self-tests in `test/self/certification-document.test.ts`; T4.5-8, T6.5-7, T6.5-9 diagnosed product failures — allowed at this phase, no task). Governing IP: `specs/patches/0001-external-ui-apis.md` (Stage: Tested). Bundle: `specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`.

## Rules for every task (read before starting any of them)

- **Phase 9 scope guard.** Edit only under `test/`, `.github/`, harness configuration, `AGENTS.md` (build/lint/run knowledge only), and this file. Never touch `src/`. Product tests are expected to fail against the product; harness self-tests and certifications must pass.
- **Definition of done for a task:** `npm run typecheck` clean; `npm run format:check` clean (use the repository's format script to fix); `npm run test:self` fully green (certification included — any task touching a test named in a CERTIFICATIONS.md in-scope list re-certifies that fixture); the touched product-facing tests run against the built product (`npm run build` first, then `npx vitest run --config test/vitest.config.ts --project suite test/suite/<section file>.test.ts --reporter=verbose`) either pass or fail as a *diagnosed product failure* (a `HarnessAssertionError` whose message states what the product did wrong, TEST-SPEC H-8) — never a harness error, timeout, or crash. Commit `sdg(phase-9): <imperative summary>` ending with the two trailer lines the spawn prompt gives, push to `origin claude/xspec-ui-apis-4df8fa` (retry on network errors with 2s/4s/8s/16s backoff), then delete the finished task from this file (or the whole file when it is the last task).
- **Registration mechanics** (new test IDs): the body is a `ProductTestEntry` (`{ id, title, run }`) in the section's module under `test/suite/registry/section-*.ts`, spread into `test/suite/registry/index.ts`, mapped to its SPEC.md passages in `test/suite/registry/traceability.ts` (H-7; checked by `test/self/s1-traceability.test.ts`), and declared where the thin wrapper `test/suite/section-*.test.ts` / `test/suite/declare.ts` requires. Mirror the file set of commit 8342cdc (T6.3-5) or 24c9487 (T4.5-8): `git show --stat <sha>`.
- **Escape spellings.** The tool-parameter layer decodes `\uXXXX` in edit payloads; when a test needs the six-character source spelling (e.g. `id="a\u002Eb"`), write it as `\u002E` in the payload and verify the file bytes with `grep -c 'u002E'` afterwards.
- **Platform-gated arms.** Linux-only stagings (non-UTF-8 path bytes; permission removal) follow the existing pattern `const NU3_STAGED = process.platform === "linux"` in `test/suite/registry/section-11.5.ts`; a Linux-leg test (T13.5-7, T14-9, T14-10) must not be selected by the Windows project's registry-ID subset (E-6) unless its body is platform-safe — check the selection list before registering.
- **H-11 harness errors vs H-8 product failures.** `HarnessAssertionError` (`test/helpers/assertions.ts`) means "diagnosed product failure". An ineffective staging, an unreachable precondition, or a harness bug must surface as a distinct error class (`HarnessStagingError` in `test/helpers/permissions.ts`), never as a `HarnessAssertionError`, a pass, or a skip (H-9).
- **Infrastructure caution.** Keep each spawn's edits bounded: a few tool calls per response, modest payloads, no single giant write. Large section files (section-6.5.ts, section-13.5.ts, section-14.ts, section-12.7.ts) are edited with targeted `Edit`s, not rewrites.

Ordering: Part A turns the three red self-tests green (certification manifest/gate cluster). Part B lands shared helpers. Parts C–E are consumers, ordered by dependency; within a part, order is free. Parts A and B are complete: the CONF-VALID conformer (`test/fixtures/conf-valid/product.mjs`) now rejects `"`, `'`, `\`, `&`, and U+FFFD in segments and tags (14.4), reads attribute values verbatim, emits one 14.4 finding per offending `id`/`tags` attribute located at the attribute's own characters (name through closing quote), and emits tag sets in UTF-8 byte order with duplicates collapsed; P-1's oracle (`valueVerdict` in `test/suite/registry/section-16-p1.ts`) judges the same five characters invalid, since its alphabet already staged both quote characters.

Task 8 landed (459ea19, ca381ee): the harness vocabulary (`test/helpers/adapters/model.ts`) holds SPEC 14's 25 condition tokens — `USAGE_ERROR_CONDITION_CODE_TOKENS` names 14.24 `write-failure` and 14.25 `read-failure`, which the findings-array decode rejects and only the exit-2 error document's `code` admits — and no `refused-unresolvable-reference`. T14-6's 14.24/14.25 arms stage T14-9 (f) (`.xspec` unwritable on a stale workspace, `stageWriteRefusalUnder`) and T14-10 (g) (`specs/sub` unlistable, `stageReadRefusalOfDirectory`) through `test/helpers/permissions.ts`, Linux-gated by the NU3_STAGED pattern; a discovered source's refused content read is condition 20 (SPEC 14.25, T14-10 (a)), never `read-failure`, so Tasks 10–11 must not stage it as one. Against the built product both refusals end in exit 70 (an internal error at the `EACCES`), so T14-6 fails as a diagnosed product failure at its 14.24 arm and T14-9/T14-10 will diagnose the same.

Task 9 landed: T13.5-7 is rewritten as "interrupted or write-refused mutation: the pinned write order" — the refusal arms (a)–(f), their fixtures, stagings, twins, and pinned-state laws live in `test/suite/registry/write-refusal-staging.ts` (section-13.5.ts composes them and re-exports the hold helpers `holdPathFor`/`awaitHoldFile`, which moved there). For Task 10's T14-9 reuse: `RENAME_FIXTURE`/`MOVE_FIXTURE` (each with a prior journaled rename that makes the workspace journal-bearing — `build` creates no journal), `prepareRefusalWorkspace` (build, prior rename, `check` clean, git commit as the `impact` baseline), `completeOnTwin`, `runHeldWithStaging`/`runStaged` (staging applied at the seam, restored at exit), `refusalAt`/`refusalUnder` (the T14-9 disciplines), `expectWriteFailure` (exit 2, the error document, `code` `write-failure`, `path` among the admissible concerned paths), and the exported arms. The move fixture keeps the imported spec file under a second glob root (`docs/Other.mdx`) so `out/specs` holds exactly the two Markdown files (c) admits — SPEC 12.1 makes a regeneration rewrite every derived file, so a third `.mdx` under `specs/` would put a third refused write there. Red-checked with a stand-in that maps the product's exit-70 `EACCES` crash to the error document (AGENTS.md): every arm passes against the product's real partial states except (d), where the product rewrites the importer `src/app.ts` before removing the origin — a diagnosed product deviation from 13.5's order (the relocation's two writes precede `src/` in `files` order). Against the built product T13.5-7 fails diagnosed at arm (a)'s exit-code assertion (exit 70).

---

## Part C — §13.5 / §14 consumers (after Part B)

## Task 10 — Register T14-9 (write failures, 14.24)

- **Source:** reviewer B gap 5; reviewer C gap 4.
- **Requirement:** TEST-SPEC.md **T14-9** (line 569 — read it whole; it is truncated in the findings): contract (a refused write is a usage error, exit 2, never a finding; stdout the error document under `--json` and on JSON-only surfaces, `code` `"write-failure"`, `path` the concerned path; stderr the diagnostic; the command stops at that write), concerned paths one arm each through T13.5-7's stagings (Task 9's helper), graph data concerning the area `.xspec`, the reporter set (`build`, `rename`, `move`, every refreshing read of 13.3 on a stale workspace with `.xspec` unwritable — `ids`, `show`, `coverage`, `impact --base`, `review status`, `query`, `occurrences`, `view`, `at` — and the mutating `review` subcommands; never `check` (exit 1 with the staleness), `inventory` (exit 0), `version`, or a `--preview` (exit 0)), and the precedence arms (on (f)'s stale staging `query nodes --group <code-group>` exits 2 with the invalid-flag-value error, `code` `null`; `query node specs/a/A.mdx#missing` the unknown-node error; on a twin also failing validation `ids` exits 1 with the findings; a rename refused by validation (T6.4-3) under (a)'s staging exits 1, no write attempted; a hold file that cannot be created is 13.5's usage error, never this condition).
- **Files:** `test/suite/registry/section-14.ts` (new entry), `index.ts`, `traceability.ts` ("14", "12.0", "12.7", "13.3", "13.5").
- **Verify:** registered, Linux-gated, passes or fails as diagnosed; S-1 green.
- **Depends on:** Tasks 4, 8, 9.

## Task 11 — Register T14-10 (read failures, 14.25)

- **Source:** reviewer B gap 6; reviewer C gap 4.
- **Requirement:** TEST-SPEC.md **T14-10** (line 570 — read it whole): staging (file `0o200`, directory `0o100`, nonexistence never a refusal); one arm per row of 14.25: (a) a discovered source's content — spec source `specs/B.mdx` referenced from `specs/A.mdx`, and separately a code source: condition 20 at `build` and `check`, exit 1, one location `{"start": 0, "end": 0}`, masked as unparseable (A's reference reports 14.5, nothing inside B reports); `view specs/A.mdx specs/B.mdx` serves A's view with B's condition-20 finding, exit 1; `occurrences` lists no record for B's spellings; `at specs/B.mdx 0`, `7`, `999999` each report the resolution explicitly unavailable beside the finding, exit 1, never the out-of-range usage error; (b) the journal's content — condition 13 concerning `.xspec/journal` from `build`, `check`, the gated reads (`ids` exits 1 answering nothing), `rename` refused with that finding alone, `inventory` `journal.occupied` `true` finding-free exit 0; (c) a session file's content — condition 21 from `check`, `review status <name>` (exit 1, exactly one `corrupt-session` finding, nothing modified), `review list` (session reported corrupt, exit 1), `inventory` listing the session; and every further row the entry lists after (c).
- **Files:** `test/suite/registry/section-14.ts` (new entry), `index.ts`, `traceability.ts` ("14", "11.2", "11.5", "11.6", "13.3", "10.7" as asserted).
- **Verify:** registered, Linux-gated, passes or fails as diagnosed; S-1 green.
- **Depends on:** Tasks 4, 8.

## Task 12 — T12.7-3: nonexistent `--config` byte-for-byte, symlink physical resolution, `write-failure`/`read-failure` documents

- **Source:** reviewer B gap 24.
- **Requirement:** TEST-SPEC.md **T12.7-3** (line 513); SPEC.md 12.7 error document, 7 (configuration location and anchoring), 14.24/14.25.
- **Files:** `test/suite/registry/section-12.7.ts` `runErrorConfigPathsArm` (stages only the canonical `../cfg/xspec.config.ts` today).
- **Do:** add arms: a nonexistent `--config` reported byte-for-byte as given — `./../cfg//xspec.config.ts` and an absolute path — versus a malformed *existing* file reported in the anchoring form; the symlink physical-resolution arm (`--config ./../xspec.config.ts` from `R/L`, where `R/L` is a symlink to `R/a/b`, reported as `../xspec.config.ts`); `write-failure` and `read-failure` error documents with their concerned `path` (stage with the permission-staging helper `test/helpers/permissions.ts`, Linux-gated).
- **Verify:** passes or fails as diagnosed; the `--config` arms run on every platform, the permission arms on Linux only.
- **Depends on:** Tasks 4, 8.

## Task 13 — T14-7 remaining arms: destination-only refusals, import-cycle location, no unlisted code

- **Source:** reviewer B gap 30 (non-identities clauses).
- **Requirement:** TEST-SPEC.md **T14-7** (line 567); SPEC.md 14 refusal reasons, 6.5.
- **Files:** `test/suite/registry/section-14.ts` T14-7.
- **Do:** `refused-invalid-destination` alone (no second reason) for destinations `./a.mdx`, `specs//b.mdx`, `specs/../specs/b.mdx`; the import-cycle location arm — an existing import declaration plus a local reference spelling whose rewrite would add the import, the refusal locating the declaration per the entry; assert that no report carries a code outside SPEC.md 14's list (`assertRefusalReport` rejects unknown codes).
- **Verify:** passes or fails as diagnosed.
- **Depends on:** Task 6 (landed: `assertRefusalIdentities` / `assertFindingIdentities` in `test/suite/registry/support.ts`; every `RefusalExpectation` now states `identities` exactly where SPEC 14 pins it).

## Task 14 — Register T14-11 (per-condition ranges)

- **Source:** reviewer B gap 7; reviewer A gaps 4–5 cite it for the per-attribute location.
- **Requirement:** TEST-SPEC.md **T14-11** (line 571): byte-precise fixtures against precomputed offsets, one arm per range rule of SPEC.md 14 (the attribute range for 1.4's conditions, the zero-length `{"start":0,"end":0}` range for masked files, the container range for 2.7's condition 16, and every other rule the entry enumerates).
- **Files:** `test/suite/registry/section-14.ts` (new entry), `index.ts`, `traceability.ts` ("14" plus each condition's home passage as asserted).
- **Do:** stage each fixture with offsets computed from the staged bytes (`Buffer.byteLength` over the exact prefix), never from string indices; assert `{"start","end"}` exactly (T12.7-1's range form decoder).
- **Verify:** registered; passes or fails as diagnosed; S-1 green.

## Task 15 — T13.5-1: `build --test-hold --json` consumes `--json` as the hold path

- **Source:** reviewer B gap 26.
- **Requirement:** TEST-SPEC.md **T13.5-1** (line 548); SPEC.md 13.5/12.0 (`--test-hold` takes a value; `build` is not a mutating command — the arm exits 2 with empty stdout). T13.5-1 is in CONF-CORE's scope: the conformer `test/fixtures/conf-core/product.mjs` must pass the arm (its argument parsing may need the fix), and every CONF-CORE violator's expected outcome on T13.5-1 (only EARLYWRITE and EARLYREFRESH fail it) must be unchanged.
- **Files:** `test/suite/registry/section-13.5.ts` T13.5-1 (~860–900, beside the non-mutating unknown-flag arm); `test/fixtures/conf-core/product.mjs` only if it fails the arm.
- **Verify:** `npm run test:self` green (certification of CONF-CORE re-run); passes or fails as diagnosed against the product.

## Task 16 — T13.3-2: an absent record stays absent after a refreshing read

- **Source:** reviewer B gap 25.
- **Requirement:** TEST-SPEC.md **T13.3-2** (§13.3); SPEC.md 13.3, 11.6.
- **Files:** `test/suite/registry/section-13.3.ts` T13.3-2 (probes `inventory` on the corrupt-record arm only).
- **Do:** on the graph-data deletion arm, after a refreshing read (e.g. `ids`), assert `inventory` reports `recorded` `[]` and `check` is clean (exit 0, no findings).
- **Verify:** passes or fails as diagnosed.

## Task 17 — T14-2: escape-spelled `d` reference and marker resolve nowhere

- **Source:** reviewer B gap 28.
- **Requirement:** TEST-SPEC.md **T14-2** (line 562); SPEC.md 2.2/2.4 (verbatim literals), 4.5, 14.5, 14.7.
- **Files:** `test/suite/registry/section-14.ts` T14-2.
- **Do:** add `d={"lo\u0067in"}` → condition 14.5 (the seven-character literal, never `login`), and a TypeScript marker `SPEC.lo\u0067in` → condition 14.7 with no type error reported (the identifier is `login` to TypeScript but the marker text is read verbatim). Write both spellings doubled and verify the file bytes (preamble).
- **Verify:** passes or fails as diagnosed.

---

## Part D — §1–8 arms (after Part B)

## Task 18 — T1.4-1 and T1.4-4: the rewritten 1.4 alphabet, verbatim spellings, per-attribute location

- **Source:** reviewer A gaps 4, 5.
- **Requirement:** TEST-SPEC.md **T1.4-1** (line 57) and **T1.4-4** (line 60); SPEC.md 1.4 (segments and tags may not contain `"`, `'`, `\`, `&`, or U+FFFD; attribute values read verbatim — escape and entity spellings are their literal characters), 14 (the finding located at the attribute, T14-11). Both tests are in CONF-VALID's in-scope list (CERTIFICATIONS.md line 78).
- **Files:** `test/suite/registry/section-1.4.ts`.
- **Do:** T1.4-1 — one arm per new character in a segment (`"`, `'`, `\`, `&`, U+FFFD), each a workspace differing in one segment; verbatim arms `id="a\u002Eb"` and `id="a&#46;b"` → condition 4 (invalid characters, never a `.`-separated two-segment ID); every finding located at the attribute (its exact range, precomputed from bytes — the conformer locates a 14.4 finding at the attribute's own characters, `id`/`tags` name through the closing quote, one finding per offending attribute however many segments or tokens violate). T1.4-4 — the same five characters in a tag; `tags="x\u0079"` → 14.4 (a tag containing `\`); per-attribute location. Write escape spellings doubled and verify the bytes (preamble).
- **Verify:** `npm run test:self` green — T1.4-1/T1.4-4 pass against CONF-VALID and fail against VIOL-VALID-CTRL / VIOL-VALID-WIDE exactly as their entries state (CERTIFICATIONS.md lines 82–94); against the product, pass or diagnosed failure.
- **Depends on:** Task 7 (landed).

## Task 19 — P-1: `"`, `'`, `\`, `&`, U+FFFD are invalid boundary classes; quote-bearing draws staged and predicted rejected

- **Source:** reviewer B gap 31.
- **Requirement:** TEST-SPEC.md §16 **P-1** (line 581) and the §16 preamble; SPEC.md 1.4. In CONF-VALID's scope (line 78).
- **Files:** `test/suite/registry/section-16-p1.ts` (header ~60–95, `quoteKindFor`, the redraw of both-quote draws).
- **Do:** the oracle part landed with Task 7: `valueVerdict` judges `"`, `'`, `\`, `&`, U+FFFD invalid, the header and alphabet comments state that the two quote characters are invalid boundary classes staged in the other quote kind and predicted **rejected** (never set aside), and the fixed seeds certify green that way. Remaining: `\`, `&`, and U+FFFD are not yet drawn — add each to `ALPHABET` as an invalid boundary class with the boundary weighting the entry fixes, and rewrite the header bullet that says their entries are "still to land". A draw bearing both quote kinds stays unstaged: TEST-SPEC P-1 says it "admits no static-string spelling and is not staged — invalid under the oracle too, so its exclusion loses no prediction" (`spellable`'s redraw), and TEST-SPEC governs over this plan's earlier "staged in either" wording. Keep the fixed seed set of E-5 (`XSPEC_PROPERTY_SEED`, `test/helpers/property.ts`); if a self-test pins P-1's draw statistics (`test/self/property-infrastructure.test.ts`), update the pin deliberately with the reason.
- **Verify:** `npm run test:self` green (P-1 certifies against CONF-VALID and its violators per the document); against the product, pass or diagnosed failure.
- **Depends on:** Task 7 (landed).

## Task 20 — T1.5-2 and T11.5-3: U+FFFD-pathed sources on both legs, staging shared

- **Source:** reviewer A gap 6; reviewer B gap 17.
- **Requirement:** TEST-SPEC.md **T1.5-2** (§1.5) — a source at `specs/A�.mdx` on either leg (the path spelled with U+FFFD; the path's bytes non-UTF-8, which decode to U+FFFD — Linux only) → condition 14.19 with the concerned path a plain string; `view` by a glob serves it with identities unavailable; it is nameable by no argument. **T11.5-3** (§11.5) — `at 'specs/A�.mdx' 0` on either leg is a malformed value, exit 2, never an answer. SPEC.md 1.5, 11.5, 12.0, 14.19.
- **Files:** `test/helpers/workspace.ts` (extract the non-UTF-8 path staging that `test/suite/registry/section-11.5.ts` performs around lines 1031–1060 and 1205 (`NU3_STAGED`) into an exported helper, e.g. `stageNonUtf8Path`, so both tests share it); `test/suite/registry/section-1.5.ts` (T1.5-2 arms); `test/suite/registry/section-11.5.ts` (T11.5-3: today the U+FFFD spelling is staged only as an *unknown* file against a non-UTF-8-pathed source; add the U+FFFD-spelled-path leg on every platform and assert exit 2 on both legs).
- **Verify:** T11.5-3's existing arms unchanged; both tests pass or fail as diagnosed; `npm run test:self` green (S-2 if the builder gains the helper — add a builder self-test case for it).

## Task 21 — T2.1-2 and T4-2: lexical specifier resolution, code-group-only targets, above-root ascent, escape-spelled specifiers

- **Source:** reviewer A gaps 7, 11.
- **Requirement:** TEST-SPEC.md **T2.1-2** (§2.1) and **T4-2** (§4); SPEC.md 2.1 (import specifiers resolved lexically against the importing file — `./sub/../BASE.xspec` resolves without `sub/` existing; `.//`, `././`, `../specs/BASE.xspec` resolve; a target that is an `.mdx` matched only by a code group, an ascent above the workspace root — even to a real `outside/BASE.mdx` — and an escape-spelled specifier `"./B\u0041SE.xspec"` are condition 14.15), 4 (generated modules resolve the same way; markers record the edges).
- **Files:** `test/suite/registry/section-2.1.ts` (T2.1-2: the lexical positives with `view` reporting `specs/BASE.mdx`; the code-group-only `.mdx` arm; the above-root arm with a real file outside; the escape-spelled arm), `test/suite/registry/section-4.ts` (T4-2: the above-root arm, `"./N\u0041ME.xspec"`, and the lexical positives `./sub/../NAME.xspec`, `.//NAME.xspec` resolving with edges recorded by the markers).
- **Verify:** both tests pass or fail as diagnosed; escape bytes verified.

## Task 22 — Register T2.4-5 (verbatim literals)

- **Source:** reviewer A gap 1.
- **Requirement:** TEST-SPEC.md **T2.4-5** (line 110): 2.4 reads every static string literal and quoted attribute value exactly as spelled — read the entry whole for its arms; SPEC.md 2.4. Excluded from certification (CERTIFICATIONS.md §Exclusions, ~line 195).
- **Files:** `test/suite/registry/section-2.4.ts` (new entry after T2.4-4), `index.ts`, `traceability.ts` ("2.4", "14" as asserted).
- **Verify:** registered (S-1 green); passes or fails as diagnosed; escape bytes verified.

## Task 23 — T2.5-3: escape- and entity-spelled coverage values are invalid, located at the attribute

- **Source:** reviewer A gap 8.
- **Requirement:** TEST-SPEC.md **T2.5-3** (line 116); SPEC.md 2.5 (values read verbatim), 14.17.
- **Files:** `test/suite/registry/section-2.5-2.6.ts` (T2.5-3).
- **Do:** arms `coverage="n\u006Fne"` and `coverage="&#110;one"` → condition 14.17, the finding located at the attribute (exact range from bytes). T2.5-3 is in no certification scope (confirm) — no fixture work.
- **Verify:** passes or fails as diagnosed; escape bytes verified.

## Task 24 — T2.7-1: a section element inside an expression container is condition 16 at the container

- **Source:** reviewer A gap 9.
- **Requirement:** TEST-SPEC.md **T2.7-1** (§2.7); SPEC.md 2.7, 14.16.
- **Files:** `test/suite/registry/section-2.7.ts`.
- **Do:** arm `{<S id="x">…</S>}`: no node `x` exists (`ids`/`query` do not list it), exactly one condition-16 finding located at the container, and `view --text` preserves the container's bytes verbatim.
- **Verify:** passes or fails as diagnosed.

## Task 25 — T3-3: a multi-line opening tag merges its lines

- **Source:** reviewer A gap 10.
- **Requirement:** TEST-SPEC.md **T3-3** (§3); SPEC.md 3 (an opening tag spanning three lines — `<S`, LF, `  id="x"`, LF, `>` — is one tag: the three lines merge, dropped or kept per the residue rule, byte-asserted). In CONF-MD's scope (CERTIFICATIONS.md lines 96–100; the scope names this arm at line 98).
- **Files:** `test/suite/registry/section-3.ts`; `test/fixtures/conf-md/` only if the conformer fails the arm (VIOL-MD-CLASS / VIOL-MD-CR outcomes must stay exactly as documented).
- **Verify:** `npm run test:self` green (CONF-MD certification re-run); passes or fails as diagnosed against the product.

## Task 26 — T4.4-1: the branding-collision message names both workspace-relative source paths

- **Source:** reviewer A gap 12.
- **Requirement:** TEST-SPEC.md **T4.4-1** (§4.4); SPEC.md 4.4 (the error **message** contains both `/`-separated workspace-relative source paths, `specs/A.mdx` and `specs/B.mdx`, as substrings — not generated-file paths, native separators, or stems).
- **Files:** `test/suite/registry/section-4.3-4.4.ts` (~555–580: today any standard rendering containing the module stem passes).
- **Do:** assert the message string contains `specs/A.mdx` and `specs/B.mdx` (exact substrings) and reject a rendering that names only stems or generated files.
- **Verify:** passes or fails as diagnosed.

## Task 27 — T4.6-3: wrapper and value forms, default exports, body-less declarations, escape-spelled names

- **Source:** reviewer A gap 13.
- **Requirement:** TEST-SPEC.md **T4.6-3** (§4.6); SPEC.md 4.6 (code locations and attribution).
- **Files:** `test/suite/registry/section-4.6.ts`.
- **Do:** arms for wrapper/value forms — `(() => …)`, `as`, `satisfies`, `!` — attributing to the declared unit; default-export forms; overloads, body-less, `abstract`, and `declare` declarations are not units (`path#f` rather than `path#f@3`, `path#C.m`, `path#C.v` rather than `@2`); `function f\u006Fo()` binds no unit (the escape-spelled name is read verbatim).
- **Verify:** passes or fails as diagnosed; escape bytes verified.

## Task 28 — T5.7-4: a chain rooted at a doubly-bound identifier records no occurrence

- **Source:** reviewer A gap 14.
- **Requirement:** TEST-SPEC.md **T5.7-4** (§5.7); SPEC.md 5.7 (reference occurrences), 4.5 (same-scope collisions, T4.5-8 at line 182).
- **Files:** `test/suite/registry/section-5.7.ts` (reuse T4.5-8's staging from `test/suite/registry/section-4.5.ts`: an identifier bound by both a spec-module import and a same-scope value declaration).
- **Do:** a member chain rooted at that identifier records **no** occurrence (`occurrences` lists none for it; the graph carries no edge from it).
- **Verify:** passes or fails as diagnosed (T4.5-8 itself is a diagnosed product failure today — T5.7-4's arm may fail the same way; state the diagnosis).

## Task 29 — T6.5-1: canonical import spellings over three geometries; same-directory relocation

- **Source:** reviewer A gap 16 (remaining clauses; the mapping's root pair is Task 5).
- **Requirement:** TEST-SPEC.md **T6.5-1** (§6.5); SPEC.md 6.5 (rewritten specifiers are canonical: `./sub/A.xspec`; an importer's quote kind kept — `'../C.xspec'`; `../x/A.xspec`; a file relocated within its own directory — `A.mdx` → `A2.mdx` — leaves its own `./C.xspec` / `.//C.xspec` specifiers untouched and unreported while every importer is rewritten, the preview's `files` holding exactly two entries).
- **Files:** `test/suite/registry/section-6.5.ts` (T6.5-1; targeted edits — the file is large).
- **Do:** the three-geometry canonical-spelling contract (one arm each, byte-asserted rewrites); the same-directory relocation arm with the preview `files` cardinality asserted through the form-exact preview decoder.
- **Verify:** passes or fails as diagnosed.
- **Depends on:** Task 5.

## Task 30 — T6.5-6: no-op rewrites are not reported and moved text is byte-identical

- **Source:** reviewer A gap 19.
- **Requirement:** TEST-SPEC.md **T6.5-6** (line 276); SPEC.md 6.5 (identity terms; a descendant `x.c` referenced as `d={"x.c"}` inside the moved subtree needs no rewrite: the origin deletion carries no `id-rewrite`/`reference-rewrite` and the moved text is byte-identical).
- **Files:** `test/suite/registry/section-6.5.ts` (T6.5-6).
- **Verify:** passes or fails as diagnosed.

## Task 31 — Register T6.5-11 (TypeScript `text(...)` calls across the move)

- **Source:** reviewer A gap 2.
- **Requirement:** TEST-SPEC.md **T6.5-11** (line 283) — read whole; SPEC.md 6.5, 4.3. Excluded from certification (CERTIFICATIONS.md §Exclusions, ~line 185).
- **Files:** a new module `test/suite/registry/section-6.5-ii.ts` (precedent: `section-10.7-i.ts`/`-ii.ts`; keeps the edit bounded — `section-6.5.ts` is very large), `index.ts`, `traceability.ts` ("6.5", "4.3" as asserted), the wrapper/declaration per the preamble.
- **Verify:** registered (S-1 green); passes or fails as diagnosed.

## Task 32 — T7-1: an occupied configuration path is condition 14.14

- **Source:** reviewer A gap 20.
- **Requirement:** TEST-SPEC.md **T7-1** (line 301); SPEC.md 7 (location), 14.14.
- **Files:** `test/suite/registry/section-7-basics.ts` (T7-1).
- **Do:** a directory named `xspec.config.ts` and, separately, a symbolic link named `xspec.config.ts` in the working directory → 14.14, exit 2, for every command but `version`, the concerned path the working directory's entry; `--config` naming such an object → exit 2.
- **Verify:** passes or fails as diagnosed.

## Task 33 — T7-2 and T7-3: verbatim literals, encoding, repeated keys, empty and U+FFFD names

- **Source:** reviewer A gaps 21, 22.
- **Requirement:** TEST-SPEC.md **T7-2** and **T7-3** (§7); SPEC.md 7 (the configuration is read verbatim — a `\u002A` in a glob is not `*`, `prod\u0075ct` is not the group `product`; non-UTF-8 content and a BOM are 14.14; a repeated key, an empty name, and a U+FFFD group/profile/rule name are 14.14; comments are permitted where the entry says), 14.14.
- **Files:** `test/suite/registry/section-7-basics.ts` (T7-2, T7-3).
- **Do:** T7-2 — the verbatim-literal arms, the encoding arms (non-UTF-8 bytes; BOM), repeated-key, empty-name, and comments arms exactly as the entry lists them; T7-3 — U+FFFD group, profile, and rule names → 14.14. Escape bytes verified.
- **Verify:** passes or fails as diagnosed.

## Task 34 — T7-4: patterns outside the root by spelling; inside-but-empty spellings; platform-ordinary spellings

- **Source:** reviewer A gap 23.
- **Requirement:** TEST-SPEC.md **T7-4** (§7); SPEC.md 7 (discovery patterns: `a/../../x`, `**/../x`, `/specs/*.mdx` escape the root by spelling → 14.14; `a/../b`, `./specs`, `specs//`, `specs/*.mdx/` are inside and match nothing; `C:/…` is an ordinary relative spelling on Linux; `a**b.mdx` as the entry states). In CONF-DISC's scope (CERTIFICATIONS.md lines 118–122; the scope names this contract at line 120).
- **Files:** `test/suite/registry/section-7-discovery.ts` (T7-4); `test/fixtures/conf-disc/` only if the conformer fails an arm (VIOL-DISC-DIALECT / SYMLINK / DERIVED outcomes must stay as documented).
- **Verify:** `npm run test:self` green (CONF-DISC re-certified); passes or fails as diagnosed against the product.

## Task 35 — T7.3-1: `outDir` value validity

- **Source:** reviewer A gap 24.
- **Requirement:** TEST-SPEC.md **T7.3-1** (§7.1–7.3); SPEC.md 7.3, 14.14.
- **Files:** `test/suite/registry/section-7.1-7.3.ts` (T7.3-1).
- **Do:** `outDir` `""`, `"/out"`, `"./out"`, `"out/../x"`, `"out//x"`, `"out/"` → 14.14 (exit 2, concerned path the configuration); `"out/sub"` valid.
- **Verify:** passes or fails as diagnosed.

## Task 36 — Configured sets are read as sets: T7.4-1, T7.5-1, T11.6-2

- **Source:** reviewer A gaps 25, 26; reviewer B gap 19.
- **Requirement:** SPEC.md 7.4, 7.5 (list-valued configuration read as a set), 11.6 and 12.7 (a set datum is byte-ordered with duplicates collapsed); TEST-SPEC.md **T7.4-1**, **T7.5-1** (§7), **T11.6-2** (§11.6).
- **Files:** `test/suite/registry/section-7.4-7.5.ts` (T7.4-1, T7.5-1), `test/suite/registry/section-11.6.ts` (T11.6-2 asserts only the default `targetTags: null` / all kinds today).
- **Do:** T7.4-1 — `targetTags: ["z","a","a"]`, `edgeKinds: ["references","depends","depends"]` → `inventory` reports `["a","z"]` / `["depends","references"]` and the coverage report equals the collapsed twin's byte for byte; T7.5-1 — rule `kinds` and selector `tags` collapsed and ordered, `check` equal to the twin; T11.6-2 — `targetTags ["z","a","a"]` → `["a","z"]`, `edgeKinds ["references","depends"]` → `["depends","references"]`, rule `kinds ["embeds","depends"]` → `["depends","embeds"]`, tags selector `["b","a","b"]` → `["a","b"]`, each compared literally (`toEqual` on the decoded arrays, no sorting in the harness).
- **Verify:** all three pass or fail as diagnosed; none is in a certification scope (confirm).

## Task 37 — Tag-set datum compared literally: T2.6-1/2/3 drop `sortedTags`; T11.4-3 tag-set form arms

- **Source:** reviewer A gap 27; reviewer B gap 15.
- **Requirement:** TEST-SPEC.md §0 **H-3** (value forms asserted, never normalized away); SPEC.md 12.7 (a tag set is emitted in byte order with duplicates collapsed — the datum, not merely the set); TEST-SPEC.md **T2.6-1/2/3** (§2.6), **T11.4-3** (§11.4: `tags="b a a"` → `["a","b"]`, `tags="z A"` → `["A","z"]`, on the view node and through `query node` and `show --json`). T2.6-1 and T2.6-2 are in CONF-VALID's scope (line 78), T11.4-3 in CONF-AVAIL's (line 151).
- **Files:** `test/suite/registry/section-2.5-2.6.ts` (`sortedTags` at ~194, applied at ~844/880/955/1103 — remove; compare the decoded arrays literally), `test/suite/registry/section-11.4.ts` (T11.4-3, ~1385: only `tags="solo"` today); `test/fixtures/conf-avail/` if the conformer does not emit byte-ordered collapsed sets (CONF-VALID's emission is Task 7).
- **Verify:** `npm run test:self` green (CONF-VALID and CONF-AVAIL re-certified, violator outcomes unchanged); the tests pass or fail as diagnosed against the product.

---

## Part E — §10–12 arms (after Part B)

## Task 38 — Register T10.1-6 (session-directory and area occupancy; `create`'s ordering)

- **Source:** reviewer B gap 1.
- **Requirement:** TEST-SPEC.md **T10.1-6** (line 350) — read whole; SPEC.md 10.1, 13.4, 14 (the occupancy conditions the entry names).
- **Files:** `test/suite/registry/section-10.1.ts` (new entry), `index.ts`, `traceability.ts` ("10.1", "13.4", "14" as asserted).
- **Verify:** registered (S-1 green); passes or fails as diagnosed.

## Task 39 — T10.7-1: `review create --name` of an existing corrupt session

- **Source:** reviewer B gap 8.
- **Requirement:** TEST-SPEC.md **T10.7-1** (§10.7); SPEC.md 10.7, 14.21.
- **Files:** `test/suite/registry/section-10.7-i.ts` (T10.7-1 stages no corrupt session today; reuse `test/helpers/adapters/session-staging.ts`).
- **Do:** stage a corrupt session file named `<name>`; `review create --name <name>` → exit 1 with exactly one condition-21 `corrupt-session` finding, no code-less refusal, nothing modified.
- **Verify:** passes or fails as diagnosed.

## Task 40 — `--file` pattern spellings on `query`, `occurrences`, `view`, `ids`: T11-2, T11.3-2, T11.4-2, T12.3-1

- **Source:** reviewer B gaps 9 (`--file` clauses), 12, 14, 22.
- **Requirement:** SPEC.md 11.1, 11.3, 11.4, 12.3, 12.0 (a `--file` pattern escaping the root by spelling — `a/../../x`, `/specs/*.mdx` — is a usage error, exit 2; an inside pattern with a `.` or empty segment — `./specs/*.mdx`, `specs//*.mdx` — is admitted and matches nothing: exit 0, no rows / empty listing); TEST-SPEC.md **T11-2** (§11.1), **T11.3-2** (§11.3), **T11.4-2** (§11.4), **T12.3-1** (§12.3).
- **Files:** `test/suite/registry/section-11.ts` (T11-2 ~834: only `../*.mdx` today), `test/suite/registry/section-11.3.ts` (T11.3-2 ~1140–1160: outside arms only), `test/suite/registry/section-11.4.ts` (T11.4-2: `nosuch/**/*.mdx` only, no outside-root arm), `test/suite/registry/section-12.3-12.5.ts` (T12.3-1: `../*.mdx` and `apecs/**` only); a shared arm table in `test/suite/registry/support.ts` (spelling → expected class) is welcome.
- **Do:** per test the arms its entry lists — outside-by-spelling → exit 2 (`code` `null`), inside-matching-nothing → exit 0 with the surface's empty answer form (form-exact decoders).
- **Verify:** the four tests pass or fail as diagnosed.

## Task 41 — 1.4's alphabet in command values: T11-2 `--tag` syntactic acceptance; T11.3-3 `--to` segments

- **Source:** reviewer B gaps 9 (`--tag` clause), 13.
- **Requirement:** SPEC.md 1.4, 12.0 (a malformed tag or identity spelling is a syntax-class usage error, exit 2, judged before configuration is loaded and before any identity reading); TEST-SPEC.md **T11-2** (§11.1: a well-formed absent tag → exit 0 empty; each malformed spelling — empty, `'a b'`, `#`, `then`, a control character, `"`, `'`, `\`, `&`, U+FFFD — → exit 2 without loading configuration), **T11.3-3** (§11.3: `--to` segments containing `"`, `'`, `\`, `&` — one arm each — and U+FFFD in the path or the id part → exit 2 before identity reading).
- **Files:** `test/suite/registry/section-11.ts` (T11-2), `test/suite/registry/section-11.3.ts` (`TO_MALFORMED` lacks all five).
- **Do:** add the arms; prove "without loading configuration" as T12.0-10 does (the same exit and error document with the configuration invalid or absent).
- **Verify:** both pass or fail as diagnosed.

## Task 42 — T11-4: `--kinds` list grammar

- **Source:** reviewer B gap 10.
- **Requirement:** TEST-SPEC.md **T11-4** (line 411); SPEC.md 11.1, 12.0 (`--kinds depends,`, `,depends`, `depends,,embeds` → exit 2; `depends,depends` reads as `depends` — answers byte-identical).
- **Files:** `test/suite/registry/section-11.ts` (T11-4 ~1152: only `--kinds nonsense` today).
- **Verify:** passes or fails as diagnosed.

## Task 43 — T11.2-6: the obstructing component is itself a discovered file

- **Source:** reviewer B gap 11.
- **Requirement:** TEST-SPEC.md **T11.2-6** (§11.2); SPEC.md 11.2, 13.4, 14.22.
- **Files:** `test/suite/registry/section-11.2.ts` (T11.2-6 stages only the outDir directory replaced by a non-source plain file today).
- **Do:** `outDir: "specs/A.mdx"` (a discovered source): `build` and `check` report condition 22 concerning `specs/A.mdx`; `view specs/A.mdx` is finding-free, exit 0.
- **Verify:** passes or fails as diagnosed.

## Task 44 — T11.4-4: `.xspec` specifier naming a code-group `.mdx`; non-canonical specifier reported canonical (CONF-AVAIL extended)

- **Source:** reviewer B gap 16; reviewer C dependency note (CONF-AVAIL's code-group wrong-kind target and BOM-masked target).
- **Requirement:** TEST-SPEC.md **T11.4-4** (§11.4); SPEC.md 11.4, 2.1, 14.15. In CONF-AVAIL's scope (CERTIFICATIONS.md line 151).
- **Files:** `test/suite/registry/section-11.4.ts` (T11.4-4: the unparseable-target arm exists; add the `.xspec` specifier designating a discovered code source — an `.mdx` matched only by a code group — and the non-canonical `./sub/../BASE.xspec` reporting `specs/BASE.mdx`); `test/fixtures/conf-avail/product.mjs` (extend the conformer to the reworked scope: the code-group wrong-kind target and the BOM-masked target, per the document's CONF-AVAIL scope text, lines 147–151; VIOL-AVAIL-NULLMARKER / OMIT / NOFILE outcomes unchanged).
- **Verify:** `npm run test:self` green (CONF-AVAIL re-certified); passes or fails as diagnosed against the product.

## Task 45 — T11.6-1: physical anchoring through a symlinked working directory

- **Source:** reviewer B gap 18.
- **Requirement:** TEST-SPEC.md **T11.6-1** (§11.6); SPEC.md 11.6, 7 (paths anchored at the physical workspace root).
- **Files:** `test/suite/registry/section-11.6.ts` (T11.6-1, ~411–806: no `symlink(` today).
- **Do:** `R/L → R/a/b` (a symlink inside the workspace): from `R/L`, `inventory` reports the root as `../..` and the configuration as `../../xspec.config.ts`; with a link located above both, `..`. Symlink creation must be an ordinary `fs.symlink` on Linux and macOS; on Windows the arm follows the harness's existing symlink handling (see T13.4-6's staging) — never a skip.
- **Verify:** passes or fails as diagnosed.

## Task 46 — U+FFFD in every argument position and normalization negatives: T12.0-5; U+FFFD arms of T6.4-3 and T6.5-5

- **Source:** reviewer B gap 20; reviewer A gaps 15 (U+FFFD clause) and 18.
- **Requirement:** SPEC.md 12.0 (a U+FFFD anywhere in an argument is a malformed value — syntax class, exit 2, judged before configuration is loaded, error document `code` `null`; `./specs/A.mdx` and `specs//A.mdx` are not normalized — exit 2); TEST-SPEC.md **T12.0-5** (§12.0: the two normalization negatives on `show` and `view`; U+FFFD in each position — node, file operand, `--file`, `--tag`, `--to`, `<new-id>`, session name, `--note`, `--base`, `--config`, `--test-hold`), **T6.4-3** (line 263: a U+FFFD or non-UTF-8 `<new-id>` → exit 2, never the `refused-invalid-id` refusal), **T6.5-5** (§6.5: destinations `specs/B�.mdx` and `specs/B.mdx#x�` → exit 2, `code` `null`).
- **Files:** `test/suite/registry/section-12.0-i.ts` (T12.0-5: four `show` arms today), `test/suite/registry/section-6.4.ts` (T6.4-3 ~1340), `test/suite/registry/section-6.5.ts` (T6.5-5). If T6.4-3's non-UTF-8 leg requires raw argv bytes the subprocess driver cannot pass (Node spawns strings), extend `test/helpers/subprocess.ts` with a Linux-only raw-bytes path (e.g. through `/bin/sh -c` with `$'\xff'` quoting) rather than dropping the leg.
- **Verify:** the three tests pass or fail as diagnosed; each U+FFFD arm proven configuration-independent (invalid or absent configuration, same outcome).
- **Depends on:** Task 6 (T6.4-3's exact-identities expectation).

## Task 47 — T12.0-10: one arm per syntax-class member, configuration-independent

- **Source:** reviewer B gap 21.
- **Requirement:** TEST-SPEC.md **T12.0-10** (line 469) — read whole; SPEC.md 12.0 (the syntax class: `--name=value`, a value-taking flag last, surplus operands, `--status`/`--strategy`/`--coverage bogus`, `--kinds` empty or with a foreign element, two exactly-one-of flags together, `--test-hold` beside `--preview`, a `view` operand beside `--file`, a `.x` session name, `+7`, a malformed `--to`, `--tag a\b`, `--file ../x`, and the rest the entry lists), each identical with the configuration invalid or missing, `code` `null`; plus `query nodes --group` of the wrong kind.
- **Files:** `test/suite/registry/section-12.0-ii.ts` (T12.0-10 stages five arms today; a table of `{argv, expectation}` rows keeps the edit bounded).
- **Verify:** passes or fails as diagnosed.

## Task 48 — Register T12.0-14 (invocation grammar)

- **Source:** reviewer B gap 2.
- **Requirement:** TEST-SPEC.md **T12.0-14** (line 473) — read whole (12.0's token rules, each arm discriminating a lenient parser: `--name=value`, `ids extra`, `ids --file --json`, `--`, `-a` names, `--kinds depends,`, and the remaining arms it lists); SPEC.md 12.0.
- **Files:** `test/suite/registry/section-12.0-ii.ts` or a new `section-12.0-iii.ts` (precedent `-i`/`-ii`), `index.ts`, `traceability.ts` ("12.0", plus each surface's passage as asserted).
- **Verify:** registered (S-1 green); passes or fails as diagnosed.

## Task 49 — Register T12.2-4 (staleness and policy on a failing workspace)

- **Source:** reviewer B gap 3.
- **Requirement:** TEST-SPEC.md **T12.2-4** (line 487) — read whole (14.10 and 14.12 confine themselves on a workspace failing validation as the entry states); SPEC.md 12.2, 13.3, 14.10, 14.12.
- **Files:** `test/suite/registry/section-12.1-12.2.ts` (new entry), `index.ts`, `traceability.ts` ("12.2", "13.3", "14" as asserted).
- **Verify:** registered (S-1 green); passes or fails as diagnosed.

---

End of plan: 49 tasks. When the last task is done, delete this file.
