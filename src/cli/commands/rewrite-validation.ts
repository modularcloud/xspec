// The would-succeed validation `rename` and `move` share with their
// `--preview` (SPEC 6.4, 6.5, 6.6).
//
// Past the refusal evaluation (core/refusal.ts) and the plan, the operation
// re-validates its rewritten workspace in memory — the journal modeled as
// it will stand after the append, since hashes take the journal as an input
// (SPEC 5.4) — and vets its complete write set against SPEC 14.22, before
// modifying anything. Both are internal-consistency guards: the refusal
// evaluation realizes every reason SPEC 14 gives, every rewritten reference
// resolves by construction (SPEC 6.4, 6.5), and the valid-workspace
// precondition and the destination checks vet every write path (SPEC 6.5,
// 14.22), so a correct plan trips neither. Whatever they refuse, the
// preview refuses alike — SPEC 6.6: "A preview is refused exactly when —
// reporting what, and exiting as — the real operation would be refused,
// and succeeds exactly when the real operation would proceed." So the real
// operation and its preview run this one validation, and a preview emits
// its successful report only past it; the preview still modifies nothing
// and takes no exclusivity (SPEC 6.6, 13.5).

import type { BuildOutputs } from "../../core/build.js";
import {
  computeBuildOutputs,
  discoveredSourcePaths,
} from "../../core/build.js";
import type { ExitCode, Finding } from "../../core/findings.js";
import { JOURNAL_PATH } from "../../core/journal.js";
import {
  readDerivedFileRecord,
  recordedPathsOf,
} from "../../workspace/graph-data.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import { workspaceInputsOf } from "../../workspace/pipeline.js";
import { obstructedWritePathFindings } from "../../workspace/writes.js";
import type { Invocation } from "../args.js";
import { jsonOutputInEffect } from "../args.js";
import type { CliWriter, CommandContext } from "../io.js";
import { emitConfigurationErrors, emitFindingsReport } from "../report.js";
import { emitRefusedPreview } from "./preview.js";

/**
 * SPEC 6.4/6.5/12.0/12.7: a refused rename or move is a validation failure
 * — exit 1, the findings report `{"findings": […]}` on standard output
 * (SPEC 12.0: reports are standard-output content; with `--json`, one JSON
 * document as the entire standard output). Workspace-precondition findings
 * and refusal-reason findings alike go through here — never mixed in one
 * report (SPEC 14). A refused `--preview` reports exactly the same
 * findings and exit, in the preview document form with `mapping`, `files`,
 * and `delta` null (SPEC 6.6, 12.7).
 */
export function emitFindingsRefusal(
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

/**
 * The verdict of the would-succeed validation: refused — already
 * reported, with the exit code the invocation ends with — or proceeding,
 * with the finishing regeneration's outputs the real operation executes.
 */
export type RewrittenWorkspaceVerdict =
  | { readonly proceeds: false; readonly exit: ExitCode }
  | { readonly proceeds: true; readonly outputs: BuildOutputs };

/**
 * Validate an operation's rewritten workspace before anything is modified
 * (SPEC 6.4, 6.5), for the real operation and its preview alike (SPEC
 * 6.6). `rewritten` is the in-memory analysis of the workspace as the
 * operation would leave it, the journal as it will stand after the append;
 * `writtenPaths` are the workspace-relative paths the plan writes — the
 * rewritten sources, a relocated or created file included.
 */
export async function validateRewrittenWorkspace(
  invocation: Invocation,
  context: CommandContext,
  rewritten: WorkspaceAnalysis,
  writtenPaths: readonly string[],
  preview: boolean,
): Promise<RewrittenWorkspaceVerdict> {
  const { workspace, stdout } = context;
  if (rewritten.configurationErrors.length > 0) {
    // Unreachable: the configuration is untouched, and a relocated or
    // created file joins the source set under the group rules discovery
    // applies (SPEC 6.5, 7). Guarded so a regression reports rather than
    // corrupts — its preview reporting the same (SPEC 6.6).
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      workspace.configAnchor,
      rewritten.configurationErrors,
    );
    return { proceeds: false, exit: 2 };
  }
  if (rewritten.findings.length > 0) {
    // Unreachable for a correct plan: the refusal evaluation realizes
    // every reason an operation can be refused for, and every rewritten
    // reference resolves by construction (SPEC 6.4, 6.5), so a validated
    // plan leaves a valid workspace. Guarded so a regression refuses (exit
    // 1, nothing modified) rather than corrupts — and its preview refuses
    // with the same findings and exit (SPEC 6.6).
    return {
      proceeds: false,
      exit: emitFindingsRefusal(
        preview,
        invocation.json,
        stdout,
        rewritten.findings,
      ),
    };
  }

  // SPEC 6.4/6.5/12.1: the finishing regeneration's outputs, derived
  // exactly as `xspec build` derives them — over the rewritten analyses;
  // the regenerated store records the rewritten workspace's inputs, the
  // journal as it will stand after the append (SPEC 13.3). The stored
  // record supplies the orphan set alone (SPEC 13.3, 13.4), which no
  // validation reads: the write set is the generated files and graph data.
  // A preview consults the record for its delta only, past this validation
  // (SPEC 6.6: a refused preview consults no record), so it derives the
  // outputs over none. The discovered sources excluded from the orphan
  // set are the rewritten workspace's (SPEC 13.4: a source is never
  // derived).
  const recorded = preview
    ? []
    : recordedPathsOf(await readDerivedFileRecord(workspace.root));
  const outputs = computeBuildOutputs(
    workspace.configuration,
    rewritten.specs,
    rewritten.graph,
    rewritten.textModel,
    rewritten.hashes,
    recorded,
    discoveredSourcePaths(rewritten.classification),
    workspaceInputsOf(workspace, rewritten),
  );

  // SPEC 14.22: vet the complete write set — the rewritten sources, the
  // journal, and every regenerated file — before modifying anything.
  const writeFindings = await obstructedWritePathFindings(workspace.root, [
    ...writtenPaths,
    JOURNAL_PATH,
    ...outputs.writePaths,
  ]);
  if (writeFindings.length > 0) {
    return {
      proceeds: false,
      exit: emitFindingsRefusal(
        preview,
        invocation.json,
        stdout,
        writeFindings,
      ),
    };
  }
  return { proceeds: true, outputs };
}
