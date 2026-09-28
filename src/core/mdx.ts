// MDX parse and per-file document model (SPEC 1.1–1.4, 1.6, 1.7, 2.5–2.7).
//
// IMPLEMENTATION (Key libraries): spec sources are parsed with remark-mdx on
// the unified/remark toolchain — its grammar defines well-formed MDX
// (SPEC 14.20) and it yields exact source offsets for every construct, which
// the byte-exact text and removal rules (SPEC 1.6, 3) require. This module
// turns one discovered spec source's bytes into the per-file document model:
// the implicit root (1.2), the section tree with structural-path IDs
// (1.1, 1.3, 1.4), byte-offset source ranges (1.7), validated props
// (2.5–2.7), and the recorded spans later stages consume — `d` expressions
// and `{text(...)}` embeddings for the reference analyzer, ESM blocks and
// MDX comments for Markdown compilation. It is pure and deterministic
// (IMPLEMENTATION Architecture): bytes in, model plus findings out.
//
// Masking (SPEC 14): a file that fails to parse — not well-formed MDX under
// remark-mdx's grammar, not valid UTF-8, or BOM-carrying (1.6) — reports
// exactly one condition, 14.20 with the failure's location, and the
// conditions inside it go unreported. Within a parsed file, every detectable
// condition is reported, with 14.2's own masking rule (14.2) applied.
//
// Braces and ESM blocks (SPEC 14.20): their content derives by ECMAScript
// 2024 with JSX alone, "decided by derivability alone" — the acorn remark-mdx
// is handed (`mdxAcorn`, ./mdx-acorn.ts) excludes every early error, so a
// file failing only such a rule is well-formed and reaches its ordinary
// outcome (`export { nope }` 14.16, `{1 = 2}` 14.16, `d={010}` 14.8), while
// TypeScript-only syntax (`BASE.a!`, `BASE.a as X`) is a derivation failure
// (SPEC 2.4). The static-reference analyzer reads each brace's content as MDX
// 3 derives it (`derivedContent` below), never the raw document slice.
// Whitespace and comments alone are judged as SPEC 14.20 judges them: where
// remark-mdx refuses an attribute's content as empty before calling acorn,
// though it holds a token the comment deletions hide, the refusal is undone
// by respelling the content's leading comments (`parseAsJudged`,
// ./mdx-syntax-failure.ts) and the collected content restored.
//
// Section tags are not widened: they pair exactly as stock MDX 3 pairs them
// (SPEC 14.20; 6.5 "Validation and refusals" spells the consequences out).
// remark-mdx's stock handlers build `mdxJsxFlowElement` and
// `mdxJsxTextElement` nodes, and an element opened inside a construct must
// close inside that same construct: a text-position tag closes within its
// paragraph ("Expected a closing tag for `<S>` … before the end of
// `paragraph`"), and a flow-position opening tag closes at a flow-position
// closing tag beside it, never inside a paragraph line or any other
// construct opened after it — otherwise the file is unparseable (14.20). The one addition beside those
// handlers records each tag token's exact span (`tagSpanExtension` below),
// which the stock nodes do not carry (SPEC 1.7: a section's opening and
// closing tags are its own characters); it changes no verdict.
//
// ESM blocks are not widened: remark-mdx's stock `mdxjsEsm` construct bounds
// them exactly as MDX 3 does (SPEC 14.20; 6.5 "Import edits" spells the
// bounds out). A block begins with `import` or `export` at a line's start,
// interrupts no paragraph (the line after a paragraph line is paragraph
// text), and runs to the next blank line or the file's end — so a line
// directly following a block's line joins the block — and the whole block
// must derive as one ECMAScript module holding import and export
// declarations only, else the file is unparseable (14.20). A block may
// therefore hold several declarations and JavaScript comments beside them;
// the comments are the block's, never MDX comments (SPEC 2.7, 3).

import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { ByteRange } from "./bytes.js";
import { sortByBytes, Utf8Offsets } from "./bytes.js";
import type { ConditionNumber, Finding } from "./findings.js";
import { compareFindings, locatedFinding } from "./findings.js";
import type { PathText } from "./path-text.js";
import { isEmptyExpression, MDX_ACORN_OPTIONS, mdxAcorn } from "./mdx-acorn.js";
import { mdxSyntaxFailureOffset, parseAsJudged } from "./mdx-syntax-failure.js";
import { decodeSourceBytes } from "./source-text.js";
import {
  describeSegmentViolation,
  idSegmentViolations,
  isWhitespaceCodePoint,
  segmentViolation,
} from "./text.js";

// ---------------------------------------------------------------------------
// The document model
// ---------------------------------------------------------------------------

/**
 * One string-valued prop occurrence in quoted attribute form (SPEC 2.7),
 * recorded with the spans a later in-place rewrite needs (SPEC 6.4: minimal
 * edits preserving quote style).
 */
export interface SpecAttributeValue {
  /**
   * The attribute's value: the characters between its quotes exactly as
   * spelled in the source (SPEC 2.4) — no character reference or escape
   * sequence is interpreted, so `id="a&#46;b"` declares the segment
   * `a&#46;b`, never `a.b`. The parser's decoded value is never read.
   */
  readonly value: string;
  /** Byte range of the value's characters, between (excluding) the quotes. */
  readonly valueRange: ByteRange;
  /** The quote character the author used (SPEC 2.7: single or double alike). */
  readonly quote: '"' | "'";
  /** Byte range of the whole attribute, name through closing quote. */
  readonly attributeRange: ByteRange;
}

/**
 * A `d` prop in the braced-expression form of SPEC 2.7, recorded as spans:
 * the expression's content is analyzed by the shared static-reference
 * analyzer (SPEC 2.2, 2.4; IMPLEMENTATION: one analyzer for MDX expression
 * spans and TypeScript sources), not here.
 */
export interface SpecDependencyAttribute {
  /**
   * The content between (excluding) the braces as MDX 3 derives it
   * (SPEC 14.20): the source characters, each Markdown container line
   * prefix the expression spans (a block quote's `>`, a list item's
   * indentation) blanked to spaces, so offsets are the document's own.
   */
  readonly expressionText: string;
  /** Byte range of `expressionText` within the file. */
  readonly expressionRange: ByteRange;
  /** Byte range of the whole attribute, name through closing brace. */
  readonly attributeRange: ByteRange;
}

/**
 * One raw attribute spelling as parsed (SPEC 11.4): every attribute the
 * tag spells appears — repeated, unknown, and spread attributes included,
 * their invalidity a located finding, never an omission. `name` is the
 * attribute's name as spelled, structurally absent (null) for a spread
 * attribute; `range` the attribute's own characters (SPEC 1.7) — for a
 * named attribute its name through the last character of its value, or the
 * bare name where it spells no value; for a spread attribute its entire
 * braced construct — and `text` those exact source characters.
 */
export interface SpecRawAttribute {
  readonly name: string | null;
  readonly range: ByteRange;
  readonly text: string;
}

/**
 * One requirement section (SPEC 1.1) or the file's implicit root (SPEC 1.2,
 * distinguished by `parent === null`). Sections form the containment tree;
 * all ranges are byte offsets into the file's bytes (SPEC 1.7).
 */
export interface SpecSection {
  /**
   * The declared ID (SPEC 1.3), as spelled between the `id` attribute's
   * quotes (SPEC 2.4: no character reference interpreted) — or null for the
   * implicit root and for a section whose ID is unusable: missing (14.1) or
   * declared in an invalid form (14.17, repeated or not a quoted string). A
   * null ID on a non-root section always has a finding accounting for it.
   */
  readonly id: string | null;
  /**
   * SPEC 1.7: for a non-root section, the construct's own characters — the
   * first character of its opening tag through the last character of its
   * closing tag, or the self-closing tag's own characters; for the root,
   * the entire file.
   */
  readonly range: ByteRange;
  /**
   * The opening tag's characters, `<` through `>` (for a self-closing
   * section, the whole tag). Zero-width at offset 0 for the root, which has
   * no tag (SPEC 1.2).
   */
  readonly openingTagRange: ByteRange;
  /**
   * The closing tag's characters, `</` through `>` (for a self-closing
   * section, the whole tag — identical to `openingTagRange`). Zero-width at
   * the file's end for the root.
   */
  readonly closingTagRange: ByteRange;
  /** SPEC 1.1: a self-closing section element is an empty leaf. */
  readonly selfClosing: boolean;
  /** The innermost enclosing section — null exactly for the root. */
  readonly parent: SpecSection | null;
  /** Child sections in document order. */
  readonly children: readonly SpecSection[];
  /**
   * The effective coverage attribute (SPEC 2.5): `"required"` (the default;
   * an explicit `coverage="required"` is the same value) or `"none"` — null
   * for the root, which carries no coverage attribute (SPEC 1.2, 8.1).
   */
  readonly coverage: "required" | "none" | null;
  /**
   * The node's tags (SPEC 2.6): the whitespace-split tokens of the `tags`
   * value as a tag set (SPEC 12.7) — byte order (SPEC 12.0), duplicates
   * collapsed — on every surface that reports them and in graph data;
   * empty when the prop is absent or yields no tags.
   */
  readonly tags: readonly string[];
  /** The `id` attribute's recorded value/spans, when usably declared. */
  readonly idAttribute: SpecAttributeValue | null;
  /** The `d` attribute's recorded expression span, when validly braced. */
  readonly dependency: SpecDependencyAttribute | null;
  /**
   * The raw attribute spellings as parsed, one entry per attribute the tag
   * spells, in tag order (SPEC 11.4). Empty for the root, which has no tag.
   */
  readonly attributes: readonly SpecRawAttribute[];
  /**
   * SPEC 11.2: whether the interpreted `tags` value is defined — an absent
   * prop defines the default (no tags), while a repeated, malformed
   * (braced or valueless), or invalid-valued (SPEC 1.4 → 14.4) `tags` prop
   * leaves the interpreted value undefined, its raw spelling still listed
   * in `attributes`. `tags` holds the interpreted value only where this is
   * true. The root's `tags` is structurally absent, not undefined
   * (SPEC 11.4): true there.
   */
  readonly tagsDefined: boolean;
  /**
   * SPEC 11.2: whether the interpreted coverage value is defined — the
   * `tags` rule's coverage counterpart (absent → the default "required";
   * repeated, braced, valueless, or a value other than "required"/"none" →
   * undefined). `coverage` holds the interpreted value only where this is
   * true; structurally absent (null) for the root, which is not undefined.
   */
  readonly coverageDefined: boolean;
}

/** One `{text(...)}` embedding occurrence (SPEC 2.3). */
export interface SpecEmbedding {
  /** The innermost section containing the embedding (the root included). */
  readonly section: SpecSection;
  /** The whole expression container, braces included. */
  readonly range: ByteRange;
  /**
   * The content between (excluding) the braces as MDX 3 derives it
   * (SPEC 14.20): the source characters, each Markdown container line
   * prefix the expression spans (a block quote's `>`, a list item's
   * indentation) blanked to spaces, so offsets are the document's own.
   */
  readonly expressionText: string;
  /** Byte range of `expressionText` within the file. */
  readonly expressionRange: ByteRange;
}

/**
 * One MDX comment — the empty expression: an expression container whose
 * content is whitespace and comments alone (SPEC 2.7, 14.20).
 */
export interface SpecComment {
  /** The innermost section containing the comment (the root included). */
  readonly section: SpecSection;
  /** The whole expression container, braces included. */
  readonly range: ByteRange;
}

/** One import declaration inside an ESM block, recorded for SPEC 2.1/2.2. */
export interface SpecImportStatement {
  /** The declaration's own characters. */
  readonly range: ByteRange;
  /** Exact source characters of the declaration. */
  readonly text: string;
}

/**
 * One top-level ESM block as MDX 3 bounds it (SPEC 14.20): from a line
 * start through the last line before the next blank line or the file's
 * end, one ECMAScript module holding one or more import and export
 * declarations and any JavaScript comments beside them. `imports` lists
 * its import declarations in document order; an export statement is
 * invalid and reported (SPEC 2.7 → 14.16). Markdown compilation removes
 * each import declaration's own characters alone — the block's comments
 * and whitespace stay as content (SPEC 3).
 */
export interface SpecEsmBlock {
  readonly range: ByteRange;
  readonly imports: readonly SpecImportStatement[];
}

/** The parsed per-file document model. */
export interface SpecDocument {
  /**
   * Workspace-relative `/`-separated path (SPEC 1.5) — the identity-space
   * name. For a discovered file whose own path is invalid (SPEC 14.19,
   * 11.2) this is a deterministic stand-in (the lossily decoded spelling
   * of the path bytes): no identity is ever formed over it, nothing
   * resolves against it, and it is never rendered — `file` carries the
   * real path. For every valid discovered source, `path` equals `file`.
   */
  readonly path: string;
  /**
   * The file's real path as data (SPEC 12.0, 12.7): equal to `path`
   * except for a file whose path is invalid (SPEC 14.19), where it holds
   * the exact path — the marked byte form for a non-UTF-8 path. Every
   * finding location and output-facing path of this file renders from it.
   */
  readonly file: PathText;
  /** The decoded UTF-8 content (SPEC 1.6). */
  readonly text: string;
  /** UTF-16 index ↔ UTF-8 byte offset conversion for `text` (SPEC 1.7). */
  readonly offsets: Utf8Offsets;
  /** The implicit root (SPEC 1.2), preceding every section of the file. */
  readonly root: SpecSection;
  /** Every non-root section in document order. */
  readonly sections: readonly SpecSection[];
  /** Top-level ESM blocks in document order. */
  readonly esmBlocks: readonly SpecEsmBlock[];
  /** Every `{text(...)}` embedding in document order. */
  readonly embeddings: readonly SpecEmbedding[];
  /** Every MDX comment in document order. */
  readonly comments: readonly SpecComment[];
  /**
   * The file's structural and prop findings (SPEC 1.3, 1.4, 2.5–2.7 →
   * conditions 14.1–14.4, 14.16, 14.17), ordered by location. Reference
   * resolution and import validation report elsewhere (SPEC 14.5–14.8,
   * 14.15).
   */
  readonly findings: readonly Finding[];
}

/** The outcome of parsing one discovered spec source (SPEC 14.20 masking). */
export type SpecSourceResult =
  | { readonly kind: "document"; readonly document: SpecDocument }
  | { readonly kind: "unparseable"; readonly finding: Finding };

// ---------------------------------------------------------------------------
// remark-mdx boundary (structural types; shapes verified against remark-mdx)
// ---------------------------------------------------------------------------

interface MdxPoint {
  readonly line?: number;
  readonly column?: number;
  readonly offset?: number;
}

interface MdxPosition {
  readonly start: MdxPoint;
  readonly end: MdxPoint;
}

interface EstreeNode {
  readonly type: string;
  /** Document-absolute UTF-16 offsets (acorn, position-patched by MDX). */
  readonly start?: number;
  readonly end?: number;
  readonly expression?: EstreeNode;
  readonly callee?: EstreeNode;
  readonly name?: string;
  /** A `CallExpression`'s optional-call flag (`text?.(…)`). */
  readonly optional?: boolean;
}

/** A JavaScript comment acorn records beside an expression's nodes. */
interface EstreeComment {
  /** "Block" or "Line". */
  readonly type: string;
  /** Document-absolute UTF-16 offsets, as for `EstreeNode`. */
  readonly start?: number;
  readonly end?: number;
}

interface EstreeProgram {
  readonly body?: readonly EstreeNode[];
  readonly comments?: readonly EstreeComment[];
}

interface MdxAttributeNode {
  /** "mdxJsxAttribute" | "mdxJsxExpressionAttribute" (a spread). */
  readonly type: string;
  readonly name?: string;
  /** A string for quoted form, an object for braced form, null valueless. */
  readonly value?: string | object | null;
  readonly position?: MdxPosition;
}

interface MdxTreeNode {
  readonly type: string;
  readonly position?: MdxPosition;
  readonly children?: readonly MdxTreeNode[];
  /**
   * An expression container's content as remark-mdx collected it: the
   * characters between its braces, less the Markdown container line
   * prefixes (`derivedContent`).
   */
  readonly value?: string;
  /** JSX element name; null for a fragment. */
  readonly name?: string | null;
  readonly attributes?: readonly MdxAttributeNode[];
  readonly data?: {
    readonly estree?: EstreeProgram;
    /** The root only: every JSX tag token's span (`tagSpanExtension`). */
    readonly xspecTagSpans?: TagSpans;
  };
}

/**
 * The exact span of every JSX tag token in one parsed file — `<` through
 * `>`, in UTF-16 indices — recorded by `tagSpanExtension` below. Tag
 * tokens never overlap, so a tag is identified by its start as by its end.
 * An element node spans its opening tag's start through its closing tag's
 * end (a self-closing element: its one tag), so these maps give each
 * element's tags (SPEC 1.7).
 */
interface TagSpans {
  /** A tag's end, by its start. */
  readonly endByStart: Map<number, number>;
  /** A tag's start, by its end. */
  readonly startByEnd: Map<number, number>;
}

/** The thrown parse failure's observed shape (a unified VFileMessage). */
interface ParseFailureLike {
  /** The grammar component that raised it (absent on any other throw). */
  readonly source?: unknown;
  readonly reason?: unknown;
  readonly message?: unknown;
  readonly place?: unknown;
}

// ---------------------------------------------------------------------------
// Tag spans beside the stock JSX handlers (SPEC 1.7; no verdict changes)
// ---------------------------------------------------------------------------

/**
 * Structural view of mdast-util-from-markdown's compile context (verified
 * against mdast-util-from-markdown 2): the members the tag-span handler
 * uses. `data.mdxJsxTag` is the tag state the stock mdast-util-mdx-jsx
 * handlers keep while a tag token is open — its `start` and `end` are the
 * whole tag token's points — and `stack[0]` is the tree's root.
 */
interface FromMarkdownContextLike {
  readonly data: {
    mdxJsxTag?: {
      readonly start?: MdxPoint;
      readonly end?: MdxPoint;
    };
  };
  readonly stack: readonly { data?: { xspecTagSpans?: TagSpans } }[];
}

/**
 * Record the current tag token's span on the root (`TagSpans`). Registered
 * for the tag's `<` and `>` marker tokens, which no stock handler reads, so
 * every stock handler — tag names, attributes, and the element pairing
 * that decides well-formedness (SPEC 14.20) — stays in place; the second
 * call per tag records the same span again.
 */
function recordTagSpan(this: FromMarkdownContextLike): void {
  const start = this.data.mdxJsxTag?.start?.offset;
  const end = this.data.mdxJsxTag?.end?.offset;
  const root = this.stack[0];
  if (typeof start !== "number" || typeof end !== "number" || !root) {
    throw new Error("xspec internal error: JSX tag marker without tag state");
  }
  const data = (root.data ??= {});
  const spans = (data.xspecTagSpans ??= {
    endByStart: new Map<number, number>(),
    startByEnd: new Map<number, number>(),
  });
  spans.endByStart.set(start, end);
  spans.startByEnd.set(end, start);
}

/**
 * The fromMarkdown addition: handlers for token types the stock
 * extensions leave unhandled (mdast-util-from-markdown merges handler
 * maps by assignment per token type, so no stock handler is replaced).
 */
const tagSpanExtension = {
  exit: {
    mdxJsxFlowTagMarker: recordTagSpan,
    mdxJsxTextTagMarker: recordTagSpan,
  },
};

/**
 * Register the tag-span recorder. No micromark construct is added and no
 * stock handler replaced: every construct is tokenized, and every JSX
 * element paired, by remark-mdx's stock grammar (SPEC 14.20).
 */
function xspecTagSpans(this: { data(): unknown }): void {
  const data = this.data() as {
    fromMarkdownExtensions?: unknown[];
  };
  (data.fromMarkdownExtensions ??= []).push(tagSpanExtension);
}

/**
 * The MDX parser (IMPLEMENTATION: remark-mdx defines well-formed MDX,
 * SPEC 14.20): MDX 3's grammar, its braces and ESM blocks derived by
 * ECMAScript 2024 alone, early errors excluded (`mdxAcorn`). Frozen once;
 * `parse` is pure.
 */
const mdxParser = unified()
  .use(remarkParse)
  .use(remarkMdx, { acorn: mdxAcorn, acornOptions: MDX_ACORN_OPTIONS })
  .use(xspecTagSpans)
  .freeze();

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** A spec source's parse: its decoded text and MDX tree, or its 14.20. */
type MdxParse =
  | {
      readonly kind: "tree";
      readonly text: string;
      readonly offsets: Utf8Offsets;
      readonly tree: MdxTreeNode;
    }
  | { readonly kind: "unparseable"; readonly finding: Finding };

/**
 * Decode and parse one spec source (SPEC 1.6, 14.20): valid UTF-8 with no
 * byte-order mark, then MDX 3's grammar — the whole verdict on
 * well-formedness, which the document builder never revises.
 */
function parseMdx(file: PathText, bytes: Uint8Array): MdxParse {
  const decoded = decodeSourceBytes(file, bytes);
  if (!decoded.ok) {
    return { kind: "unparseable", finding: decoded.finding };
  }
  const text = decoded.text;
  const offsets = new Utf8Offsets(text);
  try {
    // SPEC 14.20: remark-mdx's grammar defines well-formed MDX, its refusal
    // of an attribute's content as empty undone where that content holds
    // a token (`parseAsJudged`).
    const { result, originals } = parseAsJudged(
      text,
      (spelled) => mdxParser.parse(spelled) as unknown as MdxTreeNode,
    );
    if (originals.size > 0) restoreRespelledContent(result, text, originals);
    return { kind: "tree", text, offsets, tree: result };
  } catch (error) {
    return {
      kind: "unparseable",
      finding: parseFailureFinding(file, error, text, offsets),
    };
  }
}

/**
 * Parse one discovered spec source into its document model (SPEC 1, 2).
 * `path` is the workspace-relative `/`-separated path (SPEC 1.5); `bytes`
 * the file's exact content. An unparseable file — BOM, invalid UTF-8
 * (SPEC 1.6), or not well-formed MDX — yields the single 14.20 finding that
 * masks the conditions inside it (SPEC 14).
 */
export function parseSpecSource(
  path: string,
  bytes: Uint8Array,
  file: PathText = path,
): SpecSourceResult {
  const parsed = parseMdx(file, bytes);
  if (parsed.kind === "unparseable") {
    return parsed;
  }
  const builder = new DocumentBuilder(path, file, parsed.text, parsed.offsets);
  builder.walk(parsed.tree);
  builder.validateStructure();
  return { kind: "document", document: builder.finish() };
}

/**
 * SPEC 14.20: the 14.20 finding a spec source's bytes carry — null exactly
 * when the file is well-formed. The verdict is `parseSpecSource`'s, reached
 * without building the document model: a pure judgement over a file's
 * bytes, for texts no discovered file holds yet — a move's would-be files
 * (SPEC 6.5 "Validation and refusals", `refused-invalid-rewrite`).
 */
export function specSourceParseFailure(
  file: PathText,
  bytes: Uint8Array,
): Finding | null {
  const parsed = parseMdx(file, bytes);
  return parsed.kind === "unparseable" ? parsed.finding : null;
}

/** The 14.20 finding for a thrown MDX parse failure, with its location. */
function parseFailureFinding(
  file: PathText,
  error: unknown,
  text: string,
  offsets: Utf8Offsets,
): Finding {
  const failure = (
    typeof error === "object" && error !== null ? error : {}
  ) as ParseFailureLike;
  const reason =
    typeof failure.reason === "string"
      ? failure.reason
      : typeof failure.message === "string"
        ? failure.message
        : String(error);

  // SPEC 14: one zero-length range at the failure's offset — the byte
  // length of the longest prefix with which some well-formed file begins
  // (mdx-syntax-failure.ts). A throw that is not the grammar's own failure
  // (a VFileMessage, carrying its source) — nesting too deep to parse —
  // locates at the file start.
  let at = 0;
  if (typeof failure.source === "string") {
    const place = failure.place as
      (MdxPoint & Partial<MdxPosition>) | null | undefined;
    const placed = place == null ? undefined : (place.start ?? place).offset;
    const fallback =
      typeof placed === "number"
        ? Math.max(0, Math.min(text.length, placed))
        : 0;
    at = mdxSyntaxFailureOffset(text, fallback);
  }
  const byte = offsets.byteOffset(at);
  const { line, column } = lineAndColumn(text, at);
  return locatedFinding(
    20,
    `unparseable source: not well-formed MDX at line ${String(line)}, ` +
      `column ${String(column)} — ${reason}. Correct the syntax at the ` +
      `reported location (SPEC 14.20)`,
    [{ file, range: { start: byte, end: byte } }],
  );
}

/**
 * The 1-based line and column (in code points) of a UTF-16 index, lines
 * ended by CR, LF, or CRLF — for a finding's message text.
 */
function lineAndColumn(
  text: string,
  index: number,
): { readonly line: number; readonly column: number } {
  let line = 1;
  let lineStart = 0;
  for (let at = 0; at < index; at += 1) {
    const code = text.charCodeAt(at);
    if (code === 0x0a || (code === 0x0d && text.charCodeAt(at + 1) !== 0x0a)) {
      line += 1;
      lineStart = at + 1;
    }
  }
  let column = 1;
  for (let at = lineStart; at < index; at += 1) {
    const code = text.charCodeAt(at);
    if (code < 0xdc00 || code > 0xdfff) column += 1;
  }
  return { line, column };
}

/**
 * SPEC 14.20, 2.3, 2.4: the content between an expression's braces as MDX 3
 * derives it, at the document's own offsets. `raw` is the document text
 * between the braces; `collected` the content remark-mdx gathered for the
 * expression (the node's `value`): the same characters less each
 * continuation line's Markdown container prefix — a block quote's `>`, a
 * list item's indentation — which the expression does not hold (a tab the
 * prefix splits leaves its remaining columns as spaces, and micromark reads
 * U+0000 as U+FFFD). On each line after the first, what precedes the
 * longest ending it shares with the collected line is that prefix, and is
 * blanked to spaces: prefixes are ASCII, so UTF-16 indices and byte offsets
 * stay put for every span the analyzer reports — `> {text("a")` over `> }`
 * is the call `text("a")`, never `text("a") >`.
 */
function derivedContent(raw: string, collected: unknown): string {
  if (typeof collected !== "string" || collected === raw) {
    return raw;
  }
  // Markdown line endings (CommonMark): the parts alternate line, ending.
  const rawParts = raw.split(/(\r\n|\r|\n)/u);
  const collectedParts = collected.split(/(\r\n|\r|\n)/u);
  if (rawParts.length !== collectedParts.length) {
    return raw;
  }
  for (let index = 2; index < rawParts.length; index += 2) {
    const line = rawParts[index];
    const prefix = line.length - sharedEnding(line, collectedParts[index]);
    if (prefix > 0 && /^[\t >]+$/u.test(line.slice(0, prefix))) {
      rawParts[index] = " ".repeat(prefix) + line.slice(prefix);
    }
  }
  return rawParts.join("");
}

/** The length of the longest ending `line` and `collected` share. */
function sharedEnding(line: string, collected: string): number {
  let count = 0;
  while (count < line.length && count < collected.length) {
    const spelled = line.charCodeAt(line.length - 1 - count);
    const read = collected.charCodeAt(collected.length - 1 - count);
    if (spelled !== read && !(spelled === 0 && read === 0xfffd)) {
      break;
    }
    count += 1;
  }
  return count;
}

/**
 * SPEC 14.20: on each attribute a respelling touched (`parseAsJudged`: the
 * leading comments of an attribute's content, blanked where the stock
 * grammar refused that content as empty although it holds a token), the
 * content remark-mdx collected — its `value`, which `derivedContent` reads
 * — as collected from `text`, the original. The respelled content's estree
 * (which nothing here reads) keeps the respelled spelling: those comments
 * are whitespace there.
 */
function restoreRespelledContent(
  node: MdxTreeNode,
  text: string,
  originals: ReadonlyMap<number, string>,
): void {
  for (const attribute of node.attributes ?? []) {
    const start = attribute.position?.start.offset;
    const end = attribute.position?.end.offset;
    if (typeof start !== "number" || typeof end !== "number") continue;
    if (![...originals.keys()].some((at) => at >= start && at < end)) {
      continue;
    }
    // The content's last line ends at the closing brace, `end - 1`.
    const holder = (
      attribute.type === "mdxJsxExpressionAttribute"
        ? attribute
        : attribute.value
    ) as { value?: unknown } | null | undefined;
    if (typeof holder === "object" && typeof holder?.value === "string") {
      holder.value = restoredContent(holder.value, text, end - 1, originals);
    }
  }
  for (const child of node.children ?? []) {
    restoreRespelledContent(child, text, originals);
  }
}

/**
 * `collected` — content remark-mdx collected from a respelled text, its last
 * line ending at `end` — with each respelled character restored from
 * `originals` (micromark reads U+0000 as U+FFFD). Each content line is a
 * suffix of its file line (the Markdown container prefix and indentation
 * not collected), so characters correspond from the end, a content line
 * ending passing the file line's uncollected prefix to its own ending.
 */
function restoredContent(
  collected: string,
  text: string,
  end: number,
  originals: ReadonlyMap<number, string>,
): string {
  const units = collected.split("");
  let at = end;
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const code = collected.charCodeAt(index);
    if (code === 0x0a || code === 0x0d) {
      while (at > 0 && text.charCodeAt(at - 1) !== code) at -= 1;
    }
    at -= 1;
    const original = originals.get(at);
    if (original !== undefined) {
      units[index] = original === "\0" ? "\ufffd" : original;
    }
  }
  return units.join("");
}

/** An estree node's or comment's document-absolute UTF-16 offsets. */
function positionsOf(node: {
  readonly start?: number;
  readonly end?: number;
}): {
  readonly start: number;
  readonly end: number;
} {
  const { start, end } = node;
  if (typeof start !== "number" || typeof end !== "number") {
    throw new Error("xspec internal error: estree node without a position");
  }
  return { start, end };
}

/**
 * Whether an expression is a call — optional or not — whose callee acorn
 * reads as the identifier `text`, parenthesized or escape-spelled alike:
 * the near misses of an embedding (SPEC 2.3), whose 14.16 finding names
 * the plain spelling.
 */
function callsCookedText(expression: EstreeNode): boolean {
  const call =
    expression.type === "ChainExpression" ? expression.expression : expression;
  return (
    call !== undefined &&
    call.type === "CallExpression" &&
    call.callee !== undefined &&
    call.callee.type === "Identifier" &&
    call.callee.name === "text"
  );
}

// ---------------------------------------------------------------------------
// Segment and tag validity (SPEC 1.4)
// ---------------------------------------------------------------------------

/**
 * The SPEC 1.4 problems of one `id` or `tags` value, as phrases for its
 * attribute's one 14.4 finding (SPEC 14.4: one finding per `id` or `tags`
 * attribute whose value violates 1.4, however many of its segments or tags
 * do), judged by the shared validator (text.ts). `values` are the value's
 * segments (split on `"."`, SPEC 1.3) or tags (split per 2.6), taken from
 * the characters between the attribute's quotes exactly as spelled
 * (SPEC 2.4) — so an authored U+0000 is judged as the control character it
 * is, and a character reference as the `&` it contains.
 */
function attributeProblems(
  kind: "segment" | "tag",
  values: readonly string[],
): string[] {
  const problems: string[] = [];
  for (const value of values) {
    const violation = segmentViolation(value, kind);
    if (violation !== null) {
      problems.push(
        `the ${kind} ${JSON.stringify(value)} ` +
          describeSegmentViolation(violation),
      );
    }
  }
  return problems;
}

/**
 * SPEC 11.2: the sections of a parsed document whose node identities are
 * defined, over a valid file path (an invalid-path file defines no identity
 * whatever this returns — the caller's concern, SPEC 14.19). A section's
 * node identity is defined exactly when it and each enclosing section spell
 * an identity, each spelled identity in the chain is well-formed (SPEC 1.4)
 * and satisfies the structural rules (SPEC 1.3), and no other section of
 * the file spells the same identity as it does. The chain conditions are
 * inherited — a descendant of a section that spells no identity, or whose
 * spelled identity is malformed or structurally invalid, has no defined
 * identity — but uniqueness is not: it constrains the section's own spelled
 * identity alone, so duplicate spellings leave every bearer undefined (no
 * winner picked) while a uniquely spelled descendant of duplicate-`id`
 * ancestors keeps its defined identity. Parse-local (SPEC 11.2): shared by
 * graph node construction (core/graph.ts) — only defined identities are
 * formed, emitted, or resolved against (SPEC 1.5) — and the availability
 * surfaces (SPEC 11.3–11.5).
 */
export function definedIdentitySections(
  document: SpecDocument,
): ReadonlySet<SpecSection> {
  // Uniqueness compares spelled identities only (SPEC 11.2): a section
  // spelling no identity (`id` absent, repeated, or in invalid value form —
  // SpecSection.id null) contests no other section's.
  const spelled = new Map<string, number>();
  for (const section of document.sections) {
    if (section.id !== null) {
      spelled.set(section.id, (spelled.get(section.id) ?? 0) + 1);
    }
  }

  // The chain conditions (own and inherited; uniqueness excluded): spells
  // an identity, well-formed per SPEC 1.4, structurally valid per SPEC 1.3
  // against the parent's spelled identity — a top-level section against the
  // empty prefix (exactly one segment).
  const wellFormed = (id: string): boolean =>
    idSegmentViolations(id).length === 0;
  const chain = new Map<SpecSection, boolean>();
  const chainOk = (section: SpecSection): boolean => {
    if (section.parent === null) return true; // the root spells no identity
    const memo = chain.get(section);
    if (memo !== undefined) return memo;
    let ok = false;
    if (section.id !== null && wellFormed(section.id)) {
      const segments = section.id.split(".");
      const parent = section.parent;
      if (parent.parent === null) {
        // SPEC 1.3: a top-level section's ID is exactly one segment.
        ok = segments.length === 1;
      } else if (parent.id !== null) {
        // SPEC 1.3: the parent's spelled ID plus exactly one segment. A
        // parent spelling no identity fails the chain regardless.
        const parentSegments = parent.id.split(".");
        ok =
          segments.length === parentSegments.length + 1 &&
          parentSegments.every((segment, index) => segments[index] === segment);
      }
      ok = ok && chainOk(parent);
    }
    chain.set(section, ok);
    return ok;
  };

  const defined = new Set<SpecSection>();
  for (const section of document.sections) {
    if (section.id === null) continue;
    if (spelled.get(section.id) !== 1) continue;
    if (!chainOk(section)) continue;
    defined.add(section);
  }
  return defined;
}

/**
 * SPEC 2.6: split a `tags` value on runs of SPEC 1.4 whitespace, ignoring
 * leading and trailing whitespace, and collapse duplicates keeping
 * first-occurrence order — the order the value spells them, which the
 * 14.4 finding's problem list follows; the interpreted tags recorded on
 * the section are these tokens as a byte-ordered set (SPEC 12.7). A value
 * yielding no tags is equivalent to an omitted prop.
 */
export function splitTags(value: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  let start = -1;
  for (let index = 0; index <= value.length; index += 1) {
    const isSeparator =
      index === value.length || isWhitespaceCodePoint(value.charCodeAt(index));
    if (isSeparator) {
      if (start !== -1) {
        const token = value.slice(start, index);
        if (!seen.has(token)) {
          seen.add(token);
          tokens.push(token);
        }
        start = -1;
      }
    } else if (start === -1) {
      start = index;
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// The document builder
// ---------------------------------------------------------------------------

/** The mutable section shape used during construction. */
interface MutableSection {
  id: string | null;
  range: ByteRange;
  openingTagRange: ByteRange;
  closingTagRange: ByteRange;
  selfClosing: boolean;
  parent: MutableSection | null;
  children: MutableSection[];
  coverage: "required" | "none" | null;
  tags: readonly string[];
  idAttribute: SpecAttributeValue | null;
  dependency: SpecDependencyAttribute | null;
  attributes: SpecRawAttribute[];
  tagsDefined: boolean;
  coverageDefined: boolean;
  /** Whether an `id` prop occurred at all (14.1 is only for absence). */
  idPresent: boolean;
}

/** One element whose children the walk is visiting. */
interface OpenElementFrame {
  /** The section the element is, or null for a non-section element. */
  readonly section: MutableSection | null;
}

/** The walk's pending work: a node to visit, or an element to leave. */
type WalkItem =
  { readonly visit: MdxTreeNode } | { readonly leave: OpenElementFrame };

class DocumentBuilder {
  readonly root: MutableSection;
  private readonly sections: MutableSection[] = [];
  private readonly esmBlocks: SpecEsmBlock[] = [];
  private readonly embeddings: SpecEmbedding[] = [];
  private readonly comments: SpecComment[] = [];
  private readonly findings: Finding[] = [];
  /** The elements enclosing the node being visited, outermost first. */
  private readonly elementStack: OpenElementFrame[] = [];
  /** The file's tag spans; set by `walk` from the tree's root. */
  private tagSpans: TagSpans | undefined;

  constructor(
    private readonly path: string,
    private readonly file: PathText,
    private readonly text: string,
    private readonly offsets: Utf8Offsets,
  ) {
    // SPEC 1.2: the implicit root represents the entire document and
    // precedes every section; SPEC 1.7: its range is the entire file. Its
    // zero-width tag ranges make tag-removal rules no-ops for it.
    this.root = {
      id: null,
      range: { start: 0, end: offsets.byteLength },
      openingTagRange: { start: 0, end: 0 },
      closingTagRange: { start: offsets.byteLength, end: offsets.byteLength },
      selfClosing: false,
      parent: null,
      children: [],
      coverage: null,
      tags: [],
      idAttribute: null,
      dependency: null,
      attributes: [],
      tagsDefined: true,
      coverageDefined: true,
      idPresent: false,
    };
  }

  /** Byte range of a UTF-16 index span. */
  private byteRange(start: number, end: number): ByteRange {
    return {
      start: this.offsets.byteOffset(start),
      end: this.offsets.byteOffset(end),
    };
  }

  private addFinding(
    condition: ConditionNumber,
    range: ByteRange,
    message: string,
  ): void {
    this.findings.push(
      locatedFinding(condition, message, [{ file: this.file, range }]),
    );
  }

  /** The node's UTF-16 span; every parsed mdast node carries one. */
  private spanOf(node: { readonly position?: MdxPosition }): {
    start: number;
    end: number;
  } {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (typeof start !== "number" || typeof end !== "number") {
      throw new Error("xspec internal error: MDX node without a position");
    }
    return { start, end };
  }

  /**
   * Walk the mdast tree in document order: requirement sections nest by
   * document containment, whatever Markdown structure lies between (SPEC
   * 1.1–1.3). Every JSX element arrives as the stock grammar paired it
   * (SPEC 14.20) — an `mdxJsxFlowElement` or `mdxJsxTextElement` spanning
   * its opening tag through its closing tag, its content as its children —
   * so the section tree follows the element tree. The walk keeps its own
   * stack of pending work instead of recursing: sections nest as deep as a
   * file stacks them (the suite stages towers 4096 deep), and each level
   * must cost heap, never call stack.
   */
  walk(tree: MdxTreeNode): void {
    this.tagSpans = tree.data?.xspecTagSpans;
    const pending: WalkItem[] = [{ visit: tree }];
    for (let item = pending.pop(); item !== undefined; item = pending.pop()) {
      if ("leave" in item) {
        if (this.elementStack.pop() !== item.leave) {
          throw new Error("xspec internal error: unbalanced element walk");
        }
        continue;
      }
      const node = item.visit;
      switch (node.type) {
        case "mdxJsxFlowElement":
        case "mdxJsxTextElement": {
          const frame = this.enterElement(node);
          this.elementStack.push(frame);
          pending.push({ leave: frame });
          break;
        }
        case "mdxFlowExpression":
        case "mdxTextExpression": {
          this.classifyExpression(node, this.currentSection());
          continue;
        }
        case "mdxjsEsm": {
          this.processEsm(node);
          continue;
        }
        default: {
          break;
        }
      }
      const children = node.children ?? [];
      for (let index = children.length - 1; index >= 0; index -= 1) {
        pending.push({ visit: children[index] });
      }
    }
  }

  /** The innermost section whose element encloses the walk (SPEC 1.1). */
  private currentSection(): MutableSection {
    for (let index = this.elementStack.length - 1; index >= 0; index -= 1) {
      const section = this.elementStack[index].section;
      if (section !== null) {
        return section;
      }
    }
    return this.root;
  }

  /**
   * One JSX element as the stock grammar paired it (SPEC 14.20):
   * `<S>`/`<Spec>` builds a section (SPEC 1.1); any other element is
   * invalid (SPEC 2.7 → 14.16), reported once over its whole construct,
   * while the sections inside it nest by containment all the same. The
   * element's tags are the recorded tag tokens at its two ends (SPEC 1.7):
   * a self-closing element is its one tag.
   */
  private enterElement(node: MdxTreeNode): OpenElementFrame {
    const span = this.spanOf(node);
    const openingEnd = this.tagSpans?.endByStart.get(span.start);
    const selfClosing = openingEnd === span.end;
    const closingStart = selfClosing
      ? span.start
      : this.tagSpans?.startByEnd.get(span.end);
    if (openingEnd === undefined || closingStart === undefined) {
      throw new Error("xspec internal error: JSX element without tag spans");
    }
    const name = node.name ?? null;
    if (name === "S" || name === "Spec") {
      // SPEC 1.1: `<S>` and `<Spec>` are equivalent requirement sections
      // (compared byte-wise, SPEC 12.0 — no other casing).
      return {
        section: this.buildSection(node, {
          start: span.start,
          openingEnd,
          closingStart,
          end: span.end,
          selfClosing,
        }),
      };
    }
    this.reportForeignElement(name, span.start, span.end);
    return { section: null };
  }

  /** SPEC 2.7 → 14.16: a JSX element other than `<S>`/`<Spec>`. */
  private reportForeignElement(
    name: string | null,
    startIndex: number,
    endIndex: number,
  ): void {
    const label = name === null ? "a JSX fragment" : `JSX element <${name}>`;
    this.addFinding(
      16,
      this.byteRange(startIndex, endIndex),
      `invalid construct: ${label} — beyond Markdown content, only ` +
        `spec-module imports, <S>/<Spec> sections, {text(...)} ` +
        `embeddings, and MDX comments are permitted; remove it ` +
        `(SPEC 2.7, 14.16)`,
    );
  }

  /**
   * SPEC 2.7: an expression container is a `{text(...)}` embedding (2.3),
   * an MDX comment, or invalid (14.16).
   */
  private classifyExpression(node: MdxTreeNode, section: MutableSection): void {
    const span = this.spanOf(node);
    const range = this.byteRange(span.start, span.end);
    const program = node.data?.estree;
    const body = program?.body ?? [];
    if (
      program !== undefined
        ? body.length === 0
        : isEmptyExpression(node.value ?? "")
    ) {
      // An MDX comment — the empty expression: content of whitespace and
      // comments alone (SPEC 2.7, 14.20), whitespace and line terminators
      // ECMAScript's (U+00A0, U+FEFF, U+2028, U+2029 included), so `{}`,
      // `{ }`, `{/* … */}`, and line comments ended before the closing
      // brace alike. A pure annotation (SPEC 2.7, 3), never 14.16.
      // remark-mdx derives such content as a whole Program (the
      // empty-expression path of micromark-util-events-to-acorn), its body
      // empty exactly when the content lexes to no token; acorn is
      // configured, so an estree is always attached — an absent one is
      // judged from the content itself.
      this.comments.push({ section, range });
      return;
    }
    const statement = body.length === 1 ? body[0] : undefined;
    const expression =
      statement !== undefined && statement.type === "ExpressionStatement"
        ? statement.expression
        : undefined;
    if (
      expression !== undefined &&
      this.isEmbeddingCall(expression, span, program?.comments ?? [])
    ) {
      // A `{text(...)}` embedding (SPEC 2.3). Its argument is analyzed by
      // the static-reference analyzer (SPEC 2.4 → 14.8), not here; `text`
      // is always the compiler-provided name — imports never bind it
      // (SPEC 2.1).
      this.embeddings.push({
        section,
        range,
        expressionText: derivedContent(
          this.text.slice(span.start + 1, span.end - 1),
          node.value,
        ),
        expressionRange: this.byteRange(span.start + 1, span.end - 1),
      });
      return;
    }
    this.addFinding(
      16,
      range,
      expression !== undefined && callsCookedText(expression)
        ? `invalid construct: an expression container calling text that ` +
            `is no {text(...)} embedding — an embedding's one expression ` +
            `is a call of text spelled plainly, beside nothing but ` +
            `whitespace and comments: its callee neither parenthesized nor ` +
            `escaped, the call neither optional nor parenthesized; spell ` +
            `it {text(<reference>)} (SPEC 2.3, 2.4, 14.16)`
        : `invalid construct: an expression container that is neither a ` +
            `{text(...)} embedding nor an MDX comment — remove it or ` +
            `replace it with a permitted construct (SPEC 2.7, 14.16)`,
    );
  }

  /**
   * SPEC 2.3: whether a container's one expression is an embedding's call —
   * a call, optional chaining excluded, whose callee is the identifier
   * `text` itself, spelled plainly, neither parenthesized nor escaped
   * (2.4), whatever whitespace and comments stand beside the call. The
   * estree alone cannot tell: acorn cooks an escape-spelled name to `text`,
   * and micromark's events-to-acorn removes every `ParenthesizedExpression`
   * node, leaving the inner node at its inner offsets. So the callee's own
   * characters must be exactly `text` (2.4: read as spelled), the call must
   * begin at its callee (`(text)("a")` begins at its `(`), and no
   * parenthesis may stand beside the call outside a comment (`(text("a"))`)
   * — the grammar lets nothing else stand there but whitespace, comments,
   * and a Markdown container's line prefixes (`>`), which the expression
   * does not hold.
   */
  private isEmbeddingCall(
    expression: EstreeNode,
    span: { readonly start: number; readonly end: number },
    comments: readonly EstreeComment[],
  ): boolean {
    const callee = expression.callee;
    if (
      expression.type !== "CallExpression" ||
      expression.optional === true ||
      callee === undefined ||
      callee.type !== "Identifier"
    ) {
      return false;
    }
    const call = positionsOf(expression);
    const name = positionsOf(callee);
    return (
      this.text.slice(name.start, name.end) === "text" &&
      call.start === name.start &&
      !this.parenthesisBeside(span.start + 1, call.start, comments) &&
      !this.parenthesisBeside(call.end, span.end - 1, comments)
    );
  }

  /**
   * Whether a parenthesis stands in the document text [from, to) outside
   * every comment of `comments` (a comment may itself spell one).
   */
  private parenthesisBeside(
    from: number,
    to: number,
    comments: readonly EstreeComment[],
  ): boolean {
    const spanned = comments
      .map((comment) => positionsOf(comment))
      .sort((left, right) => left.start - right.start);
    let index = from;
    for (const comment of spanned) {
      if (comment.start >= to) {
        break;
      }
      if (comment.end <= index) {
        continue;
      }
      if (
        /[()]/u.test(this.text.slice(index, Math.max(index, comment.start)))
      ) {
        return true;
      }
      index = Math.max(index, comment.end);
    }
    return index < to && /[()]/u.test(this.text.slice(index, to));
  }

  /**
   * One top-level ESM block: record each of its import declarations for
   * import validation and reference analysis (SPEC 2.1); any export
   * statement is invalid (SPEC 2.7 → 14.16). The stock construct admits no
   * other statement kind (SPEC 14.20), and its estree carries
   * document-absolute offsets, so each declaration's range is its own
   * characters — a spelled `;` included, the comments beside it excluded.
   */
  private processEsm(node: MdxTreeNode): void {
    const span = this.spanOf(node);
    const imports: SpecImportStatement[] = [];
    for (const statement of node.data?.estree?.body ?? []) {
      const start = statement.start;
      const end = statement.end;
      if (typeof start !== "number" || typeof end !== "number") {
        throw new Error(
          "xspec internal error: ESM statement without a position",
        );
      }
      if (statement.type === "ImportDeclaration") {
        imports.push({
          range: this.byteRange(start, end),
          text: this.text.slice(start, end),
        });
      } else {
        this.addFinding(
          16,
          this.byteRange(start, end),
          `invalid construct: an export statement — xspec source files ` +
            `export nothing; remove it (SPEC 2.7, 14.16)`,
        );
      }
    }
    this.esmBlocks.push({
      range: this.byteRange(span.start, span.end),
      imports,
    });
  }

  // -------------------------------------------------------------------------
  // Sections and props
  // -------------------------------------------------------------------------

  /**
   * Build one `<S>`/`<Spec>` section from its element, with validated props
   * (SPEC 1.1, 2.5–2.7). `tags` gives the element's UTF-16 bounds: its
   * start and end, its opening tag's end, and its closing tag's start — for
   * a self-closing element, whose one tag is the whole construct, the
   * element's start (SPEC 1.7).
   */
  private buildSection(
    node: MdxTreeNode,
    tags: {
      readonly start: number;
      readonly openingEnd: number;
      readonly closingStart: number;
      readonly end: number;
      readonly selfClosing: boolean;
    },
  ): MutableSection {
    // SPEC 1.1: a self-closing section element is an empty leaf; its tag
    // is the whole construct (SPEC 1.7).
    const selfClosing = tags.selfClosing;
    const parent = this.currentSection();
    const section: MutableSection = {
      id: null,
      // SPEC 1.7: opening tag through closing tag, or the self-closing
      // tag's own characters.
      range: this.byteRange(tags.start, tags.end),
      openingTagRange: this.byteRange(tags.start, tags.openingEnd),
      closingTagRange: this.byteRange(tags.closingStart, tags.end),
      selfClosing,
      parent,
      children: [],
      coverage: "required", // SPEC 2.5: the default
      tags: [],
      idAttribute: null,
      dependency: null,
      attributes: [],
      tagsDefined: true,
      coverageDefined: true,
      idPresent: false,
    };
    this.processAttributes(node, section);
    parent.children.push(section);
    this.sections.push(section);
    return section;
  }

  /** Validate and record one section element's props (SPEC 2.5–2.7). */
  private processAttributes(node: MdxTreeNode, section: MutableSection): void {
    /**
     * Each prop name the tag spells → the attribute range of every
     * spelling of it, in tag order, the first included (SPEC 14 location
     * cardinality: a repeated prop locates every attribute spelling the
     * name).
     */
    const spellings = new Map<string, ByteRange[]>();
    let idUnusable = false;
    for (const attribute of node.attributes ?? []) {
      const attrSpan = this.spanOf(attribute);
      const attrRange = this.byteRange(attrSpan.start, attrSpan.end);
      const named = attribute.type === "mdxJsxAttribute";
      // SPEC 11.4: every attribute the tag spells is recorded as a raw
      // entry, in tag order — repeated, unknown, and spread attributes
      // included; a spread attribute's name is structurally absent, its
      // text its entire braced construct.
      section.attributes.push({
        name: named ? (attribute.name ?? "") : null,
        range: attrRange,
        text: this.text.slice(attrSpan.start, attrSpan.end),
      });
      if (!named) {
        // SPEC 2.7 → 14.17: every prop is a named attribute; a spread
        // attribute is invalid.
        this.addFinding(
          17,
          attrRange,
          `invalid prop: a spread attribute on <S>/<Spec> — every prop is ` +
            `a named attribute; spell out id, d, coverage, or tags ` +
            `(SPEC 2.7, 14.17)`,
        );
        continue;
      }
      const name = attribute.name ?? "";
      const earlier = spellings.get(name);
      if (earlier !== undefined) {
        // SPEC 2.7 → 14.17: no prop name may occur more than once on one
        // element — defined or unknown. Reported once per name, locating
        // every spelling, after the loop.
        earlier.push(attrRange);
        if (name === "id") {
          idUnusable = true; // ambiguous declaration — no usable ID
        }
        // SPEC 11.2: a repeated `tags`/`coverage` prop leaves the
        // interpreted value undefined — no occurrence is picked.
        if (name === "tags") {
          section.tagsDefined = false;
        }
        if (name === "coverage") {
          section.coverageDefined = false;
        }
        continue;
      }
      spellings.set(name, [attrRange]);
      if (name === "d") {
        this.processDependencyProp(attribute, attrSpan, section);
      } else if (name === "id" || name === "coverage" || name === "tags") {
        const interpreted = this.processStringProp(
          name,
          attribute,
          attrSpan,
          section,
          () => {
            idUnusable = true;
          },
        );
        // SPEC 11.2: a malformed (braced/valueless) or invalid-valued
        // `tags`/`coverage` prop leaves the interpreted value undefined,
        // its raw spelling still listed.
        if (!interpreted && name === "tags") {
          section.tagsDefined = false;
        }
        if (!interpreted && name === "coverage") {
          section.coverageDefined = false;
        }
      } else {
        // SPEC 2.7 → 14.17: the props defined on <S>/<Spec> are id, d,
        // coverage, and tags.
        this.addFinding(
          17,
          attrRange,
          `invalid prop: unknown prop ${JSON.stringify(name)} on ` +
            `<S>/<Spec> — the defined props are id, d, coverage, and ` +
            `tags; remove it (SPEC 2.7, 14.17)`,
        );
      }
    }
    for (const [name, ranges] of spellings) {
      if (ranges.length < 2) {
        continue;
      }
      // SPEC 2.7 → 14.17: a repeated prop, defined or unknown, is invalid.
      // SPEC 14 location cardinality: the spellings jointly violate it, so
      // it is ONE finding per repeated name carrying a location for every
      // attribute spelling the name, the first included — no
      // representative is chosen (12.7 orders the locations).
      this.findings.push(
        locatedFinding(
          17,
          `invalid prop: the prop ${JSON.stringify(name)} is spelled ` +
            `${String(ranges.length)} times on one element — no prop name ` +
            `may occur more than once; keep one spelling and remove the ` +
            `others (SPEC 2.7, 14.17)`,
          ranges.map((range) => ({ file: this.file, range })),
        ),
      );
    }
    if (idUnusable) {
      section.id = null;
      section.idAttribute = null;
    }
  }

  /** SPEC 2.7: `d` MUST be a braced expression; record its span for 2.2/2.4. */
  private processDependencyProp(
    attribute: MdxAttributeNode,
    attrSpan: { start: number; end: number },
    section: MutableSection,
  ): void {
    const attrRange = this.byteRange(attrSpan.start, attrSpan.end);
    const value = attribute.value ?? null;
    if (value === null || typeof value === "string") {
      // SPEC 2.7 → 14.17: a quoted or valueless `d` is invalid.
      this.addFinding(
        17,
        attrRange,
        `invalid prop: the d prop must be a braced expression holding a ` +
          `static reference or an array literal of static references — ` +
          `e.g. d={BASE.auth.login} or d={["local.id"]} — not ` +
          `${value === null ? "a valueless prop" : "a quoted string"} ` +
          `(SPEC 2.7, 2.2, 14.17)`,
      );
      return;
    }
    const open = this.valueOpenIndex(attribute, attrSpan);
    if (open === null || this.text[open] !== "{") {
      throw new Error(
        "xspec internal error: braced d value without a brace in source",
      );
    }
    section.dependency = {
      expressionText: derivedContent(
        this.text.slice(open + 1, attrSpan.end - 1),
        (value as { readonly value?: unknown }).value,
      ),
      expressionRange: this.byteRange(open + 1, attrSpan.end - 1),
      attributeRange: attrRange,
    };
  }

  /**
   * SPEC 2.7: the value of `id`, `coverage`, and `tags` MUST be a static
   * string literal in quoted attribute form. Validates the value and
   * records it on the section (SPEC 1.3, 2.5, 2.6 → 14.4, 14.17). Returns
   * whether the prop's interpreted value is defined (SPEC 11.2): false for
   * a malformed (braced/valueless) or invalid-valued `tags`/`coverage`
   * occurrence — a spelled `id`'s definedness is the identity machinery's
   * (`definedIdentitySections`), not this predicate's.
   */
  private processStringProp(
    name: "id" | "coverage" | "tags",
    attribute: MdxAttributeNode,
    attrSpan: { start: number; end: number },
    section: MutableSection,
    onIdUnusable: () => void,
  ): boolean {
    const attrRange = this.byteRange(attrSpan.start, attrSpan.end);
    if (name === "id") {
      section.idPresent = true;
    }
    // The parser's value says only which form the attribute takes: a string
    // for the quoted form, an object for a braced one, null when valueless.
    // Its characters are never read — they are character-reference decoded,
    // and SPEC 2.4 reads a quoted value exactly as spelled (below).
    const form = attribute.value ?? null;
    if (typeof form !== "string") {
      // SPEC 2.7 → 14.17: braced (e.g. id={"login"}) and valueless forms
      // are invalid for id, coverage, and tags.
      this.addFinding(
        17,
        attrRange,
        `invalid prop: the ${name} value must be a static string literal ` +
          `in quoted attribute form, single- or double-quoted — e.g. ` +
          `${name}="…" — not ` +
          `${form === null ? "a valueless prop" : "a braced expression"} ` +
          `(SPEC 2.7, 14.17)`,
      );
      if (name === "id") {
        onIdUnusable();
      }
      return false;
    }
    const open = this.valueOpenIndex(attribute, attrSpan);
    const quoteCharacter = open === null ? null : this.text[open];
    if (
      open === null ||
      (quoteCharacter !== '"' && quoteCharacter !== "'") ||
      this.text[attrSpan.end - 1] !== quoteCharacter
    ) {
      throw new Error(
        "xspec internal error: quoted attribute value without quotes",
      );
    }
    // SPEC 2.4: the value of a quoted attribute is the characters between
    // its delimiters exactly as spelled — no character reference (nor any
    // escape sequence) is interpreted — for `id`, `coverage`, and `tags`
    // alike. So `coverage="&#110;one"` is neither "required" nor "none"
    // (14.17), and `id="a&#46;b"` or `tags="x&#121;"` spells a segment or
    // tag containing `&`, which SPEC 1.4 forbids (14.4).
    const valueStart = open + 1;
    const valueEnd = attrSpan.end - 1;
    const value = this.text.slice(valueStart, valueEnd);

    if (name === "coverage") {
      // SPEC 2.5/2.7 → 14.17: the only defined values are "required"
      // (the default) and "none".
      if (value !== "required" && value !== "none") {
        this.addFinding(
          17,
          attrRange,
          `invalid prop: coverage value ${JSON.stringify(value)} — the ` +
            `only defined values are "required" (the default) and "none" ` +
            `(SPEC 2.5, 2.7, 14.17)`,
        );
        return false;
      }
      section.coverage = value;
      return true;
    }

    if (name === "tags") {
      // SPEC 2.6: whitespace splitting, duplicate collapse; a value
      // yielding no tags is equivalent to omitting the prop. SPEC 12.7:
      // the interpreted tags are a tag set, in byte order (SPEC 12.0) —
      // formed here, so every surface and the graph data carry the set.
      const tags = splitTags(value);
      section.tags = sortByBytes(tags, (tag) => tag);
      const problems = attributeProblems("tag", tags);
      if (problems.length === 0) {
        return true;
      }
      // SPEC 14.4: one finding per `tags` attribute whose value violates
      // 1.4; SPEC 11.2: an invalid-valued prop leaves the interpreted value
      // undefined.
      this.addFinding(
        4,
        attrRange,
        `invalid tag: ${problems.join("; ")} — tags follow the ID-segment ` +
          `rules with "." allowed; correct or remove the tag ` +
          `(SPEC 1.4, 2.6, 14.4)`,
      );
      return false;
    }

    // name === "id" (SPEC 1.3): record the declared ID and validate its
    // segments (SPEC 1.4 → 14.4); the structural checks (14.1–14.3) run in
    // validateStructure once the tree is complete.
    section.id = value;
    section.idAttribute = {
      value,
      valueRange: this.byteRange(valueStart, valueEnd),
      quote: quoteCharacter,
      attributeRange: attrRange,
    };
    const problems = attributeProblems("segment", value.split("."));
    if (problems.length > 0) {
      // SPEC 14.4: one finding per `id` attribute whose value violates 1.4.
      this.addFinding(
        4,
        attrRange,
        `invalid segment in id: ${problems.join("; ")} — correct the ` +
          `segment (SPEC 1.4, 14.4)`,
      );
    }
    // The spelled identity stays spelled whatever its segments (SPEC 11.2);
    // its definedness is judged by `definedIdentitySections`.
    return true;
  }

  /**
   * The UTF-16 index of the character opening an attribute's value (its
   * quote or brace): the first non-whitespace character after the `=`
   * following the attribute name. Null for a valueless attribute.
   */
  private valueOpenIndex(
    attribute: MdxAttributeNode,
    attrSpan: { start: number; end: number },
  ): number | null {
    let index = attrSpan.start + (attribute.name ?? "").length;
    while (
      index < attrSpan.end &&
      isWhitespaceCodePoint(this.text.charCodeAt(index))
    ) {
      index += 1;
    }
    if (index >= attrSpan.end || this.text[index] !== "=") {
      return null;
    }
    index += 1;
    while (
      index < attrSpan.end &&
      isWhitespaceCodePoint(this.text.charCodeAt(index))
    ) {
      index += 1;
    }
    return index < attrSpan.end ? index : null;
  }

  // -------------------------------------------------------------------------
  // Structural validation (SPEC 1.3 → 14.1–14.3)
  // -------------------------------------------------------------------------

  /**
   * SPEC 1.3: every non-root section has an `id` (14.1); IDs are structural
   * paths — a child ID equals the parent ID plus `"."` plus exactly one
   * segment, compared as segment sequences, a top-level section checked
   * against the empty prefix (14.2); IDs are unique within a file (14.3).
   *
   * Masking (SPEC 14.2): the structural check needs the parent's ID — for
   * the immediate children of a section without a usable ID it is masked,
   * while their other conditions, and the check for their own children
   * (against their declared IDs), report normally.
   *
   * Location cardinality (SPEC 14): a duplicated ID is one condition the
   * bearers jointly violate — ONE 14.3 finding per duplicated identity,
   * carrying a location for every bearer, the first included; no
   * representative is chosen.
   */
  validateStructure(): void {
    /** Declared ID → the location of every bearer, in document order. */
    const bearers = new Map<string, ByteRange[]>();
    for (const section of this.sections) {
      if (!section.idPresent) {
        // SPEC 1.3 → 14.1: a non-root section without `id`.
        this.addFinding(
          1,
          section.openingTagRange,
          `missing ID: every non-root section must have an id prop — add ` +
            `one, e.g. <S id="…"> (SPEC 1.3, 14.1)`,
        );
      }
      if (section.id === null) {
        // No usable ID (missing, repeated, or invalid form — each already
        // reported): the structural and duplicate checks cannot run.
        continue;
      }
      const location = section.idAttribute?.attributeRange ?? section.range;
      const parent = section.parent;
      if (parent !== null && (parent.parent === null || parent.id !== null)) {
        const parentSegments =
          parent.parent === null ? [] : parent.id!.split(".");
        const segments = section.id.split(".");
        // SPEC 1.3: segment sequences — the parent's segments plus exactly
        // one more (an empty added segment is a 1.4 matter, not
        // structural); IDs that skip levels are invalid (14.2).
        const structural =
          segments.length === parentSegments.length + 1 &&
          parentSegments.every((segment, index) => segments[index] === segment);
        if (!structural) {
          // SPEC 14.2: the error states the expected form.
          this.addFinding(
            2,
            location,
            parent.parent === null
              ? `invalid structural ID ${JSON.stringify(section.id)}: a ` +
                  `top-level section's ID is checked against the empty ` +
                  `prefix and is exactly one segment (SPEC 1.3, 14.2)`
              : `invalid structural ID ${JSON.stringify(section.id)}: a ` +
                  `child ID equals its parent's ID plus "." plus exactly ` +
                  `one segment — expected the form "${parent.id!}.` +
                  `<segment>" (SPEC 1.3, 14.2)`,
          );
        }
      }
      const locations = bearers.get(section.id);
      if (locations === undefined) bearers.set(section.id, [location]);
      else locations.push(location);
    }
    for (const [id, locations] of bearers) {
      if (locations.length < 2) continue;
      // SPEC 1.3 → 14.3: IDs unique within a source file. One finding per
      // duplicated identity, locating every bearer (SPEC 14 cardinality).
      this.findings.push(
        locatedFinding(
          3,
          `duplicate ID ${JSON.stringify(id)}: ` +
            `${String(locations.length)} sections bear this ID — IDs must ` +
            `be unique within a source file; rename all but one of the ` +
            `sections (SPEC 1.3, 14.3)`,
          locations.map((range) => ({ file: this.file, range })),
        ),
      );
    }
  }

  /** The completed, deterministic document model. */
  finish(): SpecDocument {
    // Deterministic report order (SPEC 12.0, 12.7).
    const sorted = [...this.findings].sort(compareFindings);
    return {
      path: this.path,
      file: this.file,
      text: this.text,
      offsets: this.offsets,
      root: this.root,
      sections: this.sections,
      esmBlocks: this.esmBlocks,
      embeddings: this.embeddings,
      comments: this.comments,
      findings: sorted,
    };
  }
}
