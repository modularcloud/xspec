// TEST-SPEC §1.5 (node identity) — SUITE-04: T1.5-1, T1.5-2, T1.5-3.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5) and exact bytes where SPEC.md fixes bytes
// (H-4), decodes output through the H-3 adapters, and rejects a product only
// via diagnosed assertion failures (H-8).
//
// - T1.5-1 runs every identity-bearing command (`query`, `show`, `ids`,
//   `coverage`, `impact`) twice — from the workspace root and from a nested
//   directory — byte-compares the outputs, and asserts the identities decoded
//   from them are exactly the workspace-relative, `/`-separated identities of
//   SPEC 1.5 (a nested `specs/sub/` path keeps the separator at stake). The
//   coverage profile uses `targets: "all"` so the roots' only exclusion
//   reason is `root node` (SPEC 8.1/8.2) — the leaves-mode reason wording is
//   T8's business, not this test's. T1.5-1 and T1.5-3 rerun on the Windows
//   leg via CI-01 (the registry entries are shared; TEST-SPEC E-6).
// - T1.5-2's non-UTF-8 arm is staged on the Linux leg per its TEST-SPEC text
//   ("where file names are byte strings"): other platforms' filesystems
//   refuse such names outright, so the arm runs exactly where the fixture is
//   realizable; its finding's concerned path is the marked byte form (SPEC
//   12.0, 12.7). The `#` arms and the U+FFFD-pathed arm run everywhere: the
//   latter stages specs/A<U+FFFD>.mdx (the spelling shared with T11.5-3
//   through support.ts; valid UTF-8, so a name every platform holds) and
//   pins its finding's concerned path as the plain string form, never the
//   byte form (SPEC 12.0: a U+FFFD path has a plain string form). That the
//   file is reachable by glob through `view` and nameable by no argument is
//   T11.5-3's business (T11.2-3's discipline).
// - T1.5-3 exercises the `path#id` vs bare `path` addressing duality across
//   `query node`, `show`, and `rename`/`move` arguments; sections and roots
//   carry distinct byte-anchored texts so the two address forms are
//   discriminated by content, not just by echoed identity.

import { Buffer } from "node:buffer";
import type { Finding } from "../../helpers/adapters/index.js";
import {
  assertReportMentions,
  classifyIgnoredReasons,
  decodeCoverageReport,
  decodeIdsReport,
  decodeImpactReport,
  decodeNodeReport,
  decodeNodeRowsReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertSameJson,
  buildFindings,
  buildOk,
  expectExit,
  REPLACEMENT_CHARACTER_SPEC_PATH,
  runJson,
  sortedIdentities,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// ---------------------------------------------------------------------------
// T1.5-1
// ---------------------------------------------------------------------------

// One spec group plus a coverage profile so `coverage` has identities to
// report. `targets: "all"` keeps the roots' exclusion reasons at exactly
// `root node` (SPEC 8.1/8.2; see the module header).
const IDENTITY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      targets: "all",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

const IDENTITY_A_SOURCE = [
  '<S id="alpha" d={["beta"]}>',
  "Alpha depends on beta.",
  "</S>",
  "",
  '<S id="beta">',
  "Beta text.",
  "</S>",
  "",
].join("\n");

const IDENTITY_B_BASELINE = [
  '<S id="gamma">',
  "Gamma original text.",
  "</S>",
  "",
].join("\n");

const IDENTITY_B_EDITED = [
  '<S id="gamma">',
  "Gamma edited text.",
  "</S>",
  "",
].join("\n");

// The staged workspace's identities, in the exact form SPEC 1.5 fixes:
// workspace-relative, `/`-separated (the nested `specs/sub/` path keeps the
// separator at stake), `#` joining path and ID, bare path for a root.
const A_ROOT = "specs/A.mdx";
const ALPHA = "specs/A.mdx#alpha";
const BETA = "specs/A.mdx#beta";
const B_ROOT = "specs/sub/B.mdx";
const GAMMA = "specs/sub/B.mdx#gamma";
const KNOWN_IDENTITIES: readonly string[] = [
  A_ROOT,
  ALPHA,
  BETA,
  B_ROOT,
  GAMMA,
];

// The nested working directory for T1.5-1's second run of each command: a
// real subdirectory holding a source file, so a product reporting
// cwd-relative paths (`B.mdx`, `../A.mdx`) or native separators diverges.
const NESTED_DIR = "specs/sub";

/**
 * Run one command from the workspace root and again from the nested
 * directory: both must exit 0 with byte-identical stdout (T1.5-1's protocol —
 * identities in outputs are workspace-relative, independent of the working
 * directory; SPEC 1.5, 12.0). Returns the root run for decoding.
 */
async function runFromRootAndNested(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  const fromRoot = await runProduct(product, {
    cwd: workspace.root,
    argv,
  });
  assertExitCode(fromRoot, 0, `${context} (run from the workspace root)`);
  const fromNested = await runProduct(product, {
    cwd: workspace.path(NESTED_DIR),
    argv,
  });
  assertExitCode(
    fromNested,
    0,
    `${context} (run from the nested directory ${NESTED_DIR})`,
  );
  assertBytesEqual(
    fromNested.stdoutBytes,
    fromRoot.stdoutBytes,
    `${context}: stdout of the nested-directory run vs the workspace-root run — ` +
      `outputs are byte-identical regardless of the working directory, because ` +
      `identities are workspace-relative and /-separated (SPEC 1.5, 12.0)`,
  );
  return fromRoot;
}

/** Every reported identity must be one of the staged workspace's (SPEC 1.5). */
function assertKnownIdentities(
  identities: readonly string[],
  context: string,
): void {
  for (const identity of identities) {
    if (!KNOWN_IDENTITIES.includes(identity)) {
      fail(
        `${context}: reported identity ${JSON.stringify(identity)} is not one of the ` +
          `staged workspace's workspace-relative, /-separated identities (SPEC 1.5); ` +
          `expected one of ${JSON.stringify(KNOWN_IDENTITIES)}`,
      );
    }
  }
}

const T1_5_1 = defineProductTest({
  id: "T1.5-1",
  title:
    "identities in every output (query, show, ids, coverage, impact) are workspace-relative and /-separated, regardless of the working directory (SPEC 1.5, 12.0)",
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": IDENTITY_CONFIG,
        "specs/A.mdx": IDENTITY_A_SOURCE,
        "specs/sub/B.mdx": IDENTITY_B_BASELINE,
      },
    });
    try {
      // Baseline commit (sources only), then a leaf edit, so `impact --base`
      // has categories to attribute to identities (SPEC 5.6, 9).
      await workspace.gitInit();
      await workspace.gitCommitAll("baseline");
      await workspace.file("specs/sub/B.mdx", IDENTITY_B_EDITED);

      // `query node` (JSON-only surface, SPEC 11).
      const nodeLabel = `T1.5-1 \`query node ${GAMMA}\``;
      const gamma = decodeNodeReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["query", "node", GAMMA],
            nodeLabel,
          ),
          nodeLabel,
        ),
        nodeLabel,
      );
      if (gamma.identity !== GAMMA) {
        fail(
          `${nodeLabel}: expected the workspace-relative identity ${JSON.stringify(GAMMA)} ` +
            `(SPEC 1.5), got ${JSON.stringify(gamma.identity)}`,
        );
      }
      assertBytesEqual(
        gamma.subtreeText,
        "Gamma edited text.\n",
        `${nodeLabel}: subtree text reflects the current (edited) source`,
      );
      // Edge endpoints are identities too: the structural edge names the
      // nested root by its bare workspace-relative path (SPEC 1.5, 5.2).
      assertEdgeSetEqual(
        gamma.incomingEdges,
        [{ from: B_ROOT, to: GAMMA, kind: "contains" }],
        `${nodeLabel}: incoming edges name workspace-relative identities`,
      );

      // `query nodes`: every row's identity is a known workspace-relative
      // identity, and all three sections are present. (Whether roots appear
      // as rows is T11-2's business, not this test's.)
      const rowsLabel = "T1.5-1 `query nodes`";
      const rows = decodeNodeRowsReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["query", "nodes"],
            rowsLabel,
          ),
          rowsLabel,
        ),
        rowsLabel,
      );
      assertKnownIdentities(
        rows.map((row) => row.identity),
        rowsLabel,
      );
      for (const identity of [ALPHA, BETA, GAMMA]) {
        if (!rows.some((row) => row.identity === identity)) {
          fail(
            `${rowsLabel}: expected ${identity} among the reported rows; got ` +
              JSON.stringify(sortedIdentities(rows)),
          );
        }
      }

      // `show`, machine form: identity plus edges by kind (SPEC 12.4).
      const showLabel = `T1.5-1 \`show ${ALPHA} --json\``;
      const alpha = decodeNodeReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["show", ALPHA, "--json"],
            showLabel,
          ),
          showLabel,
        ),
        showLabel,
      );
      if (alpha.identity !== ALPHA) {
        fail(
          `${showLabel}: expected the workspace-relative identity ${JSON.stringify(ALPHA)} ` +
            `(SPEC 1.5), got ${JSON.stringify(alpha.identity)}`,
        );
      }
      assertEdgeSetEqual(
        alpha.outgoingEdges,
        [{ from: ALPHA, to: BETA, kind: "depends" }],
        `${showLabel}: outgoing edges name workspace-relative identities`,
      );
      assertEdgeSetEqual(
        alpha.incomingEdges,
        [{ from: A_ROOT, to: ALPHA, kind: "contains" }],
        `${showLabel}: incoming edges name workspace-relative identities`,
      );

      // `show`, human form: the identity and its edge target are required
      // information (SPEC 12.4) — robust matching, never exact wording (H-3).
      const showHumanLabel = `T1.5-1 \`show ${ALPHA}\` (human report)`;
      assertReportMentions(
        await runFromRootAndNested(
          product,
          workspace,
          ["show", ALPHA],
          showHumanLabel,
        ),
        [ALPHA, BETA],
        `${showHumanLabel}: identities appear in their workspace-relative form`,
      );

      // `ids`: files in byte order of workspace-relative path, IDs in
      // document order (SPEC 12.3) — fully pinned for this workspace.
      const idsLabel = "T1.5-1 `ids --json`";
      const ids = decodeIdsReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["ids", "--json"],
            idsLabel,
          ),
          idsLabel,
        ),
        idsLabel,
      );
      assertSameJson(
        ids.files,
        [
          { file: A_ROOT, ids: ["alpha", "beta"] },
          { file: B_ROOT, ids: ["gamma"] },
        ],
        `${idsLabel}: files listed by workspace-relative, /-separated path (SPEC 1.5, 12.3)`,
      );
      const idsHumanLabel = "T1.5-1 `ids` (human report)";
      assertReportMentions(
        await runFromRootAndNested(product, workspace, ["ids"], idsHumanLabel),
        [A_ROOT, B_ROOT, "alpha", "beta", "gamma"],
        `${idsHumanLabel}: files appear by workspace-relative path with their IDs`,
      );

      // `coverage`: covered/uncovered/ignored identities and the covering
      // path all carry workspace-relative identities (SPEC 8.2).
      const coverageLabel = "T1.5-1 `coverage --json`";
      const coverage = decodeCoverageReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["coverage", "--json"],
            coverageLabel,
          ),
          coverageLabel,
        ),
        coverageLabel,
      );
      if (
        coverage.profiles.length !== 1 ||
        coverage.profiles[0]!.name !== "p"
      ) {
        fail(
          `${coverageLabel}: expected exactly the one configured profile "p" (SPEC 8.2); got ` +
            JSON.stringify(coverage.profiles.map((profile) => profile.name)),
        );
      }
      const profile = coverage.profiles[0]!;
      assertSameJson(
        profile.counts,
        { required: 3, covered: 1, uncovered: 2, ignored: 2 },
        `${coverageLabel}: counts — required {alpha, beta, gamma}, covered {beta}, ` +
          `ignored the two roots (SPEC 8.1, 8.2)`,
      );
      assertSameJson(
        profile.covered,
        [{ identity: BETA, path: [ALPHA, BETA] }],
        `${coverageLabel}: the covered node and its covering path are workspace-relative identities`,
      );
      assertSameJson(
        [...profile.uncovered].sort(),
        [ALPHA, GAMMA],
        `${coverageLabel}: uncovered identities are workspace-relative and /-separated`,
      );
      assertSameJson(
        sortedIdentities(profile.ignored),
        [A_ROOT, B_ROOT],
        `${coverageLabel}: the ignored roots are identified by bare workspace-relative path (SPEC 1.5)`,
      );
      for (const ignored of profile.ignored) {
        // Reason spellings are output shape (SPEC 8.2 pins no wording):
        // classified onto their SPEC 8.2 identities through the coverage
        // adapter, as T8.2-1 and T1.2-3 do (H-3).
        assertSameJson(
          classifyIgnoredReasons(
            ignored.reasons,
            `${coverageLabel} ignored ${ignored.identity}`,
          ),
          ["root"],
          `${coverageLabel}: ${ignored.identity} exclusion reasons (targets: "all" — the root-node reason and nothing else, SPEC 8.2)`,
        );
      }
      const coverageHumanLabel = "T1.5-1 `coverage` (human report)";
      assertReportMentions(
        await runFromRootAndNested(
          product,
          workspace,
          ["coverage"],
          coverageHumanLabel,
        ),
        [ALPHA, BETA, GAMMA],
        `${coverageHumanLabel}: covered and uncovered identities appear workspace-relative`,
      );

      // `impact --base`: the leaf edit's worked example of SPEC 5.6 — gamma
      // `changed`, its root `descendant-changed` attributed to gamma — with
      // every identity in the workspace-relative form.
      const impactLabel = "T1.5-1 `impact --base HEAD --json`";
      const impact = decodeImpactReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["impact", "--base", "HEAD", "--json"],
            impactLabel,
          ),
          impactLabel,
        ),
        impactLabel,
      );
      if (impact.requirements.length !== 2) {
        fail(
          `${impactLabel}: a single leaf edit categorizes exactly the leaf (changed) and ` +
            `its root (descendant-changed) — two entries (SPEC 5.6, 9.3); got ` +
            JSON.stringify(impact.requirements),
        );
      }
      const gammaEntry = impact.requirements.find((entry) =>
        entry.nodes.includes(GAMMA),
      );
      const rootEntry = impact.requirements.find((entry) =>
        entry.nodes.includes(B_ROOT),
      );
      if (gammaEntry === undefined || rootEntry === undefined) {
        fail(
          `${impactLabel}: expected one entry for ${GAMMA} and one for ${B_ROOT} ` +
            `(SPEC 5.6, 1.5); got entries for ` +
            JSON.stringify(impact.requirements.map((entry) => entry.nodes)),
        );
      }
      assertSameJson(
        gammaEntry.nodes,
        [GAMMA],
        `${impactLabel}: the edited leaf's entry names its workspace-relative identity`,
      );
      assertSameJson(
        gammaEntry.deleted,
        false,
        `${impactLabel}: the edited leaf is present on both sides`,
      );
      assertSameJson(
        gammaEntry.categories.map((category) => category.category),
        ["changed"],
        `${impactLabel}: the edited leaf's only category (SPEC 5.6)`,
      );
      // Attribution of `changed` beyond the originating node itself is
      // T5.6-1's business; here only the identity form is at stake.
      assertKnownIdentities(
        gammaEntry.categories.flatMap((category) => category.attributedTo),
        `${impactLabel}: attribution identities of the leaf's entry`,
      );
      assertSameJson(
        rootEntry.nodes,
        [B_ROOT],
        `${impactLabel}: the ancestor entry names the root by bare workspace-relative path (SPEC 1.5)`,
      );
      assertSameJson(
        rootEntry.deleted,
        false,
        `${impactLabel}: the root is present on both sides`,
      );
      assertSameJson(
        rootEntry.categories,
        [{ category: "descendant-changed", attributedTo: [GAMMA] }],
        `${impactLabel}: the root's category is attributed to the edited leaf's ` +
          `workspace-relative identity (SPEC 5.6)`,
      );
      assertSameJson(
        impact.code,
        { direct: [], transitive: [] },
        `${impactLabel}: no code groups are configured, so no code location is impacted`,
      );
      const impactHumanLabel = "T1.5-1 `impact --base HEAD` (human report)";
      assertReportMentions(
        await runFromRootAndNested(
          product,
          workspace,
          ["impact", "--base", "HEAD"],
          impactHumanLabel,
        ),
        [GAMMA],
        `${impactHumanLabel}: the changed node appears by workspace-relative identity`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T1.5-2
// ---------------------------------------------------------------------------

// One spec group plus one code group, for the code-group arm (SPEC 7.2).
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

// Valid content everywhere: the invalid-path condition (14.19) must be the
// only condition present, so the exact-count assertion has teeth.
// The valid section source: the `#`-path arms' initial `files` entries
// (`.source`) and, on the Linux leg, the byte-path staging — a `file()` call
// the body makes after the spec and code arms' invocations (a byte path
// cannot key a `files` entry), so a staged-source record, judged before any
// product exists (S-9, test/self/s9-staged-sources.test.ts).
const VALID_SECTION_SOURCE = stagedMdx(
  "T1.5-2 the valid section source at the non-UTF-8 byte path (Linux leg)",
  '<S id="ok">\nValid content.\n</S>\n',
);

// `specs/b<0xFF>.mdx`: 0xFF can occur in no valid UTF-8 sequence, so the
// workspace-relative path is not valid UTF-8. The glob rules of SPEC 7 match
// byte-wise, so `specs/**/*.mdx` discovers it. Realizable only where file
// names are byte strings — the Linux leg (TEST-SPEC T1.5-2).
const NON_UTF8_SPEC_PATH = Buffer.concat([
  Buffer.from("specs/b", "utf8"),
  Buffer.from([0xff]),
  Buffer.from(".mdx", "utf8"),
]);

// The marked byte form of that path — the concerned path a 14.19 finding
// presents for a non-UTF-8 path (SPEC 12.0, 12.7) — composed from the SAME
// bytes that stage the file, never measured from product output.
const NON_UTF8_MARKED_PATH = {
  bytes: NON_UTF8_SPEC_PATH.toString("hex"),
} as const;

/**
 * The asserted projection of a 14.19 finding (the T11.2-3 discipline): the
 * stable code, the empty locations of a path-level condition, and the
 * concerned path in the form 12.0 fixes for it (SPEC 14, 12.7). Message and
 * identities stay unpinned.
 */
function projectPathFinding(finding: Finding): {
  readonly code: string | null;
  readonly locations: readonly unknown[];
  readonly path: unknown;
} {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

/**
 * A 14.19 finding must identify the offending source by its exact
 * workspace-relative path (SPEC 14, 1.5). The condition is about the path
 * itself, so no in-file location is required of it.
 */
function assertFindingFile(
  finding: Finding,
  expectedFile: string,
  context: string,
): void {
  // 14.19 is a path-level condition: it carries the file's path as the
  // concerned path (SPEC 14, 12.7 — no in-source location).
  if (finding.path !== expectedFile) {
    fail(
      `${context}: the finding must identify the offending workspace-relative source ` +
        `path as its concerned path (SPEC 14, 1.5, 12.7); expected ` +
        `${JSON.stringify(expectedFile)}, got ${JSON.stringify(finding.path)} ` +
        `(message: ${JSON.stringify(finding.message)})`,
    );
  }
}

const T1_5_2 = defineProductTest({
  id: "T1.5-2",
  title:
    "a discovered source path containing `#` fails with 14.19 (spec-group and code-group arms); a non-UTF-8 discovered path fails with 14.19 with its concerned path in the marked byte form, staged on the Linux leg; a discovered path containing U+FFFD (specs/A<U+FFFD>.mdx) fails with 14.19 on both legs — stable code `invalid-source-path`, locations [], the concerned path presented as the plain string, never the byte form (SPEC 1.5, 7, 12.0, 12.7, 14.19)",
  run: async (product) => {
    // Spec-group arm: a discovered `.mdx` whose path contains `#`.
    const specArm = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/a#b.mdx": VALID_SECTION_SOURCE.source,
      },
    });
    try {
      const context =
        "T1.5-2 `build --json` with a spec-group file at specs/a#b.mdx";
      const findings = await buildFindings(product, specArm, context);
      assertConditionCounts(findings, { "14.19": 1 }, context);
      assertFindingFile(findings[0]!, "specs/a#b.mdx", context);
    } finally {
      await specArm.dispose();
    }

    // Code-group arm: 14.19 covers code sources too (SPEC 14.19 names both
    // kinds); the spec source beside it is valid, so the one condition is
    // the code file's path.
    const codeArm = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        "specs/OK.mdx": VALID_SECTION_SOURCE.source,
        "src/a#b.ts": "export const ok = 1;\n",
      },
    });
    try {
      const context =
        "T1.5-2 `build --json` with a code-group file at src/a#b.ts";
      const findings = await buildFindings(product, codeArm, context);
      assertConditionCounts(findings, { "14.19": 1 }, context);
      assertFindingFile(findings[0]!, "src/a#b.ts", context);
    } finally {
      await codeArm.dispose();
    }

    // Non-UTF-8 arm, staged on the Linux leg per T1.5-2's own text: Linux
    // file names are byte strings, so the fixture stages verbatim (the
    // builder's byte-path `file`, S-2's round-trip); other platforms'
    // filesystems cannot hold the path at all. The finding's concerned path
    // is the marked byte form — the path's exact bytes, the one presentation
    // 12.0 admits for a non-UTF-8 path (SPEC 12.0, 12.7).
    if (process.platform === "linux") {
      const nonUtf8Arm = await TestWorkspace.create({
        files: { "xspec.config.ts": SPECS_ONLY_CONFIG },
      });
      try {
        await nonUtf8Arm.file(NON_UTF8_SPEC_PATH, VALID_SECTION_SOURCE);
        const context =
          "T1.5-2 `build --json` with a discovered spec source whose path is not valid UTF-8 (Linux leg)";
        const findings = await buildFindings(product, nonUtf8Arm, context);
        assertConditionCounts(findings, { "14.19": 1 }, context);
        assertSameJson(
          projectPathFinding(findings[0]!),
          {
            code: "invalid-source-path",
            locations: [],
            path: NON_UTF8_MARKED_PATH,
          },
          `${context} — the condition-19 finding carries the stable code, ` +
            `no in-source locations, and the non-UTF-8 concerned path in ` +
            `the marked byte form (SPEC 14, 12.0, 12.7)`,
        );
      } finally {
        await nonUtf8Arm.dispose();
      }
    }

    // U+FFFD arm, both legs: the path is valid UTF-8 (U+FFFD encodes as
    // EF BF BD), so every platform holds the name and the byte-wise glob
    // `specs/**/*.mdx` discovers it (SPEC 7); a path containing U+FFFD is an
    // invalid source path (14.19) with a plain string form — the finding's
    // concerned path is exactly that string, never the marked byte form,
    // which 12.0 reserves for a non-UTF-8 path (SPEC 12.0, 12.7). A product
    // discovering the file as valid builds finding-free and fails the count;
    // one presenting the path in the byte form fails the projection.
    const replacementArm = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [REPLACEMENT_CHARACTER_SPEC_PATH]: VALID_SECTION_SOURCE.source,
      },
    });
    try {
      const context =
        "T1.5-2 `build --json` with a discovered spec source whose path contains U+FFFD (specs/A<U+FFFD>.mdx, both legs)";
      const findings = await buildFindings(product, replacementArm, context);
      assertConditionCounts(findings, { "14.19": 1 }, context);
      assertSameJson(
        projectPathFinding(findings[0]!),
        {
          code: "invalid-source-path",
          locations: [],
          path: REPLACEMENT_CHARACTER_SPEC_PATH,
        },
        `${context} — the condition-19 finding carries the stable code, no ` +
          `in-source locations, and the U+FFFD concerned path as a plain ` +
          `string — never the marked byte form, which 12.0 reserves for a ` +
          `non-UTF-8 path (SPEC 14, 12.0, 12.7)`,
      );
    } finally {
      await replacementArm.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T1.5-3
// ---------------------------------------------------------------------------

// Root-level prose distinct from the section's text, so `path#id` vs bare
// `path` addressing is discriminated by byte-anchored content (SPEC 1.6, 3),
// never just by an echoed identity.
const ADDRESSING_SOURCE = [
  "Intro prose.",
  "",
  '<S id="sec">',
  "Section text.",
  "</S>",
  "",
].join("\n");

// Compiled output of the file (SPEC 3: the tag-only lines are dropped with
// their terminators) — the root's subtree text (SPEC 1.2, 1.6).
const ROOT_COMPILED_TEXT = "Intro prose.\n\nSection text.\n";
// The section's contribution — its subtree text.
const SECTION_TEXT = "Section text.\n";

/** `query node <identity>` must resolve to the node with the given text. */
async function assertNodeAt(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  subtreeText: string,
  context: string,
): Promise<void> {
  const label = `${context} \`query node ${identity}\``;
  const node = decodeNodeReport(
    await runJson(product, workspace, ["query", "node", identity], label),
    label,
  );
  if (node.identity !== identity) {
    fail(
      `${label}: expected the address to resolve to ${JSON.stringify(identity)} ` +
        `(SPEC 1.5), got ${JSON.stringify(node.identity)}`,
    );
  }
  assertBytesEqual(
    node.subtreeText,
    subtreeText,
    `${label}: subtree text of the addressed node`,
  );
}

const T1_5_3 = defineProductTest({
  id: "T1.5-3",
  title:
    "`path#id` addresses a section and bare `path` addresses the root across `query node`, `show`, and `move`/`rename` arguments (SPEC 1.5, 6.4, 6.5, 11, 12.4)",
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": ADDRESSING_SOURCE,
      },
    });
    try {
      await buildOk(product, workspace, "T1.5-3 `build`");

      // `query node`: `path#id` → the section; bare `path` → the root.
      await assertNodeAt(
        product,
        workspace,
        "specs/A.mdx#sec",
        SECTION_TEXT,
        "T1.5-3",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/A.mdx",
        ROOT_COMPILED_TEXT,
        "T1.5-3",
      );

      // `show`: the same addressing duality (SPEC 12.4; --json for decoding —
      // the JSON form carries the same information, SPEC 12.0).
      for (const [address, expectedText] of [
        ["specs/A.mdx#sec", SECTION_TEXT],
        ["specs/A.mdx", ROOT_COMPILED_TEXT],
      ] as const) {
        const label = `T1.5-3 \`show ${address} --json\``;
        const shown = decodeNodeReport(
          await runJson(product, workspace, ["show", address, "--json"], label),
          label,
        );
        if (shown.identity !== address) {
          fail(
            `${label}: expected the address to resolve to ${JSON.stringify(address)} ` +
              `(SPEC 1.5, 12.4), got ${JSON.stringify(shown.identity)}`,
          );
        }
        assertBytesEqual(
          shown.subtreeText,
          expectedText,
          `${label}: subtree text of the addressed node`,
        );
      }

      // `rename <file> <old-id> <new-id>`: the file argument is a bare
      // workspace-relative path (SPEC 6.4, 12.0).
      await expectExit(
        product,
        workspace,
        ["rename", "specs/A.mdx", "sec", "renamed"],
        0,
        "T1.5-3 `rename specs/A.mdx sec renamed`",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/A.mdx#renamed",
        SECTION_TEXT,
        "T1.5-3 after rename:",
      );

      // File-form `move`: two bare paths address whole files — IDs are
      // unchanged, identities change only in their file part (SPEC 6.5).
      await expectExit(
        product,
        workspace,
        ["move", "specs/A.mdx", "specs/moved/AA.mdx"],
        0,
        "T1.5-3 `move specs/A.mdx specs/moved/AA.mdx` (file form)",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/moved/AA.mdx",
        ROOT_COMPILED_TEXT,
        "T1.5-3 after file move:",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/moved/AA.mdx#renamed",
        SECTION_TEXT,
        "T1.5-3 after file move:",
      );

      // Section-form `move`: `path#id` on both sides addresses the section
      // subtree — extracted from the origin, re-identified at the target
      // (SPEC 6.5).
      await expectExit(
        product,
        workspace,
        ["move", "specs/moved/AA.mdx#renamed", "specs/Target.mdx#extracted"],
        0,
        "T1.5-3 `move specs/moved/AA.mdx#renamed specs/Target.mdx#extracted` (section form)",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/Target.mdx#extracted",
        SECTION_TEXT,
        "T1.5-3 after section move:",
      );
      // The created target file's root is addressable by bare path, and the
      // moved section is its whole content.
      await assertNodeAt(
        product,
        workspace,
        "specs/Target.mdx",
        SECTION_TEXT,
        "T1.5-3 after section move:",
      );
      // The `path#id` argument extracted the section, not the file: the
      // origin file remains, holding only its root.
      const subtreeLabel =
        "T1.5-3 after section move: `query subtree specs/moved/AA.mdx`";
      const originRows = decodeNodeRowsReport(
        await runJson(
          product,
          workspace,
          ["query", "subtree", "specs/moved/AA.mdx"],
          subtreeLabel,
        ),
        subtreeLabel,
      );
      assertSameJson(
        originRows.map((row) => row.identity),
        ["specs/moved/AA.mdx"],
        `${subtreeLabel}: only the origin root remains — the section subtree was extracted`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

/** TEST-SPEC §1.5, in canonical ID order (SUITE-04). */
export const section15Tests: readonly ProductTestEntry[] = [
  T1_5_1,
  T1_5_2,
  T1_5_3,
];
