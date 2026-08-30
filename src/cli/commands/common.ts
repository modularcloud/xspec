// Shared helpers of the graph-reading command handlers (`query`, `show`,
// `ids`, and later graph consumers — SPEC 11, 12.3, 12.4).
//
// IMPLEMENTATION (Architecture): the cli layer owns rendering and the
// exit-code taxonomy; these helpers keep every command's usage-error
// reporting and JSON emission identical. The one node-report document of
// `query node` and `show --json` (SPEC 12.4) lives in ./query-core.ts.

import * as path from "node:path";
import type { JsonObject, JsonValue } from "../../core/canonical-json.js";
import { canonicalJson } from "../../core/canonical-json.js";
import type { ByteRange } from "../../core/bytes.js";
import type { TestHoldSpec } from "../../workspace/lock.js";
import type { Invocation } from "../args.js";
import { flagValue, jsonOutputInEffect } from "../args.js";
import type { CliWriter, CommandIo } from "../io.js";
import { emitErrorDocument, usageErrorFinding } from "../report.js";

/**
 * SPEC 12.0: usage errors — unknown identities, unknown groups, invalid
 * flag values — exit 2 with the diagnostic on standard error. With JSON
 * output in effect (`--json` among the arguments, or a JSON-only surface),
 * the 12.7 error document — `{"error": …}` holding one code-less,
 * path-less finding form — is the entire standard output; without it,
 * standard output stays empty. Diagnostics echo argv tokens and static
 * text only, keeping output byte-deterministic (SPEC 12.0).
 */
export function usageError(
  invocation: Invocation,
  io: CommandIo,
  message: string,
): 2 {
  io.stderr.write(`xspec: ${invocation.command}: ${message}\n`);
  if (jsonOutputInEffect(invocation)) {
    emitErrorDocument(
      io.stdout,
      usageErrorFinding(`${invocation.command}: ${message}`),
    );
  }
  return 2;
}

/** SPEC 12.0: emit the single JSON document — the entire standard output. */
export function emitDocument(stdout: CliWriter, document: JsonValue): 0 {
  stdout.write(canonicalJson(document));
  return 0;
}

/**
 * The invocation's `--test-hold <path>` value as the workspace layer's hold
 * spec, or undefined when the flag was not given. SPEC 12.0/13.5: the value
 * is a filesystem path resolved against the working directory; the verbatim
 * token is kept for diagnostics (argv tokens only — never resolved paths).
 */
export function testHoldSpecOf(
  invocation: Invocation,
  cwd: string,
): TestHoldSpec | undefined {
  const given = flagValue(invocation, "--test-hold");
  if (given === undefined) {
    return undefined;
  }
  return { given, absolutePath: path.resolve(cwd, given) };
}

/** A source range (SPEC 1.7) as JSON data. */
export function rangeJson(range: ByteRange): JsonObject {
  return { start: range.start, end: range.end };
}
