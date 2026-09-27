// SPEC 14's location rule for a syntax failure: the shared step that
// carries a parser's failure position into the offending token.
//
// SPEC 14: an unparseable source (14.20) carries one zero-length range at
// the failure's offset — for a syntax failure, "the byte length of the
// longest whole-character prefix of the file with which some well-formed
// file begins", an offset the grammar alone fixes. A parser reports a
// syntax failure at the start of the first token it cannot accept, but the
// longest such prefix may run on into that token: through every character
// that some token the grammar accepts there begins with. `!` in `a!}`
// begins `!=`, so the prefix ending after `!` is viable and the `}` is the
// failure; TypeScript flags `010` at its start, while `0` is itself a
// literal and `01` begins none TypeScript accepts. The language modules
// (`js-syntax-failure.ts`, `ts-syntax-failure.ts`) supply the parser that
// judges each probe and the language's fixed token vocabulary.

/** The length of the longest common prefix of `spelling` and `text` at `at`. */
export function commonPrefixLength(
  spelling: string,
  text: string,
  at: number,
): number {
  let length = 0;
  while (
    length < spelling.length &&
    at + length < text.length &&
    spelling.charCodeAt(length) === text.charCodeAt(at + length)
  ) {
    length += 1;
  }
  return length;
}

/** An identifier's first character (ECMAScript and TypeScript alike). */
const IDENTIFIER_START = /^[\p{ID_Start}$_]/u;
/** An identifier's characters: the longest run at a position. */
const IDENTIFIER_RUN = /^[\p{ID_Continue}$‌‍]+/u;
/** A numeric literal's characters, generously: digits, letters, `_`, `.`. */
const NUMERIC_RUN = /^\.?[0-9][0-9A-Za-z_.]*/;

/**
 * The spellings the token at `at` could have begun, each probed whole: every
 * vocabulary entry — the language's punctuators and reserved and contextual
 * words — sharing its first character; for an identifier-like token (a
 * private name's `#` included), an identifier extending it, so that a word
 * the grammar rejects only as a whole (`class` where an identifier may
 * stand) keeps its characters; and for a numeric token, each of its own
 * prefixes, the literals it begins.
 */
function candidateSpellings(
  text: string,
  at: number,
  vocabulary: readonly string[],
): string[] {
  const rest = text.slice(at);
  const first = rest.charAt(0);
  const spellings = vocabulary.filter((entry) => entry.charAt(0) === first);
  const hash = first === "#" ? 1 : 0;
  const word = rest.slice(hash);
  if (IDENTIFIER_START.test(word)) {
    const run = IDENTIFIER_RUN.exec(word);
    if (run !== null) spellings.push(rest.slice(0, hash) + run[0] + "_");
  }
  const numeric = NUMERIC_RUN.exec(rest);
  if (numeric !== null) {
    for (let length = numeric[0].length; length >= 1; length -= 1) {
      spellings.push(numeric[0].slice(0, length));
    }
  }
  return spellings;
}

/**
 * SPEC 14: the end of the longest viable prefix, given a failure at the
 * start of the token at `at` — `at` itself, extended by the longest run of
 * that token's characters some acceptable spelling begins with.
 * `accepts(spelling)` reports whether `text.slice(0, at) + spelling` is a
 * viable prefix: its parse fails at its own end, if at all.
 */
export function extendIntoToken(
  text: string,
  at: number,
  vocabulary: readonly string[],
  accepts: (spelling: string) => boolean,
): number {
  let best = 0;
  for (const spelling of candidateSpellings(text, at, vocabulary)) {
    const common = commonPrefixLength(spelling, text, at);
    if (common > best && accepts(spelling)) best = common;
  }
  return at + best;
}
