// The entry sequence of the mutating commands (SPEC 13.5, 12.0, 14.14,
// 14.25): `rename` and `move` — their `--preview` invocations included,
// which acquire nothing (6.6) — and the mutating `review` subcommands
// (`create`, `resolve`, `split`).
//
// SPEC 13.5: "A mutating command acquires exclusivity once its
// configuration is loaded and its sources discovered (7, 14.14) and before
// every later check and read — the argument checks of 12.0, baseline
// resolution (6.3), the gate and refresh of 13.3, and its own validation —
// so the workspace it validates is the one it rewrites". The configuration
// is loaded before any handler runs (cli/main.ts). Here the sources are
// discovered: a listing or kind read the environment refuses stops the
// command at that read with its read failure (14.25, thrown from the walk
// and rendered by cli/main.ts), and a discovery-level configuration error
// (7.2 → 14.14: a file matched by both a spec and a code group) is
// reported as the exit-2 configuration error — SPEC 12.0: a configuration
// error precedes every other error of exit class 2, the exclusivity and
// hold-file errors of 13.5 included. Neither waits on the `--test-hold`
// seam nor yields to another holder's exclusion error. Only then is
// exclusivity acquired, with the seam immediately after acquisition
// (workspace/lock.ts), and the operation runs over the classification
// made here: every later read — source content, the journal, sessions,
// the baseline, the gate and refresh — follows acquisition.

import type { SourceClassification } from "../../core/discovery.js";
import type { ExitCode } from "../../core/findings.js";
import { withMutationExclusivity } from "../../workspace/lock.js";
import {
  discoverWorkspace,
  discoveryConfigurationErrors,
} from "../../workspace/pipeline.js";
import type { Invocation } from "../args.js";
import { jsonOutputInEffect } from "../args.js";
import type { CommandContext } from "../io.js";
import { emitConfigurationErrors } from "../report.js";
import { testHoldSpecOf, usageError } from "./common.js";

/**
 * Run a mutating command's operation (module header): discover the
 * sources, report a discovery-level configuration error (exit 2), then —
 * when `exclusive` — acquire workspace exclusivity, failing promptly with
 * the usage error while another mutating command holds it (SPEC 13.5,
 * 12.0), and run `operation` over the classification. A `--preview`
 * passes `exclusive` false: it acquires nothing and takes no seam
 * (SPEC 6.6), in the same order otherwise.
 */
export async function runMutatingCommand(
  invocation: Invocation,
  context: CommandContext,
  exclusive: boolean,
  operation: (discovered: SourceClassification) => Promise<ExitCode>,
): Promise<ExitCode> {
  const discovered = await discoverWorkspace(context.workspace);
  const configurationErrors = discoveryConfigurationErrors(discovered);
  if (configurationErrors.length > 0) {
    emitConfigurationErrors(
      context,
      jsonOutputInEffect(invocation),
      context.workspace.configAnchor,
      configurationErrors,
    );
    return 2;
  }
  if (!exclusive) {
    return operation(discovered);
  }
  const outcome = await withMutationExclusivity(
    context.workspace.root,
    testHoldSpecOf(invocation, context.cwd),
    () => operation(discovered),
  );
  if (!outcome.ok) {
    return usageError(invocation, context, outcome.usageMessage);
  }
  return outcome.value;
}
