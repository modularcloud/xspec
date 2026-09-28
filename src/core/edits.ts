// Minimal in-place source edits (SPEC 6.4, 6.5) — the shared machinery of
// the rename and move rewrite plans.
//
// SPEC 6.4/6.5: rewrites are minimal in-place edits — each affected part is
// replaced within its recorded byte range, and every byte outside the
// affected parts is preserved verbatim. This module is pure (IMPLEMENTATION
// Architecture): edits are values applied to source bytes; the derivations
// that produce them live in ./rename.ts and ./move.ts.

import type { ByteRange } from "./bytes.js";
import { compareBytes } from "./bytes.js";

/** One in-place edit: replace the bytes of `range` with `replacement`. */
export interface SourceEdit {
  readonly range: ByteRange;
  readonly replacement: string;
}

/** One rewritten source file: its path and complete new content bytes. */
export interface SourceRewrite {
  /** Workspace-relative `/`-separated path (SPEC 1.5). */
  readonly path: string;
  /** The file's complete rewritten bytes (SPEC 6.4/6.5: edits applied). */
  readonly content: Uint8Array;
}

/**
 * One source write of a rewriting operation (SPEC 6.4, 6.5, 13.5): a file's
 * complete new bytes at its path, or the removal of a relocation's origin.
 */
export type SourceWrite =
  | {
      readonly kind: "write";
      readonly path: string;
      readonly content: Uint8Array;
    }
  | { readonly kind: "remove"; readonly path: string };

/**
 * A file-form move's relocation (SPEC 6.5): the moved file produced at the
 * destination, then the origin removed.
 */
export interface Relocation {
  readonly origin: string;
  readonly destination: string;
}

/**
 * SPEC 13.5: the order of a rewriting operation's source writes — one write
 * per file the operation rewrites, relocates, or creates, in the order the
 * preview's `files` lists them (6.6, 12.7: by the file's current,
 * pre-operation path bytes — a relocated file's entry under its origin
 * path, a created file's under the path its creation occupies), a
 * relocation producing the destination and then removing the origin. A
 * command stopped by a refused write (14.24) therefore leaves exactly the
 * writes before it in this order, each complete.
 */
export function orderSourceWrites(
  rewrites: readonly SourceRewrite[],
  relocation: Relocation | null,
): SourceWrite[] {
  if (
    relocation !== null &&
    !rewrites.some((rewrite) => rewrite.path === relocation.destination)
  ) {
    // Unreachable: a file-form move always produces its destination (SPEC
    // 6.5). Guarded so the origin's removal can never go unordered.
    throw new Error(
      "xspec internal error: a relocation without the destination's write",
    );
  }
  const entries = rewrites.map((rewrite) => {
    const write: SourceWrite = {
      kind: "write",
      path: rewrite.path,
      content: rewrite.content,
    };
    if (relocation !== null && rewrite.path === relocation.destination) {
      const removal: SourceWrite = { kind: "remove", path: relocation.origin };
      return { key: relocation.origin, writes: [write, removal] };
    }
    return { key: rewrite.path, writes: [write] };
  });
  entries.sort((a, b) => compareBytes(a.key, b.key));
  return entries.flatMap((entry) => entry.writes);
}

const encoder = new TextEncoder();

/**
 * Apply non-overlapping edits to a file's bytes (SPEC 6.4, 6.5: minimal
 * in-place edits — every byte outside the edited ranges is preserved
 * verbatim).
 */
export function applyEdits(
  bytes: Uint8Array,
  edits: readonly SourceEdit[],
): Uint8Array {
  const ordered = [...edits].sort(
    (a, b) => a.range.start - b.range.start || a.range.end - b.range.end,
  );
  const parts: Uint8Array[] = [];
  let cursor = 0;
  for (const edit of ordered) {
    if (edit.range.start < cursor || edit.range.end > bytes.length) {
      throw new Error(
        "xspec internal error: overlapping or out-of-range source edits",
      );
    }
    parts.push(bytes.subarray(cursor, edit.range.start));
    parts.push(encoder.encode(edit.replacement));
    cursor = edit.range.end;
  }
  parts.push(bytes.subarray(cursor));
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Collects per-file edits, keyed by workspace-relative path. */
export class EditCollector {
  private readonly editsByPath = new Map<string, SourceEdit[]>();

  add(path: string, edit: SourceEdit): void {
    let edits = this.editsByPath.get(path);
    if (edits === undefined) {
      edits = [];
      this.editsByPath.set(path, edits);
    }
    edits.push(edit);
  }

  editsFor(path: string): readonly SourceEdit[] | undefined {
    return this.editsByPath.get(path);
  }
}

/**
 * A JavaScript string literal whose value is exactly `value` (SPEC 6.4, 6.5
 * rewrites and added imports). The value of a static string literal is the
 * characters between its delimiters exactly as spelled — no escape sequence
 * is interpreted (SPEC 2.4) — so the value is written verbatim: an escaped
 * spelling would read back as its escape's characters. `quote` is the style
 * the edit keeps (SPEC 6.4: quote style preserved; the fallback form and an
 * added import's specifier are double-quoted, 6.4, 6.5). Rewritten
 * identities hold no quote character, `\`, or control character (1.4), so
 * they always take `quote` itself; a rewritten or added import specifier is
 * a path (2.1), which may hold a quote character. Where the value holds
 * `quote`, no literal in that style has it as its value, and the other
 * quote character is taken — SPEC 6.4 and 6.5 prescribe the style for
 * values it can delimit, and a path holding the prescribed quote has no
 * spelling in it at all. A value holding both quote characters, or a line
 * feed or carriage return (which no string literal holds unescaped), has
 * no verbatim spelling: an internal error, never a malformed rewrite.
 */
export function jsStringLiteral(value: string, quote: '"' | "'"): string {
  const other = quote === '"' ? "'" : '"';
  const chosen = !value.includes(quote)
    ? quote
    : !value.includes(other)
      ? other
      : null;
  if (chosen === null || /[\n\r]/u.test(value)) {
    throw new Error(
      `xspec internal error: the string value ${JSON.stringify(value)} has ` +
        `no verbatim string-literal spelling (SPEC 2.4)`,
    );
  }
  return `${chosen}${value}${chosen}`;
}

/**
 * The characters of a quoted MDX attribute value holding exactly `value`
 * under `quote` (SPEC 2.7: quoted attribute form; SPEC 6.4: the quote style
 * is preserved). A quoted attribute value is the characters between its
 * quotes exactly as spelled — no character reference is interpreted
 * (SPEC 2.4) — so the value is written verbatim and reads back as itself.
 * The rewritten values are identities, whose segments hold no quote
 * character (SPEC 1.4); a value holding `quote` has no spelling in that
 * form at all.
 */
export function attributeValueText(value: string, quote: '"' | "'"): string {
  if (value.includes(quote)) {
    throw new Error(
      `xspec internal error: the attribute value ${JSON.stringify(value)} ` +
        `holds its own quote character ${quote} and has no quoted spelling`,
    );
  }
  return value;
}
