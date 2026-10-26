// Shared helpers of the graph-reading command handlers (`query`, `show`,
// `ids`, and later graph consumers — SPEC 11, 12.3, 12.4).
//
// IMPLEMENTATION (Architecture): the cli layer owns rendering and the
// exit-code taxonomy; these helpers keep every command's usage-error
// reporting and JSON emission identical. The one node-report document of
// `query node` and `show --json` (SPEC 12.4) lives in ./query-core.ts.

import * as path from "node:path";
import type {
  JsonObject,
  JsonStreamValue,
  JsonValue,
} from "../../core/canonical-json.js";
import {
  canonicalJson,
  canonicalJsonChunks,
} from "../../core/canonical-json.js";
import type { ByteRange } from "../../core/bytes.js";
import type { CompiledGlob } from "../../core/glob.js";
import { compileGlob } from "../../core/glob.js";
import type { BaselineFailure } from "../../workspace/baseline.js";
import type { TestHoldSpec } from "../../workspace/lock.js";
import type { Invocation } from "../args.js";
import { flagValue, jsonOutputInEffect } from "../args.js";
import type { CliWriter, CommandIo } from "../io.js";
import {
  emitCodedRefusal,
  emitErrorDocument,
  usageErrorFinding,
} from "../report.js";

/**
 * SPEC 12.0: usage errors — unknown identities, unknown groups, invalid
 * flag values — exit 2 with the diagnostic on standard error. With JSON
 * output in effect (a `--json` read as a flag, or a JSON-only surface),
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

/**
 * SPEC 6.3 → 12.0, 12.7: report a baseline's failed resolution, exit 2 —
 * a journal error in the current journal as the coded usage error carrying
 * condition 13's stable code and concerned path (the diagnostic on
 * standard error and, with JSON output in effect, the error document,
 * `emitCodedRefusal`), every other failure as a plain usage error, `code`
 * and `path` null, its message prefixed by `subject` where the caller
 * names what failed (a session's recorded baseline).
 */
export function reportBaselineFailure(
  invocation: Invocation,
  io: CommandIo,
  failure: BaselineFailure,
  subject = "",
): 2 {
  if (failure.kind === "journal-error") {
    emitCodedRefusal(io, jsonOutputInEffect(invocation), failure.finding);
    return 2;
  }
  return usageError(invocation, io, `${subject}${failure.message}`);
}

/** SPEC 12.0: emit the single JSON document — the entire standard output. */
export function emitDocument(stdout: CliWriter, document: JsonValue): 0 {
  stdout.write(canonicalJson(document));
  return 0;
}

/**
 * SPEC 12.0: emit the single JSON document — the entire standard output,
 * byte for byte `emitDocument`'s — in bounded chunks
 * (`canonicalJsonChunks`), each written once the stream has taken the one
 * before, so a document whose deferred arrays are produced as it renders
 * (`JsonDeferredArray`) never exists whole, in memory or as one string
 * (SPEC 10.7: `review export` presents every item of a session, an answer
 * that can outgrow both). A chunk the stream fails to take ends the
 * emission there, the failure left to the stream's own error report.
 */
export async function emitDocumentStreamed(
  stdout: CliWriter,
  document: JsonStreamValue,
): Promise<0> {
  for (const chunk of canonicalJsonChunks(document)) {
    const failed = await new Promise<boolean>((resolve) => {
      stdout.write(chunk, (error) => {
        resolve(error !== undefined && error !== null);
      });
    });
    if (failed) break;
  }
  return 0;
}

/**
 * The invocation's `--test-hold <path>` value as the workspace layer's hold
 * spec, or undefined when the flag was not given. SPEC 12.0/13.5: the value
 * is a filesystem path resolved against the working directory; the verbatim
 * token is kept for diagnostics (argv tokens only — never resolved paths).
 * Against a working directory with no path (`cwd` null, cli/bin.ts) only an
 * absolute value designates a path: a relative one resolves against a
 * directory that holds nothing and leads nowhere, so the hold file cannot
 * be created there — 13.5's usage error, met where creation is attempted
 * (`absolutePath` null; workspace/lock.ts).
 */
export function testHoldSpecOf(
  invocation: Invocation,
  cwd: string | null,
): TestHoldSpec | undefined {
  const given = flagValue(invocation, "--test-hold");
  if (given === undefined) {
    return undefined;
  }
  if (path.isAbsolute(given)) {
    return { given, absolutePath: path.resolve(given) };
  }
  return {
    given,
    absolutePath: cwd === null ? null : path.resolve(cwd, given),
  };
}

/**
 * The invocation's `--file <glob>` value compiled under the glob rules of
 * SPEC 7 (plain mode), or undefined when the flag was not given (11.1,
 * 11.3, 11.4, 12.3). The parser has already refused a pattern outside the
 * workspace root — plain mode's one compile error — as a usage error of
 * 12.0's syntax class, decided by its spelling alone before the
 * configuration is loaded (cli/args.ts), so every value reaching a handler
 * compiles.
 */
export function compileFileFlag(
  invocation: Invocation,
): CompiledGlob | undefined {
  const pattern = flagValue(invocation, "--file");
  if (pattern === undefined) {
    return undefined;
  }
  const compiled = compileGlob(pattern, "plain");
  if (!compiled.ok) {
    // Unreachable: the parser refuses every outside-root `--file` value.
    throw new Error(
      `xspec internal error: '${invocation.command}' received a --file ` +
        `value the parser should have refused (${compiled.error.kind})`,
    );
  }
  return compiled.glob;
}

/** A source range (SPEC 1.7) as JSON data. */
export function rangeJson(range: ByteRange): JsonObject {
  return { start: range.start, end: range.end };
}
