// TEST-SPEC §10.5 (built-in strategy: path-blocks) — SUITE-36:
// T10.5-1…T10.5-6.
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
// `dependency-consistency` item per node having, in the current graph, a
// dependency edge to a both-sides target whose effectiveHash changed, and
// one `code-impact` item per impacted location, whatever its code
// categories — the last two's origins the originating nodes of their
// targets' categories, a target's `metadata-changed` counting only when its
// `d` targets changed. Items are totally ordered (depth deepest-first, kind,
// file path, document order; `code-impact` last by location identity;
// absent scopes after present ones). Resolving `updated` re-derives the
// session with the recorded creation parameters; `split` decompositions
// apply recursively and are never re-added.
//
// Conservative operationalizations (noted per H-3/H-4):
// - `context` and `origin` are asserted as sorted identity sets: SPEC 10.5
//   fixes their membership, not a payload order; texts and byte-level payload
//   contracts are T10.7-12's business.
// - `blockedBy` is compared as a sorted id set (SPEC 10.5/10.7 fix which
//   items block, not an order within the field).
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
// - A resolved item whose recorded context set changes is expected
//   `invalidated` on reads even after a re-derivation updates its context
//   set (SPEC 10.5: a matched item whose context set changed "is updated
//   and, when resolved, becomes `invalidated`"), and stays so until
//   re-resolved.
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
//   v.e and v.f and its tie sub-fixture's two specs/X.mdx stagings,
//   T10.5-5's p.b edit, r.c revert, and both decomposition edits, T10.5-6's
//   par.s edit — is the same template call moved to module level as a
//   record, as is the initial `.mdx` file of every workspace created after
//   the body's first `build` (T10.5-1's extended fixture, chain fixture,
//   and the chain fixture's both-edited twin, T10.5-3's current-graph-edges,
//   origin-counting, and one-item-per-location workspaces, T10.5-4's tie
//   sub-fixture, T10.5-5's decomposition sub-fixture). A
//   staging that precedes a body's first `build` (each fixture's first edit,
//   between `gitCommitAll` and that `build`) stays plain, as do each body's
//   first workspace's initial `files` entries (S-7's sweep reaches them
//   against the stub). The tie sub-fixture's deletions are plain removals
//   of files (`fsp.rm`), which S-9 does not judge.
// - The configuration of every workspace created after a body's first
//   `build` (T10.5-1's extended fixture, chain fixture, and the chain
//   fixture's both-edited twin, T10.5-3's current-graph-edges workspace,
//   T10.5-4's tie sub-fixture, T10.5-5's decomposition sub-fixture) is
//   `SPECS_ONLY_CONFIG`, a TypeScript staged-source record
//   (helpers/staged-ts.ts; S-9's TypeScript and timing clauses),
//   well-formed, staged wherever that configuration is; `SPECS_CODE_CONFIG`
//   serves only bodies' first workspaces and stays plain, its bytes staged
//   in T10.5-3's origin-counting and one-item-per-location workspaces as the
//   record `T10_5_3_CODE_CONFIG`, beside their code sources, records too
//   (`T10_5_3_OC_CODE`, `T10_5_3_L_BOTH_TS`).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import type {
  ExportReport,
  ItemStatus,
  NodeHashes,
  NodeReport,
  ReviewItem,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  decodeExportReport,
  decodeImpactReport,
  decodeItemReport,
  decodeNextReport,
  decodeNodeReport,
  decodeSessionStatusReport,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { type StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { assertSameJson, buildOk, expectExit, runJson } from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = stagedTs(
  "T10.5-1/T10.5-3/T10.5-4/T10.5-5 xspec.config.ts — one spec group",
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
// T10.5-5 — re-derivation on `updated`
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

const T10_5_5 = defineProductTest({
  id: "T10.5-5",
  title:
    "re-derivation on `updated`: resolving with no-change/skipped does not re-derive — after a sibling-subtree edit the item set is unchanged and the edit surfaces as read-time invalidation of the resolved parent-consistency item (context-set change with hash premises), not as new items; an `updated` resolve re-derives with the recorded baseline — the newly changed sibling's subtree-coherence item appears in item order created `unresolved` (the trigger's `updated` does not propagate), a matching kind+scope item keeps its id, status, and recorded state, and blockedBy is recomputed; items no longer generated (after reverting their edit) remain with their blockedBy and retain their recorded context set, presented unchanged by show/export after the re-derivation; after two nested `split`s a decomposed kind+scope is never re-added — its decomposition applies recursively, covering a child authored after the splits — and every blockedBy reference to a decomposed item is replaced by all items of its decomposition (SPEC 10.4, 10.5, 10.7)",
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
        // Matching items keep id, status, and recorded state (SPEC 10.5).
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
          `${prefix}: r's no-longer-generated item retains its recorded ` +
            `context set — \`export\` after the re-derivation presents it ` +
            `unchanged (SPEC 10.4, 10.5)`,
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
          `${prefix}: \`show\` presents the retained context unchanged too ` +
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

/** TEST-SPEC §10.5, in canonical ID order (SUITE-36). */
export const section105Tests: readonly ProductTestEntry[] = [
  T10_5_1,
  T10_5_2,
  T10_5_3,
  T10_5_4,
  T10_5_5,
  T10_5_6,
];
