// TEST-SPEC §10.6 (built-in strategy: audit) — SUITE-37: T10.6-1…T10.6-3.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.6: `audit` creates one `subtree-coherence` item per requirement
// node — root nodes included — with the node's ancestor chain as context, an
// empty origin, and scope as in 10.5 (the node and all its descendants). Item
// order is scope-node file path first (byte order), then document order
// within the file; blocking, not order, enforces bottom-up review: each
// item's `blockedBy` is the set of its child sections' items — after a
// `split`, the items of their decompositions (10.5, 10.7) — so leaf items are
// unblocked. Audit requires no baseline and reviews the entire workspace, and
// the resolve-time re-derivation of 10.5 holds for it too (`audit` records no
// creation parameters: its generators run against the current workspace).
//
// Conservative operationalizations (noted per H-3/H-4):
// - `context` and `origin` are asserted as sorted identity sets: SPEC 10.6
//   fixes their membership, not a payload order; texts and byte-level payload
//   contracts are T10.7-12's business.
// - `blockedBy` is compared as a sorted id set (SPEC 10.6/10.7 fix which
//   items block, not an order within the field).
// - Item order is asserted as the exact `(kind, scope)` row sequence of
//   `status` and `export`; `next`'s presentation of the order is asserted by
//   walking the session (repeated `next` + `resolve --status no-change`),
//   whose visit order is fully determined by item order plus the asserted
//   `blockedBy` sets.
// - A file's root item precedes the file's other items in document order:
//   SPEC 1.2, the implicit root "precedes every section of its file in
//   document order".
// - The absent-scope ordering keys exercised are scope-node identity, staged
//   discriminatingly (recorded document order opposite to identity order),
//   and the final item `id` tiebreak. The tiebreak needs two same-kind
//   absent items with equal identity strings: same kind forces distinct
//   scope nodes (10.5: at most one item per kind and scope node), and
//   distinct nodes present one identity only through reintroduction after a
//   journaled rename or move (5.4: the reintroducing node starts a new
//   canonical chain; 10.4: reads map each recorded identity forward through
//   the journal). T10.6-2's item-id tie sub-fixture stages it with two
//   sections of one file: the original a, renamed to b by a journaled
//   `rename` and deleted by manual edit, and a new section a — authored
//   after that rename, its item entering through an `updated` resolve's
//   re-derivation (10.5) — renamed to b in turn and deleted. Both items then
//   present their scope absent under specs/A.mdx#b, and the sub-fixture
//   asserts them after the file's present-scope items in item-id byte order
//   (12.0) in `status`, `export`, and the `next` walk, reading the ids from
//   the product. In audit a section carries the tie — every node has its
//   item, so the new section's enters in its own right — where path-blocks
//   needs two file roots (T10.5-4).
// - Git-less staging (T10.6-1; also kept for the other two fixtures, which
//   need no baseline either): the workspace is never `git init`ed, and it
//   lives in a fresh directory under the OS temporary directory, which is
//   outside any repository — so audit `create` and the reads run with no
//   enclosing git repository at all.
// - Every fixture edit is followed by an explicit `build` before any read,
//   so no read relies on the 13.3 refresh path (T13.3-*'s business).
// - Recorded state (`baseline`/`current`) is product-shaped and opaque
//   (H-3/H-4): "keeps its recorded state" is asserted as canonical-JSON
//   equality of the fields across reads, and "with current state" via the
//   entry-time relevant-hash values (captured through `query node` at the
//   recorded moment) appearing among the record's string leaves — the same
//   operationalizations as §10.2/§10.4.
// - Staged-source records (helpers/staged-mdx.ts, S-9: judged before any
//   product exists): every `.mdx` edit a body stages after its first product
//   invocation over the harness's own bytes — T10.6-2's deletion of f and e,
//   T10.6-3's authoring and editing of p.b — is the same template call moved
//   to module level as a record, as is the initial file of each later
//   T10.6-2 workspace (created after the body's first `build`): the split
//   sub-fixture's (the f-and-e deletion's record, whose bytes it spells) and
//   the item-id tie sub-fixture's. That sub-fixture's three edits follow a
//   `rename` and change bytes the product rewrote, which no harness constant
//   equals, so each is an anchored `workspace.edit()`, its anchor's
//   uniqueness diagnosed first (SPEC 6.4 fixes the rewritten form), as
//   T10.4-4's reintroduction arm stages. Each body's first workspace's
//   initial `files` entries stay plain (S-7's sweep reaches them against
//   the stub).
// - Every workspace stages `SPECS_ONLY_CONFIG`, and T10.6-2's split and
//   item-id tie sub-fixtures are created after the body's first `build`, so
//   the configuration is a TypeScript staged-source record
//   (helpers/staged-ts.ts; S-9's TypeScript and timing clauses), well-formed,
//   staged in every workspace.

import { Buffer } from "node:buffer";
import type {
  ExportReport,
  ItemStatus,
  NodeReport,
  ReviewItem,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  decodeExportReport,
  decodeItemReport,
  decodeNextReport,
  decodeNodeReport,
  decodeSessionStatusReport,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { assertSameJson, buildOk, expectExit, runJson } from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. Audit
// fixtures need no code group — audit derives `subtree-coherence` items only.
const SPECS_ONLY_CONFIG = stagedTs(
  "T10.6-2 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": SPECS_ONLY_CONFIG, ...files },
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
 * node — the invariant holds for every strategy).
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
        `(SPEC 10.1, 10.5: at most one item per kind and scope node); found ` +
        `${String(matches.length)} among ` +
        JSON.stringify(items.map((item) => `${item.kind} ${item.scope.node}`)),
    );
  }
  return matches[0];
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
 * Assert an item's `blockedBy` as a sorted id set (SPEC 10.6/10.7 fix which
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
    `${context}: blockedBy (compared as a sorted id set; SPEC 10.6, 10.7)`,
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
 * The recorded state must hold the given hash value among its string leaves
 * (SPEC 10.2/10.4: the record holds the item's relevant hashes; the value is
 * the one `query node` reported at the recorded moment).
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
      `(SPEC 10.2, 10.4; H-4: opaque shape, spec-fixed values) — but it ` +
      `appears nowhere in ${canonicalJson(recorded)}`,
  );
}

/**
 * Walk a session to full resolution: repeated `next --json` + `resolve
 * --status no-change`, asserting `next` visits exactly `expectedIds` in
 * order, then reports the session fully resolved (SPEC 10.6, 10.7: `next`
 * returns the first needing-review unblocked item in item order — bottom-up
 * through the audit `blockedBy` sets, order within the unblocked by item
 * order).
 */
async function walkSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  expectedIds: readonly string[],
  describeExpected: (index: number) => string,
  context: string,
): Promise<void> {
  for (let index = 0; index < expectedIds.length; index += 1) {
    const stepLabel =
      `${context} \`review next ${name} --json\` walk step ` +
      `${String(index + 1)} of ${String(expectedIds.length)}`;
    const next = decodeNextReport(
      await runJson(
        product,
        workspace,
        ["review", "next", name, "--json"],
        stepLabel,
      ),
      stepLabel,
    );
    if (next.fullyResolved || next.item === undefined) {
      fail(
        `${stepLabel}: needing-review items remain, so \`next\` must return ` +
          `one (SPEC 10.7)`,
      );
    }
    if (next.item.id !== expectedIds[index]) {
      fail(
        `${stepLabel}: \`next\` returns the first needing-review unblocked ` +
          `item in item order (SPEC 10.6, 10.7) — expected ` +
          `${expectedIds[index]} (${describeExpected(index)}), got ` +
          `${next.item.id} (${next.item.kind} ${next.item.scope.node})`,
      );
    }
    await resolveOk(
      product,
      workspace,
      name,
      next.item.id,
      "no-change",
      `${stepLabel} — \`resolve --status no-change\` to advance the walk`,
    );
  }
  const doneLabel = `${context} \`review next ${name} --json\` after the walk`;
  const done = decodeNextReport(
    await runJson(
      product,
      workspace,
      ["review", "next", name, "--json"],
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
}

// ---------------------------------------------------------------------------
// T10.6-1 — generation, git-less
// ---------------------------------------------------------------------------

// Two files (audit "reviews the entire workspace", SPEC 10.6), never
// `git init`ed: G.mdx holds a nested branch (p > p.a — the subtree-scope
// discriminator) and a second top-level section; H.mdx pins the second root.
const G_FILE = "specs/G.mdx";
const G_ROOT = "specs/G.mdx";
const G_P = "specs/G.mdx#p";
const G_PA = "specs/G.mdx#p.a";
const G_TOP = "specs/G.mdx#top";
const H_FILE = "specs/H.mdx";
const H_ROOT = "specs/H.mdx";
const H_K = "specs/H.mdx#k";

const G_SOURCE = [
  '<S id="p">',
  "Pee own text.",
  "",
  '<S id="p.a">',
  "Paa text.",
  "</S>",
  "</S>",
  "",
  '<S id="top">',
  "Top text.",
  "</S>",
  "",
].join("\n");

const H_SOURCE = ['<S id="k">', "Kay text.", "</S>", ""].join("\n");

const T10_6_1 = defineProductTest({
  id: "T10.6-1",
  title:
    "audit generation in a git-less workspace: `review create --strategy audit` needs no baseline — the whole fixture (build, create, status, export, query) runs in a workspace that is not a git repository and has no enclosing one — and derives exactly one subtree-coherence item per requirement node across the entire workspace, root nodes included (two files, six nodes, six items); each item's context is the node's ancestor chain (empty for the two root items), its origin is empty, and its scope is the node plus all descendants — the scope root is the node and its scope text is the scope root's subtree text, asserted where subtree and own text differ (a root and a branch node) (SPEC 1.2, 10.5, 10.6, 10.7)",
  timeoutMs: 180_000,
  run: async (product) => {
    await withWorkspace(
      { [G_FILE]: G_SOURCE, [H_FILE]: H_SOURCE },
      async (workspace) => {
        const prefix = "T10.6-1";
        // Git-less staging premise: the workspace was never `git init`ed —
        // audit requires no baseline, so everything below must succeed
        // without git (SPEC 10.6; T12.0-12 names this test as one instance
        // of its git-less sweep).
        const gitKind = await workspace.kind(".git");
        if (gitKind !== "absent") {
          fail(
            `${prefix} staging premise: the workspace must be git-less ` +
              `(no .git entry); found ${gitKind}`,
          );
        }
        await buildOk(product, workspace, `${prefix} git-less \`build\``);
        await createAuditSession(product, workspace, "s", prefix);

        const status = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSet(status),
          [
            `subtree-coherence ${G_ROOT}`,
            `subtree-coherence ${G_P}`,
            `subtree-coherence ${G_PA}`,
            `subtree-coherence ${G_TOP}`,
            `subtree-coherence ${H_ROOT}`,
            `subtree-coherence ${H_K}`,
          ].sort(),
          `${prefix}: audit derives exactly one subtree-coherence item per ` +
            `requirement node of the entire workspace, root nodes included ` +
            `(SPEC 10.6)`,
        );

        const exported = await exportSession(product, workspace, "s", prefix);
        const expectations: readonly {
          readonly scope: string;
          readonly ancestors: readonly string[];
        }[] = [
          { scope: G_ROOT, ancestors: [] },
          { scope: G_P, ancestors: [G_ROOT] },
          { scope: G_PA, ancestors: [G_ROOT, G_P] },
          { scope: G_TOP, ancestors: [G_ROOT] },
          { scope: H_ROOT, ancestors: [] },
          { scope: H_K, ancestors: [H_ROOT] },
        ];
        for (const expected of expectations) {
          const item = requireItem(
            exported.items,
            "subtree-coherence",
            expected.scope,
            prefix,
          );
          if (item.scope.node !== expected.scope || !item.scope.present) {
            fail(
              `${prefix}: the item's scope root is the requirement node ` +
                `itself, present (SPEC 10.5, 10.6); expected {node: ` +
                `${JSON.stringify(expected.scope)}, present: true}, got ` +
                JSON.stringify(item.scope),
            );
          }
          assertSameJson(
            identitySet(item.context),
            [...expected.ancestors].sort(),
            `${prefix}: the ${expected.scope} item's context is the node's ` +
              `ancestor chain${expected.ancestors.length === 0 ? " — empty for a root node" : ""} (SPEC 10.6)`,
          );
          assertSameJson(
            identitySet(item.origin),
            [],
            `${prefix}: an audit item's origin is empty (SPEC 10.6)`,
          );
        }

        // Scope covers the node plus all descendants (SPEC 10.6 "scope as in
        // 10.5"; 10.7: subtree-coherence scope text is the scope root's
        // subtree text) — asserted on the branch node p and on G's root,
        // where subtree and own text differ, so a product scoping the node
        // alone fails.
        for (const scoped of [G_P, G_ROOT]) {
          const report = await queryNode(product, workspace, scoped, prefix);
          if (report.subtreeText === report.ownText) {
            fail(
              `${prefix} staging premise: ${scoped}'s subtree text must ` +
                `differ from its own text (descendants contribute) so the ` +
                `scope assertion discriminates subtree scope from own-node ` +
                `scope (SPEC 1.6)`,
            );
          }
          const item = requireItem(
            exported.items,
            "subtree-coherence",
            scoped,
            prefix,
          );
          if (item.scope.text !== report.subtreeText) {
            fail(
              `${prefix}: ${scoped}'s audit item covers the node plus all ` +
                `descendants — its scope text is the scope root's subtree ` +
                `text (SPEC 10.5, 10.6, 10.7); \`query node\` reports ` +
                `${JSON.stringify(report.subtreeText)}, the item's scope ` +
                `carries ${JSON.stringify(item.scope.text)}`,
            );
          }
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.6-2 — order and blocking
// ---------------------------------------------------------------------------

// Two files whose byte order differs from ASCII-case-insensitive order:
// "specs/B.mdx" < "specs/a.mdx" as bytes (0x42 < 0x61), the reverse under
// case folding. Inside B.mdx the top-level sections f and e are declared in
// document order f-then-e — the reverse of their identity order — so the
// absent-scope identity key is distinguishable from stale document order
// after both are deleted; a.mdx's items must order after B.mdx's absent
// items (absent scopes order after the same FILE's present items, not last
// globally).
const B2_FILE = "specs/B.mdx";
const B2_ROOT = "specs/B.mdx";
const B2_A = "specs/B.mdx#a";
const B2_AB = "specs/B.mdx#a.b";
const B2_S = "specs/B.mdx#s";
const B2_F = "specs/B.mdx#f";
const B2_E = "specs/B.mdx#e";
const A2_FILE = "specs/a.mdx";
const A2_ROOT = "specs/a.mdx";
const A2_Z = "specs/a.mdx#z";

function b2Spec(withFE: boolean): string {
  const fe = withFE
    ? [
        "",
        '<S id="f">',
        "Eff text.",
        "</S>",
        "",
        '<S id="e">',
        "Ee text.",
        "</S>",
      ]
    : [];
  return [
    '<S id="a">',
    "Aye own text.",
    "",
    '<S id="a.b">',
    "Abe text.",
    "</S>",
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    ...fe,
    "",
  ].join("\n");
}

const A2_SOURCE = ['<S id="z">', "Zee text.", "</S>", ""].join("\n");

// Initial order (SPEC 10.6): file path bytes (B.mdx before a.mdx), then
// document order within the file — the root first (SPEC 1.2), nested a.b
// right after its parent, f before e as declared.
const AUDIT_INITIAL_ORDER: readonly string[] = [
  `subtree-coherence ${B2_ROOT}`,
  `subtree-coherence ${B2_A}`,
  `subtree-coherence ${B2_AB}`,
  `subtree-coherence ${B2_S}`,
  `subtree-coherence ${B2_F}`,
  `subtree-coherence ${B2_E}`,
  `subtree-coherence ${A2_ROOT}`,
  `subtree-coherence ${A2_Z}`,
];

// After deleting the f and e sections: B.mdx's present scopes first in
// document order, its absent scopes after them by scope-node identity — e
// before f, the reverse of their former document order — and a.mdx's items
// after all of B.mdx's (the absent items order within their file group).
const AUDIT_DELETED_ORDER: readonly string[] = [
  `subtree-coherence ${B2_ROOT}`,
  `subtree-coherence ${B2_A}`,
  `subtree-coherence ${B2_AB}`,
  `subtree-coherence ${B2_S}`,
  `subtree-coherence ${B2_E}`,
  `subtree-coherence ${B2_F}`,
  `subtree-coherence ${A2_ROOT}`,
  `subtree-coherence ${A2_Z}`,
];

// Split sub-fixture: one file, a branch (a > a.b) plus a second top-level
// section.
const F_FILE = "specs/F.mdx";
const F_ROOT = "specs/F.mdx";
const F_A = "specs/F.mdx#a";
const F_AB = "specs/F.mdx#a.b";
const F_S = "specs/F.mdx#s";

// The deletion of f and e (a manual edit, SPEC 6.6) follows the body's first
// `build`, so it is a staged-source record (helpers/staged-mdx.ts, S-9:
// judged before any product exists); the first sub-fixture's initial files
// stay plain `files` entries. The split sub-fixture's initial specs/F.mdx —
// its workspace follows the first sub-fixture's invocations, so a record too
// — spells exactly B.mdx's post-deletion bytes (a > a.b, then s), so it is
// the SAME record staged at both sites (one record per byte sequence), not
// a second spelling.
const T10_6_2_B_WITHOUT_FE = stagedMdx(
  "T10.6-2 specs/B.mdx with the f and e sections deleted (the split sub-fixture's initial specs/F.mdx: the same bytes)",
  b2Spec(false),
);
const F_SOURCE = T10_6_2_B_WITHOUT_FE;

// The item-id tie sub-fixture (SPEC 10.5's last ordering key, which the
// audit order inherits, 10.6): two sections of one file that come to share
// one identity. specs/A.mdx holds top-level leaves a and s, and the audit
// session gives each node its item. A journaled `rename` takes a to b; a new
// section a authored after it is a new node starting a new canonical chain
// (SPEC 5.4) and enters the session through an `updated` resolve's
// re-derivation (SPEC 10.5); b — the original a — is deleted by manual edit;
// a second journaled `rename` takes the new a to b, which is deleted too.
// Both items' scope nodes are then absent and presented under specs/A.mdx#b
// — recorded identities mapped forward through the journal (SPEC 10.4) —
// tied on file path, presence, and scope-node identity, so only the item
// `id` key orders them. The workspace is created after the body's first
// `build`, so its initial specs/A.mdx is a staged-source record
// (helpers/staged-mdx.ts, S-9), as is its configuration (SPECS_ONLY_CONFIG);
// the edits after the renames change bytes the product rewrote, which no
// harness constant equals, so each is an anchored `workspace.edit()`
// (`editRewritten`).
const TIE_FILE = "specs/A.mdx";
const TIE_ROOT = "specs/A.mdx";
const TIE_A = "specs/A.mdx#a";
const TIE_B = "specs/A.mdx#b";
const TIE_S = "specs/A.mdx#s";

const T10_6_2_TIE_INITIAL = stagedMdx(
  "T10.6-2 item-id tie sub-fixture specs/A.mdx (top-level leaves a and s, the sub-fixture's initial source)",
  [
    '<S id="a">',
    "Alpha text.",
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    "",
  ].join("\n"),
);

// The three edits' anchors: byte runs as SPEC 6.4's minimal in-place
// rewrites leave them — in this file a rename rewrites the renamed section's
// `id` attribute and nothing else. s's run, after which the new section a is
// authored; the original a's run as the first rename leaves it (`id="b"`),
// with the blank line after it, deleted; the new a's run as the second
// rename leaves it, with the blank line before it, deleted.
const TIE_S_RUN = ['<S id="s">', "Ess text.", "</S>", ""].join("\n");
const TIE_NEW_A_SECTION = [
  "",
  '<S id="a">',
  "New alpha text.",
  "</S>",
  "",
].join("\n");
const TIE_FIRST_B_RUN = ['<S id="b">', "Alpha text.", "</S>", "", ""].join(
  "\n",
);
const TIE_SECOND_B_RUN = ["", '<S id="b">', "New alpha text.", "</S>", ""].join(
  "\n",
);

/** UTF-8 byte order of two strings (SPEC 12.0: IDs compare byte-wise). */
function compareUtf8Bytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Diagnose that `search` occurs exactly once in the product-rewritten
 * `content` before `edit()` stages a manual edit at it: SPEC 6.4 fixes the
 * rewritten form (minimal in-place edits), so a missing or ambiguous anchor
 * is a diagnosed assertion failure about the product's rewriting, never
 * `edit()`'s plain refusal (H-8).
 */
function anchorOnce(content: string, search: string, context: string): void {
  const first = content.indexOf(search);
  if (first === -1) {
    fail(
      `${context}: expected the rewritten source to contain ` +
        `${JSON.stringify(search)} exactly once (SPEC 6.4 fixes the rewritten ` +
        `form), but it does not appear; source: ${JSON.stringify(content)}`,
    );
  }
  if (content.includes(search, first + search.length)) {
    fail(
      `${context}: the anchor ${JSON.stringify(search)} appears more than once, ` +
        `so the manual edit cannot be staged unambiguously; source: ` +
        JSON.stringify(content),
    );
  }
}

/**
 * Stage a manual edit of bytes the product rewrote (a rename's output, SPEC
 * 6.4): `anchor` replaced by `replacement` through `workspace.edit()` — the
 * staging of product-written bytes, judged at staging time — once the
 * anchor's uniqueness is diagnosed (`anchorOnce`).
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
  await workspace.edit(rel, anchor, replacement);
}

const T10_6_2 = defineProductTest({
  id: "T10.6-2",
  title:
    "audit order and blocking: items order by scope-node file path bytes (specs/B.mdx before specs/a.mdx — the reverse of case-insensitive order), then document order within the file with the root item first; each item's blockedBy is exactly its child sections' items (the root's holds its top-level sections' items — the grandchild a.b's item blocks only its parent's), so leaves are unblocked and repeated next+resolve walks the session bottom-up in item order; after deleting two scoped sections by manual edit their items order after the same file's present-scope items by scope-node identity — e before f, the reverse of their former document order and ahead of the other file's items — with blockedBy untouched, and the walk visits them in that order; after a `split` of a branch item the blockers of every item blocked by it are the decomposition items — the reused child item, the fresh parent-consistency item — with the original removed and the decomposition items taking the scope nodes' places in item order; and two absent-scope items tied on every earlier key — the subtree-coherence items of an original section a, renamed to b by a journaled `rename` and deleted by manual edit, and of a new section a authored after that rename (a new node on a new canonical chain, its item entering through an `updated` resolve's re-derivation), renamed to b in turn and deleted, both presented absent under specs/A.mdx#b — order after the file's present-scope items by item `id` bytes, the ids the product's own, in `status`, `export`, and the `next` walk, the root's item blocked by both until they resolve (SPEC 1.2, 5.4, 6.4, 10.3, 10.4, 10.5, 10.6, 10.7, 12.0)",
  timeoutMs: 420_000,
  run: async (product) => {
    // --- sub-fixture 1: order, blocking, walk, absent scopes ------------------
    await withWorkspace(
      { [B2_FILE]: b2Spec(true), [A2_FILE]: A2_SOURCE },
      async (workspace) => {
        const prefix = "T10.6-2";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createAuditSession(product, workspace, "s", prefix);

        const initial = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSequence(initial.items),
          AUDIT_INITIAL_ORDER,
          `${prefix} \`status\`: audit item order — scope-node file path ` +
            `bytes (B.mdx before a.mdx: 0x42 < 0x61, the reverse of ` +
            `case-insensitive order), then document order within the file, ` +
            `the root item first (SPEC 1.2, 10.6)`,
        );
        const initialExport = await exportSession(
          product,
          workspace,
          "s",
          prefix,
        );
        assertSameJson(
          exportKindScopeSequence(initialExport.items),
          AUDIT_INITIAL_ORDER,
          `${prefix} \`export\` presents the same item order (SPEC 10.6, 10.7)`,
        );

        const id = (scope: string): string =>
          requireRow(initial, "subtree-coherence", scope, prefix).id;
        const idBRoot = id(B2_ROOT);
        const idA = id(B2_A);
        const idAB = id(B2_AB);
        const idS = id(B2_S);
        const idF = id(B2_F);
        const idE = id(B2_E);
        const idARoot = id(A2_ROOT);
        const idZ = id(A2_Z);

        // blockedBy is exactly the child sections' items (SPEC 10.6): the
        // root's blockers are its top-level sections' items — a.b's item
        // blocks only a's, never the root's (child sections, not
        // descendants).
        const item = (scope: string): ReviewItem =>
          requireItem(initialExport.items, "subtree-coherence", scope, prefix);
        assertBlockedBy(
          item(B2_ROOT),
          [idA, idS, idF, idE],
          `${prefix} B.mdx root item — blocked by its child sections' ` +
            `items only (not by the grandchild a.b's)`,
        );
        assertBlockedBy(
          item(B2_A),
          [idAB],
          `${prefix} a's item — blocked by its child section's item`,
        );
        assertBlockedBy(item(B2_AB), [], `${prefix} a.b's leaf item`);
        assertBlockedBy(item(B2_S), [], `${prefix} s's leaf item`);
        assertBlockedBy(item(B2_F), [], `${prefix} f's leaf item`);
        assertBlockedBy(item(B2_E), [], `${prefix} e's leaf item`);
        assertBlockedBy(
          item(A2_ROOT),
          [idZ],
          `${prefix} a.mdx root item — blocked by its child section's item`,
        );
        assertBlockedBy(item(A2_Z), [], `${prefix} z's leaf item`);

        // Leaves are unblocked (SPEC 10.6); with every item unresolved,
        // exactly the items with child sections report blocked (SPEC 10.3).
        const expectBlocked = new Set([B2_ROOT, B2_A, A2_ROOT]);
        for (const row of initial.items) {
          const shouldBlock = expectBlocked.has(row.scope);
          if (row.blocked !== shouldBlock) {
            fail(
              `${prefix}: with all items unresolved, the ${row.scope} item ` +
                `must report blocked=${String(shouldBlock)} (SPEC 10.3: ` +
                `blocked while any blockedBy item is not resolved; SPEC ` +
                `10.6: leaf items are unblocked); got ` +
                `blocked=${String(row.blocked)}`,
            );
          }
        }

        // Delete the f and e sections (a manual edit, SPEC 6.6): membership
        // and blockedBy are untouched (no re-derivation without an updated
        // resolve), only the order and presence change.
        await workspace.file(B2_FILE, T10_6_2_B_WITHOUT_FE);
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting f and e`,
        );
        for (const [deletedId, scope] of [
          [idE, B2_E],
          [idF, B2_F],
        ] as const) {
          const shown = await showItem(
            product,
            workspace,
            "s",
            deletedId,
            `${prefix} post-deletion premise`,
          );
          if (shown.scope.node !== scope || shown.scope.present !== false) {
            fail(
              `${prefix} staging premise: after the deletion, ${scope}'s ` +
                `item scope must be absent under its identity (SPEC 10.4); ` +
                `got ${JSON.stringify(shown.scope)}`,
            );
          }
        }

        const deleted = await sessionStatus(product, workspace, "s", prefix);
        assertSameJson(
          kindScopeSequence(deleted.items),
          AUDIT_DELETED_ORDER,
          `${prefix} \`status\` after the deletions: within B.mdx the ` +
            `present scopes keep document order and the absent scopes ` +
            `follow them ordered by scope-node identity — e before f, the ` +
            `reverse of their former document order — before a.mdx's items ` +
            `(the 10.5 absent-scope rule applies to the audit order; ` +
            `SPEC 10.5, 10.6)`,
        );
        const deletedExport = await exportSession(
          product,
          workspace,
          "s",
          prefix,
        );
        assertSameJson(
          exportKindScopeSequence(deletedExport.items),
          AUDIT_DELETED_ORDER,
          `${prefix} \`export\` after the deletions presents the same item ` +
            `order (SPEC 10.6, 10.7)`,
        );

        // `next` walks bottom-up (SPEC 10.6: blocking, not order, enforces
        // it): leaves first in item order, each parent as soon as its
        // children resolve — the absent-scope items block the root too, and
        // are visited in identity order.
        const walkIds = [idAB, idA, idS, idE, idF, idBRoot, idZ, idARoot];
        const walkScopes = [
          B2_AB,
          B2_A,
          B2_S,
          B2_E,
          B2_F,
          B2_ROOT,
          A2_Z,
          A2_ROOT,
        ];
        await walkSession(
          product,
          workspace,
          "s",
          walkIds,
          (index) => `subtree-coherence ${walkScopes[index]}`,
          prefix,
        );
      },
    );

    // --- sub-fixture 2: split decompositions in blockedBy ---------------------
    await withWorkspace({ [F_FILE]: F_SOURCE }, async (workspace) => {
      const prefix = "T10.6-2 split";
      await buildOk(product, workspace, `${prefix} \`build\``);
      await createAuditSession(product, workspace, "s", prefix);

      const initial = await sessionStatus(product, workspace, "s", prefix);
      assertSameJson(
        kindScopeSequence(initial.items),
        [
          `subtree-coherence ${F_ROOT}`,
          `subtree-coherence ${F_A}`,
          `subtree-coherence ${F_AB}`,
          `subtree-coherence ${F_S}`,
        ],
        `${prefix}: the audit items before the split, in item order ` +
          `(SPEC 10.6)`,
      );
      const idRoot = requireRow(
        initial,
        "subtree-coherence",
        F_ROOT,
        prefix,
      ).id;
      const idA = requireRow(initial, "subtree-coherence", F_A, prefix).id;
      const idAB = requireRow(initial, "subtree-coherence", F_AB, prefix).id;
      const idS = requireRow(initial, "subtree-coherence", F_S, prefix).id;

      await expectExit(
        product,
        workspace,
        ["review", "split", "s", idA],
        0,
        `${prefix} \`review split s <a's item>\` — a subtree-coherence item ` +
          `whose scope root has children (SPEC 10.7)`,
      );

      const after = await sessionStatus(product, workspace, "s", prefix);
      assertSameJson(
        kindScopeSequence(after.items),
        [
          `subtree-coherence ${F_ROOT}`,
          `parent-consistency ${F_A}`,
          `subtree-coherence ${F_AB}`,
          `subtree-coherence ${F_S}`,
        ],
        `${prefix} after the split: the original a item is replaced by its ` +
          `decomposition — a.b's subtree-coherence item (reused) plus a's ` +
          `parent-consistency item — each at its scope node's place in the ` +
          `audit item order (SPEC 10.6, 10.7)`,
      );
      const pcA = requireRow(after, "parent-consistency", F_A, prefix);
      if ([idRoot, idA, idAB, idS].includes(pcA.id)) {
        fail(
          `${prefix}: the decomposition's parent-consistency item is newly ` +
            `created — its id must be fresh (SPEC 10.7); got ${pcA.id}`,
        );
      }
      if (requireRow(after, "subtree-coherence", F_AB, prefix).id !== idAB) {
        fail(
          `${prefix}: a.b's existing item is reused by the decomposition, ` +
            `keeping its id (SPEC 10.7: split in an audit session reuses ` +
            `the children's existing items)`,
        );
      }
      if (after.items.some((row) => row.id === idA)) {
        fail(
          `${prefix}: the original item is removed from the session by the ` +
            `split (SPEC 10.7); its id ${idA} still appears`,
        );
      }

      // After a split, blockers are the decomposition items (SPEC 10.6): the
      // root's blockedBy replaces the original a item with both items of its
      // decomposition; the parent-consistency item is blocked by the child
      // item.
      const afterExport = await exportSession(product, workspace, "s", prefix);
      assertBlockedBy(
        requireItem(afterExport.items, "subtree-coherence", F_ROOT, prefix),
        [pcA.id, idAB, idS],
        `${prefix} root item after the split — the reference to a's ` +
          `decomposed item is replaced by all items of its decomposition`,
      );
      assertBlockedBy(
        requireItem(afterExport.items, "parent-consistency", F_A, prefix),
        [idAB],
        `${prefix} a's parent-consistency item — blocked by the child ` +
          `subtree's item (SPEC 10.7)`,
      );
      assertBlockedBy(
        requireItem(afterExport.items, "subtree-coherence", F_AB, prefix),
        [],
        `${prefix} a.b's reused leaf item`,
      );
      assertBlockedBy(
        requireItem(afterExport.items, "subtree-coherence", F_S, prefix),
        [],
        `${prefix} s's leaf item`,
      );
    });

    // --- sub-fixture 3: the absent-scope item-id tie --------------------------
    // SPEC 10.5's last key, which the audit order inherits (10.6): absent-
    // scope items tied on file path, presence, and scope-node identity order
    // by item `id`, byte-wise (12.0). The ids are the product's own: the
    // expected order is read from them, never spelled.
    await withWorkspace(
      { [TIE_FILE]: T10_6_2_TIE_INITIAL },
      async (workspace) => {
        const prefix = "T10.6-2 item-id tie";
        await buildOk(product, workspace, `${prefix} \`build\``);
        await createAuditSession(product, workspace, "s", prefix);
        const created = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} after \`create\``,
        );
        assertSameJson(
          kindScopeSequence(created.items),
          [
            `subtree-coherence ${TIE_ROOT}`,
            `subtree-coherence ${TIE_A}`,
            `subtree-coherence ${TIE_S}`,
          ],
          `${prefix} staging premise after \`create\`: one subtree-coherence ` +
            `item per requirement node, in audit item order (SPEC 1.2, 10.6)`,
        );
        const rootId = requireRow(
          created,
          "subtree-coherence",
          TIE_ROOT,
          prefix,
        ).id;
        const firstAId = requireRow(
          created,
          "subtree-coherence",
          TIE_A,
          prefix,
        ).id;
        const sId = requireRow(created, "subtree-coherence", TIE_S, prefix).id;

        // The original a leaves its identity through a journaled rename; a
        // new section a authored after it is a new node on a new canonical
        // chain (SPEC 5.4) and enters the session through an `updated`
        // resolve's re-derivation (SPEC 10.5, 10.6).
        await expectExit(
          product,
          workspace,
          ["rename", TIE_FILE, "a", "b"],
          0,
          `${prefix} the first \`rename ${TIE_FILE} a b\``,
        );
        await editRewritten(
          workspace,
          TIE_FILE,
          TIE_S_RUN,
          TIE_S_RUN + TIE_NEW_A_SECTION,
          `${prefix} authoring the new section a after the rename-rewritten s`,
        );
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after authoring the new section a`,
        );
        await resolveOk(
          product,
          workspace,
          "s",
          sId,
          "updated",
          `${prefix} \`resolve s ${sId} --status updated\` (the ` +
            `re-derivation adding the new section a's item, SPEC 10.5, 10.6)`,
        );
        const rederived = await sessionStatus(
          product,
          workspace,
          "s",
          `${prefix} after the re-derivation`,
        );
        const newAId = requireRow(
          rederived,
          "subtree-coherence",
          TIE_A,
          `${prefix} after the re-derivation`,
        ).id;
        if ([rootId, firstAId, sId].includes(newAId)) {
          fail(
            `${prefix} staging premise after the \`updated\` resolve: the ` +
              `new section a's item enters as a distinct item with a fresh ` +
              `id (SPEC 5.4: the reintroduced identity starts a new ` +
              `canonical chain, so the original a's item never matches it; ` +
              `10.2); got the existing id ${newAId}`,
          );
        }
        assertSameJson(
          rederived.items
            .map((row) => [row.id, row.kind, row.scope, row.status])
            .sort(),
          [
            [rootId, "subtree-coherence", TIE_ROOT, "unresolved"],
            [firstAId, "subtree-coherence", TIE_B, "unresolved"],
            [sId, "subtree-coherence", TIE_S, "updated"],
            [newAId, "subtree-coherence", TIE_A, "unresolved"],
          ].sort(),
          `${prefix} staging premise after the \`updated\` resolve: exactly ` +
            `four items — the original a's item keeping its id, presented ` +
            `under ${TIE_B} (its recorded identity mapped forward through ` +
            `the journal), and the new section a's item entering unresolved ` +
            `beside it (SPEC 5.4, 10.2, 10.4, 10.5)`,
        );

        // The original a — now b — is deleted by manual edit; a second
        // journaled rename takes the new a to b, which is deleted too. Both
        // scope nodes are now absent, each presented under specs/A.mdx#b —
        // its recorded identity mapped forward through the journal (SPEC
        // 10.4).
        await editRewritten(
          workspace,
          TIE_FILE,
          TIE_FIRST_B_RUN,
          "",
          `${prefix} deleting b's section (the original a, renamed)`,
        );
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting the renamed original a`,
        );
        await expectExit(
          product,
          workspace,
          ["rename", TIE_FILE, "a", "b"],
          0,
          `${prefix} the second \`rename ${TIE_FILE} a b\``,
        );
        await editRewritten(
          workspace,
          TIE_FILE,
          TIE_SECOND_B_RUN,
          "",
          `${prefix} deleting b's section (the new section a, renamed)`,
        );
        await buildOk(
          product,
          workspace,
          `${prefix} \`build\` after deleting the renamed new section a`,
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
          tiedExport.items
            .map((item) => [
              item.id,
              item.kind,
              item.scope.node,
              item.scope.present,
            ])
            .sort(),
          [
            [rootId, "subtree-coherence", TIE_ROOT, true],
            [sId, "subtree-coherence", TIE_S, true],
            [firstAId, "subtree-coherence", TIE_B, false],
            [newAId, "subtree-coherence", TIE_B, false],
          ].sort(),
          `${tiedLabel} staging premise (\`export\`): exactly the four ` +
            `items — items that no longer generate remain, and only an ` +
            `\`updated\` resolve re-derives, none having followed the one ` +
            `above (SPEC 10.5) — the root's and s's scope nodes present, and ` +
            `exactly two items scoped ${TIE_B}, both subtree-coherence, both ` +
            `absent: the original a's and the new section a's, each recorded ` +
            `identity mapped forward through the journal (SPEC 10.4), so they ` +
            `tie on file path, presence, and scope-node identity (SPEC 10.5, ` +
            `10.6)`,
        );

        const [lowId, highId] = [firstAId, newAId].sort(compareUtf8Bytes);
        const tieKey =
          `SPEC 10.5: among items tied on every earlier key, those with ` +
          `absent scope nodes follow, ordered by scope-node identity, then by ` +
          `item \`id\`; 12.0: IDs compare byte-wise — ${lowId} before ` +
          `${highId}; ${firstAId} is the original a's item, ${newAId} the ` +
          `new section a's`;
        const tiedOrder = [
          [rootId, "subtree-coherence", TIE_ROOT],
          [sId, "subtree-coherence", TIE_S],
          [lowId, "subtree-coherence", TIE_B],
          [highId, "subtree-coherence", TIE_B],
        ];
        assertSameJson(
          tiedStatus.items.map((row) => [row.id, row.kind, row.scope]),
          tiedOrder,
          `${tiedLabel} \`status\`: the file's present-scope items in ` +
            `document order — the root's first (SPEC 1.2), then s's — and ` +
            `then the two tied absent-scope items in item-id byte order (the ` +
            `10.5 absent-scope rule applies to the audit order, SPEC 10.6; ` +
            `${tieKey})`,
        );
        assertSameJson(
          tiedExport.items.map((item) => [item.id, item.kind, item.scope.node]),
          tiedOrder,
          `${tiedLabel} \`export\` presents the same item order (${tieKey}; ` +
            `SPEC 10.6, 10.7)`,
        );

        // `next` presents the tie as its walk order. The root's blockedBy,
        // recomputed at the re-derivation to its child sections' items then
        // and untouched since, holds both tied items (SPEC 10.5, 10.6);
        // premise: s's item is resolved (the trigger's `updated`) and both
        // tied items need review unblocked — leaves, never resolved — so the
        // root's item waits for both (SPEC 10.3).
        assertBlockedBy(
          requireItem(
            tiedExport.items,
            "subtree-coherence",
            TIE_ROOT,
            tiedLabel,
          ),
          [firstAId, sId, newAId],
          `${tiedLabel} root item — its child sections' items as the ` +
            `re-derivation recomputed them (the original a's, presented ` +
            `under b; s's; the new section a's), kept across the deletions ` +
            `(SPEC 10.5: items that no longer generate remain, and blockedBy ` +
            `is recomputed at re-derivation alone)`,
        );
        assertSameJson(
          tiedStatus.items
            .map((row) => [row.id, row.status, row.blocked])
            .sort(),
          [
            [rootId, "unresolved", true],
            [sId, "updated", false],
            [firstAId, "unresolved", false],
            [newAId, "unresolved", false],
          ].sort(),
          `${tiedLabel} staging premise for the walk (compared as a set, ` +
            `the order asserted above and by the walk itself): s's item ` +
            `resolved, both tied items needing review unblocked, and the ` +
            `root's item blocked by them (SPEC 10.3, 10.6)`,
        );
        const walkWhat = [
          `the byte-smaller tied absent-scope item — ${tieKey}`,
          `the other tied absent-scope item — ${lowId}, just resolved ` +
            `\`no-change\` with its scope node absent, stays resolved while ` +
            `the node stays absent (SPEC 10.4)`,
          `the root's item, unblocked once both tied items resolved (SPEC ` +
            `10.3, 10.6)`,
        ];
        await walkSession(
          product,
          workspace,
          "s",
          [lowId, highId, rootId],
          (index) => walkWhat[index],
          prefix,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.6-3 — re-derivation on `updated`
// ---------------------------------------------------------------------------

const R_FILE = "specs/R.mdx";
const R_ROOT = "specs/R.mdx";
const R_P = "specs/R.mdx#p";
const R_PA = "specs/R.mdx#p.a";
const R_PB = "specs/R.mdx#p.b";
const R_S = "specs/R.mdx#s";

function rSpec(pbText: string | undefined): string {
  const pbLines =
    pbText === undefined ? [] : ["", '<S id="p.b">', pbText, "</S>"];
  return [
    '<S id="p">',
    "Pee own text.",
    "",
    '<S id="p.a">',
    "Paa text.",
    "</S>",
    ...pbLines,
    "</S>",
    "",
    '<S id="s">',
    "Ess text.",
    "</S>",
    "",
  ].join("\n");
}

// Both p.b stagings — authoring the section, then editing it — follow the
// body's first `build`, so they are staged-source records
// (helpers/staged-mdx.ts, S-9: judged before any product exists); the
// initial file (no p.b) stays a plain `files` entry.
const T10_6_3_R_PB_V0 = stagedMdx(
  "T10.6-3 specs/R.mdx with the new section p.b authored at v0",
  rSpec("Pab text v0."),
);
const T10_6_3_R_PB_V1 = stagedMdx(
  "T10.6-3 specs/R.mdx with p.b edited to v1",
  rSpec("Pab text v1."),
);

const T10_6_3 = defineProductTest({
  id: "T10.6-3",
  title:
    "audit re-derivation on `updated` (the 10.5 resolve-time re-derivation holds for every strategy; audit's generators run with no creation parameters against the current workspace): after authoring a new section p.b, resolving an unblocked item `no-change` adds no item (the control — the new node's item enters only through an `updated` resolve), while resolving an unblocked item `updated` re-derives — p.b's subtree-coherence item appears at its place in audit item order, created `unresolved` (the trigger's status does not propagate) with a fresh id and current state (its recorded current and baseline hold p.b's entry-time subtreeHash and metadataHash, and a later p.b edit leaves the reported record identical — recorded at entry, not recomputed), its context is its ancestor chain with empty origin, its parent p's item's blockedBy is recomputed to include it (the root's stays its child sections' items), and every existing item keeps its id, status, and recorded state (baseline and current byte-informationally unchanged across the re-derivation; the trigger keeps `updated`, the control keeps `no-change`) (SPEC 10.2, 10.4, 10.5, 10.6, 10.7)",
  timeoutMs: 300_000,
  run: async (product) => {
    await withWorkspace({ [R_FILE]: rSpec(undefined) }, async (workspace) => {
      const prefix = "T10.6-3";
      await buildOk(product, workspace, `${prefix} \`build\``);
      await createAuditSession(product, workspace, "s", prefix);

      const initial = await sessionStatus(product, workspace, "s", prefix);
      assertSameJson(
        kindScopeSequence(initial.items),
        [
          `subtree-coherence ${R_ROOT}`,
          `subtree-coherence ${R_P}`,
          `subtree-coherence ${R_PA}`,
          `subtree-coherence ${R_S}`,
        ],
        `${prefix}: the audit items before the edit, in item order ` +
          `(SPEC 10.6)`,
      );
      const idRoot = requireRow(
        initial,
        "subtree-coherence",
        R_ROOT,
        prefix,
      ).id;
      const idP = requireRow(initial, "subtree-coherence", R_P, prefix).id;
      const idPA = requireRow(initial, "subtree-coherence", R_PA, prefix).id;
      const idS = requireRow(initial, "subtree-coherence", R_S, prefix).id;

      // Author the new section p.b (a manual edit, SPEC 6.6), build, and
      // capture its entry-time relevant hashes (SPEC 10.4: subtree-coherence
      // records subtreeHash and metadataHash of each scope node; p.b is a
      // leaf, so its own two values are the record) — the graph does not
      // change between this build and the re-derivation below.
      await workspace.file(R_FILE, T10_6_3_R_PB_V0);
      await buildOk(
        product,
        workspace,
        `${prefix} \`build\` after authoring p.b`,
      );
      const pbAtEntry = await queryNode(product, workspace, R_PB, prefix);

      // Control: a no-change resolve after the edit re-derives nothing — the
      // new node's item enters only through an `updated` resolve (SPEC 10.5:
      // resolving with no-change/skipped does not re-derive; 10.6).
      await resolveOk(
        product,
        workspace,
        "s",
        idPA,
        "no-change",
        `${prefix} control \`resolve --status no-change\` of p.a's item ` +
          `after the edit`,
      );
      const afterControl = await sessionStatus(product, workspace, "s", prefix);
      assertSameJson(
        kindScopeSequence(afterControl.items),
        [
          `subtree-coherence ${R_ROOT}`,
          `subtree-coherence ${R_P}`,
          `subtree-coherence ${R_PA}`,
          `subtree-coherence ${R_S}`,
        ],
        `${prefix} control: after the p.b edit and a no-change resolve the ` +
          `item set is unchanged — no item for p.b was added (SPEC 10.5, ` +
          `10.6: the new node's item enters only through an updated resolve)`,
      );

      // Recorded-state capture for the kept-items compare (reads report
      // baseline and current as recorded, SPEC 10.2).
      const exportPre = await exportSession(product, workspace, "s", prefix);

      // The `updated` resolve of s's unblocked item triggers re-derivation.
      await resolveOk(
        product,
        workspace,
        "s",
        idS,
        "updated",
        `${prefix} \`resolve --status updated\` of s's item — triggers ` +
          `re-derivation (SPEC 10.5, 10.6)`,
      );

      const derived = await sessionStatus(product, workspace, "s", prefix);
      assertSameJson(
        kindScopeSequence(derived.items),
        [
          `subtree-coherence ${R_ROOT}`,
          `subtree-coherence ${R_P}`,
          `subtree-coherence ${R_PA}`,
          `subtree-coherence ${R_PB}`,
          `subtree-coherence ${R_S}`,
        ],
        `${prefix} after the updated resolve: p.b's subtree-coherence item ` +
          `appears at its place in audit item order — document order within ` +
          `the file, between p.a and s (SPEC 10.5, 10.6)`,
      );
      const pbRow = requireRow(derived, "subtree-coherence", R_PB, prefix);
      if ([idRoot, idP, idPA, idS].includes(pbRow.id)) {
        fail(
          `${prefix}: the new p.b item's id must be fresh (SPEC 10.2); got ` +
            `${pbRow.id}, colliding with an existing item id`,
        );
      }
      if (pbRow.status !== "unresolved") {
        fail(
          `${prefix}: a newly generated item is created unresolved ` +
            `(SPEC 10.2) — the triggering item's \`updated\` status must ` +
            `not propagate to it; got ${pbRow.status}`,
        );
      }
      // Existing items keep their ids and statuses (SPEC 10.5, 10.6).
      for (const [keptId, scope, status] of [
        [idRoot, R_ROOT, "unresolved"],
        [idP, R_P, "unresolved"],
        [idPA, R_PA, "no-change"],
        [idS, R_S, "updated"],
      ] as const) {
        const row = requireRow(derived, "subtree-coherence", scope, prefix);
        if (row.id !== keptId) {
          fail(
            `${prefix}: ${scope}'s item keeps its id across the ` +
              `re-derivation (SPEC 10.5, 10.6); expected ${keptId}, got ` +
              `${row.id}`,
          );
        }
        if (row.status !== status) {
          fail(
            `${prefix}: ${scope}'s item keeps its status across the ` +
              `re-derivation (SPEC 10.4, 10.5) — the trigger keeps its ` +
              `just-resolved updated status, the control its no-change; ` +
              `expected ${status}, got ${row.status}`,
          );
        }
      }

      const exportPost = await exportSession(product, workspace, "s", prefix);
      const pbItem = requireItem(
        exportPost.items,
        "subtree-coherence",
        R_PB,
        prefix,
      );
      assertSameJson(
        identitySet(pbItem.context),
        [R_ROOT, R_P].sort(),
        `${prefix}: the new item's context is p.b's ancestor chain ` +
          `(SPEC 10.6)`,
      );
      assertSameJson(
        identitySet(pbItem.origin),
        [],
        `${prefix}: the new audit item's origin is empty (SPEC 10.6)`,
      );
      assertBlockedBy(pbItem, [], `${prefix} p.b's new leaf item`);
      // "With current state" (SPEC 10.5: new items are added with current
      // state; 10.2: current is written at item creation, baseline fixed at
      // entry from the current graph in a session without a baseline): both
      // records hold p.b's entry-time relevant hash values.
      for (const [record, field] of [
        [pbItem.current, "current"],
        [pbItem.baseline, "baseline"],
      ] as const) {
        assertRecordedHolds(
          record,
          pbAtEntry.hashes.subtreeHash,
          `p.b's entry-time subtreeHash`,
          `${prefix} p.b item's ${field}`,
        );
        assertRecordedHolds(
          record,
          pbAtEntry.hashes.metadataHash,
          `p.b's entry-time metadataHash`,
          `${prefix} p.b item's ${field}`,
        );
      }
      // blockedBy is recomputed (SPEC 10.5, 10.6): p's item gains the new
      // child item; the root's stays its child sections' items.
      assertBlockedBy(
        requireItem(exportPost.items, "subtree-coherence", R_P, prefix),
        [idPA, pbRow.id],
        `${prefix} p's item after the re-derivation — its blockedBy is ` +
          `recomputed to include the new child section's item`,
      );
      assertBlockedBy(
        requireItem(exportPost.items, "subtree-coherence", R_ROOT, prefix),
        [idP, idS],
        `${prefix} root item after the re-derivation — its child sections' ` +
          `items, unchanged`,
      );
      // Existing items keep their recorded state (SPEC 10.5, 10.6): baseline
      // and current unchanged for the untouched items; s's own resolve
      // rewrote its current (every resolve records current state, 10.4), so
      // for the trigger only baseline is compared.
      for (const scope of [R_ROOT, R_P, R_PA]) {
        const before = requireItem(
          exportPre.items,
          "subtree-coherence",
          scope,
          prefix,
        );
        const after = requireItem(
          exportPost.items,
          "subtree-coherence",
          scope,
          prefix,
        );
        assertSameInformation(
          after.current,
          before.current,
          `${prefix}: ${scope}'s matched item keeps its recorded current ` +
            `state across the re-derivation (SPEC 10.5)`,
        );
        assertSameInformation(
          after.baseline,
          before.baseline,
          `${prefix}: ${scope}'s matched item keeps its recorded baseline ` +
            `across the re-derivation (SPEC 10.2, 10.5)`,
        );
      }
      assertSameInformation(
        requireItem(exportPost.items, "subtree-coherence", R_S, prefix)
          .baseline,
        requireItem(exportPre.items, "subtree-coherence", R_S, prefix).baseline,
        `${prefix}: the trigger item keeps its recorded baseline — only its ` +
          `own resolve rewrote its current (SPEC 10.2, 10.4)`,
      );

      // Entry-time recording, not live recomputation: a later p.b edit
      // changes the live values while the item — never resolved, so never
      // rewritten — still reports the record written at its creation
      // (SPEC 10.2: reads report current as recorded; 10.4: invalidation
      // applies to resolved items alone).
      await workspace.file(R_FILE, T10_6_3_R_PB_V1);
      await buildOk(
        product,
        workspace,
        `${prefix} \`build\` after the p.b edit`,
      );
      const pbEdited = await queryNode(product, workspace, R_PB, prefix);
      if (pbEdited.hashes.subtreeHash === pbAtEntry.hashes.subtreeHash) {
        fail(
          `${prefix} staging premise: the p.b edit must change p.b's ` +
            `subtreeHash (SPEC 5.5) — otherwise the recorded-vs-live ` +
            `discrimination below is vacuous`,
        );
      }
      const exportFinal = await exportSession(product, workspace, "s", prefix);
      const pbFinal = requireItem(
        exportFinal.items,
        "subtree-coherence",
        R_PB,
        prefix,
      );
      if (pbFinal.status !== "unresolved") {
        fail(
          `${prefix}: p.b's never-resolved item stays unresolved after the ` +
            `edit (SPEC 10.3, 10.4: invalidation applies to resolved items ` +
            `alone); got ${pbFinal.status}`,
        );
      }
      assertSameInformation(
        pbFinal.current,
        pbItem.current,
        `${prefix}: p.b's item reports its current as recorded at entry — ` +
          `not recomputed from the live graph after the edit (SPEC 10.2, ` +
          `10.4)`,
      );
    });
  },
});

/** TEST-SPEC §10.6, in canonical ID order (SUITE-37). */
export const section106Tests: readonly ProductTestEntry[] = [
  T10_6_1,
  T10_6_2,
  T10_6_3,
];
