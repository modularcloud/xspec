// The identifier reader for an operation's fresh identifiers (SPEC 6.5, 1.4,
// 14.20; TEST-SPEC T1.4-5, T6.4-2, T6.5-8): an identifier read exactly as
// TypeScript 5.9.3 at the language level ESNext judges one. Harness
// machinery only: no product imports, no I/O, no test-framework dependence;
// its self-test is test/self/added-import-identifiers.test.ts.
//
// Why a shared reader. SPEC 6.5 restricts an added import's fresh
// identifiers only by its barred lists and its freshness clauses, and SPEC
// 1.4 judges identifier characters alone, at the release and language level
// 14.20 fixes (TypeScript 5.9.3, ESNext; TEST-SPEC T6.4-2, T1.4-5(c)): a
// non-ASCII letter (U+00E9) or U+2EBF0 is as conforming a choice as `a`.
// Where an arm composes the bytes around the fresh identifier — value-blind
// in it (T1.4-5(b)/(c), T6.5-8, T6.5-10, T6.5-11, T6.5-13, T6.5-14, and the
// arms run under the same discipline) — the harness reads the product's
// choice off the rewritten bytes and composes the expectation around it, so
// a reader narrower than the judge (ASCII alone) fails a conforming product.
//
// The judge: code point by code point — an astral code point (U+2EBF0) is
// one character, never two surrogates — the first through
// `ts.isIdentifierStart`, every other through `ts.isIdentifierPart`, both at
// `ts.ScriptTarget.ESNext`, of the harness's own `typescript-5.9.3`. Never a
// Unicode property class (`\p{ID_Start}`): the runtime's tables postdate
// 5.9.3's (U+1C89, a Unicode 16 letter, begins an identifier there and
// stands nowhere in one under 5.9.3; T6.4-2). helpers/mdx-derivability.ts
// takes S-9's identifier characters from the same two predicates (Unicode
// 15.1's identifier characters are 5.9.3's ESNext tables).
//
// Shapes. A site locating the identifier among pinned bytes either
//   * scans: `readTsIdentifierAt` reads the identifier beginning at an
//     offset, `readTsIdentifierEndingAt` the one ending at an offset; or
//   * matches: its regular expression captures a permissive run
//     (`IDENTIFIER_RUN_SOURCE`: every code point but ASCII's non-identifier
//     ones, so the capture holds any identifier whole and stops at the first
//     ASCII delimiter after it) and the judge decides the run
//     (`freshIdentifierProblem`; `expectFreshIdentifier` in
//     helpers/import-insertion.ts fails diagnosed). A guard a lookbehind or
//     lookahead spells — no identifier part beside the run — is
//     `NO_RUN_BEFORE_SOURCE` / `NO_RUN_AFTER_SOURCE`, which exclude every
//     code point the run class admits, a superset of every identifier part
//     under the judge: never ASCII's alone, so `<U+00E9>a.y` reads `<U+00E9>a`
//     and never `a`. The run then holds the identifier and whatever
//     non-ASCII code points abut it, so it equals the identifier exactly
//     where the bytes beside it are ASCII, as a pinned staging's are; a site
//     whose identifier may abut a non-ASCII code point scans instead.
// A run that reads as no identifier fails diagnosed (H-8), naming the run,
// its offending code point, and SPEC 6.5 and 1.4.

import ts from "typescript-5.9.3";

const ESNEXT = ts.ScriptTarget.ESNext;

/** Whether `code` begins an identifier under TypeScript 5.9.3 at ESNext:
 * ECMAScript's IdentifierStartChar under Unicode 15.1 — ID_Start, `$`, and
 * `_` — 5.9.3's ESNext table, 15.1's code point for code point. */
export function isTsIdentifierStart(code: number): boolean {
  return ts.isIdentifierStart(code, ESNEXT);
}

/** Whether `code` continues an identifier under TypeScript 5.9.3 at
 * ESNext: IdentifierPartChar under Unicode 15.1 — ID_Continue (U+200C and
 * U+200D among it since 15.1) and `$`. */
export function isTsIdentifierPart(code: number): boolean {
  return ts.isIdentifierPart(code, ESNEXT);
}

function codePointLength(code: number): number {
  return code > 0xffff ? 2 : 1;
}

function codePointName(code: number): string {
  return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

/** The code point ending at UTF-16 offset `end` (a surrogate pair read
 * whole), or undefined at the text's start. */
function codePointEndingAt(text: string, end: number): number | undefined {
  if (end <= 0 || end > text.length) return undefined;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xdc00 && last <= 0xdfff && end >= 2) {
    const before = text.charCodeAt(end - 2);
    if (before >= 0xd800 && before <= 0xdbff) {
      return text.codePointAt(end - 2);
    }
  }
  return last;
}

/**
 * Why `run` is no identifier under TypeScript 5.9.3 at ESNext — empty, a
 * first code point beginning none, or a later one continuing none — or
 * undefined when it is exactly one identifier.
 */
export function tsIdentifierProblem(run: string): string | undefined {
  if (run === "") return "it is empty";
  let index = 0;
  let ordinal = 1;
  while (index < run.length) {
    const code = run.codePointAt(index) as number;
    if (index === 0 && !isTsIdentifierStart(code)) {
      return `${codePointName(code)}, its first code point, cannot begin one`;
    }
    if (index > 0 && !isTsIdentifierPart(code)) {
      return (
        `${codePointName(code)}, its code point ${String(ordinal)}, cannot ` +
        `continue one`
      );
    }
    index += codePointLength(code);
    ordinal += 1;
  }
  return undefined;
}

/** Whether `run` is exactly one identifier under TypeScript 5.9.3 at
 * ESNext. */
export function isTsIdentifier(run: string): boolean {
  return tsIdentifierProblem(run) === undefined;
}

/** `run` shown for a diagnosis: JSON-quoted, its code points named when it
 * holds any beyond printable ASCII. */
export function describeRun(run: string): string {
  const shown = JSON.stringify(run);
  const codes = Array.from(run, (char) => char.codePointAt(0) as number);
  if (codes.every((code) => code >= 0x20 && code <= 0x7e)) return shown;
  return `${shown} (${codes.map(codePointName).join(" ")})`;
}

/**
 * The diagnosis for a run read where a fresh identifier stands that is no
 * identifier — naming the run, its offending code point, and SPEC 6.5 and
 * 1.4 — or undefined when the run is exactly one identifier under
 * TypeScript 5.9.3 at ESNext.
 */
export function freshIdentifierProblem(run: string): string | undefined {
  const why = tsIdentifierProblem(run);
  if (why === undefined) return undefined;
  return (
    `where the fresh identifier stands, the run ${describeRun(run)} reads ` +
    `as no identifier under TypeScript 5.9.3 at ESNext (${why}) — an ` +
    `added import binds fresh identifiers, each a valid TypeScript ` +
    `identifier judged by its characters alone at the release and ` +
    `language level 14.20 fixes (SPEC 6.5, 1.4, 14.20)`
  );
}

/**
 * The identifier beginning at UTF-16 offset `index` — an identifier start,
 * then every identifier part after it, read code point by code point — or
 * undefined when no identifier begins there. Whether `index` is a token
 * boundary (no identifier part before it) is the caller's to judge.
 */
export function readTsIdentifierAt(
  text: string,
  index: number,
): string | undefined {
  const first = text.codePointAt(index);
  if (first === undefined || !isTsIdentifierStart(first)) return undefined;
  let end = index + codePointLength(first);
  for (;;) {
    const code = text.codePointAt(end);
    if (code === undefined || !isTsIdentifierPart(code)) break;
    end += codePointLength(code);
  }
  return text.slice(index, end);
}

/**
 * The identifier ending at UTF-16 offset `end`: the longest run of
 * identifier parts ending there, read code point by code point backwards,
 * when its first code point begins an identifier; otherwise undefined (no
 * part ends there, or the run opens with a part beginning none, a digit
 * say). Whether `end` is a token boundary is the caller's to judge.
 */
export function readTsIdentifierEndingAt(
  text: string,
  end: number,
): string | undefined {
  let start = end;
  for (;;) {
    const code = codePointEndingAt(text, start);
    if (code === undefined || !isTsIdentifierPart(code)) break;
    start -= codePointLength(code);
  }
  const first = text.codePointAt(start);
  if (start === end || first === undefined || !isTsIdentifierStart(first)) {
    return undefined;
  }
  return text.slice(start, end);
}

/** Whether UTF-16 code unit `unit` may stand in a permissive run: any
 * non-ASCII unit (surrogates included), or an ASCII identifier part. */
function inRun(unit: number): boolean {
  return unit >= 0x80 || isTsIdentifierPart(unit);
}

/**
 * The permissive run beginning at UTF-16 offset `index` — the code units up
 * to the first ASCII one that is no identifier part — for a site that
 * captures before it judges (`freshIdentifierProblem`). Empty when an ASCII
 * delimiter, or the text's end, stands at `index`.
 */
export function identifierRunAt(text: string, index: number): string {
  let end = index;
  while (end < text.length && inRun(text.charCodeAt(end))) end += 1;
  return text.slice(index, end);
}

/** ASCII's code points that are no identifier part under the judge, as a
 * regular-expression class body of `\xHH` escapes — derived from the judge
 * itself, so `$`, the digits, the letters, and `_` alone stay out. */
const ASCII_NON_PARTS: string = (() => {
  let body = "";
  for (let code = 0; code < 0x80; code++) {
    if (!isTsIdentifierPart(code)) {
      body += `\\x${code.toString(16).padStart(2, "0")}`;
    }
  }
  return body;
})();

/**
 * A regular-expression source matching one permissive run: one or more code
 * points (code units, without the `u` flag), none an ASCII code point that
 * is no identifier part. A capture of it holds any identifier whole; the
 * judge (`freshIdentifierProblem`) decides it.
 */
export const IDENTIFIER_RUN_SOURCE = `[^${ASCII_NON_PARTS}]+`;

/** A lookbehind source: no permissive-run code point — so no identifier
 * part under the judge, whatever its plane — stands before this position. */
export const NO_RUN_BEFORE_SOURCE = `(?<![^${ASCII_NON_PARTS}])`;

/** A lookahead source: no permissive-run code point — so no identifier part
 * under the judge — stands after this position. */
export const NO_RUN_AFTER_SOURCE = `(?![^${ASCII_NON_PARTS}])`;
