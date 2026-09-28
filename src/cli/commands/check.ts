// `xspec check` (SPEC 12.2).
//
// Performs all build validations without accepting stale outputs — the
// analysis always parses the current sources (workspace/pipeline.ts), never
// answering from graph data — and additionally verifies:
//
// - generated files are content-identical to what the current sources and
//   configuration generate, and no recorded derived file remains at a path
//   no longer generated (SPEC 14.10, `check`-only; workspace/check.ts);
// - all dependency and text references resolve and are static, all
//   TypeScript spec references resolve, and no dependency or spec import
//   cycles exist (SPEC 14.5–14.9 — collected by the shared analysis);
// - the journal is well-formed and replayable with no conflicting mappings
//   (SPEC 14.13 — likewise);
// - no policy violations exist (SPEC 7.5 → 14.12, `check`-only;
//   core/policy.ts) — evaluated on a workspace passing `build`'s
//   validations alone;
// - review sessions are not internally corrupt (SPEC 14.21, judged without
//   modifying anything; workspace/reviews.ts);
// - no write path a build would use has a workspace-relative directory
//   component occupied by anything other than a directory — reported
//   without writing (SPEC 14.22).
//
// `check` never refreshes (SPEC 13.3): it reports staleness instead of
// rewriting graph data, and it writes nothing whatsoever — every probe here
// is a read. Exits 1 on any finding; configuration validity is enforced at
// load by every command (SPEC 14.14) and is a usage error, not a finding.

import type { BuildOutputs } from "../../core/build.js";
import {
  computeBuildOutputs,
  discoveredGeneratedPaths,
  orphanedRecordedPaths,
} from "../../core/build.js";
import type { ExitCode, Finding } from "../../core/findings.js";
import { evaluatePolicy } from "../../core/policy.js";
import {
  mismatchStalenessFindings,
  recordStalenessFindings,
} from "../../workspace/check.js";
import {
  loadGraphData,
  readDerivedFileRecord,
  recordedPathsOf,
} from "../../workspace/graph-data.js";
import {
  analyzeWorkspace,
  workspaceInputsOf,
} from "../../workspace/pipeline.js";
import { loadAllSessions } from "../../workspace/reviews.js";
import { obstructedWritePathFindings } from "../../workspace/writes.js";
import type { Invocation } from "../args.js";
import { jsonOutputInEffect } from "../args.js";
import type { CommandContext } from "../io.js";
import { emitConfigurationErrors, emitFindingsReport } from "../report.js";

/** The `check` command handler (SPEC 12.2). */
export async function checkCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const { workspace } = context;
  const analysis = await analyzeWorkspace(workspace);

  // SPEC 14.14/12.0: a discovery-level configuration error is a usage error
  // preceding all source analysis — exit 2, diagnostics on standard error,
  // and with JSON output in effect the 12.7 error document on standard
  // output.
  if (analysis.configurationErrors.length > 0) {
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      workspace.configAnchor,
      analysis.configurationErrors,
    );
    return 2;
  }

  const findings: Finding[] = [...analysis.findings];

  // SPEC 14.10: the recorded-file form compares the record against the set
  // of generated paths alone — a set discovery and configuration define on
  // any workspace (13.1, 7.3, 11.6; core/build.ts) — so, like the
  // unreadable-record unit form, it is detectable whatever the sources'
  // validity: beside source validation errors, journal errors (14.13), and
  // refused writes (14.22) alike.
  const record = await readDerivedFileRecord(workspace.root);
  const orphans = orphanedRecordedPaths(
    recordedPathsOf(record),
    new Set(
      discoveredGeneratedPaths(
        workspace.configuration,
        analysis.classification,
      ),
    ),
  );

  // SPEC 13.3, 12.1: whether the workspace passes `build`'s validations —
  // no source validation finding, no journal error (both in
  // `analysis.findings`), and no refused write (14.22, judged below) — the
  // one state in which the content the current sources and configuration
  // generate (14.10) and the graph policy constrains (14.12) are defined.
  let passesBuildValidations = analysis.findings.length === 0;

  // SPEC 14.10/14.22 — judged against the pure build derivation
  // (core/build.ts), computed here only over a workspace whose sources and
  // journal pass build validation: with such findings present, "what the
  // current sources and configuration generate" is undefined and 14.10's
  // mismatch forms are undetectable (SPEC 14).
  if (passesBuildValidations) {
    const stored = await loadGraphData(workspace.root);
    const outputs: BuildOutputs = computeBuildOutputs(
      workspace.configuration,
      analysis.specs,
      analysis.graph,
      analysis.textModel,
      analysis.hashes,
      recordedPathsOf(record),
      workspaceInputsOf(workspace, analysis),
    );
    // SPEC 14.22: `check` reports the obstructed write-path components
    // without writing — the same findings a `build` would refuse on.
    const obstructions = await obstructedWritePathFindings(
      workspace.root,
      outputs.writePaths,
    );
    findings.push(...obstructions);
    // SPEC 14.10, 13.3: a refused write (14.22) fails `build`'s validations
    // like a source validation error or a journal error — the content the
    // current sources and configuration generate is undefined there, so
    // the mismatch forms, per file and graph data, go unreported (SPEC
    // 14).
    if (obstructions.length > 0) {
      passesBuildValidations = false;
    } else {
      findings.push(
        ...(await mismatchStalenessFindings(
          workspace.root,
          outputs,
          stored,
          record,
        )),
      );
    }
  }

  // SPEC 14.10: the forms consulting no generated content — the
  // unreadable-record unit form and the recorded-file form — are reported
  // whatever the sources' validity.
  findings.push(
    ...(await recordStalenessFindings(workspace.root, record, orphans)),
  );

  // SPEC 7.5 → 14.12 (`check`-only): the rules are evaluated only over a
  // workspace passing `build`'s validations, the one state in which the
  // graph they constrain is defined — on a failing workspace no violation
  // is detectable, and none is reported (SPEC 14).
  if (passesBuildValidations) {
    findings.push(...evaluatePolicy(workspace.configuration, analysis.graph));
  }

  // SPEC 14.21: review sessions are not internally corrupt — every session
  // is loaded read-only, in byte order of session name (SPEC 12.0), and
  // each corrupt one contributes its finding. Never modified (SPEC 13.4).
  for (const session of await loadAllSessions(workspace.root)) {
    if (session.state === "corrupt") {
      findings.push(session.finding);
    }
  }

  if (findings.length > 0) {
    // SPEC 12.2/12.0: exit 1 on any finding, the findings report on
    // standard output — with `--json`, the single JSON document.
    emitFindingsReport(invocation.json, context.stdout, findings);
    return 1;
  }
  if (invocation.json) {
    // SPEC 12.0: every command supports `--json`, emitting a single JSON
    // document — a clean check's report is its empty findings list.
    emitFindingsReport(true, context.stdout, []);
  }
  return 0;
}
