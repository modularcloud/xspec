// `xspec build` (SPEC 12.1).
//
// Parses configured sources; validates section structure, IDs, tags, and
// references; resolves dependencies; generates TypeScript modules (13.1);
// optionally emits Markdown (13.2); and writes graph data (13.3). `build`
// does not evaluate policy: policy violations are `check` findings (7.5,
// 14.12), and build succeeds and regenerates output whether or not policy is
// satisfied — the pipeline collects no policy findings. Rebuilding
// regenerates every derived file and removes recorded derived files that the
// current sources and configuration no longer generate (13.3, 13.4). A build
// that fails — validation errors (exit 1, findings on standard output) or a
// configuration error (exit 2, diagnostics on standard error) — modifies
// nothing: every write happens strictly after all validation, including the
// SPEC 14.22 pre-write check over the complete write set, judged beside the
// source and journal findings (workspace/build-validation.ts).

import type { BuildOutputs } from "../../core/build.js";
import { computeBuildOutputs } from "../../core/build.js";
import type { ExitCode } from "../../core/findings.js";
import { executeBuildOutputs } from "../../workspace/build.js";
import { buildValidationFindings } from "../../workspace/build-validation.js";
import {
  readDerivedFileRecord,
  recordedPathsOf,
} from "../../workspace/graph-data.js";
import {
  analyzeWorkspace,
  workspaceInputsOf,
} from "../../workspace/pipeline.js";
import type { Invocation } from "../args.js";
import { jsonOutputInEffect } from "../args.js";
import type { CommandContext } from "../io.js";
import { emitConfigurationErrors, emitFindingsReport } from "../report.js";

/** The `build` command handler (SPEC 12.1). */
export async function buildCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const { workspace } = context;
  const analysis = await analyzeWorkspace(workspace);

  // SPEC 14.14/12.0: a discovery-level configuration error (a file matched
  // by both a spec and a code group, 7.2) is a usage error preceding all
  // source analysis — exit 2, diagnostics on standard error, nothing
  // modified, and with JSON output in effect the 12.7 error document as
  // the entire standard output.
  if (analysis.configurationErrors.length > 0) {
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      workspace.configAnchor,
      analysis.configurationErrors,
    );
    return 2;
  }

  // SPEC 12.1, 13.3, 14: the validations of `build` — source validation
  // errors, journal errors (14.13), and refused writes (14.22) alike, each
  // condition reported beside the others. The 14.22 examination runs over
  // the write paths discovery and configuration define (13.1, 7.3, 13.3),
  // so a refused write reports beside the source and journal findings,
  // not only on an otherwise valid workspace: a workspace-relative
  // directory component of a path xspec writes occupied by anything other
  // than a directory refuses the write, reported before anything is
  // modified — one finding per distinct offending component.
  const findings = await buildValidationFindings(workspace, analysis);
  if (findings.length > 0) {
    // SPEC 12.1/12.0: a failing build's validation errors are the report —
    // standard-output content, exit 1 — and the build modifies nothing.
    emitFindingsReport(invocation.json, context.stdout, findings);
    return 1;
  }

  // Valid workspace: derive the complete output set (core) — its write
  // paths exactly the set just examined (core/build.ts).
  // SPEC 12.1/13.4: the stored record's paths are the orphan-removal
  // domain — none where the record is absent or unreadable.
  const record = await readDerivedFileRecord(workspace.root);
  const outputs: BuildOutputs = computeBuildOutputs(
    workspace.configuration,
    analysis.specs,
    analysis.graph,
    analysis.textModel,
    analysis.hashes,
    recordedPathsOf(record),
    workspaceInputsOf(workspace, analysis),
  );
  await executeBuildOutputs(workspace.root, outputs);
  if (invocation.json) {
    // SPEC 12.0: every command supports `--json`, emitting a single JSON
    // document — a successful build's report is its (empty) findings list.
    emitFindingsReport(true, context.stdout, []);
  }
  return 0;
}
