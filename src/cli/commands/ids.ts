// `xspec ids` (SPEC 12.3): requirement IDs grouped by file.
//
// One entry per discovered spec source — none for a code source, which
// bears no requirement IDs — in byte order of workspace-relative path, each
// holding its file's listed IDs in document order and present even when it
// holds none: a file with no sections, or one whose every ID
// `--unreferenced` excludes (SPEC 12.3). The entries come from discovery —
// the classification's spec sources, byte-ordered (SPEC 12.0) — and their
// IDs from the graph's requirement-node list, whose nodes within a file
// follow document order. `ids` is a gated read (SPEC 13.3), so where it
// answers every discovered spec source has a valid path (14.19) and parses
// (14.20). `--tree` renders each file's IDs as a tree following section
// nesting instead of a flat list, in the same file and document order.
// `--file <glob>` restricts the entries to the spec sources the glob
// matches (the rules of SPEC 7, as in 11: a pattern resolving outside the
// workspace root is an invalid flag value, exit 2), so a glob matching
// none, or only code sources, leaves no entry. `--unreferenced` restricts
// the listed IDs to those of requirement nodes with no incoming dependency
// edges from specs or code (`contains` does not count) — unreferenced is
// not the same as uncovered (SPEC 12.3). When the listing is restricted and
// a listed node's parent is not listed, `--tree` nests the node under its
// nearest listed ancestor, or at its file's top level when no ancestor is
// listed: the tree contains exactly the listed IDs.
//
// Roots never appear: the listing is of requirement IDs, and a file's
// implicit root carries none (SPEC 1.2, 1.3). The answer comes from the
// refreshed graph (SPEC 13.3, via cli/prepare.ts); `--json` emits the
// single JSON document per SPEC 12.0, and the human form carries the same
// information — each entry a file line with its IDs (or, under `--tree`,
// its tree) beneath it, an empty entry its file line alone.

import type { JsonObject } from "../../core/canonical-json.js";
import type { DiscoveredSource } from "../../core/discovery.js";
import type { ExitCode } from "../../core/findings.js";
import type { CompiledGlob } from "../../core/glob.js";
import type { RequirementNode, WorkspaceGraph } from "../../core/graph.js";
import { renderPathText } from "../../core/path-text.js";
import type { Invocation } from "../args.js";
import { flagPresent } from "../args.js";
import type { CommandContext } from "../io.js";
import { prepareGraphForRead } from "../prepare.js";
import { compileFileFlag, emitDocument } from "./common.js";

/** The requirement ID of a listed node — never a root (see the filter). */
function requirementIdOf(node: RequirementNode): string {
  if (node.id === null) {
    throw new Error(
      `xspec internal error: root node ${node.identity} in an ids listing`,
    );
  }
  return node.id;
}

/**
 * SPEC 12.3: a node is unreferenced when it has no incoming dependency
 * edges from specs or code — `contains` does not count (the dependency
 * kinds are `depends`, `embeds`, `references`; SPEC 5.2).
 */
function isReferenced(graph: WorkspaceGraph, node: RequirementNode): boolean {
  return graph
    .incomingEdges(node.identity)
    .some((edge) => edge.kind !== "contains");
}

/** One entry: a discovered spec source and its listed nodes, possibly none. */
interface FileGroup {
  readonly file: string;
  readonly nodes: readonly RequirementNode[];
}

/**
 * SPEC 12.3: the listing's entries — one per discovered spec source the
 * listing covers (those `fileGlob` matches, when given), in byte order of
 * workspace-relative path (the classification's order, SPEC 12.0), none
 * for a code source — each holding its file's listed nodes in document
 * order, and present even when it holds none. `listed` follows the graph's
 * requirement-node list, whose nodes within a file come in document order,
 * so each file's nodes accumulate in that order.
 */
function entriesOf(
  specSources: readonly DiscoveredSource[],
  listed: readonly RequirementNode[],
  fileGlob: CompiledGlob | undefined,
): FileGroup[] {
  const byFile = new Map<string, RequirementNode[]>();
  for (const source of specSources) {
    byFile.set(source.path, []);
  }
  for (const node of listed) {
    const nodes = byFile.get(node.path);
    if (nodes === undefined) {
      // A gated read answers from a passing workspace, every node of whose
      // graph lies in a discovered spec source (SPEC 13.3, 5.1).
      throw new Error(
        `xspec internal error: requirement node ${node.identity} outside ` +
          `every discovered spec source`,
      );
    }
    nodes.push(node);
  }
  return specSources
    .filter((source) => fileGlob === undefined || fileGlob.matches(source.path))
    .map((source) => ({
      file: source.path,
      nodes: byFile.get(source.path) ?? [],
    }));
}

/** One `--tree` node: the full requirement ID plus nested children. */
interface TreeNode {
  readonly id: string;
  readonly children: TreeNode[];
}

/**
 * SPEC 12.3: one file's listed nodes as a tree following section nesting.
 * Each node nests under its nearest listed ancestor, or at the file's top
 * level when no ancestor is listed — for an unrestricted listing every
 * parent is listed, so this is exactly the section structure. Document
 * order is pre-order (a parent's construct begins before its descendants'),
 * so every listed ancestor is placed before its descendants arrive, and
 * children accumulate in document order. The tree contains exactly the
 * listed IDs.
 */
function buildFileTree(
  graph: WorkspaceGraph,
  nodes: readonly RequirementNode[],
): TreeNode[] {
  const placed = new Map<string, TreeNode>();
  const top: TreeNode[] = [];
  for (const node of nodes) {
    const built: TreeNode = { id: requirementIdOf(node), children: [] };
    placed.set(node.identity, built);
    let nearest: TreeNode | undefined;
    for (
      let ancestor = graph.parentOf(node);
      ancestor !== null;
      ancestor = graph.parentOf(ancestor)
    ) {
      nearest = placed.get(ancestor.identity);
      if (nearest !== undefined) break;
    }
    if (nearest !== undefined) {
      nearest.children.push(built);
    } else {
      top.push(built);
    }
  }
  return top;
}

/**
 * A file's tree as JSON data (`--tree --json`, SPEC 12.3): each node an
 * object of its ID and its children, in document order. SPEC 1.3 bounds no
 * nesting depth, so the tree is converted on an explicit stack, never the
 * call stack: each node is appended to its parent's children when popped,
 * its own children pushed in reverse so they pop in document order.
 */
function treeJson(top: readonly TreeNode[]): JsonObject[] {
  const out: JsonObject[] = [];
  const stack: { readonly node: TreeNode; readonly into: JsonObject[] }[] = [];
  for (let index = top.length - 1; index >= 0; index -= 1) {
    stack.push({ node: top[index], into: out });
  }
  while (stack.length > 0) {
    const { node, into } = stack[stack.length - 1];
    stack.pop();
    const children: JsonObject[] = [];
    into.push({ id: node.id, children });
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: node.children[index], into: children });
    }
  }
  return out;
}

/**
 * The flat human listing: each entry's file line — the path in the shared
 * human spelling (core/path-text.ts, SPEC 12.0), as in every human listing
 * here — with its IDs indented under it; an entry holding no ID is its
 * file line alone (SPEC 12.3).
 */
function renderFlatHuman(groups: readonly FileGroup[]): string {
  let out = "";
  for (const group of groups) {
    out += `${renderPathText(group.file)}\n`;
    for (const node of group.nodes) {
      out += `  ${requirementIdOf(node)}\n`;
    }
  }
  return out;
}

/**
 * The tree human listing: each entry's file line with its tree's full IDs
 * indented by nesting depth beneath it; an entry holding no node is its
 * file line alone (SPEC 12.3). SPEC 1.3 bounds no nesting depth, so each
 * tree is walked in pre-order on an explicit stack, never the call stack,
 * children pushed in reverse so they pop in document order.
 */
function renderTreeHuman(
  groups: readonly { file: string; nodes: readonly TreeNode[] }[],
): string {
  let out = "";
  const stack: { readonly node: TreeNode; readonly depth: number }[] = [];
  for (const group of groups) {
    out += `${renderPathText(group.file)}\n`;
    for (let index = group.nodes.length - 1; index >= 0; index -= 1) {
      stack.push({ node: group.nodes[index], depth: 1 });
    }
    while (stack.length > 0) {
      const { node, depth } = stack[stack.length - 1];
      stack.pop();
      out += `${"  ".repeat(depth)}${node.id}\n`;
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: node.children[index], depth: depth + 1 });
      }
    }
  }
  return out;
}

/** The `ids` command handler (SPEC 12.3). */
export async function idsCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const { stdout, stderr } = context;

  // SPEC 12.3/11: `--file` compiles under the glob rules of 7; a pattern
  // outside the workspace root is an invalid flag value, which the parser
  // has already refused by its spelling alone (12.0's syntax class).
  const fileGlob = compileFileFlag(invocation);

  // SPEC 13.3: refresh-on-read, then answer.
  const prepared = await prepareGraphForRead(invocation, context);
  if (!prepared.ok) {
    return prepared.exit;
  }
  const { graph, classification } = prepared.analysis;
  const unreferenced = flagPresent(invocation, "--unreferenced");

  // The listed IDs (SPEC 12.3): those of non-root requirement nodes
  // surviving `--unreferenced`, in the graph's file-byte/document order;
  // the entries, `--file`'s restriction among them, come from discovery.
  const listed = graph.requirementNodes.filter(
    (node) => node.id !== null && !(unreferenced && isReferenced(graph, node)),
  );
  const groups = entriesOf(classification.specSources, listed, fileGlob);

  if (flagPresent(invocation, "--tree")) {
    const trees = groups.map((group) => ({
      file: group.file,
      nodes: buildFileTree(graph, group.nodes),
    }));
    if (invocation.json) {
      return emitDocument(stdout, {
        files: trees.map((entry) => ({
          file: entry.file,
          nodes: treeJson(entry.nodes),
        })),
      });
    }
    stdout.write(renderTreeHuman(trees));
    return 0;
  }

  if (invocation.json) {
    return emitDocument(stdout, {
      files: groups.map((group) => ({
        file: group.file,
        ids: group.nodes.map(requirementIdOf),
      })),
    });
  }
  stdout.write(renderFlatHuman(groups));
  return 0;
}
