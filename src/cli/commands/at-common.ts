// `xspec at` — the diagnostics of the argument checks (./at.ts) that
// consult the workspace: one composition per usage error of SPEC 11.5
// (the `<offset>` spelling itself is the parser's, cli/args.ts, judged
// before the configuration is loaded: 12.0's syntax class).

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
