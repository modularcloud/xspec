// SPEC 12.0's invocation grammar as the harness reads a product's argv
// (TEST-SPEC H-2, H-5). Harness machinery only: no product imports. Flag
// tokens stand anywhere; a value-taking flag takes the whole next token, its
// arity fixed by its name, the same for every command; `--` ends flag
// reading; the first non-flag tokens left are the command word and, for
// `review`, its subcommand. Shared by the subprocess driver (helpers/
// subprocess.ts: T12.7-1's walk over the captured stdout of every invocation
// with JSON output in effect), P-8's JSON-output contract
// (test/suite/registry/section-16-p8.ts), T6.5-22(a)'s reading of a
// performed move (helpers/added-import-identifiers.ts), and H-6's
// classification of the harness's compares (helpers/acquiring-runs.ts:
// whether an invocation is a mutating command's, SPEC 13.5, and the
// `--config` path that places its workspace, SPEC 7). The self-test
// test/self/p8-fixed-seed-draws.test.ts pins {@link jsonOutputInEffect};
// test/self/lock-path-exclusion.test.ts pins {@link invocationAcquires} and
// {@link configPathArgument}.

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
 * An argv read as SPEC 12.0's grammar reads it: the flags read as flags,
 * each by name with its value (`true` for a flag taking none) at its first
 * occurrence — a repeated flag is itself a usage error (12.0) — and the
 * non-flag tokens left once flags, their values, and `--` are removed: the
 * command word, `review`'s or `query`'s subcommand, and the operands.
 */
interface ReadInvocation {
  readonly flags: ReadonlyMap<string, ArgvValue | true>;
  readonly words: readonly (string | undefined)[];
}

function readInvocation(argv: readonly ArgvValue[]): ReadInvocation {
  const flags = new Map<string, ArgvValue | true>();
  const words: (string | undefined)[] = [];
  let flagsEnded = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = tokenOf(argv[index] as ArgvValue);
    if (!flagsEnded && token !== undefined && token.startsWith("--")) {
      if (token === "--") {
        flagsEnded = true;
        continue;
      }
      const name = token.slice(2);
      let value: ArgvValue | true = true;
      if (VALUE_FLAGS.has(name)) {
        index += 1;
        // A value-taking flag at the end lacks its value (a usage error):
        // read as taking none.
        if (index < argv.length) value = argv[index] as ArgvValue;
      }
      if (!flags.has(name)) flags.set(name, value);
      continue;
    }
    words.push(token);
  }
  return { flags, words };
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
  const { flags, words } = readInvocation(argv);
  if (flags.has("json")) return true;
  const [command, subcommand] = words;
  if (command === undefined) return false;
  if (JSON_ONLY_COMMANDS.has(command)) return true;
  return (
    command === "review" &&
    subcommand !== undefined &&
    JSON_ONLY_REVIEW_SUBCOMMANDS.has(subcommand)
  );
}

/** `review`'s mutating subcommands (SPEC 13.5, 10.7). */
const MUTATING_REVIEW_SUBCOMMANDS: ReadonlySet<string> = new Set([
  "create",
  "resolve",
  "split",
]);

/**
 * Whether an invocation is a mutating command's run — one that acquires and
 * releases at the lock path (SPEC 13.5): `rename` or `move` without a
 * `--preview` read as a flag (a preview acquires nothing, 6.6), or `review`
 * with the subcommand `create`, `resolve`, or `split` — read by 12.0's
 * grammar, whatever its other tokens (an invocation a usage error turns back
 * before acquisition is a mutating command's run all the same). Every other
 * invocation acquires nothing: `build`, `check`, `version`, a preview, and
 * every read command, the other `review` subcommands included (TEST-SPEC
 * H-6).
 */
export function invocationAcquires(argv: readonly ArgvValue[]): boolean {
  const { flags, words } = readInvocation(argv);
  const [command, subcommand] = words;
  if (command === "rename" || command === "move") return !flags.has("preview");
  return (
    command === "review" &&
    subcommand !== undefined &&
    MUTATING_REVIEW_SUBCOMMANDS.has(subcommand)
  );
}

/**
 * The value of an invocation's `--config <path>` flag read as a flag — the
 * path naming its configuration file, whose directory is the workspace root
 * (SPEC 7) — or undefined when the invocation gives none (or gives the flag
 * without its value).
 */
export function configPathArgument(
  argv: readonly ArgvValue[],
): ArgvValue | undefined {
  const value = readInvocation(argv).flags.get("config");
  return value === true ? undefined : value;
}
