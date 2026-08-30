// `xspec rename <file> <old-id> <new-id>` (SPEC 6.4).
//
// Renames a requirement ID, rewrites descendant IDs by prefix replacement,
// rewrites every reference to the affected identities across all configured
// spec and code sources, appends the mapping to the journal (SPEC 6.1), and
// finishes by regenerating derived files exactly as `xspec build` does
// (SPEC 12.1) — which cannot fail, because rename only ever rewrites a
// valid workspace.
//
// Outcome precedence (SPEC 6.4, 12.0, 13.5, 14):
//
// 1. Workspace exclusivity (SPEC 13.5): `rename` is a mutating command —
//    while another one runs, it fails promptly with a usage error (exit 2)
//    modifying nothing; with `--test-hold <path>`, the hold file is created
//    immediately after acquiring exclusivity and before modifying anything,
//    and the command proceeds only once it has been deleted.
// 2. Configuration errors (SPEC 14.14): usage class, exit 2, preceding all
//    source analysis.
// 3. Argument existence (SPEC 6.4 → 12.0): a `<file>` that is not a
//    discovered spec source, or an old ID absent from the origin file, is a
//    usage error (exit 2) — checked before source validation, so it is
//    reported even when the sources also fail build validation. One
//    exception (SPEC 12.0, 14): an old ID inside an unparseable origin
//    file (14.20) is masked — the validation findings are reported and the
//    command exits 1.
// 4. Valid-workspace precondition (SPEC 6.4): when the current workspace
//    fails the validations of `xspec build`, the rename refuses (exit 1)
//    before modifying anything, reporting those findings alone — no
//    refusal reason evaluated or reported beside them (SPEC 14).
// 5. The refusal contract (SPEC 6.4, 14): every applicable refusal reason
//    is evaluated together over the valid workspace (core/refusal.ts) —
//    the new ID's intrinsic form, identity change, collisions, and the
//    structural parent rules — and a refused rename reports one finding
//    per reason, each with its stable code and concerned identity or
//    located bearer, as the 12.7 findings report (exit 1), modifying
//    nothing. `--preview` (SPEC 6.6) shares exactly this evaluation.
// 6. The rewritten workspace is re-validated in memory and the complete
//    write set passes the SPEC 14.22 symlink check — internal-consistency
//    guards on the would-succeed path (the refusal evaluation above
//    realizes "all rewritten references resolve" for the user-facing
//    contract); any finding refuses (exit 1) before modifying anything.
//
// Success writes the rewritten sources, appends the journal entry, and
// regenerates; the report is the applied mapping — the complete identity
// mapping the operation journaled, the information of the preview's
// `mapping` (SPEC 6.4, 6.6) — with `--json`, the single JSON document
// (SPEC 12.0).

import { computeBuildOutputs } from "../../core/build.js";
import type { ExitCode, Finding } from "../../core/findings.js";
import { JOURNAL_PATH, serializeJournalEntry } from "../../core/journal.js";
import { evaluateRenameRefusals } from "../../core/refusal.js";
import type { RenamePlan } from "../../core/rename.js";
import { planRename } from "../../core/rename.js";
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
  obstructedWritePathFindings,
  writeSourceFile,
} from "../../workspace/writes.js";
import type { Invocation } from "../args.js";
import { flagPresent, flagValue, jsonOutputInEffect } from "../args.js";
import type { CliWriter, CommandContext } from "../io.js";
import {
  emitAppliedMappingReport,
  emitConfigurationErrors,
  emitFindingsReport,
} from "../report.js";
import { testHoldSpecOf, usageError } from "./common.js";
import { emitRefusedPreview, emitSuccessfulPreview } from "./preview.js";

/**
 * SPEC 6.4/12.0/12.7: a refused rename is a validation failure — exit 1,
 * the findings report `{"findings": […]}` on standard output (SPEC 12.0:
 * reports are standard-output content; with `--json`, one JSON document as
 * the entire standard output). Workspace-precondition findings and
 * refusal-reason findings alike go through here — never mixed in one
 * report (SPEC 14). A refused `--preview` reports exactly the same
 * findings and exit, in the preview document form with `mapping`, `files`,
 * and `delta` null (SPEC 6.6, 12.7).
 */
function emitFindingsRefusal(
  preview: boolean,
  json: boolean,
  stdout: CliWriter,
  findings: readonly Finding[],
): ExitCode {
  if (preview) {
    return emitRefusedPreview(json, stdout, findings);
  }
  emitFindingsReport(json, stdout, findings);
  return 1;
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

/**
 * The rename operation — run under workspace exclusivity (SPEC 13.5), or
 * as its `--preview` (SPEC 6.6), which shares every validation and the
 * plan, takes no exclusivity, and modifies nothing.
 */
async function runRename(
  invocation: Invocation,
  context: CommandContext,
  file: string,
  oldId: string,
  newId: string,
  preview: boolean,
): Promise<ExitCode> {
  const { workspace, stdout, stderr } = context;
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

  // SPEC 6.4 → 12.0: the argument existence checks precede source
  // validation. `<file>` must name a discovered spec source
  // (workspace-relative, SPEC 12.0, 1.5; byte-wise comparison).
  if (!analysis.classification.specSources.some((s) => s.path === file)) {
    return usageError(
      invocation,
      context,
      `unknown file '${file}' — <file> must name a discovered source file ` +
        `of a configured spec group, workspace-relative (SPEC 6.4, 12.0)`,
    );
  }

  // SPEC 12.0/14: an old ID inside an unparseable origin file (14.20) is
  // masked — the origin was discovered but yielded no document, so the
  // validation findings are reported and the command exits 1.
  const origin = analysis.specs.find((s) => s.document.path === file);
  if (origin === undefined) {
    return emitFindingsRefusal(
      preview,
      invocation.json,
      stdout,
      analysis.findings,
    );
  }

  // SPEC 6.4 → 12.0: a nonexistent old ID is a usage error, checked before
  // source validation — parse-local, judged over spelled identities (11.2).
  if (!origin.document.sections.some((s) => s.id === oldId)) {
    return usageError(
      invocation,
      context,
      `unknown ID '${oldId}' in '${file}' — <old-id> must name an existing ` +
        `requirement ID of that file (SPEC 6.4, 12.0)`,
    );
  }

  // SPEC 6.4: refuse, before modifying anything, when the current workspace
  // fails the validations of `xspec build` — rename only ever rewrites a
  // valid workspace. The invalid-workspace refusal reports the workspace's
  // numbered findings alone: no refusal reason is evaluated or reported
  // beside them (SPEC 14).
  if (analysis.findings.length > 0) {
    return emitFindingsRefusal(
      preview,
      invocation.json,
      stdout,
      analysis.findings,
    );
  }

  // SPEC 6.4/14: evaluate every applicable refusal reason together over
  // the valid workspace — one finding per reason, never only the first
  // found, each with its stable code and concerned identity or located
  // bearer — and refuse (exit 1) with the 12.7 findings report, nothing
  // modified. `--preview` shares exactly this evaluation (SPEC 6.6).
  const refusals = evaluateRenameRefusals({ origin, oldId, newId });
  if (refusals.length > 0) {
    return emitFindingsRefusal(preview, invocation.json, stdout, refusals);
  }

  // The pure plan: the identity mapping, the journal entry, the minimal
  // in-place rewrites of every affected source, and the classed preview
  // edits — one plan for the real operation and its preview (SPEC 6.4,
  // 6.1, 6.6).
  const plan = planRename(analysis.specs, analysis.code, file, oldId, newId);

  // SPEC 6.6: a preview reports the plan and performs it on nothing — the
  // complete identity mapping the operation would journal (the journal
  // entry's canonical `from`-byte order), the per-file edits, and the
  // record-based derived-file delta (a rename regenerates every derived
  // path in place, so the post-operation generation set is the current
  // source set's).
  if (preview) {
    return emitSuccessfulPreview(
      invocation.json,
      stdout,
      workspace,
      plan.entry.mapping,
      plan.previewFiles,
      analysis.classification.specSources.map((source) => source.path),
    );
  }

  // Re-validate the rewritten workspace in memory before touching anything
  // (SPEC 6.4: structural rules remain satisfied and all rewritten
  // references resolve; the finishing regeneration cannot fail). The
  // journal is modeled as it will stand after the append — hashes take the
  // journal as an input (SPEC 5.4), so the regenerated graph data matches a
  // fresh build of the rewritten workspace byte for byte (SPEC 6.4, 12.0).
  const rewritten = await reanalyzeRewritten(workspace, analysis, plan);
  if (rewritten.configurationErrors.length > 0) {
    // Unreachable: the configuration and file set are unchanged. Guarded so
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
    // every reason a rename can be refused for, so a validated plan leaves
    // a valid workspace. Guarded so a regression refuses (exit 1, nothing
    // modified) rather than corrupts.
    return emitFindingsRefusal(
      false,
      invocation.json,
      stdout,
      rewritten.findings,
    );
  }

  // SPEC 6.4/12.1: the finishing regeneration's outputs, derived exactly as
  // `xspec build` derives them — over the rewritten analyses.
  const stored = await loadGraphData(workspace.root);
  const outputs = computeBuildOutputs(
    workspace.configuration,
    rewritten.specs,
    rewritten.graph,
    rewritten.textModel,
    rewritten.hashes,
    stored.data,
    // SPEC 13.3/6.4: the regenerated store records the rewritten workspace's
    // inputs — the rewritten source bytes and the journal as it will stand
    // after the append (reanalyzeRewritten models exactly those bytes).
    workspaceInputsOf(workspace, rewritten),
  );

  // SPEC 14.22: validate the complete write set — rewritten sources, the
  // journal, and every regenerated file — before modifying anything.
  const writeFindings = await obstructedWritePathFindings(workspace.root, [
    ...plan.rewrites.map((rewrite) => rewrite.path),
    JOURNAL_PATH,
    ...outputs.writePaths,
  ]);
  if (writeFindings.length > 0) {
    return emitFindingsRefusal(false, invocation.json, stdout, writeFindings);
  }

  // All validation passed — modify: rewrite the sources (atomic per file,
  // SPEC 13.5), append the mapping to the journal (SPEC 6.1, 6.4), and
  // regenerate derived files exactly as `xspec build` does (SPEC 6.4).
  for (const rewrite of plan.rewrites) {
    await writeSourceFile(workspace.root, rewrite.path, rewrite.content);
  }
  await appendJournalEntry(workspace.root, plan.entry);
  await executeBuildOutputs(workspace.root, outputs);

  // SPEC 6.4/12.0: a successful rename's report is the applied mapping —
  // the complete identity mapping the operation journaled, the information
  // of the preview's `mapping` (6.6), in both output forms. The journal
  // entry's mapping is that mapping in its canonical `from`-byte order.
  emitAppliedMappingReport(invocation.json, stdout, plan.entry.mapping);
  return 0;
}

/**
 * Analyze the rewritten workspace entirely in memory: the same classified
 * file set, sources served from the rewrite plan (unaffected ones from the
 * already-analyzed text), and the journal as it will stand after the append
 * (SPEC 6.4, 5.4).
 */
async function reanalyzeRewritten(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
  plan: RenamePlan,
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
  const currentJournal = await readJournalBytes(workspace.root);
  const entryLine = encoder.encode(serializeJournalEntry(plan.entry) + "\n");
  const journalBytes = concatBytes(
    currentJournal === null ? [entryLine] : [currentJournal, entryLine],
  );
  return analyzeWorkspaceContent(workspace.configuration, {
    classification: analysis.classification,
    readSource: (rel) => Promise.resolve(byPath.get(rel) ?? null),
    // A valid workspace discovers no invalid-path sources (SPEC 14.19
    // gates rename, 6.4), so this reanalysis is never asked for one.
    readInvalidSource: () => Promise.resolve(null),
    loadJournal: () => Promise.resolve(journalFromBytes(journalBytes)),
  });
}

/** The `rename` command handler (SPEC 6.4, 6.6). */
export async function renameCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const [file, oldId, newId] = invocation.positionals;
  if (file === undefined || oldId === undefined || newId === undefined) {
    // Unreachable: the parser enforces the three positionals (SPEC 6.4).
    throw new Error("xspec internal error: rename without its arguments");
  }
  // SPEC 6.6/13.5: a preview invocation is a non-mutating command — it
  // acquires no workspace exclusivity and does not take the
  // acquisition-tied test seam, so `--test-hold` together with `--preview`
  // is a usage error (exit 2), no hold file created, nothing modified.
  if (flagPresent(invocation, "--preview")) {
    if (flagValue(invocation, "--test-hold") !== undefined) {
      return usageError(
        invocation,
        context,
        `--test-hold cannot be combined with --preview: a preview acquires ` +
          `no workspace exclusivity and does not take the acquisition-tied ` +
          `test seam (SPEC 6.6, 13.5, 12.0)`,
      );
    }
    return runRename(invocation, context, file, oldId, newId, true);
  }
  // SPEC 13.5: workspace exclusivity around the whole operation, with the
  // `--test-hold` seam immediately after acquisition; a workspace held by
  // another mutating command fails promptly as a usage error (12.0),
  // modifying nothing.
  const outcome = await withMutationExclusivity(
    context.workspace.root,
    testHoldSpecOf(invocation, context.cwd),
    () => runRename(invocation, context, file, oldId, newId, false),
  );
  if (!outcome.ok) {
    return usageError(invocation, context, outcome.usageMessage);
  }
  return outcome.value;
}
