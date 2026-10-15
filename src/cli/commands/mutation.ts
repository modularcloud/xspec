// The entry sequence of the mutating commands (SPEC 13.5, 12.0, 14.14,
// 14.25): `rename` and `move` — their `--preview` invocations included,
// which acquire nothing (6.6) — and the mutating `review` subcommands
// (`create`, `resolve`, `split`).
//
// SPEC 13.5: "A mutating command acquires exclusivity once its
// configuration is loaded and its sources discovered (7, 14.14) and before
// every later check and read — the argument checks of 12.0, baseline
// resolution (6.3), the gate and refresh of 13.3, and its own validation —
// and, holding it, discovers its sources again: that discovery fixes the
// sources every later check and read consults, a configuration error it
// meets reported there (14.14), so the workspace it validates and rewrites
// is the one current once it holds exclusivity". The configuration is
// loaded before any handler runs (cli/main.ts). The sequence here:
//
// 1. The first discovery, before acquisition: a listing or kind read the
//    environment refuses stops the command at that read with its read
//    failure (14.25, thrown from the walk and rendered by cli/main.ts),
//    and a discovery-level configuration error (7.2 → 14.14: a file
//    matched by both a spec and a code group) is reported as the exit-2
//    configuration error concerning the configuration file — SPEC 12.0: a
//    configuration error precedes every other error of exit class 2, the
//    acquisition and hold-file errors of 13.5 included. Neither waits on
//    the `--test-hold` seam nor yields to another holder's exclusion
//    error.
// 2. Acquisition in the workspace's lock directory `.xspec/lock`, with the
//    seam immediately after it (workspace/lock.ts) — acquisition's busy
//    refusal (14.26) and its read and write failures (14.25, 14.24) thrown
//    there and rendered by cli/main.ts, a hold file that cannot be created
//    the code-less usage error, release following every normal end.
// 3. Holding exclusivity, the seam lifted ("the hold-file seam below
//    engages at acquisition, before the second discovery"), the second
//    discovery: its refused listing or kind read is likewise the read
//    failure there (14.25), release following, and its discovery-level
//    configuration error the exit-2 configuration error — SPEC 12.0: "a
//    configuration error only the rediscovery of 13.5 meets follows the
//    acquisition and hold-file errors, preceding the rest". Otherwise the
//    operation runs over this second classification alone: every later
//    read — source content, the journal, sessions, the baseline, the gate
//    and refresh — and every argument check consults the sources current
//    once exclusivity is held, an earlier holder's relocations and
//    creations included.
//
// A `--preview` acquires nothing and takes no seam (SPEC 6.6): it discovers
// once, step 1, and runs the operation over that classification — the
// answer the real operation would give once holding exclusivity.

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
 * sources, reporting a discovery-level configuration error (exit 2); then
 * — when `exclusive` — acquire workspace exclusivity, failing promptly
 * while another mutating command holds it with the busy refusal of 14.26,
 * or with acquisition's read or write failure (14.25, 14.24), each thrown
 * at acquisition and rendered by cli/main.ts (exit 2; SPEC 13.5, 12.0);
 * holding it, discover the sources again (SPEC 13.5), its refused read
 * thrown and its configuration error reported likewise; and run
 * `operation` over that second classification, releasing on every normal
 * end. A `--preview` passes `exclusive` false: it acquires nothing, takes
 * no seam, and discovers once (SPEC 6.6), running `operation` over that
 * one classification.
 */
export async function runMutatingCommand(
  invocation: Invocation,
  context: CommandContext,
  exclusive: boolean,
  operation: (discovered: SourceClassification) => Promise<ExitCode>,
): Promise<ExitCode> {
  // SPEC 13.5: exclusivity is acquired once the sources are discovered —
  // this discovery's refused read (thrown from the walk, 14.25) and its
  // configuration error (14.14) precede acquisition and the seam.
  const discovered = await discoverWorkspace(context.workspace);
  if (reportConfigurationErrors(invocation, context, discovered)) {
    return 2;
  }
  if (!exclusive) {
    // SPEC 6.6: a preview acquires nothing, so it discovers once.
    return operation(discovered);
  }
  const outcome = await withMutationExclusivity(
    context.workspace.root,
    testHoldSpecOf(invocation, context.cwd),
    async () => {
      // SPEC 13.5: holding exclusivity, past the seam, the command
      // discovers its sources again, and that discovery fixes the sources
      // every later check and read consults. A refused listing or kind
      // read is thrown from the walk as the read failure there (14.25),
      // release following (workspace/lock.ts); a configuration error it
      // meets is reported there (14.14), after acquisition's and the hold
      // file's errors and before every other (SPEC 12.0).
      const rediscovered = await discoverWorkspace(context.workspace);
      if (reportConfigurationErrors(invocation, context, rediscovered)) {
        return 2;
      }
      return operation(rediscovered);
    },
  );
  if (!outcome.ok) {
    return usageError(invocation, context, outcome.usageMessage);
  }
  return outcome.value;
}

/**
 * Report a classification's discovery-level configuration errors (SPEC
 * 7.2 → 14.14: a file matched by both a spec and a code group) as the
 * exit-2 configuration error concerning the configuration file (SPEC 12.0,
 * 12.7; its anchoring spelling, as cli/main.ts reports the file's own
 * errors). True when there was one to report: the command then exits 2,
 * no source analyzed (SPEC 14).
 */
function reportConfigurationErrors(
  invocation: Invocation,
  context: CommandContext,
  classification: SourceClassification,
): boolean {
  const configurationErrors = discoveryConfigurationErrors(classification);
  if (configurationErrors.length === 0) {
    return false;
  }
  emitConfigurationErrors(
    context,
    jsonOutputInEffect(invocation),
    context.workspace.configAnchor,
    configurationErrors,
  );
  return true;
}
