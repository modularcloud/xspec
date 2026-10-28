// TypeScript tooling driver for the xspec test harness (TEST-SPEC H-2, §4's
// opening paragraph, 17 S-4; IMPLEMENTATION.md: type-level assertions
// compile fixture consumer files with the TypeScript compiler API and assert
// on diagnostics; hover and go-to-definition are asserted through the
// language-service API; runtime behavior of generated modules runs under
// plain Node with no xspec dependency installed — SPEC.md 13.1). Harness
// machinery only: this module never imports product code; consumer-side
// contracts are exercised over files the product wrote into a test
// workspace, through standard TypeScript tooling.
//
// - A `ConsumerProject` is a fixed set of root TypeScript files under a
//   project root, compiled and served in one of H-2's configurations (below)
//   by one TypeScript language service: the same program answers diagnostics
//   (with exact locations), go-to-definition targets, and hover text, so
//   type-level and editor-level assertions cannot drift apart. The project
//   snapshots file contents on first access — rebuild a new
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
//   and `NODE_PATH` dropped, from a directory with no package named `xspec`
//   within its reach (the isolation below), so nothing outside the
//   program's compiled output can satisfy an import — SPEC.md 13.1's "no
//   xspec runtime dependency", observed structurally.
// - Failure paths are loud (H-8): a missing project root or root file, an
//   unknown or ambiguous marker, and an unreadable definition target all
//   throw diagnosed errors instead of yielding empty results a test could
//   mistake for green. An import the product failed to make resolvable is a
//   diagnosed compile error (TS2307) — the red path for section 4 tests.
// - Each answer — diagnostics, go-to-definition, hover, a module skeleton,
//   emit — is a harness step under its own guard (TEST-SPEC S-3,
//   helpers/step-guards.ts): synchronous, bounded by construction over the
//   consumer program it reads, and measured; the isolation checks, and the
//   runtime output's creation and removal, are asynchronous steps under
//   theirs.
//
// H-2's two fixed configurations. TEST-SPEC H-2 fixes the consumer
// channel's configurations, so that no verdict turns on a choice the
// documents leave open: both run TypeScript 5.9.3 with `strict` and `target`
// ESNext, whose default library (`lib.esnext.full.d.ts`) every program
// loads, every option H-2 does not name at the release's default — so no
// `skipLibCheck` (declaration files, a product's companions among them, are
// checked like every other program file) and no `types` or `typeRoots` (the
// program holds every `@types` package visible from the project root, which
// the isolation below makes none). They differ in the two settings that
// decide which import and export forms TypeScript accepts in a module:
// - `COMMONJS_CONFIGURATION`: `module` CommonJS under its default (`node10`)
//   resolution;
// - `ES_MODULE_CONFIGURATION`: `module` ESNext with `moduleResolution`
//   `bundler`, `isolatedModules`, and `verbatimModuleSyntax` — an export
//   assignment and an import assignment rejected, and so a type re-exported
//   through `export { … } from` or imported without a `type` modifier.
// Neither is ECMAScript-module `node16`/`nodenext` resolution, under which an
// extensionless relative specifier such as `./NAME.xspec` never resolves,
// nor `verbatimModuleSyntax` beside CommonJS output, which rejects the
// mandated import syntax itself. A project is loaded under one of the two
// (`ConsumerProject.load`'s `configuration`), whose options its language
// service serves exactly, and every type-checking and language-service
// assertion is made under each in turn (`forEachConfiguration`,
// `forEachConsumerProject`), with the same expectation, every diagnosis
// naming its configuration:
// - the clean verdict (`assertTypeChecksClean`) admits no diagnostic of any
//   category anywhere in the program — the consumer, every generated module
//   and companion it reaches, and the default library alike; options,
//   global, syntactic, and semantic diagnostics all count;
// - the type-error assertion (`assertTypeErrorsAt`) expects the program's
//   diagnostics at the expected consumer positions alone: every diagnostic
//   at one of them, and each of them diagnosed by an error.
// Runtime behavior is exercised under the CommonJS configuration alone
// (`withCompiledConsumer`): the program's CommonJS JavaScript, exactly as the
// compiler emits it (LF line terminators, the release's default), is written
// into a fresh directory under the OS temporary directory, outside the
// workspace — the project root's layout kept below it, and nothing the
// compiler did not emit (a product-written file beside a source) copied
// there — and run there under plain Node. The ES-module configuration's
// output keeps the extensionless specifier, which Node.js's
// ECMAScript-module loader never resolves: it is type-checked and served,
// never executed.
// - Isolation (H-2: no package named `xspec` installed or resolvable; `types`
//   at its default): before a project is served, and before its runtime
//   output is written, the harness verifies that no ancestor directory of the
//   project root, or of the output directory — along its path as spelled and
//   along its physical path — holds an entry named `node_modules`, and before
//   each run that none of the global folders Node.js's resolver searches
//   holds an entry named `xspec`; an isolation unmet or unverified is
//   `HarnessStagingError` (mode `consumer-isolation`,
//   helpers/permissions.ts), a harness error, never a verdict. A hand-written
//   fixture project living in this repository is therefore compiled from a
//   copy under the OS temporary directory, as a consumer workspace is.
// - No other configuration is reachable: `ConsumerProject.load` takes one of
//   the two exactly and no compiler option of its own, refusing anything
//   else (a plain `Error`: a harness misuse, never a verdict). So no
//   consumer is compiled, served, or run under `node16` or `nodenext`
//   resolution, a configuration in which no product could meet SPEC.md 13.1
//   (above), nor with `skipLibCheck`, `types`, or `typeRoots` set, options
//   H-2 leaves at the release's default.
//
// The standard tooling is TypeScript 5.9.3, the release SPEC.md 14.20 fixes
// (T1.4-5: never a later one), reached through the harness's own pinned
// dependency `typescript-5.9.3` (an npm alias of `typescript@5.9.3`; see
// test/vitest.config.ts) — never the product's `typescript` dependency.

import * as fs from "node:fs";
import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import ts from "typescript-5.9.3";
import { fail, HarnessAssertionError } from "./assertions.js";
import { HarnessStagingError } from "./permissions.js";
import { guardStep, guardSyncStep } from "./step-guards.js";
import type { ProductBinding, RunResult } from "./subprocess.js";
import { productEnvironment, runProduct } from "./subprocess.js";

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
 * One of TEST-SPEC H-2's two fixed TypeScript configurations (module
 * header). Frozen; a project is served under one of the two exported
 * configurations exactly (`ConsumerProject.load` refuses any other object).
 */
export interface ConsumerConfiguration {
  /** The configuration's name, as each diagnosis made under it names it. */
  readonly name: "CommonJS configuration" | "ES-module configuration";
  /**
   * H-2's options exactly, nothing else set: every other option stays at
   * TypeScript 5.9.3's default (module header).
   */
  readonly compilerOptions: Readonly<ts.CompilerOptions>;
  /**
   * Whether H-2 exercises runtime behavior under it: the CommonJS
   * configuration's alone — the ES-module configuration's output is
   * type-checked and served, never executed.
   */
  readonly executed: boolean;
}

/**
 * H-2's CommonJS configuration: `module` CommonJS under its default
 * (`node10`) resolution — `moduleResolution` left unset — beside `strict`
 * and `target` ESNext.
 */
export const COMMONJS_CONFIGURATION: ConsumerConfiguration = Object.freeze({
  name: "CommonJS configuration",
  compilerOptions: Object.freeze({
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
  }),
  executed: true,
});

/**
 * H-2's ES-module configuration: `module` ESNext with `moduleResolution`
 * `bundler`, `isolatedModules`, and `verbatimModuleSyntax`, beside `strict`
 * and `target` ESNext.
 */
export const ES_MODULE_CONFIGURATION: ConsumerConfiguration = Object.freeze({
  name: "ES-module configuration",
  compilerOptions: Object.freeze({
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    isolatedModules: true,
    verbatimModuleSyntax: true,
  }),
  executed: false,
});

/**
 * H-2's configurations, in the order every assertion is made under them
 * (`forEachConfiguration`): the CommonJS configuration, then the ES-module
 * configuration.
 */
export const CONSUMER_CONFIGURATIONS: readonly ConsumerConfiguration[] =
  Object.freeze([COMMONJS_CONFIGURATION, ES_MODULE_CONFIGURATION]);

/** How every diagnosis names a configuration: `H-2's <name>`. */
export function configurationLabel(
  configuration: ConsumerConfiguration,
): string {
  return `H-2's ${configuration.name}`;
}

/** One expected type error of `assertTypeErrorsAt`. */
export interface ExpectedTypeError {
  /** The consumer reference under test: an error diagnostic covers it. */
  readonly at: SourcePosition;
  /** TypeScript's error code, when the assertion pins it (e.g. 2345). */
  readonly code?: number;
  /** Text the covering error's message must include. */
  readonly messageIncludes?: readonly string[];
}

/** What H-2's runtime emit wrote (`ConsumerProject.emitTo`). */
export interface RuntimeEmit {
  readonly emitSkipped: boolean;
  /** Every file written, output-directory-relative with `/`, sorted. */
  readonly emittedFiles: readonly string[];
  /**
   * Each emitted output by the program file it compiles: the source's
   * project-relative path → its output's output-directory-relative path.
   */
  readonly outputs: ReadonlyMap<string, string>;
  /**
   * Outputs the compiler produced for program files outside the project
   * root, which the output directory's mirror of the root cannot hold —
   * absolute, `/`-separated, sorted; none written.
   */
  readonly outsideRoot: readonly string[];
  readonly diagnostics: readonly ConsumerDiagnostic[];
}

/** Options of one run of a compiled consumer (`CompiledConsumer.run`). */
export interface CompiledRunOptions {
  /** process.argv arguments after the entry path. */
  readonly argv?: readonly string[];
  /** Merged last over the sanitized environment (see subprocess driver). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly timeoutMs?: number;
}

/**
 * A consumer program compiled to CommonJS JavaScript under H-2's CommonJS
 * configuration, its output in a fresh directory outside the workspace
 * (`withCompiledConsumer`).
 */
export interface CompiledConsumer {
  /** The output directory, absolute: the project root's mirror. */
  readonly dir: string;
  /** Every file the compiler wrote, `dir`-relative with `/`, sorted. */
  readonly emittedFiles: readonly string[];
  /**
   * The compiled output of a program source (project-relative with `/`,
   * as `rootFiles` name it), `dir`-relative; failing diagnosed when the
   * compiler wrote none for it.
   */
  outputOf(source: string): string;
  /**
   * Run the compiled output of `source` under plain Node, `dir` its working
   * directory (`runConsumer`), once the global folders Node.js's resolver
   * searches under the run's environment are verified to hold no package
   * named `xspec` (module header: Isolation).
   */
  run(source: string, options?: CompiledRunOptions): Promise<RunResult>;
}

/** A consumer program's sources: its project root and root files. */
export interface ConsumerSources {
  /** Absolute path of the consumer project root. */
  readonly rootDir: string;
  /**
   * Root files, project-relative with `/` separators. Imports are resolved
   * transitively as usual; diagnostics cover every program file.
   */
  readonly rootFiles: readonly string[];
}

export interface ConsumerProjectOptions extends ConsumerSources {
  /**
   * The H-2 configuration the project is compiled and served in: one of
   * `CONSUMER_CONFIGURATIONS`, exactly. Required — H-2 fixes every option,
   * so a project takes no compiler option of its own.
   */
  readonly configuration: ConsumerConfiguration;
}

/** The keys `ConsumerProject.load` admits — every other one is refused. */
const CONSUMER_PROJECT_OPTION_KEYS: ReadonlySet<string> = new Set([
  "rootDir",
  "rootFiles",
  "configuration",
]);

/**
 * A consumer TypeScript project under standard tooling: compile diagnostics,
 * go-to-definition, hover, and emit, all answered by one language service
 * (IMPLEMENTATION.md: compiler API for diagnostics, language-service API for
 * editor guarantees), compiled and served in one of H-2's configurations.
 */
export class ConsumerProject {
  readonly rootDir: string;
  /** The H-2 configuration the project is compiled and served in. */
  readonly configuration: ConsumerConfiguration;
  /** The options its language service serves: the configuration's exactly. */
  readonly compilerOptions: ts.CompilerOptions;

  readonly #rootFilesAbs: readonly string[];
  readonly #service: ts.LanguageService;
  readonly #readCached: (fileName: string) => string | undefined;

  /**
   * Validate and open a project. A missing root directory or root file is a
   * diagnosed error here rather than a confusing empty program later (H-8).
   * A configuration other than H-2's two — none included — and any option
   * beside `rootDir`, `rootFiles`, and `configuration` are refused (a
   * harness misuse: H-2 fixes every option); the project's root must meet
   * H-2's isolation (module header) — `HarnessStagingError` otherwise.
   */
  static async load(options: ConsumerProjectOptions): Promise<ConsumerProject> {
    const configuration: unknown = options.configuration;
    if (
      !CONSUMER_CONFIGURATIONS.includes(configuration as ConsumerConfiguration)
    ) {
      throw new Error(
        `a consumer project is compiled and served in one of H-2's two fixed ` +
          `configurations exactly — COMMONJS_CONFIGURATION or ` +
          `ES_MODULE_CONFIGURATION — never another object or none, got ` +
          (configuration === undefined
            ? "none"
            : `one named ${JSON.stringify((configuration as { readonly name?: unknown }).name)}`) +
          ` (TEST-SPEC H-2; rootDir: ${String(options.rootDir)})`,
      );
    }
    const foreign = Object.keys(options).filter(
      (key) => !CONSUMER_PROJECT_OPTION_KEYS.has(key),
    );
    if (foreign.length > 0) {
      throw new Error(
        `a consumer project takes no option of its own — ` +
          `${configurationLabel(options.configuration)} fixes every option ` +
          `— got ${foreign.map((key) => JSON.stringify(key)).join(", ")} ` +
          `(TEST-SPEC H-2; rootDir: ${String(options.rootDir)})`,
      );
    }
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
    await verifyConsumerIsolation(
      options.rootDir,
      "the consumer project root",
      `a consumer project under ${configurationLabel(options.configuration)}`,
    );
    return new ConsumerProject(options);
  }

  private constructor(options: ConsumerProjectOptions) {
    this.rootDir = options.rootDir;
    this.configuration = options.configuration;
    this.compilerOptions = { ...options.configuration.compilerOptions };
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
    return this.#step("diagnostics", () => {
      const raw = ts.getPreEmitDiagnostics(this.#program());
      return raw
        .map((diagnostic) => this.#convertDiagnostic(diagnostic))
        .sort(compareDiagnostics);
    });
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
    return this.#step("go-to-definition", () =>
      this.#definitionsAtUnguarded(position),
    );
  }

  #definitionsAtUnguarded(position: FileOffset): readonly DefinitionTarget[] {
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
    return this.#step("declaration-mapped go-to-definition", () =>
      this.#sourceDefinitionsAtUnguarded(position),
    );
  }

  #sourceDefinitionsAtUnguarded(
    position: FileOffset,
  ): readonly SourceDefinitionTarget[] {
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
    return this.#step("hover", () => this.#hoverAtUnguarded(position));
  }

  #hoverAtUnguarded(position: FileOffset): HoverInfo | undefined {
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
    return this.#step("module skeleton", () =>
      this.#moduleSkeletonUnguarded(moduleFile, options),
    );
  }

  #moduleSkeletonUnguarded(
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
   * H-2's runtime emit (module header): this program's CommonJS JavaScript,
   * exactly as the compiler emits it under the CommonJS configuration —
   * whose options hold no `outDir`, so each output is written at its
   * source's path with the output's extension — written instead below
   * `outDir` at the path it takes relative to the project root, the root's
   * layout kept there so the relative specifiers between outputs resolve as
   * between their sources. Nothing but the compiler's output is written: a
   * product-written file beside a source is not copied. An output whose
   * program file lies outside the project root is not written, and is
   * reported (`outsideRoot`). Reached through `withCompiledConsumer`, which
   * creates and verifies `outDir` (absolute, outside the project root);
   * refused on the ES-module configuration, whose output H-2 never
   * executes.
   */
  emitTo(outDir: string): RuntimeEmit {
    if (this.configuration !== COMMONJS_CONFIGURATION) {
      throw new Error(
        `ConsumerProject.emitTo is H-2's runtime emit, exercised under its ` +
          `CommonJS configuration alone; this project is served ` +
          `${this.#servedUnder()}, whose output is type-checked and served, ` +
          `never executed (TEST-SPEC H-2; rootDir: ${this.rootDir})`,
      );
    }
    const fromRoot = path.relative(this.rootDir, outDir);
    if (
      !path.isAbsolute(outDir) ||
      fromRoot === "" ||
      !(fromRoot.split(/[\\/]/, 1)[0] === ".." || path.isAbsolute(fromRoot))
    ) {
      throw new Error(
        `the runtime output directory must be an absolute path outside the ` +
          `consumer project root (TEST-SPEC H-2: written outside the ` +
          `workspace), got ${JSON.stringify(outDir)} for ${this.rootDir}`,
      );
    }
    return this.#step("runtime emit", () => this.#emitToUnguarded(outDir));
  }

  #emitToUnguarded(outDir: string): RuntimeEmit {
    const written: string[] = [];
    const outputs = new Map<string, string>();
    const outsideRoot: string[] = [];
    const result = this.#program().emit(
      undefined,
      (fileName, data, writeByteOrderMark, _onError, sourceFiles) => {
        const abs = path.isAbsolute(fileName)
          ? fileName
          : path.resolve(this.rootDir, fileName);
        const rel = path.relative(this.rootDir, abs);
        if (
          rel === "" ||
          rel.split(/[\\/]/, 1)[0] === ".." ||
          path.isAbsolute(rel)
        ) {
          outsideRoot.push(abs.replace(/\\/g, "/"));
          return;
        }
        const target = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
          target,
          writeByteOrderMark ? BYTE_ORDER_MARK + data : data,
        );
        const output = rel.replace(/\\/g, "/");
        written.push(output);
        for (const sourceFile of sourceFiles ?? []) {
          outputs.set(this.#describePath(sourceFile.fileName), output);
        }
      },
    );
    return {
      emitSkipped: result.emitSkipped,
      emittedFiles: [...written].sort(compareCodeUnits),
      outputs,
      outsideRoot: [...outsideRoot].sort(compareCodeUnits),
      diagnostics: result.diagnostics
        .map((diagnostic) => this.#convertDiagnostic(diagnostic))
        .sort(compareDiagnostics),
    };
  }

  /**
   * One answer of the tooling, a harness step under its own guard
   * (TEST-SPEC S-3, helpers/step-guards.ts): synchronous, bounded by the
   * consumer program it reads, measured.
   */
  #step<T>(what: string, work: () => T): T {
    return guardSyncStep(
      `the TypeScript tooling's ${what} over ${this.rootDir} ` +
        `${this.#servedUnder()} (ConsumerProject)`,
      work,
    );
  }

  /** How a diagnosis names where the project is served. */
  #servedUnder(): string {
    return `under ${configurationLabel(this.configuration)}`;
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

interface RunConsumerOptions {
  /** Absolute output directory; the run's working directory. */
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
 * files of `dir` and the directories above it — the compiled output's own
 * directory, outside the workspace and verified isolated. Reached only
 * through `CompiledConsumer.run` (`withCompiledConsumer`), H-2's runtime.
 */
async function runConsumer(options: RunConsumerOptions): Promise<RunResult> {
  const entryAbs = path.isAbsolute(options.entry)
    ? options.entry
    : path.resolve(options.dir, options.entry);
  return await runProduct(consumerBinding(entryAbs), {
    cwd: options.dir,
    argv: options.argv ?? [],
    env: consumerEnvironmentOverrides(options.env),
    timeoutMs: options.timeoutMs,
  });
}

/** The driver binding of a compiled consumer's run (`runConsumer`). */
function consumerBinding(entryAbs: string): ProductBinding {
  return {
    label: "compiled consumer program under plain Node (SPEC 13.1)",
    command: process.execPath,
    prefixArgs: [entryAbs],
    requiredFiles: [entryAbs],
  };
}

/** A consumer run's environment overrides: `NODE_PATH` dropped, then `env`. */
function consumerEnvironmentOverrides(
  env: Readonly<Record<string, string | undefined>> | undefined,
): Readonly<Record<string, string | undefined>> {
  return { NODE_PATH: undefined, ...(env ?? {}) };
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

/**
 * Run `body` under each of H-2's configurations in turn — the CommonJS
 * configuration, then the ES-module configuration — and return its results
 * in that order; the first failure ends the walk. Every diagnosis names its
 * configuration (TEST-SPEC H-2): a `HarnessAssertionError` the body throws
 * under one is rethrown as `under H-2's <name>: <message>` — its
 * `shrinkable` kept, the original its `cause` — unless its message already
 * names that configuration (this module's own assertions do), and anything
 * else the body throws (a harness error) passes through unchanged.
 */
export async function forEachConfiguration<T>(
  body: (configuration: ConsumerConfiguration) => Promise<T> | T,
): Promise<readonly T[]> {
  const results: T[] = [];
  for (const configuration of CONSUMER_CONFIGURATIONS) {
    try {
      results.push(await body(configuration));
    } catch (error) {
      throw namedUnder(configuration, error);
    }
  }
  return results;
}

/**
 * Load the consumer program `sources` under each of H-2's configurations in
 * turn and run `body` over each project — `forEachConfiguration`, whose
 * order and naming apply — returning its results in configuration order.
 */
export async function forEachConsumerProject<T>(
  sources: ConsumerSources,
  body: (project: ConsumerProject) => Promise<T> | T,
): Promise<readonly T[]> {
  return await forEachConfiguration(async (configuration) =>
    body(
      await ConsumerProject.load({
        rootDir: sources.rootDir,
        rootFiles: sources.rootFiles,
        configuration,
      }),
    ),
  );
}

/** `error`, named under `configuration` (`forEachConfiguration`). */
function namedUnder(
  configuration: ConsumerConfiguration,
  error: unknown,
): unknown {
  if (!(error instanceof HarnessAssertionError)) return error;
  const label = configurationLabel(configuration);
  if (error.message.includes(label)) return error;
  const named = new HarnessAssertionError(`under ${label}: ${error.message}`, {
    shrinkable: error.shrinkable,
  });
  named.cause = error;
  return named;
}

/**
 * H-2's clean verdict (module header): the project, served under one of
 * H-2's configurations, carries no diagnostic anywhere in its program, of
 * any category — options, global, syntactic, and semantic diagnostics, in
 * the consumer, in every generated module and companion it reaches, and in
 * the default library alike. Fails diagnosed, naming the configuration and
 * listing every diagnostic.
 */
export function assertTypeChecksClean(
  project: ConsumerProject,
  context = "consumer project",
): void {
  const configuration = project.configuration;
  const diagnostics = project.diagnostics();
  if (diagnostics.length > 0) {
    fail(
      `${context} (under ${configurationLabel(configuration)}): expected a ` +
        `clean type check — no diagnostic anywhere in the program, the ` +
        `generated modules and companions it reaches included (TEST-SPEC ` +
        `H-2) — got ${diagnostics.length} diagnostic(s):\n` +
        describeAll(diagnostics),
    );
  }
}

/**
 * H-2's type-error assertion (module header): compiling the project, served
 * under one of H-2's configurations, fails with the program's diagnostics
 * at the expected positions alone — every diagnostic, of any category,
 * covers one of them (a diagnostic with no location covers none), and each
 * is covered by an error diagnostic, of its expected code when one is
 * given, whose message includes its expected texts. Returns, per
 * expectation in order, the error covering it. Fails diagnosed, naming the
 * configuration, every position left undiagnosed, and every diagnostic
 * elsewhere. An empty expectation list is refused: a program carrying no
 * diagnostic is `assertTypeChecksClean`'s verdict.
 */
export function assertTypeErrorsAt(
  project: ConsumerProject,
  expected: readonly ExpectedTypeError[],
  context = "consumer project",
): readonly ConsumerDiagnostic[] {
  const configuration = project.configuration;
  if (expected.length === 0) {
    throw new Error(
      `assertTypeErrorsAt needs at least one expected position — a program ` +
        `carrying no diagnostic is assertTypeChecksClean's verdict (${context})`,
    );
  }
  const label = `${context} (under ${configurationLabel(configuration)})`;
  const diagnostics = project.diagnostics();
  const elsewhere = diagnostics.filter(
    (diagnostic) =>
      !expected.some((expectation) =>
        coversPosition(diagnostic, expectation.at),
      ),
  );
  const matches = expected.map((expectation) =>
    diagnostics.find(
      (diagnostic) =>
        diagnostic.category === "error" &&
        coversPosition(diagnostic, expectation.at) &&
        (expectation.code === undefined ||
          diagnostic.code === expectation.code),
    ),
  );
  const undiagnosed = expected.filter(
    (_expectation, index) => matches[index] === undefined,
  );
  if (undiagnosed.length > 0 || elsewhere.length > 0) {
    fail(
      `${label}: compilation must fail with its diagnostics at the consumer ` +
        `references under test alone — every diagnostic at one of the ` +
        `${expected.length} expected position(s), each of them diagnosed ` +
        `(TEST-SPEC H-2, §4).` +
        (undiagnosed.length > 0
          ? `\nUndiagnosed:\n${undiagnosed
              .map((expectation) => `  ${describeExpected(expectation)}`)
              .join("\n")}`
          : "") +
        (elsewhere.length > 0
          ? `\nDiagnostics elsewhere:\n${describeAll(elsewhere)}`
          : "") +
        `\nEvery diagnostic reported:\n${describeAll(diagnostics)}`,
    );
  }
  const matched = matches as readonly ConsumerDiagnostic[];
  expected.forEach((expectation, index) => {
    const match = matched[index]!;
    for (const needle of expectation.messageIncludes ?? []) {
      if (!match.message.includes(needle)) {
        fail(
          `${label}: the error covering ${describeExpected(expectation)} ` +
            `must mention ${JSON.stringify(needle)}; got: ` +
            formatConsumerDiagnostic(match),
        );
      }
    }
  });
  return matched;
}

/**
 * H-2's runtime (module header): compile `project` — served under H-2's
 * CommonJS configuration — to CommonJS JavaScript in a fresh directory under
 * the OS temporary directory, outside the workspace, its isolation verified
 * first, and run `body` over the output; the directory is removed once
 * `body` settles. The compile fails diagnosed when the compiler skips its
 * emit, reports an emit diagnostic, or produces output for a program file
 * outside the project root, which the output directory mirrors. Refused,
 * as a harness misuse, under the ES-module configuration, whose output is
 * type-checked and served, never executed.
 */
export async function withCompiledConsumer<T>(
  project: ConsumerProject,
  context: string,
  body: (compiled: CompiledConsumer) => Promise<T>,
): Promise<T> {
  if (project.configuration !== COMMONJS_CONFIGURATION) {
    throw new Error(
      `withCompiledConsumer is H-2's runtime, exercised under its CommonJS ` +
        `configuration alone; ${context}'s project is served under ` +
        `${configurationLabel(project.configuration)}, whose output is ` +
        `type-checked and served, never executed (TEST-SPEC H-2; rootDir: ` +
        `${project.rootDir})`,
    );
  }
  const label = `${context} (under ${configurationLabel(COMMONJS_CONFIGURATION)})`;
  const dir = await guardStep(
    `creating the runtime output directory of ${label} (withCompiledConsumer)`,
    () => fsp.mkdtemp(path.join(os.tmpdir(), "xspec-consumer-out-")),
  );
  try {
    await verifyConsumerIsolation(dir, "the runtime output directory", label);
    const emitted = project.emitTo(dir);
    if (
      emitted.emitSkipped ||
      emitted.diagnostics.length > 0 ||
      emitted.outsideRoot.length > 0
    ) {
      fail(
        `${label}: the consumer program compiles whole to CommonJS ` +
          `JavaScript written outside the workspace (TEST-SPEC H-2; SPEC ` +
          `13.1)` +
          (emitted.emitSkipped ? "; the compiler skipped its emit" : "") +
          (emitted.outsideRoot.length > 0
            ? `; the compiler produced output for program files outside the ` +
              `consumer project root ${project.rootDir}, which the output ` +
              `directory mirrors: ${JSON.stringify(emitted.outsideRoot)}`
            : "") +
          `; emit diagnostics:\n${describeAll(emitted.diagnostics)}`,
      );
    }
    return await body(new CompiledOutput(dir, emitted, label));
  } finally {
    await guardStep(
      `removing the runtime output directory of ${label} (withCompiledConsumer)`,
      () => fsp.rm(dir, { recursive: true, force: true, maxRetries: 2 }),
    );
  }
}

/** A compiled consumer's output directory (`withCompiledConsumer`). */
class CompiledOutput implements CompiledConsumer {
  readonly dir: string;
  readonly emittedFiles: readonly string[];
  readonly #outputs: ReadonlyMap<string, string>;
  readonly #label: string;

  constructor(dir: string, emitted: RuntimeEmit, label: string) {
    this.dir = dir;
    this.emittedFiles = emitted.emittedFiles;
    this.#outputs = emitted.outputs;
    this.#label = label;
  }

  outputOf(source: string): string {
    const key = path.normalize(source).replace(/\\/g, "/");
    const output = this.#outputs.get(key);
    if (output === undefined) {
      fail(
        `${this.#label}: the compiler wrote no output for ${JSON.stringify(source)} ` +
          `— a source of the consumer program compiles to CommonJS JavaScript ` +
          `(TEST-SPEC H-2); it wrote ${JSON.stringify(this.emittedFiles)}`,
      );
    }
    return output;
  }

  async run(
    source: string,
    options: CompiledRunOptions = {},
  ): Promise<RunResult> {
    const entry = this.outputOf(source);
    await verifyNoGlobalPackage(
      path.join(this.dir, entry),
      options.env,
      this.#label,
    );
    return await runConsumer({
      dir: this.dir,
      entry,
      argv: options.argv,
      env: options.env,
      timeoutMs: options.timeoutMs,
    });
  }
}

/** Whether `diagnostic`'s span covers `position` (a zero-length span its start). */
function coversPosition(
  diagnostic: ConsumerDiagnostic,
  position: SourcePosition,
): boolean {
  return (
    diagnostic.file === position.file &&
    diagnostic.start !== undefined &&
    diagnostic.start.offset <= position.offset &&
    position.offset <
      diagnostic.start.offset + Math.max(diagnostic.length ?? 1, 1)
  );
}

/** One expectation of `assertTypeErrorsAt`, for diagnoses. */
function describeExpected(expectation: ExpectedTypeError): string {
  const { at } = expectation;
  return (
    `an error${expectation.code !== undefined ? ` TS${expectation.code}` : ""} ` +
    `at ${at.file}:${at.line}:${at.column} (offset ${at.offset})`
  );
}

/** The entry H-2's isolation keeps from every directory above a program. */
const NODE_MODULES = "node_modules";

/** The package name H-2 keeps from every consumer run's reach. */
const XSPEC_PACKAGE_NAME = "xspec";

const ISOLATION_RULE =
  "a consumer program is compiled and run with no package named xspec " +
  "installed or resolvable, its every option at the release's default — " +
  "types included, which a node_modules directory above it would extend — " +
  "an unmet isolation a harness error, never a verdict (TEST-SPEC H-2)";

type IsolationUnmet = (detail: string) => HarnessStagingError;

/**
 * H-2's isolation of `dir` — a consumer project's root, or a runtime
 * output directory (module header): no ancestor directory of it, along its
 * path as spelled and along its physical path, each once, holds an entry
 * named `node_modules` of any kind. `HarnessStagingError` (mode
 * `consumer-isolation`) otherwise, or when an examination leaves it
 * unverified (`examineEntry`).
 */
async function verifyConsumerIsolation(
  dir: string,
  role: string,
  context: string,
): Promise<void> {
  const unmet: IsolationUnmet = (detail) =>
    new HarnessStagingError(
      "consumer-isolation",
      dir,
      `${context}: H-2's isolation of ${role} is unmet — ${detail}; ` +
        ISOLATION_RULE,
    );
  await guardStep(
    `verifying H-2's isolation of ${role} ${dir} (${context})`,
    async () => {
      for (const ancestor of await isolationAncestors(dir, unmet)) {
        const entry = path.join(ancestor, NODE_MODULES);
        const stats = await examineEntry(entry, unmet);
        if (stats !== undefined) {
          throw unmet(
            `the ancestor directory ${ancestor} holds an entry named ` +
              `${NODE_MODULES} (${isolationEntryKind(stats)}, ${entry}), from ` +
              `which TypeScript's module resolution and default types, and ` +
              `Node.js's resolver, read packages`,
          );
        }
      }
    },
  );
}

/**
 * Before a compiled consumer's run (`CompiledConsumer.run`): none of the
 * global folders Node.js's CommonJS resolver searches for a bare specifier
 * under the run's environment — its `NODE_PATH` entries (dropped unless
 * `env` sets them), `$HOME/.node_modules`, `$HOME/.node_libraries`, and
 * `$PREFIX/lib/node` of the Node.js running it — holds an entry named
 * `xspec`. `HarnessStagingError` (mode `consumer-isolation`) otherwise.
 */
async function verifyNoGlobalPackage(
  entryAbs: string,
  env: Readonly<Record<string, string | undefined>> | undefined,
  context: string,
): Promise<void> {
  const unmet: IsolationUnmet = (detail) =>
    new HarnessStagingError(
      "consumer-isolation",
      entryAbs,
      `${context}: H-2's isolation of the compiled consumer's run is unmet ` +
        `— ${detail}; ${ISOLATION_RULE}`,
    );
  const environment = productEnvironment(
    consumerBinding(entryAbs),
    consumerEnvironmentOverrides(env),
  );
  await guardStep(
    `verifying that no global folder holds ${XSPEC_PACKAGE_NAME} before ` +
      `running ${entryAbs} (${context})`,
    async () => {
      for (const folder of nodeGlobalFolders(environment)) {
        const entry = path.join(folder, XSPEC_PACKAGE_NAME);
        const stats = await examineEntry(entry, unmet);
        if (stats !== undefined) {
          throw unmet(
            `the global folder ${folder}, which Node.js's resolver searches ` +
              `under the run's environment, holds an entry named ` +
              `${XSPEC_PACKAGE_NAME} (${isolationEntryKind(stats)}, ${entry})`,
          );
        }
      }
    },
  );
}

/**
 * The global folders Node.js's CommonJS resolver searches for a bare
 * specifier under `environment` (Node.js's documented GLOBAL_FOLDERS, after
 * `NODE_PATH`'s entries), for the Node.js executable running the harness —
 * the one a compiled consumer runs under.
 */
function nodeGlobalFolders(
  environment: Readonly<Record<string, string>>,
): readonly string[] {
  const windows = process.platform === "win32";
  const home = windows ? environment["USERPROFILE"] : environment["HOME"];
  const prefix = windows
    ? path.resolve(process.execPath, "..")
    : path.resolve(process.execPath, "..", "..");
  const folders: string[] = [];
  for (const entry of (environment["NODE_PATH"] ?? "").split(path.delimiter)) {
    if (entry !== "") folders.push(path.resolve(entry));
  }
  if (home !== undefined && home !== "") {
    folders.push(path.resolve(home, ".node_modules"));
    folders.push(path.resolve(home, ".node_libraries"));
  }
  folders.push(path.resolve(prefix, "lib", "node"));
  return folders;
}

/**
 * The directories above `dir`, nearest first: its parent up to the
 * filesystem root along `dir` as spelled, then along its physical path,
 * each directory once. A physical path that cannot be read leaves the
 * isolation unverified.
 */
async function isolationAncestors(
  dir: string,
  unmet: IsolationUnmet,
): Promise<readonly string[]> {
  let physical: string;
  try {
    physical = await fsp.realpath(dir);
  } catch (error) {
    throw unmet(
      `its physical path cannot be read (${isolationErrorText(error)}), so ` +
        `the directories above it go unexamined`,
    );
  }
  const ancestors: string[] = [];
  const seen = new Set<string>();
  for (const start of [path.resolve(dir), physical]) {
    let current = start;
    for (;;) {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
      if (seen.has(current)) continue;
      seen.add(current);
      ancestors.push(current);
    }
  }
  return ancestors;
}

/**
 * `lstat` of `entry`: its stats, or `undefined` when no process of the
 * harness's identity reaches it — absent (`ENOENT`, `ENOTDIR`) or behind a
 * refused search (`EACCES`, `EPERM`), which TypeScript's resolution in this
 * process and Node.js's in a run it starts meet alike. Any other failure
 * leaves the isolation unverified.
 */
async function examineEntry(
  entry: string,
  unmet: IsolationUnmet,
): Promise<Stats | undefined> {
  try {
    return await fsp.lstat(entry);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      code === "ENOENT" ||
      code === "ENOTDIR" ||
      code === "EACCES" ||
      code === "EPERM"
    ) {
      return undefined;
    }
    throw unmet(
      `the examination of ${entry} failed (${isolationErrorText(error)}), ` +
        `leaving it unverified`,
    );
  }
}

function isolationEntryKind(stats: Stats): string {
  if (stats.isSymbolicLink()) return "a symbolic link";
  if (stats.isDirectory()) return "a directory";
  if (stats.isFile()) return "a plain file";
  return "an entry of another kind";
}

function isolationErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

/** U+FEFF, which an emit asking for a byte-order mark writes first. */
const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);

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
