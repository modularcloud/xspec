// S-6 baseline graph-diff-oracle vectors (TEST-SPEC 17 S-6): the in-harness
// graph-diff oracle for P-6 (test/helpers/oracles/graph-diff.ts) passes this
// fixed vector suite, derived from SPEC.md 5.6's three worked examples plus
// the added/deleted convention of TEST-SPEC T5.6-6, before any property test
// trusts it. Every vector's category table is hand-computed; no product is
// involved (the product's own 5.6 behavior is asserted by the suite's
// T5.6-* tests against fixtures, not against this oracle).
//
// Coverage, by the worked material the vectors derive from:
//   * 5.6's first worked example (T5.6-1's shapes): a single leaf-text edit
//     — the leaf `changed`; every ancestor `descendant-changed`; sibling
//     subtrees uncategorized; dependents of nodes on the path and those
//     dependents' ancestors `upstream-changed`; the leaf the sole
//     originating node ("all attributed to the leaf");
//   * 5.6's second worked example (T5.6-2's shapes): a child added and a
//     child removed — C `changed` (added or deleted), P `changed` and
//     `descendant-changed`, P's ancestors `descendant-changed`, and the
//     upstream cascade to each parent's dependents, with no
//     `upstream-changed` on the parents' own ancestor chains (no
//     dependency-edge cause);
//   * 5.6's third worked example (T5.6-3's shapes): `d`-target edits — D
//     `metadata-changed`; no node `changed` or `descendant-changed`; every
//     node whose effective state changed (ancestors, dependents, their
//     dependents, and their ancestors, transitively) `upstream-changed` —
//     plus its closing sentence (T5.6-4's shapes): a coverage/tags-only
//     metadata edit changes no effective state and propagates no category;
//   * T5.6-6's added/deleted convention: an added and a deleted
//     file-and-subtree whose roots carry `d` targets (one to a node also
//     edited since the baseline), coverage, tags, children, and an
//     embedding — every added and every deleted node exactly `changed`,
//     the deleted ones flagged deleted under their baseline identities;
//   * the documented one-sided tolerances (the oracle's module header):
//     a relocated non-originating member with a dependency cause, and
//     edge-bearing added/deleted members under kept ancestors, each
//     predicting `upstream-changed` as tolerated-optional;
//   * the relocation tolerance (opt-in, `relocatedOriginators:
//     "tolerate"`, the path-blocks oracle's — P-16, S-6), on T10.5-9's
//     present-node shapes: the move of `P1.M` under `P2` and then its
//     child's deletion, the moved node `changed` — refused by default, and
//     under the option `descendant-changed` tolerated-optional on its two
//     one-sided holders and required on its both-sides holder and on the
//     moved node itself; the twin stopping before the deletion (no
//     relocated originator) predicted alike under either setting; and a
//     holder of a relocated changed node and of a changed node it holds on
//     both sides, the latter's `descendant-changed` required, with an added
//     node below the relocated one;
// and on every vector the hash facts beside the categories (the oracle's
// module header): the kept nodes whose subtreeHash and effectiveHash
// changed, hand-computed from SPEC 5.5's recursions, and an empty
// `optionalDescendant` wherever the default guard admits the input;
// plus misuse guards: relocated originators, an ownKey not covering the
// child tokens, incomplete graphs, contains/dependency cycles, and an
// unknown relocation setting throw plain errors (harness defects), never
// diagnosed product failures.

import { expect, test } from "vitest";
import { computeGraphDiff } from "../helpers/oracles/graph-diff.js";
import type {
  GraphDiff,
  GraphDiffNode,
  GraphDiffSide,
} from "../helpers/oracles/graph-diff.js";

// --- vector-side graph builder -----------------------------------------------

interface NodeSpec {
  /** Direct child identities in document order. */
  readonly children?: readonly string[];
  /** The node's own text runs, standing in for every content byte (1.6). */
  readonly own?: string;
  /** `d`-declared dependency targets (metadata and edges, SPEC 2.2, 5.5). */
  readonly d?: readonly string[];
  /** `text(...)` embedding targets (own-content tokens and edges, 2.3). */
  readonly embeds?: readonly string[];
  /** Coverage/tags stand-in (a metadataHash input beside the `d` set). */
  readonly meta?: string;
}

/**
 * Build one side from per-node specs, deriving the opaque keys exactly as
 * SPEC 5.5 frames the hash preimages: own content covers the runs plus the
 * child and embedding reference tokens at their positions; metadata covers
 * the `d`-target set, coverage, and tags; the pair multiset carries one
 * entry per dependency edge, `depends` and `embeds` alike.
 */
function graph(nodes: Record<string, NodeSpec>): GraphDiffSide {
  const side = new Map<string, GraphDiffNode>();
  for (const [identity, spec] of Object.entries(nodes)) {
    const children = spec.children ?? [];
    const d = [...(spec.d ?? [])].sort();
    const embeds = [...(spec.embeds ?? [])].sort();
    side.set(identity, {
      children,
      ownKey: JSON.stringify([spec.own ?? "", children, embeds]),
      metaKey: JSON.stringify([d, spec.meta ?? ""]),
      pairKey: JSON.stringify([...d, ...embeds].sort()),
      edgeTargets: [...new Set([...d, ...embeds])].sort(),
    });
  }
  return side;
}

// --- expectation helpers -----------------------------------------------------

/** The full required-category table as plain JSON (sorted members). */
function tableOf(diff: GraphDiff): Record<string, string[]> {
  const table: Record<string, string[]> = {};
  for (const [identity, categories] of diff.required) {
    table[identity] = [...categories].sort();
  }
  return table;
}

function sortedSet(values: ReadonlySet<string>): string[] {
  return [...values].sort();
}

// =============================================================================
// 5.6's first worked example: a single edit to a leaf's text (T5.6-1 shapes)
// =============================================================================

const TREE = "specs/Tree.mdx";
const TOP = "specs/Tree.mdx#top";
const MID = "specs/Tree.mdx#top.mid";
const LEAF = "specs/Tree.mdx#top.mid.leaf";
const SIB = "specs/Tree.mdx#top.mid.sib";
const SIB_INNER = "specs/Tree.mdx#top.mid.sib.inner";
const OTHER = "specs/Tree.mdx#top.other";
const DEPS = "specs/Deps.mdx";
const ONLEAF = "specs/Deps.mdx#onleaf";
const ONLEAF_DEP = "specs/Deps.mdx#onleaf.dep";
const ONMID = "specs/Deps.mdx#onmid";
const ONMID_DEP = "specs/Deps.mdx#onmid.dep";

/** The leaf-edit workspace, parameterized by the leaf's text run. */
const leafEditSide = (leafText: string): GraphDiffSide =>
  graph({
    [TREE]: { children: [TOP] },
    [TOP]: { own: "Top text.", children: [MID, OTHER] },
    [MID]: { own: "Mid text.", children: [LEAF, SIB] },
    [LEAF]: { own: leafText },
    [SIB]: { own: "Sibling text.", children: [SIB_INNER] },
    [SIB_INNER]: { own: "Inner sibling text." },
    [OTHER]: { own: "Other subtree text." },
    [DEPS]: { children: [ONLEAF, ONMID] },
    [ONLEAF]: { own: "On-leaf holder text.", children: [ONLEAF_DEP] },
    [ONLEAF_DEP]: { own: "Depends on the edited leaf.", d: [LEAF] },
    [ONMID]: { own: "On-mid holder text.", children: [ONMID_DEP] },
    [ONMID_DEP]: { own: "Depends on an ancestor on the path.", d: [MID] },
  });

test("S-6 (5.6 leaf edit): leaf changed; ancestors descendant-changed; siblings uncategorized; dependents of path nodes and their ancestors upstream-changed; the leaf the sole originator", () => {
  const diff = computeGraphDiff(
    leafEditSide("Leaf text v1."),
    leafEditSide("Leaf text v2."),
  );
  expect(sortedSet(diff.added)).toEqual([]);
  expect(sortedSet(diff.deleted)).toEqual([]);
  expect(sortedSet(diff.optionalUpstream)).toEqual([]);
  expect(sortedSet(diff.optionalDescendant)).toEqual([]);
  // "all attributed to the leaf": the attribution bound is exactly the leaf.
  expect(sortedSet(diff.originators)).toEqual([LEAF]);
  // Hash facts: the path's subtreeHashes; beside them every dependent's and
  // its ancestors' effectiveHashes (SPEC 5.5).
  expect(sortedSet(diff.subtreeChanged)).toEqual([LEAF, MID, TOP, TREE].sort());
  expect(sortedSet(diff.effectiveChanged)).toEqual(
    [LEAF, MID, TOP, TREE, ONLEAF_DEP, ONLEAF, ONMID_DEP, ONMID, DEPS].sort(),
  );
  expect(tableOf(diff)).toEqual({
    [LEAF]: ["changed"],
    [MID]: ["descendant-changed"],
    [TOP]: ["descendant-changed"],
    [TREE]: ["descendant-changed"],
    [SIB]: [],
    [SIB_INNER]: [],
    [OTHER]: [],
    [ONLEAF_DEP]: ["upstream-changed"],
    [ONLEAF]: ["upstream-changed"],
    [ONMID_DEP]: ["upstream-changed"],
    [ONMID]: ["upstream-changed"],
    [DEPS]: ["upstream-changed"],
  });
});

// =============================================================================
// 5.6's second worked example: a child added and a child removed (T5.6-2)
// =============================================================================

const ADD = "specs/Add.mdx";
const WRAP = "specs/Add.mdx#wrap";
const P_ADD = "specs/Add.mdx#wrap.parent";
const OLD = "specs/Add.mdx#wrap.parent.old";
const NEW = "specs/Add.mdx#wrap.parent.new";
const ADD_DEPS = "specs/AddDeps.mdx";
const HOLDADD = "specs/AddDeps.mdx#holdadd";
const HOLDADD_DEP = "specs/AddDeps.mdx#holdadd.dep";
const REM = "specs/Rem.mdx";
const WRAP2 = "specs/Rem.mdx#wrap2";
const P_REM = "specs/Rem.mdx#wrap2.parent2";
const KEEP = "specs/Rem.mdx#wrap2.parent2.keep";
const GONE = "specs/Rem.mdx#wrap2.parent2.gone";
const REM_DEPS = "specs/RemDeps.mdx";
const HOLDREM = "specs/RemDeps.mdx#holdrem";
const HOLDREM_DEP = "specs/RemDeps.mdx#holdrem.dep";

const childArmsSide = (withNew: boolean, withGone: boolean): GraphDiffSide =>
  graph({
    [ADD]: { children: [WRAP] },
    [WRAP]: { own: "Wrap text.", children: [P_ADD] },
    [P_ADD]: {
      own: "Parent text.",
      children: withNew ? [OLD, NEW] : [OLD],
    },
    [OLD]: { own: "Existing child text." },
    ...(withNew ? { [NEW]: { own: "Added child text." } } : {}),
    [ADD_DEPS]: { children: [HOLDADD] },
    [HOLDADD]: { own: "Add-side holder text.", children: [HOLDADD_DEP] },
    [HOLDADD_DEP]: { own: "Depends on the gaining parent.", d: [P_ADD] },
    [REM]: { children: [WRAP2] },
    [WRAP2]: { own: "Wrap-two text.", children: [P_REM] },
    [P_REM]: {
      own: "Parent-two text.",
      children: withGone ? [KEEP, GONE] : [KEEP],
    },
    [KEEP]: { own: "Kept child text." },
    ...(withGone ? { [GONE]: { own: "Removed child text." } } : {}),
    [REM_DEPS]: { children: [HOLDREM] },
    [HOLDREM]: { own: "Remove-side holder text.", children: [HOLDREM_DEP] },
    [HOLDREM_DEP]: { own: "Depends on the losing parent.", d: [P_REM] },
  });

test("S-6 (5.6 child add/remove): C changed as added or deleted, P changed and descendant-changed, P's ancestors descendant-changed only, and each parent's dependents upstream-changed", () => {
  const diff = computeGraphDiff(
    childArmsSide(false, true),
    childArmsSide(true, false),
  );
  expect(sortedSet(diff.added)).toEqual([NEW]);
  expect(sortedSet(diff.deleted)).toEqual([GONE]);
  expect(sortedSet(diff.optionalUpstream)).toEqual([]);
  expect(sortedSet(diff.optionalDescendant)).toEqual([]);
  expect(sortedSet(diff.originators)).toEqual([NEW, P_ADD, GONE, P_REM].sort());
  // Hash facts over kept nodes alone: each parent and its ancestors in both
  // hashes, each parent's dependents and their ancestors in effectiveHash.
  expect(sortedSet(diff.subtreeChanged)).toEqual(
    [P_ADD, WRAP, ADD, P_REM, WRAP2, REM].sort(),
  );
  expect(sortedSet(diff.effectiveChanged)).toEqual(
    [
      P_ADD,
      WRAP,
      ADD,
      HOLDADD_DEP,
      HOLDADD,
      ADD_DEPS,
      P_REM,
      WRAP2,
      REM,
      HOLDREM_DEP,
      HOLDREM,
      REM_DEPS,
    ].sort(),
  );
  expect(tableOf(diff)).toEqual({
    // Add arm.
    [NEW]: ["changed"],
    [P_ADD]: ["changed", "descendant-changed"],
    [WRAP]: ["descendant-changed"],
    [ADD]: ["descendant-changed"],
    [OLD]: [],
    [HOLDADD_DEP]: ["upstream-changed"],
    [HOLDADD]: ["upstream-changed"],
    [ADD_DEPS]: ["upstream-changed"],
    // Remove arm: the removed child under its baseline identity.
    [GONE]: ["changed"],
    [P_REM]: ["changed", "descendant-changed"],
    [WRAP2]: ["descendant-changed"],
    [REM]: ["descendant-changed"],
    [KEEP]: [],
    [HOLDREM_DEP]: ["upstream-changed"],
    [HOLDREM]: ["upstream-changed"],
    [REM_DEPS]: ["upstream-changed"],
  });
});

// =============================================================================
// 5.6's third worked example: d-target edits (T5.6-3), and its closing
// sentence: a coverage/tags-only metadata edit propagates nothing (T5.6-4)
// =============================================================================

const TARGETS = "specs/Targets.mdx";
const T1 = "specs/Targets.mdx#t1";
const T2 = "specs/Targets.mdx#t2";
const GROW_FILE = "specs/Grow.mdx";
const OUTERGROW = "specs/Grow.mdx#outergrow";
const GROW = "specs/Grow.mdx#outergrow.grow";
const SHRINK_FILE = "specs/Shrink.mdx";
const OUTERSHRINK = "specs/Shrink.mdx#outershrink";
const SHRINK = "specs/Shrink.mdx#outershrink.shrink";
const GROW_DEPS = "specs/GrowDeps.mdx";
const GROWHOLD = "specs/GrowDeps.mdx#growhold";
const GROWHOLD_DIRECT = "specs/GrowDeps.mdx#growhold.direct";
const GROWHOLD_CHAIN = "specs/GrowDeps.mdx#growhold.chain";
const SHRINK_DEPS = "specs/ShrinkDeps.mdx";
const SHRINKHOLD = "specs/ShrinkDeps.mdx#shrinkhold";
const SHRINKHOLD_DIRECT = "specs/ShrinkDeps.mdx#shrinkhold.direct";
const SHRINKHOLD_CHAIN = "specs/ShrinkDeps.mdx#shrinkhold.chain";

const dEditSide = (
  growD: readonly string[],
  shrinkD: readonly string[],
): GraphDiffSide =>
  graph({
    [TARGETS]: { children: [T1, T2] },
    [T1]: { own: "Target one text." },
    [T2]: { own: "Target two text." },
    [GROW_FILE]: { children: [OUTERGROW] },
    [OUTERGROW]: { own: "Grow-side outer text.", children: [GROW] },
    [GROW]: { own: "Node whose target set grows.", d: growD },
    [SHRINK_FILE]: { children: [OUTERSHRINK] },
    [OUTERSHRINK]: { own: "Shrink-side outer text.", children: [SHRINK] },
    [SHRINK]: { own: "Node whose target set shrinks.", d: shrinkD },
    [GROW_DEPS]: { children: [GROWHOLD] },
    [GROWHOLD]: {
      own: "Grow-dependent holder text.",
      children: [GROWHOLD_DIRECT, GROWHOLD_CHAIN],
    },
    [GROWHOLD_DIRECT]: { own: "Direct dependent.", d: [GROW] },
    [GROWHOLD_CHAIN]: { own: "Transitive dependent.", d: [GROWHOLD_DIRECT] },
    [SHRINK_DEPS]: { children: [SHRINKHOLD] },
    [SHRINKHOLD]: {
      own: "Shrink-dependent holder text.",
      children: [SHRINKHOLD_DIRECT, SHRINKHOLD_CHAIN],
    },
    [SHRINKHOLD_DIRECT]: { own: "Direct dependent.", d: [SHRINK] },
    [SHRINKHOLD_CHAIN]: {
      own: "Transitive dependent.",
      d: [SHRINKHOLD_DIRECT],
    },
  });

test("S-6 (5.6 d-target edit): D metadata-changed; nothing changed or descendant-changed; ancestors, dependents, their dependents, and their ancestors upstream-changed transitively, per arm", () => {
  const diff = computeGraphDiff(
    dEditSide([T1], [T1, T2]),
    dEditSide([T1, T2], [T1]),
  );
  expect(sortedSet(diff.added)).toEqual([]);
  expect(sortedSet(diff.deleted)).toEqual([]);
  expect(sortedSet(diff.optionalUpstream)).toEqual([]);
  expect(sortedSet(diff.optionalDescendant)).toEqual([]);
  expect(sortedSet(diff.originators)).toEqual([GROW, SHRINK].sort());
  // Hash facts: no subtreeHash changes (a `d` set is no own content); every
  // node of each arm's cascade, the edited nodes included, in effectiveHash.
  expect(sortedSet(diff.subtreeChanged)).toEqual([]);
  expect(sortedSet(diff.effectiveChanged)).toEqual(
    [
      GROW,
      OUTERGROW,
      GROW_FILE,
      GROWHOLD_DIRECT,
      GROWHOLD_CHAIN,
      GROWHOLD,
      GROW_DEPS,
      SHRINK,
      OUTERSHRINK,
      SHRINK_FILE,
      SHRINKHOLD_DIRECT,
      SHRINKHOLD_CHAIN,
      SHRINKHOLD,
      SHRINK_DEPS,
    ].sort(),
  );
  expect(tableOf(diff)).toEqual({
    // The originating nodes: metadata-changed, never upstream-changed from
    // their own edge edits ("other than the node itself").
    [GROW]: ["metadata-changed"],
    [SHRINK]: ["metadata-changed"],
    // The targets gain and lose incoming edges only: uncategorized.
    [T1]: [],
    [T2]: [],
    [TARGETS]: [],
    // Grow arm cascade.
    [OUTERGROW]: ["upstream-changed"],
    [GROW_FILE]: ["upstream-changed"],
    [GROWHOLD_DIRECT]: ["upstream-changed"],
    [GROWHOLD_CHAIN]: ["upstream-changed"],
    [GROWHOLD]: ["upstream-changed"],
    [GROW_DEPS]: ["upstream-changed"],
    // Shrink arm cascade.
    [OUTERSHRINK]: ["upstream-changed"],
    [SHRINK_FILE]: ["upstream-changed"],
    [SHRINKHOLD_DIRECT]: ["upstream-changed"],
    [SHRINKHOLD_CHAIN]: ["upstream-changed"],
    [SHRINKHOLD]: ["upstream-changed"],
    [SHRINK_DEPS]: ["upstream-changed"],
  });
});

const META_FILE = "specs/Meta.mdx";
const META_OUTER = "specs/Meta.mdx#outer";
const META_M = "specs/Meta.mdx#outer.m";
const META_DEP = "specs/Meta.mdx#outer.dep";

const metaOnlySide = (meta: string): GraphDiffSide =>
  graph({
    [META_FILE]: { children: [META_OUTER] },
    [META_OUTER]: {
      own: "Outer holder text.",
      children: [META_M, META_DEP],
    },
    [META_M]: { own: "Metadata-bearing node text.", meta },
    [META_DEP]: { own: "Depends on the metadata bearer.", d: [META_M] },
  });

test("S-6 (5.6 coverage/tags-only edit): the node metadata-changed alone — no effective state changes, so dependent and ancestors receive no category", () => {
  const diff = computeGraphDiff(
    metaOnlySide("required alpha beta"),
    metaOnlySide("none alpha gamma"),
  );
  expect(sortedSet(diff.added)).toEqual([]);
  expect(sortedSet(diff.deleted)).toEqual([]);
  expect(sortedSet(diff.optionalUpstream)).toEqual([]);
  expect(sortedSet(diff.optionalDescendant)).toEqual([]);
  expect(sortedSet(diff.originators)).toEqual([META_M]);
  // Hash facts: neither hash changes anywhere (coverage and tags enter
  // metadataHash alone, 5.5).
  expect(sortedSet(diff.subtreeChanged)).toEqual([]);
  expect(sortedSet(diff.effectiveChanged)).toEqual([]);
  expect(tableOf(diff)).toEqual({
    [META_M]: ["metadata-changed"],
    [META_DEP]: [],
    [META_OUTER]: [],
    [META_FILE]: [],
  });
});

// =============================================================================
// T5.6-6's added/deleted convention
// =============================================================================

const PRESENT = "specs/Present.mdx";
const TGT = "specs/Present.mdx#tgt";
const EMB = "specs/Present.mdx#emb";
const DOOMED = "specs/Doomed.mdx";
const GONE6 = "specs/Doomed.mdx#gone";
const GONE6_KID = "specs/Doomed.mdx#gone.kid";
const GONE6_KID2 = "specs/Doomed.mdx#gone.kid2";
const FRESH = "specs/Fresh.mdx";
const BORN = "specs/Fresh.mdx#born";
const BORN_KID = "specs/Fresh.mdx#born.kid";
const BORN_KID2 = "specs/Fresh.mdx#born.kid2";

/**
 * The T5.6-6 staging: `Present.mdx` persists (its `tgt` edited across the
 * baseline, `emb` the embedding target); `Doomed.mdx` exists only at the
 * baseline and `Fresh.mdx` only currently — each root subtree carrying the
 * full feature set: `d` targets (one to the also-edited `tgt`), coverage,
 * tags, children, and an embedding.
 */
const conventionSide = (
  tgtText: string,
  extra: "doomed" | "fresh",
): GraphDiffSide =>
  graph({
    [PRESENT]: { children: [TGT, EMB] },
    [TGT]: { own: tgtText },
    [EMB]: { own: "Embedding target text." },
    ...(extra === "doomed"
      ? {
          [DOOMED]: { children: [GONE6] },
          [GONE6]: {
            own: "Doomed subtree root embedding: ",
            children: [GONE6_KID, GONE6_KID2],
            d: [TGT, EMB],
            embeds: [EMB],
            meta: "none legacy stale",
          },
          [GONE6_KID]: { own: "Doomed child text." },
          [GONE6_KID2]: { own: "Second doomed child text." },
        }
      : {
          [FRESH]: { children: [BORN] },
          [BORN]: {
            own: "Added subtree root embedding: ",
            children: [BORN_KID, BORN_KID2],
            d: [TGT, EMB],
            embeds: [EMB],
            meta: "none fresh added",
          },
          [BORN_KID]: { own: "Added child text." },
          [BORN_KID2]: { own: "Second added child text." },
        }),
  });

test("S-6 (T5.6-6): every added and every deleted node is changed only — whatever metadata, children, or dependency edges it carries — the deleted ones flagged under their baseline identities", () => {
  const diff = computeGraphDiff(
    conventionSide("Edited target text v1.", "doomed"),
    conventionSide("Edited target text v2.", "fresh"),
  );
  expect(sortedSet(diff.added)).toEqual(
    [FRESH, BORN, BORN_KID, BORN_KID2].sort(),
  );
  expect(sortedSet(diff.deleted)).toEqual(
    [DOOMED, GONE6, GONE6_KID, GONE6_KID2].sort(),
  );
  expect(sortedSet(diff.optionalUpstream)).toEqual([]);
  expect(sortedSet(diff.optionalDescendant)).toEqual([]);
  // Hash facts over kept nodes alone: the edited target and its file's root;
  // added and deleted nodes are in neither set (the oracle's module header).
  expect(sortedSet(diff.subtreeChanged)).toEqual([TGT, PRESENT].sort());
  expect(sortedSet(diff.effectiveChanged)).toEqual([TGT, PRESENT].sort());
  // Added and deleted nodes are originating nodes beside the edited target.
  expect(sortedSet(diff.originators)).toEqual(
    [
      TGT,
      FRESH,
      BORN,
      BORN_KID,
      BORN_KID2,
      DOOMED,
      GONE6,
      GONE6_KID,
      GONE6_KID2,
    ].sort(),
  );
  expect(tableOf(diff)).toEqual({
    // The persisting side: the edited target and its cascade.
    [TGT]: ["changed"],
    [PRESENT]: ["descendant-changed"],
    [EMB]: [],
    // Every added node — the created file's root included — is changed
    // only: never metadata-changed, descendant-changed, or
    // upstream-changed, despite metadata, children, and a `d` target to a
    // node also edited since the baseline.
    [FRESH]: ["changed"],
    [BORN]: ["changed"],
    [BORN_KID]: ["changed"],
    [BORN_KID2]: ["changed"],
    // Every deleted node likewise, under its baseline identity.
    [DOOMED]: ["changed"],
    [GONE6]: ["changed"],
    [GONE6_KID]: ["changed"],
    [GONE6_KID2]: ["changed"],
  });
});

// =============================================================================
// The documented one-sided tolerances (the oracle's module header)
// =============================================================================

const R_A = "specs/R.mdx";
const R_H = "specs/R.mdx#h";
const R_M = "specs/R.mdx#h.m"; // relocated: re-read as #m's node after the move
const R_T = "specs/R.mdx#t";

test("S-6 (tolerance, relocated member): a relocated non-originating member with a dependency cause makes upstream-changed optional on its one-side holder and required on its both-sides holder", () => {
  // Before: A holds H and T; M (d -> T) sits under H. After: M sits
  // directly under A; T's text is edited. M itself is unchanged (its key
  // and metadata are identical), so it may relocate; H (child list) and A
  // (child list) and T (text) are the originators and stay in place.
  const before = graph({
    [R_A]: { children: [R_H, R_T] },
    [R_H]: { own: "Holder text.", children: [R_M] },
    [R_M]: { own: "Mover text.", d: [R_T] },
    [R_T]: { own: "Target text v1." },
  });
  const after = graph({
    [R_A]: { children: [R_H, R_M, R_T] },
    [R_H]: { own: "Holder text." },
    [R_M]: { own: "Mover text.", d: [R_T] },
    [R_T]: { own: "Target text v2." },
  });
  const diff = computeGraphDiff(before, after);
  expect(sortedSet(diff.added)).toEqual([]);
  expect(sortedSet(diff.deleted)).toEqual([]);
  expect(sortedSet(diff.originators)).toEqual([R_A, R_H, R_T].sort());
  // H's only member cause is the relocated M (one-side-only): optional.
  expect(sortedSet(diff.optionalUpstream)).toEqual([R_H]);
  expect(sortedSet(diff.optionalDescendant)).toEqual([]);
  // Hash facts: M keeps its subtreeHash wherever it sits; its effectiveHash
  // changes through its target T (5.5).
  expect(sortedSet(diff.subtreeChanged)).toEqual([R_A, R_H, R_T].sort());
  expect(sortedSet(diff.effectiveChanged)).toEqual([R_A, R_H, R_M, R_T].sort());
  expect(tableOf(diff)).toEqual({
    // A holds M on both sides — its member cause is two-sided: required.
    [R_A]: ["changed", "descendant-changed", "upstream-changed"],
    [R_H]: ["changed"],
    [R_M]: ["upstream-changed"],
    [R_T]: ["changed"],
  });
});

const E_A = "specs/E.mdx";
const E_P = "specs/E.mdx#p";
const E_C = "specs/E.mdx#p.c";
const E_Q = "specs/E.mdx#q";
const E_G = "specs/E.mdx#q.g";
const E_T = "specs/E.mdx#t";

test("S-6 (tolerance, edge-bearing added/deleted members): an added and a deleted member carrying dependency edges make upstream-changed optional on their kept ancestors, never required", () => {
  // P gains child C (d -> T) and Q loses child G (d -> T) while T's text
  // is edited: the members' edges arrive and depart with them, one-sided
  // causes only (5.6's both-sides restriction), so every kept ancestor's
  // upstream-changed is tolerated-optional.
  const before = graph({
    [E_A]: { children: [E_P, E_Q, E_T] },
    [E_P]: { own: "Gaining parent text." },
    [E_Q]: { own: "Losing parent text.", children: [E_G] },
    [E_G]: { own: "Departing member text.", d: [E_T] },
    [E_T]: { own: "Edge target text v1." },
  });
  const after = graph({
    [E_A]: { children: [E_P, E_Q, E_T] },
    [E_P]: { own: "Gaining parent text.", children: [E_C] },
    [E_C]: { own: "Arriving member text.", d: [E_T] },
    [E_Q]: { own: "Losing parent text." },
    [E_T]: { own: "Edge target text v2." },
  });
  const diff = computeGraphDiff(before, after);
  expect(sortedSet(diff.added)).toEqual([E_C]);
  expect(sortedSet(diff.deleted)).toEqual([E_G]);
  expect(sortedSet(diff.originators)).toEqual([E_P, E_Q, E_T, E_C, E_G].sort());
  expect(sortedSet(diff.optionalUpstream)).toEqual([E_A, E_P, E_Q].sort());
  expect(sortedSet(diff.optionalDescendant)).toEqual([]);
  expect(sortedSet(diff.subtreeChanged)).toEqual([E_A, E_P, E_Q, E_T].sort());
  expect(sortedSet(diff.effectiveChanged)).toEqual([E_A, E_P, E_Q, E_T].sort());
  expect(tableOf(diff)).toEqual({
    [E_A]: ["descendant-changed"],
    [E_P]: ["changed", "descendant-changed"],
    [E_Q]: ["changed", "descendant-changed"],
    [E_C]: ["changed"],
    [E_G]: ["changed"],
    [E_T]: ["changed"],
  });
});

// =============================================================================
// The relocation tolerance (opt-in; the path-blocks oracle's): T10.5-9's
// present-node shapes
// =============================================================================

// T10.5-9's present-node arm, every identity already mapped through the
// journaled `move specs/R.mdx#P1.M specs/R.mdx#P2.M` (P1.M -> P2.M, P1.M.c ->
// P2.M.c; SPEC 6.3): at the baseline P1 holds the moved node and its child,
// currently P2 does.
const PN = "specs/R.mdx";
const PN_P1 = "specs/R.mdx#P1";
const PN_P2 = "specs/R.mdx#P2";
const PN_M = "specs/R.mdx#P2.M";
const PN_C = "specs/R.mdx#P2.M.c";

const presentNodeBaseline = (): GraphDiffSide =>
  graph({
    [PN]: { children: [PN_P1, PN_P2] },
    [PN_P1]: { own: "Pee one text.", children: [PN_M] },
    [PN_M]: { own: "Em text.", children: [PN_C] },
    [PN_C]: { own: "See text." },
    [PN_P2]: { own: "Pee two text." },
  });

/** After the move; `withChild` false once P2.M.c's section is deleted. */
const presentNodeCurrent = (withChild: boolean): GraphDiffSide =>
  graph({
    [PN]: { children: [PN_P1, PN_P2] },
    [PN_P1]: { own: "Pee one text." },
    [PN_P2]: { own: "Pee two text.", children: [PN_M] },
    [PN_M]: { own: "Em text.", children: withChild ? [PN_C] : [] },
    ...(withChild ? { [PN_C]: { own: "See text." } } : {}),
  });

test("S-6 (relocation tolerance, T10.5-9's present-node arm): the moved node changed by its child's deletion is refused by default; under the tolerance descendant-changed is optional on its two one-sided holders and required on its both-sides holder and on the moved node itself", () => {
  expect(() =>
    computeGraphDiff(presentNodeBaseline(), presentNodeCurrent(false)),
  ).toThrow(/oracle misuse:.*relocated/);
  const diff = computeGraphDiff(
    presentNodeBaseline(),
    presentNodeCurrent(false),
    { relocatedOriginators: "tolerate" },
  );
  expect(sortedSet(diff.added)).toEqual([]);
  expect(sortedSet(diff.deleted)).toEqual([PN_C]);
  expect(sortedSet(diff.originators)).toEqual(
    [PN_P1, PN_P2, PN_M, PN_C].sort(),
  );
  expect(sortedSet(diff.optionalUpstream)).toEqual([]);
  // P1 held the moved node (and, below it, the deleted child) at the
  // baseline alone, P2 holds it currently alone: each one-sided.
  expect(sortedSet(diff.optionalDescendant)).toEqual([PN_P1, PN_P2].sort());
  expect(tableOf(diff)).toEqual({
    // The root holds the changed P1 (and P2, and the moved node) on both
    // sides: required.
    [PN]: ["descendant-changed"],
    [PN_P1]: ["changed"],
    [PN_P2]: ["changed"],
    // The moved node lost its child — changed — and holds the deleted child
    // directly: required.
    [PN_M]: ["changed", "descendant-changed"],
    [PN_C]: ["changed"],
  });
  expect(sortedSet(diff.subtreeChanged)).toEqual(
    [PN, PN_P1, PN_P2, PN_M].sort(),
  );
  expect(sortedSet(diff.effectiveChanged)).toEqual(
    [PN, PN_P1, PN_P2, PN_M].sort(),
  );
});

test("S-6 (relocation tolerance, T10.5-9's present-node twin): the move alone relocates no originator, and both settings predict alike — the two parents changed, the root descendant-changed, the moved subtree uncategorized", () => {
  const expected = {
    [PN]: ["descendant-changed"],
    [PN_P1]: ["changed"],
    [PN_P2]: ["changed"],
    [PN_M]: [],
    [PN_C]: [],
  };
  for (const options of [
    {},
    { relocatedOriginators: "refuse" },
    { relocatedOriginators: "tolerate" },
  ] as const) {
    const diff = computeGraphDiff(
      presentNodeBaseline(),
      presentNodeCurrent(true),
      options,
    );
    expect(sortedSet(diff.added)).toEqual([]);
    expect(sortedSet(diff.deleted)).toEqual([]);
    expect(sortedSet(diff.originators)).toEqual([PN_P1, PN_P2].sort());
    expect(sortedSet(diff.optionalUpstream)).toEqual([]);
    expect(sortedSet(diff.optionalDescendant)).toEqual([]);
    expect(tableOf(diff)).toEqual(expected);
    expect(sortedSet(diff.subtreeChanged)).toEqual([PN, PN_P1, PN_P2].sort());
    expect(sortedSet(diff.effectiveChanged)).toEqual([PN, PN_P1, PN_P2].sort());
  }
});

const HD = "specs/H.mdx";
const HD_H = "specs/H.mdx#h";
const HD_P1 = "specs/H.mdx#h.P1";
const HD_P2 = "specs/H.mdx#h.P2";
const HD_M = "specs/H.mdx#h.P2.M"; // moved from under P1 (journal-mapped)
const HD_K = "specs/H.mdx#h.P2.M.k"; // added below the moved node
const HD_Q = "specs/H.mdx#h.P2.Q";

test("S-6 (relocation tolerance): a holder of a relocated changed node that also holds a changed node on both sides is descendant-changed required; an added node below the relocated one leaves its one-sided holder optional", () => {
  const before = graph({
    [HD]: { children: [HD_H] },
    [HD_H]: { own: "Holder text.", children: [HD_P1, HD_P2] },
    [HD_P1]: { own: "First parent text.", children: [HD_M] },
    [HD_M]: { own: "Mover text." },
    [HD_P2]: { own: "Second parent text.", children: [HD_Q] },
    [HD_Q]: { own: "Cue text v1." },
  });
  const after = graph({
    [HD]: { children: [HD_H] },
    [HD_H]: { own: "Holder text.", children: [HD_P1, HD_P2] },
    [HD_P1]: { own: "First parent text." },
    [HD_P2]: { own: "Second parent text.", children: [HD_M, HD_Q] },
    [HD_M]: { own: "Mover text.", children: [HD_K] },
    [HD_K]: { own: "Added below the mover." },
    [HD_Q]: { own: "Cue text v2." },
  });
  expect(() => computeGraphDiff(before, after)).toThrow(
    /oracle misuse:.*relocated/,
  );
  const diff = computeGraphDiff(before, after, {
    relocatedOriginators: "tolerate",
  });
  expect(sortedSet(diff.added)).toEqual([HD_K]);
  expect(sortedSet(diff.deleted)).toEqual([]);
  expect(sortedSet(diff.originators)).toEqual(
    [HD_P1, HD_P2, HD_M, HD_K, HD_Q].sort(),
  );
  expect(sortedSet(diff.optionalUpstream)).toEqual([]);
  // P1 held the relocated M at the baseline alone; P2 holds M (and the
  // added K below it) currently alone, but Q on both sides.
  expect(sortedSet(diff.optionalDescendant)).toEqual([HD_P1]);
  expect(tableOf(diff)).toEqual({
    [HD]: ["descendant-changed"],
    [HD_H]: ["descendant-changed"],
    [HD_P1]: ["changed"],
    [HD_P2]: ["changed", "descendant-changed"],
    [HD_M]: ["changed", "descendant-changed"],
    [HD_K]: ["changed"],
    [HD_Q]: ["changed"],
  });
  expect(sortedSet(diff.subtreeChanged)).toEqual(
    [HD, HD_H, HD_P1, HD_P2, HD_M, HD_Q].sort(),
  );
  expect(sortedSet(diff.effectiveChanged)).toEqual(
    [HD, HD_H, HD_P1, HD_P2, HD_M, HD_Q].sort(),
  );
});

// =============================================================================
// Misuse guards
// =============================================================================

test("S-6: a relocated originating node throws — descendant-changed would be two-sidedly ambiguous", () => {
  const before = graph({
    [R_A]: { children: [R_H] },
    [R_H]: { own: "Holder text.", children: [R_M] },
    [R_M]: { own: "Mover text v1." },
  });
  const after = graph({
    [R_A]: { children: [R_H, R_M] },
    [R_H]: { own: "Holder text." },
    [R_M]: { own: "Mover text v2." },
  });
  expect(() => computeGraphDiff(before, after)).toThrow(
    /oracle misuse:.*relocated/,
  );
});

test("S-6: an ownKey that fails to cover a differing child list throws", () => {
  const raw = (children: readonly string[]): GraphDiffNode => ({
    children,
    ownKey: "constant",
    metaKey: "m",
    pairKey: "p",
    edgeTargets: [],
  });
  const leaf: GraphDiffNode = {
    children: [],
    ownKey: "leaf",
    metaKey: "m",
    pairKey: "p",
    edgeTargets: [],
  };
  const before: GraphDiffSide = new Map([
    ["specs/A.mdx", raw(["specs/A.mdx#b"])],
    ["specs/A.mdx#b", leaf],
  ]);
  const after: GraphDiffSide = new Map([
    ["specs/A.mdx", raw([])],
    ["specs/A.mdx#b", leaf],
  ]);
  expect(() => computeGraphDiff(before, after)).toThrow(
    /oracle misuse:.*ownKey must cover the child reference tokens/,
  );
});

test("S-6: a child identity with no node on its side throws — the graph must be complete", () => {
  const side = graph({ [R_A]: { children: [R_H] } });
  expect(() => computeGraphDiff(side, side)).toThrow(
    /oracle misuse:.*no baseline node/,
  );
});

test("S-6: a contains-cycle throws", () => {
  const side = graph({
    [R_A]: { children: [R_H] },
    [R_H]: { own: "h", children: [R_A] },
  });
  expect(() => computeGraphDiff(side, side)).toThrow(
    /oracle misuse:.*contains-cycle/,
  );
});

test("S-6: a dependency cycle throws", () => {
  const side = graph({
    [R_A]: { own: "a", d: [R_H] },
    [R_H]: { own: "h", d: [R_A] },
  });
  expect(() => computeGraphDiff(side, side)).toThrow(/oracle misuse:.*cycle/);
});

test("S-6: an unknown relocation setting throws", () => {
  const side = graph({ [R_A]: { own: "a" } });
  expect(() =>
    computeGraphDiff(side, side, {
      relocatedOriginators: "ignore" as unknown as "tolerate",
    }),
  ).toThrow(/oracle misuse:.*relocatedOriginators must be/);
});
