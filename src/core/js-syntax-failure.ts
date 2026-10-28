// The longest viable prefix of a spec source's brace or ESM-block content
// (SPEC 14's location rule for 14.20, over the grammar of SPEC 14.20).
//
// SPEC 14.20: an expression container's or attribute value expression's
// content derives exactly one ECMAScript 2024 `Expression` beside
// whitespace and comments (the container's empty expression, whitespace
// and comments alone, is a viable prefix of that too); a spread
// attribute's content derives `...` and one `AssignmentExpression`; an ESM
// block derives one `Module` holding import and export declarations only.
// SPEC 14 locates a syntax failure at the byte length of the longest
// prefix with which some well-formed file begins. Within such content that
// is the longest prefix some continuation completes: `jsViablePrefix`
// measures it with the parser remark-mdx is handed (`mdxAcorn`, early
// errors excluded), from where acorn fails:
//
// - a failure while reading a token is at the character the token could
//   not continue with (acorn's `raisedAt`: the line terminator ending an
//   unterminated string, the character after `1e`); an unterminated block
//   comment runs to the end;
// - a failure while parsing is at the start of the token the parser met
//   (a check the parser makes only after reading on — a cover grammar's
//   refinement — is at the token that forced it: the `=>` whose parameters
//   do not derive), and runs on into that token through whatever some
//   acceptable token begins with (`extendIntoToken`);
// - in an ESM block, a statement other than an import or export
//   declaration fails at its start, where only `import` or `export` could
//   have stood.

import type { Options, Parser, TokenType } from "acorn";
import { tokTypes } from "acorn";
import { MDX_ACORN_OPTIONS, mdxAcorn } from "./mdx-acorn.js";
import { closingTagDivergence, extendIntoToken } from "./viable-prefix.js";

/**
 * The grammar content is judged by (SPEC 14.20): one `Expression` (an
 * expression container or attribute value expression), `...` and one
 * `AssignmentExpression` (a spread attribute), or a `Module` of import and
 * export declarations (an ESM block).
 */
export type JsContentKind = "expression" | "spread" | "module";

/**
 * ECMAScript 2024's token vocabulary: its punctuators (12.8), reserved
 * words (12.7.2), and the words its productions spell contextually.
 */
const ES2024_VOCABULARY: readonly string[] = [
  ..."{ ( ) [ ] . ... ; , < > <= >= == != === !== + - * % ** ++ -- << >> >>> & | ^ ! ~ && || ?? ? ?. : = += -= *= %= **= <<= >>= >>>= &= |= ^= &&= ||= ??= => / /= }".split(
    " ",
  ),
  ..."await break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield".split(
    " ",
  ),
  ..."let static implements interface package private protected public as async from get of set target meta".split(
    " ",
  ),
];

/** The statements an ESM block may hold (SPEC 14.20). */
const ESM_STATEMENTS: ReadonlySet<string> = new Set([
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "ExportAllDeclaration",
]);

/** An acorn syntax error (acorn 8.17): `pos` as raised, `raisedAt` read to. */
interface AcornSyntaxError extends SyntaxError {
  readonly pos: number;
  readonly raisedAt: number;
}

/** The top-level statement being parsed, and whether it is a declaration. */
interface TopStatement {
  readonly start: number;
  declaration: boolean;
}

/**
 * Structural view of acorn's parser state and methods (not in its public
 * types), verified against acorn 8.17.
 */
interface DiagnosingParser {
  readonly start: number;
  readonly type: TokenType;
  readonly lastTokStart: number;
  readonly lastTokEnd: number;
  /** Whether the tokenizer is reading a token (this module's state). */
  xspecReading?: boolean;
  /** The module's top-level statement in progress (this module's state). */
  xspecTop?: TopStatement;
  /** The tokenizer's context: a template's or JSX's, or a plain one. */
  curContext(): { readonly token: string };
  nextToken(): void;
  parse(): { readonly body: readonly { type: string; start: number }[] };
  parseExpression(): unknown;
  parseMaybeAssign(): unknown;
  expect(type: TokenType): void;
  unexpected(): never;
}

/** acorn's methods overridden below, as its prototype holds them. */
interface DiagnosingMethods {
  nextToken(this: DiagnosingParser): void;
  parseStatement(
    this: DiagnosingParser,
    context: unknown,
    topLevel?: boolean,
    exports?: unknown,
  ): unknown;
  parseImport(this: DiagnosingParser, node: unknown): unknown;
  parseExport(this: DiagnosingParser, node: unknown, exports: unknown): unknown;
}

/**
 * The acorn plugin recording what a failure is judged by: whether the
 * tokenizer was reading a token, and — in a module — the top-level
 * statement in progress and whether it is an import or export declaration.
 * Nothing it records changes what the parser derives.
 */
function diagnosing(BaseParser: typeof Parser): typeof Parser {
  const Extended = class extends (BaseParser as unknown as new (
    ...args: never[]
  ) => object) {};
  const prototype = Extended.prototype as unknown as DiagnosingMethods;
  const base = BaseParser.prototype as unknown as DiagnosingMethods;
  prototype.nextToken = function () {
    this.xspecReading = true;
    base.nextToken.call(this);
    this.xspecReading = false;
  };
  prototype.parseStatement = function (context, topLevel, exports) {
    if (topLevel === true) {
      this.xspecTop = { start: this.start, declaration: false };
    }
    return base.parseStatement.call(this, context, topLevel, exports);
  };
  prototype.parseImport = function (node) {
    if (this.xspecTop !== undefined) this.xspecTop.declaration = true;
    return base.parseImport.call(this, node);
  };
  prototype.parseExport = function (node, exports) {
    if (this.xspecTop !== undefined) this.xspecTop.declaration = true;
    return base.parseExport.call(this, node, exports);
  };
  return Extended as unknown as typeof Parser;
}

/** `mdxAcorn`, deriving the same grammar, its failures diagnosable. */
const DiagnosingAcorn = mdxAcorn.extend(diagnosing) as unknown as new (
  options: Options,
  input: string,
) => DiagnosingParser;

/** Where content fails, and whether the failure starts a token. */
interface JsFailure {
  /** The failure position in the content (UTF-16). */
  readonly point: number;
  /** Whether `point` starts a token the prefix may run on into. */
  readonly atToken: boolean;
}

/** acorn-jsx's closing-tag mismatch message, naming the open element. */
const JSX_CLOSING_MISMATCH =
  /^Expected corresponding JSX closing tag for <(.*)> \(\d+:\d+\)$/;

/** acorn-jsx's message for an attribute value's empty braces. */
const JSX_EMPTY_ATTRIBUTE =
  /^JSX attributes must only be assigned a non-empty expression/;

/**
 * A whole token of the class a token beginning with `first` belongs to — a
 * string, template, regular expression, number, identifier, or private
 * name — or undefined for any other character.
 */
function classRepresentative(first: string): string | undefined {
  switch (first) {
    case '"':
    case "'":
    case "`":
      return first + first;
    case "/":
      return "/x/";
    case ".":
      return ".0";
    case "#":
      return "#x";
    default:
      if (/^[0-9]$/.test(first)) return "0";
      if (/^[\p{ID_Start}$_\\]$/u.test(first)) return "x";
      return undefined;
  }
}

/** Where acorn's failure lies, by the parser state it was raised in. */
function failureOf(
  parser: DiagnosingParser,
  error: AcornSyntaxError,
  content: string,
  kind: JsContentKind,
  checkClass: boolean,
): JsFailure {
  let failure: JsFailure;
  const mismatch = JSX_CLOSING_MISMATCH.exec(error.message);
  if (parser.xspecReading === true) {
    // The tokenizer stopped at the character its token cannot continue
    // with — unless no token of its class could stand where it began (a
    // string after an expression, unterminated or not), which is then the
    // failure. A block comment, raised while skipping trivia (before the
    // token start moves), fails only at the content's end.
    if (error.message.startsWith("Unterminated comment")) {
      failure = { point: content.length, atToken: false };
    } else {
      failure = { point: error.raisedAt, atToken: false };
      // A template's text and JSX's are read in their construct's own
      // context, admitted with it.
      const context = parser.curContext().token;
      const start = parser.start;
      const representative = classRepresentative(content.charAt(start));
      if (
        checkClass &&
        context !== "`" &&
        !context.startsWith("<") &&
        error.raisedAt > start &&
        representative !== undefined
      ) {
        const probe = jsFailure(
          content.slice(0, start) + representative,
          kind,
          false,
        );
        if (probe !== null && probe.point <= start) {
          failure = { point: start, atToken: true };
        }
      }
    }
  } else if (mismatch !== null) {
    failure = {
      point: closingTagDivergence(content, error.pos, mismatch[1]),
      atToken: false,
    };
  } else if (JSX_EMPTY_ATTRIBUTE.test(error.message)) {
    // The empty braces' closing brace, the parser's last token.
    failure = { point: parser.lastTokStart, atToken: false };
  } else if (
    error.pos < parser.lastTokStart &&
    content.slice(parser.lastTokStart, parser.lastTokEnd) === "=>"
  ) {
    // Arrow parameters that do not derive fail at the `=>` read before
    // they were refined.
    failure = { point: parser.lastTokStart, atToken: true };
  } else {
    failure = { point: parser.start, atToken: true };
  }
  const top = parser.xspecTop;
  if (
    kind === "module" &&
    top !== undefined &&
    !top.declaration &&
    top.start <= failure.point
  ) {
    // A statement no import or export declaration begins fails at its
    // start (SPEC 14.20: an ESM block holds those declarations only).
    failure = { point: top.start, atToken: true };
  }
  return failure;
}

/**
 * Where `content` fails to derive as `kind`, or null when it derives;
 * `checkClass` false for a probe of a token class (no probe within it).
 */
function jsFailure(
  content: string,
  kind: JsContentKind,
  checkClass = true,
): JsFailure | null {
  const parser = new DiagnosingAcorn({ ...MDX_ACORN_OPTIONS }, content);
  try {
    if (kind === "module") {
      const statement = parser
        .parse()
        .body.find((node) => !ESM_STATEMENTS.has(node.type));
      return statement === undefined
        ? null
        : { point: statement.start, atToken: true };
    }
    parser.nextToken();
    if (kind === "spread") {
      parser.expect(tokTypes.ellipsis);
      parser.parseMaybeAssign();
    } else {
      parser.parseExpression();
    }
    if (parser.type !== tokTypes.eof) parser.unexpected();
    return null;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return failureOf(
      parser,
      error as AcornSyntaxError,
      content,
      kind,
      checkClass,
    );
  }
}

/**
 * SPEC 14, 14.20: the length (UTF-16) of the longest prefix of `content`
 * that some continuation completes to content deriving as `kind` — the
 * whole content when it derives or fails only at its end.
 */
export function jsViablePrefix(content: string, kind: JsContentKind): number {
  const failure = jsFailure(content, kind);
  if (failure === null || failure.point >= content.length) {
    return content.length;
  }
  if (!failure.atToken) return failure.point;
  const head = content.slice(0, failure.point);
  return extendIntoToken(
    content,
    failure.point,
    ES2024_VOCABULARY,
    (spelling) => {
      const probe = jsFailure(head + spelling, kind);
      return probe === null || probe.point >= head.length + spelling.length;
    },
  );
}
