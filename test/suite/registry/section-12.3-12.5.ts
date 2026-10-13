// TEST-SPEC §12.3 (`xspec ids`), §12.4 (`xspec show`), §12.5 (dispatch) —
// SUITE-44: T12.3-1, T12.3-2, T12.4-1, T12.5-1.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 12.3: `ids` lists requirement IDs grouped by file — files in byte
// order of workspace-relative path, IDs within a file in document order —
// with `--json` per 12.0. `--tree` renders each file's IDs as a tree
// following section nesting, in the same file and document order. `--file
// <glob>` restricts to files the glob matches (the rules of 7: a pattern
// outside the workspace root by its spelling alone — 7's depth rule — is an
// invalid flag value, exit 2, while an inside pattern spelled with a `.` or
// empty segment is admitted and matches nothing, an empty listing at exit 0).
// `--unreferenced` restricts to requirement nodes with no incoming dependency
// edges from specs or code (`contains` does not count); unreferenced is not
// uncovered. When the listing is restricted and a listed node's parent is not
// listed, `--tree` nests the node under its nearest listed ancestor, or at
// its file's top level when no ancestor is listed: the tree contains exactly
// the listed IDs. SPEC 12.4: `show <node>` accepts `path#id` and bare `path`
// (root) and prints identity, source range (1.7), own and subtree text,
// hashes, tags, coverage attribute (absent for a root node, 11), and edges by
// kind; `query node` is the machine-facing equivalent. SPEC 12.5: `coverage`,
// `impact`, `review`, `query`, `occurrences`, `view`, `at`, `inventory`,
// `rename`, `move` behave as sections 8, 9, 10, 11, and 6 specify; an
// unknown subcommand or command is a usage error (exit 2, 12.0).
//
// Conservative operationalizations (noted per H-3/H-4):
// - Tree node IDs are the full requirement IDs (`zeta.minor`), not bare
//   segments: SPEC 12.3 fixes "the tree contains exactly the listed IDs",
//   and a restricted tree nests a listed node under a non-parent ancestor or
//   at the file's top level — where a segment-only rendering could not carry
//   the listed ID at all. (Reconstructing full IDs from a differently shaped
//   but information-complete rendering would be an H-3 shape adjustment in
//   the adapter, never a value change.)
// - Whether a file with no listed IDs appears as an (empty) entry in a
//   restricted listing is not fixed by SPEC 12.3, so every listing
//   comparison first drops entries carrying no IDs/nodes; the surviving
//   entries — the listing's content — are asserted exactly, order included.
// - `--json` parity (T12.0-1's information parity; SPEC 12.0: the JSON form
//   carries the same information as the human report): the JSON document
//   is decoded and asserted in full — grouping, membership, and both
//   spec-fixed orders — and directly after each non-empty decoded listing,
//   at the same state, its human form (the same argv without `--json`)
//   exits 0 alike and mentions what the decoded listing carries (a
//   product-to-itself comparison, H-4; `assertHumanFlatListing` and
//   `assertHumanTreeListing`, through helpers/adapters/human.ts): the file
//   of every entry that lists at least one ID, and every listed ID — in a
//   flat listing as itself; in a tree, each node by its full ID or by its
//   ID relative to its tree parent (the part after the parent's ID and the
//   following `.`: `minor` for `zeta.minor` under `zeta`, `par.leaf` for
//   `grand.par.leaf` under its nearest listed ancestor `grand`), and a node
//   at its file's top level by its full ID alone, the only spelling that
//   carries the listed ID there (`solo.kid`). Every spelling is
//   token-bounded as an identity is (`identityMention`), so `zeta` never
//   counts inside `zeta.minor`, nor `minor` inside it, nor an ID inside a
//   file's path. Limits: no mention is associated with another, so
//   nesting, order, and which ID belongs to which file stay with the JSON
//   assertions (H-3 forbids wording and line-format assertions); a
//   relative spelling counts wherever it stands, so two nodes sharing one
//   (`a.x` and `b.x` under `a` and `b`) can stand in for each other —
//   T12.3-1's fixtures stage no such pair; the empty listings (the inside
//   `--file` patterns matching nothing) get no human run, having nothing to
//   mention; and the listings' files and IDs hold no character a report
//   may need to quote or escape, so every one is asked.
// - T12.4-1's primary assertion is the adapter comparison: `show --json` and
//   `query node --json` for the same node are both decoded by the one node
//   adapter and compared field by field (the edge-list order, which SPEC
//   fixes nothing about, normalized first; tags are compared literally, the
//   decoder enforcing 12.7's tag-set form). Symmetric omission is
//   caught by pinning the discriminating fields on the `show` side directly:
//   tags, `coverage="none"`, and the root arm's absent coverage attribute.
//   The non-root node spells its tags out of tag-set form — out of byte
//   order, with a duplicate and a mixed-case member — and the set form
//   (byte order, duplicates collapsed, never case-folded: SPEC 12.7, 2.6)
//   is pinned literally on both `show` and `query node`, so a product
//   echoing the spelled order, keeping a duplicate, collating
//   case-insensitively, or case-folding fails on either surface — the last
//   one, when both surfaces share it, at the literal pin alone (TEST-SPEC
//   T11.4-3's `query node`/`show --json` clause, T12.7-1).
//   The human form (T12.0-1's information parity; SPEC 12.0): at each arm,
//   after its JSON assertions and at the same state, `show <node>` without
//   `--json` exits 0 as well, and its report mentions what the decoded
//   `show --json` report carries (a product-to-itself comparison, H-4;
//   `assertHumanShowReport`, through helpers/adapters/human.ts), in three
//   calls: the identity and every incoming and outgoing edge's `from` and
//   `to` (identity boundaries, so star's identity never counts inside
//   `specs/S.mdx#star.point`, nor the root's `specs/S.mdx` inside its
//   sections' identities), each tag and the coverage value where the node
//   has them, every trimmed non-blank line of the own and the subtree text,
//   and the four hashes in full (plain strings; 12.4 prints hashes, and an
//   abbreviation is not the same information); then each distinct kind
//   among the edges (SPEC-named tokens), with all of those data blanked out
//   — so `embeds` never counts inside `src/app.ts#embedStar`, which spells
//   `embedS`; then the source range's start and end (whole numbers), with
//   the digit-holding data among them — the hashes — blanked out. Limits:
//   no mention is associated with another, so which endpoint lies on which
//   edge, of which kind and direction, which line belongs to the own or the
//   subtree text, and which number starts or ends the range stay with the
//   adapter compare; a datum counts wherever the report prints it — a line
//   of the own text in the subtree text, an endpoint on another edge, an
//   offset in any whole number the report prints outside the blanked data;
//   and a root's absent tags and coverage attribute are not asked of the
//   human report (robust matching asks presence): the JSON assertions carry
//   them — the coverage attribute's absence pinned on the `show` side, the
//   tags' through the adapter compare. Blanking is by spelling: T12.4-1's
//   data spell no edge kind but `src/app.ts#embedStar`'s `embedS`, hold
//   digits in the hashes alone, and hold no character a report may need to
//   quote or escape, so every datum is asked.
// - T12.5-1's dispatch arms are minimal exit-0 probes — each named command
//   dispatches into its section's specified outcome on a small valid fixture
//   (deep behavior is covered in sections 8, 9, 10, 11, 6, per TEST-SPEC) —
//   so the unknown-command arms discriminate "unknown → exit 2" from a CLI
//   that exits 2 for everything. Unknown arms assert exit 2 exactly and,
//   under `--json`, the 12.7 error document as the entire stdout (SPEC
//   12.0). The four §11 read surfaces are JSON-only — one document with or
//   without `--json` (SPEC 11), invoked bare here: `occurrences` and `at`
//   decode through their form-exact 12.7 document decoders; `view` through
//   the scoped file-members decode and `inventory` through the scoped
//   `recorded` datum (the full per-file view and inventory forms are
//   T11.4-*'s and T11.6-*'s subjects).
// - T12.3-2's coverage arm asserts the demonstration facts (the profile's
//   uncovered set, the referenced-yet-uncovered node among it) — full §8
//   report content is T8-*'s subject.

import type {
  IdsReport,
  IdsTreeNode,
  IdsTreeReport,
  NodeReport,
} from "../../helpers/adapters/index.js";
import {
  assertReportMentions,
  decodeAtReport,
  decodeCoverageReport,
  decodeIdsReport,
  decodeIdsTreeReport,
  decodeImpactReport,
  decodeInventoryRecordedDatum,
  decodeNodeReport,
  decodeNodeRowsReport,
  decodeOccurrencesReport,
  decodeSessionListReport,
  decodeViewFilesReport,
  identityMention,
  numberMention,
  specTokenMention,
} from "../../helpers/adapters/index.js";
import type { FormedMention } from "../../helpers/adapters/index.js";
import type { GraphEdge } from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { digitHoldingData } from "./section-10.7-i.js";
import { nonBlankLines } from "./section-10.7-ii.js";
import {
  BESIDE_ROOT_FILE_PATTERN_DECOY,
  INSIDE_NO_MATCH_FILE_PATTERNS,
  OUTSIDE_ROOT_FILE_PATTERNS,
  assertSameJson,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectFilePatternUsageError,
  insideNoMatchFilePatterns,
  runJson,
  sortedIdentities,
  stageBesideRoot,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material and helpers
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// One spec group plus one code group (SPEC 7.2), so code-side `references`
// edges (4.5) enter the graph. T12.3-1's restricted-tree workspace follows
// the ordering workspace's invocations, so S-7's sweep never reaches it
// against the stub: a TypeScript staged-source record (helpers/staged-ts.ts;
// S-9's TypeScript and timing clauses), staged at every site — T12.4-1's
// first workspace too.
const SPEC_AND_CODE_CONFIG = stagedTs(
  "T12.3-1 xspec.config.ts — one spec group and one code group (the restricted-tree workspace; T12.4-1's workspace too)",
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

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: InitialFileContents,
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

/**
 * A usage-error arm: exit 2 exactly (H-5) with the single 12.7 error
 * document as the entire stdout — the run carries `--json`, so JSON output
 * is in effect and the exit-2 invocation emits the error document (SPEC
 * 12.0, 12.7). `why` names the staged error class in the diagnosis.
 */
async function expectUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  why: string,
  context: string,
): Promise<void> {
  const result = await expectExit(
    product,
    workspace,
    [...argv, "--json"],
    2,
    `${context} — ${why} is a usage error, exit 2 (SPEC 12.5, 12.0)`,
  );
  expectErrorDocument(
    result,
    `${context} — under --json, the exit-2 error document is the entire ` +
      `stdout (SPEC 12.0, 12.7, H-5)`,
  );
}

/** One expected flat-listing entry (SPEC 12.3). */
interface FlatEntry {
  readonly file: string;
  readonly ids: readonly string[];
}

/** One expected tree node: a full requirement ID plus nested children. */
interface TreeNode {
  readonly id: string;
  readonly children: readonly TreeNode[];
}

interface TreeEntry {
  readonly file: string;
  readonly nodes: readonly TreeNode[];
}

function tnode(id: string, children: readonly TreeNode[] = []): TreeNode {
  return { id, children };
}

/**
 * The decoded flat listing projected for comparison: entries carrying no IDs
 * dropped (module header — their presence is not fixed by SPEC 12.3), the
 * rest as plain `{ file, ids }` in the reported order.
 */
function flatListing(report: IdsReport): FlatEntry[] {
  return report.files
    .filter((entry) => entry.ids.length > 0)
    .map((entry) => ({ file: entry.file, ids: entry.ids }));
}

function projectTreeNode(node: IdsTreeNode): TreeNode {
  return { id: node.id, children: node.children.map(projectTreeNode) };
}

/** The decoded tree listing projected like {@link flatListing}. */
function treeListing(report: IdsTreeReport): TreeEntry[] {
  return report.files
    .filter((entry) => entry.nodes.length > 0)
    .map((entry) => ({
      file: entry.file,
      nodes: entry.nodes.map(projectTreeNode),
    }));
}

/**
 * Run `ids` with the given flags, assert the exact flat listing, and return
 * the decoded report (its human form's mentions: `assertHumanFlatListing`).
 */
async function expectFlatListing(
  product: ProductBinding,
  workspace: TestWorkspace,
  flags: readonly string[],
  expected: readonly FlatEntry[],
  context: string,
): Promise<IdsReport> {
  const report = decodeIdsReport(
    await runJson(product, workspace, ["ids", ...flags, "--json"], context),
    context,
  );
  assertSameJson(
    flatListing(report),
    expected,
    `${context}: requirement IDs grouped by file — files in byte order of ` +
      `workspace-relative path, IDs within a file in document order ` +
      `(SPEC 12.3; entries carrying no IDs dropped per the module header)`,
  );
  return report;
}

/**
 * Run `ids --tree` with the given flags, assert the exact tree, and return
 * the decoded report (its human form's mentions: `assertHumanTreeListing`).
 */
async function expectTreeListing(
  product: ProductBinding,
  workspace: TestWorkspace,
  flags: readonly string[],
  expected: readonly TreeEntry[],
  context: string,
): Promise<IdsTreeReport> {
  const report = decodeIdsTreeReport(
    await runJson(
      product,
      workspace,
      ["ids", "--tree", ...flags, "--json"],
      context,
    ),
    context,
  );
  assertSameJson(
    treeListing(report),
    expected,
    `${context}: per-file nesting in the same file and document order, tree ` +
      `nodes carrying the full requirement IDs (SPEC 12.3; module header)`,
  );
  return report;
}

/** The mentions in first-seen order, one per description: a datum asked once. */
function distinctMentions(mentions: readonly FormedMention[]): FormedMention[] {
  const byDescription = new Map<string, FormedMention>();
  for (const mention of mentions) {
    if (!byDescription.has(mention.description)) {
      byDescription.set(mention.description, mention);
    }
  }
  return [...byDescription.values()];
}

/**
 * A listing's human form — T12.0-1's information parity (SPEC 12.0: the
 * JSON form carries the same information as the human report; the module
 * header): `argv`, the argv of the `--json` listing the caller decoded and
 * asserted, without `--json`, run directly after it — nothing between
 * them, so at its state — exits 0 alike (an informational report, SPEC
 * 12.0), and its report mentions every one of `mentions`, which the caller
 * took from the decoded listing (a product-to-itself comparison, H-4). A
 * listing with nothing to mention is asked its exit code alone. Robust
 * matching (H-3): presence, never wording, and no mention associated with
 * another.
 */
async function expectHumanListing(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  mentions: readonly FormedMention[],
  what: string,
  context: string,
): Promise<void> {
  const label = `${context} \`${argv.join(" ")}\` (human report)`;
  const human = await expectExit(
    product,
    workspace,
    argv,
    0,
    `${label} — the same exit code as the \`--json\` listing at this ` +
      `state: 0, an informational report (SPEC 12.3, 12.0)`,
  );
  if (mentions.length === 0) return;
  assertReportMentions(
    human,
    mentions,
    `${label}: ${what} — the information of the JSON listing (SPEC 12.3, ` +
      `12.0; robust matching, never wording — H-3)`,
  );
}

/**
 * The human `ids` listing beside a decoded flat `ids … --json` listing,
 * after its JSON assertions (`expectHumanListing`, `flags` the listing's
 * own): the file of every entry that lists at least one ID (an entry
 * listing none is no content: the module header) and every listed ID, each
 * token-bounded as an identity or a path is (`identityMention`), so `zeta`
 * never counts inside `zeta.minor`, nor `minor` inside it, nor an ID inside
 * a file's path.
 */
async function assertHumanFlatListing(
  product: ProductBinding,
  workspace: TestWorkspace,
  flags: readonly string[],
  report: IdsReport,
  context: string,
): Promise<void> {
  await expectHumanListing(
    product,
    workspace,
    ["ids", ...flags],
    distinctMentions(
      flatListing(report).flatMap((entry) =>
        [entry.file, ...entry.ids].map(identityMention),
      ),
    ),
    "every listed file and every listed ID, requirement IDs grouped by file",
    context,
  );
}

/**
 * A node's mention in a human tree listing: its full ID, or its ID
 * relative to its tree parent — the part of its ID after the parent's ID
 * and the following `.` (`minor` for `zeta.minor` under `zeta`; `par.leaf`
 * for `grand.par.leaf` nested under its nearest listed ancestor `grand`) —
 * each spelling token-bounded as `identityMention` bounds it, in one formed
 * mention whose pattern alternates the two and whose description names
 * both. A node at its file's top level (no `parent`) has no relative
 * spelling, nor has a child whose ID does not extend its tree parent's:
 * either is mentioned by its full ID alone — the only spelling that carries
 * the listed ID there (`solo.kid`, at the top level of a restricted tree;
 * SPEC 12.3: the tree contains exactly the listed IDs).
 */
function treeNodeMention(
  node: TreeNode,
  parent: TreeNode | undefined,
): FormedMention {
  const full = identityMention(node.id);
  if (parent === undefined) return full;
  const prefix = `${parent.id}.`;
  if (!node.id.startsWith(prefix) || node.id.length === prefix.length) {
    return full;
  }
  const relativeId = node.id.slice(prefix.length);
  const relative = identityMention(relativeId);
  return Object.freeze({
    pattern: new RegExp(
      `(?:${full.pattern.source})|(?:${relative.pattern.source})`,
    ),
    description:
      `${full.description}, or ${JSON.stringify(relativeId)} relative to ` +
      `its tree parent ${JSON.stringify(parent.id)}`,
  });
}

/**
 * The human `ids --tree` listing beside a decoded `ids --tree … --json`
 * listing, after its JSON assertions (`expectHumanListing`, `flags` the
 * listing's own): the file of every entry that lists at least one node
 * (`identityMention`; an entry listing none is no content: the module
 * header) and every node of each file's tree, by its full ID or by its ID
 * relative to its tree parent (`treeNodeMention`), walked parents first
 * through an explicit stack, in document order.
 */
async function assertHumanTreeListing(
  product: ProductBinding,
  workspace: TestWorkspace,
  flags: readonly string[],
  report: IdsTreeReport,
  context: string,
): Promise<void> {
  const mentions: FormedMention[] = [];
  for (const entry of treeListing(report)) {
    mentions.push(identityMention(entry.file));
    const pending: { node: TreeNode; parent: TreeNode | undefined }[] = [];
    for (let index = entry.nodes.length - 1; index >= 0; index -= 1) {
      pending.push({ node: entry.nodes[index]!, parent: undefined });
    }
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      mentions.push(treeNodeMention(next.node, next.parent));
      const { children } = next.node;
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push({ node: children[index]!, parent: next.node });
      }
    }
  }
  await expectHumanListing(
    product,
    workspace,
    ["ids", "--tree", ...flags],
    distinctMentions(mentions),
    "every listed file and every tree node, by its full ID or by its ID " +
      "relative to its tree parent, the tree holding exactly the listed IDs",
    context,
  );
}

function edgeSortKey(edge: GraphEdge): string {
  return `${edge.kind}\u0000${edge.from}\u0000${edge.to}`;
}

/** Edges in a canonical order — for comparisons where SPEC fixes no order. */
function sortedEdges(edges: readonly GraphEdge[]): GraphEdge[] {
  return [...edges].sort((a, b) => {
    const keyA = edgeSortKey(a);
    const keyB = edgeSortKey(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}

/** A node report with SPEC-unordered members normalized (H-3). */
function normalizedNodeReport(report: NodeReport): unknown {
  return {
    identity: report.identity,
    sourceRange: report.sourceRange,
    ownText: report.ownText,
    subtreeText: report.subtreeText,
    hashes: report.hashes,
    tags: report.tags,
    coverage: report.coverage,
    incomingEdges: sortedEdges(report.incomingEdges),
    outgoingEdges: sortedEdges(report.outgoingEdges),
  };
}

// ---------------------------------------------------------------------------
// T12.3-1 — `ids`: ordering, `--tree`, `--file`, restricted tree, parity
// ---------------------------------------------------------------------------

// Ordering workspace: configuration order (group order and per-group glob
// order) is the exact reverse of the byte order of the workspace-relative
// paths, and document order inside Z.mdx differs from the byte order of the
// IDs at both nesting levels — a product listing files in
// configuration/discovery order, or IDs sorted, fails.
const T12_3_1_ORDERING_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    zulu: ["zpecs/**/*.mdx"],
    apex: ["apecs/nested/**/*.mdx", "apecs/*.mdx"]
  }
})
`;

const T12_3_1_Z = [
  '<S id="zeta">',
  "Zeta intro.",
  "",
  '<S id="zeta.minor">',
  "Minor point.",
  "</S>",
  "",
  '<S id="zeta.aleph">',
  "Aleph point.",
  "</S>",
  "</S>",
  "",
  '<S id="alpha">',
  "Alpha line.",
  "</S>",
  "",
].join("\n");

const T12_3_1_M = '<S id="emm">\nEmm line.\n</S>\n';
const T12_3_1_N = '<S id="enn">\nEnn line.\n</S>\n';

// Files in byte order of workspace-relative path; IDs in document order.
const T12_3_1_FLAT: readonly FlatEntry[] = [
  { file: "apecs/M.mdx", ids: ["emm"] },
  { file: "apecs/nested/N.mdx", ids: ["enn"] },
  {
    file: "zpecs/Z.mdx",
    ids: ["zeta", "zeta.minor", "zeta.aleph", "alpha"],
  },
];

const T12_3_1_TREE: readonly TreeEntry[] = [
  { file: "apecs/M.mdx", nodes: [tnode("emm")] },
  { file: "apecs/nested/N.mdx", nodes: [tnode("enn")] },
  {
    file: "zpecs/Z.mdx",
    nodes: [
      tnode("zeta", [tnode("zeta.minor"), tnode("zeta.aleph")]),
      tnode("alpha"),
    ],
  },
];

// Restricted-tree workspace: `grand.par` and `solo` are referenced from code
// (4.5 markers), so `--unreferenced` lists `grand`, `grand.par.leaf`, and
// `solo.kid` — a listed node under an unlisted parent with a listed
// grandparent, and one with no listed ancestor at all. The workspace
// follows the ordering workspace's invocations, so S-7's sweep never
// reaches it against the stub: a staged-source record
// (helpers/staged-mdx.ts; S-9's before-any-product clause).
const T12_3_1_T = stagedMdx(
  "T12.3-1 restricted-tree workspace specs/T.mdx (grand holding grand.par holding grand.par.leaf; solo holding solo.kid)",
  [
    '<S id="grand">',
    "Grand line.",
    "",
    '<S id="grand.par">',
    "Par line.",
    "",
    '<S id="grand.par.leaf">',
    "Leaf line.",
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="solo">',
    "Solo line.",
    "",
    '<S id="solo.kid">',
    "Kid line.",
    "</S>",
    "</S>",
    "",
  ].join("\n"),
);

// The restricted-tree workspace's code markers, staged after the ordering
// workspace's invocations: a TypeScript staged-source record (S-9).
const T12_3_1_APP = stagedTs(
  "T12.3-1 restricted-tree workspace src/app.ts (code markers referencing grand.par and solo)",
  [
    'import SPEC from "../specs/T.xspec";',
    "",
    "export function touchPar(): void {",
    "  SPEC.grand.par;",
    "}",
    "",
    "export function touchSolo(): void {",
    "  SPEC.solo;",
    "}",
    "",
  ].join("\n"),
);

const T12_3_1 = defineProductTest({
  id: "T12.3-1",
  title:
    "`ids` groups requirement IDs by file — files in byte order of workspace-relative path (differing from configuration order), IDs within a file in document order (differing from their byte order); `--tree` renders per-file nesting in the same orders; `--file <glob>` restricts by the rules of SPEC 7 — an outside-root pattern by spelling alone (`../x/*.mdx`, `../x`, `a/../../x`, `/specs/*.mdx`) is an invalid flag value, exit 2 with the plain usage error's document, code and path null, a matching file beside the root notwithstanding, while an inside pattern spelled with a `.` or empty segment (`./specs/*.mdx`, `specs//*.mdx`, and their twins over `apecs`) is admitted and matches nothing, an empty listing at exit 0; a restricted `--tree` (`--unreferenced`) nests a listed node under its nearest listed ancestor or at its file's top level, containing exactly the listed IDs; and beside each non-empty listing the human form at the same state exits 0 alike and carries the same information as `--json` — every listed file and ID, a tree node as its full ID or relative to its tree parent (robust matching, H-3) (SPEC 12.3, 7, 12.0)",
  run: async (product) => {
    await withWorkspace(
      T12_3_1_ORDERING_CONFIG,
      {
        "zpecs/Z.mdx": T12_3_1_Z,
        "apecs/M.mdx": T12_3_1_M,
        "apecs/nested/N.mdx": T12_3_1_N,
      },
      async (workspace) => {
        await buildOk(product, workspace, "T12.3-1 `build` (ordering)");

        // Flat listing: both spec-fixed orders, asserted exactly; then, at
        // the same state, its human form — `--json` parity, every listed
        // file and ID (module header; H-3), as after each listing below.
        const flat = await expectFlatListing(
          product,
          workspace,
          [],
          T12_3_1_FLAT,
          "T12.3-1 `ids --json`",
        );
        await assertHumanFlatListing(
          product,
          workspace,
          [],
          flat,
          "T12.3-1 (ordering)",
        );

        // `--tree`: per-file nesting in the same file and document order;
        // its human form names every node by its full ID or relative to
        // its tree parent.
        const tree = await expectTreeListing(
          product,
          workspace,
          [],
          T12_3_1_TREE,
          "T12.3-1 `ids --tree --json`",
        );
        await assertHumanTreeListing(
          product,
          workspace,
          [],
          tree,
          "T12.3-1 (ordering)",
        );

        // `--file <glob>` restricts to files the glob matches (the rules of
        // SPEC 7: `**` spans segments, `*` never crosses `/`).
        const spanFlags = ["--file", "apecs/**/*.mdx"];
        const spanListing = await expectFlatListing(
          product,
          workspace,
          spanFlags,
          [
            { file: "apecs/M.mdx", ids: ["emm"] },
            { file: "apecs/nested/N.mdx", ids: ["enn"] },
          ],
          "T12.3-1 `ids --file apecs/**/*.mdx --json`",
        );
        await assertHumanFlatListing(
          product,
          workspace,
          spanFlags,
          spanListing,
          "T12.3-1 (ordering)",
        );
        const singleFlags = ["--file", "apecs/*.mdx"];
        const singleListing = await expectFlatListing(
          product,
          workspace,
          singleFlags,
          [{ file: "apecs/M.mdx", ids: ["emm"] }],
          "T12.3-1 `ids --file apecs/*.mdx --json` (a single `*` never " +
            "crosses `/`, SPEC 7)",
        );
        await assertHumanFlatListing(
          product,
          workspace,
          singleFlags,
          singleListing,
          "T12.3-1 (ordering)",
        );

        // A `--file` pattern outside the workspace root by its spelling
        // alone — decided as 7 decides a configured glob (T7-4) — is an
        // invalid flag value: exit 2 with the plain usage error's document,
        // like its configuration-time counterpart (SPEC 12.3, 7, 14.14,
        // 12.0), the file the ascending spellings name when resolved staged
        // beside the root so exit 2 never comes from a side reason.
        await stageBesideRoot(workspace, BESIDE_ROOT_FILE_PATTERN_DECOY);
        for (const { spelling, why } of OUTSIDE_ROOT_FILE_PATTERNS) {
          await expectFilePatternUsageError(
            product,
            workspace,
            ["ids", "--file", spelling, "--json"],
            `T12.3-1 \`ids --file ${JSON.stringify(spelling)} --json\` (${why})`,
          );
        }

        // An inside pattern spelled with a `.` or an empty segment is
        // admitted and matches nothing — a discovered path carries no such
        // segment (SPEC 7, 12.0) — so the restricted listing holds no file
        // at all: `files` exactly [] (the module header's ID-less-entry
        // caveat concerns matched files; here none is matched). TEST-SPEC's
        // pinned `specs` spellings run beside their twins over `apecs`,
        // whose normalized form (`apecs/*.mdx`) matches M.mdx — the arm a
        // normalizing product fails.
        for (const { spelling, why } of [
          ...INSIDE_NO_MATCH_FILE_PATTERNS,
          ...insideNoMatchFilePatterns("apecs"),
        ]) {
          const context = `T12.3-1 \`ids --file ${JSON.stringify(spelling)} --json\` (${why})`;
          const report = decodeIdsReport(
            await runJson(
              product,
              workspace,
              ["ids", "--file", spelling, "--json"],
              `${context} — an inside pattern matching nothing is admitted: ` +
                `an empty listing, exit 0 (SPEC 12.3, 7)`,
            ),
            context,
          );
          assertSameJson(
            report.files,
            [],
            `${context}: the listing restricted to the files the pattern ` +
              `matches holds no file — a discovered path carries no \`.\` ` +
              `or empty segment (SPEC 12.3, 7, 12.0); an empty list is [], ` +
              `never null (12.7)`,
          );
        }
      },
    );

    // Restricted `--tree`: nesting under the nearest listed ancestor, or at
    // the file's top level; the tree contains exactly the listed IDs.
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      { "specs/T.mdx": T12_3_1_T, "src/app.ts": T12_3_1_APP },
      async (workspace) => {
        await buildOk(product, workspace, "T12.3-1 `build` (restricted tree)");

        // Premise: the restriction lists exactly grand, grand.par.leaf, and
        // solo.kid — `grand.par` and `solo` carry incoming `references`
        // edges from the code markers. Its human form follows it.
        const unreferenced = await expectFlatListing(
          product,
          workspace,
          ["--unreferenced"],
          [
            {
              file: "specs/T.mdx",
              ids: ["grand", "grand.par.leaf", "solo.kid"],
            },
          ],
          "T12.3-1 `ids --unreferenced --json` (the restriction premise)",
        );
        await assertHumanFlatListing(
          product,
          workspace,
          ["--unreferenced"],
          unreferenced,
          "T12.3-1 (restricted tree)",
        );

        // grand.par.leaf's parent is unlisted, so it nests under its nearest
        // listed ancestor (grand); solo.kid has no listed ancestor, so it
        // sits at the file's top level. Exact equality also asserts "the
        // tree contains exactly the listed IDs" — neither grand.par nor solo
        // appears.
        const restricted = await expectTreeListing(
          product,
          workspace,
          ["--unreferenced"],
          [
            {
              file: "specs/T.mdx",
              nodes: [
                tnode("grand", [tnode("grand.par.leaf")]),
                tnode("solo.kid"),
              ],
            },
          ],
          "T12.3-1 `ids --unreferenced --tree --json` (restricted tree)",
        );

        // Its human form: grand.par.leaf by its full ID or as `par.leaf`
        // under grand, solo.kid by its full ID alone — at the top level no
        // other spelling carries the listed ID (module header; H-3).
        await assertHumanTreeListing(
          product,
          workspace,
          ["--unreferenced"],
          restricted,
          "T12.3-1 (restricted tree)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.3-2 — `--unreferenced`: incoming dependency edges only; ≠ uncovered
// ---------------------------------------------------------------------------

// Two code groups, one of them the coverage boundary: `won` is referenced
// from boundary code (covered), `ref` is referenced from code outside the
// boundary (referenced yet uncovered — the demonstration), `quoted` carries
// an incoming `embeds` edge, `par.dep` an incoming `depends` edge, and `par`
// and `silent` have no incoming dependency edges at all — `par` although its
// child is referenced and it carries `contains` edges both ways.
const T12_3_2_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    inner: ["binside/**/*.ts"],
    outer: ["boutside/**/*.ts"]
  },
  coverage: [
    {
      name: "gate",
      target: "main",
      boundary: "inner",
      mode: "direct"
    }
  ]
})
`;

const T12_3_2_C = [
  '<S id="won">',
  "Won line.",
  "",
  '{text("quoted")}',
  "</S>",
  "",
  '<S id="quoted">',
  "Quoted line.",
  "</S>",
  "",
  '<S id="ref" d={"par.dep"}>',
  "Ref line.",
  "</S>",
  "",
  '<S id="par">',
  "Par line.",
  "",
  '<S id="par.dep">',
  "Dep line.",
  "</S>",
  "</S>",
  "",
  '<S id="silent">',
  "Silent line.",
  "</S>",
  "",
].join("\n");

const T12_3_2_INNER = [
  'import SPEC from "../specs/C.xspec";',
  "",
  "export function useWon(): void {",
  "  SPEC.won;",
  "}",
  "",
].join("\n");

const T12_3_2_OUTER = [
  'import SPEC from "../specs/C.xspec";',
  "",
  "export function useRef(): void {",
  "  SPEC.ref;",
  "}",
  "",
].join("\n");

const T12_3_2_REF = "specs/C.mdx#ref";

const T12_3_2 = defineProductTest({
  id: "T12.3-2",
  title:
    "`ids --unreferenced` lists only nodes with no incoming `depends`/`embeds`/`references` edges — `contains` does not count, so a parent whose child is referenced still lists when itself unreferenced — and unreferenced ≠ uncovered: a node referenced from outside the profile's coverage boundary is absent from the listing yet uncovered in that profile (SPEC 12.3, 8)",
  run: async (product) => {
    await withWorkspace(
      T12_3_2_CONFIG,
      {
        "specs/C.mdx": T12_3_2_C,
        "binside/use.ts": T12_3_2_INNER,
        "boutside/far.ts": T12_3_2_OUTER,
      },
      async (workspace) => {
        await buildOk(product, workspace, "T12.3-2 `build`");

        // The listing: exactly the nodes with no incoming dependency edges,
        // in document order. `par` lists although its child `par.dep` is
        // referenced (incoming `depends`) and although `par` carries
        // `contains` edges (from the root, to its child) — `contains` does
        // not count. `won` (references from boundary code), `quoted`
        // (embeds), `ref` (references from non-boundary code), and `par.dep`
        // (depends) are all excluded.
        await expectFlatListing(
          product,
          workspace,
          ["--unreferenced"],
          [{ file: "specs/C.mdx", ids: ["par", "silent"] }],
          "T12.3-2 `ids --unreferenced --json`",
        );

        // Unreferenced ≠ uncovered: `ref` is referenced (absent from the
        // listing above) yet uncovered in profile `gate` — its only incoming
        // dependency edge comes from code outside the profile's boundary
        // group (SPEC 8: a permitted path must start at a boundary node).
        const coverageContext = "T12.3-2 `coverage --json`";
        const coverage = decodeCoverageReport(
          await runJson(
            product,
            workspace,
            ["coverage", "--json"],
            coverageContext,
          ),
          coverageContext,
        );
        const gate = coverage.profiles.find(
          (profile) => profile.name === "gate",
        );
        if (gate === undefined) {
          fail(
            `${coverageContext}: the report carries the one configured ` +
              `profile "gate" (SPEC 8.2: \`coverage\` runs all profiles); ` +
              `got profiles ${JSON.stringify(
                coverage.profiles.map((profile) => profile.name),
              )}`,
          );
        }
        assertSameJson(
          [...gate.uncovered].sort(),
          [
            "specs/C.mdx#par.dep",
            "specs/C.mdx#quoted",
            T12_3_2_REF,
            "specs/C.mdx#silent",
          ],
          `${coverageContext}: profile gate's uncovered required nodes — ` +
            `${T12_3_2_REF} is referenced yet uncovered (its reference ` +
            `comes from outside the boundary), demonstrating unreferenced ` +
            `≠ uncovered (SPEC 12.3, 8, 8.1)`,
        );
        if (!gate.covered.some((node) => node.identity === "specs/C.mdx#won")) {
          fail(
            `${coverageContext}: specs/C.mdx#won is referenced from the ` +
              `boundary code group, a single permitted edge in direct mode, ` +
              `so it is covered (SPEC 8); covered: ${JSON.stringify(
                gate.covered.map((node) => node.identity),
              )}`,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.4-1 — `show`: the full enumeration, adapter-compared to `query node`
// ---------------------------------------------------------------------------

// Discriminating fixture (TEST-SPEC 12.4): the non-root node carries tags and
// coverage="none" (a `show` omitting either fails), plus edges of all four
// kinds across the workspace — incoming contains/embeds, outgoing
// contains/depends/embeds on `star`; the code marker gives `peer` an incoming
// `references` edge. `star`'s tags are spelled out of tag-set form (SPEC
// 12.7, 2.6) — out of byte order, `amber` duplicated, and a mixed-case
// member — so their set form, `T12_4_1_STAR_TAGS`, differs from the spelled
// order with or without the duplicate, from a case-insensitive collation
// (`amber`, `vital`, `Zeta`), and from the case-folded set (`zeta`).
const T12_4_1_S = [
  '<S id="star" tags="vital amber amber Zeta" coverage="none" d={"peer"}>',
  "Star intro.",
  "",
  '<S id="star.point">',
  "Point line.",
  "</S>",
  "",
  '{text("peer")}',
  "</S>",
  "",
  '<S id="peer">',
  "Peer line.",
  "</S>",
  "",
].join("\n");

const T12_4_1_APP = [
  'import SPEC, { text } from "../specs/S.xspec";',
  "",
  "export function embedStar(): string {",
  "  return text(SPEC.star);",
  "}",
  "",
  "export function markPeer(): void {",
  "  SPEC.peer;",
  "}",
  "",
].join("\n");

const T12_4_1_STAR = "specs/S.mdx#star";
const T12_4_1_ROOT = "specs/S.mdx";
// The 12.7 tag-set form of `star`'s spelled `tags="vital amber amber Zeta"`:
// byte order (U+005A sorts before U+0061), the duplicate collapsed, the
// mixed-case member kept as spelled (SPEC 12.7, 2.6).
const T12_4_1_STAR_TAGS = ["Zeta", "amber", "vital"];

/**
 * The human `show <node>` at the state of a decoded `show <node> --json`
 * report, after that arm's own JSON assertions — T12.0-1's information
 * parity (SPEC 12.0: the JSON form carries the same information as the
 * human report; the module header): the same argv without `--json` exits 0
 * (an informational report, SPEC 12.0), and its report mentions the full
 * 12.4 enumeration the decoded report carries, in three calls. First, its
 * literal data: the identity and the `from` and `to` of every incoming and
 * outgoing edge (identity boundaries, so `specs/S.mdx#star` never counts
 * inside `specs/S.mdx#star.point`, nor the root's `specs/S.mdx` inside its
 * sections' identities), each tag where the node has tags and the coverage
 * value where it has one, every trimmed non-blank line of the own and the
 * subtree text, and the four hashes (plain strings). Second, each distinct
 * kind among the edges (SPEC-named tokens, SPEC 5.2), matched with every
 * literal datum of the first call blanked out, so a kind's spelling inside a
 * datum — `embeds` in `src/app.ts#embedStar`, case-insensitively — never
 * stands in for it. Third, the source range's start and end (whole numbers,
 * SPEC 1.7), matched with the first call's digit-holding data — the hashes
 * among them — blanked out, save a datum that is itself a whole number
 * (`digitHoldingData` from section-10.7-i.ts). A call with nothing to ask
 * is skipped. Robust matching (H-3): presence, never wording, and no mention
 * associated with another.
 */
async function assertHumanShowReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  report: NodeReport,
  context: string,
): Promise<void> {
  const label = `${context} \`show ${report.identity}\` (human report)`;
  const human = await expectExit(
    product,
    workspace,
    ["show", report.identity],
    0,
    `${label} — the same exit code as the \`--json\` report at this state: ` +
      `0, an informational report (SPEC 12.4, 12.0)`,
  );
  const edges = [...report.incomingEdges, ...report.outgoingEdges];
  const identities = new Set<string>([report.identity]);
  for (const edge of edges) {
    identities.add(edge.from);
    identities.add(edge.to);
  }
  const plain = new Set<string>([
    ...(report.tags ?? []),
    ...(report.coverage === undefined ? [] : [report.coverage]),
    ...nonBlankLines(report.ownText),
    ...nonBlankLines(report.subtreeText),
    report.hashes.ownHash,
    report.hashes.subtreeHash,
    report.hashes.effectiveHash,
    report.hashes.metadataHash,
  ]);
  const literal = [...new Set([...identities, ...plain])];
  assertReportMentions(
    human,
    [...[...identities].map(identityMention), ...plain],
    `${label}: the full 12.4 enumeration's data — the identity, every ` +
      `incoming and outgoing edge's endpoints, the tags and the coverage ` +
      `value where the node has them, every line of the own and the ` +
      `subtree text, and the four hashes — the information of the JSON ` +
      `report (SPEC 12.4, 1.6, 5.5, 11, 12.0)`,
  );
  const kinds = [...new Set(edges.map((edge) => edge.kind))];
  if (kinds.length > 0) {
    assertReportMentions(
      human,
      kinds.map(specTokenMention),
      `${label}: every edge kind the report's edges carry — edges by kind, ` +
        `matched with the report's identities, tags, coverage value, text ` +
        `lines, and hashes blanked out (SPEC 12.4, 5.2, 12.0)`,
      { blank: literal },
    );
  }
  assertReportMentions(
    human,
    [...new Set([report.sourceRange.start, report.sourceRange.end])].map(
      numberMention,
    ),
    `${label}: the source range's start and end, whole numbers, matched ` +
      `with the report's digit-holding data — the hashes among them — ` +
      `blanked out, save a datum that is itself a whole number (SPEC 12.4, ` +
      `1.7, 12.0)`,
    { blank: digitHoldingData(literal) },
  );
}

const T12_4_1 = defineProductTest({
  id: "T12.4-1",
  title:
    "`show` accepts `path#id` and bare `path` (root) and prints the full 12.4 enumeration — identity, source range, own and subtree text, hashes, tags, coverage attribute, and edges by kind — each field equal to the corresponding `query node` field for the same node (adapter-compared); the staged tags — spelled out of byte order, with a duplicate and a mixed-case member — are pinned in 12.7's tag-set form (byte order, duplicates collapsed, never case-folded) on both `show` and `query node`, coverage=\"none\" is pinned on the `show` side, and the root arm reports the coverage attribute absent; and at each arm the human `show` at the same state exits 0 alike and mentions the identity, every edge's endpoints and kind, the tags and coverage value where the node has them, every line of its own and subtree text, the four hashes, and the source range's start and end (robust matching, H-3) (SPEC 12.4, 11, 1.7, 12.7, 2.6, 12.0)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      { "specs/S.mdx": T12_4_1_S, "src/app.ts": T12_4_1_APP },
      async (workspace) => {
        await buildOk(product, workspace, "T12.4-1 `build`");

        const decodeBoth = async (
          node: string,
          label: string,
        ): Promise<{ show: NodeReport; query: NodeReport }> => {
          const showContext = `T12.4-1 \`show ${node} --json\` (${label})`;
          const show = decodeNodeReport(
            await runJson(
              product,
              workspace,
              ["show", node, "--json"],
              showContext,
            ),
            showContext,
          );
          const queryContext = `T12.4-1 \`query node ${node} --json\` (${label})`;
          const query = decodeNodeReport(
            await runJson(
              product,
              workspace,
              ["query", "node", node, "--json"],
              queryContext,
            ),
            queryContext,
          );
          assertSameJson(
            normalizedNodeReport(show),
            normalizedNodeReport(query),
            `T12.4-1 (${label}): every \`show\` field — identity, source ` +
              `range, own and subtree text, hashes, tags, coverage ` +
              `attribute, and edges by kind — equals the corresponding ` +
              `\`query node\` field for ${node} (SPEC 12.4, 11; H-3, ` +
              `spec-unordered members normalized)`,
          );
          assertSameJson(
            show.identity,
            node,
            `T12.4-1 (${label}): \`show ${node}\` reports the addressed ` +
              `node's identity (SPEC 12.4, 1.5)`,
          );
          return { show, query };
        };

        // path#id arm: the discriminating fields pinned on the show side —
        // the adapter compare alone would accept a symmetric omission. The
        // tags are pinned literally in their 12.7 set form on both surfaces
        // (each decoded form-exact, never re-sorted here): the decode
        // rejects an unsorted or duplicated array, the adapter compare a
        // form one surface alone deviates in, and these pins a form both
        // share — a case-folded set is byte-sorted, so only they catch it.
        const star = await decodeBoth(T12_4_1_STAR, "path#id arm");
        assertSameJson(
          star.show.tags,
          T12_4_1_STAR_TAGS,
          `T12.4-1: \`show ${T12_4_1_STAR} --json\` reports the staged ` +
            `tags (spelled "vital amber amber Zeta") in the 12.7 tag-set ` +
            `form — byte order, duplicates collapsed, never case-folded; a ` +
            `show omitting tags fails (SPEC 12.4, 12.7, 2.6)`,
        );
        assertSameJson(
          star.query.tags,
          T12_4_1_STAR_TAGS,
          `T12.4-1: \`query node ${T12_4_1_STAR} --json\` reports the ` +
            `staged tags (spelled "vital amber amber Zeta") in the 12.7 ` +
            `tag-set form — byte order, duplicates collapsed, never ` +
            `case-folded (SPEC 11.1, 12.7, 2.6)`,
        );
        if (star.show.coverage !== "none") {
          fail(
            `T12.4-1: \`show ${T12_4_1_STAR}\` reports the staged ` +
              `coverage="none" attribute — a show omitting the coverage ` +
              `attribute fails (SPEC 12.4, 2.5); got ` +
              `${star.show.coverage === undefined ? "absent" : JSON.stringify(star.show.coverage)}`,
          );
        }
        // Human form, at the same state: the full enumeration the decoded
        // report carries — star's data, its edges' endpoints and kinds
        // across the workspace, its expanded texts (1.6), and its range
        // (module header; H-3).
        await assertHumanShowReport(
          product,
          workspace,
          star.show,
          "T12.4-1 (path#id arm)",
        );

        // bare-path (root) arm: the coverage attribute is reported absent
        // (SPEC 12.4: absent for a root node, 11).
        const root = await decodeBoth(T12_4_1_ROOT, "bare-path root arm");
        if (root.show.coverage !== undefined) {
          fail(
            `T12.4-1: \`show ${T12_4_1_ROOT}\` reports the coverage ` +
              `attribute as absent for a root node (SPEC 12.4, 11); got ` +
              `${JSON.stringify(root.show.coverage)}`,
          );
        }
        // Human form, at the same state: the root's enumeration — no tags
        // and no coverage value to ask, its `contains` edges' endpoints and
        // kind, its texts, hashes, and the whole file's range.
        await assertHumanShowReport(
          product,
          workspace,
          root.show,
          "T12.4-1 (bare-path root arm)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.5-1 — dispatch: the ten commands reach their sections; unknown → 2
// ---------------------------------------------------------------------------

const T12_5_1_D = [
  '<S id="anchor">',
  "Anchor line.",
  "",
  '<S id="anchor.sub">',
  "Sub line.",
  "</S>",
  "</S>",
  "",
].join("\n");

const T12_5_1 = defineProductTest({
  id: "T12.5-1",
  title:
    "`coverage`, `impact`, `review`, `query`, `occurrences`, `view`, `at`, `inventory`, `rename`, and `move` dispatch into their sections' specified outcomes (behavior covered in sections 8, 9, 10, 11, 6; the four §11 read surfaces are JSON-only, answering one document when invoked bare); an unknown command or an unknown `query`/`review` subcommand is a usage error, exit 2 (SPEC 12.5, 12.0, 11)",
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/D.mdx": T12_5_1_D,
      },
    });
    try {
      // A pinned git fixture (E-6/H-1) so `impact --base` has a baseline.
      await workspace.gitInit();
      const baseRef = await workspace.gitCommitAll("baseline sources");
      await buildOk(product, workspace, "T12.5-1 `build`");

      // `coverage` (SPEC 8.2): zero configured profiles — a valid, empty
      // report at exit 0 (T7-3's reading).
      const coverageContext = "T12.5-1 `coverage --json` (dispatch)";
      const coverage = decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "--json"],
          coverageContext,
        ),
        coverageContext,
      );
      assertSameJson(
        coverage.profiles.map((profile) => profile.name),
        [],
        `${coverageContext}: no coverage profiles are configured, so ` +
          `\`coverage\` runs zero profiles and reports none (SPEC 8.2, 7.4)`,
      );

      // `impact --base` (SPEC 9.3): the workspace equals the baseline
      // commit, so the informational report carries no differences.
      const impactContext = `T12.5-1 \`impact --base ${baseRef} --json\` (dispatch)`;
      const impact = decodeImpactReport(
        await runJson(
          product,
          workspace,
          ["impact", "--base", baseRef, "--json"],
          impactContext,
        ),
        impactContext,
      );
      assertSameJson(
        {
          requirements: impact.requirements,
          direct: impact.code.direct,
          transitive: impact.code.transitive,
        },
        { requirements: [], direct: [], transitive: [] },
        `${impactContext}: the current workspace is byte-identical to the ` +
          `baseline commit, so impact reports no requirement or code ` +
          `differences and exits 0 (SPEC 9.3, 12.0)`,
      );

      // `review` (SPEC 10.7): `list` with no sessions — every session
      // reported, none exist, exit 0.
      const listContext = "T12.5-1 `review list --json` (dispatch)";
      const sessions = decodeSessionListReport(
        await runJson(
          product,
          workspace,
          ["review", "list", "--json"],
          listContext,
        ),
        listContext,
      );
      assertSameJson(
        sessions.sessions,
        [],
        `${listContext}: no sessions exist, so \`review list\` reports ` +
          `none and exits 0 (SPEC 10.7, 12.0)`,
      );

      // `query` (SPEC 11): the workspace's requirement nodes.
      const nodesContext = "T12.5-1 `query nodes --json` (dispatch)";
      const rows = decodeNodeRowsReport(
        await runJson(
          product,
          workspace,
          ["query", "nodes", "--json"],
          nodesContext,
        ),
        nodesContext,
      );
      assertSameJson(
        sortedIdentities(rows),
        ["specs/D.mdx", "specs/D.mdx#anchor", "specs/D.mdx#anchor.sub"],
        `${nodesContext}: \`query nodes\` rows are the workspace's ` +
          `requirement nodes, the root included (SPEC 11, 1.2)`,
      );

      // `occurrences` (SPEC 11.3): a JSON-only surface — one document with
      // or without `--json` (SPEC 11), invoked bare. Nothing in the
      // workspace spells a reference, so the enumeration is the definitive
      // empty, finding-free answer, exit 0.
      const occurrencesContext = "T12.5-1 `occurrences` (dispatch)";
      const occurrences = decodeOccurrencesReport(
        await runJson(product, workspace, ["occurrences"], occurrencesContext),
        occurrencesContext,
      );
      assertSameJson(
        occurrences,
        { findings: [], occurrences: [] },
        `${occurrencesContext}: no reference spelling exists in the ` +
          `workspace, so the enumeration is empty and finding-free — ` +
          `definitive over the whole discovered set (SPEC 11.3, 5.7, 12.7)`,
      );

      // `view` (SPEC 11.4): with neither `<file>` operands nor `--file`,
      // the request covers every discovered spec source — here exactly
      // specs/D.mdx, finding-free (scoped decode; the full per-file view
      // is T11.4-*'s subject).
      const viewContext = "T12.5-1 `view` (dispatch)";
      const view = decodeViewFilesReport(
        await runJson(product, workspace, ["view"], viewContext),
        viewContext,
      );
      assertSameJson(
        view,
        { findings: [], files: ["specs/D.mdx"] },
        `${viewContext}: with neither operands nor \`--file\`, the request ` +
          `covers every discovered spec source — one per-file view, for ` +
          `specs/D.mdx, finding-free (SPEC 11.4, 12.7)`,
      );

      // `at` (SPEC 11.5): byte offset 20 lies inside "Anchor line." —
      // within `anchor`'s construct range (bytes 0..69: `<S id="anchor">`
      // opens at byte 0 and its closing `</S>` ends at byte 69), outside
      // `anchor.sub`'s (bytes 30..64) — so the innermost enclosing section
      // construct is `anchor`; the offset lies within no occurrence.
      const atContext = "T12.5-1 `at specs/D.mdx 20` (dispatch)";
      const atReport = decodeAtReport(
        await runJson(
          product,
          workspace,
          ["at", "specs/D.mdx", "20"],
          atContext,
        ),
        atContext,
      );
      assertSameJson(
        atReport,
        {
          findings: [],
          resolution: {
            section: {
              identity: "specs/D.mdx#anchor",
              range: { start: 0, end: 69 },
            },
            occurrence: null,
          },
        },
        `${atContext}: the offset resolves to the innermost enclosing ` +
          `section construct — \`anchor\`, its construct range bytes 0..69 ` +
          `(1.7) — with no containing occurrence and no finding ` +
          `(SPEC 11.5, 11.2, 12.7)`,
      );

      // `inventory` (SPEC 11.6): parses no sources and answers the
      // workspace's shape; the record-supplied datum names the module the
      // `build` above generated (scoped decode; the full inventory form is
      // T11.6-*'s subject).
      const inventoryContext = "T12.5-1 `inventory` (dispatch)";
      const recorded = decodeInventoryRecordedDatum(
        await runJson(product, workspace, ["inventory"], inventoryContext),
        inventoryContext,
      );
      if (recorded.state !== "value") {
        fail(
          `${inventoryContext}: after the successful \`build\` above, the ` +
            `record-supplied datum is the plain recorded derived-file ` +
            `paths — never unavailability, never null (SPEC 11.6, 12.7); ` +
            `got state ${JSON.stringify(recorded.state)}`,
        );
      }
      if (!recorded.value.includes("specs/D.xspec.ts")) {
        fail(
          `${inventoryContext}: the recorded derived-file paths — the ` +
            `paths as last generated, companions included — name the ` +
            `generated module specs/D.xspec.ts (SPEC 11.6, 13.1, 13.3); ` +
            `got ${JSON.stringify(recorded.value)}`,
        );
      }

      // Unknown command and unknown subcommands → exit 2 (SPEC 12.5, 12.0).
      await expectUsageError(
        product,
        workspace,
        ["transmogrify"],
        "an unknown command",
        "T12.5-1 `transmogrify`",
      );
      await expectExit(
        product,
        workspace,
        ["transmogrify"],
        2,
        "T12.5-1 `transmogrify` (without --json) — an unknown command is a " +
          "usage error, exit 2 (SPEC 12.5, 12.0)",
      );
      await expectUsageError(
        product,
        workspace,
        ["query", "transmogrify"],
        "an unknown `query` subcommand",
        "T12.5-1 `query transmogrify`",
      );
      await expectUsageError(
        product,
        workspace,
        ["review", "transmogrify"],
        "an unknown `review` subcommand",
        "T12.5-1 `review transmogrify`",
      );

      // `rename` (SPEC 6.4) and file-form `move` (SPEC 6.5) dispatch into
      // their journaled mutations — run last, since they rewrite the
      // workspace. Both emit one JSON document under --json (SPEC 12.0).
      await runJson(
        product,
        workspace,
        ["rename", "specs/D.mdx", "anchor.sub", "anchor.part", "--json"],
        "T12.5-1 `rename specs/D.mdx anchor.sub anchor.part --json` " +
          "(dispatch) — a valid rename succeeds (SPEC 6.4)",
      );
      await runJson(
        product,
        workspace,
        ["move", "specs/D.mdx", "specs/E.mdx", "--json"],
        "T12.5-1 `move specs/D.mdx specs/E.mdx --json` (dispatch) — a valid " +
          "file-form move succeeds (SPEC 6.5)",
      );
    } finally {
      await workspace.dispose();
    }
  },
});

export const section123to125Tests: readonly ProductTestEntry[] = [
  T12_3_1,
  T12_3_2,
  T12_4_1,
  T12_5_1,
];
