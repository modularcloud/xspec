# FIX_PLAN — Phase 9 (test harness), from the fifth compliance determination

Written at harness commit 8f8245c (branch `claude/xspec-ui-apis-4df8fa`), the first
compliance determination after the second plan's exhaustion. Documents unchanged
since 3265b20 (`git diff --stat 3265b20..HEAD -- specs/` empty). Governing IP:
`specs/patches/0001-external-ui-apis.md` (Stage: Tested; no stage change). Bundle:
`specs/SPEC.md`, `specs/TEST-SPEC.md`, `specs/CERTIFICATIONS.md`, `specs/IMPLEMENTATION.md`.

## Preamble — read before any task

**Scope guards (Phase 9).** Never modify product code (`src/`). Every task below is
harness work under `test/`, `.github/`, or harness configuration. Harness self-tests
and certification MUST pass after every task; product tests MAY fail (diagnosed
assertion failures only — never a harness crash, hang, or false pass, H-8).

**Known state at 8f8245c.** Self project: 20 files, 2126 passed, 0 skipped under
`unshare --map-user=1000 --map-group=1000 -- npm run test:self`. Certification pairs:
144 PASS / 33 FAIL, exactly as CERTIFICATIONS.md documents (5 conformers, 18 violators).
The diagnosed product failures allowed at this phase are recorded in the latest commit
messages and in `AGENTS.md`'s per-task bullets — they need no plan task. The
declaration rule of the previous plan (post-Task-3) still governs every new staging:
every declared-unparseable staging is marked `mdx.unparseable` (or `mdx: "unparseable"`
on the `file()` call), and every early-error form names its S-9 allowance. Environment
facts live in `AGENTS.md` and are not repeated here: the root sandbox needs the
unprivileged user namespace for the self project; the self project and a suite run
must not run concurrently; foreground `sleep` is blocked; escape spellings are built
from code points (the tool-parameter layer decodes backslash-u spellings
inconsistently — verify bytes afterward); the stand-in wrapper red/green-check
pattern; the single-test filter `-t '<ID> '` (trailing space); the diagnostic-variant
and mutation red-check recipes; a UTF-8 `TextDecoder` strips a leading BOM unless
`ignoreBOM: true`; a wrapper cannot forward non-UTF-8 argv bytes.

**Loop conventions.** One task per Engineer spawn, in order (the order is by
dependency: Tasks 1–4 are independent of each other; Task 5 builds the mechanism
Tasks 6–17 use; Task 18 must come last, after every conversion). On completing a
task: run the checks it names, update `AGENTS.md` with anything new about building,
linting, or running, remove the task from this file, commit as
`sdg(phase-9): <imperative summary>`, push. When the last task is removed, delete
this file (leave `specs/tmp/.gitkeep`). Commit messages end with the two trailer
lines the spawn prompt gives. Never merge or fetch `main`.

**Observations recorded by the panel that need no task** (judged against the current
documents): CERTIFICATIONS.md's VIOL-CORE-PERSISTREADS sentence "T13.5-8 drives no
review read at all" is descriptively inaccurate (T13.5-8 reads `review status s --json`
on a fresh session holding no resolution) but its binding constraint holds and
certification confirms it — a document wording matter, not harness work; T10.5-4 /
T10.6-2 / T10.7-4's "then item `id`" tiebreak is unstageable with the entries' own
fixtures; P-1's header claim about blank lines inside flow tags is a comment
inaccuracy that removes no oracle coverage; T12.0-9's class-2 table needs no
14.24/14.25 rows (T14-9/T14-10 assert that exit-2 contract); `test.runIf(onLinux|onPosix)`
markers gate self-tests that run on the only CI leg running the self project, so
nothing is skipped in CI (H-9, E-2); the `deriveMdx` devlop-assertion classification is
sound (both parser builds agree on every probed verdict).

## Tasks

### Task 1 — T14-11: stage the valid-5-byte-prefix-then-`0xFF` encoding failure in a code source too

**Requirement.** TEST-SPEC.md §14 T14-11 (line 585): the five encoding failures are
"staged in a spec source and in a code source alike, each `{start: n, end: n}` with
code `unparseable-source`: a valid 5-byte prefix then `0xFF` → 5; `41 E2 82 41` → 1;
`C0 80` → 0; `ED A0 80` → 0; `41 E2 82` truncated → 1".

**Observed.** `test/suite/registry/section-14.ts`: arm (m) stages the prefix-then-`0xFF`
form (`T14_11_ENCODING_MDX` = `Café` + `0xFF` + a section, `T14_11_ENCODING_OFFSET` = 5)
as `specs/enc.mdx` alone; the (v) family (`T14_11_ENCODING_FORMS`, staged by
`T14_11_ENCODING_FILES` as `specs/<name>.mdx` and `src/<name>.ts`) holds only the other
four sequences. The `0xFF` form is never staged in a code source.

**Change.** Add the form to `T14_11_ENCODING_FORMS`, e.g.
`{ name: "prefix", bytes: [0x43, 0x61, 0x66, 0xc3, 0xa9, 0xff], offset: 5 }` (the bytes of
`Café` then `0xFF`; build the array from numbers, never from an escape spelling), so the
(v) family stages it as `specs/prefix.mdx` and `src/prefix.ts` with the pinned
zero-length range `{start: 5, end: 5}`, code 14.20 (`unparseable-source`), `path` null,
exactly like the other four. Extend arm (v)'s `rule` string to name the fifth sequence.
Leave arm (m) as it is (it pins the same offset in the multi-condition workspace). The
family's `mdx.unparseable` declaration is derived from `T14_11_ENCODING_FILES`, so the
new spec source is declared unparseable automatically (S-9) — confirm by reading the
declaration expression, and confirm the code source needs no declaration (`.ts`).

**Checks.** `npx tsc -p test` clean; the self project green in the namespace; T14-11
alone against the built product (`npm run build` first; `-t 'T14-11 '`) reports the
same verdict as before plus, if the product fails the new pair, a diagnosed assertion
naming `src/prefix.ts` or `specs/prefix.mdx` at offset 5. Record in `AGENTS.md` only
if a new run fact emerges. Not certification-scoped (CERTIFICATIONS.md lists T14-11
among the form sweeps outside certification).

### Task 2 — T6.5-13 (h)/(j): require the receiving root's cascades and the dependent root's `upstream-changed`

**Requirement.** TEST-SPEC.md §6.5 T6.5-13 (line 291), arms (h) and (j): `impact --base`
against the pre-move commit reports "6.2's enumeration exactly — the target root
`changed`, beside `p` and the origin parent `changed` with their ordinary cascades
(T6.2-3), a dependent of the target root in another file (`d={B}`, T2.2-2)
`upstream-changed` with the root among the originating nodes it is attributed to
(5.6)"; (j) "reports (h)'s enumeration exactly". SPEC 5.6: every ancestor of a `changed`
node is `descendant-changed` attributed to it (T5.6-2: P `changed` and
`descendant-changed`); a dependent of a `changed` node, and that dependent's
ancestors, are `upstream-changed` attributed to it. T6.2-3's own pins
(`test/suite/registry/section-6.2.ts` ~1928–1935) make the file roots'
`descendant-changed` required with `exact: [<parent>]`.

**Observed.** `a13DependentImpact` (`test/suite/registry/section-6.5-iii.ts` ~1710–1780,
used by (h) with `rootEmbedsChild=false` and (j) with `true`) requires only `changed` on
`A13_TARGET` and lists `descendant-changed` (within `[parent, moved]`) and, for (j),
`upstream-changed` (within `originating`) under `optional`; `A13_DEPENDENT` (the
dependent file's root, a dependent's ancestor) has `required: []` with
`upstream-changed` optional. A product reporting the target root as `changed` alone,
or the dependent file's root uncategorized, passes both arms.

**Change** (pins only; no staging, no other arm, no helper semantics change):
- `A13_TARGET`: `required: ["changed", "descendant-changed"]` plus `"upstream-changed"`
  when `rootEmbedsChild`; move the two entries from `optional` to `attributed`:
  `{ category: "descendant-changed", within: [parent, moved], mustInclude: [parent] }`
  (the departed/arrived-child tolerance T6.2-3 documents — the SUITE-20 convention in
  the module header — is kept as the bound; `p`, an originating node, is required) and,
  under `rootEmbedsChild`, `{ category: "upstream-changed", within: originating,
  mustInclude: [parent] }` (the root embeds `p` through `{text("p")}`; `p` is `changed`).
- `A13_DEPENDENT`: `required: ["upstream-changed"]`,
  `attributed: [{ category: "upstream-changed", within: originating, mustInclude: [A13_TARGET] }]`
  (SPEC 5.6: dependents' ancestors are `upstream-changed`, attributed to the
  originating node; the target root is the dependent's `d` target and is `changed`).
- Update the helper's doc comment and the module header's (h)/(j) paragraph (~line 104–112)
  so they no longer describe these categories as tolerated.

**Checks.** `npx tsc -p test`; the self project green (T6.5-13 is not certification-
scoped: CERTIFICATIONS.md places the 6.4/6.5 rewrite byte contracts outside
certification; S-7's sweep still fails the test at its first product assertion). Run
T6.5-13 alone against the built product (`-t 'T6.5-13 '`) and read the diagnosis:
if the product now fails at (h)/(j)'s impact assertion, confirm the failure message
names the missing category and cites SPEC 5.6 — a diagnosed product failure allowed
at this phase; record it in the commit message and `AGENTS.md`'s per-task bullet.
Red check of the pin itself: with a scratch copy of the module, relax one
`mustInclude` and confirm the diagnosis changes accordingly against the product's
actual report (or, if the product passes, mutate the expected attribution and
confirm the failure), then restore the module.

### Task 3 — T11.2-4: add the Enclosure arm (a stray `<div>` enclosing a section and an embedding at the root level)

**Requirement.** TEST-SPEC.md §11.2 T11.2-4 (line 437), the Enclosure clause: "(11.2: a
stray element is preserved by its own tags, the sections and embeddings it encloses
classified by their own forms): `<div><S id="x">t</S>{text("y")}</div>` staged in flow
position at the root level, `y` a section of the same file — exactly one condition-16
finding, `<div>` through `</div>`; node `x` in the view's tree as a child of the root
(T11.4-1); the embedding's occurrence recorded with the root as its `source`; and under
`view --text` the root's own text carrying `<div>` and `</div>` with `x`'s whole
contribution excised (1.6) and the embedding expanded to `y`'s subtree text, its subtree
text carrying `x`'s text `t` in place with `x`'s tags removed — each byte-asserted."

**Observed.** `test/suite/registry/section-11.2.ts` T11.2-4 (registered ~line 2461) ends
with the deleted-import / stray-`<div>` staging; no staging anywhere places a section
and an embedding inside a `<div>` at the root level (T11.4-1's `<div>` arm in
`section-11.4.ts` ~774 is inside `wrap.mid`, with no embedding, no `--text`, no
occurrence-`source` assertion).

**Change.** Append a further staging block to T11.2-4's body (its own `TestWorkspace`,
disposed in `finally`, like the existing "Staging N" blocks), driving ONLY CONF-AVAIL's
enumerated surface — bare `view --text` and bare `occurrences`; no `build`, no `at`, no
`--file` (module header). Stage two files in two workspaces (one per spelling), each
`specs/ENCL.mdx` beside `SPECS_ONLY_CONFIG`, lines LF-terminated:

- (a) the entry's spelling: `<S id="y">` / `Y text.` / `</S>` / `<div><S id="x">t</S>{text("y")}</div>`
  — under the stock grammar the fourth line is a paragraph holding text-position tags
  (a flow JSX attempt fails at the `t` after `<S id="x">`), which is the entry's own
  spelling at the root level;
- (b) the flow-tag spelling of the same construct, the reading in which `<div>` and
  `</div>` are flow-position tags: `<S id="y">` / `Y text.` / `</S>` / `<div>` /
  `<S id="x">t</S>{text("y")}` / `</div>`.

Both derive (S-9's default declaration; the builder judges them at staging). For each
spelling assert, with the module's helpers (`expectExit`, `parseJsonStdout`,
`decodeViewReport`, `decodeOccurrencesReport`, `assertConditionCounts`,
`assertLocatedFinding`, `findingByCondition`, `projectTextNode`/`TextTreeExpectation`,
`assertSameJson`, `sliceCheck` self-checks of every pinned range before any invocation):
1. `view --text` exits 1 (the 14.16 finding accompanies, SPEC 11.2), one JSON document;
   findings exactly `{ "14.16": 1 }`, the finding located in `specs/ENCL.mdx` at the
   range from `<div>`'s first byte through `</div>`'s last byte (the line terminator
   after `</div>` excluded): (a) line 4 whole minus its terminator; (b) line 4's start
   through the end of `</div>` on line 6.
2. The view's tree: the root with children in document order `specs/ENCL.mdx#y`,
   `specs/ENCL.mdx#x` — `x` a child of the root, never of a `<div>` (T11.4-1) — each
   with its construct range (`x`: `<S id="x">t</S>`).
3. Text values, byte-exact (derive them again from SPEC 1.6 and 3 before pinning; the
   derivation: lines 1 and 3 hold nothing but removed tags, so they are dropped with
   their terminators; line 2 is kept; `{text("y")}` is replaced by `y`'s subtree text
   `Y text.`+LF; `<div>`/`</div>` are content and stay; `x`'s tags are removed and `t`
   stays in place; the root's own text is its subtree text with `y`'s and `x`'s
   contributions excised, the expansion belonging to the root's own run):
   - (a) root own text `<div>` `Y text.` LF `</div>` LF; root subtree text `Y text.` LF
     `<div>t` `Y text.` LF `</div>` LF; `y` own = subtree = `Y text.` LF; `x` own =
     subtree = `t`.
   - (b) root own text `<div>` LF `Y text.` LF LF `</div>` LF; root subtree text
     `Y text.` LF `<div>` LF `t` `Y text.` LF LF `</div>` LF; `y` and `x` as in (a).
   A cross-check against the S-6 Markdown oracle (`test/helpers/oracles/`) is welcome
   where it supports stray elements; the pinned literals are what the test asserts.
4. Bare `occurrences` exits 1 with the same single 14.16 finding; the enumeration is
   exactly one record — `file` `specs/ENCL.mdx`, `range` the braces of `{text("y")}`
   (brace through brace), `kind` `"embeds"`, `source` the root's identity
   `specs/ENCL.mdx` (SPEC 1.5's root identity, spelled as the module's other
   identity constants are), `target` `specs/ENCL.mdx#y` — asserted with `assertSameJson`
   over the whole list (the `OccurrenceRecord` shape of `R_EXPECTED_OCCURRENCES`).
Extend the test's `title` with the Enclosure arm; the module header's condition list
for T11.2-4 already names 14.16.

**Certification (this test is in scope — handle with care).** CERTIFICATIONS.md
CONF-AVAIL lists T11.2-4 in scope; VIOL-AVAIL-NULLMARKER and VIOL-AVAIL-OMIT certify it
(they must still fail it — they do through the existing marker arms, which run before
the new block); VIOL-AVAIL-NOFILE expects exactly T11.3-4 to fail, so T11.2-4 whole,
new arm included, must pass against NOFILE and against CONF-AVAIL. Run the
certification self-test after the change. If CONF-AVAIL (or NOFILE, which shares its
code) fails the new arm because the fixture's `view`/`occurrences` do not realize the
enclosure rules (parenting through a stray element, the occurrence's `source`, the
text values), fix the fixture — fixtures are harness code (PROCESS.md: a conformer has
the simplest behavior that conforms within its stated scope) — keeping every other
pair's verdict; the totals stay 144 PASS / 33 FAIL (the arm adds no pair). Never
weaken the arm to fit the fixture.

**Checks.** `npx tsc -p test`; the self project green in the namespace (certification
included, totals unchanged); T11.2-4 alone against the built product (`-t 'T11.2-4 '`):
report its verdict honestly (a diagnosed product failure at the new arm is allowed at
this phase — record it in the commit message and `AGENTS.md`'s per-task bullet).

### Task 4 — certification self-test wording: eighteen violators, not seventeen

**Requirement.** CERTIFICATIONS.md documents 18 violators, and `EXPECTED_VIOLATORS` /
the manifest pin 18 (report C). H-8/C-1 self-tests describe what they assert.

**Observed.** `test/self/certification.test.ts`'s header comment says "seventeen
violators" and the document gate's test title says "17 violators" — stale since the
eighteenth violator landed.

**Change.** Correct both spellings to eighteen / 18 (and any other stale count in the
two certification self-test files found by `grep -n -i -E 'seventeen|\b17\b'`). No
behavioral change; nothing else in the files. **Checks:** `npx tsc -p test`; the
certification self-tests green (self project in the namespace).
