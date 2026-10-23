// The metadata pair of a `metadata-consistency` item (SPEC 10.7, 10.5, 5.5).
//
// Pure core (IMPLEMENTATION Architecture: review-session logic is core —
// deterministic, I/O-free). SPEC 10.5 gives a `metadata-consistency` item a
// payload carrying "the node's `d` targets, coverage attribute, and tags
// before and after (10.7)", and 10.7 fixes it: the metadata pair is a
// before/after pair, under the origin-text rule — before, its value in the
// item's baseline state; after, its value in the current graph; a side whose
// graph state does not contain the node presented absent — of the scope
// node's metadata (5.5): its `d` targets, each under its current identity
// (10.4), its coverage attribute, and its tags. `show`, `export`, and
// `next --json` present it through the one payload renderer
// (src/cli/commands/review-session.ts); reads compute it without persisting
// anything (SPEC 10.4).
//
// The item's baseline state (SPEC 10.2) is, in a baseline session, the graph
// at the recorded baseline, which every read of such a session resolves and
// reconstructs (10.7) — and `metadata-consistency` items arise in baseline
// sessions alone (10.5). The stored scope reference resolves there as of the
// baseline journal prefix (`resolveReferenceAt`, SPEC 6.3: the baseline
// journal is a prefix of the current one), never by its current spelling, so
// a node reintroduced under a vacated identity (5.4) cannot alias the
// baseline node; each baseline `d` target is the baseline identity mapped
// forward through the journal entries since the baseline (6.3) — its current
// identity (10.4). A session without a recorded baseline (`audit`,
// `coverage`) generates no such item (10.6, 10.7): one there entered by
// external modification, and the product holds no graph state of its entry
// moment (10.2), so its before side is read from the current graph, the one
// graph state such a read holds.

import { compareBytes } from "./bytes.js";
import type { WorkspaceGraph } from "./graph.js";
import type { Journal } from "./journal.js";
import type { ReferenceResolution } from "./review-state.js";
import { resolveReference, resolveReferenceAt } from "./review-state.js";

/**
 * One side of a metadata pair (SPEC 10.7): the scope node's metadata (5.5)
 * in that side's graph state, or the absent side where the state does not
 * contain the node — carrying no metadata.
 */
export type MetadataSide =
  | { readonly present: false }
  | {
      readonly present: true;
      /**
       * The node's `d`-declared (`depends`) targets (SPEC 5.2, 5.5), each
       * under its current identity (10.4) — one entry per target node (5.2:
       * `depends` edges form a set), in byte order of the presented
       * identity (10.7 fixes no order; 12.0: deterministic).
       */
      readonly d: readonly string[];
      /** The interpreted coverage attribute (SPEC 2.5, 11.2) — null for a
       * root, which carries none (5.5, 12.4). */
      readonly coverage: "required" | "none" | null;
      /** The node's tags as a tag set (SPEC 2.6, 12.7: byte order,
       * duplicates collapsed) — null for a root, which carries none (5.5,
       * 11.4, 12.7). */
      readonly tags: readonly string[] | null;
    };

/** A `metadata-consistency` item's metadata pair (SPEC 10.7). */
export interface MetadataPair {
  readonly before: MetadataSide;
  readonly after: MetadataSide;
}

/** The current graph state a read holds: the graph and the full current
 * journal (the stored-reference codec, src/core/review-state.ts). */
export interface MetadataCurrentSide {
  readonly graph: WorkspaceGraph;
  readonly journal: Journal;
}

/** The recorded-baseline graph state a baseline session's read holds
 * (SPEC 10.2, 10.7): the baseline graph and the baseline journal's length,
 * a prefix of the current journal (6.3). */
export interface MetadataBaselineSide {
  readonly graph: WorkspaceGraph;
  readonly journalLength: number;
}

/**
 * SPEC 10.7: the metadata pair of the item whose stored scope reference is
 * `scope` — before from the item's baseline state (the recorded-baseline
 * graph `baseline`; the current graph for a session without one, module
 * header), after from the current graph.
 */
export function metadataPairOf(
  scope: string,
  current: MetadataCurrentSide,
  baseline: MetadataBaselineSide | undefined,
): MetadataPair {
  // SPEC 10.4: presence by canonical resolution — a dangling reference is
  // absent even where a distinct node bears its spelling now.
  const after = metadataSide(
    current.graph,
    resolveReference(current.journal, scope),
    (identity) => identity,
  );
  if (baseline === undefined) {
    return { before: after, after };
  }
  const length = baseline.journalLength;
  const before = metadataSide(
    baseline.graph,
    resolveReferenceAt(current.journal, length, scope),
    // SPEC 6.3, 10.4: a baseline identity's current identity — mapped
    // forward through the journal entries since the baseline.
    (identity) => current.journal.mapForward(identity, length),
  );
  return { before, after };
}

/** One side over one graph state: the node the resolution names there, if
 * it resolves to a node of that graph, else the absent side. `presented`
 * maps a target identity of that graph to its current identity. */
function metadataSide(
  graph: WorkspaceGraph,
  resolution: ReferenceResolution,
  presented: (identity: string) => string,
): MetadataSide {
  const node = resolution.resolves
    ? graph.requirementNode(resolution.spelling)
    : undefined;
  if (node === undefined) {
    return { present: false };
  }
  const d: string[] = [];
  for (const edge of graph.outgoingEdges(node.identity)) {
    if (edge.kind === "depends") {
      d.push(presented(edge.target));
    }
  }
  d.sort(compareBytes);
  // SPEC 5.5: a root node has no `d` targets, no coverage attribute, and no
  // tags; its section's coverage is null, and its tags are structurally
  // absent (11.4, 12.7), never an empty set.
  return {
    present: true,
    d,
    coverage: node.section.coverage,
    tags: node.id === null ? null : [...node.section.tags],
  };
}
