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
//
// The Unicode version is 14.20's, never the tool's (S-9): ECMAScript 2024
// takes its identifier characters — an expression's and a JSX name's alike —
// and its space separators from Unicode 15.1, judged code point by code
// point. The stock tools judge otherwise, and are corrected here: acorn 8.17's
// identifier tables are Unicode 17's (U+1C89, a Unicode 16 letter, begins an
// identifier there); micromark-extension-mdx-jsx judges a JSX name one UTF-16
// code unit at a time, so no astral character (U+2EBF0, which 15.1 added)
// enters a name, and by the runtime's tables otherwise (Unicode 17 on Node
// 22, U+1C89 again); acorn-jsx reads a JSX name inside an expression one code
// unit at a time too. Unicode 15.1's identifier characters are TypeScript
// 5.9.3's ESNext identifier tables (the harness's own `typescript-5.9.3`),
// equal to 15.1's ID_Start and ID_Continue code point for code point (checked,
// when this check was written, against both properties derived from Unicode
// 15.1's character database: its general categories, Other_ID_Start,
// Other_ID_Continue, Pattern_Syntax, and Pattern_White_Space; the self-test
// pins the version-boundary code points). acorn's identifiers are held to
// them as tokens finish (`Unicode151Parser`), the MDX tokenizer's JSX names
// by an adapter presenting each code point to it as 15.1 classes it
// (`withUnicode151Jsx`). Space separators: acorn's are a fixed list, 15.1's
// (the self-test checks it); the JSX adapter presents in-tag whitespace by
// 15.1; and the empty-expression judgement of micromark-util-events-to-acorn
// reads the runtime's `\s`, so the runtime's class is checked to be 15.1's
// before any judgement (`checkRuntimeWhitespace`).

import { Parser, tokTypes } from "acorn";
import type { Program } from "acorn";
import acornJsx from "acorn-jsx";
import { fromMarkdown } from "mdast-util-from-markdown";
import { mdxFromMarkdown } from "mdast-util-mdx";
import { mdxjs } from "micromark-extension-mdxjs";
import ts from "typescript-5.9.3";

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

// ---------------------------------------------------------------------------
// Unicode 15.1's identifier characters and whitespace (SPEC 14.20, S-9).

const ESNEXT = ts.ScriptTarget.ESNext;

/** ECMAScript 2024's IdentifierStartChar under Unicode 15.1: ID_Start, `$`,
 * and `_` — TypeScript 5.9.3's ESNext table, 15.1's code point for code
 * point. */
function isIdentifierStart151(code: number): boolean {
  return ts.isIdentifierStart(code, ESNEXT);
}

/** IdentifierPartChar under Unicode 15.1: ID_Continue (U+200C and U+200D
 * among it since 15.1) and `$`. */
function isIdentifierPart151(code: number): boolean {
  return ts.isIdentifierPart(code, ESNEXT);
}

/** ECMAScript 2024's WhiteSpace and LineTerminator under Unicode 15.1 — TAB,
 * VT, FF, ZWNBSP, 15.1's space separators (general category Zs), LF, CR, LS,
 * and PS: what the grammar skips between tokens and what `\s` matches. */
const WHITESPACE_151: ReadonlySet<number> = new Set([
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680, 0x2000,
  0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009,
  0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
]);

function isWhitespace151(code: number): boolean {
  return WHITESPACE_151.has(code);
}

let runtimeWhitespaceChecked = false;

/**
 * micromark-util-events-to-acorn judges an empty expression (an MDX comment)
 * and the content after an expression's one expression with the runtime's
 * `\s`, whose space separators are the runtime's Unicode version's: the
 * judgement is 15.1's only where that class is 15.1's, so it is checked once,
 * code unit by code unit (the test is a UTF-16 one), before any judgement — a
 * runtime whose class differs makes every judgement a harness error, never a
 * verdict under another Unicode version.
 */
function checkRuntimeWhitespace(): void {
  if (runtimeWhitespaceChecked) return;
  const whitespace = /\s/;
  for (let code = 0; code <= 0xffff; code++) {
    if (whitespace.test(String.fromCharCode(code)) !== isWhitespace151(code)) {
      throw new Error(
        `S-9's MDX check: this runtime's whitespace class differs from Unicode 15.1's at ${codePointName(code)}, and the stock parser's empty-expression judgement reads it (SPEC 14.20)`,
      );
    }
  }
  runtimeWhitespaceChecked = true;
}

function codePointName(code: number): string {
  return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

function codePointLength(code: number): number {
  return code > 0xffff ? 2 : 1;
}

/** The first code point of an identifier's value that Unicode 15.1 does not
 * admit where it stands (a JSX name admits `-` after its first), with its
 * UTF-16 index, or undefined. */
function firstInadmissible(
  value: string,
  jsx: boolean,
): { readonly index: number; readonly code: number } | undefined {
  let index = 0;
  while (index < value.length) {
    const code = value.codePointAt(index) as number;
    const admitted =
      index === 0
        ? isIdentifierStart151(code)
        : isIdentifierPart151(code) || (jsx && code === 0x2d);
    if (!admitted) return { index, code };
    index += codePointLength(code);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The parser the extension parses expressions and ESM blocks with.

// The stock extension's parser: acorn with JSX, as `mdxjs()` builds it.
const JsxParser = Parser.extend(acornJsx());

/** acorn's regular-expression validation state, as the overrides read it. */
interface RegExpState {
  pos: number;
  lastIntValue: number;
}

/** acorn's tokenizer state, as the overrides read and set it. */
interface TokenizerState {
  pos: number;
  readonly start: number;
  readonly input: string;
  finishToken(type: unknown, value?: unknown): void;
  raise(pos: number, message: string): never;
}

type Raise = (this: Parser, pos: number, message: string) => never;
type FinishToken = (this: Parser, type: unknown, value?: unknown) => void;
type EatIdentifierCharacter = (this: Parser, state: RegExpState) => boolean;
// acorn's tokenizer and validator methods are prototype members its
// declarations leave out.
const BASE = JsxParser.prototype as unknown as {
  readonly raise: Raise;
  readonly raiseRecoverable: Raise;
  readonly finishToken: FinishToken;
  readonly regexp_eatRegExpIdentifierStart: EatIdentifierCharacter;
  readonly regexp_eatRegExpIdentifierPart: EatIdentifierCharacter;
};

// acorn-jsx's JSX name token type (built on the parser's own acorn, the one
// `Parser` and `tokTypes` come from).
const JSX_NAME: unknown = (
  JsxParser as unknown as {
    readonly acornJsx: { readonly tokTypes: { readonly jsxName: unknown } };
  }
).acornJsx.tokTypes.jsxName;

/**
 * The stock parser with its identifier characters Unicode 15.1's. acorn reads
 * an identifier code point by code point by its own tables, Unicode 17's — a
 * superset of 15.1's, as Unicode's identifier stability makes every later
 * version's (the self-test checks it code point by code point) — so every
 * text 15.1 admits tokenizes as before; every identifier token is then held
 * to 15.1 as it finishes — a name (its escapes decoded), a private name, a
 * JSX name — a code point 15.1 does not admit where it stands being the parse
 * failure 15.1's tables make of it, raised at that code point as acorn raises
 * an unexpected character. acorn-jsx reads a JSX name one UTF-16 code unit at
 * a time, so no astral character enters one; it is read here code point by
 * code point. A regular expression's group names (`(?<name>…)`, `\k<name>`)
 * are identifier names of the pattern grammar, held to 15.1 alike.
 */
class Unicode151Parser extends JsxParser {
  finishToken(type: unknown, value?: unknown): void {
    if (
      typeof value === "string" &&
      (type === tokTypes.name ||
        type === tokTypes.privateId ||
        type === JSX_NAME)
    ) {
      const jsx = type === JSX_NAME;
      const inadmissible = firstInadmissible(value, jsx);
      if (inadmissible !== undefined) {
        const tokenizer = this as unknown as TokenizerState;
        // Located in the raw spelling (a private name's follows its `#`);
        // a name spelled with an escape sequence, at its start.
        const rawStart =
          tokenizer.start + (type === tokTypes.privateId ? 1 : 0);
        const raw = tokenizer.input.slice(rawStart, tokenizer.pos);
        const at =
          raw === value ? rawStart + inadmissible.index : tokenizer.start;
        tokenizer.pos = at;
        tokenizer.raise(
          at,
          `Unexpected character '${String.fromCodePoint(inadmissible.code)}' (${codePointName(inadmissible.code)}): Unicode 15.1 does not admit it to ${inadmissible.index === 0 ? "begin" : "continue"} ${jsx ? "a JSX name" : "an identifier"} (SPEC 14.20)`,
        );
      }
    }
    BASE.finishToken.call(this, type, value);
  }

  // acorn-jsx's tag-context `readToken` has judged the first code point an
  // identifier start (acorn's tables, at the full code point); the rest are
  // 15.1's identifier parts and `-`, read code point by code point, and
  // `finishToken` holds the first to 15.1.
  jsx_readWord(): void {
    const tokenizer = this as unknown as TokenizerState;
    const { input } = tokenizer;
    const start = tokenizer.pos;
    let pos = start + codePointLength(input.codePointAt(start) as number);
    for (;;) {
      const code = input.codePointAt(pos);
      if (code === undefined) break;
      if (code !== 0x2d && !isIdentifierPart151(code)) break;
      pos += codePointLength(code);
    }
    tokenizer.pos = pos;
    tokenizer.finishToken(JSX_NAME, input.slice(start, pos));
  }

  regexp_eatRegExpIdentifierStart(state: RegExpState): boolean {
    return eatHeldTo151(
      this,
      state,
      BASE.regexp_eatRegExpIdentifierStart,
      isIdentifierStart151,
    );
  }

  regexp_eatRegExpIdentifierPart(state: RegExpState): boolean {
    return eatHeldTo151(
      this,
      state,
      BASE.regexp_eatRegExpIdentifierPart,
      isIdentifierPart151,
    );
  }
}

/** acorn's group-name character reader, its character held to 15.1. */
function eatHeldTo151(
  parser: Parser,
  state: RegExpState,
  eat: EatIdentifierCharacter,
  admits: (code: number) => boolean,
): boolean {
  const start = state.pos;
  if (!eat.call(parser, state)) return false;
  if (admits(state.lastIntValue)) return true;
  state.pos = start;
  return false;
}

/** The stock parser, its identifiers 15.1's, tolerating exactly the named
 * early errors. */
function lenientParser(allowances: readonly MdxAllowance[]): typeof Parser {
  const rules = allowances.map((name) => ALLOWANCE_RULES[name]);
  return class LenientParser extends Unicode151Parser {
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
      if (!this.tolerates(pos, message)) BASE.raise.call(this, pos, message);
    }

    raiseRecoverable(pos: number, message: string): void {
      if (!this.tolerates(pos, message))
        BASE.raiseRecoverable.call(this, pos, message);
    }
  };
}

// ---------------------------------------------------------------------------
// JSX names in the MDX tokenizer, by Unicode 15.1, code point by code point.

// micromark's types, read off the extension's own (the package declaring them
// is a transitive dependency, not one the harness declares).
type MdxExtension = ReturnType<typeof mdxjs>;
type ConstructRecord = NonNullable<MdxExtension["flow"]>;
type Construct = Exclude<
  NonNullable<ConstructRecord[string]>,
  readonly unknown[]
>;
type Tokenizer = Construct["tokenize"];
type Effects = Parameters<Tokenizer>[0];
type State = Parameters<Tokenizer>[1];
type Code = Parameters<State>[0];

/** The text `fromMarkdown` is reading, while it reads it. */
let parsedText: string | undefined;

// Stand-ins the stock tag tokenizer classes, under every Unicode version, as
// 15.1 classes the code points they stand for.
/** ª (Lo): begins and continues a name. */
const STAND_IN_START = 0x00aa;
/** A combining grave accent (Mn): continues a name, begins none. */
const STAND_IN_PART = 0x0300;
/** NO-BREAK SPACE (Zs): ECMAScript whitespace. */
const STAND_IN_SPACE = 0x00a0;
/** ¶ (Po): none of these. */
const STAND_IN_OTHER = 0x00b6;

function standIn(code: number): number {
  if (isWhitespace151(code)) return STAND_IN_SPACE;
  if (isIdentifierStart151(code)) return STAND_IN_START;
  if (isIdentifierPart151(code)) return STAND_IN_PART;
  return STAND_IN_OTHER;
}

/**
 * The extension with its JSX tag constructs reading Unicode 15.1. Inside a
 * tag — its token open — micromark-extension-mdx-jsx sees each non-ASCII code
 * point as a stand-in of the class 15.1 gives it (a name's start, a name's
 * part, whitespace, or none), an astral one whole: the tokenizer hands its
 * UTF-16 code units over one at a time, so its code point is read from the
 * text at micromark's offset, the stand-in shown for the first unit, and the
 * second consumed after it. A stand-in decides nothing but the tag grammar's
 * class tests: what the tag tokenizer consumes is always the actual code
 * unit, and every token's text — names, values, the expressions handed to
 * acorn — is the source's. Outside a tag (the flow construct's tail, and the
 * expression it may attempt there) every code passes as it is.
 */
function withUnicode151Jsx(extension: MdxExtension): MdxExtension {
  return {
    ...extension,
    flow: adaptJsxRecord(extension.flow, "mdxJsxFlowTag"),
    text: adaptJsxRecord(extension.text, "mdxJsxTextTag"),
  };
}

function adaptJsxRecord(
  record: ConstructRecord | undefined,
  name: string,
): ConstructRecord {
  const constructs = record?.[60];
  const list =
    constructs === undefined
      ? []
      : Array.isArray(constructs)
        ? constructs
        : [constructs];
  const construct = list[0];
  if (record === undefined || list.length !== 1 || construct?.name !== name) {
    throw new Error(
      `S-9's MDX check: the stock extension's \`<\` constructs are not the one ${name} its Unicode 15.1 JSX reader adapts`,
    );
  }
  return { ...record, 60: [adaptJsxConstruct(construct)] };
}

function adaptJsxConstruct(construct: Construct): Construct {
  const tagType = construct.name;
  const tokenize = construct.tokenize;
  return {
    ...construct,
    tokenize(effects, ok, nok) {
      const context = this;
      // Control has left the construct: its `ok` or `nok` ran.
      let left = false;
      // A tag token is open: its codes are presented by 15.1.
      let inTag = false;
      // The code the tokenizer handed over, the one a consume consumes.
      let current: Code = null;
      const leaving =
        (continuation: State): State =>
        (code) => {
          left = true;
          return continuation(code);
        };
      const okLeaving = leaving(ok);
      const nokLeaving = leaving(nok);
      const presenting: Effects = {
        ...effects,
        consume: () => effects.consume(current),
        enter: (type, fields) => {
          if (type === tagType) inTag = true;
          return effects.enter(type, fields);
        },
        exit: (type) => {
          if (type === tagType) inTag = false;
          return effects.exit(type);
        },
      };
      return adapt(tokenize.call(context, presenting, okLeaving, nokLeaving));

      function adapt(state: State): State {
        return (code) => {
          current = code;
          let shown: Code = code;
          let actual = code;
          let pair = false;
          if (inTag && code !== null && code >= 0x80) {
            if (code >= 0xd800 && code <= 0xdbff) {
              actual = pairedCodePoint(context.now().offset, code);
              pair = true;
            }
            shown = standIn(actual as number);
          }
          let next: State | undefined;
          try {
            next = state(shown);
          } catch (error) {
            if (shown !== actual) {
              restoreCharacter(error, shown as number, actual as number);
            }
            throw error;
          }
          if (
            left ||
            next === undefined ||
            next === okLeaving ||
            next === nokLeaving
          ) {
            return next;
          }
          return pair ? lowSurrogate(next) : adapt(next);
        };
      }

      // The second code unit of a pair whose code point the tag tokenizer
      // took whole: consumed into the token the first went to.
      function lowSurrogate(next: State): State {
        return (code) => {
          if (code === null || code < 0xdc00 || code > 0xdfff) {
            throw new Error(
              "S-9's MDX check: a surrogate pair's second code unit did not follow its first (a harness defect in its Unicode 15.1 JSX reader)",
            );
          }
          current = code;
          effects.consume(code);
          return adapt(next);
        };
      }
    },
  };
}

/** The code point of the surrogate pair `high` begins at `offset` of the
 * text being read (micromark's offsets index it in UTF-16 code units). */
function pairedCodePoint(offset: number, high: number): number {
  const text = parsedText;
  const code = text?.codePointAt(offset);
  if (
    text === undefined ||
    text.charCodeAt(offset) !== high ||
    code === undefined ||
    code <= 0xffff
  ) {
    throw new Error(
      `S-9's MDX check: no surrogate pair begins at offset ${offset} of the text being read (a harness defect in its Unicode 15.1 JSX reader)`,
    );
  }
  return code;
}

/** Puts the character a stand-in was shown for back into the stock tag
 * tokenizer's report of it. */
function restoreCharacter(error: unknown, shown: number, actual: number): void {
  if (!isParserMessage(error)) return;
  const report = error as unknown as { reason: string; message: string };
  const from = `\`${String.fromCodePoint(shown)}\` (${codePointName(shown)})`;
  const to = `\`${String.fromCodePoint(actual)}\` (${codePointName(actual)}, judged by Unicode 15.1)`;
  report.reason = report.reason.split(from).join(to);
  report.message = report.message.split(from).join(to);
}

// One extension set per distinct allowance set (the extension captures its
// parser); `fromMarkdown` builds a fresh tokenizer per call.
const EXTENSIONS = new Map<string, MdxExtension>();
const MDAST_EXTENSIONS = [mdxFromMarkdown()];

function extensionsFor(allowances: readonly MdxAllowance[]): MdxExtension {
  const named = [...new Set(allowances)].sort();
  const key = named.join(",");
  let extension = EXTENSIONS.get(key);
  if (extension === undefined) {
    extension = withUnicode151Jsx(mdxjs({ acorn: lenientParser(named) }));
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
  checkRuntimeWhitespace();
  parsedText = text;
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
  } finally {
    parsedText = undefined;
  }
}

/** The mdast tree the 14.20 parse above builds — ESM blocks, expressions,
 * and attribute expressions each carrying the ESTree acorn parsed it to
 * (`data.estree`). */
export type MdxTree = ReturnType<typeof fromMarkdown>;

/**
 * The tree of a source that derives under 14.20, read by the parse
 * `deriveMdx` judges with — every S-9 allowance admitted, since a well-formed
 * file may carry any of those early errors. TEST-SPEC S-6's name analysis
 * (helpers/oracles/name-analysis.ts) reads a spec source's names from it. A
 * source that does not derive so has no tree to read: a harness error.
 */
export function readMdxTree(text: string): MdxTree {
  const verdict = deriveMdx(text, { allowances: MDX_ALLOWANCES });
  if (!verdict.derives) {
    throw new Error(
      `S-9's MDX parse: no tree is read from a source that does not derive under SPEC 14.20 (${verdict.reason})`,
    );
  }
  checkRuntimeWhitespace();
  parsedText = text;
  try {
    return fromMarkdown(text, {
      extensions: [extensionsFor(MDX_ALLOWANCES)],
      mdastExtensions: MDAST_EXTENSIONS,
    });
  } finally {
    parsedText = undefined;
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
