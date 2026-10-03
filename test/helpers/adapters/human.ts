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
      /** Which accepted form carried it. */
      readonly form: string;
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

/**
 * A clause presenting a build as what removes the file: a build "to remove"
 * or "to delete" it, a build that "removes" or "will remove" it, or a
 * removal "by", "via", "through", or "with" a build.
 */
const REBUILD_REMEDY: readonly RegExp[] = [
  /\b(?:re-?)?build(?:ing)?`?(?:\s+again)?\s+to\s+(?:remove|delete)\b/i,
  /\b(?:re-?)?build(?:ing)?`?\s+(?:removes|deletes|(?:will|would|shall)\s+(?:remove|delete))\b/i,
  /\b(?:remov|delet)\w*(?:\s+\w+){0,3}?\s+(?:by|via|through|with)\s+(?:running\s+|re-?running\s+|a\s+)?`?(?:xspec\s+)?(?:re-?)?build/i,
];

/**
 * Judge whether a finding's human-readable message carries the correction
 * "its manual deletion" (SPEC 14.10) for the recorded file at `path`, never
 * a rebuild — H-3's robust matching: required information only, never
 * exact wording. Pure: the T13.4-10 assertion and the S-5 vectors drive it.
 *
 * - Rejected, first, when any clause presents a build as what removes the
 *   file (`REBUILD_REMEDY`).
 * - Accepted when the message pairs a deletion or removal word with the
 *   deletion's manual character ("manual", "by hand", or "yourself").
 * - Otherwise the required information is absent.
 */
export function judgeManualDeletionCorrection(
  message: string,
  path: string,
): ManualDeletionVerdict {
  void path;
  for (const pattern of REBUILD_REMEDY) {
    const match = pattern.exec(message);
    if (match !== null) {
      return {
        verdict: "rebuild-remedy",
        clause: match[0],
        pattern: pattern.toString(),
      };
    }
  }
  if (DELETION_WORD.test(message) && MANUAL_MARKER.test(message)) {
    return { verdict: "manual-deletion", form: "a manual marker" };
  }
  return { verdict: "absent" };
}
