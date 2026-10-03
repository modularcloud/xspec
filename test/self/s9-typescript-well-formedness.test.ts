// Self-checks for S-9's TypeScript check (`test/helpers/ts-derivability.ts`;
// TEST-SPEC 17 S-9's TypeScript clause — certification cannot exercise this
// class, so what is verified here is the check itself against the document's
// own declarations). SPEC 14.20 fixes the grammar: TypeScript's at release
// 5.9.3, TSX or plain as the file name selects, at the language level
// ESNext, derivability there being that release's acceptance. Every code
// source and configuration file the document declares well-formed is
// accepted both as module code and as script code: T14-12's post-parse arms,
// release-pin arms, language-level arms, and whitespace arm; T4-2's
// relative-name and undeclared module declarations and its other
// module-linking forms (their diagnostics are post-parse); T7-2's
// modifier-bearing configuration imports (the declarative form of 7 decides
// them); plain configuration files; and a `.tsx` file holding JSX. Every one
// it declares unparseable is rejected both ways: `010`, `09`, U+1C89 in an
// identifier, the T7-2 syntax error, and T14-12's staged code arms. And the
// top-level `await` forms 14.20 names, accepted read one way only, are a
// harness error whatever the declaration. Every non-ASCII or control
// character a vector's text holds is built from its code point.

import { Buffer } from "node:buffer";
import { describe, expect, test } from "vitest";
import {
  TS_READINGS,
  judgeTypeScript,
  readTypeScript,
  tsDeclarationProblem,
  type TsReading,
  type TsVerdict,
} from "../helpers/ts-derivability.js";
import { judgeTsDeclaration } from "../helpers/workspace.js";
import {
  T14_12_CODE_FORM_VECTORS,
  T14_12_UNPARSEABLE_ARMS,
} from "../suite/registry/section-14-iii.js";
import { P1_TS_FORM_VECTORS } from "../suite/registry/section-16-p1.js";
import { P10_TS_FORM_VECTORS } from "../suite/registry/section-16-p10.js";
import { P12_TS_FORM_VECTORS } from "../suite/registry/section-16-p12.js";
import { P13_TS_FORM_VECTORS } from "../suite/registry/section-16-p13.js";
import { P2_P3_TS_FORM_VECTORS } from "../suite/registry/section-16-p2-p3.js";
import { P4_TS_FORM_VECTORS } from "../suite/registry/section-16-p4.js";
import { P5_P6_TS_FORM_VECTORS } from "../suite/registry/section-16-p5-p6.js";
import { P7_TS_FORM_VECTORS } from "../suite/registry/section-16-p7.js";
import { P8_P11_TS_FORM_VECTORS } from "../suite/registry/section-16-p8.js";
import { P9_TS_FORM_VECTORS } from "../suite/registry/section-16-p9.js";

const cp = (code: number): string => String.fromCodePoint(code);

/** U+2EBF0, CJK Unified Ideographs Extension I's first character (Unicode 15.1). */
const EXT_I = cp(0x2ebf0);
/** U+1C89, a Unicode 16 letter: no identifier character for TypeScript 5.9.3. */
const U16_LETTER = cp(0x1c89);
const ZWSP = cp(0x200b);
const NEL = cp(0x0085);
const BOM = cp(0xfeff);
const CR = cp(0x000d);
const LF = cp(0x000a);

/** Lines joined by U+000A, the last one terminated. */
const lines = (...parts: readonly string[]): string => parts.join(LF) + LF;

const CODE_IMPORT = 'import A from "../specs/A.xspec"';

/** A configuration over one spec group, its import line and callee given. */
const configWith = (importLine: string, callee = "defineConfig"): string =>
  lines(
    importLine,
    "",
    `export default ${callee}({`,
    "  specs: {",
    '    main: ["specs/**/*.mdx"]',
    "  }",
    "})",
  );

/** `[name, file name, source]`. */
type Vector = readonly [string, string, string];

const WELL_FORMED: readonly Vector[] = [
  // T14-12's post-parse arms (l)–(o): each a rule 14.20 excludes.
  [
    "T14-12 (l): a rest parameter that is not last",
    "src/app.ts",
    lines(
      CODE_IMPORT,
      "",
      "function f(...r: number[], x: number) {",
      "  A.a",
      "}",
    ),
  ],
  [
    "T14-12 (m): a misplaced modifier, `abstract m(): void` in a non-abstract class",
    "src/app.ts",
    lines(
      CODE_IMPORT,
      "",
      "class C {",
      "  abstract m(): void",
      "  run(): void {",
      "    A.a",
      "  }",
      "}",
    ),
  ],
  [
    "T14-12 (n): a duplicate declaration, `let a; let a;`",
    "src/app.ts",
    lines(
      CODE_IMPORT,
      "",
      "let a; let a;",
      "",
      "function f(): void {",
      "  A.a",
      "}",
    ),
  ],
  [
    'T14-12 (o): a type error, `const n: number = "x"`',
    "src/app.ts",
    lines(
      CODE_IMPORT,
      "",
      'const n: number = "x"',
      "",
      "function f(): void {",
      "  A.a",
      "}",
    ),
  ],
  // T14-12's release pin: forms earlier releases reject.
  [
    "T14-12 release pin: `{ using x = f(); }`",
    "src/app.ts",
    lines(
      CODE_IMPORT,
      "",
      "{ using x = f(); }",
      "",
      "function k(): void {",
      "  A.a",
      "}",
    ),
  ],
  [
    "T14-12 release pin: `async function g() { await using y = h(); }`",
    "src/app.ts",
    lines(
      CODE_IMPORT,
      "",
      "async function g() { await using y = h(); }",
      "",
      "function k(): void {",
      "  A.a",
      "}",
    ),
  ],
  [
    'T14-12 release pin: `import a from "./a.json" with { type: "json" };`',
    "src/app.ts",
    lines(
      CODE_IMPORT,
      'import a from "./a.json" with { type: "json" };',
      "",
      "function k(): void {",
      "  A.a",
      "}",
    ),
  ],
  // T14-12's language level: ESNext's identifier tables admit U+2EBF0.
  [
    "T14-12 language level: `const` U+2EBF0 `= 1` and the marker `S.` U+2EBF0 inside one unit",
    "src/app.ts",
    lines(
      'import S from "../specs/S.xspec"',
      "",
      "function f(): void {",
      `  const ${EXT_I} = 1`,
      `  S.${EXT_I}`,
      "}",
    ),
  ],
  [
    "T14-12 language level: a configuration importing `defineConfig as` U+2EBF0 (T7-2's aliased import)",
    "xspec.config.ts",
    configWith(`import { defineConfig as ${EXT_I} } from "xspec"`, EXT_I),
  ],
  // T14-12's whitespace: the release's scanner takes U+200B and U+0085 as whitespace.
  [
    "T14-12 whitespace: `const` U+200B `a = 1`, and `const` U+0085 `b = 1` on a later line",
    "src/app.ts",
    lines(
      CODE_IMPORT,
      "",
      `const${ZWSP}a = 1`,
      `const${NEL}b = 1`,
      "",
      "function f(): void {",
      "  A.a",
      "}",
    ),
  ],
  // T4-2: the relative-name and undeclared module declarations, and the
  // other module-linking forms — every file's finding 14.15's, post-parse.
  [
    'T4-2: `declare module "./NAME.xspec" { }` as a module augmentation, its file holding `export {}`',
    "src/aug.ts",
    lines('declare module "./NAME.xspec" { }', "", "export {}"),
  ],
  [
    'T4-2: the undeclared `module "./NAME.xspec" { }`',
    "src/c.ts",
    lines('module "./NAME.xspec" { }'),
  ],
  [
    'T4-2: the non-relative ambient wildcard `declare module "*.xspec" { }`',
    "src/c.ts",
    lines('declare module "*.xspec" { }'),
  ],
  [
    'T4-2: `import X = require("./NAME.xspec")`',
    "src/c.ts",
    lines('import X = require("./NAME.xspec")'),
  ],
  [
    "T4-2: import types naming a `.xspec` module",
    "src/c.ts",
    lines(
      'type T = import("./NAME.xspec").default',
      'let v: typeof import("./NAME.xspec")',
    ),
  ],
  [
    "T4-2: export declarations whose module specifier ends in `.xspec`",
    "src/c.ts",
    lines(
      'export * from "./NAME.xspec"',
      'export * as NS from "./NAME.xspec"',
      'export { default as N } from "./NAME.xspec"',
      'export type { default as T } from "./NAME.xspec"',
    ),
  ],
  [
    "T4-2: a side-effect-only import, a namespace import, and a named binding other than `text`",
    "src/c.ts",
    lines(
      'import "./NAME.xspec"',
      'import * as NS from "./NAME.xspec"',
      'import { other } from "./NAME.xspec"',
    ),
  ],
  [
    "T4-2: a static-specifier dynamic `import()`, and one whose specifier is a variable",
    "src/c.ts",
    lines(
      'const m = import("./NAME.xspec")',
      'const p = "./NAME.xspec"',
      "const n = import(p)",
    ),
  ],
  [
    "T4-2: the seven spellings that name no module, beside an import and its marker",
    "src/c.ts",
    lines(
      '/// <reference path="../specs/NAME.xspec.ts" />',
      'import NAME from "../specs/NAME.xspec"',
      "",
      'const r1 = require("../specs/NAME.xspec")',
      'const r2 = require("./missing.xspec")',
      'const p = "../specs/NAME.xspec"',
      "const d1 = import(`../specs/NAME.xspec`)",
      "const d2 = import(`./missing.xspec`)",
      "const d3 = import(`../specs/NAME.xspec.ts`)",
      "",
      "function f(): void {",
      "  NAME.a",
      "}",
    ),
  ],
  // T7-2's modifier-bearing configuration imports: the declarative form of
  // 7 refuses each (14.14), never a parse failure.
  [
    'T7-2: `import type { defineConfig } from "xspec"`',
    "xspec.config.ts",
    configWith('import type { defineConfig } from "xspec"'),
  ],
  [
    'T7-2: `import { type defineConfig } from "xspec"`',
    "xspec.config.ts",
    configWith('import { type defineConfig } from "xspec"'),
  ],
  [
    'T7-2: `import defer { defineConfig } from "xspec"`',
    "xspec.config.ts",
    configWith('import defer { defineConfig } from "xspec"'),
  ],
  [
    'T7-2: `import { defineConfig } from "xspec" with { type: "json" }`',
    "xspec.config.ts",
    configWith('import { defineConfig } from "xspec" with { type: "json" }'),
  ],
  // Plain configuration files.
  [
    "a plain `xspec.config.ts`",
    "xspec.config.ts",
    configWith('import { defineConfig } from "xspec"'),
  ],
  [
    "a configuration with a code group, string-literal group names, and comments (T7-2)",
    "xspec.config.ts",
    lines(
      "// before the import",
      'import { defineConfig } from "xspec"',
      "",
      "export default defineConfig({",
      "  specs: {",
      '    "my-group": ["specs/**/*.mdx"] /* between keys */',
      "  },",
      "  code: {",
      '    "test-code": [',
      "      // inside a glob list",
      '      "src/**/*.ts"',
      "    ]",
      "  }",
      "})",
      "// after the export",
    ),
  ],
  // TSX, as the name selects.
  [
    "a `.tsx` file holding JSX",
    "src/view.tsx",
    lines(
      CODE_IMPORT,
      "",
      "export function View() {",
      "  A.a",
      '  return <div className="v">{"x"}<>y</></div>',
      "}",
    ),
  ],
  // The judge's own boundary: an empty file, CRLF line ends, and top-level
  // `await` the two readings take alike (the release parses `await x` as an
  // await expression outside an await context too, leaving it to the checker).
  ["an empty code source", "src/empty.ts", ""],
  [
    "a CRLF-terminated code source",
    "src/app.ts",
    [CODE_IMPORT, "", "function f(): void {", "  A.a", "}", ""].join(CR + LF),
  ],
  ["top-level `await x;`, accepted both ways", "src/app.ts", lines("await x;")],
];

const UNPARSEABLE: readonly Vector[] = [
  [
    "`010` in a `.ts` file — a legacy octal literal (T14-12)",
    "src/app.ts",
    lines(CODE_IMPORT, "", "const n = 010"),
  ],
  [
    "`09` in a `.ts` file — a leading-zero decimal (T14-12)",
    "src/app.ts",
    lines(CODE_IMPORT, "", "const n = 09"),
  ],
  [
    "`const` U+1C89 `x = 1` — U+1C89 begins no identifier (T14-12)",
    "src/app.ts",
    lines(`const ${U16_LETTER}x = 1`),
  ],
  [
    "`const a` U+1C89 `= 1` — nor continues one (T14-12)",
    "src/app.ts",
    lines(`const a${U16_LETTER} = 1`),
  ],
  [
    "T7-2: a configuration that is not well-formed TypeScript (unclosed braces)",
    "xspec.config.ts",
    lines(
      'import { defineConfig } from "xspec"',
      "",
      "export default defineConfig({",
      "  specs: {",
      '    main: ["specs/**/*.mdx"]',
    ),
  ],
  // The grammar the name selects.
  [
    "JSX in a `.ts` file — the name selects plain TypeScript",
    "src/view.ts",
    lines("const e = <div>x</div>"),
  ],
  [
    "a type assertion `<T>x` in a `.tsx` file — JSX there, unclosed",
    "src/view.tsx",
    lines("const v = <T>x"),
  ],
];

/** `[name, file name, source, the one reading that accepts]`. */
const ONE_WAY: readonly (readonly [string, string, string, TsReading])[] = [
  [
    "`await /re/;` (14.20: module code only)",
    "src/app.ts",
    lines("await /re/;"),
    "module",
  ],
  [
    "`let a = await / 2 / 1;` (14.20: script code only)",
    "src/app.ts",
    lines("let a = await / 2 / 1;"),
    "script",
  ],
  [
    "`await /re/;` beside an import and its marker",
    "src/app.ts",
    lines(
      CODE_IMPORT,
      "",
      "await /re/;",
      "",
      "function f(): void {",
      "  A.a",
      "}",
    ),
    "module",
  ],
  [
    "`let a = await / 2 / 1;` in a `.tsx` file",
    "src/view.tsx",
    lines("let a = await / 2 / 1;"),
    "script",
  ],
  [
    "`await /re/;` after a configuration's export",
    "xspec.config.ts",
    configWith('import { defineConfig } from "xspec"') + lines("await /re/;"),
    "module",
  ],
  [
    "`await /re/;` in a declaration file's name — plain TypeScript all the same",
    "src/x.d.ts",
    lines("await /re/;"),
    "module",
  ],
];

/** The verdict on `source`, judged as a string and as its UTF-8 bytes alike. */
function judged(source: string, name: string): TsVerdict {
  const verdict = judgeTypeScript(source, name);
  expect(judgeTypeScript(Buffer.from(source, "utf8"), name)).toEqual(verdict);
  return verdict;
}

function expectUnparseable(
  verdict: TsVerdict,
): Extract<TsVerdict, { verdict: "unparseable" }> {
  if (verdict.verdict !== "unparseable") {
    throw new Error(`expected unparseable, got ${JSON.stringify(verdict)}`);
  }
  return verdict;
}

describe("S-9 (TypeScript): every well-formed code source and configuration file is accepted both ways", () => {
  test("the vector set is non-empty and uniquely named", () => {
    expect(WELL_FORMED.length).toBeGreaterThan(20);
    expect(new Set(WELL_FORMED.map(([name]) => name)).size).toBe(
      WELL_FORMED.length,
    );
  });

  test.each(WELL_FORMED)("%s", (_name, file, source) => {
    const verdict = judged(source, file);
    expect(verdict).toEqual({ verdict: "well-formed" });
    for (const reading of TS_READINGS) {
      expect(readTypeScript(source, file, reading)).toEqual([]);
    }
    expect(tsDeclarationProblem(verdict, "well-formed")).toBeUndefined();
    expect(tsDeclarationProblem(verdict, "unparseable")).toMatch(
      /^declared unparseable, but TypeScript 5\.9\.3 accepts it both as module code and as script code/,
    );
  });
});

describe("S-9 (TypeScript): every declared-unparseable code source and configuration file is rejected both ways", () => {
  test.each(UNPARSEABLE)("%s", (_name, file, source) => {
    const verdict = expectUnparseable(judged(source, file));
    for (const reading of TS_READINGS) {
      expect(verdict.errors[reading].length).toBeGreaterThan(0);
    }
    expect(tsDeclarationProblem(verdict, "unparseable")).toBeUndefined();
    expect(tsDeclarationProblem(verdict, "well-formed")).toMatch(
      /^declared well-formed, but it is not well-formed TypeScript \(5\.9\.3, SPEC 14\.20\): rejected read as module code/,
    );
  });

  test("each rejection is the release's scanner's, located in both readings", () => {
    const at = (source: string) =>
      expectUnparseable(judged(source, "src/app.ts")).errors;
    const octal = at(lines("const n = 010"));
    const leading = at(lines("const n = 09"));
    const letter = at(lines(`const ${U16_LETTER}x = 1`));
    for (const reading of TS_READINGS) {
      // The literal's start: the legacy octal and the leading-zero decimal.
      expect(octal[reading][0]).toMatchObject({
        code: 1121,
        offset: 10,
        line: 1,
        column: 11,
      });
      expect(leading[reading][0]).toMatchObject({
        code: 1489,
        offset: 10,
        line: 1,
        column: 11,
      });
      // U+1C89's first byte, offset 6: "Invalid character."
      expect(letter[reading][0]).toMatchObject({
        code: 1127,
        offset: 6,
        line: 1,
        column: 7,
      });
    }
  });
});

describe("S-9 (TypeScript): T14-12's staged code arms are rejected both ways", () => {
  const codeArms = T14_12_UNPARSEABLE_ARMS.filter(
    (arm) => arm.kind === "code-source",
  );

  test("the code arms are present", () => {
    expect(codeArms.map((arm) => arm.arm)).toEqual(
      expect.arrayContaining(["p", "q", "ac"]),
    );
  });

  test("(ac)'s pinned offset is 6, U+1C89's first byte, where the release itself rejects", () => {
    const arm = codeArms.find((candidate) => candidate.arm === "ac");
    expect(arm).toBeDefined();
    expect(arm?.offset).toBe(6);
    expect(arm?.source.startsWith(`const ${U16_LETTER}x = 1`)).toBe(true);
    const verdict = expectUnparseable(judged(arm?.source ?? "", "src/app.ts"));
    for (const reading of TS_READINGS) {
      // "Invalid character." at the code point: an ASCII prefix, so the
      // release's UTF-16 position is the byte offset.
      expect(verdict.errors[reading][0]).toMatchObject({
        code: 1127,
        offset: 6,
      });
    }
  });

  test.each(
    codeArms.map(
      (arm) =>
        [`T14-12 (${arm.arm}) ${arm.name}`, arm.file, arm.source] as const,
    ),
  )("%s", (_name, file, source) => {
    const verdict = expectUnparseable(judged(source, file));
    expect(tsDeclarationProblem(verdict, "unparseable")).toBeUndefined();
  });
});

// T14-12's positive code arms as staged (section-14-iii.ts): the post-parse
// arms, the release pin, the language level (the code source and the
// configuration), and the whitespace arm — each accepted both ways.
describe("S-9 (TypeScript): every code source and configuration T14-12's positive arms stage is accepted both ways", () => {
  test("the vector set is complete and uniquely named", () => {
    expect(T14_12_CODE_FORM_VECTORS.length).toBe(10);
    expect(new Set(T14_12_CODE_FORM_VECTORS.map(([name]) => name)).size).toBe(
      T14_12_CODE_FORM_VECTORS.length,
    );
  });

  test.each(T14_12_CODE_FORM_VECTORS)("%s", (_name, file, source) => {
    expect(judged(source, file)).toEqual({ verdict: "well-formed" });
    for (const reading of TS_READINGS) {
      expect(readTypeScript(source, file, reading)).toEqual([]);
    }
  });
});

// The §16 generators' TypeScript forms (S-9: every code source and
// configuration file the document declares well-formed, generated form
// included, is judged before any product exists; the §16 preamble: every
// generated workspace is valid by construction, no draw declared
// unparseable). The fixed vector set: every property's configuration file
// — P-7's and P-13's composed per draw, the rest fixed records also judged
// by test/self/s9-staged-sources.test.ts — P-7's capture sources, P-13's
// `c0/U.ts` and `c1/V.ts`, and P-8's and P-11's base code source, each
// built from its generator's own templates and constants and judged under
// the grammar its staged path selects, through the per-draw judgement the
// property runner applies to each draw (helpers/property.ts `drawSources`).
const GENERATED_TS_FORM_VECTORS: Readonly<
  Record<
    string,
    ReadonlyArray<
      readonly [name: string, path: string, source: string | Uint8Array]
    >
  >
> = {
  "P-1": P1_TS_FORM_VECTORS,
  "P-2/P-3": P2_P3_TS_FORM_VECTORS,
  "P-4": P4_TS_FORM_VECTORS,
  "P-5/P-6": P5_P6_TS_FORM_VECTORS,
  "P-7": P7_TS_FORM_VECTORS,
  "P-8/P-11": P8_P11_TS_FORM_VECTORS,
  "P-9": P9_TS_FORM_VECTORS,
  "P-10": P10_TS_FORM_VECTORS,
  "P-12": P12_TS_FORM_VECTORS,
  "P-13": P13_TS_FORM_VECTORS,
};

const GENERATED_TS_VECTORS = Object.entries(GENERATED_TS_FORM_VECTORS).flatMap(
  ([property, vectors]) =>
    vectors.map(
      ([name, path, source]) => [`${property} ${name}`, path, source] as const,
    ),
);

describe("S-9 (TypeScript): every configuration file and code source the §16 generators compose is accepted both ways", () => {
  test("the vector set covers every property and is uniquely named", () => {
    const covered = Object.keys(GENERATED_TS_FORM_VECTORS).flatMap((key) =>
      key.split("/"),
    );
    expect(covered.sort()).toEqual(
      Array.from({ length: 13 }, (_, i) => `P-${String(i + 1)}`).sort(),
    );
    for (const vectors of Object.values(GENERATED_TS_FORM_VECTORS)) {
      expect(vectors.some(([, path]) => path === "xspec.config.ts")).toBe(true);
    }
    expect(GENERATED_TS_VECTORS.length).toBe(22);
    expect(new Set(GENERATED_TS_VECTORS.map(([name]) => name)).size).toBe(
      GENERATED_TS_VECTORS.length,
    );
  });

  test("P-7's capture sources, P-13's `c0/U.ts` and `c1/V.ts`, and the fuzz base code source are among them", () => {
    const paths = new Set(GENERATED_TS_VECTORS.map(([, path]) => path));
    for (const path of ["c0/U.ts", "c1/V.ts", "src/app.ts"]) {
      expect(paths.has(path)).toBe(true);
    }
    expect(
      P7_TS_FORM_VECTORS.filter(([name]) => name.includes("codeSource")).length,
    ).toBe(3);
  });

  test.each(GENERATED_TS_VECTORS)("%s", (name, path, source) => {
    const verdict = judgeTypeScript(source, path);
    expect(verdict).toEqual({ verdict: "well-formed" });
    const bytes =
      typeof source === "string" ? Buffer.from(source, "utf8") : source;
    expect(judgeTypeScript(bytes, path)).toEqual(verdict);
    expect(() => {
      judgeTsDeclaration(name, bytes, "per-draw", path);
    }).not.toThrow();
  });
});

describe("S-9 (TypeScript): text accepted read one way only is a harness error whatever the declaration", () => {
  test.each(ONE_WAY)("%s", (_name, file, source, accepts) => {
    const verdict = judged(source, file);
    expect(verdict).toMatchObject({ verdict: "one-way", accepts });
    // Each reading on its own: a judge reading one way only cannot tell.
    const rejects: TsReading = accepts === "module" ? "script" : "module";
    expect(readTypeScript(source, file, accepts)).toEqual([]);
    expect(readTypeScript(source, file, rejects).length).toBeGreaterThan(0);
    for (const declared of ["well-formed", "unparseable"] as const) {
      expect(tsDeclarationProblem(verdict, declared)).toMatch(
        new RegExp(
          `^declared ${declared}, but under TypeScript 5\\.9\\.3 it is accepted read as ${accepts} code only, rejected read as ${rejects} code`,
        ),
      );
    }
  });
});

describe("S-9 (TypeScript): the encoding rules of 14.20 the parser does not apply (SPEC 1.6)", () => {
  const WELL_FORMED_TEXT = lines(CODE_IMPORT, "", "const a = 1");

  test("a leading byte-order mark is unparseable, bytes and string alike", () => {
    // The release's scanner itself skips a leading U+FEFF as whitespace.
    expect(
      readTypeScript(BOM + WELL_FORMED_TEXT, "src/app.ts", "module"),
    ).toEqual([]);
    const fromBytes = expectUnparseable(
      judgeTypeScript(
        Buffer.concat([
          Buffer.from([0xef, 0xbb, 0xbf]),
          Buffer.from(WELL_FORMED_TEXT, "utf8"),
        ]),
        "src/app.ts",
      ),
    );
    expect(fromBytes.reason).toContain("byte-order mark");
    expect(fromBytes.errors).toEqual({ module: [], script: [] });
    expect(
      expectUnparseable(
        judgeTypeScript(BOM + WELL_FORMED_TEXT, "xspec.config.ts"),
      ).reason,
    ).toContain("byte-order mark");
    // A U+FEFF elsewhere is content: whitespace to the release's scanner.
    expect(judged(lines(`const a =${BOM}1`), "src/app.ts")).toEqual({
      verdict: "well-formed",
    });
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
    "invalid UTF-8 %s is unparseable at its byte offset",
    (_name, bytes, offset) => {
      const verdict = expectUnparseable(
        judgeTypeScript(Uint8Array.from(bytes), "src/app.ts"),
      );
      expect(verdict.reason).toBe(
        `not valid UTF-8: an invalid sequence at byte offset ${offset} (SPEC 1.6)`,
      );
      expect(tsDeclarationProblem(verdict, "well-formed")).toContain(
        "not valid UTF-8",
      );
    },
  );

  test("a string holding a lone surrogate encodes as no UTF-8", () => {
    const verdict = expectUnparseable(
      judgeTypeScript(
        `const a = "${String.fromCharCode(0xd800)}"`,
        "src/app.ts",
      ),
    );
    expect(verdict.reason).toBe(
      "not encodable as UTF-8: a lone surrogate at index 11",
    );
  });
});
