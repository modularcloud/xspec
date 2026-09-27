// Where a code source fails to be well-formed TypeScript (SPEC 14's
// location rule for 14.20).
//
// SPEC 14.20: a code source is well-formed exactly when TypeScript's
// scanning and parsing of it report no syntax error. SPEC 14 locates the
// failure at "the byte length of the longest whole-character prefix of the
// file with which some well-formed file begins". TypeScript reports every
// syntax error of a file at once, the earliest first in position, so the
// failure is the earliest diagnostic's — except where TypeScript places a
// diagnostic away from the character that made the prefix unviable: an
// unterminated regular expression literal is reported over the literal,
// the failure being where it stopped (a line terminator); an element
// without a closing tag is reported at its opening tag, beside the
// diagnostic where the closing tag was due; and a diagnostic at or past
// the end-of-file token is the end's, the whole file a viable prefix. From
// there the prefix may run on into the offending token (`extendIntoToken`):
// TypeScript flags `010` at its start, while the prefix `0` begins a
// well-formed file and `01` none.

import ts from "./ts-module.js";
import type * as tst from "typescript";
import { extendIntoToken } from "./viable-prefix.js";

/** A text's syntactic diagnostics, and its end-of-file token's full start. */
export interface SyntaxDiagnosis {
  readonly diagnostics: readonly tst.Diagnostic[];
  /** Where trivia before the end of the file begins (UTF-16). */
  readonly endOfFile: number;
}

/** TypeScript's token vocabulary: its punctuators and keywords. */
const TYPESCRIPT_VOCABULARY: readonly string[] = (() => {
  const spellings: string[] = [];
  const add = (first: tst.SyntaxKind, last: tst.SyntaxKind): void => {
    for (let kind = first; kind <= last; kind += 1) {
      const spelling = ts.tokenToString(kind);
      if (spelling !== undefined) spellings.push(spelling);
    }
  };
  add(ts.SyntaxKind.FirstPunctuation, ts.SyntaxKind.LastPunctuation);
  add(ts.SyntaxKind.FirstKeyword, ts.SyntaxKind.LastKeyword);
  return spellings;
})();

/** "Unterminated regular expression literal." — reported over the literal. */
const UNTERMINATED_REGULAR_EXPRESSION = 1161;
/** "JSX element '{0}' has no corresponding closing tag." — at its opening. */
const ELEMENT_WITHOUT_CLOSING_TAG = 17008;
/** "Merge conflict marker encountered." — trivia, yet never completed. */
const CONFLICT_MARKER = 1185;

/** Where a diagnosed text fails, or null when it is well-formed. */
function failurePoint(text: string, diagnosis: SyntaxDiagnosis): number | null {
  const located = diagnosis.diagnostics.filter(
    (diagnostic) => diagnostic.start !== undefined,
  );
  if (located.length === 0) {
    return diagnosis.diagnostics.length === 0 ? null : 0;
  }
  const placed = located.some(
    (diagnostic) => diagnostic.code !== ELEMENT_WITHOUT_CLOSING_TAG,
  )
    ? located.filter(
        (diagnostic) => diagnostic.code !== ELEMENT_WITHOUT_CLOSING_TAG,
      )
    : located;
  const at = (diagnostic: tst.Diagnostic): number =>
    diagnostic.code === UNTERMINATED_REGULAR_EXPRESSION
      ? diagnostic.start! + (diagnostic.length ?? 0)
      : diagnostic.start!;
  let point = Number.POSITIVE_INFINITY;
  for (const diagnostic of placed) point = Math.min(point, at(diagnostic));
  // A failure in the trivia before the end is the end's — unless it is a
  // conflict marker, which no continuation completes.
  const conflict = placed.some(
    (diagnostic) =>
      diagnostic.code === CONFLICT_MARKER && at(diagnostic) === point,
  );
  if (point >= diagnosis.endOfFile && !conflict) return text.length;
  return Math.min(point, text.length);
}

/**
 * SPEC 14, 14.20: the UTF-16 length of the longest prefix of `text` — a
 * code source TypeScript's parse rejects — with which some well-formed
 * file begins. `diagnose` parses a text under the grammar the file name
 * selects.
 */
export function tsSyntaxFailureOffset(
  text: string,
  diagnose: (text: string) => SyntaxDiagnosis,
): number {
  const point = failurePoint(text, diagnose(text));
  if (point === null || point >= text.length) return text.length;
  const head = text.slice(0, point);
  return extendIntoToken(text, point, TYPESCRIPT_VOCABULARY, (spelling) => {
    const probe = head + spelling;
    const failure = failurePoint(probe, diagnose(probe));
    return failure === null || failure >= probe.length;
  });
}
