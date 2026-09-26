// TEST-SPEC §16 P-1 (segment/tag validity) — PROP-01.
//
// One registered product-facing property test (C-2 "one code path"): seeded,
// reproducible generators (helpers/property.ts, H-10; fixed seed set in CI,
// E-5) produce segment draws and `tags`-prop values over a code-point
// alphabet weighted toward the SPEC 1.4 boundary classes P-1 names — the
// whitespace and control classes of 1.4, the excluded boundary code points
// U+00A0/U+0085/U+2028, `.` and `#`, the quote, escape, and
// character-reference characters `"` `'` `\` `&` and U+FFFD (each invalid,
// 1.4), the forbidden names, and the glob metacharacters of common dialects
// (`[` `]` `{` `}` `!` `+` `(` `)`), which are ordinary valid segment
// characters. Each trial stages its draw in a
// fresh workspace (H-1), drives `build` strictly as a subprocess (H-2/H-5),
// and asserts acceptance iff the harness-side oracle — an independent
// restatement of SPEC 1.4 (exact character classes), 1.3 (`.` is the ID
// separator) and 2.6 (tag splitting) — accepts:
//
//   * segment: the property judges the staged spelling's resulting split. A
//     draw containing `.` can be spelled as no single segment (1.4: `.` is
//     the ID separator), so it stages as that many segments — its bearer
//     nested beneath the ancestor chain the split's prefixes spell, one
//     section per level, each ancestor's `id` the draw's prefix up to that
//     dot — and a `.`-free draw stages as one top-level segment. The
//     structural rule (1.3) therefore holds by construction whenever the
//     segments are valid (structural-rule outcomes are T1.3-2..4's, never
//     this oracle's), and `build` must accept (exit 0) iff every resulting
//     segment satisfies 1.4 — the empty segments a leading, trailing, or
//     doubled dot yields included as invalid. Rejections are exit 1 with a
//     findings report whose conditions are exactly the staged ones: 14.4
//     alone for a dot-free draw (one top-level single-segment ID); for a
//     dot-containing draw 14.4 and/or 14.2 — every ID from the offending
//     level down carries the invalid segment, and whether a product reads an
//     ill-formed level (`a.` beneath `a`) as a 1.4 violation alone or also
//     as a structural one is sub-segment analysis SPEC 14 does not pin; the
//     accept/reject boundary is.
//   * tags: accepted iff every token of the 2.6 split (runs of 1.4
//     whitespace, leading/trailing ignored) satisfies 1.4 with `.` allowed —
//     whitespace never reaches tag validation, and zero tokens are accepted
//     as an omitted prop (T2.6-2). Rejections report 14.4 only.
//
// CONF-VALID in-scope; certified by §VIOL-VALID-CTRL and §VIOL-VALID-WIDE
// (CERTIFICATIONS.md). Fixtures stay within the CONF-VALID scope: one
// configured spec group of `.mdx` sources whose sections carry `id`/`tags`
// props only — values in either quote kind, bearers nested as deeply as the
// `.`-bearing draws stage them — and the command surface is `build` with
// 14.1–14.4 reporting. The generator's reachability of the certifying
// classes is deterministic under the fixed seed set (E-5): the committed
// seeds stage, many times over, (a) draws whose only 1.4 violation is a
// non-whitespace control character — accepted by VIOL-VALID-CTRL where 1.4
// rejects them — and (b) 1.4-valid draws containing U+00A0/U+0085/U+2028 —
// rejected by VIOL-VALID-WIDE where 1.4 accepts them. CERT-09/CERT-10
// verify both against the real fixtures. The same seeds stage the shapes
// the staging discipline below introduces — `.`-bearing draws accepted
// nested and rejected at an ancestor or at the bearer, single-quoted
// spellings — through the `dottedChain` shape and the quote characters'
// alphabet weights.
//
// Byte-exact staging per the SUITE-03 discipline (HARNESS-01): every
// character under test — raw control bytes included — is written into the
// fixture's source bytes exactly as generated (UTF-8 encoded, no BOM, no
// newline translation), inside a quoted attribute value, so validity (14.4)
// — never source encoding (14.20) — is the condition at stake. In this
// module's own source the characters are constructed from hex code points
// via `cp(0x…)` (visible, tool-safe, immune to editor/formatter
// normalization); the builder encodes the resulting strings to the identical
// raw bytes.
//
// Staging discipline (SPEC 2.7, 2.4: an `id` or `tags` value is a plain
// single- or double-quoted static string read verbatim, no escape or
// character-reference form being interpreted): each draw is spelled in the
// quote kind its content admits — single quotes for a draw containing `"`,
// double quotes for one containing `'`; either kind is admissible for a draw
// containing neither, and this module spells those double. Since 1.4 makes
// every draw containing `"` or `'` invalid (the quote, escape, and
// character-reference characters), such a draw is staged in the other quote
// kind and predicted rejected (14.4), never set aside. A draw containing
// both quote characters admits no static-string spelling, so it is never
// staged: the staged file could only be unparseable (14.20) or prop-invalid
// (14.17) — a harness artifact of exactly the class H-11 forbids reporting
// as a product failure — and it is invalid under the oracle too, so its
// exclusion loses no prediction. The generators redraw such a draw
// (`spellable` below), keeping each property's trial count. That the product
// accepts both quote kinds alike is T2.7-3's deterministic question, not
// this generator's.
//
// Two further staging guards keep the generated values inside that model,
// and are deliberate alphabet/shape choices, not oracle behavior:
//   * The alphabet omits the MDX-structural ASCII characters `<` and `>`:
//     ordinary valid segment characters that are no P-1 boundary class, and
//     staging them would exercise MDX attribute lexing, not 1.4 validity.
//     The quote, escape, and character-reference characters `"` `'` `\` `&`
//     and U+FFFD — invalid boundary classes of 1.4 — are all in the
//     alphabet: the two quote characters under the staging discipline
//     above; `\` and `&` as raw characters inside the quoted value, where
//     2.4 reads them verbatim — no escape sequence or character reference
//     is interpreted — so the oracle predicts 14.4 on the character itself,
//     and a product interpreting an escape or reference form (reading the
//     six-character escape of `.` or the reference `&#46;` as `.`) answers
//     for a value it was never given; the verbatim spellings themselves are
//     T1.4-1's and T1.4-4's deterministic arms. U+FFFD is staged as the
//     literal, validly encoded code point (its UTF-8 bytes EF BF BD), so
//     validity (14.4) — never source encoding (14.20) — is at stake.
//   * Generated values never stage a blank line inside an opening tag (a
//     line-terminator sequence enclosing only spaces/tabs): MDX flow tags do
//     not admit blank lines, so such staging would test parseability (14.20)
//     instead. Single line terminators — the 1.4 whitespace class members
//     P-1 names — are staged freely, exactly as SUITE-03's matrix stages
//     them one at a time. A prefix of a hazard-free draw is hazard-free (its
//     terminator pairs are a subset), so the ancestor `id`s a `.`-bearing
//     draw stages are covered by the repair of the whole draw.
//
// S-9 (TEST-SPEC 17; the §16 preamble: each draw is checked before the
// product is driven on it): accepted and rejected draws alike derive under
// the stock MDX 3 grammar by construction — every draw sits inside a quoted
// attribute value of a flow tag, holding no quote of its own kind and no
// blank line (above) — so each draw's staged source is judged by the
// harness's derivability check before `build` sees it
// (helpers/property.ts `mdxSources`, fed from the same pure staging
// functions the bodies stage from), and the fixed vector set
// `P1_FORM_VECTORS` below — every alphabet character alone and inside a
// value, the forbidden-name shapes, the ancestor chains a `.`-bearing draw
// spells (empty segments included), single line terminators and repaired
// blank-line hazards inside a value, and the 2.6 whitespace runs — each
// staged as a segment draw and as a `tags` value in every admissible quote
// kind, is judged before any product exists
// (test/self/s9-fixture-well-formedness.test.ts).

import type { Finding } from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import type { Choices, DrawSource, Gen } from "../../helpers/property.js";
import { checkProperty, listOf } from "../../helpers/property.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { buildFindings, buildOk } from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group — the
// CONF-VALID scope, byte-identical to SUITE-03's staging.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

/** The character with the given code point (hex-spelled, tool-safe). */
function cp(codePoint: number): string {
  return String.fromCodePoint(codePoint);
}

const TAB = cp(0x0009);
const LF = cp(0x000a);
const VT = cp(0x000b);
const FF = cp(0x000c);
const CR = cp(0x000d);
const SPACE = cp(0x0020);
const DOUBLE_QUOTE = cp(0x0022);
const SINGLE_QUOTE = cp(0x0027);
const AMPERSAND = cp(0x0026);
const BACKSLASH = cp(0x005c);
const DOT = cp(0x002e);
const REPLACEMENT_CHARACTER = cp(0xfffd);

// --- the SPEC 1.3 / 1.4 / 2.6 oracle -------------------------------------------
//
// An independent restatement of the spec text, judging the exact value the
// trial stages. SPEC 1.4: whitespace means exactly U+0009 U+000A U+000B
// U+000C U+000D U+0020, control characters means exactly U+0000–U+001F and
// U+007F, and no other code point (U+00A0, U+0085, U+2028 included) belongs
// to either class. SPEC 1.3: `.` separates an ID's segments.

const FORBIDDEN_NAMES: readonly string[] = [
  "$",
  "__proto__",
  "prototype",
  "constructor",
  "then",
];

function isSpecWhitespace(codePoint: number): boolean {
  return (codePoint >= 0x0009 && codePoint <= 0x000d) || codePoint === 0x0020;
}

function isSpecControl(codePoint: number): boolean {
  return codePoint <= 0x001f || codePoint === 0x007f;
}

/**
 * The quote, escape, and character-reference characters SPEC 1.4 excludes
 * from segments and tags — `"`, `'`, `\`, `&` — so that every segment and
 * tag is spelled verbatim in every form (2.4, 2.7, 6.4).
 */
const QUOTE_ESCAPE_REFERENCE_CODE_POINTS: ReadonlySet<number> = new Set([
  0x0022, 0x0027, 0x005c, 0x0026,
]);

type Verdict =
  { readonly valid: true } | { readonly valid: false; readonly reason: string };

/**
 * SPEC 1.4 validity of one segment or tag value. The two roles differ in
 * exactly one rule: a tag MAY contain `.` (a segment never does — the split
 * below leaves none in a segment, so that rule is the tag role's contrast).
 */
function valueVerdict(value: string, role: "segment" | "tag"): Verdict {
  if (value.length === 0) {
    return { valid: false, reason: `the ${role} is empty (1.4: non-empty)` };
  }
  if (FORBIDDEN_NAMES.includes(value)) {
    return {
      valid: false,
      reason: `the ${role} is the forbidden name ${JSON.stringify(value)} (1.4)`,
    };
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint === 0x002e && role === "segment") {
      return { valid: false, reason: 'the segment contains "." (1.4)' };
    }
    if (codePoint === 0x0023) {
      return { valid: false, reason: `the ${role} contains "#" (1.4)` };
    }
    if (isSpecWhitespace(codePoint)) {
      return {
        valid: false,
        reason: `the ${role} contains the whitespace character ${codePointName(codePoint)} (1.4)`,
      };
    }
    if (isSpecControl(codePoint)) {
      return {
        valid: false,
        reason: `the ${role} contains the control character ${codePointName(codePoint)} (1.4)`,
      };
    }
    if (QUOTE_ESCAPE_REFERENCE_CODE_POINTS.has(codePoint)) {
      return {
        valid: false,
        reason: `the ${role} contains the quote, escape, or character-reference character ${codePointName(codePoint)} (1.4)`,
      };
    }
    if (codePoint === 0xfffd) {
      return {
        valid: false,
        reason: `the ${role} contains U+FFFD, the replacement character (1.4)`,
      };
    }
  }
  return { valid: true };
}

/**
 * The segments a draw spells (SPEC 1.3: `.` is the ID separator, so a draw
 * containing `.` can be spelled as no single segment and stages as that many
 * — TEST-SPEC P-1). The empty draw splits to one empty segment; a leading,
 * trailing, or doubled dot yields an empty segment; each is a 1.4 violation.
 */
function splitSegments(draw: string): readonly string[] {
  return draw.split(DOT);
}

type SegmentsVerdict =
  | { readonly accepted: true; readonly segments: readonly string[] }
  | {
      readonly accepted: false;
      readonly segments: readonly string[];
      readonly reason: string;
    };

/**
 * Acceptance of a whole segment draw: `build` accepts the staging iff every
 * segment of the split satisfies 1.4 (the structural rule holds by
 * construction — see the module header).
 */
function segmentsVerdict(draw: string): SegmentsVerdict {
  const segments = splitSegments(draw);
  for (let index = 0; index < segments.length; index += 1) {
    const verdict = valueVerdict(segments[index]!, "segment");
    if (!verdict.valid) {
      return {
        accepted: false,
        segments,
        reason:
          `segment ${String(index + 1)} of ${String(segments.length)}, ` +
          `${renderCodePoints(segments[index]!)}, is invalid: ${verdict.reason}`,
      };
    }
  }
  return { accepted: true, segments };
}

/**
 * The 2.6 splitting model: tags are split on runs of 1.4 whitespace, and
 * leading and trailing whitespace is ignored — so no token is ever empty or
 * contains whitespace.
 */
function splitTags(value: string): readonly string[] {
  const tokens: string[] = [];
  let current = "";
  for (const character of value) {
    if (isSpecWhitespace(character.codePointAt(0)!)) {
      if (current !== "") {
        tokens.push(current);
        current = "";
      }
    } else {
      current += character;
    }
  }
  if (current !== "") tokens.push(current);
  return tokens;
}

type TagsVerdict =
  | { readonly accepted: true; readonly tokens: readonly string[] }
  | {
      readonly accepted: false;
      readonly tokens: readonly string[];
      readonly reason: string;
    };

/**
 * Acceptance of a whole `tags` value: zero tokens behave as an omitted prop
 * (2.6, T2.6-2); otherwise every token must satisfy 1.4 with `.` allowed.
 */
function tagsVerdict(value: string): TagsVerdict {
  const tokens = splitTags(value);
  for (const token of tokens) {
    const verdict = valueVerdict(token, "tag");
    if (!verdict.valid) {
      return {
        accepted: false,
        tokens,
        reason: `token ${renderCodePoints(token)} is invalid: ${verdict.reason}`,
      };
    }
  }
  return { accepted: true, tokens };
}

// --- rendering ---------------------------------------------------------------

function codePointName(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Counterexample/context rendering: the JSON escape plus the exact code
 * points, so control and boundary characters are unambiguous in failure
 * messages (JSON.stringify escapes controls but not U+00A0/U+0085/U+2028).
 */
function renderCodePoints(value: string): string {
  const points = [...value]
    .map((character) => codePointName(character.codePointAt(0)!))
    .join(" ");
  return `${JSON.stringify(value)} <${points}>`;
}

// --- the quote discipline (SPEC 2.7; module header) ----------------------------

function containsBothQuoteKinds(value: string): boolean {
  return value.includes(DOUBLE_QUOTE) && value.includes(SINGLE_QUOTE);
}

/**
 * The quote kind a draw's content admits: single quotes for a draw
 * containing `"`, double quotes otherwise — so double quotes for one
 * containing `'`, and for one containing neither (either kind would do).
 * Never asked of a draw containing both: `spellable` keeps those out.
 */
function quoteKindFor(value: string): string {
  return value.includes(DOUBLE_QUOTE) ? SINGLE_QUOTE : DOUBLE_QUOTE;
}

/**
 * Redraws `spellable` spends before repairing a draw instead. Trials are
 * bounded (H-10), and at the alphabet's quote weights a draw containing both
 * quote characters is rare enough that the bound is never reached in
 * practice.
 */
const MAX_SPELLING_REDRAWS = 32;

/**
 * Redraw while the draw contains both quote characters — such a draw admits
 * no static-string spelling and is never staged (module header) — so each
 * property keeps its trial count and every staged draw is spellable. The
 * redraws are further draws on the same tape, so replay and shrinking
 * reproduce them exactly (a shrink candidate exhausted mid-redraw is an
 * unsatisfiable tape the shrinker discards). Past the redraw bound the last
 * draw is repaired by dropping its `'` characters — a spellable draw staged
 * rather than a trial failed as a harness defect.
 */
function spellable(draw: Gen<string>): Gen<string> {
  return (choices) => {
    let value = draw(choices);
    for (let redraws = 0; containsBothQuoteKinds(value); redraws += 1) {
      if (redraws === MAX_SPELLING_REDRAWS) {
        return value.split(SINGLE_QUOTE).join("");
      }
      value = draw(choices);
    }
    return value;
  };
}

// --- generators ----------------------------------------------------------------
//
// Weighted code-point alphabet. Order is simplest-first: weightedPick shrinks
// toward the first entry, so counterexamples minimize toward plain `a`s.
// Every P-1-named boundary class is present; see the module header for the
// deliberate omissions (staging hazards, not boundary classes).

const ALPHABET: ReadonlyArray<readonly [number, string]> = [
  // Ordinary valid characters (the shrink target first).
  [24, "a"],
  [8, "b"],
  [4, "z"],
  [4, "A"],
  [4, "0"],
  [4, "9"],
  [3, "-"],
  [3, "_"],
  // Glob metacharacters of common dialects — ordinary valid segment
  // characters (P-1 names them; a product borrowing a glob or path lexer
  // would trip here).
  [2, "["],
  [2, "]"],
  [2, "{"],
  [2, "}"],
  [2, "!"],
  [2, "+"],
  [2, "("],
  [2, ")"],
  // The quote, escape, and character-reference characters and U+FFFD —
  // invalid boundary classes (SPEC 1.4). Each quote character is spellable
  // only inside the other quote kind (SPEC 2.7; the staging discipline in
  // the module header chooses the kind per draw, predicts rejection, and
  // never stages a draw holding both). `\` and `&` are staged raw inside
  // the quoted value, which SPEC 2.4 reads verbatim (no escape sequence or
  // character reference interpreted), so a draw holding one is predicted
  // rejected on the character itself. U+FFFD is staged as the literal,
  // validly encoded code point, so 14.4 — never 14.20 — is at stake.
  [3, DOUBLE_QUOTE],
  [3, SINGLE_QUOTE],
  [3, BACKSLASH],
  [3, AMPERSAND],
  [3, REPLACEMENT_CHARACTER],
  // The boundary code points SPEC 1.4 excludes from both classes — valid
  // (T1.4-2 anchors; §VIOL-VALID-WIDE's flip class): no-break space, next
  // line, line separator.
  [5, cp(0x00a0)],
  [5, cp(0x0085)],
  [5, cp(0x2028)],
  // Breadth beyond the named set: further code points a Unicode-whitespace
  // (JS regex `\s`-style) classifier would misclassify (en quad, paragraph
  // separator), plus non-ASCII and non-BMP valid characters. All valid per
  // 1.4 ("no other code point belongs to either class").
  [1, cp(0x2000)],
  [1, cp(0x2029)],
  [1, cp(0x00e9)],
  [1, cp(0x4e2d)],
  [1, cp(0x1f600)],
  // "." (the ID separator — a segment draw containing it stages as several
  // segments, a tag may contain it) and "#" (invalid everywhere).
  [4, DOT],
  [4, "#"],
  // The 1.4 whitespace class, exactly — invalid in segments; the separators
  // 2.6 splits tags on.
  [3, TAB],
  [3, LF],
  [2, VT],
  [2, FF],
  [3, CR],
  [4, SPACE],
  // Non-whitespace control representatives — invalid in segments and tags
  // (§VIOL-VALID-CTRL's flip class: U+0000–U+0008, U+000E–U+001F, U+007F).
  [3, cp(0x0000)],
  [2, cp(0x0001)],
  [2, cp(0x000e)],
  [3, cp(0x001f)],
  [3, cp(0x007f)],
];

const alphabetCharacter: Gen<string> = (choices) =>
  choices.weightedPick(ALPHABET);

/** The 1.4 whitespace characters, simplest (space) first. */
const WHITESPACE_CHARACTERS: readonly string[] = [SPACE, TAB, LF, VT, FF, CR];

/**
 * Drop every line terminator (CRLF, lone LF, lone CR) that would close a
 * blank line — a line containing only spaces/tabs — inside a staged opening
 * tag; see the module header. Deterministic and pure, so tape replay and
 * shrinking reproduce the repaired value exactly. The template lines around
 * an attribute value always carry non-blank content (`<S id=` plus the
 * opening quote, the closing quote plus `>`), so only terminator sequences
 * inside the value can form a blank line — and a prefix of a repaired value
 * (an ancestor `id` of a `.`-bearing draw) carries a subset of its
 * terminator pairs, so it is repaired too.
 */
function withoutBlankLineHazards(value: string): string {
  let out = "";
  // True while one more terminator would close a blank line: every character
  // since the last kept terminator is a space or tab (Markdown's blank-line
  // fillers; VT and FF are ordinary content to Markdown).
  let onBlankLine = false;
  let i = 0;
  while (i < value.length) {
    const character = value[i]!;
    if (character === CR || character === LF) {
      const token =
        character === CR && value[i + 1] === LF ? CR + LF : character;
      i += token.length;
      if (onBlankLine) continue; // dropped: would close a blank line
      out += token;
      onBlankLine = true;
      continue;
    }
    out += character;
    if (character !== SPACE && character !== TAB) onBlankLine = false;
    i += 1;
  }
  return out;
}

const randomSegmentCharacters: Gen<string> = (choices) =>
  listOf(alphabetCharacter, { max: 8 })(choices).join("");

const randomTokenCharacters: Gen<string> = (choices) =>
  listOf(alphabetCharacter, { max: 6 })(choices).join("");

const forbiddenName: Gen<string> = (choices) => choices.pick(FORBIDDEN_NAMES);

/** A forbidden name with one affixed character — usually a valid near-miss. */
const affixedForbiddenName: Gen<string> = (choices) => {
  const name = choices.pick(FORBIDDEN_NAMES);
  const affix = alphabetCharacter(choices);
  return choices.boolean() ? `${affix}${name}` : `${name}${affix}`;
};

/**
 * A forbidden name with its first letter upcased (`then` → `Then`): the 1.4
 * rule is an exact-string match, so the flip is valid. `$` has no letter and
 * stays forbidden; the oracle decides either way.
 */
const caseFlippedForbiddenName: Gen<string> = (choices) =>
  upcaseFirstLetter(choices.pick(FORBIDDEN_NAMES));

/** The flip itself: the first a–z letter upcased; a name without one unchanged. */
function upcaseFirstLetter(name: string): string {
  const index = [...name].findIndex((ch) => ch >= "a" && ch <= "z");
  if (index < 0) return name;
  return (
    name.slice(0, index) + name[index]!.toUpperCase() + name.slice(index + 1)
  );
}

/**
 * The alphabet's 1.4-valid segment characters at their alphabet weights —
 * the ordinary, glob, boundary, and breadth entries — selected
 * through the oracle so the two never disagree.
 */
const VALID_SEGMENT_ALPHABET: ReadonlyArray<readonly [number, string]> =
  ALPHABET.filter(([, character]) => valueVerdict(character, "segment").valid);

/** A 1–4 character piece drawn from the valid segment characters. */
const validLeaningPiece: Gen<string> = (choices) =>
  listOf((c: Choices) => c.weightedPick(VALID_SEGMENT_ALPHABET), {
    min: 1,
    max: 4,
  })(choices).join("");

/**
 * A `.`-joined chain of 2–4 pieces — each valid-leaning, or (one time in
 * four in random mode) an arbitrary segment draw — so the fixed seeds stage,
 * many times over, chains whose every level is valid (accepted, the bearer
 * nested 2–4 deep) and chains with an invalid level at an ancestor or at the
 * bearer (rejected). A random draw's own `.`s reach those shapes only
 * rarely: every level of an accepted chain must avoid every invalid class.
 */
const dottedChain: Gen<string> = (choices) =>
  listOf(
    (c: Choices) =>
      c.boolean(0.25) ? randomSegmentCharacters(c) : validLeaningPiece(c),
    { min: 2, max: 4 },
  )(choices).join(DOT);

/**
 * Segment draws: random code points, `.`-joined chains, and forbidden-name
 * shapes — an affix of `.` puts a forbidden name at one level of a
 * two-segment chain. Blank-line hazards repaired, then held spellable (a
 * draw with both quote kinds is redrawn).
 */
const segmentCandidate: Gen<string> = spellable((choices) => {
  const shape = choices.weightedPick<Gen<string>>([
    [8, randomSegmentCharacters],
    [4, dottedChain],
    [2, forbiddenName],
    [1, affixedForbiddenName],
    [1, caseFlippedForbiddenName],
  ]);
  return withoutBlankLineHazards(shape(choices));
});

/** A run of 1–3 whitespace separators (2.6 splits on runs). */
const whitespaceRun: Gen<string> = (choices) =>
  listOf((c: Choices) => c.pick(WHITESPACE_CHARACTERS), { min: 1, max: 3 })(
    choices,
  ).join("");

const tagToken: Gen<string> = (choices) => {
  const shape = choices.weightedPick<Gen<string>>([
    [8, randomTokenCharacters],
    [2, forbiddenName],
    [1, affixedForbiddenName],
  ]);
  return shape(choices);
};

/**
 * `tags` prop values: token-ish and whitespace-run pieces concatenated, so
 * the staged value covers empty and whitespace-only values (zero tokens),
 * leading/trailing whitespace, multi-character separator runs, and adjacent
 * token pieces merging — the oracle judges the final staged value only.
 * Blank-line hazards repaired, then held spellable, as for segments.
 */
const tagsValueCandidate: Gen<string> = spellable((choices) => {
  const pieces = listOf(
    (c: Choices) =>
      c.weightedPick<Gen<string>>([
        [3, tagToken],
        [2, whitespaceRun],
      ])(c),
    { max: 6 },
  )(choices);
  return withoutBlankLineHazards(pieces.join(""));
});

// --- per-trial staging and acceptance assertions -------------------------------

/**
 * A rejected build must report exactly the staged conditions: exit 1 with a
 * non-empty findings report (SPEC 12.0/14; H-5), every finding's condition
 * identity among `allowed` (SPEC 14: each present condition is reported —
 * and nothing else is present to report).
 */
function assertRejectionFindings(
  findings: readonly Finding[],
  allowed: readonly string[],
  context: string,
): void {
  if (findings.length === 0) {
    fail(
      `${context}: the findings report is empty — a rejecting \`build\` must ` +
        `report the staged violation (SPEC 14)`,
    );
  }
  for (const finding of findings) {
    if (finding.condition === null || !allowed.includes(finding.condition)) {
      fail(
        `${context}: reported condition ${JSON.stringify(finding.condition)} is not ` +
          `among the staged condition(s) ${JSON.stringify(allowed)} ` +
          `(message: ${JSON.stringify(finding.message)})`,
      );
    }
  }
}

/** Stage one value in a fresh single-source workspace and run `body`. */
async function inStagedWorkspace(
  source: string,
  body: (workspace: TestWorkspace) => Promise<void>,
): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/A.mdx": source },
  });
  try {
    await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * The source staging a segment draw: the split's prefixes spell the ancestor
 * chain (`a`, `a.b`, `a.b.c` for the draw `a.b.c`), one section per level
 * with its prefix as `id`, the bearer — the draw itself — innermost with the
 * trial's prose; a `.`-free draw is one top-level section. Every level's
 * `id` is a prefix of the draw, so it holds at most the quote kinds the draw
 * holds and the draw's quote kind spells every level.
 */
function segmentSource(segments: readonly string[], quote: string): string {
  const ids = segments.map((_, index) =>
    segments.slice(0, index + 1).join(DOT),
  );
  const opening = ids.map((id) => `<S id=${quote}${id}${quote}>${LF}`).join("");
  const closing = `</S>${LF}`.repeat(ids.length);
  return `${opening}Section under test.${LF}${closing}`;
}

/** The source staging a `tags` value: one section `sec` carrying it. */
function tagsSource(value: string, quote: string): string {
  return (
    `<S id="sec" tags=${quote}${value}${quote}>${LF}` +
    `Tagged section under test.${LF}</S>${LF}`
  );
}

// S-9's per-draw check (helpers/property.ts `mdxSources`): the one source
// each property stages, composed by the same pure functions the bodies
// stage from (module header).

function stagedSegmentSources(draw: string): DrawSource[] {
  return [
    ["specs/A.mdx", segmentSource(splitSegments(draw), quoteKindFor(draw))],
  ];
}

function stagedTagsSources(value: string): DrawSource[] {
  return [["specs/A.mdx", tagsSource(value, quoteKindFor(value))]];
}

/** The P-1 segment property body: accepted by `build` iff every segment is 1.4-valid. */
async function assertSegmentAcceptance(
  product: ProductBinding,
  draw: string,
): Promise<void> {
  const verdict = segmentsVerdict(draw);
  const quote = quoteKindFor(draw);
  const source = segmentSource(verdict.segments, quote);
  const staging =
    verdict.segments.length === 1
      ? "staged as one top-level segment"
      : `staged as ${String(verdict.segments.length)} segments, the bearer ` +
        `nested beneath the ancestor chain its prefixes spell`;
  await inStagedWorkspace(source, async (workspace) => {
    if (verdict.accepted) {
      await buildOk(
        product,
        workspace,
        `P-1: draw ${renderCodePoints(draw)} (${staging}) — every resulting ` +
          `segment satisfies SPEC 1.4, so \`build\` must accept the workspace`,
      );
      return;
    }
    const context =
      `P-1: draw ${renderCodePoints(draw)} (${staging}) violates SPEC 1.4 — ` +
      `${verdict.reason} — so \`build --json\` must reject the workspace`;
    const findings = await buildFindings(product, workspace, context);
    // A dot-free draw stages exactly one top-level single-segment ID, so
    // 14.4 is the only present condition; a dot-containing draw stages a
    // chain whose every ID from the offending level down carries the invalid
    // segment, and 14.2 and/or 14.4 report (whether an ill-formed level is
    // also read structurally is sub-segment analysis SPEC 14 does not pin).
    assertRejectionFindings(
      findings,
      verdict.segments.length === 1 ? ["14.4"] : ["14.2", "14.4"],
      context,
    );
  });
}

/** The P-1 tags property body: accepted iff every 2.6 token is 1.4-valid. */
async function assertTagsAcceptance(
  product: ProductBinding,
  value: string,
): Promise<void> {
  const verdict = tagsVerdict(value);
  const quote = quoteKindFor(value);
  const source = tagsSource(value, quote);
  await inStagedWorkspace(source, async (workspace) => {
    if (verdict.accepted) {
      await buildOk(
        product,
        workspace,
        `P-1: tags value ${renderCodePoints(value)} yields ` +
          `${String(verdict.tokens.length)} token(s), every one 1.4-valid with "." ` +
          `allowed (zero tokens behave as an omitted prop, SPEC 2.6), so \`build\` ` +
          `must accept the workspace`,
      );
      return;
    }
    const context =
      `P-1: tags value ${renderCodePoints(value)} is invalid under the 2.6 ` +
      `splitting model — ${verdict.reason} — so \`build --json\` must reject ` +
      `the workspace`;
    const findings = await buildFindings(product, workspace, context);
    assertRejectionFindings(findings, ["14.4"], context);
  });
}

// --- S-9's fixed form-vector set (module header) -------------------------------

/** The line terminators a value may hold singly (the no-blank-line rule). */
const FORM_TERMINATORS: ReadonlyArray<
  readonly [name: string, terminator: string]
> = [
  ["lone LF", LF],
  ["lone CR", CR],
  ["CRLF", CR + LF],
];

/**
 * The values the generators' shapes compose, by family: every alphabet
 * character alone and inside a value, the forbidden-name shapes (exact, at
 * either level of a chain, case-flipped), `.`-joined chains and the empty
 * segments a leading, trailing, or doubled dot yields, single line
 * terminators inside a value with the repaired blank-line hazards, and the
 * 2.6 whitespace separators, runs, and zero-token values.
 */
const P1_FORM_VALUES: ReadonlyArray<readonly [family: string, value: string]> =
  [
    ...ALPHABET.flatMap(([, character]): (readonly [string, string])[] => [
      ["alphabet character alone", character],
      ["alphabet character inside a value", `a${character}b`],
    ]),
    ...FORBIDDEN_NAMES.flatMap((name): (readonly [string, string])[] => [
      ["forbidden name", name],
      ["forbidden name at the first level of a chain", `${name}${DOT}a`],
      ["forbidden name at the last level of a chain", `a${DOT}${name}`],
      ...(upcaseFirstLetter(name) === name
        ? []
        : [["case-flipped forbidden name", upcaseFirstLetter(name)] as const]),
    ]),
    ["chain of two valid pieces", `ab${DOT}c1`],
    ["chain of four valid pieces", `a${DOT}b-${DOT}_9${DOT}zA`],
    ["leading dot (an empty first segment)", `${DOT}a`],
    ["trailing dot (an empty last segment)", `a${DOT}`],
    ["doubled dot (an empty middle segment)", `a${DOT}${DOT}b`],
    ...FORM_TERMINATORS.flatMap(
      ([name, terminator]): (readonly [string, string])[] => [
        [`${name} between characters`, `a${terminator}b`],
        [`${name} leading`, `${terminator}a`],
        [`${name} trailing`, `a${terminator}`],
        [`${name} before an indented continuation`, `a${terminator} ${TAB}b`],
        [
          `${name} doubled, repaired`,
          withoutBlankLineHazards(`a${terminator}${terminator}b`),
        ],
        [
          `${name} around a spaces-only line, repaired`,
          withoutBlankLineHazards(`a${terminator} ${terminator}b`),
        ],
        [
          `${name} alone, doubled and repaired`,
          withoutBlankLineHazards(`${terminator}${terminator}`),
        ],
      ],
    ),
    ["mixed terminators between characters", `a${LF}b${CR}c${CR}${LF}d`],
    ["lone LF then lone CR, repaired", withoutBlankLineHazards(`a${LF}${CR}b`)],
    ...WHITESPACE_CHARACTERS.flatMap((ws): (readonly [string, string])[] => {
      const name = codePointName(ws.codePointAt(0)!);
      return [
        [`${name} as a separator`, `a${ws}b`],
        [`${name} leading and trailing`, `${ws}a${ws}`],
        [`${name} alone (zero tokens)`, ws],
      ];
    }),
    ["a whitespace run as a separator", `a${SPACE}${TAB}${VT}${FF}b`],
    ["a whitespace run alone (zero tokens)", `${SPACE}${SPACE}${TAB}`],
    ["the empty value (zero tokens)", ""],
  ];

/**
 * The quote kinds a value admits (module header): the other kind for a
 * value holding one quote character, either kind for one holding neither —
 * `quoteKindFor`'s choice first.
 */
function admissibleQuoteKinds(value: string): readonly string[] {
  if (containsBothQuoteKinds(value)) return [];
  const chosen = quoteKindFor(value);
  if (value.includes(DOUBLE_QUOTE) || value.includes(SINGLE_QUOTE)) {
    return [chosen];
  }
  return [chosen, chosen === DOUBLE_QUOTE ? SINGLE_QUOTE : DOUBLE_QUOTE];
}

function quoteKindName(quote: string): string {
  return quote === DOUBLE_QUOTE ? "double" : "single";
}

/**
 * The fixed form-vector set of the P-1 generators (S-9): each value above
 * staged as a segment draw (its `.`-split spelling the ancestor chain) and
 * as a `tags` value, in every admissible quote kind — name and source.
 */
export const P1_FORM_VECTORS: ReadonlyArray<
  readonly [name: string, source: string]
> = P1_FORM_VALUES.flatMap(([family, value]) =>
  admissibleQuoteKinds(value).flatMap(
    (quote): (readonly [string, string])[] => [
      [
        `segment draw, ${family}: ${renderCodePoints(value)}, ` +
          `${quoteKindName(quote)} quotes`,
        segmentSource(splitSegments(value), quote),
      ],
      [
        `tags value, ${family}: ${renderCodePoints(value)}, ` +
          `${quoteKindName(quote)} quotes`,
        tagsSource(value, quote),
      ],
    ],
  ),
);

// --- the registered property test ----------------------------------------------

const P_1 = defineProductTest({
  id: "P-1",
  title:
    "property: a generated segment draw, staged as the segments its `.`s split it " +
    "into (the bearer nested beneath the ancestor chain the split's prefixes " +
    "spell), is accepted by `build` iff every resulting segment satisfies SPEC " +
    "1.4; a generated `tags` value is accepted iff every 2.6-split token " +
    "satisfies 1.4 with `.` allowed, zero tokens behaving as an omitted prop; " +
    "each draw spelled in the quote kind its content admits, one holding both " +
    "never staged (SPEC 1.3, 1.4, 2.6, 2.7; TEST-SPEC §16 P-1)",
  // Wall-clock hang guard only (H-10): two properties, three fixed seeds each
  // (E-5), one workspace and one build subprocess per trial, plus the shrink
  // budget on falsification.
  timeoutMs: 240_000,
  run: async (product) => {
    await checkProperty(
      "P-1 segment validity",
      segmentCandidate,
      async (draw) => {
        await assertSegmentAcceptance(product, draw);
      },
      { render: renderCodePoints, mdxSources: stagedSegmentSources },
    );
    await checkProperty(
      "P-1 tag validity",
      tagsValueCandidate,
      async (value) => {
        await assertTagsAcceptance(product, value);
      },
      { render: renderCodePoints, mdxSources: stagedTagsSources },
    );
  },
});

/** TEST-SPEC §16 P-1 (PROP-01). */
export const section16P1Tests: readonly ProductTestEntry[] = [P_1];
