// TEST-SPEC §6.6 (previews) — SUITE-24: T6.6-2, T6.6-3. (T6.6-1 is retired;
// T6.6-4…T6.6-6 are staged by later plan tasks into this module.)
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 layer, and
// rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.6: `xspec rename … --preview` and `xspec move … --preview` perform
// the full validation and planning of the operation and report its
// consequences while modifying nothing — no sources, no journal, no derived
// files, no graph data. A preview succeeds exactly when the real operation
// would proceed, its output is byte-deterministic (12.0), and under `--json`
// it emits the preview document form of 12.7 — `{"findings", "mapping",
// "files", "delta"}`, a form-exact surface (H-3, adapters/forms.ts) — whose
// `mapping` is the complete identity mapping the operation would journal.
//
// Conservative operationalizations (noted per H-4):
// - T6.6-2 "every byte of the workspace identical afterward" is a
//   whole-workspace-root byte snapshot compare around every preview
//   invocation (assertLeavesUnchanged), run after a premise `build` so
//   sources, generated modules, Markdown output, and graph data are all
//   present under the compare — a preview that refreshes derived state or
//   regenerates anything fails it. The journal premise (absent before the
//   first journaled operation, SPEC 6.1) makes the same compare realize "an
//   absent journal stays absent".
// - T6.6-2 "byte-deterministic across repeated runs" is H-6's
//   same-command-twice protocol (assertRunTwiceDeterministic:
//   byte-identical stdout, stderr, exit outcome, and workspace byte state
//   across the two runs), applied to the `--json` form and to the bare
//   (human) form alike — SPEC 6.6 pins determinism for preview output as
//   such, not for one output form. Human-form content is otherwise
//   unasserted (H-3: human reports are asserted only for required
//   information; this test requires none of it).
// - T6.6-2 "a subsequent real run on the same state performs the previewed
//   plan" is operationalized exactly as the TEST-SPEC entry states it: the
//   real operation on the untouched workspace succeeds (exit 0, `--json`,
//   a single JSON document as the entire stdout, 12.0) and its
//   applied-mapping report (T6.4-1's protocol; H-3 adapter, report shape
//   unpinned) carries exactly the preview's `mapping` pairs, compared as
//   complete sets (assertAppliedMapping; the preview document's `from`-byte
//   order is decode-enforced, SPEC 12.7). The mapping's fixture-expected
//   CONTENT is T6.6-4's business — here the contract is the equality.
// - A successful preview's `mapping`, `files`, and `delta` are non-`null`
//   (`null` is the refusal encoding, SPEC 6.6/12.7, and T6.6-2 stages
//   workspaces where the real operation would proceed); `files` and `delta`
//   content is T6.6-4's and T6.6-5's business.
// - T6.6-3 "the same findings (same stable codes, locations, identities;
//   14)": the real refused invocation runs first on the identical staging —
//   the refusal-case stagings and expectation tables are imported from
//   section-6.4.ts/section-6.5.ts (TEST-SPEC §6.6 "staged identically"), its
//   per-arm code counts re-pinned (the arm still isolates its staged
//   cause(s); the concerned-data assertions stay T6.4-3's/T6.5-4's) — and
//   the `--preview` invocation's findings are compared to it element-wise
//   over every finding member except `message`: code, locations, concerned
//   path, identities — the members SPEC 14/12.7 make contractual. Message
//   composition is deterministic but unpinned (12.0/12.7), and the preview
//   and the real run are distinct invocations, so equal wording is not
//   contract (H-4). Both arrays come out of the form-exact decode in 12.7's
//   total findings order, whose keys precede the message tie-break exactly
//   on the compared members, so element-wise comparison is exact.
// - T6.6-3 usage errors "exit 2 identically (argument checks precede either
//   way)": each T6.4-4/T6.5-5 usage-error invocation runs once — the real
//   invocation, then the `--preview` one — on the ordering-shaped staging
//   (unrelated validation errors present) where its source test stages one,
//   so exit 2 across the pair realizes the precedence clause; the
//   parse-local spells-no-identity arms re-pin their one-14.17 premise
//   first (T6.4-4's protocol), and every sweep sits inside a whole-root
//   modifies-nothing compare (SPEC 12.0).
// - T6.6-3 scheduling: the runs-while-held arm shares T13.5-2's staging and
//   the 13.5 suite's drive-during-hold choreography (section-13.5.ts
//   exports; CERTIFICATIONS.md's Exclusions note binds exactly this
//   sharing) — the same second command T13.5-2 asserts is refused exit 2
//   without `--preview` here runs to completion exit 0 with it while
//   command 1 is held. "Takes no exclusivity" is operationalized as that
//   observable (SPEC 6.6: completes while another mutating command holds
//   exclusivity — never the mutual-exclusion refusal, never blocked; a
//   blocking product is killed at the hang bound and fails diagnosed,
//   H-8/H-10), plus the held-baseline snapshot equality (the preview writes
//   nothing while held). `--test-hold` + `--preview` is asserted for both
//   operations and both flag orders: exit 2, the 12.7 error document under
//   --json, no hold file created, nothing modified.

import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type {
  AppliedMappingPair,
  Finding,
} from "../../helpers/adapters/index.js";
import {
  decodeAppliedMappingReport,
  decodeFindingsReport,
  decodePreviewReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertRunTwiceDeterministic } from "../../helpers/determinism.js";
import {
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type {
  ArgvValue,
  ProductBinding,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  pathExists,
  releaseHoldFile,
  runProduct,
  startProduct,
} from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  RENAME_REFUSAL_CASES,
  RENAME_REFUSAL_CONFIG,
  RENAME_REFUSAL_FILES,
  RENAME_SOLO_ARGV,
  RENAME_SOLO_FILES,
  RENAME_USAGE_CASES,
  RENAME_USAGE_CONFIG,
  RENAME_USAGE_ORDERING_FILES,
} from "./section-6.4.js";
import type { RefusalExpectation } from "./section-6.5.js";
import {
  MOVE_DERIVED_PATH_CASE,
  MOVE_DERIVED_PATH_CONFIG,
  MOVE_DERIVED_PATH_FILES,
  MOVE_MIXED_SYNOPSIS_CASES,
  MOVE_NON_UTF8_ARGV,
  MOVE_PRECONDITION_BREAK_FILE,
  MOVE_PRECONDITION_BREAK_SOURCE,
  MOVE_PRECONDITION_CASE,
  MOVE_PRECONDITION_FILES,
  MOVE_REFUSAL_CASES,
  MOVE_REFUSAL_CONFIG,
  MOVE_REFUSAL_FILES,
  MOVE_SOLO_ARGV,
  MOVE_SOLO_CONFIG,
  MOVE_SOLO_FILES,
  MOVE_USAGE_CASES,
  MOVE_USAGE_CONFIG,
  MOVE_USAGE_ORDERING_FILES,
  MOVE_WRONG_KIND_CASES,
  stageMoveRefusalOccupants,
} from "./section-6.5.js";
import {
  CORE_DECL,
  awaitHoldFile,
  describeExit,
  holdPathFor,
  runBounded,
} from "./section-13.5.js";
import {
  assertAppliedMapping,
  assertConditionCounts,
  assertSameJson,
  buildFindings,
  buildOk,
  expectErrorDocument,
  expectExit,
  runJson,
} from "./support.js";

// One spec group with Markdown emission (SPEC 7, 7.3), so the premise
// `build` materializes every derived-file kind — generated modules, Markdown
// output, and graph data — and the modifies-nothing compare covers them all.
const SPECS_MD_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

const JOURNAL_PATH = ".xspec/journal";

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
 * The T6.6-2 preview protocol over one operation whose real run would
 * proceed: inside one whole-root modifies-nothing compare (SPEC 6.6 — no
 * sources, no journal, no derived files, no graph data), run the `--preview
 * --json` invocation twice (H-6 byte determinism) asserting exit 0, decode
 * the first run's stdout as the form-exact 12.7 preview document, assert
 * `findings` is exactly `[]` and the plan members are non-`null`, then run
 * the bare `--preview` form twice (H-6 again, exit 0). Returns the preview's
 * `mapping` for the caller's real-run equality assertion.
 */
async function expectInertPreview(
  product: ProductBinding,
  workspace: TestWorkspace,
  operationArgv: readonly string[],
  context: string,
): Promise<readonly AppliedMappingPair[]> {
  const jsonArgv = [...operationArgv, "--preview", "--json"];
  const bareArgv = [...operationArgv, "--preview"];
  return await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const { first } = await assertRunTwiceDeterministic({
        binding: product,
        run: { cwd: workspace.root, argv: jsonArgv },
        context:
          `${context}: \`${jsonArgv.join(" ")}\` byte determinism across ` +
          `repeated runs (SPEC 6.6, 12.0; H-6)`,
      });
      assertExitCode(
        first,
        0,
        `${context}: \`${jsonArgv.join(" ")}\` — the preview succeeds ` +
          `exactly when the real operation would proceed, and this staging ` +
          `is a valid operation on a valid workspace (SPEC 6.6)`,
      );
      const report = decodePreviewReport(
        parseJsonStdout(
          first,
          `${context}: \`${jsonArgv.join(" ")}\` — a single JSON document ` +
            `as the entire stdout (SPEC 12.0)`,
        ),
        context,
      );
      assertSameJson(
        report.findings,
        [],
        `${context}: a preview whose real operation would proceed reports ` +
          `findings [] (SPEC 6.6, 12.7)`,
      );
      if (
        report.mapping === null ||
        report.files === null ||
        report.delta === null
      ) {
        fail(
          `${context}: a successful preview reports its plan — \`mapping\`, ` +
            `\`files\`, and \`delta\` are null exactly on refusal (SPEC 6.6, ` +
            `12.7); got mapping ${report.mapping === null ? "null" : "present"}, ` +
            `files ${report.files === null ? "null" : "present"}, delta ` +
            `${report.delta === null ? "null" : "present"}`,
        );
      }
      const bare = await assertRunTwiceDeterministic({
        binding: product,
        run: { cwd: workspace.root, argv: bareArgv },
        context:
          `${context}: \`${bareArgv.join(" ")}\` byte determinism across ` +
          `repeated runs (SPEC 6.6, 12.0; H-6 — determinism binds preview ` +
          `output as such, the bare form included)`,
      });
      assertExitCode(
        bare.first,
        0,
        `${context}: \`${bareArgv.join(" ")}\` — the bare-form preview of a ` +
          `proceeding operation succeeds too (SPEC 6.6, 12.0)`,
      );
      return report.mapping;
    },
    `${context}: every preview invocation modifies nothing — sources, ` +
      `journal (an absent journal stays absent), derived files, and graph ` +
      `data untouched (SPEC 6.6)`,
  );
}

/**
 * The staging premises shared by both arms: the staged workspace builds
 * (derived files and graph data now exist under the compare) and no journal
 * exists before the first journaled operation (SPEC 6.1) — so the
 * modifies-nothing compare around the previews realizes "an absent journal
 * stays absent", and the real run at the end is the first journaled
 * operation.
 */
async function assertPreviewPremises(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  await buildOk(product, workspace, `${context} premise \`build\``);
  const journalKind = await workspace.kind(JOURNAL_PATH);
  if (journalKind !== "absent") {
    fail(
      `${context}: staging premise — no journal file exists before the ` +
        `first journaled operation (SPEC 6.1); found ${journalKind} at ` +
        `${JOURNAL_PATH}`,
    );
  }
}

/**
 * The subsequent real run on the same (untouched) state: exit 0 with
 * `--json`, the applied-mapping report decoded through T6.4-1's H-3 adapter
 * and asserted equal — as a complete set — to the preview's `mapping`.
 */
async function assertRealRunPerformsPlan(
  product: ProductBinding,
  workspace: TestWorkspace,
  operationArgv: readonly string[],
  previewMapping: readonly AppliedMappingPair[],
  context: string,
): Promise<void> {
  const argv = [...operationArgv, "--json"];
  const applied = decodeAppliedMappingReport(
    await runJson(
      product,
      workspace,
      argv,
      `${context}: \`${argv.join(" ")}\``,
    ),
    context,
  );
  assertAppliedMapping(
    applied,
    previewMapping,
    `${context}: a subsequent real run on the same state performs the ` +
      `previewed plan — its applied mapping (T6.4-1's report) equals the ` +
      `preview's \`mapping\`, pair for pair (SPEC 6.6, 6.4, 6.5)`,
  );
}

// ---------------------------------------------------------------------------
// T6.6-2 — modifies nothing
// ---------------------------------------------------------------------------

// Rename arm: `core.mid` is mid-tree with a descendant (the mapping holds
// two pairs by prefix replacement) and is referenced by a sibling's local
// `d` and `text(...)` (SPEC 6.4 rewrites them), so the previewed plan spans
// several edits while the workspace stays a single file — the real rename is
// unambiguously valid: `core.hub` collides with nothing, its parent `core`
// exists, and the workspace has no findings.
const P1_CORE = "specs/Core.mdx";
const P1_CORE_SOURCE = [
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
const P1_RENAME_ARGV = ["rename", P1_CORE, "core.mid", "core.hub"] as const;

// Section-form move arm: `org.mv` moves into the existing Target.mdx as
// top-level `tm`. The subtree carries an internal local reference — on the
// moved root, pointing down at its own child, so the combined
// contains/depends graph stays acyclic (SPEC 5.3) — re-identified in place
// by the move, and is referenced from the staying `org.stay` (converted to
// imported form by the real move, an import added), so the previewed plan
// again spans several files — and the move is unambiguously valid: `tm`
// collides with nothing in Target.mdx, a single-segment `<new-id>` needs no
// target parent, and no cycle arises (Target.mdx imports nothing).
const P2_ORIGIN = "specs/Origin.mdx";
const P2_TARGET = "specs/Target.mdx";
const P2_ORIGIN_SOURCE = [
  '<S id="org">',
  "Origin holder text.",
  "",
  '<S id="org.mv" d={"org.mv.k1"}>',
  "Moved root text.",
  "",
  '<S id="org.mv.k1">',
  "Moved kid.",
  "</S>",
  "</S>",
  "",
  '<S id="org.stay" d={"org.mv.k1"}>',
  "Stays behind.",
  "</S>",
  "</S>",
  "",
].join("\n");
const P2_TARGET_SOURCE = ['<S id="tgt">', "Target text.", "</S>", ""].join(
  "\n",
);
const P2_MOVE_ARGV = [
  "move",
  `${P2_ORIGIN}#org.mv`,
  `${P2_TARGET}#tm`,
] as const;

const T6_6_2 = defineProductTest({
  id: "T6.6-2",
  title:
    "modifies nothing: a rename `--preview` and a section-form move `--preview` on workspaces where the real operation would proceed exit 0 with findings [] and leave every byte of the workspace identical — sources, journal (an absent journal stays absent), derived files, and graph data untouched; a subsequent real run on the same state performs the previewed plan, its applied mapping (T6.4-1's report) equal to the preview's `mapping`; preview output is byte-deterministic across repeated runs (H-6) and, under `--json`, the form-exact 12.7 preview document (SPEC 6.6, 6.4, 6.5, 6.1, 12.0, 12.7; H-3)",
  run: async (product) => {
    // Arm 1 — rename preview.
    await withWorkspace(
      SPECS_MD_CONFIG,
      { [P1_CORE]: P1_CORE_SOURCE },
      async (workspace) => {
        await assertPreviewPremises(product, workspace, "T6.6-2 rename arm");
        const previewMapping = await expectInertPreview(
          product,
          workspace,
          P1_RENAME_ARGV,
          "T6.6-2 rename arm",
        );
        await assertRealRunPerformsPlan(
          product,
          workspace,
          P1_RENAME_ARGV,
          previewMapping,
          "T6.6-2 rename arm",
        );
      },
    );

    // Arm 2 — section-form move preview.
    await withWorkspace(
      SPECS_MD_CONFIG,
      {
        [P2_ORIGIN]: P2_ORIGIN_SOURCE,
        [P2_TARGET]: P2_TARGET_SOURCE,
      },
      async (workspace) => {
        await assertPreviewPremises(product, workspace, "T6.6-2 move arm");
        const previewMapping = await expectInertPreview(
          product,
          workspace,
          P2_MOVE_ARGV,
          "T6.6-2 move arm",
        );
        await assertRealRunPerformsPlan(
          product,
          workspace,
          P2_MOVE_ARGV,
          previewMapping,
          "T6.6-2 move arm",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.6-3 — refusal and scheduling equivalence
// ---------------------------------------------------------------------------

/** Normalize a case's expected refusal finding(s) to a list (SPEC 14: an arm
 * staging several applicable reasons expects one finding per reason). */
function expectationsOf(
  expected: RefusalExpectation | readonly RefusalExpectation[],
): readonly RefusalExpectation[] {
  const expectations: readonly RefusalExpectation[] = Array.isArray(expected)
    ? expected
    : [expected];
  return expectations;
}

/**
 * The comparable projection of one 12.7 finding for T6.6-3's same-findings
 * assertion: every member except `message` — code, locations, concerned
 * path, identities (module header, H-4).
 */
function comparableFinding(finding: Finding): unknown {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
    identities: finding.identities,
  };
}

/**
 * One T6.6-3 refusal-equivalence arm over a staging where the real operation
 * is refused (T6.4-3/T6.5-4, staged identically): inside one whole-root
 * modifies-nothing compare, run the real invocation with `--json` — exit 1,
 * the form-exact 12.7 findings-only report, its per-arm code counts re-pinned
 * — then the `--preview --json` invocation: exit 1, the 12.7 preview document
 * form kept with `mapping`, `files`, and `delta` null (the refusal encoding),
 * and the same findings (module header's projection) as the real refusal
 * (SPEC 6.6, 12.7, 14).
 */
async function expectRefusedPreviewEquivalence(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  expected: RefusalExpectation | readonly RefusalExpectation[],
  context: string,
): Promise<void> {
  const expectations = expectationsOf(expected);
  const counts: Record<string, number> = {};
  for (const expectation of expectations) {
    counts[expectation.finding] = (counts[expectation.finding] ?? 0) + 1;
  }
  const command = argv.join(" ");
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      // The real operation on this state — the reference report.
      const real = await expectExit(
        product,
        workspace,
        [...argv, "--json"],
        1,
        `${context}: \`${command} --json\` — the real operation is refused ` +
          `on this staging, exit 1 (SPEC 6.4, 6.5, 12.0; T6.4-3/T6.5-4)`,
      );
      const realFindings = decodeFindingsReport(
        parseJsonStdout(real, `${context}: \`${command} --json\``),
        `${context}: \`${command} --json\` — a refused operation's report ` +
          `is the form-exact 12.7 findings-only report (SPEC 12.7, H-3)`,
      ).findings;
      assertConditionCounts(
        realFindings,
        counts,
        `${context}: staging premise — the arm still isolates exactly its ` +
          `staged refusal cause(s), one finding per applicable reason ` +
          `(SPEC 14; the concerned-data assertions live in T6.4-3/T6.5-4)`,
      );

      // The `--preview` invocation on the identical state: refused exactly
      // when — reporting what, and exiting as — the real operation is
      // refused (SPEC 6.6).
      const previewArgv = [...argv, "--preview", "--json"];
      const previewCommand = previewArgv.join(" ");
      const preview = await expectExit(
        product,
        workspace,
        previewArgv,
        1,
        `${context}: \`${previewCommand}\` — a preview is refused exactly ` +
          `when, and exits as, the real operation would be refused ` +
          `(SPEC 6.6, 12.0)`,
      );
      const report = decodePreviewReport(
        parseJsonStdout(preview, `${context}: \`${previewCommand}\``),
        `${context}: \`${previewCommand}\` — a refused preview keeps the ` +
          `12.7 preview document form (SPEC 12.7, H-3)`,
      );
      if (
        report.mapping !== null ||
        report.files !== null ||
        report.delta !== null
      ) {
        fail(
          `${context}: a refused preview reports the refusal findings ` +
            `alone — its \`mapping\`, \`files\`, and \`delta\` are null ` +
            `(SPEC 6.6, 12.7); got mapping ` +
            `${report.mapping === null ? "null" : "present"}, files ` +
            `${report.files === null ? "null" : "present"}, delta ` +
            `${report.delta === null ? "null" : "present"}`,
        );
      }
      assertSameJson(
        report.findings.map(comparableFinding),
        realFindings.map(comparableFinding),
        `${context}: the refused preview reports the same findings as the ` +
          `real refusal — same stable codes, locations, concerned paths, ` +
          `and identities, element-wise in 12.7's total findings order ` +
          `(message composition unpinned, H-4) (SPEC 6.6, 14, 12.7)`,
      );
    },
    `${context}: \`${command}\` — neither the refused operation nor its ` +
      `refused \`--preview\` modifies anything (SPEC 6.4, 6.5, 6.6)`,
  );
}

/**
 * One T6.6-3 usage-error-equivalence pair (T6.4-4/T6.5-5, staged
 * identically): the real invocation and then the `--preview` one, each with
 * `--json` — exit 2 exactly, the single 12.7 error document as the entire
 * stdout (12.0, H-5), and a usage error message on stderr (presence, not
 * wording). Argument checks precede either way (SPEC 6.6, 12.0). Accepts
 * raw-byte argv elements for the Linux-leg non-UTF-8 destination case.
 */
async function expectUsageErrorEitherWay(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly ArgvValue[],
  context: string,
): Promise<void> {
  const invocations: readonly (readonly [readonly ArgvValue[], string])[] = [
    [[...argv, "--json"], "real invocation"],
    [[...argv, "--preview", "--json"], "`--preview` invocation"],
  ];
  for (const [fullArgv, what] of invocations) {
    const label = `${context} (${what})`;
    const result = await runProduct(product, {
      cwd: workspace.root,
      argv: fullArgv,
    });
    assertExitCode(
      result,
      2,
      `${label}: the usage error is exit 2 with \`--preview\` exactly as ` +
        `without it — argument checks precede either way (SPEC 6.6, 12.0)`,
    );
    expectErrorDocument(
      result,
      `${label}: under --json, the exit-2 error document is the entire ` +
        `stdout — no report, no validation findings (SPEC 12.0, 12.7, H-5)`,
    );
    if (result.stderrBytes.length === 0) {
      fail(
        `${label}: usage error messages are standard-error content ` +
          `(SPEC 12.0), but stderr is empty`,
      );
    }
  }
}

/**
 * The spells-no-identity usage arms (T6.4-4/T6.5-5's parse-local
 * nonexistence, staged identically): pin the one-14.17 premise — a repeated
 * `id` is condition 17, never 14.1, and spells no identity (SPEC 11.2, 14)
 * — then assert the operation and its preview are exit 2 even beside that
 * file's findings, modifying nothing.
 */
async function runSoloUsageArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const findings = await buildFindings(
    product,
    workspace,
    `${context}: \`build --json\` premise — the staged workspace fails ` +
      `build validation (repeated \`id\` attribute, SPEC 14.17)`,
  );
  assertConditionCounts(
    findings,
    { "14.17": 1 },
    `${context}: staging premise — the repeated-\`id\` bearer is the ` +
      `file's one finding (SPEC 14: a repeated prop is condition 17, never ` +
      `condition 1)`,
  );
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      await expectUsageErrorEitherWay(
        product,
        workspace,
        argv,
        `${context} — the origin ID's only would-be bearer spells no ` +
          `identity, so the ID is nonexistent: exit 2 even beside that ` +
          `file's findings (SPEC 6.4, 6.5, 11.2, 12.0)`,
      );
    },
    `${context}: the usage errors modify nothing, previewed or not ` +
      `(SPEC 12.0)`,
  );
}

const T6_6_3 = defineProductTest({
  id: "T6.6-3",
  title:
    "refusal and scheduling equivalence: each refusal of T6.4-3 and T6.5-4 — the invalid-workspace precondition included — staged identically, the `--preview` invocation exits 1 reporting the same findings (same stable codes, locations, concerned paths, identities) in the form-exact 12.7 preview document with `mapping`, `files`, and `delta` null, modifying nothing; each usage error of T6.4-4/T6.5-5 exits 2 identically under `--preview` (argument checks precede either way — asserted beside unrelated validation errors and beside a spells-no-identity origin's findings, nothing modified); the equivalence is over workspace state, never scheduling: while another mutating command is held (`--test-hold`, T13.5-2's staging), a `--preview` invocation runs to completion with its full successful report — it takes no exclusivity and never meets the mutual-exclusion refusal — and `--test-hold` combined with `--preview` is a usage error, exit 2, creating no hold file (SPEC 6.6, 6.4, 6.5, 13.5, 12.0, 12.7, 14)",
  run: async (product) => {
    // --- Refusal equivalence: T6.4-3's cases, staged identically ---
    await withWorkspace(
      RENAME_REFUSAL_CONFIG,
      RENAME_REFUSAL_FILES,
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.6-3 rename-refusal staging `build` (the T6.4-3 protocol: " +
            "derived files sit under the modifies-nothing compares)",
        );
        for (const { argv, expected, reason } of RENAME_REFUSAL_CASES) {
          await expectRefusedPreviewEquivalence(
            product,
            workspace,
            argv,
            expected,
            `T6.6-3 rename refusal (${reason})`,
          );
        }
      },
    );

    // --- Refusal equivalence: T6.5-4's cases, staged identically ---
    await withWorkspace(
      MOVE_REFUSAL_CONFIG,
      MOVE_REFUSAL_FILES,
      async (workspace) => {
        // Occupants before the premise `build`, which must still pass
        // (T6.5-4's staging note).
        await stageMoveRefusalOccupants(workspace);
        await buildOk(
          product,
          workspace,
          "T6.6-3 move-refusal staging `build` (occupants staged before it; " +
            "T6.5-4's protocol)",
        );
        for (const { argv, expected, reason } of MOVE_REFUSAL_CASES) {
          await expectRefusedPreviewEquivalence(
            product,
            workspace,
            argv,
            expected,
            `T6.6-3 move refusal (${reason})`,
          );
        }
      },
    );

    // T6.5-4's derived-path arm, staged identically on its own workspace.
    await withWorkspace(
      MOVE_DERIVED_PATH_CONFIG,
      MOVE_DERIVED_PATH_FILES,
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.6-3 derived-path staging `build` — the occupant lies under no " +
            "current source's write path (T6.5-4's derived-path arm), so " +
            "the refusal previewed below is the move's own",
        );
        await expectRefusedPreviewEquivalence(
          product,
          workspace,
          MOVE_DERIVED_PATH_CASE.argv,
          MOVE_DERIVED_PATH_CASE.expected,
          `T6.6-3 move refusal (${MOVE_DERIVED_PATH_CASE.reason})`,
        );
      },
    );

    // T6.5-4's valid-workspace precondition arm, staged identically: the
    // invalid-workspace refusal previews as it refuses — the workspace's
    // numbered findings alone (SPEC 6.6, 6.4, 6.5, 14).
    await withWorkspace(
      MOVE_REFUSAL_CONFIG,
      MOVE_PRECONDITION_FILES,
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T6.6-3 precondition staging `build` over the staged workspace",
        );
        await workspace.file(
          MOVE_PRECONDITION_BREAK_FILE,
          MOVE_PRECONDITION_BREAK_SOURCE,
        );
        await expectRefusedPreviewEquivalence(
          product,
          workspace,
          MOVE_PRECONDITION_CASE.argv,
          MOVE_PRECONDITION_CASE.expected,
          `T6.6-3 move refusal (${MOVE_PRECONDITION_CASE.reason})`,
        );
      },
    );

    // --- Usage-error equivalence: T6.4-4's usage errors on its
    // ordering-shaped staging ---
    await withWorkspace(
      RENAME_USAGE_CONFIG,
      RENAME_USAGE_ORDERING_FILES,
      async (workspace) => {
        const context = "T6.6-3 rename usage";
        const findings = await buildFindings(
          product,
          workspace,
          `${context}: \`build --json\` premise — the staged workspace ` +
            `fails build validation (unresolved d reference, SPEC 14.5), ` +
            `so exit 2 across each pair realizes "argument checks precede ` +
            `either way" (T6.4-4's ordering arm)`,
        );
        if (findings.length === 0) {
          fail(
            `${context}: staging premise — the failing \`build\` must ` +
              `report at least one validation finding (SPEC 14)`,
          );
        }
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            for (const [argv, label] of RENAME_USAGE_CASES) {
              await expectUsageErrorEitherWay(
                product,
                workspace,
                argv,
                `${context}, ${label}`,
              );
            }
          },
          `${context}: the usage errors modify nothing, previewed or not ` +
            `(SPEC 12.0)`,
        );
      },
    );
    await withWorkspace(
      RENAME_REFUSAL_CONFIG, // the same specs-only configuration (T6.4-4)
      RENAME_SOLO_FILES,
      async (workspace) => {
        await runSoloUsageArm(
          product,
          workspace,
          RENAME_SOLO_ARGV,
          "T6.6-3 rename usage, spells-no-identity arm",
        );
      },
    );

    // --- Usage-error equivalence: T6.5-5's usage errors on its
    // ordering-shaped staging ---
    await withWorkspace(
      MOVE_USAGE_CONFIG,
      MOVE_USAGE_ORDERING_FILES,
      async (workspace) => {
        const context = "T6.6-3 move usage";
        const findings = await buildFindings(
          product,
          workspace,
          `${context}: \`build --json\` premise — the staged workspace ` +
            `fails build validation (unresolved d reference, SPEC 14.5), ` +
            `so exit 2 across each pair realizes "argument checks precede ` +
            `either way" (T6.5-5's ordering arm)`,
        );
        if (findings.length === 0) {
          fail(
            `${context}: staging premise — the failing \`build\` must ` +
              `report at least one validation finding (SPEC 14)`,
          );
        }
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            for (const [argv, label] of [
              ...MOVE_USAGE_CASES,
              ...MOVE_WRONG_KIND_CASES,
              ...MOVE_MIXED_SYNOPSIS_CASES,
            ]) {
              await expectUsageErrorEitherWay(
                product,
                workspace,
                argv,
                `${context}, ${label}`,
              );
            }
            // The non-UTF-8 destination operand (raw argv bytes) — Linux
            // leg only, as staged in T6.5-5.
            if (process.platform === "linux") {
              await expectUsageErrorEitherWay(
                product,
                workspace,
                MOVE_NON_UTF8_ARGV,
                `${context}, non-UTF-8 destination operand (raw argv ` +
                  `bytes, Linux leg — T6.5-5's staging)`,
              );
            }
          },
          `${context}: the usage errors modify nothing, previewed or not ` +
            `(SPEC 12.0)`,
        );
      },
    );
    await withWorkspace(
      MOVE_SOLO_CONFIG,
      MOVE_SOLO_FILES,
      async (workspace) => {
        await runSoloUsageArm(
          product,
          workspace,
          MOVE_SOLO_ARGV,
          "T6.6-3 move usage, spells-no-identity arm",
        );
      },
    );

    // --- Scheduling: the equivalence is over workspace state, never
    // scheduling (SPEC 6.6) — T13.5-2's staging and choreography ---
    const workspace = await TestWorkspace.create(CORE_DECL);
    try {
      await buildOk(product, workspace, "T6.6-3 scheduling staging `build`");

      const hold = holdPathFor(workspace, "hold-t663-primary.tmp");
      const context1 =
        "T6.6-3 held command 1 `rename specs/A.mdx a a2 --test-hold <path>` " +
        "(T13.5-2's staging)";
      const running = await startProduct(product, {
        cwd: workspace.root,
        argv: ["rename", "specs/A.mdx", "a", "a2", "--test-hold", hold],
      });
      try {
        await awaitHoldFile(running, hold, context1);
        const heldBaseline = await snapshotDirectory(workspace.root);

        // The same second command T13.5-2 asserts is refused exit 2 without
        // `--preview` runs to completion with it (SPEC 6.6, 13.5).
        const previewArgv = [
          "rename",
          "specs/A.mdx",
          "g",
          "g2",
          "--preview",
          "--json",
        ];
        const context = `T6.6-3 \`${previewArgv.join(" ")}\` while command 1 is held`;
        const result = await runBounded(
          product,
          workspace.root,
          previewArgv,
          context,
        );
        assertExitCode(
          result,
          0,
          `${context}: a preview invocation is a non-mutating command under ` +
            `13.5 — it takes no exclusivity, so while another mutating ` +
            `command is held it runs to completion, never meeting the ` +
            `mutual-exclusion refusal (exit 2) T13.5-2 asserts for the same ` +
            `second command without --preview, and never blocking ` +
            `(SPEC 6.6, 13.5)`,
        );
        const report = decodePreviewReport(
          parseJsonStdout(result, context),
          context,
        );
        assertSameJson(
          report.findings,
          [],
          `${context}: the preview runs to completion with its full ` +
            `successful report — findings [] (SPEC 6.6)`,
        );
        if (
          report.mapping === null ||
          report.files === null ||
          report.delta === null
        ) {
          fail(
            `${context}: the completed preview reports its plan — ` +
              `\`mapping\`, \`files\`, and \`delta\` non-null (SPEC 6.6, ` +
              `12.7)`,
          );
        }
        if (running.hasExited()) {
          fail(
            `${context}: command 1 must still be held when the preview ` +
              `completes — otherwise the completion is not attributable to ` +
              `the preview's taking no exclusivity (SPEC 6.6, 13.5) — ` +
              `${await describeExit(running)}`,
          );
        }
        assertSnapshotsEqual(
          heldBaseline,
          await snapshotDirectory(workspace.root),
          `${context}: the preview modifies nothing while another command ` +
            `is held (SPEC 6.6)`,
        );
        await releaseHoldFile(hold);
        let result1: RunResult;
        try {
          result1 = await running.waitForExit();
        } catch (error) {
          return fail(
            `${context1}: command 1 must complete normally once the hold ` +
              `file is deleted (SPEC 13.5) — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
        assertExitCode(
          result1,
          0,
          `${context1}: completes normally after release — it really held ` +
            `workspace exclusivity throughout the preview's run (SPEC 13.5)`,
        );
      } finally {
        running.kill();
        await releaseHoldFile(hold);
      }

      // `--test-hold` combined with `--preview` is a usage error (SPEC 6.6:
      // a preview acquires no exclusivity and does not take the
      // acquisition-tied test seam; 12.0): exit 2, the 12.7 error document
      // under --json, no hold file created, nothing modified. Both
      // operations, both flag orders; the operands stay valid (command 1's
      // rename completed above, leaving `a2` and the untouched `g`), so the
      // exit 2 is attributable to the flag combination alone.
      const combinedArms: readonly {
        readonly name: string;
        readonly build: (holdPath: string) => readonly string[];
      }[] = [
        {
          name: "rename, `--preview --test-hold`",
          build: (holdPath) => [
            "rename",
            "specs/A.mdx",
            "g",
            "g2",
            "--preview",
            "--test-hold",
            holdPath,
          ],
        },
        {
          name: "move, `--test-hold … --preview`",
          build: (holdPath) => [
            "move",
            "specs/A.mdx",
            "specs/Moved.mdx",
            "--test-hold",
            holdPath,
            "--preview",
          ],
        },
      ];
      let combinedIndex = 0;
      for (const arm of combinedArms) {
        combinedIndex += 1;
        const holdPath = holdPathFor(
          workspace,
          `hold-t663-combined-${String(combinedIndex)}.tmp`,
        );
        const argv = arm.build(holdPath);
        const context = `T6.6-3 (${arm.name}) \`${argv.join(" ")} --json\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await runBounded(
              product,
              workspace.root,
              [...argv, "--json"],
              context,
            );
            assertExitCode(
              result,
              2,
              `${context}: supplying --test-hold together with --preview is ` +
                `a usage error — a preview acquires no exclusivity and does ` +
                `not take the acquisition-tied test seam (SPEC 6.6, 13.5, ` +
                `12.0)`,
            );
            expectErrorDocument(
              result,
              `${context}: under --json, the exit-2 error document is the ` +
                `entire stdout (SPEC 12.0, 12.7, H-5)`,
            );
            if (result.stderrBytes.length === 0) {
              fail(
                `${context}: usage error messages are standard-error ` +
                  `content (SPEC 12.0), but stderr is empty`,
              );
            }
            if (await pathExists(holdPath)) {
              fail(
                `${context}: no hold file may be created at the path — the ` +
                  `flag combination is refused, not honored (SPEC 6.6, 13.5)`,
              );
            }
          },
          `${context}: the usage error modifies nothing (SPEC 12.0)`,
        );
      }
    } finally {
      await workspace.dispose();
    }
  },
});

export const section66Tests: readonly ProductTestEntry[] = [T6_6_2, T6_6_3];
