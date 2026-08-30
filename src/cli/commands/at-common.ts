// `xspec at` — the argument checks shared by the full path (./at.ts) and
// the store-backed fast path (./at-fast.ts).
//
// SPEC 12.0: output is byte-deterministic for identical input, whichever
// internal path answers — so the two paths share one spelling predicate and
// one diagnostic composition for every usage error of SPEC 11.5. This
// module stays light on purpose: cli/main.ts reaches it through the fast
// path before the TypeScript compiler is loaded.

/** SPEC 11.5: one or more ASCII decimal digits — nothing else. */
const OFFSET_SPELLING = /^[0-9]+$/;

/** Whether `spelling` is a well-formed `<offset>` value (SPEC 11.5). */
export function offsetSpellingOk(spelling: string): boolean {
  return OFFSET_SPELLING.test(spelling);
}

/** The malformed-`<offset>` diagnostic (SPEC 11.5, 12.0). */
export function invalidOffsetMessage(spelling: string): string {
  return (
    `invalid <offset> value '${spelling}' — one or more ASCII decimal ` +
    `digits required (leading zeros permitted; a sign, whitespace, or any ` +
    `other character is not a non-negative integer's spelling) ` +
    `(SPEC 11.5, 12.0)`
  );
}

/** The unknown-`<file>` diagnostic (SPEC 11.5, 11.4, 7, 12.0). */
export function unknownFileMessage(file: string): string {
  return (
    `unknown file '${file}' — the <file> operand names a discovered spec ` +
    `source, and no configured group discovers this path ` +
    `(SPEC 11.5, 11.4, 7, 12.0)`
  );
}

/** The wrong-kind-`<file>` diagnostic (SPEC 11.5, 11.4, 12.0). */
export function wrongKindFileMessage(file: string): string {
  return (
    `wrong-kind file '${file}' — the operand names a discovered code ` +
    `source, and \`at\` resolves positions in spec sources; name a ` +
    `discovered spec source (SPEC 11.5, 11.4, 12.0)`
  );
}

/** The out-of-range-`<offset>` diagnostic (SPEC 11.5, 12.0). */
export function offsetOutOfRangeMessage(
  spelling: string,
  byteLength: number,
): string {
  return (
    `offset ${spelling} is out of range — only the offsets 0 through the ` +
    `file's byte length (${String(byteLength)}) resolve (SPEC 11.5, 12.0)`
  );
}
