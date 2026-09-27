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
import { closingTagDivergence } from "./viable-prefix.js";

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
 * Map an offset in collected content to the file, given an anchor known in
 * both: on the anchor's own content line, by its distance from the anchor;
 * on an earlier line, by that line's end — the stock grammar collects a
 * container's content line by line, each line's leading container prefix
 * and indentation dropped, so a content line ending at a line terminator
 * is a suffix of its file line, the lines corresponding by their distance
 * from the anchor's. A later line's start in the file is not known.
 */
function contentToFile(
  text: string,
  content: string,
  anchorInContent: number,
  anchorInFile: number,
  at: number,
): number | undefined {
  const contentLines = lineSpans(content);
  const atLine = lineIndexOf(contentLines, at);
  const anchorLine = lineIndexOf(contentLines, anchorInContent);
  let mapped: number;
  if (atLine === anchorLine) {
    mapped = anchorInFile + (at - anchorInContent);
  } else if (atLine < anchorLine) {
    const fileLines = lineSpans(text);
    const line = lineIndexOf(fileLines, anchorInFile) - (anchorLine - atLine);
    if (line < 0) return undefined;
    const [contentStart, contentEnd] = contentLines[atLine];
    mapped =
      fileLines[line][1] - (contentEnd - contentStart) + (at - contentStart);
  } else {
    return undefined;
  }
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
  // The grammar places a node before the content (the wrapping `({`) at
  // the content's start.
  const anchor = Math.max(0, placed.start - 2);
  const viable = jsViablePrefix(content, "spread");
  return contentToFile(text, content, anchor, at, viable) ?? at;
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
 * The continuation a line inside the element's container begins with: the
 * text before the element on its opening line (`line`, `column` 1-based),
 * list markers blanked — `> ` stays `> `, `- ` becomes two spaces.
 */
function containerPrefix(text: string, line: number, column: number): string {
  const spans = lineSpans(text);
  const span = spans[line - 1];
  if (span === undefined) return "";
  const before = text.slice(span[0], Math.min(span[1], span[0] + column - 1));
  return before.replace(/[-*+]|[0-9]{1,9}[.)]/g, (marker) =>
    " ".repeat(marker.length),
  );
}

/**
 * An element left open when the construct holding it ended (at `end`): the
 * longest prefix the element's closing tag still completes — directly, or
 * after one more character so a line the construct's end hangs on can go
 * on, and at a line start also after the element's container prefix.
 */
function constructEndOffset(
  text: string,
  end: number,
  closer: string,
  prefix: string,
): number {
  const bound = Math.min(text.length, end + PROBE_REACH);
  for (let at = end + 1; at <= bound; at += 1) {
    const head = text.slice(0, at);
    const lineStart = /[\n\r]$/.test(head);
    const completions =
      lineStart && prefix.length > 0
        ? [closer, "x" + closer, prefix + closer, prefix + "x" + closer]
        : [closer, "x" + closer];
    if (!completions.some((completion) => completes(head + completion, at))) {
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
const EXPECTED_CLOSING_TAG =
  /^Expected a closing tag for `<([^`>]*)>` \((\d+):(\d+)-\d+:\d+\)/;

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
    return constructEndOffset(
      text,
      end,
      `</${expected[1]}>`,
      containerPrefix(text, Number(expected[2]), Number(expected[3])),
    );
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

/** How many times the checks below may move the offset down. */
const PREFIX_CHECKS = 64;
/** How many line starts a hidden-failure check backs up through. */
const LINE_BACKUPS = 64;

/** The start of the line holding the character before `at`. */
function lineStartBefore(text: string, at: number): number {
  let index = at - 1;
  while (index > 0) {
    const code = text.charCodeAt(index - 1);
    if (code === 0x0a || code === 0x0d) break;
    index -= 1;
  }
  return Math.max(0, index);
}

/**
 * A failure before `offset` that the grammar's order hides: it tokenizes
 * first and pairs tags only after, so a prefix ending inside an unfinished
 * construct — a container or tag the offset lies in — reports that
 * construct's end and nothing before it. The prefix is cut at line starts,
 * backing up until it no longer ends inside such a construct, and a failure
 * it reports before the cut is returned; null when there is none.
 */
function hiddenFailure(text: string, offset: number): number | null {
  let cut = offset;
  for (let backup = 0; backup < LINE_BACKUPS; backup += 1) {
    const prefix = text.slice(0, cut);
    const parsed = analysisParse(prefix);
    if (parsed.failure === null) return null;
    const at = classOffset(prefix, parsed.failure, parsed.calls);
    if (at < cut) return at;
    // Pairing ran, so nothing before the cut failed.
    if (parsed.failure.source === "mdast-util-mdx-jsx" || cut === 0) {
      return null;
    }
    cut = lineStartBefore(text, cut);
  }
  return null;
}

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
    let offset = Math.max(
      0,
      Math.min(text.length, classOffset(text, whole.failure, whole.calls)),
    );
    for (let check = 0; check < PREFIX_CHECKS; check += 1) {
      const earlier = hiddenFailure(text, offset);
      if (earlier === null || earlier >= offset) break;
      offset = Math.max(0, earlier);
    }
    return offset;
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
