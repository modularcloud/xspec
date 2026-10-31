// P-19's fixed-seed draw guard (TEST-SPEC §16 P-19; §18 E-5; §0 H-10;
// CERTIFICATIONS.md §CONF-IMPORT, §VIOL-IMPORT-BRACED, §VIOL-IMPORT-SINGLE).
// CI runs P-19 over the fixed seed set (E-5), so the specifiers it stages
// are a pure function of its generator, the seed set, and its registered
// runs per seed (`P19_RUNS_PER_SEED`; P-19 passes no `seeds`). They are
// replayed here exactly as `checkProperty` draws them —
// `drawFixedSeedTrials`, one sequential PRNG stream per seed — with no
// property body and no product (H-8's ordering: the guard holds before any
// product exists). Each CONF-IMPORT violator fails P-19 only on a draw
// reaching the form its deviation refuses, as spelled, and P-19 passes
// against it exactly when no fixed-seed draw reaches that form (C-1 judges
// P-19 at the fixed seeds; §CONF-IMPORT's justification: criterion (a)'s
// reachability case), so the guard pins, over those draws, each classified
// by a scanner of its own over the literal's characters — never by what
// the generator says it drew:
//
//   1. the certified forms: a single-quoted specifier (VIOL-IMPORT-SINGLE),
//      and a braced Unicode escape of a code point at or below U+FFFF begun
//      by a backslash that itself begins an escape (VIOL-IMPORT-BRACED;
//      leading zeros and surrogates count, and both are reached);
//   2. the rest of P-19's search space, so that a generator change cannot
//      drop a class silently: double quotes; each text shape and the empty
//      string itself; the hexadecimal escape, the four-digit Unicode escape,
//      the braced one above U+FFFF, each single-character escape, an escaped
//      non-escape character (one beyond ASCII among them), and the NUL
//      escape before a non-digit; a line continuation after each line
//      terminator the generator draws; a raw U+FFFD and other raw
//      non-ASCII code points; the other quote
//      character, raw; and an escaped backslash before `u{`, which begins
//      no braced escape;
//   3. that each draw's staged configuration — the workspace P-19's body
//      creates from it (`p19DrawDecl`), read back — holds the drawn
//      spelling's exact UTF-8 bytes, between the shared builder's head and
//      tail (helpers/config-import.ts): no decoding, no re-quoting, no
//      printer (CONF-IMPORT's staging hazards);
//   4. that every fixed-seed draw passes S-9's per-draw check before any
//      product exists, through P-19's own code path (`checkProperty` with
//      its `drawSources`) — P-19 itself stops at its first falsified draw,
//      so its later draws reach that check only here.
//
// Should the fixed seeds miss a class, raise `P19_RUNS_PER_SEED` or the
// class's weight; never weaken this.

import { Buffer } from "node:buffer";
import { expect, test } from "vitest";
import {
  BACKSLASH,
  CONFIG_IMPORT_CONFIG_PATH,
  CONFIG_IMPORT_HEAD,
  CONFIG_IMPORT_TAIL,
} from "../helpers/config-import.js";
import {
  checkProperty,
  DEFAULT_PROPERTY_SEEDS,
  drawFixedSeedTrials,
} from "../helpers/property.js";
import { TestWorkspace } from "../helpers/workspace.js";
import type { P19Draw } from "../suite/registry/section-16-p19.js";
import {
  genP19Draw,
  P19_RUNS_PER_SEED,
  P19_SHAPES,
  P19_SINGLE_ESCAPES,
  P19_TERMINATORS,
  p19DrawDecl,
  spellP19Literal,
  stagedP19Sources,
} from "../suite/registry/section-16-p19.js";

const cp = (...codes: number[]): string => String.fromCodePoint(...codes);
const LINE_FEED = cp(0x0a);
const CARRIAGE_RETURN = cp(0x0d);
const LINE_SEPARATOR = cp(0x2028);
const PARAGRAPH_SEPARATOR = cp(0x2029);
const REPLACEMENT = cp(0xfffd);
const DOUBLE_QUOTE = '"';
const SINGLE_QUOTE = "'";
const HEX = "0123456789abcdefABCDEF";
const DIGITS = "0123456789";

/** Whether `character` is one character among `set` (never the empty string). */
function isOneOf(character: string | undefined, set: string): boolean {
  return (
    character !== undefined &&
    [...character].length === 1 &&
    set.includes(character)
  );
}

/** One replayed draw, labelled with its seed and 1-based trial number. */
interface Replayed {
  readonly label: string;
  readonly draw: P19Draw;
  readonly literal: string;
  readonly scanned: Scanned;
}

/** One unit of a literal's body as the scanner reads it. */
type Token =
  | { readonly kind: "raw" | "replacement" | "non-ascii" | "other-quote" }
  | { readonly kind: "hex" | "nul" }
  | { readonly kind: "unicode4"; readonly codePoint: number }
  | {
      readonly kind: "braced";
      readonly codePoint: number;
      /** Digits beyond the code point's shortest spelling. */
      readonly leadingZeros: boolean;
    }
  | {
      readonly kind: "single" | "identity";
      /** The character after the backslash. */
      readonly escaped: string;
      /** For an escaped backslash: the two characters after it. */
      readonly next: string;
    }
  | { readonly kind: "continuation"; readonly terminator: string };

interface Scanned {
  readonly quote: string;
  readonly empty: boolean;
  readonly tokens: readonly Token[];
}

/**
 * The scanner (module header): a literal's quote and body, its body read
 * as TypeScript's grammar for a string literal reads it — every backslash
 * beginning one escape sequence, each recognized by its first character
 * after the backslash — and anything else that grammar rejects, or no
 * draw may spell, thrown: a backslash ending the body, a malformed or
 * out-of-range escape, a decimal digit after a backslash (but the NUL
 * escape before a non-digit), an unescaped delimiter, a raw line feed or
 * carriage return.
 */
function scanLiteral(literal: string): Scanned {
  const characters = [...literal];
  const quote = characters[0];
  if (
    (quote !== DOUBLE_QUOTE && quote !== SINGLE_QUOTE) ||
    characters.length < 2 ||
    characters[characters.length - 1] !== quote
  ) {
    throw new Error(`no quoted literal: ${JSON.stringify(literal)}`);
  }
  const body = characters.slice(1, -1);
  const tokens: Token[] = [];
  const hexRun = (from: number, count: number): number => {
    const digits = body.slice(from, from + count);
    if (digits.length !== count || !digits.every((d) => isOneOf(d, HEX))) {
      throw new Error(`malformed escape in ${JSON.stringify(literal)}`);
    }
    return Number.parseInt(digits.join(""), 16);
  };
  for (let i = 0; i < body.length; i += 1) {
    const character = body[i]!;
    if (character !== BACKSLASH) {
      if (character === quote) {
        throw new Error(`unescaped delimiter in ${JSON.stringify(literal)}`);
      }
      if (character === LINE_FEED || character === CARRIAGE_RETURN) {
        throw new Error(`raw line break in ${JSON.stringify(literal)}`);
      }
      const code = character.codePointAt(0)!;
      tokens.push({
        kind:
          character === REPLACEMENT
            ? "replacement"
            : code > 0x7f
              ? "non-ascii"
              : character === DOUBLE_QUOTE || character === SINGLE_QUOTE
                ? "other-quote"
                : "raw",
      });
      continue;
    }
    const next = body[i + 1];
    if (next === undefined) {
      throw new Error(`a backslash ends ${JSON.stringify(literal)}`);
    }
    if (next === "x") {
      hexRun(i + 2, 2);
      tokens.push({ kind: "hex" });
      i += 3;
    } else if (next === "u" && body[i + 2] === "{") {
      let end = i + 3;
      while (end < body.length && body[end] !== "}") end += 1;
      const count = end - (i + 3);
      if (end >= body.length || count === 0) {
        throw new Error(
          `malformed braced escape in ${JSON.stringify(literal)}`,
        );
      }
      const codePoint = hexRun(i + 3, count);
      if (codePoint > 0x10ffff) {
        throw new Error(`out-of-range escape in ${JSON.stringify(literal)}`);
      }
      tokens.push({
        kind: "braced",
        codePoint,
        leadingZeros: count > codePoint.toString(16).length,
      });
      i = end;
    } else if (next === "u") {
      tokens.push({ kind: "unicode4", codePoint: hexRun(i + 2, 4) });
      i += 5;
    } else if (next === "0" && !isOneOf(body[i + 2], DIGITS)) {
      tokens.push({ kind: "nul" });
      i += 1;
    } else if (isOneOf(next, DIGITS)) {
      throw new Error(`a digit escape in ${JSON.stringify(literal)}`);
    } else if (next === LINE_FEED) {
      tokens.push({ kind: "continuation", terminator: "LF" });
      i += 1;
    } else if (next === CARRIAGE_RETURN) {
      const crlf = body[i + 2] === LINE_FEED;
      tokens.push({ kind: "continuation", terminator: crlf ? "CRLF" : "CR" });
      i += crlf ? 2 : 1;
    } else if (next === LINE_SEPARATOR || next === PARAGRAPH_SEPARATOR) {
      tokens.push({
        kind: "continuation",
        terminator: next === LINE_SEPARATOR ? "LS" : "PS",
      });
      i += 1;
    } else {
      tokens.push({
        kind: P19_SINGLE_ESCAPES.includes(next) ? "single" : "identity",
        escaped: next,
        next: body.slice(i + 2, i + 4).join(""),
      });
      i += 1;
    }
  }
  return { quote, empty: body.length === 0, tokens };
}

const REPLAYED: readonly Replayed[] = drawFixedSeedTrials(
  genP19Draw,
  P19_RUNS_PER_SEED,
).map((draw, index) => {
  const literal = spellP19Literal(draw);
  return {
    label:
      `seed ${String(DEFAULT_PROPERTY_SEEDS[Math.floor(index / P19_RUNS_PER_SEED)])} ` +
      `trial ${String((index % P19_RUNS_PER_SEED) + 1)}`,
    draw,
    literal,
    scanned: scanLiteral(literal),
  };
});

/** The labels of the draws `matches` accepts. */
function drawsWhere(matches: (replayed: Replayed) => boolean): string[] {
  return REPLAYED.filter(matches).map(({ label }) => label);
}

/** The labels of the draws holding a token `matches` accepts. */
function drawsHolding(matches: (token: Token) => boolean): string[] {
  return drawsWhere(({ scanned }) => scanned.tokens.some(matches));
}

/** The class names `reach` maps to no draw. */
function unreached(
  reach: Readonly<Record<string, readonly string[]>>,
): string[] {
  return Object.entries(reach)
    .filter(([, labels]) => labels.length === 0)
    .map(([name]) => name);
}

const isBraced = (token: Token): token is Extract<Token, { kind: "braced" }> =>
  token.kind === "braced";

test("P-19's fixed-seed draws reach, as spelled, each form a CONF-IMPORT violator refuses: a single-quoted specifier, and a braced Unicode escape of a code point at or below U+FFFF begun by a backslash that begins an escape — with leading zeros, and of a surrogate, among them", () => {
  const reach = {
    singleQuoted: drawsWhere(({ scanned }) => scanned.quote === SINGLE_QUOTE),
    bracedAtOrBelowFFFF: drawsHolding(
      (token) => isBraced(token) && token.codePoint <= 0xffff,
    ),
    bracedAtOrBelowFFFFWithLeadingZeros: drawsHolding(
      (token) =>
        isBraced(token) && token.codePoint <= 0xffff && token.leadingZeros,
    ),
    bracedSurrogate: drawsHolding(
      (token) =>
        isBraced(token) &&
        token.codePoint >= 0xd800 &&
        token.codePoint <= 0xdfff,
    ),
  };
  expect(
    unreached(reach),
    `forms P-19's fixed seeds never reach as spelled — a violator ` +
      `refusing one would pass P-19 (criterion (a)'s reachability case); ` +
      `reach: ${JSON.stringify(reach)}`,
  ).toEqual([]);
});

test("P-19's fixed-seed draws reach the rest of its search space: double quotes, every text shape and the empty string, every escape form, a line continuation after each line terminator, raw U+FFFD and other non-ASCII code points, the other quote character, and an escaped backslash before u{", () => {
  const reach: Record<string, string[]> = {
    doubleQuoted: drawsWhere(({ scanned }) => scanned.quote === DOUBLE_QUOTE),
    theEmptyString: drawsWhere(({ scanned }) => scanned.empty),
    hex: drawsHolding((token) => token.kind === "hex"),
    unicode4: drawsHolding((token) => token.kind === "unicode4"),
    bracedAboveFFFF: drawsHolding(
      (token) => isBraced(token) && token.codePoint > 0xffff,
    ),
    identity: drawsHolding((token) => token.kind === "identity"),
    identityBeyondAscii: drawsHolding(
      (token) =>
        token.kind === "identity" && token.escaped.codePointAt(0)! > 0x7f,
    ),
    nulBeforeNonDigit: drawsHolding((token) => token.kind === "nul"),
    replacement: drawsHolding((token) => token.kind === "replacement"),
    otherNonAscii: drawsHolding((token) => token.kind === "non-ascii"),
    otherQuote: drawsHolding((token) => token.kind === "other-quote"),
    escapedBackslashBeforeBrace: drawsHolding(
      (token) =>
        token.kind === "single" &&
        token.escaped === BACKSLASH &&
        token.next === "u{",
    ),
  };
  for (const shape of P19_SHAPES) {
    reach[`shape:${shape}`] = drawsWhere(({ draw }) => draw.shape === shape);
  }
  for (const escaped of P19_SINGLE_ESCAPES) {
    reach[`single:${JSON.stringify(escaped)}`] = drawsHolding(
      (token) => token.kind === "single" && token.escaped === escaped,
    );
  }
  for (const [terminator] of P19_TERMINATORS) {
    reach[`continuation:${terminator}`] = drawsHolding(
      (token) =>
        token.kind === "continuation" && token.terminator === terminator,
    );
  }
  expect(
    unreached(reach),
    `classes of P-19's search space its fixed seeds never reach; reach: ` +
      JSON.stringify(reach),
  ).toEqual([]);
});

test("each fixed-seed P-19 draw's staged configuration holds the drawn spelling's exact UTF-8 bytes between the shared builder's head and tail — no decoding, no re-quoting, no printer", async () => {
  const mismatches: string[] = [];
  for (const { label, draw, literal } of REPLAYED) {
    const workspace = await TestWorkspace.create(p19DrawDecl(draw));
    try {
      const staged = Buffer.from(
        await workspace.readBytes(CONFIG_IMPORT_CONFIG_PATH),
      );
      const expected = Buffer.concat([
        Buffer.from(CONFIG_IMPORT_HEAD, "utf8"),
        Buffer.from(literal, "utf8"),
        Buffer.from(CONFIG_IMPORT_TAIL, "utf8"),
      ]);
      // The spelling's backslashes are its pieces', every one staged.
      const backslashes = draw.pieces
        .map((piece) => [...piece.spelling].filter((c) => c === BACKSLASH))
        .flat().length;
      const stagedBackslashes = [...staged].filter((b) => b === 0x5c).length;
      if (!staged.equals(expected) || stagedBackslashes !== backslashes) {
        mismatches.push(
          `${label}: staged ${staged.toString("hex")}, drawn ` +
            `${expected.toString("hex")} (${String(stagedBackslashes)} ` +
            `backslashes staged, ${String(backslashes)} drawn)`,
        );
      }
    } finally {
      await workspace.dispose();
    }
  }
  expect(mismatches).toEqual([]);
  // Not vacuous: the draws stage backslashes, both quote styles, and code
  // points beyond ASCII.
  const all = REPLAYED.map(({ literal }) => literal).join("");
  expect(all.includes(BACKSLASH)).toBe(true);
  expect([...all].some((c) => c.codePointAt(0)! > 0x7f)).toBe(true);
});

test("every fixed-seed P-19 draw passes S-9's per-draw check before any product exists, through P-19's own code path (TEST-SPEC §16 P-19, §17 S-9; E-5 replay at P-19's registered runs per seed)", async () => {
  // P-19 as its registration runs it — the generator, the fixed seed set
  // (no `seeds`; `env: {}`, so no replay variable intervenes), the
  // registered runs per seed, and `drawSources: stagedP19Sources` — with a
  // body that only counts: checkProperty judges each draw's configuration
  // and sources before the body runs on it, and a draw failing S-9 rejects
  // the run as a harness error naming its seed.
  const literals: string[] = [];
  await checkProperty(
    "P-19 configuration import spellings (S-9 per-draw replay, no product)",
    genP19Draw,
    (draw) => {
      literals.push(spellP19Literal(draw));
    },
    { runs: P19_RUNS_PER_SEED, env: {}, drawSources: stagedP19Sources },
  );
  expect(literals).toEqual(REPLAYED.map(({ literal }) => literal));
  // Every draw stages its configuration and the two sources.
  for (const { draw } of REPLAYED) {
    expect(stagedP19Sources(draw).map(([path]) => path)).toEqual([
      CONFIG_IMPORT_CONFIG_PATH,
      "specs/A.mdx",
      "specs/B.mdx",
    ]);
  }
});
