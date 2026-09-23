// Self-checks for the added-import insertion discipline helper
// (`test/helpers/import-insertion.ts`; TEST-SPEC 17 preamble — harness
// machinery certification does not exercise; SPEC 6.5's spelling and line
// discipline, asserted value-blind in the fresh identifier and byte-exact in
// every other character, as T6.5-8 reads it). The disciplined insertion —
// `import <X> from "<canonical specifier>"` followed by U+000A at a
// line-start offset — is accepted, including the ambiguous-offset case where
// the run's own terminator repeats the byte beside it, so several offsets
// describe one byte string; the canonical specifier is spelled by 6.5's
// rule; and every failure spelling T6.5-8 names fails as a diagnosed
// HarnessAssertionError: a declaration joined to a neighbour with `;`, the
// mid-line form while a line-start offset exists (and a mid-line offset
// without its preceding terminator), a spurious blank line, a CRLF
// terminator, single quotes, a `;`, other spacing, a non-canonical
// specifier (`./sub/../Target.xspec`, a `.` segment, an ascent into the
// importer's own directory, no `./` prefix, a `.mdx` extension), a
// declaration binding an identifier the rewritten references are not
// rooted at, a specifier designating the wrong module, nothing inserted,
// and edits beyond one inserted run.

import { Buffer } from "node:buffer";
import { expect, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  assertAddedImportInsertion,
  assertExactDeclarationInsertion,
  canonicalSpecifier,
  isolateSingleInsertion,
} from "../helpers/import-insertion.js";

const bytes = (text: string): Uint8Array => Buffer.from(text, "utf8");

const BASE = [
  'import Org from "./Origin.xspec"',
  "",
  '<S id="th" d={T.tm}>',
  "Third text.",
  "</S>",
  "",
].join("\n");

function check(actual: string, identifier = "T") {
  return assertAddedImportInsertion(
    {
      rel: "specs/Third.mdx",
      base: bytes(BASE),
      actual: bytes(actual),
      importerDir: "specs",
      expectedModule: "specs/Target.xspec",
      identifier,
    },
    "self",
  );
}

function expectDiagnosed(run: () => unknown, ...patterns: string[]): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(HarnessAssertionError);
    const message = (error as Error).message;
    for (const pattern of patterns) expect(message).toContain(pattern);
    return;
  }
  throw new Error(
    "expected a diagnosed assertion failure, but the helper passed",
  );
}

test("isolateSingleInsertion reports every admissible offset of one run", () => {
  // `A\n` + `import X\n` + `B` equals `A` + `\nimport X` + `\nB`: offsets 1..2.
  const found = isolateSingleInsertion(
    bytes("A\nB"),
    bytes("A\nimport X\nB"),
    "self",
  );
  expect(found).toEqual({ length: 9, lowestOffset: 1, highestOffset: 2 });
  expectDiagnosed(
    () => isolateSingleInsertion(bytes("A\nB"), bytes("A\nB"), "self"),
    "no bytes were inserted",
  );
  expectDiagnosed(
    () =>
      isolateSingleInsertion(bytes("A\nB"), bytes("A\nimport X\nC"), "self"),
    "not its expected bytes with one run inserted",
  );
  expectDiagnosed(
    () =>
      isolateSingleInsertion(bytes("A\nB\nC"), bytes("A\nX\nB\nY\nC"), "self"),
    "more than one edit",
  );
});

test("canonicalSpecifier spells 6.5's canonical relative form", () => {
  // No ascent: `./` prefixed.
  expect(canonicalSpecifier("specs", "specs/Target.xspec")).toBe(
    "./Target.xspec",
  );
  expect(canonicalSpecifier("specs", "specs/sub/t.xspec")).toBe(
    "./sub/t.xspec",
  );
  expect(canonicalSpecifier("", "specs/t.xspec")).toBe("./specs/t.xspec");
  expect(canonicalSpecifier(".", "specs/t.xspec")).toBe("./specs/t.xspec");
  // Ascents, then the descending segments.
  expect(canonicalSpecifier("src", "specs/target.xspec")).toBe(
    "../specs/target.xspec",
  );
  expect(canonicalSpecifier("src/a/b", "specs/t.xspec")).toBe(
    "../../../specs/t.xspec",
  );
  expect(canonicalSpecifier("specs/sub", "specs/t.xspec")).toBe("../t.xspec");
  expect(canonicalSpecifier("specs/sub", "specs/other/t.xspec")).toBe(
    "../other/t.xspec",
  );
  // The module's basename is a file, never a shared directory segment.
  expect(canonicalSpecifier("specs", "specs.xspec")).toBe("../specs.xspec");
  expect(canonicalSpecifier("a/b", "a/b.xspec")).toBe("../b.xspec");
});

test("the disciplined added import is accepted at a line-start offset", () => {
  const atTop = check('import T from "./Target.xspec"\n' + BASE);
  expect(atTop).toEqual({
    offset: 0,
    declaration: 'import T from "./Target.xspec"',
    identifier: "T",
    specifier: "./Target.xspec",
  });
  // After the first line — the ambiguous case: offset 32 (mid-line, before
  // the terminator) reads as `\n` + declaration without a trailing
  // terminator, offset 33 (line start) as declaration + `\n`; the bytes are
  // one string, and the line-start reading is the accepted one.
  const second = check(
    'import Org from "./Origin.xspec"\nimport T from "./Target.xspec"\n\n<S id="th" d={T.tm}>\nThird text.\n</S>\n',
  );
  expect(second.offset).toBe(33);
  // At the file's end after its final terminator — a line-start admissible
  // offset (SPEC 6.5), the one every receiving file of the consumers holds.
  expect(check(BASE + 'import T from "./Target.xspec"\n').offset).toBe(
    BASE.length,
  );
  // The identifier's value is the product's: another root, read off the
  // rewritten references, is accepted alike.
  expect(
    check('import Tgt from "./Target.xspec"\n' + BASE, "Tgt").identifier,
  ).toBe("Tgt");
  // The TS arm's ascent spelling from `src/` (T6.5-8).
  const tsBase = [
    'import ORG from "../specs/Origin.xspec";',
    "",
    "T.mv;",
    "",
  ].join("\n");
  expect(
    assertAddedImportInsertion(
      {
        rel: "src/app.ts",
        base: bytes(tsBase),
        actual: bytes('import T from "../specs/Target.xspec"\n' + tsBase),
        importerDir: "src",
        expectedModule: "specs/Target.xspec",
        identifier: "T",
      },
      "self",
    ).specifier,
  ).toBe("../specs/Target.xspec");
});

test("every failure spelling T6.5-8 names fails diagnosed", () => {
  const head = 'import Org from "./Origin.xspec"';
  const tail = '\n\n<S id="th" d={T.tm}>\nThird text.\n</S>\n';
  const notImport = "is not the added import";
  // Joined to the neighbour with `;` — still parsing, still resolving.
  expectDiagnosed(
    () => check(head + '; import T from "./Target.xspec"' + tail),
    notImport,
    "join the preceding line",
  );
  // The mid-line form while a line-start offset (33) exists: inserted after
  // the first declaration's closing quote, before its terminator, as `\n` +
  // declaration + `\n` — bytes no line-start insertion produces (a blank
  // line more), so 6.5's preference fails it.
  expectDiagnosed(
    () => check(head + '\nimport T from "./Target.xspec"\n' + tail),
    notImport,
    "mid-line form",
  );
  // Mid-line offset without the preceding terminator.
  expectDiagnosed(
    () => check(head + 'import T from "./Target.xspec"\n' + tail),
    notImport,
    "join the preceding line",
  );
  // A spurious blank line after the declaration.
  expectDiagnosed(
    () => check('import T from "./Target.xspec"\n\n' + BASE),
    notImport,
    "spurious blank line",
  );
  // CRLF terminator.
  expectDiagnosed(
    () => check('import T from "./Target.xspec"\r\n' + BASE),
    notImport,
    "ends in U+000D",
  );
  // Single quotes.
  expectDiagnosed(
    () => check("import T from './Target.xspec'\n" + BASE),
    notImport,
    "single-quoted",
  );
  // A statement terminator.
  expectDiagnosed(
    () => check('import T from "./Target.xspec";\n' + BASE),
    notImport,
    "statement terminator",
  );
  // Other spacing: a doubled space, a tab.
  expectDiagnosed(
    () => check('import  T from "./Target.xspec"\n' + BASE),
    notImport,
    "single spaces",
  );
  expectDiagnosed(
    () => check('import T\tfrom "./Target.xspec"\n' + BASE),
    notImport,
    "single spaces",
  );
  // Non-canonical specifiers designating the right module: a `..` ascent
  // and re-descent, a `.` segment, an ascent into the importer's own
  // directory.
  for (const spelled of [
    "./sub/../Target.xspec",
    "././Target.xspec",
    "../specs/Target.xspec",
  ]) {
    expectDiagnosed(
      () => check(`import T from "${spelled}"\n` + BASE),
      notImport,
      "not the canonical relative spelling",
    );
  }
  // No `./` prefix; a `.mdx` extension (2.1's form).
  expectDiagnosed(
    () => check('import T from "Target.xspec"\n' + BASE),
    notImport,
    "relative path",
  );
  expectDiagnosed(
    () => check('import T from "./Target.mdx"\n' + BASE),
    notImport,
    "ending in `.xspec`",
  );
  // Binds an identifier the rewritten references are not rooted at.
  expectDiagnosed(
    () => check('import Tgt from "./Target.xspec"\n' + BASE),
    notImport,
    'binds "Tgt"',
  );
  // Designates the wrong module.
  expectDiagnosed(
    () => check('import T from "./Origin.xspec"\n' + BASE),
    notImport,
    "designates specs/Origin.xspec rather than specs/Target.xspec",
  );
  // Nothing added at all.
  expectDiagnosed(() => check(BASE), "no bytes were inserted");
});

// The exact-declaration reader (T6.5-11): the added declaration's characters
// are pinned byte-exactly by the caller — 6.5's TypeScript spellings with the
// fresh identifiers substituted — and the line discipline is read as the
// default-import reader reads it.
const TS_BASE = [
  "",
  "export function f(): string {",
  "  return txt(Tgt.y);",
  "}",
  "",
].join("\n");
const TS_DECL = 'import Tgt, { text as txt } from "../specs/target.xspec"';

function checkExact(actual: string, declaration = TS_DECL) {
  return assertExactDeclarationInsertion(
    {
      rel: "src/c.ts",
      base: bytes(TS_BASE),
      actual: bytes(actual),
      declaration,
    },
    "self",
  );
}

test("an exactly spelled declaration is accepted at a line-start offset, every admissible reading returned", () => {
  // At the file's start.
  expect(checkExact(TS_DECL + "\n" + TS_BASE)).toEqual([
    { offset: 0, atLineStart: true },
  ]);
  // After the blank line: the run's terminator repeats the LF beside it, so
  // the isolated run admits offsets 0 and 1, of which only 1 reads as the
  // declaration followed by U+000A.
  expect(checkExact("\n" + TS_DECL + "\n" + TS_BASE.slice(1))).toEqual([
    { offset: 1, atLineStart: true },
  ]);
  // The `{ text }` spelling is the caller's to pin.
  const textDecl = 'import { text } from "../specs/target.xspec"';
  expect(checkExact(textDecl + "\n" + TS_BASE, textDecl)).toEqual([
    { offset: 0, atLineStart: true },
  ]);
});

test("the mid-line form is read with its preceding terminator", () => {
  const head = "\nexport";
  expect(
    checkExact(head + "\n" + TS_DECL + "\n" + TS_BASE.slice(head.length)),
  ).toEqual([{ offset: head.length, atLineStart: false }]);
});

test("every deviation from the exact declaration fails diagnosed", () => {
  const notDecl = "is not the added declaration";
  // Joined to the file with a `;`.
  expectDiagnosed(
    () => checkExact(TS_DECL + ";\n" + TS_BASE),
    notDecl,
    "must hold exactly the declaration",
  );
  // Single-quoted specifier.
  expectDiagnosed(
    () => checkExact(TS_DECL.replace(/"/g, "'") + "\n" + TS_BASE),
    notDecl,
  );
  // A spurious blank line after the declaration.
  expectDiagnosed(() => checkExact(TS_DECL + "\n\n" + TS_BASE), notDecl);
  // CRLF terminator.
  expectDiagnosed(() => checkExact(TS_DECL + "\r\n" + TS_BASE), notDecl);
  // A second declaration kept beside the added one (an import not removed).
  expectDiagnosed(
    () =>
      checkExact(
        TS_DECL + "\n" + 'import O from "../specs/origin.xspec";\n' + TS_BASE,
      ),
    notDecl,
  );
  // Nothing added at all.
  expectDiagnosed(() => checkExact(TS_BASE), "no bytes were inserted");
  // Edits beyond one inserted run.
  expectDiagnosed(
    () => checkExact(TS_DECL + "\n" + TS_BASE.replace("}\n", "};\n")),
    "more than one edit",
  );
});
