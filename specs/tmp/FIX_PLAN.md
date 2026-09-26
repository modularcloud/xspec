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
`unshare --map-user=1000 --map-group=1000 -- npm run test:self` (21 files, 2151 passed
after Task 5, 2167 after Task 6, 2201 after Task 7). Certification pairs:
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

## Conversion rule — the staged-source ledger (Task 5, done at 43c294d; governs Tasks 6–17)

Task 5 built the mechanism: `test/helpers/staged-mdx.ts` (`stagedMdx(name, source,
mdx = "well-formed")` registers a `StagedMdx` record at module load; the ledger is
sealed at the end of `test/suite/registry/index.ts`, so a run-time registration throws;
`unchecked` records are refused), `TestWorkspace.file(rel, record)` (the record's bytes
under the record's declaration; an `mdx` option beside a record, or a non-`.mdx` path,
throws `HarnessStagingError`), `judgeMdxDeclaration` (exported from
`test/helpers/workspace.ts` — the builder's own judge, one code path), and
`test/self/s9-staged-sources.test.ts` (loads the registry; asserts the ledger sealed,
non-empty, uniquely named, each name led by registered test IDs, no `unchecked`; judges
every record; red-checks the judge). `AGENTS.md` records the run recipes.

**The rule (Tasks 6–17 apply it per module):** every `file()` call staging an `.mdx` path
— literal, constant, or byte path — that a registered body or a helper it calls makes
AFTER a product invocation in that workspace passes a ledger record instead of plain
contents. The record is created at module top level from the SAME expression (moved,
never re-spelled; the staged bytes must be identical), named
`"<TEST-ID> <what it stages>"` (a record shared by tests: `"T14-4/T14-6 …"` — the
self-test checks that each leading ID names a registered test), and carries the
declaration in effect for that write today (the call's `mdx` option if any, else the
workspace-level `mdx` declaration for that path, else well-formed). Arm/variant tables:
type the table's source field `StagedMdx` (one record per row, named with the row's
key). Template functions called with body-local state (e.g. a `write()` closure over
mutable version variables): enumerate the versions, in order, into a module-level record
table and index through it in the body — never reorder or re-spell. A constant serving
both an initial `files` entry and a later `file()` call becomes a record whose `.source`
fills the `files` entry (`WorkspaceDecl.files` takes plain contents only). Stagings made
before any product invocation may otherwise stay as they are (S-7 reaches them).

**Edits of product-written bytes (the replace-helper rule, as Task 5 resolved it):** a
read-modify-write of a file the PRODUCT rewrote is not a deterministic fixture — no
harness constant equals those bytes, so S-9's before-any-product clause has nothing to
judge (`prepareRefusalWorkspace`'s prior `rename b0 → b` leaves `specs/a/A.mdx` holding
`d={B.b}`, which the base constant `RENAME_A` — `d={B.b0}` — never contains, so the
original "record computed from the base constant" was unimplementable there). Such an
edit goes through `workspace.edit(rel, from, to)` (`test/helpers/workspace.ts`: the first
occurrence replaced in the current bytes, judged under the path's declaration at staging
time; a missing `from` is a plain harness `Error`), which replaced the identical
`editSource` (`section-14-ii.ts`) and `stalenessEdit` (`write-refusal-staging.ts`)
helpers at their eleven call sites. `edit()` is never used on a file whose current bytes
are the harness's own constant (no product rewrite in between): that edit IS a
deterministic fixture — hoist `CONSTANT.replace(from, to)` into a record (asserting at
load that the constant contains `from`) and stage it with `file()`. `section-9.3.ts`'s
`editSourceExpecting` (Task 10) edits rename output too: keep its assertion, replace its
`file()` with `edit()`. Copies of product-rewritten files into a FRESH workspace
(section-6.4.ts ~2407, section-6.5.ts ~1654/2613) are not deterministic fixtures and stay
as they are.

**Reach (as Task 6 resolved it):** "after a product invocation" is judged per body, not
per workspace — S-7's sweep stops at the body's FIRST product invocation, in whatever
workspace, so a `file()` staging into a fresh later-arm workspace the product has not yet
touched (T1.5-2's Linux-leg byte path, staged after the spec and code arms' invocations)
is never reached against the stub and converts too, while a staging that precedes the
body's first invocation — `gitInit`/`gitCommitAll` invoke no product (T1.5-1's
`IDENTITY_B_EDITED`) — stays. Task 18's per-workspace guard is weaker than this reading
for such fresh later-arm workspaces; the conversions cover them by enumeration. The same
reach question touches the initial `files` of a workspace declaration created after the
body's first invocation (a later arm's `withWorkspace` / `TestWorkspace.create`): "S-7's
sweep reaches them against the stub" holds only for a body's first workspace, so those
later-arm initial files are judged at staging time against a real product, and neither
the ledger (`WorkspaceDecl.files` takes plain contents) nor Task 18's guard covers them —
an observation for the next determination (a mechanism change beyond the conversion
tasks), not converted here.

**Site lists (as Task 8 found):** the tasks' site lists were enumerated mechanically —
every `.mdx` `file()` call in the module — and include sites that precede the body's
first product invocation: ten of Task 8's eleven `section-5.6.ts` sites (every T5.6-n
body stages its edits between `gitCommitAll("baseline")` and its first `buildOk`; only
T5.6-4's arm-2 staging follows arm 1's `build`/`impact`). Judge each listed site against
the body's first invocation before converting it; such sites stay (S-7's sweep reaches
them against the stub). As Task 9 found: a staging made by a helper counts under
the body that calls it (T13.5-1's `staleWorkspaceArm`); a constant one module
exports for another's identically staged arm becomes ONE record, created and
exported by the defining module and named with both IDs (`section-6.5.ts`'s
`MOVE_PRECONDITION_BREAK`, `"T6.5-4/T6.6-3 …"`); a body-local alternation over
a template (T13.5-5's `stateTwo ? … : …`) enumerates to one record per state,
the body picking by the same condition; restorations of product-written graph
data and mutations of generated files (`section-13.3.ts`'s `restoreGraphData`,
`section-13.4.ts`'s rounds) stage no `.mdx` path and stay. As Task 10 found: a
body-local alias of an imported template object (T9.1-1's `const wx =
workedExample`) resolves to the import in the record — the same function,
identical bytes; and a module's own replace helper over product-rewritten
bytes (`section-9.3.ts`'s `editSourceExpecting`) keeps its diagnosis and calls
`edit()` in place of `file()`. As Task 11 found: a constant staged both by a body
directly and by a shared helper other tests call (`section-10.1.ts`'s
`A_MDX_EDITED`: T10.1-1's stale arm, and `assertCreateFollowsRefresh` under
T10.1-6) becomes ONE record named with every calling test's ID
(`"T10.1-1/T10.1-6 …"`); and the tasks' certification notes overstate §10's
scope — `test/self/certification-fixtures.ts`'s `inScope` lists name, among
§10–§12, only T10.4-5 (Task 12) and T11.2-2, T11.2-4, T11.3-4, T11.4-1, T11.4-3,
T11.4-4 (Task 16), so every other module's conversion leaves certification
untouched by construction, the full self run's 144/33 confirming it. As Task 12
found: a `write()` closure over mutable version variables (`section-10.4.ts`'s
six T10.4-1 scenarios) enumerates into a module-level `as const` tuple of
records in staging order — the identical template call with the closure's
cumulative arguments spelled out, every state carrying the earlier edits
forward — the arms indexing through it, and a state the closure staged before
the body's first invocation (the subtree-coherence scenario's pre-`create`
edit) stays a plain module-level constant beside the table; an append to
product-written bytes (T10.4-4's reintroduction, the former `Buffer.concat`
over the rename's output) is T5.4-1's anchored `edit()`; and a conversion's
byte identity is verifiable end to end by a temporary capture in
`TestWorkspace.write()` (AGENTS.md's recipe) — the §10.4 file's 70 writes
hashed identical before and after.
As Task 13 found: the site lists' `— read` sites are template calls too (no
§10.5/§10.6 body reads product-written bytes back, so no `edit()` there), and the
later-arm initial `files` — T10.5-1's extended and chain fixtures, T10.5-5's
sub-fixture B, T10.6-2's sub-fixture 2 — join the reach observation above.
As Task 14 found: a site list's `— read` annotation can mark a non-`.mdx` helper
site (`section-10.7-i.ts` 638 writes garbage bytes over the session path in
`CORRUPT_CREATE_ARMS`) — judged and left; identical bytes one test stages at two
sites (T10.7-2's `leafSpec("n", "Enn text.")` in both arms) are ONE record staged
at both, a second registration of the name throwing at load; and T10.7-1's
per-state corrupt-session workspaces and T10.7-2's audit arm join the reach
observation above.
As Task 15 found: a site list can name a git-staged pre-build edit
(`section-10.7-ii.ts` 1807, T10.7-9's path-blocks v1 edit between
`gitCommitAll("baseline")` and the body's first `build`) — judged and left
plain, as the reach rule reads; every other listed `.mdx` site followed its
body's first invocation and converted (eleven records); and T10.7-7's
fully-resolved and payload arms, T10.7-9's audit arm, and T10.7-12's
provenance and coverage arms join the reach observation above.
As Task 16 found: a helper's staging is judged under every calling body
(`section-12.0-ii.ts` 296, `makeStoryWorkspace`'s omega edit — T12.0-7 calls it
twice and T12.0-9 once, each before its first invocation — stays plain); a
byte-path staging converts exactly as a string path does when it follows the
body's first invocation (T12.7-1's `specs/d<0xFF>/In.mdx` and `Tgt.mdx`, a
record through the same `file()` overload, `isMdxPath` judging the trailing
bytes) and stays plain when it precedes it (T11.2-3's, T11.5-3's, and
T12.7-2's byte paths, each before its arm's gate `build`, the body's first);
a module the site list names with only non-`.mdx` sites (`section-11.6.ts`:
`.bin`, `.ts`, journal, and session paths) converts nothing; the conversion
of a CONF-AVAIL-scoped test's site (T11.3-4's holder) left certification at
144/33 as the rule predicts; and T12.0-8's coverage and impact arms,
T12.0-9's corrupt, invalid, wrong-kind, and exclusion arms, T12.0-10's
workspaces after its twin pair, and every §12.7 arm after each body's first
join the reach observation above.
As Task 17 found: a body reading its own fixture's bytes back from the
workspace after a `build` to stage them under a new path
(`section-12.1-12.2.ts` 597, T12.1-3's manual rename of specs/A.mdx to
specs/C.mdx) hoists to a record over the fixture constant — `build` writes
derived files and graph data only, never a source (SPEC 12.1), which the
arm now pins as its staging premise (`assertBytesEqual` of the current
bytes against the record's `.source`) before staging the record, so a
product deviation stays a diagnosed failure rather than a silently
different copy; three of the site list's four `— read` annotations (879,
1024, 1124) marked inline `.mdx` literals staged after the family
workspace's `build` and converted, the fourth (1345) the session file; a
constant staged back by three tests (`FAILED_BUILD_VALID_SOURCE`, restored
after an edit under T12.1-4, T12.2-2, and T12.2-3) is one record named
with all three IDs, its `.source` filling eight initial `files` entries,
`withWorkspace` and the fixture tables widened to `FileContents` for it;
no §12.1/§12.2 test is in certification scope (144/33 unchanged); and
T12.2-2's family workspaces after the first (families 2–9) and T12.2-4's
arms (b)–(d) join the reach observation above.

**Appending to product-written bytes (T5.4-1's pattern):** an append is an `edit()`
extending the file's unique tail (`REINTRO_TAIL`, `f`'s closing run, which the rename
leaves in place), the anchor's uniqueness and end position diagnosed first (`anchorOnce`
— the former `replaceOnce`'s two `fail()` diagnoses, no rewrite — and an `endsWith`
check), so a product deviation there is a product failure, never `edit()`'s plain
refusal (H-8); every manual re-spelling of rename/move output in `section-5.4.ts` is
`anchorOnce` then `edit()` — the form for Task 10's `editSourceExpecting`.

**Checks after each conversion task:** `npx tsc -p test`; `npm run format:check`; the
self project green in the namespace (the self-test lists the module's records:
`npx vitest list --config test/vitest.config.ts --project self test/self/s9-staged-sources.test.ts | grep '> T'`);
S-7 unaffected; each converted test alone against the built product gives its recorded
verdict (`unshare … -- npx vitest run --config test/vitest.config.ts --project suite
<file-substring> -t '<ID> '`; a record site behind a diagnosed product failure is not
reached — accepted, Task 18's guard surfaces it when the product gets there).

## Tasks

### Task 18 — The undeclared-staging guard (last: after every conversion)

**Requirement.** S-9's timing clause (the preamble's conversion rule) is met only while every post-invocation
`.mdx` staging is a ledger record; nothing enforces that a future staging joins the
ledger. This guard makes an omission a harness error at the first run that reaches
the site (the same bounded surfacing the builder's own check has), so the ledger's
completeness is regression-guarded rather than trusted to enumeration.

**Change.**
1. A workspace learns that the product was invoked in it: `runProduct` and
   `startProduct` (`test/helpers/subprocess.ts`, the one H-2 capture path) note the
   invocation's `cwd` through a small registry of live workspace roots (register on
   `TestWorkspace.create`, unregister on `dispose`; match `cwd` equal to a root or
   inside one, comparing both the root and its realpath) — or, if a cycle-free
   import is impractical, have the registry's common invocation helpers
   (`support.ts` `runCli`/`expectExit`/`runJson`/`runFindingsReport`) and every direct
   `runProduct`/`startProduct` call site in `test/suite/` mark the workspace; the
   subprocess-level variant is preferred because it cannot be bypassed.
2. `TestWorkspace.file()` on an `.mdx` path after such an invocation, with plain
   contents (no `StagedMdx` record) and an effective declaration that is neither
   `"unchecked"` (P-8's mutations) nor the new per-draw marker below, throws
   `HarnessStagingError` of a new mode (`undeclared-staging`) naming the path and the
   rule (the preamble's). `TestWorkspace.edit()` — an edit of product-written bytes
   (the preamble's replace-helper rule) — is a declared staging by construction and
   passes the guard; its plain `file()`-free write path already exists (`write()`).
   Optional, only if it costs a few lines and no reachable arm can trip it: remember
   each path's last deterministic staging (a `files` entry or a record — a hash) and
   have `edit()` refuse a path whose current bytes still equal it, since that edit is
   a deterministic fixture belonging in the ledger.
3. Per-draw marker: property modules stage draws after invocations
   (`section-16-p4.ts` ~2239/2267, `section-16-p5-p6.ts` ~788, `section-16-p9.ts` ~1011)
   whose sources `checkProperty`'s `mdxSources` judged before the body ran (S-9's
   property clause). Add a `MdxFileDeclaration` member (e.g. `"per-draw"`) meaning
   "well-formed; judged per draw by the property runner; exempt from the guard" —
   the builder still judges it as well-formed at staging — and pass it at exactly
   those call sites; the helper header documents that it is never used outside
   `section-16-*.ts`. `section-16-p8.ts` keeps `"unchecked"`.
4. Any site the guard reveals (a body or helper staging `.mdx` after an invocation
   without a record) is converted under the preamble's rule in this same task.

**Checks.** `npx tsc -p test`; the self project green in the namespace, certification
totals 144/33 with no error (an in-scope test reaching an undeclared staging against
its conformer would surface here — convert it); the full suite against the built
product reports no `undeclared-staging` harness error (every currently reachable
site is declared; sites behind diagnosed product failures surface when the product
reaches them — the guard's intended bounded behavior). Red check: in a scratch copy
of one converted module whose test passes against the built product, replace one
record with its plain source, run that test alone, read the `undeclared-staging`
diagnosis, restore. Record the guard, its error mode, and the per-draw marker in
`AGENTS.md`.
