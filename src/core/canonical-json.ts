// The canonical JSON serializer.
//
// IMPLEMENTATION (cross-cutting rules): stored and emitted JSON goes through
// one canonical serializer — sorted keys, stable ordering, trailing newline —
// shared by graph data, sessions, and --json output. SPEC 12.0: all output,
// generated files, and stored data are byte-deterministic for identical
// input.
//
// The serializer is iterative (an explicit work stack) and appends chunks to
// one output buffer, so time and memory are linear in the rendered text and
// no input nesting depth can exhaust the call stack. Pretty indentation
// deepens two spaces per level up to a fixed bound and stays at that width
// below it: the spelling remains a deterministic function of the value alone
// (SPEC 12.0), every document nested within the bound renders exactly as
// unbounded indentation would, and a pathologically deep value — thousands
// of levels — cannot inflate the document quadratically with indentation
// bytes.

import { compareBytes } from "./bytes.js";

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
 * Serializes `value` to canonical JSON text: object keys sorted byte-wise
 * (SPEC 12.0 comparison), array elements in given order, two-space
 * indentation (bounded at MAX_INDENT_LEVELS), and a trailing newline
 * terminating the document. The output is a deterministic function of
 * `value` alone.
 */
export function canonicalJson(value: JsonValue): string {
  return render(value, true) + "\n";
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
  return render(value, false);
}

/** The rendering of a primitive value, or null for arrays and objects. */
function renderPrimitive(value: JsonValue): string | null {
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
    return JSON.stringify(value);
  }
  return null;
}

/**
 * One pending unit of rendering work: a value to open (with, for pretty
 * object entries, its `"key": ` prefix already emitted by the parent), or a
 * literal chunk (separators, closers) to append verbatim.
 */
type WorkItem =
  | {
      readonly kind: "value";
      readonly value: JsonValue;
      readonly level: number;
    }
  | { readonly kind: "chunk"; readonly text: string };

function render(root: JsonValue, pretty: boolean): string {
  const out: string[] = [];
  // A LIFO work stack: items are pushed in reverse so they emit in order.
  const stack: WorkItem[] = [{ kind: "value", value: root, level: 0 }];
  while (stack.length > 0) {
    const item = stack.pop() as WorkItem;
    if (item.kind === "chunk") {
      out.push(item.text);
      continue;
    }
    const { value, level } = item;
    const primitive = renderPrimitive(value);
    if (primitive !== null) {
      out.push(primitive);
      continue;
    }
    // renderPrimitive returned null, so `value` is an array or an object.
    const composite = value as readonly JsonValue[] | JsonObject;
    const inner = level + 1;
    if (isJsonArray(composite)) {
      if (composite.length === 0) {
        out.push("[]");
        continue;
      }
      for (const element of composite) {
        if (element === undefined) {
          throw new TypeError("undefined array element in canonical JSON");
        }
      }
      out.push(pretty ? "[\n" : "[");
      const closer = pretty ? "\n" + indentAt(level) + "]" : "]";
      stack.push({ kind: "chunk", text: closer });
      for (let index = composite.length - 1; index >= 0; index -= 1) {
        if (index < composite.length - 1) {
          stack.push({ kind: "chunk", text: pretty ? ",\n" : "," });
        }
        stack.push({
          kind: "value",
          value: composite[index] as JsonValue,
          level: inner,
        });
        if (pretty) {
          stack.push({ kind: "chunk", text: indentAt(inner) });
        }
      }
      continue;
    }
    const object: JsonObject = composite;
    const keys: string[] = [];
    for (const key of Object.keys(object).sort(compareBytes)) {
      if (object[key] !== undefined) {
        keys.push(key);
      }
    }
    if (keys.length === 0) {
      out.push("{}");
      continue;
    }
    out.push(pretty ? "{\n" : "{");
    const closer = pretty ? "\n" + indentAt(level) + "}" : "}";
    stack.push({ kind: "chunk", text: closer });
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (index < keys.length - 1) {
        stack.push({ kind: "chunk", text: pretty ? ",\n" : "," });
      }
      stack.push({
        kind: "value",
        value: object[key] as JsonValue,
        level: inner,
      });
      const prefix = pretty
        ? indentAt(inner) + JSON.stringify(key) + ": "
        : JSON.stringify(key) + ":";
      stack.push({ kind: "chunk", text: prefix });
    }
  }
  return out.join("");
}

function isJsonArray(
  value: readonly JsonValue[] | JsonObject,
): value is readonly JsonValue[] {
  return Array.isArray(value);
}
