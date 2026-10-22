// TEST-SPEC §10.7 (review commands), second half — SUITE-39:
// T10.7-7…T10.7-12 (`next`; `show`/`export`; `split`; `resolve`; coverage
// re-derivation; the payload text contract). T10.7-1…T10.7-6 are SUITE-38's
// business (section-10.7-i.ts).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.7: `next` returns the first needing-review unblocked item in item
// order; a session whose items are all resolved (or that has none) reports
// fully resolved in human and `--json` forms, exit 0, with no item in the
// JSON payload, and the `--json` payload is self-contained — every scope,
// context, and origin node under its current identity and presence, source
// ranges for present nodes (requirement node and code location alike; an
// absent node carries none), the recorded `baseline` and `current`
// hashes, and text per item kind. `show` reports the full item (the 10.2
// fields plus the same payload); `export` emits the whole session as one JSON
// document, with or without `--json`, read-time invalidation applied. `split`
// decomposes a `subtree-coherence` item with children — in a baseline
// session, deleted ones included; in an audit session, the current ones
// alone — into per-child `subtree-coherence` items (a per-child item
// already recorded as decomposed replaced by its decomposition,
// recursively) plus the scope root's `parent-consistency` item, reusing
// existing kind+scope items, recording the decomposition durably, never
// reusing the removed original's id, and ending with a re-derivation.
// `resolve` sets the status, sets the note to the `--note` text — removing
// any earlier note when `--note` is not given — and records the current
// relevant state, on any unblocked item regardless of status (T10.7-10).
// Re-derivation on an `updated` resolve holds for every strategy — a
// coverage session re-runs its recorded profile against the current
// workspace, a generated item matching an existing kind and scope node
// keeping its id, status, note, and recorded state (T10.7-11). The payload
// text contract (T10.7-12) fixes which text each kind presents and the
// provenance of absent nodes' texts.
//
// Conservative operationalizations (noted per H-3/H-4):
// - The human fully-resolved report (T10.7-7) is asserted for information
//   presence via /resolv/i: SPEC fixes the fact reported ("fully resolved"),
//   never wording — any phrasing reporting resolution qualifies (H-3).
// - T10.7-7's full-resolution arm (SPEC 10.7: full resolution concerns the
//   session's items alone — a change that would generate a new item enters
//   the session only at its next re-derivation, 10.5) continues on the
//   order arm's workspace once that arm has resolved every item, none
//   `updated`, so nothing has re-derived the session: specs/U.mdx, holding
//   the one section u, is added and built — a file of its own, touching no
//   existing item's recorded state or context set (each audit item's scope
//   and ancestor-chain context lie in its own file's tree, SPEC 10.6),
//   while a re-derivation would generate items for its root and its section
//   (one per requirement node, roots included) — and `next` must still
//   report the session fully resolved in both forms, no item in the JSON
//   payload. Then p.a's item, resolved `no-change`, is re-resolved
//   `updated`, which re-derives the session (10.5): `next --json` must
//   return the new section's item (`subtree-coherence`, scope u),
//   `unresolved` (10.2), and `review status s --json` at the same state must
//   show it the first unblocked item needing review — its row present once,
//   unblocked and needing review, and every row before it in item order
//   resolved or blocked (the new root's item, `unresolved`, precedes it,
//   blocked by it, 10.6) — a product-to-itself comparison of `next` against
//   `status` (H-4; `assertFirstUnblockedNeedingReview`). The rows are not
//   pinned further: the re-derivation's other effects are T10.6-3's.
// - T10.7-7's payload clause naming a `metadata-consistency` item's
//   metadata pair points to T10.7-13 (section-10.7-iii.ts), whose `next`
//   walk asserts the pair; the payload arm stages no such item (a.k's text
//   edit alone: its walk meets a.k's `subtree-coherence`, a's
//   `parent-consistency`, and the code-impact items), and the review
//   adapter decodes the pair on every `next --json` item of that kind
//   (helpers/adapters/review.ts).
// - T10.7-7's human `next` (T12.0-1's information parity; SPEC 12.0: the
//   JSON form carries the same information as the human report): after
//   each of the nine `next --json` reads that return an item — the order
//   arm's four (p.a's, p.b's, p's, then the root's item), the
//   full-resolution arm's one (the new section's item), and the payload
//   arm's four (a.k's, a's, the code location's, and that item again after
//   the code file's deletion) — and their assertions, at the same state,
//   `review next s` without `--json` exits 0 as well, and its report names
//   the returned item by its id (a product-to-itself comparison, H-4;
//   `assertHumanNextItem`, through helpers/adapters/human.ts: an item-id
//   boundary, so `item-1` never counts inside `item-10`). Limits: the human
//   `next` is asked only to identify its item — SPEC 10.7 requires the
//   self-contained payload of `next --json` alone ("With `--json`, the
//   payload MUST be self-contained"), and `show` reports the full item in
//   both forms (T10.7-8) — so its kind, scope, status, and payload are not
//   asserted there; no mention is associated with another, so the id
//   counts wherever the report prints it — in another item's `blockedBy`
//   too (the root's blocked item lists p's item there) — and which item the
//   report presents as the one returned stays with the JSON assertions; an
//   id that is itself a whole number may be matched by any number of its
//   value the report prints.
// - T10.7-8's and T10.7-12's human `show` (T12.0-1's information parity; SPEC
//   12.0): after each `show --json` read and its assertions — T10.7-8's x.k
//   item (the item `next` returns) and the root's item, blocked by x's (a
//   `show --json` read this check adds, asserted against SPEC 10.6's
//   blocking), and T10.7-12's per-item reads of its matrix, split, and
//   coverage sessions, its read of x's item in the joined-origin
//   sub-fixture, sub-fixture B's three provenance reads at each stage, and
//   its read of N's item in the resolve-state sub-fixture — at the same state,
//   `review show <name> <item-id>` without `--json` exits 0 as well, and its
//   report mentions what the decoded item carries (a product-to-itself
//   comparison, H-4; `assertHumanShowItem`, through
//   helpers/adapters/human.ts): the item's id and each `blockedBy` id
//   (item-id boundaries), its kind and status, `blocked` where it is blocked,
//   and `absent` wherever it presents a node or an origin side absent
//   (SPEC-named tokens; 10.7: "presented absent"), its scope, context, and
//   origin identities (identity boundaries), every non-blank line of every
//   text it carries — scope, context, and origin before and after — and of
//   its note (trimmed), and, where the test supplies `query node` captures
//   (T10.7-8's x.k item, captured at that state), each captured hash its
//   `baseline` or `current` holds as a string leaf; then, in a separate call,
//   the start and end of every source range it carries (whole numbers,
//   matched with the item's digit-holding data blanked out — ids, identities,
//   text and note lines, the `reason`, and the recorded states' string leaves
//   and member names — save a datum that is itself a whole number,
//   `digitHoldingData` from section-10.7-i.ts). The `reason` is free text,
//   never compared (H-3): it is only blanked, so its digits (a `SPEC 10.6`
//   citation) never stand in for an offset. Limits: no mention is associated
//   with another, so which text, range, or presence belongs to which payload
//   node, and to which side of an origin pair, stays with the JSON
//   assertions, as do which recorded state holds a hash and whether the item
//   is blocked (a report may spell `blocked` for an unblocked item: the built
//   product prints `blocked: false`); a text line counts wherever the report
//   prints it — a node's own text recurs in its ancestors' subtree texts, and
//   a short line (the embedding's trailing `line.`) inside a longer one — and
//   an identity in the `reason` too; recorded hashes are asked only where
//   captured, since `baseline` and `current` are product-shaped (H-4); a
//   `reason` the report rewords is not blanked, so its digits may then stand
//   in for an offset; and a datum that is itself a whole number stays
//   unblanked, so it and an offset of its value may stand in for each other.
// - Payload texts are byte-compared against `query node` captures taken at
//   the pinned graph states (own/subtree text per SPEC 1.6, source ranges per
//   1.7 — the same values T11-1 fixes for `query node`), with distinctness
//   premises asserted first so every discrimination (own vs subtree text,
//   baseline vs create-time vs current values) is meaningful. A code
//   location is no `query node` operand, so each present code-impact scope's
//   range — review payloads are one of the two range-presenting outputs for
//   code locations (SPEC 1.7) — is asserted against precomputed byte offsets
//   of the staged named unit's construct (SPEC 1.7, 4.6): refUnit's function
//   declaration, and T10.7-12's two property members C.m and C.n, each run
//   through the `;` ending it and C.n's from its decorator's `@` (the T1.7-2
//   forms). Embedding expansion is additionally pinned with byte literals:
//   the asserted text must contain the embedded target's authored text and
//   must not contain the unexpanded `text(` spelling (SPEC 1.6, 2.3).
// - T10.7-12's sub-fixtures beyond the matrix, each on a workspace of its
//   own. The split sub-fixture (specs/S.mdx) reads the split's
//   parent-consistency item from `export` — its scope's own text, and its
//   context exactly sp's two unedited children, each with its subtree text —
//   then `show` per item and a `next` walk. The joined-origin sub-fixture
//   stages T10.4-7(a)'s fixture through section-10.4.ts' exported stagings
//   (`stageT1047Session`, `stageT1047State`, and the record
//   `T10_7_12_D2_V2`), loaded with a dynamic `import()` when the arm runs:
//   section-10.4.ts imports this module at load (T10.4-8's stagings over
//   T10.7-9's), so a static import back would close a module cycle, in which
//   the module loaded second would read the other's constants before they
//   exist. d2's baseline own text is captured right after `create`
//   (specs/D2.mdx untouched since the baseline commit: the staging's
//   ownHash premise), its join-time text after its first edit, its current
//   text after the second. x's item, resolved by then — and the second edit
//   moves no hash it records (SPEC 10.4), so `next` has no item to return —
//   is read through `show` and `export`. Sub-fixture B (specs/B.mdx: A
//   holding A.K1, dm, yq holding yq.y) reads A.K1's item, A's
//   parent-consistency item, and dm's item through `show` and `export` after
//   A.K1's deletion and again after A.K1's own `updated` resolve, whose
//   re-derivation's item set — A.K1's item and A's parent-consistency item
//   kept under their ids, A's new subtree-coherence item beside them — is a
//   premise read from `status`. The resolve-state sub-fixture (specs/N.mdx)
//   reads N's item through `show` and `export` once N's section is deleted.
// - `context` and `origin` are compared as identity-keyed sets (SPEC 10.7
//   fixes their membership, not a payload order); each entry's presence,
//   text, and source range are then asserted per node.
// - "Texts byte-asserted in `next --json` and identically via `show` and
//   `export` (one payload rule)": `export` is the reference read; `show` of
//   every item and a full `next` walk (repeated `next --json` + `resolve
//   --status no-change`, which never re-derives) must present the identical
//   {scope, context, origin} payload projection per item id.
// - `blockedBy` is compared as a sorted id set (SPEC 10.5/10.7 fix which
//   items block, not an order within the field).
// - An item's note (SPEC 10.2: optional) is read from `show --json` and
//   `export --json` alike (`assertPresentedNote`): T10.7-10's three resolves
//   of p.a's item — `--note`, a second `--note` with the status unchanged,
//   and the flip to `skipped` without one — and T10.7-11's k3 item after
//   the re-derivation. No note is the `note` member absent or `null` (the
//   review adapter's reading of an absent optional member); an empty string
//   is a note of its own, never none.
// - Recorded state (`baseline`/`current`) and creation parameters are
//   product-shaped and opaque (H-4): hash recording is asserted by
//   string-leaf containment of `query node` captures at the expected moment
//   (with pairwise-distinct premises and negative arms), and "state kept" as
//   canonical-JSON equality of the reported member across the operation (the
//   §10.2/§10.6 style). The recorded decompositions are decoded by the
//   adapter to each one's kind and scope node (review.ts), and the recorded
//   decomposition is asserted by the decomposed item's spec-fixed scope-node
//   identity among their scope nodes.
// - T10.7-9's arms: the path-blocks fixture (specs/N.mdx) carries (a)–(c),
//   asserted from `export` (and (c)'s item order from `status` as well) —
//   its premise reads N's item from `status` by kind and scope root alone,
//   the scope set {N, N.a, N.b} (10.5's) deciding nothing there — then the
//   two refusals beside its successful split — N's parent-consistency
//   item, of another kind, and N.a's leaf item — and a later `updated`
//   resolve re-deriving the session. The audit fixture (specs/N.mdx in a
//   workspace of its own; `runT1079AuditSplits`, exported with its source
//   and identities for T10.4-8(b)) carries the audit halves of (a)–(e),
//   asserted from `export` — (c)'s item order from `status` as well, (e)'s
//   stored status from `list`, (e)'s scope set through the review
//   adapter's `requireScopeNodes`, and (e)'s `current` byte for byte as
//   the decoded member's JSON rendering, member order included (T10.5-5's
//   operationalization) — then two refusals beside its successful splits
//   — N's parent-consistency item, of another kind, and s's leaf item —
//   and a later `updated` resolve (N.a.x's item) re-deriving the session;
//   the third audit refusal, Q's item once its only child Q.r is deleted
//   by manual edit after `create`, runs in an audit session of its own
//   (specs/Q.mdx). (f) runs on a workspace of its own (specs/P.mdx;
//   `runT1079DeletedChildrenArm`, exported with its source and identities
//   for T10.4-8(c)): P's scope before the split is read through the review
//   adapter's `requireScopeNodes` (section-10.5.ts' `assertScopePresence`),
//   a per-child item's absent scope root from its `scope` member; the texts
//   are byte-compared to `query node` captures — P.a's and P.b's subtree
//   texts at the baseline, P's own and subtree texts after the deletion —
//   and the recorded hashes and absent markers read through
//   `decodeRecordedState` against the post-deletion capture. (g) runs the
//   nested twin (specs/G.mdx) on a workspace of its own, every blockedBy
//   read from `export` and the blocked state from `status`.
// - A refused `split`/`resolve` (T10.7-9, T10.7-10) goes through T10.7-14's
//   shared check (support.ts `expectReviewRefusal`): run with `--json`, exit
//   1 with standard output exactly one code-less finding — `code` and `path`
//   `null`, `locations` `[]` (SPEC 14, 12.7), `identities` informational
//   and unasserted — and nothing modified: the session file and the whole
//   workspace root, `.git/` included, byte-identical around the run (SPEC
//   10.7, 13.5: a refusal ends its subcommand modifying nothing; the
//   preamble: no git write).
// - Workspaces are git-less wherever no baseline is involved; every fixture
//   edit is followed by an explicit `build` before any read, so no read
//   relies on the 13.3 refresh path (T13.3-*'s business).
// - Staged-source records (helpers/staged-mdx.ts, S-9: judged before any
//   product exists): every `.mdx` edit or addition a body stages after its
//   first product invocation — T10.7-7's payload-arm edit and its
//   full-resolution arm's added specs/U.mdx, T10.7-8's x.k edit, T10.7-9's
//   M.k edit in the path-blocks fixture, the deletion of P's children in
//   (f), the nested twin's two edits in (g), the audit fixture's authoring
//   of N.c, N.c.y, and N.b.z, and Q.r's deletion, T10.7-10's p.a edit,
//   T10.7-11's edge swap, T10.7-12's A.mdx v1/v2, S.mdx, B.mdx v1/v2, and
//   N.mdx v1/v2 edits and N's deletion, and the second d2 edit it stages
//   over T10.4-7(a)'s fixture (`T10_7_12_D2_V2`, made in section-10.4.ts
//   beside d2's template, since this module loads that one only at run
//   time) — is a record created at module level (a converted staging's the
//   same template call moved there), as is the initial `.mdx` file of every
//   workspace created after the body's first invocation (T10.7-7's
//   payload arm, T10.7-9's (f), (g), audit-fixture, and Q workspaces,
//   T10.7-12's split, provenance, resolve-state, and coverage sub-fixtures,
//   and its joined-origin sub-fixture's, T10.4-7's exported records;
//   T10.7-7's empty-session arm stages none). T10.7-9's path-blocks edit of
//   N and N.a precedes the body's first `build` (git staging invokes no
//   product) and stays plain, as do each body's first workspace's initial
//   `files` entries (T10.7-12's src/members.ts among them, judged
//   well-formed by the workspace builder) — but T10.7-7's order-arm
//   specs/T.mdx and T10.7-8's specs/X.mdx, records too
//   (`T10_7_7_T_INITIAL`, `T10_7_8_X_KAY_V0`): T12.0-15 runs those
//   stagings after its own body's first invocation (S-9's timing clause),
//   and every record its stagings stage names it.
// - T10.7-7's and T10.7-8's stagings are exported for T12.0-15
//   (section-12.0-iv.ts), as section-10.7-i.ts exports T10.7-5's and
//   T10.7-6's: `runT1077Reads(product, visit, prefix?)` hands each
//   `review next s` read of T10.7-7's arms to `visit(workspace, read)` —
//   `read.home` the home test's own read with its assertions and the human
//   parity check, over the staging's own read where the staging needs the
//   item it returns (the payload walk's, whose items it resolves), over a
//   read of its own elsewhere — and `runT1078ShowReads(product, visit,
//   prefix?, rest?)` each `review show s <item>` read of T10.7-8 (x.k's
//   item, whose id the staging's own `next --json` read yields, and the
//   root's), `rest` T10.7-8's continuation on the same workspace — the
//   split, `export`, the unknown item IDs, and the invalidation — which
//   T12.0-15 leaves out. T10.7-7 and T10.7-8 pass `read.home` through, so
//   their own assertions run as before; T12.0-15 hands its human twins in
//   their place. Staging premises (the order arm's item order, the empty
//   session's emptiness, the payload arm's distinctness premises, the ids
//   `status` yields) stay in the stagings.
// - TypeScript staged-source records (helpers/staged-ts.ts; S-9's TypeScript
//   and timing clauses), every one well-formed: the configurations of the
//   workspaces created after a body's first invocation — `SPECS_ONLY_CONFIG`
//   (T10.7-7's empty-session arm, and T10.7-7's and T10.7-8's first
//   workspaces where T12.0-15 runs their stagings, T10.7-9's (f), (g),
//   audit-fixture, and Q workspaces, T10.7-12's split, joined-origin,
//   provenance, and resolve-state sub-fixtures), `SPECS_CODE_CONFIG`
//   (T10.7-7's payload arm), and `COVERAGE_ALL_CONFIG` (T10.7-12's
//   coverage sub-fixture), each staged wherever that configuration is —
//   and the code sources staged after one: T10.7-7's `src/next.ts`
//   (`N7_CODE_SOURCE`) and T10.7-12's `src/ref.ts` and `src/del.ts`
//   (`M12_CODE_SOURCE`, `M12_CODE_DEL_SOURCE`).

import * as fsp from "node:fs/promises";
import type {
  ExportReport,
  ItemKind,
  ItemStatus,
  Mention,
  NextReport,
  NodeHashes,
  NodeReport,
  OriginEntry,
  RecordedNodeEntry,
  ReviewItem,
  SessionStatusReport,
  SessionStatusRow,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  ITEM_STATUSES,
  assertReportMentions,
  decodeExportReport,
  decodeItemReport,
  decodeNextReport,
  decodeNodeReport,
  decodeRecordedState,
  decodeSessionListReport,
  decodeSessionStatusReport,
  identityMention,
  nameMention,
  numberMention,
  requireScopeNodes,
  specTokenMention,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { type StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { assertScopePresence, changedNodes } from "./section-10.5.js";
import { digitHoldingData } from "./section-10.7-i.js";
import {
  assertSameJson,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectReviewRefusal,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = stagedTs(
  "T10.7-7/T10.7-9/T10.7-12/T12.0-15 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// One spec group plus a direct coverage profile over it (SPEC 7.4): with the
// group serving as its own boundary, a leaf is covered exactly when some
// non-root node has a single dependency edge to it (SPEC 8).
const COVERAGE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

// A direct profile over every node (`targets: "all"`, SPEC 7.4/8.1), so a
// branch node can be required and uncovered — making an
// `uncovered-requirement` scope whose subtree text differs from its own text
// (the T10.7-12 discriminator).
const COVERAGE_ALL_CONFIG = stagedTs(
  "T10.7-12 xspec.config.ts — one spec group and the coverage profile p over every node (targets all)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      boundary: "main",
      mode: "direct",
      targets: "all"
    }
  ]
})
`,
);

// Spec group plus a code group (SPEC 7.2) — the T10.7-12 matrix fixture needs
// a `code-impact` item (an impacted code location, SPEC 9.2, 10.5).
const SPECS_CODE_CONFIG = stagedTs(
  "T10.7-7/T12.0-15 xspec.config.ts — one spec group and the code group app",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

/**
 * The session file of the session `s` that T10.7-9's and T10.7-10's
 * refusals name (SPEC 10.1: `.xspec/reviews/<name>.json`).
 */
const SESSION_S_REL = ".xspec/reviews/s.json";

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: string | StagedTs,
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/** Full `query node` report (SPEC 11, JSON-only; H-3). */
async function queryNode(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  context: string,
): Promise<NodeReport> {
  const label = `${context} \`query node ${identity}\``;
  return decodeNodeReport(
    await runJson(product, workspace, ["query", "node", identity], label),
    label,
  );
}

/** `review status <name> --json`, decoded (SPEC 10.7). */
async function sessionStatus(
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

/** `review export <name> --json`, decoded (SPEC 10.7). */
async function exportSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<ExportReport> {
  const label = `${context} \`review export ${name} --json\``;
  return decodeExportReport(
    await runJson(
      product,
      workspace,
      ["review", "export", name, "--json"],
      label,
    ),
    label,
  );
}

/** `review show <name> <item-id> --json`, decoded as the full item. */
async function showItem(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  itemId: string,
  context: string,
): Promise<ReviewItem> {
  const label = `${context} \`review show ${name} ${itemId} --json\``;
  return decodeItemReport(
    await runJson(
      product,
      workspace,
      ["review", "show", name, itemId, "--json"],
      label,
    ),
    label,
  );
}

/** `review next <name> --json`, decoded (SPEC 10.7). */
async function nextInSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<NextReport> {
  const label = `${context} \`review next ${name} --json\``;
  return decodeNextReport(
    await runJson(
      product,
      workspace,
      ["review", "next", name, "--json"],
      label,
    ),
    label,
  );
}

/** The item `next` returned, diagnosed when the session reports resolved. */
function requireNextItem(next: NextReport, context: string): ReviewItem {
  if (next.fullyResolved || next.item === undefined) {
    fail(
      `${context}: the session still holds a needing-review unblocked item, ` +
        `so \`next\` returns one (SPEC 10.7); got the fully-resolved report`,
    );
  }
  return next.item;
}

/** `review create --strategy audit --name <name>` must succeed (SPEC 10.7). */
async function createAuditSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "create", "--strategy", "audit", "--name", name],
    0,
    `${context} \`review create --strategy audit --name ${name}\``,
  );
}

/** `review create --base <ref> --name <name>` must succeed (SPEC 10.7). */
async function createBaseSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  name: string,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "create", "--base", ref, "--name", name],
    0,
    `${context} \`review create --base <baseline> --name ${name}\``,
  );
}

/** `review create --coverage <profile> --name <name>` must succeed. */
async function createCoverageSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  profile: string,
  name: string,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "create", "--coverage", profile, "--name", name],
    0,
    `${context} \`review create --coverage ${profile} --name ${name}\``,
  );
}

/** `review resolve <name> <item-id> --status <status>` must succeed. */
async function resolveOk(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  itemId: string,
  status: ItemStatus,
  context: string,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "resolve", name, itemId, "--status", status],
    0,
    context,
  );
}

/**
 * The unique status row for a kind and scope node, diagnosed loudly when
 * missing or duplicated (SPEC 10.1, 10.5: at most one item per kind and
 * scope node — the invariant holds for every strategy).
 */
function requireRow(
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
  return rows[0];
}

/** The unique full item for a kind and scope node in an export item list. */
function requireItem(
  items: readonly ReviewItem[],
  kind: ItemKind,
  scope: string,
  context: string,
): ReviewItem {
  const matches = items.filter(
    (item) => item.kind === kind && item.scope.node === scope,
  );
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.1, 10.5: at most one item per kind and scope node); found ` +
        `${String(matches.length)} among ` +
        JSON.stringify(items.map((item) => `${item.kind} ${item.scope.node}`)),
    );
  }
  return matches[0];
}

/** The unique item with the given id in an item list (SPEC 10.2). */
function requireItemById(
  items: readonly ReviewItem[],
  id: string,
  context: string,
): ReviewItem {
  const matches = items.filter((item) => item.id === id);
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one item with id ${JSON.stringify(id)} ` +
        `(SPEC 10.2: item ids are unique within the session); found ` +
        `${String(matches.length)} among ` +
        JSON.stringify(items.map((item) => item.id)),
    );
  }
  return matches[0];
}

/** In-order `kind scope status` rendering of status rows (order compare). */
function rowSequence(report: SessionStatusReport): readonly string[] {
  return report.items.map((row) => `${row.kind} ${row.scope} ${row.status}`);
}

/** In-order `kind scope` rendering of export items (order compare). */
function exportKindScopeSequence(
  items: readonly ReviewItem[],
): readonly string[] {
  return items.map((item) => `${item.kind} ${item.scope.node}`);
}

/** Sorted node-identity set of a payload node list (membership compare). */
function identitySet(
  states: readonly { readonly node: string }[],
): readonly string[] {
  return states.map((state) => state.node).sort();
}

/**
 * Assert an item's `blockedBy` as a sorted id set (SPEC 10.5/10.7 fix which
 * items block; the field's internal order is not pinned).
 */
function assertBlockedBy(
  item: ReviewItem,
  expected: readonly string[],
  context: string,
): void {
  assertSameJson(
    [...item.blockedBy].sort(),
    [...expected].sort(),
    `${context}: the item's blockedBy id set (SPEC 10.5, 10.6, 10.7)`,
  );
}

/**
 * Canonical JSON rendering: object members sorted by key, arrays in order,
 * recursively — equality of information content where concrete member order
 * is shape territory (H-3/H-4).
 */
export function canonicalJson(value: unknown): string {
  // H-11: an explicit stack, never native recursion per nesting level.
  type Item = { readonly render: unknown } | { readonly text: string };
  const pieces: string[] = [];
  const stack: Item[] = [{ render: value }];
  while (stack.length > 0) {
    const item = stack.pop();
    if (item === undefined) break;
    if ("text" in item) {
      pieces.push(item.text);
      continue;
    }
    const current = item.render;
    if (Array.isArray(current)) {
      pieces.push("[");
      stack.push({ text: "]" });
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push({ render: current[index] });
        if (index > 0) stack.push({ text: "," });
      }
    } else if (current !== null && typeof current === "object") {
      const entries = Object.entries(current as Record<string, unknown>)
        .filter(([, member]) => member !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      pieces.push("{");
      stack.push({ text: "}" });
      let remaining = entries.length;
      for (const [key, member] of entries.reverse()) {
        stack.push({ render: member });
        stack.push({ text: `${JSON.stringify(key)}:` });
        remaining -= 1;
        if (remaining > 0) stack.push({ text: "," });
      }
    } else {
      pieces.push(JSON.stringify(current) ?? "null");
    }
  }
  return pieces.join("");
}

/** Diagnosed canonical-JSON (key-order-insensitive) deep equality. */
function assertSameInformation(
  actual: unknown,
  expected: unknown,
  context: string,
): void {
  const actualRendered = canonicalJson(actual);
  const expectedRendered = canonicalJson(expected);
  if (actualRendered === expectedRendered) return;
  fail(
    `${context}: values differ (canonical JSON, key order normalized)\n` +
      `  actual:   ${actualRendered}\n` +
      `  expected: ${expectedRendered}`,
  );
}

/** Every string leaf of a decoded JSON value (array elements and members). */
export function collectStringLeaves(
  value: unknown,
  into: string[] = [],
): string[] {
  // H-11: an explicit stack, never native recursion per nesting level.
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      into.push(current);
    } else if (Array.isArray(current)) {
      for (let index = current.length - 1; index >= 0; index -= 1) {
        stack.push(current[index]);
      }
    } else if (current !== null && typeof current === "object") {
      const members = Object.values(current);
      for (let index = members.length - 1; index >= 0; index -= 1) {
        stack.push(members[index]);
      }
    }
  }
  return into;
}

/**
 * The recorded state must hold the given value among its string leaves
 * (SPEC 10.2/10.4: `baseline`/`current` hold the item's relevant hashes; the
 * value is the one `query node` reported at the expected moment).
 */
function assertRecordedHolds(
  recorded: unknown,
  hash: string,
  what: string,
  context: string,
): void {
  if (collectStringLeaves(recorded).includes(hash)) return;
  fail(
    `${context}: the recorded state must hold ${what} — the value ` +
      `${JSON.stringify(hash)} captured via \`query node\` at that moment ` +
      `(SPEC 10.2, 10.4, 10.7; H-4: opaque shape, spec-fixed values) — but ` +
      `it appears nowhere in ${canonicalJson(recorded)}`,
  );
}

/**
 * The recorded state must NOT hold the given value — the discriminator
 * against records taken (or recomputed) at the wrong moment; the value's
 * distinctness from every legitimately recorded value is asserted as a
 * staging premise before this runs.
 */
function assertRecordedLacks(
  recorded: unknown,
  hash: string,
  what: string,
  context: string,
): void {
  if (!collectStringLeaves(recorded).includes(hash)) return;
  fail(
    `${context}: the recorded state must not hold ${what} — the value ` +
      `${JSON.stringify(hash)} belongs to a different moment than the one ` +
      `the record was written at (SPEC 10.2, 10.4: resolve records the ` +
      `current relevant state; reads report the recorded state) — but it ` +
      `appears in ${canonicalJson(recorded)}`,
  );
}

/** Staging premise: the listed values are pairwise distinct (diagnosed). */
function assertPairwiseDistinct(
  values: readonly (readonly [string, string])[],
  context: string,
): void {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      if (values[i][1] === values[j][1]) {
        fail(
          `${context}: staging premise — ${values[i][0]} and ${values[j][0]} ` +
            `must be distinct values for the discrimination to be ` +
            `meaningful; both are ${JSON.stringify(values[i][1])}`,
        );
      }
    }
  }
}

/**
 * The {scope, context, origin} payload projection of an item, with context
 * and origin sorted by node identity — the "same self-contained text payload"
 * SPEC 10.7 fixes across `next --json`, `show`, and `export` (membership and
 * per-node content; entry order within the lists is shape territory, H-3).
 */
function payloadProjection(item: ReviewItem): unknown {
  const state = (node: {
    readonly node: string;
    readonly present: boolean;
    readonly text?: string;
    readonly sourceRange?: SourceRange;
  }): unknown => ({
    node: node.node,
    present: node.present,
    text: node.text,
    sourceRange: node.sourceRange,
  });
  return {
    scope: state(item.scope),
    context: [...item.context]
      .sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : 0))
      .map(state),
    origin: [...item.origin]
      .sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : 0))
      .map((entry) => ({
        node: entry.node,
        before: entry.before,
        after: entry.after,
        sourceRange: entry.sourceRange,
      })),
  };
}

/** What a present payload node must present (SPEC 10.7, 1.6, 1.7). */
interface PresentStateExpectation {
  readonly node: string;
  /** The exact expected text; `undefined` = the node must carry no text. */
  readonly text: string | undefined;
  /**
   * The exact expected range — every present node carries its source range,
   * requirement node and code location alike (SPEC 10.7, 1.7).
   */
  readonly sourceRange: SourceRange;
}

/** Assert a payload node state presents a present node exactly. */
function assertPresentState(
  state: {
    readonly node: string;
    readonly present: boolean;
    readonly text?: string;
    readonly sourceRange?: SourceRange;
  },
  expected: PresentStateExpectation,
  context: string,
): void {
  if (state.node !== expected.node || !state.present) {
    fail(
      `${context}: expected the present node ${expected.node} under its ` +
        `current identity (SPEC 10.4, 10.7); got ` +
        `{node: ${JSON.stringify(state.node)}, present: ${String(state.present)}}`,
    );
  }
  if (expected.text === undefined) {
    if (state.text !== undefined) {
      fail(
        `${context}: ${expected.node} must carry no text value — a code ` +
          `location has none (SPEC 10.7); got ${JSON.stringify(state.text)}`,
      );
    }
  } else if (state.text !== expected.text) {
    fail(
      `${context}: ${expected.node}'s payload text must be byte-equal to ` +
        `the spec-fixed value (SPEC 10.7, 1.6)\n` +
        `  actual:   ${JSON.stringify(state.text)}\n` +
        `  expected: ${JSON.stringify(expected.text)}`,
    );
  }
  assertSameJson(
    state.sourceRange,
    expected.sourceRange,
    `${context}: ${expected.node}'s source range (SPEC 10.7, 1.7 — a ` +
      `present node, requirement node and code location alike, enters the ` +
      `payload with its source range)`,
  );
}

/** Assert a payload node state presents an absent node exactly. */
function assertAbsentState(
  state: {
    readonly node: string;
    readonly present: boolean;
    readonly text?: string;
    readonly sourceRange?: SourceRange;
  },
  expected: {
    readonly node: string;
    /** The exact provenance text; `undefined` = must carry no text. */
    readonly text: string | undefined;
  },
  context: string,
): void {
  if (state.node !== expected.node || state.present) {
    fail(
      `${context}: expected the absent node ${expected.node} presented under ` +
        `its identity with present: false (SPEC 10.4, 10.7); got ` +
        `{node: ${JSON.stringify(state.node)}, present: ${String(state.present)}}`,
    );
  }
  if (state.sourceRange !== undefined) {
    fail(
      `${context}: an absent node has no current source, so it is presented ` +
        `without a source range (SPEC 10.7, 1.7); got ` +
        JSON.stringify(state.sourceRange),
    );
  }
  if (expected.text === undefined) {
    if (state.text !== undefined) {
      fail(
        `${context}: ${expected.node} must be presented with no text — a ` +
          `node contained in no recorded state, or a code location, which ` +
          `has no text value (SPEC 10.7); got ` +
          JSON.stringify(state.text),
      );
    }
  } else if (state.text !== expected.text) {
    fail(
      `${context}: the absent node ${expected.node} presents its text from ` +
        `the most recent graph state containing it, among the item's ` +
        `baseline state and the states under which mutating subcommands ` +
        `derived or resolved the item with that node among its nodes ` +
        `(SPEC 10.7)\n` +
        `  actual:   ${JSON.stringify(state.text)}\n` +
        `  expected: ${JSON.stringify(expected.text)}`,
    );
  }
}

/** The unique context entry for a node identity, diagnosed when absent. */
function requireContextEntry(
  item: ReviewItem,
  node: string,
  context: string,
): ReviewItem["context"][number] {
  const matches = item.context.filter((state) => state.node === node);
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one context entry for ${node} ` +
        `(SPEC 10.7: every context node enters the payload once); found ` +
        `${String(matches.length)} among ${JSON.stringify(identitySet(item.context))}`,
    );
  }
  return matches[0];
}

/** The unique origin entry for a node identity, diagnosed when absent. */
function requireOriginEntry(
  item: ReviewItem,
  node: string,
  context: string,
): OriginEntry {
  const matches = item.origin.filter((entry) => entry.node === node);
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one origin entry for ${node} ` +
        `(SPEC 10.7: every origin node enters the payload once); found ` +
        `${String(matches.length)} among ${JSON.stringify(identitySet(item.origin))}`,
    );
  }
  return matches[0];
}

/** What one side of an origin before/after pair must present (SPEC 10.7). */
type OriginSideExpectation =
  | { readonly present: false }
  | { readonly present: true; readonly text: string };

/** Assert an origin entry's before/after pair exactly (SPEC 10.7). */
function assertOriginPair(
  entry: OriginEntry,
  expected: {
    readonly before: OriginSideExpectation;
    readonly after: OriginSideExpectation;
  },
  context: string,
): void {
  for (const [label, side, want] of [
    ["before", entry.before, expected.before],
    ["after", entry.after, expected.after],
  ] as const) {
    if (!want.present) {
      if (side.present) {
        fail(
          `${context}: the ${label} side of ${entry.node}'s origin pair is ` +
            `the absent side — presented absent, with no text (SPEC 10.7); ` +
            `got ${JSON.stringify(side)}`,
        );
      }
      continue;
    }
    if (!side.present) {
      fail(
        `${context}: the ${label} side of ${entry.node}'s origin pair must ` +
          `be present with the node's own text (SPEC 10.7); got the absent side`,
      );
    }
    if (side.text !== want.text) {
      fail(
        `${context}: the ${label} side of ${entry.node}'s origin pair — ` +
          `own text ${label === "before" ? "from the item's baseline state" : "from the current graph"} ` +
          `(SPEC 10.7, 1.6)\n` +
          `  actual:   ${JSON.stringify(side.text)}\n` +
          `  expected: ${JSON.stringify(want.text)}`,
      );
    }
  }
}

/**
 * Assert an origin entry's node-level source range (SPEC 10.7, 1.7): every
 * payload node — scope, context, and origin alike — enters with its current
 * source range when present. (The adapter already rejects a range on a
 * currently-absent origin node, whose after side is absent.)
 */
function assertOriginRange(
  entry: OriginEntry,
  expected: SourceRange,
  context: string,
): void {
  assertSameJson(
    entry.sourceRange,
    expected,
    `${context}: ${entry.node}'s origin-entry source range — every present ` +
      `payload node, origin nodes included, carries its current source ` +
      `range (SPEC 10.7, 1.7)`,
  );
}

/**
 * Walk a session to completion via `next --json` + `resolve --status
 * no-change` (which never re-derives, SPEC 10.5): every item of `reference`
 * must be returned by `next` exactly once, presenting the identical
 * {scope, context, origin} payload projection as the reference read (one
 * payload rule, SPEC 10.7), and the walk must end fully resolved.
 */
async function walkNextAgainstReference(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  reference: readonly ReviewItem[],
  context: string,
): Promise<void> {
  const remaining = new Set(reference.map((item) => item.id));
  for (let step = 1; step <= reference.length + 1; step += 1) {
    const label = `${context}, walk step ${String(step)}`;
    const next = await nextInSession(product, workspace, session, label);
    if (next.fullyResolved) {
      if (remaining.size > 0) {
        fail(
          `${label}: \`next\` reports the session fully resolved while ` +
            `these needing-review items were never returned: ` +
            `${JSON.stringify([...remaining].sort())} (SPEC 10.7: next ` +
            `returns the first needing-review unblocked item until none ` +
            `qualifies)`,
        );
      }
      return;
    }
    const item = requireNextItem(next, label);
    if (!remaining.has(item.id)) {
      fail(
        `${label}: \`next\` returned item ${item.id}, which is not among ` +
          `the session's still-unresolved items ` +
          `${JSON.stringify([...remaining].sort())} — either an unknown id ` +
          `or an item returned twice (SPEC 10.7)`,
      );
    }
    remaining.delete(item.id);
    assertSameInformation(
      payloadProjection(item),
      payloadProjection(requireItemById(reference, item.id, label)),
      `${label}: item ${item.id}'s \`next --json\` payload — scope, context, ` +
        `and origin nodes with their texts, presence, and source ranges — ` +
        `is identical to the reference read's (SPEC 10.7: \`show\` and ` +
        `\`export\` carry the same self-contained text payload as ` +
        `\`next --json\`)`,
    );
    await resolveOk(
      product,
      workspace,
      session,
      item.id,
      "no-change",
      `${label} \`review resolve ${session} ${item.id} --status no-change\``,
    );
  }
  fail(
    `${context}: after resolving every item, \`next\` must report the ` +
      `session fully resolved (SPEC 10.7)`,
  );
}

// ---------------------------------------------------------------------------
// T10.7-7 — next
// ---------------------------------------------------------------------------

const N7_FILE = "specs/T.mdx";
const N7_P = "specs/T.mdx#p";
const N7_PA = "specs/T.mdx#p.a";
const N7_PB = "specs/T.mdx#p.b";

// The order arm's initial specs/T.mdx: T12.0-15 (section-12.0-iv.ts) runs
// this staging after its body's first invocation, so it is a staged-source
// record (helpers/staged-mdx.ts, S-9's timing clause) — the same expression,
// moved into the record.
const T10_7_7_T_INITIAL = stagedMdx(
  "T10.7-7/T12.0-15 specs/T.mdx holding p, with p.a and p.b (the order arm's initial source)",
  [
    '<S id="p">',
    "Pee own line.",
    "",
    '<S id="p.a">',
    "Paa line.",
    "</S>",
    "",
    '<S id="p.b">',
    "Pab line.",
    "</S>",
    "</S>",
    "",
  ].join("\n"),
);

// The full-resolution arm's added source (SPEC 10.7: full resolution
// concerns the session's items alone): a spec file of its own holding one
// section, so it touches no existing item's recorded state or context set —
// each audit item's scope and ancestor-chain context lie in its own file's
// tree (SPEC 10.6) — while an audit re-derivation would generate items for
// its root and its section. Its path sorts after N7_FILE's, so both items
// follow the order arm's four in audit item order (file path bytes, then
// document order, SPEC 10.6). It is staged after the order arm's
// invocations, so it is a staged-source record (helpers/staged-mdx.ts, S-9:
// judged before any product exists).
const N7_ADDED_FILE = "specs/U.mdx";
const N7_ADDED_ROOT = "specs/U.mdx";
const N7_ADDED_U = "specs/U.mdx#u";
const T10_7_7_U_ADDED = stagedMdx(
  "T10.7-7/T12.0-15 specs/U.mdx holding the one section u (the full-resolution arm's added source)",
  ['<S id="u">', "You line.", "</S>", ""].join("\n"),
);

const N7_PB_FILE = "specs/A2.mdx";
const N7_PB_ROOT = "specs/A2.mdx";
const N7_A = "specs/A2.mdx#a";
const N7_AK = "specs/A2.mdx#a.k";

function n7PbSpec(kidText: string): string {
  return [
    '<S id="a">',
    "Parent alpha line.",
    "",
    '<S id="a.k">',
    kidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// The payload arm's initial source and reviewed edit follow the body's first
// `build` (the order arm's), so both are staged-source records
// (helpers/staged-mdx.ts, S-9: judged before any product exists); the code
// source beside them is a TypeScript record (`N7_CODE_SOURCE`).
const T10_7_7_A2_KID_V0 = stagedMdx(
  "T10.7-7/T12.0-15 specs/A2.mdx with a.k's text at v0 (the payload arm's initial source)",
  n7PbSpec("Kid line v0."),
);
const T10_7_7_A2_KID_V1 = stagedMdx(
  "T10.7-7/T12.0-15 specs/A2.mdx with a.k's text at v1 (the payload arm's reviewed edit)",
  n7PbSpec("Kid line v1."),
);

// The payload arm's impacted code location (SPEC 9.2, 10.5): the marker sits
// inside the function declaration `nextUnit`, so the reference is attributed
// to the named unit (SPEC 4.6) and the impacted location is
// `src/next.ts#nextUnit`. Multi-byte UTF-8 bytes precede the unit, so the
// precomputed byte offsets diverge from code-point and UTF-16 offsets: the
// range assertion is byte-precise (SPEC 1.7; a code location is no
// `query node` operand, so its range is asserted against precomputed offsets
// — the T10.7-12/T1.7-2 pattern).
const N7_CODE_FILE = "src/next.ts";
const N7_CODE = "src/next.ts#nextUnit";
const N7_CODE_BEFORE_UNIT =
  'import A from "../specs/A2.xspec";\n\n// Byte-genaue Präambel vor der Einheit (multi-byte prefix).\n\n';
const N7_CODE_UNIT_DECL = "function nextUnit() {\n  A.a.k;\n}";
// The payload arm's workspace follows the order arm's invocations and the
// code source is staged after its first `build`, so it is a TypeScript
// staged-source record (module header), well-formed.
const N7_CODE_SOURCE = stagedTs(
  "T10.7-7/T12.0-15 src/next.ts (the payload arm's impacted code location nextUnit)",
  `${N7_CODE_BEFORE_UNIT}${N7_CODE_UNIT_DECL}\n`,
);

// nextUnit's construct range (SPEC 1.7, 4.6): the function declaration's own
// bytes, from the `function` keyword through the closing brace — zero-based,
// start-inclusive, end-exclusive byte offsets into the file.
const N7_CODE_RANGE: SourceRange = {
  start: Buffer.byteLength(N7_CODE_BEFORE_UNIT, "utf8"),
  end:
    Buffer.byteLength(N7_CODE_BEFORE_UNIT, "utf8") +
    Buffer.byteLength(N7_CODE_UNIT_DECL, "utf8"),
};

/**
 * `review next <name>` reporting the session fully resolved in both forms
 * (SPEC 10.7): the human form exits 0 with stdout mentioning resolution
 * (H-3: information presence — the /resolv/i operationalization from the
 * module header), and `--json` reports fully resolved with no item in the
 * payload.
 */
async function expectFullyResolvedBothForms(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<void> {
  const human = await expectExit(
    product,
    workspace,
    ["review", "next", name],
    0,
    `${context} \`review next ${name}\` (human form) — a fully resolved ` +
      `session exits 0 (SPEC 10.7)`,
  );
  assertReportMentions(
    human,
    [/resolv/i],
    `${context} \`review next ${name}\` (human form) — the report states ` +
      `the session is fully resolved (SPEC 10.7; information presence, ` +
      `never exact wording, H-3)`,
  );
  const next = await nextInSession(product, workspace, name, context);
  if (!next.fullyResolved) {
    const returned =
      next.item === undefined
        ? "an item"
        : `item ${next.item.id} (${next.item.kind} ${next.item.scope.node}, ` +
          `${next.item.status})`;
    fail(
      `${context} \`review next ${name} --json\`: every item is resolved, ` +
        `so the JSON form reports fully resolved with no item in the ` +
        `payload (SPEC 10.7); the product returned ${returned}`,
    );
  }
  // The adapter itself refuses a document that claims fullyResolved while
  // carrying an item, so reaching here pins "no item in the JSON payload".
}

/**
 * The item `next --json` returned is, in `review status`'s item order at the
 * same state, the first unblocked item needing review (SPEC 10.3, 10.7): its
 * row is present exactly once, unblocked, and `unresolved` or `invalidated`,
 * and every row before it is resolved — `updated`, `no-change`, or
 * `skipped` — or blocked. A product-to-itself comparison of `next` against
 * `status` (H-4): rows after it, and every row's kind and scope, are not
 * asserted here.
 */
function assertFirstUnblockedNeedingReview(
  report: SessionStatusReport,
  itemId: string,
  context: string,
): void {
  const needsReview = (status: ItemStatus): boolean =>
    status === "unresolved" || status === "invalidated";
  const rendered = JSON.stringify(
    report.items.map(
      (row) =>
        `${row.id} ${row.kind} ${row.scope} ${row.status}` +
        (row.blocked ? " blocked" : ""),
    ),
  );
  const matches = report.items.filter((row) => row.id === itemId);
  if (matches.length !== 1) {
    fail(
      `${context}: the item \`next\` returned, ${itemId}, appears exactly ` +
        `once among the session's rows (SPEC 10.2, 10.7: item ids are ` +
        `unique, and \`status\` reports every item); found ` +
        `${String(matches.length)} in ${rendered}`,
    );
  }
  const index = report.items.findIndex((row) => row.id === itemId);
  const row = report.items[index];
  if (row.blocked || !needsReview(row.status)) {
    fail(
      `${context}: the item \`next\` returns needs review and is unblocked ` +
        `(SPEC 10.3, 10.7); \`status\` reports ${itemId} with status ` +
        `${row.status}${row.blocked ? ", blocked" : ""} in ${rendered}`,
    );
  }
  const earlier = report.items
    .slice(0, index)
    .filter((other) => needsReview(other.status) && !other.blocked);
  if (earlier.length > 0) {
    fail(
      `${context}: \`next\` returns the FIRST unblocked item needing ` +
        `review in item order (SPEC 10.7), so every item before ${itemId} ` +
        `is resolved or blocked; \`status\` reports ` +
        `${JSON.stringify(earlier.map((other) => other.id))} before it, ` +
        `unblocked and needing review, in ${rendered}`,
    );
  }
}

/**
 * The human `review next <name>` at the state of a decoded `review next
 * <name> --json` read that returned an item, after that read's own
 * assertions — T12.0-1's information parity (SPEC 12.0: the JSON form
 * carries the same information as the human report; the module header):
 * the same argv without `--json` exits 0, and its report names the item
 * `next` returns by its id (an item-id boundary, so `item-1` never counts
 * inside `item-10`; SPEC 10.2, 10.7). The human `next` is asked only to
 * identify its item: SPEC 10.7 requires the self-contained payload of
 * `next --json` alone, and `show` reports the full item in both forms
 * (T10.7-8). Robust matching (H-3): presence, never wording.
 */
async function assertHumanNextItem(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  item: ReviewItem,
  context: string,
): Promise<void> {
  const label = `${context} \`review next ${name}\` (human report)`;
  const human = await expectExit(
    product,
    workspace,
    ["review", "next", name],
    0,
    `${label} — the same exit code as the \`--json\` read at this state ` +
      `(SPEC 10.7, 12.0)`,
  );
  assertReportMentions(
    human,
    [nameMention(item.id)],
    `${label}: the id of the item \`next --json\` returned at this state — ` +
      `the first needing-review unblocked item in item order, identified ` +
      `(SPEC 10.2, 10.7, 12.0)`,
  );
}

/**
 * One `review next` read T10.7-7's staging reaches — the order arm's four
 * items and its fully-resolved report, the full-resolution arm's
 * fully-resolved report and the new section's item, the empty session's
 * fully-resolved report, and the payload arm's four reads — handed to the
 * staging's visitor at the state it reads: its label, the session it
 * reads, and the home test's own `review next` read with its assertions
 * and the human form's parity check (`home`; each payload-arm read's over
 * the staging's own read, which yields the item the staging resolves next,
 * every other read's over a read of its own). Exported for T12.0-15
 * (section-12.0-iv.ts), which hands its human twin of the read in their
 * place.
 */
export interface T1077Read {
  readonly label: string;
  readonly session: string;
  readonly home: () => Promise<void>;
}

/** A visitor of T10.7-7's `review next` reads, each at the state it reads. */
export type T1077ReadVisitor = (
  workspace: TestWorkspace,
  read: T1077Read,
) => Promise<void>;

/**
 * T10.7-7's staging, its `review next` reads handed to `visit` (exported for
 * T12.0-15): the order arm — a workspace of `SPECS_ONLY_CONFIG` and
 * specs/T.mdx (p holding p.a and p.b), built, the audit session s, whose
 * item order `status` reads (the premise, yielding the ids) — its four
 * items read in turn, each resolved after its read, then its fully-resolved
 * report; continued by the full-resolution arm — specs/U.mdx added and
 * built, the fully-resolved report again, then p.a's item re-resolved
 * `updated` and the new section's item read; the empty-session arm — an
 * audit session over no requirement node (the premise), its fully-resolved
 * report; and the payload arm — a git-backed workspace of
 * `SPECS_CODE_CONFIG` and specs/A2.mdx at v0, built and captured, a.k then
 * edited and src/next.ts added, built and captured (the distinctness
 * premises), the path-blocks session s created against the baseline, and
 * its walk: a.k's item, then a's, then the code location's, each read by
 * the staging (the item it resolves `no-change` before the next read), the
 * code file then deleted and the workspace rebuilt, and the code
 * location's item read again. `prefix` leads every staging step's
 * diagnosis.
 */
export async function runT1077Reads(
  product: ProductBinding,
  visit: T1077ReadVisitor,
  prefix = "T10.7-7",
): Promise<void> {
  // --- arm 1: order walking and the fully-resolved report -----------------
  // (continued on the same workspace by the full-resolution arm, once
  // every item is resolved)
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { [N7_FILE]: T10_7_7_T_INITIAL },
    async (workspace) => {
      const orderPrefix = `${prefix} order arm`;
      await buildOk(product, workspace, `${orderPrefix} \`build\``);
      await createAuditSession(product, workspace, "s", orderPrefix);

      // Item order (SPEC 10.6): root, p, p.a, p.b — with the root and p
      // blocked by their children's items, so the first needing-review
      // UNBLOCKED item is p.a's, not the root's (a product ignoring the
      // blocked state fails here).
      const initial = await sessionStatus(product, workspace, "s", orderPrefix);
      assertSameJson(
        rowSequence(initial),
        [
          `subtree-coherence ${N7_FILE} unresolved`,
          `subtree-coherence ${N7_P} unresolved`,
          `subtree-coherence ${N7_PA} unresolved`,
          `subtree-coherence ${N7_PB} unresolved`,
        ],
        `${orderPrefix} staging premise: the audit items in item order (SPEC 10.6)`,
      );
      const idRoot = requireRow(
        initial,
        "subtree-coherence",
        N7_FILE,
        orderPrefix,
      ).id;
      const idP = requireRow(
        initial,
        "subtree-coherence",
        N7_P,
        orderPrefix,
      ).id;
      const idPA = requireRow(
        initial,
        "subtree-coherence",
        N7_PA,
        orderPrefix,
      ).id;
      const idPB = requireRow(
        initial,
        "subtree-coherence",
        N7_PB,
        orderPrefix,
      ).id;

      const nextRead = async (expected: string, why: string): Promise<void> => {
        const label = `${orderPrefix} ${why}`;
        await visit(workspace, {
          label,
          session: "s",
          home: async () => {
            const item = requireNextItem(
              await nextInSession(product, workspace, "s", label),
              label,
            );
            if (item.id !== expected) {
              fail(
                `${label}: \`next\` returns the first needing-review ` +
                  `unblocked item in item order (SPEC 10.7); expected ` +
                  `${expected}, got ${item.id}`,
              );
            }
            // The human form at the same state names the item returned
            // (T12.0-1, SPEC 12.0; the module header).
            await assertHumanNextItem(product, workspace, "s", item, label);
          },
        });
      };
      const fullyResolvedRead = async (label: string): Promise<void> => {
        await visit(workspace, {
          label,
          session: "s",
          home: () =>
            expectFullyResolvedBothForms(product, workspace, "s", `${label}:`),
        });
      };

      await nextRead(
        idPA,
        "fresh session — the root's and p's items are blocked, so the " +
          "first needing-review unblocked item is p.a's",
      );
      await resolveOk(
        product,
        workspace,
        "s",
        idPA,
        "no-change",
        `${orderPrefix} \`resolve s <p.a's item> --status no-change\``,
      );
      await nextRead(idPB, "after resolving p.a's item");
      await resolveOk(
        product,
        workspace,
        "s",
        idPB,
        "skipped",
        `${orderPrefix} \`resolve s <p.b's item> --status skipped\``,
      );
      // p's item precedes p.a's and p.b's in item order and just became
      // unblocked: next moves backward in item order — a product scanning
      // forward from the last returned item fails here.
      await nextRead(
        idP,
        "after resolving both leaves — p's item, earlier in item order, " +
          "is now the first needing-review unblocked item",
      );
      await resolveOk(
        product,
        workspace,
        "s",
        idP,
        "no-change",
        `${orderPrefix} \`resolve s <p's item> --status no-change\``,
      );
      await nextRead(idRoot, "after resolving p's item");
      await resolveOk(
        product,
        workspace,
        "s",
        idRoot,
        "skipped",
        `${orderPrefix} \`resolve s <root's item> --status skipped\``,
      );

      await fullyResolvedRead(`${orderPrefix}, all items resolved`);

      // --- arm 1, continued: full resolution concerns the session's items
      // alone (SPEC 10.7) ---------------------------------------------------
      // The session holds every item resolved, none `updated`, so nothing
      // has re-derived it (SPEC 10.5). A new spec source holding one
      // section is added: it touches no existing item's recorded state or
      // context set, while a re-derivation would generate items for its
      // root and its section (SPEC 10.6). A change that would generate a
      // new item enters the session only at its next re-derivation (SPEC
      // 10.7), so `next` still reports the session fully resolved — a
      // product deriving items at a read, or at `build`, fails here.
      const fullPrefix = `${prefix} full-resolution arm`;
      await workspace.file(N7_ADDED_FILE, T10_7_7_U_ADDED);
      await buildOk(
        product,
        workspace,
        `${fullPrefix} \`build\` with ${N7_ADDED_FILE} added`,
      );
      await fullyResolvedRead(
        `${fullPrefix}, every item resolved and ${N7_ADDED_FILE} added — ` +
          `a change that would generate a new item enters the session ` +
          `only at its next re-derivation (SPEC 10.5, 10.7)`,
      );

      // A resolved leaf item re-resolved `updated` — `resolve` applies to
      // any unblocked item regardless of its status (SPEC 10.7) — re-derives
      // the session (SPEC 10.5): the new source's root and section enter
      // it, each `unresolved` (SPEC 10.2), the root's item blocked by the
      // section's (SPEC 10.6). `next` returns the new section's item, the
      // first unblocked item needing review — a product whose `updated`
      // resolve re-derives nothing fails here.
      await resolveOk(
        product,
        workspace,
        "s",
        idPA,
        "updated",
        `${fullPrefix} \`resolve s <p.a's item> --status updated\` (the ` +
          `leaf item the order arm resolved \`no-change\`, re-resolved)`,
      );
      const rederived = `${fullPrefix}, p.a's item re-resolved \`updated\``;
      await visit(workspace, {
        label: rederived,
        session: "s",
        home: async () => {
          const added = requireNextItem(
            await nextInSession(product, workspace, "s", rederived),
            rederived,
          );
          if (
            added.kind !== "subtree-coherence" ||
            added.scope.node !== N7_ADDED_U
          ) {
            fail(
              `${rederived}: \`next\` returns the new section's item — the ` +
                `subtree-coherence item scoped at ${N7_ADDED_U}, which the ` +
                `re-derivation the \`updated\` resolve triggered added, the ` +
                `first unblocked item needing review (the new root ` +
                `${N7_ADDED_ROOT}'s item precedes it in item order, blocked by ` +
                `it; SPEC 10.5, 10.6, 10.7); got ${added.kind} ` +
                `${added.scope.node} (${added.id})`,
            );
          }
          if (added.status !== "unresolved") {
            fail(
              `${rederived}: the new section's item entered the session at ` +
                `the re-derivation, so \`next\` presents it \`unresolved\` ` +
                `(SPEC 10.2: an item is created with status unresolved ` +
                `wherever it enters the session); got ${added.status}`,
            );
          }
          assertFirstUnblockedNeedingReview(
            await sessionStatus(product, workspace, "s", rederived),
            added.id,
            `${rederived}, \`review status s --json\` at the same state`,
          );
          // The human form at the same state names the item returned
          // (T12.0-1, SPEC 12.0; the module header).
          await assertHumanNextItem(product, workspace, "s", added, rederived);
        },
      });
    },
  );

  // --- arm 2: a session with no items reports fully resolved --------------
  await withWorkspace(SPECS_ONLY_CONFIG, {}, async (workspace) => {
    const emptyPrefix = `${prefix} empty-session arm`;
    // The configured spec group matches no file: a zero-source group is a
    // valid workspace (SPEC 7), and audit derives one item per requirement
    // node — zero nodes, zero items (SPEC 10.6).
    await buildOk(product, workspace, `${emptyPrefix} \`build\``);
    await createAuditSession(product, workspace, "s", emptyPrefix);
    const status = await sessionStatus(product, workspace, "s", emptyPrefix);
    if (status.items.length !== 0) {
      fail(
        `${emptyPrefix} staging premise: an audit session over a workspace ` +
          `with no requirement nodes holds no items (SPEC 10.6); got ` +
          JSON.stringify(rowSequence(status)),
      );
    }
    await visit(workspace, {
      label: emptyPrefix,
      session: "s",
      home: () =>
        expectFullyResolvedBothForms(
          product,
          workspace,
          "s",
          `${emptyPrefix}:`,
        ),
    });
  });

  // --- arm 3: the self-contained --json payload ----------------------------
  // Source ranges are asserted for EVERY present payload node — requirement
  // node and present code location alike — and for none of the absent ones
  // (SPEC 10.7, 1.7): the walk below reaches the code-impact item, whose
  // scope is first a present code location (named-unit construct range,
  // precomputed byte offsets) and then, after the code file's deletion, an
  // absent one (identity and absence alone — no text, no range).
  await withWorkspace(
    SPECS_CODE_CONFIG,
    { [N7_PB_FILE]: T10_7_7_A2_KID_V0 },
    async (workspace) => {
      const payloadPrefix = `${prefix} payload arm`;
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");
      await buildOk(product, workspace, `${payloadPrefix} \`build\` at v0`);
      const akAtBase = await queryNode(
        product,
        workspace,
        N7_AK,
        `${payloadPrefix} baseline capture`,
      );

      // v1: the reviewed edit, plus the code source whose named unit
      // references a.k — the impacted location (SPEC 9.2) whose
      // code-impact item the walk below reaches.
      await workspace.file(N7_PB_FILE, T10_7_7_A2_KID_V1);
      await workspace.file(N7_CODE_FILE, N7_CODE_SOURCE);
      await buildOk(product, workspace, `${payloadPrefix} \`build\` at v1`);
      const akAtCreate = await queryNode(
        product,
        workspace,
        N7_AK,
        `${payloadPrefix} creation capture`,
      );
      const aNow = await queryNode(
        product,
        workspace,
        N7_A,
        `${payloadPrefix} current capture of a`,
      );
      const rootNow = await queryNode(
        product,
        workspace,
        N7_PB_ROOT,
        `${payloadPrefix} current capture of the root`,
      );
      assertPairwiseDistinct(
        [
          ["the v0 subtreeHash of a.k", akAtBase.hashes.subtreeHash],
          ["the v1 subtreeHash of a.k", akAtCreate.hashes.subtreeHash],
          ["a.k's metadataHash", akAtBase.hashes.metadataHash],
        ],
        payloadPrefix,
      );
      if (akAtBase.ownText === akAtCreate.ownText) {
        fail(
          `${payloadPrefix} staging premise: the a.k edit must change its ` +
            `own text (SPEC 1.6) so the origin pair's sides differ`,
        );
      }

      await createBaseSession(product, workspace, base, "s", payloadPrefix);

      // The changed leaf's subtree-coherence item is first in item order
      // (depth-deepest first) and unblocked (SPEC 10.5). The staging's own
      // read yields the item it resolves before the next read; the home
      // test asserts over it.
      const item = requireNextItem(
        await nextInSession(product, workspace, "s", payloadPrefix),
        payloadPrefix,
      );
      await visit(workspace, {
        label: `${payloadPrefix} (the first item)`,
        session: "s",
        home: async () => {
          if (item.kind !== "subtree-coherence" || item.scope.node !== N7_AK) {
            fail(
              `${payloadPrefix}: the first needing-review unblocked item is ` +
                `a.k's subtree-coherence item — deepest first, and the ` +
                `parent-consistency item is blocked (SPEC 10.5, 10.7); got ` +
                `${item.kind} ${item.scope.node}`,
            );
          }

          // Self-contained payload (SPEC 10.7): scope with subtree text and
          // source range; context (the ancestor chain) with own texts and
          // source ranges; origin with the before/after own-text pair AND
          // the origin node's current source range (every present payload
          // node carries one, SPEC 10.7, 1.7); the recorded baseline and
          // current hashes.
          assertPresentState(
            item.scope,
            {
              node: N7_AK,
              text: akAtCreate.subtreeText,
              sourceRange: akAtCreate.sourceRange,
            },
            `${payloadPrefix} scope (subtree-coherence scope text is the ` +
              `scope root's subtree text)`,
          );
          assertSameJson(
            identitySet(item.context),
            [N7_A, N7_PB_ROOT].sort(),
            `${payloadPrefix}: the context is a.k's ancestor chain (SPEC 10.5)`,
          );
          assertPresentState(
            requireContextEntry(item, N7_A, payloadPrefix),
            { node: N7_A, text: aNow.ownText, sourceRange: aNow.sourceRange },
            `${payloadPrefix} context entry a (ancestor-chain context ` +
              `carries own text)`,
          );
          assertPresentState(
            requireContextEntry(item, N7_PB_ROOT, payloadPrefix),
            {
              node: N7_PB_ROOT,
              text: rootNow.ownText,
              sourceRange: rootNow.sourceRange,
            },
            `${payloadPrefix} context entry root (ancestor-chain context ` +
              `carries own text)`,
          );
          assertSameJson(
            identitySet(item.origin),
            [N7_AK],
            `${payloadPrefix}: the origin is the changed node (SPEC 10.5)`,
          );
          const akOrigin = requireOriginEntry(item, N7_AK, payloadPrefix);
          assertOriginPair(
            akOrigin,
            {
              before: { present: true, text: akAtBase.ownText },
              after: { present: true, text: akAtCreate.ownText },
            },
            `${payloadPrefix} origin pair for a.k — before from the item's ` +
              `baseline state, after from the current graph`,
          );
          assertOriginRange(
            akOrigin,
            akAtCreate.sourceRange,
            `${payloadPrefix} origin entry a.k`,
          );
          assertRecordedHolds(
            item.baseline,
            akAtBase.hashes.subtreeHash,
            "the scope node's baseline subtreeHash",
            `${payloadPrefix} payload \`baseline\``,
          );
          assertRecordedHolds(
            item.baseline,
            akAtBase.hashes.metadataHash,
            "the scope node's baseline metadataHash",
            `${payloadPrefix} payload \`baseline\``,
          );
          assertRecordedLacks(
            item.baseline,
            akAtCreate.hashes.subtreeHash,
            "the creation-time subtreeHash",
            `${payloadPrefix} payload \`baseline\``,
          );
          assertRecordedHolds(
            item.current,
            akAtCreate.hashes.subtreeHash,
            "the scope node's creation-time subtreeHash",
            `${payloadPrefix} payload \`current\``,
          );
          assertRecordedLacks(
            item.current,
            akAtBase.hashes.subtreeHash,
            "the baseline subtreeHash",
            `${payloadPrefix} payload \`current\``,
          );
          // The human form at the same state names the item returned
          // (T12.0-1, SPEC 12.0; the module header) — at each of the arm's
          // four reads, before anything mutates the session.
          await assertHumanNextItem(
            product,
            workspace,
            "s",
            item,
            payloadPrefix,
          );
        },
      });

      // Walk to the code-impact item (item order: the two spec items
      // precede the code location's, whose file path sorts after
      // specs/…; `resolve --status no-change` never re-derives, SPEC
      // 10.5). The parent's item, unblocked by the leaf's resolve, is
      // returned next — its scope a present requirement node with own
      // text and source range.
      await resolveOk(
        product,
        workspace,
        "s",
        item.id,
        "no-change",
        `${payloadPrefix} \`resolve s <a.k's item> --status no-change\``,
      );
      const secondLabel = `${payloadPrefix} second`;
      const second = requireNextItem(
        await nextInSession(product, workspace, "s", secondLabel),
        secondLabel,
      );
      await visit(workspace, {
        label: secondLabel,
        session: "s",
        home: async () => {
          if (
            second.kind !== "parent-consistency" ||
            second.scope.node !== N7_A
          ) {
            fail(
              `${payloadPrefix}: after resolving a.k's item, the first ` +
                `needing-review unblocked item is a's parent-consistency ` +
                `item (SPEC 10.5, 10.7); got ${second.kind} ` +
                `${second.scope.node}`,
            );
          }
          assertPresentState(
            second.scope,
            { node: N7_A, text: aNow.ownText, sourceRange: aNow.sourceRange },
            `${payloadPrefix} second scope (parent-consistency scope text ` +
              `is the scope node's own text)`,
          );
          await assertHumanNextItem(
            product,
            workspace,
            "s",
            second,
            secondLabel,
          );
        },
      });
      await resolveOk(
        product,
        workspace,
        "s",
        second.id,
        "no-change",
        `${payloadPrefix} \`resolve s <a's item> --status no-change\``,
      );

      // The code-impact item: its scope is a PRESENT code location —
      // identity, presence, and the named unit's construct range,
      // byte-asserted against precomputed offsets (review payloads are
      // one of the two range-presenting outputs for code locations,
      // SPEC 1.7, 4.6), with no text value; its context and origin nodes
      // are present requirement nodes carrying their ranges.
      const codeLabel = `${payloadPrefix} code item`;
      const codeItem = requireNextItem(
        await nextInSession(product, workspace, "s", codeLabel),
        codeLabel,
      );
      await visit(workspace, {
        label: codeLabel,
        session: "s",
        home: async () => {
          if (
            codeItem.kind !== "code-impact" ||
            codeItem.scope.node !== N7_CODE
          ) {
            fail(
              `${payloadPrefix}: after resolving both spec items, the ` +
                `remaining needing-review item is the impacted location's ` +
                `code-impact item (SPEC 9.2, 10.5, 10.7); got ` +
                `${codeItem.kind} ${codeItem.scope.node}`,
            );
          }
          const codeImpact = `${payloadPrefix} code-impact(${N7_CODE})`;
          assertPresentState(
            codeItem.scope,
            { node: N7_CODE, text: undefined, sourceRange: N7_CODE_RANGE },
            `${codeImpact} scope — a present code location enters the ` +
              `payload with its source range (the construct binding the ` +
              `unit's name, precomputed byte offsets) and no text (SPEC ` +
              `10.7, 1.7, 4.6)`,
          );
          assertSameJson(
            identitySet(codeItem.context),
            [N7_AK],
            `${codeImpact}: context is the impact-edge target (SPEC 9.2, ` +
              `10.5)`,
          );
          assertPresentState(
            requireContextEntry(codeItem, N7_AK, codeImpact),
            {
              node: N7_AK,
              text: akAtCreate.subtreeText,
              sourceRange: akAtCreate.sourceRange,
            },
            `${codeImpact} context entry a.k — code-impact targets carry ` +
              `subtree text, with the present node's source range`,
          );
          assertSameJson(
            identitySet(codeItem.origin),
            [N7_AK],
            `${codeImpact}: origin is the originating node (SPEC 5.6, 10.5)`,
          );
          const codeItemOrigin = requireOriginEntry(
            codeItem,
            N7_AK,
            codeImpact,
          );
          assertOriginPair(
            codeItemOrigin,
            {
              before: { present: true, text: akAtBase.ownText },
              after: { present: true, text: akAtCreate.ownText },
            },
            `${codeImpact} origin pair for a.k`,
          );
          assertOriginRange(
            codeItemOrigin,
            akAtCreate.sourceRange,
            `${codeImpact} origin entry a.k`,
          );
          await assertHumanNextItem(
            product,
            workspace,
            "s",
            codeItem,
            codeLabel,
          );
        },
      });

      // None for absent nodes (SPEC 10.7, 1.7): delete the code file —
      // the location leaves the current graph while the workspace stays
      // valid (a zero-source code group, SPEC 7) — and the still-
      // unresolved item presents its scope ABSENT: identity and absence
      // alone, no text (a code location has none and no recorded state
      // supplies one), no source range; the present context and origin
      // nodes keep their ranges. Reads never re-derive, so it is the
      // same item (SPEC 10.5, 10.7).
      await fsp.rm(workspace.path(N7_CODE_FILE));
      await buildOk(
        product,
        workspace,
        `${payloadPrefix} \`build\` after the deletion`,
      );
      const goneLabel = `${payloadPrefix} deleted`;
      const goneItem = requireNextItem(
        await nextInSession(product, workspace, "s", goneLabel),
        goneLabel,
      );
      await visit(workspace, {
        label: goneLabel,
        session: "s",
        home: async () => {
          if (goneItem.id !== codeItem.id) {
            fail(
              `${payloadPrefix}: deleting the code file re-derives nothing ` +
                `— \`next\` still returns the same unresolved code-impact ` +
                `item (SPEC 10.5, 10.7); expected ${codeItem.id}, got ` +
                `${goneItem.id} (${goneItem.kind} ${goneItem.scope.node})`,
            );
          }
          const gone = `${payloadPrefix} code-impact(${N7_CODE}) after deletion`;
          assertAbsentState(
            goneItem.scope,
            { node: N7_CODE, text: undefined },
            `${gone} scope — a deleted code location's entry carries no ` +
              `source range and no text (SPEC 10.7, 1.7)`,
          );
          assertPresentState(
            requireContextEntry(goneItem, N7_AK, gone),
            {
              node: N7_AK,
              text: akAtCreate.subtreeText,
              sourceRange: akAtCreate.sourceRange,
            },
            `${gone} context entry a.k — still present, still ranged`,
          );
          const goneOrigin = requireOriginEntry(goneItem, N7_AK, gone);
          assertOriginPair(
            goneOrigin,
            {
              before: { present: true, text: akAtBase.ownText },
              after: { present: true, text: akAtCreate.ownText },
            },
            `${gone} origin pair for a.k`,
          );
          assertOriginRange(
            goneOrigin,
            akAtCreate.sourceRange,
            `${gone} origin entry a.k`,
          );
          await assertHumanNextItem(
            product,
            workspace,
            "s",
            goneItem,
            goneLabel,
          );
        },
      });
    },
  );
}

const T10_7_7 = defineProductTest({
  id: "T10.7-7",
  title:
    "`review next`: returns the first needing-review unblocked item in item order — in an audit session with blocked root and parent items it returns the first leaf, then the second, then moves backward in item order to the meanwhile-unblocked parent and root; when all items are resolved, and for a session with no items, it exits 0 and reports fully resolved in the human and `--json` forms with no item in the JSON payload; full resolution concerns the session's items alone — with every item resolved, a new spec source holding one section added leaves `next` reporting the session fully resolved in both forms, no item in the JSON payload, and once a resolved leaf item is re-resolved `updated` (the session re-derived) `next` returns the new section's item, `unresolved` and the first unblocked item needing review (every earlier item in `status`'s item order resolved or blocked); the `--json` payload is self-contained — scope text, context texts, origin before/after texts, source ranges for every present node, requirement node and present code location alike (scope, context, and origin entries; the code-impact scope's named-unit construct range byte-asserted against precomputed offsets) and none for absent nodes (after the code file's deletion the same item's scope presents identity and absence alone — no text, no range), and the recorded `baseline` and `current` hashes (asserted against distinct `query node` captures at the baseline and creation moments); and wherever `next --json` returns an item, the human `review next` at the same state exits 0 and names that item by its id (robust matching, H-3) (SPEC 1.7, 4.6, 9.2, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 12.0)",
  run: async (product) => {
    await runT1077Reads(product, (_workspace, read) => read.home());
  },
});
// ---------------------------------------------------------------------------
// T10.7-8 — show/export
// ---------------------------------------------------------------------------

/**
 * The non-blank lines of a text value, each trimmed — the form a human
 * report's text mentions take (helpers/adapters/human.ts: literal data, each
 * line a plain substring); none for an absent value. Exported for
 * section-12.3-12.5.ts' human `show` check (T12.4-1).
 */
export function nonBlankLines(text: string | undefined): readonly string[] {
  if (text === undefined) return [];
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Every string leaf and every member name of a decoded JSON value — the
 * literal data a product-shaped recorded state (`baseline`, `current`;
 * H-4) carries, its hashes and the identities it keys nodes by alike.
 */
function stringLeavesAndMemberNames(value: unknown): readonly string[] {
  // H-11: an explicit stack, never native recursion per nesting level.
  const into: string[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (typeof current === "string") {
      into.push(current);
    } else if (Array.isArray(current)) {
      for (const element of current) stack.push(element);
    } else if (current !== null && typeof current === "object") {
      for (const [member, element] of Object.entries(current)) {
        into.push(member);
        stack.push(element);
      }
    }
  }
  return into;
}

/**
 * The human `review show <name> <item-id>` at the state of a decoded `review
 * show <name> <item-id> --json` item, after that item's own assertions —
 * T12.0-1's information parity (SPEC 12.0: the JSON form carries the same
 * information as the human report; the module header): the same argv
 * without `--json` exits 0, and its report mentions what the decoded item
 * carries (SPEC 10.2, 10.7: every 10.2 field plus the self-contained text
 * payload) — its id and each `blockedBy` id (item-id boundaries, so
 * `item-1` never counts inside `item-10`), its kind and status, `blocked`
 * where it is blocked, and `absent` wherever it presents a node or an origin
 * side absent (SPEC-named tokens; 10.3, 10.7: "presented absent"), its
 * scope, context, and origin identities (identity boundaries, so the root's
 * `specs/X.mdx` never counts inside `specs/X.mdx#x`), every non-blank line
 * of every text it carries — scope, context, and origin before and after —
 * and of its note (trimmed), and each hash of the given `query node`
 * captures that its `baseline` or `current` holds as a string leaf
 * (product-to-itself, no hash pinned: the recorded state is product-shaped,
 * H-4); then, in a separate call, the start and end of every source range
 * it carries (whole numbers, matched with the item's digit-holding data
 * blanked out — the session name, ids, identities, text and note lines, the
 * `reason`'s lines, and every string leaf and member name of `baseline` and
 * `current`, whose hashes and node identities a report may print — save a
 * datum that is itself a whole number, `digitHoldingData`). The `reason`
 * is free text and never compared (H-3); it is only blanked, so its digits
 * (a `SPEC 10.6` citation) never stand in for an offset. Robust matching
 * (H-3): presence, never wording, and no mention associated with another.
 */
async function assertHumanShowItem(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  item: ReviewItem,
  context: string,
  captures: readonly NodeReport[] = [],
): Promise<void> {
  const label = `${context} \`review show ${name} ${item.id}\` (human report)`;
  const human = await expectExit(
    product,
    workspace,
    ["review", "show", name, item.id],
    0,
    `${label} — the same exit code as the \`--json\` read at this state ` +
      `(SPEC 10.7, 12.0)`,
  );
  const identities = new Set<string>([
    item.scope.node,
    ...item.context.map((state) => state.node),
    ...item.origin.map((entry) => entry.node),
  ]);
  const texts: string[] = [];
  const offsets = new Set<number>();
  let absent = false;
  for (const state of [item.scope, ...item.context]) {
    if (!state.present) absent = true;
    if (state.text !== undefined) texts.push(state.text);
    if (state.sourceRange !== undefined) {
      offsets.add(state.sourceRange.start);
      offsets.add(state.sourceRange.end);
    }
  }
  for (const entry of item.origin) {
    for (const side of [entry.before, entry.after]) {
      if (side.present) texts.push(side.text);
      else absent = true;
    }
    if (entry.sourceRange !== undefined) {
      offsets.add(entry.sourceRange.start);
      offsets.add(entry.sourceRange.end);
    }
  }
  const lines = new Set(texts.flatMap(nonBlankLines));
  const noteLines = nonBlankLines(item.note);
  const recorded = [
    ...collectStringLeaves(item.baseline),
    ...collectStringLeaves(item.current),
  ];
  const hashes = new Set<string>();
  for (const capture of captures) {
    for (const hash of Object.values(capture.hashes)) {
      if (recorded.includes(hash)) hashes.add(hash);
    }
  }
  const tokens = new Set<string>([item.kind, item.status]);
  if (item.blocked) tokens.add("blocked");
  if (absent) tokens.add("absent");
  const mentions: Mention[] = [
    nameMention(item.id),
    ...[...new Set(item.blockedBy)].map(nameMention),
    ...[...identities].map(identityMention),
    ...lines,
    ...noteLines,
    ...hashes,
    ...[...tokens].map(specTokenMention),
  ];
  assertReportMentions(
    human,
    mentions,
    `${label}: the full item — its id, kind, and status, \`blocked\` where ` +
      `it is blocked and each \`blockedBy\` id, its note, its scope, ` +
      `context, and origin identities, \`absent\` wherever it presents a ` +
      `node or an origin side absent, every line of the texts it carries, ` +
      `and the captured hashes its \`baseline\` and \`current\` hold — the ` +
      `information of the JSON item (SPEC 10.2, 10.3, 10.7, 12.0)`,
  );
  if (offsets.size > 0) {
    assertReportMentions(
      human,
      [...offsets].map(numberMention),
      `${label}: the start and end of every source range the item carries, ` +
        `whole numbers, matched with the item's digit-holding data — the ` +
        `session name, ids, identities, text and note lines, the reason, ` +
        `and the recorded states' string leaves and member names — blanked ` +
        `out, save a datum that is itself a whole number (SPEC 1.7, 10.7, ` +
        `12.0)`,
      {
        blank: digitHoldingData([
          ...new Set([
            name,
            item.id,
            ...item.blockedBy,
            ...identities,
            ...lines,
            ...noteLines,
            ...nonBlankLines(item.reason),
            ...stringLeavesAndMemberNames(item.baseline),
            ...stringLeavesAndMemberNames(item.current),
          ]),
        ]),
      },
    );
  }
}

const E8_FILE = "specs/X.mdx";
const E8_X = "specs/X.mdx#x";
const E8_XK = "specs/X.mdx#x.k";

function e8Spec(kidText: string): string {
  return [
    '<S id="x">',
    "Ex own line.",
    "",
    '<S id="x.k">',
    kidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// The workspace's initial specs/X.mdx: T12.0-15 (section-12.0-iv.ts) runs
// this staging after its body's first invocation, so it is a staged-source
// record (helpers/staged-mdx.ts, S-9's timing clause) — the same expression,
// moved into the record. The x.k edit follows the body's first `build`, so
// it is one too (S-9: judged before any product exists).
const T10_7_8_X_KAY_V0 = stagedMdx(
  "T10.7-8/T12.0-15 specs/X.mdx with x.k's text at v0 (the show/export fixture's initial source)",
  e8Spec("Kay line v0."),
);
const T10_7_8_X_KAY_V1 = stagedMdx(
  "T10.7-8 specs/X.mdx with x.k's text at v1 (the edit invalidating its stored no-change)",
  e8Spec("Kay line v1."),
);

/**
 * One `review show` read T10.7-8's staging reaches — x.k's item (the item
 * `next` returns) and the root's item, blocked by x's — handed to the
 * staging's visitor at the state it reads: its label, the session and the
 * item it reads, and the home test's own `review show --json` read with its
 * assertions and the human form's parity check (`home`). Exported for
 * T12.0-15 (section-12.0-iv.ts), which hands its human twin of the read in
 * their place.
 */
export interface T1078Read {
  readonly label: string;
  readonly session: string;
  readonly itemId: string;
  readonly home: () => Promise<void>;
}

/** A visitor of T10.7-8's `review show` reads, each at the state it reads. */
export type T1078ReadVisitor = (
  workspace: TestWorkspace,
  read: T1078Read,
) => Promise<void>;

/** The ids of T10.7-8's three audit items, as `status` reports them. */
interface T1078Ids {
  readonly idRoot: string;
  readonly idX: string;
  readonly idXK: string;
}

/**
 * T10.7-8's staging, its two `review show` reads handed to `visit`
 * (exported for T12.0-15): a workspace of `SPECS_ONLY_CONFIG` and
 * specs/X.mdx (x holding x.k), built; the audit session s; the item
 * `next --json` returns, read by the staging, its id the first read's —
 * x.k's item, the first needing-review unblocked item; then the items' ids
 * read from `status` (the premise: one item per node), the root's the
 * second read's. `rest` — T10.7-8's continuation on the same workspace:
 * the split, `export`, the unknown item IDs, and the read-time
 * invalidation — runs last where given. `prefix` leads every staging
 * step's diagnosis.
 */
export async function runT1078ShowReads(
  product: ProductBinding,
  visit: T1078ReadVisitor,
  prefix = "T10.7-8",
  rest?: (workspace: TestWorkspace, ids: T1078Ids) => Promise<void>,
): Promise<void> {
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { [E8_FILE]: T10_7_8_X_KAY_V0 },
    async (workspace) => {
      await buildOk(product, workspace, `${prefix} \`build\``);
      await createAuditSession(product, workspace, "s", prefix);

      // `show` = the full item with the same payload as `next --json`:
      // compare the item `next` returns against `show` of the same id,
      // whole (same read state, nothing mutated between). The staging's
      // own `next --json` read yields the id.
      const nextItem = requireNextItem(
        await nextInSession(product, workspace, "s", prefix),
        prefix,
      );
      const xkLabel = `${prefix} x.k's item`;
      await visit(workspace, {
        label: xkLabel,
        session: "s",
        itemId: nextItem.id,
        home: async () => {
          if (nextItem.scope.node !== E8_XK) {
            fail(
              `${prefix}: the first needing-review unblocked item in audit ` +
                `order is x.k's — the root's and x's items are blocked ` +
                `(SPEC 10.3, 10.6); got ${nextItem.scope.node}`,
            );
          }
          const shown = await showItem(
            product,
            workspace,
            "s",
            nextItem.id,
            prefix,
          );
          assertSameInformation(
            shown,
            nextItem,
            `${prefix}: \`show <name> <item-id>\` reports the full item — ` +
              `every 10.2 field plus the same self-contained text payload ` +
              `as \`next --json\` (SPEC 10.7)`,
          );
          // The human form at the same state (T12.0-1, SPEC 12.0; the
          // module header): x.k's item, with a `query node` capture of x.k
          // taken at this state for the hashes its recorded state holds.
          const xkNow = await queryNode(
            product,
            workspace,
            E8_XK,
            `${prefix} capture of x.k`,
          );
          await assertHumanShowItem(product, workspace, "s", shown, xkLabel, [
            xkNow,
          ]);
        },
      });

      const status = await sessionStatus(product, workspace, "s", prefix);
      const idRoot = requireRow(
        status,
        "subtree-coherence",
        E8_FILE,
        prefix,
      ).id;
      const idX = requireRow(status, "subtree-coherence", E8_X, prefix).id;
      const idXK = requireRow(status, "subtree-coherence", E8_XK, prefix).id;

      // The root's item at the same state — nothing has mutated since the
      // reads above — through `show --json`, then its human form: an item
      // that is blocked, with a non-empty `blockedBy` (x's item, the
      // root's one child section's, unresolved: SPEC 10.3, 10.6).
      const rootLabel = `${prefix} root's item`;
      await visit(workspace, {
        label: rootLabel,
        session: "s",
        itemId: idRoot,
        home: async () => {
          const rootShown = await showItem(
            product,
            workspace,
            "s",
            idRoot,
            rootLabel,
          );
          assertSameJson(
            {
              id: rootShown.id,
              kind: rootShown.kind,
              scope: rootShown.scope.node,
              status: rootShown.status,
              blocked: rootShown.blocked,
            },
            {
              id: idRoot,
              kind: "subtree-coherence",
              scope: E8_FILE,
              status: "unresolved",
              blocked: true,
            },
            `${rootLabel}: \`show\` reports the root's audit item — ` +
              `unresolved, and blocked while its child x's item is ` +
              `unresolved (SPEC 10.2, 10.3, 10.6, 10.7)`,
          );
          assertBlockedBy(
            rootShown,
            [idX],
            `${rootLabel} — an audit item is blocked by its child ` +
              `sections' items, here x's (SPEC 10.6)`,
          );
          await assertHumanShowItem(
            product,
            workspace,
            "s",
            rootShown,
            rootLabel,
          );
        },
      });

      await rest?.(workspace, { idRoot, idX, idXK });
    },
  );
}

const T10_7_8 = defineProductTest({
  id: "T10.7-8",
  title:
    "`review show <name> <item-id>` reports the full item — the 10.2 fields plus the identical self-contained text payload as `next --json` (compared whole against the item `next` returns); an unknown item ID, including the id of an item removed by `split`, is exit 2; `review export <name>` emits one JSON document as its only output form — byte-parsed and information-identical with and without `--json` — containing the session's name, strategy, recorded creation parameters, recorded decompositions (holding the split item's scope-node identity), and every item in item order with its fields, blocked state, payload, and read-time invalidation applied (a stored `no-change` under an edited scope exports as `invalidated`, re-blocking its dependents); and the human `review show` at the same state as a `show --json` read — of the item `next` returns and of the root's item, blocked by its child's — exits 0 and mentions the item's id, kind, and status, `blocked` where it is blocked, each `blockedBy` id, its scope and context identities, every line of its texts, its source ranges' offsets, and the recorded hashes `query node` captured (robust matching, H-3) (SPEC 1.7, 10.2, 10.3, 10.4, 10.6, 10.7, 12.0)",
  run: async (product) => {
    await runT1078ShowReads(
      product,
      (_workspace, read) => read.home(),
      "T10.7-8",
      async (workspace, { idRoot, idX, idXK }) => {
        const prefix = "T10.7-8";
        // Stage the decomposition: resolve x.k's item so nothing blocks
        // x's, then split x's item (x has the one child x.k).
        await resolveOk(
          product,
          workspace,
          "s",
          idXK,
          "no-change",
          `${prefix} \`resolve s <x.k's item> --status no-change\``,
        );
        await expectExit(
          product,
          workspace,
          ["review", "split", "s", idX],
          0,
          `${prefix} \`review split s <x's item>\``,
        );

        // Export, with and without --json: one JSON document either way,
        // carrying the same information (SPEC 10.7: export's only output
        // form).
        const exportJsonLabel = `${prefix} \`review export s --json\``;
        const withJson = decodeExportReport(
          await runJson(
            product,
            workspace,
            ["review", "export", "s", "--json"],
            exportJsonLabel,
          ),
          exportJsonLabel,
        );
        const exportBareLabel = `${prefix} \`review export s\` (no --json)`;
        const bareResult = await expectExit(
          product,
          workspace,
          ["review", "export", "s"],
          0,
          exportBareLabel,
        );
        const withoutJson = decodeExportReport(
          parseJsonStdout(bareResult, exportBareLabel),
          exportBareLabel,
        );
        assertSameInformation(
          withoutJson,
          withJson,
          `${prefix}: \`export\` emits one JSON document as its only output ` +
            `form — with or without --json, the same information (SPEC 10.7)`,
        );

        // Name, strategy, and the recorded decomposition (the adapter
        // decodes each one's kind and scope node; the decomposed item's
        // scope-node identity is a spec-fixed value the record must hold —
        // SPEC 10.7: the decomposition is the original's kind and scope
        // node, replaced by its items).
        if (withJson.name !== "s" || withJson.strategy !== "audit") {
          fail(
            `${prefix}: \`export\` carries the session's name and strategy ` +
              `(SPEC 10, 10.7); got name ${JSON.stringify(withJson.name)}, ` +
              `strategy ${JSON.stringify(withJson.strategy)}`,
          );
        }
        if (!withJson.decompositions.some((entry) => entry.scope === E8_X)) {
          fail(
            `${prefix}: after \`split\` of x's item, the exported recorded ` +
              `decompositions must hold the decomposed item's scope node ` +
              `${JSON.stringify(E8_X)} (SPEC 10.7: the decomposition — the ` +
              `original's kind and scope node, replaced by its items — is ` +
              `recorded durably); their scope nodes are ` +
              canonicalJson(
                withJson.decompositions.map((entry) => entry.scope),
              ),
          );
        }
        // `creationParameters` presence is enforced by the adapter decode
        // (an audit session records none — the member still exists as an
        // explicit "none"); its content is T10.7-2's business.

        // Item order after the split (SPEC 10.6, 10.7): root, then x's
        // parent-consistency item (scope x precedes x.k in document
        // order), then x.k's reused item.
        assertSameJson(
          exportKindScopeSequence(withJson.items),
          [
            `subtree-coherence ${E8_FILE}`,
            `parent-consistency ${E8_X}`,
            `subtree-coherence ${E8_XK}`,
          ],
          `${prefix}: \`export\` presents every item in item order — the ` +
            `original subtree-coherence item for x is removed, its ` +
            `decomposition's parent-consistency item ordering at x's ` +
            `document position (SPEC 10.6, 10.7)`,
        );
        const pcX = requireItem(
          withJson.items,
          "parent-consistency",
          E8_X,
          prefix,
        );
        if (
          requireItem(withJson.items, "subtree-coherence", E8_XK, prefix).id !==
          idXK
        ) {
          fail(
            `${prefix}: the split reuses x.k's existing item — same id ` +
              `(SPEC 10.7)`,
          );
        }

        // Unknown item IDs are usage errors, exit 2 (SPEC 10.7, 12.0): a
        // never-existing id, and the split-removed original's id.
        for (const [unknownId, why] of [
          ["no-such-item", "a never-existing item id"],
          [idX, "the id of the item `split` removed from the session"],
        ] as const) {
          const context = `${prefix} \`review show s ${unknownId} --json\` (${why})`;
          const result = await expectExit(
            product,
            workspace,
            ["review", "show", "s", unknownId, "--json"],
            2,
            `${context} — an unknown item ID in a review command's ` +
              `arguments is a usage error (SPEC 10.7, 12.0)`,
          );
          expectErrorDocument(
            result,
            `${context} — under --json, the exit-2 error document is the ` +
              `entire stdout (SPEC 12.0, 12.7, H-5)`,
          );
        }

        // Read-time invalidation applied to export (SPEC 10.4, 10.7): edit
        // x.k so its stored no-change goes stale — the exported item reads
        // invalidated and re-blocks its dependents, without rewriting the
        // stored status (list-side counting is T10.7-5's business).
        await workspace.file(E8_FILE, T10_7_8_X_KAY_V1);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the x.k edit`,
        );
        const stale = await exportSession(product, workspace, "s", prefix);
        assertSameJson(
          stale.items.map((item) => ({
            kind: item.kind,
            scope: item.scope.node,
            status: item.status,
            blocked: item.blocked,
          })),
          [
            {
              kind: "subtree-coherence",
              scope: E8_FILE,
              status: "unresolved",
              blocked: true,
            },
            {
              kind: "parent-consistency",
              scope: E8_X,
              status: "unresolved",
              blocked: true,
            },
            {
              kind: "subtree-coherence",
              scope: E8_XK,
              status: "invalidated",
              blocked: false,
            },
          ],
          `${prefix} after the x.k edit: \`export\` applies read-time ` +
            `invalidation — the stale no-change reads invalidated and, not ` +
            `being a resolved status, re-blocks x's parent-consistency item ` +
            `and through it the root's (SPEC 10.3, 10.4, 10.7)`,
        );
        // The dependents' blockedBy pins why they are blocked: the root's
        // item was blocked by the original and is now blocked by all items
        // of its decomposition (T10.7-9 asserts this in depth).
        assertBlockedBy(
          requireItemById(stale.items, idRoot, prefix),
          [pcX.id, idXK],
          `${prefix}: the root's item, previously blocked by the original, ` +
            `is blocked by all items of the decomposition (SPEC 10.7)`,
        );
      },
    );
  },
});
// ---------------------------------------------------------------------------
// T10.7-9 — split
// ---------------------------------------------------------------------------

// The path-blocks fixture (TEST-SPEC T10.7-9): specs/N.mdx holds the
// top-level N, holding N.a and N.b, then the top-level M, holding M.k. N's
// own text and N.a's text are edited before `create --base`: N is visited
// (`changed`, no `changed` ancestor) and its item's scope is {N, N.a, N.b};
// N.a is skipped beneath it, and N, top-level, has no non-root ancestor, so
// the session holds N's item alone (SPEC 10.5). N's item is resolved
// `no-change`, M.k's text then edited, and N's item split.
const PB_FILE = "specs/N.mdx";
const PB_ROOT = "specs/N.mdx";
const PB_N = "specs/N.mdx#N";
const PB_NA = "specs/N.mdx#N.a";
const PB_NB = "specs/N.mdx#N.b";
const PB_M = "specs/N.mdx#M";
const PB_MK = "specs/N.mdx#M.k";

/**
 * specs/N.mdx's bytes: N, its own text `nOwn`, holding N.a (`naText`) and
 * N.b, then M holding M.k (`mkText`), every tag alone on its line.
 */
function pbSource(nOwn: string, naText: string, mkText: string): string {
  return [
    '<S id="N">',
    nOwn,
    "",
    '<S id="N.a">',
    naText,
    "</S>",
    "",
    '<S id="N.b">',
    "En bee text.",
    "</S>",
    "</S>",
    "",
    '<S id="M">',
    "Em own text.",
    "",
    '<S id="M.k">',
    mkText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// The path-blocks fixture's M.k edit follows the body's first `build`, so it
// is a staged-source record (helpers/staged-mdx.ts, S-9: judged before any
// product exists); its baseline and the edit of N and N.a precede the body's
// first product invocation and stay plain (S-7's sweep reaches them against
// the stub).
const T10_7_9_N_MK_EDITED = stagedMdx(
  "T10.7-9 specs/N.mdx with N's own text, N.a's, and M.k's edited (the path-blocks fixture, after N's resolve)",
  pbSource("En own v1.", "En ay text v1.", "Em kay text v1."),
);

// The deleted-children arm (TEST-SPEC T10.7-9(f)): specs/P.mdx holds the
// top-level P whose only children are P.a and P.b, each one's text carrying
// a token no other node's own text spells, committed as the baseline; both
// children's sections are then deleted, nothing else edited. P is `changed`
// (it lost them, SPEC 5.5, 5.6) and visited, and its item's scope is {P,
// P.a, P.b}: in a baseline session a deleted node is the child of its
// baseline parent (10.5).

/** T10.7-9(f)'s one source path: P, P.a, and P.b in specs/P.mdx. */
export const T10_7_9_P_FILE = "specs/P.mdx";

/** T10.7-9(f)'s node identities (TEST-SPEC's P, P.a, P.b; SPEC 1.5). */
export const T10_7_9_P_NODES = {
  root: "specs/P.mdx",
  p: "specs/P.mdx#P",
  pa: "specs/P.mdx#P.a",
  pb: "specs/P.mdx#P.b",
} as const;

const PD_FILE = T10_7_9_P_FILE;
const PD_ROOT = T10_7_9_P_NODES.root;
const PD_P = T10_7_9_P_NODES.p;
const PD_PA = T10_7_9_P_NODES.pa;
const PD_PB = T10_7_9_P_NODES.pb;

/** P.a's and P.b's tokens: no other node's own text spells either. */
const PD_TOKEN_A = "ALPHATOKEN";
const PD_TOKEN_B = "BETATOKEN";

/**
 * specs/P.mdx's bytes: P, its own text, holding — `withChildren` — P.a and
 * P.b, each child's text carrying its token, every tag alone on its line.
 */
function pdSource(withChildren: boolean): string {
  return [
    '<S id="P">',
    "Pee own text.",
    ...(withChildren
      ? [
          "",
          '<S id="P.a">',
          `Pee ay text ${PD_TOKEN_A}.`,
          "</S>",
          "",
          '<S id="P.b">',
          `Pee bee text ${PD_TOKEN_B}.`,
          "</S>",
        ]
      : []),
    "</S>",
    "",
  ].join("\n");
}

// The deleted-children arm's workspace is created after the body's first
// `build`, so its initial source and the deletion are staged-source records
// (helpers/staged-mdx.ts, S-9).
const T10_7_9_P_INITIAL = stagedMdx(
  "T10.7-9 specs/P.mdx with P holding P.a and P.b, each child's text carrying its token (the deleted-children arm's baseline)",
  pdSource(true),
);
const T10_7_9_P_CHILDREN_DELETED = stagedMdx(
  "T10.7-9 specs/P.mdx with P.a's and P.b's sections deleted, nothing else edited (the deleted-children arm, before `create --base`)",
  pdSource(false),
);

/**
 * The deleted-children arm's initial source at the baseline, as a workspace
 * declaration's `files` entry beside a configuration whose one spec group
 * discovers every `.mdx` file under `specs/` (SPEC 7.1) — a record, so any
 * workspace stages it alike (S-9).
 */
export const T10_7_9_P_INITIAL_FILES: Readonly<Record<string, StagedMdx>> = {
  [T10_7_9_P_FILE]: T10_7_9_P_INITIAL,
};

// The nested twin (TEST-SPEC T10.7-9(g)): the path-blocks fixture with its
// N nested under a top-level G — specs/G.mdx holds G, holding G.N, which
// holds G.N.a and G.N.b, then M holding M.k — run through the same steps:
// G.N's own text and G.N.a's text edited before `create --base` (G.N
// visited, G its one non-root ancestor, so the session holds G.N's item and
// G's parent-consistency item, context {G.N}, SPEC 10.5), G.N's item
// resolved `no-change`, M.k's text then edited, G.N's item split.
const TW_FILE = "specs/G.mdx";
const TW_G = "specs/G.mdx#G";
const TW_GN = "specs/G.mdx#G.N";
const TW_GNA = "specs/G.mdx#G.N.a";
const TW_GNB = "specs/G.mdx#G.N.b";

/**
 * specs/G.mdx's bytes: G holding G.N, its own text `gnOwn`, which holds G.N.a
 * (`gnaText`) and G.N.b, then M holding M.k (`mkText`), every tag alone on
 * its line.
 */
function twSource(gnOwn: string, gnaText: string, mkText: string): string {
  return [
    '<S id="G">',
    "Gee own text.",
    "",
    '<S id="G.N">',
    gnOwn,
    "",
    '<S id="G.N.a">',
    gnaText,
    "</S>",
    "",
    '<S id="G.N.b">',
    "Gee en bee text.",
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="M">',
    "Em own text.",
    "",
    '<S id="M.k">',
    mkText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// The nested twin's workspace is created after the body's first `build`, so
// its initial source and both edits are staged-source records
// (helpers/staged-mdx.ts, S-9).
const T10_7_9_G_INITIAL = stagedMdx(
  "T10.7-9 specs/G.mdx with G holding G.N holding G.N.a and G.N.b, then M holding M.k (the nested twin's baseline)",
  twSource("Gee en own v0.", "Gee en ay text v0.", "Em kay text v0."),
);
const T10_7_9_G_EDITED = stagedMdx(
  "T10.7-9 specs/G.mdx with G.N's own text and G.N.a's edited (the nested twin, before `create --base`)",
  twSource("Gee en own v1.", "Gee en ay text v1.", "Em kay text v0."),
);
const T10_7_9_G_MK_EDITED = stagedMdx(
  "T10.7-9 specs/G.mdx with G.N's own text, G.N.a's, and M.k's edited (the nested twin, after G.N's resolve)",
  twSource("Gee en own v1.", "Gee en ay text v1.", "Em kay text v1."),
);

/** The decomposition `export` must present for a split item (SPEC 10.7). */
function assertDecompositionRecorded(
  exported: ExportReport,
  scope: string,
  context: string,
): void {
  if (
    exported.decompositions.some(
      (entry) => entry.kind === "subtree-coherence" && entry.scope === scope,
    )
  ) {
    return;
  }
  fail(
    `${context}: \`export\` presents the session's recorded decompositions ` +
      `— the decomposition is recorded durably (SPEC 10.7) — so they hold ` +
      `the split item's, kind subtree-coherence and scope node ${scope}; ` +
      `got ` +
      JSON.stringify(exported.decompositions),
  );
}

/**
 * Assert each listed item enters `unresolved` with an id other than every
 * id in `taken` — the split original's among them, never reused (SPEC 10.2,
 * 10.7).
 */
function assertFreshUnresolved(
  entries: readonly (readonly [ReviewItem, string])[],
  taken: readonly string[],
  context: string,
): void {
  for (const [item, what] of entries) {
    if (taken.includes(item.id)) {
      fail(
        `${context}: ${what} takes a fresh id — the removed original's id is ` +
          `never reused, nor is any other item's (SPEC 10.2, 10.7); got ` +
          `${item.id}, among ${JSON.stringify(taken)}`,
      );
    }
    if (item.status !== "unresolved") {
      fail(
        `${context}: ${what} is created \`unresolved\` (SPEC 10.2) — a ` +
          `resolved original's status never propagates to its decomposition ` +
          `(10.7); got ${item.status}`,
      );
    }
  }
}

/**
 * The path-blocks fixture (TEST-SPEC T10.7-9; SPEC 10.2, 10.5, 10.7): the
 * staging premise — N's item alone — then N's item resolved `no-change`,
 * M.k's text edited, and N's item split; after it, from `export`: N.a's and
 * N.b's new items and N's `parent-consistency` item, each fresh and
 * `unresolved`, the original removed, the per-child contexts the children's
 * ancestor chains and N's context exactly its children; (a) N.a's and
 * N.b's `blockedBy` empty, N's `parent-consistency` item's exactly those
 * two; (b) N.a's origin exactly {N.a}, N.b's empty, N's
 * `parent-consistency` item's exactly {N, N.a}; the decomposition recorded;
 * (c) the re-derivation ending the split — M.k's `subtree-coherence` item
 * and M's `parent-consistency` item (context and origin {M.k}, `blockedBy`
 * M.k's item) in the session, fresh and `unresolved`, every item in item
 * order in `status` and `export`; the two refusals (N's
 * `parent-consistency` item, of another kind, and N.a's leaf item); and a
 * later re-derivation (N.a's item resolved `updated`) re-adding no item at N,
 * every id kept and the original's never reused, `blockedBy` recomputed.
 */
async function runPathBlocksFixture(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.7-9 path-blocks fixture";
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  // This edit precedes the body's first product invocation (git staging
  // invokes none), so S-7's sweep reaches it against the stub: plain
  // contents, no ledger record (helpers/staged-mdx.ts).
  await workspace.file(
    PB_FILE,
    pbSource("En own v1.", "En ay text v1.", "Em kay text v0."),
  );
  await buildOk(
    product,
    workspace,
    `${prefix} \`build\` after N's and N.a's edits`,
  );
  await createBaseSession(product, workspace, base, "s", prefix);
  const created = await sessionStatus(product, workspace, "s", prefix);
  assertSameJson(
    rowSequence(created),
    [`subtree-coherence ${PB_N} unresolved`],
    `${prefix} staging premise: N's and N.a's edits yield N's ` +
      `subtree-coherence item alone — N visited, N.a skipped beneath its ` +
      `\`changed\` ancestor, and N, top-level, without a non-root ancestor ` +
      `(SPEC 5.6, 10.5)`,
  );
  const idN = requireRow(created, "subtree-coherence", PB_N, prefix).id;

  // Resolve the original, edit M.k, then split the resolved original: its
  // status must not propagate to the decomposition (SPEC 10.2, 10.7).
  await resolveOk(
    product,
    workspace,
    "s",
    idN,
    "no-change",
    `${prefix} \`resolve s <N's item> --status no-change\``,
  );
  await workspace.file(PB_FILE, T10_7_9_N_MK_EDITED);
  await buildOk(product, workspace, `${prefix} \`build\` after M.k's edit`);
  await expectExit(
    product,
    workspace,
    ["review", "split", "s", idN],
    0,
    `${prefix} \`review split s <N's resolved item>\``,
  );

  const afterSplit = await exportSession(product, workspace, "s", prefix);
  const split = `${prefix} after the split`;
  const removed = afterSplit.items.filter(
    (item) =>
      item.id === idN ||
      (item.kind === "subtree-coherence" && item.scope.node === PB_N),
  );
  if (removed.length > 0) {
    fail(
      `${split}: the original — N's subtree-coherence item, ${idN} — is ` +
        `removed from the session, and no item takes its kind and scope ` +
        `node again (SPEC 10.1, 10.7); \`export\` presents ` +
        JSON.stringify(
          removed.map((item) => `${item.id} ${item.kind} ${item.scope.node}`),
        ),
    );
  }
  const naItem = requireItem(
    afterSplit.items,
    "subtree-coherence",
    PB_NA,
    split,
  );
  const nbItem = requireItem(
    afterSplit.items,
    "subtree-coherence",
    PB_NB,
    split,
  );
  const pcNItem = requireItem(
    afterSplit.items,
    "parent-consistency",
    PB_N,
    split,
  );
  assertFreshUnresolved(
    [
      [naItem, "N.a's new per-child item"],
      [nbItem, "N.b's new per-child item"],
      [pcNItem, "N's new parent-consistency item"],
    ],
    [idN],
    split,
  );
  for (const [item, what] of [
    [naItem, "N.a's"],
    [nbItem, "N.b's"],
  ] as const) {
    assertSameJson(
      identitySet(item.context),
      [PB_ROOT, PB_N].sort(),
      `${split}: ${what} per-child item's context is the child's ancestor ` +
        `chain, the file root and N (SPEC 10.7)`,
    );
  }
  assertSameJson(
    identitySet(pcNItem.context),
    [PB_NA, PB_NB].sort(),
    `${split}: N's parent-consistency item's context is exactly the scope ` +
      `root's children (SPEC 10.7)`,
  );

  // (a) Per-child blocking (SPEC 10.7): a per-child item's blockedBy is the
  // one path-blocks gives a subtree-coherence item — none (10.5) — and the
  // parent-consistency item's is the per-child items.
  for (const [item, what] of [
    [naItem, "N.a's"],
    [nbItem, "N.b's"],
  ] as const) {
    assertBlockedBy(
      item,
      [],
      `${split} (a): ${what} per-child item's blockedBy is the one ` +
        `path-blocks gives a subtree-coherence item — none in a baseline ` +
        `session (SPEC 10.5, 10.7)`,
    );
  }
  assertBlockedBy(
    pcNItem,
    [naItem.id, nbItem.id],
    `${split} (a): N's parent-consistency item is blocked by exactly the ` +
      `per-child items, N.a's and N.b's (SPEC 10.7)`,
  );

  // (b) Origins (SPEC 10.7): as in 10.5, the `changed` nodes in each
  // decomposition item's scope — for the parent-consistency item, in its
  // scope node's subtree, the scope node included. N and N.a are the
  // session's `changed` nodes; N lies in each child's ancestor chain, in no
  // child's scope.
  assertSameJson(
    identitySet(naItem.origin),
    [PB_NA],
    `${split} (b): N.a's per-child item's origin is exactly {N.a} — the ` +
      `\`changed\` nodes in its scope (SPEC 5.6, 10.5, 10.7); a product ` +
      `taking origin over scope and context adds N, in its ancestor chain`,
  );
  assertSameJson(
    identitySet(nbItem.origin),
    [],
    `${split} (b): N.b's per-child item's origin is exactly empty — no ` +
      `\`changed\` node lies in its scope (SPEC 5.6, 10.5, 10.7); a product ` +
      `taking origin over scope and context reports N, in its ancestor chain`,
  );
  assertSameJson(
    identitySet(pcNItem.origin),
    [PB_N, PB_NA].sort(),
    `${split} (b): N's parent-consistency item's origin is exactly {N, ` +
      `N.a} — the \`changed\` nodes in its scope node's subtree, the scope ` +
      `node included (SPEC 5.6, 10.5, 10.7) — never {N.a}, the per-child ` +
      `origins' union`,
  );
  assertDecompositionRecorded(afterSplit, PB_N, split);

  // (c) Re-derivation at the split's end (SPEC 10.5, 10.7): M.k, edited
  // after `create`, is visited once the session re-derives, adding M.k's
  // subtree-coherence item and M's parent-consistency item, each in its
  // place in item order — deepest scope node first, then kind, then
  // document order (10.5).
  const expectedOrder = [
    `subtree-coherence ${PB_NA}`,
    `subtree-coherence ${PB_NB}`,
    `subtree-coherence ${PB_MK}`,
    `parent-consistency ${PB_N}`,
    `parent-consistency ${PB_M}`,
  ];
  const splitStatus = await sessionStatus(product, workspace, "s", prefix);
  assertSameJson(
    rowSequence(splitStatus),
    expectedOrder.map((row) => `${row} unresolved`),
    `${split} (c): once the split exits, the re-derivation ending it (SPEC ` +
      `10.5, 10.7) has added M.k's subtree-coherence item and M's ` +
      `parent-consistency item — M.k, edited after \`create\`, visited — ` +
      `every item \`unresolved\` and in item order (10.2, 10.5); a product ` +
      `that does not re-derive at a split adds neither`,
  );
  assertSameJson(
    exportKindScopeSequence(afterSplit.items),
    expectedOrder,
    `${split} (c): \`export\` presents the same items in item order (SPEC ` +
      `10.5, 10.7)`,
  );
  const mkItem = requireItem(
    afterSplit.items,
    "subtree-coherence",
    PB_MK,
    split,
  );
  const pcMItem = requireItem(
    afterSplit.items,
    "parent-consistency",
    PB_M,
    split,
  );
  assertFreshUnresolved(
    [
      [mkItem, "M.k's subtree-coherence item"],
      [pcMItem, "M's parent-consistency item"],
    ],
    [idN, naItem.id, nbItem.id, pcNItem.id],
    `${split} (c)`,
  );
  assertSameJson(
    identitySet(pcMItem.context),
    [PB_MK],
    `${split} (c): M's parent-consistency item's context is exactly {M.k} — ` +
      `the changed branch beneath M, entering as M's child on it (SPEC 10.5)`,
  );
  assertSameJson(
    identitySet(pcMItem.origin),
    [PB_MK],
    `${split} (c): M's parent-consistency item's origin is exactly {M.k} — ` +
      `the \`changed\` nodes in M's subtree (SPEC 10.5)`,
  );
  assertBlockedBy(
    pcMItem,
    [mkItem.id],
    `${split} (c): M's parent-consistency item is blocked by M.k's ` +
      `subtree-coherence item — M.k, M's child on its changed branch, is ` +
      `itself visited (SPEC 10.5)`,
  );

  // Refused (exit 1 in T10.7-14's finding form, nothing modified — the
  // shared check: the session file and the whole workspace byte-identical):
  // `split` of N's parent-consistency item, an item of another kind, and of
  // N.a's item, whose scope root has no children (SPEC 10.7).
  await expectReviewRefusal(
    product,
    workspace,
    ["review", "split", "s", pcNItem.id],
    SESSION_S_REL,
    `${prefix} [N's parent-consistency item: split on an item of any other ` +
      `kind is refused, SPEC 10.7]`,
    { nothingModified: true },
  );
  await expectReviewRefusal(
    product,
    workspace,
    ["review", "split", "s", naItem.id],
    SESSION_S_REL,
    `${prefix} [N.a's item: split on a subtree-coherence item whose scope ` +
      `root has no children is refused, SPEC 10.7]`,
    { nothingModified: true },
  );

  // A later re-derivation (SPEC 10.5, 10.7): N.a's item resolved `updated`
  // re-derives the session. The decomposition governs it — no item scoped
  // at N is re-added, nothing else enters — every item keeps its id, the
  // original's id is never reused, and blockedBy is recomputed.
  await resolveOk(
    product,
    workspace,
    "s",
    naItem.id,
    "updated",
    `${prefix} \`resolve s <N.a's item> --status updated\` — re-derives the ` +
      `session (SPEC 10.5)`,
  );
  const derived = await exportSession(product, workspace, "s", prefix);
  const later = `${prefix} after the later re-derivation`;
  assertSameJson(
    exportKindScopeSequence(derived.items),
    expectedOrder,
    `${later}: the decomposed subtree-coherence item for N is never ` +
      `re-added — its decomposition applies in its place — and no other ` +
      `item enters (SPEC 10.5, 10.7)`,
  );
  for (const item of [naItem, nbItem, mkItem, pcNItem, pcMItem]) {
    if (
      requireItem(derived.items, item.kind, item.scope.node, later).id !==
      item.id
    ) {
      fail(
        `${later}: the ${item.kind} item at ${item.scope.node} keeps its id ` +
          `${item.id} — a generated or decomposition-produced item matching ` +
          `an existing one is that item (SPEC 10.5)`,
      );
    }
  }
  if (derived.items.some((item) => item.id === idN)) {
    fail(
      `${later}: no item takes the split original's id ${idN} — it is never ` +
        `reused (SPEC 10.7)`,
    );
  }
  assertBlockedBy(
    requireItem(derived.items, "parent-consistency", PB_N, later),
    [naItem.id, nbItem.id],
    `${later}: N's parent-consistency item is blocked by exactly the ` +
      `per-child items (SPEC 10.5, 10.7)`,
  );
  assertBlockedBy(
    requireItem(derived.items, "parent-consistency", PB_M, later),
    [mkItem.id],
    `${later}: M's parent-consistency item is blocked by exactly M.k's item ` +
      `(SPEC 10.5)`,
  );
}

/**
 * Assert a presented text byte-equal to the `query node` value `why` names
 * (SPEC 1.6, 10.7: every text value is the expanded value of 1.6).
 */
function assertPresentedText(
  text: string | undefined,
  expected: string,
  what: string,
  why: string,
): void {
  if (text === undefined) {
    fail(
      `${what}: no text is presented — it is ${why}; a node is presented ` +
        `without text only when neither the current graph nor any state ` +
        `among the item's baseline state and its derivation and resolve ` +
        `states contains it (SPEC 10.7)`,
    );
  }
  assertBytesEqual(
    text,
    expected,
    `${what} is ${why}, byte-equal to the value \`query node\` reports ` +
      `(SPEC 1.6, 10.7)`,
  );
}

/**
 * Assert a scope text of P carries neither deleted child's token (TEST-SPEC
 * T10.7-9(f); SPEC 1.6, 10.5: the baseline-parent links bind node relations
 * and node sets alone, texts keeping their definitions).
 */
function assertNoChildToken(text: string | undefined, what: string): void {
  for (const [token, child] of [
    [PD_TOKEN_A, "P.a"],
    [PD_TOKEN_B, "P.b"],
  ] as const) {
    if (text === undefined || !text.includes(token)) continue;
    fail(
      `${what} ${JSON.stringify(text)} contains ${child}'s token ${token} — ` +
        `a deleted child is P's child as a node relation alone, texts ` +
        `keeping their definitions (SPEC 1.6, 10.5), so neither of P's scope ` +
        `texts carries a deleted child's text; a product computing text over ` +
        `the linked tree splices it in`,
    );
  }
}

/**
 * The entry an item's `current` holds for `node` (SPEC 10.2, 10.4), read
 * through the review adapter's `decodeRecordedState`, diagnosed when the
 * state holds none.
 */
function currentEntry(
  item: ReviewItem,
  node: string,
  label: string,
): RecordedNodeEntry {
  const entries = decodeRecordedState(item, "current", label);
  const entry = entries.find((candidate) => candidate.node === node);
  if (entry !== undefined) return entry;
  return fail(
    `${label}: holds no entry for ${node} — \`current\` records the item's ` +
      `relevant hashes and, for every scope, context, and origin node, ` +
      `whether it is present (SPEC 10.2, 10.4); it holds entries for ` +
      JSON.stringify(entries.map((candidate) => candidate.node)),
  );
}

/**
 * Assert `current`'s recorded `hash` for `node` equals the value `query
 * node` reported after the deletion (SPEC 5.5, 10.4, 10.5: hashes keep
 * their definitions; `current` written at the item's creation).
 */
function assertCurrentHash(
  item: ReviewItem,
  node: string,
  hash: keyof NodeHashes,
  report: NodeReport,
  label: string,
): void {
  const entry = currentEntry(item, node, label);
  const recorded = entry.hashes[hash];
  if (recorded === report.hashes[hash]) return;
  fail(
    `${label}: ${node}'s recorded ${hash} must be ` +
      `${JSON.stringify(report.hashes[hash])}, the value \`query node\` ` +
      `reports after the deletion — hashes keep their definitions (SPEC ` +
      `5.5, 10.5) and \`current\` records the item's relevant hashes at its ` +
      `creation (10.2, 10.4); got ` +
      (recorded !== undefined
        ? JSON.stringify(recorded)
        : entry.absentMarker
          ? "the explicit absent marker"
          : "none recorded"),
  );
}

/**
 * Assert `current`'s entry for the absent `node` presents it absent, its
 * hashes the explicit absent marker (SPEC 10.4).
 */
function assertCurrentAbsent(
  item: ReviewItem,
  node: string,
  label: string,
): void {
  const entry = currentEntry(item, node, label);
  if (!entry.present && entry.absentMarker) return;
  fail(
    `${label}: ${node}'s entry must present it absent, its hashes the ` +
      `explicit absent marker (SPEC 10.4: an absent node's hashes are ` +
      `recorded as an explicit absent marker); got ${JSON.stringify(entry)}`,
  );
}

/** The session T10.7-9(f) leaves once its outcomes are asserted. */
export interface T1079DeletedChildren {
  /** The baseline commit `create --base` names. */
  readonly base: string;
  /** The per-child subtree-coherence item scoped at the absent P.a. */
  readonly paId: string;
  /** The per-child subtree-coherence item scoped at the absent P.b. */
  readonly pbId: string;
  /** P's parent-consistency item. */
  readonly pcPId: string;
}

/**
 * T10.7-9(f), deleted children (TEST-SPEC; SPEC 1.6, 5.5, 10.2, 10.4, 10.5,
 * 10.7), in a fresh workspace holding `T10_7_9_P_INITIAL_FILES`: the
 * baseline committed and built, P.a's and P.b's baseline subtree texts
 * captured (`query node`); both children's sections deleted and built; the
 * `changed` nodes exactly P and the deleted P.a and P.b (an `impact`
 * premise); P's `query node` report captured; `review create --base
 * <baseline> --name s`, whose session holds P's item alone. Before the
 * split, from `export`: P's item's scope text byte-equal to P's current
 * subtree text, its `current` subtreeHash and metadataHash for P equal to
 * `query node`'s and its entries for P.a and P.b the explicit absent marker,
 * and its scope exactly {P, P.a, P.b}, the children presented absent. `split`
 * of P's item then exits 0 — P's children, in a baseline session, include
 * the deleted ones — leaving exactly P.a's and P.b's `subtree-coherence`
 * items and P's `parent-consistency` item, each fresh and `unresolved`; from
 * `export`, each per-child item's scope presented absent under its baseline
 * identity, its scope text that child's baseline subtree text, its origin
 * exactly that child, its context exactly the file root and P, and its
 * `blockedBy` empty; P's `parent-consistency` item's context exactly {P.a,
 * P.b}, each presented absent with its baseline subtree text, its origin
 * exactly {P, P.a, P.b}, its `blockedBy` the per-child items, its scope text
 * P's current own text, its `current` ownHash and metadataHash for P equal to
 * `query node`'s and its entries for P.a and P.b the explicit absent marker;
 * neither of P's scope texts carrying either child's token; the
 * decomposition recorded. Exported, with the arm's source and identities,
 * for T10.4-8(c), which resolves P.a's per-child item once this arm's
 * outcomes are asserted.
 */
export async function runT1079DeletedChildrenArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<T1079DeletedChildren> {
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${label} \`build\` at the baseline`);
  const baselineLabel = `${label} baseline capture`;
  const baselinePa = await queryNode(product, workspace, PD_PA, baselineLabel);
  const baselinePb = await queryNode(product, workspace, PD_PB, baselineLabel);
  for (const [report, token, child] of [
    [baselinePa, PD_TOKEN_A, "P.a"],
    [baselinePb, PD_TOKEN_B, "P.b"],
  ] as const) {
    if (report.subtreeText.includes(token)) continue;
    fail(
      `${label} staging premise: ${child}'s baseline subtree text carries ` +
        `its token ${token}, which its staged text spells (SPEC 1.6); ` +
        `\`query node\` reports ${JSON.stringify(report.subtreeText)}`,
    );
  }
  await workspace.file(PD_FILE, T10_7_9_P_CHILDREN_DELETED);
  await buildOk(
    product,
    workspace,
    `${label} \`build\` after P.a's and P.b's deletion`,
  );
  assertSameJson(
    await changedNodes(product, workspace, base, label),
    [PD_P, `${PD_PA} (deleted)`, `${PD_PB} (deleted)`].sort(),
    `${label} staging premise: the \`changed\` nodes are exactly P — it lost ` +
      `both children, a structural edit originating at the parent — and ` +
      `P.a and P.b, deleted (SPEC 5.5, 5.6)`,
  );
  const p = await queryNode(
    product,
    workspace,
    PD_P,
    `${label} capture after the deletion`,
  );
  await createBaseSession(product, workspace, base, "s", label);
  const created = await sessionStatus(product, workspace, "s", label);
  assertSameJson(
    rowSequence(created),
    [`subtree-coherence ${PD_P} unresolved`],
    `${label} staging premise: P's subtree-coherence item alone — P ` +
      `visited, the deleted P.a and P.b \`changed\` beneath it, and P, ` +
      `top-level, without a non-root ancestor (SPEC 5.6, 10.5)`,
  );
  const pId = requireRow(created, "subtree-coherence", PD_P, label).id;

  // Before the split (SPEC 1.6, 5.5, 10.4, 10.5, 10.7): texts and hashes
  // keep their definitions — P's subtree text is its own text alone, P
  // having no current child — and the scope holds the deleted children.
  const before = `${label} before the split: P's item`;
  const pItem = requireItem(
    (await exportSession(product, workspace, "s", label)).items,
    "subtree-coherence",
    PD_P,
    before,
  );
  assertPresentedText(
    pItem.scope.text,
    p.subtreeText,
    `${before}'s scope text`,
    "P's current subtree text — a subtree-coherence item's scope text is " +
      "the scope root's subtree text (SPEC 10.7), here P's own text, P " +
      "having no current child (1.6)",
  );
  assertNoChildToken(pItem.scope.text, `${before}'s scope text`);
  for (const hash of ["subtreeHash", "metadataHash"] as const) {
    assertCurrentHash(pItem, PD_P, hash, p, `${before}'s \`current\``);
  }
  for (const child of [PD_PA, PD_PB]) {
    assertCurrentAbsent(pItem, child, `${before}'s \`current\``);
  }
  assertScopePresence(
    pItem,
    [
      [PD_P, true],
      [PD_PA, false],
      [PD_PB, false],
    ],
    before,
    "exactly {P, P.a, P.b} — P and all its descendants, each deleted child " +
      "the child of its baseline parent P (SPEC 10.5), presented absent " +
      "under its baseline identity (10.4)",
  );

  await expectExit(
    product,
    workspace,
    ["review", "split", "s", pId],
    0,
    `${label} \`review split s <P's item>\` — in a baseline session the ` +
      `scope root's children include deleted ones (SPEC 10.5, 10.7), so P, ` +
      `whose only children P.a and P.b were deleted, has children and the ` +
      `split is no childless refusal`,
  );

  const after = `${label} after the split`;
  assertSameJson(
    [
      ...rowSequence(await sessionStatus(product, workspace, "s", label)),
    ].sort(),
    [
      `parent-consistency ${PD_P} unresolved`,
      `subtree-coherence ${PD_PA} unresolved`,
      `subtree-coherence ${PD_PB} unresolved`,
    ].sort(),
    `${after}: exactly P.a's and P.b's subtree-coherence items and P's ` +
      `parent-consistency item, each \`unresolved\`, the original removed ` +
      `(SPEC 10.2, 10.5, 10.7)`,
  );
  const exported = await exportSession(product, workspace, "s", label);
  const paItem = requireItem(exported.items, "subtree-coherence", PD_PA, after);
  const pbItem = requireItem(exported.items, "subtree-coherence", PD_PB, after);
  const pcItem = requireItem(exported.items, "parent-consistency", PD_P, after);
  assertFreshUnresolved(
    [
      [paItem, "P.a's per-child item"],
      [pbItem, "P.b's per-child item"],
      [pcItem, "P's parent-consistency item"],
    ],
    [pId],
    after,
  );
  for (const [item, child, node, captured] of [
    [paItem, "P.a", PD_PA, baselinePa],
    [pbItem, "P.b", PD_PB, baselinePb],
  ] as const) {
    const what = `${after}: ${child}'s per-child item`;
    if (item.scope.present) {
      fail(
        `${what} is scoped at the absent ${child}, presented absent under ` +
          `its baseline identity ${node} (SPEC 10.4, 10.7); its scope is ` +
          `presented present`,
      );
    }
    assertPresentedText(
      item.scope.text,
      captured.subtreeText,
      `${what}'s scope text`,
      `${child}'s baseline subtree text — the scope root's subtree text ` +
        `(SPEC 10.7), an absent node's value in the one graph state ` +
        `containing it, the item's baseline state (10.2, 10.7)`,
    );
    assertSameJson(
      identitySet(item.origin),
      [node],
      `${what}'s origin is exactly {${child}} — the \`changed\` nodes in its ` +
        `scope (SPEC 5.6, 10.5, 10.7)`,
    );
    assertSameJson(
      identitySet(item.context),
      [PD_ROOT, PD_P].sort(),
      `${what}'s context is exactly the file root and P — the deleted ` +
        `child's ancestor chain over its baseline-parent link (SPEC 10.5: ` +
        `ancestors follow these links, in decompositions too; 10.7), never ` +
        `the empty chain the current graph gives an absent node`,
    );
    assertBlockedBy(
      item,
      [],
      `${what}'s blockedBy is the one path-blocks gives a subtree-coherence ` +
        `item — none (SPEC 10.5, 10.7)`,
    );
  }
  const pc = `${after}: P's parent-consistency item`;
  assertSameJson(
    identitySet(pcItem.context),
    [PD_PA, PD_PB].sort(),
    `${pc}'s context is exactly {P.a, P.b} — the scope root's children, in ` +
      `a baseline session deleted ones included (SPEC 10.5, 10.7)`,
  );
  for (const [child, node, captured] of [
    ["P.a", PD_PA, baselinePa],
    ["P.b", PD_PB, baselinePb],
  ] as const) {
    const state = pcItem.context.find((candidate) => candidate.node === node);
    if (state === undefined || state.present) {
      fail(
        `${pc}'s context node ${child} is presented absent under its ` +
          `baseline identity ${node} (SPEC 10.4, 10.7); got ` +
          JSON.stringify(state),
      );
    }
    assertPresentedText(
      state.text,
      captured.subtreeText,
      `${pc}'s context text for ${child}`,
      `${child}'s baseline subtree text — a parent-consistency item's ` +
        `context text is subtree text (SPEC 10.7), an absent node's value in ` +
        `the one graph state containing it, the item's baseline state (10.2, ` +
        `10.7)`,
    );
  }
  assertSameJson(
    identitySet(pcItem.origin),
    [PD_P, PD_PA, PD_PB].sort(),
    `${pc}'s origin is exactly {P, P.a, P.b} — the \`changed\` nodes in its ` +
      `scope node's subtree, the deleted children linked under their ` +
      `baseline parent (SPEC 5.6, 10.5, 10.7)`,
  );
  assertBlockedBy(
    pcItem,
    [paItem.id, pbItem.id],
    `${pc} is blocked by exactly the per-child items (SPEC 10.7)`,
  );
  assertPresentedText(
    pcItem.scope.text,
    p.ownText,
    `${pc}'s scope text`,
    "P's current own text — a parent-consistency item's scope text is the " +
      "scope node's own text (SPEC 10.7)",
  );
  assertNoChildToken(pcItem.scope.text, `${pc}'s scope text`);
  for (const hash of ["ownHash", "metadataHash"] as const) {
    assertCurrentHash(pcItem, PD_P, hash, p, `${pc}'s \`current\``);
  }
  for (const child of [PD_PA, PD_PB]) {
    assertCurrentAbsent(pcItem, child, `${pc}'s \`current\``);
  }
  assertDecompositionRecorded(exported, PD_P, after);
  return { base, paId: paItem.id, pbId: pbItem.id, pcPId: pcItem.id };
}

/**
 * T10.7-9(g), blocker replacement under path-blocks' own blocking rules
 * (TEST-SPEC; SPEC 10.3, 10.5, 10.7): the nested twin's session holds G.N's
 * item and G's parent-consistency item, context {G.N}, blocked by exactly
 * G.N's item (from `export`); once G.N's item is resolved `no-change`, G's
 * row reads unblocked (`status`); M.k's text then edited and G.N's item
 * split: G's item is blocked by exactly G.N.a's and G.N.b's items and G.N's
 * parent-consistency item (`export`), its row blocked (`status`); and once
 * G.N.a's item is resolved `updated`, re-deriving the session, still by
 * exactly those three (`export`).
 */
async function runNestedTwinArm(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.7-9 nested twin (g)";
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await workspace.file(TW_FILE, T10_7_9_G_EDITED);
  await buildOk(
    product,
    workspace,
    `${prefix} \`build\` after G.N's and G.N.a's edits`,
  );
  await createBaseSession(product, workspace, base, "s", prefix);
  const created = await sessionStatus(product, workspace, "s", prefix);
  assertSameJson(
    rowSequence(created),
    [
      `subtree-coherence ${TW_GN} unresolved`,
      `parent-consistency ${TW_G} unresolved`,
    ],
    `${prefix} staging premise: G.N's and G.N.a's edits yield G.N's ` +
      `subtree-coherence item and G's parent-consistency item — G.N ` +
      `visited, G its one non-root ancestor (SPEC 5.6, 10.5)`,
  );
  const idGN = requireRow(created, "subtree-coherence", TW_GN, prefix).id;
  const idG = requireRow(created, "parent-consistency", TW_G, prefix).id;

  const gItemAt = (
    items: readonly ReviewItem[],
    context: string,
  ): ReviewItem => {
    const item = requireItem(items, "parent-consistency", TW_G, context);
    if (item.id !== idG) {
      fail(
        `${context}: G's parent-consistency item keeps its id ${idG} — an ` +
          `item outside the decomposition, matched at every re-derivation ` +
          `(SPEC 10.5, 10.7); got ${item.id}`,
      );
    }
    return item;
  };
  const first = `${prefix} before the split`;
  const gBefore = gItemAt(
    (await exportSession(product, workspace, "s", prefix)).items,
    first,
  );
  assertSameJson(
    identitySet(gBefore.context),
    [TW_GN],
    `${first}: G's parent-consistency item's context is exactly {G.N} — the ` +
      `changed branch beneath G (SPEC 10.5)`,
  );
  assertBlockedBy(
    gBefore,
    [idGN],
    `${first}: G's parent-consistency item is blocked by exactly G.N's ` +
      `subtree-coherence item — G.N, G's child on its changed branch, is ` +
      `itself visited (SPEC 10.5)`,
  );
  await resolveOk(
    product,
    workspace,
    "s",
    idGN,
    "no-change",
    `${prefix} \`resolve s <G.N's item> --status no-change\``,
  );
  if (
    requireRow(
      await sessionStatus(product, workspace, "s", prefix),
      "parent-consistency",
      TW_G,
      first,
    ).blocked
  ) {
    fail(
      `${first}: once G.N's item is resolved \`no-change\`, G's ` +
        `parent-consistency item reads unblocked — an item is blocked only ` +
        `while an item in its blockedBy is not resolved (SPEC 10.3)`,
    );
  }

  await workspace.file(TW_FILE, T10_7_9_G_MK_EDITED);
  await buildOk(product, workspace, `${prefix} \`build\` after M.k's edit`);
  await expectExit(
    product,
    workspace,
    ["review", "split", "s", idGN],
    0,
    `${prefix} \`review split s <G.N's resolved item>\``,
  );
  const split = `${prefix} after the split`;
  const splitItems = (await exportSession(product, workspace, "s", prefix))
    .items;
  const gnaId = requireItem(splitItems, "subtree-coherence", TW_GNA, split).id;
  const gnbId = requireItem(splitItems, "subtree-coherence", TW_GNB, split).id;
  const pcGNId = requireItem(splitItems, "parent-consistency", TW_GN, split).id;
  assertBlockedBy(
    gItemAt(splitItems, split),
    [gnaId, gnbId, pcGNId],
    `${split}: G's parent-consistency item — blocked by the original — is ` +
      `blocked by exactly the decomposition's items, G.N.a's and G.N.b's ` +
      `subtree-coherence items and G.N's parent-consistency item (SPEC ` +
      `10.7: every item outside the decomposition that was blocked by the ` +
      `original becomes blocked by all its items; 10.5: the re-derivation ` +
      `ending the split replaces the decomposed reference likewise); a ` +
      `product making the replacement in audit's child-section blocking ` +
      `alone fails here`,
  );
  if (
    !requireRow(
      await sessionStatus(product, workspace, "s", prefix),
      "parent-consistency",
      TW_G,
      split,
    ).blocked
  ) {
    fail(
      `${split}: \`status\` reports G's parent-consistency item blocked — ` +
        `its blockers, the new decomposition items, are \`unresolved\` ` +
        `(SPEC 10.2, 10.3, 10.7)`,
    );
  }

  await resolveOk(
    product,
    workspace,
    "s",
    gnaId,
    "updated",
    `${prefix} \`resolve s <G.N.a's item> --status updated\` — re-derives ` +
      `the session (SPEC 10.5)`,
  );
  const later = `${prefix} after G.N.a's \`updated\` resolve`;
  assertBlockedBy(
    gItemAt(
      (await exportSession(product, workspace, "s", prefix)).items,
      later,
    ),
    [gnaId, gnbId, pcGNId],
    `${later}: G's parent-consistency item is still blocked by exactly ` +
      `G.N.a's and G.N.b's items and G.N's parent-consistency item — each ` +
      `re-derivation recomputes blockedBy per path-blocks' rules, the ` +
      `reference to G.N's decomposed item replaced by all items of its ` +
      `decomposition (SPEC 10.5, 10.7)`,
  );
}

// The audit fixture (TEST-SPEC T10.7-9): specs/N.mdx holds the top-level N,
// holding N.a (itself holding N.a.x) and N.b, then the top-level leaf s. An
// audit session `s` is created; N.b's item is resolved `no-change` with a
// note; N.a's item is split; then, by manual edit, N.c holding N.c.y is
// authored under N and N.b.z under N.b; and N's item is split. N.a is
// recorded as decomposed by the first split, so the second creates no
// per-child item for it: N.a's decomposition stands in, recursively —
// N.a.x's item and N.a's parent-consistency item, in N's
// parent-consistency item's blockedBy too. N.b's existing item takes its
// per-child item's place (reuse), N.c's per-child item is created, and the
// re-derivation ending the split adds N.c.y's and N.b.z's items (SPEC
// 10.5, 10.6, 10.7).
//
// The audit fixture is exported for T10.4-8(b) (`T10_7_9_AUDIT_FILE`,
// `T10_7_9_AUDIT_NODES`, `T10_7_9_AUDIT_NCY_TEXT`, `t1079AuditSource`,
// `T10_7_9_AUDIT_INITIAL_FILES`, `runT1079AuditSplits`): the staging asserts
// all of (a)–(e) at N's split; the refusals and the later re-derivation stay
// in T10.7-9's body.

/** T10.7-9's audit fixture's one source path: N … s in specs/N.mdx. */
export const T10_7_9_AUDIT_FILE = "specs/N.mdx";

/** T10.7-9's audit fixture's node identities (TEST-SPEC's N … s; SPEC 1.5). */
export const T10_7_9_AUDIT_NODES = {
  root: "specs/N.mdx",
  n: "specs/N.mdx#N",
  na: "specs/N.mdx#N.a",
  nax: "specs/N.mdx#N.a.x",
  nb: "specs/N.mdx#N.b",
  nbz: "specs/N.mdx#N.b.z",
  nc: "specs/N.mdx#N.c",
  ncy: "specs/N.mdx#N.c.y",
  s: "specs/N.mdx#s",
} as const;

/** N.c.y's text at its authoring, after N.a's split (the audit fixture). */
export const T10_7_9_AUDIT_NCY_TEXT = "En cee why text.";

const AU_FILE = T10_7_9_AUDIT_FILE;
const AU_ROOT = T10_7_9_AUDIT_NODES.root;
const AU_N = T10_7_9_AUDIT_NODES.n;
const AU_NA = T10_7_9_AUDIT_NODES.na;
const AU_NAX = T10_7_9_AUDIT_NODES.nax;
const AU_NB = T10_7_9_AUDIT_NODES.nb;
const AU_NBZ = T10_7_9_AUDIT_NODES.nbz;
const AU_NC = T10_7_9_AUDIT_NODES.nc;
const AU_NCY = T10_7_9_AUDIT_NODES.ncy;
const AU_S = T10_7_9_AUDIT_NODES.s;

/** N.b's resolve note, which its reused item keeps (TEST-SPEC T10.7-9(e)). */
const AU_NOTE = "reviewed; kept as authored";

/**
 * specs/N.mdx's bytes for T10.7-9's audit fixture: N, its own text, holding
 * N.a (holding N.a.x) and N.b, then the leaf s, every tag alone on its line;
 * given `ncyText`, also N.b.z under N.b and, under N after N.b, N.c holding
 * N.c.y, its text `ncyText` — the authoring after N.a's split. Exported so a
 * later arm over the audit session can stage a further N.c.y edit as a
 * staged-source record of its own (S-9).
 */
export function t1079AuditSource(ncyText: string | null): string {
  return [
    '<S id="N">',
    "En own text.",
    "",
    '<S id="N.a">',
    "En ay own text.",
    "",
    '<S id="N.a.x">',
    "En ay ex text.",
    "</S>",
    "</S>",
    "",
    '<S id="N.b">',
    "En bee text.",
    ...(ncyText === null
      ? []
      : ["", '<S id="N.b.z">', "En bee zed text.", "</S>"]),
    "</S>",
    ...(ncyText === null
      ? []
      : [
          "",
          '<S id="N.c">',
          "En cee own text.",
          "",
          '<S id="N.c.y">',
          ncyText,
          "</S>",
          "</S>",
        ]),
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    "",
  ].join("\n");
}

// The audit fixture's workspace is created after the body's first `build`,
// so its initial source and the authoring are staged-source records
// (helpers/staged-mdx.ts, S-9).
const T10_7_9_AUDIT_INITIAL = stagedMdx(
  "T10.7-9 specs/N.mdx with N holding N.a (itself holding N.a.x) and N.b, then the leaf s (the audit fixture's initial source)",
  t1079AuditSource(null),
);
const T10_7_9_AUDIT_AUTHORED = stagedMdx(
  "T10.7-9 specs/N.mdx with N.c holding N.c.y authored under N and N.b.z under N.b (the audit fixture, after N.a's split)",
  t1079AuditSource(T10_7_9_AUDIT_NCY_TEXT),
);

/**
 * The audit fixture's initial source, as a workspace declaration's `files`
 * entry beside a configuration whose one spec group discovers every `.mdx`
 * file under `specs/` (SPEC 7.1) — a record, so any workspace stages it
 * alike (S-9).
 */
export const T10_7_9_AUDIT_INITIAL_FILES: Readonly<Record<string, StagedMdx>> =
  {
    [T10_7_9_AUDIT_FILE]: T10_7_9_AUDIT_INITIAL,
  };

/**
 * The audit fixture's items once N's split exits, in audit item order —
 * scope-node file path, then document order (SPEC 10.6): the root's item,
 * N's and N.a's parent-consistency items at their scope nodes' places, then
 * the subtree-coherence items of N.a.x, N.b, N.b.z, N.c, N.c.y, and s.
 */
const AU_ORDER_AFTER_SPLIT = [
  `subtree-coherence ${AU_ROOT}`,
  `parent-consistency ${AU_N}`,
  `parent-consistency ${AU_NA}`,
  `subtree-coherence ${AU_NAX}`,
  `subtree-coherence ${AU_NB}`,
  `subtree-coherence ${AU_NBZ}`,
  `subtree-coherence ${AU_NC}`,
  `subtree-coherence ${AU_NCY}`,
  `subtree-coherence ${AU_S}`,
];

// The childless refusal's own audit session (TEST-SPEC T10.7-9's refusals):
// specs/Q.mdx holds the top-level Q holding Q.r; once the session exists,
// Q.r's section is deleted by manual edit. In an audit session the children
// are the current ones alone (SPEC 10.7), so Q's item — its scope as last
// assigned still listing Q.r (10.4) — has a childless scope root.
const AQ_FILE = "specs/Q.mdx";
const AQ_ROOT = "specs/Q.mdx";
const AQ_Q = "specs/Q.mdx#Q";
const AQ_QR = "specs/Q.mdx#Q.r";

/** specs/Q.mdx's bytes: Q, its own text, holding — `withChild` — Q.r. */
function aqSource(withChild: boolean): string {
  return [
    '<S id="Q">',
    "Cue own text.",
    ...(withChild ? ["", '<S id="Q.r">', "Cue ar text.", "</S>"] : []),
    "</S>",
    "",
  ].join("\n");
}

// The Q workspace is created after the body's first `build`, so its initial
// source and Q.r's deletion are staged-source records (helpers/staged-mdx.ts,
// S-9).
const T10_7_9_Q_INITIAL = stagedMdx(
  "T10.7-9 specs/Q.mdx with Q holding Q.r (the childless refusal's audit session, its initial source)",
  aqSource(true),
);
const T10_7_9_Q_CHILD_DELETED = stagedMdx(
  "T10.7-9 specs/Q.mdx with Q.r's section deleted by manual edit after `create`, nothing else edited",
  aqSource(false),
);

/**
 * `review list --json`'s entry for one healthy session, its item counts by
 * stored status compared as `counts[status] ?? 0` per defined status — no
 * read-time invalidation applied (SPEC 10.4, 10.7).
 */
async function assertListedCounts(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  expected: Readonly<Record<ItemStatus, number>>,
  context: string,
): Promise<void> {
  const label = `${context} \`review list --json\``;
  const report = decodeSessionListReport(
    await runJson(product, workspace, ["review", "list", "--json"], label),
    label,
  );
  const entries = report.sessions.filter((entry) => entry.name === name);
  if (entries.length !== 1) {
    fail(
      `${label}: expected exactly one listed session named ` +
        `${JSON.stringify(name)} (SPEC 10.7: \`list\` reports every ` +
        `session); found ${String(entries.length)} among ` +
        JSON.stringify(report.sessions.map((entry) => entry.name)),
    );
  }
  const entry = entries[0];
  if (entry.corrupt) {
    fail(
      `${label}: session ${JSON.stringify(name)} is listed corrupt; the ` +
        `product wrote it and nothing else touched it, so it must be listed ` +
        `with its strategy and counts (SPEC 10.1, 10.7)`,
    );
  }
  for (const status of ITEM_STATUSES) {
    const actual = entry.counts[status] ?? 0;
    if (actual !== expected[status]) {
      fail(
        `${context}: \`review list\` counts the session's items by stored ` +
          `status — no read-time invalidation applied (SPEC 10.4, 10.7) — ` +
          `expected ${String(expected[status])} item(s) stored ${status}, ` +
          `got ${String(actual)}`,
      );
    }
  }
}

/** The audit session `runT1079AuditSplits` leaves, its items by id. */
export interface T1079AuditSession {
  /** N's subtree-coherence item, split by the second split and removed. */
  readonly nOriginalId: string;
  /** N.a's subtree-coherence item, split by the first split and removed. */
  readonly naOriginalId: string;
  /** The file root's subtree-coherence item. */
  readonly rootId: string;
  /** N's parent-consistency item, entered by the second split. */
  readonly pcNId: string;
  /** N.a's parent-consistency item, entered by the first split. */
  readonly pcNaId: string;
  /** N.a.x's subtree-coherence item, reused by both splits. */
  readonly naxId: string;
  /** N.b's subtree-coherence item, resolved `no-change`, then reused. */
  readonly nbId: string;
  /** N.b.z's item, added by the re-derivation ending the second split. */
  readonly nbzId: string;
  /** N.c's per-child item, created by the second split. */
  readonly ncId: string;
  /** N.c.y's item, added by the re-derivation ending the second split. */
  readonly ncyId: string;
  /** The leaf s's subtree-coherence item. */
  readonly sId: string;
}

/**
 * T10.7-9's audit fixture through N's split (TEST-SPEC T10.7-9(a)–(e); SPEC
 * 5.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7), in a fresh workspace
 * holding `T10_7_9_AUDIT_INITIAL_FILES` beside a one-group configuration:
 * built; `review create --strategy audit --name s`, one item per requirement
 * node in audit item order (the staging premise, from `status`); N.b's item
 * resolved `no-change` with a note, its `current` captured from `export` and
 * N.b's hashes via `query node`; N.a's item split — the original removed,
 * N.a.x's existing item reused, N.a's parent-consistency item fresh and
 * `unresolved` (context {N.a.x}, blockedBy N.a.x's item), both origins
 * empty ((b)), N's item blocked by all items of the decomposition beside
 * N.b's, the decomposition recorded; N.c holding N.c.y authored under N and
 * N.b.z under N.b and built — N.b's subtreeHash changed (the premise via
 * `query node`), no item added; then N's item split, asserting: neither
 * original's id reused, and no subtree-coherence item scoped at N or N.a
 * ((d)); (c) N.c.y's and N.b.z's items entered by the re-derivation ending
 * the split, fresh and `unresolved`, every item in audit item order in
 * `status` and `export`; N.c's per-child item and N's parent-consistency
 * item fresh and `unresolved`; (a) N.c's item's context its ancestor chain
 * and its blockedBy exactly N.c.y's item; (b) every decomposition item's
 * origin empty; (d) N's parent-consistency item's context exactly {N.a,
 * N.b, N.c} and its blockedBy exactly N.a.x's item, N.a's parent-consistency
 * item, N.b's item, and N.c's item, the root's item blocked by exactly those
 * four, N's parent-consistency item, and s's item, both decompositions
 * recorded; (e) N.b's item reused — its id, its note, its `current` byte for
 * byte (the decoded member's JSON rendering, member order included, from
 * `export` at N.b's resolve and after the split; H-3: its inner shape is the
 * product's), and its stored status kept, `list` counting it `no-change`
 * and reads (`status`, `export`) presenting it `invalidated` — taking the
 * scope {N.b, N.b.z} (every scope node the payload presents,
 * `requireScopeNodes`) and the blockedBy N.b.z's item; N.a.x's item and
 * N.a's parent-consistency item keeping their ids. Exported for T10.4-8(b),
 * which continues on the session it leaves.
 */
export async function runT1079AuditSplits(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<T1079AuditSession> {
  await buildOk(product, workspace, `${label} \`build\``);
  await createAuditSession(product, workspace, "s", label);
  const created = await sessionStatus(product, workspace, "s", label);
  assertSameJson(
    rowSequence(created),
    [AU_ROOT, AU_N, AU_NA, AU_NAX, AU_NB, AU_S].map(
      (node) => `subtree-coherence ${node} unresolved`,
    ),
    `${label} staging premise: one subtree-coherence item per requirement ` +
      `node, the root's included, in audit item order — file path, then ` +
      `document order (SPEC 10.6)`,
  );
  const rootId = requireRow(created, "subtree-coherence", AU_ROOT, label).id;
  const nOriginalId = requireRow(created, "subtree-coherence", AU_N, label).id;
  const naOriginalId = requireRow(
    created,
    "subtree-coherence",
    AU_NA,
    label,
  ).id;
  const naxId = requireRow(created, "subtree-coherence", AU_NAX, label).id;
  const nbId = requireRow(created, "subtree-coherence", AU_NB, label).id;
  const sId = requireRow(created, "subtree-coherence", AU_S, label).id;

  // N.b's item, a leaf's and so unblocked, resolved `no-change` with a note:
  // (e) follows its id, note, recorded state, and stored status through both
  // splits.
  await expectExit(
    product,
    workspace,
    [
      "review",
      "resolve",
      "s",
      nbId,
      "--status",
      "no-change",
      "--note",
      AU_NOTE,
    ],
    0,
    `${label} \`review resolve s <N.b's item> --status no-change --note ` +
      `<text>\``,
  );
  const atResolve = `${label} after N.b's resolve`;
  const nbCurrentAtResolve = JSON.stringify(
    requireItemById(
      (await exportSession(product, workspace, "s", atResolve)).items,
      nbId,
      atResolve,
    ).current,
  );
  const nbAtResolve = await queryNode(product, workspace, AU_NB, atResolve);

  // N.a's item split: N.a.x's existing item stands for N.a's one child
  // subtree, and N.a's parent-consistency item enters (SPEC 10.7).
  await expectExit(
    product,
    workspace,
    ["review", "split", "s", naOriginalId],
    0,
    `${label} \`review split s <N.a's item>\``,
  );
  const first = `${label} after N.a's split`;
  const afterFirst = await exportSession(product, workspace, "s", first);
  assertSameJson(
    [...exportKindScopeSequence(afterFirst.items)].sort(),
    [
      `subtree-coherence ${AU_ROOT}`,
      `subtree-coherence ${AU_N}`,
      `parent-consistency ${AU_NA}`,
      `subtree-coherence ${AU_NAX}`,
      `subtree-coherence ${AU_NB}`,
      `subtree-coherence ${AU_S}`,
    ].sort(),
    `${first}: the original — N.a's subtree-coherence item — is removed; ` +
      `N.a.x's item stands for N.a's one child subtree and N.a's ` +
      `parent-consistency item enters (SPEC 10.7)`,
  );
  const naxAfterFirst = requireItem(
    afterFirst.items,
    "subtree-coherence",
    AU_NAX,
    first,
  );
  if (naxAfterFirst.id !== naxId) {
    fail(
      `${first}: N.a.x's existing item takes its per-child item's place, ` +
        `keeping its id ${naxId} (SPEC 10.7); got ${naxAfterFirst.id}`,
    );
  }
  const pcNaItem = requireItem(
    afterFirst.items,
    "parent-consistency",
    AU_NA,
    first,
  );
  assertFreshUnresolved(
    [[pcNaItem, "N.a's new parent-consistency item"]],
    [rootId, nOriginalId, naOriginalId, naxId, nbId, sId],
    first,
  );
  const pcNaId = pcNaItem.id;
  assertSameJson(
    identitySet(pcNaItem.context),
    [AU_NAX],
    `${first}: N.a's parent-consistency item's context is exactly the ` +
      `scope root's children, {N.a.x} (SPEC 10.7)`,
  );
  assertBlockedBy(
    pcNaItem,
    [naxId],
    `${first}: N.a's parent-consistency item is blocked by exactly the ` +
      `per-child item, N.a.x's (SPEC 10.7)`,
  );
  for (const [item, what] of [
    [naxAfterFirst, "N.a.x's per-child item"],
    [pcNaItem, "N.a's parent-consistency item"],
  ] as const) {
    assertSameJson(
      identitySet(item.origin),
      [],
      `${first} (b): ${what}'s origin is empty — every decomposition ` +
        `item's origin is empty in an audit session (SPEC 10.7)`,
    );
  }
  assertBlockedBy(
    requireItemById(afterFirst.items, nOriginalId, first),
    [naxId, pcNaId, nbId],
    `${first}: N's item, blocked by the original, is blocked by all items ` +
      `of its decomposition — N.a.x's item and N.a's parent-consistency ` +
      `item — beside N.b's item (SPEC 10.6, 10.7)`,
  );
  assertDecompositionRecorded(afterFirst, AU_NA, first);

  // The manual authoring: N.c holding N.c.y under N, N.b.z under N.b. N.b's
  // subtreeHash changes (the premise), so its resolved item reads
  // `invalidated` (10.4); no item enters before the next re-derivation or
  // split (10.5, 10.7).
  await workspace.file(AU_FILE, T10_7_9_AUDIT_AUTHORED);
  await buildOk(
    product,
    workspace,
    `${label} \`build\` after authoring N.c, N.c.y, and N.b.z`,
  );
  const authored = `${label} after the authoring`;
  const nbAuthored = await queryNode(product, workspace, AU_NB, authored);
  if (nbAuthored.hashes.subtreeHash === nbAtResolve.hashes.subtreeHash) {
    fail(
      `${authored} staging premise: authoring N.b.z must change N.b's ` +
        `subtreeHash (SPEC 5.5: a node added to the subtree) — the change ` +
        `that invalidates N.b's resolved item (10.4)`,
    );
  }
  assertSameJson(
    (await sessionStatus(product, workspace, "s", authored)).items
      .map((row) => `${row.kind} ${row.scope}`)
      .sort(),
    [...exportKindScopeSequence(afterFirst.items)].sort(),
    `${authored} staging premise: the authoring alone adds no item — new ` +
      `items enter only through re-derivation or split (SPEC 10.5, 10.7)`,
  );

  // N's item split: one item per current child subtree — N.a's replaced by
  // its decomposition, N.b's existing item reused, N.c's created — plus N's
  // parent-consistency item, then the re-derivation ending the split.
  await expectExit(
    product,
    workspace,
    ["review", "split", "s", nOriginalId],
    0,
    `${label} \`review split s <N's item>\``,
  );
  const split = `${label} after N's split`;
  const afterSplit = await exportSession(product, workspace, "s", split);
  for (const [id, what] of [
    [nOriginalId, "N's"],
    [naOriginalId, "N.a's"],
  ] as const) {
    if (afterSplit.items.some((item) => item.id === id)) {
      fail(
        `${split}: no item takes ${what} split original's id ${id} — the ` +
          `original is removed from the session and its id never reused ` +
          `(SPEC 10.7)`,
      );
    }
  }
  const reAdded = afterSplit.items.filter(
    (item) =>
      item.kind === "subtree-coherence" &&
      (item.scope.node === AU_N || item.scope.node === AU_NA),
  );
  if (reAdded.length > 0) {
    fail(
      `${split} (d): no subtree-coherence item is scoped at N — the ` +
        `original removed — or at N.a: recorded as decomposed, N.a gets no ` +
        `per-child item, its decomposition standing in, recursively (SPEC ` +
        `10.1, 10.7); \`export\` presents ` +
        JSON.stringify(
          reAdded.map((item) => `${item.id} ${item.kind} ${item.scope.node}`),
        ),
    );
  }

  // (c) Re-derivation at the split's end (SPEC 10.5, 10.7): N.c.y and N.b.z,
  // authored after `create`, each get the subtree-coherence item the audit
  // strategy generates (10.6), entering in audit item order.
  const splitStatus = await sessionStatus(product, workspace, "s", split);
  assertSameJson(
    splitStatus.items.map((row) => `${row.kind} ${row.scope}`),
    AU_ORDER_AFTER_SPLIT,
    `${split} (c): once the split exits, the re-derivation ending it (SPEC ` +
      `10.5, 10.7) has added N.c.y's and N.b.z's items — authored after ` +
      `\`create\`, each one's subtree-coherence item generated by the audit ` +
      `strategy (10.6) — every item in audit item order, file path then ` +
      `document order (10.6); a product that does not re-derive at a split ` +
      `adds neither`,
  );
  assertSameJson(
    exportKindScopeSequence(afterSplit.items),
    AU_ORDER_AFTER_SPLIT,
    `${split} (c): \`export\` presents the same items in item order (SPEC ` +
      `10.6, 10.7)`,
  );
  const ncItem = requireItem(
    afterSplit.items,
    "subtree-coherence",
    AU_NC,
    split,
  );
  const pcNItem = requireItem(
    afterSplit.items,
    "parent-consistency",
    AU_N,
    split,
  );
  const nbzItem = requireItem(
    afterSplit.items,
    "subtree-coherence",
    AU_NBZ,
    split,
  );
  const ncyItem = requireItem(
    afterSplit.items,
    "subtree-coherence",
    AU_NCY,
    split,
  );
  const priorIds = [
    rootId,
    nOriginalId,
    naOriginalId,
    naxId,
    nbId,
    sId,
    pcNaId,
  ];
  assertFreshUnresolved(
    [
      [ncItem, "N.c's new per-child item"],
      [pcNItem, "N's new parent-consistency item"],
    ],
    priorIds,
    split,
  );
  assertFreshUnresolved(
    [
      [nbzItem, "N.b.z's item"],
      [ncyItem, "N.c.y's item"],
    ],
    [...priorIds, ncItem.id, pcNItem.id],
    `${split} (c)`,
  );

  // (a) Per-child blocking (SPEC 10.7): N.c's new item takes the blockedBy
  // the audit strategy gives a subtree-coherence item — its child sections'
  // items (10.6) — never the original's blockers.
  assertSameJson(
    identitySet(ncItem.context),
    [AU_ROOT, AU_N].sort(),
    `${split}: N.c's per-child item's context is the child's ancestor ` +
      `chain, the file root and N (SPEC 10.6, 10.7)`,
  );
  assertBlockedBy(
    ncItem,
    [ncyItem.id],
    `${split} (a): N.c's new per-child item's blockedBy is the one the ` +
      `audit strategy gives a subtree-coherence item — its child sections' ` +
      `items, exactly N.c.y's — never the original's blockers (N.a.x's ` +
      `item, N.a's parent-consistency item, and N.b's item), which a ` +
      `product passing them on to new decomposition items assigns (SPEC ` +
      `10.5, 10.6, 10.7)`,
  );

  // (b) Origins (SPEC 10.7): empty for every decomposition item in an
  // audit session.
  const naxItem = requireItem(
    afterSplit.items,
    "subtree-coherence",
    AU_NAX,
    split,
  );
  const pcNaAfter = requireItem(
    afterSplit.items,
    "parent-consistency",
    AU_NA,
    split,
  );
  const nbItem = requireItem(
    afterSplit.items,
    "subtree-coherence",
    AU_NB,
    split,
  );
  for (const [item, what] of [
    [naxItem, "N.a.x's item"],
    [pcNaAfter, "N.a's parent-consistency item"],
    [nbItem, "N.b's item"],
    [ncItem, "N.c's item"],
    [pcNItem, "N's parent-consistency item"],
  ] as const) {
    assertSameJson(
      identitySet(item.origin),
      [],
      `${split} (b): ${what}, of N's decomposition, has an empty origin — ` +
        `every decomposition item's origin is empty in an audit session ` +
        `(SPEC 10.7)`,
    );
  }

  // (d) Recursion (SPEC 10.7): N.a's decomposition stands in for its
  // per-child item, in N's parent-consistency item's blockedBy too; the
  // root's item, blocked by the original, is blocked by every item of N's
  // decomposition beside s's.
  assertSameJson(
    identitySet(pcNItem.context),
    [AU_NA, AU_NB, AU_NC].sort(),
    `${split} (d): N's parent-consistency item's context is exactly the ` +
      `scope root's children, N.a, N.b, and N.c — N.a among them though its ` +
      `decomposition stands in for its per-child item (SPEC 10.7)`,
  );
  assertBlockedBy(
    pcNItem,
    [naxId, pcNaId, nbId, ncItem.id],
    `${split} (d): N's parent-consistency item is blocked by exactly ` +
      `N.a.x's item, N.a's parent-consistency item, N.b's item, and N.c's ` +
      `item — N.a's decomposition standing in for its per-child item, ` +
      `recursively, in the parent-consistency item's blockedBy too (SPEC ` +
      `10.7)`,
  );
  assertBlockedBy(
    requireItemById(afterSplit.items, rootId, split),
    [naxId, pcNaId, nbId, ncItem.id, pcNItem.id, sId],
    `${split} (d): the root's item, blocked by the original, is blocked by ` +
      `exactly all items of its decomposition — N.a.x's item, N.a's ` +
      `parent-consistency item, N.b's and N.c's items, and N's ` +
      `parent-consistency item — and s's item (SPEC 10.6, 10.7)`,
  );
  assertDecompositionRecorded(afterSplit, AU_NA, split);
  assertDecompositionRecorded(afterSplit, AU_N, split);

  // (e) Reuse (SPEC 10.7): N.b's existing item takes its per-child item's
  // place, keeping its id, status, note, and recorded state and taking the
  // decomposition's scope and blockedBy; the first split's items keep their
  // ids.
  if (nbItem.id !== nbId) {
    fail(
      `${split} (e): N.b's existing item takes its per-child item's place, ` +
        `keeping its id ${nbId} (SPEC 10.7); got ${nbItem.id}`,
    );
  }
  if (nbItem.note !== AU_NOTE) {
    fail(
      `${split} (e): N.b's reused item keeps its note — the \`--note\` ` +
        `text of its resolve (SPEC 10.7); expected ` +
        `${JSON.stringify(AU_NOTE)}, got ` +
        (nbItem.note === undefined ? "no note" : JSON.stringify(nbItem.note)),
    );
  }
  const nbCurrentAfter = JSON.stringify(nbItem.current);
  if (nbCurrentAfter !== nbCurrentAtResolve) {
    fail(
      `${split} (e): N.b's reused item keeps its recorded state — its ` +
        `\`current\` byte for byte as \`export\` presented it at N.b's ` +
        `resolve (SPEC 10.2, 10.7: the existing item keeps its recorded ` +
        `state; reads report it as recorded)\n` +
        `  at the resolve: ${nbCurrentAtResolve}\n` +
        `  now:            ${nbCurrentAfter}`,
    );
  }
  const nbRow = requireRow(splitStatus, "subtree-coherence", AU_NB, split);
  for (const [status, read] of [
    [nbItem.status, "`export`"],
    [nbRow.status, "`status`"],
  ] as const) {
    if (status !== "invalidated") {
      fail(
        `${split} (e): ${read} presents N.b's reused item \`invalidated\` — ` +
          `its stored status no-change kept (SPEC 10.7) and N.b's ` +
          `subtreeHash changed since its resolve (10.4) — never ` +
          `\`unresolved\`; got ${status}`,
      );
    }
  }
  await assertListedCounts(
    product,
    workspace,
    "s",
    { unresolved: 8, updated: 0, "no-change": 1, skipped: 0, invalidated: 0 },
    `${split} (e): N.b's reused item's stored status is kept — \`list\` ` +
      `counts it no-change, beside the eight unresolved items`,
  );
  assertSameJson(
    identitySet(requireScopeNodes(nbItem, split)),
    [AU_NB, AU_NBZ].sort(),
    `${split} (e): N.b's reused item takes the decomposition's scope — N.b ` +
      `and all its current descendants, N.b.z now included (SPEC 10.6, ` +
      `10.7: every scope node presented)`,
  );
  assertBlockedBy(
    nbItem,
    [nbzItem.id],
    `${split} (e): N.b's reused item takes the decomposition's blockedBy — ` +
      `its child sections' items, exactly N.b.z's (SPEC 10.6, 10.7)`,
  );
  for (const [item, id, what] of [
    [naxItem, naxId, "N.a.x's item"],
    [pcNaAfter, pcNaId, "N.a's parent-consistency item"],
  ] as const) {
    if (item.id !== id) {
      fail(
        `${split} (e): ${what}, an existing item of N.a's decomposition, ` +
          `keeps its id ${id} (SPEC 10.7); got ${item.id}`,
      );
    }
  }

  return {
    nOriginalId,
    naOriginalId,
    rootId,
    pcNId: pcNItem.id,
    pcNaId,
    naxId,
    nbId,
    nbzId: nbzItem.id,
    ncId: ncItem.id,
    ncyId: ncyItem.id,
    sId,
  };
}

const T10_7_9 = defineProductTest({
  id: "T10.7-9",
  title:
    "`review split` of a `subtree-coherence` item whose scope root has children — in a baseline session, deleted ones included; in an audit session, the current ones alone — replaces it with one `subtree-coherence` item per child subtree (context: the child's ancestor chain, a deleted child's over its baseline-parent link; blockedBy: the one its session's strategy gives a `subtree-coherence` item, never the original's blockers — none in a path-blocks session, its child sections' items in the audit session) plus one `parent-consistency` item for the scope root (context: exactly the scope root's children; blockedBy: the per-child items); a per-child item whose kind and scope node are recorded as decomposed is not created, its decomposition standing in, recursively, in the `parent-consistency` item's blockedBy too; each decomposition item's origin is the `changed` nodes in its scope — for the `parent-consistency` item, in its scope node's subtree, the scope node included — and empty in the audit session; newly created decomposition items enter `unresolved` — asserted on a split of a resolved original (the path-blocks fixture), whose status must not propagate; existing kind+scope items are reused, keeping id, status, note, and recorded state and taking the decomposition's scope and blockedBy (the audit fixture); every item outside the decomposition that was blocked by the original becomes blocked by all its items; the original is removed and its id never reused across subsequent re-derivations in either strategy; the decomposition is recorded durably — `export` presents it — and governs re-derivation, with which `split` ends. Path-blocks fixture (top-level N holding N.a and N.b, and M holding M.k; N's own text and N.a's edited before `create --base`, N's item resolved `no-change`, M.k's text then edited, N's item split): (a) N.a's and N.b's items have empty blockedBy and N's `parent-consistency` item exactly those two; (b) N.a's origin is exactly {N.a}, N.b's empty, and N's `parent-consistency` item's exactly {N, N.a}, never the per-child origins' union; (c) once the split exits, M.k's `subtree-coherence` item and M's `parent-consistency` item (context and origin {M.k}, blockedBy M.k's item) are in the session, `unresolved`, in item order — a product not re-deriving at a split adds neither — and a later `updated` resolve re-adds no item at N. (f) Deleted children: with P's only children P.a and P.b deleted between the baseline and `create`, P's item (scope {P, P.a, P.b}) splits into `subtree-coherence` items scoped at the absent P.a and P.b — presented absent under their baseline identities, origins {P.a} and {P.b}, context exactly the file root and P, never the empty chain the current graph gives an absent node — and P's `parent-consistency` item (context exactly {P.a, P.b}; origin exactly {P, P.a, P.b}); texts and hashes keep their definitions: P's item's scope text is P's current subtree text before the split and its `parent-consistency` item's P's current own text after it, neither carrying P.a's or P.b's token, their recorded hashes for P `query node`'s and their entries for P.a and P.b the explicit absent marker, while the per-child scope texts and the `parent-consistency` item's context texts for P.a and P.b are their baseline subtree texts. (g) In a twin nesting N under G, G's `parent-consistency` item is blocked by exactly G.N's item before the split — unblocked once that item is resolved `no-change` — by exactly G.N.a's and G.N.b's items and G.N's `parent-consistency` item after it, `status` reporting it blocked, and still by those three once G.N.a's item is resolved `updated` and the session re-derived, each read from `export`. Audit fixture (N holding N.a — itself holding N.a.x — and N.b, and the leaf s; after `create`, N.b's item resolved `no-change` with a note and N.a's item split; then N.c holding N.c.y authored under N and N.b.z under N.b; N's item split): (a) N.c's new item's blockedBy is exactly N.c.y's item, never the original's blockers, which a product passing them on to new decomposition items assigns; (b) every decomposition item's origin is empty; (c) N.c.y's and N.b.z's items enter at N's split, `unresolved`, in item order — a product not re-deriving at a split adds neither; (d) no `subtree-coherence` item scoped at N.a enters, at the split or at a later re-derivation; N's `parent-consistency` item's context is exactly {N.a, N.b, N.c} and its blockedBy exactly N.a.x's item, N.a's `parent-consistency` item, N.b's item, and N.c's item; and the root's item is blocked by exactly those four, N's `parent-consistency` item, and s's item; (e) N.b's item keeps its id, note, `current` byte for byte, and stored status (`list` counts it `no-change`; reads present it `invalidated`, never `unresolved`), taking the scope {N.b, N.b.z} and the blockedBy N.b.z's item, while N.a.x's item and N.a's `parent-consistency` item keep their ids. `split` on any other kind, or on a childless scope root — a leaf's (s's) and, in an audit session over Q, Q's once its only child Q.r is deleted by manual edit after `create` — is refused — exit 1 with exactly one code-less finding in T10.7-14's form, `code` and `path` `null`, `locations` `[]` — nothing modified (SPEC 1.6, 5.5, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 12.7, 14)",
  run: async (product) => {
    // --- path-blocks fixture: (a), (b), (c), the refusals ---------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [PB_FILE]: pbSource("En own v0.", "En ay text v0.", "Em kay text v0."),
      },
      (workspace) => runPathBlocksFixture(product, workspace),
    );

    // --- (f) deleted children -------------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      T10_7_9_P_INITIAL_FILES,
      async (workspace) => {
        await runT1079DeletedChildrenArm(
          product,
          workspace,
          "T10.7-9 deleted-children arm (f)",
        );
      },
    );

    // --- (g) the nested twin --------------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [TW_FILE]: T10_7_9_G_INITIAL },
      (workspace) => runNestedTwinArm(product, workspace),
    );

    // --- the audit fixture: (a)–(e), its refusals, a later re-derivation ------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      T10_7_9_AUDIT_INITIAL_FILES,
      async (workspace) => {
        const prefix = "T10.7-9 audit fixture";
        const session = await runT1079AuditSplits(product, workspace, prefix);

        // Refused beside the successful splits (exit 1 in T10.7-14's finding
        // form, nothing modified — the shared check: the session file and
        // the whole workspace byte-identical): `split` of N's
        // parent-consistency item, an item of another kind, and of s's item,
        // a leaf's, whose scope root has no children (SPEC 10.7).
        await expectReviewRefusal(
          product,
          workspace,
          ["review", "split", "s", session.pcNId],
          SESSION_S_REL,
          `${prefix} [N's parent-consistency item: split on an item of any ` +
            `other kind is refused, SPEC 10.7]`,
          { nothingModified: true },
        );
        await expectReviewRefusal(
          product,
          workspace,
          ["review", "split", "s", session.sId],
          SESSION_S_REL,
          `${prefix} [s's item, a leaf's: split on a subtree-coherence item ` +
            `whose scope root has no children is refused, SPEC 10.7]`,
          { nothingModified: true },
        );

        // A later re-derivation (SPEC 10.5, 10.7): N.a.x's item — the leaf
        // beneath the decomposed N.a — resolved `updated` re-derives the
        // session. Both decompositions govern it: no subtree-coherence item
        // scoped at N or N.a is added back and nothing else enters, every
        // item keeps its id, neither original's id is reused, and blockedBy
        // is recomputed with each decomposed reference replaced by all items
        // of its decomposition, recursively.
        await resolveOk(
          product,
          workspace,
          "s",
          session.naxId,
          "updated",
          `${prefix} \`resolve s <N.a.x's item> --status updated\` — ` +
            `re-derives the session (SPEC 10.5)`,
        );
        const derived = await exportSession(product, workspace, "s", prefix);
        const later = `${prefix} after the later re-derivation`;
        assertSameJson(
          exportKindScopeSequence(derived.items),
          AU_ORDER_AFTER_SPLIT,
          `${later} (d): no subtree-coherence item scoped at N or N.a is ` +
            `added back — each decomposition applies in its place, ` +
            `recursively (P-9's invariant) — and no other item enters (SPEC ` +
            `10.1, 10.5, 10.7)`,
        );
        for (const [kind, node, id] of [
          ["subtree-coherence", AU_ROOT, session.rootId],
          ["parent-consistency", AU_N, session.pcNId],
          ["parent-consistency", AU_NA, session.pcNaId],
          ["subtree-coherence", AU_NAX, session.naxId],
          ["subtree-coherence", AU_NB, session.nbId],
          ["subtree-coherence", AU_NBZ, session.nbzId],
          ["subtree-coherence", AU_NC, session.ncId],
          ["subtree-coherence", AU_NCY, session.ncyId],
          ["subtree-coherence", AU_S, session.sId],
        ] as const) {
          if (requireItem(derived.items, kind, node, later).id !== id) {
            fail(
              `${later}: the ${kind} item at ${node} keeps its id ${id} — a ` +
                `generated or decomposition-produced item matching an ` +
                `existing one is that item (SPEC 10.5)`,
            );
          }
        }
        for (const [id, what] of [
          [session.nOriginalId, "N's"],
          [session.naOriginalId, "N.a's"],
        ] as const) {
          if (derived.items.some((item) => item.id === id)) {
            fail(
              `${later}: no item takes ${what} split original's id ${id} — ` +
                `it is never reused, across re-derivations too (SPEC 10.7)`,
            );
          }
        }
        assertBlockedBy(
          requireItemById(derived.items, session.pcNId, later),
          [session.naxId, session.pcNaId, session.nbId, session.ncId],
          `${later} (d): N's parent-consistency item is still blocked by ` +
            `exactly N.a.x's item, N.a's parent-consistency item, N.b's ` +
            `item, and N.c's item — the reference to the decomposed N.a ` +
            `replaced by all items of its decomposition (SPEC 10.5, 10.7)`,
        );
        assertBlockedBy(
          requireItemById(derived.items, session.rootId, later),
          [
            session.naxId,
            session.pcNaId,
            session.nbId,
            session.ncId,
            session.pcNId,
            session.sId,
          ],
          `${later} (d): the root's item is still blocked by exactly the ` +
            `items of N's decomposition, N.a's standing in recursively, and ` +
            `s's item — its child section N's decomposed reference replaced ` +
            `(SPEC 10.5, 10.6, 10.7)`,
        );
      },
    );

    // --- the childless refusal: Q's only child deleted after `create` ---------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [AQ_FILE]: T10_7_9_Q_INITIAL },
      async (workspace) => {
        const prefix = "T10.7-9 audit session over Q";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createAuditSession(product, workspace, "s", prefix);
        const created = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          rowSequence(created),
          [AQ_ROOT, AQ_Q, AQ_QR].map(
            (node) => `subtree-coherence ${node} unresolved`,
          ),
          `${prefix} staging premise: the audit items, Q.r's among them — Q ` +
            `holding its child at \`create\` (SPEC 10.6)`,
        );
        const qId = requireRow(created, "subtree-coherence", AQ_Q, prefix).id;
        await workspace.file(AQ_FILE, T10_7_9_Q_CHILD_DELETED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after Q.r's deletion`,
        );
        await expectReviewRefusal(
          product,
          workspace,
          ["review", "split", "s", qId],
          SESSION_S_REL,
          `${prefix} [Q's item, its only child Q.r deleted by manual edit ` +
            `after create: in an audit session the children are the current ` +
            `ones alone, so its scope root has none, though its scope as ` +
            `last assigned still lists Q.r — split on a subtree-coherence ` +
            `item whose scope root has no children is refused, SPEC 10.7]`,
          { nothingModified: true },
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.7-10 — resolve
// ---------------------------------------------------------------------------

const R10_FILE = "specs/R.mdx";
const R10_P = "specs/R.mdx#p";
const R10_PA = "specs/R.mdx#p.a";

function r10Spec(paText: string): string {
  return [
    '<S id="p">',
    "Pee own line.",
    "",
    '<S id="p.a">',
    paText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// The p.a edit follows the body's first `build`, so it is a staged-source
// record (helpers/staged-mdx.ts, S-9: judged before any product exists).
const T10_7_10_R_PA_V1 = stagedMdx(
  "T10.7-10 specs/R.mdx with p.a's text at v1 (the edit invalidating its resolution)",
  r10Spec("Paa line v1."),
);

const R10_NOTE = "reviewed; left as-is pending spec sync";
// The second resolve's note: distinct from the first, so neither the first
// note kept nor the two combined reads as it.
const R10_NOTE_2 = "second look: kept after the spec sync";

/** The rule each resolve's note follows (SPEC 10.2, 10.7). */
const NOTE_REPLACED_RULE =
  "each resolve replaces the note: `resolve` sets the note to the " +
  "`--note` text, removing any earlier note when `--note` is not given " +
  "(SPEC 10.2, 10.7)";

/**
 * Assert the note `review show <name> <item-id> --json` and `review export
 * <name> --json` present for one item: exactly `expected`, or — `null` —
 * none at all (SPEC 10.2: `note` is optional). No note is the member absent
 * or `null`, the review adapter's reading of an absent optional member; an
 * empty string is a note of its own (a `--note ""` resolve's), never none.
 */
async function assertPresentedNote(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  itemId: string,
  expected: string | null,
  context: string,
  rule: string,
): Promise<void> {
  const shown = await showItem(product, workspace, name, itemId, context);
  const exported = requireItemById(
    (await exportSession(product, workspace, name, context)).items,
    itemId,
    context,
  );
  for (const [read, note] of [
    ["show", shown.note],
    ["export", exported.note],
  ] as const) {
    if (expected === null ? note === undefined : note === expected) continue;
    fail(
      `${context}: \`review ${read}\` must present ` +
        (expected === null
          ? "no note for the item"
          : `exactly the note ${JSON.stringify(expected)} for the item`) +
        ` — ${rule}; got ` +
        (note === undefined ? "no note" : `the note ${JSON.stringify(note)}`),
    );
  }
}

const T10_7_10 = defineProductTest({
  id: "T10.7-10",
  title:
    "`review resolve` sets the status and records the current relevant state — `current` holds the resolve-moment hash captures and, after a re-resolve bracketing an edit, the new moment's values and not the old (pairwise-distinct `query node` captures discriminate); it works on any unblocked item regardless of status: flipping a resolved `no-change` to `skipped` without any edit works, and re-resolving an `invalidated` item works and clears the invalidation; resolving a blocked item is refused — exit 1 with exactly one code-less finding in T10.7-14's form, `code` and `path` `null`, `locations` `[]` — nothing modified; an unknown session name or item ID is exit 2 with the 12.7 error document as the entire stdout under `--json`; `--note` text is stored and reported by `show` and `export`, and each resolve replaces the note: a second resolve with `--note`, its status unchanged, leaves exactly its own text in both, and a further resolve without `--note` (the flip to `skipped`) leaves the item no note in either (SPEC 10.2, 10.3, 10.4, 10.7, 12.0, 12.7, 14)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [R10_FILE]: r10Spec("Paa line v0.") },
      async (workspace) => {
        const prefix = "T10.7-10";
        await buildOk(product, workspace, `${prefix} \`build\` at v0`);
        await createAuditSession(product, workspace, "s", prefix);
        const v0 = await queryNode(
          product,
          workspace,
          R10_PA,
          `${prefix} v0 capture`,
        );

        const initial = await sessionStatus(product, workspace, "s", prefix);
        const idP = requireRow(initial, "subtree-coherence", R10_P, prefix).id;
        const idPA = requireRow(
          initial,
          "subtree-coherence",
          R10_PA,
          prefix,
        ).id;
        const pRow = requireRow(initial, "subtree-coherence", R10_P, prefix);
        if (!pRow.blocked) {
          fail(
            `${prefix} staging premise: p's item is blocked by p.a's ` +
              `unresolved item (SPEC 10.3, 10.6)`,
          );
        }

        // Resolving a blocked item is refused: exit 1 in T10.7-14's finding
        // form, nothing modified (the shared check: the session file and the
        // whole workspace byte-identical).
        await expectReviewRefusal(
          product,
          workspace,
          ["review", "resolve", "s", idP, "--status", "no-change"],
          SESSION_S_REL,
          `${prefix} [p's blocked item: resolving a blocked item is refused, ` +
            `SPEC 10.7]`,
          { nothingModified: true },
        );

        // Unknown session and unknown item are usage errors (SPEC 10.7,
        // 12.0): exit 2, the 12.7 error document as the entire stdout
        // under --json.
        for (const [argv, why] of [
          [
            ["review", "resolve", "nosuch", idPA, "--status", "no-change"],
            "an unknown session name",
          ],
          [
            ["review", "resolve", "s", "no-such-item", "--status", "no-change"],
            "an unknown item ID",
          ],
        ] as const) {
          const context = `${prefix} \`${argv.join(" ")} --json\` (${why})`;
          const result = await expectExit(
            product,
            workspace,
            [...argv, "--json"],
            2,
            `${context} — unknown names in a review command's arguments are ` +
              `usage errors (SPEC 10.7, 12.0)`,
          );
          expectErrorDocument(
            result,
            `${context} — under --json, the exit-2 error document is the ` +
              `entire stdout (SPEC 12.0, 12.7, H-5)`,
          );
        }

        // Resolve with --note: status set, current relevant state recorded
        // (the v0 hashes), note stored and reported by show and export.
        await expectExit(
          product,
          workspace,
          [
            "review",
            "resolve",
            "s",
            idPA,
            "--status",
            "no-change",
            "--note",
            R10_NOTE,
          ],
          0,
          `${prefix} \`review resolve s <p.a's item> --status no-change ` +
            `--note <text>\``,
        );
        const noted = await showItem(product, workspace, "s", idPA, prefix);
        if (noted.status !== "no-change") {
          fail(
            `${prefix}: resolve sets the status (SPEC 10.7); expected ` +
              `no-change, got ${noted.status}`,
          );
        }
        if (noted.note !== R10_NOTE) {
          fail(
            `${prefix}: the --note text is stored and reported (SPEC 10.2, ` +
              `10.7); expected ${JSON.stringify(R10_NOTE)}, got ` +
              JSON.stringify(noted.note),
          );
        }
        assertRecordedHolds(
          noted.current,
          v0.hashes.subtreeHash,
          "the resolve-moment (v0) subtreeHash",
          `${prefix} post-resolve \`current\``,
        );
        assertRecordedHolds(
          noted.current,
          v0.hashes.metadataHash,
          "the scope node's metadataHash",
          `${prefix} post-resolve \`current\``,
        );
        const exportedNote = requireItemById(
          (await exportSession(product, workspace, "s", prefix)).items,
          idPA,
          prefix,
        ).note;
        if (exportedNote !== R10_NOTE) {
          fail(
            `${prefix}: \`export\` reports the stored note too (SPEC 10.2, ` +
              `10.7); expected ${JSON.stringify(R10_NOTE)}, got ` +
              JSON.stringify(exportedNote),
          );
        }

        // Each resolve replaces the note (SPEC 10.7): a second resolve with
        // `--note`, the status unchanged, leaves exactly its own text in
        // `show` and `export` — neither the first note kept nor the two
        // combined.
        await expectExit(
          product,
          workspace,
          [
            "review",
            "resolve",
            "s",
            idPA,
            "--status",
            "no-change",
            "--note",
            R10_NOTE_2,
          ],
          0,
          `${prefix} \`review resolve s <p.a's item> --status no-change ` +
            `--note <second text>\``,
        );
        await assertPresentedNote(
          product,
          workspace,
          "s",
          idPA,
          R10_NOTE_2,
          `${prefix} after the second \`--note\` resolve`,
          NOTE_REPLACED_RULE,
        );

        // Flipping a resolved status works — no edit in between: no-change
        // becomes skipped on the same unblocked item. The flip gives no
        // `--note`, so it removes the note as well (SPEC 10.7): the item
        // then carries none in `show` or `export`.
        await resolveOk(
          product,
          workspace,
          "s",
          idPA,
          "skipped",
          `${prefix} \`review resolve s <p.a's resolved item> --status ` +
            `skipped\` — resolve applies to any unblocked item regardless ` +
            `of status (SPEC 10.7)`,
        );
        if (
          (await showItem(product, workspace, "s", idPA, prefix)).status !==
          "skipped"
        ) {
          fail(
            `${prefix}: flipping a resolved status works — the item now ` +
              `reports skipped (SPEC 10.3, 10.7)`,
          );
        }
        await assertPresentedNote(
          product,
          workspace,
          "s",
          idPA,
          null,
          `${prefix} after the flip, a resolve without \`--note\``,
          NOTE_REPLACED_RULE,
        );

        // Invalidate the resolution: edit p.a, with hash premises, then
        // re-resolve the invalidated item — it works like any resolve and
        // records the new current state (v1), clearing the invalidation.
        await workspace.file(R10_FILE, T10_7_10_R_PA_V1);
        await buildOk(product, workspace, `${prefix} \`build\` at v1`);
        const v1 = await queryNode(
          product,
          workspace,
          R10_PA,
          `${prefix} v1 capture`,
        );
        assertPairwiseDistinct(
          [
            ["the v0 subtreeHash", v0.hashes.subtreeHash],
            ["the v1 subtreeHash", v1.hashes.subtreeHash],
            ["p.a's metadataHash", v0.hashes.metadataHash],
          ],
          prefix,
        );
        const staleRow = requireRow(
          await sessionStatus(product, workspace, "s", prefix),
          "subtree-coherence",
          R10_PA,
          prefix,
        );
        if (staleRow.status !== "invalidated") {
          fail(
            `${prefix} staging premise: after the edit, p.a's resolved item ` +
              `reads invalidated (SPEC 10.4); got ${staleRow.status}`,
          );
        }
        await resolveOk(
          product,
          workspace,
          "s",
          idPA,
          "no-change",
          `${prefix} \`review resolve s <p.a's invalidated item> --status ` +
            `no-change\` — re-resolving an invalidated item works (SPEC 10.7)`,
        );
        const reResolved = await showItem(
          product,
          workspace,
          "s",
          idPA,
          prefix,
        );
        if (reResolved.status !== "no-change") {
          fail(
            `${prefix}: the re-resolve set the status and recorded the ` +
              `current state, so the item no longer reads invalidated ` +
              `(SPEC 10.4, 10.7); got ${reResolved.status}`,
          );
        }
        assertRecordedHolds(
          reResolved.current,
          v1.hashes.subtreeHash,
          "the re-resolve-moment (v1) subtreeHash",
          `${prefix} post-re-resolve \`current\``,
        );
        assertRecordedLacks(
          reResolved.current,
          v0.hashes.subtreeHash,
          "the previous resolve's (v0) subtreeHash",
          `${prefix} post-re-resolve \`current\``,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.7-11 — coverage re-derivation
// ---------------------------------------------------------------------------

// D.mdx's `src` covers one K.mdx leaf via a direct `d` edge; the edit swaps
// which one. k1 is declared before k2, so the newly uncovered k1's item must
// order BEFORE the retained k2's — document order, not append order. k3,
// declared last and never covered, stays generated throughout: its item,
// resolved `skipped` with `--note` before the re-derivation, is the generated
// item matching an existing kind and scope node whose id, status, note, and
// recorded state the re-derivation must keep (SPEC 10.5) — src's matching
// item, the trigger, has its status, note, and recorded state rewritten by
// the triggering resolve itself (SPEC 10.7), so it shows the kept id alone.
const C11_D = "specs/D.mdx";
const C11_SRC = "specs/D.mdx#src";
const C11_K = "specs/K.mdx";
const C11_K1 = "specs/K.mdx#k1";
const C11_K2 = "specs/K.mdx#k2";
const C11_K3 = "specs/K.mdx#k3";

const C11_K3_NOTE = "skipped: k3 awaits its covering spec";

/** The rule a matching item's note follows across a re-derivation. */
const NOTE_KEPT_RULE =
  "a generated item whose kind and scope node match an existing item is " +
  "that item, keeping its id, status, note, and recorded state (SPEC 10.5)";

function c11DSpec(target: "k1" | "k2"): string {
  return [
    'import K from "./K.xspec"',
    "",
    `<S id="src" d={K.${target}}>`,
    "Src line.",
    "</S>",
    "",
  ].join("\n");
}

// The swap follows the body's first `build`, so it is a staged-source record
// (helpers/staged-mdx.ts, S-9: judged before any product exists).
const T10_7_11_D_TO_K2 = stagedMdx(
  "T10.7-11 specs/D.mdx with src's covering d edge moved from k1 to k2",
  c11DSpec("k2"),
);

const C11_K_SOURCE = [
  '<S id="k1">',
  "Kay-one line.",
  "</S>",
  "",
  '<S id="k2">',
  "Kay-two line.",
  "</S>",
  "",
  '<S id="k3">',
  "Kay-three line.",
  "</S>",
  "",
].join("\n");

const T10_7_11 = defineProductTest({
  id: "T10.7-11",
  title:
    "coverage re-derivation: resolving an `uncovered-requirement` item `updated` re-derives with the session's recorded profile against the current workspace — after swapping the one covering `d` edge from k1 to k2, the newly uncovered k1 gains an `uncovered-requirement` item created `unresolved` (the trigger's `updated` does not propagate) at its place in coverage item order (before the retained k2's item — document order, not append order); the meanwhile-covered k2's item is no longer generated and remains in the session with its resolved status and recorded state; the still-generated items matching an existing kind and scope node keep their ids — src's, the trigger, with the `updated` status its own resolve set, and the never-covered k3's, resolved `skipped` with `--note` before the re-derivation, keeping its status, its note (presented by `show` and `export` after the re-derivation), and its recorded state (SPEC 8, 10.2, 10.5, 10.7)",
  run: async (product) => {
    await withWorkspace(
      COVERAGE_CONFIG,
      { [C11_D]: c11DSpec("k1"), [C11_K]: C11_K_SOURCE },
      async (workspace) => {
        const prefix = "T10.7-11";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createCoverageSession(product, workspace, "p", "c", prefix);

        // At create: src (nothing covers it), k2, and k3 are the uncovered
        // required leaves; k1 is covered by src's d edge (SPEC 8, 10.7).
        const initial = await sessionStatus(product, workspace, "c", prefix);
        assertSameJson(
          rowSequence(initial),
          [
            `uncovered-requirement ${C11_SRC} unresolved`,
            `uncovered-requirement ${C11_K2} unresolved`,
            `uncovered-requirement ${C11_K3} unresolved`,
          ],
          `${prefix} staging premise: the create-time uncovered required ` +
            `nodes, in coverage item order (SPEC 8, 10.7)`,
        );
        const idSrc = requireRow(
          initial,
          "uncovered-requirement",
          C11_SRC,
          prefix,
        ).id;
        const idK2 = requireRow(
          initial,
          "uncovered-requirement",
          C11_K2,
          prefix,
        ).id;
        const idK3 = requireRow(
          initial,
          "uncovered-requirement",
          C11_K3,
          prefix,
        ).id;

        // Resolve k2's item so its retention keeps a discriminating status,
        // and capture its recorded state.
        await resolveOk(
          product,
          workspace,
          "c",
          idK2,
          "no-change",
          `${prefix} \`resolve c <k2's item> --status no-change\``,
        );
        const k2Before = await showItem(product, workspace, "c", idK2, prefix);

        // Resolve k3's item `skipped` with a note before the re-derivation,
        // a status no other item holds, and capture its recorded state: k3
        // stays uncovered, so the re-derivation generates its item again —
        // a generated item matching an existing kind and scope node.
        await expectExit(
          product,
          workspace,
          [
            "review",
            "resolve",
            "c",
            idK3,
            "--status",
            "skipped",
            "--note",
            C11_K3_NOTE,
          ],
          0,
          `${prefix} \`resolve c <k3's item> --status skipped --note <text>\``,
        );
        const k3Before = await showItem(product, workspace, "c", idK3, prefix);
        if (k3Before.status !== "skipped" || k3Before.note !== C11_K3_NOTE) {
          fail(
            `${prefix} staging premise: k3's item, resolved skipped with ` +
              `--note, reads skipped and presents that note before the ` +
              `re-derivation (SPEC 10.2, 10.7); got status ` +
              `${k3Before.status}, ` +
              (k3Before.note === undefined
                ? "no note"
                : `the note ${JSON.stringify(k3Before.note)}`),
          );
        }

        // The swap: src's covering edge moves from k1 to k2 — k1 newly
        // uncovered, k2 covered. k2's relevant hashes (its own subtree and
        // metadata hashes, SPEC 10.4) are untouched by an incoming-edge
        // change, so its resolution stands, and k3's, in a file the swap
        // leaves alone, likewise.
        await workspace.file(C11_D, T10_7_11_D_TO_K2);
        await buildOk(product, workspace, `${prefix} \`build\` after the swap`);
        const swapped = await sessionStatus(product, workspace, "c", prefix);
        const k2Stable = requireRow(
          swapped,
          "uncovered-requirement",
          C11_K2,
          prefix,
        );
        if (k2Stable.status !== "no-change") {
          fail(
            `${prefix} staging premise: the d-edge swap must leave k2's ` +
              `resolution standing — an incoming edge changes none of k2's ` +
              `relevant hashes (SPEC 5.5, 10.4); got ${k2Stable.status}`,
          );
        }
        const k3Stable = requireRow(
          swapped,
          "uncovered-requirement",
          C11_K3,
          prefix,
        );
        if (k3Stable.status !== "skipped") {
          fail(
            `${prefix} staging premise: the d-edge swap, in specs/D.mdx ` +
              `alone, must leave k3's resolution standing — it changes none ` +
              `of k3's relevant hashes (SPEC 5.5, 10.4); got ` +
              `${k3Stable.status}`,
          );
        }

        // The updated resolve of src's item re-derives with the recorded
        // profile against the current workspace (SPEC 10.5: every strategy;
        // 10.7).
        await resolveOk(
          product,
          workspace,
          "c",
          idSrc,
          "updated",
          `${prefix} \`resolve c <src's item> --status updated\` — triggers ` +
            `re-derivation (SPEC 10.5, 10.7)`,
        );
        const derived = await sessionStatus(product, workspace, "c", prefix);
        assertSameJson(
          rowSequence(derived),
          [
            `uncovered-requirement ${C11_SRC} updated`,
            `uncovered-requirement ${C11_K1} unresolved`,
            `uncovered-requirement ${C11_K2} no-change`,
            `uncovered-requirement ${C11_K3} skipped`,
          ],
          `${prefix} after the updated resolve: the newly uncovered k1 ` +
            `gains an item, created unresolved (the trigger's updated does ` +
            `not propagate), ordered at its document position before the ` +
            `retained k2's item; the meanwhile-covered k2's item is no ` +
            `longer generated and remains with its status; src's matching ` +
            `item keeps the status its own resolve set, and k3's matching ` +
            `item keeps its skipped status (SPEC 10.2, 10.5, 10.7)`,
        );
        const k1Row = requireRow(
          derived,
          "uncovered-requirement",
          C11_K1,
          prefix,
        );
        if (k1Row.id === idSrc || k1Row.id === idK2 || k1Row.id === idK3) {
          fail(
            `${prefix}: k1's new item takes a fresh id (SPEC 10.2); got ` +
              `${k1Row.id}, colliding with an existing item id`,
          );
        }
        if (
          requireRow(derived, "uncovered-requirement", C11_SRC, prefix).id !==
            idSrc ||
          requireRow(derived, "uncovered-requirement", C11_K2, prefix).id !==
            idK2 ||
          requireRow(derived, "uncovered-requirement", C11_K3, prefix).id !==
            idK3
        ) {
          fail(
            `${prefix}: matching items keep their ids across the ` +
              `re-derivation, as does the no-longer-generated k2 item, which ` +
              `remains in the session (SPEC 10.5)`,
          );
        }
        const exported = await exportSession(product, workspace, "c", prefix);
        assertSameInformation(
          requireItemById(exported.items, idK2, prefix).current,
          k2Before.current,
          `${prefix}: the no-longer-generated k2 item retains its recorded ` +
            `state across the re-derivation (SPEC 10.5)`,
        );
        assertSameInformation(
          requireItemById(exported.items, idK3, prefix).current,
          k3Before.current,
          `${prefix}: k3's matching item keeps its recorded state across ` +
            `the re-derivation (SPEC 10.5)`,
        );
        assertSameJson(
          exportKindScopeSequence(exported.items),
          [
            `uncovered-requirement ${C11_SRC}`,
            `uncovered-requirement ${C11_K1}`,
            `uncovered-requirement ${C11_K2}`,
            `uncovered-requirement ${C11_K3}`,
          ],
          `${prefix}: \`export\` presents the coverage item order too ` +
            `(SPEC 10.5, 10.7)`,
        );

        // k3's item, resolved with `--note` before the re-derivation,
        // presents that note after it, in `show` and `export` alike.
        await assertPresentedNote(
          product,
          workspace,
          "c",
          idK3,
          C11_K3_NOTE,
          `${prefix} k3's matching item after the re-derivation`,
          NOTE_KEPT_RULE,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.7-12 — payload text contract
// ---------------------------------------------------------------------------

// Sub-fixture A: a baseline (path-blocks) session generating every built-in
// kind except uncovered-requirement (sub-fixture C's coverage session
// supplies that one). One spec file, one code file present from the
// baseline, and two code files added after it. The staged nodes:
//   par { par.n { par.n.c } }  par's own text embeds `emb` (the expansion
//                              pin); par.n's own text is edited v0→v1 (the
//                              changed node) and again v1→v2 after create
//                              (the origin re-edit), so origin sides differ
//                              and neither equals the create-time value.
//   host [ host.n ]            host.n is added at v1: host becomes `changed`
//                              (its own content gains a child, SPEC 5.5/5.6)
//                              and host.n, under a changed ancestor, gets no
//                              item of its own — it enters payloads as an
//                              origin/context node added since the baseline.
//   gone                       own text edited v0→v1, section deleted at v2:
//                              an absent scope with create-time provenance
//                              and a since-deleted origin node (after side
//                              absent).
//   m { m.k }                  d target swapped told→tnew at v1: the
//                              metadata-changed node (scope own text; its
//                              added and removed d targets are context with
//                              subtree text).
//   told, tnew { tnew.c }      m's removed and added d targets (unchanged).
//   dep { dep.k }              depends on wt throughout: the
//                              dependency-consistency scope (own text).
//   wt { wt.c }                own text edited v0→v1: dep's changed target.
//   a { a.k }                  own text edited v0→v1: the target of the
//                              property members' markers (a fifth changed
//                              node, with a subtree-coherence item of its
//                              own).
//   emb                        the embedded target (unchanged).
// src/ref.ts (added at v1) references par.n and host.n inside the named unit
// `refUnit` (SPEC 4.6 attribution): the impacted code location that stays
// present (SPEC 9.2) — its item's scope enters the payload with the unit
// construct's byte range (SPEC 1.7). src/members.ts (present from the
// baseline) holds the class C whose two property members — TEST-SPEC
// T10.7-12's `m = () => { SPEC.a };` and decorated `@dec n = () => {
// SPEC.a };` — each hold a marker on a, edited since the baseline: the
// named units C.m and C.n (SPEC 4.6: a property whose initializer is an
// arrow function) are present impacted locations whose ranges run through
// the `;` ending each and, the decorated one's, from its `@` (SPEC 1.7; the
// T1.7-2 forms). src/del.ts (added at v1, deleted at v2) references par.n
// at the top level: its whole-file location's code-impact item presents a
// deleted location — absent, no text, no source range.
const M12_FILE = "specs/A.mdx";
const M12_ROOT = "specs/A.mdx";
const M12_PAR = "specs/A.mdx#par";
const M12_PARN = "specs/A.mdx#par.n";
const M12_HOST = "specs/A.mdx#host";
const M12_HOSTN = "specs/A.mdx#host.n";
const M12_GONE = "specs/A.mdx#gone";
const M12_M = "specs/A.mdx#m";
const M12_TOLD = "specs/A.mdx#told";
const M12_TNEW = "specs/A.mdx#tnew";
const M12_DEP = "specs/A.mdx#dep";
const M12_WT = "specs/A.mdx#wt";
const M12_A = "specs/A.mdx#a";
const M12_CODE_FILE = "src/ref.ts";
const M12_CODE = "src/ref.ts#refUnit";
const M12_CODE_DEL = "src/del.ts";
const M12_MEMBERS_FILE = "src/members.ts";
const M12_MEMBER_M = "src/members.ts#C.m";
const M12_MEMBER_N = "src/members.ts#C.n";

const M12_EMBEDDED_TEXT = "Embedded target text.";

interface M12SpecState {
  readonly parN: string;
  readonly nova: boolean;
  readonly gone: string | null;
  readonly mTarget: "told" | "tnew";
  readonly wt: string;
  readonly a: string;
}

function m12Spec(state: M12SpecState): string {
  return [
    '<S id="par">',
    'Par own {text("emb")} line.',
    "",
    '<S id="par.n">',
    state.parN,
    "",
    '<S id="par.n.c">',
    "Junior constant line.",
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="host">',
    "Host own line.",
    ...(state.nova ? ["", '<S id="host.n">', "Nova line.", "</S>"] : []),
    "</S>",
    "",
    ...(state.gone === null ? [] : ['<S id="gone">', state.gone, "</S>", ""]),
    `<S id="m" d={"${state.mTarget}"}>`,
    "Em own line.",
    "",
    '<S id="m.k">',
    "Em kid line.",
    "</S>",
    "</S>",
    "",
    '<S id="told">',
    "Told line.",
    "</S>",
    "",
    '<S id="tnew">',
    "Tnew own line.",
    "",
    '<S id="tnew.c">',
    "Tnew kid line.",
    "</S>",
    "</S>",
    "",
    '<S id="dep" d={"wt"}>',
    "Dep own line.",
    "",
    '<S id="dep.k">',
    "Dep kid line.",
    "</S>",
    "</S>",
    "",
    '<S id="wt">',
    state.wt,
    "",
    '<S id="wt.c">',
    "Wt kid line.",
    "</S>",
    "</S>",
    "",
    '<S id="a">',
    state.a,
    "",
    '<S id="a.k">',
    "Ay kid line.",
    "</S>",
    "</S>",
    "",
    '<S id="emb">',
    M12_EMBEDDED_TEXT,
    "</S>",
    "",
  ].join("\n");
}

const M12_V0: M12SpecState = {
  parN: "Node own v0 line.",
  nova: false,
  gone: "Gone own v0 line.",
  mTarget: "told",
  wt: "Wt own v0 line.",
  a: "Ay own v0 line.",
};
const M12_V1: M12SpecState = {
  parN: "Node own v1 line.",
  nova: true,
  gone: "Gone own v1 line.",
  mTarget: "tnew",
  wt: "Wt own v1 line.",
  a: "Ay own v1 line.",
};
const M12_V2: M12SpecState = {
  parN: "Node own v2 line.",
  nova: true,
  gone: null,
  mTarget: "tnew",
  wt: "Wt own v1 line.",
  a: "Ay own v1 line.",
};

// The matrix arm's v1 and v2 edits follow the body's first `build`, so they
// are staged-source records (helpers/staged-mdx.ts, S-9: judged before any
// product exists); the code sources staged beside v1 are TypeScript records
// (`M12_CODE_SOURCE`, `M12_CODE_DEL_SOURCE`).
const T10_7_12_A_V1 = stagedMdx(
  "T10.7-12 specs/A.mdx at v1 (the matrix arm's reviewed differences before create)",
  m12Spec(M12_V1),
);
const T10_7_12_A_V2 = stagedMdx(
  "T10.7-12 specs/A.mdx at v2 (par.n re-edited and gone deleted after create)",
  m12Spec(M12_V2),
);

// The present location's source: both markers sit inside the function
// declaration `refUnit`, so each reference is attributed to the named unit
// (SPEC 4.6) and the impacted location is `src/ref.ts#refUnit`. The comment
// before the unit carries multi-byte UTF-8 bytes, so the precomputed byte
// offsets diverge from code-point and UTF-16 offsets: the range assertion is
// byte-precise (SPEC 1.7).
const M12_CODE_BEFORE_UNIT =
  'import A from "../specs/A.xspec";\n\n// Präzise UTF-8-Bytes vor der Einheit (multi-byte prefix).\n\n';
const M12_CODE_UNIT_DECL = "function refUnit() {\n  A.par.n;\n  A.host.n;\n}";
// Staged beside v1, after the body's first `build`: a TypeScript
// staged-source record (module header), well-formed.
const M12_CODE_SOURCE = stagedTs(
  "T10.7-12 src/ref.ts (the matrix arm's present code location refUnit)",
  `${M12_CODE_BEFORE_UNIT}${M12_CODE_UNIT_DECL}\n`,
);

// refUnit's construct range (SPEC 1.7, 4.6): the function declaration's own
// bytes, from the `function` keyword through the closing brace —
// start-inclusive, end-exclusive byte offsets into the file.
const M12_CODE_RANGE: SourceRange = {
  start: Buffer.byteLength(M12_CODE_BEFORE_UNIT, "utf8"),
  end:
    Buffer.byteLength(M12_CODE_BEFORE_UNIT, "utf8") +
    Buffer.byteLength(M12_CODE_UNIT_DECL, "utf8"),
};

// The deleted location's source: a top-level marker, so the location is the
// whole file `src/del.ts` (SPEC 4.6). Staged beside v1, after the body's
// first `build`: a TypeScript staged-source record (module header),
// well-formed.
const M12_CODE_DEL_SOURCE = stagedTs(
  "T10.7-12 src/del.ts (the matrix arm's deleted whole-file code location)",
  'import A from "../specs/A.xspec";\n\nA.par.n;\n',
);

// The property members' source, TEST-SPEC T10.7-12's two members spelled
// exactly, each on a line of its own inside the class C, after a comment
// carrying multi-byte UTF-8 bytes (byte offsets diverge from code-point and
// UTF-16 ones) and the ambient declaration of the decorator `dec` (no unit:
// a declaration in an ambient context, SPEC 4.6). Present from the
// baseline, it is an initial file of the body's first workspace, created
// before any invocation: plain contents, judged well-formed by the
// workspace builder (S-9).
const M12_MEMBERS_BEFORE_CLASS =
  'import SPEC from "../specs/A.xspec";\n\n' +
  "declare function dec(...args: unknown[]): void;\n\n" +
  "// Präzise UTF-8-Bytes vor der Klasse (multi-byte prefix).\n";
const M12_MEMBERS_CLASS_PRE = "class C {\n  ";
/** C.m: a property member spelling its `;`, which its range runs through. */
const M12_MEMBER_M_UNIT = "m = () => { SPEC.a };";
const M12_MEMBERS_BETWEEN = "\n  ";
/** C.n: a decorated property member, from its `@` through its `;`. */
const M12_MEMBER_N_UNIT = "@dec n = () => { SPEC.a };";
const M12_MEMBERS_SOURCE =
  M12_MEMBERS_BEFORE_CLASS +
  M12_MEMBERS_CLASS_PRE +
  M12_MEMBER_M_UNIT +
  M12_MEMBERS_BETWEEN +
  M12_MEMBER_N_UNIT +
  "\n}\n";

/**
 * The byte range of `unit` placed right after `prefix` in a file —
 * start-inclusive, end-exclusive byte offsets (SPEC 1.7).
 */
function byteRangeAfter(prefix: string, unit: string): SourceRange {
  const start = Buffer.byteLength(prefix, "utf8");
  return { start, end: start + Buffer.byteLength(unit, "utf8") };
}

// C.m's and C.n's construct ranges (SPEC 1.7, 4.6): a property member's
// own characters run through the `;` ending it, where it spells one, and a
// decorated member's begin at its first decorator — `m = () => { SPEC.a };`
// and `@dec n = () => { SPEC.a };`, whole (the T1.7-2 forms).
const M12_MEMBER_M_RANGE = byteRangeAfter(
  M12_MEMBERS_BEFORE_CLASS + M12_MEMBERS_CLASS_PRE,
  M12_MEMBER_M_UNIT,
);
const M12_MEMBER_N_RANGE = byteRangeAfter(
  M12_MEMBERS_BEFORE_CLASS +
    M12_MEMBERS_CLASS_PRE +
    M12_MEMBER_M_UNIT +
    M12_MEMBERS_BETWEEN,
  M12_MEMBER_N_UNIT,
);

// The split sub-fixture: TEST-SPEC T10.7-12's context text of a
// split-produced `parent-consistency` item — every child of the scope root
// (SPEC 10.7: "whose context is the scope root's children"), where a
// generated item's context is its changed-branch heads (10.5). The
// top-level sp holds sp.a (holding sp.a.x) and sp.b (holding sp.b.y); sp's
// own text alone is edited before `create --base`, so sp is visited, its
// item's scope {sp, sp.a, sp.a.x, sp.b, sp.b.y}, and no child of sp is
// `changed` — a changed-branch reading of the split item's context would
// give none. Each child holds a child of its own, so its subtree text
// differs from its own text (SPEC 1.6) and the context-text kind is
// discriminating.
const SP12_FILE = "specs/S.mdx";
const SP12_SP = "specs/S.mdx#sp";
const SP12_A = "specs/S.mdx#sp.a";
const SP12_B = "specs/S.mdx#sp.b";

/** specs/S.mdx's bytes: sp, its own text `spOwn`, over two unedited children. */
function sp12Spec(spOwn: string): string {
  return [
    '<S id="sp">',
    spOwn,
    "",
    '<S id="sp.a">',
    "Split ay own line.",
    "",
    '<S id="sp.a.x">',
    "Split ay ex line.",
    "</S>",
    "</S>",
    "",
    '<S id="sp.b">',
    "Split bee own line.",
    "",
    '<S id="sp.b.y">',
    "Split bee why line.",
    "</S>",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// The split sub-fixture's workspace is created after the body's first
// `build`, so its initial source and its edit are staged-source records
// (helpers/staged-mdx.ts, S-9).
const T10_7_12_S_V0 = stagedMdx(
  "T10.7-12 specs/S.mdx with sp holding sp.a and sp.b, each holding a child (the split sub-fixture's baseline)",
  sp12Spec("Split own v0 line."),
);
const T10_7_12_S_V1 = stagedMdx(
  "T10.7-12 specs/S.mdx with sp's own text edited (the split sub-fixture, before `create --base`)",
  sp12Spec("Split own v1 line."),
);

// Sub-fixture B: the absent-node provenance arms (i) and (ii) — TEST-SPEC's
// top-level A holding K1 (here A.K1, SPEC 1.3) beside (ii)'s staging. A.K1
// is edited between the baseline and create, then deleted after create:
// its own item's scope root and its entry in A's parent-consistency context
// present the create-time value, not the baseline's, and keep it across the
// re-derivation A.K1's own `updated` resolve triggers, which runs without
// it. yq.y is deleted before create in the same edit that removes dm's `d`
// reference to it (T10.4-2's context-arm shape, yq.y nested under yq so the
// root's own content stays unchanged and A stays visitable) — the removed
// target enters mc dm's context, recorded at create while already absent,
// so it presents its baseline value (no mutating derivation ever saw newer
// text).
const B12_FILE = "specs/B.mdx";
const B12_A = "specs/B.mdx#A";
const B12_K1 = "specs/B.mdx#A.K1";
const B12_DM = "specs/B.mdx#dm";
const B12_YQ = "specs/B.mdx#yq";
const B12_YQY = "specs/B.mdx#yq.y";

function b12Spec(
  k1Line: string | null,
  withY: boolean,
  dmWithD: boolean,
): string {
  return [
    '<S id="A">',
    "Ay own line.",
    ...(k1Line === null ? [] : ["", '<S id="A.K1">', k1Line, "</S>"]),
    "</S>",
    "",
    dmWithD ? '<S id="dm" d={"yq.y"}>' : '<S id="dm">',
    "Dee own line.",
    "</S>",
    "",
    '<S id="yq">',
    "Ykew own line.",
    ...(withY ? ["", '<S id="yq.y">', "Wye baseline-only line.", "</S>"] : []),
    "</S>",
    "",
  ].join("\n");
}

// The provenance arm's initial source and its v1 and v2 edits follow the
// body's first `build` (the matrix arm's), so they are staged-source records
// (helpers/staged-mdx.ts, S-9: judged before any product exists).
const T10_7_12_B_T0 = stagedMdx(
  "T10.7-12 specs/B.mdx with A.K1 at T0, yq.y and dm's d reference present (the provenance sub-fixture's initial source)",
  b12Spec("Kay one line T0.", true, true),
);
const T10_7_12_B_K1_T1 = stagedMdx(
  "T10.7-12 specs/B.mdx with A.K1 at T1, yq.y and dm's d reference removed",
  b12Spec("Kay one line T1.", false, false),
);
const T10_7_12_B_WITHOUT_K1 = stagedMdx(
  "T10.7-12 specs/B.mdx without A.K1 (deleted after create)",
  b12Spec(null, false, false),
);

// The resolve-state sub-fixture: TEST-SPEC T10.7-12's provenance arm (iii)
// — resolve states count among the states an absent node's text comes from
// (SPEC 10.7: "the states under which mutating subcommands … derived or
// resolved the item with that node among its nodes"). The top-level N holds
// the unedited N.c; N's own text is edited before `create --base` (v1) and
// again after it (v2), N's subtree-coherence item resolved `no-change` at
// v2 — a resolve re-derives nothing (10.5), so no derivation ever sees v2 —
// and N's section then deleted, leaving the file no section (its implicit
// root alone, SPEC 1.2).
const RS12_FILE = "specs/N.mdx";
const RS12_N = "specs/N.mdx#N";
const RS12_NC_TEXT = "En cee line, never edited.";

/** specs/N.mdx's bytes: N, its own text `nOwn`, holding N.c — or nothing. */
function rs12Spec(nOwn: string | null): string {
  return nOwn === null
    ? ""
    : [
        '<S id="N">',
        nOwn,
        "",
        '<S id="N.c">',
        RS12_NC_TEXT,
        "</S>",
        "</S>",
        "",
      ].join("\n");
}

// The resolve-state sub-fixture's workspace is created after the body's
// first `build`, so its initial source and its edits are staged-source
// records (helpers/staged-mdx.ts, S-9).
const T10_7_12_N_V0 = stagedMdx(
  "T10.7-12 specs/N.mdx with N holding N.c, N at v0 (the resolve-state sub-fixture's baseline)",
  rs12Spec("En own v0 line."),
);
const T10_7_12_N_V1 = stagedMdx(
  "T10.7-12 specs/N.mdx with N's own text at v1 (the resolve-state sub-fixture, before `create --base`)",
  rs12Spec("En own v1 line."),
);
const T10_7_12_N_V2 = stagedMdx(
  "T10.7-12 specs/N.mdx with N's own text at v2 (the resolve-state sub-fixture, after `create`, before N's resolve)",
  rs12Spec("En own v2 line."),
);
const T10_7_12_N_DELETED = stagedMdx(
  "T10.7-12 specs/N.mdx with N's section deleted, no section left (the resolve-state sub-fixture, after N's resolve)",
  rs12Spec(null),
);

// Sub-fixture C: the uncovered-requirement payload. `targets: "all"` makes
// the branch node `top` required, so an uncovered scope exists whose subtree
// text differs from its own text; cov's d edge covers top.in.
const U12_FILE = "specs/U.mdx";
const U12_ROOT = "specs/U.mdx";
const U12_TOP = "specs/U.mdx#top";
const U12_COV = "specs/U.mdx#cov";

// The coverage sub-fixture follows the matrix and provenance sub-fixtures'
// invocations, so its initial source is a staged-source record (S-9's
// before-any-product clause), wrapped in place.
const U12_SOURCE = stagedMdx(
  "T10.7-12 specs/U.mdx (the coverage sub-fixture's initial source)",
  [
    '<S id="top">',
    "Top own line.",
    "",
    '<S id="top.in">',
    "Inner line.",
    "</S>",
    "</S>",
    "",
    '<S id="cov" d={"top.in"}>',
    "Cov line.",
    "</S>",
    "",
  ].join("\n"),
);

const T10_7_12 = defineProductTest({
  id: "T10.7-12",
  title:
    "payload text contract: a baseline fixture generating every built-in kind (a coverage session supplying `uncovered-requirement`), texts byte-asserted against `query node` captures in `export`, identically via `show` per item, and identically in `next --json` through a full walk of each session (one payload rule), with an embedding inside asserted texts to pin 1.6 expansion (the expanded target's bytes present, the unexpanded `text(` spelling absent); scope text by kind — the scope root's subtree text for `subtree-coherence`, the scope node's subtree text for `uncovered-requirement`, the scope node's own text (differing from its subtree text by fixture) for `parent-consistency`, `dependency-consistency`, and `metadata-consistency`, and a `code-impact` scope as identity, presence, and — when present — its source range, with no text (review payloads are one of the two range-presenting outputs for code locations: the present locations are named units whose construct ranges are byte-asserted against precomputed offsets — among them two property members, each holding a marker on a section edited since the baseline, `m = () => { SPEC.a };`, its range running through its `;`, and the decorated `@dec n = () => { SPEC.a };`, from its `@` through its `;` — and a deleted location's entry carries none); context text — own text for ancestor-chain contexts (`subtree-coherence`, `uncovered-requirement`), subtree text otherwise (the children of the scope node for `parent-consistency` — a generated item's changed-branch heads, and every child of the scope root, unchanged ones included, for a split-produced one, read after a `split` in a session of its own; `dependency-consistency`, `metadata-consistency`, and `code-impact` targets); origin text — a before/after pair of own text, before from the item's baseline state whether or not the node has an entry in `baseline`, after from the current graph (an originating node re-edited after `create` differs on both sides from the create-time value; on T10.4-7(a)'s fixture d2, joining x's origin at x's `updated` resolve's re-derivation and edited again after it — its baseline, join-time, and current texts pairwise distinct — presents its baseline text before and its current text after, never the join-time text before nor the before side absent), with the before side absent (no text) for a node added since the baseline and the after side absent for a since-deleted node; source ranges on present requirement nodes byte-equal to `query node`'s and absent on absent nodes; absent-node provenance, each arm on a node in a role 10.7 assigns a text — (i) a node edited between the baseline and `create`, recorded into items at `create`, then deleted, presents the create-time text, not the differing baseline value: the matrix's deleted scope gone, and A.K1 as A's `parent-consistency` context node and as its own `subtree-coherence` item's scope root, both still after A.K1's item is resolved `updated`, whose re-derivation over a graph without A.K1 produces neither item and keeps both, ids and all (A, having lost A.K1, is now visited: its `subtree-coherence` item added); (ii) a node deleted since the baseline and never seen by a mutating derivation with newer text — a `metadata-consistency` item's removed `d` target, deleted with the reference before `create` — presents its baseline value, at both stages; (iii) resolve states count: N, holding the unedited N.c, its own text edited before `create` and again after it, N's item resolved `no-change` and N's section then deleted, is presented absent with N's resolve-time subtree text, N.c's text included, never the create-time or baseline value (the three pairwise distinct); and at every `show` read — each item of the matrix, split, and coverage sessions, x's item, the provenance reads at either stage, and N's item — the human `review show` at the same state exits 0 and mentions the item's id, kind, and status, `blocked` where it is blocked, each `blockedBy` id, its scope, context, and origin identities, `absent` for each node or origin side presented absent, every line of its texts, and its source ranges' offsets (robust matching, H-3) (SPEC 1.6, 1.7, 4.6, 5.6, 9.2, 10.2, 10.3, 10.4, 10.5, 10.7, 12.0)",
  run: async (product) => {
    // --- sub-fixture A: the per-kind matrix over a path-blocks session -------
    await withWorkspace(
      SPECS_CODE_CONFIG,
      { [M12_FILE]: m12Spec(M12_V0), [M12_MEMBERS_FILE]: M12_MEMBERS_SOURCE },
      async (workspace) => {
        const prefix = "T10.7-12 matrix";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, `${prefix} \`build\` at v0`);

        // Baseline captures (origin `before` sides; gone's discrimination).
        const capture = async (identity: string, moment: string) =>
          await queryNode(
            product,
            workspace,
            identity,
            `${prefix} ${moment} capture`,
          );
        const parN0 = await capture(M12_PARN, "v0");
        const host0 = await capture(M12_HOST, "v0");
        const gone0 = await capture(M12_GONE, "v0");
        const m0 = await capture(M12_M, "v0");
        const wt0 = await capture(M12_WT, "v0");
        const a0 = await capture(M12_A, "v0");

        // v1 — the reviewed differences; then create.
        await workspace.file(M12_FILE, T10_7_12_A_V1);
        await workspace.file(M12_CODE_FILE, M12_CODE_SOURCE);
        await workspace.file(M12_CODE_DEL, M12_CODE_DEL_SOURCE);
        await buildOk(product, workspace, `${prefix} \`build\` at v1`);
        const parN1 = await capture(M12_PARN, "v1");
        const gone1 = await capture(M12_GONE, "v1");
        if (gone1.subtreeText === gone0.subtreeText) {
          fail(
            `${prefix} staging premise: gone's v0→v1 edit must change its ` +
              `subtree text (SPEC 1.6) so create-time provenance is ` +
              `distinguishable from the baseline value`,
          );
        }
        await createBaseSession(product, workspace, base, "s", prefix);

        // v2 — the post-create re-edit of the originating node par.n, gone's
        // deletion, and the deletion of the impacted code file src/del.ts
        // (its code-impact item's scope becomes a deleted location). No
        // re-derivation runs (the walk resolves `no-change` only), so the
        // item set is fixed at the create-time derivation.
        await workspace.file(M12_FILE, T10_7_12_A_V2);
        await fsp.rm(workspace.path(M12_CODE_DEL));
        await buildOk(product, workspace, `${prefix} \`build\` at v2`);

        // Current-state captures (present nodes' texts and ranges).
        const root2 = await capture(M12_ROOT, "v2");
        const par2 = await capture(M12_PAR, "v2");
        const parN2 = await capture(M12_PARN, "v2");
        const host2 = await capture(M12_HOST, "v2");
        const hostN2 = await capture(M12_HOSTN, "v2");
        const m2 = await capture(M12_M, "v2");
        const told2 = await capture(M12_TOLD, "v2");
        const tnew2 = await capture(M12_TNEW, "v2");
        const dep2 = await capture(M12_DEP, "v2");
        const wt2 = await capture(M12_WT, "v2");
        const a2 = await capture(M12_A, "v2");

        // Staging premises: every own-vs-subtree discrimination is real, the
        // origin moments are pairwise distinct, and the embedding expanded.
        for (const [report, node] of [
          [par2, "par"],
          [m2, "m"],
          [dep2, "dep"],
          [parN2, "par.n"],
          [tnew2, "tnew"],
          [wt2, "wt"],
          [a2, "a"],
        ] as const) {
          if (report.ownText === report.subtreeText) {
            fail(
              `${prefix} staging premise: ${node}'s own text must differ ` +
                `from its subtree text (SPEC 1.6) — the fixture gives it a ` +
                `child so the payload's text-kind selection is discriminating`,
            );
          }
        }
        assertPairwiseDistinct(
          [
            ["par.n's v0 own text", parN0.ownText],
            ["par.n's v1 own text", parN1.ownText],
            ["par.n's v2 own text", parN2.ownText],
          ],
          prefix,
        );
        if (
          !par2.ownText.includes(M12_EMBEDDED_TEXT) ||
          par2.ownText.includes("text(")
        ) {
          fail(
            `${prefix} staging premise: par's own text embeds emb — the ` +
              `expanded target bytes must appear and the unexpanded ` +
              `\`text(\` spelling must not (SPEC 1.6, 2.3); got ` +
              JSON.stringify(par2.ownText),
          );
        }

        // The reference read: export, then the per-item matrix.
        const exported = await exportSession(product, workspace, "s", prefix);
        assertSameJson(
          [...exportKindScopeSequence(exported.items)].sort(),
          [
            `subtree-coherence ${M12_PARN}`,
            `subtree-coherence ${M12_HOST}`,
            `subtree-coherence ${M12_GONE}`,
            `subtree-coherence ${M12_WT}`,
            `subtree-coherence ${M12_A}`,
            `parent-consistency ${M12_PAR}`,
            `metadata-consistency ${M12_M}`,
            `dependency-consistency ${M12_DEP}`,
            `code-impact ${M12_CODE}`,
            `code-impact ${M12_MEMBER_M}`,
            `code-impact ${M12_MEMBER_N}`,
            `code-impact ${M12_CODE_DEL}`,
          ].sort(),
          `${prefix}: the staged differences derive exactly one item per ` +
            `built-in path-blocks kind and scope — the five changed nodes' ` +
            `subtree-coherence items, par's parent-consistency item, m's ` +
            `metadata-consistency item, dep's dependency-consistency item, ` +
            `and one code-impact item per impacted location — the named ` +
            `unit refUnit, the property members C.m and C.n (each holding a ` +
            `marker on a, never the class C, whose own body references ` +
            `nothing), and the since-deleted file (SPEC 4.6, 5.6, 9.2, 10.5)`,
        );

        // subtree-coherence par.n: scope subtree text (current), context =
        // ancestor chain with own texts, origin pair v0/v2 (neither the
        // create-time v1 value).
        {
          const item = requireItem(
            exported.items,
            "subtree-coherence",
            M12_PARN,
            prefix,
          );
          const label = `${prefix} subtree-coherence(par.n)`;
          assertPresentState(
            item.scope,
            {
              node: M12_PARN,
              text: parN2.subtreeText,
              sourceRange: parN2.sourceRange,
            },
            `${label} scope — the scope root's subtree text, from the ` +
              `current graph`,
          );
          assertSameJson(
            identitySet(item.context),
            [M12_ROOT, M12_PAR].sort(),
            `${label}: context is the ancestor chain (SPEC 10.5)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_PAR, label),
            {
              node: M12_PAR,
              text: par2.ownText,
              sourceRange: par2.sourceRange,
            },
            `${label} context entry par — ancestor-chain context carries ` +
              `own text (the embedding-expanded value)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_ROOT, label),
            {
              node: M12_ROOT,
              text: root2.ownText,
              sourceRange: root2.sourceRange,
            },
            `${label} context entry root — ancestor-chain context carries ` +
              `own text`,
          );
          assertSameJson(
            identitySet(item.origin),
            [M12_PARN],
            `${label}: origin is the changed node (SPEC 10.5)`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_PARN, label),
            {
              before: { present: true, text: parN0.ownText },
              after: { present: true, text: parN2.ownText },
            },
            `${label} origin pair — before from the item's baseline (v0), ` +
              `after from the current graph (v2): the post-create re-edit ` +
              `makes both sides differ from the create-time v1 value`,
          );
        }

        // parent-consistency par: scope OWN text (not subtree — the fixture
        // makes them differ), context = the changed branch child par.n with
        // SUBTREE text, origin pair as above. The embedding pin runs on this
        // asserted scope text directly.
        {
          const item = requireItem(
            exported.items,
            "parent-consistency",
            M12_PAR,
            prefix,
          );
          const label = `${prefix} parent-consistency(par)`;
          assertPresentState(
            item.scope,
            {
              node: M12_PAR,
              text: par2.ownText,
              sourceRange: par2.sourceRange,
            },
            `${label} scope — the scope node's own text, not its subtree text`,
          );
          if (
            item.scope.text === undefined ||
            !item.scope.text.includes(M12_EMBEDDED_TEXT) ||
            item.scope.text.includes("text(")
          ) {
            fail(
              `${label}: the asserted scope text embeds emb — it must ` +
                `contain the expanded target text ` +
                `${JSON.stringify(M12_EMBEDDED_TEXT)} and no unexpanded ` +
                `\`text(\` spelling (SPEC 1.6, 2.3, 10.7); got ` +
                JSON.stringify(item.scope.text),
            );
          }
          assertSameJson(
            identitySet(item.context),
            [M12_PARN],
            `${label}: context is the changed branch's child (SPEC 10.5)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_PARN, label),
            {
              node: M12_PARN,
              text: parN2.subtreeText,
              sourceRange: parN2.sourceRange,
            },
            `${label} context entry par.n — a parent-consistency branch ` +
              `child carries subtree text (a product reporting own text ` +
              `fails: they differ by fixture)`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_PARN, label),
            {
              before: { present: true, text: parN0.ownText },
              after: { present: true, text: parN2.ownText },
            },
            `${label} origin pair`,
          );
        }

        // subtree-coherence host: origin holds both origin-pair shapes —
        // host present on both sides, host.n added since the baseline (its
        // before side is the absent side, no text).
        {
          const item = requireItem(
            exported.items,
            "subtree-coherence",
            M12_HOST,
            prefix,
          );
          const label = `${prefix} subtree-coherence(host)`;
          assertPresentState(
            item.scope,
            {
              node: M12_HOST,
              text: host2.subtreeText,
              sourceRange: host2.sourceRange,
            },
            `${label} scope — subtree text`,
          );
          assertSameJson(
            identitySet(item.origin),
            [M12_HOST, M12_HOSTN].sort(),
            `${label}: origin is the changed nodes in scope — host (its own ` +
              `content gained a child) and the added host.n (SPEC 5.5, 5.6, ` +
              `10.5)`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_HOST, label),
            {
              before: { present: true, text: host0.ownText },
              after: { present: true, text: host2.ownText },
            },
            `${label} origin pair for host`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_HOSTN, label),
            {
              before: { present: false },
              after: { present: true, text: hostN2.ownText },
            },
            `${label} origin pair for host.n — added since the baseline: ` +
              `the before side is the absent side, presented absent with no ` +
              `text (SPEC 10.7)`,
          );
        }

        // subtree-coherence gone: the absent scope — create-time (v1)
        // subtree text, no source range — and the since-deleted origin
        // node's after side absent.
        {
          const item = requireItem(
            exported.items,
            "subtree-coherence",
            M12_GONE,
            prefix,
          );
          const label = `${prefix} subtree-coherence(gone)`;
          assertAbsentState(
            item.scope,
            { node: M12_GONE, text: gone1.subtreeText },
            `${label} scope — deleted after create: its text is the value ` +
              `of the most recent graph state containing it, the ` +
              `create-time derivation (v1), not the baseline (SPEC 10.7)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_ROOT, label),
            {
              node: M12_ROOT,
              text: root2.ownText,
              sourceRange: root2.sourceRange,
            },
            `${label} context entry root — still present, own text from the ` +
              `current graph`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_GONE, label),
            {
              before: { present: true, text: gone0.ownText },
              after: { present: false },
            },
            `${label} origin pair — for a since-deleted node the after side ` +
              `is the absent side, presented absent with no text (SPEC 10.7)`,
          );
        }

        // metadata-consistency m: scope own text; context = the added and
        // removed d targets with subtree texts; origin pair of m's own text
        // (unchanged — both sides equal).
        {
          const item = requireItem(
            exported.items,
            "metadata-consistency",
            M12_M,
            prefix,
          );
          const label = `${prefix} metadata-consistency(m)`;
          assertPresentState(
            item.scope,
            { node: M12_M, text: m2.ownText, sourceRange: m2.sourceRange },
            `${label} scope — the scope node's own text, not its subtree text`,
          );
          assertSameJson(
            identitySet(item.context),
            [M12_TOLD, M12_TNEW].sort(),
            `${label}: context is the added and removed d targets (SPEC 10.5)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_TOLD, label),
            {
              node: M12_TOLD,
              text: told2.subtreeText,
              sourceRange: told2.sourceRange,
            },
            `${label} context entry told (removed target) — subtree text`,
          );
          assertPresentState(
            requireContextEntry(item, M12_TNEW, label),
            {
              node: M12_TNEW,
              text: tnew2.subtreeText,
              sourceRange: tnew2.sourceRange,
            },
            `${label} context entry tnew (added target) — subtree text (a ` +
              `product reporting own text fails: tnew has a child)`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_M, label),
            {
              before: { present: true, text: m0.ownText },
              after: { present: true, text: m2.ownText },
            },
            `${label} origin pair — m's own text is untouched, so both ` +
              `sides carry the same value`,
          );
        }

        // dependency-consistency dep: scope own text; context = the changed
        // target wt with subtree text; origin = wt's v0→v1 own-text pair.
        {
          const item = requireItem(
            exported.items,
            "dependency-consistency",
            M12_DEP,
            prefix,
          );
          const label = `${prefix} dependency-consistency(dep)`;
          assertPresentState(
            item.scope,
            {
              node: M12_DEP,
              text: dep2.ownText,
              sourceRange: dep2.sourceRange,
            },
            `${label} scope — the scope node's own text, not its subtree text`,
          );
          assertSameJson(
            identitySet(item.context),
            [M12_WT],
            `${label}: context is the changed upstream target (SPEC 10.5)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_WT, label),
            {
              node: M12_WT,
              text: wt2.subtreeText,
              sourceRange: wt2.sourceRange,
            },
            `${label} context entry wt — a dependency-consistency target ` +
              `carries subtree text`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_WT, label),
            {
              before: { present: true, text: wt0.ownText },
              after: { present: true, text: wt2.ownText },
            },
            `${label} origin pair for wt`,
          );
        }

        // code-impact src/ref.ts#refUnit — the present location: the scope
        // enters as identity, presence, and its source range — review
        // payloads are one of the two range-presenting outputs for code
        // locations (SPEC 1.7) — with no text (SPEC 10.7). The range is the
        // named unit's construct (the function declaration binding
        // `refUnit`, SPEC 4.6), asserted against precomputed byte offsets.
        // Context = the targets that make it impacted (the added host.n
        // included) with subtree texts; origin = those targets' originating
        // nodes with their pairs.
        {
          const item = requireItem(
            exported.items,
            "code-impact",
            M12_CODE,
            prefix,
          );
          const label = `${prefix} code-impact(${M12_CODE})`;
          assertPresentState(
            item.scope,
            { node: M12_CODE, text: undefined, sourceRange: M12_CODE_RANGE },
            `${label} scope — a present code location enters the payload ` +
              `with its source range, the construct binding the unit's ` +
              `name, asserted against precomputed byte offsets, and with ` +
              `no text value (SPEC 10.7, 1.7, 4.6)`,
          );
          assertSameJson(
            identitySet(item.context),
            [M12_PARN, M12_HOSTN].sort(),
            `${label}: context is the impact-edge targets that make the ` +
              `location impacted, added targets included (SPEC 9.2, 10.5)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_PARN, label),
            {
              node: M12_PARN,
              text: parN2.subtreeText,
              sourceRange: parN2.sourceRange,
            },
            `${label} context entry par.n — code-impact targets carry ` +
              `subtree text`,
          );
          assertPresentState(
            requireContextEntry(item, M12_HOSTN, label),
            {
              node: M12_HOSTN,
              text: hostN2.subtreeText,
              sourceRange: hostN2.sourceRange,
            },
            `${label} context entry host.n`,
          );
          assertSameJson(
            identitySet(item.origin),
            [M12_PARN, M12_HOSTN].sort(),
            `${label}: origin is the originating nodes of the targets' ` +
              `changes (SPEC 5.6, 10.5)`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_PARN, label),
            {
              before: { present: true, text: parN0.ownText },
              after: { present: true, text: parN2.ownText },
            },
            `${label} origin pair for par.n`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_HOSTN, label),
            {
              before: { present: false },
              after: { present: true, text: hostN2.ownText },
            },
            `${label} origin pair for host.n — added since the baseline`,
          );
        }

        // code-impact src/members.ts#C.m and #C.n — the property members,
        // present impacted locations (each holds a marker on a, whose own
        // text was edited since the baseline): each scope enters as
        // identity, presence, and its source range, with no text (SPEC
        // 10.7) — C.m's construct `m = () => { SPEC.a };` running through
        // the `;` ending it, C.n's `@dec n = () => { SPEC.a };` from its
        // first decorator's `@` through its `;` (SPEC 1.7, 4.6; the T1.7-2
        // forms), asserted against precomputed byte offsets. Context = a,
        // the target that makes each impacted, with its subtree text (a has
        // a child, so own and subtree text differ); origin = a with its
        // own-text pair.
        for (const [member, range, construct] of [
          [
            M12_MEMBER_M,
            M12_MEMBER_M_RANGE,
            "`m = () => { SPEC.a };`, a property member's own characters " +
              "running through the `;` ending it",
          ],
          [
            M12_MEMBER_N,
            M12_MEMBER_N_RANGE,
            "`@dec n = () => { SPEC.a };`, a decorated property member's " +
              "own characters, from its first decorator's `@` through the " +
              "`;` ending it",
          ],
        ] as const) {
          const item = requireItem(
            exported.items,
            "code-impact",
            member,
            prefix,
          );
          const label = `${prefix} code-impact(${member})`;
          assertPresentState(
            item.scope,
            { node: member, text: undefined, sourceRange: range },
            `${label} scope — a present code location enters the payload ` +
              `with its source range, the construct binding the unit's ` +
              `name — ${construct} — asserted against precomputed byte ` +
              `offsets, and with no text value (SPEC 10.7, 1.7, 4.6)`,
          );
          assertSameJson(
            identitySet(item.context),
            [M12_A],
            `${label}: context is the impact-edge target that makes the ` +
              `location impacted (SPEC 9.2, 10.5)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_A, label),
            { node: M12_A, text: a2.subtreeText, sourceRange: a2.sourceRange },
            `${label} context entry a — code-impact targets carry subtree ` +
              `text (a product reporting own text fails: a has a child)`,
          );
          assertSameJson(
            identitySet(item.origin),
            [M12_A],
            `${label}: origin is the originating node of the target's ` +
              `change (SPEC 5.6, 10.5)`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_A, label),
            {
              before: { present: true, text: a0.ownText },
              after: { present: true, text: a2.ownText },
            },
            `${label} origin pair for a — before from the item's baseline ` +
              `(v0), after from the current graph`,
          );
        }

        // code-impact src/del.ts — the deleted location: the file was
        // removed at v2, so its item's scope presents the code location
        // absent — identity and absence alone, no text and no source range
        // (SPEC 10.7, 1.7; reported under its baseline identity, SPEC 9.2).
        {
          const item = requireItem(
            exported.items,
            "code-impact",
            M12_CODE_DEL,
            prefix,
          );
          const label = `${prefix} code-impact(${M12_CODE_DEL})`;
          assertAbsentState(
            item.scope,
            { node: M12_CODE_DEL, text: undefined },
            `${label} scope — a deleted code location's entry carries no ` +
              `source range and no text (SPEC 10.7, 1.7)`,
          );
          assertSameJson(
            identitySet(item.context),
            [M12_PARN],
            `${label}: context is the impact-edge target that makes the ` +
              `location impacted (SPEC 9.2, 10.5)`,
          );
          assertPresentState(
            requireContextEntry(item, M12_PARN, label),
            {
              node: M12_PARN,
              text: parN2.subtreeText,
              sourceRange: parN2.sourceRange,
            },
            `${label} context entry par.n — code-impact targets carry ` +
              `subtree text`,
          );
          assertSameJson(
            identitySet(item.origin),
            [M12_PARN],
            `${label}: origin is the originating node of the target's ` +
              `change (SPEC 5.6, 10.5)`,
          );
          assertOriginPair(
            requireOriginEntry(item, M12_PARN, label),
            {
              before: { present: true, text: parN0.ownText },
              after: { present: true, text: parN2.ownText },
            },
            `${label} origin pair for par.n`,
          );
        }

        // One payload rule (SPEC 10.7): `show` presents each item with the
        // identical payload, and a full `next` walk returns every item once
        // with the identical payload. Each `show` read is followed by the
        // human `show` at the same state (T12.0-1, SPEC 12.0; the module
        // header), before the walk resolves anything.
        for (const item of exported.items) {
          const shown = await showItem(
            product,
            workspace,
            "s",
            item.id,
            `${prefix} show/export compare`,
          );
          assertSameInformation(
            payloadProjection(shown),
            payloadProjection(item),
            `${prefix}: \`show\` of item ${item.id} (${item.kind} ` +
              `${item.scope.node}) presents the same self-contained text ` +
              `payload as \`export\` (SPEC 10.7)`,
          );
          await assertHumanShowItem(
            product,
            workspace,
            "s",
            shown,
            `${prefix} ${shown.kind}(${shown.scope.node})`,
          );
        }
        await walkNextAgainstReference(
          product,
          workspace,
          "s",
          exported.items,
          `${prefix} next walk`,
        );
      },
    );

    // --- the split sub-fixture: a split-produced item's context texts -------
    // TEST-SPEC T10.7-12's context text of a split-produced
    // `parent-consistency` item: every child of the scope root (SPEC 10.7) —
    // here two unedited children, which a changed-branch reading (a
    // generated item's, 10.5) would leave out — each with its subtree text.
    // Read from `export` after the split, then `show` per item and a full
    // `next` walk (one payload rule).
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [SP12_FILE]: T10_7_12_S_V0 },
      async (workspace) => {
        const prefix = "T10.7-12 split";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, `${prefix} \`build\` at v0`);
        await workspace.file(SP12_FILE, T10_7_12_S_V1);
        await buildOk(product, workspace, `${prefix} \`build\` at v1`);
        await createBaseSession(product, workspace, base, "s", prefix);
        const created = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          rowSequence(created),
          [`subtree-coherence ${SP12_SP} unresolved`],
          `${prefix} staging premise: sp's own-text edit yields sp's ` +
            `subtree-coherence item alone — sp visited, no child of it ` +
            `changed, and sp, top-level, without a non-root ancestor (SPEC ` +
            `5.6, 10.5)`,
        );
        const idSp = requireRow(
          created,
          "subtree-coherence",
          SP12_SP,
          prefix,
        ).id;
        await expectExit(
          product,
          workspace,
          ["review", "split", "s", idSp],
          0,
          `${prefix} \`review split s <sp's item>\``,
        );

        // Current captures: sp's own text (the split item's scope text) and
        // its children's subtree texts (its context texts).
        const sp1 = await queryNode(
          product,
          workspace,
          SP12_SP,
          `${prefix} capture of sp`,
        );
        const spA = await queryNode(
          product,
          workspace,
          SP12_A,
          `${prefix} capture of sp.a`,
        );
        const spB = await queryNode(
          product,
          workspace,
          SP12_B,
          `${prefix} capture of sp.b`,
        );
        for (const [report, node] of [
          [sp1, "sp"],
          [spA, "sp.a"],
          [spB, "sp.b"],
        ] as const) {
          if (report.ownText === report.subtreeText) {
            fail(
              `${prefix} staging premise: ${node}'s own text must differ ` +
                `from its subtree text (SPEC 1.6) — the fixture gives it a ` +
                `child so the payload's text-kind selection is ` +
                `discriminating`,
            );
          }
        }

        const exported = await exportSession(product, workspace, "s", prefix);
        assertSameJson(
          [...exportKindScopeSequence(exported.items)].sort(),
          [
            `subtree-coherence ${SP12_A}`,
            `subtree-coherence ${SP12_B}`,
            `parent-consistency ${SP12_SP}`,
          ].sort(),
          `${prefix} staging premise: the split replaces sp's item by one ` +
            `subtree-coherence item per child subtree and sp's ` +
            `parent-consistency item (SPEC 10.7)`,
        );
        const item = requireItem(
          exported.items,
          "parent-consistency",
          SP12_SP,
          prefix,
        );
        const label = `${prefix} parent-consistency(sp), split-produced`;
        assertPresentState(
          item.scope,
          { node: SP12_SP, text: sp1.ownText, sourceRange: sp1.sourceRange },
          `${label} scope — the scope node's own text, not its subtree text`,
        );
        assertSameJson(
          identitySet(item.context),
          [SP12_A, SP12_B].sort(),
          `${label}: context is every child of the scope root — the ` +
            `split's parent-consistency item's context is "the scope ` +
            `root's children", unedited ones included, where a generated ` +
            `item's is its changed-branch heads, none here (SPEC 10.5, ` +
            `10.7)`,
        );
        for (const [child, report] of [
          [SP12_A, spA],
          [SP12_B, spB],
        ] as const) {
          assertPresentState(
            requireContextEntry(item, child, label),
            {
              node: child,
              text: report.subtreeText,
              sourceRange: report.sourceRange,
            },
            `${label} context entry ${child} — a parent-consistency ` +
              `item's children carry subtree text (a product reporting own ` +
              `text fails: they differ by fixture) (SPEC 10.7)`,
          );
        }

        // One payload rule over the decomposition: `show` per item, each
        // followed by the human `show` at the same state (T12.0-1, SPEC
        // 12.0; the module header), then the full `next` walk.
        for (const each of exported.items) {
          const shown = await showItem(
            product,
            workspace,
            "s",
            each.id,
            `${prefix} show/export compare`,
          );
          assertSameInformation(
            payloadProjection(shown),
            payloadProjection(each),
            `${prefix}: \`show\` of item ${each.id} (${each.kind} ` +
              `${each.scope.node}) presents the same self-contained text ` +
              `payload as \`export\` (SPEC 10.7)`,
          );
          await assertHumanShowItem(
            product,
            workspace,
            "s",
            shown,
            `${prefix} ${shown.kind}(${shown.scope.node})`,
          );
        }
        await walkNextAgainstReference(
          product,
          workspace,
          "s",
          exported.items,
          `${prefix} next walk`,
        );
      },
    );

    // --- the joined-origin sub-fixture: T10.4-7(a)'s d2 ---------------------
    // TEST-SPEC T10.7-12's origin text of a node that joined the origin at a
    // re-derivation, which gains no entry in `baseline` (SPEC 10.2;
    // T10.2-2): its before side is still its value in the item's baseline
    // state (10.7). T10.4-7(a)'s fixture through section-10.4.ts' exported
    // stagings, loaded when the arm runs: section-10.4.ts imports this module
    // at load (T10.4-8's stagings), so a static import back would close a
    // module cycle.
    const t1047 = await import("./section-10.4.js");
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      t1047.T10_4_7_INITIAL_FILES,
      async (workspace) => {
        const prefix = "T10.7-12 joined origin (T10.4-7(a)'s d2)";
        const d1 = t1047.T10_4_7_NODES.d1;
        const d2 = t1047.T10_4_7_NODES.d2;
        const { baseline, xId } = await t1047.stageT1047Session(
          product,
          workspace,
          prefix,
        );
        // specs/D2.mdx is untouched since the baseline commit (the staging's
        // premises keep d2's ownHash at its baseline value), so d2's own
        // text now is its value in x's item's baseline state.
        const atBaseline = await queryNode(
          product,
          workspace,
          d2,
          `${prefix} capture of d2 at its baseline text`,
        );
        await t1047.stageT1047State(
          product,
          workspace,
          baseline,
          "d2-edited",
          `${prefix} after d2's edit`,
        );
        const atJoin = await queryNode(
          product,
          workspace,
          d2,
          `${prefix} capture of d2 as it joins x's origin`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          xId,
          "updated",
          `${prefix} \`review resolve s <x's item> --status updated\` — the ` +
            `re-derivation making d2 join x's origin (SPEC 10.5)`,
        );
        // d2's text edited a second time, once x's item is resolved.
        await workspace.file(t1047.T10_4_7_FILES.d2, t1047.T10_7_12_D2_V2);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after d2's second edit`,
        );
        const atNow = await queryNode(
          product,
          workspace,
          d2,
          `${prefix} current capture of d2`,
        );
        assertPairwiseDistinct(
          [
            ["d2's baseline own text", atBaseline.ownText],
            ["d2's own text when it joined x's origin", atJoin.ownText],
            ["d2's current own text", atNow.ownText],
          ],
          prefix,
        );

        const shown = await showItem(product, workspace, "s", xId, prefix);
        assertSameJson(
          identitySet(shown.origin),
          [d1, d2].sort(),
          `${prefix} staging premise: the re-derivation x's \`updated\` ` +
            `resolve triggered made d2 join x's origin, presented {d1, d2} ` +
            `(SPEC 5.6, 10.5; T10.4-7(a))`,
        );
        assertOriginPair(
          requireOriginEntry(shown, d2, prefix),
          {
            before: { present: true, text: atBaseline.ownText },
            after: { present: true, text: atNow.ownText },
          },
          `${prefix} x's origin pair for d2 — before: its value in the ` +
            `item's baseline state, the recorded baseline graph, though d2, ` +
            `joined at a re-derivation, has no entry in \`baseline\` — ` +
            `never its join-time text, nor the before side absent; after: ` +
            `its current text (SPEC 10.2, 10.7)`,
        );
        const exported = await exportSession(product, workspace, "s", prefix);
        assertSameInformation(
          payloadProjection(requireItemById(exported.items, xId, prefix)),
          payloadProjection(shown),
          `${prefix}: \`export\` presents x's item with the same payload as ` +
            `\`show\` (SPEC 10.7)`,
        );
        await assertHumanShowItem(
          product,
          workspace,
          "s",
          shown,
          `${prefix} x's item`,
        );
      },
    );

    // --- sub-fixture B: absent-node provenance (i) and (ii) -------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [B12_FILE]: T10_7_12_B_T0 },
      async (workspace) => {
        const prefix = "T10.7-12 provenance";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, `${prefix} \`build\` at v0`);
        const k0 = await queryNode(
          product,
          workspace,
          B12_K1,
          `${prefix} v0 capture of A.K1`,
        );
        const y0 = await queryNode(
          product,
          workspace,
          B12_YQY,
          `${prefix} v0 capture of yq.y`,
        );

        // v1: A.K1 edited (T0→T1); yq.y deleted with dm's d reference to it
        // removed in the same write (so no unresolved reference exists).
        await workspace.file(B12_FILE, T10_7_12_B_K1_T1);
        await buildOk(product, workspace, `${prefix} \`build\` at v1`);
        const k1 = await queryNode(
          product,
          workspace,
          B12_K1,
          `${prefix} v1 capture of A.K1`,
        );
        if (k1.subtreeText === k0.subtreeText) {
          fail(
            `${prefix} staging premise: A.K1's v0→v1 edit must change its ` +
              `subtree text (SPEC 1.6) — the create-time and baseline ` +
              `values must differ for the provenance discrimination`,
          );
        }
        await createBaseSession(product, workspace, base, "s", prefix);

        /** The session's items as sorted `kind scope` strings. */
        const kindScopes = (report: SessionStatusReport): string[] =>
          rowSequence(report)
            .map((row) => row.split(" ").slice(0, 2).join(" "))
            .sort();
        const initial = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopes(initial),
          [
            `metadata-consistency ${B12_DM}`,
            `parent-consistency ${B12_A}`,
            `subtree-coherence ${B12_K1}`,
            `subtree-coherence ${B12_YQ}`,
          ].sort(),
          `${prefix} staging premise: the create-time items — A.K1 changed ` +
            `(edit) and visited, A its one non-root ancestor (A's ` +
            `parent-consistency item, context {A.K1}), yq changed (its ` +
            `child yq.y deleted, so yq.y itself is skipped under its changed ` +
            `ancestor), dm metadata-changed (d removed) (SPEC 5.6, 10.5)`,
        );
        const idK1 = requireRow(
          initial,
          "subtree-coherence",
          B12_K1,
          prefix,
        ).id;
        const idA = requireRow(initial, "parent-consistency", B12_A, prefix).id;
        const idDM = requireRow(
          initial,
          "metadata-consistency",
          B12_DM,
          prefix,
        ).id;

        // v2: delete A.K1 after create.
        await workspace.file(B12_FILE, T10_7_12_B_WITHOUT_K1);
        await buildOk(product, workspace, `${prefix} \`build\` at v2`);

        const assertProvenance = async (stage: string): Promise<void> => {
          const at = `${prefix} ${stage}`;
          // (i) A.K1 — edited between the baseline and create, recorded at
          // create into its own item's scope and A's parent-consistency
          // context, then deleted: in both roles 10.7 assigns a text, it
          // presents the create-time (v1) subtree text, not the baseline's.
          const kItem = await showItem(product, workspace, "s", idK1, at);
          assertAbsentState(
            kItem.scope,
            { node: B12_K1, text: k1.subtreeText },
            `${at}, A.K1's item scope root — the most recent graph state ` +
              `containing A.K1 is the create-time derivation (v1), not the ` +
              `baseline: the values differ by fixture (SPEC 10.7)`,
          );
          const aItem = await showItem(product, workspace, "s", idA, at);
          assertSameJson(
            identitySet(aItem.context),
            [B12_K1],
            `${at}: A's parent-consistency context is its changed branch's ` +
              `child A.K1, as last assigned — the generators no longer ` +
              `produce the item (SPEC 10.4, 10.5)`,
          );
          assertAbsentState(
            requireContextEntry(aItem, B12_K1, at),
            { node: B12_K1, text: k1.subtreeText },
            `${at}, A.K1 in A's parent-consistency context — a ` +
              `parent-consistency context node carries subtree text, an ` +
              `absent one's from the most recent graph state containing it: ` +
              `the create-time derivation (v1), not the baseline (SPEC 10.7)`,
          );
          // (ii) yq.y — deleted since the baseline before create, never seen
          // by a mutating derivation with newer text: its context entry in
          // dm's item presents the baseline subtree text.
          const dmItem = await showItem(product, workspace, "s", idDM, at);
          assertSameJson(
            identitySet(dmItem.context),
            [B12_YQY],
            `${at}: dm's metadata-consistency context is its removed d ` +
              `target yq.y (SPEC 10.5)`,
          );
          assertAbsentState(
            requireContextEntry(dmItem, B12_YQY, at),
            { node: B12_YQY, text: y0.subtreeText },
            `${at}, yq.y in dm's context — deleted since the baseline and ` +
              `never seen by a mutating derivation with newer text: it ` +
              `presents its baseline value (SPEC 10.7)`,
          );
          // One payload rule: export presents the same values; then the
          // human form of each `show` read at the same state, only reads
          // having run since (T12.0-1, SPEC 12.0; the module header).
          const exported = await exportSession(product, workspace, "s", at);
          const reads = [
            [kItem, "A.K1's item"],
            [aItem, "A's parent-consistency item"],
            [dmItem, "dm's item"],
          ] as const;
          for (const [shown, what] of reads) {
            assertSameInformation(
              payloadProjection(requireItemById(exported.items, shown.id, at)),
              payloadProjection(shown),
              `${at}: \`export\` presents ${what} with the same payload as ` +
                `\`show\` (SPEC 10.7)`,
            );
          }
          for (const [shown, what] of reads) {
            await assertHumanShowItem(
              product,
              workspace,
              "s",
              shown,
              `${at}, ${what}`,
            );
          }
        };

        await assertProvenance("after the A.K1 deletion");

        // A.K1's own item resolved `updated`: the re-derivation it triggers
        // runs over a graph containing neither A.K1 nor yq.y — a state not
        // containing a node contributes nothing (SPEC 10.7) — and generates
        // neither A.K1's item nor A's parent-consistency item: A, having
        // lost A.K1, is `changed` and visited itself, A.K1 skipped beneath
        // it, and A has no non-root ancestor (SPEC 5.6, 10.5). Both items
        // remain, keeping their ids (10.5), beside A's new item.
        await resolveOk(
          product,
          workspace,
          "s",
          idK1,
          "updated",
          `${prefix} \`resolve s <A.K1's item> --status updated\` — ` +
            `re-derivation over a graph without A.K1 (SPEC 10.5)`,
        );
        const rederived = await sessionStatus(product, workspace, "s", prefix);
        const after = `${prefix} after A.K1's \`updated\` resolve`;
        assertSameJson(
          kindScopes(rederived),
          [
            `metadata-consistency ${B12_DM}`,
            `parent-consistency ${B12_A}`,
            `subtree-coherence ${B12_A}`,
            `subtree-coherence ${B12_K1}`,
            `subtree-coherence ${B12_YQ}`,
          ].sort(),
          `${after}, staging premise: the re-derivation keeps A.K1's item ` +
            `and A's parent-consistency item, which it no longer generates, ` +
            `and adds A's subtree-coherence item — A, having lost A.K1, is ` +
            `now visited (SPEC 5.6, 10.5)`,
        );
        for (const [kind, scope, id] of [
          ["subtree-coherence", B12_K1, idK1],
          ["parent-consistency", B12_A, idA],
        ] as const) {
          const kept = requireRow(rederived, kind, scope, after).id;
          if (kept !== id) {
            fail(
              `${after}, staging premise: the ${kind} item scoped at ` +
                `${scope} keeps its id ${id} — items that no longer ` +
                `generate remain in the session (SPEC 10.5); got ${kept}`,
            );
          }
        }
        await assertProvenance("after A.K1's updated-resolve re-derivation");
      },
    );

    // --- the resolve-state sub-fixture: provenance (iii) ---------------------
    // Resolve states count among the states an absent node's text comes from
    // (SPEC 10.7): N's item, resolved `no-change` with N at v2 — a state no
    // derivation saw — presents N, once deleted, with its v2 subtree text.
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [RS12_FILE]: T10_7_12_N_V0 },
      async (workspace) => {
        const prefix = "T10.7-12 resolve state";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await buildOk(product, workspace, `${prefix} \`build\` at v0`);
        const n0 = await queryNode(
          product,
          workspace,
          RS12_N,
          `${prefix} v0 capture of N`,
        );
        await workspace.file(RS12_FILE, T10_7_12_N_V1);
        await buildOk(product, workspace, `${prefix} \`build\` at v1`);
        const n1 = await queryNode(
          product,
          workspace,
          RS12_N,
          `${prefix} v1 capture of N`,
        );
        await createBaseSession(product, workspace, base, "s", prefix);
        const created = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          rowSequence(created),
          [`subtree-coherence ${RS12_N} unresolved`],
          `${prefix} staging premise: N's own-text edit yields N's ` +
            `subtree-coherence item alone — N visited, N.c unedited, and N, ` +
            `top-level, without a non-root ancestor (SPEC 5.6, 10.5)`,
        );
        const idN = requireRow(created, "subtree-coherence", RS12_N, prefix).id;

        // v2: N's own text edited again after create; N's item then resolved
        // `no-change` — the resolve records the state with N at v2 (SPEC
        // 10.4, 10.7) and re-derives nothing (10.5).
        await workspace.file(RS12_FILE, T10_7_12_N_V2);
        await buildOk(product, workspace, `${prefix} \`build\` at v2`);
        const n2 = await queryNode(
          product,
          workspace,
          RS12_N,
          `${prefix} v2 capture of N`,
        );
        assertPairwiseDistinct(
          [
            ["N's baseline subtree text", n0.subtreeText],
            ["N's create-time subtree text", n1.subtreeText],
            ["N's resolve-time subtree text", n2.subtreeText],
          ],
          prefix,
        );
        if (!n2.subtreeText.includes(RS12_NC_TEXT)) {
          fail(
            `${prefix} staging premise: N's resolve-time subtree text holds ` +
              `N.c's text ${JSON.stringify(RS12_NC_TEXT)} (SPEC 1.6: a ` +
              `node's subtree text includes its children's contributions); ` +
              `got ${JSON.stringify(n2.subtreeText)}`,
          );
        }
        await resolveOk(
          product,
          workspace,
          "s",
          idN,
          "no-change",
          `${prefix} \`resolve s <N's item> --status no-change\` at v2`,
        );

        // v3: N's section deleted.
        await workspace.file(RS12_FILE, T10_7_12_N_DELETED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after N's deletion`,
        );

        const shown = await showItem(product, workspace, "s", idN, prefix);
        assertAbsentState(
          shown.scope,
          { node: RS12_N, text: n2.subtreeText },
          `${prefix}, N's item scope root — deleted after its \`no-change\` ` +
            `resolve: the most recent graph state containing N is the one ` +
            `that resolve recorded the item under (v2), N.c's text included ` +
            `— never the create-time derivation's (v1) nor the baseline's ` +
            `(v0) (SPEC 10.7)`,
        );
        const exported = await exportSession(product, workspace, "s", prefix);
        assertSameInformation(
          payloadProjection(requireItemById(exported.items, idN, prefix)),
          payloadProjection(shown),
          `${prefix}: \`export\` presents N's item with the same payload as ` +
            `\`show\` (SPEC 10.7)`,
        );
        await assertHumanShowItem(
          product,
          workspace,
          "s",
          shown,
          `${prefix} N's item`,
        );
      },
    );

    // --- sub-fixture C: the uncovered-requirement payload ---------------------
    await withWorkspace(
      COVERAGE_ALL_CONFIG,
      { [U12_FILE]: U12_SOURCE },
      async (workspace) => {
        const prefix = "T10.7-12 coverage";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createCoverageSession(product, workspace, "p", "c", prefix);

        const top = await queryNode(
          product,
          workspace,
          U12_TOP,
          `${prefix} capture of top`,
        );
        const cov = await queryNode(
          product,
          workspace,
          U12_COV,
          `${prefix} capture of cov`,
        );
        const root = await queryNode(
          product,
          workspace,
          U12_ROOT,
          `${prefix} capture of the root`,
        );
        if (top.ownText === top.subtreeText) {
          fail(
            `${prefix} staging premise: top's own text must differ from its ` +
              `subtree text (SPEC 1.6) — \`targets: "all"\` makes the ` +
              `branch node required so the uncovered-requirement scope-text ` +
              `kind is discriminating`,
          );
        }

        const exported = await exportSession(product, workspace, "c", prefix);
        assertSameJson(
          exportKindScopeSequence(exported.items),
          [
            `uncovered-requirement ${U12_TOP}`,
            `uncovered-requirement ${U12_COV}`,
          ],
          `${prefix}: the uncovered required nodes — the branch top ` +
            `(required under targets: "all") and the leaf cov; top.in is ` +
            `covered by cov's d edge (SPEC 8, 8.1, 10.7)`,
        );
        const topItem = requireItem(
          exported.items,
          "uncovered-requirement",
          U12_TOP,
          prefix,
        );
        const label = `${prefix} uncovered-requirement(top)`;
        assertPresentState(
          topItem.scope,
          {
            node: U12_TOP,
            text: top.subtreeText,
            sourceRange: top.sourceRange,
          },
          `${label} scope — the scope node's SUBTREE text (a product ` +
            `reporting own text fails: they differ by fixture)`,
        );
        assertSameJson(
          identitySet(topItem.context),
          [U12_ROOT],
          `${label}: context is the node's ancestor chain (SPEC 10.7)`,
        );
        assertPresentState(
          requireContextEntry(topItem, U12_ROOT, label),
          { node: U12_ROOT, text: root.ownText, sourceRange: root.sourceRange },
          `${label} context entry root — ancestor-chain context carries own ` +
            `text`,
        );
        assertSameJson(
          identitySet(topItem.origin),
          [],
          `${label}: a coverage item's origin is empty (SPEC 10.7)`,
        );
        const covItem = requireItem(
          exported.items,
          "uncovered-requirement",
          U12_COV,
          prefix,
        );
        assertPresentState(
          covItem.scope,
          {
            node: U12_COV,
            text: cov.subtreeText,
            sourceRange: cov.sourceRange,
          },
          `${prefix} uncovered-requirement(cov) scope — subtree text`,
        );

        // One payload rule over the coverage session too: show per item and
        // the full next walk — each `show` read followed by the human `show`
        // at the same state (T12.0-1, SPEC 12.0; the module header).
        for (const item of exported.items) {
          const shown = await showItem(
            product,
            workspace,
            "c",
            item.id,
            prefix,
          );
          assertSameInformation(
            payloadProjection(shown),
            payloadProjection(item),
            `${prefix}: \`show\` of item ${item.id} presents the same ` +
              `payload as \`export\` (SPEC 10.7)`,
          );
          await assertHumanShowItem(
            product,
            workspace,
            "c",
            shown,
            `${prefix} ${shown.kind}(${shown.scope.node})`,
          );
        }
        await walkNextAgainstReference(
          product,
          workspace,
          "c",
          exported.items,
          `${prefix} next walk`,
        );
      },
    );
  },
});

/** TEST-SPEC §10.7 second half, in canonical ID order (SUITE-39). */
export const section107iiTests: readonly ProductTestEntry[] = [
  T10_7_7,
  T10_7_8,
  T10_7_9,
  T10_7_10,
  T10_7_11,
  T10_7_12,
];
