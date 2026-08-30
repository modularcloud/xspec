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
import { prepareWorkspaceForRead } from "../workspace/refresh.js";
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

/**
 * SPEC 13.3: refresh-on-read, then answer. Runs the shared pre-answer step
 * and either hands back the fresh analysis or emits the failure — findings
 * report on standard output with exit 1, or configuration diagnostics on
 * standard error with exit 2 (SPEC 12.0) — leaving the caller to return
 * the exit code unchanged.
 */
export async function prepareGraphForRead(
  invocation: Invocation,
  context: CommandContext,
): Promise<ReadPreparation> {
  const prepared = await prepareWorkspaceForRead(context.workspace);
  switch (prepared.kind) {
    case "configuration":
      emitConfigurationErrors(
        context,
        jsonOutputInEffect(invocation),
        context.workspace.configAnchor,
        prepared.errors,
      );
      return { ok: false, exit: 2 };
    case "findings":
      emitFindingsReport(invocation.json, context.stdout, prepared.findings);
      return { ok: false, exit: 1 };
    case "ready":
      return {
        ok: true,
        analysis: prepared.analysis,
        graphData: prepared.graphData,
      };
  }
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
