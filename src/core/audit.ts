// The built-in `audit` review strategy (SPEC 10.6).
//
// Pure core (IMPLEMENTATION Architecture: review-session logic is core —
// deterministic, I/O-free): over the current workspace graph alone, this
// module generates the items of an `audit` session — one `subtree-coherence`
// item per requirement node, root nodes included, with the node's ancestor
// chain as context, an empty origin, and scope as in 10.5: the node and all
// its current descendants (the scope root is the node; the nodes beneath it
// ride along as `scopeDescendants`, which an item stores as its scope as
// last assigned, SPEC 10.4). Audit requires no baseline and reviews the
// entire workspace, so its generators take no creation parameters (SPEC
// 10.7: an audit session records none) and every generated node enters
// with no baseline identity — an audit item's `baseline` is the current
// graph's values at the moment it enters the session (SPEC 10.2).
//
// Blocking, not order, enforces bottom-up review (SPEC 10.6): each item's
// `blockedBy` is the set of its child sections' items — after a `split`, the
// items of their decompositions, which the decomposition replay's reference
// rewrite realizes (src/core/review-derive.ts `expandDecompositions`) — so
// leaf items are unblocked and subtrees are confirmed bottom-up. Audit's
// item order — scope-node file path first (byte order), then document order
// within the file — is `sortItemsByFileThenDocument` (review-derive.ts).
//
// The generation is consumed exactly like the `path-blocks` one
// (src/core/path-blocks.ts): `create` and the resolve-time re-derivation of
// SPEC 10.5 — which holds for every strategy — replay the recorded
// decompositions over it and merge it into the session, and reads match it
// to items for the current context sets of SPEC 10.4. Because audit
// generates one item per current requirement node, a decomposition's
// per-child items coincide with the main generation's (one builder produces
// both), and the merge's dedup keeps a single item per kind and scope node
// (SPEC 10.1, 10.5).

import type { WorkspaceGraph } from "./graph.js";
import type {
  DecompositionContentSource,
  GeneratedBlockerRef,
  GeneratedItem,
  GeneratedNode,
} from "./review-derive.js";
import {
  currentAncestorChain,
  currentChildren,
  currentDescendants,
} from "./review-derive.js";

/** The output of one audit generator run (SPEC 10.6). */
export interface AuditGeneration {
  /** The generated items, before decomposition replay
   * (review-derive.ts `expandDecompositions`), in graph node order —
   * file path bytes, then document order (SPEC 12.0). */
  readonly items: readonly GeneratedItem[];
  /** The strategy's decomposition content (SPEC 10.7), for
   * `expandDecompositions`. */
  readonly contentSource: DecompositionContentSource;
}

/**
 * Run the `audit` generators (module header) over the current workspace
 * graph: one `subtree-coherence` item per requirement node, root nodes
 * included (SPEC 10.6), in graph node order.
 */
export function generateAuditItems(graph: WorkspaceGraph): AuditGeneration {
  const builder = new AuditItemBuilder(graph);
  return {
    items: graph.requirementNodes.map((node) =>
      builder.subtreeCoherenceItem(node.identity),
    ),
    contentSource: builder.contentSource(),
  };
}

class AuditItemBuilder {
  constructor(private readonly graph: WorkspaceGraph) {}

  /** SPEC 10.6: the child sections' items — the blocker set of the node's
   * item; empty for a leaf (so leaf items are unblocked) and for an absent
   * node (no current children). */
  private childBlockers(identity: string): GeneratedBlockerRef[] {
    const node = this.graph.requirementNode(identity);
    if (node === undefined) return [];
    return this.graph.childrenOf(node).map((child) => ({
      kind: "subtree-coherence" as const,
      scope: child.identity,
    }));
  }

  /**
   * The node's `subtree-coherence` item (SPEC 10.6): context the ancestor
   * chain, origin empty, scope the node and all its current descendants
   * (the scope root is the node, the nodes beneath it in document order
   * its `scopeDescendants`), `blockedBy` its child sections' items. One
   * builder serves the main generation and the decomposition replay's
   * per-child items ("its context the child's ancestor chain, as in 10.5
   * and 10.6", SPEC 10.7), so the two always coincide. `scopeResolves` is
   * the content source's resolution argument (DecompositionContentSource
   * doc): a stored scope that no longer canonically resolves (SPEC 10.4)
   * takes in no descendants, so a dangling scope never takes in the
   * subtree of the distinct node that recaptured its spelling — as its
   * children (`scopeChildren`) are none.
   */
  subtreeCoherenceItem(identity: string, scopeResolves = true): GeneratedItem {
    return {
      kind: "subtree-coherence",
      scope: { identity, baselineIdentity: null, deleted: false },
      scopeDescendants: scopeResolves
        ? currentDescendants(this.graph, identity)
        : [],
      context: currentAncestorChain(this.graph, identity),
      // SPEC 10.6: an empty origin.
      origin: [],
      reason:
        `audit the subtree rooted at ${identity}: review the node and all ` +
        `its descendants as a single block (SPEC 10.6)`,
      blockedBy: this.childBlockers(identity),
    };
  }

  contentSource(): DecompositionContentSource {
    return {
      // SPEC 10.7: in an audit session a scope root's children are its
      // current ones alone (10.6: the node and all its current
      // descendants), each a current-graph node; a stored scope that no
      // longer canonically resolves (SPEC 10.4) has none, so a dangling
      // scope never enumerates the children of the distinct node that
      // recaptured its spelling.
      scopeChildren: (scopeIdentity, scopeResolves = true): GeneratedNode[] =>
        scopeResolves ? currentChildren(this.graph, scopeIdentity) : [],
      subtreeCoherenceItem: (scopeIdentity, scopeResolves): GeneratedItem =>
        this.subtreeCoherenceItem(scopeIdentity, scopeResolves),
      // SPEC 10.7: the decomposed scope root's `parent-consistency` item —
      // for its own text, context the child subtrees, blocked by the child
      // items; each decomposition item's origin "is empty in an `audit`
      // session".
      splitParentConsistencyItem: (scopeIdentity, children): GeneratedItem => ({
        kind: "parent-consistency",
        scope: {
          identity: scopeIdentity,
          baselineIdentity: null,
          deleted: false,
        },
        context: [...children],
        origin: [],
        reason:
          `review the own text of ${scopeIdentity} against its child ` +
          `subtrees — split from its subtree review (SPEC 10.7)`,
        blockedBy: children.map((child) => ({
          kind: "subtree-coherence" as const,
          scope: child.identity,
        })),
      }),
    };
  }
}
