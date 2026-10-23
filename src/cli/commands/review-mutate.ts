// The mutating `xspec review` subcommands beyond `create`: `split` and
// `resolve` (SPEC 10.7). Both modify the session's durable file (SPEC 13.4,
// 13.5), so both run under workspace mutual exclusion with the `--test-hold`
// seam, exactly like `create`, `rename`, and `move`: acquired once the
// sources are discovered — a discovery-level configuration error or refused
// read reported first, exit 2 — and before every later check and read,
// which consult the sources a second discovery, made holding exclusivity,
// fixes — its configuration error or refused read reported there, exit 2
// (SPEC 13.5, 12.0; ./mutation.ts).
//
// Outcome precedence, per subcommand (SPEC 10.7: each step reached only
// once every earlier one has passed; the shared steps through
// review-session.ts's `loadSessionForCommand` — session existence, the gate
// of 13.3, the session read with the corrupt check, the item ID, and the
// recorded baseline's resolution — the refresh write handed back
// uncommitted):
//
// `split <name> <item-id>`:
//   1. unknown session (SPEC 10.7 → 12.0, exit 2), the gate's findings
//      (SPEC 13.3, exit 1), corrupt session (14.21, exit 1) — the session
//      name's form being the parser's, a syntax-class usage error reported
//      before the configuration is loaded (SPEC 10.1, 12.0);
//   2. an unknown item id is a usage error (SPEC 10.7 → 12.0, exit 2), met
//      before the recorded baseline, so it starts no git process (SPEC's
//      preamble);
//   3. the recorded baseline that cannot be resolved or reconstructed
//      (SPEC 6.3 → 12.0, exit 2);
//   4. `split` on an item of any other kind than `subtree-coherence`, or on
//      one whose scope root has no children in the current workspace (in a
//      baseline session, deleted ones included), is refused — exit 1,
//      nothing modified (SPEC 10.7);
//   5. otherwise the decomposition of SPEC 10.7 applies
//      (core/review-derive.ts `splitItemDecomposition`), the write path is
//      validated (SPEC 14.22, exit 1), and only then come the writes: the
//      refresh of 13.3, then the session file, once, last (SPEC 10.7,
//      13.5).
//
// `resolve <name> <item-id> --status <status> [--note <text>]`:
//   1.–3. as above (the parser already rejects any `--status` value outside
//      `updated`, `no-change`, `skipped` — SPEC 10.7 → 12.0);
//   4. resolving a blocked item is refused — exit 1, nothing modified —
//      over the effective statuses of SPEC 10.4 against the current
//      workspace, so an invalidated blocker re-blocks its dependents
//      (SPEC 10.3);
//   5. otherwise the status and note are set, the item is assigned its
//      current context set as `context` — the set reads present — and the
//      current relevant state is recorded over its scope, that context,
//      and its origin (SPEC 10.4; `resolve` applies to any unblocked item
//      regardless of current status), an `updated` resolve re-derives the
//      session (SPEC 10.5, every strategy), the write path is validated
//      (SPEC 14.22, exit 1), and only then come the writes: the refresh of
//      13.3, then the session file, once, last (SPEC 10.7, 13.5).
//
// Every outcome before the writes ends the subcommand modifying nothing:
// stale graph data stays stale (SPEC 10.7, 13.5).

import type { SourceClassification } from "../../core/discovery.js";
import type { ExitCode } from "../../core/findings.js";
import type { ResolveStatus } from "../../core/review.js";
import { sessionFilePath } from "../../core/review.js";
import type { CurrentDerivationSide } from "../../core/review-derive.js";
import {
  resolveSessionItem,
  splitItemDecomposition,
} from "../../core/review-derive.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import { writeSession } from "../../workspace/reviews.js";
import { obstructedWritePathFindings } from "../../workspace/writes.js";
import type { Invocation } from "../args.js";
import { flagValue } from "../args.js";
import type { CommandContext } from "../io.js";
import { emitFindingsReport } from "../report.js";
import { emitDocument } from "./common.js";
import { runMutatingCommand } from "./mutation.js";
import type { SessionGenerationRun } from "./review-session.js";
import {
  buildSessionReadView,
  emitReviewRefusal,
  loadSessionForCommand,
  runSessionGenerators,
} from "./review-session.js";

/**
 * The current derivation side over the analysis and a generation run —
 * total for every stored item: a `code-impact` item in a strategy without
 * impact data reads an empty target set (review-session.ts
 * `generationStateInputs` makes reads total the same way).
 */
function currentSideOf(
  analysis: WorkspaceAnalysis,
  generation: SessionGenerationRun,
): CurrentDerivationSide {
  return {
    graph: analysis.graph,
    hashes: analysis.hashes,
    textModel: analysis.textModel,
    journal: analysis.journal.journal,
    impactTargets:
      generation.impactTargets ?? new Map<string, readonly string[]>(),
  };
}

/**
 * SPEC 14.22: validate the session file's write path — a
 * workspace-relative directory component occupied by anything other than a
 * directory refuses the write, reported before modifying anything — then
 * make the subcommand's writes (SPEC 10.7, 13.3, 13.5): the refresh of
 * 13.3 (`commitRefresh`, a no-op when graph data is not stale), then the
 * session file, once, last. Returns null on success. A write the
 * environment refuses stops the command there (14.24), leaving the writes
 * already made.
 */
async function writeSessionChecked(
  invocation: Invocation,
  context: CommandContext,
  name: string,
  session: Parameters<typeof writeSession>[2],
  commitRefresh: () => Promise<void>,
): Promise<ExitCode | null> {
  const findings = await obstructedWritePathFindings(context.workspace.root, [
    sessionFilePath(name),
  ]);
  if (findings.length > 0) {
    emitFindingsReport(invocation.json, context.stdout, findings);
    return 1;
  }
  await commitRefresh();
  await writeSession(context.workspace.root, name, session);
  return null;
}

// ---------------------------------------------------------------------------
// `review split` (SPEC 10.7)
// ---------------------------------------------------------------------------

/**
 * The `split` operation, run under workspace exclusivity (SPEC 13.5) over
 * the classification its second discovery made holding it (./mutation.ts).
 */
async function runSplit(
  invocation: Invocation,
  context: CommandContext,
  name: string,
  itemId: string,
  discovered: SourceClassification,
): Promise<ExitCode> {
  // The loader meets the outcomes up to the recorded baseline — the item ID
  // among them, before any git read — and hands back the refresh write
  // uncommitted (review-session.ts).
  const loaded = await loadSessionForCommand(name, invocation, context, {
    itemId,
    discovered,
  });
  if (!loaded.ok) {
    return loaded.exit;
  }
  // The stored session's references are canonical identities (core/review.ts
  // identity policy) — consumed as-is; no read-time identity rewrite exists.
  const journal = loaded.analysis.journal.journal;
  const session = loaded.session;
  const original = loaded.item;
  if (original === undefined) {
    // Unreachable: the loader judged the item ID (SPEC 10.7, 12.0).
    throw new Error("xspec internal error: review split without its item");
  }
  // SPEC 10.7: the decomposition items' content is the strategy's to define
  // — its generators, run with the recorded creation parameters, supply the
  // decomposition content source.
  const generation = runSessionGenerators(
    session.parameters,
    loaded.analysis,
    loaded.baseline,
  );
  const split = splitItemDecomposition({
    session,
    original,
    contentSource: generation.contentSource,
    current: currentSideOf(loaded.analysis, generation),
    baseline: generation.baseline,
  });
  if (!split.ok) {
    // SPEC 10.7/14: the refusal — one code-less finding, exit 1, nothing
    // modified: the refresh write has not run, so stale graph data stays
    // stale; the scope root's children were judged against the current
    // workspace (and the recorded baseline), never stale graph data. The
    // identities name the session and item (informational).
    return emitReviewRefusal(invocation.json, context.stdout, split.refusal, [
      name,
      itemId,
    ]);
  }
  // The write re-records the journal's entry count as the session's
  // write-moment bound (core/review.ts identity policy: every stored
  // canonical position stays <= journalLength).
  const failed = await writeSessionChecked(
    invocation,
    context,
    name,
    { ...split.session, journalLength: journal.entries.length },
    loaded.commitRefresh,
  );
  if (failed !== null) {
    return failed;
  }
  if (invocation.json) {
    // SPEC 12.0: one JSON document as the entire standard output.
    emitDocument(context.stdout, {
      split: { item: itemId, items: [...split.itemIds], session: name },
    });
  } else {
    context.stdout.write(
      `split item '${itemId}' of session '${name}' into: ` +
        `${split.itemIds.join(", ")}\n`,
    );
  }
  return 0;
}

/** The `review split <name> <item-id>` handler (SPEC 10.7). */
export async function reviewSplitCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const [name, itemId] = invocation.positionals;
  if (name === undefined || itemId === undefined) {
    // Unreachable: the parser enforces the positionals (SPEC 10.7).
    throw new Error("xspec internal error: review split without its arguments");
  }
  // SPEC 13.5: discovery, then workspace exclusivity around every later
  // check and read, with the `--test-hold` seam immediately after
  // acquisition; a held workspace fails promptly as a usage error,
  // modifying nothing (./mutation.ts).
  return runMutatingCommand(invocation, context, true, (discovered) =>
    runSplit(invocation, context, name, itemId, discovered),
  );
}

// ---------------------------------------------------------------------------
// `review resolve` (SPEC 10.7)
// ---------------------------------------------------------------------------

/**
 * The `resolve` operation, run under workspace exclusivity (SPEC 13.5)
 * over the classification its second discovery made holding it
 * (./mutation.ts).
 */
async function runResolve(
  invocation: Invocation,
  context: CommandContext,
  name: string,
  itemId: string,
  status: ResolveStatus,
  note: string | undefined,
  discovered: SourceClassification,
): Promise<ExitCode> {
  // The loader meets the outcomes up to the recorded baseline — the item ID
  // among them, before any git read — and hands back the refresh write
  // uncommitted (review-session.ts).
  const loaded = await loadSessionForCommand(name, invocation, context, {
    itemId,
    discovered,
  });
  if (!loaded.ok) {
    return loaded.exit;
  }
  const item = loaded.item;
  if (item === undefined) {
    // Unreachable: the loader judged the item ID (SPEC 10.7, 12.0).
    throw new Error("xspec internal error: review resolve without its item");
  }
  const generation = runSessionGenerators(
    loaded.session.parameters,
    loaded.analysis,
    loaded.baseline,
  );
  // The read-time view (SPEC 10.4): forward-mapped identities, effective
  // statuses, and blocked states — the blocked refusal is judged over the
  // effective statuses, so a blocker whose resolution went stale re-blocks
  // its dependents (SPEC 10.3).
  const view = buildSessionReadView(
    name,
    loaded.session,
    generation,
    loaded.analysis,
  );
  if (view.blocked.get(item.id) ?? false) {
    // SPEC 10.7/14: resolving a blocked item is refused — one code-less
    // finding, exit 1, nothing modified: the refresh write has not run, so
    // stale graph data stays stale; the blocked state was judged against
    // the current workspace, never stale graph data (SPEC 13.3). Any
    // *unblocked* item is resolvable regardless of status.
    return emitReviewRefusal(
      invocation.json,
      context.stdout,
      `item '${itemId}' of session '${name}' is blocked — an item is ` +
        `blocked while any item in its blockedBy is not resolved, and ` +
        `resolving a blocked item is refused (SPEC 10.3, 10.7)`,
      [name, itemId],
    );
  }
  // SPEC 10.7/10.4: set the status and note, assign the item its current
  // context set — computed over view.expanded, as the read view computes
  // it — and record the current relevant state over it; an `updated`
  // resolve re-derives the session with the recorded creation parameters
  // and decompositions against the current workspace (SPEC 10.5 —
  // view.expanded is exactly that decomposition-expanded run).
  const session = resolveSessionItem({
    session: view.session,
    itemId,
    status,
    note,
    expanded: view.expanded,
    current: currentSideOf(loaded.analysis, generation),
    baseline: generation.baseline,
  });
  // The write re-records the journal's entry count as the session's
  // write-moment bound (core/review.ts identity policy).
  const failed = await writeSessionChecked(
    invocation,
    context,
    name,
    {
      ...session,
      journalLength: loaded.analysis.journal.journal.entries.length,
    },
    loaded.commitRefresh,
  );
  if (failed !== null) {
    return failed;
  }
  if (invocation.json) {
    // SPEC 12.0: one JSON document as the entire standard output.
    emitDocument(context.stdout, {
      resolved: { item: itemId, session: name, status },
    });
  } else {
    context.stdout.write(
      `resolved item '${itemId}' of session '${name}' as ${status}\n`,
    );
  }
  return 0;
}

/** The `review resolve <name> <item-id> --status <status> [--note <text>]`
 * handler (SPEC 10.7). */
export async function reviewResolveCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const [name, itemId] = invocation.positionals;
  if (name === undefined || itemId === undefined) {
    // Unreachable: the parser enforces the positionals (SPEC 10.7).
    throw new Error(
      "xspec internal error: review resolve without its arguments",
    );
  }
  // SPEC 10.7 → 12.0: the parser enforces the required `--status` flag and
  // rejects any value outside `updated`, `no-change`, `skipped`.
  const status = flagValue(invocation, "--status");
  if (status === undefined) {
    throw new Error("xspec internal error: review resolve without --status");
  }
  const note = flagValue(invocation, "--note");
  // SPEC 13.5: discovery, then workspace exclusivity around every later
  // check and read, with the `--test-hold` seam immediately after
  // acquisition (./mutation.ts).
  return runMutatingCommand(invocation, context, true, (discovered) =>
    runResolve(
      invocation,
      context,
      name,
      itemId,
      status as ResolveStatus,
      note,
      discovered,
    ),
  );
}
