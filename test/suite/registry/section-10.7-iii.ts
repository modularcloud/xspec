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
// of the gate of 13.3 the errors 12.0 orders before it; past it, the
// session read (meeting the named session's corruption, 10.1, 14.21), an
// unknown item ID (12.0), the recorded baseline (6.3), and the refusals —
// `resolve`'s of a blocked item, `split`'s of an item of another kind or of
// one whose scope root has no children. Each of these outcomes but `list`'s
// corruptions ends the subcommand there, modifying nothing (13.5): stale
// graph data stays stale. Only past all of them does a subcommand write —
// the refresh of 13.3, then a mutating subcommand's session file — a read
// subcommand answering only then (SPEC 12.0, 14.24: a write failure is met
// only at the write it refuses, a refresh's too).
//
// Conservative operationalizations for T10.7-15 (noted per H-3/H-4):
// - Arms (a) and (b) are staged; arms (c)–(g) are not yet (the plan's
//   Tasks 88–89 add them to this body, on twins of the fixtures below).
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
//   git (a premise).
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
// - Staged-source records (S-9): both fixtures' sources and configuration —
//   records, so the twins that arms (c)–(g) will create after an invocation
//   stage the same bytes — and the three edits; T10.1-4's garbage bytes and
//   the hold file are no sources.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
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
  decodeSessionStatusReport,
  isGraphDataKey,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
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
  assertPlainUsageError,
  assertSameJson,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectReviewRefusal,
  runCli,
  runFindingsReport,
  runJson,
} from "./support.js";
import {
  WRITE_FAILURE_CODE,
  WRITE_REFUSALS_STAGED,
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
// body's first invocation, as are the twins of (A) that arms (c)–(g) will
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
const O15_S = "specs/A.mdx#s";

/** Fixture (A)'s audit session, and the second session, made corrupt. */
const O15_A_SESSION = "a";
const O15_A_SESSION_REL = `.xspec/reviews/${O15_A_SESSION}.json`;
const O15_X_SESSION = "x";
const O15_X_SESSION_REL = `.xspec/reviews/${O15_X_SESSION}.json`;

/** specs/A.mdx; `uEdited` gives u its edited text (the staleness edit). */
function o15ASpec(edits: { readonly uEdited?: boolean } = {}): string {
  return [
    '<S id="P">',
    "Pee own text.",
    "",
    '<S id="P.c">',
    "Pee cee text.",
    "</S>",
    "</S>",
    "",
    '<S id="Q">',
    "Queue own text.",
    "",
    '<S id="Q.r">',
    "Queue are text.",
    "</S>",
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    "",
    '<S id="u">',
    edits.uEdited === true ? "You text, edited." : "You text.",
    "</S>",
    "",
  ].join("\n");
}

// Staged-source records (helpers/staged-mdx.ts, S-9): (A)'s initial source
// serves its first workspace and the twins that arms (c)–(g) will create
// after an invocation; the staleness edit follows the body's first
// invocation.
const O15_A_INITIAL = stagedMdx(
  "T10.7-15 specs/A.mdx — fixture (A): top-level P holding P.c, Q holding Q.r, and the leaves s and u",
  o15ASpec(),
);
const O15_A_U_EDITED = stagedMdx(
  "T10.7-15 specs/A.mdx with u's text edited — fixture (A)'s staleness edit",
  o15ASpec({ uEdited: true }),
);

// Fixture (B): specs/B.mdx — top-level G holding G.N, and the leaf v.
const O15_B_FILE = "specs/B.mdx";
const O15_G = "specs/B.mdx#G";
const O15_GN = "specs/B.mdx#G.N";

/** Fixture (B)'s baseline session. */
const O15_B_SESSION = "b";

/** specs/B.mdx; G.N's text edited after `c1`, then v's (the staleness edit). */
function o15BSpec(
  edits: { readonly gnEdited?: boolean; readonly vEdited?: boolean } = {},
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
  ].join("\n");
}

// Fixture (B)'s workspace is created after the body's first invocation, so
// its initial source and both its edits are staged-source records (S-9).
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
 * One fixture's stale state (TEST-SPEC T10.7-15): staged once and never
 * invoked on again — each invocation runs on its own byte copy of it.
 */
interface O15State {
  /** `(A)` or `(B)`, for diagnoses. */
  readonly label: string;
  readonly workspace: TestWorkspace;
  /** The state's bytes as staged; each copy is checked against them. */
  readonly snapshot: DirectorySnapshot;
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
 * since, so graph data is stale (13.3).
 */
async function o15StageFixtureB(product: ProductBinding): Promise<{
  readonly state: O15State;
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
      ids: { gnSc: gnRow.id, gPc: gRow.id },
    };
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/**
 * Run `body` on a fresh byte copy of a stale state (helpers/tree-copy.ts
 * `copyTreeBytes`: every entry of its root — neither fixture holds `.git`
 * or a lock path), checked against the state's snapshot before anything
 * runs there (a difference is a harness error, never a product verdict);
 * the copy is disposed whatever happens (H-1). SPEC 13.3 judges staleness
 * by content alone, so the copy's graph data is as stale as the state's.
 */
async function withO15Copy(
  state: O15State,
  body: (copy: TestWorkspace) => Promise<void>,
): Promise<void> {
  const copy = await TestWorkspace.create();
  try {
    await copyTreeBytes(
      Buffer.from(state.workspace.root),
      Buffer.from(copy.root),
    );
    const differences = diffSnapshots(
      state.snapshot,
      await snapshotDirectory(copy.root),
    );
    if (differences.length > 0) {
      throw new Error(
        `harness error: T10.7-15's copy of fixture ${state.label}'s state ` +
          `${state.workspace.root} at ${copy.root} differs from it: ` +
          differences
            .slice(0, 10)
            .map((change) => `${change.change} ${change.path}`)
            .join(", "),
      );
    }
    await body(copy);
  } finally {
    await copy.dispose();
  }
}

/** The outcome an invocation meets past the gate (SPEC 10.7). */
type O15Outcome =
  /** A refusal in T10.7-14's form, the session file it names byte-identical. */
  | { readonly kind: "refusal"; readonly sessionRel: string }
  /** An unknown item ID: the plain usage error (12.0). */
  | { readonly kind: "unknown-item" }
  /** The named session's corruption: exactly the condition-21 finding. */
  | { readonly kind: "corrupt"; readonly sessionRel: string }
  /** The recorded baseline, irreconstructible: the plain usage error (6.3). */
  | { readonly kind: "baseline" };

/** One of (a)'s invocations, run again under (b)'s staging. */
interface O15Invocation {
  /** Why the outcome is met, for diagnoses. */
  readonly what: string;
  /** The fixture whose stale state it runs on. */
  readonly fixture: "A" | "B";
  /** The command, without `--json` (each run appends it). */
  readonly argv: (ids: O15Ids) => readonly string[];
  /** `resolve` and `split`, held at the seam of 13.5 under (b)'s staging. */
  readonly mutating: boolean;
  readonly outcome: O15Outcome;
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
  const findings = decodeFindingsReport(
    parseJsonStdout(result, label),
    label,
  ).findings;
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
 * Run an invocation through `run` and assert the outcome it meets (SPEC
 * 10.7): a refusal through T10.7-14's shared check (support.ts
 * `expectReviewRefusal`), the unknown item ID and the irreconstructible
 * baseline as the plain usage error (`assertPlainUsageError`), and the
 * corruption as exactly the condition-21 finding.
 */
async function o15AssertOutcome(
  product: ProductBinding,
  copy: TestWorkspace,
  invocation: O15Invocation,
  ids: O15Ids,
  run: O15Run,
  context: string,
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
  assertPlainUsageError(
    result,
    outcome.kind === "unknown-item"
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
 * run — graph data byte-identical and so still stale — each change
 * diagnosed by where it falls (`o15ChangeClass`).
 */
function o15AssertNothingModified(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  context: string,
): void {
  const changes = diffSnapshots(before, after);
  if (changes.length === 0) return;
  const refreshed = changes.some((change) => isGraphDataKey(change.key));
  fail(
    `${context}: the outcome ends the subcommand there, modifying nothing ` +
      `— only past every outcome does a subcommand write, the refresh of ` +
      `13.3 first — so graph data (T13.3-2's operational path set) stays ` +
      `byte-identical and still stale (SPEC 10.7, 13.5, 13.3)` +
      (refreshed
        ? ` — graph data changed: a product refreshing before it reaches ` +
          `the outcome leaves graph data refreshed`
        : "") +
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
 * `check`'s report once an invocation has left the stale state as it found
 * it (SPEC 13.3, 14.10): graph data is still stale, so exactly one
 * condition-10 finding is the graph-data unit form — concerned path the
 * area `.xspec`, no path inside it named, locations [] — where a product
 * refreshing before it reaches the outcome leaves no unit form reported.
 * Every other condition-10 finding is per file, concerning a derived path
 * of the edited source — its path with `.mdx` replaced by `.xspec.` plus a
 * suffix (SPEC 13.1) — with its module among them (it embeds the edited
 * text, SPEC 4.2), locations []; every one, the unit form included,
 * instructs rebuilding (`assertFindingInstructsRebuilding`, SPEC 14.10: a
 * text edit leaves no recorded file obstructing a rebuild write). Beside
 * the staleness, exactly the state's other findings (x's 14.21 on (A),
 * T10.1-4: `check` reports a corrupt session) and nothing else.
 */
function o15AssertStillStale(
  findings: readonly Finding[],
  state: O15State,
  context: string,
): void {
  const derivedPrefix = state.editedSource.replace(/\.mdx$/, ".xspec.");
  const module = `${derivedPrefix}ts`;
  assertConditionCounts(
    findings.filter((finding) => finding.condition !== "14.10"),
    state.besideStaleness,
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
  const perFile = stale.filter((finding) => finding !== unitForm);
  for (const finding of perFile) {
    if (
      typeof finding.path !== "string" ||
      !finding.path.startsWith(derivedPrefix)
    ) {
      fail(
        `${context}: beside the graph-data unit form every condition-10 ` +
          `finding is per file, concerning a derived path of the edited ` +
          `source ${state.editedSource} — ${derivedPrefix}* (SPEC 13.1, ` +
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
        `edited text (SPEC 4.2, 13.1) — so a condition-10 finding concerns ` +
        `it beside the unit form (SPEC 14.10); got ` +
        JSON.stringify(stale.map((finding) => renderPathValue(finding.path))),
    );
  }
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
      state,
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

const T10_7_15 = defineProductTest({
  id: "T10.7-15",
  title:
    "outcome order past the gate — arms (a) and (b), each invocation run on its own byte copy of a stale state: fixture (A), specs/A.mdx holding top-level P with P.c, Q with Q.r, and the leaves s and u, an audit session `a` created and Q's item split, a second session `x` made corrupt by garbage bytes, and u's text then edited with no rebuild and no read since; fixture (B), a git workspace whose specs/B.mdx holds G with G.N and the leaf v, G.N edited after `c1`, `review create --base c1 --name b`, the repository then removed, and v's text edited likewise. (a) `resolve a <P's item> --status no-change` (blocked by P.c's unresolved item), `split a <Q's parent-consistency item>`, and `split a <s's item>` (no children) each exit 1 with one code-less refusal in T10.7-14's form; `resolve a <unknown-id> --status no-change`, `show a <unknown-id>`, and `split a <unknown-id>` each exit 2 with the plain usage error, `code` and `path` `null`; `status x` and `resolve x <id> --status updated` each exit 1 with exactly the condition-21 finding concerning `.xspec/reviews/x.json`; and `status b` exits 2 with the baseline's plain usage error — each modifying nothing, graph data (T13.3-2's operational path set) byte-identical, and `check` afterwards still reporting the graph-data unit form beside the edited source's per-file staleness (and x's 14.21), where a product refreshing before it reaches the outcome leaves graph data refreshed; (b) on the Linux leg, the same invocations with the graph-data area also staged unwritable by T14-9's graph-data staging — before a read's invocation, and for `resolve` and `split` while each is held at the seam of 13.5, after acquisition — each report exactly their (a) outcome, never `write-failure`, release's refused deletions changing no outcome; arms (c)–(g) are not yet staged (SPEC 6.3, 10.1, 10.3, 10.5, 10.6, 10.7, 12.0, 13.3, 13.5, 14.21, 14.24)",
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
      } finally {
        await b.state.workspace.dispose();
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
