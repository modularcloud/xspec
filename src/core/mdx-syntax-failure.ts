// Where a spec source fails to be well-formed MDX (SPEC 14's location rule
// for 14.20).
//
// SPEC 14: a syntax failure's offset is "the byte length of the longest
// whole-character prefix of the file with which some well-formed file
// begins — the file's byte length when the whole file is such a prefix".
// remark-mdx's stock grammar decides well-formedness (SPEC 14.20;
// IMPLEMENTATION), but where it throws is not that offset: it tries every
// `}` as a container's closing brace and, at the end of the file, throws
// the last attempt's failure; it judges a whole ESM block at once; it pairs
// JSX tags only after tokenizing the whole file; and it places a failure at
// a construct, not at the character that made the prefix unviable. So the
// offset is computed here from the failure the grammar throws, class by
// class:
//
// - braces (expression containers, attribute value expressions, spread
//   attributes): the container's content, from its opening brace to the
//   end of the file, is measured by its own grammar (`jsViablePrefix`) —
//   `}` appended to the file makes the stock grammar hand that content, as
//   it collects it, to the acorn recorded here; an attribute value's empty
//   braces fail at the brace that closes them;
// - an ESM block: the block's text, as recorded, measured as a module of
//   import and export declarations;
// - a JSX tag's own syntax: the stock tokenizer's character;
// - tag pairing: a closing tag where its name departs from the open
//   element's; a construct ending, or an emphasis closing, with an element
//   still open inside it — the longest prefix a closing tag (or one more
//   character) can still complete, found by probing the grammar;
// - an element left open at the end of the file: the file's length.
//
// Since the grammar reports tag pairing only after tokenizing the whole
// file, the prefix before a computed offset may itself fail: it is parsed
// in turn, and the offset moves down until the prefix fails at its own end
// or not at all.

import type { Options } from "acorn";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { jsViablePrefix } from "./js-syntax-failure.js";
import type { JsContentKind } from "./js-syntax-failure.js";
import { MDX_ACORN_OPTIONS, mdxAcorn } from "./mdx-acorn.js";

// ---------------------------------------------------------------------------
// The recording parser
// ---------------------------------------------------------------------------

/** One call the stock grammar made to acorn: the text, and where it failed. */
interface AcornCall {
  readonly value: string;
  /** acorn's failure position in `value`, before remark-mdx remaps it. */
  errorPos?: number;
}

/** The calls of the parse in progress (one synchronous parse at a time). */
let recording: AcornCall[] | null = null;

function recorded<T>(value: string, run: () => T): T {
  const call: AcornCall = { value };
  recording?.push(call);
  try {
    return run();
  } catch (error) {
    const pos = (error as { readonly pos?: unknown }).pos;
    if (typeof pos === "number") call.errorPos = pos;
    throw error;
  }
}

/** `mdxAcorn`, each call recorded; what it derives is `mdxAcorn`'s. */
const recordingAcorn = {
  parse: (value: string, options: Options): unknown =>
    recorded(value, () => mdxAcorn.parse(value, options)),
  parseExpressionAt: (value: string, pos: number, options: Options): unknown =>
    recorded(value, () => mdxAcorn.parseExpressionAt(value, pos, options)),
};

/** The production grammar (`mdx.ts`), its acorn calls recorded. */
const analysisParser = unified()
  .use(remarkParse)
  .use(remarkMdx, {
    acorn: recordingAcorn as unknown as typeof mdxAcorn,
    acornOptions: MDX_ACORN_OPTIONS,
  })
  .freeze();

/** A stock grammar failure, structurally (a `VFileMessage`). */
interface MdxFailure {
  readonly source?: unknown;
  readonly ruleId?: unknown;
  readonly reason?: unknown;
  readonly place?: unknown;
}

/** One parse: its failure (null when the text is well-formed) and calls. */
interface AnalysisParse {
  readonly failure: MdxFailure | null;
  readonly calls: readonly AcornCall[];
}

/** An unexpected throw (not the grammar's): the analysis gives up. */
class AnalysisAbandoned extends Error {}

function analysisParse(text: string): AnalysisParse {
  const calls: AcornCall[] = [];
  recording = calls;
  try {
    analysisParser.parse(text);
    return { failure: null, calls };
  } catch (error) {
    const failure = error as MdxFailure;
    if (typeof error !== "object" || error === null) {
      throw new AnalysisAbandoned();
    }
    if (typeof failure.source !== "string") throw new AnalysisAbandoned();
    return { failure, calls };
  } finally {
    recording = null;
  }
}

// ---------------------------------------------------------------------------
// Places and content mapping
// ---------------------------------------------------------------------------

interface PointLike {
  readonly offset?: unknown;
}

/** A failure place's start offset (UTF-16), if it has one. */
function placeStart(failure: MdxFailure): number | undefined {
  const place = failure.place as
    (PointLike & { readonly start?: PointLike }) | null | undefined;
  const point = place?.start ?? place;
  return typeof point?.offset === "number" ? point.offset : undefined;
}

/** A failure place's end offset (UTF-16), if it has one. */
function placeEnd(failure: MdxFailure): number | undefined {
  const place = failure.place as
    (PointLike & { readonly end?: PointLike }) | null | undefined;
  const point = place?.end ?? place;
  return typeof point?.offset === "number" ? point.offset : undefined;
}

/**
 * A text's lines as [start, end) pairs, terminators excluded — a
 * terminator being CR, LF, or CRLF, Markdown's line endings, the ones the
 * stock grammar keeps in collected content.
 */
function lineSpans(text: string): [number, number][] {
  const spans: [number, number][] = [];
  let start = 0;
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === 0x0a || code === 0x0d) {
      spans.push([start, index]);
      index += code === 0x0d && text.charCodeAt(index + 1) === 0x0a ? 2 : 1;
      start = index;
    } else {
      index += 1;
    }
  }
  spans.push([start, text.length]);
  return spans;
}

function lineIndexOf(spans: readonly [number, number][], at: number): number {
  let line = 0;
  while (line + 1 < spans.length && spans[line + 1][0] <= at) line += 1;
  return line;
}

/**
 * Map an offset in collected content to the file: the stock grammar
 * collects a container's content line by line, each line's leading
 * container prefix and indentation dropped, so each content line is a
 * suffix of its file line; the lines correspond by their distance from an
 * anchor known in both.
 */
function contentToFile(
  text: string,
  content: string,
  anchorInContent: number,
  anchorInFile: number,
  at: number,
): number | undefined {
  const contentLines = lineSpans(content);
  const fileLines = lineSpans(text);
  const line =
    lineIndexOf(fileLines, anchorInFile) -
    (lineIndexOf(contentLines, anchorInContent) -
      lineIndexOf(contentLines, at));
  if (line < 0 || line >= fileLines.length) return undefined;
  const [contentStart, contentEnd] =
    contentLines[lineIndexOf(contentLines, at)];
  const fileEnd = fileLines[line][1];
  const mapped = fileEnd - (contentEnd - contentStart) + (at - contentStart);
  return mapped >= 0 && mapped <= text.length ? mapped : undefined;
}

/** Whether `content`'s last line ends the file's last line. */
function endsText(text: string, content: string): boolean {
  const contentLines = lineSpans(content);
  const fileLines = lineSpans(text);
  const [contentStart, contentEnd] = contentLines[contentLines.length - 1];
  const [fileStart, fileEnd] = fileLines[fileLines.length - 1];
  return text
    .slice(fileStart, fileEnd)
    .endsWith(content.slice(contentStart, contentEnd));
}

// ---------------------------------------------------------------------------
// Per-class offsets
// ---------------------------------------------------------------------------

/**
 * A container open at the end of `text` (the stock grammar reached the end
 * inside it): its content, from the opening brace on, measured by its own
 * grammar. Appending `}` makes the grammar collect that content and hand
 * it to acorn; a spread attribute's arrives wrapped as `({…})`.
 */
function openContainerOffset(text: string): number {
  const closed = analysisParse(text + "}");
  if (
    closed.failure !== null &&
    closed.failure.ruleId === "unexpected-empty-expression"
  ) {
    // An attribute value's content the comment deletions empty: judged
    // as spelled, from where the grammar places it.
    const start = placeStart(closed.failure) ?? text.length;
    const content = text.slice(start);
    return start + jsViablePrefix(content, "expression");
  }
  const last = closed.calls.at(-1);
  if (last === undefined) return text.length;
  let content = last.value;
  let kind: JsContentKind = "expression";
  if (
    !endsText(text, content) &&
    content.startsWith("({") &&
    content.endsWith("})") &&
    endsText(text, content.slice(2, -2))
  ) {
    content = content.slice(2, -2);
    kind = "spread";
  }
  const viable = jsViablePrefix(content, kind);
  if (viable >= content.length) return text.length;
  return (
    contentToFile(text, content, content.length, text.length, viable) ??
    text.length
  );
}

/**
 * An attribute value whose braces hold whitespace and comments alone,
 * placed at its content's start (`start`): SPEC 14.20 admits no empty
 * expression there, so the failure is the brace the grammar found closing
 * them — the first `}` whose prefix the grammar rejects so.
 */
function emptyAttributeOffset(text: string, start: number): number {
  let brace = text.indexOf("}", start);
  for (let tried = 0; brace !== -1 && tried < 64; tried += 1) {
    const { failure } = analysisParse(text.slice(0, brace + 1));
    if (
      failure !== null &&
      failure.ruleId === "unexpected-empty-expression" &&
      placeStart(failure) === start
    ) {
      return brace;
    }
    brace = text.indexOf("}", brace + 1);
  }
  return start;
}

/**
 * A spread attribute whose content derived as an object literal other than
 * one spread element: the content, as recorded, measured as a spread; the
 * construct the grammar placed the failure at anchors it in the file.
 */
function spreadOffset(
  text: string,
  failure: MdxFailure,
  calls: readonly AcornCall[],
): number {
  const at = placeStart(failure);
  const last = calls.at(-1);
  if (at === undefined || last === undefined) return at ?? 0;
  const content = last.value.slice(2, -2);
  const program = mdxAcorn.parse(last.value, { ...MDX_ACORN_OPTIONS }) as {
    readonly body: readonly {
      readonly type: string;
      readonly start: number;
      readonly expression?: {
        readonly type: string;
        readonly properties?: readonly { readonly start: number }[];
      };
    }[];
  };
  const head = program.body[0];
  const properties = head?.expression?.properties;
  const placed =
    head === undefined ||
    head.type !== "ExpressionStatement" ||
    head.expression?.type !== "ObjectExpression" ||
    properties === undefined
      ? head
      : (properties[1] ?? properties[0]);
  if (placed === undefined) return at;
  const viable = jsViablePrefix(content, "spread");
  return contentToFile(text, content, placed.start - 2, at, viable) ?? at;
}

/** The ESM statement kinds (SPEC 14.20), as the stock grammar allows. */
const ESM_STATEMENTS: ReadonlySet<string> = new Set([
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "ExportAllDeclaration",
]);

/**
 * An ESM block that fails: its text, as recorded, measured as a module of
 * import and export declarations. The grammar may prefix the text with a
 * `var` line naming earlier blocks' imports; blocks are never indented, so
 * the text is the file's own from the block's start.
 */
function esmOffset(
  text: string,
  failure: MdxFailure,
  calls: readonly AcornCall[],
): number {
  const at = placeStart(failure);
  const last = calls.at(-1);
  if (at === undefined || last === undefined) return at ?? 0;
  const prefix = last.value.startsWith("var ")
    ? last.value.indexOf("\n") + 1
    : 0;
  const block = last.value.slice(prefix);
  let anchor: number | undefined;
  if (failure.ruleId === "acorn") {
    anchor = last.errorPos === undefined ? undefined : last.errorPos - prefix;
  } else {
    const program = mdxAcorn.parse(block, { ...MDX_ACORN_OPTIONS }) as {
      readonly body: readonly { readonly type: string; start: number }[];
    };
    anchor = program.body.find((node) => !ESM_STATEMENTS.has(node.type))?.start;
  }
  if (anchor === undefined || anchor < 0 || anchor > at) return at;
  return Math.min(text.length, at - anchor + jsViablePrefix(block, "module"));
}

/**
 * A closing tag that cannot close the open element: the position where
 * its name departs from that element's (a fragment's name is empty).
 */
function closingTagDivergence(
  text: string,
  at: number,
  expected: string,
): number {
  let index = at;
  const skipSpace = (): void => {
    while (index < text.length && /\s/u.test(text.charAt(index))) {
      index += 1;
    }
  };
  if (text.charAt(index) === "<") index += 1;
  skipSpace();
  if (text.charAt(index) === "/") index += 1;
  let matched = 0;
  for (;;) {
    skipSpace();
    if (
      matched < expected.length &&
      index < text.length &&
      text.charAt(index) === expected.charAt(matched)
    ) {
      index += 1;
      matched += 1;
      continue;
    }
    return index;
  }
}

/**
 * Whether `probe`, a prefix of the file ending at `at` plus a completion,
 * fails only at or after `at`: its grammar failure, if any, is the
 * completion's or the end's. A pairing failure in the probe counts by the
 * construct it concerns (no probing within a probe).
 */
function completes(probe: string, at: number): boolean {
  const { failure, calls } = analysisParse(probe);
  if (failure === null) return true;
  if (failure.source === "mdast-util-mdx-jsx") {
    if (String(failure.reason).startsWith("Expected a closing tag for")) {
      const end = placeEnd(failure);
      return end === undefined || end >= at;
    }
    const start = placeStart(failure);
    return start === undefined || start >= at;
  }
  return classOffset(probe, failure, calls) >= at;
}

/** How far past a construct's end the probes below look. */
const PROBE_REACH = 256;

/**
 * An element left open when the construct holding it ended (at `end`): the
 * longest prefix the element's closing tag — directly, or after one more
 * character, so a line the construct's end hangs on can go on — still
 * completes.
 */
function constructEndOffset(text: string, end: number, closer: string): number {
  const bound = Math.min(text.length, end + PROBE_REACH);
  for (let at = end + 1; at <= bound; at += 1) {
    const head = text.slice(0, at);
    if (!completes(head + closer, at) && !completes(head + "x" + closer, at)) {
      return at - 1;
    }
  }
  return bound;
}

/**
 * A closing tag met inside a construct opened after its element (an
 * emphasis crossing it): the longest prefix that, as it stands or with one
 * more character, the grammar does not yet reject so.
 */
function crossingOffset(text: string, at: number): number {
  const bound = Math.min(text.length, at + PROBE_REACH);
  for (let end = at + 1; end <= bound; end += 1) {
    const head = text.slice(0, end);
    if (!completes(head, end) && !completes(head + "x", end)) return end - 1;
  }
  return bound;
}

/** mdast-util-mdx-jsx's pairing failures, by message. */
const UNEXPECTED_CLOSING_TAG =
  /^Unexpected closing tag `[^`]*`, expected corresponding closing tag for `<([^`>]*)>`/;
const EXPECTED_CLOSING_TAG = /^Expected a closing tag for `<([^`>]*)>`/;

function pairingOffset(text: string, failure: MdxFailure): number {
  const reason = String(failure.reason);
  const start = placeStart(failure);
  if (failure.ruleId !== "end-tag-mismatch") return start ?? 0;
  const unexpected = UNEXPECTED_CLOSING_TAG.exec(reason);
  if (unexpected !== null && start !== undefined) {
    return closingTagDivergence(text, start, unexpected[1]);
  }
  const expected = EXPECTED_CLOSING_TAG.exec(reason);
  if (expected !== null) {
    const end = placeEnd(failure);
    // Open at the end of the file: the whole file is a viable prefix.
    if (end === undefined) return text.length;
    return constructEndOffset(text, end, `</${expected[1]}>`);
  }
  if (reason.startsWith("Expected the closing tag") && start !== undefined) {
    return crossingOffset(text, start);
  }
  return start ?? 0;
}

/** The offset of one stock failure of `text`, by its class. */
function classOffset(
  text: string,
  failure: MdxFailure,
  calls: readonly AcornCall[],
): number {
  const start = placeStart(failure);
  switch (failure.source) {
    case "micromark-extension-mdx-expression":
      switch (failure.ruleId) {
        case "acorn":
        case "unexpected-eof":
          return openContainerOffset(text);
        case "unexpected-empty-expression":
          return emptyAttributeOffset(text, start ?? 0);
        case "non-spread":
        case "spread-extra":
          return spreadOffset(text, failure, calls);
        default:
          return start ?? 0;
      }
    case "micromark-extension-mdxjs-esm":
      return esmOffset(text, failure, calls);
    case "micromark-extension-mdx-jsx":
      return start ?? text.length;
    case "mdast-util-mdx-jsx":
      return pairingOffset(text, failure);
    default:
      return start ?? 0;
  }
}

/** How many times the prefix check below may move the offset down. */
const PREFIX_CHECKS = 64;

/**
 * SPEC 14, 14.20: the UTF-16 length of the longest prefix of `text` — a
 * spec source the stock grammar rejects — with which some well-formed MDX
 * file begins; `fallback` where the analysis cannot proceed (a throw that
 * is not the grammar's own failure, or nesting too deep to re-parse).
 */
export function mdxSyntaxFailureOffset(text: string, fallback: number): number {
  try {
    const whole = analysisParse(text);
    if (whole.failure === null) return fallback;
    let offset = classOffset(text, whole.failure, whole.calls);
    for (let check = 0; check < PREFIX_CHECKS; check += 1) {
      if (offset >= text.length) return text.length;
      const prefix = text.slice(0, offset);
      const parsed = analysisParse(prefix);
      if (parsed.failure === null) break;
      const earlier = classOffset(prefix, parsed.failure, parsed.calls);
      if (earlier >= offset) break;
      offset = earlier;
    }
    return Math.max(0, Math.min(text.length, offset));
  } catch (error) {
    if (
      error instanceof AnalysisAbandoned ||
      error instanceof RangeError ||
      error instanceof SyntaxError
    ) {
      return fallback;
    }
    throw error;
  }
}
