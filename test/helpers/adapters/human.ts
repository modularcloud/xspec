// H-3 output adapters — the human-report side. SPEC.md fixes the information
// content of human-readable reports, never their wording, so human output is
// asserted only for required information via robust matching (H-3): a test
// names the identities, paths, counts, and condition numbers a report must
// carry, and this module checks each is mentioned — never exact wording,
// never line formats. Missing required information fails loudly (a diagnosed
// test error, S-5), exactly like the JSON decoders beside this module.

import type { RunResult } from "../subprocess.js";
import { fail } from "../assertions.js";

/**
 * One required piece of information: a literal substring (identities, paths,
 * names, counts rendered as digits) or a pattern where a literal would
 * over- or under-match.
 */
export type Mention = string | RegExp;

function textOf(output: string | RunResult): string {
  return typeof output === "string" ? output : output.stdout;
}

function describeMention(mention: Mention): string {
  return typeof mention === "string"
    ? JSON.stringify(mention)
    : `pattern ${mention.toString()}`;
}

function mentionFound(text: string, mention: Mention): boolean {
  if (typeof mention === "string") return text.includes(mention);
  // A fresh lastIndex per test: global/sticky flags on a caller's pattern
  // must not make matching stateful across mentions.
  return new RegExp(mention.source, mention.flags.replace(/[gy]/g, "")).test(
    text,
  );
}

const EXCERPT_LIMIT = 2048;

function excerpt(text: string): string {
  if (text.length === 0) return "<empty>";
  const clipped = text.slice(0, EXCERPT_LIMIT);
  return text.length > EXCERPT_LIMIT
    ? `${JSON.stringify(clipped)}… (${String(text.length)} chars total)`
    : JSON.stringify(clipped);
}

/**
 * Assert a human report mentions every required piece of information
 * (robust matching, H-3). Accepts the report text or a RunResult (its
 * stdout — reports and findings are standard-output content, 12.0). Fails
 * diagnosed, listing every missing mention with an excerpt of the report.
 */
export function assertReportMentions(
  output: string | RunResult,
  mentions: readonly Mention[],
  context: string,
): void {
  if (mentions.length === 0) {
    fail(
      `${context}: assertReportMentions called with no mentions — a human-report assertion must name the required information it checks (H-3)`,
    );
  }
  const text = textOf(output);
  const missing = mentions.filter((mention) => !mentionFound(text, mention));
  if (missing.length === 0) return;
  const where =
    typeof output === "string"
      ? "report text"
      : `stdout of ${output.commandLine}`;
  fail(
    `${context}: required information missing from the human report (H-3: information presence, never exact wording).\n` +
      `Missing: ${missing.map(describeMention).join(", ")}\n` +
      `From ${where}: ${excerpt(text)}`,
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
