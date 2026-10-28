// The preview plan surface (SPEC 6.6, 12.7) — the pure edit model.
//
// Pure core (IMPLEMENTATION Architecture: deterministic and I/O-free): a
// `rename`/`move` preview reports every file the operation would rewrite,
// relocate, or create, with every edit the operation would make in it,
// classed as exactly one of the ten SPEC 6.6 classes and located by a
// source range (SPEC 1.7) in current, pre-operation coordinates — no
// replacement text anywhere (the preview is a safety report, not an edit
// script). The plan derivations (./rename.ts, ./move.ts) collect these
// entries in the same pass that derives the applied edits, so the real
// operation and the preview share one plan (SPEC 6.6, 6.5).
//
// Ordering (SPEC 12.7): file entries by file path bytes; within a file,
// edits by range start, then range end, then class-name bytes. Ranges MAY
// nest (SPEC 6.6: containment is geometry, not double-reporting) and
// coinciding zero-length insertion points MAY tie, resolved by the
// class-name byte comparison.

import type { ByteRange } from "./bytes.js";
import { compareBytes } from "./bytes.js";

/** The ten SPEC 6.6/12.7 preview edit classes, exactly. */
export type PreviewEditClass =
  | "reference-rewrite"
  | "id-rewrite"
  | "import-specifier-rewrite"
  | "import-addition"
  | "import-removal"
  | "origin-deletion"
  | "target-insertion"
  | "target-parent-rewrite"
  | "file-relocation"
  | "file-creation";

/** One classed preview edit (SPEC 6.6, 12.7): class plus range only. */
export interface PreviewEdit {
  readonly class: PreviewEditClass;
  /**
   * Pre-operation coordinates (SPEC 6.6): a rewrite spans the construct it
   * rewrites, a removal every byte its edit removes, an insertion point is
   * zero-length at its offset; target-file creation's insertion point at
   * the start of the new file is the one location without pre-operation
   * coordinates.
   */
  readonly range: ByteRange;
}

/** One `files` entry (SPEC 12.7): a file with its classed edits. */
export interface PreviewFileEdits {
  /**
   * The file's current, pre-operation workspace-relative path — for
   * target-file creation, the path the creation would occupy (SPEC 6.6).
   * Plans are derived over validated workspaces (SPEC 6.4, 6.5), whose
   * discovered paths are all valid UTF-8 (SPEC 14.19), so a plain string.
   */
  readonly path: string;
  /** The edits, in the pinned SPEC 12.7 order. */
  readonly edits: readonly PreviewEdit[];
}

/** The pinned SPEC 12.7 edit order: start, end, class-name bytes. */
export function comparePreviewEdits(a: PreviewEdit, b: PreviewEdit): number {
  if (a.range.start !== b.range.start) {
    return a.range.start - b.range.start;
  }
  if (a.range.end !== b.range.end) {
    return a.range.end - b.range.end;
  }
  return compareBytes(a.class, b.class);
}

/**
 * Collects preview edits per file while a plan derivation runs, and yields
 * the `files` entries in the pinned SPEC 12.7 order — file entries by path
 * bytes, edits by range start, then range end, then class-name bytes.
 */
export class PreviewCollector {
  private readonly editsByPath = new Map<string, PreviewEdit[]>();

  add(path: string, editClass: PreviewEditClass, range: ByteRange): void {
    let edits = this.editsByPath.get(path);
    if (edits === undefined) {
      edits = [];
      this.editsByPath.set(path, edits);
    }
    edits.push({ class: editClass, range: { ...range } });
  }

  /** The collected entries in the pinned SPEC 12.7 order. */
  files(): readonly PreviewFileEdits[] {
    return [...this.editsByPath.entries()]
      .sort((a, b) => compareBytes(a[0], b[0]))
      .map(([path, edits]) => ({
        path,
        edits: [...edits].sort(comparePreviewEdits),
      }));
  }
}

/** The two-direction derived-file delta (SPEC 6.6), each in byte order. */
export interface PreviewDelta {
  /** Derived paths the operation would newly generate (SPEC 6.6). */
  readonly generated: readonly string[];
  /** Recorded derived paths left no longer generated (SPEC 6.6). */
  readonly removed: readonly string[];
}

/**
 * The record-based delta rule (SPEC 6.6): `generated` is the post-operation
 * generation set minus the recorded paths — the paths where nothing is
 * currently recorded as generated — and `removed` the recorded paths the
 * operation would leave no longer generated. Both directions consult the
 * record alone; presence on disk decides neither (SPEC 6.6: presence at a
 * path cannot tell a generated occupant from a foreign one). Paths in byte
 * order (SPEC 12.7).
 */
export function derivedFileDelta(
  recordedPaths: readonly string[],
  postGenerationPaths: readonly string[],
): PreviewDelta {
  const recorded = new Set(recordedPaths);
  const post = new Set(postGenerationPaths);
  const generated = [...post]
    .filter((path) => !recorded.has(path))
    .sort(compareBytes);
  const removed = [...recorded]
    .filter((path) => !post.has(path))
    .sort(compareBytes);
  return { generated, removed };
}
