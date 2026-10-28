// Review-session derivation machinery (SPEC 10.5, 10.7).
//
// Pure core (IMPLEMENTATION Architecture: review-session logic is core —
// deterministic, I/O-free): the strategy-generic half of item derivation.
// A strategy generator (src/core/path-blocks.ts for SPEC 10.5; audit and
// coverage per SPEC 10.6/10.7) produces `GeneratedItem` values — the 10.2
// content of each item plus the per-side node identities the state and
// text computations need. This module then:
//
// - replays the session's recorded `split` decompositions over the
//   generated items (SPEC 10.5: a generated item whose kind and scope node
//   are recorded as decomposed is never added back — its decomposition
//   applies instead, recursively, over the children the strategy's node
//   relation gives the scope node: in a baseline session SPEC 10.5's
//   links, deleted children included), rewriting every blocker reference
//   to a decomposed item into all items of its decomposition;
// - merges the expanded generation into a session's existing items under
//   the re-derivation rules of SPEC 10.5 (`deriveSessionItems`) — the same
//   computation serves `create` (merge into an empty session), the
//   re-derivation an `updated` resolve triggers, and the one every `split`
//   ends with (`rederiveSession`: replay, then merge);
// - computes each item's recorded `baseline` and `current` states
//   (SPEC 10.2, 10.4), its recorded context set (written with `current`,
//   SPEC 10.4), and its text snapshots (SPEC 10.7): `current` via
//   review-state.ts's `computeRecordedState` against the graph the
//   derivation runs over — so read-time invalidation, judging each
//   recorded node against that graph, never finds a freshly derived item
//   invalidated — and `baseline` against the recorded-baseline graph,
//   resolving nodes through their per-side identities so an identity
//   reintroduced by a distinct node (SPEC 5.4) never leaks the wrong
//   side's values;
// - realizes the `split` decomposition (SPEC 10.7,
//   `splitItemDecomposition`), recorded and then governing the
//   re-derivation with which `split` ends (SPEC 10.5, 10.7), and
//   `resolve`'s status, context, and state
//   update — the item assigned its current context set and its state
//   recorded over it (SPEC 10.4), its nodes' texts snapshotted in the
//   graph it records against (SPEC 10.7: the states under which mutating
//   subcommands derived or resolved the item; every snapshot holds, per
//   node, only the text kinds the node's roles present, `textRoles`) —
//   with its `updated`-triggered re-derivation (SPEC 10.5,
//   `resolveSessionItem`), which an `updated` resolve runs first,
//   assigning and recording once it is done, against the item as
//   re-derived (SPEC 10.4);
// - derives the generator-assigned current context sets reads feed to
//   read-time invalidation and present as each item's `context`
//   (SPEC 10.4, `currentContextSets`);
// - orders items per the total order of SPEC 10.5 (`sortItemsPathBlocks`)
//   and per the file-path-then-document order of SPEC 10.6 audit sessions
//   and SPEC 10.7 coverage sessions (`sortItemsByFileThenDocument`), with
//   the shared present-before-absent document-order tie machinery
//   ("wherever an item order ranks by document order — here, in 10.6, and
//   in 10.7", SPEC 10.5).
//
// Identity policy (src/core/review.ts header): the strategy generators
// work in spelling space — a `GeneratedNode.identity` as produced is the
// node's current-graph spelling (a deleted node's baseline identity mapped
// forward through the replay journal, SPEC 6.3) plus its identity in the
// baseline graph (null when absent there) and the generator-known
// sidedness (`deleted`). `canonicalizeGeneration` is the central seam that
// rewrites one generator run into canonical-reference space (SPEC 5.4),
// branching on that recorded sidedness: a current-side node canonicalizes
// against the full current journal, while a deleted node — the generating
// record baseline-side-only — canonicalizes as of the baseline journal
// prefix from its baseline identity. Which branch applies is the
// generator's knowledge of the record's side, never graph occupancy of the
// spelling: a spelling vacated by a manual deletion (SPEC 6.6) and
// recaptured by a journaled rename or move is borne by a distinct current
// chain (SPEC 5.4), so canonicalizing the deleted node's forward-mapped
// spelling against the full journal — or consulting who occupies it —
// would misattribute the deleted node to the recapturing chain. Everything
// downstream of the seam — matching, decomposition replay, `split`, state
// and text keys — is byte-wise over (kind, canonical scope reference),
// which IS the canonical comparison SPEC 10.4 requires; spellings are
// derived (`spellingOfReference`) only for graph lookups, item ordering,
// and generator content.

import { compareBytes } from "./bytes.js";
import type { WorkspaceGraph } from "./graph.js";
import type { NodeHashes } from "./hashes.js";
import type { Journal } from "./journal.js";
import { canonicalAt, encodeCanonicalIdentity } from "./journal.js";
import type {
  ItemKind,
  RecordedDecomposition,
  RecordedHashName,
  RecordedNodeState,
  RecordedState,
  RecordedTexts,
  RecordedTextTable,
  ResolveStatus,
  ReviewItem,
  ReviewSession,
  TextKind,
} from "./review.js";
import {
  ItemIdAllocator,
  contextTextKind,
  kindScopesCodeLocation,
  scopeTextKind,
} from "./review.js";
import type { ReferenceResolution, ReviewStateInputs } from "./review-state.js";
import {
  canonicalKeyOfCurrent,
  computeRecordedState,
  resolveReference,
  resolveReferenceAt,
  spellingOfReference,
} from "./review-state.js";
import type { WorkspaceTextModel } from "./text-model.js";

// ---------------------------------------------------------------------------
// The generated-item model (the strategy → derivation seam)
// ---------------------------------------------------------------------------

/**
 * One node of a generated item, with the identities the derivation needs.
 * As a generator produces it, `identity` is the node's current-space
 * spelling (module header); after `canonicalizeGeneration` — which every
 * derivation consumer runs behind — it is the node's stored canonical
 * reference (SPEC 5.4). `baselineIdentity` is the node's identity in the
 * recorded-baseline graph — null when the node is absent there (added
 * since the baseline, or a session without a baseline) — and is never
 * rewritten: baseline-graph lookups resolve through it.
 */
export interface GeneratedNode {
  readonly identity: string;
  readonly baselineIdentity: string | null;
  /**
   * Generator-known sidedness (SPEC 5.4, 10.4): true exactly when the
   * generating record is baseline-side-only — the node exists only in the
   * recorded baseline (`NodeChange.currentIdentity === null`), its
   * `identity` being the baseline identity mapped forward through the
   * replay journal. Sidedness is the generator's knowledge of which side
   * the node came from, never derived from graph occupancy of `identity`:
   * a spelling vacated by a manual deletion (SPEC 6.6) and recaptured by
   * a journaled rename or move is borne by a distinct current node
   * (SPEC 5.4), so occupancy would misattribute the deleted node.
   * Required — every construction site states it explicitly.
   */
  readonly deleted: boolean;
}

/** A blocker reference by kind and scope node — resolved to an item id
 * once the merge fixes ids (SPEC 10.5: `blockedBy` is recomputed for every
 * generated or decomposition-produced item). */
export interface GeneratedBlockerRef {
  readonly kind: ItemKind;
  readonly scope: string;
  /**
   * The reference's scope node as the emitting generator knows it — set by
   * generator-space emitters that build the reference from a change record
   * (path-blocks' `parent-consistency` blockers, and its decomposition
   * content source's child references, a deleted child among them), so
   * the reference canonicalizes exactly as its target item's scope does:
   * from the record's sidedness (`GeneratedNode.deleted`), never from
   * graph occupancy of the `scope` spelling. A reference naming a
   * current-graph node (audit's child blockers, the audit and coverage
   * decomposition content sources' child references) may omit it and
   * canonicalizes as a current spelling. Canonicalized output references
   * never carry it — `canonicalizeGeneration` emits `{kind, scope}` only,
   * `scope` a canonical reference.
   */
  readonly scopeNode?: GeneratedNode;
}

/**
 * The node's ancestor chain in the current graph — the shared context shape
 * of the strategies without a baseline (SPEC 10.6 audit items; SPEC 10.7
 * `uncovered-requirement` items and split decompositions): every proper
 * ancestor up to the file root, in document order (root first), each with
 * no baseline identity (SPEC 10.2: such a session's `baseline` is the
 * current graph's values at entry). Empty for an absent node — it has no
 * current ancestors — and for a root (SPEC 1.2: roots have no parent).
 */
export function currentAncestorChain(
  graph: WorkspaceGraph,
  identity: string,
): GeneratedNode[] {
  const node = graph.requirementNode(identity);
  if (node === undefined) return [];
  const chain: GeneratedNode[] = [];
  for (
    let ancestor = graph.parentOf(node);
    ancestor !== null;
    ancestor = graph.parentOf(ancestor)
  ) {
    chain.push({
      identity: ancestor.identity,
      baselineIdentity: null,
      deleted: false,
    });
  }
  return chain.reverse();
}

/**
 * The node's children in the current graph, in document order — the
 * children of a scope root in the strategies without a baseline (SPEC
 * 10.7: in a baseline session deleted ones are included, 10.5 — that
 * strategy's content source enumerates its own links), each with no
 * baseline identity, as `currentAncestorChain`'s nodes. Empty for an
 * absent node and for a leaf.
 */
export function currentChildren(
  graph: WorkspaceGraph,
  identity: string,
): GeneratedNode[] {
  const node = graph.requirementNode(identity);
  if (node === undefined) return [];
  return graph.childrenOf(node).map((child) => ({
    identity: child.identity,
    baselineIdentity: null,
    deleted: false,
  }));
}

/**
 * The node's descendants in the current graph, in document order (a
 * pre-order walk over the children, the node itself excluded) — the scope
 * nodes beneath a `subtree-coherence` scope root in the strategies without
 * a baseline (SPEC 10.6: "as scope the node and all its current
 * descendants"; SPEC 10.7's per-child items, "as in 10.5 and 10.6"), each
 * with no baseline identity, as `currentAncestorChain`'s nodes. Empty for
 * an absent node and for a leaf.
 */
export function currentDescendants(
  graph: WorkspaceGraph,
  identity: string,
): GeneratedNode[] {
  const node = graph.requirementNode(identity);
  if (node === undefined) return [];
  const descendants: GeneratedNode[] = [];
  const stack = [...graph.childrenOf(node)].reverse();
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined) break;
    descendants.push({
      identity: next.identity,
      baselineIdentity: null,
      deleted: false,
    });
    const children = graph.childrenOf(next);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
  return descendants;
}

/** One strategy-generated review item: the SPEC 10.2 content plus the
 * node-identity plumbing of `GeneratedNode`. */
export interface GeneratedItem {
  readonly kind: ItemKind;
  /** The scope node — the subtree root for `subtree-coherence` (SPEC 10.5),
   * the scoped code location for `code-impact`. */
  readonly scope: GeneratedNode;
  /**
   * A `subtree-coherence` item's scope nodes beneath its scope root
   * (SPEC 10.5: "scope: N and all descendants"; 10.6: "the node and all its
   * current descendants"), as the strategy's node relation gives them — in
   * a baseline session over the links of 10.5 (src/core/path-blocks.ts:
   * present nodes under their current parents, deleted nodes under their
   * baseline parents mapped through the journal), so a deleted descendant
   * is among them and a node a journaled move took out of the subtree is
   * not; in a session without a baseline the root's current descendants in
   * document order (`currentDescendants`), none for a root that does not
   * canonically resolve (SPEC 10.4). Every `subtree-coherence` item a
   * generator or decomposition content source produces carries it, empty
   * for a leaf: an item takes it as its stored scope wherever it is
   * assigned the generated scope (`newItemFromGenerated`,
   * `reassignedExistingItem`; SPEC 10.4: reads present `scope` as last
   * assigned); the item's `current` state covers the scope root and the
   * nodes so stored, at creation and at each resolve (review-state.ts
   * `computeRecordedState`), and in a baseline session the
   * recorded-baseline state's relevant hashes cover the scope root and
   * these nodes (`computeBaselineRecordedState`). Omitted on every other
   * kind, whose scope is its scope node alone.
   */
  readonly scopeDescendants?: readonly GeneratedNode[];
  readonly context: readonly GeneratedNode[];
  readonly origin: readonly GeneratedNode[];
  readonly reason: string;
  /**
   * The strategy-assigned blockers (SPEC 10.5, 10.6), as references — for
   * a decomposition item, the decomposition's (SPEC 10.7: a per-child
   * item's are the ones its session's strategy gives a `subtree-coherence`
   * item, the scope root's `parent-consistency` item's the child items),
   * never the decomposed original's.
   */
  readonly blockedBy: readonly GeneratedBlockerRef[];
  /**
   * `code-impact` only (SPEC 10.4, 9.2): every node targeted by the scoped
   * location's impact edges — the union over both sides, qualifying for
   * the impact categories or not — whose subtreeHash and effectiveHash the
   * recorded state carries.
   */
  readonly impactTargets?: readonly GeneratedNode[];
}

/**
 * The strategy-supplied content builder the decomposition replay draws on
 * (SPEC 10.5/10.7): when a recorded decomposition replaces a generated
 * `subtree-coherence` item, the replacement items' content — per-child
 * `subtree-coherence` items and the scope root's `parent-consistency`
 * item — is the strategy's to define (context, origin, reason), because it
 * mirrors what the strategy generates (SPEC 10.7: "its context the child's
 * ancestor chain, as in 10.5 and 10.6"; "Each decomposition item's
 * `origin` is, as in 10.5, the `changed` nodes in its scope — for a
 * `parent-consistency` item, in its scope node's subtree — and is empty in
 * an `audit` session"). The replay at re-derivation and `split` draw on the
 * same source, so both assign the same content — over the same children:
 * which nodes a scope root's children are is the strategy's node relation
 * too (SPEC 10.7: "whose scope root has children (in a baseline session,
 * deleted ones included, 10.5)"), so the source enumerates them
 * (`scopeChildren`), and `split`'s childless refusal, its decomposition,
 * and the re-derivation's replay all take them from it.
 *
 * Every scope argument names a stored node. In canonical space (the
 * wrapper `canonicalizeGeneration` builds, which the replay and `split`
 * consume) it is a stored canonical reference and the optional resolution
 * arguments are omitted; the wrapper resolves the reference and hands the
 * strategy's spelling-space source its derived current spelling plus:
 * `scopeResolves`, whether the reference canonically resolves through the
 * full journal (SPEC 10.4) — false exactly when the spelling was
 * recaptured for a distinct chain — and, in a baseline session,
 * `scopeBaselineIdentity`, the identity the referenced node bore at the
 * recorded baseline when the reference resolves as of the baseline
 * journal prefix (review-state.ts `resolveReferenceAt`; SPEC 6.3), null
 * when it does not (a node that entered the workspace since). A
 * stored-spelling record lookup thus consults exactly the side the
 * reference names — a present node by its current spelling only while the
 * reference resolves, a deleted node by its baseline identity — never
 * current-first across both by spelling alone (a dangling stored scope
 * must never alias the node that recaptured its spelling, and a deleted
 * node's resolving reference names no present node). A strategy without
 * per-side records (audit, coverage) may ignore `scopeBaselineIdentity`.
 */
export interface DecompositionContentSource {
  /**
   * The scope root's children under the strategy's node relation
   * (SPEC 10.7), in a deterministic order: a node per child, carrying its
   * sidedness (`GeneratedNode.deleted`) and baseline identity, so each
   * canonicalizes as the generator knows it. In a baseline session they
   * follow SPEC 10.5's links — the root's present children and the
   * deleted nodes whose baseline parent it is, so a deleted root's
   * children are the deleted nodes linked beneath it; in a session
   * without a baseline, the root's current children. Empty for a root
   * without any — `split`'s childless refusal (SPEC 10.7). Spelling-space
   * nodes from the strategy's source, canonical references from the
   * wrapper.
   */
  scopeChildren(
    scopeIdentity: string,
    scopeResolves?: boolean,
    scopeBaselineIdentity?: string | null,
  ): readonly GeneratedNode[];
  /**
   * The `subtree-coherence` item for a child subtree rooted at
   * `scopeIdentity` (SPEC 10.7: its context the child's ancestor chain,
   * as in 10.5 and 10.6). The resolution arguments as in the interface
   * doc.
   */
  subtreeCoherenceItem(
    scopeIdentity: string,
    scopeResolves?: boolean,
    scopeBaselineIdentity?: string | null,
  ): GeneratedItem;
  /**
   * The decomposed scope root's `parent-consistency` item (SPEC 10.7):
   * scope `scopeIdentity`, context the child subtrees — `children`,
   * exactly the nodes `scopeChildren` gave for the same scope (the wrapper
   * hands the strategy's source each one's spelling, sidedness, and
   * baseline identity). `blockedBy` MUST reference the child items, each
   * reference canonicalizing as its child's item's scope does — the
   * replay rewrites references into decomposed children recursively. The
   * resolution arguments as in the interface doc.
   */
  splitParentConsistencyItem(
    scopeIdentity: string,
    children: readonly GeneratedNode[],
    scopeResolves?: boolean,
    scopeBaselineIdentity?: string | null,
  ): GeneratedItem;
}

// ---------------------------------------------------------------------------
// The canonicalization seam (SPEC 5.4, 10.4 — spelling space → references)
// ---------------------------------------------------------------------------

/** The inputs of `canonicalizeGeneration`. */
export interface GenerationCanonicalization {
  /** The full current journal. */
  readonly journal: Journal;
  /**
   * The baseline journal prefix length (SPEC 6.3: the baseline journal is
   * a prefix of the current one — its entry count) for a baseline session;
   * omitted for `audit`/`coverage`, whose generated nodes never carry a
   * baseline identity.
   */
  readonly baselineJournalLength?: number;
}

/** One generator run rewritten into canonical-reference space. */
export interface CanonicalizedGeneration {
  readonly items: readonly GeneratedItem[];
  readonly contentSource: DecompositionContentSource;
  /** Per canonical code-location reference, the canonical references of
   * its impact-edge targets (SPEC 10.4, 9.2). */
  readonly impactTargets?: ReadonlyMap<string, readonly string[]>;
}

/**
 * The canonical reference of one generated node (module header), branched
 * on the node's generator-known sidedness (`GeneratedNode.deleted`), never
 * on graph occupancy of its spelling: a current-side node canonicalizes
 * against the full current journal (SPEC 5.4: the canonical identity of
 * the node currently bearing the spelling), while a deleted node — its
 * generating record baseline-side-only — canonicalizes as of the baseline
 * journal prefix from its baseline identity, unconditionally. Its
 * forward-mapped spelling is never canonicalized against the full journal:
 * when a manual deletion (SPEC 6.6) vacated the spelling and a journaled
 * rename or move recaptured it for a distinct chain, spelling-based
 * resolution — occupancy checks included — would misattribute the deleted
 * node to the recapturing chain. For a code-location node the branches
 * coincide (locations are never journal-mapped, SPEC 6.4/6.5).
 */
function canonicalNodeKey(
  node: GeneratedNode,
  inputs: GenerationCanonicalization,
): string {
  const { journal, baselineJournalLength } = inputs;
  if (node.deleted) {
    if (node.baselineIdentity === null || baselineJournalLength === undefined) {
      throw new Error(
        "xspec internal error: a deleted generated node must carry its " +
          "baseline identity within a baseline session (generators emit " +
          "deleted nodes only from baseline-side records)",
      );
    }
    return encodeCanonicalIdentity(
      canonicalAt(journal, baselineJournalLength, node.baselineIdentity),
    );
  }
  return canonicalKeyOfCurrent(journal, node.identity);
}

/**
 * Rewrite one generator run into canonical-reference space (module
 * header): every `GeneratedNode.identity` and every blocker reference's
 * scope becomes a canonical reference (the reference's `scopeNode`
 * consumed and dropped), the decomposition content source is wrapped to
 * accept and produce references, and the per-location impact-target map is
 * rekeyed canonically. The generators themselves stay spelling-space and
 * journal-free; this seam is the one place generated nodes canonicalize.
 */
export function canonicalizeGeneration(
  run: {
    readonly items: readonly GeneratedItem[];
    readonly contentSource: DecompositionContentSource;
    readonly impactTargets?: ReadonlyMap<string, readonly string[]>;
  },
  inputs: GenerationCanonicalization,
): CanonicalizedGeneration {
  const { journal } = inputs;

  // A blocker reference canonicalizes exactly as its target item's scope
  // does — from the emitting record's sidedness, carried on
  // `GeneratedBlockerRef.scopeNode` by the generator-space emitters that
  // build references from change records (path-blocks' `parent-consistency`
  // blockers and its decomposition child references, a deleted child's
  // included) — never by resolving the scope spelling through graph
  // occupancy: a spelling vacated by a manual deletion and recaptured by a
  // journaled entry is ambiguous, sidedness is not (module header). A
  // reference without `scopeNode` names a current-graph node (audit's
  // child blockers, the audit and coverage decomposition content sources'
  // child references — their children are current ones, SPEC 10.6, 10.7)
  // and canonicalizes as a current spelling.
  // Because every reference is built from the same record — or the same
  // current-graph node — as its target item's scope, reference and scope
  // canonicalize identically by construction, so every blocker reference
  // resolves to a generated item's canonical key (`deriveSessionItems`
  // rejects any that does not).
  const refKey = (ref: GeneratedBlockerRef): string =>
    ref.scopeNode !== undefined
      ? canonicalNodeKey(ref.scopeNode, inputs)
      : canonicalKeyOfCurrent(journal, ref.scope);

  const canonicalNode = (node: GeneratedNode): GeneratedNode => ({
    identity: canonicalNodeKey(node, inputs),
    baselineIdentity: node.baselineIdentity,
    deleted: node.deleted,
  });
  const canonicalizeItem = (item: GeneratedItem): GeneratedItem => ({
    ...item,
    scope: canonicalNode(item.scope),
    scopeDescendants: item.scopeDescendants?.map(canonicalNode),
    context: item.context.map(canonicalNode),
    origin: item.origin.map(canonicalNode),
    blockedBy: item.blockedBy.map((ref) => ({
      kind: ref.kind,
      scope: refKey(ref),
    })),
    impactTargets: item.impactTargets?.map(canonicalNode),
  });

  const items = run.items.map(canonicalizeItem);

  // The decomposition content source in reference space
  // (DecompositionContentSource doc). An input scope reference is resolved
  // on each side — through the full journal (`resolveReference`) and, in a
  // baseline session, as of the baseline journal prefix
  // (`resolveReferenceAt`) — and the strategy's spelling-space builder
  // receives the derived spelling, whether the reference canonically
  // resolves (SPEC 10.4), and the identity the referenced node bore at the
  // recorded baseline, so its stored-spelling record lookups are
  // resolution-sided: a dangling reference, whose spelling may be borne by
  // the distinct node that recaptured it, never aliases that node, and a
  // deleted node's reference reaches its baseline-side record (module
  // header). The children the builder enumerates (`scopeChildren`)
  // canonicalize from their sidedness, as every generated node does, and
  // decode back to spellings — sidedness and baseline identity kept — for
  // the `parent-consistency` item they frame. The wrapper is authoritative
  // for the produced item's canonical scope: it carries exactly the
  // requested reference — never a decode-then-recanonicalize round trip,
  // which could land on a recapturing chain — because
  // `expandDecompositions` memoizes and matches by that reference, which
  // the wrapper already knows.
  const inner = run.contentSource;
  const { baselineJournalLength } = inputs;
  const resolveScope = (
    reference: string,
  ): {
    readonly spelling: string;
    readonly resolves: boolean;
    readonly baselineIdentity: string | null;
  } => {
    const resolution = resolveReference(journal, reference);
    let baselineIdentity: string | null = null;
    if (baselineJournalLength !== undefined) {
      const atBaseline = resolveReferenceAt(
        journal,
        baselineJournalLength,
        reference,
      );
      if (atBaseline.resolves) baselineIdentity = atBaseline.spelling;
    }
    return { ...resolution, baselineIdentity };
  };
  const decodeNode = (node: GeneratedNode): GeneratedNode => ({
    identity: spellingOfReference(journal, node.identity),
    baselineIdentity: node.baselineIdentity,
    deleted: node.deleted,
  });
  const withScopeReference = (
    item: GeneratedItem,
    reference: string,
  ): GeneratedItem => ({
    ...item,
    scope: { ...item.scope, identity: reference },
  });
  const contentSource: DecompositionContentSource = {
    scopeChildren: (scopeReference): readonly GeneratedNode[] => {
      const scope = resolveScope(scopeReference);
      return inner
        .scopeChildren(scope.spelling, scope.resolves, scope.baselineIdentity)
        .map(canonicalNode);
    },
    subtreeCoherenceItem: (scopeReference): GeneratedItem => {
      const scope = resolveScope(scopeReference);
      return withScopeReference(
        canonicalizeItem(
          inner.subtreeCoherenceItem(
            scope.spelling,
            scope.resolves,
            scope.baselineIdentity,
          ),
        ),
        scopeReference,
      );
    },
    splitParentConsistencyItem: (scopeReference, children): GeneratedItem => {
      const scope = resolveScope(scopeReference);
      return withScopeReference(
        canonicalizeItem(
          inner.splitParentConsistencyItem(
            scope.spelling,
            children.map(decodeNode),
            scope.resolves,
            scope.baselineIdentity,
          ),
        ),
        scopeReference,
      );
    },
  };

  // The per-location impact-target map (SPEC 10.4, 9.2), rekeyed
  // canonically. A location with a generated `code-impact` item reuses the
  // item's canonicalized targets — the deleted-target-aware keying above.
  // Every other covered location is unimpacted, so its targets are present
  // on both sides (SPEC 9.2: an added or deleted target makes the location
  // impacted) and canonicalize as current spellings.
  let impactTargets: Map<string, readonly string[]> | undefined;
  if (run.impactTargets !== undefined) {
    const itemBySpelling = new Map<string, GeneratedItem>();
    run.items.forEach((item, index) => {
      if (item.kind === "code-impact") {
        itemBySpelling.set(item.scope.identity, items[index]);
      }
    });
    const rekeyed = new Map<string, readonly string[]>();
    for (const [location, targets] of run.impactTargets) {
      const item = itemBySpelling.get(location);
      if (item !== undefined) {
        rekeyed.set(
          item.scope.identity,
          (item.impactTargets ?? []).map((node) => node.identity),
        );
      } else {
        rekeyed.set(
          canonicalKeyOfCurrent(journal, location),
          targets.map((target) => canonicalKeyOfCurrent(journal, target)),
        );
      }
    }
    impactTargets = rekeyed;
  }

  return { items, contentSource, impactTargets };
}

// ---------------------------------------------------------------------------
// Decomposition replay (SPEC 10.5 re-derivation rule 2, SPEC 10.7)
// ---------------------------------------------------------------------------

/** The injective (kind, scope) key of an item or reference. */
function kindScopeKey(kind: ItemKind, scope: string): string {
  return `${kind} ${scope}`;
}

/**
 * Replay the session's recorded decompositions over a generation
 * (SPEC 10.5): a generated item whose kind and scope node are recorded as
 * decomposed by `split` (SPEC 10.7) is never added back — it is replaced
 * by one `subtree-coherence` item per child subtree the scope node has at
 * the re-derivation plus the scope node's `parent-consistency` item,
 * recursively (a replacement child item that is itself decomposed is
 * replaced in turn). The children are the strategy's
 * (`DecompositionContentSource.scopeChildren`): in a baseline session
 * over SPEC 10.5's links, deleted children included ("ancestors,
 * descendants, children, and subtrees — in decompositions (10.7) too —
 * follow these links"), else the current ones. Every blocker reference to
 * a decomposed item is replaced by references to all items of its
 * decomposition (rule 5), and a kind and scope node produced more than
 * once yields a single item (rule 1's dedup, applied here so the
 * expansion output is the one-item-per-kind-and-scope set the merge
 * consumes; SPEC 10.1).
 *
 * `decomposedScopes` holds the recorded decompositions' scope references
 * (all recorded decompositions are `subtree-coherence`, SPEC 10.7), as
 * stored canonical references; `generated` and `source` are
 * canonical-space (`canonicalizeGeneration`), so the source resolves each
 * scope reference on both sides itself.
 */
export function expandDecompositions(
  generated: readonly GeneratedItem[],
  decomposedScopes: readonly string[],
  source: DecompositionContentSource,
): GeneratedItem[] {
  const decomposed = new Set(decomposedScopes);
  const isDecomposed = (kind: ItemKind, scope: string): boolean =>
    kind === "subtree-coherence" && decomposed.has(scope);

  // Per decomposed scope identity, the fully expanded replacement items —
  // memoized so nested decompositions expand once (SPEC 10.5: "recursively").
  // The replacement items carry the content and blockers the strategy's
  // rules and 10.7 assign them; nothing is inherited from the replaced
  // item (SPEC 10.7: a per-child item's `blockedBy` is the one its
  // session's strategy gives a `subtree-coherence` item).
  const expansionMemo = new Map<string, readonly GeneratedItem[]>();
  const expanding = new Set<string>();

  const expandScope = (scopeIdentity: string): readonly GeneratedItem[] => {
    const memoized = expansionMemo.get(scopeIdentity);
    if (memoized !== undefined) return memoized;
    if (expanding.has(scopeIdentity)) {
      // A scope cannot lie within its own decomposition's child subtrees
      // for any valid graph (the containment tree is a tree); the guard
      // keeps the replay total over invalid inputs.
      return [];
    }
    expanding.add(scopeIdentity);
    try {
      // SPEC 10.5: one subtree-coherence item per child subtree the scope
      // node has at the re-derivation — the strategy's children
      // (`scopeChildren`): in a baseline session over the links of 10.5,
      // a deleted child under its baseline parent, each child's reference
      // canonicalized from its sidedness (module header); otherwise the
      // current children, of which an absent scope node (10.4: deleted, or
      // its identity ceased to resolve through the journal) has none, so a
      // dangling stored scope never enumerates the distinct node that
      // recaptured its spelling.
      const children = source.scopeChildren(scopeIdentity);
      const items: GeneratedItem[] = [];
      for (const child of children) {
        const childItem = source.subtreeCoherenceItem(child.identity);
        if (isDecomposed(childItem.kind, childItem.scope.identity)) {
          // SPEC 10.5: the decomposition applies recursively.
          items.push(...expandScope(childItem.scope.identity));
        } else {
          items.push(childItem);
        }
      }
      items.push(source.splitParentConsistencyItem(scopeIdentity, children));
      expansionMemo.set(scopeIdentity, items);
      return items;
    } finally {
      expanding.delete(scopeIdentity);
    }
  };

  // First pass: replace decomposed generated items by their expansions,
  // deduplicating by (kind, scope) — the first occurrence wins, later
  // occurrences merge their blocker references (SPEC 10.5 rule 1: "a kind
  // and scope node produced more than once in one derivation yields a
  // single item").
  const expanded: GeneratedItem[] = [];
  const byKey = new Map<string, number>();
  const add = (item: GeneratedItem): void => {
    const key = kindScopeKey(item.kind, item.scope.identity);
    const existingIndex = byKey.get(key);
    if (existingIndex === undefined) {
      byKey.set(key, expanded.length);
      expanded.push(item);
      return;
    }
    const existing = expanded[existingIndex];
    expanded[existingIndex] = {
      ...existing,
      blockedBy: mergeRefs(existing.blockedBy, item.blockedBy),
    };
  };
  for (const item of generated) {
    if (isDecomposed(item.kind, item.scope.identity)) {
      for (const replacement of expandScope(item.scope.identity)) {
        add(replacement);
      }
    } else {
      add(item);
    }
  }

  // Second pass (SPEC 10.5 rule 5): rewrite every blocker reference to a
  // decomposed item into references to all items of its decomposition,
  // recursively; the expansion memo already holds each decomposition's
  // final items.
  const rewriteRefs = (
    refs: readonly GeneratedBlockerRef[],
  ): GeneratedBlockerRef[] => {
    const out: GeneratedBlockerRef[] = [];
    const seen = new Set<string>();
    const push = (ref: GeneratedBlockerRef): void => {
      const key = kindScopeKey(ref.kind, ref.scope);
      if (seen.has(key)) return;
      if (isDecomposed(ref.kind, ref.scope)) {
        seen.add(key);
        for (const item of expandScope(ref.scope)) {
          push({ kind: item.kind, scope: item.scope.identity });
        }
        return;
      }
      seen.add(key);
      out.push(ref);
    };
    for (const ref of refs) push(ref);
    return out;
  };
  return expanded.map((item) => ({
    ...item,
    blockedBy: rewriteRefs(item.blockedBy),
  }));
}

function mergeRefs(
  a: readonly GeneratedBlockerRef[],
  b: readonly GeneratedBlockerRef[],
): GeneratedBlockerRef[] {
  const out: GeneratedBlockerRef[] = [];
  const seen = new Set<string>();
  for (const ref of [...a, ...b]) {
    const key = kindScopeKey(ref.kind, ref.scope);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(ref);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Derivation sides (the graph states the merge computes against)
// ---------------------------------------------------------------------------

/** The current workspace's graph state (SPEC 10.4): graph, hashes, text
 * model, the full current journal (the reference codec seam), and — for
 * sessions that can hold `code-impact` items — the per-location
 * impact-edge target references (canonical, `canonicalizeGeneration`). */
export interface CurrentDerivationSide {
  readonly graph: WorkspaceGraph;
  readonly hashes: ReadonlyMap<string, NodeHashes>;
  readonly textModel: WorkspaceTextModel;
  /** The full current journal (module header identity policy). */
  readonly journal: Journal;
  /** SPEC 10.4/9.2: per canonical code-location reference, the canonical
   * impact-edge target references; omitted for strategies that scope no
   * code (SPEC 10.6, 10.7 coverage sessions). */
  readonly impactTargets?: ReadonlyMap<string, readonly string[]>;
}

/**
 * The recorded-baseline graph state (SPEC 10.2: in a baseline session, an
 * item's `baseline` field holds the values in the graph at the recorded
 * baseline). `journal` is the full current journal and `journalLength` the
 * baseline journal prefix length (SPEC 6.3: the baseline journal is a
 * prefix of the current one), so a baseline-graph node's stored key is its
 * canonical identity as of that prefix — eternal under journal growth
 * (SPEC 5.4). Sessions without a baseline (`audit`, `coverage`) pass none:
 * their `baseline` is the current graph's values at the moment the item
 * enters the session (SPEC 10.2).
 */
export interface BaselineDerivationSide {
  readonly graph: WorkspaceGraph;
  readonly hashes: ReadonlyMap<string, NodeHashes>;
  readonly textModel: WorkspaceTextModel;
  readonly journal: Journal;
  readonly journalLength: number;
}

/** Per current side, its `ReviewStateInputs`. */
const STATE_INPUTS = new WeakMap<CurrentDerivationSide, ReviewStateInputs>();

/** `ReviewStateInputs` (review-state.ts) over a current side — one object
 * per side, so the state computation's per-graph-state memo spans every
 * item a derivation records against it. */
export function reviewStateInputs(
  current: CurrentDerivationSide,
): ReviewStateInputs {
  let inputs = STATE_INPUTS.get(current);
  if (inputs === undefined) {
    const impactTargets = current.impactTargets;
    inputs = {
      graph: current.graph,
      hashes: current.hashes,
      journal: current.journal,
      impactTargets:
        impactTargets === undefined
          ? undefined
          : (location): readonly string[] => impactTargets.get(location) ?? [],
    };
    STATE_INPUTS.set(current, inputs);
  }
  return inputs;
}

// ---------------------------------------------------------------------------
// Baseline recorded state (SPEC 10.2, 10.4)
// ---------------------------------------------------------------------------

/**
 * The SPEC 10.4 recorded state of a generated item against the
 * recorded-baseline graph — the `baseline` field a new item enters the
 * session with (SPEC 10.2). The per-kind relevant-hash table mirrors
 * review-state.ts's `computeRecordedState`; nodes resolve through their
 * `GeneratedNode.baselineIdentity` (module header), never by looking a
 * stored reference up in the baseline graph, so a reintroduced identity
 * (SPEC 5.4) cannot alias a distinct baseline node. Keys are stored
 * canonical references, the generated nodes' own
 * (`canonicalizeGeneration`): a deleted node's key is its canonical
 * identity as of the baseline journal prefix (SPEC 5.4 — never its
 * forward-mapped spelling canonicalized against the full journal, module
 * header). A `subtree-coherence` item's scope nodes are the generator's
 * (`GeneratedItem.scopeDescendants`, over SPEC 10.5's links).
 */
export function computeBaselineRecordedState(
  item: GeneratedItem,
  baseline: BaselineDerivationSide,
): RecordedState {
  // Required hash names per stored identity; roles merge (a node in
  // several roles holds one entry with the union of relevant hashes), as
  // in computeRecordedState.
  const required = new Map<
    string,
    { baselineIdentity: string | null; names: Set<RecordedHashName> }
  >();
  const record = (
    identity: string,
    baselineIdentity: string | null,
    ...names: RecordedHashName[]
  ): void => {
    let entry = required.get(identity);
    if (entry === undefined) {
      required.set(identity, (entry = { baselineIdentity, names: new Set() }));
    } else if (entry.baselineIdentity === null && baselineIdentity !== null) {
      entry.baselineIdentity = baselineIdentity;
    }
    for (const name of names) entry.names.add(name);
  };
  const recordNode = (
    node: GeneratedNode,
    ...names: RecordedHashName[]
  ): void => {
    record(node.identity, node.baselineIdentity, ...names);
  };

  // SPEC 10.4: presence is recorded for every scope, context, and origin
  // node, whatever hashes the kind's table assigns them.
  recordNode(item.scope);
  for (const node of item.context) recordNode(node);
  for (const node of item.origin) recordNode(node);

  switch (item.kind) {
    case "subtree-coherence": {
      // SPEC 10.4: subtreeHash and metadataHash of each scope node — the
      // root and all its descendants over the links of SPEC 10.5, which
      // the generator supplies (`GeneratedItem.scopeDescendants`): a node
      // set alone, so each node's values are its own in the baseline graph
      // (SPEC 10.5: hashes keep their definitions) — a node moved into the
      // subtree since the baseline holds its baseline values, one added
      // since is absent there (the explicit absent marker), and one moved
      // out of the subtree is no scope node.
      const descendants = item.scopeDescendants;
      if (descendants === undefined) {
        throw new Error(
          `xspec internal error: the recorded-baseline state of a ` +
            `subtree-coherence item (scope ${item.scope.identity}) needs ` +
            `its scope nodes beneath the root (SPEC 10.4, 10.5), but the ` +
            `generator supplied none`,
        );
      }
      recordNode(item.scope, "subtreeHash", "metadataHash");
      for (const node of descendants) {
        recordNode(node, "subtreeHash", "metadataHash");
      }
      break;
    }
    case "parent-consistency":
    case "dependency-consistency": {
      // SPEC 10.4: ownHash and metadataHash of the scope node; subtreeHash
      // of each context node (branch children / upstream targets, 10.5).
      recordNode(item.scope, "ownHash", "metadataHash");
      for (const node of item.context) recordNode(node, "subtreeHash");
      break;
    }
    case "metadata-consistency": {
      // SPEC 10.4: metadataHash of the scope node.
      recordNode(item.scope, "metadataHash");
      break;
    }
    case "code-impact": {
      // SPEC 10.4: subtreeHash and effectiveHash of each node targeted by
      // the scoped code location's impact edges (9.2).
      for (const node of item.impactTargets ?? []) {
        recordNode(node, "subtreeHash", "effectiveHash");
      }
      break;
    }
    case "uncovered-requirement": {
      // SPEC 10.4: subtreeHash and metadataHash of the scope node.
      recordNode(item.scope, "subtreeHash", "metadataHash");
      break;
    }
  }

  const nodes: Record<string, RecordedNodeState> = {};
  for (const [identity, entry] of required) {
    nodes[identity] = baselineNodeState(item, identity, entry, baseline);
  }
  return { nodes };
}

function baselineNodeState(
  item: GeneratedItem,
  identity: string,
  entry: {
    readonly baselineIdentity: string | null;
    readonly names: ReadonlySet<RecordedHashName>;
  },
  baseline: BaselineDerivationSide,
): RecordedNodeState {
  // SPEC 10.2/10.5: only a `code-impact` item's scope is a code location;
  // a code location has no hash values (SPEC 5.5 hashes requirement
  // nodes), so its state is presence alone.
  if (kindScopesCodeLocation(item.kind) && identity === item.scope.identity) {
    return entry.baselineIdentity !== null &&
      baseline.graph.codeLocation(entry.baselineIdentity) !== undefined
      ? { present: true, hashes: {} }
      : { present: false, hashes: "absent" };
  }
  if (
    entry.baselineIdentity === null ||
    baseline.graph.requirementNode(entry.baselineIdentity) === undefined
  ) {
    // SPEC 10.4: absent — the node does not exist in the baseline graph;
    // its hashes are the explicit absent marker.
    return { present: false, hashes: "absent" };
  }
  const hashes: Partial<Record<RecordedHashName, string>> = {};
  if (entry.names.size > 0) {
    const nodeHashes = baseline.hashes.get(entry.baselineIdentity);
    if (nodeHashes === undefined) {
      // Callers pass validated, fully hashed workspaces (SPEC 6.3, 13.3).
      throw new Error(
        `xspec internal error: no baseline hashes for the recorded node ` +
          entry.baselineIdentity,
      );
    }
    for (const name of entry.names) {
      hashes[name] = nodeHashes[name];
    }
  }
  return { present: true, hashes };
}

// ---------------------------------------------------------------------------
// Text snapshots (SPEC 10.2, 10.7)
// ---------------------------------------------------------------------------

/** One node's text role in an item: the node and the text kinds its roles
 * there present (SPEC 10.7). */
interface TextRole<N> {
  readonly node: N;
  readonly kinds: ReadonlySet<TextKind>;
}

/**
 * SPEC 10.7: the requirement nodes whose texts an item's payload presents,
 * each with the text kinds its roles present, keyed by stored reference
 * (`referenceOf`) in first-role order — the scope root its kind's scope
 * text (`scopeTextKind`: subtree text for `subtree-coherence` and
 * `uncovered-requirement`, own text for the consistency kinds, none for a
 * `code-impact` scope, a code location with no text value), each context
 * node its kind's context text (`contextTextKind`: own text along an
 * ancestor chain, subtree text otherwise), and each node of `origin` its
 * own text, an origin's before side (its after side is the current
 * graph's, so derivation-time snapshots pass no origin). A node holding
 * several roles takes each role's kind; for every kind the scope root and
 * the context nodes are disjoint, so within one item a node's kind as
 * scope root or context node is fixed by its role. The scope nodes beneath
 * a root present no text, and no ancestor's subtree text is presented, so
 * a snapshot never holds both kinds of every node.
 */
function textRoles<N>(
  kind: ItemKind,
  scope: N,
  context: readonly N[],
  origin: readonly N[],
  referenceOf: (node: N) => string,
): ReadonlyMap<string, TextRole<N>> {
  const roles = new Map<string, { node: N; kinds: Set<TextKind> }>();
  const add = (node: N, textKind: TextKind): void => {
    const reference = referenceOf(node);
    let role = roles.get(reference);
    if (role === undefined) {
      roles.set(reference, (role = { node, kinds: new Set() }));
    }
    role.kinds.add(textKind);
  };
  const scopeKind = scopeTextKind(kind);
  if (scopeKind !== null) add(scope, scopeKind);
  const contextKind = contextTextKind(kind);
  for (const node of context) add(node, contextKind);
  for (const node of origin) add(node, "ownText");
  return roles;
}

/** Per text model, `nodeTexts`' values by identity and kinds. */
const NODE_TEXTS = new WeakMap<
  WorkspaceTextModel,
  Map<string, Map<string, RecordedTexts | null>>
>();

/** A node's texts of the given kinds (SPEC 1.6, fully expanded) from a
 * graph and its text model — null when the identity resolves to no node
 * there. Computed once per graph state, identity, and kinds — the text
 * model is one graph state's, immutable — so every item snapshotting a
 * node in one state shares one value: an n-deep chain's audit items
 * snapshot O(n²) ancestor texts of n + 1 nodes. */
function nodeTexts(
  graph: WorkspaceGraph,
  textModel: WorkspaceTextModel,
  identity: string,
  kinds: ReadonlySet<TextKind>,
): RecordedTexts | null {
  let byIdentity = NODE_TEXTS.get(textModel);
  if (byIdentity === undefined) {
    byIdentity = new Map();
    NODE_TEXTS.set(textModel, byIdentity);
  }
  let byKinds = byIdentity.get(identity);
  if (byKinds === undefined) {
    byKinds = new Map();
    byIdentity.set(identity, byKinds);
  }
  const key =
    (kinds.has("ownText") ? "own" : "") +
    (kinds.has("subtreeText") ? " subtree" : "");
  const known = byKinds.get(key);
  if (known !== undefined) return known;
  const node = graph.requirementNode(identity);
  let texts: { ownText?: string; subtreeText?: string } | null = null;
  if (node !== undefined) {
    texts = {};
    if (kinds.has("ownText")) {
      texts.ownText = textModel.ownText(node.document, node.section);
    }
    if (kinds.has("subtreeText")) {
      texts.subtreeText = textModel.subtreeText(node.document, node.section);
    }
  }
  byKinds.set(key, texts);
  return texts;
}

/** A stored reference's texts of the given kinds in the current graph —
 * null unless the reference canonically resolves to a present node (SPEC
 * 10.4): text snapshots record only nodes present per 10.4, so a dangling
 * reference never captures the text of the distinct node that recaptured
 * its spelling. */
function currentNodeTexts(
  current: CurrentDerivationSide,
  reference: string,
  kinds: ReadonlySet<TextKind>,
): RecordedTexts | null {
  const resolution = resolveReference(current.journal, reference);
  return resolution.resolves
    ? nodeTexts(current.graph, current.textModel, resolution.spelling, kinds)
    : null;
}

/**
 * SPEC 10.7: the item's baseline text snapshots — absent-node fallbacks,
 * and a session without a baseline's origin before-texts, come from the
 * item's baseline state, so each of the item's nodes present in the
 * baseline graph records there the kinds its roles present (`textRoles`,
 * origins included: the scope root's scope text, each context node's
 * context text, each origin node's own text), keyed by stored identity.
 * Sessions without a baseline record the entry-moment current texts (their
 * `baseline` state is the current graph's, SPEC 10.2); a baseline
 * session's reads take origin before-texts from the reconstructed
 * recorded-baseline graph (src/cli/commands/review-session.ts
 * `originBeforeSide`).
 */
function baselineTextTable(
  item: GeneratedItem,
  baseline: BaselineDerivationSide | undefined,
  current: CurrentDerivationSide,
): RecordedTextTable {
  const table: Record<string, RecordedTexts> = {};
  const roles = textRoles(
    item.kind,
    item.scope,
    item.context,
    item.origin,
    (node) => node.identity,
  );
  for (const [reference, { node, kinds }] of roles) {
    const texts =
      baseline === undefined
        ? currentNodeTexts(current, reference, kinds)
        : node.baselineIdentity === null
          ? null
          : nodeTexts(
              baseline.graph,
              baseline.textModel,
              node.baselineIdentity,
              kinds,
            );
    if (texts !== null) {
      table[reference] = texts;
    }
  }
  return table;
}

/**
 * SPEC 10.7: the mutating-state text snapshots (`ReviewItem.derivedTexts`)
 * — an absent node's text is its value in the most recent graph state that
 * contained it, among the item's baseline state and "the states under which
 * mutating subcommands (13.5) derived or resolved the item with that node
 * among its nodes". Each such state records, for every node of `roles`
 * present per 10.4 (canonically resolving, in the current graph), the
 * kinds its role presents there: an entry is rewritten per node at each
 * derivation or resolve that finds the node present among the item's
 * nodes and otherwise kept (`previous` entries for nodes absent now, or no
 * longer the item's, stay), so the table always holds each node's most
 * recent such state — save where the item's `baselineTexts` entry for the
 * node holds that state's values: the state then records no entry and an
 * earlier one is removed, the read taking the same values there
 * (src/cli/commands/review-session.ts `absentNodeText`), so the session
 * stores each unchanged text once.
 */
function snapshotCurrentTexts(
  roles: ReadonlyMap<string, TextRole<unknown>>,
  current: CurrentDerivationSide,
  previous: RecordedTextTable,
  baselineTexts: RecordedTextTable,
): RecordedTextTable {
  const table: Record<string, RecordedTexts> = { ...previous };
  for (const [reference, { kinds }] of roles) {
    const texts = currentNodeTexts(current, reference, kinds);
    if (texts === null) {
      continue;
    }
    if (holdsTexts(baselineTexts[reference], texts)) {
      delete table[reference];
    } else {
      table[reference] = texts;
    }
  }
  return table;
}

/** Whether `recorded` holds every text `texts` holds, with the same
 * value. */
function holdsTexts(
  recorded: RecordedTexts | undefined,
  texts: RecordedTexts,
): boolean {
  return (
    recorded !== undefined &&
    (texts.ownText === undefined || recorded.ownText === texts.ownText) &&
    (texts.subtreeText === undefined ||
      recorded.subtreeText === texts.subtreeText)
  );
}

/** SPEC 10.7: the derivation-time text snapshots — a derivation's state
 * (`create`, a re-derivation, a `split`) over the generated item's scope
 * root and context nodes, by role (`textRoles`, `snapshotCurrentTexts`
 * beside the item's `baselineTexts`). */
function derivedTextTable(
  item: GeneratedItem,
  current: CurrentDerivationSide,
  previous: RecordedTextTable,
  baselineTexts: RecordedTextTable,
): RecordedTextTable {
  return snapshotCurrentTexts(
    textRoles(item.kind, item.scope, item.context, [], (node) => node.identity),
    current,
    previous,
    baselineTexts,
  );
}

/**
 * SPEC 10.7: the resolve-time text snapshots — a resolve's state is among
 * "the states under which mutating subcommands (13.5) … resolved the item
 * with that node among its nodes", so the item as the resolve assigns and
 * records it (SPEC 10.4: its scope as last assigned, its context the
 * current context set the resolve assigns) snapshots, by role
 * (`textRoles`), the texts of its scope root (none for a code location,
 * which has no text value) and context nodes present in the graph the
 * resolve records against (`snapshotCurrentTexts`), exactly as a
 * derivation does.
 */
function resolvedTextTable(
  item: ReviewItem,
  current: CurrentDerivationSide,
): RecordedTextTable {
  return snapshotCurrentTexts(
    textRoles(
      item.kind,
      item.scope,
      item.context,
      [],
      (reference) => reference,
    ),
    current,
    item.derivedTexts,
    item.baselineTexts,
  );
}

// ---------------------------------------------------------------------------
// Item construction and reassignment (shared by the merge and `split`)
// ---------------------------------------------------------------------------

/**
 * One new session item from a generated item (SPEC 10.2): status
 * `unresolved`, `current` computed against the current graph over the
 * generated scope (the root and the scope nodes beneath it), context, and
 * origin, with the generated context as its recorded context set
 * (SPEC 10.4), so read-time invalidation finds every recorded node and the
 * context set holding (a freshly created item is never born invalidated),
 * `baseline` against the recorded-baseline side — or the current graph's
 * values at this moment for a session without one — and the SPEC 10.7
 * text snapshots by role: `baselineTexts` in its baseline state
 * (`baselineTextTable`), `derivedTexts` in this derivation's state where
 * that differs (`derivedTextTable`; in a session without a baseline the
 * two states are one, so it starts empty).
 * `blockedBy` is the caller's: the generated item's blocker references,
 * resolved to item ids.
 */
function newItemFromGenerated(
  generated: GeneratedItem,
  id: string,
  blockedBy: readonly string[],
  current: CurrentDerivationSide,
  baseline: BaselineDerivationSide | undefined,
): ReviewItem {
  // SPEC 10.4, 10.2: the scope as assigned at entry — the generated scope
  // nodes beneath the root (`generatedScopeDescendants`) — which `current`
  // is recorded over, as every resolve records it over the scope as last
  // assigned.
  const scopeDescendants = generatedScopeDescendants(generated);
  // One array each — the item's model is readonly, so `context` and the
  // recorded context set it starts as share theirs.
  const context = generated.context.map((node) => node.identity);
  const origin = generated.origin.map((node) => node.identity);
  const currentState = computeRecordedState(
    {
      kind: generated.kind,
      scope: generated.scope.identity,
      scopeDescendants,
      context,
      origin,
    },
    reviewStateInputs(current),
  );
  const baselineTexts = baselineTextTable(generated, baseline, current);
  return {
    id,
    kind: generated.kind,
    scope: generated.scope.identity,
    scopeDescendants,
    context,
    reason: generated.reason,
    origin,
    // SPEC 10.2: `baseline` is fixed at entry — recorded-baseline values in
    // a baseline session, current values without one.
    baseline:
      baseline === undefined
        ? currentState
        : computeBaselineRecordedState(generated, baseline),
    current: currentState,
    // SPEC 10.4: the context nodes so recorded form the recorded context
    // set, written with `current`.
    recordedContext: context,
    status: "unresolved",
    blockedBy,
    baselineTexts,
    derivedTexts: derivedTextTable(generated, current, {}, baselineTexts),
  };
}

/**
 * The scope nodes beneath a generated item's scope root, as the stored
 * references an item takes with its scope (`ReviewItem.scopeDescendants`;
 * SPEC 10.4: `scope` as last assigned) — the generated
 * `subtree-coherence` item's `scopeDescendants`, in generated order; none
 * for every other kind, whose scope is its scope node alone (SPEC 10.5).
 */
function generatedScopeDescendants(generated: GeneratedItem): string[] {
  return (generated.scopeDescendants ?? []).map((node) => node.identity);
}

/**
 * An existing session item standing for a generated item of the same kind
 * and scope node — a re-derivation's matched item (SPEC 10.5) or a
 * `split`'s reused decomposition item (SPEC 10.7): it keeps its `id`,
 * status, note, and recorded state — `baseline`, `current`, and the
 * recorded context set, which only creation and a resolve write
 * (SPEC 10.2, 10.4) — and takes the generated scope (the scope root and
 * the nodes beneath it, `generatedScopeDescendants`), context, origin,
 * reason, and `blockedBy` (the caller's, resolved to item ids). The
 * derivation-time text snapshots are rewritten, by role, per scope root and
 * context node of the item as assigned that the current graph contains,
 * never removed save where the item's baseline snapshot holds the same
 * values (SPEC 10.7: the states under which mutating subcommands derived or
 * resolved the item count; `snapshotCurrentTexts`).
 */
function reassignedExistingItem(
  existing: ReviewItem,
  generated: GeneratedItem,
  blockedBy: readonly string[],
  current: CurrentDerivationSide,
): ReviewItem {
  return {
    ...existing,
    scope: generated.scope.identity,
    scopeDescendants: generatedScopeDescendants(generated),
    context: generated.context.map((node) => node.identity),
    origin: generated.origin.map((node) => node.identity),
    reason: generated.reason,
    blockedBy,
    derivedTexts: derivedTextTable(
      generated,
      current,
      existing.derivedTexts,
      existing.baselineTexts,
    ),
  };
}

// ---------------------------------------------------------------------------
// The merge (SPEC 10.5 re-derivation rules; `create` merges into nothing)
// ---------------------------------------------------------------------------

/** The inputs of `deriveSessionItems`. */
export interface DeriveSessionItemsArgs {
  /**
   * The session's existing items, as stored — canonical references
   * (src/core/review.ts identity policy); empty at `create`.
   */
  readonly existing: readonly ReviewItem[];
  /**
   * The session's recorded decompositions (SPEC 10.7) — empty at
   * `create` — whose kinds and scope nodes keep their ids retired: a new
   * item's derived id never equals one of them (`ItemIdAllocator`,
   * src/core/review.ts "Item ids").
   */
  readonly decompositions: readonly RecordedDecomposition[];
  /** The expanded canonical-space generation (`canonicalizeGeneration` →
   * `expandDecompositions`) — one item per kind and scope node. */
  readonly generated: readonly GeneratedItem[];
  readonly current: CurrentDerivationSide;
  /** The recorded-baseline side; omitted for `audit`/`coverage` sessions
   * (SPEC 10.2: their `baseline` is the entry-moment current state). */
  readonly baseline?: BaselineDerivationSide;
}

/** The merge result: the session's new item list. */
export interface DerivedSessionItems {
  readonly items: readonly ReviewItem[];
}

/**
 * Merge an expanded generation into a session's existing items under the
 * re-derivation rules of SPEC 10.5 (which hold for every strategy):
 *
 * - a generated item whose kind and scope node match an existing item is
 *   that item — it keeps its `id`, `status`, `note`, and recorded state
 *   (`baseline`, `current`, and the recorded context set); its scope (the
 *   nodes beneath the root included), `context`, `origin`, and `reason`
 *   are updated from the generation, and 10.4
 *   alone, against that recorded state, decides whether it then reads
 *   `invalidated` (a node joining its scope, context, or origin has no
 *   recorded presence, so a changed origin by itself invalidates nothing,
 *   while a context set differing from the recorded one does, SPEC 10.4,
 *   10.5);
 * - items that no longer generate remain in the session untouched,
 *   keeping their `blockedBy` (and recorded state, SPEC 10.4);
 * - new items are added with current state — status `unresolved`
 *   (SPEC 10.2), `current` computed against the current graph, the
 *   generated context its recorded context set, `baseline` against the
 *   recorded-baseline side (or the current graph when none, SPEC 10.2) —
 *   and ids derived from their kinds and scope nodes, in generation order
 *   (src/core/review.ts "Item ids": unique, never reused, SPEC 10.2, 10.7);
 * - `blockedBy` is recomputed for every generated item from its blocker
 *   references (decomposed references were already replaced by
 *   `expandDecompositions`), matched and new items alike (SPEC 10.5,
 *   10.7);
 * - text snapshots follow SPEC 10.7, by role (`textRoles`): a new item
 *   records baseline texts and current texts; a matched item's
 *   derivation-time texts are rewritten per node found present, never
 *   removed save where its baseline texts hold the same values.
 *
 * The result keeps existing items in their stored order (matched ones
 * updated in place) and appends new items in generation order —
 * presentation order is derived at read (`sortItemsPathBlocks`, SPEC 10.5).
 */
export function deriveSessionItems(
  args: DeriveSessionItemsArgs,
): DerivedSessionItems {
  const { existing, generated, current, baseline } = args;

  const existingByKey = new Map<string, ReviewItem>();
  for (const item of existing) {
    existingByKey.set(kindScopeKey(item.kind, item.scope), item);
  }

  // First pass: fix ids — matched items keep theirs (SPEC 10.5), new items
  // take ids derived from their kinds and scope nodes, in generation order
  // (src/core/review.ts "Item ids": unique within the session, SPEC 10.2;
  // never a removed original's, 10.7; alike on every branch adding the
  // item, 13.4).
  const ids = new ItemIdAllocator(existing, args.decompositions);
  const idByKey = new Map<string, string>();
  for (const item of generated) {
    const key = kindScopeKey(item.kind, item.scope.identity);
    const existingItem = existingByKey.get(key);
    idByKey.set(
      key,
      existingItem !== undefined
        ? existingItem.id
        : ids.allocate(item.kind, item.scope.identity),
    );
  }

  const resolveRefs = (item: GeneratedItem): readonly string[] => {
    const ids: string[] = [];
    for (const ref of item.blockedBy) {
      const id = idByKey.get(kindScopeKey(ref.kind, ref.scope));
      if (id === undefined) {
        // Every blocker reference names a generated item (SPEC 10.5, 10.6:
        // the strategies' blockers are items of the same derivation).
        throw new Error(
          `xspec internal error: a blocker reference names the ` +
            `non-generated item ${ref.kind} ${ref.scope}`,
        );
      }
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  };

  // Second pass: build the merged items — generated ones by key, then
  // assemble the session list (existing order, new items appended).
  const mergedByKey = new Map<string, ReviewItem>();
  for (const item of generated) {
    const key = kindScopeKey(item.kind, item.scope.identity);
    const blockedBy = resolveRefs(item);
    const existingItem = existingByKey.get(key);
    if (existingItem !== undefined) {
      // SPEC 10.5: the matched item keeps id, status, note, and recorded
      // state — `baseline`, `current`, and the recorded context set — and
      // takes the generated scope, context, origin, reason, and
      // `blockedBy`.
      mergedByKey.set(
        key,
        reassignedExistingItem(existingItem, item, blockedBy, current),
      );
    } else {
      mergedByKey.set(
        key,
        newItemFromGenerated(
          item,
          idByKey.get(key) as string,
          blockedBy,
          current,
          baseline,
        ),
      );
    }
  }

  const items: ReviewItem[] = [];
  const emitted = new Set<string>();
  for (const item of existing) {
    const key = kindScopeKey(item.kind, item.scope);
    const merged = mergedByKey.get(key);
    // SPEC 10.5: items that no longer generate remain, keeping their
    // blockedBy (and everything else) untouched.
    items.push(merged ?? item);
    emitted.add(key);
  }
  for (const item of generated) {
    const key = kindScopeKey(item.kind, item.scope.identity);
    if (emitted.has(key)) continue;
    emitted.add(key);
    const merged = mergedByKey.get(key);
    if (merged !== undefined) items.push(merged);
  }
  return { items };
}

/** The inputs of `rederiveSession`. */
export interface RederiveSessionArgs {
  /**
   * The session to re-derive — canonical references (src/core/review.ts
   * identity policy); its recorded decompositions govern the replay.
   */
  readonly session: ReviewSession;
  /**
   * The session strategy's generator run with the recorded creation
   * parameters against the current workspace, canonicalized
   * (`canonicalizeGeneration`), before decomposition replay.
   */
  readonly generated: readonly GeneratedItem[];
  /** That run's decomposition content, in canonical-reference space. */
  readonly contentSource: DecompositionContentSource;
  readonly current: CurrentDerivationSide;
  /** The recorded-baseline side; omitted for `audit`/`coverage` sessions
   * (SPEC 10.2: their `baseline` is the entry-moment current state). */
  readonly baseline?: BaselineDerivationSide;
}

/**
 * SPEC 10.5: re-derive a session — the generators' run with the recorded
 * creation parameters against the current workspace (`generated`), its
 * recorded decompositions replayed over it (`expandDecompositions`), merged
 * into the session's items under the re-derivation rules
 * (`deriveSessionItems`): matched items keep their `id`, status, note, and
 * recorded state and take the generated scope, context, origin, reason, and
 * `blockedBy`; items that no longer generate remain, keeping their
 * `blockedBy`; new items enter `unresolved` with current state and ids
 * derived from their kinds and scope nodes. The re-derivation every `split`
 * ends with (SPEC 10.7: the
 * decomposition, once recorded, "governs re-derivation (10.5), with which
 * `split` ends, so blocking is recomputed against the current graph"),
 * replaying the decompositions `session` records — the new one included.
 */
export function rederiveSession(args: RederiveSessionArgs): ReviewSession {
  const { session, generated, contentSource, current, baseline } = args;
  const expanded = expandDecompositions(
    generated,
    session.decompositions.map((decomposition) => decomposition.scope),
    contentSource,
  );
  const derived = deriveSessionItems({
    existing: session.items,
    decompositions: session.decompositions,
    generated: expanded,
    current,
    baseline,
  });
  return { ...session, items: derived.items };
}

// ---------------------------------------------------------------------------
// The `split` decomposition (SPEC 10.7)
// ---------------------------------------------------------------------------

/** The inputs of `splitItemDecomposition`. */
export interface SplitDecompositionArgs {
  /**
   * The session, as stored — canonical references (src/core/review.ts
   * identity policy).
   */
  readonly session: ReviewSession;
  /** The item to decompose — an item of `session.items` (caller-resolved;
   * an unknown item id is the caller's usage error, SPEC 10.7, 12.0). */
  readonly original: ReviewItem;
  /**
   * The session strategy's generator run with the recorded creation
   * parameters against the current workspace, canonicalized
   * (`canonicalizeGeneration`), before decomposition replay — the run the
   * re-derivation ending the split merges (SPEC 10.5, 10.7).
   */
  readonly generated: readonly GeneratedItem[];
  /** The session strategy's decomposition content (SPEC 10.7), in
   * canonical-reference space (`canonicalizeGeneration`) — the same run's. */
  readonly contentSource: DecompositionContentSource;
  readonly current: CurrentDerivationSide;
  /** The recorded-baseline side; omitted for `audit`/`coverage` sessions
   * (SPEC 10.2: their `baseline` is the entry-moment current state). */
  readonly baseline?: BaselineDerivationSide;
}

/** The split outcome: the new session value, or the SPEC 10.7 refusal. */
export type SplitDecompositionResult =
  | {
      readonly ok: true;
      /** The session the split leaves: decomposed, the decomposition
       * recorded, then re-derived (SPEC 10.5, 10.7). */
      readonly session: ReviewSession;
      /** The decomposition's item ids — reused and newly created alike —
       * in expansion order (SPEC 10.7: "all items of the decomposition");
       * the re-derivation keeps each (a matched item keeps its `id`). */
      readonly itemIds: readonly string[];
    }
  | {
      /** SPEC 10.7: `split` on an item of any other kind, or on a
       * `subtree-coherence` item whose scope root has no children, is
       * refused. */
      readonly ok: false;
      readonly refusal: string;
    };

/**
 * SPEC 10.7 `split`: decompose a `subtree-coherence` item whose scope root
 * has children — the strategy's (`DecompositionContentSource.scopeChildren`:
 * in a baseline session, deleted ones included, SPEC 10.5) — into one
 * `subtree-coherence` item per child subtree plus one `parent-consistency`
 * item for the scope root's own text — the strategy's decomposition
 * content fixes each item's scope, context,
 * origin, reason, and `blockedBy` ("its context the child's ancestor
 * chain, as in 10.5 and 10.6"; a per-child item's `blockedBy` "the one its
 * session's strategy gives a `subtree-coherence` item", the
 * `parent-consistency` item's "those child items") — and a child whose
 * kind and scope node are themselves recorded as decomposed is spliced
 * recursively, its decomposition's items standing in for its per-child
 * item, in the `parent-consistency` item's `blockedBy` too (SPEC 10.5,
 * 10.7). An item of the decomposition whose kind and scope node already
 * exist in the session is not created: the existing item takes its place,
 * keeping its `id`, status, note, and recorded state (`baseline`,
 * `current`, and its recorded context set, SPEC 10.4) and taking the
 * decomposition's scope, context, origin, reason, and `blockedBy`
 * (`reassignedExistingItem`). Newly created decomposition items enter
 * `unresolved` with current state and the decomposition's `blockedBy`
 * alone, never the original's; every item outside the decomposition that
 * was blocked by the original becomes blocked by all items of the
 * decomposition; the original is removed and its id never reused (its kind
 * and scope node, recorded as decomposed, stay retired from id derivation,
 * src/core/review.ts "Item ids"); the decomposition is recorded durably and
 * governs re-derivation (SPEC 10.5, 10.7) — with which `split` ends
 * (`rederiveSession` over `generated`, the decomposition just recorded
 * among those it replays), so every generated or decomposition-produced
 * item takes the strategy's content and `blockedBy` recomputed against the
 * current graph, items that no longer generate keep theirs — a
 * decomposition item, where its scope root's item no longer generates,
 * keeping this split's assignment — and a change since the last derivation
 * that generates a new item adds it, `unresolved` (SPEC 10.2, 10.5, 10.7).
 */
export function splitItemDecomposition(
  args: SplitDecompositionArgs,
): SplitDecompositionResult {
  const { session, original, generated, contentSource, current, baseline } =
    args;

  // SPEC 10.7: `split` on an item of any other kind is refused.
  if (original.kind !== "subtree-coherence") {
    return {
      ok: false,
      refusal:
        `item '${original.id}' is a ${original.kind} item — \`split\` ` +
        `decomposes only a subtree-coherence item whose scope root has ` +
        `children (SPEC 10.7)`,
    };
  }
  // SPEC 10.7: a scope root without children is refused. Its children are
  // the strategy's — the ones the decomposition below and the replay at
  // every re-derivation take (`scopeChildren`) — judged, as every outcome
  // turning on the graph is, "against the current workspace and, in a
  // baseline session, the recorded baseline" (SPEC 10.7): in a baseline
  // session over the links of 10.5, so a root whose only children were
  // deleted since the baseline — or a deleted root with deleted children
  // of its own — has children; in an `audit` session the current ones
  // alone, of which an absent root (SPEC 10.4: deleted, or its identity
  // ceased to resolve through the journal) has none, so a dangling scope
  // never splits over the children of the distinct node that recaptured
  // its spelling. The refusal names the root under its derived current
  // spelling (SPEC 10.4: nodes surface under current identities).
  if (contentSource.scopeChildren(original.scope).length === 0) {
    const scopeSpelling = resolveReference(
      current.journal,
      original.scope,
    ).spelling;
    return {
      ok: false,
      refusal:
        `the scope root ${scopeSpelling} of item '${original.id}' has no ` +
        `children (in a baseline session, deleted ones included, SPEC ` +
        `10.5) — \`split\` on a subtree-coherence item whose scope root has ` +
        `no children is refused (SPEC 10.7)`,
    };
  }

  // The decomposition's items: the original, expanded under the recorded
  // decompositions plus this new one — a decomposed child is spliced
  // recursively, and blocker references to decomposed items are rewritten
  // to their decompositions' items (SPEC 10.5, 10.7).
  const decomposedScopes = [
    ...session.decompositions.map((decomposition) => decomposition.scope),
    original.scope,
  ];
  const expansion = expandDecompositions(
    [contentSource.subtreeCoherenceItem(original.scope)],
    decomposedScopes,
    contentSource,
  );

  // SPEC 10.7: an item of the decomposition whose kind and scope node
  // already exist in the session is not created — the existing item takes
  // its place. New items take ids derived from their kinds and scope nodes,
  // in expansion order (src/core/review.ts "Item ids"), never the removed
  // original's: its id is taken while it is derived from here, and its
  // kind and scope node, recorded as decomposed, stay retired afterwards.
  const existingByKey = new Map<string, ReviewItem>();
  for (const item of session.items) {
    if (item.id === original.id) continue;
    existingByKey.set(kindScopeKey(item.kind, item.scope), item);
  }
  const decompositions: readonly RecordedDecomposition[] = [
    ...session.decompositions,
    { kind: "subtree-coherence", scope: original.scope },
  ];
  const ids = new ItemIdAllocator(session.items, decompositions);
  const idByKey = new Map<string, string>();
  for (const generated of expansion) {
    const key = kindScopeKey(generated.kind, generated.scope.identity);
    const existing = existingByKey.get(key);
    idByKey.set(
      key,
      existing !== undefined
        ? existing.id
        : ids.allocate(generated.kind, generated.scope.identity),
    );
  }

  // A blocker reference resolves against the decomposition's items and the
  // session's items. SPEC 10.1 lets `blockedBy` name only item ids present
  // in the session, so a reference to an item that never entered it (in an
  // `audit` session, a new child's own children, itemless until the
  // re-derivation ending the split adds them and recomputes every blocker
  // per the strategy's rules, SPEC 10.5) is dropped.
  const idOfRef = (ref: GeneratedBlockerRef): string | undefined => {
    const key = kindScopeKey(ref.kind, ref.scope);
    return idByKey.get(key) ?? existingByKey.get(key)?.id;
  };

  // SPEC 10.7: every item of the decomposition, newly created or reused,
  // as the decomposition assigns it — its `blockedBy` the decomposition's
  // own (a per-child item's the strategy's: none in a baseline session, its
  // child sections' items in an `audit` session; the scope root's
  // `parent-consistency` item's the child items), never the original's. A
  // reused item keeps its `id`, status, note, and recorded state and takes
  // the decomposition's scope, context, origin, reason, and `blockedBy`.
  const assignedByKey = new Map<string, ReviewItem>();
  for (const generated of expansion) {
    const key = kindScopeKey(generated.kind, generated.scope.identity);
    const blockedBy: string[] = [];
    for (const ref of generated.blockedBy) {
      const id = idOfRef(ref);
      if (id !== undefined && !blockedBy.includes(id)) blockedBy.push(id);
    }
    const existing = existingByKey.get(key);
    assignedByKey.set(
      key,
      existing !== undefined
        ? reassignedExistingItem(existing, generated, blockedBy, current)
        : newItemFromGenerated(
            generated,
            idByKey.get(key) as string,
            blockedBy,
            current,
            baseline,
          ),
    );
  }

  const itemIds = expansion.map(
    (generated) =>
      idByKey.get(
        kindScopeKey(generated.kind, generated.scope.identity),
      ) as string,
  );

  // SPEC 10.7: the original is removed; every item outside the
  // decomposition that was blocked by it becomes blocked by all items of
  // the decomposition. Reused decomposition items keep their places, as
  // assigned above. In the stored layout (src/core/review.ts, "Stored
  // layout"; SPEC 13.4: concurrent additions merge textually), the scope
  // root's `parent-consistency` item, where this split creates it, takes
  // the original's place, so that the split rewrites the original's line
  // rather than removing it — a removal conflicts with another branch's
  // change to the line after it — and the other newly created items follow
  // the last stored item in expansion order; only where that item already
  // exists is the original's line removed.
  const rootKey = kindScopeKey("parent-consistency", original.scope);
  const rootItem = existingByKey.has(rootKey)
    ? undefined
    : assignedByKey.get(rootKey);
  const items: ReviewItem[] = [];
  for (const item of session.items) {
    if (item.id === original.id) {
      if (rootItem !== undefined) items.push(rootItem);
      continue;
    }
    const assigned = assignedByKey.get(kindScopeKey(item.kind, item.scope));
    if (assigned !== undefined) {
      items.push(assigned);
      continue;
    }
    if (!item.blockedBy.includes(original.id)) {
      items.push(item);
      continue;
    }
    const blockedBy: string[] = [];
    for (const blocker of item.blockedBy) {
      if (blocker !== original.id) {
        if (!blockedBy.includes(blocker)) blockedBy.push(blocker);
        continue;
      }
      for (const id of itemIds) {
        // SPEC 10.1: no item blocks itself — split produces only acyclic
        // blocking.
        if (id !== item.id && !blockedBy.includes(id)) blockedBy.push(id);
      }
    }
    items.push({ ...item, blockedBy });
  }
  for (const generated of expansion) {
    const key = kindScopeKey(generated.kind, generated.scope.identity);
    if (
      !existingByKey.has(key) &&
      !(rootItem !== undefined && key === rootKey)
    ) {
      items.push(assignedByKey.get(key) as ReviewItem);
    }
  }

  // SPEC 10.7: the decomposition — the original's kind and scope node — is
  // recorded durably in the session and governs re-derivation (10.5), with
  // which `split` ends: the generators' run replayed under every recorded
  // decomposition, this one included, and merged under 10.5's rules — so
  // blocking is recomputed against the current graph and stays acyclic
  // (10.1). Every decomposition item is in the session the re-derivation
  // merges into, so each keeps its id — matched where generated again,
  // remaining as it stands where not (10.5).
  const decomposed: ReviewSession = { ...session, decompositions, items };
  return {
    ok: true,
    session: rederiveSession({
      session: decomposed,
      generated,
      contentSource,
      current,
      baseline,
    }),
    itemIds,
  };
}

// ---------------------------------------------------------------------------
// `resolve` (SPEC 10.7): status, recorded state, and re-derivation
// ---------------------------------------------------------------------------

/** The inputs of `resolveSessionItem`. */
export interface ResolveItemArgs {
  /** The session, as stored — canonical references (src/core/review.ts). */
  readonly session: ReviewSession;
  /** The id of an item of `session.items` — caller-resolved and unblocked
   * (SPEC 10.7: resolving a blocked item is refused before this runs). */
  readonly itemId: string;
  /** SPEC 10.7: `--status` accepts `updated`, `no-change`, and `skipped`. */
  readonly status: ResolveStatus;
  /** SPEC 10.2: the optional `--note` text of this resolve — the stored
   * note is rewritten at each resolve, cleared when none is given. */
  readonly note?: string;
  /** The decomposition-expanded generator run (`expandDecompositions`) —
   * the generated set an `updated` resolve's re-derivation merges
   * (SPEC 10.5, 10.7). */
  readonly expanded: readonly GeneratedItem[];
  readonly current: CurrentDerivationSide;
  /** The recorded-baseline side; omitted for `audit`/`coverage` sessions. */
  readonly baseline?: BaselineDerivationSide;
}

/**
 * SPEC 10.7 `resolve`: set the item's status and note, assign the item its
 * current context set as `context`, and record the current relevant state
 * (10.4) — `current` is rewritten at this resolve (10.2) — on any unblocked
 * item regardless of current status, so an `invalidated` or previously
 * resolved item is re-resolved the same way. The current context set is
 * the one reads compute and present (`currentContextSets` over the same
 * expanded generation, else the item's `context` as last assigned), and
 * `current` is recorded over the item's scope as last assigned (the root
 * and the scope nodes beneath it, `scopeDescendants` — never the current
 * graph's subtree, which may hold nodes authored since), that context, and
 * its origin, that context becoming its recorded context set, so a read of
 * the same workspace finds the recorded context set equal to the current
 * one (SPEC 10.4). Resolving with `no-change` or `skipped` never re-derives:
 * the item is assigned and recorded as it stands. When the status is `updated`, the session is re-derived at
 * resolve time (SPEC 10.5, for every strategy) — the expanded generation
 * merged under the re-derivation rules, with the item in the session
 * holding its new status and note, which the merge keeps (a matched item
 * keeps its status, note, and recorded state and takes the generated
 * scope, context, origin, reason, and `blockedBy`) — and only once that
 * re-derivation is done is the item, as re-derived, assigned its current
 * context set and its state recorded, over its re-derived scope, context,
 * and origin in the graph the re-derivation used (SPEC 10.4: "an `updated`
 * resolve assigns and records once the re-derivation it triggers (10.5) is
 * done, against the item as re-derived"). A node the re-derivation joined
 * to the item is thus recorded in `current` and gains no entry in
 * `baseline`, which the merge keeps as fixed at entry (SPEC 10.2). With
 * the recording, the item as assigned snapshots, by role, the texts of its
 * scope root and context nodes present in that same graph
 * (`resolvedTextTable`; an origin's after side is the current graph's, so
 * origins need none): a resolve's state counts among those an absent
 * node's text comes from (SPEC 10.7), whatever the status, so a
 * `no-change` or `skipped` resolve — which re-derives nothing — records
 * a state no derivation saw.
 */
export function resolveSessionItem(args: ResolveItemArgs): ReviewSession {
  const { session, itemId, status, note, expanded, current, baseline } = args;
  const stateInputs = reviewStateInputs(current);
  // SPEC 10.4: "Resolving an item assigns it its current context set as
  // `context` and records, in its `current` field (10.2), its relevant
  // hashes per the list above and, for every scope, context, and origin
  // node, whether the node is present — the context nodes so recorded
  // forming its recorded context set, which is thus the context a read of
  // the same workspace presents". Scope, origin, reason, and blockedBy
  // stay as last assigned: the resolve itself assigns the context alone,
  // and records the relevant hashes over the scope as last assigned (the
  // root and its `scopeDescendants`), so a node authored beneath the scope
  // root since that assignment gets no entry.
  // SPEC 10.7: the state this resolve records the item under is among the
  // states an absent node's text comes from ("derived or resolved the item
  // with that node among its nodes"), so the item as assigned snapshots its
  // nodes' texts in that graph — after the re-derivation, for `updated`.
  const assignAndRecord = (item: ReviewItem): ReviewItem => {
    const context =
      currentContextSets([item], expanded).get(item.id) ?? item.context;
    const assigned: ReviewItem = { ...item, context };
    return {
      ...assigned,
      current: computeRecordedState(assigned, stateInputs),
      recordedContext: context,
      derivedTexts: resolvedTextTable(assigned, current),
    };
  };
  const withStatus = session.items.map((item): ReviewItem =>
    item.id === itemId ? { ...item, status, note } : item,
  );
  if (status !== "updated") {
    return {
      ...session,
      items: withStatus.map((item) =>
        item.id === itemId ? assignAndRecord(item) : item,
      ),
    };
  }
  // SPEC 10.5: the re-derivation an `updated` resolve triggers runs first,
  // with the item in the session under its new status and note; SPEC 10.4:
  // the assignment and the recording follow it, against the item as
  // re-derived. Items that no longer generate remain in the session
  // (10.5), so the resolved item is among the derived items.
  const derived = deriveSessionItems({
    existing: withStatus,
    decompositions: session.decompositions,
    generated: expanded,
    current,
    baseline,
  });
  return {
    ...session,
    items: derived.items.map((item) =>
      item.id === itemId ? assignAndRecord(item) : item,
    ),
  };
}

// ---------------------------------------------------------------------------
// Current context sets (SPEC 10.4 — the read-time seam)
// ---------------------------------------------------------------------------

/**
 * SPEC 10.4: the context set the session's strategy generators assign to
 * each item — the generators re-run with the recorded creation parameters
 * and decompositions against the current workspace (`generated` is that
 * run's expanded output), matched to the session's items by kind and scope
 * node. An item the generators no longer produce is absent from the map
 * (its current context set is its `context` as last assigned). Feeds
 * `ItemValidityInputs.currentContexts` (review-state.ts), and reads
 * present it as each item's `context` (SPEC 10.4, 10.7); nothing is
 * persisted.
 */
export function currentContextSets(
  items: readonly ReviewItem[],
  generated: readonly GeneratedItem[],
): ReadonlyMap<string, readonly string[]> {
  const generatedByKey = new Map<string, GeneratedItem>();
  for (const item of generated) {
    generatedByKey.set(kindScopeKey(item.kind, item.scope.identity), item);
  }
  const contexts = new Map<string, readonly string[]>();
  for (const item of items) {
    const match = generatedByKey.get(kindScopeKey(item.kind, item.scope));
    if (match !== undefined) {
      contexts.set(
        item.id,
        match.context.map((node) => node.identity),
      );
    }
  }
  return contexts;
}

// ---------------------------------------------------------------------------
// Item order (SPEC 10.5)
// ---------------------------------------------------------------------------

/** SPEC 10.5: the kind order among requirement-scoped items. */
const KIND_RANK: Readonly<Record<ItemKind, number>> = {
  "subtree-coherence": 0,
  "metadata-consistency": 1,
  "dependency-consistency": 2,
  "parent-consistency": 3,
  // `code-impact` is ordered by the code branch below, `uncovered-
  // requirement` by the coverage-session order (SPEC 10.7); the ranks are
  // unused but keep the record total.
  "code-impact": 4,
  "uncovered-requirement": 5,
};

/** SPEC 10.5: scope-node depth is the ID segment count; roots are 0. The
 * identity's shape (SPEC 1.5: `path#id`, bare path for a root) makes depth
 * derivable for absent nodes too. */
export function scopeDepth(identity: string): number {
  const hash = identity.indexOf("#");
  if (hash === -1) return 0;
  return identity.slice(hash + 1).split(".").length;
}

/** The scope node's file path (SPEC 1.5: the identity's path part). */
export function scopeFilePath(identity: string): string {
  const hash = identity.indexOf("#");
  return hash === -1 ? identity : identity.slice(0, hash);
}

/**
 * SPEC 10.5: the shared document-order tie-break ("wherever an item order
 * ranks by document order — here, in 10.6, and in 10.7"): among items tied
 * on every earlier key, those with present scope nodes come first, in
 * document order; those with absent scope nodes (SPEC 10.4) follow,
 * ordered by scope-node identity (the derived current spelling — ordering
 * compares scope nodes under their current identities), then by item id.
 * `spellingOf` maps an item to its scope's derived current spelling;
 * `positionOf` maps an item to its scope's document position — undefined
 * for a scope absent per 10.4, so a dangling scope whose spelling is borne
 * by a distinct recaptured node takes the absent branch.
 */
export function compareByDocumentOrder(
  a: ReviewItem,
  b: ReviewItem,
  spellingOf: (item: ReviewItem) => string,
  positionOf: (item: ReviewItem) => number | undefined,
): number {
  const aPosition = positionOf(a);
  const bPosition = positionOf(b);
  if (aPosition !== undefined && bPosition !== undefined) {
    return aPosition - bPosition;
  }
  if (aPosition !== undefined) return -1;
  if (bPosition !== undefined) return 1;
  const byIdentity = compareBytes(spellingOf(a), spellingOf(b));
  if (byIdentity !== 0) return byIdentity;
  return compareBytes(a.id, b.id);
}

/** Per requirement-node identity, its position in the graph's node order
 * (file path bytes, then document order — src/core/graph.ts). */
function nodePositions(graph: WorkspaceGraph): ReadonlyMap<string, number> {
  const positions = new Map<string, number>();
  graph.requirementNodes.forEach((node, index) => {
    positions.set(node.identity, index);
  });
  return positions;
}

/** Per item, its scope reference's current resolution (SPEC 10.4):
 * ordering ranks by the derived current spelling, and a document position
 * exists only for a canonically resolving scope — a dangling scope is
 * absent (10.4) whatever node bears its spelling now. */
function scopeResolutions(
  items: readonly ReviewItem[],
  journal: Journal,
): (item: ReviewItem) => ReferenceResolution {
  const resolutions = new Map<ReviewItem, ReferenceResolution>();
  for (const item of items) {
    resolutions.set(item, resolveReference(journal, item.scope));
  }
  return (item): ReferenceResolution =>
    resolutions.get(item) as ReferenceResolution;
}

/** The `positionOf` of `compareByDocumentOrder` over a graph's node order:
 * an item's scope has a document position only when it canonically
 * resolves to a present node (SPEC 10.5 over 10.4 presence). */
function scopePositions(
  resolutionOf: (item: ReviewItem) => ReferenceResolution,
  positions: ReadonlyMap<string, number>,
): (item: ReviewItem) => number | undefined {
  return (item): number | undefined => {
    const resolution = resolutionOf(item);
    return resolution.resolves ? positions.get(resolution.spelling) : undefined;
  };
}

/**
 * SPEC 10.5: the total item order of a `path-blocks` session, computed
 * over current identities and presence (SPEC 10.4 — stored references
 * resolved to their derived current spellings): requirement-scoped items
 * first, by scope-node depth (ID segment count, roots 0) deepest first,
 * then kind (`subtree-coherence`, `metadata-consistency`,
 * `dependency-consistency`, `parent-consistency`), then scope-node file
 * path (bytes), then document order (present scopes first, absent ones by
 * identity then item id); `code-impact` items follow, sorted by
 * code-location identity (bytes). `status`, `next`, and `export` present
 * items in this order.
 */
export function sortItemsPathBlocks(
  items: readonly ReviewItem[],
  graph: WorkspaceGraph,
  journal: Journal,
): ReviewItem[] {
  const resolutionOf = scopeResolutions(items, journal);
  const spellingOf = (item: ReviewItem): string => resolutionOf(item).spelling;
  const positionOf = scopePositions(resolutionOf, nodePositions(graph));
  return [...items].sort((a, b) => {
    const aCode = a.kind === "code-impact";
    const bCode = b.kind === "code-impact";
    if (aCode !== bCode) return aCode ? 1 : -1;
    if (aCode && bCode) {
      const bySpelling = compareBytes(spellingOf(a), spellingOf(b));
      return bySpelling !== 0 ? bySpelling : compareBytes(a.id, b.id);
    }
    // SPEC 10.5: depth deepest first.
    const byDepth = scopeDepth(spellingOf(b)) - scopeDepth(spellingOf(a));
    if (byDepth !== 0) return byDepth;
    const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (byKind !== 0) return byKind;
    const byPath = compareBytes(
      scopeFilePath(spellingOf(a)),
      scopeFilePath(spellingOf(b)),
    );
    if (byPath !== 0) return byPath;
    return compareByDocumentOrder(a, b, spellingOf, positionOf);
  });
}

/**
 * SPEC 10.6/10.7: the item order of an `audit` session and of a `coverage`
 * session's `uncovered-requirement` items — scope-node file path first
 * (byte order), then document order within the file — computed over current
 * identities and presence (SPEC 10.4) with the shared document-order tie
 * machinery of SPEC 10.5: within a file, items with present scope nodes
 * come first in document order (a root before every section of its file,
 * SPEC 1.2), and items with absent scope nodes follow, ordered by
 * scope-node identity, then by item id. An audit decomposition's
 * `parent-consistency` item ranks by its scope node like any other item
 * (SPEC 10.6 orders by scope node, not kind); a residual full tie falls
 * back to item id, keeping the order total. `status`, `next`, and `export`
 * present items in this order.
 */
export function sortItemsByFileThenDocument(
  items: readonly ReviewItem[],
  graph: WorkspaceGraph,
  journal: Journal,
): ReviewItem[] {
  const resolutionOf = scopeResolutions(items, journal);
  const spellingOf = (item: ReviewItem): string => resolutionOf(item).spelling;
  const positionOf = scopePositions(resolutionOf, nodePositions(graph));
  return [...items].sort((a, b) => {
    const byPath = compareBytes(
      scopeFilePath(spellingOf(a)),
      scopeFilePath(spellingOf(b)),
    );
    if (byPath !== 0) return byPath;
    const byDocument = compareByDocumentOrder(a, b, spellingOf, positionOf);
    if (byDocument !== 0) return byDocument;
    return compareBytes(a.id, b.id);
  });
}
