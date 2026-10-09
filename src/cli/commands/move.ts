// `xspec move <old-file> <new-file>` /
// `xspec move <file>#<id> <target-file>#<new-id>` (SPEC 6.5).
//
// The file form relocates a source file: IDs unchanged, identities changed
// only in their file part; the moved file's own import specifiers and other
// files' imports of its generated module rewritten so all references
// resolve; the full mapping appended to the journal (SPEC 6.1); finishing
// regeneration exactly as `xspec build` (SPEC 12.1, 6.4) — which cannot
// fail, because move only ever rewrites a valid workspace. A move operand
// is classified by spelling alone (SPEC 6.5): an operand containing `#` is
// a `<file>#<id>` pair under the split of 12.0, one without is a file — and
// the parser (cli/args.ts) has already rejected, as syntax-determined usage
// errors reported without loading configuration (SPEC 12.0), every
// invocation this classification cannot serve: a non-UTF-8 operand value, a
// multi-`#` operand (a malformed value), and an invocation mixing the two
// synopses' forms. The handler therefore only ever sees two operands of one
// form.
//
// The section form extracts the section subtree with the exact text edits
// of SPEC 6.5 (deletion with the SPEC 3 line-drop rule; insertion before
// the target parent's closing tag or at the end of the file; a self-closing
// target parent rewritten to paired form; the target file created when
// absent), re-identifies it by prefix replacement, rewrites every reference
// converting between local and imported forms with deterministic import
// additions and exact removals, appends the full mapping to the journal,
// and regenerates (core/move.ts holds the pure derivation).
//
// Outcome precedence (SPEC 6.5, 6.4, 12.0, 13.5, 14) — upstream of it all,
// the parse-level operand classification above (SPEC 12.0: within exit
// class 2, an error the invocation's syntax alone determines is reported
// without loading configuration):
//
// 1. Configuration errors (SPEC 14.14): usage class, exit 2, preceding all
//    source analysis — the configuration file's (cli/main.ts) and then
//    discovery's (a file matched by both a spec and a code group), met
//    with discovery's refused reads (14.25) before exclusivity is acquired
//    (SPEC 13.5, 12.0; ./mutation.ts).
// 2. Workspace exclusivity (SPEC 13.5): `move` is a mutating command — while
//    another one runs, it fails promptly with a usage error (exit 2)
//    modifying nothing; with `--test-hold <path>`, the hold file is created
//    immediately after acquiring exclusivity and before modifying anything,
//    and the command proceeds only once it has been deleted. A preview
//    acquires nothing (SPEC 6.6).
// 3. Argument existence (SPEC 6.5 → 12.0): a nonexistent origin file (either
//    form) or origin ID is a usage error (exit 2) — checked before source
//    validation, so it is reported even when the sources also fail build
//    validation. One exception (SPEC 12.0, 14): an origin ID inside an
//    unparseable origin file (14.20) is masked — the validation findings are
//    reported and the command exits 1.
// 4. Valid-workspace precondition (SPEC 6.5 → 6.4): when the current
//    workspace fails the validations of `xspec build`, the move refuses
//    (exit 1) before modifying anything, reporting those findings alone —
//    no refusal reason evaluated or reported beside them (SPEC 14).
// 5. The refusal contract (SPEC 6.5, 14): every applicable refusal reason
//    is evaluated together over the valid workspace (core/refusal.ts) —
//    the mirrored identity checks (intrinsic form, identity change,
//    collisions after the removal), the target parent, destination
//    occupancy and validity (obstructed destination-side directory
//    components and the derived-path relations over the sources after the
//    move included), the file form's origin emit destination exposed to
//    discovery (`refused-exposed-derived-file`), would-be dependency and
//    spec-import cycles,
//    the section form's would-be text — each judged file well-formed, each
//    added import at an admissible offset (`refused-invalid-rewrite`) —
//    and moved text holding an import declaration (no reason exists for a
//    rewritten reference: each resolves by construction, SPEC 6.4, 6.5) —
//    and a refused move reports one finding per reason, each with its
//    stable code and concerned identity, path, or located participants (at
//    current, pre-operation coordinates), as the 12.7 findings report
//    (exit 1), modifying nothing. `--preview` (SPEC 6.6) shares exactly
//    this evaluation. The destination-side filesystem facts, and the
//    occupant of the origin's emit destination, are probed by the
//    workspace layer (workspace/writes.ts) over exactly the paths the core
//    assessments name.
// 6. The rewritten workspace is re-validated in memory and the complete
//    write set passes the SPEC 14.22 symlink check — internal-consistency
//    guards on the would-succeed path (the refusal evaluation above
//    realizes the no-new-cycles rule for the user-facing contract, and
//    every rewritten reference resolves by construction); any finding
//    refuses (exit 1) before modifying anything. `--preview` runs these
//    guards too and reports its plan only past them, refused exactly when
//    the real operation would be (SPEC 6.6; ./rewrite-validation.ts).
//
// Success writes the rewritten sources, removes the origin (file form),
// appends the journal entry, and regenerates; the report is the applied
// mapping — the complete identity mapping the operation journaled, the
// information of the preview's `mapping` (SPEC 6.5, 6.4, 6.6) — with
// `--json`, the single JSON document (SPEC 12.0).

import { compareBytes } from "../../core/bytes.js";
import type {
  DiscoveredSource,
  SourceClassification,
} from "../../core/discovery.js";
import { orderSourceWrites } from "../../core/edits.js";
import type { ExitCode } from "../../core/findings.js";
import type { SpecFileAnalysis } from "../../core/graph.js";
import { appendedJournalBytes } from "../../core/journal.js";
import type { MoveFilePlan, MoveSectionPlan } from "../../core/move.js";
import { planMoveFile, planMoveSection } from "../../core/move.js";
import type {
  DestinationPathAssessment,
  DestinationProbe,
  EmitDestinationProbe,
} from "../../core/refusal.js";
import {
  assessDestinationPath,
  evaluateMoveFileRefusals,
  evaluateMoveSectionRefusals,
  exposableEmitDestination,
  UNPROBED_DESTINATION,
} from "../../core/refusal.js";
import { executeBuildOutputs } from "../../workspace/build.js";
import { buildValidationFindings } from "../../workspace/build-validation.js";
import type { LoadedWorkspace } from "../../workspace/config.js";
import {
  appendJournalEntry,
  journalFromBytes,
} from "../../workspace/journal.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import {
  analyzeWorkspace,
  analyzeWorkspaceContent,
} from "../../workspace/pipeline.js";
import {
  nonDirectoryComponents,
  performSourceWrites,
  probeOccupant,
} from "../../workspace/writes.js";
import type { Invocation } from "../args.js";
import { flagPresent, isValidUtf8ArgumentValue } from "../args.js";
import type { CommandContext } from "../io.js";
import { emitAppliedMappingReport } from "../report.js";
import { usageError } from "./common.js";
import { runMutatingCommand } from "./mutation.js";
import { emitSuccessfulPreview } from "./preview.js";
import {
  emitFindingsRefusal,
  validateRewrittenWorkspace,
} from "./rewrite-validation.js";

/**
 * Assess a move destination and probe its filesystem facts (SPEC 6.5):
 * the pure path assessment (core/refusal.ts), then — for a well-formed,
 * probeable path only — the destination occupant (skipped for an already
 * discovered section-form target, whose occupant question does not arise)
 * and the non-directory directory components of the destination-side
 * write paths the assessment names. A malformed spelling is never
 * resolved against the workspace root (SPEC 1.5).
 */
async function assessAndProbeDestination(
  workspace: LoadedWorkspace,
  destination: string,
  probeOccupancy: boolean,
): Promise<{
  readonly assessment: DestinationPathAssessment;
  readonly probe: DestinationProbe;
}> {
  const assessment = assessDestinationPath(
    destination,
    isValidUtf8ArgumentValue(destination),
    workspace.configuration,
  );
  if (!assessment.probeable) {
    return { assessment, probe: UNPROBED_DESTINATION };
  }
  return {
    assessment,
    probe: {
      occupant: probeOccupancy
        ? await probeOccupant(workspace.root, destination)
        : "file",
      obstructedComponents: await nonDirectoryComponents(
        workspace.root,
        assessment.componentProbePaths,
      ),
    },
  };
}

/**
 * Probe the origin's emit destination for `refused-exposed-derived-file`
 * (SPEC 6.5, 14) where the pure half (core/refusal.ts
 * `exposableEmitDestination`) names it — its occupant by `lstat`, never
 * through a symbolic link (SPEC 13.4), and its workspace-relative directory
 * components holding anything other than a directory, which discovery
 * never traverses (SPEC 7) — or null, probing nothing, where it names none.
 */
async function probeEmitDestination(
  workspace: LoadedWorkspace,
  classification: SourceClassification,
  originPath: string,
  destination: string,
): Promise<EmitDestinationProbe | null> {
  const path = exposableEmitDestination(
    workspace.configuration,
    classification,
    originPath,
    destination,
  );
  if (path === null) return null;
  return {
    path,
    occupant: await probeOccupant(workspace.root, path),
    obstructedComponents: await nonDirectoryComponents(workspace.root, [path]),
  };
}

/** The parsed shape of one `move` argument: a bare file, or `file#id`. */
interface MoveArgument {
  readonly file: string;
  /** The part after the first `#`; null for a bare file path. */
  readonly id: string | null;
}

/**
 * Split a `move` argument at its `#` (SPEC 6.5 under the split of 12.0).
 * The parser has already rejected any operand containing more than one
 * `#` as a malformed value (SPEC 12.0), so the split is never ambiguous:
 * the operand's sole `#` separates file from ID.
 */
function parseMoveArgument(raw: string): MoveArgument {
  const hash = raw.indexOf("#");
  if (hash === -1) {
    return { file: raw, id: null };
  }
  return { file: raw.slice(0, hash), id: raw.slice(hash + 1) };
}

/**
 * The move operation — run under workspace exclusivity (SPEC 13.5), or as
 * its `--preview` (SPEC 6.6), which shares every validation and the plan,
 * takes no exclusivity, and modifies nothing. `discovered` is the
 * workspace's classification, made before acquisition, its configuration
 * errors already reported (SPEC 13.5, 14.14; ./mutation.ts): the analysis
 * here reads the sources' content and the journal.
 */
async function runMove(
  invocation: Invocation,
  context: CommandContext,
  originArg: string,
  destinationArg: string,
  preview: boolean,
  discovered: SourceClassification,
): Promise<ExitCode> {
  const { workspace, stdout } = context;

  // SPEC 6.5: each operand's spelling selects the form — a bare path is
  // the file form, `file#id` the section form. The parser has already
  // rejected mixed-synopsis invocations (SPEC 12.0), so the two operands
  // parse to one form.
  const origin = parseMoveArgument(originArg);
  const destination = parseMoveArgument(destinationArg);

  const analysis = await analyzeWorkspace(workspace, discovered);

  // SPEC 6.5 → 12.0: the argument existence checks precede source
  // validation. The origin file must name a discovered spec source
  // (workspace-relative, SPEC 12.0, 1.5; byte-wise comparison).
  if (
    !analysis.classification.specSources.some((s) => s.path === origin.file)
  ) {
    return usageError(
      invocation,
      context,
      `unknown file '${origin.file}' — the origin must name a discovered ` +
        `source file of a configured spec group, workspace-relative ` +
        `(SPEC 6.5, 12.0)`,
    );
  }

  // SPEC 12.0/14: an origin ID inside an unparseable origin file (14.20) is
  // masked — the origin was discovered but yielded no document, so the
  // workspace fails `build`'s validations and the invalid-workspace
  // refusal below is the report: the workspace's findings, exit 1. The
  // file form takes the same path: an unparseable origin fails build
  // validation.
  const originSpec = analysis.specs.find(
    (s) => s.document.path === origin.file,
  );
  if (originSpec === undefined) {
    return emitFindingsRefusal(
      preview,
      invocation.json,
      stdout,
      await buildValidationFindings(workspace, analysis),
    );
  }

  // SPEC 6.5 → 12.0: a nonexistent origin ID (section form) is a usage
  // error, checked before source validation.
  if (origin.id !== null) {
    const section = originSpec.document.sections.find(
      (s) => s.id === origin.id,
    );
    if (section === undefined) {
      return usageError(
        invocation,
        context,
        `unknown ID '${origin.id}' in '${origin.file}' — <id> must name an ` +
          `existing requirement ID of that file (SPEC 6.5, 12.0)`,
      );
    }
  }

  // SPEC 6.5 → 6.4: refuse, before modifying anything, when the current
  // workspace fails the validations of `xspec build` — source validation
  // errors, journal errors (14.13), and refused writes (14.22) alike, the
  // findings a `build` would now report (SPEC 13.3;
  // workspace/build-validation.ts) — move only ever rewrites a valid
  // workspace. The findings are the report (SPEC 12.0), alone: no refusal
  // reason is evaluated or reported beside them (SPEC 14) — a destination
  // under a component that already obstructs the current workspace's
  // write paths is this refusal, never `refused-invalid-destination`.
  const workspaceFindings = await buildValidationFindings(workspace, analysis);
  if (workspaceFindings.length > 0) {
    return emitFindingsRefusal(
      preview,
      invocation.json,
      stdout,
      workspaceFindings,
    );
  }

  if (origin.id !== null) {
    if (destination.id === null) {
      // Unreachable: the parser rejects mixed-synopsis invocations
      // (SPEC 6.5, 12.0). Guarded so a parse regression fails loudly.
      throw new Error("xspec internal error: section move without a new ID");
    }
    return runMoveSection(
      invocation,
      context,
      analysis,
      originSpec,
      origin.id,
      destination.file,
      destination.id,
      preview,
    );
  }

  if (destination.id !== null) {
    // Unreachable: the parser rejects mixed-synopsis invocations (SPEC 6.5,
    // 12.0). Guarded so a parse regression fails loudly instead of treating
    // a pair operand as a destination path.
    throw new Error("xspec internal error: file move with a pair destination");
  }
  return runMoveFile(
    invocation,
    context,
    analysis,
    origin.file,
    destination.file,
    preview,
  );
}

/** The file form (SPEC 6.5), past the shared argument and precondition checks. */
async function runMoveFile(
  invocation: Invocation,
  context: CommandContext,
  analysis: WorkspaceAnalysis,
  originPath: string,
  destination: string,
  preview: boolean,
): Promise<ExitCode> {
  const { workspace, stdout, stderr } = context;

  // SPEC 6.5/14: evaluate every applicable refusal reason together over
  // the valid workspace — destination occupancy and validity, identity
  // change, the origin's emit destination exposed to discovery, and the
  // would-be cycles, one finding per reason — and refuse (exit 1) with the
  // 12.7 findings report, nothing modified. `--preview` shares exactly
  // this evaluation (SPEC 6.6).
  const { assessment, probe } = await assessAndProbeDestination(
    workspace,
    destination,
    true,
  );
  const emitDestinationProbe = await probeEmitDestination(
    workspace,
    analysis.classification,
    originPath,
    destination,
  );
  const refusals = evaluateMoveFileRefusals({
    configuration: workspace.configuration,
    classification: analysis.classification,
    specs: analysis.specs,
    code: analysis.code,
    graph: analysis.graph,
    originPath,
    destination,
    assessment,
    probe,
    emitDestinationProbe,
  });
  if (refusals.length > 0) {
    return emitFindingsRefusal(preview, invocation.json, stdout, refusals);
  }

  // The pure plan: the identity mapping (file part only), the journal
  // entry, the minimal import-specifier rewrites, and the classed preview
  // edits — one plan for the real operation and its preview (SPEC 6.5,
  // 6.1, 6.6).
  const plan = planMoveFile(
    analysis.specs,
    analysis.code,
    originPath,
    destination,
  );

  // Re-validate the rewritten workspace in memory and vet the complete
  // write set — the rewritten sources, the destination included — before
  // touching anything (SPEC 6.5: all rewritten references resolve, no
  // import or dependency cycle arises, and the finishing regeneration
  // cannot fail). The journal is modeled as it will stand after the append
  // — hashes take the journal as an input (SPEC 5.4), and the file form is
  // pure (SPEC 6.2), so the regenerated graph data matches a fresh build of
  // the moved workspace byte for byte (SPEC 6.5, 12.0); the stored record's
  // paths for the origin's generated files are no longer generated and
  // become orphans, so no stale output (14.10) remains. The preview runs
  // the same validation, refused exactly when the real operation would be
  // (SPEC 6.6; ./rewrite-validation.ts).
  const rewritten = await reanalyzeMoved(
    workspace,
    analysis,
    plan,
    originPath,
    destination,
    assessment.specGroups,
  );
  const verdict = await validateRewrittenWorkspace(
    invocation,
    context,
    rewritten,
    plan.rewrites.map((rewrite) => rewrite.path),
    preview,
  );
  if (!verdict.proceeds) {
    return verdict.exit;
  }

  // SPEC 6.6: a preview reports the plan and performs it on nothing. The
  // post-operation generation set follows the post-move source set — the
  // origin's entry replaced by the destination — so the delta carries the
  // destination's newly generated derived paths and the recorded pre-move
  // paths left no longer generated (SPEC 6.6, 13.1–13.3).
  if (preview) {
    return emitSuccessfulPreview(
      invocation.json,
      stdout,
      workspace,
      plan.entry.mapping,
      plan.previewFiles,
      analysis.classification.specSources.map((source) =>
        source.path === originPath ? destination : source.path,
      ),
    );
  }

  // All validation passed — modify: write the rewritten sources (atomic per
  // file, SPEC 13.5), in the preview's `files` order — the relocation,
  // under the origin's path, producing the destination and then removing
  // the origin (SPEC 6.5: the file is relocated; 13.5) — append the mapping
  // to the journal (SPEC 6.1, 6.5), and regenerate derived files exactly as
  // `xspec build` does (SPEC 6.5, 6.4). A write the environment refuses
  // stops the operation there (SPEC 14.24, 13.5).
  await performSourceWrites(
    workspace.root,
    orderSourceWrites(plan.rewrites, { origin: originPath, destination }),
  );
  await appendJournalEntry(
    workspace.root,
    analysis.journal.rawBytes,
    plan.entry,
  );
  await executeBuildOutputs(workspace.root, verdict.outputs);

  // SPEC 6.5/6.4/12.0: a successful move reports its applied mapping, as
  // rename does — the complete identity mapping the operation journaled, in
  // both output forms; the journal entry's mapping is that mapping in its
  // canonical `from`-byte order.
  emitAppliedMappingReport(invocation.json, stdout, plan.entry.mapping);
  return 0;
}

/**
 * Analyze the moved workspace entirely in memory: the classification with
 * the origin's entry replaced by the destination (grouped exactly as
 * discovery would group it, SPEC 7), sources served from the rewrite plan
 * (the moved content at the destination, unaffected files from the
 * already-analyzed text), and the journal as it will stand after the append
 * (SPEC 6.5, 5.4).
 */
async function reanalyzeMoved(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
  plan: MoveFilePlan,
  originPath: string,
  destination: string,
  destinationSpecGroups: readonly string[],
): Promise<WorkspaceAnalysis> {
  const encoder = new TextEncoder();
  const byPath = new Map<string, Uint8Array>();
  for (const spec of analysis.specs) {
    byPath.set(spec.document.path, encoder.encode(spec.document.text));
  }
  for (const code of analysis.code) {
    byPath.set(code.path, encoder.encode(code.text));
  }
  byPath.delete(originPath);
  for (const rewrite of plan.rewrites) {
    byPath.set(rewrite.path, rewrite.content);
  }
  // The post-move classification: the origin's entry replaced by the
  // destination, byte-ordered by path (SourceClassification's contract).
  const movedSource: DiscoveredSource = {
    path: destination,
    groups: destinationSpecGroups,
  };
  const classification: SourceClassification = {
    specSources: [
      ...analysis.classification.specSources.filter(
        (source) => source.path !== originPath,
      ),
      movedSource,
    ].sort((a, b) => compareBytes(a.path, b.path)),
    codeSources: analysis.classification.codeSources,
    // A valid workspace discovers none (SPEC 14.19 gates move, 6.5).
    invalidSources: analysis.classification.invalidSources,
    findings: [],
  };
  // SPEC 6.4, 5.4: the journal as validated — the bytes this analysis
  // loaded (null for an absent journal, SPEC 6.1) — plus the new entry on
  // a line of its own, composed exactly as the append will write it
  // (`appendedJournalBytes`, SPEC 6.1, 13.3). Validation passed, so it bore
  // no 14.13 finding: an unreadable journal, its content refused
  // (SPEC 14.25) included, never reaches this point.
  const journalBytes = appendedJournalBytes(
    analysis.journal.rawBytes,
    plan.entry,
  );
  return analyzeWorkspaceContent(workspace.configuration, {
    classification,
    readSource: (rel) => Promise.resolve(byPath.get(rel) ?? null),
    // A valid workspace discovers no invalid-path sources (SPEC 14.19
    // gates move, 6.5), so this reanalysis is never asked for one.
    readInvalidSource: () => Promise.resolve(null),
    loadJournal: () => Promise.resolve(journalFromBytes(journalBytes)),
  });
}

/** The section form (SPEC 6.5), past the shared argument and precondition checks. */
async function runMoveSection(
  invocation: Invocation,
  context: CommandContext,
  analysis: WorkspaceAnalysis,
  originSpec: SpecFileAnalysis,
  oldId: string,
  targetPath: string,
  newId: string,
  preview: boolean,
): Promise<ExitCode> {
  const { workspace, stdout, stderr } = context;
  const originPath = originSpec.document.path;
  const sameFile = targetPath === originPath;

  // SPEC 6.5: resolve the target file — the origin itself, another
  // discovered spec source, or no discovered source at all (the path the
  // move would create, or an occupant the evaluation refuses).
  const targetSpec: SpecFileAnalysis | null = sameFile
    ? originSpec
    : (analysis.specs.find((spec) => spec.document.path === targetPath) ??
      null);

  // SPEC 6.5/14: evaluate every applicable refusal reason together over
  // the valid workspace — the mirrored identity checks, the target
  // parent, destination occupancy and validity, the would-be text's
  // well-formedness and import additions, and would-be cycles, one
  // finding per reason (no reason exists for an unresolvable rewritten
  // reference: each resolves by construction, SPEC 6.4) — and
  // refuse (exit 1) with the 12.7 findings report, nothing modified. The
  // destination probes run only where no discovered spec source occupies
  // the target path (a discovered target raises no occupancy or validity
  // question); its destination-side directory components are vetted
  // either way.
  const { assessment, probe } = await assessAndProbeDestination(
    workspace,
    targetPath,
    targetSpec === null,
  );
  const refusals = evaluateMoveSectionRefusals({
    configuration: workspace.configuration,
    classification: analysis.classification,
    specs: analysis.specs,
    code: analysis.code,
    graph: analysis.graph,
    origin: originSpec,
    oldId,
    targetPath,
    newId,
    target: targetSpec,
    assessment,
    probe,
  });
  if (refusals.length > 0) {
    return emitFindingsRefusal(preview, invocation.json, stdout, refusals);
  }
  const createGroups: readonly string[] | null =
    targetSpec === null ? assessment.specGroups : null;

  // The pure plan: the identity mapping, the journal entry, the exact text
  // edits, every reference and import rewrite, and the classed preview
  // edits — one plan for the real operation and its preview (SPEC 6.5,
  // 6.1, 6.6).
  const plan = planMoveSection(
    analysis.specs,
    analysis.code,
    originPath,
    oldId,
    targetPath,
    newId,
  );

  // Re-validate the rewritten workspace in memory and vet the complete
  // write set — the rewritten sources, a created target included — before
  // touching anything (SPEC 6.5: all rewritten references resolve,
  // structural rules hold, and no import or dependency cycle arises — 2.1,
  // 5.3 — so the finishing regeneration cannot fail). The journal is
  // modeled as it will stand after the append (SPEC 5.4). The refusal
  // evaluation above realizes every reason a move can be refused for —
  // would-be cycles included, a moved reference to the target file's own
  // root among them — so these guards refuse only a regression. The
  // preview runs the same validation, refused exactly when the real
  // operation would be (SPEC 6.6; ./rewrite-validation.ts).
  const rewritten = await reanalyzeSectionMoved(
    workspace,
    analysis,
    plan,
    targetPath,
    createGroups,
  );
  const verdict = await validateRewrittenWorkspace(
    invocation,
    context,
    rewritten,
    plan.rewrites.map((rewrite) => rewrite.path),
    preview,
  );
  if (!verdict.proceeds) {
    return verdict.exit;
  }

  // SPEC 6.6: a preview reports the plan and performs it on nothing. The
  // post-operation generation set follows the post-move source set — a
  // created target file joins it — so the delta carries the created file's
  // newly generated derived paths (SPEC 6.6, 13.1–13.3).
  if (preview) {
    return emitSuccessfulPreview(
      invocation.json,
      stdout,
      workspace,
      plan.entry.mapping,
      plan.previewFiles,
      [
        ...analysis.classification.specSources.map((source) => source.path),
        ...(plan.createsTargetFile ? [targetPath] : []),
      ],
    );
  }

  // All validation passed — modify: write the rewritten sources (atomic per
  // file, in the preview's `files` order, SPEC 13.5; the origin keeps its
  // path, the target gains the moved text), append the mapping to the
  // journal (SPEC 6.1, 6.5), and regenerate derived files exactly as
  // `xspec build` does (SPEC 6.5, 6.4). A write the environment refuses
  // stops the operation there (SPEC 14.24, 13.5).
  await performSourceWrites(
    workspace.root,
    orderSourceWrites(plan.rewrites, null),
  );
  await appendJournalEntry(
    workspace.root,
    analysis.journal.rawBytes,
    plan.entry,
  );
  await executeBuildOutputs(workspace.root, verdict.outputs);

  // SPEC 6.5/6.4/12.0: a successful move reports its applied mapping, as
  // rename does — the complete identity mapping the operation journaled, in
  // both output forms; the journal entry's mapping is that mapping in its
  // canonical `from`-byte order.
  emitAppliedMappingReport(invocation.json, stdout, plan.entry.mapping);
  return 0;
}

/**
 * Analyze the section-moved workspace entirely in memory: the same
 * classification (extended by a created target file, grouped exactly as
 * discovery would group it, SPEC 7), sources served from the rewrite plan
 * (unaffected files from the already-analyzed text), and the journal as it
 * will stand after the append (SPEC 6.5, 5.4).
 */
async function reanalyzeSectionMoved(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
  plan: MoveSectionPlan,
  targetPath: string,
  createGroups: readonly string[] | null,
): Promise<WorkspaceAnalysis> {
  const encoder = new TextEncoder();
  const byPath = new Map<string, Uint8Array>();
  for (const spec of analysis.specs) {
    byPath.set(spec.document.path, encoder.encode(spec.document.text));
  }
  for (const code of analysis.code) {
    byPath.set(code.path, encoder.encode(code.text));
  }
  for (const rewrite of plan.rewrites) {
    byPath.set(rewrite.path, rewrite.content);
  }
  let classification: SourceClassification = analysis.classification;
  if (plan.createsTargetFile) {
    if (createGroups === null) {
      throw new Error(
        "xspec internal error: a created move target without its spec groups",
      );
    }
    const created: DiscoveredSource = {
      path: targetPath,
      groups: createGroups,
    };
    classification = {
      specSources: [...analysis.classification.specSources, created].sort(
        (a, b) => compareBytes(a.path, b.path),
      ),
      codeSources: analysis.classification.codeSources,
      // A valid workspace discovers none (SPEC 14.19 gates move, 6.5).
      invalidSources: analysis.classification.invalidSources,
      findings: analysis.classification.findings,
    };
  }
  // SPEC 6.4, 5.4: the journal as validated — the bytes this analysis
  // loaded (null for an absent journal, SPEC 6.1) — plus the new entry on
  // a line of its own, composed exactly as the append will write it
  // (`appendedJournalBytes`, SPEC 6.1, 13.3). Validation passed, so it bore
  // no 14.13 finding: an unreadable journal, its content refused
  // (SPEC 14.25) included, never reaches this point.
  const journalBytes = appendedJournalBytes(
    analysis.journal.rawBytes,
    plan.entry,
  );
  return analyzeWorkspaceContent(workspace.configuration, {
    classification,
    readSource: (rel) => Promise.resolve(byPath.get(rel) ?? null),
    // A valid workspace discovers no invalid-path sources (SPEC 14.19
    // gates move, 6.5), so this reanalysis is never asked for one.
    readInvalidSource: () => Promise.resolve(null),
    loadJournal: () => Promise.resolve(journalFromBytes(journalBytes)),
  });
}

/** The `move` command handler (SPEC 6.5, 6.6). */
export async function moveCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const [originArg, destinationArg] = invocation.positionals;
  if (originArg === undefined || destinationArg === undefined) {
    // Unreachable: the parser enforces the two positionals (SPEC 6.5).
    throw new Error("xspec internal error: move without its arguments");
  }
  // SPEC 6.6/13.5: a preview invocation is a non-mutating command — it
  // acquires no workspace exclusivity and does not take the
  // acquisition-tied test seam. `--test-hold` together with `--preview`
  // never reaches here: the parser refuses the pair (cli/args.ts), a
  // syntax-class usage error reported before the configuration is loaded,
  // no hold file created, nothing modified (SPEC 12.0).
  const preview = flagPresent(invocation, "--preview");
  // SPEC 13.5: discovery, then workspace exclusivity around every later
  // check and read, with the `--test-hold` seam immediately after
  // acquisition; a workspace held by another mutating command fails
  // promptly as a usage error (12.0), modifying nothing (./mutation.ts).
  return runMutatingCommand(invocation, context, !preview, (discovered) =>
    runMove(
      invocation,
      context,
      originArg,
      destinationArg,
      preview,
      discovered,
    ),
  );
}
