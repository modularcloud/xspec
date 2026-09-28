// Argument parsing for the xspec CLI.
//
// IMPLEMENTATION (Key libraries): no CLI framework — the SPEC 12.0 flag rules
// are implemented in-repo because their semantics are pinned exactly by the
// specification. IMPLEMENTATION (Architecture): the cli layer owns argument
// parsing, command dispatch, and the exit-code taxonomy.
//
// The grammar, from SPEC 12.0's "Invocation grammar" and the per-command
// forms (6.4, 6.5, 8.2, 9, 10.7, 11, 12.1–12.5). Arguments are tokens, read
// in stages:
//
// 1. The token walk (`walkTokens`). A token beginning `--` is a flag token;
//    no other token is (no single-dash short forms). A flag's arity is fixed
//    by its name, the same for every command (`FLAG_ARITY`, built from the
//    whole command table), because flags may precede the command word: a
//    value-taking flag takes the whole next token as its value, whatever it
//    looks like, `-`/`--`-prefixed included, and lacks its value when no
//    token follows; a flag that takes none, and a `--` token naming no flag
//    of any command, takes none. The token `--` ends flag reading and is
//    dropped; every later token is a non-flag token. Flag tokens may stand
//    anywhere — before the command word, between it and its operands, or
//    after them.
// 2. JSON output is in effect exactly when a `--json` token is read as a
//    flag by that walk (a repeated one included, itself a usage error) —
//    never a `--json` taken as another flag's value or standing after `--`
//    — or when the invoked surface is JSON-only (10.7, 11, 12.6).
// 3. The remaining tokens, in order, are the command word from the known
//    table (12.5: `build`, `check`, `ids`, `show`, `coverage`, `impact`,
//    `review`, `query`, `occurrences`, `view`, `at`, `inventory`, `rename`,
//    `move`, `version`), its subcommand (`review`, `query`), and its
//    operands, matched to the synopsis exactly: no command word, an unknown
//    command or subcommand, a missing operand, or a surplus one is a usage
//    error — a surplus token is never accepted and ignored.
// 4. Each flag the walk read is checked against the command's accepted set
//    — its own flags plus the global `--json` and `--config <path>` — so
//    `--name=value`, or a flag of another command, is an unknown flag; a
//    flag may be given at most once (identical values included); list-valued
//    flags (`--kinds`) take one comma-separated value (11).
// - Argument values are interpreted as UTF-8; a malformed value is a usage
//   error judged before every per-flag and per-operand check (12.0).
// - Value checks decided by spelling alone run here, without loading
//   configuration (12.0's syntax class): enumerated and list values, the
//   at-most-one-`#` identity rule, and a `--tag` spelling no tag can have
//   (11.1, 1.4).
//
// Every parse failure is a usage error: exit 2 with the diagnostic on
// stderr. Standard output is empty unless JSON output is in effect (stage 2,
// decided even when the arguments are themselves the error), in which case
// the exit-2 error emits the 12.7 error document as the entire standard
// output (12.0); the parse result carries that determination for the
// caller. Diagnostics echo only argv tokens and static text, never resolved
// filesystem paths, keeping all output byte-deterministic for identical
// input (12.0: no absolute paths, no environment-dependent content).

import { describeSegmentViolation, segmentViolation } from "../core/text.js";

/** One flag a command accepts, and how its value (if any) is validated. */
interface FlagSpec {
  /** The flag token, leading `--` included (e.g. `"--base"`). */
  readonly name: string;
  /** Whether the flag consumes the following argv element as its value. */
  readonly takesValue: boolean;
  /** Diagnostic name of the value (e.g. `"<git-ref>"`). */
  readonly valueName?: string;
  /** SPEC 12.0: missing required flags are usage errors. */
  readonly required?: boolean;
  /** Enumerated whole-value set; any other value is a usage error. */
  readonly allowed?: readonly string[];
  /**
   * Marks a list-valued flag (SPEC 12.0): the value is one comma-separated
   * list whose every element must be in this set.
   */
  readonly list?: readonly string[];
  /**
   * SPEC 12.0: the flag's value is a `<node>`/`<graph-node>` identity —
   * `#` splits path from id or unit, at most one is well-formed, and a
   * spelling containing more than one is a malformed value, an error the
   * invocation's syntax alone determines: parse-level, reported without
   * loading configuration.
   */
  readonly identityValue?: boolean;
  /**
   * SPEC 11.1: the flag's value is a tag (`query nodes --tag`), accepted
   * syntactically — any well-formed tag (1.4), whatever the workspace
   * contains. A spelling no tag can have under 1.4's rules is a malformed
   * value, a usage error of the syntax class (12.0: "a `--to` or `--tag`
   * spelling malformed as an identity or tag"): parse-level, reported
   * without loading configuration.
   */
  readonly tagValue?: boolean;
}

/** One command (or `review`/`query` subcommand) of the SPEC 12.5 table. */
interface CommandSpec {
  /** Dispatch key and diagnostic prefix: `"build"`, `"review create"`, … */
  readonly path: string;
  /** Positional-argument names in order (e.g. `["<name>", "<item-id>"]`). */
  readonly positionals: readonly string[];
  /** How many trailing positionals are optional (default none). */
  readonly optionalPositionals?: number;
  /**
   * The command accepts any number of positionals beyond `positionals`
   * (SPEC 11.4: `view [<file> …]`); the upper arity bound is not checked.
   */
  readonly variadicPositionals?: boolean;
  /**
   * Flags that may not be combined with positional operands — SPEC 11.4:
   * combining `<file>` operands with `--file` is a usage error, a defect
   * the invocation's syntax alone determines (SPEC 12.0).
   */
  readonly positionalConflicts?: readonly string[];
  /**
   * SPEC 12.0: the command's positional operands are `<node>`/`<graph-node>`
   * identities (the `identityValue` rule, positional side) — a multi-`#`
   * spelling is a malformed value, parse-level. Never set for `<file>`
   * operands: a bare `<file>` is a whole path in which `#` has no delimiter
   * role (`view`, `at`, `rename`'s origin).
   */
  readonly identityPositionals?: boolean;
  /** Command-specific flags; the SPEC 12.0 globals are added for every command. */
  readonly flags: readonly FlagSpec[];
  /**
   * Groups of flags of which exactly one must be given — SPEC 10.7: `review
   * create` requires exactly one of `--base`, `--strategy`, `--coverage`;
   * none or more than one is a usage error (12.0).
   */
  readonly exactlyOneOf?: readonly (readonly string[])[];
  /**
   * SPEC 12.0: the surface is JSON-only — a single JSON document is its
   * only output form, with or without `--json` (10.7 `review export`, 11,
   * 12.6), so JSON output is in effect for every invocation of it, its
   * exit-2 errors included (the 12.7 error document).
   */
  readonly jsonOnly?: boolean;
}

/** SPEC 12.0: every command supports `--json` and `--config <path>` (7). */
const GLOBAL_FLAGS: readonly FlagSpec[] = [
  { name: "--json", takesValue: false },
  { name: "--config", takesValue: true, valueName: "<path>" },
];

/** SPEC 5.2: the four edge kinds (`query edges --kinds` filters over all). */
const ALL_EDGE_KINDS: readonly string[] = [
  "contains",
  "depends",
  "embeds",
  "references",
];

/**
 * SPEC 11: `query reachable --kinds` accepts only the three dependency edge
 * kinds — `contains` is an invalid flag value (12.0).
 */
const DEPENDENCY_EDGE_KINDS: readonly string[] = [
  "depends",
  "embeds",
  "references",
];

/** SPEC 13.5: every mutating command accepts `--test-hold <path>`. */
const TEST_HOLD_FLAG: FlagSpec = {
  name: "--test-hold",
  takesValue: true,
  valueName: "<path>",
};

/**
 * SPEC 6.6: `rename` and `move` accept `--preview` — full validation and
 * planning, performed on nothing. Combining it with `--test-hold` is a
 * usage error (a preview acquires no exclusivity and does not take the
 * acquisition-tied seam), checked by the command handlers.
 */
const PREVIEW_FLAG: FlagSpec = { name: "--preview", takesValue: false };

/**
 * The known command table (SPEC 12.5), in specification order. Argument
 * forms: `build` 12.1, `check` 12.2, `ids` 12.3, `show` 12.4, `coverage` 8.2,
 * `impact` 9, `review` 10.7, `query` 11.1, `occurrences` 11.3, `view` 11.4,
 * `at` 11.5, `inventory` 11.6, `rename` 6.4, `move` 6.5, `version` 12.6.
 */
const COMMANDS: readonly CommandSpec[] = [
  // SPEC 12.1.
  { path: "build", positionals: [], flags: [] },
  // SPEC 12.2.
  { path: "check", positionals: [], flags: [] },
  // SPEC 12.3: `--tree`, `--file <glob>`, `--unreferenced`.
  {
    path: "ids",
    positionals: [],
    flags: [
      { name: "--tree", takesValue: false },
      { name: "--file", takesValue: true, valueName: "<glob>" },
      { name: "--unreferenced", takesValue: false },
    ],
  },
  // SPEC 12.4: `show <node>`.
  {
    path: "show",
    positionals: ["<node>"],
    identityPositionals: true,
    flags: [],
  },
  // SPEC 8.2: `coverage` runs all profiles, `coverage <name>` one; `--check`.
  {
    path: "coverage",
    positionals: ["<name>"],
    optionalPositionals: 1,
    flags: [{ name: "--check", takesValue: false }],
  },
  // SPEC 9: `impact --base <git-ref>`.
  {
    path: "impact",
    positionals: [],
    flags: [
      {
        name: "--base",
        takesValue: true,
        valueName: "<git-ref>",
        required: true,
      },
    ],
  },
  // SPEC 10.7: the eight review subcommands.
  {
    path: "review create",
    positionals: [],
    flags: [
      { name: "--base", takesValue: true, valueName: "<ref>" },
      // SPEC 10.7: any `--strategy` value other than `audit` is a usage error.
      {
        name: "--strategy",
        takesValue: true,
        valueName: "<strategy>",
        allowed: ["audit"],
      },
      { name: "--coverage", takesValue: true, valueName: "<profile>" },
      { name: "--name", takesValue: true, valueName: "<name>", required: true },
      TEST_HOLD_FLAG,
    ],
    exactlyOneOf: [["--base", "--strategy", "--coverage"]],
  },
  { path: "review list", positionals: [], flags: [] },
  { path: "review status", positionals: ["<name>"], flags: [] },
  { path: "review next", positionals: ["<name>"], flags: [] },
  { path: "review show", positionals: ["<name>", "<item-id>"], flags: [] },
  {
    path: "review split",
    positionals: ["<name>", "<item-id>"],
    flags: [TEST_HOLD_FLAG],
  },
  {
    path: "review resolve",
    positionals: ["<name>", "<item-id>"],
    flags: [
      // SPEC 10.7: `--status` accepts `updated`, `no-change`, and `skipped`;
      // any other value is a usage error.
      {
        name: "--status",
        takesValue: true,
        valueName: "<status>",
        required: true,
        allowed: ["updated", "no-change", "skipped"],
      },
      { name: "--note", takesValue: true, valueName: "<text>" },
      TEST_HOLD_FLAG,
    ],
  },
  // SPEC 10.7: `export` is JSON-only — the entire session as a single JSON
  // document, its only output form with or without `--json` (12.0).
  { path: "review export", positionals: ["<name>"], flags: [], jsonOnly: true },
  // SPEC 11: the six query subcommands — JSON-only surfaces (12.0).
  {
    path: "query node",
    positionals: ["<node>"],
    identityPositionals: true,
    flags: [],
    jsonOnly: true,
  },
  {
    path: "query nodes",
    positionals: [],
    jsonOnly: true,
    flags: [
      { name: "--group", takesValue: true, valueName: "<g>" },
      { name: "--file", takesValue: true, valueName: "<glob>" },
      // SPEC 11.1: `--tag` accepts any well-formed tag (1.4) — syntactic
      // acceptance, as on `occurrences --to` (11.3).
      { name: "--tag", takesValue: true, valueName: "<t>", tagValue: true },
      // SPEC 11: `--coverage required|none`.
      {
        name: "--coverage",
        takesValue: true,
        valueName: "required|none",
        allowed: ["required", "none"],
      },
    ],
  },
  {
    path: "query edges",
    positionals: [],
    jsonOnly: true,
    flags: [
      {
        name: "--from",
        takesValue: true,
        valueName: "<graph-node>",
        identityValue: true,
      },
      {
        name: "--to",
        takesValue: true,
        valueName: "<graph-node>",
        identityValue: true,
      },
      // SPEC 11: `edges --kinds` filters over all four kinds.
      {
        name: "--kinds",
        takesValue: true,
        valueName: "<kinds>",
        list: ALL_EDGE_KINDS,
      },
    ],
  },
  {
    path: "query subtree",
    positionals: ["<node>"],
    identityPositionals: true,
    flags: [],
    jsonOnly: true,
  },
  {
    path: "query ancestors",
    positionals: ["<node>"],
    identityPositionals: true,
    flags: [],
    jsonOnly: true,
  },
  {
    path: "query reachable",
    positionals: [],
    jsonOnly: true,
    flags: [
      {
        name: "--from",
        takesValue: true,
        valueName: "<graph-node>",
        required: true,
        identityValue: true,
      },
      {
        name: "--to",
        takesValue: true,
        valueName: "<graph-node>",
        required: true,
        identityValue: true,
      },
      {
        name: "--kinds",
        takesValue: true,
        valueName: "<kinds>",
        list: DEPENDENCY_EDGE_KINDS,
      },
    ],
  },
  // SPEC 11.3: `occurrences [--file <glob>] [--to <node>]` — JSON-only
  // (SPEC 11: a single JSON document is its only output form, with or
  // without `--json`).
  {
    path: "occurrences",
    positionals: [],
    jsonOnly: true,
    flags: [
      { name: "--file", takesValue: true, valueName: "<glob>" },
      { name: "--to", takesValue: true, valueName: "<node>" },
    ],
  },
  // SPEC 11.4: `view [<file> …] [--file <glob>] [--text]` — JSON-only
  // (SPEC 11). Operands assert membership while `--file` restricts the
  // domain; combining them is a usage error.
  {
    path: "view",
    positionals: ["<file>"],
    optionalPositionals: 1,
    variadicPositionals: true,
    positionalConflicts: ["--file"],
    jsonOnly: true,
    flags: [
      { name: "--file", takesValue: true, valueName: "<glob>" },
      { name: "--text", takesValue: false },
    ],
  },
  // SPEC 11.5: `at <file> <offset>` — JSON-only (SPEC 11). `<file>` asserts
  // domain membership exactly as a `view` operand does and `<offset>` must
  // be one or more ASCII decimal digits within the file's byte length —
  // checks the handler runs against discovery and the file's bytes, before
  // answering (SPEC 11.2, 12.0).
  {
    path: "at",
    positionals: ["<file>", "<offset>"],
    flags: [],
    jsonOnly: true,
  },
  // SPEC 11.6: `inventory` — JSON-only (SPEC 11: a single JSON document is
  // its only output form, with or without `--json`). No flags beyond the
  // globals: the inventory is a pure report of the workspace's shape.
  { path: "inventory", positionals: [], flags: [], jsonOnly: true },
  // SPEC 6.4: `rename <file> <old-id> <new-id> [--preview]` (6.6).
  {
    path: "rename",
    positionals: ["<file>", "<old-id>", "<new-id>"],
    flags: [TEST_HOLD_FLAG, PREVIEW_FLAG],
  },
  // SPEC 6.5: `move <old-file> <new-file>` or
  // `move <file>#<id> <target-file>#<new-id>` — two positionals either way,
  // `[--preview]` on both forms (6.6).
  {
    path: "move",
    positionals: ["<old>", "<new>"],
    flags: [TEST_HOLD_FLAG, PREVIEW_FLAG],
  },
  // SPEC 12.6: `version` — JSON-only (a single JSON document is its only
  // output form, with or without `--json`); workspace-independent, so
  // `--config` (a global) is accepted and never consulted — `main`
  // dispatches it before configuration location.
  { path: "version", positionals: [], flags: [], jsonOnly: true },
];

/** Every dispatch key (`CommandSpec.path`), in specification order. */
export const COMMAND_PATHS: readonly string[] = COMMANDS.map(
  (spec) => spec.path,
);

/** The dispatch keys of the JSON-only surfaces (SPEC 12.0; 10.7, 11, 12.6). */
const JSON_ONLY_PATHS: ReadonlySet<string> = new Set(
  COMMANDS.filter((spec) => spec.jsonOnly === true).map((spec) => spec.path),
);

/** A parsed flag value: boolean presence, one value, or a `--kinds` list. */
export type FlagValue = true | string | readonly string[];

/** A successfully parsed invocation, ready for dispatch. */
export interface Invocation {
  /** The matched command's dispatch key (`CommandSpec.path`). */
  readonly command: string;
  /** Positional arguments in order. */
  readonly positionals: readonly string[];
  /** SPEC 12.0: the global `--json` flag, read as a flag (not a value). */
  readonly json: boolean;
  /**
   * SPEC 12.0: the global `--config <path>` value, a filesystem path to be
   * resolved against the working directory; absent when the flag was not
   * given.
   */
  readonly config?: string;
  /** Command-specific flags as given (globals are carried in `json`/`config`). */
  readonly flags: ReadonlyMap<string, FlagValue>;
}

export type ParseResult =
  | { readonly ok: true; readonly invocation: Invocation }
  | {
      readonly ok: false;
      /** The diagnostic, without the `xspec: ` program prefix. */
      readonly message: string;
      /**
       * SPEC 12.0: whether JSON output is in effect for the failed
       * invocation — a `--json` token read as a flag, not as another
       * flag's value nor after `--` (even when the arguments are
       * themselves the error, a repeated `--json` included), or the
       * invoked surface, as far as the arguments identify one, is
       * JSON-only. Governs error delivery: with it, the exit-2 error emits
       * the 12.7 error document as the entire standard output.
       */
      readonly jsonInEffect: boolean;
    };

function usageError(message: string, jsonInEffect: boolean): ParseResult {
  return { ok: false, message, jsonInEffect };
}

/**
 * SPEC 12.0: argument values are interpreted as UTF-8, and a value that is
 * not valid UTF-8 is a usage error — every argument value, `move`'s
 * positional operands included: no argument value may name a non-UTF-8 path
 * (12.0), so 6.5's non-UTF-8 destination clause is unreachable through the
 * CLI. Node materializes `process.argv` by decoding the OS argument bytes
 * as UTF-8 with U+FFFD substituted for every invalid sequence, so invalid
 * input bytes are observable only as U+FFFD in the decoded string: a value
 * containing U+FFFD is indistinguishable from mis-decoded bytes and is
 * treated as not valid UTF-8. A lone surrogate (which no UTF-8 decode
 * produces, but an in-process caller could pass) has no UTF-8 encoding and
 * is rejected the same way.
 *
 * Exported for `move` (SPEC 6.5): the destination-validity assessment
 * (core/refusal.ts) takes the path's UTF-8 validity as an input — always
 * true for a CLI-supplied operand, per the parse rule above.
 */
export function isValidUtf8ArgumentValue(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit === 0xfffd) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/**
 * SPEC 6.5: a `move` operand is classified by spelling alone — an operand
 * containing `#` is a `<file>#<id>` pair under the split of 12.0, one
 * without is a file. SPEC 12.0: at most one `#` is well-formed in any such
 * value, so a spelling containing more than one is a malformed value; and
 * an invocation mixing the two synopses' forms (one pair operand, one bare
 * file) matches neither synopsis. Both are usage errors the invocation's
 * syntax alone determines, so they are parse-level: reported without
 * loading configuration (12.0), before workspace exclusivity or any hold
 * file (13.5). Returns the diagnostic, or null for a well-formed pair of
 * operands.
 */
function moveOperandsProblem(positionals: readonly string[]): string | null {
  for (const operand of positionals) {
    const first = operand.indexOf("#");
    if (first !== -1 && operand.includes("#", first + 1)) {
      return (
        `operand '${operand}' contains more than one '#' — at most one is ` +
        `well-formed: an operand containing '#' is a <file>#<id> pair and ` +
        `one without is a file (SPEC 6.5, 12.0)`
      );
    }
  }
  const [origin, destination] = positionals;
  if (
    origin !== undefined &&
    destination !== undefined &&
    origin.includes("#") !== destination.includes("#")
  ) {
    return (
      `operands '${origin}' and '${destination}' mix the two synopses' ` +
      `forms — an operand containing '#' is a <file>#<id> pair and one ` +
      `without is a file, so the invocation matches neither ` +
      `\`move <old-file> <new-file>\` nor ` +
      `\`move <file>#<id> <target-file>#<new-id>\` (SPEC 6.5, 12.0)`
    );
  }
  return null;
}

/**
 * SPEC 12.0: at most one `#` is well-formed in a `<node>`/`<graph-node>`
 * value — its `#` splits path from id or unit, and no identity contains one
 * in path, id segment, or unit name (1.4, 1.5, 4.6) — so a spelling
 * containing more than one is a malformed value, a usage error the
 * invocation's syntax alone determines: parse-level, reported without
 * loading configuration. Returns the diagnostic, or null.
 */
function identityValueProblem(value: string, what: string): string | null {
  const first = value.indexOf("#");
  if (first !== -1 && value.includes("#", first + 1)) {
    return (
      `${what} value '${value}' contains more than one '#' — at most one ` +
      `is well-formed: '#' splits path from id or unit, and no identity ` +
      `contains one (SPEC 12.0, 1.5)`
    );
  }
  return null;
}

/** `"build, check, ids, …"` for diagnostics, in specification order. */
function commandNameList(): string {
  const names: string[] = [];
  for (const spec of COMMANDS) {
    const name = spec.path.split(" ")[0]!;
    if (!names.includes(name)) names.push(name);
  }
  return names.join(", ");
}

/** Subcommand names of a command group, in specification order. */
function subcommandNameList(group: ReadonlyMap<string, CommandSpec>): string {
  return [...group.keys()].join(", ");
}

/** The command table keyed by name; `review`/`query` hold subcommand maps. */
function buildTable(): ReadonlyMap<
  string,
  CommandSpec | Map<string, CommandSpec>
> {
  const table = new Map<string, CommandSpec | Map<string, CommandSpec>>();
  for (const spec of COMMANDS) {
    const words = spec.path.split(" ");
    if (words.length === 1) {
      table.set(spec.path, spec);
      continue;
    }
    const [command, subcommand] = [words[0]!, words[1]!];
    const existing = table.get(command);
    const group =
      existing instanceof Map ? existing : new Map<string, CommandSpec>();
    group.set(subcommand, spec);
    table.set(command, group);
  }
  return table;
}

const TABLE = buildTable();

/**
 * SPEC 12.0: "A flag's arity is fixed by its name, the same for every
 * command — known before the command word is identified, since flags may
 * precede it". Every flag name of every command, the globals included,
 * mapped to whether it takes a value; a name absent here — a `--` token
 * naming no flag of any command — takes none. Built from the command table
 * itself, so each flag carries one arity everywhere; a name declared with
 * two arities is a table defect, refused at module load.
 */
const FLAG_ARITY: ReadonlyMap<string, boolean> = buildArityTable();

function buildArityTable(): ReadonlyMap<string, boolean> {
  const arity = new Map<string, boolean>();
  const flags = [...GLOBAL_FLAGS, ...COMMANDS.flatMap((spec) => spec.flags)];
  for (const flag of flags) {
    const known = arity.get(flag.name);
    if (known !== undefined && known !== flag.takesValue) {
      throw new Error(
        `flag '${flag.name}' is declared both with and without a value — ` +
          `SPEC 12.0 fixes a flag's arity by its name`,
      );
    }
    arity.set(flag.name, flag.takesValue);
  }
  return arity;
}

/** One token the walk read as a flag (SPEC 12.0), with its value. */
interface WalkedFlag {
  /** The flag token as spelled, leading `--` included. */
  readonly token: string;
  /**
   * The whole next token, for a value-taking flag followed by one; absent
   * for a flag that takes none and for a value-taking flag standing last,
   * which lacks its value.
   */
  readonly value: string | undefined;
}

/** The token walk of SPEC 12.0's invocation grammar. */
interface TokenWalk {
  /** Every token read as a flag, in argument order. */
  readonly flags: readonly WalkedFlag[];
  /**
   * The non-flag tokens in order — the command word, its subcommand where
   * it has one, and its operands — once the flags, their values, and any
   * `--` are removed.
   */
  readonly words: readonly string[];
  /** Whether a `--json` token was read as a flag (a repeated one included). */
  readonly json: boolean;
}

/**
 * SPEC 12.0: read the argument tokens. While flag reading lasts, a token
 * beginning `--` is a flag token, wherever it stands — before the command
 * word, between it and its operands, or after them; a value-taking flag
 * (by its name: `FLAG_ARITY`) takes the whole next token as its value,
 * whatever that token looks like, a `-`- or `--`-prefixed one included.
 * The token `--` ends flag reading and is dropped: every later token is a
 * non-flag token, `--`-prefixed spellings included. The walk needs no
 * command word, so it completes on every argument vector, and JSON-in-effect
 * is decided from it even when the arguments are themselves the error.
 */
function walkTokens(argv: readonly string[]): TokenWalk {
  const flags: WalkedFlag[] = [];
  const words: string[] = [];
  let json = false;
  let readingFlags = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (readingFlags && token === "--") {
      readingFlags = false;
      continue;
    }
    if (!readingFlags || !token.startsWith("--")) {
      words.push(token);
      continue;
    }
    if (token === "--json") json = true;
    if (FLAG_ARITY.get(token) === true && index + 1 < argv.length) {
      index += 1;
      flags.push({ token, value: argv[index]! });
    } else {
      flags.push({ token, value: undefined });
    }
  }
  return { flags, words, json };
}

/**
 * SPEC 12.0, 12.5: the walk's non-flag tokens matched to the command table
 * — the command word, then the subcommand of `review` or `query` — with the
 * operands after them. A failure carries the usage diagnostic and whether
 * the surface, as far as the words identify one, is JSON-only.
 */
type CommandMatch =
  | {
      readonly ok: true;
      readonly spec: CommandSpec;
      readonly operands: readonly string[];
    }
  | {
      readonly ok: false;
      readonly message: string;
      readonly jsonOnly: boolean;
    };

function matchCommand(words: readonly string[]): CommandMatch {
  const commandWord = words[0];
  if (commandWord === undefined) {
    return {
      ok: false,
      message: `missing command (expected one of: ${commandNameList()})`,
      jsonOnly: false,
    };
  }
  const entry = TABLE.get(commandWord);
  if (entry === undefined) {
    return {
      ok: false,
      message:
        `unknown command '${commandWord}' (expected one of: ` +
        `${commandNameList()})`,
      jsonOnly: false,
    };
  }
  if (!(entry instanceof Map)) {
    return { ok: true, spec: entry, operands: words.slice(1) };
  }
  // SPEC 12.0: a command group all of whose subcommands are JSON-only
  // (`query`, 11) is a JSON-only surface already at the group name.
  const groupJsonOnly = [...entry.values()].every(
    (subcommand) => subcommand.jsonOnly === true,
  );
  const subcommandWord = words[1];
  if (subcommandWord === undefined) {
    return {
      ok: false,
      message:
        `${commandWord}: missing subcommand (expected one of: ` +
        `${subcommandNameList(entry)})`,
      jsonOnly: groupJsonOnly,
    };
  }
  const subcommand = entry.get(subcommandWord);
  if (subcommand === undefined) {
    return {
      ok: false,
      message:
        `${commandWord}: unknown subcommand '${subcommandWord}' (expected ` +
        `one of: ${subcommandNameList(entry)})`,
      jsonOnly: groupJsonOnly,
    };
  }
  return { ok: true, spec: subcommand, operands: words.slice(2) };
}

/**
 * Parse one invocation's argv (the elements after the executable name)
 * against SPEC 12.0's invocation grammar and the SPEC 12.5 command table,
 * in the stages the module header lists. Returns the parsed invocation, or
 * the usage-error failure the caller reports before exiting 2 (12.0): the
 * diagnostic for stderr (the caller prefixes the program name) and whether
 * JSON output is in effect — with it, the caller emits the 12.7 error
 * document as the entire standard output.
 */
export function parseArgv(argv: readonly string[]): ParseResult {
  // Stages 1–2 (SPEC 12.0): the token walk, and JSON-in-effect decided from
  // it — a `--json` read as a flag, or a JSON-only surface as far as the
  // remaining tokens identify one — before any check, so every usage error
  // below is delivered in the one output form the arguments select.
  const walk = walkTokens(argv);
  const match = matchCommand(walk.words);
  const jsonInEffect =
    walk.json || (match.ok ? match.spec.jsonOnly === true : match.jsonOnly);
  const refuse = (message: string): ParseResult =>
    usageError(message, jsonInEffect);

  // SPEC 12.0: argument values are interpreted as UTF-8, and a malformed
  // value is judged before every per-flag and per-operand check — every
  // token, `move`'s positional operands included (no argument value may
  // name a non-UTF-8 path, 12.0).
  for (let index = 0; index < argv.length; index += 1) {
    if (!isValidUtf8ArgumentValue(argv[index]!)) {
      return refuse(
        `argument ${String(index + 1)} is not valid UTF-8 — argument ` +
          `values are interpreted as UTF-8`,
      );
    }
  }

  // Stage 3 (SPEC 12.0): the command word and, for `review` and `query`,
  // the subcommand; the operands are the words after them.
  if (!match.ok) {
    return refuse(match.message);
  }
  const { spec, operands: positionals } = match;

  // Stage 4 (SPEC 12.0): each flag the walk read, in argument order, against
  // the command's accepted set — its own flags plus the globals.
  const flagSpecs = new Map<string, FlagSpec>();
  for (const flag of GLOBAL_FLAGS) flagSpecs.set(flag.name, flag);
  for (const flag of spec.flags) flagSpecs.set(flag.name, flag);

  const seen = new Set<string>();
  const flags = new Map<string, FlagValue>();
  let config: string | undefined;

  for (const { token, value } of walk.flags) {
    const flag = flagSpecs.get(token);
    if (flag === undefined) {
      // SPEC 12.0: a `--` token naming no flag the command accepts —
      // `--name=value`, a flag of another command — is an unknown flag.
      return refuse(`${spec.path}: unknown flag '${token}'`);
    }
    // SPEC 12.0: a flag may be given at most once per invocation; repeating a
    // flag is a usage error — identical values included.
    if (seen.has(token)) {
      return refuse(
        `${spec.path}: flag '${token}' given more than once — a flag may be ` +
          `given at most once per invocation`,
      );
    }
    seen.add(token);
    if (!flag.takesValue) {
      if (token !== "--json") flags.set(token, true);
      continue;
    }
    if (value === undefined) {
      // SPEC 12.0: a value-taking flag with no token after it lacks its value.
      return refuse(
        `${spec.path}: flag '${token}' requires a value` +
          (flag.valueName === undefined ? "" : ` ${flag.valueName}`),
      );
    }
    if (flag.list !== undefined) {
      // SPEC 12.0: list-valued flags take one comma-separated value; an
      // element outside the flag's set is an invalid flag value.
      const elements = value.split(",");
      for (const element of elements) {
        if (!flag.list.includes(element)) {
          return refuse(
            `${spec.path}: invalid value '${value}' for '${token}' — one ` +
              `comma-separated list of: ${flag.list.join(", ")}`,
          );
        }
      }
      flags.set(token, elements);
      continue;
    }
    if (flag.allowed !== undefined && !flag.allowed.includes(value)) {
      // SPEC 12.0: invalid flag values are usage errors.
      return refuse(
        `${spec.path}: invalid value '${value}' for '${token}' (expected ` +
          `one of: ${flag.allowed.join(", ")})`,
      );
    }
    if (flag.identityValue === true) {
      // SPEC 12.0: a `<graph-node>` flag value with more than one `#` is a
      // malformed value — syntax-determined, so parse-level.
      const problem = identityValueProblem(value, `${spec.path}: '${token}'`);
      if (problem !== null) {
        return refuse(problem);
      }
    }
    if (flag.tagValue === true) {
      // SPEC 11.1, 1.4, 12.0: a spelling no tag can have is a malformed
      // value — decided by its spelling alone, so parse-level. Judged by
      // the one shared 1.4 validator; the spelling is quoted as JSON so an
      // invisible or line-breaking character shows in the one-line message.
      const violation = segmentViolation(value, "tag");
      if (violation !== null) {
        return refuse(
          `${spec.path}: invalid value for '${token}' — the tag ` +
            `${JSON.stringify(value)} ${describeSegmentViolation(violation)}` +
            `, so no tag has this spelling: a malformed value ` +
            `(SPEC 11.1, 1.4, 12.0)`,
        );
      }
    }
    if (token === "--config") config = value;
    else flags.set(token, value);
  }

  // SPEC 12.0: missing required flags are usage errors.
  for (const flag of spec.flags) {
    if (flag.required === true && !seen.has(flag.name)) {
      return refuse(
        `${spec.path}: missing required flag '${flag.name}'` +
          (flag.valueName === undefined ? "" : ` ${flag.valueName}`),
      );
    }
  }
  // SPEC 10.7 (via `exactlyOneOf`): exactly one of the group must be given.
  for (const group of spec.exactlyOneOf ?? []) {
    const given = group.filter((name) => seen.has(name));
    if (given.length !== 1) {
      return refuse(
        `${spec.path}: exactly one of ${group.join(", ")} is required` +
          (given.length === 0 ? "" : ` (got ${given.join(" and ")})`),
      );
    }
  }
  // SPEC 12.0: missing required arguments are usage errors; an argument the
  // command's form does not define is one too (a variadic command defines
  // no upper bound, SPEC 11.4).
  const minimum = spec.positionals.length - (spec.optionalPositionals ?? 0);
  if (positionals.length < minimum) {
    return refuse(
      `${spec.path}: missing required argument ` +
        `${spec.positionals[positionals.length]!}`,
    );
  }
  if (
    spec.variadicPositionals !== true &&
    positionals.length > spec.positionals.length
  ) {
    return refuse(
      `${spec.path}: unexpected argument ` +
        `'${positionals[spec.positionals.length]!}'`,
    );
  }
  // SPEC 11.4/12.0: combining positional operands with a domain-restricting
  // flag is a usage error the invocation's syntax alone determines.
  for (const conflicting of spec.positionalConflicts ?? []) {
    if (positionals.length > 0 && seen.has(conflicting)) {
      return refuse(
        `${spec.path}: ${spec.positionals[0] ?? "positional"} operands ` +
          `cannot be combined with '${conflicting}' — operands assert ` +
          `membership while the flag restricts the domain; give one or ` +
          `the other`,
      );
    }
  }
  // SPEC 12.0: a `<node>` positional with more than one `#` is a malformed
  // value — syntax-determined, so parse-level (`show`, `query node`,
  // `query subtree`, `query ancestors`).
  if (spec.identityPositionals === true) {
    for (const positional of positionals) {
      const problem = identityValueProblem(
        positional,
        `${spec.path}: ${spec.positionals[0] ?? "<node>"}`,
      );
      if (problem !== null) {
        return refuse(problem);
      }
    }
  }
  // SPEC 6.5/12.0: `move` operand classification is by spelling alone — a
  // multi-`#` operand is a malformed value, and a mixed-synopsis invocation
  // matches neither form (see `moveOperandsProblem`).
  if (spec.path === "move") {
    const problem = moveOperandsProblem(positionals);
    if (problem !== null) {
      return refuse(`move: ${problem}`);
    }
  }

  return {
    ok: true,
    invocation: {
      command: spec.path,
      positionals,
      json: walk.json,
      config,
      flags,
    },
  };
}

/** The value of a value flag, or undefined when it was not given. */
export function flagValue(
  invocation: Invocation,
  name: string,
): string | undefined {
  const value = invocation.flags.get(name);
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(
      `flag '${name}' of '${invocation.command}' is not a value flag`,
    );
  }
  return value;
}

/** Whether a boolean flag was given. */
export function flagPresent(invocation: Invocation, name: string): boolean {
  const value = invocation.flags.get(name);
  if (value === undefined) return false;
  if (value !== true) {
    throw new Error(
      `flag '${name}' of '${invocation.command}' is not a boolean flag`,
    );
  }
  return true;
}

/**
 * SPEC 12.0: whether JSON output is in effect for a parsed invocation — a
 * `--json` token read as a flag, or the invoked surface is JSON-only, a
 * single JSON document its only output form with or without `--json`
 * (10.7 `review export`, 11, 12.6). Governs the whole output form, the
 * exit-2 error document included (12.7).
 */
export function jsonOutputInEffect(invocation: Invocation): boolean {
  return invocation.json || JSON_ONLY_PATHS.has(invocation.command);
}

/** The elements of a list-valued flag, or undefined when it was not given. */
export function flagList(
  invocation: Invocation,
  name: string,
): readonly string[] | undefined {
  const value = invocation.flags.get(name);
  if (value === undefined) return undefined;
  if (value === true || typeof value === "string") {
    throw new Error(
      `flag '${name}' of '${invocation.command}' is not a list-valued flag`,
    );
  }
  return value;
}
