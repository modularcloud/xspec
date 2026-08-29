// In-harness coverage-reachability oracle (TEST-SPEC 16 P-13, 17 S-6): an
// independent implementation of SPEC.md 8.1's required set and SPEC.md 8's
// reachability, used to compute the expected `xspec coverage` result — the
// required, covered, uncovered, and ignored sets, exclusion reasons and one
// shortest covering path per covered node included (8.2, 12.0) — for the
// P-13 property tests. Per S-6, the oracle passes its fixed vector suite
// (test/self/s6-coverage-oracle.test.ts) — derived from SPEC.md 15's worked
// workspace and its transitive-coverage statement — before any property test
// trusts it. Harness machinery only: pure functions, no product imports, no
// I/O, no test-framework dependence.
//
// The oracle parses nothing and resolves no configuration. Its callers — the
// P-13 workspace/profile generator, the S-6 vectors — constructed the
// workspace, so they know its graph and its group memberships: the input is
// the graph (every node with its root flag, contains-children, coverage
// attribute, and tags; the dependency edges with their kinds) plus the
// resolved profile ingredients — the target group's nodes, the boundary
// group's nodes (each group's full membership, roots included: the group
// lists mirror 7.1/7.2 discovery, and the coverage-scoped root exclusions
// below are the oracle's own job), and the profile's `mode`, `targets`,
// `targetTags`, and `edgeKinds`. Feeding the oracle the caller's own
// structure rather than the product's graph output is what keeps it
// independent (P-13: "an independent oracle").
//
// SPEC.md 8/8.1/8.2 (with 7.4's vocabulary and 12.0's tie-break), as
// implemented here:
//
// * Required set (8.1): the nodes of the target group, restricted to nodes
//   carrying at least one `targetTags` tag when `targetTags` is present and
//   to childless nodes when `targets` is `"leaves"` (7.4), excluding nodes
//   marked `coverage="none"` (2.5 — per node: descendants retain their own
//   behavior) and always excluding root nodes.
// * Ignored set (8.2): the target group's nodes excluded from the required
//   set, each with all applicable exclusion reasons in the fixed order —
//   root node, `coverage="none"`, non-leaf under `targets: "leaves"`,
//   lacking every `targetTags` tag. A root carries no coverage attribute and
//   no tags (5.5, guarded), so beside `root` it can carry `non-leaf` (when
//   it has children under `targets: "leaves"`) and `lacking-tags` (whenever
//   `targetTags` is present), never `coverage-none`.
// * Coverage (8): a required node is covered when a permitted path exists
//   from a boundary node to it — a single edge in `direct` mode, a path of
//   one or more edges in `transitive` mode (boundary membership alone is no
//   such path), using only the profile's `edgeKinds`. `contains` edges never
//   grant coverage and never appear in paths (children are input, and the
//   reachability walk never consults them). Root nodes never appear in
//   coverage paths — not as boundary node (the boundary group contributes
//   only its non-root members), intermediate, or target: an edge whose
//   source or target is a root never extends a covering path.
// * Reported path (8.2, 12.0): per covered node one shortest covering path,
//   boundary node first, target last; among equal-length shortest paths the
//   least by element-wise comparison of the node-identity sequences, each
//   element compared byte-wise as UTF-8 (12.0). The minimum is computed
//   greedily over dist-to-target levels: fixing a least prefix that extends
//   to a shortest path never forfeits a smaller completion, because the
//   element-wise comparison is decided at the first differing position.
// * Counts (8.2): the sizes of the four sets; required = covered ∪
//   uncovered by construction.
//
// Result arrays are sorted by identity bytes (SPEC 8.2 fixes membership and
// per-node information, not row order; callers comparing against a product
// report sort its rows the same way). The ignored-reason tokens are the
// harness's canonical `IGNORED_REASON_KINDS` spellings
// (test/helpers/adapters/reports.ts) — structurally identical literals, kept
// local so the oracle stays free of the adapter layer.
//
// Misuse guards (H-8) — each throws a plain error, a harness defect, never a
// diagnosed product failure: an identity without a node entry (as a child,
// an edge endpoint, or a group member); a duplicate group member (groups are
// sets); a self-edge or a cycle in the combined contains/depends/embeds
// graph (5.3 — such a workspace fails `build`, so it is outside P-13's input
// space; `references` edges cannot cycle: only code locations source them
// and no edge targets a code location); a root carrying tags or a coverage
// attribute (5.5: roots have neither); an empty `edgeKinds` or `targetTags`
// list (a configuration error, 14.14 — coverage never evaluates it).

import { Buffer } from "node:buffer";

// ---------------------------------------------------------------------------
// Input and output model

/** The dependency edge kinds (SPEC 5.2; 7.4's `edgeKinds` universe). */
export const COVERAGE_ORACLE_EDGE_KINDS = [
  "depends",
  "embeds",
  "references",
] as const;
export type CoverageOracleEdgeKind =
  (typeof COVERAGE_ORACLE_EDGE_KINDS)[number];

/** One graph node (requirement node or code location) the oracle sees. */
export interface CoverageOracleNode {
  /** A file's implicit root requirement node (SPEC 1.2)? Code: never. */
  readonly root: boolean;
  /**
   * Direct child identities in document order (`contains`, SPEC 5.2) — the
   * leaf judgment of 7.4 (`"leaves"` = no children) and never anything
   * else: the reachability walk does not consult children (8: `contains`
   * never grants coverage). Code locations carry none.
   */
  readonly children: readonly string[];
  /**
   * The node's spelled coverage attribute (SPEC 2.5), `null` where none is
   * spelled (the default is coverage-required). Roots carry `null` (5.5).
   */
  readonly coverage: "required" | "none" | null;
  /** The node's tags (SPEC 2.6, deduplicated). Roots carry none (5.5). */
  readonly tags: readonly string[];
}

/** One dependency edge (SPEC 5.2). Duplicates collapse (edges are sets). */
export interface CoverageOracleEdge {
  readonly source: string;
  readonly target: string;
  readonly kind: CoverageOracleEdgeKind;
}

/**
 * The resolved profile ingredients (SPEC 7.4) the required-set and
 * reachability rules consume. Optional members take 7.4's documented
 * defaults; group membership arrives as the separate input lists.
 */
export interface CoverageOracleProfile {
  /** `"direct"` or `"transitive"` (7.4, 8). */
  readonly mode: "direct" | "transitive";
  /** `"leaves"` (the 7.4 default when omitted) or `"all"`. */
  readonly targets?: "leaves" | "all";
  /**
   * The `targetTags` restriction; omitted or `null` = absent. An empty list
   * is a configuration error (14.14) and a misuse here.
   */
  readonly targetTags?: readonly string[] | null;
  /**
   * The permitted edge kinds; omitted = all three (the 7.4 default). An
   * empty list is a configuration error (14.14) and a misuse here.
   */
  readonly edgeKinds?: readonly CoverageOracleEdgeKind[];
}

/** The oracle's whole input (module header). */
export interface CoverageOracleInput {
  /** Every graph node, keyed by identity. */
  readonly nodes: ReadonlyMap<string, CoverageOracleNode>;
  /** Every dependency edge (root-sourced and root-targeted ones included). */
  readonly edges: readonly CoverageOracleEdge[];
  /** The target group's full membership, roots included (7.1, 8.2). */
  readonly targetGroup: readonly string[];
  /** The boundary group's full membership, roots included (7.1/7.2, 8). */
  readonly boundaryGroup: readonly string[];
  readonly profile: CoverageOracleProfile;
}

/**
 * SPEC 8.2's exclusion-reason identities, in the fixed reporting order —
 * the harness's canonical tokens (module header).
 */
export const COVERAGE_IGNORED_REASONS = [
  "root",
  "coverage-none",
  "non-leaf",
  "lacking-tags",
] as const;
export type CoverageIgnoredReason = (typeof COVERAGE_IGNORED_REASONS)[number];

/** One covered node: its identity and its one shortest covering path. */
export interface CoverageOracleCoveredRow {
  readonly identity: string;
  /** Boundary node first, target last (8.2, 12.0 tie-break). */
  readonly path: readonly string[];
}

/** One ignored node: all applicable reasons in the fixed order (8.2). */
export interface CoverageOracleIgnoredRow {
  readonly identity: string;
  readonly reasons: readonly CoverageIgnoredReason[];
}

/** The expected result of one profile's coverage run (8.2). */
export interface CoverageOracleResult {
  readonly counts: {
    readonly required: number;
    readonly covered: number;
    readonly uncovered: number;
    readonly ignored: number;
  };
  /** The required set (8.1), identity-byte order. */
  readonly required: readonly string[];
  /** The covered rows, identity-byte order. */
  readonly covered: readonly CoverageOracleCoveredRow[];
  /** The uncovered identities (required minus covered), byte order. */
  readonly uncovered: readonly string[];
  /** The ignored rows (target group minus required), identity-byte order. */
  readonly ignored: readonly CoverageOracleIgnoredRow[];
}

// ---------------------------------------------------------------------------
// Internals

function misuse(message: string): never {
  throw new Error(`coverage oracle misuse: ${message}`);
}

/** Byte-wise UTF-8 comparison (SPEC 12.0). */
function compareBytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function byteLeast(values: Iterable<string>): string | undefined {
  let least: string | undefined;
  for (const value of values) {
    if (least === undefined || compareBytes(value, least) < 0) least = value;
  }
  return least;
}

/** Resolve an identity to its node, or throw the incomplete-graph misuse. */
function nodeAt(
  nodes: ReadonlyMap<string, CoverageOracleNode>,
  identity: string,
  role: string,
): CoverageOracleNode {
  const node = nodes.get(identity);
  if (node === undefined) {
    misuse(
      `no node for ${identity} (${role}) — every child identity, edge ` +
        `endpoint, and group member must have a node entry`,
    );
  }
  return node;
}

/** Validate and deduplicate one group's membership (groups are sets). */
function groupSet(
  nodes: ReadonlyMap<string, CoverageOracleNode>,
  members: readonly string[],
  label: string,
): Set<string> {
  const set = new Set<string>();
  for (const identity of members) {
    nodeAt(nodes, identity, `a member of the ${label} group`);
    if (set.has(identity)) {
      misuse(
        `duplicate ${label}-group member ${identity} — a group's nodes ` +
          `form a set`,
      );
    }
    set.add(identity);
  }
  return set;
}

/**
 * Misuse-guard the combined contains/depends/embeds graph against cycles
 * (SPEC 5.3): such a workspace fails validation and is outside the oracle's
 * input space. `references` edges are excluded per 5.3 (they cannot cycle:
 * only code locations source them and no edge targets a code location).
 */
function guardAcyclic(
  nodes: ReadonlyMap<string, CoverageOracleNode>,
  edges: readonly CoverageOracleEdge[],
): void {
  const successors = new Map<string, Set<string>>();
  for (const identity of nodes.keys()) successors.set(identity, new Set());
  for (const [identity, node] of nodes) {
    for (const child of node.children) {
      nodeAt(nodes, child, `a child of ${identity}`);
      successors.get(identity)?.add(child);
    }
  }
  for (const edge of edges) {
    if (edge.kind === "references") continue;
    successors.get(edge.source)?.add(edge.target);
  }
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (identity: string): void => {
    if (done.has(identity)) return;
    if (visiting.has(identity)) {
      misuse(
        `contains/depends/embeds cycle through ${identity} — workspace ` +
          `graphs are acyclic (SPEC 5.3)`,
      );
    }
    visiting.add(identity);
    for (const next of successors.get(identity) ?? []) visit(next);
    visiting.delete(identity);
    done.add(identity);
  };
  for (const identity of nodes.keys()) visit(identity);
}

// ---------------------------------------------------------------------------
// The oracle

/**
 * Compute one profile's expected `xspec coverage` result per SPEC 8, 8.1,
 * and 8.2 with the 12.0 shortest-path tie-break (module header): the
 * required, covered (with one shortest covering path each), uncovered, and
 * ignored (with all applicable exclusion reasons in the fixed order) sets,
 * plus the four counts.
 */
export function computeCoverage(
  input: CoverageOracleInput,
): CoverageOracleResult {
  const { nodes, edges, profile } = input;

  // --- input contract (module header) --------------------------------------
  for (const [identity, node] of nodes) {
    if (node.root && (node.tags.length > 0 || node.coverage !== null)) {
      misuse(
        `root node ${identity} carries tags or a coverage attribute — a ` +
          `root has neither (SPEC 5.5)`,
      );
    }
  }
  for (const edge of edges) {
    nodeAt(nodes, edge.source, `the source of a ${edge.kind} edge`);
    nodeAt(nodes, edge.target, `the target of a ${edge.kind} edge`);
    if (edge.source === edge.target) {
      misuse(
        `self-edge on ${edge.source} — a node that depends on or embeds ` +
          `itself is a dependency cycle of length one (SPEC 5.3)`,
      );
    }
  }
  guardAcyclic(nodes, edges);
  const targetMembers = groupSet(nodes, input.targetGroup, "target");
  const boundaryMembers = groupSet(nodes, input.boundaryGroup, "boundary");

  const targets = profile.targets ?? "leaves";
  const edgeKinds = profile.edgeKinds ?? COVERAGE_ORACLE_EDGE_KINDS;
  if (edgeKinds.length === 0) {
    misuse(
      `empty edgeKinds — a configuration error (SPEC 7.4, 14.14) coverage ` +
        `never evaluates`,
    );
  }
  const targetTags =
    profile.targetTags === undefined || profile.targetTags === null
      ? null
      : profile.targetTags;
  if (targetTags !== null && targetTags.length === 0) {
    misuse(
      `empty targetTags — a configuration error (SPEC 7.4, 14.14) coverage ` +
        `never evaluates`,
    );
  }

  // --- required and ignored sets (8.1, 8.2) --------------------------------
  const tagSet = targetTags === null ? null : new Set(targetTags);
  const reasonsFor = (identity: string): CoverageIgnoredReason[] => {
    const node = nodeAt(nodes, identity, "a target-group member");
    const reasons: CoverageIgnoredReason[] = [];
    if (node.root) reasons.push("root");
    if (node.coverage === "none") reasons.push("coverage-none");
    if (targets === "leaves" && node.children.length > 0) {
      reasons.push("non-leaf");
    }
    if (tagSet !== null && !node.tags.some((tag) => tagSet.has(tag))) {
      reasons.push("lacking-tags");
    }
    return reasons;
  };
  const required: string[] = [];
  const ignored: CoverageOracleIgnoredRow[] = [];
  for (const identity of targetMembers) {
    const reasons = reasonsFor(identity);
    if (reasons.length === 0) required.push(identity);
    else ignored.push({ identity, reasons });
  }
  required.sort(compareBytes);
  ignored.sort((a, b) => compareBytes(a.identity, b.identity));

  // --- permitted reachability structure (8) --------------------------------
  // Boundary nodes: the boundary group's non-root members (8). Permitted
  // steps: dependency edges of the profile's kinds with no root endpoint —
  // a root is never boundary node, intermediate, or target of a path.
  const boundary = new Set(
    [...boundaryMembers].filter(
      (identity) => !nodeAt(nodes, identity, "a boundary-group member").root,
    ),
  );
  const kindSet = new Set<CoverageOracleEdgeKind>(edgeKinds);
  const forward = new Map<string, Set<string>>();
  const backward = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!kindSet.has(edge.kind)) continue;
    if (nodes.get(edge.source)?.root === true) continue;
    if (nodes.get(edge.target)?.root === true) continue;
    let out = forward.get(edge.source);
    if (out === undefined) forward.set(edge.source, (out = new Set()));
    out.add(edge.target);
    let into = backward.get(edge.target);
    if (into === undefined) backward.set(edge.target, (into = new Set()));
    into.add(edge.source);
  }

  /**
   * The unique reported covering path for one required node, or `null`
   * where none exists: shortest from any boundary node (one edge in
   * `direct` mode, one or more in `transitive`), ties by element-wise
   * byte comparison (8, 8.2, 12.0 — module header).
   */
  const coveringPath = (target: string): string[] | null => {
    if (profile.mode === "direct") {
      const sources = backward.get(target);
      if (sources === undefined) return null;
      const least = byteLeast(
        [...sources].filter((source) => boundary.has(source)),
      );
      return least === undefined ? null : [least, target];
    }
    // Transitive: distance-to-target levels by reverse BFS, then a greedy
    // byte-least descent along strictly decreasing distances.
    const dist = new Map<string, number>([[target, 0]]);
    let frontier = [target];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const identity of frontier) {
        const level = dist.get(identity) ?? 0;
        for (const source of backward.get(identity) ?? []) {
          if (dist.has(source)) continue;
          dist.set(source, level + 1);
          next.push(source);
        }
      }
      frontier = next;
    }
    const starts = [...boundary].filter(
      (identity) => identity !== target && dist.has(identity),
    );
    if (starts.length === 0) return null;
    const startDistance = Math.min(
      ...starts.map((identity) => dist.get(identity) ?? Number.NaN),
    );
    const path = [
      byteLeast(
        starts.filter((identity) => dist.get(identity) === startDistance),
      ) as string,
    ];
    for (let remaining = startDistance - 1; remaining >= 0; remaining -= 1) {
      const current = path[path.length - 1] as string;
      const next = byteLeast(
        [...(forward.get(current) ?? [])].filter(
          (identity) => dist.get(identity) === remaining,
        ),
      );
      if (next === undefined) {
        throw new Error(
          `coverage oracle internal error: no distance-${String(remaining)} ` +
            `successor of ${current} on a shortest path to ${target}`,
        );
      }
      path.push(next);
    }
    return path;
  };

  // --- covered and uncovered (8, 8.2) --------------------------------------
  const covered: CoverageOracleCoveredRow[] = [];
  const uncovered: string[] = [];
  for (const identity of required) {
    const path = coveringPath(identity);
    if (path === null) uncovered.push(identity);
    else covered.push({ identity, path });
  }

  return {
    counts: {
      required: required.length,
      covered: covered.length,
      uncovered: uncovered.length,
      ignored: ignored.length,
    },
    required,
    covered,
    uncovered,
    ignored,
  };
}
