// H-3 output adapters — the human-report side. SPEC.md fixes the information
// content of human-readable reports, never their wording, so human output is
// asserted only for required information via robust matching (H-3): a test
// names the identities, paths, counts, and condition numbers a report must
// carry, and this module checks each is mentioned — or, where SPEC.md
// requires information to be absent (an empty listing names no file), that
// none of the named information is — never exact wording, never line
// formats. Missing required information, or present information that must
// be absent, fails loudly (a diagnosed test error, S-5), exactly like the
// JSON decoders beside this module.
//
// The human-report parity checks (TEST-SPEC T12.0-1: `--json` carries "the
// same information as the human report", adapter-verified per command; SPEC
// 12.0) take their mentions from the decoded JSON document after the test's
// own JSON assertions have run — a product-to-itself comparison (H-4), so
// every mention equals what those assertions checked — and match three kinds
// of mention, each formed here by a pure matcher that fails loudly on an
// input it cannot form (an empty datum, a number that is not a non-negative
// integer, an empty, malformed, or unnamed token or code):
// - literal data, as substrings, token-bounded where a datum can occur
//   inside a longer one. `identityMention` (an identity or a path): not
//   preceded by a word character, `-`, `.`, or `/`, and not followed by a
//   word character, `-`, `#`, `/`, or by `.` and a word character — so
//   `specs/T.mdx#p` does not count inside `specs/T.mdx#p.a`, nor the root's
//   `specs/T.mdx` inside `specs/T.mdx#p` or `out/specs/T.mdx`, while a
//   sentence may end on one (`specs/T.mdx#p.`). `nameMention` (a session
//   name or an item id): adjacent on neither side to a word character or
//   `-`, and not followed by `.` and a word character — so `a` does not
//   count inside `a2` or `audit`, nor `item-1` inside `item-10`.
//   `spellingMention` (a spelling a message quotes as data): adjacent on
//   neither side to a letter or digit — `div` counts in `<div>`, never in
//   `divide`. Other literal data (a text value's lines, a hash, a note) are
//   plain string mentions;
// - whole numbers (`numberMention`, counts and range offsets): not preceded
//   or followed by a digit, matched only after every literal datum of the
//   document that holds a digit has been blanked out of the report
//   (`assertReportMentions`' `blank` option, `blankReportData`: every
//   occurrence one space, longest datum first), so a digit inside an id, an
//   identity, a path, a hash, a name, or a text line never stands in for a
//   count or an offset — save a datum that is itself a whole number (an item
//   id `4`), which a caller leaves unblanked: substring blanking cannot tell
//   it from a count or an offset of its value, so blanking it would erase
//   those wherever the report prints them, and the two may then stand in for
//   each other;
// - SPEC-named tokens (`specTokenMention`, the closed `SPEC_NAMED_TOKENS`):
//   case-insensitive, the token's hyphen-joined words separated by any one
//   character that is neither letter nor digit, or by nothing (`no-change`
//   counts in `No change`, `no_change`, `nochange`), not preceded by a
//   letter (`blocked` never counts inside `unblocked`), any letters allowed
//   after it (`direct` counts in `directly`), and never counting where it
//   ends a longer token SPEC names (`changed` in `metadata changed`,
//   `descendant-changed`, or `upstream_changed`) — and, spelled the same
//   way over a closed vocabulary of their own, SPEC 14's stable codes
//   (`codeMention`, `STABLE_CODES`: the numbered conditions' codes, then
//   the refusal reasons'): `missing-id` counts in `missing ID`,
//   `refused-invalid-id` in `REFUSED_INVALID_ID`, and a code never counts
//   where it ends a longer code (`cycle` in `refused-cycle` or
//   `refused cycle`). The codes stand apart from the tokens because a
//   token counts inside a code — `corrupt` (14.21's word) inside
//   `corrupt-session` (14.21's code) — while each closed vocabulary holds
//   no member counting inside another's spelling; a code's tail exclusion
//   is judged over the codes alone, a token's over the tokens alone.
// Letters, digits, and word characters here are ASCII's (`[A-Za-z]`,
// `[0-9]`, `[A-Za-z0-9_]`): a report may run text in any other script up
// to a datum (a CJK sentence spaces no Latin word), and the data the suite
// stages for these checks are ASCII. A token or a code counts wherever its
// spelling stands, inside a datum too (an identity ending `#blocked`); a
// check that must not credit a datum's spelling blanks the data first.
//
// No mention is associated with another — no "same line", no adjacency, no
// order: robust matching asks only that each required datum, number, token,
// and code appear (H-3). Which count belongs to which status or session, which
// row is blocked, which identity is attributed to which category or lies on
// which path, which direction of a delta lists a path — all of that stays
// with the JSON assertions.

import type { RunResult } from "../subprocess.js";
import { fail } from "../assertions.js";
import {
  CHANGE_CATEGORIES,
  CONDITION_CODE_TOKENS,
  EDGE_KINDS,
  ITEM_KINDS,
  ITEM_STATUSES,
  PREVIEW_EDIT_CLASSES,
  REFUSAL_CODE_TOKENS,
} from "./model.js";

/**
 * A mention one of this module's matchers formed (`identityMention`,
 * `nameMention`, `spellingMention`, `numberMention`, `specTokenMention`,
 * `codeMention`): the pattern that finds it, and the words a diagnosis
 * names it by.
 */
export interface FormedMention {
  readonly pattern: RegExp;
  readonly description: string;
}

/**
 * One required piece of information: a literal substring (a text line, a
 * hash, a note), a pattern where a literal would over- or under-match, or a
 * mention this module's matchers formed (token-bounded data, whole numbers,
 * SPEC-named tokens, stable codes).
 */
export type Mention = string | RegExp | FormedMention;

function textOf(output: string | RunResult): string {
  return typeof output === "string" ? output : output.stdout;
}

function describeMention(mention: Mention): string {
  if (typeof mention === "string") return JSON.stringify(mention);
  if (mention instanceof RegExp) return `pattern ${mention.toString()}`;
  return mention.description;
}

function mentionFound(text: string, mention: Mention): boolean {
  if (typeof mention === "string") return text.includes(mention);
  const pattern = mention instanceof RegExp ? mention : mention.pattern;
  // A fresh lastIndex per test: global/sticky flags on a caller's pattern
  // must not make matching stateful across mentions.
  return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")).test(
    text,
  );
}

/** Where a matcher read the report: the text given, or a run's stdout. */
function describeSource(output: string | RunResult): string {
  return typeof output === "string"
    ? "report text"
    : `stdout of ${output.commandLine}`;
}

const EXCERPT_LIMIT = 2048;

function excerpt(text: string): string {
  if (text.length === 0) return "<empty>";
  const clipped = text.slice(0, EXCERPT_LIMIT);
  return text.length > EXCERPT_LIMIT
    ? `${JSON.stringify(clipped)}… (${String(text.length)} chars total)`
    : JSON.stringify(clipped);
}

/** How `assertReportMentions` reads the report before matching it. */
export interface MentionOptions {
  /**
   * Literal data blanked out of the report before any mention is matched
   * (`blankReportData`: every occurrence one space, longest datum first) —
   * for whole numbers, every datum of the document that holds a digit, save
   * one that is itself a whole number (the module header). Every mention of
   * the call is matched in the blanked text, so a call naming a blanked
   * datum's own mention never finds it.
   */
  readonly blank?: readonly string[];
}

/**
 * Assert a human report mentions every required piece of information
 * (robust matching, H-3). Accepts the report text or a RunResult (its
 * stdout — reports and findings are standard-output content, 12.0); with
 * `options.blank`, the mentions are matched in the report with those data
 * blanked out (`MentionOptions`). Fails diagnosed, listing every missing
 * mention — and, after blanking, the data blanked — with an excerpt of the
 * report as it was given, never the blanked text.
 */
export function assertReportMentions(
  output: string | RunResult,
  mentions: readonly Mention[],
  context: string,
  options: MentionOptions = {},
): void {
  if (mentions.length === 0) {
    fail(
      `${context}: assertReportMentions called with no mentions — a human-report assertion must name the required information it checks (H-3)`,
    );
  }
  const text = textOf(output);
  const blank = options.blank;
  const searched =
    blank === undefined
      ? text
      : blankWith(
          text,
          blank,
          `${context}: assertReportMentions' blank option`,
        );
  const missing = mentions.filter(
    (mention) => !mentionFound(searched, mention),
  );
  if (missing.length === 0) return;
  fail(
    `${context}: required information missing from the human report (H-3: information presence, never exact wording).\n` +
      `Missing: ${missing.map(describeMention).join(", ")}\n` +
      (blank === undefined
        ? ""
        : `Matched with ${describeBlanked(blank)} blanked out of the report (each occurrence one space, longest datum first)\n`) +
      `From ${describeSource(output)}: ${excerpt(text)}`,
  );
}

/** Longest first; equal lengths in code-unit order, so blanking is deterministic. */
function longestFirst(a: string, b: string): number {
  if (a.length !== b.length) return b.length - a.length;
  return a < b ? -1 : a > b ? 1 : 0;
}

function blankWith(text: string, data: readonly string[], who: string): string {
  const empty = data.findIndex((datum) => datum.length === 0);
  if (empty !== -1) {
    fail(
      `${who}: datum ${String(empty)} is empty — every blanked datum is a literal the decoded document carries, and an empty one blanks nothing (H-3)`,
    );
  }
  let blanked = text;
  for (const datum of [...new Set(data)].sort(longestFirst)) {
    blanked = blanked.split(datum).join(" ");
  }
  return blanked;
}

/**
 * The report text with every occurrence of each datum replaced by one space,
 * longest datum first (equal lengths in code-unit order) — so a datum
 * holding a shorter one (`item-10` beside `item-1`, `specs/T.mdx#p` beside
 * `specs/T.mdx`) is blanked whole, never leaving a fragment whose digits
 * read as a number. Pure; fails diagnosed on an empty datum. The space
 * keeps whatever stood on either side apart, so blanking never joins two
 * digits into one number.
 */
export function blankReportData(text: string, data: readonly string[]): string {
  return blankWith(text, data, "blankReportData");
}

function describeBlanked(data: readonly string[]): string {
  if (data.length === 0) return "no data";
  const listing = data.map((datum) => JSON.stringify(datum)).join(", ");
  const count = `${String(data.length)} ${data.length === 1 ? "datum" : "data"}`;
  return listing.length > EXCERPT_LIMIT
    ? `${count} (${listing.slice(0, EXCERPT_LIMIT)}…)`
    : `${count} (${listing})`;
}

/**
 * Assert a human report carries none of the named information — the
 * negative counterpart of `assertReportMentions`, for information SPEC.md
 * requires to be absent (an empty listing names no file): robust matching
 * (H-3), information, never wording, so the report may say anything else.
 * Accepts the report text or a RunResult (its stdout — reports are
 * standard-output content, 12.0; stderr is never searched), and matches
 * each mention exactly as `assertReportMentions` does. Fails diagnosed,
 * listing every present mention with an excerpt of the report.
 */
export function assertReportOmits(
  output: string | RunResult,
  mentions: readonly Mention[],
  context: string,
): void {
  if (mentions.length === 0) {
    fail(
      `${context}: assertReportOmits called with no mentions — a human-report assertion must name the information it checks (H-3)`,
    );
  }
  const text = textOf(output);
  const present = mentions.filter((mention) => mentionFound(text, mention));
  if (present.length === 0) return;
  fail(
    `${context}: information that must be absent is present in the human report (H-3: information absence, never exact wording).\n` +
      `Present: ${present.map(describeMention).join(", ")}\n` +
      `From ${describeSource(output)}: ${excerpt(text)}`,
  );
}

/**
 * A robust pattern for a SPEC.md 14 condition identity in a human report:
 * matches `14.2` as a standalone number, not inside `14.20` or `114.2`.
 * (A bare substring check cannot make this distinction.)
 */
export function conditionMention(condition: string): RegExp {
  if (!/^14\.[1-9][0-9]*$/.test(condition)) {
    fail(
      `conditionMention: ${JSON.stringify(condition)} is not a SPEC.md 14 condition identity ("14.<n>")`,
    );
  }
  const escaped = condition.replace(/\./g, "\\.");
  // Trailing: no further digit (`14.2` must not match inside `14.20`); a
  // trailing period is fine — reports may end a sentence with the number.
  return new RegExp(`(?:^|[^0-9.])${escaped}(?![0-9])`);
}

// --- the human-report parity matchers (module header) -----------------------

/** A literal, escaped for a RegExp source (no `u` flag: every class is ASCII). */
function escapeLiteral(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** An ASCII word character (module header: the classes are ASCII's). */
const WORD = "A-Za-z0-9_";

/** An ASCII letter or digit. */
const ALNUM = "A-Za-z0-9";

/** A literal datum between two boundary assertions, or a diagnosed failure. */
function boundedDatum(
  matcher: string,
  kind: string,
  datum: string,
  before: string,
  after: string,
): FormedMention {
  if (datum.length === 0) {
    fail(
      `${matcher}: an empty datum forms no mention — every datum is a literal the decoded document carries (H-3)`,
    );
  }
  return Object.freeze({
    pattern: new RegExp(`${before}${escapeLiteral(datum)}${after}`),
    description: `${kind} ${JSON.stringify(datum)}`,
  });
}

/**
 * An identity or a path (SPEC 1.5; a file, a location, a scope, a mapping
 * side), token-bounded: not preceded by a word character, `-`, `.`, or `/`,
 * and not followed by a word character, `-`, `#`, `/`, or by `.` and a word
 * character. So an identity never counts inside a descendant's
 * (`specs/T.mdx#p` in `specs/T.mdx#p.a`) or a sibling segment's
 * (`specs/T.mdx#p-b`, `specs/T.mdx#pa`), a root's bare path never inside
 * its sections' identities (`specs/T.mdx` in `specs/T.mdx#p`), and a path
 * never inside a longer path (`specs/T.mdx` in `out/specs/T.mdx`); a
 * sentence may end on it (`specs/T.mdx#p.`), and punctuation or brackets
 * may enclose it. Fails diagnosed on an empty datum.
 */
export function identityMention(datum: string): FormedMention {
  return boundedDatum(
    "identityMention",
    "identity or path",
    datum,
    `(?<![${WORD}./-])`,
    `(?![${WORD}#/-]|\\.[${WORD}])`,
  );
}

/**
 * A session name (SPEC 10.1) or an item id (10.2), token-bounded: adjacent
 * on neither side to a word character or `-`, and not followed by `.` and a
 * word character — so `a` never counts inside `a2`, `ba`, `path`, or `a.b`,
 * nor `item-1` inside `item-10`. Fails diagnosed on an empty datum.
 */
export function nameMention(datum: string): FormedMention {
  return boundedDatum(
    "nameMention",
    "session name or item id",
    datum,
    `(?<![${WORD}-])`,
    `(?![${WORD}-]|\\.[${WORD}])`,
  );
}

/**
 * A spelling a message quotes as data (an offending segment, an unresolved
 * target, an element name, a marker chain), letter-bounded: adjacent on
 * neither side to a letter or digit — `div` counts in `<div>` and `div.`,
 * never in `divide`, `adiv`, or `div2`. Fails diagnosed on an empty datum.
 */
export function spellingMention(datum: string): FormedMention {
  return boundedDatum(
    "spellingMention",
    "spelling",
    datum,
    `(?<![${ALNUM}])`,
    `(?![${ALNUM}])`,
  );
}

/**
 * A whole decimal number (a count, a range offset): its digits not preceded
 * or followed by a digit — `4` counts in `unresolved=4` and `(4)`, never in
 * `14` or `40`. Match it after blanking (`MentionOptions.blank`), so a digit
 * inside a datum never stands in for it. Fails diagnosed on a value that is
 * not a non-negative (safe) integer.
 */
export function numberMention(value: number): FormedMention {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail(
      `numberMention: ${String(value)} is not a non-negative integer — a count or a range offset is one (SPEC 1.7; H-3)`,
    );
  }
  const digits = String(value);
  return Object.freeze({
    pattern: new RegExp(`(?<![0-9])${digits}(?![0-9])`),
    description: `number ${digits}`,
  });
}

/**
 * The tokens SPEC.md names that the human-report parity checks require a
 * report to carry, a closed vocabulary (`specTokenMention` validates
 * membership, as the decoders validate their vocabularies): the statuses
 * (10.3), the strategies (10.5–10.7), the item kinds (10.5–10.7), the
 * blocked state (10.3), the change categories (5.6), `deleted` (9.3), the
 * code groups' `direct` and `transitive` (9.2: directly and transitively
 * impacted code), the edge kinds (5.2), the preview edit classes (6.6,
 * 12.7), `unavailable` (11.2, 12.7), `absent` (10.7: presented absent), and
 * `corrupt` (14.21). SPEC 14's stable codes are a vocabulary of their own
 * (`STABLE_CODES`): `corrupt` counts inside `corrupt-session`.
 */
export const SPEC_NAMED_TOKENS = [
  ...ITEM_STATUSES,
  "path-blocks",
  "audit",
  "coverage",
  ...ITEM_KINDS,
  "blocked",
  ...CHANGE_CATEGORIES,
  "deleted",
  "direct",
  "transitive",
  ...EDGE_KINDS,
  ...PREVIEW_EDIT_CLASSES,
  "unavailable",
  "absent",
  "corrupt",
] as const;
export type SpecNamedToken = (typeof SPEC_NAMED_TOKENS)[number];

/**
 * The form of every SPEC-named token and every stable code: lowercase words
 * joined by hyphens.
 */
const TOKEN_FORM = /^[a-z]+(?:-[a-z]+)*$/;

/** One character between a token's words: neither letter nor digit. */
const TOKEN_SEPARATOR = `[^${ALNUM}]`;

/** A token's words, each separated by one separator character or nothing. */
function spelledWords(words: readonly string[]): string {
  return words.join(`${TOKEN_SEPARATOR}?`);
}

/**
 * The pattern of one member of a closed vocabulary — a SPEC-named token
 * (`specTokenMention`, over `SPEC_NAMED_TOKENS`) or a stable code
 * (`codeMention`, over `STABLE_CODES`) — once its matcher has validated the
 * member: case-insensitive, its hyphen-joined words separated by one
 * separator character or by nothing, not preceded by a letter, any letters
 * allowed after it, and never where it ends a longer member of the same
 * vocabulary — that member's leading words and one separator standing
 * before it. The tail exclusion reads the vocabulary given alone.
 */
function vocabularyPattern(
  member: string,
  vocabulary: readonly string[],
): RegExp {
  const words = member.split("-");
  const heads = vocabulary
    .map((other) => other.split("-"))
    .filter(
      (other) =>
        other.length > words.length &&
        other.slice(other.length - words.length).join("-") === member,
    )
    .map((other) => spelledWords(other.slice(0, other.length - words.length)));
  const notATail =
    heads.length === 0 ? "" : `(?<!(?:${heads.join("|")})${TOKEN_SEPARATOR})`;
  return new RegExp(`(?<![A-Za-z])${notATail}${spelledWords(words)}`, "i");
}

/**
 * A SPEC-named token (`SPEC_NAMED_TOKENS`): case-insensitive, its
 * hyphen-joined words separated by any one character that is neither letter
 * nor digit, or by nothing (`no-change` counts in `No change`, `no_change`,
 * `NOCHANGE`), not preceded by a letter (`blocked` never counts inside
 * `unblocked`, nor `changed` inside `unchanged`), any letters allowed after
 * it (`direct` counts in `directly`, `transitive` in `transitively`). A
 * token never counts where it ends a longer SPEC-named token — that token's
 * leading words and one separator standing before it: `changed` does not
 * count in `metadata changed`, `descendant-changed`, or `upstream_changed`
 * (in `metadataChanged` a letter precedes it already). Fails diagnosed on
 * an empty token, a malformed one (not lowercase words joined by single
 * hyphens), or one SPEC does not name among them.
 */
export function specTokenMention(token: string): FormedMention {
  if (token.length === 0) {
    fail(
      "specTokenMention: an empty token forms no mention — a SPEC-named token is one of SPEC_NAMED_TOKENS (H-3)",
    );
  }
  if (!TOKEN_FORM.test(token)) {
    fail(
      `specTokenMention: ${JSON.stringify(token)} is malformed — a SPEC-named token is lowercase words joined by single hyphens, as SPEC.md spells it (H-3)`,
    );
  }
  if (!(SPEC_NAMED_TOKENS as readonly string[]).includes(token)) {
    fail(
      `specTokenMention: ${JSON.stringify(token)} is no token SPEC.md names among the statuses, strategies, item kinds, blocked state, change categories, deleted, code groups, edge kinds, preview edit classes, unavailable, absent, and corrupt (SPEC_NAMED_TOKENS)`,
    );
  }
  return Object.freeze({
    pattern: vocabularyPattern(token, SPEC_NAMED_TOKENS),
    description: `SPEC-named token ${JSON.stringify(token)}`,
  });
}

/**
 * SPEC.md 14's stable codes, a closed vocabulary (`codeMention` validates
 * membership): the numbered conditions' codes in ordinal order
 * (`CONDITION_CODE_TOKENS`, 14.1–14.26, the usage errors' three among
 * them), then the refusal reasons' in the order 14 lists them
 * (`REFUSAL_CODE_TOKENS`) — 37 codes, the stable codes covering "exactly
 * these conditions and the refusal reasons below, and no more" (14). Apart
 * from `SPEC_NAMED_TOKENS` (the module header): a token counts inside a
 * code, `corrupt` inside `corrupt-session`.
 */
export const STABLE_CODES = [
  ...CONDITION_CODE_TOKENS,
  ...REFUSAL_CODE_TOKENS,
] as const;
export type StableCode = (typeof STABLE_CODES)[number];

/**
 * A stable code (SPEC 14; `STABLE_CODES`), spelled as `specTokenMention`
 * spells a token: case-insensitive, its hyphen-joined words separated by any
 * one character that is neither letter nor digit, or by nothing
 * (`refused-invalid-id` counts in `Refused invalid id`,
 * `REFUSED_INVALID_ID`, and `[refused-invalid-id]`; `missing-id` in
 * `missing ID`), not preceded by a letter (`refused-invalid-id` never counts
 * inside `unrefused-invalid-id`, nor `cycle` inside `recycle`), any letters
 * allowed after it (`cycle` counts in `cycles`). A code never counts where it
 * ends a longer stable code — that code's leading words and one separator
 * standing before it: `cycle` (14.9) does not count in `refused-cycle`,
 * `refused cycle`, or `Refused_Cycle`. Fails diagnosed on an empty code, a
 * malformed one (not lowercase words joined by single hyphens: `Cycle`,
 * `14.1`), or one SPEC.md 14 does not list (`no-change`, a SPEC-named
 * token, is no stable code).
 */
export function codeMention(code: string): FormedMention {
  if (code.length === 0) {
    fail(
      "codeMention: an empty code forms no mention — a stable code is one of STABLE_CODES (SPEC 14; H-3)",
    );
  }
  if (!TOKEN_FORM.test(code)) {
    fail(
      `codeMention: ${JSON.stringify(code)} is malformed — a stable code is lowercase words joined by single hyphens, as SPEC.md 14 lists it (H-3)`,
    );
  }
  if (!(STABLE_CODES as readonly string[]).includes(code)) {
    fail(
      `codeMention: ${JSON.stringify(code)} is no stable code SPEC.md 14 lists among the numbered conditions' codes and the refusal reasons' (STABLE_CODES)`,
    );
  }
  return Object.freeze({
    pattern: vocabularyPattern(code, STABLE_CODES),
    description: `stable code ${JSON.stringify(code)}`,
  });
}

/**
 * The verdict of `judgeManualDeletionCorrection` on one finding message:
 * the correction carried, a clause presenting a build as what removes the
 * file, or the required information absent.
 */
export type ManualDeletionVerdict =
  | {
      /** The message carries the correction: the file's manual deletion. */
      readonly verdict: "manual-deletion";
      /**
       * Which accepted form carried it: a deletion or removal word beside
       * its manual character, or an instruction to the reader to delete or
       * remove the file.
       */
      readonly form: "manual-marker" | "instruction";
    }
  | {
      /** A clause presents a build as what removes the file. */
      readonly verdict: "rebuild-remedy";
      /** The offending clause, as matched. */
      readonly clause: string;
      /** The pattern that matched it. */
      readonly pattern: string;
    }
  | {
      /** No manual-deletion instruction: the required information is absent. */
      readonly verdict: "absent";
    };

/** A deletion or removal word (the manual-marker form). */
const DELETION_WORD = /\b(?:delet|remov)/i;

/** The manual character of the deletion (the manual-marker form). */
const MANUAL_MARKER = /\bmanual|\bby hand\b|\byourself\b/i;

/** U+2014 EM DASH: a clause boundary. */
const EM_DASH = String.fromCodePoint(0x2014);

/** U+2019 RIGHT SINGLE QUOTATION MARK: a typographic apostrophe. */
const APOSTROPHE = String.fromCodePoint(0x2019);

/** The backtick a message may quote a command or a path in. */
const TICK = "`";

/**
 * One word of a clause: characters holding no whitespace and no clause
 * boundary, a period inside a word (a path's `A.md`) excepted.
 */
const CLAUSE_WORD = String.raw`(?:[^\s;:,.!?()${EM_DASH}]|\.(?=\w))+`;

/** A build: `xspec build`, a build, or a rebuild. */
const BUILD = String.raw`${TICK}?(?:xspec\s+)?(?:re-?)?build`;

/**
 * An instruction to build — running, using, or invoking one — or a bare
 * build closing its clause ("rebuild.").
 */
const BUILD_INSTRUCTION =
  String.raw`(?:(?:(?:re-?)?run(?:ning)?|us(?:e|ing)|invok(?:e|ing))\s+${BUILD}` +
  String.raw`|${BUILD}${TICK}?(?:\s+again)?\s*(?=$|[).;,!?\n${EM_DASH}]))`;

/**
 * A reference to the file at `path`: "it", the path itself (whole, never a
 * prefix of a longer path; quoted or not, a directory prefix allowed), or
 * "the file" ("the", "this", or "that", up to three words, then "file" or
 * "orphan").
 */
function namesFile(path: string): string {
  const escaped = path.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return (
    String.raw`(?:it\b` +
    String.raw`|[${TICK}'"]?(?:[^\s${TICK}'"]*\/)?${escaped}(?![\w/-]|\.\w)` +
    String.raw`|(?:the|this|that)\s+(?:[\w-]+\s+){0,3}?(?:file|orphan)\b)`
  );
}

/**
 * The clauses presenting a build — or xspec itself — as what removes the
 * file at `path` (TEST-SPEC T13.4-10: "never a rebuild"):
 * - a build "to remove" or "to delete" it;
 * - a build that "removes" or "will remove" it;
 * - a removal "by", "via", "through", "with", or "using" a build or xspec
 *   ("removed by xspec", "remove out/specs/A.md by running `xspec build`");
 * - xspec that "removes" or "will remove" the file, or that the reader is
 *   to let remove it ("let xspec remove it");
 * - a removal elaborated by a build instruction after a colon, a
 *   parenthesis, or a dash ("remove it: run `xspec build`");
 * - a build instruction offered as the alternative ("or run `xspec build`",
 *   ", or rebuild.").
 * A clause that negates its removal ("not removed by a rebuild", "do not
 * run `xspec build` to remove it") presents no build as the remover
 * (`NEGATION`, judged from the clause's start to the match's end).
 */
function rebuildRemedies(path: string): readonly RegExp[] {
  const file = namesFile(path);
  const adverb = String.raw`(?:(?:itself|then|also|automatically|later)\s+)?`;
  return [
    String.raw`\b(?:re-?)?build(?:ing)?${TICK}?(?:\s+again)?\s+(?:in\s+order\s+)?to\s+(?:remove|delete)\b`,
    String.raw`\b(?:re-?)?build(?:ing)?${TICK}?\s+(?:removes|deletes|(?:will|would|shall)\s+(?:remove|delete))\b`,
    String.raw`\b(?:remov|delet)\w*(?:\s+${CLAUSE_WORD}){0,3}?,?\s+(?:by|via|through|with|using)\s+(?:(?:re-?)?running\s+|invoking\s+)?(?:(?:a|an|the)\s+)?(?:new\s+|fresh\s+)?${TICK}?(?:xspec\b|(?:re-?)?build)`,
    String.raw`\bxspec\b${TICK}?\s+${adverb}(?:removes|deletes|(?:will|would|shall)\s+${adverb}(?:remove|delete))\s+${file}`,
    String.raw`\b(?:let|have)\s+${TICK}?xspec\b${TICK}?\s+(?:remove|delete)\s+${file}`,
    String.raw`\b(?:remove|delete)\b(?:\s+${CLAUSE_WORD}){1,5}?\s*(?:[:(${EM_DASH}]|\s-\s)\s*(?:(?:by|via|through|with)\s+)?${BUILD_INSTRUCTION}`,
    String.raw`\bor\s+(?:else\s+)?(?:(?:by|via|through|with)\s+)?(?:(?:re-?)?run(?:ning)?|us(?:e|ing)|invok(?:e|ing))\s+${BUILD}`,
    String.raw`,\s*or\s+(?:else\s+)?${BUILD}${TICK}?(?:\s+again)?\s*(?=$|[).;,!?\n${EM_DASH}])`,
  ].map((source) => new RegExp(source, "gi"));
}

/**
 * A negation within a clause ("not", "never", "cannot", "nor", "no" but in
 * "no longer", and any "n't").
 */
const NEGATION = new RegExp(
  String.raw`\b(?:not|never|cannot|nor)\b|\bno\b(?!\s+longer\b)|n['${APOSTROPHE}]t\b`,
  "i",
);

/** The characters ending a clause (a period too, before whitespace or the end). */
const CLAUSE_BOUNDARIES: ReadonlySet<string> = new Set([
  ";",
  ":",
  ",",
  "!",
  "?",
  "(",
  ")",
  "\n",
  EM_DASH,
]);

/** Where the clause holding `index` starts. */
function clauseStart(message: string, index: number): number {
  for (let at = index - 1; at >= 0; at -= 1) {
    const char = message[at]!;
    if (CLAUSE_BOUNDARIES.has(char)) return at + 1;
    if (
      char === "." &&
      (at + 1 === message.length || /\s/.test(message[at + 1]!))
    ) {
      return at + 1;
    }
  }
  return 0;
}

/**
 * An instruction to the reader to delete or remove the file at `path`: a
 * clause opening with "delete" or "remove" (any case) at the message's
 * start or after a clause boundary — `;`, `:`, `.`, `,`, `!`, `?`, `(`, an
 * em dash, a line break, "then", "and", "so", or "please" — and naming the
 * file (`namesFile`). Between the boundary and the verb the clause may
 * hold "first", "just", "simply", "instead", or "now", and the reader as
 * its subject: "you must", "you should", "you need to", "you have to",
 * "you will need to" ("you'll need to"), "you may", or "you can".
 */
function instructionToDelete(path: string): RegExp {
  const opener = String.raw`(?:^|[;:.,!?(\n${EM_DASH}]|\b(?:then|and|so|please)\s)\s*`;
  const adverb = String.raw`(?:(?:first|just|simply|instead|now)\s+)?`;
  const reader = String.raw`(?:you\s+(?:must|should|need\s+to|have\s+to|will\s+need\s+to|may|can)\s+|you['${APOSTROPHE}]ll\s+need\s+to\s+)?`;
  return new RegExp(
    String.raw`${opener}${adverb}${reader}${adverb}(?:delete|remove)\s+${namesFile(path)}`,
    "i",
  );
}

/**
 * Judge whether a finding's human-readable message carries the correction
 * "its manual deletion" (SPEC 14.10) for the recorded file at `path`, never
 * a rebuild — H-3's robust matching: required information only, never
 * exact wording. Pure: the T13.4-10 assertion and the S-5 vectors drive it.
 *
 * - Rejected, first, when any clause presents a build or xspec as what
 *   removes the file and does not negate that removal (`rebuildRemedies`).
 * - Accepted when the message carries the manual deletion in either form:
 *   a deletion or removal word beside the deletion's manual character
 *   ("manual", "by hand", or "yourself"), or an instruction to the reader
 *   to delete or remove the file (`instructionToDelete`).
 * - Otherwise the required information is absent.
 */
export function judgeManualDeletionCorrection(
  message: string,
  path: string,
): ManualDeletionVerdict {
  for (const pattern of rebuildRemedies(path)) {
    for (const match of message.matchAll(pattern)) {
      const end = match.index + match[0].length;
      const clause = message.slice(clauseStart(message, match.index), end);
      if (NEGATION.test(clause)) continue;
      return {
        verdict: "rebuild-remedy",
        clause: match[0],
        pattern: pattern.toString(),
      };
    }
  }
  if (DELETION_WORD.test(message) && MANUAL_MARKER.test(message)) {
    return { verdict: "manual-deletion", form: "manual-marker" };
  }
  if (instructionToDelete(path).test(message)) {
    return { verdict: "manual-deletion", form: "instruction" };
  }
  return { verdict: "absent" };
}
