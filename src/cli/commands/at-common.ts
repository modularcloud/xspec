// `xspec at` — the argument checks shared by the full path (./at.ts) and
// the store-backed fast path (./at-fast.ts).
//
// SPEC 12.0: output is byte-deterministic for identical input, whichever
// internal path answers — so the two paths share one diagnostic
// composition for every usage error of SPEC 11.5 that consults the
// workspace (the `<offset>` spelling itself is the parser's, cli/args.ts,
// judged before the configuration is loaded: 12.0's syntax class). This
// module stays light on purpose: cli/main.ts reaches it through the fast
// path before the TypeScript compiler is loaded.

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
