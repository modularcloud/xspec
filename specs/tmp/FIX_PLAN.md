# FIX_PLAN — Phase 9 (re-descent): harness adherence to `specs/TEST-SPEC.md` + `specs/CERTIFICATIONS.md`

Source: the Phase 9 compliance determination at 831df39 (three reviewers over
TEST-SPEC §0–8, §9–16, §17–18 + CERTIFICATIONS.md, plus a red VERIFY run:
`npm test` 634 passed / 3 failed — self `certification-document.test.ts` ×2 and
suite `section-16-p11.test.ts` as an H-8 harness error). The Phase 6/7 revisit
of TEST-SPEC.md and CERTIFICATIONS.md (commits 22e5ead..897bfea, 587edca..3b61122)
changed or added the requirements below; `test/` was untouched since, so every
task here is harness work. Goal of this phase: all harness self-tests and
certifications pass (`npm run test:self` green, C-1 exact); product tests may
fail, but only as diagnosed product failures (H-8) — never as harness errors.

**Rules for every task (read once per spawn):**

- Phase 9: never modify product code (`src/`). Harness only: `test/`, `.github/`,
  harness configuration. Never modify any `specs/` document except this file and
  the problems files (`specs/tmp/*-PROBLEMS.md`, dated, only for a genuine spec
  defect that blocks you — never work around one silently). Never read
  `specs/PHILOSOPHY.md`.
- The harness never imports product code; it drives the built `xspec` executable
  (or a certification fixture) as a subprocess through the one `ProductBinding`
  path (TEST-SPEC C-2). Keep every new arm on that path.
- Product-test bodies live in `test/suite/registry/section-*.ts` (each module
  exports an array in canonical ID order), aggregated by `test/suite/registry/
  index.ts` (`ProductTestSuite`; duplicate IDs fail at import time) and run by
  the thin wrappers `test/suite/section-*.test.ts` (`declareProductTests`).
  Every test ID needs its SPEC-section entry in the H-7 map
  `test/suite/registry/traceability.ts`, checked by `test/self/s1-traceability.test.ts`
  (and `s7-red-green-sweep.test.ts` sweeps the registry) — a new test ID is not
  done until the ID is registered, mapped, and the self project is green.
- Certification (TEST-SPEC C-1): a test is certified when it passes against its
  conformer and fails against each violator that certifies it, and every
  violator fails exactly its certified set. The manifest is
  `test/self/certification-fixtures.ts`; the whole-document gate is
  `test/self/certification-document.test.ts`; fixtures are plain Node ESM
  programs under `test/fixtures/<conf>/` (`bin.mjs`, `bin-<deviation>.mjs`,
  shared `product.mjs` with one `deviations` switch per violator) — run by hand as
  `node test/fixtures/<conf>/bin.mjs <command> …` in a staged workspace.
- Build first (`npm run build`; run `npm ci` if `node_modules` is missing), then
  run the named tests: `npx vitest run --config test/vitest.config.ts --project
  suite test/suite/<file>.test.ts`; self-tests + certification: `npm run
  test:self`; property seeds: `XSPEC_PROPERTY_SEED=<uint32>` (see `AGENTS.md`).
  Before committing: `npm run typecheck` and `npm run format`.
- A task's named tests are its verification. For a changed or new product test:
  run it against the built product — it passes, or fails as a diagnosed product
  failure; a harness error (crash, stack overflow, exhausted limit, decode
  exception outside the assertion protocol) is never acceptable. For a test in
  a certification scope, additionally run `npm run test:self` and confirm C-1.
- Work top to bottom (Stage A, the certification gate, is complete): Stage B
  removes the H-11 harness error; Stage C adds the CONF-DISC code-group
  surface; Stage D is the remaining suite gaps in section order (independent
  of each other unless a task names a prerequisite).
- Commit `sdg(phase-9): <imperative summary>`, ending every commit message with
  the two trailer lines
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01TyZ5zUv2UCkvTkM1tkYUp2`;
  push with `git push -u origin claude/xspec-ui-apis-4df8fa` (retry on network
  errors with 2s/4s/8s/16s backoff). Never merge or fetch `main`.
- When a task is done, remove it from this file in the same commit. If a task is
  too large for one spawn, land a coherent part and replace the task with precise
  remainder task(s). When the last task is removed, delete this file. Record any
  new build/lint/run knowledge in `AGENTS.md` (nothing else belongs there).

---

## Stage B — H-11 answer-scale capacity (P-11 harness error), S-8, S-2, T1.3-7

### Task 6 — De-recurse every other per-datum walk over answer documents (H-11 audit)

Cites: TEST-SPEC §0 H-11 (every subsequent per-datum traversal, "16's property
walks included"); §16 P-8, P-11; §17 S-8.

Now: Task 5 (done; `git log` — "de-recurse the view decode path") converted the
walks on the `view` decode path — `decodeViewNodeForm` and
`assertUnavailabilityMarkerForms` in `test/helpers/adapters/forms.ts`,
`documentCarriesUnavailability` in `test/suite/registry/section-16-p11.ts` —
to explicit stacks, and gave `describeJsonValue` (`test/helpers/adapters/
decode.ts`) a non-recursive fallback for the `RangeError` V8's `JSON.stringify`
throws at tower depth 4096 (`structuredClone` throws the same; `JSON.parse` is
iterative; this Node's plain frame budget is ~9.9k frames). The P-11
reproduction (`npm run build && XSPEC_PROPERTY_SEED=271828183 npx vitest run
--config test/vitest.config.ts --project suite test/suite/section-16-p11.test.ts`)
and `test/suite/section-16-p8.test.ts` run without harness errors. Others may
still recurse per level: Markdown/oracle walks over nested sections, `query
subtree` row handling, the E-6 comparators, fixture generators that emit nested
towers recursively, `test/helpers/property.ts` shrinkers.

Do: grep `test/helpers/` and `test/suite/registry/` for functions that call
themselves (or mutually) per nesting level of an answer document or of a staged
tree, and convert each to an explicit stack/queue with identical semantics and
ordering. Dimension: depth 4096 (the largest staged nesting) must pass with
margin; do not introduce depth caps. Leave a one-line comment at each converted
site citing H-11.

Verify: `npm run test:self` green; the P-11 reproduction above and
`test/suite/section-16-p8.test.ts` run without harness errors; `npm run
typecheck`.

### Task 7 — S-8 answer-scale capacity self-test (decoders, walks, capture gate)

Cites: TEST-SPEC §17 S-8 ("The H-3/12.7 decoders and every answer-document
walk the suite performs succeed, every datum evaluated without harness error,
on synthetic conforming-form documents at the maximum answer scale H-11
obliges … expansion blowup included, a `view --text` answer multiplying
embedded subtree text through each expansion level past its staged input's own
size … among them a `view` document nested at least as deep as P-8's
giant-nesting floor. Capture is gated at the same scale through S-3's stand-in
mechanism: a stand-in command emitting the largest of these synthetic documents
on standard output is driven through the H-2 capture path product invocations
use, and the captured bytes MUST be complete and identical to what the stand-in
emitted"); §0 H-11 (an exhausted capture limit must surface as a loud harness
error, never silent truncation).

Now: no `test/self/s8-*` file; nothing under `test/` references S-8 or H-11.
The capture cap is `DEFAULT_MAX_OUTPUT_BYTES` (64 MiB) in
`test/helpers/subprocess.ts` ≈ line 52; overflow raises
`ProductRunOutputOverflowError` (plain `Error`, runner outcome "error" — the
H-11 classification, already correct). S-3's stand-in pattern is in
`test/self/s3-subprocess-driver.test.ts` (`STANDIN_SOURCE`, `standin()`).

Do: add `test/self/s8-answer-scale-capacity.test.ts` (S-8 in its header
comment). (a) Derive and document, in the test, the maximum answer scale over
the suite's staged inputs: the deepest staged nesting (4096 from P-8's
`NESTING_DEPTHS`; floor 2048 from T1.3-7), the largest staged document size
(sweep deterministic fixtures and every generator's size bounds in
`test/suite/registry/section-16-*.ts` and `test/helpers/`), and the `view
--text` expansion blowup (embedded subtree text re-emitted at each expansion
level: compute the bound from the deepest/largest embedding chain any staged
input can hold, per SPEC 11.4). (b) Synthesize conforming-form documents at
those scales in memory (a `view` document nested ≥ 4096 levels; a `view --text`
document at the blowup size; the largest `query`/`occurrences`/`build --json`
shapes if any walk consumes them at scale) and drive each through every H-3/12.7
decoder in `test/helpers/adapters/` and every answer-document walk the suite
performs (the P-11 walk, `assertUnavailabilityMarkerForms`, any decoder-level
ordering checks), asserting no exception and the expected datum count.
(c) Capture gate: a stand-in Node script that writes the largest synthetic
document to stdout (streamed in chunks, then exit 0), driven through the same
`ProductBinding`/run path product invocations use; assert the captured stdout
bytes are complete and byte-identical to the emitted document and that the
run's outcome is a normal completion. If the document exceeds
`DEFAULT_MAX_OUTPUT_BYTES`, raise the default (H-11: dimensioned to staged
scales) and keep a separate assertion that an over-cap stand-in surfaces as
`ProductRunOutputOverflowError` (loud, never truncation). Prerequisites: Tasks
5–6 (otherwise the gate is red).

Verify: `npm run test:self` green including the new file; the test runs in the
`self` project under the CI `harness-self` job (check `test/vitest.config.ts`
project globs include it); `npm run typecheck`.

### Task 8 — S-2 scale vectors: ≥ 2048-deep document and the largest staged document, read back byte-complete

Cites: TEST-SPEC §17 S-2 ("with scale vectors at the suite's staged maxima — a
document nested at least at P-8's giant-nesting floor and one at the largest
document size the suite stages (deterministic fixtures and generator draws
alike, 16), each read back byte-complete — so a truncating writer or
recursion-limited serializer cannot silently stage shallower or smaller inputs
than declared"); §16 P-8.

Now: `test/self/s2-workspace-builder.test.ts` covers newline kinds, BOMs,
invalid UTF-8, tree fidelity, scripted git, root escape, dispose — no nesting or
size vector.

Do: add two vectors to that file: (a) a workspace whose one `.mdx` file nests
sections 4096 levels deep (build the bytes iteratively; reuse or mirror the
generator P-8 uses so the vector is the tower the suite actually stages), and
(b) a file at the largest document size the suite stages (state the derivation
in a comment: the max over deterministic fixtures and generator size bounds,
sharing Task 7's derivation if it landed — otherwise compute it here and let
Task 7 reuse it). Write each through `test/helpers/workspace.ts`'s builder and
read it back from disk with plain `fs`, asserting byte-for-byte equality and
the declared byte length; assert the builder's own file/tree listing reports the
file once with the full size. No recursion in the vector construction.

Verify: `npm run test:self` green; `npm run typecheck`.

### Task 9 — T1.3-7 Depth: deterministic ≥ 2048-deep workspace (new test)

Cites: TEST-SPEC T1.3-7 ("a valid workspace whose one file nests sections at
least 2048 levels deep (P-8's giant-nesting floor, 16) builds with exit 0;
`query subtree` on the root returns the root plus every section, in document
order, the count asserted; `view` serves the full positional tree. The
deterministic anchor of P-8's floor outside the generator machinery, and a
deterministic exercise of the harness's answer-scale capacity (H-11, S-8)");
SPEC 1.3, 11.1, 11.4.

Now: no registry entry, no H-7 map entry, nothing named T1.3-7 under `test/`.

Do: in `test/suite/registry/section-1.3.ts` add a `T1.3-7` body: stage one
`.mdx` file with a 2048-deep chain of nested sections (distinct valid IDs;
build the bytes iteratively; keep every other section-1.3 fixture untouched),
`build` → exit 0 (no findings); `query subtree` on the root (existing
query-adapter decoding) → exactly the root plus 2048 sections, in document
order, IDs asserted by count and by first/last/sampled identities; `view` on
the file → the full positional tree decoded through `decodeViewReport`, depth
asserted by iterative walk. Register the ID in the module's exported array,
add `"T1.3-7": ["1.3"]` (plus 11.1/11.4 if the H-7 map convention lists every
cited section — follow the neighbouring entries) to `traceability.ts`.
Prerequisite: Task 5 — done (the `view` decode no longer overflows).

Verify: `npx vitest run --config test/vitest.config.ts --project suite
test/suite/section-1.3.test.ts` — passes against the built product or fails as
a diagnosed product failure, never a harness error; `npm run test:self` green
(S-1, S-7).

## Stage C — CONF-DISC code-group surface (fixture and suite)

### Task 10 — CONF-DISC conformer: code groups of well-formed `.ts` sources and `query edges --from <path>`

Cites: CERTIFICATIONS.md §CONF-DISC Scope (revised): "code groups (7.2) of
well-formed `.ts` sources spelling no marker, spec-module import, or `text`
call (4) — each discovered code source an edgeless whole-file code location
(4.6)"; command surface "`query edges --from <path>` (11.1) as the observation
of the discovered code set — for a discovered code source's whole-file
location, exit 0 with its empty edge enumeration, the JSON document 11 makes
its only output form; for a path in no configured group, an excluded derived
path included, the usage error of 12.0 (exit 2, the error document of 12.7), a
check preceding the gate of 13.3"; the 13.4 exclusion applies to code globs too
(the module `build` generates next to a source, files under `.xspec/`, enabled
emit destinations). SPEC 7.2, 11.1, 12.0, 12.7, 13.1, 13.4.

Now: `test/fixtures/conf-disc/product.mjs` refuses any non-empty `code` group
("outside this fixture's scope", ≈ line 526) and implements no `query`
command; `build` on a discovered spec source generates the next-to-source
module (13.1) that a code glob would match.

Do: extend the conformer: accept `code` groups (same glob grammar, dot-segment
rule, no link following, byte-wise matching as the spec side; patterns
resolving outside the root → 14.14), discover `.ts` matches, exclude 13.4's
derived paths from the code set exactly as from the spec set (generated
modules next to sources, `.xspec/` paths, enabled emit destinations), treat
each discovered code source as an edgeless whole-file location (no parsing
needed beyond that the file is a well-formed `.ts` the scope stages; keep
14.14's both-groups rule dormant but implemented if cheap). Add `query edges
--from <path>`: for a discovered code source's whole-file location, exit 0 and
the empty edge enumeration in the exact 11/12.7 JSON form the harness's query
adapter decodes (`test/helpers/adapters/query.ts`; match the real product's
form byte-for-byte for the empty case); for a path in no configured group
(derived paths included), exit 2 with the 12.7 error document (stable code and
concerned path as the existing usage-error path renders them), decided before
any 13.3 gate. Keep every existing behavior and the other three violators'
switches unchanged. Update the file header's scope description.

Verify: by hand on a staged workspace with a spec group and a code glob such as
`src/**/*.ts` that also matches `specs/*.ts` generated modules: after `build`,
`query edges --from src/a.ts` → exit 0, empty enumeration; `--from
specs/A.xspec.ts` (or whatever 13.1 name the fixture generates) → exit 2 error
document; `--from .xspec/graph.json` → exit 2. `npm run test:self` stays green
(T7-4..T7-6 as currently implemented still pass; each DISC violator still fails
exactly its set).

### Task 11 — VIOL-DISC-DERIVED: code-group side of the dropped 13.4 exclusion

Cites: CERTIFICATIONS.md §VIOL-DISC-DERIVED Deviation (revised): "a path …
when matched by a spec-group or code-group glob, is treated as an ordinary
match — on the code side an edgeless whole-file location"; Expected failures:
"on the code-group side, each excluded path the code glob matches — the module
`build` generated next to its source, the staged file under `.xspec/`, the
enabled destination — enters the discovered code set, so `query edges --from`
answers it exit 0 where the arm asserts the unknown-path refusal (12.0)".

Now: the `noDerivedExclusion` switch in `test/fixtures/conf-disc/product.mjs`
(consumed ≈ line 1040) drops the exclusion on the spec side only; the
code-group side does not exist before Task 10.

Do: make the same single switch also skip the 13.4 exclusion for code-group
matches (Task 10's code discovery), so `query edges --from <derived path
matched by the code glob>` answers exit 0 with an empty enumeration under
`bin-derived.mjs`; update `bin-derived.mjs`'s header comment to the revised
deviation text. No other behavior changes. Prerequisite: Task 10.

Verify: by hand (Task 10's workspace): `node test/fixtures/conf-disc/
bin-derived.mjs query edges --from specs/<generated module>` → exit 0, while
`bin.mjs` → exit 2; `npm run test:self` green. Once Task 12 lands, the
certification shows DERIVED failing T7-6 on both group sides.

### Task 12 — T7-6: code-group exclusion arm observed through `query edges --from`

Cites: TEST-SPEC T7-6 ("Derived files are never discovered as sources even when
globs match them (`.xspec.` names, `.xspec/` paths, Markdown emit destinations
while emission is enabled, 13.4)" — for every group kind); CERTIFICATIONS.md
§CONF-DISC staging constraints ("T7-6's exclusion arms are staged on both group
sides — the spec side observed through `ids`, the code side through `query
edges --from <path>` (11.1): on a workspace passing `build`'s validations, each
excluded path a code glob matches — the module `build` generated next to its
source (13.1) above all, a file under `.xspec/`, and an enabled emit
destination — is refused as a path in no configured group (exit 2, 12.0),
beside a discovered code source's whole-file location answering exit 0, T7-3's
idiom for code discovery; and the staged code globs match, beyond those
derived-classified paths, only the well-formed `.ts` sources above, no
spec-group file among them"); SPEC 7.2, 11.1, 12.0, 13.1, 13.4.

Now: `test/suite/registry/section-7-discovery.ts` T7-6 (≈ lines 599–812) has
derived-file exclusion arms observed through `ids` only (spec side), the
import arms, the no-match and empty-map arms; no code group, no `query edges`.

Do: add a code-group exclusion arm to T7-6: configuration with a spec group
and a code group whose glob (e.g. `**/*.ts` under the root, or a pattern
covering `specs/` and `src/`) matches one well-formed `.ts` code source
(no marker, no spec import, no `text` call), the module `build` generates next
to the spec source, a staged `.ts` file under `.xspec/`, and, with `markdown`
emission enabled, a staged file at a source's emit destination — and matches no
spec-group file; `build` → exit 0; then `query edges --from <code source>` →
exit 0 with an empty edge enumeration (decoded through the query adapter);
`query edges --from <each excluded path>` → exit 2 with the 12.7 error document
(the existing usage-error decoding), never a finding, nothing modified. Use
the query adapter's existing `edges` decoding; do not add product-specific
wording assertions.

Verify: `npx vitest run --config test/vitest.config.ts --project suite
test/suite/section-7-discovery.test.ts` (passes against the built product or a
diagnosed product failure); `npm run test:self`: CONF-DISC conformer passes
T7-6 (Task 10), VIOL-DISC-DERIVED fails exactly T7-6 (Task 11), DIALECT and
SYMLINK unchanged.

## Stage D — remaining suite gaps, in TEST-SPEC section order

### Task 13 — T1.2-3: locate the root's ignored reason through the adapter, not a literal

Cites: TEST-SPEC T1.2-3 (the root's reason is adapter-located; no wording is
pinned — the same discipline T8.2-1 applies through `classifyIgnoredReasons`);
SPEC 1.2, 8.

Now: `test/suite/registry/section-1.1-1.2.ts` ≈ lines 742–745 asserts the reason
list literally as `["root node"]`.

Do: replace the literal with the adapter classification used by T8.2-1
(`classifyIgnoredReasons` or the helper the coverage adapter exports): assert
the root's entry classifies as the root-node reason and nothing else; keep the
count/identity assertions.

Verify: `npx vitest run --config test/vitest.config.ts --project suite
test/suite/section-1.1-1.2.test.ts`; `npm run test:self` green.

### Task 14 — T1.3-6: valueless-`id` (`<S id>`) masking arm — bearer's own code is 14.17, never 14.1

Cites: TEST-SPEC T1.3-6 (masking: a bearer whose `id` is not a plain static
string withdraws identity for its subtree; the valueless spelling `<S id>` is
the 2.7 form-invalid prop — condition 14.17 on the bearer, and never 14.1);
SPEC 1.3, 2.7, 14.1, 14.17.

Now: `test/suite/registry/section-1.3.ts` ≈ lines 409–414 stages only the
repeated-`id` and braced-`id` bearers.

Do: add a third bearer arm in the same fixture family: `<S id>` (no value)
enclosing a valid descendant; `build` → the bearer reports exactly one 14.17
finding located at the prop/tag as the existing arms locate theirs, no 14.1
anywhere, and the descendants' masking outcome identical to the other two
arms (same identities/unavailability). Use exact per-condition counts as
`section-11.2.ts` 968–971 does.

Verify: `npx vitest run … test/suite/section-1.3.test.ts`; `npm run test:self`
green (CONF-VALID's in-scope T1.3-6 still passes the conformer, both VALID
violators still fail exactly their sets).

### Task 15 — T2.7-3: valueless `<S id>`, `<S id="x" coverage>`, `<S id="x" tags>` arms; export the shared `tags` fixture

Cites: TEST-SPEC T2.7-3 (every prop of 2.7 spelled valueless is form-invalid —
14.17; `<S id>` reports 14.17 and no 14.1); T11.4-3 ("the valueless prop must be
staged as T2.7-3's `<S id="x" tags>` — one fixture shared by build and view");
SPEC 2.5, 2.6, 2.7, 14.17.

Now: `test/suite/registry/section-2.7.ts` stages only valueless `d`.

Do: add three arms — valueless `id` (exactly one 14.17 on the bearer, zero
14.1), valueless `coverage` on `<S id="x" coverage>`, valueless `tags` on
`<S id="x" tags>` — each exit 1 with exactly one 14.17 finding located at the
prop, no other finding. Define the `<S id="x" tags>` source bytes as an
exported constant (with its expected finding location) so
`section-11.4.ts` (Task 39) stages byte-identical content for `view`; keep
the module's canonical ID ordering.

Verify: `npx vitest run … test/suite/section-2.7.test.ts`; `npm run test:self`
green (CONF-AVAIL's revised bare-valueless → 14.17 behavior is in scope for
T11.4-3; nothing to change for T2.7-3 itself).

### Task 16 — T4.5-4: callee-side arm — a shadowing local `text` makes `text(SPEC.a)` a condition-18 finding

Cites: TEST-SPEC T4.5-4 (callee side: an inner-scope `function text(x:
unknown) {}` shadows the imported `text`; `text(SPEC.a)` inside that scope is
a condition-18 finding at that use; `build`/`check` exit 1; no `embeds` edge
or occurrence for it; `occurrences --file` answers on the failing workspace
with the finding; a control call outside the scope lists its `embeds`
occurrence); SPEC 4.5, 5.7, 11.3, 14.18.

Now: `test/suite/registry/section-4.5.ts` ≈ lines 772–830 hold only the
`const SPEC` (binding-side) arm.

Do: add the callee-side arm: a code file importing `SPEC` and `text`, with a
block/function that declares `function text(x: unknown) {}` and calls
`text(SPEC.a)` inside it, plus one control `text(SPEC.b)` at module scope.
Assert: `build` and `check` exit 1 with exactly one condition-18 finding at
the shadowed use's range; `query edges` (or the graph read the file already
uses) shows no `embeds` edge from the shadowed call and one from the control;
`occurrences --file <code file>` (11.2: answers per file on a failing
workspace) lists the control's `embeds` occurrence and reports the finding
for the shadowed call, in the adapter's decoded form.

Verify: `npx vitest run … test/suite/section-4.5.test.ts`; `npm run test:self`
green.

### Task 17 — T4.6-3: value-side boundary — `const s = text(SPEC.a)` attributes to `path#f` inside `f`, `path` at top level, never `path#s`

Cites: TEST-SPEC T4.6-3 (attribution boundary: a `text(...)` call whose value
is bound by a `const` is attributed to the enclosing function's unit — `path#f`
inside `f`, the whole-file `path` at top level — never to the constant's own
name); SPEC 4.6.

Now: `test/suite/registry/section-4.6.ts` has no value-side arm.

Do: add the arm: one code file with `function f() { const s = text(SPEC.a); }`
and a top-level `const t = text(SPEC.b);`; after `build`, the graph/edge
enumeration (through the query adapter) attributes the first embedding to
`<path>#f` and the second to `<path>`, and no location `<path>#s` or `<path>#t`
exists anywhere in the answer.

Verify: `npx vitest run … test/suite/section-4.6.test.ts`; `npm run test:self`
green.

### Task 18 — T6.1-1: never-modifies sweep over every command surface

Cites: TEST-SPEC T6.1-1 (the journal is appended only by `rename`/`move`;
every other command leaves the journal-bearing workspace byte-identical:
`build`, `check`, `coverage`, `impact --base HEAD`, `review list`, `query
nodes`, plus `ids`, `show`, `review create/resolve/split`, `occurrences`,
`view`, `at`, `inventory`, `version`, and `rename --preview` / `move
--preview`, each on a journal-bearing workspace); CERTIFICATIONS.md Exclusions
(T6.1-1 sweeps every surface — outside CONF-CORE); SPEC 6.1, 6.6.

Now: `test/suite/registry/section-6.1.ts` ≈ lines 311–316 byte-compare only the
first six commands.

Do: extend the sweep so each listed command runs on a workspace holding a
non-empty journal (and, for the review subcommands, an `audit` session and an
unblocked item; for `impact`, a resolvable commit) and the journal file is
byte-identical before/after each invocation (compare the journal — and, where
the existing sweep compares more, the same set); the `--preview` runs must
leave the journal and every source byte-identical. Keep each invocation's
own exit/answer decoded through the adapters (no assertion beyond a normal
completion is required here).

Verify: `npx vitest run … test/suite/section-6.1.test.ts`; `npm run test:self`
green.

### Task 19 — T6.4-2: keepable reference forms, whole-file byte contract, single-quoted `id` attributes

Cites: TEST-SPEC T6.4-2 (revised: minimal in-place edits — a computed
double-quoted access `BASE["login-v2"]` → `BASE["login2"]` stays computed and
double-quoted; single-quoted `BASE['login-v2']` → `BASE['login2']` and →
`BASE['login-v3']` keep single quotes; dot access stays dot; `{text('login-v2')}`
and a `d` array entry `'login-v2'` keep single quotes; every rewritten `.mdx`
and `.ts` file — marker and `text` rewrites included — is asserted byte-equal to
an expected whole file; `id` attributes spelled single-quoted, on the renamed
section and on one descendant, stay single-quoted); SPEC 6.4, 2.7, 3.

Now: `test/suite/registry/section-6.4.ts` ≈ lines 1017–1019 implement the
pre-revisit text (spot assertions on rewritten spellings only).

Do: restage T6.4-2 with fixtures carrying each listed form (in `.mdx` `d`
props/arrays, `{text(...)}` embeddings, and a `.ts` file with markers and
`text` calls through both access forms), compose the expected post-rename
bytes for every touched file from SPEC 6.4's rules (only the ID segment's
characters change; quote kind and access form kept), and assert each rewritten
file byte-equal to its composed expectation (files untouched by the rename
byte-identical). Include the two single-quoted `id` attributes. Keep the
existing preview/journal assertions.

Verify: `npx vitest run … test/suite/section-6.4.test.ts`; `npm run test:self`
green.

### Task 20 — T6.4-3: two-bearer collision — one `refused-id-collision` locating both `b` and `b.c`

Cites: TEST-SPEC T6.4-3 (rename `a`→`b` where `a.c` exists beside `b` and `b.c`:
refused with one `refused-id-collision` finding locating every colliding
bearer — `b` and `b.c`; nothing modified); T14-7 (the finding locates every
colliding bearer); SPEC 6.4, 14.

Now: `test/suite/registry/section-6.4.ts` ≈ lines 1060–1130 stage the single
bearer `a.sib` only.

Do: add the arm (or restage the existing one) with sections `a`, `a.c`, `b`,
`b.c` in one or two files; `rename a b` → exit 1, exactly one
`refused-id-collision` finding whose locations are exactly the two bearers
`b` and `b.c` (tag ranges as the adapter decodes them), journal and sources
byte-identical. Export the fixture (source bytes and the two expected
locations) so Task 46 (T14-7) asserts the same collision without a second
staging.

Verify: `npx vitest run … test/suite/section-6.4.test.ts`; `npm run test:self`
green.

### Task 21 — T6.4-4: nonexistent `<file>` spelled as an `.mdx` present on disk but in no spec group (exit 2)

Cites: TEST-SPEC T6.4-4 (a `<file>` operand naming no discovered spec source is
a usage error, exit 2, in both spellings: absent on disk, and present on disk
but matched by no configured spec group); SPEC 6.4, 12.0.

Now: `test/suite/registry/section-6.4.ts` ≈ lines 1352–1354 stage only the
absent-on-disk spelling.

Do: add the second spelling: write a valid `.mdx` outside every spec-group
glob (e.g. `docs/stray.mdx` with globs `specs/**/*.mdx`), `rename docs/stray.mdx
<id> <new>` → exit 2 with the 12.7 error document (decoded through the
existing usage-error adapter), nothing modified.

Verify: `npx vitest run … test/suite/section-6.4.test.ts`.

### Task 22 — T6.4-5: `move` arm — a `typeof` reference to a section-moved node stays byte-unchanged

Cites: TEST-SPEC T6.4-5 (revised: a code-file `typeof` reference to a node is
not a reference the operation rewrites — after a section move of that node
the referencing `.ts` file is byte-unchanged, the workspace valid, and the
applied mapping and journal entry identical to the same move on a twin
workspace without the reference); SPEC 6.4, 6.5, 4.5.

Now: `test/suite/registry/section-6.4.ts` ≈ lines 1575–1600 cover `rename`
only.

Do: add the move arm mirroring the rename arm: twin workspaces differing only
by a `.ts` file holding a `typeof SPEC.a.b` reference; section-move `a.b` in
both; assert the `.ts` file byte-identical to its staged bytes, `check` clean,
and the journal's appended entry and the preview's mapping byte-identical
across the twins (H-4/H-6 product-to-itself compare).

Verify: `npx vitest run … test/suite/section-6.4.test.ts`.

### Task 23 — T6.5-1: specifier-rewrite byte contract for the file-form move

Cites: TEST-SPEC T6.5-1 (revised: after a file move, every importing `.ts`
and the moved file are byte-identical outside the `import-specifier-rewrite`
ranges reported by a `--preview` taken on a copy, and each such range holds a
2.1-form specifier designating the moved module); SPEC 6.5, 6.6, 2.1.

Now: `test/suite/registry/section-6.5.ts` ≈ lines 770–772 assert resolution
only.

Do: on a copy of the fixture take `move --preview` and decode its
`import-specifier-rewrite` ranges (existing preview adapter); run the real move
on the original; for each importing `.ts` and for the moved file, assert the
bytes outside the reported ranges equal the pre-move bytes at the same
positions (splice check: pre-move bytes with the ranges replaced by the
post-move contents equals the post-move file) and that each range's new
content is a string-literal specifier that resolves (2.1 relative form) to
the moved module; nothing else changed.

Verify: `npx vitest run … test/suite/section-6.5.test.ts`.

### Task 24 — T6.5-3: third-file arm — a third spec source's `d`-chain reference rewritten to the target module

Cites: TEST-SPEC T6.5-3 third-file arm ("a spec source that is neither origin
nor target, importing the origin module and referencing a moved node through
it (a `d` chain), has that reference rewritten to the target module under an
import of it added there (bytes per T6.5-8's discipline), the origin import
removed when the moved reference was its binding's last and kept when another
reference through it remains (one arm each); `query edges` reports the third
file's edge under the moved node's new identity and `check` is clean"); SPEC
6.5, 2.1.

Now: `test/suite/registry/section-6.5.ts` ≈ lines 1321–1323 have no third
file.

Do: two arms over three spec sources (origin, target, third): (a) the third
file's only reference through the origin binding is to the moved node → after
the section move the reference is rewritten to the target module under an
added import (added-import bytes asserted with T6.5-8's discipline: isolate the
single added run by diff, value-unpinned identifier, `\n` rules), the origin
import removed with 6.5's exact extent; (b) the third file also references an
unmoved origin node → origin import kept byte-for-byte, only the moved
reference rewritten. In both: `query edges` lists the third file's `depends`
edge under the moved node's new identity, `check` clean, journal mapping as the
existing arm asserts. Share the diff-isolation helper with Task 28 (T6.5-8) if
it already landed; otherwise write it in `test/helpers/` for both.

Verify: `npx vitest run … test/suite/section-6.5.test.ts`.

### Task 25 — T6.5-4: destination occupied by a directory; symbolic-link path components → `refused-invalid-destination`

Cites: TEST-SPEC T6.5-4 (revised: (a) file-form destination occupied by a
directory is refused like the plain-file/symlink/broken-symlink occupants;
(b) a destination path with a symbolic-link component — file-form move to
`specs/sub/b.mdx` and section-form move creating `specs/sub/new.mdx`, with
`specs/sub` a symlink to a real empty directory, staged once inside and once
outside the workspace root — is `refused-invalid-destination`, never 14.22,
exit 1, nothing modified, the link and its target byte-identical; and
`<outDir>/new` staged as such a link beside the derived-path arm); SPEC 6.5,
14.

Now: `test/suite/registry/section-6.5.ts` ≈ lines 1664–1666 (title 2003)
stage plain file, symlink, broken symlink only; no link-component arms.

Do: add the directory-occupant arm and the four link-component arms (file
form × {inside, outside root}, section form × {inside, outside root}) using the
workspace builder's symlink support (S-2 covers it), plus the `<outDir>/new`
link beside the derived-path arm. Each: exit 1, exactly one
`refused-invalid-destination` finding (never 14.22), sources/journal/link/
target byte-identical after the run, the link still a link.

Verify: `npx vitest run … test/suite/section-6.5.test.ts`.

### Task 26 — T6.5-5: origin `<file>` present on disk but undiscovered (both forms)

Cites: TEST-SPEC T6.5-5 (an origin `<file>` naming no discovered spec source is
a usage error, exit 2, in both spellings — absent, and present but matched by
no spec group — for the file form and the section form); SPEC 6.5, 12.0.

Now: `test/suite/registry/section-6.5.ts` ≈ lines 2322–2324 stage only the
absent spelling.

Do: add the present-but-undiscovered spelling for each form (as Task 21 does
for `rename`): a valid `.mdx` outside every glob; `move docs/stray.mdx …` and
`move docs/stray.mdx#a …` → exit 2 with the 12.7 error document, nothing
modified.

Verify: `npx vitest run … test/suite/section-6.5.test.ts`.

### Task 27 — T6.5-7: single-quoted descendant `id`; code-source counterpart (import removal in `.ts`, byte-composed)

Cites: TEST-SPEC T6.5-7 (revised: the moved subtree "spells that descendant's
`id` attribute single-quoted (2.7)" and after the move "the local reference and
the single-quoted `id` attribute are each re-identified by prefix replacement
with their single-quote spellings preserved"; and "The code-source counterpart,
fully composed (no import added, so no latitude): a `.ts` file importing the
origin module, the target module, and a retained third module — the third
module's declaration and the origin's sharing one line in a second variant,
the origin's following it — whose only references through the origin binding
are markers on nodes of the moved subtree, beside a marker through the target
binding and one through the third; after the section move, the origin-module
import … is removed with 6.5's exact extent (own-line: the line dropped with
its terminator; shared-line: the declaration's own characters alone deleted,
the retained declaration kept byte-for-byte), the moved markers are rewritten
through the existing target binding, and the file is asserted byte-equal to
expected bytes composed from the rules of 6.4/6.5 and 3"); SPEC 6.4, 6.5, 2.7,
4.5.

Now: `test/suite/registry/section-6.5.ts` ≈ lines 2723–2910 (T6.5-7) stage the
MDX origin/target with double-quoted `id`s and no code file.

Do: (a) spell the moved descendant's `id` attribute single-quoted in the
fixture and compose the expected target bytes with the re-identified value
still single-quoted; (b) add the code-source arm in two variants (own-line
origin import; origin import following the third-module import on a shared
line) with markers through all three bindings; after the move assert the
`.ts` file byte-equal to the composed expectation (origin import removed with
exact extent, moved markers rewritten through the existing target binding,
everything else byte-identical); `check` clean.

Verify: `npx vitest run … test/suite/section-6.5.test.ts`.

### Task 28 — T6.5-8 Added-import insertion discipline (new test: TS, MDX-origin, MDX-target arms)

Cites: TEST-SPEC T6.5-8 (full text in §6.5): an added import is a line of its
own — declaration + U+000A, preceded by U+000A when the insertion offset is not
at a line start — with identifier and offset left free; three section-move
arms: TS (code file imports the origin, references one moved and one unmoved
node → gains a target-module import, origin import stays), MDX origin (origin
holds a retained third-module import and a local string reference to a moved
descendant → origin gains the target module's import, the reference converting
to imported form in 6.4's pinned spellings), MDX target (moved subtree holds a
local `d` reference to an unmoved origin node with a non-identifier segment →
the target file gains the origin module's import; dot access / double-quoted
computed access; origin loses the section and gains no import); in each arm
the harness isolates the single added byte run by diff against the composed
bytes and asserts exactly `decl + \n` at a line-start offset or `\n + decl +
\n` otherwise, the declaration one import of the needed module's specifier
binding one fresh identifier (value unpinned) that the rewritten references
use, no other byte inserted. SPEC 6.5, 6.4, 2.1, 3.

Now: not implemented; no registry entry, no H-7 map entry.

Do: in `test/suite/registry/section-6.5.ts` add `T6.5-8` with the three arms.
Write (or reuse from Task 24) a helper in `test/helpers/` that, given the
composed expected bytes with two unknowns and the actual post-move bytes,
(1) recovers the fresh identifier from the rewritten references, (2) locates
the single inserted run by diff, and (3) checks the `\n` discipline by the
offset's line position and that the run's declaration is a 2.1-form import of
the expected module binding that identifier; everything else byte-identical.
Register the ID and add `"T6.5-8": ["6.5"]` to `traceability.ts`.

Verify: `npx vitest run … test/suite/section-6.5.test.ts` (pass or diagnosed
product failure, never a harness error); `npm run test:self` green (S-1, S-7).

### Task 29 — T6.5-9 Fresh identifiers in code (new test: pre-empted local bindings, compile-clean after the move)

Cites: TEST-SPEC T6.5-9 (full text in §6.5): T6.5-8's TS arm re-staged with a
receiving code file that also declares at module scope a local `const`, a
`function`, a `class`, a `type` alias, and a non-spec import binding whose
names pre-empt the identifiers a product would plausibly derive — the target
file's basename as written, lower-cased, upper-cased, `Spec`- and
`SPEC`-suffixed, and the origin binding's name with a digit and with an
underscore appended — the file compiling clean before the move under standard
tooling; after the move, through H-2's standard-tooling channel
(`test/helpers/tooling.ts`), the rewritten file compiles with no diagnostics;
`query edges` reports the moved markers' `references` edges to the new
identities and the unmoved marker's edge through the retained origin binding;
`check` clean. SPEC 6.5, 2.1, 4, 4.5.

Now: not implemented.

Do: add `T6.5-9` to `section-6.5.ts` (prerequisite: Task 28's TS arm fixture
to re-stage): stage the pre-empting declarations (exactly the enumerated
derivations; each binding used trivially so the file is not just declarations),
compile before the move (no diagnostics — a fixture self-check), section-move,
compile after (no diagnostics), then the `query edges` and `check` assertions.
Register and map the ID.

Verify: `npx vitest run … test/suite/section-6.5.test.ts`; `npm run test:self`
green (S-1, S-4 tooling driver unaffected).

### Task 30 — T6.5-10 Third-module bindings carried with moved text (new test: arms (a) value-blind and (b) byte-composable)

Cites: TEST-SPEC T6.5-10 (full text in §6.5): three spec sources `a.mdx`
(origin), `b.mdx` (target), `x.mdx` in one directory; the moved subtree holds a
`d` reference and a `{text(...)}` embedding through the origin's `X` binding,
one through `X["bar-baz"]`; (a) target lacks an import of `x.mdx` and the
origin's only `X` references lie in the moved subtree → target gains exactly
one import declaration under T6.5-8's line discipline (specifier of 2.1's
form designating `x.mdx`, relative spelling free), each moved reference rooted
at the fresh identifier (`X` itself admissible) with access form kept, moved
text otherwise byte-identical; origin loses the section and its own-line `X`
declaration with the terminator, otherwise byte-identical; (b) target already
imports `x.mdx` as `Z` (referenced by its own section) and the origin keeps an
`X` reference outside the subtree → no import added, `X.foo` → `Z.foo`,
`X["bar-baz"]` → `Z["bar-baz"]`, origin's `X` declaration kept, both files
byte-equal to composed expectations; in both arms `query edges` reports the
moved nodes' `depends` and `embeds` edges under their new identities to
`x.mdx`'s unchanged nodes, `build` and `check` clean. SPEC 6.5, 6.4, 2.1, 3.

Now: not implemented.

Do: add `T6.5-10` to `section-6.5.ts` using Task 28's diff-isolation helper
for arm (a) and whole-file byte compares for arm (b); register and map the ID.

Verify: `npx vitest run … test/suite/section-6.5.test.ts`; `npm run test:self`
green.

### Task 31 — T6.6-4: rename-preview mapping-order fixture with descendants in document order opposite to byte order

Cites: TEST-SPEC T6.6-4 (the preview's mapping lists the renamed section's
descendants in an order the decoder checks by `from` byte order, and the
fixture must be able to discriminate a document-order product: descendants
whose document order differs from the byte order of their `from` spellings —
`a.z` before `a.c`); SPEC 6.6, 6.4.

Now: `test/suite/registry/section-6.6.ts` ≈ lines 508–553 rename `core.mid`
with the single descendant `core.mid.leaf`, so the ordering check is vacuous.

Do: restage with at least two descendants whose document order is `a.z` then
`a.c` (byte order of the mapping's `from` values reversed relative to document
order); keep the decoder's check and assert the mapping's order per the spec's
pinned tie-break; keep every other assertion of the test.

Verify: `npx vitest run … test/suite/section-6.6.test.ts`.

### Task 32 — T6.6-5: lagging-record counterpart (emission enabled after the build, no rebuild)

Cites: TEST-SPEC T6.6-5 (revised: with Markdown emission enabled after the
last `build` and no rebuild, the move preview's `generated` set is exactly the
destination's module + companions + Markdown emit destination plus every other
spec source's Markdown emit destination, and `removed` is exactly the recorded
pre-move module and companions); SPEC 6.6, 13.1, 13.2, 13.4.

Now: `test/suite/registry/section-6.6.ts` ≈ lines 2673–2675 cover the
current-record case only.

Do: add the arm: build, then enable `markdown.emit` in the configuration
without rebuilding, take `move --preview`, decode `generated`/`removed`
(existing preview adapter) and assert the exact sets above (paths composed
from SPEC 13.1/13.2's naming rules), nothing written.

Verify: `npx vitest run … test/suite/section-6.6.test.ts`.

### Task 33 — T7-1: `--config <nonexistent file>` is configuration error 14.14 (exit 2, concerned path per T12.7-3)

Cites: TEST-SPEC T7-1 (an explicit `--config` naming no file is reported as
14.14 — exit 2 with the 12.7 error document naming the concerned path as
T12.7-3 spells it — never a plain usage error); SPEC 7, 12.0, 12.7, 14.14.

Now: `test/suite/registry/section-7-basics.ts` ≈ line 228 has only the
override run.

Do: add the arm: `build --config <missing path>` → exit 2, error document
decoded through the existing error adapter with the 14.14 stable code and the
concerned path spelled as given (relative to the invocation directory, per
T12.7-3 — see Task 43 for the sibling-directory ascent form, which this arm
need not repeat); nothing written.

Verify: `npx vitest run … test/suite/section-7-basics.test.ts`.

### Task 34 — T7-3: configuration value-shape arms → 14.14

Cites: TEST-SPEC T7-3 (revised: a spec or code group whose value is a single
string; a glob list holding `true`; `coverage: {}` / `policy: {}`; `specs` or
`code` given as lists — each a 14.14 configuration error, exit 2); SPEC 7,
14.14.

Now: `test/suite/registry/section-7-basics.ts` ≈ lines 896–901 lack these
shapes.

Do: add one arm per shape (six configurations), each `build` → exit 2 with the
14.14 error document naming the configuration file; nothing written.

Verify: `npx vitest run … test/suite/section-7-basics.test.ts`.

### Task 35 — T7.4-1: `edgeKinds` non-subset and non-string `targetTags` element → 14.14

Cites: TEST-SPEC T7.4-1 (revised: `edgeKinds` values `"contains"`, `"depend"`,
and `true` — one arm each — and a `targetTags` list holding `true` are 14.14
configuration errors); SPEC 7.4, 14.14.

Now: `test/suite/registry/section-7.4-7.5.ts` ≈ lines 542–550 lack them.

Do: add the four arms, each `build` → exit 2, 14.14 error document, nothing
written.

Verify: `npx vitest run … test/suite/section-7.4-7.5.test.ts`.

### Task 36 — T7.5-1: policy `kinds` non-subset and non-string selector `tags` element → 14.14

Cites: TEST-SPEC T7.5-1 (revised: `kinds` values `"contains"`, `"depend"`,
`true`, and a selector `tags` list holding `true` are 14.14 configuration
errors); SPEC 7.5, 14.14.

Now: `test/suite/registry/section-7.4-7.5.ts` ≈ lines 1055–1061 lack them.

Do: add the four arms as in Task 35.

Verify: `npx vitest run … test/suite/section-7.4-7.5.test.ts`.

### Task 37 — T10.5-1: `parent-consistency` context sets over A → B → C with only C changed

Cites: TEST-SPEC T10.5-1 (revised: with A → B → C and only C `changed`, A's
`parent-consistency` context is exactly `{B}` — never `C` — and B's exactly
`{C}`; identities asserted); SPEC 10.5, 5.6.

Now: `test/suite/registry/section-10.5.ts` T10.5-1 lacks the chain arm; T10.5-2's
`a > a.b > a.b.c` fixture asserts blocking only, no context sets.

Do: add the arm to T10.5-1: three sections with `d` edges A→B→C (or the
section nesting the spec's arm names), a session, then edit C; decode the
review payload (existing review adapter) and assert each item's
`parent-consistency` context set by identity: A's `{B}`, B's `{C}`, C's
empty/absent as the spec states.

Verify: `npx vitest run … test/suite/section-10.5.test.ts`.

### Task 38 — T11-6: `query subtree` / `query ancestors` on a code-group `path` or `path#unit` → exit 2

Cites: TEST-SPEC T11-6 (§11.1: wrong-kind operands — `subtree` and
`ancestors` take a spec node; given a code-group whole-file `path` or a
`path#unit` location they are usage errors, exit 2); SPEC 11.1, 12.0.

Now: `test/suite/registry/section-11.ts` T11-6 (≈ line 1466) covers `query
node` and `show` only; every `subtree`/`ancestors` invocation names a spec
source.

Do: add four arms (`subtree`/`ancestors` × `path`/`path#unit`) on a workspace
with a discovered code file holding one unit; each → exit 2 with the 12.7
error document, nothing modified.

Verify: `npx vitest run … test/suite/section-11.test.ts`.

### Task 39 — T11.4-3: stage the valueless prop as T2.7-3's shared `<S id="x" tags>` fixture

Cites: TEST-SPEC T11.4-3 (§11.4: the valueless-prop case is staged as T2.7-3's
`<S id="x" tags>` — one fixture shared by `build` and `view` — so that `view`'s
answer for a section whose identity is well-formed but which carries a
form-invalid valueless prop is asserted as the spec states: identity present,
the attribute listed in tag order, no unavailability where 11.2 defines none);
CERTIFICATIONS.md §CONF-AVAIL (bare valueless attributes → 14.17;
document-order listings); SPEC 11.2, 11.4, 2.7.

Now: `test/suite/registry/section-11.4.ts` T11.4-3 (≈ line 1274) stages
valueless `tags` only on `<S id="dup" id="dup" note="mystery" {...extras}
tags>`, whose identity is already unavailable, so a product withdrawing
identity on the valueless prop alone is not discriminated; nothing is shared
with `section-2.7.ts`.

Do: import Task 15's exported fixture constant and add a `view` arm on that
exact file: decode through `decodeViewReport` and assert the node's identity
is the plain `x`, its `attributes` list the valueless `tags` entry in tag
order with the datum form T11.4-3 states, and the per-node fields 11.2 leaves
defined are present; keep the existing compound arm. Prerequisite: Task 15.

Verify: `npx vitest run … test/suite/section-11.4.test.ts`; `npm run
test:self` green — CONF-AVAIL passes T11.4-3; NULLMARKER and OMIT still fail
exactly their sets (both list T11.4-3).

### Task 40 — T12.0-10: missing required flag/argument rows in the syntax class (no configuration load)

Cites: TEST-SPEC T12.0-10 (§12.0 revised: within class 2 the rows include "a
missing required flag or argument" — `review create --name n` with none of
`--base`/`--strategy audit`/`--coverage`, and `at <file>` alone — each reported
as a usage error without loading configuration); SPEC 12.0.

Now: `test/suite/registry/section-12.0-ii.ts` `syntaxRows` (≈ lines
1920–1940) hold only unknown command, repeated flag, and `show a#b#c`.

Do: add the two rows to `syntaxRows` so they run under the same
no-configuration-load proof the existing rows use (a deliberately broken
configuration that must not be reported): exit 2, 12.7 error document, nothing
modified.

Verify: `npx vitest run … test/suite/section-12.0-ii.test.ts`.

### Task 41 — T12.7-1: `unavailable`-marker exclusivity walk on every captured JSON document; unpinned-surface range arms

Cites: TEST-SPEC T12.7-1 and the §11 preamble (the marker-exclusivity walk
covers every captured JSON document, unpinned surfaces included; on unpinned
surfaces a range is decoded only as `{"start","end"}` — arms: `query node`,
`nodes`/`subtree`/`ancestors` rows, `show --json`, and the review payload's
present scope node and present code-impact location); H-3 (fail loudly);
SPEC 11.2, 12.7.

Now: `assertUnavailabilityMarkerForms` (`test/helpers/adapters/forms.ts`) is
called only inside forms.ts; `adapters/query.ts`, `review.ts`, `model.ts`
never run it. T12.7-1's run body (`section-12.7.ts` ≈ 2236–2254) calls only the
located-findings, policy, cross-module, review-refusal and byte-paths arms;
`decodeSourceRange` (query.ts ≈ 64) is already form-exact.

Do: (a) invoke the walk (its iterative form, Task 6) on every captured JSON
document at the single decode entry of each adapter (query, review, model,
and any other adapter that parses product JSON), so an `unavailable` marker in
a non-exclusive position fails loudly everywhere; (b) add the listed
unpinned-surface arms to T12.7-1 asserting each present range decodes as
exactly `{"start","end"}` (no extra member) through the existing decoders.

Verify: `npx vitest run … test/suite/section-12.7.test.ts` and the full
`--project suite` run (the new walk must not misfire on any surface: any
failure it raises must be a diagnosed product form failure, never a harness
error); `npm run test:self` green (S-5).

### Task 42 — T12.7-2: clean-workspace `build --json` is exactly the findings-only form `{"findings": []}`

Cites: TEST-SPEC T12.7-2 (§12.7: on a clean workspace `build --json` emits
exactly `{"findings": []}` — the findings-only form with an empty list and no
other member); SPEC 12.1, 12.7.

Now: T12.7-2 (`section-12.7.ts` ≈ line 1777) asserts only `check --json` and
runs `build` without `--json`; `support.ts` `buildFindings` expects exit 1.

Do: add the `build --json` run to T12.7-2 on the clean workspace: exit 0, the
decoded document has exactly one member `findings` holding an empty list (and
the byte form T12.7-2 pins, if it pins one); add or extend a `support.ts`
helper for the exit-0 findings-only decode so other tests can reuse it.

Verify: `npx vitest run … test/suite/section-12.7.test.ts`.

### Task 43 — T12.7-3: `--config ../cfg/xspec.config.ts` from a sibling directory, reported as spelled

Cites: TEST-SPEC T12.7-3 (§12.7 revised: the nonexistent and the malformed
`--config <path>` cases are each staged from a sibling directory as `--config
../cfg/xspec.config.ts` and the error document reports the concerned path as
`../cfg/xspec.config.ts` — the ascent form); SPEC 12.7, 11.6, 14.14.

Now: `runErrorConfigPathsArm` (`section-12.7.ts` ≈ 2051, 2063) stages
`./cfg/broken.config.ts` and `missing.config.ts` from the root — no ascent
spelling.

Do: restage both cases: invoke from a sibling directory (`<root>/work`) with
`--config ../cfg/xspec.config.ts` — once absent, once malformed — and assert
the decoded error document's concerned path is exactly `../cfg/xspec.config.ts`
(exit 2, nothing written). Keep the root-relative cases if the spec still
lists them.

Verify: `npx vitest run … test/suite/section-12.7.test.ts`.

### Task 44 — T13.3-3: `impact --base` leaves the journal-error staging; stays in the obstructed-write staging only

Cites: TEST-SPEC T13.3-3 (revised: on the garbage-journal fixture each of
`ids`, `show`, `coverage`, `review status`, `query` reports the 14.13 journal
finding, exit 1; "`impact` is absent from the journal-error staging by
necessity" — a garbage line meets baseline resolution first (exit 2 per
6.3/T6.3-4); `impact --base` is driven "in the obstructed-write staging alone …
against a commit taken before the obstruction was staged, its baseline
resolving and 14.22 the operative gate finding"); SPEC 13.3, 6.3, 12.0.

Now: `section-13.3.ts` `gatedReadInvocations` (≈ line 2086) includes `impact
--base` and feeds both whole-gate arms; the garbage-journal arm (≈ 2576)
expects `impact` to exit 1 with 14.13 — contradicting the spec.

Do: split the invocation list: the journal-error arm drives the five read
commands only; the obstructed-write arm drives the five plus `impact --base
<commit before the obstruction>` expecting 14.22 as the operative finding.
Keep both fixtures' `audit` session and the modifies-nothing compares.

Verify: `npx vitest run … test/suite/section-13.3.test.ts`.

### Task 45 — T13.4-3: unreadable-record half — corrupted record before the configuration change

Cites: TEST-SPEC T13.4-3 (§13.4: with the record made unreadable — corrupted
shape-blind — before the configuration change, `build` replaces the record and
leaves the previous derived file as an orphan, the missing-record half's twin);
SPEC 13.4.

Now: `section-13.4.ts` covers only the missing-record half (no
`record-staging` import, no corruption arm).

Do: add the arm using `test/helpers/adapters/record-staging.ts` (H-3's
shape-blind garbage over the operational path set): corrupt the record, change
the configuration so the derived path moves, `build` → the record is
rewritten (valid, current), the old derived file still present (orphan), the
new one generated; assertions mirror the missing-record arm.

Verify: `npx vitest run … test/suite/section-13.4.test.ts`.

### Task 46 — T14-7: `refused-id-collision` locates every colliding bearer

Cites: TEST-SPEC T14-7 (§14: a jointly-violated condition locates every
participant — `refused-id-collision` locates every colliding bearer, two in
T6.4-3's prefix-replacement arm, `b` and `b.c`); SPEC 14, 6.4.

Now: `section-14.ts` T14-7 (≈ lines 118–132, 2260–2262) asserts
SOME-quantified over "the fixture's one assertable participant".

Do: stage Task 20's exported two-bearer fixture and assert the single finding's
location set equals exactly the two bearers. Prerequisite: Task 20.

Verify: `npx vitest run … test/suite/section-14.test.ts`.

### Task 47 — P-1: stage `.`-containing draws as nested segments; quote discipline for `'`/`"` draws

Cites: TEST-SPEC P-1 (§16 revised: "a draw containing `.` can be spelled as no
single segment (1.4: `.` is the ID separator) and stages as that many
segments, its bearer nested beneath the ancestor chain the split's prefixes
spell … asserting acceptance by `build` iff every resulting segment satisfies
1.4"; "each draw is spelled in the quote kind its content admits — double
quotes for a draw containing `'`, single quotes for one containing `"`, either
otherwise — and a draw containing both quote characters … is never staged");
SPEC 1.4, 2.7.

Now: `test/suite/registry/section-16-p1.ts` (≈ line 140) predicts rejection
for any `.`-containing draw and stages it as one top-level segment; the
alphabet (module header ≈ 52–57) omits `"` and `'` and every spelling is
double-quoted.

Do: (a) split a `.`-containing draw on `.`, stage the bearer nested under the
ancestor chain the prefixes spell (each prefix segment a valid staged
ancestor), and predict acceptance iff every resulting segment satisfies 1.4
(empty segments from leading/trailing/double dots are invalid); (b) add `"`
and `'` to the alphabet, choose the quote kind per the discipline, and filter
out draws containing both (never staged; keep the property's draw count by
redrawing); apply the same to the tag property. Keep the fixed seed set and
the seed report.

Verify: `npx vitest run … test/suite/section-16-p1.test.ts` (default seeds,
then `XSPEC_PROPERTY_SEED=random` a few times — no harness error); `npm run
test:self` green (CONF-VALID passes P-1; VALID-CTRL and VALID-WIDE still fail
exactly their sets).
