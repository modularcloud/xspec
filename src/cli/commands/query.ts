// `xspec query` (SPEC 11): set-level, JSON-only access to the graph — the
// full read path.
//
// A single JSON document is `query`'s only output form, with or without
// `--json` (SPEC 11, 12.0) — including the findings report of a failed
// refresh (SPEC 13.3), which is standard-output content like a failed
// `build`'s. The six subcommands' validation, ordering, and rendering live
// in ./query-core.ts, shared byte for byte with the store-backed fast path
// (./query-fast.ts): this handler is the SPEC 13.3 refresh-on-read side —
// it runs when no verified store can answer (cli/main.ts tries the fast
// path first), prepares the refreshed analysis, and answers through the
// analysis-backed view (./analysis-view.ts).
//
// SPEC 12.0: the argument checks precede the invalid-workspace report of
// 13.3 — the configuration-level flag checks of `query nodes`
// (query-core.ts), then the `<node>`/`<graph-node>` identity checks,
// judged parse-local against the named file (./gated-args.ts) — so a
// usage-error argument exits 2 whatever findings the workspace carries,
// while configuration errors keep their precedence over every check
// (SPEC 14.14, surfaced by the analysis step).

import type { ExitCode } from "../../core/findings.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import type { Invocation } from "../args.js";
import { flagValue } from "../args.js";
import type { CommandContext } from "../io.js";
import { analyzeGraphForRead, finishGraphForRead } from "../prepare.js";
import { analysisQueryView } from "./analysis-view.js";
import { usageError } from "./common.js";
import { graphNodeValueProblem, nodeOperandProblem } from "./gated-args.js";
import { answerQuery, prevalidateQuery } from "./query-core.js";
import { groupsViewOfConfiguration } from "./query-groups.js";

/**
 * The subcommand's identity-argument checks (SPEC 12.0), parse-local per
 * ./gated-args.ts: the `<node>` positional of `node`/`subtree`/`ancestors`,
 * the `<graph-node>` values of `edges`/`reachable` — `--from` then `--to`,
 * the order the graph-based answering checks them in (query-core.ts).
 * Returns the usage-error diagnostic, or null.
 */
function queryIdentityProblem(
  invocation: Invocation,
  analysis: WorkspaceAnalysis,
): string | null {
  switch (invocation.command) {
    case "query node":
    case "query subtree":
    case "query ancestors":
      return nodeOperandProblem(analysis, invocation.positionals[0]);
    case "query edges":
    case "query reachable": {
      for (const flag of ["--from", "--to"] as const) {
        const raw = flagValue(invocation, flag);
        if (raw === undefined) {
          continue;
        }
        const problem = graphNodeValueProblem(analysis, flag, raw);
        if (problem !== null) {
          return problem;
        }
      }
      return null;
    }
    default:
      return null;
  }
}

/** The `query` command handler — all six subcommands (SPEC 11). */
export async function queryCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const { stdout, stderr } = context;
  const groups = groupsViewOfConfiguration(context.workspace.configuration);

  // SPEC 11: a single JSON document is `query`'s only output form, with or
  // without `--json` — the findings report of a failed refresh included, so
  // the prepare steps run with JSON output forced on.
  const forced = { ...invocation, json: true };

  // SPEC 14.14/12.0: the analysis surfaces configuration errors first —
  // they precede every argument check that consults configuration,
  // discovery, or the workspace.
  const analyzed = await analyzeGraphForRead(forced, context);
  if (!analyzed.ok) {
    return analyzed.exit;
  }

  // SPEC 11: the configuration-level flag validation of `query nodes`
  // (query-core.ts), then the identity checks — every argument check
  // precedes the invalid-workspace report of 13.3 (SPEC 12.0).
  const prevalidated = prevalidateQuery(invocation, groups, context);
  if (!prevalidated.ok) {
    return prevalidated.exit;
  }
  const problem = queryIdentityProblem(invocation, analyzed.analysis);
  if (problem !== null) {
    return usageError(invocation, context, problem);
  }

  // SPEC 13.3: the gate report, then refresh-on-read, then answer.
  const prepared = await finishGraphForRead(forced, context, analyzed.analysis);
  if (!prepared.ok) {
    return prepared.exit;
  }
  return answerQuery(
    invocation,
    analysisQueryView(prepared.analysis),
    groups,
    stdout,
    stderr,
  );
}
