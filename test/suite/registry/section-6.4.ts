// TEST-SPEC §6.4 (rename) — SUITE-24: T6.4-1…T6.4-7.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.4: `xspec rename <file> <old-id> <new-id>` renames a requirement ID,
// rewrites descendant IDs by prefix replacement, rewrites every reference to
// the affected identities across all configured spec and code sources (`id`
// attributes, `d` references, `text(...)` references, TypeScript markers),
// and appends the mapping to the journal. Rewrites are minimal in-place
// edits, preserving each reference's quote style and access form (2.4); where
// a form cannot be kept, the rewritten part uses dot access for segments that
// are valid TypeScript identifiers, double-quoted computed access for
// segments that are not, and double-quoted string literals. Type-level
// references record no edges and are not rewritten. A nonexistent `<file>` or
// old ID is a usage error (12.0) checked before source validation, and so is
// a `<file>` naming a discovered code source — a wrong-kind operand, judged
// like existence before any content question (6.4); the old ID's existence is
// parse-local, judged over spelled identities (11.2): a bearer whose node
// identity is undefined (duplicate spellings; an undefined ancestor chain)
// still establishes existence, a section spelling no identity (its `id`
// attribute repeated) establishes none, and an old ID inside an unparseable
// origin file is masked (14.20, 14); every other validation failure refuses
// the rename (exit 1), the valid-workspace precondition included, before
// modifying anything. A successful rename finishes by regenerating derived
// files exactly as `xspec build` does.
//
// Conservative operationalizations (noted per H-4):
// - T6.4-1 "all edges retarget (query-asserted)": the workspace-wide edge set
//   of each dependency kind (`query edges --kinds depends|embeds|references`)
//   is asserted exactly, before and after the rename; `contains` retargeting
//   is asserted through the full incoming/outgoing edge sets of the two
//   renamed nodes (`query node`), whose contains inventory the fixture pins
//   completely — the workspace-wide `contains` inventory (root edges
//   included) is §11's business, not this test's.
// - T6.4-1 "mapping appended to journal" uses the SUITE-21
//   operationalization: the journal (absent before the first journaled
//   operation, SPEC 6.1) exists as a plain file holding exactly one
//   line-oriented entry after the one rename; entry content stays opaque
//   (H-4).
// - T6.4-1 "the command's own report is the applied mapping": the rename runs
//   with `--json` (12.0: a single JSON document as the entire stdout) and its
//   report is decoded through the H-3 applied-mapping adapter
//   (adapters/operations.ts — the successful operation's report shape is
//   unpinned, so the adapter owns the shape) and asserted to carry exactly
//   the identity pairs the operation journaled, as a complete set: journal
//   entry content being opaque (H-4), the expected pairs are the fixture's —
//   the renamed node and its descendant, which SPEC 6.4 pins as the complete
//   mapping (the renamed ID plus the prefix-replaced descendants, nothing
//   else). Pair order is unasserted (shape, not information).
// - T6.4-2 stages every keepable form on the *affected* segment itself —
//   computed access in both quote kinds, dot access, local string literals
//   and `id` attributes in both quote kinds — and composes each expected
//   post-rename file from SPEC 6.4's rules: only the renamed segment's
//   characters change, quote kind and access form are kept, and the
//   double-quoted computed fallback applies to a dot segment whose new name
//   is not a TS identifier alone. Whole files are compared byte-exactly,
//   `.mdx` and `.ts` alike (markers and `text(...)` calls included), and
//   two files holding only unaffected references must come through
//   byte-identical ("only the affected parts change" pins all other
//   bytes: untouched segments and references, prose and comments spelling
//   the old name).
// - T6.4-3/T6.4-6 "modifies nothing" is a whole-workspace-root byte snapshot
//   compare around the refused command, with the pre-refusal `build`'s
//   derived files present — a product that rewrites before validating, or
//   regenerates on refusal, fails the compare. Refusal arms run with
//   `--json`: a refused operation's report is the form-exact 12.7
//   findings-only report (SPEC 12.7, H-3), and each arm — staged to isolate
//   one refusal cause — asserts exactly one finding carrying the exact
//   stable refusal code (SPEC 14: one finding per applicable reason,
//   TEST-SPEC preamble: a code is contract) with the concerned identity or
//   located bearer §14 assigns the reason (T14-7's staging record names
//   T6.4-3). Identity concerns accept the full 1.5 identity or its bare ID
//   (§14 requires identification, not spelling); the collision arm's window
//   spans the remaining colliding bearer's whole construct, admitting any
//   in-construct precision while rejecting wrong-construct attribution.
//   T6.4-6's invalid-workspace refusal instead reports the workspace's
//   numbered findings alone (SPEC 14, 6.4) — exactly its one 14.5 finding
//   located in the offending file, no refusal reason beside it.
// - T6.4-4 exit-2 arms run with `--json`: stdout exactly one 12.7 error
//   document (12.0: with JSON output in effect, an exit-2 invocation emits
//   the error document as its entire stdout — no report, no validation
//   findings: the 12.0-ordering discriminator) and the usage error message
//   on stderr (12.0), asserted for presence, not wording. The masking arm
//   asserts exit 1 with a findings report of exactly one 14.20 naming the
//   unparseable file with a location (SPEC 14, H-3). The parse-local
//   existence arms (SPEC 6.4, 11.2) assert the invalid-workspace refusal
//   through the T6.4-6 protocol — exit 1, the workspace's numbered findings
//   alone (exactly one 14.3 for duplicate spellings; exactly one 14.1 for
//   the identity-less ancestor), located in the staged file, nothing
//   modified — never exit 2: each staged bearer spells the old ID, so
//   existence holds whatever its node identity. The spells-no-identity arm
//   pins its staging premise first (`build --json` reports exactly one
//   14.17 — a repeated `id` is condition 17, never 14.1, and spells no
//   identity, SPEC 14, 11.2) so its exit-2 assertion demonstrably runs
//   beside that file's findings.
// - T6.4-7 "byte-identical to a fresh build of the rewritten sources" is the
//   H-6 two-directory protocol: a second workspace is seeded with the
//   post-rename configuration, sources, and journal (derived files are
//   reproducible from sources, configuration, and the journal, SPEC 13.4),
//   `xspec build` runs there, and the two workspace roots are compared as
//   whole byte trees — generated modules, Markdown output, and graph data
//   all included, normalizing nothing.

import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { GraphEdge, NodeReport } from "../../helpers/adapters/index.js";
import {
  decodeAppliedMappingReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeNodeReport,
  decodeNodeRowsReport,
} from "../../helpers/adapters/index.js";
import {
  assertFileBytes,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import {
  assertDirectoriesEqual,
  assertLeavesUnchanged,
} from "../../helpers/snapshot.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { ConcernedIdentity, FindingSourceExpectation } from "./support.js";
import {
  assertAppliedMapping,
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingLocated,
  assertFindingMentionsLocation,
  assertFindingNamesIdentity,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectErrorDocument,
  expectExit,
  runJson,
  sortedIdentities,
} from "./support.js";

// One spec group plus one code group (SPEC 7.2), for fixtures whose rewrites
// span MDX and TypeScript sources.
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

// Exactly one spec group (SPEC 7), for the refusal and usage-error fixtures.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// Specs, code, and Markdown emission (SPEC 7.3), so T6.4-7's compare covers
// generated modules, Markdown output, and graph data alike.
const FULL_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  markdown: { emit: true }
})
`;

const JOURNAL_PATH = ".xspec/journal";
const LF = 0x0a;

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

/**
 * Read the journal's exact bytes, failing diagnosed (H-8) when the path does
 * not hold a plain file (SPEC 6.1: the file comes into existence with the
 * first journaled operation; 13.4: durable files are plain files).
 */
async function readJournal(
  workspace: TestWorkspace,
  context: string,
): Promise<Uint8Array> {
  const kind = await workspace.kind(JOURNAL_PATH);
  if (kind !== "file") {
    fail(
      `${context}: expected the journal as a plain file at ${JOURNAL_PATH} ` +
        `(SPEC 6.1, 13.4); found ${kind}`,
    );
  }
  return await workspace.readBytes(JOURNAL_PATH);
}

/**
 * Lines in a line-oriented file, tolerating a terminated or unterminated
 * final line (0 for an empty file) — the fixed H-4 operationalization of
 * "one entry per line" (SUITE-21).
 */
function journalLineCount(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let count = 0;
  for (const byte of bytes) {
    if (byte === LF) count += 1;
  }
  if (bytes[bytes.length - 1] !== LF) count += 1;
  return count;
}

/**
 * The workspace's complete edge set of one dependency kind, via
 * `query edges --kinds <kind>` (SPEC 11). Asserted against an exact expected
 * set, this pins every recorded edge of the kind — none missing, none
 * phantom, no duplicates (edges of each kind form a set, SPEC 5.2).
 */
async function queryEdgesOfKind(
  product: ProductBinding,
  workspace: TestWorkspace,
  kind: "depends" | "embeds" | "references",
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges --kinds ${kind}\``;
  return decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--kinds", kind],
      label,
    ),
    label,
  );
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
 * Assert `query nodes` enumerates exactly the expected requirement-node
 * identities (SPEC 11; the workspace-relative identity form of SPEC 1.5).
 */
async function assertNodeIdentities(
  product: ProductBinding,
  workspace: TestWorkspace,
  expected: readonly string[],
  reason: string,
  context: string,
): Promise<void> {
  const label = `${context} \`query nodes\``;
  const rows = decodeNodeRowsReport(
    await runJson(product, workspace, ["query", "nodes"], label),
    label,
  );
  assertSameJson(
    sortedIdentities(rows),
    [...expected].sort(),
    `${label}: ${reason}`,
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
 * Premise check that the rename rewrote a source's references (SPEC 6.4):
 * the stale spelling is gone and the rewritten spelling is present.
 * Deliberately substring-level (byte-exact rewrite content is T6.4-2's
 * business); this makes a missing rewrite fail with a crisp diagnosis ahead
 * of the query-level assertions.
 */
function assertRewriteHappened(
  text: string,
  rel: string,
  staleSpelling: string,
  rewrittenSpelling: string,
  context: string,
): void {
  if (text.includes(staleSpelling)) {
    fail(
      `${context}: ${rel} still contains the stale spelling ` +
        `${JSON.stringify(staleSpelling)} — the rename rewrites every ` +
        `reference to the affected identities across all configured spec and ` +
        `code sources (SPEC 6.4)`,
    );
  }
  if (!text.includes(rewrittenSpelling)) {
    fail(
      `${context}: ${rel} does not contain the rewritten spelling ` +
        `${JSON.stringify(rewrittenSpelling)} (SPEC 6.4)`,
    );
  }
}

/**
 * What a refused rename's report must hold (SPEC 14, 12.7): the arm's one
 * finding — its exact stable code — plus whichever concern §14 assigns the
 * reason: a located bearer/spelling, a concerned identity, or nothing further
 * where the concern's rendering is the reason's message alone. Exported for
 * T6.6-3, which stages T6.4-3's refusals identically and asserts the
 * `--preview` invocation's refusal equivalence (TEST-SPEC §6.6).
 */
export interface RefusalExpectation {
  /**
   * The finding's counting key (`assertConditionCounts` vocabulary): a
   * stable refusal code token (`refused-…`), or a `14.N` condition identity
   * for the invalid-workspace refusal, which reports the workspace's
   * numbered findings alone (SPEC 14, 6.4).
   */
  readonly finding: string;
  /** At least one location names this file (and byte window when given). */
  readonly locatedAt?: FindingSourceExpectation;
  /** At least one identities entry names this concerned identity. */
  readonly identity?: ConcernedIdentity;
}

/**
 * A refused rename (SPEC 6.4: every validation failure beyond the argument
 * existence checks refuses with exit 1): run with `--json`, assert exit 1
 * exactly, decode stdout as the form-exact 12.7 findings-only report of a
 * refused operation (SPEC 12.7, H-3), assert the report holds exactly one
 * finding bearing the arm's stable code with its concerned data (SPEC 14,
 * T14-7), and assert the refusal modifies nothing — a whole-workspace-root
 * byte snapshot compare around the command (derived files, sources, and the
 * journal's absence all included).
 */
async function expectRefusalModifiesNothing(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  expected: RefusalExpectation,
  context: string,
): Promise<void> {
  const command = argv.join(" ");
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await expectExit(
        product,
        workspace,
        [...argv, "--json"],
        1,
        `${context}: \`${command} --json\` — the refusal is a validation ` +
          `failure, exit 1 (SPEC 6.4, 12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, `${context}: \`${command} --json\``),
        `${context}: \`${command} --json\` — a refused operation's report ` +
          `is the form-exact 12.7 findings-only report (SPEC 12.7, H-3)`,
      ).findings;
      assertConditionCounts(
        findings,
        { [expected.finding]: 1 },
        `${context}: the arm isolates one refusal cause, so the report ` +
          `holds exactly one finding carrying its exact stable code — one ` +
          `finding per applicable reason, a code is contract (SPEC 14, ` +
          `12.7, T14-7)`,
      );
      const finding = findings[0]!;
      if (expected.locatedAt !== undefined) {
        assertFindingMentionsLocation(
          finding,
          expected.locatedAt,
          `${context}: the refusal's concerned construct`,
        );
      }
      if (expected.identity !== undefined) {
        assertFindingNamesIdentity(
          finding,
          expected.identity,
          `${context}: the refusal's concerned identity`,
        );
      }
    },
    `${context}: \`${command}\` refused — modifies nothing (SPEC 6.4)`,
  );
}

/**
 * A rename usage error (SPEC 6.4, 12.0: a nonexistent or wrong-kind
 * code-source `<file>`, or a nonexistent old ID): run with `--json`, assert
 * exit 2 exactly, the single 12.7 error document as the entire stdout (12.0:
 * no report and no validation findings — the 12.0-ordering discriminator;
 * H-5), and a usage error message on stderr (12.0: standard-error content;
 * presence, not wording).
 */
async function expectRenameUsageError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  const command = argv.join(" ");
  const result = await expectExit(
    product,
    workspace,
    [...argv, "--json"],
    2,
    `${context}: \`${command} --json\` — a nonexistent or wrong-kind ` +
      `<file>, or a nonexistent old ID, is a usage error (SPEC 6.4, 12.0)`,
  );
  expectErrorDocument(
    result,
    `${context}: \`${command} --json\` — under --json, the exit-2 error ` +
      `document is the entire stdout: the usage error emits no report and ` +
      `no validation findings (SPEC 12.0, 12.7, H-5)`,
  );
  if (result.stderrBytes.length === 0) {
    fail(
      `${context}: \`${command} --json\` — usage error messages are ` +
        `standard-error content (SPEC 12.0), but stderr is empty`,
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// T6.4-1 — rewrites
// ---------------------------------------------------------------------------

// The rename subject `core.mid` is mid-tree with a descendant (prefix
// replacement) and carries a local string `d` itself (the rewritten *source*
// of an edge). References to the affected identities cover every listed
// surface: local string references (`d` and `text(...)` in the same file),
// external chain references in another spec file (`d` and `text(...)`), and
// a TS marker plus a TS `text(...)` call in a code file (SPEC 6.4).
const R1_CORE = "specs/Core.mdx";
const R1_REFS = "specs/Refs.mdx";
const R1_APP = "src/app.ts";

const R1_CORE_SOURCE = [
  '<S id="core">',
  "Core holder text.",
  "",
  '<S id="core.mid" d={"core.plain"}>',
  "Mid text.",
  "",
  '<S id="core.mid.leaf">',
  "Leaf text.",
  "</S>",
  "</S>",
  "",
  '<S id="core.sib" d={"core.mid"}>',
  'Sib embeds: {text("core.mid.leaf")}',
  "</S>",
  "",
  '<S id="core.plain">',
  "Plain text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const R1_REFS_SOURCE = [
  'import Core from "./Core.xspec"',
  "",
  '<S id="refs" d={Core.core.mid}>',
  "Refs embeds: {text(Core.core.mid.leaf)}",
  "</S>",
  "",
].join("\n");

const R1_APP_SOURCE = [
  'import CORE, { text } from "../specs/Core.xspec";',
  "",
  "CORE.core.mid.leaf;",
  "text(CORE.core.mid);",
  "",
].join("\n");

const R1_UNCHANGED_IDENTITIES = [
  "specs/Core.mdx",
  "specs/Core.mdx#core",
  "specs/Core.mdx#core.sib",
  "specs/Core.mdx#core.plain",
  "specs/Refs.mdx",
  "specs/Refs.mdx#refs",
];
const R1_PRE_IDENTITIES = [
  ...R1_UNCHANGED_IDENTITIES,
  "specs/Core.mdx#core.mid",
  "specs/Core.mdx#core.mid.leaf",
];
const R1_POST_IDENTITIES = [
  ...R1_UNCHANGED_IDENTITIES,
  "specs/Core.mdx#core.hub",
  "specs/Core.mdx#core.hub.leaf",
];

/** The fixture's complete dependency-kind edge sets, parameterized on the
 * renamed identities (`mid` pre-rename, `hub` post-rename). */
function r1Edges(
  subject: string,
  leaf: string,
): {
  depends: GraphEdge[];
  embeds: GraphEdge[];
  references: GraphEdge[];
} {
  return {
    depends: [
      { from: subject, to: "specs/Core.mdx#core.plain", kind: "depends" },
      { from: "specs/Core.mdx#core.sib", to: subject, kind: "depends" },
      { from: "specs/Refs.mdx#refs", to: subject, kind: "depends" },
    ],
    embeds: [
      { from: "specs/Core.mdx#core.sib", to: leaf, kind: "embeds" },
      { from: "specs/Refs.mdx#refs", to: leaf, kind: "embeds" },
      { from: "src/app.ts", to: subject, kind: "embeds" },
    ],
    references: [{ from: "src/app.ts", to: leaf, kind: "references" }],
  };
}

/** Assert the workspace-wide edge set of each dependency kind (SPEC 5.2, 11). */
async function assertDependencyEdges(
  product: ProductBinding,
  workspace: TestWorkspace,
  expected: ReturnType<typeof r1Edges>,
  context: string,
): Promise<void> {
  for (const kind of ["depends", "embeds", "references"] as const) {
    assertEdgeSetEqual(
      await queryEdgesOfKind(product, workspace, kind, context),
      expected[kind],
      `${context}: the workspace's complete \`${kind}\` edge set — every ` +
        `edge whose endpoint is a renamed identity retargets to the new ` +
        `identity, sources and targets alike (SPEC 6.4, 5.2)`,
    );
  }
}

const T6_4_1 = defineProductTest({
  id: "T6.4-1",
  title:
    "rewrites: renaming a mid-tree ID rewrites its `id`, all descendant `id`s by prefix replacement, local string references, external chain references in other files, `text(...)` targets in MDX and TS, and TS markers — the workspace builds, all edges retarget (query-asserted), the mapping is appended to the journal, and the command's own report is the applied mapping — every journaled identity pair, the information of the preview's `mapping`, carried in JSON per 12.0 (SPEC 6.4, 6.6, 6.1, 12.0; H-3 adapter, report shape unpinned)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        [R1_CORE]: R1_CORE_SOURCE,
        [R1_REFS]: R1_REFS_SOURCE,
        [R1_APP]: R1_APP_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.4-1 `build` over the staged workspace",
        );

        // Staging premises: no journal before the first journaled operation
        // (SPEC 6.1); the pre-rename node and edge inventories are exactly as
        // staged, so "retarget" below is a real transition.
        const journalBefore = await workspace.kind(JOURNAL_PATH);
        if (journalBefore !== "absent") {
          fail(
            `T6.4-1: staging premise — no journal file exists before the ` +
              `first journaled operation (SPEC 6.1); found ${journalBefore} ` +
              `at ${JOURNAL_PATH}`,
          );
        }
        await assertNodeIdentities(
          product,
          workspace,
          R1_PRE_IDENTITIES,
          "staging premise — the pre-rename enumeration is exactly the " +
            "staged node set (SPEC 11, 1.5)",
          "T6.4-1 pre-rename",
        );
        await assertDependencyEdges(
          product,
          workspace,
          r1Edges("specs/Core.mdx#core.mid", "specs/Core.mdx#core.mid.leaf"),
          "T6.4-1 pre-rename",
        );

        // The command's own report is the applied mapping — every identity
        // pair the operation journaled, the information of the preview's
        // `mapping` (SPEC 6.4, 6.6) — carried in JSON per 12.0 and decoded
        // through the H-3 adapter (the successful operation's report shape is
        // unpinned). The fixture pins the journaled mapping completely: the
        // renamed node and its one descendant re-identified by prefix
        // replacement, and nothing else — every other identity is unchanged
        // and unmapped.
        const renameReport = await runJson(
          product,
          workspace,
          ["rename", "specs/Core.mdx", "core.mid", "core.hub", "--json"],
          "T6.4-1 `rename specs/Core.mdx core.mid core.hub --json`",
        );
        assertAppliedMapping(
          decodeAppliedMappingReport(renameReport, "T6.4-1"),
          [
            {
              from: "specs/Core.mdx#core.mid",
              to: "specs/Core.mdx#core.hub",
            },
            {
              from: "specs/Core.mdx#core.mid.leaf",
              to: "specs/Core.mdx#core.hub.leaf",
            },
          ],
          "T6.4-1: the successful rename's report is the applied mapping — " +
            "exactly the identity pairs the operation journaled: the renamed " +
            "node and its descendant, old identity to new (SPEC 6.4, 6.6, " +
            "12.0)",
        );

        // The rewrites, per source surface: stale spellings gone, rewritten
        // spellings present (byte-exact edit content is T6.4-2's business).
        for (const [rel, surface] of [
          [R1_CORE, "`id` attributes and local string references"],
          [R1_REFS, "external chain references and the MDX `text(...)` target"],
          [R1_APP, "the TS marker and the TS `text(...)` target"],
        ] as const) {
          assertRewriteHappened(
            await readSourceText(workspace, rel, "T6.4-1 rewrite check"),
            rel,
            "core.mid",
            "core.hub",
            `T6.4-1 rewrite check (${surface})`,
          );
        }

        // Mapping appended to the journal: the file came into existence with
        // this first journaled operation and holds exactly one line-oriented
        // entry (SPEC 6.1; entry content opaque, H-4).
        const journal = await readJournal(workspace, "T6.4-1 after the rename");
        const lines = journalLineCount(journal);
        if (lines !== 1) {
          fail(
            `T6.4-1: the rename must append its mapping to the journal as ` +
              `exactly one line-oriented entry — the journal came into ` +
              `existence with this first journaled operation (SPEC 6.4, 6.1); ` +
              `found ${String(lines)} line(s) in ${String(journal.length)} bytes`,
          );
        }

        // The rewritten workspace builds (SPEC 6.4: rename only ever rewrites
        // a valid workspace into a valid one).
        await buildOk(
          product,
          workspace,
          "T6.4-1 `build` over the rewritten workspace",
        );

        // All identities and all edges retarget (query-asserted).
        await assertNodeIdentities(
          product,
          workspace,
          R1_POST_IDENTITIES,
          "the renamed node and its descendant are enumerated under the new " +
            "identities (prefix replacement) and every other identity is " +
            "unchanged (SPEC 6.4, 1.5)",
          "T6.4-1 post-rename",
        );
        await assertDependencyEdges(
          product,
          workspace,
          r1Edges("specs/Core.mdx#core.hub", "specs/Core.mdx#core.hub.leaf"),
          "T6.4-1 post-rename",
        );

        // The renamed nodes' complete edge inventories, `contains` included
        // (the fixture pins them fully; module header, H-4).
        const hub = await queryNode(
          product,
          workspace,
          "specs/Core.mdx#core.hub",
          "T6.4-1 post-rename",
        );
        assertEdgeSetEqual(
          hub.incomingEdges,
          [
            {
              from: "specs/Core.mdx#core",
              to: "specs/Core.mdx#core.hub",
              kind: "contains",
            },
            {
              from: "specs/Core.mdx#core.sib",
              to: "specs/Core.mdx#core.hub",
              kind: "depends",
            },
            {
              from: "specs/Refs.mdx#refs",
              to: "specs/Core.mdx#core.hub",
              kind: "depends",
            },
            {
              from: "src/app.ts",
              to: "specs/Core.mdx#core.hub",
              kind: "embeds",
            },
          ],
          "T6.4-1: the renamed node's incoming edges — `contains` from its " +
            "parent and every dependency edge — retarget to the new identity " +
            "(SPEC 6.4, 5.2)",
        );
        assertEdgeSetEqual(
          hub.outgoingEdges,
          [
            {
              from: "specs/Core.mdx#core.hub",
              to: "specs/Core.mdx#core.hub.leaf",
              kind: "contains",
            },
            {
              from: "specs/Core.mdx#core.hub",
              to: "specs/Core.mdx#core.plain",
              kind: "depends",
            },
          ],
          "T6.4-1: the renamed node's outgoing edges originate at the new " +
            "identity — its `contains` to the re-identified descendant and " +
            "its own `d` edge (SPEC 6.4, 5.2)",
        );
        const leaf = await queryNode(
          product,
          workspace,
          "specs/Core.mdx#core.hub.leaf",
          "T6.4-1 post-rename",
        );
        assertEdgeSetEqual(
          leaf.incomingEdges,
          [
            {
              from: "specs/Core.mdx#core.hub",
              to: "specs/Core.mdx#core.hub.leaf",
              kind: "contains",
            },
            {
              from: "specs/Core.mdx#core.sib",
              to: "specs/Core.mdx#core.hub.leaf",
              kind: "embeds",
            },
            {
              from: "specs/Refs.mdx#refs",
              to: "specs/Core.mdx#core.hub.leaf",
              kind: "embeds",
            },
            {
              from: "src/app.ts",
              to: "specs/Core.mdx#core.hub.leaf",
              kind: "references",
            },
          ],
          "T6.4-1: the re-identified descendant's incoming edges — MDX and " +
            "TS `text(...)` targets and the TS marker — retarget to the new " +
            "identity (SPEC 6.4, 5.2)",
        );
        assertEdgeSetEqual(
          leaf.outgoingEdges,
          [],
          "T6.4-1: the re-identified descendant has no outgoing edges",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.4-2 — minimal edits (byte-exact, every keepable form kept)
// ---------------------------------------------------------------------------

// Each fixture below is a template over the renamed segment's spelling, so
// every expected post-rename file is composed from SPEC 6.4's rules — only
// the renamed segment's characters change; the quote kind of a computed
// access, a string literal, or an `id` attribute and the access form of a
// chain segment are kept wherever the new name admits them — while every
// other byte (untouched segments and references, prose and comments that
// spell the old name, whole files holding no affected reference) is the
// staged byte verbatim.
//
// Fixture L (arms 1 and 2): the renamed segment `login-v2` is not a TS
// identifier, so its chain references are computed — double-quoted
// (`["login-v2"]`) and single-quoted (`['login-v2']`) — and its local string
// references and `id` attributes come in both quote kinds; the renamed
// section's own `id` and one rewritten descendant's `id` are single-quoted
// (SPEC 2.7). Arm 1 renames it to the identifier-valid `login2`: the
// double-quoted computed segment stays computed and double-quoted (never
// `.login2`), the single-quoted one keeps its single quotes, and so do the
// single-quoted local strings and `id` values. Arm 2 renames it to
// `login-v3`: the same forms, all kept.

/** Fixture L's `specs/Core.mdx`; `seg` spells the renamed segment. */
function coreL(seg: string): string {
  return [
    `<S id='${seg}'>`,
    "Login text; the prose spelling login-v2 is no reference and stays.",
    "",
    `<S id='${seg}.kid'>`,
    "Kid text.",
    "</S>",
    "",
    `<S id="${seg}.aux" d={['${seg}.kid']}>`,
    `Aux: {text('${seg}.kid')}`,
    "</S>",
    "</S>",
    "",
    `<S id="other" d={["${seg}", '${seg}.kid', 'other.leaf']}>`,
    `Other: {text('${seg}')} and {text("${seg}.aux")} and {text('other.leaf')}`,
    "",
    '<S id="other.leaf">',
    "Leaf text.",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

/** Fixture L's `specs/Refs.mdx`: external chains through both quote kinds. */
function refsL(seg: string): string {
  return [
    'import Core from "./Core.xspec"',
    "",
    `<S id="refs" d={[Core["${seg}"], Core['${seg}'].kid, Core["${seg}"]["aux"], Core['other'].leaf]}>`,
    `Embeds: {text(Core['${seg}'])} and {text(Core["${seg}"].kid)} and {text(Core['other'])}`,
    "</S>",
    "",
  ].join("\n");
}

/** Fixture L's `src/app.ts`: markers and `text(...)` calls, both quote kinds. */
function appL(seg: string): string {
  return [
    'import CORE, { text } from "../specs/Core.xspec";',
    "",
    '// A comment is no reference: CORE["login-v2"] stays as written here.',
    "export function login(): string {",
    `  CORE["${seg}"];`,
    `  CORE['${seg}'].kid;`,
    `  return text(CORE['${seg}']) + text(CORE["${seg}"]["aux"]);`,
    "}",
    "",
    "export function other(): string {",
    "  CORE.other.leaf;",
    "  return text(CORE['other']);",
    "}",
    "",
  ].join("\n");
}

// Fixture L's untouched sources: unaffected identities only, referenced in
// single-quoted and computed spellings beside a single-quoted `id` — the
// rename must leave both files byte-identical.
const OTHER_MDX_L = [
  'import Core from "./Core.xspec"',
  "",
  "<S id=\"unrelated\" d={[Core.other, Core['other'].leaf]}>",
  "Unrelated: {text(Core[\"other\"].leaf)} and {text('unrelated.sub')}",
  "",
  "<S id='unrelated.sub'>",
  "Sub text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const OTHER_TS_L = [
  'import CORE, { text } from "../specs/Core.xspec";',
  "",
  "CORE.other;",
  "text(CORE['other'].leaf);",
  "",
].join("\n");

// Fixture M (arms 3 and 4): the renamed segment `mid` is a TS identifier,
// referenced in dot access, in computed access of both quote kinds, and in
// local strings of both quote kinds. Arm 3 renames it to `neo`: dot stays dot
// and every computed segment keeps its quotes. Arm 4 renames it to `neo-2`:
// dot access cannot hold it and becomes double-quoted computed access (the
// 6.4 fallback), while the computed segments keep their quote kinds and the
// string literals hold any segment — untouched dot parts after the converted
// segment (`.kid-x`, `.mid` after `['top']`) stay as they are.

/** Fixture M's `specs/Core.mdx`; `seg` spells the renamed segment. */
function coreM(seg: string): string {
  return [
    '<S id="top">',
    "Top text.",
    "",
    `<S id="top.${seg}">`,
    "Mid text.",
    "",
    `<S id="top.${seg}.kid-x">`,
    "Kid text.",
    "</S>",
    "</S>",
    "",
    `<S id="top.aid" d={["top.${seg}", 'top.${seg}.kid-x', 'top.res']}>`,
    `Embeds: {text("top.${seg}.kid-x")} and {text('top.${seg}')} and {text('top.res')}`,
    "</S>",
    "",
    '<S id="top.res">',
    "Res text.",
    "</S>",
    "</S>",
    "",
  ].join("\n");
}

/**
 * Fixture M's `specs/Refs.mdx`; `dot` spells an affected dot-access segment
 * (`.mid`, `.neo`, or the `["neo-2"]` fallback), `seg` an affected computed one.
 */
function refsM(dot: string, seg: string): string {
  return [
    'import Core from "./Core.xspec"',
    "",
    `<S id="refs" d={[Core.top${dot}, Core.top["${seg}"], Core.top['${seg}'], Core['top']${dot}]}>`,
    `Embeds: {text(Core.top${dot}["kid-x"])} and {text(Core.top['${seg}']['kid-x'])} and {text(Core.top['res'])}`,
    "</S>",
    "",
  ].join("\n");
}

/** Fixture M's `src/app.ts`: markers and `text(...)` calls, every access form. */
function appM(dot: string, seg: string): string {
  return [
    'import CORE, { text } from "../specs/Core.xspec";',
    "",
    `CORE.top${dot};`,
    `CORE.top${dot}["kid-x"];`,
    `CORE.top['${seg}'];`,
    `CORE['top']${dot};`,
    `text(CORE.top["${seg}"]);`,
    `text(CORE.top['${seg}']["kid-x"]);`,
    "",
  ].join("\n");
}

const OTHER_MDX_M = [
  'import Core from "./Core.xspec"',
  "",
  "<S id=\"unrelated\" d={[Core.top.res, Core['top']['res']]}>",
  "Unrelated: {text(Core.top[\"res\"])} and {text('unrelated.sub')}",
  "",
  "<S id='unrelated.sub'>",
  "Sub text.",
  "</S>",
  "</S>",
  "",
].join("\n");

const OTHER_TS_M = [
  'import CORE, { text } from "../specs/Core.xspec";',
  "",
  "CORE.top.res;",
  "text(CORE['top'].res);",
  "",
].join("\n");

/**
 * One T6.4-2 arm: stage, build, rename, then byte-compare every staged file
 * against its composed expectation — the rewritten files against their
 * post-rename composition, the untouched ones against their staged bytes.
 */
async function runMinimalEditArm(
  product: ProductBinding,
  oldId: string,
  newId: string,
  sources: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>>,
  context: string,
): Promise<void> {
  await withWorkspace(SPEC_AND_CODE_CONFIG, sources, async (workspace) => {
    await buildOk(product, workspace, `${context}: \`build\``);
    await expectExit(
      product,
      workspace,
      ["rename", "specs/Core.mdx", oldId, newId],
      0,
      `${context}: \`rename specs/Core.mdx ${oldId} ${newId}\``,
    );
    for (const [rel, bytes] of Object.entries(expected)) {
      const touched = bytes !== sources[rel];
      await assertFileBytes(
        workspace.path(rel),
        bytes,
        `${context}: ${rel} after the rename — ` +
          (touched
            ? `the rewritten file must differ from its original in the ` +
              `rewritten segments alone: rewrites are minimal in-place edits ` +
              `keeping each reference's quote style and access form, and each ` +
              `\`id\` attribute's quotes, wherever the new name admits them ` +
              `(dot stays dot, computed stays computed in its own quote kind, ` +
              `a string literal keeps its quotes); only a dot-access segment ` +
              `whose new name is not a TS identifier falls back to ` +
              `double-quoted computed access (SPEC 6.4, 2.4, 2.7; H-4)`
            : `a file holding no reference to an affected identity must come ` +
              `through byte-identical (SPEC 6.4: only the affected parts ` +
              `change)`),
      );
    }
  });
}

const T6_4_2 = defineProductTest({
  id: "T6.4-2",
  title:
    "minimal edits: quote style (single vs double) and access form (dot vs computed) of untouched reference parts are preserved byte-wise and only the affected parts change; the rewritten segment keeps every keepable form — a computed segment stays computed in its own quote kind whether or not the new name is a TS identifier, dot stays dot for an identifier-valid name, single-quoted local strings and single-quoted `id` attributes keep their quotes — and only a dot segment whose new name is not a TS identifier becomes double-quoted computed access; every rewritten `.mdx` and `.ts` file is byte-equal to its composed expectation and untouched files stay byte-identical (SPEC 6.4, 2.4, 2.7)",
  run: async (product) => {
    const stagedL = {
      "specs/Core.mdx": coreL("login-v2"),
      "specs/Refs.mdx": refsL("login-v2"),
      "specs/Other.mdx": OTHER_MDX_L,
      "src/app.ts": appL("login-v2"),
      "src/other.ts": OTHER_TS_L,
    };
    const expectedL = (seg: string) => ({
      "specs/Core.mdx": coreL(seg),
      "specs/Refs.mdx": refsL(seg),
      "specs/Other.mdx": OTHER_MDX_L,
      "src/app.ts": appL(seg),
      "src/other.ts": OTHER_TS_L,
    });

    // Arm 1: computed segment → identifier-valid name; forms kept.
    await runMinimalEditArm(
      product,
      "login-v2",
      "login2",
      stagedL,
      expectedL("login2"),
      "T6.4-2 arm 1 (login-v2 → login2: computed and single-quoted forms kept)",
    );

    // Arm 2: computed segment → non-identifier name; forms kept.
    await runMinimalEditArm(
      product,
      "login-v2",
      "login-v3",
      stagedL,
      expectedL("login-v3"),
      "T6.4-2 arm 2 (login-v2 → login-v3: computed and single-quoted forms kept)",
    );

    const stagedM = {
      "specs/Core.mdx": coreM("mid"),
      "specs/Refs.mdx": refsM(".mid", "mid"),
      "specs/Other.mdx": OTHER_MDX_M,
      "src/app.ts": appM(".mid", "mid"),
      "src/other.ts": OTHER_TS_M,
    };
    const expectedM = (dot: string, seg: string) => ({
      "specs/Core.mdx": coreM(seg),
      "specs/Refs.mdx": refsM(dot, seg),
      "specs/Other.mdx": OTHER_MDX_M,
      "src/app.ts": appM(dot, seg),
      "src/other.ts": OTHER_TS_M,
    });

    // Arm 3: dot segment → identifier-valid name; dot stays dot.
    await runMinimalEditArm(
      product,
      "top.mid",
      "top.neo",
      stagedM,
      expectedM(".neo", "neo"),
      "T6.4-2 arm 3 (top.mid → top.neo: dot stays dot, computed keeps quotes)",
    );

    // Arm 4: dot segment → non-identifier name; the double-quoted computed
    // fallback for dot access alone, every computed segment keeping its quotes.
    await runMinimalEditArm(
      product,
      "top.mid",
      "top.neo-2",
      stagedM,
      expectedM('["neo-2"]', "neo-2"),
      "T6.4-2 arm 4 (top.mid → top.neo-2: dot falls back to double-quoted computed access, computed keeps quotes)",
    );
  },
});
// ---------------------------------------------------------------------------
// T6.4-3 — validation refusals (exit 1, nothing modified)
// ---------------------------------------------------------------------------

// A valid workspace whose staged IDs isolate each refusal cause: `a.then`
// fails only 1.4 (forbidden name), `a.mi d` only 1.4 (whitespace), `a.mid`
// only the differs-from-old check, `a.sib` only the collision check, `x.mid`
// and `b.c` only the structural parent rules. The remaining 6.4 clause — all
// rewritten references resolve — admits no discriminating fixture (TEST-SPEC
// T6.4-3) and is exercised as the always-passing side of T6.4-1.
const V3_FILE = "specs/A.mdx";
const V3_SOURCE = [
  '<S id="a">',
  "Holder text.",
  "",
  '<S id="a.mid">',
  "Mid text.",
  "",
  '<S id="a.mid.kid">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
  '<S id="a.sib">',
  "Sib text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// The remaining colliding bearer's whole construct within V3_SOURCE — the
// refused-id-collision arm's location window (SPEC 14: the collision locates
// every colliding bearer, the remaining `a.sib` bearer included): any
// in-construct precision passes; a location attributed to another construct
// fails.
const V3_SIB_CONSTRUCT = '<S id="a.sib">\nSib text.\n</S>';
const V3_SIB_WINDOW = byteWindow(
  V3_SOURCE.slice(0, V3_SOURCE.indexOf(V3_SIB_CONSTRUCT)),
  V3_SIB_CONSTRUCT,
);

/**
 * One T6.4-3 refusal case: the full rename argv (without `--json`), the one
 * refusal finding the staging isolates (SPEC 14), and its diagnosis context.
 */
export interface RenameRefusalCase {
  readonly argv: readonly string[];
  readonly expected: RefusalExpectation;
  readonly reason: string;
}

/**
 * T6.4-3's staging and complete refusal-case table, exported so T6.6-3 can
 * stage each refusal identically and assert the `--preview` invocation's
 * refusal equivalence over it (TEST-SPEC §6.6: "for each refusal of T6.4-3
 * and T6.5-4 — the invalid-workspace precondition included — staged
 * identically"). Each case's argv runs against a fresh RENAME_REFUSAL_CONFIG
 * + RENAME_REFUSAL_FILES workspace after a premise `build` (the T6.4-3
 * protocol: derived files sit under the modifies-nothing compares).
 */
export const RENAME_REFUSAL_CONFIG = SPECS_ONLY_CONFIG;
export const RENAME_REFUSAL_FILES: Readonly<Record<string, string>> = {
  [V3_FILE]: V3_SOURCE,
};

// Each arm's expected refusal finding (SPEC 14): the exact stable code, with
// the concerned identity (`refused-invalid-id` and `refused-structural-parent`
// concern the offending identity; `refused-identity-unchanged` concerns the
// unchanged one) or the located remaining colliding bearer
// (`refused-id-collision` locates every colliding bearer). The final case is
// the top-level structural arm: a top-level section's ID is checked against
// the empty prefix — exactly one segment (SPEC 1.3).
export const RENAME_REFUSAL_CASES: readonly RenameRefusalCase[] = [
  {
    argv: ["rename", V3_FILE, "a.mid", "a.then"],
    expected: {
      finding: "refused-invalid-id",
      identity: { file: V3_FILE, id: "a.then" },
    },
    reason: "new ID invalid per 1.4 — its segment is the forbidden name `then`",
  },
  {
    argv: ["rename", V3_FILE, "a.mid", "a.mi d"],
    expected: {
      finding: "refused-invalid-id",
      identity: { file: V3_FILE, id: "a.mi d" },
    },
    reason: "new ID invalid per 1.4 — its segment contains whitespace",
  },
  {
    argv: ["rename", V3_FILE, "a.mid", "a.mid"],
    expected: {
      finding: "refused-identity-unchanged",
      identity: { file: V3_FILE, id: "a.mid" },
    },
    reason: "new ID equal to the old ID",
  },
  {
    argv: ["rename", V3_FILE, "a.mid", "a.sib"],
    expected: {
      finding: "refused-id-collision",
      locatedAt: { file: V3_FILE, window: V3_SIB_WINDOW },
    },
    reason: "new ID colliding with an existing ID in the file",
  },
  {
    argv: ["rename", V3_FILE, "a.mid", "x.mid"],
    expected: {
      finding: "refused-structural-parent",
      identity: { file: V3_FILE, id: "x.mid" },
    },
    reason:
      "new ID violating the structural parent rules — the node is nested " +
      "inside `a`, so its ID must be `a` plus one segment (1.3)",
  },
  {
    argv: ["rename", V3_FILE, "a", "b.c"],
    expected: {
      finding: "refused-structural-parent",
      identity: { file: V3_FILE, id: "b.c" },
    },
    reason:
      "new ID violating the structural parent rules — a top-level section's " +
      "ID has exactly one segment (1.3)",
  },
];

const T6_4_3 = defineProductTest({
  id: "T6.4-3",
  title:
    "validation refusals (exit 1): a new ID that is invalid (1.4), equal to the old ID, colliding with an existing ID, or violating structural parent rules each refuses the rename and modifies nothing (workspace byte-compare) — each refusal reported as the form-exact 12.7 findings-only report holding exactly one finding with its exact stable refusal code (refused-invalid-id, refused-identity-unchanged, refused-id-collision, refused-structural-parent) and the concerned identity or located colliding bearer (SPEC 6.4, 1.4, 1.3, 12.0, 12.7, 14)",
  run: async (product) => {
    await withWorkspace(
      RENAME_REFUSAL_CONFIG,
      RENAME_REFUSAL_FILES,
      async (workspace) => {
        // Build first, so the modifies-nothing compares include intact
        // derived files (module header, H-4).
        await buildOk(
          product,
          workspace,
          "T6.4-3 `build` over the staged workspace",
        );
        // The complete case table (module scope, shared with T6.6-3's
        // preview-refusal equivalence — TEST-SPEC §6.6 "staged identically").
        for (const { argv, expected, reason } of RENAME_REFUSAL_CASES) {
          await expectRefusalModifiesNothing(
            product,
            workspace,
            argv,
            expected,
            `T6.4-3 (${reason})`,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.4-4 — usage errors (exit 2) and unparseable-origin masking
// ---------------------------------------------------------------------------

const U4_FILE = "specs/A.mdx";
const U4_SOURCE = [
  '<S id="a">',
  "Alpha text.",
  "",
  '<S id="a.mid">',
  "Mid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// The ordering arm's unrelated validation error: an unresolved local `d`
// reference (14.5) in a file untouched by the rename arguments.
const U4_BAD_FILE = "specs/Bad.mdx";
const U4_BAD_SOURCE = [
  '<S id="bad" d={"nope"}>',
  "Bad text depending on nothing that exists.",
  "</S>",
  "",
].join("\n");

// The masking arm's unparseable origin file: an unclosed section tag (14.20).
const U4_BROKEN_FILE = "specs/Broken.mdx";
const U4_BROKEN_SOURCE = [
  '<S id="broken">',
  "Text that never closes.",
  "",
].join("\n");

// The wrong-kind arm's discovered code source (SPEC 7.2): valid TypeScript
// with no spec references, so the base arm's workspace still builds clean —
// a code source bears no requirement IDs, making it a wrong-kind `<file>`
// operand (SPEC 6.4).
const U4_CODE_FILE = "src/app.ts";
const U4_CODE_SOURCE = "export function noop(): void {}\n";

// Parse-local existence fixtures (SPEC 6.4, 11.2). Two sections both
// spelling the same ID: every bearer's node identity is undefined (11.2,
// duplicate spellings), yet each spells `dup`, so the old ID exists and the
// duplicate-ID finding (14.3) refuses instead of any usage error.
const U4_DUP_FILE = "specs/Dup.mdx";
const U4_DUP_SOURCE = [
  '<S id="dup">',
  "First bearer text.",
  "</S>",
  "",
  '<S id="dup">',
  "Second bearer text.",
  "</S>",
  "",
].join("\n");

// A sole bearer spelling its ID beneath an ancestor spelling no identity —
// no `id` attribute at all (14.1): the bearer's node identity is undefined
// through the ancestor chain (11.2), yet it spells `kid`, so the old ID
// exists and the ancestor's finding refuses. The bearer's own structural
// check (14.2) is masked by the parent's condition (SPEC 14 condition 2), so
// the workspace's findings are exactly the one 14.1.
const U4_ANC_FILE = "specs/Anc.mdx";
const U4_ANC_SOURCE = [
  "<S>",
  "Ancestor text spelling no identity.",
  "",
  '<S id="kid">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// The old ID's only would-be bearer spells no identity — its `id` attribute
// repeated on the tag (11.2; condition 17, never 14.1) — so the old ID is
// nonexistent: exit 2 even beside that file's findings.
const U4_SOLO_FILE = "specs/Solo.mdx";
const U4_SOLO_SOURCE = [
  '<S id="solo" id="solo">',
  "Sole would-be bearer text.",
  "</S>",
  "",
].join("\n");

/**
 * T6.4-4's usage-error invocations over the shared U4 staging (exit 2,
 * checked before source validation), exported so T6.6-3 can assert each
 * `--preview` variant exits 2 identically (TEST-SPEC §6.6: "for the usage
 * errors of T6.4-4/T6.5-5 the preview exits 2 identically — argument checks
 * precede either way"). They ride T6.4-4's base arm (valid workspace) and
 * ordering arm (unrelated validation errors present) alike.
 */
export const RENAME_USAGE_CASES: readonly (readonly [
  readonly string[],
  string,
])[] = [
  [["rename", "specs/Missing.mdx", "a", "a2"], "nonexistent <file>"],
  [["rename", U4_FILE, "nope", "nope2"], "nonexistent old ID"],
  [
    ["rename", U4_CODE_FILE, "a", "a2"],
    "discovered code source as <file> — a code source bears no requirement " +
      "IDs, so a code-source origin is a wrong-kind operand, judged like " +
      "existence before any content question (SPEC 6.4, 12.0)",
  ],
];

/** The ordering arm's staging (valid sources + a failing file + the code
 * source), exported for T6.6-3: on it, exit 2 beside unrelated validation
 * errors realizes "argument checks precede" — previewed or not. */
export const RENAME_USAGE_CONFIG = SPEC_AND_CODE_CONFIG;
export const RENAME_USAGE_ORDERING_FILES: Readonly<Record<string, string>> = {
  [U4_FILE]: U4_SOURCE,
  [U4_BAD_FILE]: U4_BAD_SOURCE,
  [U4_CODE_FILE]: U4_CODE_SOURCE,
};

/**
 * T6.4-4's parse-local nonexistence staging (the sole would-be bearer spells
 * no identity — its `id` attribute repeated): the rename is exit 2 even
 * beside that file's findings. Exported for T6.6-3's preview variant; stage
 * under RENAME_REFUSAL_CONFIG (the same specs-only configuration) and pin
 * the one-14.17 premise before invoking.
 */
export const RENAME_SOLO_FILES: Readonly<Record<string, string>> = {
  [U4_SOLO_FILE]: U4_SOLO_SOURCE,
};
export const RENAME_SOLO_ARGV: readonly string[] = [
  "rename",
  U4_SOLO_FILE,
  "solo",
  "solo2",
];

const T6_4_4 = defineProductTest({
  id: "T6.4-4",
  title:
    "usage errors (exit 2): a nonexistent `<file>`, a nonexistent old ID, and a discovered code source as `<file>` — a wrong-kind operand, judged like existence before any content question — are usage errors checked before source validation, the same exit 2 even when the workspace also has unrelated validation errors (12.0 ordering); an old ID inside an unparseable origin file is masked — the validation findings are reported and the command exits 1; and old-ID existence is parse-local over spelled identities: an ID two sections both spell, or one whose sole bearer spells it beneath an ancestor spelling no identity, exists — the duplicate-ID or ancestor finding refuses instead (exit 1, never exit 2) — while an old ID whose only would-be bearer spells no identity (its `id` attribute repeated on the tag) is nonexistent, exit 2 even beside that file's findings (SPEC 6.4, 11.2, 12.0, 14, 14.20)",
  run: async (product) => {
    // --- Base arm: a valid workspace ---
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      { [U4_FILE]: U4_SOURCE, [U4_CODE_FILE]: U4_CODE_SOURCE },
      async (workspace) => {
        const context = "T6.4-4 valid-workspace arm";
        await buildOk(product, workspace, `${context}: \`build\``);
        for (const [argv, label] of RENAME_USAGE_CASES) {
          await expectRenameUsageError(
            product,
            workspace,
            argv,
            `${context}, ${label}`,
          );
        }
      },
    );

    // --- Ordering arm: the workspace also fails build validation ---
    await withWorkspace(
      RENAME_USAGE_CONFIG,
      RENAME_USAGE_ORDERING_FILES,
      async (workspace) => {
        const context = "T6.4-4 ordering arm";
        // Staging premise: the workspace really fails build validation, so
        // the exit-2/empty-stdout observations below discriminate — a
        // product that validates sources before the argument existence
        // checks exits 1 with these findings instead.
        const findings = await buildFindings(
          product,
          workspace,
          `${context}: \`build --json\` premise — the staged workspace fails ` +
            `build validation (unresolved d reference, SPEC 14.5)`,
        );
        if (findings.length === 0) {
          fail(
            `${context}: staging premise — the failing \`build\` must report ` +
              `at least one validation finding (SPEC 14)`,
          );
        }
        for (const [argv, label] of RENAME_USAGE_CASES) {
          await expectRenameUsageError(
            product,
            workspace,
            argv,
            `${context}, ${label}, with unrelated validation errors present ` +
              `— the existence and wrong-kind checks precede source ` +
              `validation (SPEC 6.4, 12.0)`,
          );
        }
      },
    );

    // --- Masking arm: the old ID lives inside an unparseable origin file ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [U4_FILE]: U4_SOURCE, [U4_BROKEN_FILE]: U4_BROKEN_SOURCE },
      async (workspace) => {
        const context = "T6.4-4 masking arm";
        const command = `rename ${U4_BROKEN_FILE} broken broken2 --json`;
        const result = await expectExit(
          product,
          workspace,
          ["rename", U4_BROKEN_FILE, "broken", "broken2", "--json"],
          1,
          `${context}: \`${command}\` — an old ID inside an unparseable ` +
            `origin file (14.20) is masked: the validation findings are ` +
            `reported and the command exits 1, not 2 (SPEC 6.4, 12.0, 14)`,
        );
        const findings = decodeFindingsReport(
          parseJsonStdout(result, `${context}: \`${command}\``),
          `${context}: \`${command}\``,
        ).findings;
        assertConditionCounts(
          findings,
          { "14.20": 1 },
          `${context}: the reported findings are exactly the workspace's one ` +
            `unparseable-source condition (SPEC 14.20; the unparseable file ` +
            `masks the conditions inside itself, SPEC 14)`,
        );
        assertFindingLocated(
          findings[0]!,
          { file: U4_BROKEN_FILE },
          `${context}: the 14.20 finding identifies the unparseable origin ` +
            `file and the location of the parse failure (SPEC 14, 14.20)`,
        );
      },
    );

    // --- Parse-local existence: duplicate spellings still establish it ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [U4_DUP_FILE]: U4_DUP_SOURCE },
      async (workspace) => {
        // Renaming an ID two sections both spell is no usage error: the
        // bearers establish existence, their undefined node identities
        // notwithstanding (SPEC 6.4, 11.2), and the duplicate-ID finding
        // refuses instead — the invalid-workspace refusal, exit 1,
        // reporting the workspace's numbered findings alone: exactly one
        // 14.3 finding (duplicate identities are one finding locating every
        // bearer, SPEC 14), nothing modified.
        await expectRefusalModifiesNothing(
          product,
          workspace,
          ["rename", U4_DUP_FILE, "dup", "dup2"],
          { finding: "14.3", locatedAt: { file: U4_DUP_FILE } },
          "T6.4-4 parse-local existence, duplicate spellings (renaming an " +
            "ID two sections both spell is no usage error — the " +
            "duplicate-ID finding refuses instead: exit 1, never exit 2; " +
            "SPEC 6.4, 11.2, 14)",
        );
      },
    );

    // --- Parse-local existence: an undefined ancestor chain still
    // establishes it ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [U4_ANC_FILE]: U4_ANC_SOURCE },
      async (workspace) => {
        // The sole bearer spells `kid` beneath an ancestor spelling no
        // identity (no `id` attribute): the bearer establishes existence —
        // its undefined ancestor chain notwithstanding (SPEC 6.4, 11.2) —
        // and the ancestor's finding refuses: exit 1 with exactly the one
        // 14.1 finding (the bearer's structural check is masked by the
        // parent's condition, SPEC 14 condition 2), never exit 2.
        await expectRefusalModifiesNothing(
          product,
          workspace,
          ["rename", U4_ANC_FILE, "kid", "kid2"],
          { finding: "14.1", locatedAt: { file: U4_ANC_FILE } },
          "T6.4-4 parse-local existence, sole bearer beneath an ancestor " +
            "spelling no identity (the bearer establishes existence and " +
            "the ancestor's missing-id finding refuses: exit 1, never " +
            "exit 2; SPEC 6.4, 11.2, 14)",
        );
      },
    );

    // --- Parse-local nonexistence: a would-be bearer spelling no
    // identity ---
    await withWorkspace(
      RENAME_REFUSAL_CONFIG,
      RENAME_SOLO_FILES,
      async (workspace) => {
        const context = "T6.4-4 spells-no-identity arm";
        // Staging premise: the repeated-`id` bearer leaves the file with
        // exactly one 14.17 finding — a repeated prop is condition 17,
        // never 14.1, spells no identity, and has no children whose masked
        // 14.2 could add findings (SPEC 11.2, 14). Pinning the premise
        // makes the exit-2 assertion below demonstrably run beside that
        // file's findings: a product that takes a repeated-`id` value as
        // spelled, or that reports the file's findings in the old ID's
        // place, exits 1 here instead.
        const findings = await buildFindings(
          product,
          workspace,
          `${context}: \`build --json\` premise — the staged workspace ` +
            `fails build validation (repeated \`id\` attribute, SPEC 14.17)`,
        );
        assertConditionCounts(
          findings,
          { "14.17": 1 },
          `${context}: staging premise — the repeated-\`id\` bearer is the ` +
            `file's one finding (SPEC 14: a repeated prop is condition 17, ` +
            `never condition 1)`,
        );
        await expectRenameUsageError(
          product,
          workspace,
          RENAME_SOLO_ARGV,
          `${context}: an old ID whose only would-be bearer spells no ` +
            `identity (its \`id\` attribute repeated on the tag) is ` +
            `nonexistent — exit 2 even beside that file's findings ` +
            `(SPEC 6.4, 11.2, 12.0)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.4-5 — type-level references
// ---------------------------------------------------------------------------

const T5_CORE = "specs/Core.mdx";
const T5_CORE_SOURCE = [
  '<S id="core">',
  "Core text.",
  "",
  '<S id="core.mid">',
  "Mid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// One code file bearing a value-level marker (rewritten, 6.4) and a
// `typeof`-level reference to the same node (not rewritten, 4.5) — the
// contrast within one file discriminates a product that rewrites type-level
// chains from one that skips the file entirely (whose stale marker would then
// fail T6.4-1-style rewriting and the `check` below).
const T5_APP = "src/app.ts";
const T5_APP_BEFORE = [
  'import CORE from "../specs/Core.xspec";',
  "",
  "CORE.core.mid;",
  "type MidNode = typeof CORE.core.mid;",
  "",
].join("\n");
const T5_APP_AFTER = [
  'import CORE from "../specs/Core.xspec";',
  "",
  "CORE.core.hub;",
  "type MidNode = typeof CORE.core.mid;",
  "",
].join("\n");

const T6_4_5 = defineProductTest({
  id: "T6.4-5",
  title:
    "type-level references: a `typeof`-level reference to the old identity is not rewritten by rename, and the workspace stays xspec-valid — the consumer type error is outside xspec's validations, so `build` and `check` report no finding for it (SPEC 6.4, 4.5)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      { [T5_CORE]: T5_CORE_SOURCE, [T5_APP]: T5_APP_BEFORE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.4-5 `build` over the staged workspace",
        );
        await expectExit(
          product,
          workspace,
          ["rename", T5_CORE, "core.mid", "core.hub"],
          0,
          "T6.4-5 `rename specs/Core.mdx core.mid core.hub`",
        );
        await assertFileBytes(
          workspace.path(T5_APP),
          T5_APP_AFTER,
          "T6.4-5: the code file after the rename — the value-level marker is " +
            "rewritten to the new identity while the `typeof`-level reference " +
            "keeps naming the vacated identity byte-for-byte: type-level " +
            "references record no edges and are not rewritten (SPEC 6.4, 4.5)",
        );
        // The workspace stays xspec-valid: neither `build` nor `check`
        // reports any finding for the type-level reference to the vacated
        // identity (SPEC 6.4: a consumer type error outside xspec's
        // validations; 4.5: type-level references are unrestricted).
        await buildOk(
          product,
          workspace,
          "T6.4-5 `build` after the rename — no finding for the type-level " +
            "reference to the vacated identity",
        );
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T6.4-5 `check` after the rename — no finding for the type-level " +
            "reference to the vacated identity (SPEC 6.4, 4.5, 12.2)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.4-6 — valid-workspace precondition
// ---------------------------------------------------------------------------

const P6_FILE = "specs/A.mdx";
const P6_SOURCE = [
  '<S id="a">',
  "Holder text.",
  "",
  '<S id="a.mid">',
  "Mid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// Valid at staging (so the pre-refusal `build` succeeds and leaves derived
// files in the snapshot), then overwritten with an unresolved local `d`
// reference (14.5) — the pre-existing validation error elsewhere.
const P6_OTHER_FILE = "specs/Other.mdx";
const P6_OTHER_VALID = ['<S id="oth">', "Other text.", "</S>", ""].join("\n");
const P6_OTHER_INVALID = [
  '<S id="oth" d={"nope"}>',
  "Other text.",
  "</S>",
  "",
].join("\n");

const T6_4_6 = defineProductTest({
  id: "T6.4-6",
  title:
    "valid-workspace precondition: with a pre-existing validation error elsewhere, rename refuses (exit 1) before modifying anything — the rename's own arguments are valid, so the refusal is the 6.4 precondition that rename only ever rewrites a valid workspace, and it reports the workspace's numbered findings alone: exactly the one located 14.5 finding, no refusal reason beside it (SPEC 6.4, 12.1, 14)",
  run: async (product) => {
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [P6_FILE]: P6_SOURCE, [P6_OTHER_FILE]: P6_OTHER_VALID },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.4-6 `build` over the staged workspace",
        );
        // Introduce the pre-existing validation error elsewhere; the rename
        // subject and its file stay untouched and its arguments valid.
        await workspace.file(P6_OTHER_FILE, P6_OTHER_INVALID);
        // The invalid-workspace refusal reports the workspace's findings
        // themselves — exactly the one 14.5 finding located in the offending
        // file, no refusal reason evaluated or reported beside it (SPEC 6.4,
        // 14).
        await expectRefusalModifiesNothing(
          product,
          workspace,
          ["rename", P6_FILE, "a.mid", "a.hub"],
          { finding: "14.5", locatedAt: { file: P6_OTHER_FILE } },
          "T6.4-6 (the workspace fails the validations of `xspec build` — an " +
            "unresolved d reference in specs/Other.mdx, SPEC 14.5 — so the " +
            "rename refuses before modifying anything: no source rewrite, no " +
            "journal entry, no derived-file change)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.4-7 — finishing regeneration
// ---------------------------------------------------------------------------

const F7_CORE = "specs/Core.mdx";
const F7_REFS = "specs/Refs.mdx";
const F7_APP = "src/app.ts";

const F7_CORE_SOURCE = [
  '<S id="core">',
  "Core holder text.",
  "",
  '<S id="core.mid">',
  "Mid text.",
  "",
  '<S id="core.mid.leaf">',
  "Leaf text.",
  "</S>",
  "</S>",
  "",
  '<S id="core.sib" d={"core.mid"}>',
  'Sib embeds: {text("core.mid.leaf")}',
  "</S>",
  "</S>",
  "",
].join("\n");

const F7_REFS_SOURCE = [
  'import Core from "./Core.xspec"',
  "",
  '<S id="refs" d={Core.core.mid}>',
  "Refs embeds: {text(Core.core.mid.leaf)}",
  "</S>",
  "",
].join("\n");

const F7_APP_SOURCE = [
  'import CORE, { text } from "../specs/Core.xspec";',
  "",
  "CORE.core.mid.leaf;",
  "text(CORE.core.mid);",
  "",
].join("\n");

// The non-derived workspace state seeded into the fresh-build directory: the
// configuration, every source file (their post-rename bytes), and the journal
// (derived files are reproducible from sources, configuration, and the
// journal, SPEC 13.4).
const F7_SEED_FILES = [
  "xspec.config.ts",
  F7_CORE,
  F7_REFS,
  F7_APP,
  JOURNAL_PATH,
] as const;

const T6_4_7 = defineProductTest({
  id: "T6.4-7",
  title:
    "finishing regeneration: after a successful rename, generated modules, Markdown output, and graph data are byte-identical to a fresh `build` of the rewritten sources (two-directory whole-tree compare), and `check` immediately after reports no staleness (SPEC 6.4, 12.1, 13.1–13.4, 14.10)",
  run: async (product) => {
    await withWorkspace(
      FULL_CONFIG,
      {
        [F7_CORE]: F7_CORE_SOURCE,
        [F7_REFS]: F7_REFS_SOURCE,
        [F7_APP]: F7_APP_SOURCE,
      },
      async (renamed) => {
        await buildOk(
          product,
          renamed,
          "T6.4-7 `build` over the staged workspace",
        );
        await expectExit(
          product,
          renamed,
          ["rename", F7_CORE, "core.mid", "core.hub"],
          0,
          "T6.4-7 `rename specs/Core.mdx core.mid core.hub`",
        );
        // `check` immediately after the rename: exit 0 — in particular no
        // stale-output finding (14.10): the finishing regeneration left
        // generated modules, Markdown output, and graph data matching the
        // rewritten sources (SPEC 6.4, 12.2).
        await expectExit(
          product,
          renamed,
          ["check"],
          0,
          "T6.4-7 `check` immediately after the rename — no staleness (14.10), " +
            "no other finding",
        );

        // Fresh-build comparison (H-6 two-directory protocol): seed a second
        // workspace with the rewritten sources, configuration, and journal;
        // `build`; compare the whole roots byte-for-byte.
        const fresh = await TestWorkspace.create();
        try {
          for (const rel of F7_SEED_FILES) {
            const kind = await renamed.kind(rel);
            if (kind !== "file") {
              fail(
                `T6.4-7: expected ${rel} as a plain file in the renamed ` +
                  `workspace to seed the fresh-build directory (SPEC 6.4, ` +
                  `6.1, 13.4); found ${kind}`,
              );
            }
            await fresh.file(rel, await renamed.readBytes(rel));
          }
          await buildOk(
            product,
            fresh,
            "T6.4-7 fresh `build` over the rewritten sources",
          );
          await assertDirectoriesEqual(
            renamed.root,
            fresh.root,
            "T6.4-7: the renamed workspace vs a fresh `build` of the " +
              "rewritten sources — generated modules, Markdown output, and " +
              "graph data must be byte-identical (SPEC 6.4: a successful " +
              "rename finishes by regenerating derived files exactly as " +
              "`xspec build` does; 12.0 determinism; H-4/H-6, normalizing " +
              "nothing)",
          );
        } finally {
          await fresh.dispose();
        }
      },
    );
  },
});

/** TEST-SPEC §6.4, in canonical ID order (SUITE-24). */
export const section64Tests: readonly ProductTestEntry[] = [
  T6_4_1,
  T6_4_2,
  T6_4_3,
  T6_4_4,
  T6_4_5,
  T6_4_6,
  T6_4_7,
];
