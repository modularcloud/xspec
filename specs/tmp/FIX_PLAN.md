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

## Task 4 — Report references rooted at invalid or colliding import bindings as unresolved, at their own ranges (SPEC 11.2, 11.3, 11.4, 14, 14.5–14.7, 14.15; reviewer B)

**Requirement.** SPEC 14 intro: every present condition is reported; "a
condition goes unreported only where another error makes it undetectable —
an unparseable file (14.20) masks the conditions inside itself, and a
reference into it reports as unresolved (14.5–14.7)". SPEC 11.2
("Resolution"): a spelling that does not resolve "records no edge and no
occurrence, and never reports an unavailable target: its position reaches
consumers through its finding's range (14). The two surfaces jointly locate
every reference spelling in every parseable file"; ("Unavailability is
explicit"): never silently omitted. SPEC 14 (locations): "A reference
spelling that records no occurrence (5.7, 11.2) is located here: for a
spelling of the MDX embedding form, its finding's range is the full braced
container". SPEC 11.4 (closing): constructs producing no occurrence and no
view entry "are located by their findings' ranges (14), and the two surfaces
together still position every removable construct". 4.5/5.7 exempt only
shadowed and type-only bindings; nothing exempts a chain rooted at an
invalid import's binding.

**Observed (reviewer B).** The product masks every reference whose chain is
rooted at the binding of an invalid import (14.15: undiscovered or invalid
target, invalid specifier form) or at an identifier bound by two imports,
reporting only the import's own 14.15. Scratch fixture `specs/REF.mdx`:
`import NOPE from "./NOPE.xspec"` (NOPE.mdx absent) plus
`<S id="r" d={[SPEC.nope, NOPE.x]}>A {text(SPEC.nope)} B {text(NOPE.y)} C {text(NOPE)}</S>`
— `view specs/REF.mdx` reports `unknown-dependency` (79–88) and
`unknown-text-target` (102–119) for the valid-import spellings, but `NOPE.x`
(90–96), `{text(NOPE.y)}` (122–136), and `{text(NOPE)}` (139–151) get no
finding and no occurrence; the only finding is `invalid-import` at the
declaration (32–63). Same with a colliding binding (`import A` twice;
`d={A.print}` 75–82 and `text(A.derived)` 88–103 unlocated) and on the code
side (`src/bad.ts` marker `NOPE.x` at 27–33 gets nothing while
`SPEC.print.nope` gets `unknown-ts-reference`); `build`/`check` omit them
identically. Consequence: the `{text(NOPE.y)}` container — a construct
Markdown compilation removes (3) — is positioned by no occurrence, no view
entry, and no finding range, so an editor cannot classify those bytes from
`view` + findings (11.4), and 11.2's guarantee fails.

**Location.** `src/core/spec-references.ts`: the masking rationale in the
header (lines ~15–24), the "poisoned" binding of a colliding identifier
(~584–592), `EmbeddingReference.reference === null` for a poisoned root
(~716–726). `src/core/code-analysis.ts`: the `"poisoned"` binding kind
(header ~28; ~225; ~422–424; ~610; ~643; ~814; ~896–897; the masking checks
at ~1157, ~1188, ~1205–1207, and the "poisoned callee masks its arguments"
rule at ~1313–1315).

**Change.** Replace the masking with unresolved reporting: a `d` reference,
an MDX `{text(...)}` embedding, a TypeScript marker, or a TypeScript
`text(...)` call whose chain is rooted at the binding of an invalid import
or at a colliding identifier is a reference spelling that does not resolve
— condition 5, 6, or 7 respectively, located at the spelling's own range
(the embedding's full braced container; the ranges 5.7 defines for
occurrences), reported in addition to the import's 14.15 — on `build`,
`check`, and as domain-file findings accompanying `occurrences`, `view`, and
`at` (11.2–11.5); no occurrence and no edge is recorded for it (11.2), and
expanded text through it is explicitly unavailable (11.2 "Expanded text").
Keep unchanged: 14.20 masking of an unparseable file's own contents; a chain
rooted at an identifier no import binds (a dynamic reference, 14.8, per
2.4); references through a valid import of an unparseable file (already
unresolved); the shadowed/type-only exemptions of 4.5; finding order (12.7:
ordinal, then location). A `text(...)` call whose callee is the `text`
binding of an invalid `.xspec` import does not resolve either (14.7). The
14.15 finding itself stays exactly as it is (one per collided identifier
locating every colliding declaration; one per invalid import).

**Harness check (done while planning).** No suite fixture references the
invalid binding: T2.1-2/T2.1-3 stage `IMPORTING_FILE_REST` (a bare `<S
id="alpha">`) after the import line and assert exactly one 14.15; T4-2's
arms stage the import statements alone; T11.4-4's `./typo.xspec` import is
never referenced. So no test pins the masking; if one surfaces, follow the
rules block.

**Verification.** `npm run build`; `section-2.1.test.ts`, `section-4.test.ts`,
`section-4.5.test.ts`, `section-4.6.test.ts`, `section-11.2.test.ts`,
`section-11.3.test.ts`, `section-11.4.test.ts`, `section-11.5.test.ts`,
`section-14.test.ts`, `section-12.0-i.test.ts`, `section-12.0-ii.test.ts`;
reproduce the three scratch fixtures above and check the expected findings
and ranges on `build --json`, `check --json`, and `view --json`.

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
