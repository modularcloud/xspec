// S-4's detections of 7.6's covered setups, I: each `moduleResolution` and
// `module` value of the matrix (TEST-SPEC 17 S-4, from "7.6's covered setups
// are detected in effect likewise"; §7.6 Covered setups; SPEC 7.6 Covered
// setups). Every type-checking arm of 7.6 judges its files through the
// module channel's TypeScript driver (helpers/module-channel-ts.ts) in each
// of the 173 covered setups. A driver serving one setup's settings for
// another's would make that setup's arms a rerun of the other's, and one
// dropping a setup would leave it unjudged, each passing conformer and
// violator alike. So, before any product exists, each setting is detected
// in effect here through that same driver (`stageCoveredFiles`,
// `CoveredFiles.judge`), over hand-written non-xspec stand-in packages placed
// as the tests place a package (helpers/module-channel.ts: a fresh staging,
// the canonical placement, Reach verified, nothing else installed), in each
// setup whose verdict the setting decides, both sides: rejected where the
// setting rejects the construct, admitted where it admits it. The settings
// detected here are the fourteen strict defaults' `moduleResolution` and
// `module` values, which spell every value the matrix holds; the
// initialized-project set's own options are the next S-4 detections'.
//
// The detections, each with the setups it is judged in and the values that
// reject it (release 5.9.3's verdicts, wherever it gives a value an effect
// of its own; TypeScript's error code is a diagnostic aid, never pinned):
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
// A rejection is pinned by its effect: TypeScript reports at least one
// error for the file's program and every one of them lies in the
// configuration file where the construct begins — its line and column
// computed from the file's own text, the construct occurring there once — so
// a setup rejecting the file for any other reason fails here as surely as
// one admitting it. An admission is the driver's verdict that the file
// type-checks: no error anywhere in its program (TEST-SPEC §7.6 Verdict).
// The ES-module and CommonJS files are written out here apart from the
// driver's own reading, and each detection's count of setups judged and
// rejecting is pinned, so a matrix dropping a setup fails here too. Every
// mismatch of a detection is collected and reported at once, naming its
// setup.
//
// The stand-ins, test/fixtures/s4-module-channel/, documented here since
// JSON holds no comment: each declares `defineConfig<T>(value: T): T` and
// nothing else, its runtime files returning their argument.
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

import { fileURLToPath } from "node:url";
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
  stageCoveredFiles,
} from "../helpers/module-channel-ts.js";
import type {
  CoveredExtension,
  CoveredSetup,
  CoveredVerdict,
} from "../helpers/module-channel-ts.js";
import type { ProductBinding } from "../helpers/subprocess.js";

const LF = String.fromCodePoint(0x0a);

/** The committed stand-ins (module header), resolved like fixtures. */
const STAND_INS = {
  exportsOnly: fixture("s4-module-channel/exports-only"),
  esmOnly: fixture("s4-module-channel/esm-only"),
  dual: fixture("s4-module-channel/dual"),
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
   * occur once in the file, where TypeScript's error begins.
   */
  readonly construct: (name: string) => string;
  /** Whether it is judged in a strict-default setup. */
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

const EXPORTS_ONLY: Detection = {
  name: "an exports-only stand-in imported",
  standIn: STAND_INS.exportsOnly,
  text: plainImport,
  construct: (name) => JSON.stringify(name),
  judgedIn: () => true,
  rejectedIn: (setup) => resolutionOf(setup) === "node10",
  counts: { judged: 168, rejected: 12 },
};

const ESM_ONLY_FROM_COMMONJS: Detection = {
  name: "an ES-module-only stand-in imported from a file TypeScript compiles as CommonJS",
  standIn: STAND_INS.esmOnly,
  text: plainImport,
  construct: (name) => JSON.stringify(name),
  judgedIn: (setup) =>
    NODE_MODES.has(resolutionOf(setup)) && !compiledAsEsModule(setup),
  rejectedIn: (setup) => ["node16", "node18"].includes(moduleOf(setup) ?? ""),
  counts: { judged: 56, rejected: 28 },
};

const NODE_IMPORT_ATTRIBUTES: Detection = {
  name: "import attributes on an import of a JavaScript module, in a file TypeScript compiles as an ES module",
  standIn: STAND_INS.dual,
  text: attributedImport,
  construct: () => "with {",
  judgedIn: (setup) =>
    NODE_MODES.has(resolutionOf(setup)) && compiledAsEsModule(setup),
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
  judgedIn: (setup) => NODE_MODES.has(resolutionOf(setup)),
  rejectedIn: (setup) => moduleOf(setup) !== "nodenext",
  counts: { judged: 96, rejected: 72 },
};

const BUNDLER_IMPORT_META: Detection = {
  name: "import.meta under bundler",
  standIn: STAND_INS.dual,
  text: (name) =>
    lines(
      `import { defineConfig } from ${JSON.stringify(name)};`,
      "",
      "export default defineConfig({ meta: import.meta });",
    ),
  construct: () => "import.meta",
  judgedIn: (setup) => resolutionOf(setup) === "bundler",
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
  judgedIn: (setup) => resolutionOf(setup) === "bundler",
  rejectedIn: (setup) => ["es2015", "es2020"].includes(moduleOf(setup) ?? ""),
  counts: { judged: 60, rejected: 24 },
};

const BUNDLER_IMPORT_ATTRIBUTES: Detection = {
  name: "import attributes under bundler, in a file TypeScript compiles as an ES module there",
  standIn: STAND_INS.dual,
  text: attributedImport,
  construct: () => "with {",
  judgedIn: (setup) =>
    resolutionOf(setup) === "bundler" && setup.extension !== ".cts",
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
  judgedIn: (setup) => resolutionOf(setup) === "bundler",
  rejectedIn: (setup) => moduleOf(setup) !== "preserve",
  counts: { judged: 60, rejected: 48 },
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

/** Why a verdict is no rejection at `position`, or undefined where it is. */
function rejectionProblem(
  verdict: CoveredVerdict,
  construct: string,
  position: Position,
): string | undefined {
  const where = `${String(position.line)}:${String(position.column)}`;
  if (verdict.errors.length === 0) {
    return (
      `admitted — TypeScript 5.9.3 reports no error — where the setting ` +
      `rejects the file, an error expected at ${JSON.stringify(construct)} ` +
      `(${where} of the configuration file)`
    );
  }
  const elsewhere = verdict.errors.some(
    (error) =>
      error.origin !== "configuration file" ||
      error.line !== position.line ||
      error.column !== position.column,
  );
  if (!elsewhere) return undefined;
  return (
    `rejected otherwise than at ${JSON.stringify(construct)} (${where} of ` +
    `the configuration file): ${describeErrors(verdict.errors)}`
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
 * Judge `detection` in each strict-default setup it is judged in, project by
 * project, each project a fresh staging of its stand-in (module header), and
 * expect every verdict the setting decides together with the counts.
 */
async function expectDetected(detection: Detection): Promise<void> {
  const mismatches: string[] = [];
  let judged = 0;
  let rejected = 0;
  for (const project of PROJECT_KINDS) {
    const setups = COVERED_SETUPS.filter(
      (setup) =>
        setup.project === project &&
        setup.optionSet.kind === "strict defaults" &&
        detection.judgedIn(setup),
    );
    if (setups.length === 0) continue;
    const context = `S-4, ${detection.name}, in the ${project} project`;
    const { staging, placement } = await stagedProject(
      detection.standIn,
      project,
      context,
    );
    const text = detection.text(placement.name);
    const construct = detection.construct(placement.name);
    const position = locate(text, construct, context);
    const files = await stageCoveredFiles({
      staging,
      directory: PROJECT_DIR,
      project,
      placement,
      alone: true,
      files: [{ label: detection.name, text }],
      setups,
      context,
    });
    for (const setup of setups) {
      const [verdict] = files.judge(setup);
      if (verdict === undefined) {
        throw new Error(`${context}: no verdict in ${setup.label}`);
      }
      judged += 1;
      const rejects = detection.rejectedIn(setup);
      if (rejects) rejected += 1;
      const problem = rejects
        ? rejectionProblem(verdict, construct, position)
        : admissionProblem(verdict);
      if (problem !== undefined) {
        mismatches.push(`${setup.label}: ${problem}`);
      }
    }
  }
  expect(
    { mismatches, judged, rejected },
    `${detection.name}: each setup's verdict as its setting decides it, ` +
      `and the setups judged and rejecting`,
  ).toStrictEqual({ mismatches: [], ...detection.counts });
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
