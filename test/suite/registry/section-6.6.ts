// TEST-SPEC §6.6 (previews) — SUITE-24: T6.6-2, T6.6-3, T6.6-4, T6.6-5,
// T6.6-6. (T6.6-1 is retired.)
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
// - T6.6-4 asserts the preview REPORT's content byte-precisely: expected
//   `mapping` and `files` are composed as complete exact lists from the
//   staged fixture bytes alone — locator helpers compute byte offsets from
//   the same strings the workspace stages (never from product output), and
//   multi-byte characters sit before every located construct so byte
//   offsets diverge from code-point and UTF-16 counts — and compared
//   list-for-list: an extra file entry, a missing edit, a phantom class, or
//   a one-byte range drift each fail; the rename arm's descendants `z` and
//   `c` stand in document order opposite to `from`-byte order, so a mapping
//   in document order fails the decoder's 12.7 order check and the exact
//   list alike (TEST-SPEC T6.6-4). Judgment calls pinned here (H-4): an
//   `id`-attribute rewrite spans the attribute's own characters (`id="…"`,
//   name through closing quote — SPEC 6.6 "the `id` attribute's own
//   characters", the construct-spelling reading its sibling clauses use for
//   the self-closing tag and the specifier literal, quotes included); the
//   self-closing target parent's insertion point maps to the tag's END in
//   pre-operation coordinates (every byte the operation adds — the appended
//   paired closing tag and the inserted text alike — attaches at that
//   offset, the only stable pre-operation anchor); an import addition's
//   offset is implementation latitude (SPEC 6.5), so the preview asserts it
//   structurally (exactly one such edit, zero-length, within the file) and
//   arm (b) pins it against the real operation's bytes by reconstruction:
//   the preview runs inside a whole-root modifies-nothing compare, the real
//   operation then executes on that pinned pre-operation state (TEST-SPEC's
//   "running the operation on a copy", H-4), and the rewritten file must
//   equal the pre-operation bytes with the known reference rewrite applied
//   and one added-import line — `\n`-preceded exactly when the offset is
//   mid-line (SPEC 6.5) — spliced in at exactly the previewed offset. The
//   12.7 edit comparator (range start, then range end, then class-name
//   bytes) is enforced by decodePreviewReport on every decoded document;
//   arm (e) stages the one geometry where the final tie-break can become
//   observable — a top-level `<new-id>` moved into an existing target file
//   whose rewrite requires an import addition in that same file, the
//   addition's implementation-chosen offset then free to coincide with the
//   end-of-file target insertion (`import-addition` ordering before
//   `target-insertion` on coincidence; TEST-SPEC T6.6-4). Delta content is
//   T6.6-5's business — asserted here only as the decode's success
//   encoding (non-null beside `mapping` and `files`).
// - T6.6-5 asserts the delta's content record-based, its expected sets
//   composed from the premise build's own observed writes (H-4): a source
//   `DIR/NAME.mdx`'s module-and-companion paths are the plain files the
//   build added under the 13.1 name shape `DIR/NAME.xspec.<suffix>` — the
//   module `DIR/NAME.xspec.ts` asserted present; the companion suffix set
//   is implementation latitude, so it is observed, never assumed — and its
//   Markdown path is the 13.2/7.3 destination, `DIR/NAME.md` next to the
//   source with `outDir` unset. Derived paths of a file not existing before
//   the operation (the moved-to file, the created target) are the origin's
//   observed suffix set transposed under the destination name (SPEC 13.1:
//   per-source derived paths are defined by the `NAME.mdx` name shape
//   alone). A partition self-check makes every premise-build write
//   attributable — graph data (T13.3-2's key rule, shared from
//   section-13.3.ts) or exactly one staged source's
//   module/companion/Markdown — failing diagnosed otherwise (SPEC 13.1–13.3
//   enumerate what `build` writes). The record itself is opaque (H-4), so
//   "recorded" is pinned through 13.3's contract — the record holds the
//   paths of the derived files most recently generated, exactly the premise
//   build's observed writes — and the delta assertions discriminate a
//   product recording anything else. The record-deleted arm (T13.3-2's
//   operational definition) asserts the record-based rule from both
//   directions: `generated` equal to the FULL post-move regeneration set —
//   the staying sources' paths listed although their files sit on disk, the
//   origin's still-on-disk paths in neither direction — and `removed`
//   exactly [] (nothing recorded), so a presence-based product fails both
//   set equalities. An absent record is nothing-recorded, the empty-record
//   SUCCESS path (SPEC 6.6: findings [], delta a plain value) — never the
//   14.23 unavailability of T6.6-6, which covers recorded state that exists
//   but cannot be read — and the preview never refreshes it (whole-root
//   compare around the invocation; graph data asserted still absent
//   afterward). The lagging-record arm builds WITHOUT emission, then enables
//   `markdown.emit` in the configuration and takes the same move preview
//   with no rebuild: the record holds modules and companions alone — a
//   lagging record alone is never staleness (SPEC 13.3), and a preview
//   never refreshes it — so `generated` is exactly the destination's
//   module, companions, and Markdown together with every OTHER discovered
//   source's Markdown emit destination (the paths the current configuration
//   generates that the stale record lacks; the staying sources' recorded
//   modules and companions regenerate in place, in neither direction; the
//   origin's Markdown, never recorded and not generated post-move, in
//   neither) and `removed` exactly the recorded pre-move module and
//   companions, no Markdown among them — a product composing either
//   direction from the configuration alone, or from presence, fails a set
//   equality; whole-root compare around the invocation.
// - T6.6-6 stages the unreadable record through the H-3 corrupt-record
//   adapter (record-staging.ts): shape-blind garbage — files present, their
//   bytes readable as no record, not even valid UTF-8 — over every
//   product-written plain file of T13.3-2's operational path set, applied
//   only after the premise `build` wrote them (never fabricated, H-3); the
//   staging's reachability is positively controlled by the condition-23
//   finding the arm itself asserts (CERTIFICATIONS.md's Exclusions note on
//   the shape-blind 14.23 stagings). "The full preview — `mapping` and
//   `files` complete … every other part of the preview report emitted in
//   full" (SPEC 14.23, TEST-SPEC T6.6-6) is operationalized as deep
//   equality against the intact-record run of the same preview first, on
//   the byte-identical sources: the staging is latitude-free — the moved
//   subtree is self-contained and nothing outside it references a moved
//   node, so the plan holds no import addition (SPEC 6.5's one preview
//   latitude) and is fully determined by sources + operation — with the
//   exact expected mapping pinned on both runs and re-pinned as the real
//   run's applied mapping (the preview's `mapping` IS the complete identity
//   mapping the operation then journals, SPEC 6.6). The condition-23
//   finding's `locations` are asserted exactly []: 14.23's concern is the
//   concerned-path member — the graph-data area, `.xspec` spelled
//   workspace-relative with no trailing separator (SPEC 11.6), no path
//   inside it named (the record's layout is deliberately unenumerated,
//   13.3) — and a path-concerned condition is an unlocated one (T12.7-1:
//   `locations` [] for unlocated conditions, `path` the concerned path).
//   Both corrupt-state previews — the full move preview and the refused
//   identity-unchanged rename preview — run inside ONE whole-root
//   modifies-nothing compare (a preview writes nothing and never refreshes
//   the record, SPEC 6.6/13.3, so the corrupt state persists byte for
//   byte), which makes the subsequent real move run on literally "the same
//   state"; its exit-0 success, applied mapping, and `check` exit 0 realize
//   "not refused — it proceeds, its finishing regeneration replacing the
//   corrupt record" (SPEC 6.6, 6.4, 14.10; T12.2-2's protocol).

import { Buffer } from "node:buffer";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type {
  AppliedMappingPair,
  Finding,
  PreviewDeltaDatum,
  PreviewEdit,
  PreviewEditClass,
  PreviewFileEntry,
  PreviewReport,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  GRAPH_DATA_AREA_PATH,
  corruptGraphDataShapeBlind,
  decodeAppliedMappingReport,
  decodeFindingsReport,
  decodePreviewReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertRunTwiceDeterministic } from "../../helpers/determinism.js";
import type { DirectorySnapshot } from "../../helpers/snapshot.js";
import {
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  displaySnapshotPath,
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
  MOVE_DERIVED_LINK_CASE,
  MOVE_DERIVED_LINK_FILES,
  MOVE_DERIVED_PATH_CASE,
  MOVE_DERIVED_PATH_CONFIG,
  MOVE_DERIVED_PATH_FILES,
  MOVE_LINK_OUTSIDE_CASES,
  MOVE_LINK_OUTSIDE_FILES,
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
  stageMoveDerivedLinkComponent,
  stageMoveLinkOutsideComponent,
  stageMoveRefusalOccupants,
} from "./section-6.5.js";
import {
  assertGraphDataPresent,
  deleteGraphData,
  isGraphDataKey,
} from "./section-13.3.js";
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
  assertFindingConcernsPath,
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

    // T6.5-4's outside-root link-component arms, staged identically on
    // their own workspace: the real operation and the preview alike leave
    // the link's target directory outside the root byte-identical.
    await withWorkspace(
      MOVE_REFUSAL_CONFIG,
      MOVE_LINK_OUTSIDE_FILES,
      async (workspace) => {
        const outside = await stageMoveLinkOutsideComponent(workspace);
        await buildOk(
          product,
          workspace,
          "T6.6-3 outside-root link staging `build` (the link staged before " +
            "it lies under no current source's write path; T6.5-4's protocol)",
        );
        for (const { argv, expected, reason } of MOVE_LINK_OUTSIDE_CASES) {
          await assertLeavesUnchanged(
            outside,
            () =>
              expectRefusedPreviewEquivalence(
                product,
                workspace,
                argv,
                expected,
                `T6.6-3 move refusal (${reason})`,
              ),
            `T6.6-3 move refusal (${reason}): the link's target directory ` +
              `outside the workspace root stays byte-identical across the ` +
              `real operation and its preview (SPEC 6.5, 6.6, 13.4)`,
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

    // T6.5-4's derived-path link sibling, staged identically on its own
    // workspace.
    await withWorkspace(
      MOVE_DERIVED_PATH_CONFIG,
      MOVE_DERIVED_LINK_FILES,
      async (workspace) => {
        await stageMoveDerivedLinkComponent(workspace);
        await buildOk(
          product,
          workspace,
          "T6.6-3 derived-path link-sibling staging `build` — the link " +
            "mdout/new lies under no current source's write path (T6.5-4's " +
            "sibling arm), so the refusal previewed below is the move's own",
        );
        await expectRefusedPreviewEquivalence(
          product,
          workspace,
          MOVE_DERIVED_LINK_CASE.argv,
          MOVE_DERIVED_LINK_CASE.expected,
          `T6.6-3 move refusal (${MOVE_DERIVED_LINK_CASE.reason})`,
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

// ---------------------------------------------------------------------------
// T6.6-4 — report content: the ten 12.7 edit classes, byte-precise
// ---------------------------------------------------------------------------

/** Byte length of `text` in UTF-8 — fixture offsets are byte offsets (1.7). */
function utf8Length(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Character index of exactly one occurrence of `fragment` in `haystack`.
 * Absent or ambiguous fragments fail loud as staging defects (harness
 * errors, never product failures): every located construct must be unique
 * in its container, or a precomputed offset could silently name the wrong
 * bytes.
 */
function uniqueCharIndex(
  haystack: string,
  fragment: string,
  where: string,
): number {
  const first = haystack.indexOf(fragment);
  if (first === -1) {
    throw new Error(
      `T6.6-4 staging locator (${where}): fragment ${JSON.stringify(fragment)} not found`,
    );
  }
  if (haystack.indexOf(fragment, first + 1) !== -1) {
    throw new Error(
      `T6.6-4 staging locator (${where}): fragment ${JSON.stringify(fragment)} is ambiguous`,
    );
  }
  return first;
}

/** Byte span of the unique `fragment` within `source` (SPEC 1.7). */
function uniqueSpan(
  source: string,
  fragment: string,
  where: string,
): SourceRange {
  const start = utf8Length(
    source.slice(0, uniqueCharIndex(source, fragment, where)),
  );
  return { start, end: start + utf8Length(fragment) };
}

/**
 * Byte span of `fragment` within the unique `container` within `source` —
 * for constructs whose own spelling recurs in the file (a `d` entry equal to
 * an `id` attribute's quoted value), located unambiguously through their
 * containing construct.
 */
function spanWithin(
  source: string,
  container: string,
  fragment: string,
  where: string,
): SourceRange {
  const containerIndex = uniqueCharIndex(
    source,
    container,
    `${where} (container)`,
  );
  const inner = uniqueCharIndex(container, fragment, `${where} (fragment)`);
  const start =
    utf8Length(source.slice(0, containerIndex)) +
    utf8Length(container.slice(0, inner));
  return { start, end: start + utf8Length(fragment) };
}

/** The zero-length insertion-point range at a byte offset (SPEC 6.6, 12.7). */
function insertionPoint(offset: number): SourceRange {
  return { start: offset, end: offset };
}

/** One expected preview edit — same information as the decoded form. */
interface ExpectedEdit {
  readonly class: PreviewEditClass;
  readonly range: SourceRange;
}

/**
 * The pinned 12.7 edit order — range start, then range end, then class-name
 * bytes — applied to composed EXPECTED lists so they meet the product's
 * decode-enforced order; the order assertion itself lives in
 * decodePreviewReport (form-exact, H-3), so sorting the expectation is
 * composition, not tautology.
 */
function editsInPinnedOrder(
  edits: readonly ExpectedEdit[],
): readonly ExpectedEdit[] {
  return [...edits].sort(
    (a, b) =>
      a.range.start - b.range.start ||
      a.range.end - b.range.end ||
      Buffer.compare(
        Buffer.from(a.class, "utf8"),
        Buffer.from(b.class, "utf8"),
      ),
  );
}

/** Readable projection for exact edit-list comparison diagnoses. */
function projectEdits(edits: readonly (PreviewEdit | ExpectedEdit)[]): unknown {
  return edits.map((edit) => ({
    class: edit.class,
    start: edit.range.start,
    end: edit.range.end,
  }));
}

/**
 * Staging self-check: every claimed-nested expected edit lies inside the
 * origin deletion's range — the containment geometry SPEC 6.6 states for the
 * moved text's own rewrites. A violation is a defect in THIS fixture's
 * arithmetic, never a product failure, so it throws a plain error.
 */
function assertComposedWithin(
  outer: SourceRange,
  nested: readonly ExpectedEdit[],
  where: string,
): void {
  for (const edit of nested) {
    if (edit.range.start < outer.start || edit.range.end > outer.end) {
      throw new Error(
        `T6.6-4 staging self-check (${where}): composed ${edit.class} edit ` +
          `[${String(edit.range.start)}, ${String(edit.range.end)}) must nest inside ` +
          `the origin deletion [${String(outer.start)}, ${String(outer.end)}) ` +
          `(SPEC 6.6: containment is geometry)`,
      );
    }
  }
}

/**
 * One expected `files` entry. When `importAdditionLatitude` is set, the
 * entry must carry — beyond the exact `edits` — exactly one
 * `import-addition` edit whose offset is the product's own choice (SPEC 6.5
 * implementation latitude, exercised deterministically): asserted
 * zero-length and within the file, its offset captured for the caller.
 */
interface ExpectedPreviewFile {
  readonly file: string;
  readonly edits: readonly ExpectedEdit[];
  readonly importAdditionLatitude?: { readonly sourceByteLength: number };
}

interface ExpectedPreviewPlan {
  readonly mapping: readonly AppliedMappingPair[];
  readonly files: readonly ExpectedPreviewFile[];
}

/**
 * Assert a successful preview's plan content exactly (T6.6-4): findings
 * `[]`; `mapping` equal to the complete expected identity mapping, pair for
 * pair in the decode-enforced `from`-byte order; `files` equal entry for
 * entry — same files, same edits, byte-precise ranges against the
 * precomputed pre-operation offsets, in the decode-enforced 12.7 edit order
 * — with the import-addition latitude slots handled per
 * {@link ExpectedPreviewFile}. Returns the captured import-addition offsets
 * by file. Delta content is T6.6-5's business (non-null is the success
 * encoding, asserted here).
 */
function assertPreviewPlanContent(
  report: PreviewReport,
  expected: ExpectedPreviewPlan,
  context: string,
): ReadonlyMap<string, number> {
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
        `\`files\`, and \`delta\` are null exactly on refusal (SPEC 6.6, 12.7); ` +
        `got mapping ${report.mapping === null ? "null" : "present"}, files ` +
        `${report.files === null ? "null" : "present"}, delta ` +
        `${report.delta === null ? "null" : "present"}`,
    );
  }
  assertSameJson(
    report.mapping,
    expected.mapping,
    `${context}: \`mapping\` is the complete identity mapping the operation ` +
      `would journal — the renamed/moved ID and every descendant (file-form: ` +
      `every node of the file, the implicit root included), one {"from", ` +
      `"to"} per mapped identity in \`from\`-byte order, nothing else ` +
      `(SPEC 6.6, 6.4, 6.5, 12.7)`,
  );
  const files = report.files;
  if (files.length !== expected.files.length) {
    fail(
      `${context}: \`files\` must hold one {"file", "edits"} entry per file ` +
        `the operation would rewrite, relocate, or create — expected ` +
        `[${expected.files.map((f) => f.file).join(", ")}], got ` +
        `[${files.map((f) => renderPathValue(f.file)).join(", ")}] (SPEC 6.6, 12.7)`,
    );
  }
  const captured = new Map<string, number>();
  for (let i = 0; i < expected.files.length; i += 1) {
    const want = expected.files[i]!;
    const got = files[i]!;
    if (got.file !== want.file) {
      fail(
        `${context}: files[${String(i)}] must be ${JSON.stringify(want.file)} ` +
          `— entries under current, pre-operation paths (target-file ` +
          `creation under the path the creation would occupy), ordered by ` +
          `file path bytes (SPEC 6.6, 12.7); got ${renderPathValue(got.file)}`,
      );
    }
    const latitude = want.importAdditionLatitude;
    if (latitude === undefined) {
      assertSameJson(
        projectEdits(got.edits),
        projectEdits(want.edits),
        `${context}: ${want.file} — every edit the operation would make ` +
          `there, class-plus-range only, byte-precise against the ` +
          `precomputed pre-operation offsets, in 12.7's pinned edit order ` +
          `(SPEC 6.6, 12.7)`,
      );
      continue;
    }
    const additions = got.edits.filter(
      (edit) => edit.class === "import-addition",
    );
    const rest = got.edits.filter((edit) => edit.class !== "import-addition");
    if (additions.length !== 1) {
      fail(
        `${context}: ${want.file} — the rewrite requires exactly one added ` +
          `import here, so the entry carries exactly one import-addition ` +
          `edit (SPEC 6.5, 6.6); got ${String(additions.length)} ` +
          `(edits: ${JSON.stringify(projectEdits(got.edits))})`,
      );
    }
    const addition = additions[0]!;
    if (addition.range.start !== addition.range.end) {
      fail(
        `${context}: ${want.file} — an import addition is a zero-length ` +
          `range at the insertion offset (SPEC 6.6, 12.7); got ` +
          `[${String(addition.range.start)}, ${String(addition.range.end)})`,
      );
    }
    if (
      addition.range.start < 0 ||
      addition.range.start > latitude.sourceByteLength
    ) {
      fail(
        `${context}: ${want.file} — the import addition's offset is ` +
          `implementation latitude (SPEC 6.5) but must lie within the ` +
          `file's ${String(latitude.sourceByteLength)} pre-operation bytes; ` +
          `got ${String(addition.range.start)}`,
      );
    }
    assertSameJson(
      projectEdits(rest),
      projectEdits(want.edits),
      `${context}: ${want.file} — the edits beside the ` +
        `implementation-latitude import addition, class-plus-range only, ` +
        `byte-precise in 12.7's pinned order (SPEC 6.6, 12.7)`,
    );
    captured.set(want.file, addition.range.start);
  }
  return captured;
}

/**
 * Run `<operation> --preview --json`: exit 0 (the staging's premise `build`
 * passed, so the real operation would proceed and the preview succeeds with
 * it, SPEC 6.6), a single JSON document as the entire stdout (12.0), decoded
 * as the form-exact 12.7 preview document (H-3) — the decode also enforcing
 * the full 12.7 edit comparator, range start, then range end, then
 * class-name bytes, over whatever edits are emitted (T6.6-4's tie-break
 * assertion).
 */
async function runPreviewJson(
  product: ProductBinding,
  workspace: TestWorkspace,
  operationArgv: readonly string[],
  context: string,
): Promise<PreviewReport> {
  const argv = [...operationArgv, "--preview", "--json"];
  const result = await expectExit(
    product,
    workspace,
    argv,
    0,
    `${context}: \`${argv.join(" ")}\` — the preview succeeds exactly when ` +
      `the real operation would proceed, and this staging's premise build ` +
      `passed (SPEC 6.6, 12.0)`,
  );
  return decodePreviewReport(
    parseJsonStdout(
      result,
      `${context}: \`${argv.join(" ")}\` — a single JSON document as the ` +
        `entire stdout (SPEC 12.0)`,
    ),
    context,
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Arm (b)'s real-run pin on the import addition (TEST-SPEC T6.6-4: "the
 * exact offset the real operation then uses … byte-asserted by running the
 * operation on a copy"): after the real operation runs on the
 * preview-pinned pre-operation state, the rewritten file's bytes must equal
 * the pre-operation bytes with (1) the known reference rewrite applied over
 * its precomputed span — the fresh binding is the product's choice (SPEC
 * 6.5), read out of the one added import declaration — and (2) one
 * added-import segment spliced in at exactly the previewed offset: the
 * declaration's characters followed by U+000A, preceded by one exactly when
 * the offset is not at the start of a line (SPEC 6.5). Any other insertion
 * point, extent, or byte change fails the reconstruction.
 */
async function assertRealRunInsertsImportAtPreviewedOffset(
  product: ProductBinding,
  workspace: TestWorkspace,
  options: {
    readonly operationArgv: readonly string[];
    readonly file: string;
    readonly preSource: string;
    /** The one reference-rewrite span in `file` (pre-operation bytes). */
    readonly referenceSpan: SourceRange;
    /** Rewritten chain minus its root binding, e.g. `.tp.nw.kid` (6.4). */
    readonly rewrittenChainSuffix: string;
    /** The added import's specifier, e.g. `./Target.xspec` (2.1, 6.5). */
    readonly importSpecifier: string;
    /** The previewed import-addition offset (pre-operation bytes). */
    readonly additionOffset: number;
  },
  context: string,
): Promise<void> {
  const {
    operationArgv,
    file,
    preSource,
    referenceSpan,
    rewrittenChainSuffix,
    importSpecifier,
    additionOffset,
  } = options;
  const declarationPattern = new RegExp(
    `import[ \\t]+([A-Za-z_$][A-Za-z0-9_$]*)[ \\t]+from[ \\t]+(["'])${escapeRegExp(importSpecifier)}\\2`,
    "g",
  );
  if (preSource.match(declarationPattern) !== null) {
    throw new Error(
      `T6.6-4 staging self-check: ${file} must import ${importSpecifier} ` +
        `nowhere before the operation, so the one post-operation match is ` +
        `the added declaration`,
    );
  }

  await expectExit(
    product,
    workspace,
    operationArgv,
    0,
    `${context}: \`${operationArgv.join(" ")}\` — the real operation on the ` +
      `preview-pinned state proceeds (SPEC 6.5; the premise build passed ` +
      `and the preview above modified nothing)`,
  );

  const postBytes = await workspace.readBytes(file);
  let postText: string;
  try {
    postText = new TextDecoder("utf-8", { fatal: true }).decode(postBytes);
  } catch {
    return fail(
      `${context}: the rewritten ${file} must remain valid UTF-8 ` +
        `(SPEC 1.6, 6.5)`,
    );
  }
  const matches = [...postText.matchAll(declarationPattern)];
  if (matches.length !== 1) {
    return fail(
      `${context}: the rewrite leaves ${file} needing exactly one module ` +
        `binding for ${importSpecifier}, added as one import declaration ` +
        `(SPEC 6.5, 2.1); found ${String(matches.length)} in the rewritten file`,
    );
  }
  const binding = matches[0]![1]!;
  const rewrittenReference = `${binding}${rewrittenChainSuffix}`;

  const preBytes = Buffer.from(preSource, "utf8");
  const expectedWithReference = Buffer.concat([
    preBytes.subarray(0, referenceSpan.start),
    Buffer.from(rewrittenReference, "utf8"),
    preBytes.subarray(referenceSpan.end),
  ]);
  if (
    additionOffset > referenceSpan.start &&
    additionOffset < referenceSpan.end
  ) {
    return fail(
      `${context}: the previewed import-addition offset ` +
        `${String(additionOffset)} lies inside the rewritten reference ` +
        `[${String(referenceSpan.start)}, ${String(referenceSpan.end)}) — no ` +
        `file grammar permits an import declaration inside a reference ` +
        `(SPEC 6.5, 2.1)`,
    );
  }
  const adjustedOffset =
    additionOffset <= referenceSpan.start
      ? additionOffset
      : additionOffset +
        (utf8Length(rewrittenReference) -
          (referenceSpan.end - referenceSpan.start));

  const head = expectedWithReference.subarray(0, adjustedOffset);
  const tail = expectedWithReference.subarray(adjustedOffset);
  const insertedLength = postBytes.length - expectedWithReference.length;
  const describePost = (): string =>
    `rewritten ${file}: ${JSON.stringify(postText)}`;
  if (insertedLength <= 0) {
    return fail(
      `${context}: the real operation must add one import line to ${file} ` +
        `beyond the reference rewrite (SPEC 6.5); the rewritten file is not ` +
        `longer than the reference-rewritten pre-operation bytes — ${describePost()}`,
    );
  }
  if (
    Buffer.compare(postBytes.subarray(0, head.length), head) !== 0 ||
    Buffer.compare(postBytes.subarray(postBytes.length - tail.length), tail) !==
      0
  ) {
    return fail(
      `${context}: the real operation must insert the added import at ` +
        `exactly the previewed offset ${String(additionOffset)} ` +
        `(pre-operation coordinates; SPEC 6.5: in a file existing before ` +
        `the operation the offset is exactly the one the preview reports, ` +
        `6.6) and change no other byte of ${file} beyond the reference ` +
        `rewrite — ${describePost()}`,
    );
  }
  const inserted = postBytes.subarray(
    head.length,
    head.length + insertedLength,
  );
  const atLineStart =
    additionOffset === 0 || preBytes[additionOffset - 1] === 0x0a;
  const insertedPattern = new RegExp(
    `^${atLineStart ? "" : "\\n"}import[ \\t]+${escapeRegExp(binding)}[ \\t]+from[ \\t]+(["'])${escapeRegExp(importSpecifier)}\\1;?\\n$`,
  );
  const insertedText = Buffer.from(inserted).toString("utf8");
  if (!insertedPattern.test(insertedText)) {
    fail(
      `${context}: the added import is inserted as a line of its own — the ` +
        `declaration's characters followed by U+000A, preceded by one ` +
        `exactly when the insertion point is not at the start of a line ` +
        `(here it ${atLineStart ? "is" : "is not"}; SPEC 6.5); the bytes at ` +
        `the previewed offset are ${JSON.stringify(insertedText)}`,
    );
  }
}

// One spec group, no Markdown emission, no code group — arms (b)–(e) rewrite
// MDX alone, and the derived-file delta's content is T6.6-5's business.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// Arm (a) adds a code group: the rename's reference rewrites span MDX and TS
// (TEST-SPEC T6.6-4(a)).
const SPECS_AND_CODE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

// --- Arm (a): rename preview — id-rewrites and the four 5.7 occurrence
// kinds across MDX and TS. `core.mid` (with descendants `core.mid.z` and
// `core.mid.c`, in that document order) is renamed to `core.hub`; affected
// references, all through `core.mid.z`: two `d` entries and one MDX
// embedding in the origin file (string form), a `d` chain and an embedding
// in a second MDX file (external form), and a marker plus a `text(...)` call
// in a TS file. Controls that must produce NO edit: `d={"core.plain"}` (its
// target keeps its identity), every unaffected `id` attribute, and the
// unrelocated `./Core.xspec` import specifiers. Multi-byte text ("hölder",
// "ünicode", "Δ") precedes every located construct.
//
// The mapping-order fixture (TEST-SPEC T6.6-4): the descendants stand in
// document order (`z` before `c`) opposite to the byte order of their
// `from` identities (`…#core.mid.c` < `…#core.mid.z`), so a product listing
// the mapping in document order — the order its subtree traversal yields —
// fails both decodePreviewReport's `from`-byte order check (SPEC 12.7, H-3)
// and the exact-list comparison against the expected mapping. `c` bears no
// reference (its only edit is its `id-rewrite`), keeping the discriminator
// in the mapping alone; mappingInFromByteOrder composes the expectation and
// guards that the two orders really differ.
const A4_CORE = "specs/Core.mdx";
const A4_OTHER = "specs/Other.mdx";
const A4_USE = "src/use.ts";
const A4_CORE_SOURCE = [
  '<S id="core">',
  "Core hölder text.",
  "",
  '<S id="core.mid" d={"core.plain"}>',
  "Mid text.",
  "",
  '<S id="core.mid.z">',
  "Z text.",
  "</S>",
  "",
  '<S id="core.mid.c">',
  "C text.",
  "</S>",
  "</S>",
  "",
  '<S id="core.sib" d={["core.mid", "core.mid.z"]}>',
  'Sib embeds: {text("core.mid.z")}',
  "</S>",
  "",
  '<S id="core.plain">',
  "Plain text.",
  "</S>",
  "</S>",
  "",
].join("\n");
const A4_OTHER_SOURCE = [
  'import CORE from "./Core.xspec"',
  "",
  '<S id="oth">',
  "Other ünicode text.",
  "",
  '<S id="oth.dep" d={CORE.core.mid}>',
  "Dep text.",
  "",
  "{text(CORE.core.mid.z)}",
  "</S>",
  "</S>",
  "",
].join("\n");
const A4_USE_SOURCE = [
  "// Δ byte offsets in this file diverge from code-point counts.",
  'import SPEC, { text } from "../specs/Core.xspec"',
  "",
  "export function useMid(): string {",
  "  SPEC.core.mid.z;",
  "  return text(SPEC.core.mid);",
  "}",
  "",
].join("\n");
const A4_RENAME_ARGV = ["rename", A4_CORE, "core.mid", "core.hub"] as const;

/**
 * The expected mapping in `from`-byte order (SPEC 12.7), composed from the
 * mapped pairs of one spec file — order of listing immaterial — with a
 * staging guard: the pairs' DOCUMENT order, read off the staged bytes as
 * the order of the mapped IDs' `id` attributes, must differ from the byte
 * order, or the fixture could not fail a product emitting document order
 * (TEST-SPEC T6.6-4) — a re-staging whose descendants happen to sort alike
 * is a staging defect (harness error), never a weaker test.
 */
function mappingInFromByteOrder(
  source: string,
  pairs: readonly AppliedMappingPair[],
  where: string,
): readonly AppliedMappingPair[] {
  const documentIndex = (pair: AppliedMappingPair): number =>
    uniqueCharIndex(
      source,
      `id="${pair.from.slice(pair.from.indexOf("#") + 1)}"`,
      `${where}: ${pair.from}`,
    );
  const documentOrder = [...pairs].sort(
    (a, b) => documentIndex(a) - documentIndex(b),
  );
  const byteOrder = [...pairs].sort((a, b) =>
    Buffer.compare(Buffer.from(a.from, "utf8"), Buffer.from(b.from, "utf8")),
  );
  if (byteOrder.every((pair, index) => pair === documentOrder[index])) {
    throw new Error(
      `T6.6-4 staging (${where}): the mapping's document order coincides ` +
        `with its \`from\`-byte order, so the fixture cannot discriminate a ` +
        `product emitting document order (TEST-SPEC T6.6-4)`,
    );
  }
  return byteOrder;
}

function armAPlan(): ExpectedPreviewPlan {
  const core = A4_CORE_SOURCE;
  const dArray = 'd={["core.mid", "core.mid.z"]}';
  return {
    // The complete mapping — the renamed ID and every descendant — in
    // `from`-byte order: `…#core.mid.c` before `…#core.mid.z`, the reverse
    // of the document order the pairs are listed in (SPEC 12.7, 6.4).
    mapping: mappingInFromByteOrder(
      core,
      [
        { from: "specs/Core.mdx#core.mid", to: "specs/Core.mdx#core.hub" },
        { from: "specs/Core.mdx#core.mid.z", to: "specs/Core.mdx#core.hub.z" },
        { from: "specs/Core.mdx#core.mid.c", to: "specs/Core.mdx#core.hub.c" },
      ],
      "a: mapping",
    ),
    files: [
      {
        file: A4_CORE,
        edits: editsInPinnedOrder([
          // The renamed bearer's and its descendant's `id` attributes — the
          // attribute's own characters (SPEC 6.6, 6.4).
          {
            class: "id-rewrite",
            range: uniqueSpan(core, 'id="core.mid"', "a: core.mid id"),
          },
          {
            class: "id-rewrite",
            range: uniqueSpan(core, 'id="core.mid.z"', "a: z id"),
          },
          {
            class: "id-rewrite",
            range: uniqueSpan(core, 'id="core.mid.c"', "a: c id"),
          },
          // Each `d` array entry is its own occurrence spanning that one
          // reference's own expression (SPEC 5.7) — located through the
          // array (the string spelling recurs inside `id="…"` attributes).
          {
            class: "reference-rewrite",
            range: spanWithin(core, dArray, '"core.mid"', "a: d core.mid"),
          },
          {
            class: "reference-rewrite",
            range: spanWithin(core, dArray, '"core.mid.z"', "a: d core.mid.z"),
          },
          // An MDX embedding spans the entire `{text(...)}` container,
          // opening brace through closing brace (SPEC 5.7).
          {
            class: "reference-rewrite",
            range: uniqueSpan(core, '{text("core.mid.z")}', "a: embedding"),
          },
        ]),
      },
      {
        file: A4_OTHER,
        edits: editsInPinnedOrder([
          {
            class: "reference-rewrite",
            range: spanWithin(
              A4_OTHER_SOURCE,
              "d={CORE.core.mid}",
              "CORE.core.mid",
              "a: external d chain",
            ),
          },
          {
            class: "reference-rewrite",
            range: uniqueSpan(
              A4_OTHER_SOURCE,
              "{text(CORE.core.mid.z)}",
              "a: external embedding",
            ),
          },
        ]),
      },
      {
        file: A4_USE,
        edits: editsInPinnedOrder([
          // A TS marker occurrence spans the bare reference chain alone,
          // exclusive of the statement terminator (SPEC 5.7).
          {
            class: "reference-rewrite",
            range: uniqueSpan(A4_USE_SOURCE, "SPEC.core.mid.z", "a: marker"),
          },
          // A TS `text(...)` occurrence spans the entire call expression,
          // callee through closing parenthesis (SPEC 5.7).
          {
            class: "reference-rewrite",
            range: uniqueSpan(
              A4_USE_SOURCE,
              "text(SPEC.core.mid)",
              "a: text call",
            ),
          },
        ]),
      },
    ],
  };
}

// --- Arm (b): section move into an existing target file. The moved
// construct is indented two spaces and closes on an indented line, so the
// origin edit's line-drop rule leaves exactly one merged whitespace-only
// line — the deletion range extends over that leftover whitespace and its
// terminator, contiguous with the construct (SPEC 6.5, 3). The origin's
// `TGT` import is referenced only inside the moved subtree (import-removal:
// the declaration plus its dropped line terminator); the target parent `tp`
// is self-closing (target-parent-rewrite spanning the tag, the insertion
// point at the tag's end); Third.mdx keeps a reference to a moved node and
// lacks a Target binding (import-addition — offset latitude, pinned by the
// real run) beside a control reference (`ORG.org.stay`) that keeps its ORG
// import referenced (no removal there).
const B4_ORIGIN = "specs/Origin.mdx";
const B4_TARGET = "specs/Target.mdx";
const B4_THIRD = "specs/Third.mdx";
const B4_IMPORT_DECL = 'import TGT from "./Target.xspec"';
const B4_MOVED_CONSTRUCT = [
  '<S id="org.mv" d={[TGT.base, "org.mv.kid"]}>',
  "Moved head text.",
  "",
  '<S id="org.mv.kid">',
  "Moved kid text.",
  "</S>",
  "  </S>",
].join("\n");
const B4_ORIGIN_SOURCE = [
  B4_IMPORT_DECL,
  "",
  '<S id="org">',
  "Origin hölder text.",
  "",
  "  " + B4_MOVED_CONSTRUCT,
  "",
  '<S id="org.stay">',
  "Staying text.",
  "</S>",
  "</S>",
  "",
].join("\n");
const B4_TARGET_PARENT_TAG = '<S id="tp" />';
const B4_TARGET_SOURCE = [
  '<S id="base">',
  "Base ünicode text.",
  "</S>",
  "",
  B4_TARGET_PARENT_TAG,
  "",
].join("\n");
const B4_THIRD_SOURCE = [
  'import ORG from "./Origin.xspec"',
  "",
  '<S id="t">',
  "Third ünicode text.",
  "",
  '<S id="t.use" d={[ORG.org.mv.kid, ORG.org.stay]}>',
  "Use text.",
  "</S>",
  "</S>",
  "",
].join("\n");
const B4_MOVE_ARGV = [
  "move",
  `${B4_ORIGIN}#org.mv`,
  `${B4_TARGET}#tp.nw`,
] as const;

function armBPlan(): ExpectedPreviewPlan & {
  readonly thirdReferenceSpan: SourceRange;
} {
  const origin = B4_ORIGIN_SOURCE;
  // Staging self-checks on the adjunct geometry the ranges extend over
  // (violations are fixture-arithmetic defects, never product failures).
  if (!origin.startsWith(B4_IMPORT_DECL + "\n")) {
    throw new Error(
      "T6.6-4 staging self-check (b): the removed import must open the " +
        "origin on a line of its own",
    );
  }
  const constructChar = uniqueCharIndex(
    origin,
    B4_MOVED_CONSTRUCT,
    "b: moved construct",
  );
  if (
    origin.slice(constructChar - 3, constructChar) !== "\n  " ||
    origin.charAt(constructChar + B4_MOVED_CONSTRUCT.length) !== "\n"
  ) {
    throw new Error(
      "T6.6-4 staging self-check (b): the moved construct must sit behind " +
        "exactly two spaces of indentation and close before a line " +
        "terminator, so the deletion leaves one whitespace-only merged line",
    );
  }
  const construct = uniqueSpan(origin, B4_MOVED_CONSTRUCT, "b: construct");
  // One range spanning every byte the origin edit removes: the construct's
  // own characters extended over the leftover indentation before it and the
  // merged line's terminator after it — contiguous bytes, the adjunct drop
  // inside this class's range (SPEC 6.5, 3, 6.6).
  const originDeletion: SourceRange = {
    start: construct.start - 2,
    end: construct.end + 1,
  };
  const dArray = 'd={[TGT.base, "org.mv.kid"]}';
  const nestedEdits: readonly ExpectedEdit[] = [
    {
      class: "id-rewrite",
      range: uniqueSpan(origin, 'id="org.mv"', "b: org.mv id"),
    },
    {
      class: "id-rewrite",
      range: uniqueSpan(origin, 'id="org.mv.kid"', "b: kid id"),
    },
    {
      class: "reference-rewrite",
      range: spanWithin(origin, dArray, "TGT.base", "b: TGT.base"),
    },
    {
      class: "reference-rewrite",
      range: spanWithin(origin, dArray, '"org.mv.kid"', "b: local ref"),
    },
  ];
  assertComposedWithin(originDeletion, nestedEdits, "b: origin");
  const parentTag = uniqueSpan(
    B4_TARGET_SOURCE,
    B4_TARGET_PARENT_TAG,
    "b: target parent",
  );
  const thirdReferenceSpan = spanWithin(
    B4_THIRD_SOURCE,
    "d={[ORG.org.mv.kid, ORG.org.stay]}",
    "ORG.org.mv.kid",
    "b: third ref",
  );
  return {
    thirdReferenceSpan,
    mapping: [
      { from: "specs/Origin.mdx#org.mv", to: "specs/Target.mdx#tp.nw" },
      {
        from: "specs/Origin.mdx#org.mv.kid",
        to: "specs/Target.mdx#tp.nw.kid",
      },
    ],
    files: [
      {
        file: B4_ORIGIN,
        edits: editsInPinnedOrder([
          // The unreferenced-after-rewrite import: the declaration plus its
          // adjunct drop — the emptied line's terminator (SPEC 6.5).
          {
            class: "import-removal",
            range: { start: 0, end: utf8Length(B4_IMPORT_DECL) + 1 },
          },
          { class: "origin-deletion", range: originDeletion },
          // The re-identification's id-rewrites and the moved text's own
          // reference rewrites nest inside the deletion range, each under
          // its own class (SPEC 6.6: containment is geometry).
          ...nestedEdits,
        ]),
      },
      {
        file: B4_TARGET,
        edits: editsInPinnedOrder([
          // The self-closing target parent's rewrite spans the tag; the
          // insertion point is the tag's end in pre-operation coordinates
          // (module header, H-4).
          { class: "target-parent-rewrite", range: parentTag },
          { class: "target-insertion", range: insertionPoint(parentTag.end) },
        ]),
      },
      {
        file: B4_THIRD,
        edits: [{ class: "reference-rewrite", range: thirdReferenceSpan }],
        importAdditionLatitude: {
          sourceByteLength: utf8Length(B4_THIRD_SOURCE),
        },
      },
    ],
  };
}

// --- Arm (c): file-form move. `specs/Mv.mdx` relocates into a subdirectory,
// so its own `./Pal.xspec` specifier and the importer's `./Mv.xspec`
// specifier both rewrite (import-specifier-rewrite spanning the specifier
// literal's characters, quotes included) while the reference chains
// (`PAL.pal`, `MV.mv`) are untouched controls — IDs are unchanged, only the
// file part of each identity moves (SPEC 6.5).
const C4_MV = "specs/Mv.mdx";
const C4_PAL = "specs/Pal.mdx";
const C4_USER = "specs/User.mdx";
const C4_MV_SOURCE = [
  'import PAL from "./Pal.xspec"',
  "",
  '<S id="mv" d={PAL.pal}>',
  "Mv ünicode text.",
  "</S>",
  "",
].join("\n");
const C4_PAL_SOURCE = ['<S id="pal">', "Pal text.", "</S>", ""].join("\n");
const C4_USER_SOURCE = [
  'import MV from "./Mv.xspec"',
  "",
  '<S id="user" d={MV.mv}>',
  "User text.",
  "</S>",
  "",
].join("\n");
const C4_MOVE_ARGV = ["move", C4_MV, "specs/sub/Mv2.mdx"] as const;

function armCPlan(): ExpectedPreviewPlan {
  return {
    mapping: [
      // Every node of the moved file, the implicit root included (its
      // identity is the path alone, SPEC 1.2, 1.5; T6.5-1's precedent).
      { from: "specs/Mv.mdx", to: "specs/sub/Mv2.mdx" },
      { from: "specs/Mv.mdx#mv", to: "specs/sub/Mv2.mdx#mv" },
    ],
    files: [
      {
        file: C4_MV,
        edits: editsInPinnedOrder([
          // The relocation spans the entire moved file, its entry under the
          // current, pre-operation path (SPEC 6.6, 12.7).
          {
            class: "file-relocation",
            range: { start: 0, end: utf8Length(C4_MV_SOURCE) },
          },
          {
            class: "import-specifier-rewrite",
            range: uniqueSpan(
              C4_MV_SOURCE,
              '"./Pal.xspec"',
              "c: own specifier",
            ),
          },
        ]),
      },
      {
        file: C4_USER,
        edits: [
          {
            class: "import-specifier-rewrite",
            range: uniqueSpan(
              C4_USER_SOURCE,
              '"./Mv.xspec"',
              "c: importer specifier",
            ),
          },
        ],
      },
    ],
  };
}

// --- Arm (d): section move whose target file does not exist. The moved
// section references a staying node (`"hold.keep"`), so the created file
// needs an added Origin import — subsumed, with the insertion, by the one
// file-creation edit (a product reporting a target-insertion or
// import-addition under the created path fails the exactly-one-edit
// equality); the moved text's own rewrites are reported inside the origin
// deletion's range.
const D4_SOLO = "specs/Solo.mdx";
const D4_MADE = "specs/Made.mdx";
const D4_MOVED_CONSTRUCT = [
  '<S id="hold.out" d={"hold.keep"}>',
  "Out text.",
  "</S>",
].join("\n");
const D4_SOLO_SOURCE = [
  '<S id="hold">',
  "Hold ünicode text.",
  "",
  D4_MOVED_CONSTRUCT,
  "",
  '<S id="hold.keep">',
  "Keep text.",
  "</S>",
  "</S>",
  "",
].join("\n");
const D4_MOVE_ARGV = [
  "move",
  `${D4_SOLO}#hold.out`,
  `${D4_MADE}#made`,
] as const;

function armDPlan(): ExpectedPreviewPlan {
  const solo = D4_SOLO_SOURCE;
  const constructChar = uniqueCharIndex(
    solo,
    D4_MOVED_CONSTRUCT,
    "d: moved construct",
  );
  if (
    solo.charAt(constructChar - 1) !== "\n" ||
    solo.charAt(constructChar + D4_MOVED_CONSTRUCT.length) !== "\n"
  ) {
    throw new Error(
      "T6.6-4 staging self-check (d): the moved construct must occupy whole " +
        "lines, so the deletion's adjunct drop is exactly the merged line's " +
        "terminator",
    );
  }
  const construct = uniqueSpan(solo, D4_MOVED_CONSTRUCT, "d: construct");
  const originDeletion: SourceRange = {
    start: construct.start,
    end: construct.end + 1,
  };
  const nestedEdits: readonly ExpectedEdit[] = [
    {
      class: "id-rewrite",
      range: uniqueSpan(solo, 'id="hold.out"', "d: id"),
    },
    {
      class: "reference-rewrite",
      range: spanWithin(solo, 'd={"hold.keep"}', '"hold.keep"', "d: ref"),
    },
  ];
  assertComposedWithin(originDeletion, nestedEdits, "d: origin");
  return {
    mapping: [{ from: "specs/Solo.mdx#hold.out", to: "specs/Made.mdx#made" }],
    files: [
      {
        // The created file's entry, under the path the creation would
        // occupy: exactly one file-creation edit at the start of the new
        // file — the only reported location without pre-operation
        // coordinates (SPEC 6.6, 12.7).
        file: D4_MADE,
        edits: [{ class: "file-creation", range: insertionPoint(0) }],
      },
      {
        file: D4_SOLO,
        edits: editsInPinnedOrder([
          { class: "origin-deletion", range: originDeletion },
          ...nestedEdits,
        ]),
      },
    ],
  };
}

// --- Arm (e): the tie-break geometry. A top-level `<new-id>` moves into an
// existing target file (target insertion at end of file) whose rewrite
// requires an import addition in that same file (the moved section
// references a staying origin node) — the one staging where the addition's
// implementation-chosen offset (SPEC 6.5) can coincide with the target
// insertion; whatever the product chooses, decodePreviewReport enforces the
// full 12.7 comparator (`import-addition` before `target-insertion` on
// coincidence — class-name bytes after equal range starts and ends).
const E4_SRC = "specs/Src.mdx";
const E4_DST = "specs/Dst.mdx";
const E4_MOVED_CONSTRUCT = [
  '<S id="roam" d={"anchor"}>',
  "Roam text.",
  "</S>",
].join("\n");
const E4_SRC_SOURCE = [
  '<S id="anchor">',
  "Anchor ünicode text.",
  "</S>",
  "",
  E4_MOVED_CONSTRUCT,
  "",
].join("\n");
const E4_DST_SOURCE = ['<S id="dst">', "Dst ünicode text.", "</S>", ""].join(
  "\n",
);
const E4_MOVE_ARGV = ["move", `${E4_SRC}#roam`, `${E4_DST}#roamed`] as const;

function armEPlan(): ExpectedPreviewPlan {
  const src = E4_SRC_SOURCE;
  const constructChar = uniqueCharIndex(
    src,
    E4_MOVED_CONSTRUCT,
    "e: moved construct",
  );
  if (
    src.charAt(constructChar - 1) !== "\n" ||
    src.charAt(constructChar + E4_MOVED_CONSTRUCT.length) !== "\n"
  ) {
    throw new Error(
      "T6.6-4 staging self-check (e): the moved construct must occupy whole " +
        "lines, so the deletion's adjunct drop is exactly the merged line's " +
        "terminator",
    );
  }
  const construct = uniqueSpan(src, E4_MOVED_CONSTRUCT, "e: construct");
  const originDeletion: SourceRange = {
    start: construct.start,
    end: construct.end + 1,
  };
  const nestedEdits: readonly ExpectedEdit[] = [
    { class: "id-rewrite", range: uniqueSpan(src, 'id="roam"', "e: id") },
    {
      class: "reference-rewrite",
      range: spanWithin(src, 'd={"anchor"}', '"anchor"', "e: ref"),
    },
  ];
  assertComposedWithin(originDeletion, nestedEdits, "e: origin");
  return {
    mapping: [{ from: "specs/Src.mdx#roam", to: "specs/Dst.mdx#roamed" }],
    files: [
      {
        file: E4_DST,
        // A top-level `<new-id>`'s insertion point is the end of the file
        // (SPEC 6.5, 6.6); the required import addition rides the latitude
        // slot, free to coincide with it.
        edits: [
          {
            class: "target-insertion",
            range: insertionPoint(utf8Length(E4_DST_SOURCE)),
          },
        ],
        importAdditionLatitude: {
          sourceByteLength: utf8Length(E4_DST_SOURCE),
        },
      },
      {
        file: E4_SRC,
        edits: editsInPinnedOrder([
          { class: "origin-deletion", range: originDeletion },
          ...nestedEdits,
        ]),
      },
    ],
  };
}

const T6_6_4 = defineProductTest({
  id: "T6.6-4",
  title:
    "report content: byte-precise fixtures asserted against precomputed pre-operation offsets, form-exact per 12.7 — (a) a rename preview reports the complete identity mapping (the renamed ID and every descendant) ordered by `from` bytes — the descendants `core.mid.z` and `core.mid.c` standing in document order opposite to byte order, so a product emitting document order fails — and, per rewritten file, `id-rewrite` edits spanning each rewritten `id` attribute's own characters and `reference-rewrite` edits spanning each affected occurrence's span (5.7) across MDX and TS; (b) a section-move preview into an existing target file reports the `origin-deletion` as one contiguous range (the construct's own characters extended over the adjunct-dropped leftover whitespace and line terminator), the re-identification's `id-rewrite` edits and the moved text's reference rewrites nested inside that range, `target-insertion` zero-length at the insertion offset, `target-parent-rewrite` spanning the self-closing target parent's tag, `import-addition` zero-length at the exact offset the real operation then uses (byte-asserted by running the operation on the preview-pinned state), and `import-removal` spanning the declaration plus its adjunct drops; (c) a file-form move preview reports `import-specifier-rewrite` edits spanning the specifier literals and `file-relocation` spanning the entire moved file under its pre-operation path; (d) a created-target section-move preview reports exactly one `file-creation` edit at the new file's start — the insertion and import additions there subsumed — with the moved text's own rewrites inside the origin deletion; every edit class-plus-range only, every class one of the ten 12.7 names, and the full 12.7 edit comparator asserted over whatever edits are emitted, staged (e) where an import addition can coincide with the end-of-file target insertion (SPEC 6.6, 12.7, 6.4, 6.5, 5.7, 1.7, 2.1, 3; H-3, H-4)",
  run: async (product) => {
    // --- Arm (a): rename preview across MDX and TS ---
    await withWorkspace(
      SPECS_AND_CODE_CONFIG,
      {
        [A4_CORE]: A4_CORE_SOURCE,
        [A4_OTHER]: A4_OTHER_SOURCE,
        [A4_USE]: A4_USE_SOURCE,
      },
      async (workspace) => {
        const context = "T6.6-4(a) rename preview";
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` — the workspace is valid, ` +
            `so the rename would proceed and its preview succeeds (SPEC 6.4, 6.6)`,
        );
        const report = await runPreviewJson(
          product,
          workspace,
          A4_RENAME_ARGV,
          context,
        );
        assertPreviewPlanContent(report, armAPlan(), context);
      },
    );

    // --- Arm (b): section move into an existing target file, then the real
    // run pinning the import addition's offset ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [B4_ORIGIN]: B4_ORIGIN_SOURCE,
        [B4_TARGET]: B4_TARGET_SOURCE,
        [B4_THIRD]: B4_THIRD_SOURCE,
      },
      async (workspace) => {
        const context = "T6.6-4(b) section-move preview (existing target)";
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` (SPEC 6.5, 6.6)`,
        );
        const plan = armBPlan();
        // The preview inside a whole-root modifies-nothing compare: the
        // real run below then executes on the byte-identical pre-operation
        // state — TEST-SPEC's "running the operation on a copy" (H-4).
        const additionOffset = await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const report = await runPreviewJson(
              product,
              workspace,
              B4_MOVE_ARGV,
              context,
            );
            const captured = assertPreviewPlanContent(report, plan, context);
            const offset = captured.get(B4_THIRD);
            if (offset === undefined) {
              throw new Error(
                "T6.6-4(b): latitude capture must yield the Third.mdx " +
                  "import-addition offset",
              );
            }
            return offset;
          },
          `${context}: the preview modifies nothing (SPEC 6.6) — pinning ` +
            `the pre-operation state for the real run's byte assertion`,
        );
        await assertRealRunInsertsImportAtPreviewedOffset(
          product,
          workspace,
          {
            operationArgv: [...B4_MOVE_ARGV],
            file: B4_THIRD,
            preSource: B4_THIRD_SOURCE,
            referenceSpan: plan.thirdReferenceSpan,
            rewrittenChainSuffix: ".tp.nw.kid",
            importSpecifier: "./Target.xspec",
            additionOffset,
          },
          "T6.6-4(b) real move after the preview",
        );
        // Composition soundness guard (the T6.5-7 precedent): everything
        // resolves after the move — a defective expectation must fail loud
        // rather than certify a broken rewrite.
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T6.6-4(b) `check` after the real move — the rewritten workspace " +
            "is valid and fresh (SPEC 6.5, 12.2)",
        );
      },
    );

    // --- Arm (c): file-form move preview ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [C4_MV]: C4_MV_SOURCE,
        [C4_PAL]: C4_PAL_SOURCE,
        [C4_USER]: C4_USER_SOURCE,
      },
      async (workspace) => {
        const context = "T6.6-4(c) file-form move preview";
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` (SPEC 6.5, 6.6)`,
        );
        const report = await runPreviewJson(
          product,
          workspace,
          C4_MOVE_ARGV,
          context,
        );
        assertPreviewPlanContent(report, armCPlan(), context);
      },
    );

    // --- Arm (d): section-move preview whose target file does not exist ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [D4_SOLO]: D4_SOLO_SOURCE },
      async (workspace) => {
        const context = "T6.6-4(d) created-target move preview";
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` (SPEC 6.5, 6.6)`,
        );
        const report = await runPreviewJson(
          product,
          workspace,
          D4_MOVE_ARGV,
          context,
        );
        assertPreviewPlanContent(report, armDPlan(), context);
      },
    );

    // --- Arm (e): the coincidence-capable tie-break staging ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [E4_SRC]: E4_SRC_SOURCE,
        [E4_DST]: E4_DST_SOURCE,
      },
      async (workspace) => {
        const context = "T6.6-4(e) top-level move preview (tie-break staging)";
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` (SPEC 6.5, 6.6)`,
        );
        const report = await runPreviewJson(
          product,
          workspace,
          E4_MOVE_ARGV,
          context,
        );
        assertPreviewPlanContent(report, armEPlan(), context);
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.6-5 — delta: the derived-file delta, both directions, record-based
// ---------------------------------------------------------------------------

// The file-form arm reuses arm (c)'s sources — origin `specs/Mv.mdx` with an
// imported neighbor and an importer — under the Markdown-emitting
// configuration, so the delta's universe spans every derived-file kind the
// record covers (SPEC 13.3: modules, companions, emitted Markdown). The
// rename arm renames `pal` in place: its cross-file `PAL.pal` references are
// content rewrites, changing no derived path.
const F5_DEST = C4_MOVE_ARGV[2];
const F5_RENAME_ARGV = ["rename", C4_PAL, "pal", "pal2"] as const;

/** The plain files a premise `build` added: file entries of `after` whose
 * key `before` lacks (snapshot keys are workspace-relative paths). */
function addedFiles(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
): readonly string[] {
  const added: string[] = [];
  for (const [key, entry] of after.entries) {
    if (entry.kind === "file" && !before.entries.has(key)) added.push(key);
  }
  return added;
}

/** `DIR/NAME.mdx` → `DIR/NAME` (staging arithmetic; misuse throws). */
function sourceStem(sourcePath: string): string {
  if (!sourcePath.endsWith(".mdx")) {
    throw new Error(
      `T6.6-5 staging: ${sourcePath} is not a NAME.mdx spec source`,
    );
  }
  return sourcePath.slice(0, -".mdx".length);
}

/** The 13.1 module-and-companion name-shape prefix: `DIR/NAME.xspec.`. */
function moduleCompanionPrefix(sourcePath: string): string {
  return `${sourceStem(sourcePath)}.xspec.`;
}

/** The 13.2/7.3 Markdown emit destination with `emit: true` and `outDir`
 * unset: `DIR/NAME.md` next to the source. */
function markdownDestination(sourcePath: string): string {
  return `${sourceStem(sourcePath)}.md`;
}

/** Paths in byte order (SPEC 12.7: delta directions list paths in byte
 * order, so composed expected lists must meet the decode-enforced order). */
function byteSortedPaths(paths: readonly string[]): readonly string[] {
  return [...paths].sort((a, b) =>
    Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")),
  );
}

/** One staged source's observed derived files (module header, H-4). */
interface ObservedDerived {
  /** Observed `DIR/NAME.xspec.<suffix>` paths, byte-sorted. */
  readonly moduleAndCompanions: readonly string[];
  /** The Markdown destination; `null` while emission is disabled. */
  readonly markdown: string | null;
}

/** Every derived path of one source — module, companions, Markdown. */
function derivedPathsOf(observed: ObservedDerived): readonly string[] {
  return [
    ...observed.moduleAndCompanions,
    ...(observed.markdown === null ? [] : [observed.markdown]),
  ];
}

/**
 * Partition the premise build's written files into graph data and each
 * staged source's derived files (module header, H-4): per source, the
 * observed `DIR/NAME.xspec.<suffix>` plain files — the module
 * `DIR/NAME.xspec.ts` asserted present (SPEC 13.1), a suffix containing a
 * path separator rejected (every companion is a plain file beside the
 * module) — plus, with emission enabled, the 13.2/7.3 Markdown destination
 * asserted written. A write that is neither graph data nor attributable to
 * a staged source fails diagnosed: SPEC 13.1–13.3 enumerate what `build`
 * writes.
 */
function observeDerivedWrites(
  written: readonly string[],
  sources: readonly string[],
  emission: boolean,
  context: string,
): ReadonlyMap<string, ObservedDerived> {
  const unattributed = new Set(written.filter((path) => !isGraphDataKey(path)));
  const observed = new Map<string, ObservedDerived>();
  for (const source of sources) {
    const prefix = moduleCompanionPrefix(source);
    const moduleAndCompanions = byteSortedPaths(
      [...unattributed].filter((path) => path.startsWith(prefix)),
    );
    for (const path of moduleAndCompanions) {
      if (path.slice(prefix.length).includes("/")) {
        fail(
          `${context}: the premise build wrote ${path} — every companion ` +
            `file is named \`NAME.xspec.\` plus a suffix, a plain file ` +
            `beside the module (SPEC 13.1), never a deeper path`,
        );
      }
      unattributed.delete(path);
    }
    const modulePath = `${prefix}ts`;
    if (!moduleAndCompanions.includes(modulePath)) {
      fail(
        `${context}: the premise build must generate ${source}'s module ` +
          `${modulePath} (SPEC 13.1); under the name shape it wrote only ` +
          `[${moduleAndCompanions.join(", ")}]`,
      );
    }
    let markdown: string | null = null;
    if (emission) {
      markdown = markdownDestination(source);
      if (!unattributed.has(markdown)) {
        fail(
          `${context}: with emission enabled, ${source} emits ${markdown} — ` +
            `\`NAME.md\` next to the source, \`outDir\` unset (SPEC 13.2, ` +
            `7.3); the premise build did not write it`,
        );
      }
      unattributed.delete(markdown);
    }
    observed.set(source, { moduleAndCompanions, markdown });
  }
  if (unattributed.size > 0) {
    fail(
      `${context}: every file the premise build writes is a source's ` +
        `module or companion (SPEC 13.1), its emitted Markdown (13.2), or ` +
        `graph data under .xspec/ (13.3); it also wrote ` +
        `[${[...unattributed].join(", ")}]`,
    );
  }
  return observed;
}

/**
 * The origin's observed module-and-companion paths transposed under another
 * source name — SPEC 13.1: per-source derived paths are defined by the
 * `NAME.mdx` name shape alone, so a not-yet-existing file's set is the
 * observed suffix set under its own `DIR/NAME.xspec.` prefix.
 */
function transposeModuleCompanions(
  observed: ObservedDerived,
  fromSource: string,
  toSource: string,
): readonly string[] {
  const fromPrefix = moduleCompanionPrefix(fromSource);
  const toPrefix = moduleCompanionPrefix(toSource);
  return observed.moduleAndCompanions.map((path) => {
    if (!path.startsWith(fromPrefix)) {
      throw new Error(
        `T6.6-5 staging self-check: ${path} must lie under ${fromPrefix}`,
      );
    }
    return `${toPrefix}${path.slice(fromPrefix.length)}`;
  });
}

/**
 * Assert a successful preview's delta content exactly (T6.6-5): findings
 * `[]`, the success plan encoding, `delta` a plain two-direction value — an
 * absent record is nothing-recorded, the empty-record success path (SPEC
 * 6.6), never the 14.23 unavailability of T6.6-6 — and each direction equal
 * to the expected path set in byte order.
 */
function assertDeltaContent(
  report: PreviewReport,
  expected: {
    readonly generated: readonly string[];
    readonly removed: readonly string[];
  },
  context: string,
): void {
  assertSameJson(
    report.findings,
    [],
    `${context}: a preview whose real operation would proceed reports ` +
      `findings [] (SPEC 6.6, 12.7) — a missing record is no finding: ` +
      `condition 23 covers recorded state that exists but cannot be read ` +
      `(SPEC 14.23, T6.6-6)`,
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
  const delta = report.delta;
  if ("unavailable" in delta) {
    fail(
      `${context}: the delta is explicitly unavailable only where recorded ` +
        `state exists but cannot be read as a record (SPEC 14.23; T6.6-6's ` +
        `staging) — an absent or empty record is the nothing-recorded ` +
        `success path, reported as a plain two-direction value (SPEC 6.6)`,
    );
  }
  assertSameJson(
    delta.generated,
    expected.generated,
    `${context}: \`generated\` — exactly the derived paths the operation ` +
      `would newly generate, the paths where nothing is currently recorded ` +
      `as generated, in byte order (SPEC 6.6, 12.7)`,
  );
  assertSameJson(
    delta.removed,
    expected.removed,
    `${context}: \`removed\` — exactly the recorded derived paths the ` +
      `operation would leave no longer generated, in byte order (SPEC 6.6, ` +
      `12.7)`,
  );
}

const T6_6_5 = defineProductTest({
  id: "T6.6-5",
  title:
    "delta: after a build, a file-form move preview reports the derived-file delta both directions — under `generated` the destination's module, companion, and (emission enabled) Markdown paths, nothing being recorded there, and under `removed` the recorded pre-move module, companions, and Markdown the operation would leave no longer generated; a rename preview on the same workspace reports [] in both directions (regeneration rewrites recorded paths in place); the created-target move of T6.6-4(d) reports the new file's derived paths under `generated`; record-based, not presence-based: with graph data deleted (T13.3-2's operational definition) the same move preview's `generated` is the full post-move regeneration set and its `removed` [] — nothing being recorded, presence on disk deciding neither direction — and the preview still writes nothing: no refresh, graph data still absent afterward; lagging-record counterpart: with emission enabled in the configuration after the build and no rebuild, the same preview's `generated` is exactly the destination's module, companions, and Markdown together with every other discovered spec source's Markdown emit destination — the paths the current configuration generates that the stale record lacks — and its `removed` exactly the recorded pre-move module and companions, the preview writing nothing and the record left lagging (SPEC 6.6, 12.7, 13.1, 13.2, 13.3, 7.3, 12.1; H-3, H-4)",
  run: async (product) => {
    // --- File-form move, rename, and the record-deleted arm: one
    // Markdown-emitting workspace (arm (c)'s sources) ---
    await withWorkspace(
      SPECS_MD_CONFIG,
      {
        [C4_MV]: C4_MV_SOURCE,
        [C4_PAL]: C4_PAL_SOURCE,
        [C4_USER]: C4_USER_SOURCE,
      },
      async (workspace) => {
        const context = "T6.6-5 file-form move";
        const before = await snapshotDirectory(workspace.root);
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` — it generates every ` +
            `derived-file kind and records their paths (SPEC 12.1, 13.3)`,
        );
        const after = await snapshotDirectory(workspace.root);
        assertGraphDataPresent(
          after,
          `${context}: staging premise — the record the delta consults`,
        );
        const observed = observeDerivedWrites(
          addedFiles(before, after),
          [C4_MV, C4_PAL, C4_USER],
          true,
          `${context} staging observation`,
        );
        // `get` cannot miss: observeDerivedWrites maps exactly the sources.
        const mv = observed.get(C4_MV)!;
        const pal = observed.get(C4_PAL)!;
        const user = observed.get(C4_USER)!;

        // The destination's derived paths — nothing recorded there — and
        // the moved file's recorded paths, left no longer generated.
        const destinationDerived = byteSortedPaths([
          ...transposeModuleCompanions(mv, C4_MV, F5_DEST),
          markdownDestination(F5_DEST),
        ]);
        const originDerived = byteSortedPaths(derivedPathsOf(mv));

        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const armContext = `${context} (record present)`;
            const report = await runPreviewJson(
              product,
              workspace,
              C4_MOVE_ARGV,
              armContext,
            );
            assertDeltaContent(
              report,
              { generated: destinationDerived, removed: originDerived },
              armContext,
            );
          },
          `${context} (record present): the preview modifies nothing ` +
            `(SPEC 6.6)`,
        );

        // A rename preview on the same workspace: regeneration rewrites
        // recorded paths in place, so both directions are [] (SPEC 6.6) —
        // the cross-file `PAL.pal` rewrites change file contents, never a
        // derived path.
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const renameContext = `${context}, rename \`${F5_RENAME_ARGV.join(" ")}\``;
            const report = await runPreviewJson(
              product,
              workspace,
              F5_RENAME_ARGV,
              renameContext,
            );
            assertDeltaContent(
              report,
              { generated: [], removed: [] },
              renameContext,
            );
          },
          `${context}, rename arm: the preview modifies nothing (SPEC 6.6)`,
        );

        // --- Record-based, not presence-based: graph data deleted ---
        const deletedContext = `${context} (record deleted)`;
        await deleteGraphData(workspace, deletedContext);
        // With nothing recorded, every path the operation would generate is
        // a path "where nothing is currently recorded as generated": the
        // full post-move regeneration set — every post-move source's
        // module, companions, and Markdown, the staying sources' present-
        // on-disk files included (presence cannot tell a generated occupant
        // from a foreign one, SPEC 6.6) — while `removed` is exactly []:
        // the origin's still-on-disk files are recorded nowhere.
        const fullRegenerationSet = byteSortedPaths([
          ...destinationDerived,
          ...derivedPathsOf(pal),
          ...derivedPathsOf(user),
        ]);
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const report = await runPreviewJson(
              product,
              workspace,
              C4_MOVE_ARGV,
              deletedContext,
            );
            assertDeltaContent(
              report,
              { generated: fullRegenerationSet, removed: [] },
              deletedContext,
            );
          },
          `${deletedContext}: the preview still writes nothing — no ` +
            `refresh, no record rebuild (SPEC 6.6, 13.3)`,
        );
        const postPreview = await snapshotDirectory(workspace.root);
        for (const key of postPreview.entries.keys()) {
          if (isGraphDataKey(key)) {
            fail(
              `${deletedContext}: graph data must still be absent after ` +
                `the preview — a preview writes nothing and never ` +
                `refreshes the record (SPEC 6.6, 13.3); found ` +
                `${displaySnapshotPath(key)}`,
            );
          }
        }
      },
    );

    // --- The created-target move of T6.6-4(d), staged identically: the
    // new file's derived paths under `generated` ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      { [D4_SOLO]: D4_SOLO_SOURCE },
      async (workspace) => {
        const context = "T6.6-5 created-target move (T6.6-4(d)'s staging)";
        const before = await snapshotDirectory(workspace.root);
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` (SPEC 6.5, 6.6)`,
        );
        const after = await snapshotDirectory(workspace.root);
        const observed = observeDerivedWrites(
          addedFiles(before, after),
          [D4_SOLO],
          false,
          `${context} staging observation`,
        );
        const solo = observed.get(D4_SOLO)!;
        // The created file's derived paths: the destination's module and
        // companions — no Markdown component, emission being disabled
        // (SPEC 7.3, 13.1). The origin file stays, its recorded paths
        // regenerated in place, so `removed` is exactly [].
        const madeDerived = byteSortedPaths(
          transposeModuleCompanions(solo, D4_SOLO, D4_MADE),
        );
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const report = await runPreviewJson(
              product,
              workspace,
              D4_MOVE_ARGV,
              context,
            );
            assertDeltaContent(
              report,
              { generated: madeDerived, removed: [] },
              context,
            );
          },
          `${context}: the preview modifies nothing (SPEC 6.6)`,
        );
      },
    );

    // --- Lagging-record counterpart: arm (c)'s sources built WITHOUT
    // emission, then `markdown.emit` enabled in the configuration with no
    // rebuild, and the same file-form move previewed ---
    await withWorkspace(
      SPECS_ONLY_CONFIG,
      {
        [C4_MV]: C4_MV_SOURCE,
        [C4_PAL]: C4_PAL_SOURCE,
        [C4_USER]: C4_USER_SOURCE,
      },
      async (workspace) => {
        const context = "T6.6-5 file-form move (record lagging)";
        const before = await snapshotDirectory(workspace.root);
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` with emission disabled — ` +
            `the record then holds modules and companions alone (SPEC ` +
            `12.1, 13.3)`,
        );
        const after = await snapshotDirectory(workspace.root);
        assertGraphDataPresent(
          after,
          `${context}: staging premise — the record the delta consults`,
        );
        const observed = observeDerivedWrites(
          addedFiles(before, after),
          [C4_MV, C4_PAL, C4_USER],
          false,
          `${context} staging observation`,
        );
        const mv = observed.get(C4_MV)!;

        // Enable emission in the configuration, no rebuild: the record now
        // lags the configuration — no Markdown path recorded — and a
        // lagging record alone is never staleness (SPEC 13.3); the preview
        // plans under the current configuration and consults the record as
        // it stands (6.6).
        await workspace.file("xspec.config.ts", SPECS_MD_CONFIG);

        // `generated`: the paths the current configuration generates that
        // the stale record lacks — the destination's module, companions,
        // and Markdown (nothing recorded there) together with every OTHER
        // discovered source's Markdown emit destination (unrecorded, the
        // record predating emission). The staying sources' recorded modules
        // and companions regenerate in place, in neither direction; the
        // origin's Markdown — never recorded, not generated post-move — is
        // in neither direction either.
        const generated = byteSortedPaths([
          ...transposeModuleCompanions(mv, C4_MV, F5_DEST),
          markdownDestination(F5_DEST),
          markdownDestination(C4_PAL),
          markdownDestination(C4_USER),
        ]);
        // `removed`: exactly the recorded pre-move module and companions —
        // the premise build's observed writes for the origin, no Markdown
        // among them (SPEC 13.3).
        const removed = byteSortedPaths(derivedPathsOf(mv));

        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const report = await runPreviewJson(
              product,
              workspace,
              C4_MOVE_ARGV,
              context,
            );
            assertDeltaContent(report, { generated, removed }, context);
          },
          `${context}: the preview writes nothing — the record stays ` +
            `lagging, never refreshed by a preview (SPEC 6.6, 13.3)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T6.6-6 — unreadable record
// ---------------------------------------------------------------------------

// Staging (module header, H-4): a section-form move whose plan is
// latitude-free — the moved subtree `org.mv` is self-contained (its one
// internal `d` reference points down at its own child and moves with it,
// SPEC 5.3-acyclic) and nothing outside the subtree references a moved node,
// so the move adds and removes no import anywhere (SPEC 6.5) and the
// previewed plan is fully determined by sources + operation: origin deletion
// with the re-identification and reference rewrites nested inside it, and
// the target insertion. `tm` is top-level (no target parent needed) and
// collides with nothing in Target.mdx; the whole move is unambiguously
// valid, so the preview's only imperfection under the corrupt record is the
// record itself (SPEC 14.23).
const R6_ORIGIN = "specs/Origin.mdx";
const R6_TARGET = "specs/Target.mdx";
const R6_ORIGIN_SOURCE = [
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
  "</S>",
  "",
].join("\n");
const R6_TARGET_SOURCE = ['<S id="tgt">', "Target text.", "</S>", ""].join(
  "\n",
);
const R6_MOVE_ARGV = [
  "move",
  `${R6_ORIGIN}#org.mv`,
  `${R6_TARGET}#tm`,
] as const;
// The refused preview staged on the same corrupt-record state: an
// identity-unchanged rename collides with nothing and reports
// `refused-identity-unchanged` alone (SPEC 6.4).
const R6_RENAME_SAME_ARGV = ["rename", R6_ORIGIN, "org", "org"] as const;
// The complete identity mapping the move journals — the moved ID and its
// descendant, prefix-replaced, in full 1.5 identity form, `from`-byte
// ordered (SPEC 6.4, 6.5, 12.7).
const R6_EXPECTED_MAPPING: readonly AppliedMappingPair[] = [
  { from: `${R6_ORIGIN}#org.mv`, to: `${R6_TARGET}#tm` },
  { from: `${R6_ORIGIN}#org.mv.k1`, to: `${R6_TARGET}#tm.k1` },
];

/**
 * A successful preview's plan members, non-null — `mapping`, `files`, and
 * `delta` are `null` exactly on refusal, all together (SPEC 6.6, 12.7; the
 * decode already rejects mixed nullity).
 */
function requirePreviewPlan(
  report: PreviewReport,
  context: string,
): {
  readonly mapping: readonly AppliedMappingPair[];
  readonly files: readonly PreviewFileEntry[];
  readonly delta: PreviewDeltaDatum;
} {
  const { mapping, files, delta } = report;
  if (mapping === null || files === null || delta === null) {
    fail(
      `${context}: the preview emits its full plan — \`mapping\`, ` +
        `\`files\`, and \`delta\` are null exactly on refusal (SPEC 6.6, ` +
        `12.7); got mapping ${mapping === null ? "null" : "present"}, ` +
        `files ${files === null ? "null" : "present"}, delta ` +
        `${delta === null ? "null" : "present"}`,
    );
  }
  return { mapping, files, delta };
}

const T6_6_6 = defineProductTest({
  id: "T6.6-6",
  title:
    "unreadable record: with the product-written graph data corrupted shape-blind (garbage over T13.3-2's operational path set; H-3 record-staging adapter), a move `--preview` whose plan is otherwise valid exits 1 emitting the full preview — `mapping` and `files` complete: the exact journaled mapping, the files deep-equal to the intact-record run on the identical sources — with `delta` explicitly unavailable as one datum, never read as an empty record, and the condition-23 finding (`unreadable-record`, concerned path the graph-data area `.xspec`, no path inside it named: locations []) in `findings`; the real operation on the same state is not refused — it proceeds, its applied mapping the previewed mapping, its finishing regeneration replacing the corrupt record (`check` clean afterward, T12.2-2) — and a refused preview staged on the same corrupt-record state (an identity-unchanged rename) reports the refusal finding alone with `mapping`/`files`/`delta` null, never a condition-23 finding (SPEC 6.6, 6.4, 6.5, 14.23, 14.10, 11.6, 12.0, 12.7, 13.3; H-3, H-4)",
  run: async (product) => {
    await withWorkspace(
      SPECS_MD_CONFIG,
      { [R6_ORIGIN]: R6_ORIGIN_SOURCE, [R6_TARGET]: R6_TARGET_SOURCE },
      async (workspace) => {
        const context = "T6.6-6";
        // Premise: the record under corruption is one the product itself
        // wrote (H-3) — the staged workspace builds and graph data exists.
        await buildOk(
          product,
          workspace,
          `${context}: staging premise \`build\` — it writes the record the ` +
            `corruption then applies to (SPEC 12.1, 13.3; H-3)`,
        );
        assertGraphDataPresent(
          await snapshotDirectory(workspace.root),
          `${context}: staging premise — the product-written record exists`,
        );

        // Intact-record reference run of the same preview: exit 0, findings
        // [], delta a plain value — pinning the plan the corrupt-state run
        // must still emit in full. Wrapped in its own modifies-nothing
        // compare, so the two runs' inputs differ in the record bytes alone.
        const intactContext = `${context} (record intact)`;
        const intactReport = await assertLeavesUnchanged(
          workspace.root,
          async () =>
            await runPreviewJson(
              product,
              workspace,
              R6_MOVE_ARGV,
              intactContext,
            ),
          `${intactContext}: the preview modifies nothing (SPEC 6.6)`,
        );
        assertSameJson(
          intactReport.findings,
          [],
          `${intactContext}: on a readable record, this valid move's ` +
            `preview reports findings [] (SPEC 6.6, 12.7)`,
        );
        const intact = requirePreviewPlan(intactReport, intactContext);
        if ("unavailable" in intact.delta) {
          fail(
            `${intactContext}: with the record readable, the delta is the ` +
              `plain two-direction value — unavailability covers recorded ` +
              `state that exists but cannot be read (SPEC 6.6, 14.23)`,
          );
        }
        assertSameJson(
          intact.mapping,
          R6_EXPECTED_MAPPING,
          `${intactContext}: staging premise — the previewed plan maps ` +
            `exactly the moved subtree, prefix-replaced, in full 1.5 ` +
            `identity form (SPEC 6.4, 6.5, 6.6, 12.7)`,
        );
        assertSameJson(
          intact.files.map((entry) => entry.file),
          [R6_ORIGIN, R6_TARGET],
          `${intactContext}: staging premise — the plan rewrites the origin ` +
            `and the target file (SPEC 6.5, 6.6, 12.7), so the ` +
            `completeness equality on the corrupt-record run has content`,
        );

        // Corrupt the product-written record shape-blind (TEST-SPEC
        // T6.6-6; H-3 adapter — garbage over T13.3-2's operational path
        // set, files present but readable as no record).
        await corruptGraphDataShapeBlind(
          workspace.root,
          `${context}: corrupt-record staging`,
        );

        // Both corrupt-state previews inside ONE whole-root compare: a
        // preview writes nothing and never refreshes the record (SPEC 6.6,
        // 13.3), so the corrupt state persists byte for byte and the real
        // operation below runs on the same state.
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            // (1) The move preview: full plan, delta explicitly
            // unavailable, the condition-23 finding, exit 1 (SPEC 14.23).
            const corruptContext = `${context} (record corrupt), move preview`;
            const argv = [...R6_MOVE_ARGV, "--preview", "--json"];
            const result = await expectExit(
              product,
              workspace,
              argv,
              1,
              `${corruptContext}: \`${argv.join(" ")}\` — an answer ` +
                `carrying a finding and explicitly-unavailable data exits ` +
                `1, the full answer still emitted (SPEC 14.23, 12.0)`,
            );
            const report = decodePreviewReport(
              parseJsonStdout(
                result,
                `${corruptContext}: a single JSON document as the entire ` +
                  `stdout (SPEC 12.0)`,
              ),
              corruptContext,
            );
            assertConditionCounts(
              report.findings,
              { "14.23": 1 },
              `${corruptContext}: exactly the one condition-23 finding ` +
                `(stable code unreadable-record) accompanies the answer — ` +
                `the workspace is otherwise clean (SPEC 14.23, 14)`,
            );
            const finding = report.findings[0]!;
            assertFindingConcernsPath(
              finding,
              GRAPH_DATA_AREA_PATH,
              `${corruptContext}: the concerned path is the graph-data ` +
                `area — the .xspec directory spelled as its ` +
                `workspace-relative path, no trailing separator (SPEC ` +
                `14.23, 11.6)`,
            );
            assertSameJson(
              finding.locations,
              [],
              `${corruptContext}: no path inside the area is named — the ` +
                `record's layout is deliberately unenumerated (SPEC 14.23, ` +
                `13.3), and a path-concerned condition is unlocated: ` +
                `locations [] (SPEC 12.7; T12.7-1)`,
            );
            const plan = requirePreviewPlan(report, corruptContext);
            assertSameJson(
              plan.mapping,
              R6_EXPECTED_MAPPING,
              `${corruptContext}: \`mapping\` complete — the complete ` +
                `identity mapping the operation would journal, exactly as ` +
                `on the readable record (SPEC 6.6, 14.23)`,
            );
            assertSameJson(
              plan.files,
              intact.files,
              `${corruptContext}: \`files\` complete — every other part of ` +
                `the preview report is emitted in full, equal to the ` +
                `intact-record run on these byte-identical sources (the ` +
                `plan holds no import addition, so no 6.5 latitude can ` +
                `differ between the runs) (SPEC 14.23, 6.6)`,
            );
            if (!("unavailable" in plan.delta)) {
              fail(
                `${corruptContext}: the record-supplied datum — the delta ` +
                  `— is reported explicitly unavailable as one datum, ` +
                  `never fabricated and never read as an empty record ` +
                  `(SPEC 14.23, 6.6, 12.7); got ` +
                  `${JSON.stringify(plan.delta)}`,
              );
            }

            // (2) A refused preview staged on the same corrupt-record
            // state: the identity-unchanged rename reports its refusal
            // finding alone — a refused preview consults no record, so no
            // condition-23 finding ever accompanies it (SPEC 6.6, 6.4).
            const refusedContext = `${context} (record corrupt), refused rename preview`;
            const refusedArgv = [...R6_RENAME_SAME_ARGV, "--preview", "--json"];
            const refused = await expectExit(
              product,
              workspace,
              refusedArgv,
              1,
              `${refusedContext}: \`${refusedArgv.join(" ")}\` — an ` +
                `identity-unchanged rename is refused, previewed exactly ` +
                `as real (SPEC 6.4, 6.6, 12.0)`,
            );
            const refusedReport = decodePreviewReport(
              parseJsonStdout(
                refused,
                `${refusedContext}: a single JSON document as the entire ` +
                  `stdout (SPEC 12.0)`,
              ),
              refusedContext,
            );
            assertConditionCounts(
              refusedReport.findings,
              { "refused-identity-unchanged": 1 },
              `${refusedContext}: the refusal findings alone — ` +
                `refused-identity-unchanged and nothing beside it, never a ` +
                `condition-23 finding: a refused preview consults no ` +
                `record (SPEC 6.4 "reports refused-identity-unchanged ` +
                `alone", 6.6, 14)`,
            );
            if (
              refusedReport.mapping !== null ||
              refusedReport.files !== null ||
              refusedReport.delta !== null
            ) {
              fail(
                `${refusedContext}: a refused preview's \`mapping\`, ` +
                  `\`files\`, and \`delta\` are null (SPEC 6.6, 12.7); got ` +
                  `mapping ` +
                  `${refusedReport.mapping === null ? "null" : "present"}, ` +
                  `files ` +
                  `${refusedReport.files === null ? "null" : "present"}, ` +
                  `delta ` +
                  `${refusedReport.delta === null ? "null" : "present"}`,
              );
            }
          },
          `${context} (record corrupt): the previews modify nothing — no ` +
            `sources, no journal, no derived files, no graph data: the ` +
            `corrupt record is not repaired, replaced, or removed, so the ` +
            `real operation below runs on the same state (SPEC 6.6, 13.3)`,
        );

        // The real operation on the same corrupt-record state is not
        // refused — a corrupt record fails no build validation, so the
        // unreadable record lies on the success side of the refusal
        // equivalence (SPEC 6.6) — and its finishing regeneration replaces
        // the corrupt record (SPEC 6.4, 6.5).
        const realContext = `${context} (record corrupt), real move`;
        const realArgv = [...R6_MOVE_ARGV, "--json"];
        const applied = decodeAppliedMappingReport(
          await runJson(
            product,
            workspace,
            realArgv,
            `${realContext}: \`${realArgv.join(" ")}\` — the real ` +
              `operation proceeds, exit 0 (SPEC 6.6, 6.5, 12.0)`,
          ),
          realContext,
        );
        assertAppliedMapping(
          applied,
          R6_EXPECTED_MAPPING,
          `${realContext}: the applied mapping is the previewed mapping — ` +
            `the corrupt-state preview reported the complete identity ` +
            `mapping the operation has now journaled (SPEC 6.4, 6.5, 6.6)`,
        );
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          `${context}: after the real move, \`check\` is clean — the ` +
            `finishing regeneration replaced the corrupt record and left ` +
            `no stale output (SPEC 6.4, 12.1, 14.10, 14.23; T12.2-2)`,
        );
      },
    );
  },
});

export const section66Tests: readonly ProductTestEntry[] = [
  T6_6_2,
  T6_6_3,
  T6_6_4,
  T6_6_5,
  T6_6_6,
];
