// TEST-SPEC §6.6 (previews) — SUITE-24: T6.6-2. (T6.6-1 is retired;
// T6.6-3…T6.6-6 are staged by later plan tasks into this module.)
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

import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { AppliedMappingPair } from "../../helpers/adapters/index.js";
import {
  decodeAppliedMappingReport,
  decodePreviewReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertRunTwiceDeterministic } from "../../helpers/determinism.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertAppliedMapping,
  assertSameJson,
  buildOk,
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

export const section66Tests: readonly ProductTestEntry[] = [T6_6_2];
