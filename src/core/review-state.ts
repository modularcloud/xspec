// Review-item relevant state and read-time invalidation (SPEC 10.4).
//
// Pure core (IMPLEMENTATION Architecture: review-session logic is core —
// deterministic, I/O-free): over the workspace graph (./graph.ts), the node
// hashes (./hashes.ts), and the session model (./review.ts), this module
// computes the recorded state of SPEC 10.4 — the value an item's `baseline`
// and `current` fields hold (10.2) — and the read-time invalidation that
// compares a resolved item's recorded `current` against the current graph.
//
// The per-kind relevant hashes (SPEC 10.4):
//
// - `subtree-coherence` — subtreeHash and metadataHash of each scope node:
//   the scope root and the scope nodes beneath it as last assigned
//   (`ItemStateSpec.scopeDescendants`, the item's stored scope), never a
//   walk of the graph the state is recorded against. SPEC 10.4: a resolve
//   records "its relevant hashes per the list above" while `scope` stays
//   as last assigned — by `create`, a re-derivation (10.5), or a `split`
//   (10.7) — an `updated` resolve recording against the item as
//   re-derived. The scope is "N and all descendants" (10.5, 10.6) as its
//   strategy generated it: in a baseline session over 10.5's links
//   (src/core/path-blocks.ts), so a deleted descendant is a scope node
//   (absent, recorded with the explicit absent marker) and a node a
//   journaled move took out of the subtree is not; in a session without
//   a baseline, the root's current descendants at that assignment. The
//   check judges the recorded nodes alone (below): a node authored
//   beneath the root since the scope was last assigned is no scope node
//   of the item, and one a re-derivation joined to it since `current`
//   was last written has no recorded presence until a resolve records it
//   (10.4) — either way it has no entry and surfaces only through the
//   root's recorded subtreeHash (SPEC 5.5: it changes whenever a node in
//   the subtree is added, removed, or reordered), so a metadata-only edit
//   on it, which changes no subtreeHash (SPEC 5.5), invalidates nothing.
//   A removed scope node surfaces through its own recorded presence and
//   the root's subtreeHash, and a metadata-only edit on a recorded scope
//   node through that node's recorded metadataHash.
// - `parent-consistency` — ownHash and metadataHash of the scope node;
//   subtreeHash of each context node (the branch children, 10.5).
// - `dependency-consistency` — ownHash and metadataHash of the scope node;
//   subtreeHash of each upstream target in context (10.5).
// - `metadata-consistency` — metadataHash of the scope node.
// - `code-impact` — subtreeHash and effectiveHash of each node targeted by
//   the scoped code location's impact edges (9.2: the union of the
//   location's `references` and `embeds` edges in the recorded-baseline
//   graph and in the current graph, identities mapped through the journal).
//   The target set is supplied by the caller (`ReviewStateInputs`), which
//   owns baseline reconstruction — `code-impact` items exist only in
//   baseline sessions (10.5), where the recorded baseline is at hand.
// - `uncovered-requirement` — subtreeHash and metadataHash of the scope
//   node (a coverage item's scope is the node alone, 10.7).
//
// Beyond the relevant hashes, the state records, for every scope, context,
// and origin node, whether the node is present; an absent node's hashes are
// recorded as the explicit absent marker (SPEC 10.4). A node carries hash
// values only where the kind's table lists them — so, e.g., an edit under a
// `subtree-coherence` item's context node (its ancestor chain, whose
// subtreeHashes change on any edit in the file) never invalidates by
// itself, while its deletion, a presence change, does.
//
// Invalidation (SPEC 10.4): a resolved item becomes `invalidated` when its
// recorded state differs from the current graph — a recorded hash changed,
// a recorded presence changed in either direction, or its current context
// set differs from its recorded context set. Each node recorded in
// `current` is judged alone, against the current graph, under the presence
// and the hash names recorded for it (`recordedNodesHold`), whether or not
// the item still names it; a node of the item's scope, context, or origin
// with no recorded entry — one that joined the item after `current` was
// last written, at a re-derivation (10.5) — has no recorded presence until
// a resolve records it and contributes nothing, so a changed origin by
// itself invalidates nothing (10.5). The recorded context set is the
// item's `recordedContext` (src/core/review.ts): the context nodes
// recorded with `current` — at creation, and at each resolve, which
// assigns the item its current context set as `context` and records
// `current` over it (10.4: "the context a read of the same workspace
// presents", review-derive.ts `resolveSessionItem`; an `updated` resolve
// once the re-derivation it triggers is done, against the item as
// re-derived) — and kept, with `current`, where `context` alone is
// reassigned: a re-derivation (10.5) or a `split` reusing the item (10.7).
// The current context set is the one the session's strategy generators,
// re-run with the recorded creation parameters and decompositions against
// the current workspace, assign to the item — callers supply it
// (`ItemValidityInputs`) — and, for an item the generators no longer
// produce, its `context` as last assigned. A node that was already absent
// when the state was recorded does not invalidate by remaining absent —
// the absent marker compares equal — so deletion review stays resolvable
// (SPEC 10.4, 10.2).
//
// Identity policy (src/core/review.ts header; SPEC 10.4, 5.4): sessions
// store every node reference as a canonical identity in the injective key
// encoding of src/core/journal.ts (`<position>:<identity>`). A canonical
// identity never changes as the journal grows, so byte equality of stored
// references is canonical comparison — requirement nodes compare as
// canonical identities and never as reference spellings: a journaled
// rename or move changes no stored reference and no hash wherever the
// operation was pure (SPEC 6.2), so it duplicates no item, discards no
// status, and by itself invalidates nothing, while a spelling vacated by a
// manual deletion (SPEC 6.6) and later recaptured by a journaled rename
// denotes two distinct canonical identities that never collide. The state
// computation here keys its result canonically — every node it records is
// a stored canonical reference: the item's scope (the root and the nodes
// beneath it), context, and origin entries, and the caller-supplied
// impact targets (review-derive.ts canonicalizes every generated node,
// `canonicalizeGeneration`) — and judges presence by canonical resolution
// (SPEC 10.4: "a node is absent when it is deleted or its identity ceases
// to resolve through the journal"): a recorded node is present iff its
// canonical identity still resolves through the journal
// (`resolvesCurrently`) AND the graph holds a node at its derived current
// spelling — never by the spelling lookup alone, which would let a
// dangling reference alias the distinct node that recaptured its
// spelling. Spellings (`currentSpellingOf`, SPEC 6.3) serve presentation
// and, for a resolving reference, the graph, hash, and text lookups. This
// module owns the reference codec seam (`canonicalKeyOfCurrent`,
// `parseReference`, `spellingOfReference`, `resolveReference`) the
// derivation and presentation layers share.
//
// Everything here is pure: item validity is recomputed against the current
// graph on every read (`status`, `next`, `show`, `export`) and never
// persisted — reads never write the session file; sessions change only
// through the mutating subcommands (SPEC 10.4, 13.5). One per-node
// computation (`recordedNodeState`) serves both sides: the mutating
// subcommands record `computeRecordedState`'s result (item creation and
// each resolve, 10.2), and reads judge each recorded node against a fresh
// run of it over the current graph.

import type { WorkspaceGraph } from "./graph.js";
import type { NodeHashes } from "./hashes.js";
import type { CanonicalIdentity, Journal } from "./journal.js";
import {
  currentSpellingOf,
  encodeCanonicalIdentity,
  parseCanonicalIdentity,
  resolvesCurrently,
} from "./journal.js";
import type {
  ItemKind,
  ItemStatus,
  RecordedHashName,
  RecordedNodeState,
  RecordedState,
  ReviewItem,
} from "./review.js";
import { isResolvedStatus, RECORDED_HASH_NAMES } from "./review.js";

// ---------------------------------------------------------------------------
// Computing the recorded state (SPEC 10.4)
// ---------------------------------------------------------------------------

/**
 * The graph state a recorded state is computed against: the (current or
 * baseline) workspace graph and its hashes (SPEC 5.5), keyed by the node
 * identities of that graph.
 */
export interface ReviewStateInputs {
  readonly graph: WorkspaceGraph;
  readonly hashes: ReadonlyMap<string, NodeHashes>;
  /**
   * The full current journal (module header identity policy): stored
   * canonical references decode to their current spellings for graph and
   * hash lookups, and graph-enumerated nodes canonicalize into reference
   * keys.
   */
  readonly journal: Journal;
  /**
   * SPEC 10.4/9.2: per code-location reference, the canonical references of
   * the nodes targeted by the location's impact edges — the union of its
   * `references` and `embeds` edges in the recorded-baseline graph and in
   * this graph. Consulted only for `code-impact` items; callers of sessions
   * that can hold none (`audit`, `coverage`) may omit it.
   */
  readonly impactTargets?: (location: string) => readonly string[];
}

/**
 * The item fields the state computation reads (SPEC 10.4): the kind and the
 * scope — its root and the scope nodes beneath it — context, and origin
 * nodes, each a stored canonical reference (module header). `ReviewItem`
 * satisfies this shape, its scope as last assigned (SPEC 10.4).
 */
export interface ItemStateSpec {
  readonly kind: ItemKind;
  /** The scope node — a `subtree-coherence` item's scope root. */
  readonly scope: string;
  /**
   * The scope nodes beneath the scope root (`ReviewItem.scopeDescendants`:
   * a `subtree-coherence` item's scope is "N and all descendants",
   * SPEC 10.5, 10.6, as its strategy generated it); empty for a leaf and
   * for every other kind, whose scope is its scope node alone.
   */
  readonly scopeDescendants: readonly string[];
  readonly context: readonly string[];
  readonly origin: readonly string[];
}

/**
 * Compute the SPEC 10.4 recorded state of one item against `inputs`: the
 * item's relevant hashes per the kind table (module header) and, for every
 * scope, context, and origin node, whether the node is present — an absent
 * node's hashes recorded as the explicit absent marker. The nodes are the
 * item's as given — its scope (the root and `scopeDescendants`), context,
 * and origin, plus a `code-impact` item's impact targets from `inputs` —
 * so `inputs` supplies each node's presence and hash values, never which
 * nodes are recorded: a node of `inputs`' graph beneath the scope root that
 * the item's scope does not hold gets no entry. This is the value the
 * mutating subcommands record (item creation and each resolve, 10.2: a
 * resolve over the scope as last assigned, SPEC 10.4); reads judge each
 * node it records against the current graph (`recordedNodesHold`).
 */
export function computeRecordedState(
  item: ItemStateSpec,
  inputs: ReviewStateInputs,
): RecordedState {
  // The required hash names per recorded node. Roles merge: a node both in
  // scope and in origin (say) holds one entry with the union of its
  // roles' relevant hashes.
  const required = new Map<string, Set<RecordedHashName>>();
  const record = (identity: string, ...names: RecordedHashName[]): void => {
    let set = required.get(identity);
    if (set === undefined) {
      required.set(identity, (set = new Set()));
    }
    for (const name of names) {
      set.add(name);
    }
  };

  // SPEC 10.4: presence is recorded for every scope, context, and origin
  // node, whatever hashes the kind's table assigns them.
  record(item.scope);
  for (const identity of item.scopeDescendants) {
    record(identity);
  }
  for (const identity of item.context) {
    record(identity);
  }
  for (const identity of item.origin) {
    record(identity);
  }

  switch (item.kind) {
    case "subtree-coherence": {
      // SPEC 10.4: subtreeHash and metadataHash of each scope node — the
      // root and the scope nodes beneath it as given (the scope as last
      // assigned, module header), an absent one recorded with the absent
      // marker (`recordedNodeState`).
      record(item.scope, "subtreeHash", "metadataHash");
      for (const identity of item.scopeDescendants) {
        record(identity, "subtreeHash", "metadataHash");
      }
      break;
    }
    case "parent-consistency":
    case "dependency-consistency": {
      // SPEC 10.4: ownHash and metadataHash of the scope node; subtreeHash
      // of each context node (branch children / upstream targets, 10.5).
      record(item.scope, "ownHash", "metadataHash");
      for (const identity of item.context) {
        record(identity, "subtreeHash");
      }
      break;
    }
    case "metadata-consistency": {
      // SPEC 10.4: metadataHash of the scope node.
      record(item.scope, "metadataHash");
      break;
    }
    case "code-impact": {
      // SPEC 10.4: subtreeHash and effectiveHash of each node targeted by
      // the scoped code location's impact edges (9.2).
      const impactTargets = inputs.impactTargets;
      if (impactTargets === undefined) {
        throw new Error(
          `xspec internal error: the recorded state of a code-impact item ` +
            `(scope ${item.scope}) needs the impact-edge targets ` +
            `(SPEC 10.4, 9.2), but the caller supplied none`,
        );
      }
      for (const identity of impactTargets(item.scope)) {
        record(identity, "subtreeHash", "effectiveHash");
      }
      break;
    }
    case "uncovered-requirement": {
      // SPEC 10.4: subtreeHash and metadataHash of the scope node.
      record(item.scope, "subtreeHash", "metadataHash");
      break;
    }
  }

  const nodes: Record<string, RecordedNodeState> = {};
  for (const [identity, names] of required) {
    nodes[identity] = memoizedNodeState(item, identity, names, inputs);
  }
  return { nodes };
}

/** Per graph state, `memoizedNodeState`'s values by reference and key. */
const NODE_STATES = new WeakMap<
  ReviewStateInputs,
  Map<string, Map<string, RecordedNodeState>>
>();

/**
 * `recordedNodeState`, computed once per graph state (`inputs`, immutable),
 * stored reference, role, and hash-name set — the values it is a function
 * of (the item enters only through whether the reference is a
 * `code-impact` item's scoped location) — so every item recording a node
 * under one graph state shares one state object, and each node is resolved
 * and looked up once rather than once per item holding it: an n-deep
 * section chain's audit items hold O(n²) node entries over n + 1 nodes.
 */
function memoizedNodeState(
  item: Pick<ItemStateSpec, "kind" | "scope">,
  reference: string,
  names: ReadonlySet<RecordedHashName>,
  inputs: ReviewStateInputs,
): RecordedNodeState {
  let byReference = NODE_STATES.get(inputs);
  if (byReference === undefined) {
    byReference = new Map();
    NODE_STATES.set(inputs, byReference);
  }
  let byKey = byReference.get(reference);
  if (byKey === undefined) {
    byKey = new Map();
    byReference.set(reference, byKey);
  }
  let key =
    item.kind === "code-impact" && reference === item.scope ? "location" : "";
  for (const name of RECORDED_HASH_NAMES) {
    if (names.has(name)) key += ` ${name}`;
  }
  let state = byKey.get(key);
  if (state === undefined) {
    state = recordedNodeState(item, reference, names, inputs);
    byKey.set(key, state);
  }
  return state;
}

/** One node's recorded state (SPEC 10.4): presence judged by canonical
 * resolution (module header) — the node is present iff its canonical
 * identity still resolves through the journal AND the graph holds a node
 * at the derived spelling — and the required hash values for a present
 * node, the absent marker otherwise. Hashes are read only for a resolving,
 * present node. */
function recordedNodeState(
  item: Pick<ItemStateSpec, "kind" | "scope">,
  reference: string,
  names: ReadonlySet<RecordedHashName>,
  inputs: ReviewStateInputs,
): RecordedNodeState {
  const { spelling, resolves } = resolveReference(inputs.journal, reference);
  // SPEC 10.2/10.5: only a `code-impact` item's scope is a code location;
  // every other recorded node is a requirement node. A code location has no
  // hash values (SPEC 5.5 hashes requirement nodes), so its state is
  // presence alone.
  if (item.kind === "code-impact" && reference === item.scope) {
    return resolves && inputs.graph.codeLocation(spelling) !== undefined
      ? { present: true, hashes: {} }
      : { present: false, hashes: "absent" };
  }
  if (!resolves || inputs.graph.requirementNode(spelling) === undefined) {
    // SPEC 10.4: absent — deleted, or its identity ceased to resolve
    // through the journal (a dangling reference stays absent even when its
    // derived spelling is borne by a distinct recaptured node); the hashes
    // are the explicit absent marker.
    return { present: false, hashes: "absent" };
  }
  const hashes: Partial<Record<RecordedHashName, string>> = {};
  if (names.size > 0) {
    const nodeHashes = inputs.hashes.get(spelling);
    if (nodeHashes === undefined) {
      // Callers pass validated, fully hashed workspaces (SPEC 12.1, 13.3).
      throw new Error(
        `xspec internal error: no hashes for the recorded node ${spelling}`,
      );
    }
    for (const name of RECORDED_HASH_NAMES) {
      if (names.has(name)) {
        hashes[name] = nodeHashes[name];
      }
    }
  }
  return { present: true, hashes };
}

// ---------------------------------------------------------------------------
// Judging recorded states (SPEC 10.4)
// ---------------------------------------------------------------------------

/**
 * SPEC 10.4: whether every node an item's `current` records still holds
 * against the graph `inputs` describes — each recorded node judged alone,
 * under its recorded presence and the hash names recorded for it: a node
 * recorded absent must still be absent (an already-absent node does not
 * invalidate by remaining absent), and a node recorded present must still
 * be present, each recorded hash value unchanged. A recorded node the item
 * no longer names keeps its entry and is judged all the same. A node with
 * no recorded entry — one that joined the item's scope, context, or origin
 * after `current` was last written (10.5), a descendant authored since, an
 * impact-edge target gained since — contributes nothing: it "has no
 * recorded presence until a resolve records it", so a changed origin by
 * itself invalidates nothing (10.5). Recorded keys are stored canonical
 * references, judged by canonical resolution (module header).
 */
export function recordedNodesHold(
  item: Pick<ReviewItem, "kind" | "scope" | "current">,
  inputs: ReviewStateInputs,
): boolean {
  for (const [reference, recorded] of Object.entries(item.current.nodes)) {
    const names = new Set<RecordedHashName>();
    if (recorded.present) {
      for (const name of RECORDED_HASH_NAMES) {
        if (recorded.hashes[name] !== undefined) {
          names.add(name);
        }
      }
    }
    const now = memoizedNodeState(item, reference, names, inputs);
    if (!recordedNodeStatesEqual(recorded, now)) {
      return false;
    }
  }
  return true;
}

function recordedNodeStatesEqual(
  a: RecordedNodeState,
  b: RecordedNodeState,
): boolean {
  if (!a.present || !b.present) {
    // SPEC 10.4: presence changed in either direction invalidates; two
    // absent markers compare equal (already-absent nodes staying absent do
    // not invalidate).
    return a.present === b.present;
  }
  for (const name of RECORDED_HASH_NAMES) {
    if (a.hashes[name] !== b.hashes[name]) {
      return false;
    }
  }
  return true;
}

/**
 * SPEC 10.4: whether two context sets agree, as sets of node references —
 * the recorded context set (the item's `recordedContext`) against its
 * current one. Both sides are canonical references (module header), so
 * string equality is canonical-identity equality (SPEC 5.4).
 */
export function identitySetsEqual(
  a: readonly string[],
  b: readonly string[],
): boolean {
  const aSet = new Set(a);
  const bSet = new Set(b);
  if (aSet.size !== bSet.size) {
    return false;
  }
  for (const identity of aSet) {
    if (!bSet.has(identity)) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Canonical references (SPEC 5.4, 10.4 — the stored-identity codec seam)
// ---------------------------------------------------------------------------

/**
 * The stored canonical reference of a node identified by a current-graph
 * spelling: its canonical identity against the full journal (SPEC 5.4),
 * encoded as the injective reference key (src/core/journal.ts).
 */
export function canonicalKeyOfCurrent(
  journal: Journal,
  spelling: string,
): string {
  const memo = codecMemo(journal);
  let key = memo.keysOfCurrent.get(spelling);
  if (key === undefined) {
    key = encodeCanonicalIdentity(journal.canonicalIdentity(spelling));
    memo.keysOfCurrent.set(spelling, key);
  }
  return key;
}

/** One journal's codec results (`codecMemo`). */
interface CodecMemo {
  readonly keysOfCurrent: Map<string, string>;
  readonly resolutions: Map<string, ReferenceResolution>;
  readonly resolutionsAt: Map<number, Map<string, ReferenceResolution>>;
}

const CODEC_MEMOS = new WeakMap<Journal, CodecMemo>();

/**
 * The codec seam's results for one journal, by argument
 * (`canonicalKeyOfCurrent`, `resolveReference`, `resolveReferenceAt`):
 * each is a function of the journal — immutable once parsed — and its
 * string arguments alone, so a reference or spelling is decoded once per
 * journal, and every caller shares one string per derived key or spelling.
 * A shared string's hash and identity let the maps and graph lookups keyed
 * by it run in constant time, where a fresh copy per call costs its whole
 * length, and an n-deep section chain's identities are O(n) long and its
 * audit items' node references O(n²).
 */
function codecMemo(journal: Journal): CodecMemo {
  let memo = CODEC_MEMOS.get(journal);
  if (memo === undefined) {
    memo = {
      keysOfCurrent: new Map(),
      resolutions: new Map(),
      resolutionsAt: new Map(),
    };
    CODEC_MEMOS.set(journal, memo);
  }
  return memo;
}

/**
 * Decode a stored canonical reference. Session parsing validates every
 * stored reference (src/core/review.ts), and every internally built key
 * comes from the encoder, so a reference that does not parse here is an
 * internal error, never data.
 */
export function parseReference(reference: string): CanonicalIdentity {
  const canonical = parseCanonicalIdentity(reference);
  if (canonical === null) {
    throw new Error(
      `xspec internal error: ${JSON.stringify(reference)} is not a ` +
        `canonical identity reference`,
    );
  }
  return canonical;
}

/**
 * SPEC 10.4/6.3: a stored reference's current spelling — "the recorded
 * identity mapped forward through the journal (6.3)" — for presentation
 * and graph lookups. Total whether or not the node still resolves; after a
 * recapture the spelling is the recapturing chain's, a distinction the
 * canonical keys keep and the spellings deliberately do not.
 */
export function spellingOfReference(
  journal: Journal,
  reference: string,
): string {
  return resolveReference(journal, reference).spelling;
}

/** A stored reference's current resolution (`resolveReference`). */
export interface ReferenceResolution {
  /** The derived current spelling (SPEC 6.3) — total, presentation-grade
   * whether or not the reference resolves. */
  readonly spelling: string;
  /** SPEC 10.4: whether the canonical identity still resolves through the
   * journal — false exactly when a later entry recaptured the spelling for
   * a different chain. */
  readonly resolves: boolean;
}

/**
 * Resolve a stored reference against the journal (SPEC 10.4): its derived
 * current spelling plus whether its canonical identity still resolves.
 * Every presence or state judgment requires both (module header): a node
 * is present iff `resolves` holds AND the graph holds a node at
 * `spelling` — a dangling reference whose spelling is borne by a distinct
 * recaptured node is absent, while its spelling still names it for
 * presentation.
 */
export function resolveReference(
  journal: Journal,
  reference: string,
): ReferenceResolution {
  const memo = codecMemo(journal);
  let resolution = memo.resolutions.get(reference);
  if (resolution === undefined) {
    const canonical = parseReference(reference);
    resolution = {
      spelling: currentSpellingOf(journal, canonical),
      resolves: resolvesCurrently(journal, canonical),
    };
    memo.resolutions.set(reference, resolution);
  }
  return resolution;
}

/**
 * Resolve a stored reference as of the journal's first `length` entries —
 * the recorded-baseline side of a baseline session, whose journal is that
 * prefix of the current one (SPEC 6.3): the identity the referenced node
 * bore then (its canonical identity mapped forward through the prefix
 * alone), and whether the reference resolves there — `resolveReference`'s
 * round trip, judged against the prefix (SPEC 5.4, 10.4). It does not
 * resolve when the reference's chain begins past the prefix (the node
 * entered the workspace after it) or when, at the prefix, its spelling is
 * borne by a different chain; a baseline-graph lookup then finds no node
 * of this reference.
 */
export function resolveReferenceAt(
  journal: Journal,
  length: number,
  reference: string,
): ReferenceResolution {
  const memo = codecMemo(journal);
  let atLength = memo.resolutionsAt.get(length);
  if (atLength === undefined) {
    atLength = new Map();
    memo.resolutionsAt.set(length, atLength);
  }
  let resolution = atLength.get(reference);
  if (resolution === undefined) {
    resolution = resolveReferenceAtUncached(journal, length, reference);
    atLength.set(reference, resolution);
  }
  return resolution;
}

function resolveReferenceAtUncached(
  journal: Journal,
  length: number,
  reference: string,
): ReferenceResolution {
  const canonical = parseReference(reference);
  if (canonical.position > length) {
    return { spelling: canonical.identity, resolves: false };
  }
  const spelling = journal.mapForward(
    canonical.identity,
    canonical.position,
    length,
  );
  const roundTrip = journal.canonicalIdentity(spelling, length);
  return {
    spelling,
    resolves:
      roundTrip.identity === canonical.identity &&
      roundTrip.position === canonical.position,
  };
}

/**
 * A recorded state as presented (SPEC 10.2: reads report both fields as
 * recorded; 10.4: every recorded node presented under its current
 * identity): each node keyed by its derived current spelling. Where two
 * canonically distinct recorded nodes of the state share a forward-mapped
 * spelling — reachable only when a spelling vacated by a manual deletion
 * was recaptured by a journaled rename — spelling keys would collide and
 * drop a recorded node, so the whole state keeps its stored canonical keys
 * instead: deterministic, injective, and every recorded node presented.
 */
export function presentRecordedState(
  journal: Journal,
  state: RecordedState,
): RecordedState {
  const references = Object.keys(state.nodes);
  const spellings = new Map<string, string>();
  for (const reference of references) {
    spellings.set(reference, spellingOfReference(journal, reference));
  }
  if (new Set(spellings.values()).size !== references.length) {
    return state;
  }
  const nodes: Record<string, RecordedNodeState> = {};
  for (const [reference, node] of Object.entries(state.nodes)) {
    nodes[spellings.get(reference) as string] = node;
  }
  return { nodes };
}

// ---------------------------------------------------------------------------
// Read-time validity (SPEC 10.4)
// ---------------------------------------------------------------------------

/** The inputs of the read-time validity computation (SPEC 10.4). */
export interface ItemValidityInputs {
  /** The current graph state (module header). */
  readonly state: ReviewStateInputs;
  /**
   * SPEC 10.4: the current context sets, by item ID — the context set the
   * session's strategy generators assign to each item when re-run with the
   * session's recorded creation parameters (10.7) and recorded
   * decompositions (10.5, 10.7) against the current workspace, computed
   * without persisting anything, as canonical references (module header).
   * An item the generators no longer produce MUST be absent from the map:
   * its current context set is then its `context` as last assigned.
   */
  readonly currentContexts: ReadonlyMap<string, readonly string[]>;
}

/**
 * SPEC 10.4: the status a read reports for one item. A resolved item
 * (SPEC 10.3) is reported `invalidated` when its recorded state differs
 * from the current graph: a node its `current` records no longer holds —
 * a recorded hash changed, or a recorded presence changed in either
 * direction (`recordedNodesHold`, keyed canonically, module header, so the
 * comparison is the canonical one SPEC 10.4 requires) — or its current
 * context set (`ItemValidityInputs`, else its `context` as last assigned)
 * differs from its recorded context set. An item needing review
 * (`unresolved`, `invalidated`) reports its stored status unchanged. This
 * function never rewrites anything: a stale resolution is reported
 * `invalidated`, never persisted.
 */
export function effectiveItemStatus(
  item: ReviewItem,
  inputs: ItemValidityInputs,
): ItemStatus {
  if (!isResolvedStatus(item.status)) {
    return item.status;
  }
  // SPEC 10.4: "a recorded hash changed, a recorded presence changed in
  // either direction" — over the recorded nodes alone; a node that joined
  // the item since has no recorded presence (10.5).
  if (!recordedNodesHold(item, inputs.state)) {
    return "invalidated";
  }
  // SPEC 10.4: "or its current context set differs from its recorded
  // context set" — the generators' context, else `context` as last
  // assigned, against the context recorded with `current`.
  const currentContext = inputs.currentContexts.get(item.id) ?? item.context;
  if (!identitySetsEqual(item.recordedContext, currentContext)) {
    return "invalidated";
  }
  return item.status;
}

/**
 * SPEC 10.4: read-time validity of every item of a session, by item ID.
 * Every read (`status`, `next`, `show`, `export`) derives statuses through
 * this — a stale resolution is never reported as resolved — and feeds them
 * to the blocking rule (SPEC 10.3, `isItemBlocked`): because `invalidated`
 * is not a resolved status, a blocker that becomes invalidated re-blocks
 * its dependents.
 */
export function deriveEffectiveStatuses(
  items: readonly ReviewItem[],
  inputs: ItemValidityInputs,
): ReadonlyMap<string, ItemStatus> {
  const statuses = new Map<string, ItemStatus>();
  for (const item of items) {
    statuses.set(item.id, effectiveItemStatus(item, inputs));
  }
  return statuses;
}
