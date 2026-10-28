// JSON text given in consecutive chunks, parsed (SPEC 10.1, 12.0, 14.21).
//
// Pure core. A stored review session is one JSON document
// (core/review.ts) that can pass V8's cap on a string's length (2^29 − 24
// code units): an audit session holds every node's texts, quadratic in a
// long embedding chain's length (SPEC 3, 5.3 bound no chain; 10.6).
// `parseJsonChunks` parses the text in the consecutive chunks it is
// decoded in, so the document is never one string, and gives exactly the
// value `JSON.parse` gives the chunks' concatenation: objects with own
// data properties in source order — a repeated name's last value standing
// at its first position, `__proto__` an ordinary name — numbers as
// `Number` reads their spelling (the same correctly rounded value), and
// every string as its escapes decode. It fails exactly where `JSON.parse`
// would, on any text outside JSON's grammar (ECMA-404: one value between
// optional whitespace — space, tab, line feed, carriage return): the one
// judgement of whether a session file "cannot be parsed" (SPEC 10.1 →
// 14.21), whatever the text's layout. Its messages are its own.
//
// It is iterative — an explicit stack of open containers — so no nesting
// depth can exhaust the call stack, and it decodes every string literal
// with `JSON.parse` itself: whole where the literal lies in one chunk;
// else segment by segment, each cut where no escape sequence spans it
// (`escapeFreeCut`), so a literal can outgrow the cap while its value does
// not (a line feed's escape is two code units). Decoding a segment alone
// is decoding its part of the whole: an escape is self-contained, a cut
// between a surrogate pair's halves leaves halves that concatenate back
// into the pair, and a cut never repairs a literal — an invalid escape or
// control character fails the segment holding it.

/** The outcome of parsing a JSON text. */
export type JsonParseResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly message: string };

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const SPACE = 0x20;
const QUOTE = 0x22;
const PLUS = 0x2b;
const COMMA = 0x2c;
const MINUS = 0x2d;
const FULL_STOP = 0x2e;
const DIGIT_ZERO = 0x30;
const DIGIT_NINE = 0x39;
const COLON = 0x3a;
const UPPER_E = 0x45;
const OPEN_BRACKET = 0x5b;
const BACKSLASH = 0x5c;
const CLOSE_BRACKET = 0x5d;
const LOWER_E = 0x65;
const LOWER_F = 0x66;
const LOWER_N = 0x6e;
const LOWER_T = 0x74;
const LOWER_U = 0x75;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

const QUOTE_TEXT = String.fromCharCode(QUOTE);
const BACKSLASH_TEXT = String.fromCharCode(BACKSLASH);

/** A JSON number's spelling (ECMA-404), built without escapes. */
const NUMBER_SPELLING =
  /^-?(?:0|[1-9][0-9]*)(?:[.][0-9]+)?(?:[eE][+-]?[0-9]+)?$/;

/** A text outside JSON's grammar, at the position its message names. */
class JsonSyntaxError extends Error {}

/**
 * The text's chunks read in order: `text[pos]` is the next code unit,
 * `more` pulling the next non-empty chunk once `text` is consumed.
 */
class ChunkReader {
  readonly #chunks: Iterator<string>;
  #base = 0;
  text = "";
  pos = 0;

  constructor(chunks: Iterable<string>) {
    this.#chunks = chunks[Symbol.iterator]();
  }

  /** Whether a code unit is left to read (then at `text[pos]`). */
  more(): boolean {
    while (this.pos >= this.text.length) {
      const next = this.#chunks.next();
      if (next.done === true) {
        return false;
      }
      this.#base += this.text.length;
      this.text = next.value;
      this.pos = 0;
    }
    return true;
  }

  /** The next code unit, or -1 at the end of the text. */
  peek(): number {
    return this.more() ? this.text.charCodeAt(this.pos) : -1;
  }

  /** The offset of the next code unit from the text's start. */
  get offset(): number {
    return this.#base + this.pos;
  }
}

/**
 * Parse the JSON text that `chunks` concatenate to (module header): the
 * value `JSON.parse` would give, or the reason it would throw.
 */
export function parseJsonChunks(chunks: Iterable<string>): JsonParseResult {
  const reader = new ChunkReader(chunks);
  try {
    const value = parseValue(reader);
    skipWhitespace(reader);
    if (reader.more()) {
      throw syntaxError(reader.offset, "text follows the JSON value");
    }
    return { ok: true, value };
  } catch (error) {
    if (error instanceof JsonSyntaxError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

function syntaxError(offset: number, what: string): JsonSyntaxError {
  return new JsonSyntaxError(`${what} at position ${String(offset)}`);
}

/** An open array, or an open object with the name of its pending member. */
type OpenContainer =
  | { readonly kind: "array"; readonly value: unknown[] }
  | {
      readonly kind: "object";
      readonly value: Record<string, unknown>;
      name: string;
    };

/** One JSON value from the reader's position, containers on a stack. */
function parseValue(reader: ChunkReader): unknown {
  const open: OpenContainer[] = [];
  for (;;) {
    skipWhitespace(reader);
    const code = reader.peek();
    let value: unknown;
    if (code === OPEN_BRACKET) {
      reader.pos += 1;
      skipWhitespace(reader);
      if (reader.peek() !== CLOSE_BRACKET) {
        open.push({ kind: "array", value: [] });
        continue;
      }
      reader.pos += 1;
      value = [];
    } else if (code === OPEN_BRACE) {
      reader.pos += 1;
      skipWhitespace(reader);
      if (reader.peek() !== CLOSE_BRACE) {
        open.push({ kind: "object", value: {}, name: readName(reader) });
        continue;
      }
      reader.pos += 1;
      value = {};
    } else if (code === QUOTE) {
      value = readString(reader);
    } else if (code === MINUS || (code >= DIGIT_ZERO && code <= DIGIT_NINE)) {
      value = readNumber(reader);
    } else if (code === LOWER_T) {
      readWord(reader, "true");
      value = true;
    } else if (code === LOWER_F) {
      readWord(reader, "false");
      value = false;
    } else if (code === LOWER_N) {
      readWord(reader, "null");
      value = null;
    } else {
      throw unexpected(reader, "a JSON value");
    }
    // The value completes the innermost open container's element or
    // member; every container its closing bracket or brace ends completes
    // the one around it in turn.
    for (;;) {
      const container = open[open.length - 1];
      if (container === undefined) {
        return value;
      }
      if (container.kind === "array") {
        container.value.push(value);
      } else {
        defineMember(container.value, container.name, value);
      }
      skipWhitespace(reader);
      const next = reader.peek();
      if (next === COMMA) {
        reader.pos += 1;
        if (container.kind === "object") {
          container.name = readName(reader);
        }
        break;
      }
      if (next !== (container.kind === "array" ? CLOSE_BRACKET : CLOSE_BRACE)) {
        throw unexpected(
          reader,
          container.kind === "array"
            ? "a comma or the closing bracket after an array element"
            : "a comma or the closing brace after an object member",
        );
      }
      reader.pos += 1;
      open.pop();
      value = container.value;
    }
  }
}

/** The failure of meeting anything but `expected` at the reader's position. */
function unexpected(reader: ChunkReader, expected: string): JsonSyntaxError {
  const code = reader.peek();
  return syntaxError(
    reader.offset,
    code < 0
      ? `the text ends where ${expected} is expected`
      : `${JSON.stringify(String.fromCharCode(code))} found where ` +
          `${expected} is expected`,
  );
}

/**
 * Add a member as `JSON.parse` does (CreateDataProperty): an own,
 * enumerable, writable data property — a repeated name's value replacing
 * the earlier one in place, and `__proto__` an ordinary name, never the
 * prototype's setter.
 */
function defineMember(
  object: Record<string, unknown>,
  name: string,
  value: unknown,
): void {
  if (name === "__proto__") {
    Object.defineProperty(object, name, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } else {
    object[name] = value;
  }
}

/** JSON whitespace: space, tab, line feed, carriage return (ECMA-404). */
function skipWhitespace(reader: ChunkReader): void {
  while (reader.more()) {
    const text = reader.text;
    let pos = reader.pos;
    while (pos < text.length) {
      const code = text.charCodeAt(pos);
      if (
        code !== SPACE &&
        code !== LINE_FEED &&
        code !== CARRIAGE_RETURN &&
        code !== TAB
      ) {
        reader.pos = pos;
        return;
      }
      pos += 1;
    }
    reader.pos = pos;
  }
}

/** An object member's name and the colon after it. */
function readName(reader: ChunkReader): string {
  skipWhitespace(reader);
  if (reader.peek() !== QUOTE) {
    throw unexpected(reader, "a string naming an object member");
  }
  const name = readString(reader);
  skipWhitespace(reader);
  if (reader.peek() !== COLON) {
    throw unexpected(reader, "a colon after an object member's name");
  }
  reader.pos += 1;
  return name;
}

/** The literal `word` (`true`, `false`, `null`), code unit by code unit. */
function readWord(reader: ChunkReader, word: string): void {
  for (let index = 0; index < word.length; index += 1) {
    if (reader.peek() !== word.charCodeAt(index)) {
      throw unexpected(reader, `the literal ${word}`);
    }
    reader.pos += 1;
  }
}

function isNumberUnit(code: number): boolean {
  return (
    (code >= DIGIT_ZERO && code <= DIGIT_NINE) ||
    code === MINUS ||
    code === PLUS ||
    code === FULL_STOP ||
    code === LOWER_E ||
    code === UPPER_E
  );
}

/**
 * A number: the longest run of code units a number's spelling can hold —
 * which, where `JSON.parse` accepts the text, is exactly its number token,
 * whatever follows being no such code unit — checked against JSON's
 * grammar and read by `Number`.
 */
function readNumber(reader: ChunkReader): number {
  const start = reader.offset;
  let spelling = "";
  while (reader.more()) {
    const text = reader.text;
    const from = reader.pos;
    let pos = from;
    while (pos < text.length && isNumberUnit(text.charCodeAt(pos))) {
      pos += 1;
    }
    spelling += text.slice(from, pos);
    reader.pos = pos;
    if (pos < text.length) {
      break;
    }
  }
  if (!NUMBER_SPELLING.test(spelling)) {
    throw syntaxError(start, `the malformed number ${spelling}`);
  }
  return Number(spelling);
}

/**
 * A string, from its opening quote: the literal ends at the first quote
 * not escaped — one an even run of backslashes precedes, the run counted
 * across chunk boundaries — and decodes by `JSON.parse` (module header):
 * whole when it lies in one chunk, else in segments, the content up to an
 * escape-free cut decoded as each chunk ends and the rest carried on.
 */
function readString(reader: ChunkReader): string {
  const start = reader.offset;
  let text = reader.text;
  let segmentStart = reader.pos + 1;
  let from = segmentStart;
  // Once the literal leaves its first chunk: the decoded segments, the
  // content after the last cut, and the run of backslashes ending the
  // content before `segmentStart`.
  let parts: string[] | null = null;
  let carry = "";
  let trailing = 0;
  for (;;) {
    const quote = text.indexOf(QUOTE_TEXT, from);
    if (quote < 0) {
      const content = carry + text.slice(segmentStart);
      trailing = backslashesEnding(text, segmentStart, text.length, trailing);
      const cut = escapeFreeCut(content);
      parts ??= [];
      parts.push(decodeContent(content.slice(0, cut), start));
      carry = content.slice(cut);
      reader.pos = text.length;
      if (!reader.more()) {
        throw syntaxError(start, "the string opened here is not closed");
      }
      text = reader.text;
      segmentStart = reader.pos;
      from = segmentStart;
      continue;
    }
    let run = quote - firstOfRun(text, segmentStart, quote);
    if (run === quote - segmentStart) {
      run += trailing;
    }
    if (run % 2 === 1) {
      // An escaped quote: the content goes on.
      from = quote + 1;
      continue;
    }
    reader.pos = quote + 1;
    if (parts === null) {
      return decodeLiteral(text.slice(segmentStart - 1, quote + 1), start);
    }
    parts.push(decodeContent(carry + text.slice(segmentStart, quote), start));
    return parts.join("");
  }
}

/**
 * The start of the run of backslashes ending just before `end` in `text`,
 * never before `from`: `end` itself when none precedes it.
 */
function firstOfRun(text: string, from: number, end: number): number {
  let index = end;
  while (index > from && text.charCodeAt(index - 1) === BACKSLASH) {
    index -= 1;
  }
  return index;
}

/**
 * The run of backslashes ending the content up to `end`, given the run
 * `previous` ending the content before `from` — which continues only
 * where all of `text` from `from` to `end` is backslashes.
 */
function backslashesEnding(
  text: string,
  from: number,
  end: number,
  previous: number,
): number {
  const first = firstOfRun(text, from, end);
  return first === from ? previous + (end - from) : end - first;
}

/**
 * The longest prefix of a string literal's `content` — which begins
 * outside any escape sequence — that no escape sequence runs past: its
 * whole length unless the last backslash, within the last five code
 * units, opens an escape (two code units, or six with `u`) the content
 * ends inside, which then begins the carry. A backslash opens an escape
 * where an even number of backslashes precedes it in its run; one closing
 * a pair of backslashes ends that escape.
 */
function escapeFreeCut(content: string): number {
  const end = content.length;
  const last = content.lastIndexOf(BACKSLASH_TEXT);
  if (last < end - 5) {
    return end;
  }
  if ((last - firstOfRun(content, 0, last)) % 2 === 1) {
    return end;
  }
  const length =
    last + 1 < end && content.charCodeAt(last + 1) === LOWER_U ? 6 : 2;
  return last + length <= end ? end : last;
}

/** A whole string literal, quotes included, decoded. */
function decodeLiteral(literal: string, start: number): string {
  try {
    return JSON.parse(literal) as string;
  } catch {
    throw syntaxError(start, "a malformed string begins");
  }
}

/** Part of a string literal's content, cut where no escape spans, decoded. */
function decodeContent(content: string, start: number): string {
  return decodeLiteral(QUOTE_TEXT + content + QUOTE_TEXT, start);
}
