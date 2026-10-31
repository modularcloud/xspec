// S-4's detections of 7.6's covered setups (TEST-SPEC 17 S-4, from "7.6's
// covered setups are detected in effect likewise"; §7.6 Covered setups,
// Verdict; SPEC 7.6 Covered setups). Every type-checking arm of 7.6 judges
// its files through the module channel's TypeScript driver
// (helpers/module-channel-ts.ts) in each of the 173 covered setups. A driver
// serving one setup's settings for another's would make that setup's arms a
// rerun of the other's, one dropping a setup or a setting would leave it
// unjudged, and a verdict blind to a diagnostic kind would miss what that
// kind reports, each passing conformer and violator alike. So, before any
// product exists, each setting is detected in effect here through that same
// driver (`stageCoveredFiles`, `CoveredFiles.judge`), over hand-written
// non-xspec stand-in packages placed as the tests place a package
// (helpers/module-channel.ts: a fresh staging, the canonical placement,
// Reach verified, nothing else installed but the one `@types` stand-in the
// `types` detection needs), in each setup whose verdict the setting decides,
// both sides: rejected where the setting rejects the construct, admitted
// where it admits it. T7.6-1's export listing, which the same driver reads,
// is detected last (below).
//
// The detections, each with the setups it is judged in and those that
// reject it (release 5.9.3's verdicts, wherever it gives a value an effect
// of its own; TypeScript's error code is a diagnostic aid, never pinned).
// First, the fourteen strict defaults' `moduleResolution` and `module`
// values, which spell every value the matrix holds, each judged in
// strict-default setups alone:
// - `moduleResolution`: an `exports`-only stand-in, which `node10` alone does
//   not resolve — every strict-default setup, rejected under `node10` (an
//   error at the import's specifier, TS2307), admitted under `node16`,
//   `nodenext`, and `bundler`.
// - `module` under the `node16` and `nodenext` modes, each file TypeScript
//   compiles as CommonJS (`.cts` in every project, `.ts` and `.tsx` in the
//   two CommonJS ones): an ES-module-only stand-in, rejected under `node16`
//   and `node18` (an error at the specifier, TS1479), admitted under `node20`
//   and `nodenext`, which let `require` load an ES module.
// - `module` under those modes, each file TypeScript compiles as an ES
//   module (`.mts` in every project, `.ts` and `.tsx` in the ES-module one):
//   import attributes on an import of a JavaScript module, rejected under
//   `node16` (an error at the attributes, TS2823), admitted under `node18`,
//   `node20`, and `nodenext`.
// - `module`'s default target under those modes, every file: `Object.groupBy`,
//   which the library of `nodenext`'s default target (`esnext`) brings and
//   those of `node16`'s and `node18`'s (`es2022`) and `node20`'s (`es2023`)
//   do not — rejected under those three (an error at `groupBy`, TS2550),
//   admitted under `nodenext`.
// - `module` under `bundler`: `import.meta`, rejected by `es2015` alone (an
//   error at `import.meta`, TS1343); a string-literal import name, rejected
//   by `es2015` and `es2020` (an error at the name, TS18057); an import
//   assignment, rejected by every value but `preserve` (an error at the
//   declaration, TS1202) — each in every file; and import attributes,
//   rejected by `es2015`, `es2020`, and `es2022` (TS2823) and admitted by
//   `esnext` and `preserve`, in each file TypeScript compiles as an ES module
//   there: every one but a `.cts` file, which `bundler` compiles as CommonJS
//   and where attributes compile to `require` calls, rejected whatever the
//   value (TS2856).
// Each pair of neighboring values in a chain — `node10` and the other modes;
// `module` `node16`, `node18`, `node20`, `nodenext`; `es2015`, `es2020`,
// `es2022`, `esnext`, `preserve` — is told apart by one detection. Release
// 5.9.3's `node16` and `nodenext` resolvers share one feature set, so beside
// a common `module` value those two `moduleResolution` values have no effect
// of their own to detect.
//
// Then the initialized-project set's own options, the strict defaults'
// `strict`, the module format, and the verdict's reach, each but the module
// format judged in all 173 setups:
// - `verbatimModuleSyntax`: a type imported without a `type` modifier
//   (`Settings`, from the `typed` stand-in), rejected under the initialized
//   set alone (an error at the type's name, TS1484).
// - `exactOptionalPropertyTypes`: a variable whose type holds an optional
//   property, initialized with that property `undefined`, rejected under the
//   initialized set alone (an error at the variable, TS2375).
// - `noUncheckedIndexedAccess`: a list's element read by index into a
//   variable typed `string`, rejected under the initialized set alone (an
//   error at the variable, TS2322).
// - `noUncheckedSideEffectImports`: a side-effect import of a module that
//   does not exist, rejected under the initialized set alone (an error at
//   its specifier, TS2307).
// - `skipLibCheck`: the `declaration-error` stand-in, whose declaration files
//   name a type that does not exist, rejected under the strict defaults (an
//   error at that name in the declaration file TypeScript resolves, TS2304)
//   and admitted under the initialized set, which skips declaration files.
// - `types` `[]`: an `@types` stand-in installed beside the placement, which
//   TypeScript includes automatically under the strict defaults — there the
//   driver refuses the staging before any verdict, SPEC 7.6's program
//   condition failing — and keeps out of the program under the initialized
//   set, where the file type-checks.
// - `strict`, the strict defaults': the `implicit-any` stand-in, whose
//   declaration files leave a parameter implicitly typed, rejected under the
//   strict defaults (an error at the parameter, TS7006, which `strict` alone
//   raises there, `skipLibCheck` being off) and admitted under the
//   initialized set, which skips declaration files. The initialized set's
//   own `strict` needs no stand-in: dropped, it surfaces as an options error
//   (TS5052, `exactOptionalPropertyTypes` requiring `strictNullChecks`),
//   which fails every admission under that set here.
// - The module format the project and the extension imply: `import.meta`,
//   judged under the `node16` and `nodenext` modes and the initialized set
//   (101 setups), rejected in each file TypeScript compiles as CommonJS
//   there (an error at `import.meta`, TS1470) and admitted in each it
//   compiles as an ES module.
// - The verdict's reach into declaration diagnostics: the
//   `unexported-return` stand-in, whose `defineConfig` returns an interface
//   the stand-in does not export, its call's valid default export rejected
//   under the initialized set alone, which turns `declaration` on (an error
//   at the export, TS4082, a declaration diagnostic, every other kind
//   empty). Its twin, calling the stand-in's `defineVisible`, alike but for
//   returning an interface the stand-in exports, type-checks in every setup,
//   so the rejection is declaration emit's alone.
//
// Last, T7.6-1's export listing, which the driver reads from each file's
// own program where a request asks for it (`listExports`): a listing blind
// to an implicit export or to an export assignment's members would pass a
// package declaring more than `defineConfig`. Each detection judges a plain
// import in all 173 setups and pins the listing whole — the declaration
// file TypeScript resolves, whether it declares an export assignment, and
// every name with its meanings and where TypeScript lists it:
// - an interface a declaration module never marks `export`, with no export
//   list (`export {}`): the `implicit-export` stand-in lists, beside
//   `defineConfig` (a value), its interface (a type), both among the
//   module's exports, through the declaration file each setup resolves —
//   the `import` entry's in 102 setups and the `require` entry's in 71,
//   each entry's interface named for it, so a listing read from another
//   file than the one TypeScript resolves fails too;
// - an export assignment's members: the `export-assignment` stand-in, whose
//   declaration file assigns a value carrying `defineConfig` and one other
//   member, `other`, lists both, each a value among the assignment's
//   members, the module's exports proper empty, in every setup.
//
// A rejection is pinned by its effect: TypeScript reports at least one
// error for the file's program and every one of them lies where the
// construct begins — in the configuration file, or, for `skipLibCheck` and
// `strict`, in the stand-in's declaration file TypeScript resolves — its line
// and column computed from that file's own text, the construct occurring
// there once, so a setup rejecting the file for any other reason fails here
// as surely as one admitting it. An admission is the driver's verdict that
// the file type-checks: no error anywhere in its program (TEST-SPEC §7.6
// Verdict). The ES-module and CommonJS files are written out here apart from
// the driver's own reading, and each detection's count of setups judged and
// rejecting is pinned, so a matrix dropping a setup fails here too. Every
// mismatch of a detection is collected and reported at once, naming its
// setup.
//
// The stand-ins, test/fixtures/s4-module-channel/, documented here since
// JSON holds no comment: each a package declaring `defineConfig<T>(value:
// T): T` where not said otherwise, its runtime files returning their
// argument, and nothing else.
// - `exports-only`: an `exports` map and nothing else naming an entry — no
//   top-level `types` or `main`, no root `index` — serving `import` an ES
//   module typed by `entry.d.ts` and `require` a CommonJS module typed by
//   `entry.d.cts` (`"type": "module"`), so every mode reading `exports`
//   resolves it from every file, and `node10`, which reads none, does not.
// - `esm-only`: `"type": "module"`, its `exports` map's one entry an ES
//   module typed by `index.d.ts`, so a file TypeScript compiles as CommonJS
//   reaches an ES module through `require`.
// - `dual`: the dual-entry layout AGENTS.md's scaffold note describes (the
//   top-level `types` for `node10`; `exports` serving `import` an ES module
//   typed by `index.d.ts` and `require` a CommonJS module typed by
//   `index.d.cts`), resolved in every setup, for the constructs judged on
//   their own.
// - `typed`, `declaration-error`, `implicit-any`, and `unexported-return`:
//   `dual`'s layout, the two declaration files of each identical. `typed`
//   exports an interface `Settings` beside `defineConfig`;
//   `declaration-error` declares, unexported (`export {}`), a constant of a
//   type that does not exist; `implicit-any` exports a function `loosely`
//   whose parameter is left untyped; `unexported-return` declares
//   `defineConfig(value: Hidden): Hidden`, `Hidden` an interface it leaves
//   unexported (`export {}` keeps it so), and `defineVisible(value:
//   Visible): Visible`, `Visible` an exported interface of the same members.
// - `ambient-types`: no module-channel stand-in but an `@types` package
//   (`@types/s4-ambient`, its `index.d.ts` declaring a global variable),
//   which the `types` detection installs at `node_modules/@types/s4-ambient`
//   beside the placement.
// - `implicit-export`: `dual`'s layout, its declaration files differing:
//   each declares `defineConfig` and an interface it never marks `export`,
//   with no `export {}` — `ImportEntryInterface` in `index.d.ts`,
//   `RequireEntryInterface` in `index.d.cts`.
// - `export-assignment`: a CommonJS package — no `type`, no `exports` map,
//   its top-level `types` and `main` alone, so every setup resolves its one
//   declaration file — whose `index.d.ts` assigns (`export =`) a constant
//   typed with `defineConfig` and a number `other`, and whose `index.js`
//   exports such an object.

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { expect, onTestFinished, test } from "vitest";
import {
  ModuleStaging,
  PROJECT_KINDS,
  TYPE_CHECKING_ARM,
} from "../helpers/module-channel.js";
import type { Placement, ProjectKind } from "../helpers/module-channel.js";
import {
  COVERED_SETUPS,
  describeErrors,
  describeExportListing,
  stageCoveredFiles,
} from "../helpers/module-channel-ts.js";
import type {
  CoveredExtension,
  CoveredSetup,
  CoveredVerdict,
  ExportListing,
  ExportSource,
  ListedExport,
  ProgramError,
} from "../helpers/module-channel-ts.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import { guardStep } from "../helpers/step-guards.js";
import type { ProductBinding } from "../helpers/subprocess.js";

const LF = String.fromCodePoint(0x0a);

/** The committed stand-ins (module header), resolved like fixtures. */
const STAND_INS = {
  exportsOnly: fixture("s4-module-channel/exports-only"),
  esmOnly: fixture("s4-module-channel/esm-only"),
  dual: fixture("s4-module-channel/dual"),
  typed: fixture("s4-module-channel/typed"),
  declarationError: fixture("s4-module-channel/declaration-error"),
  implicitAny: fixture("s4-module-channel/implicit-any"),
  unexportedReturn: fixture("s4-module-channel/unexported-return"),
  ambientTypes: fixture("s4-module-channel/ambient-types"),
  implicitExport: fixture("s4-module-channel/implicit-export"),
  exportAssignment: fixture("s4-module-channel/export-assignment"),
} as const;

function fixture(rel: string): string {
  return fileURLToPath(new URL(`../fixtures/${rel}`, import.meta.url));
}

/** The project directory every staging here holds, staging-relative. */
const PROJECT_DIR = "project";

/**
 * A binding of the certification fixtures' shape beside `packageDir`: its
 * executable is never run here.
 */
function standInBinding(packageDir: string): ProductBinding {
  return {
    label: "S-4 module-channel stand-in binding",
    command: process.execPath,
    requiredFiles: [process.execPath],
    packageDir,
  };
}

/** A staging of one project beside its canonical placement of `packageDir`. */
interface StagedProject {
  readonly staging: ModuleStaging;
  readonly placement: Placement;
}

/** Stage `project` with `packageDir` placed canonically; disposed at the end. */
async function stagedProject(
  packageDir: string,
  project: ProjectKind,
  context: string,
): Promise<StagedProject> {
  const staging = await ModuleStaging.create(
    standInBinding(packageDir),
    context,
  );
  onTestFinished(() => staging.dispose());
  await staging.stageProject(PROJECT_DIR, project);
  const placement = await staging.placeCanonical(
    PROJECT_DIR,
    TYPE_CHECKING_ARM,
  );
  return { staging, placement };
}

/** Lines joined by LF, the last one terminated. */
function lines(...all: string[]): string {
  return all.join(LF) + LF;
}

/**
 * The files TypeScript compiles as ES modules under the `node16` and
 * `nodenext` modes (SPEC 7.6: a name ending in `.mts`, or in `.ts` or `.tsx`
 * in an ES-module project), written out here apart from the driver's own
 * reading; every other file it compiles as CommonJS there.
 */
const ES_MODULE_FILES: Readonly<
  Record<ProjectKind, readonly CoveredExtension[]>
> = {
  "es-module": [".ts", ".mts", ".tsx"],
  commonjs: [".mts"],
  "no-manifest": [".mts"],
};

/** Whether TypeScript compiles `setup`'s file as an ES module there. */
function compiledAsEsModule(setup: CoveredSetup): boolean {
  return ES_MODULE_FILES[setup.project].includes(setup.extension);
}

/** A strict-default setup's `moduleResolution`, as its set spells it. */
function resolutionOf(setup: CoveredSetup): string {
  const value = setup.optionSet.tsconfig["moduleResolution"];
  if (typeof value !== "string") {
    throw new Error(`${setup.label} spells no moduleResolution`);
  }
  return value;
}

/** A setup's `module`, as its set spells it: undefined at its default. */
function moduleOf(setup: CoveredSetup): string | undefined {
  const value = setup.optionSet.tsconfig["module"];
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${setup.label} spells module as no string`);
  }
  return value;
}

/** The two modes whose `module` values run `node16` to `nodenext`. */
const NODE_MODES: ReadonlySet<string> = new Set(["node16", "nodenext"]);

/** Whether `setup` is one of the fourteen strict defaults'. */
function strictDefault(setup: CoveredSetup): boolean {
  return setup.optionSet.kind === "strict defaults";
}

/** Whether `setup` is the initialized-project set's. */
function initializedSet(setup: CoveredSetup): boolean {
  return setup.optionSet.kind === "initialized-project options";
}

/** One detection (module header). */
interface Detection {
  /** How every diagnosis names it. */
  readonly name: string;
  /** The stand-in package placed canonically for it. */
  readonly standIn: string;
  /** The covered file, importing from `name` (N). */
  readonly text: (name: string) => string;
  /**
   * The construct a rejection is located at: its first characters, which
   * occur once in the file holding it, where TypeScript's error begins.
   */
  readonly construct: (name: string) => string;
  /**
   * The stand-in's files holding the construct, by their paths in the
   * package, where a rejection lies in whichever of them TypeScript
   * resolves; where none are named, the configuration file holds it.
   */
  readonly constructIn?: readonly string[];
  /** A twin file judged beside it, which type-checks wherever it is judged. */
  readonly twin?: (name: string) => string;
  /** Whether it is judged in a covered setup. */
  readonly judgedIn: (setup: CoveredSetup) => boolean;
  /** Whether the setting rejects the construct there. */
  readonly rejectedIn: (setup: CoveredSetup) => boolean;
  /** The setups it is judged in, and the rejecting ones among them. */
  readonly counts: { readonly judged: number; readonly rejected: number };
}

/** A file importing `defineConfig` from N, then exporting its call. */
function plainImport(name: string): string {
  return lines(
    `import { defineConfig } from ${JSON.stringify(name)};`,
    "",
    "export default defineConfig({ checked: true });",
  );
}

/** A file importing from N with import attributes. */
function attributedImport(name: string): string {
  return lines(
    `import { defineConfig } from ${JSON.stringify(name)} with { note: "stand-in" };`,
    "",
    "export default defineConfig({ checked: true });",
  );
}

/** A file exporting `defineConfig`'s call on an object holding `import.meta`. */
function importMetaFile(name: string): string {
  return lines(
    `import { defineConfig } from ${JSON.stringify(name)};`,
    "",
    "export default defineConfig({ meta: import.meta });",
  );
}

const EXPORTS_ONLY: Detection = {
  name: "an exports-only stand-in imported",
  standIn: STAND_INS.exportsOnly,
  text: plainImport,
  construct: (name) => JSON.stringify(name),
  judgedIn: strictDefault,
  rejectedIn: (setup) => resolutionOf(setup) === "node10",
  counts: { judged: 168, rejected: 12 },
};

const ESM_ONLY_FROM_COMMONJS: Detection = {
  name: "an ES-module-only stand-in imported from a file TypeScript compiles as CommonJS",
  standIn: STAND_INS.esmOnly,
  text: plainImport,
  construct: (name) => JSON.stringify(name),
  judgedIn: (setup) =>
    strictDefault(setup) &&
    NODE_MODES.has(resolutionOf(setup)) &&
    !compiledAsEsModule(setup),
  rejectedIn: (setup) => ["node16", "node18"].includes(moduleOf(setup) ?? ""),
  counts: { judged: 56, rejected: 28 },
};

const NODE_IMPORT_ATTRIBUTES: Detection = {
  name: "import attributes on an import of a JavaScript module, in a file TypeScript compiles as an ES module",
  standIn: STAND_INS.dual,
  text: attributedImport,
  construct: () => "with {",
  judgedIn: (setup) =>
    strictDefault(setup) &&
    NODE_MODES.has(resolutionOf(setup)) &&
    compiledAsEsModule(setup),
  rejectedIn: (setup) => moduleOf(setup) === "node16",
  counts: { judged: 40, rejected: 10 },
};

const GROUP_BY: Detection = {
  name: "Object.groupBy",
  standIn: STAND_INS.dual,
  text: (name) =>
    lines(
      `import { defineConfig } from ${JSON.stringify(name)};`,
      "",
      "export default defineConfig({",
      '  groups: Object.groupBy(["a", "bc"], (item: string) => String(item.length)),',
      "});",
    ),
  construct: () => "groupBy",
  judgedIn: (setup) =>
    strictDefault(setup) && NODE_MODES.has(resolutionOf(setup)),
  rejectedIn: (setup) => moduleOf(setup) !== "nodenext",
  counts: { judged: 96, rejected: 72 },
};

const BUNDLER_IMPORT_META: Detection = {
  name: "import.meta under bundler",
  standIn: STAND_INS.dual,
  text: importMetaFile,
  construct: () => "import.meta",
  judgedIn: (setup) =>
    strictDefault(setup) && resolutionOf(setup) === "bundler",
  rejectedIn: (setup) => moduleOf(setup) === "es2015",
  counts: { judged: 60, rejected: 12 },
};

const BUNDLER_STRING_IMPORT_NAME: Detection = {
  name: "a string-literal import name under bundler",
  standIn: STAND_INS.dual,
  text: (name) =>
    lines(
      `import { "defineConfig" as define } from ${JSON.stringify(name)};`,
      "",
      "export default define({ checked: true });",
    ),
  construct: () => '"defineConfig"',
  judgedIn: (setup) =>
    strictDefault(setup) && resolutionOf(setup) === "bundler",
  rejectedIn: (setup) => ["es2015", "es2020"].includes(moduleOf(setup) ?? ""),
  counts: { judged: 60, rejected: 24 },
};

const BUNDLER_IMPORT_ATTRIBUTES: Detection = {
  name: "import attributes under bundler, in a file TypeScript compiles as an ES module there",
  standIn: STAND_INS.dual,
  text: attributedImport,
  construct: () => "with {",
  judgedIn: (setup) =>
    strictDefault(setup) &&
    resolutionOf(setup) === "bundler" &&
    setup.extension !== ".cts",
  rejectedIn: (setup) =>
    ["es2015", "es2020", "es2022"].includes(moduleOf(setup) ?? ""),
  counts: { judged: 45, rejected: 27 },
};

const BUNDLER_IMPORT_ASSIGNMENT: Detection = {
  name: "an import assignment under bundler",
  standIn: STAND_INS.dual,
  text: (name) =>
    lines(
      `import config = require(${JSON.stringify(name)});`,
      "",
      "export default config.defineConfig({ checked: true });",
    ),
  construct: () => "import config = require(",
  judgedIn: (setup) =>
    strictDefault(setup) && resolutionOf(setup) === "bundler",
  rejectedIn: (setup) => moduleOf(setup) !== "preserve",
  counts: { judged: 60, rejected: 48 },
};

/** The declaration files of a stand-in in `dual`'s layout. */
const DECLARATION_FILES: readonly string[] = ["index.d.ts", "index.d.cts"];

const VERBATIM_MODULE_SYNTAX: Detection = {
  name: "verbatimModuleSyntax: a type imported without a type modifier",
  standIn: STAND_INS.typed,
  text: (name) =>
    lines(
      `import { defineConfig, Settings } from ${JSON.stringify(name)};`,
      "",
      "export default defineConfig({ checked: true });",
    ),
  construct: () => "Settings",
  judgedIn: () => true,
  rejectedIn: initializedSet,
  counts: { judged: 173, rejected: 5 },
};

const EXACT_OPTIONAL_PROPERTY_TYPES: Detection = {
  name: "exactOptionalPropertyTypes: an optional property initialized undefined",
  standIn: STAND_INS.dual,
  text: (name) =>
    lines(
      `import { defineConfig } from ${JSON.stringify(name)};`,
      "",
      "const options: { note?: string } = { note: undefined };",
      "",
      "export default defineConfig(options);",
    ),
  construct: () => "options: {",
  judgedIn: () => true,
  rejectedIn: initializedSet,
  counts: { judged: 173, rejected: 5 },
};

const NO_UNCHECKED_INDEXED_ACCESS: Detection = {
  name: "noUncheckedIndexedAccess: a list's element read by index into a string variable",
  standIn: STAND_INS.dual,
  text: (name) =>
    lines(
      `import { defineConfig } from ${JSON.stringify(name)};`,
      "",
      'const list: string[] = ["a"];',
      "const first: string = list[0];",
      "",
      "export default defineConfig({ first });",
    ),
  construct: () => "first: string",
  judgedIn: () => true,
  rejectedIn: initializedSet,
  counts: { judged: 173, rejected: 5 },
};

const NO_UNCHECKED_SIDE_EFFECT_IMPORTS: Detection = {
  name: "noUncheckedSideEffectImports: a side-effect import of a module that does not exist",
  standIn: STAND_INS.dual,
  text: (name) =>
    lines(
      `import { defineConfig } from ${JSON.stringify(name)};`,
      'import "./absent-module.js";',
      "",
      "export default defineConfig({ checked: true });",
    ),
  construct: () => '"./absent-module.js"',
  judgedIn: () => true,
  rejectedIn: initializedSet,
  counts: { judged: 173, rejected: 5 },
};

const SKIP_LIB_CHECK: Detection = {
  name: "skipLibCheck: a stand-in whose declaration files name a type that does not exist",
  standIn: STAND_INS.declarationError,
  text: plainImport,
  construct: () => "UndeclaredType",
  constructIn: DECLARATION_FILES,
  judgedIn: () => true,
  rejectedIn: strictDefault,
  counts: { judged: 173, rejected: 168 },
};

const STRICT: Detection = {
  name: "the strict defaults' strict: a stand-in whose declaration files leave a parameter implicitly typed",
  standIn: STAND_INS.implicitAny,
  text: plainImport,
  construct: () => "untyped",
  constructIn: DECLARATION_FILES,
  judgedIn: () => true,
  rejectedIn: strictDefault,
  counts: { judged: 173, rejected: 168 },
};

const MODULE_FORMAT: Detection = {
  name: "the module format the project and the extension imply: import.meta",
  standIn: STAND_INS.dual,
  text: importMetaFile,
  construct: () => "import.meta",
  judgedIn: (setup) =>
    initializedSet(setup) || NODE_MODES.has(resolutionOf(setup)),
  rejectedIn: (setup) => !compiledAsEsModule(setup),
  counts: { judged: 101, rejected: 56 },
};

const DECLARATION_DIAGNOSTICS: Detection = {
  name: "declaration diagnostics: a default export of a stand-in's unexported interface",
  standIn: STAND_INS.unexportedReturn,
  text: plainImport,
  construct: () => "export default",
  twin: (name) =>
    lines(
      `import { defineVisible } from ${JSON.stringify(name)};`,
      "",
      "export default defineVisible({ checked: true });",
    ),
  judgedIn: () => true,
  rejectedIn: initializedSet,
  counts: { judged: 173, rejected: 5 },
};

/** A 1-based position in a file, as the driver reports an error's. */
interface Position {
  readonly line: number;
  readonly column: number;
}

/**
 * Where `construct` begins in `text`, which holds it once; a construct
 * missing or repeated is a defect of this file's own tables.
 */
function locate(text: string, construct: string, context: string): Position {
  const at = text.indexOf(construct);
  if (at < 0 || text.indexOf(construct, at + 1) >= 0) {
    throw new Error(
      `${context}: the construct ${JSON.stringify(construct)} occurs ` +
        `${at < 0 ? "nowhere" : "more than once"} in its file`,
    );
  }
  const before = text.slice(0, at).split(LF);
  return {
    line: before.length,
    column: (before[before.length - 1] ?? "").length + 1,
  };
}

/** Where a detection's rejection lies (module header). */
type Site =
  | {
      /** In the configuration file, at `position`. */
      readonly in: "configuration file";
      readonly construct: string;
      readonly position: Position;
    }
  | {
      /**
       * In the stand-in's declaration file TypeScript resolves: each such
       * file by the name TypeScript reads it under, in the placed copy, with
       * the construct's position there.
       */
      readonly in: "declaration files";
      readonly construct: string;
      readonly positions: ReadonlyMap<string, Position>;
    };

/** A path with `/` separators, as TypeScript spells file names. */
function slashed(file: string): string {
  return file.split(path.sep).join("/");
}

/**
 * Where `detection`'s rejection lies once its stand-in is placed at
 * `placement` and its file holds `text`: the construct's position in the
 * configuration file, or in each named file of the stand-in, read from the
 * fixture the placed copy equals byte for byte.
 */
async function siteOf(
  detection: Detection,
  text: string,
  placement: Placement,
  context: string,
): Promise<Site> {
  const construct = detection.construct(placement.name);
  if (detection.constructIn === undefined) {
    return {
      in: "configuration file",
      construct,
      position: locate(text, construct, context),
    };
  }
  const positions = new Map<string, Position>();
  for (const rel of detection.constructIn) {
    const source = path.join(detection.standIn, ...rel.split("/"));
    const held = await guardStep(`reading ${source} (${context})`, () =>
      fsp.readFile(source, "utf8"),
    );
    positions.set(
      `${slashed(placement.copy)}/${rel}`,
      locate(held, construct, `${context}, the stand-in's ${rel}`),
    );
  }
  return { in: "declaration files", construct, positions };
}

/** How a diagnosis names a site. */
function describeSite(site: Site): string {
  const at = (position: Position): string =>
    `${String(position.line)}:${String(position.column)}`;
  const where =
    site.in === "configuration file"
      ? `${at(site.position)} of the configuration file`
      : [...site.positions]
          .map(([file, position]) => `${at(position)} of ${file}`)
          .join(", or ");
  return `${JSON.stringify(site.construct)} (${where})`;
}

/** Whether `error` lies at `site`. */
function atSite(error: ProgramError, site: Site): boolean {
  let position: Position | undefined;
  if (site.in === "configuration file") {
    if (error.origin === "configuration file") position = site.position;
  } else if (error.origin === "another file" && error.file !== undefined) {
    position = site.positions.get(error.file);
  }
  return (
    position !== undefined &&
    error.line === position.line &&
    error.column === position.column
  );
}

/** Why a verdict is no rejection at `site`, or undefined where it is. */
function rejectionProblem(
  verdict: CoveredVerdict,
  site: Site,
): string | undefined {
  if (verdict.errors.length === 0) {
    return (
      `admitted — TypeScript 5.9.3 reports no error — where the setting ` +
      `rejects the file, an error expected at ${describeSite(site)}`
    );
  }
  if (verdict.errors.every((error) => atSite(error, site))) return undefined;
  return (
    `rejected otherwise than at ${describeSite(site)}: ` +
    describeErrors(verdict.errors)
  );
}

/** Why a verdict is no admission, or undefined where it is one. */
function admissionProblem(verdict: CoveredVerdict): string | undefined {
  if (verdict.typeChecks) return undefined;
  return (
    `rejected where the setting admits the file: ` +
    describeErrors(verdict.errors)
  );
}

/**
 * Judge `detection` in each covered setup it is judged in, project by
 * project, each project a fresh staging of its stand-in (module header), and
 * expect every verdict the setting decides, and its twin's admission where
 * it has one, together with the counts.
 */
async function expectDetected(detection: Detection): Promise<void> {
  const mismatches: string[] = [];
  let judged = 0;
  let rejected = 0;
  for (const project of PROJECT_KINDS) {
    const setups = COVERED_SETUPS.filter(
      (setup) => setup.project === project && detection.judgedIn(setup),
    );
    if (setups.length === 0) continue;
    const context = `S-4, ${detection.name}, in the ${project} project`;
    const { staging, placement } = await stagedProject(
      detection.standIn,
      project,
      context,
    );
    const text = detection.text(placement.name);
    const site = await siteOf(detection, text, placement, context);
    const twin = detection.twin?.(placement.name);
    const files = await stageCoveredFiles({
      staging,
      directory: PROJECT_DIR,
      project,
      placement,
      alone: true,
      files: [
        { label: detection.name, text },
        ...(twin === undefined
          ? []
          : [{ label: `${detection.name}, its twin`, text: twin }]),
      ],
      setups,
      context,
    });
    for (const setup of setups) {
      const [verdict, twinVerdict] = files.judge(setup);
      if (
        verdict === undefined ||
        (twin !== undefined && twinVerdict === undefined)
      ) {
        throw new Error(`${context}: no verdict in ${setup.label}`);
      }
      judged += 1;
      const rejects = detection.rejectedIn(setup);
      if (rejects) rejected += 1;
      const problem = rejects
        ? rejectionProblem(verdict, site)
        : admissionProblem(verdict);
      if (problem !== undefined) {
        mismatches.push(`${setup.label}: ${problem}`);
      }
      const twinProblem =
        twinVerdict === undefined ? undefined : admissionProblem(twinVerdict);
      if (twinProblem !== undefined) {
        mismatches.push(`${setup.label}, the twin: ${twinProblem}`);
      }
    }
  }
  expect(
    { mismatches, judged, rejected },
    `${detection.name}: each setup's verdict as its setting decides it, ` +
      `and the setups judged and rejecting`,
  ).toStrictEqual({ mismatches: [], ...detection.counts });
}

/** The `@types` stand-in's name, and its files (module header). */
const AMBIENT_TYPES_NAME = "s4-ambient";
const AMBIENT_TYPES_FILES: readonly string[] = ["package.json", "index.d.ts"];

/** Why an outcome is no refused automatic inclusion, or undefined where it is. */
function inclusionProblem(
  verdict: CoveredVerdict | undefined,
  refusal: HarnessStagingError | undefined,
): string | undefined {
  if (refusal === undefined) {
    const judged =
      verdict === undefined ? "no verdict" : describeErrors(verdict.errors);
    return (
      `judged (${judged}) where TypeScript, types at its default, includes ` +
      `the @types stand-in automatically, so the driver refuses the staging, ` +
      `SPEC 7.6's program condition failing`
    );
  }
  if (
    refusal.message.includes("program condition does not hold") &&
    refusal.message.includes(
      `included automatically as the type package ${AMBIENT_TYPES_NAME}`,
    )
  ) {
    return undefined;
  }
  return (
    `refused otherwise than for the @types stand-in's automatic inclusion: ` +
    refusal.message
  );
}

/** Why an outcome is no admission with the stand-in kept out, or undefined. */
function exclusionProblem(
  verdict: CoveredVerdict | undefined,
  refusal: HarnessStagingError | undefined,
  typesDirectory: string,
): string | undefined {
  if (refusal !== undefined) {
    return (
      `refused where types [] keeps the @types stand-in out of the ` +
      `program: ${refusal.message}`
    );
  }
  if (verdict === undefined) return "no verdict";
  const entered = verdict.programFiles.filter((file) =>
    file.startsWith(`${typesDirectory}/`),
  );
  if (entered.length > 0) {
    return `the @types stand-in entered the program: ${entered.join(", ")}`;
  }
  return admissionProblem(verdict);
}

/**
 * The `types` detection (module header): a plain file judged in every
 * covered setup, project by project, beside an `@types` stand-in installed
 * next to the canonical placement, each project a fresh staging — each
 * strict-default setup refused, TypeScript including the stand-in
 * automatically, and each initialized-set setup type-checking with the
 * stand-in out of its program — together with the counts.
 */
async function expectTypesKeptOut(): Promise<void> {
  const mismatches: string[] = [];
  let judged = 0;
  let included = 0;
  for (const project of PROJECT_KINDS) {
    const setups = COVERED_SETUPS.filter((setup) => setup.project === project);
    const context =
      `S-4, types [] keeping an @types stand-in out of the program, in ` +
      `the ${project} project`;
    const { staging, placement } = await stagedProject(
      STAND_INS.dual,
      project,
      context,
    );
    const installed = `${PROJECT_DIR}/node_modules/@types/${AMBIENT_TYPES_NAME}`;
    for (const name of AMBIENT_TYPES_FILES) {
      const source = path.join(STAND_INS.ambientTypes, name);
      const bytes = await guardStep(`reading ${source} (${context})`, () =>
        fsp.readFile(source),
      );
      await staging.writeFile(`${installed}/${name}`, bytes);
    }
    const files = await stageCoveredFiles({
      staging,
      directory: PROJECT_DIR,
      project,
      placement,
      files: [
        {
          label: "a plain import beside an @types stand-in",
          text: plainImport(placement.name),
        },
      ],
      setups,
      context,
    });
    const typesDirectory = slashed(staging.path(installed));
    for (const setup of setups) {
      judged += 1;
      const includes = strictDefault(setup);
      if (includes) included += 1;
      let verdict: CoveredVerdict | undefined;
      let refusal: HarnessStagingError | undefined;
      try {
        [verdict] = files.judge(setup);
      } catch (error) {
        if (!(error instanceof HarnessStagingError)) throw error;
        refusal = error;
      }
      const problem = includes
        ? inclusionProblem(verdict, refusal)
        : exclusionProblem(verdict, refusal, typesDirectory);
      if (problem !== undefined) {
        mismatches.push(`${setup.label}: ${problem}`);
      }
    }
  }
  expect(
    { mismatches, judged, included },
    `types []: each setup's outcome as the option decides it, and the ` +
      `setups judged and including the @types stand-in automatically`,
  ).toStrictEqual({ mismatches: [], judged: 173, included: 168 });
}

/** The declaration files a listing detection's stand-ins hold. */
type DeclarationFile = "index.d.ts" | "index.d.cts";

/** One detection of T7.6-1's export listing (module header). */
interface ListingDetection {
  /** How every diagnosis names it. */
  readonly name: string;
  /** The stand-in package placed canonically for it. */
  readonly standIn: string;
  /** The stand-in's declaration file TypeScript resolves in `setup`. */
  readonly declarationIn: (setup: CoveredSetup) => DeclarationFile;
  /** The listing expected where TypeScript resolves `declaration`. */
  readonly listed: (
    declaration: DeclarationFile,
  ) => Omit<ExportListing, "module">;
  /** How many of the 173 setups resolve each declaration file. */
  readonly resolved: Partial<Readonly<Record<DeclarationFile, number>>>;
}

/** A listed export written out: one meaning, found in one place. */
function listedExport(
  name: string,
  meaning: "value" | "type",
  listedIn: ExportSource,
): ListedExport {
  return {
    name,
    value: meaning === "value",
    typeOnlyValue: false,
    type: meaning === "type",
    namespace: false,
    listedIn: [listedIn],
  };
}

/**
 * Which of a `dual`-layout stand-in's declaration files TypeScript resolves
 * in `setup`, written out here apart from the driver: under `node10`, which
 * reads no `exports`, the top-level `types`; under `bundler`, the `require`
 * entry's for a `.cts` file alone; under the `node16` and `nodenext` modes
 * (the initialized set's among them), the `require` entry's for each file
 * TypeScript compiles as CommonJS there, and the `import` entry's otherwise.
 */
function dualDeclaration(setup: CoveredSetup): DeclarationFile {
  const resolution = setup.optionSet.tsconfig["moduleResolution"];
  if (resolution === "node10") return "index.d.ts";
  if (resolution === "bundler") {
    return setup.extension === ".cts" ? "index.d.cts" : "index.d.ts";
  }
  return compiledAsEsModule(setup) ? "index.d.ts" : "index.d.cts";
}

const IMPLICIT_EXPORT: ListingDetection = {
  name: "an interface a declaration module never marks export, with no export {}",
  standIn: STAND_INS.implicitExport,
  declarationIn: dualDeclaration,
  listed: (declaration) => ({
    exportAssignment: false,
    exports: [
      listedExport(
        declaration === "index.d.ts"
          ? "ImportEntryInterface"
          : "RequireEntryInterface",
        "type",
        "exports",
      ),
      listedExport("defineConfig", "value", "exports"),
    ],
  }),
  resolved: { "index.d.ts": 102, "index.d.cts": 71 },
};

const EXPORT_ASSIGNMENT: ListingDetection = {
  name: "an export assignment whose value carries defineConfig and one other member",
  standIn: STAND_INS.exportAssignment,
  declarationIn: () => "index.d.ts",
  listed: () => ({
    exportAssignment: true,
    exports: [
      listedExport("defineConfig", "value", "export assignment"),
      listedExport("other", "value", "export assignment"),
    ],
  }),
  resolved: { "index.d.ts": 173 },
};

/**
 * Judge a plain import of `detection`'s stand-in in every covered setup,
 * project by project, each project a fresh staging, the driver listing the
 * import's exports, and expect each setup's listing whole (module header),
 * together with the counts of setups judged and resolving each declaration
 * file.
 */
async function expectListed(detection: ListingDetection): Promise<void> {
  const mismatches: string[] = [];
  let judged = 0;
  const resolved: Partial<Record<DeclarationFile, number>> = {};
  for (const project of PROJECT_KINDS) {
    const setups = COVERED_SETUPS.filter((setup) => setup.project === project);
    const context =
      `S-4, T7.6-1's export listing: ${detection.name}, in the ${project} ` +
      `project`;
    const { staging, placement } = await stagedProject(
      detection.standIn,
      project,
      context,
    );
    const files = await stageCoveredFiles({
      staging,
      directory: PROJECT_DIR,
      project,
      placement,
      alone: true,
      listExports: true,
      files: [{ label: detection.name, text: plainImport(placement.name) }],
      setups,
      context,
    });
    for (const setup of setups) {
      const [verdict] = files.judge(setup);
      if (verdict === undefined) {
        throw new Error(`${context}: no verdict in ${setup.label}`);
      }
      judged += 1;
      const declaration = detection.declarationIn(setup);
      resolved[declaration] = (resolved[declaration] ?? 0) + 1;
      const expected: ExportListing = {
        module: `${slashed(placement.copy)}/${declaration}`,
        ...detection.listed(declaration),
      };
      if (!isDeepStrictEqual(verdict.exportListing, expected)) {
        mismatches.push(
          `${setup.label}: the driver lists ` +
            `${describeExportListing(verdict.exportListing)}, where ` +
            `the stand-in's declarations give ${describeExportListing(expected)}`,
        );
      }
    }
  }
  expect(
    { mismatches, judged, resolved },
    `T7.6-1's export listing, ${detection.name}: each setup's listing as ` +
      `TypeScript's own resolution gives it, and the setups judged and ` +
      `resolving each declaration file`,
  ).toStrictEqual({
    mismatches: [],
    judged: 173,
    resolved: detection.resolved,
  });
}

test("moduleResolution: an exports-only stand-in, which node10 alone does not resolve, is rejected in each of the 12 node10 setups — an error at the import's specifier and nowhere else — and type-checks in each of the 156 other strict-default setups (TEST-SPEC S-4; §7.6 Covered setups)", async () => {
  await expectDetected(EXPORTS_ONLY);
});

test("module under the node16 and nodenext modes: an ES-module-only stand-in imported from a file TypeScript compiles as CommonJS is rejected under module node16 and node18 — an error at the import's specifier and nowhere else — and type-checks under node20 and nodenext, in each of the 56 setups of such a file (TEST-SPEC S-4; §7.6 Covered setups)", async () => {
  await expectDetected(ESM_ONLY_FROM_COMMONJS);
});

test("module under the node16 and nodenext modes: import attributes on an import of a JavaScript module, in a file TypeScript compiles as an ES module, are rejected under module node16 — an error at the attributes and nowhere else — and type-check under node18, node20, and nodenext, in each of the 40 setups of such a file (TEST-SPEC S-4)", async () => {
  await expectDetected(NODE_IMPORT_ATTRIBUTES);
});

test("module's default target under the node16 and nodenext modes: Object.groupBy, which the library of nodenext's default target brings and those of node16's, node18's, and node20's do not, is rejected under module node16, node18, and node20 — an error at groupBy and nowhere else — and type-checks under nodenext, in each of the 96 setups of those modes (TEST-SPEC S-4; §7.6 Covered setups)", async () => {
  await expectDetected(GROUP_BY);
});

test("module under bundler: import.meta is rejected by es2015 alone — an error at import.meta and nowhere else — and type-checks under es2020, es2022, esnext, and preserve, in each of the 60 bundler setups (TEST-SPEC S-4)", async () => {
  await expectDetected(BUNDLER_IMPORT_META);
});

test("module under bundler: a string-literal import name is rejected by es2015 and es2020 — an error at the name and nowhere else — and type-checks under es2022, esnext, and preserve, in each of the 60 bundler setups (TEST-SPEC S-4)", async () => {
  await expectDetected(BUNDLER_STRING_IMPORT_NAME);
});

test("module under bundler: import attributes are rejected by es2015, es2020, and es2022 — an error at the attributes and nowhere else — and type-check under esnext and preserve, in each of the 45 bundler setups of a file TypeScript compiles as an ES module there (TEST-SPEC S-4)", async () => {
  await expectDetected(BUNDLER_IMPORT_ATTRIBUTES);
});

test("module under bundler: an import assignment type-checks under preserve alone and is rejected by es2015, es2020, es2022, and esnext — an error at the declaration and nowhere else — in each of the 60 bundler setups (TEST-SPEC S-4)", async () => {
  await expectDetected(BUNDLER_IMPORT_ASSIGNMENT);
});

test("the initialized set's verbatimModuleSyntax: a type imported without a type modifier is rejected in each of the 5 initialized-project setups — an error at the type's name and nowhere else — and type-checks in each of the 168 strict-default setups (TEST-SPEC S-4; §7.6 Covered setups)", async () => {
  await expectDetected(VERBATIM_MODULE_SYNTAX);
});

test("the initialized set's exactOptionalPropertyTypes: a variable whose optional property is initialized undefined is rejected in each of the 5 initialized-project setups — an error at the variable and nowhere else — and type-checks in each of the 168 strict-default setups (TEST-SPEC S-4)", async () => {
  await expectDetected(EXACT_OPTIONAL_PROPERTY_TYPES);
});

test("the initialized set's noUncheckedIndexedAccess: a list's element read by index into a variable typed string is rejected in each of the 5 initialized-project setups — an error at the variable and nowhere else — and type-checks in each of the 168 strict-default setups (TEST-SPEC S-4)", async () => {
  await expectDetected(NO_UNCHECKED_INDEXED_ACCESS);
});

test("the initialized set's noUncheckedSideEffectImports: a side-effect import of a module that does not exist is rejected in each of the 5 initialized-project setups — an error at its specifier and nowhere else — and type-checks in each of the 168 strict-default setups (TEST-SPEC S-4)", async () => {
  await expectDetected(NO_UNCHECKED_SIDE_EFFECT_IMPORTS);
});

test("the initialized set's skipLibCheck: a stand-in whose declaration files name a type that does not exist is rejected in each of the 168 strict-default setups — an error at that name in the declaration file TypeScript resolves and nowhere else — and type-checks in each of the 5 initialized-project setups, which skip declaration files (TEST-SPEC S-4; §7.6 Covered setups)", async () => {
  await expectDetected(SKIP_LIB_CHECK);
});

test("the initialized set's types []: an @types stand-in installed beside the placement stays out of the program in each of the 5 initialized-project setups, the file type-checking, and is included automatically in each of the 168 strict-default setups, where the driver refuses the staging as SPEC 7.6's program condition fails (TEST-SPEC S-4; §7.6 Placement)", async () => {
  await expectTypesKeptOut();
});

test("the strict defaults' strict: a stand-in whose declaration files leave a parameter implicitly typed is rejected in each of the 168 strict-default setups — an error at the parameter in the declaration file TypeScript resolves and nowhere else, skipLibCheck being off — and type-checks in each of the 5 initialized-project setups, which skip declaration files (TEST-SPEC S-4; §7.6 Covered setups)", async () => {
  await expectDetected(STRICT);
});

test("the module format the project and the extension imply: import.meta is rejected in each of the 56 setups of a file TypeScript compiles as CommonJS under the node16 and nodenext modes — an error at import.meta and nowhere else — and type-checks in each of the 45 setups of a file it compiles as an ES module there or under the initialized-project set (TEST-SPEC S-4; §7.6 Covered setups)", async () => {
  await expectDetected(MODULE_FORMAT);
});

test("the verdict's reach into declaration diagnostics: a valid default export of a stand-in's defineConfig, which returns an interface the stand-in does not export, is rejected in each of the 5 initialized-project setups, which turn declaration on — an error at the export and nowhere else — and type-checks in each of the 168 strict-default setups, while its twin, returning an interface the stand-in exports, type-checks in all 173 (TEST-SPEC S-4; §7.6 Verdict)", async () => {
  await expectDetected(DECLARATION_DIAGNOSTICS);
});

test("T7.6-1's export listing: a stand-in whose declaration files each declare, beside defineConfig, an interface never marked export, with no export {}, lists both — defineConfig a value, the interface a type, each among the module's exports — read through TypeScript's own resolution in each of the 173 covered setups, the import entry's declaration file in 102 and the require entry's in 71 (TEST-SPEC S-4; T7.6-1)", async () => {
  await expectListed(IMPLICIT_EXPORT);
});

test("T7.6-1's export listing: a stand-in whose export assignment assigns a value carrying defineConfig and one other member lists both, each a value among the assignment's members, the module's exports proper empty, in each of the 173 covered setups (TEST-SPEC S-4; T7.6-1)", async () => {
  await expectListed(EXPORT_ASSIGNMENT);
});
