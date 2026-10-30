// Self-checks for the module channel's TypeScript driver (TEST-SPEC 17
// preamble: internal self-tests cover harness machinery certification does
// not exercise; §7.6 Covered setups, Verdict, Pairing, Placement; SPEC 7.6
// Covered setups; helpers/module-channel-ts.ts). No test of 7.6 is
// registered yet, so the driver every type-checking arm will judge through
// is pinned here on its own, before any product exists, over hand-written
// non-xspec stand-in packages:
// - the matrix: 173 setups, each project and extension with exactly the
//   option sets covering it, each set exactly as TEST-SPEC §7.6 lists it
//   (the initialized-project set also as release 5.9.3's own `tsc --init`
//   writer writes it), and every program carrying exactly its set's
//   options and nothing else, read back from the program;
// - the verdicts: a conforming stand-in's valid file type-checks and its
//   unknown-key twin fails to type-check, paired, in all 173 setups, the
//   declaration file TypeScript resolves varying across the matrix as it
//   should; an error only in the package's declaration file fails "type-
//   checks" with no error located in the configuration file (and, with
//   `skipLibCheck` on, the initialized set admits it);
// - the pairing: a shape-violation arm fails diagnosed where its twin does
//   not type-check (an error in the package, S-7's stub package) and where
//   it does not fail to type-check itself (a permissive package);
// - the sharing the driver's header argues, against its reference reading
//   (one root, nothing shared but parsed libraries) on a sample of setups,
//   a package whose global augmentation puts errors inside a library among
//   them, each file's export listing read alike, and batches the driver
//   must judge file by file instead (a file augmenting a module among
//   them);
// - the program condition, from TypeScript's include reasons: an `@types`
//   package included automatically, a library an installed package
//   replaces, and a module TypeScript imports implicitly are refused where
//   they enter the program, and admitted where they do not;
// - the export listing (TEST-SPEC T7.6-1): each name with its meanings as
//   TypeScript resolves them, through each entry — a value merged with a
//   namespace, a declared default, values reached only through `export
//   type` and `export type *`, an export assignment's members merged with
//   its value's exports, a member keyed by a symbol left out, a value typed
//   as a class instance, a stand-in exporting `defineConfig` alone, and
//   S-7's stub package resolving to no module. S-4's own detections of the
//   listing are test/self/s4-module-channel.test.ts's.
//
// The stand-ins, test/fixtures/module-channel-ts/, documented here since
// JSON holds no comment: each a package in the dual-entry layout AGENTS.md's
// scaffold note describes — `package.json` (`"type": "module"`, the
// top-level `types` for `node10`, and `exports` serving `import` an ES
// module typed by `index.d.ts` and `require` a CommonJS module typed by
// `index.d.cts`), the two declaration files identical, and `index.js` and
// `index.cjs` returning their argument — exporting `defineConfig` alone
// (`export {}` keeps every other declaration unexported):
// - `conforming`: `defineConfig(settings: Settings): Settings`, `Settings`
//   an unexported type alias of an exact object type (`groups`, a record of
//   string lists; `output`, optionally `{ enabled: boolean }`), which
//   declaration emit inlines;
// - `declaration-error`: `conforming` beside an unexported declaration
//   naming a type that does not exist, an error located in the declaration
//   file alone;
// - `permissive`: `defineConfig(settings: any): any`;
// - `global-augmenting`: `conforming` beside a global augmentation giving
//   `RangeError` a `name` of type `number`, which TypeScript reports inside
//   its own `lib.es5.d.ts` (`RangeError` incorrectly extends `Error`).
// Two more serve the export listing alone:
// - `listing-meanings`: the dual-entry layout, its declaration files
//   differing. `index.d.ts` declares `defineConfig` merged with a namespace
//   holding a constant, exports it as itself and, type-only, as
//   `typeOnlyFunction`, re-exports `star.d.ts`'s constant `starValue`
//   through `export type *`, and declares a default export; `index.d.cts`
//   assigns (`export =`) a constant whose type carries `defineConfig` and a
//   member keyed by a unique symbol, merged with a namespace declaring a
//   type `defineConfig` and an interface `Options`.
// - `listing-instance`: a CommonJS package (no `type`, its top-level
//   `types` and `main` alone) whose `index.d.ts` assigns a constant typed
//   by a class declaring `defineConfig`.
// S-7's stub package (test/fixtures/empty-stub-package/, a manifest alone)
// serves as the stub.

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript-5.9.3";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  ModuleStaging,
  PROJECT_KINDS,
  TYPE_CHECKING_ARM,
} from "../helpers/module-channel.js";
import type { Placement, ProjectKind } from "../helpers/module-channel.js";
import {
  assertShapeViolation,
  assertTypeChecks,
  compilesAsEsModule,
  COVERED_EXTENSIONS,
  COVERED_OPTION_SETS,
  COVERED_SETUP_COUNT,
  COVERED_SETUPS,
  coveredSetupsOf,
  describeErrors,
  describeExportListing,
  INITIALIZED_PROJECT_OPTION_SET,
  stageCoveredFiles,
  STRICT_DEFAULT_OPTION_SETS,
} from "../helpers/module-channel-ts.js";
import type {
  CoveredFile,
  CoveredFiles,
  CoveredOptionSet,
  CoveredSetup,
  CoveredVerdict,
  ExportListing,
  ListedExport,
} from "../helpers/module-channel-ts.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import type { ProductBinding } from "../helpers/subprocess.js";

const LF = String.fromCodePoint(0x0a);

/** The committed stand-ins (module header), resolved like fixtures. */
const STAND_INS = {
  conforming: fixture("module-channel-ts/conforming"),
  declarationError: fixture("module-channel-ts/declaration-error"),
  permissive: fixture("module-channel-ts/permissive"),
  globalAugmenting: fixture("module-channel-ts/global-augmenting"),
  listingMeanings: fixture("module-channel-ts/listing-meanings"),
  listingInstance: fixture("module-channel-ts/listing-instance"),
  stub: fixture("empty-stub-package"),
} as const;

function fixture(rel: string): string {
  return fileURLToPath(new URL(`../fixtures/${rel}`, import.meta.url));
}

/** TypeScript 5.9.3's library directory, as TypeScript names its files. */
const LIBRARY_DIRECTORY = path.posix.dirname(
  ts.getDefaultLibFilePath({}).split(path.sep).join("/"),
);

/** The project directory every staging here holds, staging-relative. */
const PROJECT_DIR = "project";

/**
 * A binding of the certification fixtures' shape beside `packageDir`: its
 * executable is never run here.
 */
function standInBinding(packageDir: string): ProductBinding {
  return {
    label: "module-channel TypeScript driver stand-in binding",
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

/** The stand-ins' valid configuration file, importing from `name`. */
function validFile(name: string): CoveredFile {
  return {
    label: "the valid file",
    text: lines(
      `import { defineConfig } from ${JSON.stringify(name)};`,
      "",
      "export default defineConfig({",
      '  groups: { product: ["specs/*.mdx"] },',
      "  output: { enabled: true },",
      "});",
    ),
  };
}

/** The valid file with one unknown key: its shape-violation twin. */
function unknownKeyFile(name: string): CoveredFile {
  return {
    label: "its unknown-key twin",
    text: lines(
      `import { defineConfig } from ${JSON.stringify(name)};`,
      "",
      "export default defineConfig({",
      '  groups: { product: ["specs/*.mdx"] },',
      "  output: { enabled: true },",
      "  unknown: true,",
      "});",
    ),
  };
}

/** A valid file with an aliased binding and string-literal keys. */
function aliasedFile(name: string): CoveredFile {
  return {
    label: "the aliased, string-keyed file",
    text: lines(
      `import { defineConfig as define } from ${JSON.stringify(name)};`,
      "",
      "// A comment before the export.",
      "export default define({",
      '  "groups": { "product": ["specs/*.mdx"], "other": [] },',
      "});",
    ),
  };
}

/** The valid file with a string where the stand-in admits a boolean. */
function wrongKindFile(name: string): CoveredFile {
  return {
    label: "its wrong-kind twin",
    text: lines(
      `import { defineConfig } from ${JSON.stringify(name)};`,
      "",
      "export default defineConfig({",
      '  groups: { product: ["specs/*.mdx"] },',
      '  output: { enabled: "yes" },',
      "});",
    ),
  };
}

/** The strict defaults as TEST-SPEC §7.6 lists them: resolution, module. */
const STRICT_LISTING: readonly (readonly [string, string | undefined])[] = [
  ["node10", undefined],
  ["node16", "node16"],
  ["node16", "node18"],
  ["node16", "node20"],
  ["node16", "nodenext"],
  ["nodenext", "node16"],
  ["nodenext", "node18"],
  ["nodenext", "node20"],
  ["nodenext", "nodenext"],
  ["bundler", "es2015"],
  ["bundler", "es2020"],
  ["bundler", "es2022"],
  ["bundler", "esnext"],
  ["bundler", "preserve"],
];

/** The initialized-project set as SPEC 7.6 lists it. */
const INITIALIZED_LISTING = {
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
};

const RESOLUTION_KINDS: Readonly<Record<string, ts.ModuleResolutionKind>> = {
  node10: ts.ModuleResolutionKind.Node10,
  node16: ts.ModuleResolutionKind.Node16,
  nodenext: ts.ModuleResolutionKind.NodeNext,
  bundler: ts.ModuleResolutionKind.Bundler,
};

const MODULE_KINDS: Readonly<Record<string, ts.ModuleKind>> = {
  node16: ts.ModuleKind.Node16,
  node18: ts.ModuleKind.Node18,
  node20: ts.ModuleKind.Node20,
  nodenext: ts.ModuleKind.NodeNext,
  es2015: ts.ModuleKind.ES2015,
  es2020: ts.ModuleKind.ES2020,
  es2022: ts.ModuleKind.ES2022,
  esnext: ts.ModuleKind.ESNext,
  preserve: ts.ModuleKind.Preserve,
};

/**
 * The compiler options a set's program must carry, written out here apart
 * from the driver's own conversion: exactly the listed options.
 */
function expectedOptions(set: CoveredOptionSet): ts.CompilerOptions {
  if (set === INITIALIZED_PROJECT_OPTION_SET) {
    return {
      module: ts.ModuleKind.NodeNext,
      target: ts.ScriptTarget.ESNext,
      types: [],
      jsx: ts.JsxEmit.ReactJSX,
      moduleDetection: ts.ModuleDetectionKind.Force,
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
    };
  }
  const index = STRICT_DEFAULT_OPTION_SETS.indexOf(set);
  const listed = STRICT_LISTING[index];
  if (listed === undefined) throw new Error(`no listing for ${set.name}`);
  const [resolution, module] = listed;
  const options: ts.CompilerOptions = {
    strict: true,
    moduleResolution: RESOLUTION_KINDS[resolution],
  };
  if (module !== undefined) options.module = MODULE_KINDS[module];
  return options;
}

/**
 * Which of the stand-in's declaration files TypeScript resolves in `setup`:
 * under `node10`, which reads no `exports`, the top-level `types`; under
 * `node16` and `nodenext` (the initialized set's mode), the `require`
 * entry's for a file TypeScript compiles as CommonJS — by its extension and
 * its project's `type` — and the `import` entry's otherwise; under
 * `bundler`, the `require` entry's for a `.cts` file alone, the one name it
 * compiles as CommonJS.
 */
function resolvedDeclaration(
  setup: CoveredSetup,
): "index.d.ts" | "index.d.cts" {
  const resolution = setup.optionSet.tsconfig["moduleResolution"];
  if (resolution === "node10") return "index.d.ts";
  if (resolution === "bundler") {
    return setup.extension === ".cts" ? "index.d.cts" : "index.d.ts";
  }
  return compilesAsEsModule(setup.project, setup.extension)
    ? "index.d.ts"
    : "index.d.cts";
}

/** Whether a program file is one of TypeScript 5.9.3's own libraries. */
function isLibrary(file: string): boolean {
  return path.posix.dirname(file) === LIBRARY_DIRECTORY;
}

/** A placement's copy, as TypeScript names the files inside it. */
function insideCopy(placement: Placement, file: string): boolean {
  return file.startsWith(`${placement.copy.split(path.sep).join("/")}/`);
}

/** A verdict's comparable reading: everything but how it was reached. */
function reading(verdict: CoveredVerdict): unknown {
  return {
    typeChecks: verdict.typeChecks,
    failsToTypeCheck: verdict.failsToTypeCheck,
    errors: verdict.errors.map((error) => [
      error.origin,
      error.file,
      error.line,
      error.column,
      error.code,
    ]),
    programFiles: verdict.programFiles,
    compilerOptions: verdict.compilerOptions,
    exportListing: verdict.exportListing,
  };
}

/** The one covered setup of `project` with `extension` under `set`. */
function setupOf(
  project: ProjectKind,
  extension: CoveredSetup["extension"],
  set: CoveredOptionSet,
): CoveredSetup {
  const found = COVERED_SETUPS.find(
    (setup) =>
      setup.project === project &&
      setup.extension === extension &&
      setup.optionSet === set,
  );
  if (found === undefined) {
    throw new Error(`no covered setup: ${project}, ${extension}, ${set.name}`);
  }
  return found;
}

/** The strict defaults with `resolution` and `module`, from the listing. */
function strictSet(resolution: string, module?: string): CoveredOptionSet {
  const index = STRICT_LISTING.findIndex(
    ([r, m]) => r === resolution && m === module,
  );
  const set = STRICT_DEFAULT_OPTION_SETS[index];
  if (set === undefined)
    throw new Error(`no strict set ${resolution} ${String(module)}`);
  return set;
}

/** Judge one setup, expecting the files in request order. */
function judgedPair(
  files: CoveredFiles,
  setup: CoveredSetup,
): readonly [CoveredVerdict, CoveredVerdict] {
  const [first, second] = files.judge(setup);
  if (first === undefined || second === undefined) {
    throw new Error(`expected two verdicts in ${setup.label}`);
  }
  return [first, second];
}

test("the matrix: 173 covered setups, each project and extension with exactly the option sets covering it, each set as TEST-SPEC §7.6 lists it and as release 5.9.3's tsc --init writes the initialized set (TEST-SPEC §7.6 Covered setups)", () => {
  expect(COVERED_SETUP_COUNT).toBe(173);
  expect(COVERED_SETUPS).toHaveLength(173);
  expect(STRICT_DEFAULT_OPTION_SETS.map((set) => set.tsconfig)).toStrictEqual(
    STRICT_LISTING.map(([moduleResolution, module]) =>
      module === undefined
        ? { strict: true, moduleResolution }
        : { strict: true, moduleResolution, module },
    ),
  );
  expect(
    STRICT_DEFAULT_OPTION_SETS.every((set) => set.kind === "strict defaults"),
  ).toBe(true);
  expect(INITIALIZED_PROJECT_OPTION_SET.tsconfig).toStrictEqual(
    INITIALIZED_LISTING,
  );
  expect(INITIALIZED_PROJECT_OPTION_SET.kind).toBe(
    "initialized-project options",
  );
  const initWriter = (
    ts as unknown as {
      generateTSConfig(options: ts.CompilerOptions, newLine: string): string;
    }
  ).generateTSConfig({}, LF);
  const written = ts.parseConfigFileTextToJson("tsconfig.json", initWriter);
  expect(written.error).toBeUndefined();
  expect(
    (written.config as { compilerOptions: unknown }).compilerOptions,
  ).toStrictEqual(INITIALIZED_LISTING);
  expect(COVERED_OPTION_SETS).toStrictEqual([
    ...STRICT_DEFAULT_OPTION_SETS,
    INITIALIZED_PROJECT_OPTION_SET,
  ]);
  for (const set of COVERED_OPTION_SETS) {
    expect(set.compilerOptions, set.name).toStrictEqual(expectedOptions(set));
  }
  const esModule: Record<ProjectKind, readonly string[]> = {
    "es-module": [".ts", ".mts", ".tsx"],
    commonjs: [".mts"],
    "no-manifest": [".mts"],
  };
  for (const project of PROJECT_KINDS) {
    for (const extension of COVERED_EXTENSIONS) {
      const covering = esModule[project].includes(extension)
        ? COVERED_OPTION_SETS
        : STRICT_DEFAULT_OPTION_SETS;
      expect(compilesAsEsModule(project, extension)).toBe(
        esModule[project].includes(extension),
      );
      expect(
        COVERED_SETUPS.filter(
          (setup) => setup.project === project && setup.extension === extension,
        ).map((setup) => setup.optionSet),
        `${project} ${extension}`,
      ).toStrictEqual(covering);
    }
    expect(coveredSetupsOf(project)).toStrictEqual(
      COVERED_SETUPS.filter((setup) => setup.project === project),
    );
  }
  expect(new Set(COVERED_SETUPS.map((setup) => setup.label)).size).toBe(173);
});

test("every covered setup's program carries exactly its set's options, read back from the program; a conforming stand-in's valid file type-checks and its unknown-key twin fails to type-check, paired, in all 173 setups, through the declaration file each setup resolves (TEST-SPEC §7.6 Covered setups, Verdict, Pairing)", async () => {
  let judged = 0;
  for (const project of PROJECT_KINDS) {
    const context = `the conforming stand-in in the ${project} project`;
    const { staging, placement } = await stagedProject(
      STAND_INS.conforming,
      project,
      context,
    );
    const files = await stageCoveredFiles({
      staging,
      directory: PROJECT_DIR,
      project,
      placement,
      alone: true,
      files: [validFile(placement.name), unknownKeyFile(placement.name)],
      context,
    });
    expect(files.setups).toStrictEqual(coveredSetupsOf(project));
    for (const setup of files.setups) {
      const [valid, arm] = judgedPair(files, setup);
      expect(valid.judged, setup.label).toBe("batched");
      expect(valid.compilerOptions, setup.label).toStrictEqual(
        expectedOptions(setup.optionSet),
      );
      expect(valid.file.endsWith(setup.extension), setup.label).toBe(true);
      assertTypeChecks(valid, context);
      assertShapeViolation(valid, arm, context);
      expect(
        arm.errors.every((error) => error.origin === "configuration file"),
        setup.label,
      ).toBe(true);
      const packageFiles = valid.programFiles.filter((file) =>
        insideCopy(placement, file),
      );
      expect(packageFiles, setup.label).toStrictEqual([
        `${placement.copy.split(path.sep).join("/")}/${resolvedDeclaration(setup)}`,
      ]);
      expect(
        valid.programFiles.filter(
          (file) =>
            file !== valid.file &&
            !isLibrary(file) &&
            !insideCopy(placement, file),
        ),
        setup.label,
      ).toStrictEqual([]);
      expect(valid.programFiles.some(isLibrary), setup.label).toBe(true);
      judged += 1;
    }
  }
  expect(judged).toBe(COVERED_SETUP_COUNT);
});

test("an error only in the package's declaration file: the valid file does not type-check under the strict defaults, yet no error is located in the configuration file; the initialized set, skipLibCheck on, admits it (TEST-SPEC §7.6 Verdict)", async () => {
  const project: ProjectKind = "es-module";
  const context = "the declaration-error stand-in";
  const { staging, placement } = await stagedProject(
    STAND_INS.declarationError,
    project,
    context,
  );
  const files = await stageCoveredFiles({
    staging,
    directory: PROJECT_DIR,
    project,
    placement,
    alone: true,
    files: [validFile(placement.name), unknownKeyFile(placement.name)],
    context,
  });
  for (const setup of files.setups) {
    const [valid] = judgedPair(files, setup);
    if (setup.optionSet === INITIALIZED_PROJECT_OPTION_SET) {
      assertTypeChecks(valid, context);
      continue;
    }
    expect(valid.typeChecks, setup.label).toBe(false);
    expect(valid.failsToTypeCheck, setup.label).toBe(false);
    expect(valid.errors.length, setup.label).toBeGreaterThan(0);
    for (const error of valid.errors) {
      expect(error.origin, setup.label).toBe("another file");
      expect(
        error.file !== undefined && insideCopy(placement, error.file),
        setup.label,
      ).toBe(true);
    }
    expect(() => {
      assertTypeChecks(valid, context);
    }).toThrow(HarnessAssertionError);
  }
});

test("the paired verdict fails diagnosed where the valid twin does not type-check (an error in the package's declaration file, S-7's stub package) and where the arm does not fail to type-check (a permissive package); verdicts of different setups pair as a misuse (TEST-SPEC §7.6 Pairing)", async () => {
  const project: ProjectKind = "es-module";
  const strictSetup = setupOf(project, ".ts", strictSet("node10"));
  const requireSetup = setupOf(
    project,
    ".cts",
    strictSet("nodenext", "nodenext"),
  );
  const setups = [
    strictSetup,
    requireSetup,
    setupOf(project, ".mts", INITIALIZED_PROJECT_OPTION_SET),
  ];
  const judgeIn = async (
    packageDir: string,
    context: string,
  ): Promise<{
    readonly files: CoveredFiles;
    readonly placement: Placement;
  }> => {
    const { staging, placement } = await stagedProject(
      packageDir,
      project,
      context,
    );
    const files = await stageCoveredFiles({
      staging,
      directory: PROJECT_DIR,
      project,
      placement,
      alone: true,
      files: [validFile(placement.name), unknownKeyFile(placement.name)],
      setups,
      context,
    });
    return { files, placement };
  };
  const broken = await judgeIn(STAND_INS.declarationError, "declaration error");
  const [brokenValid, brokenArm] = judgedPair(broken.files, strictSetup);
  expect(brokenArm.failsToTypeCheck).toBe(true);
  expect(() => {
    assertShapeViolation(brokenValid, brokenArm, "declaration error");
  }).toThrow(/Pairing/);
  expect(() => {
    assertShapeViolation(brokenValid, brokenArm, "declaration error");
  }).toThrow(HarnessAssertionError);
  const permissive = await judgeIn(STAND_INS.permissive, "permissive");
  const stub = await judgeIn(STAND_INS.stub, "stub");
  for (const setup of setups) {
    const [valid, arm] = judgedPair(permissive.files, setup);
    assertTypeChecks(valid, "permissive");
    expect(arm.typeChecks, setup.label).toBe(true);
    expect(() => {
      assertShapeViolation(valid, arm, "permissive");
    }).toThrow(/does not fail to type-check/);
    const [stubValid, stubArm] = judgedPair(stub.files, setup);
    expect(stubValid.failsToTypeCheck, setup.label).toBe(true);
    expect(() => {
      assertTypeChecks(stubValid, "stub");
    }).toThrow(HarnessAssertionError);
    expect(() => {
      assertShapeViolation(stubValid, stubArm, "stub");
    }).toThrow(/Pairing/);
  }
  const [first] = judgedPair(permissive.files, strictSetup);
  const [, second] = judgedPair(permissive.files, requireSetup);
  let misuse: unknown;
  try {
    assertShapeViolation(first, second, "across setups");
  } catch (error) {
    misuse = error;
  }
  expect(misuse).toBeInstanceOf(Error);
  expect(misuse).not.toBeInstanceOf(HarnessAssertionError);
});

/** The sample of setups the sharing is compared on (module header). */
const SAMPLE: readonly CoveredSetup[] = [
  setupOf("es-module", ".ts", strictSet("node10")),
  setupOf("es-module", ".tsx", INITIALIZED_PROJECT_OPTION_SET),
  setupOf("es-module", ".cts", strictSet("nodenext", "nodenext")),
  setupOf("commonjs", ".mts", strictSet("node16", "node18")),
  setupOf("commonjs", ".ts", strictSet("nodenext", "node20")),
  setupOf("no-manifest", ".cts", strictSet("bundler", "es2015")),
  setupOf("no-manifest", ".tsx", strictSet("bundler", "preserve")),
  setupOf("no-manifest", ".mts", INITIALIZED_PROJECT_OPTION_SET),
];

test("the driver's sharing reads every verdict its reference reading does, each file's export listing included — one root, nothing shared but parsed libraries — on a sample of setups, a package whose global augmentation puts errors inside a library among them (helpers/module-channel-ts.ts header)", async () => {
  for (const project of PROJECT_KINDS) {
    const setups = SAMPLE.filter((setup) => setup.project === project);
    for (const packageDir of [
      STAND_INS.conforming,
      STAND_INS.globalAugmenting,
    ]) {
      const context = `${path.basename(packageDir)} in the ${project} project`;
      const { staging, placement } = await stagedProject(
        packageDir,
        project,
        context,
      );
      const staged = [
        validFile(placement.name),
        unknownKeyFile(placement.name),
        aliasedFile(placement.name),
        wrongKindFile(placement.name),
      ];
      const files = await stageCoveredFiles({
        staging,
        directory: PROJECT_DIR,
        project,
        placement,
        alone: true,
        listExports: true,
        files: staged,
        setups,
        context,
      });
      for (const setup of setups) {
        const verdicts = files.judge(setup);
        expect(
          verdicts.map((verdict) => verdict.judged),
          setup.label,
        ).toStrictEqual(staged.map(() => "batched"));
        for (const verdict of verdicts) {
          expect(
            verdict.exportListing?.exports.map((entry) => entry.name),
            `${context}, ${verdict.label}, ${setup.label}: ` +
              describeExportListing(verdict.exportListing),
          ).toStrictEqual(["defineConfig"]);
        }
        for (const verdict of verdicts) {
          const reference = files.judgeUnshared(setup, verdict.label);
          expect(reference.judged).toBe("unshared");
          expect(
            reading(verdict),
            `${context}, ${verdict.label}, ${setup.label}`,
          ).toStrictEqual(reading(reference));
        }
        const [valid, arm, aliased, wrongKind] = verdicts;
        if (
          valid === undefined ||
          arm === undefined ||
          aliased === undefined ||
          wrongKind === undefined
        ) {
          throw new Error("four verdicts expected");
        }
        const augmentedLibraries =
          packageDir === STAND_INS.globalAugmenting &&
          setup.optionSet !== INITIALIZED_PROJECT_OPTION_SET;
        if (augmentedLibraries) {
          expect(valid.typeChecks, setup.label).toBe(false);
          expect(valid.failsToTypeCheck, setup.label).toBe(false);
          expect(
            valid.errors.some(
              (error) => error.file !== undefined && isLibrary(error.file),
            ),
            setup.label,
          ).toBe(true);
        } else {
          assertTypeChecks(valid, context);
          assertTypeChecks(aliased, context);
          assertShapeViolation(valid, arm, context);
          assertShapeViolation(valid, wrongKind, context);
        }
      }
    }
  }
});

test("a batch whose files' imports bring in different files, or one of whose files contributes to the global scope or augments a module, is judged file by file, each verdict its reference reading's, a module augmentation reaching its own file's export listing alone (helpers/module-channel-ts.ts header)", async () => {
  const project: ProjectKind = "es-module";
  const context = "file-by-file batches";
  const { staging, placement } = await stagedProject(
    STAND_INS.conforming,
    project,
    context,
  );
  await staging.writeFile(
    `${PROJECT_DIR}/covered-helper.ts`,
    lines('export const pattern = "specs/*.mdx";'),
  );
  const importing: CoveredFile = {
    label: "a file importing a helper beside it",
    text: lines(
      `import { defineConfig } from ${JSON.stringify(placement.name)};`,
      'import { pattern } from "./covered-helper.js";',
      "",
      "export default defineConfig({ groups: { product: [pattern] } });",
    ),
  };
  const script: CoveredFile = {
    label: "a file importing nothing",
    text: lines("declare const scriptGlobal: number;"),
  };
  const augmenting: CoveredFile = {
    label: "a file augmenting the global scope",
    text: lines(
      `import { defineConfig } from ${JSON.stringify(placement.name)};`,
      "",
      "declare global {",
      "  var augmentedGlobal: number;",
      "}",
      "",
      "export default defineConfig({ groups: { product: [] } });",
    ),
  };
  const moduleAugmenting: CoveredFile = {
    label: "a file augmenting the package's module",
    text: lines(
      `import { defineConfig } from ${JSON.stringify(placement.name)};`,
      "",
      `declare module ${JSON.stringify(placement.name)} {`,
      "  export const augmentedExport: number;",
      "}",
      "",
      "export default defineConfig({ groups: { product: [] } });",
    ),
  };
  const setups = [
    setupOf(project, ".ts", strictSet("node10")),
    setupOf(project, ".ts", INITIALIZED_PROJECT_OPTION_SET),
  ];
  for (const [label, extra] of [
    ["imports", importing],
    ["script", script],
    ["augmenting", augmenting],
    ["augmenting a module", moduleAugmenting],
  ] as const) {
    const files = await stageCoveredFiles({
      staging,
      directory: PROJECT_DIR,
      project,
      placement,
      listExports: label === "augmenting a module",
      files: [validFile(placement.name), extra],
      setups,
      context: `${context}, ${label}`,
    });
    for (const setup of setups) {
      const verdicts = files.judge(setup);
      expect(
        verdicts.map((verdict) => verdict.judged),
        `${label}, ${setup.label}`,
      ).toStrictEqual(["own program", "own program"]);
      for (const verdict of verdicts) {
        expect(
          reading(verdict),
          `${verdict.label}, ${setup.label}`,
        ).toStrictEqual(reading(files.judgeUnshared(setup, verdict.label)));
      }
      const [valid, other] = verdicts;
      if (valid === undefined || other === undefined)
        throw new Error("two verdicts");
      assertTypeChecks(valid, context);
      expect(
        valid.programFiles.some((file) => file.endsWith("/covered-helper.ts")),
      ).toBe(false);
      assertTypeChecks(other, context);
      expect(
        other.programFiles.some((file) => file.endsWith("/covered-helper.ts")),
      ).toBe(label === "imports");
      expect(
        other.programFiles.some((file) => insideCopy(placement, file)),
      ).toBe(label !== "script");
      if (label === "augmenting a module") {
        expect(
          [valid, other].map((verdict) =>
            verdict.exportListing?.exports.map((entry) => entry.name),
          ),
          `${label}, ${setup.label}: the augmentation reaches its own ` +
            `program's listing alone`,
        ).toStrictEqual([
          ["defineConfig"],
          ["augmentedExport", "defineConfig"],
        ]);
      }
    }
  }
});

/** A staged program-condition vector: extra files beside the placement. */
async function conditionVector(
  extra: Readonly<Record<string, string>>,
  context: string,
): Promise<CoveredFiles> {
  const project: ProjectKind = "es-module";
  const { staging, placement } = await stagedProject(
    STAND_INS.conforming,
    project,
    context,
  );
  for (const [rel, text] of Object.entries(extra)) {
    await staging.writeFile(`${PROJECT_DIR}/${rel}`, text);
  }
  return stageCoveredFiles({
    staging,
    directory: PROJECT_DIR,
    project,
    placement,
    files: [validFile(placement.name), unknownKeyFile(placement.name)],
    setups: [
      setupOf(project, ".ts", strictSet("node10")),
      setupOf(project, ".ts", INITIALIZED_PROJECT_OPTION_SET),
    ],
    context,
  });
}

/** Expect `judge` to refuse the setup as a program-condition violation. */
function expectRefused(
  files: CoveredFiles,
  setup: CoveredSetup,
  reason: RegExp,
): void {
  let refused: unknown;
  try {
    files.judge(setup);
  } catch (error) {
    refused = error;
  }
  expect(refused, setup.label).toBeInstanceOf(HarnessStagingError);
  expect(String(refused), setup.label).toMatch(
    /program condition does not hold/,
  );
  expect(String(refused), setup.label).toMatch(reason);
  let unshared: unknown;
  try {
    files.judgeUnshared(setup, "the valid file");
  } catch (error) {
    unshared = error;
  }
  expect(unshared, setup.label).toBeInstanceOf(HarnessStagingError);
}

test("SPEC 7.6's program condition, read from TypeScript's include reasons: an @types package included automatically, a library an installed package replaces, and a module TypeScript imports implicitly are refused as harness errors where they enter the program, and admitted where they do not (TEST-SPEC §7.6 Placement; SPEC 7.6 Covered setups, Program)", async () => {
  const [strict, initialized] = [
    setupOf("es-module", ".ts", strictSet("node10")),
    setupOf("es-module", ".ts", INITIALIZED_PROJECT_OPTION_SET),
  ];
  const automatic = await conditionVector(
    {
      "node_modules/@types/stray/index.d.ts": lines(
        "declare var strayGlobal: number;",
      ),
    },
    "an automatic @types package",
  );
  expectRefused(
    automatic,
    strict,
    /included automatically as the type package stray/,
  );
  const [kept] = automatic.judge(initialized);
  if (kept === undefined) throw new Error("a verdict expected");
  assertTypeChecks(kept, "types [] keeps the @types package out");
  expect(kept.programFiles.some((file) => file.includes("/@types/"))).toBe(
    false,
  );
  const replaced = await conditionVector(
    {
      "node_modules/@typescript/lib-es5/package.json": lines(
        JSON.stringify({
          name: "@typescript/lib-es5",
          version: "1.0.0",
          types: "./index.d.ts",
        }),
      ),
      "node_modules/@typescript/lib-es5/index.d.ts": lines(
        "interface Array<T> { length: number }",
      ),
    },
    "a replaced library",
  );
  expectRefused(replaced, strict, /an installed package replaces it/);
  expectRefused(replaced, initialized, /an installed package replaces it/);
  const implicit = await conditionVector(
    {
      "node_modules/react/package.json": lines(
        JSON.stringify({
          name: "react",
          version: "1.0.0",
          types: "./index.d.ts",
          exports: {
            ".": { types: "./index.d.ts" },
            "./jsx-runtime": { types: "./jsx-runtime.d.ts" },
          },
        }),
      ),
      "node_modules/react/index.d.ts": lines("export {};"),
      "node_modules/react/jsx-runtime.d.ts": lines(
        "export declare const jsx: unknown;",
      ),
    },
    "a module imported implicitly",
  );
  expectRefused(implicit, initialized, /import TypeScript synthesizes/);
  const [admitted] = implicit.judge(strict);
  if (admitted === undefined) throw new Error("a verdict expected");
  assertTypeChecks(admitted, "no jsx: nothing imported implicitly");
});

test("misuses are plain errors: no file, a duplicate label, a setup of another project, a setup the files were not staged for, and an export listing asked of a file holding no import declaration (helpers/module-channel-ts.ts)", async () => {
  const project: ProjectKind = "commonjs";
  const context = "misuses";
  const { staging, placement } = await stagedProject(
    STAND_INS.conforming,
    project,
    context,
  );
  const request = {
    staging,
    directory: PROJECT_DIR,
    project,
    placement,
    context,
  };
  const misuse = async (run: () => Promise<unknown>): Promise<unknown> => {
    try {
      await run();
    } catch (error) {
      return error;
    }
    return undefined;
  };
  for (const error of [
    await misuse(() => stageCoveredFiles({ ...request, files: [] })),
    await misuse(() =>
      stageCoveredFiles({
        ...request,
        files: [validFile(placement.name), validFile(placement.name)],
      }),
    ),
    await misuse(() =>
      stageCoveredFiles({
        ...request,
        files: [validFile(placement.name)],
        setups: [setupOf("es-module", ".ts", strictSet("node10"))],
      }),
    ),
  ]) {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(HarnessAssertionError);
    expect(error).not.toBeInstanceOf(HarnessStagingError);
  }
  const files = await stageCoveredFiles({
    ...request,
    files: [validFile(placement.name)],
    setups: [setupOf(project, ".ts", strictSet("node10"))],
  });
  expect(() =>
    files.judge(setupOf(project, ".mts", strictSet("node10"))),
  ).toThrow(/not among the setups/);
  const unlisted = await stageCoveredFiles({
    ...request,
    listExports: true,
    files: [
      {
        label: "a file holding no import declaration",
        text: lines("export default 1;"),
      },
    ],
    setups: [setupOf(project, ".ts", strictSet("node10"))],
  });
  let listingMisuse: unknown;
  try {
    unlisted.judge(setupOf(project, ".ts", strictSet("node10")));
  } catch (error) {
    listingMisuse = error;
  }
  expect(listingMisuse).toBeInstanceOf(Error);
  expect(listingMisuse).not.toBeInstanceOf(HarnessAssertionError);
  expect(listingMisuse).not.toBeInstanceOf(HarnessStagingError);
  expect(String(listingMisuse)).toMatch(/one import declaration/);
});

test(`a CommonJS project whose nearest package.json holds "type": "commonjs" is staged with that type declared beside its kind: Reach confirms it for each written file and the valid file type-checks in a CommonJS project's setup; declared without it, the staging is refused before any program exists (TEST-SPEC T7.6-5(c); helpers/module-channel.ts ReachStaging.nearestType)`, async () => {
  const project: ProjectKind = "commonjs";
  const context = "a nearest manifest typed commonjs";
  const { staging, placement } = await stagedProject(
    STAND_INS.conforming,
    "no-manifest",
    context,
  );
  await staging.writeFile(
    `${PROJECT_DIR}/package.json`,
    lines(JSON.stringify({ type: "commonjs" })),
  );
  const setup = setupOf(project, ".ts", strictSet("node16", "node16"));
  const request = {
    staging,
    directory: PROJECT_DIR,
    project,
    placement,
    alone: true,
    files: [validFile(placement.name)],
    setups: [setup],
    context,
  };
  const files = await stageCoveredFiles({
    ...request,
    nearestType: "commonjs",
  });
  const [verdict] = files.judge(setup);
  expect(verdict?.typeChecks, describeErrors(verdict?.errors ?? [])).toBe(true);
  let refusal: unknown;
  try {
    await stageCoveredFiles(request);
  } catch (error) {
    refusal = error;
  }
  expect(refusal).toBeInstanceOf(HarnessStagingError);
  expect(String(refusal)).toContain("is declared");
});

/** A listed export written out: its meanings, and where it is listed. */
function listedExport(
  name: string,
  meanings: {
    readonly value?: boolean;
    readonly typeOnlyValue?: boolean;
    readonly type?: boolean;
    readonly namespace?: boolean;
  },
  listedIn: ListedExport["listedIn"],
): ListedExport {
  return {
    name,
    value: meanings.value === true,
    typeOnlyValue: meanings.typeOnlyValue === true,
    type: meanings.type === true,
    namespace: meanings.namespace === true,
    listedIn,
  };
}

/** A listing expected, its module named by its path in the package. */
type ExpectedListing = Omit<ExportListing, "module"> & {
  readonly module: string | undefined;
};

test("the export listing reads each name with its meanings as TypeScript resolves the file's import, through each entry: a value merged with a namespace, a declared default, values reached only through export type and export type *, an export assignment's members merged with its value's exports and a symbol-keyed member left out, a value typed as a class instance, a stand-in exporting defineConfig alone, and S-7's stub package resolving to no module — each listing its reference reading's (helpers/module-channel-ts.ts header; TEST-SPEC T7.6-1)", async () => {
  const project: ProjectKind = "es-module";
  const importEntry = setupOf(
    project,
    ".mts",
    strictSet("nodenext", "nodenext"),
  );
  const requireEntry = setupOf(
    project,
    ".cts",
    strictSet("nodenext", "nodenext"),
  );
  const cases: readonly (readonly [
    string,
    (setup: CoveredSetup) => ExpectedListing,
  ])[] = [
    [
      STAND_INS.listingMeanings,
      (setup) =>
        setup === importEntry
          ? {
              module: "index.d.ts",
              exportAssignment: false,
              exports: [
                listedExport("default", { value: true }, ["exports"]),
                listedExport("defineConfig", { value: true, namespace: true }, [
                  "exports",
                ]),
                listedExport("starValue", { typeOnlyValue: true }, ["exports"]),
                listedExport(
                  "typeOnlyFunction",
                  { typeOnlyValue: true, namespace: true },
                  ["exports"],
                ),
              ],
            }
          : {
              module: "index.d.cts",
              exportAssignment: true,
              exports: [
                listedExport("Options", { type: true }, ["exports"]),
                listedExport("defineConfig", { value: true, type: true }, [
                  "exports",
                  "export assignment",
                ]),
              ],
            },
    ],
    [
      STAND_INS.listingInstance,
      () => ({
        module: "index.d.ts",
        exportAssignment: true,
        exports: [
          listedExport("defineConfig", { value: true }, ["export assignment"]),
        ],
      }),
    ],
    [
      STAND_INS.conforming,
      (setup) => ({
        module: setup === importEntry ? "index.d.ts" : "index.d.cts",
        exportAssignment: false,
        exports: [listedExport("defineConfig", { value: true }, ["exports"])],
      }),
    ],
    [
      STAND_INS.stub,
      () => ({ module: undefined, exportAssignment: false, exports: [] }),
    ],
  ];
  for (const [packageDir, expected] of cases) {
    const context = `the export listing of ${path.basename(packageDir)}`;
    const { staging, placement } = await stagedProject(
      packageDir,
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
      files: [validFile(placement.name)],
      setups: [importEntry, requireEntry],
      context,
    });
    const copy = placement.copy.split(path.sep).join("/");
    for (const setup of [importEntry, requireEntry]) {
      const [verdict] = files.judge(setup);
      const want = expected(setup);
      const listing: ExportListing = {
        ...want,
        module:
          want.module === undefined ? undefined : `${copy}/${want.module}`,
      };
      expect(
        verdict?.exportListing,
        `${context}, ${setup.label}: the driver lists ` +
          describeExportListing(verdict?.exportListing),
      ).toStrictEqual(listing);
      expect(
        files.judgeUnshared(setup, "the valid file").exportListing,
        `${context}, ${setup.label}: the reference reading's listing`,
      ).toStrictEqual(listing);
    }
  }
});
