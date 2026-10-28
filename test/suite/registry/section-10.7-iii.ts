// TEST-SPEC §10.7 (review commands), third part: T10.7-13 (the metadata
// pair), T10.7-14 (the refusal finding form), and T10.7-15 (the outcome
// order past the gate). T10.7-1…T10.7-6 are section-10.7-i.ts's business,
// and T10.7-7…T10.7-12 section-10.7-ii.ts's.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.7 (T10.7-13): a `metadata-consistency` item's payload — `next
// --json`, and identically `show` and `export` — carries its scope node's
// metadata pair, a before/after pair under the origin-text rule: before,
// the node's `d` targets, coverage attribute, and tags (5.5) in the item's
// baseline state (10.2: in a baseline session the recorded baseline graph);
// after, in the current graph; each `d` target under its current identity
// (10.4); a side whose graph state lacks the node presented absent, carrying
// no metadata. The coverage attribute and the tags take 12.7's value forms.
//
// Conservative operationalizations for T10.7-13 (noted per H-3/H-4):
// - The pair decodes through the review adapter (helpers/adapters/review.ts:
//   required on every `metadata-consistency` item, failing loudly when
//   absent; its member layout the adapter's assumed shape, H-3), the
//   coverage attribute and the tags decoded literally there — the string
//   "required" or "none", a tag set in byte order with duplicates collapsed
//   (12.7; T12.7-1) — so a product carrying either in another form fails at
//   the decode. Each side is then asserted exactly: its presence, its `d`
//   targets compared as a set (10.7 fixes no order for them), its coverage
//   attribute, and its tags.
// - Each item is asserted identically through the three surfaces: `export`
//   (the item found by kind and scope node), `show` of that item's id, and
//   `next --json`. Where an arm's session holds two items (b), `next` is
//   walked: whichever item it returns is asserted and resolved `no-change`
//   (which never re-derives, SPEC 10.5), and the next read must return the
//   other — so no item order is assumed (10.5's business).
// - Each arm first asserts, from `export`, the item set its one edit yields —
//   a staging premise (SPEC 5.5, 5.6, 10.5: metadata-changed nodes alone; no
//   node changed; no dependency edge to a target whose effectiveHash
//   changed; a coverage- or tags-only edit propagating nothing) — so `next`
//   can only return the arm's items.
// - Three path-blocks workspaces (`review create --base <baseline commit>`),
//   one session `s` each; every edit is followed by an explicit `build`
//   before any read, so no read relies on the 13.3 refresh path; (c)'s
//   `rename` finishes by regenerating derived files as `build` does (6.4).
//   (a) and (d) share specs/M.mdx's workspace, (d) after (a)'s assertions;
//   the context is asserted where the entry states it — (a), (b), (c) — and
//   (d) asserts the pair alone.
// - Staged-source records (helpers/staged-mdx.ts, helpers/staged-ts.ts;
//   S-9): the configuration shared by the three workspaces (`M13_CONFIG`),
//   (d)'s deletion of m's section, and the (b) and (c) workspaces' initial
//   sources and edits — all staged after the body's first invocation, or as
//   initial files of a workspace created after it. The first workspace's
//   initial spec source and (a)'s edit, staged before any invocation (git
//   staging invokes no product), stay plain strings.
//
// SPEC 10.7 (T10.7-14): `review create` with the name of an existing
// session — a name matching one ignoring ASCII case counting, at `create`,
// as that session's (10.1) — `resolve` of a blocked item, and `split` of an
// item of any other kind or of a `subtree-coherence` item whose scope root
// has no children are refused, each refusal one finding, exit 1, modifying
// nothing (13.5). SPEC 14: a review-operation refusal carries no stable
// code, and neither location nor concerned path — `locations` empty, `path`
// `null` (12.7); a refused operation's report is the findings-only form
// `{"findings": […]}` (12.7).
//
// Conservative operationalizations for T10.7-14 (noted per H-3/H-4):
// - Every refusal runs through the shared check (support.ts
//   `expectReviewRefusal`), the one each of the refusal's home tests runs
//   too (T10.1-2, T10.1-6, T10.3-2, T10.7-1, T10.7-9, T10.7-10), as do
//   T10.7-15's refusals on stale graph data: the command run with `--json`,
//   exit 1, standard output exactly `{"findings": [f]}` decoded form-exact
//   (H-3: the one member; `f` exactly the five members
//   `code`, `message`, `locations`, `path`, `identities`), `code` `null`,
//   `locations` `[]`, `path` `null`, and `identities` an array of strings
//   (the decode's) whose content is informational (12.7) and not asserted;
//   the session file the refusal names byte-identical around the run. That
//   is T10.7-14's whole compare: the whole-root "nothing modified" is its
//   home tests' (the sites above pass the shared check's option).
// - One audit session `s` (no baseline, so no git) over one file carries
//   every refusal the entry lists, each staged as its home test stages it:
//   `create` naming `s` exactly and as `S` (ASCII case alone; T10.7-1,
//   T10.1-2); `resolve` of p's item, blocked by p.a's unresolved item
//   (audit blocking, SPEC 10.6; T10.7-10), and of p's `parent-consistency`
//   item, blocked by p.a's resolved item once that item reads `invalidated`
//   (re-blocking, SPEC 10.3, 10.4; T10.3-2); `split` of p.a's item, a
//   leaf's (no children), of p's `parent-consistency` item (another kind),
//   and of t's item once t's only child t.u has been deleted by manual edit
//   after `create` (no children now; T10.7-9). p's `parent-consistency` item
//   comes from splitting p's item (SPEC 10.7: the scope root's
//   `parent-consistency` item, blocked by the child items). Each premise the
//   staging relies on — the blocked states and the decomposition's item — is
//   asserted from `review status --json` before the refusal it serves
//   (diagnosed, H-8).
// - The one edit (p.a's text, and t.u deleted) is followed by an explicit
//   `build` before any read, so no read or refusal meets stale graph data
//   (the refresh path is T13.3's business, and refusals beside it T10.1-6's).
//   It is staged after the body's first invocation, so it is a staged-source
//   record (helpers/staged-mdx.ts, S-9); the initial file and configuration
//   of the body's one workspace, created before any invocation, stay plain
//   strings.
//
// SPEC 10.7 (T10.7-15): a `review` subcommand meets its outcomes in one
// order, each step reached only once every earlier one has passed — ahead
// of the gate of 13.3 the errors 12.0 orders before it, `create`'s given
// baseline among them (6.3: its resolution reads the current journal
// first, a journal error failing it with 14.13's code and path); on a
// workspace failing `build`'s validations the gate's report then ends the
// subcommand, no session read; past it, the session read (meeting the
// named session's corruption, 10.1, 14.21; at `list` the listing of the
// session directory and the read of every session in it, each corruption
// part of its answer; at `create` the examination of the session
// directory, meeting the existing-name refusal, the corruption in its
// place, or the obstruction of 14.22), an unknown item ID (12.0), the
// recorded baseline (6.3), and the refusals — `resolve`'s of a blocked
// item, `split`'s of an item of another kind or of one whose scope root has
// no children. Each of these outcomes but `list`'s corruptions ends the
// subcommand there, modifying nothing (13.5): stale graph data stays stale.
// Only past all of them does a subcommand write — the refresh of 13.3, then
// a mutating subcommand's session file — a read subcommand answering only
// then, `list` included (SPEC 12.0, 14.24: a write failure is met only at
// the write it refuses, a refresh's too; 14.25: a read failure at the read
// it refuses).
//
// Conservative operationalizations for T10.7-15 (noted per H-3/H-4):
// - Every arm, (a)–(g), is staged, in TEST-SPEC's order, on the fixtures
//   below, byte copies of their states, and twins of (A).
// - Fixture (A) (`o15StageFixtureA`): specs/A.mdx holding top-level P with
//   its child P.c, Q with Q.r, and the leaves s and u, beside one spec
//   group; built; the audit session `a` created and Q's subtree-coherence
//   item split, giving `a` Q's parent-consistency item (T10.7-9); a second
//   audit session `x` created and then made corrupt by T10.1-4's
//   garbage-bytes state written directly over its product-written file
//   (shape-independent, so no assumed layout). Each premise an invocation
//   relies on is read from `review status --json` before the staleness
//   edit, diagnosed (H-8): P's item unresolved and blocked, P.c's
//   unresolved and unblocked (audit blocking, 10.6), Q's parent-consistency
//   item and s's item present, no item of `a` bearing the unknown item ID
//   (harness-prefixed, `xspec-harness-no-such-item`, so no product-chosen id
//   collides with it), and an id `x` held (the `<any-id>` of `resolve x`).
// - Fixture (B) (`o15StageFixtureB`): a git workspace whose specs/B.mdx
//   holds top-level G with its child G.N, and the leaf v; committed as c1;
//   G.N's text edited; built; `review create --base c1 --name b`, whose
//   `status` (a premise) holds exactly G.N's subtree-coherence item,
//   unresolved and unblocked, and G's parent-consistency item, unresolved
//   and blocked (10.5); then T10.7-3's staging — the repository removed
//   (`.git` deleted, the configuration file then inside no working tree,
//   6.3), c1 no longer resolving from the root through the harness's own
//   git (a premise). That state, no section edited since `create`, is kept
//   as a byte copy made before the staleness edit (`created`): (d)'s.
// - Stale graph data (13.3): on each fixture a section's text is edited —
//   u's, v's — after the last product invocation, no rebuild and no read
//   since. That state is never invoked on again: each invocation runs on its
//   own byte copy of it (helpers/tree-copy.ts `copyTreeBytes`, checked
//   against the state's snapshot first — a difference is a harness error,
//   never a product verdict), so each meets stale graph data whatever
//   another did; SPEC 13.3 judges staleness by content alone, so a copy is
//   as stale as its state.
// - Around each invocation one whole-root compare of its copy admits no
//   change but H-6's lock-path exclusion of a mutating run (SPEC 10.7, 13.5:
//   each outcome ends the subcommand modifying nothing — graph data, T13.3-2's
//   operational path set, byte-identical and so still stale), each change
//   diagnosed by where it falls (`o15ChangeClass`: graph data through
//   `isGraphDataKey`, as the refresh made before the outcome; the session
//   directory; the rest).
// - The outcomes, each run under `--json`: the refusals through T10.7-14's
//   shared check (support.ts `expectReviewRefusal`, the session file `a.json`
//   byte-identical); the unknown item ID and the irreconstructible recorded
//   baseline as the plain usage error (support.ts `assertPlainUsageError`:
//   exit 2, `code` and `path` `null`, no locations, a standard-error
//   message); the corrupt session as exactly one condition-21 finding
//   concerning its own file `.xspec/reviews/x.json`, `locations` `[]`, exit
//   1 (SPEC 14, 12.7: a session condition carries the file it concerns).
// - (a): `check --json` afterwards (exit 1) braces the compare the way SPEC
//   defines staleness (13.3, 14.10; `o15AssertStillStale`, T10.1-6's brace
//   for its stale twins): exactly one condition-10 finding in the graph-data
//   unit form (concerning `.xspec`, locations []), every other per file,
//   concerning a derived path of the edited source (`specs/A.xspec.` or
//   `specs/B.xspec.` plus a suffix, 13.1) with its module among them (it
//   embeds the edited text, 4.2), each instructing rebuilding (14.10); beside
//   them exactly x's one 14.21 on (A) (T10.1-4: `check` reports a corrupt
//   session) and nothing on (B).
// - (b), on the Linux leg (`WRITE_REFUSALS_STAGED`; E-1: permission
//   stagings): T14-9's graph-data staging (write-refusal-staging.ts
//   `graphDataRefusal`) is applied before a read's invocation (`runStaged`;
//   the reads take no hold) and, for `resolve` and `split`, while the run is
//   held at the seam of 13.5, after acquisition (`runHeldWithStaging`; before
//   it the staging would refuse acquisition's own creation of the lock
//   directory), restored once the run exits; the refusals run through the
//   shared check's `run` option. A run answering `write-failure` fails as
//   the refresh attempted before the outcome (`o15RejectWriteFailure`); each
//   must report exactly its (a) outcome, nothing modified around it. Under
//   the staging a held run's release deletes its entry but is refused the
//   emptied lock directory's deletion, which stays behind (13.5: no outcome
//   changes; H-6 leaves the lock path out of the compare).
// - (c), graph judgements against the current workspace (10.7, 13.3): three
//   twins of (A) (`o15StageTwinA`), each a fresh workspace of (A)'s initial
//   source and configuration, built, holding its own audit session `a`,
//   unsplit, and no second session (TEST-SPEC names `a` alone); each
//   premise is read from `review status --json` before the hand edit, and
//   the edit is followed by the invocation with no rebuild and no read
//   between them, so graph data is stale when the subcommand runs. (i) P.c's
//   item resolved `no-change` (P's item blocked before, unblocked after: a
//   premise), then P.c's text edited: `resolve a <P's item> --status
//   no-change` is refused through the shared check, nothing modified (the
//   whole-root compare). (ii) Q.r's section deleted: `split a <Q's item>` is
//   refused, nothing modified. (iii) A child s.t authored under the leaf s:
//   `split a <s's item>` exits 0; `check --json` then runs before any
//   refreshing read (`o15AssertRefreshed`: no unit form, graph data
//   refreshed by the split — TEST-SPEC's observation of the refresh made
//   before the session write — beside the edited source's per-file
//   staleness, its module among it, 13.3's refresh never rewriting derived
//   files), and `export` afterwards shows the session's kind and scope-node
//   pairs gaining exactly s.t's subtree-coherence item and s's
//   parent-consistency item, the latter's context exactly {s.t} and its
//   blockedBy exactly s.t's item.
// - (d), the recorded baseline's place (10.7, 12.0): `O15_PLACE_CALLS`, each
//   on its own copy of (B)'s `created` state with its staging made on the
//   copy (`o15StagePlace`), inside the whole-root compare: on the state
//   itself `resolve b <G's parent-consistency item> --status no-change`
//   (blocked by G.N's item) and `split b <it>` (another kind) answer the
//   baseline's plain usage error; with b's file corrupted by T10.1-4's
//   `blockedBy`-cycle staging (adapters/session-staging.ts
//   `stageBlockedByCycle`: the first two items block each other, the file
//   parseable, its recorded parameters untouched) `status b`, `resolve b
//   <G.N's item> --status no-change`, and `split b <G's parent-consistency
//   item>` report exactly the condition-21 finding concerning
//   `.xspec/reviews/b.json`; with specs/B.mdx given a section with no id
//   (exactly one condition-1 finding — the section has no children, so
//   condition 2's masking never enters) `status`, `next`, `show`, `export`,
//   `resolve`, and `split` naming `b`, each with `--json` and the real item
//   IDs where it takes one, report exactly the gate's findings: those of
//   `build --json` on a copy of that state (`o15GateReference`; SPEC 13.3:
//   the findings a `build` would now report), compared by condition, code,
//   path, and locations — message wording free (H-3) — exit 1.
// - Unstageable, recorded here as T6.5-6 records its unstageable clauses:
//   (d)'s place of an unknown item ID before the recorded baseline. On a
//   baseline session whose recorded baseline cannot be reconstructed, both
//   outcomes are the plain usage error — exit 2, `code` and `path` `null`,
//   nothing modified — so the two orders differ only in the message's
//   wording, which no test asserts (H-3). Not asserted.
// - (e), `list`'s place (10.7, 13.3; T13.3-2's sweep), `review list --json`
//   three times, each on its own copy of (A)'s stale state (`o15ListArm`):
//   as staged, exit 1 with the listing decoded (adapters' `review list`
//   decode: `a` healthy and `x` corrupt, in byte order of name, exactly as
//   names and corrupt flags; the listing's findings exactly x's one
//   condition-21 finding concerning `.xspec/reviews/x.json`, `locations`
//   []), then `check --json` before any other read (`o15AssertRefreshed`:
//   no graph-data unit form — graph data refreshed by `list` past its
//   corruption — beside the edited source's per-file staleness and x's one
//   14.21); and, on the Linux leg, with the graph-data area staged
//   unwritable by T14-9's graph-data staging before the run (`runStaged`:
//   `list` takes no hold) — exit 2, the error document as the entire
//   stdout, `code` `write-failure`, `path` `.xspec` (write-refusal-staging.ts
//   `expectWriteFailure`) — and with `.xspec/reviews` staged unlistable
//   instead (T14-10(h)'s staging, helpers/permissions.ts
//   `stageReadRefusalOfDirectory`: mode 0o100, verified on the harness) —
//   exit 2, `code` `read-failure`, `path` `.xspec/reviews`
//   (`o15ExpectReadFailure`), and graph data byte-identical around it
//   (`o15AssertGraphDataUnchanged`: T13.3-2's operational path set alone,
//   as TEST-SPEC states it). The runs under a staging assert nothing about
//   the rest of the workspace, which TEST-SPEC leaves unstated there.
// - (f)(i), the session directory's place behind the gate (10.7, 13.3,
//   14.21, 14.22), and (g), the item ID's place behind it (12.0, 10.7): each
//   invocation on its own copy of (A)'s stale state with specs/A.mdx
//   replaced by (A)'s staleness edit plus a section with no id after u
//   (`o15StageGate`; exactly one condition-1 finding — childless, so
//   condition 2's masking never enters), its session `a` well-formed and
//   `x` corrupt as staged, inside the whole-root compare: `review create
//   --strategy audit` naming `a`, `x`, and `A` (a ignoring ASCII case alone,
//   10.1); `create --name n` with `.xspec/reviews` replaced by a plain file;
//   on the Linux leg, `review list` and `create --name n` with
//   `.xspec/reviews` staged unlistable around the run (T14-10(h)'s staging,
//   `runStaged`); and (g)'s `show`, `resolve --status no-change`, and
//   `split` naming `a` and the unknown item ID — each with `--json`,
//   exactly the gate's findings: those of `build --json` on a copy of the
//   failing state (`o15GateReference`, taken once for (f)(i) and (g)),
//   compared as in (d), exit 1.
// - (f)(ii), the errors ahead of the gate (10.7, 12.0, 6.3): a twin of (A)
//   (`o15StageGitTwinA`: `o15StageTwinA`'s fresh workspace, built, its own
//   audit session `a` created and read through `status`, unsplit, no `x`),
//   then a git repository initialized there and everything committed as
//   `c1`; each invocation on its own copy of that state with its staging
//   made on the copy (`o15AheadArm`), inside the whole-root compare, `.git`
//   included: as staged, `review create --coverage nope --name a` and
//   `--base nope --name a` answer the plain usage error; with T6.1-3's
//   garbage line appended to the current journal
//   (`o15AppendJournalGarbage`: absent, the twin having made no journaled
//   operation, SPEC 6.1, so the append brings it into existence holding the
//   line), `create --base c1 --name a` exits 2 with `code` `journal-error`
//   and `path` `.xspec/journal` (`o15ExpectJournalError`); and with u's
//   text edited as in (A), `create --base nope --name a` answers the plain
//   usage error, `check --json` afterwards still reporting the graph-data
//   unit form beside the edited source's per-file staleness, nothing else.
// - Staged-source records (S-9): both fixtures' sources and configuration —
//   records, so the twins that arms (c) and (f)(ii) create after an
//   invocation stage the same bytes — the three edits of the fixtures, (c)'s
//   three hand edits, and the failing sources of (d) and of (f)(i) and (g);
//   T10.1-4's garbage bytes and cycle staging (session files), (f)(i)'s
//   plain file at `.xspec/reviews`, (f)(ii)'s garbage journal line, and the
//   hold file are no sources.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type {
  CoverageAttributeValue,
  ExportReport,
  Finding,
  ItemKind,
  MetadataSide,
  NextReport,
  ReviewItem,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  GRAPH_DATA_AREA_PATH,
  decodeExportReport,
  decodeFindingsReport,
  decodeItemReport,
  decodeNextReport,
  decodeSessionListReport,
  decodeSessionStatusReport,
  isGraphDataKey,
  renderPathValue,
  stageBlockedByCycle,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { stageReadRefusalOfDirectory } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { DirectorySnapshot } from "../../helpers/snapshot.js";
import { diffSnapshots, snapshotDirectory } from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { copyTreeBytes } from "../../helpers/tree-copy.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertFindingInstructsRebuilding,
  assertFindingLocated,
  assertPlainUsageError,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectErrorDocument,
  expectExit,
  expectReviewRefusal,
  runCli,
  runFindingsReport,
  runJson,
} from "./support.js";
import type { StagingApplier } from "./write-refusal-staging.js";
import {
  JOURNAL_PATH,
  REVIEWS_DIR,
  WRITE_FAILURE_CODE,
  WRITE_REFUSALS_STAGED,
  expectWriteFailure,
  graphDataRefusal,
  runHeldWithStaging,
  runStaged,
} from "./write-refusal-staging.js";

// ---------------------------------------------------------------------------
// T10.7-13 — metadata pair
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group. A
// staged-source record (S-9): the (b) and (c) workspaces are created after
// the body's first invocation.
const M13_CONFIG = stagedTs(
  "T10.7-13 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

/** The session every arm creates, one per workspace (SPEC 10.1). */
const M13_SESSION = "s";

// Arms (a) and (d): specs/M.mdx — `m` and the unedited targets t1, t2, t3.
const M13_M_FILE = "specs/M.mdx";
const M13_M = "specs/M.mdx#m";
const M13_M_T1 = "specs/M.mdx#t1";
const M13_M_T2 = "specs/M.mdx#t2";
const M13_M_T3 = "specs/M.mdx#t3";

/**
 * specs/M.mdx: at the baseline `m`'s `d` names t1 and t2, and `m` spells no
 * `coverage` attribute and spells `tags="b a"`; (a)'s one edit makes it name
 * t2 and t3, spell `coverage="none"`, and spell `tags="c b"` — each tag list
 * spelled out of byte order; (d) deletes m's section, nothing referencing
 * it. The targets stay unedited throughout.
 */
function m13MSpec(state: "baseline" | "edited" | "deleted"): string {
  const opening =
    state === "baseline"
      ? '<S id="m" d={["t1", "t2"]} tags="b a">'
      : '<S id="m" d={["t2", "t3"]} coverage="none" tags="c b">';
  return [
    ...(state === "deleted" ? [] : [opening, "Em own line.", "</S>", ""]),
    '<S id="t1">',
    "Tee one line.",
    "</S>",
    "",
    '<S id="t2">',
    "Tee two line.",
    "</S>",
    "",
    '<S id="t3">',
    "Tee three line.",
    "</S>",
    "",
  ].join("\n");
}

// (d)'s deletion follows the body's first invocation: a staged-source record
// (helpers/staged-mdx.ts, S-9).
const M13_M_DELETED = stagedMdx(
  "T10.7-13 specs/M.mdx with m's section deleted by manual edit (arm (d))",
  m13MSpec("deleted"),
);

// Arm (b): specs/GH.mdx — `g` (its `d` naming the unedited t1 on both
// sides), `h`, and t1.
const M13_GH_FILE = "specs/GH.mdx";
const M13_G = "specs/GH.mdx#g";
const M13_H = "specs/GH.mdx#h";
const M13_GH_T1 = "specs/GH.mdx#t1";

/** specs/GH.mdx: (b)'s edit retags g (`x` to `y`) and gives h `coverage="none"`. */
function m13GhSpec(edited: boolean): string {
  return [
    edited ? '<S id="g" d={"t1"} tags="y">' : '<S id="g" d={"t1"} tags="x">',
    "Gee own line.",
    "</S>",
    "",
    edited ? '<S id="h" coverage="none">' : '<S id="h">',
    "Aitch own line.",
    "</S>",
    "",
    '<S id="t1">',
    "Tee one line.",
    "</S>",
    "",
  ].join("\n");
}

// The (b) workspace is created after the body's first invocation, so its
// initial source and its edit are staged-source records (S-9).
const M13_GH_BASELINE = stagedMdx(
  "T10.7-13 specs/GH.mdx at the baseline (arm (b): g tagged x, h spelling no coverage attribute)",
  m13GhSpec(false),
);
const M13_GH_EDITED = stagedMdx(
  "T10.7-13 specs/GH.mdx after arm (b)'s edit (g tagged y, h spelling coverage none)",
  m13GhSpec(true),
);

// Arm (c): specs/K.mdx — `k` and t4, renamed t9 after `create`.
const M13_K_FILE = "specs/K.mdx";
const M13_K = "specs/K.mdx#k";
const M13_K_T9 = "specs/K.mdx#t9";

/** specs/K.mdx: at the baseline k's `d` names t4; (c)'s edit removes it. */
function m13KSpec(withReference: boolean): string {
  return [
    withReference ? '<S id="k" d={"t4"}>' : '<S id="k">',
    "Kay own line.",
    "</S>",
    "",
    '<S id="t4">',
    "Tee four line.",
    "</S>",
    "",
  ].join("\n");
}

// The (c) workspace is created after the body's first invocation: its
// initial source and its edit are staged-source records (S-9).
const M13_K_BASELINE = stagedMdx(
  "T10.7-13 specs/K.mdx at the baseline (arm (c): k's d naming t4)",
  m13KSpec(true),
);
const M13_K_EDITED = stagedMdx(
  "T10.7-13 specs/K.mdx with k's reference to t4 removed (arm (c), before create)",
  m13KSpec(false),
);

/** What one side of a metadata pair must present (SPEC 10.7; T10.7-13). */
type M13SideExpectation =
  | { readonly present: false }
  | {
      readonly present: true;
      readonly d: readonly string[];
      readonly coverage: CoverageAttributeValue;
      readonly tags: readonly string[];
    };

/** One `metadata-consistency` item's expected pair (and context). */
interface M13Expectation {
  /** The item, for diagnoses (`m`); the context names the arm. */
  readonly label: string;
  /** The item's scope node — its current identity (SPEC 10.4). */
  readonly scope: string;
  /** The context identity set, where the entry states it (SPEC 10.5). */
  readonly context?: readonly string[];
  readonly before: M13SideExpectation;
  readonly after: M13SideExpectation;
}

/** A `d` target list as a set (SPEC 10.7 fixes no order for them). */
function m13TargetSet(targets: readonly string[]): readonly string[] {
  return [...new Set(targets)].sort();
}

/** Assert one side of a decoded metadata pair exactly (SPEC 10.7, 12.7). */
function m13AssertSide(
  side: MetadataSide,
  expected: M13SideExpectation,
  label: "before" | "after",
  scope: string,
  where: string,
): void {
  const state =
    label === "before" ? "the item's baseline state" : "the current graph";
  const what = `the ${label} side of ${scope}'s metadata pair`;
  if (!expected.present) {
    if (side.present) {
      fail(
        `${where}: ${what} is the absent side — ${state} lacks the node, so ` +
          `the side is presented absent, carrying no metadata (SPEC 10.7); ` +
          `got ${JSON.stringify(side)}`,
      );
    }
    return;
  }
  if (!side.present) {
    fail(
      `${where}: ${what} must be present, carrying the node's metadata in ` +
        `${state}, which contains the node (SPEC 10.7); got the absent side`,
    );
  }
  assertSameJson(
    m13TargetSet(side.d),
    m13TargetSet(expected.d),
    `${where}: ${what} — the node's \`d\` targets in ${state}, each under ` +
      `its current identity, compared as a set (SPEC 10.7, 10.4: 10.7 fixes ` +
      `no order for them)`,
  );
  assertSameJson(
    side.coverage,
    expected.coverage,
    `${where}: ${what} — the node's coverage attribute in ${state}, in ` +
      `12.7's value form: "required" for a section spelling no \`coverage\` ` +
      `attribute, "none" for one spelling coverage="none" (SPEC 2.5, 10.7, ` +
      `12.7)`,
  );
  assertSameJson(
    side.tags,
    expected.tags,
    `${where}: ${what} — the node's tags in ${state}, a 12.7 tag set in ` +
      `byte order whatever the spelled order (SPEC 2.6, 10.7, 12.7)`,
  );
}

/**
 * Assert a decoded item is the expected `metadata-consistency` item and
 * presents the expected context (where stated) and metadata pair, read
 * through `surface` (SPEC 10.7: one payload rule for `next --json`, `show`,
 * and `export`).
 */
function m13AssertItem(
  item: ReviewItem,
  expected: M13Expectation,
  surface: string,
  context: string,
): void {
  const where = `${context} ${expected.label} [${surface}]`;
  if (
    item.kind !== "metadata-consistency" ||
    item.scope.node !== expected.scope
  ) {
    fail(
      `${where}: expected ${expected.scope}'s metadata-consistency item ` +
        `(SPEC 10.5: one per metadata-changed node); got the ${item.kind} ` +
        `item ${item.id} scoped at ${item.scope.node}`,
    );
  }
  if (expected.context !== undefined) {
    assertSameJson(
      item.context.map((state) => state.node).sort(),
      [...expected.context].sort(),
      `${where}: the item's context — the added and removed \`d\` targets, ` +
        `each presented under its current identity (SPEC 10.5, 10.7, 10.4)`,
    );
  }
  const pair = item.metadata;
  if (pair === undefined) {
    // Unreachable through the adapter, which requires the pair on this kind.
    fail(
      `${where}: a metadata-consistency item's payload carries its scope ` +
        `node's metadata pair (SPEC 10.7)`,
    );
  }
  m13AssertSide(pair.before, expected.before, "before", expected.scope, where);
  m13AssertSide(pair.after, expected.after, "after", expected.scope, where);
}

/** `review export s --json`, decoded (SPEC 10.7). */
async function m13Export(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<ExportReport> {
  const label = `${context} \`review export ${M13_SESSION} --json\``;
  return decodeExportReport(
    await runJson(
      product,
      workspace,
      ["review", "export", M13_SESSION, "--json"],
      label,
    ),
    label,
  );
}

/** `review next s --json`, decoded (SPEC 10.7). */
async function m13Next(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<NextReport> {
  const label = `${context} \`review next ${M13_SESSION} --json\``;
  return decodeNextReport(
    await runJson(
      product,
      workspace,
      ["review", "next", M13_SESSION, "--json"],
      label,
    ),
    label,
  );
}

/**
 * Assert every expected item through `export` and `show`, then through a
 * `next --json` walk, after asserting from `export` that the session holds
 * exactly the expected items (the staging premise). The walk asserts
 * whichever expected item `next` returns and, while another remains,
 * resolves it `no-change` — which never re-derives (SPEC 10.5) — so no item
 * order is assumed; the last item returned stays as it was.
 */
async function m13AssertSurfaces(
  product: ProductBinding,
  workspace: TestWorkspace,
  expectations: readonly M13Expectation[],
  premise: string,
  context: string,
): Promise<void> {
  const exported = await m13Export(product, workspace, context);
  assertSameJson(
    exported.items.map((item) => `${item.kind} ${item.scope.node}`).sort(),
    expectations
      .map((expected) => `metadata-consistency ${expected.scope}`)
      .sort(),
    `${context} staging premise: the session's items — ${premise}`,
  );
  const ids = new Map<string, M13Expectation>();
  for (const expected of expectations) {
    const item = exported.items.find(
      (candidate) => candidate.scope.node === expected.scope,
    );
    if (item === undefined) {
      // Unreachable past the premise, which found every expected item.
      fail(`${context}: no item scoped at ${expected.scope} in \`export\``);
    }
    m13AssertItem(item, expected, "`review export --json`", context);
    const showLabel = `${context} \`review show ${M13_SESSION} ${item.id} --json\``;
    m13AssertItem(
      decodeItemReport(
        await runJson(
          product,
          workspace,
          ["review", "show", M13_SESSION, item.id, "--json"],
          showLabel,
        ),
        showLabel,
      ),
      expected,
      "`review show --json`",
      context,
    );
    ids.set(item.id, expected);
  }
  for (let step = 1; ids.size > 0; step += 1) {
    const label = `${context} (\`next\` read ${String(step)})`;
    const next = await m13Next(product, workspace, label);
    if (next.fullyResolved || next.item === undefined) {
      fail(
        `${label}: the session still holds needing-review unblocked items ` +
          `${JSON.stringify([...ids.keys()])} — metadata-consistency items, ` +
          `unresolved and blocked by nothing — so \`next\` returns one ` +
          `(SPEC 10.3, 10.5, 10.7); got the fully-resolved report`,
      );
    }
    const expected = ids.get(next.item.id);
    if (expected === undefined) {
      fail(
        `${label}: \`next\` returned item ${next.item.id}, not one of the ` +
          `items still needing review ${JSON.stringify([...ids.keys()])} ` +
          `(SPEC 10.7)`,
      );
    }
    m13AssertItem(next.item, expected, "`review next --json`", context);
    ids.delete(next.item.id);
    if (ids.size > 0) {
      await expectExit(
        product,
        workspace,
        [
          "review",
          "resolve",
          M13_SESSION,
          next.item.id,
          "--status",
          "no-change",
        ],
        0,
        `${label} \`review resolve ${M13_SESSION} ${next.item.id} --status ` +
          `no-change\` — unblocked, so resolved (SPEC 10.7)`,
      );
    }
  }
}

/**
 * Stage a git workspace holding `xspec.config.ts` and one spec source,
 * commit it as the baseline, apply the arm's one edit, `build`, and create
 * the path-blocks session `s` against the baseline commit (SPEC 10.7); run
 * `body`, then dispose (H-1).
 */
async function withM13Session(
  product: ProductBinding,
  file: string,
  baseline: InitialFileContents,
  edit: (workspace: TestWorkspace) => Promise<void>,
  context: string,
  body: (workspace: TestWorkspace) => Promise<void>,
): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": M13_CONFIG, [file]: baseline },
  });
  try {
    await workspace.gitInit();
    const base = await workspace.gitCommitAll("baseline");
    await edit(workspace);
    await buildOk(product, workspace, `${context} \`build\` after the edit`);
    await expectExit(
      product,
      workspace,
      ["review", "create", "--base", base, "--name", M13_SESSION],
      0,
      `${context} \`review create --base <baseline> --name ${M13_SESSION}\``,
    );
    await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/** m's expected before side — its metadata at the baseline — in (a) and (d). */
const M13_M_BEFORE: M13SideExpectation = {
  present: true,
  d: [M13_M_T1, M13_M_T2],
  coverage: "required",
  tags: ["a", "b"],
};

const T10_7_13 = defineProductTest({
  id: "T10.7-13",
  title:
    'metadata pair: a `metadata-consistency` item\'s payload — `next --json`, and identically `show` and `export` — carries its scope node\'s metadata pair, a before/after pair under the origin-text rule: before, the node\'s `d` targets, coverage attribute, and tags in the item\'s baseline state; after, in the current graph; each `d` target under its current identity; a side whose graph state lacks the node presented absent, carrying no metadata; the coverage attribute `"required"` or `"none"` and the tags a tag set in byte order (12.7\'s value forms), the `d` targets compared as a set — (a) m\'s `d` t1 and t2 → t2 and t3, no `coverage` → `coverage="none"`, `tags="b a"` → `tags="c b"`: context exactly {t1, t3}, before `d` {t1, t2}, `"required"`, `["a", "b"]`, after `d` {t2, t3}, `"none"`, `["b", "c"]`; (b) a tags-only edit on g and a coverage-only edit on h: each context empty, g\'s sides differing in tags alone, h\'s in coverage alone; (c) k\'s reference to t4 removed before `create`, t4 then renamed t9 by a journaled `rename`: k\'s context and its before-side `d` targets present t9, never t4; (d) after (a)\'s assertions m\'s section deleted by manual edit: its before side as in (a), its after side absent (SPEC 2.5, 2.6, 5.5, 10.4, 10.5, 10.7, 12.7)',
  run: async (product) => {
    // --- (a) and (d): specs/M.mdx --------------------------------------
    await withM13Session(
      product,
      M13_M_FILE,
      m13MSpec("baseline"),
      async (workspace) => {
        // Staged before the body's first invocation (git staging invokes
        // no product), so a plain string the workspace builder judges.
        await workspace.file(M13_M_FILE, m13MSpec("edited"));
      },
      "T10.7-13 (a)",
      async (workspace) => {
        await m13AssertSurfaces(
          product,
          workspace,
          [
            {
              label: "m",
              scope: M13_M,
              context: [M13_M_T1, M13_M_T3],
              before: M13_M_BEFORE,
              after: {
                present: true,
                d: [M13_M_T2, M13_M_T3],
                coverage: "none",
                tags: ["b", "c"],
              },
            },
          ],
          "m's metadata-consistency item alone: the one edit makes m " +
            "metadata-changed and changes no node's own content, and no " +
            "dependency edge reaches a target whose effectiveHash changed " +
            "(SPEC 5.5, 5.6, 10.5)",
          "T10.7-13 (a)",
        );

        // (d): m's section deleted by manual edit, nothing referencing it.
        await workspace.file(M13_M_FILE, M13_M_DELETED);
        await buildOk(
          product,
          workspace,
          "T10.7-13 (d) `build` after m's deletion",
        );
        await m13AssertSurfaces(
          product,
          workspace,
          [
            {
              label: "m, deleted",
              scope: M13_M,
              before: M13_M_BEFORE,
              after: { present: false },
            },
          ],
          "still m's metadata-consistency item alone: the session changes " +
            "only through mutating subcommands, re-derived at an `updated` " +
            "resolve or a `split` alone (SPEC 10.4, 10.5)",
          "T10.7-13 (d)",
        );
      },
    );

    // --- (b): specs/GH.mdx ---------------------------------------------
    await withM13Session(
      product,
      M13_GH_FILE,
      M13_GH_BASELINE,
      async (workspace) => {
        await workspace.file(M13_GH_FILE, M13_GH_EDITED);
      },
      "T10.7-13 (b)",
      async (workspace) => {
        await m13AssertSurfaces(
          product,
          workspace,
          [
            {
              label: "g",
              scope: M13_G,
              context: [],
              before: {
                present: true,
                d: [M13_GH_T1],
                coverage: "required",
                tags: ["x"],
              },
              after: {
                present: true,
                d: [M13_GH_T1],
                coverage: "required",
                tags: ["y"],
              },
            },
            {
              label: "h",
              scope: M13_H,
              context: [],
              before: {
                present: true,
                d: [],
                coverage: "required",
                tags: [],
              },
              after: {
                present: true,
                d: [],
                coverage: "none",
                tags: [],
              },
            },
          ],
          "g's and h's metadata-consistency items alone: a tags-only and a " +
            "coverage-only edit make each metadata-changed and propagate no " +
            "category (SPEC 5.5, 5.6, 10.5)",
          "T10.7-13 (b)",
        );
      },
    );

    // --- (c): specs/K.mdx ----------------------------------------------
    await withM13Session(
      product,
      M13_K_FILE,
      M13_K_BASELINE,
      async (workspace) => {
        await workspace.file(M13_K_FILE, M13_K_EDITED);
      },
      "T10.7-13 (c)",
      async (workspace) => {
        await expectExit(
          product,
          workspace,
          ["rename", M13_K_FILE, "t4", "t9"],
          0,
          "T10.7-13 (c) `rename specs/K.mdx t4 t9` after `create` — a " +
            "journaled rename, regenerating derived files as `build` does " +
            "(SPEC 6.1, 6.4)",
        );
        await m13AssertSurfaces(
          product,
          workspace,
          [
            {
              label: "k",
              scope: M13_K,
              context: [M13_K_T9],
              before: {
                present: true,
                d: [M13_K_T9],
                coverage: "required",
                tags: [],
              },
              after: {
                present: true,
                d: [],
                coverage: "required",
                tags: [],
              },
            },
          ],
          "k's metadata-consistency item alone: the removed reference makes " +
            "k metadata-changed, and the journaled rename changes no hash and " +
            "re-derives nothing (SPEC 5.6, 6.2, 10.5)",
          "T10.7-13 (c)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.7-14 — refusal finding form
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const R14_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

const R14_FILE = "specs/A.mdx";
const R14_ROOT = "specs/A.mdx";
const R14_P = "specs/A.mdx#p";
const R14_PA = "specs/A.mdx#p.a";
const R14_T = "specs/A.mdx#t";
const R14_TU = "specs/A.mdx#t.u";

/** The session every refusal names, and its file (SPEC 10.1). */
const R14_SESSION = "s";
const R14_SESSION_REL = `.xspec/reviews/${R14_SESSION}.json`;

/**
 * `specs/A.mdx`: top-level `p` holding the leaf `p.a`, and top-level `t`
 * holding the leaf `t.u`; `edited` gives p.a its v2 text and deletes t.u.
 */
function r14Spec(edited: boolean): string {
  return [
    '<S id="p">',
    "Parent text.",
    "",
    '<S id="p.a">',
    edited ? "Kid text v2." : "Kid text.",
    "</S>",
    "</S>",
    "",
    '<S id="t">',
    "Holder text.",
    ...(edited ? [] : ["", '<S id="t.u">', "Lost text.", "</S>"]),
    "</S>",
    "",
  ].join("\n");
}

// The body's one edit, staged after its first invocation: a staged-source
// record (helpers/staged-mdx.ts; S-9's before-any-product clause).
const R14_EDITED = stagedMdx(
  "T10.7-14 specs/A.mdx with p.a's text at v2 and t.u deleted",
  r14Spec(true),
);

/** `review status s --json`, decoded (SPEC 10.7). */
async function r14Status(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<SessionStatusReport> {
  const label = `${context} \`review status ${R14_SESSION} --json\``;
  return decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", R14_SESSION, "--json"],
      label,
    ),
    label,
  );
}

/**
 * The unique status row for a kind and scope node, diagnosed loudly when
 * missing or duplicated (SPEC 10.1, 10.5: at most one item per kind and
 * scope node).
 */
function r14Row(
  report: SessionStatusReport,
  kind: ItemKind,
  scope: string,
  context: string,
): SessionStatusRow {
  const rows = report.items.filter(
    (row) => row.kind === kind && row.scope === scope,
  );
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.1, 10.5: a session never contains two items with the same ` +
        `kind and scope node); found ${String(rows.length)} among ` +
        JSON.stringify(report.items.map((row) => `${row.kind} ${row.scope}`)),
    );
  }
  return rows[0]!;
}

/** A staging premise on one row's status and blocked state (diagnosed). */
function r14ExpectRowState(
  row: SessionStatusRow,
  expected: { readonly status: string; readonly blocked: boolean },
  why: string,
  context: string,
): void {
  assertSameJson(
    { status: row.status, blocked: row.blocked },
    expected,
    `${context} staging premise: the ${row.kind} item scoped at ` +
      `${row.scope} — ${why}`,
  );
}

const T10_7_14 = defineProductTest({
  id: "T10.7-14",
  title:
    'refusal finding form: each review-operation refusal — `create` naming an existing session exactly, and matching it ignoring ASCII case alone; `resolve` of a blocked item, its blocker unresolved and, re-blocked, `invalidated`; `split` of an item of another kind, and of a `subtree-coherence` item whose scope root has no children, a leaf\'s and one whose only child was deleted by manual edit after `create` — run with `--json` exits 1 with standard output exactly `{"findings": [f]}`, `f` exactly `{"code", "message", "locations", "path", "identities"}` with `code` `null`, `locations` `[]`, `path` `null`, and `identities` an array of strings, its content not asserted; the session file stays byte-identical (SPEC 10.1, 10.3, 10.4, 10.6, 10.7, 12.7, 14)',
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: { "xspec.config.ts": R14_CONFIG, [R14_FILE]: r14Spec(false) },
    });
    try {
      const prefix = "T10.7-14";
      await buildOk(product, workspace, `${prefix} \`build\``);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", R14_SESSION],
        0,
        `${prefix} \`review create --strategy audit --name ${R14_SESSION}\``,
      );
      const initial = await r14Status(product, workspace, prefix);
      const pRow = r14Row(initial, "subtree-coherence", R14_P, prefix);
      const paRow = r14Row(initial, "subtree-coherence", R14_PA, prefix);
      const tRow = r14Row(initial, "subtree-coherence", R14_T, prefix);
      r14Row(initial, "subtree-coherence", R14_ROOT, prefix);
      r14Row(initial, "subtree-coherence", R14_TU, prefix);
      r14ExpectRowState(
        pRow,
        { status: "unresolved", blocked: true },
        "blocked by its child section's unresolved item, p.a's (SPEC 10.3, " +
          "10.6)",
        prefix,
      );
      r14ExpectRowState(
        paRow,
        { status: "unresolved", blocked: false },
        "a leaf's item, blocked by nothing (SPEC 10.6)",
        prefix,
      );

      // `create` naming the existing session — exactly, then matching it
      // ignoring ASCII case alone (SPEC 10.1, 10.7).
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", R14_SESSION],
        R14_SESSION_REL,
        `${prefix} [create naming the existing session s exactly]`,
      );
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "S"],
        R14_SESSION_REL,
        `${prefix} [create naming S, matching the existing session s ` +
          `ignoring ASCII case alone]`,
      );

      // `resolve` of a blocked item: p's, its blocker p.a's item unresolved.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, pRow.id, "--status", "no-change"],
        R14_SESSION_REL,
        `${prefix} [resolve of p's item, blocked by p.a's unresolved item]`,
      );

      // `split` of a subtree-coherence item whose scope root has no
      // children: p.a's, a leaf's.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, paRow.id],
        R14_SESSION_REL,
        `${prefix} [split of p.a's item, a leaf's: its scope root has no ` +
          `children]`,
      );

      // Splitting p's item yields p's parent-consistency item, blocked by
      // the per-child item — p.a's, reused (SPEC 10.7).
      await expectExit(
        product,
        workspace,
        ["review", "split", R14_SESSION, pRow.id],
        0,
        `${prefix} \`review split ${R14_SESSION} <p's item>\` — p has a ` +
          `child, so the split is performed (SPEC 10.7)`,
      );
      const afterSplit = await r14Status(
        product,
        workspace,
        `${prefix} after p's split`,
      );
      const pcRow = r14Row(
        afterSplit,
        "parent-consistency",
        R14_P,
        `${prefix} after p's split`,
      );
      r14ExpectRowState(
        pcRow,
        { status: "unresolved", blocked: true },
        "the decomposition's parent-consistency item, entering unresolved " +
          "and blocked by the per-child item, p.a's (SPEC 10.2, 10.7)",
        `${prefix} after p's split`,
      );

      // `split` of an item of another kind: p's parent-consistency item.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, pcRow.id],
        R14_SESSION_REL,
        `${prefix} [split of p's parent-consistency item: an item of ` +
          `another kind]`,
      );

      // Re-blocking (SPEC 10.3, 10.4): p.a's item resolved, then
      // invalidated by its text's edit, re-blocks p's parent-consistency
      // item. The same edit deletes t's only child t.u.
      await expectExit(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, paRow.id, "--status", "no-change"],
        0,
        `${prefix} \`review resolve ${R14_SESSION} <p.a's item> --status ` +
          `no-change\` — unblocked, so resolved (SPEC 10.7)`,
      );
      await workspace.file(R14_FILE, R14_EDITED);
      await buildOk(
        product,
        workspace,
        `${prefix} \`build\` after p.a's edit and t.u's deletion`,
      );
      const afterEdit = await r14Status(
        product,
        workspace,
        `${prefix} after the edit`,
      );
      r14ExpectRowState(
        r14Row(
          afterEdit,
          "subtree-coherence",
          R14_PA,
          `${prefix} after the edit`,
        ),
        { status: "invalidated", blocked: false },
        "resolved, then its scope's subtreeHash changed by the edit " +
          "(SPEC 10.4)",
        `${prefix} after the edit`,
      );
      r14ExpectRowState(
        r14Row(
          afterEdit,
          "parent-consistency",
          R14_P,
          `${prefix} after the edit`,
        ),
        { status: "unresolved", blocked: true },
        "re-blocked by p.a's item, which is invalidated, no resolved status " +
          "(SPEC 10.3)",
        `${prefix} after the edit`,
      );

      // `resolve` of a blocked item: p's parent-consistency item, its
      // blocker resolved and then invalidated.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, pcRow.id, "--status", "no-change"],
        R14_SESSION_REL,
        `${prefix} [resolve of p's parent-consistency item, re-blocked by ` +
          `p.a's invalidated item]`,
      );

      // `split` of a subtree-coherence item whose scope root has no
      // children now: t's, its only child t.u deleted by manual edit after
      // `create`, though its scope as last assigned still lists t.u.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, tRow.id],
        R14_SESSION_REL,
        `${prefix} [split of t's item, its only child t.u deleted after ` +
          `create: its scope root has no children]`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T10.7-15 — outcome order past the gate
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group. A
// staged-source record (S-9): fixture (B)'s workspace is created after the
// body's first invocation, as are the twins of (A) that arms (c) and (f)(ii)
// stage.
const O15_CONFIG = stagedTs(
  "T10.7-15 xspec.config.ts — one spec group (fixtures (A) and (B))",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// Fixture (A): specs/A.mdx — top-level P holding P.c, Q holding Q.r, and
// the leaves s and u.
const O15_A_FILE = "specs/A.mdx";
const O15_P = "specs/A.mdx#P";
const O15_PC = "specs/A.mdx#P.c";
const O15_Q = "specs/A.mdx#Q";
const O15_QR = "specs/A.mdx#Q.r";
const O15_S = "specs/A.mdx#s";
const O15_ST = "specs/A.mdx#s.t";

/** Fixture (A)'s audit session, and the second session, made corrupt. */
const O15_A_SESSION = "a";
const O15_A_SESSION_REL = `.xspec/reviews/${O15_A_SESSION}.json`;
const O15_X_SESSION = "x";
const O15_X_SESSION_REL = `.xspec/reviews/${O15_X_SESSION}.json`;

/**
 * The section with no id of (d)'s, (f)(i)'s, and (g)'s failing sources (SPEC
 * 1.3, 14.1): childless, so condition 2's masking never enters — each
 * failing workspace's one `build` finding.
 */
const O15_IDLESS_SECTION = ["<S>", "No id text.", "</S>"].join("\n");

/**
 * specs/A.mdx. `uEdited` gives u its edited text (fixture (A)'s staleness
 * edit); the hand edits of (c)'s twins: `pcEdited` gives P.c its edited
 * text ((c)(i)), `qrDeleted` deletes Q.r's section, leaving Q childless
 * ((c)(ii)), and `stAuthored` authors the child s.t under the leaf s
 * ((c)(iii)); `idless` appends a section with no id after u ((f)(i)'s and
 * (g)'s failing source).
 */
function o15ASpec(
  edits: {
    readonly uEdited?: boolean;
    readonly pcEdited?: boolean;
    readonly qrDeleted?: boolean;
    readonly stAuthored?: boolean;
    readonly idless?: boolean;
  } = {},
): string {
  return [
    '<S id="P">',
    "Pee own text.",
    "",
    '<S id="P.c">',
    edits.pcEdited === true ? "Pee cee text, edited." : "Pee cee text.",
    "</S>",
    "</S>",
    "",
    '<S id="Q">',
    "Queue own text.",
    ...(edits.qrDeleted === true
      ? []
      : ["", '<S id="Q.r">', "Queue are text.", "</S>"]),
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    ...(edits.stAuthored === true
      ? ["", '<S id="s.t">', "Ess tee text.", "</S>"]
      : []),
    "</S>",
    "",
    '<S id="u">',
    edits.uEdited === true ? "You text, edited." : "You text.",
    "</S>",
    "",
    ...(edits.idless === true ? [O15_IDLESS_SECTION, ""] : []),
  ].join("\n");
}

/**
 * The section with no id's byte window in (f)(i)'s and (g)'s failing source
 * (support.ts `byteWindow`): it follows (A)'s source as staleness-edited and
 * one blank line.
 */
const O15_A_IDLESS_WINDOW = byteWindow(
  `${o15ASpec({ uEdited: true })}\n`,
  O15_IDLESS_SECTION,
);

// Staged-source records (helpers/staged-mdx.ts, S-9): (A)'s initial source
// serves its first workspace and the twins that arms (c) and (f)(ii) create
// after an invocation; the staleness edit — (f)(ii)'s too — (c)'s hand
// edits, and (f)(i)'s and (g)'s failing source follow the body's first
// invocation.
const O15_A_INITIAL = stagedMdx(
  "T10.7-15 specs/A.mdx — fixture (A): top-level P holding P.c, Q holding Q.r, and the leaves s and u",
  o15ASpec(),
);
const O15_A_U_EDITED = stagedMdx(
  "T10.7-15 specs/A.mdx with u's text edited — fixture (A)'s staleness edit",
  o15ASpec({ uEdited: true }),
);
const O15_A_PC_EDITED = stagedMdx(
  "T10.7-15 specs/A.mdx with P.c's text edited — (c)(i)'s hand edit, after P.c's item is resolved no-change",
  o15ASpec({ pcEdited: true }),
);
const O15_A_QR_DELETED = stagedMdx(
  "T10.7-15 specs/A.mdx with Q.r's section deleted, Q left childless — (c)(ii)'s hand edit",
  o15ASpec({ qrDeleted: true }),
);
const O15_A_ST_AUTHORED = stagedMdx(
  "T10.7-15 specs/A.mdx with a child s.t authored under the leaf s — (c)(iii)'s hand edit",
  o15ASpec({ stAuthored: true }),
);
const O15_A_GATE_FAILING = stagedMdx(
  "T10.7-15 specs/A.mdx with u's text edited and a section with no id after u — (f)(i)'s and (g)'s source failing build's validations (14.1)",
  o15ASpec({ uEdited: true, idless: true }),
);

// Fixture (B): specs/B.mdx — top-level G holding G.N, and the leaf v.
const O15_B_FILE = "specs/B.mdx";
const O15_G = "specs/B.mdx#G";
const O15_GN = "specs/B.mdx#G.N";

/** Fixture (B)'s baseline session, and its file. */
const O15_B_SESSION = "b";
const O15_B_SESSION_REL = `.xspec/reviews/${O15_B_SESSION}.json`;

/**
 * specs/B.mdx; G.N's text edited after `c1`, then v's (the staleness edit);
 * `idless` appends a section with no id after v ((d)'s failing source).
 */
function o15BSpec(
  edits: {
    readonly gnEdited?: boolean;
    readonly vEdited?: boolean;
    readonly idless?: boolean;
  } = {},
): string {
  return [
    '<S id="G">',
    "Gee own text.",
    "",
    '<S id="G.N">',
    edits.gnEdited === true ? "Gee en text, edited." : "Gee en text.",
    "</S>",
    "</S>",
    "",
    '<S id="v">',
    edits.vEdited === true ? "Vee text, edited." : "Vee text.",
    "</S>",
    "",
    ...(edits.idless === true ? [O15_IDLESS_SECTION, ""] : []),
  ].join("\n");
}

/**
 * The section with no id's byte window in (d)'s failing source (support.ts
 * `byteWindow`): it follows the source as `create` saw it and one blank
 * line.
 */
const O15_B_IDLESS_WINDOW = byteWindow(
  `${o15BSpec({ gnEdited: true })}\n`,
  O15_IDLESS_SECTION,
);

// Fixture (B)'s workspace is created after the body's first invocation, so
// its initial source, both its edits, and (d)'s failing source are
// staged-source records (S-9).
const O15_B_INITIAL = stagedMdx(
  "T10.7-15 specs/B.mdx — fixture (B) at c1: top-level G holding G.N, and the leaf v",
  o15BSpec(),
);
const O15_B_GN_EDITED = stagedMdx(
  "T10.7-15 specs/B.mdx with G.N's text edited after c1 — fixture (B)'s session edit",
  o15BSpec({ gnEdited: true }),
);
const O15_B_V_EDITED = stagedMdx(
  "T10.7-15 specs/B.mdx with G.N's and v's text edited — fixture (B)'s staleness edit",
  o15BSpec({ gnEdited: true, vEdited: true }),
);
const O15_B_GATE_FAILING = stagedMdx(
  "T10.7-15 specs/B.mdx with G.N's text edited and a section with no id after v — (d)'s source failing build's validations (14.1)",
  o15BSpec({ gnEdited: true, idless: true }),
);

/**
 * T10.1-4's garbage-bytes state — unparseable as JSON, shape-independent —
 * written directly over `x`'s product-written session file.
 */
const O15_GARBAGE = "this is deliberately not a JSON document ][}{\n";

/**
 * The item ID no session holds (harness-prefixed, so no product-chosen id
 * collides with it; a premise against `a`'s ids besides).
 */
const O15_UNKNOWN_ITEM = "xspec-harness-no-such-item";

/** The hold file of (b)'s held runs, beside each copy's root. */
const O15_HOLD_NAME = "hold-t10-7-15.tmp";

/** (f)(i)'s name matching `a` ignoring ASCII case alone (SPEC 10.1). */
const O15_A_SESSION_FOLDED = "A";

/** The new session (f)(i) asks `create` for: no session bears the name. */
const O15_NEW_SESSION = "n";

/** (f)(i)'s plain file at the session directory's path — no source. */
const O15_REVIEWS_OCCUPANT =
  "T10.7-15 (f)(i): a plain file occupying the session directory's path\n";

/**
 * (f)(ii)'s unknown profile — the configuration names none — and its
 * unresolvable ref — no branch, tag, or commit bears the name — each as
 * TEST-SPEC spells it.
 */
const O15_UNKNOWN_PROFILE = "nope";
const O15_UNRESOLVABLE_REF = "nope";

/**
 * T6.1-3's garbage line (T6.3-6(a)'s staging): structureless bytes no
 * conforming journal entry format accepts, shape-independent (H-4).
 */
const O15_JOURNAL_GARBAGE =
  "?? harness-injected garbage: not a journal entry ??";

/** 14.13's and 14.25's stable codes (SPEC 14, 12.7). */
const O15_JOURNAL_ERROR_CODE = "journal-error";
const O15_READ_FAILURE_CODE = "read-failure";

/** The item IDs the invocations name, read from `review status --json`. */
interface O15Ids {
  /** (A): P's subtree-coherence item, blocked by P.c's unresolved item. */
  readonly p: string;
  /** (A): Q's parent-consistency item, the split's. */
  readonly qPc: string;
  /** (A): s's subtree-coherence item, a leaf's. */
  readonly s: string;
  /** (A): an id `x` held before it was made corrupt (`<any-id>`). */
  readonly xHeld: string;
  /** (B): G.N's subtree-coherence item. */
  readonly gnSc: string;
  /** (B): G's parent-consistency item, blocked by G.N's. */
  readonly gPc: string;
}

/**
 * A staged state (TEST-SPEC T10.7-15): staged once and never invoked on
 * again — each invocation runs on its own byte copy of it.
 */
interface O15Staged {
  /** `(A)`, `(B)`, or `(B) as created`, for diagnoses. */
  readonly label: string;
  readonly workspace: TestWorkspace;
  /** The state's bytes as staged; each copy is checked against them. */
  readonly snapshot: DirectorySnapshot;
}

/** One fixture's stale state: its graph data stale (SPEC 13.3). */
interface O15State extends O15Staged {
  /** The source whose text the staleness edit changed. */
  readonly editedSource: string;
  /** `check`'s findings beside the staleness, counted by identity. */
  readonly besideStaleness: Readonly<Record<string, number>>;
}

/** `review status <name> --json`, decoded (SPEC 10.7). */
async function o15Status(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<SessionStatusReport> {
  const label = `${context} \`review status ${name} --json\``;
  return decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", name, "--json"],
      label,
    ),
    label,
  );
}

/**
 * Fixture (A)'s stale state: specs/A.mdx built; the audit session `a`
 * created and Q's subtree-coherence item split, giving `a` Q's
 * parent-consistency item (SPEC 10.7; T10.7-9); the audit session `x`
 * created and made corrupt by T10.1-4's garbage bytes over its file; then
 * u's text edited, no rebuild and no read since graph data was last
 * written, so graph data is stale (13.3). Every premise the invocations
 * rely on is read from `status` before the edit, diagnosed (H-8).
 */
async function o15StageFixtureA(product: ProductBinding): Promise<{
  readonly state: O15State;
  readonly ids: Omit<O15Ids, "gnSc" | "gPc">;
}> {
  const context = "T10.7-15 fixture (A)";
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": O15_CONFIG, [O15_A_FILE]: O15_A_INITIAL },
  });
  try {
    await buildOk(product, workspace, `${context} \`build\``);
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", O15_A_SESSION],
      0,
      `${context} \`review create --strategy audit --name ${O15_A_SESSION}\``,
    );
    const created = await o15Status(product, workspace, O15_A_SESSION, context);
    const qRow = r14Row(created, "subtree-coherence", O15_Q, context);
    await expectExit(
      product,
      workspace,
      ["review", "split", O15_A_SESSION, qRow.id],
      0,
      `${context} \`review split ${O15_A_SESSION} <Q's item>\` — Q has a ` +
        `child, so the split is performed (SPEC 10.7)`,
    );
    const splitContext = `${context} after Q's split`;
    const split = await o15Status(
      product,
      workspace,
      O15_A_SESSION,
      splitContext,
    );
    const pRow = r14Row(split, "subtree-coherence", O15_P, splitContext);
    r14ExpectRowState(
      pRow,
      { status: "unresolved", blocked: true },
      "blocked by its child section's unresolved item, P.c's (SPEC 10.3, " +
        "10.6)",
      splitContext,
    );
    r14ExpectRowState(
      r14Row(split, "subtree-coherence", O15_PC, splitContext),
      { status: "unresolved", blocked: false },
      "a leaf's item, blocked by nothing (SPEC 10.6)",
      splitContext,
    );
    const qPcRow = r14Row(split, "parent-consistency", O15_Q, splitContext);
    const sRow = r14Row(split, "subtree-coherence", O15_S, splitContext);
    if (split.items.some((row) => row.id === O15_UNKNOWN_ITEM)) {
      fail(
        `${splitContext} staging premise: no item of session ` +
          `${O15_A_SESSION} has the id ${O15_UNKNOWN_ITEM}, which the ` +
          `unknown-item invocations name`,
      );
    }

    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", O15_X_SESSION],
      0,
      `${context} \`review create --strategy audit --name ${O15_X_SESSION}\``,
    );
    const xStatus = await o15Status(product, workspace, O15_X_SESSION, context);
    const xRow = xStatus.items[0];
    if (xRow === undefined) {
      fail(
        `${context} staging premise: the audit session ${O15_X_SESSION} ` +
          `holds an item per requirement node (SPEC 10.6); got none`,
      );
    }
    if ((await workspace.kind(O15_X_SESSION_REL)) !== "file") {
      fail(
        `${context} staging premise: the product wrote session ` +
          `${O15_X_SESSION} as the plain file ${O15_X_SESSION_REL} (SPEC ` +
          `10.1)`,
      );
    }
    await workspace.file(O15_X_SESSION_REL, O15_GARBAGE);

    // Stale graph data: u's text edited, no rebuild and no read since.
    await workspace.file(O15_A_FILE, O15_A_U_EDITED);
    return {
      state: {
        label: "(A)",
        workspace,
        snapshot: await snapshotDirectory(workspace.root),
        editedSource: O15_A_FILE,
        besideStaleness: { "14.21": 1 },
      },
      ids: { p: pRow.id, qPc: qPcRow.id, s: sRow.id, xHeld: xRow.id },
    };
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/**
 * Fixture (B)'s stale state: a git workspace whose specs/B.mdx is committed
 * as `c1`, G.N's text then edited, built, and the baseline session `b`
 * created against `c1` — exactly G.N's subtree-coherence item and G's
 * parent-consistency item, blocked by it (SPEC 10.5; premises from
 * `status`) — then the recorded baseline made irreconstructible by
 * T10.7-3's staging, the repository removed (the configuration file then
 * inside no working tree, 6.3), and v's text edited, no rebuild and no read
 * since, so graph data is stale (13.3). The state before v's edit — no
 * section edited since `create` — is kept as a byte copy (`created`, (d)'s
 * state).
 */
async function o15StageFixtureB(product: ProductBinding): Promise<{
  readonly state: O15State;
  readonly created: O15Staged;
  readonly ids: Pick<O15Ids, "gnSc" | "gPc">;
}> {
  const context = "T10.7-15 fixture (B)";
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": O15_CONFIG, [O15_B_FILE]: O15_B_INITIAL },
  });
  try {
    await workspace.gitInit();
    const c1 = await workspace.gitCommitAll("c1");
    await workspace.file(O15_B_FILE, O15_B_GN_EDITED);
    await buildOk(product, workspace, `${context} \`build\``);
    await expectExit(
      product,
      workspace,
      ["review", "create", "--base", c1, "--name", O15_B_SESSION],
      0,
      `${context} \`review create --base c1 --name ${O15_B_SESSION}\``,
    );
    const status = await o15Status(product, workspace, O15_B_SESSION, context);
    assertSameJson(
      status.items.map((row) => `${row.kind} ${row.scope}`).sort(),
      [`parent-consistency ${O15_G}`, `subtree-coherence ${O15_GN}`],
      `${context} staging premise: the session holds exactly G.N's ` +
        `subtree-coherence item and G's parent-consistency item — G.N ` +
        `changed since c1, G its non-root ancestor (SPEC 10.5)`,
    );
    const gnRow = r14Row(status, "subtree-coherence", O15_GN, context);
    r14ExpectRowState(
      gnRow,
      { status: "unresolved", blocked: false },
      "a visited node's item, blocked by nothing (SPEC 10.5)",
      context,
    );
    const gRow = r14Row(status, "parent-consistency", O15_G, context);
    r14ExpectRowState(
      gRow,
      { status: "unresolved", blocked: true },
      "blocked by the item of its child on the changed branch, G.N's " +
        "(SPEC 10.5)",
      context,
    );

    // T10.7-3's staging: the repository removed, so `c1` — the recorded
    // baseline — can no longer be reconstructed (SPEC 6.3, 10.7).
    await fsp.rm(workspace.path(".git"), {
      recursive: true,
      force: true,
      maxRetries: 3,
    });
    const gitKind = await workspace.kind(".git");
    if (gitKind !== "absent") {
      fail(
        `${context} staging: .git must be removed (T10.7-3's staging); ` +
          `found ${gitKind}`,
      );
    }
    let baselineGone = true;
    try {
      await workspace.git(["cat-file", "-e", `${c1}^{commit}`]);
      baselineGone = false;
    } catch {
      // Expected: no repository holds the recorded commit any more.
    }
    if (!baselineGone) {
      fail(
        `${context} staging premise: the recorded baseline commit ${c1} ` +
          `must no longer resolve from the workspace root once the ` +
          `repository is removed`,
      );
    }

    // (d)'s state: (B) as `create` left it, no section edited since — a
    // byte copy, never invoked on itself.
    const createdLabel = "(B) as created";
    const createdSnapshot = await snapshotDirectory(workspace.root);
    const createdCopy = await o15CopyChecked(
      workspace,
      createdSnapshot,
      "fixture (B)'s state as created",
    );
    try {
      // Stale graph data: v's text edited, no rebuild and no read since.
      await workspace.file(O15_B_FILE, O15_B_V_EDITED);
      return {
        state: {
          label: "(B)",
          workspace,
          snapshot: await snapshotDirectory(workspace.root),
          editedSource: O15_B_FILE,
          besideStaleness: {},
        },
        created: {
          label: createdLabel,
          workspace: createdCopy,
          snapshot: createdSnapshot,
        },
        ids: { gnSc: gnRow.id, gPc: gRow.id },
      };
    } catch (error) {
      await createdCopy.dispose();
      throw error;
    }
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/**
 * A fresh byte copy of a workspace (helpers/tree-copy.ts `copyTreeBytes`:
 * every entry of its root — no state copied holds `.git` or a lock path),
 * checked against the snapshot it must equal before anything runs there (a
 * difference is a harness error, never a product verdict); disposed by the
 * caller (H-1), or here when the copy fails.
 */
async function o15CopyChecked(
  from: TestWorkspace,
  expected: DirectorySnapshot,
  label: string,
): Promise<TestWorkspace> {
  const copy = await TestWorkspace.create();
  try {
    await copyTreeBytes(Buffer.from(from.root), Buffer.from(copy.root));
    const differences = diffSnapshots(
      expected,
      await snapshotDirectory(copy.root),
    );
    if (differences.length > 0) {
      throw new Error(
        `harness error: T10.7-15's copy of ${label} ${from.root} ` +
          `at ${copy.root} differs from it: ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    return copy;
  } catch (error) {
    await copy.dispose();
    throw error;
  }
}

/**
 * Run `body` on a fresh byte copy of a staged state (`o15CopyChecked`,
 * against the state's snapshot); the copy is disposed whatever happens
 * (H-1). SPEC 13.3 judges staleness by content alone, so the copy's graph
 * data is as stale, or as fresh, as the state's.
 */
async function withO15Copy(
  state: O15Staged,
  body: (copy: TestWorkspace) => Promise<void>,
): Promise<void> {
  const copy = await o15CopyChecked(
    state.workspace,
    state.snapshot,
    `fixture ${state.label}'s state`,
  );
  try {
    await body(copy);
  } finally {
    await copy.dispose();
  }
}

/** The outcome an invocation meets, at the gate or past it (SPEC 10.7). */
type O15Outcome =
  /** A refusal in T10.7-14's form, the session file it names byte-identical. */
  | { readonly kind: "refusal"; readonly sessionRel: string }
  /** An unknown item ID: the plain usage error (12.0). */
  | { readonly kind: "unknown-item" }
  /** The named session's corruption: exactly the condition-21 finding. */
  | { readonly kind: "corrupt"; readonly sessionRel: string }
  /** The recorded baseline, irreconstructible: the plain usage error (6.3). */
  | { readonly kind: "baseline" }
  /** A workspace failing `build`'s validations: the gate's findings (13.3). */
  | { readonly kind: "gate" }
  /**
   * An error ahead of the gate — an unknown profile, an unresolvable given
   * baseline: the plain usage error (12.0, 6.3); `why` says which.
   */
  | { readonly kind: "usage"; readonly why: string }
  /**
   * A journal error met by a given baseline's resolution, ahead of the
   * gate: 14.13's stable code and concerned path (6.3, 12.0).
   */
  | { readonly kind: "journal-error" };

/** One invocation and the outcome it meets. */
interface O15Call {
  /** Why the outcome is met, for diagnoses. */
  readonly what: string;
  /** The command, without `--json` (each run appends it). */
  readonly argv: (ids: O15Ids) => readonly string[];
  readonly outcome: O15Outcome;
}

/** One of (a)'s invocations, run again under (b)'s staging. */
interface O15Invocation extends O15Call {
  /** The fixture whose stale state it runs on. */
  readonly fixture: "A" | "B";
  /** `resolve` and `split`, held at the seam of 13.5 under (b)'s staging. */
  readonly mutating: boolean;
}

/** (a)'s invocations, in TEST-SPEC's order. */
const O15_STALE_INVOCATIONS: readonly O15Invocation[] = [
  {
    what: "P's item is blocked by P.c's unresolved item: a refusal",
    fixture: "A",
    argv: (ids) => [
      "review",
      "resolve",
      O15_A_SESSION,
      ids.p,
      "--status",
      "no-change",
    ],
    mutating: true,
    outcome: { kind: "refusal", sessionRel: O15_A_SESSION_REL },
  },
  {
    what: "Q's parent-consistency item is of another kind: a refusal",
    fixture: "A",
    argv: (ids) => ["review", "split", O15_A_SESSION, ids.qPc],
    mutating: true,
    outcome: { kind: "refusal", sessionRel: O15_A_SESSION_REL },
  },
  {
    what: "s's item's scope root has no children: a refusal",
    fixture: "A",
    argv: (ids) => ["review", "split", O15_A_SESSION, ids.s],
    mutating: true,
    outcome: { kind: "refusal", sessionRel: O15_A_SESSION_REL },
  },
  {
    what: "an unknown item ID: the plain usage error",
    fixture: "A",
    argv: () => [
      "review",
      "resolve",
      O15_A_SESSION,
      O15_UNKNOWN_ITEM,
      "--status",
      "no-change",
    ],
    mutating: true,
    outcome: { kind: "unknown-item" },
  },
  {
    what: "an unknown item ID: the plain usage error",
    fixture: "A",
    argv: () => ["review", "show", O15_A_SESSION, O15_UNKNOWN_ITEM],
    mutating: false,
    outcome: { kind: "unknown-item" },
  },
  {
    what: "an unknown item ID: the plain usage error",
    fixture: "A",
    argv: () => ["review", "split", O15_A_SESSION, O15_UNKNOWN_ITEM],
    mutating: true,
    outcome: { kind: "unknown-item" },
  },
  {
    what: "x is corrupt: exactly the condition-21 finding",
    fixture: "A",
    argv: () => ["review", "status", O15_X_SESSION],
    mutating: false,
    outcome: { kind: "corrupt", sessionRel: O15_X_SESSION_REL },
  },
  {
    what: "x is corrupt: exactly the condition-21 finding",
    fixture: "A",
    argv: (ids) => [
      "review",
      "resolve",
      O15_X_SESSION,
      ids.xHeld,
      "--status",
      "updated",
    ],
    mutating: true,
    outcome: { kind: "corrupt", sessionRel: O15_X_SESSION_REL },
  },
  {
    what:
      "b's recorded baseline cannot be reconstructed: the baseline's plain " +
      "usage error",
    fixture: "B",
    argv: () => ["review", "status", O15_B_SESSION],
    mutating: false,
    outcome: { kind: "baseline" },
  },
];

/** How an invocation runs: `--json` already appended. */
type O15Run = (jsonArgv: readonly string[]) => Promise<RunResult>;

/**
 * The run reports exactly the condition-21 finding concerning the corrupt
 * session's own file: exit 1, one finding, condition 21, `path` that file
 * (a session condition carries the file it concerns, SPEC 14, 12.7, 10.1),
 * `locations` `[]` (SPEC 10.1, 10.7, 14.21).
 */
function o15ExpectCorruption(
  result: RunResult,
  sessionRel: string,
  context: string,
): void {
  const label =
    `${context} — the named session is corrupt: the session read meets ` +
    `the corruption and reports it, exit 1 (SPEC 10.1, 10.7, 14.21)`;
  assertExitCode(result, 1, label);
  o15AssertCorruptionFinding(
    decodeFindingsReport(parseJsonStdout(result, label), label).findings,
    sessionRel,
    label,
  );
}

/**
 * Exactly one finding, condition 21, concerning the corrupt session's own
 * file (SPEC 14, 12.7, 10.1: a session condition carries the file it
 * concerns), `locations` `[]` (14.21).
 */
function o15AssertCorruptionFinding(
  findings: readonly Finding[],
  sessionRel: string,
  label: string,
): void {
  assertConditionCounts(
    findings,
    { "14.21": 1 },
    `${label} — exactly the condition-21 finding`,
  );
  const finding = findings[0]!;
  assertFindingConcernsPath(finding, sessionRel, label);
  assertSameJson(
    finding.locations,
    [],
    `${label}: the condition-21 finding has no in-source location — ` +
      `locations [] (SPEC 12.7)`,
  );
}

/**
 * (e)'s listing on (A)'s stale state (SPEC 10.7: past the gate `list` lists
 * the session directory and reads every session, each corruption met there
 * part of its answer): exit 1 — a session is corrupt (14.21, 12.0) — with
 * the listing decoded form-exact (adapters' `decodeSessionListReport`): the
 * sessions exactly `a`, healthy, and `x`, corrupt, in byte order of name,
 * as names and corrupt flags; the listing's findings exactly x's one
 * condition-21 finding (`o15AssertCorruptionFinding`).
 */
function o15ExpectListing(result: RunResult, context: string): void {
  const label =
    `${context} — past the gate \`list\` reads every session, each ` +
    `corruption part of its answer, and exits 1 when a session is corrupt ` +
    `(SPEC 10.7, 14.21, 12.0)`;
  assertExitCode(result, 1, label);
  const report = decodeSessionListReport(parseJsonStdout(result, label), label);
  assertSameJson(
    report.sessions.map(({ name, corrupt }) => ({ name, corrupt })),
    [
      { name: O15_A_SESSION, corrupt: false },
      { name: O15_X_SESSION, corrupt: true },
    ],
    `${label}: x is reported corrupt by name beside a, in byte order of ` +
      `name — x's corruption ends nothing (SPEC 10.7, 10.1)`,
  );
  if (report.findings === undefined) {
    fail(
      `${label}: the listing carries x's condition 21 under its ` +
        `"findings" member (SPEC 14.21, 12.7); the decoded document ` +
        `carries no such member`,
    );
  }
  o15AssertCorruptionFinding(
    report.findings,
    O15_X_SESSION_REL,
    `${label} — the listing's findings`,
  );
}

/**
 * A refused read (SPEC 14.25): exit 2, the 12.7 error document as the
 * entire stdout (`expectErrorDocument`), its `code` `read-failure` and its
 * `path` the refused object's workspace-relative path.
 */
function o15ExpectReadFailure(
  result: RunResult,
  concerned: string,
  context: string,
): void {
  const label =
    `${context} — a read the environment refuses is a usage error: the ` +
    `command stops at that read and exits 2 (SPEC 14.25, 12.0)`;
  assertExitCode(result, 2, label);
  const error = expectErrorDocument(result, label);
  assertSameJson(
    { code: error.code, path: error.path },
    { code: O15_READ_FAILURE_CODE, path: concerned },
    `${label}: the error document carries 14.25's stable code and the ` +
      `refused object's workspace-relative path (SPEC 14.25, 14, 12.7; ` +
      `message: ${JSON.stringify(error.message)})`,
  );
}

/**
 * A given baseline's journal error (SPEC 6.3, 12.0, 14.13): exit 2, the
 * 12.7 error document as the entire stdout, its `code` `journal-error` and
 * its `path` the journal path — never the gate's exit 1, never the
 * existing-name refusal's.
 */
function o15ExpectJournalError(result: RunResult, context: string): void {
  const label =
    `${context} — a given baseline's resolution reads the current journal ` +
    `before any other cause can fail it, ahead of the gate, and a journal ` +
    `error there fails it as a usage error carrying condition 13's stable ` +
    `code and concerned path, exit 2 (SPEC 6.3, 10.7, 12.0, 14.13)`;
  assertExitCode(result, 2, label);
  const error = expectErrorDocument(result, label);
  assertSameJson(
    { code: error.code, path: error.path },
    { code: O15_JOURNAL_ERROR_CODE, path: JOURNAL_PATH },
    `${label}: the error document carries \`code\` ` +
      `${JSON.stringify(O15_JOURNAL_ERROR_CODE)} and \`path\` ` +
      `${JSON.stringify(JOURNAL_PATH)} (SPEC 6.3, 14.13, 12.7; message: ` +
      `${JSON.stringify(error.message)})`,
  );
}

/**
 * The finding members the gate's report must reproduce (SPEC 13.3: the
 * findings a `build` would now report): each finding's condition, code,
 * concerned path, and locations — its message's wording free (H-3) and its
 * informational `identities` (12.7) unasserted.
 */
function o15GateForm(findings: readonly Finding[]): unknown {
  return findings.map((finding) => ({
    condition: finding.condition,
    code: finding.code,
    path: finding.path,
    locations: finding.locations,
  }));
}

/**
 * On a workspace failing `build`'s validations, the run reports exactly the
 * gate's findings (SPEC 13.3, 10.7: the gate's report ends the subcommand,
 * nothing evaluated past it — no session read, the session directory
 * neither examined nor listed, no item ID judged, no recorded baseline
 * resolved): exit 1, the findings-only report decoded form-exact, its
 * findings those of `build --json` on the same state (`gate`,
 * `o15GateReference`) in condition, code, path, and locations
 * (`o15GateForm`).
 */
function o15ExpectGateFindings(
  result: RunResult,
  gate: readonly Finding[],
  context: string,
): void {
  const label =
    `${context} — on a workspace failing \`build\`'s validations the gate's ` +
    `report ends the subcommand: exit 1, nothing evaluated past it — no ` +
    `session read, the session directory neither examined nor listed, no ` +
    `item ID judged, no recorded baseline resolved (SPEC 13.3, 10.7, 12.0)`;
  assertExitCode(result, 1, label);
  const findings = decodeFindingsReport(
    parseJsonStdout(result, label),
    label,
  ).findings;
  assertSameJson(
    o15GateForm(findings),
    o15GateForm(gate),
    `${label} — exactly the gate's findings: those \`build --json\` reports ` +
      `on the same state, compared by condition, code, path, and locations ` +
      `(SPEC 13.3; message wording free, H-3)`,
  );
}

/**
 * Run an invocation through `run` and assert the outcome it meets (SPEC
 * 10.7): a refusal through T10.7-14's shared check (support.ts
 * `expectReviewRefusal`), the unknown item ID, the irreconstructible
 * baseline, and an error ahead of the gate as the plain usage error
 * (`assertPlainUsageError`), the corruption as exactly the condition-21
 * finding, a given baseline's journal error as `journal-error` concerning
 * the journal (`o15ExpectJournalError`), and the gate's report as exactly
 * the findings of `gate`, `build --json`'s on the same state.
 */
async function o15AssertOutcome(
  product: ProductBinding,
  copy: TestWorkspace,
  invocation: O15Call,
  ids: O15Ids,
  run: O15Run,
  context: string,
  gate?: readonly Finding[],
): Promise<void> {
  const argv = invocation.argv(ids);
  const outcome = invocation.outcome;
  if (outcome.kind === "refusal") {
    await expectReviewRefusal(
      product,
      copy,
      argv,
      outcome.sessionRel,
      context,
      { run },
    );
    return;
  }
  const result = await run([...argv, "--json"]);
  if (outcome.kind === "corrupt") {
    o15ExpectCorruption(result, outcome.sessionRel, context);
    return;
  }
  if (outcome.kind === "gate") {
    if (gate === undefined) {
      throw new Error(
        `harness error: ${context}: a gate outcome is judged against the ` +
          `gate reference (o15GateReference), which the caller did not pass`,
      );
    }
    o15ExpectGateFindings(result, gate, context);
    return;
  }
  if (outcome.kind === "journal-error") {
    o15ExpectJournalError(result, context);
    return;
  }
  assertPlainUsageError(
    result,
    outcome.kind === "usage"
      ? `${context} — ${outcome.why}`
      : outcome.kind === "unknown-item"
        ? `${context} — an unknown item ID in a review command's arguments ` +
          `is a usage error, met past the session read (SPEC 10.7, 12.0)`
        : `${context} — a review command that cannot reconstruct the ` +
          `recorded baseline fails per 6.3 as a usage error, at its place ` +
          `in the order (SPEC 6.3, 10.7, 12.0)`,
  );
}

/**
 * Where a change around an invocation falls, for its diagnosis: graph data
 * — T13.3-2's operational path set (`isGraphDataKey`) — which the refresh
 * of 13.3 writes; the session directory; or the rest of the workspace.
 */
function o15ChangeClass(key: string): string {
  if (isGraphDataKey(key)) {
    return (
      "graph data (T13.3-2's operational path set): the refresh of 13.3, " +
      "made before the outcome"
    );
  }
  if (key === ".xspec/reviews" || key.startsWith(".xspec/reviews/")) {
    return "the session directory: a session file written or changed";
  }
  return "outside graph data and the session directory";
}

/**
 * The outcome ended the subcommand modifying nothing (SPEC 10.7, 13.5): no
 * change between the snapshots but H-6's lock-path exclusion of a mutating
 * run — on a stale state graph data byte-identical and so still stale —
 * each change diagnosed by where it falls (`o15ChangeClass`). `graphData`
 * says whether the state's graph data is stale (the default) or fresh
 * ((d)'s state as `create` left it, and its corrupted twin).
 */
function o15AssertNothingModified(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  context: string,
  graphData: "stale" | "fresh" = "stale",
): void {
  const changes = diffSnapshots(before, after);
  if (changes.length === 0) return;
  const refreshed = changes.some((change) => isGraphDataKey(change.key));
  fail(
    `${context}: the outcome ends the subcommand there, modifying nothing ` +
      (graphData === "stale"
        ? `— only past every outcome does a subcommand write, the refresh ` +
          `of 13.3 first — so graph data (T13.3-2's operational path set) ` +
          `stays byte-identical and still stale (SPEC 10.7, 13.5, 13.3)` +
          (refreshed
            ? ` — graph data changed: a product refreshing before it ` +
              `reaches the outcome leaves graph data refreshed`
            : "")
        : `(SPEC 10.7, 13.5)`) +
      `; found ${String(changes.length)} change(s), H-6 leaving out the ` +
      `lock path of a mutating run alone:\n` +
      changes
        .map(
          (change) =>
            `  ${change.change} ${change.path} ` +
            `[${o15ChangeClass(change.key)}]: ${change.detail}`,
        )
        .join("\n"),
  );
}

/**
 * The edited source's per-file staleness among `check`'s condition-10
 * findings (SPEC 13.1, 14.10): every one of `perFile` concerns a derived
 * path of the edited source — its path with `.mdx` replaced by `.xspec.`
 * plus a suffix (SPEC 13.1) — with the module among them (it embeds the
 * edited text, SPEC 4.2), locations [], each instructing rebuilding
 * (`assertFindingInstructsRebuilding`, SPEC 14.10: a text edit leaves no
 * recorded file obstructing a rebuild write).
 */
function o15AssertPerFileStaleness(
  perFile: readonly Finding[],
  editedSource: string,
  context: string,
): void {
  const derivedPrefix = editedSource.replace(/\.mdx$/, ".xspec.");
  const module = `${derivedPrefix}ts`;
  for (const finding of perFile) {
    if (
      typeof finding.path !== "string" ||
      !finding.path.startsWith(derivedPrefix)
    ) {
      fail(
        `${context}: beside the graph-data unit form, if any, every ` +
          `condition-10 finding is per file, concerning a derived path of ` +
          `the edited source ${editedSource} — ${derivedPrefix}* (SPEC 13.1, ` +
          `14.10); got a condition-10 finding concerning ` +
          `${renderPathValue(finding.path)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
    assertSameJson(
      finding.locations,
      [],
      `${context}: a per-file staleness finding names its path and has no ` +
        `in-source location — locations [] (SPEC 14.10, 12.7)`,
    );
    assertFindingInstructsRebuilding(
      finding,
      `${context}: the per-file staleness finding concerning ` +
        `${JSON.stringify(finding.path)} — a derived file of the edited ` +
        `source, which the rebuild regenerates in place (SPEC 14.10)`,
    );
  }
  if (!perFile.some((finding) => finding.path === module)) {
    fail(
      `${context}: the module ${module} itself is stale — it embeds the ` +
        `edited text (SPEC 4.2, 13.1) — so a per-file condition-10 finding ` +
        `concerns it (SPEC 14.10); got ` +
        JSON.stringify(perFile.map((finding) => renderPathValue(finding.path))),
    );
  }
}

/**
 * `check`'s report once an invocation has left the stale state as it found
 * it (SPEC 13.3, 14.10): graph data is still stale, so exactly one
 * condition-10 finding is the graph-data unit form — concerned path the
 * area `.xspec`, no path inside it named, locations [], instructing
 * rebuilding — where a product refreshing before it reaches the outcome
 * leaves no unit form reported. Every other condition-10 finding is the
 * edited source's per-file staleness (`o15AssertPerFileStaleness`). Beside
 * the staleness, exactly the state's other findings (`besideStaleness`:
 * x's 14.21 on (A), T10.1-4: `check` reports a corrupt session) and nothing
 * else.
 */
function o15AssertStillStale(
  findings: readonly Finding[],
  editedSource: string,
  besideStaleness: Readonly<Record<string, number>>,
  context: string,
): void {
  assertConditionCounts(
    findings.filter((finding) => finding.condition !== "14.10"),
    besideStaleness,
    `${context} — beside the staleness, exactly the state's other findings ` +
      `and nothing else (SPEC 14, 12.2)`,
  );
  const stale = findings.filter((finding) => finding.condition === "14.10");
  const unitForms = stale.filter(
    (finding) => finding.path === GRAPH_DATA_AREA_PATH,
  );
  if (unitForms.length !== 1) {
    fail(
      `${context}: the invocation modified nothing, so graph data is still ` +
        `stale and \`check\` reports the graph-data unit form — exactly one ` +
        `condition-10 finding concerning the area ${GRAPH_DATA_AREA_PATH} ` +
        `(SPEC 10.7, 13.3, 14.10) — where a product refreshing before it ` +
        `reaches the outcome leaves graph data refreshed and no unit form ` +
        `reported; got ${String(unitForms.length)} among the condition-10 ` +
        `findings concerning ` +
        JSON.stringify(stale.map((finding) => renderPathValue(finding.path))),
    );
  }
  const unitForm = unitForms[0]!;
  assertSameJson(
    unitForm.locations,
    [],
    `${context}: the graph-data unit form names no path inside the area — ` +
      `the record's layout is unenumerated (SPEC 14.10, 13.3) — and a ` +
      `path-concerned condition is unlocated: locations [] (SPEC 12.7)`,
  );
  assertFindingInstructsRebuilding(
    unitForm,
    `${context}: the graph-data unit form — stale graph data, which the ` +
      `rebuild regenerates — instructs rebuilding (SPEC 14.10)`,
  );
  o15AssertPerFileStaleness(
    stale.filter((finding) => finding !== unitForm),
    editedSource,
    context,
  );
}

/** What `check` must find once a subcommand has refreshed stale graph data. */
interface O15Refreshed {
  /** The source whose edit left its derived files stale. */
  readonly editedSource: string;
  /** `check`'s findings beside the staleness, counted by identity. */
  readonly beside: Readonly<Record<string, number>>;
  /** Where the refresh falls (SPEC 10.7, 13.3). */
  readonly refreshed: string;
  /** The product that leaves it out, and what it leaves behind. */
  readonly failing: string;
}

/**
 * `check`'s report once a subcommand has refreshed stale graph data — a
 * performed `split` before its session write ((c)(iii)), `list` past its
 * corruptions ((e)); SPEC 10.7, 13.3, 14.10: no condition-10 finding is the
 * graph-data unit form — graph data matches the current sources — where a
 * product leaving the refresh out leaves the unit form reported; every
 * condition-10 finding is the edited source's per-file staleness
 * (`o15AssertPerFileStaleness`: 13.3's refresh writes graph data alone,
 * never a derived file); and beside it exactly `expected.beside` (nothing
 * on (c)(iii)'s twin, which holds no corrupt session; x's 14.21 on (A)).
 */
function o15AssertRefreshed(
  findings: readonly Finding[],
  expected: O15Refreshed,
  context: string,
): void {
  assertConditionCounts(
    findings.filter((finding) => finding.condition !== "14.10"),
    expected.beside,
    `${context} — beside the staleness, exactly the state's other findings ` +
      `and nothing else (SPEC 14, 12.2)`,
  );
  const stale = findings.filter((finding) => finding.condition === "14.10");
  const unitForms = stale.filter(
    (finding) => finding.path === GRAPH_DATA_AREA_PATH,
  );
  if (unitForms.length !== 0) {
    fail(
      `${context}: ${expected.refreshed} — so \`check\` afterwards ` +
        `reports no graph-data unit form (SPEC 14.10), where ` +
        `${expected.failing}; got ${String(unitForms.length)} ` +
        `condition-10 finding(s) concerning ` +
        `the area ${GRAPH_DATA_AREA_PATH} among those concerning ` +
        JSON.stringify(stale.map((finding) => renderPathValue(finding.path))),
    );
  }
  o15AssertPerFileStaleness(stale, expected.editedSource, context);
}

/** A run of (b) reporting `write-failure` attempted the refresh first. */
function o15RejectWriteFailure(result: RunResult, context: string): void {
  if (result.exitCode !== 2) return;
  const error = expectErrorDocument(result, context);
  if (error.code !== WRITE_FAILURE_CODE) return;
  fail(
    `${context}: never \`write-failure\` — the refresh write of 13.3 comes ` +
      `only past every outcome, and a write failure is met only at the ` +
      `write it refuses, a refresh's too (SPEC 10.7, 12.0, 13.3, 14.24); ` +
      `a product attempting the refresh before it reaches the outcome ` +
      `meets the staged refusal there; got \`write-failure\` concerning ` +
      `${renderPathValue(error.path)} (message: ` +
      `${JSON.stringify(error.message)})`,
  );
}

/**
 * (a) on one invocation: on its own copy of the stale state, the outcome,
 * nothing modified around it, and `check` afterwards still reporting the
 * graph-data unit form beside the edited source's per-file staleness.
 */
async function o15StaleArm(
  product: ProductBinding,
  state: O15State,
  invocation: O15Invocation,
  ids: O15Ids,
): Promise<void> {
  const context =
    `T10.7-15 (a) on ${state.label}'s stale state ` +
    `[\`${invocation.argv(ids).join(" ")}\`: ${invocation.what}]`;
  await withO15Copy(state, async (copy) => {
    const before = await snapshotDirectory(copy.root);
    await o15AssertOutcome(
      product,
      copy,
      invocation,
      ids,
      (jsonArgv) => runCli(product, copy, jsonArgv),
      context,
    );
    o15AssertNothingModified(
      before,
      await snapshotDirectory(copy.root),
      context,
    );
    const checkContext = `${context} \`check --json\` afterwards`;
    o15AssertStillStale(
      await runFindingsReport(
        product,
        copy,
        ["check", "--json"],
        1,
        `${checkContext} — graph data and the edited source's generated ` +
          `module are stale, so \`check\` exits 1 (SPEC 12.2, 14.10)`,
      ),
      state.editedSource,
      state.besideStaleness,
      checkContext,
    );
  });
}

/**
 * (b) on one invocation: on its own copy of the stale state, the
 * graph-data area staged unwritable by T14-9's graph-data staging
 * (`graphDataRefusal`) — before a read's invocation (`runStaged`: the reads
 * take no hold) and, for `resolve` and `split`, while the run is held at
 * the seam of 13.5, after acquisition (`runHeldWithStaging`) — restored once
 * the run exits: never `write-failure`, exactly (a)'s outcome, nothing
 * modified around it (under the staging a held run's release is refused
 * the emptied lock directory's deletion, which changes no outcome; H-6
 * leaves the lock path of a mutating run out of the compare).
 */
async function o15UnwritableArm(
  product: ProductBinding,
  state: O15State,
  invocation: O15Invocation,
  ids: O15Ids,
): Promise<void> {
  const context =
    `T10.7-15 (b) on ${state.label}'s stale state, the graph-data area ` +
    `staged unwritable${invocation.mutating ? " at the seam" : ""} ` +
    `[\`${invocation.argv(ids).join(" ")}\`: ${invocation.what}]`;
  await withO15Copy(state, async (copy) => {
    const before = await snapshotDirectory(copy.root);
    const run: O15Run = async (jsonArgv) => {
      const result = invocation.mutating
        ? await runHeldWithStaging(
            product,
            copy,
            jsonArgv,
            O15_HOLD_NAME,
            graphDataRefusal(),
            context,
          )
        : await runStaged(product, copy, jsonArgv, graphDataRefusal(), context);
      o15RejectWriteFailure(result, context);
      return result;
    };
    await o15AssertOutcome(product, copy, invocation, ids, run, context);
    o15AssertNothingModified(
      before,
      await snapshotDirectory(copy.root),
      context,
    );
  });
}

/**
 * The unique exported item of a kind and scope node, diagnosed when missing
 * or duplicated (SPEC 10.1, 10.5: at most one item per kind and scope node).
 */
function o15ExportItem(
  report: ExportReport,
  kind: ItemKind,
  scope: string,
  context: string,
): ReviewItem {
  const items = report.items.filter(
    (item) => item.kind === kind && item.scope.node === scope,
  );
  if (items.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.1, 10.5: a session never contains two items with the same ` +
        `kind and scope node); found ${String(items.length)} among ` +
        JSON.stringify(
          report.items.map((item) => `${item.kind} ${item.scope.node}`),
        ),
    );
  }
  return items[0]!;
}

/**
 * (c)'s twin of (A): a fresh workspace of (A)'s initial source and
 * configuration (staged-source records: it is created after the body's
 * first invocation), built, holding its own audit session `a`, unsplit, and
 * no second session; its `status`, read before any hand edit, is returned
 * for the arm's premises. Disposed by the caller (H-1), or here when the
 * staging fails.
 */
async function o15StageTwinA(
  product: ProductBinding,
  context: string,
): Promise<{
  readonly workspace: TestWorkspace;
  readonly status: SessionStatusReport;
}> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": O15_CONFIG, [O15_A_FILE]: O15_A_INITIAL },
  });
  try {
    await buildOk(product, workspace, `${context} \`build\``);
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", O15_A_SESSION],
      0,
      `${context} \`review create --strategy audit --name ${O15_A_SESSION}\``,
    );
    return {
      workspace,
      status: await o15Status(product, workspace, O15_A_SESSION, context),
    };
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/**
 * (c)(i), an item's blocked state judged against the current workspace
 * (SPEC 10.3, 10.4, 10.7, 13.3): on a twin of (A), P.c's item resolved
 * `no-change`, unblocking P's (premises from `status`: blocked before,
 * unblocked after), then P.c's text edited by hand — invalidating P.c's item
 * (10.4) and so re-blocking P's (10.3) in the current workspace, while stale
 * graph data still holds P.c's recorded hashes: `resolve a <P's item>
 * --status no-change`, run with no rebuild and no read since the edit, is
 * refused at once in T10.7-14's form (the shared check), nothing modified.
 */
async function o15ReblockedArm(product: ProductBinding): Promise<void> {
  const context = "T10.7-15 (c)(i) on a twin of (A)";
  const { workspace, status } = await o15StageTwinA(product, context);
  try {
    const pRow = r14Row(status, "subtree-coherence", O15_P, context);
    const pcRow = r14Row(status, "subtree-coherence", O15_PC, context);
    r14ExpectRowState(
      pRow,
      { status: "unresolved", blocked: true },
      "blocked by its child section's unresolved item, P.c's (SPEC 10.3, " +
        "10.6)",
      context,
    );
    r14ExpectRowState(
      pcRow,
      { status: "unresolved", blocked: false },
      "a leaf's item, blocked by nothing (SPEC 10.6)",
      context,
    );
    await expectExit(
      product,
      workspace,
      ["review", "resolve", O15_A_SESSION, pcRow.id, "--status", "no-change"],
      0,
      `${context} \`review resolve ${O15_A_SESSION} <P.c's item> --status ` +
        `no-change\` — unblocked, so resolved (SPEC 10.7)`,
    );
    const resolvedContext = `${context} after P.c's resolve`;
    const resolved = await o15Status(
      product,
      workspace,
      O15_A_SESSION,
      resolvedContext,
    );
    r14ExpectRowState(
      r14Row(resolved, "subtree-coherence", O15_PC, resolvedContext),
      { status: "no-change", blocked: false },
      "resolved no-change (SPEC 10.3, 10.7)",
      resolvedContext,
    );
    r14ExpectRowState(
      r14Row(resolved, "subtree-coherence", O15_P, resolvedContext),
      { status: "unresolved", blocked: false },
      "unblocked: its one blocker, its child section P.c's item, is " +
        "resolved (SPEC 10.3, 10.6)",
      resolvedContext,
    );

    // P.c's text edited by hand: no rebuild and no read before the
    // invocation, so graph data is stale when it runs.
    await workspace.file(O15_A_FILE, O15_A_PC_EDITED);
    const refusalContext =
      `${context} [\`review resolve ${O15_A_SESSION} <P's item> --status ` +
      `no-change\`: P.c's text edited since its item's no-change resolve, so ` +
      `that item is invalidated (SPEC 10.4) and P's item re-blocked (SPEC ` +
      `10.3) in the current workspace — refused at once, never resolved by ` +
      `a judgement from stale graph data, in which P.c's hashes still equal ` +
      `its recorded state (SPEC 10.7, 13.3)]`;
    const before = await snapshotDirectory(workspace.root);
    await expectReviewRefusal(
      product,
      workspace,
      ["review", "resolve", O15_A_SESSION, pRow.id, "--status", "no-change"],
      O15_A_SESSION_REL,
      refusalContext,
    );
    o15AssertNothingModified(
      before,
      await snapshotDirectory(workspace.root),
      refusalContext,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * (c)(ii), a scope root's children judged against the current workspace
 * (SPEC 10.7, 13.3): on a twin of (A), Q.r's section deleted by hand, Q left
 * childless in the current workspace while stale graph data still holds
 * Q.r: `split a <Q's item>`, run with no rebuild and no read since the
 * edit, is refused (the shared check), nothing modified.
 */
async function o15ChildlessArm(product: ProductBinding): Promise<void> {
  const context = "T10.7-15 (c)(ii) on a twin of (A)";
  const { workspace, status } = await o15StageTwinA(product, context);
  try {
    const qRow = r14Row(status, "subtree-coherence", O15_Q, context);
    // A premise: Q's child Q.r has an item of its own (SPEC 10.6), so Q has
    // a child in the graph `create` saw.
    r14Row(status, "subtree-coherence", O15_QR, context);
    await workspace.file(O15_A_FILE, O15_A_QR_DELETED);
    const refusalContext =
      `${context} [\`review split ${O15_A_SESSION} <Q's item>\`: Q.r's ` +
      `section deleted by hand, so Q has no children in the current ` +
      `workspace — refused, never split over children taken from stale ` +
      `graph data, which still holds Q.r (SPEC 10.7, 13.3)]`;
    const before = await snapshotDirectory(workspace.root);
    await expectReviewRefusal(
      product,
      workspace,
      ["review", "split", O15_A_SESSION, qRow.id],
      O15_A_SESSION_REL,
      refusalContext,
    );
    o15AssertNothingModified(
      before,
      await snapshotDirectory(workspace.root),
      refusalContext,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * (c)(iii), a scope root's children judged against the current workspace,
 * the split performed (SPEC 10.6, 10.7, 13.3): on a twin of (A), a child s.t
 * authored by hand under the leaf s, which stale graph data still holds
 * childless: `split a <s's item>`, run with no rebuild and no read since
 * the edit, exits 0; `check --json` then — before any refreshing read —
 * reports no graph-data unit form beside the edited source's per-file
 * staleness (`o15AssertRefreshed`: graph data refreshed before the session
 * write); and `export` shows the session gaining exactly s.t's
 * subtree-coherence item and s's parent-consistency item, the latter's
 * context exactly {s.t} and its blockedBy exactly s.t's item.
 */
async function o15NewChildArm(product: ProductBinding): Promise<void> {
  const context = "T10.7-15 (c)(iii) on a twin of (A)";
  const { workspace, status } = await o15StageTwinA(product, context);
  try {
    const sRow = r14Row(status, "subtree-coherence", O15_S, context);
    const itemsBefore = status.items.map((row) => `${row.kind} ${row.scope}`);
    await workspace.file(O15_A_FILE, O15_A_ST_AUTHORED);
    await expectExit(
      product,
      workspace,
      ["review", "split", O15_A_SESSION, sRow.id],
      0,
      `${context} \`review split ${O15_A_SESSION} <s's item>\` — s has the ` +
        `child s.t in the current workspace, authored by hand with no ` +
        `rebuild and no read since, so the split is performed, never ` +
        `refused over children taken from stale graph data, in which s has ` +
        `none (SPEC 10.7, 13.3)`,
    );
    const checkContext = `${context} \`check --json\` after the split`;
    o15AssertRefreshed(
      await runFindingsReport(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkContext} — the edited source's generated module is stale, ` +
          `so \`check\` exits 1 (SPEC 12.2, 14.10)`,
      ),
      {
        editedSource: O15_A_FILE,
        beside: {},
        refreshed:
          "graph data is refreshed before the session write — only past " +
          "every outcome come the writes, the refresh of 13.3 first, then " +
          "the session file (SPEC 10.7, 13.3)",
        failing:
          "a product writing the session without refreshing graph data " +
          "leaves it stale",
      },
      checkContext,
    );
    const exportContext =
      `${context} \`review export ${O15_A_SESSION} --json\` after the ` +
      `split`;
    const exported = decodeExportReport(
      await runJson(
        product,
        workspace,
        ["review", "export", O15_A_SESSION, "--json"],
        exportContext,
      ),
      exportContext,
    );
    assertSameJson(
      exported.items
        .map((item) => `${item.kind} ${item.scope.node}`)
        .filter((key) => !itemsBefore.includes(key))
        .sort(),
      [`parent-consistency ${O15_S}`, `subtree-coherence ${O15_ST}`],
      `${exportContext}: the session gains exactly s.t's subtree-coherence ` +
        `item and s's parent-consistency item — s's decomposition over its ` +
        `one child in the current workspace (SPEC 10.6, 10.7)`,
    );
    const stItem = o15ExportItem(
      exported,
      "subtree-coherence",
      O15_ST,
      exportContext,
    );
    const sPcItem = o15ExportItem(
      exported,
      "parent-consistency",
      O15_S,
      exportContext,
    );
    assertSameJson(
      sPcItem.context.map((node) => node.node).sort(),
      [O15_ST],
      `${exportContext}: s's parent-consistency item's context is exactly ` +
        `s's children in the current workspace, {s.t} (SPEC 10.7)`,
    );
    assertSameJson(
      sPcItem.blockedBy,
      [stItem.id],
      `${exportContext}: s's parent-consistency item's blockedBy is exactly ` +
        `the per-child item, s.t's (SPEC 10.7)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/** (d)'s states, each staged on its own copy of (B)'s state as created. */
type O15PlaceState = "created" | "cycle" | "failing";

/** One of (d)'s invocations, with the state it runs on. */
interface O15PlaceCall extends O15Call {
  readonly state: O15PlaceState;
}

/** (d)'s states, for diagnoses. */
const O15_PLACE_STATE_LABELS: Readonly<Record<O15PlaceState, string>> = {
  created: "(B)'s state, no section edited since `create`",
  cycle:
    "(B)'s state with b's file corrupted by T10.1-4's `blockedBy`-cycle " +
    "staging",
  failing:
    "(B)'s state with specs/B.mdx given a section with no id, failing " +
    "`build`'s validations",
};

/**
 * Stage one of (d)'s states on a copy of (B)'s state as `create` left it:
 * `created` as it is; `cycle` with b's product-written file corrupted by
 * T10.1-4's `blockedBy`-cycle staging (adapters/session-staging.ts
 * `stageBlockedByCycle`: the first two items block each other, the file
 * parseable and its recorded parameters untouched — so the session violates
 * one invariant, 10.1); `failing` with specs/B.mdx given a section with no
 * id (a staged-source record).
 */
async function o15StagePlace(
  copy: TestWorkspace,
  state: O15PlaceState,
): Promise<void> {
  if (state === "cycle") {
    await stageBlockedByCycle(copy.path(O15_B_SESSION_REL));
  } else if (state === "failing") {
    await copy.file(O15_B_FILE, O15_B_GATE_FAILING);
  }
}

const O15_BASELINE_FIRST =
  "but the recorded baseline comes first: the baseline's plain usage " +
  "error, never the refusal's exit 1";
const O15_CORRUPTION_FIRST =
  "the session read meets b's corruption before the recorded baseline: " +
  "exactly the condition-21 finding, never the baseline's exit 2";
const O15_GATE_FIRST =
  "the gate precedes the recorded baseline: exactly the gate's findings, " +
  "never the baseline's exit 2";

/** (d)'s invocations, in TEST-SPEC's order. */
const O15_PLACE_CALLS: readonly O15PlaceCall[] = [
  {
    what: `G's parent-consistency item is blocked by G.N's unresolved item, ${O15_BASELINE_FIRST}`,
    state: "created",
    argv: (ids) => [
      "review",
      "resolve",
      O15_B_SESSION,
      ids.gPc,
      "--status",
      "no-change",
    ],
    outcome: { kind: "baseline" },
  },
  {
    what: `G's parent-consistency item is of another kind, ${O15_BASELINE_FIRST}`,
    state: "created",
    argv: (ids) => ["review", "split", O15_B_SESSION, ids.gPc],
    outcome: { kind: "baseline" },
  },
  {
    what: O15_CORRUPTION_FIRST,
    state: "cycle",
    argv: () => ["review", "status", O15_B_SESSION],
    outcome: { kind: "corrupt", sessionRel: O15_B_SESSION_REL },
  },
  {
    what: O15_CORRUPTION_FIRST,
    state: "cycle",
    argv: (ids) => [
      "review",
      "resolve",
      O15_B_SESSION,
      ids.gnSc,
      "--status",
      "no-change",
    ],
    outcome: { kind: "corrupt", sessionRel: O15_B_SESSION_REL },
  },
  {
    what: O15_CORRUPTION_FIRST,
    state: "cycle",
    argv: (ids) => ["review", "split", O15_B_SESSION, ids.gPc],
    outcome: { kind: "corrupt", sessionRel: O15_B_SESSION_REL },
  },
  {
    what: O15_GATE_FIRST,
    state: "failing",
    argv: () => ["review", "status", O15_B_SESSION],
    outcome: { kind: "gate" },
  },
  {
    what: O15_GATE_FIRST,
    state: "failing",
    argv: () => ["review", "next", O15_B_SESSION],
    outcome: { kind: "gate" },
  },
  {
    what: O15_GATE_FIRST,
    state: "failing",
    argv: (ids) => ["review", "show", O15_B_SESSION, ids.gPc],
    outcome: { kind: "gate" },
  },
  {
    what: O15_GATE_FIRST,
    state: "failing",
    argv: () => ["review", "export", O15_B_SESSION],
    outcome: { kind: "gate" },
  },
  {
    what: O15_GATE_FIRST,
    state: "failing",
    argv: (ids) => [
      "review",
      "resolve",
      O15_B_SESSION,
      ids.gnSc,
      "--status",
      "no-change",
    ],
    outcome: { kind: "gate" },
  },
  {
    what: O15_GATE_FIRST,
    state: "failing",
    argv: (ids) => ["review", "split", O15_B_SESSION, ids.gPc],
    outcome: { kind: "gate" },
  },
];

/** A failing state, staged on a copy, whose gate reference an arm takes. */
interface O15FailingState {
  /** The arm or arms judged against it, for diagnoses. */
  readonly arm: string;
  /** The state's label, for diagnoses. */
  readonly label: string;
  /** The staged state a copy of which the failing state is staged on. */
  readonly staged: O15Staged;
  /** Stage the failing state on the copy. */
  readonly stage: (copy: TestWorkspace) => Promise<void>;
  /** The source holding the section with no id, and its byte window. */
  readonly file: string;
  readonly window: { readonly start: number; readonly end: number };
}

/**
 * A failing state's gate reference — (d)'s on (B)'s failing state, (f)(i)'s
 * and (g)'s on (A)'s: `build --json` on a copy of the state, exit 1 with
 * exactly one condition-1 finding, locating the section with no id (SPEC
 * 12.1, 14.1; diagnosed premises) — the findings a `build` would now
 * report, which the gate reports in their place (SPEC 13.3).
 */
async function o15GateReference(
  product: ProductBinding,
  failing: O15FailingState,
): Promise<readonly Finding[]> {
  const context =
    `T10.7-15 ${failing.arm} \`build --json\` on ${failing.label} ` +
    `(the gate reference)`;
  let reference: readonly Finding[] = [];
  await withO15Copy(failing.staged, async (copy) => {
    await failing.stage(copy);
    reference = await buildFindings(
      product,
      copy,
      `${context} — a section with no id fails \`build\`'s validations, ` +
        `exit 1 (SPEC 12.1, 14.1)`,
    );
  });
  assertConditionCounts(
    reference,
    { "14.1": 1 },
    `${context} — exactly the staged validation error, the section with no ` +
      `id (SPEC 14.1)`,
  );
  assertFindingLocated(
    reference[0]!,
    { file: failing.file, window: failing.window },
    `${context} — the condition-1 finding locates the section with no id ` +
      `(SPEC 14)`,
  );
  return reference;
}

/** (d)'s failing state: (B)'s state as created, given a section with no id. */
function o15PlaceFailing(created: O15Staged): O15FailingState {
  return {
    arm: "(d)",
    label: O15_PLACE_STATE_LABELS.failing,
    staged: created,
    stage: async (copy) => await o15StagePlace(copy, "failing"),
    file: O15_B_FILE,
    window: O15_B_IDLESS_WINDOW,
  };
}

/**
 * (d) on one invocation: on its own copy of (B)'s state as `create` left
 * it, its state staged on the copy (`o15StagePlace`), the outcome, nothing
 * modified around it — graph data fresh on the state itself and on its
 * corrupted twin, stale on the failing one, whose source is edited.
 */
async function o15PlaceArm(
  product: ProductBinding,
  created: O15Staged,
  call: O15PlaceCall,
  ids: O15Ids,
  gate: readonly Finding[] | undefined,
): Promise<void> {
  const context =
    `T10.7-15 (d) on ${O15_PLACE_STATE_LABELS[call.state]} ` +
    `[\`${call.argv(ids).join(" ")}\`: ${call.what}]`;
  await withO15Copy(created, async (copy) => {
    await o15StagePlace(copy, call.state);
    const before = await snapshotDirectory(copy.root);
    await o15AssertOutcome(
      product,
      copy,
      call,
      ids,
      (jsonArgv) => runCli(product, copy, jsonArgv),
      context,
      gate,
    );
    o15AssertNothingModified(
      before,
      await snapshotDirectory(copy.root),
      context,
      call.state === "failing" ? "stale" : "fresh",
    );
  });
}

/**
 * T14-10(h)'s staging (helpers/permissions.ts `stageReadRefusalOfDirectory`):
 * the session directory's listing refused — mode 0o100, its search kept —
 * verified on the harness before any product sees it (E-1), restored once
 * the run ends (`runStaged`).
 */
const o15UnlistableSessionDirectory: StagingApplier = async (root) =>
  await stageReadRefusalOfDirectory(path.join(root, REVIEWS_DIR));

/**
 * Graph data — T13.3-2's operational path set (`isGraphDataKey`) — is
 * byte-identical between the snapshots ((e): `list` reads every session
 * before the refresh, so a refused listing ends it before any graph-data
 * write; SPEC 10.7, 13.3, 14.25), each change diagnosed.
 */
function o15AssertGraphDataUnchanged(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  context: string,
): void {
  const changes = diffSnapshots(before, after).filter((change) =>
    isGraphDataKey(change.key),
  );
  if (changes.length === 0) return;
  fail(
    `${context}: graph data (T13.3-2's operational path set) stays ` +
      `byte-identical — \`list\` lists the session directory and reads every ` +
      `session before the refresh of 13.3, so the refused listing ends it ` +
      `before any graph-data write (SPEC 10.7, 13.3, 14.25) — where a ` +
      `product refreshing first leaves graph data refreshed; found ` +
      `${String(changes.length)} change(s):\n` +
      changes
        .map((change) => `  ${change.change} ${change.path}: ${change.detail}`)
        .join("\n"),
  );
}

/**
 * (e), `list`'s place (SPEC 10.7: past the gate it lists the session
 * directory and reads every session, its corruptions part of its answer,
 * and it answers only past the refresh — T13.3-2's sweep), `review list
 * --json` on three copies of (A)'s stale state: as staged, the listing with
 * x corrupt beside a, exit 1 (`o15ExpectListing`), and graph data refreshed
 * — `check --json` afterwards reporting no unit form beside the edited
 * source's per-file staleness and x's 14.21 (`o15AssertRefreshed`); and, on
 * the Linux leg (E-1), with the graph-data area staged unwritable by T14-9's
 * graph-data staging before the run (`runStaged`: `list` takes no hold),
 * exit 2 with `write-failure` concerning `.xspec`, the error document as the
 * entire stdout (`expectWriteFailure`) — the corruption ending nothing — and
 * with the session directory staged unlistable instead (T14-10(h)'s
 * staging), exit 2 with `read-failure` concerning `.xspec/reviews`, graph
 * data byte-identical around it — every session read before the refresh.
 */
async function o15ListArm(
  product: ProductBinding,
  state: O15State,
): Promise<void> {
  const argv = ["review", "list", "--json"];
  const head = `T10.7-15 (e) on ${state.label}'s stale state`;
  await withO15Copy(state, async (copy) => {
    const context =
      `${head} [\`review list --json\`: x's corruption is part of the ` +
      `answer, which comes only past the refresh]`;
    o15ExpectListing(await runCli(product, copy, argv), context);
    const checkContext = `${context} \`check --json\` afterwards`;
    o15AssertRefreshed(
      await runFindingsReport(
        product,
        copy,
        ["check", "--json"],
        1,
        `${checkContext} — the edited source's generated module is stale ` +
          `and x corrupt, so \`check\` exits 1 (SPEC 12.2, 14.10, 14.21)`,
      ),
      {
        editedSource: state.editedSource,
        beside: state.besideStaleness,
        refreshed:
          "graph data is refreshed before `list` answers — past the gate " +
          "`list` reads every session, each corruption part of its answer, " +
          "and answers only past the refresh of 13.3 (SPEC 10.7, 13.3)",
        failing:
          "a product letting the corruption end `list` leaves graph data " +
          "stale",
      },
      checkContext,
    );
  });
  if (!WRITE_REFUSALS_STAGED) return;
  await withO15Copy(state, async (copy) => {
    const context =
      `${head}, the graph-data area staged unwritable (T14-9's graph-data ` +
      `staging) [\`review list --json\`: the corruption ends nothing, so ` +
      `\`list\` reaches the refresh, whose write is refused]`;
    expectWriteFailure(
      await runStaged(product, copy, argv, graphDataRefusal(), context),
      [GRAPH_DATA_AREA_PATH],
      `${context} — a write of graph data concerns the graph-data area ` +
        `(SPEC 14.24, 13.3, 12.0)`,
    );
  });
  await withO15Copy(state, async (copy) => {
    const context =
      `${head}, ${REVIEWS_DIR} staged unlistable (T14-10(h)'s staging) ` +
      `[\`review list --json\`: the listing of the session directory comes ` +
      `before the refresh]`;
    const before = await snapshotDirectory(copy.root);
    o15ExpectReadFailure(
      await runStaged(
        product,
        copy,
        argv,
        o15UnlistableSessionDirectory,
        context,
      ),
      REVIEWS_DIR,
      context,
    );
    o15AssertGraphDataUnchanged(
      before,
      await snapshotDirectory(copy.root),
      context,
    );
  });
}

/** (f)(i)'s and (g)'s states, each staged on its own copy of (A)'s stale state. */
type O15GateState = "failing" | "reviews-file" | "reviews-unlistable";

/** One of (f)(i)'s or (g)'s invocations, with the state it runs on. */
interface O15GateCall extends O15Call {
  readonly state: O15GateState;
}

/** (f)(i)'s and (g)'s states, for diagnoses. */
const O15_GATE_STATE_LABELS: Readonly<Record<O15GateState, string>> = {
  failing:
    "(A)'s state with specs/A.mdx given a section with no id, failing " +
    "`build`'s validations",
  "reviews-file":
    "(A)'s failing state with .xspec/reviews replaced by a plain file",
  "reviews-unlistable":
    "(A)'s failing state with .xspec/reviews staged unlistable (T14-10(h)'s " +
    "staging)",
};

/**
 * Stage one of (f)(i)'s and (g)'s states on a copy of (A)'s stale state:
 * specs/A.mdx replaced by (A)'s staleness edit plus a section with no id (a
 * staged-source record), the sessions as staged — `a` well-formed, `x`
 * corrupt; `reviews-file` also replaces the session directory by a plain
 * file, verified on the harness (a wrong kind is a harness error, never a
 * product verdict); `reviews-unlistable`'s staging is made around the run
 * (`o15UnlistableSessionDirectory`).
 */
async function o15StageGate(
  copy: TestWorkspace,
  state: O15GateState,
): Promise<void> {
  await copy.file(O15_A_FILE, O15_A_GATE_FAILING);
  if (state !== "reviews-file") return;
  await fsp.rm(copy.path(REVIEWS_DIR), { recursive: true, force: true });
  await copy.file(REVIEWS_DIR, O15_REVIEWS_OCCUPANT);
  const kind = await copy.kind(REVIEWS_DIR);
  if (kind !== "file") {
    throw new Error(
      `harness error: T10.7-15 (f)(i) staging: ${REVIEWS_DIR} must hold a ` +
        `plain file once staged; found ${kind}`,
    );
  }
}

/** (f)(i)'s and (g)'s failing state, its gate reference taken once for both. */
function o15GateFailing(state: O15State): O15FailingState {
  return {
    arm: "(f)(i) and (g)",
    label: O15_GATE_STATE_LABELS.failing,
    staged: state,
    stage: async (copy) => await o15StageGate(copy, "failing"),
    file: O15_A_FILE,
    window: O15_A_IDLESS_WINDOW,
  };
}

const O15_GATE_FIRST_CREATE =
  "the gate precedes `create`'s examination of the session directory: " +
  "exactly the gate's findings";

/** (f)(i)'s invocations, in TEST-SPEC's order. */
const O15_SESSION_DIRECTORY_CALLS: readonly O15GateCall[] = [
  {
    what: `a names an existing session, but ${O15_GATE_FIRST_CREATE}, never the code-less refusal`,
    state: "failing",
    argv: () => [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      O15_A_SESSION,
    ],
    outcome: { kind: "gate" },
  },
  {
    what: `x names a corrupt session, but ${O15_GATE_FIRST_CREATE}, never a condition-21 finding`,
    state: "failing",
    argv: () => [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      O15_X_SESSION,
    ],
    outcome: { kind: "gate" },
  },
  {
    what: `A matches a ignoring ASCII case alone (SPEC 10.1), but ${O15_GATE_FIRST_CREATE}, never the code-less refusal`,
    state: "failing",
    argv: () => [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      O15_A_SESSION_FOLDED,
    ],
    outcome: { kind: "gate" },
  },
  {
    what: `the session directory's path holds a plain file, but ${O15_GATE_FIRST_CREATE}, never condition 22 concerning ${REVIEWS_DIR}`,
    state: "reviews-file",
    argv: () => [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      O15_NEW_SESSION,
    ],
    outcome: { kind: "gate" },
  },
  {
    what:
      "the session directory is unlistable, but the gate precedes `list`'s " +
      "listing of it: exactly the gate's findings, never `read-failure`",
    state: "reviews-unlistable",
    argv: () => ["review", "list"],
    outcome: { kind: "gate" },
  },
  {
    what: `the session directory is unlistable, but ${O15_GATE_FIRST_CREATE}, never \`read-failure\``,
    state: "reviews-unlistable",
    argv: () => [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      O15_NEW_SESSION,
    ],
    outcome: { kind: "gate" },
  },
];

const O15_ITEM_ID_PAST_GATE =
  "an unknown item ID, judged past the gate (SPEC 12.0, 10.7): exactly the " +
  "gate's findings, never the unknown-item exit 2 it gives on (A)'s stale " +
  "state, which passes `build`'s validations";

/** (g)'s invocations, in TEST-SPEC's order. */
const O15_ITEM_ID_CALLS: readonly O15GateCall[] = [
  {
    what: O15_ITEM_ID_PAST_GATE,
    state: "failing",
    argv: () => ["review", "show", O15_A_SESSION, O15_UNKNOWN_ITEM],
    outcome: { kind: "gate" },
  },
  {
    what: O15_ITEM_ID_PAST_GATE,
    state: "failing",
    argv: () => [
      "review",
      "resolve",
      O15_A_SESSION,
      O15_UNKNOWN_ITEM,
      "--status",
      "no-change",
    ],
    outcome: { kind: "gate" },
  },
  {
    what: O15_ITEM_ID_PAST_GATE,
    state: "failing",
    argv: () => ["review", "split", O15_A_SESSION, O15_UNKNOWN_ITEM],
    outcome: { kind: "gate" },
  },
];

/**
 * (f)(i) or (g) on one invocation: on its own copy of (A)'s stale state,
 * its state staged on the copy (`o15StageGate`; the unlistable session
 * directory around the run, `runStaged`), exactly the gate's findings
 * (`gate`, `o15GateReference`'s), nothing modified around it — no session
 * file written or changed.
 */
async function o15GateArm(
  product: ProductBinding,
  state: O15State,
  arm: "(f)(i)" | "(g)",
  call: O15GateCall,
  ids: O15Ids,
  gate: readonly Finding[],
): Promise<void> {
  const context =
    `T10.7-15 ${arm} on ${O15_GATE_STATE_LABELS[call.state]} ` +
    `[\`${call.argv(ids).join(" ")}\`: ${call.what}]`;
  await withO15Copy(state, async (copy) => {
    await o15StageGate(copy, call.state);
    const before = await snapshotDirectory(copy.root);
    const run: O15Run =
      call.state === "reviews-unlistable"
        ? async (jsonArgv) =>
            await runStaged(
              product,
              copy,
              jsonArgv,
              o15UnlistableSessionDirectory,
              context,
            )
        : async (jsonArgv) => await runCli(product, copy, jsonArgv);
    await o15AssertOutcome(product, copy, call, ids, run, context, gate);
    o15AssertNothingModified(
      before,
      await snapshotDirectory(copy.root),
      context,
    );
  });
}

/** (f)(ii)'s states, each staged on its own copy of (A)'s git twin. */
type O15AheadState = "valid" | "journal" | "stale";

/** One of (f)(ii)'s invocations, with the state it runs on. */
interface O15AheadCall extends O15Call {
  readonly state: O15AheadState;
}

/** (f)(ii)'s states, for diagnoses. */
const O15_AHEAD_STATE_LABELS: Readonly<Record<O15AheadState, string>> = {
  valid: "(A)'s git twin, passing `build`'s validations",
  journal:
    "(A)'s git twin with a garbage line appended to the current journal " +
    "(T6.3-6(a)'s staging)",
  stale: "(A)'s git twin's stale state, u's text edited as in (A)",
};

/**
 * (A)'s git twin (TEST-SPEC T10.7-15(f)(ii)): a twin of (A)
 * (`o15StageTwinA`: a fresh workspace of (A)'s initial records, built, its
 * own audit session `a` created — the existing session the invocations name
 * — and read through `status`, unsplit, no `x`), then a git repository
 * initialized at its root and everything committed as `c1`. Staged once and
 * never invoked on again: each invocation runs on its own copy. Disposed by
 * the caller (H-1), or here when the staging fails.
 */
async function o15StageGitTwinA(product: ProductBinding): Promise<{
  readonly staged: O15Staged;
  readonly c1: string;
}> {
  const { workspace } = await o15StageTwinA(
    product,
    "T10.7-15 (f)(ii) (A)'s git twin",
  );
  try {
    await workspace.gitInit();
    const c1 = await workspace.gitCommitAll(
      "c1: (A)'s twin, built, its audit session a created",
    );
    return {
      staged: {
        label: "(A)'s git twin",
        workspace,
        snapshot: await snapshotDirectory(workspace.root),
      },
      c1,
    };
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/** (f)(ii)'s invocations, in TEST-SPEC's order; `c1` the twin's commit. */
function o15AheadCalls(c1: string): readonly O15AheadCall[] {
  const unresolvable =
    "a given baseline that cannot be resolved fails per 6.3 as a usage " +
    "error, ahead of the gate and so ahead of the examination of the " +
    "session directory (SPEC 6.3, 10.7, 12.0)";
  return [
    {
      what:
        "an unknown profile, an argument check ahead of the gate: the plain " +
        "usage error, never the existing-name refusal's exit 1",
      state: "valid",
      argv: () => [
        "review",
        "create",
        "--coverage",
        O15_UNKNOWN_PROFILE,
        "--name",
        O15_A_SESSION,
      ],
      outcome: {
        kind: "usage",
        why:
          "an unknown profile named in the arguments is a usage error, " +
          "judged ahead of the gate and so ahead of the examination of the " +
          "session directory (SPEC 10.7, 12.0)",
      },
    },
    {
      what:
        "an unresolvable ref, the given baseline resolved ahead of the " +
        "gate: the plain usage error, never the existing-name refusal's " +
        "exit 1",
      state: "valid",
      argv: () => [
        "review",
        "create",
        "--base",
        O15_UNRESOLVABLE_REF,
        "--name",
        O15_A_SESSION,
      ],
      outcome: { kind: "usage", why: unresolvable },
    },
    {
      what:
        "a journal error, met by the given baseline's resolution ahead of " +
        "the gate: `journal-error`, never the existing-name refusal's exit 1",
      state: "journal",
      argv: () => ["review", "create", "--base", c1, "--name", O15_A_SESSION],
      outcome: { kind: "journal-error" },
    },
    {
      what:
        "an unresolvable ref on stale graph data: the plain usage error, " +
        "graph data never refreshed before the given baseline's resolution",
      state: "stale",
      argv: () => [
        "review",
        "create",
        "--base",
        O15_UNRESOLVABLE_REF,
        "--name",
        O15_A_SESSION,
      ],
      outcome: { kind: "usage", why: unresolvable },
    },
  ];
}

/**
 * T6.3-6(a)'s staging on a copy of (A)'s git twin: T6.1-3's garbage line
 * appended, as its own line, to the current journal. The twin made no
 * journaled operation, so its journal path holds nothing — an empty journal
 * (SPEC 6.1) — and the append brings the file into existence holding the
 * line; a plain file there gets the line after its last, terminated first.
 * Any other occupant fails the staging, diagnosed (SPEC 6.1, 13.4: the
 * journal is a plain file written only by `rename` and `move`).
 */
async function o15AppendJournalGarbage(
  copy: TestWorkspace,
  context: string,
): Promise<void> {
  const kind = await copy.kind(JOURNAL_PATH);
  if (kind === "absent") {
    await copy.file(JOURNAL_PATH, `${O15_JOURNAL_GARBAGE}\n`);
    return;
  }
  if (kind !== "file") {
    fail(
      `${context} staging premise: the journal path ${JOURNAL_PATH} holds ` +
        `a plain file or nothing — the journal is a plain file, written ` +
        `only by \`rename\` and \`move\` (SPEC 6.1, 13.4); found ${kind}`,
    );
  }
  const journal = Buffer.from(await copy.readBytes(JOURNAL_PATH));
  const needsTerminator =
    journal.length > 0 && journal[journal.length - 1] !== 0x0a;
  await copy.file(
    JOURNAL_PATH,
    Buffer.concat([
      journal,
      Buffer.from(
        `${needsTerminator ? "\n" : ""}${O15_JOURNAL_GARBAGE}\n`,
        "utf8",
      ),
    ]),
  );
}

/**
 * (f)(ii) on one invocation: on its own copy of (A)'s git twin, its state
 * staged on the copy — the garbage line appended (`journal`), u's text
 * edited, no rebuild and no read since (`stale`) — the outcome, nothing
 * modified around it (`.git` included), and on the stale state `check`
 * afterwards still reporting the graph-data unit form beside the edited
 * source's per-file staleness, nothing else (`o15AssertStillStale`).
 */
async function o15AheadArm(
  product: ProductBinding,
  twin: O15Staged,
  call: O15AheadCall,
  ids: O15Ids,
): Promise<void> {
  const context =
    `T10.7-15 (f)(ii) on ${O15_AHEAD_STATE_LABELS[call.state]} ` +
    `[\`${call.argv(ids).join(" ")}\`: ${call.what}]`;
  await withO15Copy(twin, async (copy) => {
    if (call.state === "journal") {
      await o15AppendJournalGarbage(copy, context);
    } else if (call.state === "stale") {
      await copy.file(O15_A_FILE, O15_A_U_EDITED);
    }
    const before = await snapshotDirectory(copy.root);
    await o15AssertOutcome(
      product,
      copy,
      call,
      ids,
      (jsonArgv) => runCli(product, copy, jsonArgv),
      context,
    );
    o15AssertNothingModified(
      before,
      await snapshotDirectory(copy.root),
      context,
      call.state === "stale" ? "stale" : "fresh",
    );
    if (call.state !== "stale") return;
    const checkContext = `${context} \`check --json\` afterwards`;
    o15AssertStillStale(
      await runFindingsReport(
        product,
        copy,
        ["check", "--json"],
        1,
        `${checkContext} — graph data and the edited source's generated ` +
          `module are stale, so \`check\` exits 1 (SPEC 12.2, 14.10)`,
      ),
      O15_A_FILE,
      {},
      checkContext,
    );
  });
}

const T10_7_15 = defineProductTest({
  id: "T10.7-15",
  title:
    "outcome order past the gate — arms (a)–(g), each invocation run on its own byte copy of its state, or on a twin of its own: fixture (A), specs/A.mdx holding top-level P with P.c, Q with Q.r, and the leaves s and u, an audit session `a` created and Q's item split, a second session `x` made corrupt by garbage bytes, and u's text then edited with no rebuild and no read since; fixture (B), a git workspace whose specs/B.mdx holds G with G.N and the leaf v, G.N edited after `c1`, `review create --base c1 --name b`, the repository then removed, and v's text edited likewise. (a) `resolve a <P's item> --status no-change` (blocked by P.c's unresolved item), `split a <Q's parent-consistency item>`, and `split a <s's item>` (no children) each exit 1 with one code-less refusal in T10.7-14's form; `resolve a <unknown-id> --status no-change`, `show a <unknown-id>`, and `split a <unknown-id>` each exit 2 with the plain usage error, `code` and `path` `null`; `status x` and `resolve x <id> --status updated` each exit 1 with exactly the condition-21 finding concerning `.xspec/reviews/x.json`; and `status b` exits 2 with the baseline's plain usage error — each modifying nothing, graph data (T13.3-2's operational path set) byte-identical, and `check` afterwards still reporting the graph-data unit form beside the edited source's per-file staleness (and x's 14.21), where a product refreshing before it reaches the outcome leaves graph data refreshed; (b) on the Linux leg, the same invocations with the graph-data area also staged unwritable by T14-9's graph-data staging — before a read's invocation, and for `resolve` and `split` while each is held at the seam of 13.5, after acquisition — each report exactly their (a) outcome, never `write-failure`, release's refused deletions changing no outcome; (c) on freshly built twins of (A), each holding its own unsplit audit session `a` and edited by hand with no rebuild and no read before the invocation, graph judgements are made against the current workspace: (i) with P.c's item resolved `no-change` and P.c's text then edited, `resolve a <P's item> --status no-change` is refused at once in T10.7-14's form, nothing modified, where a product judging the blocked state from stale graph data resolves it; (ii) with Q.r's section deleted, `split a <Q's item>` is refused, nothing modified; (iii) with a child s.t authored under the leaf s, `split a <s's item>` exits 0, `check` afterwards reporting the edited source's per-file staleness and no graph-data unit form — graph data refreshed before the session write — and the session gains exactly s.t's subtree-coherence item and s's parent-consistency item, its context exactly {s.t} and its blockedBy exactly s.t's item; (d) on (B)'s state with no section edited since `create`, `resolve b <G's parent-consistency item> --status no-change` (a blocked item) and `split b <G's parent-consistency item>` (an item of another kind) each exit 2 with the baseline's plain usage error, `code` and `path` `null`, never a refusal's exit 1; with b's file corrupted by T10.1-4's `blockedBy`-cycle staging, `status b`, `resolve b <G.N's item> --status no-change`, and `split b <G's parent-consistency item>` each exit 1 with exactly the condition-21 finding concerning `.xspec/reviews/b.json`, never the baseline's exit 2; and with specs/B.mdx given a section with no id, `status`, `next`, `show`, `export`, `resolve`, and `split` naming b each report exactly the gate's findings — `build`'s one condition-1 finding — exit 1, never the baseline's exit 2; each modifying nothing; the unknown item ID's place before the recorded baseline admits no discriminating staging and is not asserted; (e) on (A)'s stale state `review list` reports x corrupt beside a — exactly x's condition-21 finding — exit 1, graph data refreshed (`check` afterwards reporting no graph-data unit form beside the edited source's per-file staleness and x's 14.21), where a product letting the corruption end `list` leaves graph data stale, and, on the Linux leg, with the graph-data area also staged unwritable by T14-9's graph-data staging it exits 2, `code` `write-failure`, `path` `.xspec`, standard output exactly that error document, and with `.xspec/reviews` staged unlistable instead (T14-10(h)'s staging) it exits 2, `code` `read-failure`, `path` `.xspec/reviews`, graph data byte-identical, where a product refreshing first leaves it refreshed; (f)(i) on (A)'s state with specs/A.mdx given a section with no id, `review create --strategy audit` naming `a` (an existing session), `x` (a corrupt one), and `A` (a ignoring ASCII case alone) each report exactly the gate's findings — `build`'s one condition-1 finding — exit 1, never the code-less refusal or a condition-21 finding; with `.xspec/reviews` a plain file `create --name n` likewise, never condition 22; and, on the Linux leg, with `.xspec/reviews` unlistable `review list` and `create --name n` likewise, never `read-failure`; (f)(ii) on a twin of (A) holding its own audit session `a` in a git repository with a commit `c1`, `review create --coverage nope --name a` and `--base nope --name a` each exit 2, `code` and `path` `null`, and, with a garbage line appended to the current journal, `create --base c1 --name a` exits 2, `code` `journal-error`, `path` `.xspec/journal`, each never the existing-name refusal's exit 1; on the twin's stale state, u's text edited, `create --base nope --name a` exits 2 likewise, `check` afterwards still reporting the graph-data unit form; (g) on (f)(i)'s failing state, `show a <unknown-id>`, `resolve a <unknown-id> --status no-change`, and `split a <unknown-id>` each report exactly the gate's findings, exit 1, never the unknown-item exit 2; each invocation of (f) and (g) modifying nothing, no session file written or changed (SPEC 6.3, 10.1, 10.3, 10.4, 10.5, 10.6, 10.7, 12.0, 13.3, 13.5, 14.1, 14.13, 14.21, 14.22, 14.24, 14.25)",
  run: async (product) => {
    const a = await o15StageFixtureA(product);
    try {
      const b = await o15StageFixtureB(product);
      try {
        const ids: O15Ids = { ...a.ids, ...b.ids };
        const stateOf = (invocation: O15Invocation): O15State =>
          invocation.fixture === "A" ? a.state : b.state;

        // (a) Stale stays stale: each outcome ends the subcommand there,
        // modifying nothing (SPEC 10.7, 13.5).
        for (const invocation of O15_STALE_INVOCATIONS) {
          await o15StaleArm(product, stateOf(invocation), invocation, ids);
        }

        // (b) The refresh write comes after them (SPEC 12.0, 14.24), staged
        // on the Linux leg (TEST-SPEC E-1).
        if (WRITE_REFUSALS_STAGED) {
          for (const invocation of O15_STALE_INVOCATIONS) {
            await o15UnwritableArm(
              product,
              stateOf(invocation),
              invocation,
              ids,
            );
          }
        }

        // (c) Graph judgements against the current workspace (SPEC 10.7,
        // 13.3), each on a freshly built twin of (A), edited by hand.
        await o15ReblockedArm(product);
        await o15ChildlessArm(product);
        await o15NewChildArm(product);

        // (d) The recorded baseline's place (SPEC 10.7, 12.0), on (B)'s
        // state as `create` left it; the gate reference is taken before the
        // first invocation on the failing source.
        let gate: readonly Finding[] | undefined;
        for (const call of O15_PLACE_CALLS) {
          if (call.state === "failing" && gate === undefined) {
            gate = await o15GateReference(product, o15PlaceFailing(b.created));
          }
          await o15PlaceArm(product, b.created, call, ids, gate);
        }

        // (e) `list`'s place (SPEC 10.7, 13.3; T13.3-2's sweep), on (A)'s
        // stale state; its two stagings on the Linux leg (TEST-SPEC E-1).
        await o15ListArm(product, a.state);

        // (f)(i) The session directory's place behind the gate (SPEC 10.7,
        // 13.3, 14.21, 14.22), on (A)'s failing state; the gate reference,
        // taken before its first invocation, serves (g) too. The unlistable
        // session directory is staged on the Linux leg (TEST-SPEC E-1).
        const failingGate = await o15GateReference(
          product,
          o15GateFailing(a.state),
        );
        for (const call of O15_SESSION_DIRECTORY_CALLS) {
          if (call.state === "reviews-unlistable" && !WRITE_REFUSALS_STAGED) {
            continue;
          }
          await o15GateArm(product, a.state, "(f)(i)", call, ids, failingGate);
        }

        // (f)(ii) The session directory behind the errors ahead of the gate
        // (SPEC 10.7, 12.0, 6.3), on (A)'s git twin.
        const twin = await o15StageGitTwinA(product);
        try {
          for (const call of o15AheadCalls(twin.c1)) {
            await o15AheadArm(product, twin.staged, call, ids);
          }
        } finally {
          await twin.staged.workspace.dispose();
        }

        // (g) The item ID's place behind the gate (SPEC 12.0, 10.7), on
        // (f)(i)'s failing state.
        for (const call of O15_ITEM_ID_CALLS) {
          await o15GateArm(product, a.state, "(g)", call, ids, failingGate);
        }
      } finally {
        try {
          await b.created.workspace.dispose();
        } finally {
          await b.state.workspace.dispose();
        }
      }
    } finally {
      await a.state.workspace.dispose();
    }
  },
});

/** TEST-SPEC §10.7, third part, in canonical ID order. */
export const section107iiiTests: readonly ProductTestEntry[] = [
  T10_7_13,
  T10_7_14,
  T10_7_15,
];
