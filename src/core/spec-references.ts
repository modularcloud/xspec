// MDX-side import validation and reference extraction (SPEC 2.1–2.4).
//
// Over the parsed document model (./mdx.ts), this module validates the
// file's spec-module imports (SPEC 2.1 → 14.15) and extracts its
// references — `d` dependency references (SPEC 2.2) and `{text(...)}`
// embedding arguments (SPEC 2.3) — through the shared static-reference
// analyzer (./references.ts, SPEC 2.4; IMPLEMENTATION: one analyzer for
// MDX expression spans and TypeScript sources). Each reference is
// recorded as data: its target descriptor for graph resolution (SPEC 5.2
// — unknown targets report 14.5/14.6 there), its exact spelling and
// spans for the minimal in-place rewrites of rename and move (SPEC 6.4,
// 6.5), and its byte range for findings. Import-cycle detection over the
// recorded import targets is the graph's (SPEC 2.1, 5.3 → 14.9).
//
// Masking (SPEC 14): a reference whose chain is rooted at a binding
// introduced by an *invalid* import (or by colliding imports) is masked —
// the import's own 14.15 already accounts for it, and its target is
// undetectable — while a chain rooted at an identifier no import binds is
// a dynamic reference (14.8): it is not "rooted at an imported spec
// module" (SPEC 2.4). References through a valid import of an
// unparseable file are recorded normally and report as unresolved during
// resolution (SPEC 14.20, 14.5–14.7); references through a valid import
// of a member whose own path is invalid (SPEC 14.19) never resolve —
// every identity of such a file is undefined (SPEC 11.2) — a condition
// decidable per file, so their 14.5/14.6 is reported here directly.

import ts from "typescript";
import type { ByteRange } from "./bytes.js";
import { Utf8Offsets } from "./bytes.js";
import type { Finding } from "./findings.js";
import { compareFindings, locatedFinding } from "./findings.js";
import type { PathText } from "./path-text.js";
import { pathTextKey, pathTextOf, renderPathText } from "./path-text.js";
import type {
  SpecDocument,
  SpecEmbedding,
  SpecImportStatement,
  SpecSection,
} from "./mdx.js";
import type {
  ClassifiedChain,
  ClassifiedReference,
  ClassifiedString,
  TextSpan,
} from "./references.js";
import { classifyReference, parseExpressionText } from "./references.js";

// ---------------------------------------------------------------------------
// The import model (SPEC 2.1)
// ---------------------------------------------------------------------------

/** One import declaration of an xspec source file, analyzed (SPEC 2.1). */
export interface SpecImport {
  /** The declaration's statement span and exact text (SPEC 6.5 removals). */
  readonly statement: SpecImportStatement;
  /** The single default binding, when the form permits one (SPEC 2.1). */
  readonly bindingName: string | null;
  /** The module specifier's cooked value. */
  readonly specifier: string;
  /** The quote character of the specifier literal (SPEC 6.5 rewrites). */
  readonly specifierQuote: '"' | "'";
  /** The specifier literal's characters, quotes included (SPEC 6.5). */
  readonly specifierRange: ByteRange;
  /**
   * The designated source file's workspace-relative path (SPEC 2.1:
   * `DIR/NAME.xspec` designates `DIR/NAME.mdx`) when the import is valid
   * and the designated member's identities are defined (a valid source
   * path, SPEC 11.2). Null for an invalid import — and for a valid import
   * designating a member whose path is invalid (SPEC 14.19): such a
   * member's identities are all undefined, so nothing identity-shaped
   * points at it; `targetFile` still carries its path.
   */
  readonly targetPath: string | null;
  /**
   * The designated member's path as data (SPEC 12.0, 12.7) for every
   * valid import — equal to `targetPath` where that is non-null, and the
   * 14.19 member's exact path (marked byte form capable) otherwise; the
   * file-level import relation (cycles, SPEC 2.1 → 5.3) and the surfaces
   * of 11.4 read it. Null exactly for an invalid import.
   */
  readonly targetFile: PathText | null;
  /** Whether the import itself is valid (duplicate bindings are pairwise). */
  readonly valid: boolean;
}

/** What one import-bound identifier means as a reference root (SPEC 2.2). */
export type SpecImportBinding =
  | {
      /** A valid spec-module binding: chains rooted here are external. */
      readonly kind: "module";
      readonly targetPath: string;
    }
  | {
      /**
       * A valid spec-module binding of a member whose own path is invalid
       * (SPEC 14.19): the import is no finding, but every identity of the
       * designated file is undefined (SPEC 11.2), so a reference rooted
       * here never resolves — condition 14.5/14.6, decidable per file.
       */
      readonly kind: "undefined-module";
      readonly modulePath: PathText;
    }
  | {
      /**
       * A binding of an invalid import, or an identifier bound by more
       * than one import: the 14.15 accounts for it, and references rooted
       * here are masked (SPEC 14).
       */
      readonly kind: "poisoned";
    };

/** The analyzed imports of one xspec source file (SPEC 2.1). */
export interface SpecImportModel {
  /** Every import declaration, in document order. */
  readonly imports: readonly SpecImport[];
  /** Every import-bound identifier and what it means as a chain root. */
  readonly bindings: ReadonlyMap<string, SpecImportBinding>;
  /** The 14.15 findings (SPEC 2.1), ordered by location. */
  readonly findings: readonly Finding[];
}

/**
 * SPEC 2.1: resolve a relative import specifier against the importing
 * file's directory, over workspace-relative `/`-separated paths
 * (SPEC 1.5). Returns the resolved workspace-relative path, or null when
 * the specifier climbs out of the workspace root. Shared with the
 * TypeScript-side analysis (SPEC 4: same form and resolution as 2.1).
 */
export function resolveImportSpecifier(
  importerPath: string,
  specifier: string,
): string | null {
  const segments = importerPath.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (segments.length === 0) {
        return null; // resolves outside the workspace root
      }
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return segments.join("/");
}

/**
 * SPEC 2.1: `resolveImportSpecifier` over exact path bytes, for an
 * importing file whose own path has no plain string form (SPEC 14.19):
 * the importer's directory bytes joined with the specifier's segments —
 * the specifier itself is decoded source text, so its segments enter as
 * their UTF-8 bytes. Returns null when the specifier climbs out of the
 * workspace root. For a valid-UTF-8 importer this computes exactly what
 * the string form computes.
 */
export function resolveImportSpecifierBytes(
  importerBytes: Uint8Array,
  specifier: string,
): Uint8Array | null {
  const SLASH = 0x2f;
  const segments: Uint8Array[] = [];
  let start = 0;
  for (let index = 0; index <= importerBytes.length; index += 1) {
    if (index === importerBytes.length || importerBytes[index] === SLASH) {
      segments.push(importerBytes.subarray(start, index));
      start = index + 1;
    }
  }
  segments.pop(); // the importing file's own name — resolve from its directory
  const encoder = new TextEncoder();
  for (const part of specifier.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (segments.length === 0) {
        return null; // resolves outside the workspace root
      }
      segments.pop();
      continue;
    }
    segments.push(encoder.encode(part));
  }
  let length = 0;
  for (const segment of segments) length += segment.length;
  const joined = new Uint8Array(
    length + (segments.length > 0 ? segments.length - 1 : 0),
  );
  let offset = 0;
  for (let index = 0; index < segments.length; index += 1) {
    if (index > 0) {
      joined[offset] = SLASH;
      offset += 1;
    }
    joined.set(segments[index], offset);
    offset += segments[index].length;
  }
  return joined;
}

/**
 * The outcome of designating the file an in-form import specifier names
 * (SPEC 2.1: a relative `./`/`../` specifier ending `.xspec`, resolved
 * against the importing file's directory; `DIR/NAME.xspec` designates
 * `DIR/NAME.mdx`). Membership is over the entire discovered spec-source
 * set — an import designating a discovered member whose path is invalid
 * (SPEC 14.19) is valid (no 14.15), while the member's identities are all
 * undefined (SPEC 11.2), so references through it never resolve.
 */
export type SpecifierDesignation =
  | { readonly kind: "outside-root" }
  | {
      /** Not a discovered spec-group member; `designated` is its
       * deterministic display spelling for the 14.15 message. */
      readonly kind: "undiscovered";
      readonly designated: string;
    }
  | {
      /** A member with defined identities: a valid source path. */
      readonly kind: "defined-member";
      readonly path: string;
    }
  | {
      /** A 14.19 member: import valid, every identity undefined (11.2). */
      readonly kind: "undefined-member";
      readonly file: PathText;
    };

/**
 * Designate the member an in-form specifier names from one importing
 * file. Callers check the specifier's form first (relative, `.xspec`);
 * the designator owns resolution and membership.
 */
export type DesignateSpecifier = (specifier: string) => SpecifierDesignation;

const XSPEC_SUFFIX_LENGTH = 6; // ".xspec"
const MDX_SUFFIX_BYTES = [0x2e, 0x6d, 0x64, 0x78]; // ".mdx"

/** One discovered spec source's designation record, either path form. */
interface SpecMemberRecord {
  readonly path: PathText;
  readonly defined: boolean;
}

/**
 * The discovered spec-source domain import designation consults (SPEC 2.1,
 * 7.1): every discovered spec source, valid or invalid-path (14.19),
 * indexed for the two resolution spaces — string space for importing
 * files with a plain string path, byte space for importers whose own path
 * has none (only reachable inside 14.19 analyses).
 */
export class SpecSourceDomain {
  private readonly byString = new Map<string, SpecMemberRecord>();
  private readonly byKey = new Map<string, SpecMemberRecord>();

  constructor(
    definedPaths: Iterable<string>,
    invalidSpecPaths: Iterable<{
      readonly path: PathText;
      readonly bytes: Uint8Array;
    }>,
  ) {
    for (const path of definedPaths) {
      const record: SpecMemberRecord = { path, defined: true };
      this.byString.set(path, record);
      this.byKey.set(pathTextKey(path), record);
    }
    for (const source of invalidSpecPaths) {
      const record: SpecMemberRecord = { path: source.path, defined: false };
      if (typeof source.path === "string") {
        this.byString.set(source.path, record);
      }
      this.byKey.set(pathTextKey(source.path), record);
    }
  }

  private static memberDesignation(
    record: SpecMemberRecord | undefined,
    display: () => string,
  ): SpecifierDesignation {
    if (record === undefined) {
      return { kind: "undiscovered", designated: display() };
    }
    return record.defined && typeof record.path === "string"
      ? { kind: "defined-member", path: record.path }
      : { kind: "undefined-member", file: record.path };
  }

  /** The designator for an importing file with a plain string path. */
  designatorFor(importerPath: string): DesignateSpecifier {
    return (specifier) => {
      const resolved = resolveImportSpecifier(importerPath, specifier);
      if (resolved === null) {
        return { kind: "outside-root" };
      }
      // SPEC 2.1: `DIR/NAME.xspec` designates `DIR/NAME.mdx`.
      const designated = resolved.slice(0, -XSPEC_SUFFIX_LENGTH) + ".mdx";
      return SpecSourceDomain.memberDesignation(
        this.byString.get(designated),
        () => designated,
      );
    };
  }

  /**
   * The designator for an importing file whose own path has no plain
   * string form (SPEC 14.19): resolution and membership over exact bytes.
   */
  designatorForBytes(importerBytes: Uint8Array): DesignateSpecifier {
    return (specifier) => {
      const resolved = resolveImportSpecifierBytes(importerBytes, specifier);
      if (resolved === null) {
        return { kind: "outside-root" };
      }
      // SPEC 2.1: `DIR/NAME.xspec` designates `DIR/NAME.mdx`.
      const designated = new Uint8Array(
        resolved.length - XSPEC_SUFFIX_LENGTH + MDX_SUFFIX_BYTES.length,
      );
      designated.set(
        resolved.subarray(0, resolved.length - XSPEC_SUFFIX_LENGTH),
      );
      designated.set(MDX_SUFFIX_BYTES, resolved.length - XSPEC_SUFFIX_LENGTH);
      return SpecSourceDomain.memberDesignation(
        this.byKey.get(pathTextKey(pathTextOf(designated))),
        () => renderPathText(pathTextOf(designated)),
      );
    };
  }
}

/** SPEC 2.1: the compiler-provided names an import may never bind. */
const COMPILER_PROVIDED_NAMES: ReadonlySet<string> = new Set([
  "S",
  "Spec",
  "text",
]);

const XSPEC_SUFFIX = ".xspec";

/** Translates analyzer spans of one re-parsed slice into byte ranges. */
class SpanTranslator {
  private readonly baseIndex: number;

  constructor(
    private readonly offsets: Utf8Offsets,
    sliceStartByte: number,
  ) {
    this.baseIndex = offsets.indexOfByteOffset(sliceStartByte);
  }

  range(span: TextSpan): ByteRange {
    return {
      start: this.offsets.byteOffset(this.baseIndex + span.start),
      end: this.offsets.byteOffset(this.baseIndex + span.end),
    };
  }
}

/** Every identifier an import clause binds, in written order. */
function boundIdentifiers(clause: ts.ImportClause | undefined): string[] {
  if (clause === undefined) {
    return [];
  }
  const names: string[] = [];
  if (clause.name !== undefined) {
    names.push(clause.name.text);
  }
  const bindings = clause.namedBindings;
  if (bindings !== undefined) {
    if (ts.isNamespaceImport(bindings)) {
      names.push(bindings.name.text);
    } else {
      for (const element of bindings.elements) {
        names.push(element.name.text);
      }
    }
  }
  return names;
}

/**
 * Analyze and validate one file's spec-module imports (SPEC 2.1 →
 * 14.15). `designate` resolves an in-form specifier against the importing
 * file and answers membership over the entire discovered spec-source set
 * (SPEC 7.1, `SpecSourceDomain`): an import must designate a discovered
 * member — whether the designated file parses does not matter here
 * (references through it report as unresolved, SPEC 14.20, 14.5–14.7),
 * and a member whose own path is invalid (SPEC 14.19) is designated
 * validly, its identities all undefined (SPEC 11.2). Each invalid import
 * yields exactly one 14.15 finding listing its defects; an identifier
 * bound by more than one import (SPEC 2.1: no two imports in a file may
 * bind the same identifier) yields ONE 14.15 finding locating every
 * colliding declaration, the first included (SPEC 14 cardinality).
 */
export function analyzeSpecImports(
  document: SpecDocument,
  designate: DesignateSpecifier,
): SpecImportModel {
  const imports: SpecImport[] = [];
  const bindings = new Map<string, SpecImportBinding>();
  const findings: Finding[] = [];
  /** name → the distinct import declarations binding it (duplicate rule). */
  const declarationsByName = new Map<string, SpecImportStatement[]>();

  for (const block of document.esmBlocks) {
    for (const statement of block.imports) {
      const parsed = parseImportStatement(statement.text);
      const translate = new SpanTranslator(
        document.offsets,
        statement.range.start,
      );
      const defects: string[] = [];

      // Binding form (SPEC 2.1: the only permitted form is a single
      // default binding; named, namespace, and side-effect-only imports
      // are invalid).
      const clause = parsed.importClause;
      const names = boundIdentifiers(clause);
      if (clause === undefined) {
        defects.push(
          "it is a side-effect-only import binding nothing — the only " +
            "permitted form is a single default binding",
        );
      } else {
        if (clause.isTypeOnly) {
          defects.push("it is a type-only import");
        }
        const named = clause.namedBindings;
        if (named !== undefined) {
          defects.push(
            ts.isNamespaceImport(named)
              ? "it uses a namespace-import binding — the only permitted " +
                  "form is a single default binding"
              : "it uses named-import bindings — the only permitted form " +
                  "is a single default binding",
          );
        }
      }
      if (parsed.attributes !== undefined) {
        defects.push("it carries import attributes");
      }

      // The specifier (SPEC 2.1: relative, `./` or `../`, ending
      // `.xspec`, designating a discovered spec-group source).
      const specifierLiteral = parsed.moduleSpecifier;
      if (!ts.isStringLiteral(specifierLiteral)) {
        throw new Error(
          "xspec internal error: import with a non-literal specifier",
        );
      }
      const specifier = specifierLiteral.text;
      const relative =
        specifier.startsWith("./") || specifier.startsWith("../");
      if (!relative) {
        defects.push(
          `the specifier ${JSON.stringify(specifier)} is not a relative ` +
            `path beginning with "./" or "../"`,
        );
      }
      if (!specifier.endsWith(XSPEC_SUFFIX)) {
        defects.push(
          `the specifier ${JSON.stringify(specifier)} does not end in ` +
            `".xspec"`,
        );
      }
      let targetPath: string | null = null;
      let targetFile: PathText | null = null;
      let undefinedTarget: PathText | null = null;
      if (relative && specifier.endsWith(XSPEC_SUFFIX)) {
        const designation = designate(specifier);
        if (designation.kind === "outside-root") {
          defects.push(
            `the specifier ${JSON.stringify(specifier)} resolves outside ` +
              `the workspace root`,
          );
        } else if (designation.kind === "undiscovered") {
          defects.push(
            `the designated file ${JSON.stringify(designation.designated)} ` +
              `is not a discovered source file of a configured spec group`,
          );
        } else if (designation.kind === "defined-member") {
          targetPath = designation.path;
          targetFile = designation.path;
        } else {
          // SPEC 14.19/11.2: a discovered member whose path is invalid is
          // designated validly — no 14.15 — while its identities are all
          // undefined, so references rooted at this binding never resolve.
          targetFile = designation.file;
          undefinedTarget = designation.file;
        }
      }

      // SPEC 2.1: no import may bind `S`, `Spec`, or `text` — the
      // compiler-provided names are never shadowed.
      for (const name of names) {
        if (COMPILER_PROVIDED_NAMES.has(name)) {
          defects.push(
            `it binds the compiler-provided identifier ` +
              `${JSON.stringify(name)} — "S", "Spec", and "text" are ` +
              `never shadowed`,
          );
        }
      }

      const valid = defects.length === 0;
      if (!valid) {
        // SPEC 14.15: one finding per invalid import, listing its defects.
        findings.push(
          locatedFinding(
            15,
            `invalid import: ${defects.join("; ")} — the only permitted ` +
              `import is a single default binding of a relative "./"/"../" ` +
              `specifier ending in ".xspec" that designates a discovered ` +
              `spec-group file, e.g. import BASE from "./BASE.xspec" ` +
              `(SPEC 2.1, 14.15)`,
            [{ file: document.file, range: statement.range }],
          ),
        );
        targetPath = null;
        targetFile = null;
        undefinedTarget = null;
      }

      // SPEC 2.1: no two imports in a file may bind the same identifier —
      // declarations are recorded here and the collision judged once every
      // declaration is seen (SPEC 14 cardinality: one finding locating
      // every colliding declaration).
      for (const name of names) {
        const declared = declarationsByName.get(name);
        if (declared === undefined) {
          declarationsByName.set(name, [statement]);
          bindings.set(
            name,
            valid && name === clause?.name?.text
              ? targetPath !== null
                ? { kind: "module", targetPath }
                : undefinedTarget !== null
                  ? { kind: "undefined-module", modulePath: undefinedTarget }
                  : { kind: "poisoned" }
              : { kind: "poisoned" },
          );
        } else if (!declared.includes(statement)) {
          declared.push(statement);
        }
      }

      const quoteCharacter =
        statement.text[specifierLiteral.getStart(parsed.sourceFile)];
      imports.push({
        statement,
        bindingName: clause?.name !== undefined ? clause.name.text : null,
        specifier,
        specifierQuote: quoteCharacter === "'" ? "'" : '"',
        specifierRange: translate.range({
          start: specifierLiteral.getStart(parsed.sourceFile),
          end: specifierLiteral.getEnd(),
        }),
        targetPath,
        targetFile,
        valid,
      });
    }
  }

  // SPEC 2.1 → 14.15: an identifier bound by more than one import is one
  // condition the declarations jointly violate — ONE finding per collided
  // identifier, locating every colliding declaration (SPEC 14: no
  // representative is chosen); the identifier's binding is poisoned, so
  // references rooted at it are masked (SPEC 14).
  for (const [name, declared] of declarationsByName) {
    if (declared.length < 2) continue;
    findings.push(
      locatedFinding(
        15,
        `invalid import: the identifier ${JSON.stringify(name)} is bound ` +
          `by ${String(declared.length)} imports in this file — no two ` +
          `imports in an xspec source file may bind the same identifier; ` +
          `rename all but one binding (SPEC 2.1, 14.15)`,
        declared.map((decl) => ({ file: document.file, range: decl.range })),
      ),
    );
    bindings.set(name, { kind: "poisoned" });
  }

  return {
    imports,
    bindings,
    findings: sortFindings(findings),
  };
}

/** The parsed shape of one recorded import statement's exact text. */
interface ParsedImport {
  readonly sourceFile: ts.SourceFile;
  readonly importClause: ts.ImportClause | undefined;
  readonly moduleSpecifier: ts.Expression;
  readonly attributes: ts.ImportAttributes | undefined;
}

/** Re-parse one import declaration's exact text (positions are local). */
function parseImportStatement(text: string): ParsedImport {
  const sourceFile = ts.createSourceFile(
    "xspec-import.ts",
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const statement =
    sourceFile.statements.length === 1 ? sourceFile.statements[0] : undefined;
  if (statement === undefined || !ts.isImportDeclaration(statement)) {
    throw new Error(
      "xspec internal error: recorded import statement did not re-parse " +
        "as an import declaration",
    );
  }
  return {
    sourceFile,
    importClause: statement.importClause,
    moduleSpecifier: statement.moduleSpecifier,
    attributes: statement.attributes,
  };
}

// ---------------------------------------------------------------------------
// The reference model (SPEC 2.2–2.4)
// ---------------------------------------------------------------------------

/** Where a reference points, for graph resolution (SPEC 2.2, 5.2). */
export type ReferenceTarget =
  | {
      /** Local form: a string literal naming an ID path in this file. */
      readonly kind: "local";
      /** The named ID path — the whole dotted path (SPEC 2.2, T2.4-4). */
      readonly idPath: string;
    }
  | {
      /** External form: a chain rooted at an imported spec module. */
      readonly kind: "external";
      /** The imported module's designated source path (SPEC 2.1). */
      readonly modulePath: string;
      /**
       * The chain's segment names, in order; empty for the module
       * itself, targeting that file's root node (SPEC 2.2). Matched as a
       * segment sequence — never joined and re-split — so a segment
       * containing `.` resolves to nothing (SPEC 2.4, 1.4).
       */
      readonly segments: readonly string[];
    };

/** One chain segment's spelling, for in-place rewrites (SPEC 6.4). */
export interface SegmentSpelling {
  readonly name: string;
  /** Dot access (`.login`) or computed access (`["login-v2"]`). */
  readonly access: "dot" | "computed";
  /** The index literal's quote — null for dot access (SPEC 6.4). */
  readonly quote: '"' | "'" | null;
  /** The name token: the identifier, or the index literal with quotes. */
  readonly nameRange: ByteRange;
  /** The whole access, from just past the base through its last byte. */
  readonly accessRange: ByteRange;
}

/**
 * A reference's exact spelling (SPEC 6.4: rewrites are minimal in-place
 * edits preserving quote style and access form).
 */
export type ReferenceSpelling =
  | {
      readonly form: "string";
      readonly quote: '"' | "'";
      /** The string literal's characters, quotes included. */
      readonly range: ByteRange;
    }
  | {
      readonly form: "chain";
      /** The root import binding as written. */
      readonly rootName: string;
      /** The root identifier token. */
      readonly rootRange: ByteRange;
      readonly segments: readonly SegmentSpelling[];
    };

/** One extracted static reference (SPEC 2.2, 2.3). */
export interface SpecReference {
  readonly target: ReferenceTarget;
  readonly spelling: ReferenceSpelling;
  /** The whole reference expression's bytes (finding locations). */
  readonly range: ByteRange;
}

/** One `d` reference with its declaring section (SPEC 2.2). */
export interface DependencyReference {
  readonly section: SpecSection;
  readonly reference: SpecReference;
}

/**
 * One `{text(...)}` embedding's analysis (SPEC 2.3). `reference` is null
 * when the embedding yields none: a 14.8 finding accounts for it, or its
 * chain root is a poisoned import binding (masked, SPEC 14).
 */
export interface EmbeddingReference {
  readonly embedding: SpecEmbedding;
  readonly reference: SpecReference | null;
}

/** The extracted references of one xspec source file (SPEC 2.2–2.4). */
export interface SpecReferenceModel {
  /** Every extracted `d` reference, in document order (SPEC 2.2). */
  readonly dependencies: readonly DependencyReference[];
  /** Every embedding with its analysis, in document order (SPEC 2.3). */
  readonly embeddings: readonly EmbeddingReference[];
  /** The 14.8 findings (SPEC 2.4), ordered by location. */
  readonly findings: readonly Finding[];
}

/** How one classified expression resolved as a reference. */
type ResolvedReference =
  | { readonly outcome: "reference"; readonly reference: SpecReference }
  | { readonly outcome: "finding"; readonly finding: Finding }
  | {
      /**
       * A chain rooted at a valid import of a member whose path is
       * invalid (SPEC 14.19): every identity of that file is undefined
       * (SPEC 11.2), so the reference never resolves — the caller reports
       * its 14.5/14.6 with the span rules of its construct kind.
       */
      readonly outcome: "undefined-target";
      readonly modulePath: PathText;
      readonly segments: readonly string[];
      readonly span: TextSpan;
    }
  | { readonly outcome: "masked" };

/** A human description of an undefined-member target (messages only). */
function describeUndefinedTarget(
  modulePath: PathText,
  segments: readonly string[],
): string {
  const display = renderPathText(modulePath);
  if (segments.length === 0) {
    // SPEC 2.2: the module itself targets that file's root node.
    return `the root node of ${JSON.stringify(display)}`;
  }
  return JSON.stringify(`${display}#${segments.join(".")}`);
}

/** The SPEC 14.19/11.2 reason an undefined-member reference never resolves. */
const UNDEFINED_TARGET_REASON =
  `no identity of the designated file is defined because its own path is ` +
  `invalid (SPEC 14.19, 11.2); rename that file to a valid source path or ` +
  `retarget the reference`;

/**
 * Extract the file's references (SPEC 2.2, 2.3) through the shared
 * static-reference analyzer (SPEC 2.4). Every `d` reference and
 * embedding argument is classified; dynamic ones report 14.8, chains
 * rooted at poisoned bindings are masked (SPEC 14), and the rest are
 * recorded with target, spelling, and spans. Resolution against declared
 * IDs — and duplicate-target collapse (SPEC 2.2, 5.2) — happens in the
 * graph, which reports 14.5/14.6 for unknown targets.
 */
export function analyzeSpecReferences(
  document: SpecDocument,
  importModel: SpecImportModel,
): SpecReferenceModel {
  const analyzer = new ReferenceAnalyzer(document, importModel.bindings);
  const dependencies: DependencyReference[] = [];
  for (const section of document.sections) {
    const dependency = section.dependency;
    if (dependency === null) {
      continue;
    }
    for (const reference of analyzer.analyzeDependencyValue(dependency)) {
      dependencies.push({ section, reference });
    }
  }
  const embeddings: EmbeddingReference[] = [];
  for (const embedding of document.embeddings) {
    embeddings.push({
      embedding,
      reference: analyzer.analyzeEmbedding(embedding),
    });
  }
  return {
    dependencies,
    embeddings,
    findings: sortFindings(analyzer.findings),
  };
}

/** The per-file analysis worker behind `analyzeSpecReferences`. */
class ReferenceAnalyzer {
  readonly findings: Finding[] = [];

  constructor(
    private readonly document: SpecDocument,
    private readonly bindings: ReadonlyMap<string, SpecImportBinding>,
  ) {}

  private addFinding(range: ByteRange, message: string): void {
    this.findings.push(
      locatedFinding(8, message, [{ file: this.document.file, range }]),
    );
  }

  /**
   * SPEC 2.2: a `d` value is a single reference or an array literal of
   * references, external and local forms mixed freely; `d={[]}` declares
   * no dependencies. Any other value is a dynamic argument (SPEC 2.7 →
   * 14.8), as is any dynamic element (SPEC 2.4).
   */
  analyzeDependencyValue(dependency: {
    readonly expressionText: string;
    readonly expressionRange: ByteRange;
    readonly attributeRange: ByteRange;
  }): SpecReference[] {
    const { sourceFile, expression } = parseExpressionText(
      dependency.expressionText,
    );
    if (expression === null) {
      // Not a single expression at all (an object literal parses as a
      // block, for instance): a dynamic argument (SPEC 2.7 → 14.8).
      this.addFinding(
        dependency.attributeRange,
        `invalid argument: the d value is not a static reference or an ` +
          `array literal of static references — it is a dynamic argument ` +
          `(SPEC 2.2, 2.7, 2.4, 14.8)`,
      );
      return [];
    }
    const translate = new SpanTranslator(
      this.document.offsets,
      dependency.expressionRange.start,
    );
    const references: SpecReference[] = [];
    const elements = ts.isArrayLiteralExpression(expression)
      ? expression.elements
      : [expression];
    for (const element of elements) {
      if (ts.isOmittedExpression(element)) {
        // An array hole is no reference (SPEC 2.2 → 14.8).
        this.addFinding(
          translate.range({
            start: expression.getStart(sourceFile),
            end: expression.getEnd(),
          }),
          `invalid argument: the d array contains an elided element — ` +
            `each element must be a static reference (SPEC 2.2, 2.4, 14.8)`,
        );
        continue;
      }
      if (ts.isSpreadElement(element)) {
        this.addFinding(
          translate.range({
            start: element.getStart(sourceFile),
            end: element.getEnd(),
          }),
          `invalid argument: a spread element is not a static reference ` +
            `(SPEC 2.2, 2.4, 14.8)`,
        );
        continue;
      }
      const resolved = this.resolveClassified(
        classifyReference(element, sourceFile),
        translate,
        `each d reference must be a static string literal naming a ` +
          `same-file ID or a static property chain rooted at an imported ` +
          `spec module (SPEC 2.2, 2.4, 14.8)`,
      );
      if (resolved.outcome === "reference") {
        references.push(resolved.reference);
      } else if (resolved.outcome === "finding") {
        this.findings.push(resolved.finding);
      } else if (resolved.outcome === "undefined-target") {
        // SPEC 14.5: a d reference that does not resolve — here into a
        // member whose identities are all undefined (SPEC 14.19, 11.2).
        // The finding spans the reference's own expression (SPEC 14).
        this.findings.push(
          locatedFinding(
            5,
            `unknown dependency: the d reference to ` +
              `${describeUndefinedTarget(resolved.modulePath, resolved.segments)} ` +
              `does not resolve — ${UNDEFINED_TARGET_REASON} (SPEC 2.2, 14.5)`,
            [
              {
                file: this.document.file,
                range: translate.range(resolved.span),
              },
            ],
          ),
        );
      }
    }
    return references;
  }

  /**
   * SPEC 2.3, 2.4: an embedding is a `text(...)` call with exactly one
   * argument, following the same external/local duality as `d`.
   */
  analyzeEmbedding(embedding: SpecEmbedding): SpecReference | null {
    const { sourceFile, expression } = parseExpressionText(
      embedding.expressionText,
    );
    const call =
      expression !== null &&
      ts.isCallExpression(expression) &&
      expression.questionDotToken === undefined &&
      expression.typeArguments === undefined &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "text"
        ? expression
        : null;
    if (call === null) {
      // The document model only records `text(...)` calls as embeddings;
      // a shape the analyzer cannot accept (an optional call, say) is a
      // dynamic form (SPEC 2.4 → 14.8).
      this.addFinding(
        embedding.range,
        `invalid argument: the embedding is not a plain text(...) call ` +
          `(SPEC 2.3, 2.4, 14.8)`,
      );
      return null;
    }
    if (call.arguments.length !== 1) {
      // SPEC 2.4: a text(...) call MUST have exactly one argument.
      this.addFinding(
        embedding.range,
        `invalid argument: text(...) must be called with exactly one ` +
          `argument — this call has ${String(call.arguments.length)} ` +
          `(SPEC 2.4, 14.8)`,
      );
      return null;
    }
    const argument = call.arguments[0];
    const translate = new SpanTranslator(
      this.document.offsets,
      embedding.expressionRange.start,
    );
    if (ts.isSpreadElement(argument)) {
      // SPEC 14: a no-occurrence spelling of the MDX embedding form is
      // located by the full braced container (the span its occurrence
      // would occupy, 5.7).
      this.addFinding(
        embedding.range,
        `invalid argument: a spread element is not a static reference ` +
          `(SPEC 2.3, 2.4, 14.8)`,
      );
      return null;
    }
    const resolved = this.resolveClassified(
      classifyReference(argument, sourceFile),
      translate,
      `the text(...) argument must be a static string literal naming a ` +
        `same-file ID or a static property chain rooted at an imported ` +
        `spec module (SPEC 2.3, 2.4, 14.8)`,
      // SPEC 14: an embedding-form finding's range is the full braced
      // container — the span its occurrence would occupy (5.7).
      embedding.range,
    );
    if (resolved.outcome === "reference") {
      return resolved.reference;
    }
    if (resolved.outcome === "finding") {
      this.findings.push(resolved.finding);
    } else if (resolved.outcome === "undefined-target") {
      // SPEC 14.6: a text(...) reference that does not resolve — here
      // into a member whose identities are all undefined (SPEC 14.19,
      // 11.2). An embedding-form finding's range is the full braced
      // container — the span its occurrence would occupy (SPEC 14, 5.7).
      this.findings.push(
        locatedFinding(
          6,
          `unknown text target: the text(...) reference to ` +
            `${describeUndefinedTarget(resolved.modulePath, resolved.segments)} ` +
            `does not resolve — ${UNDEFINED_TARGET_REASON} (SPEC 2.3, 14.6)`,
          [{ file: this.document.file, range: embedding.range }],
        ),
      );
    }
    return null;
  }

  /**
   * Turn one classification into a reference, a 14.8, or a mask.
   * `containerRange` — set for a `text(...)` embedding argument — is the
   * embedding's full braced container: an embedding-form finding's range
   * is that container, the span its occurrence would occupy (SPEC 14,
   * 5.7); a `d` reference's finding keeps its own expression's span.
   */
  private resolveClassified(
    classified: ClassifiedReference,
    translate: SpanTranslator,
    expectation: string,
    containerRange: ByteRange | null = null,
  ): ResolvedReference {
    if (classified.kind === "dynamic") {
      return {
        outcome: "finding",
        finding: locatedFinding(
          8,
          `invalid argument: ${classified.reason} — ${expectation}`,
          [
            {
              file: this.document.file,
              range: containerRange ?? translate.range(classified.span),
            },
          ],
        ),
      };
    }
    if (classified.kind === "string") {
      return {
        outcome: "reference",
        reference: this.stringReference(classified, translate),
      };
    }
    const binding = this.bindings.get(classified.rootName);
    if (binding === undefined) {
      // SPEC 2.4: a chain is static only when rooted at an imported spec
      // module; a root no import binds makes the reference dynamic.
      return {
        outcome: "finding",
        finding: locatedFinding(
          8,
          `invalid argument: the property chain is rooted at ` +
            `${JSON.stringify(classified.rootName)}, which no spec-module ` +
            `import in this file binds — ${expectation}`,
          [
            {
              file: this.document.file,
              range: containerRange ?? translate.range(classified.span),
            },
          ],
        ),
      };
    }
    if (binding.kind === "undefined-module") {
      // SPEC 14.19/11.2: the import is valid, but every identity of the
      // designated file is undefined — the reference never resolves. The
      // condition (14.5/14.6) is decidable per file; the caller reports it
      // with its construct kind's span rules (SPEC 14, 5.7).
      return {
        outcome: "undefined-target",
        modulePath: binding.modulePath,
        segments: classified.segments.map((segment) => segment.name),
        span: classified.span,
      };
    }
    if (binding.kind === "poisoned") {
      // Masked (SPEC 14): the import's 14.15 makes the target
      // undetectable; no separate condition, no edge.
      return { outcome: "masked" };
    }
    return {
      outcome: "reference",
      reference: this.chainReference(classified, binding.targetPath, translate),
    };
  }

  private stringReference(
    classified: ClassifiedString,
    translate: SpanTranslator,
  ): SpecReference {
    const range = translate.range(classified.span);
    return {
      // SPEC 2.2: the local form names an ID path in the same file — the
      // whole dotted path (T2.4-4).
      target: { kind: "local", idPath: classified.value },
      spelling: { form: "string", quote: classified.quote, range },
      range,
    };
  }

  private chainReference(
    classified: ClassifiedChain,
    modulePath: string,
    translate: SpanTranslator,
  ): SpecReference {
    return {
      // SPEC 2.2: external form — zero segments target the module
      // itself, that is the file's root node.
      target: {
        kind: "external",
        modulePath,
        segments: classified.segments.map((segment) => segment.name),
      },
      spelling: {
        form: "chain",
        rootName: classified.rootName,
        rootRange: translate.range(classified.rootSpan),
        segments: classified.segments.map((segment) => ({
          name: segment.name,
          access: segment.access,
          quote: segment.quote,
          nameRange: translate.range(segment.nameSpan),
          accessRange: translate.range(segment.accessSpan),
        })),
      },
      range: translate.range(classified.span),
    };
  }
}

/** Deterministic finding order (SPEC 12.0, 12.7). */
function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(compareFindings);
}
