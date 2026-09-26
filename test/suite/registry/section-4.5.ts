// TEST-SPEC §4.5 (dependency markers) — SUITE-15: T4.5-1 … T4.5-9.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes reports through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8). Runtime
// contracts run under standard TypeScript tooling with no xspec runtime
// dependency (SPEC 13.1) through helpers/tooling.ts, in the CommonJS-mode
// arrangement described in section-4.ts. Files under `src/` are discovered
// code-group sources.
//
// Conservative operationalizations (noted per H-4 — wording is free, so only
// the stated observables are asserted):
// - T4.5-1 "at runtime the program behaves as if the line were absent
//   (harmless property read) with no additional tooling installed": the
//   fixture stages two discovered code files differing in exactly the marker
//   line; both compile clean under standard tooling, and both compiled
//   programs run under plain Node (SPEC 13.1 — nothing installed beyond
//   standard TypeScript tooling) with identical observables: exit 0, stdout
//   exactly "Hello\n", empty stderr, the marker program's stdout
//   byte-compared to the marker-free program's.
// - T4.5-2 stages the root marker as the workspace's only dependency edge,
//   so every asserted value is forced: coverage can only be empty, the
//   impacted-code witness edge can only be the root-targeted `references`
//   edge, and with exactly one changed leaf there is exactly one qualifying
//   witness path (SPEC 9.3) — root → print → print.hello, every step
//   `contains`, every node's subtreeHash changed. Its upstream arm stages a
//   second workspace with exactly two dependency edges, each forced into its
//   role: the marker's `references` edge is the location's only impact edge,
//   and the root-sourced `embeds` edge is the root's only dependency edge —
//   after the cross-file edit the one qualifying witness path is root →
//   embedded target (the `contains` step to the untouched `local` child does
//   not qualify: its effectiveHash is unchanged), and the edge target's
//   subtreeHash staying unchanged is what the direct-group emptiness
//   asserts (SPEC 5.5, 9.2, 9.3).
// - T4.5-3 arms stage exactly one defect each — the non-static form. Every
//   arm's chain would resolve to an existing node if read statically
//   (`SPEC[key]` with key = "a"; the `a.b` chains with `a.b` staged), so a
//   product cannot legitimately reclassify the finding as an unresolved
//   reference (14.7): the sole present condition is 14.8, and the exact
//   condition-count assertion simultaneously pins "not 14.18" (SPEC 4.5).
// - T4.5-3's TypeScript-only arms (`SPEC.a!;`, `SPEC.a as X;`, `<X>SPEC.a;`,
//   `SPEC.a satisfies X;`) are dynamic references in a TypeScript source —
//   14.8 at the statement's expression, the file well-formed — never a parse
//   failure: 14.20 is the spec-source reading of the same spellings (T2.4-2),
//   and the exact count {"14.8": 1} excludes it. The angle-bracket form
//   parses only as plain TypeScript, which the `.ts` file name selects (SPEC
//   2.4, 14.20).
// - T4.5-5 arms likewise stage exactly one unsanctioned value-level use
//   each; the exact condition-count assertion {"14.18": 1} pins the
//   classification (SPEC 4.5, 14.18).
// - T4.5-4's callee-side arm stages exactly one shadowed `text(SPEC.a)` call
//   beside one module-scope control call. The workspace fails `build`, so
//   `query` reports the findings without answering (SPEC 13.3): the arm's
//   edge-level observation is `occurrences --file` over the code file,
//   which answers on the failing workspace (11.2) — a construct that
//   records no edge records no occurrence (5.7), so the exact record set
//   (the control's `embeds` record alone, its range, source, and target
//   pinned) is simultaneously the no-edge assertion for the shadowed call.
// - T4.5-8 "`query edges` reports no edge from the file": every colliding
//   arm's workspace fails `build`, so `query` reports exactly the build
//   findings and exits 1 without answering (SPEC 13.3) — the observation is
//   that findings-only document (the form-exact decode admits no `edges`
//   member beside it) together with `occurrences --file`, which answers on
//   the failing workspace (11.2) and lists no record for the spellings (5.7).
//   Reference-spelling findings (14.5–14.7) are asserted byte-exact at the
//   span 14 fixes — terminators and delimiters excluded — while the
//   declarations a 14.15 or 14.16 locates use the end-widened window below.
// - T4.5-8's further located forms stage the supporting declaration the
//   spelled construct needs on the line before it — an ambient
//   `declare const o: Record<string, number>;` for the binding pattern
//   `const { SPEC } = o`, an ambient `declare function dec(...)` for the
//   decorated `@dec class SPEC {}` — each binding no `SPEC`, so the
//   collision stays the arm's sole defect; the located construct is fixed
//   from the exact bytes as for the original forms (SPEC 14, 1.7). The
//   spec-source case's two arms both declare S-9's `duplicate-import-binding`
//   allowance: the stock parser judges all of a file's ESM blocks as one
//   module, so an export declaration binding the import's identifier is the
//   same early error in one block and across two — 14.20 admits both, each
//   a finding in a well-formed file (T14-12).
// - T4.5-9 stages `src/t.ts`, a non-spec module exporting a `text`
//   function, so the `./t` imports of its non-spec and type-only arms name
//   an existing module — the import's validity is a consumer-side matter
//   outside xspec's validations (SPEC 6.4), staged so that the collision is
//   each cell's sole defect. The argument forms (`SPEC.a`, `"x"`, `B.a`)
//   run against every colliding declaration; the second module `B.a` needs
//   is bound by the colliding import itself in the second-spec-`text` arm
//   and by a further `import B from "../specs/B.xspec"` otherwise, an
//   unused spec import recording nothing (2.1). As for T4.5-8, the no-edge
//   observation on the failing workspace is `occurrences --file` (11.2,
//   5.7); the type-level control is the one cell where `query edges`
//   answers.
// - Location assertions: every offending statement is staged at a known byte
//   offset in a pure-ASCII `src/app.ts`, so string indices are byte offsets
//   and each finding must fall within the offending statement's own byte
//   window (end-widened by one byte for line-granular locations, support.ts
//   byteWindow).

import type {
  CoverageProfileReport,
  CoverageReport,
  Finding,
  GraphEdge,
  ImpactedCodeEntry,
  OccurrenceRecord,
} from "../../helpers/adapters/index.js";
import {
  decodeCoverageReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeImpactReport,
  decodeOccurrencesReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  assertStderrEmpty,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  assertNoCompileErrors,
  ConsumerProject,
  formatConsumerDiagnostic,
  runConsumer,
} from "../../helpers/tooling.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceMdxDecl } from "../../helpers/workspace.js";
import { assertRequirementCategories, impactAgainst } from "./section-5.6.js";
import { assertImpactedCode } from "./section-9.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingLocated,
  assertFindingLocatesExactly,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectExit,
  runJson,
  sortedIdentities,
} from "./support.js";

// One spec group plus one code group (SPEC 7.2): TypeScript files under
// `src/` are discovered code sources, so `build` analyzes their spec-module
// usage (4, 4.5).
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

// A two-level document (root → print → print.hello), so a leaf edit changes
// the root's subtreeHash through a two-step contains chain (SPEC 5.5).
const PRINT_SPEC_SOURCE = [
  '<S id="print">',
  "Print behavior.",
  "",
  '<S id="print.hello">',
  "Prints a greeting.",
  "</S>",
  "</S>",
  "",
].join("\n");

// One spec source with a nested `a.b`, shared by the 14.8/14.18 arms and the
// edge-kind fixtures, so every staged chain resolves if read statically —
// the form (or the usage) is each arm's sole defect.
const AB_SPEC_FILES = {
  "specs/A.mdx":
    '<S id="a">\nAlpha behavior.\n<S id="a.b">\nBeta behavior.\n</S>\n</S>\n',
} as const;

/**
 * Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1).
 * `mdx` is the staging's S-9 declaration of its `.mdx` sources (helpers/
 * workspace.ts) — omitted, every staged `.mdx` file must derive plainly.
 */
async function withWorkspace<T>(
  config: string,
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
  mdx?: WorkspaceMdxDecl,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
    ...(mdx === undefined ? {} : { mdx }),
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/** `query edges --from <graph-node>`, decoded (SPEC 11). */
async function queryEdgesFrom(
  product: ProductBinding,
  workspace: TestWorkspace,
  from: string,
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges --from ${from}\``;
  return decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--from", from],
      label,
    ),
    label,
  );
}

/** Workspace-wide `query edges --kinds <kind>`, decoded (SPEC 11). */
async function queryEdgesOfKind(
  product: ProductBinding,
  workspace: TestWorkspace,
  kind: string,
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

/** Emit a consumer project's JavaScript, failing diagnosed when skipped. */
function emitConsumer(project: ConsumerProject, context: string): void {
  const emitted = project.emit();
  if (emitted.emitSkipped) {
    fail(
      `${context}: consumer emit was skipped; diagnostics:\n` +
        emitted.diagnostics
          .map((diagnostic) => `  ${formatConsumerDiagnostic(diagnostic)}`)
          .join("\n"),
    );
  }
}

/** One offending-statement arm: a workspace differing only in src/app.ts. */
interface OffendingStatementArm {
  /** Which SPEC 4.5 case this is (failure diagnostics). */
  readonly name: string;
  /** The lines of `src/app.ts`, pure ASCII, one statement per line. */
  readonly lines: readonly string[];
  /** The offending statement — exactly one of the lines. */
  readonly offending: string;
}

/** An arm's staged `src/app.ts` text and its offending statement's window. */
interface StagedOffendingStatement {
  /** The whole file: every line LF-terminated. */
  readonly source: string;
  /** The offending statement's byte window (support.ts byteWindow). */
  readonly window: { readonly start: number; readonly end: number };
}

/**
 * Lay out an arm's `src/app.ts` and locate its offending statement's byte
 * window. The statement must appear exactly once among the staged lines —
 * otherwise a harness defect (never a product failure).
 */
function stageOffendingStatement(
  testId: string,
  arm: OffendingStatementArm,
): StagedOffendingStatement {
  const at = arm.lines.indexOf(arm.offending);
  if (at === -1 || arm.lines.lastIndexOf(arm.offending) !== at) {
    throw new Error(
      `${testId} fixture broke: the offending statement must appear exactly ` +
        `once (${arm.name}) — fix the arm table in section-4.5.ts`,
    );
  }
  const source = arm.lines.map((line) => line + "\n").join("");
  const prefix = arm.lines
    .slice(0, at)
    .map((line) => line + "\n")
    .join("");
  return { source, window: byteWindow(prefix, arm.offending) };
}

/**
 * Stage one arm over the shared `a`/`a.b` spec source and assert `build
 * --json` reports exactly one finding of `condition`, located within the
 * offending statement's byte window. The exact condition-count assertion is
 * simultaneously the classification assertion (14.8 vs 14.18, SPEC 4.5).
 */
async function assertArmFailsWith(
  product: ProductBinding,
  testId: string,
  arm: OffendingStatementArm,
  condition: string,
): Promise<void> {
  const { source, window } = stageOffendingStatement(testId, arm);
  const context = `${testId} \`build --json\` over ${arm.name}`;
  await withWorkspace(
    SPEC_AND_CODE_CONFIG,
    { ...AB_SPEC_FILES, "src/app.ts": source },
    async (workspace) => {
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(findings, { [condition]: 1 }, context);
      assertFindingLocated(
        findings[0]!,
        { file: "src/app.ts", window },
        `${context}: the ${condition} finding`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T4.5-1 — marker semantics and runtime harmlessness
// ---------------------------------------------------------------------------

// The SPEC 4.5 worked shape: a bare requirement reference as an expression
// statement inside a function. The control program is the identical file
// minus exactly the marker line.
const T4_5_1_MARKER_LINE = "  SPEC.print.hello;";
const T4_5_1_APP_LINES = [
  'import SPEC from "../specs/MAIN.xspec";',
  "",
  "function printHello(): void {",
  T4_5_1_MARKER_LINE,
  '  console.log("Hello");',
  "}",
  "",
  "printHello();",
  "",
];
const T4_5_1_APP_SOURCE = T4_5_1_APP_LINES.join("\n");
const T4_5_1_CONTROL_SOURCE = T4_5_1_APP_LINES.filter(
  (line) => line !== T4_5_1_MARKER_LINE,
).join("\n");
const T4_5_1_EXPECTED_STDOUT = "Hello\n";

const T4_5_1 = defineProductTest({
  id: "T4.5-1",
  title:
    "a bare requirement reference as an expression statement is a dependency marker: it records a `references` edge from the enclosing code location, and at runtime the program behaves as if the line were absent — the compiled program under plain Node matches the marker-free control byte for byte (SPEC 4.5, 4.6, 13.1)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        "specs/MAIN.mdx": PRINT_SPEC_SOURCE,
        "src/app.ts": T4_5_1_APP_SOURCE,
        "src/control.ts": T4_5_1_CONTROL_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.5-1 `build` over the marker program and its marker-free control",
        );

        // The marker records a `references` edge from its enclosing code
        // location — the function unit (SPEC 4.5, 4.6) — and that is the
        // workspace's complete `references` edge set: the control, identical
        // but for the marker line, contributes nothing.
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", "T4.5-1"),
          [
            {
              from: "src/app.ts#printHello",
              to: "specs/MAIN.mdx#print.hello",
              kind: "references",
            },
          ],
          "T4.5-1 the marker records a `references` edge from the enclosing " +
            "code location (SPEC 4.5, 4.6), and nothing else records one",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "embeds", "T4.5-1"),
          [],
          "T4.5-1 a marker is a `references` edge, not an `embeds` edge " +
            "(SPEC 4.5, 5.2)",
        );

        // Runtime harmlessness under standard tooling only (SPEC 13.1): both
        // programs compile clean, and the compiled marker program under
        // plain Node behaves exactly like the marker-free control — exit 0,
        // stdout "Hello\n", empty stderr, byte-compared.
        const project = await ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: ["src/app.ts", "src/control.ts"],
        });
        assertNoCompileErrors(
          project,
          "T4.5-1 the marker program and its marker-free control under " +
            "standard TypeScript tooling (SPEC 4.5: markers are valid with " +
            "no additional tooling installed)",
        );
        emitConsumer(project, "T4.5-1 marker and control programs");
        const appRun = await runConsumer({
          dir: workspace.root,
          entry: "src/app.js",
        });
        const controlRun = await runConsumer({
          dir: workspace.root,
          entry: "src/control.js",
        });
        for (const [label, run] of [
          ["marker program", appRun],
          ["marker-free control", controlRun],
        ] as const) {
          assertExitCode(
            run,
            0,
            `T4.5-1 compiled ${label} under plain Node (SPEC 4.5, 13.1)`,
          );
          assertStderrEmpty(
            run,
            `T4.5-1 compiled ${label} under plain Node (SPEC 4.5: a marker ` +
              "is a harmless property read)",
          );
          assertBytesEqual(
            run.stdoutBytes,
            T4_5_1_EXPECTED_STDOUT,
            `T4.5-1 stdout of the ${label} (SPEC 4.5)`,
          );
        }
        assertBytesEqual(
          appRun.stdoutBytes,
          controlRun.stdoutBytes,
          "T4.5-1 at runtime the marker program behaves as if the marker " +
            "line were absent — stdout byte-identical to the marker-free " +
            "control (SPEC 4.5)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.5-2 — root marker: references edge, no coverage, impacted code
// ---------------------------------------------------------------------------

// Coverage profiles over both modes, target = the spec group, boundary = the
// code group (`boundaryKind` inferred, the name is unambiguous, SPEC 7.4).
// `edgeKinds` defaults to all three, so the root-targeted `references` edge
// is the one candidate edge in every profile.
const T4_5_2_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  coverage: [
    {
      name: "direct",
      target: "main",
      boundary: "app",
      mode: "direct"
    },
    {
      name: "trans",
      target: "main",
      targets: "all",
      boundary: "app",
      mode: "transitive"
    }
  ]
})
`;

// The bare reference to the default export, at file top level — the root
// marker, and the workspace's only dependency edge.
const T4_5_2_APP_SOURCE = [
  'import SPEC from "../specs/MAIN.xspec";',
  "",
  "SPEC;",
  "",
].join("\n");

// The leaf edit: one own-content run of print.hello changes, so the root's
// subtreeHash (and effectiveHash) change through the contains chain
// (SPEC 5.5) while no other file is touched.
// Staged after the coverage queries — a staged-source record, judged before
// any product exists (S-9, test/self/s9-staged-sources.test.ts).
const T4_5_2_EDITED_SPEC_SOURCE = stagedMdx(
  "T4.5-2 specs/MAIN.mdx with the leaf's text edited after the baseline commit",
  PRINT_SPEC_SOURCE.replace(
    "Prints a greeting.",
    "Prints a much louder greeting.",
  ),
);

// Upstream arm (SPEC 4.5 "in the document or upstream of it"): the marker's
// document bears a root-sourced dependency edge into another file — a
// top-level `{text(...)}` outside any section records an `embeds` edge from
// the implicit root (SPEC 2.3, 1.2; the T8-5 shape). The `local` section is
// the untouched in-document control: it must stay uncategorized, and its
// `contains` step must not enter the witness path.
const T4_5_2_MAIN_ROOT = "specs/MAIN.mdx";
const T4_5_2_LOCAL = "specs/MAIN.mdx#local";
const T4_5_2_OTHER_ROOT = "specs/OTHER.mdx";
const T4_5_2_UPSTREAM = "specs/OTHER.mdx#upstream";

const T4_5_2_UPSTREAM_MAIN_SOURCE = [
  'import OTHER from "./OTHER.xspec"',
  "",
  "{text(OTHER.upstream)}",
  "",
  '<S id="local">',
  "Local behavior.",
  "</S>",
  "",
].join("\n");

/** The other file: the embedded target's own text is the edited run. */
const upstreamOtherSource = (text: string): string =>
  ['<S id="upstream">', text, "</S>", ""].join("\n");
// The upstream edit, staged after the edge queries — a staged-source record
// (S-9, test/self/s9-staged-sources.test.ts).
const T4_5_2_UPSTREAM_OTHER_V2 = stagedMdx(
  "T4.5-2 specs/OTHER.mdx with the embedded target's text at v2 (the upstream edit)",
  upstreamOtherSource("Upstream behavior, v2."),
);

/** Resolve one named profile from a coverage report, diagnosed (H-8). */
function profileByName(
  report: CoverageReport,
  name: string,
  context: string,
): CoverageProfileReport {
  const profile = report.profiles.find((candidate) => candidate.name === name);
  if (profile === undefined) {
    fail(
      `${context}: profile ${JSON.stringify(name)} missing from the ` +
        `coverage report (SPEC 8.2: \`coverage\` runs all profiles); got ` +
        JSON.stringify(report.profiles.map((candidate) => candidate.name)),
    );
  }
  return profile;
}

/** Readable rendering of an impacted-code entry (order-stable fields). */
function renderImpactedCodeEntry(entry: ImpactedCodeEntry): string {
  return (
    `${entry.location} | edge ${entry.edge.kind}: ${entry.edge.from} -> ` +
    `${entry.edge.to} | path: ${entry.path.join(" > ")}`
  );
}

const T4_5_2 = defineProductTest({
  id: "T4.5-2",
  title:
    "a bare reference to the default export records a `references` edge to the root; it grants no coverage in any profile — root-targeted edges never extend a covering path — but the code location is directly impacted by a text edit changing the root's subtreeHash, witnessed by the root-targeted edge; upstream arm: with the marker's document bearing a root-sourced `{text(...)}` embeds edge into another file, an edit there changing only the root's effectiveHash leaves the location transitively impacted, no node of the marker's document `changed` (SPEC 4.5, 2.3, 5.5, 8, 9.2, 9.3)",
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": T4_5_2_CONFIG,
        "specs/MAIN.mdx": PRINT_SPEC_SOURCE,
        "src/app.ts": T4_5_2_APP_SOURCE,
      },
    });
    try {
      await workspace.gitInit();
      await buildOk(
        product,
        workspace,
        "T4.5-2 `build` over the root-marker workspace",
      );

      // The root marker records a `references` edge to the root — the bare
      // path identity (SPEC 1.5) — from the file (top level, SPEC 4.6), and
      // that is the file's complete outgoing edge set.
      assertEdgeSetEqual(
        await queryEdgesFrom(product, workspace, "src/app.ts", "T4.5-2"),
        [{ from: "src/app.ts", to: "specs/MAIN.mdx", kind: "references" }],
        "T4.5-2 the root marker records a `references` edge to the root " +
          "node, and nothing else leaves the file (SPEC 4.5, 1.5)",
      );

      // No coverage in any profile: the root-targeted edge never extends a
      // covering path (SPEC 8), so with it as the only dependency edge every
      // profile's covered set is empty and every required node stays
      // uncovered — the root itself never among them (8.1).
      const coverageLabel = "T4.5-2 `coverage --json`";
      const coverage = decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "--json"],
          coverageLabel,
        ),
        coverageLabel,
      );
      assertSameJson(
        coverage.profiles.map((profile) => profile.name).sort(),
        ["direct", "trans"],
        `${coverageLabel}: all configured profiles run (SPEC 8.2)`,
      );
      for (const [name, expectedUncovered] of [
        ["direct", ["specs/MAIN.mdx#print.hello"]],
        ["trans", ["specs/MAIN.mdx#print", "specs/MAIN.mdx#print.hello"]],
      ] as const) {
        const profile = profileByName(coverage, name, coverageLabel);
        if (profile.counts.covered !== 0 || profile.covered.length !== 0) {
          fail(
            `${coverageLabel}: the root marker must grant no coverage in ` +
              `profile ${JSON.stringify(name)} (SPEC 4.5, 8: roots never ` +
              `appear in coverage paths and root-targeted edges never ` +
              `extend one); got covered count ` +
              `${String(profile.counts.covered)} with covered nodes ` +
              JSON.stringify(sortedIdentities(profile.covered)),
          );
        }
        assertSameJson(
          [...profile.uncovered].sort(),
          expectedUncovered,
          `${coverageLabel}: profile ${JSON.stringify(name)} leaves every ` +
            "required node uncovered, the root never listed (SPEC 8, 8.1)",
        );
      }

      // Impact: commit the baseline, edit the leaf's text — the root's
      // subtreeHash changes (SPEC 5.5) — and the code location is directly
      // impacted (9.2) via its root-targeted edge. With one impact edge and
      // one changed leaf, the witness edge and path are forced (9.3): the
      // path runs root → print → print.hello, every step `contains`.
      const baseline = await workspace.gitCommitAll("baseline");
      await workspace.file("specs/MAIN.mdx", T4_5_2_EDITED_SPEC_SOURCE);
      const impactLabel = `T4.5-2 \`impact --base ${baseline} --json\``;
      const impact = decodeImpactReport(
        await runJson(
          product,
          workspace,
          ["impact", "--base", baseline, "--json"],
          impactLabel,
        ),
        impactLabel,
      );
      assertSameJson(
        impact.code.direct.map(renderImpactedCodeEntry),
        [
          "src/app.ts | edge references: src/app.ts -> specs/MAIN.mdx | " +
            "path: specs/MAIN.mdx > specs/MAIN.mdx#print > " +
            "specs/MAIN.mdx#print.hello",
        ],
        `${impactLabel}: the root marker makes its code location directly ` +
          "impacted by a leaf text edit — the root's subtreeHash changed — " +
          "witnessed by the root-targeted `references` edge and the " +
          "contains-step path to the edited leaf (SPEC 4.5, 9.2, 9.3)",
      );
      assertSameJson(
        impact.code.transitive.map(renderImpactedCodeEntry),
        [],
        `${impactLabel}: the location's only impact edge targets the root, ` +
          "whose subtreeHash changed, so it is directly — not " +
          "transitively — impacted (SPEC 9.2)",
      );
    } finally {
      await workspace.dispose();
    }

    // Upstream arm (SPEC 4.5: impacted by any change "in the document or
    // upstream of it"): a second workspace whose MAIN.mdx bears a
    // root-sourced `{text(...)}` embeds edge into OTHER.mdx. An edit THERE
    // changes only the root's effectiveHash — an embedded target's text is
    // no part of the embedder's own content (SPEC 5.5), so the root's
    // ownHash and subtreeHash stay unchanged — leaving the marker's location
    // transitively impacted (9.2) while no node of the marker's document is
    // `changed`.
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        "specs/MAIN.mdx": T4_5_2_UPSTREAM_MAIN_SOURCE,
        "specs/OTHER.mdx": upstreamOtherSource("Upstream behavior, v1."),
        "src/app.ts": T4_5_2_APP_SOURCE,
      },
      async (workspace) => {
        await workspace.gitInit();
        await buildOk(
          product,
          workspace,
          "T4.5-2 `build` over the upstream-arm workspace",
        );

        // Staging integrity: the two dependency edges, each the complete set
        // of its kind. The top-level `{text(...)}` outside any section is
        // root-sourced (SPEC 2.3, 1.2), and the root marker's `references`
        // edge is the location's only impact edge (SPEC 4.5, 9.2).
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "embeds", "T4.5-2"),
          [
            {
              from: T4_5_2_MAIN_ROOT,
              to: T4_5_2_UPSTREAM,
              kind: "embeds",
            },
          ],
          "T4.5-2 upstream arm: the marker's document bears the root-sourced " +
            "`embeds` edge into the other file — a top-level `{text(...)}` " +
            "outside any section embeds from the implicit root (SPEC 2.3, " +
            "1.2)",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", "T4.5-2"),
          [
            {
              from: "src/app.ts",
              to: T4_5_2_MAIN_ROOT,
              kind: "references",
            },
          ],
          "T4.5-2 upstream arm: the root marker's `references` edge to the " +
            "root is the location's only impact edge (SPEC 4.5, 1.5, 9.2)",
        );

        // Commit the baseline, then edit the embedded target's text in the
        // OTHER file — the marker's document is not touched.
        const baseline = await workspace.gitCommitAll("baseline");
        await workspace.file("specs/OTHER.mdx", T4_5_2_UPSTREAM_OTHER_V2);
        const label =
          "T4.5-2 `impact --base <baseline> --json` after the upstream edit";
        const impact = await impactAgainst(product, workspace, baseline, label);

        // Transitively impacted, not directly (SPEC 9.2): the edit changes
        // the root's effectiveHash through the root-sourced dependency pair
        // (SPEC 5.5) but not its subtreeHash. The witness path is forced
        // (SPEC 9.3): from the edge's target, the `contains` step to `local`
        // does not qualify (its effectiveHash is unchanged), so the one
        // qualifying path is the dependency step to the edited target —
        // root → upstream, every node's effectiveHash changed, ending at
        // the `changed` node.
        assertImpactedCode(
          impact,
          {
            direct: [],
            transitive: [
              {
                location: "src/app.ts",
                edge: {
                  from: "src/app.ts",
                  to: T4_5_2_MAIN_ROOT,
                  kind: "references",
                },
                path: [T4_5_2_MAIN_ROOT, T4_5_2_UPSTREAM],
              },
            ],
          },
          `${label}: the cross-file edit changes only the root's ` +
            "effectiveHash, so the marker's location is transitively — " +
            "never directly — impacted, witnessed by the root-targeted " +
            "`references` edge and the dependency step to the edited " +
            "target (SPEC 4.5, 5.5, 9.2, 9.3)",
        );

        // No node of the marker's document is `changed` (SPEC 5.5, 5.6): the
        // complete category table. The edited target is `changed`; its file
        // root `descendant-changed`; the marker document's root is exactly
        // `upstream-changed` — its ownHash and subtreeHash unchanged, so
        // never `changed` or `descendant-changed` — and the untouched
        // `local` section receives no category at all.
        assertRequirementCategories(
          impact,
          [
            {
              identity: T4_5_2_UPSTREAM,
              categories: [{ category: "changed", within: [T4_5_2_UPSTREAM] }],
            },
            {
              identity: T4_5_2_OTHER_ROOT,
              categories: [
                { category: "descendant-changed", exact: [T4_5_2_UPSTREAM] },
              ],
            },
            {
              identity: T4_5_2_MAIN_ROOT,
              categories: [
                { category: "upstream-changed", exact: [T4_5_2_UPSTREAM] },
              ],
            },
            { identity: T4_5_2_LOCAL, categories: [] },
          ],
          `${label}: editing an embedded target surfaces at the embedding ` +
            "document as `upstream-changed`, never `changed` — no node of " +
            "the marker's document is `changed` (SPEC 5.5, 5.6, 9.1)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.5-3 — non-static bare references in expression-statement position (14.8)
// ---------------------------------------------------------------------------

const T4_5_3_IMPORT = 'import SPEC from "../specs/A.xspec";';

const T4_5_3_ARMS: readonly OffendingStatementArm[] = [
  {
    name:
      "a computed index by variable as a bare expression statement " +
      "(SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", 'const key = "a";', "SPEC[key];"],
    offending: "SPEC[key];",
  },
  {
    name:
      "an optional-chaining chain as a bare expression statement " +
      "(SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", "SPEC.a?.b;"],
    offending: "SPEC.a?.b;",
  },
  {
    name:
      "a non-null-assertion chain as a bare expression statement " +
      "(SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", "SPEC.a!.b;"],
    offending: "SPEC.a!.b;",
  },
  // The TypeScript-only forms SPEC 2.4 makes dynamic in a TypeScript source
  // — never a parse failure there (the spec-source counterparts are T2.4-2's
  // 14.20 arms). `type X = unknown;` declares the asserted type so the file
  // carries no TypeScript error at all — a type alias is type-level and
  // collides with no binding (SPEC 2.4, 4.5) — keeping the form each arm's
  // sole defect. The angle-bracket assertion parses only under the
  // plain-TypeScript grammar the staged `.ts` file name selects (SPEC
  // 14.20) — never `.tsx`.
  {
    name:
      "a non-null assertion ending the chain as a bare expression statement " +
      "(TEST-SPEC's `SPEC.a!;`; TypeScript-only syntax, dynamic in a " +
      "TypeScript source, SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", "SPEC.a!;"],
    offending: "SPEC.a!;",
  },
  {
    name:
      "a type assertion `as X` as a bare expression statement " +
      "(TypeScript-only syntax, dynamic in a TypeScript source, SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", "type X = unknown;", "SPEC.a as X;"],
    offending: "SPEC.a as X;",
  },
  {
    name:
      "an angle-bracket assertion `<X>` as a bare expression statement, in a " +
      "`.ts` file where it parses (TypeScript-only syntax, dynamic in a " +
      "TypeScript source, SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", "type X = unknown;", "<X>SPEC.a;"],
    offending: "<X>SPEC.a;",
  },
  {
    name:
      "a `satisfies X` operator as a bare expression statement " +
      "(TypeScript-only syntax, dynamic in a TypeScript source, SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", "type X = unknown;", "SPEC.a satisfies X;"],
    offending: "SPEC.a satisfies X;",
  },
  {
    name: "a parenthesized chain as a bare expression statement (SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", "(SPEC.a).b;"],
    offending: "(SPEC.a).b;",
  },
  {
    name:
      "a template-literal computed index as a bare expression statement " +
      "(template literals are not static, SPEC 2.4, 4.5)",
    lines: [T4_5_3_IMPORT, "", "SPEC[`a`];"],
    offending: "SPEC[`a`];",
  },
];

const T4_5_3 = defineProductTest({
  id: "T4.5-3",
  title:
    "a non-static bare reference in expression-statement position — computed index by variable, optional chaining, non-null assertion, parentheses, template-literal index, and the TypeScript-only forms 2.4 makes dynamic in a TypeScript source, never a parse failure there (`SPEC.a as X;`, `<X>SPEC.a;` in a `.ts` file, `SPEC.a satisfies X;`) — fails with exactly one located 14.8 finding (invalid argument, not 14.18), the file well-formed (SPEC 4.5, 2.4, 14.8)",
  run: async (product) => {
    for (const arm of T4_5_3_ARMS) {
      await assertArmFailsWith(product, "T4.5-3", arm, "14.8");
    }
  },
});

// ---------------------------------------------------------------------------
// T4.5-4 — shadowing: chains rooted at a local are not spec references
// ---------------------------------------------------------------------------

// The identical statement text `SPEC.a.b;` appears twice: once at top level
// rooted at the import binding (a marker, the control), once inside a
// function whose local `const SPEC` shadows the import — TypeScript scoping
// resolves that chain to the local, so it is not a spec reference (SPEC 4.5:
// rooting is scope-aware and value-level).
const T4_5_4_APP_SOURCE = [
  'import SPEC from "../specs/A.xspec";',
  "",
  "SPEC.a.b;",
  "",
  "function localScope(): string {",
  '  const SPEC = { a: { b: "shadow value" } };',
  "  SPEC.a.b;",
  "  return SPEC.a.b;",
  "}",
  "",
  "localScope();",
  "",
].join("\n");

// Callee side (SPEC 4.5: rooting is scope-aware and value-level for the
// `text` binding as for the node chain). Inside `shadowScope`, a local
// `function text` shadows the imported `text`, so `text(SPEC.a)` there has a
// non-spec callee and a node argument — the "passing to any other function"
// of 4.5, 14.18 (T4.5-5) — while the identical call at module scope (the
// control) is an ordinary `text` call recording its `embeds` edge (4.3), and
// the import binding, used by the control alone, stays a valid import (2.1,
// 4). The two targets differ (`a` shadowed, `a.b` control), so a record a
// by-name product would emit for the shadowed call is distinguishable from
// the control's by target, not only by range.
const T4_5_4_CALLEE_IMPORT = 'import SPEC, { text } from "../specs/A.xspec";';
const T4_5_4_CALLEE_CONTROL_CALL = "text(SPEC.a.b)";
const T4_5_4_CALLEE_SHADOWED_LINE = "  text(SPEC.a);";
const T4_5_4_CALLEE_ARM: OffendingStatementArm = {
  name: "a shadowing local `text` as the callee (SPEC 4.5)",
  lines: [
    T4_5_4_CALLEE_IMPORT,
    "",
    `${T4_5_4_CALLEE_CONTROL_CALL};`,
    "",
    "function shadowScope(): void {",
    "  function text(x: unknown): void { void x; }",
    T4_5_4_CALLEE_SHADOWED_LINE,
    "}",
    "",
    "shadowScope();",
  ],
  offending: T4_5_4_CALLEE_SHADOWED_LINE,
};

/**
 * An occurrence record's every datum (SPEC 5.7) as one JSON-safe tuple —
 * file, own range, kind, source (identity plus range, or the unavailability
 * marker), target — so whole records compare key-order-free.
 */
function occurrenceTuple(record: OccurrenceRecord): readonly unknown[] {
  const source =
    "unavailable" in record.source
      ? "(source unavailable)"
      : [
          record.source.identity,
          record.source.range.start,
          record.source.range.end,
        ];
  return [
    record.file,
    record.range.start,
    record.range.end,
    record.kind,
    source,
    record.target,
  ];
}

/**
 * The T4.5-4 callee-side arm: `build` and `check` report exactly one
 * condition-18 finding located at the shadowed use (exit 1), and
 * `occurrences --file` over the code file — answering on the failing
 * workspace (SPEC 11.2) — carries that finding and lists exactly the control
 * call's `embeds` record, none for the shadowed call (5.7, 11.3).
 */
async function assertT454CalleeSide(product: ProductBinding): Promise<void> {
  const { source, window } = stageOffendingStatement(
    "T4.5-4",
    T4_5_4_CALLEE_ARM,
  );
  const shadowedUse = { file: "src/app.ts", window } as const;
  // The control record: its own range spans the call expression, callee
  // through closing parenthesis, the statement terminator excluded; its
  // source is the whole-file location, no named unit enclosing it —
  // identity the path alone, range the entire file (SPEC 5.7, 4.6, 1.7).
  const controlStart = Buffer.byteLength(`${T4_5_4_CALLEE_IMPORT}\n\n`, "utf8");
  const controlEnd =
    controlStart + Buffer.byteLength(T4_5_4_CALLEE_CONTROL_CALL, "utf8");
  const expectedRecords: readonly (readonly unknown[])[] = [
    [
      "src/app.ts",
      controlStart,
      controlEnd,
      "embeds",
      ["src/app.ts", 0, Buffer.byteLength(source, "utf8")],
      "specs/A.mdx#a.b",
    ],
  ];
  await withWorkspace(
    SPEC_AND_CODE_CONFIG,
    { ...AB_SPEC_FILES, "src/app.ts": source },
    async (workspace) => {
      // `build`: exactly one finding, condition 18, located at the shadowed
      // use. The exact count pins the classification and, with it, the
      // import's validity — nothing is reported beside the one 14.18
      // (SPEC 2.1, 4.5, 14.18).
      const buildContext =
        "T4.5-4 `build --json` with a shadowing local `text` as the callee";
      const buildFound = await buildFindings(product, workspace, buildContext);
      assertConditionCounts(buildFound, { "14.18": 1 }, buildContext);
      assertFindingLocated(
        buildFound[0]!,
        shadowedUse,
        `${buildContext}: the 14.18 finding locates at the shadowed use ` +
          `(SPEC 4.5, 14.18)`,
      );

      // `check`: the same validation, exit 1 (SPEC 12.2). Staleness of the
      // never-built workspace's derived files is 14.10's own business
      // (12.2, 14) — set aside, the findings are exactly the one 14.18,
      // located at the shadowed use.
      const checkContext =
        "T4.5-4 `check --json` with a shadowing local `text` as the callee";
      const checkResult = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkContext} — \`check\` performs all build validations and ` +
          `exits 1 on the finding (SPEC 12.2, 4.5, 14.18)`,
      );
      const checkFound = decodeFindingsReport(
        parseJsonStdout(checkResult, checkContext),
        checkContext,
      ).findings.filter((finding) => finding.condition !== "14.10");
      assertConditionCounts(checkFound, { "14.18": 1 }, checkContext);
      assertFindingLocated(
        checkFound[0]!,
        shadowedUse,
        `${checkContext}: the 14.18 finding locates at the shadowed use ` +
          `(SPEC 4.5, 14.18)`,
      );

      // `occurrences --file src/app.ts`, answering on the failing workspace
      // (SPEC 11.2): the code file's finding accompanies (exit 1, the full
      // answer still emitted), and the record set is exactly the control
      // call's `embeds` record — the shadowed call records no edge and so
      // no occurrence (5.7). A product resolving the callee by name would
      // list a second record (target `specs/A.mdx#a`) and carry no finding.
      const occContext =
        "T4.5-4 `occurrences --file src/app.ts` on the failing workspace";
      const occResult = await expectExit(
        product,
        workspace,
        ["occurrences", "--file", "src/app.ts"],
        1,
        `${occContext} — the answer carries the domain's 14.18 finding, so ` +
          `exit 1 with the full answer document (SPEC 11.2, 11.3)`,
      );
      const report = decodeOccurrencesReport(
        parseJsonStdout(
          occResult,
          `${occContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        occContext,
      );
      assertConditionCounts(
        report.findings,
        { "14.18": 1 },
        `${occContext}: the code file's one finding accompanies the answer ` +
          `(SPEC 11.2, 11.3)`,
      );
      assertFindingLocated(
        report.findings[0]!,
        shadowedUse,
        `${occContext}: the accompanying 14.18 locates at the shadowed use ` +
          `(SPEC 11.2, 14)`,
      );
      assertSameJson(
        report.occurrences.map(occurrenceTuple),
        expectedRecords,
        `${occContext}: exactly the control call's \`embeds\` record — file, ` +
          `own range (callee through closing parenthesis), kind, whole-file ` +
          `source, target — and none for the shadowed call, which records ` +
          `no edge and no occurrence (SPEC 4.5, 5.7, 4.6, 1.7, 11.3)`,
      );
    },
  );
}

const T4_5_4 = defineProductTest({
  id: "T4.5-4",
  title:
    "a local declaration shadowing the import binding: chains rooted at the local are not spec references — no edge, no error, the program builds — while the identical statement rooted at the import records its marker edge; callee side: an inner-scope `function text` shadowing the imported `text` makes `text(SPEC.a)` in that scope a call to another function — `build` and `check` report exactly one condition-18 finding located at that use, exit 1, and `occurrences --file` over the code file, answering on the failing workspace, carries the finding and lists no record for it while the identical call outside the scope lists its `embeds` occurrence (SPEC 4.5, 5.7, 11.2, 11.3, 14.18)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      { ...AB_SPEC_FILES, "src/app.ts": T4_5_4_APP_SOURCE },
      async (workspace) => {
        // No error: the shadowed chains fall under no condition (SPEC 4.5) —
        // build and check both succeed.
        await buildOk(
          product,
          workspace,
          "T4.5-4 `build` with chains rooted at a local shadowing the " +
            "import binding",
        );
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T4.5-4 `check` over the same workspace (the shadowed chains " +
            "trigger no finding, SPEC 4.5)",
        );

        // No edge: the workspace's complete `references` edge set is the
        // top-level control marker's file-attributed edge — a product that
        // ignored scoping would record a second edge from the function unit.
        const expected: readonly GraphEdge[] = [
          { from: "src/app.ts", to: "specs/A.mdx#a.b", kind: "references" },
        ];
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", "T4.5-4"),
          expected,
          "T4.5-4 chains rooted at the shadowing local record no edge; the " +
            "identical top-level statement rooted at the import records " +
            "exactly its marker edge (SPEC 4.5, 4.6)",
        );
        assertEdgeSetEqual(
          await queryEdgesFrom(product, workspace, "src/app.ts", "T4.5-4"),
          expected,
          "T4.5-4 the file's complete outgoing edge set is the control " +
            "marker's edge (SPEC 4.5, 4.6)",
        );
      },
    );

    // Callee side: the shadowing local as the callee of `text(...)`.
    await assertT454CalleeSide(product);
  },
});

// ---------------------------------------------------------------------------
// T4.5-5 — sanctioned uses only: every other value-level use is 14.18
// ---------------------------------------------------------------------------

const T4_5_5_IMPORT_DEFAULT = 'import SPEC from "../specs/A.xspec";';
const T4_5_5_IMPORT_TEXT = 'import { text } from "../specs/A.xspec";';
// A plain local function: passing a node (or `text`) to it is not a call to
// a spec module's `text` export (SPEC 4.5).
const T4_5_5_SINK = "function sink(value: unknown): void { void value; }";

const T4_5_5_ARMS: readonly OffendingStatementArm[] = [
  {
    name: "aliasing a node to a variable (SPEC 4.5)",
    lines: [T4_5_5_IMPORT_DEFAULT, "", "const alias = SPEC.a;"],
    offending: "const alias = SPEC.a;",
  },
  {
    name: "destructuring the module (SPEC 4.5)",
    lines: [T4_5_5_IMPORT_DEFAULT, "", "const { a } = SPEC;"],
    offending: "const { a } = SPEC;",
  },
  {
    name: "re-exporting the binding (SPEC 4.5)",
    lines: [T4_5_5_IMPORT_DEFAULT, "", "export { SPEC };"],
    offending: "export { SPEC };",
  },
  {
    name: "storing a node in an array (SPEC 4.5)",
    lines: [T4_5_5_IMPORT_DEFAULT, "", "const stored = [SPEC.a];"],
    offending: "const stored = [SPEC.a];",
  },
  {
    name: "storing a node in an object (SPEC 4.5)",
    lines: [T4_5_5_IMPORT_DEFAULT, "", "const stored = { node: SPEC.a };"],
    offending: "const stored = { node: SPEC.a };",
  },
  {
    name:
      "passing a node to a function other than a spec module's `text` " +
      "export (SPEC 4.5)",
    lines: [T4_5_5_IMPORT_DEFAULT, "", T4_5_5_SINK, "sink(SPEC.a);"],
    offending: "sink(SPEC.a);",
  },
  {
    name: "passing `text` as a value instead of using it as a callee (SPEC 4.5)",
    lines: [T4_5_5_IMPORT_TEXT, "", T4_5_5_SINK, "sink(text);"],
    offending: "sink(text);",
  },
  {
    name: "storing `text` as a value instead of using it as a callee (SPEC 4.5)",
    lines: [T4_5_5_IMPORT_TEXT, "", "const stored = text;"],
    offending: "const stored = text;",
  },
];

const T4_5_5 = defineProductTest({
  id: "T4.5-5",
  title:
    "the sanctioned value-level uses are exact — aliasing a node to a variable, destructuring the module, re-exporting the binding, storing a node in an array or object, passing a node to a function other than a spec module's `text` export, and passing or storing `text` other than as a callee each fail with exactly one located 14.18 finding (SPEC 4.5, 14.18)",
  run: async (product) => {
    for (const arm of T4_5_5_ARMS) {
      await assertArmFailsWith(product, "T4.5-5", arm, "14.18");
    }
  },
});

// ---------------------------------------------------------------------------
// T4.5-6 — text(...) in statement position: valid, embeds, not a marker
// ---------------------------------------------------------------------------

const T4_5_6_APP_SOURCE = [
  'import SPEC, { text } from "../specs/A.xspec";',
  "",
  "text(SPEC.a);",
  "",
].join("\n");

const T4_5_6 = defineProductTest({
  id: "T4.5-6",
  title:
    "a `text(...)` call as an expression statement is valid, records an `embeds` edge, and is not a marker — the kind asserted via `query edges --kinds` (SPEC 4.5, 4.3, 5.2)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      { ...AB_SPEC_FILES, "src/app.ts": T4_5_6_APP_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.5-6 `build` with a `text(...)` call in expression-statement " +
            "position (valid, SPEC 4.5)",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "embeds", "T4.5-6"),
          [{ from: "src/app.ts", to: "specs/A.mdx#a", kind: "embeds" }],
          "T4.5-6 the statement-position `text(...)` call records its " +
            "`embeds` edge from the calling code location (SPEC 4.5, 4.3)",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", "T4.5-6"),
          [],
          "T4.5-6 the statement-position `text(...)` call is not a marker: " +
            "no `references` edge exists anywhere (SPEC 4.5)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.5-7 — type-level freedom: no edges, not rewritten by rename
// ---------------------------------------------------------------------------

// Type-level references in several positions: a type-alias `typeof` query on
// the root and on a chain, a type-level indexed access, an interface property
// annotation, and a parameter annotation. No value-level use of the binding
// exists anywhere in the file.
const T4_5_7_APP_SOURCE = [
  'import SPEC from "../specs/A.xspec";',
  "",
  "type Root = typeof SPEC;",
  "type Leaf = typeof SPEC.a.b;",
  'type Child = Root["a"];',
  "",
  "interface Holder {",
  "  node: typeof SPEC.a;",
  "}",
  "",
  "function annotated(node: typeof SPEC.a.b, holder: Holder): void {",
  "  void node;",
  "  void holder;",
  "}",
  "",
].join("\n");

const T4_5_7 = defineProductTest({
  id: "T4.5-7",
  title:
    "`typeof SPEC.a.b` and other type-level references are unrestricted: the workspace builds with no edges recorded, and rename rewrites nothing in the file — type-level references may be left naming vacated identities while the workspace stays valid (SPEC 4.5, 6.4)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      { ...AB_SPEC_FILES, "src/app.ts": T4_5_7_APP_SOURCE },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.5-7 `build` with type-level references only (unrestricted, " +
            "SPEC 4.5)",
        );

        // No edges recorded: nothing leaves the file, and no dependency
        // edge of either TypeScript-recordable kind exists anywhere.
        assertEdgeSetEqual(
          await queryEdgesFrom(product, workspace, "src/app.ts", "T4.5-7"),
          [],
          "T4.5-7 type-level references record no edges (SPEC 4.5)",
        );
        for (const kind of ["references", "embeds"] as const) {
          assertEdgeSetEqual(
            await queryEdgesOfKind(product, workspace, kind, "T4.5-7"),
            [],
            `T4.5-7 no \`${kind}\` edge exists anywhere in the workspace ` +
              "(SPEC 4.5: type-level references are unrestricted and " +
              "record no edges)",
          );
        }

        // Not rewritten by rename: `rename a -> c` rewrites the spec source
        // and would rewrite value-level references, but type-level
        // references record no edges and are not rewritten (SPEC 6.4) — the
        // code file's bytes are untouched, and the workspace stays valid.
        await expectExit(
          product,
          workspace,
          ["rename", "specs/A.mdx", "a", "c"],
          0,
          "T4.5-7 `rename specs/A.mdx a c` over the valid workspace " +
            "(SPEC 6.4)",
        );
        assertBytesEqual(
          await workspace.readBytes("src/app.ts"),
          T4_5_7_APP_SOURCE,
          "T4.5-7 rename must not rewrite type-level references: the code " +
            "file's bytes are unchanged, its `typeof` chains left naming " +
            "the vacated identities (SPEC 4.5, 6.4)",
        );
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T4.5-7 `check` after the rename — dangling type-level " +
            "references are a consumer-side TypeScript matter, outside " +
            "xspec's validations; the workspace stays valid (SPEC 6.4)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.5-8 — same-scope collisions: an identifier the import and a value-level
// declaration of the module scope both bind roots no resolving chain
// ---------------------------------------------------------------------------

// Sibling targets `a` and `b`: both staged chains (`SPEC.a`, `text(SPEC.b)`)
// resolve if the import roots them, so the same-scope declaration is each
// arm's sole defect (SPEC 2.4, 4.5) — a product reporting the chains as
// unresolved for any other reason has nothing else to point at.
const T4_5_8_SPEC_FILES = {
  "specs/A.mdx":
    '<S id="a">\nAlpha behavior.\n</S>\n\n<S id="b">\nBeta behavior.\n</S>\n',
} as const;

// The import binds both the default export and `text`, so `text(SPEC.b)` is
// a spec module `text` call (4.3) whose argument chain is rooted at `SPEC`.
const T4_5_8_IMPORT = 'import SPEC, { text } from "../specs/A.xspec";';
const T4_5_8_MARKER_CHAIN = "SPEC.a";
const T4_5_8_TEXT_CALL = "text(SPEC.b)";

/** One module-scope declaration staged beside the import (SPEC 2.4, 4.5). */
export interface SameScopeDeclarationArm {
  /** Which declaration form this is (failure diagnostics). */
  readonly name: string;
  /**
   * The declaration's line(s) of `src/app.ts`, exactly (pure ASCII) — a
   * form needing a supporting declaration carries it on a preceding line.
   */
  readonly line: string;
  /**
   * For a colliding form: the construct binding the name — the characters
   * a condition-15 finding locates (SPEC 14, 1.7) — exactly as it occurs
   * within `line`. A type-level control collides with nothing and locates
   * nothing.
   */
  readonly construct: string;
}

// The colliding forms: a variable, function, class, or enum declaration, or
// a namespace binding a value (SPEC 2.4). The located construct is the
// variable DECLARATOR (`SPEC = 1`, the `const` statement excluded) or the
// declaration's own characters (14, 1.7). The further located forms follow
// 14's declarator and decorator rules as 1.7 reads them: a declarator
// without initializer is its name alone; a binding pattern spans the pattern
// through the initializer; a decorator list is part of the class it
// decorates, whose own characters begin at its first decorator; and a
// leading `export`, with whatever separates it from the construct's first
// token, is excluded.
//
// The four further forms T14-11 names are shared with its 14.15 range arm
// (section-14.ts) through `T4_5_8_FURTHER_LOCATED_FORMS` — one staging of
// each form, keyed for file naming there: each `line` exact, its
// `construct` the characters a condition-15 finding locates (SPEC 14, 1.7).
export const T4_5_8_FURTHER_LOCATED_FORMS: Readonly<
  Record<
    "let" | "pattern" | "decorated" | "exportedClass",
    SameScopeDeclarationArm
  >
> = {
  let: {
    name: "a declarator without initializer `let SPEC;` (SPEC 2.4, 14)",
    line: "let SPEC;",
    construct: "SPEC",
  },
  pattern: {
    name: "a binding pattern `const { SPEC } = o` (SPEC 2.4, 14)",
    line: "declare const o: Record<string, number>;\nconst { SPEC } = o;",
    construct: "{ SPEC } = o",
  },
  decorated: {
    name: "a decorated class `@dec class SPEC {}` (SPEC 2.4, 14, 1.7)",
    line: "declare function dec(value: unknown, context: unknown): void;\n@dec class SPEC {}",
    construct: "@dec class SPEC {}",
  },
  exportedClass: {
    name: "an exported class `export class SPEC {}` (SPEC 2.4, 14, 1.7)",
    line: "export class SPEC {}",
    construct: "class SPEC {}",
  },
};

const T4_5_8_COLLIDING_ARMS: readonly SameScopeDeclarationArm[] = [
  {
    name: "a variable declaration `const SPEC = 1` (SPEC 2.4)",
    line: "const SPEC = 1;",
    construct: "SPEC = 1",
  },
  {
    name: "a function declaration `function SPEC() {}` (SPEC 2.4)",
    line: "function SPEC() {}",
    construct: "function SPEC() {}",
  },
  {
    name: "a class declaration `class SPEC {}` (SPEC 2.4)",
    line: "class SPEC {}",
    construct: "class SPEC {}",
  },
  {
    name: "an enum declaration `enum SPEC {}` (SPEC 2.4)",
    line: "enum SPEC {}",
    construct: "enum SPEC {}",
  },
  {
    name: "a namespace binding a value `namespace SPEC { export const v = 1 }` (SPEC 2.4)",
    line: "namespace SPEC { export const v = 1 }",
    construct: "namespace SPEC { export const v = 1 }",
  },
  ...Object.values(T4_5_8_FURTHER_LOCATED_FORMS),
  {
    name: "an exported function `export function SPEC() {}` (SPEC 2.4, 14, 1.7)",
    line: "export function SPEC() {}",
    construct: "function SPEC() {}",
  },
];

// The type-level controls: an interface, a type alias, and a namespace
// binding no value collide with nothing — the import roots the chains, the
// edges are recorded, no finding, exit 0 (SPEC 2.4, 4.5). An inner-scope
// `const SPEC = 1` shadows instead — T4.5-4's business.
const T4_5_8_CONTROL_ARMS: readonly SameScopeDeclarationArm[] = [
  {
    name: "an interface `interface SPEC {}` (type-level, SPEC 2.4)",
    line: "interface SPEC {}",
    construct: "",
  },
  {
    name: "a type alias `type SPEC = number` (type-level, SPEC 2.4)",
    line: "type SPEC = number;",
    construct: "",
  },
  {
    name: "a namespace binding no value `namespace SPEC { export type T = number }` (type-level, SPEC 2.4)",
    line: "namespace SPEC { export type T = number }",
    construct: "",
  },
];

/** A staged `src/app.ts` for one arm and its constructs' byte positions. */
interface StagedSameScopeArm {
  /** The whole file: import, blank, declaration, blank, marker, `text` call. */
  readonly source: string;
  /** The import declaration's end-widened byte window (support.ts byteWindow). */
  readonly importWindow: { readonly start: number; readonly end: number };
  /** The colliding construct's end-widened byte window (`""` construct: unused). */
  readonly constructWindow: { readonly start: number; readonly end: number };
  /** The marker's bare chain, exactly (SPEC 14: terminator excluded). */
  readonly markerRange: { readonly start: number; readonly end: number };
  /** The `text(...)` call, callee through closing parenthesis, exactly (14). */
  readonly textCallRange: { readonly start: number; readonly end: number };
}

/**
 * Lay out an arm's `src/app.ts` — the import, the declaration, then the
 * marker statement and the `text(...)` call statement, each on its own line
 * — and fix every construct's byte position from the exact bytes. The file
 * is pure ASCII, so string indices are byte offsets. A construct missing
 * from its line is a harness defect, never a product failure.
 */
function stageSameScopeArm(arm: SameScopeDeclarationArm): StagedSameScopeArm {
  const constructAt = arm.line.indexOf(arm.construct);
  if (constructAt === -1) {
    throw new Error(
      `T4.5-8 fixture broke: the located construct must occur within the ` +
        `declaration line (${arm.name}) — fix the arm table in section-4.5.ts`,
    );
  }
  const declarationPrefix = `${T4_5_8_IMPORT}\n\n`;
  const markerPrefix = `${declarationPrefix}${arm.line}\n\n`;
  const textCallPrefix = `${markerPrefix}${T4_5_8_MARKER_CHAIN};\n`;
  const source = `${textCallPrefix}${T4_5_8_TEXT_CALL};\n`;
  const exact = (
    prefix: string,
    construct: string,
  ): { start: number; end: number } => {
    const start = Buffer.byteLength(prefix, "utf8");
    return { start, end: start + Buffer.byteLength(construct, "utf8") };
  };
  return {
    source,
    importWindow: byteWindow("", T4_5_8_IMPORT),
    constructWindow: byteWindow(
      declarationPrefix + arm.line.slice(0, constructAt),
      arm.construct,
    ),
    markerRange: exact(markerPrefix, T4_5_8_MARKER_CHAIN),
    textCallRange: exact(textCallPrefix, T4_5_8_TEXT_CALL),
  };
}

/** A finding's locations as JSON-safe `[file, start, end]` tuples (12.7 order). */
function locationTuples(finding: Finding): readonly (readonly unknown[])[] {
  return finding.locations.map((location) => [
    location.file,
    location.range.start,
    location.range.end,
  ]);
}

/**
 * Assert a reference-spelling finding locates exactly one range — the span
 * its occurrence would occupy (SPEC 14, 5.7), byte-exact — in `file`, and
 * concerns no path (12.7).
 */
function assertSpellingFinding(
  finding: Finding,
  file: string,
  range: { readonly start: number; readonly end: number },
  context: string,
): void {
  assertFindingLocatesExactly(finding, [{ file, window: range }], context);
  assertSameJson(
    locationTuples(finding),
    [[file, range.start, range.end]],
    `${context}: the one location is byte-exact — the spelling's own span, ` +
      `terminators and delimiters excluded (SPEC 14, 5.7, 1.7)`,
  );
}

/**
 * Assert the findings a colliding arm's workspace reports, in 12.7 order:
 * condition 7 for the marker chain, condition 7 for the `text(...)` call
 * (each byte-exact at the span its occurrence would occupy, SPEC 14), then
 * the one condition-15 collision locating the import declaration and the
 * colliding construct, both within their own byte windows and nothing
 * else (14: every colliding declaration, no representative chosen).
 */
function assertSameScopeCollisionFindings(
  findings: readonly Finding[],
  staged: StagedSameScopeArm,
  context: string,
): void {
  assertSameJson(
    findings.map((finding) => finding.condition),
    ["14.7", "14.7", "14.15"],
    `${context}: exactly the two unresolved chains (condition 7, one per ` +
      `spelling) beside the one collision (condition 15), in 12.7 order — ` +
      `numbered conditions in numeric order, then by location (SPEC 2.4, ` +
      `4.5, 14.7, 14.15, 12.7)`,
  );
  assertSpellingFinding(
    findings[0]!,
    "src/app.ts",
    staged.markerRange,
    `${context}: the marker's 14.7 locates the bare reference chain, ` +
      `exclusive of the statement terminator (SPEC 14, 5.7)`,
  );
  assertSpellingFinding(
    findings[1]!,
    "src/app.ts",
    staged.textCallRange,
    `${context}: the \`text(...)\` call's 14.7 locates the call expression, ` +
      `callee through closing parenthesis (SPEC 14, 5.7)`,
  );
  assertFindingLocatesExactly(
    findings[2]!,
    [
      { file: "src/app.ts", window: staged.importWindow },
      { file: "src/app.ts", window: staged.constructWindow },
    ],
    `${context}: the 14.15 locates every colliding declaration — the import ` +
      `by its own characters and the non-import by the construct binding ` +
      `the name, a declarator by its own characters with the \`const\` ` +
      `statement excluded (SPEC 14, 1.7, 2.4)`,
  );
}

/**
 * One colliding arm: `build` and `check` report the collision beside
 * condition 7 for each chain, exit 1; `query edges --from src/app.ts` on the
 * failing workspace reports exactly those findings and exits 1 without
 * answering — the findings-only document, no edge (SPEC 13.3, 12.7); and
 * `occurrences --file src/app.ts`, answering on the failing workspace
 * (11.2), carries them and lists no record — a chain rooted at the collided
 * identifier records no edge and no occurrence (5.7).
 */
async function assertSameScopeCollisionArm(
  product: ProductBinding,
  arm: SameScopeDeclarationArm,
): Promise<void> {
  const staged = stageSameScopeArm(arm);
  await withWorkspace(
    SPEC_AND_CODE_CONFIG,
    { ...T4_5_8_SPEC_FILES, "src/app.ts": staged.source },
    async (workspace) => {
      const buildContext = `T4.5-8 \`build --json\` beside ${arm.name}`;
      assertSameScopeCollisionFindings(
        await buildFindings(product, workspace, buildContext),
        staged,
        buildContext,
      );

      // `check`: the same validation, exit 1 (SPEC 12.2). Staleness of the
      // never-built workspace's derived files is 14.10's own business —
      // set aside, the findings are exactly the collision arm's.
      const checkContext = `T4.5-8 \`check --json\` beside ${arm.name}`;
      const checkResult = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkContext} — \`check\` performs all build validations and ` +
          `exits 1 on the findings (SPEC 12.2, 2.4, 4.5)`,
      );
      assertSameScopeCollisionFindings(
        decodeFindingsReport(
          parseJsonStdout(checkResult, checkContext),
          checkContext,
        ).findings.filter((finding) => finding.condition !== "14.10"),
        staged,
        checkContext,
      );

      // `query edges --from src/app.ts`: the workspace fails `build`'s
      // validations, so the read reports exactly those findings and exits 1
      // without answering (SPEC 13.3) — the findings-only document, which
      // the form-exact decode enforces: no `edges` member beside it, so no
      // edge from the file is reported (SPEC 2.4, 5.7, 12.7).
      const queryContext = `T4.5-8 \`query edges --from src/app.ts\` beside ${arm.name}`;
      const queryResult = await expectExit(
        product,
        workspace,
        ["query", "edges", "--from", "src/app.ts"],
        1,
        `${queryContext} — a failing workspace's read reports the findings ` +
          `a \`build\` would now report and exits 1 without answering ` +
          `(SPEC 13.3, 12.0)`,
      );
      assertSameScopeCollisionFindings(
        decodeFindingsReport(
          parseJsonStdout(queryResult, queryContext),
          `${queryContext} — a refusing read's report is the findings-only ` +
            `document {"findings": […]}: no edge answered (SPEC 12.7, 13.3)`,
        ).findings,
        staged,
        queryContext,
      );

      // `occurrences --file src/app.ts`, answering on the failing workspace
      // (SPEC 11.2): the code file's findings accompany (exit 1, the full
      // answer still emitted), and the record set is empty — the two chains
      // rooted at the collided identifier record no edge and no occurrence
      // (5.7); their positions reach consumers through the findings alone.
      const occContext = `T4.5-8 \`occurrences --file src/app.ts\` beside ${arm.name}`;
      const occResult = await expectExit(
        product,
        workspace,
        ["occurrences", "--file", "src/app.ts"],
        1,
        `${occContext} — the answer carries the domain's findings, so exit ` +
          `1 with the full answer document (SPEC 11.2, 11.3)`,
      );
      const report = decodeOccurrencesReport(
        parseJsonStdout(
          occResult,
          `${occContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        occContext,
      );
      assertSameScopeCollisionFindings(
        report.findings,
        staged,
        `${occContext}: the code file's findings accompany the answer ` +
          `(SPEC 11.2, 11.3)`,
      );
      assertSameJson(
        report.occurrences.map(occurrenceTuple),
        [],
        `${occContext}: no record for the marker or the \`text(...)\` call — ` +
          `a chain rooted at an identifier the import and a same-scope ` +
          `value-level declaration both bind records no edge and no ` +
          `occurrence, its position reported by its finding's range alone ` +
          `(SPEC 2.4, 5.7, 11.2)`,
      );
    },
  );
}

/**
 * One type-level control arm: the declaration collides with nothing, so the
 * import roots both chains — `build` and `check` exit 0 (no finding), and
 * the file's complete outgoing edge set is the marker's `references` edge
 * and the call's `embeds` edge (SPEC 2.4, 4.5, 4.3).
 */
async function assertSameScopeControlArm(
  product: ProductBinding,
  arm: SameScopeDeclarationArm,
): Promise<void> {
  const staged = stageSameScopeArm(arm);
  await withWorkspace(
    SPEC_AND_CODE_CONFIG,
    { ...T4_5_8_SPEC_FILES, "src/app.ts": staged.source },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        `T4.5-8 \`build\` beside ${arm.name} — a type-level declaration of ` +
          `the module scope collides with nothing (SPEC 2.4, 4.5)`,
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        `T4.5-8 \`check\` beside ${arm.name} — no finding (SPEC 2.4, 4.5)`,
      );
      assertEdgeSetEqual(
        await queryEdgesFrom(product, workspace, "src/app.ts", "T4.5-8"),
        [
          { from: "src/app.ts", to: "specs/A.mdx#a", kind: "references" },
          { from: "src/app.ts", to: "specs/A.mdx#b", kind: "embeds" },
        ],
        `T4.5-8 beside ${arm.name}: the import roots both chains — the ` +
          `marker's \`references\` edge and the call's \`embeds\` edge are ` +
          `the file's complete outgoing edge set (SPEC 2.4, 4.5, 4.3, 4.6)`,
      );
    },
  );
}

// The spec-source case (SPEC 2.4, 2.1, 2.7): `specs/COL.mdx` holds an
// export statement declaring `BASE` beside the import binding `BASE`. The
// export statement is itself invalid (14.16), the collision is 14.15
// (locating the import and the declarator), and the `d` and `text(...)`
// spellings rooted at `BASE` are unresolved (14.5, 14.6) — no edge, no
// occurrence — though both targets exist in `specs/BASE.mdx`.
const T4_5_8_BASE_FILES = {
  "specs/BASE.mdx":
    '<S id="a">\nAlpha behavior.\n</S>\n\n<S id="b">\nBeta behavior.\n</S>\n',
} as const;
const T4_5_8_MDX_IMPORT = 'import BASE from "./BASE.xspec"';
const T4_5_8_MDX_EXPORT = "export const BASE = 1";
const T4_5_8_MDX_DECLARATOR = "BASE = 1";
const T4_5_8_MDX_D_REFERENCE = "BASE.a";
const T4_5_8_MDX_EMBEDDING = "{text(BASE.b)}";
const T4_5_8_MDX_SECTION_OPEN = `<S id="c" d={${T4_5_8_MDX_D_REFERENCE}}>`;
const T4_5_8_MDX_BODY_PREFIX = "Gamma behavior ";
/**
 * One staging of the spec-source case: how the import and the export
 * statement are laid out in `specs/COL.mdx` (SPEC 2.7, 2.1).
 */
interface SpecSourceCollisionArm {
  /** Which layout this is (failure diagnostics). */
  readonly name: string;
  /**
   * What separates the import's line from the export statement: U+000A
   * alone keeps both in one ESM block (the export on the line after the
   * import); a blank line ends the block, so the export opens a second one.
   */
  readonly separator: string;
}

const T4_5_8_SPEC_SOURCE_ARMS: readonly SpecSourceCollisionArm[] = [
  { name: "the two declarations in one ESM block", separator: "\n" },
  { name: "the two declarations across two ESM blocks", separator: "\n\n" },
];

/** A staged `specs/COL.mdx` of one arm and its constructs' byte positions. */
interface StagedSpecSourceCollision {
  /** The whole file: import, export statement, blank, section `c`. */
  readonly source: string;
  /** The import declaration's end-widened byte window (support.ts byteWindow). */
  readonly importWindow: { readonly start: number; readonly end: number };
  /** The declarator `BASE = 1`'s end-widened byte window. */
  readonly declaratorWindow: { readonly start: number; readonly end: number };
  /** The export statement's end-widened byte window. */
  readonly exportWindow: { readonly start: number; readonly end: number };
  /** The `d` value's expression, exactly (SPEC 14: braces excluded). */
  readonly dReferenceRange: { readonly start: number; readonly end: number };
  /** The embedding's full braced container, exactly (14). */
  readonly embeddingRange: { readonly start: number; readonly end: number };
}

/**
 * Lay out an arm's `specs/COL.mdx` — the import, the arm's separator, the
 * export statement, a blank line, then section `c` — and fix every
 * construct's byte position from the exact bytes (pure ASCII, so string
 * indices are byte offsets). The one-block layout is byte-for-byte the
 * document's staging (the export on the line after the import).
 */
function stageSpecSourceCollision(
  arm: SpecSourceCollisionArm,
): StagedSpecSourceCollision {
  const exportPrefix = `${T4_5_8_MDX_IMPORT}${arm.separator}`;
  const sectionPrefix = `${exportPrefix}${T4_5_8_MDX_EXPORT}\n\n`;
  const dPrefix = `${sectionPrefix}<S id="c" d={`;
  const bodyPrefix = `${sectionPrefix}${T4_5_8_MDX_SECTION_OPEN}\n${T4_5_8_MDX_BODY_PREFIX}`;
  const source = `${bodyPrefix}${T4_5_8_MDX_EMBEDDING}\n</S>\n`;
  const exact = (
    prefix: string,
    construct: string,
  ): { start: number; end: number } => {
    const start = Buffer.byteLength(prefix, "utf8");
    return { start, end: start + Buffer.byteLength(construct, "utf8") };
  };
  return {
    source,
    importWindow: byteWindow("", T4_5_8_MDX_IMPORT),
    declaratorWindow: byteWindow(
      `${exportPrefix}export const `,
      T4_5_8_MDX_DECLARATOR,
    ),
    exportWindow: byteWindow(exportPrefix, T4_5_8_MDX_EXPORT),
    dReferenceRange: exact(dPrefix, T4_5_8_MDX_D_REFERENCE),
    embeddingRange: exact(bodyPrefix, T4_5_8_MDX_EMBEDDING),
  };
}

/**
 * The spec-source case's findings in 12.7 order: 14.5 at the `d` value's
 * expression (the braces excluded), 14.6 at the embedding's full braced
 * container, 14.15 locating the import declaration and the declarator
 * `BASE = 1`, and 14.16 at the export statement whole (SPEC 14, 2.4, 2.7)
 * — the same four whichever ESM block holds the export (T14-12: a finding
 * in a well-formed file, never a parse failure).
 */
function assertSpecSourceCollisionFindings(
  findings: readonly Finding[],
  staged: StagedSpecSourceCollision,
  context: string,
): void {
  const file = "specs/COL.mdx";
  assertSameJson(
    findings.map((finding) => finding.condition),
    ["14.5", "14.6", "14.15", "14.16"],
    `${context}: exactly the unresolved \`d\` reference (14.5), the ` +
      `unresolved embedding (14.6), the collision (14.15), and the export ` +
      `statement's invalidity (14.16), in 12.7 order — never 14.20, the ` +
      `file being well-formed (SPEC 2.4, 2.1, 2.7, 14, 14.20)`,
  );
  assertSpellingFinding(
    findings[0]!,
    file,
    staged.dReferenceRange,
    `${context}: the 14.5 locates the \`d\` value's expression, the braces ` +
      `excluded (SPEC 14, 5.7)`,
  );
  assertSpellingFinding(
    findings[1]!,
    file,
    staged.embeddingRange,
    `${context}: the 14.6 locates the embedding's full braced container, ` +
      `opening brace through closing brace (SPEC 14, 5.7)`,
  );
  assertFindingLocatesExactly(
    findings[2]!,
    [
      { file, window: staged.importWindow },
      { file, window: staged.declaratorWindow },
    ],
    `${context}: the 14.15 locates the import by its own characters and ` +
      `the declarator the export statement holds by its own characters ` +
      `(SPEC 14, 1.7, 2.4, 2.1)`,
  );
  assertFindingLocatesExactly(
    findings[3]!,
    [{ file, window: staged.exportWindow }],
    `${context}: the 14.16 locates the export statement whole (SPEC 14, 2.7)`,
  );
}

/**
 * One spec-source arm: `build` and `check` report the four findings, exit
 * 1; the gated `query edges --from specs/COL.mdx#c` reports them without
 * answering (SPEC 13.3); and `occurrences --file specs/COL.mdx` carries
 * them and lists no record — no edge and no occurrence for the spellings
 * rooted at the collided identifier (5.7, 11.2). The staging names S-9's
 * `duplicate-import-binding` allowance: the export declaration binding the
 * import's identifier is the early error the stock parser raises for one
 * module, which every ESM block of a file is to it, so both layouts need
 * it — and 14.20 admits both (a finding in a well-formed file, T14-12).
 */
async function assertSpecSourceCollision(
  product: ProductBinding,
  arm: SpecSourceCollisionArm,
): Promise<void> {
  const staged = stageSpecSourceCollision(arm);
  await withWorkspace(
    SPEC_AND_CODE_CONFIG,
    { ...T4_5_8_BASE_FILES, "specs/COL.mdx": staged.source },
    async (workspace) => {
      const buildContext = `T4.5-8 \`build --json\` over the spec source declaring its import binding, ${arm.name}`;
      assertSpecSourceCollisionFindings(
        await buildFindings(product, workspace, buildContext),
        staged,
        buildContext,
      );

      const checkContext = `T4.5-8 \`check --json\` over the spec source declaring its import binding, ${arm.name}`;
      const checkResult = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkContext} — \`check\` performs all build validations and ` +
          `exits 1 on the findings (SPEC 12.2, 2.4)`,
      );
      assertSpecSourceCollisionFindings(
        decodeFindingsReport(
          parseJsonStdout(checkResult, checkContext),
          checkContext,
        ).findings.filter((finding) => finding.condition !== "14.10"),
        staged,
        checkContext,
      );

      const queryContext = `T4.5-8 \`query edges --from specs/COL.mdx#c\` on the failing workspace, ${arm.name}`;
      const queryResult = await expectExit(
        product,
        workspace,
        ["query", "edges", "--from", "specs/COL.mdx#c"],
        1,
        `${queryContext} — a failing workspace's read reports the findings ` +
          `a \`build\` would now report and exits 1 without answering ` +
          `(SPEC 13.3, 12.0)`,
      );
      assertSpecSourceCollisionFindings(
        decodeFindingsReport(
          parseJsonStdout(queryResult, queryContext),
          `${queryContext} — a refusing read's report is the findings-only ` +
            `document {"findings": […]}: no edge answered (SPEC 12.7, 13.3)`,
        ).findings,
        staged,
        queryContext,
      );

      const occContext = `T4.5-8 \`occurrences --file specs/COL.mdx\` on the failing workspace, ${arm.name}`;
      const occResult = await expectExit(
        product,
        workspace,
        ["occurrences", "--file", "specs/COL.mdx"],
        1,
        `${occContext} — the answer carries the domain's findings, so exit ` +
          `1 with the full answer document (SPEC 11.2, 11.3)`,
      );
      const report = decodeOccurrencesReport(
        parseJsonStdout(
          occResult,
          `${occContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        occContext,
      );
      assertSpecSourceCollisionFindings(
        report.findings,
        staged,
        `${occContext}: the spec source's findings accompany the answer ` +
          `(SPEC 11.2, 11.3)`,
      );
      assertSameJson(
        report.occurrences.map(occurrenceTuple),
        [],
        `${occContext}: no record for the \`d\` reference or the embedding ` +
          `rooted at the collided identifier — no edge, no occurrence, each ` +
          `positioned by its finding's range alone (SPEC 2.4, 5.7, 11.2)`,
      );
    },
    // S-9: the export declaration binding the import's identifier is an
    // ECMAScript early error 14.20 admits — the named allowance (its scope
    // spans both layouts; helpers/mdx-derivability.ts).
    { allowances: { "specs/COL.mdx": ["duplicate-import-binding"] } },
  );
}

const T4_5_8 = defineProductTest({
  id: "T4.5-8",
  title:
    "same-scope collisions: an identifier the spec module import binds that a module-scope `const`, `function`, `class`, `enum`, or value-binding `namespace` declaration also binds at value level roots no resolving chain — `build` and `check` report the condition-15 collision, locating the import by its own characters and the non-import by the construct binding the name (the declarator `SPEC = 1`, the `const` statement excluded; the further forms `let SPEC;` at `SPEC` alone, `const { SPEC } = o` at `{ SPEC } = o`, `@dec class SPEC {}` from its `@`, and `export class SPEC {}` / `export function SPEC() {}` from `class` / `function`, the `export` excluded), beside condition 7 for the marker `SPEC.a` and the call `text(SPEC.b)`, each at the span its occurrence would occupy, exit 1; the gated `query edges` reports no edge from the file and `occurrences` no record for the spellings; type-level `interface`, `type`, and value-free `namespace` declarations collide with nothing — edges recorded, no finding, exit 0; and a spec source holding `export const BASE = 1` beside `import BASE` reports 14.16 for the export statement, 14.15 locating the import and the declarator, and 14.5/14.6 for the `d` and `text(...)` spellings rooted at `BASE`, no edge and no occurrence recorded for them — the two declarations in one ESM block and, a second arm, across two blocks, each a finding in a well-formed file, never 14.20 (SPEC 2.4, 4.5, 2.1, 2.7, 5.7, 11.2, 12.7, 13.3, 14, 14.15, 14.20)",
  run: async (product) => {
    for (const arm of T4_5_8_COLLIDING_ARMS) {
      await assertSameScopeCollisionArm(product, arm);
    }
    for (const arm of T4_5_8_CONTROL_ARMS) {
      await assertSameScopeControlArm(product, arm);
    }
    for (const arm of T4_5_8_SPEC_SOURCE_ARMS) {
      await assertSpecSourceCollision(product, arm);
    }
  },
});

// ---------------------------------------------------------------------------
// T4.5-9 — a call through a colliding `text` identifier is no spec module's
// `text` call: no edge, no occurrence, no condition of a `text` call, while
// the spec binding or node its argument spells is used outside the
// sanctioned uses (14.18), beside the collision (14.15)
// ---------------------------------------------------------------------------

// Two spec modules each holding a node `a` (the second for the cross-module
// argument), and a non-spec module exporting `text` so the `./t` imports
// name an existing module (a consumer-side matter, SPEC 6.4).
const T4_5_9_FILES = {
  "specs/A.mdx": '<S id="a">\nAlpha behavior.\n</S>\n',
  "specs/B.mdx": '<S id="a">\nBravo behavior.\n</S>\n',
  "src/t.ts":
    "export function text(value: unknown): string {\n  return String(value);\n}\n",
} as const;

// The spec import binding `SPEC` and `text` — the `text` every arm's
// colliding declaration also binds (SPEC 4.5, 2.4).
const T4_5_9_IMPORT = 'import SPEC, { text } from "../specs/A.xspec";';
// The second module's default binding for the cross-module argument, staged
// where the colliding declaration does not bind it already (SPEC 4.4).
const T4_5_9_B_IMPORT = 'import B from "../specs/B.xspec";';

/** One module-scope declaration binding `text` beside the spec import. */
interface CollidingTextArm {
  /** Which colliding form this is (failure diagnostics). */
  readonly name: string;
  /** The declaration's line of `src/app.ts`, exactly (pure ASCII). */
  readonly line: string;
  /**
   * The construct a condition-15 finding locates (SPEC 14): an import
   * declaration by its own characters, a function declaration whole, or a
   * variable declarator — exactly as it occurs within `line`.
   */
  readonly construct: string;
  /** Whether `line` itself binds `B` to the second spec module. */
  readonly bindsB: boolean;
}

const T4_5_9_COLLIDING_ARMS: readonly CollidingTextArm[] = [
  {
    name: 'a second, non-spec import binding `text` (`import { text } from "./t"`)',
    line: 'import { text } from "./t";',
    construct: 'import { text } from "./t";',
    bindsB: false,
  },
  {
    name: 'a second spec module\'s `text` (`import B, { text } from "../specs/B.xspec"`)',
    line: 'import B, { text } from "../specs/B.xspec";',
    construct: 'import B, { text } from "../specs/B.xspec";',
    bindsB: true,
  },
  {
    name: 'a type-only import (`import type { text } from "./t"`)',
    line: 'import type { text } from "./t";',
    construct: 'import type { text } from "./t";',
    bindsB: false,
  },
  {
    name: "a function declaration `function text(x: unknown) {}`",
    line: "function text(x: unknown) {}",
    construct: "function text(x: unknown) {}",
    bindsB: false,
  },
  {
    name: 'a variable declaration `const text = (x: unknown) => ""`',
    line: 'const text = (x: unknown) => "";',
    construct: 'text = (x: unknown) => ""',
    bindsB: false,
  },
];

/** One argument of the call through the colliding `text` (SPEC 4.5). */
interface CollidingCallArgument {
  /** Which argument this is (failure diagnostics). */
  readonly name: string;
  /** The argument's characters, exactly (pure ASCII). */
  readonly spelling: string;
  /**
   * Whether the argument spells a spec module node — used there outside the
   * sanctioned uses, one 14.18 at its whole static chain (14) — or a string
   * literal spelling no binding or node (no 14.18, and no 14.8).
   */
  readonly spellsNode: boolean;
  /** Whether the argument spells the second module's node, needing `B` bound. */
  readonly needsB: boolean;
}

const T4_5_9_ARGUMENTS: readonly CollidingCallArgument[] = [
  {
    name: "the imported module's node `SPEC.a`",
    spelling: "SPEC.a",
    spellsNode: true,
    needsB: false,
  },
  {
    name: 'the string literal `"x"`',
    spelling: '"x"',
    spellsNode: false,
    needsB: false,
  },
  {
    name: "a valid second module's node `B.a`",
    spelling: "B.a",
    spellsNode: true,
    needsB: true,
  },
];

/** A staged `src/app.ts` for one cell and its constructs' byte positions. */
interface StagedCollidingTextCall {
  /** The whole file: the imports and the declaration, a blank line, the call. */
  readonly source: string;
  /** The spec import's end-widened byte window (support.ts byteWindow). */
  readonly importWindow: { readonly start: number; readonly end: number };
  /** The colliding construct's end-widened byte window. */
  readonly constructWindow: { readonly start: number; readonly end: number };
  /** The argument's static chain, exactly — the 14.18 range; none for the literal. */
  readonly argumentRange:
    { readonly start: number; readonly end: number } | undefined;
}

/**
 * Lay out a cell's `src/app.ts` — the spec import, then `import B` where
 * the argument needs it and the colliding declaration does not bind it,
 * then the colliding declaration, a blank line, and the call statement —
 * and fix every construct's byte position from the exact bytes (pure
 * ASCII, so string indices are byte offsets). A construct missing from its
 * line is a harness defect, never a product failure.
 */
function stageCollidingTextCall(
  arm: CollidingTextArm,
  argument: CollidingCallArgument,
): StagedCollidingTextCall {
  const constructAt = arm.line.indexOf(arm.construct);
  if (constructAt === -1) {
    throw new Error(
      `T4.5-9 fixture broke: the located construct must occur within the ` +
        `declaration line (${arm.name}) — fix the arm table in section-4.5.ts`,
    );
  }
  const bImport = argument.needsB && !arm.bindsB ? `${T4_5_9_B_IMPORT}\n` : "";
  const declarationPrefix = `${T4_5_9_IMPORT}\n${bImport}`;
  const argumentPrefix = `${declarationPrefix}${arm.line}\n\ntext(`;
  const source = `${argumentPrefix}${argument.spelling});\n`;
  const argumentStart = Buffer.byteLength(argumentPrefix, "utf8");
  return {
    source,
    importWindow: byteWindow("", T4_5_9_IMPORT),
    constructWindow: byteWindow(
      declarationPrefix + arm.line.slice(0, constructAt),
      arm.construct,
    ),
    argumentRange: argument.spellsNode
      ? {
          start: argumentStart,
          end: argumentStart + Buffer.byteLength(argument.spelling, "utf8"),
        }
      : undefined,
  };
}

/**
 * Assert the findings a cell's workspace reports, in 12.7 order: the one
 * condition-15 collision locating the spec import and the colliding
 * declaration (each within its own byte window, nothing else), then — for
 * an argument spelling a node — one 14.18 byte-exact at the argument's
 * whole static chain; no condition of a `text` call (14.6, 14.7, 14.8,
 * 14.11) beside them, the call being no spec module's (SPEC 4.5, 14).
 */
function assertCollidingTextCallFindings(
  findings: readonly Finding[],
  staged: StagedCollidingTextCall,
  argument: CollidingCallArgument,
  context: string,
): void {
  assertSameJson(
    findings.map((finding) => finding.condition),
    argument.spellsNode ? ["14.15", "14.18"] : ["14.15"],
    `${context}: exactly the collision (condition 15)` +
      (argument.spellsNode
        ? ` beside the unsupported use of the node the argument spells ` +
          `(condition 18)`
        : `, the argument spelling no binding or node`) +
      `, in 12.7 order — no 14.6, 14.7, 14.8, or 14.11: a call through a ` +
      `colliding \`text\` identifier is no spec module's \`text\` call ` +
      `(SPEC 4.5, 2.4, 14.15, 14.18)`,
  );
  assertFindingLocatesExactly(
    findings[0]!,
    [
      { file: "src/app.ts", window: staged.importWindow },
      { file: "src/app.ts", window: staged.constructWindow },
    ],
    `${context}: the 14.15 locates both declarations binding \`text\` — ` +
      `the spec import and the colliding declaration, each by the ` +
      `construct binding the name (SPEC 14, 1.7, 2.4)`,
  );
  if (staged.argumentRange !== undefined) {
    assertSpellingFinding(
      findings[1]!,
      "src/app.ts",
      staged.argumentRange,
      `${context}: the 14.18 locates the binding's identifier extended by ` +
        `its longest static chain — the argument \`${argument.spelling}\` ` +
        `exactly (SPEC 14, 14.18)`,
    );
  }
}

/**
 * One cell: `build` and `check` report the cell's findings, exit 1, and
 * `occurrences --file src/app.ts`, answering on the failing workspace
 * (11.2), carries them and lists no record — the call records no edge and
 * no occurrence (SPEC 4.5, 5.7, T5.7-4).
 */
async function assertCollidingTextCallCell(
  product: ProductBinding,
  arm: CollidingTextArm,
  argument: CollidingCallArgument,
): Promise<void> {
  const staged = stageCollidingTextCall(arm, argument);
  const cell = `${arm.name}, the argument ${argument.name}`;
  await withWorkspace(
    SPEC_AND_CODE_CONFIG,
    { ...T4_5_9_FILES, "src/app.ts": staged.source },
    async (workspace) => {
      const buildContext = `T4.5-9 \`build --json\` beside ${cell}`;
      assertCollidingTextCallFindings(
        await buildFindings(product, workspace, buildContext),
        staged,
        argument,
        buildContext,
      );

      // `check`: the same validation, exit 1 (SPEC 12.2); the never-built
      // workspace's staleness is 14.10's own business — set aside.
      const checkContext = `T4.5-9 \`check --json\` beside ${cell}`;
      const checkResult = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkContext} — \`check\` performs all build validations and ` +
          `exits 1 on the findings (SPEC 12.2, 4.5)`,
      );
      assertCollidingTextCallFindings(
        decodeFindingsReport(
          parseJsonStdout(checkResult, checkContext),
          checkContext,
        ).findings.filter((finding) => finding.condition !== "14.10"),
        staged,
        argument,
        checkContext,
      );

      // `occurrences --file src/app.ts`, answering on the failing workspace
      // (SPEC 11.2): the code file's findings accompany (exit 1, the full
      // answer still emitted), and the record set is empty — the call
      // records no edge and so no occurrence (5.7).
      const occContext = `T4.5-9 \`occurrences --file src/app.ts\` beside ${cell}`;
      const occResult = await expectExit(
        product,
        workspace,
        ["occurrences", "--file", "src/app.ts"],
        1,
        `${occContext} — the answer carries the domain's findings, so exit ` +
          `1 with the full answer document (SPEC 11.2, 11.3)`,
      );
      const report = decodeOccurrencesReport(
        parseJsonStdout(
          occResult,
          `${occContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        occContext,
      );
      assertCollidingTextCallFindings(
        report.findings,
        staged,
        argument,
        `${occContext}: the code file's findings accompany the answer ` +
          `(SPEC 11.2, 11.3)`,
      );
      assertSameJson(
        report.occurrences.map(occurrenceTuple),
        [],
        `${occContext}: no record for the call — a call through a ` +
          `colliding \`text\` identifier is no spec module's \`text\` call, ` +
          `recording no edge and no occurrence, its argument positioned by ` +
          `the 14.18 range alone (SPEC 4.5, 5.7, 11.2)`,
      );
    },
  );
}

// The control: a type alias `type text = number` beside the import collides
// with nothing (SPEC 2.4), so `text(SPEC.a)` is the spec module's `text`
// call — its `embeds` edge and occurrence recorded, no finding (4.3, 5.7).
const T4_5_9_CONTROL_LINE = "type text = number;";
const T4_5_9_CONTROL_CALL = "text(SPEC.a)";

async function assertCollidingTextControl(
  product: ProductBinding,
): Promise<void> {
  const callPrefix = `${T4_5_9_IMPORT}\n${T4_5_9_CONTROL_LINE}\n\n`;
  const source = `${callPrefix}${T4_5_9_CONTROL_CALL};\n`;
  const callStart = Buffer.byteLength(callPrefix, "utf8");
  const callEnd = callStart + Buffer.byteLength(T4_5_9_CONTROL_CALL, "utf8");
  // The record's own range spans the call, callee through closing
  // parenthesis, the terminator excluded; its source is the whole-file
  // location, no named unit enclosing it (SPEC 5.7, 4.6, 1.7).
  const expectedRecords: readonly (readonly unknown[])[] = [
    [
      "src/app.ts",
      callStart,
      callEnd,
      "embeds",
      ["src/app.ts", 0, Buffer.byteLength(source, "utf8")],
      "specs/A.mdx#a",
    ],
  ];
  await withWorkspace(
    SPEC_AND_CODE_CONFIG,
    { ...T4_5_9_FILES, "src/app.ts": source },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T4.5-9 `build` beside the type alias `type text = number` — a " +
          "type-level declaration of the module scope collides with " +
          "nothing (SPEC 2.4, 4.5)",
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        "T4.5-9 `check` beside the type alias `type text = number` — no " +
          "finding (SPEC 2.4, 4.5)",
      );
      assertEdgeSetEqual(
        await queryEdgesFrom(product, workspace, "src/app.ts", "T4.5-9"),
        [{ from: "src/app.ts", to: "specs/A.mdx#a", kind: "embeds" }],
        "T4.5-9 beside the type alias: the import roots the call — its " +
          "`embeds` edge is the file's complete outgoing edge set (SPEC " +
          "2.4, 4.5, 4.3, 4.6)",
      );
      const occContext =
        "T4.5-9 `occurrences --file src/app.ts` beside the type alias `type text = number`";
      const report = decodeOccurrencesReport(
        await runJson(
          product,
          workspace,
          ["occurrences", "--file", "src/app.ts"],
          `${occContext} — a clean domain answers with no finding, exit 0 ` +
            `(SPEC 11.2, 11.3)`,
        ),
        occContext,
      );
      assertConditionCounts(
        report.findings,
        {},
        `${occContext}: no finding accompanies the answer (SPEC 2.4, 11.2)`,
      );
      assertSameJson(
        report.occurrences.map(occurrenceTuple),
        expectedRecords,
        `${occContext}: exactly the call's \`embeds\` record — file, own ` +
          `range (callee through closing parenthesis), kind, whole-file ` +
          `source, target (SPEC 5.7, 11.3, 4.3)`,
      );
    },
  );
}

const T4_5_9 = defineProductTest({
  id: "T4.5-9",
  title:
    'call through a colliding `text` identifier: a call whose callee `text` the spec import and a second non-spec import, a second spec module\'s `text` import, a type-only import, a `function text(x: unknown) {}`, or a `const text = (x: unknown) => ""` of the same module scope also bind is no spec module\'s `text` call — `build` and `check` report 14.15 locating both declarations and, for `text(SPEC.a)`, 14.18 at `SPEC.a` (the identifier extended by its longest static chain), exit 1, no 14.6, 14.7, 14.8, or 14.11; `text("x")` beside the same collision reports no 14.8 and no 14.18; `text(B.a)`, `B` a valid second module\'s default binding, reports 14.18 at `B.a`, never 14.11; no edge and no occurrence — `occurrences --file` on the failing workspace lists none beside the findings; and the type alias `type text = number` beside the import collides with nothing, the call recording its `embeds` edge and occurrence, no finding (SPEC 4.5, 2.4, 5.7, 11.2, 14, 14.15, 14.18)',
  run: async (product) => {
    for (const arm of T4_5_9_COLLIDING_ARMS) {
      for (const argument of T4_5_9_ARGUMENTS) {
        await assertCollidingTextCallCell(product, arm, argument);
      }
    }
    await assertCollidingTextControl(product);
  },
});

/** TEST-SPEC §4.5, in canonical ID order (SUITE-15). */
export const section45Tests: readonly ProductTestEntry[] = [
  T4_5_1,
  T4_5_2,
  T4_5_3,
  T4_5_4,
  T4_5_5,
  T4_5_6,
  T4_5_7,
  T4_5_8,
  T4_5_9,
];
