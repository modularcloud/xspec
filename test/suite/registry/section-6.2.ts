// TEST-SPEC §6.2 (identity guarantee) — SUITE-22: T6.2-1…T6.2-4.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.2: `rename` and the file form of `move` are pure — they change only
// identities and reference spellings and leave every hash byte-identical,
// producing no change categories relative to any baseline, because child
// constructs and references hash by canonical identity (5.4), which journaled
// operations preserve. The section form of `move` is impure only through its
// text edits: the identity mapping itself changes no hash, and every moved
// node keeps its metadataHash unconditionally; own content can differ between
// origin and destination only on the construct's straddling lines, where the
// line-drop rule of 3 consults characters outside the moved text. Baselines
// are committed git sources (HARNESS-01: pinned identities and timestamps);
// the baseline commit precedes the first `build`, so it holds sources only.
//
// Conservative operationalizations (noted per H-4):
// - "No change categories" is asserted as an empty `requirements` list — the
//   suite's fixed T1.5-1 interpretation (SPEC 9.3 groups output by category,
//   so an uncategorized node appears under none), carried through SUITE-20.
// - "Full-workspace sweep" is realized as `query nodes` enumeration,
//   premise-asserted to equal the fixture's statically known identity set (a
//   sweep silently missing nodes could not witness "every node's four
//   hashes"), followed by `query node <identity>` for the four hashes of
//   each node (SPEC 11). Code locations are not requirement nodes and carry
//   no hashes; the sweep is over requirement nodes.
// - Impact entries here must all report `deleted: false`, and any identity
//   outside the expectation table — a pre-operation identity in particular —
//   fails: a product that does not unify identities through the journal
//   (SPEC 6.3, 9.2) reports the vacated identity as deleted and the new one
//   as added, and both are diagnosed.
// - T6.2-3 asserts, for every node of the moved subtree, exactly the three
//   hashes its TEST-SPEC text names (ownHash, subtreeHash, metadataHash);
//   effectiveHash is not asserted directly — TEST-SPEC deliberately omits it
//   (in general a moved subtree's effectiveHash can change through
//   dependency targets) — but the category table still bounds it: these
//   fixtures give the moved subtree no dependency edges, so an
//   `upstream-changed` entry for a moved node would fail as an extra
//   category.
// - T6.2-3's category table pins what SPEC 5.6 decides and bounds what it
//   leaves open. Decided: which nodes are `changed` (exactly the origin and
//   target parents, plus the impure-boundary moved node in the impure arms,
//   plus the sibling whose residue is left alone on a line the deletion
//   joins or the insertion splits in the sibling stagings (d)/(e) — 6.2's
//   enumeration beyond the parents and the moved subtree); own texts on
//   the pinned nodes byte-asserted through `query node` (SPEC 1.6: exact
//   bytes) as the sharp witness of SPEC 3's drop-rule decisions;
//   the file roots' `descendant-changed` (their changed parent is a
//   descendant present on both sides); the dependents' `upstream-changed`
//   with exact attribution (a dependency-edge target's effectiveHash changed;
//   the edge's target is identity-mapped, so the cascade is unambiguous —
//   the sharp realization of "with the 5.6 cascades attributed to it").
//   Left open, and tolerated: whether a parent whose (former or new) child
//   changed while under it on only one side — the impure moved node departed
//   the origin parent and arrived under the target parent — additionally
//   carries `descendant-changed`, since SPEC 5.6's baseline comparison is
//   defined for nodes present on both sides and the moved node is a
//   descendant of each parent on only one side. Such an entry is accepted
//   only when attributed to the moved node; any other spelling fails.
// - Attribution of the originating category `changed` is unpinned by
//   TEST-SPEC (SPEC 5.6 bounds it to originating nodes), so it is asserted
//   as a subset of the fixture's originating-node set, the empty list
//   accepted — the SUITE-20 convention.

import type {
  ChangeCategory,
  ImpactReport,
  NodeHashes,
  NodeReport,
} from "../../helpers/adapters/index.js";
import {
  decodeImpactReport,
  decodeNodeReport,
  decodeNodeRowsReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertFileBytes,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertSameJson,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  runJson,
  sortedIdentities,
} from "./support.js";

// One spec group plus one code group (SPEC 7.2), for the T6.2-1/T6.2-2
// fixtures whose impacted-code assertions need a discovered code location.
const SPEC_AND_CODE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

// Exactly one spec group (SPEC 7), for the T6.2-3/T6.2-4 fixtures.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: string,
  files: Readonly<Record<string, string>>,
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

/** Full `query node` report (SPEC 11, JSON-only; H-3). */
async function queryNode(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  context: string,
): Promise<NodeReport> {
  const label = `${context} \`query node ${identity}\``;
  return decodeNodeReport(
    await runJson(product, workspace, ["query", "node", identity], label),
    label,
  );
}

/**
 * The full-workspace hash sweep (T6.2-1/T6.2-2/T6.2-4): enumerate every
 * requirement node via `query nodes`, premise-assert the enumeration equals
 * the fixture's statically known identity set (module header, H-4), and
 * collect all four hashes of every node via `query node` (SPEC 5.5, 11).
 */
async function sweepHashes(
  product: ProductBinding,
  workspace: TestWorkspace,
  expectedIdentities: readonly string[],
  context: string,
): Promise<Map<string, NodeHashes>> {
  const enumLabel = `${context} \`query nodes\` (full-workspace enumeration)`;
  const rows = decodeNodeRowsReport(
    await runJson(product, workspace, ["query", "nodes"], enumLabel),
    enumLabel,
  );
  assertSameJson(
    sortedIdentities(rows),
    [...expectedIdentities].sort(),
    `${context}: the sweep must enumerate exactly the fixture's requirement ` +
      `nodes, in the workspace-relative identity form of SPEC 1.5 (SPEC 11) — ` +
      `a sweep over any other node set could not witness "every node's four ` +
      `hashes" (SPEC 6.2)`,
  );
  const hashes = new Map<string, NodeHashes>();
  for (const identity of [...expectedIdentities].sort()) {
    hashes.set(
      identity,
      (await queryNode(product, workspace, identity, context)).hashes,
    );
  }
  return hashes;
}

/**
 * Assert a pure operation left every node's four hashes byte-identical
 * (SPEC 6.2): each pre-operation node, looked up after the operation under
 * its mapped identity (`identityMap`, identities absent from it unchanged),
 * reports the same four hash strings.
 */
function assertHashesPreserved(
  before: ReadonlyMap<string, NodeHashes>,
  after: ReadonlyMap<string, NodeHashes>,
  identityMap: Readonly<Record<string, string>>,
  operation: string,
  context: string,
): void {
  for (const [pre, hashes] of before) {
    const post = identityMap[pre] ?? pre;
    const actual = after.get(post);
    if (actual === undefined) {
      throw new Error(
        `fixture bug: ${post} is missing from the post-operation sweep despite ` +
          `the enumeration premise`,
      );
    }
    assertSameJson(
      actual,
      hashes,
      `${context}: ${operation} is pure — every hash in the workspace stays ` +
        `byte-identical, because references hash by canonical identity (5.4), ` +
        `which journaled operations preserve (SPEC 6.2, 5.5); the four hashes ` +
        `of ${pre}${post === pre ? "" : ` (now ${post})`} differ`,
    );
  }
}

/**
 * `impact --base <ref> --json`: exit 0 (impact is informational, SPEC 9.3;
 * H-5) with exactly one JSON document, decoded as the impact report (H-3).
 */
async function impactAgainst(
  product: ProductBinding,
  workspace: TestWorkspace,
  ref: string,
  context: string,
): Promise<ImpactReport> {
  const result = await expectExit(
    product,
    workspace,
    ["impact", "--base", ref, "--json"],
    0,
    context,
  );
  return decodeImpactReport(parseJsonStdout(result, context), context);
}

/**
 * Assert an impact report shows a pure operation (T6.2-1/T6.2-2/T6.2-4): no
 * requirement entry at all — no node carries any change category (SPEC 6.2,
 * 9.1; the T1.5-1 empty-requirements convention) — and both impacted-code
 * groups empty: the location's baseline impact edges (old identities) and
 * current ones (new identities) unify through the journal (SPEC 9.2, 6.3); a
 * product failing to unify them evaluates a deleted and an added target
 * instead — each counting as changed in both hashes (9.2) — and reports the
 * location spuriously impacted.
 */
function assertPureImpact(
  report: ImpactReport,
  operation: string,
  context: string,
): void {
  assertSameJson(
    report.requirements,
    [],
    `${context}: ${operation} must produce no change categories relative to ` +
      `the pre-operation baseline — every hash is unchanged and identities ` +
      `map through the journal, so no node receives any category and the ` +
      `requirements list is empty (SPEC 6.2, 6.3, 9.1)`,
  );
  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: the directly and the transitively impacted code groups must ` +
      `be empty — the code location's baseline impact edges (old identities) ` +
      `and current ones (new identities) unify through the journal (SPEC 9.2, ` +
      `6.3); a product failing to unify them evaluates a deleted and an added ` +
      `target instead, each counting as changed in both hashes (9.2), and ` +
      `reports the location spuriously impacted`,
  );
}

/**
 * Read a workspace source file as UTF-8 text, failing diagnosed (H-8) when
 * the path does not hold a plain file.
 */
async function readSourceText(
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

/**
 * Premise check that an operation rewrote a source's references (SPEC 6.4,
 * 6.5): the stale spelling is gone and, when one is pinned by the minimal
 * edit rules, the rewritten spelling is present. Deliberately substring-level
 * (byte-exact rewrite content is T6.4-2/T6.5-2's business); this check makes
 * a missing rewrite fail with a crisp diagnosis instead of a downstream one.
 */
function assertRewriteHappened(
  text: string,
  rel: string,
  staleSpelling: string,
  rewrittenSpelling: string | undefined,
  context: string,
): void {
  if (text.includes(staleSpelling)) {
    fail(
      `${context}: ${rel} still contains the stale spelling ` +
        `${JSON.stringify(staleSpelling)} — the operation rewrites every ` +
        `reference to the affected identities across all configured spec and ` +
        `code sources (SPEC 6.4, 6.5)`,
    );
  }
  if (rewrittenSpelling !== undefined && !text.includes(rewrittenSpelling)) {
    fail(
      `${context}: ${rel} does not contain the rewritten spelling ` +
        `${JSON.stringify(rewrittenSpelling)} — the rewrite keeps dot access ` +
        `for valid-identifier segments and retargets the reference to the new ` +
        `identity (SPEC 6.4)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Category-table assertion (T6.2-3)
// ---------------------------------------------------------------------------

/** Expected attribution for one category of one node (module header, H-4). */
interface ExpectedCategory {
  readonly category: ChangeCategory;
  /** Attribution pinned exactly. Exactly one of `exact`/`within`. */
  readonly exact?: readonly string[];
  /** Attribution bounded: the merged `attributedTo` must be a subset. */
  readonly within?: readonly string[];
  /** With `within`: identities the attribution must include. */
  readonly mustInclude?: readonly string[];
  /**
   * The category may be absent entirely — the two-sided `descendant-changed`
   * ambiguity documented in the module header. When present, its attribution
   * is checked like any other.
   */
  readonly optional?: boolean;
}

/** The complete expectation for one node identity of a fixture. */
interface ExpectedNodeImpact {
  /** Current (post-operation, journal-mapped) identity — nothing is deleted. */
  readonly identity: string;
  /** The node's category expectations; empty = must receive no category. */
  readonly categories: readonly ExpectedCategory[];
}

/**
 * Assert an impact report's requirement-level content against the complete
 * per-node expectation table of a fixture (SPEC 5.6, 6.2, 9.1):
 *
 * - every identity named by any entry must be in the table — a pre-operation
 *   identity in particular fails: identities must be unified through the
 *   journal (SPEC 6.3, 9.2);
 * - every entry must report `deleted: false` — a journaled move deletes
 *   nothing (SPEC 6.2);
 * - a node whose expected categories are empty (or all optional and absent)
 *   must be named by no entry (the T1.5-1 convention);
 * - the categories merged across entries naming a node must equal the
 *   required set, extended by whichever optional ones appear; nothing else;
 * - each category's attribution is checked per its expectation;
 * - no code location is impacted (these fixtures configure no code groups).
 */
function assertImpactTable(
  report: ImpactReport,
  expectations: readonly ExpectedNodeImpact[],
  context: string,
): void {
  const expectedBy = new Map<string, ExpectedNodeImpact>();
  for (const expectation of expectations) {
    if (expectedBy.has(expectation.identity)) {
      throw new Error(
        `fixture bug: duplicate expectation for ${expectation.identity}`,
      );
    }
    for (const category of expectation.categories) {
      if ((category.exact === undefined) === (category.within === undefined)) {
        throw new Error(
          `fixture bug: category ${category.category} of ` +
            `${expectation.identity} must declare exactly one of exact/within`,
        );
      }
      if (
        category.mustInclude !== undefined &&
        (category.within === undefined ||
          category.mustInclude.some(
            (identity) => !category.within?.includes(identity),
          ))
      ) {
        throw new Error(
          `fixture bug: mustInclude of ${category.category} of ` +
            `${expectation.identity} requires a within bound containing it`,
        );
      }
    }
    expectedBy.set(expectation.identity, expectation);
  }

  // Merge the report per node identity (SPEC 9.3 fixes the grouping, not the
  // adapter-level entry granularity — the SUITE-20 convention).
  const actualBy = new Map<string, Map<ChangeCategory, string[]>>();
  for (const entry of report.requirements) {
    for (const identity of entry.nodes) {
      const expected = expectedBy.get(identity);
      if (expected === undefined) {
        fail(
          `${context}: the report names ${JSON.stringify(identity)}, which is ` +
            `no current node of the fixture (in the workspace-relative ` +
            `identity form of SPEC 1.5) — a pre-operation identity here means ` +
            `the product failed to unify identities through the journal ` +
            `(SPEC 6.2, 6.3, 9.2); entry: ${JSON.stringify(entry)}`,
        );
      }
      if (entry.deleted) {
        fail(
          `${context}: an entry names ${JSON.stringify(identity)} as deleted — ` +
            `a journaled move deletes nothing: the moved subtree keeps its ` +
            `identity through the journal mapping (SPEC 6.2, 6.3, 9.3); ` +
            `entry: ${JSON.stringify(entry)}`,
        );
      }
      let merged = actualBy.get(identity);
      if (merged === undefined) {
        merged = new Map();
        actualBy.set(identity, merged);
      }
      for (const category of entry.categories) {
        const attributed = merged.get(category.category) ?? [];
        attributed.push(...category.attributedTo);
        merged.set(category.category, attributed);
      }
    }
  }

  for (const expected of expectations) {
    const merged = actualBy.get(expected.identity);
    const required = expected.categories.filter(
      (category) => category.optional !== true,
    );
    const byName = new Map(
      expected.categories.map((category) => [category.category, category]),
    );
    if (byName.size !== expected.categories.length) {
      throw new Error(
        `fixture bug: duplicate category expectation on ${expected.identity}`,
      );
    }

    if (merged === undefined) {
      if (required.length > 0) {
        fail(
          `${context}: ${expected.identity} must carry the categories ` +
            `${JSON.stringify(required.map((category) => category.category).sort())} ` +
            `(SPEC 5.6, 6.2), but no requirement entry names it`,
        );
      }
      continue;
    }
    if (expected.categories.length === 0) {
      fail(
        `${context}: ${expected.identity} must receive no category — its ` +
          `hashes are unchanged and its identity maps through the journal ` +
          `(SPEC 6.2, 5.6) — and so appear in no requirement entry (SPEC 9.3 ` +
          `groups output by category; the T1.5-1 convention), but the report ` +
          `names it with categories ` +
          `${JSON.stringify([...merged.keys()].sort())}`,
      );
    }

    for (const name of merged.keys()) {
      if (!byName.has(name)) {
        fail(
          `${context}: ${expected.identity} carries the category ${name}, ` +
            `which SPEC 5.6 gives it no ground for — expected ` +
            `${JSON.stringify([...byName.keys()].sort())} (optional ones ` +
            `included; SPEC 5.6, 6.2)`,
        );
      }
    }
    for (const category of required) {
      if (!merged.has(category.category)) {
        fail(
          `${context}: ${expected.identity} must carry ${category.category} ` +
            `(SPEC 5.6, 6.2), but the report gives it only ` +
            `${JSON.stringify([...merged.keys()].sort())}`,
        );
      }
    }

    for (const [name, rawAttribution] of merged) {
      const expectation = byName.get(name);
      if (expectation === undefined) continue; // failed above
      const attributed = [...new Set(rawAttribution)].sort();
      if (expectation.exact !== undefined) {
        assertSameJson(
          attributed,
          [...expectation.exact].sort(),
          `${context}: the ${name} category of ${expected.identity} must be ` +
            `attributed to exactly its originating node(s) (SPEC 5.6, 9.1)`,
        );
        continue;
      }
      for (const identity of attributed) {
        if (!expectation.within?.includes(identity)) {
          fail(
            `${context}: the ${name} category of ${expected.identity} is ` +
              `attributed to ${JSON.stringify(identity)}, outside its ` +
              `originating-node bound ` +
              `${JSON.stringify([...(expectation.within ?? [])].sort())} ` +
              `(SPEC 5.6: every category is attributed to its originating nodes)`,
          );
        }
      }
      for (const identity of expectation.mustInclude ?? []) {
        if (!attributed.includes(identity)) {
          fail(
            `${context}: the ${name} category of ${expected.identity} must be ` +
              `attributed to ${JSON.stringify(identity)} among its originating ` +
              `nodes (SPEC 5.6, 9.1); got ${JSON.stringify(attributed)}`,
          );
        }
      }
    }
  }

  assertSameJson(
    report.code,
    { direct: [], transitive: [] },
    `${context}: no code groups are configured, so no code location is ` +
      `impacted (SPEC 9.2)`,
  );
}

// ---------------------------------------------------------------------------
// T6.2-1 — rename purity
// ---------------------------------------------------------------------------

// The rename subject: a mid-tree node with a descendant (both re-identified
// by prefix replacement), a sibling, metadata on the renamed node (so its
// kept metadataHash is content-bearing), plus a spec file and a code location
// referencing the renamed nodes — every reference spelling is rewritten
// (SPEC 6.4) while every hash stays put (SPEC 6.2, 5.4).
const R1_CORE = "specs/Core.mdx";
const R1_TOP = "specs/Core.mdx#core";
const R1_MID_PRE = "specs/Core.mdx#core.mid";
const R1_LEAF_PRE = "specs/Core.mdx#core.mid.leaf";
const R1_MID_POST = "specs/Core.mdx#core.hub";
const R1_LEAF_POST = "specs/Core.mdx#core.hub.leaf";
const R1_OTHER = "specs/Core.mdx#core.other";
const R1_REFS = "specs/Refs.mdx";
const R1_REFS_TOP = "specs/Refs.mdx#refs";
const R1_REFS_DEP = "specs/Refs.mdx#refs.dep";
const R1_APP = "src/app.ts";

const R1_CORE_SOURCE = [
  '<S id="core">',
  "Core holder text.",
  "",
  '<S id="core.mid" coverage="none" tags="mid keep">',
  "Mid text carrying metadata.",
  "",
  '<S id="core.mid.leaf">',
  "Leaf text under the renamed node.",
  "</S>",
  "</S>",
  "",
  '<S id="core.other">',
  "Sibling text staying put.",
  "</S>",
  "</S>",
  "",
].join("\n");

const R1_REFS_SOURCE = [
  'import Core from "./Core.xspec"',
  "",
  '<S id="refs">',
  "Refs holder text.",
  "",
  '<S id="refs.dep" d={Core.core.mid}>',
  "Depends on the renamed node. Embeds: {text(Core.core.mid.leaf)}",
  "</S>",
  "</S>",
  "",
].join("\n");

// One code location (the whole file, SPEC 4.6) bearing a marker and a
// `text(...)` call whose targets are renamed nodes — both rewritten (6.4),
// and the location's baseline and current impact edges must unify through
// the journal (9.2).
const R1_APP_SOURCE = [
  'import CORE, { text } from "../specs/Core.xspec";',
  "",
  "CORE.core.mid.leaf;",
  "text(CORE.core.mid);",
  "",
].join("\n");

const R1_PRE_IDENTITIES = [
  R1_CORE,
  R1_TOP,
  R1_MID_PRE,
  R1_LEAF_PRE,
  R1_OTHER,
  R1_REFS,
  R1_REFS_TOP,
  R1_REFS_DEP,
];
const R1_IDENTITY_MAP: Readonly<Record<string, string>> = {
  [R1_MID_PRE]: R1_MID_POST,
  [R1_LEAF_PRE]: R1_LEAF_POST,
};
const R1_POST_IDENTITIES = R1_PRE_IDENTITIES.map(
  (identity) => R1_IDENTITY_MAP[identity] ?? identity,
);

const T6_2_1 = defineProductTest({
  id: "T6.2-1",
  title:
    "rename purity: after `xspec rename`, every node's four hashes are byte-identical (full-workspace sweep) and `impact --base <pre-rename ref>` reports no change categories and empty directly/transitively impacted code — the code location's marker and `text(...)` edges (old identities at the baseline, new ones currently) unify through the journal (SPEC 6.2, 6.3, 6.4, 9.2)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        [R1_CORE]: R1_CORE_SOURCE,
        [R1_REFS]: R1_REFS_SOURCE,
        [R1_APP]: R1_APP_SOURCE,
      },
      async (workspace) => {
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("pre-rename baseline");
        await buildOk(
          product,
          workspace,
          "T6.2-1 `build` over the staged workspace",
        );

        const before = await sweepHashes(
          product,
          workspace,
          R1_PRE_IDENTITIES,
          "T6.2-1 pre-rename sweep",
        );

        await expectExit(
          product,
          workspace,
          ["rename", "specs/Core.mdx", "core.mid", "core.hub"],
          0,
          "T6.2-1 `rename specs/Core.mdx core.mid core.hub`",
        );

        // Premise: the rename rewrote the spec-side and code-side reference
        // spellings (SPEC 6.4) — a crisp diagnosis ahead of the sweep.
        for (const rel of [R1_REFS, R1_APP]) {
          assertRewriteHappened(
            await readSourceText(workspace, rel, "T6.2-1 rewrite premise"),
            rel,
            "core.mid",
            "core.hub",
            "T6.2-1 rewrite premise",
          );
        }

        const after = await sweepHashes(
          product,
          workspace,
          R1_POST_IDENTITIES,
          "T6.2-1 post-rename sweep",
        );
        assertHashesPreserved(
          before,
          after,
          R1_IDENTITY_MAP,
          "`xspec rename`",
          "T6.2-1",
        );

        const label = "T6.2-1 `impact --base <pre-rename ref> --json`";
        assertPureImpact(
          await impactAgainst(product, workspace, base, label),
          "a journaled `rename`",
          label,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.2-2 — file-move purity
// ---------------------------------------------------------------------------

// The moved file itself imports another spec file (its own import specifier
// must be rewritten across the directory change, SPEC 6.5) and is referenced
// by a spec file and a code location (their import paths rewritten); IDs are
// unchanged and identities change only in their file part.
const M2_OTHER = "specs/Other.mdx";
const M2_OTH = "specs/Other.mdx#oth";
const M2_CORE = "specs/Core.mdx";
const M2_MOVED = "specs/sub/Moved.mdx";
const M2_REFS = "specs/Refs.mdx";
const M2_APP = "src/app.ts";

const M2_OTHER_SOURCE = [
  '<S id="oth">',
  "Outside target text.",
  "</S>",
  "",
].join("\n");

const M2_CORE_SOURCE = [
  'import Other from "./Other.xspec"',
  "",
  '<S id="core">',
  "Core holder text.",
  "",
  '<S id="core.mid" d={Other.oth} coverage="none" tags="mid keep">',
  "Mid text with a dependency.",
  "",
  '<S id="core.mid.leaf">',
  "Leaf text embedding: {text(Other.oth)}",
  "</S>",
  "</S>",
  "</S>",
  "",
].join("\n");

const M2_REFS_SOURCE = [
  'import Core from "./Core.xspec"',
  "",
  '<S id="refs">',
  "Refs holder text.",
  "",
  '<S id="refs.dep" d={Core.core.mid}>',
  "Depends on the moved file. Embeds: {text(Core.core.mid.leaf)}",
  "</S>",
  "</S>",
  "",
].join("\n");

const M2_APP_SOURCE = [
  'import CORE, { text } from "../specs/Core.xspec";',
  "",
  "CORE.core.mid.leaf;",
  "text(CORE.core.mid);",
  "",
].join("\n");

const M2_PRE_IDENTITIES = [
  M2_OTHER,
  M2_OTH,
  M2_CORE,
  `${M2_CORE}#core`,
  `${M2_CORE}#core.mid`,
  `${M2_CORE}#core.mid.leaf`,
  M2_REFS,
  `${M2_REFS}#refs`,
  `${M2_REFS}#refs.dep`,
];
// Identities change only in their file part (SPEC 6.5): same IDs, new path.
const M2_IDENTITY_MAP: Readonly<Record<string, string>> = {
  [M2_CORE]: M2_MOVED,
  [`${M2_CORE}#core`]: `${M2_MOVED}#core`,
  [`${M2_CORE}#core.mid`]: `${M2_MOVED}#core.mid`,
  [`${M2_CORE}#core.mid.leaf`]: `${M2_MOVED}#core.mid.leaf`,
};
const M2_POST_IDENTITIES = M2_PRE_IDENTITIES.map(
  (identity) => M2_IDENTITY_MAP[identity] ?? identity,
);

const T6_2_2 = defineProductTest({
  id: "T6.2-2",
  title:
    "file-move purity: after `xspec move old.mdx new.mdx` every node's four hashes are byte-identical (full-workspace sweep), identities change only in their file part, `impact --base <pre-move ref>` reports no change categories, and the marker-and-`text(...)` code location's impacted-code groups are empty — its edges unify through the journal despite the rewritten import specifiers (SPEC 6.2, 6.3, 6.5, 9.2)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        [M2_OTHER]: M2_OTHER_SOURCE,
        [M2_CORE]: M2_CORE_SOURCE,
        [M2_REFS]: M2_REFS_SOURCE,
        [M2_APP]: M2_APP_SOURCE,
      },
      async (workspace) => {
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("pre-move baseline");
        await buildOk(
          product,
          workspace,
          "T6.2-2 `build` over the staged workspace",
        );

        const before = await sweepHashes(
          product,
          workspace,
          M2_PRE_IDENTITIES,
          "T6.2-2 pre-move sweep",
        );

        await expectExit(
          product,
          workspace,
          ["move", "specs/Core.mdx", "specs/sub/Moved.mdx"],
          0,
          "T6.2-2 file-form `move specs/Core.mdx specs/sub/Moved.mdx`",
        );

        // Premises: the file was relocated; its own import specifier and the
        // other files' import paths were rewritten so everything resolves
        // (SPEC 6.5). Spellings are substring-checked only (byte exactness
        // is T6.5-1's business).
        const originKind = await workspace.kind(M2_CORE);
        if (originKind !== "absent") {
          fail(
            `T6.2-2: the origin file ${M2_CORE} must be gone after the ` +
              `file-form move (SPEC 6.5); found ${originKind}`,
          );
        }
        assertRewriteHappened(
          await readSourceText(workspace, M2_MOVED, "T6.2-2 rewrite premise"),
          M2_MOVED,
          '"./Other.xspec"',
          undefined,
          "T6.2-2 rewrite premise (the moved file's own import specifier)",
        );
        assertRewriteHappened(
          await readSourceText(workspace, M2_REFS, "T6.2-2 rewrite premise"),
          M2_REFS,
          '"./Core.xspec"',
          "Moved.xspec",
          "T6.2-2 rewrite premise (the referencing spec file's import)",
        );
        assertRewriteHappened(
          await readSourceText(workspace, M2_APP, "T6.2-2 rewrite premise"),
          M2_APP,
          '"../specs/Core.xspec"',
          "Moved.xspec",
          "T6.2-2 rewrite premise (the code file's import)",
        );

        const after = await sweepHashes(
          product,
          workspace,
          M2_POST_IDENTITIES,
          "T6.2-2 post-move sweep",
        );
        assertHashesPreserved(
          before,
          after,
          M2_IDENTITY_MAP,
          "the file form of `xspec move`",
          "T6.2-2",
        );

        const label = "T6.2-2 `impact --base <pre-move ref> --json`";
        assertPureImpact(
          await impactAgainst(product, workspace, base, label),
          "a journaled file-form `move`",
          label,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.2-3 — section move impurity
// ---------------------------------------------------------------------------

// Clean-boundary arm: the moved construct's opening and closing tags each
// stand alone on their lines and the descendant sits on interior lines, so no
// moved node has own-content bytes on the straddling lines (SPEC 6.2) — the
// tag-only lines are dropped at origin and destination alike (SPEC 3).
const C3_ORIGIN = "specs/Origin.mdx";
const C3_OP = "specs/Origin.mdx#origin";
const C3_MV_PRE = "specs/Origin.mdx#origin.mv";
const C3_KID_PRE = "specs/Origin.mdx#origin.mv.kid";
const C3_TARGET = "specs/Target.mdx";
const C3_TP = "specs/Target.mdx#tgt";
const C3_MV_POST = "specs/Target.mdx#tgt.mv";
const C3_KID_POST = "specs/Target.mdx#tgt.mv.kid";
const C3_WATCH = "specs/Watch.mdx";
const C3_W_TOP = "specs/Watch.mdx#watch";
const C3_W_ONORIGIN = "specs/Watch.mdx#watch.onorigin";
const C3_W_ONTARGET = "specs/Watch.mdx#watch.ontarget";

const C3_ORIGIN_SOURCE = [
  '<S id="origin">',
  "Origin holder text.",
  "",
  '<S id="origin.mv" coverage="none" tags="keep mv">',
  "Moved root text.",
  "",
  '<S id="origin.mv.kid">',
  "Moved kid text.",
  "</S>",
  "</S>",
  "</S>",
  "",
].join("\n");

const C3_TARGET_SOURCE = [
  '<S id="tgt">',
  "Target parent text.",
  "</S>",
  "",
].join("\n");

// One dependent of each parent: the ordinary upstream cascades, attributed
// per parent (SPEC 5.6).
const C3_WATCH_SOURCE = [
  'import Origin from "./Origin.xspec"',
  'import Target from "./Target.xspec"',
  "",
  '<S id="watch">',
  "Watch holder text.",
  "",
  '<S id="watch.onorigin" d={Origin.origin}>',
  "Depends on the origin parent.",
  "</S>",
  "",
  '<S id="watch.ontarget" d={Target.tgt}>',
  "Depends on the target parent.",
  "</S>",
  "</S>",
  "",
].join("\n");

// Impure-boundary arm (SPEC 6.2's worked case; T6.2-3's staging (a)): the
// moved section's opening tag is preceded on its origin line by non-whitespace
// (`Lead-in prose. `) and followed there by nothing but the terminator, and
// its closing tag is preceded on its line by two spaces and followed there by
// non-whitespace (` Trailing prose.`). Both boundary lines are kept at the
// origin (each retains content outside the construct), so the opening line's
// terminator and the closing line's two spaces — within-construct characters
// — contribute to the moved node's own content there: its own text is U+000A,
// `Impure line one.`, U+000A, `Impure line two.`, U+000A, two spaces. At the
// destination the moved text lands at a line's start followed by U+000A
// (SPEC 6.5), each tag alone on its line — a flow-position tag — and both
// boundary lines are dropped, left empty or whitespace-only purely by the
// removals (SPEC 3): its own text there is `Impure line one.`, U+000A,
// `Impure line two.`, U+000A. The shape derives at both sides (S-9): at the
// origin the opening tag, following non-whitespace, is a text-position tag,
// and `  </S> Trailing prose.` is a paragraph-continuation line — the flow
// attempt fails on the prose after the tag — closing the element within its
// paragraph (T3-3's staging constraint); the former staging, whose closing
// tag stood alone at a later line's start, left the in-line element unclosed
// under the grammar 14.20 fixes and is kept as a non-derivation in
// `test/self/s9-fixture-well-formedness.test.ts`.
const I3_ROOM = "specs/Room.mdx";
const I3_OP = "specs/Room.mdx#op";
const I3_IMP_PRE = "specs/Room.mdx#op.imp";
const I3_HALL = "specs/Hall.mdx";
const I3_TP = "specs/Hall.mdx#tp";
const I3_IMP_POST = "specs/Hall.mdx#tp.imp";
const I3_DEPS = "specs/Deps.mdx";
const I3_W_TOP = "specs/Deps.mdx#watch";
const I3_W_ONIMP = "specs/Deps.mdx#watch.onimp";

/** The impure origin, exported for the S-9 self-test (its exact staged bytes). */
export const I3_ROOM_SOURCE = [
  '<S id="op">',
  "Op holder text.",
  "",
  'Lead-in prose. <S id="op.imp" coverage="none" tags="edge imp">', // a text-position tag after non-whitespace
  "Impure line one.",
  "Impure line two.",
  "  </S> Trailing prose.", // two spaces, the closing tag, non-whitespace after it
  "</S>",
  "",
].join("\n");

const I3_HALL_SOURCE = ['<S id="tp">', "Hall parent text.", "</S>", ""].join(
  "\n",
);

// The two rewritten files as SPEC 6.5 fixes them — the premise of the hash
// reasoning above, exported for the S-9 self-test. Origin: the moved text (the
// construct's own characters, `<S id="op.imp" …>` through `</S>`) is deleted
// in place, joining `Lead-in prose. ` and ` Trailing prose.` into one line
// that is kept (neither empty nor whitespace-only); Room.mdx needs no import
// edit. Destination: the moved text, its `id` rewritten by prefix replacement
// to `tp.imp`, is inserted immediately before `tp`'s closing tag — an offset
// at the start of a line, so no terminator precedes it — followed by U+000A;
// Hall.mdx needs no import edit either, the moved text carrying no reference.
// Deps.mdx is not pinned: its rewritten `d` reference is rooted at an added
// import's fresh identifier, implementation latitude (SPEC 6.5).
export const I3_ROOM_MOVED_SOURCE = [
  '<S id="op">',
  "Op holder text.",
  "",
  "Lead-in prose.  Trailing prose.",
  "</S>",
  "",
].join("\n");
export const I3_HALL_MOVED_SOURCE = [
  '<S id="tp">',
  "Hall parent text.",
  '<S id="tp.imp" coverage="none" tags="edge imp">',
  "Impure line one.",
  "Impure line two.",
  "  </S>",
  "</S>",
  "",
].join("\n");

// A dependent of the moved node itself: its dependency edge is
// identity-mapped through the journal, so its `upstream-changed` — caused by
// the moved node's own-content change — is attributed exactly to the moved
// node: the unambiguous "5.6 cascades attributed to it".
const I3_DEPS_SOURCE = [
  'import Room from "./Room.xspec"',
  "",
  '<S id="watch">',
  "Dependents holder text.",
  "",
  '<S id="watch.onimp" d={Room.op.imp}>',
  "Depends on the impure moved node.",
  "</S>",
  "</S>",
  "",
].join("\n");

/** The three hashes T6.2-3 pins for every node of a moved subtree. */
function assertKeptSectionMoveHashes(
  before: NodeHashes,
  after: NodeHashes,
  pre: string,
  post: string,
  context: string,
): void {
  for (const key of ["ownHash", "subtreeHash", "metadataHash"] as const) {
    assertSameJson(
      after[key],
      before[key],
      `${context}: ${pre} (now ${post}) must keep its ${key} across the ` +
        `section-form move — the identity mapping changes no hash, and with ` +
        `no own-content bytes on the construct's straddling lines the moved ` +
        `text reads identically at origin and destination (SPEC 6.2, 5.4)`,
    );
  }
}

// ---------------------------------------------------------------------------
// T6.2-3's three impure stagings, each moved to top level and into a
// flow-position parent (the shape × destination matrix)
// ---------------------------------------------------------------------------

// U+000B and U+000C, built from code points (never escape spellings).
const VT = String.fromCodePoint(0x000b);
const FF = String.fromCodePoint(0x000c);

/**
 * One of T6.2-3's three impure stagings, spelled exactly as the entry does:
 * the origin file's top level holds `foo <S id="m">` + `body` + `</S>` +
 * `afterClose`, U+000A — the file root is the origin parent — and the moved
 * text `<S id="…">` + `body` + `</S>` lands at the destination's line start
 * followed by U+000A (SPEC 6.5). The own texts are hand-derived from SPEC
 * 3's drop rule as each shape's comment spells; they are the runs of the S-6
 * vectors (test/self/s6-section-move-oracle.test.ts), which also prove that
 * every composition before and after derives (S-9), as the builder's staging
 * check does for the origin and target files again here.
 */
interface ImpureShape {
  readonly tag: string;
  readonly label: string;
  /** The moved section's body: the bytes between its tags. */
  readonly body: string;
  /** What follows the closing tag on its origin line. */
  readonly afterClose: string;
  /** The origin file after the deletion — also the origin root's one run. */
  readonly originAfter: string;
  /** The moved node's own text at the origin (SPEC 1.6). */
  readonly ownBefore: string;
  /** The moved node's own text at the destination. */
  readonly ownAfter: string;
  /** Why the two differ, for the diagnosed messages. */
  readonly reason: string;
}

const M3_SHAPES: readonly ImpureShape[] = [
  {
    // (a) `foo <S id="m">`, U+000A, `body`, U+000A, two spaces, `</S> bar`:
    // at the origin both boundary lines are kept (`foo` and `bar` lie
    // outside the construct), so the opening line's terminator and the
    // closing line's two spaces — within-construct characters — contribute
    // to the node; at the destination each tag is alone on its line, a
    // flow-position tag, and both lines — `<S id="…">` and `  </S>` — are
    // left empty or whitespace-only purely by the removals and drop with
    // their terminators (SPEC 3): the node keeps `body`, U+000A alone.
    tag: "(a)",
    label: "the worked shape with two spaces before its closing tag",
    body: "\nbody\n  ",
    afterClose: " bar",
    originAfter: "foo  bar\n",
    ownBefore: "\nbody\n  ",
    ownAfter: "body\n",
    reason:
      "the opening line's terminator and the closing line's two spaces " +
      "contribute at the origin, where both boundary lines are kept, and " +
      "not at the destination, where each tag stands alone on its line and " +
      "both lines drop (SPEC 6.2's worked case, 3)",
  },
  ...(
    [
      ["U+000B", VT],
      ["U+000C", FF],
    ] as const
  ).map(([name, ws]): ImpureShape => ({
    // (b) `foo <S id="m">`, ws, U+000A, `body`, U+000A, ws, `</S> bar`:
    // whitespace under SPEC 1.4, so both destination lines are left
    // whitespace-only by the removals and drop with their terminators,
    // but no whitespace to the MDX grammar, so both tags stay in text
    // position there, the section closing within its paragraph (SPEC 6.2).
    tag: "(b)",
    label: `the both-sided ${name} spelling`,
    body: `${ws}\nbody\n${ws}`,
    afterClose: " bar",
    originAfter: "foo  bar\n",
    ownBefore: `${ws}\nbody\n${ws}`,
    ownAfter: "body\n",
    reason:
      `the ${name} after the opening tag with that line's terminator, ` +
      `and the ${name} before the closing tag, contribute at the origin, ` +
      `where both boundary lines are kept, and not at the destination, ` +
      `where both lines are whitespace-only under SPEC 1.4 purely by the ` +
      `removals and drop (SPEC 6.2, 3)`,
  })),
  ...(
    [
      ["U+000B", VT],
      ["U+000C", FF],
    ] as const
  ).map(([name, ws]): ImpureShape => ({
    // (c) `foo <S id="m">`, ws, U+000A, `body</S>`: an in-line section
    // closed within its paragraph (T3-3's constraint), whose difference
    // is realized on the opening line alone — the destination line
    // `<S id="…">`, ws is whitespace-only purely by the removal and
    // drops, the tag staying an in-line tag there too; `body</S>` is kept
    // at both sides, its terminator outside the construct.
    tag: "(c)",
    label: `the body</S> variant with a ${name} remainder`,
    body: `${ws}\nbody`,
    afterClose: "",
    originAfter: "foo \n",
    ownBefore: `${ws}\nbody`,
    ownAfter: "body",
    reason:
      `the ${name} after the opening tag and that line's terminator ` +
      `contribute at the origin, where the line is kept by \`foo\`, and ` +
      `not at the destination, where the line is whitespace-only under ` +
      `SPEC 1.4 purely by the removal and drops — the difference realized ` +
      `on the opening line alone (SPEC 6.2, 3)`,
  })),
];

/** A destination T6.2-3 stages each impure shape into. */
interface ImpureDestination {
  readonly name: string;
  /** The staged target file. */
  readonly source: string;
  /** The `move` operand's ID part — the new identity by prefix replacement. */
  readonly newId: string;
  readonly parent: string;
  readonly moved: string;
  /** The target file as SPEC 6.5 fixes it around the moved text. */
  readonly compose: (movedText: string) => string;
  /** The target file's rows of the category table (module header, H-4). */
  readonly rows: (changed: readonly string[]) => readonly ExpectedNodeImpact[];
}

const M3_ORIGIN = "specs/ca.mdx";
const M3_MV_PRE = "specs/ca.mdx#m";
const M3_TARGET = "specs/cb.mdx";
const M3_K = "specs/cb.mdx#k";
const M3_TOP_POST = "specs/cb.mdx#m";
const M3_P = "specs/cb.mdx#p";
const M3_FLOW_POST = "specs/cb.mdx#p.m";
const M3_DEPS = "specs/Deps.mdx";
const M3_W_TOP = "specs/Deps.mdx#watch";
const M3_W_ONM = "specs/Deps.mdx#watch.onm";

// A dependent of the moved node: the sharp "5.6 cascades attributed to it"
// (as the I3 arm's Deps.mdx). Not byte-pinned after the move — its rewritten
// `d` reference is rooted at an added import's fresh identifier (SPEC 6.5).
const M3_DEPS_SOURCE = [
  'import Ca from "./ca.xspec"',
  "",
  '<S id="watch">',
  "Dependents holder text.",
  "",
  '<S id="watch.onm" d={Ca.m}>',
  "Depends on the impure moved node.",
  "</S>",
  "</S>",
  "",
].join("\n");

const M3_DESTINATIONS: readonly ImpureDestination[] = [
  {
    // `<S id="k">z</S>`, U+000A — a file ending with a terminator, so the
    // insertion point, its end, is a line start (SPEC 6.5); the target root
    // is the parent, `changed` by the gained child reference.
    name: "another file's top level",
    source: '<S id="k">z</S>\n',
    newId: "m",
    parent: M3_TARGET,
    moved: M3_TOP_POST,
    compose: (movedText) => `<S id="k">z</S>\n${movedText}\n`,
    rows: (changed) => [
      {
        identity: M3_TARGET,
        categories: [
          { category: "changed", within: changed },
          {
            category: "descendant-changed",
            within: [M3_TOP_POST],
            optional: true,
          },
        ],
      },
      { identity: M3_K, categories: [] },
      {
        identity: M3_TOP_POST,
        categories: [{ category: "changed", within: changed }],
      },
    ],
  },
  {
    // `<S id="p">`, U+000A, `x`, U+000A, `</S>`, U+000A — a flow-position
    // parent, its tags alone on their lines, the insertion point before its
    // closing tag a line start; `p`'s tag-only lines drop at both sides
    // (SPEC 3), so the root keeps its own content and is
    // `descendant-changed` through `p` alone (the moved node may join the
    // attribution — the two-sided ambiguity).
    name: "a flow-position parent",
    source: '<S id="p">\nx\n</S>\n',
    newId: "p.m",
    parent: M3_P,
    moved: M3_FLOW_POST,
    compose: (movedText) => `<S id="p">\nx\n${movedText}\n</S>\n`,
    rows: (changed) => [
      {
        identity: M3_TARGET,
        categories: [
          {
            category: "descendant-changed",
            within: [M3_P, M3_FLOW_POST],
            mustInclude: [M3_P],
          },
        ],
      },
      {
        identity: M3_P,
        categories: [
          { category: "changed", within: changed },
          {
            category: "descendant-changed",
            within: [M3_FLOW_POST],
            optional: true,
          },
        ],
      },
      {
        identity: M3_FLOW_POST,
        categories: [{ category: "changed", within: changed }],
      },
    ],
  },
];

/** One cell of the matrix: stage, build, move, and assert everything pinned. */
async function runImpureStaging(
  product: ProductBinding,
  shape: ImpureShape,
  destination: ImpureDestination,
): Promise<void> {
  const context = `T6.2-3 impure staging ${shape.tag}, ${shape.label}, into ${destination.name}`;
  const originSource = `foo <S id="m">${shape.body}</S>${shape.afterClose}\n`;
  const movedText = `<S id="${destination.newId}">${shape.body}</S>`;
  const newIdentity = `${M3_TARGET}#${destination.newId}`;
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    {
      [M3_ORIGIN]: originSource,
      [M3_TARGET]: destination.source,
      [M3_DEPS]: M3_DEPS_SOURCE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("pre-move baseline");
      await buildOk(product, workspace, `${context}: \`build\``);

      const before = await queryNode(
        product,
        workspace,
        M3_MV_PRE,
        `${context} pre-move`,
      );
      assertBytesEqual(
        before.ownText,
        shape.ownBefore,
        `${context}: the moved node's own text at the origin — ${shape.reason}; ` +
          `SPEC 1.6: exact bytes, the runs joined at the excision points`,
      );

      await expectExit(
        product,
        workspace,
        ["move", M3_MV_PRE, newIdentity],
        0,
        `${context}: \`move ${M3_MV_PRE} ${newIdentity}\``,
      );

      // Premise of the hash reasoning: the two rewritten files hold exactly
      // the bytes SPEC 6.5 fixes.
      await assertFileBytes(
        workspace.path(M3_ORIGIN),
        shape.originAfter,
        `${context}: ${M3_ORIGIN} after the move — the moved text deleted in ` +
          `place, the remainder of its boundary line kept (SPEC 6.5, 3)`,
      );
      await assertFileBytes(
        workspace.path(M3_TARGET),
        destination.compose(movedText),
        `${context}: ${M3_TARGET} after the move — the moved text, its \`id\` ` +
          `rewritten by prefix replacement, inserted at a line start and ` +
          `followed by U+000A (SPEC 6.5)`,
      );

      const after = await queryNode(
        product,
        workspace,
        destination.moved,
        `${context} post-move`,
      );
      assertBytesEqual(
        after.ownText,
        shape.ownAfter,
        `${context}: the moved node's own text at the destination — ` +
          `${shape.reason}; SPEC 1.6: exact bytes`,
      );
      assertSameJson(
        after.hashes.metadataHash,
        before.hashes.metadataHash,
        `${context}: the moved node's metadataHash is kept unconditionally ` +
          `(SPEC 6.2, 5.5)`,
      );
      if (after.hashes.ownHash === before.hashes.ownHash) {
        fail(
          `${context}: the moved node's ownHash must change — ${shape.reason}; ` +
            `both sides report ownHash ${JSON.stringify(after.hashes.ownHash)}`,
        );
      }

      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${context} \`check --json\` after the move — clean: every rewritten ` +
          `composition derives (SPEC 6.5 refuses a move whose rewritten files ` +
          `would not be well-formed; S-9) and the rewritten reference resolves`,
      );

      const label = `${context}: \`impact --base <pre-move ref> --json\``;
      const changed = [M3_ORIGIN, destination.parent, destination.moved];
      assertImpactTable(
        await impactAgainst(product, workspace, base, label),
        [
          // The origin parent — the file root — `changed`, its departed
          // child's change tolerated in its attribution (two-sided ambiguity).
          {
            identity: M3_ORIGIN,
            categories: [
              { category: "changed", within: changed },
              {
                category: "descendant-changed",
                within: [destination.moved],
                optional: true,
              },
            ],
          },
          ...destination.rows(changed),
          // The dependent of the moved node: the unambiguous 5.6 cascade
          // attributed to it, and no other node `changed`.
          {
            identity: M3_W_ONM,
            categories: [
              { category: "upstream-changed", exact: [destination.moved] },
            ],
          },
          {
            identity: M3_W_TOP,
            categories: [
              { category: "upstream-changed", exact: [destination.moved] },
            ],
          },
          {
            identity: M3_DEPS,
            categories: [
              { category: "upstream-changed", exact: [destination.moved] },
            ],
          },
        ],
        label,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T6.2-3's sibling stagings: 6.2's "any sibling with bytes there alike"
// ---------------------------------------------------------------------------

// (d) at the origin: a flow-position parent whose second line is a paragraph
// of two in-line siblings, `p.m` moved to another file's top level. The
// deletion leaves `<S id="p.s"> </S>` alone on its line, and the drop rule of
// SPEC 3 decides that line differently — kept before (`text` remaining once
// the tags are removed), dropped after (whitespace-only purely by removals) —
// so `p.s` loses its run ` `, while the moved node's `text` rides a kept line
// at both sides. A dependent of `p.s` realizes "the 5.6 cascades attributed
// to it" sharply; the moved subtree has no dependency edges, so the table
// bounds its effectiveHash as in the clean arm.
const D3_A = "specs/a.mdx";
const D3_P = "specs/a.mdx#p";
const D3_PS = "specs/a.mdx#p.s";
const D3_PM = "specs/a.mdx#p.m";
const D3_B = "specs/b.mdx";
const D3_K = "specs/b.mdx#k";
const D3_M = "specs/b.mdx#m";
const D3_DEPS = "specs/Deps.mdx";
const D3_W_TOP = "specs/Deps.mdx#watch";
const D3_W_ONS = "specs/Deps.mdx#watch.ons";

const D3_A_SOURCE = '<S id="p">\n<S id="p.s"> </S><S id="p.m">text</S>\n</S>\n';
const D3_A_MOVED = '<S id="p">\n<S id="p.s"> </S>\n</S>\n';
const D3_B_SOURCE = '<S id="k">z</S>\n';
const D3_B_MOVED = '<S id="k">z</S>\n<S id="m">text</S>\n';
const D3_DEPS_SOURCE = [
  'import A from "./a.xspec"',
  "",
  '<S id="watch">',
  "Dependents holder text.",
  "",
  '<S id="watch.ons" d={A.p.s}>',
  "Depends on the sibling left alone on its line.",
  "</S>",
  "</S>",
  "",
].join("\n");

// (e) at the destination: a text-position target parent `foo <S id="p">`,
// U+000A, `<S id="p.s">`, U+000C, `</S></S> tail`, U+000A receives
// `<S id="m">text</S>` (alone on its origin line) into `p.n`. The insertion
// point, preceded by `p.s`'s closing tag, is not at a line start, so 6.5's
// added terminator splits the line, leaving `<S id="p.s">`, U+000C, `</S>`
// alone on its line — kept in text position by the U+000C, no whitespace to
// the grammar (SPEC 6.2), and dropped as whitespace-only under SPEC 1.4 — so
// `p.s` loses its run, while `foo ` and ` tail` ride kept lines at both
// sides: the target root keeps its own content.
const E3_A = "specs/ea.mdx";
const E3_AA = "specs/ea.mdx#a";
const E3_M_PRE = "specs/ea.mdx#m";
const E3_B = "specs/eb.mdx";
const E3_P = "specs/eb.mdx#p";
const E3_PS = "specs/eb.mdx#p.s";
const E3_PN = "specs/eb.mdx#p.n";
const E3_DEPS = "specs/Deps.mdx";
const E3_W_TOP = "specs/Deps.mdx#watch";
const E3_W_ONS = "specs/Deps.mdx#watch.ons";

const E3_A_SOURCE = '<S id="a">x</S>\n<S id="m">text</S>\n';
const E3_A_MOVED = '<S id="a">x</S>\n';
const E3_B_SOURCE = `foo <S id="p">\n<S id="p.s">${FF}</S></S> tail\n`;
const E3_B_MOVED = `foo <S id="p">\n<S id="p.s">${FF}</S>\n<S id="p.n">text</S>\n</S> tail\n`;
const E3_DEPS_SOURCE = [
  'import Eb from "./eb.xspec"',
  "",
  '<S id="watch">',
  "Dependents holder text.",
  "",
  '<S id="watch.ons" d={Eb.p.s}>',
  "Depends on the sibling left alone on its line.",
  "</S>",
  "</S>",
  "",
].join("\n");

/** The sibling's pinned outcome: its one run gone, so its ownHash changes. */
function assertSiblingRunGone(
  before: NodeReport,
  after: NodeReport,
  runBefore: string,
  identity: string,
  context: string,
): void {
  assertBytesEqual(
    before.ownText,
    runBefore,
    `${context}: ${identity}'s own text before the move — its one run, on a ` +
      `line the drop rule of SPEC 3 keeps (SPEC 1.6: exact bytes)`,
  );
  assertBytesEqual(
    after.ownText,
    "",
    `${context}: ${identity}'s own text after the move — its run gone: left ` +
      `alone on its line, whitespace-only purely by removals, the line drops ` +
      `with its terminator (SPEC 3, 1.4; 6.2's sibling with bytes there)`,
  );
  if (after.hashes.ownHash === before.hashes.ownHash) {
    fail(
      `${context}: ${identity}'s ownHash must change — its own content ` +
        `sequence lost the run ${JSON.stringify(runBefore)} (SPEC 6.2, 5.5); ` +
        `both sides report ownHash ${JSON.stringify(after.hashes.ownHash)}`,
    );
  }
}

/** Staging (d): the sibling residue left alone on the deletion's merged line. */
async function runSiblingOriginStaging(product: ProductBinding): Promise<void> {
  const context = "T6.2-3 sibling staging (d), at the origin";
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    {
      [D3_A]: D3_A_SOURCE,
      [D3_B]: D3_B_SOURCE,
      [D3_DEPS]: D3_DEPS_SOURCE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("pre-move baseline");
      await buildOk(product, workspace, `${context}: \`build\``);

      const siblingBefore = await queryNode(
        product,
        workspace,
        D3_PS,
        `${context} pre-move`,
      );
      const movedBefore = await queryNode(
        product,
        workspace,
        D3_PM,
        `${context} pre-move`,
      );

      await expectExit(
        product,
        workspace,
        ["move", D3_PM, D3_M],
        0,
        `${context}: \`move ${D3_PM} ${D3_M}\``,
      );

      await assertFileBytes(
        workspace.path(D3_A),
        D3_A_MOVED,
        `${context}: ${D3_A} after the move — the moved text deleted in ` +
          `place, \`<S id="p.s"> </S>\` left alone on its line (SPEC 6.5)`,
      );
      await assertFileBytes(
        workspace.path(D3_B),
        D3_B_MOVED,
        `${context}: ${D3_B} after the move — the moved text on a line of ` +
          `its own at the file's end, followed by U+000A (SPEC 6.5)`,
      );

      const siblingAfter = await queryNode(
        product,
        workspace,
        D3_PS,
        `${context} post-move`,
      );
      const movedAfter = await queryNode(
        product,
        workspace,
        D3_M,
        `${context} post-move`,
      );
      assertSiblingRunGone(siblingBefore, siblingAfter, " ", D3_PS, context);
      for (const [report, side] of [
        [movedBefore, "before"],
        [movedAfter, "after"],
      ] as const) {
        assertBytesEqual(
          report.ownText,
          "text",
          `${context}: the moved node's own text ${side} the move — its ` +
            `bytes \`text\` on a kept line at both sides (SPEC 1.6, 3)`,
        );
      }
      assertKeptSectionMoveHashes(
        movedBefore.hashes,
        movedAfter.hashes,
        D3_PM,
        D3_M,
        context,
      );

      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${context} \`check --json\` after the move — clean: every rewritten ` +
          `composition derives (SPEC 6.5; S-9)`,
      );

      const label = `${context}: \`impact --base <pre-move ref> --json\``;
      const changed = [D3_P, D3_PS, D3_B];
      assertImpactTable(
        await impactAgainst(product, workspace, base, label),
        [
          // The sibling: `changed` by its dropped line — 6.2's enumeration
          // beyond the parents and the moved subtree.
          {
            identity: D3_PS,
            categories: [{ category: "changed", within: changed }],
          },
          // The parents; `p`'s changed sibling child is present on both
          // sides, so its descendant-changed is required and exact.
          {
            identity: D3_P,
            categories: [
              { category: "changed", within: changed },
              { category: "descendant-changed", exact: [D3_PS] },
            ],
          },
          {
            identity: D3_B,
            categories: [{ category: "changed", within: changed }],
          },
          {
            identity: D3_A,
            categories: [
              { category: "descendant-changed", exact: [D3_P, D3_PS] },
            ],
          },
          // The moved node keeps its hashes and carries no category; the
          // untouched sibling of the target likewise.
          { identity: D3_M, categories: [] },
          { identity: D3_K, categories: [] },
          // The 5.6 cascade of the sibling's change, attributed to it.
          {
            identity: D3_W_ONS,
            categories: [{ category: "upstream-changed", exact: [D3_PS] }],
          },
          {
            identity: D3_W_TOP,
            categories: [{ category: "upstream-changed", exact: [D3_PS] }],
          },
          {
            identity: D3_DEPS,
            categories: [{ category: "upstream-changed", exact: [D3_PS] }],
          },
        ],
        label,
      );
    },
  );
}

/** Staging (e): the sibling residue left alone on the line the insertion splits. */
async function runSiblingDestinationStaging(
  product: ProductBinding,
): Promise<void> {
  const context = "T6.2-3 sibling staging (e), at the destination";
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    {
      [E3_A]: E3_A_SOURCE,
      [E3_B]: E3_B_SOURCE,
      [E3_DEPS]: E3_DEPS_SOURCE,
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("pre-move baseline");
      await buildOk(product, workspace, `${context}: \`build\``);

      const siblingBefore = await queryNode(
        product,
        workspace,
        E3_PS,
        `${context} pre-move`,
      );
      const rootBefore = await queryNode(
        product,
        workspace,
        E3_B,
        `${context} pre-move`,
      );
      const movedBefore = await queryNode(
        product,
        workspace,
        E3_M_PRE,
        `${context} pre-move`,
      );

      await expectExit(
        product,
        workspace,
        ["move", E3_M_PRE, E3_PN],
        0,
        `${context}: \`move ${E3_M_PRE} ${E3_PN}\``,
      );

      await assertFileBytes(
        workspace.path(E3_A),
        E3_A_MOVED,
        `${context}: ${E3_A} after the move — the moved text's line deleted ` +
          `whole (SPEC 6.5, 3)`,
      );
      await assertFileBytes(
        workspace.path(E3_B),
        E3_B_MOVED,
        `${context}: ${E3_B} after the move — the insertion before \`p\`'s ` +
          `closing tag, not at a line start, preceded by an added terminator ` +
          `that splits the line and followed by U+000A (SPEC 6.5)`,
      );

      const siblingAfter = await queryNode(
        product,
        workspace,
        E3_PS,
        `${context} post-move`,
      );
      const rootAfter = await queryNode(
        product,
        workspace,
        E3_B,
        `${context} post-move`,
      );
      const movedAfter = await queryNode(
        product,
        workspace,
        E3_PN,
        `${context} post-move`,
      );
      assertSiblingRunGone(siblingBefore, siblingAfter, FF, E3_PS, context);
      for (const [report, side] of [
        [rootBefore, "before"],
        [rootAfter, "after"],
      ] as const) {
        assertBytesEqual(
          report.ownText,
          "foo  tail\n",
          `${context}: the target root's own text ${side} the move — ` +
            `\`foo \` and \` tail\`, U+000A on kept lines at both sides, joined ` +
            `at \`p\`'s excision point (SPEC 1.6, 3)`,
        );
      }
      assertSameJson(
        rootAfter.hashes.ownHash,
        rootBefore.hashes.ownHash,
        `${context}: the target root keeps its ownHash — its own content is ` +
          `unchanged by the split line (SPEC 6.2)`,
      );
      for (const [report, side] of [
        [movedBefore, "before"],
        [movedAfter, "after"],
      ] as const) {
        assertBytesEqual(
          report.ownText,
          "text",
          `${context}: the moved node's own text ${side} the move — alone on ` +
            `its line at both sides (SPEC 1.6, 3)`,
        );
      }
      assertKeptSectionMoveHashes(
        movedBefore.hashes,
        movedAfter.hashes,
        E3_M_PRE,
        E3_PN,
        context,
      );

      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${context} \`check --json\` after the move — clean: every rewritten ` +
          `composition derives (SPEC 6.5; S-9)`,
      );

      const label = `${context}: \`impact --base <pre-move ref> --json\``;
      const changed = [E3_A, E3_P, E3_PS];
      assertImpactTable(
        await impactAgainst(product, workspace, base, label),
        [
          {
            identity: E3_PS,
            categories: [{ category: "changed", within: changed }],
          },
          {
            identity: E3_P,
            categories: [
              { category: "changed", within: changed },
              { category: "descendant-changed", exact: [E3_PS] },
            ],
          },
          // The origin parent is the file root; the target root keeps its
          // own content and cascades only.
          {
            identity: E3_A,
            categories: [{ category: "changed", within: changed }],
          },
          {
            identity: E3_B,
            categories: [
              { category: "descendant-changed", exact: [E3_P, E3_PS] },
            ],
          },
          { identity: E3_AA, categories: [] },
          { identity: E3_PN, categories: [] },
          {
            identity: E3_W_ONS,
            categories: [{ category: "upstream-changed", exact: [E3_PS] }],
          },
          {
            identity: E3_W_TOP,
            categories: [{ category: "upstream-changed", exact: [E3_PS] }],
          },
          {
            identity: E3_DEPS,
            categories: [{ category: "upstream-changed", exact: [E3_PS] }],
          },
        ],
        label,
      );
    },
  );
}

const T6_2_3 = defineProductTest({
  id: "T6.2-3",
  // Fourteen stagings (~90 CLI invocations, ~22 s alone): headroom for a
  // saturated box.
  timeoutMs: 240_000,
  title:
    "section move impurity: on a clean-boundary fixture every moved node keeps ownHash, subtreeHash, and metadataHash, the origin and target parents are each `changed` with ordinary cascades attributed to them, and no other node is `changed`; a moved section with an impure origin boundary (SPEC 6.2's worked case) is itself additionally `changed` with the 5.6 cascades attributed to it, its metadataHash still unchanged — in each of the three impure stagings (the worked shape with spaces before its closing tag, the both-sided U+000B/U+000C spelling, the `body</S>` variant with such a remainder), moved to top level and into a flow-position parent alike, the bytes named gone from its own text at the destination; and a sibling with bytes on the deletion's merged line or on the line the insertion splits is `changed` exactly when the drop rule of 3 decides that line differently, the moved node keeping its hashes and carrying no category (SPEC 6.2, 3, 1.4, 5.6, 6.5)",
  run: async (product) => {
    // --- Clean-boundary arm ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [C3_ORIGIN]: C3_ORIGIN_SOURCE,
        [C3_TARGET]: C3_TARGET_SOURCE,
        [C3_WATCH]: C3_WATCH_SOURCE,
      },
      async (workspace) => {
        const context = "T6.2-3 clean-boundary arm";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("pre-move baseline");
        await buildOk(product, workspace, `${context}: \`build\``);

        const mvBefore = await queryNode(
          product,
          workspace,
          C3_MV_PRE,
          `${context} pre-move`,
        );
        const kidBefore = await queryNode(
          product,
          workspace,
          C3_KID_PRE,
          `${context} pre-move`,
        );

        await expectExit(
          product,
          workspace,
          ["move", "specs/Origin.mdx#origin.mv", "specs/Target.mdx#tgt.mv"],
          0,
          `${context}: \`move specs/Origin.mdx#origin.mv specs/Target.mdx#tgt.mv\``,
        );

        const mvAfter = await queryNode(
          product,
          workspace,
          C3_MV_POST,
          `${context} post-move`,
        );
        const kidAfter = await queryNode(
          product,
          workspace,
          C3_KID_POST,
          `${context} post-move`,
        );
        assertKeptSectionMoveHashes(
          mvBefore.hashes,
          mvAfter.hashes,
          C3_MV_PRE,
          C3_MV_POST,
          context,
        );
        assertKeptSectionMoveHashes(
          kidBefore.hashes,
          kidAfter.hashes,
          C3_KID_PRE,
          C3_KID_POST,
          context,
        );

        const label = `${context}: \`impact --base <pre-move ref> --json\``;
        assertImpactTable(
          await impactAgainst(product, workspace, base, label),
          [
            // The two originating nodes: each parent's own content changed —
            // one lost a child reference, the other gained one (SPEC 6.2).
            {
              identity: C3_OP,
              categories: [{ category: "changed", within: [C3_OP, C3_TP] }],
            },
            {
              identity: C3_TP,
              categories: [{ category: "changed", within: [C3_OP, C3_TP] }],
            },
            // The moved subtree: hashes kept, identity mapped — no category.
            { identity: C3_MV_POST, categories: [] },
            { identity: C3_KID_POST, categories: [] },
            // Ordinary cascades, attributed per parent: the file roots'
            // descendant-changed…
            {
              identity: C3_ORIGIN,
              categories: [{ category: "descendant-changed", exact: [C3_OP] }],
            },
            {
              identity: C3_TARGET,
              categories: [{ category: "descendant-changed", exact: [C3_TP] }],
            },
            // …and the dependents' upstream-changed, meeting at their shared
            // ancestors with merged attribution (SPEC 5.6).
            {
              identity: C3_W_ONORIGIN,
              categories: [{ category: "upstream-changed", exact: [C3_OP] }],
            },
            {
              identity: C3_W_ONTARGET,
              categories: [{ category: "upstream-changed", exact: [C3_TP] }],
            },
            {
              identity: C3_W_TOP,
              categories: [
                { category: "upstream-changed", exact: [C3_OP, C3_TP] },
              ],
            },
            {
              identity: C3_WATCH,
              categories: [
                { category: "upstream-changed", exact: [C3_OP, C3_TP] },
              ],
            },
          ],
          label,
        );
      },
    );

    // --- Impure-boundary arm (SPEC 6.2's worked case) ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [I3_ROOM]: I3_ROOM_SOURCE,
        [I3_HALL]: I3_HALL_SOURCE,
        [I3_DEPS]: I3_DEPS_SOURCE,
      },
      async (workspace) => {
        const context = "T6.2-3 impure-boundary arm";
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("pre-move baseline");
        await buildOk(product, workspace, `${context}: \`build\``);

        const impBefore = await queryNode(
          product,
          workspace,
          I3_IMP_PRE,
          `${context} pre-move`,
        );

        await expectExit(
          product,
          workspace,
          ["move", "specs/Room.mdx#op.imp", "specs/Hall.mdx#tp.imp"],
          0,
          `${context}: \`move specs/Room.mdx#op.imp specs/Hall.mdx#tp.imp\``,
        );

        // Premise of the hash reasoning: the two rewritten files hold exactly
        // the bytes SPEC 6.5 fixes — the origin's boundary lines joined into
        // one kept line, the moved text at the destination's line start
        // followed by U+000A with each tag alone on its line.
        await assertFileBytes(
          workspace.path(I3_ROOM),
          I3_ROOM_MOVED_SOURCE,
          `${context}: specs/Room.mdx after the move — the moved text deleted ` +
            `in place, the joined boundary line kept (SPEC 6.5, 3)`,
        );
        await assertFileBytes(
          workspace.path(I3_HALL),
          I3_HALL_MOVED_SOURCE,
          `${context}: specs/Hall.mdx after the move — the moved text, its ` +
            `\`id\` rewritten, inserted before the parent's closing tag at a ` +
            `line start and followed by U+000A (SPEC 6.5)`,
        );

        const impAfter = await queryNode(
          product,
          workspace,
          I3_IMP_POST,
          `${context} post-move`,
        );
        assertSameJson(
          impAfter.hashes.metadataHash,
          impBefore.hashes.metadataHash,
          `${context}: the moved node's metadataHash is kept unconditionally — ` +
            `its \`coverage\`, tags, and (absent) \`d\` targets are untouched ` +
            `by the move (SPEC 6.2, 5.5)`,
        );
        if (impAfter.hashes.ownHash === impBefore.hashes.ownHash) {
          fail(
            `${context}: the moved node's ownHash must change — at the origin ` +
              `both boundary lines are kept (the opening tag preceded by ` +
              `non-whitespace, the closing tag followed by it), so the opening ` +
              `line's terminator and the closing line's two spaces contribute ` +
              `to its own content, while at the destination each tag stands ` +
              `alone on its line and both lines are dropped (SPEC 6.2's worked ` +
              `case, 3); both sides report ownHash ` +
              `${JSON.stringify(impAfter.hashes.ownHash)}`,
          );
        }

        const label = `${context}: \`impact --base <pre-move ref> --json\``;
        const originators = [I3_OP, I3_TP, I3_IMP_POST];
        assertImpactTable(
          await impactAgainst(product, workspace, base, label),
          [
            // The moved node itself is additionally `changed` (SPEC 6.2's
            // worked case) — and nothing else: metadataHash unchanged (no
            // metadata-changed), no descendants (no descendant-changed), no
            // dependency edges (no upstream-changed).
            {
              identity: I3_IMP_POST,
              categories: [{ category: "changed", within: originators }],
            },
            // The parents, as in the clean arm; whether the departed/arrived
            // changed child additionally gives them descendant-changed is the
            // documented two-sided ambiguity — tolerated only when attributed
            // to the moved node (module header, H-4).
            {
              identity: I3_OP,
              categories: [
                { category: "changed", within: originators },
                {
                  category: "descendant-changed",
                  within: [I3_IMP_POST],
                  optional: true,
                },
              ],
            },
            {
              identity: I3_TP,
              categories: [
                { category: "changed", within: originators },
                {
                  category: "descendant-changed",
                  within: [I3_IMP_POST],
                  optional: true,
                },
              ],
            },
            // The file roots: descendant-changed through their changed parent
            // (present on both sides); the moved node may join the
            // attribution (same ambiguity).
            {
              identity: I3_ROOM,
              categories: [
                {
                  category: "descendant-changed",
                  within: [I3_OP, I3_IMP_POST],
                  mustInclude: [I3_OP],
                },
              ],
            },
            {
              identity: I3_HALL,
              categories: [
                {
                  category: "descendant-changed",
                  within: [I3_TP, I3_IMP_POST],
                  mustInclude: [I3_TP],
                },
              ],
            },
            // The dependent of the moved node: the unambiguous 5.6 cascade
            // attributed to it — the dependency edge is identity-mapped, and
            // the target's effectiveHash changed through its own edit.
            {
              identity: I3_W_ONIMP,
              categories: [
                { category: "upstream-changed", exact: [I3_IMP_POST] },
              ],
            },
            {
              identity: I3_W_TOP,
              categories: [
                { category: "upstream-changed", exact: [I3_IMP_POST] },
              ],
            },
            {
              identity: I3_DEPS,
              categories: [
                { category: "upstream-changed", exact: [I3_IMP_POST] },
              ],
            },
          ],
          label,
        );
      },
    );

    // --- The three impure stagings (a)–(c), each at both destinations ---
    for (const shape of M3_SHAPES) {
      for (const destination of M3_DESTINATIONS) {
        await runImpureStaging(product, shape, destination);
      }
    }

    // --- The sibling stagings (d) and (e) ---
    await runSiblingOriginStaging(product);
    await runSiblingDestinationStaging(product);
  },
});

// ---------------------------------------------------------------------------
// T6.2-4 — same-parent final-position move: the two pinned pure shapes and
// the `changed` twin
// ---------------------------------------------------------------------------

// Moving a parent's last child onto itself (same parent, same final position,
// new ID) is pure in effect exactly when the re-insertion reproduces the
// parent's own content sequence byte for byte — SPEC 6.2's `may`, which the
// fixture's shape decides, not the operation. TEST-SPEC pins two shapes whose
// re-insertion does (a harness deriving them from an arbitrary last child,
// whose closing tag may share a kept line with the parent's, fails):
//
// (1) a flow-form last child, its opening and closing tags alone on their
//     lines, the parent's closing tag alone on the following line: the
//     deletion removes exactly the construct's lines (the joined line it
//     leaves empty dropping with line 4's terminator, SPEC 6.5, 3), leaving
//     `<S id="p">`, U+000A, `</S>`, U+000A, and the insertion before that
//     `</S>`, at a line start (no terminator added), restores them — the
//     composed file byte-identical to the original but for the `id`
//     attribute;
// (2) T6.5-13(f)'s top-level shape — the file's unterminated last section
//     moved onto its own position, the root the coincident parent: what the
//     deletion leaves before the file's end is line 1's terminator, so none
//     is added, and the result gains only the moved text's own terminator.
//
// In each, no hash changes — the parent's own content sequence reproduced,
// the re-inserted child entering by its canonical identity (SPEC 5.4) — and
// no node carries any category apart from the identity mapping; a dependent
// of the moved node in another file, whose `d` and `text(...)` spellings the
// move rewrites (SPEC 6.5), keeps its hashes like every other node (the
// purity claim covers a real rewrite). The parents' and the moved nodes' own
// texts are byte-asserted through `query node` on both sides as the sharp
// witness of SPEC 3's drop-rule decisions (SPEC 1.6: exact bytes).
//
// The `changed` twin — 6.2's `may` on its other side — is T6.5-13(e)'s
// shape under the same command: the composed text derives (S-9) and gives
// `p`'s run after its child the moved text's terminator, U+000A, where it
// was empty, so `p` is `changed`, its ownHash with it, its metadataHash
// kept, with the 5.6 cascades attributed to it (the root
// `descendant-changed`; a dependent of `p` in another file and that file's
// root `upstream-changed`); the moved node keeps its hashes (`x` on a kept
// line at both sides) and carries no category; the root keeps its own
// content; no other node is `changed`.

const P4_FILE = "specs/a.mdx";
const P4_DEPS = "specs/Deps.mdx";
const P4_W_TOP = "specs/Deps.mdx#watch";

/**
 * The other-file dependent: `d` plus an embedding of one node of
 * `specs/a.mdx` (two edge kinds, one target) — the exact `upstream-changed`
 * attribution in the twin; a rewritten spelling with unchanged hashes in the
 * pure shapes.
 */
function p4DepsSource(target: string, role: string): string {
  return [
    'import A from "./a.xspec"',
    "",
    `<S id="watch" d={A.${target}}>`,
    `Depends on the ${role}. Embeds: {text(A.${target})}`,
    "</S>",
    "",
  ].join("\n");
}

// Pinned shape (1): the flow-form last child.
const F1_P = "specs/a.mdx#p";
const F1_M_PRE = "specs/a.mdx#p.m";
const F1_M_POST = "specs/a.mdx#p.n";
const F1_SOURCE = '<S id="p">\n<S id="p.m">\ny\n</S>\n</S>\n';
const F1_MOVED = '<S id="p">\n<S id="p.n">\ny\n</S>\n</S>\n';

// Pinned shape (2): T6.5-13(f)'s top-level shape, no final terminator.
const F2_A = "specs/a.mdx#a";
const F2_M_PRE = "specs/a.mdx#m";
const F2_M_POST = "specs/a.mdx#n";
const F2_SOURCE = '<S id="a">x</S>\n<S id="m">\ny\n</S>';
const F2_MOVED = '<S id="a">x</S>\n<S id="n">\ny\n</S>\n';

// The `changed` twin: T6.5-13(e)'s shape, under shape (1)'s command.
const F3_SOURCE = 'foo <S id="p">\n<S id="p.m">x</S></S> baz\n';
const F3_MOVED = 'foo <S id="p">\n<S id="p.n">x</S>\n</S> baz\n';

/** One pinned pure shape of T6.2-4 (module header). */
interface PureFinalPositionStaging {
  readonly label: string;
  readonly source: string;
  /** The composed file, byte-exact. */
  readonly moved: string;
  /** Why the composition is what it is (the byte assertion's diagnosis). */
  readonly composition: string;
  readonly movedPre: string;
  readonly movedPost: string;
  /** The moved node's ID at both sides, as the dependent spells it. */
  readonly idPre: string;
  readonly idPost: string;
  /** The coincident parent, and its own text at both sides. */
  readonly parent: string;
  readonly parentOwnText: string;
  readonly parentOwnTextWhy: string;
  /** The moved node's own text at both sides. */
  readonly movedOwnText: string;
  /** Every requirement node of the fixture before the move. */
  readonly preIdentities: readonly string[];
}

const F1_STAGING: PureFinalPositionStaging = {
  label: "T6.2-4 pinned shape (1), the flow-form last child",
  source: F1_SOURCE,
  moved: F1_MOVED,
  composition:
    "the deletion removes exactly the construct's lines — the joined line it " +
    "leaves empty dropping with line 4's terminator — and the insertion " +
    "before the parent's `</S>`, at a line start with no terminator added, " +
    "restores them: byte-identical to the original but for the `id` " +
    "attribute (SPEC 6.5, 3)",
  movedPre: F1_M_PRE,
  movedPost: F1_M_POST,
  idPre: "p.m",
  idPost: "p.n",
  parent: F1_P,
  parentOwnText: "",
  parentOwnTextWhy:
    "both of its runs empty: its opening tag's line, the child's closing " +
    "tag's line, and its own closing tag's line each dropped, left empty " +
    "purely by removals (SPEC 3)",
  movedOwnText: "y\n",
  preIdentities: [P4_FILE, F1_P, F1_M_PRE, P4_DEPS, P4_W_TOP],
};

const F2_STAGING: PureFinalPositionStaging = {
  label: "T6.2-4 pinned shape (2), T6.5-13(f)'s top-level shape",
  source: F2_SOURCE,
  moved: F2_MOVED,
  composition:
    "what the deletion leaves before the file's end is line 1's terminator, " +
    "so none is added before the moved text, which its own U+000A follows: " +
    "the original with `m` re-identified and a final terminator (SPEC 6.5)",
  movedPre: F2_M_PRE,
  movedPost: F2_M_POST,
  idPre: "m",
  idPost: "n",
  parent: P4_FILE,
  parentOwnText: "\n",
  parentOwnTextWhy:
    "U+000A at both sides — line 1's terminator after `a`'s excised " +
    "contribution on that kept line, the construct's own lines dropped, the " +
    "added final terminator dropping with the closing tag's line (SPEC 3)",
  movedOwnText: "y\n",
  preIdentities: [P4_FILE, F2_A, F2_M_PRE, P4_DEPS, P4_W_TOP],
};

/** A pinned pure shape: byte-exact composition, full sweep, empty impact. */
async function runPureFinalPositionStaging(
  product: ProductBinding,
  staging: PureFinalPositionStaging,
): Promise<void> {
  const context = staging.label;
  const identityMap: Readonly<Record<string, string>> = {
    [staging.movedPre]: staging.movedPost,
  };
  const postIdentities = staging.preIdentities.map(
    (identity) => identityMap[identity] ?? identity,
  );
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    {
      [P4_FILE]: staging.source,
      [P4_DEPS]: p4DepsSource(staging.idPre, "moved node"),
    },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("pre-move baseline");
      await buildOk(product, workspace, `${context}: \`build\``);

      const before = await sweepHashes(
        product,
        workspace,
        staging.preIdentities,
        `${context} pre-move sweep`,
      );
      const parentBefore = await queryNode(
        product,
        workspace,
        staging.parent,
        `${context} pre-move`,
      );
      const movedBefore = await queryNode(
        product,
        workspace,
        staging.movedPre,
        `${context} pre-move`,
      );

      await expectExit(
        product,
        workspace,
        ["move", staging.movedPre, staging.movedPost],
        0,
        `${context}: \`move ${staging.movedPre} ${staging.movedPost}\``,
      );

      await assertFileBytes(
        workspace.path(P4_FILE),
        staging.moved,
        `${context}: ${P4_FILE} after the move — ${staging.composition}`,
      );

      // Premise: the dependent's spellings were rewritten to the new identity
      // (SPEC 6.5) — the purity claim covers a real rewrite.
      assertRewriteHappened(
        await readSourceText(workspace, P4_DEPS, `${context} rewrite premise`),
        P4_DEPS,
        `A.${staging.idPre}`,
        `A.${staging.idPost}`,
        `${context} rewrite premise`,
      );

      const after = await sweepHashes(
        product,
        workspace,
        postIdentities,
        `${context} post-move sweep`,
      );
      assertHashesPreserved(
        before,
        after,
        identityMap,
        "the same-parent final-position `move` of a pinned shape",
        context,
      );

      const parentAfter = await queryNode(
        product,
        workspace,
        staging.parent,
        `${context} post-move`,
      );
      const movedAfter = await queryNode(
        product,
        workspace,
        staging.movedPost,
        `${context} post-move`,
      );
      for (const [report, side] of [
        [parentBefore, "before"],
        [parentAfter, "after"],
      ] as const) {
        assertBytesEqual(
          report.ownText,
          staging.parentOwnText,
          `${context}: the coincident parent ${staging.parent}'s own text ` +
            `${side} the move — ${staging.parentOwnTextWhy}; the re-insertion ` +
            `reproduces its sequence (SPEC 6.2; 1.6: exact bytes)`,
        );
      }
      for (const [report, identity, side] of [
        [movedBefore, staging.movedPre, "before"],
        [movedAfter, staging.movedPost, "after"],
      ] as const) {
        assertBytesEqual(
          report.ownText,
          staging.movedOwnText,
          `${context}: the moved node ${identity}'s own text ${side} the ` +
            `move — \`y\`, U+000A on its kept interior line, its tags' lines ` +
            `dropped at both sides (SPEC 1.6, 3)`,
        );
      }

      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${context}: \`check --json\` after the move — clean: the composed ` +
          `file derives (SPEC 6.5; S-9)`,
      );

      const label = `${context}: \`impact --base <pre-move ref> --json\``;
      assertPureImpact(
        await impactAgainst(product, workspace, base, label),
        "a same-parent final-position `move` of a pinned shape",
        label,
      );
    },
  );
}

/** The `changed` twin: the coincident parent alone `changed`. */
async function runChangedTwinStaging(product: ProductBinding): Promise<void> {
  const context = "T6.2-4 `changed` twin, T6.5-13(e)'s shape";
  const depsSource = p4DepsSource("p", "coincident parent");
  await withWorkspace(
    SPECS_ONLY_CONFIG,
    { [P4_FILE]: F3_SOURCE, [P4_DEPS]: depsSource },
    async (workspace) => {
      await workspace.gitInit();
      const base = await workspace.gitCommitAll("pre-move baseline");
      await buildOk(product, workspace, `${context}: \`build\``);

      const parentBefore = await queryNode(
        product,
        workspace,
        F1_P,
        `${context} pre-move`,
      );
      const rootBefore = await queryNode(
        product,
        workspace,
        P4_FILE,
        `${context} pre-move`,
      );
      const movedBefore = await queryNode(
        product,
        workspace,
        F1_M_PRE,
        `${context} pre-move`,
      );

      await expectExit(
        product,
        workspace,
        ["move", F1_M_PRE, F1_M_POST],
        0,
        `${context}: \`move ${F1_M_PRE} ${F1_M_POST}\``,
      );

      await assertFileBytes(
        workspace.path(P4_FILE),
        F3_MOVED,
        `${context}: ${P4_FILE} after the move — the origin deletion's range ` +
          `ends exactly at the insertion point, which line 1's terminator ` +
          `precedes in the composed text, so no terminator is added before ` +
          `the moved text, and its own U+000A follows it (SPEC 6.5; ` +
          `T6.5-13(e))`,
      );
      await assertFileBytes(
        workspace.path(P4_DEPS),
        depsSource,
        `${context}: ${P4_DEPS} after the move — its spellings resolve to ` +
          `\`p\`, whose identity the mapping leaves alone: nothing rewritten, ` +
          `no other byte changed (SPEC 6.5)`,
      );

      const parentAfter = await queryNode(
        product,
        workspace,
        F1_P,
        `${context} post-move`,
      );
      const rootAfter = await queryNode(
        product,
        workspace,
        P4_FILE,
        `${context} post-move`,
      );
      const movedAfter = await queryNode(
        product,
        workspace,
        F1_M_POST,
        `${context} post-move`,
      );

      assertBytesEqual(
        parentBefore.ownText,
        "\n",
        `${context}: \`p\`'s own text before the move — line 1's terminator, ` +
          `on a kept line, before its child; its run after the child empty, ` +
          `its closing tag following the child's at once (SPEC 1.6, 3)`,
      );
      assertBytesEqual(
        parentAfter.ownText,
        "\n\n",
        `${context}: \`p\`'s own text after the move — its run after the ` +
          `child now the moved text's terminator, U+000A, on the kept line ` +
          `holding \`x\`, where it was empty (SPEC 6.2, 6.5, 3)`,
      );
      if (parentAfter.hashes.ownHash === parentBefore.hashes.ownHash) {
        fail(
          `${context}: \`p\`'s ownHash must change — its own content ` +
            `sequence gained the run U+000A after its child (SPEC 6.2, 5.5); ` +
            `both sides report ownHash ` +
            `${JSON.stringify(parentAfter.hashes.ownHash)}`,
        );
      }
      assertSameJson(
        parentAfter.hashes.metadataHash,
        parentBefore.hashes.metadataHash,
        `${context}: \`p\` keeps its metadataHash — a section move changes ` +
          `no node's \`d\` targets, coverage, or tags (SPEC 6.2, 5.5)`,
      );
      for (const [report, side] of [
        [rootBefore, "before"],
        [rootAfter, "after"],
      ] as const) {
        assertBytesEqual(
          report.ownText,
          "foo  baz\n",
          `${context}: the root's own text ${side} the move — \`foo \` and ` +
            `\` baz\`, U+000A on kept lines at both sides, joined at \`p\`'s ` +
            `excision point (SPEC 1.6, 3; T6.5-13(e))`,
        );
      }
      assertSameJson(
        rootAfter.hashes.ownHash,
        rootBefore.hashes.ownHash,
        `${context}: the root keeps its ownHash — its own content is ` +
          `unchanged, \`p\` the one parent between its runs (SPEC 6.2)`,
      );
      for (const [report, identity, side] of [
        [movedBefore, F1_M_PRE, "before"],
        [movedAfter, F1_M_POST, "after"],
      ] as const) {
        assertBytesEqual(
          report.ownText,
          "x",
          `${context}: the moved node ${identity}'s own text ${side} the ` +
            `move — \`x\` on a kept line at both sides (SPEC 1.6, 3)`,
        );
      }
      assertSameJson(
        movedAfter.hashes,
        movedBefore.hashes,
        `${context}: the moved node ${F1_M_PRE} (now ${F1_M_POST}) keeps its ` +
          `hashes — the identity mapping changes no hash, its one run rides ` +
          `a kept line at both sides, and it has no children and no ` +
          `dependency edges (SPEC 6.2, 5.4, 5.5)`,
      );

      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${context}: \`check --json\` after the move — clean: the composed ` +
          `text derives (SPEC 6.5; S-9)`,
      );

      const label = `${context}: \`impact --base <pre-move ref> --json\``;
      assertImpactTable(
        await impactAgainst(product, workspace, base, label),
        [
          {
            identity: F1_P,
            categories: [{ category: "changed", within: [F1_P] }],
          },
          {
            identity: P4_FILE,
            categories: [{ category: "descendant-changed", exact: [F1_P] }],
          },
          { identity: F1_M_POST, categories: [] },
          {
            identity: P4_W_TOP,
            categories: [{ category: "upstream-changed", exact: [F1_P] }],
          },
          {
            identity: P4_DEPS,
            categories: [{ category: "upstream-changed", exact: [F1_P] }],
          },
        ],
        label,
      );
    },
  );
}

const T6_2_4 = defineProductTest({
  id: "T6.2-4",
  // Three stagings (~40 CLI invocations, ~12 s alone): headroom for a
  // saturated box.
  timeoutMs: 180_000,
  title:
    "same-parent final-position move: moving a parent's last child onto itself (same parent, same final position, new ID) is pure in effect exactly when the re-insertion reproduces the parent's own content sequence — in the two pinned shapes (a flow-form last child whose tags, and its parent's closing tag, stand alone on their lines; T6.5-13(f)'s top-level shape) the composed file is byte-exact, no hash in the workspace changes (full sweep), and `impact --base <pre-move ref>` reports no categories apart from the identity mapping; in the `changed` twin (T6.5-13(e)'s shape) the coincident parent alone is `changed`, its ownHash with it and its metadataHash kept, with the 5.6 cascades attributed to it, the moved node and the root keeping their content (SPEC 6.2, 6.5, 3, 5.4, 5.6)",
  run: async (product) => {
    await runPureFinalPositionStaging(product, F1_STAGING);
    await runPureFinalPositionStaging(product, F2_STAGING);
    await runChangedTwinStaging(product);
  },
});

/** TEST-SPEC §6.2, in canonical ID order (SUITE-22). */
export const section62Tests: readonly ProductTestEntry[] = [
  T6_2_1,
  T6_2_2,
  T6_2_3,
  T6_2_4,
];
