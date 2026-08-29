// S-6 coverage-reachability-oracle vectors (TEST-SPEC 17 S-6): the
// in-harness coverage oracle for P-13 (test/helpers/oracles/coverage.ts)
// passes this fixed vector suite, derived from SPEC.md 15's worked material,
// before any property test trusts it. Every vector's result table is
// hand-computed; no product is involved (the product's own SPEC 8 behavior
// is asserted by the suite's T8-*/T8.2-1/T15-1 tests against fixtures, not
// against this oracle).
//
// The vectors run profiles over SPEC.md 15's exact worked workspace — the
// graph its "Graph:" listing spells out (specs/SPEC.mdx with print >
// print.hello tags="critical"; specs/DERIVED.mdx with derived >
// derived.hello; src/hello.ts#hello; the depends and references edges) —
// grouped as T15-1 stages it (spec group `spec`, spec group `derived`, code
// group `src`). Coverage, by the worked material and the rules each vector
// derives from (the sibling S-6 suites' practice: the named section's
// examples and rules):
//   * the worked statement itself — "The path hello → derived.hello →
//     print.hello satisfies a transitive coverage profile targeting
//     print.hello" (15; T15-1's profile) — with the full 8.2 result;
//   * `direct` vs `transitive` (8: a single edge vs one or more) on the
//     same worked path, and a one-edge direct profile over the depends edge;
//   * `edgeKinds` restrictions (7.4, 8: only the profile's kinds) breaking
//     the worked path at its references step, at its depends step, and
//     keeping it whole;
//   * `targets: "all"` vs the `"leaves"` default (7.4, 8.1) and `contains`
//     never granting (8): `print`, connected only by containment, stays
//     uncovered while its child is covered;
//   * `targetTags` (7.4, 8.1: at least one listed tag) carried, lacking,
//     and any-of, with the ignored reasons in the fixed 8.2 order — root
//     node, coverage="none", non-leaf, lacking-tags — pinned on the root,
//     on `print`, and on `print.hello`;
//   * `coverage="none"` (2.5, 8.1) as minimal attribute variants of the
//     same workspace: exclusion, reason order beside lacking-tags, and 2.5's
//     descendants-retain-their-own-behavior sentence;
//   * root exclusions (8, 4.5): a root marker plus a root-sourced embeds
//     edge — 4.5's "a root marker grants no coverage in any profile" — never
//     extend a path (root never boundary node, intermediate, or target),
//     and a boundary root with a one-edge route loses to a non-root
//     boundary node's path;
//   * the 12.0 tie-break (8.2): equal-length paths tie-broken at the
//     boundary element and at an interior element, and shortest-first
//     dominating byte order;
// plus misuse guards: incomplete graphs, duplicate group members,
// self-edges, contains/depends/embeds cycles, roots carrying tags or a
// coverage attribute, and empty edgeKinds/targetTags lists throw plain
// errors (harness defects), never diagnosed product failures.

import { expect, test } from "vitest";
import { computeCoverage } from "../helpers/oracles/coverage.js";
import type {
  CoverageOracleEdge,
  CoverageOracleInput,
  CoverageOracleNode,
  CoverageOracleProfile,
  CoverageOracleResult,
} from "../helpers/oracles/coverage.js";

// --- SPEC.md 15's worked workspace ------------------------------------------

const SPEC_ROOT = "specs/SPEC.mdx";
const PRINT = "specs/SPEC.mdx#print";
const PRINT_HELLO = "specs/SPEC.mdx#print.hello";
const DERIVED_ROOT = "specs/DERIVED.mdx";
const DERIVED = "specs/DERIVED.mdx#derived";
const DERIVED_HELLO = "specs/DERIVED.mdx#derived.hello";
const HELLO = "src/hello.ts#hello";

/** SPEC 15's two dependency edges (its `contains` rows are the children). */
const SPEC15_EDGES: readonly CoverageOracleEdge[] = [
  { source: DERIVED_HELLO, target: PRINT_HELLO, kind: "depends" },
  { source: HELLO, target: DERIVED_HELLO, kind: "references" },
];

/** T15-1's grouping of the worked workspace. */
const SPEC_GROUP = [SPEC_ROOT, PRINT, PRINT_HELLO] as const;
const DERIVED_GROUP = [DERIVED_ROOT, DERIVED, DERIVED_HELLO] as const;
const SRC_GROUP = [HELLO] as const;

interface ModelOptions {
  /** Attribute variants of the worked workspace (SPEC 2.5). */
  readonly printCoverage?: "none";
  readonly printHelloCoverage?: "none";
  /** Replacement dependency edges (default: SPEC 15's two). */
  readonly edges?: readonly CoverageOracleEdge[];
}

function node(spec: Partial<CoverageOracleNode> = {}): CoverageOracleNode {
  return {
    root: spec.root ?? false,
    children: spec.children ?? [],
    coverage: spec.coverage ?? null,
    tags: spec.tags ?? [],
  };
}

/** SPEC 15's graph (nodes and dependency edges), with minimal variants. */
function spec15Model(options: ModelOptions = {}): {
  nodes: Map<string, CoverageOracleNode>;
  edges: readonly CoverageOracleEdge[];
} {
  return {
    nodes: new Map<string, CoverageOracleNode>([
      [SPEC_ROOT, node({ root: true, children: [PRINT] })],
      [
        PRINT,
        node({ children: [PRINT_HELLO], coverage: options.printCoverage }),
      ],
      [
        PRINT_HELLO,
        node({ tags: ["critical"], coverage: options.printHelloCoverage }),
      ],
      [DERIVED_ROOT, node({ root: true, children: [DERIVED] })],
      [DERIVED, node({ children: [DERIVED_HELLO] })],
      [DERIVED_HELLO, node()],
      [HELLO, node()],
    ]),
    edges: options.edges ?? SPEC15_EDGES,
  };
}

/** Run one profile over the (possibly variant) worked workspace. */
function run(
  profile: CoverageOracleProfile & {
    readonly target: readonly string[];
    readonly boundary: readonly string[];
  },
  options: ModelOptions = {},
): CoverageOracleResult {
  const { target, boundary, ...rest } = profile;
  const { nodes, edges } = spec15Model(options);
  const input: CoverageOracleInput = {
    nodes,
    edges,
    targetGroup: target,
    boundaryGroup: boundary,
    profile: rest,
  };
  return computeCoverage(input);
}

/** SPEC 15's worked covering path, boundary node first (8.2). */
const WORKED_PATH = [HELLO, DERIVED_HELLO, PRINT_HELLO] as const;

// =============================================================================
// The worked statement (15, T15-1's profile) and its direct-mode contrast
// =============================================================================

test("S-6 (15 walkthrough): the transitive profile targeting print.hello with src as code boundary is satisfied via hello → derived.hello → print.hello, with the root and print ignored as 8.2 spells", () => {
  expect(
    run({ target: SPEC_GROUP, boundary: SRC_GROUP, mode: "transitive" }),
  ).toEqual({
    counts: { required: 1, covered: 1, uncovered: 0, ignored: 2 },
    required: [PRINT_HELLO],
    covered: [{ identity: PRINT_HELLO, path: [...WORKED_PATH] }],
    uncovered: [],
    ignored: [
      { identity: SPEC_ROOT, reasons: ["root", "non-leaf"] },
      { identity: PRINT, reasons: ["non-leaf"] },
    ],
  });
});

test("S-6 (8 direct vs transitive): the worked two-edge path does not cover in direct mode — a single edge is required", () => {
  expect(
    run({ target: SPEC_GROUP, boundary: SRC_GROUP, mode: "direct" }),
  ).toEqual({
    counts: { required: 1, covered: 0, uncovered: 1, ignored: 2 },
    required: [PRINT_HELLO],
    covered: [],
    uncovered: [PRINT_HELLO],
    ignored: [
      { identity: SPEC_ROOT, reasons: ["root", "non-leaf"] },
      { identity: PRINT, reasons: ["non-leaf"] },
    ],
  });
});

test("S-6 (8 direct): the single depends edge from the derived spec boundary covers print.hello over exactly [boundary node, target]", () => {
  const result = run({
    target: SPEC_GROUP,
    boundary: DERIVED_GROUP,
    mode: "direct",
  });
  expect(result.covered).toEqual([
    { identity: PRINT_HELLO, path: [DERIVED_HELLO, PRINT_HELLO] },
  ]);
  expect(result.uncovered).toEqual([]);
  expect(result.counts).toEqual({
    required: 1,
    covered: 1,
    uncovered: 0,
    ignored: 2,
  });
});

// =============================================================================
// edgeKinds restrictions (7.4, 8) over the worked path
// =============================================================================

test("S-6 (7.4 edgeKinds): the worked path covers only under kinds admitting both its references and its depends step", () => {
  const profile = {
    target: SPEC_GROUP,
    boundary: SRC_GROUP,
    mode: "transitive",
  } as const;
  for (const edgeKinds of [["depends"], ["references"], ["embeds"]] as const) {
    const result = run({ ...profile, edgeKinds: [...edgeKinds] });
    expect(result.covered).toEqual([]);
    expect(result.uncovered).toEqual([PRINT_HELLO]);
  }
  expect(
    run({ ...profile, edgeKinds: ["depends", "references"] }).covered,
  ).toEqual([{ identity: PRINT_HELLO, path: [...WORKED_PATH] }]);
});

// =============================================================================
// targets "all" vs "leaves"; contains never grants (7.4, 8, 8.1)
// =============================================================================

test('S-6 (8 contains, 7.4 targets "all"): print joins the required set yet stays uncovered — its only connection is containment — and the root\'s ignored reasons drop non-leaf', () => {
  expect(
    run({
      target: SPEC_GROUP,
      boundary: SRC_GROUP,
      mode: "transitive",
      targets: "all",
    }),
  ).toEqual({
    counts: { required: 2, covered: 1, uncovered: 1, ignored: 1 },
    required: [PRINT, PRINT_HELLO],
    covered: [{ identity: PRINT_HELLO, path: [...WORKED_PATH] }],
    uncovered: [PRINT],
    ignored: [{ identity: SPEC_ROOT, reasons: ["root"] }],
  });
});

test("S-6 (8 one-or-more edges): boundary membership alone covers nothing — with the derived group as its own boundary, derived.hello is a boundary node yet uncovered — while the code boundary covers it and leaves its containment-only parent uncovered", () => {
  expect(
    run({
      target: DERIVED_GROUP,
      boundary: DERIVED_GROUP,
      mode: "transitive",
      targets: "all",
    }),
  ).toEqual({
    counts: { required: 2, covered: 0, uncovered: 2, ignored: 1 },
    required: [DERIVED, DERIVED_HELLO],
    covered: [],
    uncovered: [DERIVED, DERIVED_HELLO],
    ignored: [{ identity: DERIVED_ROOT, reasons: ["root"] }],
  });
  expect(
    run({
      target: DERIVED_GROUP,
      boundary: SRC_GROUP,
      mode: "transitive",
      targets: "all",
    }),
  ).toEqual({
    counts: { required: 2, covered: 1, uncovered: 1, ignored: 1 },
    required: [DERIVED, DERIVED_HELLO],
    covered: [{ identity: DERIVED_HELLO, path: [HELLO, DERIVED_HELLO] }],
    uncovered: [DERIVED],
    ignored: [{ identity: DERIVED_ROOT, reasons: ["root"] }],
  });
});

// =============================================================================
// targetTags (7.4, 8.1) and the fixed 8.2 reason order
// =============================================================================

test('S-6 (8.1 targetTags carried): targetTags ["critical"] keeps print.hello required and covered, and the tag reason joins the fixed reason order on the root and on print', () => {
  expect(
    run({
      target: SPEC_GROUP,
      boundary: SRC_GROUP,
      mode: "transitive",
      targetTags: ["critical"],
    }),
  ).toEqual({
    counts: { required: 1, covered: 1, uncovered: 0, ignored: 2 },
    required: [PRINT_HELLO],
    covered: [{ identity: PRINT_HELLO, path: [...WORKED_PATH] }],
    uncovered: [],
    ignored: [
      { identity: SPEC_ROOT, reasons: ["root", "non-leaf", "lacking-tags"] },
      { identity: PRINT, reasons: ["non-leaf", "lacking-tags"] },
    ],
  });
});

test("S-6 (8.1 targetTags lacking, and any-of): a tag list print.hello lacks empties the required set and ignores it as lacking-tags; a list carrying any of its tags keeps it required", () => {
  expect(
    run({
      target: SPEC_GROUP,
      boundary: SRC_GROUP,
      mode: "transitive",
      targetTags: ["missing"],
    }),
  ).toEqual({
    counts: { required: 0, covered: 0, uncovered: 0, ignored: 3 },
    required: [],
    covered: [],
    uncovered: [],
    ignored: [
      { identity: SPEC_ROOT, reasons: ["root", "non-leaf", "lacking-tags"] },
      { identity: PRINT, reasons: ["non-leaf", "lacking-tags"] },
      { identity: PRINT_HELLO, reasons: ["lacking-tags"] },
    ],
  });
  expect(
    run({
      target: SPEC_GROUP,
      boundary: SRC_GROUP,
      mode: "transitive",
      targetTags: ["missing", "critical"],
    }).covered,
  ).toEqual([{ identity: PRINT_HELLO, path: [...WORKED_PATH] }]);
});

// =============================================================================
// coverage="none" (2.5, 8.1) as minimal attribute variants
// =============================================================================

test('S-6 (8.1 coverage="none"): marking print.hello excludes it — ignored as coverage-none, its tag sparing it the lacking-tags reason exactly when carried', () => {
  expect(
    run(
      { target: SPEC_GROUP, boundary: SRC_GROUP, mode: "transitive" },
      { printHelloCoverage: "none" },
    ),
  ).toEqual({
    counts: { required: 0, covered: 0, uncovered: 0, ignored: 3 },
    required: [],
    covered: [],
    uncovered: [],
    ignored: [
      { identity: SPEC_ROOT, reasons: ["root", "non-leaf"] },
      { identity: PRINT, reasons: ["non-leaf"] },
      { identity: PRINT_HELLO, reasons: ["coverage-none"] },
    ],
  });
  const tagged = (tags: readonly string[]): readonly string[] | undefined =>
    run(
      {
        target: SPEC_GROUP,
        boundary: SRC_GROUP,
        mode: "transitive",
        targetTags: [...tags],
      },
      { printHelloCoverage: "none" },
    ).ignored.find((row) => row.identity === PRINT_HELLO)?.reasons;
  // The fixed order places coverage-none ahead of lacking-tags (8.2), and
  // only applicable reasons appear (print.hello carries "critical").
  expect(tagged(["missing"])).toEqual(["coverage-none", "lacking-tags"]);
  expect(tagged(["critical"])).toEqual(["coverage-none"]);
});

test('S-6 (8.2 reason order): print marked coverage="none" — simultaneously coverage-excluded, a parent, and lacking the listed tag — carries the fixed-order triple coverage-none, non-leaf, lacking-tags', () => {
  expect(
    run(
      {
        target: SPEC_GROUP,
        boundary: SRC_GROUP,
        mode: "transitive",
        targetTags: ["missing"],
      },
      { printCoverage: "none" },
    ).ignored,
  ).toEqual([
    { identity: SPEC_ROOT, reasons: ["root", "non-leaf", "lacking-tags"] },
    {
      identity: PRINT,
      reasons: ["coverage-none", "non-leaf", "lacking-tags"],
    },
    { identity: PRINT_HELLO, reasons: ["lacking-tags"] },
  ]);
  expect(
    run(
      { target: SPEC_GROUP, boundary: SRC_GROUP, mode: "transitive" },
      { printCoverage: "none" },
    ).ignored,
  ).toEqual([
    { identity: SPEC_ROOT, reasons: ["root", "non-leaf"] },
    { identity: PRINT, reasons: ["coverage-none", "non-leaf"] },
  ]);
});

test('S-6 (2.5 descendants retain behavior): marking print coverage="none" leaves print.hello required and covered under targets "all", print ignored as coverage-none alone', () => {
  expect(
    run(
      {
        target: SPEC_GROUP,
        boundary: SRC_GROUP,
        mode: "transitive",
        targets: "all",
      },
      { printCoverage: "none" },
    ),
  ).toEqual({
    counts: { required: 1, covered: 1, uncovered: 0, ignored: 2 },
    required: [PRINT_HELLO],
    covered: [{ identity: PRINT_HELLO, path: [...WORKED_PATH] }],
    uncovered: [],
    ignored: [
      { identity: SPEC_ROOT, reasons: ["root"] },
      { identity: PRINT, reasons: ["coverage-none"] },
    ],
  });
});

// =============================================================================
// Root exclusions (8, 4.5): marker on the DERIVED root plus a root-sourced
// embeds edge — the 4.5 sentence: a root marker grants no coverage
// =============================================================================

/** The worked graph with hello's marker retargeted to the DERIVED root and
 * a top-level embedding in DERIVED.mdx (root-sourced, SPEC 2.3). */
const ROOT_ADJACENT_EDGES: readonly CoverageOracleEdge[] = [
  { source: HELLO, target: DERIVED_ROOT, kind: "references" },
  { source: DERIVED_ROOT, target: PRINT_HELLO, kind: "embeds" },
  { source: DERIVED_HELLO, target: PRINT_HELLO, kind: "depends" },
];

test("S-6 (8, 4.5 root exclusions): the hello → DERIVED-root → print.hello chain never covers — a root is never an intermediate, and neither the root-targeted nor the root-sourced edge extends a path", () => {
  expect(
    run(
      { target: SPEC_GROUP, boundary: SRC_GROUP, mode: "transitive" },
      { edges: ROOT_ADJACENT_EDGES },
    ),
  ).toEqual({
    counts: { required: 1, covered: 0, uncovered: 1, ignored: 2 },
    required: [PRINT_HELLO],
    covered: [],
    uncovered: [PRINT_HELLO],
    ignored: [
      { identity: SPEC_ROOT, reasons: ["root", "non-leaf"] },
      { identity: PRINT, reasons: ["non-leaf"] },
    ],
  });
});

test("S-6 (8 boundary roots): the derived boundary group contributes only its non-root nodes — the root's own one-edge embeds route (byte-least were roots admitted) loses to derived.hello's depends edge", () => {
  for (const mode of ["direct", "transitive"] as const) {
    const result = run(
      { target: SPEC_GROUP, boundary: DERIVED_GROUP, mode },
      { edges: ROOT_ADJACENT_EDGES },
    );
    expect(result.covered).toEqual([
      { identity: PRINT_HELLO, path: [DERIVED_HELLO, PRINT_HELLO] },
    ]);
    expect(result.uncovered).toEqual([]);
  }
});

// =============================================================================
// The 12.0 tie-break (8.2): equal-length paths, boundary and interior
// elements, and shortest-first before byte order
// =============================================================================

test("S-6 (12.0 tie-break, boundary element): two equal-length covering edges tie-break to the byte-least boundary node", () => {
  const edges: readonly CoverageOracleEdge[] = [
    ...SPEC15_EDGES,
    { source: DERIVED, target: PRINT_HELLO, kind: "depends" },
  ];
  for (const mode of ["direct", "transitive"] as const) {
    expect(
      run({ target: SPEC_GROUP, boundary: DERIVED_GROUP, mode }, { edges })
        .covered,
    ).toEqual([{ identity: PRINT_HELLO, path: [DERIVED, PRINT_HELLO] }]);
  }
});

test("S-6 (12.0 tie-break, interior element): equal-length paths sharing their boundary node tie-break at the first differing interior identity", () => {
  const edges: readonly CoverageOracleEdge[] = [
    ...SPEC15_EDGES,
    { source: DERIVED, target: PRINT_HELLO, kind: "depends" },
    { source: HELLO, target: DERIVED, kind: "references" },
  ];
  expect(
    run(
      { target: SPEC_GROUP, boundary: SRC_GROUP, mode: "transitive" },
      { edges },
    ).covered,
  ).toEqual([{ identity: PRINT_HELLO, path: [HELLO, DERIVED, PRINT_HELLO] }]);
});

test("S-6 (12.0 tie-break, shortest first): a one-edge path beats a two-edge path from a byte-lesser boundary node — length dominates the byte comparison", () => {
  const edges: readonly CoverageOracleEdge[] = [
    ...SPEC15_EDGES,
    { source: DERIVED, target: DERIVED_HELLO, kind: "depends" },
  ];
  expect(
    run(
      { target: SPEC_GROUP, boundary: DERIVED_GROUP, mode: "transitive" },
      { edges },
    ).covered,
  ).toEqual([{ identity: PRINT_HELLO, path: [DERIVED_HELLO, PRINT_HELLO] }]);
});

// =============================================================================
// Misuse guards
// =============================================================================

function inputOf(
  overrides: Partial<CoverageOracleInput> = {},
  options: ModelOptions = {},
): CoverageOracleInput {
  const { nodes, edges } = spec15Model(options);
  return {
    nodes,
    edges,
    targetGroup: SPEC_GROUP,
    boundaryGroup: SRC_GROUP,
    profile: { mode: "transitive" },
    ...overrides,
  };
}

test("S-6: a group member or edge endpoint without a node entry throws — the graph must be complete", () => {
  expect(() =>
    computeCoverage(
      inputOf({ targetGroup: [...SPEC_GROUP, "specs/GHOST.mdx#g"] }),
    ),
  ).toThrow(/oracle misuse:.*no node for specs\/GHOST\.mdx#g/);
  expect(() =>
    computeCoverage(
      inputOf({
        edges: [
          { source: HELLO, target: "specs/GHOST.mdx#g", kind: "references" },
        ],
      }),
    ),
  ).toThrow(/oracle misuse:.*no node for specs\/GHOST\.mdx#g/);
});

test("S-6: a duplicate group member throws — a group's nodes form a set", () => {
  expect(() =>
    computeCoverage(inputOf({ boundaryGroup: [HELLO, HELLO] })),
  ).toThrow(/oracle misuse:.*duplicate boundary-group member/);
});

test("S-6: a self-edge and a dependency cycle each throw — such workspaces fail validation (SPEC 5.3)", () => {
  expect(() =>
    computeCoverage(
      inputOf({
        edges: [{ source: PRINT_HELLO, target: PRINT_HELLO, kind: "depends" }],
      }),
    ),
  ).toThrow(/oracle misuse:.*self-edge/);
  expect(() =>
    computeCoverage(
      inputOf({
        edges: [
          ...SPEC15_EDGES,
          { source: PRINT_HELLO, target: DERIVED_HELLO, kind: "embeds" },
        ],
      }),
    ),
  ).toThrow(/oracle misuse:.*cycle/);
});

test("S-6: a root carrying tags or a coverage attribute throws (SPEC 5.5)", () => {
  const { edges } = spec15Model();
  const nodes = new Map(spec15Model().nodes);
  nodes.set(SPEC_ROOT, {
    root: true,
    children: [PRINT],
    coverage: null,
    tags: ["critical"],
  });
  expect(() => computeCoverage(inputOf({ nodes, edges }))).toThrow(
    /oracle misuse:.*root node .* carries tags or a coverage attribute/,
  );
});

test("S-6: an empty edgeKinds or targetTags list throws — a configuration error (SPEC 14.14) coverage never evaluates", () => {
  expect(() =>
    computeCoverage(inputOf({ profile: { mode: "direct", edgeKinds: [] } })),
  ).toThrow(/oracle misuse:.*empty edgeKinds/);
  expect(() =>
    computeCoverage(inputOf({ profile: { mode: "direct", targetTags: [] } })),
  ).toThrow(/oracle misuse:.*empty targetTags/);
});
