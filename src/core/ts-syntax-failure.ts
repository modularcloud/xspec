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
// without a closing tag is reported at its opening tag, the failure being
// where the closing tag that ended it departs from its name; and a
// diagnostic at or past
// the end-of-file token is the end's, the whole file a viable prefix. From
// there the prefix may run on into the offending token (`extendIntoToken`):
// TypeScript flags `010` at its start, while the prefix `0` begins a
// well-formed file and `01` none.

import ts from "./ts-module.js";
import type * as tst from "typescript";
import { closingTagDivergence, extendIntoToken } from "./viable-prefix.js";

/** A text's parse: its syntactic diagnostics, beside its tree. */
export interface SyntaxDiagnosis {
  readonly sourceFile: tst.SourceFile;
  readonly diagnostics: readonly tst.Diagnostic[];
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

/**
 * A JSX element reported without a closing tag at its opening tag's name
 * (`start`): TypeScript closes it where its children end, at the closing
 * tag its parent's name took — the failure is where that tag's name
 * departs from the element's (`<a><b></` is viable, `<a><b></a` is not),
 * or the end when the file ends first.
 */
function unclosedElementPoint(
  sourceFile: tst.SourceFile,
  start: number,
): number {
  let point = start;
  const visit = (node: tst.Node): void => {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getStart(sourceFile) === start
    ) {
      point = closingTagDivergence(
        sourceFile.text,
        node.children.end,
        node.openingElement.tagName.getText(sourceFile),
      );
      return;
    }
    if (node.pos <= start && start < node.end) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return point;
}

/** Where a diagnosed text fails, or null when it is well-formed. */
function failurePoint(text: string, diagnosis: SyntaxDiagnosis): number | null {
  const { sourceFile, diagnostics } = diagnosis;
  if (diagnostics.length === 0) return null;
  const at = (diagnostic: tst.Diagnostic): number => {
    const start = diagnostic.start ?? 0;
    switch (diagnostic.code) {
      case UNTERMINATED_REGULAR_EXPRESSION:
        return start + (diagnostic.length ?? 0);
      case ELEMENT_WITHOUT_CLOSING_TAG:
        return unclosedElementPoint(sourceFile, start);
      default:
        return start;
    }
  };
  let point = Number.POSITIVE_INFINITY;
  let conflict = false;
  for (const diagnostic of diagnostics) {
    const here = at(diagnostic);
    if (here < point) {
      point = here;
      conflict = false;
    }
    if (here === point && diagnostic.code === CONFLICT_MARKER) conflict = true;
  }
  // A failure in the trivia before the end is the end's — unless it is a
  // conflict marker, which no continuation completes.
  if (point >= sourceFile.endOfFileToken.pos && !conflict) return text.length;
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
