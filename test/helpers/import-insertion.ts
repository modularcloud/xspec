// SPEC 6.5's added-import insertion discipline, asserted value-blind in the
// fresh identifier and byte-exact in every other character (TEST-SPEC
// T6.5-8; shared by T6.5-3's third-file arms and T6.5-10's arms (a) and
// (c), whose receiving files, like T6.5-8's, hold a line-start admissible
// offset). Harness machinery only: no product imports.
//
// An added import "is spelled exactly: `import X from "…"` in a spec source
// […] — single spaces as shown, no statement terminator, the specifier
// double-quoted in the canonical spelling a specifier rewrite produces
// […], from the importing file's directory" and "is inserted as a line of
// its own — the declaration's characters followed by a U+000A line
// terminator, preceded by one when the insertion point is not at the start
// of a line", where "an admissible offset at the start of a line […] is
// taken over any other" (SPEC 6.5); the identifier choice alone is
// latitude. A test therefore composes the receiving file's expected
// post-operation bytes from the rules of 6.4/6.5 and 3 WITHOUT the added
// import (`base`, with the fresh identifier read off the rewritten
// references), and this module isolates, by diff against the product's
// bytes (`actual`), the single byte run whose insertion turns `base` into
// `actual`, then asserts that run is exactly the declaration — `import `,
// the identifier, ` from "`, the canonical specifier, `"` — followed by
// U+000A, at an offset lying at the start of a line of the composed text.
//
// Offsets are a range, not a point: a run whose end bytes repeat the bytes
// beside it admits several insertion offsets describing the same bytes
// (`A\n` + `import X\n` + `B` equals `A` + `\nimport X` + `\nB`). Bytes are
// the only observable here, so the discipline holds when SOME admissible
// offset reads as the disciplined insertion — a product is never failed for
// output byte-identical to a conforming one — and is violated when none
// does: a declaration joined to a neighbour with `;`, the mid-line form
// (U+000A, the declaration, U+000A) while the receiving file holds a
// line-start admissible offset, a spurious blank line, any terminator but
// U+000A, or any other spelling of the declaration — single quotes, a `;`,
// other spacing, a non-canonical specifier (`./sub/../target.xspec`, no
// `./` prefix, a `.mdx` extension, a `.` segment) — leaves no admissible
// reading (T6.5-8). The forced mid-line form of a file holding no
// line-start admissible offset (T6.5-13) is not this reader's: the
// exact-declaration reader below reads both forms and reports which one it
// read (T6.5-11).

import { Buffer } from "node:buffer";
import { posix as posixPath } from "node:path";
import { fail } from "./assertions.js";

const LF = 0x0a;

/** The single run whose insertion into `base` yields `actual`. */
export interface SingleInsertion {
  /** Byte length of the inserted run. */
  readonly length: number;
  /** Lowest admissible insertion offset into `base`. */
  readonly lowestOffset: number;
  /** Highest admissible insertion offset into `base`. */
  readonly highestOffset: number;
}

/** The accepted reading of an added import (SPEC 6.5, 2.1). */
export interface AddedImportReading {
  /**
   * Insertion offset into `base` (pre-insertion coordinates), at the start
   * of a line of `base`.
   */
  readonly offset: number;
  /** The declaration's characters (no terminator), 6.5's exact spelling. */
  readonly declaration: string;
  /** The identifier the declaration binds. */
  readonly identifier: string;
  /** The specifier literal's text: the canonical relative spelling. */
  readonly specifier: string;
}

export interface AddedImportOptions {
  /** Workspace-relative path of the receiving file, for diagnoses. */
  readonly rel: string;
  /** Expected post-operation bytes composed WITHOUT the added import. */
  readonly base: Uint8Array;
  /** The product's post-operation bytes. */
  readonly actual: Uint8Array;
  /** Workspace-relative POSIX directory of the receiving file. */
  readonly importerDir: string;
  /**
   * Workspace-relative path of the module the specifier must designate, in
   * the `.xspec` spelling an import names it by (SPEC 2.1).
   */
  readonly expectedModule: string;
  /** The identifier the rewritten references are rooted at. */
  readonly identifier: string;
}

function firstDifference(a: Uint8Array, b: Uint8Array): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : shared;
}

function excerpt(bytes: Uint8Array, offset: number, width = 32): string {
  return JSON.stringify(
    Buffer.from(bytes.subarray(offset, offset + width)).toString("utf8"),
  );
}

/**
 * Isolate the single contiguous byte run whose insertion into `base` yields
 * `actual`, failing diagnosed (H-8) when `actual` is not `base` with exactly
 * one run inserted — bytes changed elsewhere, nothing inserted, or two
 * separate runs.
 */
export function isolateSingleInsertion(
  base: Uint8Array,
  actual: Uint8Array,
  context: string,
): SingleInsertion {
  const length = actual.length - base.length;
  if (length <= 0) {
    const drift = firstDifference(base, actual);
    fail(
      drift === -1
        ? `${context}: no bytes were inserted — the file is byte-identical ` +
            `to its expected bytes without the added import`
        : `${context}: the file is ${String(actual.length)} bytes against ` +
            `${String(base.length)} expected without the added import, so ` +
            `no single run was inserted; the bytes diverge at offset ` +
            `${String(drift)} (expected ${excerpt(base, drift)}…, actual ` +
            `${excerpt(actual, drift)}…)`,
    );
  }
  let prefix = 0;
  while (prefix < base.length && base[prefix] === actual[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < base.length &&
    base[base.length - 1 - suffix] === actual[actual.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const lowestOffset = Math.max(0, base.length - suffix);
  const highestOffset = Math.min(prefix, base.length);
  if (lowestOffset > highestOffset) {
    fail(
      `${context}: the file is not its expected bytes with one run ` +
        `inserted — the bytes diverge from the expected bytes at offset ` +
        `${String(prefix)} (expected ${excerpt(base, prefix)}…, actual ` +
        `${excerpt(actual, prefix)}…) and again, counted from the end, ` +
        `${String(suffix)} bytes before it: more than one edit, or an edit ` +
        `outside the added import`,
    );
  }
  return { length, lowestOffset, highestOffset };
}

/**
 * SPEC 6.5's canonical relative spelling of `modulePath` (workspace-relative,
 * in its `.xspec` spelling) from `importerDir` (a workspace-relative POSIX
 * directory; `""` or `.` for the root): the `..` ascents, then the
 * descending segments, joined with `/`, no `.` segments, prefixed `./` when
 * there is no ascent (SPEC 6.5, 2.1) — the specifier an added import is
 * spelled with and a specifier rewrite produces.
 */
export function canonicalSpecifier(
  importerDir: string,
  modulePath: string,
): string {
  const segments = (path: string): string[] =>
    path.split("/").filter((segment) => segment !== "" && segment !== ".");
  const dir = segments(importerDir);
  const target = segments(modulePath);
  let shared = 0;
  while (
    shared < dir.length &&
    shared < target.length - 1 &&
    dir[shared] === target[shared]
  ) {
    shared += 1;
  }
  const ascents = dir.length - shared;
  const spelled = [
    ...Array.from({ length: ascents }, () => ".."),
    ...target.slice(shared),
  ].join("/");
  return ascents === 0 ? `./${spelled}` : spelled;
}

/** The exact declaration an added import must be (SPEC 6.5). */
interface ExpectedDeclaration {
  /** `import <identifier> from "<specifier>"`. */
  readonly text: string;
  readonly bytes: Uint8Array;
  /** The canonical relative specifier. */
  readonly specifier: string;
}

/**
 * A default import declaration read loosely — any spacing, either quote
 * style, an optional `;` — for diagnosing HOW a held declaration deviates
 * from the exact spelling; never a ground of acceptance.
 */
const LOOSE_DECLARATION =
  /^import([ \t]+)([A-Za-z_$][A-Za-z0-9_$]*)([ \t]+)from([ \t]+)(["'])([^"'\n\r]*)\5([ \t]*;?[ \t]*)$/;

/** Why `held` (the run between its terminators) is not the declaration. */
function explainDeclaration(
  held: string,
  options: AddedImportOptions,
  expected: ExpectedDeclaration,
): string {
  const shown = JSON.stringify(held);
  if (held.endsWith("\r")) {
    return (
      `the line holding ${shown} ends in U+000D before its U+000A — 6.5's ` +
      `terminator is U+000A alone`
    );
  }
  if (held.includes("\n")) {
    return (
      `the run holds more than one line before its final terminator, ` +
      `${shown} — a spurious blank line or a second line beside the ` +
      `declaration`
    );
  }
  const match = LOOSE_DECLARATION.exec(held);
  if (match === null) {
    return (
      `between its terminators the run must hold exactly the declaration ` +
      `${JSON.stringify(expected.text)}; it holds ${shown}, not a default ` +
      `import declaration of 2.1's form`
    );
  }
  const [, gap1, bound, gap2, gap3, quote, spelled, trailing] =
    match as unknown as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
  const deviations: string[] = [];
  if (bound !== options.identifier) {
    deviations.push(
      `it binds ${JSON.stringify(bound)} but the rewritten references are ` +
        `rooted at ${JSON.stringify(options.identifier)}`,
    );
  }
  if (gap1 !== " " || gap2 !== " " || gap3 !== " ") {
    deviations.push("its spacing is not the single spaces 6.5 shows");
  }
  if (quote !== '"') {
    deviations.push(
      "its specifier is single-quoted where 6.5 double-quotes it",
    );
  }
  if (trailing.includes(";")) {
    deviations.push(
      "it carries a statement terminator, which 6.5 spells none of",
    );
  } else if (trailing !== "") {
    deviations.push("it carries trailing whitespace");
  }
  if (spelled !== expected.specifier) {
    const relative = spelled.startsWith("./") || spelled.startsWith("../");
    const importerDir = options.importerDir === "" ? "." : options.importerDir;
    const resolved = posixPath.join(importerDir, spelled);
    if (!relative || !spelled.endsWith(".xspec")) {
      deviations.push(
        `its specifier ${JSON.stringify(spelled)} is not a relative path ` +
          `beginning with \`./\` or \`../\` and ending in \`.xspec\` (2.1)`,
      );
    } else if (resolved !== options.expectedModule) {
      deviations.push(
        `its specifier ${JSON.stringify(spelled)}, resolved against ` +
          `${importerDir}/, designates ${resolved} rather than ` +
          `${options.expectedModule}`,
      );
    } else {
      deviations.push(
        `its specifier ${JSON.stringify(spelled)} designates ` +
          `${options.expectedModule} but is not the canonical relative ` +
          `spelling ${JSON.stringify(expected.specifier)} (6.5: the \`..\` ` +
          `ascents, then the descending segments, no \`.\` segments, ` +
          `prefixed \`./\` when there is no ascent)`,
      );
    }
  }
  if (deviations.length === 0) deviations.push("it differs in its characters");
  return (
    `the declaration must be byte-exactly ${JSON.stringify(expected.text)} ` +
    `(6.5's spelling: single spaces, no statement terminator, the specifier ` +
    `double-quoted in its canonical relative spelling); it is ${shown}: ` +
    deviations.join("; ")
  );
}

/**
 * Read one admissible offset as the disciplined added import; a reason
 * when it does not read as one.
 */
function readInsertion(
  options: AddedImportOptions,
  offset: number,
  length: number,
  expected: ExpectedDeclaration,
): { reading: AddedImportReading } | { reason: string } {
  const { base, actual, identifier } = options;
  if (offset !== 0 && base[offset - 1] !== LF) {
    return {
      reason:
        actual[offset] === LF
          ? "the offset is not at the start of a line of the composed text " +
            "and the run is the mid-line form (U+000A, the declaration, " +
            "U+000A), but 6.5 takes a line-start admissible offset, which " +
            "the receiving file holds, over any other (T6.5-8)"
          : "the offset is not at the start of a line of the composed text " +
            "and the run begins with no U+000A, so the inserted characters " +
            "join the preceding line — a declaration joined to its " +
            "neighbour, or a mid-line offset without its preceding " +
            "terminator",
    };
  }
  const run = actual.subarray(offset, offset + length);
  if (run.length === 0 || run[run.length - 1] !== LF) {
    return { reason: "the run must end with a U+000A line terminator" };
  }
  const held = run.subarray(0, run.length - 1);
  if (Buffer.compare(held, expected.bytes) !== 0) {
    return {
      reason: explainDeclaration(
        Buffer.from(held).toString("utf8"),
        options,
        expected,
      ),
    };
  }
  return {
    reading: {
      offset,
      declaration: expected.text,
      identifier,
      specifier: expected.specifier,
    },
  };
}

/**
 * Assert that `actual` is `base` with exactly one import declaration
 * inserted under SPEC 6.5's spelling and line discipline: byte-exactly
 * `import <identifier> from "<specifier>"` — single spaces, no statement
 * terminator, the specifier double-quoted in the canonical relative
 * spelling of `expectedModule` from `importerDir` — followed by U+000A, at
 * an offset lying at the start of a line of `base` (a line-start
 * admissible offset, which the receiving file holds, is taken over any
 * other), no other byte inserted. The identifier is the one the caller
 * read off the rewritten references, so its value stays the product's
 * (6.5's latitude); the offset is the product's among the line-start
 * readings. The accepted reading is returned.
 */
export function assertAddedImportInsertion(
  options: AddedImportOptions,
  context: string,
): AddedImportReading {
  const label = `${context}: ${options.rel}`;
  const insertion = isolateSingleInsertion(options.base, options.actual, label);
  const specifier = canonicalSpecifier(
    options.importerDir,
    options.expectedModule,
  );
  const text = `import ${options.identifier} from "${specifier}"`;
  const expected: ExpectedDeclaration = {
    text,
    bytes: Buffer.from(text, "utf8"),
    specifier,
  };
  // Consecutive offsets sharing one reason are reported as a range.
  const reasons: { from: number; to: number; reason: string }[] = [];
  for (
    let offset = insertion.highestOffset;
    offset >= insertion.lowestOffset;
    offset -= 1
  ) {
    const read = readInsertion(options, offset, insertion.length, expected);
    if ("reading" in read) return read.reading;
    const last = reasons[reasons.length - 1];
    if (last !== undefined && last.reason === read.reason) last.to = offset;
    else reasons.push({ from: offset, to: offset, reason: read.reason });
  }
  const shown = options.actual.subarray(
    insertion.highestOffset,
    insertion.highestOffset + insertion.length,
  );
  fail(
    `${label} — the single inserted run ` +
      `${JSON.stringify(Buffer.from(shown).toString("utf8"))} is not the ` +
      `added import ${JSON.stringify(text)} followed by U+000A at a ` +
      `line-start offset (6.5's spelling and line discipline, T6.5-8: single ` +
      `spaces, no statement terminator, the specifier double-quoted in its ` +
      `canonical relative spelling from ${options.importerDir || "."}/, the ` +
      `declaration's characters then U+000A at a line-start admissible ` +
      `offset, which the receiving file holds and 6.5 takes over any other; ` +
      `no other byte inserted — SPEC 6.5, 2.1) under any admissible reading: ` +
      reasons
        .map(({ from, to, reason }) =>
          from === to
            ? `at offset ${String(from)}: ${reason}`
            : `at offsets ${String(to)}–${String(from)}: ${reason}`,
        )
        .join("; "),
  );
}

/** Options for {@link assertExactDeclarationInsertion}. */
export interface ExactInsertionOptions {
  /** Workspace-relative path of the receiving file, for diagnoses. */
  readonly rel: string;
  /** Expected post-operation bytes composed WITHOUT the added import. */
  readonly base: Uint8Array;
  /** The product's post-operation bytes. */
  readonly actual: Uint8Array;
  /** The added declaration's exact characters, no terminator (SPEC 6.5). */
  readonly declaration: string;
}

/** One admissible reading of an exactly spelled added declaration. */
export interface ExactInsertionReading {
  /** Insertion offset into `base` (pre-insertion coordinates). */
  readonly offset: number;
  /** Whether that offset lies at the start of a line of `base`. */
  readonly atLineStart: boolean;
}

/**
 * Read one admissible offset as the exactly spelled declaration under 6.5's
 * line discipline; `null` with a reason when it does not read as one.
 */
function readExactInsertion(
  options: ExactInsertionOptions,
  offset: number,
  length: number,
): { reading: ExactInsertionReading } | { reason: string } {
  const { base, actual, declaration } = options;
  const run = actual.subarray(offset, offset + length);
  const atLineStart = offset === 0 || base[offset - 1] === LF;
  let body = run;
  if (!atLineStart) {
    if (run[0] !== LF) {
      return {
        reason:
          "the offset is not at the start of a line, so the run must begin " +
          "with the preceding U+000A terminator",
      };
    }
    body = run.subarray(1);
  }
  if (body.length === 0 || body[body.length - 1] !== LF) {
    return { reason: "the run must end with a U+000A line terminator" };
  }
  const held = body.subarray(0, body.length - 1);
  if (Buffer.compare(held, Buffer.from(declaration, "utf8")) !== 0) {
    return {
      reason:
        `between its terminators the run must hold exactly the declaration ` +
        `${JSON.stringify(declaration)}; it holds ` +
        `${JSON.stringify(Buffer.from(held).toString("utf8"))}`,
    };
  }
  return { reading: { offset, atLineStart } };
}

/**
 * Assert that `actual` is `base` with exactly one declaration inserted
 * under SPEC 6.5's line discipline — the declaration's characters followed
 * by U+000A at an offset lying at the start of a line, and U+000A, the
 * declaration, then U+000A at one that does not — the declaration
 * byte-exactly `declaration` (6.5's spelling rule: single spaces as
 * shown, no statement terminator, the specifier double-quoted in its
 * canonical spelling — the caller composes it with the fresh identifiers
 * substituted), no other byte inserted. Bytes are the only observable, so
 * every admissible offset that reads as such an insertion is returned
 * (several describe one byte string where the run's terminators repeat the
 * bytes beside it); the offset among them is the product's.
 */
export function assertExactDeclarationInsertion(
  options: ExactInsertionOptions,
  context: string,
): readonly ExactInsertionReading[] {
  const label = `${context}: ${options.rel}`;
  const insertion = isolateSingleInsertion(options.base, options.actual, label);
  const readings: ExactInsertionReading[] = [];
  const reasons: string[] = [];
  for (
    let offset = insertion.highestOffset;
    offset >= insertion.lowestOffset;
    offset -= 1
  ) {
    const read = readExactInsertion(options, offset, insertion.length);
    if ("reading" in read) readings.push(read.reading);
    else reasons.push(`at offset ${String(offset)}: ${read.reason}`);
  }
  if (readings.length > 0) return readings;
  const shown = options.actual.subarray(
    insertion.highestOffset,
    insertion.highestOffset + insertion.length,
  );
  fail(
    `${label} — the single inserted run ` +
      `${JSON.stringify(Buffer.from(shown).toString("utf8"))} is not the ` +
      `added declaration ${JSON.stringify(options.declaration)} under 6.5's ` +
      `line discipline (the declaration's characters followed by U+000A, ` +
      `preceded by one when the insertion point is not at the start of a ` +
      `line; no other byte inserted — SPEC 6.5, 2.1) under any admissible ` +
      `reading: ${reasons.join("; ")}`,
  );
}
