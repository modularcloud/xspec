// CONF-IMPORT conformer fixture (CERTIFICATIONS.md §CONF-IMPORT; TEST-SPEC 17
// C-1/C-2). A harness-owned executable product implementing §CONF-IMPORT's
// Scope with the simplest conforming behavior — driven only through the C-2
// executable/workspace binding, never importing product code (the product and
// the harness are distinct programs; this fixture is part of the harness).
//
// Scope implemented (see CERTIFICATIONS.md §CONF-IMPORT):
// - T7-9's workspace outside its install stagings, as P-19 draws over it:
//   configured spec groups of trivial single-section `.mdx` sources — one
//   line holding an opening `<S id="…">` (or `<Spec id="…">`) tag, plain
//   text, and the matching closing tag, with at most one final line
//   terminator (T7-9(d)'s `specs/A.mdx`, `<S id="a">A</S>`) — and `markdown`
//   with `emit: true`, emitting next to sources (7.3, 13.2); `emit: false`,
//   an absent `markdown`, and an `outDir` are handled as 7.3 states. No code
//   group (an empty `code` map aside), no `coverage` or `policy` rule (an
//   empty list aside), no journal, no review sessions, no git. Anything
//   outside that shape — another source form, a code group, a rule, a
//   journal, a session directory, another command — is refused loudly with
//   exit 70 (`xspec: fixture scope error: …` on stderr), outside SPEC 12.0's
//   exit partition: a fixture-side condition, never a product verdict.
// - The configuration's import, read as 7 states (CERTIFICATIONS.md
//   preamble): its module specifier is any static string literal (2.4), in
//   either quote style — escape sequences of every form, line
//   continuations, U+FFFD, and other non-ASCII code points included — whose
//   characters are read as spelled and never decoded, interpreted,
//   resolved, or loaded: nothing is read and no network access is made on
//   its account, so the configuration's validity and every answer are
//   independent of it. Well-formedness (14.20) is judged on its accepting
//   side alone (TEST-SPEC S-9): the tokenizer takes a backslash together
//   with the character after it (a carriage return and line feed pair
//   whole), and ends a literal at its own quote alone, so a spelling
//   TypeScript's scanner rejects is accepted too. The configuration file is
//   a source only where a configured glob matches it (7).
// - Command surface: `build` (12.1), `check` (12.2), `ids` (12.3), and
//   `inventory` (11.6) in its full 12.7 document form, each with `--json`
//   and `--config` and behaving per 12.0 and 13.3 — `build` generating each
//   source's module (13.1) and its Markdown (13.2) and writing graph data
//   whose record lists the derived paths generated (13.3), the record
//   `inventory` reports (11.6). None is mutating (13.5: `rename`, `move`,
//   and the mutating `review` subcommands), so `--test-hold`, value-taking
//   by name all the same, is an unknown flag of each: the usage error of
//   12.0.
// - Universal rules (CERTIFICATIONS.md preamble): the configuration is
//   located by upward search for `xspec.config.ts` from the working
//   directory, or at the path `--config` names, resolved against the
//   working directory (7, 12.0); configured paths and globs resolve against
//   the configuration file's directory, the workspace root; the arguments
//   are read under 12.0's invocation grammar (`readInvocation`) — flag
//   tokens anywhere, a value-taking flag taking the whole next token, arity
//   fixed by name for every command, `--` ending flag reading, the remaining
//   tokens matching the synopsis exactly — and, with JSON in effect, every
//   usage or configuration error (exit 2) is the 12.7 error document.
//
// Key mechanisms:
// - Every syntax-class check (12.0) precedes configuration loading and
//   every scope refusal: first the checks the arguments decide for every
//   command alike (`readInvocation`: unknown, repeated, or valueless flags;
//   malformed values), then the command word and `query`'s subcommand, then
//   the served command's synopsis (`checkSynopsis`) and `ids --file`'s
//   outside-root spelling. Only then are a command outside the surface, a
//   `query` subcommand, and the flags `ids` names but this fixture does not
//   serve (`--tree`, `--file`, `--unreferenced`) refused (exit 70).
// - Discovery (7, 13.4) lists a directory — the workspace root, or one
//   reached from it through directories alone — exactly when a configured
//   glob matches a path below it, `.xspec/` counting for none, and never
//   follows or discovers a symbolic link; globs are byte-wise (`*`, `?`,
//   `**` as a whole segment, the dot-segment rule); derived files —
//   `.xspec.` names, `.xspec/` paths, and, while emission is enabled, the
//   configured Markdown emit destinations, by configuration alone — are no
//   sources. A `.mdx` source whose path holds `#`, U+FFFD, or a character
//   7.1 bars is one 14.19 finding beside its content's analysis; a spec
//   match without `.mdx`, whose content 14.19 would leave to be analyzed as
//   a spec source's, is outside the scope (exit 70) wherever sources are
//   analyzed, and `inventory`, which parses none, lists it with its derived
//   paths structurally absent.
// - `build` (12.1): validates (14.19, and 14.22 over its own write paths);
//   on findings exits 1, modifying nothing. Otherwise it writes each
//   source's module `NAME.xspec.ts` (13.1: fixed bytes naming the source,
//   beginning with the generated-file header of 4 — content beyond the path
//   is out of scope, and no companion is written) and, while emission is
//   enabled, its Markdown per 3 (the two tags removed, the text and the
//   line's terminator kept), replacing each path's occupant and never
//   writing through a link (13.4); then removes every recorded path no
//   longer generated (13.4); then writes graph data — the graph
//   (`.xspec/graph.json`) and, last, the record of the derived paths
//   generated (`.xspec/record.json`), a layout no consumer sees (13.3).
// - `check` (12.2): the same validations, then 14.10's forms: the per-file
//   form (each generated path's occupant judged itself: a plain file
//   holding exactly the generated bytes, or stale) and the graph-data unit
//   form (the graph missing or mismatching), both on a workspace passing
//   the validations alone; the unreadable-record unit form (14.23) and the
//   recorded-file form on any workspace. It never refreshes; exits 1 on
//   any finding.
// - `ids` (12.3, 13.3): the gate — `build`'s validations, their findings
//   reported with exit 1, nothing evaluated or written past it — then the
//   refresh: where the graph is missing or mismatches what `build` would
//   now write, the graph alone is rewritten, no TypeScript or Markdown
//   generated or removed and the record left as it stands; then the
//   listing, one entry per discovered spec source in byte order of path,
//   its IDs in document order.
// - `inventory` (11.6): JSON-only, the full 12.7 document — anchoring
//   (physical paths, relative to the working directory), the resolved
//   configuration view, the discovered sources with their groups, the
//   derived-file map, the record (or, where recorded state exists that
//   cannot be read as one, the unavailability marker with its 14.23
//   finding, exit 1), the graph-data area, the journal's occupancy, the
//   (empty) session list, and the lock path — parsing no source and writing
//   nothing.
//
// Determinism (SPEC 12.0): no wall clock, no randomness, no absolute paths in
// any output; paths in byte order; all JSON serialized with byte-sorted keys;
// graph data a function of the discovered sources and groups alone. Nothing
// written depends on the configuration's import, so a workspace whose
// specifier is spelled otherwise writes every module and Markdown file
// byte-identical to its twin's.
//
// This source holds no backslash: every special character is built from its
// code point (`BACKSLASH`, `LF`, `CR`, …), so no tool handling the file can
// decode an escape sequence out of it.
//
// Deviation seam: runXspec(argv, cwd, options) assigns `options` onto the
// module-level `deviations` switches (all off = this conformer). The
// configuration's specifier is read in one place, `parseConfigText`, which
// returns its quote character and its spelled characters and gives them no
// meaning; `loadConfig` hands them to `specifierRefusal`, the violators' one
// hook, which makes a configuration error (14.14) of the class of spellings
// a switch refuses — `refuseBracedEscapes` (VIOL-IMPORT-BRACED,
// `bin-braced.mjs`) and `refuseSingleQuotes` (VIOL-IMPORT-SINGLE,
// `bin-single.mjs`) — and of nothing while every switch is off.

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Code points (this source spells no backslash; see the header)
// ---------------------------------------------------------------------------

const cp = (code) => String.fromCodePoint(code);

const BACKSLASH = cp(0x5c);
const LF = cp(0x0a);
const CR = cp(0x0d);
const LINE_SEPARATOR = cp(0x2028);
const PARAGRAPH_SEPARATOR = cp(0x2029);
const REPLACEMENT_CHARACTER = cp(0xfffd);
const BACKTICK = cp(0x60);

/**
 * ECMAScript's WhiteSpace and LineTerminator code points (14.20): tab,
 * vertical tab, form feed, space, no-break space, the byte-order mark, the
 * other space separators (Zs), line feed, carriage return, and U+2028 and
 * U+2029 — what separates the configuration's tokens.
 */
const CONFIG_SPACE = new Set([
  0x09, 0x0b, 0x0c, 0x20, 0xa0, 0xfeff, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
  0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f,
  0x3000, 0x0a, 0x0d, 0x2028, 0x2029,
]);

/** SPEC 1.4's whitespace: tab, LF, vertical tab, form feed, CR, space. */
const SPEC_WHITESPACE = new Set([0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20]);

// ---------------------------------------------------------------------------
// Outcome carriers
// ---------------------------------------------------------------------------

/**
 * Usage or configuration error (SPEC 12.0 exit 2): the message on stderr in
 * both output forms, after the concerned path when one is set (14); with
 * JSON output in effect the 12.7 error document is the entire stdout.
 * `code`/`path` are the error finding's stable code and concerned path —
 * set for a configuration error (14.14: `configuration-error` and the
 * concerned path in the anchoring form), `null` for a plain usage error.
 */
class UsageError extends Error {
  constructor(message, { code = null, path = null } = {}) {
    super(message);
    this.code = code;
    this.path = path;
  }
}

/** Findings (SPEC 12.0 exit 1): the findings report on stdout. */
class FindingsError extends Error {
  constructor(findings) {
    super("findings");
    this.findings = findings;
  }
}

/**
 * An invocation or workspace outside this fixture's scope
 * (CERTIFICATIONS.md §CONF-IMPORT) that a conforming product would answer:
 * refused loudly with exit 70, outside the 12.0 partition, so a test reaching
 * it fails on its exit-code assertion with the cause on stderr — never on a
 * fabricated answer or a false usage error.
 */
class ScopeError extends Error {}

// ---------------------------------------------------------------------------
// Canonical JSON (sorted keys, SPEC 12.0) and byte order
// ---------------------------------------------------------------------------

/** Byte-wise comparison of two strings' UTF-8 encodings (SPEC 12.0). */
function compareBytes(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function byteSorted(strings) {
  return [...strings].sort(compareBytes);
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort(compareBytes)) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/** One serializer for every JSON document: sorted keys, two-space indent. */
function canonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value), null, 2);
}

// ---------------------------------------------------------------------------
// Deviation switches, all off in the conformer; assigned by runXspec from
// each entry's options (module header).
// ---------------------------------------------------------------------------

let deviations = {};

// ---------------------------------------------------------------------------
// Invocation grammar (SPEC 12.0)
// ---------------------------------------------------------------------------

/**
 * Every flag of every command with its arity, fixed by name (12.0): 1 for a
 * flag taking the whole next token as its value, 0 for one taking none — the
 * flags the synopses and defining sections name (6, 8, 9, 10.7, 11, 12,
 * 13.5). A `--` token naming no flag of any command takes no value.
 */
const FLAG_ARITY = new Map([
  ["--json", 0],
  ["--preview", 0],
  ["--tree", 0],
  ["--text", 0],
  ["--check", 0],
  ["--unreferenced", 0],
  ["--config", 1],
  ["--test-hold", 1],
  ["--file", 1],
  ["--to", 1],
  ["--from", 1],
  ["--kinds", 1],
  ["--group", 1],
  ["--tag", 1],
  ["--coverage", 1],
  ["--base", 1],
  ["--strategy", 1],
  ["--name", 1],
  ["--status", 1],
  ["--note", 1],
]);

/** Every command of the product (12). */
const PRODUCT_COMMANDS = new Set([
  "build",
  "check",
  "ids",
  "show",
  "coverage",
  "impact",
  "review",
  "query",
  "occurrences",
  "view",
  "at",
  "inventory",
  "rename",
  "move",
  "version",
]);

/**
 * The commands whose every surface is JSON-only (SPEC 12.0: 11's `query`,
 * `occurrences`, `view`, `at`, and `inventory`; 12.6's `version`) — beside
 * 10.7's `review export`, a subcommand's surface.
 */
const JSON_ONLY_COMMANDS = new Set([
  "query",
  "occurrences",
  "view",
  "at",
  "inventory",
  "version",
]);

/**
 * Whether the invoked surface — the command word and, for `review`, its
 * subcommand, both among the non-flag tokens (12.0) — is JSON-only, a single
 * JSON document its only output form with or without `--json` (12.0).
 */
function isJsonOnlySurface(words) {
  const [command, subcommand] = words;
  return (
    JSON_ONLY_COMMANDS.has(command) ||
    (command === "review" && subcommand === "export")
  );
}

/**
 * The synopses this fixture judges (SPEC 11.1, 11.6, 12.1–12.3): for each
 * served command and each `query` subcommand, the flags its synopsis or
 * defining section names beside the globals `--json` and `--config` (12.0),
 * the flags it requires, and its operand count; `unservedFlags` names the
 * flags 12.3 gives `ids` that this fixture does not serve. A command outside
 * this map and `query` (`show`, `view`, …) is refused once the checks the
 * arguments decide for every command have passed, and every `query`
 * subcommand once its synopsis has.
 */
const SYNOPSES = new Map([
  ["build", { flags: [], operands: 0 }],
  ["check", { flags: [], operands: 0 }],
  [
    "ids",
    {
      flags: ["--tree", "--file", "--unreferenced"],
      operands: 0,
      unservedFlags: ["--tree", "--file", "--unreferenced"],
    },
  ],
  ["inventory", { flags: [], operands: 0 }],
]);

const QUERY_SYNOPSES = new Map([
  ["node", { flags: [], operands: 1 }],
  [
    "nodes",
    { flags: ["--group", "--file", "--tag", "--coverage"], operands: 0 },
  ],
  ["edges", { flags: ["--from", "--to", "--kinds"], operands: 0 }],
  ["subtree", { flags: [], operands: 1 }],
  ["ancestors", { flags: [], operands: 1 }],
  [
    "reachable",
    {
      flags: ["--from", "--to", "--kinds"],
      required: ["--from", "--to"],
      operands: 0,
    },
  ],
]);

/**
 * An argument value is malformed when it is not valid UTF-8 or contains
 * U+FFFD (SPEC 12.0); Node decodes argv lossily, an ill-formed byte arriving
 * as U+FFFD, so the one test covers both.
 */
function isMalformedValue(value) {
  return value.includes(REPLACEMENT_CHARACTER);
}

/**
 * Read the arguments under the grammar of SPEC 12.0: flag tokens anywhere —
 * before the command word, between it and its operands, or after them — a
 * value-taking flag taking the whole next token, whatever it looks like, and
 * `--` ending flag reading (dropped; every later token a non-flag token).
 * Returns the flags (name to value, `true` for a flag taking none), the
 * remaining non-flag tokens in order — the command, `query`'s subcommand,
 * then the operands — whether a `--json` token was read as a flag (never as
 * another flag's value), and the first syntax-class error met that the
 * arguments decide for every command alike, if any.
 */
function readInvocation(argv) {
  const flags = new Map();
  const words = [];
  let json = false;
  let error = null;
  const note = (message) => {
    if (error === null) error = message;
  };
  let flagsEnded = false;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!flagsEnded && token === "--") {
      flagsEnded = true;
      continue;
    }
    if (!flagsEnded && token.startsWith("--")) {
      if (token === "--json") json = true;
      if (flags.has(token)) {
        note(
          `repeated flag ${token}: a flag may be given at most once (SPEC 12.0)`,
        );
      }
      if (FLAG_ARITY.get(token) === 1) {
        if (i + 1 >= argv.length) {
          note(`flag ${token} lacks its value (SPEC 12.0)`);
          flags.set(token, true);
        } else {
          i += 1;
          const value = argv[i];
          if (isMalformedValue(value)) {
            note(
              `malformed value for ${token}: not valid UTF-8, or containing U+FFFD (SPEC 12.0)`,
            );
          }
          flags.set(token, value);
        }
      } else {
        if (!FLAG_ARITY.has(token)) note(`unknown flag ${token} (SPEC 12.0)`);
        flags.set(token, true);
      }
      continue;
    }
    if (isMalformedValue(token)) {
      note(
        "malformed argument: not valid UTF-8, or containing U+FFFD (SPEC 12.0)",
      );
    }
    words.push(token);
  }
  return { flags, words, json, error };
}

/**
 * The synopsis checks of SPEC 12.0's syntax class for one command or `query`
 * subcommand (`spelled`): every flag given is one it accepts — its
 * synopsis's or defining section's, or the global `--json` and `--config`
 * (`--test-hold` belongs to the mutating commands alone, 13.5, none of them
 * served here) — the operands match its synopsis in number, and its
 * required flags are given.
 */
function checkSynopsis(spelled, synopsis, flags, operands) {
  for (const name of flags.keys()) {
    if (
      name !== "--json" &&
      name !== "--config" &&
      !synopsis.flags.includes(name)
    ) {
      throw new UsageError(`unknown flag ${name} for ${spelled} (SPEC 12.0)`);
    }
  }
  if (operands.length < synopsis.operands) {
    throw new UsageError(`${spelled}: missing operand (SPEC 12.0)`);
  }
  if (operands.length > synopsis.operands) {
    throw new UsageError(
      `surplus operand ${operands[synopsis.operands]}: ${spelled} takes ${String(synopsis.operands)} operand(s) (SPEC 12.0)`,
    );
  }
  for (const name of synopsis.required ?? []) {
    if (!flags.has(name)) {
      throw new UsageError(
        `${spelled}: missing required flag ${name} (SPEC 11.1, 12.0)`,
      );
    }
  }
}

/**
 * Whether a glob lies outside the workspace root, decided by its spelling
 * alone (SPEC 7; for `--file`, 11 and 12.3): a leading `/`, or a depth
 * falling below zero — `..` lowering it, `.`, an empty segment, and `**`
 * leaving it, every other segment raising it.
 */
function globOutsideRoot(glob) {
  if (glob.startsWith("/")) return true;
  let depth = 0;
  for (const segment of glob.split("/")) {
    if (segment === "..") {
      depth -= 1;
      if (depth < 0) return true;
    } else if (segment !== "." && segment !== "" && segment !== "**") {
      depth += 1;
    }
  }
  return false;
}

/**
 * `ids --file`'s outside-root rule (SPEC 7, 12.3, 12.0): an invalid flag
 * value of the syntax class, decided by the pattern's spelling alone.
 */
function checkFileGlob(flag, value) {
  if (globOutsideRoot(value)) {
    throw new UsageError(
      `invalid ${flag} value ${JSON.stringify(value)}: the pattern lies outside the workspace root (SPEC 7, 12.3, 12.0)`,
    );
  }
}

/** The four edge kinds (SPEC 5.2): `query edges --kinds`' vocabulary. */
const EDGE_KINDS = new Set(["contains", "depends", "embeds", "references"]);

/** The three dependency kinds (SPEC 5.2): `query reachable --kinds`'. */
const DEPENDENCY_KINDS = new Set(["depends", "embeds", "references"]);

/**
 * A `<node>` or `<graph-node>` spelling's syntax (SPEC 1.5, 4.6, 12.0): at
 * most one `#`, a non-empty path part, and, with a `#`, a non-empty part
 * after it — judged from the argument alone, before configuration loads.
 */
function checkNodeSpelling(spelled, what, value) {
  const parts = value.split("#");
  if (parts.length > 2 || parts[0] === "" || parts[1] === "") {
    throw new UsageError(
      `${spelled}: malformed ${what} ${JSON.stringify(value)} (SPEC 1.5, 12.0)`,
    );
  }
}

/**
 * A `--kinds` list (SPEC 11.1, 12.0): comma-separated elements drawn from
 * the subcommand's vocabulary; an empty element — a leading, trailing, or
 * doubled comma — or one outside it is an invalid flag value.
 */
function checkKinds(spelled, value, vocabulary) {
  for (const element of value.split(",")) {
    if (!vocabulary.has(element)) {
      throw new UsageError(
        `${spelled}: invalid --kinds value ${JSON.stringify(value)} (SPEC 11.1, 12.0)`,
      );
    }
  }
}

/** The names 1.4 bars as an ID segment or tag. */
const BARRED_NAMES = new Set([
  "$",
  "__proto__",
  "prototype",
  "constructor",
  "then",
]);

/**
 * Whether a spelling is a well-formed tag (SPEC 1.4, 2.6): non-empty, no
 * control character or whitespace, none of `#`, the quotes, the backslash,
 * `&`, U+2028, U+2029, or U+FFFD, and no barred name (`.` is admitted).
 */
function isWellFormedTag(value) {
  if (value === "" || BARRED_NAMES.has(value)) return false;
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code <= 0x20 || code === 0x7f) return false;
    if (
      [
        "#",
        '"',
        "'",
        BACKSLASH,
        "&",
        LINE_SEPARATOR,
        PARAGRAPH_SEPARATOR,
      ].includes(char) ||
      char === REPLACEMENT_CHARACTER
    ) {
      return false;
    }
  }
  return true;
}

/**
 * The value spellings of `query`'s flags and operands that SPEC 12.0 puts in
 * the syntax class (11.1): identities with at most one `#`, `--kinds`
 * against its subcommand's vocabulary, `--coverage` against `required` and
 * `none`, `--tag` as a well-formed tag, and `--file`'s outside-root rule.
 */
function checkQueryValues(spelled, subcommand, flags, operands) {
  for (const operand of operands) checkNodeSpelling(spelled, "node", operand);
  for (const name of ["--from", "--to"]) {
    if (flags.has(name)) {
      checkNodeSpelling(spelled, `${name} graph node`, flags.get(name));
    }
  }
  if (flags.has("--kinds")) {
    checkKinds(
      spelled,
      flags.get("--kinds"),
      subcommand === "reachable" ? DEPENDENCY_KINDS : EDGE_KINDS,
    );
  }
  if (flags.has("--coverage")) {
    const value = flags.get("--coverage");
    if (value !== "required" && value !== "none") {
      throw new UsageError(
        `${spelled}: invalid --coverage value ${JSON.stringify(value)}: required or none (SPEC 11.1, 12.0)`,
      );
    }
  }
  if (flags.has("--tag") && !isWellFormedTag(flags.get("--tag"))) {
    throw new UsageError(
      `${spelled}: malformed --tag value ${JSON.stringify(flags.get("--tag"))} (SPEC 1.4, 11.1, 12.0)`,
    );
  }
  if (flags.has("--file")) checkFileGlob("--file", flags.get("--file"));
}

// ---------------------------------------------------------------------------
// Filesystem occupants (SPEC 13.4: judged at the path itself, never through
// a symbolic link)
// ---------------------------------------------------------------------------

/**
 * The kind of a path's occupant, read with lstat: "dir", "file", "symlink",
 * "other", or "absent". A path below a non-directory component reads as
 * absent (ENOTDIR); `occupantKind` walks a workspace path's components.
 */
async function lstatKind(absPath) {
  try {
    const stats = await fsp.lstat(absPath);
    if (stats.isDirectory()) return "dir";
    if (stats.isFile()) return "file";
    if (stats.isSymbolicLink()) return "symlink";
    return "other";
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return "absent";
    throw error;
  }
}

/** A workspace-relative path's absolute form under the root. */
function absUnder(rootAbs, rel) {
  return path.join(rootAbs, ...rel.split("/"));
}

/**
 * The occupant of a workspace-relative path as 13.4's reads judge it: below
 * a workspace-relative directory component that is absent or occupied by
 * anything other than a directory — a symbolic link included, whatever it
 * targets — nothing is read, the path holding nothing ("absent").
 */
async function occupantKind(rootAbs, rel) {
  const segments = rel.split("/");
  for (let i = 1; i < segments.length; i += 1) {
    const component = segments.slice(0, i).join("/");
    if ((await lstatKind(absUnder(rootAbs, component))) !== "dir") {
      return "absent";
    }
  }
  return lstatKind(absUnder(rootAbs, rel));
}

/**
 * A plain workspace-relative path (1.5, 7.3): one or more non-empty
 * `/`-separated segments, none `.` or `..`.
 */
function isPlainRelativePath(value) {
  return (
    typeof value === "string" &&
    value !== "" &&
    value.split("/").every((s) => s !== "" && s !== "." && s !== "..")
  );
}

/** Valid UTF-8 text, or null; a byte-order mark is kept as a character. */
function decodeUtf8(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return null;
  }
}

/** Whether the bytes begin with a UTF-8 byte-order mark (EF BB BF). */
function beginsWithBom(bytes) {
  return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

// ---------------------------------------------------------------------------
// Configuration (SPEC 7): location, declarative parse, validation
// ---------------------------------------------------------------------------

const CONFIG_NAME = "xspec.config.ts";

/**
 * The anchoring form of SPEC 11.6 and 14: `absPath` relative to the working
 * directory, `/`-joined, `.` for the working directory itself — both
 * entering as physical paths, which the caller resolves (11.6); where no
 * relative path exists (roots on different Windows drives), the platform's
 * absolute form as given.
 */
function anchoringPath(cwdReal, absPath) {
  const rel = path.relative(cwdReal, absPath);
  if (rel === "") return ".";
  if (path.isAbsolute(rel)) return rel;
  return rel.split(path.sep).join("/");
}

/**
 * Locate, read, parse, and validate the configuration (SPEC 7, 14.14). The
 * configuration file is the occupant of the path the upward search finds —
 * the nearest directory, the working directory first, holding an entry named
 * `xspec.config.ts`, whatever occupies it — or the path `--config` names,
 * resolved against the working directory, and is read only when it is a
 * plain file. Every defect is one configuration error concerning that path
 * in the anchoring form; a `--config` path nothing occupies is reported as
 * given, and missing configuration with no `--config` as `.` (14).
 */
async function loadConfig(cwd, configFlag) {
  const cwdAbs = path.resolve(cwd);
  let configPath;
  if (configFlag !== undefined) {
    configPath = path.resolve(cwdAbs, configFlag);
    if ((await lstatKind(configPath)) === "absent") {
      throw new UsageError(
        `configuration error: --config ${configFlag} names nothing (SPEC 7, 14.14)`,
        { code: "configuration-error", path: configFlag },
      );
    }
  } else {
    let dir = cwdAbs;
    for (;;) {
      const candidate = path.join(dir, CONFIG_NAME);
      if ((await lstatKind(candidate)) !== "absent") {
        configPath = candidate;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        throw new UsageError(
          `configuration error: no ${CONFIG_NAME} found by upward search from the working directory (SPEC 7, 14.14)`,
          { code: "configuration-error", path: "." },
        );
      }
      dir = parent;
    }
  }
  const cwdReal = await fsp.realpath(cwdAbs);
  const rootReal = await fsp.realpath(path.dirname(configPath));
  const configAnchor = anchoringPath(
    cwdReal,
    path.join(rootReal, path.basename(configPath)),
  );
  const configError = (what) =>
    new UsageError(`configuration error: ${what} (SPEC 7, 14.14)`, {
      code: "configuration-error",
      path: configAnchor,
    });
  if ((await lstatKind(configPath)) !== "file") {
    throw configError(
      "the configuration path holds something other than a plain file",
    );
  }
  let bytes;
  try {
    bytes = await fsp.readFile(configPath);
  } catch (error) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      throw configError("the configuration file cannot be read (14.25)");
    }
    throw error;
  }
  if (beginsWithBom(bytes)) {
    throw configError("the file begins with a byte-order mark");
  }
  const text = decodeUtf8(bytes);
  if (text === null) throw configError("the file is not valid UTF-8");
  const { data, specifier } = parseConfigText(text, configError);
  // The violators' one hook (module header): the specifier as read, judged
  // by the deviation switches alone, before validation as well-formedness
  // (14.20) precedes it. The conformer, every switch off, refuses nothing.
  const refusal = specifierRefusal(specifier);
  if (refusal !== null) throw configError(refusal);
  return {
    ...validateConfig(data, configError),
    root: path.dirname(configPath),
    rootAnchor: anchoringPath(cwdReal, rootReal),
    configAnchor,
    configError,
  };
}

/** ECMAScript whitespace and line terminators, between tokens (14.20). */
function isConfigSpace(c) {
  return CONFIG_SPACE.has(c.codePointAt(0));
}

function isLineTerminator(c) {
  return (
    c === LF || c === CR || c === LINE_SEPARATOR || c === PARAGRAPH_SEPARATOR
  );
}

const WORD_PATTERN = /[A-Za-z_$][A-Za-z0-9_$]*/y;

/**
 * Tokens of the declarative configuration (SPEC 7): punctuators, identifier
 * words, and static string literals, with whitespace and comments
 * contributing nothing. A string literal runs from its quote character to
 * the next same quote not taken by a backslash: a backslash takes the
 * character after it with it — a carriage return and line feed pair whole,
 * so a line continuation after any line terminator stays inside — and a raw
 * line feed or carriage return ends no literal but is refused, as
 * TypeScript refuses it. The token's value is the characters between the
 * delimiters exactly as spelled, no escape sequence interpreted (2.4), and
 * the token keeps its quote character.
 */
function tokenizeConfig(text, configError) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (isConfigSpace(c)) {
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      i += 2;
      while (i < text.length && !isLineTerminator(text[i])) i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end === -1) throw configError("an unterminated block comment");
      i = end + 2;
      continue;
    }
    if ("{}[](),:;".includes(c)) {
      tokens.push({ type: "punct", value: c });
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) {
        if (text[j] === LF || text[j] === CR) {
          throw configError("a line break inside a string literal");
        }
        if (text[j] === BACKSLASH) {
          j += text[j + 1] === CR && text[j + 2] === LF ? 3 : 2;
        } else {
          j += 1;
        }
      }
      if (j >= text.length) throw configError("an unterminated string literal");
      tokens.push({ type: "string", quote: c, value: text.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    WORD_PATTERN.lastIndex = i;
    const word = WORD_PATTERN.exec(text);
    if (word !== null) {
      tokens.push({ type: "word", value: word[0] });
      i += word[0].length;
      continue;
    }
    throw configError(
      `unexpected character at offset ${String(i)}: only the declarative form is admitted`,
    );
  }
  return tokens;
}

/**
 * Parse the declarative configuration (SPEC 7): exactly an import of
 * `defineConfig` (optionally aliased; no `type` or `defer` modifier, no
 * import attributes) whose module specifier is any static string literal
 * (2.4), and a default export of one call to that binding whose sole
 * argument is statically literal — object literals with non-computed
 * identifier or string-literal keys (a key repeated within one object a
 * configuration error), array literals, static string literals, and
 * `true`/`false`. Objects are returned as Maps, in spelling order. The
 * specifier is returned as read — its quote character and its spelled
 * characters — and given no meaning (module header).
 */
function parseConfigText(text, configError) {
  const tokens = tokenizeConfig(text, configError);
  let i = 0;
  const peekIs = (type, value) =>
    tokens[i] !== undefined &&
    tokens[i].type === type &&
    (value === undefined || tokens[i].value === value);
  const take = (type, value, what) => {
    if (!peekIs(type, value)) throw configError(`expected ${what}`);
    const token = tokens[i];
    i += 1;
    return token;
  };
  take("word", "import", "the import of defineConfig");
  take("punct", "{", '"{" in the import of defineConfig');
  take("word", "defineConfig", "the name defineConfig");
  let binding = "defineConfig";
  if (peekIs("word", "as")) {
    i += 1;
    binding = take("word", undefined, "the import's alias").value;
  }
  if (peekIs("punct", ",")) i += 1;
  take("punct", "}", '"}" in the import of defineConfig');
  take("word", "from", '"from"');
  // The module specifier: any static string literal token, read as spelled
  // and never decoded, interpreted, resolved, or loaded (SPEC 7;
  // CERTIFICATIONS.md preamble). A spelling TypeScript's scanner rejects is
  // accepted too: 14.20 is judged on its accepting side alone (S-9).
  const specifierToken = take(
    "string",
    undefined,
    "the module specifier, a static string literal",
  );
  if (peekIs("punct", ";")) i += 1;
  take("word", "export", "the default export");
  take("word", "default", '"default"');
  take("word", binding, `a call of ${binding}`);
  take("punct", "(", `"(" after ${binding}`);
  const parseValue = () => {
    if (peekIs("string")) return take("string", undefined, "a string").value;
    if (peekIs("word", "true") || peekIs("word", "false")) {
      return take("word", undefined, "a boolean").value === "true";
    }
    if (peekIs("punct", "{")) {
      i += 1;
      const object = new Map();
      while (!peekIs("punct", "}")) {
        const key = peekIs("string")
          ? take("string", undefined, "a key").value
          : take("word", undefined, "an object key").value;
        if (object.has(key)) {
          throw configError(`the key ${JSON.stringify(key)} is repeated`);
        }
        take("punct", ":", `":" after the key ${JSON.stringify(key)}`);
        object.set(key, parseValue());
        if (!peekIs("punct", ",")) break;
        i += 1;
      }
      take("punct", "}", '"}" closing an object literal');
      return object;
    }
    if (peekIs("punct", "[")) {
      i += 1;
      const array = [];
      while (!peekIs("punct", "]")) {
        array.push(parseValue());
        if (!peekIs("punct", ",")) break;
        i += 1;
      }
      take("punct", "]", '"]" closing an array literal');
      return array;
    }
    throw configError(
      "expected a static literal: an object, array, string, or boolean",
    );
  };
  const value = parseValue();
  if (peekIs("punct", ",")) i += 1;
  take("punct", ")", `")" closing the call of ${binding}`);
  if (peekIs("punct", ";")) i += 1;
  if (i !== tokens.length) {
    throw configError("content after the default export");
  }
  if (!(value instanceof Map)) {
    throw configError("defineConfig takes one object literal");
  }
  return {
    data: value,
    specifier: { quote: specifierToken.quote, spelled: specifierToken.value },
  };
}

/** A braced Unicode escape's code point digits: one or more hex digits. */
const HEX_DIGITS = /^[0-9A-Fa-f]+$/;

/**
 * Whether a specifier's spelled characters hold a braced Unicode escape (a
 * backslash, `u`, and a code point's hex digits in braces) of a code point
 * at or below U+FFFF, leading zeros and surrogates included
 * (VIOL-IMPORT-BRACED). The characters are read left to right as the grammar
 * 14.20 fixes reads them, as the tokenizer does: a backslash begins an
 * escape sequence and takes the character after it with it (a carriage
 * return and line feed pair whole), so a braced escape begins only at a
 * backslash that itself begins an escape and is followed by `u{` — never at
 * one a preceding backslash escapes, after which `u{…}` is ordinary
 * characters — and every other escape is passed over whole or read on as
 * ordinary characters, which begin none.
 */
function spellsBracedEscapeAtOrBelowFfff(spelled) {
  let i = 0;
  while (i < spelled.length) {
    if (spelled[i] !== BACKSLASH) {
      i += 1;
      continue;
    }
    if (spelled[i + 1] === "u" && spelled[i + 2] === "{") {
      const close = spelled.indexOf("}", i + 3);
      const digits = close === -1 ? "" : spelled.slice(i + 3, close);
      if (HEX_DIGITS.test(digits) && Number.parseInt(digits, 16) <= 0xffff) {
        return true;
      }
    }
    i += spelled[i + 1] === CR && spelled[i + 2] === LF ? 3 : 2;
  }
  return false;
}

/**
 * The violators' one hook (module header): the configuration error (14.14)
 * a deviation switch makes of the configuration's import specifier as read —
 * its quote character and its spelled characters — or null, which the
 * conformer, every switch off, always returns.
 * - `refuseBracedEscapes` (VIOL-IMPORT-BRACED): a specifier spelling a
 *   braced Unicode escape of a code point at or below U+FFFF is judged not
 *   well-formed TypeScript (14.20); a braced escape above U+FFFF, the
 *   four-digit form, every other escape, line continuations, both quote
 *   styles, and every other spelling are read as the conformer reads them.
 * - `refuseSingleQuotes` (VIOL-IMPORT-SINGLE): a single-quoted specifier is
 *   refused, the import read only where its specifier is double-quoted; a
 *   double-quoted specifier, whatever it holds, and every other literal of
 *   the configuration are read as the conformer reads them.
 */
function specifierRefusal(specifier) {
  if (
    deviations.refuseBracedEscapes &&
    spellsBracedEscapeAtOrBelowFfff(specifier.spelled)
  ) {
    return "the module specifier is not a well-formed string literal: a braced Unicode escape of a code point at or below U+FFFF";
  }
  if (deviations.refuseSingleQuotes && specifier.quote === "'") {
    return "the module specifier must be a double-quoted string literal";
  }
  return null;
}

/** One group map (7.1, 7.2): named lists of globs, in configuration order. */
function validatedGroups(value, section, configError) {
  if (!(value instanceof Map)) {
    throw configError(`${section} must be an object literal of named groups`);
  }
  const groups = [];
  for (const [name, globs] of value) {
    if (name === "") throw configError(`an empty ${section} group name`);
    if (name.includes(REPLACEMENT_CHARACTER)) {
      throw configError(`a ${section} group name containing U+FFFD`);
    }
    if (!Array.isArray(globs) || globs.some((g) => typeof g !== "string")) {
      throw configError(
        `the ${section} group ${JSON.stringify(name)} must be a list of glob strings`,
      );
    }
    for (const glob of globs) {
      if (globOutsideRoot(glob)) {
        throw configError(
          `the glob ${JSON.stringify(glob)} lies outside the workspace root`,
        );
      }
    }
    groups.push({ name, globs });
  }
  return groups;
}

/**
 * Validate the parsed configuration (SPEC 7, 7.1–7.3): `specs` required;
 * unknown keys anywhere a configuration error; `markdown.emit` a required
 * boolean and `markdown.outDir` a plain workspace-relative path outside the
 * graph-data area. A code group, a `coverage` profile, and a `policy` rule
 * are outside this fixture's scope (an empty `code` map and empty lists
 * equal omission, 7).
 */
function validateConfig(data, configError) {
  const known = ["specs", "code", "markdown", "coverage", "policy"];
  for (const key of data.keys()) {
    if (!known.includes(key)) {
      throw configError(`the key ${JSON.stringify(key)} is unknown`);
    }
  }
  if (!data.has("specs")) throw configError("`specs` is required");
  const specGroups = validatedGroups(data.get("specs"), "specs", configError);
  if (data.has("code")) {
    const codeGroups = validatedGroups(data.get("code"), "code", configError);
    if (codeGroups.length > 0) {
      throw new ScopeError(
        "a code group is outside this fixture's scope (CERTIFICATIONS.md §CONF-IMPORT: no code group)",
      );
    }
  }
  for (const key of ["coverage", "policy"]) {
    if (!data.has(key)) continue;
    const value = data.get(key);
    if (!Array.isArray(value))
      throw configError(`the key ${key} must be a list`);
    if (value.length > 0) {
      throw new ScopeError(
        `the configuration key ${key} is outside this fixture's scope (CERTIFICATIONS.md §CONF-IMPORT: no coverage or policy)`,
      );
    }
  }
  let emit = false;
  let outDir = null;
  if (data.has("markdown")) {
    const markdown = data.get("markdown");
    if (!(markdown instanceof Map)) {
      throw configError("`markdown` must be an object literal");
    }
    for (const key of markdown.keys()) {
      if (key !== "emit" && key !== "outDir") {
        throw configError(`the key markdown.${key} is unknown`);
      }
    }
    if (typeof markdown.get("emit") !== "boolean") {
      throw configError("markdown.emit is required and must be true or false");
    }
    emit = markdown.get("emit");
    if (markdown.has("outDir")) {
      const value = markdown.get("outDir");
      if (!isPlainRelativePath(value)) {
        throw configError(
          "markdown.outDir must be one or more non-empty segments, none . or .., with no leading /",
        );
      }
      if (value === ".xspec" || value.startsWith(".xspec/")) {
        throw configError("markdown.outDir lies in the graph-data area .xspec");
      }
      outDir = value;
    }
  }
  return { specGroups, emit, outDir };
}

// ---------------------------------------------------------------------------
// Discovery (SPEC 7, 13.4)
// ---------------------------------------------------------------------------

const DOT = 0x2e;
const STAR = 0x2a;
const QUESTION = 0x3f;

/** One pattern segment against one path segment, byte-wise (SPEC 7). */
function segmentMatches(pattern, name) {
  const p = Buffer.from(pattern, "utf8");
  const s = Buffer.from(name, "utf8");
  // A path segment beginning with `.` is matched only by a pattern segment
  // written with a leading `.` (SPEC 7).
  if (s[0] === DOT && p[0] !== DOT) return false;
  const match = (i, j) => {
    if (i === p.length) return j === s.length;
    if (p[i] === STAR) {
      for (let k = j; k <= s.length; k += 1) {
        if (match(i + 1, k)) return true;
      }
      return false;
    }
    if (j === s.length) return false;
    if (p[i] === QUESTION || p[i] === s[j]) return match(i + 1, j + 1);
    return false;
  };
  return match(0, 0);
}

/**
 * Glob matching (SPEC 7): `*` any possibly empty byte run within a segment,
 * `?` one byte, `**` — as a whole pattern segment only — any number of
 * whole segments including none (never a dot-initial one), every other
 * character a literal; `.`, `..`, and empty pattern segments match nothing,
 * since no discovered path carries such a segment.
 */
function globMatches(glob, rel) {
  const patterns = glob.split("/");
  const names = rel.split("/");
  const match = (i, j) => {
    if (i === patterns.length) return j === names.length;
    if (patterns[i] === "**") {
      if (match(i + 1, j)) return true;
      for (let k = j; k < names.length; k += 1) {
        if (names[k].startsWith(".")) return false;
        if (match(i + 1, k + 1)) return true;
      }
      return false;
    }
    if (j === names.length) return false;
    return segmentMatches(patterns[i], names[j]) && match(i + 1, j + 1);
  };
  return match(0, 0);
}

/** Whether a pattern segment can match a path segment at all (SPEC 7). */
function segmentSatisfiable(segment) {
  return segment !== "" && segment !== "." && segment !== "..";
}

/**
 * Whether `glob` matches some path below the directory `dirRel` (workspace-
 * relative, `""` for the root): the condition under which discovery lists
 * that directory (SPEC 7).
 */
function globReachesBelow(glob, dirRel) {
  const patterns = glob.split("/");
  const names = dirRel === "" ? [] : dirRel.split("/");
  const below = (i, j) => {
    if (j === names.length) {
      const rest = patterns.slice(i);
      return (
        rest.length > 0 &&
        rest.every((segment) => segment === "**" || segmentSatisfiable(segment))
      );
    }
    if (i === patterns.length) return false;
    if (patterns[i] === "**") {
      if (below(i + 1, j)) return true;
      if (names[j].startsWith(".")) return false;
      return below(i, j + 1);
    }
    return segmentMatches(patterns[i], names[j]) && below(i + 1, j + 1);
  };
  return below(0, 0);
}

/**
 * The plain files the configured globs match (SPEC 7), workspace-relative —
 * the directory-entry names descending from the root, `/`-joined — in byte
 * order. Discovery lists the root, and a directory reached from it through
 * directories alone, exactly when a glob matches a path below it, `.xspec`
 * counting for none (13.4); it examines the kind of exactly those entries a
 * glob matches or that it would list were they directories, from the
 * listing itself. A symbolic link — to a file or a directory, broken or not
 * — is never discovered and never traversed, and no other non-plain kind is
 * a source.
 */
async function matchedFiles(config) {
  const globs = config.specGroups.flatMap((group) => group.globs);
  const files = [];
  const walk = async (dirRel) => {
    const dirAbs = dirRel === "" ? config.root : absUnder(config.root, dirRel);
    const entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      const rel = dirRel === "" ? entry.name : `${dirRel}/${entry.name}`;
      if (rel === ".xspec") continue;
      const matched = globs.some((glob) => globMatches(glob, rel));
      const reaches = globs.some((glob) => globReachesBelow(glob, rel));
      if (entry.isDirectory()) {
        if (reaches) await walk(rel);
      } else if (entry.isFile()) {
        if (matched) files.push(rel);
      }
    }
  };
  if (globs.some((glob) => globReachesBelow(glob, ""))) await walk("");
  return byteSorted(files);
}

/** A spec source's generated module path (13.1): `NAME.xspec.ts`. */
function modulePathOf(sourceRel) {
  return `${sourceRel.slice(0, -".mdx".length)}.xspec.ts`;
}

/** A spec source's Markdown emit destination (13.2, 7.3): `NAME.md`. */
function markdownPathOf(config, sourceRel) {
  const emitted = `${sourceRel.slice(0, -".mdx".length)}.md`;
  return config.outDir === null ? emitted : `${config.outDir}/${emitted}`;
}

/**
 * Discover the configured spec sources (SPEC 7, 13.4): the matched plain
 * files less the derived files — names containing `.xspec.`, paths under
 * `.xspec/`, and, while emission is enabled, the configured Markdown emit
 * destinations of the matched `.mdx` files (7.3), which exist by
 * configuration alone — each with the groups matching it, in configuration
 * order.
 */
async function discover(config) {
  const matches = [];
  for (const rel of await matchedFiles(config)) {
    const name = rel.slice(rel.lastIndexOf("/") + 1);
    if (name.includes(".xspec.") || rel.startsWith(".xspec/")) continue;
    const groups = config.specGroups
      .filter((group) => group.globs.some((glob) => globMatches(glob, rel)))
      .map((group) => group.name);
    matches.push({ rel, groups });
  }
  const emitDestinations = new Set();
  if (config.emit) {
    for (const match of matches) {
      if (match.rel.endsWith(".mdx")) {
        emitDestinations.add(markdownPathOf(config, match.rel));
      }
    }
  }
  const specSources = matches.filter((m) => !emitDestinations.has(m.rel));
  return {
    specSources,
    discovered: new Set(specSources.map((m) => m.rel)),
  };
}

// ---------------------------------------------------------------------------
// Sources in scope: trivial single-section `.mdx` on one line
// ---------------------------------------------------------------------------

/** A source's bytes as text: valid UTF-8 with no byte-order mark (1.6). */
function sourceText(rel, bytes) {
  if (beginsWithBom(bytes)) {
    throw new ScopeError(
      `${rel} begins with a byte-order mark: an unparseable source (14.20) is outside this fixture's scope`,
    );
  }
  const text = decodeUtf8(bytes);
  if (text === null) {
    throw new ScopeError(
      `${rel} is not valid UTF-8: an unparseable source (14.20) is outside this fixture's scope`,
    );
  }
  return text;
}

/** An ID segment in this fixture's scope: a subset of 1.4's valid ones. */
function isScopeSegment(id) {
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(id) && !BARRED_NAMES.has(id);
}

/**
 * Plain text on one line, as the scope's sections hold it: no control
 * character, no line terminator, none of `<`, `>`, `{`, `}`, `&`, the
 * backslash, or the backtick, and at least one character outside 1.4's
 * whitespace — so the line its tags stand on keeps content once they are
 * removed (3).
 */
function isPlainText(body) {
  let content = false;
  for (const char of body) {
    const code = char.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return false;
    if (char === LINE_SEPARATOR || char === PARAGRAPH_SEPARATOR) return false;
    if ("<>{}&".includes(char) || char === BACKSLASH || char === BACKTICK) {
      return false;
    }
    if (!SPEC_WHITESPACE.has(code)) content = true;
  }
  return content;
}

/**
 * The scope's spec source shape: one line holding `<S id="X">` (or
 * `<Spec id="X">`), plain text, and the matching closing tag, then at most
 * one line terminator (CR LF, LF, or CR) ending the file. Returns the
 * section's ID, its source range (1.7: the construct from its opening tag's
 * first byte through its closing tag's last), and the compiled Markdown
 * (3): both tags removed, the line keeping its text and its terminator.
 */
function parseTrivialSection(rel, bytes) {
  const text = sourceText(rel, bytes);
  const outOfScope = (why) =>
    new ScopeError(
      `${rel}: ${why} — this fixture's sources are trivial single-section .mdx files, one line holding the opening tag, plain text, and the closing tag (CERTIFICATIONS.md §CONF-IMPORT)`,
    );
  let terminator = "";
  for (const candidate of [CR + LF, LF, CR]) {
    if (text.endsWith(candidate)) {
      terminator = candidate;
      break;
    }
  }
  const line = text.slice(0, text.length - terminator.length);
  const open = /^<(S|Spec) id="([^"]*)">/.exec(line);
  if (open === null) throw outOfScope("no opening tag at the file's start");
  if (!isScopeSegment(open[2])) throw outOfScope(`the ID ${open[2]}`);
  const closing = `</${open[1]}>`;
  if (
    !line.endsWith(closing) ||
    line.length < open[0].length + closing.length
  ) {
    throw outOfScope("no matching closing tag ending the line");
  }
  const body = line.slice(open[0].length, line.length - closing.length);
  if (!isPlainText(body)) {
    throw outOfScope(`the text ${JSON.stringify(body)} is no plain text`);
  }
  return {
    id: open[2],
    range: { start: 0, end: Buffer.byteLength(line, "utf8") },
    markdown: body + terminator,
  };
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The generated module's bytes (13.1): the generated-file header naming the
 * source (4), and nothing the configuration spells — content beyond the
 * path is out of scope.
 */
function moduleContent(sourceRel) {
  return Buffer.from(
    `// Generated by xspec from ${sourceRel} (CONF-IMPORT fixture: module content beyond its path is out of scope).${LF}export {};${LF}`,
    "utf8",
  );
}

// ---------------------------------------------------------------------------
// Findings (SPEC 14, 12.7)
// ---------------------------------------------------------------------------

const CODE_TOKENS = new Map([
  [10, "stale-output"],
  [19, "invalid-source-path"],
  [22, "obstructed-write-path"],
  [23, "unreadable-record"],
]);

function finding(condition, concerned, message) {
  return { condition, path: concerned, message };
}

/**
 * The pinned findings order (12.7): by code — the numbered conditions in
 * numeric order — then locations (empty for every condition here), then
 * concerned path bytes, then identities (empty), then message; identical
 * findings collapse to one.
 */
function compareFindings(a, b) {
  if (a.condition !== b.condition) return a.condition - b.condition;
  const byPath = compareBytes(a.path, b.path);
  if (byPath !== 0) return byPath;
  return compareBytes(a.message, b.message);
}

/** The findings in the 12.7 finding form, ordered and collapsed. */
function findingForms(findings) {
  const sorted = [...findings].sort(compareFindings);
  return sorted
    .filter((f, i) => i === 0 || compareFindings(sorted[i - 1], f) !== 0)
    .map((f) => ({
      code: CODE_TOKENS.get(f.condition),
      message: f.message,
      locations: [],
      path: f.path,
      identities: [],
    }));
}

/**
 * A findings report (12.0, 12.7): with JSON output in effect the document
 * `{"findings": […]}`; without it one line per finding naming the path it
 * concerns, its code, and its message.
 */
function emitReport(io, json, findings) {
  const forms = findingForms(findings);
  if (json) {
    io.stdout(canonicalJson({ findings: forms }) + LF);
  } else {
    for (const f of forms) io.stdout(`${f.path}: ${f.code}: ${f.message}${LF}`);
  }
}

// ---------------------------------------------------------------------------
// The workspace model: sources, derived files, graph data
// ---------------------------------------------------------------------------

// The graph-data area (13.3), its durable paths (6.1, 10.1), and the lock
// path (13.5), as `inventory` reports them (11.6).
const GRAPH_DATA_AREA = ".xspec";
const JOURNAL_PATH = ".xspec/journal";
const SESSION_DIRECTORY = ".xspec/reviews";
const LOCK_PATH = ".xspec/lock";
// The fixture's graph-data layout, unenumerated to consumers (13.3): the
// graph, which a refresh rewrites, and the record of the derived paths
// generated, which only `build` writes.
const GRAPH_FILE = ".xspec/graph.json";
const RECORD_FILE = ".xspec/record.json";

/** Characters 7.1 bars from a spec source's path, beside `#` and U+FFFD. */
const SPEC_PATH_BARRED = [
  '"',
  "'",
  BACKSLASH,
  LF,
  CR,
  LINE_SEPARATOR,
  PARAGRAPH_SEPARATOR,
];

/**
 * A journal (6.1) and review sessions (10.1) are outside this fixture's
 * scope: a command whose answer would consult one refuses its presence.
 */
async function refuseDurableState(config, { sessions = false } = {}) {
  if ((await occupantKind(config.root, JOURNAL_PATH)) !== "absent") {
    throw new ScopeError(
      `a journal (${JOURNAL_PATH}) is outside this fixture's scope (CERTIFICATIONS.md §CONF-IMPORT; SPEC 6.1)`,
    );
  }
  if (
    sessions &&
    (await occupantKind(config.root, SESSION_DIRECTORY)) !== "absent"
  ) {
    throw new ScopeError(
      `review sessions (${SESSION_DIRECTORY}) are outside this fixture's scope (CERTIFICATIONS.md §CONF-IMPORT; SPEC 10.1)`,
    );
  }
}

/**
 * Discover, validate, and analyze the workspace: the 14.19 findings, the
 * derived files the current sources and configuration generate (each
 * `.mdx` spec source's module and, while emission is enabled, its
 * Markdown), and the graph as graph data holds it — the sources with their
 * groups, content hashes, and sections, nothing the configuration's import
 * spells.
 */
async function loadWorkspace(config) {
  const discovery = await discover(config);
  const findings = [];
  const derived = [];
  const sources = [];
  for (const source of discovery.specSources) {
    const rel = source.rel;
    if (!rel.endsWith(".mdx")) {
      // 14.19, but an invalid path masks nothing (14): the file's content
      // would be analyzed as a spec source's, which this fixture's reader of
      // one-line sections cannot do — refused, never answered in part.
      throw new ScopeError(
        `${rel} is in a spec group without the .mdx extension: such a source is outside this fixture's scope (CERTIFICATIONS.md §CONF-IMPORT; SPEC 7.1, 14.19)`,
      );
    }
    if (
      [REPLACEMENT_CHARACTER, "#", ...SPEC_PATH_BARRED].some((c) =>
        rel.includes(c),
      )
    ) {
      findings.push(
        finding(
          19,
          rel,
          `${rel} contains a character a spec source's path may not hold; rename it (SPEC 7, 7.1)`,
        ),
      );
    }
    const bytes = await fsp.readFile(absUnder(config.root, rel));
    const section = parseTrivialSection(rel, bytes);
    derived.push({ rel: modulePathOf(rel), content: moduleContent(rel) });
    if (config.emit) {
      derived.push({
        rel: markdownPathOf(config, rel),
        content: Buffer.from(section.markdown, "utf8"),
      });
    }
    sources.push({
      path: rel,
      kind: "spec",
      groups: source.groups,
      hash: sha256Hex(bytes),
      sections: [{ id: section.id, range: section.range }],
    });
  }
  derived.sort((a, b) => compareBytes(a.rel, b.rel));
  sources.sort((a, b) => compareBytes(a.path, b.path));
  return {
    findings,
    derived,
    generated: new Set(derived.map((d) => d.rel)),
    discovered: discovery.discovered,
    graph: { sources },
  };
}

/**
 * 14.22 over `build`'s write paths (the derived files generated and graph
 * data), as `build`, `check`, and the gate of 13.3 alike judge them: each
 * workspace-relative directory component occupied by anything other than a
 * directory, and each module or Markdown path that is a directory component
 * of another write path or of a discovered source's path — one finding per
 * offending path.
 */
async function obstructionFindings(config, ws) {
  const writePaths = [...ws.derived.map((d) => d.rel), GRAPH_FILE, RECORD_FILE];
  const offending = new Set();
  for (const rel of writePaths) {
    const segments = rel.split("/");
    for (let i = 1; i < segments.length; i += 1) {
      const component = segments.slice(0, i).join("/");
      const kind = await lstatKind(absUnder(config.root, component));
      if (kind === "absent") break;
      if (kind !== "dir") {
        offending.add(component);
        break;
      }
    }
  }
  const others = [...writePaths, ...ws.discovered];
  for (const item of ws.derived) {
    if (others.some((o) => o.startsWith(`${item.rel}/`))) {
      offending.add(item.rel);
    }
  }
  return [...offending].map((rel) =>
    finding(
      22,
      rel,
      `${rel} obstructs a path xspec writes: a directory component must be a directory, and a derived path no other write's or source's directory; move or delete what occupies it (SPEC 13.4)`,
    ),
  );
}

/** The graph's bytes as graph data holds them (13.3). */
function graphBytes(ws) {
  return Buffer.from(canonicalJson(ws.graph) + LF, "utf8");
}

/** The record's bytes: the derived paths generated, in byte order (13.3). */
function recordBytes(ws) {
  return Buffer.from(
    canonicalJson({ derivedFiles: byteSorted(ws.generated) }) + LF,
    "utf8",
  );
}

/**
 * Whether the plain file at a workspace-relative path holds exactly
 * `content`, judged at the path itself (13.4, 14.10): a symbolic link, a
 * directory, any other occupant, a path below a non-directory component,
 * and a file whose content the environment refuses are not.
 */
async function holdsExactly(config, rel, content) {
  if ((await occupantKind(config.root, rel)) !== "file") return false;
  try {
    return (
      Buffer.compare(
        await fsp.readFile(absUnder(config.root, rel)),
        content,
      ) === 0
    );
  } catch (error) {
    if (error.code === "EACCES" || error.code === "EPERM") return false;
    throw error;
  }
}

/**
 * The recorded generation state (13.3, 14.23): "empty" where none exists —
 * the area absent, or a directory holding no record; "unreadable" where
 * state exists that cannot be read as a record — the area's own path held
 * by a non-directory, a record that is no plain file, refuses its read, or
 * does not decode; "readable" otherwise, with the recorded paths in byte
 * order.
 */
async function readRecord(config) {
  const areaKind = await lstatKind(absUnder(config.root, GRAPH_DATA_AREA));
  if (areaKind === "absent") return { state: "empty", paths: [] };
  if (areaKind !== "dir") return { state: "unreadable" };
  const recordAbs = absUnder(config.root, RECORD_FILE);
  const recordKind = await lstatKind(recordAbs);
  if (recordKind === "absent") return { state: "empty", paths: [] };
  if (recordKind !== "file") return { state: "unreadable" };
  let doc;
  try {
    const text = decodeUtf8(await fsp.readFile(recordAbs));
    doc = text === null ? null : JSON.parse(text);
  } catch {
    return { state: "unreadable" };
  }
  if (
    doc === null ||
    typeof doc !== "object" ||
    Array.isArray(doc) ||
    !Array.isArray(doc.derivedFiles) ||
    !doc.derivedFiles.every(isPlainRelativePath)
  ) {
    return { state: "unreadable" };
  }
  return { state: "readable", paths: byteSorted(new Set(doc.derivedFiles)) };
}

// ---------------------------------------------------------------------------
// Derived-file writes and 13.4's removal of recorded paths no longer
// generated
// ---------------------------------------------------------------------------

/**
 * The occupant 13.4's removal judges for a recorded path: below a
 * workspace-relative directory component that is absent or occupied by
 * anything other than a directory, nothing is read — the path holds
 * nothing; otherwise the path's own occupant, judged itself (lstat).
 */
async function recordedOccupant(config, rel) {
  return {
    kind: await occupantKind(config.root, rel),
    abs: absUnder(config.root, rel),
  };
}

/**
 * Whether the removal removes the occupant (13.4): anything but a directory
 * or a discovered source; a path holding nothing is left as it is.
 */
function isRemovable(occupant, rel, ws) {
  return (
    occupant.kind !== "absent" &&
    occupant.kind !== "dir" &&
    !ws.discovered.has(rel)
  );
}

/**
 * Remove a recorded path no longer generated (13.4): its occupant, where
 * removable, unlinked — a symbolic link as the link itself, never its
 * target; anything else left as it is, the removal making no write.
 */
async function removeRecorded(config, rel, ws) {
  const occupant = await recordedOccupant(config, rel);
  if (isRemovable(occupant, rel, ws)) await fsp.unlink(occupant.abs);
}

/**
 * A directory at a path `build` or a refresh writes: replacing it would
 * remove everything it holds (13.4), which no staging in this fixture's
 * scope calls for — refused loudly before any write.
 */
async function refuseDirectoryOccupants(config, rels) {
  for (const rel of rels) {
    if ((await occupantKind(config.root, rel)) === "dir") {
      throw new ScopeError(
        `a directory occupies the derived path ${rel}: replacing it is outside this fixture's scope (CERTIFICATIONS.md §CONF-IMPORT; SPEC 13.4)`,
      );
    }
  }
}

/**
 * Write one derived file (13.4): the path's occupant — a plain file, a
 * symbolic link as the link itself, or any other non-directory — is
 * replaced, missing directories are created, and nothing is written
 * through a link (the exclusive create fails rather than follow anything
 * left there).
 */
async function writeDerived(config, rel, content) {
  const abs = absUnder(config.root, rel);
  if ((await lstatKind(abs)) !== "absent") await fsp.unlink(abs);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, content, { flag: "wx" });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * `xspec build` (12.1): on validation findings (14.19, 14.22) exit 1,
 * modifying nothing; otherwise write every derived file, remove the
 * recorded paths no longer generated (13.4; an unreadable or empty record
 * names none — such orphans lie outside xspec's knowledge), then write
 * graph data: the graph, and last the record of the paths generated (13.3).
 */
async function commandBuild(io, cwd, flags, json) {
  const config = await loadConfig(cwd, flags.get("--config"));
  await refuseDurableState(config);
  const ws = await loadWorkspace(config);
  const findings = [...ws.findings, ...(await obstructionFindings(config, ws))];
  if (findings.length > 0) throw new FindingsError(findings);
  await refuseDirectoryOccupants(config, [
    ...ws.generated,
    GRAPH_FILE,
    RECORD_FILE,
  ]);
  const record = await readRecord(config);
  for (const item of ws.derived) {
    await writeDerived(config, item.rel, item.content);
  }
  if (record.state === "readable") {
    for (const rel of record.paths) {
      if (!ws.generated.has(rel)) await removeRecorded(config, rel, ws);
    }
  }
  await writeDerived(config, GRAPH_FILE, graphBytes(ws));
  await writeDerived(config, RECORD_FILE, recordBytes(ws));
  if (json) emitReport(io, true, []);
  return 0;
}

/**
 * `xspec check` (12.2): the build validations, then 14.10's forms — per
 * file and graph data (the mismatch forms) on a workspace passing them, the
 * unreadable-record unit form and the recorded-file form on any workspace.
 * Never refreshes and writes nothing; exits 1 on any finding.
 */
async function commandCheck(io, cwd, flags, json) {
  const config = await loadConfig(cwd, flags.get("--config"));
  await refuseDurableState(config, { sessions: true });
  const ws = await loadWorkspace(config);
  const findings = [...ws.findings, ...(await obstructionFindings(config, ws))];
  const passing = findings.length === 0;
  const record = await readRecord(config);
  if (record.state === "unreadable") {
    findings.push(
      finding(
        10,
        GRAPH_DATA_AREA,
        "the recorded generation state under .xspec cannot be read as a record; run xspec build to replace it (SPEC 14.10, 14.23)",
      ),
    );
  } else if (
    passing &&
    !(await holdsExactly(config, GRAPH_FILE, graphBytes(ws)))
  ) {
    findings.push(
      finding(
        10,
        GRAPH_DATA_AREA,
        "graph data is missing or does not match the current sources and configuration; run xspec build (SPEC 14.10, 13.3)",
      ),
    );
  }
  if (passing) {
    for (const item of ws.derived) {
      if (!(await holdsExactly(config, item.rel, item.content))) {
        findings.push(
          finding(
            10,
            item.rel,
            `${item.rel} is missing or does not match what the current sources and configuration generate; run xspec build (SPEC 14.10)`,
          ),
        );
      }
    }
  }
  if (record.state === "readable") {
    const writePaths = [...ws.generated, GRAPH_FILE, RECORD_FILE];
    for (const rel of record.paths) {
      if (ws.generated.has(rel)) continue;
      if (!isRemovable(await recordedOccupant(config, rel), rel, ws)) continue;
      const obstructs = writePaths.some((w) => w.startsWith(`${rel}/`));
      findings.push(
        finding(
          10,
          rel,
          obstructs
            ? `${rel} is a recorded derived file no longer generated that obstructs a path the rebuild writes; delete it manually, then run xspec build (SPEC 14.10, 13.4)`
            : `${rel} is a recorded derived file the current sources and configuration no longer generate; run xspec build to remove it (SPEC 14.10, 13.4)`,
        ),
      );
    }
  }
  if (findings.length > 0) throw new FindingsError(findings);
  if (json) emitReport(io, true, []);
  return 0;
}

/**
 * `xspec ids` (12.3, 13.3): the syntax class first — `--file`'s outside-root
 * spelling — then the flags 12.3 names that this fixture does not serve,
 * refused loudly; then the gate — the validations of `build`, whose
 * findings it reports with exit 1, nothing evaluated or written past it —
 * then the refresh, where the graph is missing or does not match what
 * `build` would now write: the graph alone rewritten, no TypeScript or
 * Markdown generated or removed, and the record left as it stands, absent,
 * empty, or unreadable alike; then the listing, one entry per discovered
 * spec source in byte order of path, its IDs in document order.
 */
async function commandIds(io, cwd, flags, json) {
  if (flags.has("--file")) checkFileGlob("--file", flags.get("--file"));
  for (const flag of SYNOPSES.get("ids").unservedFlags) {
    if (flags.has(flag)) {
      throw new ScopeError(
        `ids ${flag} is outside this fixture's scope (CERTIFICATIONS.md §CONF-IMPORT: ids under --json alone)`,
      );
    }
  }
  const config = await loadConfig(cwd, flags.get("--config"));
  await refuseDurableState(config);
  const ws = await loadWorkspace(config);
  const findings = [...ws.findings, ...(await obstructionFindings(config, ws))];
  if (findings.length > 0) throw new FindingsError(findings);
  const graph = graphBytes(ws);
  if (!(await holdsExactly(config, GRAPH_FILE, graph))) {
    await refuseDirectoryOccupants(config, [GRAPH_FILE]);
    await writeDerived(config, GRAPH_FILE, graph);
  }
  const files = ws.graph.sources.map((source) => ({
    file: source.path,
    ids: source.sections.map((section) => section.id),
  }));
  if (json) {
    io.stdout(canonicalJson({ files }) + LF);
  } else {
    for (const entry of files) {
      io.stdout(entry.file + LF);
      for (const id of entry.ids) io.stdout(`  ${id}${LF}`);
    }
  }
  return 0;
}

/**
 * `xspec inventory` (11.6): JSON-only, the full 12.7 document the entire
 * stdout with or without `--json` — the anchoring (the workspace root and
 * the configuration file relative to the working directory, physical paths
 * both), the resolved configuration view (groups with their globs exactly
 * as configured, the emission state and `outDir`, and the empty code,
 * coverage, and policy lists), every discovered source with its group
 * memberships in configuration order, the derived-file map (the module
 * and, while emission is enabled, the Markdown destination of each `.mdx`
 * spec source; both structurally absent for a spec-group file without the
 * extension, 13.1), the record, the graph-data area, the journal's
 * occupancy, the session files, and the lock path. It parses no source and
 * writes nothing. Recorded state that exists but cannot be read as a record
 * is 14.23 met in the record-supplied datum: `recorded` the unavailability
 * marker, its finding beside the answer, exit 1. A session directory is
 * outside this fixture's scope.
 */
async function commandInventory(io, cwd, flags) {
  const config = await loadConfig(cwd, flags.get("--config"));
  const discovery = await discover(config);
  if ((await occupantKind(config.root, SESSION_DIRECTORY)) === "dir") {
    throw new ScopeError(
      `a review-session directory (${SESSION_DIRECTORY}) is present: review sessions are outside this fixture's scope (CERTIFICATIONS.md §CONF-IMPORT; SPEC 10.1, 11.6)`,
    );
  }
  const specSources = [...discovery.specSources].sort((a, b) =>
    compareBytes(a.rel, b.rel),
  );
  const sources = specSources.map((source) => ({
    path: source.rel,
    groups: source.groups.map((name) => ({ name, kind: "spec" })),
  }));
  const derived = specSources.map((source) => {
    if (!source.rel.endsWith(".mdx")) {
      return { source: source.rel, module: null, markdown: null };
    }
    return {
      source: source.rel,
      module: modulePathOf(source.rel),
      markdown: config.emit ? markdownPathOf(config, source.rel) : null,
    };
  });
  const record = await readRecord(config);
  const findings = [];
  if (record.state === "unreadable") {
    findings.push(
      finding(
        23,
        GRAPH_DATA_AREA,
        "the recorded generation state under .xspec cannot be read as a record, so the recorded derived-file paths are unavailable; run xspec build to replace it (SPEC 14.23, 11.6)",
      ),
    );
  }
  const doc = {
    findings: findingForms(findings),
    root: config.rootAnchor,
    config: config.configAnchor,
    configuration: {
      specs: config.specGroups.map((group) => ({
        name: group.name,
        globs: [...group.globs],
      })),
      code: [],
      markdown: { emit: config.emit, outDir: config.outDir },
      coverage: [],
      policy: [],
    },
    sources,
    derived,
    recorded:
      record.state === "unreadable" ? { unavailable: true } : record.paths,
    graphData: GRAPH_DATA_AREA,
    journal: {
      path: JOURNAL_PATH,
      occupied: (await occupantKind(config.root, JOURNAL_PATH)) !== "absent",
    },
    sessions: [],
    lock: LOCK_PATH,
  };
  io.stdout(canonicalJson(doc) + LF);
  return findings.length > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Entry and dispatch (SPEC 12.0 exit partition)
// ---------------------------------------------------------------------------

/**
 * Run one invocation: `argv` without the executable, `cwd` the working
 * directory, `options` the deviation switches (none for this conformer).
 * Returns the exit code.
 */
export async function runXspec(argv, cwd, options = {}) {
  deviations = { ...options };
  const io = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  };
  return await dispatchCommand(io, cwd, argv);
}

/**
 * Read one invocation under the grammar of SPEC 12.0, dispatch it, and map
 * its outcome to 12.0's codes. Every syntax-class error is decided from the
 * arguments alone, before configuration is loaded and before any of this
 * fixture's scope refusals (12.0): first the checks the arguments decide for
 * every command alike (`readInvocation`), then the command word and
 * `query`'s subcommand, then the synopsis (`checkSynopsis`) and the value
 * spellings 12.0 puts in the syntax class.
 */
async function dispatchCommand(io, cwd, argv) {
  const invocation = readInvocation(argv);
  const [command, ...operands] = invocation.words;
  // JSON output is in effect when a `--json` token is read as a flag — not
  // as another flag's value — or when the invoked surface is JSON-only
  // (SPEC 12.0): `inventory` among the served ones (11), so its every answer
  // and usage error is JSON, with or without `--json`. It governs error
  // delivery even when the arguments are the error.
  const jsonInEffect = invocation.json || isJsonOnlySurface(invocation.words);
  try {
    if (invocation.error !== null) throw new UsageError(invocation.error);
    if (command === undefined) {
      throw new UsageError("expected a command (SPEC 12.0)");
    }
    if (!PRODUCT_COMMANDS.has(command)) {
      throw new UsageError(`unknown command ${command} (SPEC 12.0)`);
    }
    if (command === "query") {
      const [subcommand, ...rest] = operands;
      if (subcommand === undefined) {
        throw new UsageError("query: missing subcommand (SPEC 11.1, 12.0)");
      }
      const synopsis = QUERY_SYNOPSES.get(subcommand);
      if (synopsis === undefined) {
        throw new UsageError(
          `query: unknown subcommand ${subcommand} (SPEC 11.1, 12.0)`,
        );
      }
      const spelled = `query ${subcommand}`;
      checkSynopsis(spelled, synopsis, invocation.flags, rest);
      checkQueryValues(spelled, subcommand, invocation.flags, rest);
      throw new ScopeError(
        `${spelled} is outside this fixture's surface: build, check, ids, and inventory alone (CERTIFICATIONS.md §CONF-IMPORT)`,
      );
    }
    const synopsis = SYNOPSES.get(command);
    if (synopsis === undefined) {
      throw new ScopeError(
        `the ${command} command is outside this fixture's surface: build, check, ids, and inventory alone (CERTIFICATIONS.md §CONF-IMPORT)`,
      );
    }
    checkSynopsis(command, synopsis, invocation.flags, operands);
    const { flags } = invocation;
    switch (command) {
      case "build":
        return await commandBuild(io, cwd, flags, jsonInEffect);
      case "check":
        return await commandCheck(io, cwd, flags, jsonInEffect);
      case "ids":
        return await commandIds(io, cwd, flags, jsonInEffect);
      case "inventory":
        return await commandInventory(io, cwd, flags);
      default:
        throw new Error(`no handler for the served command ${command}`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      // Usage and configuration errors (12.0): the message on stderr in both
      // output forms, after the concerned path where the error has one (a
      // configuration error's, in the anchoring form, 14); with JSON output
      // in effect the single 12.7 error document — its stable code and
      // concerned path for a configuration error, null and null for a plain
      // usage error — is the entire stdout, and without it stdout stays
      // empty. The output form never changes the exit code or stderr.
      if (jsonInEffect) {
        io.stdout(
          canonicalJson({
            error: {
              code: error.code,
              message: error.message,
              locations: [],
              path: error.path,
              identities: [],
            },
          }) + LF,
        );
      }
      io.stderr(
        error.path === null
          ? `xspec: ${error.message}${LF}`
          : `xspec: ${error.path}: ${error.message}${LF}`,
      );
      return 2;
    }
    if (error instanceof FindingsError) {
      emitReport(io, jsonInEffect, error.findings);
      return 1;
    }
    if (error instanceof ScopeError) {
      io.stderr(`xspec: fixture scope error: ${error.message}${LF}`);
      return 70;
    }
    // A crash is a fixture bug: exit outside the 12.0 partition so every
    // exit-code assertion fails loudly and the diagnosis carries the stack.
    io.stderr(
      `xspec: internal fixture error: ${error?.stack ?? String(error)}${LF}`,
    );
    return 70;
  }
}
