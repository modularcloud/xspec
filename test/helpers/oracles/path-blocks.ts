// In-harness path-blocks generation oracle (TEST-SPEC 16 P-16, 17 S-6): an
// independent implementation of SPEC.md 10.5's `path-blocks` derivation —
// the items `review create --base` puts in a baseline session — derived
// from the baseline graph-diff oracle (helpers/oracles/graph-diff.ts,
// P-6's): its categories over two workspace graphs whose identities the
// caller has already mapped forward through the journal suffix (SPEC 6.3),
// its hash facts, and SPEC 9.2's impacted code over the code locations'
// impact edges in either graph. Per S-6, the oracle passes its fixed vector
// suite (test/self/s6-path-blocks-oracle.test.ts) — SPEC.md 15's worked
// session, its four items, and the item lists TEST-SPEC pins in T10.5-1,
// T10.5-7, T10.5-8, and T10.5-9 — before P-16 trusts it. Harness machinery
// only: pure functions, no product imports, no I/O, no test-framework
// dependence.
//
// Input. The graph-diff oracle's two sides, each node also carrying its
// `d`-declared target set (`dTargets`, SPEC 2.2, 5.5 — the metadata half
// `metaKey` keeps opaque, which `metadata-consistency`'s context and the
// origin counting rule read), plus each side's code locations with their
// impact-edge targets (`references` and `embeds`, 9.2), the baseline's
// mapped like its requirement nodes. Identities are node identities (1.5):
// a root's is its file path alone, a section's `path#id`, so a root is an
// identity without `#`. The graph-diff oracle runs under its relocation
// tolerance (its module header): P-16 moves sections into other parents
// beside edits, and T10.5-9's present-node arm leaves the moved node
// `changed`.
//
// SPEC 10.5 as implemented here:
//
// * Links. A node present in the current graph (kept or added) is the
//   child of its current parent; a node deleted since the baseline is the
//   child of its baseline parent, identities mapped (the caller's mapping)
//   — ancestors, descendants, and subtrees below follow these links, as
//   node relations and node sets alone: every hash fact is the graph-diff
//   oracle's, over each side's own structure.
// * Visiting. Each `changed` node (the graph-diff oracle's `changed`,
//   added and deleted nodes included) with no `changed` ancestor is
//   visited — a root included, which has no ancestor.
// * `subtree-coherence` per visited N: scope N and all its descendants;
//   context N's ancestor chain; origin the `changed` nodes in scope;
//   `blockedBy` empty.
// * `parent-consistency` per non-root ancestor A of a visited node: scope
//   A; context A's children on changed branches — each one visited or
//   itself such an ancestor — one context node per branch; origin the
//   `changed` nodes in A's subtree; `blockedBy`, per branch, the child's
//   `subtree-coherence` item when the child is visited, else the child's
//   `parent-consistency` item.
// * `metadata-consistency` per `metadata-changed` node: scope and origin
//   the node; context the added and removed `d` targets (the symmetric
//   difference of its two `d`-target sets); `blockedBy` empty.
// * `dependency-consistency` per current-graph requirement node — roots and
//   added nodes included — with a current-graph dependency edge (`depends`
//   or `embeds`) to a target present on both sides whose effectiveHash
//   changed: scope the node; context those targets; origin their
//   attributions (below); `blockedBy` empty.
// * `code-impact` per code location of either graph with an impact edge,
//   in either graph, to a target whose subtreeHash or effectiveHash
//   changed — an added or deleted target counting as changed in both (9.2):
//   scope the location; context those targets; origin their attributions;
//   `blockedBy` empty.
// * Order. Requirement-scoped items by scope-node depth (ID segment count,
//   roots 0) deepest first, then kind (`subtree-coherence`,
//   `metadata-consistency`, `dependency-consistency`,
//   `parent-consistency`), then scope-node file path bytes, then — present
//   scope nodes first — document order (the current graph's pre-order
//   within the file), absent (deleted) ones after them by identity bytes;
//   then `code-impact` items by location identity bytes. No two items share
//   a kind and scope node, so no item-id tiebreak arises (identity reuse,
//   which needs one, lies outside the input space: one identity names one
//   node on each side).
//
// Attribution — "the originating nodes (5.6) of those targets' categories,
// a target's `metadata-changed` counting only when its `d` targets changed"
// (10.5). An added or deleted target carries `changed` alone (5.6), so it
// is its own attribution. A kept target's categories are attributed to the
// originating nodes whose edits reach its hashes — through its subtree
// (`descendant-changed`) and its dependency edges (`upstream-changed`) —
// beside itself (`changed`, or `metadata-changed` where its `d` set
// changed): the counted originators are the added and deleted nodes and
// the kept nodes whose own content or `d` set changed (a coverage- or
// tags-only edit propagates nothing, 5.6). Required (`origin`): each
// counted kept node the target reaches on both sides — along each side's
// child links and the kept nodes' dependency edges present on both sides —
// and each added (deleted) node hanging, through added (deleted) nodes
// alone, below a kept node it so reaches (5.6's worked examples: a removed
// or added child's parent's ancestors attributed to the parent and the
// child). Tolerated-optional (`originOptional`, accepted present or
// absent): each other counted originator reachable on either side — the
// graph-diff oracle's documented ambiguities carried into attribution: what
// only a relocated member leads to (its holder's `descendant-changed` or
// `upstream-changed` reading on one side alone), and what an added or
// deleted member's own dependency edges reach (the edge-bearing
// added/deleted member tolerance). A kept node's dependency edge present on
// one side only leads nowhere: that change is attributed to its source
// (5.6: a new `d` edge makes the source `metadata-changed`, a new embedding
// `changed`), never to its target.
//
// Misuse guards (H-8) — each throws a plain error, a harness defect, never a
// diagnosed product failure: the graph-diff oracle's own (incomplete
// graphs, cycles, an ownKey not covering the child tokens) and, here, a
// `d`-target list holding a duplicate or a member outside the node's
// `edgeTargets`, a kept node's two `d`-target sets differing under one
// `metaKey`, a dependency or impact edge whose target has no node on its
// side, a node listed as a child of two nodes on one side, a section with
// no parent in the linked tree or a root with one, and two items the order
// cannot tell apart.
//
// Its evaluation, `derivePathBlocks`, is a harness step under its own guard
// (TEST-SPEC S-3, helpers/step-guards.ts): synchronous, bounded by
// construction over the staged input it evaluates, and measured.

import { Buffer } from "node:buffer";
import { guardSyncStep } from "../step-guards.js";
import { computeGraphDiff } from "./graph-diff.js";
import type { GraphDiff, GraphDiffNode } from "./graph-diff.js";

// ---------------------------------------------------------------------------
// Input and output model

/** One requirement node of one side: the graph-diff node and its `d` set. */
export interface PathBlocksNode extends GraphDiffNode {
  /**
   * The node's `d`-declared target identities, a set (SPEC 2.2, 5.2) — each
   * also among `edgeTargets`, and covered by `metaKey` (5.5).
   */
  readonly dTargets: readonly string[];
}

/** One side's requirement graph, keyed by (current-space) identity. */
export type PathBlocksSide = ReadonlyMap<string, PathBlocksNode>;

/**
 * One side's code locations, each with its impact-edge target identities —
 * its `references` and `embeds` edges' targets (SPEC 9.2).
 */
export type PathBlocksCode = ReadonlyMap<string, readonly string[]>;

/** The oracle's input (module header). */
export interface PathBlocksInput {
  /** The baseline graph, identities mapped through the journal suffix. */
  readonly before: PathBlocksSide;
  /** The current graph. */
  readonly after: PathBlocksSide;
  /** The baseline's code locations, identities mapped likewise. */
  readonly codeBefore: PathBlocksCode;
  /** The current graph's code locations. */
  readonly codeAfter: PathBlocksCode;
}

/** The kinds `path-blocks` derives (SPEC 10.4, 10.5), in 10.5's kind order. */
export const PATH_BLOCKS_ITEM_KINDS = [
  "subtree-coherence",
  "metadata-consistency",
  "dependency-consistency",
  "parent-consistency",
  "code-impact",
] as const;
export type PathBlocksItemKind = (typeof PATH_BLOCKS_ITEM_KINDS)[number];

/** One derived item (SPEC 10.2's fields the derivation fixes). */
export interface PathBlocksItem {
  readonly kind: PathBlocksItemKind;
  /** The scope node — the scoped code location for `code-impact`. */
  readonly scope: string;
  /** Whether the scope node is present in the current graph (10.4). */
  readonly scopePresent: boolean;
  /**
   * Every node of the scope, sorted by identity bytes: the scope node and,
   * for `subtree-coherence`, all its descendants in the linked tree.
   */
  readonly scopeSet: readonly string[];
  /** The context nodes, sorted by identity bytes. */
  readonly context: readonly string[];
  /** The required origin members, sorted by identity bytes. */
  readonly origin: readonly string[];
  /**
   * Origin members tolerated present or absent (module header), sorted;
   * disjoint from `origin`.
   */
  readonly originOptional: readonly string[];
  /**
   * The kinds and scope nodes of the items blocking it, each as
   * {@link pathBlocksItemKey} spells it, sorted.
   */
  readonly blockedBy: readonly string[];
}

/** The oracle's prediction. */
export interface PathBlocksPrediction {
  /** The session's items, in SPEC 10.5's item order. */
  readonly items: readonly PathBlocksItem[];
  /**
   * The requirement nodes deleted since the baseline and the code locations
   * absent from the current graph — the scope and context members a read
   * presents absent (10.4).
   */
  readonly absent: ReadonlySet<string>;
  /** The graph-diff oracle's prediction the items derive from. */
  readonly diff: GraphDiff;
}

/** An item's kind and scope node as one key (`<kind> <scope>`). */
export function pathBlocksItemKey(
  kind: PathBlocksItemKind,
  scope: string,
): string {
  return `${kind} ${scope}`;
}

function misuse(message: string): never {
  throw new Error(`path-blocks oracle misuse: ${message}`);
}

/** Byte comparison of two strings' UTF-8 encodings (SPEC 10.5, 12.0). */
function compareBytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** The distinct members of `values`, sorted by identity bytes. */
function sortedBytes(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareBytes);
}

/** A root's identity is its file path alone (SPEC 1.2, 1.5). */
function isRoot(identity: string): boolean {
  return !identity.includes("#");
}

/** The scope node's file path (SPEC 1.5). */
function fileOf(identity: string): string {
  const at = identity.indexOf("#");
  return at < 0 ? identity : identity.slice(0, at);
}

/** ID segment count; roots are 0 (SPEC 10.5). */
function depthOf(identity: string): number {
  const at = identity.indexOf("#");
  return at < 0 ? 0 : identity.slice(at + 1).split(".").length;
}

const KIND_RANK: Readonly<Record<PathBlocksItemKind, number>> = {
  "subtree-coherence": 0,
  "metadata-consistency": 1,
  "dependency-consistency": 2,
  "parent-consistency": 3,
  "code-impact": 4,
};

/**
 * Derive the `path-blocks` items of SPEC 10.5 (module header) from the two
 * graphs and their code locations: every item with its kind, scope node and
 * scope set, context, origin (required and tolerated-optional), and the
 * kinds and scope nodes it is blocked by, in item order.
 */
export function derivePathBlocks(input: PathBlocksInput): PathBlocksPrediction {
  return guardSyncStep("the path-blocks oracle (derivePathBlocks)", () =>
    derivePathBlocksUnguarded(input),
  );
}

/** {@link derivePathBlocks}'s evaluation, under its guard. */
function derivePathBlocksUnguarded(
  input: PathBlocksInput,
): PathBlocksPrediction {
  const { before, after, codeBefore, codeAfter } = input;
  for (const [label, side] of [
    ["baseline", before],
    ["current", after],
  ] as const) {
    for (const [identity, node] of side) {
      guardNode(identity, node, label, side);
    }
  }

  const diff = computeGraphDiff(before, after, {
    relocatedOriginators: "tolerate",
  });
  const { added, deleted } = diff;
  const kept = new Set([...after.keys()].filter((id) => before.has(id)));
  const changed = new Set<string>();
  const metadataChanged: string[] = [];
  for (const [identity, categories] of diff.required) {
    if (categories.has("changed")) changed.add(identity);
    if (categories.has("metadata-changed")) metadataChanged.push(identity);
  }

  const beforeAt = (identity: string): PathBlocksNode => {
    const node = before.get(identity);
    if (node === undefined) misuse(`no baseline node for ${identity}`);
    return node;
  };
  const afterAt = (identity: string): PathBlocksNode => {
    const node = after.get(identity);
    if (node === undefined) misuse(`no current node for ${identity}`);
    return node;
  };

  // A kept node's `d`-target change (the counting rule; metadata-consistency's
  // context), its two sets covered by metaKey.
  const addedAndRemovedD = (identity: string): string[] => {
    const was = new Set(beforeAt(identity).dTargets);
    const is = new Set(afterAt(identity).dTargets);
    return [
      ...[...was].filter((t) => !is.has(t)),
      ...[...is].filter((t) => !was.has(t)),
    ];
  };
  const dChanged = new Set<string>();
  for (const identity of kept) {
    if (addedAndRemovedD(identity).length === 0) continue;
    if (beforeAt(identity).metaKey === afterAt(identity).metaKey) {
      misuse(
        `${identity}'s d-target sets differ across sides while its metaKey ` +
          `compares equal — metaKey must cover the d-target set (SPEC 5.5)`,
      );
    }
    dChanged.add(identity);
  }

  // --- Links (10.5): present nodes under their current parents, deleted
  // nodes under their baseline parents.
  const parentsOn = (
    side: PathBlocksSide,
    label: string,
  ): Map<string, string> => {
    const parents = new Map<string, string>();
    for (const [identity, node] of side) {
      for (const child of node.children) {
        const existing = parents.get(child);
        if (existing !== undefined) {
          misuse(
            `${child} is listed as a child of both ${existing} and ` +
              `${identity} in the ${label} graph — each side's contains ` +
              `edges form a tree`,
          );
        }
        parents.set(child, identity);
      }
    }
    return parents;
  };
  const parentBefore = parentsOn(before, "baseline");
  const parentOf = parentsOn(after, "current");
  for (const [child, parent] of parentBefore) {
    if (deleted.has(child)) parentOf.set(child, parent);
  }
  const nodes = [...kept, ...added, ...deleted];
  for (const identity of nodes) {
    const parent = parentOf.get(identity);
    if (isRoot(identity) && parent !== undefined) {
      misuse(`the root ${identity} hangs below ${parent} in the linked tree`);
    }
    if (!isRoot(identity) && parent === undefined) {
      misuse(
        `the section ${identity} hangs below no parent in the linked tree ` +
          `(SPEC 10.5: a present node under its current parent, a deleted ` +
          `node under its baseline parent)`,
      );
    }
  }
  const childrenOf = new Map<string, string[]>();
  for (const [child, parent] of parentOf) {
    const siblings = childrenOf.get(parent);
    if (siblings === undefined) childrenOf.set(parent, [child]);
    else siblings.push(child);
  }
  const ancestorMemo = new Map<string, readonly string[]>();
  const ancestorsOf = (identity: string): readonly string[] => {
    const cached = ancestorMemo.get(identity);
    if (cached !== undefined) return cached;
    const chain: string[] = [];
    let current = parentOf.get(identity);
    while (current !== undefined) {
      chain.push(current);
      if (chain.length > nodes.length) {
        misuse(`the linked tree cycles through ${identity}`);
      }
      current = parentOf.get(current);
    }
    ancestorMemo.set(identity, chain);
    return chain;
  };
  const descendantsOf = (identity: string): string[] => {
    const found: string[] = [];
    const stack = [...(childrenOf.get(identity) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop() as string;
      found.push(next);
      stack.push(...(childrenOf.get(next) ?? []));
    }
    return found;
  };

  // --- Attribution (module header).
  const counted = (identity: string): boolean =>
    changed.has(identity) || dChanged.has(identity);
  const commonTargets = (identity: string): string[] => {
    const now = new Set(afterAt(identity).edgeTargets);
    return beforeAt(identity).edgeTargets.filter((t) => now.has(t));
  };
  const reachOn = (start: string, side: PathBlocksSide): Set<string> => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const next = stack.pop() as string;
      if (seen.has(next)) continue;
      seen.add(next);
      const node = side.get(next);
      if (node === undefined) misuse(`no node for ${next} on its side`);
      stack.push(...node.children);
      if (kept.has(next)) stack.push(...commonTargets(next));
    }
    return seen;
  };
  const reachEither = (start: string): Set<string> => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const next = stack.pop() as string;
      if (seen.has(next)) continue;
      seen.add(next);
      if (kept.has(next)) {
        stack.push(...beforeAt(next).children, ...afterAt(next).children);
        stack.push(...commonTargets(next));
      } else {
        const node = added.has(next) ? afterAt(next) : beforeAt(next);
        stack.push(...node.children, ...node.edgeTargets);
      }
    }
    return seen;
  };
  // The added (deleted) nodes hanging below a kept holder through added
  // (deleted) nodes alone, on the current (baseline) side.
  const hangingBelow = (holder: string, into: Set<string>): void => {
    const walk = (
      identity: string,
      side: PathBlocksSide,
      oneSided: ReadonlySet<string>,
    ): void => {
      for (const child of side.get(identity)?.children ?? []) {
        if (!oneSided.has(child)) continue;
        into.add(child);
        walk(child, side, oneSided);
      }
    };
    walk(holder, after, added);
    walk(holder, before, deleted);
  };
  interface Attribution {
    readonly required: ReadonlySet<string>;
    readonly optional: ReadonlySet<string>;
  }
  const attributionMemo = new Map<string, Attribution>();
  const attributionOfTarget = (target: string): Attribution => {
    const cached = attributionMemo.get(target);
    if (cached !== undefined) return cached;
    let result: Attribution;
    if (!kept.has(target)) {
      result = { required: new Set([target]), optional: new Set() };
    } else {
      const onBefore = reachOn(target, before);
      const onAfter = reachOn(target, after);
      const required = new Set<string>();
      for (const reached of onBefore) {
        if (!kept.has(reached) || !onAfter.has(reached)) continue;
        if (counted(reached)) required.add(reached);
        hangingBelow(reached, required);
      }
      const optional = new Set<string>();
      for (const reached of reachEither(target)) {
        if (counted(reached) && !required.has(reached)) optional.add(reached);
      }
      result = { required, optional };
    }
    attributionMemo.set(target, result);
    return result;
  };
  const attributionOf = (
    targets: readonly string[],
  ): { required: string[]; optional: string[] } => {
    const required = new Set<string>();
    const optional = new Set<string>();
    for (const target of targets) {
      const one = attributionOfTarget(target);
      for (const member of one.required) required.add(member);
      for (const member of one.optional) optional.add(member);
    }
    return {
      required: [...required],
      optional: [...optional].filter((member) => !required.has(member)),
    };
  };

  // --- Items.
  const items: PathBlocksItem[] = [];
  const add = (
    kind: PathBlocksItemKind,
    scope: string,
    scopePresent: boolean,
    scopeSet: readonly string[],
    context: readonly string[],
    origin: readonly string[],
    originOptional: readonly string[],
    blockedBy: readonly string[],
  ): void => {
    const required = new Set(origin);
    items.push({
      kind,
      scope,
      scopePresent,
      scopeSet: sortedBytes(scopeSet),
      context: sortedBytes(context),
      origin: sortedBytes(origin),
      originOptional: sortedBytes(
        originOptional.filter((member) => !required.has(member)),
      ),
      blockedBy: sortedBytes(blockedBy),
    });
  };

  const visited = [...changed].filter(
    (identity) => !ancestorsOf(identity).some((a) => changed.has(a)),
  );
  const visitedSet = new Set(visited);
  const ancestorItems = new Set<string>();
  for (const identity of visited) {
    for (const ancestor of ancestorsOf(identity)) {
      if (!isRoot(ancestor)) ancestorItems.add(ancestor);
    }
  }
  for (const identity of visited) {
    const scopeSet = [identity, ...descendantsOf(identity)];
    add(
      "subtree-coherence",
      identity,
      !deleted.has(identity),
      scopeSet,
      ancestorsOf(identity),
      scopeSet.filter((member) => changed.has(member)),
      [],
      [],
    );
  }
  for (const identity of ancestorItems) {
    const branches = (childrenOf.get(identity) ?? []).filter(
      (child) => visitedSet.has(child) || ancestorItems.has(child),
    );
    add(
      "parent-consistency",
      identity,
      !deleted.has(identity),
      [identity],
      branches,
      descendantsOf(identity).filter((member) => changed.has(member)),
      [],
      branches.map((child) =>
        pathBlocksItemKey(
          visitedSet.has(child) ? "subtree-coherence" : "parent-consistency",
          child,
        ),
      ),
    );
  }
  for (const identity of metadataChanged) {
    add(
      "metadata-consistency",
      identity,
      true,
      [identity],
      addedAndRemovedD(identity),
      [identity],
      [],
      [],
    );
  }
  for (const [identity, node] of after) {
    const targets = node.edgeTargets.filter(
      (target) => kept.has(target) && diff.effectiveChanged.has(target),
    );
    if (targets.length === 0) continue;
    const { required, optional } = attributionOf(targets);
    add(
      "dependency-consistency",
      identity,
      true,
      [identity],
      targets,
      required,
      optional,
      [],
    );
  }
  for (const [label, code, side] of [
    ["baseline", codeBefore, before],
    ["current", codeAfter, after],
  ] as const) {
    for (const [location, targets] of code) {
      for (const target of targets) {
        if (!side.has(target)) {
          misuse(
            `the ${label} code location ${location}'s impact edge targets ` +
              `${target}, which has no ${label} node`,
          );
        }
      }
    }
  }
  const absent = new Set<string>(deleted);
  for (const location of sortedBytes([
    ...codeBefore.keys(),
    ...codeAfter.keys(),
  ])) {
    const present = codeAfter.has(location);
    if (!present) absent.add(location);
    const targets = sortedBytes([
      ...(codeBefore.get(location) ?? []),
      ...(codeAfter.get(location) ?? []),
    ]).filter(
      (target) =>
        added.has(target) ||
        deleted.has(target) ||
        diff.subtreeChanged.has(target) ||
        diff.effectiveChanged.has(target),
    );
    if (targets.length === 0) continue;
    const { required, optional } = attributionOf(targets);
    add(
      "code-impact",
      location,
      present,
      [location],
      targets,
      required,
      optional,
      [],
    );
  }

  // --- Order (10.5).
  const documentPosition = new Map<string, number>();
  for (const identity of after.keys()) {
    if (!isRoot(identity)) continue;
    let position = 0;
    const stack = [identity];
    while (stack.length > 0) {
      const next = stack.pop() as string;
      documentPosition.set(next, position++);
      const children = afterAt(next).children;
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
  }
  const positionOf = (identity: string): number => {
    const position = documentPosition.get(identity);
    if (position === undefined) {
      misuse(`the present node ${identity} has no document position`);
    }
    return position;
  };
  const compareItems = (x: PathBlocksItem, y: PathBlocksItem): number => {
    const xCode = x.kind === "code-impact";
    const yCode = y.kind === "code-impact";
    if (xCode !== yCode) return xCode ? 1 : -1;
    if (xCode) return compareBytes(x.scope, y.scope);
    const depth = depthOf(y.scope) - depthOf(x.scope);
    if (depth !== 0) return depth;
    const kind = KIND_RANK[x.kind] - KIND_RANK[y.kind];
    if (kind !== 0) return kind;
    const file = compareBytes(fileOf(x.scope), fileOf(y.scope));
    if (file !== 0) return file;
    if (x.scopePresent !== y.scopePresent) return x.scopePresent ? -1 : 1;
    if (x.scopePresent) return positionOf(x.scope) - positionOf(y.scope);
    return compareBytes(x.scope, y.scope);
  };
  items.sort(compareItems);
  for (let i = 1; i < items.length; i++) {
    if (compareItems(items[i - 1], items[i]) === 0) {
      misuse(
        `the item order cannot tell ${items[i - 1].kind} ${items[i - 1].scope} ` +
          `from ${items[i].kind} ${items[i].scope}`,
      );
    }
  }
  return { items, absent, diff };
}

/**
 * A node's own input contract (module header): its `d` targets a duplicate-
 * free subset of its `edgeTargets`, and every dependency-edge target a node
 * on its side.
 */
function guardNode(
  identity: string,
  node: PathBlocksNode,
  label: string,
  side: PathBlocksSide,
): void {
  const targets = new Set(node.edgeTargets);
  const seen = new Set<string>();
  for (const target of node.dTargets) {
    if (seen.has(target)) {
      misuse(
        `the ${label} node ${identity} lists the d target ${target} twice — ` +
          `dTargets is its d-target set (SPEC 2.2, 5.2)`,
      );
    }
    seen.add(target);
    if (!targets.has(target)) {
      misuse(
        `the ${label} node ${identity}'s d target ${target} is not among ` +
          `its edgeTargets — each is a depends edge's target (SPEC 5.2)`,
      );
    }
  }
  for (const target of node.edgeTargets) {
    if (!side.has(target)) {
      misuse(
        `the ${label} node ${identity}'s dependency edge targets ${target}, ` +
          `which has no ${label} node`,
      );
    }
  }
}
