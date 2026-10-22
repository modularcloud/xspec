// Generated TypeScript module emission (SPEC 4, 4.1, 4.2, 4.3, 4.4, 4.5, 13.1).
//
// Pure core (IMPLEMENTATION Architecture: emission is pure text generation —
// deterministic, I/O-free): for one parsed spec source, this module renders
// the generated TypeScript module `NAME.xspec.ts` and its companion files as
// exact text; the workspace layer writes them (SPEC 12.1, 13.4).
//
// File arrangement (SPEC 13.1). Consumers import the extensionless specifier
// `./NAME.xspec`, and type checking, hover and go-to-definition, and runtime
// behavior must all hold under standard TypeScript tooling with no xspec
// runtime dependency. Standard tooling compiles the consumer together with
// the TypeScript files it imports and may write the output anywhere — beside
// the sources or into an output directory elsewhere (TEST-SPEC H-2 runs the
// consumer from such a directory) — and only what the compiler emits is
// there: a plain `.js` file beside the sources never is. So the runtime is
// TypeScript the compiler compiles with the consumer, and every other
// generated file is a declaration file, needed at compile time alone. Three
// generated files serve the specifier:
//
// - `NAME.xspec.ts` — the generated module itself (SPEC 13.1 fixes this
//   path), beginning with the generated-file header (SPEC 4), and the
//   runtime: the frozen node objects, the module-private subtree-text table,
//   the root node — exported as `root` and as the default export — and the
//   `text` function (SPEC 4.1, 4.3, 4.4). TypeScript's extension lookup for
//   `./NAME.xspec` finds this file, and the consumer's own compilation emits
//   `NAME.xspec.js` from it wherever it writes the consumer's output, which
//   Node's runtime extension lookup then finds. Its values are typed through
//   local aliases of import types naming the node interfaces in the type
//   companion — types alone, erased from the output, so the runtime requires
//   nothing. Import types rather than an import declaration: the type
//   companion augments this module (below), and an import declaration of it
//   would have to be kept for that augmentation by declaration emit, which
//   `isolatedDeclarations` refuses (TS9026); an import type stays in the
//   emitted declarations as written. Each node's constant carries the
//   node's documentation comment (SPEC 4.2), so the generated module itself
//   contains every node's documentation.
// - `NAME.xspec.impl.d.ts` — the type companion: the branded node
//   interfaces (SPEC 4.1, 4.4), every child property declared with its
//   node's documentation, and a module augmentation of `./NAME.xspec`
//   declaring an empty namespace `root` — non-instantiated, so it adds no
//   value — that merges into the generated module's exported `root`
//   constant and carries the root's documentation. Standard tooling redirects
//   go-to-definition through a declaration map only from declaration-file
//   positions, which is why every navigable declaration lives here: a child
//   property for a non-root node, and for the root the merged namespace —
//   the root's definitions being the module's constant and this namespace,
//   the latter mapped into the `.mdx` (SPEC 4.2). The augmentation needs a
//   named export to merge into (a default export cannot be augmented),
//   hence the module's `root` export beside its default export; a consumer
//   importing it is still a 14.15 (SPEC 4: only the default and `text`).
// - `NAME.xspec.impl.d.ts.map` — the type companion's declaration map, a
//   standard version-3 source map named by the companion's trailing
//   `//# sourceMappingURL=` comment (and by the standard `<file>.map`
//   sibling lookup). Its `sources` names the `.mdx` source, and each
//   navigable declaration name maps to its node's source position, so
//   editor go-to-definition on a node reference resolves into the source
//   `.mdx` file (SPEC 4.2).
//
// The import types and the augmentation name their targets by
// extensionless relative specifiers, `./NAME.xspec.impl` and `./NAME.xspec`,
// so they resolve under exactly the resolution rules under which the
// consumer's own `./NAME.xspec` does. Every companion is named `NAME.xspec.`
// plus a suffix (SPEC 13.1), so all generated files carry `.xspec.` in their
// names and fall under the source-discovery exclusion (SPEC 13.4). A build
// recording files that no longer exist in this arrangement (the plain
// runtime companion `NAME.xspec.impl.js` of earlier builds) removes them as
// orphans (SPEC 12.1, 13.4).
//
// Documentation and navigation (SPEC 4.2):
//
// - Every generated node carries a documentation comment holding the node's
//   own text truncated to its first 1000 Unicode code points, `…` appended
//   when truncation occurred, each `*/` in the emitted text written `*\/`.
//   In the generated module it sits on the node's constant; in the type
//   companion, on the node's navigable declaration — the child property
//   signature for a non-root node, the merged `root` namespace for the
//   root — where editors surface it as hover documentation for node
//   references (the default import resolves through the export alias to
//   `root`, whose declarations carry the same comment, which hover shows).
// - Go-to-definition: the declaration map carries one mapping per navigable
//   declaration name — a non-root node's property name maps to the first
//   character of its `<S>` construct (SPEC 1.7), the `root` namespace's name
//   to the start of the file (SPEC 1.2, 4.2). The TypeScript language
//   service's source mapper matches a queried declaration position exactly
//   against these mappings and lands in the `.mdx`.
//
// Runtime design (SPEC 4.1, 4.3, 4.4, 4.5). The module uses nothing beyond
// ES5's standard library — no `Symbol`, no `WeakMap` — so it type-checks
// under any target's default library, the release's default target
// included:
//
// - Nodes are frozen plain objects whose enumerable own properties are
//   exactly their child sections by ID segment — opaque tokens carrying no
//   requirement text as values (SPEC 4.1); a marker is a plain property read
//   (SPEC 4.5). Segment names are safe as object keys because SPEC 1.4
//   excludes `__proto__`, `constructor`, `prototype`, `then`, and `$` as
//   segments, and a segment naming a built-in member (`toString`) is an own
//   property shadowing the inherited one.
// - Subtree texts live in a module-private table beside the table of the
//   module's nodes, read by the `text` export alone and never exported, so
//   requirement text is reachable at runtime only through `text` (SPEC
//   4.3): a consumer that never imports `text` can observe only child
//   structure.
// - Each node carries its owning module's workspace-relative source path as
//   a non-enumerable property under the key `xspec.module`, which no ID
//   segment can spell (SPEC 1.4: a segment contains no `.`) — not
//   requirement text — so a foreign module's `text` can name both modules'
//   paths when it throws on a cross-module call (SPEC 4.4 → 14.11 runtime
//   half).
//
// Type design (SPEC 4.1, 4.4): each type companion declares its own
// module-local `unique symbol` and brands every node interface with it plus
// the module's source path as a string-literal type. Distinct declaration
// sites make distinct symbol types, so another module's nodes are never
// assignable here — the cross-module `text` call is a type error at the
// argument (SPEC 4.4) — and the unexported symbol (the companion's `export
// {}` keeps its other declarations module-private) makes node types
// unconstructible by consumers. Child sections are readonly properties named
// by ID segment (bracket-form string names when the segment is not an
// identifier, SPEC 1.4), and a missing requirement path is a property-access
// type error (SPEC 4.1).
//
// All output is a pure function of the document, its texts, and the
// workspace-relative path: byte-deterministic, LF-only line breaks of its
// own, no wall clock, no absolute paths (SPEC 12.0). Requirement text and
// paths enter string literals only through JSON escaping — which never
// introduces raw line breaks — with each `*` escaped besides, so no string
// literal holds the comment delimiters `/*` and `*/` and a generated file's
// documentation comments are exactly its `/**` … `*/` spans; inside
// documentation comments requirement text is embedded raw, made safe by the
// SPEC 4.2 `*/` escaping rule.

import { canonicalJson } from "./canonical-json.js";
import type { SpecDocument, SpecSection } from "./mdx.js";
import type { WorkspaceTextModel } from "./text-model.js";

// ---------------------------------------------------------------------------
// Public model
// ---------------------------------------------------------------------------

/** One generated file: workspace-relative path and exact content. */
export interface GeneratedFile {
  /** Workspace-relative `/`-separated path (SPEC 1.5). */
  readonly path: string;
  /** The file's exact text (UTF-8 once written, SPEC 12.0). */
  readonly content: string;
}

/** The generated-file paths of one spec source (SPEC 13.1). */
export interface SpecModulePaths {
  /** `DIR/NAME.xspec.ts` — the generated module and its runtime (SPEC 13.1). */
  readonly module: string;
  /** `DIR/NAME.xspec.impl.d.ts` — the type companion. */
  readonly types: string;
  /** `DIR/NAME.xspec.impl.d.ts.map` — the declaration map (SPEC 4.2). */
  readonly typesMap: string;
}

/**
 * The suffixes `NAME` takes in its generated module's and companions'
 * paths (SPEC 13.1: every one `NAME.xspec.` plus a suffix), in
 * `SpecModulePaths` order — the one naming source of `specModulePaths`
 * and of the byte-wise enumeration of derived paths
 * (core/derived-relation.ts).
 */
export const SPEC_MODULE_SUFFIXES: SpecModulePaths = {
  module: ".xspec.ts",
  types: ".xspec.impl.d.ts",
  typesMap: ".xspec.impl.d.ts.map",
};

/**
 * The generated-module paths for the spec source at `specPath`
 * (workspace-relative): `NAME.mdx` generates `NAME.xspec.ts` and its
 * companions in the source file's directory (SPEC 13.1).
 */
export function specModulePaths(specPath: string): SpecModulePaths {
  const stem = specPath.endsWith(".mdx")
    ? specPath.slice(0, -".mdx".length)
    : specPath;
  return {
    module: stem + SPEC_MODULE_SUFFIXES.module,
    types: stem + SPEC_MODULE_SUFFIXES.types,
    typesMap: stem + SPEC_MODULE_SUFFIXES.typesMap,
  };
}

/**
 * Render the generated TypeScript module and companions for one parsed spec
 * source (SPEC 4, 13.1), in `SpecModulePaths` order (module, types,
 * typesMap). Only valid workspaces emit generated output (SPEC 12.1); to
 * stay total, a section without a usable ID (null, possible only alongside
 * its own findings) is skipped with its subtree.
 */
export function generateSpecModule(
  document: SpecDocument,
  textModel: WorkspaceTextModel,
): readonly GeneratedFile[] {
  const paths = specModulePaths(document.path);
  const fileName = lastPathSegment(document.path);
  const root = collectNodes(document, textModel);
  const nodes = flattenPreOrder(root);
  const brand = brandTypeName(fileName);
  const types = renderTypes(document, paths, brand, root, nodes);
  return [
    {
      path: paths.module,
      content: renderModule(document, textModel, paths, brand, root),
    },
    { path: paths.types, content: types.content },
    { path: paths.typesMap, content: types.mapContent },
  ];
}

// ---------------------------------------------------------------------------
// Node collection
// ---------------------------------------------------------------------------

/** One emitted node: a section (root included) with a usable identity. */
interface EmitNode {
  readonly section: SpecSection;
  /** Pre-order index over emitted nodes; the root is 0. */
  readonly index: number;
  /** The child's ID segment — its property name; null for the root. */
  readonly segment: string | null;
  /** `path` for the root, `path#id` otherwise (SPEC 1.5). */
  readonly identity: string;
  /** The node's own text (SPEC 1.6, expanded) — its documentation (4.2). */
  readonly ownText: string;
  readonly children: readonly EmitNode[];
}

/** Collect the emitted node tree in document order (root first). */
function collectNodes(
  document: SpecDocument,
  textModel: WorkspaceTextModel,
): EmitNode {
  let nextIndex = 0;
  const build = (section: SpecSection, segment: string | null): EmitNode => {
    const index = nextIndex;
    nextIndex += 1;
    const children: EmitNode[] = [];
    for (const child of section.children) {
      if (child.id === null) {
        // No usable identity (its own 14.1/14.17 finding accounts for it;
        // such workspaces never emit) — skipped with its subtree.
        continue;
      }
      children.push(build(child, lastIdSegment(child.id)));
    }
    const identity =
      section.id === null ? document.path : `${document.path}#${section.id}`;
    return {
      section,
      index,
      segment,
      identity,
      ownText: textModel.ownText(document, section),
      children,
    };
  };
  return build(document.root, null);
}

/** Pre-order flattening of the emitted node tree (document order). */
function flattenPreOrder(root: EmitNode): readonly EmitNode[] {
  const nodes: EmitNode[] = [];
  const visit = (node: EmitNode): void => {
    nodes.push(node);
    for (const child of node.children) visit(child);
  };
  visit(root);
  return nodes;
}

/** The final segment of a structural ID (SPEC 1.3). */
function lastIdSegment(id: string): string {
  return id.slice(id.lastIndexOf(".") + 1);
}

/** The final `/`-separated component of a workspace-relative path. */
function lastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

// ---------------------------------------------------------------------------
// Rendering primitives
// ---------------------------------------------------------------------------

/**
 * A double-quoted TypeScript/JavaScript string literal holding exactly
 * `value`, JSON-escaped: JSON escaping covers every control character,
 * quote, and backslash; U+2028/U+2029 are escaped additionally so the
 * literal never contains a raw line terminator (safe inside `//` comments
 * too).
 */
function jsonStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

/**
 * The escape sequence for `*` in a string literal: a backslash (code 0x5c)
 * and the hexadecimal escape body `x2a`.
 */
const ESCAPED_ASTERISK = String.fromCharCode(0x5c) + "x2a";

/**
 * A double-quoted TypeScript/JavaScript string literal holding exactly
 * `value` — `jsonStringLiteral`'s, each `*` escaped besides, so no literal
 * a generated file carries (requirement text, paths, segments) holds `/*`
 * or `*\/` and the file's documentation comments (SPEC 4.2) are exactly
 * its `/**` … `*\/` spans, whatever the text holds.
 */
function stringLiteral(value: string): string {
  return jsonStringLiteral(value).replaceAll("*", ESCAPED_ASTERISK);
}

/** ASCII identifier test for property-name and type-name rendering. */
const IDENTIFIER_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * A property name for an ID segment: bare when it is an identifier name,
 * a string literal otherwise (bracket access on the consumer side,
 * SPEC 1.4, 4.1). Both forms declare the same property.
 */
function propertyName(segment: string): string {
  return IDENTIFIER_NAME.test(segment) ? segment : stringLiteral(segment);
}

/**
 * The brand interface name, derived from the source file name so
 * cross-module assignability errors name both modules readably. Uniqueness
 * is not needed — every emitted type name is local to its own declaration
 * file — so the sanitization is purely cosmetic.
 */
function brandTypeName(fileName: string): string {
  const stem = fileName.endsWith(".mdx")
    ? fileName.slice(0, -".mdx".length)
    : fileName;
  const sanitized = stem.replace(/[^A-Za-z0-9_$]/g, "_");
  return `XspecNode_${sanitized === "" ? "_" : sanitized}`;
}

/** The per-node interface name (pre-order index; the root is 0). */
function nodeTypeName(brand: string, index: number): string {
  return `${brand}_${String(index)}`;
}

// ---------------------------------------------------------------------------
// Documentation comments (SPEC 4.2)
// ---------------------------------------------------------------------------

/** SPEC 4.2: documentation truncates at 1000 Unicode code points. */
const DOC_COMMENT_CODE_POINT_LIMIT = 1000;

/**
 * The node's documentation comment (SPEC 4.2): its own text truncated to
 * its first 1000 Unicode code points, `…` appended when truncation
 * occurred, each occurrence of the comment-terminating sequence in the
 * emitted text written with a backslash before the slash — so the emitted
 * text can never end the comment early. The text is embedded raw (its own
 * line breaks preserved) between the comment delimiters, so the comment
 * literally contains the emitted text and editors show it as hover
 * documentation.
 */
function docComment(ownText: string): string {
  let index = 0;
  let codePoints = 0;
  while (index < ownText.length && codePoints < DOC_COMMENT_CODE_POINT_LIMIT) {
    const codePoint = ownText.codePointAt(index)!;
    index += codePoint > 0xffff ? 2 : 1;
    codePoints += 1;
  }
  const truncated =
    index < ownText.length ? `${ownText.slice(0, index)}…` : ownText;
  const emitted = truncated.replaceAll("*/", "*\\/");
  return `/**\n${emitted}\n*/`;
}

// ---------------------------------------------------------------------------
// Positions and the declaration map (SPEC 4.2)
// ---------------------------------------------------------------------------

/**
 * A text accumulator tracking the current 0-based line and UTF-16 column
 * with TypeScript's line-break conventions (LF, CR, CRLF, U+2028, U+2029 —
 * the scanner's `computeLineStarts`), so declaration-map positions recorded
 * while rendering agree exactly with how the language service computes
 * offsets in the finished file — embedded requirement text with foreign
 * line breaks included.
 */
class PositionedWriter {
  #parts: string[] = [];
  #line = 0;
  #column = 0;
  #pendingCarriageReturn = false;

  get line(): number {
    return this.#line;
  }

  get column(): number {
    return this.#column;
  }

  get text(): string {
    return this.#parts.join("");
  }

  append(chunk: string): void {
    for (let i = 0; i < chunk.length; i += 1) {
      const code = chunk.charCodeAt(i);
      if (code === 0x0a && this.#pendingCarriageReturn) {
        // CRLF: one line break, already counted at the CR.
        this.#pendingCarriageReturn = false;
        continue;
      }
      this.#pendingCarriageReturn = code === 0x0d;
      if (
        code === 0x0a ||
        code === 0x0d ||
        code === 0x2028 ||
        code === 0x2029
      ) {
        this.#line += 1;
        this.#column = 0;
      } else {
        this.#column += 1;
      }
    }
    this.#parts.push(chunk);
  }

  appendLine(chunk: string): void {
    this.append(chunk);
    this.append("\n");
  }
}

/** A 0-based line/character position (UTF-16 columns, TS conventions). */
interface LineCharacter {
  readonly line: number;
  readonly character: number;
}

/**
 * One declaration-map mapping: a declaration-name position in the type
 * companion and its node's position in the `.mdx` source (single source,
 * index 0).
 */
interface MappingEntry {
  readonly generated: LineCharacter;
  readonly source: LineCharacter;
}

/**
 * Line-start UTF-16 indices of `text` under TypeScript's line-break
 * conventions (LF, CR, CRLF, U+2028, U+2029) — the convention the language
 * service uses to turn the declaration map's source line/character into an
 * offset in the `.mdx`.
 */
function tsLineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 0x0d) {
      if (i + 1 < text.length && text.charCodeAt(i + 1) === 0x0a) {
        i += 1;
      }
      starts.push(i + 1);
    } else if (code === 0x0a || code === 0x2028 || code === 0x2029) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/** The 0-based line/character of UTF-16 index `index` given line starts. */
function positionAtIndex(lineStarts: number[], index: number): LineCharacter {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lineStarts[mid]! <= index) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { line: low, character: index - lineStarts[low]! };
}

/** The base64 alphabet of source-map VLQ digits. */
const BASE64_DIGITS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** One signed value in base64 VLQ (source map v3): sign bit, then 5-bit digits. */
function base64Vlq(value: number): string {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
  let encoded = "";
  do {
    let digit = vlq & 0x1f;
    vlq >>>= 5;
    if (vlq > 0) {
      digit |= 0x20;
    }
    encoded += BASE64_DIGITS.charAt(digit);
  } while (vlq > 0);
  return encoded;
}

/**
 * The `mappings` field of the declaration map: one four-field segment per
 * entry (generated column, source index 0, source line, source character),
 * delta-encoded per the source map v3 format; `;` advances the generated
 * line. Entries are sorted by generated position, as consumers require.
 */
function encodeMappings(entries: readonly MappingEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) =>
      a.generated.line - b.generated.line ||
      a.generated.character - b.generated.character,
  );
  let mappings = "";
  let generatedLine = 0;
  let generatedCharacter = 0;
  let sourceLine = 0;
  let sourceCharacter = 0;
  let lineHasSegment = false;
  for (const entry of sorted) {
    while (generatedLine < entry.generated.line) {
      mappings += ";";
      generatedLine += 1;
      generatedCharacter = 0;
      lineHasSegment = false;
    }
    if (lineHasSegment) {
      mappings += ",";
    }
    mappings += base64Vlq(entry.generated.character - generatedCharacter);
    mappings += base64Vlq(0); // single source file: index delta 0
    mappings += base64Vlq(entry.source.line - sourceLine);
    mappings += base64Vlq(entry.source.character - sourceCharacter);
    generatedCharacter = entry.generated.character;
    sourceLine = entry.source.line;
    sourceCharacter = entry.source.character;
    lineHasSegment = true;
  }
  return mappings;
}

// ---------------------------------------------------------------------------
// File templates
// ---------------------------------------------------------------------------

/** The extension of a TypeScript module file. */
const MODULE_FILE_EXTENSION = ".ts";

/** The extension of a TypeScript declaration file. */
const DECLARATION_FILE_EXTENSION = ".d.ts";

/**
 * The extensionless relative specifier by which a generated file beside it
 * names the generated file at `path` (SPEC 13.1: every generated file lies
 * in its source's directory), `extension` dropped — `./NAME.xspec` for the
 * module `NAME.xspec.ts`, `./NAME.xspec.impl` for the type companion
 * `NAME.xspec.impl.d.ts`. It is the form the consumer's own `./NAME.xspec`
 * takes, so it resolves under exactly the rules under which that does.
 */
function extensionlessSpecifier(path: string, extension: string): string {
  const fileName = lastPathSegment(path);
  return `./${fileName.slice(0, fileName.length - extension.length)}`;
}

/**
 * `NAME.xspec.ts` — the generated module and its runtime (SPEC 13.1, 4,
 * 4.1, 4.3, 4.4, 4.5): the header identifying it as generated by xspec from
 * its source file (SPEC 4); local aliases of the node interfaces the type
 * companion declares, through import types (the module header says why);
 * the module-private node and subtree-text tables and the node
 * constructor; every node's constant, children first so each literal
 * references already-built nodes, carrying the node's documentation
 * comment (SPEC 4.2); the root, exported as `root` — the declaration the
 * type companion's augmentation merges into — and as the default export
 * (SPEC 4.1); and the `text` export (SPEC 4.3, 4.4). It type-checks under
 * the strict standard configurations with nothing beyond ES5's standard
 * library: no `@types/node` (`exports`, `require`, `process`), types
 * reached by type-level syntax alone (`isolatedModules`,
 * `verbatimModuleSyntax`), and every export annotated
 * (`isolatedDeclarations`).
 */
function renderModule(
  document: SpecDocument,
  textModel: WorkspaceTextModel,
  paths: SpecModulePaths,
  brand: string,
  root: EmitNode,
): string {
  const specPath = document.path;
  const rootType = nodeTypeName(brand, root.index);
  const typesSpecifier = extensionlessSpecifier(
    paths.types,
    DECLARATION_FILE_EXTENSION,
  );
  const lines: string[] = [
    // SPEC 4: the generated-file header — the module begins with a comment
    // region identifying xspec and the source file.
    `// Generated by xspec from ${stringLiteral(specPath)}. Do not edit: manual`,
    `// edits are invalid (SPEC 4) and \`xspec check\` reports them as staleness`,
    `// (SPEC 14.10); \`xspec build\` regenerates this module and its companion`,
    `// files (SPEC 13.1).`,
    ``,
    `// The node types (SPEC 4.1, 4.4), declared in the type companion, whose`,
    `// declaration map sends go-to-definition into the source (SPEC 4.2).`,
    `type ${brand} = import(${stringLiteral(typesSpecifier)}).${brand};`,
    `type ${rootType} = import(${stringLiteral(typesSpecifier)}).${rootType};`,
    ``,
    `// SPEC 4.4: every node carries this module's source path, non-enumerable,`,
    `// under the key every generated module shares — one no ID segment spells`,
    `// (SPEC 1.4) — so a foreign module's \`text\` can name both modules when`,
    `// it throws (14.11).`,
    `const XSPEC_MODULE: string = ${stringLiteral(specPath)};`,
    `const XSPEC_MODULE_KEY = "xspec.module";`,
    `// SPEC 4.3: requirement text is reachable at runtime only through the`,
    `// \`text\` export: subtree texts live in this module-private table, beside`,
    `// the table of this module's nodes, never on the nodes (SPEC 4.1: nodes`,
    `// carry no requirement text as values).`,
    `const XSPEC_NODES: object[] = [];`,
    `const XSPEC_TEXTS: string[] = [];`,
    `function xspecNode(children: object, subtreeText: string): object {`,
    `  Object.defineProperty(children, XSPEC_MODULE_KEY, { value: XSPEC_MODULE });`,
    `  XSPEC_NODES.push(children);`,
    `  XSPEC_TEXTS.push(subtreeText);`,
    `  return Object.freeze(children);`,
    `}`,
    ``,
    `// SPEC 4.1: each node is frozen, its enumerable own properties exactly its`,
    `// child sections by ID segment; SPEC 4.2: each node's constant carries the`,
    `// node's documentation comment. Children come first, so every literal`,
    `// references already-built nodes.`,
  ];
  // A node's constructor call: its children by ID segment — the runtime
  // object keys always string literals, uniform and safe for every segment
  // SPEC 1.4 admits — and its subtree text (SPEC 1.6, 4.3).
  const nodeValue = (node: EmitNode): string => {
    const entries = node.children
      .map(
        (child) =>
          `${stringLiteral(child.segment ?? "")}: n${String(child.index)}`,
      )
      .join(", ");
    const children = entries === "" ? "{}" : `{ ${entries} }`;
    const subtreeText = stringLiteral(
      textModel.subtreeText(document, node.section),
    );
    return `xspecNode(${children}, ${subtreeText})`;
  };
  const emitDescendants = (node: EmitNode): void => {
    for (const child of node.children) {
      emitDescendants(child);
      lines.push(
        `// ${stringLiteral(child.identity)}`,
        docComment(child.ownText),
        `const n${String(child.index)} = ${nodeValue(child)};`,
      );
    }
  };
  emitDescendants(root);
  lines.push(
    `// ${stringLiteral(root.identity)}: the root node (SPEC 1.2).`,
    docComment(root.ownText),
    `export const root: ${rootType} = ${nodeValue(root)} as ${rootType};`,
    `// SPEC 4.1: the default export is the root node.`,
    `export { root as default };`,
    ``,
    `// SPEC 4.3: \`text(node)\` returns the node's subtree text as a string.`,
    `// SPEC 4.4 → 14.11: a node of another generated module causes a throw`,
    `// naming both the node's module and this one by their source files'`,
    `// workspace-relative paths.`,
    `export function text(node: ${brand}): string {`,
    `  const index = XSPEC_NODES.indexOf(node);`,
    `  if (index >= 0) {`,
    `    return XSPEC_TEXTS[index] as string;`,
    `  }`,
    `  const candidate: unknown = node;`,
    `  const owner: unknown =`,
    `    typeof candidate === "object" && candidate !== null`,
    `      ? (candidate as { readonly [key: string]: unknown })[XSPEC_MODULE_KEY]`,
    `      : undefined;`,
    `  if (typeof owner === "string" && owner !== XSPEC_MODULE) {`,
    `    throw new Error(`,
    `      "xspec: cross-module text() call (SPEC 4.4): the node belongs to " +`,
    `        "the spec module generated from '" +`,
    `        owner +`,
    `        "' but was passed to the \`text\` export of the module generated " +`,
    `        "from '" +`,
    `        XSPEC_MODULE +`,
    `        "'.",`,
    `    );`,
    `  }`,
    `  throw new Error(`,
    `    "xspec: text() expects a node of the spec module generated from '" +`,
    `      XSPEC_MODULE +`,
    `      "' (SPEC 4.1, 4.3).",`,
    `  );`,
    `}`,
    ``,
  );
  return lines.join("\n");
}

/** The rendered type companion and its declaration map (SPEC 4.1, 4.2). */
interface RenderedTypes {
  /** `NAME.xspec.impl.d.ts` content. */
  readonly content: string;
  /** `NAME.xspec.impl.d.ts.map` content. */
  readonly mapContent: string;
}

/**
 * `NAME.xspec.impl.d.ts` — the type companion (SPEC 4.1, 4.2, 4.4): the
 * module-local brand, the per-node interfaces with readonly segment-named
 * child properties — exported, so the generated module's import types
 * name them — and
 * the augmentation of the generated module that merges a namespace carrying
 * the root's documentation into its `root` export. Every node's navigable
 * declaration carries its documentation comment, and the accompanying
 * declaration map sends each declaration name to the node's `.mdx`
 * position (SPEC 4.2).
 */
function renderTypes(
  document: SpecDocument,
  paths: SpecModulePaths,
  brand: string,
  root: EmitNode,
  nodes: readonly EmitNode[],
): RenderedTypes {
  const specPath = document.path;
  const moduleFileName = lastPathSegment(paths.module);
  const moduleSpecifier = extensionlessSpecifier(
    paths.module,
    MODULE_FILE_EXTENSION,
  );
  const typesFileName = lastPathSegment(paths.types);
  const mapFileName = lastPathSegment(paths.typesMap);
  const sourceFileName = lastPathSegment(specPath);
  const sourceLineStarts = tsLineStarts(document.text);
  const writer = new PositionedWriter();
  const mappings: MappingEntry[] = [];

  // The node's SPEC 4.2 navigation target in the `.mdx`: the first
  // character of its `<S>` construct (SPEC 1.7) for a non-root node, the
  // start of the file for the root (SPEC 1.2).
  const sourcePosition = (node: EmitNode): LineCharacter => {
    if (node.section.parent === null) {
      return { line: 0, character: 0 };
    }
    return positionAtIndex(
      sourceLineStarts,
      document.offsets.indexOfByteOffset(node.section.range.start),
    );
  };

  for (const line of [
    `// Generated by xspec from ${stringLiteral(specPath)} — the type`,
    `// companion of ${stringLiteral(moduleFileName)} (SPEC 13.1). Do not edit:`,
    `// \`xspec build\` regenerates this file.`,
    ``,
    `// SPEC 4.4: node types are branded per generated module. The brand`,
    `// symbol is module-local and never exported, so nodes are opaque tokens`,
    `// (SPEC 4.1) consumers can neither construct nor unbrand, and another`,
    `// module's nodes — branded with that module's own symbol — are never`,
    `// assignable to this module's node types: the cross-module \`text\` call`,
    `// is a type error at the argument (14.11).`,
    `declare const XSPEC_BRAND: unique symbol;`,
    `export interface ${brand} {`,
    `  readonly [XSPEC_BRAND]: ${stringLiteral(specPath)};`,
    `}`,
    ``,
  ]) {
    writer.appendLine(line);
  }
  for (const node of nodes) {
    // SPEC 4.1: child sections as readonly properties named by ID segment;
    // a missing requirement path is a property-access type error.
    writer.appendLine(
      `export interface ${nodeTypeName(brand, node.index)} extends ${brand} {`,
    );
    for (const child of node.children) {
      // SPEC 4.2: the child node's documentation comment, as JSDoc on its
      // navigable declaration.
      writer.appendLine(docComment(child.ownText));
      writer.append(`  readonly `);
      // SPEC 4.2: go-to-definition — the declaration name (the exact
      // position definition queries carry) maps into the `.mdx`.
      mappings.push({
        generated: { line: writer.line, character: writer.column },
        source: sourcePosition(child),
      });
      writer.appendLine(
        `${propertyName(child.segment ?? "")}: ${nodeTypeName(brand, child.index)};`,
      );
    }
    writer.appendLine(`}`);
  }
  writer.appendLine(``);
  for (const line of [
    `// SPEC 4.2: the root node's documentation and go-to-definition target.`,
    `// This augmentation merges an empty namespace — adding no value — into`,
    `// the generated module's \`root\` export, the root node its default export`,
    `// names, so the root has a declaration in this declaration file, which`,
    `// the declaration map sends to the start of the source.`,
    `declare module ${stringLiteral(moduleSpecifier)} {`,
  ]) {
    writer.appendLine(line);
  }
  // SPEC 4.2: the root node's documentation comment; hover on a root
  // reference shows it (the default import resolves to `root`).
  writer.appendLine(docComment(root.ownText));
  writer.append(`  namespace `);
  mappings.push({
    generated: { line: writer.line, character: writer.column },
    source: sourcePosition(root),
  });
  writer.appendLine(`root {}`);
  for (const line of [
    `}`,
    `// Only the declarations marked \`export\` above are exported.`,
    `export {};`,
    `// SPEC 4.2: the declaration map redirecting go-to-definition into the`,
    `// source \`.mdx\`.`,
    `//# sourceMappingURL=${mapFileName}`,
  ]) {
    writer.appendLine(line);
  }

  return {
    content: writer.text,
    // A standard version-3 source map (SPEC 4.2): `file` names the type
    // companion, `sources` the `.mdx` source beside it (SPEC 13.1: same
    // directory), both as bare file names so the map is location-independent.
    mapContent: canonicalJson({
      file: typesFileName,
      mappings: encodeMappings(mappings),
      names: [],
      sources: [sourceFileName],
      version: 3,
    }),
  };
}
