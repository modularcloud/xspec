// TEST-SPEC §16 P-19 (configuration import spellings).
//
// One registered product-facing property test (C-2 "one code path") over
// SPEC 7's reading of the configuration's import: its module specifier is
// any static string literal (2.4) — either quote style, escape sequences,
// line continuations, and U+FFFD included — read as spelled and never
// interpreted, resolved, or loaded, so that validity and everything xspec
// derives from the configuration are independent of the specifier's
// spelling wherever the file stays well-formed (14.20). T7-9(a)'s fixed
// spellings anchor the property; this module searches the spellings they
// never stage. A seeded, reproducible generator (helpers/property.ts, H-10;
// the fixed seed set in CI, E-5) draws, per trial, one specifier spelling:
//
//   * its quote style, double or single;
//   * its text's shape — a bare name, a scoped name, a relative path, an
//     absolute path, a URL, or the empty string (P19_SHAPE_TEXTS);
//   * each character of that text spelled raw or as an escape sequence
//     encoding it — the hexadecimal escape, the Unicode escape in its
//     four-digit form and in its braced form (code points at or below
//     U+FFFF, leading zeros included), or a backslash before a non-escape
//     character (`spellTextCharacter`);
//   * pieces inserted between those characters (`genInserted`): line
//     continuations, each line terminator after the backslash (LF, CR,
//     CR LF, U+2028, U+2029); the single-character escapes; the NUL escape,
//     never before a decimal digit; escape sequences of other code points
//     (surrogates, and braced ones above U+FFFF); backslashes before other
//     non-escape characters; a raw U+FFFD and other raw non-ASCII code
//     points; the other quote character, raw; and an escaped backslash
//     before the ordinary characters of an escape's spelling (`u{41}`,
//     which begins no braced escape: the backslash before it is escaped).
//
// Every spelling is one static string literal TypeScript 5.9.3's scanner
// accepts: every backslash drawn begins a complete escape sequence, and no
// raw line feed or carriage return stands in the literal. Each draw is
// checked well-formed before the product is driven on it (S-9, §16's
// preamble: `drawSources`, the configuration judged both as module code and
// as script code), a failing draw a harness error with its seed (H-10). The
// spelling reaches the file exactly as drawn: the literal is concatenated
// into the configuration's text by the shared builder
// (helpers/config-import.ts `configImportText`), never printed, decoded, or
// re-quoted, every backslash built from code point U+005C — CONF-IMPORT's
// two staging hazards (CERTIFICATIONS.md).
//
// Each draw runs over T7-9's workspace (helpers/config-import.ts: one spec
// group `main` globbing `specs/*.mdx` over `specs/A.mdx` and `specs/B.mdx`,
// Markdown emitted next to sources, no code group, `coverage`, `policy`,
// git, or `node_modules`, so that no group discovers the configuration
// file), fresh for each draw (H-1), its configuration differing from its
// twin's in the specifier alone. The twin imports from `"xspec"`; it runs
// once, in a fresh workspace of its own, before any draw (twins are no
// draws), and holds the outcome such a workspace gives (H-5): `build` and
// `check` exit 0 finding-free, `ids` and `inventory` exit 0 with one JSON
// document each. Each draw then runs `build`, `check`, `ids`, and
// `inventory`, each under `--json`, in that order, and loads and answers as
// its twin does, under T7-9's assertions (T7-9's opening and (a)):
//
//   * each command's exit code and standard output equal to the twin's —
//     `inventory`'s `configuration` byte-identical among them;
//   * the generated modules and emitted Markdown byte-identical — every
//     file outside `.xspec/` but the configuration file, compared once the
//     four commands have run; graph data, whose opaque content a differing
//     configuration file may change, not compared (as in T7-8), and the lock
//     path with it (H-6).
//
// So P-19 fails a product that refuses a specifier for its spelling — one
// whose spelling is not its value (an escape, a line continuation), one in
// single quotes, or one holding U+FFFD — or for what it designates.
//
// Certification: §CONF-IMPORT (P-19 in scope) and its two violators,
// VIOL-IMPORT-BRACED (refusing the braced Unicode escape of a code point at
// or below U+FFFF) and VIOL-IMPORT-SINGLE (refusing a single-quoted
// specifier), each failing P-19 at the fixed seeds, whose draws reach both
// classes as spelled (CERTIFICATIONS.md's criterion (a) reachability case;
// test/self/p19-fixed-seed-draws.test.ts pins it, with the rest of P-19's
// search space and the staged bytes of every fixed-seed draw).

import { Buffer } from "node:buffer";
import { decodeFindingsReport } from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import {
  BACKSLASH,
  CONFIG_IMPORT_CONFIG_PATH,
  CONFIG_IMPORT_SOURCES,
  CONFIG_IMPORT_TWIN_CONFIG,
  CONFIG_IMPORT_TWIN_LITERAL,
  configImportText,
} from "../../helpers/config-import.js";
import type { Choices, DrawSource, Gen } from "../../helpers/property.js";
import { checkProperty } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type {
  DirectorySnapshot,
  SnapshotOptions,
} from "../../helpers/snapshot.js";
import {
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { assertSameJson } from "./support.js";

/**
 * Trials per fixed seed (E-5): the default three seeds, each draw a fresh
 * workspace and four invocations. test/self/p19-fixed-seed-draws.test.ts
 * replays exactly these.
 */
export const P19_RUNS_PER_SEED = 16;

/** Shrink budget, in draws (helpers/property.ts): each costs a full draw. */
const P19_MAX_SHRINK_EXECUTIONS = 24;

// ---------------------------------------------------------------------------
// Code points and spellings

const cp = (...codes: number[]): string => String.fromCodePoint(...codes);

const DOUBLE_QUOTE = '"';
const SINGLE_QUOTE = "'";
const LINE_FEED = cp(0x0a);
const CARRIAGE_RETURN = cp(0x0d);
const LINE_SEPARATOR = cp(0x2028);
const PARAGRAPH_SEPARATOR = cp(0x2029);
const REPLACEMENT = cp(0xfffd);

/** The literal's delimiters. */
export type P19Quote = "double" | "single";

/** The quote character delimiting a literal of `quote` style. */
export function quoteCharacter(quote: P19Quote): string {
  return quote === "double" ? DOUBLE_QUOTE : SINGLE_QUOTE;
}

/** The quote character a literal of `quote` style holds raw. */
function otherQuoteCharacter(quote: P19Quote): string {
  return quote === "double" ? SINGLE_QUOTE : DOUBLE_QUOTE;
}

/**
 * The shapes of the specifier's text (TEST-SPEC P-19), simplest first: the
 * shrinker moves toward the first.
 */
export type P19Shape =
  "bare" | "scoped" | "relative" | "absolute" | "url" | "empty";

export const P19_SHAPES: readonly P19Shape[] = [
  "bare",
  "scoped",
  "relative",
  "absolute",
  "url",
  "empty",
];

const SHAPE_WEIGHTS: ReadonlyArray<readonly [number, P19Shape]> = [
  [3, "bare"],
  [2, "scoped"],
  [3, "relative"],
  [2, "absolute"],
  [2, "url"],
  [2, "empty"],
];

/**
 * Each shape's texts, plain ASCII with no backslash, quote, or line
 * terminator (checked at module load): the bare names T7-9(a) stages and
 * others, scoped names (the product's own package name among them),
 * relative paths (the configuration file itself and a directory among
 * them), absolute paths, URLs of several schemes, and the empty string. No
 * text is read, resolved, or loaded by a conforming product; none names a
 * system file's content.
 */
export const P19_SHAPE_TEXTS: Readonly<Record<P19Shape, readonly string[]>> = {
  bare: ["xspec", "XSPEC", "left-pad", "lodash.merge", "define_config"],
  scoped: ["@acme/config", "@modularcloud/xspec", "@a/b"],
  relative: [
    "./lib/define.js",
    "../define.mjs",
    "./nowhere.js",
    "./xspec.config.ts",
    "./specs",
  ],
  absolute: ["/opt/define.mjs", "/nonexistent/define.js", "/"],
  url: [
    "https://example.com/define.js",
    "file:///opt/define.mjs",
    "node:module",
    "http://127.0.0.1:9/define.js",
  ],
  empty: [""],
};

/** How a piece of the literal's body is spelled. */
export type P19Form =
  | "raw"
  | "hex"
  | "unicode4"
  | "braced"
  | "identity"
  | "single"
  | "nul"
  | "continuation"
  | "replacement"
  | "non-ascii"
  | "other-quote"
  | "escaped-backslash";

/** One piece of the literal's body, exactly as staged. */
export interface P19Piece {
  readonly form: P19Form;
  /** The characters staged, every backslash among them. */
  readonly spelling: string;
}

/** One P-19 draw: the specifier's spelling, piece by piece. */
export interface P19Draw {
  readonly quote: P19Quote;
  readonly shape: P19Shape;
  /** The shape's text the pieces spell, inserted pieces aside. */
  readonly text: string;
  /** The literal's body, in order: the delimiters are `quote`'s. */
  readonly pieces: readonly P19Piece[];
}

/** The draw's specifier exactly as the configuration holds it, quotes included. */
export function spellP19Literal(draw: P19Draw): string {
  const quote = quoteCharacter(draw.quote);
  return quote + draw.pieces.map((piece) => piece.spelling).join("") + quote;
}

const HEX_UPPER = "0123456789ABCDEF";
const HEX_LOWER = "0123456789abcdef";

/** `code` in hexadecimal, at least `width` digits, in the case drawn. */
function hexDigits(code: number, width: number, upper: boolean): string {
  const digits = upper ? HEX_UPPER : HEX_LOWER;
  let out = "";
  let rest = code;
  do {
    out = digits[rest % 16]! + out;
    rest = Math.floor(rest / 16);
  } while (rest > 0);
  return out.padStart(width, "0");
}

/** The hexadecimal escape: backslash, `x`, two hex digits (code <= 0xFF). */
export function hexEscape(code: number, upper: boolean): string {
  if (code > 0xff)
    throw new Error(`P-19: no hexadecimal escape of ${String(code)}`);
  return `${BACKSLASH}x${hexDigits(code, 2, upper)}`;
}

/** The four-digit Unicode escape: backslash, `u`, four hex digits. */
export function unicode4Escape(code: number, upper: boolean): string {
  if (code > 0xffff)
    throw new Error(`P-19: no four-digit escape of ${String(code)}`);
  return `${BACKSLASH}u${hexDigits(code, 4, upper)}`;
}

/**
 * The braced Unicode escape: backslash, `u`, `{`, the code point's hex
 * digits after `zeros` leading zeros, `}`.
 */
export function bracedEscape(
  code: number,
  zeros: number,
  upper: boolean,
): string {
  if (code > 0x10ffff)
    throw new Error(`P-19: no braced escape of ${String(code)}`);
  return `${BACKSLASH}u{${"0".repeat(zeros)}${hexDigits(code, 1, upper)}}`;
}

/**
 * The characters TypeScript's grammar gives a meaning after a backslash in a
 * string literal (ECMAScript's EscapeCharacter, beside the line
 * terminators): the single-character escapes, the decimal digits, `x`, and
 * `u`. A backslash before any other character escapes that character alone
 * (a NonEscapeCharacter).
 */
const ESCAPE_CHARACTERS = `'"${BACKSLASH}bfnrtv0123456789xu`;

/** Whether a backslash before `char` escapes it alone (module header). */
export function isNonEscapeCharacter(char: string): boolean {
  return (
    [...char].length === 1 &&
    !ESCAPE_CHARACTERS.includes(char) &&
    char !== LINE_FEED &&
    char !== CARRIAGE_RETURN &&
    char !== LINE_SEPARATOR &&
    char !== PARAGRAPH_SEPARATOR
  );
}

/** A backslash before a non-escape character. */
export function identityEscape(char: string): string {
  if (!isNonEscapeCharacter(char)) {
    throw new Error(`P-19: ${JSON.stringify(char)} is an escape character`);
  }
  return BACKSLASH + char;
}

/**
 * The single-character escapes, after their backslash: the two quote
 * characters, the backslash itself, and `b`, `f`, `n`, `r`, `t`, `v`.
 */
export const P19_SINGLE_ESCAPES: readonly string[] = [
  SINGLE_QUOTE,
  DOUBLE_QUOTE,
  BACKSLASH,
  "b",
  "f",
  "n",
  "r",
  "t",
  "v",
];

/** The NUL escape: backslash, `0` — never before a decimal digit. */
export const NUL_ESCAPE = `${BACKSLASH}0`;

/** The line terminators a line continuation draws after its backslash. */
export type P19Terminator = "LF" | "CR" | "CRLF" | "LS" | "PS";

export const P19_TERMINATORS: ReadonlyArray<
  readonly [name: P19Terminator, sequence: string]
> = [
  ["LF", LINE_FEED],
  ["CR", CARRIAGE_RETURN],
  ["CRLF", CARRIAGE_RETURN + LINE_FEED],
  ["LS", LINE_SEPARATOR],
  ["PS", PARAGRAPH_SEPARATOR],
];

/** Leading zeros a braced escape draws before its code point's digits. */
const BRACED_ZEROS: ReadonlyArray<readonly [number, number]> = [
  [4, 0],
  [2, 1],
  [1, 2],
  [1, 4],
  [1, 9],
];

/**
 * Code points an inserted escape sequence spells — controls, a Latin-1
 * letter, the separators, both surrogate halves' bounds, a byte-order mark,
 * U+FFFD, a noncharacter, and code points above U+FFFF — each in every
 * escape form that reaches it (hexadecimal at or below U+00FF, four-digit
 * at or below U+FFFF, braced for all).
 */
export const P19_INSERTED_CODE_POINTS: readonly number[] = [
  0x0, 0x0a, 0x7f, 0xe9, 0xff, 0x2028, 0xd800, 0xdfff, 0xfeff, 0xfffd, 0xffff,
  0x10000, 0x1f600, 0x10ffff,
];

/** Non-escape characters an inserted backslash escapes, ASCII and beyond. */
export const P19_IDENTITY_CHARACTERS: readonly string[] = [
  "a",
  "c",
  "s",
  "-",
  "/",
  ".",
  "@",
  " ",
  "%",
  cp(0xe9),
  REPLACEMENT,
  cp(0x1f5c2),
];

/**
 * Raw non-ASCII text beside U+FFFD: two-, three-, and four-byte forms, a
 * combining mark, U+00A0 and U+0085, the two separators U+2028 and U+2029
 * (raw, a string literal's ordinary characters: TypeScript 5.9.3 ends a
 * string literal at a raw line feed or carriage return alone), a zero-width
 * space, a byte-order mark inside the literal, a private-use code point,
 * and the noncharacters U+FFFF and U+10FFFF.
 */
export const P19_NON_ASCII_TEXTS: readonly string[] = [
  cp(0xe9),
  cp(0x65e5, 0x672c),
  cp(0x1f5c2),
  `e${cp(0x301)}`,
  cp(0xa0),
  cp(0x85),
  LINE_SEPARATOR,
  PARAGRAPH_SEPARATOR,
  cp(0x200b),
  cp(0xfeff),
  cp(0xe000),
  cp(0xffff),
  cp(0x10ffff),
];

/**
 * What follows an escaped backslash as ordinary characters: the spellings
 * of escapes, which begin none there (VIOL-IMPORT-BRACED reads `u{41}`
 * after an escaped backslash as the conformer does).
 */
export const P19_ESCAPED_BACKSLASH_TAILS: readonly string[] = [
  "u{41}",
  "u{0041}",
  "u{D800}",
  "u{1F600}",
  "u0041",
  "x41",
];

// Module-load self-checks: every text a draw spells raw is ASCII with no
// backslash, quote, or line terminator, so that each spelling is one
// well-formed literal; every identity character escapes itself alone.
for (const texts of Object.values(P19_SHAPE_TEXTS)) {
  for (const text of texts) {
    for (const char of text) {
      const code = char.codePointAt(0)!;
      if (
        code < 0x20 ||
        code > 0x7e ||
        char === BACKSLASH ||
        char === DOUBLE_QUOTE ||
        char === SINGLE_QUOTE
      ) {
        throw new Error(
          `P-19: the shape text ${JSON.stringify(text)} holds ${JSON.stringify(char)}, which no raw piece may spell`,
        );
      }
    }
  }
}
for (const char of P19_IDENTITY_CHARACTERS) identityEscape(char);
for (const tail of P19_ESCAPED_BACKSLASH_TAILS) {
  if (tail.includes(BACKSLASH)) {
    throw new Error(`P-19: the tail ${JSON.stringify(tail)} holds a backslash`);
  }
}

// ---------------------------------------------------------------------------
// The generator

const QUOTES: ReadonlyArray<readonly [number, P19Quote]> = [
  [1, "double"],
  [1, "single"],
];

/** How often a shape text's character is escaped: never, some, most. */
const ESCAPE_DENSITIES: ReadonlyArray<readonly [number, number]> = [
  [2, 0],
  [3, 0.25],
  [2, 0.6],
];

/** How often a piece is inserted at each position: never, some, often. */
const INSERT_DENSITIES: ReadonlyArray<readonly [number, number]> = [
  [2, 0],
  [3, 0.2],
  [3, 0.45],
];

/** Pieces inserted at one position, at most. */
const MAX_INSERTED_PER_POSITION = 2;

type CharacterEscape = "hex" | "unicode4" | "braced" | "identity";

const CHARACTER_ESCAPES: ReadonlyArray<readonly [number, CharacterEscape]> = [
  [2, "hex"],
  [2, "unicode4"],
  [3, "braced"],
  [2, "identity"],
];

type InsertedKind =
  | "continuation"
  | "single"
  | "nul"
  | "escape"
  | "identity"
  | "replacement"
  | "non-ascii"
  | "other-quote"
  | "escaped-backslash";

const INSERTED_KINDS: ReadonlyArray<readonly [number, InsertedKind]> = [
  [4, "continuation"],
  [3, "single"],
  [2, "nul"],
  [3, "escape"],
  [2, "identity"],
  [3, "replacement"],
  [3, "non-ascii"],
  [1, "other-quote"],
  [1, "escaped-backslash"],
];

/** The inserted kinds where the NUL escape would precede a decimal digit. */
const INSERTED_KINDS_BEFORE_DIGIT = INSERTED_KINDS.filter(
  ([, kind]) => kind !== "nul",
);

/** Whether `spelling` begins with a decimal digit. */
function beginsWithDigit(spelling: string | undefined): boolean {
  const code = spelling?.codePointAt(0);
  return code !== undefined && code >= 0x30 && code <= 0x39;
}

/** P-19's generator (module header): quote, shape, text, then the pieces. */
export const genP19Draw: Gen<P19Draw> = (choices) => {
  const quote = choices.weightedPick(QUOTES);
  const shape = choices.weightedPick(SHAPE_WEIGHTS);
  const text = choices.pick(P19_SHAPE_TEXTS[shape]);
  const escapeDensity = choices.weightedPick(ESCAPE_DENSITIES);
  const insertDensity = choices.weightedPick(INSERT_DENSITIES);
  const characters = [...text];
  const pieces: P19Piece[] = [];
  for (let index = 0; index <= characters.length; index += 1) {
    const character = characters[index];
    // The character's own spelling is drawn first, so that the pieces
    // inserted before it know whether it begins with a decimal digit.
    const own =
      character === undefined
        ? undefined
        : spellTextCharacter(choices, character, escapeDensity);
    pieces.push(
      ...genInserted(
        choices,
        quote,
        insertDensity,
        beginsWithDigit(own?.spelling),
      ),
    );
    if (own !== undefined) pieces.push(own);
  }
  return { quote, shape, text, pieces };
};

/** One character of the shape's text: raw, or an escape encoding it. */
function spellTextCharacter(
  choices: Choices,
  character: string,
  density: number,
): P19Piece {
  if (density === 0 || !choices.boolean(density)) {
    return { form: "raw", spelling: character };
  }
  const code = character.codePointAt(0)!;
  const forms = CHARACTER_ESCAPES.filter(
    ([, form]) => form !== "identity" || isNonEscapeCharacter(character),
  );
  switch (choices.weightedPick(forms)) {
    case "hex":
      return { form: "hex", spelling: hexEscape(code, choices.boolean()) };
    case "unicode4":
      return {
        form: "unicode4",
        spelling: unicode4Escape(code, choices.boolean()),
      };
    case "braced":
      return {
        form: "braced",
        spelling: bracedEscape(
          code,
          choices.weightedPick(BRACED_ZEROS),
          choices.boolean(),
        ),
      };
    case "identity":
      return { form: "identity", spelling: identityEscape(character) };
  }
}

/**
 * The pieces inserted at one position: none or more, each drawn knowing
 * whether it is the last before a piece beginning with a decimal digit,
 * where the NUL escape is never drawn: before a digit it would spell a
 * legacy octal escape, which TypeScript 5.9.3's scanner rejects.
 */
function genInserted(
  choices: Choices,
  quote: P19Quote,
  density: number,
  beforeDigit: boolean,
): P19Piece[] {
  if (density === 0) return [];
  let count = 0;
  while (count < MAX_INSERTED_PER_POSITION && choices.boolean(density)) {
    count += 1;
  }
  const pieces: P19Piece[] = [];
  for (let index = 0; index < count; index += 1) {
    const last = index === count - 1;
    pieces.push(
      genInsertedPiece(
        choices,
        quote,
        last && beforeDigit ? INSERTED_KINDS_BEFORE_DIGIT : INSERTED_KINDS,
      ),
    );
  }
  return pieces;
}

function genInsertedPiece(
  choices: Choices,
  quote: P19Quote,
  kinds: ReadonlyArray<readonly [number, InsertedKind]>,
): P19Piece {
  switch (choices.weightedPick(kinds)) {
    case "continuation": {
      const [, sequence] = choices.pick(P19_TERMINATORS);
      return { form: "continuation", spelling: BACKSLASH + sequence };
    }
    case "single":
      return {
        form: "single",
        spelling: BACKSLASH + choices.pick(P19_SINGLE_ESCAPES),
      };
    case "nul":
      return { form: "nul", spelling: NUL_ESCAPE };
    case "escape":
      return genInsertedEscape(choices);
    case "identity":
      return {
        form: "identity",
        spelling: identityEscape(choices.pick(P19_IDENTITY_CHARACTERS)),
      };
    case "replacement":
      return { form: "replacement", spelling: REPLACEMENT };
    case "non-ascii":
      return { form: "non-ascii", spelling: choices.pick(P19_NON_ASCII_TEXTS) };
    case "other-quote":
      return { form: "other-quote", spelling: otherQuoteCharacter(quote) };
    case "escaped-backslash":
      return {
        form: "escaped-backslash",
        spelling:
          BACKSLASH + BACKSLASH + choices.pick(P19_ESCAPED_BACKSLASH_TAILS),
      };
  }
}

/** An escape sequence of one of P19_INSERTED_CODE_POINTS, in a form reaching it. */
function genInsertedEscape(choices: Choices): P19Piece {
  const code = choices.pick(P19_INSERTED_CODE_POINTS);
  const upper = choices.boolean();
  const forms: ReadonlyArray<readonly [number, CharacterEscape]> = [
    ...(code <= 0xff ? [[1, "hex"] as const] : []),
    ...(code <= 0xffff ? [[2, "unicode4"] as const] : []),
    [3, "braced"],
  ];
  switch (choices.weightedPick(forms)) {
    case "hex":
      return { form: "hex", spelling: hexEscape(code, upper) };
    case "unicode4":
      return { form: "unicode4", spelling: unicode4Escape(code, upper) };
    default:
      return {
        form: "braced",
        spelling: bracedEscape(code, choices.weightedPick(BRACED_ZEROS), upper),
      };
  }
}

// ---------------------------------------------------------------------------
// Rendering (a falsification's counterexample)

/** A draw as text: its literal, how it was drawn, and its UTF-8 bytes. */
export function renderP19Draw(draw: P19Draw): string {
  const literal = spellP19Literal(draw);
  const forms = draw.pieces.map((piece) => piece.form);
  return (
    `the specifier ${JSON.stringify(literal)} (${draw.quote}-quoted; the ` +
    `${draw.shape} text ${JSON.stringify(draw.text)}; its pieces ` +
    `${forms.length === 0 ? "none" : forms.join(", ")}; its UTF-8 bytes ` +
    `${Buffer.from(literal, "utf8").toString("hex")})`
  );
}

// ---------------------------------------------------------------------------
// Staging

/**
 * The files a draw stages, for S-9's per-draw check (helpers/property.ts
 * `drawSources`): the configuration its specifier composes — judged
 * well-formed TypeScript both ways — and the two sources, judged for
 * derivability. The body stages exactly these (`p19DrawDecl`).
 */
export function stagedP19Sources(draw: P19Draw): DrawSource[] {
  return [
    [
      CONFIG_IMPORT_CONFIG_PATH,
      configImportText(spellP19Literal(draw)),
      "the drawn specifier's configuration",
    ],
    ...Object.entries(CONFIG_IMPORT_SOURCES).map(
      ([path, record]): DrawSource => [path, record.source],
    ),
  ];
}

/**
 * A draw's workspace: the configuration its specifier composes, declared
 * per draw (`ts.perDraw`: the property runner judged it before the body saw
 * the draw, and the builder judges it again at staging), beside the two
 * source records.
 */
export function p19DrawDecl(draw: P19Draw): WorkspaceDecl {
  return {
    files: {
      [CONFIG_IMPORT_CONFIG_PATH]: configImportText(spellP19Literal(draw)),
      ...CONFIG_IMPORT_SOURCES,
    },
    ts: { perDraw: [CONFIG_IMPORT_CONFIG_PATH] },
  };
}

/** The twin's workspace: the twin's configuration record and the sources. */
const P19_TWIN_DECL: WorkspaceDecl = {
  files: {
    [CONFIG_IMPORT_CONFIG_PATH]: CONFIG_IMPORT_TWIN_CONFIG,
    ...CONFIG_IMPORT_SOURCES,
  },
};

/**
 * What P-19 compares with the twin's files (module header): every entry
 * outside `.xspec/` but the configuration file — the sources, the generated
 * modules with their companions (13.1), and the emitted Markdown (13.2).
 * Graph data, the lock path, and everything else under `.xspec/` are pruned.
 */
const P19_COMPARED_FILES: SnapshotOptions = {
  exclude: (relPathBytes) => {
    const rel = Buffer.from(relPathBytes).toString("latin1");
    return (
      rel === ".xspec" ||
      rel.startsWith(".xspec/") ||
      rel === CONFIG_IMPORT_CONFIG_PATH
    );
  },
};

// ---------------------------------------------------------------------------
// The commands, the twin, and one draw

/**
 * One of T7-9's four commands, run from the workspace root with JSON output
 * in effect, and the outcome the twin's valid workspace gives it (H-5).
 */
interface P19Command {
  readonly argv: readonly string[];
  readonly expect: (result: RunResult, context: string) => void;
}

/** A findings-only surface: exit 0 with exactly `{"findings": []}`. */
function expectFindingFree(
  result: RunResult,
  context: string,
  rule: string,
): void {
  assertExitCode(
    result,
    0,
    `${context} — on a valid workspace it exits 0 finding-free (${rule}; H-5)`,
  );
  assertSameJson(
    decodeFindingsReport(parseJsonStdout(result, context), context).findings,
    [],
    `${context} — the report is exactly {"findings": []}, the ` +
      `findings-only form's one member holding the empty array (SPEC 12.7)`,
  );
}

/** A reading surface: exit 0 with exactly one JSON document (H-5, 12.0). */
function expectAnswered(
  result: RunResult,
  context: string,
  rule: string,
): void {
  assertExitCode(
    result,
    0,
    `${context} — a valid workspace's answer, exit 0 (${rule}; H-5)`,
  );
  parseJsonStdout(result, context);
}

const P19_COMMANDS: readonly P19Command[] = [
  {
    argv: ["build", "--json"],
    expect: (result, context) => {
      expectFindingFree(result, context, "SPEC 12.1");
    },
  },
  {
    argv: ["check", "--json"],
    expect: (result, context) => {
      expectFindingFree(result, context, "SPEC 12.2: graph data current");
    },
  },
  {
    argv: ["ids", "--json"],
    expect: (result, context) => {
      expectAnswered(result, context, "SPEC 12.3");
    },
  },
  {
    argv: ["inventory", "--json"],
    expect: (result, context) => {
      expectAnswered(result, context, "SPEC 11.6");
    },
  },
];

/** A command as diagnoses name it. */
function commandLabel(command: P19Command): string {
  return "`" + command.argv.join(" ") + "`";
}

/** The twin's four runs and its compared files, once they have run. */
interface P19Twin {
  readonly results: readonly RunResult[];
  readonly compared: DirectorySnapshot;
}

/**
 * The twin (module header): the four commands in order on its fresh
 * workspace, each holding the outcome that workspace gives it (H-5), then
 * its compared files.
 */
async function runP19Twin(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<P19Twin> {
  const results: RunResult[] = [];
  for (const command of P19_COMMANDS) {
    const context =
      `P-19's twin (the specifier ${CONFIG_IMPORT_TWIN_LITERAL}): ` +
      commandLabel(command);
    const result = await runProduct(product, {
      cwd: workspace.root,
      argv: command.argv,
    });
    command.expect(result, context);
    results.push(result);
  }
  return {
    results,
    compared: await snapshotDirectory(workspace.root, P19_COMPARED_FILES),
  };
}

/** Why each answer must be the twin's (TEST-SPEC P-19, T7-9; SPEC 7, 2.4). */
const TWIN_RULE =
  "the configuration differs from the twin's in its import's specifier " +
  "alone, a static string literal xspec reads as spelled and never " +
  "interprets, resolves, or loads, so that validity and everything xspec " +
  "derives from the configuration are independent of its spelling (SPEC " +
  "7, 2.4; TEST-SPEC P-19, T7-9)";

/**
 * A draw's run answers exactly as the twin's: the same exit outcome — exit
 * code, or death by signal — and byte-equal standard output (for
 * `inventory`, its `configuration` byte-identical among it). Standard error
 * is not compared: its wording is free (12.0).
 */
function assertAnswersAsTwin(
  result: RunResult,
  twin: RunResult,
  context: string,
): void {
  if (result.exitCode !== twin.exitCode || result.signal !== twin.signal) {
    fail(
      `${context}: it exits exactly as on its twin importing from ` +
        `${CONFIG_IMPORT_TWIN_LITERAL} — ${TWIN_RULE}; the draw: ` +
        `${summarizeResult(result)}; the twin: ${summarizeResult(twin)}`,
    );
  }
  assertBytesEqual(
    result.stdoutBytes,
    twin.stdoutBytes,
    `${context}: its standard output is byte-equal to the twin's — ` +
      `${TWIN_RULE}`,
  );
}

/**
 * One draw (module header): a fresh workspace staging the drawn specifier,
 * the four commands in order, each answering as the twin's did, then the
 * compared files byte-identical to the twin's.
 */
async function runP19Draw(
  product: ProductBinding,
  twin: P19Twin,
  draw: P19Draw,
): Promise<void> {
  const literal = JSON.stringify(spellP19Literal(draw));
  const workspace = await TestWorkspace.create(p19DrawDecl(draw));
  try {
    for (const [index, command] of P19_COMMANDS.entries()) {
      const twinResult = twin.results[index];
      if (twinResult === undefined) {
        throw new Error(`P-19: no twin run for ${commandLabel(command)}`);
      }
      const result = await runProduct(product, {
        cwd: workspace.root,
        argv: command.argv,
      });
      assertAnswersAsTwin(
        result,
        twinResult,
        `P-19 ${commandLabel(command)} over the specifier ${literal}`,
      );
    }
    assertSnapshotsEqual(
      twin.compared,
      await snapshotDirectory(workspace.root, P19_COMPARED_FILES),
      `P-19 over the specifier ${literal}, once its four commands have ` +
        `run: the generated modules and emitted Markdown — every file ` +
        `outside .xspec/ but the configuration file, the twin's first, the ` +
        `draw's second — are byte-identical to the twin's, graph data not ` +
        `compared (${TWIN_RULE})`,
    );
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// S-9's fixed TypeScript vectors

/**
 * Every spelling the generator's tables can stage, one literal per family
 * and quote style, each family's spellings concatenated (an escape sequence
 * is complete wherever it stands, and no piece but the NUL escape cares what
 * follows it; the NUL escape stands where a backslash follows it): the
 * shape texts raw; every escape the generator spells for their characters;
 * and every piece it inserts.
 */
function p19FamilyLiterals(
  quote: P19Quote,
): ReadonlyArray<readonly [family: string, literal: string]> {
  const characters = [
    ...new Set(
      Object.values(P19_SHAPE_TEXTS).flatMap((texts) => [...texts.join("")]),
    ),
  ].sort();
  const characterEscapes = characters.flatMap((character) => {
    const code = character.codePointAt(0)!;
    return [true, false].flatMap((upper) => [
      hexEscape(code, upper),
      unicode4Escape(code, upper),
      ...BRACED_ZEROS.map(([, zeros]) => bracedEscape(code, zeros, upper)),
      ...(isNonEscapeCharacter(character) ? [identityEscape(character)] : []),
    ]);
  });
  const insertedEscapes = P19_INSERTED_CODE_POINTS.flatMap((code) =>
    [true, false].flatMap((upper) => [
      ...(code <= 0xff ? [hexEscape(code, upper)] : []),
      ...(code <= 0xffff ? [unicode4Escape(code, upper)] : []),
      ...BRACED_ZEROS.map(([, zeros]) => bracedEscape(code, zeros, upper)),
    ]),
  );
  const inserted = [
    NUL_ESCAPE,
    ...P19_TERMINATORS.map(([, sequence]) => BACKSLASH + sequence),
    ...P19_SINGLE_ESCAPES.map((escaped) => BACKSLASH + escaped),
    ...insertedEscapes,
    ...P19_IDENTITY_CHARACTERS.map(identityEscape),
    REPLACEMENT,
    ...P19_NON_ASCII_TEXTS,
    otherQuoteCharacter(quote),
    ...P19_ESCAPED_BACKSLASH_TAILS.map((tail) => BACKSLASH + BACKSLASH + tail),
    NUL_ESCAPE,
  ];
  const delimiter = quoteCharacter(quote);
  return [
    ["every shape text, raw", Object.values(P19_SHAPE_TEXTS).flat().join("")],
    ["every escape of the shape texts' characters", characterEscapes.join("")],
    ["every inserted piece", inserted.join("")],
  ].map(([family, body]) => [family!, delimiter + body! + delimiter] as const);
}

/**
 * S-9's fixed TypeScript vectors (test/self/s9-typescript-well-formedness
 * .test.ts): the twin's configuration, and, in each quote style, the
 * configuration over each family literal (`p19FamilyLiterals`), every one
 * through the shared builder the draws are staged with.
 */
export const P19_TS_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, path: string, source: string | Uint8Array]
> = [
  [
    "P-19 configuration (the twin: CONFIG_IMPORT_TWIN_CONFIG)",
    CONFIG_IMPORT_CONFIG_PATH,
    CONFIG_IMPORT_TWIN_CONFIG.source,
  ],
  ...(["double", "single"] as const).flatMap((quote) =>
    p19FamilyLiterals(quote).map(
      ([family, literal]) =>
        [
          `P-19 configuration (${quote}-quoted: ${family})`,
          CONFIG_IMPORT_CONFIG_PATH,
          configImportText(literal),
        ] as const,
    ),
  ),
];

// ---------------------------------------------------------------------------
// Registration

const P_19 = defineProductTest({
  id: "P-19",
  title:
    "configuration import spellings (TEST-SPEC §16 P-19): seeded draws of " +
    "the configuration's module specifier as a static string literal " +
    "TypeScript 5.9.3's scanner accepts — double- or single-quoted; its " +
    "text shaped as a bare name, a scoped name, a relative or absolute " +
    "path, a URL, or the empty string, each character raw or spelled as a " +
    "hexadecimal escape, a four-digit or braced Unicode escape (leading " +
    "zeros included), or an escaped non-escape character; with " +
    "single-character escapes, the NUL escape before a non-digit, line " +
    "continuations after each line terminator, escapes of other code " +
    "points (surrogates, and braced ones above U+FFFF), an escaped " +
    "backslash before an escape's spelling, U+FFFD, other non-ASCII code " +
    "points, and the other quote character inserted — each draw checked " +
    "well-formed before the product sees it (S-9) and staged exactly as " +
    "spelled, over T7-9's workspace (one spec group globbing specs/*.mdx " +
    "over specs/A.mdx and specs/B.mdx, Markdown emitted next to sources, " +
    "no group discovering the configuration file): each draw loads and " +
    'answers as its twin importing from "xspec" does — `build`, `check`, ' +
    "`ids`, and `inventory`, each under `--json`, exit code and standard " +
    "output equal to the twin's (`inventory`'s `configuration` " +
    "byte-identical among them), `build` and `check` exiting 0 " +
    "finding-free, and the generated modules and emitted Markdown " +
    "byte-identical, graph data not compared (SPEC 7, 2.4; T7-9; E-5)",
  run: async (product) => {
    const twinWorkspace = await TestWorkspace.create(P19_TWIN_DECL);
    try {
      const twin = await runP19Twin(product, twinWorkspace);
      await checkProperty(
        "P-19 configuration import spellings",
        genP19Draw,
        async (draw) => {
          await runP19Draw(product, twin, draw);
        },
        {
          runs: P19_RUNS_PER_SEED,
          maxShrinkExecutions: P19_MAX_SHRINK_EXECUTIONS,
          render: renderP19Draw,
          drawSources: stagedP19Sources,
        },
      );
    } finally {
      await twinWorkspace.dispose();
    }
  },
});

/** TEST-SPEC §16 P-19. */
export const section16P19Tests: readonly ProductTestEntry[] = [P_19];
