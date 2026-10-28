// S-6 path-blocks generation-oracle vectors (TEST-SPEC 17 S-6): the
// in-harness path-blocks oracle for P-16 (test/helpers/oracles/path-blocks.ts)
// passes this fixed vector suite before P-16 trusts it — SPEC.md 15's worked
// session (its four items) and the item lists TEST-SPEC pins in T10.5-1,
// T10.5-7, T10.5-8, and T10.5-9. Each vector is built as oracle input from
// the vector's graphs and journal — each side's sections with their own
// text, children, `d` targets, embeddings, and coverage-or-tags stand-in,
// the baseline's identities mapped forward through the vector's journaled
// operations (SPEC 6.3), and each side's code locations with their impact
// edges — and the oracle's items, in item order, must equal the pinned ones:
// kind and scope node, scope set (with the members presented absent),
// context, origin, and `blockedBy` as the kinds and scope nodes of the items
// it names. No product is involved: the product's own 10.5 behavior is
// asserted by the suite's T10.5-* tests against fixtures.
//
// Coverage, by the worked material the vectors derive from:
//   * SPEC 15's worked change (T10.5-1's first arm): a leaf text edit
//     yields exactly print.hello's subtree-coherence item, print's
//     parent-consistency item blocked by it, derived.hello's
//     dependency-consistency item, and the code-impact item of
//     src/hello.ts#hello, transitively impacted through derived.hello and
//     attributed to print.hello;
//   * T10.5-1's extended fixture (skipping — a changed node under a changed
//     ancestor gets no item, its change in the visited ancestor's origin —
//     and the shared-ancestor union of changed branches), its chain fixture
//     (the branch head as context), and the chain's both-edited twin (the
//     skipped node in both origins);
//   * T10.5-7's six items (section-10.5.ts's `E7_EXPECTED_ITEMS`): embeds
//     edges are dependency edges, a root-sourced embedding gives the root a
//     dependency-consistency item at depth 0, impact edges include embeds;
//   * T10.5-8's `changed` root, visited as N, in both stagings;
//   * T10.5-9's deleted node under its baseline parent, its journal arm (the
//     baseline parent mapped through a rename), and its present-node arm and
//     twin (a moved node under its current parent, its deleted child under
//     the moved node, the baseline parent mapped through the move);
// and, beyond S-6's list, T10.5-3's origin-counting stagings (a target's
// `metadata-changed` counting only when its `d` targets changed — the rule
// no vector above reaches) and the oracle's documented tolerances (its
// module header): attribution through a relocated member and through a
// deleted member's own dependency edge predicted tolerated-optional; plus
// its misuse guards, plain errors (harness defects), never diagnosed
// product failures.

import { expect, test } from "vitest";
import {
  derivePathBlocks,
  pathBlocksItemKey,
} from "../helpers/oracles/path-blocks.js";
import type {
  PathBlocksCode,
  PathBlocksItemKind,
  PathBlocksNode,
  PathBlocksPrediction,
  PathBlocksSide,
} from "../helpers/oracles/path-blocks.js";
import { E7_EXPECTED_ITEMS } from "../suite/registry/section-10.5.js";

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

/** A vector's journaled identity mapping, baseline identity to current. */
type Journal = Readonly<Record<string, string>>;

/**
 * Build one side from per-node specs, every identity — keys, children, `d`
 * targets, embeddings — mapped through `journal` (the baseline's mapping
 * forward, SPEC 6.3; the current side's is empty), deriving the opaque keys
 * as SPEC 5.5 frames the hash preimages, over canonical identities: own
 * content covers the runs plus the child and embedding reference tokens;
 * metadata the `d`-target set, coverage, and tags; the pair multiset one
 * entry per dependency edge, `depends` and `embeds` alike.
 */
function side(
  nodes: Record<string, NodeSpec>,
  journal: Journal = {},
): PathBlocksSide {
  const map = (identity: string): string => journal[identity] ?? identity;
  const result = new Map<string, PathBlocksNode>();
  for (const [identity, spec] of Object.entries(nodes)) {
    const children = (spec.children ?? []).map(map);
    const d = [...new Set((spec.d ?? []).map(map))].sort();
    const embeds = (spec.embeds ?? []).map(map).sort();
    result.set(map(identity), {
      children,
      ownKey: JSON.stringify([spec.own ?? "", children, embeds]),
      metaKey: JSON.stringify([d, spec.meta ?? ""]),
      pairKey: JSON.stringify([...d, ...embeds].sort()),
      edgeTargets: [...new Set([...d, ...embeds])].sort(),
      dTargets: d,
    });
  }
  return result;
}

/** One side's code locations with their impact-edge targets, mapped. */
function code(
  locations: Record<string, readonly string[]>,
  journal: Journal = {},
): PathBlocksCode {
  const map = (identity: string): string => journal[identity] ?? identity;
  return new Map(
    Object.entries(locations).map(([location, targets]) => [
      map(location),
      targets.map(map),
    ]),
  );
}

const NO_CODE: PathBlocksCode = new Map();

// --- expectation helpers -----------------------------------------------------

interface ExpectedItem {
  readonly kind: PathBlocksItemKind | string;
  readonly scope: string;
  /** The scope set; `[scope]` when omitted. */
  readonly scopeSet?: readonly string[];
  /** Scope-set members presented absent (deleted); none when omitted. */
  readonly absent?: readonly string[];
  readonly context: readonly string[];
  readonly origin: readonly string[];
  /** Tolerated-optional origin members; none when omitted. */
  readonly originOptional?: readonly string[];
  /** The kinds and scope nodes of the blocking items; none when omitted. */
  readonly blockedBy?: readonly (readonly [PathBlocksItemKind, string])[];
}

/** The prediction's items, projected for comparison, in item order. */
function projected(prediction: PathBlocksPrediction): unknown[] {
  return prediction.items.map((item) => ({
    kind: item.kind,
    scope: item.scope,
    scopePresent: item.scopePresent,
    scopeSet: item.scopeSet,
    absent: item.scopeSet.filter((node) => prediction.absent.has(node)),
    context: item.context,
    origin: item.origin,
    originOptional: item.originOptional,
    blockedBy: item.blockedBy,
  }));
}

/** The expected items in the same projection (ASCII identities: byte order). */
function expectedProjection(expected: readonly ExpectedItem[]): unknown[] {
  return expected.map((item) => {
    const absent = [...(item.absent ?? [])].sort();
    return {
      kind: item.kind,
      scope: item.scope,
      scopePresent: !absent.includes(item.scope),
      scopeSet: [...(item.scopeSet ?? [item.scope])].sort(),
      absent,
      context: [...item.context].sort(),
      origin: [...item.origin].sort(),
      originOptional: [...(item.originOptional ?? [])].sort(),
      blockedBy: (item.blockedBy ?? [])
        .map(([kind, scope]) => pathBlocksItemKey(kind, scope))
        .sort(),
    };
  });
}

function expectItems(
  prediction: PathBlocksPrediction,
  expected: readonly ExpectedItem[],
): void {
  expect(projected(prediction)).toEqual(expectedProjection(expected));
}

/** Every identity an item of the prediction names. */
function namedIdentities(prediction: PathBlocksPrediction): Set<string> {
  const named = new Set<string>();
  for (const item of prediction.items) {
    for (const node of [
      item.scope,
      ...item.scopeSet,
      ...item.context,
      ...item.origin,
      ...item.originOptional,
    ]) {
      named.add(node);
    }
  }
  return named;
}

// =============================================================================
// SPEC 15's worked session — its four items (T10.5-1's first arm)
// =============================================================================

const S15_SPEC = "specs/SPEC.mdx";
const S15_PRINT = "specs/SPEC.mdx#print";
const S15_HELLO = "specs/SPEC.mdx#print.hello";
const S15_DERIVED_FILE = "specs/DERIVED.mdx";
const S15_DERIVED = "specs/DERIVED.mdx#derived";
const S15_DERIVED_HELLO = "specs/DERIVED.mdx#derived.hello";
const S15_HELLO_CODE = "src/hello.ts#hello";

/** SPEC 15's workspace, print.hello's text `helloText`. */
const s15Side = (helloText: string): PathBlocksSide =>
  side({
    [S15_SPEC]: { children: [S15_PRINT] },
    [S15_PRINT]: { own: "Print behavior.", children: [S15_HELLO] },
    [S15_HELLO]: { own: helloText, meta: 'tags="critical"' },
    [S15_DERIVED_FILE]: { children: [S15_DERIVED] },
    [S15_DERIVED]: { own: "Derived behavior.", children: [S15_DERIVED_HELLO] },
    [S15_DERIVED_HELLO]: { own: "Derived hello behavior.", d: [S15_HELLO] },
  });

// `src/hello.ts#hello references specs/DERIVED.mdx#derived.hello` (SPEC 15's
// graph), on both sides.
const s15Code = (): PathBlocksCode =>
  code({ [S15_HELLO_CODE]: [S15_DERIVED_HELLO] });

test("S-6 (SPEC 15): print.hello's text edited yields exactly its subtree-coherence item, print's parent-consistency item blocked by it, derived.hello's dependency-consistency item, and src/hello.ts#hello's code-impact item, in item order", () => {
  const prediction = derivePathBlocks({
    before: s15Side("Print hello."),
    after: s15Side("Print hello, edited."),
    codeBefore: s15Code(),
    codeAfter: s15Code(),
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: S15_HELLO,
      context: [S15_SPEC, S15_PRINT],
      origin: [S15_HELLO],
    },
    {
      // derived.hello's `d` target print.hello is present on both sides and
      // its effectiveHash changed.
      kind: "dependency-consistency",
      scope: S15_DERIVED_HELLO,
      context: [S15_HELLO],
      origin: [S15_HELLO],
    },
    {
      kind: "parent-consistency",
      scope: S15_PRINT,
      context: [S15_HELLO],
      origin: [S15_HELLO],
      blockedBy: [["subtree-coherence", S15_HELLO]],
    },
    {
      // Transitively impacted: derived.hello's effectiveHash changed, its
      // subtreeHash did not (9.2); the origin is the originating node of
      // derived.hello's upstream-changed, never the context node.
      kind: "code-impact",
      scope: S15_HELLO_CODE,
      context: [S15_DERIVED_HELLO],
      origin: [S15_HELLO],
    },
  ]);
});

// =============================================================================
// T10.5-1: the extended fixture, the chain fixture, and its both-edited twin
// =============================================================================

const X1 = "specs/X.mdx";
const X1_P = "specs/X.mdx#p";
const X1_PQ = "specs/X.mdx#p.q";
const X1_A = "specs/X.mdx#a";
const X1_AX = "specs/X.mdx#a.x";
const X1_AK = "specs/X.mdx#a.k";
const X1_AKY = "specs/X.mdx#a.k.y";

/** The extended fixture with p's own text and p.q, a.x, a.k.y at `v`. */
const x1Side = (v: string): PathBlocksSide =>
  side({
    [X1]: { children: [X1_P, X1_A] },
    [X1_P]: { own: `Pee own ${v}.`, children: [X1_PQ] },
    [X1_PQ]: { own: `Cue text ${v}.` },
    [X1_A]: { own: "Aye own text.", children: [X1_AX, X1_AK] },
    [X1_AX]: { own: `Ex text ${v}.` },
    [X1_AK]: { own: "Kay own text.", children: [X1_AKY] },
    [X1_AKY]: { own: `Why text ${v}.` },
  });

test("S-6 (T10.5-1 extended fixture): p.q, under the changed p, gets no item and enters p's origin; a's single parent-consistency item takes the union of its changed branches — context {a.x, a.k}, origin {a.x, a.k.y} — blocked by a.x's subtree-coherence item and a.k's parent-consistency item", () => {
  const prediction = derivePathBlocks({
    before: x1Side("v0"),
    after: x1Side("v1"),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: X1_AKY,
      context: [X1, X1_A, X1_AK],
      origin: [X1_AKY],
    },
    {
      kind: "subtree-coherence",
      scope: X1_AX,
      context: [X1, X1_A],
      origin: [X1_AX],
    },
    {
      kind: "parent-consistency",
      scope: X1_AK,
      context: [X1_AKY],
      origin: [X1_AKY],
      blockedBy: [["subtree-coherence", X1_AKY]],
    },
    {
      kind: "subtree-coherence",
      scope: X1_P,
      scopeSet: [X1_P, X1_PQ],
      context: [X1],
      origin: [X1_P, X1_PQ],
    },
    {
      kind: "parent-consistency",
      scope: X1_A,
      context: [X1_AX, X1_AK],
      origin: [X1_AX, X1_AKY],
      blockedBy: [
        ["subtree-coherence", X1_AX],
        ["parent-consistency", X1_AK],
      ],
    },
  ]);
});

const Y = "specs/Y.mdx";
const Y_A = "specs/Y.mdx#a";
const Y_AB = "specs/Y.mdx#a.b";
const Y_ABC = "specs/Y.mdx#a.b.c";

/** The chain fixture a > a.b > a.b.c, a.b's own text and a.b.c's given. */
const ySide = (bOwn: string, cText: string): PathBlocksSide =>
  side({
    [Y]: { children: [Y_A] },
    [Y_A]: { own: "Aye own text.", children: [Y_AB] },
    [Y_AB]: { own: bOwn, children: [Y_ABC] },
    [Y_ABC]: { own: cText },
  });

test("S-6 (T10.5-1 chain fixture): only a.b.c changed — a's parent-consistency item's context is the branch head {a.b}, a.b's {a.b.c}, both origins {a.b.c}, and the chain blocks bottom-up", () => {
  const prediction = derivePathBlocks({
    before: ySide("Abe own v0.", "Cee text v0."),
    after: ySide("Abe own v0.", "Cee text v1."),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: Y_ABC,
      context: [Y, Y_A, Y_AB],
      origin: [Y_ABC],
    },
    {
      kind: "parent-consistency",
      scope: Y_AB,
      context: [Y_ABC],
      origin: [Y_ABC],
      blockedBy: [["subtree-coherence", Y_ABC]],
    },
    {
      kind: "parent-consistency",
      scope: Y_A,
      context: [Y_AB],
      origin: [Y_ABC],
      blockedBy: [["parent-consistency", Y_AB]],
    },
  ]);
});

test("S-6 (T10.5-1 chain's both-edited twin): a.b visited and a.b.c skipped — a.b's subtree-coherence item and a's parent-consistency item (context {a.b}) both have origin {a.b, a.b.c}", () => {
  const prediction = derivePathBlocks({
    before: ySide("Abe own v0.", "Cee text v0."),
    after: ySide("Abe own v1.", "Cee text v1."),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: Y_AB,
      scopeSet: [Y_AB, Y_ABC],
      context: [Y, Y_A],
      origin: [Y_AB, Y_ABC],
    },
    {
      kind: "parent-consistency",
      scope: Y_A,
      context: [Y_AB],
      origin: [Y_AB, Y_ABC],
      blockedBy: [["subtree-coherence", Y_AB]],
    },
  ]);
});

// =============================================================================
// T10.5-7: embedding edges and a root-sourced embedding
// =============================================================================

const E7_A = "specs/A.mdx";
const E7_E = "specs/A.mdx#e";
const E7_F = "specs/A.mdx#f";
const E7_B = "specs/B.mdx";
const E7_T = "specs/B.mdx#t";
const E7_SHOW = "src/show.ts#show";
const E7_ECHO = "src/echo.ts#echo";

/**
 * T10.5-7's workspace, t's text `tText`: A's root embeds t at its top level
 * (a root-sourced `embeds` edge), e holds only `{text(B.t)}`, f is spelled
 * `d={B.t}` and holds `{text(B.t)}`.
 */
const e7Side = (tText: string): PathBlocksSide =>
  side({
    [E7_B]: { children: [E7_T] },
    [E7_T]: { own: tText },
    [E7_A]: { embeds: [E7_T], children: [E7_E, E7_F] },
    [E7_E]: { embeds: [E7_T] },
    [E7_F]: { d: [E7_T], embeds: [E7_T] },
  });

// `show` calls `text(B.t)`, `echo` calls `text(A.e)`: one embeds edge each,
// no marker anywhere.
const e7Code = (): PathBlocksCode =>
  code({ [E7_SHOW]: [E7_T], [E7_ECHO]: [E7_E] });

test("S-6 (T10.5-7): t's text edited yields exactly the six pinned items (section-10.5.ts's E7_EXPECTED_ITEMS) in order, every blockedBy empty", () => {
  const prediction = derivePathBlocks({
    before: e7Side("Target text v0."),
    after: e7Side("Target text v1."),
    codeBefore: e7Code(),
    codeAfter: e7Code(),
  });
  expectItems(
    prediction,
    E7_EXPECTED_ITEMS.map((item) => ({
      kind: item.kind,
      scope: item.scope,
      context: item.context,
      origin: item.origin,
    })),
  );
});

// =============================================================================
// T10.5-8: a `changed` root
// =============================================================================

const R8 = "specs/R.mdx";
const R8_A = "specs/R.mdx#a";
const R8_AB = "specs/R.mdx#a.b";
const R8_C = "specs/R.mdx#c";
const R8_D = "specs/R.mdx#d";
const S8 = "specs/S.mdx";
const S8_X = "specs/S.mdx#x";
const S8_XY = "specs/S.mdx#x.y";

/**
 * T10.5-8's two files: R's top-level text `top`, a holding a.b (`ab`), c,
 * and — `withD` — the top-level d after c; S's x holding x.y (`xy`).
 */
const r8Side = (
  top: string,
  ab: string,
  withD: boolean,
  xy: string,
): PathBlocksSide =>
  side({
    [R8]: { own: top, children: withD ? [R8_A, R8_C, R8_D] : [R8_A, R8_C] },
    [R8_A]: { own: "Ay own text.", children: [R8_AB] },
    [R8_AB]: { own: ab },
    [R8_C]: { own: "Cee text." },
    ...(withD ? { [R8_D]: { own: "Dee text." } } : {}),
    [S8]: { children: [S8_X] },
    [S8_X]: { own: "Ex own text.", children: [S8_XY] },
    [S8_XY]: { own: xy },
  });

const R8_EXPECTED: readonly ExpectedItem[] = [
  {
    kind: "subtree-coherence",
    scope: S8_XY,
    context: [S8, S8_X],
    origin: [S8_XY],
  },
  {
    kind: "parent-consistency",
    scope: S8_X,
    context: [S8_XY],
    origin: [S8_XY],
    blockedBy: [["subtree-coherence", S8_XY]],
  },
  {
    // The root, visited as N: scope every section of its file, context
    // empty, origin the changed nodes in scope — a.b and the added d
    // skipped beneath it.
    kind: "subtree-coherence",
    scope: R8,
    scopeSet: [R8, R8_A, R8_AB, R8_C, R8_D],
    context: [],
    origin: [R8, R8_AB, R8_D],
  },
];

test("S-6 (T10.5-8, the four edits): the changed root is visited as N — its single subtree-coherence item takes in a.b and d — beside x.y's subtree-coherence item and x's parent-consistency item, exactly three items in order", () => {
  const prediction = derivePathBlocks({
    before: r8Side("Root top text v0.", "Ay bee text v0.", false, "Ex why v0."),
    after: r8Side("Root top text v1.", "Ay bee text v1.", true, "Ex why v1."),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, R8_EXPECTED);
});

test("S-6 (T10.5-8, the twin): the added d alone makes the root changed, a structural edit originating at the parent — the same three items", () => {
  const prediction = derivePathBlocks({
    before: r8Side("Root top text v0.", "Ay bee text v0.", false, "Ex why v0."),
    after: r8Side("Root top text v0.", "Ay bee text v1.", true, "Ex why v1."),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, R8_EXPECTED);
});

// =============================================================================
// T10.5-9: deleted and moved nodes in baseline sessions
// =============================================================================

const D9 = "specs/D.mdx";
const D9_A = "specs/D.mdx#A";
const D9_AB = "specs/D.mdx#A.B";
const D9_ABC = "specs/D.mdx#A.B.C";
const D9_AB2 = "specs/D.mdx#A.B2";
const D9_AB2C = "specs/D.mdx#A.B2.C";

/** specs/D.mdx at the baseline: A holding A.B holding A.B.C. */
const D9_BASELINE: Record<string, NodeSpec> = {
  [D9]: { children: [D9_A] },
  [D9_A]: { own: "Ay own text.", children: [D9_AB] },
  [D9_AB]: { own: "Ay bee own text.", children: [D9_ABC] },
  [D9_ABC]: { own: "Ay bee see text GONETOKEN." },
};

test("S-6 (T10.5-9 deleted-node fixture): A.B.C deleted — A.B's subtree-coherence item's scope {A.B, A.B.C}, the deleted child under its baseline parent and presented absent, origin {A.B, A.B.C}; A's parent-consistency item context {A.B}, origin {A.B, A.B.C}, blocked by A.B's item", () => {
  const prediction = derivePathBlocks({
    before: side(D9_BASELINE),
    after: side({
      [D9]: { children: [D9_A] },
      [D9_A]: { own: "Ay own text.", children: [D9_AB] },
      [D9_AB]: { own: "Ay bee own text." },
    }),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: D9_AB,
      scopeSet: [D9_AB, D9_ABC],
      absent: [D9_ABC],
      context: [D9, D9_A],
      origin: [D9_AB, D9_ABC],
    },
    {
      kind: "parent-consistency",
      scope: D9_A,
      context: [D9_AB],
      origin: [D9_AB, D9_ABC],
      blockedBy: [["subtree-coherence", D9_AB]],
    },
  ]);
});

test("S-6 (T10.5-9 journal arm): A.B renamed A.B2 (journaled) and A.B2.C deleted — the same two items under the mapped identities, the deleted node under A.B2.C, its baseline identity mapped forward, never under A.B.C", () => {
  const journal: Journal = { [D9_AB]: D9_AB2, [D9_ABC]: D9_AB2C };
  const prediction = derivePathBlocks({
    before: side(D9_BASELINE, journal),
    after: side({
      [D9]: { children: [D9_A] },
      [D9_A]: { own: "Ay own text.", children: [D9_AB2] },
      [D9_AB2]: { own: "Ay bee own text." },
    }),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: D9_AB2,
      scopeSet: [D9_AB2, D9_AB2C],
      absent: [D9_AB2C],
      context: [D9, D9_A],
      origin: [D9_AB2, D9_AB2C],
    },
    {
      kind: "parent-consistency",
      scope: D9_A,
      context: [D9_AB2],
      origin: [D9_AB2, D9_AB2C],
      blockedBy: [["subtree-coherence", D9_AB2]],
    },
  ]);
  const named = namedIdentities(prediction);
  expect(named.has(D9_ABC) || named.has(D9_AB)).toBe(false);
});

const P9 = "specs/R.mdx";
const P9_P1 = "specs/R.mdx#P1";
const P9_P1M = "specs/R.mdx#P1.M";
const P9_P1MC = "specs/R.mdx#P1.M.c";
const P9_P2 = "specs/R.mdx#P2";
const P9_P2M = "specs/R.mdx#P2.M";
const P9_P2MC = "specs/R.mdx#P2.M.c";

/** The journaled `move specs/R.mdx#P1.M specs/R.mdx#P2.M` (6.5). */
const P9_JOURNAL: Journal = { [P9_P1M]: P9_P2M, [P9_P1MC]: P9_P2MC };

/** specs/R.mdx at the baseline: P1 holding P1.M holding P1.M.c, then P2. */
const P9_BASELINE: Record<string, NodeSpec> = {
  [P9]: { children: [P9_P1, P9_P2] },
  [P9_P1]: { own: "Pee one text.", children: [P9_P1M] },
  [P9_P1M]: { own: "Em text.", children: [P9_P1MC] },
  [P9_P1MC]: { own: "See text." },
  [P9_P2]: { own: "Pee two text." },
};

/** After the move; `withChild` false once P2.M.c's section is deleted. */
const p9Current = (withChild: boolean): Record<string, NodeSpec> => ({
  [P9]: { children: [P9_P1, P9_P2] },
  [P9_P1]: { own: "Pee one text." },
  [P9_P2]: { own: "Pee two text.", children: [P9_P2M] },
  [P9_P2M]: { own: "Em text.", children: withChild ? [P9_P2MC] : [] },
  ...(withChild ? { [P9_P2MC]: { own: "See text." } } : {}),
});

test("S-6 (T10.5-9 present-node arm): after the journaled move and P2.M.c's deletion, exactly P1's subtree-coherence item (scope and origin {P1}) and P2's (scope {P2, P2.M, P2.M.c}, the deleted node under its mapped baseline parent and presented absent, origin {P2, P2.M, P2.M.c}), each context specs/R.mdx and unblocked", () => {
  const prediction = derivePathBlocks({
    before: side(P9_BASELINE, P9_JOURNAL),
    after: side(p9Current(false)),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: P9_P1,
      context: [P9],
      origin: [P9_P1],
    },
    {
      kind: "subtree-coherence",
      scope: P9_P2,
      scopeSet: [P9_P2, P9_P2M, P9_P2MC],
      absent: [P9_P2MC],
      context: [P9],
      origin: [P9_P2, P9_P2M, P9_P2MC],
    },
  ]);
  expect(namedIdentities(prediction).has(P9_P1MC)).toBe(false);
});

test("S-6 (T10.5-9 present-node twin): stopping before the deletion yields the same two items, P2's scope {P2, P2.M, P2.M.c} every node present, its origin {P2}", () => {
  const prediction = derivePathBlocks({
    before: side(P9_BASELINE, P9_JOURNAL),
    after: side(p9Current(true)),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: P9_P1,
      context: [P9],
      origin: [P9_P1],
    },
    {
      kind: "subtree-coherence",
      scope: P9_P2,
      scopeSet: [P9_P2, P9_P2M, P9_P2MC],
      context: [P9],
      origin: [P9_P2],
    },
  ]);
});

// =============================================================================
// Beyond S-6's list: T10.5-3's origin counting (a target's metadata-changed
// counting only when its `d` targets changed)
// =============================================================================

const OC = "specs/O.mdx";
const OC_X = "specs/O.mdx#x";
const OC_T = "specs/O.mdx#t";
const OC_U = "specs/O.mdx#u";
const OC_W = "specs/O.mdx#w";
const OC_CODE = "src/o.ts";

/**
 * T10.5-3's origin-counting workspace: x depending on t, t on `tD` with the
 * coverage-or-tags stand-in `tMeta`, u's text `uText`, w unreferenced.
 */
const ocSide = (
  tD: readonly string[],
  tMeta: string,
  uText: string,
): PathBlocksSide =>
  side({
    [OC]: { children: [OC_X, OC_T, OC_U, OC_W] },
    [OC_X]: { own: "Ex text.", d: [OC_T] },
    [OC_T]: { own: "Tee text.", d: tD, meta: tMeta },
    [OC_U]: { own: uText },
    [OC_W]: { own: "Dub text." },
  });

// The whole-file location src/o.ts, whose marker targets t.
const ocCode = (): PathBlocksCode => code({ [OC_CODE]: [OC_T] });

test("S-6 (T10.5-3 origin counting): u's text edited beside a tags-only or coverage-only edit to t gives x's dependency-consistency item and the code-impact item origin {u}; the d-set twin (t gaining w) gives {t, u}", () => {
  const stagings = [
    { tD: [OC_U], tMeta: 'tags="edited"', origin: [OC_U], tContext: [] },
    { tD: [OC_U], tMeta: 'coverage="none"', origin: [OC_U], tContext: [] },
    { tD: [OC_U, OC_W], tMeta: "", origin: [OC_T, OC_U], tContext: [OC_W] },
  ];
  for (const staging of stagings) {
    const prediction = derivePathBlocks({
      before: ocSide([OC_U], "", "You text v0."),
      after: ocSide(staging.tD, staging.tMeta, "You text v1."),
      codeBefore: ocCode(),
      codeAfter: ocCode(),
    });
    expectItems(prediction, [
      { kind: "subtree-coherence", scope: OC_U, context: [OC], origin: [OC_U] },
      {
        kind: "metadata-consistency",
        scope: OC_T,
        context: staging.tContext,
        origin: [OC_T],
      },
      {
        kind: "dependency-consistency",
        scope: OC_X,
        context: [OC_T],
        origin: staging.origin,
      },
      {
        // t's own edge to u, whose effectiveHash changed (w, gained in the
        // twin, changed nothing).
        kind: "dependency-consistency",
        scope: OC_T,
        context: [OC_U],
        origin: [OC_U],
      },
      {
        kind: "code-impact",
        scope: OC_CODE,
        context: [OC_T],
        origin: staging.origin,
      },
    ]);
  }
});

// =============================================================================
// The documented tolerances (the oracle's module header)
// =============================================================================

const W9 = "specs/W.mdx";
const W9_ON_P1 = "specs/W.mdx#onP1";
const W9_ON_P2 = "specs/W.mdx#onP2";
const W9_ON_M = "specs/W.mdx#onM";
const W9_CODE = "src/w.ts#w";

test("S-6 (tolerance, relocated member): over T10.5-9's present-node arm, dependents of the moved node's two one-sided holders get origin {holder} with the moved node and its deleted child tolerated-optional; a dependent of the moved node itself gets them required", () => {
  const dependents: Record<string, NodeSpec> = {
    [W9]: { children: [W9_ON_P1, W9_ON_P2, W9_ON_M] },
    [W9_ON_P1]: { own: "On P1.", d: [P9_P1] },
    [W9_ON_P2]: { own: "On P2.", d: [P9_P2] },
    [W9_ON_M]: { own: "On M.", d: [P9_P1M] },
  };
  const prediction = derivePathBlocks({
    before: side({ ...P9_BASELINE, ...dependents }, P9_JOURNAL),
    after: side({
      ...p9Current(false),
      ...dependents,
      [W9_ON_M]: { own: "On M.", d: [P9_P2M] },
    }),
    codeBefore: code({ [W9_CODE]: [P9_P2] }),
    codeAfter: code({ [W9_CODE]: [P9_P2] }),
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: P9_P1,
      context: [P9],
      origin: [P9_P1],
    },
    {
      kind: "subtree-coherence",
      scope: P9_P2,
      scopeSet: [P9_P2, P9_P2M, P9_P2MC],
      absent: [P9_P2MC],
      context: [P9],
      origin: [P9_P2, P9_P2M, P9_P2MC],
    },
    {
      kind: "dependency-consistency",
      scope: W9_ON_P1,
      context: [P9_P1],
      origin: [P9_P1],
      originOptional: [P9_P2M, P9_P2MC],
    },
    {
      kind: "dependency-consistency",
      scope: W9_ON_P2,
      context: [P9_P2],
      origin: [P9_P2],
      originOptional: [P9_P2M, P9_P2MC],
    },
    {
      kind: "dependency-consistency",
      scope: W9_ON_M,
      context: [P9_P2M],
      origin: [P9_P2M, P9_P2MC],
    },
    {
      kind: "code-impact",
      scope: W9_CODE,
      context: [P9_P2],
      origin: [P9_P2],
      originOptional: [P9_P2M, P9_P2MC],
    },
  ]);
});

const G9 = "specs/G.mdx";
const G9_Q = "specs/G.mdx#q";
const G9_G = "specs/G.mdx#q.g";
const G9_U = "specs/G.mdx#u";
const G9_X = "specs/G.mdx#x";

test("S-6 (tolerance, deleted edge-bearing member): q loses its child g, whose d edge reached the edited u — x, depending on q, gets origin {q, g}, u tolerated-optional", () => {
  const prediction = derivePathBlocks({
    before: side({
      [G9]: { children: [G9_Q, G9_U, G9_X] },
      [G9_Q]: { own: "Losing parent text.", children: [G9_G] },
      [G9_G]: { own: "Departing member text.", d: [G9_U] },
      [G9_U]: { own: "You text v0." },
      [G9_X]: { own: "Dependent text.", d: [G9_Q] },
    }),
    after: side({
      [G9]: { children: [G9_Q, G9_U, G9_X] },
      [G9_Q]: { own: "Losing parent text." },
      [G9_U]: { own: "You text v1." },
      [G9_X]: { own: "Dependent text.", d: [G9_Q] },
    }),
    codeBefore: NO_CODE,
    codeAfter: NO_CODE,
  });
  expectItems(prediction, [
    {
      kind: "subtree-coherence",
      scope: G9_Q,
      scopeSet: [G9_Q, G9_G],
      absent: [G9_G],
      context: [G9],
      origin: [G9_Q, G9_G],
    },
    {
      kind: "subtree-coherence",
      scope: G9_U,
      context: [G9],
      origin: [G9_U],
    },
    {
      kind: "dependency-consistency",
      scope: G9_X,
      context: [G9_Q],
      origin: [G9_Q, G9_G],
      originOptional: [G9_U],
    },
  ]);
});

// =============================================================================
// Misuse guards
// =============================================================================

const MG = "specs/M.mdx";
const MG_A = "specs/M.mdx#a";
const MG_B = "specs/M.mdx#b";

/** A raw node: the builder's keys, the `d` and edge lists given verbatim. */
function raw(
  children: readonly string[],
  dTargets: readonly string[],
  edgeTargets: readonly string[],
  meta = "",
): PathBlocksNode {
  return {
    children,
    ownKey: JSON.stringify(["", children]),
    metaKey: meta,
    pairKey: JSON.stringify(edgeTargets),
    edgeTargets,
    dTargets,
  };
}

function guarded(
  before: PathBlocksSide,
  after: PathBlocksSide,
  codeBefore: PathBlocksCode = NO_CODE,
  codeAfter: PathBlocksCode = NO_CODE,
): () => unknown {
  return () => derivePathBlocks({ before, after, codeBefore, codeAfter });
}

test("S-6: a d target outside edgeTargets, or listed twice, throws", () => {
  const ok = new Map([
    [MG, raw([MG_A, MG_B], [], [])],
    [MG_B, raw([], [], [])],
  ]);
  const outside = new Map(ok).set(MG_A, raw([], [MG_B], []));
  expect(guarded(outside, outside)).toThrow(
    /path-blocks oracle misuse:.*not among its edgeTargets/,
  );
  const twice = new Map(ok).set(MG_A, raw([], [MG_B, MG_B], [MG_B]));
  expect(guarded(twice, twice)).toThrow(
    /path-blocks oracle misuse:.*d target .* twice/,
  );
});

test("S-6: d-target sets differing under one metaKey throw", () => {
  const before = new Map([
    [MG, raw([MG_A, MG_B], [], [])],
    [MG_A, raw([], [MG_B], [MG_B], "same")],
    [MG_B, raw([], [], [])],
  ]);
  const after = new Map(before).set(MG_A, raw([], [], [MG_B], "same"));
  expect(guarded(before, after)).toThrow(
    /path-blocks oracle misuse:.*metaKey must cover the d-target set/,
  );
});

test("S-6: a dependency or impact edge whose target has no node on its side throws", () => {
  const dangling = new Map([
    [MG, raw([MG_A], [], [])],
    [MG_A, raw([], [], [MG_B])],
  ]);
  expect(guarded(dangling, dangling)).toThrow(
    /path-blocks oracle misuse:.*dependency edge targets .*no baseline node/,
  );
  const ok = new Map([
    [MG, raw([MG_A], [], [])],
    [MG_A, raw([], [], [])],
  ]);
  expect(guarded(ok, ok, NO_CODE, new Map([["src/m.ts", [MG_B]]]))).toThrow(
    /path-blocks oracle misuse:.*impact edge targets .*no current node/,
  );
});

test("S-6: a section hanging below no parent, or a child of two nodes on one side, throws", () => {
  const orphan = new Map([
    [MG, raw([], [], [])],
    [MG_A, raw([], [], [])],
  ]);
  expect(guarded(orphan, orphan)).toThrow(
    /path-blocks oracle misuse:.*hangs below no parent/,
  );
  const twoParents = new Map([
    [MG, raw([MG_A, MG_B], [], [])],
    [MG_A, raw([MG_B], [], [])],
    [MG_B, raw([], [], [])],
  ]);
  expect(guarded(twoParents, twoParents)).toThrow(
    /path-blocks oracle misuse:.*child of both/,
  );
});

test("S-6: the graph-diff oracle's own guards stand (a contains-cycle throws)", () => {
  const cyclic = new Map([
    [MG, raw([MG_A], [], [])],
    [MG_A, raw([MG], [], [])],
  ]);
  expect(guarded(cyclic, cyclic)).toThrow(
    /graph-diff oracle misuse:.*contains-cycle/,
  );
});
