// `xspec occurrences [--file <glob>] [--to <node>]` (SPEC 11.3).
//
// Enumerates reference occurrences (SPEC 5.7) in occurrence order, one
// record per occurrence carrying every datum of 5.7 — the source graph node
// per SPEC 11.2 where its source node's identity is undefined. JSON-only
// (SPEC 11): a single JSON document — the 12.7 `{"findings",
// "occurrences"}` form — is its only output form, with or without `--json`.
//
// `--file` admits the discovered source files — spec and code alike — that
// the glob matches (the rules of SPEC 7): a set restriction, not an
// existence assertion — the consulted domain (SPEC 11.2) is the discovered
// files it admits, a glob admitting none admits the empty set (an empty,
// finding-free answer, exit 0), and no unknown-file usage error exists on
// this filter. A pattern resolving outside the workspace root is an invalid
// flag value, exit 2 (SPEC 11.3, 11.1, 12.0). Without `--file` the domain
// is the entire discovered set.
//
// `--to` selects the occurrences whose resolved target it names: acceptance
// is syntactic (SPEC 11.3) — only a malformed spelling is a usage error,
// and an unknown or unresolving identity selects nothing (the SPEC 12.0
// exit-class exception). The two filters combine conjunctively.
//
// The argument checks precede answering (SPEC 11.2, 12.0): each exits 2
// whatever findings the workspace carries, before any source is analyzed.
// The answer's findings are the consulted domain's (SPEC 11.2), its exit 1
// exactly when any finding or explicitly-unavailable datum is carried, the
// full document emitted either way; refresh participation and the
// no-write/no-consult discipline of a failing workspace are the shared
// pre-answer step's (workspace/availability.ts via cli/prepare.ts).

import {
  accompanyingFindings,
  availabilityExit,
  discoveredDomain,
  nodeSpellingProblem,
  selectOccurrences,
} from "../../core/availability.js";
import { canonicalJson } from "../../core/canonical-json.js";
import type { JsonValue } from "../../core/canonical-json.js";
import type { ExitCode } from "../../core/findings.js";
import { orderFindings } from "../../core/findings.js";
import type { CompiledGlob } from "../../core/glob.js";
import { compileGlob } from "../../core/glob.js";
import type { Invocation } from "../args.js";
import { flagValue } from "../args.js";
import type { CommandContext } from "../io.js";
import { prepareAnalysisForAvailability } from "../prepare.js";
import { findingToJson, occurrenceRecordJson } from "../report.js";
import { usageError } from "./common.js";

/** The `occurrences` command handler (SPEC 11.3). */
export async function occurrencesCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  // --- argument checks (SPEC 11.2: they precede answering; 12.0) ----------
  let fileGlob: CompiledGlob | undefined;
  const filePattern = flagValue(invocation, "--file");
  if (filePattern !== undefined) {
    const compiled = compileGlob(filePattern, "plain");
    if (!compiled.ok) {
      // Plain mode has one compile error: a pattern resolving outside the
      // workspace root — an invalid flag value, as in SPEC 11.1 (SPEC 7).
      return usageError(
        invocation,
        context,
        `invalid value '${filePattern}' for '--file' — the pattern ` +
          `resolves outside the workspace root (SPEC 11.3, 11.1, 7, 12.0)`,
      );
    }
    fileGlob = compiled.glob;
  }

  const to = flagValue(invocation, "--to");
  if (to !== undefined) {
    // SPEC 11.3: acceptance is syntactic — only a malformed requirement-
    // node identity spelling is a usage error.
    const problem = nodeSpellingProblem(to);
    if (problem !== null) {
      return usageError(
        invocation,
        context,
        `invalid value '${to}' for '--to' — not a well-formed ` +
          `requirement-node identity: ${problem} (SPEC 11.3, 1.4, 1.5, 12.0)`,
      );
    }
  }

  // --- the SPEC 11.2 pre-answer step --------------------------------------
  const prepared = await prepareAnalysisForAvailability(invocation, context);
  if (!prepared.ok) {
    return prepared.exit;
  }
  const { analysis } = prepared;

  // --- the answer (SPEC 11.3, 11.2) ---------------------------------------
  const domain = discoveredDomain(analysis.classification, fileGlob);
  const findings = orderFindings(
    accompanyingFindings(analysis.findings, domain),
  );
  const records = selectOccurrences(analysis.graph, domain, to);

  const document: JsonValue = {
    findings: findings.map(findingToJson),
    occurrences: records.map(occurrenceRecordJson),
  };
  context.stdout.write(canonicalJson(document));
  // SPEC 11.2: any finding or explicitly-unavailable datum → exit 1 with
  // the full document emitted; complete and finding-free → exit 0.
  return availabilityExit(
    findings,
    records.some((record) => record.source === null),
  );
}
