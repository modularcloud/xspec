// The module channel's TypeScript driver (TEST-SPEC §7.6 *Covered setups*,
// *Verdict*, *Pairing*, *Placement*, H-1, H-2, S-3; SPEC 7.6 *Covered
// setups*, *Type contract*). Harness machinery only: this module never
// imports product code and starts no process. It type-checks files a test
// writes into the module channel's stagings (helpers/module-channel.ts)
// with the harness's own TypeScript 5.9.3 (`typescript-5.9.3`, the release
// SPEC 14.20 names). It is separate from H-2's consumer tooling
// (helpers/tooling.ts), whose two fixed configurations S-4 pins and which
// this module never serves: 7.6's setups are not H-2's.
//
// The matrix (`COVERED_SETUPS`, TEST-SPEC §7.6 Covered setups): the
// configuration file, the program's one root, named with each of `.ts`,
// `.mts`, `.cts`, and `.tsx` in each of the three projects
// (helpers/module-channel.ts `PROJECT_KINDS`), judged under each option set
// covering it — the fourteen strict defaults (`strict` on, with
// `moduleResolution` `node10` and `module` at its default; `node16` and
// `nodenext`, each with `module` `node16`, `node18`, `node20`, and
// `nodenext`; `bundler` with `module` `es2015`, `es2020`, `es2022`,
// `esnext`, and `preserve`) for every file, and the initialized-project set
// (exactly the options SPEC 7.6 lists, which release 5.9.3's `tsc --init`
// writes) for each file TypeScript compiles as an ES module (`.mts` in every
// project, `.ts` and `.tsx` in the ES-module one): 173 setups. Each set is
// spelled as a `tsconfig.json` spells it and converted by TypeScript's own
// option parser, and nothing else is set: every option a set does not name
// stays at the release's default for that set — `target`, which the release
// derives from `module`, included, and `skipLibCheck` off under the strict
// defaults — and no option of the driver's own is added (no `noEmit`, no
// `types`, no `lib`). A module-load self-check confirms the composition.
//
// Programs. A test stages its files through `stageCoveredFiles`, which
// writes each file's bytes once per extension its setups name, into the
// directory the caller names (for the canonical placement, the project
// directory holding `node_modules/N`), each under a fresh name, and, where
// the caller names the placement the files' imports reach, verifies Reach
// for each written file against it and the project kind
// (`ModuleStaging.verifyReach`) before any program exists. Each program
// takes the files by their physical paths as its roots; its compiler host
// is TypeScript's own (`ts.createCompilerHost`, as `tsc` uses), its current
// directory a directory inside the staging (the files' own unless the caller
// names another), and it writes nothing: no emit is ever asked for
// (declaration diagnostics need none), and the host's `writeFile` refuses.
//
// The program condition (SPEC 7.6 Covered setups, Program; TEST-SPEC §7.6
// Placement): nothing enters the program but the root, TypeScript's
// libraries for the option set, and what the root's import declaration
// brings in — files of any kind, and the libraries they reference. It is
// read from TypeScript's own record of why each file is in the program (its
// include reasons, an internal of release 5.9.3 that
// test/self/module-channel-ts.test.ts pins): every file is a root the driver
// named; a library — the program's default library, or one a library or a
// brought-in file references — that is TypeScript's own, a file of the
// release's library directory, never one an installed package replaces
// (`@typescript/lib-es5`); or a file a root's real import brings in, and
// then any file such a file imports or references. Neither an automatic
// type directive (an `@types` package included automatically) nor an
// import TypeScript synthesizes (`react/jsx-runtime` under `jsx`
// `react-jsx`) admits a file. A violation is a `HarnessStagingError` (mode
// `module-channel`) raised before any verdict: where the condition fails,
// 7.6 promises nothing, and no arm asserts anything there.
//
// The verdicts (TEST-SPEC §7.6 Verdict). Every error-category diagnostic
// TypeScript reports for a file's program counts, in any of its files:
// options, global, syntactic, semantic, and — wherever the set turns
// `declaration` on, as the initialized set does — declaration diagnostics,
// all computed whatever the others hold (tsc's short-circuit aside). A file
// type-checks when there is none (`assertTypeChecks`); it fails to
// type-check when at least one is located in the configuration file, the
// program's other files aside. Pairing (TEST-SPEC §7.6 Pairing): a
// shape-violation arm passes only where its valid twin type-checks in the
// same setup and placement (`assertShapeViolation`), so a missing or stub
// package fails every arm and a permissive one the shape-violation arms.
// Verdict failures are diagnosed (`HarnessAssertionError`, H-8), naming the
// setup, the file, and every error.
//
// The export listing (TEST-SPEC T7.6-1, S-4), where a request asks for it
// (`listExports`): each verdict then carries the listing of the module
// TypeScript resolves the file's one import declaration to, read from that
// file's own program, so each setup through its own resolution (a package
// serving different declaration files to `import` and to `require`, or to
// different modes, read through each), and never probed by names the
// harness chooses:
// - the module: `checker.getSymbolAtLocation` on the import's specifier.
//   Where TypeScript resolves the import to no module it reads declarations
//   from (a stub package, a JavaScript file without declarations), the
//   listing names no module and no export.
// - the compiler's listing of its exports (`checker.getExportsOfModule`): a
//   declaration module holding neither an export list nor an export
//   assignment exports each of its top-level declarations, an interface it
//   never marks `export` among them, which this listing sees; export stars
//   are followed; TypeScript's synthetic default is never among them, a
//   declared default export (`default`) is.
// - where the module declares an export assignment (`export =`), the
//   members of the assigned value that a named import binds: the
//   properties of that value's type (`checker.getPropertiesOfType` over
//   `checker.getTypeOfSymbol` of the assignment), the type TypeScript's
//   named-import resolution reads each imported name from — a member keyed
//   by a symbol or a private name aside, which no import name spells. Not
//   the checker's internal `getExportsAndPropertiesOfModule`, which lists
//   no member of a value typed as a class instance, a primitive, an array,
//   or a tuple, though a named import binds them: a value typed by a class
//   declaring `defineConfig` imports it by name.
// - each name's meanings, merged where both lists hold it: value, type, and
//   namespace, as TypeScript's symbol flags give them through aliases (an
//   alias TypeScript cannot resolve carrying every meaning, as TypeScript
//   reads it). A value meaning reached only through `export type`, `import
//   type`, or `export type *`, which no import may use as a value, is no
//   value meaning (`value` false) and is reported as such
//   (`typeOnlyValue`): for a module without an export assignment, read as
//   TypeScript reads the module object's value members (the module type's
//   `checker.getPropertyOfType` returning that very export); for an export
//   assignment's members, never; and for the exports of its assigned value,
//   from the declarations along each alias
//   (`ts.isTypeOnlyImportOrExportDeclaration`).
// Each listing is computed once the program's diagnostics are all read, so
// it changes no verdict.
//
// Sharing, and why each kind is sound for what a case checks (TEST-SPEC
// §7.6 Covered setups: how the harness reaches each verdict is open wherever
// it drops no pairing and stays sound):
// - Parsed libraries serve many programs, as TEST-SPEC allows: each file of
//   TypeScript's library directory is parsed once per target, module
//   format, and JSDoc mode, and its bound tree reused. For a declaration
//   file the binder reads no option but the target (its strict mode follows
//   the file's own module indicator; its unreachable-code, fallthrough,
//   label, and const-enum readings concern executable statements, which a
//   library holds none of), and each program's checker keeps its own links.
//   No other file is cached: a staging's files are read afresh by each
//   program.
// - Batching: `judge` checks all of a setup's files in one program, whose
//   roots they all are, and reads each file's verdict from the program's
//   options and global diagnostics, its shared files' diagnostics, and its
//   own diagnostics. Each case's own program holds exactly that root and
//   those shared files, so the batch is sound wherever no root reaches past
//   its own module — checked on the program, not assumed: every root is an
//   external module declaring nothing global (no global augmentation, no
//   UMD export) and augmenting no module (a `declare module "…"`, which
//   changes that module, its exports included, for every file of the
//   program), every root's import brings in the same files (its closure
//   over TypeScript's include reasons), and no root's check raises a global
//   diagnostic, which could belong to any of them. Where a check fails, each
//   file is judged in a program of its own instead. Within one program
//   TypeScript's diagnostics for a file do not depend on which other files
//   were checked first: the language service checks files in any order.
//   Each root's export listing reads its own import's resolution, which
//   every root of a batch shares.
// - The libraries' own diagnostics are read once per option set and library
//   list, wherever no file of the program but the libraries contributes to
//   the global scope (every other file an external module declaring nothing
//   global): a library declares only globals and refers only to globals, so
//   its diagnostics are then a function of the option set and the library
//   list alone. Where some file does contribute — a package declaring
//   `declare global { … }`, whose errors can land inside a library — the
//   libraries are checked in that program. Libraries are checked first, as
//   tsc checks them, then the program's other shared files, then the roots.
// - `judgeUnshared` is the reference reading the self-test compares against:
//   one root, nothing shared but parsed libraries, every diagnostic read as
//   `ts.getPreEmitDiagnostics` reads it.
//
// TEST-SPEC S-3: each program's creation and check is one synchronous
// harness step under its own guard (`guardSyncStep`, the default step guard
// — measured costs in AGENTS.md), each program of its own beside a batch its
// own step; writing and Reach are asynchronous steps under theirs. A misuse
// of this module (an unknown setup, an empty file list, a duplicate label,
// an export listing asked of a file holding other than one import
// declaration) is a plain `Error`.

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import ts from "typescript-5.9.3";
import { fail } from "./assertions.js";
import type {
  CommonJsTypeMember,
  ModuleStaging,
  Placement,
  ProjectKind,
} from "./module-channel.js";
import { PROJECT_KINDS } from "./module-channel.js";
import type { StagingMode } from "./permissions.js";
import { HarnessStagingError } from "./permissions.js";
import { guardStep, guardSyncStep } from "./step-guards.js";

/** The staging mode every refusal of this module names. */
const MODE: StagingMode = "module-channel";

const LF = String.fromCodePoint(0x0a);

/** The extensions a covered configuration file is named with. */
export type CoveredExtension = ".ts" | ".mts" | ".cts" | ".tsx";

/** Every covered extension, in TEST-SPEC §7.6's order. */
export const COVERED_EXTENSIONS: readonly CoveredExtension[] = Object.freeze([
  ".ts",
  ".mts",
  ".cts",
  ".tsx",
]);

/** The two kinds of option set SPEC 7.6 names. */
export type OptionSetKind = "strict defaults" | "initialized-project options";

/** A `tsconfig.json` option value, as a set spells it. */
export type TsconfigValue = boolean | string | readonly string[];

/** One of 7.6's option sets (module header). */
export interface CoveredOptionSet {
  /** How every diagnosis names the set. */
  readonly name: string;
  readonly kind: OptionSetKind;
  /** The set exactly as `tsconfig.json` spells it: these options, no other. */
  readonly tsconfig: Readonly<Record<string, TsconfigValue>>;
  /** The same options, converted by TypeScript 5.9.3's option parser. */
  readonly compilerOptions: Readonly<ts.CompilerOptions>;
}

/** The base directory option conversion resolves path options against. */
const CONVERSION_BASE = path.parse(process.cwd()).root;

/** A diagnostic's message, its chain flattened. */
function flatten(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, LF);
}

/**
 * An option set from its `tsconfig.json` spelling, converted by TypeScript's
 * own parser; a spelling it rejects, or one converting to options other
 * than those spelled, throws at module load.
 */
function optionSet(
  name: string,
  kind: OptionSetKind,
  tsconfig: Record<string, TsconfigValue>,
): CoveredOptionSet {
  const { options, errors } = ts.convertCompilerOptionsFromJson(
    tsconfig,
    CONVERSION_BASE,
  );
  if (errors.length > 0) {
    throw new Error(
      `module channel's TypeScript driver: TypeScript 5.9.3 rejects ${name} ` +
        `(${errors.map(flatten).join("; ")})`,
    );
  }
  const spelled = Object.keys(tsconfig).sort();
  const converted = Object.keys(options).sort();
  if (spelled.join(",") !== converted.join(",")) {
    throw new Error(
      `module channel's TypeScript driver: ${name}, spelled with ` +
        `${spelled.join(", ")}, converts to the options ` +
        `${converted.join(", ")}: nothing but the set's own options is set`,
    );
  }
  return Object.freeze({
    name,
    kind,
    tsconfig: Object.freeze({ ...tsconfig }),
    compilerOptions: Object.freeze(options),
  });
}

/**
 * The strict defaults' modes (SPEC 7.6 Covered setups): each
 * `moduleResolution` value that finds installed packages, with every
 * `module` value the mode requires — `undefined` for `module` at its
 * default under `node10`.
 */
const STRICT_DEFAULT_MODES: readonly (readonly [
  string,
  readonly (string | undefined)[],
])[] = [
  ["node10", [undefined]],
  ["node16", ["node16", "node18", "node20", "nodenext"]],
  ["nodenext", ["node16", "node18", "node20", "nodenext"]],
  ["bundler", ["es2015", "es2020", "es2022", "esnext", "preserve"]],
];

/** The fourteen strict defaults, in TEST-SPEC §7.6's order. */
export const STRICT_DEFAULT_OPTION_SETS: readonly CoveredOptionSet[] =
  Object.freeze(
    STRICT_DEFAULT_MODES.flatMap(([moduleResolution, modules]) =>
      modules.map((module) =>
        module === undefined
          ? optionSet(
              `the strict defaults with moduleResolution ${moduleResolution} ` +
                `and module at its default`,
              "strict defaults",
              { strict: true, moduleResolution },
            )
          : optionSet(
              `the strict defaults with moduleResolution ${moduleResolution} ` +
                `and module ${module}`,
              "strict defaults",
              { strict: true, moduleResolution, module },
            ),
      ),
    ),
  );

/**
 * The initialized-project options (SPEC 7.6 Covered setups): exactly the
 * set release 5.9.3's `tsc --init` writes.
 */
export const INITIALIZED_PROJECT_OPTION_SET: CoveredOptionSet = optionSet(
  "the initialized-project options",
  "initialized-project options",
  {
    module: "nodenext",
    target: "esnext",
    types: [],
    jsx: "react-jsx",
    moduleDetection: "force",
    strict: true,
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    noUncheckedSideEffectImports: true,
    skipLibCheck: true,
  },
);

/** Every option set: the strict defaults, then the initialized-project set. */
export const COVERED_OPTION_SETS: readonly CoveredOptionSet[] = Object.freeze([
  ...STRICT_DEFAULT_OPTION_SETS,
  INITIALIZED_PROJECT_OPTION_SET,
]);

/**
 * Whether TypeScript compiles a file so named in a project of `project`'s
 * kind as an ES module (SPEC 7.6: a name ending in `.mts`, or in `.ts` or
 * `.tsx` in an ES-module project) — the files the initialized-project set
 * covers.
 */
export function compilesAsEsModule(
  project: ProjectKind,
  extension: CoveredExtension,
): boolean {
  return (
    extension === ".mts" ||
    (project === "es-module" && (extension === ".ts" || extension === ".tsx"))
  );
}

/** One covered setup: a project kind, an extension, and an option set. */
export interface CoveredSetup {
  readonly project: ProjectKind;
  readonly extension: CoveredExtension;
  readonly optionSet: CoveredOptionSet;
  /** How every diagnosis names the setup. */
  readonly label: string;
}

/** How a diagnosis names a project kind. */
const PROJECT_LABELS: Readonly<Record<ProjectKind, string>> = {
  "es-module":
    'the ES-module project (its package.json holding "type": "module")',
  commonjs: "the CommonJS project whose package.json holds no type",
  "no-manifest": "the CommonJS project with no package.json",
};

/** The number of covered setups TEST-SPEC §7.6 counts: 173 programs per arm. */
export const COVERED_SETUP_COUNT = 173;

/**
 * Every covered setup (module header): by project kind, then option set,
 * then extension, the initialized-project set only where it covers the file.
 */
export const COVERED_SETUPS: readonly CoveredSetup[] = Object.freeze(
  PROJECT_KINDS.flatMap((project) =>
    COVERED_OPTION_SETS.flatMap((set) =>
      COVERED_EXTENSIONS.filter(
        (extension) =>
          set.kind === "strict defaults" ||
          compilesAsEsModule(project, extension),
      ).map((extension) =>
        Object.freeze({
          project,
          extension,
          optionSet: set,
          label:
            `a ${extension} configuration file in ` +
            `${PROJECT_LABELS[project]} under ${set.name}`,
        }),
      ),
    ),
  ),
);

/** The covered setups of one project kind, in {@link COVERED_SETUPS} order. */
export function coveredSetupsOf(project: ProjectKind): readonly CoveredSetup[] {
  return COVERED_SETUPS.filter((setup) => setup.project === project);
}

/**
 * The matrix's composition (module header), confirmed at module load: a
 * table drifting from TEST-SPEC §7.6 fails every test importing it.
 */
function checkMatrixComposition(): void {
  const problems: string[] = [];
  if (STRICT_DEFAULT_OPTION_SETS.length !== 14) {
    problems.push(
      `${String(STRICT_DEFAULT_OPTION_SETS.length)} strict defaults, not 14`,
    );
  }
  const names = new Set(COVERED_OPTION_SETS.map((set) => set.name));
  if (names.size !== COVERED_OPTION_SETS.length) {
    problems.push("two option sets share a name");
  }
  for (const set of STRICT_DEFAULT_OPTION_SETS) {
    const keys = Object.keys(set.tsconfig);
    if (
      set.tsconfig["strict"] !== true ||
      keys.some(
        (key) => !["strict", "moduleResolution", "module"].includes(key),
      )
    ) {
      problems.push(`${set.name} sets ${keys.join(", ")}`);
    }
  }
  if (Object.keys(INITIALIZED_PROJECT_OPTION_SET.tsconfig).length !== 15) {
    problems.push("the initialized-project set does not name 15 options");
  }
  if (COVERED_SETUPS.length !== COVERED_SETUP_COUNT) {
    problems.push(
      `${String(COVERED_SETUPS.length)} setups, not ${String(COVERED_SETUP_COUNT)}`,
    );
  }
  if (
    new Set(COVERED_SETUPS.map((setup) => setup.label)).size !==
    COVERED_SETUPS.length
  ) {
    problems.push("two setups share a label");
  }
  let esModuleFiles = 0;
  for (const project of PROJECT_KINDS) {
    for (const extension of COVERED_EXTENSIONS) {
      const esModule = compilesAsEsModule(project, extension);
      if (esModule) esModuleFiles += 1;
      const count = COVERED_SETUPS.filter(
        (setup) => setup.project === project && setup.extension === extension,
      ).length;
      if (count !== 14 + (esModule ? 1 : 0)) {
        problems.push(
          `${String(count)} setups for a ${extension} file in the ${project} project`,
        );
      }
    }
  }
  if (esModuleFiles !== 5) {
    problems.push(
      `${String(esModuleFiles)} file kinds compiled as ES modules, not 5`,
    );
  }
  if (problems.length > 0) {
    throw new Error(
      `module channel's TypeScript driver: the covered setups drift from ` +
        `TEST-SPEC §7.6 Covered setups: ${problems.join("; ")}`,
    );
  }
}

checkMatrixComposition();

/** A path with `/` separators, as TypeScript spells file names. */
function slashed(file: string): string {
  return file.split(path.sep).join("/");
}

/**
 * TypeScript 5.9.3's library directory, by its physical path: where its
 * compiler host finds every library it ships.
 */
const TYPESCRIPT_LIBRARY_DIRECTORY: string = guardSyncStep(
  "reading the physical path of TypeScript 5.9.3's library directory",
  () => slashed(fs.realpathSync(path.dirname(ts.getDefaultLibFilePath({})))),
);

/** Whether `fileName` is a file of TypeScript's own library directory. */
function isTypeScriptLibrary(fileName: string): boolean {
  return path.posix.dirname(fileName) === TYPESCRIPT_LIBRARY_DIRECTORY;
}

/**
 * Parsed libraries (module header): each file of TypeScript's library
 * directory once per target, module format, and JSDoc mode, keyed so.
 */
const parsedLibraries = new Map<string, ts.SourceFile>();

/** {@link parsedLibraries}'s key for a library parse request. */
function libraryKey(
  fileName: string,
  request: ts.ScriptTarget | ts.CreateSourceFileOptions,
): string {
  const options =
    typeof request === "object" ? request : { languageVersion: request };
  return [
    String(options.languageVersion),
    String(options.impliedNodeFormat),
    String(options.jsDocParsingMode),
    fileName,
  ].join("|");
}

/**
 * A program's compiler host (module header): TypeScript's own, with the
 * current directory given, parsed libraries reused, and no write allowed.
 */
function compilerHost(
  options: ts.CompilerOptions,
  currentDirectory: string,
  context: string,
): ts.CompilerHost {
  const base = ts.createCompilerHost(options);
  return {
    ...base,
    getCurrentDirectory: () => currentDirectory,
    getSourceFile: (fileName, request, onError, shouldCreateNewSourceFile) => {
      if (
        shouldCreateNewSourceFile === true ||
        !isTypeScriptLibrary(fileName)
      ) {
        return base.getSourceFile(
          fileName,
          request,
          onError,
          shouldCreateNewSourceFile,
        );
      }
      const key = libraryKey(fileName, request);
      const parsed = parsedLibraries.get(key);
      if (parsed !== undefined) return parsed;
      const made = base.getSourceFile(fileName, request, onError);
      if (made !== undefined) parsedLibraries.set(key, made);
      return made;
    },
    writeFile: (fileName) => {
      throw new Error(
        `module channel's TypeScript driver: a program asked to write ` +
          `${fileName}; the driver never emits (${context})`,
      );
    },
  };
}

/** A fresh copy of a set's options for one program, arrays copied too. */
function programOptions(set: CoveredOptionSet): ts.CompilerOptions {
  const options: ts.CompilerOptions = {};
  for (const [key, value] of Object.entries(set.compilerOptions)) {
    options[key] = Array.isArray(value) ? [...(value as string[])] : value;
  }
  return options;
}

/** Whether a program's options turn declaration diagnostics on. */
function emitsDeclarations(options: ts.CompilerOptions): boolean {
  return options.declaration === true || options.composite === true;
}

// TypeScript 5.9.3's internals this module reads (module header), absent
// from its public declarations and pinned by
// test/self/module-channel-ts.test.ts: a program's include reasons, each
// source file's canonical path and import list, and the reasons' kinds.

/** One reason TypeScript records for a file's presence in a program. */
interface FileIncludeReason {
  readonly kind: number;
  /** The referencing file's canonical path, for a reference's reasons. */
  readonly file?: string;
  /** The reference's index in the referencing file's list of its kind. */
  readonly index?: number;
  /** The type reference an automatic type directive names. */
  readonly typeReference?: string;
}

/** The internal program member this module reads. */
interface IncludeReasonsProgram {
  getFileIncludeReasons(): {
    get(path: string): readonly FileIncludeReason[] | undefined;
  };
}

/** The internal source file members this module reads. */
interface InternalSourceFile {
  readonly path: string;
  readonly imports?: readonly ts.StringLiteralLike[];
}

/** The include-reason kinds this module distinguishes, read from TypeScript. */
interface IncludeKinds {
  readonly RootFile: number;
  readonly Import: number;
  readonly ReferenceFile: number;
  readonly TypeReferenceDirective: number;
  readonly LibFile: number;
  readonly LibReferenceDirective: number;
  readonly AutomaticTypeDirectiveFile: number;
}

/** {@link IncludeKinds}, read from TypeScript's own enumeration at load. */
const INCLUDE_KINDS: IncludeKinds = ((): IncludeKinds => {
  const table = (ts as unknown as { FileIncludeKind?: Record<string, unknown> })
    .FileIncludeKind;
  const names = [
    "RootFile",
    "Import",
    "ReferenceFile",
    "TypeReferenceDirective",
    "LibFile",
    "LibReferenceDirective",
    "AutomaticTypeDirectiveFile",
  ] as const;
  const kinds: Record<string, number> = {};
  for (const name of names) {
    const value = table?.[name];
    if (typeof value !== "number") {
      throw new Error(
        `module channel's TypeScript driver: TypeScript 5.9.3 exposes no ` +
          `include-reason kind ${name} (ts.FileIncludeKind); the program ` +
          `condition is read from these internals (module header)`,
      );
    }
    kinds[name] = value;
  }
  return Object.freeze(kinds as unknown as IncludeKinds);
})();

/** The reference kinds through which a brought-in file brings in another. */
const REFERENCE_KINDS: ReadonlySet<number> = new Set([
  INCLUDE_KINDS.Import,
  INCLUDE_KINDS.ReferenceFile,
  INCLUDE_KINDS.TypeReferenceDirective,
  INCLUDE_KINDS.LibReferenceDirective,
]);

/** How a diagnosis names an include reason. */
function describeReason(
  program: ts.Program,
  reason: FileIncludeReason,
): string {
  const kind =
    Object.entries(INCLUDE_KINDS).find(
      ([, value]) => value === reason.kind,
    )?.[0] ?? `kind ${String(reason.kind)}`;
  if (reason.kind === INCLUDE_KINDS.AutomaticTypeDirectiveFile) {
    return `included automatically as the type package ${String(reason.typeReference)}`;
  }
  if (reason.file === undefined) return kind;
  const from = program.getSourceFileByPath(reason.file as ts.Path);
  const fromName = from?.fileName ?? reason.file;
  if (reason.kind === INCLUDE_KINDS.Import && from !== undefined) {
    const node = (from as unknown as InternalSourceFile).imports?.[
      reason.index ?? -1
    ];
    if (node !== undefined && node.pos < 0) {
      return `imported by an import TypeScript synthesizes in ${fromName} (${JSON.stringify(node.text)})`;
    }
  }
  return `${kind} from ${fromName}`;
}

/** Whether a source file contributes to the global scope (module header). */
function contributesGlobals(file: ts.SourceFile): boolean {
  if (!ts.isExternalModule(file)) return true;
  const reaches = (statements: readonly ts.Statement[]): boolean =>
    statements.some((statement) => {
      if (ts.isNamespaceExportDeclaration(statement)) return true;
      if (!ts.isModuleDeclaration(statement)) return false;
      if ((statement.flags & ts.NodeFlags.GlobalAugmentation) !== 0)
        return true;
      let body = statement.body;
      while (body !== undefined && ts.isModuleDeclaration(body)) {
        if ((body.flags & ts.NodeFlags.GlobalAugmentation) !== 0) return true;
        body = body.body;
      }
      return body !== undefined && ts.isModuleBlock(body)
        ? reaches(body.statements)
        : false;
    });
  return reaches(file.statements);
}

/**
 * Whether an external module augments another module (module header): a
 * `declare module "…"` among its statements, which changes that module for
 * every file of the program.
 */
function augmentsModules(file: ts.SourceFile): boolean {
  return (
    ts.isExternalModule(file) &&
    file.statements.some(
      (statement) =>
        ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name),
    )
  );
}

/** A program's files, classified (module header). */
interface ProgramFiles {
  /** The files of TypeScript's library directory, in program order. */
  readonly libraries: readonly ts.SourceFile[];
  /** Every other file but the roots, in program order. */
  readonly others: readonly ts.SourceFile[];
  /** Each root's own program: the root, what it brings in, the libraries. */
  readonly ownPrograms: readonly ReadonlySet<ts.SourceFile>[];
  /** Why the roots cannot share one program, or undefined where they can. */
  readonly unbatchable: string | undefined;
  /** Whether no file but the libraries contributes to the global scope. */
  readonly librariesAlone: boolean;
}

/**
 * Classify a program's files and check SPEC 7.6's program condition on them
 * (module header), throwing `HarnessStagingError` where a file entered the
 * program otherwise.
 */
function classifyProgram(
  program: ts.Program,
  roots: readonly ts.SourceFile[],
  context: string,
): ProgramFiles {
  const reasons = (
    program as unknown as Partial<IncludeReasonsProgram>
  ).getFileIncludeReasons?.();
  if (reasons === undefined) {
    throw new Error(
      `module channel's TypeScript driver: TypeScript 5.9.3's program has no ` +
        `getFileIncludeReasons; the program condition is read from it ` +
        `(module header; ${context})`,
    );
  }
  const files = program.getSourceFiles();
  const rootSet = new Set(roots);
  const edges = new Map<ts.SourceFile, ts.SourceFile[]>();
  const defaultLibraries: ts.SourceFile[] = [];
  const refused: string[] = [];
  const reasonsOf = (file: ts.SourceFile): readonly FileIncludeReason[] =>
    reasons.get((file as unknown as InternalSourceFile).path) ?? [];
  for (const file of files) {
    for (const reason of reasonsOf(file)) {
      if (reason.kind === INCLUDE_KINDS.RootFile && !rootSet.has(file)) {
        refused.push(`${file.fileName} is a root the driver did not name`);
      }
      if (reason.kind === INCLUDE_KINDS.LibFile) defaultLibraries.push(file);
      if (
        (reason.kind === INCLUDE_KINDS.LibFile ||
          reason.kind === INCLUDE_KINDS.LibReferenceDirective) &&
        !isTypeScriptLibrary(file.fileName)
      ) {
        refused.push(
          `${file.fileName} is a library of the program (${describeReason(program, reason)}) ` +
            `that is no file of TypeScript's own library directory ` +
            `${TYPESCRIPT_LIBRARY_DIRECTORY}: an installed package replaces it`,
        );
      }
      if (!REFERENCE_KINDS.has(reason.kind) || reason.file === undefined) {
        continue;
      }
      const from = program.getSourceFileByPath(reason.file as ts.Path);
      if (from === undefined) {
        refused.push(
          `${file.fileName} is referenced from ${reason.file}, which is no ` +
            `file of the program`,
        );
        continue;
      }
      if (reason.kind === INCLUDE_KINDS.Import) {
        const node = (from as unknown as InternalSourceFile).imports?.[
          reason.index ?? -1
        ];
        if (node === undefined) {
          throw new Error(
            `module channel's TypeScript driver: TypeScript records an ` +
              `import of ${file.fileName} at index ${String(reason.index)} ` +
              `of ${from.fileName}, which lists no such import (module ` +
              `header; ${context})`,
          );
        }
        if (node.pos < 0) continue;
      }
      const list = edges.get(from) ?? [];
      list.push(file);
      edges.set(from, list);
    }
  }
  const closure = (starts: readonly ts.SourceFile[]): Set<ts.SourceFile> => {
    const seen = new Set<ts.SourceFile>(starts);
    const queue = [...starts];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      for (const reached of edges.get(next) ?? []) {
        if (!seen.has(reached)) {
          seen.add(reached);
          queue.push(reached);
        }
      }
    }
    return seen;
  };
  const libraryClosure = closure(defaultLibraries);
  const ownPrograms = roots.map((root) => {
    const own = closure([root]);
    for (const library of libraryClosure) own.add(library);
    return own;
  });
  for (const file of files) {
    if (rootSet.has(file) || ownPrograms.some((own) => own.has(file))) continue;
    refused.push(
      `${file.fileName} entered the program otherwise (${
        reasonsOf(file)
          .map((reason) => describeReason(program, reason))
          .join("; ") || "no reason recorded"
      })`,
    );
  }
  if (refused.length > 0) {
    throw new HarnessStagingError(
      MODE,
      roots.map((root) => root.fileName).join(", "),
      `${context}: SPEC 7.6's program condition does not hold — ` +
        `${refused.join("; ")}. Nothing enters the program but the root, ` +
        `TypeScript's own libraries for the option set, and what the root's ` +
        `import declaration brings in; neither an @types package TypeScript ` +
        `includes automatically nor a module it imports implicitly adds ` +
        `anything (SPEC 7.6 Covered setups, Program; TEST-SPEC §7.6 Placement: ` +
        `where a condition fails, no arm asserts anything there)`,
    );
  }
  const libraries = files.filter((file) => isTypeScriptLibrary(file.fileName));
  const librarySet = new Set(libraries);
  const others = files.filter(
    (file) => !rootSet.has(file) && !librarySet.has(file),
  );
  const librariesAlone = files.every(
    (file) => librarySet.has(file) || !contributesGlobals(file),
  );
  let unbatchable: string | undefined;
  if (roots.length > 1) {
    const nonRoots = files.filter((file) => !rootSet.has(file));
    const scriptRoot = roots.find(contributesGlobals);
    const augmentingRoot = roots.find(augmentsModules);
    const partial = roots.find((root, index) => {
      const own = ownPrograms[index];
      return (
        own === undefined ||
        nonRoots.some((file) => !own.has(file)) ||
        roots.some((other) => other !== root && own.has(other))
      );
    });
    if (scriptRoot !== undefined) {
      unbatchable = `${scriptRoot.fileName} contributes to the global scope`;
    } else if (augmentingRoot !== undefined) {
      unbatchable = `${augmentingRoot.fileName} augments a module`;
    } else if (partial !== undefined) {
      unbatchable =
        `the roots' imports bring in different files (${partial.fileName}'s ` +
        `own program is not every non-root file of the batch, or holds ` +
        `another root)`;
    }
  }
  return { libraries, others, ownPrograms, unbatchable, librariesAlone };
}

/** One error of a file's program (module header). */
export interface ProgramError {
  /** Where TypeScript reports it. */
  readonly origin: "options" | "global" | "configuration file" | "another file";
  /** The file it is located in, for the last two origins. */
  readonly file?: string;
  /** Its 1-based line and column there. */
  readonly line?: number;
  readonly column?: number;
  /** TypeScript's error code, a diagnostic aid: verdicts pin none. */
  readonly code: number;
  readonly message: string;
}

/** Where an export listing finds a name (module header). */
export type ExportSource = "exports" | "export assignment";

/**
 * One name the module a covered file's import resolves to declares, with
 * its meanings (module header; TEST-SPEC T7.6-1).
 */
export interface ListedExport {
  /** The name, as an import spells it. */
  readonly name: string;
  /** A value meaning an import may use as a value. */
  readonly value: boolean;
  /**
   * A value meaning no import may use as a value, reached only through
   * `export type`, `import type`, or `export type *` (`value` then false).
   */
  readonly typeOnlyValue: boolean;
  /** A type meaning. */
  readonly type: boolean;
  /** A namespace meaning. */
  readonly namespace: boolean;
  /**
   * Where the listing finds it: among the module's exports, among the
   * members of its export assignment's value, or both, in that order.
   */
  readonly listedIn: readonly ExportSource[];
}

/**
 * The listing of the module a covered file's one import declaration
 * resolves to, in that file's program (module header; TEST-SPEC T7.6-1).
 */
export interface ExportListing {
  /**
   * The file declaring the module, by the name TypeScript read it under;
   * undefined where TypeScript resolves the import to no module it reads
   * declarations from.
   */
  readonly module: string | undefined;
  /** Whether that module declares an export assignment (`export =`). */
  readonly exportAssignment: boolean;
  /** Every name it declares, in UTF-16 code-unit order. */
  readonly exports: readonly ListedExport[];
}

/**
 * A symbol's meaning flags through its aliases, as TypeScript reads them
 * (module header): an alias TypeScript cannot resolve carries every meaning.
 */
function meaningFlags(checker: ts.TypeChecker, symbol: ts.Symbol): number {
  if ((symbol.flags & ts.SymbolFlags.Alias) === 0) return symbol.flags;
  const target = checker.getAliasedSymbol(symbol);
  return checker.isUnknownSymbol(target)
    ? ts.SymbolFlags.All
    : symbol.flags | target.flags;
}

/** Whether an alias along `symbol`'s chain is declared type-only. */
function declaredTypeOnly(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
  const seen = new Set<ts.Symbol>();
  let current: ts.Symbol | undefined = symbol;
  while (
    current !== undefined &&
    (current.flags & ts.SymbolFlags.Alias) !== 0 &&
    !seen.has(current)
  ) {
    seen.add(current);
    if (
      current.declarations?.some((declaration) =>
        ts.isTypeOnlyImportOrExportDeclaration(declaration),
      ) === true
    ) {
      return true;
    }
    current = checker.getImmediateAliasedSymbol(current);
  }
  return false;
}

/**
 * Whether an escaped symbol name is TypeScript's own rather than one an
 * import spells: TypeScript gives every spelled name beginning `__` one more
 * `_`, so an escaped name beginning `__` and then another character names a
 * symbol-keyed member, a private name, or an internal entry.
 */
function isInternalName(escapedName: string): boolean {
  return escapedName.startsWith("__") && escapedName.charAt(2) !== "_";
}

/** A name's meanings as the listing gathers them, before it is frozen. */
interface GatheredExport {
  value: boolean;
  typeOnlyValue: boolean;
  type: boolean;
  namespace: boolean;
  readonly listedIn: Set<ExportSource>;
}

/**
 * The export listing of `root`'s one import declaration in `program`
 * (module header), read once the program's diagnostics are all read; a
 * root holding no import declaration, or more than one, is a misuse.
 */
function listModuleExports(
  program: ts.Program,
  root: ts.SourceFile,
  context: string,
): ExportListing {
  const declarations = root.statements.filter(ts.isImportDeclaration);
  const [declaration] = declarations;
  if (declarations.length !== 1 || declaration === undefined) {
    throw new Error(
      `module channel's TypeScript driver: an export listing reads the ` +
        `module a covered file's one import declaration resolves to, and ` +
        `${root.fileName} holds ${String(declarations.length)} import ` +
        `declarations (${context})`,
    );
  }
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(declaration.moduleSpecifier);
  if (moduleSymbol === undefined) {
    return Object.freeze({
      module: undefined,
      exportAssignment: false,
      exports: Object.freeze([]),
    });
  }
  const moduleFile = moduleSymbol.declarations?.[0]?.getSourceFile().fileName;
  if (moduleFile === undefined) {
    throw new Error(
      `module channel's TypeScript driver: TypeScript resolves the import of ` +
        `${root.fileName} to a module with no declaration (${context})`,
    );
  }
  const assignment = moduleSymbol.exports?.get(
    ts.InternalSymbolName.ExportEquals,
  );
  const moduleType =
    assignment === undefined
      ? checker.getTypeOfSymbol(moduleSymbol)
      : undefined;
  const gathered = new Map<string, GatheredExport>();
  const gather = (symbol: ts.Symbol, source: ExportSource): void => {
    if (isInternalName(symbol.escapedName as string)) return;
    const name = ts.unescapeLeadingUnderscores(symbol.escapedName);
    const flags = meaningFlags(checker, symbol);
    const carriesValue = (flags & ts.SymbolFlags.Value) !== 0;
    let typeOnly = false;
    if (carriesValue && source === "exports") {
      typeOnly =
        moduleType === undefined
          ? declaredTypeOnly(checker, symbol)
          : checker.getPropertyOfType(moduleType, name) !== symbol;
    }
    const entry = gathered.get(name) ?? {
      value: false,
      typeOnlyValue: false,
      type: false,
      namespace: false,
      listedIn: new Set<ExportSource>(),
    };
    if (carriesValue && !typeOnly) entry.value = true;
    if (carriesValue && typeOnly) entry.typeOnlyValue = true;
    if ((flags & ts.SymbolFlags.Type) !== 0) entry.type = true;
    if ((flags & ts.SymbolFlags.Namespace) !== 0) entry.namespace = true;
    entry.listedIn.add(source);
    gathered.set(name, entry);
  };
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    gather(symbol, "exports");
  }
  if (assignment !== undefined) {
    for (const member of checker.getPropertiesOfType(
      checker.getTypeOfSymbol(assignment),
    )) {
      gather(member, "export assignment");
    }
  }
  const sources: readonly ExportSource[] = ["exports", "export assignment"];
  const exports = [...gathered.keys()].sort().map((name): ListedExport => {
    const entry = gathered.get(name);
    if (entry === undefined) throw new Error("unreachable: a gathered name");
    return Object.freeze({
      name,
      value: entry.value,
      typeOnlyValue: entry.typeOnlyValue && !entry.value,
      type: entry.type,
      namespace: entry.namespace,
      listedIn: Object.freeze(
        sources.filter((source) => entry.listedIn.has(source)),
      ),
    });
  });
  return Object.freeze({
    module: moduleFile,
    exportAssignment: assignment !== undefined,
    exports: Object.freeze(exports),
  });
}

/** A root's share of a program's run: its program's errors and files. */
interface RootOutcome {
  readonly errors: readonly ProgramError[];
  readonly programFiles: readonly string[];
  /** Its import's export listing, where the request asked for one. */
  readonly exportListing: ExportListing | undefined;
}

/** One program's run over its roots. */
interface ProgramOutcome {
  readonly perRoot: readonly RootOutcome[];
  /** The program's options, read back from it. */
  readonly compilerOptions: Readonly<ts.CompilerOptions>;
  /** Why its roots could not share it, or undefined where they could. */
  readonly unbatchable: string | undefined;
}

/**
 * The libraries' own diagnostics, by option set and library list, wherever
 * no other file of the program contributes to the global scope (module
 * header).
 */
const libraryDiagnostics = new Map<string, readonly ts.Diagnostic[]>();

/** A file's syntactic, semantic, and (where on) declaration diagnostics. */
function diagnosticsOf(
  program: ts.Program,
  file: ts.SourceFile,
  declarations: boolean,
): ts.Diagnostic[] {
  const list: ts.Diagnostic[] = [
    ...program.getSyntacticDiagnostics(file),
    ...program.getSemanticDiagnostics(file),
  ];
  if (declarations) list.push(...program.getDeclarationDiagnostics(file));
  return list;
}

/** A root's errors: every error-category diagnostic, deduplicated. */
function programErrors(
  diagnostics: readonly ts.Diagnostic[],
  root: ts.SourceFile,
  optionDiagnostics: ReadonlySet<ts.Diagnostic>,
): readonly ProgramError[] {
  return Object.freeze(
    ts
      .sortAndDeduplicateDiagnostics(diagnostics)
      .filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
      )
      .map((diagnostic): ProgramError => {
        const message = flatten(diagnostic);
        if (diagnostic.file === undefined) {
          return Object.freeze({
            origin: optionDiagnostics.has(diagnostic) ? "options" : "global",
            code: diagnostic.code,
            message,
          });
        }
        const at = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start ?? 0,
        );
        return Object.freeze({
          origin:
            diagnostic.file === root ? "configuration file" : "another file",
          file: diagnostic.file.fileName,
          line: at.line + 1,
          column: at.character + 1,
          code: diagnostic.code,
          message,
        });
      }),
  );
}

/** A program over `rootPaths` under `setup`'s option set, its roots read. */
function createProgram(
  setup: CoveredSetup,
  rootPaths: readonly string[],
  currentDirectory: string,
  context: string,
): { readonly program: ts.Program; readonly roots: readonly ts.SourceFile[] } {
  const options = programOptions(setup.optionSet);
  const program = ts.createProgram({
    rootNames: [...rootPaths],
    options,
    host: compilerHost(options, currentDirectory, context),
  });
  const roots = rootPaths.map((rootPath) => {
    const root = program.getSourceFile(rootPath);
    if (root === undefined) {
      throw new HarnessStagingError(
        MODE,
        rootPath,
        `${context}: TypeScript read no root file at ${rootPath} under ` +
          `${setup.label}`,
      );
    }
    return root;
  });
  return { program, roots };
}

/** The program's options, read back from it, arrays copied. */
function readBackOptions(program: ts.Program): Readonly<ts.CompilerOptions> {
  const options: ts.CompilerOptions = {};
  for (const [key, value] of Object.entries(program.getCompilerOptions())) {
    options[key] = Array.isArray(value) ? [...(value as string[])] : value;
  }
  return Object.freeze(options);
}

/** Each root's own program's files, in program order. */
function ownProgramFiles(
  program: ts.Program,
  own: ReadonlySet<ts.SourceFile>,
): readonly string[] {
  return Object.freeze(
    program
      .getSourceFiles()
      .filter((file) => own.has(file))
      .map((file) => file.fileName),
  );
}

/**
 * Run one program over `rootPaths` with the sharing the module header
 * argues: the libraries' diagnostics read once per option set and library
 * list where that is sound, then the program's other shared files, then
 * each root; each root's errors read from the shared diagnostics and its own,
 * and then, where `listExports` asks, its import's export listing.
 */
function runSharedProgram(
  setup: CoveredSetup,
  rootPaths: readonly string[],
  currentDirectory: string,
  context: string,
  listExports: boolean,
): ProgramOutcome {
  const { program, roots } = createProgram(
    setup,
    rootPaths,
    currentDirectory,
    context,
  );
  const files = classifyProgram(program, roots, context);
  const declarations = emitsDeclarations(program.getCompilerOptions());
  const optionDiagnostics = program.getOptionsDiagnostics();
  const shared: ts.Diagnostic[] = [
    ...optionDiagnostics,
    ...program.getGlobalDiagnostics(),
  ];
  const libraryKeyOfProgram = [
    setup.optionSet.name,
    ...files.libraries.map((file) => file.fileName).sort(),
  ].join(LF);
  const remembered = files.librariesAlone
    ? libraryDiagnostics.get(libraryKeyOfProgram)
    : undefined;
  if (remembered !== undefined) {
    shared.push(...remembered);
  } else {
    const read = files.libraries.flatMap((file) =>
      diagnosticsOf(program, file, declarations),
    );
    shared.push(...read);
    if (files.librariesAlone) {
      libraryDiagnostics.set(libraryKeyOfProgram, Object.freeze(read));
    }
  }
  for (const file of files.others) {
    shared.push(...diagnosticsOf(program, file, declarations));
  }
  const globalBefore = program.getGlobalDiagnostics().length;
  const own = roots.map((root) => diagnosticsOf(program, root, declarations));
  let unbatchable = files.unbatchable;
  if (
    roots.length > 1 &&
    unbatchable === undefined &&
    (program.getGlobalDiagnostics().length !== globalBefore ||
      own.some((list) =>
        list.some((diagnostic) => diagnostic.file === undefined),
      ))
  ) {
    unbatchable = "a root's check raised a global diagnostic";
  }
  const finalGlobal = roots.length === 1 ? program.getGlobalDiagnostics() : [];
  const options = new Set(optionDiagnostics);
  const perRoot = roots.map((root, index) => ({
    errors: programErrors(
      [...shared, ...(own[index] ?? []), ...finalGlobal],
      root,
      options,
    ),
    programFiles: ownProgramFiles(
      program,
      files.ownPrograms[index] ?? new Set(),
    ),
  }));
  return {
    perRoot: perRoot.map((outcome, index) => {
      const root = roots[index];
      if (root === undefined)
        throw new Error("unreachable: a root per outcome");
      return {
        ...outcome,
        exportListing: listExports
          ? listModuleExports(program, root, context)
          : undefined,
      };
    }),
    compilerOptions: readBackOptions(program),
    unbatchable,
  };
}

/**
 * The reference reading (module header): one root, nothing shared but
 * parsed libraries, every diagnostic read as `ts.getPreEmitDiagnostics`
 * reads it, and the global diagnostics again once everything is checked;
 * then, where `listExports` asks, the root's export listing.
 */
function runUnsharedProgram(
  setup: CoveredSetup,
  rootPath: string,
  currentDirectory: string,
  context: string,
  listExports: boolean,
): ProgramOutcome {
  const { program, roots } = createProgram(
    setup,
    [rootPath],
    currentDirectory,
    context,
  );
  const files = classifyProgram(program, roots, context);
  const root = roots[0];
  if (root === undefined) throw new Error("unreachable: one root");
  const diagnostics = [
    ...ts.getPreEmitDiagnostics(program),
    ...program.getGlobalDiagnostics(),
  ];
  const errors = programErrors(
    diagnostics,
    root,
    new Set(program.getOptionsDiagnostics()),
  );
  return {
    perRoot: [
      {
        errors,
        programFiles: ownProgramFiles(
          program,
          files.ownPrograms[0] ?? new Set(),
        ),
        exportListing: listExports
          ? listModuleExports(program, root, context)
          : undefined,
      },
    ],
    compilerOptions: readBackOptions(program),
    unbatchable: undefined,
  };
}

/** One file a test stages for the driver to judge. */
export interface CoveredFile {
  /** Names the file in every diagnosis; unique within one staging request. */
  readonly label: string;
  /** Its bytes, written unchanged under each extension its setups name. */
  readonly text: string | Uint8Array;
}

/** {@link stageCoveredFiles}'s request. */
export interface CoveredFilesRequest {
  readonly staging: ModuleStaging;
  /**
   * The directory the files are written in, staging-relative: the importing
   * files' directory (the project directory for the canonical placement).
   */
  readonly directory: string;
  /** The project kind staged for `directory`; every setup must be of it. */
  readonly project: ProjectKind;
  /**
   * For a CommonJS project whose nearest `package.json` holds the `type`
   * `"commonjs"` (T7.6-5(c)): that member, which Reach confirms with the
   * project kind (helpers/module-channel.ts `ReachStaging.nearestType`);
   * the setups stay the CommonJS project's.
   */
  readonly nearestType?: CommonJsTypeMember;
  /**
   * The placement every file's import reaches: Reach is verified for each
   * written file against it, confirming the project kind too. Without one,
   * no package is reached and nothing of Reach is checked.
   */
  readonly placement?: Placement;
  /**
   * Whether nothing but `placement` is installed in the staging (the
   * canonical placement's "nothing else installed"), confirmed where set.
   */
  readonly alone?: boolean;
  readonly files: readonly CoveredFile[];
  /** The setups to judge: every covered setup of `project` unless given. */
  readonly setups?: readonly CoveredSetup[];
  /**
   * The programs' current directory, staging-relative: `directory` unless
   * given, inside the staging either way.
   */
  readonly currentDirectory?: string;
  /**
   * Whether each verdict carries the export listing of the module its
   * file's one import declaration resolves to (module header), every file
   * then holding exactly one import declaration.
   */
  readonly listExports?: boolean;
  /** Leads every diagnosis: the arm the files serve. */
  readonly context: string;
}

/** A file's verdict in one setup (module header). */
export interface CoveredVerdict {
  readonly setup: CoveredSetup;
  /** The file's label. */
  readonly label: string;
  /** The configuration file, by its physical path: the program's root. */
  readonly file: string;
  /** The placement's path, where the request named one. */
  readonly placement: string | undefined;
  /** Every error TypeScript reports for the file's program. */
  readonly errors: readonly ProgramError[];
  /** No error anywhere in the program (TEST-SPEC §7.6 Verdict). */
  readonly typeChecks: boolean;
  /** At least one error located in the configuration file. */
  readonly failsToTypeCheck: boolean;
  /** The file's program's files, by the names TypeScript read them under. */
  readonly programFiles: readonly string[];
  /** The program's options, read back from it. */
  readonly compilerOptions: Readonly<ts.CompilerOptions>;
  /**
   * The export listing of the module the file's import resolves to, where
   * the request asked for it (`listExports`); undefined otherwise.
   */
  readonly exportListing: ExportListing | undefined;
  /** How it was reached: in a batch, in a program of its own, or unshared. */
  readonly judged: "batched" | "own program" | "unshared";
}

/** The per-staging counter naming the files the driver writes. */
const writtenFiles = new WeakMap<ModuleStaging, number>();

/** The staging-relative path of `name` in `directory`. */
function inDirectory(directory: string, name: string): string {
  return directory === "" || directory === "." ? name : `${directory}/${name}`;
}

/** How a misuse's diagnosis names a request. */
function describeRequest(request: CoveredFilesRequest): string {
  return `${request.context}; directory ${JSON.stringify(request.directory)}`;
}

/**
 * Write `request.files` once per extension the setups name and verify Reach
 * for each written file (module header), resolving to the judge of those
 * files. Nothing is type-checked yet: {@link CoveredFiles.judge} checks one
 * setup at a time, so a body can fail at its first failing setup.
 */
export async function stageCoveredFiles(
  request: CoveredFilesRequest,
): Promise<CoveredFiles> {
  const setups = request.setups ?? coveredSetupsOf(request.project);
  if (request.files.length === 0) {
    throw new Error(
      `module channel's TypeScript driver: no file to judge (${describeRequest(request)})`,
    );
  }
  if (
    new Set(request.files.map((file) => file.label)).size !==
    request.files.length
  ) {
    throw new Error(
      `module channel's TypeScript driver: two files share a label (${describeRequest(request)})`,
    );
  }
  if (setups.length === 0) {
    throw new Error(
      `module channel's TypeScript driver: no setup to judge in (${describeRequest(request)})`,
    );
  }
  for (const setup of setups) {
    if (!COVERED_SETUPS.includes(setup) || setup.project !== request.project) {
      throw new Error(
        `module channel's TypeScript driver: ${setup.label} is no covered ` +
          `setup of the ${request.project} project (${describeRequest(request)})`,
      );
    }
  }
  const { staging } = request;
  const extensions = COVERED_EXTENSIONS.filter((extension) =>
    setups.some((setup) => setup.extension === extension),
  );
  const serials = request.files.map(() => {
    const serial = (writtenFiles.get(staging) ?? 0) + 1;
    writtenFiles.set(staging, serial);
    return serial;
  });
  const written = new Map<CoveredExtension, readonly string[]>();
  for (const extension of extensions) {
    const paths: string[] = [];
    for (const [index, file] of request.files.entries()) {
      const name = `covered-file-${String(serials[index])}${extension}`;
      const at = await staging.writeFile(
        inDirectory(request.directory, name),
        file.text,
      );
      const physical = await guardStep(
        `reading the physical path of ${at} (${request.context})`,
        () => fsp.realpath(at),
      );
      if (!physical.startsWith(`${staging.root}${path.sep}`)) {
        throw new HarnessStagingError(
          MODE,
          physical,
          `${request.context}: the configuration file ${at} lies at ` +
            `${physical}, outside the staging ${staging.root}`,
        );
      }
      if (request.placement !== undefined) {
        await staging.verifyReach({
          importingFile: path
            .relative(staging.root, physical)
            .split(path.sep)
            .join("/"),
          placement: request.placement,
          project: request.project,
          ...(request.nearestType === undefined
            ? {}
            : { nearestType: request.nearestType }),
          ...(request.alone === undefined ? {} : { alone: request.alone }),
        });
      }
      paths.push(slashed(physical));
    }
    written.set(extension, Object.freeze(paths));
  }
  const currentDirectory = await guardStep(
    `reading the physical path of the programs' current directory (${request.context})`,
    async () => {
      const given = staging.path(request.currentDirectory ?? request.directory);
      try {
        return await fsp.realpath(given);
      } catch (error) {
        throw new Error(
          `module channel's TypeScript driver: the programs' current ` +
            `directory ${given} cannot be read (${String(error)}); stage it ` +
            `before judging (${describeRequest(request)})`,
        );
      }
    },
  );
  if (
    currentDirectory !== staging.root &&
    !currentDirectory.startsWith(`${staging.root}${path.sep}`)
  ) {
    throw new HarnessStagingError(
      MODE,
      currentDirectory,
      `${request.context}: the programs' current directory ${currentDirectory} ` +
        `lies outside the staging ${staging.root}; each program's host takes a ` +
        `directory inside the staging as its current directory`,
    );
  }
  return new CoveredFiles(request, setups, written, slashed(currentDirectory));
}

/**
 * The judge of one request's files (module header): each covered setup
 * judged in one program per call, the files' verdicts in request order.
 */
export class CoveredFiles {
  /** The setups the files are judged in, in the request's order. */
  readonly setups: readonly CoveredSetup[];
  /** Leads every diagnosis. */
  readonly context: string;
  readonly #labels: readonly string[];
  readonly #placement: string | undefined;
  readonly #written: ReadonlyMap<CoveredExtension, readonly string[]>;
  readonly #currentDirectory: string;
  readonly #listExports: boolean;

  constructor(
    request: CoveredFilesRequest,
    setups: readonly CoveredSetup[],
    written: ReadonlyMap<CoveredExtension, readonly string[]>,
    currentDirectory: string,
  ) {
    this.setups = Object.freeze([...setups]);
    this.context = request.context;
    this.#labels = Object.freeze(request.files.map((file) => file.label));
    this.#placement = request.placement?.path;
    this.#written = written;
    this.#currentDirectory = currentDirectory;
    this.#listExports = request.listExports === true;
  }

  /** What a step's description adds where each program lists exports too. */
  get #listing(): string {
    return this.#listExports ? ", listing each import's exports" : "";
  }

  /** The written files of `setup`'s extension, by physical path. */
  #files(setup: CoveredSetup): readonly string[] {
    const files = this.setups.includes(setup)
      ? this.#written.get(setup.extension)
      : undefined;
    if (files === undefined) {
      throw new Error(
        `module channel's TypeScript driver: ${setup.label} is not among ` +
          `the setups these files were staged for (${this.context})`,
      );
    }
    return files;
  }

  /** A verdict from a program's outcome for one root. */
  #verdict(
    setup: CoveredSetup,
    index: number,
    outcome: ProgramOutcome,
    rootIndex: number,
    judged: CoveredVerdict["judged"],
  ): CoveredVerdict {
    const root = outcome.perRoot[rootIndex];
    const file = this.#files(setup)[index];
    const label = this.#labels[index];
    if (root === undefined || file === undefined || label === undefined) {
      throw new Error("unreachable: a verdict for every staged file");
    }
    return Object.freeze({
      setup,
      label,
      file,
      placement: this.#placement,
      errors: root.errors,
      typeChecks: root.errors.length === 0,
      failsToTypeCheck: root.errors.some(
        (error) => error.origin === "configuration file",
      ),
      programFiles: root.programFiles,
      compilerOptions: outcome.compilerOptions,
      exportListing: root.exportListing,
      judged,
    });
  }

  /**
   * Judge every file in `setup` (module header): one program whose roots
   * they all are, or, where that batch is not sound, one program per file;
   * each program's check a harness step under its own guard.
   */
  judge(setup: CoveredSetup): readonly CoveredVerdict[] {
    const files = this.#files(setup);
    const batch = guardSyncStep(
      `type-checking ${String(files.length)} configuration file(s) in one ` +
        `program${this.#listing}, ${setup.label} (${this.context})`,
      () =>
        runSharedProgram(
          setup,
          files,
          this.#currentDirectory,
          this.context,
          this.#listExports,
        ),
    );
    if (files.length === 1 || batch.unbatchable === undefined) {
      return Object.freeze(
        files.map((_file, index) =>
          this.#verdict(
            setup,
            index,
            batch,
            index,
            files.length === 1 ? "own program" : "batched",
          ),
        ),
      );
    }
    return Object.freeze(
      files.map((file, index) => {
        const own = guardSyncStep(
          `type-checking ${file} in a program of its own${this.#listing}, ` +
            `${setup.label}, since ` +
            `${batch.unbatchable ?? "the batch is unsound"} (${this.context})`,
          () =>
            runSharedProgram(
              setup,
              [file],
              this.#currentDirectory,
              this.context,
              this.#listExports,
            ),
        );
        return this.#verdict(setup, index, own, 0, "own program");
      }),
    );
  }

  /**
   * Judge the file labelled `label` in `setup` by the reference reading
   * (module header): one root, nothing shared but parsed libraries.
   */
  judgeUnshared(setup: CoveredSetup, label: string): CoveredVerdict {
    const index = this.#labels.indexOf(label);
    const file = this.#files(setup)[index];
    if (index < 0 || file === undefined) {
      throw new Error(
        `module channel's TypeScript driver: no staged file is labelled ` +
          `${JSON.stringify(label)} (${this.context})`,
      );
    }
    const outcome = guardSyncStep(
      `type-checking ${file} unshared${this.#listing}, ${setup.label} ` +
        `(${this.context})`,
      () =>
        runUnsharedProgram(
          setup,
          file,
          this.#currentDirectory,
          this.context,
          this.#listExports,
        ),
    );
    return this.#verdict(setup, index, outcome, 0, "unshared");
  }
}

/** How a diagnosis lists a verdict's errors: the first twelve, then a count. */
export function describeErrors(errors: readonly ProgramError[]): string {
  if (errors.length === 0) return "no error";
  const shown = errors.slice(0, 12).map((error) => {
    const at =
      error.file === undefined
        ? error.origin
        : `${error.origin} ${error.file}:${String(error.line)}:${String(error.column)}`;
    return `TS${String(error.code)} (${at}): ${error.message.split(LF).join(" ")}`;
  });
  const rest = errors.length - shown.length;
  return shown.join("; ") + (rest > 0 ? `; and ${String(rest)} more` : "");
}

/** `n` and `word`, pluralized. */
function count(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** How a diagnosis states one listed export: its name and its meanings. */
export function describeListedExport(entry: ListedExport): string {
  const meanings = [
    ...(entry.value ? ["value"] : []),
    ...(entry.typeOnlyValue ? ["value reached only type-only"] : []),
    ...(entry.type ? ["type"] : []),
    ...(entry.namespace ? ["namespace"] : []),
  ];
  return (
    `${JSON.stringify(entry.name)} (${meanings.join(", ") || "no meaning"}; ` +
    `listed among ${entry.listedIn
      .map((source) =>
        source === "exports"
          ? "the module's exports"
          : "the export assignment's members",
      )
      .join(" and ")})`
  );
}

/**
 * How a diagnosis states an export listing (module header): the module
 * TypeScript resolves the import to and every name it declares.
 */
export function describeExportListing(
  listing: ExportListing | undefined,
): string {
  if (listing === undefined) return "no export listing (none was asked for)";
  if (listing.module === undefined) {
    return (
      "no module: TypeScript resolves the import to no module it reads " +
      "declarations from, so it declares no export"
    );
  }
  const names = listing.exports.map(describeListedExport);
  return (
    `the module ${listing.module}` +
    (listing.exportAssignment ? ", which declares an export assignment," : "") +
    ` declaring ${count(listing.exports.length, "export")}` +
    (names.length === 0 ? "" : `: ${names.join(", ")}`)
  );
}

/**
 * Assert that a file type-checks (TEST-SPEC §7.6 Verdict): TypeScript
 * reports no error for its program, in any of its files; a diagnosed
 * failure naming the setup and every error otherwise.
 */
export function assertTypeChecks(
  verdict: CoveredVerdict,
  context: string,
): void {
  if (verdict.typeChecks) return;
  fail(
    `${context}: the configuration file ${verdict.label} (${verdict.file}) ` +
      `does not type-check in ${verdict.setup.label}: TypeScript 5.9.3 ` +
      `reports ${count(verdict.errors.length, "error")} for its program — ` +
      `${describeErrors(verdict.errors)} (TEST-SPEC §7.6 Verdict: a file ` +
      `type-checks when TypeScript reports no error for its program, in any ` +
      `of its files)`,
  );
}

/**
 * Assert a shape-violation arm (TEST-SPEC §7.6 Verdict, Pairing): its valid
 * twin type-checks in the same setup and placement, and the arm fails to
 * type-check there — at least one error located in its configuration file.
 * Either failing is a diagnosed failure; verdicts of different setups,
 * placements, or directories are a misuse.
 */
export function assertShapeViolation(
  twin: CoveredVerdict,
  arm: CoveredVerdict,
  context: string,
): void {
  if (
    twin.setup !== arm.setup ||
    twin.placement !== arm.placement ||
    path.posix.dirname(twin.file) !== path.posix.dirname(arm.file)
  ) {
    throw new Error(
      `module channel's TypeScript driver: ${arm.label} is paired with ` +
        `${twin.label} across setups, placements, or directories; a ` +
        `shape-violation arm is paired with its twin in the same setup and ` +
        `placement (${context})`,
    );
  }
  if (!twin.typeChecks) {
    fail(
      `${context}: the shape-violation arm ${arm.label} counts only where its ` +
        `valid twin type-checks in the same setup and placement, and the twin ` +
        `${twin.label} (${twin.file}) does not type-check in ` +
        `${twin.setup.label}: TypeScript 5.9.3 reports ` +
        `${count(twin.errors.length, "error")} for its program — ` +
        `${describeErrors(twin.errors)} (TEST-SPEC §7.6 Pairing)`,
    );
  }
  if (!arm.failsToTypeCheck) {
    fail(
      `${context}: the shape-violation arm ${arm.label} (${arm.file}) does not ` +
        `fail to type-check in ${arm.setup.label}: TypeScript 5.9.3 reports no ` +
        `error located in the configuration file (${count(arm.errors.length, "error")} ` +
        `in its program: ${describeErrors(arm.errors)}), while its valid twin ` +
        `${twin.label} type-checks there (TEST-SPEC §7.6 Verdict: a file fails ` +
        `to type-check when TypeScript reports at least one error located in ` +
        `the configuration file)`,
    );
  }
}
