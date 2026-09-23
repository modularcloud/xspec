// TEST-SPEC S-9's derivability check: whether an MDX source derives under
// the grammar SPEC 14.20 fixes — MDX syntax at major version 3, decided by
// derivability alone. Harness machinery only: no product imports, no I/O,
// no test-framework dependence; the workspace builder and the property
// runner judge every staged fixture and every generator draw through it,
// and its self-test (test/self/s9-fixture-well-formedness.test.ts) holds
// the document's worked well-formed and declared-unparseable shapes.
//
// The check is made by a means independent of the product (S-9): the stock
// MDX 3 parser declared as the harness's own devDependencies — `fromMarkdown`
// with the `mdxjs()` micromark extension and the `mdxFromMarkdown()` mdast
// extension. JSX tag matching lives in the mdast layer, so the full parse is
// what decides, never the tokenizer alone (which accepts an unclosed or
// mismatched tag). The extension parses expressions and ESM blocks with
// acorn at ecmaVersion 2024 in module mode, the edition 14.20 names; its
// `acorn` option (default `Parser.extend(acornJsx())`, from the `acorn` and
// `acorn-jsx` packages the extension itself depends on) is where the one
// rule beyond derivability the tool applies is taken out, below.
//
// Two rules the parser does not apply are 14.20's: a source that is not
// valid UTF-8, or that begins with a byte-order mark, is unparseable (SPEC
// 1.6, 14.20), so bytes are decoded with `fatal: true` and `ignoreBOM: true`
// and both are non-derivations here — the stock parser itself accepts a
// leading U+FEFF.
//
// The rule the tool applies beyond derivability is ECMAScript's static-
// semantic early errors, which acorn enforces while 14.20 admits the forms
// (a file failing only such a rule is well-formed and proceeds to its
// ordinary finding). S-9 lists the harness's known allowances — two imports
// binding one identifier, `export { nope }`, `{1 = 2}`, `{let}`, `{010}` —
// and the caller names the one a staging relies on. An allowance is applied
// inside the parse, not after it: the extension is given an acorn parser
// whose `raise`/`raiseRecoverable` swallow exactly the named early errors,
// matched on acorn's own message (and, for the legacy octal, the literal at
// acorn's position, since "Invalid number" is also a lexical failure's
// message), so that the parse continues — acorn's code after those raises is
// continuable, `raiseRecoverable` existing for that — and any later
// rejection in the file still surfaces. Hence any other rejection, any
// rejection under an unnamed allowance, and every MDX-syntax rejection are
// non-derivations, wherever in the file they stand. The stock parser judges
// all of a file's ESM blocks as one module, so the duplicate-binding early
// error is raised for a second import in another block exactly as for one
// in the same block; 14.20 admits both spellings (the 2.1 collisions
// "within one ESM block or across blocks" are findings in a well-formed
// file), so `duplicate-import-binding` covers both.

import { Parser } from "acorn";
import type { Program } from "acorn";
import acornJsx from "acorn-jsx";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { mdxjs } from "micromark-extension-mdxjs";

/** S-9's named allowances — ECMAScript early errors 14.20 admits. */
export const MDX_ALLOWANCES = [
  // Two imports binding one identifier (T2.1-3, T4.5-8; SPEC 14.15).
  "duplicate-import-binding",
  // `export { nope }` — an export naming no declaration (T14-12).
  "undefined-export",
  // `{1 = 2}` — an assignment to a target that is not simple (T14-12).
  "invalid-assignment-target",
  // `{let}` — `let` as an identifier reference, a strict-mode restriction.
  "let-as-identifier",
  // `{010}` — a legacy octal literal, a strict-mode restriction (T14-12).
  "legacy-octal",
] as const;

export type MdxAllowance = (typeof MDX_ALLOWANCES)[number];

/** Where a rejection lies: the parser's 1-based line and column, and the
 * 0-based offset — a byte offset for a decoding failure, and for a parser
 * rejection an index into the decoded text as the parser counts it (UTF-16
 * code units, JavaScript string indices). */
export interface MdxPosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

export type MdxVerdict =
  | { readonly derives: true }
  | {
      readonly derives: false;
      readonly reason: string;
      readonly position?: MdxPosition;
    };

export interface DeriveMdxOptions {
  /** The early errors this source is declared to rely on; nothing else. */
  readonly allowances?: readonly MdxAllowance[];
}

interface AllowanceRule {
  /** The early error belongs to a program parse — an ESM block — alone. */
  readonly programOnly: boolean;
  /** acorn's message for exactly this early error (before its position suffix). */
  readonly message: RegExp;
  /** A further test on acorn's input at the raise position where the message is shared. */
  readonly refine?: (input: string, pos: number) => boolean;
}

const ALLOWANCE_RULES: Readonly<Record<MdxAllowance, AllowanceRule>> = {
  "duplicate-import-binding": {
    programOnly: true,
    message: /^Identifier '.+' has already been declared$/,
  },
  "undefined-export": {
    programOnly: true,
    message: /^Export '.+' is not defined$/,
  },
  "invalid-assignment-target": {
    programOnly: false,
    message: /^Assigning to rvalue$/,
  },
  "let-as-identifier": {
    programOnly: false,
    message: /^The keyword 'let' is reserved$/,
  },
  "legacy-octal": {
    programOnly: false,
    // acorn raises "Invalid number" at a numeric literal's start both for a
    // legacy numeric literal in strict mode (a `0` followed by digits) and
    // for a lexically malformed number (`1e`): only the former is admitted.
    message: /^Invalid number$/,
    refine: (input, pos) => /^0[0-9]/.test(input.slice(pos, pos + 2)),
  },
};

// The stock extension's parser: acorn with JSX, as `mdxjs()` builds it.
const JsxParser = Parser.extend(acornJsx());

type Raise = (this: Parser, pos: number, message: string) => never;
// acorn's raise methods are prototype members its declarations leave out.
const BASE_RAISE = JsxParser.prototype as unknown as {
  readonly raise: Raise;
  readonly raiseRecoverable: Raise;
};

/** The stock parser tolerating exactly the named early errors. */
function lenientParser(allowances: readonly MdxAllowance[]): typeof Parser {
  const rules = allowances.map((name) => ALLOWANCE_RULES[name]);
  return class LenientParser extends JsxParser {
    // Set by the program parse an ESM block gets; an expression parse
    // (`parseExpressionAt`) never calls `parse()`.
    private program = false;

    override parse(): Program {
      this.program = true;
      return super.parse();
    }

    private tolerates(pos: number, message: string): boolean {
      return rules.some(
        (rule) =>
          (!rule.programOnly || this.program) &&
          rule.message.test(message) &&
          (rule.refine === undefined || rule.refine(this.input, pos)),
      );
    }

    raise(pos: number, message: string): void {
      if (!this.tolerates(pos, message))
        BASE_RAISE.raise.call(this, pos, message);
    }

    raiseRecoverable(pos: number, message: string): void {
      if (!this.tolerates(pos, message))
        BASE_RAISE.raiseRecoverable.call(this, pos, message);
    }
  };
}

// One extension set per distinct allowance set (the extension captures its
// parser); `fromMarkdown` builds a fresh tokenizer per call.
const EXTENSIONS = new Map<string, ReturnType<typeof mdxjs>>();
const MDAST_EXTENSIONS = [mdxFromMarkdown()];

function extensionsFor(
  allowances: readonly MdxAllowance[],
): ReturnType<typeof mdxjs> {
  const named = [...new Set(allowances)].sort();
  const key = named.join(",");
  let extension = EXTENSIONS.get(key);
  if (extension === undefined) {
    extension = mdxjs({ acorn: lenientParser(named) });
    EXTENSIONS.set(key, extension);
  }
  return extension;
}

// The parser throws a VFileMessage; it is matched structurally (its package
// is a transitive dependency, not one the harness declares).
interface ParserMessage {
  readonly reason: string;
  readonly source?: unknown;
  readonly ruleId?: unknown;
  readonly place?: unknown;
  readonly cause?: unknown;
}

function isParserMessage(error: unknown): error is ParserMessage {
  return (
    error instanceof Error &&
    typeof (error as { reason?: unknown }).reason === "string" &&
    "source" in error
  );
}

/**
 * A `devlop` assertion — `name` "Assertion", `code` "ERR_ASSERTION" — from
 * the development build of the parser stack, which a test runner resolving
 * the `development` export condition (Vitest) loads in place of the
 * production build. The mdast layer asserts its node stack's consistency at
 * each construct's exit, and ill-formed nesting — a setext heading ending
 * while the JSX element opened inside its paragraph is still open, as
 * T6.5-16(d)'s `===` remainder leaves it — trips that assertion before the
 * element-matching rejection the production build raises for the same text
 * (verified: the production build rejects it with "Expected a closing tag
 * for `<S>` … before the end of `setextHeading`"); the assertion is that
 * rejection, a non-derivation. An exhausted stack is a `RangeError`, never
 * this.
 */
function isDevelopmentAssertion(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.name === "Assertion" &&
    (error as { code?: unknown }).code === "ERR_ASSERTION"
  );
}

function isPoint(value: unknown): value is MdxPosition {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { line?: unknown }).line === "number" &&
    typeof (value as { column?: unknown }).column === "number" &&
    typeof (value as { offset?: unknown }).offset === "number"
  );
}

function pointOf(place: unknown): MdxPosition | undefined {
  if (isPoint(place)) {
    return { line: place.line, column: place.column, offset: place.offset };
  }
  const start = (place as { start?: unknown } | null | undefined)?.start;
  return isPoint(start)
    ? { line: start.line, column: start.column, offset: start.offset }
    : undefined;
}

/** Decides whether `source` is well-formed MDX under SPEC 14.20: bytes are
 * the file's bytes (decoded here as 14.20 reads them); a string is taken as
 * already-decoded content, so a leading U+FEFF is its byte-order mark. */
export function deriveMdx(
  source: Uint8Array | string,
  options?: DeriveMdxOptions,
): MdxVerdict {
  let text: string;
  if (typeof source === "string") {
    const lone = firstLoneSurrogate(source);
    if (lone !== undefined) {
      return {
        derives: false,
        reason: `not encodable as UTF-8: a lone surrogate at index ${lone}`,
        position: positionAt(source, lone),
      };
    }
    text = source;
  } else {
    const invalid = firstInvalidUtf8(source);
    if (invalid !== undefined) {
      const prefix = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
        source.subarray(0, invalid),
      );
      const point = positionAt(prefix, prefix.length);
      return {
        derives: false,
        reason: `not valid UTF-8: an invalid sequence at byte offset ${invalid}`,
        position: { line: point.line, column: point.column, offset: invalid },
      };
    }
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      source,
    );
  }
  if (text.charCodeAt(0) === 0xfeff) {
    return {
      derives: false,
      reason: "begins with a byte-order mark (U+FEFF)",
      position: { line: 1, column: 1, offset: 0 },
    };
  }
  try {
    fromMarkdown(text, {
      extensions: [extensionsFor(options?.allowances ?? [])],
      mdastExtensions: MDAST_EXTENSIONS,
    });
    return { derives: true };
  } catch (error) {
    if (isDevelopmentAssertion(error)) {
      return {
        derives: false,
        reason: `parser development-build assertion: ${error.message}`,
      };
    }
    if (!isParserMessage(error)) {
      // Not a grammar verdict (an internal failure such as exhausted stack):
      // never reported as a non-derivation.
      throw error;
    }
    const where = [error.source, error.ruleId]
      .filter((part) => typeof part === "string")
      .join(" ");
    const cause =
      error.cause instanceof Error ? `: ${error.cause.message}` : "";
    return {
      derives: false,
      reason: `${where.length > 0 ? `${where}: ` : ""}${error.reason}${cause}`,
      position: pointOf(error.place),
    };
  }
}

/** The 1-based line and column of `index` in `text`, counting the line
 * endings the parser counts (U+000A, U+000D, and U+000D U+000A as one). */
function positionAt(text: string, index: number): MdxPosition {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index; i++) {
    const code = text.charCodeAt(i);
    // A U+000D followed by U+000A is one line ending, counted at the U+000A.
    if (code === 0x0a || (code === 0x0d && text.charCodeAt(i + 1) !== 0x0a)) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: index - lineStart + 1, offset: index };
}

function firstLoneSurrogate(text: string): number | undefined {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return i;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return i;
    }
  }
  return undefined;
}

/** The byte offset of the first ill-formed UTF-8 sequence (the Unicode
 * well-formed byte sequences of Table 3-7: no overlongs, no surrogates, no
 * code points above U+10FFFF, no truncation), or undefined when the bytes
 * are valid — the same verdict as a `fatal` TextDecoder's, located. */
function firstInvalidUtf8(bytes: Uint8Array): number | undefined {
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i] as number;
    if (b0 < 0x80) {
      i++;
      continue;
    }
    let need: number;
    let lo = 0x80;
    let hi = 0xbf;
    if (b0 >= 0xc2 && b0 <= 0xdf) {
      need = 1;
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      need = 2;
      if (b0 === 0xe0) lo = 0xa0;
      if (b0 === 0xed) hi = 0x9f;
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      need = 3;
      if (b0 === 0xf0) lo = 0x90;
      if (b0 === 0xf4) hi = 0x8f;
    } else {
      return i;
    }
    for (let k = 1; k <= need; k++) {
      const b = bytes[i + k];
      const min = k === 1 ? lo : 0x80;
      const max = k === 1 ? hi : 0xbf;
      if (b === undefined || b < min || b > max) {
        // A stray continuation byte, an overlong or out-of-range sequence,
        // or one truncated at the end of the input.
        return i;
      }
    }
    i += need + 1;
  }
  return undefined;
}
