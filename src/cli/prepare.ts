// The CLI face of refresh-on-read (SPEC 13.3): one shared entry the
// graph-data-consuming command handlers (`ids`, `show`, `coverage`,
// `impact`, every `review` subcommand, `query`) call before answering.
//
// It runs the workspace-layer pre-answer step (workspace/refresh.ts) and
// renders its failures once, identically for every command (SPEC 12.0):
//
// - validation findings — a failed refresh reports the validation errors
//   like a failed `build` (SPEC 13.3): the findings report on standard
//   output (with `--json`, the single JSON document), exit 1, nothing
//   answered, nothing modified;
// - configuration errors (SPEC 14.14) — usage class: diagnostics on
//   standard error, exit 2, and with JSON output in effect the 12.7 error
//   document as the entire standard output (12.0).
//
// `check` must not use this: it never refreshes (SPEC 13.3, 14.10).

import type { ExitCode } from "../core/findings.js";
import type { GraphData } from "../core/graph-data.js";
import {
  analyzeWorkspaceForAvailability,
  prepareWorkspaceForAvailability,
} from "../workspace/availability.js";
import type { WorkspaceAnalysis } from "../workspace/pipeline.js";
import {
  analyzeWorkspaceForRead,
  assessWorkspaceRead,
} from "../workspace/refresh.js";
import type { Invocation } from "./args.js";
import { jsonOutputInEffect } from "./args.js";
import type { CommandContext } from "./io.js";
import { emitConfigurationErrors, emitFindingsReport } from "./report.js";

/** The prepared graph a command answers from, or the already-emitted exit. */
export type ReadPreparation =
  | {
      readonly ok: true;
      /** The analyzed current workspace (graph, text model, hashes, journal). */
      readonly analysis: WorkspaceAnalysis;
      /** The stored graph data — current snapshot, retained record. */
      readonly graphData: GraphData;
    }
  | {
      /** The failure is fully reported already; return `exit` as is. */
      readonly ok: false;
      readonly exit: ExitCode;
    };

/** The analyzed workspace a gated read's argument checks judge from. */
export type ReadAnalysisPreparation =
  | { readonly ok: true; readonly analysis: WorkspaceAnalysis }
  | { readonly ok: false; readonly exit: ExitCode };

/**
 * The analysis half of the SPEC 13.3 pre-answer step — a pure read,
 * nothing modified, failing only with configuration-error precedence
 * (SPEC 14.14, 12.0: a configuration error precedes every argument check
 * that consults configuration, discovery, or the workspace). Gated reads
 * whose argument checks consult discovery or the named files' parses
 * (`show`'s and `query`'s identity operands, SPEC 12.0) run those checks
 * against the returned analysis, then — the invocation valid — call
 * `finishGraphForRead`: the checks precede the invalid-workspace report of
 * 13.3, and a failing invocation writes nothing.
 */
export async function analyzeGraphForRead(
  invocation: Invocation,
  context: CommandContext,
): Promise<ReadAnalysisPreparation> {
  const analyzed = await analyzeWorkspaceForRead(context.workspace);
  if (analyzed.kind === "configuration") {
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      context.workspace.configAnchor,
      analyzed.errors,
    );
    return { ok: false, exit: 2 };
  }
  return { ok: true, analysis: analyzed.analysis };
}

/**
 * The gate-and-refresh half of the SPEC 13.3 pre-answer step, over an
 * analysis from `analyzeGraphForRead`: on a workspace failing `build`'s
 * validations, the findings report on standard output with exit 1 and
 * nothing modified; on a passing one the refresh write, then the ready
 * analysis to answer from.
 */
export async function finishGraphForRead(
  invocation: Invocation,
  context: CommandContext,
  analysis: WorkspaceAnalysis,
): Promise<ReadPreparation> {
  const assessed = await assessWorkspaceRead(context.workspace, analysis);
  if (assessed.kind === "findings") {
    emitFindingsReport(invocation.json, context.stdout, assessed.findings);
    return { ok: false, exit: 1 };
  }
  await assessed.commit();
  return { ok: true, analysis, graphData: assessed.graphData };
}

/**
 * SPEC 13.3: refresh-on-read, then answer. Runs the shared pre-answer step
 * and either hands back the fresh analysis or emits the failure — findings
 * report on standard output with exit 1, or configuration diagnostics on
 * standard error with exit 2 (SPEC 12.0) — leaving the caller to return
 * the exit code unchanged. The composition of `analyzeGraphForRead` and
 * `finishGraphForRead` for commands whose argument checks consult nothing
 * past the loaded configuration.
 */
export async function prepareGraphForRead(
  invocation: Invocation,
  context: CommandContext,
): Promise<ReadPreparation> {
  const analyzed = await analyzeGraphForRead(invocation, context);
  if (!analyzed.ok) {
    return analyzed;
  }
  return finishGraphForRead(invocation, context, analyzed.analysis);
}

/** The analysis an availability surface answers from, or the emitted exit. */
export type AvailabilityAnalysis =
  | {
      readonly ok: true;
      /** The analyzed current workspace — the SPEC 11.2 answer's source. */
      readonly analysis: WorkspaceAnalysis;
    }
  | {
      /** The failure is fully reported already; return `exit` as is. */
      readonly ok: false;
      readonly exit: ExitCode;
    };

/**
 * The SPEC 11.2 pre-answer step of `occurrences`, `view`, and `at`
 * (workspace/availability.ts), with its one failure rendered here:
 * configuration errors keep their exit-2 precedence (SPEC 14.14, 12.0) —
 * diagnostics on standard error and, these surfaces being JSON-only
 * (SPEC 11), the 12.7 error document as the entire standard output. A
 * failing workspace is not a failure of this step: the surface answers
 * from the analysis, its findings selected by consulted domain
 * (core/availability.ts).
 */
export async function prepareAnalysisForAvailability(
  invocation: Invocation,
  context: CommandContext,
): Promise<AvailabilityAnalysis> {
  const prepared = await prepareWorkspaceForAvailability(context.workspace);
  if (prepared.kind === "configuration") {
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      context.workspace.configAnchor,
      prepared.errors,
    );
    return { ok: false, exit: 2 };
  }
  return { ok: true, analysis: prepared.analysis };
}

/**
 * The analysis half of the SPEC 11.2 pre-answer step alone — a pure read,
 * configuration errors rendered exactly as `prepareAnalysisForAvailability`
 * renders them (SPEC 14.14, 12.0). For surfaces whose argument checks
 * consult discovery (`view`'s operand membership, SPEC 11.4): the caller
 * runs those checks against the returned analysis, then — the invocation
 * valid — performs the SPEC 13.3 refresh participation
 * (workspace/availability.ts `finishAvailabilityRefresh`) before
 * answering, so a failing invocation writes nothing.
 */
export async function analyzeAnalysisForAvailability(
  invocation: Invocation,
  context: CommandContext,
): Promise<AvailabilityAnalysis> {
  const prepared = await analyzeWorkspaceForAvailability(context.workspace);
  if (prepared.kind === "configuration") {
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      context.workspace.configAnchor,
      prepared.errors,
    );
    return { ok: false, exit: 2 };
  }
  return { ok: true, analysis: prepared.analysis };
}
