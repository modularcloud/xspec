// Self-checks for the S-9 derivability check (`test/helpers/mdx-derivability.ts`;
// TEST-SPEC 17 S-9 — certification cannot exercise this class, so what is
// verified here is the check itself against the document's own declarations).
// SPEC 14.20 fixes the grammar: MDX syntax at major version 3, decided by
// derivability alone. Every shape TEST-SPEC works through as well-formed must
// derive — T3-3's multi-line-tag arms and its U+2028 ESM arm, T6.2-3's worked
// and U+000B/U+000C shapes, T6.2-4's pinned shapes, T2.1-6's ESM block inside
// a section, T3-7's comment forms, T14-12's positive arms, and the composed
// forms of T6.5-13/T6.5-19 — and every shape the document declares
// unparseable must not: a leading byte-order mark, invalid UTF-8, an unclosed
// tag, a text-position tag closed by a flow tag on a later line (the former
// stagings of T3-1's `gamma` and of T6.2-3's impure origin, spelled exactly;
// their restaged sources are judged verbatim from the registry modules, with
// the two files T6.2-3's move leaves), the empty attribute expressions, the
// spread with extra
// content, an ESM block holding a statement, the one-sided section spellings
// 6.2/6.5 refuse, and T14-12's negative arms. S-9's allowances — ECMAScript's
// early errors, which the stock parser enforces beyond derivability — apply
// only when named and only to their own early error; none passes an
// MDX-syntax rejection. Every non-ASCII or control character is built from
// its code point.

import { Buffer } from "node:buffer";
import { describe, expect, test } from "vitest";
import {
  MDX_ALLOWANCES,
  deriveMdx,
  type MdxAllowance,
} from "../helpers/mdx-derivability.js";
import { REMOVALS_SOURCE } from "../suite/registry/section-3.js";
import {
  I3_HALL_MOVED_SOURCE,
  I3_ROOM_MOVED_SOURCE,
  I3_ROOM_SOURCE,
} from "../suite/registry/section-6.2.js";

const LF = String.fromCodePoint(0x000a);
const CR = String.fromCodePoint(0x000d);
const VT = String.fromCodePoint(0x000b);
const FF = String.fromCodePoint(0x000c);
const LS = String.fromCodePoint(0x2028);
const BOM = String.fromCodePoint(0xfeff);
const ASTRAL = String.fromCodePoint(0x1f600);

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
  // paragraph, the second fence at top level) and T6.2-3's impure origin in
  // 6.2's worked shape, with the two files its move leaves (SPEC 6.5).
  ["T3-1 specs/A.mdx as staged", REMOVALS_SOURCE],
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
