// TypeScript tooling driver for the xspec test harness (TEST-SPEC 4 preamble,
// 17 S-4; IMPLEMENTATION.md: type-level assertions compile fixture consumer
// files with the TypeScript compiler API and assert on diagnostics; hover and
// go-to-definition are asserted through the language-service API; runtime
// behavior of generated modules runs under plain Node with no xspec
// dependency installed — SPEC.md 13.1). Harness machinery only: this module
// never imports product code; consumer-side contracts are exercised over
// files the product wrote into a test workspace, through standard TypeScript
// tooling.
//
// - A `ConsumerProject` is a fixed set of root TypeScript files under a
//   project root, served by one TypeScript language service: the same program
//   answers diagnostics (with exact locations), go-to-definition targets, and
//   hover text, so type-level and editor-level assertions cannot drift apart.
//   The project snapshots file contents on first access — rebuild a new
//   `ConsumerProject` after changing files on disk.
// - Positions are addressed by substring markers (`locate`), never by
//   hand-maintained numbers. Offsets are UTF-16 code-unit offsets into the
//   decoded file text (the TypeScript convention, not bytes); lines and
//   columns are 1-based, with line breaks counted as TypeScript's scanner
//   does (LF, CR, CRLF, U+2028, U+2029).
// - `definitionsAt` reports the raw language-service targets;
//   `sourceDefinitionsAt` additionally applies declaration-map mapping the
//   way tsserver does for editors, which is how a target can land in a
//   non-TypeScript original such as a source `.mdx` file (SPEC.md 4.2, 13.1
//   companion files). See the interface comments below.
// - `moduleSkeleton` reads the skeleton a module exposes (SPEC.md 4.1)
//   through the same program's type checker — export names and the default
//   export's member tree, by names and nesting only — and
//   `diffModuleSkeletons` compares two such skeletons (T1.1-2: the two tag
//   names' generated modules expose the same skeleton).
// - Compiled consumers run under plain Node (`runConsumer`) through the
//   blackbox subprocess driver: `node <entry>` with the sanitized environment
//   and `NODE_PATH` dropped, so nothing outside the consumer's own files (and
//   the product-written modules beside them) can satisfy an import — SPEC.md
//   13.1's "no xspec runtime dependency", observed structurally.
// - Failure paths are loud (H-8): a missing project root or root file, an
//   unknown or ambiguous marker, and an unreadable definition target all
//   throw diagnosed errors instead of yielding empty results a test could
//   mistake for green. An import the product failed to make resolvable is a
//   diagnosed compile error (TS2307) — the red path for section 4 tests.
//
// Conservative defaults where IMPLEMENTATION.md is silent (overridable per
// project via `compilerOptions`): consumers compile `strict` for modern Node
// (target ES2022, module/moduleResolution NodeNext) with `@types/node`
// resolved from this repository's own pinned node_modules — a compile-time
// affordance that installs nothing into the consumer workspace — and emit
// with LF line endings for deterministic bytes.
//
// The standard tooling is TypeScript 5.9.3, the release SPEC.md 14.20 fixes
// (T1.4-5: never a later one), reached through the harness's own pinned
// dependency `typescript-5.9.3` (an npm alias of `typescript@5.9.3`; see
// test/vitest.config.ts) — never the product's `typescript` dependency.

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript-5.9.3";
import { fail } from "./assertions.js";
import type { ProductBinding, RunResult } from "./subprocess.js";
import { runProduct } from "./subprocess.js";

const repoRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** A position in a consumer project file. */
export interface SourcePosition {
  /** Project-relative `/`-separated path (absolute when outside the root). */
  readonly file: string;
  /** UTF-16 code-unit offset into the file text (TypeScript convention). */
  readonly offset: number;
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column (UTF-16 code units from the line start). */
  readonly column: number;
}

/** A file position addressable without line/column (what queries need). */
export interface FileOffset {
  readonly file: string;
  readonly offset: number;
}

/** One TypeScript diagnostic, mapped to harness-comparable data. */
export interface ConsumerDiagnostic {
  /** Project-relative file, absent for options/global diagnostics. */
  readonly file?: string;
  /** Start of the reported span, absent when the diagnostic has none. */
  readonly start?: SourcePosition;
  /** Length of the reported span in UTF-16 code units. */
  readonly length?: number;
  /** TypeScript error code (e.g. 2345). */
  readonly code: number;
  readonly category: "error" | "warning" | "suggestion" | "message";
  /** Flattened message chain, newline-joined. */
  readonly message: string;
}

/** One go-to-definition target. */
export interface DefinitionTarget {
  readonly file: string;
  /** Start of the declaration-name span. */
  readonly start: SourcePosition;
  readonly length: number;
  /** Declared name. */
  readonly name: string;
  /** TypeScript script-element kind (e.g. "function", "const"). */
  readonly kind: string;
}

/**
 * One go-to-definition target as an editor presents it: the raw
 * language-service target, mapped through a declaration map (`.d.ts.map`)
 * into its original source when the declaring file carries one — the
 * mechanism SPEC.md 13.1 companion files use to make go-to-definition
 * resolve into a source `.mdx` file (SPEC.md 4.2). See
 * {@link ConsumerProject.sourceDefinitionsAt}.
 */
export interface SourceDefinitionTarget {
  /** Project-relative mapped file (absolute when outside the root). */
  readonly file: string;
  /** Start of the mapped span in the mapped file. */
  readonly start: SourcePosition;
  /** True when a declaration map moved the target out of `raw.file`. */
  readonly mapped: boolean;
  /** The unmapped language-service target (name, kind, raw file/span). */
  readonly raw: DefinitionTarget;
}

/** A file/offset pair exchanged with the language service's source mapper. */
interface DocumentPosition {
  readonly fileName: string;
  readonly pos: number;
}

/**
 * The language service's declaration-map source mapper. The method is
 * `@internal` (absent from the public type declarations) but present at
 * runtime in the pinned TypeScript version, and it is the exact machinery
 * tsserver uses to land editor go-to-definition in original sources; the S-4
 * self-test pins its availability and behavior, so a TypeScript upgrade that
 * drops it fails loudly there, never as a mysterious product-test failure.
 */
interface InternalSourceMapper {
  tryGetSourcePosition(
    position: DocumentPosition,
  ): DocumentPosition | undefined;
}

/** Hover (quick info) at a position. */
export interface HoverInfo {
  /** Signature/display text, display parts joined. */
  readonly display: string;
  /** Documentation text, parts joined (SPEC.md 4.2 hover documentation). */
  readonly documentation: string;
  /** The hovered span. */
  readonly start: SourcePosition;
  readonly length: number;
}

export interface EmitResult {
  readonly emitSkipped: boolean;
  /** Written files, project-relative, sorted. */
  readonly emittedFiles: readonly string[];
  readonly diagnostics: readonly ConsumerDiagnostic[];
}

/** One member of a module's exposed skeleton (`moduleSkeleton`). */
export interface SkeletonMember {
  /**
   * The member's step in an access chain: `.name` for a property whose name
   * is a plain ASCII identifier, `["name"]` (JSON-quoted) for any other
   * property name, the name TypeScript displays for a symbol-keyed property
   * (`[XSPEC_BRAND]`, `[Symbol.iterator]`) or `.#name` for a private one,
   * `[<K>]` for an index signature whose key type is `K`, `()` for a type's
   * call signatures, and `(new)` for its construct signatures. A step two
   * members of one type share takes `@2`, `@3`, … in declaration order.
   */
  readonly segment: string;
  /**
   * The members of the member's type, sorted by segment, when the member was
   * expanded (possibly none); absent for a leaf — a member declared only
   * outside the module's own files, call and construct signatures, and a
   * member whose expansion stopped.
   */
  readonly members?: readonly SkeletonMember[];
  /**
   * Set when an expandable member (one whose type has members) was not
   * expanded: its type is already being expanded on the path from the root
   * (`"cycle"`), or the member lies at the depth bound (`"depth"`).
   */
  readonly stopped?: "cycle" | "depth";
}

/** A module's exposed skeleton (`ConsumerProject.moduleSkeleton`). */
export interface ModuleSkeleton {
  /** The module file, project-relative. */
  readonly module: string;
  /** Every export name, sorted. */
  readonly exports: readonly string[];
  /**
   * The default export's members, sorted by segment; absent when the module
   * has no default export.
   */
  readonly defaultExport?: readonly SkeletonMember[];
}

export interface ModuleSkeletonOptions {
  /**
   * Whether a program file is one of the module's own files — for a
   * product's generated module, the module and its companions (SPEC.md
   * 13.1). Receives the project-relative path with `/` separators, or the
   * absolute path of a file outside the project root.
   */
  readonly isOwnFile: (file: string) => boolean;
  /**
   * The depth bound (default 16): a member at this depth (the default
   * export's own members are at depth 1) is not expanded.
   */
  readonly maxDepth?: number;
  /** Prefix for failure diagnoses. */
  readonly context?: string;
}

/** Differences between two module skeletons (`diffModuleSkeletons`). */
export interface ModuleSkeletonDifference {
  /**
   * What the first skeleton exposes alone, topmost only (nothing below an
   * entry is listed): `export <name>` for an export name, and an access
   * chain rooted at the given root name for a member of the default export,
   * a member whose expansion stopped carrying the reason.
   */
  readonly onlyInA: readonly string[];
  /** The same for the second skeleton. */
  readonly onlyInB: readonly string[];
}

/**
 * Defaults for consumer compilation (see the module header for the
 * rationale). Returned fresh so callers can spread-and-override freely.
 */
export function defaultConsumerCompilerOptions(): ts.CompilerOptions {
  return {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    types: ["node"],
    typeRoots: [path.join(repoRoot, "node_modules", "@types")],
    newLine: ts.NewLineKind.LineFeed,
  };
}

export interface ConsumerProjectOptions {
  /** Absolute path of the consumer project root. */
  readonly rootDir: string;
  /**
   * Root files, project-relative with `/` separators. Imports are resolved
   * transitively as usual; diagnostics cover every program file.
   */
  readonly rootFiles: readonly string[];
  /** Merged over `defaultConsumerCompilerOptions()`. */
  readonly compilerOptions?: ts.CompilerOptions;
}

/**
 * A consumer TypeScript project under standard tooling: compile diagnostics,
 * go-to-definition, hover, and emit, all answered by one language service
 * (IMPLEMENTATION.md: compiler API for diagnostics, language-service API for
 * editor guarantees).
 */
export class ConsumerProject {
  readonly rootDir: string;
  readonly compilerOptions: ts.CompilerOptions;

  readonly #rootFilesAbs: readonly string[];
  readonly #service: ts.LanguageService;
  readonly #readCached: (fileName: string) => string | undefined;

  /**
   * Validate and open a project. A missing root directory or root file is a
   * diagnosed error here rather than a confusing empty program later (H-8).
   */
  static async load(options: ConsumerProjectOptions): Promise<ConsumerProject> {
    if (!path.isAbsolute(options.rootDir)) {
      throw new Error(
        `consumer project root must be an absolute path (H-1), got ${JSON.stringify(options.rootDir)}`,
      );
    }
    const rootStats = await fsp.stat(options.rootDir).catch(() => undefined);
    if (!rootStats?.isDirectory()) {
      throw new Error(
        `consumer project root does not exist or is not a directory: ${options.rootDir}`,
      );
    }
    if (options.rootFiles.length === 0) {
      throw new Error(
        `consumer project needs at least one root file (rootDir: ${options.rootDir})`,
      );
    }
    for (const rel of options.rootFiles) {
      const abs = path.resolve(options.rootDir, rel);
      const stats = await fsp.stat(abs).catch(() => undefined);
      if (!stats?.isFile()) {
        throw new Error(
          `consumer project root file missing: ${rel} (resolved: ${abs}). ` +
            `Root files are the consumer sources a test stages itself; a product-written ` +
            `module a consumer imports need not be listed — its absence surfaces as a ` +
            `diagnosed TS2307 compile error instead (H-8).`,
        );
      }
    }
    return new ConsumerProject(options);
  }

  private constructor(options: ConsumerProjectOptions) {
    this.rootDir = options.rootDir;
    this.compilerOptions = {
      ...defaultConsumerCompilerOptions(),
      ...options.compilerOptions,
    };
    this.#rootFilesAbs = options.rootFiles.map((rel) =>
      path.resolve(options.rootDir, rel),
    );

    // Snapshot-on-first-access cache shared by the language service and
    // `locate`, so positions and program contents can never disagree.
    const snapshots = new Map<string, string | undefined>();
    this.#readCached = (fileName: string): string | undefined => {
      if (!snapshots.has(fileName)) {
        snapshots.set(fileName, ts.sys.readFile(fileName));
      }
      return snapshots.get(fileName);
    };

    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => this.compilerOptions,
      getScriptFileNames: () => [...this.#rootFilesAbs],
      getScriptVersion: () => "0",
      getScriptSnapshot: (fileName) => {
        const text = this.#readCached(fileName);
        return text === undefined
          ? undefined
          : ts.ScriptSnapshot.fromString(text);
      },
      getCurrentDirectory: () => this.rootDir,
      getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
      fileExists: ts.sys.fileExists,
      readFile: this.#readCached,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    };
    this.#service = ts.createLanguageService(host, ts.createDocumentRegistry());
  }

  /** All pre-emit diagnostics (syntactic, semantic, options), sorted. */
  diagnostics(): readonly ConsumerDiagnostic[] {
    const raw = ts.getPreEmitDiagnostics(this.#program());
    return raw
      .map((diagnostic) => this.#convertDiagnostic(diagnostic))
      .sort(compareDiagnostics);
  }

  /** Error-category diagnostics only. */
  errors(): readonly ConsumerDiagnostic[] {
    return this.diagnostics().filter((d) => d.category === "error");
  }

  /**
   * Address a position by a substring marker. Fails loudly on an unknown
   * marker; a marker occurring more than once requires an explicit
   * `index` (0-based occurrence). `charOffset` advances within the marker
   * (e.g. to land on an identifier after a keyword prefix).
   */
  locate(
    fileRef: string,
    needle: string,
    options: { readonly index?: number; readonly charOffset?: number } = {},
  ): SourcePosition {
    if (needle === "") {
      fail(`locate: the marker must be a non-empty substring (${fileRef})`);
    }
    const abs = this.#absPath(fileRef);
    const text = this.#readCached(abs);
    if (text === undefined) {
      fail(
        `locate: file not readable: ${abs} (marker ${JSON.stringify(needle)})`,
      );
    }
    const occurrences: number[] = [];
    for (
      let at = text.indexOf(needle);
      at !== -1;
      at = text.indexOf(needle, at + 1)
    ) {
      occurrences.push(at);
    }
    if (occurrences.length === 0) {
      fail(
        `locate: marker not found in ${fileRef}: ${JSON.stringify(needle)} — ` +
          `position markers must match the file text exactly`,
      );
    }
    if (options.index === undefined && occurrences.length > 1) {
      fail(
        `locate: ambiguous marker in ${fileRef}: ${JSON.stringify(needle)} occurs ` +
          `${occurrences.length} times — pass { index } to pick one explicitly`,
      );
    }
    const base = occurrences[options.index ?? 0];
    if (base === undefined) {
      fail(
        `locate: marker index ${options.index} out of range in ${fileRef}: ` +
          `${JSON.stringify(needle)} occurs ${occurrences.length} time(s)`,
      );
    }
    const offset = base + (options.charOffset ?? 0);
    return positionInText(this.#describePath(abs), text, offset);
  }

  /** Go-to-definition targets at a position (empty when there are none). */
  definitionsAt(position: FileOffset): readonly DefinitionTarget[] {
    const abs = this.#absPath(position.file);
    const infos =
      this.#service.getDefinitionAtPosition(abs, position.offset) ?? [];
    return infos.map((info) => {
      const text = this.#readCached(info.fileName);
      if (text === undefined) {
        fail(
          `go-to-definition target is not readable: ${info.fileName} ` +
            `(from ${position.file} offset ${position.offset})`,
        );
      }
      const file = this.#describePath(info.fileName);
      return {
        file,
        start: positionInText(file, text, info.textSpan.start),
        length: info.textSpan.length,
        name: info.name,
        kind: String(info.kind),
      };
    });
  }

  /**
   * Go-to-definition targets at a position as standard editor tooling
   * presents them (SPEC.md 4.2, 13.1): each raw language-service target is
   * mapped through the declaring file's declaration map when it has one —
   * raw `getDefinitionAtPosition` alone can only land in program files, so
   * without this tsserver-equivalent mapping step no product could ever
   * satisfy "go-to-definition resolves into the source `.mdx` file". Targets
   * whose declaring file carries no mapping are returned unmapped
   * (`mapped: false`), so assertions on the mapped file fail diagnosed
   * rather than erroring when a product provides no mapping (H-8).
   */
  sourceDefinitionsAt(position: FileOffset): readonly SourceDefinitionTarget[] {
    const raws = this.definitionsAt(position);
    if (raws.length === 0) return [];
    const mapper = this.#sourceMapper();
    return raws.map((raw) => {
      const rawAbs = this.#absPath(raw.file);
      const mapped = mapper.tryGetSourcePosition({
        fileName: rawAbs,
        pos: raw.start.offset,
      });
      if (mapped === undefined || sameNormalizedPath(mapped.fileName, rawAbs)) {
        return { file: raw.file, start: raw.start, mapped: false, raw };
      }
      const text = this.#readCached(mapped.fileName);
      if (text === undefined) {
        fail(
          `declaration-mapped definition target is not readable: ${mapped.fileName} ` +
            `(mapped from ${raw.file} offset ${raw.start.offset})`,
        );
      }
      const file = this.#describePath(mapped.fileName);
      return {
        file,
        start: positionInText(file, text, mapped.pos),
        mapped: true,
        raw,
      };
    });
  }

  /** Hover (quick info) at a position, or undefined when there is none. */
  hoverAt(position: FileOffset): HoverInfo | undefined {
    const abs = this.#absPath(position.file);
    const info = this.#service.getQuickInfoAtPosition(abs, position.offset);
    if (!info) return undefined;
    const text = this.#readCached(abs);
    if (text === undefined) {
      fail(`hover: file not readable: ${abs}`);
    }
    return {
      display: ts.displayPartsToString(info.displayParts),
      documentation: ts.displayPartsToString(info.documentation),
      start: positionInText(this.#describePath(abs), text, info.textSpan.start),
      length: info.textSpan.length,
    };
  }

  /**
   * The skeleton a module file of this program exposes (SPEC.md 4.1), read
   * through TypeScript's checker: the module's export names, and its default
   * export's member tree — every property (methods included) by name, every
   * index signature by its key type, and call or construct signatures by
   * their presence. A member declared in one of the module's own files
   * (`isOwnFile`), or a synthetic one with no declaration (a mapped type's
   * property, a tuple element), is expanded into its type's members (its
   * non-nullable type); a member declared only elsewhere (TypeScript's lib,
   * an installed package, another project file) is a leaf recorded by name.
   * Expansion stops, marked, at a type already on the path from the root
   * (a cycle) and at the depth bound. Names and nesting only: no type or
   * interface name is recorded (H-4), so two modules declaring the same
   * tree under different declaration names expose equal skeletons
   * (`diffModuleSkeletons`). A module file outside the program, or a file
   * that is no module, fails diagnosed (H-8).
   */
  moduleSkeleton(
    moduleFile: string,
    options: ModuleSkeletonOptions,
  ): ModuleSkeleton {
    const context = options.context ?? "module skeleton";
    const maxDepth = options.maxDepth ?? DEFAULT_SKELETON_DEPTH_BOUND;
    if (!Number.isInteger(maxDepth) || maxDepth < 1) {
      throw new Error(
        `moduleSkeleton: maxDepth must be a positive integer, got ${String(options.maxDepth)}`,
      );
    }
    const program = this.#program();
    const abs = this.#absPath(moduleFile);
    const module = this.#describePath(abs);
    const sourceFile = program.getSourceFile(abs);
    if (sourceFile === undefined) {
      fail(
        `${context}: ${module} is not part of the consumer program — no root ` +
          `file is it, and no root file's imports resolve to it (SPEC 4, 13.1)`,
      );
    }
    const checker = program.getTypeChecker();
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (moduleSymbol === undefined) {
      fail(
        `${context}: ${module} is no module — TypeScript reads no import or ` +
          `export in it (SPEC 4)`,
      );
    }
    const exportSymbols = checker.getExportsOfModule(moduleSymbol);
    const exports = exportSymbols
      .map((symbol) => symbol.getName())
      .sort(compareCodeUnits);
    const defaultSymbol = exportSymbols.find(
      (symbol) => symbol.escapedName === ts.InternalSymbolName.Default,
    );
    if (defaultSymbol === undefined) return { module, exports };

    const isOwnDeclaration = (declaration: ts.Node): boolean =>
      options.isOwnFile(
        this.#describePath(declaration.getSourceFile().fileName),
      );
    const hasMembers = (type: ts.Type): boolean =>
      checker.getPropertiesOfType(type).length > 0 ||
      checker.getIndexInfosOfType(type).length > 0 ||
      checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0 ||
      checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0;
    const rootType = checker.getTypeOfSymbol(defaultSymbol);
    const onPath = new Set<ts.Type>([rootType]);
    const expand = (
      declaredType: ts.Type,
      depth: number,
    ): Pick<SkeletonMember, "members" | "stopped"> => {
      const type = checker.getNonNullableType(declaredType);
      if (!hasMembers(type)) return { members: [] };
      if (onPath.has(type)) return { stopped: "cycle" };
      if (depth >= maxDepth) return { stopped: "depth" };
      onPath.add(type);
      try {
        return { members: membersOf(type, depth + 1) };
      } finally {
        onPath.delete(type);
      }
    };
    const membersOf = (type: ts.Type, depth: number): SkeletonMember[] => {
      const members: SkeletonMember[] = [];
      for (const property of checker.getPropertiesOfType(type)) {
        const segment = propertySegment(checker, property);
        const declarations = property.declarations ?? [];
        const own =
          declarations.length === 0 || declarations.some(isOwnDeclaration);
        members.push(
          own
            ? { segment, ...expand(checker.getTypeOfSymbol(property), depth) }
            : { segment },
        );
      }
      for (const info of checker.getIndexInfosOfType(type)) {
        const keyType = checker.typeToString(
          info.keyType,
          undefined,
          ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias,
        );
        const segment = `[<${keyType}>]`;
        const own =
          info.declaration === undefined || isOwnDeclaration(info.declaration);
        members.push(
          own ? { segment, ...expand(info.type, depth) } : { segment },
        );
      }
      if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) {
        members.push({ segment: "()" });
      }
      if (
        checker.getSignaturesOfType(type, ts.SignatureKind.Construct).length > 0
      ) {
        members.push({ segment: "(new)" });
      }
      const seen = new Map<string, number>();
      return members
        .map((member) => {
          const count = (seen.get(member.segment) ?? 0) + 1;
          seen.set(member.segment, count);
          return count === 1
            ? member
            : { ...member, segment: `${member.segment}@${count}` };
        })
        .sort((x, y) => compareCodeUnits(x.segment, y.segment));
    };
    return { module, exports, defaultExport: membersOf(rootType, 1) };
  }

  /**
   * Emit the program's JavaScript (in place unless the project's
   * compilerOptions direct otherwise), returning what was written. Emitting
   * is standard tsc behavior — it proceeds even with type errors; assert
   * diagnostics separately.
   */
  emit(): EmitResult {
    const written: string[] = [];
    const result = this.#program().emit(
      undefined,
      (fileName, data, writeByteOrderMark) => {
        const abs = path.isAbsolute(fileName)
          ? fileName
          : path.resolve(this.rootDir, fileName);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        const bom = "\u{FEFF}";
        fs.writeFileSync(abs, writeByteOrderMark ? bom + data : data);
        written.push(this.#describePath(abs));
      },
    );
    return {
      emitSkipped: result.emitSkipped,
      emittedFiles: [...written].sort(),
      diagnostics: result.diagnostics
        .map((diagnostic) => this.#convertDiagnostic(diagnostic))
        .sort(compareDiagnostics),
    };
  }

  #program(): ts.Program {
    const program = this.#service.getProgram();
    if (!program) {
      throw new Error(
        `TypeScript language service produced no program for ${this.rootDir} — tooling-driver bug`,
      );
    }
    return program;
  }

  #sourceMapper(): InternalSourceMapper {
    const service = this.#service as unknown as {
      getSourceMapper?: () => InternalSourceMapper;
    };
    if (typeof service.getSourceMapper !== "function") {
      // A harness defect (never a product failure): the pinned TypeScript
      // stopped exposing its source mapper. The S-4 self-test fails first.
      throw new Error(
        "the TypeScript language service exposes no getSourceMapper() at runtime — " +
          "the pinned TypeScript version changed its internal API; " +
          "sourceDefinitionsAt (helpers/tooling.ts) needs a new mapping route " +
          "(see the S-4 declaration-map self-test).",
      );
    }
    return service.getSourceMapper();
  }

  #convertDiagnostic(diagnostic: ts.Diagnostic): ConsumerDiagnostic {
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    );
    const category = categoryName(diagnostic.category);
    if (diagnostic.file === undefined || diagnostic.start === undefined) {
      return { code: diagnostic.code, category, message };
    }
    const file = this.#describePath(diagnostic.file.fileName);
    return {
      file,
      start: positionInText(file, diagnostic.file.text, diagnostic.start),
      length: diagnostic.length,
      code: diagnostic.code,
      category,
      message,
    };
  }

  #absPath(fileRef: string): string {
    return path.isAbsolute(fileRef)
      ? path.normalize(fileRef)
      : path.resolve(this.rootDir, fileRef);
  }

  #describePath(fileName: string): string {
    const rel = path.relative(this.rootDir, fileName);
    if (
      rel === "" ||
      rel.split(/[\\/]/, 1)[0] === ".." ||
      path.isAbsolute(rel)
    ) {
      return fileName.replace(/\\/g, "/");
    }
    return rel.replace(/\\/g, "/");
  }
}

export interface RunConsumerOptions {
  /** Absolute consumer workspace directory; the run's working directory. */
  readonly dir: string;
  /** Compiled entry module, `dir`-relative (or absolute). */
  readonly entry: string;
  /** process.argv arguments after the entry path. */
  readonly argv?: readonly string[];
  /** Merged last over the sanitized environment (see subprocess driver). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly timeoutMs?: number;
}

/**
 * Run a compiled consumer program under plain Node (SPEC.md 13.1) via the
 * blackbox subprocess driver: exact exit code, separated stdout/stderr bytes,
 * hang guard. `NODE_PATH` is dropped so module resolution sees only the
 * consumer workspace's own files.
 */
export async function runConsumer(
  options: RunConsumerOptions,
): Promise<RunResult> {
  const entryAbs = path.isAbsolute(options.entry)
    ? options.entry
    : path.resolve(options.dir, options.entry);
  const binding: ProductBinding = {
    label: "compiled consumer program under plain Node (SPEC 13.1)",
    command: process.execPath,
    prefixArgs: [entryAbs],
    requiredFiles: [entryAbs],
  };
  return await runProduct(binding, {
    cwd: options.dir,
    argv: options.argv ?? [],
    env: { NODE_PATH: undefined, ...(options.env ?? {}) },
    timeoutMs: options.timeoutMs,
  });
}

/** One-line rendering of a diagnostic for failure diagnoses. */
export function formatConsumerDiagnostic(
  diagnostic: ConsumerDiagnostic,
): string {
  const where =
    diagnostic.file !== undefined && diagnostic.start !== undefined
      ? `${diagnostic.file}:${diagnostic.start.line}:${diagnostic.start.column}` +
        ` (offset ${diagnostic.start.offset}` +
        (diagnostic.length !== undefined
          ? `, length ${diagnostic.length})`
          : ")")
      : "<no location>";
  return `TS${diagnostic.code} [${diagnostic.category}] ${where}: ${diagnostic.message}`;
}

function describeAll(diagnostics: readonly ConsumerDiagnostic[]): string {
  if (diagnostics.length === 0) return "  <none>";
  return diagnostics
    .map((diagnostic) => `  ${formatConsumerDiagnostic(diagnostic)}`)
    .join("\n");
}

/** Assert the project compiles with zero error diagnostics. */
export function assertNoCompileErrors(
  project: ConsumerProject,
  context?: string,
): void {
  const errors = project.errors();
  if (errors.length > 0) {
    fail(
      `${context ?? "consumer project"}: expected a clean compile, got ` +
        `${errors.length} error(s):\n${describeAll(errors)}`,
    );
  }
}

/**
 * Assert compilation fails and the failing location is the consumer
 * reference under test (TEST-SPEC 4 preamble): some error diagnostic's span
 * covers `position` (and matches `code` when given). Returns the matched
 * diagnostic for further assertions.
 */
export function assertCompileErrorAt(
  project: ConsumerProject,
  position: SourcePosition,
  expected: {
    readonly code?: number;
    readonly messageIncludes?: readonly string[];
  } = {},
  context?: string,
): ConsumerDiagnostic {
  const errors = project.errors();
  const matches = errors.filter(
    (diagnostic) =>
      diagnostic.file === position.file &&
      diagnostic.start !== undefined &&
      diagnostic.start.offset <= position.offset &&
      position.offset <
        diagnostic.start.offset + Math.max(diagnostic.length ?? 1, 1) &&
      (expected.code === undefined || diagnostic.code === expected.code),
  );
  const wanted =
    `an error${expected.code !== undefined ? ` TS${expected.code}` : ""} at ` +
    `${position.file}:${position.line}:${position.column} (offset ${position.offset})`;
  const match = matches[0];
  if (match === undefined) {
    fail(
      `${context ?? "consumer project"}: compilation must fail with ${wanted} ` +
        `— the failing location is the consumer reference under test ` +
        `(TEST-SPEC 4). Errors reported:\n${describeAll(errors)}`,
    );
  }
  for (const needle of expected.messageIncludes ?? []) {
    if (!match.message.includes(needle)) {
      fail(
        `${context ?? "consumer project"}: the diagnostic at ${wanted} must ` +
          `mention ${JSON.stringify(needle)}; got: ${formatConsumerDiagnostic(match)}`,
      );
    }
  }
  return match;
}

const SKELETON_STOP_NOTES: Readonly<
  Record<NonNullable<SkeletonMember["stopped"]>, string>
> = {
  cycle: "(expansion stopped: cycle)",
  depth: "(expansion stopped: depth bound)",
};

/** A member's step, with the reason its expansion stopped, if it did. */
function skeletonMemberKey(member: SkeletonMember): string {
  return member.stopped === undefined
    ? member.segment
    : `${member.segment} ${SKELETON_STOP_NOTES[member.stopped]}`;
}

/**
 * Every access chain a skeleton's default export exposes, rooted at
 * `rootName` (e.g. `SPEC.login.validCredentials`), parents before their
 * members; a member whose expansion stopped carries the reason. Empty when
 * the module has no default export.
 */
export function skeletonChains(
  skeleton: ModuleSkeleton,
  rootName: string,
): string[] {
  const chains: string[] = [];
  const walk = (members: readonly SkeletonMember[], prefix: string): void => {
    for (const member of members) {
      chains.push(prefix + skeletonMemberKey(member));
      if (member.members !== undefined) {
        walk(member.members, prefix + member.segment);
      }
    }
  };
  walk(skeleton.defaultExport ?? [], rootName);
  return chains;
}

/**
 * Compare two module skeletons by names and nesting (H-4: declaration names
 * never enter a skeleton): the export names each exposes alone, and the
 * default-export members each exposes alone, topmost only — a member the
 * other skeleton lacks is listed once, by its access chain rooted at
 * `rootName`, and nothing below it. A member expanded in one skeleton and
 * stopped in the other differs too (listed on both sides). Both lists are
 * empty exactly when the skeletons are equal.
 */
export function diffModuleSkeletons(
  a: ModuleSkeleton,
  b: ModuleSkeleton,
  rootName: string,
): ModuleSkeletonDifference {
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  const exportsA = new Set(a.exports);
  const exportsB = new Set(b.exports);
  for (const name of a.exports) {
    if (!exportsB.has(name)) onlyInA.push(`export ${name}`);
  }
  for (const name of b.exports) {
    if (!exportsA.has(name)) onlyInB.push(`export ${name}`);
  }
  const walk = (
    left: readonly SkeletonMember[],
    right: readonly SkeletonMember[],
    prefix: string,
  ): void => {
    const rightByKey = new Map(
      right.map((member) => [skeletonMemberKey(member), member]),
    );
    const leftKeys = new Set(left.map(skeletonMemberKey));
    for (const member of left) {
      const key = skeletonMemberKey(member);
      const twin = rightByKey.get(key);
      if (twin === undefined) {
        onlyInA.push(prefix + key);
      } else {
        walk(member.members ?? [], twin.members ?? [], prefix + member.segment);
      }
    }
    for (const member of right) {
      const key = skeletonMemberKey(member);
      if (!leftKeys.has(key)) onlyInB.push(prefix + key);
    }
  };
  // A default export one module lacks is listed among the export names.
  if (a.defaultExport !== undefined && b.defaultExport !== undefined) {
    walk(a.defaultExport, b.defaultExport, rootName);
  }
  return { onlyInA, onlyInB };
}

/** See `ModuleSkeletonOptions.maxDepth`. */
const DEFAULT_SKELETON_DEPTH_BOUND = 16;

/**
 * A property's step in an access chain (`SkeletonMember.segment`). A
 * symbol-keyed or private property's escaped name embeds a checker-internal
 * symbol id (`__@XSPEC_BRAND@15`), which differs between programs, so its
 * step is the name TypeScript displays instead.
 */
function propertySegment(checker: ts.TypeChecker, property: ts.Symbol): string {
  const escaped = String(property.escapedName);
  if (escaped.startsWith("__@") || escaped.startsWith("__#")) {
    const shown = checker.symbolToString(property);
    return shown.startsWith("[") ? shown : `.${shown}`;
  }
  const name = property.getName();
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)
    ? `.${name}`
    : `[${JSON.stringify(name)}]`;
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function categoryName(
  category: ts.DiagnosticCategory,
): ConsumerDiagnostic["category"] {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return "error";
    case ts.DiagnosticCategory.Warning:
      return "warning";
    case ts.DiagnosticCategory.Suggestion:
      return "suggestion";
    default:
      return "message";
  }
}

function compareDiagnostics(
  a: ConsumerDiagnostic,
  b: ConsumerDiagnostic,
): number {
  const fileA = a.file ?? "";
  const fileB = b.file ?? "";
  if (fileA !== fileB) return fileA < fileB ? -1 : 1;
  const offsetA = a.start?.offset ?? -1;
  const offsetB = b.start?.offset ?? -1;
  if (offsetA !== offsetB) return offsetA - offsetB;
  if (a.code !== b.code) return a.code - b.code;
  return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
}

/**
 * Path equality for source-mapper results, which come back slash-normalized
 * while local absolute paths may carry platform separators.
 */
function sameNormalizedPath(a: string, b: string): boolean {
  return a.replace(/\\/g, "/") === b.replace(/\\/g, "/");
}

/**
 * Line starts per TypeScript's scanner conventions: LF, CR, CRLF, U+2028,
 * U+2029 end lines. Every position the driver reports uses this one mapping.
 */
function lineStartOffsets(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    if (ch === 0x0d) {
      if (i + 1 < text.length && text.charCodeAt(i + 1) === 0x0a) i += 1;
      starts.push(i + 1);
    } else if (ch === 0x0a || ch === 0x2028 || ch === 0x2029) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function positionInText(
  file: string,
  text: string,
  offset: number,
): SourcePosition {
  if (offset < 0 || offset > text.length) {
    fail(
      `position offset ${offset} out of range for ${file} (0..${text.length})`,
    );
  }
  const starts = lineStartOffsets(text);
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid]! <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { file, offset, line: low + 1, column: offset - starts[low]! + 1 };
}
