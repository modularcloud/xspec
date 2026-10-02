// Self-checks for the S-9 derivability check (`test/helpers/mdx-derivability.ts`;
// TEST-SPEC 17 S-9 — certification cannot exercise this class, so what is
// verified here is the check itself against the document's own declarations).
// SPEC 14.20 fixes the grammar: MDX syntax at major version 3, decided by
// derivability alone. Every shape TEST-SPEC works through as well-formed must
// derive — T3-3's multi-line-tag arms and its U+2028 ESM arm, T6.2-3's worked
// and U+000B/U+000C shapes, T6.2-4's pinned shapes, T2.1-6's ESM block inside
// a section, T3-7's comment forms, T14-12's positive arms, the composed
// forms of T6.5-13/T6.5-19, and every composed form T6.5-2 asserts as a
// performed move's result — and every shape the document declares
// unparseable must not: a leading byte-order mark, invalid UTF-8, an unclosed
// tag, a text-position tag closed by a flow tag on a later line (the former
// stagings of T3-1's `gamma` and of T6.2-3's impure origin, spelled exactly;
// their restaged sources are judged verbatim from the registry modules, with
// the two files T6.2-3's move leaves), the empty attribute expressions, the
// spread with extra
// content, an ESM block holding a statement, the one-sided section spellings
// 6.2/6.5 refuse, and T14-12's negative arms (the document's shapes below,
// and the staged sources themselves from section-14-iii.ts, whose pinned
// offsets the stock parser's positions confirm wherever they coincide).
// S-9's allowances — ECMAScript's
// early errors, which the stock parser enforces beyond derivability — apply
// only when named and only to their own early error; none passes an
// MDX-syntax rejection. Every non-ASCII or control character is built from
// its code point.

import { Buffer } from "node:buffer";
import * as acorn from "acorn";
import ts from "typescript-5.9.3";
import { describe, expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  MDX_ALLOWANCES,
  deriveMdx,
  type MdxAllowance,
} from "../helpers/mdx-derivability.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import { TestWorkspace, type WorkspaceDecl } from "../helpers/workspace.js";
import { REMOVALS_SOURCE, T3_7_SOURCE } from "../suite/registry/section-3.js";
import { P1_FORM_VECTORS } from "../suite/registry/section-16-p1.js";
import { P2_P3_FORM_VECTORS } from "../suite/registry/section-16-p2-p3.js";
import { P4_FORM_VECTORS } from "../suite/registry/section-16-p4.js";
import { P5_FORM_VECTORS } from "../suite/registry/section-16-p5-p6.js";
import { P7_FORM_VECTORS } from "../suite/registry/section-16-p7.js";
import { P9_FORM_VECTORS } from "../suite/registry/section-16-p9.js";
import { P12_FORM_VECTORS } from "../suite/registry/section-16-p12.js";
import { P13_FORM_VECTORS } from "../suite/registry/section-16-p13.js";
import {
  I3_HALL_MOVED_SOURCE,
  I3_ROOM_MOVED_SOURCE,
  I3_ROOM_SOURCE,
} from "../suite/registry/section-6.2.js";
import { X2_COMPOSED_FORMS } from "../suite/registry/section-6.5.js";
import {
  T14_12_FORM_VECTORS,
  T14_12_UNPARSEABLE_VECTORS,
} from "../suite/registry/section-14-iii.js";
import {
  A18_FORM_VECTORS,
  A19_FORM_VECTORS,
  A19_UNDERIVABLE_VECTORS,
  J15_FORM_VECTORS,
  M17_FORM_VECTORS,
  R16_FORM_VECTORS,
  R16_REFUSED_VECTORS,
} from "../suite/registry/section-6.5-iii.js";

const LF = String.fromCodePoint(0x000a);
const CR = String.fromCodePoint(0x000d);
const VT = String.fromCodePoint(0x000b);
const FF = String.fromCodePoint(0x000c);
const LS = String.fromCodePoint(0x2028);
const BOM = String.fromCodePoint(0xfeff);
const ASTRAL = String.fromCodePoint(0x1f600);

/** acorn's identifier tables and whitespace list: runtime exports its
 * declarations leave out. */
const ACORN = acorn as unknown as {
  readonly isIdentifierStart: (code: number, astral?: boolean) => boolean;
  readonly isIdentifierChar: (code: number, astral?: boolean) => boolean;
  readonly nonASCIIwhitespace: RegExp;
};

/** Lines joined by U+000A, the last one terminated. */
const doc = (...lines: readonly string[]): string => lines.join(LF) + LF;

const GAMMA_OPENING = '<S id="gamma">Gamma keeps this line.';

/**
 * T3-1's `specs/A.mdx` as formerly staged: the registry staging's head, up to
 * `gamma`, verbatim, then the former `gamma` region — a text-position tag
 * with same-line content whose closing tag stood alone at a line's start
 * after the second fence, a flow tag that interrupts the paragraph and leaves
 * the in-line element unclosed (T3-3's staging constraint). The staging now
 * closes `gamma` within its paragraph, at the end of the code-span line, the
 * fence following at top level.
 */
function formerRemovalsSource(): string {
  const at = REMOVALS_SOURCE.indexOf(GAMMA_OPENING);
  if (at <= 0) {
    throw new Error(
      "T3-1's staged specs/A.mdx no longer opens `gamma` as expected",
    );
  }
  return (
    REMOVALS_SOURCE.slice(0, at) +
    doc(
      GAMMA_OPENING,
      "More gamma prose.",
      'Inline code span: `<S id="x">{text("a")}` stays literal.',
      "```md",
      '<S id="x">',
      'import X from "./X.xspec"',
      '{text("a")}',
      "```",
      "</S>",
    )
  );
}

function expectDerives(
  source: string | Uint8Array,
  allowances?: readonly MdxAllowance[],
): void {
  expect(
    deriveMdx(source, allowances === undefined ? undefined : { allowances }),
  ).toEqual({ derives: true });
}

function expectRejects(
  source: string | Uint8Array,
  allowances?: readonly MdxAllowance[],
): {
  reason: string;
  position?: { line: number; column: number; offset: number };
} {
  const verdict = deriveMdx(
    source,
    allowances === undefined ? undefined : { allowances },
  );
  expect(verdict.derives).toBe(false);
  if (verdict.derives) throw new Error("unreachable");
  expect(verdict.reason.length).toBeGreaterThan(0);
  return verdict;
}

// ---------------------------------------------------------------------------
// Well-formed shapes the document works through.

const WELL_FORMED: ReadonlyArray<readonly [name: string, source: string]> = [
  // T3-3's multi-line opening tags (S-9 gates the shapes).
  ["T3-3 own-lines drop form", doc("<S", '  id="x"', ">", "body", "</S>")],
  [
    "T3-3 in-line kept form",
    doc("foo <S", '  id="x"', '  coverage="required"> bar</S>'),
  ],
  ["T3-3 flow-start kept form", doc("<S", '  id="x"', "> bar</S>")],
  // T3-3's ESM arm: two imports on one physical line separated by U+2028.
  [
    "T3-3 U+2028-separated imports",
    doc(
      `import A from "./A.xspec"${LS}import B from "./B.xspec"`,
      "",
      "{text(A.a)} {text(B.b)}",
    ),
  ],
  // T6.2-3's worked shape and its U+000B/U+000C spellings, at the origin and
  // as moved text at a line's start.
  ["T6.2-3 (a) worked shape", doc('foo <S id="m">', "body", "  </S> bar")],
  ["T6.2-3 (a) moved text", doc('<S id="m">', "body", "  </S>")],
  [
    "T6.2-3 (b) both-sided U+000C",
    doc(`foo <S id="m">${FF}`, "body", `${FF}</S> bar`),
  ],
  [
    "T6.2-3 (b) both-sided U+000B",
    doc(`foo <S id="m">${VT}`, "body", `${VT}</S> bar`),
  ],
  ["T6.2-3 (b) moved text U+000C", doc(`<S id="m">${FF}`, "body", `${FF}</S>`)],
  ["T6.2-3 (b) moved text U+000B", doc(`<S id="m">${VT}`, "body", `${VT}</S>`)],
  [
    "T6.2-3 (c) body</S> with U+000C remainder",
    doc(`foo <S id="m">${FF}`, "body</S>"),
  ],
  [
    "T6.2-3 (c) body</S> with U+000B remainder",
    doc(`foo <S id="m">${VT}`, "body</S>"),
  ],
  ["T6.2-3 (c) moved text", doc(`<S id="m">${FF}`, "body</S>")],
  [
    "T6.2-3 in-line variant on one line",
    doc(`foo <S id="m">${VT}body${FF}</S> bar`),
  ],
  // T6.2-3 (d): two in-line siblings on a paragraph line inside a flow parent,
  // and the sibling left alone on its line after the move (a flow element).
  [
    "T6.2-3 (d) origin",
    doc('<S id="p">', '<S id="p.s"> </S><S id="p.m">text</S>', "</S>"),
  ],
  ["T6.2-3 (d) after the move", doc('<S id="p">', '<S id="p.s"> </S>', "</S>")],
  // T6.2-4's pinned final-position shapes and the `changed` twin.
  [
    "T6.2-4 flow-form last child",
    doc('<S id="p">', '<S id="p.m">', "y", "</S>", "</S>"),
  ],
  [
    "T6.2-4 twin (T6.5-13(e)) before",
    doc('foo <S id="p">', '<S id="p.m">x</S></S> baz'),
  ],
  [
    "T6.2-4 twin composed",
    doc('foo <S id="p">', '<S id="p.n">x</S>', "</S> baz"),
  ],
  // T2.1-6: an ESM block inside a section element, blank lines around it.
  [
    "T2.1-6 ESM block inside a section",
    doc(
      '<S id="m">',
      "",
      'import X from "./X.xspec"',
      "",
      "body {text(X.a)}",
      "</S>",
    ),
  ],
  // T3-7: JavaScript comments beside imports in one ESM block; a `;`-terminated import.
  [
    "T3-7 ESM-block comments",
    doc(
      'import A from "./A.xspec" // note',
      "// note",
      '/* c */ import B from "./B.xspec"',
      'import C from "./C.xspec";',
      "",
      "{text(A.a)} {text(B.b)} {text(C.c)}",
    ),
  ],
  // T14-12's positive arms under the expression grammar alone.
  ["T14-12 comma sequence", doc("{a, b}")],
  [
    "T14-12 comma sequence in d",
    doc('<S id="x" d={BASE.a, BASE.b}>', "", "body", "", "</S>"),
  ],
  ["T14-12 await admitted", doc("{await x}")],
  ["T14-12 no statement lookahead restriction", doc("{function(){}}")],
  [
    "T14-12 parenthesised spread operand",
    doc('<S id="x" {...(a, b)}>', "", "body", "", "</S>"),
  ],
  ["T14-12 export declaration holding JSX", doc("export const x = <b/>")],
  // Composed forms T6.5-13 and T6.5-19 name as deriving (the fresh identifier
  // spelled `X` here; the moved text T6.5-13(h)'s clean-boundary section).
  [
    "T6.5-13 (a) declaration appended after the final terminator",
    doc(
      '<S id="p">',
      "x",
      '<S id="p.n">',
      "moved {text(X.a)}",
      "</S>",
      "</S>",
      'import X from "./x.xspec"',
    ),
  ],
  [
    "T6.5-13 (a) sibling: declaration at an empty line's start",
    [
      '<S id="p">',
      "x",
      '<S id="p.n">',
      "moved {text(X.a)}",
      "</S>",
      "</S>",
      'import X from "./x.xspec"',
      "",
      "trailing",
    ].join(LF),
  ],
  [
    "T6.5-13 (b) self-closing target rewritten",
    doc(
      '<S id="p">',
      '<S id="p.n">',
      "moved {text(X.a)}",
      "</S>",
      "</S>",
      'import X from "./x.xspec"',
    ),
  ],
  [
    "T6.5-13 (d) top-level after an unterminated paragraph line",
    doc(
      "para",
      '<S id="n">',
      "moved {text(X.a)}",
      "</S>",
      'import X from "./x.xspec"',
    ),
  ],
  [
    "T6.5-19 (a) block inside the section derives (inadmissible, not ill-formed)",
    [
      '<S id="p">',
      'import X from "./x.xspec"',
      "",
      "x",
      '<S id="p.n">',
      "moved {text(X.a)}",
      "</S>",
      "</S>",
    ].join(LF),
  ],
  [
    "T6.5-19 (a) result",
    doc(
      '<S id="p">',
      "",
      "x",
      '<S id="p.n">',
      "moved {text(X.a)}",
      "</S>",
      "</S>",
      'import X from "./x.xspec"',
    ),
  ],
  // Deterministic fixtures judged verbatim from their registry modules:
  // T3-1's specs/A.mdx (`gamma` an in-line section closed within its
  // paragraph, the second fence at top level), T3-7's specs/main.mdx (four
  // ESM blocks carrying JavaScript comments beside their imports and a
  // `;`-terminated declaration), and T6.2-3's impure origin in
  // 6.2's worked shape, with the two files its move leaves (SPEC 6.5).
  ["T3-1 specs/A.mdx as staged", REMOVALS_SOURCE],
  ["T3-7 specs/main.mdx as staged", T3_7_SOURCE],
  ["T6.2-3 impure origin specs/Room.mdx as staged", I3_ROOM_SOURCE],
  ["T6.2-3 impure origin after the move", I3_ROOM_MOVED_SOURCE],
  ["T6.2-3 impure destination after the move", I3_HALL_MOVED_SOURCE],
  // Boundary forms that derive without any allowance.
  ["a leading empty line", doc("", '<S id="m">', "body", "</S>")],
  [
    "a CRLF-terminated file",
    `<S id="m">${CR}${LF}body${CR}${LF}</S>${CR}${LF}`,
  ],
  ["a bare empty expression container", doc("{}")],
  ["a fragment", doc("<>", "", "x", "", "</>")],
];

describe("S-9: the document's well-formed shapes derive", () => {
  test.each(WELL_FORMED)("%s", (_name, source) => {
    expectDerives(source);
    expectDerives(Buffer.from(source, "utf8"));
  });
});

// ---------------------------------------------------------------------------
// The generators' fixed form vectors (S-9: "every form P-2, P-3, and P-5's
// generators compose … in the fixed vector set of those forms") — each
// enumerated form as its generator module spells it, judged here before any
// product exists; each draw is judged the same way at property time
// (helpers/property.ts `mdxSources`).

describe("S-9: every form the P-2/P-3 generator composes derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(P2_P3_FORM_VECTORS.length).toBeGreaterThan(100);
    expect(new Set(P2_P3_FORM_VECTORS.map(([name]) => name)).size).toBe(
      P2_P3_FORM_VECTORS.length,
    );
  });
  test.each(P2_P3_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

describe("S-9: every form the PROP-03 rendering (P-4, P-5, P-6) composes derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(P4_FORM_VECTORS.length).toBeGreaterThan(2);
    expect(new Set(P4_FORM_VECTORS.map(([name]) => name)).size).toBe(
      P4_FORM_VECTORS.length,
    );
  });
  test.each(P4_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

describe("S-9: every decorated form the P-5 section-move staging composes derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(P5_FORM_VECTORS.length).toBeGreaterThan(40);
    expect(new Set(P5_FORM_VECTORS.map(([name]) => name)).size).toBe(
      P5_FORM_VECTORS.length,
    );
  });
  test.each(P5_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// The generators S-9's letter leaves to the per-draw check alone get the
// same fixed vector set (the §16 preamble: every generated workspace is
// valid by construction, S-9 verifying before any product exists that every
// composed form derives): P-1's accepted and rejected draws alike — every
// alphabet character, the forbidden-name shapes, the `.`-chains, single
// line terminators inside a value, the 2.6 whitespace runs — as segment
// draws and as `tags` values in every admissible quote kind.
describe("S-9: every form the P-1 segment and tags stagings compose derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(P1_FORM_VECTORS.length).toBeGreaterThan(400);
    expect(new Set(P1_FORM_VECTORS.map(([name]) => name)).size).toBe(
      P1_FORM_VECTORS.length,
    );
  });
  test.each(P1_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

describe("S-9: every form the P-7 discovery and capture stagings compose derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(P7_FORM_VECTORS.length).toBe(4);
    expect(new Set(P7_FORM_VECTORS.map(([name]) => name)).size).toBe(
      P7_FORM_VECTORS.length,
    );
  });
  test.each(P7_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

describe("S-9: every form the P-9 rendering composes, initially and after each edit class, derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(P9_FORM_VECTORS.length).toBe(8);
    expect(new Set(P9_FORM_VECTORS.map(([name]) => name)).size).toBe(
      P9_FORM_VECTORS.length,
    );
  });
  test.each(P9_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// P-12's workspaces are valid by construction (TEST-SPEC §16 preamble): no
// draw is declared unparseable, so every vector — the every-form file and
// each form's minimal context, with and without the import, each placed
// where the generator may compose it — must derive.
describe("S-9: every form the P-12 generator composes derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(P12_FORM_VECTORS.length).toBe(44);
    expect(new Set(P12_FORM_VECTORS.map(([name]) => name)).size).toBe(
      P12_FORM_VECTORS.length,
    );
  });
  test.each(P12_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

describe("S-9: every form the P-13 rendering composes derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(P13_FORM_VECTORS.length).toBe(3);
    expect(new Set(P13_FORM_VECTORS.map(([name]) => name)).size).toBe(
      P13_FORM_VECTORS.length,
    );
  });
  test.each(P13_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// T6.5-2's byte-exact arms pin each geometry's composed text as a performed
// move's result (TEST-SPEC T6.5-2: "the composed form deriving (S-9)"); an
// expectation the parser rejects would bless a text SPEC 6.5 refuses
// (`refused-invalid-rewrite`, T6.5-16) — as the former mid-line arm did, its
// composed target listed among the unparseable shapes below.
describe("S-9: every composed form T6.5-2 asserts as a move's result derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(X2_COMPOSED_FORMS.length).toBeGreaterThan(8);
    expect(new Set(X2_COMPOSED_FORMS.map(([name]) => name)).size).toBe(
      X2_COMPOSED_FORMS.length,
    );
  });
  test.each(X2_COMPOSED_FORMS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// T6.5-15's stagings and composed expectations: every origin and target as
// staged and as the joint import-removal judgment and the move leave it (the
// kept block headed by a declaration at its first line's start, or emptied).
describe("S-9: every form T6.5-15 stages or asserts as a move's result derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(J15_FORM_VECTORS.length).toBe(20);
    expect(new Set(J15_FORM_VECTORS.map(([name]) => name)).size).toBe(
      J15_FORM_VECTORS.length,
    );
  });
  test.each(J15_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// T6.5-16's stagings, the deriving side of each refused rewrite (the other
// rewritten file as 6.5's edits would leave it), and each control's composed
// expectation: every one must derive, while every would-be text the entry
// refuses — the concerned file as the exact edits would leave it — must not,
// the ground of `refused-invalid-rewrite` (SPEC 6.5, 14.20).
describe("S-9: every form T6.5-16 stages, or asserts as a control's result or a refused rewrite's deriving side, derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(R16_FORM_VECTORS.length).toBe(162);
    expect(new Set(R16_FORM_VECTORS.map(([name]) => name)).size).toBe(
      R16_FORM_VECTORS.length,
    );
  });
  test.each(R16_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// T14-12's positive arms as staged (section-14-iii.ts): every spec source
// derives under exactly the S-9 allowance its early-error form names —
// `duplicate-import-binding`, `undefined-export`,
// `invalid-assignment-target`, `let-as-identifier`, `legacy-octal` — and
// the expression-grammar forms plainly (SPEC 14.20: a finding in a
// well-formed file, never a parse failure).
describe("S-9: every form T14-12's positive arms stage derives under exactly its named allowances", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(T14_12_FORM_VECTORS.length).toBeGreaterThan(12);
    expect(new Set(T14_12_FORM_VECTORS.map(([name]) => name)).size).toBe(
      T14_12_FORM_VECTORS.length,
    );
  });
  test.each(T14_12_FORM_VECTORS)("%s", (_name, source, allowances) => {
    expectDerives(source, allowances.length === 0 ? undefined : allowances);
    if (allowances.length > 0) {
      // The allowance is load-bearing: without it the form does not derive.
      expectRejects(source);
    }
  });
});

// T14-12's negative arms in a spec source (section-14-iii.ts): each staged
// text is declared unparseable, and where the stock parser's rejection
// position coincides with the offset SPEC 14's rule fixes — every arm but
// the spread's, whose extra content the parser reports past the comma — the
// pinned byte offset is confirmed against it (the parser's position is an
// index into the decoded text, converted to the byte length of the prefix).
describe("S-9: every form T14-12's negative arms stage in a spec source does not derive", () => {
  test("the vector set is complete and uniquely named", () => {
    expect(T14_12_UNPARSEABLE_VECTORS.length).toBe(6);
    expect(new Set(T14_12_UNPARSEABLE_VECTORS.map(([name]) => name)).size).toBe(
      T14_12_UNPARSEABLE_VECTORS.length,
    );
    expect(
      T14_12_UNPARSEABLE_VECTORS.filter(([, , offset]) => offset !== null)
        .length,
    ).toBe(5);
  });
  test.each(T14_12_UNPARSEABLE_VECTORS)("%s", (_name, source, offset) => {
    const verdict = expectRejects(source);
    expectRejects(Buffer.from(source, "utf8"));
    // No allowance makes an MDX-syntax rejection pass.
    expectRejects(source, MDX_ALLOWANCES);
    if (offset !== null) {
      expect(verdict.position).toBeDefined();
      expect(
        Buffer.byteLength(source.slice(0, verdict.position?.offset), "utf8"),
      ).toBe(offset);
    }
  });
});

describe("S-9: every would-be text T6.5-16 refuses does not derive", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(R16_REFUSED_VECTORS.length).toBe(38);
    expect(new Set(R16_REFUSED_VECTORS.map(([name]) => name)).size).toBe(
      R16_REFUSED_VECTORS.length,
    );
  });
  test.each(R16_REFUSED_VECTORS)("%s", (_name, source) => {
    expectRejects(source);
    // No allowance makes an MDX-syntax rejection pass.
    expectRejects(source, MDX_ALLOWANCES);
  });
});

// T6.5-17 stages T2.1-6's in-section ESM block as the moved text of a
// refused move (each staged file valid and deriving, 14.20) and, for its
// control, composes the origin as the deletion leaves it and the target with
// the moved text and the added declaration after its closing tag: every one
// must derive (SPEC 6.5, 14.20).
describe("S-9: every form T6.5-17 stages, or asserts as its control's result, derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(M17_FORM_VECTORS.length).toBe(18);
    expect(new Set(M17_FORM_VECTORS.map(([name]) => name)).size).toBe(
      M17_FORM_VECTORS.length,
    );
  });
  test.each(M17_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// T6.5-18 (section-6.5-iii.ts): the origin and target as staged and as the
// move leaves them — the origin opening with its kept blank line's
// terminator after the deletion's line drop, the moved text appended to the
// target after its final terminator: every one must derive (SPEC 6.5, 3).
describe("S-9: every form T6.5-18 stages or asserts as the move's result derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(A18_FORM_VECTORS.length).toBe(4);
    expect(new Set(A18_FORM_VECTORS.map(([name]) => name)).size).toBe(
      A18_FORM_VECTORS.length,
    );
  });
  test.each(A18_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// T6.5-19 (section-6.5-iii.ts): each arm's stagings, the receiving file as
// every other edit leaves it, and the entry's named offsets that derive —
// the in-section forms at the interior empty line's start and at the tag
// line's end (deriving, yet excluded by 6.5), the paragraph-text forms, and
// the result at the file's end: every one must derive, the exclusion, not
// derivability, deciding the in-section ones (SPEC 6.5, 14.20).
describe("S-9: every form T6.5-19 stages, composes, or names as deriving derives", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(A19_FORM_VECTORS.length).toBe(18);
    expect(new Set(A19_FORM_VECTORS.map(([name]) => name)).size).toBe(
      A19_FORM_VECTORS.length,
    );
  });
  test.each(A19_FORM_VECTORS)("%s", (_name, source) => {
    expectDerives(source);
  });
});

// The offsets T6.5-19 names as absorbing the line after them — offset 0,
// the start of the body line, and (a)'s insertion point after the moved
// text — head a block that runs on into a tag or prose line: none derives.
describe("S-9: every absorbing offset T6.5-19 names does not derive", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(A19_UNDERIVABLE_VECTORS.length).toBe(5);
    expect(new Set(A19_UNDERIVABLE_VECTORS.map(([name]) => name)).size).toBe(
      A19_UNDERIVABLE_VECTORS.length,
    );
  });
  test.each(A19_UNDERIVABLE_VECTORS)("%s", (_name, source) => {
    expectRejects(source);
    // No allowance makes an MDX-syntax rejection pass.
    expectRejects(source, MDX_ALLOWANCES);
  });
});

// ---------------------------------------------------------------------------
// Declared-unparseable shapes.

const UNPARSEABLE: ReadonlyArray<readonly [name: string, source: string]> = [
  ["an unclosed tag", doc('<S id="x">')],
  ["a mismatched closing tag", doc('<S id="x">', "", "</T>")],
  // The former stagings of T3-1's `gamma` and of T6.2-3's impure origin: a
  // text-position tag with same-line content whose closing tag stood alone at
  // a later line's start — a flow tag that interrupts the paragraph and leaves
  // the in-line element unclosed (T3-3's staging constraint).
  ["T3-1's former specs/A.mdx", formerRemovalsSource()],
  [
    "T6.2-3's former impure origin",
    doc(
      '<S id="op">',
      "Op holder text.",
      "",
      'Lead-in prose.<S id="op.imp" coverage="none" tags="edge imp">  ',
      "Impure line one.",
      "Impure line two.",
      "</S>",
      "</S>",
    ),
  ],
  [
    "a text-position tag closed on a later line",
    doc('foo <S id="x"> bar', "", "</S>"),
  ],
  // T3-3's staging constraint: an in-line tag cannot end on a bare `>` line.
  [
    "T3-3 in-line tag ending on a bare > line",
    doc("foo <S", '  id="x"', "> bar</S>"),
  ],
  // 14.20: the braces of an attribute value admit no empty expression.
  ["d={}", doc('<S id="x" d={}>', "", "body", "", "</S>")],
  ["d={ /* c */ }", doc('<S id="x" d={ /* c */ }>', "", "body", "", "</S>")],
  [
    "a spread with extra content",
    doc('<S id="x" {...a, b}>', "", "body", "", "</S>"),
  ],
  ["a self-closing spread with extra content", doc('<S id="x" {...a, b} />')],
  // A JavaScript syntax error inside an ESM block (the block runs to a blank line).
  [
    "let x = ; in an ESM block",
    doc('import { a } from "./a.mdx";', "let x = ;"),
  ],
  ["export let x = ;", doc("export let x = ;")],
  // The one-sided U+000B/U+000C spellings of the worked shape (T6.2-3,
  // T6.5-16): the moved text at a line's start does not derive.
  [
    "one-sided U+000C after the opening tag",
    doc(`<S id="m">${FF}`, "body", "</S>"),
  ],
  [
    "one-sided U+000C before the closing tag",
    doc('<S id="m">', "body", `${FF}</S>`),
  ],
  [
    "one-sided U+000B after the opening tag",
    doc(`<S id="m">${VT}`, "body", "</S>"),
  ],
  [
    "one-sided U+000B before the closing tag",
    doc('<S id="m">', "body", `${VT}</S>`),
  ],
  // The `body</S>` variant with an empty, space, or tab remainder: a flow tag
  // the closing tag inside the following paragraph cannot close.
  ["body</S> with an empty remainder", doc('<S id="m">', "body</S>")],
  ["body</S> with a space remainder", doc('<S id="m"> ', "body</S>")],
  [
    "body</S> with a tab remainder",
    doc(`<S id="m">${String.fromCodePoint(0x0009)}`, "body</S>"),
  ],
  // T14-12's negative arms in a spec source.
  [
    "T14-12 an ESM block holding a statement",
    doc('import A from "./A.xspec"', "const x = 1"),
  ],
  [
    "T14-12 import attributes",
    doc('import A from "./A.xspec" with { type: "json" }'),
  ],
  ["T14-12 d={]}", doc('<S id="x" d={]}>', "", "body", "", "</S>")],
  ["T14-12 {text(}", doc("{text(}")],
  ["T14-12 an unbalanced brace at the file's end", '{text("a")'],
  // T6.5-13 (b): an addition at offset 0 would absorb the tag's line.
  [
    "an import line directly followed by a tag line",
    doc('import X from "./x.xspec"', '<S id="p" />'),
  ],
  // T6.5-16 (c): a flow-form section — its tags alone on their lines —
  // inside a text-position parent: the opening tag's line interrupts the
  // paragraph holding the parent's opening tag, which is then never closed
  // (T3-3's staging constraint). T6.5-2's former mid-line arm asserted
  // exactly this composed target as a performed move's result.
  [
    "a flow-form section inside a text-position parent (T6.5-2's former mid-line arm)",
    doc(
      '<S id="c">Gamma holder.',
      '<S id="c.mv">',
      "Moved text.",
      "</S>",
      "</S>",
    ),
  ],
  // T6.5-16(d)'s setext remainder: the deletion leaves `===` under the
  // paragraph holding the parent's text-position opening tag, a setext
  // heading ending while the element opened inside it is still open. The
  // parser's development build (the `development` export condition Vitest
  // resolves) trips its stack-consistency assertion here before the
  // element-matching rejection the production build raises; `deriveMdx`
  // reports that assertion as the non-derivation it is.
  [
    "setext underline under a text-position parent's opening tag",
    doc('foo <S id="p">bar', "===", "</S> baz"),
  ],
];

describe("S-9: declared-unparseable shapes do not derive", () => {
  test.each(UNPARSEABLE)("%s", (_name, source) => {
    expectRejects(source);
    expectRejects(Buffer.from(source, "utf8"));
    // No allowance makes an MDX-syntax rejection pass.
    expectRejects(source, MDX_ALLOWANCES);
  });

  test("a rejection carries the parser's reason and position", () => {
    const verdict = expectRejects(doc('<S id="x">', "", "</T>"));
    expect(verdict.reason).toContain("mdast-util-mdx-jsx");
    expect(verdict.position).toEqual({ line: 3, column: 1, offset: 12 });
  });
});

describe("S-9: encoding rules of 14.20 the parser does not apply", () => {
  test("a leading byte-order mark is a non-derivation (bytes)", () => {
    const verdict = expectRejects(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(doc("# x"), "utf8"),
      ]),
    );
    expect(verdict.reason).toContain("byte-order mark");
    expect(verdict.position).toEqual({ line: 1, column: 1, offset: 0 });
  });

  test("a leading U+FEFF in decoded content is its byte-order mark (string)", () => {
    expect(expectRejects(BOM + doc("# x")).reason).toContain("byte-order mark");
    // A U+FEFF elsewhere is content (ECMAScript whitespace between braces).
    expectDerives(doc(`# x ${BOM}y`));
    expectDerives(doc(`{${BOM}1}`));
  });

  test.each([
    ["41 E2 82 41", [0x41, 0xe2, 0x82, 0x41], 1],
    ["C0 80 (overlong)", [0xc0, 0x80], 0],
    ["ED A0 80 (surrogate)", [0xed, 0xa0, 0x80], 0],
    ["41 E2 82 at EOF (truncated)", [0x41, 0xe2, 0x82], 1],
    [
      "43 61 66 C3 A9 FF (a valid 5-byte prefix then FF)",
      [0x43, 0x61, 0x66, 0xc3, 0xa9, 0xff],
      5,
    ],
    ["F4 90 80 80 (above U+10FFFF)", [0xf4, 0x90, 0x80, 0x80], 0],
    ["a stray continuation byte", [0x41, 0x0a, 0x80], 2],
  ])(
    "invalid UTF-8 %s is a non-derivation at its byte offset",
    (_name, bytes, offset) => {
      const verdict = expectRejects(Uint8Array.from(bytes));
      expect(verdict.reason).toContain("UTF-8");
      expect(verdict.position?.offset).toBe(offset);
    },
  );

  test("the decoding failure's line and column count the parser's line endings", () => {
    const verdict = expectRejects(
      Uint8Array.from([0x41, 0x0d, 0x0a, 0x42, 0x0d, 0xe2, 0x82, 0x41]),
    );
    expect(verdict.position).toEqual({ line: 3, column: 1, offset: 5 });
  });

  test("valid multi-byte UTF-8 derives, bytes and string alike", () => {
    const text = doc(
      `# ${ASTRAL} ${String.fromCodePoint(0x00e9)}`,
      "",
      `<S id="m">${String.fromCodePoint(0x2028)}</S>`,
    );
    expectDerives(text);
    expectDerives(Buffer.from(text, "utf8"));
  });

  test("a string holding a lone surrogate is not encodable as UTF-8", () => {
    const verdict = expectRejects(`# ${String.fromCharCode(0xd83d)} x${LF}`);
    expect(verdict.reason).toContain("surrogate");
    expect(verdict.position?.offset).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Unicode 15.1 (S-9; SPEC 14.20): the identifier characters — an
// expression's and a JSX name's alike — and the space separators are Unicode
// 15.1's, judged code point by code point, whatever the checking tool's
// tables say. The stock tools judge otherwise: acorn 8.17's identifier tables
// are Unicode 17's, and the MDX tokenizer reads a JSX name one UTF-16 code
// unit at a time by the runtime's tables (acorn-jsx, a JSX name inside an
// expression, one code unit at a time too) — so every vector naming U+1C89
// or U+2EBF0 in an identifier or a name below fails under the stock
// judgement. Every non-ASCII character is built from its code point.

const cp = (code: number): string => String.fromCodePoint(code);
/** U+1C89, a Unicode 16 letter: no identifier character under 15.1. */
const U16_LETTER = cp(0x1c89);
/** U+2EBF0, the first character of CJK Unified Ideographs Extension I,
 * which Unicode 15.1 added (T14-12's Unicode pin). */
const EXT_I = cp(0x2ebf0);
/** U+2EBF1, its neighbour. */
const EXT_I_NEXT = cp(0x2ebf1);
/** U+1D7CE MATHEMATICAL BOLD DIGIT ZERO (Nd): an astral identifier part
 * that begins no identifier. */
const BOLD_ZERO = cp(0x1d7ce);
/** U+180E, a space separator up to Unicode 6.2, a format character under
 * 15.1: neither whitespace nor an identifier character (T2.7-4). */
const U180E = cp(0x180e);
const BACKSLASH = cp(0x5c);
const NAME = (code: number): string =>
  `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;

/** The space separators (general category Zs) Unicode 15.1 places outside
 * Latin-1, one T2.7-4 arm each (TEST-SPEC T2.7-4). */
const SPACE_SEPARATORS_PAST_LATIN_1: readonly number[] = [
  0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
  0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000,
];

/** ECMAScript 2024's WhiteSpace and LineTerminator under Unicode 15.1: TAB,
 * VT, FF, ZWNBSP, the space separators (U+0020, U+00A0, and those above), LF,
 * CR, LS, PS. */
const WHITESPACE_151: ReadonlySet<number> = new Set([
  0x09,
  0x0a,
  0x0b,
  0x0c,
  0x0d,
  0x20,
  0xa0,
  0xfeff,
  0x2028,
  0x2029,
  ...SPACE_SEPARATORS_PAST_LATIN_1,
]);

const UNICODE_151_DERIVES: ReadonlyArray<
  readonly [name: string, source: string]
> = [
  [
    "`<a` U+2EBF0 `>x</a` U+2EBF0 `>`: an element name U+2EBF0 continues, both tags",
    doc(`<a${EXT_I}>x</a${EXT_I}>`),
  ],
  [
    '`<a b` U+2EBF0 `="1" />`: an attribute name U+2EBF0 continues',
    doc(`<a b${EXT_I}="1" />`),
  ],
  [
    "T14-12: the container `{` U+2EBF0 `}` alone on its line",
    doc(`{${EXT_I}}`),
  ],
  [
    "T14-12: the element `<a` U+2EBF0 ` />` alone on its line",
    doc(`<a${EXT_I} />`),
  ],
  [
    'T14-12: the section `<S id="x" a` U+2EBF0 `="v" />` alone on its line',
    doc(`<S id="x" a${EXT_I}="v" />`),
  ],
  ["`<` U+2EBF0 ` />`: U+2EBF0 begins a JSX name", doc(`<${EXT_I} />`)],
  [
    "`<a.` U+2EBF0 ` />` and `<a:` U+2EBF0 ` />`: member and local names",
    doc(`<a.${EXT_I} />`, "", `<a:${EXT_I} />`),
  ],
  [
    '`<a ` U+2EBF0 `:b="1" />`: an attribute name\'s prefix',
    doc(`<a ${EXT_I}:b="1" />`),
  ],
  [
    "a text-position element, its attribute name holding U+2EBF0, mid-paragraph",
    doc(`x <a b${EXT_I}="1">y</a> z`),
  ],
  [
    "an element in a block quote, after an astral character on an earlier line",
    doc(`> ${EXT_I} quoted`, `> <a${EXT_I} />`),
  ],
  [
    "an element after an astral character and a CR LF line ending",
    `x${EXT_I}${CR}${LF}${CR}${LF}<a${EXT_I} />${CR}${LF}`,
  ],
  [
    "astral characters inside a tag's attribute values, quoted and braced",
    doc(`<a b="${EXT_I}" c={"${EXT_I}"} d={${EXT_I}} {...${EXT_I}} />`),
  ],
  [
    "a flow element followed on its line by a container holding U+2EBF0",
    doc(`<a${EXT_I} />{${EXT_I}}`),
  ],
  [
    "`{<a` U+2EBF0 ` />}`: a JSX name inside a container (acorn-jsx)",
    doc(`{<a${EXT_I} />}`),
  ],
  [
    "a JSX name holding U+2EBF0 inside an attribute expression (acorn-jsx)",
    doc(`<a b={<c${EXT_I} />} />`),
  ],
  [
    "an ESM import binding U+2EBF0",
    doc(`import ${EXT_I} from "./A.xspec"`, "", "Text."),
  ],
  ["a private name holding U+2EBF0", doc(`{class { #${EXT_I} = 1 }}`)],
  ["a regular expression's group name U+2EBF0", doc(`{/(?<${EXT_I}>a)/}`)],
  [
    "`<a` U+30FB ` />`: KATAKANA MIDDLE DOT continues a name under 15.1",
    doc(`<a${cp(0x30fb)} />`),
  ],
  [
    "`<a` U+1D7CE ` />`: an astral identifier part continues a name",
    doc(`<a${BOLD_ZERO} />`),
  ],
  [
    "U+1C89 outside every identifier: a string, attribute values, a comment, text",
    doc(
      `{"${U16_LETTER}"}`,
      "",
      `<a b="${U16_LETTER}" c={"${U16_LETTER}"} />`,
      "",
      `{/* ${U16_LETTER} */}`,
      "",
      `Text ${U16_LETTER} here.`,
    ),
  ],
  ...SPACE_SEPARATORS_PAST_LATIN_1.map((code): readonly [string, string] => [
    `T2.7-4: \`{\` ${NAME(code)} \`}\`, a space separator, is an MDX comment`,
    doc(`{${cp(code)}}`),
  ]),
  ...[0xa0, 0xfeff, 0x2028, 0x2029].map((code): readonly [string, string] => [
    `T2.7-4: \`{\` ${NAME(code)} \`}\` is an MDX comment`,
    doc(`{${cp(code)}}`),
  ]),
  ...[0x1680, 0x3000, 0xfeff].map((code): readonly [string, string] => [
    `\`{1\` ${NAME(code)} \`+ 2}\`: whitespace between an expression's tokens`,
    doc(`{1${cp(code)}+ 2}`),
  ]),
  ...[0x1680, 0x3000, 0xfeff, 0x2028].map((code): readonly [string, string] => [
    `\`<a\` ${NAME(code)} \`b="1" />\`: whitespace inside a tag`,
    doc(`<a${cp(code)}b="1" />`),
  ]),
];

const UNICODE_151_REJECTS: ReadonlyArray<
  readonly [name: string, source: string, offset: number]
> = [
  [
    "`{` U+1C89 `}`: a Unicode 16 letter begins no identifier",
    doc(`{${U16_LETTER}}`),
    1,
  ],
  ["`<a` U+1C89 ` />`: nor continues a JSX name", doc(`<a${U16_LETTER} />`), 2],
  [
    "T2.7-4: `{` U+180E `}`, a format character under 15.1",
    doc(`{${U180E}}`),
    1,
  ],
  ["T2.7-4: `{` U+0085 `}`", doc(`{${cp(0x85)}}`), 1],
  ["T2.7-4: `{` U+200B `}`", doc(`{${cp(0x200b)}}`), 1],
  ["`{a` U+1C89 `}`: nor continues an identifier", doc(`{a${U16_LETTER}}`), 2],
  [
    "`{a` backslash `u{1C89}}`: nor through an escape sequence",
    doc(`{a${BACKSLASH}u{1C89}}`),
    1,
  ],
  ["`<` U+1C89 ` />`: nor begins a JSX name", doc(`<${U16_LETTER} />`), 1],
  [
    '`<a b` U+1C89 `="1" />`: nor continues an attribute name',
    doc(`<a b${U16_LETTER}="1" />`),
    4,
  ],
  [
    "`<a.` U+1C89 ` />`: nor begins a member name",
    doc(`<a.${U16_LETTER} />`),
    3,
  ],
  [
    "`{<a` U+1C89 ` />}`: nor continues a JSX name inside a container",
    doc(`{<a${U16_LETTER} />}`),
    3,
  ],
  [
    "a JSX name holding U+1C89 inside an attribute expression",
    doc(`<a b={<c${U16_LETTER} />} />`),
    8,
  ],
  [
    "an ESM import binding holding U+1C89",
    doc(`import a${U16_LETTER} from "./A.xspec"`, "", "Text."),
    8,
  ],
  ["a private name holding U+1C89", doc(`{class { #a${U16_LETTER} = 1 }}`), 11],
  [
    "a regular expression's group name U+1C89",
    doc(`{/(?<${U16_LETTER}>a)/}`),
    -1,
  ],
  [
    "`<` U+1D7CE ` />`: an astral identifier part begins no JSX name",
    doc(`<${BOLD_ZERO} />`),
    1,
  ],
  [
    "`<a` U+2EBF0 `>x</a` U+2EBF1 `>`: names compared whole, code point by code point",
    doc(`<a${EXT_I}>x</a${EXT_I_NEXT}>`),
    -1,
  ],
  [
    '`<a` U+180E `b="1" />`: U+180E is no whitespace inside a tag',
    doc(`<a${U180E}b="1" />`),
    2,
  ],
  [
    "`{1` U+180E `+ 2}`: nor between an expression's tokens",
    doc(`{1${U180E}+ 2}`),
    2,
  ],
];

describe("S-9: identifier characters and space separators are Unicode 15.1's, code point by code point", () => {
  test.each(UNICODE_151_DERIVES)("%s derives", (_name, source) => {
    expectDerives(source);
    expectDerives(Buffer.from(source, "utf8"));
  });

  test.each(UNICODE_151_REJECTS)(
    "%s does not derive",
    (_name, source, offset) => {
      const verdict = expectRejects(source);
      // The offending code point, where the vector pins it (the stock
      // parser's position, a UTF-16 index; -1 where the rejection lies
      // elsewhere — a pattern's, or a closing tag's).
      if (offset >= 0) expect(verdict.position?.offset).toBe(offset);
      expectRejects(Buffer.from(source, "utf8"));
      // No allowance admits a character 15.1 does not.
      expectRejects(source, MDX_ALLOWANCES);
    },
  );

  test("TypeScript 5.9.3's ESNext tables are Unicode 15.1's at the version boundaries", () => {
    const ESNEXT = ts.ScriptTarget.ESNext;
    // [code point, begins an identifier, continues one]
    const boundaries: ReadonlyArray<readonly [number, boolean, boolean]> = [
      [0x2ebf0, true, true], // added in 15.1 (CJK Extension I)
      [0x31350, true, true], // added in 15.0 (CJK Extension H)
      [0x1c89, false, false], // added in 16.0
      [0x323b0, false, false], // added in 17.0 (CJK Extension J)
      [0x30fb, false, true], // joined ID_Continue in 15.1
      [0xff65, false, true], // joined ID_Continue in 15.1
      [0x200c, false, true], // ZWNJ: ID_Continue since 15.1, ES's anyway
      [0x200d, false, true], // ZWJ
      [0x00b7, false, true], // Other_ID_Continue
      [0x2e2f, false, false], // Lm, but Pattern_Syntax
      [0x180e, false, false], // Cf
      [0x24, true, true], // `$`
      [0x5f, true, true], // `_`
      [0x30, false, true], // `0`
      [0x2d, false, false], // `-` (a JSX name's own addition)
    ];
    for (const [code, start, part] of boundaries) {
      expect([NAME(code), ts.isIdentifierStart(code, ESNEXT)]).toEqual([
        NAME(code),
        start,
      ]);
      expect([NAME(code), ts.isIdentifierPart(code, ESNEXT)]).toEqual([
        NAME(code),
        part,
      ]);
    }
  });

  test("acorn admits every identifier character Unicode 15.1 admits, where 15.1 admits it", () => {
    // The premise of holding acorn's identifier tokens to 15.1 as they
    // finish: tables that admit more than 15.1's (Unicode 17's) tokenize
    // every text 15.1 admits as 15.1's would.
    const ESNEXT = ts.ScriptTarget.ESNext;
    const missing: string[] = [];
    for (let code = 0; code <= 0x10ffff; code++) {
      if (code >= 0xd800 && code <= 0xdfff) continue;
      if (
        ts.isIdentifierStart(code, ESNEXT) &&
        !ACORN.isIdentifierStart(code, true)
      ) {
        missing.push(`${NAME(code)} (start)`);
      }
      if (
        ts.isIdentifierPart(code, ESNEXT) &&
        !ACORN.isIdentifierChar(code, true)
      ) {
        missing.push(`${NAME(code)} (part)`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("acorn's whitespace is Unicode 15.1's: its fixed non-ASCII list", () => {
    // acorn skips U+00A0 and the line separators by name, and any other
    // code point from U+1680 up that its `nonASCIIwhitespace` matches.
    const differing: string[] = [];
    for (let code = 0x80; code <= 0xffff; code++) {
      const acornSkips =
        code === 0xa0 ||
        code === 0x2028 ||
        code === 0x2029 ||
        (code >= 0x1680 &&
          ACORN.nonASCIIwhitespace.test(String.fromCharCode(code)));
      if (acornSkips !== WHITESPACE_151.has(code)) differing.push(NAME(code));
    }
    expect(differing).toEqual([]);
  });

  test("this runtime's `\\s` is Unicode 15.1's (the empty-expression judgement reads it)", () => {
    const whitespace = /\s/;
    const differing: string[] = [];
    for (let code = 0; code <= 0xffff; code++) {
      if (
        whitespace.test(String.fromCharCode(code)) !== WHITESPACE_151.has(code)
      ) {
        differing.push(NAME(code));
      }
    }
    expect(differing).toEqual([]);
  });

  test("a rejection names the character as 15.1 judges it", () => {
    expect(expectRejects(doc(`{${U16_LETTER}}`)).reason).toContain(
      "Unicode 15.1",
    );
    expect(expectRejects(doc(`<a${U16_LETTER} />`)).reason).toContain(
      `(U+1C89, judged by Unicode 15.1)`,
    );
    expect(expectRejects(doc(`<a${U180E}b="1" />`)).reason).toContain(
      `(U+180E, judged by Unicode 15.1)`,
    );
  });
});

// ---------------------------------------------------------------------------
// Allowances: ECMAScript's early errors, each applying only when named and
// only to its own early error.

const ALLOWANCE_FORMS: ReadonlyArray<readonly [MdxAllowance, string, string]> =
  [
    [
      "duplicate-import-binding",
      "two imports binding one identifier in one ESM block",
      doc(
        'import { a } from "./x.xspec"',
        'import { a } from "./y.xspec"',
        "",
        "{text(a.k)}",
      ),
    ],
    [
      "undefined-export",
      "export { nope } after a used import",
      doc('import A from "./A.xspec"', "export { nope }", "", "{text(A.a)}"),
    ],
    ["invalid-assignment-target", "{1 = 2}", doc("{1 = 2}")],
    ["let-as-identifier", "{let}", doc("{let}")],
    ["legacy-octal", "{010}", doc("{010}")],
  ];

describe("S-9: the named allowances", () => {
  test("the allowance list is exactly S-9's", () => {
    expect([...MDX_ALLOWANCES]).toEqual([
      "duplicate-import-binding",
      "undefined-export",
      "invalid-assignment-target",
      "let-as-identifier",
      "legacy-octal",
    ]);
  });

  test.each(ALLOWANCE_FORMS)(
    "%s: %s derives when named and fails when unnamed",
    (name, _label, source) => {
      expectDerives(source, [name]);
      expectDerives(Buffer.from(source, "utf8"), [name]);
      expectRejects(source);
      expectRejects(source, []);
      // Naming every other allowance does not cover it.
      expectRejects(
        source,
        MDX_ALLOWANCES.filter((other) => other !== name),
      );
    },
  );

  test.each(ALLOWANCE_FORMS)(
    "%s: a different rejection under the named allowance still fails",
    (name) => {
      for (const [other, , source] of ALLOWANCE_FORMS) {
        if (other !== name) expectRejects(source, [name]);
      }
      expectRejects(doc("{1e}"), [name]);
      expectRejects(doc("{0x}"), [name]);
      expectRejects(doc("export let x = ;"), [name]);
      expectRejects(doc('<S id="x">'), [name]);
    },
  );

  test("duplicate-import-binding covers the same early error across ESM blocks (14.20 admits both)", () => {
    const acrossBlocks = doc(
      'import { a } from "./x.xspec"',
      "",
      'import { a } from "./y.xspec"',
      "",
      "{text(a.k)}",
    );
    expectDerives(acrossBlocks, ["duplicate-import-binding"]);
    expectRejects(acrossBlocks);
    expectRejects(acrossBlocks, ["undefined-export"]);
  });

  test("duplicate-import-binding and undefined-export are ESM-block early errors only", () => {
    // The same acorn messages inside an expression container are not imports.
    expectRejects(doc("{(() => { let a; let a; })()}"), [
      "duplicate-import-binding",
    ]);
  });

  test("legacy-octal is the legacy numeric literal at the rejection offset, not every 'Invalid number'", () => {
    expectDerives(doc("{(010)}"), ["legacy-octal"]);
    expectDerives(doc("{08}"), ["legacy-octal"]);
    expectDerives(doc("export const x = 010"), ["legacy-octal"]);
    // The offset the parser reports indexes the decoded text as it counts it.
    expectDerives(doc(`{"${ASTRAL}" + 010}`), ["legacy-octal"]);
    expectRejects(doc("{1e}"), ["legacy-octal"]);
    expectRejects(doc("{0x}"), ["legacy-octal"]);
    expectRejects(doc("{0o8}"), ["legacy-octal"]);
  });

  test("invalid-assignment-target applies in an ESM block too", () => {
    expectDerives(doc("export const x = (1 = 2)"), [
      "invalid-assignment-target",
    ]);
  });

  test("an allowed early error never hides a later rejection in the file", () => {
    // The parse continues past a tolerated early error, so an MDX-syntax
    // rejection, or an early error under an unnamed allowance, further on
    // still surfaces.
    const dupThenUnclosed = doc(
      'import { a } from "./x.xspec"',
      'import { a } from "./y.xspec"',
      "",
      '<S id="x">',
    );
    expectRejects(dupThenUnclosed, ["duplicate-import-binding"]);
    expect(expectRejects(dupThenUnclosed, MDX_ALLOWANCES).reason).toContain(
      "closing tag",
    );
    const assignThenEmptyAttribute = doc(
      "{1 = 2}",
      "",
      '<S id="x" d={}>',
      "",
      "body",
      "",
      "</S>",
    );
    expectRejects(assignThenEmptyAttribute, ["invalid-assignment-target"]);
    const dupThenExport = doc(
      'import { a } from "./x.xspec"',
      'import { a } from "./y.xspec"',
      "export { nope }",
    );
    expectRejects(dupThenExport, ["duplicate-import-binding"]);
    expectDerives(dupThenExport, [
      "duplicate-import-binding",
      "undefined-export",
    ]);
    const octalThenLet = doc("{010} {let}");
    expectRejects(octalThenLet, ["legacy-octal"]);
    expectDerives(octalThenLet, ["legacy-octal", "let-as-identifier"]);
  });

  test("several allowances may be named together, each for its own form", () => {
    const all = doc(
      'import { a } from "./x.xspec"',
      'import { a } from "./y.xspec"',
      "export { nope }",
      "",
      "{1 = 2} {let} {010}",
    );
    expectDerives(all, MDX_ALLOWANCES);
    expectRejects(all, ["duplicate-import-binding"]);
  });
});

// ---------------------------------------------------------------------------
// The builder-side wiring (helpers/workspace.ts): every staged `.mdx` file is
// judged at staging time against the staging's S-9 declaration — well-formed
// by default — and a contradiction is a harness error (`HarnessStagingError`,
// mode `mdx-derivability`), never an assertion failure and never a skip.

const STAGED_ILL_FORMED = doc('<S id="x">', "", "never closed");
const STAGED_WELL_FORMED = doc('<S id="x">', "", "closed below", "", "</S>");
const DUPLICATE_BINDING = doc(
  'import { a } from "./x.xspec"',
  'import { a } from "./y.xspec"',
  "",
  "# Doc",
);
const BOM_BYTES = Buffer.concat([
  Buffer.from([0xef, 0xbb, 0xbf]),
  Buffer.from("# Doc" + LF, "utf8"),
]);
const INVALID_UTF8_BYTES = Buffer.from([0x23, 0x20, 0xff, 0x0a]);

async function stage(decl: WorkspaceDecl): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create(decl);
  onTestFinished(() => workspace.dispose());
  return workspace;
}

async function staged(workspace: TestWorkspace, rel: string): Promise<string> {
  return Buffer.from(await workspace.readBytes(rel)).toString("utf8");
}

async function expectStagingError(
  action: () => Promise<unknown>,
  path: string,
  ...fragments: readonly string[]
): Promise<HarnessStagingError> {
  let thrown: unknown;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  const error = thrown as HarnessStagingError;
  expect(error.name).toBe("HarnessStagingError");
  expect(error.mode).toBe("mdx-derivability");
  expect(error.path).toBe(path);
  expect(error.message).toContain(`mdx-derivability staging of ${path}: `);
  for (const fragment of fragments) {
    expect(error.message).toContain(fragment);
  }
  return error;
}

describe("S-9: the builder judges every staged `.mdx` source against its declaration", () => {
  test("the default is well-formed: an ill-formed source throws at staging, naming the path and the parser's reason", async () => {
    const error = await expectStagingError(
      () =>
        TestWorkspace.create({ files: { "specs/A.mdx": STAGED_ILL_FORMED } }),
      "specs/A.mdx",
      "declared well-formed (S-9's default)",
      "the stock MDX 3 parser rejects it",
      "mdast-util-mdx-jsx",
      "`mdx.unparseable`",
    );
    expect(error.message).toContain(expectRejects(STAGED_ILL_FORMED).reason);
  });

  test("a well-formed source stages under the default, wherever it lies", async () => {
    const workspace = await stage({
      files: {
        "specs/A.mdx": STAGED_WELL_FORMED,
        "specs/deep/B.mdx": "# B" + LF,
      },
    });
    expect(await staged(workspace, "specs/A.mdx")).toBe(STAGED_WELL_FORMED);
    expect(workspace.mdxDeclarationOf("specs/A.mdx")).toBe("well-formed");
    expect(workspace.mdxDeclarationOf("specs/deep/B.mdx")).toBe("well-formed");
  });

  test("`unparseable`: the source must not derive; a deriving one throws", async () => {
    const workspace = await stage({
      files: { "specs/A.mdx": STAGED_ILL_FORMED },
      mdx: { unparseable: ["specs/A.mdx"] },
    });
    expect(await staged(workspace, "specs/A.mdx")).toBe(STAGED_ILL_FORMED);
    expect(workspace.mdxDeclarationOf("specs/A.mdx")).toBe("unparseable");
    await expectStagingError(
      () =>
        TestWorkspace.create({
          files: { "specs/A.mdx": STAGED_WELL_FORMED },
          mdx: { unparseable: ["specs/A.mdx"] },
        }),
      "specs/A.mdx",
      "declared unparseable",
      "derives",
    );
  });

  test("14.20's encoding rules: a byte-order mark and invalid UTF-8 are unparseable stagings", async () => {
    await expectStagingError(
      () => TestWorkspace.create({ files: { "specs/A.mdx": BOM_BYTES } }),
      "specs/A.mdx",
      "byte-order mark",
    );
    await expectStagingError(
      () =>
        TestWorkspace.create({
          files: { "specs/A.mdx": BOM + "# Doc" + LF },
        }),
      "specs/A.mdx",
      "byte-order mark",
    );
    await expectStagingError(
      () =>
        TestWorkspace.create({ files: { "specs/A.mdx": INVALID_UTF8_BYTES } }),
      "specs/A.mdx",
      "not valid UTF-8",
    );
    const workspace = await stage({
      files: { "specs/A.mdx": BOM_BYTES, "specs/B.mdx": INVALID_UTF8_BYTES },
      mdx: { unparseable: ["specs/A.mdx", "specs/B.mdx"] },
    });
    expect(Buffer.from(await workspace.readBytes("specs/A.mdx"))).toEqual(
      BOM_BYTES,
    );
    expect(Buffer.from(await workspace.readBytes("specs/B.mdx"))).toEqual(
      INVALID_UTF8_BYTES,
    );
  });

  test("`unchecked` skips the check, whatever the source", async () => {
    const workspace = await stage({
      files: {
        "specs/A.mdx": STAGED_ILL_FORMED,
        "specs/B.mdx": STAGED_WELL_FORMED,
        "specs/C.mdx": INVALID_UTF8_BYTES,
      },
      mdx: { unchecked: ["specs/A.mdx", "specs/B.mdx", "specs/C.mdx"] },
    });
    expect(await staged(workspace, "specs/A.mdx")).toBe(STAGED_ILL_FORMED);
    expect(workspace.mdxDeclarationOf("specs/A.mdx")).toBe("unchecked");
  });

  test("`allowances`: the source derives under exactly the early errors named for it", async () => {
    const workspace = await stage({
      files: { "specs/A.mdx": DUPLICATE_BINDING },
      mdx: { allowances: { "specs/A.mdx": ["duplicate-import-binding"] } },
    });
    expect(workspace.mdxDeclarationOf("specs/A.mdx")).toEqual({
      allowances: ["duplicate-import-binding"],
    });
    await expectStagingError(
      () =>
        TestWorkspace.create({ files: { "specs/A.mdx": DUPLICATE_BINDING } }),
      "specs/A.mdx",
      "declared well-formed (S-9's default)",
      "already been declared",
    );
    await expectStagingError(
      () =>
        TestWorkspace.create({
          files: { "specs/A.mdx": DUPLICATE_BINDING },
          mdx: { allowances: { "specs/A.mdx": ["legacy-octal"] } },
        }),
      "specs/A.mdx",
      'declared well-formed under the allowances ["legacy-octal"]',
      "already been declared",
    );
    // No allowance passes an MDX-syntax rejection.
    await expectStagingError(
      () =>
        TestWorkspace.create({
          files: { "specs/A.mdx": STAGED_ILL_FORMED },
          mdx: { allowances: { "specs/A.mdx": [...MDX_ALLOWANCES] } },
        }),
      "specs/A.mdx",
      "mdast-util-mdx-jsx",
    );
  });

  test("the workspace declaration governs later `file()` stagings; a call option overrides it for that write", async () => {
    const workspace = await stage({ mdx: { unparseable: ["specs/A.mdx"] } });
    await workspace.file("specs/A.mdx", STAGED_ILL_FORMED);
    await expectStagingError(
      () => workspace.file("specs/A.mdx", STAGED_WELL_FORMED),
      "specs/A.mdx",
      "declared unparseable",
    );
    await workspace.file("specs/A.mdx", STAGED_WELL_FORMED, {
      mdx: "well-formed",
    });
    expect(await staged(workspace, "specs/A.mdx")).toBe(STAGED_WELL_FORMED);
    await expectStagingError(
      () => workspace.file("specs/B.mdx", STAGED_ILL_FORMED),
      "specs/B.mdx",
      "declared well-formed (S-9's default)",
    );
    await workspace.file("specs/B.mdx", STAGED_ILL_FORMED, {
      mdx: "unparseable",
    });
    await workspace.file("specs/B.mdx", STAGED_WELL_FORMED, {
      mdx: "unchecked",
    });
    await workspace.file("specs/C.mdx", DUPLICATE_BINDING, {
      mdx: { allowances: ["duplicate-import-binding"] },
    });
    await expectStagingError(
      () => workspace.file("specs/C.mdx", DUPLICATE_BINDING),
      "specs/C.mdx",
      "already been declared",
    );
  });

  test("a refused staging writes nothing", async () => {
    const workspace = await stage({
      files: { "specs/A.mdx": STAGED_WELL_FORMED },
    });
    await expectStagingError(
      () => workspace.file("specs/A.mdx", STAGED_ILL_FORMED),
      "specs/A.mdx",
    );
    expect(await staged(workspace, "specs/A.mdx")).toBe(STAGED_WELL_FORMED);
    await expectStagingError(
      () => workspace.file("specs/deep/D.mdx", STAGED_ILL_FORMED),
      "specs/deep/D.mdx",
    );
    expect(await workspace.kind("specs/deep")).toBe("absent");
  });

  test("only `.mdx` paths are judged; declaration keys are normalized paths; a byte path is keyed by its decoding", async () => {
    const workspace = await stage({
      files: {
        "notes.md": STAGED_ILL_FORMED,
        "specs/A.mdx.txt": STAGED_ILL_FORMED,
        "specs/A.MDX": STAGED_ILL_FORMED,
        "./specs/B.mdx": STAGED_ILL_FORMED,
      },
      mdx: { unparseable: ["specs//B.mdx"] },
    });
    expect(workspace.mdxDeclarationOf("notes.md")).toBeUndefined();
    expect(workspace.mdxDeclarationOf("specs/A.MDX")).toBeUndefined();
    expect(workspace.mdxDeclarationOf("specs/./B.mdx")).toBe("unparseable");
    const bytePath = Buffer.from("specs/E.mdx", "utf8");
    expect(workspace.mdxDeclarationOf(bytePath)).toBe("well-formed");
    await expectStagingError(
      () => workspace.file(bytePath, STAGED_ILL_FORMED),
      "specs/E.mdx",
    );
    await workspace.file(bytePath, STAGED_ILL_FORMED, { mdx: "unparseable" });
    expect(await staged(workspace, "specs/E.mdx")).toBe(STAGED_ILL_FORMED);
  });

  test("a declaration defect is refused at creation", async () => {
    await expectStagingError(
      () =>
        TestWorkspace.create({
          mdx: { unparseable: ["specs/A.mdx"], unchecked: ["specs/A.mdx"] },
        }),
      "specs/A.mdx",
      "more than one",
    );
    await expectStagingError(
      () => TestWorkspace.create({ mdx: { unchecked: ["specs/A.md"] } }),
      "specs/A.md",
      "not an MDX source",
    );
    await expectStagingError(
      () =>
        TestWorkspace.create({ mdx: { allowances: { "specs/A.mdx": [] } } }),
      "specs/A.mdx",
      "empty allowance list",
    );
    await expectStagingError(
      () =>
        TestWorkspace.create({
          mdx: {
            allowances: {
              "specs/A.mdx": ["no-such-allowance" as MdxAllowance],
            },
          },
        }),
      "specs/A.mdx",
      "unknown allowance",
    );
  });
});
