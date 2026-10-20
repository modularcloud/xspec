// TEST-SPEC §10.5 (built-in strategy: path-blocks) — SUITE-36:
// T10.5-1…T10.5-9.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.5: for each `changed` node — skipping nodes with a `changed`
// ancestor — path-blocks derives one `subtree-coherence` item plus one
// `parent-consistency` item per non-root ancestor (a single item per
// ancestor, against the union of changed branches, blocked per branch by the
// child's item); metadata and dependency impact add one
// `metadata-consistency` item per `metadata-changed` node, one
// `dependency-consistency` item per node — a root included — having, in the
// current graph, a dependency edge (`depends` or `embeds`) to a both-sides
// target whose effectiveHash changed, and one `code-impact` item per
// impacted location (its impact edges `references` and `embeds`, 9.2),
// whatever its code categories — the last two's origins the originating
// nodes of their targets' categories, a target's `metadata-changed` counting
// only when its `d` targets changed. Items are totally ordered (depth
// deepest-first, roots 0; kind; file path; document order; `code-impact`
// last by location identity; absent scopes after present ones). In a
// baseline session a node deleted since the baseline is the child of its
// baseline parent, identities mapped through the journal, and a present
// node the child of its current parent, as node relations and node sets
// alone — texts and hashes keep their definitions. Resolving `updated`
// re-derives the session with the recorded creation parameters; `split`
// decompositions apply recursively and are never re-added.
//
// Conservative operationalizations (noted per H-3/H-4):
// - `context` and `origin` are asserted as sorted identity sets: SPEC 10.5
//   fixes their membership, not a payload order. The sorted lists keep
//   duplicates, so a node entering twice fails the compare (T10.5-7: f's
//   target enters its context once though two edges reach it). Texts and
//   byte-level payload contracts are T10.7-12's business, but for T10.5-7's
//   root-item scope text, byte-asserted in `show` and `export` against the
//   root's own text derived by hand from SPEC 1.6 and 3, as T1.6-1's
//   expected texts are, and T10.5-8's, byte-asserted there against the
//   root's subtree text — its file's entire compiled Markdown output —
//   derived likewise, the root's own text diagnosed; and for T10.5-9's
//   deleted-node fixture, whose scope texts and parent-consistency
//   context text are byte-asserted in `export`, `show`, and `next --json`
//   against the value `query node` reports after the deletion (no hand
//   derivation), no scope or context text carrying the deleted node's
//   token.
// - `blockedBy` is compared as a sorted id set (SPEC 10.5/10.7 fix which
//   items block, not an order within the field).
// - An item's scope set — every node of its scope as last assigned (SPEC
//   10.4), which the payload presents (10.7: every scope, context, and
//   origin node) — is read through the review adapter's `requireScopeNodes`
//   (its assumed member `scopeNodes`) and compared as a sorted identity set:
//   T10.5-5's matching arm asserts it before and after the re-derivation,
//   T10.5-8 its item (3)'s, and T10.5-9 each item's with every scope
//   node's presence — a deleted node presented absent under its baseline
//   identity mapped forward through the journal (10.4) — a payload
//   presenting no scope-node list failing it loudly (H-3). The scope
//   text, read from the current graph (10.7), cannot tell a scope as last
//   assigned from the generated one.
// - A matched item's `current` is compared byte for byte as the decoded
//   member's JSON rendering, member order included, between `export`
//   captures (T10.5-5's matching arm; its inner shape is the product's,
//   H-3).
// - An item's `baseline` is read entry by entry where its entries are
//   asserted (T10.5-8's item (3)), through the review adapter's
//   `decodeRecordedState` (its assumed RecordedState shape): each entry's
//   node, presence, and recorded hashes or explicit absent marker (SPEC
//   10.2, 10.4). A present node's subtreeHash and metadataHash are compared
//   with `query node`'s capture at the baseline, before the edits — the
//   value after them, which differs for the root, a, and a.b (a premise),
//   diagnosed as a baseline filled from the current graph — and d's entry,
//   d added since the baseline, must exist, present it absent, carry the
//   marker, and hold none of d's current hashes. An item's `current` is
//   read the same way where its entries are asserted (T10.5-9's
//   deleted-node fixture, in `export`, `show`, and `next --json`): each
//   relevant hash the entry names compared with `query node`'s report
//   after the deletion, and the deleted A.B.C's entry presenting it
//   absent with the explicit absent marker. Entries beyond those the
//   entries name are not asserted.
// - Item order is asserted as the exact `(kind, scope)` row sequence of
//   `status` and `export`; `next`'s presentation of the order is asserted by
//   walking the session (repeated `next` + `resolve --status no-change`),
//   which visits items in item order because every blocker in these fixtures
//   precedes its dependents.
// - The absent-scope ordering keys exercised are scope-node identity, staged
//   discriminatingly (recorded document order opposite to identity order),
//   and the final item `id` tiebreak. The tiebreak needs two same-kind
//   absent items with equal identity strings: same kind forces distinct
//   scope nodes (10.5: at most one item per kind and scope node), and
//   distinct nodes present one identity only through reintroduction after a
//   journaled rename or move (5.4: the reintroducing node starts a new
//   canonical chain; 10.4: reads map each recorded identity forward through
//   the journal). T10.5-4's tie sub-fixture stages it with two file roots
//   and two journaled file moves onto one path, each root deleted after its
//   move, and asserts the two rows in item-id byte order (12.0) in
//   `status`, `export`, and the `next` walk, reading the ids from the
//   product. A root, not a section, carries the tie in path-blocks:
//   authoring a section changes its parent's own content (5.5, 5.6), so the
//   parent is `changed` and the new section's own item is skipped under it
//   (10.5's skipping rule), whereas a new file's root has no parent and
//   enters as its own changed node.
// - A resolved item whose context set changes is expected `invalidated` on
//   reads even after a re-derivation assigns it the new context set (SPEC
//   10.5: a matched item keeps its recorded state, and 10.4 alone, against
//   that recorded state, decides whether it then reads `invalidated` — its
//   current context set differing from its recorded one), and stays so
//   until re-resolved.
// - Every fixture edit is followed by an explicit `build` before any read,
//   so no read relies on the 13.3 refresh path (T13.3-*'s business); hash
//   premises via `query node` bracket the edits that must isolate a single
//   sensitivity (SPEC 5.5), as in §10.4.
// - Staged-source records (helpers/staged-mdx.ts, S-9: judged before any
//   product exists): every `.mdx` edit a body stages after its first product
//   invocation — T10.5-1's extended-fixture edit and its chain fixture's two
//   (a.b.c alone; a.b and a.b.c in the both-edited twin), T10.5-3's
//   current-graph-edges edit, its three origin-counting stagings, and its
//   one-item-per-location arm's two edits (T9.2-4's), T10.5-4's deletion of
//   v.e and v.f and its tie sub-fixture's two specs/X.mdx stagings, T10.5-5's
//   p.b edit, r.c revert, both decomposition edits, its matching arm's edits
//   and n.c's authoring, its kept-blockedBy arm's edits and a.k1's revert, and
//   its P/Q arms' edits (p's; p's and p.q's; p.q's again with p's reverted),
//   T10.5-6's par.s edit, T10.5-8's edits in both stagings (specs/R.mdx with
//   and without its top-level text edited, specs/S.mdx's x.y), each after
//   the baseline capture's `build`, T10.5-9's deletion of A.B.C's section
//   (after the deleted-node fixture's baseline `build`, and after its audit
//   contrast's `create`) — is the same template call moved to
//   module level as a record, as is the initial `.mdx` file of every
//   workspace created after the body's first `build` (T10.5-1's extended
//   fixture, chain fixture, and the chain fixture's both-edited twin,
//   T10.5-3's current-graph-edges, origin-counting, and one-item-per-location
//   workspaces, T10.5-4's tie sub-fixture, T10.5-5's decomposition
//   sub-fixture and its matching, kept-blockedBy, skipping, and
//   newly-visited workspaces, T10.5-8's twin, T10.5-9's journal-arm,
//   audit-contrast, and present-node workspaces). A staging that precedes a
//   body's first `build` (each fixture's first edit, between `gitCommitAll`
//   and that `build`) stays plain, as do each body's first workspace's
//   initial `files` entries (S-7's sweep reaches them against the stub) —
//   T10.5-7's, its one workspace, `.mdx` and code sources alike, and its t
//   edit among them — but T10.5-8's, whose initial sources are exported
//   records its two workspaces share (as T10.4-7's are), and T10.5-9's,
//   its specs/D.mdx the record its journal arm and audit contrast share.
//   The tie sub-fixture's deletions are plain removals of files
//   (`fsp.rm`), which S-9 does not judge. T10.5-9's manual deletions
//   after its `rename` and its `move` edit bytes the product rewrote,
//   which no harness constant equals, so each is an anchored
//   `workspace.edit()` (`editRewritten`: the anchor's single occurrence
//   and the edited text's derivability diagnosed first), judged at
//   staging time.
// - The configuration of every workspace created after a body's first `build`
//   (T10.5-1's extended fixture, chain fixture, and the chain fixture's
//   both-edited twin, T10.5-3's current-graph-edges workspace, T10.5-4's tie
//   sub-fixture, T10.5-5's decomposition sub-fixture and its four later
//   workspaces, T10.5-8's twin, T10.5-9's journal-arm, audit-contrast, and
//   present-node workspaces) is `SPECS_ONLY_CONFIG`, a TypeScript
//   staged-source record (helpers/staged-ts.ts; S-9's TypeScript and timing
//   clauses), well-formed, staged wherever that configuration is;
//   `SPECS_CODE_CONFIG` serves only bodies' first workspaces and stays
//   plain, its bytes staged in T10.5-3's origin-counting and
//   one-item-per-location workspaces as the record `T10_5_3_CODE_CONFIG`,
//   beside their code sources, records too (`T10_5_3_OC_CODE`,
//   `T10_5_3_L_BOTH_TS`). T10.5-7's configuration, `T10_5_7_CONFIG` (the
//   spec group over `specs/*.mdx` and the code group over `src/*.ts` its
//   TEST-SPEC entry stages), serves its one workspace, created before any
//   invocation, and stays plain too.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import type {
  ExportReport,
  ImpactedCodeEntry,
  ItemStatus,
  NodeHashes,
  NodeReport,
  RecordedNodeEntry,
  ReviewItem,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  ITEM_STATUSES,
  decodeExportReport,
  decodeImpactReport,
  decodeItemReport,
  decodeNextReport,
  decodeNodeReport,
  decodeRecordedState,
  decodeSessionListReport,
  decodeSessionStatusReport,
  requireScopeNodes,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  bytesEqual,
  fail,
} from "../../helpers/assertions.js";
import { deriveMdx } from "../../helpers/mdx-derivability.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { type StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertSameJson,
  buildOk,
  expectExit,
  expectReviewRefusal,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = stagedTs(
  "T10.5-1/T10.5-3/T10.5-4/T10.5-5/T10.5-8/T10.5-9 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// Spec group plus a code group (SPEC 7.2) — fixtures deriving `code-impact`
// items need an impacted code location (SPEC 9.2, 10.5).
const SPECS_CODE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

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
 * missing or duplicated (SPEC 10.5: at most one item per kind and scope
 * node).
 */
function requireRow(
  report: SessionStatusReport,
  kind: SessionStatusRow["kind"],
  scope: string,
  context: string,
): SessionStatusRow {
  const rows = report.items.filter(
    (row) => row.kind === kind && row.scope === scope,
  );
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.5: a session never contains two items with the same kind ` +
        `and scope node); found ${String(rows.length)} among ` +
        JSON.stringify(report.items.map((row) => `${row.kind} ${row.scope}`)),
    );
  }
  return rows[0];
}

/** The unique full item for a kind and scope node in an export/next list. */
function requireItem(
  items: readonly ReviewItem[],
  kind: ReviewItem["kind"],
  scope: string,
  context: string,
): ReviewItem {
  const matches = items.filter(
    (item) => item.kind === kind && item.scope.node === scope,
  );
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.5: at most one item per kind and scope node); found ` +
        `${String(matches.length)} among ` +
        JSON.stringify(items.map((item) => `${item.kind} ${item.scope.node}`)),
    );
  }
  return matches[0];
}

/** Read `status` and assert one item's reported status (SPEC 10.4). */
async function expectItemStatus(
  product: ProductBinding,
  workspace: TestWorkspace,
  session: string,
  itemId: string,
  expected: ItemStatus,
  context: string,
): Promise<void> {
  const report = await sessionStatus(product, workspace, session, context);
  const rows = report.items.filter((row) => row.id === itemId);
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one item with id ${JSON.stringify(itemId)} ` +
        `(SPEC 10.2: item ids are unique within the session); found ` +
        `${String(rows.length)} among ` +
        JSON.stringify(report.items.map((row) => row.id)),
    );
  }
  if (rows[0].status !== expected) {
    fail(
      `${context}: expected the item to be reported ${expected}, got ` +
        `${rows[0].status} (SPEC 10.4, 10.5)`,
    );
  }
}

/** Sorted node-identity set of a payload node list (membership compare). */
function identitySet(
  states: readonly { readonly node: string }[],
): readonly string[] {
  return states.map((state) => state.node).sort();
}

/** Sorted `kind scope` rendering of a session's items (membership compare). */
function kindScopeSet(report: SessionStatusReport): readonly string[] {
  return report.items.map((row) => `${row.kind} ${row.scope}`).sort();
}

/** In-order `kind scope` rendering of an item sequence (order compare). */
function kindScopeSequence(
  rows: readonly { readonly kind: string; readonly scope: string }[],
): readonly string[] {
  return rows.map((row) => `${row.kind} ${row.scope}`);
}

/** In-order `kind scope` rendering of export items (order compare). */
function exportKindScopeSequence(
  items: readonly ReviewItem[],
): readonly string[] {
  return items.map((item) => `${item.kind} ${item.scope.node}`);
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
    `${context}: blockedBy (compared as a sorted id set; SPEC 10.5, 10.7)`,
  );
}

/** The four hashes of each probed node, captured via `query node`. */
async function captureHashes(
  product: ProductBinding,
  workspace: TestWorkspace,
  nodes: readonly string[],
  context: string,
): Promise<ReadonlyMap<string, NodeHashes>> {
  const captured = new Map<string, NodeHashes>();
  for (const node of nodes) {
    captured.set(
      node,
      (await queryNode(product, workspace, node, context)).hashes,
    );
  }
  return captured;
}

// ---------------------------------------------------------------------------
// T10.5-1 — generation: SPEC 15's worked change, plus the skipping rule,
// subtree scope, the shared-ancestor union over a child's and a
// grandchild's branch, the two-levels-deep chain (a > a.b > a.b.c with only
// a.b.c changed: a's parent-consistency context is exactly {a.b} — the
// branch head — never a.b.c; a.b's is {a.b.c}; both origins {a.b.c}), and
// its both-edited twin (a.b and a.b.c each edited: a.b visited, a.b.c
// skipped, both items' origin exactly {a.b, a.b.c}). Every item's origin is
// asserted beside its scope (the kind-and-scope-node lookup over the exact
// kind/scope set) and its context (TEST-SPEC T10.5-1: 10.5's origin rules —
// a subtree-coherence item's origin every changed node in its scope, a
// parent-consistency item's every changed node in A's subtree, skipped
// nodes included).
// ---------------------------------------------------------------------------

// The SPEC 15 example workspace, verbatim.
const S15_SPEC_FILE = "specs/SPEC.mdx";
const S15_DERIVED_FILE = "specs/DERIVED.mdx";
const S15_CODE_FILE = "src/hello.ts";

function s15Spec(helloText: string): string {
  return [
    '<S id="print">',
    "Print behavior.",
    "",
    '<S id="print.hello" tags="critical">',
    helloText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

const S15_DERIVED_SOURCE = [
  'import SPEC from "./SPEC.xspec"',
  "",
  '<S id="derived">',
  "Derived behavior.",
  "",
  '<S id="derived.hello" d={SPEC.print.hello}>',
  "Derived hello behavior.",
  "</S>",
  "</S>",
  "",
].join("\n");

const S15_CODE_SOURCE = [
  'import DERIVED from "../specs/DERIVED.xspec"',
  "",
  "export function hello() {",
  "  DERIVED.derived.hello",
  '  console.log("Hello")',
  "}",
  "",
].join("\n");

const S15_ROOT = "specs/SPEC.mdx";
const S15_PRINT = "specs/SPEC.mdx#print";
const S15_HELLO = "specs/SPEC.mdx#print.hello";
const S15_DERIVED_HELLO = "specs/DERIVED.mdx#derived.hello";
const S15_LOCATION = "src/hello.ts#hello";

// Extended fixture (SPEC 10.5 rules 1–2; TEST-SPEC T10.5-1's P/Q and
// A/X/K/Y arms). The skipping arm: the top-level p and its child p.q (P and
// Q), each with its own text edited — p is visited and p.q, having the
// changed ancestor p, skipped, so p's single subtree-coherence item's origin
// is exactly {p, p.q}, the skipped node included, never {p} alone; p's
// parent is the root, so no parent-consistency item arises on its path. The
// union arm: the top-level a (A) whose child a.x (X) and grandchild a.k.y
// (Y, beneath a's child a.k, K) each have their own text edited, a and a.k
// unchanged — a receives a single parent-consistency item against the union
// of both changed branches, context exactly {a.x, a.k} (each branch entering
// as a's child on it) and origin exactly {a.x, a.k.y} (both branches'
// changed nodes, never one branch's alone and never a.k, the head of
// a.k.y's branch), while a.k's item has context and origin {a.k.y} and a.x's
// and a.k.y's subtree-coherence items have origins {a.x} and {a.k.y}.
const X1_FILE = "specs/X.mdx";
const X1_P = "specs/X.mdx#p";
const X1_PQ = "specs/X.mdx#p.q";
const X1_A = "specs/X.mdx#a";
const X1_AX = "specs/X.mdx#a.x";
const X1_AK = "specs/X.mdx#a.k";
const X1_AKY = "specs/X.mdx#a.k.y";

function x1Spec(
  pOwn: string,
  qText: string,
  xText: string,
  yText: string,
): string {
  return [
    '<S id="p">',
    pOwn,
    "",
    '<S id="p.q">',
    qText,
    "</S>",
    "</S>",
    "",
    '<S id="a">',
    "Aye own text.",
    "",
    '<S id="a.x">',
    xText,
    "</S>",
    "",
    '<S id="a.k">',
    "Kay own text.",
    "",
    '<S id="a.k.y">',
    yText,
    "</S>",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// Chain fixture (SPEC 10.5 rule 2, the two-levels-deep change): a > a.b >
// a.b.c (A → B → C) with only a.b.c changed. Each changed branch enters an
// ancestor's parent-consistency item as one context node — the ancestor's
// child on that branch — so a's context is exactly {a.b}, never the changed
// node a.b.c two levels beneath it, while a.b's context is {a.b.c}; the
// origin of both is exactly {a.b.c}, the changed node, never the branch head
// a.b. T10.4-1's deep-edit sensitivity presupposes this context node
// (TEST-SPEC T10.5-1). Its both-edited twin, on a workspace of its own, edits
// a.b's own text and a.b.c's instead: a.b is visited and a.b.c skipped, so
// a.b's subtree-coherence item and a's parent-consistency item (context
// exactly {a.b}) both have origin exactly {a.b, a.b.c}, the skipped node
// included — never {a.b}, the visited nodes alone, which a product drawing
// origins from visited nodes gives.
const Y_FILE = "specs/Y.mdx";
const Y_A = "specs/Y.mdx#a";
const Y_AB = "specs/Y.mdx#a.b";
const Y_ABC = "specs/Y.mdx#a.b.c";

function ySpec(bOwn: string, cText: string): string {
  return [
    '<S id="a">',
    "Aye own text.",
    "",
    '<S id="a.b">',
    bOwn,
    "",
    '<S id="a.b.c">',
    cText,
    "</S>",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// T10.5-1's extended-fixture edit and its chain fixture's two edits (a.b.c
// alone; a.b's own text and a.b.c in the both-edited twin) follow the worked
// change's `build` (the body's first product invocation), so they are
// staged-source records (helpers/staged-mdx.ts, S-9: judged before any
// product exists) — the same template calls moved to module level; the
// worked change's own edit precedes that `build` and stays plain, as does
// its initial file; the extended fixture's initial file and the one initial
// file of the chain fixture and its twin, staged after that `build`, are
// records too (below).
const T10_5_1_X1_EDITED = stagedMdx(
  "T10.5-1 specs/X.mdx with p's own text and the three leaves p.q, a.x, a.k.y at v1 (extended fixture)",
  x1Spec("Pee own v1.", "Cue text v1.", "Ex text v1.", "Why text v1."),
);
const T10_5_1_Y_EDITED = stagedMdx(
  "T10.5-1 specs/Y.mdx with a.b.c at v1 (chain fixture)",
  ySpec("Abe own v0.", "Cee text v1."),
);
const T10_5_1_Y_BC_EDITED = stagedMdx(
  "T10.5-1 specs/Y.mdx with a.b's own text and a.b.c at v1 (the chain fixture's both-edited twin)",
  ySpec("Abe own v1.", "Cee text v1."),
);
const T10_5_1_X1_INITIAL = stagedMdx(
  "T10.5-1 specs/X.mdx with p's own text and the three leaves p.q, a.x, a.k.y at v0 (the extended fixture's initial source)",
  x1Spec("Pee own v0.", "Cue text v0.", "Ex text v0.", "Why text v0."),
);
const T10_5_1_Y_INITIAL = stagedMdx(
  "T10.5-1 specs/Y.mdx with a.b's own text and a.b.c at v0 (the initial source of the chain fixture and its both-edited twin)",
  ySpec("Abe own v0.", "Cee text v0."),
);

const T10_5_1 = defineProductTest({
  id: "T10.5-1",
  title:
    "path-blocks generation: SPEC 15's worked change (a leaf text edit to print.hello) yields exactly the four listed items — print.hello's subtree-coherence item (context: its ancestor chain; origin: itself), print's parent-consistency item blocked by it (context/origin: print.hello), derived.hello's dependency-consistency item (context/origin: print.hello), and a code-impact item for src/hello.ts#hello (context: derived.hello, the impact-edge target that makes it impacted; origin: print.hello) — and, each item's origin asserted beside its scope and context, the extended fixture pins the skipping rule (a changed node with a changed ancestor generates no own item: the top-level p and its child p.q, each with its own text edited, yield p's subtree-coherence item and no item scoped at p.q, that item's origin exactly {p, p.q}, the skipped node included, never {p} alone, and no parent-consistency item, p's parent being the root; its scope covers the node plus all descendants, its scope text the scope root's subtree text) and the shared-ancestor union (with a's child a.x and grandchild a.k.y (beneath a's child a.k) each having its own text edited, a's single parent-consistency item has context exactly {a.x, a.k} and origin exactly {a.x, a.k.y} — both branches' changed nodes, never one branch's alone and never a.k, the head of a.k.y's branch — while a.k's item has context and origin {a.k.y}, and a.x's and a.k.y's subtree-coherence items have origins {a.x} and {a.k.y}) and the two-levels-deep chain (a > a.b > a.b.c with only a.b.c changed: a's parent-consistency item's context is exactly {a.b} — the branch head, a's child on the changed branch, each changed branch entering as one context node — never the changed node a.b.c, while a.b's item's context is exactly {a.b.c}, the identities asserted, and both items' origin exactly {a.b.c}, the changed node, never the branch head a.b) and its both-edited twin (a.b's and a.b.c's own text each edited: a.b visited and a.b.c skipped — a.b's subtree-coherence item has origin exactly {a.b, a.b.c} and a's parent-consistency item context exactly {a.b} and origin exactly {a.b, a.b.c}, the skipped node included, never {a.b}, the visited nodes alone) (SPEC 5.6, 9.2, 10.5, 15)",
  run: async (product) => {
    // --- SPEC 15's worked change ---------------------------------------------
    await withWorkspace(
      SPECS_CODE_CONFIG,
      {
        [S15_SPEC_FILE]: s15Spec("Print hello."),
        [S15_DERIVED_FILE]: S15_DERIVED_SOURCE,
        [S15_CODE_FILE]: S15_CODE_SOURCE,
      },
      async (workspace) => {
        const prefix = "T10.5-1 SPEC 15 worked change";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(S15_SPEC_FILE, s15Spec("Print hello, edited."));
        await buildOk(product, workspace, `${prefix} \`build\` after the edit`);
        await createBaseSession(product, workspace, base, "s", prefix);

        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `code-impact ${S15_LOCATION}`,
            `dependency-consistency ${S15_DERIVED_HELLO}`,
            `parent-consistency ${S15_PRINT}`,
            `subtree-coherence ${S15_HELLO}`,
          ].sort(),
          `${prefix}: SPEC 15 — "a default path-blocks session for this ` +
            `change contains exactly: a subtree-coherence item for ` +
            `print.hello, a parent-consistency item for print blocked by ` +
            `it, a dependency-consistency item for derived.hello, and a ` +
            `code-impact item for hello.ts#hello"`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);
        const sc = requireItem(
          exported.items,
          "subtree-coherence",
          S15_HELLO,
          prefix,
        );
        const pc = requireItem(
          exported.items,
          "parent-consistency",
          S15_PRINT,
          prefix,
        );
        const dc = requireItem(
          exported.items,
          "dependency-consistency",
          S15_DERIVED_HELLO,
          prefix,
        );
        const ci = requireItem(
          exported.items,
          "code-impact",
          S15_LOCATION,
          prefix,
        );

        // subtree-coherence: context is N's ancestor chain (print and the
        // file root); origin is the changed nodes in scope (SPEC 10.5 rule 1).
        assertSameJson(
          identitySet(sc.context),
          [S15_ROOT, S15_PRINT].sort(),
          `${prefix}: the subtree-coherence item's context is print.hello's ` +
            `ancestor chain (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(sc.origin),
          [S15_HELLO],
          `${prefix}: the subtree-coherence item's origin is the changed ` +
            `node in scope (SPEC 10.5)`,
        );
        assertBlockedBy(sc, [], `${prefix} subtree-coherence item`);

        // parent-consistency: context is the changed branch beneath print —
        // print's child on it, print.hello; origin the branch's changed
        // node; blocked by the child's subtree-coherence item (SPEC 10.5
        // rule 2; SPEC 15: "blocked by it").
        assertSameJson(
          identitySet(pc.context),
          [S15_HELLO],
          `${prefix}: the parent-consistency item's context is the changed ` +
            `branch beneath print — print's child on that branch (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(pc.origin),
          [S15_HELLO],
          `${prefix}: the parent-consistency item's origin is the changed ` +
            `branch's changed node (SPEC 10.5)`,
        );
        assertBlockedBy(pc, [sc.id], `${prefix} parent-consistency item`);

        // dependency-consistency: context is the changed both-sides target;
        // origin the originating nodes of the target's change (SPEC 10.5).
        assertSameJson(
          identitySet(dc.context),
          [S15_HELLO],
          `${prefix}: the dependency-consistency item's context is the ` +
            `changed dependency target (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(dc.origin),
          [S15_HELLO],
          `${prefix}: the dependency-consistency item's origin is the ` +
            `originating node of the target's change (SPEC 5.6, 10.5)`,
        );
        assertBlockedBy(dc, [], `${prefix} dependency-consistency item`);

        // code-impact: context is the impact-edge target that makes the
        // location impacted (derived.hello, whose effectiveHash changed);
        // origin the originating node of that target's change (SPEC 9.2,
        // 10.5).
        if (ci.scope.node !== S15_LOCATION || ci.scope.present !== true) {
          fail(
            `${prefix}: the code-impact item's scope is the impacted ` +
              `location under its identity (SPEC 10.5, 9.2); expected ` +
              `{node: ${JSON.stringify(S15_LOCATION)}, present: true}, got ` +
              JSON.stringify(ci.scope),
          );
        }
        assertSameJson(
          identitySet(ci.context),
          [S15_DERIVED_HELLO],
          `${prefix}: the code-impact item's context is the impact-edge ` +
            `target that makes the location impacted (SPEC 9.2, 10.5)`,
        );
        assertSameJson(
          identitySet(ci.origin),
          [S15_HELLO],
          `${prefix}: the code-impact item's origin is the originating node ` +
            `of the target's change (SPEC 5.6, 10.5)`,
        );
        assertBlockedBy(ci, [], `${prefix} code-impact item`);
      },
    );

    // --- extended fixture: skipping, subtree scope, shared-ancestor union ----
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [X1_FILE]: T10_5_1_X1_INITIAL,
      },
      async (workspace) => {
        const prefix = "T10.5-1 extended fixture";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(X1_FILE, T10_5_1_X1_EDITED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the edits`,
        );
        await createBaseSession(product, workspace, base, "s", prefix);

        // p and p.q are changed (each its own text edited; SPEC 5.6), p.q
        // skipped under p; a.x and a.k.y are changed, a.k and a unchanged
        // (descendant-changed alone), so a.x and a.k.y are visited.
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `parent-consistency ${X1_A}`,
            `parent-consistency ${X1_AK}`,
            `subtree-coherence ${X1_AKY}`,
            `subtree-coherence ${X1_AX}`,
            `subtree-coherence ${X1_P}`,
          ].sort(),
          `${prefix}: p.q is changed but has the changed ancestor p, so it ` +
            `generates no own item (skipping rule), and p's parent is the ` +
            `root, so no parent-consistency item arises on p's path; a.x and ` +
            `a.k.y — a's child and grandchild — each get a ` +
            `subtree-coherence item, a.k (a non-root ancestor on a.k.y's ` +
            `path) a parent-consistency item, and their shared unchanged ` +
            `ancestor a a single parent-consistency item (SPEC 10.5)`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);

        // --- the skipping arm: p visited, p.q skipped under it ---
        const scP = requireItem(
          exported.items,
          "subtree-coherence",
          X1_P,
          prefix,
        );
        // Scope: the node plus all descendants — the scope root is p and its
        // scope text is p's subtree text (SPEC 10.5, 10.7: scope text for
        // subtree-coherence is the scope root's subtree text).
        if (scP.scope.node !== X1_P || scP.scope.present !== true) {
          fail(
            `${prefix}: p's subtree-coherence scope root is p (SPEC 10.5: ` +
              `a subtree-coherence item's scope node is its subtree root); ` +
              `expected {node: ${JSON.stringify(X1_P)}, present: true}, got ` +
              JSON.stringify(scP.scope),
          );
        }
        const pReport = await queryNode(product, workspace, X1_P, prefix);
        if (pReport.subtreeText === pReport.ownText) {
          fail(
            `${prefix} staging premise: p's subtree text must differ from ` +
              `its own text (the descendant p.q contributes) so the scope ` +
              `assertion discriminates subtree scope from own-node scope ` +
              `(SPEC 1.6)`,
          );
        }
        if (scP.scope.text !== pReport.subtreeText) {
          fail(
            `${prefix}: p's subtree-coherence item covers the node plus all ` +
              `descendants — its scope text is p's subtree text (SPEC 10.5, ` +
              `10.7); \`query node\` reports ` +
              `${JSON.stringify(pReport.subtreeText)}, the item's scope ` +
              `carries ${JSON.stringify(scP.scope.text)}`,
          );
        }
        // Context: p's ancestor chain — the file root alone, p being
        // top-level (SPEC 10.5 rule 1).
        assertSameJson(
          identitySet(scP.context),
          [X1_FILE],
          `${prefix}: p's subtree-coherence item's context is p's ancestor ` +
            `chain — the file root alone, p being top-level (SPEC 10.5)`,
        );
        // Origin: every changed node in scope — the skipped descendant's
        // change is attributed inside the visited ancestor's item, never
        // dropped with its skipped item (SPEC 10.5 rule 1).
        assertSameJson(
          identitySet(scP.origin),
          [X1_P, X1_PQ].sort(),
          `${prefix}: p's subtree-coherence item's origin is exactly the ` +
            `changed nodes in its scope, {p, p.q} — the skipped p.q ` +
            `included, never {p} alone, the visited node (SPEC 10.5)`,
        );
        assertBlockedBy(scP, [], `${prefix} p's subtree-coherence item`);

        // --- the union arm: a's child a.x and grandchild a.k.y changed ---
        // requireItem asserts each item's uniqueness (SPEC 10.5: a single
        // item per ancestor, against the union of changed branches).
        const scAX = requireItem(
          exported.items,
          "subtree-coherence",
          X1_AX,
          prefix,
        );
        const scAKY = requireItem(
          exported.items,
          "subtree-coherence",
          X1_AKY,
          prefix,
        );
        const pcAK = requireItem(
          exported.items,
          "parent-consistency",
          X1_AK,
          prefix,
        );
        const pcA = requireItem(
          exported.items,
          "parent-consistency",
          X1_A,
          prefix,
        );

        // The two visited nodes' subtree-coherence items: each its ancestor
        // chain as context, its one changed node as origin (SPEC 10.5 rule
        // 1).
        assertSameJson(
          identitySet(scAX.context),
          [X1_FILE, X1_A].sort(),
          `${prefix}: a.x's subtree-coherence item's context is a.x's ` +
            `ancestor chain — a and the file root (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(scAX.origin),
          [X1_AX],
          `${prefix}: a.x's subtree-coherence item's origin is exactly ` +
            `{a.x}, the changed node in its scope (SPEC 10.5)`,
        );
        assertBlockedBy(scAX, [], `${prefix} a.x's subtree-coherence item`);
        assertSameJson(
          identitySet(scAKY.context),
          [X1_FILE, X1_A, X1_AK].sort(),
          `${prefix}: a.k.y's subtree-coherence item's context is a.k.y's ` +
            `ancestor chain — a.k, a, and the file root (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(scAKY.origin),
          [X1_AKY],
          `${prefix}: a.k.y's subtree-coherence item's origin is exactly ` +
            `{a.k.y}, the changed node in its scope (SPEC 10.5)`,
        );
        assertBlockedBy(scAKY, [], `${prefix} a.k.y's subtree-coherence item`);

        // a.k: its child on the one changed branch beneath it is the changed
        // node a.k.y itself (SPEC 10.5 rule 2).
        assertSameJson(
          identitySet(pcAK.context),
          [X1_AKY],
          `${prefix}: a.k's parent-consistency item's context is exactly ` +
            `{a.k.y} — a.k's child on the one changed branch beneath it, ` +
            `here the changed node itself (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(pcAK.origin),
          [X1_AKY],
          `${prefix}: a.k's parent-consistency item's origin is exactly ` +
            `{a.k.y}, the changed node in a.k's subtree — never a.x, which ` +
            `lies outside it (SPEC 10.5)`,
        );
        assertBlockedBy(
          pcAK,
          [scAKY.id],
          `${prefix} a.k's parent-consistency item — a.k.y, a.k's child on ` +
            `the changed branch, is visited, so its subtree-coherence item ` +
            `blocks`,
        );

        // a: one item against the union of both changed branches — each
        // entering its context as a's child on it (a.x, itself changed; a.k,
        // the head of a.k.y's branch), its origin both branches' changed
        // nodes (SPEC 10.5 rule 2).
        assertSameJson(
          identitySet(pcA.context),
          [X1_AX, X1_AK].sort(),
          `${prefix}: a's single parent-consistency item's context is ` +
            `exactly {a.x, a.k} — the union of the changed branches beneath ` +
            `a, each entering as one context node, a's child on that ` +
            `branch: a.x, itself changed, and a.k, the head of a.k.y's ` +
            `branch — never one branch's alone and never the changed node ` +
            `a.k.y two levels beneath a (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(pcA.origin),
          [X1_AX, X1_AKY].sort(),
          `${prefix}: a's parent-consistency item's origin is exactly ` +
            `{a.x, a.k.y} — the changed nodes in a's subtree, both ` +
            `branches' — never one branch's alone and never a.k, the head ` +
            `of a.k.y's branch (SPEC 10.5)`,
        );
        assertBlockedBy(
          pcA,
          [scAX.id, pcAK.id],
          `${prefix} a's parent-consistency item — one blocker per changed ` +
            `branch, the item scoped at a's child on it: a.x's ` +
            `subtree-coherence item (a.x visited) and a.k's ` +
            `parent-consistency item (a.k not visited)`,
        );
      },
    );

    // --- chain fixture: a change two levels beneath an ancestor -----------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [Y_FILE]: T10_5_1_Y_INITIAL },
      async (workspace) => {
        const prefix = "T10.5-1 chain fixture";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(Y_FILE, T10_5_1_Y_EDITED);
        await buildOk(product, workspace, `${prefix} \`build\` after the edit`);
        await createBaseSession(product, workspace, base, "s", prefix);

        // Only a.b.c is changed (SPEC 5.6: a leaf text edit changes the leaf
        // alone; its ancestors are descendant-changed), so it gets the one
        // subtree-coherence item and each non-root ancestor on its path —
        // a.b and a — one parent-consistency item; the file root gets none.
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `parent-consistency ${Y_A}`,
            `parent-consistency ${Y_AB}`,
            `subtree-coherence ${Y_ABC}`,
          ].sort(),
          `${prefix}: only a.b.c is changed, so it gets the one ` +
            `subtree-coherence item and each non-root ancestor on the path ` +
            `to the root (a.b, a) one parent-consistency item — the changed ` +
            `node and the file root get none (SPEC 5.6, 10.5)`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);
        const scABC = requireItem(
          exported.items,
          "subtree-coherence",
          Y_ABC,
          prefix,
        );
        const pcAB = requireItem(
          exported.items,
          "parent-consistency",
          Y_AB,
          prefix,
        );
        const pcA = requireItem(
          exported.items,
          "parent-consistency",
          Y_A,
          prefix,
        );

        // subtree-coherence: context is a.b.c's ancestor chain (a.b, a, and
        // the file root); origin the changed node (SPEC 10.5 rule 1).
        assertSameJson(
          identitySet(scABC.context),
          [Y_FILE, Y_A, Y_AB].sort(),
          `${prefix}: a.b.c's subtree-coherence item's context is its ` +
            `ancestor chain (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(scABC.origin),
          [Y_ABC],
          `${prefix}: a.b.c's subtree-coherence item's origin is the changed ` +
            `node in scope (SPEC 10.5)`,
        );

        // a.b: its child on the changed branch is the changed node itself.
        assertSameJson(
          identitySet(pcAB.context),
          [Y_ABC],
          `${prefix}: a.b's parent-consistency item's context is exactly ` +
            `{a.b.c} — a.b's child on the changed branch, here the changed ` +
            `node itself (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(pcAB.origin),
          [Y_ABC],
          `${prefix}: a.b's parent-consistency item's origin is exactly ` +
            `{a.b.c}, the changed node in a.b's subtree (SPEC 10.5)`,
        );

        // a: the changed branch enters as ONE context node — a's child on
        // that branch, the branch head a.b — never the changed node a.b.c
        // two levels beneath (SPEC 10.5 rule 2; a product listing the
        // changed nodes, or the whole branch, as context fails here).
        assertSameJson(
          identitySet(pcA.context),
          [Y_AB],
          `${prefix}: a's parent-consistency item's context is exactly ` +
            `{a.b} — the branch head, a's child on the changed branch — ` +
            `never the changed node a.b.c two levels beneath it (SPEC 10.5: ` +
            `each changed branch enters as one context node)`,
        );
        assertSameJson(
          identitySet(pcA.origin),
          [Y_ABC],
          `${prefix}: a's parent-consistency item's origin is exactly ` +
            `{a.b.c}, the changed node in a's subtree — never the branch ` +
            `head a.b, its context node (SPEC 10.5)`,
        );

        // The blocking chain over the same three items (SPEC 10.5 rule 2;
        // T10.5-2 pins the general chains): a.b's item is blocked by its
        // child's subtree-coherence item, a's by its child's
        // parent-consistency item.
        assertBlockedBy(scABC, [], `${prefix} a.b.c subtree-coherence item`);
        assertBlockedBy(
          pcAB,
          [scABC.id],
          `${prefix} a.b's parent-consistency item — the changed branch's ` +
            `changed node is a.b's child, so its subtree-coherence item blocks`,
        );
        assertBlockedBy(
          pcA,
          [pcAB.id],
          `${prefix} a's parent-consistency item — the change lies deeper ` +
            `than a's child a.b, so a.b's parent-consistency item blocks`,
        );
      },
    );

    // --- the chain fixture's both-edited twin: a.b visited, a.b.c skipped ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [Y_FILE]: T10_5_1_Y_INITIAL },
      async (workspace) => {
        const prefix = "T10.5-1 chain fixture's both-edited twin";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(Y_FILE, T10_5_1_Y_BC_EDITED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the edits`,
        );
        await createBaseSession(product, workspace, base, "s", prefix);

        // a.b and a.b.c are both changed (each its own text edited; SPEC
        // 5.6), so a.b is visited and a.b.c, having the changed ancestor
        // a.b, skipped: a.b gets the one subtree-coherence item and a, its
        // one non-root ancestor, one parent-consistency item; a.b.c and the
        // file root get none.
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [`parent-consistency ${Y_A}`, `subtree-coherence ${Y_AB}`].sort(),
          `${prefix}: a.b and a.b.c are both changed, so a.b is visited — ` +
            `its subtree-coherence item and a's parent-consistency item — ` +
            `and a.b.c, having the changed ancestor a.b, generates no own ` +
            `item (skipping rule); the file root gets none (SPEC 5.6, 10.5)`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);
        const scAB = requireItem(
          exported.items,
          "subtree-coherence",
          Y_AB,
          prefix,
        );
        const pcA = requireItem(
          exported.items,
          "parent-consistency",
          Y_A,
          prefix,
        );

        // a.b's subtree-coherence item: its ancestor chain as context, every
        // changed node in its scope as origin — the skipped a.b.c included
        // (SPEC 10.5 rule 1).
        assertSameJson(
          identitySet(scAB.context),
          [Y_FILE, Y_A].sort(),
          `${prefix}: a.b's subtree-coherence item's context is a.b's ` +
            `ancestor chain — a and the file root (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(scAB.origin),
          [Y_AB, Y_ABC].sort(),
          `${prefix}: a.b's subtree-coherence item's origin is exactly ` +
            `{a.b, a.b.c}, the changed nodes in its scope — the skipped ` +
            `a.b.c included — never {a.b}, the visited node alone, which a ` +
            `product drawing origins from visited nodes gives (SPEC 10.5)`,
        );

        // a's parent-consistency item: the one changed branch enters as a's
        // child on it, a.b; its origin is every changed node in a's subtree,
        // the skipped a.b.c included (SPEC 10.5 rule 2).
        assertSameJson(
          identitySet(pcA.context),
          [Y_AB],
          `${prefix}: a's parent-consistency item's context is exactly ` +
            `{a.b} — a's child on the one changed branch (SPEC 10.5: each ` +
            `changed branch enters as one context node)`,
        );
        assertSameJson(
          identitySet(pcA.origin),
          [Y_AB, Y_ABC].sort(),
          `${prefix}: a's parent-consistency item's origin is exactly ` +
            `{a.b, a.b.c}, the changed nodes in a's subtree — the skipped ` +
            `a.b.c included — never {a.b}, the visited nodes alone, which a ` +
            `product drawing origins from visited nodes gives (SPEC 10.5)`,
        );

        // Blocking (SPEC 10.5 rule 2): a's child on the changed branch, a.b,
        // is itself visited, so its subtree-coherence item blocks a's item.
        assertBlockedBy(scAB, [], `${prefix} a.b's subtree-coherence item`);
        assertBlockedBy(
          pcA,
          [scAB.id],
          `${prefix} a's parent-consistency item — a.b, a's child on the ` +
            `changed branch, is visited, so its subtree-coherence item blocks`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.5-2 — blocking chains
// ---------------------------------------------------------------------------

// a > a.b > a.b.c (deep change) and a > a.k (child-is-changed-node branch);
// m's tag edit yields a metadata-consistency item, dep's dependency on a.b.c
// a dependency-consistency item, and src/ci.ts (referencing a.k) a
// code-impact item — all three with empty blockedBy.
const K_FILE = "specs/K.mdx";
const K_A = "specs/K.mdx#a";
const K_AB = "specs/K.mdx#a.b";
const K_ABC = "specs/K.mdx#a.b.c";
const K_AK = "specs/K.mdx#a.k";
const K_M = "specs/K.mdx#m";
const K_DEP = "specs/K.mdx#dep";
const K_CODE = "src/ci.ts";

function kSpec(abcText: string, akText: string, mTags: string): string {
  return [
    '<S id="a">',
    "Aye own text.",
    "",
    '<S id="a.b">',
    "Abe own text.",
    "",
    '<S id="a.b.c">',
    abcText,
    "</S>",
    "</S>",
    "",
    '<S id="a.k">',
    akText,
    "</S>",
    "</S>",
    "",
    `<S id="m" tags="${mTags}">`,
    "Em text.",
    "</S>",
    "",
    '<S id="dep" d={"a.b.c"}>',
    "Dep text.",
    "</S>",
    "",
  ].join("\n");
}

const K_CODE_SOURCE = [
  'import K from "../specs/K.xspec";',
  "",
  "K.a.k;",
  "",
].join("\n");

const T10_5_2 = defineProductTest({
  id: "T10.5-2",
  title:
    "blocking chains: a's parent-consistency item is blocked by, per changed branch, the child's subtree-coherence item where the child is the changed node (a.k) or the child's parent-consistency item for a deeper change (a.b, whose own item is blocked by a.b.c's subtree-coherence item — the chain extends to the last non-root ancestor); only those two kinds block parent-consistency items (the fixture's metadata-consistency, dependency-consistency, and code-impact items appear in no blockedBy), and metadata-consistency, dependency-consistency, and code-impact items have empty blockedBy; blocked flags in `status` reflect exactly the parent-consistency items (SPEC 10.3, 10.5)",
  run: async (product) => {
    await withWorkspace(
      SPECS_CODE_CONFIG,
      {
        [K_FILE]: kSpec("Abc text v0.", "Ack text v0.", "m0"),
        [K_CODE]: K_CODE_SOURCE,
      },
      async (workspace) => {
        const prefix = "T10.5-2";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(
          K_FILE,
          kSpec("Abc text v1.", "Ack text v1.", "m1"),
        );
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the edits`,
        );
        await createBaseSession(product, workspace, base, "s", prefix);

        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `code-impact ${K_CODE}`,
            `dependency-consistency ${K_DEP}`,
            `metadata-consistency ${K_M}`,
            `parent-consistency ${K_A}`,
            `parent-consistency ${K_AB}`,
            `subtree-coherence ${K_ABC}`,
            `subtree-coherence ${K_AK}`,
          ].sort(),
          `${prefix}: the two changed branches, the metadata-changed node, ` +
            `the depender on a changed target, and the impacted location ` +
            `yield exactly these items (SPEC 10.5)`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);
        const scABC = requireItem(
          exported.items,
          "subtree-coherence",
          K_ABC,
          prefix,
        );
        const scAK = requireItem(
          exported.items,
          "subtree-coherence",
          K_AK,
          prefix,
        );
        const pcAB = requireItem(
          exported.items,
          "parent-consistency",
          K_AB,
          prefix,
        );
        const pcA = requireItem(
          exported.items,
          "parent-consistency",
          K_A,
          prefix,
        );
        const mc = requireItem(
          exported.items,
          "metadata-consistency",
          K_M,
          prefix,
        );
        const dc = requireItem(
          exported.items,
          "dependency-consistency",
          K_DEP,
          prefix,
        );
        const ci = requireItem(exported.items, "code-impact", K_CODE, prefix);

        // The full blockedBy map (SPEC 10.5): subtree-coherence items carry
        // no blockers under path-blocks; each parent-consistency item is
        // blocked per changed branch by its child's item — the child's
        // subtree-coherence item when the child is the changed node, its
        // parent-consistency item for a deeper change — and by nothing else.
        assertBlockedBy(scABC, [], `${prefix} a.b.c subtree-coherence item`);
        assertBlockedBy(scAK, [], `${prefix} a.k subtree-coherence item`);
        assertBlockedBy(
          pcAB,
          [scABC.id],
          `${prefix} a.b parent-consistency item — the branch's changed ` +
            `node is a.b's child a.b.c, so its subtree-coherence item blocks`,
        );
        assertBlockedBy(
          pcA,
          [pcAB.id, scAK.id],
          `${prefix} a parent-consistency item — branch b carries the ` +
            `deeper change (a.b's parent-consistency item blocks), branch k ` +
            `the changed child itself (a.k's subtree-coherence item blocks); ` +
            `only those two kinds block parent-consistency items`,
        );
        assertBlockedBy(mc, [], `${prefix} metadata-consistency item`);
        assertBlockedBy(dc, [], `${prefix} dependency-consistency item`);
        assertBlockedBy(ci, [], `${prefix} code-impact item`);

        // Blocked flags follow blockedBy alone (SPEC 10.3, 10.5): with every
        // item unresolved, exactly the parent-consistency items are blocked.
        for (const row of status.items) {
          const expectBlocked = row.kind === "parent-consistency";
          if (row.blocked !== expectBlocked) {
            fail(
              `${prefix}: with all items unresolved, ${row.kind} ${row.scope} ` +
                `must report blocked=${String(expectBlocked)} (SPEC 10.3: an ` +
                `item is blocked while any blockedBy item is not resolved; ` +
                `SPEC 10.5: only parent-consistency items carry blockers); ` +
                `got blocked=${String(row.blocked)}`,
            );
          }
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.5-3 — metadata, dependency, and code items: 10.5's note, current-graph
// edges, origin counting, and one code-impact item per location
// ---------------------------------------------------------------------------

// Top-level sections so no parent-consistency noise arises; h holds the
// added/deleted children (its own item absorbs them via the skipping rule,
// keeping the root unchanged). Both halves of SPEC 10.5's note are staged
// against the added target h.newt: dep2's only affected target enters
// through a new `d` edge (dep2 becomes `metadata-changed`), dep3's through a
// new `{text(...)}` embedding (dep3 becomes `changed`, SPEC 5.5/5.6 — the
// string form resolves within the same file, TEST-SPEC T2.3-2) — neither
// gets a `dependency-consistency` item, each change being reviewed at its
// source. dep3 carries no `d` attribute and no other embedding, nothing
// references or embeds dep3, and the code fixture never mentions it, so the
// other items' expected values stay untouched.
const N_FILE = "specs/N.mdx";
const N_X = "specs/N.mdx#x";
const N_Y = "specs/N.mdx#y";
const N_M = "specs/N.mdx#m";
const N_M2 = "specs/N.mdx#m2";
const N_T = "specs/N.mdx#t";
const N_DEP1 = "specs/N.mdx#dep1";
const N_DEP2 = "specs/N.mdx#dep2";
const N_DEP3 = "specs/N.mdx#dep3";
const N_H = "specs/N.mdx#h";
const N_H_GONE = "specs/N.mdx#h.gone";
const N_H_NEWT = "specs/N.mdx#h.newt";
const N_H_BORN = "specs/N.mdx#h.born";
const N_CODE = "src/ci3.ts";

const N_BASELINE = [
  '<S id="x">',
  "Ex text.",
  "</S>",
  "",
  '<S id="y">',
  "Wye text.",
  "</S>",
  "",
  '<S id="m" d={"x"}>',
  "Em text.",
  "</S>",
  "",
  '<S id="m2" tags="alpha">',
  "Em two text.",
  "</S>",
  "",
  '<S id="t">',
  "Tee text v0.",
  "</S>",
  "",
  '<S id="dep1" d={"t"}>',
  "Dep one text.",
  "</S>",
  "",
  '<S id="dep2">',
  "Dep two text.",
  "</S>",
  "",
  '<S id="dep3">',
  "Dep three text.",
  "</S>",
  "",
  '<S id="h">',
  "Aitch own text.",
  "",
  '<S id="h.gone">',
  "Gone text.",
  "</S>",
  "",
  '<S id="h.keep">',
  "Keep text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const N_CURRENT = [
  '<S id="x">',
  "Ex text.",
  "</S>",
  "",
  '<S id="y">',
  "Wye text.",
  "</S>",
  "",
  '<S id="m" d={"y"}>',
  "Em text.",
  "</S>",
  "",
  '<S id="m2" tags="alpha beta" coverage="none">',
  "Em two text.",
  "</S>",
  "",
  '<S id="t">',
  "Tee text v1.",
  "</S>",
  "",
  '<S id="dep1" d={"t"}>',
  "Dep one text.",
  "</S>",
  "",
  '<S id="dep2" d={"h.newt"}>',
  "Dep two text.",
  "</S>",
  "",
  '<S id="dep3">',
  'Dep three text. {text("h.newt")}',
  "</S>",
  "",
  '<S id="h">',
  "Aitch own text.",
  "",
  '<S id="h.newt">',
  "Newt text.",
  "</S>",
  "",
  '<S id="h.born">',
  "Born text.",
  "</S>",
  "",
  '<S id="h.keep">',
  "Keep text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const N_CODE_BASELINE = [
  'import N from "../specs/N.xspec";',
  "",
  "N.h.gone;",
  "N.h.keep;",
  "",
].join("\n");

const N_CODE_CURRENT = [
  'import N from "../specs/N.xspec";',
  "",
  "N.h.born;",
  "N.h.keep;",
  "",
].join("\n");

// T10.5-3's current-graph-edges arm (SPEC 10.5: one dependency-consistency
// item per node having, in the current graph, a dependency edge to a target
// present on both sides whose effectiveHash changed). specs/G.mdx holds the
// top-level x, t, and u: at the baseline x depends on t and t on u; then x's
// `d` reference to t — its only reference to t — is removed, while u's text
// edit changes t's effectiveHash. x is `metadata-changed` (its `d` targets
// changed, SPEC 5.6), so it gets its metadata-consistency item, context the
// removed target {t}; and, bearing no dependency edge to t in the current
// graph, it gets no dependency-consistency item — a product reading edges
// from either graph gives x one. t, whose `d` edge to u stands in the
// current graph, gets its dependency-consistency item (context and origin
// {u}), and u, `changed`, its subtree-coherence item. The arm's workspace
// follows the body's first `build`, so its initial source and its edit are
// staged-source records (module header).
const G_FILE = "specs/G.mdx";
const G_X = "specs/G.mdx#x";
const G_T = "specs/G.mdx#t";
const G_U = "specs/G.mdx#u";

function gSpec(xProps: string, uText: string): string {
  return [
    `<S id="x"${xProps}>`,
    "Ex text.",
    "</S>",
    "",
    '<S id="t" d={"u"}>',
    "Tee text.",
    "</S>",
    "",
    '<S id="u">',
    uText,
    "</S>",
    "",
  ].join("\n");
}

const T10_5_3_G_INITIAL = stagedMdx(
  "T10.5-3 specs/G.mdx at the baseline — x depending on t, t on u (the current-graph-edges arm's initial source)",
  gSpec(' d={"t"}', "You text v0."),
);
const T10_5_3_G_EDITED = stagedMdx(
  "T10.5-3 specs/G.mdx with x's d reference to t removed and u's text at v1 (the current-graph-edges arm)",
  gSpec("", "You text v1."),
);

// T10.5-3's origin-counting arm (SPEC 10.5: a dependency-consistency item's
// origin is the originating nodes of its targets' categories, a target's
// `metadata-changed` counting only when its `d` targets changed; a
// code-impact item's origin is counted the same way). specs/O.mdx holds the
// top-level x, t, u, and w: x depends on t and t on u, and w is never
// edited. Every staging edits u's text — u `changed`, t `upstream-changed`
// attributed to u, t's effectiveHash and x's changed (SPEC 5.5, 5.6) — and
// one piece of t's metadata: its tags (the tags staging) or its coverage
// attribute (the coverage staging), neither of which changes an
// effectiveHash (5.5, 5.6), so t's tags- or coverage-only
// `metadata-changed` does not count and x's dependency-consistency item's
// origin is exactly {u}; or, in the twin, its `d` set, which gains a
// reference to the unedited w, so t's `metadata-changed` counts and that
// origin is exactly {t, u}. src/o.ts holds one top-level marker targeting
// t, a whole-file code location (SPEC 4.6), transitively impacted in each
// staging — t's subtreeHash unchanged (its tags, coverage attribute, and
// `d` targets are no part of its own content, 5.5) while its effectiveHash
// changed (9.2) — its code-impact item's context {t} and origin {u} under
// the first two stagings and {t, u} under the twin. Each staging runs on a
// workspace of its own built from the same initial records; every one of
// them follows the body's first `build`, so its sources, configuration
// (`T10_5_3_CODE_CONFIG`), and edit are staged-source records (module
// header).
const OC_FILE = "specs/O.mdx";
const OC_X = "specs/O.mdx#x";
const OC_T = "specs/O.mdx#t";
const OC_U = "specs/O.mdx#u";
const OC_W = "specs/O.mdx#w";
const OC_CODE = "src/o.ts";

function ocSpec(tProps: string, uText: string): string {
  return [
    '<S id="x" d={"t"}>',
    "Ex text.",
    "</S>",
    "",
    `<S id="t" ${tProps}>`,
    "Tee text.",
    "</S>",
    "",
    '<S id="u">',
    uText,
    "</S>",
    "",
    '<S id="w">',
    "Dub text.",
    "</S>",
    "",
  ].join("\n");
}

const T10_5_3_OC_INITIAL = stagedMdx(
  "T10.5-3 specs/O.mdx at the baseline — x depending on t, t on u, w unreferenced (the origin-counting arm's initial source)",
  ocSpec('d={"u"}', "You text v0."),
);

const T10_5_3_OC_CODE = stagedTs(
  "T10.5-3 src/o.ts (a whole-file code location whose marker targets t, the origin-counting arm)",
  ['import O from "../specs/O.xspec";', "", "O.t;", ""].join("\n"),
);

/** One origin-counting staging (TEST-SPEC T10.5-3; SPEC 5.5, 5.6, 10.5). */
interface OriginCountingStaging {
  /** The staging's name in diagnostics. */
  readonly label: string;
  /** specs/O.mdx after the staging's edits (u's text and t's metadata). */
  readonly edited: StagedMdx;
  /**
   * t's metadata-consistency context: the `d` targets the staging added to
   * or removed from t (SPEC 10.5).
   */
  readonly tMetadataContext: readonly string[];
  /** x's dependency-consistency origin and the code-impact origin. */
  readonly origin: readonly string[];
  /** Why that origin is expected — the counting rule at work. */
  readonly originWhy: string;
}

const OC_STAGINGS: readonly OriginCountingStaging[] = [
  {
    label: "tags staging",
    edited: stagedMdx(
      "T10.5-3 specs/O.mdx with t's tags edited and u's text at v1 (the origin-counting arm's tags staging)",
      ocSpec('d={"u"} tags="edited"', "You text v1."),
    ),
    tMetadataContext: [],
    origin: [OC_U],
    originWhy:
      "exactly {u} — t's tags-only metadata-changed does not count, its " +
      "d targets unchanged (a tags edit changes no effectiveHash, SPEC 5.5, " +
      "5.6), so only u, the originating node of t's upstream-changed, does " +
      "(SPEC 10.5: a target's metadata-changed counting only when its d " +
      "targets changed); a product counting every metadata-changed target " +
      "gives {t, u}",
  },
  {
    label: "coverage staging",
    edited: stagedMdx(
      "T10.5-3 specs/O.mdx with t's coverage attribute edited and u's text at v1 (the origin-counting arm's coverage staging)",
      ocSpec('d={"u"} coverage="none"', "You text v1."),
    ),
    tMetadataContext: [],
    origin: [OC_U],
    originWhy:
      "exactly {u} — t's coverage-only metadata-changed does not count, its " +
      "d targets unchanged (a coverage edit changes no effectiveHash, SPEC " +
      "5.5, 5.6), so only u, the originating node of t's upstream-changed, " +
      "does (SPEC 10.5: a target's metadata-changed counting only when its " +
      "d targets changed); a product counting every metadata-changed " +
      "target gives {t, u}",
  },
  {
    label: "d-set twin",
    edited: stagedMdx(
      "T10.5-3 specs/O.mdx with t's d set gaining w and u's text at v1 (the origin-counting arm's d-set twin)",
      ocSpec('d={["u", "w"]}', "You text v1."),
    ),
    tMetadataContext: [OC_W],
    origin: [OC_T, OC_U],
    originWhy:
      "exactly {t, u} — t's d targets changed (it gained w), so its " +
      "metadata-changed counts, beside u, the originating node of t's " +
      "upstream-changed (SPEC 5.6, 10.5: a target's metadata-changed " +
      "counting only when its d targets changed); a product never " +
      "counting a target's metadata-changed gives {u}",
  },
];

// T10.5-3's one-item-per-location arm (SPEC 10.5: one code-impact item per
// impacted code location; a kind and scope node produced more than once in
// one derivation yields a single item): T9.2-4's staging as its TEST-SPEC
// entry stages it — section-9.ts's T9.2-4 fixture, the same paths, sections,
// texts, and edits — one whole-file code location, src/both.ts, with two
// impact edges: one to dt, whose subtreeHash changes through its edited
// child dt.kid (directly impacted, 9.2), one to tt, whose effectiveHash
// alone changes through its edited upstream up (transitively impacted). In
// a baseline (path-blocks) session the location, impacted in both code
// categories (9.2, 9.3), gets exactly one code-impact item, its context
// exactly the two targets {dt, tt} and its origin exactly their originating
// nodes {dt.kid, up} (5.6: dt's descendant-changed attributed to dt.kid,
// tt's upstream-changed to up) — a product deriving one item per code
// category gives it two. The arm's workspace follows the body's first
// `build`, so its sources, configuration, and edits are staged-source
// records (module header).
const L_DIRECT = "specs/Direct.mdx";
const L_DT = "specs/Direct.mdx#dt";
const L_DT_KID = "specs/Direct.mdx#dt.kid";
const L_TRANS = "specs/Trans.mdx";
const L_TT = "specs/Trans.mdx#tt";
const L_UP = "specs/Up.mdx";
const L_UP_NODE = "specs/Up.mdx#up";
const L_BOTH_TS = "src/both.ts";

function lDirectSource(kidText: string): string {
  return [
    '<S id="dt">',
    "Direct target text.",
    "",
    '<S id="dt.kid">',
    kidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

function lUpSource(text: string): string {
  return ['<S id="up">', text, "</S>", ""].join("\n");
}

const T10_5_3_L_DIRECT_INITIAL = stagedMdx(
  "T10.5-3 specs/Direct.mdx with dt.kid at v1 (T9.2-4's staging at the baseline, the one-item-per-location arm)",
  lDirectSource("Direct kid text v1."),
);
const T10_5_3_L_TRANS = stagedMdx(
  "T10.5-3 specs/Trans.mdx — tt depending on Up.up (T9.2-4's staging, the one-item-per-location arm)",
  [
    'import Up from "./Up.xspec"',
    "",
    '<S id="tt" d={Up.up}>',
    "Transitive target text.",
    "</S>",
    "",
  ].join("\n"),
);
const T10_5_3_L_UP_INITIAL = stagedMdx(
  "T10.5-3 specs/Up.mdx with up at v1 (T9.2-4's staging at the baseline, the one-item-per-location arm)",
  lUpSource("Upstream text v1."),
);
const T10_5_3_L_DIRECT_EDITED = stagedMdx(
  "T10.5-3 specs/Direct.mdx with dt.kid at v2 (T9.2-4's edit, the one-item-per-location arm)",
  lDirectSource("Direct kid text v2."),
);
const T10_5_3_L_UP_EDITED = stagedMdx(
  "T10.5-3 specs/Up.mdx with up at v2 (T9.2-4's edit, the one-item-per-location arm)",
  lUpSource("Upstream text v2."),
);
const T10_5_3_L_BOTH_TS = stagedTs(
  "T10.5-3 src/both.ts (T9.2-4's whole-file code location with markers to dt and tt, the one-item-per-location arm)",
  [
    'import DIRECT from "../specs/Direct.xspec";',
    'import TRANS from "../specs/Trans.xspec";',
    "",
    "DIRECT.dt;",
    "TRANS.tt;",
    "",
  ].join("\n"),
);

// The configuration of T10.5-3's origin-counting and one-item-per-location
// workspaces, created after the body's first `build`: SPECS_CODE_CONFIG's
// bytes as a TypeScript staged-source record (module header).
const T10_5_3_CODE_CONFIG = stagedTs(
  "T10.5-3 xspec.config.ts — one spec group and the code group app (the origin-counting and one-item-per-location workspaces)",
  SPECS_CODE_CONFIG,
);

/**
 * `impact --base <baseline> --json`'s impacted-code locations by category
 * (SPEC 9.2, 9.3), each group's locations sorted — a staging premise of
 * T10.5-3's code arms (which code categories the location is in).
 */
async function impactedLocations(
  product: ProductBinding,
  workspace: TestWorkspace,
  base: string,
  label: string,
): Promise<{
  readonly direct: readonly string[];
  readonly transitive: readonly string[];
}> {
  const report = decodeImpactReport(
    await runJson(
      product,
      workspace,
      ["impact", "--base", base, "--json"],
      label,
    ),
    label,
  );
  return {
    direct: report.code.direct.map((entry) => entry.location).sort(),
    transitive: report.code.transitive.map((entry) => entry.location).sort(),
  };
}

const T10_5_3 = defineProductTest({
  id: "T10.5-3",
  title:
    "metadata, dependency, and code items: one metadata-consistency item per metadata-changed node — m's d retargeting (context: the added and removed d targets), m2's coverage and tags edits (empty context; its payload's metadata pair asserted by T10.7-13, its reason informational, SPEC 10.2, and never asserted), and dep2's added d edge — one dependency-consistency item per node having, in the current graph, a dependency edge to a both-sides target whose effectiveHash changed (dep1 against t; context: the changed target; origin: its originating node), with both halves of 10.5's note staged (a new d edge makes the source metadata-changed, a new embedding makes it changed): dep2, whose only affected target h.newt was added since the baseline, gets no dependency-consistency item — the change is reviewed at its source as dep2's own metadata-consistency item (context: the added target) — and dep3, whose only affected target entered through a new {text(...)} embedding, likewise gets no dependency-consistency item — the new embedded reference changes dep3's own content, it is changed (not metadata-changed), and the change is reviewed via dep3's own subtree-coherence item; one code-impact item per impacted location with context the impact-edge targets that make it impacted, deleted (h.gone) and added (h.born) targets included, unchanged targets excluded (origin: those targets' originating nodes); current-graph edges: x, whose only d reference to t stands at the baseline alone — removed since, while an edit to t's upstream u changed t's effectiveHash — gets its metadata-consistency item (context {t}) and no dependency-consistency item, which a product reading edges from either graph gives it; origin counting: with x depending on t and t on u, u's text edited and t's tags edited (and, in a second staging, t's coverage attribute instead; neither changes an effectiveHash), x's dependency-consistency item has origin exactly {u}, t's tags- or coverage-only metadata-changed not counting, and a twin in which t's d set gains a reference to the unedited w gives exactly {t, u}, while a code location whose marker targets t — transitively impacted in each staging, t's subtreeHash unchanged — has origin exactly {u} under the first stagings and {t, u} under the twin; and one item per location: T9.2-4's location, impacted in both code categories, staged in a baseline (path-blocks) session, gets exactly one code-impact item, its context exactly the two targets {dt, tt} and its origin exactly their originating nodes {dt.kid, up} — never one item per code category (SPEC 5.5, 5.6, 9.2, 10.5)",
  run: async (product) => {
    await withWorkspace(
      SPECS_CODE_CONFIG,
      { [N_FILE]: N_BASELINE, [N_CODE]: N_CODE_BASELINE },
      async (workspace) => {
        const prefix = "T10.5-3";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(N_FILE, N_CURRENT);
        await workspace.file(N_CODE, N_CODE_CURRENT);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the edits`,
        );

        // The embedding half's category (SPEC 10.5's note): the new
        // `{text(...)}` embedding changes dep3's own content, so dep3 is
        // `changed` — never `metadata-changed`, embedded references
        // surfacing through ownHash, not metadataHash (SPEC 5.5, 5.6).
        // Asserted via the impact surface, as in T1.6-4.
        const impactLabel = `${prefix} \`impact --base <baseline> --json\``;
        const impact = decodeImpactReport(
          await runJson(
            product,
            workspace,
            ["impact", "--base", base, "--json"],
            impactLabel,
          ),
          impactLabel,
        );
        const dep3Entry = impact.requirements.find((entry) =>
          entry.nodes.includes(N_DEP3),
        );
        if (dep3Entry === undefined) {
          fail(
            `${impactLabel}: expected an entry for ${N_DEP3} — its new ` +
              `{text(...)} embedding changed its own content (SPEC 5.5, ` +
              `5.6); got entries for ` +
              JSON.stringify(impact.requirements.map((entry) => entry.nodes)),
          );
        }
        assertSameJson(
          dep3Entry.nodes,
          [N_DEP3],
          `${impactLabel}: dep3's entry covers exactly dep3 (its category ` +
            `is \`changed\`, so no ancestor chain collapses onto it, ` +
            `SPEC 9.3)`,
        );
        assertSameJson(
          dep3Entry.deleted,
          false,
          `${impactLabel}: dep3 is present on both sides of the baseline`,
        );
        assertSameJson(
          dep3Entry.categories.map((category) => category.category),
          ["changed"],
          `${impactLabel}: a new {text(...)} embedding changes the ` +
            `embedder's own content, so dep3's only category is \`changed\` ` +
            `— never \`metadata-changed\`: embedded references surface ` +
            `through ownHash, not metadataHash (SPEC 5.5, 5.6; SPEC 10.5's ` +
            `note: "a new embedding makes it \`changed\`")`,
        );

        await createBaseSession(product, workspace, base, "s", prefix);

        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `code-impact ${N_CODE}`,
            `dependency-consistency ${N_DEP1}`,
            `metadata-consistency ${N_DEP2}`,
            `metadata-consistency ${N_M}`,
            `metadata-consistency ${N_M2}`,
            `subtree-coherence ${N_DEP3}`,
            `subtree-coherence ${N_H}`,
            `subtree-coherence ${N_T}`,
          ].sort(),
          `${prefix}: one metadata-consistency item per metadata-changed ` +
            `node (m, m2, dep2), one dependency-consistency item for dep1 ` +
            `alone — dep2's and dep3's only affected target was added ` +
            `since the baseline, so each change is reviewed at its source ` +
            `(SPEC 10.5's note): dep2's new d edge as dep2's own ` +
            `metadata-consistency item, dep3's new {text(...)} embedding ` +
            `via dep3's own subtree-coherence item (dep3 is changed, so it ` +
            `gets no metadata-consistency item either) — one code-impact ` +
            `item for the impacted location, and the subtree-coherence ` +
            `items of the other changed nodes t and h (h's child additions ` +
            `and deletion originate at h; the skipped children generate no ` +
            `own items) (SPEC 5.5, 5.6, 10.5)`,
        );
        const dcRows = status.items.filter(
          (row) => row.kind === "dependency-consistency",
        );
        if (dcRows.length !== 1 || dcRows[0].scope !== N_DEP1) {
          fail(
            `${prefix}: exactly one dependency-consistency item exists, ` +
              `scoped at dep1 — an edge to a target added since the ` +
              `baseline yields no such item, for dep2's new d edge and ` +
              `dep3's new {text(...)} embedding alike (SPEC 10.5's note, ` +
              `5.6); got ` +
              JSON.stringify(dcRows.map((row) => row.scope)),
          );
        }

        const exported = await exportSession(product, workspace, "s", prefix);

        // m: d retargeted x -> y; context is the added and removed targets.
        const mcM = requireItem(
          exported.items,
          "metadata-consistency",
          N_M,
          prefix,
        );
        assertSameJson(
          identitySet(mcM.context),
          [N_X, N_Y].sort(),
          `${prefix}: m's metadata-consistency context is the added and ` +
            `removed d targets (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(mcM.origin),
          [N_M],
          `${prefix}: a metadata-consistency item's scope and origin are ` +
            `the metadata-changed node itself (SPEC 10.5)`,
        );

        // m2: coverage and tags edits — no d change, so no context targets
        // (SPEC 10.5). Its payload's metadata pair, which shows which
        // metadata changed, is T10.7-13's to assert; its reason is
        // informational, its composition unpinned (SPEC 10.2), and is never
        // asserted.
        const mcM2 = requireItem(
          exported.items,
          "metadata-consistency",
          N_M2,
          prefix,
        );
        assertSameJson(
          identitySet(mcM2.context),
          [],
          `${prefix}: m2's metadata-consistency context is empty — its ` +
            `metadata change added or removed no d targets (SPEC 10.5)`,
        );

        // dep2: the new d edge to the added target surfaces as dep2's own
        // metadata-consistency item, with the added target as context.
        const mcDep2 = requireItem(
          exported.items,
          "metadata-consistency",
          N_DEP2,
          prefix,
        );
        assertSameJson(
          identitySet(mcDep2.context),
          [N_H_NEWT],
          `${prefix}: dep2's new d edge surfaces as its own ` +
            `metadata-consistency item, the added target in context ` +
            `(SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(mcDep2.origin),
          [N_DEP2],
          `${prefix}: dep2's metadata-consistency origin is dep2 itself ` +
            `(SPEC 10.5)`,
        );

        // dep1: dependency edge to t, present on both sides with a changed
        // effectiveHash — context the changed target, origin its originating
        // node.
        const dc = requireItem(
          exported.items,
          "dependency-consistency",
          N_DEP1,
          prefix,
        );
        assertSameJson(
          identitySet(dc.context),
          [N_T],
          `${prefix}: dep1's dependency-consistency context is the changed ` +
            `both-sides target (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(dc.origin),
          [N_T],
          `${prefix}: dep1's dependency-consistency origin is the ` +
            `originating node of the target's change (SPEC 5.6, 10.5)`,
        );

        // code-impact: context is the impact-edge targets that make the
        // location impacted — the deleted h.gone (a baseline-graph edge) and
        // the added h.born (a current-graph edge) both count as changed, the
        // unchanged h.keep does not (SPEC 9.2, 10.5).
        const ci = requireItem(exported.items, "code-impact", N_CODE, prefix);
        assertSameJson(
          identitySet(ci.context),
          [N_H_BORN, N_H_GONE].sort(),
          `${prefix}: the code-impact context is the impact-edge targets ` +
            `that make the location impacted, added and deleted included, ` +
            `the unchanged target excluded (SPEC 9.2, 10.5)`,
        );
        const gone = ci.context.filter((state) => state.node === N_H_GONE);
        const born = ci.context.filter((state) => state.node === N_H_BORN);
        if (gone.length !== 1 || gone[0].present !== false) {
          fail(
            `${prefix}: the deleted target h.gone is presented absent in ` +
              `the code-impact context (SPEC 10.4, 10.7); got ` +
              JSON.stringify(gone),
          );
        }
        if (born.length !== 1 || born[0].present !== true) {
          fail(
            `${prefix}: the added target h.born is presented present in ` +
              `the code-impact context (SPEC 10.4, 10.7); got ` +
              JSON.stringify(born),
          );
        }
        assertSameJson(
          identitySet(ci.origin),
          [N_H_BORN, N_H_GONE].sort(),
          `${prefix}: the code-impact origin is the originating nodes of ` +
            `the targets' changes — the added and deleted nodes themselves ` +
            `(SPEC 5.6, 10.5)`,
        );
      },
    );

    // --- current-graph edges ----------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [G_FILE]: T10_5_3_G_INITIAL },
      async (workspace) => {
        const prefix = "T10.5-3 current-graph edges";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(G_FILE, T10_5_3_G_EDITED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the edits`,
        );
        await createBaseSession(product, workspace, base, "s", prefix);

        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          status.items
            .filter((row) => row.scope === G_X)
            .map((row) => row.kind)
            .sort(),
          ["metadata-consistency"],
          `${prefix}: x gets its metadata-consistency item and no ` +
            `dependency-consistency item — its only d reference to t stands ` +
            `at the baseline alone, removed since, and a ` +
            `dependency-consistency item arises from a dependency edge in ` +
            `the current graph (SPEC 10.5), however t's effectiveHash ` +
            `changed; a product reading edges from either graph gives x one`,
        );
        assertSameJson(
          kindScopeSet(status),
          [
            `dependency-consistency ${G_T}`,
            `metadata-consistency ${G_X}`,
            `subtree-coherence ${G_U}`,
          ].sort(),
          `${prefix}: exactly u's subtree-coherence item (u changed), t's ` +
            `dependency-consistency item (its d edge to u stands in the ` +
            `current graph, u present on both sides with a changed ` +
            `effectiveHash), and x's metadata-consistency item (x's d ` +
            `targets changed: t removed) — x bearing no current-graph ` +
            `dependency edge, no dependency-consistency item (SPEC 5.6, 10.5)`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);
        const mcX = requireItem(
          exported.items,
          "metadata-consistency",
          G_X,
          prefix,
        );
        assertSameJson(
          identitySet(mcX.context),
          [G_T],
          `${prefix}: x's metadata-consistency item's context is exactly ` +
            `{t}, the removed d target (SPEC 10.5: the added and removed d ` +
            `targets)`,
        );
        assertSameJson(
          identitySet(mcX.origin),
          [G_X],
          `${prefix}: x's metadata-consistency item's origin is x itself ` +
            `(SPEC 10.5)`,
        );
        const dcT = requireItem(
          exported.items,
          "dependency-consistency",
          G_T,
          prefix,
        );
        assertSameJson(
          identitySet(dcT.context),
          [G_U],
          `${prefix}: t's dependency-consistency item — its d edge to u ` +
            `stands in the current graph — has context exactly {u}, the ` +
            `changed both-sides target (SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(dcT.origin),
          [G_U],
          `${prefix}: t's dependency-consistency item's origin is exactly ` +
            `{u}, the originating node of u's change (SPEC 5.6, 10.5)`,
        );
      },
    );

    // --- origin counting: the tags and coverage stagings, the d-set twin ---
    for (const staging of OC_STAGINGS) {
      await withWorkspace(
        T10_5_3_CODE_CONFIG,
        { [OC_FILE]: T10_5_3_OC_INITIAL, [OC_CODE]: T10_5_3_OC_CODE },
        async (workspace) => {
          const prefix = `T10.5-3 origin counting, ${staging.label}`;
          await workspace.gitInit();
          const base = await workspace.gitCommitAll("baseline");
          await workspace.file(OC_FILE, staging.edited);
          await buildOk(
            product,
            workspace,
            `${prefix} \`build\` after the edits`,
          );

          // The staging's premise: src/o.ts, whose one marker targets t, is
          // transitively impacted and not directly — t's subtreeHash
          // unchanged, its effectiveHash changed through u (SPEC 5.5, 9.2).
          const impactLabel = `${prefix} \`impact --base <baseline> --json\``;
          assertSameJson(
            await impactedLocations(product, workspace, base, impactLabel),
            { direct: [], transitive: [OC_CODE] },
            `${impactLabel} staging premise: src/o.ts, whose one marker ` +
              `targets t, is transitively impacted and not directly — t's ` +
              `subtreeHash unchanged (its tags, coverage attribute, and d ` +
              `targets are no part of its own content, SPEC 5.5) while its ` +
              `effectiveHash changed through u (SPEC 5.5, 9.2)`,
          );

          await createBaseSession(product, workspace, base, "s", prefix);
          const status = await sessionStatus(product, workspace, "s", prefix);
          assertSameJson(
            kindScopeSet(status),
            [
              `code-impact ${OC_CODE}`,
              `dependency-consistency ${OC_T}`,
              `dependency-consistency ${OC_X}`,
              `metadata-consistency ${OC_T}`,
              `subtree-coherence ${OC_U}`,
            ].sort(),
            `${prefix}: exactly u's subtree-coherence item (u changed), t's ` +
              `metadata-consistency item (t metadata-changed), the ` +
              `dependency-consistency items of t (its edge to u) and x (its ` +
              `edge to t, t's effectiveHash changed through u), and ` +
              `src/o.ts's code-impact item (SPEC 5.6, 9.2, 10.5)`,
          );

          const exported = await exportSession(product, workspace, "s", prefix);
          const mcT = requireItem(
            exported.items,
            "metadata-consistency",
            OC_T,
            prefix,
          );
          assertSameJson(
            identitySet(mcT.context),
            [...staging.tMetadataContext].sort(),
            `${prefix}: t's metadata-consistency item's context is the d ` +
              `targets the staging added to or removed from t — none where ` +
              `only its tags or coverage attribute changed, {w} in the twin ` +
              `(SPEC 10.5)`,
          );
          const dcT = requireItem(
            exported.items,
            "dependency-consistency",
            OC_T,
            prefix,
          );
          assertSameJson(
            identitySet(dcT.context),
            [OC_U],
            `${prefix}: t's dependency-consistency item's context is ` +
              `exactly {u}, its changed target — never the unedited w, ` +
              `whose effectiveHash did not change (SPEC 10.5)`,
          );
          assertSameJson(
            identitySet(dcT.origin),
            [OC_U],
            `${prefix}: t's dependency-consistency item's origin is ` +
              `exactly {u}, the originating node of u's change (SPEC 5.6, ` +
              `10.5)`,
          );
          const dcX = requireItem(
            exported.items,
            "dependency-consistency",
            OC_X,
            prefix,
          );
          assertSameJson(
            identitySet(dcX.context),
            [OC_T],
            `${prefix}: x's dependency-consistency item's context is ` +
              `exactly {t}, its changed target (SPEC 10.5)`,
          );
          assertSameJson(
            identitySet(dcX.origin),
            [...staging.origin].sort(),
            `${prefix}: x's dependency-consistency item's origin — the ` +
              `originating nodes of t's categories — is ${staging.originWhy}`,
          );
          const ci = requireItem(
            exported.items,
            "code-impact",
            OC_CODE,
            prefix,
          );
          assertSameJson(
            identitySet(ci.context),
            [OC_T],
            `${prefix}: src/o.ts's code-impact item's context is exactly ` +
              `{t}, the impact-edge target that makes it impacted (SPEC ` +
              `9.2, 10.5)`,
          );
          assertSameJson(
            identitySet(ci.origin),
            [...staging.origin].sort(),
            `${prefix}: src/o.ts's code-impact item's origin — the ` +
              `originating nodes of t's categories, counted as for ` +
              `dependency-consistency — is ${staging.originWhy}`,
          );
        },
      );
    }

    // --- one item per location: T9.2-4's location -------------------------
    await withWorkspace(
      T10_5_3_CODE_CONFIG,
      {
        [L_DIRECT]: T10_5_3_L_DIRECT_INITIAL,
        [L_TRANS]: T10_5_3_L_TRANS,
        [L_UP]: T10_5_3_L_UP_INITIAL,
        [L_BOTH_TS]: T10_5_3_L_BOTH_TS,
      },
      async (workspace) => {
        const prefix = "T10.5-3 one item per location";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(L_DIRECT, T10_5_3_L_DIRECT_EDITED);
        await workspace.file(L_UP, T10_5_3_L_UP_EDITED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the edits`,
        );

        // The staging's premise (T9.2-4): src/both.ts is impacted in both
        // code categories — directly through dt (its subtreeHash changed),
        // transitively through tt (its effectiveHash alone) (SPEC 9.2, 9.3).
        const impactLabel = `${prefix} \`impact --base <baseline> --json\``;
        assertSameJson(
          await impactedLocations(product, workspace, base, impactLabel),
          { direct: [L_BOTH_TS], transitive: [L_BOTH_TS] },
          `${impactLabel} staging premise: src/both.ts is impacted in both ` +
            `code categories — directly through its edge to dt, whose ` +
            `subtreeHash changed, and transitively through its edge to tt, ` +
            `whose effectiveHash alone changed (SPEC 9.2, 9.3; T9.2-4)`,
        );

        await createBaseSession(product, workspace, base, "s", prefix);
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          status.items
            .filter((row) => row.kind === "code-impact")
            .map((row) => row.scope),
          [L_BOTH_TS],
          `${prefix}: exactly one code-impact item, scoped at src/both.ts — ` +
            `one code-impact item per impacted code location, a kind and ` +
            `scope node produced more than once in one derivation yielding ` +
            `a single item (SPEC 10.5), whatever code categories the ` +
            `location is in (9.2, 9.3); a product deriving one item per ` +
            `code category gives it two`,
        );
        assertSameJson(
          kindScopeSet(status),
          [
            `code-impact ${L_BOTH_TS}`,
            `dependency-consistency ${L_TT}`,
            `parent-consistency ${L_DT}`,
            `subtree-coherence ${L_DT_KID}`,
            `subtree-coherence ${L_UP_NODE}`,
          ].sort(),
          `${prefix}: exactly dt.kid's and up's subtree-coherence items (each ` +
            `changed), dt's parent-consistency item (dt.kid's non-root ` +
            `ancestor), tt's dependency-consistency item (its edge to up), ` +
            `and src/both.ts's one code-impact item (SPEC 5.6, 9.2, 10.5)`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);
        const ci = requireItem(
          exported.items,
          "code-impact",
          L_BOTH_TS,
          prefix,
        );
        assertSameJson(
          identitySet(ci.context),
          [L_DT, L_TT].sort(),
          `${prefix}: src/both.ts's one code-impact item's context is ` +
            `exactly the two targets that make it impacted, {dt, tt} — the ` +
            `directly and the transitively impacting target alike (SPEC ` +
            `9.2, 10.5)`,
        );
        assertSameJson(
          identitySet(ci.origin),
          [L_DT_KID, L_UP_NODE].sort(),
          `${prefix}: src/both.ts's one code-impact item's origin is ` +
            `exactly the two targets' originating nodes, {dt.kid, up} — ` +
            `dt's descendant-changed attributed to dt.kid, tt's ` +
            `upstream-changed to up (SPEC 5.6, 10.5)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.5-4 — total item order
// ---------------------------------------------------------------------------

// Two spec files and two code files: items of every kind at controlled
// depths. v's children are declared in document order f, e, g — deliberately
// non-alphabetical, so the absent-scope identity ordering (e before f) is
// distinguishable from stale document order (f before e).
const O_A_FILE = "specs/A.mdx";
const O_B_FILE = "specs/B.mdx";
const O_ABC = "specs/A.mdx#a.b.c";
const O_AB = "specs/A.mdx#a.b";
const O_A = "specs/A.mdx#a";
const O_WM = "specs/A.mdx#w.m";
const O_V = "specs/A.mdx#v";
const O_VF = "specs/A.mdx#v.f";
const O_VE = "specs/A.mdx#v.e";
const O_VG = "specs/A.mdx#v.g";
const O_QD = "specs/B.mdx#q.d";
const O_Q = "specs/B.mdx#q";
const O_XD = "specs/B.mdx#x.d";
const O_ONE = "src/one.ts#f";
const O_TWO = "src/two.ts";

function oASpec(withVEF: boolean): string {
  const vChildren = withVEF
    ? [
        '<S id="v.f">',
        "Vef text v1.",
        "</S>",
        "",
        '<S id="v.e">',
        "Vee-e text v1.",
        "</S>",
        "",
      ]
    : [];
  return [
    '<S id="a">',
    "Aye own text.",
    "",
    '<S id="a.b">',
    "Abe own text.",
    "",
    '<S id="a.b.c">',
    "Abc text v1.",
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="w">',
    "Dub own text.",
    "",
    '<S id="w.m" tags="w1">',
    "Wem text.",
    "</S>",
    "</S>",
    "",
    '<S id="v">',
    "Vee own text.",
    "",
    ...vChildren,
    '<S id="v.g">',
    "Veg text v1.",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

const O_A_BASELINE = [
  '<S id="a">',
  "Aye own text.",
  "",
  '<S id="a.b">',
  "Abe own text.",
  "",
  '<S id="a.b.c">',
  "Abc text v0.",
  "</S>",
  "</S>",
  "</S>",
  "",
  '<S id="w">',
  "Dub own text.",
  "",
  '<S id="w.m" tags="w0">',
  "Wem text.",
  "</S>",
  "</S>",
  "",
  '<S id="v">',
  "Vee own text.",
  "",
  '<S id="v.f">',
  "Vef text v0.",
  "</S>",
  "",
  '<S id="v.e">',
  "Vee-e text v0.",
  "</S>",
  "",
  '<S id="v.g">',
  "Veg text v0.",
  "</S>",
  "</S>",
  "",
].join("\n");

function oBSpec(qdText: string): string {
  return [
    'import A from "./A.xspec"',
    "",
    '<S id="q">',
    "Cue own text.",
    "",
    '<S id="q.d">',
    qdText,
    "</S>",
    "</S>",
    "",
    '<S id="x">',
    "Ex own text.",
    "",
    '<S id="x.d" d={A.a.b.c}>',
    "Exd text.",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

const O_ONE_SOURCE = [
  'import A from "../specs/A.xspec"',
  "",
  "export function f() {",
  "  A.a.b.c",
  "}",
  "",
].join("\n");

const O_TWO_SOURCE = ['import B from "../specs/B.xspec"', "", "B.q.d", ""].join(
  "\n",
);

// The expected total order before the deletions (SPEC 10.5): requirement
// scopes by depth deepest-first, then kind, then file path bytes, then
// document order; code-impact items last by location identity.
const O_INITIAL_ORDER: readonly string[] = [
  `subtree-coherence ${O_ABC}`, // depth 3
  `subtree-coherence ${O_VF}`, // depth 2, SC, A.mdx, document order f e g
  `subtree-coherence ${O_VE}`,
  `subtree-coherence ${O_VG}`,
  `subtree-coherence ${O_QD}`, // depth 2, SC, B.mdx
  `metadata-consistency ${O_WM}`, // depth 2, MC (after every depth-2 SC)
  `dependency-consistency ${O_XD}`, // depth 2, DC
  `parent-consistency ${O_AB}`, // depth 2, PC
  `parent-consistency ${O_A}`, // depth 1, PC, A.mdx, document order a v
  `parent-consistency ${O_V}`,
  `parent-consistency ${O_Q}`, // depth 1, PC, B.mdx
  `code-impact ${O_ONE}`, // code locations last, by identity bytes
  `code-impact ${O_TWO}`,
];

// After deleting v.e and v.f: among (depth 2, SC, A.mdx) the present v.g
// comes first (document order applies to present scopes only), the absent
// scopes follow ordered by identity — e before f, the reverse of their former
// document order.
const O_DELETED_ORDER: readonly string[] = [
  `subtree-coherence ${O_ABC}`,
  `subtree-coherence ${O_VG}`,
  `subtree-coherence ${O_VE}`,
  `subtree-coherence ${O_VF}`,
  `subtree-coherence ${O_QD}`,
  `metadata-consistency ${O_WM}`,
  `dependency-consistency ${O_XD}`,
  `parent-consistency ${O_AB}`,
  `parent-consistency ${O_A}`,
  `parent-consistency ${O_V}`,
  `parent-consistency ${O_Q}`,
  `code-impact ${O_ONE}`,
  `code-impact ${O_TWO}`,
];

// The deletion of v.e and v.f (a manual edit, SPEC 6.6) follows the body's
// first `build`, so it is a staged-source record (helpers/staged-mdx.ts,
// S-9: judged before any product exists); the two pre-`build` edits stay
// plain.
const T10_5_4_A_WITHOUT_VEF = stagedMdx(
  "T10.5-4 specs/A.mdx with the v.e and v.f sections deleted",
  oASpec(false),
);

// The item-id tie sub-fixture (SPEC 10.5's last ordering key): two file
// roots that come to share one path. The baseline holds specs/A.mdx alone;
// specs/X.mdx is added (its root, an added node, is `changed`, SPEC 5.6, and
// its one section is skipped under it), so the session holds that root's
// subtree-coherence item alone; a journaled file move takes the root to
// specs/Y.mdx; a new root authored at the vacated specs/X.mdx starts a new
// canonical chain (SPEC 5.4) and enters through an `updated` resolve's
// re-derivation; specs/Y.mdx is deleted; a second journaled move takes the
// new root to specs/Y.mdx, which is deleted too. Both items' scope nodes are
// then absent and presented under specs/Y.mdx — recorded identities mapped
// forward through the journal (SPEC 10.4) — tied on depth, kind, file path,
// presence, and identity, so only the item `id` key orders them. The
// workspace is created after the body's first `build`, so its initial
// `.mdx` file and both later specs/X.mdx stagings are staged-source records
// (helpers/staged-mdx.ts, S-9), as is its configuration (SPECS_ONLY_CONFIG).
const O_TIE_A_FILE = "specs/A.mdx";
const O_TIE_X_FILE = "specs/X.mdx";
const O_TIE_Y_FILE = "specs/Y.mdx";

const T10_5_4_TIE_A_INITIAL = stagedMdx(
  "T10.5-4 item-id tie sub-fixture specs/A.mdx (the baseline's one section, the tie sub-fixture's initial source)",
  ['<S id="k">', "Kay text.", "</S>", ""].join("\n"),
);
const T10_5_4_TIE_X_FIRST = stagedMdx(
  "T10.5-4 item-id tie sub-fixture specs/X.mdx (the first root, added after the baseline)",
  ['<S id="x">', "Ex text.", "</S>", ""].join("\n"),
);
const T10_5_4_TIE_X_SECOND = stagedMdx(
  "T10.5-4 item-id tie sub-fixture specs/X.mdx (the second root, authored at the path the first move vacated)",
  ['<S id="x">', "New ex text.", "</S>", ""].join("\n"),
);

/** UTF-8 byte order of two strings (SPEC 12.0: IDs compare byte-wise). */
function compareUtf8Bytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Staging premise of a file move (SPEC 6.5: the file form relocates the
 * source file): the old path vacated, the new one a file — diagnosed, so the
 * deletion or authoring that follows at either path never meets a missing
 * or occupied path as a harness error (H-8).
 */
async function assertFileMoved(
  workspace: TestWorkspace,
  from: string,
  to: string,
  context: string,
): Promise<void> {
  const fromKind = await workspace.kind(from);
  const toKind = await workspace.kind(to);
  if (fromKind !== "absent" || toKind !== "file") {
    fail(
      `${context}: the file form of \`move\` relocates the source file ` +
        `(SPEC 6.5) — expected ${from} absent and ${to} a file, got ${from} ` +
        `${fromKind} and ${to} ${toKind}`,
    );
  }
}

const T10_5_4 = defineProductTest({
  id: "T10.5-4",
  title:
    "total item order across two spec files and two code locations: requirement-scoped items first by scope-node depth deepest-first, then kind order subtree-coherence, metadata-consistency, dependency-consistency, parent-consistency (kind precedes file path: an A.mdx metadata-consistency item follows a B.mdx subtree-coherence item of the same depth), then scope-node file path bytes, then document order; code-impact items last by location identity bytes; after deleting two scope sections the absent-scope items order after the same group's present one, by scope-node identity — the reverse of their former document order, discriminating the identity key from stale document positions; `status` and `export` present the full order and `next` presents it as the walk order of repeated next-plus-resolve rounds; and two absent-scope items tied on every earlier key — the subtree-coherence items of two file roots, each moved onto specs/Y.mdx by a journaled file `move` (the second authored at the path the first vacated, a new node on a new canonical chain, its item entering through an `updated` resolve's re-derivation) and then deleted, both presented absent under specs/Y.mdx — order by item `id` bytes, the ids the product's own, in `status`, `export`, and the `next` walk (SPEC 5.4, 6.5, 10.4, 10.5, 12.0)",
  run: async (product) => {
    await withWorkspace(
      SPECS_CODE_CONFIG,
      {
        [O_A_FILE]: O_A_BASELINE,
        [O_B_FILE]: oBSpec("Qud text v0."),
        "src/one.ts": O_ONE_SOURCE,
        "src/two.ts": O_TWO_SOURCE,
      },
      async (workspace) => {
        const prefix = "T10.5-4";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(O_A_FILE, oASpec(true));
        await workspace.file(O_B_FILE, oBSpec("Qud text v1."));
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the edits`,
        );
        await createBaseSession(product, workspace, base, "s", prefix);

        const initial = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSequence(initial.items),
          O_INITIAL_ORDER,
          `${prefix} \`status\` before the deletions: the total item order ` +
            `— depth deepest-first, kind, file path bytes, document order; ` +
            `code-impact last by location identity (SPEC 10.5)`,
        );
        const initialExport = await exportSession(
          product,
          workspace,
          "s",
          prefix,
        );
        assertSameJson(
          exportKindScopeSequence(initialExport.items),
          O_INITIAL_ORDER,
          `${prefix} \`export\` before the deletions presents the same ` +
            `item order (SPEC 10.5, 10.7)`,
        );

        // Delete the v.e and v.f sections (a manual edit, SPEC 6.6) — their
        // items' scope nodes become absent; membership is untouched (no
        // re-derivation happens without an updated resolve).
        await workspace.file(O_A_FILE, T10_5_4_A_WITHOUT_VEF);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting v.e and v.f`,
        );
        const veRow = requireRow(initial, "subtree-coherence", O_VE, prefix);
        const afterShown = await showItem(
          product,
          workspace,
          "s",
          veRow.id,
          `${prefix} post-deletion premise`,
        );
        if (afterShown.scope.present !== false) {
          fail(
            `${prefix} staging premise: after the deletion, v.e's item ` +
              `scope must be absent (SPEC 10.4); got ` +
              JSON.stringify(afterShown.scope),
          );
        }

        const deleted = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSequence(deleted.items),
          O_DELETED_ORDER,
          `${prefix} \`status\` after the deletions: present scopes first ` +
            `in document order, absent scopes after them ordered by ` +
            `scope-node identity — v.e before v.f, the reverse of their ` +
            `former document order (SPEC 10.5)`,
        );
        const deletedExport = await exportSession(
          product,
          workspace,
          "s",
          prefix,
        );
        assertSameJson(
          exportKindScopeSequence(deletedExport.items),
          O_DELETED_ORDER,
          `${prefix} \`export\` after the deletions presents the same ` +
            `item order (SPEC 10.5, 10.7)`,
        );

        // `next` presents the order as the walk order: every blocker in
        // this fixture precedes its dependents, so repeated next + resolve
        // rounds visit items exactly in item order (SPEC 10.5, 10.7).
        const expectedIds = deleted.items.map((row) => row.id);
        for (let index = 0; index < expectedIds.length; index += 1) {
          const stepLabel =
            `${prefix} \`review next s --json\` walk step ` +
            `${String(index + 1)} of ${String(expectedIds.length)}`;
          const next = decodeNextReport(
            await runJson(
              product,
              workspace,
              ["review", "next", "s", "--json"],
              stepLabel,
            ),
            stepLabel,
          );
          if (next.fullyResolved || next.item === undefined) {
            fail(
              `${stepLabel}: needing-review items remain, so \`next\` must ` +
                `return one (SPEC 10.7)`,
            );
          }
          if (next.item.id !== expectedIds[index]) {
            fail(
              `${stepLabel}: \`next\` returns the first needing-review ` +
                `unblocked item in item order (SPEC 10.5, 10.7) — expected ` +
                `${expectedIds[index]} (${O_DELETED_ORDER[index]}), got ` +
                `${next.item.id}`,
            );
          }
          await resolveOk(
            product,
            workspace,
            "s",
            next.item.id,
            "no-change",
            `${stepLabel} — \`resolve --status no-change\` to advance the walk`,
          );
        }
        const doneLabel = `${prefix} \`review next s --json\` after the walk`;
        const done = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "s", "--json"],
            doneLabel,
          ),
          doneLabel,
        );
        if (!done.fullyResolved) {
          fail(
            `${doneLabel}: every item is resolved, so \`next\` reports the ` +
              `session fully resolved (SPEC 10.7)`,
          );
        }
      },
    );

    // --- the absent-scope item-id tie: two roots moved onto one path --------
    // SPEC 10.5's last key: absent-scope items tied on depth, kind, file
    // path, presence, and scope-node identity order by item `id`, byte-wise
    // (12.0). The ids are the product's own: the expected order is read
    // from them, never spelled.
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [O_TIE_A_FILE]: T10_5_4_TIE_A_INITIAL },
      async (workspace) => {
        const prefix = "T10.5-4 item-id tie";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(O_TIE_X_FILE, T10_5_4_TIE_X_FIRST);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after adding ${O_TIE_X_FILE}`,
        );
        await createBaseSession(product, workspace, base, "s", prefix);
        const created = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} after \`create\``,
        );
        assertSameJson(
          kindScopeSequence(created.items),
          [`subtree-coherence ${O_TIE_X_FILE}`],
          `${prefix} staging premise after \`create\`: the added file's ` +
            `root is the one changed node without a changed ancestor — an ` +
            `added node is changed, its section is skipped under it, and a ` +
            `root has no ancestor to review — so the session holds exactly ` +
            `that root's subtree-coherence item (SPEC 5.6, 10.5)`,
        );
        const firstId = created.items[0].id;

        // The first root moves away through a journaled file move; a new
        // root authored at the vacated path is a new node, starting a new
        // canonical chain (SPEC 5.4), and enters the session through an
        // `updated` resolve's re-derivation (SPEC 10.5).
        await expectExit(
          product,
          workspace,
          ["move", O_TIE_X_FILE, O_TIE_Y_FILE],
          0,
          `${prefix} the first \`move ${O_TIE_X_FILE} ${O_TIE_Y_FILE}\``,
        );
        await assertFileMoved(
          workspace,
          O_TIE_X_FILE,
          O_TIE_Y_FILE,
          `${prefix} the first \`move ${O_TIE_X_FILE} ${O_TIE_Y_FILE}\``,
        );
        await workspace.file(O_TIE_X_FILE, T10_5_4_TIE_X_SECOND);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after authoring the second ${O_TIE_X_FILE}`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          firstId,
          "updated",
          `${prefix} \`resolve s ${firstId} --status updated\` (the ` +
            `re-derivation adding the second root's item, SPEC 10.5)`,
        );
        const rederived = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} after the re-derivation`,
        );
        assertSameJson(
          kindScopeSet(rederived),
          [
            `subtree-coherence ${O_TIE_X_FILE}`,
            `subtree-coherence ${O_TIE_Y_FILE}`,
          ].sort(),
          `${prefix} staging premise after the \`updated\` resolve: the ` +
            `moved root's item, presented under ${O_TIE_Y_FILE} (its ` +
            `recorded identity mapped forward through the journal), and the ` +
            `new root's item at ${O_TIE_X_FILE} — distinct nodes, so ` +
            `distinct items (SPEC 5.4, 10.4, 10.5)`,
        );
        const movedId = requireRow(
          rederived,
          "subtree-coherence",
          O_TIE_Y_FILE,
          prefix,
        ).id;
        const newId = requireRow(
          rederived,
          "subtree-coherence",
          O_TIE_X_FILE,
          prefix,
        ).id;
        if (movedId === newId) {
          fail(
            `${prefix} staging premise after the \`updated\` resolve: the ` +
              `moved root's item and the new root's item must carry distinct ` +
              `ids (SPEC 10.2: unique within the session); both are ` +
              JSON.stringify(movedId),
          );
        }

        // The moved root is deleted; the new root moves onto the same path
        // through a second journaled file move and is deleted too. Both
        // scope nodes are now absent, each presented under specs/Y.mdx —
        // its recorded identity mapped forward through the journal (SPEC
        // 10.4).
        await fsp.rm(workspace.path(O_TIE_Y_FILE));
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting the first root's ${O_TIE_Y_FILE}`,
        );
        await expectExit(
          product,
          workspace,
          ["move", O_TIE_X_FILE, O_TIE_Y_FILE],
          0,
          `${prefix} the second \`move ${O_TIE_X_FILE} ${O_TIE_Y_FILE}\``,
        );
        await assertFileMoved(
          workspace,
          O_TIE_X_FILE,
          O_TIE_Y_FILE,
          `${prefix} the second \`move ${O_TIE_X_FILE} ${O_TIE_Y_FILE}\``,
        );
        await fsp.rm(workspace.path(O_TIE_Y_FILE));
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting the second root's ${O_TIE_Y_FILE}`,
        );

        const tiedLabel = `${prefix} after both deletions`;
        const tiedStatus = await sessionStatus(
          product,
          workspace,
          "s",
          tiedLabel,
        );
        const tiedExport = await exportSession(
          product,
          workspace,
          "s",
          tiedLabel,
        );
        assertSameJson(
          tiedExport.items.map((item) => item.id).sort(),
          [movedId, newId].sort(),
          `${tiedLabel} staging premise (\`export\`): the session holds ` +
            `exactly the two items — items that no longer generate remain, ` +
            `and only an \`updated\` resolve re-derives, none having followed ` +
            `the one above (SPEC 10.5)`,
        );
        assertSameJson(
          tiedExport.items.map((item) => [
            item.kind,
            item.scope.node,
            item.scope.present,
          ]),
          [
            ["subtree-coherence", O_TIE_Y_FILE, false],
            ["subtree-coherence", O_TIE_Y_FILE, false],
          ],
          `${tiedLabel} staging premise (\`export\`'s scopes): both items' ` +
            `scope nodes are absent and presented under ${O_TIE_Y_FILE} — ` +
            `each recorded identity mapped forward through the journal (SPEC ` +
            `10.4) — so the two subtree-coherence items tie on depth (roots ` +
            `are 0), kind, file path, presence, and scope-node identity (SPEC ` +
            `10.5)`,
        );

        const [lowId, highId] = [movedId, newId].sort(compareUtf8Bytes);
        const tieKey =
          `SPEC 10.5: among items tied on every earlier key, those with ` +
          `absent scope nodes follow, ordered by scope-node identity, then by ` +
          `item \`id\`; 12.0: IDs compare byte-wise — ${lowId} before ` +
          `${highId}; ${movedId} is the moved root's item, ${newId} the new ` +
          `root's`;
        assertSameJson(
          tiedStatus.items.map((row) => [row.id, row.kind, row.scope]),
          [
            [lowId, "subtree-coherence", O_TIE_Y_FILE],
            [highId, "subtree-coherence", O_TIE_Y_FILE],
          ],
          `${tiedLabel} \`status\`: the two tied absent-scope items in ` +
            `item-id byte order (${tieKey})`,
        );
        assertSameJson(
          tiedExport.items.map((item) => item.id),
          [lowId, highId],
          `${tiedLabel} \`export\` presents the same item-id order ` +
            `(${tieKey}; SPEC 10.7)`,
        );

        // `next` presents the tie as its walk order. Premise: both items
        // need review and neither is blocked — path-blocks gives
        // subtree-coherence items no blockers; the moved root's item,
        // resolved `updated` while its scope node was present, is
        // invalidated by the presence change, and the new root's item was
        // never resolved (SPEC 10.3, 10.4, 10.5).
        for (const row of tiedStatus.items) {
          if (
            row.blocked ||
            (row.status !== "unresolved" && row.status !== "invalidated")
          ) {
            fail(
              `${tiedLabel} staging premise: both tied items need review ` +
                `unblocked, so \`next\` must choose between them by item ` +
                `order (SPEC 10.3, 10.4, 10.7); item ${row.id} is ` +
                `${row.status}${row.blocked ? ", blocked" : ""}`,
            );
          }
        }
        const walk = [lowId, highId];
        for (let index = 0; index < walk.length; index += 1) {
          const stepLabel =
            `${prefix} \`review next s --json\` walk step ` +
            `${String(index + 1)} of ${String(walk.length)}`;
          const next = decodeNextReport(
            await runJson(
              product,
              workspace,
              ["review", "next", "s", "--json"],
              stepLabel,
            ),
            stepLabel,
          );
          if (next.fullyResolved || next.item === undefined) {
            fail(
              `${stepLabel}: needing-review items remain, so \`next\` must ` +
                `return one (SPEC 10.7)`,
            );
          }
          if (next.item.id !== walk[index]) {
            fail(
              `${stepLabel}: \`next\` returns the first needing-review ` +
                `unblocked item in item order (SPEC 10.7; ${tieKey}) — ` +
                `expected ${walk[index]}, got ${next.item.id}` +
                (index === 1 && next.item.id === lowId
                  ? ` — the item just resolved \`no-change\` with its scope ` +
                    `node absent, which stays resolved while the node stays ` +
                    `absent (SPEC 10.4)`
                  : ""),
            );
          }
          await resolveOk(
            product,
            workspace,
            "s",
            next.item.id,
            "no-change",
            `${stepLabel} — \`resolve --status no-change\` to advance the walk`,
          );
        }
        const tieDoneLabel = `${prefix} \`review next s --json\` after the walk`;
        const tieDone = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "s", "--json"],
            tieDoneLabel,
          ),
          tieDoneLabel,
        );
        if (!tieDone.fullyResolved) {
          fail(
            `${tieDoneLabel}: both items are resolved, so \`next\` reports ` +
              `the session fully resolved (SPEC 10.7)`,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.5-5 — re-derivation on `updated`: sub-fixture A (derivation basics:
// timing, new items, matching, blockedBy recomputed, items no longer
// generated keeping blockedBy and context as last assigned), sub-fixture B
// (decompositions, the decomposition's parent-consistency item gaining a
// child authored after the splits in its context and blockedBy), then
// TEST-SPEC's four further fixtures, each in a workspace of its own: the
// matching arm (N/V: note, `current`, scope and origin as last assigned and
// as generated, `invalidated`, `list`), the kept-blockedBy arm (A/K1/V),
// the skipping arm (P/Q, Q edited after `create`), and the newly-visited arm
// (P/Q, P's edit reverted), exported for T10.2-2's, T10.2-4's, and
// T10.4-8's arms.
// ---------------------------------------------------------------------------

// Sub-fixture A: two changed branches under distinct parents; p.b is the
// sibling subtree that enters only through re-derivation, r the family that
// stops generating after its edit is reverted.
const W_FILE = "specs/W.mdx";
const W_P = "specs/W.mdx#p";
const W_PA = "specs/W.mdx#p.a";
const W_PB = "specs/W.mdx#p.b";
const W_R = "specs/W.mdx#r";
const W_RC = "specs/W.mdx#r.c";

function wSpec(paText: string, pbText: string, rcText: string): string {
  return [
    '<S id="p">',
    "Pee own text.",
    "",
    '<S id="p.a">',
    paText,
    "</S>",
    "",
    '<S id="p.b">',
    pbText,
    "</S>",
    "</S>",
    "",
    '<S id="r">',
    "Arr own text.",
    "",
    '<S id="r.c">',
    rcText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// Sub-fixture B: one changed branch g.a with a two-level substructure for
// recursive decomposition; g.a.z is authored later and enters only through
// the decomposition applied at re-derivation.
const V_FILE = "specs/V.mdx";
const V_G = "specs/V.mdx#g";
const V_GA = "specs/V.mdx#g.a";
const V_GAX = "specs/V.mdx#g.a.x";
const V_GAXK = "specs/V.mdx#g.a.x.k";
const V_GAY = "specs/V.mdx#g.a.y";
const V_GAZ = "specs/V.mdx#g.a.z";

function vSpec(gaOwn: string, withZ: boolean): string {
  const zLines = withZ ? ["", '<S id="g.a.z">', "Gaz text.", "</S>"] : [];
  return [
    '<S id="g">',
    "Gee own text.",
    "",
    '<S id="g.a">',
    gaOwn,
    "",
    '<S id="g.a.x">',
    "Gax own text.",
    "",
    '<S id="g.a.x.k">',
    "Gaxk text.",
    "</S>",
    "</S>",
    "",
    '<S id="g.a.y">',
    "Gay text.",
    "</S>",
    ...zLines,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// T10.5-5's later edits — sub-fixture A's p.b edit and r.c revert, and both
// of sub-fixture B's — follow the body's first `build`, so they are
// staged-source records (helpers/staged-mdx.ts, S-9: judged before any
// product exists), the same template calls moved to module level;
// sub-fixture A's first edit precedes that `build` and stays plain, as does
// its initial file; sub-fixture B's initial file, staged after it, is a
// record too (below).
const T10_5_5_W_PB_EDITED = stagedMdx(
  "T10.5-5 specs/W.mdx with p.b at v1 beside the p.a and r.c edits (re-derivation)",
  wSpec("Paa text v1.", "Pab text v1.", "Arc text v1."),
);
const T10_5_5_W_RC_REVERTED = stagedMdx(
  "T10.5-5 specs/W.mdx with r.c reverted to its baseline text (re-derivation)",
  wSpec("Paa text v1.", "Pab text v1.", "Arc text v0."),
);
const T10_5_5_V_GA_EDITED = stagedMdx(
  "T10.5-5 specs/V.mdx with g.a's own text at v1 (decomposition)",
  vSpec("Gaa own v1.", false),
);
const T10_5_5_V_WITH_Z = stagedMdx(
  "T10.5-5 specs/V.mdx with g.a.z authored after the splits (decomposition)",
  vSpec("Gaa own v1.", true),
);
const T10_5_5_V_INITIAL = stagedMdx(
  "T10.5-5 specs/V.mdx with g.a's own text at v0 (the decomposition sub-fixture's initial source)",
  vSpec("Gaa own v0.", false),
);

// The matching arm (TEST-SPEC T10.5-5's N/V fixture): two visited
// top-level sections n and v, both edited before `create --base`. n's
// subtree-coherence item is resolved `no-change` with a note; a child n.c
// is then authored under n — n.c `changed` (added, SPEC 5.6) beneath the
// `changed` n, so skipped (10.5), and n's subtreeHash changed since its
// resolve — and v's item resolved `updated`. The re-derivation matches n's
// item (its kind and scope node generated again): it keeps its id, status,
// note, and recorded state and takes the generated scope and origin — n.c
// joining both, which reads presented without it before the re-derivation
// (10.4: as last assigned); 10.4 alone decides it reads `invalidated`.
const M_FILE = "specs/M.mdx";
const M_N = "specs/M.mdx#n";
const M_NC = "specs/M.mdx#n.c";
const M_V = "specs/M.mdx#v";
const M_NOTE = "Checked by hand: en stands as written.";

function mSpec(nOwn: string, vText: string, withChild: boolean): string {
  const child = withChild ? ["", '<S id="n.c">', "Ensee text.", "</S>"] : [];
  return [
    '<S id="n">',
    nOwn,
    ...child,
    "</S>",
    "",
    '<S id="v">',
    vText,
    "</S>",
    "",
  ].join("\n");
}

// The kept-blockedBy arm (TEST-SPEC T10.5-5's A/K1/V fixture): a top-level
// a holding a.k1, and a top-level v; a.k1's and v's texts edited before
// `create --base` give a.k1's subtree-coherence item, a's
// parent-consistency item (context and origin {a.k1}, blockedBy a.k1's
// item), and v's subtree-coherence item (10.5). a.k1's edit is then
// reverted — a.k1's ownHash back at its baseline value, so neither a.k1 nor
// a is `changed` or visited — and v's item resolved `updated`: the
// re-derivation generates v's item alone, and a.k1's and a's items, no
// longer generated, remain with their `blockedBy`, never recomputed — a's
// non-empty one kept, so a stays blocked while a.k1's item is unresolved.
const KB_FILE = "specs/B.mdx";
const KB_A = "specs/B.mdx#a";
const KB_K1 = "specs/B.mdx#a.k1";
const KB_V = "specs/B.mdx#v";
const KB_SESSION_FILE = ".xspec/reviews/s.json";

function kbSpec(k1Text: string, vText: string): string {
  return [
    '<S id="a">',
    "Ay own text.",
    "",
    '<S id="a.k1">',
    k1Text,
    "</S>",
    "</S>",
    "",
    '<S id="v">',
    vText,
    "</S>",
    "",
  ].join("\n");
}

// The P/Q arms (TEST-SPEC T10.5-5's skipping and newly-visited fixtures):
// a top-level p holding p.q, in specs/P.mdx. The skipping arm edits p's own
// text before `create --base` and p.q's after it: p.q is newly `changed`
// beneath the `changed` p, so skipped (10.5) — p's `updated` resolve adds
// no item scoped at p.q, p's item taking origin {p, p.q}. The
// newly-visited arm edits both before `create` (p's item, origin
// {p, p.q}), then p.q's text again and p's edit reverted: p.q is newly
// visited — its `changed` ancestor reverted — so p's `updated` resolve adds
// p.q's subtree-coherence item and p's parent-consistency item (context and
// origin {p.q}, blockedBy p.q's item), `unresolved`, beside p's
// subtree-coherence item, which no longer generates and remains.
//
// The newly-visited arm is exported for T10.2-2's, T10.2-4's, and
// T10.4-8's arms over T10.5-5's newly visited p.q (`T10_5_5_PQ_FILE`,
// `T10_5_5_PQ_NODES`, `t1055PqSource`, `T10_5_5_PQ_INITIAL_FILES`,
// `stageT1055NewlyVisitedQ`): the staging asserts staging premises alone,
// every outcome T10.5-5 asserts staying in its body.

/** The P/Q arms' one source path: p and p.q in specs/P.mdx. */
export const T10_5_5_PQ_FILE = "specs/P.mdx";

/** The P/Q arms' node identities (TEST-SPEC's P and Q; SPEC 1.5). */
export const T10_5_5_PQ_NODES = {
  p: "specs/P.mdx#p",
  q: "specs/P.mdx#p.q",
} as const;

const PQ_P = T10_5_5_PQ_NODES.p;
const PQ_Q = T10_5_5_PQ_NODES.q;

/**
 * specs/P.mdx's bytes: the top-level p, its own text `pOwn`, holding p.q,
 * its text `qText`. Exported so a later arm over the newly-visited staging
 * can stage a further p.q edit as a staged-source record of its own (S-9).
 */
export function t1055PqSource(pOwn: string, qText: string): string {
  return [
    '<S id="p">',
    pOwn,
    "",
    '<S id="p.q">',
    qText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// T10.5-5's later arms run in workspaces created after the body's first
// `build`, so their initial sources and every edit are staged-source
// records (helpers/staged-mdx.ts, S-9): judged before any product exists.
const T10_5_5_M_INITIAL = stagedMdx(
  "T10.5-5 specs/M.mdx with n and v at v0 (the matching arm's initial source)",
  mSpec("En own v0.", "Vee text v0.", false),
);
const T10_5_5_M_EDITED = stagedMdx(
  "T10.5-5 specs/M.mdx with n's own text and v's at v1 (the matching arm's edits before `create --base`)",
  mSpec("En own v1.", "Vee text v1.", false),
);
const T10_5_5_M_CHILD_ADDED = stagedMdx(
  "T10.5-5 specs/M.mdx with the child n.c authored under n (the matching arm, after n's resolve)",
  mSpec("En own v1.", "Vee text v1.", true),
);
const T10_5_5_KB_INITIAL = stagedMdx(
  "T10.5-5 specs/B.mdx with a.k1 and v at v0 (the kept-blockedBy arm's initial source)",
  kbSpec("Kay one text v0.", "Vee text v0."),
);
const T10_5_5_KB_EDITED = stagedMdx(
  "T10.5-5 specs/B.mdx with a.k1 and v at v1 (the kept-blockedBy arm's edits before `create --base`)",
  kbSpec("Kay one text v1.", "Vee text v1."),
);
const T10_5_5_KB_K1_REVERTED = stagedMdx(
  "T10.5-5 specs/B.mdx with a.k1's edit reverted, v at v1 (the kept-blockedBy arm, before the re-derivation)",
  kbSpec("Kay one text v0.", "Vee text v1."),
);
const T10_5_5_PQ_INITIAL = stagedMdx(
  "T10.5-5 specs/P.mdx with p's own text and p.q's at v0 (the P/Q arms' initial source)",
  t1055PqSource("Pee own v0.", "Cue text v0."),
);
const T10_5_5_PQ_P_EDITED = stagedMdx(
  "T10.5-5 specs/P.mdx with p's own text at v1 (the skipping arm's edit before `create --base`)",
  t1055PqSource("Pee own v1.", "Cue text v0."),
);
const T10_5_5_PQ_BOTH_EDITED = stagedMdx(
  "T10.5-5 specs/P.mdx with p's own text and p.q's at v1 (the skipping arm's p.q edit after `create`; the newly-visited arm's edits before it)",
  t1055PqSource("Pee own v1.", "Cue text v1."),
);
const T10_5_5_PQ_REVISITED = stagedMdx(
  "T10.5-5 specs/P.mdx with p's edit reverted and p.q at v2 (the newly-visited arm, before the re-derivation)",
  t1055PqSource("Pee own v0.", "Cue text v2."),
);

/**
 * The P/Q arms' initial source at the baseline, as a workspace
 * declaration's `files` entry beside a configuration whose one spec group
 * discovers every `.mdx` file under `specs/` (SPEC 7.1) — a record, so any
 * workspace stages it alike (S-9).
 */
export const T10_5_5_PQ_INITIAL_FILES: Readonly<Record<string, StagedMdx>> = {
  [T10_5_5_PQ_FILE]: T10_5_5_PQ_INITIAL,
};

/** The session T10.5-5's newly-visited staging leaves, and its captures. */
export interface T1055NewlyVisitedQ {
  /** The baseline commit `create --base` names. */
  readonly base: string;
  /** p's and p.q's hashes at the baseline (`query node`). */
  readonly baseline: ReadonlyMap<string, NodeHashes>;
  /**
   * p's and p.q's hashes at p's `updated` resolve (`query node`, the last
   * invocation before it, nothing staged between).
   */
  readonly atReDerivation: ReadonlyMap<string, NodeHashes>;
  /** p's subtree-coherence item — the `updated` resolve's trigger. */
  readonly pId: string;
}

/** One captured hash, diagnosed when the capture lacks the node. */
function capturedHash(
  captures: ReadonlyMap<string, NodeHashes>,
  node: string,
  hash: keyof NodeHashes,
  context: string,
): string {
  const hashes = captures.get(node);
  if (hashes === undefined) {
    fail(
      `${context}: harness staging defect — no \`query node\` capture ` +
        `exists for ${node}, so its ${hash} premise cannot be checked`,
    );
  }
  return hashes[hash];
}

/**
 * Stage T10.5-5's newly-visited arm in a fresh workspace holding
 * `T10_5_5_PQ_INITIAL_FILES` (SPEC 10.5): the baseline committed, built,
 * and captured; p's own text and p.q's edited (v1) and built; `review
 * create --base <baseline> --name s`, whose session holds exactly p's
 * subtree-coherence item, its origin exactly {p, p.q} — p visited, p.q
 * skipped (staging premises from `status` and `export`); p.q's text edited
 * again (v2) and p's edit reverted, built and captured — p's ownHash back at
 * its baseline value, so p is no longer `changed`, and p.q's ownHash
 * differing from its baseline value, so p.q is `changed` with no `changed`
 * ancestor: newly visited (5.6, 10.5; premises via `query node`); then p's
 * item resolved `updated`, whose re-derivation (10.5) the caller observes.
 * Exported for T10.2-2's, T10.2-4's, and T10.4-8's arms over T10.5-5's
 * newly visited p.q.
 */
export async function stageT1055NewlyVisitedQ(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<T1055NewlyVisitedQ> {
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${label} \`build\` at the baseline`);
  const baseline = await captureHashes(
    product,
    workspace,
    [PQ_P, PQ_Q],
    `${label} baseline capture`,
  );
  await workspace.file(T10_5_5_PQ_FILE, T10_5_5_PQ_BOTH_EDITED);
  await buildOk(
    product,
    workspace,
    `${label} \`build\` after p's and p.q's edits`,
  );
  await createBaseSession(product, workspace, base, "s", label);
  const created = await sessionStatus(product, workspace, "s", label);
  assertSameJson(
    kindScopeSequence(created.items),
    [`subtree-coherence ${PQ_P}`],
    `${label} staging premise: p's and p.q's edits yield p's ` +
      `subtree-coherence item alone — p visited, p.q skipped beneath its ` +
      `\`changed\` ancestor, p's parent the root (SPEC 5.6, 10.5)`,
  );
  const pId = requireRow(created, "subtree-coherence", PQ_P, label).id;
  assertSameJson(
    identitySet(
      requireItem(
        (await exportSession(product, workspace, "s", label)).items,
        "subtree-coherence",
        PQ_P,
        label,
      ).origin,
    ),
    [PQ_P, PQ_Q].sort(),
    `${label} staging premise: p's item's origin is exactly {p, p.q} — ` +
      `the \`changed\` nodes in its scope, the skipped p.q included ` +
      `(SPEC 10.5)`,
  );
  await workspace.file(T10_5_5_PQ_FILE, T10_5_5_PQ_REVISITED);
  await buildOk(
    product,
    workspace,
    `${label} \`build\` after p.q's second edit and p's revert`,
  );
  const atReDerivation = await captureHashes(
    product,
    workspace,
    [PQ_P, PQ_Q],
    `${label} capture at the re-derivation`,
  );
  const premise = `${label} staging premise`;
  if (
    capturedHash(atReDerivation, PQ_P, "ownHash", premise) !==
    capturedHash(baseline, PQ_P, "ownHash", premise)
  ) {
    fail(
      `${premise}: reverting p's edit must restore p's ownHash to its ` +
        `baseline value (SPEC 5.5), so p is no longer \`changed\` (5.6) ` +
        `and p.q, its \`changed\` child, is newly visited (10.5)`,
    );
  }
  if (
    capturedHash(atReDerivation, PQ_Q, "ownHash", premise) ===
    capturedHash(baseline, PQ_Q, "ownHash", premise)
  ) {
    fail(
      `${premise}: p.q's second edit must leave its ownHash differing ` +
        `from its baseline value (SPEC 5.5), so p.q is \`changed\` (5.6)`,
    );
  }
  await resolveOk(
    product,
    workspace,
    "s",
    pId,
    "updated",
    `${label} \`resolve --status updated\` of p's subtree-coherence item — ` +
      `triggers re-derivation (SPEC 10.5)`,
  );
  return { base, baseline, atReDerivation, pId };
}

/** `review list --json`'s stored counts for one healthy session (10.7). */
async function listedStoredCounts(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<Readonly<Record<string, number>>> {
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
  return entry.counts;
}

/**
 * A listed session's counts, compared as `counts[status] ?? 0` per defined
 * status — stored statuses, no read-time invalidation (SPEC 10.4, 10.7).
 */
function assertStoredCounts(
  counts: Readonly<Record<string, number>>,
  expected: Readonly<Record<ItemStatus, number>>,
  context: string,
): void {
  for (const status of ITEM_STATUSES) {
    const actual = counts[status] ?? 0;
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

/**
 * T10.5-5's matching arm (the N/V fixture, above): n's item, resolved
 * `no-change` with a note before n.c is authored, is matched by the
 * re-derivation v's `updated` resolve triggers — it keeps its id, its note,
 * and its `current` byte for byte (the decoded member's JSON rendering,
 * member order included, from `export` at n's resolve and after the
 * re-derivation; H-3: its inner shape is the product's), takes the
 * generated scope and origin — each presented exactly {n} before the
 * re-derivation (10.4: as last assigned, at `create`) and exactly {n, n.c}
 * after it (n.c, added, is `changed`, 5.6), the scope through every scope
 * node the payload presents (`requireScopeNodes`) — and reads `invalidated`
 * (n's subtreeHash changed since the resolve, the premise checked via
 * `query node`), never `unresolved`: its stored status kept, `list`
 * counting it `no-change`. n.c, skipped beneath the `changed` n, gets no
 * item (SPEC 10.4, 10.5, 10.7).
 */
async function runMatchingArm(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.5-5 matching";
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await workspace.file(M_FILE, T10_5_5_M_EDITED);
  await buildOk(product, workspace, `${prefix} \`build\` after the edits`);
  await createBaseSession(product, workspace, base, "s", prefix);
  const created = await sessionStatus(product, workspace, "s", prefix);
  assertSameJson(
    kindScopeSequence(created.items),
    [`subtree-coherence ${M_N}`, `subtree-coherence ${M_V}`],
    `${prefix} staging premise: n's and v's edits yield their ` +
      `subtree-coherence items alone, in document order — both visited and ` +
      `top-level, so no parent-consistency item arises (SPEC 10.5)`,
  );
  const nId = requireRow(created, "subtree-coherence", M_N, prefix).id;
  const vId = requireRow(created, "subtree-coherence", M_V, prefix).id;

  await expectExit(
    product,
    workspace,
    ["review", "resolve", "s", nId, "--status", "no-change", "--note", M_NOTE],
    0,
    `${prefix} \`review resolve s <n's item> --status no-change --note ` +
      `<text>\``,
  );
  const atResolve = `${prefix} after n's resolve`;
  const resolved = requireItem(
    (await exportSession(product, workspace, "s", atResolve)).items,
    "subtree-coherence",
    M_N,
    atResolve,
  );
  const currentAtResolve = JSON.stringify(resolved.current);
  const nAtResolve = await queryNode(product, workspace, M_N, atResolve);

  // n.c authored under n: n's subtreeHash changes (the premise), so n's
  // resolved item reads invalidated (10.4); n.c is `changed` (added, 5.6)
  // beneath the `changed` n, so skipped (10.5).
  await workspace.file(M_FILE, T10_5_5_M_CHILD_ADDED);
  await buildOk(product, workspace, `${prefix} \`build\` after authoring n.c`);
  const nWithChild = await queryNode(
    product,
    workspace,
    M_N,
    `${prefix} after authoring n.c`,
  );
  if (nWithChild.hashes.subtreeHash === nAtResolve.hashes.subtreeHash) {
    fail(
      `${prefix} staging premise: authoring n.c must change n's ` +
        `subtreeHash (SPEC 5.5: a node added to the subtree) — the change ` +
        `that invalidates n's resolved item (10.4)`,
    );
  }

  // Before the re-derivation: n's scope and origin as last assigned, at
  // `create` — n.c, authored since, in neither (10.4).
  const beforeLabel = `${prefix} before the re-derivation`;
  const before = requireItem(
    (await exportSession(product, workspace, "s", beforeLabel)).items,
    "subtree-coherence",
    M_N,
    beforeLabel,
  );
  assertSameJson(
    identitySet(requireScopeNodes(before, beforeLabel)),
    [M_N],
    `${beforeLabel}: reads present n's item's scope as last assigned, at ` +
      `\`create\` — exactly {n}, without n.c, authored after it (SPEC 10.4, ` +
      `10.7: every scope node presented); a product presenting the live ` +
      `subtree shows {n, n.c}`,
  );
  assertSameJson(
    identitySet(before.origin),
    [M_N],
    `${beforeLabel}: reads present n's item's origin as last assigned, at ` +
      `\`create\` — exactly {n}, without n.c (SPEC 10.4)`,
  );

  // v's `updated` resolve re-derives the session.
  await resolveOk(
    product,
    workspace,
    "s",
    vId,
    "updated",
    `${prefix} \`resolve --status updated\` of v's item — triggers ` +
      `re-derivation (SPEC 10.5)`,
  );
  const afterLabel = `${prefix} after the re-derivation`;
  const derived = await sessionStatus(product, workspace, "s", afterLabel);
  assertSameJson(
    kindScopeSequence(derived.items),
    [`subtree-coherence ${M_N}`, `subtree-coherence ${M_V}`],
    `${afterLabel}: the item set is unchanged — n's item matched, and n.c, ` +
      `newly \`changed\` beneath the \`changed\` n, skipped: no item scoped ` +
      `at it (SPEC 10.5)`,
  );
  const nRow = requireRow(derived, "subtree-coherence", M_N, afterLabel);
  if (nRow.id !== nId) {
    fail(
      `${afterLabel}: n's item, matched by kind and scope node, keeps its ` +
        `id (SPEC 10.5); expected ${nId}, got ${nRow.id}`,
    );
  }
  if (nRow.status !== "invalidated") {
    fail(
      `${afterLabel}: n's item reads invalidated — its stored status kept ` +
        `(SPEC 10.5: a matched item keeps its status), and n's subtreeHash ` +
        `changed since its resolve (10.4) — never unresolved; got ` +
        nRow.status,
    );
  }
  const after = requireItem(
    (await exportSession(product, workspace, "s", afterLabel)).items,
    "subtree-coherence",
    M_N,
    afterLabel,
  );
  if (after.id !== nId || after.status !== "invalidated") {
    fail(
      `${afterLabel}: \`export\` presents n's matched item with its id ` +
        `${nId}, reading invalidated (SPEC 10.4, 10.5); got ${after.id}, ` +
        after.status,
    );
  }
  if (after.note !== M_NOTE) {
    fail(
      `${afterLabel}: n's matched item keeps its note — the \`--note\` text ` +
        `of its resolve (SPEC 10.5: a matched item keeps its note); ` +
        `expected ${JSON.stringify(M_NOTE)}, got ` +
        (after.note === undefined ? "no note" : JSON.stringify(after.note)),
    );
  }
  const currentAfter = JSON.stringify(after.current);
  if (currentAfter !== currentAtResolve) {
    fail(
      `${afterLabel}: n's matched item keeps its recorded state — its ` +
        `\`current\` byte for byte as \`export\` presented it at n's ` +
        `resolve (SPEC 10.2, 10.5: a matched item keeps its recorded ` +
        `state; reads report it as recorded)\n` +
        `  at the resolve: ${currentAtResolve}\n` +
        `  now:            ${currentAfter}`,
    );
  }
  assertSameJson(
    identitySet(requireScopeNodes(after, afterLabel)),
    [M_N, M_NC].sort(),
    `${afterLabel}: n's matched item takes the generated scope — n and all ` +
      `its descendants, n.c now included (SPEC 10.5, 10.7: every scope ` +
      `node presented)`,
  );
  assertSameJson(
    identitySet(after.origin),
    [M_N, M_NC].sort(),
    `${afterLabel}: n's matched item takes the generated origin — the ` +
      `\`changed\` nodes in its scope, n.c (added) included (SPEC 5.6, 10.5)`,
  );
  assertStoredCounts(
    await listedStoredCounts(product, workspace, "s", afterLabel),
    { unresolved: 0, updated: 1, "no-change": 1, skipped: 0, invalidated: 0 },
    `${afterLabel}: n's item's stored status is kept — \`list\` counts it ` +
      `no-change, beside v's updated`,
  );
}

/**
 * T10.5-5's kept-blockedBy arm (the A/K1/V fixture, above): once a.k1's
 * edit is reverted (its ownHash back at its baseline value, the premise via
 * `query node`) and v's item resolved `updated`, a's parent-consistency
 * item and a.k1's subtree-coherence item, no longer generated, remain; a's
 * keeps `blockedBy` exactly a.k1's item in `export` — never recomputed — so
 * `status` reports it blocked while a.k1's item is unresolved, and its
 * `resolve` is refused in T10.7-14's form, nothing modified; once a.k1's
 * item is resolved, a's reads unblocked and resolves. A product recomputing
 * `blockedBy` for every item empties a's, unblocking it — which `next`
 * alone cannot show, a.k1's deeper item coming first (SPEC 10.3, 10.5,
 * 10.7).
 */
async function runKeptBlockedByArm(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.5-5 kept blockedBy";
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${prefix} \`build\` at the baseline`);
  const k1AtBaseline = await queryNode(
    product,
    workspace,
    KB_K1,
    `${prefix} baseline capture`,
  );
  await workspace.file(KB_FILE, T10_5_5_KB_EDITED);
  await buildOk(product, workspace, `${prefix} \`build\` after the edits`);
  await createBaseSession(product, workspace, base, "s", prefix);
  const created = await sessionStatus(product, workspace, "s", prefix);
  const sequence = [
    `subtree-coherence ${KB_K1}`,
    `subtree-coherence ${KB_V}`,
    `parent-consistency ${KB_A}`,
  ];
  assertSameJson(
    kindScopeSequence(created.items),
    sequence,
    `${prefix} staging premise: a.k1's and v's edits yield a.k1's and v's ` +
      `subtree-coherence items and a's parent-consistency item, in item ` +
      `order (SPEC 10.5)`,
  );
  const k1Id = requireRow(created, "subtree-coherence", KB_K1, prefix).id;
  const vId = requireRow(created, "subtree-coherence", KB_V, prefix).id;
  const aId = requireRow(created, "parent-consistency", KB_A, prefix).id;
  assertBlockedBy(
    requireItem(
      (await exportSession(product, workspace, "s", prefix)).items,
      "parent-consistency",
      KB_A,
      prefix,
    ),
    [k1Id],
    `${prefix} staging premise: a's parent-consistency item is blocked by ` +
      `a.k1's subtree-coherence item, a.k1 visited (SPEC 10.5)`,
  );

  // a.k1's edit reverted: neither a.k1's item nor a's generates any longer.
  await workspace.file(KB_FILE, T10_5_5_KB_K1_REVERTED);
  await buildOk(
    product,
    workspace,
    `${prefix} \`build\` after reverting a.k1's edit`,
  );
  const k1Reverted = await queryNode(
    product,
    workspace,
    KB_K1,
    `${prefix} after the revert`,
  );
  if (k1Reverted.hashes.ownHash !== k1AtBaseline.hashes.ownHash) {
    fail(
      `${prefix} staging premise: reverting a.k1's edit must restore its ` +
        `ownHash to its baseline value (SPEC 5.5), so a.k1 is no longer ` +
        `\`changed\` (5.6) and neither a.k1's item nor a's generates (10.5)`,
    );
  }
  await resolveOk(
    product,
    workspace,
    "s",
    vId,
    "updated",
    `${prefix} \`resolve --status updated\` of v's item — triggers ` +
      `re-derivation (SPEC 10.5)`,
  );
  const afterLabel = `${prefix} after the re-derivation`;
  const derived = await sessionStatus(product, workspace, "s", afterLabel);
  assertSameJson(
    kindScopeSequence(derived.items),
    sequence,
    `${afterLabel}: items no longer generated remain — a.k1's and a's, ` +
      `beside v's matched item (SPEC 10.5)`,
  );
  for (const [id, kind, scope] of [
    [k1Id, "subtree-coherence", KB_K1],
    [vId, "subtree-coherence", KB_V],
    [aId, "parent-consistency", KB_A],
  ] as const) {
    if (requireRow(derived, kind, scope, afterLabel).id !== id) {
      fail(
        `${afterLabel}: the ${kind} item scoped at ${scope} keeps its id ` +
          `${id} across the re-derivation (SPEC 10.5)`,
      );
    }
  }
  const aRow = requireRow(derived, "parent-consistency", KB_A, afterLabel);
  if (aRow.status !== "unresolved" || !aRow.blocked) {
    fail(
      `${afterLabel}: \`status\` reports a's item unresolved and blocked — ` +
        `its kept blockedBy names a.k1's item, which is unresolved (SPEC ` +
        `10.3, 10.5); a product recomputing blockedBy for every item ` +
        `empties a's, unblocking it; got ${aRow.status}, blocked ` +
        String(aRow.blocked),
    );
  }
  const k1Row = requireRow(derived, "subtree-coherence", KB_K1, afterLabel);
  if (k1Row.status !== "unresolved" || k1Row.blocked) {
    fail(
      `${afterLabel}: a.k1's item, no longer generated either, stays ` +
        `unresolved and unblocked, its blockedBy empty (SPEC 10.3, 10.5); ` +
        `got ${k1Row.status}, blocked ${String(k1Row.blocked)}`,
    );
  }
  assertBlockedBy(
    requireItem(
      (await exportSession(product, workspace, "s", afterLabel)).items,
      "parent-consistency",
      KB_A,
      afterLabel,
    ),
    [k1Id],
    `${afterLabel}: a's item, no longer generated, keeps its blockedBy ` +
      `exactly a.k1's item — never recomputed, which would empty it (SPEC ` +
      `10.5)`,
  );
  await expectReviewRefusal(
    product,
    workspace,
    ["review", "resolve", "s", aId, "--status", "no-change"],
    KB_SESSION_FILE,
    `${prefix} [resolve of a's item, blocked by a.k1's unresolved item ` +
      `through its kept blockedBy]`,
    { nothingModified: true },
  );
  await resolveOk(
    product,
    workspace,
    "s",
    k1Id,
    "no-change",
    `${prefix} \`resolve --status no-change\` of a.k1's item (unblocked: ` +
      `its blockedBy empty)`,
  );
  const unblockedLabel = `${prefix} once a.k1's item is resolved`;
  const unblocked = await sessionStatus(
    product,
    workspace,
    "s",
    unblockedLabel,
  );
  const aUnblocked = requireRow(
    unblocked,
    "parent-consistency",
    KB_A,
    unblockedLabel,
  );
  if (aUnblocked.status !== "unresolved" || aUnblocked.blocked) {
    fail(
      `${unblockedLabel}: a's item reads unresolved and unblocked — every ` +
        `item in its blockedBy resolved (SPEC 10.3); got ` +
        `${aUnblocked.status}, blocked ${String(aUnblocked.blocked)}`,
    );
  }
  await resolveOk(
    product,
    workspace,
    "s",
    aId,
    "no-change",
    `${unblockedLabel} \`resolve --status no-change\` of a's item — ` +
      `unblocked, it resolves (SPEC 10.3, 10.7)`,
  );
  await expectItemStatus(
    product,
    workspace,
    "s",
    aId,
    "no-change",
    `${unblockedLabel}: a's item resolved`,
  );
}

/**
 * T10.5-5's skipping arm (the P/Q fixture, above): p's own text edited
 * before `create --base` (p's item, origin {p}), p.q's text after it; p's
 * `updated` resolve re-derives the session, and p.q — newly `changed`
 * beneath the `changed` p — is skipped and gets no item, p's item now with
 * origin exactly {p, p.q}. A product adding an item per newly `changed`
 * node gives p.q one (SPEC 5.6, 10.5).
 */
async function runSkippingArm(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.5-5 skipping";
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await workspace.file(T10_5_5_PQ_FILE, T10_5_5_PQ_P_EDITED);
  await buildOk(product, workspace, `${prefix} \`build\` after p's edit`);
  await createBaseSession(product, workspace, base, "s", prefix);
  const created = await sessionStatus(product, workspace, "s", prefix);
  assertSameJson(
    kindScopeSequence(created.items),
    [`subtree-coherence ${PQ_P}`],
    `${prefix} staging premise: p's edit yields p's subtree-coherence ` +
      `item alone, p's parent the root (SPEC 10.5)`,
  );
  const pId = requireRow(created, "subtree-coherence", PQ_P, prefix).id;
  assertSameJson(
    identitySet(
      requireItem(
        (await exportSession(product, workspace, "s", prefix)).items,
        "subtree-coherence",
        PQ_P,
        prefix,
      ).origin,
    ),
    [PQ_P],
    `${prefix} staging premise: p's item's origin is exactly {p}, p.q not ` +
      `yet edited (SPEC 10.5)`,
  );
  await workspace.file(T10_5_5_PQ_FILE, T10_5_5_PQ_BOTH_EDITED);
  await buildOk(product, workspace, `${prefix} \`build\` after p.q's edit`);
  await resolveOk(
    product,
    workspace,
    "s",
    pId,
    "updated",
    `${prefix} \`resolve --status updated\` of p's item — triggers ` +
      `re-derivation (SPEC 10.5)`,
  );
  const afterLabel = `${prefix} after the re-derivation`;
  const derived = await sessionStatus(product, workspace, "s", afterLabel);
  assertSameJson(
    kindScopeSequence(derived.items),
    [`subtree-coherence ${PQ_P}`],
    `${afterLabel}: no item scoped at p.q — newly \`changed\` beneath the ` +
      `\`changed\` p, it is skipped and gets none (SPEC 10.5); a product ` +
      `adding an item per newly changed node gives p.q one`,
  );
  const pRow = requireRow(derived, "subtree-coherence", PQ_P, afterLabel);
  if (pRow.id !== pId || pRow.status !== "updated") {
    fail(
      `${afterLabel}: p's item, matched, keeps its id ${pId} and reads ` +
        `updated — its resolve recorded against the item as re-derived ` +
        `(SPEC 10.4, 10.5); got ${pRow.id}, ${pRow.status}`,
    );
  }
  assertSameJson(
    identitySet(
      requireItem(
        (await exportSession(product, workspace, "s", afterLabel)).items,
        "subtree-coherence",
        PQ_P,
        afterLabel,
      ).origin,
    ),
    [PQ_P, PQ_Q].sort(),
    `${afterLabel}: p's item takes the generated origin exactly {p, p.q} — ` +
      `the \`changed\` nodes in its scope, the skipped p.q included (SPEC ` +
      `10.5)`,
  );
}

/**
 * T10.5-5's newly-visited arm (the P/Q fixture, above;
 * `stageT1055NewlyVisitedQ` stages it): once p's edit is reverted and p.q
 * edited again, p's `updated` resolve re-derives the session and p.q —
 * newly visited, its `changed` ancestor reverted — gains its
 * subtree-coherence item, and p its parent-consistency item (context and
 * origin exactly {p.q}, blockedBy p.q's item), both entering `unresolved`
 * with fresh ids — the trigger's `updated` never propagating — while p's
 * subtree-coherence item, no longer generated, remains (SPEC 10.2, 10.5).
 */
async function runNewlyVisitedArm(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.5-5 newly visited";
  const { pId } = await stageT1055NewlyVisitedQ(product, workspace, prefix);
  const afterLabel = `${prefix} after the re-derivation`;
  const derived = await sessionStatus(product, workspace, "s", afterLabel);
  assertSameJson(
    kindScopeSequence(derived.items),
    [
      `subtree-coherence ${PQ_Q}`,
      `subtree-coherence ${PQ_P}`,
      `parent-consistency ${PQ_P}`,
    ],
    `${afterLabel}: p.q, newly visited once its \`changed\` ancestor p ` +
      `reverted, gains its subtree-coherence item and p its ` +
      `parent-consistency item, each in its place in item order, beside ` +
      `p's subtree-coherence item, which no longer generates and remains ` +
      `(SPEC 10.5)`,
  );
  const pRow = requireRow(derived, "subtree-coherence", PQ_P, afterLabel);
  const qRow = requireRow(derived, "subtree-coherence", PQ_Q, afterLabel);
  const pcRow = requireRow(derived, "parent-consistency", PQ_P, afterLabel);
  if (pRow.id !== pId) {
    fail(
      `${afterLabel}: p's subtree-coherence item, no longer generated, ` +
        `remains with its id (SPEC 10.5); expected ${pId}, got ${pRow.id}`,
    );
  }
  if (new Set([pId, qRow.id, pcRow.id]).size !== 3) {
    fail(
      `${afterLabel}: the new items' ids must be fresh (SPEC 10.2); got ` +
        `p.q's ${qRow.id} and p's parent-consistency ${pcRow.id} beside ` +
        `p's ${pId}`,
    );
  }
  for (const [row, what] of [
    [qRow, "p.q's subtree-coherence item"],
    [pcRow, "p's parent-consistency item"],
  ] as const) {
    if (row.status !== "unresolved") {
      fail(
        `${afterLabel}: ${what} is created unresolved (SPEC 10.2) — the ` +
          `triggering item's \`updated\` status must not propagate to it; ` +
          `got ${row.status}`,
      );
    }
  }
  const pc = requireItem(
    (await exportSession(product, workspace, "s", afterLabel)).items,
    "parent-consistency",
    PQ_P,
    afterLabel,
  );
  assertSameJson(
    identitySet(pc.context),
    [PQ_Q],
    `${afterLabel}: p's new parent-consistency item's context is exactly ` +
      `{p.q} — the changed branch beneath p, entering as its head (SPEC ` +
      `10.5)`,
  );
  assertSameJson(
    identitySet(pc.origin),
    [PQ_Q],
    `${afterLabel}: p's new parent-consistency item's origin is exactly ` +
      `{p.q} — the \`changed\` nodes in p's subtree, p no longer one (SPEC ` +
      `5.6, 10.5)`,
  );
  assertBlockedBy(
    pc,
    [qRow.id],
    `${afterLabel}: p's new parent-consistency item — blocked by p.q's ` +
      `subtree-coherence item, p.q visited`,
  );
}

const T10_5_5 = defineProductTest({
  id: "T10.5-5",
  title:
    "re-derivation on `updated`: resolving with no-change/skipped does not re-derive — after a sibling-subtree edit the item set is unchanged and the edit surfaces as read-time invalidation of the resolved parent-consistency item (context-set change with hash premises), not as new items; an `updated` resolve re-derives with the recorded baseline — the newly changed sibling's subtree-coherence item appears in item order created `unresolved` (the trigger's `updated` does not propagate), a matching kind+scope item keeps its id, status, note, and recorded state and takes the generated scope, context, and origin, and blockedBy is recomputed; items no longer generated (after reverting their edit) remain with their blockedBy and present their context as last assigned, by show and export after the re-derivation; after two nested `split`s a decomposed kind+scope is never re-added — its decomposition applies recursively, a child authored after the splits entering `unresolved` and joining the decomposition's parent-consistency item's context and blockedBy — and every blockedBy reference to a decomposed item is replaced by all items of its decomposition; matching: with two visited top-level sections n and v, n's item, resolved `no-change` with a note before a child n.c is authored under it, keeps its id, its note, and its `current` byte for byte through v's `updated` resolve, presents its scope and origin exactly {n} before that re-derivation (as last assigned) and exactly {n, n.c} after it — every scope node presented — and reads `invalidated`, never `unresolved`, `list` counting it `no-change`, n.c skipped with no item; kept blockedBy: with a top-level a holding a.k1, and a top-level v, a.k1's and v's texts edited before `create`, then a.k1's edit reverted and v's item resolved `updated`, a's parent-consistency item, no longer generated, keeps blockedBy exactly a.k1's item in `export`, `status` reports it blocked, its `resolve` is refused in T10.7-14's form with nothing modified, and once a.k1's item is resolved it reads unblocked and resolves; skipping: with a top-level p holding p.q, p's own text edited before `create` and p.q's after it, p's `updated` resolve adds no item scoped at p.q, p's item now with origin exactly {p, p.q}; newly visited: with p's and p.q's texts both edited before `create`, then p.q's edited again and p's edit reverted, p's `updated` resolve adds p.q's subtree-coherence item and p's parent-consistency item (context and origin exactly {p.q}, blockedBy p.q's item), both `unresolved` with fresh ids, p's subtree-coherence item remaining (SPEC 10.2, 10.3, 10.4, 10.5, 10.7)",
  run: async (product) => {
    // --- sub-fixture A: derivation basics ------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [W_FILE]: wSpec("Paa text v0.", "Pab text v0.", "Arc text v0.") },
      async (workspace) => {
        const prefix = "T10.5-5 re-derivation";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(
          W_FILE,
          wSpec("Paa text v1.", "Pab text v0.", "Arc text v1."),
        );
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the edits`,
        );
        await createBaseSession(product, workspace, base, "s", prefix);

        const initial = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSequence(initial.items),
          [
            `subtree-coherence ${W_PA}`,
            `subtree-coherence ${W_RC}`,
            `parent-consistency ${W_P}`,
            `parent-consistency ${W_R}`,
          ],
          `${prefix}: the two changed leaves yield their subtree-coherence ` +
            `items and their parents' parent-consistency items, in item ` +
            `order (SPEC 10.5)`,
        );
        const scPA = requireRow(initial, "subtree-coherence", W_PA, prefix).id;
        const scRC = requireRow(initial, "subtree-coherence", W_RC, prefix).id;
        const pcP = requireRow(initial, "parent-consistency", W_P, prefix).id;
        const pcR = requireRow(initial, "parent-consistency", W_R, prefix).id;

        await resolveOk(
          product,
          workspace,
          "s",
          scPA,
          "no-change",
          `${prefix} resolve of p.a's subtree-coherence item (the blocker)`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          pcP,
          "no-change",
          `${prefix} resolve of p's parent-consistency item (context {p.a})`,
        );

        // The sibling-subtree edit, with hash premises: p's own/metadata
        // hashes and p.a's subtreeHash must be untouched (SPEC 5.5), so any
        // invalidation of p's item can only come from the context-set change.
        const probes = [W_P, W_PA, W_PB];
        const before = await captureHashes(
          product,
          workspace,
          probes,
          `${prefix} pre-edit capture`,
        );
        await workspace.file(W_FILE, T10_5_5_W_PB_EDITED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the p.b edit`,
        );
        const after = await captureHashes(
          product,
          workspace,
          probes,
          `${prefix} post-edit capture`,
        );
        for (const [node, hash] of [
          [W_P, "ownHash"],
          [W_P, "metadataHash"],
          [W_PA, "subtreeHash"],
        ] as const) {
          if (before.get(node)?.[hash] !== after.get(node)?.[hash]) {
            fail(
              `${prefix} staging premise: the p.b edit must leave ${node}'s ` +
                `${hash} unchanged (SPEC 5.5) so invalidation can only come ` +
                `from the context-set change`,
            );
          }
        }
        if (before.get(W_PB)?.subtreeHash === after.get(W_PB)?.subtreeHash) {
          fail(
            `${prefix} staging premise: the p.b edit must change p.b's ` +
              `subtreeHash (SPEC 5.5) — otherwise no new changed branch exists`,
          );
        }

        // A non-updated resolve after the edit re-derives nothing: the item
        // set is unchanged (no item for p.b), and the concurrent edit
        // surfaces as invalidation of p's resolved item.
        await resolveOk(
          product,
          workspace,
          "s",
          scRC,
          "skipped",
          `${prefix} \`resolve --status skipped\` after the p.b edit — ` +
            `no-change/skipped resolves do not re-derive (SPEC 10.5)`,
        );
        const preDerive = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(preDerive),
          [
            `parent-consistency ${W_P}`,
            `parent-consistency ${W_R}`,
            `subtree-coherence ${W_PA}`,
            `subtree-coherence ${W_RC}`,
          ].sort(),
          `${prefix}: after the sibling-subtree edit and a skipped resolve ` +
            `the item set is unchanged — sibling subtrees enter only ` +
            `through re-derivation, and neither reads nor ` +
            `no-change/skipped resolves re-derive (SPEC 10.5)`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          pcP,
          "invalidated",
          `${prefix}: the concurrent workspace edit surfaces as read-time ` +
            `invalidation of p's resolved parent-consistency item — its ` +
            `generator-derived context set gained the p.b branch while ` +
            `every recorded hash is unchanged (SPEC 10.4, 10.5)`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          scPA,
          "no-change",
          `${prefix}: p.a's resolved item is untouched by the p.b edit ` +
            `(SPEC 10.4)`,
        );

        // The `updated` resolve of r's item re-derives the session.
        await resolveOk(
          product,
          workspace,
          "s",
          pcR,
          "updated",
          `${prefix} \`resolve --status updated\` of r's parent-consistency ` +
            `item (unblocked: r.c is resolved) — triggers re-derivation ` +
            `(SPEC 10.5)`,
        );
        const derived = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSequence(derived.items),
          [
            `subtree-coherence ${W_PA}`,
            `subtree-coherence ${W_PB}`,
            `subtree-coherence ${W_RC}`,
            `parent-consistency ${W_P}`,
            `parent-consistency ${W_R}`,
          ],
          `${prefix} after the updated resolve: the newly changed p.b's ` +
            `subtree-coherence item takes its place in item order ` +
            `(SPEC 10.5)`,
        );
        const scPB = requireRow(derived, "subtree-coherence", W_PB, prefix);
        if ([scPA, scRC, pcP, pcR].includes(scPB.id)) {
          fail(
            `${prefix}: the new p.b item's id must be fresh (SPEC 10.2); ` +
              `got ${scPB.id}, colliding with an existing item id`,
          );
        }
        if (scPB.status !== "unresolved") {
          fail(
            `${prefix}: a newly generated item is created unresolved ` +
              `(SPEC 10.2) — the triggering item's \`updated\` status must ` +
              `not propagate to it; got ${scPB.status}`,
          );
        }
        // Matching items keep id, status, note, and recorded state (SPEC
        // 10.5).
        if (
          requireRow(derived, "subtree-coherence", W_PA, prefix).id !== scPA
        ) {
          fail(
            `${prefix}: p.a's item keeps its id across the re-derivation ` +
              `(SPEC 10.5)`,
          );
        }
        await expectItemStatus(
          product,
          workspace,
          "s",
          scPA,
          "no-change",
          `${prefix}: p.a's matching item keeps its status and recorded ` +
            `state across the re-derivation (SPEC 10.5)`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          scRC,
          "skipped",
          `${prefix}: r.c's matching item keeps its skipped status ` +
            `(SPEC 10.5)`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          pcR,
          "updated",
          `${prefix}: the trigger item keeps its just-resolved updated ` +
            `status — its context {r.c} did not change (SPEC 10.4, 10.5)`,
        );
        await expectItemStatus(
          product,
          workspace,
          "s",
          pcP,
          "invalidated",
          `${prefix}: p's item — resolved, with a context set that changed ` +
            `— is invalidated (SPEC 10.4, 10.5)`,
        );
        const derivedExport = await exportSession(
          product,
          workspace,
          "s",
          prefix,
        );
        assertBlockedBy(
          requireItem(derivedExport.items, "parent-consistency", W_P, prefix),
          [scPA, scPB.id],
          `${prefix} after the re-derivation, p's parent-consistency item ` +
            `— blockedBy is recomputed per branch`,
        );
        assertBlockedBy(
          requireItem(derivedExport.items, "parent-consistency", W_R, prefix),
          [scRC],
          `${prefix} after the re-derivation, r's parent-consistency item`,
        );
        assertSameJson(
          identitySet(
            requireItem(derivedExport.items, "parent-consistency", W_P, prefix)
              .context,
          ),
          [W_PA, W_PB].sort(),
          `${prefix}: p's matched item's context set is updated to the ` +
            `union of changed branches (SPEC 10.5)`,
        );

        // Revert r.c to its baseline text: r's family stops generating.
        await workspace.file(W_FILE, T10_5_5_W_RC_REVERTED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after reverting r.c`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          scPB.id,
          "updated",
          `${prefix} \`resolve --status updated\` of p.b's item — a second ` +
            `re-derivation, now generating nothing for r (SPEC 10.5)`,
        );
        const final = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(final),
          [
            `parent-consistency ${W_P}`,
            `parent-consistency ${W_R}`,
            `subtree-coherence ${W_PA}`,
            `subtree-coherence ${W_PB}`,
            `subtree-coherence ${W_RC}`,
          ].sort(),
          `${prefix}: items no longer generated remain in the session ` +
            `(SPEC 10.5)`,
        );
        const finalExport = await exportSession(
          product,
          workspace,
          "s",
          prefix,
        );
        assertBlockedBy(
          requireItem(finalExport.items, "parent-consistency", W_R, prefix),
          [scRC],
          `${prefix}: r's no-longer-generated item keeps its blockedBy ` +
            `(SPEC 10.5)`,
        );
        assertSameJson(
          identitySet(
            requireItem(finalExport.items, "parent-consistency", W_R, prefix)
              .context,
          ),
          [W_RC],
          `${prefix}: r's no-longer-generated item presents its context as ` +
            `last assigned — {r.c}, assigned at its own \`updated\` resolve ` +
            `once the re-derivation it triggered was done, and unchanged by ` +
            `the second re-derivation, which no longer generates it (SPEC ` +
            `10.4, 10.5)`,
        );
        const shownPcR = await showItem(
          product,
          workspace,
          "s",
          pcR,
          `${prefix} post-re-derivation`,
        );
        assertSameJson(
          identitySet(shownPcR.context),
          [W_RC],
          `${prefix}: \`show\` presents that context as last assigned too ` +
            `(SPEC 10.4, 10.5)`,
        );
      },
    );

    // --- sub-fixture B: split decompositions govern re-derivation ------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [V_FILE]: T10_5_5_V_INITIAL },
      async (workspace) => {
        const prefix = "T10.5-5 decomposition";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(V_FILE, T10_5_5_V_GA_EDITED);
        await buildOk(product, workspace, `${prefix} \`build\` after the edit`);
        await createBaseSession(product, workspace, base, "s", prefix);

        const initial = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(initial),
          [`parent-consistency ${V_G}`, `subtree-coherence ${V_GA}`].sort(),
          `${prefix}: g.a's edit yields its subtree-coherence item and g's ` +
            `parent-consistency item (SPEC 10.5)`,
        );
        const scGA = requireRow(initial, "subtree-coherence", V_GA, prefix).id;
        const pcG = requireRow(initial, "parent-consistency", V_G, prefix).id;

        // First split: g.a's item decomposes into its child items plus g.a's
        // parent-consistency item (SPEC 10.7).
        await expectExit(
          product,
          workspace,
          ["review", "split", "s", scGA],
          0,
          `${prefix} \`review split s <g.a item>\``,
        );
        const afterSplit1 = await sessionStatus(
          product,
          workspace,
          "s",
          prefix,
        );
        assertSameJson(
          kindScopeSet(afterSplit1),
          [
            `parent-consistency ${V_G}`,
            `parent-consistency ${V_GA}`,
            `subtree-coherence ${V_GAX}`,
            `subtree-coherence ${V_GAY}`,
          ].sort(),
          `${prefix} after the first split: one subtree-coherence item per ` +
            `child subtree plus g.a's parent-consistency item; the original ` +
            `is removed (SPEC 10.7)`,
        );
        const scX = requireRow(
          afterSplit1,
          "subtree-coherence",
          V_GAX,
          prefix,
        ).id;
        const scY = requireRow(
          afterSplit1,
          "subtree-coherence",
          V_GAY,
          prefix,
        ).id;
        const pcGA = requireRow(
          afterSplit1,
          "parent-consistency",
          V_GA,
          prefix,
        ).id;

        // Second split: g.a.x's item decomposes in turn.
        await expectExit(
          product,
          workspace,
          ["review", "split", "s", scX],
          0,
          `${prefix} \`review split s <g.a.x item>\``,
        );
        const afterSplit2 = await sessionStatus(
          product,
          workspace,
          "s",
          prefix,
        );
        const scK = requireRow(
          afterSplit2,
          "subtree-coherence",
          V_GAXK,
          prefix,
        ).id;
        const pcGAX = requireRow(
          afterSplit2,
          "parent-consistency",
          V_GAX,
          prefix,
        ).id;

        // Author a new child g.a.z after the splits (SPEC 6.6, a manual
        // edit): it enters only through the decomposition applied at
        // re-derivation — g.a.z itself is a changed node with the changed
        // ancestor g.a, so rule 1 skips it.
        await workspace.file(V_FILE, T10_5_5_V_WITH_Z);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after authoring g.a.z`,
        );

        // The `updated` resolve re-derives: the generated subtree-coherence
        // item for g.a is never re-added — its recorded decomposition
        // applies instead, recursively through g.a.x's decomposition, over
        // the current child subtrees (g.a.z included).
        await resolveOk(
          product,
          workspace,
          "s",
          scK,
          "updated",
          `${prefix} \`resolve --status updated\` of g.a.x.k's item — ` +
            `triggers re-derivation (SPEC 10.5)`,
        );
        const derived = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSequence(derived.items),
          [
            `subtree-coherence ${V_GAXK}`,
            `subtree-coherence ${V_GAY}`,
            `subtree-coherence ${V_GAZ}`,
            `parent-consistency ${V_GAX}`,
            `parent-consistency ${V_GA}`,
            `parent-consistency ${V_G}`,
          ],
          `${prefix} after the re-derivation: no subtree-coherence item for ` +
            `g.a or g.a.x is re-added (their decompositions apply, ` +
            `recursively); g.a.z's item — one per current child subtree of ` +
            `the decomposed scope — takes its place in item order ` +
            `(SPEC 10.5, 10.7)`,
        );
        const scZ = requireRow(derived, "subtree-coherence", V_GAZ, prefix);
        const priorIds = [scGA, pcG, scX, scY, pcGA, scK, pcGAX];
        if (priorIds.includes(scZ.id)) {
          fail(
            `${prefix}: g.a.z's item id must be fresh — removed ids are ` +
              `never reused (SPEC 10.7); got ${scZ.id}`,
          );
        }
        if (scZ.status !== "unresolved") {
          fail(
            `${prefix}: g.a.z's item is created unresolved (SPEC 10.2); ` +
              `got ${scZ.status}`,
          );
        }
        for (const [id, node] of [
          [scK, V_GAXK],
          [scY, V_GAY],
          [pcGA, V_GA],
          [pcGAX, V_GAX],
          [pcG, V_G],
        ] as const) {
          const rows = derived.items.filter((row) => row.id === id);
          if (rows.length !== 1 || rows[0].scope !== node) {
            fail(
              `${prefix}: the existing item ${id} (scope ${node}) is ` +
                `matched and kept by the re-derivation (SPEC 10.5); rows: ` +
                JSON.stringify(rows),
            );
          }
        }

        const exported = await exportSession(product, workspace, "s", prefix);
        // blockedBy recomputation with decomposed references replaced by
        // their decompositions, recursively (SPEC 10.5, 10.7): g's item is
        // blocked by every item of g.a's recursive decomposition; g.a's
        // parent-consistency item by the current child items (g.a.x's
        // replaced by its decomposition); g.a.x's by its child item.
        assertBlockedBy(
          requireItem(exported.items, "parent-consistency", V_G, prefix),
          [scK, pcGAX, scY, scZ.id, pcGA],
          `${prefix} g's parent-consistency item — the reference to g.a's ` +
            `decomposed subtree-coherence item is replaced by all items of ` +
            `its decomposition, recursively`,
        );
        assertBlockedBy(
          requireItem(exported.items, "parent-consistency", V_GA, prefix),
          [scK, pcGAX, scY, scZ.id],
          `${prefix} g.a's parent-consistency item — blocked by the current ` +
            `child subtrees' items, g.a.x's entering via its decomposition`,
        );
        assertBlockedBy(
          requireItem(exported.items, "parent-consistency", V_GAX, prefix),
          [scK],
          `${prefix} g.a.x's parent-consistency item — blocked by its child ` +
            `subtree's item`,
        );
        // The decomposition's parent-consistency item gains the new child in
        // its context as well (SPEC 10.5, 10.7: the scope node's
        // parent-consistency item, whose context is its children at the
        // re-derivation): g.a.z beside g.a.x and g.a.y.
        assertSameJson(
          identitySet(
            requireItem(exported.items, "parent-consistency", V_GA, prefix)
              .context,
          ),
          [V_GAX, V_GAY, V_GAZ].sort(),
          `${prefix} g.a's parent-consistency item after the re-derivation: ` +
            `its context is g.a's children at the re-derivation, the child ` +
            `g.a.z authored after the splits included — the decomposition ` +
            `applied, its parent-consistency item's context the scope ` +
            `node's children (SPEC 10.5, 10.7)`,
        );
      },
    );

    // --- the matching arm: N/V -------------------------------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [M_FILE]: T10_5_5_M_INITIAL },
      async (workspace) => {
        await runMatchingArm(product, workspace);
      },
    );

    // --- items no longer generated keep blockedBy: A/K1/V ------------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [KB_FILE]: T10_5_5_KB_INITIAL },
      async (workspace) => {
        await runKeptBlockedByArm(product, workspace);
      },
    );

    // --- the skipping arm: P edited before `create`, Q after ---------------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      T10_5_5_PQ_INITIAL_FILES,
      async (workspace) => {
        await runSkippingArm(product, workspace);
      },
    );

    // --- the newly-visited arm: P's edit reverted, Q edited again ----------
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      T10_5_5_PQ_INITIAL_FILES,
      async (workspace) => {
        await runNewlyVisitedArm(product, workspace);
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.5-6 — baseline recording
// ---------------------------------------------------------------------------

const C6_FILE = "specs/C.mdx";
const C6_PAR = "specs/C.mdx#par";
const C6_K = "specs/C.mdx#par.k";
const C6_S = "specs/C.mdx#par.s";

function c6Spec(kText: string, sText: string): string {
  return [
    '<S id="par">',
    "Par own text.",
    "",
    '<S id="par.k">',
    kText,
    "</S>",
    "",
    '<S id="par.s">',
    sText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// The par.s edit follows the body's first `build`, so it is a staged-source
// record (helpers/staged-mdx.ts, S-9: judged before any product exists); the
// par.k edit precedes it and stays plain.
const T10_5_6_C_PAR_S_EDITED = stagedMdx(
  "T10.5-6 specs/C.mdx with par.k and par.s both at v1 (the post-decoy edit)",
  c6Spec("Kay text v1.", "Ess text v1."),
);

const T10_5_6 = defineProductTest({
  id: "T10.5-6",
  title:
    "baseline recording: the session records the commit identity `--base` resolved to at creation — after the session is created against a branch, the branch is renamed away and a decoy branch reusing the name is planted at a later commit (and HEAD moves past the reviewed edit), yet re-derivation on an `updated` resolve still diffs against the recorded commit: the parent-consistency item's recomputed context and blockedBy cover both changed branches (the pre-decoy edit included), where a product re-resolving the ref spelling or using HEAD would see only the newer edit (SPEC 6.3, 10.5, 10.7)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [C6_FILE]: c6Spec("Kay text v0.", "Ess text v0.") },
      async (workspace) => {
        const prefix = "T10.5-6";
        await workspace.gitInit();
        const c1 = await workspace.gitCommitAll("baseline");
        await workspace.git(["branch", "mark"]);

        await workspace.file(C6_FILE, c6Spec("Kay text v1.", "Ess text v0."));
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the par.k edit`,
        );
        await createBaseSession(product, workspace, "mark", "s", prefix);
        const initial = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(initial),
          [`parent-consistency ${C6_PAR}`, `subtree-coherence ${C6_K}`].sort(),
          `${prefix}: the par.k edit against the mark baseline yields its ` +
            `subtree-coherence item and par's parent-consistency item ` +
            `(SPEC 10.5)`,
        );
        const scK = requireRow(initial, "subtree-coherence", C6_K, prefix).id;
        const pcPar = requireRow(
          initial,
          "parent-consistency",
          C6_PAR,
          prefix,
        ).id;

        // HEAD movement: commit the reviewed edit; then rename the baseline
        // branch away and plant a decoy branch reusing the name at the new
        // commit. A product that recorded the ref spelling instead of the
        // resolved commit identity now resolves `mark` to c2.
        const c2 = await workspace.gitCommitAll("advance");
        if (c2 === c1) {
          fail(
            `${prefix} staging premise: the advance commit must differ from ` +
              `the baseline commit`,
          );
        }
        await workspace.git(["branch", "-m", "mark", "mark-elsewhere"]);
        await workspace.git(["branch", "mark"]);
        const resolved = (
          await workspace.git(["rev-parse", "mark"])
        ).stdout.trim();
        if (resolved !== c2) {
          fail(
            `${prefix} staging premise: after the rename and re-plant, the ` +
              `ref spelling "mark" must resolve to the advance commit ` +
              `${c2}; git reports ${resolved}`,
          );
        }

        // A second changed branch, then the updated resolve: re-derivation
        // runs the generators against the recorded commit (c1), under which
        // par.k and par.s are both changed. Against the decoy `mark` or
        // HEAD (both c2), par.k's committed edit is invisible.
        await workspace.file(C6_FILE, T10_5_6_C_PAR_S_EDITED);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after the par.s edit`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          scK,
          "updated",
          `${prefix} \`resolve --status updated\` of par.k's item — ` +
            `triggers re-derivation against the recorded baseline ` +
            `(SPEC 10.5, 10.7)`,
        );

        const derived = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSequence(derived.items),
          [
            `subtree-coherence ${C6_K}`,
            `subtree-coherence ${C6_S}`,
            `parent-consistency ${C6_PAR}`,
          ],
          `${prefix} after the re-derivation: par.s's item enters in item ` +
            `order (SPEC 10.5)`,
        );
        const scS = requireRow(derived, "subtree-coherence", C6_S, prefix);
        if (scS.status !== "unresolved") {
          fail(
            `${prefix}: par.s's new item is created unresolved (SPEC 10.2); ` +
              `got ${scS.status}`,
          );
        }
        const exported = await exportSession(product, workspace, "s", prefix);
        const pcItem = requireItem(
          exported.items,
          "parent-consistency",
          C6_PAR,
          prefix,
        );
        if (
          pcItem.id !== pcPar ||
          exported.items.filter((item) => item.id === scK).length !== 1
        ) {
          fail(
            `${prefix}: the existing items keep their ids across the ` +
              `re-derivation (SPEC 10.5)`,
          );
        }
        assertSameJson(
          identitySet(pcItem.context),
          [C6_K, C6_S].sort(),
          `${prefix}: par's recomputed context covers both changed branches ` +
            `— the generators ran against the recorded commit, not the ` +
            `moved HEAD or the decoy ref now bearing the --base spelling ` +
            `(SPEC 6.3, 10.5, 10.7: later HEAD movement or branch renames ` +
            `do not change what generators run against)`,
        );
        assertBlockedBy(
          pcItem,
          [scK, scS.id],
          `${prefix} par's parent-consistency item after the re-derivation ` +
            `— one blocker per changed branch relative to the recorded ` +
            `commit`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.5-7 — embedding edges and a root-sourced embedding
// ---------------------------------------------------------------------------

// TEST-SPEC T10.5-7's fixture, as its entry stages it. specs/B.mdx holds the
// top-level t. specs/A.mdx imports ./B.xspec as B and holds three
// constructs: a top-level {text(B.t)} outside every section — a root-sourced
// embeds edge A's root → t, staged as T8-5 stages one (SPEC 2.3) — a section
// e holding only {text(B.t)}, an embeds edge its sole dependency edge, and a
// section f spelled d={B.t} and holding {text(B.t)}, a depends and an embeds
// edge to one target. src/show.ts imports ../specs/B.xspec with its `text`
// export and calls text(B.t) in the function show; src/echo.ts imports
// ../specs/A.xspec likewise and calls text(A.e) in the function echo — embeds
// edges from the named units src/show.ts#show and src/echo.ts#echo (SPEC 4.3,
// 4.6); no marker stands anywhere. With that state committed as the baseline,
// t's text is edited: t is `changed`; e, f, and A's root are
// `upstream-changed`, not `changed` — an embedded target's edit leaves the
// embedder's own content unchanged (SPEC 5.5, 5.6) — so none is visited and
// each, bearing a dependency edge to t in the current graph, gets a
// dependency-consistency item, the root included; e's effectiveHash changes
// and its subtreeHash does not, so echo is transitively impacted through its
// embeds edge to e, and show directly through its embeds edge to t (SPEC
// 9.2). The body's one workspace is created, and t edited, before any
// product invocation, so every file stays plain (module header).
const E7_A_FILE = "specs/A.mdx";
const E7_B_FILE = "specs/B.mdx";
const E7_ROOT = "specs/A.mdx";
const E7_E = "specs/A.mdx#e";
const E7_F = "specs/A.mdx#f";
const E7_B_ROOT = "specs/B.mdx";
const E7_T = "specs/B.mdx#t";
const E7_SHOW_FILE = "src/show.ts";
const E7_SHOW = "src/show.ts#show";
const E7_ECHO_FILE = "src/echo.ts";
const E7_ECHO = "src/echo.ts#echo";

// The spec group over specs/*.mdx and the code group over src/*.ts that
// T10.5-7's TEST-SPEC entry stages (module header: plain).
const T10_5_7_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  code: {
    app: ["src/*.ts"]
  }
})
`;

const E7_T_TEXT_V0 = "Target text v0.";
const E7_T_TEXT_V1 = "Target text v1.";

function e7BSource(tText: string): string {
  return ['<S id="t">', tText, "</S>", ""].join("\n");
}

const E7_A_SOURCE = [
  'import B from "./B.xspec"',
  "",
  "{text(B.t)}",
  "",
  '<S id="e">',
  "{text(B.t)}",
  "</S>",
  "",
  '<S id="f" d={B.t}>',
  "{text(B.t)}",
  "</S>",
  "",
].join("\n");

const E7_SHOW_SOURCE = [
  'import B, { text } from "../specs/B.xspec";',
  "",
  "export function show(): string {",
  "  return text(B.t);",
  "}",
  "",
].join("\n");

const E7_ECHO_SOURCE = [
  'import A, { text } from "../specs/A.xspec";',
  "",
  "export function echo(): string {",
  "  return text(A.e);",
  "}",
  "",
].join("\n");

// Expected texts, derived by hand from SPEC 1.6 and 3 as T1.6-1's are: the
// import line and every tag-only line are emptied purely by removals and
// dropped with their terminators, each embedding's line compiles to t's
// subtree text followed by the line's own terminator, and the blank lines
// are kept. t's current subtree text is its one text line with its
// terminator.
const E7_T_SUBTREE_V1 = `${E7_T_TEXT_V1}\n`;
// A's root subtree text — the file's entire compiled output: the blank line
// after the import, the top-level embedding's line, the blank line before e,
// e's contribution (its embedding's line), the blank line between e and f,
// and f's contribution (its embedding's line).
const E7_ROOT_SUBTREE_V1 = `\n${E7_T_SUBTREE_V1}\n\n${E7_T_SUBTREE_V1}\n\n${E7_T_SUBTREE_V1}\n`;
// A's root own text — its dependency-consistency item's scope text (SPEC
// 10.7): t's current subtree text expanded where the top-level embedding
// stands, e's and f's contributions excised, the root's runs joined at the
// excision points (SPEC 1.6) — the blank line after the import, the
// top-level embedding's line, and the blank lines before e and between e and
// f.
const E7_ROOT_OWN_V1 = `\n${E7_T_SUBTREE_V1}\n\n\n`;

/** One of T10.5-7's six expected items (TEST-SPEC T10.5-7; SPEC 10.5). */
interface E7ExpectedItem {
  readonly kind: ReviewItem["kind"];
  /** The scope node — the scoped code location for `code-impact`. */
  readonly scope: string;
  readonly context: readonly string[];
  /** Why that context is expected. */
  readonly contextWhy: string;
  readonly origin: readonly string[];
  /** Why that origin is expected. */
  readonly originWhy: string;
}

// The six items in item order (SPEC 10.5): requirement-scoped items first,
// deepest first — every depth-1 item before the depth-0 root's, at depth 1
// subtree-coherence before dependency-consistency, then e before f in
// document order — and the code-impact items last, by location identity.
const E7_EXPECTED_ITEMS: readonly E7ExpectedItem[] = [
  {
    kind: "subtree-coherence",
    scope: E7_T,
    context: [E7_B_ROOT],
    contextWhy:
      "t's ancestor chain — B's root alone, t being top-level (SPEC 10.5)",
    origin: [E7_T],
    originWhy: "the changed node in its scope, t itself (SPEC 10.5)",
  },
  {
    kind: "dependency-consistency",
    scope: E7_E,
    context: [E7_T],
    contextWhy:
      "exactly {t}, the changed both-sides target of e's embeds edge, its " +
      "sole dependency edge — an embeds edge is a dependency edge like a " +
      "depends edge (SPEC 5.2, 10.5)",
    origin: [E7_T],
    originWhy:
      "exactly {t}, the originating node of t's category — t itself, " +
      "changed (SPEC 5.6, 10.5)",
  },
  {
    kind: "dependency-consistency",
    scope: E7_F,
    context: [E7_T],
    contextWhy:
      "exactly {t} — f's depends and embeds edges reach the one target, " +
      "which enters its context once, never once per edge (SPEC 5.2: edges " +
      "of each kind form a set, 10.5: context those changed targets)",
    origin: [E7_T],
    originWhy:
      "exactly {t}, the originating node of t's category (SPEC 5.6, 10.5)",
  },
  {
    kind: "dependency-consistency",
    scope: E7_ROOT,
    context: [E7_T],
    contextWhy:
      "exactly {t}, the target of the root-sourced embeds edge — the " +
      "root's own dependency edge; e and f, its children, are no targets " +
      "(SPEC 2.3, 10.5)",
    origin: [E7_T],
    originWhy:
      "exactly {t}, the originating node of t's category (SPEC 5.6, 10.5)",
  },
  {
    kind: "code-impact",
    scope: E7_ECHO,
    context: [E7_E],
    contextWhy:
      "exactly {e}, the target of its one impact edge, an embeds edge, " +
      "which makes it impacted — e's effectiveHash changed and its " +
      "subtreeHash did not, so echo is transitively impacted (SPEC 9.2, " +
      "10.5)",
    origin: [E7_T],
    originWhy:
      "exactly {t}, the originating node of e's change — e's " +
      "upstream-changed is attributed to t — rather than the context node " +
      "e (SPEC 5.6, 10.5)",
  },
  {
    kind: "code-impact",
    scope: E7_SHOW,
    context: [E7_T],
    contextWhy:
      "exactly {t}, the target of its one impact edge, an embeds edge — " +
      "t's subtreeHash changed, so show is directly impacted (SPEC 9.2, " +
      "10.5)",
    origin: [E7_T],
    originWhy:
      "exactly {t}, the originating node of t's category (SPEC 5.6, 10.5)",
  },
];

/** `kind scope` rendering of one expected item (order compare). */
function e7KindScope(item: E7ExpectedItem): string {
  return `${item.kind} ${item.scope}`;
}

/**
 * Assert the root item's scope text as `surface` presents it (TEST-SPEC
 * T10.5-7; SPEC 1.6, 10.7): a dependency-consistency item's scope text is
 * its scope node's own text — for A's root, t's current subtree text
 * expanded where the top-level embedding stands, e's and f's contributions
 * excised — byte-asserted, and never the root's subtree text.
 */
function assertE7RootScopeText(item: ReviewItem, surface: string): void {
  if (item.scope.node !== E7_ROOT || item.scope.present !== true) {
    fail(
      `${surface}: the root item's scope is A's root, present (SPEC 10.5, ` +
        `10.7); got ${JSON.stringify({
          node: item.scope.node,
          present: item.scope.present,
        })}`,
    );
  }
  const text = item.scope.text;
  if (text === undefined) {
    fail(
      `${surface}: the root item's scope carries no text — a ` +
        `dependency-consistency item's scope text is its scope node's own ` +
        `text (SPEC 10.7)`,
    );
  }
  if (bytesEqual(text, E7_ROOT_SUBTREE_V1)) {
    fail(
      `${surface}: the root item's scope text is the root's subtree text ` +
        `${JSON.stringify(text)} — e's and f's contributions included — ` +
        `never its own text, which a dependency-consistency item's scope ` +
        `text is (SPEC 1.6, 10.7)`,
    );
  }
  assertBytesEqual(
    text,
    E7_ROOT_OWN_V1,
    `${surface}: the root item's scope text is A's root own text — t's ` +
      `current subtree text expanded where the top-level embedding stands, ` +
      `e's and f's contributions excised (SPEC 1.6, 10.7)`,
  );
}

/**
 * Impacted-code entries, each rendered as its location and witness edge,
 * sorted (T10.5-7's impact premise compare).
 */
function e7ImpactedCode(entries: readonly ImpactedCodeEntry[]): string[] {
  return entries
    .map(
      (entry) =>
        `${entry.location} through ${entry.edge.kind}: ` +
        `${entry.edge.from} -> ${entry.edge.to}`,
    )
    .sort();
}

const T10_5_7 = defineProductTest({
  id: "T10.5-7",
  title:
    "embedding edges and a root-sourced embedding: path-blocks derives dependency-consistency items over every dependency edge a requirement node bears, `embeds` as well as `depends`, its \"per requirement node\" excluding no root, and code-impact items over 9.2's impacted set, whose impact edges are `embeds` as well as `references` — with specs/B.mdx's top-level t edited since the baseline, specs/A.mdx holding a top-level {text(B.t)} outside every section (a root-sourced embeds edge), a section e holding only {text(B.t)}, and a section f spelled d={B.t} holding {text(B.t)}, src/show.ts's function show calling text(B.t), src/echo.ts's function echo calling text(A.e), and no marker anywhere, `review create --base` yields exactly six items in this order: t's subtree-coherence item (context B's root, origin {t}); dependency-consistency items scoped at e and then f, each with context and origin exactly {t} (f one item, not one per edge, t entering its context once though two edges reach it); the root's dependency-consistency item, context and origin likewise, at depth 0 after every depth-1 item; echo's code-impact item (transitively impacted through its embeds edge, e's effectiveHash changed and its subtreeHash not; context {e}, origin {t}, the originating node of e's change rather than the context node); and show's (directly impacted; context and origin {t}) — every blockedBy empty, no subtree-coherence item for e, f, or the root (upstream-changed, not changed: an embedded target's edit leaves the embedder's own content unchanged), and the root item's scope text in `show` and `export` byte-equal to the root's own text — t's current subtree text expanded where the top-level embedding stands, e's and f's contributions excised — never its subtree text (SPEC 1.6, 2.3, 4.3, 5.2, 5.5, 5.6, 9.2, 10.5, 10.7)",
  run: async (product) => {
    await withWorkspace(
      T10_5_7_CONFIG,
      {
        [E7_B_FILE]: e7BSource(E7_T_TEXT_V0),
        [E7_A_FILE]: E7_A_SOURCE,
        [E7_SHOW_FILE]: E7_SHOW_SOURCE,
        [E7_ECHO_FILE]: E7_ECHO_SOURCE,
      },
      async (workspace) => {
        const prefix = "T10.5-7";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("baseline");
        await workspace.file(E7_B_FILE, e7BSource(E7_T_TEXT_V1));
        await buildOk(product, workspace, `${prefix} \`build\` after t's edit`);

        // The staging's premises, through the impact surface (as T10.5-3's
        // are): t `changed`; e, f, and A's root `upstream-changed` alone —
        // never `changed`, the embedded target's text no part of the
        // embedder's own content (SPEC 1.6, 5.5, 5.6); and the two code
        // locations each impacted through its one impact edge, an embeds
        // edge — show directly (t's subtreeHash changed), echo transitively
        // (e's effectiveHash changed, its subtreeHash not) (SPEC 9.2, 9.3).
        const impactLabel = `${prefix} \`impact --base <baseline> --json\``;
        const impact = decodeImpactReport(
          await runJson(
            product,
            workspace,
            ["impact", "--base", base, "--json"],
            impactLabel,
          ),
          impactLabel,
        );
        const categoriesOf = (identity: string): readonly string[] =>
          impact.requirements
            .filter((entry) => entry.nodes.includes(identity))
            .flatMap((entry) =>
              entry.categories.map((category) => category.category),
            )
            .sort();
        assertSameJson(
          categoriesOf(E7_T),
          ["changed"],
          `${impactLabel} staging premise: t, its own text edited, is ` +
            `changed (SPEC 5.6)`,
        );
        for (const embedder of [E7_E, E7_F, E7_ROOT]) {
          assertSameJson(
            categoriesOf(embedder),
            ["upstream-changed"],
            `${impactLabel} staging premise: ${embedder}, embedding t, is ` +
              `upstream-changed alone, never changed — an embedded target's ` +
              `edit leaves the embedder's own content unchanged, changing ` +
              `its effectiveHash alone (SPEC 1.6, 5.5, 5.6)`,
          );
        }
        assertSameJson(
          {
            direct: e7ImpactedCode(impact.code.direct),
            transitive: e7ImpactedCode(impact.code.transitive),
          },
          {
            direct: [`${E7_SHOW} through embeds: ${E7_SHOW} -> ${E7_T}`],
            transitive: [`${E7_ECHO} through embeds: ${E7_ECHO} -> ${E7_E}`],
          },
          `${impactLabel} staging premise: src/show.ts#show is directly ` +
            `impacted through its one impact edge, its embeds edge to t ` +
            `(t's subtreeHash changed), and src/echo.ts#echo transitively ` +
            `through its one impact edge, its embeds edge to e (e's ` +
            `effectiveHash changed, its subtreeHash not) — impact edges are ` +
            `embeds as well as references edges (SPEC 9.2, 9.3)`,
        );

        await createBaseSession(product, workspace, base, "s", prefix);
        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          status.items
            .filter((row) => row.kind === "subtree-coherence")
            .map((row) => row.scope),
          [E7_T],
          `${prefix}: t alone is visited and gets a subtree-coherence item — ` +
            `e, f, and specs/A.mdx's root get none: they are ` +
            `upstream-changed, not changed, because an embedded target's ` +
            `edit leaves the embedder's own content unchanged (SPEC 5.5, ` +
            `5.6, 10.5)`,
        );
        const embedderWhy: readonly (readonly [string, string])[] = [
          [
            E7_E,
            "e's sole dependency edge, its embeds edge to t, yields its " +
              "dependency-consistency item — embeds as well as depends " +
              "(SPEC 5.2, 10.5); a product deriving these items from d " +
              "targets alone gives e none",
          ],
          [
            E7_F,
            "f, bearing a depends and an embeds edge to t, gets one " +
              "dependency-consistency item, not one per edge (SPEC 10.5: one " +
              "item per requirement node; a kind and scope node produced " +
              "more than once in one derivation yields a single item)",
          ],
          [
            E7_ROOT,
            "the root, bearing the root-sourced embeds edge to t, gets its " +
              'dependency-consistency item — 10.5\'s "per requirement node" ' +
              "excludes no root (SPEC 1.2, 10.5); a product excluding roots, " +
              "or reading d targets alone, gives it none",
          ],
        ];
        for (const [scope, why] of embedderWhy) {
          assertSameJson(
            status.items
              .filter((row) => row.scope === scope)
              .map((row) => row.kind),
            ["dependency-consistency"],
            `${prefix}: ${scope}'s items — ${why}`,
          );
        }
        assertSameJson(
          status.items
            .filter((row) => row.kind === "code-impact")
            .map((row) => row.scope),
          [E7_ECHO, E7_SHOW],
          `${prefix}: one code-impact item per location in 9.2's impacted ` +
            `set, whose impact edges are embeds as well as references ` +
            `edges — src/echo.ts#echo through its embeds edge to e, ` +
            `src/show.ts#show through its embeds edge to t — in ` +
            `location-identity order (SPEC 9.2, 10.5); a product reading ` +
            `markers alone gives neither`,
        );
        const expectedSequence = E7_EXPECTED_ITEMS.map(e7KindScope);
        assertSameJson(
          kindScopeSequence(status.items),
          expectedSequence,
          `${prefix}: exactly six items, in item order — t's ` +
            `subtree-coherence item; at depth 1 after it the ` +
            `dependency-consistency items of e and then f (kind order, then ` +
            `document order); the root's dependency-consistency item at ` +
            `depth 0, after every depth-1 item (roots are 0); then the ` +
            `code-impact items of echo and show, by location identity ` +
            `(SPEC 10.5)`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);
        assertSameJson(
          exportKindScopeSequence(exported.items),
          expectedSequence,
          `${prefix}: \`export\` presents the same six items in item order ` +
            `(SPEC 10.5, 10.7)`,
        );
        for (const expected of E7_EXPECTED_ITEMS) {
          const label = `${prefix} ${expected.kind} item of ${expected.scope}`;
          const item = requireItem(
            exported.items,
            expected.kind,
            expected.scope,
            prefix,
          );
          assertSameJson(
            identitySet(item.context),
            [...expected.context].sort(),
            `${label}: context ${expected.contextWhy}`,
          );
          assertSameJson(
            identitySet(item.origin),
            [...expected.origin].sort(),
            `${label}: origin ${expected.originWhy}`,
          );
          assertBlockedBy(
            item,
            [],
            `${label}: every blockedBy is empty — path-blocks assigns ` +
              `blockers to parent-consistency items alone, and this session ` +
              `has none (SPEC 10.2, 10.5)`,
          );
        }

        const rootItem = requireItem(
          exported.items,
          "dependency-consistency",
          E7_ROOT,
          prefix,
        );
        assertE7RootScopeText(
          rootItem,
          `${prefix} \`export\`'s root dependency-consistency item`,
        );
        const rootId = requireRow(
          status,
          "dependency-consistency",
          E7_ROOT,
          prefix,
        ).id;
        const shown = await showItem(product, workspace, "s", rootId, prefix);
        if (shown.id !== rootId || shown.kind !== "dependency-consistency") {
          fail(
            `${prefix}: \`review show s ${rootId}\` reports the root's ` +
              `dependency-consistency item (SPEC 10.7: the full item); got ` +
              `${JSON.stringify({ id: shown.id, kind: shown.kind })}`,
          );
        }
        assertE7RootScopeText(
          shown,
          `${prefix} \`show\`'s root dependency-consistency item`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.5-8 — a `changed` root
// ---------------------------------------------------------------------------

// TEST-SPEC T10.5-8's fixture: specs/R.mdx holds top-level text, a section a
// holding a child a.b, and a section c; specs/S.mdx holds a section x
// holding a child x.y. After the baseline commit, a.b's and x.y's texts are
// edited and a top-level section d is added to specs/R.mdx, after c; the
// four-edit staging also edits specs/R.mdx's top-level text, which its twin
// leaves unedited — there the added section alone makes the root `changed`,
// a structural edit originating at the parent (SPEC 5.5, 5.6). Either way
// R's root is `changed` with no `changed` ancestor, so the skipping rule
// visits it as N: its single subtree-coherence item takes in a.b and d, the
// file's other `changed` nodes, and no item arises at a.b, a, or d, a
// parent-consistency item going to non-root ancestors alone (10.5); S's
// root, no `changed` ancestor of x.y, leaves x.y visited with x's
// parent-consistency item above it.
//
// The fixture is exported for T10.2-2's arm over item (3)'s `baseline`
// (`T10_5_8_FILES`, `T10_5_8_NODES`, `T10_5_8_INITIAL_FILES`,
// `T10_5_8_STAGINGS`, `stageT1058Session`): the staging asserts staging
// premises alone, every outcome T10.5-8 asserts staying in its body.

/** T10.5-8's source paths: the `changed` root's file R, and S. */
export const T10_5_8_FILES = {
  r: "specs/R.mdx",
  s: "specs/S.mdx",
} as const;

/** T10.5-8's node identities (SPEC 1.5). */
export const T10_5_8_NODES = {
  rRoot: "specs/R.mdx",
  a: "specs/R.mdx#a",
  ab: "specs/R.mdx#a.b",
  c: "specs/R.mdx#c",
  d: "specs/R.mdx#d",
  sRoot: "specs/S.mdx",
  x: "specs/S.mdx#x",
  xy: "specs/S.mdx#x.y",
} as const;

const R8_ROOT = T10_5_8_NODES.rRoot;
const R8_A = T10_5_8_NODES.a;
const R8_AB = T10_5_8_NODES.ab;
const R8_C = T10_5_8_NODES.c;
const R8_D = T10_5_8_NODES.d;
const R8_S_ROOT = T10_5_8_NODES.sRoot;
const R8_X = T10_5_8_NODES.x;
const R8_XY = T10_5_8_NODES.xy;

/** The nodes of item (3)'s scope that the baseline graph holds. */
const R8_BASELINE_NODES: readonly string[] = [R8_ROOT, R8_A, R8_AB, R8_C];

const R8_TOP_V0 = "Root top text v0.";
const R8_TOP_V1 = "Root top text v1.";
const R8_AB_V1 = "Ay bee text v1.";

/**
 * specs/R.mdx's bytes: the top-level text `topText`, then a (its own text,
 * then a.b holding `abText`), c, and — `withD` — the top-level d after c.
 */
function t1058RSource(topText: string, abText: string, withD: boolean): string {
  return [
    topText,
    "",
    '<S id="a">',
    "Ay own text.",
    "",
    '<S id="a.b">',
    abText,
    "</S>",
    "</S>",
    "",
    '<S id="c">',
    "Cee text.",
    "</S>",
    ...(withD ? ["", '<S id="d">', "Dee text.", "</S>"] : []),
    "",
  ].join("\n");
}

/** specs/S.mdx's bytes: x, its own text, holding x.y (`xyText`). */
function t1058SSource(xyText: string): string {
  return [
    '<S id="x">',
    "Ex own text.",
    "",
    '<S id="x.y">',
    xyText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// T10.5-8's sources are staged-source records (helpers/staged-mdx.ts, S-9:
// judged before any product exists): the edits follow the baseline
// capture's `build`, and the initial sources are exported records both
// workspaces share, the twin's created after the body's first `build`.
const T10_5_8_R_INITIAL = stagedMdx(
  "T10.5-8 specs/R.mdx with top-level text, a holding a.b, and c, at v0 (the fixture's initial source)",
  t1058RSource(R8_TOP_V0, "Ay bee text v0.", false),
);
const T10_5_8_S_INITIAL = stagedMdx(
  "T10.5-8 specs/S.mdx with x holding x.y at v0 (the fixture's initial source)",
  t1058SSource("Ex why text v0."),
);
const T10_5_8_R_EDITED = stagedMdx(
  "T10.5-8 specs/R.mdx with its top-level text and a.b at v1 and d added after c (the four-edit staging)",
  t1058RSource(R8_TOP_V1, R8_AB_V1, true),
);
const T10_5_8_R_TWIN_EDITED = stagedMdx(
  "T10.5-8 specs/R.mdx with a.b at v1 and d added after c, its top-level text unedited (the twin)",
  t1058RSource(R8_TOP_V0, R8_AB_V1, true),
);
const T10_5_8_S_EDITED = stagedMdx(
  "T10.5-8 specs/S.mdx with x.y at v1 (both stagings' x.y edit)",
  t1058SSource("Ex why text v1."),
);

/**
 * T10.5-8's initial sources at the baseline, as a workspace declaration's
 * `files` entries beside a configuration whose one spec group discovers
 * every `.mdx` file under `specs/` (SPEC 7.1) — records, so any workspace
 * stages them alike (S-9).
 */
export const T10_5_8_INITIAL_FILES: Readonly<Record<string, StagedMdx>> = {
  [T10_5_8_FILES.r]: T10_5_8_R_INITIAL,
  [T10_5_8_FILES.s]: T10_5_8_S_INITIAL,
};

/** One of T10.5-8's two stagings (TEST-SPEC T10.5-8). */
export interface T1058Staging {
  /** The staging's name in diagnoses. */
  readonly name: string;
  /** specs/R.mdx after the edits. */
  readonly rEdited: StagedMdx;
  /** Why R's root is `changed` after the edits (SPEC 5.5, 5.6). */
  readonly rootChangedWhy: string;
  /**
   * The root's subtree text after the edits — specs/R.mdx's entire compiled
   * Markdown output (SPEC 1.6), derived by hand from SPEC 3 as T1.6-1's
   * expected texts are: every tag-only line emptied purely by removals and
   * dropped with its terminator, every text and blank line kept.
   */
  readonly rootSubtreeText: string;
  /**
   * The root's own text after the edits — its subtree text with a's, c's,
   * and d's contributions excised, its runs joined at the excision points
   * (SPEC 1.6): the scope text a parent-consistency item presents (10.7),
   * diagnosed where item (3)'s is expected.
   */
  readonly rootOwnText: string;
}

/** R's root's subtree text after the edits, its top-level text `top`. */
function r8RootSubtreeText(top: string): string {
  return `${top}\n\nAy own text.\n\n${R8_AB_V1}\n\nCee text.\n\nDee text.\n`;
}

/** R's root's own text after the edits, its top-level text `top`. */
function r8RootOwnText(top: string): string {
  return `${top}\n\n\n\n`;
}

/**
 * T10.5-8's two stagings: the four edits, and the twin leaving specs/R.mdx's
 * top-level text unedited — R's root `changed` either way (SPEC 5.5, 5.6).
 */
export const T10_5_8_STAGINGS: readonly T1058Staging[] = [
  {
    name: "the four-edit staging",
    rEdited: T10_5_8_R_EDITED,
    rootChangedWhy:
      "its top-level text edited and the top-level d added, each an edit " +
      "to its own content",
    rootSubtreeText: r8RootSubtreeText(R8_TOP_V1),
    rootOwnText: r8RootOwnText(R8_TOP_V1),
  },
  {
    name: "the twin (top-level text unedited)",
    rEdited: T10_5_8_R_TWIN_EDITED,
    rootChangedWhy:
      "the top-level d added alone, a structural edit originating at the " +
      "parent",
    rootSubtreeText: r8RootSubtreeText(R8_TOP_V0),
    rootOwnText: r8RootOwnText(R8_TOP_V0),
  },
];

/** The session one T10.5-8 staging leaves, and its captures. */
export interface T1058Session {
  /** The baseline commit `create --base` names. */
  readonly base: string;
  /**
   * The root's, a's, a.b's, and c's hashes at the baseline — `query node`
   * before the edits.
   */
  readonly atBaseline: ReadonlyMap<string, NodeHashes>;
  /**
   * The root's, a's, a.b's, c's, and d's hashes after the edits — `query
   * node` right before `create`, nothing staged between.
   */
  readonly atCreate: ReadonlyMap<string, NodeHashes>;
}

/**
 * Stage one of T10.5-8's stagings in a fresh workspace holding
 * `T10_5_8_INITIAL_FILES` (SPEC 10.5): the baseline committed, built, and
 * captured (the root, a, a.b, and c); `staging`'s specs/R.mdx and
 * specs/S.mdx's x.y edit staged, built, and captured (d too) — the root's,
 * a's, and a.b's subtreeHashes differing from their baseline values (5.5)
 * and the `changed` nodes exactly R's root, a.b, d, and x.y (5.6; `impact
 * --json`), staging premises; then `review create --base <baseline> --name
 * s`. Exported for T10.2-2's arm over item (3)'s `baseline`.
 */
export async function stageT1058Session(
  product: ProductBinding,
  workspace: TestWorkspace,
  staging: T1058Staging,
  label: string,
): Promise<T1058Session> {
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${label} \`build\` at the baseline`);
  const atBaseline = await captureHashes(
    product,
    workspace,
    R8_BASELINE_NODES,
    `${label} baseline capture`,
  );
  await workspace.file(T10_5_8_FILES.r, staging.rEdited);
  await workspace.file(T10_5_8_FILES.s, T10_5_8_S_EDITED);
  await buildOk(product, workspace, `${label} \`build\` after the edits`);
  const atCreate = await captureHashes(
    product,
    workspace,
    [...R8_BASELINE_NODES, R8_D],
    `${label} capture after the edits`,
  );
  const premise = `${label} staging premise`;
  for (const node of [R8_ROOT, R8_A, R8_AB]) {
    if (
      capturedHash(atCreate, node, "subtreeHash", premise) ===
      capturedHash(atBaseline, node, "subtreeHash", premise)
    ) {
      fail(
        `${premise}: ${node}'s subtreeHash must differ from its baseline ` +
          `value after the edits (SPEC 5.5: a node of its subtree changed), ` +
          `so item (3)'s baseline values are told apart from the current ` +
          `graph's (TEST-SPEC T10.5-8)`,
      );
    }
  }
  const impactLabel = `${label} \`impact --base <baseline> --json\``;
  const impact = decodeImpactReport(
    await runJson(
      product,
      workspace,
      ["impact", "--base", base, "--json"],
      impactLabel,
    ),
    impactLabel,
  );
  assertSameJson(
    impact.requirements
      .filter((entry) =>
        entry.categories.some((category) => category.category === "changed"),
      )
      .flatMap((entry) => entry.nodes)
      .sort(),
    [R8_ROOT, R8_AB, R8_D, R8_XY].sort(),
    `${impactLabel} staging premise: the \`changed\` nodes are exactly R's ` +
      `root — ${staging.rootChangedWhy} (SPEC 5.5, 5.6: adding a child ` +
      `changes its parent's ownHash, structural edits originating at the ` +
      `parent) — a.b and x.y, their texts edited, and d, added`,
  );
  await createBaseSession(product, workspace, base, "s", label);
  return { base, atBaseline, atCreate };
}

/** T10.5-8's three items in item order (SPEC 10.5): depths 2, 1, then 0. */
const R8_EXPECTED_SEQUENCE: readonly string[] = [
  `subtree-coherence ${R8_XY}`,
  `parent-consistency ${R8_X}`,
  `subtree-coherence ${R8_ROOT}`,
];

/**
 * Assert item (3)'s `baseline` entries (TEST-SPEC T10.5-8; SPEC 10.2,
 * 10.4), read through the review adapter's `decodeRecordedState`: fixed
 * from the recorded baseline graph, it holds for the root, a, a.b, and c,
 * each present, the subtreeHash and metadataHash `query node` reported at
 * the baseline, before the edits — never the values after them, which a
 * baseline filled from the current graph holds — and for d, in the item's
 * scope when it entered though the baseline graph lacks it, an entry
 * presenting it absent, its hashes the explicit absent marker: never d's
 * current hashes, and never no entry, which 10.2 leaves to a node joining
 * the item later.
 */
function assertT1058Baseline(
  item: ReviewItem,
  session: T1058Session,
  label: string,
): void {
  const entries = decodeRecordedState(item, "baseline", label);
  const entryOf = (node: string): RecordedNodeEntry | undefined =>
    entries.find((entry) => entry.node === node);
  const held = JSON.stringify(entries.map((entry) => entry.node));
  for (const node of R8_BASELINE_NODES) {
    const entry = entryOf(node);
    if (entry === undefined) {
      fail(
        `${label}: holds no entry for ${node}, a scope node the baseline ` +
          `graph holds — \`baseline\` holds the item's relevant hashes and ` +
          `node presence (SPEC 10.2, 10.4); it holds entries for ${held}`,
      );
    }
    if (!entry.present || entry.absentMarker) {
      fail(
        `${label}: ${node}'s entry must present it present, with its ` +
          `hashes — the recorded baseline graph holds it (SPEC 10.2, ` +
          `10.4); got ${JSON.stringify(entry)}`,
      );
    }
    for (const hash of ["subtreeHash", "metadataHash"] as const) {
      const expected = capturedHash(session.atBaseline, node, hash, label);
      const recorded = entry.hashes[hash];
      if (recorded === expected) continue;
      const current = capturedHash(session.atCreate, node, hash, label);
      fail(
        `${label}: ${node}'s ${hash} must be ${JSON.stringify(expected)}, ` +
          `the value \`query node\` reported at the baseline, before the ` +
          `edits — \`baseline\` is fixed from the recorded baseline graph, ` +
          `a subtree-coherence item's relevant hashes the subtreeHash and ` +
          `metadataHash of each scope node (SPEC 10.2, 10.4); got ` +
          (recorded === undefined
            ? "none recorded"
            : recorded === current
              ? `${JSON.stringify(recorded)}, its value after the edits — a ` +
                `baseline filled from the current graph`
              : JSON.stringify(recorded)),
      );
    }
  }
  const d = entryOf(R8_D);
  if (d === undefined) {
    fail(
      `${label}: holds no entry for d — d was in the item's scope when it ` +
        `entered, though the baseline graph lacks it, so its entry presents ` +
        `it absent, its hashes the explicit absent marker (SPEC 10.2, ` +
        `10.4); 10.2 leaves an entry out only for a node joining the item ` +
        `later, and a product entering only the nodes the baseline graph ` +
        `holds gives d none; it holds entries for ${held}`,
    );
  }
  const dCurrent = [
    capturedHash(session.atCreate, R8_D, "subtreeHash", label),
    capturedHash(session.atCreate, R8_D, "metadataHash", label),
  ];
  const dHeld = Object.values(d.hashes).filter(
    (hash): hash is string => hash !== undefined,
  );
  if (dHeld.some((hash) => dCurrent.includes(hash))) {
    fail(
      `${label}: d's entry holds d's current hashes — never: the baseline ` +
        `graph lacks d, so its entry presents it absent, its hashes the ` +
        `explicit absent marker (SPEC 10.2, 10.4); got ${JSON.stringify(d)}`,
    );
  }
  if (d.present) {
    fail(
      `${label}: d's entry must present it absent — the baseline graph ` +
        `lacks d (SPEC 10.2, 10.4); got ${JSON.stringify(d)}`,
    );
  }
  if (!d.absentMarker || dHeld.length > 0) {
    fail(
      `${label}: d's entry must record the explicit absent marker in place ` +
        `of hashes, as an absent node's hashes are recorded (SPEC 10.4); ` +
        `got ${JSON.stringify(d)}`,
    );
  }
}

/**
 * Assert item (3)'s scope text as `surface` presents it (TEST-SPEC
 * T10.5-8; SPEC 1.6, 10.7): a subtree-coherence item's scope text is the
 * scope root's subtree text — for R's root, specs/R.mdx's entire compiled
 * Markdown output — byte-asserted, and never the root's own text, which a
 * parent-consistency item presents.
 */
function assertT1058RootScopeText(
  item: ReviewItem,
  staging: T1058Staging,
  surface: string,
): void {
  if (item.scope.node !== R8_ROOT || item.scope.present !== true) {
    fail(
      `${surface}: the item's scope is R's root, present (SPEC 10.5, ` +
        `10.7); got ${JSON.stringify({
          node: item.scope.node,
          present: item.scope.present,
        })}`,
    );
  }
  const text = item.scope.text;
  if (text === undefined) {
    fail(
      `${surface}: the scope carries no text — a subtree-coherence item's ` +
        `scope text is the scope root's subtree text (SPEC 10.7)`,
    );
  }
  if (bytesEqual(text, staging.rootOwnText)) {
    fail(
      `${surface}: the scope text is the root's own text ` +
        `${JSON.stringify(text)} — a's, c's, and d's contributions excised — ` +
        `never its subtree text, which a subtree-coherence item's scope text ` +
        `is (SPEC 1.6, 10.7)`,
    );
  }
  assertBytesEqual(
    text,
    staging.rootSubtreeText,
    `${surface}: the scope text is the root's subtree text — specs/R.mdx's ` +
      `entire compiled Markdown output (SPEC 1.6, 3, 10.7)`,
  );
}

/**
 * Assert the session `s` one T10.5-8 staging leaves (TEST-SPEC T10.5-8;
 * SPEC 10.2, 10.4, 10.5, 10.7): no item at a.b, a, or d; R's root its
 * subtree-coherence item alone; S's nodes their own items; exactly three
 * items in item order in `status` and `export`; each item's context and
 * origin, items (2) and (3)'s `blockedBy`, and item (3)'s scope; item (3)'s
 * `baseline` entries; and item (3)'s scope text in `export` and `show`.
 */
async function assertT1058Session(
  product: ProductBinding,
  workspace: TestWorkspace,
  staging: T1058Staging,
  session: T1058Session,
  prefix: string,
): Promise<void> {
  const status = await sessionStatus(product, workspace, "s", prefix);
  const rowsAt = (scopes: readonly string[]): readonly string[] =>
    status.items
      .filter((row) => scopes.includes(row.scope))
      .map((row) => `${row.kind} ${row.scope}`)
      .sort();
  assertSameJson(
    rowsAt([R8_AB, R8_A, R8_D]),
    [],
    `${prefix}: no item is scoped at a.b, a, or d — R's root, \`changed\` ` +
      `with no \`changed\` ancestor, is visited as N, so a.b and d, ` +
      `\`changed\` beneath it, are skipped, entering its subtree-coherence ` +
      `item, and no parent-consistency item arises at a, those going to the ` +
      `non-root ancestors on a visited node's path (SPEC 10.5); a product ` +
      `that never visits a root gives a.b and d items of their own and a a ` +
      `parent-consistency item`,
  );
  assertSameJson(
    rowsAt([R8_ROOT]),
    [`subtree-coherence ${R8_ROOT}`],
    `${prefix}: R's root, visited as N, has exactly its subtree-coherence ` +
      `item — no parent-consistency item, those going to non-root ` +
      `ancestors alone (SPEC 10.5)`,
  );
  assertSameJson(
    rowsAt([R8_S_ROOT, R8_X, R8_XY]),
    [`parent-consistency ${R8_X}`, `subtree-coherence ${R8_XY}`],
    `${prefix}: specs/S.mdx's nodes keep their own items — x.y, visited, ` +
      `its subtree-coherence item and x its parent-consistency item — that ` +
      `file's root being no \`changed\` ancestor of theirs (SPEC 10.5)`,
  );
  assertSameJson(
    kindScopeSequence(status.items),
    R8_EXPECTED_SEQUENCE,
    `${prefix}: exactly three items, in item order — x.y's ` +
      `subtree-coherence item at depth 2, x's parent-consistency item at ` +
      `depth 1, and R's root's subtree-coherence item at depth 0 (SPEC ` +
      `10.5: deepest first, roots 0)`,
  );

  const exported = await exportSession(product, workspace, "s", prefix);
  assertSameJson(
    exportKindScopeSequence(exported.items),
    R8_EXPECTED_SEQUENCE,
    `${prefix}: \`export\` presents the same three items in item order ` +
      `(SPEC 10.5, 10.7)`,
  );
  const one = `${prefix} item (1), x.y's subtree-coherence item`;
  const xyItem = requireItem(exported.items, "subtree-coherence", R8_XY, one);
  assertSameJson(
    identitySet(xyItem.context),
    [R8_S_ROOT, R8_X].sort(),
    `${one}: context x.y's ancestor chain, specs/S.mdx and x (SPEC 10.5)`,
  );
  assertSameJson(
    identitySet(xyItem.origin),
    [R8_XY],
    `${one}: origin exactly {x.y}, the \`changed\` node in its scope (SPEC ` +
      `10.5)`,
  );
  const two = `${prefix} item (2), x's parent-consistency item`;
  const xItem = requireItem(exported.items, "parent-consistency", R8_X, two);
  assertSameJson(
    identitySet(xItem.context),
    [R8_XY],
    `${two}: context exactly {x.y}, the one changed branch beneath x, ` +
      `entering as x's child on it (SPEC 10.5)`,
  );
  assertSameJson(
    identitySet(xItem.origin),
    [R8_XY],
    `${two}: origin exactly {x.y}, the \`changed\` node in x's subtree ` +
      `(SPEC 10.5)`,
  );
  assertBlockedBy(
    xItem,
    [xyItem.id],
    `${two}: blocked by item (1), the subtree-coherence item of x's child ` +
      `on its one changed branch, x.y itself visited (SPEC 10.5)`,
  );
  const three = `${prefix} item (3), R's root's subtree-coherence item`;
  const rootItem = requireItem(
    exported.items,
    "subtree-coherence",
    R8_ROOT,
    three,
  );
  assertSameJson(
    identitySet(requireScopeNodes(rootItem, three)),
    [R8_ROOT, R8_A, R8_AB, R8_C, R8_D].sort(),
    `${three}: scope the root and every section of the file — a, a.b, c, ` +
      `and d — N and all its descendants reviewed as a single block (SPEC ` +
      `10.5, 10.7: every scope node presented)`,
  );
  assertSameJson(
    identitySet(rootItem.context),
    [],
    `${three}: context empty — a root's ancestor chain (SPEC 10.5)`,
  );
  assertSameJson(
    identitySet(rootItem.origin),
    [R8_ROOT, R8_AB, R8_D].sort(),
    `${three}: origin exactly {the root, a.b, d} — the \`changed\` nodes in ` +
      `its scope, the skipped a.b and d included (SPEC 10.5)`,
  );
  assertBlockedBy(
    rootItem,
    [],
    `${three}: blockedBy empty — path-blocks gives blockers to ` +
      `parent-consistency items alone (SPEC 10.2, 10.5)`,
  );
  assertT1058Baseline(
    rootItem,
    session,
    `${three}'s \`baseline\` in \`export\``,
  );
  assertT1058RootScopeText(rootItem, staging, `${three} in \`export\``);
  const rootId = requireRow(status, "subtree-coherence", R8_ROOT, prefix).id;
  const shown = await showItem(product, workspace, "s", rootId, prefix);
  if (shown.id !== rootId || shown.kind !== "subtree-coherence") {
    fail(
      `${prefix}: \`review show s ${rootId}\` reports R's root's ` +
        `subtree-coherence item (SPEC 10.7: the full item); got ` +
        `${JSON.stringify({ id: shown.id, kind: shown.kind })}`,
    );
  }
  assertT1058RootScopeText(shown, staging, `${three} in \`show\``);
}

const T10_5_8 = defineProductTest({
  id: "T10.5-8",
  title:
    "a `changed` root: an edit to a root's own content — its top-level text edited, or a top-level section added — makes the root `changed`, and the skipping rule visits it as N, its single subtree-coherence item taking in every other `changed` node of its file — with specs/R.mdx holding top-level text, a holding a.b, and c, and specs/S.mdx holding x holding x.y, after the baseline a.b's and x.y's texts edited, a top-level d added to specs/R.mdx, and its top-level text edited, `review create --base` yields exactly three items in this order: x.y's subtree-coherence item (depth 2; context specs/S.mdx and x; origin {x.y}), x's parent-consistency item (depth 1; context and origin {x.y}; blockedBy x.y's item), and specs/R.mdx's root's subtree-coherence item (depth 0; scope the root, a, a.b, c, and d; context empty; origin exactly {the root, a.b, d}; blockedBy empty) — no item at a.b, a, or d, the root no parent-consistency item, specs/S.mdx's nodes their own items; item (3)'s `baseline`, fixed from the recorded baseline graph, holds for the root, a, a.b, and c, each present, the subtreeHash and metadataHash `query node` reported before the edits (the root's, a's, and a.b's subtreeHashes differing from their current values), and for d, added since the baseline, an entry presenting it absent, its hashes the explicit absent marker — never d's current hashes, never no entry; `show` and `export` present item (3)'s scope text as the root's subtree text, specs/R.mdx's entire compiled Markdown output; and a twin leaving the top-level text unedited — the added section alone making the root `changed`, a structural edit originating at the parent — yields the same three items (SPEC 1.6, 5.5, 5.6, 10.2, 10.4, 10.5, 10.7)",
  run: async (product) => {
    for (const staging of T10_5_8_STAGINGS) {
      await withWorkspace(
        SPECS_ONLY_CONFIG,
        T10_5_8_INITIAL_FILES,
        async (workspace) => {
          const prefix = `T10.5-8 ${staging.name}`;
          const session = await stageT1058Session(
            product,
            workspace,
            staging,
            prefix,
          );
          await assertT1058Session(
            product,
            workspace,
            staging,
            session,
            prefix,
          );
        },
      );
    }
  },
});

// ---------------------------------------------------------------------------
// T10.5-9 — deleted and moved nodes in baseline sessions
// ---------------------------------------------------------------------------

// TEST-SPEC T10.5-9 (SPEC 10.5): in a baseline session a node deleted since
// the baseline (5.6) is the child of its baseline parent, identities mapped
// through the journal (6.3), and a present node the child of its current
// parent; ancestors, descendants, children, and subtrees follow these links
// as node relations and node sets alone — text values and hashes keep their
// definitions (1.6, 5.5).
//
// The deleted-node fixture: specs/D.mdx holds a top-level A holding A.B,
// which holds A.B.C — its text carrying a token no other node's own text
// spells — committed as the baseline; A.B.C's section is then deleted,
// nothing else edited. A.B is `changed` (it lost a child) and visited; A is
// not `changed` (5.5, 5.6; an `impact` premise). Its journal arm renames A.B
// to A.B2 after the baseline (`xspec rename`, journaled; A.B.C becomes
// A.B2.C by prefix replacement) and deletes A.B2.C's section by manual
// edit. Its audit contrast deletes A.B.C's section after an audit session's
// `create` and resolves A.B.C's item `updated`: an audit session has no
// baseline, its items' scopes the node and all its current descendants
// (10.6). The present-node arm: specs/R.mdx holds P1, holding P1.M, which
// holds P1.M.c, and then P2, each section holding a line of its own text,
// every tag alone on its line — T6.2-3's clean-boundary shape, P2 a
// flow-position parent whose closing tag's line start is the insertion
// point — so the journaled `move specs/R.mdx#P1.M specs/R.mdx#P2.M` leaves
// `changed` the two parents alone (6.2); P2.M.c's section is then deleted by
// manual edit. Its twin is the same workspace's session `t`, created after
// the move and before that deletion. The manual edits after the rename and
// the move change bytes the product rewrote, which no harness constant
// equals, so each is an anchored `workspace.edit()` (`editRewritten`).

const D9_FILE = "specs/D.mdx";
const D9_ROOT = "specs/D.mdx";
const D9_A = "specs/D.mdx#A";
const D9_AB = "specs/D.mdx#A.B";
const D9_ABC = "specs/D.mdx#A.B.C";
const D9_AB2 = "specs/D.mdx#A.B2";
const D9_AB2C = "specs/D.mdx#A.B2.C";

/** A.B.C's token: no other node's own text spells it (TEST-SPEC T10.5-9). */
const D9_TOKEN = "GONETOKEN";
const D9_ABC_TEXT = `Ay bee see text ${D9_TOKEN}.`;

/**
 * specs/D.mdx's bytes: A (its own text) holding A.B (its own text), which
 * holds — `withC` — A.B.C, every tag alone on its line.
 */
function d9Source(withC: boolean): string {
  return [
    '<S id="A">',
    "Ay own text.",
    "",
    '<S id="A.B">',
    "Ay bee own text.",
    "",
    ...(withC ? ['<S id="A.B.C">', D9_ABC_TEXT, "</S>"] : []),
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

// T10.5-9's specs/D.mdx sources are staged-source records
// (helpers/staged-mdx.ts, S-9: judged before any product exists): the
// baseline is the initial source the deleted-node fixture, its journal arm,
// and its audit contrast share — the latter two's workspaces created after
// the body's first `build` — and the deletion follows a `build` in the
// deleted-node fixture and the audit contrast alike.
const T10_5_9_D_INITIAL = stagedMdx(
  "T10.5-9 specs/D.mdx with A holding A.B holding A.B.C, A.B.C's text carrying the token (the deleted-node fixture's baseline)",
  d9Source(true),
);
const T10_5_9_D_DELETED = stagedMdx(
  "T10.5-9 specs/D.mdx with A.B.C's section deleted, nothing else edited (the deleted-node fixture and the audit contrast)",
  d9Source(false),
);

/**
 * A.B2.C's section as the journal arm's rename leaves it — SPEC 6.4's
 * minimal in-place rewrite changes its `id` attribute alone — with its line
 * terminator: the anchor whose deletion is the arm's manual edit.
 */
const D9_AB2C_SECTION = ['<S id="A.B2.C">', D9_ABC_TEXT, "</S>", ""].join("\n");

const P9_FILE = "specs/R.mdx";
const P9_ROOT = "specs/R.mdx";
const P9_P1 = "specs/R.mdx#P1";
const P9_P1MC = "specs/R.mdx#P1.M.c";
const P9_P2 = "specs/R.mdx#P2";
const P9_P2M = "specs/R.mdx#P2.M";
const P9_P2MC = "specs/R.mdx#P2.M.c";

// The present-node arm's specs/R.mdx at the baseline — a staged-source
// record, its workspace created after the body's first `build`.
const T10_5_9_R_INITIAL = stagedMdx(
  "T10.5-9 specs/R.mdx with P1 holding P1.M holding P1.M.c, then P2, every tag alone on its line (the present-node arm's baseline)",
  [
    '<S id="P1">',
    "Pee one text.",
    "",
    '<S id="P1.M">',
    "Em text.",
    "",
    '<S id="P1.M.c">',
    "See text.",
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="P2">',
    "Pee two text.",
    "</S>",
    "",
  ].join("\n"),
);

/**
 * P2.M.c's section as the present-node arm's move leaves it — the moved
 * text travels verbatim but for its rewritten `id` attributes (SPEC 6.5) —
 * with its line terminator: the anchor whose deletion is the arm's manual
 * edit.
 */
const P9_P2MC_SECTION = ['<S id="P2.M.c">', "See text.", "</S>", ""].join("\n");

/** The present-node arm's two items in item order (SPEC 10.5). */
const P9_EXPECTED_SEQUENCE: readonly string[] = [
  `subtree-coherence ${P9_P1}`,
  `subtree-coherence ${P9_P2}`,
];

/**
 * Diagnose that `search` occurs exactly once in the product-rewritten
 * `content` before `edit()` stages a manual edit at it: SPEC 6.4 and 6.5 fix
 * the rewritten form (minimal in-place edits; the moved text verbatim but
 * for its rewrites), so a missing or ambiguous anchor is a diagnosed
 * assertion failure about the product's rewriting, never `edit()`'s plain
 * refusal (H-8).
 */
function anchorOnce(content: string, search: string, context: string): void {
  const first = content.indexOf(search);
  if (first === -1) {
    fail(
      `${context}: expected the rewritten source to contain ` +
        `${JSON.stringify(search)} exactly once (SPEC 6.4 and 6.5 fix the ` +
        `rewritten form), but it does not appear; source: ` +
        JSON.stringify(content),
    );
  }
  if (content.includes(search, first + search.length)) {
    fail(
      `${context}: the anchor ${JSON.stringify(search)} appears more than ` +
        `once, so the manual edit cannot be staged unambiguously; source: ` +
        JSON.stringify(content),
    );
  }
}

/**
 * Stage a manual edit of bytes the product rewrote (a rename's or a move's
 * output, SPEC 6.4, 6.5): `anchor` replaced by `replacement` through
 * `workspace.edit()` — the staging of product-written bytes, judged at
 * staging time — once the anchor's uniqueness is diagnosed (`anchorOnce`)
 * and the edited text's derivability too, with the very verdict
 * `edit()`'s staging judge reaches (`deriveMdx`, no allowances; S-9): the
 * anchor is one whole section construct with its line, so a text that no
 * longer derives is the product's rewriting at fault — a diagnosed failure,
 * never the staging judge's harness error (H-8).
 */
async function editRewritten(
  workspace: TestWorkspace,
  rel: string,
  anchor: string,
  replacement: string,
  context: string,
): Promise<void> {
  const current = Buffer.from(await workspace.readBytes(rel)).toString("utf8");
  anchorOnce(current, anchor, context);
  const verdict = deriveMdx(current.replace(anchor, replacement));
  if (!verdict.derives) {
    fail(
      `${context}: ${rel} as the product rewrote it, the anchor replaced, ` +
        `is not well-formed under the stock MDX 3 grammar (S-9): ` +
        `${verdict.reason} — a rename or move leaves its rewritten sources ` +
        `well-formed (SPEC 6.4, 6.5, 14.20), and the edit replaces one ` +
        `whole section construct with its line; source: ` +
        JSON.stringify(current),
    );
  }
  await workspace.edit(rel, anchor, replacement);
}

/**
 * The `changed` nodes `impact --base <baseline> --json` reports (SPEC 5.6,
 * 9.3), sorted, each its identity or, reported deleted, its identity
 * followed by ` (deleted)` — staging premises. Exported for T10.7-9(f)'s
 * premise (section-10.7-ii.ts).
 */
export async function changedNodes(
  product: ProductBinding,
  workspace: TestWorkspace,
  base: string,
  label: string,
): Promise<readonly string[]> {
  const impactLabel = `${label} \`impact --base <baseline> --json\``;
  const impact = decodeImpactReport(
    await runJson(
      product,
      workspace,
      ["impact", "--base", base, "--json"],
      impactLabel,
    ),
    impactLabel,
  );
  return impact.requirements
    .filter((entry) =>
      entry.categories.some((category) => category.category === "changed"),
    )
    .flatMap((entry) =>
      entry.nodes.map((node) => (entry.deleted ? `${node} (deleted)` : node)),
    )
    .sort();
}

/** `review next <name> --json`'s item, diagnosed when it reports none. */
async function nextItem(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<ReviewItem> {
  const label = `${context} \`review next ${name} --json\``;
  const next = decodeNextReport(
    await runJson(
      product,
      workspace,
      ["review", "next", name, "--json"],
      label,
    ),
    label,
  );
  if (next.fullyResolved || next.item === undefined) {
    fail(
      `${label}: needing-review items remain, so \`next\` must return one ` +
        `(SPEC 10.7)`,
    );
  }
  return next.item;
}

/** Every node an item presents: its scope, scope nodes, context, origin. */
function presentedNodes(item: ReviewItem): readonly string[] {
  return [
    item.scope.node,
    ...(item.scopeNodes ?? []).map((state) => state.node),
    ...item.context.map((state) => state.node),
    ...item.origin.map((entry) => entry.node),
  ];
}

/**
 * Assert no item presents `unmapped` — a deleted node's baseline identity
 * before the journal maps it forward to `mapped` — anywhere (TEST-SPEC
 * T10.5-9; SPEC 6.3, 10.4: reads present every recorded node under its
 * current identity, whether or not the node is still present).
 */
function assertNeverPresented(
  items: readonly ReviewItem[],
  unmapped: string,
  mapped: string,
  context: string,
): void {
  for (const item of items) {
    const nodes = presentedNodes(item);
    if (!nodes.includes(unmapped)) continue;
    fail(
      `${context}: item ${item.id} (${item.kind} ${item.scope.node}) ` +
        `presents ${unmapped}, the deleted node's baseline identity ` +
        `unmapped — it is presented only under that identity mapped forward ` +
        `through the journal, ${mapped} (SPEC 6.3, 10.4, 10.5); the item ` +
        `presents ${JSON.stringify(nodes)}`,
    );
  }
}

/**
 * Assert an item's scope set and each scope node's presence (TEST-SPEC
 * T10.5-9; SPEC 10.4, 10.5, 10.7: the payload presents every scope node
 * under its current identity and presence), read through the review
 * adapter's `requireScopeNodes`: the sorted identity set first — `why`
 * stating it — then each node presented present or absent as `expected`
 * says. Exported for T10.7-9(f)'s scope before its split
 * (section-10.7-ii.ts).
 */
export function assertScopePresence(
  item: ReviewItem,
  expected: readonly (readonly [string, boolean])[],
  context: string,
  why: string,
): void {
  const nodes = requireScopeNodes(item, context);
  assertSameJson(
    identitySet(nodes),
    expected.map(([node]) => node).sort(),
    `${context}: scope ${why}`,
  );
  for (const [node, present] of expected) {
    const state = nodes.find((candidate) => candidate.node === node);
    if (state !== undefined && state.present === present) continue;
    fail(
      `${context}: scope node ${node} must be presented ` +
        `${present ? "present" : "absent"} (SPEC 10.4, 10.7: every scope ` +
        `node under its current identity and presence); got ` +
        JSON.stringify(state),
    );
  }
}

/** `query node`'s reports for A and A.B after A.B.C's deletion. */
interface D9Captured {
  readonly a: NodeReport;
  readonly ab: NodeReport;
}

/** Assert one presented text byte-equal to `query node`'s (SPEC 1.6, 10.7). */
function assertD9Text(
  text: string | undefined,
  expected: string,
  what: string,
  why: string,
): void {
  if (text === undefined) {
    fail(`${what}: no text is presented — it is ${why}`);
  }
  assertBytesEqual(
    text,
    expected,
    `${what} is ${why}, byte-equal to the value \`query node\` reports ` +
      `after the deletion (SPEC 1.6, 10.5: texts keep their definitions)`,
  );
}

/**
 * Assert the texts of one of the deleted-node fixture's two items as
 * `surface` presents it (TEST-SPEC T10.5-9; SPEC 1.6, 10.5, 10.7): no scope
 * or context text contains A.B.C's token, and each text the entry names is
 * byte-equal to the value `query node` reports after the deletion — A.B's
 * item's scope text to A.B's current subtree text, A's item's scope text to
 * A's current own text, and A's item's context text for A.B to A.B's current
 * subtree text.
 */
function assertD9Texts(
  item: ReviewItem,
  captured: D9Captured,
  surface: string,
): void {
  const texts = [
    { where: "scope text", text: item.scope.text },
    ...item.context.map((state) => ({
      where: `context text for ${state.node}`,
      text: state.text,
    })),
  ];
  for (const { where, text } of texts) {
    if (text === undefined || !text.includes(D9_TOKEN)) continue;
    fail(
      `${surface}: the ${where} ${JSON.stringify(text)} contains A.B.C's ` +
        `token ${D9_TOKEN} — the links bind node relations and node sets ` +
        `alone, texts keeping their definitions (SPEC 1.6, 10.5), so no ` +
        `scope or context text carries the deleted node's text; a product ` +
        `computing text over the linked tree splices A.B.C's text into ` +
        `A.B's subtree text`,
    );
  }
  if (item.kind === "subtree-coherence") {
    assertD9Text(
      item.scope.text,
      captured.ab.subtreeText,
      `${surface}: A.B's item's scope text`,
      "A.B's current subtree text — a subtree-coherence item's scope text " +
        "is the scope root's subtree text (SPEC 10.7)",
    );
    return;
  }
  assertD9Text(
    item.scope.text,
    captured.a.ownText,
    `${surface}: A's item's scope text`,
    "A's current own text — a parent-consistency item's scope text is the " +
      "scope node's own text (SPEC 10.7)",
  );
  const branch = item.context.find((state) => state.node === D9_AB);
  if (branch === undefined) {
    fail(
      `${surface}: A's item presents no context node A.B — its context is ` +
        `the changed branch beneath A, entering as A's child on it (SPEC ` +
        `10.5); it presents ${JSON.stringify(identitySet(item.context))}`,
    );
  }
  assertD9Text(
    branch.text,
    captured.ab.subtreeText,
    `${surface}: A's item's context text for A.B`,
    "A.B's current subtree text — a parent-consistency item's context " +
      "text is subtree text (SPEC 10.7)",
  );
}

/**
 * Assert one of the deleted-node fixture's items' `current` entries
 * (TEST-SPEC T10.5-9; SPEC 5.5, 10.2, 10.4, 10.5), read through the review
 * adapter's `decodeRecordedState`: written at the item's creation, after
 * the deletion, they hold the relevant hashes `query node` reports then — in
 * A.B's item A.B's subtreeHash and metadataHash, A.B.C's entry presenting it
 * absent, its hashes the explicit absent marker; in A's item A's ownHash and
 * metadataHash and A.B's subtreeHash. Entries beyond those are not
 * asserted.
 */
function assertD9Current(
  item: ReviewItem,
  captured: D9Captured,
  label: string,
): void {
  const entries = decodeRecordedState(item, "current", label);
  const held = JSON.stringify(entries.map((entry) => entry.node));
  const entryOf = (node: string): RecordedNodeEntry => {
    const entry = entries.find((candidate) => candidate.node === node);
    if (entry === undefined) {
      fail(
        `${label}: holds no entry for ${node} — \`current\` records the ` +
          `item's relevant hashes and, for every scope, context, and origin ` +
          `node, whether it is present (SPEC 10.2, 10.4); it holds entries ` +
          `for ${held}`,
      );
    }
    return entry;
  };
  const expectHash = (
    node: string,
    hash: keyof NodeHashes,
    report: NodeReport,
  ): void => {
    const entry = entryOf(node);
    const recorded = entry.hashes[hash];
    const expected = report.hashes[hash];
    if (recorded === expected) return;
    fail(
      `${label}: ${node}'s recorded ${hash} must be ` +
        `${JSON.stringify(expected)}, the value \`query node\` reports after ` +
        `the deletion — hashes keep their definitions (SPEC 5.5, 10.5) and ` +
        `\`current\` records the relevant state at the item's creation ` +
        `(10.2, 10.4)` +
        (node === D9_AB && hash === "subtreeHash"
          ? "; a product computing hashes over the linked tree folds A.B.C " +
            "into A.B's subtreeHash"
          : "") +
        `; got ` +
        (recorded !== undefined
          ? JSON.stringify(recorded)
          : entry.absentMarker
            ? "the explicit absent marker"
            : "none recorded"),
    );
  };
  if (item.kind === "subtree-coherence") {
    expectHash(D9_AB, "subtreeHash", captured.ab);
    expectHash(D9_AB, "metadataHash", captured.ab);
    const gone = entryOf(D9_ABC);
    if (!gone.present && gone.absentMarker) return;
    fail(
      `${label}: A.B.C's entry must present it absent, its hashes the ` +
        `explicit absent marker (SPEC 10.4: an absent node's hashes are ` +
        `recorded as an explicit absent marker); got ${JSON.stringify(gone)}`,
    );
  }
  expectHash(D9_A, "ownHash", captured.a);
  expectHash(D9_A, "metadataHash", captured.a);
  expectHash(D9_AB, "subtreeHash", captured.ab);
}

/**
 * The deleted-node fixture (TEST-SPEC T10.5-9): the baseline committed and
 * built; A.B.C's section deleted and built; the `changed` nodes exactly A.B
 * and A.B.C, deleted (an `impact` premise); A's and A.B's `query node`
 * reports captured; `review create --base`; then exactly the two items —
 * A.B's subtree-coherence item (scope {A.B, A.B.C}, A.B.C presented absent
 * under its baseline identity; context the root and A; origin exactly {A.B,
 * A.B.C}) and A's parent-consistency item (context exactly {A.B}; origin
 * exactly {A.B, A.B.C}; blockedBy A.B's item) — and each item's texts and
 * `current` entries in `export`, in `show`, and in `next --json`, which
 * returns A.B's item, then A's once A.B's is resolved `no-change`.
 */
async function runD9DeletedNodeFixture(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.5-9 deleted-node fixture";
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${prefix} \`build\` at the baseline`);
  await workspace.file(D9_FILE, T10_5_9_D_DELETED);
  await buildOk(
    product,
    workspace,
    `${prefix} \`build\` after A.B.C's deletion`,
  );
  assertSameJson(
    await changedNodes(product, workspace, base, prefix),
    [D9_AB, `${D9_ABC} (deleted)`].sort(),
    `${prefix} staging premise: the \`changed\` nodes are exactly A.B — it ` +
      `lost a child, a structural edit originating at the parent — and ` +
      `A.B.C, deleted; A is not \`changed\` (SPEC 5.5, 5.6)`,
  );
  const captureLabel = `${prefix} capture after the deletion`;
  const captured: D9Captured = {
    a: await queryNode(product, workspace, D9_A, captureLabel),
    ab: await queryNode(product, workspace, D9_AB, captureLabel),
  };
  await createBaseSession(product, workspace, base, "s", prefix);

  const status = await sessionStatus(product, workspace, "s", prefix);
  const expectedRows = [
    `parent-consistency ${D9_A}`,
    `subtree-coherence ${D9_AB}`,
  ].sort();
  assertSameJson(
    kindScopeSet(status),
    expectedRows,
    `${prefix}: exactly two items — A.B's subtree-coherence item, A.B ` +
      `visited (\`changed\`, no \`changed\` ancestor), and A's ` +
      `parent-consistency item, A the one non-root ancestor on its path ` +
      `(SPEC 10.5)`,
  );
  const exported = await exportSession(product, workspace, "s", prefix);
  assertSameJson(
    [...exportKindScopeSequence(exported.items)].sort(),
    expectedRows,
    `${prefix}: \`export\` presents the same two items (SPEC 10.5, 10.7)`,
  );
  const one = `${prefix} A.B's subtree-coherence item`;
  const abItem = requireItem(exported.items, "subtree-coherence", D9_AB, one);
  assertScopePresence(
    abItem,
    [
      [D9_AB, true],
      [D9_ABC, false],
    ],
    one,
    "exactly {A.B, A.B.C} — A.B and all its descendants, the deleted A.B.C " +
      "the child of its baseline parent A.B, presented absent under its " +
      "baseline identity (SPEC 10.4, 10.5); a product linking deleted nodes " +
      "nowhere gives it the scope {A.B}",
  );
  assertSameJson(
    identitySet(abItem.context),
    [D9_ROOT, D9_A].sort(),
    `${one}: context A.B's ancestor chain, the root and A (SPEC 10.5)`,
  );
  assertSameJson(
    identitySet(abItem.origin),
    [D9_AB, D9_ABC].sort(),
    `${one}: origin exactly {A.B, A.B.C} — the \`changed\` nodes in its ` +
      `scope, the deleted A.B.C among them (SPEC 5.6, 10.5); a product ` +
      `linking deleted nodes nowhere gives it the origin {A.B}`,
  );
  const two = `${prefix} A's parent-consistency item`;
  const aItem = requireItem(exported.items, "parent-consistency", D9_A, two);
  assertSameJson(
    identitySet(aItem.context),
    [D9_AB],
    `${two}: context exactly {A.B} — the one changed branch beneath A, ` +
      `entering as A's child on it (SPEC 10.5)`,
  );
  assertSameJson(
    identitySet(aItem.origin),
    [D9_AB, D9_ABC].sort(),
    `${two}: origin exactly {A.B, A.B.C} — the \`changed\` nodes in A's ` +
      `subtree, the deleted A.B.C linked under its baseline parent A.B ` +
      `(SPEC 5.6, 10.5); a product linking deleted nodes nowhere gives it ` +
      `the origin {A.B}`,
  );
  assertBlockedBy(
    aItem,
    [abItem.id],
    `${two}: blocked by A.B's subtree-coherence item — A.B, A's child on ` +
      `its one changed branch, is itself visited (SPEC 10.5)`,
  );

  // Texts and hashes keep their definitions (SPEC 1.6, 5.5, 10.5), in
  // `export`, in `show`, and in the `next` walk.
  const items = [
    { item: abItem, name: "A.B's item" },
    { item: aItem, name: "A's item" },
  ];
  for (const { item, name } of items) {
    const surface = `${prefix} \`export\`'s ${name}`;
    assertD9Texts(item, captured, surface);
    assertD9Current(item, captured, `${surface} \`current\``);
  }
  for (const { item, name } of items) {
    const surface = `${prefix} \`review show s ${item.id}\` (${name})`;
    const shown = await showItem(product, workspace, "s", item.id, surface);
    if (
      shown.id !== item.id ||
      shown.kind !== item.kind ||
      shown.scope.node !== item.scope.node
    ) {
      fail(
        `${surface}: reports ${name}, ${item.kind} ${item.scope.node} ` +
          `(SPEC 10.7: the full item); got ${JSON.stringify({
            id: shown.id,
            kind: shown.kind,
            scope: shown.scope.node,
          })}`,
      );
    }
    assertD9Texts(shown, captured, surface);
    assertD9Current(shown, captured, `${surface} \`current\``);
  }
  const walk = [
    { item: abItem, name: "A.B's item", step: "first" },
    { item: aItem, name: "A's item", step: "second" },
  ];
  for (const { item, name, step } of walk) {
    const surface = `${prefix} ${step} \`review next s --json\``;
    const next = await nextItem(product, workspace, "s", surface);
    if (next.id !== item.id) {
      fail(
        `${surface}: returns ${name}, ${item.id} — the first needing-review ` +
          `unblocked item in item order (SPEC 10.5, 10.7)` +
          (step === "second"
            ? ", A's item unblocked once A.B's is resolved"
            : ", A's item blocked by it") +
          `; got ${next.id} (${next.kind} ${next.scope.node})`,
      );
    }
    assertD9Texts(next, captured, surface);
    assertD9Current(next, captured, `${surface} \`current\``);
    if (step === "first") {
      await resolveOk(
        product,
        workspace,
        "s",
        item.id,
        "no-change",
        `${prefix} \`review resolve s ${item.id} --status no-change\` ` +
          `(A.B's item)`,
      );
    }
  }
}

/**
 * The journal arm (TEST-SPEC T10.5-9): after the baseline, `rename` A.B to
 * A.B2 (A.B.C becoming A.B2.C by prefix replacement, SPEC 6.4) and A.B2.C's
 * section deleted by manual edit; the `changed` nodes exactly A.B2 and
 * A.B2.C, deleted (an `impact` premise); `review create --base`; then the
 * same two items under the mapped identities — A.B2's scope {A.B2, A.B2.C},
 * the deleted node presented absent under A.B2.C, its baseline identity
 * mapped forward through the journal, never under A.B.C and never outside
 * A.B2's subtree, its origin {A.B2, A.B2.C}; A's item context {A.B2},
 * origin {A.B2, A.B2.C}.
 */
async function runD9JournalArm(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.5-9 journal arm";
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${prefix} \`build\` at the baseline`);
  await expectExit(
    product,
    workspace,
    ["rename", D9_FILE, "A.B", "A.B2"],
    0,
    `${prefix} \`rename specs/D.mdx A.B A.B2\` (SPEC 6.4)`,
  );
  await editRewritten(
    workspace,
    D9_FILE,
    D9_AB2C_SECTION,
    "",
    `${prefix} A.B2.C's section, deleted by manual edit after the rename`,
  );
  await buildOk(
    product,
    workspace,
    `${prefix} \`build\` after A.B2.C's deletion`,
  );
  assertSameJson(
    await changedNodes(product, workspace, base, prefix),
    [D9_AB2, `${D9_AB2C} (deleted)`].sort(),
    `${prefix} staging premise: the \`changed\` nodes are exactly A.B2 — it ` +
      `lost a child — and A.B2.C, deleted, reported under its baseline ` +
      `identity mapped forward through the journal; the journaled rename ` +
      `itself changes no hash (SPEC 5.6, 6.2, 6.3, 9.3)`,
  );
  await createBaseSession(product, workspace, base, "s", prefix);

  const status = await sessionStatus(product, workspace, "s", prefix);
  const expectedRows = [
    `parent-consistency ${D9_A}`,
    `subtree-coherence ${D9_AB2}`,
  ].sort();
  assertSameJson(
    kindScopeSet(status),
    expectedRows,
    `${prefix}: the same two items — A.B2's subtree-coherence item and A's ` +
      `parent-consistency item (SPEC 10.5)`,
  );
  const exported = await exportSession(product, workspace, "s", prefix);
  assertSameJson(
    [...exportKindScopeSequence(exported.items)].sort(),
    expectedRows,
    `${prefix}: \`export\` presents the same two items (SPEC 10.5, 10.7)`,
  );
  assertNeverPresented(exported.items, D9_ABC, D9_AB2C, prefix);
  const one = `${prefix} A.B2's subtree-coherence item`;
  const ab2Item = requireItem(exported.items, "subtree-coherence", D9_AB2, one);
  assertScopePresence(
    ab2Item,
    [
      [D9_AB2, true],
      [D9_AB2C, false],
    ],
    one,
    "exactly {A.B2, A.B2.C} — the deleted node the child of its baseline " +
      "parent, identities mapped through the journal (SPEC 6.3, 10.5), " +
      "presented absent under A.B2.C, its baseline identity mapped forward " +
      "(10.4) — never under A.B.C, and never outside A.B2's subtree",
  );
  assertSameJson(
    identitySet(ab2Item.context),
    [D9_ROOT, D9_A].sort(),
    `${one}: context A.B2's ancestor chain, the root and A (SPEC 10.5)`,
  );
  assertSameJson(
    identitySet(ab2Item.origin),
    [D9_AB2, D9_AB2C].sort(),
    `${one}: origin exactly {A.B2, A.B2.C} — the \`changed\` nodes in its ` +
      `scope, the deleted node under its mapped identity (SPEC 5.6, 10.4, ` +
      `10.5)`,
  );
  const two = `${prefix} A's parent-consistency item`;
  const aItem = requireItem(exported.items, "parent-consistency", D9_A, two);
  assertSameJson(
    identitySet(aItem.context),
    [D9_AB2],
    `${two}: context exactly {A.B2} — the one changed branch beneath A, ` +
      `entering as A's child on it (SPEC 10.5)`,
  );
  assertSameJson(
    identitySet(aItem.origin),
    [D9_AB2, D9_AB2C].sort(),
    `${two}: origin exactly {A.B2, A.B2.C} — the \`changed\` nodes in A's ` +
      `subtree, the deleted node linked under its baseline parent mapped ` +
      `through the journal (SPEC 5.6, 6.3, 10.5)`,
  );
  assertBlockedBy(
    aItem,
    [ab2Item.id],
    `${two}: blocked by A.B2's subtree-coherence item, A.B2 itself visited ` +
      `(SPEC 10.5)`,
  );
}

/**
 * The audit contrast (TEST-SPEC T10.5-9; SPEC 10.5, 10.6): an audit session
 * over the baseline file, A.B.C's section deleted by manual edit after
 * `create`, then A.B.C's item resolved `updated` — its re-derivation: A.B's
 * re-derived item has scope exactly {A.B} — an audit item's scope is the
 * node and all its current descendants, and an audit session has no
 * baseline to link a deleted node under — and an empty `blockedBy`, while
 * A.B.C's item remains (10.5: items no longer generated remain).
 */
async function runD9AuditContrast(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.5-9 audit contrast";
  await buildOk(product, workspace, `${prefix} \`build\``);
  await expectExit(
    product,
    workspace,
    ["review", "create", "--strategy", "audit", "--name", "a"],
    0,
    `${prefix} \`review create --strategy audit --name a\``,
  );
  const created = await sessionStatus(product, workspace, "a", prefix);
  const abcId = requireRow(created, "subtree-coherence", D9_ABC, prefix).id;
  await workspace.file(D9_FILE, T10_5_9_D_DELETED);
  await buildOk(
    product,
    workspace,
    `${prefix} \`build\` after A.B.C's deletion`,
  );
  await resolveOk(
    product,
    workspace,
    "a",
    abcId,
    "updated",
    `${prefix} \`review resolve a ${abcId} --status updated\` (A.B.C's item) ` +
      `— its re-derivation (SPEC 10.5)`,
  );
  const exported = await exportSession(product, workspace, "a", prefix);
  const label = `${prefix} A.B's re-derived item`;
  const abItem = requireItem(exported.items, "subtree-coherence", D9_AB, label);
  assertSameJson(
    identitySet(requireScopeNodes(abItem, label)),
    [D9_AB],
    `${label}: scope exactly {A.B} — an audit item's scope is the node and ` +
      `all its current descendants (SPEC 10.6), the re-derivation taking ` +
      `the generated scope (10.5); a deleted node is the child of its ` +
      `baseline parent in a baseline session alone, and an audit session ` +
      `has none`,
  );
  assertBlockedBy(
    abItem,
    [],
    `${label}: blockedBy empty — recomputed for every generated item (SPEC ` +
      `10.5), an audit item's being its child sections' items (10.6), of ` +
      `which A.B has none left`,
  );
  const remaining = exported.items.filter((item) => item.id === abcId);
  if (
    remaining.length !== 1 ||
    remaining[0].kind !== "subtree-coherence" ||
    remaining[0].scope.node !== D9_ABC
  ) {
    fail(
      `${prefix}: A.B.C's subtree-coherence item ${abcId} remains in the ` +
        `session, scoped at A.B.C — items no longer generated remain (SPEC ` +
        `10.5); \`export\` presents ` +
        JSON.stringify(
          exported.items.map(
            (item) => `${item.id} ${item.kind} ${item.scope.node}`,
          ),
        ),
    );
  }
}

/**
 * Assert one of the present-node arm's sessions (TEST-SPEC T10.5-9; SPEC
 * 6.3, 10.4, 10.5): exactly two items, in this order, in `status` and
 * `export` — P1's subtree-coherence item, scope and origin exactly {P1},
 * and P2's, scope {P2, P2.M, P2.M.c} — each with context specs/R.mdx and an
 * empty `blockedBy`. After the deletion (`deleted`) P2.M.c is presented
 * absent under its baseline identity mapped forward through the journal,
 * never under P1.M.c, and P2's origin is exactly {P2, P2.M, P2.M.c}; in the
 * twin, before it, every scope node is present and P2's origin is exactly
 * {P2}.
 */
async function assertP9Session(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  deleted: boolean,
  prefix: string,
): Promise<void> {
  const status = await sessionStatus(product, workspace, name, prefix);
  assertSameJson(
    kindScopeSequence(status.items),
    P9_EXPECTED_SEQUENCE,
    `${prefix}: exactly two items, in this order — P1's subtree-coherence ` +
      `item, then P2's: P1 and P2 each \`changed\` with no \`changed\` ` +
      `ancestor, of one depth, kind, and file, in document order (SPEC ` +
      `10.5)` +
      (deleted
        ? "; P2.M and P2.M.c, `changed` beneath P2, are skipped under it"
        : ""),
  );
  const exported = await exportSession(product, workspace, name, prefix);
  assertSameJson(
    exportKindScopeSequence(exported.items),
    P9_EXPECTED_SEQUENCE,
    `${prefix}: \`export\` presents the same two items in item order (SPEC ` +
      `10.5, 10.7)`,
  );
  if (deleted) {
    assertNeverPresented(exported.items, P9_P1MC, P9_P2MC, prefix);
  }
  const one = `${prefix} P1's subtree-coherence item`;
  const p1Item = requireItem(exported.items, "subtree-coherence", P9_P1, one);
  assertScopePresence(
    p1Item,
    [[P9_P1, true]],
    one,
    "exactly {P1} — the moved P2.M and P2.M.c, present nodes, are children " +
      "of their current parents, never of their baseline parents (SPEC " +
      "10.5); a product linking present nodes under their baseline parents " +
      "gives it the moved subtree, {P1, P2.M, P2.M.c}",
  );
  assertSameJson(
    identitySet(p1Item.origin),
    [P9_P1],
    `${one}: origin exactly {P1} — the \`changed\` nodes in its scope (SPEC ` +
      `10.5)`,
  );
  const two = `${prefix} P2's subtree-coherence item`;
  const p2Item = requireItem(exported.items, "subtree-coherence", P9_P2, two);
  assertScopePresence(
    p2Item,
    [
      [P9_P2, true],
      [P9_P2M, true],
      [P9_P2MC, !deleted],
    ],
    two,
    deleted
      ? "exactly {P2, P2.M, P2.M.c} — P2.M a present node, the child of its " +
          "current parent P2, and P2.M.c, deleted, the child of its baseline " +
          "parent P1.M mapped through the journal to P2.M (SPEC 6.3, 10.5), " +
          "presented absent under its baseline identity mapped forward, " +
          "never under P1.M.c (10.4); a product linking present nodes under " +
          "their baseline parents gives it the scope {P2}, and one linking " +
          "the deleted node under its unmapped baseline parent leaves P2.M.c " +
          "out"
      : "exactly {P2, P2.M, P2.M.c}, every node present — the moved nodes " +
          "children of their current parents (SPEC 10.5); a product linking " +
          "present nodes under their baseline parents gives it the scope {P2}",
  );
  assertSameJson(
    identitySet(p2Item.origin),
    deleted ? [P9_P2, P9_P2M, P9_P2MC].sort() : [P9_P2],
    `${two}: origin exactly ` +
      (deleted
        ? "{P2, P2.M, P2.M.c} — the `changed` nodes in its scope, P2.M " +
          "having lost a child and P2.M.c deleted"
        : "{P2} — the one `changed` node in its scope, the moved subtree's " +
          "nodes keeping their hashes") +
      ` (SPEC 5.6, 6.2, 10.5)`,
  );
  for (const [item, label] of [
    [p1Item, one],
    [p2Item, two],
  ] as const) {
    assertSameJson(
      identitySet(item.context),
      [P9_ROOT],
      `${label}: context specs/R.mdx — a top-level node's ancestor chain, ` +
        `its file's root (SPEC 10.5)`,
    );
    assertBlockedBy(
      item,
      [],
      `${label}: blockedBy empty — path-blocks gives blockers to ` +
        `parent-consistency items alone (SPEC 10.2, 10.5)`,
    );
  }
}

/**
 * The present-node arm (TEST-SPEC T10.5-9): the baseline committed and
 * built; the journaled `move specs/R.mdx#P1.M specs/R.mdx#P2.M` (P1.M.c
 * becoming P2.M.c by prefix replacement, SPEC 6.5), leaving `changed` the
 * two parents alone (an `impact` premise; 6.2); the twin's session `t`
 * created and asserted; P2.M.c's section deleted by manual edit and built,
 * the `changed` nodes then exactly P1, P2, P2.M, and P2.M.c, deleted (an
 * `impact` premise); and the session `s` created and asserted.
 */
async function runP9PresentNodeArm(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const prefix = "T10.5-9 present-node arm";
  await workspace.gitInit();
  const base = await workspace.gitCommitAll("baseline");
  await buildOk(product, workspace, `${prefix} \`build\` at the baseline`);
  await expectExit(
    product,
    workspace,
    ["move", "specs/R.mdx#P1.M", "specs/R.mdx#P2.M"],
    0,
    `${prefix} \`move specs/R.mdx#P1.M specs/R.mdx#P2.M\` (SPEC 6.5)`,
  );
  const twin = `${prefix}'s twin, stopping before the deletion`;
  assertSameJson(
    await changedNodes(product, workspace, base, twin),
    [P9_P1, P9_P2].sort(),
    `${twin} staging premise: the move leaves \`changed\` the two parents ` +
      `alone — P1 lost its child P1.M, P2 gained P2.M — every node of the ` +
      `moved subtree keeping its hashes, none with own-content bytes on the ` +
      `moved construct's boundary lines (SPEC 5.6, 6.2; TEST-SPEC T6.2-3)`,
  );
  await createBaseSession(product, workspace, base, "t", twin);
  await assertP9Session(product, workspace, "t", false, twin);
  await editRewritten(
    workspace,
    P9_FILE,
    P9_P2MC_SECTION,
    "",
    `${prefix} P2.M.c's section, deleted by manual edit after the move`,
  );
  await buildOk(
    product,
    workspace,
    `${prefix} \`build\` after P2.M.c's deletion`,
  );
  assertSameJson(
    await changedNodes(product, workspace, base, prefix),
    [P9_P1, P9_P2, P9_P2M, `${P9_P2MC} (deleted)`].sort(),
    `${prefix} staging premise: the \`changed\` nodes are exactly the two ` +
      `parents, P2.M — it lost a child — and P2.M.c, deleted, reported ` +
      `under its baseline identity mapped forward through the journal, both ` +
      `beneath the \`changed\` P2 (SPEC 5.6, 6.3, 9.3)`,
  );
  await createBaseSession(product, workspace, base, "s", prefix);
  await assertP9Session(product, workspace, "s", true, prefix);
}

const T10_5_9 = defineProductTest({
  id: "T10.5-9",
  title:
    "deleted and moved nodes in baseline sessions: a node deleted since the baseline is the child of its baseline parent, identities mapped through the journal, and a present node the child of its current parent, as node relations and node sets alone — with specs/D.mdx holding A holding A.B holding A.B.C committed as the baseline and A.B.C's section then deleted (A.B `changed` and visited, A not `changed`), `review create --base` yields exactly two items: A.B's subtree-coherence item (scope {A.B, A.B.C}, A.B.C presented absent under its baseline identity; context the root and A; origin exactly {A.B, A.B.C}) and A's parent-consistency item (context exactly {A.B}; origin exactly {A.B, A.B.C}; blockedBy A.B's item); texts and hashes keep their definitions — in `export`, `show`, and `next --json` (A.B's item, then A's once A.B's is resolved `no-change`) A.B's item's scope text and A's item's context text for A.B are A.B's current subtree text and A's item's scope text A's current own text, byte-equal to `query node`'s, no scope or context text carrying A.B.C's token, and the items' `current` entries — A.B's subtreeHash and metadataHash in A.B's item, A's ownHash and metadataHash and A.B's subtreeHash in A's — equal `query node`'s after the deletion, A.B.C's the explicit absent marker; journal arm: after `rename` A.B to A.B2 and A.B2.C's section deleted, the same two items, A.B2's scope and origin {A.B2, A.B2.C}, the deleted node presented absent under A.B2.C — never under A.B.C, never outside A.B2's subtree — and A's item context {A.B2}, origin {A.B2, A.B2.C}; audit contrast: in an audit session, A.B.C's section deleted after `create` and A.B.C's item resolved `updated`, A.B's re-derived item has scope exactly {A.B} and an empty blockedBy, A.B.C's item remaining; present-node arm: with specs/R.mdx holding P1 holding P1.M holding P1.M.c, then P2, every tag alone on its line, after the journaled `move specs/R.mdx#P1.M specs/R.mdx#P2.M` (the two parents alone `changed`) and P2.M.c's section deleted, exactly two items in order — P1's subtree-coherence item (scope and origin exactly {P1}) and P2's (scope {P2, P2.M, P2.M.c}, P2.M.c presented absent under its baseline identity mapped forward through the journal, never under P1.M.c; origin exactly {P2, P2.M, P2.M.c}) — each with context specs/R.mdx and an empty blockedBy, and a twin stopping before the deletion yields the same two items, P2's scope every node present and its origin exactly {P2} (SPEC 1.6, 5.5, 5.6, 6.2, 6.3, 10.4, 10.5, 10.6, 10.7)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [D9_FILE]: T10_5_9_D_INITIAL },
      (workspace) => runD9DeletedNodeFixture(product, workspace),
    );
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [D9_FILE]: T10_5_9_D_INITIAL },
      (workspace) => runD9JournalArm(product, workspace),
    );
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [D9_FILE]: T10_5_9_D_INITIAL },
      (workspace) => runD9AuditContrast(product, workspace),
    );
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [P9_FILE]: T10_5_9_R_INITIAL },
      (workspace) => runP9PresentNodeArm(product, workspace),
    );
  },
});

/** TEST-SPEC §10.5, in canonical ID order (SUITE-36). */
export const section105Tests: readonly ProductTestEntry[] = [
  T10_5_1,
  T10_5_2,
  T10_5_3,
  T10_5_4,
  T10_5_5,
  T10_5_6,
  T10_5_7,
  T10_5_8,
  T10_5_9,
];
