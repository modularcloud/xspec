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
// 1. Configuration errors (SPEC 14.14): usage class, exit 2, preceding all
//    source analysis — the configuration file's (cli/main.ts) and then
//    discovery's (a file matched by both a spec and a code group), met
//    with discovery's refused reads (14.25) before exclusivity is acquired
//    (SPEC 13.5, 12.0; ./mutation.ts).
// 2. Workspace exclusivity (SPEC 13.5): `rename` is a mutating command —
//    while another one runs, it fails promptly with a usage error (exit 2)
//    modifying nothing; with `--test-hold <path>`, the hold file is created
//    immediately after acquiring exclusivity and before modifying anything,
//    and the command proceeds only once it has been deleted. A preview
//    acquires nothing (SPEC 6.6).
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
//    guards on the would-succeed path (every rewritten reference resolves
//    by construction, SPEC 6.4, and the refusal evaluation above realizes
//    the user-facing contract); any finding refuses (exit 1) before
//    modifying anything. `--preview` runs these guards too and reports its
//    plan only past them, refused exactly when the real operation would be
//    (SPEC 6.6; ./rewrite-validation.ts).
//
// Success writes the rewritten sources, appends the journal entry, and
// regenerates; the report is the applied mapping — the complete identity
// mapping the operation journaled, the information of the preview's
// `mapping` (SPEC 6.4, 6.6) — with `--json`, the single JSON document
// (SPEC 12.0).

import type { SourceClassification } from "../../core/discovery.js";
import { orderSourceWrites } from "../../core/edits.js";
import type { ExitCode } from "../../core/findings.js";
import { serializeJournalEntry } from "../../core/journal.js";
import { evaluateRenameRefusals } from "../../core/refusal.js";
import type { RenamePlan } from "../../core/rename.js";
import { planRename } from "../../core/rename.js";
import { executeBuildOutputs } from "../../workspace/build.js";
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
import { performSourceWrites } from "../../workspace/writes.js";
import type { Invocation } from "../args.js";
import { flagPresent } from "../args.js";
import type { CommandContext } from "../io.js";
import { emitAppliedMappingReport } from "../report.js";
import { usageError } from "./common.js";
import { runMutatingCommand } from "./mutation.js";
import { emitSuccessfulPreview } from "./preview.js";
import {
  emitFindingsRefusal,
  validateRewrittenWorkspace,
} from "./rewrite-validation.js";

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
 * plan, takes no exclusivity, and modifies nothing. `discovered` is the
 * workspace's classification, made before acquisition, its configuration
 * errors already reported (SPEC 13.5, 14.14; ./mutation.ts): the analysis
 * here reads the sources' content and the journal.
 */
async function runRename(
  invocation: Invocation,
  context: CommandContext,
  file: string,
  oldId: string,
  newId: string,
  preview: boolean,
  discovered: SourceClassification,
): Promise<ExitCode> {
  const { workspace, stdout } = context;
  const analysis = await analyzeWorkspace(workspace, discovered);

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

  // Re-validate the rewritten workspace in memory and vet the complete
  // write set before touching anything (SPEC 6.4: structural rules remain
  // satisfied and all rewritten references resolve; the finishing
  // regeneration cannot fail). The journal is modeled as it will stand
  // after the append — hashes take the journal as an input (SPEC 5.4), so
  // the regenerated graph data matches a fresh build of the rewritten
  // workspace byte for byte (SPEC 6.4, 12.0). The preview runs the same
  // validation, refused exactly when the real operation would be (SPEC
  // 6.6; ./rewrite-validation.ts).
  const rewritten = await reanalyzeRewritten(workspace, analysis, plan);
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

  // All validation passed — modify: rewrite the sources (atomic per file,
  // in the preview's `files` order, SPEC 13.5), append the mapping to the
  // journal (SPEC 6.1, 6.4), and regenerate derived files exactly as
  // `xspec build` does (SPEC 6.4). A write the environment refuses stops
  // the operation there (SPEC 14.24, 13.5).
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
  // SPEC 6.4, 5.4: the journal as validated — the bytes this analysis
  // loaded (null for an absent journal, SPEC 6.1) — plus the new entry.
  // Validation passed, so it bore no 14.13 finding: an unreadable journal,
  // its content refused (SPEC 14.25) included, never reaches this point.
  const currentJournal = analysis.journal.rawBytes;
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
    runRename(invocation, context, file, oldId, newId, preview, discovered),
  );
}
