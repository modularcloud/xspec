// Self-checks for the added-import insertion discipline helper
// (`test/helpers/import-insertion.ts`; TEST-SPEC 17 preamble — harness
// machinery certification does not exercise; SPEC 6.5's line discipline,
// asserted value-blind as T6.5-8 reads it). Conforming insertions are
// accepted at a line-start offset and at a mid-line offset — including the
// ambiguous-offset case where the run's own terminators repeat the bytes
// beside it, so several offsets describe one byte string — and every
// violation T6.5-8 names fails as a diagnosed HarnessAssertionError: a
// declaration joined to a neighbour with `;`, a mid-line offset without
// its preceding terminator, a spurious blank line, a CRLF terminator, a
// declaration binding an identifier the rewritten references do not use,
// a specifier designating the wrong module, nothing inserted, and edits
// beyond one inserted run.

import { Buffer } from "node:buffer";
import { expect, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  assertAddedImportInsertion,
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

test("a disciplined added import is accepted at a line-start offset", () => {
  const atTop = check('import T from "./Target.xspec"\n' + BASE);
  expect(atTop).toMatchObject({
    offset: 0,
    atLineStart: true,
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
  expect(second).toMatchObject({ offset: 33, atLineStart: true });
  // Spelling latitude: single quotes, a `../` relative form, a `;`.
  expect(
    check("import T from '../specs/Target.xspec';\n" + BASE).specifier,
  ).toBe("../specs/Target.xspec");
});

test("a disciplined added import is accepted at a mid-line offset", () => {
  // Inserted after the first declaration's closing quote, before its
  // terminator: `\n` + declaration + `\n`, leaving the neighbour's own
  // terminator to start the blank line.
  const midLine =
    'import Org from "./Origin.xspec"' +
    '\nimport T from "./Target.xspec"\n' +
    '\n\n<S id="th" d={T.tm}>\nThird text.\n</S>\n';
  const reading = check(midLine);
  expect(reading.atLineStart).toBe(false);
  expect(reading.declaration).toBe('import T from "./Target.xspec"');
});

test("every violation of the line discipline fails diagnosed", () => {
  const head = 'import Org from "./Origin.xspec"';
  const tail = '\n\n<S id="th" d={T.tm}>\nThird text.\n</S>\n';
  const notImport = "not an added import under 6.5's line discipline";
  // Joined to the neighbour with `;` — still parsing, still resolving.
  expectDiagnosed(
    () => check(head + '; import T from "./Target.xspec"' + tail),
    notImport,
  );
  // Mid-line offset without the preceding terminator.
  expectDiagnosed(
    () => check(head + 'import T from "./Target.xspec"\n' + tail),
    notImport,
    "must begin with the preceding U+000A",
  );
  // A spurious blank line after the declaration.
  expectDiagnosed(
    () => check('import T from "./Target.xspec"\n\n' + BASE),
    notImport,
    "exactly one default import declaration",
  );
  // CRLF terminator.
  expectDiagnosed(
    () => check('import T from "./Target.xspec"\r\n' + BASE),
    notImport,
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
  // Not 2.1's form.
  expectDiagnosed(
    () => check('import T from "Target.xspec"\n' + BASE),
    notImport,
    "relative path",
  );
  // Nothing added at all.
  expectDiagnosed(() => check(BASE), "no bytes were inserted");
});
