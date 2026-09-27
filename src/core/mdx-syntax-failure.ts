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
//   braces fail at the brace that closes them; a lazy line met inside a
//   flow construct's container ends the content at the line before it,
//   measured so, the lazy line failing only after content viable there;
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
//
// Every text — the file and each probe — is parsed as SPEC 14.20 judges
// it, as `parseMdx` in mdx.ts parses: the stock grammar refuses an
// attribute's content its comment deletions empty before calling acorn,
// though that content may hold a token they hide, and such a refusal is
// undone by respelling (`parseAsJudged`, the last section below).

import type { Options } from "acorn";
import { tokTypes } from "acorn";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { jsViablePrefix } from "./js-syntax-failure.js";
import type { JsContentKind } from "./js-syntax-failure.js";
import {
  commentDeletionsEmpty,
  MDX_ACORN_OPTIONS,
  mdxAcorn,
} from "./mdx-acorn.js";
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
interface RecordedParse {
  readonly failure: MdxFailure | null;
  readonly calls: readonly AcornCall[];
}

/** One parse as SPEC 14.20 judges its text (`analysisParse`). */
interface AnalysisParse extends RecordedParse {
  /**
   * The text the grammar parsed and the calls were made on: the text
   * judged, respelled where the stock grammar refused an attribute's
   * content as empty although it holds a token (`respellRefusedContent`) —
   * the same length and lines.
   */
  readonly parsed: string;
}

/** An unexpected throw (not the grammar's): the analysis gives up. */
class AnalysisAbandoned extends Error {}

/** One parse of `text` by the stock grammar, its acorn calls recorded. */
function recordedParse(text: string): RecordedParse {
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

/**
 * One parse of `text` as SPEC 14.20 judges it — as `parseMdx` in mdx.ts
 * parses (`parseAsJudged`): the stock grammar's, each refusal of an
 * attribute's content as empty that holds a token undone by respelling.
 */
function analysisParse(text: string): AnalysisParse {
  let parsed = text;
  for (let round = 0; ; round += 1) {
    const { failure, calls } = recordedParse(parsed);
    const respelled =
      failure === null || round >= RESPELLINGS
        ? null
        : respellRefusedContent(parsed, failure);
    if (respelled === null) return { failure, calls, parsed };
    parsed = respelled.text;
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

// ---------------------------------------------------------------------------
// Per-class offsets
// ---------------------------------------------------------------------------

/** A container's content as collected, and the grammar it is judged by. */
interface Collected {
  readonly content: string;
  readonly kind: JsContentKind;
}

/**
 * Where `content` begins in `head` when, as the stock grammar collects a
 * container's content, it runs to `head`'s end — its lines each a suffix of
 * the file line it corresponds to (the last ending `head`) — or undefined
 * when it does not.
 */
function contentStart(head: string, content: string): number | undefined {
  const contentLines = lineSpans(content);
  const fileLines = lineSpans(head);
  const first = fileLines.length - contentLines.length;
  if (first < 0) return undefined;
  for (let line = 0; line < contentLines.length; line += 1) {
    const [lineStart, lineEnd] = contentLines[line];
    const [fileStart, fileEnd] = fileLines[first + line];
    if (
      !head
        .slice(fileStart, fileEnd)
        .endsWith(content.slice(lineStart, lineEnd))
    ) {
      return undefined;
    }
  }
  const [start, end] = contentLines[0];
  return fileLines[first][1] - (end - start);
}

/**
 * Whether `content`, as the stock grammar collects a container's content,
 * is the content of a container whose opening brace lies in `head` and
 * which runs to `head`'s end: its lines, each a suffix of the file line it
 * corresponds to (the last ending `head`), begin right after a `{`.
 */
function endsAtBrace(head: string, content: string): boolean {
  const start = contentStart(head, content);
  return start !== undefined && start > 0 && head.charAt(start - 1) === "{";
}

/**
 * The content of the container a `}` appended to `head` falls in — the
 * stock grammar collects it and hands it to acorn, a spread attribute's
 * wrapped as `({…})` — or undefined when no container runs to `head`'s
 * end (its block container, a list item or block quote, ended first). The
 * grammar tokenizes flow before paragraph text, so a container closing
 * there may be followed by other calls: the one sought is the call whose
 * content maps to `head`'s end — in the text the grammar parsed, which a
 * refusal's respelling may have changed (`analysisParse`), so the content
 * is as spelled there: only leading comments differ, blanked to whitespace
 * without a token or line moving, which leaves every measure taken of it
 * below unchanged.
 */
function collectedAtEnd(head: string): Collected | undefined {
  const { calls, parsed } = analysisParse(head + "}");
  const spelled = parsed.slice(0, head.length);
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const value = calls[index].value;
    if (endsAtBrace(spelled, value)) {
      return { content: value, kind: "expression" };
    }
    const inner = value.slice(2, -2);
    if (
      value.startsWith("({") &&
      value.endsWith("})") &&
      endsAtBrace(spelled, inner)
    ) {
      return { content: inner, kind: "spread" };
    }
  }
  return undefined;
}

/** Line prefixes a line continuing a container's content may begin with. */
const LINE_PREFIXES: readonly string[] = ["", "  ", "    ", "> "];

/**
 * The content of the container `head`'s last line — spelled as it stands,
 * so a blank line stays blank and a lone tag stays a flow tag — still
 * belongs to: a `}` on a further line (after a continuation prefix) falls
 * in it. The content returned ends with that last line, the further line's
 * terminator and prefix cut off.
 */
function collectedPastLine(head: string): Collected | undefined {
  for (const prefix of LINE_PREFIXES) {
    const probe = head + "\n" + prefix;
    const collected = collectedAtEnd(probe);
    if (collected === undefined) continue;
    const { content, kind } = collected;
    const cut = Math.max(content.lastIndexOf("\n"), content.lastIndexOf("\r"));
    if (cut === -1) continue;
    const through = content.slice(0, cut).replace(/\r$/, "");
    return { content: through, kind };
  }
  return undefined;
}

/** The offset (in `head`) where collected content running to its end fails. */
function measured(head: string, collected: Collected): number {
  const { content, kind } = collected;
  const viable = jsViablePrefix(content, kind);
  if (viable >= content.length) return head.length;
  return (
    contentToFile(head, content, content.length, head.length, viable) ??
    head.length
  );
}

/** The line terminator (CR, LF, or CRLF) at `at`, or "" at none. */
function terminatorAt(text: string, at: number): string {
  if (text.startsWith("\r\n", at)) return "\r\n";
  const code = text.charCodeAt(at);
  return code === 0x0a || code === 0x0d ? text.charAt(at) : "";
}

/** The line terminator (CR, LF, or CRLF) ending at `at`, or "" at none. */
function terminatorBefore(text: string, at: number): string {
  if (at >= 2 && text.startsWith("\r\n", at - 2)) return "\r\n";
  const code = text.charCodeAt(at - 1);
  return code === 0x0a || code === 0x0d ? text.charAt(at - 1) : "";
}

/** How many lines past a failure's place a container's content is sought. */
const CONTAINER_LINES = 256;

/**
 * A container the stock grammar reached the end of without its content
 * deriving (an expression container, attribute value expression, or spread
 * attribute; `placed` the grammar's place for the failure, inside it): its
 * content, from the opening brace on, measured by its own grammar. When it
 * runs to the end of `text`, a `}` appended there collects it. When the
 * block container holding it ended first, the content ends with that block
 * container's last line — the last line at whose end an appended `}` still
 * falls in the container — and, the content viable through that line and
 * its terminator, the failure is the next line's first character other than
 * the indentation a continuation could still begin with.
 */
function openContainerOffset(text: string, placed: number | undefined): number {
  const closed = analysisParse(text + "}");
  if (
    closed.failure !== null &&
    closed.failure.ruleId === "unexpected-empty-expression"
  ) {
    // The attribute open at the end holds whitespace and comments alone —
    // content that holds a token is respelled, never refused so
    // (`analysisParse`) — which a token and its closing brace complete:
    // the whole file is viable.
    return text.length;
  }
  const atEnd = collectedAtEnd(text);
  if (atEnd !== undefined) return measured(text, atEnd);
  if (placed === undefined) return 0;
  const lineEnd = (from: number): number => {
    let at = from;
    while (at < text.length && terminatorAt(text, at) === "") at += 1;
    return at;
  };
  let end = lineEnd(placed);
  let last: { readonly end: number; readonly collected: Collected } | null =
    null;
  for (let line = 0; line < CONTAINER_LINES; line += 1) {
    const collected = collectedPastLine(text.slice(0, end));
    if (collected === undefined) {
      // The line holding the failure's place is the container's, whatever
      // follows it.
      if (last === null) {
        const same = collectedAtEnd(text.slice(0, end));
        if (same !== undefined) last = { end, collected: same };
      }
      break;
    }
    last = { end, collected };
    if (end >= text.length) break;
    end = lineEnd(end + terminatorAt(text, end).length);
  }
  if (last === null) return placed;
  return measuredThroughLine(text, last.end, last.collected, 0);
}

/**
 * A container's content collected through the line ending at `end` (at
 * its terminator), measured by its own grammar: where it fails within, that
 * offset; where it cannot take the line's terminator, `end`; otherwise the
 * next line's first character — from `from` on, where that lies further —
 * other than those a continuation of the content could still begin with.
 */
function measuredThroughLine(
  text: string,
  end: number,
  collected: Collected,
  from: number,
): number {
  const within = measured(text.slice(0, end), collected);
  if (within < end) return within;
  const terminator = terminatorAt(text, end);
  const { content, kind } = collected;
  if (
    jsViablePrefix(content + terminator, kind) <
    content.length + terminator.length
  ) {
    return end;
  }
  // The next line may still continue the content — a lazy line, deeper
  // indentation, a block quote's marker — character by character until
  // it has become something else (a new list item, a blank line).
  const opening = contentToFile(
    text.slice(0, end),
    content,
    content.length,
    end,
    0,
  );
  let at = Math.max(end + terminator.length, from);
  const bound = Math.min(text.length, at + PROBE_REACH);
  while (
    at < bound &&
    terminatorAt(text, at) === "" &&
    continues(text.slice(0, at + 1), opening, kind)
  ) {
    at += 1;
  }
  return at;
}

/**
 * A lazy line met inside a flow-position container's content — a flow
 * expression, or an attribute value expression or spread attribute of a
 * flow tag; `placed` the grammar's place for the failure, on the lazy line
 * past the container prefix it matched there. The grammar throws at the
 * lazy line without trying a brace beyond it, so the content before it may
 * already have failed: when the content never derives, the grammar tries
 * every `}` to the end of the file, and a file ending with a line ending in
 * a block quote ends with an empty lazy line. The content runs through the
 * line before the lazy one, collected as an open container's is with a `}`
 * on a further line (`collectedPastLine`), and is measured as that
 * container's is (`measuredThroughLine`): the failure is where it fails
 * within, or its terminator where it cannot take that; only content viable
 * through its terminator leaves the lazy line the failure — at its first
 * character, past the prefix the grammar matched, that no continuation of
 * the content could begin with (SPEC 14's location rule for 14.20).
 */
function lazyLineOffset(text: string, placed: number | undefined): number {
  if (placed === undefined) return 0;
  const lineStart = lineStartBefore(text, placed + 1);
  const terminator = terminatorBefore(text, lineStart);
  if (terminator === "") return placed;
  const end = lineStart - terminator.length;
  const head = text.slice(0, end);
  const collected = collectedPastLine(head) ?? collectedAtEnd(head);
  if (collected === undefined) return placed;
  return measuredThroughLine(text, end, collected, placed);
}

/** Line continuations a container's content may take (the `x` a probe). */
const CONTINUATIONS: readonly string[] = [
  "x",
  " x",
  "  x",
  "   x",
  "    x",
  "> x",
];

/**
 * Whether `head` — its last line partly spelled — still continues the
 * content of the container opening at `opening`: some continuation of the
 * line leaves that content collected, viable up to the probe's `x`.
 */
function continues(
  head: string,
  opening: number | undefined,
  kind: JsContentKind,
): boolean {
  if (opening === undefined) return false;
  for (const continuation of CONTINUATIONS) {
    const probe = head + continuation;
    const collected = collectedAtEnd(probe);
    if (collected === undefined || collected.kind !== kind) continue;
    const { content } = collected;
    if (
      contentToFile(probe, content, content.length, probe.length, 0) ===
        opening &&
      jsViablePrefix(content, kind) >= content.length - 1
    ) {
      return true;
    }
  }
  return false;
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
 * more character, the grammar does not yet reject so — a prefix ending
 * inside a tag judged with the tag finished, since the grammar pairs a tag
 * only once it has read it whole.
 */
function crossingOffset(text: string, at: number, closer: string): number {
  const bound = Math.min(text.length, at + PROBE_REACH);
  for (let end = at + 1; end <= bound; end += 1) {
    const head = text.slice(0, end);
    const { failure } = analysisParse(head);
    const inTag =
      failure !== null &&
      failure.source === "micromark-extension-mdx-jsx" &&
      placeStart(failure) === head.length;
    const tail = head.slice(head.lastIndexOf("<"));
    const completions = inTag
      ? [
          ">",
          "x>",
          ...(closer.startsWith(tail) ? [closer.slice(tail.length)] : []),
        ]
      : ["", "x"];
    if (!completions.some((completion) => completes(head + completion, end))) {
      return end - 1;
    }
  }
  return bound;
}

/** mdast-util-mdx-jsx's pairing failures, by message. */
const UNEXPECTED_CLOSING_TAG =
  /^Unexpected closing tag `[^`]*`, expected corresponding closing tag for `<([^`>]*)>`/;
const CROSSING_CLOSING_TAG = /^Expected the closing tag `<\/([^`>]*)>`/;
const EXPECTED_CLOSING_TAG =
  /^Expected a closing tag for `<([^`>]*)>` \((\d+):(\d+)-\d+:\d+\)/;

function pairingOffset(text: string, failure: MdxFailure): number {
  const reason = String(failure.reason);
  const start = placeStart(failure);
  if (failure.ruleId !== "end-tag-mismatch") return start ?? 0;
  const unexpected = UNEXPECTED_CLOSING_TAG.exec(reason);
  if (unexpected !== null && start !== undefined) {
    // The open element's closing tag, where it could stand, shares the
    // spelled one's characters up to their names' divergence; where it
    // could not (the element is outside the construct the tag is in), no
    // closing tag can, and the `/` fails.
    const closer = `</${unexpected[1]}>`;
    if (completes(text.slice(0, start) + closer, start + closer.length)) {
      return closingTagDivergence(text, start, unexpected[1]);
    }
    let slash = start + 1;
    while (slash < text.length && /\s/u.test(text.charAt(slash))) slash += 1;
    return slash;
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
  const crossing = CROSSING_CLOSING_TAG.exec(reason);
  if (crossing !== null && start !== undefined) {
    return crossingOffset(text, start, `</${crossing[1]}>`);
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
          return openContainerOffset(text, start);
        case "unexpected-empty-expression":
          return emptyAttributeOffset(text, start ?? 0);
        case "unexpected-lazy":
          return lazyLineOffset(text, start);
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

// ---------------------------------------------------------------------------
// The grammar's refusal of an attribute's content as empty (SPEC 14.20)
// ---------------------------------------------------------------------------
//
// SPEC 14.20 judges whether brace content is whitespace and comments alone
// by the comment deletions and, as spelled, by lexing to no token, and the
// braces of an attribute value or spread attribute admit no empty
// expression. remark-mdx takes the deletions' verdict alone: it refuses an
// attribute's content they empty before calling acorn — the
// `unexpected-empty-expression` of micromark-util-events-to-acorn, thrown
// through the whole parse — though such content may hold a token they
// hide: a `/*` inside a line comment reaching a later line's `*/`, a line
// comment the grammar ends at U+2028 or U+2029 while the deletions run on
// to the next LF or CR. Such content is no empty expression: it derives
// one expression beside whitespace and comments alone, or the brace closes
// no container (SPEC 14.20). The refusal is undone by respelling the text
// and parsing again: the refused content's leading comments — those among
// the whitespace before its first token, or before the character at which
// it fails to lex — are blanked to U+00A0, their line terminators kept.
// The deletions then leave that token or character in place, so the
// grammar hands the content to acorn (`mdxAcorn`), which judges it as
// SPEC 14.20 does; what follows the leading comments — whose comments the
// deletions judge (what follows the one expression) — stays as spelled.
// No offset moves and the content lexes to the same tokens (U+00A0 is
// ECMAScript whitespace), and no Markdown line changes: U+00A0 is neither
// a line ending nor Markdown's space or tab, so every line keeps its
// container prefix, its indentation, and its blankness. A brace inside
// those comments, which the grammar tried to no avail (the refused brace
// is the first whose content the deletions empty), is no longer tried.
// Content that is whitespace and comments alone keeps the refusal, located
// at its brace (`emptyAttributeOffset`).

/** How many refusals one parse may undo — one per attribute at most. */
const RESPELLINGS = 1024;

/** How many braces past a refused content's start are searched. */
const REFUSAL_BRACES = 4096;

/** The braces tried one by one before the search halves. */
const LINEAR_BRACES = 4;

/** The character a respelling writes (SPEC 14.20 whitespace). */
const RESPELLED = "\u00a0";

/** A text respelled so the stock grammar judges it as SPEC 14.20 does. */
interface Respelling {
  /** The respelled text: the same length and line endings. */
  readonly text: string;
  /** Each respelled offset (UTF-16), with the character it held. */
  readonly originals: ReadonlyMap<number, string>;
}

/**
 * The content of the attribute whose content begins at `place`, from there
 * to the brace at `brace`, as the stock grammar collects it when it tries
 * that brace — undefined when it never does, having refused an earlier
 * brace's content. An `x` spelled before the brace makes the grammar hand
 * the content to acorn, which records it: no deletion empties content
 * ending so.
 */
function contentBefore(
  text: string,
  place: number,
  brace: number,
): string | undefined {
  const head = text.slice(0, brace) + "x";
  const { calls } = recordedParse(head + "}");
  // micromark reads U+0000 as U+FFFD.
  const spelled = head.replace(/\0/gu, "\ufffd");
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const value = calls[index].value;
    const contents =
      value.startsWith("({") && value.endsWith("})")
        ? [value, value.slice(2, -2)]
        : [value];
    for (const content of contents) {
      if (content.endsWith("x") && contentStart(spelled, content) === place) {
        return content.slice(0, -1);
      }
    }
  }
  return undefined;
}

/**
 * The content the stock grammar refused, placed at `place`: the first brace
 * past it whose content, as collected, the deletions empty, and that
 * content. A single-line content is collected as spelled; otherwise the
 * grammar is asked (`contentBefore`), brace by brace and then by halving —
 * before the refused brace each content is collected and not emptied, past
 * it none is collected.
 */
function refusedContent(
  text: string,
  place: number,
): { readonly brace: number; readonly content: string } | undefined {
  const braces: number[] = [];
  for (
    let at = text.indexOf("}", place);
    at !== -1 && braces.length < REFUSAL_BRACES;
    at = text.indexOf("}", at + 1)
  ) {
    braces.push(at);
  }
  if (braces.length === 0) return undefined;
  let low = 0;
  const line = text.slice(place, braces[0]);
  if (!/[\n\r]/u.test(line)) {
    const content = line.replace(/\0/gu, "\ufffd");
    if (commentDeletionsEmpty(content)) return { brace: braces[0], content };
    low = 1;
  }
  let high = braces.length - 1;
  while (low <= high) {
    const middle = low < LINEAR_BRACES ? low : low + ((high - low) >> 1);
    const content = contentBefore(text, place, braces[middle]);
    if (content === undefined) {
      high = middle - 1;
    } else if (commentDeletionsEmpty(content)) {
      return { brace: braces[middle], content };
    } else {
      low = middle + 1;
    }
  }
  return undefined;
}

/**
 * The comments among the whitespace `content` begins with, as the grammar
 * lexes it — each [start, end) — up to its first token or the character at
 * which it fails to lex; null when it lexes to no token, being whitespace
 * and comments alone.
 */
function leadingComments(content: string): [number, number][] | null {
  const comments: [number, number][] = [];
  try {
    const tokenizer = mdxAcorn.tokenizer(content, {
      ...MDX_ACORN_OPTIONS,
      onComment: (
        _block: boolean,
        _text: string,
        start: number,
        end: number,
      ): void => {
        comments.push([start, end]);
      },
    });
    if (tokenizer.getToken().type === tokTypes.eof) return null;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  return comments;
}

/**
 * The file offset of each character of `content` — an attribute's content
 * from `place` to the brace at `brace`, as the grammar collects it — or
 * null where they disagree. The grammar collects each line after the first
 * less its Markdown container prefix and indentation, so each content line
 * is a suffix of its file line, and the lines correspond from the last.
 */
function contentPositions(
  text: string,
  place: number,
  brace: number,
  content: string,
): number[] | null {
  const positions = new Array<number>(content.length);
  let at = brace;
  for (let index = content.length - 1; index >= 0; index -= 1) {
    const code = content.charCodeAt(index);
    if (code === 0x0a || code === 0x0d) {
      // Past the file line's uncollected prefix, to its own ending.
      while (at > place && text.charCodeAt(at - 1) !== code) at -= 1;
    }
    at -= 1;
    const spelled = text.charCodeAt(at);
    if (
      at < place ||
      (spelled !== code && !(spelled === 0 && code === 0xfffd))
    ) {
      return null;
    }
    positions[index] = at;
  }
  return content.length === 0 || positions[0] === place ? positions : null;
}

/** ECMAScript 2024's line terminators: LF, CR, U+2028, U+2029. */
function isLineTerminator(code: number): boolean {
  return code === 0x0a || code === 0x0d || code === 0x2028 || code === 0x2029;
}

/**
 * SPEC 14.20: `text` respelled where the stock grammar refused an
 * attribute's content as empty (`failure`, placed at the content's start)
 * although it holds a token or fails to lex — its leading comments blanked
 * to U+00A0 — or null where the refusal stands: the content is whitespace
 * and comments alone, or the failure is another.
 */
function respellRefusedContent(
  text: string,
  failure: MdxFailure,
): Respelling | null {
  if (
    failure.source !== "micromark-extension-mdx-expression" ||
    failure.ruleId !== "unexpected-empty-expression"
  ) {
    return null;
  }
  const place = placeStart(failure);
  if (place === undefined) return null;
  try {
    const refused = refusedContent(text, place);
    if (refused === undefined) return null;
    const leading = leadingComments(refused.content);
    if (leading === null || leading.length === 0) return null;
    const positions = contentPositions(
      text,
      place,
      refused.brace,
      refused.content,
    );
    if (positions === null) return null;
    const units = text.split("");
    const originals = new Map<number, string>();
    for (const [start, end] of leading) {
      for (let index = start; index < end; index += 1) {
        if (isLineTerminator(refused.content.charCodeAt(index))) continue;
        const at = positions[index];
        originals.set(at, text.charAt(at));
        units[at] = RESPELLED;
      }
    }
    return originals.size === 0 ? null : { text: units.join(""), originals };
  } catch (error) {
    // Nesting too deep to probe: the refusal stands.
    if (error instanceof AnalysisAbandoned || error instanceof RangeError) {
      return null;
    }
    throw error;
  }
}

/**
 * `parse` — remark-mdx's stock grammar with `mdxAcorn`, as parsed here —
 * applied to `text` as SPEC 14.20 judges it: each refusal of an
 * attribute's content as empty that holds a token undone by respelling
 * (`respellRefusedContent`). The result comes with each respelled offset's
 * original character (none where the grammar refused no such content);
 * where the text is not well-formed, the last failure is thrown.
 */
export function parseAsJudged<T>(
  text: string,
  parse: (text: string) => T,
): { readonly result: T; readonly originals: ReadonlyMap<number, string> } {
  let parsed = text;
  const originals = new Map<number, string>();
  for (let round = 0; ; round += 1) {
    try {
      return { result: parse(parsed), originals };
    } catch (error) {
      const respelled =
        round < RESPELLINGS && typeof error === "object" && error !== null
          ? respellRefusedContent(parsed, error as MdxFailure)
          : null;
      if (respelled === null) throw error;
      for (const [at, original] of respelled.originals) {
        if (!originals.has(at)) originals.set(at, original);
      }
      parsed = respelled.text;
    }
  }
}
