// TEST-SPEC §9 through §9.2 (impact analysis: baseline plumbing, requirement
// categories, impacted code) — SUITE-31: T9-1, T9.1-1, T9.2-1…T9.2-5.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// Impacted-code evaluation (SPEC 9.2) runs over the impact edges of a code
// location — the union of its `references` and `embeds` edges in the baseline
// graph and in the current graph, identities mapped through the journal
// (6.3) — and a node present on only one side, added or deleted, counts as
// one whose subtreeHash and effectiveHash changed. Baselines are committed
// git sources only (no build output at the ref; HARNESS-01: pinned identities
// and timestamps); the current side is the edited working tree, rebuilt
// (`build`, exit 0) before every `impact` run — the SUITE-20/22 protocol.
// Code locations here are whole files (SPEC 4.6): every marker and `text(...)`
// call sits at the top level of its `src/*.ts` file, enclosed by no named
// code unit.
//
// Conservative operationalizations (noted per H-4):
// - Impacted-code entries are asserted whole ({location, edge, path}) and
//   compared as sorted sets per group: SPEC 9.3 gives each impacted location
//   one entry per code category, and in every fixture here the qualifying
//   edge and its shortest witness path are unique, so the entry content is
//   spec-fixed; the order of entries within a group is not asserted (SPEC 9.3
//   fixes the grouping; T12.0-7 owns ordering determinism).
// - The witness edge is asserted with `from` equal to the reported location:
//   a location's impact edges are its own `references`/`embeds` edges
//   (SPEC 9.2), and the reported edge is the one targeting the chosen path's
//   first node (9.3), so it runs from the location itself.
// - Requirement-level entries are T9.1-1's and T5.6-*'s business; the T9.2-*
//   bodies assert the code groups only — in JSON: their human-form checks
//   (below) ask the human report for every entry of the decoded document,
//   requirement entries included.
// - T9-1's no-difference arms assert the empty report through the suite's
//   fixed T1.5-1 convention (SPEC 9.3 groups output by category, so an
//   uncategorized node appears under none — `requirements` empty) plus empty
//   code groups, and their human (non-`--json`) run asserts exit 0 (impact
//   is informational, SPEC 9.3); with differences present, the human form
//   is the next bullet's check.
// - The human form (T12.0-1's information parity; SPEC 12.0: the JSON form
//   carries the same information as the human report): after each `impact
//   --base <ref> --json` read with differences and its assertions — T9-1's,
//   T9.1-1's two, and each T9.2 body's — at the same state (nothing runs
//   between the two reads, and a read past a build has nothing to refresh,
//   SPEC 13.3), the same argv without `--json` exits 0 as well
//   (informational, SPEC 9.3), and its report mentions what the decoded
//   report carries (a product-to-itself comparison, H-4;
//   `assertHumanImpactReport`, through helpers/adapters/human.ts): every
//   requirement entry's nodes and each identity a category is attributed to
//   (SPEC 5.6, 9.1), and every impacted-code entry's location, witness edge
//   source and target, and witness path nodes (9.2, 9.3) — identity-or-path
//   boundaries, so `specs/Embed.mdx#em` never counts inside
//   `specs/Embed.mdx#em.kid`, nor a root's path inside its sections'
//   identities; then, in a separate call with all of those identities
//   blanked out, each entry's categories, `deleted` where an entry is
//   deleted (9.3), each code entry's edge kind (5.2), and `direct` and
//   `transitive` wherever the respective group is non-empty (SPEC-named
//   tokens; robust matching, H-3: presence, never wording). The blanking
//   keeps a token's spelling inside an identity from standing in for the
//   token: without it, a report naming no directly impacted group passes
//   T9.2-4 on `specs/Direct.mdx`, and one naming no `embeds` kind passes
//   T9.2-1 on `src/embeds.ts` (FIX_PLAN Task 8's scratch builds
//   `t9jd0c8-nodirect` and `t9jd0c8-noembeds`, which fail both with it).
//   Limits: no mention is associated with another, so which category,
//   attribution, or deletion belongs to which entry, which group lists which
//   location, and which edge kind, target, and path belong to which location
//   stay with the JSON assertions. An identity counts wherever the report
//   prints it, and each attribution names an originating node (5.6) and
//   each path node one whose subtreeHash or effectiveHash changed (9.3) —
//   each itself some entry's node — while each edge's target is its path's
//   first node (9.3): a report dropping its attributions, its edge targets,
//   or its witness paths passes every T9.x test (the scratch builds
//   `t9jd0c8-noattrib`, `t9jd0c8-notargets`, `t9jd0c8-nopaths`), what they
//   add beyond those identities — their association — asked in JSON alone.
//   The resolved baseline commit a product may echo is no information 9.3
//   defines for the report, and is not asked.
//
// Each body is its staging (`runT9<…>Staging`) run with section-5.6.ts's
// home visitor (`HOME_IMPACT_READS`): the staging hands each `impact --base`
// read to the visitor at the state it reaches, and the home test's own read
// and assertions run there. T12.0-15's `impact` family (section-12.0-iv.ts)
// runs the same stagings (`T9_IMPACT_STAGINGS`) with its human twin as the
// visitor, after its first product invocation, so every source they stage
// is a staged-source record (helpers/staged-mdx.ts, helpers/staged-ts.ts;
// S-9: judged before any product exists) — the configuration included
// (`IMPACT_SPEC_AND_CODE_CONFIG`, section-5.6.ts's
// `IMPACT_SPECS_ONLY_CONFIG`) — or, for product-rewritten bytes,
// `workspace.edit()` after a diagnosed premise; a home body's stagings
// before its first invocation stay within S-7's sweep against the stub.

import * as fsp from "node:fs/promises";
import type {
  ImpactReport,
  ImpactedCodeEntry,
  SpecNamedToken,
} from "../../helpers/adapters/index.js";
import {
  assertReportMentions,
  identityMention,
  specTokenMention,
} from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import type { ImpactReadVisitor, ImpactStaging } from "./section-5.6.js";
import {
  HOME_IMPACT_READS,
  IMPACT_SPECS_ONLY_CONFIG,
  assertImpactCategories,
  impactAgainst,
  workedExample,
  workedExampleLeafEditExpectations,
} from "./section-5.6.js";
import { assertSameJson, buildOk, expectExit } from "./support.js";

// One spec group plus one code group (SPEC 7.2) for the impacted-code
// fixtures of T9.2-* — exported for test/suite/registry/section-9.3.ts, whose
// witness-selection fixtures (T9.3-2) stage the same shape.
export const SPEC_AND_CODE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

/**
 * {@link SPEC_AND_CODE_CONFIG} as a staged-source record (S-9's TypeScript
 * and timing clauses): the configuration of every impacted-code staging —
 * T9.2-1 through T9.2-5 and T9.3-2 — which T12.0-15's `impact` family
 * stages after its first product invocation. The exported plain constant
 * stays for the other modules that import it.
 */
export const IMPACT_SPEC_AND_CODE_CONFIG = stagedTs(
  "T12.0-15 xspec.config.ts — one spec group and one code group (section-9.ts's SPEC_AND_CODE_CONFIG: the impacted-code stagings of T9.2-1 through T9.2-5 and T9.3-2)",
  SPEC_AND_CODE_CONFIG,
);

/**
 * Stage a fresh workspace (config plus `files`, records every one: T12.0-15
 * stages them after its first product invocation, S-9), run `body`,
 * dispose (H-1).
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
 * Assert both impacted-code groups against their complete expected entry
 * sets (module header, H-4): each group must hold exactly the expected
 * entries — location, witness edge ({from, to, kind}), and witness path all
 * equal — compared order-insensitively via a canonical rendering (SPEC 9.2,
 * 9.3). A location missing from a group, present in the wrong group,
 * duplicated, or reported with a different edge or path is diagnosed.
 * Exported for test/suite/registry/section-9.3.ts (T9.3-2 asserts the same
 * whole-entry contract over its witness-minimization fixtures).
 */
export function assertImpactedCode(
  report: ImpactReport,
  expected: {
    readonly direct: readonly ImpactedCodeEntry[];
    readonly transitive: readonly ImpactedCodeEntry[];
  },
  context: string,
): void {
  const render = (entries: readonly ImpactedCodeEntry[]): string[] =>
    entries
      .map((entry) =>
        JSON.stringify({
          location: entry.location,
          edge: {
            from: entry.edge.from,
            to: entry.edge.to,
            kind: entry.edge.kind,
          },
          path: entry.path,
        }),
      )
      .sort();
  for (const group of ["direct", "transitive"] as const) {
    assertSameJson(
      render(report.code[group]),
      render(expected[group]),
      `${context}: the ${group === "direct" ? "directly" : "transitively"} ` +
        `impacted code group must hold exactly the expected entries — each ` +
        `impacted location once, with the one qualifying witness edge and ` +
        `the one shortest propagation path, both unique in this fixture ` +
        `(SPEC 9.2, 9.3)`,
    );
  }
}

/**
 * The human `impact --base <ref>` at the state of a decoded `impact --base
 * <ref> --json` report, after that report's own assertions — T12.0-1's
 * information parity (SPEC 12.0: the JSON form carries the same information
 * as the human report; the module header): the same argv without `--json`
 * exits 0 as well (informational, SPEC 9.3), and its report mentions, for
 * every entry of the decoded report, each requirement entry's nodes and each
 * identity a category is attributed to (SPEC 5.6, 9.1), and each
 * impacted-code entry's location, its witness edge's source and target, and
 * every node of its witness path (9.2, 9.3) — identity-or-path boundaries;
 * then, in a separate call with every one of those identities blanked out
 * (so a token's spelling inside an identity — `direct` in
 * `specs/Direct.mdx`, `embeds` in `src/embeds.ts` — never stands in for the
 * token), each entry's categories, `deleted` wherever an entry is deleted
 * (9.3), each code entry's edge kind, and `direct` and `transitive` wherever
 * the respective group is non-empty (SPEC-named tokens). Robust matching
 * (H-3): presence, never wording, and no mention associated with another.
 * A report with no entries asserts the exit code alone. Exported for
 * test/suite/registry/section-9.3.ts (the T9.3 bodies run the same check).
 */
export async function assertHumanImpactReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  report: ImpactReport,
  context: string,
): Promise<void> {
  const label = `${context} \`impact --base <ref>\` (human report)`;
  const human = await expectExit(
    product,
    workspace,
    ["impact", "--base", ref],
    0,
    `${label} — the same exit code as the \`--json\` report at this state: ` +
      `0, impact is informational whether or not differences exist (SPEC ` +
      `9.3, 12.0)`,
  );
  const identities = new Set<string>();
  const tokens = new Set<SpecNamedToken>();
  for (const entry of report.requirements) {
    for (const node of entry.nodes) identities.add(node);
    if (entry.deleted) tokens.add("deleted");
    for (const category of entry.categories) {
      tokens.add(category.category);
      for (const attributed of category.attributedTo) {
        identities.add(attributed);
      }
    }
  }
  for (const group of ["direct", "transitive"] as const) {
    const entries = report.code[group];
    if (entries.length > 0) tokens.add(group);
    for (const entry of entries) {
      identities.add(entry.location);
      identities.add(entry.edge.from);
      identities.add(entry.edge.to);
      tokens.add(entry.edge.kind);
      for (const node of entry.path) identities.add(node);
    }
  }
  if (identities.size > 0) {
    assertReportMentions(
      human,
      [...identities].map(identityMention),
      `${label}: every requirement entry's nodes and attribution ` +
        `identities, and every impacted-code entry's location, witness ` +
        `edge source and target, and witness path nodes — the information ` +
        `of the JSON report (SPEC 5.6, 9.1, 9.2, 9.3, 12.0)`,
    );
  }
  if (tokens.size > 0) {
    assertReportMentions(
      human,
      [...tokens].map(specTokenMention),
      `${label}: every entry's categories, \`deleted\` where an entry is ` +
        `deleted, every code entry's edge kind, and \`direct\` and ` +
        `\`transitive\` where the group is non-empty, matched with the ` +
        `report's identities blanked out (SPEC 5.2, 5.6, 9.2, 9.3, 12.0)`,
      { blank: [...identities] },
    );
  }
}

/**
 * Read a workspace source file as UTF-8 text, failing diagnosed (H-8) when
 * the path does not hold a plain file. Exported for
 * test/suite/registry/section-9.3.ts (T9.3-3 stages manual edits on
 * product-rewritten sources the same way).
 */
export async function readSourceText(
  workspace: TestWorkspace,
  rel: string,
  context: string,
): Promise<string> {
  const kind = await workspace.kind(rel);
  if (kind !== "file") {
    fail(`${context}: expected a plain file at ${rel}; found ${kind}`);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(
    await workspace.readBytes(rel),
  );
}

// ---------------------------------------------------------------------------
// T9-1 — baseline plumbing
// ---------------------------------------------------------------------------

// Two sibling sections in one file: `alpha` is the edited node, `beta` the
// untouched control. The file root is `alpha`'s ancestor.
const P1_MAIN = "specs/Main.mdx";
const P1_ALPHA = "specs/Main.mdx#alpha";
const P1_BETA = "specs/Main.mdx#beta";

const p1Source = (alphaText: string): string =>
  [
    '<S id="alpha">',
    alphaText,
    "</S>",
    "",
    '<S id="beta">',
    "Beta text.",
    "</S>",
    "",
  ].join("\n");

// The edited workspace (staged after the baseline build): `alpha`'s text
// run at v2 — a staged-source record (helpers/staged-mdx.ts), the same
// template call moved to module level.
const T9_1_ALPHA_V2 = stagedMdx(
  "T9-1/T12.0-15 specs/Main.mdx with alpha's text run at v2",
  p1Source("Alpha text v2."),
);
// The baseline workspace's source, staged by T12.0-15's `impact` family
// after its first product invocation: a record too, the same template call.
const T9_1_ALPHA_V1 = stagedMdx(
  'T12.0-15 T9-1\'s specs/Main.mdx at the baseline (p1Source("Alpha text v1."): alpha and the untouched beta)',
  p1Source("Alpha text v1."),
);

/**
 * T9-1's staging: the baseline read without differences — by its commit
 * hash, then as HEAD — then with differences after an edit (the module
 * header).
 */
async function runT91Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  await withWorkspace(
    IMPACT_SPECS_ONLY_CONFIG,
    { [P1_MAIN]: T9_1_ALPHA_V1 },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");
      await buildOk(
        product,
        workspace,
        "T9-1 `build` over the staged workspace",
      );

      // Without differences: exit 0 both plain and under --json, and the
      // JSON report is empty (no node carries a category, no code group is
      // configured).
      await visit(workspace, {
        label: "T9-1 without differences, the baseline by its commit hash",
        ref: base,
        home: async () => {
          await expectExit(
            product,
            workspace,
            ["impact", "--base", base],
            0,
            "T9-1 `impact --base <hash>` with no differences — impact is " +
              "informational and exits 0 whether or not differences exist " +
              "(SPEC 9.3)",
          );
          const emptyLabel =
            "T9-1 `impact --base <hash> --json` with no differences";
          const empty = await impactAgainst(
            product,
            workspace,
            base,
            emptyLabel,
          );
          assertSameJson(
            empty.requirements,
            [],
            `${emptyLabel}: the working tree's sources equal the baseline ` +
              `ref's, so no node receives any category and the requirements ` +
              `list is empty (SPEC 5.6, 9.1; the T1.5-1 convention)`,
          );
          assertSameJson(
            empty.code,
            { direct: [], transitive: [] },
            `${emptyLabel}: no code groups are configured, so no code location ` +
              `is impacted (SPEC 9.2)`,
          );
        },
      });

      // Symbolic ref: HEAD names the same baseline commit (SPEC 9 takes a
      // git ref, not only a hash).
      await visit(workspace, {
        label: "T9-1 without differences, the baseline as HEAD",
        ref: "HEAD",
        home: async () => {
          const headLabel =
            "T9-1 `impact --base HEAD --json` (symbolic ref) with no differences";
          const viaHead = await impactAgainst(
            product,
            workspace,
            "HEAD",
            headLabel,
          );
          assertSameJson(
            viaHead.requirements,
            [],
            `${headLabel}: HEAD resolves to the same commit as the hash, so ` +
              `the report is equally empty (SPEC 9, 6.3)`,
          );
          assertSameJson(
            viaHead.code,
            { direct: [], transitive: [] },
            `${headLabel}: no code groups are configured (SPEC 9.2)`,
          );
        },
      });

      // With differences: still exit 0; the JSON report carries the 5.6
      // categories — the difference is computed against the ref's content,
      // not the working tree (SPEC 6.3) — and the human report, at the
      // same state, the same information (module header).
      await workspace.file(P1_MAIN, T9_1_ALPHA_V2);
      await buildOk(
        product,
        workspace,
        "T9-1 `build` over the edited workspace",
      );
      await visit(workspace, {
        label: "T9-1 with differences",
        ref: base,
        home: async () => {
          const diffLabel =
            "T9-1 `impact --base <hash> --json` with differences";
          const diff = await impactAgainst(product, workspace, base, diffLabel);
          assertImpactCategories(
            diff,
            [
              {
                identity: P1_ALPHA,
                categories: [{ category: "changed", within: [P1_ALPHA] }],
              },
              {
                identity: P1_MAIN,
                categories: [
                  { category: "descendant-changed", exact: [P1_ALPHA] },
                ],
              },
              { identity: P1_BETA, categories: [] },
            ],
            diffLabel,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            diff,
            "T9-1 with differences",
          );
        },
      });
    },
  );
}

const T9_1 = defineProductTest({
  id: "T9-1",
  title:
    "baseline plumbing: `impact --base <ref>` on a git fixture reconstructs the baseline at the ref (6.3) and exits 0 with differences and without (informational); `--json` is available — the empty report before any edit (commit hash and symbolic ref alike), the edited node's `changed` entry with its cascade after; and at the edited state the human `impact` exits 0 alike and carries every entry the `--json` report holds — its nodes, categories, and attribution identities (robust matching, H-3) (SPEC 9, 9.3, 5.6, 6.3, 12.0)",
  run: (product) => runT91Staging(product, HOME_IMPACT_READS),
});

// ---------------------------------------------------------------------------
// T9.1-1 — categories equal 5.6 (fixtures shared with T5.6-*)
// ---------------------------------------------------------------------------

// Arm B's edit (staged after arm A's build): onmid.dep's `d` list gaining
// Tree.top.other — a staged-source record (helpers/staged-mdx.ts), the same
// template call moved to module level. Arm A's leaf edit precedes the
// body's first product invocation, but T12.0-15's `impact` family stages it
// after its own, so it is a record too: section-5.6.ts's worked-example
// record (`workedExample.treeLeafEdited`).
const T9_1_1_DEPS_EDITED = stagedMdx(
  "T9.1-1/T12.0-15 specs/Deps.mdx with onmid.dep's d list gaining Tree.top.other",
  workedExample.depsSource("[Tree.top.mid, Tree.top.other]"),
);

/**
 * T9.1-1's staging: T5.6-1's worked example, its leaf edit read against one
 * baseline, then a `d`-target edit against a second (the module header).
 */
async function runT911Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  const wx = workedExample;
  await withWorkspace(
    IMPACT_SPECS_ONLY_CONFIG,
    {
      [wx.treeFile]: wx.treeAtBaseline,
      [wx.depsFile]: wx.depsOnMid,
    },
    async (workspace) => {
      await workspace.gitInit();
      const leafBase = await workspace.gitCommitAll("baseline");

      // Arm A's edit is committed as arm B's baseline before any build, so
      // both baselines hold sources only (the T5.6-4 pattern).
      await workspace.file(wx.treeFile, wx.treeLeafEdited);
      const dBase = await workspace.gitCommitAll("leaf edited");
      await buildOk(
        product,
        workspace,
        "T9.1-1 `build` over the leaf-edited workspace",
      );

      // Arm A: the worked example's leaf edit — the categories and
      // attributions of SPEC 5.6's own example, the table shared with
      // T5.6-1.
      await visit(workspace, {
        label: "T9.1-1 after the leaf edit",
        ref: leafBase,
        home: async () => {
          const leafLabel =
            "T9.1-1 `impact --base <baseline> --json` after the leaf edit " +
            "(fixture and expectation table shared with T5.6-1)";
          const leafReport = await impactAgainst(
            product,
            workspace,
            leafBase,
            leafLabel,
          );
          assertImpactCategories(
            leafReport,
            workedExampleLeafEditExpectations(),
            leafLabel,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            leafBase,
            leafReport,
            "T9.1-1 after the leaf edit",
          );
        },
      });

      // Arm B: onmid.dep's `d` list gains Tree.top.other on the same
      // fixture. D is `metadata-changed`; no node is `changed` or
      // `descendant-changed`; D's ancestors are `upstream-changed`
      // attributed to D; the gained target and the whole tree side stay
      // uncategorized (SPEC 5.6's d-target example).
      await workspace.file(wx.depsFile, T9_1_1_DEPS_EDITED);
      await buildOk(
        product,
        workspace,
        "T9.1-1 `build` over the d-target-edited workspace",
      );
      await visit(workspace, {
        label: "T9.1-1 after the d-target edit",
        ref: dBase,
        home: async () => {
          const ids = wx.identities;
          const dLabel =
            "T9.1-1 `impact --base <leaf-edited> --json` after the d-target " +
            "edit on the shared fixture";
          const dReport = await impactAgainst(
            product,
            workspace,
            dBase,
            dLabel,
          );
          assertImpactCategories(
            dReport,
            [
              // The one originating node: its `d` target set changed. Its own
              // edge additions are excluded from `upstream-changed` ("other
              // than the node itself", SPEC 5.6).
              {
                identity: ids.onmidDep,
                categories: [
                  { category: "metadata-changed", within: [ids.onmidDep] },
                ],
              },
              // D's ancestors: `upstream-changed` attributed to D.
              {
                identity: ids.onmid,
                categories: [
                  { category: "upstream-changed", exact: [ids.onmidDep] },
                ],
              },
              {
                identity: ids.deps,
                categories: [
                  { category: "upstream-changed", exact: [ids.onmidDep] },
                ],
              },
              // The sibling holder subtree is untouched.
              { identity: ids.onleaf, categories: [] },
              { identity: ids.onleafDep, categories: [] },
              // The gained target only receives a new incoming edge — no
              // category — and the whole tree side is unchanged since arm B's
              // baseline.
              { identity: ids.tree, categories: [] },
              { identity: ids.top, categories: [] },
              { identity: ids.mid, categories: [] },
              { identity: ids.leaf, categories: [] },
              { identity: ids.sib, categories: [] },
              { identity: ids.sibInner, categories: [] },
              { identity: ids.other, categories: [] },
            ],
            dLabel,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            dBase,
            dReport,
            "T9.1-1 after the d-target edit",
          );
        },
      });
    },
  );
}

const T9_1_1 = defineProductTest({
  id: "T9.1-1",
  title:
    "categories: requirement-level `impact` output equals the categories and attributions of 5.6, over fixtures shared with T5.6-* — the worked-example leaf edit (changed / descendant-changed / upstream-changed with exact attribution) against one baseline, then a `d`-target edit on the same fixture (metadata-changed with its upstream cascade attributed to D) against a second; and at each `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — its nodes, categories, and attribution identities (robust matching, H-3) (SPEC 9.1, 5.6, 12.0)",
  run: (product) => runT911Staging(product, HOME_IMPACT_READS),
});

// ---------------------------------------------------------------------------
// T9.2-1 — directly impacted
// ---------------------------------------------------------------------------

// Four arms, one code location each (whole files, SPEC 4.6):
// - src/refs.ts: `references` marker to `ed`, whose own text is edited;
// - src/embeds.ts: `text(...)` embeds edge to `em`, whose descendant is
//   edited (em's subtreeHash changes, its ownHash does not);
// - src/dropped.ts: at the baseline, a marker to `doom`; currently both the
//   marker and the node are deleted — the impact edge exists only in the
//   baseline graph, and the deleted node counts as changed in both hashes;
// - src/added.ts: absent at the baseline; currently a marker to the equally
//   new `fresh` — the impact edge exists only in the current graph, and the
//   added node counts as changed in both hashes.
const C1_EDITED = "specs/Edited.mdx";
const C1_ED = "specs/Edited.mdx#ed";
const C1_EMBED = "specs/Embed.mdx";
const C1_EM = "specs/Embed.mdx#em";
const C1_EM_KID = "specs/Embed.mdx#em.kid";
const C1_DOOMED = "specs/Doomed.mdx";
const C1_DOOM = "specs/Doomed.mdx#doom";
const C1_FRESH = "specs/Fresh.mdx";
const C1_FRESH_NODE = "specs/Fresh.mdx#fresh";
const C1_REFS_TS = "src/refs.ts";
const C1_EMBEDS_TS = "src/embeds.ts";
const C1_DROPPED_TS = "src/dropped.ts";
const C1_ADDED_TS = "src/added.ts";

const c1EditedSource = (text: string): string =>
  ['<S id="ed">', text, "</S>", ""].join("\n");
const c1EmbedSource = (kidText: string): string =>
  [
    '<S id="em">',
    "Embed parent text.",
    "",
    '<S id="em.kid">',
    kidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
const C1_DOOMED_SOURCE = stagedMdx(
  "T12.0-15 T9.2-1's specs/Doomed.mdx at the baseline (doom, deleted since with its file)",
  ['<S id="doom">', "Doomed node text.", "</S>", ""].join("\n"),
);
const C1_FRESH_SOURCE = stagedMdx(
  "T12.0-15 T9.2-1's specs/Fresh.mdx, added (fresh)",
  ['<S id="fresh">', "Fresh node text.", "</S>", ""].join("\n"),
);
const C1_REFS_TS_SOURCE = stagedTs(
  "T12.0-15 T9.2-1's src/refs.ts (a references marker to Edited.mdx#ed)",
  ['import ED from "../specs/Edited.xspec";', "", "ED.ed;", ""].join("\n"),
);
const C1_EMBEDS_TS_SOURCE = stagedTs(
  "T12.0-15 T9.2-1's src/embeds.ts (a text(...) call embedding Embed.mdx#em)",
  [
    'import EM, { text } from "../specs/Embed.xspec";',
    "",
    "text(EM.em);",
    "",
  ].join("\n"),
);
const C1_DROPPED_TS_BASELINE = stagedTs(
  "T12.0-15 T9.2-1's src/dropped.ts at the baseline (a references marker to Doomed.mdx#doom)",
  ['import DOOM from "../specs/Doomed.xspec";', "", "DOOM.doom;", ""].join(
    "\n",
  ),
);
const C1_DROPPED_TS_CURRENT = stagedTs(
  "T12.0-15 T9.2-1's src/dropped.ts with its marker deleted",
  ["export const droppedMarker = true;", ""].join("\n"),
);
const C1_ADDED_TS_SOURCE = stagedTs(
  "T12.0-15 T9.2-1's src/added.ts, added (a references marker to Fresh.mdx#fresh)",
  ['import FRESH from "../specs/Fresh.xspec";', "", "FRESH.fresh;", ""].join(
    "\n",
  ),
);

// T9.2-1's edited sources as staged-source records (S-9): the same template
// calls, moved to module level.
const C1_EDITED_V1 = stagedMdx(
  'T12.0-15 T9.2-1\'s specs/Edited.mdx at the baseline (c1EditedSource("Edited node text v1."))',
  c1EditedSource("Edited node text v1."),
);
const C1_EDITED_V2 = stagedMdx(
  'T12.0-15 T9.2-1\'s specs/Edited.mdx with ed edited (c1EditedSource("Edited node text v2."))',
  c1EditedSource("Edited node text v2."),
);
const C1_EMBED_V1 = stagedMdx(
  'T12.0-15 T9.2-1\'s specs/Embed.mdx at the baseline (c1EmbedSource("Embedded kid text v1."))',
  c1EmbedSource("Embedded kid text v1."),
);
const C1_EMBED_V2 = stagedMdx(
  'T12.0-15 T9.2-1\'s specs/Embed.mdx with em.kid edited (c1EmbedSource("Embedded kid text v2."))',
  c1EmbedSource("Embedded kid text v2."),
);

/** T9.2-1's staging: the four directly impacted arms (the module header). */
async function runT921Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  await withWorkspace(
    IMPACT_SPEC_AND_CODE_CONFIG,
    {
      [C1_EDITED]: C1_EDITED_V1,
      [C1_EMBED]: C1_EMBED_V1,
      [C1_DOOMED]: C1_DOOMED_SOURCE,
      [C1_REFS_TS]: C1_REFS_TS_SOURCE,
      [C1_EMBEDS_TS]: C1_EMBEDS_TS_SOURCE,
      [C1_DROPPED_TS]: C1_DROPPED_TS_BASELINE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");

      await workspace.file(C1_EDITED, C1_EDITED_V2);
      await workspace.file(C1_EMBED, C1_EMBED_V2);
      await fsp.rm(workspace.path(C1_DOOMED));
      await workspace.file(C1_DROPPED_TS, C1_DROPPED_TS_CURRENT);
      await workspace.file(C1_FRESH, C1_FRESH_SOURCE);
      await workspace.file(C1_ADDED_TS, C1_ADDED_TS_SOURCE);
      await buildOk(
        product,
        workspace,
        "T9.2-1 `build` over the edited workspace",
      );

      await visit(workspace, {
        label: "T9.2-1 after the edits, the deletion, and the addition",
        ref: base,
        home: async () => {
          const label = "T9.2-1 `impact --base <baseline> --json`";
          const report = await impactAgainst(product, workspace, base, label);
          assertImpactedCode(
            report,
            {
              direct: [
                // The edited target itself: single-node path (SPEC 9.3).
                {
                  location: C1_REFS_TS,
                  edge: { from: C1_REFS_TS, to: C1_ED, kind: "references" },
                  path: [C1_ED],
                },
                // The embeds target's descendant was edited: the target's
                // subtreeHash changed, so the location is directly impacted,
                // with the all-`contains` path down to the edited child.
                {
                  location: C1_EMBEDS_TS,
                  edge: { from: C1_EMBEDS_TS, to: C1_EM, kind: "embeds" },
                  path: [C1_EM, C1_EM_KID],
                },
                // Edge only in the baseline graph; the deleted node counts as
                // changed in both hashes (SPEC 9.2): single-node path.
                {
                  location: C1_DROPPED_TS,
                  edge: {
                    from: C1_DROPPED_TS,
                    to: C1_DOOM,
                    kind: "references",
                  },
                  path: [C1_DOOM],
                },
                // Edge only in the current graph; the added node counts as
                // changed in both hashes (SPEC 9.2): single-node path.
                {
                  location: C1_ADDED_TS,
                  edge: {
                    from: C1_ADDED_TS,
                    to: C1_FRESH_NODE,
                    kind: "references",
                  },
                  path: [C1_FRESH_NODE],
                },
              ],
              // Every impact edge above targets a node whose subtreeHash
              // changed, so no location qualifies as transitively impacted
              // (SPEC 9.2: effectiveHash changed but subtreeHash did not).
              transitive: [],
            },
            label,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            report,
            "T9.2-1",
          );
        },
      });
    },
  );
}

const T9_2_1 = defineProductTest({
  id: "T9.2-1",
  title:
    "directly impacted: a code location with an impact edge (in either graph) to a node whose subtreeHash changed is directly impacted — a `references` edge to an edited node, an `embeds` edge to a node with an edited descendant, an edge present only in the baseline (marker deleted, node deleted), and an edge present only in the current graph (marker added, node added); added/deleted nodes count as changed in both hashes, and none of these locations is transitively impacted; and at the `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — each requirement entry's nodes, categories, attribution identities, and deletion, and each code entry's location, edge kind and target, witness path, and group (robust matching, H-3) (SPEC 9.2, 9.3, 5.6, 12.0)",
  run: (product) => runT921Staging(product, HOME_IMPACT_READS),
});

// ---------------------------------------------------------------------------
// T9.2-2 — transitively impacted
// ---------------------------------------------------------------------------

// src/app.ts holds a marker to `tgt`, which depends on `up` in another file;
// only `up`'s text is edited. `tgt`'s effectiveHash changes through the
// dependency while its subtreeHash stays put, so the location is transitively
// impacted — and not directly.
const C2_DOWN = "specs/Down.mdx";
const C2_TGT = "specs/Down.mdx#tgt";
const C2_UP = "specs/Up.mdx";
const C2_UP_NODE = "specs/Up.mdx#up";
const C2_APP_TS = "src/app.ts";

const c2UpSource = (text: string): string =>
  ['<S id="up">', text, "</S>", ""].join("\n");
const C2_DOWN_SOURCE = stagedMdx(
  "T12.0-15 T9.2-2's specs/Down.mdx (tgt depending on Up.mdx#up)",
  [
    'import Up from "./Up.xspec"',
    "",
    '<S id="tgt" d={Up.up}>',
    "Target text with an upstream dependency.",
    "</S>",
    "",
  ].join("\n"),
);
const C2_APP_TS_SOURCE = stagedTs(
  "T12.0-15 T9.2-2's src/app.ts (a references marker to Down.mdx#tgt)",
  ['import DOWN from "../specs/Down.xspec";', "", "DOWN.tgt;", ""].join("\n"),
);

// T9.2-2's upstream source as staged-source records (S-9): the same
// template calls, moved to module level.
const C2_UP_V1 = stagedMdx(
  'T12.0-15 T9.2-2\'s specs/Up.mdx at the baseline (c2UpSource("Upstream text v1."))',
  c2UpSource("Upstream text v1."),
);
const C2_UP_V2 = stagedMdx(
  'T12.0-15 T9.2-2\'s specs/Up.mdx with up edited (c2UpSource("Upstream text v2."))',
  c2UpSource("Upstream text v2."),
);

/** T9.2-2's staging: an upstream dependency edit (the module header). */
async function runT922Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  await withWorkspace(
    IMPACT_SPEC_AND_CODE_CONFIG,
    {
      [C2_DOWN]: C2_DOWN_SOURCE,
      [C2_UP]: C2_UP_V1,
      [C2_APP_TS]: C2_APP_TS_SOURCE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");

      await workspace.file(C2_UP, C2_UP_V2);
      await buildOk(
        product,
        workspace,
        "T9.2-2 `build` over the upstream-edited workspace",
      );

      await visit(workspace, {
        label: "T9.2-2 after the upstream edit",
        ref: base,
        home: async () => {
          const label = "T9.2-2 `impact --base <baseline> --json`";
          const report = await impactAgainst(product, workspace, base, label);
          assertImpactedCode(
            report,
            {
              // `tgt`'s subtreeHash did not change (a dependency target's text
              // is no part of its own content, SPEC 5.5), so the location is
              // not directly impacted.
              direct: [],
              transitive: [
                {
                  location: C2_APP_TS,
                  edge: { from: C2_APP_TS, to: C2_TGT, kind: "references" },
                  // Every node on a transitive path has changed effectiveHash;
                  // the path ends at the node whose own edit explains the
                  // change (SPEC 9.3).
                  path: [C2_TGT, C2_UP_NODE],
                },
              ],
            },
            label,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            report,
            "T9.2-2",
          );
        },
      });
    },
  );
}

const T9_2_2 = defineProductTest({
  id: "T9.2-2",
  title:
    "transitively impacted: a location whose impact-edge target changed only in effectiveHash (upstream dependency edit) is transitively impacted, not directly — the directly impacted group is empty and the transitive witness path runs from the target through the dependency edge to the edited upstream node; and at the `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — each requirement entry's nodes, categories, and attribution identities, and each code entry's location, edge kind and target, witness path, and group (robust matching, H-3) (SPEC 9.2, 9.3, 5.6, 12.0)",
  run: (product) => runT922Staging(product, HOME_IMPACT_READS),
});

// ---------------------------------------------------------------------------
// T9.2-3 — deleted code location
// ---------------------------------------------------------------------------

const C3_MAIN = "specs/Main.mdx";
const C3_N = "specs/Main.mdx#n";
const C3_GONE_TS = "src/gone.ts";

const c3Source = (text: string): string =>
  ['<S id="n">', text, "</S>", ""].join("\n");
const C3_GONE_TS_SOURCE = stagedTs(
  "T12.0-15 T9.2-3's src/gone.ts at the baseline (a references marker to Main.mdx#n; deleted since)",
  ['import M from "../specs/Main.xspec";', "", "M.n;", ""].join("\n"),
);

// T9.2-3's spec source as staged-source records (S-9): the same template
// calls, moved to module level.
const C3_MAIN_V1 = stagedMdx(
  'T12.0-15 T9.2-3\'s specs/Main.mdx at the baseline (c3Source("Node text v1."))',
  c3Source("Node text v1."),
);
const C3_MAIN_V2 = stagedMdx(
  'T12.0-15 T9.2-3\'s specs/Main.mdx with n edited (c3Source("Node text v2."))',
  c3Source("Node text v2."),
);

/** T9.2-3's staging: a code file deleted, its target edited (the module header). */
async function runT923Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  await withWorkspace(
    IMPACT_SPEC_AND_CODE_CONFIG,
    {
      [C3_MAIN]: C3_MAIN_V1,
      [C3_GONE_TS]: C3_GONE_TS_SOURCE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");

      await workspace.file(C3_MAIN, C3_MAIN_V2);
      await fsp.rm(workspace.path(C3_GONE_TS));
      await buildOk(
        product,
        workspace,
        "T9.2-3 `build` over the workspace with the code file deleted",
      );

      await visit(workspace, {
        label: "T9.2-3 after the code file's deletion",
        ref: base,
        home: async () => {
          const label = "T9.2-3 `impact --base <baseline> --json`";
          const report = await impactAgainst(product, workspace, base, label);
          assertImpactedCode(
            report,
            {
              direct: [
                {
                  // The location exists only in the baseline graph; it is
                  // reported under its baseline identity (SPEC 9.2).
                  location: C3_GONE_TS,
                  edge: { from: C3_GONE_TS, to: C3_N, kind: "references" },
                  path: [C3_N],
                },
              ],
              transitive: [],
            },
            label,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            report,
            "T9.2-3",
          );
        },
      });
    },
  );
}

const T9_2_3 = defineProductTest({
  id: "T9.2-3",
  title:
    "deleted code location: a code location absent from the current graph (its file deleted) is reported under its baseline identity — its baseline impact edge to the since-edited node makes it directly impacted; and at the `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — each requirement entry's nodes, categories, and attribution identities, and the deleted location's baseline identity with its edge kind and target, witness path, and group (robust matching, H-3) (SPEC 9.2, 9.3, 5.6, 12.0)",
  run: (product) => runT923Staging(product, HOME_IMPACT_READS),
});

// ---------------------------------------------------------------------------
// T9.2-4 — category independence
// ---------------------------------------------------------------------------

// One location, two impact edges: one to `dt` (subtreeHash changed through
// its edited child), one to `tt` (effectiveHash alone changed through the
// edited upstream `up`). The location appears in both groups, each entry's
// edge and path minimized per category (SPEC 9.3).
const C4_DIRECT = "specs/Direct.mdx";
const C4_DT = "specs/Direct.mdx#dt";
const C4_DT_KID = "specs/Direct.mdx#dt.kid";
const C4_TRANS = "specs/Trans.mdx";
const C4_TT = "specs/Trans.mdx#tt";
const C4_UP = "specs/Up.mdx";
const C4_UP_NODE = "specs/Up.mdx#up";
const C4_BOTH_TS = "src/both.ts";

const c4DirectSource = (kidText: string): string =>
  [
    '<S id="dt">',
    "Direct target text.",
    "",
    '<S id="dt.kid">',
    kidText,
    "</S>",
    "</S>",
    "",
  ].join("\n");
const C4_TRANS_SOURCE = stagedMdx(
  "T12.0-15 T9.2-4's specs/Trans.mdx (tt depending on Up.mdx#up)",
  [
    'import Up from "./Up.xspec"',
    "",
    '<S id="tt" d={Up.up}>',
    "Transitive target text.",
    "</S>",
    "",
  ].join("\n"),
);
const c4UpSource = (text: string): string =>
  ['<S id="up">', text, "</S>", ""].join("\n");
const C4_BOTH_TS_SOURCE = stagedTs(
  "T12.0-15 T9.2-4's src/both.ts (references markers to Direct.mdx#dt and Trans.mdx#tt)",
  [
    'import DIRECT from "../specs/Direct.xspec";',
    'import TRANS from "../specs/Trans.xspec";',
    "",
    "DIRECT.dt;",
    "TRANS.tt;",
    "",
  ].join("\n"),
);

// T9.2-4's edited sources as staged-source records (S-9): the same template
// calls, moved to module level.
const C4_DIRECT_V1 = stagedMdx(
  'T12.0-15 T9.2-4\'s specs/Direct.mdx at the baseline (c4DirectSource("Direct kid text v1."))',
  c4DirectSource("Direct kid text v1."),
);
const C4_DIRECT_V2 = stagedMdx(
  'T12.0-15 T9.2-4\'s specs/Direct.mdx with dt.kid edited (c4DirectSource("Direct kid text v2."))',
  c4DirectSource("Direct kid text v2."),
);
const C4_UP_V1 = stagedMdx(
  'T12.0-15 T9.2-4\'s specs/Up.mdx at the baseline (c4UpSource("Upstream text v1."))',
  c4UpSource("Upstream text v1."),
);
const C4_UP_V2 = stagedMdx(
  'T12.0-15 T9.2-4\'s specs/Up.mdx with up edited (c4UpSource("Upstream text v2."))',
  c4UpSource("Upstream text v2."),
);

/** T9.2-4's staging: one location, a subtree edit and an upstream edit (the module header). */
async function runT924Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  await withWorkspace(
    IMPACT_SPEC_AND_CODE_CONFIG,
    {
      [C4_DIRECT]: C4_DIRECT_V1,
      [C4_TRANS]: C4_TRANS_SOURCE,
      [C4_UP]: C4_UP_V1,
      [C4_BOTH_TS]: C4_BOTH_TS_SOURCE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("baseline");

      await workspace.file(C4_DIRECT, C4_DIRECT_V2);
      await workspace.file(C4_UP, C4_UP_V2);
      await buildOk(
        product,
        workspace,
        "T9.2-4 `build` over the doubly-edited workspace",
      );

      await visit(workspace, {
        label: "T9.2-4 after the subtree and upstream edits",
        ref: base,
        home: async () => {
          const label = "T9.2-4 `impact --base <baseline> --json`";
          const report = await impactAgainst(product, workspace, base, label);
          assertImpactedCode(
            report,
            {
              direct: [
                {
                  location: C4_BOTH_TS,
                  // Only the edge to `dt` qualifies for the direct category
                  // (`tt`'s subtreeHash is unchanged); its qualifying path is
                  // all-`contains`, ending at the edited child.
                  edge: { from: C4_BOTH_TS, to: C4_DT, kind: "references" },
                  path: [C4_DT, C4_DT_KID],
                },
              ],
              transitive: [
                {
                  location: C4_BOTH_TS,
                  // Only the edge to `tt` qualifies for the transitive
                  // category (`dt`'s subtreeHash changed); its path follows
                  // changed effectiveHashes to the edited upstream node.
                  edge: { from: C4_BOTH_TS, to: C4_TT, kind: "references" },
                  path: [C4_TT, C4_UP_NODE],
                },
              ],
            },
            label,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            report,
            "T9.2-4",
          );
        },
      });
    },
  );
}

const T9_2_4 = defineProductTest({
  id: "T9.2-4",
  title:
    "category independence: one code location with two impact edges — one to a node whose subtreeHash changed, one to a node whose effectiveHash alone changed — appears in both the directly and the transitively impacted group, each entry's edge and path minimized per category: the direct entry reports the subtree-changed target's edge with its all-`contains` path, the transitive entry the other edge with its effectiveHash path; and at the `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — each requirement entry's nodes, categories, and attribution identities, and each code entry's location, edge kind and target, witness path, and both groups (robust matching, H-3) (SPEC 9.2, 9.3, 5.6, 12.0)",
  run: (product) => runT924Staging(product, HOME_IMPACT_READS),
});

// ---------------------------------------------------------------------------
// T9.2-5 — impact edges mapped through the journal
// ---------------------------------------------------------------------------

const C5_SPEC = "specs/Spec.mdx";
const C5_BETA = "specs/Spec.mdx#beta";
const C5_APP_TS = "src/app.ts";

const c5Source = (text: string): string =>
  ['<S id="alpha">', text, "</S>", ""].join("\n");
const C5_APP_TS_SOURCE = stagedTs(
  "T12.0-15 T9.2-5's src/app.ts (a references marker to Spec.mdx#alpha)",
  ['import SPEC from "../specs/Spec.xspec";', "", "SPEC.alpha;", ""].join("\n"),
);

// T9.2-5's spec source at the baseline as a staged-source record (S-9): the
// same template call, moved to module level.
const C5_SPEC_V1 = stagedMdx(
  'T12.0-15 T9.2-5\'s specs/Spec.mdx at the baseline (c5Source("Renamed node text v1."): alpha, renamed to beta since)',
  c5Source("Renamed node text v1."),
);

/** T9.2-5's staging: a journaled rename, then a text edit to the renamed node (the module header). */
async function runT925Staging(
  product: ProductBinding,
  visit: ImpactReadVisitor,
): Promise<void> {
  await withWorkspace(
    IMPACT_SPEC_AND_CODE_CONFIG,
    {
      [C5_SPEC]: C5_SPEC_V1,
      [C5_APP_TS]: C5_APP_TS_SOURCE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("pre-rename baseline");
      await buildOk(
        product,
        workspace,
        "T9.2-5 `build` over the staged workspace",
      );

      await expectExit(
        product,
        workspace,
        ["rename", "specs/Spec.mdx", "alpha", "beta"],
        0,
        "T9.2-5 `rename specs/Spec.mdx alpha beta`",
      );

      // Premise (crisp diagnosis ahead of the impact assertion): the
      // rename rewrote the code-side marker to the new identity (SPEC 6.4).
      const appText = await readSourceText(
        workspace,
        C5_APP_TS,
        "T9.2-5 rewrite premise",
      );
      if (appText.includes("alpha") || !appText.includes("beta")) {
        fail(
          `T9.2-5 rewrite premise: after the rename, ${C5_APP_TS} must ` +
            `reference the new identity (\`beta\`) and no longer spell the ` +
            `old one (\`alpha\`) — rename rewrites every reference across ` +
            `all configured spec and code sources (SPEC 6.4); got: ` +
            JSON.stringify(appText),
        );
      }

      // The real edit: the renamed node's own text run, applied to the
      // product-rewritten source through `workspace.edit()` — an edit of
      // bytes the product wrote, judged at staging time (no harness
      // constant equals them; helpers/staged-mdx.ts), after the diagnosed
      // premise that the run is still present. The edit keeps the test
      // independent of the rename's exact byte-level rewrite (T6.4-2's
      // business).
      const specText = await readSourceText(
        workspace,
        C5_SPEC,
        "T9.2-5 edit staging",
      );
      if (!specText.includes("Renamed node text v1.")) {
        fail(
          `T9.2-5 edit staging: the renamed source must still carry the ` +
            `node's text run ${JSON.stringify("Renamed node text v1.")} — ` +
            `rename rewrites identities and reference spellings only ` +
            `(SPEC 6.2, 6.4); got: ${JSON.stringify(specText)}`,
        );
      }
      await workspace.edit(
        C5_SPEC,
        "Renamed node text v1.",
        "Renamed node text v2.",
      );
      await buildOk(
        product,
        workspace,
        "T9.2-5 `build` over the post-rename edited workspace",
      );

      await visit(workspace, {
        label: "T9.2-5 after the journaled rename and the edit",
        ref: base,
        home: async () => {
          const label = "T9.2-5 `impact --base <pre-rename ref> --json`";
          const report = await impactAgainst(product, workspace, base, label);
          assertImpactedCode(
            report,
            {
              // Exactly one direct entry: the baseline edge (to old `alpha`,
              // mapped through the journal) and the current edge (to `beta`)
              // unify into one impact edge to one changed node (SPEC 9.2, 6.3).
              // A product that drops journal-mapped edges reports the location
              // unimpacted; one that treats the identities as a deletion plus
              // an addition reports a wrong target or a duplicate entry.
              direct: [
                {
                  location: C5_APP_TS,
                  edge: { from: C5_APP_TS, to: C5_BETA, kind: "references" },
                  path: [C5_BETA],
                },
              ],
              transitive: [],
            },
            label,
          );
          await assertHumanImpactReport(
            product,
            workspace,
            base,
            report,
            "T9.2-5",
          );
        },
      });
    },
  );
}

const T9_2_5 = defineProductTest({
  id: "T9.2-5",
  title:
    "impact edges mapped through the journal: after a journaled `rename alpha→beta` and a text edit to the renamed node, the code location whose marker was rewritten appears in the directly impacted group exactly once — its witness edge targeting the current identity `beta` with the single-node path — and not in the transitively impacted group: the baseline edge (old identity) and the current edge (new identity) unify into one impact edge to one changed node; the positive counterpart of T6.2-1's emptiness arm; and at the `--json` read's state the human `impact` exits 0 alike and carries every entry the report holds — each requirement entry's nodes, categories, and attribution identities, and the code entry's location, edge kind and target, witness path, and group (robust matching, H-3) (SPEC 9.2, 9.3, 5.6, 6.3, 12.0)",
  run: (product) => runT925Staging(product, HOME_IMPACT_READS),
});

/**
 * The stagings of T9-1 through T9.2-5, in canonical ID order — T12.0-15's
 * `impact` family runs each with its human twin as the visitor
 * (section-12.0-iv.ts).
 */
export const T9_IMPACT_STAGINGS: readonly ImpactStaging[] = [
  { test: "T9-1", run: runT91Staging },
  { test: "T9.1-1", run: runT911Staging },
  { test: "T9.2-1", run: runT921Staging },
  { test: "T9.2-2", run: runT922Staging },
  { test: "T9.2-3", run: runT923Staging },
  { test: "T9.2-4", run: runT924Staging },
  { test: "T9.2-5", run: runT925Staging },
];

/** TEST-SPEC §9 through §9.2, in canonical ID order (SUITE-31). */
export const section9Tests: readonly ProductTestEntry[] = [
  T9_1,
  T9_1_1,
  T9_2_1,
  T9_2_2,
  T9_2_3,
  T9_2_4,
  T9_2_5,
];
