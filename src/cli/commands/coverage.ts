// `xspec coverage` (SPEC 8.2): coverage reports over the configured
// profiles.
//
// `coverage` runs all profiles; `coverage <name>` runs one — an unknown
// profile named in arguments is a usage error, exit 2 (SPEC 12.0), checked
// against the configuration before source analysis like the configuration
// errors of 14.14 (the pattern of `query nodes --group`). The answer comes
// from the refreshed graph (SPEC 13.3, via cli/prepare.ts).
//
// The report carries, per profile: counts of required, covered, uncovered,
// and ignored nodes; the identity of every covered, uncovered, and ignored
// node; one shortest covering path per covered node (SPEC 12.0 byte tie
// rule); and each ignored node's exclusion reasons — all that apply, in the
// fixed SPEC 8.2 order. With `--check`, the command exits 1 if any required
// node is uncovered — a findings outcome (SPEC 12.0) whose report is still
// the standard-output content; the information never changes with the flag.
// `--json` emits the same information as the single JSON document.
//
// Both output forms are streamed (SPEC 8.2, 12.0): the report holds one
// covering path per covered node, so a long dependency chain's report is
// quadratic in the chain's length — hundreds of megabytes at a few thousand
// links, past V8's cap on one string's length (2^29 − 24 code units) soon
// after. The JSON document renders in bounded chunks, each covered row
// built only as the serializer reaches it (`emitDocumentStreamed`,
// `JsonDeferredArray`), and the human report is written row by row
// (`emitTextStreamed`); either way the bytes are exactly the whole
// document's or report's, and peak memory follows the coverage result,
// never its rendering.

import type { JsonStreamObject } from "../../core/canonical-json.js";
import { JsonDeferredArray } from "../../core/canonical-json.js";
import type { CoverageProfile } from "../../core/config.js";
import type { ProfileCoverage } from "../../core/coverage.js";
import { evaluateCoverageProfile } from "../../core/coverage.js";
import type { ExitCode } from "../../core/findings.js";
import type { Invocation } from "../args.js";
import { flagPresent } from "../args.js";
import type { CommandContext } from "../io.js";
import { analyzeGraphForRead, finishGraphForRead } from "../prepare.js";
import {
  emitDocumentStreamed,
  emitTextStreamed,
  usageError,
} from "./common.js";

/**
 * One profile's report as JSON data (SPEC 8.2: the same information), its
 * covered rows — each with its covering path — produced one at a time as
 * the emission reaches them (module header).
 */
function profileJson(result: ProfileCoverage): JsonStreamObject {
  const covered = result.covered;
  return {
    name: result.name,
    // SPEC 8.2: counts of required, covered, uncovered, and ignored nodes.
    counts: {
      required: result.requiredCount,
      covered: covered.length,
      uncovered: result.uncovered.length,
      ignored: result.ignored.length,
    },
    covered: new JsonDeferredArray(covered.length, (index) => {
      const row = covered[index];
      return { identity: row.identity, path: row.path };
    }),
    uncovered: result.uncovered,
    ignored: result.ignored.map((row) => ({
      identity: row.identity,
      reasons: row.reasons,
    })),
  };
}

/**
 * The human report (SPEC 8.2, 12.0: the same information as the JSON form):
 * per profile the counts, every covered node with its covering path, every
 * uncovered identity, and every ignored identity with its reasons in the
 * fixed order. Byte-deterministic: graph content and static text only.
 * Produced piece by piece — a profile's heading lines, then one piece per
 * node row — for the streamed emission (module header).
 */
function* coverageHumanPieces(
  results: readonly ProfileCoverage[],
): Generator<string, void, undefined> {
  for (const result of results) {
    yield `profile ${result.name}\n` +
      `  required: ${String(result.requiredCount)}, ` +
      `covered: ${String(result.covered.length)}, ` +
      `uncovered: ${String(result.uncovered.length)}, ` +
      `ignored: ${String(result.ignored.length)}\n` +
      `  covered:\n`;
    for (const row of result.covered) {
      yield `    ${row.identity}\n      path: ${row.path.join(" -> ")}\n`;
    }
    yield `  uncovered:\n`;
    for (const identity of result.uncovered) {
      yield `    ${identity}\n`;
    }
    yield `  ignored:\n`;
    for (const row of result.ignored) {
      yield `    ${row.identity}: ${row.reasons.join("; ")}\n`;
    }
  }
}

/** The `coverage` command handler (SPEC 8.2). */
export async function coverageCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const { stdout, stderr } = context;
  const { configuration } = context.workspace;

  // SPEC 12.0: the configuration search and the discovery of 7 precede
  // every error consulting them — a configuration error, a discovery-level
  // one included (14.14), and a discovery read the environment refuses
  // (14.25, thrown from the walk) are each met before the profile name is
  // judged against the configuration.
  const analyzed = await analyzeGraphForRead(invocation, context);
  if (!analyzed.ok) {
    return analyzed.exit;
  }

  // SPEC 8.2/12.0: `coverage <name>` runs one profile; an unknown profile
  // name is a usage error — an argument check, judged against the
  // configuration, so it precedes the invalid-workspace report of 13.3.
  let profiles: readonly CoverageProfile[] = configuration.coverage;
  if (invocation.positionals.length > 0) {
    const name = invocation.positionals[0];
    const named = configuration.coverage.find(
      (candidate) => candidate.name === name,
    );
    if (named === undefined) {
      return usageError(
        invocation,
        context,
        `unknown profile '${name}' — no configured coverage profile has ` +
          `that name (SPEC 8.2, 7.4, 12.0)`,
      );
    }
    profiles = [named];
  }

  // SPEC 13.3: the gate and refresh-on-read, then answer.
  const prepared = await finishGraphForRead(
    invocation,
    context,
    analyzed.analysis,
  );
  if (!prepared.ok) {
    return prepared.exit;
  }
  const { analysis } = prepared;

  const results = profiles.map((profile) =>
    evaluateCoverageProfile(analysis.graph, configuration, profile),
  );

  if (invocation.json) {
    await emitDocumentStreamed(stdout, { profiles: results.map(profileJson) });
  } else {
    await emitTextStreamed(stdout, coverageHumanPieces(results));
  }

  // SPEC 8.2: with `--check`, exit 1 if any required node is uncovered —
  // over exactly the profiles this invocation ran. Without it, coverage is
  // informational: exit 0 (SPEC 12.0).
  if (
    flagPresent(invocation, "--check") &&
    results.some((result) => result.uncovered.length > 0)
  ) {
    return 1;
  }
  return 0;
}
