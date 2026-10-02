// S-6 name-analysis vectors (TEST-SPEC 17 S-6; T6.5-22): the analysis behind
// T6.5-22(a)'s universal assertion (test/helpers/oracles/name-analysis.ts) —
// which names a receiving file declares, in any scope and at value or type
// level, which it references, and which SPEC 6.5 bars there — passes this
// fixed vector suite before any test that adds an import trusts it, P-5's
// draws included. Each vector is a receiving file built from T6.5-22's
// stagings with candidate names and the verdict the analysis must reach on
// each, in both directions, hand-computed; no product is involved.
// Certification reaches the analysis only through the violators that target
// T6.5-22, so each class's verdict is checked here directly:
//   * counted — `helper` declared only in a function body and, separately,
//     only as a type; `Record` in a type annotation; the undeclared global
//     `test` of a call; `Foo` of `<Foo />`; `x` of `x.foo`; `t` of
//     `{ text as t }`;
//   * not counted — `div` of `<div />`, `foo` of `x.foo`, a label, and the
//     `text` that `{ text as t }` spells for the other module;
//   * barred in a TSX file, the factory name of each pragma T6.5-22(b)
//     stages (`h` of `/** @jsx h */`, `/* @JSX h */`, `// @jsx h`, and an
//     in-function `/** @jsx h */`; `preact` of `/** @jsx preact.h */`;
//     `Frag` of `/** @jsxFrag Frag */`);
//   * barred in every kind of file, though it neither declares nor
//     references them, each name T6.5-22's constraint list spells or ranges
//     over, and a `__`-prefixed name;
//   * `React`, barred in both of T6.5-22(b)'s `.tsx` receivers and in
//     neither a spec source nor a `.ts` file; `S`, `Spec`, and `text`,
//     barred in a spec source and not in a code source;
// so that each name T6.5-22(b)'s lures target is a vector in every kind of
// file its lures stage. The counted and not-counted classes are read in a
// spec source too where its grammar spells them: a spec source's names come
// from its ESTree, a code source's from TypeScript's tree, two readings each
// held to its own vectors. Every receiver is well-formed under its grammar
// (S-9), as T6.5-22's are; the analysis reads no other file.

import { describe, expect, test } from "vitest";
import { deriveMdx } from "../helpers/mdx-derivability.js";
import {
  addedIdentifierBreaches,
  analyzeNames,
  nameVerdict,
  type NameVerdict,
  type ReceivingFileKind,
} from "../helpers/oracles/name-analysis.js";
import { judgeTypeScript } from "../helpers/ts-derivability.js";

// The constraint list's names, written out here from ECMAScript 2024 and
// T6.5-22 independently of the analysis's own tables.

/** ECMAScript 2024's reserved words (12.7.2). */
// prettier-ignore
const ES2024_RESERVED_WORDS = [
  "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "export", "extends", "false",
  "finally", "for", "function", "if", "import", "in", "instanceof", "new",
  "null", "return", "super", "switch", "this", "throw", "true", "try",
  "typeof", "var", "void", "while", "with", "yield",
];

/** The strict-mode-barred words T6.5-22 lists. */
// prettier-ignore
const STRICT_MODE_WORDS = [
  "let", "static", "implements", "interface", "package", "private",
  "protected", "public", "eval", "arguments",
];

/** Clause 19's global object properties: value, function, constructor, and
 * other properties — the constructors from `AggregateError` through
 * `WeakSet`. */
// prettier-ignore
const CLAUSE_19_PROPERTIES = [
  "globalThis", "Infinity", "NaN", "undefined",
  "eval", "isFinite", "isNaN", "parseFloat", "parseInt",
  "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent",
  "AggregateError", "Array", "ArrayBuffer", "BigInt", "BigInt64Array",
  "BigUint64Array", "Boolean", "DataView", "Date", "Error", "EvalError",
  "FinalizationRegistry", "Float32Array", "Float64Array", "Function",
  "Int8Array", "Int16Array", "Int32Array", "Map", "Number", "Object",
  "Promise", "Proxy", "RangeError", "ReferenceError", "RegExp", "Set",
  "SharedArrayBuffer", "String", "Symbol", "SyntaxError", "TypeError",
  "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array",
  "URIError", "WeakMap", "WeakRef", "WeakSet",
  "Atomics", "JSON", "Math", "Reflect",
];

const CONSTRAINT_LIST_NAMES = [
  ...ES2024_RESERVED_WORDS,
  ...STRICT_MODE_WORDS,
  "require",
  "exports",
  ...CLAUSE_19_PROPERTIES,
  "escape",
  "unescape",
  "Iterator",
  "AsyncIterator",
  "SuppressedError",
  "__x",
];

/** A candidate's expected verdict: declared, referenced, barred — each
 * false unless named. */
interface Expected {
  readonly declared?: true;
  readonly referenced?: true;
  readonly barred?: true;
}

interface Receiver {
  readonly label: string;
  readonly kind: ReceivingFileKind;
  /** The receiving file's name, by which its grammar is chosen (14.20). */
  readonly name: string;
  readonly text: string;
  /** The candidates this receiver's own vectors name. */
  readonly candidates: Readonly<Record<string, Expected>>;
}

const lines = (...parts: string[]): string => parts.join("\n") + "\n";

// The receivers. Each `.tsx` receiver carries JSX where T6.5-22(b)'s does.
const RECEIVERS: readonly Receiver[] = [
  {
    label: "the spec source a lure's section move adds an import to",
    kind: "spec-source",
    name: "specs/host.mdx",
    text: lines(
      'import A from "./a.xspec"',
      "",
      '<S id="host" d={A.a}>',
      "Host text, quoting {text(A.a)}.",
      "</S>",
    ),
    candidates: {
      A: { declared: true, referenced: true },
      a: {},
      d: {},
      S: { referenced: true, barred: true },
      Spec: { barred: true },
      text: { referenced: true, barred: true },
      React: {},
    },
  },
  {
    label: "a spec source spelling each counted and uncounted class",
    kind: "spec-source",
    name: "specs/classes.mdx",
    text: lines(
      'import A from "./a.xspec"',
      'import { text as t } from "./b.xspec"',
      "export function g() { const helper = 1; return helper }",
      "export function spin() { L: for (;;) break L }",
      'export const r = test("adds", () => x.foo)',
      "",
      '<S id="host">',
      "Host text.",
      "</S>",
      "",
      "<Foo />",
      "",
      "<div />",
    ),
    candidates: {
      A: { declared: true },
      t: { declared: true },
      text: { barred: true },
      g: { declared: true },
      helper: { declared: true, referenced: true },
      spin: { declared: true },
      L: {},
      r: { declared: true },
      test: { referenced: true },
      x: { referenced: true },
      foo: {},
      S: { referenced: true, barred: true },
      Spec: { barred: true },
      Foo: { referenced: true },
      div: {},
      React: {},
    },
  },
  {
    label: "the .ts code source a lure's section move adds an import to",
    kind: "typescript",
    name: "src/host.ts",
    text: lines(
      "export function area(width: number, height: number): number {",
      "  return width * height;",
      "}",
    ),
    candidates: {
      area: { declared: true },
      width: { declared: true, referenced: true },
      height: { declared: true, referenced: true },
      S: {},
      Spec: {},
      text: {},
      React: {},
    },
  },
  {
    label: "a .ts receiver declaring helper only inside a function",
    kind: "typescript",
    name: "src/helper-fn.ts",
    text: lines("function g() { const helper = 1; return helper }"),
    candidates: { helper: { declared: true, referenced: true } },
  },
  {
    label: "a .ts receiver declaring helper only as a type",
    kind: "typescript",
    name: "src/helper-type.ts",
    text: lines("type helper = number"),
    candidates: { helper: { declared: true } },
  },
  {
    label: "a .ts receiver whose only mention of Record is a type annotation",
    kind: "typescript",
    name: "src/record.ts",
    text: lines("let r: Record<string, number> = {}"),
    candidates: { Record: { referenced: true }, r: { declared: true } },
  },
  {
    label: "a .ts receiver calling an undeclared global test(…)",
    kind: "typescript",
    name: "src/test-call.ts",
    text: lines('test("adds", () => {})'),
    candidates: { test: { referenced: true } },
  },
  {
    label: "a .ts receiver spelling x.foo, a label, and { text as t }",
    kind: "typescript",
    name: "src/members.ts",
    text: lines(
      'import { text as t } from "../specs/a.xspec";',
      "",
      "export const y = x.foo;",
      "export function spin(): void {",
      "  L: for (;;) break L;",
      "}",
    ),
    candidates: {
      t: { declared: true },
      text: {},
      y: { declared: true },
      x: { referenced: true },
      foo: {},
      spin: { declared: true },
      L: {},
    },
  },
  {
    label: "the .tsx receiver of specs/React.mdx holding classic-runtime JSX",
    kind: "tsx",
    name: "src/view.tsx",
    text: lines("export const view = <div />;"),
    candidates: {
      view: { declared: true },
      div: {},
      React: { barred: true },
      h: {},
      S: {},
      Spec: {},
      text: {},
    },
  },
  {
    label: "the .tsx receiver of specs/React.mdx holding no JSX",
    kind: "tsx",
    name: "src/plain.tsx",
    text: lines("export const plain = 1;"),
    candidates: { plain: { declared: true }, React: { barred: true } },
  },
  {
    label: "a .tsx receiver spelling <Foo /> and <div />",
    kind: "tsx",
    name: "src/both.tsx",
    text: lines("export const both = [<Foo />, <div />];"),
    candidates: {
      both: { declared: true },
      Foo: { referenced: true },
      div: {},
      React: { barred: true },
    },
  },
  {
    label: "a .tsx receiver of specs/h.mdx carrying /** @jsx h */",
    kind: "tsx",
    name: "src/jsx-doc.tsx",
    text: lines("/** @jsx h */", "export const view = <div />;"),
    candidates: { h: { barred: true }, React: { barred: true } },
  },
  {
    label: "a .tsx receiver of specs/h.mdx carrying /* @JSX h */",
    kind: "tsx",
    name: "src/jsx-upper.tsx",
    text: lines("/* @JSX h */", "export const view = <div />;"),
    candidates: { h: { barred: true }, React: { barred: true } },
  },
  {
    label: "a .tsx receiver of specs/preact.mdx carrying /** @jsx preact.h */",
    kind: "tsx",
    name: "src/jsx-preact.tsx",
    text: lines("/** @jsx preact.h */", "export const view = <div />;"),
    candidates: { preact: { barred: true }, h: {}, React: { barred: true } },
  },
  {
    label:
      "a .tsx receiver of specs/Frag.mdx carrying /** @jsxFrag Frag */ alone",
    kind: "tsx",
    name: "src/jsx-frag.tsx",
    text: lines("/** @jsxFrag Frag */", "export const view = <></>;"),
    candidates: { Frag: { barred: true }, React: { barred: true } },
  },
  {
    label: "a .tsx receiver of specs/h.mdx carrying the line comment // @jsx h",
    kind: "tsx",
    name: "src/jsx-line.tsx",
    text: lines("// @jsx h", "export const view = <div />;"),
    candidates: { h: { barred: true }, React: { barred: true } },
  },
  {
    label:
      "a .tsx receiver of specs/h.mdx carrying /** @jsx h */ inside a function body, after the first statement",
    kind: "tsx",
    name: "src/jsx-inner.tsx",
    text: lines(
      "export const first = 1;",
      "export function render() {",
      "  /** @jsx h */",
      "  return <div />;",
      "}",
    ),
    candidates: {
      first: { declared: true },
      render: { declared: true },
      h: { barred: true },
      React: { barred: true },
    },
  },
];

function expectedVerdict(expected: Expected): {
  readonly declared: boolean;
  readonly referenced: boolean;
  readonly barred: boolean;
} {
  return {
    declared: expected.declared === true,
    referenced: expected.referenced === true,
    barred: expected.barred === true,
  };
}

function actualVerdict(verdict: NameVerdict): {
  readonly declared: boolean;
  readonly referenced: boolean;
  readonly barred: boolean;
} {
  return {
    declared: verdict.declared,
    referenced: verdict.referenced,
    barred: verdict.barred !== undefined,
  };
}

describe("S-6 name analysis: T6.5-22's receivers", () => {
  test.each(RECEIVERS.map((receiver) => [receiver.label, receiver] as const))(
    "%s is well-formed under its grammar (14.20, S-9)",
    (_label, receiver) => {
      if (receiver.kind === "spec-source") {
        expect(deriveMdx(receiver.text)).toEqual({ derives: true });
      } else {
        expect(judgeTypeScript(receiver.text, receiver.name)).toEqual({
          verdict: "well-formed",
        });
      }
    },
  );

  test.each(RECEIVERS.map((receiver) => [receiver.label, receiver] as const))(
    "%s: each candidate's verdict",
    (_label, receiver) => {
      const analysis = analyzeNames(receiver.kind, receiver.text);
      const wrong = Object.entries(receiver.candidates).flatMap(
        ([name, expected]) => {
          const actual = actualVerdict(nameVerdict(analysis, name));
          const want = expectedVerdict(expected);
          return JSON.stringify(actual) === JSON.stringify(want)
            ? []
            : [{ name, actual, want }];
        },
      );
      expect(wrong).toEqual([]);
    },
  );

  test.each(RECEIVERS.map((receiver) => [receiver.label, receiver] as const))(
    "%s: every constraint-list name is barred there, neither declared nor referenced",
    (_label, receiver) => {
      const analysis = analyzeNames(receiver.kind, receiver.text);
      const wrong = CONSTRAINT_LIST_NAMES.filter((name) => {
        const verdict = nameVerdict(analysis, name);
        return (
          verdict.barred === undefined || verdict.declared || verdict.referenced
        );
      });
      expect(wrong).toEqual([]);
    },
  );

  test.each(RECEIVERS.map((receiver) => [receiver.label, receiver] as const))(
    "%s: React is barred exactly in a TSX source; S, Spec, and text exactly in a spec source",
    (_label, receiver) => {
      const analysis = analyzeNames(receiver.kind, receiver.text);
      expect(nameVerdict(analysis, "React").barred !== undefined).toBe(
        receiver.kind === "tsx",
      );
      for (const name of ["S", "Spec", "text"]) {
        expect(nameVerdict(analysis, name).barred !== undefined).toBe(
          receiver.kind === "spec-source",
        );
      }
    },
  );
});

describe("S-6 name analysis: T6.5-22(a)'s verdict on added identifiers", () => {
  const analysisOf = (name: string) => {
    const receiver = RECEIVERS.find((entry) => entry.name === name);
    if (receiver === undefined) throw new Error(`no receiver ${name}`);
    return analyzeNames(receiver.kind, receiver.text);
  };

  test("fresh, admitted, distinct identifiers breach nothing", () => {
    expect(
      addedIdentifierBreaches(analysisOf("src/host.ts"), ["A", "B"]),
    ).toEqual([]);
    expect(
      addedIdentifierBreaches(analysisOf("specs/host.mdx"), ["B", "React"]),
    ).toEqual([]);
  });

  test("each clause is named for the identifier breaching it", () => {
    const clauses = (name: string, added: readonly string[]) =>
      addedIdentifierBreaches(analysisOf(name), added).map(
        ({ identifier, clause }) => [identifier, clause.split(":")[0]],
      );
    expect(clauses("src/host.ts", ["let", "__x", "Object"])).toEqual([
      ["let", "barred"],
      ["__x", "barred"],
      ["Object", "barred"],
    ]);
    expect(clauses("src/helper-type.ts", ["helper"])).toEqual([
      [
        "helper",
        "bound by a declaration of the pre-operation file (in some scope, at value or type level)",
      ],
    ]);
    expect(clauses("src/record.ts", ["Record"])).toEqual([
      [
        "Record",
        "equal to a name the pre-operation file references (at value or type level)",
      ],
    ]);
    expect(clauses("src/host.ts", ["A", "A"])).toEqual([
      ["A", "not distinct from another identifier added to the file"],
    ]);
    expect(clauses("specs/host.mdx", ["text"])).toEqual([
      ["text", "barred"],
      [
        "text",
        "equal to a name the pre-operation file references (at value or type level)",
      ],
    ]);
    expect(clauses("src/jsx-line.tsx", ["h", "React"])).toEqual([
      ["h", "barred"],
      ["React", "barred"],
    ]);
  });
});

describe("S-6 name analysis: a file outside its grammar is never read", () => {
  test("a spec source that does not derive is a harness error", () => {
    expect(() => analyzeNames("spec-source", "<S>\n")).toThrow(
      /S-9's MDX parse: no tree is read/,
    );
  });

  test("a code source that is not well-formed is a harness error", () => {
    expect(() => analyzeNames("typescript", "let = ;\n")).toThrow(
      /S-6's name analysis: no names are read/,
    );
  });
});
