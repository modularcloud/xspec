// In-harness baseline graph-diff oracle (TEST-SPEC 16 P-6, 17 S-6): an
// independent implementation of SPEC.md 5.6's change categories over two
// workspace graphs — a baseline graph whose identities the caller has
// already mapped forward through the journal suffix into current identities
// (SPEC 6.3; P-6 composes the per-operation mappings it requested) and the
// current graph. Per S-6, the oracle passes its fixed vector suite
// (test/self/s6-graph-diff-oracle.test.ts) — derived from SPEC.md 5.6's
// three worked examples plus the added/deleted convention of T5.6-6 —
// before any property test trusts it. Harness machinery only: pure
// functions, no product imports, no I/O, no test-framework dependence.
//
// The oracle hashes nothing: each side supplies, per node, opaque
// comparable keys standing in for the SPEC 5.5 hash preimages — equal keys
// exactly when the preimage is unchanged — plus the structure the cascades
// walk (children in document order, dependency-edge targets). SPEC 5.6 as
// implemented here, per node:
//
// * `changed`: the node was added or deleted, or its own-content key
//   (`ownKey` — the 1.6 sequence: runs plus one reference token per child
//   construct and per embedding, references as canonical identities)
//   differs; adding, removing, or reordering children changes the parent's
//   key, since identities enter the sequence at their positions (5.5:
//   structural edits originate at the parent).
// * `metadata-changed`: the node's metadata key (`metaKey`: `d`-target set,
//   coverage, tags — the metadataHash preimage, 5.5) differs.
// * `descendant-changed`: a changed node lies among the node's strict
//   descendants on either side — an own-changed, added, or deleted
//   descendant (5.6's worked examples pin the ancestors of added and of
//   deleted children to exactly this category).
// * `upstream-changed`: the node's effective state changed through a
//   dependency-edge cause — a both-sides dependency-edge target (of the
//   node, or of a both-sides subtree node) whose effective state changed,
//   or a strict-subtree node other than the node itself whose
//   dependency-edge pair multiset (`pairKey`, one entry per edge, `depends`
//   and `embeds` alike, 5.5/5.2) changed. Effective state is the 5.5
//   effectiveHash recursion evaluated as a fixpoint over both-sides nodes:
//   own content changed, own pair multiset changed, a both-sides child
//   changed effectively, or a both-sides dependency-edge target changed
//   effectively (added and removed children and edges surface through
//   `ownKey`/`pairKey`).
// * An added or deleted node receives no category through its own hashes —
//   exactly `changed`, whatever metadata, children, or dependency edges it
//   carries (5.6: baseline hash comparison is defined only for a node
//   present on both sides; T5.6-6). Deleted nodes are keyed by their
//   baseline (journal-mapped) identities and flagged in `deleted`.
//
// The two-sided tolerance (the ambiguity T6.2-3 documents, met here by
// relocations and by edge-bearing added or deleted subtree members): where
// a node's effective state changed but every dependency-edge cause traces
// only through one-side-only subtree members — a relocated (kept,
// one-side-only) member with a cause, or an added or deleted member
// carrying dependency edges, its edges arriving or departing with the node
// — `upstream-changed` is predicted tolerated-optional (`optionalUpstream`,
// accepted present or absent), while any both-sides cause makes it
// required. No SPEC.md worked material pins those one-sided readings, and
// P-6's generator keeps them out of its input space (its module header).
//
// Misuse guards (H-8) — each throws a plain error, a harness defect, never
// a diagnosed product failure: a relocated originator (a kept `changed` or
// `metadata-changed` node whose kept strict-ancestor sets differ across
// sides) would make `descendant-changed` two-sidedly ambiguous on its
// holders and is outside the oracle's default input space (P-6's: its
// generator never lets an originator relocate); so are incomplete graphs
// (a child or walked dependency-edge target with no node on its side),
// contains or dependency cycles (5.3), and an `ownKey` that fails to cover
// the child reference tokens.
//
// The relocation tolerance (opt-in, `relocatedOriginators: "tolerate"`):
// the path-blocks oracle (helpers/oracles/path-blocks.ts, P-16) admits
// relocated originators — P-16 draws section moves into another parent
// beside edits, and T10.5-9's present-node arm moves `P1.M` under `P2` and
// then deletes its child, leaving the moved node `changed` — so under this
// option the guard stands down and `descendant-changed` is predicted by
// which changed strict descendants a kept node holds unambiguously: a kept
// one held on both sides, and an added (deleted) one hanging, through
// added (deleted) nodes alone, below the node itself or below a kept node
// it holds on both sides — its nearest kept current-side (baseline-side)
// ancestor. Holding one such is `descendant-changed` required; holding
// changed strict descendants only otherwise — one side's holder of a
// relocated changed node, or of what hangs below one — is the same
// two-sided ambiguity, predicted tolerated-optional (`optionalDescendant`,
// accepted present or absent). Under the default every changed strict
// descendant a node holds on either side is held unambiguously (a
// relocation reaching one would relocate an originator: a changed kept
// node, or the kept parent an added or deleted child changes), so the
// option alters nothing the guard admits: `optionalDescendant` is then
// always empty and every category as before.
//
// Hash facts beside the categories: `subtreeChanged` and `effectiveChanged`
// are the kept nodes whose subtreeHash, respectively effectiveHash, changed
// — the 5.5 recursions over both-sides structure (own content changed, or a
// both-sides child changed, and for effectiveHash also the pair multiset
// changed or a both-sides dependency-edge target changed effectively). They
// are what SPEC 9.2's impacted-code evaluation and 10.5's
// `dependency-consistency` rule read (the path-blocks oracle); an added or
// deleted node is in neither, 9.2's counting of it as changed in both
// hashes being that consumer's to apply (5.6 compares hashes only on both
// sides).
//
// Its evaluation, `computeGraphDiff`, is a harness step under its own guard
// (TEST-SPEC S-3, helpers/step-guards.ts): synchronous, bounded by
// construction over the staged input it evaluates, and measured.

import { guardSyncStep } from "../step-guards.js";

// ---------------------------------------------------------------------------
// Input and output model

/** One node of one side's graph, in the diff's shared identity space. */
export interface GraphDiffNode {
  /** Direct child identities in document order. */
  readonly children: readonly string[];
  /**
   * Opaque key of the node's own content sequence (SPEC 1.6) — the ownHash
   * preimage (5.5): equal keys iff the runs and the child and embedding
   * reference tokens, at their positions, are unchanged. It MUST therefore
   * cover the `children` list (guarded) and the embedding references.
   */
  readonly ownKey: string;
  /**
   * Opaque key of (`d`-target set, coverage, tags) — the metadataHash
   * preimage (SPEC 5.5).
   */
  readonly metaKey: string;
  /**
   * Opaque key of the node's dependency-edge identity-pair multiset — one
   * entry per edge, `depends` and `embeds` alike (SPEC 5.5, 5.2).
   */
  readonly pairKey: string;
  /** Deduplicated dependency-edge target identities (the closure walk). */
  readonly edgeTargets: readonly string[];
}

/** One side of the diff: every node of that graph, keyed by identity. */
export type GraphDiffSide = ReadonlyMap<string, GraphDiffNode>;

/** SPEC 5.6's category vocabulary. */
export type GraphDiffCategory =
  "changed" | "metadata-changed" | "descendant-changed" | "upstream-changed";

/** The oracle's prediction (module header). */
export interface GraphDiff {
  /**
   * Exact required category set per node: kept and added nodes under
   * current identities, deleted nodes under their baseline identities.
   */
  readonly required: ReadonlyMap<string, ReadonlySet<GraphDiffCategory>>;
  /**
   * Nodes that may additionally carry `upstream-changed` — the documented
   * one-sided-cause tolerance (module header), accepted present or absent.
   */
  readonly optionalUpstream: ReadonlySet<string>;
  /**
   * Nodes that may additionally carry `descendant-changed` — the relocation
   * tolerance (module header), accepted present or absent; always empty
   * unless `relocatedOriginators` is `"tolerate"`.
   */
  readonly optionalDescendant: ReadonlySet<string>;
  /**
   * Kept nodes whose subtreeHash changed (SPEC 5.5's recursion over
   * both-sides structure; module header). Added and deleted nodes are in
   * neither this set nor `effectiveChanged`.
   */
  readonly subtreeChanged: ReadonlySet<string>;
  /**
   * Kept nodes whose effectiveHash changed (SPEC 5.5's recursion,
   * evaluated as a fixpoint; module header). Every member of
   * `subtreeChanged` is one.
   */
  readonly effectiveChanged: ReadonlySet<string>;
  /**
   * Attribution bound: every originating node — those carrying `changed`
   * (added and deleted included) or `metadata-changed` (SPEC 5.6: every
   * category MUST be attributed to its originating nodes).
   */
  readonly originators: ReadonlySet<string>;
  /** Nodes present on the current side only (each required `changed`). */
  readonly added: ReadonlySet<string>;
  /** Nodes present on the baseline side only (each required `changed`). */
  readonly deleted: ReadonlySet<string>;
}

/** How {@link computeGraphDiff} meets its input (module header). */
export interface GraphDiffOptions {
  /**
   * A relocated originating node: `"refuse"` (the default; P-6's input
   * space) throws the misuse error; `"tolerate"` admits it, predicting
   * `descendant-changed` on its one-sided holders as tolerated-optional
   * (`optionalDescendant`).
   */
  readonly relocatedOriginators?: "refuse" | "tolerate";
}

function misuse(message: string): never {
  throw new Error(`graph-diff oracle misuse: ${message}`);
}

/** Memoized strict-descendant sets over one side's `children` lists. */
function strictDescendants(
  side: GraphDiffSide,
  label: string,
): Map<string, Set<string>> {
  const memo = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  const resolve = (identity: string): Set<string> => {
    const cached = memo.get(identity);
    if (cached !== undefined) return cached;
    if (visiting.has(identity)) {
      misuse(
        `contains-cycle through ${identity} in the ${label} graph — ` +
          `workspace graphs are acyclic (SPEC 5.3)`,
      );
    }
    visiting.add(identity);
    const node = side.get(identity);
    if (node === undefined) {
      misuse(
        `no ${label} node for ${identity} — every child identity must have ` +
          `a node on its side`,
      );
    }
    const descendants = new Set<string>();
    for (const child of node.children) {
      descendants.add(child);
      for (const inner of resolve(child)) descendants.add(inner);
    }
    visiting.delete(identity);
    memo.set(identity, descendants);
    return descendants;
  };
  for (const identity of side.keys()) resolve(identity);
  return memo;
}

/**
 * Diff two workspace graphs per SPEC 5.6 (module header): the baseline side
 * already mapped into current identities (SPEC 6.3), the current side as it
 * stands. Returns the exact required category set per node, the
 * tolerated-optional `upstream-changed` and `descendant-changed` sets, the
 * originating-node attribution bound, the added and deleted identity sets,
 * and the kept nodes whose subtreeHash and effectiveHash changed.
 */
export function computeGraphDiff(
  before: GraphDiffSide,
  after: GraphDiffSide,
  options: GraphDiffOptions = {},
): GraphDiff {
  return guardSyncStep("the graph-diff oracle (computeGraphDiff)", () =>
    computeGraphDiffUnguarded(before, after, options),
  );
}

/** {@link computeGraphDiff}'s evaluation, under its guard. */
function computeGraphDiffUnguarded(
  before: GraphDiffSide,
  after: GraphDiffSide,
  options: GraphDiffOptions,
): GraphDiff {
  const relocation = options.relocatedOriginators ?? "refuse";
  if (relocation !== "refuse" && relocation !== "tolerate") {
    misuse(
      `relocatedOriginators must be "refuse" or "tolerate", got ` +
        JSON.stringify(relocation),
    );
  }
  const kept = [...before.keys()].filter((identity) => after.has(identity));
  const added = [...after.keys()].filter((identity) => !before.has(identity));
  const deleted = [...before.keys()].filter((identity) => !after.has(identity));
  const beforeAt = (identity: string): GraphDiffNode => {
    const node = before.get(identity);
    if (node === undefined) misuse(`no baseline node for ${identity}`);
    return node;
  };
  const afterAt = (identity: string): GraphDiffNode => {
    const node = after.get(identity);
    if (node === undefined) misuse(`no current node for ${identity}`);
    return node;
  };

  const keptSet = new Set(kept);
  const ownChanged = new Set(
    kept.filter((id) => beforeAt(id).ownKey !== afterAt(id).ownKey),
  );
  const metaChanged = new Set(
    kept.filter((id) => beforeAt(id).metaKey !== afterAt(id).metaKey),
  );
  const pairChanged = new Set(
    kept.filter((id) => beforeAt(id).pairKey !== afterAt(id).pairKey),
  );
  const changedSet = new Set([...ownChanged, ...added, ...deleted]);
  const originators = new Set([...changedSet, ...metaChanged]);

  // Input-contract guard: ownKey covers the child reference tokens (SPEC
  // 1.6, 5.5 — identities enter the own-content sequence at their
  // positions, so a differing child list forces a differing key).
  for (const id of kept) {
    if (
      !ownChanged.has(id) &&
      JSON.stringify(beforeAt(id).children) !==
        JSON.stringify(afterAt(id).children)
    ) {
      misuse(
        `the children of ${id} differ across sides while its ownKey ` +
          `compares equal — ownKey must cover the child reference tokens ` +
          `at their positions (SPEC 1.6, 5.5)`,
      );
    }
  }

  const descBefore = strictDescendants(before, "baseline");
  const descAfter = strictDescendants(after, "current");
  const descAt = (
    memo: Map<string, Set<string>>,
    identity: string,
  ): Set<string> => memo.get(identity) ?? new Set<string>();

  // Misuse guard (module header): an originator never relocates — its
  // kept strict-ancestor relation is two-sided — so `descendant-changed`
  // is never ambiguous. Added and deleted nodes are one-sided by nature
  // (the 5.6 worked examples pin their ancestors' category). Under the
  // relocation tolerance the guard stands down and the ambiguity is
  // predicted tolerated-optional instead (`optionalDescendant`, below).
  for (const id of kept) {
    if (relocation === "tolerate") break;
    if (!ownChanged.has(id) && !metaChanged.has(id)) continue;
    const beforeHolders = kept.filter((a) => descAt(descBefore, a).has(id));
    const afterHolders = kept.filter((a) => descAt(descAfter, a).has(id));
    if (
      JSON.stringify(beforeHolders.sort()) !==
      JSON.stringify(afterHolders.sort())
    ) {
      misuse(
        `originating node ${id} relocated between baseline and current — ` +
          `descendant-changed would be two-sidedly ambiguous on its ` +
          `holders (the T6.2-3 ambiguity); the caller must keep changed ` +
          `and metadata-changed nodes in place`,
      );
    }
  }

  // effChanged fixpoint over kept nodes: own content changed, own pair
  // multiset changed, a both-sides child changed effectively, or a
  // both-sides dependency-edge target changed effectively (SPEC 5.5; added
  // or removed children and edges surface through ownKey/pairKey).
  const effMemo = new Map<string, boolean>();
  const effVisiting = new Set<string>();
  const commonOf = (
    beforeList: readonly string[],
    afterList: readonly string[],
  ): string[] =>
    beforeList.filter((id) => keptSet.has(id) && afterList.includes(id));
  const effChanged = (id: string): boolean => {
    const cached = effMemo.get(id);
    if (cached !== undefined) return cached;
    if (effVisiting.has(id)) {
      misuse(
        `dependency/contains cycle through ${id} — workspace graphs are ` +
          `acyclic (SPEC 5.3)`,
      );
    }
    effVisiting.add(id);
    const result =
      ownChanged.has(id) ||
      pairChanged.has(id) ||
      commonOf(beforeAt(id).children, afterAt(id).children).some(effChanged) ||
      commonOf(beforeAt(id).edgeTargets, afterAt(id).edgeTargets).some(
        effChanged,
      );
    effVisiting.delete(id);
    effMemo.set(id, result);
    return result;
  };

  // subChanged over kept nodes: own content changed or a both-sides child's
  // subtreeHash changed (SPEC 5.5; a differing child list surfaces through
  // ownKey, guarded above). Contains cycles were refused by
  // strictDescendants, so the recursion terminates.
  const subMemo = new Map<string, boolean>();
  const subChanged = (id: string): boolean => {
    const cached = subMemo.get(id);
    if (cached !== undefined) return cached;
    const result =
      ownChanged.has(id) ||
      commonOf(beforeAt(id).children, afterAt(id).children).some(subChanged);
    subMemo.set(id, result);
    return result;
  };

  // The relocation tolerance's holding rule (module header): which changed
  // strict descendants a kept node holds unambiguously — a kept one on both
  // sides; an added (deleted) one below its nearest kept current-side
  // (baseline-side) ancestor, that ancestor the node itself or a kept node
  // it holds on both sides.
  const addedSet = new Set(added);
  const parentsOf = (side: GraphDiffSide): Map<string, string> => {
    const parents = new Map<string, string>();
    for (const [identity, node] of side) {
      for (const child of node.children) parents.set(child, identity);
    }
    return parents;
  };
  const parentBefore = parentsOf(before);
  const parentAfter = parentsOf(after);
  const nearestKeptAncestor = (
    identity: string,
    parents: ReadonlyMap<string, string>,
  ): string | undefined => {
    let current = parents.get(identity);
    while (current !== undefined && !keptSet.has(current)) {
      current = parents.get(current);
    }
    return current;
  };
  const holdsUnambiguously = (holder: string, held: string): boolean => {
    const beforeDesc = descAt(descBefore, holder);
    const afterDesc = descAt(descAfter, holder);
    const heldOnBoth = (k: string): boolean =>
      k === holder || (beforeDesc.has(k) && afterDesc.has(k));
    if (keptSet.has(held)) return beforeDesc.has(held) && afterDesc.has(held);
    const [desc, parents] = addedSet.has(held)
      ? [afterDesc, parentAfter]
      : [beforeDesc, parentBefore];
    const anchor = nearestKeptAncestor(held, parents);
    return desc.has(held) && anchor !== undefined && heldOnBoth(anchor);
  };

  // A node's dependency-edge cause (SPEC 5.6 upstream-changed): a common
  // dependency-edge target of the node itself or of a subtree node whose
  // effective state changed, or a strict-subtree node (not the node itself)
  // whose pair multiset changed. Both-sides subtree members give the
  // required cause; one-side-only members give the optional tolerance
  // (module header).
  const targetCause = (id: string): boolean =>
    commonOf(beforeAt(id).edgeTargets, afterAt(id).edgeTargets).some(
      effChanged,
    );
  const memberCause = (member: string): boolean =>
    pairChanged.has(member) || targetCause(member);

  const required = new Map<string, Set<GraphDiffCategory>>();
  const optionalUpstream = new Set<string>();
  const optionalDescendant = new Set<string>();
  for (const id of kept) {
    const categories = new Set<GraphDiffCategory>();
    if (ownChanged.has(id)) categories.add("changed");
    if (metaChanged.has(id)) categories.add("metadata-changed");
    const beforeDesc = descAt(descBefore, id);
    const afterDesc = descAt(descAfter, id);
    const eitherDesc = new Set([...beforeDesc, ...afterDesc]);
    // A changed strict descendant on either side; required where one is
    // held unambiguously — under the default guard, every one is (module
    // header) — else tolerated-optional (the relocation tolerance).
    const changedDesc = [...eitherDesc].filter((d) => changedSet.has(d));
    if (changedDesc.some((d) => holdsUnambiguously(id, d))) {
      categories.add("descendant-changed");
    } else if (changedDesc.length > 0) {
      optionalDescendant.add(id);
    }
    if (effChanged(id)) {
      const bothMembers = [...beforeDesc].filter(
        (d) => keptSet.has(d) && afterDesc.has(d),
      );
      if (targetCause(id) || bothMembers.some(memberCause)) {
        categories.add("upstream-changed");
      } else {
        // Only a one-side-only subtree member's dependency cause remains:
        // a relocated kept member with a cause, or an added or deleted
        // member whose dependency edges arrived or departed with it —
        // tolerable but not required (module header).
        const oneSidedCause = [...eitherDesc].some((d) => {
          if (keptSet.has(d)) {
            return !(beforeDesc.has(d) && afterDesc.has(d)) && memberCause(d);
          }
          return afterDesc.has(d)
            ? afterAt(d).edgeTargets.length > 0
            : beforeAt(d).edgeTargets.length > 0;
        });
        if (oneSidedCause) optionalUpstream.add(id);
      }
    }
    required.set(id, categories);
  }
  for (const id of added) {
    // An added node is `changed` and receives no category through its own
    // hashes (SPEC 5.6, T5.6-6).
    required.set(id, new Set<GraphDiffCategory>(["changed"]));
  }
  for (const id of deleted) {
    // A deleted node reports as deleted, under its baseline identity, and
    // `changed` only (SPEC 5.6, T5.6-6).
    required.set(id, new Set<GraphDiffCategory>(["changed"]));
  }
  return {
    required,
    optionalUpstream,
    optionalDescendant,
    originators,
    added: addedSet,
    deleted: new Set(deleted),
    subtreeChanged: new Set(kept.filter(subChanged)),
    effectiveChanged: new Set(kept.filter(effChanged)),
  };
}
