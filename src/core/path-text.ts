// Path values with and without a plain string form (SPEC 12.0, 12.7, 14.19).
//
// SPEC 12.0: a workspace-relative path that is not valid UTF-8 (14.19) has
// no plain string form — wherever an output carries one, it is presented in
// an explicitly marked byte form that carries the path's exact bytes and is
// distinguishable from every plain path string, deterministically; a
// valid-UTF-8 path is never presented in the marked form. SPEC 12.7 fixes
// the JSON value form: a path is a string where its bytes are valid UTF-8,
// and otherwise `{"bytes": "…"}` — the path's exact bytes as lowercase
// hexadecimal, two digits per byte — an object, equal to no path string.
//
// This module is the one internal representation and the one shared
// path-value renderer (IMPLEMENTATION cross-cutting rules: findings and
// reports are built as data and rendered once per output form). Every
// output-facing path is a `PathText`; every JSON output renders it through
// `pathTextJson`, every human output through `renderPathText`, and every
// path comparison in output ordering goes through `comparePathTexts` —
// byte-wise, one order over both presentation forms (SPEC 12.0, 12.7).

import { compareBytes } from "./bytes.js";
import type { JsonValue } from "./canonical-json.js";

const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });
const utf8Encoder = new TextEncoder();

/**
 * A path with no plain string form: its exact bytes (SPEC 12.0, 14.19).
 * Constructed only by `pathTextOf`, which guarantees the bytes are NOT
 * valid UTF-8 — so rendering a `PathBytes` in the marked byte form never
 * presents a valid-UTF-8 path that way (SPEC 12.7).
 */
export interface PathBytes {
  readonly kind: "path-bytes";
  /** The path's exact bytes. Treated as immutable. */
  readonly bytes: Uint8Array;
}

/**
 * A path as data — workspace-relative, or in the anchoring form of 11.6:
 * its string spelling where its bytes are valid UTF-8 (the common case, so
 * plain strings remain paths everywhere), and otherwise its exact bytes.
 * Valid discovered source paths are always plain strings (SPEC 7 → 14.19);
 * only the paths of files 14.19 rejects, reachable in outputs through
 * findings and the surfaces of 11.3–11.6, take the `PathBytes` arm.
 */
export type PathText = string | PathBytes;

/**
 * The `PathText` of a byte path: the decoded string exactly when the bytes
 * are valid UTF-8, otherwise the exact bytes (copied — the result never
 * aliases the caller's buffer). The single constructor of `PathBytes`
 * values, keeping the marked-form invariant by construction (SPEC 12.7: a
 * valid-UTF-8 path is never presented in the marked form).
 */
export function pathTextOf(bytes: Uint8Array): PathText {
  try {
    return strictUtf8Decoder.decode(bytes);
  } catch {
    return { kind: "path-bytes", bytes: bytes.slice() };
  }
}

/** Whether a `PathText` is the byte arm (no plain string form). */
export function isPathBytes(path: PathText): path is PathBytes {
  return typeof path !== "string";
}

/** The exact bytes a `PathText` denotes (paths compare byte-wise, 12.0). */
export function pathTextBytes(path: PathText): Uint8Array {
  return typeof path === "string" ? utf8Encoder.encode(path) : path.bytes;
}

/**
 * An injective string key for a path's exact bytes (one UTF-16 code unit
 * per byte), for exact byte-path map and set membership across both
 * `PathText` forms (SPEC 12.0: every path comparison is byte-wise). Keys
 * of byte sequences 0x00–0xFF compare by `compareBytes` in byte order.
 * Never rendered anywhere.
 */
export function pathTextKey(path: PathText): string {
  const bytes = pathTextBytes(path);
  let key = "";
  for (let index = 0; index < bytes.length; index += 1) {
    key += String.fromCharCode(bytes[index]);
  }
  return key;
}

/** Three-way lexicographic comparison of two byte arrays. */
function compareByteArrays(a: Uint8Array, b: Uint8Array): -1 | 0 | 1 {
  const shorter = Math.min(a.length, b.length);
  for (let index = 0; index < shorter; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

/**
 * SPEC 12.0/12.7: paths compare byte-wise whatever their presentation form
 * — a marked byte-form path and a plain string sort in one byte order.
 * Equivalent to lexicographic comparison of `pathTextBytes` on both sides;
 * the all-strings case runs on `compareBytes` without materializing bytes.
 */
export function comparePathTexts(a: PathText, b: PathText): -1 | 0 | 1 {
  if (typeof a === "string" && typeof b === "string") {
    return compareBytes(a, b);
  }
  return compareByteArrays(pathTextBytes(a), pathTextBytes(b));
}

/** The path's exact bytes as lowercase hexadecimal, two digits per byte. */
function lowercaseHex(bytes: Uint8Array): string {
  let hex = "";
  for (let index = 0; index < bytes.length; index += 1) {
    hex += bytes[index].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * The one shared JSON path-value renderer (SPEC 12.7): a plain JSON string
 * for a valid-UTF-8 path, and for a path with no plain string form the
 * marked byte form `{"bytes": "…"}` — its exact bytes as lowercase
 * hexadecimal, two digits per byte.
 */
export function pathTextJson(path: PathText): JsonValue {
  return typeof path === "string" ? path : { bytes: lowercaseHex(path.bytes) };
}

/**
 * The deterministic human spelling of a path value (SPEC 12.0: outputs are
 * byte-deterministic; 14: human and JSON reports carry the same
 * information): the path string itself, or — for a path with no plain
 * string form — an explicitly marked spelling of its exact bytes,
 * `<bytes HEX>`, distinguishable from every plain workspace-relative path
 * (which never contains `<` at a spelling boundary the renderer produces
 * and is never spelled this way by xspec). SPEC.md fixes no human spelling
 * for such paths; the hex form is chosen because it is injective and
 * mirrors the JSON marked byte form's information exactly.
 */
export function renderPathText(path: PathText): string {
  return typeof path === "string"
    ? path
    : `<bytes ${lowercaseHex(path.bytes)}>`;
}
