# FIX_PLAN — Phase 10 (re-descent): product adherence to `specs/SPEC.md`

Source: the first Phase 10 compliance determination of the re-descent, at
`a45fb26` (branch `claude/xspec-ui-apis-4df8fa`, PR #7): reviewer A (SPEC
§1–6) 3 gaps, reviewer B (§7–11) 1 gap, reviewer C (§12–15) 2 gaps, VERIFY red
on exactly two diagnosed product failures — T6.5-7 and T6.5-9 (CI `suite-linux`
red on the same two; `harness-self` 346/346 and `suite-windows` green). Goal:
every test passes (`npm test` locally and in CI, the Windows E-6 leg included)
and the product meets SPEC.md.

Reviewer C's gap 2 (valid-UTF-8 argument values containing U+FFFD rejected as
usage errors, `src/cli/args.ts` `isValidUtf8ArgumentValue`) is NOT a task
here: it cannot be met under `specs/IMPLEMENTATION.md` (Node's `process.argv`
decoding makes a genuine U+FFFD and an invalid byte identical, and the only
remedy is a platform-specific raw-argv read, which IMPLEMENTATION.md forbids).
It is logged, dated 2026-09-03, in `specs/tmp/SPEC-PROBLEMS.md`; do not
implement or work around it — leave `isValidUtf8ArgumentValue` as it is until
the problem is resolved through the process.

**Re-descent note (2026-09-10, written by the Phase 9 loop).** This plan
predates the revisit that rewrote `specs/SPEC.md` (af2b468 … dcf3034) and
re-aligned `specs/TEST-SPEC.md` (664487b … dc09301) and
`specs/CERTIFICATIONS.md` (035b088, cbb0a35); `src/` is unchanged since
72ad038. The loop consuming this plan now runs under Phase 9, whose scope
guard forbids modifying `src/`, so each remaining task is researched and then
removed or amended here, never implemented; product gaps are re-derived by the
Phase 10 compliance determination against the revised SPEC once no plan file
exists (PROCESS.md, Ralph Loop, step 3). Task 1 (code-source import removal on
a section move, T6.5-7) was removed on this date: not implemented (the
code-file loop of `src/core/move.ts`, "Code files: chain retargets plus added
imports", still emits additions only), out of this phase's scope, and its
quoted 6.5 clause superseded — the rewritten 6.5 removes a declaration exactly
when an occurrence used a binding of its before the rewrite and none uses any
binding of its after it (a type-level spelling is no occurrence), which pins
the `text`-binding case the task left "conservative". Its diagnosis and code
pointers remain in git history at 72ad038.

**Task 2 removal (2026-09-10, the next Phase 9 iteration).** Task 2 (an
added code-file import binding a fresh identifier colliding with no
module-scope binding, T6.5-9) was removed on this date for this phase's scope
alone: it is not implemented — the code-file `taken` set in
`src/core/move.ts` (the section-move code loop, "Code files: chain retargets
plus added imports") is still seeded from `analysis.imports`' default and
`text` bindings only, and T6.5-9 run alone against the build of 090c72a
(`npx vitest run --config test/vitest.config.ts --project suite
test/suite/section-6.5.test.ts -t "T6.5-9"`) fails at the real move exactly
as diagnosed ("a valid move over the workspace the premise `build` accepted
succeeds (SPEC 6.5); a finding located in src/app.ts") — but, unlike Task 1,
nothing in it is stale: the freshness clause it quotes persists verbatim in
the rewritten 6.5 ("An added import binds fresh identifiers colliding with no
binding already in the file (2.1, 4) … the identifier choice and the
insertion offset are implementation latitude, exercised deterministically"),
the T6.5-9 paragraph of TEST-SPEC.md is byte-identical to 72ad038, and
the revisit's edits to T6.5-8 all concern the added declaration's specifier
(a 2.1-form specifier designating the module, its spelling and quote style
the product's; the harness asserts form and designation, never bytes) — what
`test/helpers/import-insertion.ts` already asserts (its `DECLARATION` pattern
accepts either quote kind and an optional semicolon), so no harness task
follows. Its requirement, diagnosis, and code pointers —
in git history at 090c72a — remain valid inputs to the Phase 10 re-plan, and
Task 3's references to "Task 2's staging" point at that history. One pointer
for that re-plan, not verified here: a clause the revisit added to 6.5 (absent
at 72ad038) requires a rewritten reference spelled through a binding the file
already holds to be one "no local declaration shadows at the occurrence
(4.5)", so the
existing-binding branch of the same loop (`analysis.imports.find(...)`, taken
before the fresh-name branch) needs the module-scope knowledge Task 2's step
1 collected as much as the fresh-name branch does.

**Task 3 removal (2026-09-10, the next Phase 9 iteration).** Task 3 (a
successful preview emitted before the in-memory re-validation that can
refuse the real operation, SPEC 6.6) was removed on this date for this
phase's scope alone: it is not implemented — `src/` is unchanged since
72ad038; in `src/cli/commands/move.ts` `runMoveFile` still returns
`emitSuccessfulPreview` (line 412) before `reanalyzeMoved` (431) and
`runMoveSection` does so at 649 before `reanalyzeSectionMoved` (667), as
`src/cli/commands/rename.ts` does at 224 before `reanalyzeRewritten` (240),
each re-validation guard still commented "Unreachable" — and it reproduces
against the build of 54b53a4 on a hand-staged workspace (the harness's E-6
configuration; `specs/Origin.mdx` holding `org` > `org.mv`;
`specs/Target.mdx` holding `hub`; `src/app.ts` holding `import ORG from
"../specs/Origin.xspec"`, `const Target = 1; void Target;`, and the marker
`ORG.org.mv`; `build --json` clean): `move specs/Origin.mdx#org.mv
specs/Target.mdx#mv --preview --json` exits 0 with `"findings": []`,
non-null `mapping`/`files`/`delta`, and an `import-addition` at `src/app.ts`
offset 40 (the text form exits 0 likewise), while the real move exits 1
with one `unsupported-node-usage` finding — `src/app.ts` 108–114, the local
`Target` of `void Target;` located in the in-memory rewritten bytes'
coordinates (shifted by the added declaration), not the on-disk file's —
every source byte unchanged after every run. Nothing in it is stale: the
6.6 sentence it quotes and the 13.5 exception persist verbatim in the
rewritten SPEC, as does the refused-preview encoding (`mapping`, `files`,
and `delta` `null`, 12.7); the revisit's only 6.6 edits are to the report
bullets (the mapping's one entry per node whose identity changes, the
specifier literal's delimiters, the self-closing target parent's insertion
point), none touching refusal equivalence; T6.6-3, T6.6-5, and T6.6-6 of
TEST-SPEC.md are byte-identical to 72ad038, and the re-wordings of T6.6-2
(the real run compared through the 12.7 performed-operation document,
`findings` `[]` and a byte-equal `mapping`) and T6.6-4 (the
self-closing-parent insertion offset; a file-move preview's `mapping`
entries) concern the success side only; and `emitFindingsRefusal(preview,
json, stdout, findings)` (move.ts 146, rename.ts 95) already routes a
preview refusal through `emitRefusedPreview`, so the change reads as
written. No harness task follows: T6.6-3's refusal arms are T6.4-3's and
T6.5-4's stagings, refusals both paths evaluate before either emits
(`core/refusal.ts`, ahead of the preview return), so no arm reaches the
post-planning re-validation, and none can once Task 2 lands (T6.5-9
requires that move to succeed) — the divergence is reachable today only
through Task 2's collision, as the task states, and the task's value is
holding 6.6's equivalence by construction. Its requirement, diagnosis, and
code pointers — in git history at 54b53a4 — remain valid inputs to the
Phase 10 re-plan. Two pointers, not verified here: the harness's
`test/suite/registry/section-6.6.ts` has no commit since 72ad038 while
T6.6-2 and T6.6-4 were re-worded (a matter for the Phase 9 compliance
determination, not this task); and a refusal raised by the re-validation
locates its finding in the rewritten bytes' coordinates (above), which the
re-plan should weigh wherever it keeps such a refusal reachable.

**Task 4 removal (2026-09-10, the next Phase 9 iteration).** Task 4
(references rooted at the binding of an invalid import or at a colliding
identifier masked instead of reported as unresolved at their own ranges,
SPEC 11.2, 14) was removed on this date for this phase's scope alone: it is
not implemented — `src/` is unchanged since 72ad038; the `"poisoned"` binding
kind still masks every chain rooted at such a binding
(`src/core/spec-references.ts` 120, 556–557, 588–602, 721, 779, 1072;
`src/core/code-analysis.ts` 424, 643, 814, 897, 1157, 1188, 1205–1207,
1313–1315, 1421–1425) — and its three scratch fixtures reproduce against the
build of 0c5a2b7 (a hand-staged workspace per `AGENTS.md`; `specs: { spec:
["specs/**/*.mdx"] }`, `code: { app: ["src/**/*.ts"] }`; `specs/SPEC.mdx`
holding `<S id="a">A</S>`): `specs/REF.mdx` as the task spells it reports
`unknown-dependency` 79–88, `unknown-text-target` 101–118, and
`invalid-import` 32–63 only — nothing for `NOPE.x` (90–96), `{text(NOPE.y)}`,
or `{text(NOPE)}`; `specs/COL.mdx` (`import A from "./SPEC.xspec"` twice,
then `<S id="c" d={[A.print]}>X {text(A.derived)}</S>`) reports the one
`invalid-import` locating both declarations (0–28, 29–57) and nothing else;
`src/bad.ts` (`import SPEC from "../specs/SPEC.xspec";`, `import NOPE from
"../specs/NOPE.xspec";`, `NOPE.x;`, `SPEC.print.nope;`) reports
`invalid-import` 40–79 and `unknown-ts-reference` 88–103 for the valid-import
chain, nothing for `NOPE.x` — identically on `build --json`, `check --json`,
and `view <file> --json`, exit 1 each. Nothing in it is stale; the revisit
pinned its collision arm harder: the rewritten 2.4 states that an identifier
a spec module import and another import, or a same-scope value-level
declaration, both bind "roots no resolving chain … no edge, no occurrence
(5.7) — and its spelling reports as unresolved (14.5–14.7) beside the
collision finding (14.15)"; 4.5 repeats it ("its chains unresolved (14.7)
beside the collision (14.15)"); 11.2's resolution paragraph now lists "a
chain rooted at an identifier a spec module import and another declaration
of its scope both bind (2.4)" among the spellings that record no edge and no
occurrence and are positioned by their finding's range; and the quoted 14
intro, 14's location rule for a no-occurrence spelling, 11.2's
"Unavailability is explicit" (now naming "an import's resolved target when
specifier form or discovery defines none"), and 11.4's closing persist in
substance. The invalid-import arm (a chain rooted at the binding of an
import designating nothing, or of invalid form) rests on those general
clauses alone: no TEST-SPEC test stages a reference through such a binding —
T2.1-2, T2.1-3, T4-2, and T11.4-4 exercise the import declarations
themselves, and `test/suite/registry/section-2.1.ts`, `section-4.ts`, and
`section-11.4.ts` are unchanged since 72ad038 — so the task's harness check
still holds there. A harness task does follow, for the collision arm:
TEST-SPEC's **T4.5-8 Same-scope collisions** (added by 3031926, after this
plan's baseline) asserts exactly the reporting Task 4 demands — condition 15
beside condition 7 for each chain, no edge, no occurrence, the spec-source
case's 14.5/14.6 — and the harness does not register it
(`test/suite/registry/section-4.5.ts` lists `T4_5_1` … `T4_5_7` in
`section45Tests`; no `T4.5-8` anywhere under `test/`), while
CERTIFICATIONS.md's Exclusions (line 188) keep it outside fixture
certification; it is Task 6 below. Task 4's requirement, diagnosis, and code
pointers — in git history at 0c5a2b7 — remain valid inputs to the Phase 10
re-plan, where T4.5-8, once registered, is the collision arm's failing test.
One pointer, verified by grep alone: T14-11 — cited by T4.5-8 for locating
every colliding declaration — is registered nowhere under
`test/suite/registry/` (`section-14.ts` covers T14-1 … T14-8), a matter for
the Phase 9 compliance determination, not this task.

**Rules for every task (read once per spawn):**

- Phase 10: never modify the test harness (`test/`). Product code (`src/`)
  only, plus `AGENTS.md` for new build/lint/run knowledge. Never couple
  product code to harness internals.
- Respect `specs/IMPLEMENTATION.md` (three layers: pure `core`, I/O
  `workspace`, rendering `cli`; one canonical JSON serializer; findings built
  as data and rendered once per output form; no new runtime dependencies; no
  platform-specific code paths).
- Every task is independent unless it says otherwise; work top to bottom.
- Build first (`npm run build`), then run the task's named suite files:
  `npx vitest run --config test/vitest.config.ts --project suite test/suite/<file>`
  (see `AGENTS.md`; add `--reporter=verbose` to see per-test results). The
  named files are the task's verification; the full suite (`npm test`, ~15 min
  on 4 cores) is the loop's final check, not each task's. Before committing:
  `npm run typecheck` and `npm run format`. Commit
  `sdg(phase-10): <imperative summary>`, push (see the spawn prompt for the
  required commit trailers and the push retry rule).
- Infrastructure caution: agents in this run have died from usage-credit
  exhaustion, container restarts, API overloads, and a single response
  exceeding the output-token ceiling. Issue a few tool calls per response,
  keep each payload modest, write files in bounded pieces, and land a coherent
  part early rather than one giant commit.
- When a task is done, remove it from this file in the same commit. If a task
  turns out too large for one spawn, land a coherent part and replace the task
  with precise remainder task(s) here. When the last task is removed, delete
  this file.
- If a task collides with a harness test that pins the opposite of what
  SPEC.md requires, do not bend the product to the test: record the
  contradiction, dated and precise, in `specs/tmp/TEST-SPEC-PROBLEMS.md`
  (`OUTCOME: PROBLEM`). Nothing found so far suggests one for the tasks
  below — the relevant fixtures were checked while planning (noted per task).

---

## Task 5 — Validate the baseline's content before the 13.3 gate, so a baseline that cannot be reconstructed exits 2 even when the current workspace also fails `build`'s validations (SPEC 12.0, 6.3, 13.3; reviewer C, gap 1)

**Requirement.** SPEC 12.0: "The argument checks of `rename` and `move` …
and baseline resolution (6.3) precede source validation: these usage errors
are reported, and the command exits 2, even when the current workspace also
fails the validations of `xspec build` (6.4, 13.3)"; exit class 2 includes
"a baseline that cannot be read or reconstructed (6.3)". SPEC 6.3: "if the
baseline content cannot be parsed and validated as a workspace, the command
MUST fail with an actionable error naming the offending entries or files; a
baseline that cannot be read or reconstructed is a usage error (12.0)".
Journal errors (14.13) are among `build`'s validations (13.3), so a baseline
whose own journal holds a malformed line cannot be validated as a workspace.

**Observed (reviewer C).** `impact --base <ref>` and `review create --base
<ref> --name <n>` validate the baseline content only after the current
workspace's gate. (a) Baseline commit whose `specs/A.mdx` has a section
without `id`; current `specs/A.mdx` with a duplicate id → exit 1,
`{"findings":[duplicate-id …]}`; expected exit 2 with the error document
naming the baseline's offending file. (b) A garbage line in `.xspec/journal`
committed at the baseline and unchanged in the current workspace → exit 1,
`journal-error` findings; expected exit 2 (the baseline journal is
unreplayable, so the baseline cannot be reconstructed). With a valid current
workspace the same invalid baseline already exits 2 — only the ordering
relative to the gate is wrong.

**Location.** `src/cli/commands/impact.ts` lines ~143–175: `readBaseline` →
`analyzeGraphForRead` (configuration errors, exit 2) → `assessWorkspaceRead`
gate (exit 1) → `validateBaselineContent` (exit 2). `src/cli/commands/review.ts`
create path, lines ~145–185: the same order. The design is stated in the
module header of `src/workspace/baseline.ts` (lines ~22–40: "The callers run
it only past the gate … a baseline whose own findings the gate would report
(the shared-journal case: baseline journal bytes = current journal bytes) is
therefore never an exit-2 resolution error"), and `readBaseline`'s replay
judges only the suffix lines. This ordering was introduced deliberately by
commit 9003712 ("sequence baseline-content validation past the read gate")
to satisfy an earlier harness version; the current harness agrees with SPEC:
T13.3-3's garbage-journal arm omits `impact` precisely because "a garbage
line meets baseline resolution first, exit 2, T6.3-4"
(`test/suite/registry/section-13.3.ts` ~lines 229–246 and its module header
~lines 70–76: "a garbage line already committed at the baseline ref makes a
baseline that cannot be validated as a workspace (exit 2 again, 6.3)"), and
T6.3-4 pins each baseline-resolution failure as exit 2 with an actionable
stderr error naming the offending entries or files.

**Change.**
1. In both commands, call `validateBaselineContent` immediately after
   `readBaseline` succeeds — before `analyzeGraphForRead`'s source analysis
   is gated (`assessWorkspaceRead`) — so every baseline failure is the usage
   error of 6.3/12.0 (exit 2, the 12.7 error document when JSON is in
   effect, stderr text otherwise, naming the offending files or entries),
   whatever findings the current workspace carries. Leave the relative order
   of the current workspace's configuration loading and `readBaseline` as it
   stands today (not this task's subject); nothing is written on either
   failure.
2. Make a malformed or unreplayable line inside the baseline's own journal
   content a baseline failure (exit 2) even when the current journal shares
   those bytes: the baseline's journal must itself load as a valid journal
   for the baseline to be reconstructed (6.3: hashes are computed with it).
3. Keep `resolveBaseline`'s post-gate use for a session's recorded baseline
   (`review-session.ts`): a review subcommand reads no session on a failing
   workspace (13.3, 12.0), so that ordering is correct as it is.
4. Rewrite the module header of `baseline.ts` and the step comments of
   `impact.ts`/`review.ts` to state the new order and its SPEC basis.

**Verification.** `npm run build`; `section-6.3.test.ts` (T6.3-1…T6.3-4),
`section-13.3.test.ts` (T13.3-3 included), `section-12.0-i.test.ts`,
`section-12.0-ii.test.ts`, `section-9.test.ts` and the `section-10*.test.ts`
files (`ls test/suite/ | grep -E "section-(9|10)"`); reproduce (a) and (b)
in scratch git workspaces for both commands, with and without `--json`,
expecting exit 2 and the baseline error, and confirm a valid current
workspace with the same invalid baseline still exits 2 with the same message.

## Task 6 — Register T4.5-8 (same-scope collisions) in the harness (TEST-SPEC T4.5-8; SPEC 2.4, 4.5, 5.7, 14, 14.15, 14.5–14.7; Phase 9, harness scope)

**Scope.** A Phase 9 harness task, the replacement for Task 4's collision
arm (see its removal note above): `test/` only. The rules block's "Phase 10:
never modify the test harness" line is the product plan's; this phase's own
scope guard governs — never touch `src/`. Commit `sdg(phase-9): …`.

**Requirement.** TEST-SPEC T4.5-8 (line 182 at 0c5a2b7), verbatim the
authority; in outline: a code source importing `SPEC` from `./A.xspec` (with
the module's `text` export bound too, so `text(SPEC.b)` is a spec-module
call — the exact import spelling is the harness's, within 4) holds a marker
`SPEC.a` and a call `text(SPEC.b)`, both targets existing in `specs/A.mdx`;
one arm per colliding form at module scope — `const SPEC = 1`, `function
SPEC() {}`, `class SPEC {}`, `enum SPEC {}`, `namespace SPEC { export const
v = 1 }`: `build` and `check` report the condition-15 collision beside
condition 7 for each chain (unresolved), exit 1; `query edges` reports no
edge from the file; `occurrences` reports no record for its spellings (5.7,
T5.7-4); and the condition-15 finding locates every colliding declaration —
the import by its own characters and the non-import by the construct binding
the name (14, T14-11): the variable declarator's own characters (`SPEC = 1`,
the `const` statement excluded) and the function, class, enum, or namespace
declaration's own characters, an `export` prefix excluded. Condition-7
ranges are 14's: the marker's bare chain and the `text(...)` call, callee
through closing parenthesis, terminators excluded; findings in 12.7 order
(ordinal, then location). Type-level controls in the same file (2.4, 4.5:
colliding with nothing) — `interface SPEC {}`, `type SPEC = number`,
`namespace SPEC { export type T = number }` — each leave the import rooting
the chain: edges recorded, no finding, exit 0 (the inner-scope shadowing
arm is T4.5-4's, already registered). The spec-source case: a file holding
`export const BASE = 1` beside `import BASE from "./BASE.xspec"` reports
14.16 for the export statement, 14.15 for the collision (locating the import
and the declarator), and 14.5/14.6 for the `d` and `text(...)` spellings
rooted at `BASE`, no edge and no occurrence recorded for them.

**Location.** `test/suite/registry/section-4.5.ts`: header "SUITE-15:
T4.5-1 … T4.5-7" (to read … T4.5-8); `section45Tests` (~1257) listing
`T4_5_1` … `T4_5_7`; helpers `queryEdgesFrom` (~158), `queryEdgesOfKind`
(~177), `stageOffendingStatement` (~231); the T4.5-4 arms (~802 on) and
`assertT454CalleeSide` (~886) as the template for asserting findings and
`occurrences --file` records on a failing workspace (SPEC 11.2). The suite
file `test/suite/section-4.5.test.ts` (`declareProductTests(section45Tests)`)
needs no change. Certification: CERTIFICATIONS.md's Exclusions (line 188)
place T4.5-8 among the Section 4 consumer-side tests outside fixture
certification, its two-sidedness the paired condition-15/condition-7
findings and the type-level controls' recorded edges — no fixture or
manifest work; `test/self/certification-document.test.ts` checks only
in-scope tests named by CERTIFICATIONS.md (~312), which T4.5-8 is not.

**Expected result against the product.** T4.5-8 must fail against the build
of 0c5a2b7 as a diagnosed assertion failure at the missing condition-7
findings (the product masks chains rooted at a "poisoned" binding — Task 4's
removal note — while its condition-15 finding already locates every
colliding declaration), and the type-level control arms must pass. Red-check
per `AGENTS.md` ("Red-checking a strengthened product test") that it fails
for exactly that reason, not a staging error.

**Verification.** `npm run build`; `npx vitest run --config
test/vitest.config.ts --project suite test/suite/section-4.5.test.ts
--reporter=verbose` (T4.5-1 … T4.5-7 stay green; T4.5-8 red as diagnosed);
`npm run test:self` (self-tests and certification stay green); `npm run
typecheck`; `npm run format`.
