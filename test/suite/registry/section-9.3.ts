// TEST-SPEC §9.3 (impact-analysis output: ancestor collapsing, witness edge
// and path selection, deletion identities) — SUITE-32: T9.3-1…T9.3-3.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// Staging follows the SUITE-31 protocol (see section-9.ts): baselines are
// committed git sources only (no build output at the ref; where a workspace
// carries two sequential baselines, the second is committed before the first
// build — the T5.6-4 pattern), the current side is the edited working tree,
// rebuilt (`build`, exit 0) before every `impact` run, and code locations are
// whole files (SPEC 4.6). Each body is its staging (`runT93<n>Staging`) run
// with section-5.6.ts's home visitor, as in section-9.ts: T12.0-15's
// `impact` family runs the same stagings (`T9_3_IMPACT_STAGINGS`) with its
// human twin as the visitor, after its first product invocation, so every
// source they stage is a staged-source record (S-9), the configurations
// included.
//
// Conservative operationalizations (noted per H-4):
// - T9.3-1 asserts entry granularity directly on the adapter's requirement
//   entries (each carries the node identities it covers): a maximal
//   collapsible chain must be exactly one entry naming exactly its members,
//   and a node outside every chain (another category, different attribution,
//   or an originating node) must never share an entry with any other node.
//   Within-entry node order is not asserted (SPEC 9.3 fixes the covering, not
//   a sequence; T12.0-7 owns ordering determinism).
// - T9.3-2 asserts impacted-code entries whole ({location, edge, path}) via
//   section-9.ts's assertImpactedCode: in every fixture the minimizing edge
//   and path are unique once SPEC 9.3's selection rules (shortest, 12.0
//   byte-least tie, `embeds` over `references`) are applied, so the entire
//   entry content is spec-fixed.
// - T9.3-3's twice-reported identity cannot go through
//   assertImpactCategories (that helper merges entries per identity and
//   requires one consistent deleted flag), so its second arm asserts the raw
//   entries: exactly two name the identity, one flagged deleted and one not,
//   each covering it alone, each `changed` only (SPEC 5.6).
// - The human form (T12.0-1's information parity; SPEC 12.0): after each
//   `impact --base <ref> --json` read and its assertions — T9.3-1's,
//   T9.3-2's two (the selection arms and the metadata terminus), and
//   T9.3-3's two arms' — at the same state, section-9.ts's
//   `assertHumanImpactReport` runs the same argv without `--json` (exit 0)
//   and asks its report for what the decoded report carries: every
//   requirement entry's nodes and attribution identities and every code
//   entry's location, edge source and target, and path nodes (identity-or-
//   path boundaries, so a chain member `specs/Chain.mdx#a.b.c` never counts
//   inside `specs/Chain.mdx#a.b.c.d`), then, with those identities blanked
//   out, the entries' categories, `deleted` where an entry is deleted, each
//   code entry's edge kind, and the non-empty groups' `direct` and
//   `transitive` (SPEC-named tokens; robust matching, H-3; section-9.ts's
//   module header states the check). Limits, beside that header's: no
//   mention is associated with another or counted, so which nodes one entry
//   covers — the collapsing itself (T9.3-1) — which edge and path a
//   location's minimization selected and that the reported kind is the
//   preferred `embeds` for that location (T9.3-2: the human report is asked
//   for `embeds` and `references` both, wherever they stand), which entry is
//   deleted, and that an identity appears twice, once deleted and once added
//   (T9.3-3), stay with the JSON assertions; the scratch builds of FIX_PLAN
//   Task 8 that drop the `embeds` kind word, the `deleted` marker, the
//   directly impacted group's word, the edge kinds, or the code sections
//   fail T9.3-2's selection arms (and, the `deleted` marker, T9.3-3's first
//   arm), and those dropping attributions, edge targets, or paths pass
//   every T9.3 test, as in section-9.ts.

import * as fsp from "node:fs/promises";
import type {
  ChangeCategory,
  ImpactReport,
  ImpactRequirementEntry,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import type { ImpactReadVisitor, ImpactStaging } from "./section-5.6.js";
import {
  HOME_IMPACT_READS,
  IMPACT_SPECS_ONLY_CONFIG,
  assertImpactCategories,
  impactAgainst,
} from "./section-5.6.js";
import {
  IMPACT_SPEC_AND_CODE_CONFIG,
  assertHumanImpactReport,
  assertImpactedCode,
  readSourceText,
} from "./section-9.js";
import { assertSameJson, buildOk, expectExit } from "./support.js";

/**
 * Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1).
 * The configuration and every file are staged-source records (S-9's
 * TypeScript and timing clauses): T12.0-15's `impact` family stages every
 * workspace here after its first product invocation, and T9.3-3 its arm 2's
 * after arm 1's.
 */
async function withWorkspace<T>(
  config: StagedTs,
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Apply a manual edit to a source file the product has rewritten: read it,
 * require `expected` to occur exactly once (a crisp premise diagnosis ahead
 * of the impact assertions, the T9.2-5 pattern — rename rewrites are
 * minimal in-place edits, SPEC 6.4, so the staged construct must still be
 * present verbatim up to its rewritten identity), and replace it with
 * `replacement` through `workspace.edit()` — an edit of bytes the product
 * wrote, judged at staging time (no harness constant equals them, so it is
 * no staged-source record; helpers/staged-mdx.ts).
 */
async function editSourceExpecting(
  workspace: TestWorkspace,
  rel: string,
  expected: string,
  replacement: string,
  context: string,
): Promise<void> {
  const text = await readSourceText(workspace, rel, context);
  const first = text.indexOf(expected);
  if (first === -1 || text.indexOf(expected, first + 1) !== -1) {
    fail(
      `${context}: expected ${rel} to contain exactly one occurrence of ` +
        `${JSON.stringify(expected)} — rename rewrites identities and ` +
        `reference spellings only, as minimal in-place edits (SPEC 6.2, ` +
        `6.4); got: ${JSON.stringify(text)}`,
    );
  }
  await workspace.edit(rel, expected, replacement);
}

// ---------------------------------------------------------------------------
// T9.3-1 — ancestor collapsing
// ---------------------------------------------------------------------------

/** One maximal collapsible ancestor chain of a fixture (SPEC 9.3). */
interface ChainExpectation {
  /** The chain's exact member set (more than one node — real collapsing). */
  readonly nodes: readonly string[];
  /** The shared `descendant-changed` attribution, identical along the chain. */
  readonly attributedTo: readonly string[];
}

/**
 * Assert SPEC 9.3's entry granularity over a report's requirement entries:
 *
 * - each expected maximal chain appears as exactly ONE entry — "one entry
 *   covering the chain, rather than one entry per node" — naming exactly the
 *   chain's members, not deleted, carrying `descendant-changed` as its only
 *   category with the chain's shared attribution;
 * - every `standalone` identity (an ancestor carrying another category or a
 *   different attribution — a chain breaker — or an originating node) is
 *   covered alone by every entry naming it: it belongs to no chain.
 *
 * Category/attribution semantics per node are asserted separately via
 * assertImpactCategories; this helper owns only the collapsing.
 */
function assertAncestorCollapsing(
  report: ImpactReport,
  chains: readonly ChainExpectation[],
  standalone: readonly string[],
  context: string,
): void {
  for (const chain of chains) {
    const members = new Set(chain.nodes);
    const naming = report.requirements.filter((entry) =>
      entry.nodes.some((identity) => members.has(identity)),
    );
    const render = JSON.stringify(chain.nodes);
    if (naming.length !== 1) {
      fail(
        `${context}: the maximal ancestor chain ${render} — every member's ` +
          `only category \`descendant-changed\` with identical attribution — ` +
          `must appear as exactly one entry covering the chain, rather than ` +
          `one entry per node (SPEC 9.3); ${String(naming.length)} entries ` +
          `name its members: ${JSON.stringify(naming)}`,
      );
    }
    const entry = naming[0]!;
    assertSameJson(
      [...entry.nodes].sort(),
      [...chain.nodes].sort(),
      `${context}: the one entry covering the chain ${render} must name ` +
        `exactly its members — no member split off, and no node outside the ` +
        `maximal chain (a chain-breaking ancestor, an originating node, or ` +
        `another chain's member) lumped in (SPEC 9.3)`,
    );
    if (entry.deleted) {
      fail(
        `${context}: the chain entry ${render} covers nodes present on both ` +
          `sides and must not be flagged deleted (SPEC 9.3); entry: ` +
          JSON.stringify(entry),
      );
    }
    assertSameJson(
      [...new Set(entry.categories.map((category) => category.category))],
      ["descendant-changed"],
      `${context}: the chain entry ${render} carries exactly ` +
        `\`descendant-changed\` — the collapsed chain's defining and only ` +
        `category (SPEC 9.3, 5.6)`,
    );
    assertSameJson(
      [
        ...new Set(
          entry.categories.flatMap((category) => category.attributedTo),
        ),
      ].sort(),
      [...chain.attributedTo].sort(),
      `${context}: the chain entry ${render} must carry the chain's shared ` +
        `attribution — collapsing is defined alongside identical attribution ` +
        `(SPEC 9.3, 5.6)`,
    );
  }
  for (const identity of standalone) {
    for (const entry of report.requirements) {
      if (entry.nodes.includes(identity) && entry.nodes.length !== 1) {
        fail(
          `${context}: every entry naming ${identity} must cover it alone — ` +
            `carrying another category, a different attribution, or an ` +
            `originating edit, it belongs to no collapsible ancestor chain ` +
            `(SPEC 9.3); entry: ${JSON.stringify(entry)}`,
        );
      }
    }
  }
}

// Arm A (category breaker): a five-deep path to the edited leaf, with the
// mid ancestor `a.b` also tags-edited — `metadata-changed` breaks the chain
// while propagating nothing (SPEC 5.6: a tags-only edit changes no
// effectiveHash), so attribution stays identical along both fragments. An
// untouched sibling subtree (`a.z`) is the uncategorized control.
const A1_FILE = "specs/Chain.mdx";
const A1_A = "specs/Chain.mdx#a";
const A1_AB = "specs/Chain.mdx#a.b";
const A1_ABC = "specs/Chain.mdx#a.b.c";
const A1_ABCD = "specs/Chain.mdx#a.b.c.d";
const A1_LEAF = "specs/Chain.mdx#a.b.c.d.leaf";
const A1_AZ = "specs/Chain.mdx#a.z";

const chainSource = (leafText: string, abTags: string): string =>
  [
    '<S id="a">',
    "Ancestor a text.",
    "",
    `<S id="a.b" tags="${abTags}">`,
    "Ancestor a.b text.",
    "",
    '<S id="a.b.c">',
    "Ancestor a.b.c text.",
    "",
    '<S id="a.b.c.d">',
    "Ancestor a.b.c.d text.",
    "",
    '<S id="a.b.c.d.leaf">',
    leafText,
    "</S>",
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="a.z">',
    "Untouched sibling text.",
    "</S>",
    "</S>",
    "",
  ].join("\n");

// Arm B (attribution breaker): a four-deep path to one edited leaf plus a
// second originating sibling (`p.s`) directly under `p` — from `p` upward the
// `descendant-changed` attribution gains the second originator, so the chain
// breaks between `p.q` and `p` with no member carrying any extra category.
const B1_FILE = "specs/Attr.mdx";
const B1_P = "specs/Attr.mdx#p";
const B1_PQ = "specs/Attr.mdx#p.q";
const B1_PQR = "specs/Attr.mdx#p.q.r";
const B1_LEAFA = "specs/Attr.mdx#p.q.r.leafa";
const B1_PS = "specs/Attr.mdx#p.s";

const attrSource = (leafaText: string, psText: string): string =>
  [
    '<S id="p">',
    "Ancestor p text.",
    "",
    '<S id="p.q">',
    "Ancestor p.q text.",
    "",
    '<S id="p.q.r">',
    "Ancestor p.q.r text.",
    "",
    '<S id="p.q.r.leafa">',
    leafaText,
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="p.s">',
    psText,
    "</S>",
    "</S>",
    "",
  ].join("\n");

// The fixture's originating nodes (SPEC 5.6): the two edited leaves, the
// tags-edited ancestor, and the second originating sibling.
const T1_ORIGINATORS = [A1_LEAF, A1_AB, B1_LEAFA, B1_PS];

// T9.3-1's sources as staged-source records (S-9): the same template calls,
// moved to module level.
const A1_CHAIN_V1 = stagedMdx(
  'T12.0-15 T9.3-1\'s specs/Chain.mdx at the baseline (chainSource("Chain leaf text v1.", "alpha"))',
  chainSource("Chain leaf text v1.", "alpha"),
);
const A1_CHAIN_V2 = stagedMdx(
  'T12.0-15 T9.3-1\'s specs/Chain.mdx with the leaf edited and a.b tags-edited (chainSource("Chain leaf text v2.", "beta"))',
  chainSource("Chain leaf text v2.", "beta"),
);
const B1_ATTR_V1 = stagedMdx(
  'T12.0-15 T9.3-1\'s specs/Attr.mdx at the baseline (attrSource("Attr leaf text v1.", "Second originator v1."))',
  attrSource("Attr leaf text v1.", "Second originator v1."),
);
const B1_ATTR_V2 = stagedMdx(
  'T12.0-15 T9.3-1\'s specs/Attr.mdx with leafa and p.s edited (attrSource("Attr leaf text v2.", "Second originator v2."))',
  attrSource("Attr leaf text v2.", "Second originator v2."),
);

/** T9.3-1's staging: two chains broken by a category and by an attribution (the module header). */
async function runT931Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  await withWorkspace(
    IMPACT_SPECS_ONLY_CONFIG,
    {
      [A1_FILE]: A1_CHAIN_V1,
      [B1_FILE]: B1_ATTR_V1,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");

      await workspace.file(A1_FILE, A1_CHAIN_V2);
      await workspace.file(B1_FILE, B1_ATTR_V2);
      await buildOk(
        product,
        workspace,
        "T9.3-1 `build` over the edited workspace",
      );

      await visit(workspace, {
        label: "T9.3-1 after the leaf, tags, and second-originator edits",
        ref: base,
        home: async () => {
          const label = "T9.3-1 `impact --base <baseline> --json`";
          const report = await impactAgainst(product, workspace, base, label);

          // Per-node semantics first: exact categories and attributions
          // (SPEC 5.6, 9.1), phantom identities rejected, the untouched
          // sibling uncategorized.
          assertImpactCategories(
            report,
            [
              // Arm A. The edited leaf and the tags-edited ancestor originate.
              {
                identity: A1_LEAF,
                categories: [{ category: "changed", within: T1_ORIGINATORS }],
              },
              {
                identity: A1_ABCD,
                categories: [
                  { category: "descendant-changed", exact: [A1_LEAF] },
                ],
              },
              {
                identity: A1_ABC,
                categories: [
                  { category: "descendant-changed", exact: [A1_LEAF] },
                ],
              },
              // The category breaker: `descendant-changed` with the same
              // attribution as its neighbors, plus `metadata-changed` — a
              // tags-only edit propagates nothing (SPEC 5.6).
              {
                identity: A1_AB,
                categories: [
                  { category: "descendant-changed", exact: [A1_LEAF] },
                  { category: "metadata-changed", within: T1_ORIGINATORS },
                ],
              },
              {
                identity: A1_A,
                categories: [
                  { category: "descendant-changed", exact: [A1_LEAF] },
                ],
              },
              {
                identity: A1_FILE,
                categories: [
                  { category: "descendant-changed", exact: [A1_LEAF] },
                ],
              },
              { identity: A1_AZ, categories: [] },
              // Arm B. Below `p` the cascade carries one originator; from `p`
              // upward it carries both.
              {
                identity: B1_LEAFA,
                categories: [{ category: "changed", within: T1_ORIGINATORS }],
              },
              {
                identity: B1_PQR,
                categories: [
                  { category: "descendant-changed", exact: [B1_LEAFA] },
                ],
              },
              {
                identity: B1_PQ,
                categories: [
                  { category: "descendant-changed", exact: [B1_LEAFA] },
                ],
              },
              {
                identity: B1_P,
                categories: [
                  { category: "descendant-changed", exact: [B1_LEAFA, B1_PS] },
                ],
              },
              {
                identity: B1_FILE,
                categories: [
                  { category: "descendant-changed", exact: [B1_LEAFA, B1_PS] },
                ],
              },
              {
                identity: B1_PS,
                categories: [{ category: "changed", within: T1_ORIGINATORS }],
              },
            ],
            label,
          );

          // The collapsing itself (SPEC 9.3): one entry per maximal chain,
          // breakers and originators covered alone.
          assertAncestorCollapsing(
            report,
            [
              { nodes: [A1_ABCD, A1_ABC], attributedTo: [A1_LEAF] },
              { nodes: [A1_A, A1_FILE], attributedTo: [A1_LEAF] },
              { nodes: [B1_PQR, B1_PQ], attributedTo: [B1_LEAFA] },
              { nodes: [B1_P, B1_FILE], attributedTo: [B1_LEAFA, B1_PS] },
            ],
            [A1_LEAF, A1_AB, B1_LEAFA, B1_PS],
            label,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            report,
            "T9.3-1",
          );
        },
      });
    },
  );
}

const T9_3_1 = defineProductTest({
  id: "T9.3-1",
  title:
    "ancestor collapsing: a maximal chain of ancestors whose only category is `descendant-changed` with identical attribution appears as one entry covering the chain — two-node fragments below and above each breaker — while an ancestor additionally carrying another category (a tags-edited, metadata-changed ancestor) and an ancestor with different attribution (a second originating subtree joining the cascade partway up) each break the chain and are covered alone; and at the `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — each chain's and each lone entry's nodes, categories, and attribution identities (robust matching, H-3) (SPEC 9.3, 5.6, 12.0)",
  run: (product) => runT931Staging(product, HOME_IMPACT_READS),
});

// ---------------------------------------------------------------------------
// T9.3-2 — witness edge and path
// ---------------------------------------------------------------------------

// Selection arms (run 1, all in one workspace against one baseline; each code
// location is evaluated independently, SPEC 9.2/9.3):
//
// - src/minimize.ts holds edges to `deep` (grandchild edited: shortest
//   qualifying path three nodes) and to `shallow` (child edited: two nodes) —
//   edge and path minimize together, so the shorter path's edge is reported.
// - src/tie.ts holds edges to `tb` and `ta` (document order tb first), each
//   with an edited child: two equal-length candidates, resolved by 12.0
//   element-wise byte comparison of the node-identity sequences — `ta`'s.
// - src/kinds.ts holds an `embeds` and a `references` edge to the edited
//   `em`: the chosen first node is the target itself (single-node path), and
//   `embeds` — the byte-least kind — is reported.
// - src/delcase.ts's marker and its target file are deleted; src/newcase.ts
//   and its target are added: an edited/added/deleted edge target yields the
//   single-node path.
//
// Metadata terminus (run 2, against a second sources-only baseline): edit
// only `dd`'s `d` list — no node is `changed`, the location with an edge to
// `mx` (which depends on `dd`) is transitively impacted, and its witness path
// runs from `mx` and ends at `dd`, every node on it with changed
// effectiveHash.
const S2_DEPTH = "specs/Depth.mdx";
const S2_DEEP = "specs/Depth.mdx#deep";
const S2_SHALLOW = "specs/Depth.mdx#shallow";
const S2_SHALLOW_KID = "specs/Depth.mdx#shallow.kid";
const S2_TIE = "specs/Tie.mdx";
const S2_TA = "specs/Tie.mdx#ta";
const S2_TA_KID = "specs/Tie.mdx#ta.kid";
const S2_EM = "specs/Em.mdx";
const S2_EM_NODE = "specs/Em.mdx#em";
const S2_DOOM = "specs/Doom.mdx";
const S2_DOOM_NODE = "specs/Doom.mdx#doom";
const S2_FRESH = "specs/Fresh.mdx";
const S2_FRESH_NODE = "specs/Fresh.mdx#fresh";
const S2_MTGTS = "specs/MTgts.mdx";
const S2_MDEP = "specs/MDep.mdx";
const S2_DD = "specs/MDep.mdx#dd";
const S2_MX_FILE = "specs/MX.mdx";
const S2_MX = "specs/MX.mdx#mx";
const S2_MIN_TS = "src/minimize.ts";
const S2_TIE_TS = "src/tie.ts";
const S2_KINDS_TS = "src/kinds.ts";
const S2_DEL_TS = "src/delcase.ts";
const S2_NEW_TS = "src/newcase.ts";
const S2_META_TS = "src/meta.ts";

const depthSource = (deepLeafText: string, shallowKidText: string): string =>
  [
    '<S id="deep">',
    "Deep target text.",
    "",
    '<S id="deep.mid">',
    "Deep mid text.",
    "",
    '<S id="deep.mid.leaf">',
    deepLeafText,
    "</S>",
    "</S>",
    "</S>",
    "",
    '<S id="shallow">',
    "Shallow target text.",
    "",
    '<S id="shallow.kid">',
    shallowKidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");

// `tb` precedes `ta` in the document, so a product picking by document or
// edge-encounter order reports `tb` — the byte-least candidate is `ta`.
const tieSource = (tbKidText: string, taKidText: string): string =>
  [
    '<S id="tb">',
    "Tie candidate b text.",
    "",
    '<S id="tb.kid">',
    tbKidText,
    "</S>",
    "</S>",
    "",
    '<S id="ta">',
    "Tie candidate a text.",
    "",
    '<S id="ta.kid">',
    taKidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");

const emSource = (text: string): string =>
  ['<S id="em">', text, "</S>", ""].join("\n");
const S2_DOOM_SOURCE = stagedMdx(
  "T12.0-15 T9.3-2's specs/Doom.mdx at the baseline (doom, deleted since with its file)",
  ['<S id="doom">', "Doomed node text.", "</S>", ""].join("\n"),
);
const S2_FRESH_SOURCE = stagedMdx(
  "T12.0-15 T9.3-2's specs/Fresh.mdx, added (fresh)",
  ['<S id="fresh">', "Fresh node text.", "</S>", ""].join("\n"),
);
const S2_MTGTS_SOURCE = stagedMdx(
  "T12.0-15 T9.3-2's specs/MTgts.mdx (the metadata terminus's d targets t1 and t2)",
  [
    '<S id="t1">',
    "Meta target one text.",
    "</S>",
    "",
    '<S id="t2">',
    "Meta target two text.",
    "</S>",
    "",
  ].join("\n"),
);
const mdepSource = (d: string): string =>
  [
    'import MTgts from "./MTgts.xspec"',
    "",
    `<S id="dd" d={${d}}>`,
    "Meta dependency node text.",
    "</S>",
    "",
  ].join("\n");
// The metadata-terminus edit (staged after run 1's build and `impact`): `dd`'s
// `d` list gaining MTgts.t2 — a staged-source record (helpers/staged-mdx.ts),
// the same template call moved to module level. The run-1 stagings precede
// the body's first product invocation, but T12.0-15's `impact` family
// stages them after its own, so they are records too (below and beside the
// body).
const T9_3_2_MDEP_EDITED = stagedMdx(
  "T9.3-2/T12.0-15 specs/MDep.mdx with dd's d list gaining MTgts.t2",
  mdepSource("[MTgts.t1, MTgts.t2]"),
);
// Run 1's `specs/MDep.mdx`: a record too, the same template call.
const S2_MDEP_V1 = stagedMdx(
  "T12.0-15 T9.3-2's specs/MDep.mdx at the baseline (mdepSource(\"MTgts.t1\"): dd's one d target)",
  mdepSource("MTgts.t1"),
);
const S2_MX_SOURCE = stagedMdx(
  "T12.0-15 T9.3-2's specs/MX.mdx (mx depending on MDep.mdx#dd)",
  [
    'import MDep from "./MDep.xspec"',
    "",
    '<S id="mx" d={MDep.dd}>',
    "Meta head node text.",
    "</S>",
    "",
  ].join("\n"),
);
const S2_MIN_TS_SOURCE = stagedTs(
  "T12.0-15 T9.3-2's src/minimize.ts (references markers to Depth.mdx#deep and #shallow)",
  [
    'import DEPTH from "../specs/Depth.xspec";',
    "",
    "DEPTH.deep;",
    "DEPTH.shallow;",
    "",
  ].join("\n"),
);
const S2_TIE_TS_SOURCE = stagedTs(
  "T12.0-15 T9.3-2's src/tie.ts (references markers to Tie.mdx#tb, then #ta)",
  ['import TIE from "../specs/Tie.xspec";', "", "TIE.tb;", "TIE.ta;", ""].join(
    "\n",
  ),
);
const S2_KINDS_TS_SOURCE = stagedTs(
  "T12.0-15 T9.3-2's src/kinds.ts (a references marker and a text(...) call, both to Em.mdx#em)",
  [
    'import EM, { text } from "../specs/Em.xspec";',
    "",
    "EM.em;",
    "text(EM.em);",
    "",
  ].join("\n"),
);
const S2_DEL_TS_BASELINE = stagedTs(
  "T12.0-15 T9.3-2's src/delcase.ts at the baseline (a references marker to Doom.mdx#doom)",
  ['import DOOM from "../specs/Doom.xspec";', "", "DOOM.doom;", ""].join("\n"),
);
const S2_DEL_TS_CURRENT = stagedTs(
  "T12.0-15 T9.3-2's src/delcase.ts with its marker deleted",
  ["export const delcaseMarkerless = true;", ""].join("\n"),
);
const S2_NEW_TS_SOURCE = stagedTs(
  "T12.0-15 T9.3-2's src/newcase.ts, added (a references marker to Fresh.mdx#fresh)",
  ['import FRESH from "../specs/Fresh.xspec";', "", "FRESH.fresh;", ""].join(
    "\n",
  ),
);
const S2_META_TS_SOURCE = stagedTs(
  "T12.0-15 T9.3-2's src/meta.ts (a references marker to MX.mdx#mx)",
  ['import MX from "../specs/MX.xspec";', "", "MX.mx;", ""].join("\n"),
);

// T9.3-2's selection-arm sources as staged-source records (S-9): the same
// template calls, moved to module level.
const S2_DEPTH_V1 = stagedMdx(
  'T12.0-15 T9.3-2\'s specs/Depth.mdx at the baseline (depthSource("Deep leaf text v1.", "Shallow kid text v1."))',
  depthSource("Deep leaf text v1.", "Shallow kid text v1."),
);
const S2_DEPTH_V2 = stagedMdx(
  'T12.0-15 T9.3-2\'s specs/Depth.mdx with both leaves edited (depthSource("Deep leaf text v2.", "Shallow kid text v2."))',
  depthSource("Deep leaf text v2.", "Shallow kid text v2."),
);
const S2_TIE_V1 = stagedMdx(
  'T12.0-15 T9.3-2\'s specs/Tie.mdx at the baseline (tieSource("Tie kid b text v1.", "Tie kid a text v1."))',
  tieSource("Tie kid b text v1.", "Tie kid a text v1."),
);
const S2_TIE_V2 = stagedMdx(
  'T12.0-15 T9.3-2\'s specs/Tie.mdx with both kids edited (tieSource("Tie kid b text v2.", "Tie kid a text v2."))',
  tieSource("Tie kid b text v2.", "Tie kid a text v2."),
);
const S2_EM_V1 = stagedMdx(
  'T12.0-15 T9.3-2\'s specs/Em.mdx at the baseline (emSource("Embedded node text v1."))',
  emSource("Embedded node text v1."),
);
const S2_EM_V2 = stagedMdx(
  'T12.0-15 T9.3-2\'s specs/Em.mdx with em edited (emSource("Embedded node text v2."))',
  emSource("Embedded node text v2."),
);

/**
 * T9.3-2's staging: the witness-selection arms read against one baseline,
 * then the metadata terminus — a `d`-list-only edit — against a second (the
 * module header).
 */
async function runT932Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  await withWorkspace(
    IMPACT_SPEC_AND_CODE_CONFIG,
    {
      [S2_DEPTH]: S2_DEPTH_V1,
      [S2_TIE]: S2_TIE_V1,
      [S2_EM]: S2_EM_V1,
      [S2_DOOM]: S2_DOOM_SOURCE,
      [S2_MTGTS]: S2_MTGTS_SOURCE,
      [S2_MDEP]: S2_MDEP_V1,
      [S2_MX_FILE]: S2_MX_SOURCE,
      [S2_MIN_TS]: S2_MIN_TS_SOURCE,
      [S2_TIE_TS]: S2_TIE_TS_SOURCE,
      [S2_KINDS_TS]: S2_KINDS_TS_SOURCE,
      [S2_DEL_TS]: S2_DEL_TS_BASELINE,
      [S2_META_TS]: S2_META_TS_SOURCE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const selectionBase = await workspace.gitCommitAll("baseline");

      // Run-1 edits (the selection arms), committed as run 2's baseline
      // before any build so both baselines hold sources only.
      await workspace.file(S2_DEPTH, S2_DEPTH_V2);
      await workspace.file(S2_TIE, S2_TIE_V2);
      await workspace.file(S2_EM, S2_EM_V2);
      await fsp.rm(workspace.path(S2_DOOM));
      await workspace.file(S2_DEL_TS, S2_DEL_TS_CURRENT);
      await workspace.file(S2_FRESH, S2_FRESH_SOURCE);
      await workspace.file(S2_NEW_TS, S2_NEW_TS_SOURCE);
      const metaBase = await workspace.gitCommitAll("selection arms edited");

      await buildOk(
        product,
        workspace,
        "T9.3-2 `build` over the selection-arms-edited workspace",
      );
      await visit(workspace, {
        label: "T9.3-2 over the witness-selection arms",
        ref: selectionBase,
        home: async () => {
          const selectionLabel =
            "T9.3-2 `impact --base <baseline> --json` over the witness-selection arms";
          const selectionReport = await impactAgainst(
            product,
            workspace,
            selectionBase,
            selectionLabel,
          );
          assertImpactedCode(
            selectionReport,
            {
              direct: [
                // Minimize-together: the qualifying path from `deep` has three
                // nodes, the one from `shallow` two — the reported edge is the
                // one targeting the shorter path's first node (SPEC 9.3).
                {
                  location: S2_MIN_TS,
                  edge: { from: S2_MIN_TS, to: S2_SHALLOW, kind: "references" },
                  path: [S2_SHALLOW, S2_SHALLOW_KID],
                },
                // Tie: both candidates have two nodes; 12.0's element-wise byte
                // comparison picks `ta`'s sequence over document-first `tb`'s.
                {
                  location: S2_TIE_TS,
                  edge: { from: S2_TIE_TS, to: S2_TA, kind: "references" },
                  path: [S2_TA, S2_TA_KID],
                },
                // Kind preference: `embeds` and `references` both target the
                // chosen first node — the edited target itself, so the path is
                // that single node — and `embeds` is reported (SPEC 9.3).
                {
                  location: S2_KINDS_TS,
                  edge: { from: S2_KINDS_TS, to: S2_EM_NODE, kind: "embeds" },
                  path: [S2_EM_NODE],
                },
                // A deleted edge target yields the single-node path.
                {
                  location: S2_DEL_TS,
                  edge: {
                    from: S2_DEL_TS,
                    to: S2_DOOM_NODE,
                    kind: "references",
                  },
                  path: [S2_DOOM_NODE],
                },
                // An added edge target yields the single-node path.
                {
                  location: S2_NEW_TS,
                  edge: {
                    from: S2_NEW_TS,
                    to: S2_FRESH_NODE,
                    kind: "references",
                  },
                  path: [S2_FRESH_NODE],
                },
              ],
              // Every impact edge above targets a node whose subtreeHash
              // changed, so no location is transitively impacted; src/meta.ts's
              // target is untouched in run 1 and appears nowhere (SPEC 9.2).
              transitive: [],
            },
            selectionLabel,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            selectionBase,
            selectionReport,
            "T9.3-2 over the witness-selection arms",
          );
        },
      });

      // Metadata terminus: edit only `dd`'s `d` list against the second
      // baseline.
      await workspace.file(S2_MDEP, T9_3_2_MDEP_EDITED);
      await buildOk(
        product,
        workspace,
        "T9.3-2 `build` over the d-target-edited workspace",
      );
      await visit(workspace, {
        label: "T9.3-2 after the d-target-only edit (metadata terminus)",
        ref: metaBase,
        home: async () => {
          const metaLabel =
            "T9.3-2 `impact --base <run-1 state> --json` after the d-target-only edit (metadata terminus)";
          const metaReport = await impactAgainst(
            product,
            workspace,
            metaBase,
            metaLabel,
          );
          // The stated premise: a `d`-list-only edit makes no node in the
          // workspace `changed` (SPEC 5.6) — so no direct path terminus exists
          // anywhere, and the witness path must end at the metadata-changed
          // node whose `d` targets changed.
          for (const entry of metaReport.requirements) {
            for (const category of entry.categories) {
              if (category.category === "changed") {
                fail(
                  `${metaLabel}: an edit that only adds a \`d\` target makes ` +
                    `no node \`changed\` (SPEC 5.6) — the metadata-terminus ` +
                    `premise; got ${JSON.stringify(entry)}`,
                );
              }
            }
          }
          assertImpactedCode(
            metaReport,
            {
              // `mx`'s subtreeHash is unchanged, so nothing is directly
              // impacted (SPEC 9.2).
              direct: [],
              transitive: [
                {
                  location: S2_META_TS,
                  edge: { from: S2_META_TS, to: S2_MX, kind: "references" },
                  // From the edge's target `mx`, one dependency step to `dd` —
                  // the metadata-changed node whose `d` targets changed; both
                  // nodes' effectiveHash changed (SPEC 9.3, 5.5).
                  path: [S2_MX, S2_DD],
                },
              ],
            },
            metaLabel,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            metaBase,
            metaReport,
            "T9.3-2 after the d-target-only edit (metadata terminus)",
          );
        },
      });
    },
  );
}

const T9_3_2 = defineProductTest({
  id: "T9.3-2",
  title:
    "witness edge and path: the reported path runs from the edge's target to a node whose own edit explains the change, edge and path minimized together over all qualifying edges — a shorter path through a second edge wins, equal-length candidates resolve by 12.0 element-wise byte comparison, `embeds` is reported over `references` targeting the chosen first node, and an edited/added/deleted edge target yields the single-node path; metadata terminus: after an edit only to D's `d` list no node is `changed`, and the transitively impacted location's path runs from its edge target X and ends at the metadata-changed D, every node on it with changed effectiveHash; and at each `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — each requirement entry's nodes, categories, attribution identities, and deletion, and each code entry's location, edge kind and target, witness path, and group (robust matching, H-3) (SPEC 9.3, 9.2, 12.0, 5.6)",
  run: (product) => runT932Staging(product, HOME_IMPACT_READS),
});

// ---------------------------------------------------------------------------
// T9.3-3 — deletion identities
// ---------------------------------------------------------------------------

// Arm 1: journaled rename, then manual deletion — the deleted node reports
// under its baseline identity mapped forward through the journal (`new`,
// never `old`).
const D1_FILE = "specs/Del.mdx";
const D1_NEW = "specs/Del.mdx#new";
const D1_KEEP = "specs/Del.mdx#keep";
const D1_DOOMED_BLOCK = ['<S id="old">', "Doomed node text.", "</S>", ""].join(
  "\n",
);
const D1_BASELINE = stagedMdx(
  "T12.0-15 T9.3-3 arm 1 specs/Del.mdx (the baseline: old, renamed to new and deleted since, and keep)",
  [
    D1_DOOMED_BLOCK,
    ['<S id="keep">', "Kept sibling text.", "</S>", ""].join("\n"),
  ].join("\n"),
);
// The same construct as the rename must leave it (SPEC 6.4: minimal in-place
// edits rewrite only the identity), removed together with its separating
// blank line.
const D1_RENAMED_BLOCK = ['<S id="new">', "Doomed node text.", "</S>", ""].join(
  "\n",
);

// Arm 2: the twice-reported reintroduced identity. Baseline node `d0` is
// journal-renamed to `dm`, its section is then manually replaced by a fresh
// `nx` section, and `nx` is journal-renamed into the vacated `dm`:
// - the deleted baseline node maps forward through the journal (d0 → dm; the
//   later nx → dm entry maps nx, not dm) and reports as deleted under `dm`;
// - the current bearer of `dm` walks back through the nx → dm entry to
//   (nx, journal start) — a canonical identity no baseline node has
//   (SPEC 5.4), so it is a distinct new node, reported as added under `dm`.
const D2_FILE = "specs/Twice.mdx";
const D2_DM = "specs/Twice.mdx#dm";
const D2_KEEP = "specs/Twice.mdx#keep2";
// Arm 2 follows arm 1's invocations, so its baseline is a staged-source
// record (helpers/staged-mdx.ts; S-9's before-any-product clause) — the
// same expression, wrapped in place; arm 1's `D1_BASELINE`, the body's
// first workspace, is one too, staged by T12.0-15's `impact` family after
// its own first invocation. Arm 2's configuration, which follows arm 1's
// invocations too, is section-5.6.ts's `IMPACT_SPECS_ONLY_CONFIG`, the
// record every spec-only impact staging stages.
const D2_BASELINE = stagedMdx(
  "T9.3-3/T12.0-15 arm 2 specs/Twice.mdx (the baseline)",
  [
    '<S id="d0">',
    "Doomed original text.",
    "</S>",
    "",
    '<S id="keep2">',
    "Kept sibling two text.",
    "</S>",
    "",
  ].join("\n"),
);
const D2_RENAMED_BLOCK = ['<S id="dm">', "Doomed original text.", "</S>"].join(
  "\n",
);
const D2_REINTRODUCED_BLOCK = [
  '<S id="nx">',
  "Reintroduced bearer text.",
  "</S>",
].join("\n");

/**
 * T9.3-3's staging: arm 1's journaled rename plus manual deletion, then arm
 * 2's delete-and-reintroduce sequence, each read against its own baseline
 * (the module header).
 */
async function runT933Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  // Arm 1 — mapped deletion.
  await withWorkspace(
    IMPACT_SPECS_ONLY_CONFIG,
    { [D1_FILE]: D1_BASELINE },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");
      await buildOk(
        product,
        workspace,
        "T9.3-3 `build` over the staged workspace (arm 1)",
      );
      await expectExit(
        product,
        workspace,
        ["rename", D1_FILE, "old", "new"],
        0,
        "T9.3-3 `rename specs/Del.mdx old new`",
      );
      // Manual deletion of the renamed section (6.6: no journal entry —
      // a deletion), leaving the sibling in place.
      await editSourceExpecting(
        workspace,
        D1_FILE,
        `${D1_RENAMED_BLOCK}\n`,
        "",
        "T9.3-3 manual deletion of the renamed section",
      );
      await buildOk(
        product,
        workspace,
        "T9.3-3 `build` after the manual deletion (arm 1)",
      );

      await visit(workspace, {
        label:
          "T9.3-3 arm 1, after the journaled rename and the manual deletion",
        ref: base,
        home: async () => {
          const label =
            "T9.3-3 `impact --base <pre-rename baseline> --json` after the journaled rename plus manual deletion";
          // The expectation table names only mapped and current identities, so
          // any entry mentioning the pre-rename `#old` fails the phantom guard:
          // the deleted node reports under its journal-mapped identity
          // (SPEC 9.3, 6.3), and the root's cascade attributes to it likewise.
          const report = await impactAgainst(product, workspace, base, label);
          assertImpactCategories(
            report,
            [
              {
                identity: D1_NEW,
                deleted: true,
                categories: [
                  { category: "changed", within: [D1_NEW, D1_FILE] },
                ],
              },
              {
                identity: D1_FILE,
                categories: [
                  { category: "changed", within: [D1_NEW, D1_FILE] },
                  { category: "descendant-changed", exact: [D1_NEW] },
                ],
              },
              { identity: D1_KEEP, categories: [] },
            ],
            label,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            report,
            "T9.3-3 arm 1",
          );
        },
      });
    },
  );

  // Arm 2 — the twice-reported reintroduced identity.
  await withWorkspace(
    IMPACT_SPECS_ONLY_CONFIG,
    { [D2_FILE]: D2_BASELINE },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");
      await buildOk(
        product,
        workspace,
        "T9.3-3 `build` over the staged workspace (arm 2)",
      );
      await expectExit(
        product,
        workspace,
        ["rename", D2_FILE, "d0", "dm"],
        0,
        "T9.3-3 `rename specs/Twice.mdx d0 dm`",
      );
      // Manual restructuring (6.6): the renamed section is replaced by a
      // fresh `nx` section — a deletion plus an addition, no journal entry.
      await editSourceExpecting(
        workspace,
        D2_FILE,
        D2_RENAMED_BLOCK,
        D2_REINTRODUCED_BLOCK,
        "T9.3-3 manual replacement of the renamed section",
      );
      // The reintroduction: `nx` is journal-renamed into the vacated `dm`.
      await expectExit(
        product,
        workspace,
        ["rename", D2_FILE, "nx", "dm"],
        0,
        "T9.3-3 `rename specs/Twice.mdx nx dm` (reintroducing the vacated identity)",
      );
      await buildOk(
        product,
        workspace,
        "T9.3-3 `build` after the reintroduction (arm 2)",
      );

      await visit(workspace, {
        label: "T9.3-3 arm 2, after the delete-and-reintroduce sequence",
        ref: base,
        home: async () => {
          const label =
            "T9.3-3 `impact --base <baseline> --json` after the delete-and-reintroduce sequence";
          const report = await impactAgainst(product, workspace, base, label);
          assertSameJson(
            report.code,
            { direct: [], transitive: [] },
            `${label}: no code groups are configured, so no code location is impacted (SPEC 9.2)`,
          );

          // Bespoke twice-report assertion (module header): the merged-per-node
          // machinery cannot express one identity with two deleted flags.
          const dmEntries: ImpactRequirementEntry[] = [];
          const rootEntries: ImpactRequirementEntry[] = [];
          for (const entry of report.requirements) {
            for (const identity of entry.nodes) {
              if (identity !== D2_DM && identity !== D2_FILE) {
                fail(
                  `${label}: the report names ${JSON.stringify(identity)} — ` +
                    `the only categorized identities of this fixture are the ` +
                    `twice-reported ${D2_DM} and the file root ${D2_FILE}: the ` +
                    `untouched sibling ${D2_KEEP} receives no category, and ` +
                    `neither retired spelling (#d0, #nx) is a journal-mapped ` +
                    `baseline identity or a current identity (SPEC 9.3, 6.3, ` +
                    `5.6); entry: ${JSON.stringify(entry)}`,
                );
              }
            }
            if (entry.nodes.includes(D2_DM)) {
              if (entry.nodes.length !== 1) {
                fail(
                  `${label}: an entry naming ${D2_DM} must cover it alone — a ` +
                    `changed (added or deleted) node belongs to no collapsed ` +
                    `ancestor chain (SPEC 9.3); entry: ${JSON.stringify(entry)}`,
                );
              }
              dmEntries.push(entry);
            } else if (entry.nodes.includes(D2_FILE)) {
              if (entry.nodes.length !== 1) {
                fail(
                  `${label}: an entry naming the file root ${D2_FILE} must ` +
                    `cover it alone — carrying \`changed\`, it belongs to no ` +
                    `collapsed ancestor chain (SPEC 9.3); entry: ` +
                    JSON.stringify(entry),
                );
              }
              rootEntries.push(entry);
            }
          }

          if (dmEntries.length !== 2) {
            fail(
              `${label}: the identity ${D2_DM} must appear exactly twice — ` +
                `once as deleted (the vanished baseline node under its ` +
                `journal-mapped identity) and once as added (the distinct new ` +
                `node now bearing it, SPEC 9.3, 5.4) — but ` +
                `${String(dmEntries.length)} entries name it: ` +
                JSON.stringify(dmEntries),
            );
          }
          const flags = dmEntries.map((entry) => entry.deleted).sort();
          if (flags[0] !== false || flags[1] !== true) {
            fail(
              `${label}: of the two entries naming ${D2_DM}, exactly one must ` +
                `be flagged deleted and one not — once as deleted, once as ` +
                `added (SPEC 9.3); got deleted flags ` +
                JSON.stringify(dmEntries.map((entry) => entry.deleted)),
            );
          }
          for (const entry of dmEntries) {
            assertSameJson(
              [...new Set(entry.categories.map((c) => c.category))],
              ["changed"],
              `${label}: the ${entry.deleted ? "deleted" : "added"} report of ` +
                `${D2_DM} carries \`changed\` and nothing else — an added or ` +
                `deleted node receives no category through its own hashes ` +
                `(SPEC 5.6)`,
            );
            for (const category of entry.categories) {
              for (const attributed of category.attributedTo) {
                if (attributed !== D2_DM && attributed !== D2_FILE) {
                  fail(
                    `${label}: the \`changed\` category of ${D2_DM} is ` +
                      `attributed to ${JSON.stringify(attributed)}, which is ` +
                      `no originating node of this change (SPEC 5.6); the ` +
                      `originating identities are ${D2_DM} (the deleted and ` +
                      `the added node alike) and ${D2_FILE}`,
                  );
                }
              }
            }
          }

          // The file root: its own content sequence swapped one child
          // canonical identity for another (`changed`), and its subtree
          // changed through the deleted and added children — both reporting
          // under `dm` (SPEC 5.6, 5.5).
          if (rootEntries.length === 0) {
            fail(
              `${label}: the file root ${D2_FILE} must be reported — replacing ` +
                `one child construct with a distinct node changes its own ` +
                `content sequence and its subtree (SPEC 5.6, 5.5)`,
            );
          }
          const rootCategories = new Map<ChangeCategory, string[]>();
          for (const entry of rootEntries) {
            if (entry.deleted) {
              fail(
                `${label}: ${D2_FILE} is present on both sides and must not ` +
                  `be flagged deleted (SPEC 9.3); entry: ${JSON.stringify(entry)}`,
              );
            }
            for (const category of entry.categories) {
              const attributed = rootCategories.get(category.category) ?? [];
              attributed.push(...category.attributedTo);
              rootCategories.set(category.category, attributed);
            }
          }
          assertSameJson(
            [...rootCategories.keys()].sort(),
            ["changed", "descendant-changed"],
            `${label}: the exact category set of ${D2_FILE} (SPEC 5.6 — its ` +
              `own content changed with the child swap, and a descendant ` +
              `changed; no other category applies)`,
          );
          assertSameJson(
            [...new Set(rootCategories.get("descendant-changed") ?? [])].sort(),
            [D2_DM],
            `${label}: the \`descendant-changed\` category of ${D2_FILE} is ` +
              `attributed to its changed descendants — the deleted node and ` +
              `the added node, both reporting under ${D2_DM} (SPEC 5.6, 9.3)`,
          );
          for (const attributed of new Set(
            rootCategories.get("changed") ?? [],
          )) {
            if (attributed !== D2_DM && attributed !== D2_FILE) {
              fail(
                `${label}: the \`changed\` category of ${D2_FILE} is ` +
                  `attributed to ${JSON.stringify(attributed)}, which is no ` +
                  `originating node of this change (SPEC 5.6)`,
              );
            }
          }
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            report,
            "T9.3-3 arm 2",
          );
        },
      });
    },
  );
}

const T9_3_3 = defineProductTest({
  id: "T9.3-3",
  title:
    "deletion identities: a node deleted after a journaled rename reports as deleted under its baseline identity mapped forward through the journal — the new identity, the old one appearing nowhere; and when a deleted node's mapped identity is now borne by a distinct new node (5.4: a fresh section journal-renamed into the vacated identity), the identity appears twice — once as deleted, once as added; and at each arm's `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — its nodes, categories, attribution identities, and deletion (robust matching, H-3) (SPEC 9.3, 6.3, 5.4, 5.6, 12.0)",
  run: (product) => runT933Staging(product, HOME_IMPACT_READS),
});

/**
 * The stagings of T9.3-1 through T9.3-3, in canonical ID order — T12.0-15's
 * `impact` family runs each with its human twin as the visitor
 * (section-12.0-iv.ts).
 */
export const T9_3_IMPACT_STAGINGS: readonly ImpactStaging[] = [
  { test: "T9.3-1", run: runT931Staging },
  { test: "T9.3-2", run: runT932Staging },
  { test: "T9.3-3", run: runT933Staging },
];

/** TEST-SPEC §9.3, in canonical ID order (SUITE-32). */
export const section93Tests: readonly ProductTestEntry[] = [
  T9_3_1,
  T9_3_2,
  T9_3_3,
];
