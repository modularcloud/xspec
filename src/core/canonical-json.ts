// The canonical JSON serializer.
//
// IMPLEMENTATION (cross-cutting rules): stored and emitted JSON goes through
// one canonical serializer — sorted keys, stable ordering, trailing newline —
// shared by graph data, sessions, and --json output. SPEC 12.0: all output,
// generated files, and stored data are byte-deterministic for identical
// input.
//
// The serializer is iterative (an explicit stack of frames, one per open
// array or object) and appends pieces to an output buffer, so time and
// memory are linear in the rendered text and no input nesting depth can
// exhaust the call stack. Pretty indentation deepens two spaces per level
// up to a fixed bound and stays at that width below it: the spelling remains
// a deterministic function of the value alone (SPEC 12.0), every document
// nested within the bound renders exactly as unbounded indentation would,
// and a pathologically deep value — thousands of levels — cannot inflate
// the document quadratically with indentation bytes.
//
// The text is produced in consecutive chunks (`canonicalJsonChunks`), and
// an array may be deferred (`JsonDeferredArray`): its elements are produced
// one at a time as the serializer reaches them, so a document too large to
// hold — or to spell as one string, whose length V8 caps near 2^29 — still
// renders, in bounded memory, to exactly the bytes `canonicalJson` gives
// the same value (SPEC 10.7: `review export` presents every item of a
// session, an answer that can outgrow both). Frames walk arrays and
// objects element by element, so a deferred element is produced only once
// everything before it has been rendered. A string value longer than a
// chunk is spelled in pieces (`quotedPieces`), so no value's spelling is
// ever one string either: its escaping can pass the cap where the value
// itself does not.
//
// One layout option serves the stored review session
// (`CanonicalJsonOptions.lineArrays`; src/core/review.ts, "Stored layout";
// SPEC 13.4: durable files "are line-oriented or stably keyed so that
// concurrent additions merge textually"): a named member of the root object
// holding a non-empty array is laid out one element per line — each element
// in `compactJson`'s rendering, so no newline falls inside it, the first
// bare and every later one led by its comma, each followed by an empty line
// — while everything else keeps the pretty layout. Each frame carries its
// own layout, so the serializer stays iterative, and without the option
// every output is byte for byte what it was.

import { compareBytes } from "./bytes.js";
import { STRING_SEGMENT_UNITS, stringSegments } from "./text-chunks.js";

/**
 * A JSON-representable value. Object properties whose value is `undefined`
 * are omitted at serialization (so optional model fields serialize
 * naturally); `undefined` never appears anywhere else.
 */
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: JsonValue | undefined;
}

/**
 * An array rendered element by element, each element produced by
 * `elementAt` only when the serializer reaches it, in index order, and
 * released once rendered — for documents too large to build whole. Its
 * rendering is exactly that of a plain array holding the same elements.
 */
export class JsonDeferredArray {
  constructor(
    readonly length: number,
    readonly elementAt: (index: number) => JsonStreamValue,
  ) {}
}

/** A value the chunked serializer renders: JSON whose arrays may be
 * deferred (`JsonDeferredArray`). Every `JsonValue` is one. */
export type JsonStreamValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonStreamValue[]
  | JsonStreamObject
  | JsonDeferredArray;

export interface JsonStreamObject {
  readonly [key: string]: JsonStreamValue | undefined;
}

/**
 * The bound on indentation depth: nesting levels beyond it keep the
 * bound's indentation width. Deeper than any document the surfaces produce
 * over realistic sources (a `view` node tree reaches it only past ~13
 * levels of section nesting); the bound exists so adversarially deep
 * values (SPEC 12.0 still demands termination with bounded output) render
 * in linear size rather than growing quadratically in indentation bytes.
 */
const MAX_INDENT_LEVELS = 32;

/** Memoized indent strings: INDENTS[k] is min(k, MAX_INDENT_LEVELS) * "  ". */
const INDENTS: string[] = [""];
function indentAt(level: number): string {
  const capped = level < MAX_INDENT_LEVELS ? level : MAX_INDENT_LEVELS;
  for (let next = INDENTS.length; next <= capped; next += 1) {
    INDENTS[next] = INDENTS[next - 1] + "  ";
  }
  return INDENTS[capped];
}

/**
 * The rendered text's chunk size in UTF-16 code units: a chunk is handed
 * out once the pieces gathered reach it, so a chunk exceeds it by at most
 * one piece (a key, a string value, or a separator).
 */
const CHUNK_UNITS = 1 << 20;

/** Layout options of `canonicalJson` (module header). */
export interface CanonicalJsonOptions {
  /**
   * Members of the root object whose array values are laid out one element
   * per line: the opening bracket ends its line; each element stands on a
   * line of its own at the next indentation level, in `compactJson`'s
   * rendering, every element after the first led by its comma, and each
   * followed by an empty line; the closing bracket's line follows the last
   * element's empty line. An empty array stays `[]`. A named member holding
   * anything but an array, and every other array, renders as it would
   * without the option.
   */
  readonly lineArrays?: readonly string[];
}

/**
 * Serializes `value` to canonical JSON text: object keys sorted byte-wise
 * (SPEC 12.0 comparison), array elements in given order, two-space
 * indentation (bounded at MAX_INDENT_LEVELS), and a trailing newline
 * terminating the document — with the root object's members that
 * `options.lineArrays` names laid out one element per line. The output is
 * a deterministic function of `value` and the options alone.
 */
export function canonicalJson(
  value: JsonValue,
  options?: CanonicalJsonOptions,
): string {
  return [...render(value, true, "\n", lineArraysOf(options))].join("");
}

/**
 * `canonicalJson`'s text for `value` under `options` — deferred arrays
 * rendered as the plain arrays they stand for — in consecutive chunks of
 * bounded size (about a mebi code unit each, a long string's spelling
 * split between them), produced as the consumer asks for them:
 * concatenated, the chunks are exactly the canonical text, trailing
 * newline included, and a deferred element is produced only when its
 * chunk is. No chunk ends inside a surrogate pair.
 */
export function canonicalJsonChunks(
  value: JsonStreamValue,
  options?: CanonicalJsonOptions,
): Generator<string, void, undefined> {
  return render(value, true, "\n", lineArraysOf(options));
}

/** The root members `options` lays out one element per line, or null. */
function lineArraysOf(
  options: CanonicalJsonOptions | undefined,
): ReadonlySet<string> | null {
  return options?.lineArrays === undefined || options.lineArrays.length === 0
    ? null
    : new Set(options.lineArrays);
}

/**
 * Serializes `value` to compact canonical JSON: the same deterministic
 * rendering as `canonicalJson` — object keys sorted byte-wise, array elements
 * in given order — but with no whitespace and no trailing newline, so one
 * value occupies exactly one line. This is the line encoding of the
 * line-oriented journal (SPEC 6.1): JSON string escaping keeps every value on
 * a single line whatever characters it contains.
 */
export function compactJson(value: JsonValue): string {
  return [...render(value, false, "", null)].join("");
}

/**
 * The code units `JSON.stringify` may escape in a string: `"`, the
 * backslash, the controls U+0000–U+001F, and the surrogates (a lone one is
 * escaped, a paired one kept — any surrogate defers to `JSON.stringify`
 * here). Built from code points, never spelled as escapes.
 */
const MAY_ESCAPE = new RegExp(
  "[" +
    String.fromCharCode(0x22, 0x5c, 0x5c, 0x00) +
    "-" +
    String.fromCharCode(0x1f, 0xd800) +
    "-" +
    String.fromCharCode(0xdfff) +
    "]",
);

/**
 * A string's JSON spelling — `JSON.stringify`'s, byte for byte. A long
 * string holding nothing it escapes is the string itself between quotes,
 * spelled without its per-character pass: review payloads quote node
 * identities as long as their section nesting is deep (SPEC 10.7), and an
 * export's answer is mostly such identities.
 */
function quoteString(text: string): string {
  return text.length >= 32 && !MAY_ESCAPE.test(text)
    ? `"${text}"`
    : JSON.stringify(text);
}

/**
 * A long string's JSON spelling in consecutive pieces — the opening
 * quote, each segment's escaped body (core/text-chunks.ts
 * `stringSegments`: no segment ends inside a surrogate pair, and every
 * other escape is one code point's, so each segment escapes exactly as
 * its part of the whole does), the closing quote: concatenated, exactly
 * `quoteString`'s spelling of the whole, which can pass V8's cap on a
 * string's length while the value does not (SPEC 12.0, 13.3: graph data
 * holds a long embedding chain's root subtree text, mostly line feeds,
 * each escaped as two code units).
 */
function* quotedPieces(text: string): Generator<string, void, undefined> {
  yield '"';
  for (const segment of stringSegments(text)) {
    yield quoteString(segment).slice(1, -1);
  }
  yield '"';
}

/** The rendering of a primitive value, or null for arrays and objects. */
function renderPrimitive(value: JsonStreamValue): string | null {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`non-finite number in canonical JSON: ${value}`);
    }
    // Number-to-string conversion is fully specified by ECMAScript (shortest
    // round-trip form), so this is byte-deterministic across platforms.
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    // JSON.stringify string quoting is fully specified by ECMAScript.
    return quoteString(value);
  }
  return null;
}

/**
 * One open container: an array (plain or deferred) or an object with its
 * keys — sorted byte-wise, those holding `undefined` left out — the index
 * of the next element or member to render, and its layout: pretty or
 * compact, and for an array whether it takes the one-element-per-line
 * layout (`CanonicalJsonOptions.lineArrays`), its elements then compact.
 */
type Frame =
  | {
      readonly kind: "array";
      readonly array: readonly JsonStreamValue[] | JsonDeferredArray;
      readonly level: number;
      readonly pretty: boolean;
      readonly lines: boolean;
      next: number;
    }
  | {
      readonly kind: "object";
      readonly object: JsonStreamObject;
      readonly keys: readonly string[];
      readonly level: number;
      readonly pretty: boolean;
      next: number;
    };

/** A value to render next: its level and the layout it renders in
 * (`Frame`). */
interface Pending {
  readonly value: JsonStreamValue;
  readonly level: number;
  readonly pretty: boolean;
  readonly lines: boolean;
}

/**
 * What follows each element in the one-element-per-line layout
 * (`CanonicalJsonOptions.lineArrays`): the end of the element's line and
 * the empty line after it.
 */
const LINE_ELEMENT_END = "\n\n";

function* render(
  root: JsonStreamValue,
  pretty: boolean,
  trailer: string,
  lineArrays: ReadonlySet<string> | null,
): Generator<string, void, undefined> {
  const out: string[] = [];
  let gathered = 0;
  const frames: Frame[] = [];
  // The value to render next; null once a container's frame must be
  // consulted for the next one.
  let pending: Pending | null = { value: root, level: 0, pretty, lines: false };
  for (;;) {
    if (gathered >= CHUNK_UNITS) {
      yield out.join("");
      out.length = 0;
      gathered = 0;
    }
    if (pending !== null) {
      const next = pending;
      pending = null;
      if (
        typeof next.value === "string" &&
        next.value.length > STRING_SEGMENT_UNITS
      ) {
        // A long string value, spelled in pieces (`quotedPieces`) and
        // handed out as the chunk fills: its spelling is never one string.
        for (const piece of quotedPieces(next.value)) {
          if (gathered >= CHUNK_UNITS) {
            yield out.join("");
            out.length = 0;
            gathered = 0;
          }
          out.push(piece);
          gathered += piece.length;
        }
        continue;
      }
      const piece = openValue(next, frames);
      out.push(piece);
      gathered += piece.length;
      continue;
    }
    const frame = frames[frames.length - 1];
    if (frame === undefined) {
      break;
    }
    const count =
      frame.kind === "array" ? frame.array.length : frame.keys.length;
    if (frame.next >= count) {
      frames.pop();
      const closer = frame.kind === "array" ? "]" : "}";
      const piece =
        frame.kind === "array" && frame.lines
          ? LINE_ELEMENT_END + indentAt(frame.level) + closer
          : frame.pretty
            ? "\n" + indentAt(frame.level) + closer
            : closer;
      out.push(piece);
      gathered += piece.length;
      continue;
    }
    const index = frame.next;
    frame.next += 1;
    const inner = frame.level + 1;
    let piece: string;
    if (frame.kind === "array") {
      const array = frame.array;
      const element =
        array instanceof JsonDeferredArray
          ? array.elementAt(index)
          : array[index];
      if (element === undefined) {
        throw new TypeError("undefined array element in canonical JSON");
      }
      if (frame.lines) {
        // One element per line, compact: the first bare, every later one
        // led by its comma after the previous element's line and the empty
        // line following it.
        piece =
          index > 0
            ? LINE_ELEMENT_END + indentAt(inner) + ","
            : indentAt(inner);
        pending = { value: element, level: inner, pretty: false, lines: false };
      } else {
        piece = index > 0 ? (frame.pretty ? ",\n" : ",") : "";
        if (frame.pretty) piece += indentAt(inner);
        pending = {
          value: element,
          level: inner,
          pretty: frame.pretty,
          lines: false,
        };
      }
    } else {
      const key = frame.keys[index];
      piece = index > 0 ? (frame.pretty ? ",\n" : ",") : "";
      piece += frame.pretty
        ? indentAt(inner) + quoteString(key) + ": "
        : quoteString(key) + ":";
      pending = {
        value: frame.object[key] as JsonStreamValue,
        level: inner,
        pretty: frame.pretty,
        // A member of the root object that `lineArrays` names.
        lines:
          frame.level === 0 &&
          frame.pretty &&
          lineArrays !== null &&
          lineArrays.has(key),
      };
    }
    out.push(piece);
    gathered += piece.length;
  }
  out.push(trailer);
  yield out.join("");
}

/**
 * The opening text of one value: a primitive's whole rendering, an empty
 * container's (`[]`, `{}`), or a non-empty container's opener — its frame
 * then pushed, in the value's layout, for the elements or members to
 * follow.
 */
function openValue(pending: Pending, frames: Frame[]): string {
  const { value, level, pretty, lines } = pending;
  const primitive = renderPrimitive(value);
  if (primitive !== null) {
    return primitive;
  }
  // renderPrimitive returned null, so `value` is an array or an object.
  const composite = value as
    readonly JsonStreamValue[] | JsonDeferredArray | JsonStreamObject;
  if (composite instanceof JsonDeferredArray || isJsonArray(composite)) {
    if (composite.length === 0) {
      return "[]";
    }
    if (!(composite instanceof JsonDeferredArray)) {
      for (const element of composite) {
        if (element === undefined) {
          throw new TypeError("undefined array element in canonical JSON");
        }
      }
    }
    frames.push({
      kind: "array",
      array: composite,
      level,
      pretty,
      lines,
      next: 0,
    });
    return pretty ? "[\n" : "[";
  }
  const object: JsonStreamObject = composite;
  const keys: string[] = [];
  for (const key of Object.keys(object).sort(compareBytes)) {
    if (object[key] !== undefined) {
      keys.push(key);
    }
  }
  if (keys.length === 0) {
    return "{}";
  }
  frames.push({ kind: "object", object, keys, level, pretty, next: 0 });
  return pretty ? "{\n" : "{";
}

function isJsonArray(
  value: readonly JsonStreamValue[] | JsonStreamObject,
): value is readonly JsonStreamValue[] {
  return Array.isArray(value);
}
