// SPEC 12.0's invocation grammar as the harness reads a product's argv
// (TEST-SPEC H-2, H-5). Harness machinery only: no product imports. Flag
// tokens stand anywhere; a value-taking flag takes the whole next token, its
// arity fixed by its name, the same for every command; `--` ends flag
// reading; the first non-flag tokens left are the command word and, for
// `review`, its subcommand. Shared by the subprocess driver (helpers/
// subprocess.ts: T12.7-1's walk over the captured stdout of every invocation
// with JSON output in effect), P-8's JSON-output contract
// (test/suite/registry/section-16-p8.ts), and T6.5-22(a)'s reading of a
// performed move (helpers/added-import-identifiers.ts). The self-test
// test/self/p8-fixed-seed-draws.test.ts pins {@link jsonOutputInEffect}.

import { Buffer, isUtf8 } from "node:buffer";
import type { ArgvValue } from "./subprocess.js";

/**
 * The flags that take a value, by name: SPEC 12.0 fixes a flag's arity by
 * its name, the same for every command, and every other `--` token takes
 * none.
 */
// prettier-ignore
export const VALUE_FLAGS: ReadonlySet<string> = new Set([
  "base", "config", "coverage", "file", "from", "group", "kinds", "name",
  "note", "status", "strategy", "tag", "test-hold", "to",
]);

/**
 * The JSON-only surfaces of SPEC 12.0 (10.7, 11, 12.6) — a single JSON
 * document their only output form, with or without `--json` — by command
 * word: the five query surfaces of 11 (`query`, `occurrences`, `view`, `at`,
 * `inventory`) and `version` (12.6). `review export` (10.7) is the one
 * JSON-only subcommand form ({@link JSON_ONLY_REVIEW_SUBCOMMANDS}).
 */
const JSON_ONLY_COMMANDS: ReadonlySet<string> = new Set([
  "query",
  "occurrences",
  "view",
  "at",
  "inventory",
  "version",
]);

/** `review`'s JSON-only subcommands (SPEC 10.7: `export`). */
const JSON_ONLY_REVIEW_SUBCOMMANDS: ReadonlySet<string> = new Set(["export"]);

/**
 * One argv element as the product reads it: a string as spelled; a byte
 * element (`ArgvValue` as `Uint8Array`, raw-byte staging) as the string its
 * bytes spell when they are valid UTF-8, and otherwise as a token no flag
 * name or command word matches (`undefined`).
 */
function tokenOf(element: ArgvValue): string | undefined {
  if (typeof element === "string") return element;
  return isUtf8(element) ? Buffer.from(element).toString("utf8") : undefined;
}

/**
 * Whether JSON output is in effect for an invocation, read as SPEC 12.0
 * reads it: a `--json` token read as a flag — not another flag's value
 * (`VALUE_FLAGS`, arity fixed by name), not after the `--` that ends flag
 * reading — or a JSON-only surface, named by the first non-flag tokens once
 * flags, their values, and `--` are removed: the command word and, for
 * `review`, its subcommand (12.0's invocation grammar).
 */
export function jsonOutputInEffect(argv: readonly ArgvValue[]): boolean {
  const words: (string | undefined)[] = [];
  let flagsEnded = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = tokenOf(argv[index] as ArgvValue);
    if (!flagsEnded && token !== undefined && token.startsWith("--")) {
      if (token === "--") {
        flagsEnded = true;
      } else if (token === "--json") {
        return true;
      } else if (VALUE_FLAGS.has(token.slice(2))) {
        index += 1;
      }
      continue;
    }
    words.push(token);
  }
  const [command, subcommand] = words;
  if (command === undefined) return false;
  if (JSON_ONLY_COMMANDS.has(command)) return true;
  return (
    command === "review" &&
    subcommand !== undefined &&
    JSON_ONLY_REVIEW_SUBCOMMANDS.has(subcommand)
  );
}
