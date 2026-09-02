// SPEC 6.5's added-import insertion discipline, asserted value-blind
// (TEST-SPEC T6.5-8; shared by T6.5-3's third-file arms and T6.5-8's arms).
// Harness machinery only: no product imports.
//
// An added import "is inserted as a line of its own — the declaration's
// characters followed by a U+000A line terminator, preceded by one when the
// insertion point is not at the start of a line — at an offset where the
// file's grammar permits an import declaration; the identifier choice and
// the insertion offset are implementation latitude" (SPEC 6.5). A test
// therefore composes the receiving file's expected post-operation bytes from
// the rules of 6.4/6.5 and 3 WITHOUT the added import (`base`, with the
// fresh identifier read off the rewritten references), and this module
// isolates, by diff against the product's bytes (`actual`), the single byte
// run whose insertion turns `base` into `actual`, then asserts that run is
// exactly the declaration plus its terminators for the offset it lies at.
//
// Offsets are a range, not a point: a run whose end bytes repeat the bytes
// beside it admits several insertion offsets describing the same bytes
// (`A\n` + `import X\n` + `B` equals `A` + `\nimport X` + `\nB`). Bytes are
// the only observable here, so the discipline holds when SOME admissible
// offset reads as a disciplined insertion — a product is never failed for
// output byte-identical to a conforming one — and is violated when none
// does: a declaration joined to a neighbour with `;`, a mid-line offset
// without its preceding terminator, a spurious blank line, or any terminator
// but U+000A leaves no admissible reading (T6.5-8).

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

/** One disciplined reading of an added import (SPEC 6.5, 2.1). */
export interface AddedImportReading {
  /** Insertion offset into `base` (pre-insertion coordinates). */
  readonly offset: number;
  /** Whether that offset lies at the start of a line of `base`. */
  readonly atLineStart: boolean;
  /** The declaration's characters (no terminator). */
  readonly declaration: string;
  /** The identifier the declaration binds. */
  readonly identifier: string;
  /** The specifier literal's text, as the product spelled it. */
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
  /** Workspace-relative module path the specifier must designate. */
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

const DECLARATION =
  /^import[ \t]+([A-Za-z_$][A-Za-z0-9_$]*)[ \t]+from[ \t]+(["'])([^"'\n\r]*)\2[ \t]*;?$/;

/**
 * Read one admissible offset as a disciplined added import; `null` with a
 * reason when it does not read as one.
 */
function readInsertion(
  options: AddedImportOptions,
  offset: number,
  length: number,
): { reading: AddedImportReading } | { reason: string } {
  const { base, actual, importerDir, expectedModule, identifier } = options;
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
  const declaration = Buffer.from(body.subarray(0, body.length - 1)).toString(
    "utf8",
  );
  const match = DECLARATION.exec(declaration);
  if (match === null) {
    return {
      reason:
        `between its terminators the run must hold exactly one default ` +
        `import declaration of 2.1's form on one line; it holds ` +
        `${JSON.stringify(declaration)}`,
    };
  }
  const [, bound, , specifier] = match as unknown as [
    string,
    string,
    string,
    string,
  ];
  if (bound !== identifier) {
    return {
      reason:
        `the declaration binds ${JSON.stringify(bound)} but the rewritten ` +
        `references are rooted at ${JSON.stringify(identifier)}`,
    };
  }
  const relative = specifier.startsWith("./") || specifier.startsWith("../");
  if (!relative || !specifier.endsWith(".xspec")) {
    return {
      reason:
        `the specifier ${JSON.stringify(specifier)} must be a relative path ` +
        `beginning with \`./\` or \`../\` and ending in \`.xspec\` (SPEC 2.1)`,
    };
  }
  const resolved = posixPath.join(importerDir, specifier);
  if (resolved !== expectedModule) {
    return {
      reason:
        `the specifier ${JSON.stringify(specifier)}, resolved against ` +
        `${importerDir}/, designates ${resolved} rather than ${expectedModule}`,
    };
  }
  return {
    reading: { offset, atLineStart, declaration, identifier: bound, specifier },
  };
}

/**
 * Assert that `actual` is `base` with exactly one import declaration
 * inserted under SPEC 6.5's line discipline — the declaration's characters
 * followed by U+000A at an offset lying at the start of a line, and U+000A,
 * the declaration, then U+000A at one that does not — binding `identifier`
 * to a 2.1-form specifier designating `expectedModule` from `importerDir`,
 * no other byte inserted. The offset and the specifier's relative spelling
 * are the product's; the accepted reading is returned.
 */
export function assertAddedImportInsertion(
  options: AddedImportOptions,
  context: string,
): AddedImportReading {
  const label = `${context}: ${options.rel}`;
  const insertion = isolateSingleInsertion(options.base, options.actual, label);
  const reasons: string[] = [];
  for (
    let offset = insertion.highestOffset;
    offset >= insertion.lowestOffset;
    offset -= 1
  ) {
    const read = readInsertion(options, offset, insertion.length);
    if ("reading" in read) return read.reading;
    reasons.push(`at offset ${String(offset)}: ${read.reason}`);
  }
  const shown = options.actual.subarray(
    insertion.highestOffset,
    insertion.highestOffset + insertion.length,
  );
  fail(
    `${label} — the single inserted run ` +
      `${JSON.stringify(Buffer.from(shown).toString("utf8"))} is not an ` +
      `added import under 6.5's line discipline (the declaration's ` +
      `characters followed by U+000A, preceded by one when the insertion ` +
      `point is not at the start of a line; one import of ` +
      `${options.expectedModule} binding ${JSON.stringify(options.identifier)}, ` +
      `no other byte inserted — SPEC 6.5, 2.1) under any admissible reading: ` +
      reasons.join("; "),
  );
}
