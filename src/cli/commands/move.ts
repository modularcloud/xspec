// `xspec move <old-file> <new-file>` /
// `xspec move <file>#<id> <target-file>#<new-id>` (SPEC 6.5).
//
// The file form relocates a source file: IDs unchanged, identities changed
// only in their file part; the moved file's own import specifiers and other
// files' imports of its generated module rewritten so all references
// resolve; the full mapping appended to the journal (SPEC 6.1); finishing
// regeneration exactly as `xspec build` (SPEC 12.1, 6.4) — which cannot
// fail, because move only ever rewrites a valid workspace. The form is
// selected by the origin argument: an origin containing `#` names a section
// (the second form), a bare origin names a file.
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
// Outcome precedence (SPEC 6.5, 6.4, 12.0, 13.5, 14):
//
// 1. Workspace exclusivity (SPEC 13.5): `move` is a mutating command — while
//    another one runs, it fails promptly with a usage error (exit 2)
//    modifying nothing; with `--test-hold <path>`, the hold file is created
//    immediately after acquiring exclusivity and before modifying anything,
//    and the command proceeds only once it has been deleted.
// 2. Configuration errors (SPEC 14.14): usage class, exit 2, preceding all
//    source analysis.
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
//    components included), would-be dependency and spec-import cycles, and
//    rewritten references that could not resolve — and a refused move
//    reports one finding per reason, each with its stable code and
//    concerned identity, path, or located participants (at current,
//    pre-operation coordinates), as the 12.7 findings report (exit 1),
//    modifying nothing. `--preview` (SPEC 6.6) shares exactly this
//    evaluation. The destination-side filesystem facts are probed by the
//    workspace layer (workspace/writes.ts) over exactly the paths the
//    core assessment names.
// 6. The rewritten workspace is re-validated in memory and the complete
//    write set passes the SPEC 14.22 symlink check — internal-consistency
//    guards on the would-succeed path (the refusal evaluation above
//    realizes "all rewritten references resolve" and the no-new-cycles
//    rule for the user-facing contract); any finding refuses (exit 1)
//    before modifying anything.
//
// Success writes the rewritten sources, removes the origin (file form),
// appends the journal entry, and regenerates; the report is the applied
// mapping — the complete identity mapping the operation journaled, the
// information of the preview's `mapping` (SPEC 6.5, 6.4, 6.6) — with
// `--json`, the single JSON document (SPEC 12.0).

import { computeBuildOutputs } from "../../core/build.js";
import { compareBytes } from "../../core/bytes.js";
import type {
  DiscoveredSource,
  SourceClassification,
} from "../../core/discovery.js";
import type { ExitCode, Finding } from "../../core/findings.js";
import type { SpecFileAnalysis } from "../../core/graph.js";
import { JOURNAL_PATH, serializeJournalEntry } from "../../core/journal.js";
import type { MoveFilePlan, MoveSectionPlan } from "../../core/move.js";
import { planMoveFile, planMoveSection } from "../../core/move.js";
import type {
  DestinationPathAssessment,
  DestinationProbe,
} from "../../core/refusal.js";
import {
  assessDestinationPath,
  evaluateMoveFileRefusals,
  evaluateMoveSectionRefusals,
  UNPROBED_DESTINATION,
} from "../../core/refusal.js";
import { executeBuildOutputs } from "../../workspace/build.js";
import type { LoadedWorkspace } from "../../workspace/config.js";
import { loadGraphData } from "../../workspace/graph-data.js";
import {
  appendJournalEntry,
  journalFromBytes,
  readJournalBytes,
} from "../../workspace/journal.js";
import { withMutationExclusivity } from "../../workspace/lock.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import {
  analyzeWorkspace,
  analyzeWorkspaceContent,
  workspaceInputsOf,
} from "../../workspace/pipeline.js";
import {
  nonDirectoryComponents,
  probeOccupant,
  removeSourceFile,
  symlinkWritePathFindings,
  writeSourceFile,
} from "../../workspace/writes.js";
import type { Invocation } from "../args.js";
import { isValidUtf8ArgumentValue, jsonOutputInEffect } from "../args.js";
import type { CliWriter, CommandContext } from "../io.js";
import {
  emitAppliedMappingReport,
  emitConfigurationErrors,
  emitFindingsReport,
} from "../report.js";
import { testHoldSpecOf, usageError } from "./common.js";

/**
 * SPEC 6.5/12.0/12.7: a refused move is a validation failure — exit 1, the
 * findings report `{"findings": […]}` on standard output (SPEC 12.0:
 * reports are standard-output content; with `--json`, one JSON document as
 * the entire standard output). Workspace-precondition findings and
 * refusal-reason findings alike go through here — never mixed in one
 * report (SPEC 14).
 */
function emitFindingsRefusal(
  json: boolean,
  stdout: CliWriter,
  findings: readonly Finding[],
): ExitCode {
  emitFindingsReport(json, stdout, findings);
  return 1;
}

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

/** The parsed shape of one `move` argument: a bare file, or `file#id`. */
interface MoveArgument {
  readonly file: string;
  /** The part after the first `#`; null for a bare file path. */
  readonly id: string | null;
}

/**
 * Split a `move` argument at its first `#` (SPEC 6.5, 1.5: discovered
 * source paths never contain `#`, so the first `#` separates file from ID).
 */
function parseMoveArgument(raw: string): MoveArgument {
  const hash = raw.indexOf("#");
  if (hash === -1) {
    return { file: raw, id: null };
  }
  return { file: raw.slice(0, hash), id: raw.slice(hash + 1) };
}

/** Concatenate byte arrays (the hypothetical post-append journal bytes). */
function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** The move operation, run under workspace exclusivity (SPEC 13.5). */
async function runMove(
  invocation: Invocation,
  context: CommandContext,
  originArg: string,
  destinationArg: string,
): Promise<ExitCode> {
  const { workspace, stdout, stderr } = context;

  // SPEC 6.5: the origin argument selects the form — a bare path is the
  // file form, `file#id` the section form.
  const origin = parseMoveArgument(originArg);
  const destination = parseMoveArgument(destinationArg);
  if (origin.id !== null && destination.id === null) {
    // A section origin with a bare-file destination matches neither form
    // (SPEC 6.5): a malformed invocation, a usage error (12.0).
    return usageError(
      invocation,
      context,
      `'${destinationArg}' names no target section — the forms are ` +
        `\`move <old-file> <new-file>\` and \`move <file>#<id> ` +
        `<target-file>#<new-id>\` (SPEC 6.5)`,
    );
  }

  const analysis = await analyzeWorkspace(workspace);

  // SPEC 14.14/12.0: configuration errors precede all source analysis —
  // usage class, exit 2, diagnostics on standard error, nothing modified.
  if (analysis.configurationErrors.length > 0) {
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      workspace.configAnchor,
      analysis.configurationErrors,
    );
    return 2;
  }

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
  // validation findings are reported and the command exits 1. The file form
  // takes the same path: an unparseable origin fails build validation.
  const originSpec = analysis.specs.find(
    (s) => s.document.path === origin.file,
  );
  if (originSpec === undefined) {
    return emitFindingsRefusal(invocation.json, stdout, analysis.findings);
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
  // workspace fails the validations of `xspec build` — move only ever
  // rewrites a valid workspace. The findings are the report (SPEC 12.0).
  if (analysis.findings.length > 0) {
    return emitFindingsRefusal(invocation.json, stdout, analysis.findings);
  }

  if (origin.id !== null) {
    if (destination.id === null) {
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
    );
  }

  return runMoveFile(
    invocation,
    context,
    analysis,
    origin.file,
    destinationArg,
  );
}

/** The file form (SPEC 6.5), past the shared argument and precondition checks. */
async function runMoveFile(
  invocation: Invocation,
  context: CommandContext,
  analysis: WorkspaceAnalysis,
  originPath: string,
  destination: string,
): Promise<ExitCode> {
  const { workspace, stdout, stderr } = context;

  // SPEC 6.5/14: evaluate every applicable refusal reason together over
  // the valid workspace — destination occupancy and validity, identity
  // change, and the would-be cycles, one finding per reason — and refuse
  // (exit 1) with the 12.7 findings report, nothing modified.
  const { assessment, probe } = await assessAndProbeDestination(
    workspace,
    destination,
    true,
  );
  const refusals = evaluateMoveFileRefusals({
    specs: analysis.specs,
    graph: analysis.graph,
    originPath,
    destination,
    assessment,
    probe,
  });
  if (refusals.length > 0) {
    return emitFindingsRefusal(invocation.json, stdout, refusals);
  }

  // The pure plan: the identity mapping (file part only), the journal
  // entry, and the minimal import-specifier rewrites (SPEC 6.5, 6.1).
  const plan = planMoveFile(
    analysis.specs,
    analysis.code,
    originPath,
    destination,
  );

  // Re-validate the rewritten workspace in memory before touching anything
  // (SPEC 6.5: all rewritten references resolve, no import or dependency
  // cycle arises, and the finishing regeneration cannot fail). The journal
  // is modeled as it will stand after the append — hashes take the journal
  // as an input (SPEC 5.4), and the file form is pure (SPEC 6.2), so the
  // regenerated graph data matches a fresh build of the moved workspace
  // byte for byte (SPEC 6.5, 12.0).
  const rewritten = await reanalyzeMoved(
    workspace,
    analysis,
    plan,
    originPath,
    destination,
    assessment.specGroups,
  );
  if (rewritten.configurationErrors.length > 0) {
    // Unreachable: the destination was validated against the same group
    // rules discovery applies. Guarded so a regression reports rather than
    // corrupts.
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      workspace.configAnchor,
      rewritten.configurationErrors,
    );
    return 2;
  }
  if (rewritten.findings.length > 0) {
    // Unreachable: the refusal evaluation above (core/refusal.ts) realizes
    // every reason a move can be refused for, so a validated plan leaves a
    // valid workspace. Guarded so a regression refuses (exit 1, nothing
    // modified) rather than corrupts.
    return emitFindingsRefusal(invocation.json, stdout, rewritten.findings);
  }

  // SPEC 6.5/6.4/12.1: the finishing regeneration's outputs, derived
  // exactly as `xspec build` derives them — over the rewritten analyses.
  // The stored record's paths for the origin's generated files are no
  // longer generated and become orphans, so no stale output (14.10)
  // remains.
  const stored = await loadGraphData(workspace.root);
  const outputs = computeBuildOutputs(
    workspace.configuration,
    rewritten.specs,
    rewritten.graph,
    rewritten.textModel,
    rewritten.hashes,
    stored.data,
    // SPEC 13.3/6.5: the regenerated store records the rewritten workspace's
    // inputs — the post-move source set and bytes, and the journal as it
    // will stand after the append (the rewritten analysis models exactly
    // those bytes).
    workspaceInputsOf(workspace, rewritten),
  );

  // SPEC 14.22: validate the complete write set — rewritten sources (the
  // destination included), the journal, and every regenerated file — before
  // modifying anything.
  const writeFindings = await symlinkWritePathFindings(workspace.root, [
    ...plan.rewrites.map((rewrite) => rewrite.path),
    JOURNAL_PATH,
    ...outputs.writePaths,
  ]);
  if (writeFindings.length > 0) {
    return emitFindingsRefusal(invocation.json, stdout, writeFindings);
  }

  // All validation passed — modify: write the rewritten sources (atomic per
  // file, SPEC 13.5; the moved content lands at the destination), remove
  // the origin (SPEC 6.5: the file is relocated), append the mapping to the
  // journal (SPEC 6.1, 6.5), and regenerate derived files exactly as
  // `xspec build` does (SPEC 6.5, 6.4).
  for (const rewrite of plan.rewrites) {
    await writeSourceFile(workspace.root, rewrite.path, rewrite.content);
  }
  await removeSourceFile(workspace.root, originPath);
  await appendJournalEntry(workspace.root, plan.entry);
  await executeBuildOutputs(workspace.root, outputs);

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
  const currentJournal = await readJournalBytes(workspace.root);
  const entryLine = encoder.encode(serializeJournalEntry(plan.entry) + "\n");
  const journalBytes = concatBytes(
    currentJournal === null ? [entryLine] : [currentJournal, entryLine],
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

  // A `<new-id>` that is not valid UTF-8 cannot be written into a source
  // file faithfully (argv bytes that do not decode are irrecoverable; see
  // cli/args.ts): it can never be a valid requirement ID (SPEC 1.6, 1.4),
  // refused under its reason's stable code (SPEC 14).
  if (!isValidUtf8ArgumentValue(newId)) {
    return emitFindingsRefusal(invocation.json, stdout, [
      {
        code: "refused-invalid-id",
        message:
          `invalid new ID: the new ID is not valid UTF-8 — requirement ` +
          `IDs are decoded UTF-8 content (SPEC 1.6, 1.4); pass a valid ` +
          `UTF-8 ID (SPEC 6.5, 14)`,
        locations: [],
        path: null,
        identities: [`${targetPath}#${newId}`],
      },
    ]);
  }

  // SPEC 6.5/14: evaluate every applicable refusal reason together over
  // the valid workspace — the mirrored identity checks, the target
  // parent, destination occupancy and validity, would-be cycles, and
  // unresolvable rewritten references, one finding per reason — and
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
    specs: analysis.specs,
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
    return emitFindingsRefusal(invocation.json, stdout, refusals);
  }
  const createGroups: readonly string[] | null =
    targetSpec === null ? assessment.specGroups : null;

  // The pure plan: the identity mapping, the journal entry, the exact text
  // edits, and every reference and import rewrite (SPEC 6.5, 6.1).
  const plan = planMoveSection(
    analysis.specs,
    analysis.code,
    originPath,
    oldId,
    targetPath,
    newId,
  );

  // Re-validate the rewritten workspace in memory before touching anything
  // (SPEC 6.5: all rewritten references resolve, structural rules hold, and
  // no import or dependency cycle arises — 2.1, 5.3 — so the finishing
  // regeneration cannot fail). The journal is modeled as it will stand
  // after the append (SPEC 5.4).
  const rewritten = await reanalyzeSectionMoved(
    workspace,
    analysis,
    plan,
    targetPath,
    createGroups,
  );
  if (rewritten.configurationErrors.length > 0) {
    // Unreachable: the configuration is untouched and a created target was
    // validated against the same group rules discovery applies. Guarded so
    // a regression reports rather than corrupts.
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      workspace.configAnchor,
      rewritten.configurationErrors,
    );
    return 2;
  }
  if (rewritten.findings.length > 0) {
    // Unreachable: the refusal evaluation above (core/refusal.ts) realizes
    // every reason a move can be refused for — would-be cycles and
    // unresolvable rewritten references included — so a validated plan
    // leaves a valid workspace. Guarded so a regression refuses (exit 1,
    // nothing modified) rather than corrupts.
    return emitFindingsRefusal(invocation.json, stdout, rewritten.findings);
  }

  // SPEC 6.5/6.4/12.1: the finishing regeneration's outputs, derived
  // exactly as `xspec build` derives them — over the rewritten analyses.
  const stored = await loadGraphData(workspace.root);
  const outputs = computeBuildOutputs(
    workspace.configuration,
    rewritten.specs,
    rewritten.graph,
    rewritten.textModel,
    rewritten.hashes,
    stored.data,
    // SPEC 13.3/6.5: the regenerated store records the rewritten workspace's
    // inputs — the post-move source set and bytes, and the journal as it
    // will stand after the append (the rewritten analysis models exactly
    // those bytes).
    workspaceInputsOf(workspace, rewritten),
  );

  // SPEC 14.22: validate the complete write set — rewritten sources (a
  // created target included), the journal, and every regenerated file —
  // before modifying anything.
  const writeFindings = await symlinkWritePathFindings(workspace.root, [
    ...plan.rewrites.map((rewrite) => rewrite.path),
    JOURNAL_PATH,
    ...outputs.writePaths,
  ]);
  if (writeFindings.length > 0) {
    return emitFindingsRefusal(invocation.json, stdout, writeFindings);
  }

  // All validation passed — modify: write the rewritten sources (atomic per
  // file, SPEC 13.5; the origin keeps its path, the target gains the moved
  // text), append the mapping to the journal (SPEC 6.1, 6.5), and
  // regenerate derived files exactly as `xspec build` does (SPEC 6.5, 6.4).
  for (const rewrite of plan.rewrites) {
    await writeSourceFile(workspace.root, rewrite.path, rewrite.content);
  }
  await appendJournalEntry(workspace.root, plan.entry);
  await executeBuildOutputs(workspace.root, outputs);

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
  const currentJournal = await readJournalBytes(workspace.root);
  const entryLine = encoder.encode(serializeJournalEntry(plan.entry) + "\n");
  const journalBytes = concatBytes(
    currentJournal === null ? [entryLine] : [currentJournal, entryLine],
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

/** The `move` command handler (SPEC 6.5). */
export async function moveCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const [originArg, destinationArg] = invocation.positionals;
  if (originArg === undefined || destinationArg === undefined) {
    // Unreachable: the parser enforces the two positionals (SPEC 6.5).
    throw new Error("xspec internal error: move without its arguments");
  }
  // SPEC 13.5: workspace exclusivity around the whole operation, with the
  // `--test-hold` seam immediately after acquisition; a workspace held by
  // another mutating command fails promptly as a usage error (12.0),
  // modifying nothing.
  const outcome = await withMutationExclusivity(
    context.workspace.root,
    testHoldSpecOf(invocation, context.cwd),
    () => runMove(invocation, context, originArg, destinationArg),
  );
  if (!outcome.ok) {
    return usageError(invocation, context, outcome.usageMessage);
  }
  return outcome.value;
}
