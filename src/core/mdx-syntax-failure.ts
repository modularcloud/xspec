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
//   measured so, the lazy line failing only after content viable there,
//   and so does a line leaving the block container that holds it, the
//   grammar placing the end of the file at that line's start; content a
//   `}` closes on a line that then fails — a flow expression's brace
//   followed by text, its content spanning a blank line no paragraph
//   holds — fails at the first character past the brace that the grammar
//   rejects; and content opened by a construct begun right below a
//   paragraph line holding an open text element or text-level expression —
//   a brace line, a tag holding the brace, a brace after a tag or text on
//   that line, a brace inside a tag or expression running on from it; the
//   flow reading doomed, the text reading the paragraph's — fails at the
//   latest at the terminator of its first line of container syntax and
//   whitespace alone, and below an open expression, whose content that
//   reading goes on with, where that content fails;
// - an ESM block: the block's text, as recorded, measured as a module of
//   import and export declarations;
// - a JSX tag's own syntax: the stock tokenizer's character;
// - tag pairing: a closing tag where its name departs from the open
//   element's; a construct ending, or an emphasis closing, with an element
//   still open inside it — the longest prefix a closing tag (or one more
//   character) can still complete, found by probing the grammar, a prefix
//   ending inside a tag probed with the tag finished;
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

/**
 * What the stock grammar drops before a container's content line: block
 * quote markers and indentation (a list item's continuation is spaces).
 */
const LINE_SYNTAX = /^[ \t>]*$/;

/** A container's content as collected, and the grammar it is judged by. */
interface Collected {
  readonly content: string;
  readonly kind: JsContentKind;
}

/**
 * Where `content` begins in `head` when, as the stock grammar collects a
 * container's content, it runs to `head`'s end — its lines each a suffix of
 * the file line it corresponds to (the last ending `head`), each line after
 * the first past what the grammar drops before a content line: container
 * syntax and indentation (`LINE_SYNTAX`) — or undefined when it does not.
 * Content ending with a line terminator was closed by a `}` that begins a
 * line past its container syntax, so it runs to the end of no `head` whose
 * last line holds more: an empty last content line is a suffix of every
 * line.
 */
function contentStart(head: string, content: string): number | undefined {
  const contentLines = lineSpans(content);
  const fileLines = lineSpans(head);
  const first = fileLines.length - contentLines.length;
  if (first < 0) return undefined;
  for (let line = 0; line < contentLines.length; line += 1) {
    const [lineStart, lineEnd] = contentLines[line];
    const [fileStart, fileEnd] = fileLines[first + line];
    const fileLine = head.slice(fileStart, fileEnd);
    const contentLine = content.slice(lineStart, lineEnd);
    if (
      !fileLine.endsWith(contentLine) ||
      (line > 0 &&
        !LINE_SYNTAX.test(
          fileLine.slice(0, fileLine.length - contentLine.length),
        ))
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
 * A line's leading block quote markers, list markers (each followed by a
 * space, a tab, or the line's end), and indentation.
 */
const CONTAINER_RUN = /^(?:[ \t>]|(?:[-*+]|[0-9]{1,9}[.)])(?=[ \t]|$))*/;

/** `spelled` with each list marker blanked: `- ` becomes two spaces. */
function blankedListMarkers(spelled: string): string {
  return spelled.replace(/[-*+]|[0-9]{1,9}[.)]/g, (marker) =>
    " ".repeat(marker.length),
  );
}

/**
 * The continuation prefix a container's content lines give: the leading
 * block quote markers, list markers, and indentation of the last line of
 * `text` holding more than those, list markers blanked as `containerPrefix`
 * blanks them — `> - ` gives `>   `, `- > ` gives `  > `; undefined when
 * no line holds more. Inside nested containers (a list item in a block
 * quote, a block quote in a list item) a line continues them all only so,
 * which no fixed prefix spells (SPEC 14's location rule for 14.20) — however
 * many lines of that syntax alone (the content's blank lines) follow it.
 * The grammar judges every probe, so a wrong candidate (content spelled
 * like a marker) only fails to collect.
 */
function contentLinePrefix(text: string): string | undefined {
  const spans = lineSpans(text);
  for (let line = spans.length - 1; line >= 0; line -= 1) {
    const spelled = text.slice(spans[line][0], spans[line][1]);
    const run = CONTAINER_RUN.exec(spelled)?.[0] ?? "";
    if (run.length < spelled.length) return blankedListMarkers(run);
  }
  return undefined;
}

/**
 * The content of the container `head`'s last line — spelled as it stands,
 * so a blank line stays blank and a lone tag stays a flow tag — still
 * belongs to: a `}` on a further line (after a continuation prefix) falls
 * in it. The content returned ends with that last line, the further line's
 * terminator and prefix cut off. Whichever prefix the `}` follows, the
 * content through that last line is the same; the prefix the content's own
 * lines give (`contentLinePrefix`) is tried first, then the fixed ones. An
 * attribute's content that is whitespace alone so far is refused before
 * acorn sees it, so the `}` is also tried after an `x`, a token on the
 * further line that leaves the content through the last line unchanged.
 */
function collectedPastLine(head: string): Collected | undefined {
  const own = contentLinePrefix(head);
  const prefixes =
    own === undefined
      ? LINE_PREFIXES
      : [own, ...LINE_PREFIXES.filter((prefix) => prefix !== own)];
  for (const prefix of prefixes) {
    const probe = head + "\n" + prefix;
    const collected = collectedAtEnd(probe) ?? collectedAtEnd(probe + "x");
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

/** The ends (at their terminators) of `text`'s lines from `from`'s on. */
function lineEndsFrom(text: string, from: number): number[] {
  let end = lineEndFrom(text, from);
  const ends = [end];
  while (end < text.length) {
    end = lineEndFrom(text, end + terminatorAt(text, end).length);
    ends.push(end);
  }
  return ends;
}

/** The lines past a failure's place probed one by one before galloping. */
const LINEAR_LINES = 8;

/**
 * The last of `count` lines, numbered from 0, past which `collect` still
 * collects a container's content (`collectedPastLine`), with that content —
 * line 0 known to collect `first`. Collection is monotone: a container
 * still open past a line is open past every line before it. So the lines
 * are searched, not walked: one by one through the first `LINEAR_LINES`
 * (content mostly ends within a few lines of the place, and a probe past
 * its end, trying every prefix, costs several probes within it), then
 * galloping by doubling steps to the first line that collects nothing, and
 * bisecting between it and the last line that collects — O(log count)
 * probes, each a few parses of the prefix, where a walk costs a probe per
 * line of content and a bounded walk ends early inside longer content
 * (SPEC 14's location rule for 14.20).
 */
function lastCollectedLine(
  count: number,
  collect: (line: number) => Collected | undefined,
  first: Collected,
): { readonly line: number; readonly collected: Collected } {
  let low = 0;
  let collected = first;
  let high = count;
  let step = 1;
  while (low + 1 < high) {
    const line = Math.min(low + step, high - 1);
    const probed = collect(line);
    if (probed === undefined) {
      high = line;
      break;
    }
    low = line;
    collected = probed;
    if (low >= LINEAR_LINES) step *= 2;
  }
  while (low + 1 < high) {
    const line = low + Math.floor((high - low) / 2);
    const probed = collect(line);
    if (probed === undefined) {
      high = line;
    } else {
      low = line;
      collected = probed;
    }
  }
  return { line: low, collected };
}

/**
 * A container the stock grammar reached the end of without its content
 * deriving (an expression container, attribute value expression, or spread
 * attribute; `placed` the grammar's place for the failure, inside it): its
 * content, from the opening brace on, measured by its own grammar. When it
 * runs to the end of `text`, a `}` appended there collects it. When the
 * block container holding it ended first, or a line past the place ends the
 * content otherwise (a brace closing it that text follows), the content
 * ends with the last line past which a `}` on a further line still falls
 * in the container, however far past the place (`lastCollectedLine`) —
 * and, the content viable through that line and its terminator, the failure
 * is the next line's first character that no continuation of the content
 * could begin with, or past the brace closing it there
 * (`measuredThroughLine`).
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
  if (atEnd !== undefined) {
    return textReadingBound(
      text,
      openingOf(text, atEnd),
      measured(text, atEnd),
    );
  }
  if (placed === undefined) return 0;
  const ends = lineEndsFrom(text, placed);
  const collect = (line: number): Collected | undefined =>
    collectedPastLine(text.slice(0, ends[line]));
  const first = collect(0);
  if (first === undefined) {
    // The line holding the failure's place is the container's, whatever
    // follows it.
    const same = collectedAtEnd(text.slice(0, ends[0]));
    return same === undefined
      ? lineLeavingOffset(text, placed)
      : measuredThroughLine(text, ends[0], same, 0);
  }
  const last = lastCollectedLine(ends.length, collect, first);
  return measuredThroughLine(text, ends[last.line], last.collected, 0);
}

/**
 * A container whose content the grammar ended at the start of the line
 * holding `placed`, no line from there on its own: a line that leaves the
 * content's block container — beginning a new list item or block quote, or
 * a sibling of the list item holding the content — ends the content at the
 * line before it (micromark's `closeFlow`), the end of the file placed at
 * this line's start. The content runs through the line before, collected
 * as an open container's is (`collectedPastLine`), and is measured as that
 * container's is (`measuredThroughLine`): this line's container syntax may
 * still continue the content — a lone `>` is a blank line of a list item in
 * a block quote — so the failure is its first character that no
 * continuation of the content could begin with (SPEC 14's location rule for
 * 14.20). `placed` itself where it lies elsewhere or nothing is collected.
 */
function lineLeavingOffset(text: string, placed: number): number {
  const terminator = terminatorBefore(text, placed);
  if (terminator === "") return placed;
  const end = placed - terminator.length;
  const head = text.slice(0, end);
  const collected = collectedPastLine(head) ?? collectedAtEnd(head);
  if (collected === undefined) return placed;
  return measuredThroughLine(text, end, collected, 0);
}

/**
 * A container's content collected through the line ending at `end` (at
 * its terminator), measured by its own grammar: where it fails within, that
 * offset; where it cannot take the line's terminator, `end`; otherwise the
 * next line's first character — from `from` on, where that lies further —
 * other than those a continuation of the content could still begin with,
 * or, where that line's `}` closes the content, the first character past
 * it the grammar rejects (`pastClosingBrace`) — each bounded where the
 * construct holding the content's brace begins right below a paragraph
 * line holding an open text element (`textReadingBound`).
 */
function measuredThroughLine(
  text: string,
  end: number,
  collected: Collected,
  from: number,
): number {
  const opening = openingOf(text.slice(0, end), collected);
  return textReadingBound(
    text,
    opening,
    flowMeasuredThroughLine(text, end, collected, from, opening),
  );
}

/**
 * `measuredThroughLine` as a flow construct's content goes on: past blank
 * lines, and past a closing brace only by what follows it.
 */
function flowMeasuredThroughLine(
  text: string,
  end: number,
  collected: Collected,
  from: number,
  opening: number | undefined,
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
  // it has become something else (a new list item, a blank line) or its
  // `}` has closed the content.
  let at = Math.max(end + terminator.length, from);
  const bound = Math.min(text.length, at + PROBE_REACH);
  while (at < bound && terminatorAt(text, at) === "") {
    if (continues(text.slice(0, at + 1), opening, kind)) {
      at += 1;
    } else if (
      text.charAt(at) === "}" &&
      opening !== undefined &&
      closesAt(text, at, opening, kind)
    ) {
      return pastClosingBrace(text, at);
    } else {
      break;
    }
  }
  return at;
}

/**
 * Where collected content running to `head`'s end opens in `head` (right
 * after its opening brace), or undefined where that is not known.
 */
function openingOf(head: string, collected: Collected): number | undefined {
  const { content } = collected;
  return contentToFile(head, content, content.length, head.length, 0);
}

/**
 * Whether the `}` at `brace` closes the container whose content, of
 * `kind`, opens at `opening`: the grammar tries every `}` and closes the
 * container at the first whose content derives, so the content before this
 * one is collected at it (a `}` appended there falls in the container) and
 * none runs past it (a `}` appended past it falls in no content opening
 * there).
 */
function closesAt(
  text: string,
  brace: number,
  opening: number,
  kind: JsContentKind,
): boolean {
  const collectedTo = (end: number): boolean => {
    const head = text.slice(0, end);
    const collected = collectedAtEnd(head);
    return (
      collected !== undefined &&
      collected.kind === kind &&
      openingOf(head, collected) === opening
    );
  };
  return collectedTo(brace) && !collectedTo(brace + 1);
}

/** How deeply scans past closing braces may nest (through `goesOn`). */
const PAST_BRACE_DEPTH = 4;

/** The scans past closing braces in progress (`goesOn`). */
let pastBraceDepth = 0;

/**
 * A container's content closed by the `}` at `brace`, the line it closes
 * on having gone on so far only as its content: the prefix through the
 * brace is viable (a line ending, or `>` after a tag's attribute, may
 * follow), and the failure is the first character past it that the
 * grammar, reading the prefix through that character, rejects (`goesOn`) —
 * past a flow expression's closing brace, a flow construct goes on only
 * with whitespace, tags, and expressions after tags before its line ends,
 * and the paragraph the grammar reads its line as otherwise cannot hold
 * content spanning a blank line (SPEC 14's location rule for 14.20). A tag
 * or expression past the brace may go on to further lines, whose container
 * syntax the prefix may end inside (`goesOnPrefixed`).
 */
function pastClosingBrace(text: string, brace: number): number {
  const prefix = contentLinePrefix(text.slice(0, brace + 1));
  const bound = Math.min(text.length, brace + 1 + PROBE_REACH);
  let at = brace + 1;
  while (at < bound) {
    const head = text.slice(0, at + 1);
    if (!goesOn(head, brace) && !goesOnPrefixed(head, brace, prefix)) break;
    at += 1;
  }
  return at;
}

/**
 * Whether `head`, whose last line — past the one holding the `}` at
 * `brace` — spells container syntax alone so far, goes on (`goesOn`) once
 * that line spells the rest of the container prefix the brace's line gives
 * (`prefix`; `prefixRests`), then `x` or nothing: the grammar places the
 * end of a file ending so at that line's start, where no construct's
 * content has begun (a lone space of a list item's two, a block quote's
 * `>` short of its list item's indentation).
 */
function goesOnPrefixed(
  head: string,
  brace: number,
  prefix: string | undefined,
): boolean {
  if (prefix === undefined) return false;
  const lineStart =
    Math.max(head.lastIndexOf("\n"), head.lastIndexOf("\r")) + 1;
  const spelled = head.slice(lineStart);
  if (
    lineStart <= brace ||
    (CONTAINER_RUN.exec(spelled)?.[0] ?? "").length < spelled.length
  ) {
    return false;
  }
  return prefixRests(prefix, spelled).some(
    (rest) =>
      (rest !== "" && goesOn(head + rest, brace)) ||
      goesOn(head + rest + "x", brace),
  );
}

/**
 * Whether `head`, a prefix of the file ending past a `}` at `brace` that
 * closed a container, goes on as far as the grammar's reading tells: it
 * derives, fails only by tag pairing (located by the checks of prefixes,
 * `hiddenFailure`), or fails by a construct's class only at or after its
 * end (`classOffset`). A failure placed at or before the brace belongs to
 * a reading that gave way: the construct holding the brace failed on what
 * follows it — a flow expression on text after it — and the paragraph the
 * grammar reads instead failed before it, content spanning a blank line
 * being no text expression's. Nested scans (a probe's own failure past a
 * later closing brace) are bounded by `PAST_BRACE_DEPTH`, beyond which a
 * failure counts by its place alone.
 */
function goesOn(head: string, brace: number): boolean {
  const { failure, calls } = analysisParse(head);
  if (failure === null || failure.source === "mdast-util-mdx-jsx") return true;
  const start = placeStart(failure);
  if (start === undefined || start <= brace) return false;
  if (pastBraceDepth >= PAST_BRACE_DEPTH) return start >= head.length;
  pastBraceDepth += 1;
  try {
    return classOffset(head, failure, calls) >= head.length;
  } finally {
    pastBraceDepth -= 1;
  }
}

// The stock grammar tries a line whose content begins with `{` or `<` as a
// flow construct first — a flow expression, a flow tag — which interrupts
// the paragraph above it, and gives the line to that paragraph, the brace
// a text expression's or a text tag's, only where text after the
// construct on its line makes it no flow construct (an attempt meeting the
// end of the file or a lazy line throws, and a tag, once past `<` and a
// character other than a space or a line ending, is read as a tag in
// either reading). Below a paragraph line holding an open text element the
// flow reading never derives: the paragraph it interrupts ends with the
// element open. The text reading alone is left, and a paragraph holds no
// line of container syntax and whitespace alone — such a line is blank, or
// begins a block quote, which interrupts a paragraph — so neither does its
// text expression or text tag, whatever a flow construct's content may
// span. The same holds for a brace further along the line below the
// paragraph line, after a tag or text, and for a brace on a later line
// inside a tag or expression begun on that line: the paragraph, once past
// its line, cannot end inside a construct unfinished there, so it holds
// the brace. Where the content is still open at such a line, no completion
// of a prefix past that line's terminator derives (SPEC 14's location rule
// for 14.20); a failure the flow reading's measures place before it fails
// the text reading too, the two collecting the same content there. A code
// span, a link title, or a definition's label or title opened in the
// paragraph may close past the brace, hiding it — and the element — in the
// text reading (`[a <S id="s">` LF `` {` `` LF `]: u` LF LF `` `} b ``
// derives, a definition), so a paragraph holding a backtick or a bracket
// is left to the flow reading's measures; one opened past the paragraph
// line, before the brace, is the grammar's own reading there, a line that
// does not begin with `{` or `<` being text alone.
//
// Below a paragraph line holding an open text-level expression — a text
// expression, or an attribute value expression or spread attribute of a
// text tag — the flow reading is doomed alike, and in the text reading the
// line below is the expression's content, the brace no container's: the
// two readings collect different content, so the text reading's is
// collected as that reading has it, the line below respelled so that no
// flow construct begins it (`textExpressionBound`). A code span, link, or
// definition hiding the expression ends by the paragraph's end, so that
// probe sees it.

/** The stock grammar's report of an element a paragraph's end left open. */
const PARAGRAPH_LEFT_OPEN = /before the end of `paragraph`$/;

/** The end of the line holding `from` (its terminator's start). */
function lineEndFrom(text: string, from: number): number {
  let at = from;
  while (at < text.length && terminatorAt(text, at) === "") at += 1;
  return at;
}

/** The start of the line whose end (its terminator's start) is `end`. */
function lineStartAt(text: string, end: number): number {
  let at = end;
  while (at > 0 && terminatorBefore(text, at) === "") at -= 1;
  return at;
}

/**
 * Whether `failure`, the grammar's for a prefix ending at `end`, is the
 * end of the file met inside a JSX tag or an expression — a construct the
 * prefix leaves unfinished at its end.
 */
function endsInsideConstruct(failure: MdxFailure, end: number): boolean {
  return (
    (failure.source === "micromark-extension-mdx-jsx" ||
      failure.source === "micromark-extension-mdx-expression") &&
    failure.ruleId === "unexpected-eof" &&
    placeStart(failure) === end
  );
}

/**
 * Whether `failure`, the grammar's for a prefix ending at `end`, is a
 * paragraph ending there with a text element open — the paragraph holding
 * no backtick or bracket (above).
 */
function leavesParagraphOpen(
  text: string,
  failure: MdxFailure,
  end: number,
): boolean {
  const reason = String(failure.reason);
  const paragraphStart = placeStart(failure);
  return (
    failure.source === "mdast-util-mdx-jsx" &&
    EXPECTED_CLOSING_TAG.test(reason) &&
    PARAGRAPH_LEFT_OPEN.test(reason) &&
    placeEnd(failure) === end &&
    paragraphStart !== undefined &&
    !/[`[\]]/.test(text.slice(paragraphStart, end))
  );
}

/**
 * Whether `failure`, the grammar's for a prefix ending at `end` inside an
 * expression (`endsInsideConstruct`), is a text-level one's — a text
 * expression, or an attribute value expression or spread attribute of a
 * text tag — held open by a paragraph (or heading) line ending at `end`,
 * `terminator` the line's: the prefix through the terminator fails there
 * too, the paragraph ending at the line, where a flow construct's content
 * would run on past it (the end of the file placed past the terminator, or
 * the empty line past it lazy).
 */
function holdsOpenTextExpression(
  text: string,
  failure: MdxFailure,
  end: number,
  terminator: string,
): boolean {
  if (failure.source !== "micromark-extension-mdx-expression") return false;
  const through = analysisParse(text.slice(0, end + terminator.length));
  return (
    through.failure !== null &&
    through.failure.source === "micromark-extension-mdx-expression" &&
    through.failure.ruleId === "unexpected-eof" &&
    placeStart(through.failure) === end
  );
}

/** How many lines of a construct `openParagraphAbove` walks back over. */
const CONSTRUCT_LINES = 64;

/**
 * A paragraph line above the construct holding a brace (its end), and what
 * it holds open at its end: a text element, or a text-level expression
 * whose content the lines below go on with in the text reading.
 */
interface ParagraphLine {
  readonly end: number;
  readonly open: "element" | "expression";
}

/**
 * `openParagraphAbove`'s findings in the analysis in progress, by the text
 * before the brace's line — all they depend on: the probes of one analysis
 * ask of the same lines again and again, and each step of the walk parses
 * a prefix.
 */
let paragraphsAbove: Map<string, readonly ParagraphLine[]> | null = null;

/**
 * The paragraph lines holding an open text element or text-level
 * expression right above the line where the construct holding a brace
 * begins — the brace's line starting at `lineStart`, or, where the prefix
 * through the line above ends inside a JSX tag or an expression, the first
 * of the lines such constructs run over, walking back line by line
 * (above), at most `CONSTRUCT_LINES` of them: the first line found whose
 * prefix ends inside a text-level expression a paragraph holds
 * (`holdsOpenTextExpression`), walked over all the same, and the line where
 * the walk ends if the grammar reads a paragraph ending there with a text
 * element open (`leavesParagraphOpen`) — none where the walk meets a blank
 * line, the file's first line, or a prefix the grammar reads otherwise
 * first, or runs over more lines.
 */
function openParagraphAbove(
  text: string,
  lineStart: number,
): readonly ParagraphLine[] {
  const key = text.slice(0, lineStart);
  const known = paragraphsAbove?.get(key);
  if (known !== undefined) return known;
  const found = walkToOpenParagraph(text, lineStart);
  paragraphsAbove?.set(key, found);
  return found;
}

/** `openParagraphAbove`'s walk. */
function walkToOpenParagraph(
  text: string,
  lineStart: number,
): readonly ParagraphLine[] {
  const found: ParagraphLine[] = [];
  let start = lineStart;
  for (let line = 0; line <= CONSTRUCT_LINES; line += 1) {
    const terminator = terminatorBefore(text, start);
    if (terminator === "") return found;
    const end = start - terminator.length;
    start = lineStartAt(text, end);
    if (LINE_SYNTAX.test(text.slice(start, end))) return found;
    const { failure } = analysisParse(text.slice(0, end));
    if (failure === null) return found;
    if (!endsInsideConstruct(failure, end)) {
      if (leavesParagraphOpen(text, failure, end)) {
        found.push({ end, open: "element" });
      }
      return found;
    }
    if (
      found.length === 0 &&
      holdsOpenTextExpression(text, failure, end, terminator)
    ) {
      found.push({ end, open: "expression" });
    }
  }
  return found;
}

/**
 * `result`, measured for the container whose content opens at `opening`,
 * bounded by the text reading (above) where the construct holding the
 * container's `{` begins right below a paragraph line holding an open text
 * element or text-level expression (`openParagraphAbove`): at the
 * terminator of the first line past the brace's of container syntax and
 * whitespace alone, where the content is still open at that line — below
 * an open element, a `}` ending the line before it falls in the container
 * (the two readings collect the same content); below an open expression,
 * whose content the text reading goes on with instead, as that reading
 * collects it (`textExpressionBound`).
 */
function textReadingBound(
  text: string,
  opening: number | undefined,
  result: number,
): number {
  if (opening === undefined || text.charAt(opening - 1) !== "{") {
    return result;
  }
  let before = lineEndFrom(text, opening);
  let blankEnd: number | undefined;
  while (blankEnd === undefined) {
    const start = before + terminatorAt(text, before).length;
    const end = lineEndFrom(text, start);
    if (end >= result || end >= text.length) return result;
    if (LINE_SYNTAX.test(text.slice(start, end))) blankEnd = end;
    else before = end;
  }
  // An attribute's content that is whitespace alone so far is refused
  // before acorn sees it, so the `}` is also tried after an `x`: no text
  // past the line reopens a container a `}` on it closed.
  const openAt = (head: string): boolean => {
    const collected = collectedAtEnd(head);
    return collected !== undefined && openingOf(head, collected) === opening;
  };
  const head = text.slice(0, before);
  let bound = result;
  const paragraphs = openParagraphAbove(text, lineStartBefore(text, opening));
  for (const { end, open } of paragraphs) {
    if (open === "expression") {
      bound = Math.min(bound, textExpressionBound(text, end, before, blankEnd));
    } else if (openAt(head) || openAt(head + "x")) {
      bound = Math.min(bound, blankEnd);
    }
  }
  return bound;
}

/**
 * The bound the text reading sets where a paragraph line ending at
 * `paragraphEnd` holds a text-level expression open, the construct holding
 * a brace beginning on the line right below it, and the first line past
 * that construct's of container syntax and whitespace alone ending at
 * `blankEnd`, the line before it at `before`. The flow reading of the line
 * below — a flow expression or tag interrupting the paragraph — leaves the
 * expression open at the paragraph's end, so it never derives; in the text
 * reading that line and the ones after it are the paragraph's, their
 * characters the expression's content, which cannot span the blank line
 * (SPEC 14's location rule for 14.20). That reading is probed with the
 * line below respelled past its container syntax with U+00A0 — no flow
 * construct begins with it, and to acorn it is whitespace, or a character
 * of the string, comment, or template it falls in — and the expression's
 * content collected at a `}` appended to the line before the blank one:
 * where it fails within, that offset; where it cannot take that line's
 * terminator, the terminator; otherwise `blankEnd`. `Infinity` where the
 * probe collects no content of that expression: it closed before, or a
 * code span, link, or definition begun before its brace and ending there
 * hides it.
 */
function textExpressionBound(
  text: string,
  paragraphEnd: number,
  before: number,
  blankEnd: number,
): number {
  const below = paragraphEnd + terminatorAt(text, paragraphEnd).length;
  const spelled = text.slice(below, lineEndFrom(text, below));
  const at = below + (CONTAINER_RUN.exec(spelled)?.[0] ?? "").length;
  if (at > before) return Infinity;
  const head = text.slice(0, at) + RESPELLED + text.slice(at, before);
  const collected = collectedAtEnd(head);
  if (collected === undefined) return Infinity;
  const opening = openingOf(head, collected);
  if (opening === undefined || opening > paragraphEnd) return Infinity;
  const within = measured(head, collected);
  if (within < head.length) return within > at ? within - 1 : within;
  const terminator = terminatorAt(text, before);
  const { content, kind } = collected;
  return jsViablePrefix(content + terminator, kind) <
    content.length + terminator.length
    ? before
    : blankEnd;
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
 * What may follow a line spelled so far as `spelled` to continue the
 * containers a continuation prefix (`prefix`) continues: the prefix's rest
 * past what the line spells of it, then each of its suffixes, the whole
 * first, since the line may have spelled any leading part of it, and
 * spelled it otherwise (`> ` where the prefix spells `>>`). A suffix
 * beginning inside a run of spaces and tabs is left out: the one beginning
 * at the run's start continues wherever it does, since more indentation
 * keeps a line in its containers (indented code is disabled).
 */
function prefixRests(prefix: string, spelled: string): string[] {
  const rests = prefix.startsWith(spelled)
    ? [prefix.slice(spelled.length)]
    : [];
  for (let from = 0; from < prefix.length; from += 1) {
    if (from > 0 && /[ \t]{2}/.test(prefix.slice(from - 1, from + 1))) {
      continue;
    }
    rests.push(prefix.slice(from));
  }
  return rests;
}

/**
 * The continuations of `head`'s last line, partly spelled, to probe: the
 * rests (`prefixRests`) of the prefix the content's lines before it give
 * (`contentLinePrefix`), then the fixed ones, each followed by the probe's
 * `x`.
 */
function continuationsOf(head: string): readonly string[] {
  const lineStart = lineStartBefore(head, head.length);
  if (lineStart === 0) return CONTINUATIONS;
  const before = head.slice(
    0,
    lineStart - terminatorBefore(head, lineStart).length,
  );
  const own = contentLinePrefix(before);
  if (own === undefined) return CONTINUATIONS;
  const derived = prefixRests(own, head.slice(lineStart)).map(
    (rest) => rest + "x",
  );
  return [...new Set([...derived, ...CONTINUATIONS])];
}

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
  for (const continuation of continuationsOf(head)) {
    const probe = head + continuation;
    const collected = collectedAtEnd(probe);
    if (collected === undefined || collected.kind !== kind) continue;
    const { content } = collected;
    if (
      openingOf(probe, collected) === opening &&
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
 * How `probe`, a prefix of the file ending at `at` plus a completion,
 * completes: `"whole"` where it derives, `"paired"` where tag pairing fails
 * only at or after `at`, `"class"` where a construct fails only there by
 * its class (`classOffset`), null where it fails before `at`. A pairing
 * failure in the probe counts by the construct it concerns (no probing
 * within a probe). A class failure stops the grammar before it pairs tags,
 * so a `"class"` completion leaves unjudged the pairing before `at`.
 */
function completion(
  probe: string,
  at: number,
): "whole" | "paired" | "class" | null {
  const { failure, calls } = analysisParse(probe);
  if (failure === null) return "whole";
  if (failure.source === "mdast-util-mdx-jsx") {
    const place = String(failure.reason).startsWith(
      "Expected a closing tag for",
    )
      ? placeEnd(failure)
      : placeStart(failure);
    return place === undefined || place >= at ? "paired" : null;
  }
  return classOffset(probe, failure, calls) >= at ? "class" : null;
}

/**
 * Whether `probe`, a prefix of the file ending at `at` plus a completion,
 * fails only at or after `at`: its grammar failure, if any, is the
 * completion's or the end's (`completion`).
 */
function completes(probe: string, at: number): boolean {
  return completion(probe, at) !== null;
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
  return blankedListMarkers(before);
}

/**
 * The stock tokenizer's failure at the end of `head` where `head` ends
 * inside a JSX tag (its reason); null where it does not. The grammar pairs
 * a tag only once it has read it whole.
 */
function tagEndingAt(head: string): string | null {
  const { failure } = analysisParse(head);
  return failure !== null &&
    failure.source === "micromark-extension-mdx-jsx" &&
    placeStart(failure) === head.length
    ? String(failure.reason)
    : null;
}

/** A quoted attribute value a tag is left inside: its quote. */
const IN_QUOTED_VALUE =
  / in attribute value, expected a corresponding closing quote `(.)`/u;
/** A tag left inside its name, or before it, where a closer may go on. */
const IN_TAG_NAME = / (?:before|in) (?:member |local )?name,/u;
/** A closing tag a prefix ends inside, its name so far (the tag's own). */
const CLOSING_SO_FAR = /<\/[ \t]*([^\s<>/{}"'=]*)$/u;
/** mdast-util-mdx-jsx's failures of a tag's own syntax, not its pairing. */
const TAG_SYNTAX: ReadonlySet<string> = new Set([
  "unexpected-attribute",
  "unexpected-self-closing-slash",
]);

/**
 * The ways to finish the JSX tag a prefix ends inside, by where the stock
 * tokenizer leaves it (`reason`): a quoted attribute value closed by its
 * quote, a missing value given as `""`, and a name begun after `.` or `:`
 * given a character, before the tag ends as a self-closing and an opening
 * tag; a tag left after its self-closing slash ended; any other ended by
 * `>`, `/>`, and `x>`.
 */
function tagFinishes(reason: string): string[] {
  const quote = IN_QUOTED_VALUE.exec(reason)?.[1];
  if (quote !== undefined) return [quote + "/>", quote + ">"];
  if (reason.includes(" before attribute value,")) return ['""/>', '"">'];
  if (reason.includes(" after self-closing slash,")) return [">"];
  if (/ before (?:member |local |local attribute )name,/u.test(reason)) {
    return ["x/>", "x>"];
  }
  return [">", "/>", "x>"];
}

/**
 * The rest of the closing tag of the element named `name` past what the
 * end of `head` — inside a tag's name or before it — spells of it: past
 * `<`, or past `</` and part of the name; null where `head` spells no part
 * of it.
 */
function closerRest(head: string, name: string): string | null {
  if (head.endsWith("<")) return "/" + name + ">";
  const spelled = CLOSING_SO_FAR.exec(head)?.[1];
  return spelled !== undefined && name.startsWith(spelled)
    ? name.slice(spelled.length) + ">"
    : null;
}

/** How many lines back an earlier construct taking a tag in is sought. */
const ABSORBER_LINES = 64;
/** How many backtick run lengths close such a code span, at most. */
const ABSORBER_RUNS = 4;

/**
 * Finishes that take the JSX tag a prefix (`head`) ends inside into an
 * earlier construct the rest of the file may still close, which makes its
 * `<` no tag: a code span opened by a backtick run (closed by a run as
 * long), a link resource past `](` (its pointy or raw destination, or its
 * title, closed with the resource), and a definition past `]:` (its pointy
 * destination closed, or its raw one ended) — sought in the lines since the
 * last blank one, where such a construct would begin.
 */
function absorberFinishes(head: string): string[] {
  const lines = head.split(/\r\n|\r|\n/u);
  let first = lines.length - 1;
  while (
    first > 0 &&
    lines.length - first < ABSORBER_LINES &&
    !/^[ \t>]*$/u.test(lines[first - 1] ?? "")
  ) {
    first -= 1;
  }
  const block = lines.slice(first).join("\n");
  const runs = new Set<number>();
  for (const [run] of block.matchAll(/`+/gu)) runs.add(run.length);
  const finishes = [...runs]
    .slice(0, ABSORBER_RUNS)
    .map((length) => "`".repeat(length));
  if (block.includes("](")) finishes.push(">)", ")", '")', "')", "))");
  if (block.includes("]:")) finishes.push(">", "");
  return finishes;
}

/**
 * Whether `head`, a prefix of the file ending at `at` inside a JSX tag
 * (`reason`, the stock tokenizer's failure there; `tagEndingAt`), goes on
 * to close the element whose closing tag is `closer` (its container prefix
 * `prefix`): the tag finished (`tagFinishes` — and, where the prefix ends
 * inside a tag's name or before it, the rest of `closer`, or of the closing
 * tag of the element the grammar pairs a finished closing tag with), then
 * `closer`, directly or after a paragraph's `x`; or the tag taken into an
 * earlier construct (`absorberFinishes`), then `closer` so or on the next
 * line — derives or fails only by tag pairing at or after `at` (SPEC 14's
 * location rule for 14.20). A failure of the finished tag's own syntax (a
 * closing tag given an attribute or a self-closing slash) or of a
 * construct's class judges nothing: the grammar has not paired the tag.
 */
function finishedTagCompletes(
  head: string,
  at: number,
  reason: string,
  closer: string,
  prefix: string,
): boolean {
  const tagStart = CLOSING_SO_FAR.exec(head)?.index;
  const nameFinishes = IN_TAG_NAME.test(reason);
  const finishes: string[] = [];
  const add = (finish: string | null): void => {
    if (finish !== null && !finishes.includes(finish)) finishes.push(finish);
  };
  const addCloserRest = (name: string): void => {
    if (nameFinishes) add(closerRest(head, name));
  };
  const judged = (probe: string): boolean => {
    const { failure } = analysisParse(probe);
    if (failure === null) return true;
    if (
      failure.source !== "mdast-util-mdx-jsx" ||
      TAG_SYNTAX.has(String(failure.ruleId))
    ) {
      return false;
    }
    const failed = String(failure.reason);
    const place = failed.startsWith("Expected a closing tag for")
      ? placeEnd(failure)
      : placeStart(failure);
    if (place === undefined || place >= at) return true;
    // The finished closing tag's name departs from the open element's:
    // that element's name may still finish it.
    const expected = UNEXPECTED_CLOSING_TAG.exec(failed);
    if (expected !== null && place === tagStart) {
      addCloserRest(expected[1] ?? "");
    }
    return false;
  };
  // A closing tag is most likely finished by its element's name; an
  // opening tag by ending it.
  if (tagStart !== undefined) addCloserRest(closer.slice(2, -1));
  for (const finish of tagFinishes(reason)) add(finish);
  addCloserRest(closer.slice(2, -1));
  for (let index = 0; index < finishes.length; index += 1) {
    const finish = finishes[index] ?? "";
    if (
      judged(head + finish + "x" + closer) ||
      judged(head + finish + closer)
    ) {
      return true;
    }
  }
  const tails = ["x" + closer, closer, "\n" + prefix + closer];
  return absorberFinishes(head).some((finish) =>
    tails.some((tail) => judged(head + finish + tail)),
  );
}

/**
 * An element left open when the construct holding it ended (at `end`): the
 * longest prefix the element's closing tag still completes — directly, or
 * after one more character so a line the construct's end hangs on can go
 * on, and on a line that so far spells container syntax alone (a line
 * start, a lone `>`, indentation short of a list item's) also after the
 * rests of the element's container prefix (`prefixRests`): its rest past
 * what the line spells, then each of its suffixes (SPEC 14's location rule
 * for 14.20). The grammar judges every probe, so a wrong candidate only
 * fails to complete. Past a line's container syntax, a prefix ending inside
 * a JSX tag is judged with the tag finished (`finishedTagCompletes`), since
 * the grammar pairs a tag only once it has read it whole: a closing tag
 * that cannot pair — typed in a paragraph, where it closes no flow
 * element, or naming no open element — fails there, unless a code span,
 * link, or definition begun before it may still take it in. Past the
 * container syntax of a line after the construct's end, a probe failing by
 * any other construct's class (an expression, an attribute value's braces
 * among them, that the line leaves open and the closer cannot finish)
 * leaves the pairing unjudged, so it counts only where the line's content
 * begins inside the element's container — where the closer, a paragraph's
 * `x` and the closer, or such a line and the closer on the next line
 * (after the container prefix) completes; content beginning outside it has
 * ended the container with the element open.
 */
function constructEndOffset(
  text: string,
  end: number,
  closer: string,
  prefix: string,
): number {
  const bound = Math.min(text.length, end + PROBE_REACH);
  let judged = -1;
  let inside = false;
  const contentInside = (content: number): boolean => {
    if (judged !== content) {
      const before = text.slice(0, content);
      judged = content;
      inside = [closer, "x" + closer, "x\n" + prefix + closer].some((tail) =>
        completes(before + tail, content),
      );
    }
    return inside;
  };
  for (let at = end + 1; at <= bound; at += 1) {
    const head = text.slice(0, at);
    const lineStart =
      Math.max(head.lastIndexOf("\n"), head.lastIndexOf("\r")) + 1;
    const spelled = head.slice(lineStart);
    const run = CONTAINER_RUN.exec(spelled)?.[0] ?? "";
    let viable: boolean;
    if (run.length === spelled.length) {
      const bare = completion(head + closer, at);
      if (bare === "whole") {
        // The closer closes the element here, and after more spaces and
        // tabs too where the line ends so far with none of a list marker's
        // characters: more indentation keeps a line in its containers.
        if (/(?:^|[ \t>])$/.test(spelled)) {
          while (at < bound && /[ \t]/.test(text.charAt(at))) at += 1;
        }
        continue;
      }
      if (bare !== null) continue;
      const completions = new Set(["x" + closer]);
      for (const rest of prefixRests(prefix, spelled)) {
        completions.add(rest + closer);
        completions.add(rest + "x" + closer);
      }
      completions.delete(closer);
      viable = [...completions].some((tail) => completes(head + tail, at));
    } else {
      const counts = (how: ReturnType<typeof completion>): boolean =>
        how === "whole" ||
        how === "paired" ||
        (how === "class" &&
          (lineStart <= end || contentInside(lineStart + run.length)));
      // A prefix ending inside a tag, which the closer meets as the tag's
      // class, is judged with the tag finished (`finishedTagCompletes`).
      const bare = completion(head + closer, at);
      const reason = bare === "class" ? tagEndingAt(head) : null;
      viable =
        reason !== null
          ? finishedTagCompletes(head, at, reason, closer, prefix)
          : counts(bare) || counts(completion(head + "x" + closer, at));
    }
    if (!viable) {
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
    const inTag = tagEndingAt(head) !== null;
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

/** An element left open when the construct holding it ended. */
interface LeftOpen {
  /** Where the construct ended. */
  readonly end: number;
  /** The element's closing tag. */
  readonly closer: string;
  /** The element's container prefix (`containerPrefix`). */
  readonly prefix: string;
}

/**
 * The element a pairing failure of `text` reports left open when the
 * construct holding it ended — the stock "Expected a closing tag for" with
 * an end; null for any other pairing failure, and for an element open at
 * the end of `text`.
 */
function leftOpen(text: string, failure: MdxFailure): LeftOpen | null {
  if (failure.ruleId !== "end-tag-mismatch") return null;
  const expected = EXPECTED_CLOSING_TAG.exec(String(failure.reason));
  const end = placeEnd(failure);
  if (expected === null || end === undefined) return null;
  return {
    end,
    closer: `</${expected[1]}>`,
    prefix: containerPrefix(text, Number(expected[2]), Number(expected[3])),
  };
}

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
  if (EXPECTED_CLOSING_TAG.test(reason)) {
    const open = leftOpen(text, failure);
    // Open at the end of the file: the whole file is a viable prefix.
    if (open === null) return text.length;
    return constructEndOffset(text, open.end, open.closer, open.prefix);
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
 * it reports before the cut is returned — a tag-pairing failure located by
 * the file's own characters, returned where it lies before `offset`; null
 * when there is none.
 */
function hiddenFailure(text: string, offset: number): number | null {
  let cut = offset;
  for (let backup = 0; backup < LINE_BACKUPS; backup += 1) {
    const prefix = text.slice(0, cut);
    const parsed = analysisParse(prefix);
    if (parsed.failure === null) return null;
    if (parsed.failure.source === "mdast-util-mdx-jsx") {
      // Pairing ran, so nothing before the cut failed to tokenize. An
      // element the prefix leaves open when the construct holding it ends
      // is located by the file's own characters, past the cut too: the
      // line the cut begins may already have ended that construct (SPEC
      // 14's location rule for 14.20). An element open at the prefix's end
      // tells nothing of the file past the cut.
      const open = leftOpen(prefix, parsed.failure);
      if (open === null) {
        const at = pairingOffset(prefix, parsed.failure);
        return at < cut ? at : null;
      }
      const at = constructEndOffset(text, open.end, open.closer, open.prefix);
      return at < offset ? at : null;
    }
    const at = classOffset(prefix, parsed.failure, parsed.calls);
    if (at < cut) return at;
    if (cut === 0) return null;
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
  paragraphsAbove = new Map();
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
  } finally {
    paragraphsAbove = null;
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
