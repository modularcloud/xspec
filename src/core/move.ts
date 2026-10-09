// The move rewrite plans (SPEC 6.5) — the pure derivations.
//
// Pure core (IMPLEMENTATION Architecture: deterministic and I/O-free): over
// a validated workspace's analyses this module computes everything a move
// changes in the sources.
//
// The file form (`xspec move <old-file> <new-file>`, `planMoveFile`):
//
// - the moved file's complete content at its destination path: its own
//   import specifiers rewritten so each still designates the file it
//   designated before, resolved from the new directory (SPEC 6.5);
// - every other file's imports of the moved file's generated module — spec
//   files' `.xspec` imports (SPEC 2.1) and code files' spec module imports
//   (SPEC 4) — rewritten so all references continue to resolve (SPEC 6.5);
// - the identity mapping the operation produces — IDs unchanged, every
//   identity changed only in its file part — as the journal entry the
//   workspace layer appends (SPEC 6.1, 6.5).
//
// No reference spelling changes (SPEC 6.5 file form): local references name
// IDs of their own file, which are unchanged, and chain references are
// rooted at import bindings whose names are unchanged — only the import
// specifiers behind those bindings move.
//
// The section form (`xspec move <file>#<id> <target-file>#<new-id>`,
// `planMoveSection`): the section subtree is extracted with the exact text
// rules of SPEC 6.5 — the moved text is the construct's own characters,
// deleted in place at the origin with the line-drop rule of SPEC 3 (lines
// left empty or whitespace-only purely by the deletion are dropped with
// their terminators, judged over the merged output line exactly as Markdown
// compilation judges it), and inserted immediately before the target
// parent's closing tag (end of file for a top-level `new-id`), followed by
// U+000A and preceded by one when the insertion point is not at the start
// of a line; a self-closing target parent is first rewritten to paired
// form; the subtree is re-identified by prefix replacement; references
// convert between local and imported forms as the rewrite requires, spec
// module imports are added (binding fresh, non-colliding, deterministic
// identifiers) and removed — in spec and code sources alike — exactly when
// an occurrence used a binding of the import before the rewrite and none
// uses any binding of it after (SPEC 6.5, 2.1); the full mapping is the
// journal entry.
//
// Rewrites are minimal in-place edits (SPEC 6.4, 6.5), preserving quote
// style and access form where a form can be kept; converted references use
// dot access for valid-identifier segments, double-quoted computed access
// otherwise, and double-quoted string literals (SPEC 6.4). Rewritten file
// content is a deterministic function of the operation and workspace state
// (SPEC 6.1).
//
// Callers validate first (SPEC 6.5): the workspace passes `build`
// validation (so every import is valid, every section has a valid ID, and
// every reference resolves), the origin exists, and the move-specific
// refusals (self-move, `<new-id>` validity and collision, target parent,
// destination path validity) have all been checked. This module asserts
// those preconditions and throws on violation: they are caller defects,
// never user-facing paths.

import type { ByteRange } from "./bytes.js";
import { compareBytes } from "./bytes.js";
import type {
  CodeAnalysis,
  CodeImport,
  CodeImportBinding,
  CodeReference,
  StatementLayout,
} from "./code-analysis.js";
import {
  jsxFactoryPragmaNames,
  topLevelImportRanges,
  topLevelStatementLayout,
} from "./code-analysis.js";
import type { SourceEdit, SourceRewrite } from "./edits.js";
import {
  applyEdits,
  attributeValueText,
  EditCollector,
  jsStringLiteral,
} from "./edits.js";
import type { FindingLocation } from "./findings.js";
import type { SpecFileAnalysis } from "./graph.js";
import type { IdentityMapping, JournalEntry } from "./journal.js";
import { createJournalEntry } from "./journal.js";
import type {
  SpecDocument,
  SpecEsmBlock,
  SpecImportStatement,
  SpecSection,
} from "./mdx.js";
import { isWellFormedSpecSource, parseSpecSource } from "./mdx.js";
import type { PreviewFileEdits } from "./preview.js";
import { PreviewCollector } from "./preview.js";
import {
  isDotAccessSegmentName,
  replaceIdPrefix,
  segmentEdit,
} from "./rename.js";
import type {
  SpecImport,
  SpecReference,
  ReferenceSpelling,
} from "./spec-references.js";
import { resolveImportSpecifier } from "./spec-references.js";

/** SPEC 2.1: `DIR/NAME.xspec` designates `DIR/NAME.mdx`. */
const XSPEC_SUFFIX = ".xspec";
const MDX_SUFFIX = ".mdx";

/** Everything a validated file-form move changes in the sources (SPEC 6.5). */
export interface MoveFilePlan {
  /** The full identity mapping the operation produces (SPEC 6.5, 6.1). */
  readonly mapping: readonly IdentityMapping[];
  /** The journal entry recording the operation and its mapping (SPEC 6.1). */
  readonly entry: JournalEntry;
  /**
   * Every rewritten source file at its post-move path: the moved file's
   * complete content at the destination (edits applied), and every other
   * file with import-specifier edits at its own path. The origin path
   * itself ceases to exist (the workspace layer removes it).
   */
  readonly rewrites: readonly SourceRewrite[];
  /**
   * The preview plan surface (SPEC 6.6): every file the operation would
   * rewrite or relocate, with every edit classed and located in
   * pre-operation coordinates — the moved file's entry under its current
   * path — collected in the same pass that derives the applied edits, so
   * the real operation and its preview share one plan.
   */
  readonly previewFiles: readonly PreviewFileEdits[];
}

/**
 * The generated-module specifier target of a spec source path (SPEC 2.1,
 * 13.1): `DIR/NAME.mdx` is imported as `DIR/NAME.xspec`.
 */
export function moduleSpecifierTargetOf(specPath: string): string {
  if (!specPath.endsWith(MDX_SUFFIX)) {
    throw new Error(
      `xspec internal error: ${JSON.stringify(specPath)} is not a spec ` +
        `source path (SPEC 7.1: every spec source ends ".mdx")`,
    );
  }
  return specPath.slice(0, -MDX_SUFFIX.length) + XSPEC_SUFFIX;
}

/**
 * The canonical relative specifier from the importing file to a target
 * module path, over workspace-relative `/`-separated paths (SPEC 1.5, 2.1):
 * the shortest `./`/`../` path — up from the importer's directory to the
 * deepest common ancestor, then down to the target. Deterministic for a
 * given (importer, target) pair (SPEC 6.1: rewritten content is
 * byte-deterministic), and `resolveImportSpecifier` maps it back to exactly
 * `targetModulePath`.
 */
export function relativeModuleSpecifier(
  importerPath: string,
  targetModulePath: string,
): string {
  const fromDir = importerPath.split("/").slice(0, -1);
  const target = targetModulePath.split("/");
  const targetDir = target.slice(0, -1);
  let common = 0;
  while (
    common < fromDir.length &&
    common < targetDir.length &&
    fromDir[common] === targetDir[common]
  ) {
    common += 1;
  }
  const ups = fromDir.length - common;
  const parts: string[] = [];
  for (let index = 0; index < ups; index += 1) {
    parts.push("..");
  }
  parts.push(...target.slice(common));
  // SPEC 2.1: a specifier begins "./" or "../".
  return ups === 0 ? `./${parts.join("/")}` : parts.join("/");
}

const encoder = new TextEncoder();

/** The shape shared by spec-file and code-file import records (SPEC 6.5). */
interface RewritableImport {
  readonly specifier: string;
  readonly specifierQuote: '"' | "'";
  readonly specifierRange: { readonly start: number; readonly end: number };
  readonly targetPath: string | null;
}

/**
 * Derive the SPEC 6.5 file-form move plan over a validated workspace's
 * analyses: the identity mapping (the file node plus every section, changed
 * only in the file part), the journal entry recording it (SPEC 6.1), and
 * the minimal in-place import-specifier rewrites of every affected source
 * file. See the module header for the preconditions the caller has
 * established.
 */
export function planMoveFile(
  specs: readonly SpecFileAnalysis[],
  code: readonly CodeAnalysis[],
  originPath: string,
  destinationPath: string,
): MoveFilePlan {
  const origin = specs.find((spec) => spec.document.path === originPath);
  if (origin === undefined) {
    throw new Error(
      `xspec internal error: move origin ${originPath} is not among the ` +
        `analyzed spec sources`,
    );
  }
  if (originPath === destinationPath) {
    throw new Error(
      `xspec internal error: move of ${originPath} onto itself — the caller ` +
        `validated that the destination differs (SPEC 6.5)`,
    );
  }

  // The identity mapping (SPEC 6.5, 6.1): IDs unchanged, identities changed
  // only in the file part — the file node and every section.
  const mapping: IdentityMapping[] = [
    { from: originPath, to: destinationPath },
  ];
  for (const section of origin.document.sections) {
    if (section.id === null) {
      throw new Error(
        `xspec internal error: a section of ${originPath} in a validated ` +
          `workspace has no ID`,
      );
    }
    mapping.push({
      from: `${originPath}#${section.id}`,
      to: `${destinationPath}#${section.id}`,
    });
  }

  const destinationModule = moduleSpecifierTargetOf(destinationPath);
  const edits = new EditCollector();
  // SPEC 6.6: the preview edits, collected beside the applied edits. The
  // relocation spans the entire moved file, its entry under the current,
  // pre-operation path.
  const preview = new PreviewCollector();
  preview.add(originPath, "file-relocation", {
    start: 0,
    end: encoder.encode(origin.document.text).length,
  });

  /** Rewrite one import's specifier literal to designate `targetModule`. */
  const specifierEdit = (
    path: string,
    imported: RewritableImport,
    importerPath: string,
    targetModule: string,
  ): void => {
    edits.add(path, {
      range: imported.specifierRange,
      replacement: jsStringLiteral(
        relativeModuleSpecifier(importerPath, targetModule),
        // SPEC 6.4/6.5: rewrites preserve the reference's quote style.
        imported.specifierQuote,
      ),
    });
    // SPEC 6.6: an import-specifier rewrite spans the specifier literal's
    // characters, quotes included, in the file's pre-operation coordinates
    // (the moved file's own edits under its current path).
    preview.add(path, "import-specifier-rewrite", imported.specifierRange);
  };

  // SPEC 6.5: relocation rewrites the moved file's own import specifiers —
  // each must designate, from the new directory, the file it designated
  // before (the destination itself for a self-import). A specifier that
  // still resolves is kept verbatim (SPEC 6.4: minimal edits).
  for (const imported of origin.imports.imports) {
    if (imported.targetPath === null) {
      throw new Error(
        `xspec internal error: an invalid import in ${originPath} of a ` +
          `validated workspace`,
      );
    }
    const target =
      imported.targetPath === originPath
        ? destinationPath
        : imported.targetPath;
    const resolved = resolveImportSpecifier(
      destinationPath,
      imported.specifier,
    );
    const designated =
      resolved === null
        ? null
        : resolved.slice(0, -XSPEC_SUFFIX.length) + MDX_SUFFIX;
    if (designated === target) {
      continue;
    }
    specifierEdit(
      originPath,
      imported,
      destinationPath,
      moduleSpecifierTargetOf(target),
    );
  }

  // SPEC 6.5: rewrite the paths by which other files import the moved
  // file's generated module — spec sources (SPEC 2.1) and code sources
  // (SPEC 4) alike — so all references continue to resolve.
  for (const spec of specs) {
    if (spec.document.path === originPath) {
      continue;
    }
    for (const imported of spec.imports.imports) {
      if (imported.targetPath === originPath) {
        specifierEdit(
          spec.document.path,
          imported,
          spec.document.path,
          destinationModule,
        );
      }
    }
  }
  for (const analysis of code) {
    for (const imported of analysis.imports) {
      if (imported.targetPath === originPath) {
        specifierEdit(
          analysis.path,
          imported,
          analysis.path,
          destinationModule,
        );
      }
    }
  }

  // Assemble the rewrites: the moved file's content at the destination path
  // (with its edits, possibly none), every other edited file at its own
  // path. Source text decoded from valid, BOM-free UTF-8 (SPEC 1.6)
  // re-encodes to the exact original bytes, so unedited runs are the file's
  // own bytes (SPEC 6.5: beyond these edits, a move changes no bytes).
  const rewrites: SourceRewrite[] = [];
  for (const spec of specs) {
    const path = spec.document.path;
    const fileEdits = edits.editsFor(path);
    if (path === originPath) {
      rewrites.push({
        path: destinationPath,
        content: applyEdits(
          encoder.encode(spec.document.text),
          fileEdits ?? [],
        ),
      });
      continue;
    }
    if (fileEdits !== undefined) {
      rewrites.push({
        path,
        content: applyEdits(encoder.encode(spec.document.text), fileEdits),
      });
    }
  }
  for (const analysis of code) {
    const fileEdits = edits.editsFor(analysis.path);
    if (fileEdits !== undefined) {
      rewrites.push({
        path: analysis.path,
        content: applyEdits(encoder.encode(analysis.text), fileEdits),
      });
    }
  }

  return {
    mapping,
    // SPEC 6.1/6.5: the appended entry records the operation and the full
    // mapping it produced.
    entry: createJournalEntry(
      "move-file",
      originPath,
      destinationPath,
      mapping,
    ),
    rewrites,
    previewFiles: preview.files(),
  };
}

// ---------------------------------------------------------------------------
// The section form (SPEC 6.5 second form)
// ---------------------------------------------------------------------------

const LF = 0x0a;
const CR = 0x0d;

/** SPEC 3: a line terminator byte (CRLF handled where terminators end). */
function isTerminatorByte(byte: number): boolean {
  return byte === LF || byte === CR;
}

/**
 * SPEC 1.4 whitespace, as UTF-8 bytes — all six characters are ASCII, so
 * byte scans over UTF-8 content are exact (multi-byte sequences never
 * contain ASCII bytes).
 */
function isWhitespaceByte(byte: number): boolean {
  return (
    byte === 0x09 ||
    byte === 0x0a ||
    byte === 0x0b ||
    byte === 0x0c ||
    byte === 0x0d ||
    byte === 0x20
  );
}

/** The start of the line containing `pos` (SPEC 3: maximal terminator-free run). */
function lineStartBefore(bytes: Uint8Array, pos: number): number {
  let cursor = pos;
  while (cursor > 0 && !isTerminatorByte(bytes[cursor - 1]!)) {
    cursor -= 1;
  }
  return cursor;
}

/** The end of the line content containing `pos` (the terminator's start, or EOF). */
function lineContentEndAfter(bytes: Uint8Array, pos: number): number {
  let cursor = pos;
  while (cursor < bytes.length && !isTerminatorByte(bytes[cursor]!)) {
    cursor += 1;
  }
  return cursor;
}

/**
 * The end of the line whose content ends at `contentEnd`, terminator
 * included (SPEC 3: U+000D U+000A is one terminator; the final line MAY
 * have none).
 */
function terminatorEndAt(bytes: Uint8Array, contentEnd: number): number {
  if (contentEnd >= bytes.length) {
    return contentEnd;
  }
  if (bytes[contentEnd] === CR && bytes[contentEnd + 1] === LF) {
    return contentEnd + 2;
  }
  return contentEnd + 1;
}

/** One merged output line touched by deletions (the SPEC 3 drop unit). */
interface DeletionCluster {
  extStart: number;
  contentEnd: number;
  extEnd: number;
  ranges: ByteRange[];
}

/**
 * Deletion edits for `ranges` with the SPEC 3 line-drop rule, exactly as
 * Markdown compilation applies it (SPEC 6.5: "dropped with their line
 * terminators, exactly as in Markdown compilation"): a deleted range
 * spanning line terminators merges its lines into one output line, and a
 * merged line that contained non-whitespace in the source but whose kept
 * characters are empty or whitespace-only purely by the deletion is dropped
 * together with its final terminator; every other line keeps its remaining
 * content and terminator.
 */
function deletionEditsWithLineDrops(
  bytes: Uint8Array,
  ranges: readonly ByteRange[],
): SourceEdit[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index]!.start < sorted[index - 1]!.end) {
      // Unreachable guard: the one overlap a plan could hold — an import
      // removal inside the origin deletion's construct — is a moved text
      // holding an import declaration, refused before any planning
      // (`refused-moved-import`, SPEC 6.5, 14; core/refusal.ts) and
      // judged with those removals left to the origin deletion
      // (`judgeMoveSectionRewrite`).
      throw new Error("xspec internal error: overlapping move deletions");
    }
  }
  const clusters: DeletionCluster[] = [];
  for (const range of sorted) {
    const last = clusters[clusters.length - 1];
    const extStart = lineStartBefore(bytes, range.start);
    const contentEnd = lineContentEndAfter(bytes, range.end);
    const extEnd = terminatorEndAt(bytes, contentEnd);
    if (last !== undefined && extStart < last.extEnd) {
      // The ranges share a (merged) line: one drop unit (SPEC 3).
      last.ranges.push(range);
      if (contentEnd > last.contentEnd) {
        last.contentEnd = contentEnd;
        last.extEnd = extEnd;
      }
    } else {
      clusters.push({ extStart, contentEnd, extEnd, ranges: [range] });
    }
  }
  const edits: SourceEdit[] = [];
  for (const cluster of clusters) {
    // SPEC 3: "contained non-whitespace in the source" — over the merged
    // line's source characters, deleted characters included (interior
    // terminators are whitespace either way).
    let hadNonWhitespace = false;
    for (let pos = cluster.extStart; pos < cluster.contentEnd; pos += 1) {
      if (!isWhitespaceByte(bytes[pos]!)) {
        hadNonWhitespace = true;
        break;
      }
    }
    // The kept characters: everything in the merged line the deletion does
    // not cover.
    let keptWhitespaceOnly = true;
    let cursor = cluster.extStart;
    for (const range of cluster.ranges) {
      for (let pos = cursor; pos < range.start; pos += 1) {
        if (!isWhitespaceByte(bytes[pos]!)) {
          keptWhitespaceOnly = false;
        }
      }
      cursor = range.end;
    }
    for (let pos = cursor; pos < cluster.contentEnd; pos += 1) {
      if (!isWhitespaceByte(bytes[pos]!)) {
        keptWhitespaceOnly = false;
      }
    }
    if (hadNonWhitespace && keptWhitespaceOnly) {
      // SPEC 3/6.5: drop the merged line — kept characters and final
      // terminator alike.
      edits.push({
        range: { start: cluster.extStart, end: cluster.extEnd },
        replacement: "",
      });
    } else {
      for (const range of cluster.ranges) {
        edits.push({ range, replacement: "" });
      }
    }
  }
  return edits;
}

/**
 * The single span a deletion removes (SPEC 6.6): the range's own bytes,
 * extended over the leftover whitespace and line terminator of each line
 * the line-drop rule additionally drops (SPEC 6.5, 3) — bytes contiguous
 * with the range, so the result is one range. The preview's
 * `origin-deletion` and `import-removal` ranges are exactly this span,
 * judged per edit over the same machinery the applied deletion uses.
 */
function removalSpan(bytes: Uint8Array, range: ByteRange): ByteRange {
  const edits = deletionEditsWithLineDrops(bytes, [range]);
  const first = edits[0];
  const last = edits[edits.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error("xspec internal error: a deletion produced no edits");
  }
  return { start: first.range.start, end: last.range.end };
}

/**
 * SPEC 6.5: the deterministic import-addition offset anchored after the
 * line containing `position` — the byte just past that line's terminator
 * (the end of the file when the line is unterminated). In a file existing
 * before the operation, this is exactly the offset the preview reports
 * (SPEC 6.6) and the offset the real operation inserts at.
 */
function offsetAfterLine(bytes: Uint8Array, position: number): number {
  return terminatorEndAt(bytes, lineContentEndAfter(bytes, position));
}

/** The keyword every import declaration's own characters begin with. */
const IMPORT_KEYWORD_LENGTH = "import".length;
const SPACE = 0x20;

/**
 * SPEC 6.5 "Import edits": whether the import removals `removed` leave the
 * spec source's ESM block `block` still deriving as one — judged together,
 * over the block as all of them would leave it: each removed declaration's
 * own characters deleted, the lines that leaves empty or whitespace-only
 * dropped with their terminators (3). The grammar bounds the block
 * line-sensitively (14.20): its construct opens only at a line's start
 * spelling `import` then U+0020, so the first line left must start with a
 * kept declaration spelled so. Anything else heading it — a JavaScript
 * comment (`// note` below a removed first line, or trailing it on that
 * line), an indented declaration — leaves the remaining lines deriving as
 * paragraph text, and the block's first declaration must stay. A block
 * left with no line at all, every line dropped, is headed by nothing: its
 * removals stand, the first declaration's included.
 */
function removalsLeaveBlockHeaded(
  bytes: Uint8Array,
  block: SpecEsmBlock,
  removed: ReadonlySet<SpecImportStatement>,
): boolean {
  const edits = deletionEditsWithLineDrops(
    bytes,
    block.imports
      .filter((statement) => removed.has(statement))
      .map((statement) => statement.range),
  );
  // The block's first byte no edit deletes: the start of the first line
  // the removals leave (the edits come in document order, a dropped line
  // spanning its terminator, so each line the block keeps starts a line).
  let head = block.range.start;
  for (const edit of edits) {
    if (edit.range.start > head) {
      break;
    }
    head = Math.max(head, edit.range.end);
  }
  if (head >= block.range.end) {
    return true;
  }
  return (
    block.imports.some(
      (statement) => !removed.has(statement) && statement.range.start === head,
    ) && bytes[head + IMPORT_KEYWORD_LENGTH] === SPACE
  );
}

/**
 * SPEC 6.5 "Added imports": the names module code, strict throughout,
 * admits as no binding — ECMAScript's reserved words, and `let`, `static`,
 * `implements`, `interface`, `package`, `private`, `protected`, `public`,
 * `eval`, and `arguments` — which the fresh-identifier chooser skips.
 */
const RESERVED_BINDING_NAMES: ReadonlySet<string> = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

/**
 * SPEC 2.1: names an xspec import may never bind (never shadowed). SPEC 6.5
 * bars them from an added import's identifiers in a spec source; the
 * chooser skips them in every receiving file, which only steers its
 * deterministic choice onward in a code source.
 */
const COMPILER_PROVIDED_NAMES: ReadonlySet<string> = new Set([
  "S",
  "Spec",
  "text",
]);

/**
 * SPEC 6.5 "Added imports": names TypeScript's compiler reserves in a
 * module it emits in any format but ECMAScript's, never an added import's
 * identifiers.
 */
const EMIT_RESERVED_NAMES: ReadonlySet<string> = new Set([
  "require",
  "exports",
]);

/**
 * SPEC 6.5 "Added imports": the prefix of the helpers TypeScript's emit
 * declares at a module's top level (`__awaiter`); no added import's
 * identifier begins with it.
 */
const EMIT_HELPER_PREFIX = "__";

/**
 * SPEC 6.5 "Added imports": the globals the compiler's emitted code may
 * read, whatever the module format and target, which no added import's
 * identifier names — every property ECMAScript 2024 defines on the global
 * object (clause 19's value, function, constructor, and other properties,
 * and Annex B's, B.2.1), and `Iterator`, `AsyncIterator`, and
 * `SuppressedError`, which 6.5 names.
 */
const EMITTED_CODE_GLOBALS: ReadonlySet<string> = new Set([
  // 19.1, the value properties.
  "globalThis",
  "Infinity",
  "NaN",
  "undefined",
  // 19.2, the function properties.
  "eval",
  "isFinite",
  "isNaN",
  "parseFloat",
  "parseInt",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  // 19.3, the constructor properties.
  "AggregateError",
  "Array",
  "ArrayBuffer",
  "BigInt",
  "BigInt64Array",
  "BigUint64Array",
  "Boolean",
  "DataView",
  "Date",
  "Error",
  "EvalError",
  "FinalizationRegistry",
  "Float32Array",
  "Float64Array",
  "Function",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Map",
  "Number",
  "Object",
  "Promise",
  "Proxy",
  "RangeError",
  "ReferenceError",
  "RegExp",
  "Set",
  "SharedArrayBuffer",
  "String",
  "Symbol",
  "SyntaxError",
  "TypeError",
  "Uint8Array",
  "Uint8ClampedArray",
  "Uint16Array",
  "Uint32Array",
  "URIError",
  "WeakMap",
  "WeakRef",
  "WeakSet",
  // 19.4, the other properties.
  "Atomics",
  "JSON",
  "Math",
  "Reflect",
  // Annex B, B.2.1.
  "escape",
  "unescape",
  // Named by 6.5.
  "Iterator",
  "AsyncIterator",
  "SuppressedError",
]);

/**
 * SPEC 6.5 "Added imports": whether an added import may bind `name` in no
 * receiving file whatever it holds — no binding module code, strict
 * throughout, admits (reserved words, and the words strict mode bars as a
 * binding), no name the compiler reserves or its emit's helpers spell, no
 * global its emitted code may read, and none of the compiler-provided
 * names. A file's own constraints — its declarations and references, and a
 * TSX source's JSX factory names — are the caller's (`avoided`).
 */
function barredInEveryFile(name: string): boolean {
  return (
    RESERVED_BINDING_NAMES.has(name) ||
    EMIT_RESERVED_NAMES.has(name) ||
    name.startsWith(EMIT_HELPER_PREFIX) ||
    EMITTED_CODE_GLOBALS.has(name) ||
    COMPILER_PROVIDED_NAMES.has(name)
  );
}

/**
 * SPEC 6.5 "Added imports": in a TSX source (a `.tsx` file name, 14.20),
 * the names through which TypeScript's classic JSX transform reaches the
 * file's JSX factories where no compiler option names them — `React`, and
 * the leading identifier of each factory a `@jsx` or `@jsxFrag` pragma in
 * one of its comments names; in any other file, none.
 */
function jsxFactoryNames(path: string, text: string): readonly string[] {
  if (!path.endsWith(".tsx")) {
    return [];
  }
  return ["React", ...jsxFactoryPragmaNames(text)];
}

/**
 * The deterministic identifier base derived from a module path's file stem
 * (SPEC 6.5: identifier choice is deterministic): identifier-friendly
 * characters kept, every other character replaced by `_`, a leading digit
 * (or empty stem) prefixed with `_`, and a leading run of `_` kept to one:
 * SPEC 6.5 bars every name beginning with `__`, which no suffix the chooser
 * appends would leave.
 */
function stemIdentifierBase(modulePath: string): string {
  const fileName = modulePath.slice(modulePath.lastIndexOf("/") + 1);
  const stem = fileName.endsWith(MDX_SUFFIX)
    ? fileName.slice(0, -MDX_SUFFIX.length)
    : fileName;
  let base = "";
  for (const character of stem) {
    base += /[A-Za-z0-9_$]/.test(character) ? character : "_";
  }
  if (base.length === 0 || /^[0-9]/.test(base)) {
    base = `_${base}`;
  }
  return base.replace(/^_+/, "_");
}

/**
 * The suffix a fresh `text` binding's identifier adds to the module's stem
 * base (SPEC 6.5: identifier choice is deterministic), so the binding is
 * aliased as 4.4 advises where a file consumes several spec modules.
 */
const TEXT_BINDING_SUFFIX = "Text";

/**
 * A fresh import binding name for `modulePath` (SPEC 6.5 "Added imports",
 * 2.1: fresh, non-colliding, deterministic): the stem base followed by
 * `suffix`, then that with 2, 3, … appended — the first that is no name in
 * `avoided` (the receiving file's own: the names it binds or references,
 * those already added there, and a TSX source's JSX factory names) and no
 * name barred in every file (`barredInEveryFile`).
 */
function freshBindingName(
  modulePath: string,
  avoided: ReadonlySet<string>,
  suffix = "",
): string {
  const base = `${stemIdentifierBase(modulePath)}${suffix}`;
  const usable = (name: string): boolean =>
    !avoided.has(name) && !barredInEveryFile(name);
  if (usable(base)) {
    return base;
  }
  for (let counter = 2; ; counter += 1) {
    const candidate = `${base}${counter}`;
    if (usable(candidate)) {
      return candidate;
    }
  }
}

function bump(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/** One reference of a spec file with its declaring section (SPEC 2.2, 2.3). */
interface LocatedReference {
  readonly section: SpecSection;
  readonly reference: SpecReference;
  /**
   * The occurrence span (SPEC 5.7): a `d` entry's own expression; an MDX
   * embedding's full braced container — the construct a preview's
   * `reference-rewrite` edit spans (SPEC 6.6).
   */
  readonly occurrence: ByteRange;
}

/** Every reference of a spec file, `d` and `text(...)` alike, in document order. */
function locatedReferencesOf(spec: SpecFileAnalysis): LocatedReference[] {
  const references: LocatedReference[] = [];
  for (const dependency of spec.references.dependencies) {
    references.push({
      section: dependency.section,
      reference: dependency.reference,
      occurrence: dependency.reference.range,
    });
  }
  for (const embedding of spec.references.embeddings) {
    if (embedding.reference === null) {
      throw new Error(
        `xspec internal error: an unanalyzable embedding in ` +
          `${spec.document.path} of a validated workspace`,
      );
    }
    references.push({
      section: embedding.embedding.section,
      reference: embedding.reference,
      occurrence: embedding.embedding.range,
    });
  }
  return references;
}

/**
 * The per-file spec-import bookkeeping of a section move (SPEC 6.5, 2.1):
 * resolves needed module bindings (an existing binding of the module when
 * the file has one, a fresh deterministic identifier otherwise), counts
 * reference departures and arrivals per binding, and yields the exact
 * import removals — a binding that had references and is left with none —
 * and the added imports.
 */
class SpecImportPlan {
  private readonly beforeRefs = new Map<string, number>();
  private readonly departures = new Map<string, number>();
  private readonly arrivals = new Map<string, number>();
  private readonly taken = new Set<string>();
  private readonly additions = new Map<string, string>();
  /** Per added module: the spellings rooted at its added binding. */
  private readonly addedSpellings = new Map<string, FindingLocation[]>();

  /** `spec` is null for a target file the move creates (SPEC 6.5). */
  constructor(private readonly spec: SpecFileAnalysis | null) {
    if (spec !== null) {
      for (const imported of spec.imports.imports) {
        if (imported.bindingName !== null) {
          this.taken.add(imported.bindingName);
        }
      }
      for (const located of locatedReferencesOf(spec)) {
        if (located.reference.spelling.form === "chain") {
          bump(this.beforeRefs, located.reference.spelling.rootName);
        }
      }
    }
  }

  /**
   * The binding name a rewritten reference to `modulePath` roots at in this
   * file (SPEC 6.5: an import is added when a rewritten reference needs a
   * module binding its file lacks). Counts one arrival per call.
   * `spelling` is the reference's occurrence in pre-operation coordinates
   * (5.7), recorded, per module, where the binding is an added one: the
   * spellings a `refused-invalid-rewrite` locates when no offset admits the
   * addition, and a `refused-cycle` when the addition closes a would-be
   * spec import cycle (SPEC 14), whether or not their characters change.
   */
  bindingFor(modulePath: string, spelling: FindingLocation): string {
    if (this.spec !== null) {
      for (const imported of this.spec.imports.imports) {
        if (
          imported.targetPath === modulePath &&
          imported.bindingName !== null
        ) {
          bump(this.arrivals, imported.bindingName);
          return imported.bindingName;
        }
      }
    }
    let spellings = this.addedSpellings.get(modulePath);
    if (spellings === undefined) {
      spellings = [];
      this.addedSpellings.set(modulePath, spellings);
    }
    spellings.push(spelling);
    const added = this.additions.get(modulePath);
    if (added !== undefined) {
      return added;
    }
    const name = freshBindingName(modulePath, this.taken);
    this.taken.add(name);
    this.additions.set(modulePath, name);
    return name;
  }

  /** One reference rooted at `rootName` leaves this file or its root. */
  depart(rootName: string): void {
    bump(this.departures, rootName);
  }

  /**
   * SPEC 6.5/2.1: the imports removed — those whose binding had references
   * and the rewrite leaves with none (a binding that was already
   * unreferenced stays), the removals in one ESM block judged together
   * (`removalsLeaveBlockHeaded`, over the file's `bytes`): where they would
   * leave the block headed by anything but a declaration at the start of
   * its first line, the block's first declaration stays — its binding
   * unused (2.1), no removal reported for it (6.6) — and the others are
   * removed, the block it still heads deriving as before.
   */
  removedImports(bytes: Uint8Array): SpecImport[] {
    if (this.spec === null) {
      return [];
    }
    const removed = new Set<SpecImportStatement>();
    for (const imported of this.spec.imports.imports) {
      const name = imported.bindingName;
      if (name === null) {
        throw new Error(
          `xspec internal error: an invalid import in ` +
            `${this.spec.document.path} of a validated workspace`,
        );
      }
      const before = this.beforeRefs.get(name) ?? 0;
      const after =
        before -
        (this.departures.get(name) ?? 0) +
        (this.arrivals.get(name) ?? 0);
      if (before > 0 && after === 0) {
        removed.add(imported.statement);
      }
    }
    for (const block of this.spec.document.esmBlocks) {
      const first = block.imports[0];
      if (
        first !== undefined &&
        removed.has(first) &&
        !removalsLeaveBlockHeaded(bytes, block, removed)
      ) {
        removed.delete(first);
      }
    }
    return this.spec.imports.imports.filter((imported) =>
      removed.has(imported.statement),
    );
  }

  /**
   * The added imports, ordered by module path bytes (deterministic), each
   * with every reference spelling the operation roots at its binding, at
   * its pre-operation occurrence (SPEC 6.5, 14, 5.7).
   */
  addedImports(): {
    readonly modulePath: string;
    readonly name: string;
    readonly spellings: readonly FindingLocation[];
  }[] {
    return [...this.additions.entries()]
      .map(([modulePath, name]) => ({
        modulePath,
        name,
        spellings: this.addedSpellings.get(modulePath) ?? [],
      }))
      .sort((a, b) => compareBytes(a.modulePath, b.modulePath));
  }

  /**
   * Every reference spelling the operation roots at a binding this file's
   * added declarations give it, at its pre-operation occurrence (SPEC 6.5,
   * 14, 5.7).
   */
  addedBindingSpellings(): readonly FindingLocation[] {
    return this.addedImports().flatMap((addition) => addition.spellings);
  }
}

/**
 * Rendered access text for one chain segment (SPEC 6.4/6.5 conversion
 * spelling: dot access for segments that are valid TypeScript identifiers,
 * double-quoted computed access otherwise).
 */
function renderAccess(segment: string): string {
  return isDotAccessSegmentName(segment)
    ? `.${segment}`
    : `[${jsStringLiteral(segment, '"')}]`;
}

/** A whole chain reference's text: root binding plus rendered accesses. */
function renderChain(rootName: string, segments: readonly string[]): string {
  let out = rootName;
  for (const segment of segments) {
    out += renderAccess(segment);
  }
  return out;
}

/** The full byte span of a chain spelling, root through last access. */
function chainSpan(
  spelling: Extract<ReferenceSpelling, { form: "chain" }>,
): ByteRange {
  const last = spelling.segments[spelling.segments.length - 1];
  return {
    start: spelling.rootRange.start,
    end: last === undefined ? spelling.rootRange.end : last.accessRange.end,
  };
}

/** Whether a chain's segments start with the moved ID's segments (SPEC 6.5). */
function segmentsPrefixed(
  segments: readonly string[],
  oldSegments: readonly string[],
): boolean {
  if (segments.length < oldSegments.length) {
    return false;
  }
  for (let index = 0; index < oldSegments.length; index += 1) {
    if (segments[index] !== oldSegments[index]) {
      return false;
    }
  }
  return true;
}

/**
 * The edits retargeting one chain to the moved subtree's new identity
 * (SPEC 6.5): the root rewritten to `newRootName` when it must change, and
 * the old ID's segment prefix replaced by the new ID's — per-segment
 * minimal edits preserving access form when the segment counts agree
 * (SPEC 6.4), the whole prefix span re-rendered otherwise (a form that
 * cannot be kept).
 */
function chainPrefixEdits(
  spelling: Extract<ReferenceSpelling, { form: "chain" }>,
  oldSegments: readonly string[],
  newSegments: readonly string[],
  newRootName: string | null,
): SourceEdit[] {
  const edits: SourceEdit[] = [];
  if (newRootName !== null && newRootName !== spelling.rootName) {
    edits.push({ range: spelling.rootRange, replacement: newRootName });
  }
  const count = oldSegments.length;
  if (spelling.segments.length < count) {
    throw new Error(
      "xspec internal error: affected chain shorter than the moved ID",
    );
  }
  if (newSegments.length === count) {
    for (let index = 0; index < count; index += 1) {
      if (oldSegments[index] !== newSegments[index]) {
        edits.push(segmentEdit(spelling.segments[index]!, newSegments[index]!));
      }
    }
  } else {
    let rendered = "";
    for (const segment of newSegments) {
      rendered += renderAccess(segment);
    }
    edits.push({
      range: {
        start: spelling.segments[0]!.accessRange.start,
        end: spelling.segments[count - 1]!.accessRange.end,
      },
      replacement: rendered,
    });
  }
  return edits;
}

/** The moved-text insertion of one target file (SPEC 6.5). */
interface SectionInsertion {
  /** Insertion offset in the file's original bytes. */
  readonly pos: number;
  /** The re-identified, rewritten moved construct's bytes. */
  readonly body: Uint8Array;
  /**
   * The closing tag appended when the target parent was self-closing
   * (SPEC 6.5: rewritten to paired form) — `</S>`/`</Spec>` — else null.
   */
  readonly pairedClosingTag: string | null;
}

/** Map an original-byte offset through non-straddling edits (SPEC 6.5). */
function mapOffsetThroughEdits(
  offset: number,
  edits: readonly SourceEdit[],
): number {
  let delta = 0;
  for (const edit of edits) {
    if (edit.range.end <= offset) {
      delta +=
        encoder.encode(edit.replacement).length -
        (edit.range.end - edit.range.start);
    } else if (edit.range.start < offset) {
      throw new Error(
        "xspec internal error: a move edit straddles the insertion point",
      );
    }
  }
  return offset + delta;
}

/**
 * Apply a file's edits and the moved-text insertion (SPEC 6.5): the
 * insertion lands immediately before the target parent's closing tag (or at
 * the end of the file), followed by U+000A and preceded by one when the
 * insertion point — evaluated over the edited content — is not at the start
 * of a line; a self-closing parent's appended closing tag follows the
 * inserted text, so the insertion point (immediately after the opening
 * tag's `>`) is never at a line start.
 */
function assembleWithInsertion(
  base: Uint8Array,
  edits: readonly SourceEdit[],
  insertion: SectionInsertion,
): Uint8Array {
  const staged = applyEdits(base, edits);
  const pos = mapOffsetThroughEdits(insertion.pos, edits);
  const atLineStart = pos === 0 || isTerminatorByte(staged[pos - 1]!);
  const leading =
    insertion.pairedClosingTag !== null || !atLineStart ? "\n" : "";
  const head = encoder.encode(leading);
  const tail = encoder.encode(`\n${insertion.pairedClosingTag ?? ""}`);
  const out = new Uint8Array(
    staged.length + head.length + insertion.body.length + tail.length,
  );
  out.set(staged.subarray(0, pos), 0);
  let cursor = pos;
  out.set(head, cursor);
  cursor += head.length;
  out.set(insertion.body, cursor);
  cursor += insertion.body.length;
  out.set(tail, cursor);
  cursor += tail.length;
  out.set(staged.subarray(pos), cursor);
  return out;
}

/**
 * A file's content as every edit of a section move but its added import
 * declarations leaves it, and where declarations added at a
 * pre-operation offset stand in that content (SPEC 6.5 "Composition and
 * admissibility": composition in pre-operation coordinates).
 */
interface FileComposition {
  readonly content: Uint8Array;
  /**
   * The composed position of declarations added at pre-operation
   * `offset`: after every edit whose range ends there, before every edit
   * whose range begins there, and after the target insertion — with the
   * appended closing tag, where one applies — when the insertion shares
   * the offset; null where `offset` lies strictly inside an edit's range,
   * where no addition may stand (SPEC 6.5).
   */
  positionOf(offset: number): number | null;
}

/**
 * Map original-byte offsets through edits; null inside one's range. Each
 * edit's byte delta is computed once, however many offsets are mapped (a
 * placement maps every candidate offset of the file).
 */
function composedPositions(
  edits: readonly SourceEdit[],
): (offset: number) => number | null {
  const deltas = edits.map(
    (edit) =>
      encoder.encode(edit.replacement).length -
      (edit.range.end - edit.range.start),
  );
  return (offset) => {
    let delta = 0;
    for (let index = 0; index < edits.length; index += 1) {
      const edit = edits[index]!;
      if (edit.range.end <= offset) {
        delta += deltas[index]!;
      } else if (edit.range.start < offset) {
        return null;
      }
    }
    return offset + delta;
  };
}

/** The composition of a file receiving no moved text. */
function editsComposition(
  bytes: Uint8Array,
  edits: readonly SourceEdit[],
): FileComposition {
  return {
    content: applyEdits(bytes, edits),
    positionOf: composedPositions(edits),
  };
}

/**
 * The composition of the existing target file: its edits applied and the
 * moved text inserted (SPEC 6.5), declarations added at the insertion's
 * own offset standing after it and after the appended closing tag.
 */
function insertionComposition(
  bytes: Uint8Array,
  edits: readonly SourceEdit[],
  insertion: SectionInsertion,
): FileComposition {
  const content = assembleWithInsertion(bytes, edits, insertion);
  const inserted = content.length - applyEdits(bytes, edits).length;
  const composedPosition = composedPositions(edits);
  return {
    content,
    positionOf: (offset) => {
      const position = composedPosition(offset);
      if (position === null) {
        return null;
      }
      return offset >= insertion.pos ? position + inserted : position;
    },
  };
}

/** The start of the line after the one holding `position` (SPEC 3). */
function nextLineStart(bytes: Uint8Array, position: number): number {
  return terminatorEndAt(bytes, lineContentEndAfter(bytes, position));
}

/**
 * Every line start of a file in document order (SPEC 3: U+000D U+000A is
 * one terminator), the file's end after a final terminator included.
 */
function lineStartsOf(bytes: Uint8Array): number[] {
  const starts = [0];
  for (let start = 0; start < bytes.length;) {
    const next = nextLineStart(bytes, start);
    if (next === start || next > bytes.length) {
      break;
    }
    if (isTerminatorByte(bytes[next - 1]!)) {
      starts.push(next);
    }
    start = next;
  }
  return starts;
}

/**
 * Every line's end in document order — the offset of its terminator, or
 * the file's end for a final line without one.
 */
function lineEndsOf(bytes: Uint8Array): number[] {
  const ends: number[] = [];
  for (const start of lineStartsOf(bytes)) {
    const end = lineContentEndAfter(bytes, start);
    if (end < bytes.length || end > start) {
      ends.push(end);
    }
  }
  return ends;
}

/** The ESM block ranges of a spec source's content; none if unparseable. */
function esmBlockRangesOf(path: string, content: Uint8Array): ByteRange[] {
  const parsed = parseSpecSource(path, content);
  return parsed.kind === "document"
    ? parsed.document.esmBlocks.map((block) => block.range)
    : [];
}

/**
 * SPEC 6.5 "Import edits": whether `content` — a spec source as every edit
 * of the rewrite leaves it, the added declarations' own characters at
 * `added` and the whole addition, a U+000A before it included, at
 * `inserted` — admits the addition: the file is well-formed (14.20); the
 * added lines are import declarations of one ESM block standing inside no
 * section construct of the file so left; and every other line of that
 * block was a line of an ESM block before the addition (`before`: the
 * block ranges of the content without it), so the addition turns no
 * paragraph line, or any other content, into the block's.
 */
function admitsAddedDeclarations(
  path: string,
  content: Uint8Array,
  added: readonly ByteRange[],
  inserted: ByteRange,
  before: readonly ByteRange[],
): boolean {
  const parsed = parseSpecSource(path, content);
  if (parsed.kind !== "document") {
    return false;
  }
  const document = parsed.document;
  const block = document.esmBlocks.find((candidate) =>
    added.every((range) =>
      candidate.imports.some(
        (statement) =>
          statement.range.start === range.start &&
          statement.range.end === range.end,
      ),
    ),
  );
  if (block === undefined) {
    return false;
  }
  if (
    document.sections.some(
      (section) =>
        section.range.start <= block.range.start &&
        block.range.end <= section.range.end,
    )
  ) {
    return false;
  }
  const shift = inserted.end - inserted.start;
  for (
    let line = block.range.start;
    line < block.range.end;
    line = nextLineStart(content, line)
  ) {
    if (line >= inserted.start && line < inserted.end) {
      continue; // an added line
    }
    const original = line < inserted.start ? line : line - shift;
    if (
      !before.some((range) => range.start <= original && original < range.end)
    ) {
      return false;
    }
  }
  return true;
}

/** Whether the line starting at `position` is blank (spaces and tabs). */
function isBlankLineAt(bytes: Uint8Array, position: number): boolean {
  for (let index = position; index < bytes.length; index += 1) {
    const byte = bytes[index]!;
    if (isTerminatorByte(byte)) {
      return true;
    }
    if (byte !== 0x20 && byte !== 0x09) {
      return false;
    }
  }
  return true;
}

/**
 * A file's content with added declarations inserted (`composeAddition`):
 * the byte ranges of the declarations' own characters and of the whole
 * insertion, a U+000A before it included.
 */
interface ComposedAddition {
  readonly content: Uint8Array;
  readonly added: readonly ByteRange[];
  readonly inserted: ByteRange;
}

/**
 * `composed` with the added declaration lines inserted at a candidate's
 * composed position — each line followed by U+000A, the first preceded by
 * one when the position is not at a line start — with the byte ranges of
 * the declarations' own characters and of the whole insertion.
 */
function composeAddition(
  composed: Uint8Array,
  candidate: { readonly position: number; readonly atLineStart: boolean },
  lineBytes: readonly Uint8Array[],
): ComposedAddition {
  let length = candidate.atLineStart ? 0 : 1;
  for (const line of lineBytes) {
    length += line.length + 1;
  }
  const content = new Uint8Array(composed.length + length);
  content.set(composed.subarray(0, candidate.position), 0);
  let cursor = candidate.position;
  if (!candidate.atLineStart) {
    content[cursor] = LF;
    cursor += 1;
  }
  const added: ByteRange[] = [];
  for (const line of lineBytes) {
    content.set(line, cursor);
    added.push({ start: cursor, end: cursor + line.length });
    cursor += line.length;
    content[cursor] = LF;
    cursor += 1;
  }
  content.set(composed.subarray(candidate.position), cursor);
  return {
    content,
    added,
    inserted: { start: candidate.position, end: cursor },
  };
}

/**
 * A candidate offset for a file's added import declarations (SPEC 6.5):
 * the pre-operation `offset`, the `position` at which declarations added
 * there stand in the composed text, and whether that position is at the
 * start of a line — judged over the composed text with the addition
 * absent (SPEC 6.5 "Composition and admissibility").
 */
interface AdditionCandidate {
  readonly offset: number;
  readonly position: number;
  readonly atLineStart: boolean;
}

/**
 * The candidate offsets for a file's added import declarations, in the
 * fixed order they are tried (SPEC 6.5: the choice among admissible
 * offsets is implementation latitude, exercised deterministically):
 * `preferred`, then every line start of the pre-operation file, then
 * `further` (a code source's top-level statement ends), then every line's
 * end, each once — those at the start of a line before every other, an
 * admissible offset at a line start being taken over any other. An offset
 * strictly inside another edit's range, where no addition may stand, or
 * one `excluded` names, is no candidate.
 */
function additionCandidates(
  bytes: Uint8Array,
  composition: FileComposition,
  preferred: readonly number[],
  excluded: (offset: number) => boolean,
  further: readonly number[] = [],
): AdditionCandidate[] {
  const candidates: AdditionCandidate[] = [];
  const seen = new Set<number>();
  for (const offset of [
    ...preferred,
    ...lineStartsOf(bytes),
    ...further,
    ...lineEndsOf(bytes),
  ]) {
    if (seen.has(offset)) {
      continue;
    }
    seen.add(offset);
    if (excluded(offset)) {
      continue;
    }
    const position = composition.positionOf(offset);
    if (position === null) {
      continue;
    }
    const atLineStart =
      position === 0 || isTerminatorByte(composition.content[position - 1]!);
    candidates.push({ offset, position, atLineStart });
  }
  return [
    ...candidates.filter((candidate) => candidate.atLineStart),
    ...candidates.filter((candidate) => !candidate.atLineStart),
  ];
}

/** Where a file's added declarations stand (SPEC 6.5, 6.6). */
interface PlacedAdditions {
  /** The pre-operation offset, exactly the one the preview reports. */
  readonly offset: number;
  /** The file's content, every edit and the addition applied. */
  readonly content: Uint8Array;
  /**
   * Whether the offset is admissible — false only where the file holds
   * no admissible offset at all, the declarations then standing at the
   * first candidate: a text the refused move only judges, never writes.
   */
  readonly admissible: boolean;
}

/**
 * Place a file's added import declarations (SPEC 6.5 "Import edits" and
 * "Composition and admissibility"): `lines`, contiguous, each followed by
 * U+000A and the first preceded by one when its insertion point — judged
 * over the composed text — is not at the start of a line, inserted at the
 * first of `candidates` whose composition `admits`.
 */
function placeImportAdditions(
  composition: FileComposition,
  lines: readonly string[],
  candidates: readonly AdditionCandidate[],
  admits: (candidate: AdditionCandidate, composed: ComposedAddition) => boolean,
): PlacedAdditions {
  const lineBytes = lines.map((line) => encoder.encode(line));
  let fallback: PlacedAdditions | null = null;
  for (const candidate of candidates) {
    const composed = composeAddition(composition.content, candidate, lineBytes);
    fallback ??= {
      offset: candidate.offset,
      content: composed.content,
      admissible: false,
    };
    if (admits(candidate, composed)) {
      return {
        offset: candidate.offset,
        content: composed.content,
        admissible: true,
      };
    }
  }
  // SPEC 6.5 refuses a move leaving a file no admissible offset for an
  // addition it needs (`refused-invalid-rewrite`), decided from
  // `admissible` by the refusal evaluation (`judgeMoveSectionRewrite`).
  // The file's start is always a candidate, so the fallback exists.
  if (fallback === null) {
    throw new Error("xspec internal error: no offset for an import addition");
  }
  return fallback;
}

/**
 * Place a spec source's added import declarations (SPEC 6.5 "Import
 * edits"): at the first candidate (`additionCandidates`) that admits them
 * (`admitsAddedDeclarations`). An offset strictly inside a section
 * construct of the pre-operation file stays inside that construct as every
 * edit leaves the file, so it is never admissible and is not tried.
 */
function placeSpecImportAdditions(
  document: SpecDocument,
  bytes: Uint8Array,
  composition: FileComposition,
  lines: readonly string[],
  preferred: readonly number[],
): PlacedAdditions {
  const candidates = additionCandidates(
    bytes,
    composition,
    preferred,
    (offset) =>
      document.sections.some(
        (section) => section.range.start < offset && offset < section.range.end,
      ),
  );
  const before = esmBlockRangesOf(document.path, composition.content);
  return placeImportAdditions(
    composition,
    lines,
    candidates,
    (candidate, composed) => {
      // The added lines' block runs on through the line after them: at a
      // line start whose line is neither blank nor an ESM block's, that
      // line would join the block — never admissible, so no parse is spent
      // on it. (A line-end candidate is followed by its line's empty
      // remainder.)
      if (
        candidate.atLineStart &&
        !isBlankLineAt(composition.content, candidate.position) &&
        !before.some(
          (range) =>
            range.start <= candidate.position && candidate.position < range.end,
        )
      ) {
        return false;
      }
      return admitsAddedDeclarations(
        document.path,
        composed.content,
        composed.added,
        composed.inserted,
        before,
      );
    },
  );
}

/**
 * SPEC 6.5 "Import edits": whether `composed` — a code source as every
 * edit of the rewrite leaves it, the added declarations' own characters at
 * `composed.added` — admits the addition: the file is well-formed under
 * the grammar its name selects (14.20), and each added line is a
 * top-level declaration of it, an import declaration spanning exactly the
 * added characters. So no construct absorbs a declaration — a comment, a
 * template literal, JSX text, or a block (TypeScript's parser derives an
 * import declaration inside a function body, the top-level rule being a
 * post-parse check) — and it absorbs nothing (a `;` heading the line after
 * it, which the grammar reads as its terminator).
 */
function admitsAddedCodeDeclarations(
  path: string,
  composed: ComposedAddition,
): boolean {
  const declarations = topLevelImportRanges(path, composed.content);
  return (
    declarations !== null &&
    composed.added.every((range) =>
      declarations.some(
        (declaration) =>
          declaration.start === range.start && declaration.end === range.end,
      ),
    )
  );
}

/**
 * SPEC 6.5 "Reference spellings": whether a binding declared at `offset` —
 * an added declaration's position, or a held declaration's start, in
 * pre-operation coordinates — is timely for a spelling rooted, before the
 * operation, at a binding `declaration` declares: the offset is or
 * precedes that declaration, or follows it with no top-level statement
 * between them but import declarations (`layout`, the file before the
 * edit). An added declaration's offset lies inside no statement
 * (`admitsCodeAdditionOffset` checks that first); a held declaration's
 * start lies at the start of, or inside, the top-level statement holding
 * it, which therefore never counts as one standing between.
 */
function timelyAt(
  layout: StatementLayout,
  declaration: ByteRange,
  offset: number,
): boolean {
  if (offset <= declaration.start) {
    return true;
  }
  return layout.statements.every(
    (statement) =>
      statement.importDeclaration ||
      statement.range.start < declaration.end ||
      statement.range.end > offset,
  );
}

/**
 * SPEC 6.5 "Added imports", a TypeScript source's own conditions on an
 * added declaration's offset, each judged over the file before the edit,
 * a statement the rewrite removes included (`layout`, its pre-operation
 * `bytes`): the offset lies at or after the end of the directive
 * prologue; it follows the end of a top-level statement with nothing but
 * whitespace (1.4 — never U+00A0 or U+2028) between, so that it lies
 * inside no statement and the added line parts no comment from the
 * statement it precedes (offset 0 follows none); and the declaration
 * added there is timely for every spelling rooted at its bindings — each
 * former binding's declaration in `formerDeclarations`.
 */
function admitsCodeAdditionOffset(
  bytes: Uint8Array,
  layout: StatementLayout,
  formerDeclarations: readonly ByteRange[],
  offset: number,
): boolean {
  if (offset < layout.prologueEnd) {
    return false;
  }
  let precedingEnd: number | null = null;
  for (const statement of layout.statements) {
    if (statement.range.end > offset) break;
    precedingEnd = statement.range.end;
  }
  if (precedingEnd === null) {
    return false;
  }
  for (let cursor = precedingEnd; cursor < offset; cursor += 1) {
    if (!isWhitespaceByte(bytes[cursor]!)) {
      return false;
    }
  }
  return formerDeclarations.every((declaration) =>
    timelyAt(layout, declaration, offset),
  );
}

/**
 * Place a code source's added import declarations (SPEC 6.5 "Import
 * edits" and "Added imports"): at the first candidate
 * (`additionCandidates`, every top-level statement's end among them, a
 * mid-line offset that may be the file's only admissible one) whose
 * offset meets a TypeScript source's conditions
 * (`admitsCodeAdditionOffset`) and whose composition admits them
 * (`admitsAddedCodeDeclarations`).
 */
function placeCodeImportAdditions(
  path: string,
  bytes: Uint8Array,
  composition: FileComposition,
  lines: readonly string[],
  preferred: readonly number[],
  formerDeclarations: readonly ByteRange[],
): PlacedAdditions {
  // The file before the edit is a discovered code source the workspace's
  // validations parsed (SPEC 6.5 judges only a valid workspace).
  const layout = topLevelStatementLayout(path, bytes);
  if (layout === null) {
    throw new Error(
      `xspec internal error: ${path} is not well-formed before the move`,
    );
  }
  return placeImportAdditions(
    composition,
    lines,
    additionCandidates(
      bytes,
      composition,
      preferred,
      () => false,
      layout.statements.map((statement) => statement.range.end),
    ),
    (candidate, composed) =>
      admitsCodeAdditionOffset(
        bytes,
        layout,
        formerDeclarations,
        candidate.offset,
      ) && admitsAddedCodeDeclarations(path, composed),
  );
}

/** Everything a validated section-form move changes in the sources. */
export interface MoveSectionPlan {
  /** The full identity mapping the operation produces (SPEC 6.5, 6.1). */
  readonly mapping: readonly IdentityMapping[];
  /** The journal entry recording the operation and its mapping (SPEC 6.1). */
  readonly entry: JournalEntry;
  /** Every rewritten source file — the target file (possibly new) included. */
  readonly rewrites: readonly SourceRewrite[];
  /** Whether the plan creates the target file (absent before the move). */
  readonly createsTargetFile: boolean;
  /**
   * The preview plan surface (SPEC 6.6): every file the operation would
   * rewrite or create, with every edit classed and located in
   * pre-operation coordinates — a created target file's entry holding
   * exactly its one `file-creation` edit, the moved text's own rewrites
   * located in the origin file inside the origin deletion's range —
   * collected in the same pass that derives the applied edits, so the real
   * operation and its preview share one plan (the import-addition offsets
   * included, SPEC 6.5).
   */
  readonly previewFiles: readonly PreviewFileEdits[];
}

/**
 * The bindings one declaration added to a file gives it of one module
 * (SPEC 6.5 "Import edits"): exactly the lacked ones — the default binding
 * a chain is rooted at, and, in a TypeScript source, the `text` binding a
 * call's callee is (2.1, 4); null where the file holds the binding.
 */
interface AddedBindings {
  defaultName: string | null;
  textName: string | null;
}

/**
 * An added import declaration, spelled exactly as SPEC 6.5 gives it:
 * `import X from "…"` in a spec source; in a TypeScript source
 * `import X from "…"`, `import { text as Y } from "…"`, or
 * `import X, { text as Y } from "…"`, as the lacked bindings require, the
 * named binding `{ text }` where its identifier is `text` itself — single
 * spaces, no statement terminator, the specifier double-quoted in the
 * canonical relative spelling from the importing file's directory
 * (SPEC 2.1, 6.5 "Import edits"). `composeAddition` puts it on a line of
 * its own.
 */
function importDeclarationLine(
  filePath: string,
  modulePath: string,
  bindings: Readonly<AddedBindings>,
  judging = false,
): string {
  const specifier = relativeModuleSpecifier(
    filePath,
    judging && !modulePath.endsWith(MDX_SUFFIX)
      ? // Judging a target path that is no spec source path (refused as
        // `refused-invalid-destination` beside, SPEC 6.5, 14): its module
        // has no `.xspec` spelling, and any specifier judges the added
        // line alike.
        modulePath
      : moduleSpecifierTargetOf(modulePath),
  );
  const clauses: string[] = [];
  if (bindings.defaultName !== null) {
    clauses.push(bindings.defaultName);
  }
  if (bindings.textName !== null) {
    clauses.push(
      bindings.textName === "text"
        ? "{ text }"
        : `{ text as ${bindings.textName} }`,
    );
  }
  if (clauses.length === 0) {
    throw new Error("xspec internal error: an added import binding nothing");
  }
  return `import ${clauses.join(", ")} from ${jsStringLiteral(specifier, '"')}`;
}

/** An added default import declaration, `import X from "…"` (SPEC 6.5). */
function defaultImportLine(
  filePath: string,
  modulePath: string,
  name: string,
  judging = false,
): string {
  return importDeclarationLine(
    filePath,
    modulePath,
    { defaultName: name, textName: null },
    judging,
  );
}

/**
 * What a section-form move's exact edits leave invalid (SPEC 6.5
 * "Validation and refusals", 14 `refused-invalid-rewrite`), over the files
 * the refusal judges: the origin always, the target only where an
 * insertion point exists, and every other spec source and every code
 * source for the additions it needs.
 */
export interface MoveSectionRewriteVerdict {
  /**
   * The judged files whose would-be text — as every edit but the added
   * declarations leaves it, a created target as its creation composes it —
   * is not well-formed MDX (14.20), in the order judged.
   */
  readonly illFormed: readonly string[];
  /**
   * Each spec or code source holding no admissible offset for the
   * declarations it needs added, with every reference spelling the
   * operation roots at their bindings, at its pre-operation occurrence
   * (5.7), whether or not its characters change — a `text(...)` call in a
   * code source by the whole call.
   */
  readonly inadmissible: readonly {
    readonly path: string;
    readonly spellings: readonly FindingLocation[];
  }[];
}

/**
 * One declaration of the spec import relation a section move's rewrite
 * leaves (SPEC 6.5 "Import edits", 2.1; 14 `refused-cycle`): the importing
 * spec source and the one it designates, by path — a section move
 * relocates no file, and the target file is a created one where the move
 * creates it — located in pre-operation coordinates: a declaration
 * existing before the operation that the rewrite keeps, by its own
 * characters; one the rewrite adds, which exists in no pre-operation
 * coordinates, by every reference spelling the operation roots at its
 * binding, whether or not the spelling's characters change (SPEC 14).
 */
export interface WouldBeSpecImport {
  readonly importer: string;
  readonly imported: string;
  readonly locations: readonly FindingLocation[];
}

/**
 * What the refusal evaluation reads of a section move's composition
 * (SPEC 6.5, 14): the would-be text's verdict (`refused-invalid-rewrite`)
 * and the spec import relation the rewrite leaves (`refused-cycle`).
 */
export interface MoveSectionJudgement {
  readonly verdict: MoveSectionRewriteVerdict;
  /**
   * The spec import relation the rewrite leaves, read from the
   * composition's own import bookkeeping, so the refusal and the rewrite
   * cannot disagree: every declaration it keeps — an import whose
   * bindings were already unused, and a block's first declaration the
   * joint-removal rule keeps, its binding left unused, included — and
   * every one it adds, a declaration it removes standing in no
   * post-operation file (SPEC 6.5 "Import edits"). Spec sources in the
   * analyses' order, each file's kept declarations in source order, then
   * its additions in module-path byte order; a created target file's
   * additions last.
   */
  readonly imports: readonly WouldBeSpecImport[];
}

/**
 * How the refusal evaluation composes a section move's would-be files
 * (SPEC 6.5 "Validation and refusals"): beside every other applicable
 * reason — the exact self-move, a moved text holding an import
 * declaration, a moved reference to the target file's own root (refused
 * as the dependency cycle it closes) — so none of those preconditions is
 * asserted; and the target composed only where an insertion point exists.
 */
interface MoveSectionJudging {
  /**
   * Whether the target insertion point exists: the target path a
   * discovered spec source or an absent path, and the target parent, where
   * `<new-id>` needs one, present outside the moved subtree (SPEC 6.5).
   */
  readonly insertionPoint: boolean;
}

/**
 * Derive the SPEC 6.5 section-form move plan over a validated workspace's
 * analyses. See the module header for the exact text rules and the
 * preconditions the caller has established.
 */
export function planMoveSection(
  specs: readonly SpecFileAnalysis[],
  code: readonly CodeAnalysis[],
  originPath: string,
  oldId: string,
  targetPath: string,
  newId: string,
): MoveSectionPlan {
  const { plan } = composeMoveSection(
    specs,
    code,
    originPath,
    oldId,
    targetPath,
    newId,
    null,
  );
  if (plan === null) {
    throw new Error("xspec internal error: a section move composed no plan");
  }
  return plan;
}

/**
 * SPEC 6.5 "Validation and refusals", 14 `refused-invalid-rewrite` and
 * `refused-cycle`: judge a section-form move's exact edits over a
 * workspace passing `build`'s validations — the would-be text of the
 * origin, and of the target where `insertionPoint` holds, judged
 * well-formed or not (14.20), and every spec and code source judged for
 * an admissible offset for the additions it needs — composed exactly as
 * the plan composes them, beside the spec import relation the rewrite
 * leaves. The verdict means something under an intrinsically valid
 * `<new-id>` alone; the relation reads nothing of `<new-id>`: which
 * references the move re-roots, at which bindings, and which declarations
 * it adds and removes are fixed by the moved subtree, the origin, and the
 * target file (SPEC 6.5 "Import edits"). No code source takes part in a
 * spec import cycle (2.1).
 */
export function judgeMoveSectionRewrite(
  specs: readonly SpecFileAnalysis[],
  code: readonly CodeAnalysis[],
  originPath: string,
  oldId: string,
  targetPath: string,
  newId: string,
  insertionPoint: boolean,
): MoveSectionJudgement {
  const { verdict, imports } = composeMoveSection(
    specs,
    code,
    originPath,
    oldId,
    targetPath,
    newId,
    { insertionPoint },
  );
  return { verdict, imports };
}

/**
 * The section-form composition behind `planMoveSection` (`judging` null:
 * the preconditions asserted, every file composed, the plan returned) and
 * `judgeMoveSectionRewrite` (the preconditions another refusal reason
 * reports tolerated, the verdict judged and the would-be spec import
 * relation read, and no plan).
 */
function composeMoveSection(
  specs: readonly SpecFileAnalysis[],
  code: readonly CodeAnalysis[],
  originPath: string,
  oldId: string,
  targetPath: string,
  newId: string,
  judging: MoveSectionJudging | null,
): {
  readonly plan: MoveSectionPlan | null;
  readonly verdict: MoveSectionRewriteVerdict;
  /** Judging, the would-be spec import relation; empty for a plan. */
  readonly imports: readonly WouldBeSpecImport[];
} {
  const origin = specs.find((spec) => spec.document.path === originPath);
  if (origin === undefined) {
    throw new Error(
      `xspec internal error: move origin ${originPath} is not among the ` +
        `analyzed spec sources`,
    );
  }
  const movedSection = origin.document.sections.find(
    (section) => section.id === oldId,
  );
  if (movedSection === undefined) {
    throw new Error(
      `xspec internal error: move origin ID ${oldId} is not a section of ` +
        `${originPath} — the caller validated its existence`,
    );
  }
  if (judging === null && originPath === targetPath && oldId === newId) {
    throw new Error(
      "xspec internal error: the exact self-move — the caller refused it " +
        "(SPEC 6.5)",
    );
  }
  // The would-be target is composed where an insertion point exists —
  // always for a plan, whose caller refused every move lacking one.
  const composesTarget = judging === null || judging.insertionPoint;
  const illFormed: string[] = [];
  const inadmissible: {
    readonly path: string;
    readonly spellings: readonly FindingLocation[];
  }[] = [];
  // SPEC 6.5/14.20: the judged would-be texts, as every edit but the added
  // declarations leaves them.
  const judgeWellFormed = (path: string, content: Uint8Array): void => {
    if (judging !== null && !isWellFormedSpecSource(content)) {
      illFormed.push(path);
    }
  };
  const sameFile = originPath === targetPath;
  const target = sameFile
    ? origin
    : specs.find((spec) => spec.document.path === targetPath);
  const createsTargetFile = target === undefined;
  const oldSegments = oldId.split(".");
  const newSegments = newId.split(".");
  const movedRange = movedSection.range;
  const originBytes = encoder.encode(origin.document.text);

  // The identity mapping (SPEC 6.5, 6.1): the moved section and every
  // descendant, re-identified by prefix replacement.
  const mapping: IdentityMapping[] = [];
  for (const section of origin.document.sections) {
    if (section.id === null) {
      throw new Error(
        `xspec internal error: a section of ${originPath} in a validated ` +
          `workspace has no ID`,
      );
    }
    const mapped = replaceIdPrefix(section.id, oldId, newId);
    if (mapped !== null) {
      mapping.push({
        from: `${originPath}#${section.id}`,
        to: `${targetPath}#${mapped}`,
      });
    }
  }

  // The target parent: the target file's section bearing `<new-id>` minus
  // its final segment — the file's root (insertion at end of file) for a
  // top-level `new-id` (SPEC 6.5). The caller validated its existence and
  // that it lies outside the moved subtree — or, judging, reports that no
  // insertion point exists, and no target is composed.
  let parentSection: SpecSection | null = null;
  if (composesTarget && newSegments.length > 1) {
    const parentId = newSegments.slice(0, -1).join(".");
    const found = target?.document.sections.find(
      (section) => section.id === parentId,
    );
    if (found === undefined) {
      throw new Error(
        `xspec internal error: missing target parent ${parentId} — the ` +
          `caller validated its existence (SPEC 6.5)`,
      );
    }
    if (sameFile && replaceIdPrefix(parentId, oldId, newId) !== null) {
      throw new Error(
        `xspec internal error: target parent ${parentId} lies within the ` +
          `moved subtree — the caller refused this move (SPEC 6.5)`,
      );
    }
    parentSection = found;
  }

  // Edit collections: inner edits fall within the moved construct and are
  // applied to the extracted slice; outer edits apply to each file's
  // remaining content.
  const outerEdits = new EditCollector();
  // SPEC 6.6: the preview edits, collected beside the applied edits — the
  // moved text's own rewrites in the origin file, at pre-operation
  // coordinates inside the origin deletion's range; a created target file
  // carries exactly its one `file-creation` edit, everything the creation
  // composes subsumed.
  const preview = new PreviewCollector();
  const innerEdits: SourceEdit[] = [];
  const addInner = (edit: SourceEdit): void => {
    if (
      edit.range.start < movedRange.start ||
      edit.range.end > movedRange.end
    ) {
      throw new Error(
        "xspec internal error: an inner move edit outside the moved construct",
      );
    }
    innerEdits.push(edit);
  };

  // Import bookkeeping (cross-file only): per-file plans, created lazily.
  const importPlans = new Map<string, SpecImportPlan>();
  const planFor = (spec: SpecFileAnalysis | null, path: string) => {
    let plan = importPlans.get(path);
    if (plan === undefined) {
      plan = new SpecImportPlan(spec);
      importPlans.set(path, plan);
    }
    return plan;
  };

  // SPEC 6.5: re-identify the moved section and its descendants by prefix
  // replacement — the `id` attribute values rewritten in place, quote style
  // preserved (SPEC 6.4).
  for (const section of origin.document.sections) {
    if (section.id === null) {
      continue;
    }
    const mapped = replaceIdPrefix(section.id, oldId, newId);
    if (mapped === null) {
      continue;
    }
    if (mapped === section.id) {
      // SPEC 6.5: a rewrite is made, and reported (6.6), exactly when it
      // changes the construct's characters — an `id` attribute already
      // spelling its node's new ID (a cross-file section move keeping its
      // ID) is neither rewritten nor reported.
      continue;
    }
    const attribute = section.idAttribute;
    if (attribute === null) {
      throw new Error(
        `xspec internal error: section ${originPath}#${section.id} of a ` +
          `validated workspace has no recorded id attribute`,
      );
    }
    addInner({
      range: attribute.valueRange,
      replacement: attributeValueText(mapped, attribute.quote),
    });
    // SPEC 6.6: an `id`-attribute rewrite spans the attribute's own
    // characters — the re-identification's rewrites locate in the origin
    // file, inside the origin deletion's range (containment is geometry).
    preview.add(originPath, "id-rewrite", attribute.attributeRange);
  }

  // SPEC 6.5: rewrite every reference across the workspace to resolve to
  // the new identities, converting between local and imported forms as the
  // rewrite requires. Spec files first (byte order), references in document
  // order — the deterministic order fresh identifiers are allocated in.
  for (const spec of specs) {
    const path = spec.document.path;
    for (const located of locatedReferencesOf(spec)) {
      const { section, reference, occurrence } = located;
      // The spelling at its pre-operation occurrence (5.7) — a moved
      // text's inside the origin's construct — whatever file it will
      // stand in (SPEC 14 `refused-invalid-rewrite`).
      const spelling: FindingLocation = {
        file: spec.document.file,
        range: occurrence,
      };
      const declaredInMoved =
        spec === origin &&
        section.id !== null &&
        replaceIdPrefix(section.id, oldId, newId) !== null;

      if (reference.target.kind === "local") {
        if (spec !== origin) {
          continue; // the local form names an ID of its own file (SPEC 2.2)
        }
        const mappedLocal = replaceIdPrefix(
          reference.target.idPath,
          oldId,
          newId,
        );
        if (reference.spelling.form !== "string") {
          throw new Error(
            "xspec internal error: a local reference without a string " +
              "spelling",
          );
        }
        if (declaredInMoved) {
          if (mappedLocal !== null) {
            // Within the moved subtree: stays local, re-identified by
            // prefix replacement, quote style preserved (SPEC 6.5, 6.4).
            // A rewrite is made, and reported (6.6), exactly when it
            // changes the construct's characters (SPEC 6.5): a local-form
            // spelling already naming its target's new ID — a cross-file
            // move keeping its ID, read in the target file (2.2) — already
            // resolves to the new identity: neither rewritten nor reported.
            if (mappedLocal !== reference.target.idPath) {
              addInner({
                range: reference.spelling.range,
                replacement: jsStringLiteral(
                  mappedLocal,
                  reference.spelling.quote,
                ),
              });
              preview.add(originPath, "reference-rewrite", occurrence);
            }
          } else if (!sameFile) {
            // A moved reference to a node staying behind: local → imported,
            // rooted at the target file's binding of the origin module
            // (SPEC 6.5).
            const name = planFor(
              createsTargetFile ? null : (target ?? null),
              targetPath,
            ).bindingFor(originPath, spelling);
            addInner({
              range: reference.spelling.range,
              replacement: renderChain(
                name,
                reference.target.idPath.split("."),
              ),
            });
            preview.add(originPath, "reference-rewrite", occurrence);
          }
          continue;
        }
        if (mappedLocal === null) {
          continue;
        }
        if (sameFile) {
          // Same-file move: the reference stays local under the new ID.
          outerEdits.add(path, {
            range: reference.spelling.range,
            replacement: jsStringLiteral(mappedLocal, reference.spelling.quote),
          });
        } else {
          // A remaining reference to the moved subtree: local → imported,
          // rooted at the origin file's binding of the target module
          // (SPEC 6.5).
          const name = planFor(origin, originPath).bindingFor(
            targetPath,
            spelling,
          );
          outerEdits.add(path, {
            range: reference.spelling.range,
            replacement: renderChain(name, mappedLocal.split(".")),
          });
        }
        preview.add(path, "reference-rewrite", occurrence);
        continue;
      }

      // External chain references (SPEC 2.2, 2.4).
      const { modulePath, segments } = reference.target;
      if (reference.spelling.form !== "chain") {
        throw new Error(
          "xspec internal error: an external reference without a chain " +
            "spelling",
        );
      }
      if (declaredInMoved) {
        if (sameFile) {
          continue; // roots and targets are unaffected by a same-file move
        }
        // The reference departs the origin file with the moved text.
        planFor(origin, originPath).depart(reference.spelling.rootName);
        if (modulePath === targetPath) {
          // The moved text references the file it moves into: imported →
          // local (SPEC 6.5); a file never imports itself (SPEC 2.1).
          if (segments.length === 0) {
            if (judging !== null) {
              // Refused as the dependency cycle it closes (`refused-cycle`,
              // core/refusal.ts): no form spells it in the target file, so
              // the would-be text keeps the expression as spelled — any
              // expression judges alike (SPEC 6.5, 14.20).
              continue;
            }
            throw new Error(
              "xspec internal error: a moved reference targets the target " +
                "file's root node — the caller refused this move (SPEC 6.5)",
            );
          }
          addInner({
            range: chainSpan(reference.spelling),
            replacement: jsStringLiteral(segments.join("."), '"'),
          });
          preview.add(originPath, "reference-rewrite", occurrence);
        } else {
          // The chain must root at the target file's binding of the same
          // module — an existing binding, or a fresh added import
          // (SPEC 6.5, 2.1).
          const name = planFor(
            createsTargetFile ? null : (target ?? null),
            targetPath,
          ).bindingFor(modulePath, spelling);
          if (name !== reference.spelling.rootName) {
            addInner({
              range: reference.spelling.rootRange,
              replacement: name,
            });
            preview.add(originPath, "reference-rewrite", occurrence);
          }
        }
        continue;
      }
      // Declared outside the moved subtree: only chains into the moved
      // subtree are affected (SPEC 6.5).
      if (
        modulePath !== originPath ||
        !segmentsPrefixed(segments, oldSegments)
      ) {
        continue;
      }
      if (!sameFile && spec === target) {
        // The target file's own reference to the moved subtree: imported →
        // local under the new identity (SPEC 6.5; double-quoted string, 6.4).
        const rest = segments.slice(oldSegments.length);
        planFor(target ?? null, targetPath).depart(reference.spelling.rootName);
        outerEdits.add(path, {
          range: chainSpan(reference.spelling),
          replacement: jsStringLiteral(
            [...newSegments, ...rest].join("."),
            '"',
          ),
        });
        preview.add(path, "reference-rewrite", occurrence);
        continue;
      }
      if (sameFile) {
        // The module is unchanged; only the segment prefix is re-identified.
        const prefixEdits = chainPrefixEdits(
          reference.spelling,
          oldSegments,
          newSegments,
          null,
        );
        for (const edit of prefixEdits) {
          outerEdits.add(path, edit);
        }
        if (prefixEdits.length > 0) {
          preview.add(path, "reference-rewrite", occurrence);
        }
        continue;
      }
      // Another spec file's chain into the moved subtree: re-rooted at that
      // file's binding of the target module, segments re-identified
      // (SPEC 6.5).
      const filePlan = planFor(spec, path);
      filePlan.depart(reference.spelling.rootName);
      const rootName = filePlan.bindingFor(targetPath, spelling);
      const prefixEdits = chainPrefixEdits(
        reference.spelling,
        oldSegments,
        newSegments,
        rootName,
      );
      for (const edit of prefixEdits) {
        outerEdits.add(path, edit);
      }
      if (prefixEdits.length > 0) {
        preview.add(path, "reference-rewrite", occurrence);
      }
    }
  }

  // SPEC 6.5: TypeScript markers and `text(...)` calls into the moved
  // subtree. Under a cross-file move each is rooted at bindings of the
  // target module — a chain (a marker, a call's argument) at its default
  // binding, a call's callee at its `text` binding (4.3, 4.4) — each one
  // the file already holds that no local declaration shadows at the
  // occurrence (4.5) and that is timely for the spelling (the first such
  // in document order, deterministic) or else one the declaration added
  // to the file gives: one per module, binding exactly the lacked ones,
  // its fresh identifiers shadowed nowhere (they avoid every identifier
  // the file spells) — so a file may gain a second declaration of a
  // module it already imports, where every binding it holds of it is
  // untimely for a spelling. A call is so rewritten whole, over its
  // occurrence's span (5.7), and is never the cross-module call of 14.11.
  // Under a same-file move the module is kept, so only a chain's segment
  // prefix is re-identified and no callee is touched. Type-level
  // references record no edges (SPEC 4.5) and are absent from the
  // analyzed references.
  //
  // SPEC 6.5 "Import edits": an occurrence uses a binding when its chain is
  // rooted at it or, for a `text(...)` call, its callee is it (4.5); a spec
  // module import is removed exactly when an occurrence used a binding of
  // its before the rewrite and none uses any binding of its after it — an
  // import whose bindings were already unused stays (2.1). Uses are counted
  // per import declaration, the one the analysis resolved each root and
  // callee to, before the rewrite and as the re-rooting leaves them.
  const codeAdditions = new Map<string, Map<string, AddedBindings>>();
  const codeRemovals = new Map<string, readonly CodeImport[]>();
  // Per code file: every occurrence (5.7) the operation roots at a binding
  // its added declaration gives it, in pre-operation coordinates — the
  // spellings a `refused-invalid-rewrite` locates when no offset admits
  // the addition (SPEC 14), a `text(...)` call's by the whole call, whether
  // its argument's root, its callee, or both take an added binding.
  const codeAddedSpellings = new Map<string, FindingLocation[]>();
  // Per code file: the pre-operation declaration of the binding each
  // spelling the operation roots at an added binding was rooted at before
  // — a chain's root import, a callee's `text` import — for each of which
  // the added declaration's offset must be timely (SPEC 6.5 "Added
  // imports": its bindings timely for every spelling rooted at them) —
  // each declaration recorded once, however many spellings it served.
  const codeAddedFormerDeclarations = new Map<string, ByteRange[]>();
  const addFormerDeclaration = (path: string, range: ByteRange): void => {
    let ranges = codeAddedFormerDeclarations.get(path);
    if (ranges === undefined) {
      ranges = [];
      codeAddedFormerDeclarations.set(path, ranges);
    }
    if (
      !ranges.some(
        (recorded) =>
          recorded.start === range.start && recorded.end === range.end,
      )
    ) {
      ranges.push(range);
    }
  };
  for (const analysis of code) {
    const usesBefore = analysis.imports.map(() => 0);
    for (const reference of analysis.references) {
      usesBefore[reference.rootImport]! += 1;
      if (reference.calleeImport !== null) {
        usesBefore[reference.calleeImport]! += 1;
      }
    }
    const usesAfter = [...usesBefore];
    // SPEC 6.5 "Reference spellings": the file's top-level statements
    // before the edit, over which a held binding's timeliness is judged —
    // read once, where it is first needed. The file is a discovered code
    // source the workspace's validations parsed (6.5 judges only a valid
    // workspace), every code source a TypeScript source.
    let layout: StatementLayout | null = null;
    const statementLayout = (): StatementLayout => {
      layout ??= topLevelStatementLayout(
        analysis.path,
        encoder.encode(analysis.text),
      );
      if (layout === null) {
        throw new Error(
          `xspec internal error: ${analysis.path} is not well-formed ` +
            `before the move`,
        );
      }
      return layout;
    };
    // Whether the binding a held declaration (`held`) gives is timely for a
    // spelling rooted before the operation at one `former` gives — a
    // relation between the two declarations alone, judged once per pair
    // (each an index into the file's imports).
    const timelyPairs = new Map<string, boolean>();
    const heldTimely = (former: number, held: number): boolean => {
      const key = `${former}:${held}`;
      let timely = timelyPairs.get(key);
      if (timely === undefined) {
        timely = timelyAt(
          statementLayout(),
          analysis.imports[former]!.range,
          analysis.imports[held]!.range.start,
        );
        timelyPairs.set(key, timely);
      }
      return timely;
    };
    // The target module's value-level bindings the file already holds that
    // no local declaration shadows at the occurrence (SPEC 6.5 "Reference
    // spellings", 4.5) and that are timely for the spelling — declared at
    // or before the declaration of the binding it was rooted at before the
    // operation (`former`, an index into the file's imports: a chain's
    // root import, a callee's `text` import), or after it with no
    // top-level statement between them but import declarations: the first
    // such in document order — declarations, then a declaration's bindings
    // — deterministic; null where the file holds none there, and the
    // added declaration's binding roots the spelling instead.
    const holdsTarget = (imported: CodeImport): boolean =>
      imported.valid && imported.targetPath === targetPath;
    const existingBinding = (
      reference: CodeReference,
      bindingsOf: (imported: CodeImport) => readonly CodeImportBinding[],
      former: number,
    ): { readonly importIndex: number; readonly name: string } | null => {
      for (const [importIndex, imported] of analysis.imports.entries()) {
        if (!holdsTarget(imported) || !heldTimely(former, importIndex)) {
          continue;
        }
        const binding = bindingsOf(imported).find(
          (candidate) =>
            !candidate.typeOnly &&
            !reference.shadowedImportNames.has(candidate.name),
        );
        if (binding !== undefined) return { importIndex, name: binding.name };
      }
      return null;
    };
    // A chain's root: any binding of the module's default export — the
    // default clause's or a named `{ default as X }` element's (SPEC 4).
    const defaultBindingsOf = (
      imported: CodeImport,
    ): readonly CodeImportBinding[] => imported.defaultBindings;
    const textBindingsOf = (
      imported: CodeImport,
    ): readonly CodeImportBinding[] => imported.textBindings;
    // The declaration the rewrite adds, and the names its fresh identifiers
    // avoid (SPEC 6.5 "Added imports": bound by no declaration already in
    // the file and equal to no name it references, 2.1, 4): every
    // identifier the file spells — each binding of every scope, value- or
    // type-level, imports included, and each name the file reads — so an
    // added binding collides with no module-scope declaration, no inner
    // declaration shadows it at an occurrence it roots (4.5), and it
    // captures no use of an outer name; and in a TSX source the names
    // through which the classic JSX transform reaches its factories. The
    // names barred in every file are `freshBindingName`'s own.
    let added: AddedBindings | null = null;
    let taken: Set<string> | null = null;
    const addition = (): { added: AddedBindings; taken: Set<string> } => {
      taken ??= new Set([
        ...analysis.spelledNames,
        ...jsxFactoryNames(analysis.path, analysis.text),
      ]);
      if (added === null) {
        added = { defaultName: null, textName: null };
        let additions = codeAdditions.get(analysis.path);
        if (additions === undefined) {
          additions = new Map();
          codeAdditions.set(analysis.path, additions);
        }
        additions.set(targetPath, added);
      }
      return { added, taken };
    };
    for (const reference of analysis.references) {
      if (
        reference.modulePath !== originPath ||
        !segmentsPrefixed(reference.segments, oldSegments)
      ) {
        continue;
      }
      if (reference.spelling.form !== "chain") {
        throw new Error(
          "xspec internal error: a code reference without a chain spelling",
        );
      }
      let rootName: string | null = null;
      let calleeName: string | null = null;
      let rootedAtAddition = false;
      if (!sameFile) {
        // The chain leaves its origin-module root for a binding of the
        // target module — another module, so another import.
        usesAfter[reference.rootImport]! -= 1;
        const existingDefault = existingBinding(
          reference,
          defaultBindingsOf,
          reference.rootImport,
        );
        if (existingDefault !== null) {
          rootName = existingDefault.name;
          usesAfter[existingDefault.importIndex]! += 1;
        } else {
          const fresh = addition();
          fresh.added.defaultName ??= freshBindingName(targetPath, fresh.taken);
          fresh.taken.add(fresh.added.defaultName);
          rootName = fresh.added.defaultName;
          rootedAtAddition = true;
          addFormerDeclaration(
            analysis.path,
            analysis.imports[reference.rootImport]!.range,
          );
        }
        if (reference.callee !== null) {
          // SPEC 6.5, 4.4: the callee leaves the origin module's `text`
          // for the target module's — the call is rewritten whole.
          if (reference.calleeImport === null) {
            throw new Error(
              "xspec internal error: a text(...) call without its callee's " +
                "import",
            );
          }
          usesAfter[reference.calleeImport]! -= 1;
          const existingText = existingBinding(
            reference,
            textBindingsOf,
            reference.calleeImport,
          );
          if (existingText !== null) {
            calleeName = existingText.name;
            usesAfter[existingText.importIndex]! += 1;
          } else {
            const fresh = addition();
            fresh.added.textName ??= freshBindingName(
              targetPath,
              fresh.taken,
              TEXT_BINDING_SUFFIX,
            );
            fresh.taken.add(fresh.added.textName);
            calleeName = fresh.added.textName;
            rootedAtAddition = true;
            addFormerDeclaration(
              analysis.path,
              analysis.imports[reference.calleeImport]!.range,
            );
          }
        }
      }
      if (rootedAtAddition) {
        let spellings = codeAddedSpellings.get(analysis.path);
        if (spellings === undefined) {
          spellings = [];
          codeAddedSpellings.set(analysis.path, spellings);
        }
        spellings.push({
          file: analysis.file,
          range: reference.occurrenceRange,
        });
      }
      const referenceEdits = chainPrefixEdits(
        reference.spelling,
        oldSegments,
        newSegments,
        rootName,
      );
      if (
        reference.callee !== null &&
        calleeName !== null &&
        calleeName !== reference.callee.name
      ) {
        referenceEdits.push({
          range: reference.callee.range,
          replacement: calleeName,
        });
      }
      for (const edit of referenceEdits) {
        outerEdits.add(analysis.path, edit);
      }
      if (referenceEdits.length > 0) {
        // SPEC 6.6/5.7: a marker occurrence spans the bare chain, a TS
        // `text(...)` occurrence the whole call expression — one rewrite
        // however many of its parts change.
        preview.add(
          analysis.path,
          "reference-rewrite",
          reference.occurrenceRange,
        );
      }
    }
    const removed = analysis.imports.filter(
      (_, index) => usesBefore[index]! > 0 && usesAfter[index] === 0,
    );
    if (removed.length > 0) {
      codeRemovals.set(analysis.path, removed);
    }
  }

  // The rewritten moved text: the extracted slice with the inner edits
  // applied (SPEC 6.5: the moved text is the construct's own characters —
  // it travels verbatim beyond the identity and reference rewrites).
  const movedBody = applyEdits(
    originBytes.subarray(movedRange.start, movedRange.end),
    innerEdits.map((edit) => ({
      range: {
        start: edit.range.start - movedRange.start,
        end: edit.range.end - movedRange.start,
      },
      replacement: edit.replacement,
    })),
  );

  // Per-file import edits (cross-file only). Which declarations a spec
  // source loses is judged per ESM block (`SpecImportPlan.removedImports`,
  // SPEC 6.5); removals are line-dropped like every 6.5 deletion, each
  // reported with every byte it removes (SPEC 6.6: an import removal's
  // range spans the declaration plus the leftover whitespace and terminator
  // of each line its drop empties, judged per declaration).
  //
  // Judging a moved text that holds an import declaration — refused as
  // `refused-moved-import` (SPEC 6.5, 14), never planned — the origin
  // deletion removes each declaration inside the construct with the moved
  // text: no removal of its own, and no survivor.
  const deletedWithMoved = (
    spec: SpecFileAnalysis,
    imported: SpecImport,
  ): boolean =>
    judging !== null &&
    spec === origin &&
    imported.statement.range.start >= movedRange.start &&
    imported.statement.range.end <= movedRange.end;
  const removedImportsOf = (
    spec: SpecFileAnalysis,
    plan: SpecImportPlan,
    bytes: Uint8Array,
  ): SpecImport[] =>
    plan
      .removedImports(bytes)
      .filter((imported) => !deletedWithMoved(spec, imported));
  const importRemovalsFor = (
    spec: SpecFileAnalysis,
    plan: SpecImportPlan,
    bytes: Uint8Array,
  ): ByteRange[] => {
    const removed = removedImportsOf(spec, plan, bytes);
    for (const imported of removed) {
      preview.add(
        spec.document.path,
        "import-removal",
        removalSpan(bytes, imported.statement.range),
      );
    }
    return removed.map((imported) => imported.statement.range);
  };

  // Additions (SPEC 6.5 "Import edits"): the added declarations stand at
  // an admissible offset of the file as every other edit leaves it — first
  // tried after the last surviving import's line, then at the first
  // removed import's line start, then at the start of the file — one
  // deterministic offset, shared with the preview (SPEC 6.6: in a
  // pre-existing file the real insertion offset is exactly the previewed
  // one). Returns the file's final content, or null when it adds nothing.
  const withImportAdditions = (
    spec: SpecFileAnalysis,
    plan: SpecImportPlan,
    bytes: Uint8Array,
    composition: FileComposition,
  ): Uint8Array | null => {
    const path = spec.document.path;
    const added = plan.addedImports();
    if (added.length === 0) {
      return null;
    }
    const lines = added.map((addition) =>
      defaultImportLine(
        path,
        addition.modulePath,
        addition.name,
        judging !== null,
      ),
    );
    const removed = removedImportsOf(spec, plan, bytes);
    const removedSet = new Set(removed);
    const survivors = spec.imports.imports.filter(
      (imported) =>
        !removedSet.has(imported) && !deletedWithMoved(spec, imported),
    );
    const lastSurvivor = survivors[survivors.length - 1];
    const firstRemoved = removed[0];
    const preferred = [
      ...(lastSurvivor === undefined
        ? []
        : [offsetAfterLine(bytes, lastSurvivor.statement.range.end)]),
      ...(firstRemoved === undefined
        ? []
        : [lineStartBefore(bytes, firstRemoved.statement.range.start)]),
      0,
    ];
    const placed = placeSpecImportAdditions(
      spec.document,
      bytes,
      composition,
      lines,
      preferred,
    );
    if (!placed.admissible) {
      // SPEC 6.5/14 `refused-invalid-rewrite`: the file holds no
      // admissible offset for the declarations it needs, located by every
      // spelling rooted at their bindings — a refusal the plan's caller
      // has already reported, judging the same composition.
      if (judging === null) {
        throw new Error(
          `xspec internal error: ${path} holds no admissible offset for an ` +
            `import addition — the caller refused this move (SPEC 6.5)`,
        );
      }
      inadmissible.push({ path, spellings: plan.addedBindingSpellings() });
    }
    // SPEC 6.6: each added declaration is one import addition, reported as
    // a zero-length insertion point at the exact offset the real operation
    // then inserts at (SPEC 6.5).
    for (let index = 0; index < lines.length; index += 1) {
      preview.add(path, "import-addition", {
        start: placed.offset,
        end: placed.offset,
      });
    }
    return placed.content;
  };

  // Assemble every rewritten file.
  const rewrites: SourceRewrite[] = [];

  // The insertion point (SPEC 6.5): immediately before the target parent's
  // closing tag; the end of the file for a top-level `new-id`; immediately
  // after the terminating `>` for a self-closing parent rewritten to paired
  // form.
  const targetBytes = sameFile
    ? originBytes
    : target !== undefined
      ? encoder.encode(target.document.text)
      : new Uint8Array(0);
  let insertion: SectionInsertion;
  let pairedFormEdit: SourceEdit | null = null;
  if (parentSection === null) {
    insertion = {
      pos: targetBytes.length,
      body: movedBody,
      pairedClosingTag: null,
    };
  } else if (parentSection.selfClosing) {
    // SPEC 6.5: the self-closing parent's `/` and any whitespace
    // immediately before or after it are deleted; the matching closing tag
    // is appended immediately after the tag's terminating `>`, and the
    // insertion rule applies before that closing tag.
    const tag = parentSection.openingTagRange;
    let slash = tag.end - 2; // the byte before the terminating `>`
    while (slash > tag.start && isWhitespaceByte(targetBytes[slash]!)) {
      slash -= 1;
    }
    if (targetBytes[slash] !== 0x2f /* `/` */) {
      throw new Error(
        "xspec internal error: a self-closing section tag without its `/`",
      );
    }
    let wsStart = slash;
    while (wsStart > tag.start && isWhitespaceByte(targetBytes[wsStart - 1]!)) {
      wsStart -= 1;
    }
    pairedFormEdit = {
      range: { start: wsStart, end: tag.end - 1 },
      replacement: "",
    };
    // `<Spec` when the name byte run after `<` is exactly "Spec".
    const isSpec =
      targetBytes[tag.start + 1] === 0x53 /* S */ &&
      targetBytes[tag.start + 2] === 0x70 /* p */ &&
      targetBytes[tag.start + 3] === 0x65 /* e */ &&
      targetBytes[tag.start + 4] === 0x63; /* c */
    insertion = {
      pos: tag.end,
      body: movedBody,
      pairedClosingTag: isSpec ? "</Spec>" : "</S>",
    };
  } else {
    insertion = {
      pos: parentSection.closingTagRange.start,
      body: movedBody,
      pairedClosingTag: null,
    };
  }

  // SPEC 6.6: the origin deletion — one range spanning every byte the
  // origin edit removes: the construct's own characters extended over the
  // adjunct-dropped leftover whitespace and line terminators (SPEC 6.5, 3).
  preview.add(
    originPath,
    "origin-deletion",
    removalSpan(originBytes, movedRange),
  );
  if (createsTargetFile) {
    // SPEC 6.6: target-file creation — the insertion point at the start of
    // the new file, the one reported location without pre-operation
    // coordinates and the created file's only reported edit: creation
    // composes the file's entire initial content, subsuming the insertion
    // and the import additions the rewrite requires there.
    preview.add(targetPath, "file-creation", { start: 0, end: 0 });
  } else {
    // SPEC 6.6: the target insertion point, zero-length at its offset in
    // pre-operation coordinates — a self-closing target parent's is the
    // tag's end, where every byte the operation adds attaches.
    preview.add(targetPath, "target-insertion", {
      start: insertion.pos,
      end: insertion.pos,
    });
    if (pairedFormEdit !== null && parentSection !== null) {
      // SPEC 6.6: the self-closing-target-parent rewrite spans the tag.
      preview.add(
        targetPath,
        "target-parent-rewrite",
        parentSection.openingTagRange,
      );
    }
  }

  if (sameFile) {
    // One file carries the deletion, the outer rewrites, the paired-form
    // rewrite of a self-closing target parent, and the insertion — judged
    // with no insertion point, the deletion and the rewrites alone (SPEC
    // 6.5: the origin as its deletion leaves it).
    const edits: SourceEdit[] = [
      ...deletionEditsWithLineDrops(originBytes, [movedRange]),
      ...(outerEdits.editsFor(originPath) ?? []),
      ...(pairedFormEdit === null ? [] : [pairedFormEdit]),
    ];
    const content = composesTarget
      ? assembleWithInsertion(originBytes, edits, insertion)
      : applyEdits(originBytes, edits);
    judgeWellFormed(originPath, content);
    rewrites.push({ path: originPath, content });
  } else {
    // The origin file: construct deletion, remaining-reference rewrites,
    // import removals and additions (SPEC 6.5).
    const originPlan = planFor(origin, originPath);
    const originEdits: SourceEdit[] = [
      ...deletionEditsWithLineDrops(originBytes, [
        movedRange,
        ...importRemovalsFor(origin, originPlan, originBytes),
      ]),
      ...(outerEdits.editsFor(originPath) ?? []),
    ];
    const originComposition = editsComposition(originBytes, originEdits);
    judgeWellFormed(originPath, originComposition.content);
    rewrites.push({
      path: originPath,
      content:
        withImportAdditions(
          origin,
          originPlan,
          originBytes,
          originComposition,
        ) ?? originComposition.content,
    });

    // The target file: created empty before insertion (SPEC 6.5), or the
    // existing file with its conversions, import edits, the paired-form
    // rewrite, and the insertion — composed only where an insertion point
    // exists (judging: SPEC 6.5 judges the target's text exactly then).
    if (composesTarget && target === undefined) {
      const plan = planFor(null, targetPath);
      const added = plan.addedImports();
      const importBlock =
        added.length === 0
          ? ""
          : `${added
              .map((addition) =>
                defaultImportLine(
                  targetPath,
                  addition.modulePath,
                  addition.name,
                ),
              )
              .map((line) => `${line}\n`)
              .join("")}\n`;
      const head = encoder.encode(importBlock);
      const tail = encoder.encode("\n");
      const content = new Uint8Array(
        head.length + movedBody.length + tail.length,
      );
      content.set(head, 0);
      content.set(movedBody, head.length);
      content.set(tail, head.length + movedBody.length);
      judgeWellFormed(targetPath, content);
      rewrites.push({ path: targetPath, content });
    } else if (composesTarget && target !== undefined) {
      const targetPlan = planFor(target, targetPath);
      const targetEdits: SourceEdit[] = [
        ...deletionEditsWithLineDrops(
          targetBytes,
          importRemovalsFor(target, targetPlan, targetBytes),
        ),
        ...(outerEdits.editsFor(targetPath) ?? []),
        ...(pairedFormEdit === null ? [] : [pairedFormEdit]),
      ];
      const targetComposition = insertionComposition(
        targetBytes,
        targetEdits,
        insertion,
      );
      judgeWellFormed(targetPath, targetComposition.content);
      rewrites.push({
        path: targetPath,
        content:
          withImportAdditions(
            target,
            targetPlan,
            targetBytes,
            targetComposition,
          ) ?? targetComposition.content,
      });
    }

    // Other spec files: chain retargets plus their import edits.
    for (const spec of specs) {
      const path = spec.document.path;
      if (path === originPath || path === targetPath) {
        continue;
      }
      const plan = importPlans.get(path);
      const fileEdits: SourceEdit[] = [...(outerEdits.editsFor(path) ?? [])];
      if (plan !== undefined) {
        const bytes = encoder.encode(spec.document.text);
        fileEdits.push(
          ...deletionEditsWithLineDrops(
            bytes,
            importRemovalsFor(spec, plan, bytes),
          ),
        );
        const composition = editsComposition(bytes, fileEdits);
        const content = withImportAdditions(spec, plan, bytes, composition);
        if (content !== null) {
          rewrites.push({ path, content });
        } else if (fileEdits.length > 0) {
          rewrites.push({ path, content: composition.content });
        }
        continue;
      }
      if (fileEdits.length > 0) {
        rewrites.push({
          path,
          content: applyEdits(encoder.encode(spec.document.text), fileEdits),
        });
      }
    }
  }

  if (sameFile) {
    // Same-file moves still rewrite other files' chains into the subtree.
    for (const spec of specs) {
      const path = spec.document.path;
      if (path === originPath) {
        continue;
      }
      const fileEdits = outerEdits.editsFor(path);
      if (fileEdits !== undefined) {
        rewrites.push({
          path,
          content: applyEdits(encoder.encode(spec.document.text), fileEdits),
        });
      }
    }
  }

  // Code files: chain and callee retargets, import removals, and added
  // imports (SPEC 6.5, 4). A removal is line-dropped like every 6.5 deletion and
  // reported with every byte it removes (SPEC 6.6, judged per
  // declaration). An addition stands at an admissible offset: one at or
  // after the end of the file's directive prologue, following the end of
  // a top-level statement with nothing but 1.4 whitespace between, and
  // timely for every spelling rooted at the added bindings, each judged
  // over the file before the edit (`admitsCodeAdditionOffset`), at which
  // the file, as every edit of the rewrite leaves it, is well-formed under
  // the grammar its name selects (14.20) with each added line a top-level
  // import declaration (`admitsAddedCodeDeclarations`). Candidates are
  // tried in a fixed order — after the line of the file's last spec-module
  // import (a code file referencing the moved subtree always has one: its
  // chains root at import bindings), the first removed import's line
  // start, the file's start, then every other line start, every top-level
  // statement's end, and every line's end — an offset at the start of a
  // line, judged over the composed text, taken over any other: the one
  // deterministic offset the preview reports (SPEC 6.5, 6.6), an addition
  // at the end of a removal's range reading what that removal leaves
  // (SPEC 6.5 "Composition and admissibility").
  for (const analysis of code) {
    const bytes = encoder.encode(analysis.text);
    const removed = codeRemovals.get(analysis.path) ?? [];
    for (const imported of removed) {
      preview.add(
        analysis.path,
        "import-removal",
        removalSpan(bytes, imported.range),
      );
    }
    const fileEdits: SourceEdit[] = [
      ...(outerEdits.editsFor(analysis.path) ?? []),
      ...deletionEditsWithLineDrops(
        bytes,
        removed.map((imported) => imported.range),
      ),
    ];
    const additions = [...(codeAdditions.get(analysis.path) ?? new Map())];
    if (fileEdits.length === 0 && additions.length === 0) {
      continue;
    }
    const composition = editsComposition(bytes, fileEdits);
    let content = composition.content;
    if (additions.length > 0) {
      const anchor = analysis.imports[analysis.imports.length - 1];
      if (anchor === undefined) {
        throw new Error(
          `xspec internal error: code file ${analysis.path} references the ` +
            `moved subtree but has no spec module import`,
        );
      }
      // SPEC 6.5: each added declaration binds exactly the lacked
      // bindings, spelled `import X from "…"`, `import { text as Y } from
      // "…"`, or `import X, { text as Y } from "…"`, no statement
      // terminator, on a line of its own.
      const lines = additions
        .sort((a, b) => compareBytes(a[0], b[0]))
        .map(([modulePath, bindings]) =>
          importDeclarationLine(
            analysis.path,
            modulePath,
            bindings,
            judging !== null,
          ),
        );
      const firstRemoved = removed[0];
      const placed = placeCodeImportAdditions(
        analysis.path,
        bytes,
        composition,
        lines,
        [
          offsetAfterLine(bytes, anchor.range.end),
          ...(firstRemoved === undefined
            ? []
            : [lineStartBefore(bytes, firstRemoved.range.start)]),
          0,
        ],
        codeAddedFormerDeclarations.get(analysis.path) ?? [],
      );
      if (!placed.admissible) {
        // SPEC 6.5/14 `refused-invalid-rewrite`: the file holds no
        // admissible offset for the declaration it needs, located by every
        // occurrence rooted at its bindings — a refusal the plan's caller
        // has already reported, judging the same composition.
        if (judging === null) {
          throw new Error(
            `xspec internal error: ${analysis.path} holds no admissible ` +
              `offset for an import addition — the caller refused this ` +
              `move (SPEC 6.5)`,
          );
        }
        inadmissible.push({
          path: analysis.path,
          spellings: codeAddedSpellings.get(analysis.path) ?? [],
        });
      }
      content = placed.content;
      // SPEC 6.6: each added declaration is one import addition, its
      // zero-length insertion point at the exact offset the real operation
      // then inserts at (SPEC 6.5).
      for (let index = 0; index < lines.length; index += 1) {
        preview.add(analysis.path, "import-addition", {
          start: placed.offset,
          end: placed.offset,
        });
      }
    }
    rewrites.push({ path: analysis.path, content });
  }

  // SPEC 6.5 "Import edits", 14 `refused-cycle`: judging, the spec import
  // relation the rewrite leaves, read from this composition's own import
  // bookkeeping, so the refusal and the rewrite cannot disagree — each
  // spec source's declarations but those its removals take (the
  // joint-removal rule of `removedImports` included: a block's first
  // declaration stays, its binding unused, where the others' removal would
  // leave the block headed by anything else) and those the origin deletion
  // takes with a moved text holding them (`refused-moved-import`), each by
  // its own characters; then the declarations the rewrite adds to it, each
  // by the spellings rooted at its binding; a created target file's
  // additions last. A same-file move plans no import edit, every
  // declaration staying.
  const imports: WouldBeSpecImport[] = [];
  const pushAdditions = (path: string): void => {
    for (const addition of importPlans.get(path)?.addedImports() ?? []) {
      imports.push({
        importer: path,
        imported: addition.modulePath,
        locations: addition.spellings,
      });
    }
  };
  if (judging !== null) {
    for (const spec of specs) {
      const path = spec.document.path;
      const plan = importPlans.get(path);
      const removed = new Set(
        plan === undefined
          ? []
          : removedImportsOf(spec, plan, encoder.encode(spec.document.text)),
      );
      for (const declared of spec.imports.imports) {
        if (
          declared.targetPath === null ||
          removed.has(declared) ||
          deletedWithMoved(spec, declared)
        ) {
          continue;
        }
        imports.push({
          importer: path,
          imported: declared.targetPath,
          locations: [
            { file: spec.document.file, range: declared.statement.range },
          ],
        });
      }
      pushAdditions(path);
    }
    if (createsTargetFile) {
      pushAdditions(targetPath);
    }
  }

  return {
    // Judging, no plan exists: the operation is refused wherever the
    // verdict, or any other reason, finds cause — its target path perhaps
    // no spec source path, which no journal entry records (SPEC 6.1, 7.1).
    plan:
      judging !== null
        ? null
        : {
            mapping,
            // SPEC 6.1/6.5: the appended entry records the operation and
            // the full mapping it produced.
            entry: createJournalEntry(
              "move-section",
              `${originPath}#${oldId}`,
              `${targetPath}#${newId}`,
              mapping,
            ),
            rewrites,
            createsTargetFile,
            previewFiles: preview.files(),
          },
    verdict: { illFormed, inadmissible },
    imports,
  };
}
