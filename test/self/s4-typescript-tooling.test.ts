// S-4 TypeScript tooling driver self-test (TEST-SPEC 17 S-4, with H-2 and
// §4's opening paragraph). Section 4's consumer-side assertions — type
// errors at exact locations, hover text, and go-to-definition targets
// (SPEC.md 4, 13.1) — reach TypeScript only through the tooling driver
// (test/helpers/tooling.ts), which fixes H-2's two configurations — the
// CommonJS configuration and the ES-module configuration — and makes every
// type-checking and language-service assertion under each. S-4 pins that
// driver, in each configuration, against a hand-written, non-xspec fixture
// project (test/fixtures/s4-tooling/) compiled and served in that
// configuration from a copy in a fresh workspace under the OS temporary
// directory, as a consumer workspace is compiled — no `package.json` or
// `node_modules` above it, so the release's default `types` brings no
// `@types` package of this repository into the program (H-2: every option
// H-2 does not name at the release's default) and no manifest of this
// repository decides its module kind, and H-1's isolation of a consumer
// program holds: a known type error, a known definition location, and a
// known hover text must all be detected, so section 4's consumer
// assertions cannot pass vacuously — among the type
// errors one located in a declaration module the consumer imports, outside
// the consumer file (`companion-error.d.ts`, in a product companion's
// shape), which only a clean verdict covering the whole program reports and
// a driver skipping declaration files (`skipLibCheck`) would pass, its clean
// twin passing that verdict. Each configuration's module settings are
// detected in effect through hand-written modules the other configuration
// accepts: under the ES-module configuration, TypeScript's rejection of an
// export assignment (TS1203), of an import assignment (TS1202), of a type
// re-exported through `export { … } from` without a `type` modifier
// (TS1205), and of a type imported without one (TS1484); under the CommonJS
// configuration, its rejection of a top-level `await` (TS1378) — so a driver
// serving one configuration's settings for the other's fails here before
// any product exists; and the two configurations themselves are pinned to
// H-2's options exactly. A driver blind to a diagnostic kind passes
// conformer and violator alike wherever no violator targets that kind, so
// each kind's detection is checked directly (S-4): beside the argument-type
// error (TS2345), the two collision kinds T6.5-9's compile-clean
// observation turns on when a product-chosen import identifier collides
// with a binding the receiving file already holds — an import binding
// conflicting with a module-scope local declaration (TS2440: the file's own
// `const`, `function`, or `class`) and an import binding duplicated by
// another import binding (TS2300: a non-spec import the file already
// carries) — neither of which any certification fixture targets
// (CERTIFICATIONS.md, Exclusions: "Section 4 consumer-side and type-level
// tests"). Alongside the S-4 probes, the driver's remaining surfaces are
// pinned the same way: assertions made under each configuration in turn,
// every diagnosis naming its configuration; the type-error assertion's
// exactness (every diagnostic at an expected position, each position
// diagnosed); compiled consumers' CommonJS output written outside the
// workspace and run there under plain Node with no runtime dependency
// resolvable (SPEC.md 13.1; IMPLEMENTATION.md), the compiler's output alone
// and never the ES-module configuration's; an import nothing makes
// resolvable is a diagnosed compile error (the red path for section 4 tests
// against the stub product, H-8); marker addressing and project loading
// fail loudly rather than vacuously green; H-1's isolation of a consumer
// program — nothing installed in its project root or above it or its
// runtime output, nothing in Node.js's global module folders under a run's
// environment, and each run under a fresh, empty `HOME` with no `NODE_PATH`
// — is verified before TypeScript or Node.js reads it, an unmet isolation a
// staging error, never a verdict; and a project is loaded under one of
// H-2's two configurations exactly, with no compiler option of its own, any
// other load a harness misuse — so no other configuration is reachable. The
// skeleton reader T1.1-2 compares two generated modules through
// (`moduleSkeleton`, `skeletonChains`, `diffModuleSkeletons`) is pinned, in
// each configuration, against a hand-written module in the generated
// arrangement: its exact member tree, the compare's blindness to
// declaration names and its topmost differences, and its loud failures.

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
// The harness's own pinned TypeScript, as the tooling driver uses it.
import ts from "typescript-5.9.3";
import { describe, expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import { verifyStagingIsolation } from "../helpers/staging-isolation.js";
import {
  assertTypeChecksClean,
  assertTypeErrorsAt,
  COMMONJS_CONFIGURATION,
  configurationLabel,
  CONSUMER_CONFIGURATIONS,
  ConsumerProject,
  diffModuleSkeletons,
  ES_MODULE_CONFIGURATION,
  forEachConfiguration,
  forEachConsumerProject,
  skeletonChains,
  withCompiledConsumer,
} from "../helpers/tooling.js";
import type {
  ConsumerConfiguration,
  ConsumerProjectOptions,
} from "../helpers/tooling.js";
import { TestWorkspace } from "../helpers/workspace.js";
import type { WorkspaceDecl } from "../helpers/workspace.js";

const fixtureRoot = path.resolve(
  fileURLToPath(new URL("../fixtures/s4-tooling", import.meta.url)),
);

async function makeWorkspace(decl?: WorkspaceDecl): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create(decl);
  onTestFinished(() => workspace.dispose());
  return workspace;
}

/**
 * The S-4 fixture project, copied byte for byte into a fresh workspace under
 * the OS temporary directory, where it is compiled as a consumer workspace
 * is (module header): no `package.json` or `node_modules` above it.
 */
async function stageFixtureProject(): Promise<TestWorkspace> {
  const files: Record<string, Uint8Array> = {};
  for (const name of await fsp.readdir(fixtureRoot)) {
    files[name] = await fsp.readFile(path.join(fixtureRoot, name));
  }
  return await makeWorkspace({ files });
}

/** A loader of the staged fixture project's programs under `configuration`. */
async function fixtureProjects(
  configuration: ConsumerConfiguration,
): Promise<(rootFiles: readonly string[]) => Promise<ConsumerProject>> {
  const workspace = await stageFixtureProject();
  return async (rootFiles) =>
    await ConsumerProject.load({
      rootDir: workspace.root,
      rootFiles,
      configuration,
    });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A diagnosis naming `configuration` (TEST-SPEC H-2). */
function namingRegExp(configuration: ConsumerConfiguration): RegExp {
  return new RegExp(escapeRegExp(`under ${configurationLabel(configuration)}`));
}

/** Whether `inner` lies strictly inside `outer` (both absolute). */
function liesInside(inner: string, outer: string): boolean {
  const rel = path.relative(outer, inner);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * The five module-settings detection modules (S-4): each rejected by one
 * configuration's checker — `rejectedBy` — and accepted by the other's,
 * every one well-formed to the parser. Positions are pinned against
 * hand-counted ground truth in the frozen fixture files.
 */
interface DetectionModule {
  readonly file: string;
  /** The module form, for titles and diagnoses. */
  readonly form: string;
  readonly rejectedBy: ConsumerConfiguration;
  readonly code: number;
  readonly messageIncludes: readonly string[];
  /** The marker locating the diagnostic's start. */
  readonly marker: string;
  readonly charOffset?: number;
  /** The diagnostic's span length and its start's line and column. */
  readonly length: number;
  readonly line: number;
  readonly column: number;
}

const DETECTION_MODULES: readonly DetectionModule[] = [
  {
    file: "export-assignment.ts",
    form: "an export assignment (`export =`)",
    rejectedBy: ES_MODULE_CONFIGURATION,
    code: 1203,
    messageIncludes: [
      "Export assignment cannot be used when targeting ECMAScript modules",
    ],
    marker: "export = greetingCount;",
    length: "export = greetingCount;".length,
    line: 14,
    column: 1,
  },
  {
    file: "import-assignment.ts",
    form: "an import assignment (`import … = require(…)`)",
    rejectedBy: ES_MODULE_CONFIGURATION,
    code: 1202,
    messageIncludes: [
      "Import assignment cannot be used when targeting ECMAScript modules",
    ],
    marker: 'import greeting = require("./greeting.js");',
    length: 'import greeting = require("./greeting.js");'.length,
    line: 12,
    column: 1,
  },
  {
    file: "type-reexport.ts",
    form: "a type re-exported through `export { … } from` without a `type` modifier",
    rejectedBy: ES_MODULE_CONFIGURATION,
    code: 1205,
    messageIncludes: [
      "Re-exporting a type when",
      "requires using 'export type'",
    ],
    marker: "export { GreetingParts }",
    charOffset: "export { ".length,
    length: "GreetingParts".length,
    line: 14,
    column: 10,
  },
  {
    file: "type-import.ts",
    form: "a type imported without a `type` modifier",
    rejectedBy: ES_MODULE_CONFIGURATION,
    code: 1484,
    messageIncludes: [
      "'GreetingParts' is a type and must be imported using a type-only import",
    ],
    marker: "import { GreetingParts }",
    charOffset: "import { ".length,
    length: "GreetingParts".length,
    line: 14,
    column: 10,
  },
  {
    file: "top-level-await.ts",
    form: "a top-level `await`",
    rejectedBy: COMMONJS_CONFIGURATION,
    code: 1378,
    messageIncludes: ["Top-level 'await' expressions are only allowed"],
    marker: "await Promise",
    length: "await".length,
    line: 13,
    column: 30,
  },
];

for (const configuration of CONSUMER_CONFIGURATIONS) {
  describe(`under ${configurationLabel(configuration)}`, () => {
    test("S-4: detects the known type error at its exact location", async () => {
      const load = await fixtureProjects(configuration);
      const project = await load(["greeting.ts", "main.ts", "type-error.ts"]);
      const marker = project.locate("type-error.ts", "12345");
      const [diagnostic] = assertTypeErrorsAt(project, [
        { at: marker, code: 2345, messageIncludes: ["number", "string"] },
      ]);
      // The error spans exactly the offending argument, and the location math
      // is pinned against hand-counted ground truth in the frozen fixture file.
      expect(diagnostic!.start).toEqual(marker);
      expect(diagnostic!.length).toBe("12345".length);
      expect(marker.file).toBe("type-error.ts");
      expect(marker.line).toBe(8);
      expect(marker.column).toBe(36);
      // And it is the only diagnostic: detection is specific, not "everything
      // fails".
      expect(project.diagnostics()).toHaveLength(1);
      // The clean verdict diagnoses the state, naming the configuration.
      expect(() => assertTypeChecksClean(project)).toThrowError(
        HarnessAssertionError,
      );
      expect(() => assertTypeChecksClean(project)).toThrowError(
        namingRegExp(configuration),
      );
      expect(() => assertTypeChecksClean(project)).toThrowError(/TS2345/);
    });

    test("S-4: detects a known type error inside a declaration module the consumer imports, outside the consumer file, its clean twin passing — the clean verdict covers the whole program (H-2)", async () => {
      const load = await fixtureProjects(configuration);
      const project = await load(["uses-companion-error.ts"]);
      const marker = project.locate("companion-error.d.ts", "Label<42>", {
        charOffset: "Label<".length,
      });
      const [diagnostic] = assertTypeErrorsAt(project, [
        { at: marker, code: 2344, messageIncludes: ["number", "string"] },
      ]);
      // The error lies in the imported declaration module, at the offending
      // type argument — pinned against hand-counted ground truth.
      expect(diagnostic!.file).toBe("companion-error.d.ts");
      expect(diagnostic!.start).toEqual(marker);
      expect(diagnostic!.length).toBe("42".length);
      expect(marker.line).toBe(24);
      expect(marker.column).toBe(36);
      // The consumer file itself carries none: only a verdict covering the
      // whole program sees the error.
      expect(project.diagnostics()).toHaveLength(1);
      expect(
        project
          .diagnostics()
          .filter((entry) => entry.file === "uses-companion-error.ts"),
      ).toEqual([]);
      expect(() => assertTypeChecksClean(project)).toThrowError(
        HarnessAssertionError,
      );
      expect(() => assertTypeChecksClean(project)).toThrowError(
        /TS2344 \[error\] companion-error\.d\.ts:24:36/,
      );
      // A type-error assertion at the consumer's own reference fails: the
      // program's diagnostic lies elsewhere, and nothing diagnoses the
      // reference.
      const reference = project.locate(
        "uses-companion-error.ts",
        "companionGreeting.text",
      );
      expect(() =>
        assertTypeErrorsAt(project, [{ at: reference }]),
      ).toThrowError(
        /Undiagnosed:[\s\S]*Diagnostics elsewhere:\n {2}TS2344 \[error\] companion-error\.d\.ts:24:36/,
      );
      // The clean twin, importing companion.d.ts, passes the whole-program
      // verdict.
      const twin = await load(["uses-companion.ts"]);
      assertTypeChecksClean(twin, "S-4 clean companion twin");
      expect(twin.diagnostics()).toEqual([]);
    });

    test("S-4: detects an import binding conflicting with a module-scope local declaration (TS2440, the kind T6.5-9 turns on)", async () => {
      // T6.5-9's compile-clean observation rides the clean verdict over a
      // consumer whose receiving file pre-empts the product-chosen import
      // identifier with its own `const` — a collision TypeScript reports as
      // TS2440 on the import binding. No certification fixture targets the
      // kind, so its detection is pinned here directly (S-4), on a fixture
      // file whose only defect is that collision.
      const load = await fixtureProjects(configuration);
      const project = await load(["greeting.ts", "import-conflict.ts"]);
      const marker = project.locate("import-conflict.ts", "import { greet }", {
        charOffset: "import { ".length,
      });
      const [diagnostic] = assertTypeErrorsAt(project, [
        {
          at: marker,
          code: 2440,
          messageIncludes: [
            "Import declaration conflicts with local declaration",
            "greet",
          ],
        },
      ]);
      // The error spans exactly the import clause's binding identifier, and
      // the location math is pinned against hand-counted ground truth in the
      // frozen fixture file.
      expect(diagnostic!.start).toEqual(marker);
      expect(diagnostic!.length).toBe("greet".length);
      expect(marker.file).toBe("import-conflict.ts");
      expect(marker.line).toBe(10);
      expect(marker.column).toBe(10);
      // Detection is specific: the import binding is the only diagnostic —
      // the local declaration it collides with (and the use) carry none.
      expect(project.diagnostics()).toHaveLength(1);
      const local = project.locate("import-conflict.ts", "const greet", {
        charOffset: "const ".length,
      });
      expect(() =>
        assertTypeErrorsAt(project, [{ at: local, code: 2440 }]),
      ).toThrowError(HarnessAssertionError);
      // The clean verdict T6.5-9 rides diagnoses the state instead of passing.
      expect(() => assertTypeChecksClean(project)).toThrowError(
        HarnessAssertionError,
      );
      expect(() => assertTypeChecksClean(project)).toThrowError(/TS2440/);
    });

    test("S-4: detects an import binding duplicated by another import binding (TS2300, the other collision kind T6.5-9 turns on)", async () => {
      // T6.5-9's pre-empted set also holds a non-spec import binding: a
      // product-chosen import identifier equal to one the receiving file
      // already imports is a collision TypeScript reports as TS2300 on both
      // import bindings. No certification fixture targets the kind, so its
      // detection is pinned here directly (S-4), on a fixture file whose only
      // defect is that duplication. Fixture self-check first: both imported
      // modules are valid on their own, so every diagnostic below is the
      // duplication's.
      const load = await fixtureProjects(configuration);
      assertTypeChecksClean(
        await load(["greeting.ts", "other-greeting.ts"]),
        "s4-tooling duplicate-import premise",
      );
      const project = await load([
        "greeting.ts",
        "other-greeting.ts",
        "import-duplicate.ts",
      ]);
      // The marker occurs once per import declaration, so each binding is
      // addressed by occurrence index; the offset lands on the identifier.
      const bindings = [0, 1].map((index) =>
        project.locate("import-duplicate.ts", "import { greet }", {
          index,
          charOffset: "import { ".length,
        }),
      );
      const diagnostics = assertTypeErrorsAt(
        project,
        bindings.map((at) => ({
          at,
          code: 2300,
          messageIncludes: ["Duplicate identifier", "greet"],
        })),
      );
      // Each error spans exactly its import clause's binding identifier, and
      // the location math is pinned against hand-counted ground truth in the
      // frozen fixture file.
      [9, 10].forEach((line, index) => {
        expect(diagnostics[index]!.start).toEqual(bindings[index]);
        expect(diagnostics[index]!.length).toBe("greet".length);
        expect(bindings[index]!.file).toBe("import-duplicate.ts");
        expect(bindings[index]!.line).toBe(line);
        expect(bindings[index]!.column).toBe(10);
      });
      // Detection is specific: the two import bindings are the only
      // diagnostics — the use carries none.
      expect(project.diagnostics()).toHaveLength(2);
      const use = project.locate("import-duplicate.ts", 'greet("world")');
      expect(() =>
        assertTypeErrorsAt(project, [{ at: use, code: 2300 }]),
      ).toThrowError(HarnessAssertionError);
      // The type-error assertion is exact: expecting one binding alone fails,
      // the other's diagnostic lying elsewhere.
      expect(() =>
        assertTypeErrorsAt(project, [{ at: bindings[0]!, code: 2300 }]),
      ).toThrowError(
        /Diagnostics elsewhere:\n {2}TS2300 \[error\] import-duplicate\.ts:10:10/,
      );
      // The clean verdict T6.5-9 rides diagnoses the state instead of passing.
      expect(() => assertTypeChecksClean(project)).toThrowError(
        HarnessAssertionError,
      );
      expect(() => assertTypeChecksClean(project)).toThrowError(/TS2300/);
    });

    test("S-4 control: the fixture's clean files type-check clean, the whole program carrying no diagnostic", async () => {
      const load = await fixtureProjects(configuration);
      for (const rootFiles of [
        ["greeting.ts", "main.ts"],
        ["greeting.ts", "other-greeting.ts"],
        ["greeting-parts.ts"],
      ]) {
        const project = await load(rootFiles);
        assertTypeChecksClean(project, "s4-tooling clean subset");
        expect(project.diagnostics()).toEqual([]);
      }
    });

    for (const module of DETECTION_MODULES) {
      const rejected = module.rejectedBy === configuration;
      test(
        `S-4: ${rejected ? "rejects" : "accepts"} ${module.form} ` +
          `(${module.file}${rejected ? `, TS${String(module.code)}` : ""}) — ` +
          `the ${module.rejectedBy.name}'s module settings detected in effect`,
        async () => {
          const load = await fixtureProjects(configuration);
          const project = await load([module.file]);
          if (!rejected) {
            assertTypeChecksClean(
              project,
              `S-4 ${module.file}, which only the ${module.rejectedBy.name} rejects`,
            );
            expect(project.diagnostics()).toEqual([]);
            return;
          }
          const marker = project.locate(module.file, module.marker, {
            charOffset: module.charOffset ?? 0,
          });
          const [diagnostic] = assertTypeErrorsAt(project, [
            {
              at: marker,
              code: module.code,
              messageIncludes: module.messageIncludes,
            },
          ]);
          // The rejection is the module form's alone, at its exact position —
          // pinned against hand-counted ground truth in the frozen fixture.
          expect(diagnostic!.start).toEqual(marker);
          expect(diagnostic!.length).toBe(module.length);
          expect(marker.line).toBe(module.line);
          expect(marker.column).toBe(module.column);
          expect(project.diagnostics()).toHaveLength(1);
        },
      );
    }

    test("S-4: resolves the known definition location for the imported reference", async () => {
      const load = await fixtureProjects(configuration);
      const project = await load(["greeting.ts", "main.ts"]);
      const reference = project.locate("main.ts", 'greet("world")');
      const declaration = project.locate("greeting.ts", "function greet(", {
        charOffset: "function ".length,
      });
      const definitions = project.definitionsAt(reference);
      expect(definitions).toHaveLength(1);
      const definition = definitions[0]!;
      expect(definition.file).toBe("greeting.ts");
      expect(definition.start).toEqual(declaration);
      expect(definition.length).toBe("greet".length);
      expect(definition.name).toBe("greet");
      expect(definition.kind).toBe("function");
    });

    test("S-4: reports the known hover text (signature and documentation)", async () => {
      const load = await fixtureProjects(configuration);
      const project = await load(["greeting.ts", "main.ts"]);
      const reference = project.locate("main.ts", 'greet("world")');
      const hover = project.hoverAt(reference);
      expect(hover).toBeDefined();
      expect(hover!.display).toContain("greet(name: string): string");
      expect(hover!.documentation).toBe(
        "Builds the standard greeting for a name.",
      );
      // The hovered span is the referenced identifier itself.
      expect(hover!.start.offset).toBe(reference.offset);
      expect(hover!.length).toBe("greet".length);
    });

    test("hover and definitions at an inert position report nothing (tests then fail diagnosed, not crash)", async () => {
      const load = await fixtureProjects(configuration);
      const project = await load(["greeting.ts", "main.ts"]);
      // The blank between `import` and its clause carries no symbol.
      const blank = project.locate("main.ts", "import { greet }", {
        charOffset: "import".length,
      });
      expect(project.hoverAt(blank)).toBeUndefined();
      expect(project.definitionsAt(blank)).toEqual([]);
    });

    test("an unresolvable import is a diagnosed compile error at the specifier (H-8 red path)", async () => {
      const workspace = await makeWorkspace({
        files: {
          "main.ts":
            'import { nope } from "./nope.js";\n\nexport const value = nope;\n',
        },
      });
      const project = await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: ["main.ts"],
        configuration,
      });
      const specifier = project.locate("main.ts", '"./nope.js"');
      const [diagnostic] = assertTypeErrorsAt(project, [
        { at: specifier, code: 2307 },
      ]);
      expect(diagnostic!.file).toBe("main.ts");
      // The clean verdict diagnoses the same state instead of passing.
      expect(() => assertTypeChecksClean(project)).toThrowError(
        HarnessAssertionError,
      );
      expect(() => assertTypeChecksClean(project)).toThrowError(/TS2307/);
      // And a location/code that does not match is a diagnosed failure, not a
      // silent pass, naming the configuration.
      expect(() =>
        assertTypeErrorsAt(project, [{ at: specifier, code: 9999 }]),
      ).toThrowError(HarnessAssertionError);
      expect(() =>
        assertTypeErrorsAt(project, [{ at: specifier, code: 9999 }]),
      ).toThrowError(namingRegExp(configuration));
    });

    test("marker addressing is loud: unknown and ambiguous markers fail, indexing disambiguates", async () => {
      const load = await fixtureProjects(configuration);
      const project = await load(["greeting.ts", "main.ts"]);
      expect(() => project.locate("main.ts", "no-such-marker")).toThrowError(
        /no-such-marker/,
      );
      expect(() => project.locate("main.ts", "greet")).toThrowError(
        /ambiguous/,
      );
      const first = project.locate("main.ts", "greet", { index: 0 });
      const second = project.locate("main.ts", "greet", { index: 1 });
      expect(second.offset).toBeGreaterThan(first.offset);
    });

    test("loading a project with a missing root file fails diagnosed", async () => {
      const workspace = await stageFixtureProject();
      await expect(
        ConsumerProject.load({
          rootDir: workspace.root,
          rootFiles: ["absent.ts"],
          configuration,
        }),
      ).rejects.toThrowError(/absent\.ts/);
    });

    // This test builds two TypeScript programs (the declaration-map emit and
    // the consumer project), under no framework timeout of its own (TEST-SPEC
    // S-3, helpers/hang-guards.ts; the self project's `testTimeout` is 0).
    test("S-4: source definitions map through a declaration map into a non-TypeScript original (SPEC.md 4.2, 13.1)", async () => {
      // SPEC.md 13.1 lets a product ship companion files so editor
      // go-to-definition resolves into the source `.mdx`; the standard-tooling
      // mechanism is a `.d.ts` with a declaration map whose `sources` names
      // the original. Raw `getDefinitionAtPosition` never applies that mapping
      // (it can only land in program files) — tsserver does, via the language
      // service's internal source mapper — so `sourceDefinitionsAt` must (a)
      // reach the internal mapper at runtime and (b) map a declaration-mapped
      // target into the named original, or section 4.2's navigation
      // assertions could never be satisfied by any product. This pins both,
      // against a declaration map generated by the pinned TypeScript itself.
      const original = [
        "/** Root docs. */",
        "declare const root: {",
        "  /** Alpha docs. */",
        "  readonly alpha: object;",
        "};",
        "export default root;",
        "",
      ].join("\n");
      const workspace = await makeWorkspace({
        // S-9: doc.mdx is a source-map decoy holding TypeScript, not an MDX
        // fixture — no discovery reaches it.
        mdx: { unchecked: ["doc.mdx"] },
        files: {
          "gen/orig.ts": original,
          // The pseudo-original the map will point at: same shape (line/column
          // layout) as the compiled source, under a non-TypeScript name.
          "doc.mdx": original,
          "main.ts": [
            'import ROOT from "./out/orig";',
            "",
            "ROOT.alpha;",
            "",
          ].join("\n"),
          "helper.ts": "export function helper(): number {\n  return 1;\n}\n",
          "uses-helper.ts": [
            'import { helper } from "./helper";',
            "",
            "helper();",
            "",
          ].join("\n"),
        },
      });
      // Emit out/orig.d.ts + out/orig.d.ts.map from gen/orig.ts, then point
      // the map's `sources` at doc.mdx — exactly the companion-file
      // arrangement a product would generate.
      const emitProgram = ts.createProgram(
        [path.join(workspace.root, "gen/orig.ts")],
        {
          declaration: true,
          declarationMap: true,
          emitDeclarationOnly: true,
          outDir: path.join(workspace.root, "out"),
        },
      );
      const emitResult = emitProgram.emit();
      expect(emitResult.emitSkipped).toBe(false);
      const mapPath = path.join(workspace.root, "out/orig.d.ts.map");
      const map = JSON.parse(await fsp.readFile(mapPath, "utf8")) as {
        sources: string[];
      };
      map.sources = ["../doc.mdx"];
      await fsp.writeFile(mapPath, JSON.stringify(map));

      const project = await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: ["main.ts", "uses-helper.ts"],
        configuration,
      });
      assertTypeChecksClean(project, "declaration-map fixture consumer");
      const reference = project.locate("main.ts", "ROOT.alpha;", {
        charOffset: "ROOT.".length,
      });

      // Raw targets stay in the declaring .d.ts: the mapping is a distinct step.
      const raw = project.definitionsAt(reference);
      expect(raw).toHaveLength(1);
      expect(raw[0]!.file).toBe("out/orig.d.ts");

      // Mapped targets land in the named original, at the exact mapped
      // position (the property name in doc.mdx — same layout as the compiled
      // source).
      const mapped = project.sourceDefinitionsAt(reference);
      expect(mapped).toHaveLength(1);
      const target = mapped[0]!;
      expect(target.mapped).toBe(true);
      expect(target.file).toBe("doc.mdx");
      expect(target.start.offset).toBe(original.indexOf("alpha: object"));
      expect(target.raw.file).toBe("out/orig.d.ts");
      expect(target.raw.name).toBe("alpha");

      // A target whose declaring file carries no declaration map is returned
      // unmapped — same file and span as the raw query, flagged mapped: false.
      const helperReference = project.locate("uses-helper.ts", "helper();", {});
      const unmapped = project.sourceDefinitionsAt(helperReference);
      expect(unmapped).toHaveLength(1);
      expect(unmapped[0]!.mapped).toBe(false);
      expect(unmapped[0]!.file).toBe("helper.ts");
      expect(unmapped[0]!.start).toEqual(unmapped[0]!.raw.start);
    });

    // `moduleSkeleton` (T1.1-2: two generated modules expose the same
    // skeleton, SPEC 1.1, 4.1), under each configuration. Each vector below
    // compiles one to three projects, under no framework timeout of its own
    // (TEST-SPEC S-3, helpers/hang-guards.ts).

    test("S-4: moduleSkeleton reads a module's export names and its default export's member tree (T1.1-2; SPEC 4.1)", async () => {
      const project = await loadSkeletonProject(
        configuration,
        skeletonCompanion(),
      );
      const skeleton = project.moduleSkeleton("gen/m.xspec.ts", {
        isOwnFile: isSkeletonOwnFile,
        maxDepth: 4,
      });
      expect(skeleton.module).toBe("gen/m.xspec.ts");
      expect(skeleton.exports).toEqual(["Shared", "default", "text"]);
      const chains = skeletonChains(skeleton, "ROOT");
      // `label: string` is an own member, so it is expanded — into the string
      // type's members, every one declared in TypeScript's lib: leaves
      // recorded by name, nothing below them.
      const label = skeleton.defaultExport?.find(
        (member) => member.segment === ".label",
      );
      expect(label?.members?.map((member) => member.segment)).toEqual(
        expect.arrayContaining([".charAt", ".length", "[<number>]"]),
      );
      expect(
        label?.members?.some((member) => member.segment.startsWith("[Symbol.")),
      ).toBe(true);
      for (const member of label?.members ?? []) {
        expect(member.members, `lib member ${member.segment}`).toBeUndefined();
        expect(member.stopped, `lib member ${member.segment}`).toBeUndefined();
      }
      expect(
        chains.filter(
          (chain) =>
            !chain.startsWith("ROOT.label.") &&
            !chain.startsWith("ROOT.label["),
        ),
      ).toEqual([
        "ROOT.alpha",
        "ROOT.alpha(new)",
        "ROOT.alpha.beta",
        "ROOT.alpha.beta()",
        "ROOT.alpha.beta[<string>]",
        "ROOT.alpha.beta[<string>][BRAND]",
        "ROOT.alpha.beta[BRAND]",
        "ROOT.alpha[BRAND]",
        "ROOT.deep",
        "ROOT.deep.next",
        "ROOT.deep.next.next",
        "ROOT.deep.next.next.next (expansion stopped: depth bound)",
        "ROOT.label",
        "ROOT.loop (expansion stopped: cycle)",
        "ROOT.maybe",
        "ROOT.maybe(new)",
        "ROOT.maybe.beta",
        "ROOT.maybe.beta()",
        "ROOT.maybe.beta[<string>]",
        "ROOT.maybe.beta[<string>][BRAND]",
        "ROOT.maybe.beta[BRAND]",
        "ROOT.maybe[BRAND]",
        // Declared in another project file: a leaf, `deeper` unread.
        "ROOT.shared",
        "ROOT.shared.inner",
        'ROOT["kebab-case"]',
        'ROOT["kebab-case"]()',
        'ROOT["kebab-case"][<string>]',
        'ROOT["kebab-case"][<string>][BRAND]',
        'ROOT["kebab-case"][BRAND]',
        "ROOT[BRAND]",
      ]);
      // The default bound (16) reaches further down the generic chain.
      const deeper = skeletonChains(
        project.moduleSkeleton("gen/m.xspec.ts", {
          isOwnFile: isSkeletonOwnFile,
        }),
        "ROOT",
      );
      expect(
        deeper.filter((chain) => chain.startsWith("ROOT.deep")),
      ).toHaveLength(16);
      expect(deeper).toContain(
        `ROOT.deep${".next".repeat(15)} (expansion stopped: depth bound)`,
      );
      // A module without a default export exposes export names alone.
      const shared = project.moduleSkeleton("shared.ts", {
        isOwnFile: (file) => file === "shared.ts",
      });
      expect(shared.exports).toEqual(["Shared"]);
      expect(shared.defaultExport).toBeUndefined();
      expect(skeletonChains(shared, "ROOT")).toEqual([]);
    });

    test("S-4: diffModuleSkeletons compares names and nesting only, naming each topmost difference (T1.1-2)", async () => {
      const options = { isOwnFile: isSkeletonOwnFile, maxDepth: 4 };
      const base = (
        await loadSkeletonProject(configuration, skeletonCompanion())
      ).moduleSkeleton("gen/m.xspec.ts", options);
      expect(diffModuleSkeletons(base, base, "ROOT")).toEqual({
        onlyInA: [],
        onlyInB: [],
      });
      // Every declaration renamed: the same skeleton (H-4: declaration names
      // are the product's own).
      const renamed = (
        await loadSkeletonProject(
          configuration,
          skeletonCompanion({
            names: { Base: "Q", N0: "Q0", N1: "Q1", N2: "Q2", Deep: "QD" },
          }),
        )
      ).moduleSkeleton("gen/m.xspec.ts", options);
      expect(diffModuleSkeletons(base, renamed, "ROOT")).toEqual({
        onlyInA: [],
        onlyInB: [],
      });
      // An added member, a dropped export, and a cycle turned into an
      // expansion.
      const changed = (
        await loadSkeletonProject(
          configuration,
          skeletonCompanion({ extraOnN1: true, loopTo: "N1" }),
          'export { default, text } from "./m.xspec.impl.js";\n',
        )
      ).moduleSkeleton("gen/m.xspec.ts", options);
      const difference = diffModuleSkeletons(base, changed, "ROOT");
      expect([...difference.onlyInA].sort()).toEqual([
        "ROOT.loop (expansion stopped: cycle)",
        "export Shared",
      ]);
      // Topmost only: nothing below `extra` or the expanded `loop` is listed.
      expect([...difference.onlyInB].sort()).toEqual([
        "ROOT.alpha.extra",
        "ROOT.loop",
        "ROOT.maybe.extra",
      ]);
      const reversed = diffModuleSkeletons(changed, base, "ROOT");
      expect([...reversed.onlyInA].sort()).toEqual(
        [...difference.onlyInB].sort(),
      );
      expect([...reversed.onlyInB].sort()).toEqual(
        [...difference.onlyInA].sort(),
      );
    });

    test("S-4: moduleSkeleton fails diagnosed on a module outside the program or a file that is no module", async () => {
      const project = await loadSkeletonProject(
        configuration,
        skeletonCompanion(),
      );
      const options = { isOwnFile: isSkeletonOwnFile, context: "S-4 probe" };
      expect(() =>
        project.moduleSkeleton("gen/absent.xspec.ts", options),
      ).toThrowError(HarnessAssertionError);
      expect(() =>
        project.moduleSkeleton("gen/absent.xspec.ts", options),
      ).toThrowError(
        /S-4 probe: gen\/absent\.xspec\.ts is not part of the consumer program/,
      );
      expect(() =>
        project.moduleSkeleton("globals.d.ts", options),
      ).toThrowError(HarnessAssertionError);
      expect(() =>
        project.moduleSkeleton("globals.d.ts", options),
      ).toThrowError(/globals\.d\.ts is no module/);
      // A depth bound below 1 is a harness misuse, refused outright.
      expect(() =>
        project.moduleSkeleton("gen/m.xspec.ts", { ...options, maxDepth: 0 }),
      ).toThrowError(/maxDepth must be a positive integer/);
    });
  });
}

test("H-2's two configurations are its options exactly — nothing else set — and a project serves them so", async () => {
  expect(CONSUMER_CONFIGURATIONS).toHaveLength(2);
  expect(CONSUMER_CONFIGURATIONS[0]).toBe(COMMONJS_CONFIGURATION);
  expect(CONSUMER_CONFIGURATIONS[1]).toBe(ES_MODULE_CONFIGURATION);
  expect(COMMONJS_CONFIGURATION.name).toBe("CommonJS configuration");
  expect(ES_MODULE_CONFIGURATION.name).toBe("ES-module configuration");
  // CommonJS under its default (node10) resolution: `moduleResolution` unset.
  expect(COMMONJS_CONFIGURATION.compilerOptions).toStrictEqual({
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
  });
  expect(ES_MODULE_CONFIGURATION.compilerOptions).toStrictEqual({
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    isolatedModules: true,
    verbatimModuleSyntax: true,
  });
  // Runtime under the CommonJS configuration alone.
  expect(COMMONJS_CONFIGURATION.executed).toBe(true);
  expect(ES_MODULE_CONFIGURATION.executed).toBe(false);
  const workspace = await stageFixtureProject();
  for (const configuration of CONSUMER_CONFIGURATIONS) {
    expect(Object.isFrozen(configuration)).toBe(true);
    expect(Object.isFrozen(configuration.compilerOptions)).toBe(true);
    // ESNext's default library.
    expect(ts.getDefaultLibFileName({ ...configuration.compilerOptions })).toBe(
      "lib.esnext.full.d.ts",
    );
    // A project's language service serves the configuration's options
    // exactly, under its name.
    const project = await ConsumerProject.load({
      rootDir: workspace.root,
      rootFiles: ["greeting.ts", "main.ts"],
      configuration,
    });
    expect(project.configuration).toBe(configuration);
    expect(project.compilerOptions).toStrictEqual({
      ...configuration.compilerOptions,
    });
  }
  // Any other configuration object — a copy of one included — no
  // configuration, and an option of the project's own beside one are
  // refused, as harness misuse: no other configuration is reachable.
  await expect(
    ConsumerProject.load({
      rootDir: workspace.root,
      rootFiles: ["greeting.ts", "main.ts"],
      configuration: { ...COMMONJS_CONFIGURATION },
    }),
  ).rejects.toThrowError(/one of H-2's two fixed configurations exactly/);
  const unconfigured: unknown = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles: ["greeting.ts", "main.ts"],
  } as unknown as ConsumerProjectOptions).catch((error: unknown) => error);
  expect(unconfigured).toBeInstanceOf(Error);
  expect(unconfigured).not.toBeInstanceOf(HarnessAssertionError);
  expect((unconfigured as Error).message).toMatch(
    /one of H-2's two fixed configurations exactly .* got none/,
  );
  for (const configuration of CONSUMER_CONFIGURATIONS) {
    const ownOption: unknown = await ConsumerProject.load({
      rootDir: workspace.root,
      rootFiles: ["greeting.ts", "main.ts"],
      configuration,
      compilerOptions: { strict: false },
    } as unknown as ConsumerProjectOptions).catch((error: unknown) => error);
    expect(ownOption).toBeInstanceOf(Error);
    expect(ownOption).not.toBeInstanceOf(HarnessAssertionError);
    expect((ownOption as Error).message).toContain(
      `a consumer project takes no option of its own — ` +
        `${configurationLabel(configuration)} fixes every option — got ` +
        `"compilerOptions"`,
    );
  }
});

test("forEachConfiguration runs the CommonJS, then the ES-module configuration, naming the configuration in every diagnosis (H-2)", async () => {
  const seen: string[] = [];
  const results = await forEachConfiguration((configuration) => {
    seen.push(configuration.name);
    return configuration.executed;
  });
  expect(seen).toEqual(["CommonJS configuration", "ES-module configuration"]);
  expect(results).toEqual([true, false]);
  // A diagnosed failure under a configuration is rethrown naming it, its
  // shrinkability kept and the original its cause; the walk stops there.
  const original = new HarnessAssertionError("probe failure", {
    shrinkable: false,
  });
  const reached: string[] = [];
  const named: unknown = await forEachConfiguration((configuration) => {
    reached.push(configuration.name);
    if (configuration === COMMONJS_CONFIGURATION) throw original;
  }).catch((error: unknown) => error);
  expect(reached).toEqual(["CommonJS configuration"]);
  expect(named).toBeInstanceOf(HarnessAssertionError);
  expect((named as HarnessAssertionError).message).toBe(
    "under H-2's CommonJS configuration: probe failure",
  );
  expect((named as HarnessAssertionError).shrinkable).toBe(false);
  expect((named as Error).cause).toBe(original);
  // A failure already naming its configuration — the driver's own
  // assertions' — is rethrown as is.
  const already = new HarnessAssertionError(
    "probe (under H-2's ES-module configuration): failure",
  );
  await expect(
    forEachConfiguration((configuration) => {
      if (configuration === ES_MODULE_CONFIGURATION) throw already;
    }),
  ).rejects.toBe(already);
  // A harness error passes through unchanged.
  const harnessError = new Error("a harness defect");
  await expect(
    forEachConfiguration(() => {
      throw harnessError;
    }),
  ).rejects.toBe(harnessError);
  // forEachConsumerProject loads the program under each configuration in
  // turn; a verdict failing under one names it.
  const workspace = await stageFixtureProject();
  const served = await forEachConsumerProject(
    { rootDir: workspace.root, rootFiles: ["greeting.ts", "main.ts"] },
    (project) => {
      assertTypeChecksClean(project, "forEachConsumerProject probe");
      return project.configuration;
    },
  );
  expect(served).toEqual([COMMONJS_CONFIGURATION, ES_MODULE_CONFIGURATION]);
  const failing: unknown = await forEachConsumerProject(
    { rootDir: workspace.root, rootFiles: ["top-level-await.ts"] },
    (project) => assertTypeChecksClean(project, "forEachConsumerProject probe"),
  ).catch((error: unknown) => error);
  expect(failing).toBeInstanceOf(HarnessAssertionError);
  expect((failing as Error).message).toMatch(
    namingRegExp(COMMONJS_CONFIGURATION),
  );
  expect((failing as Error).message).toMatch(/TS1378/);
});

test("compiles a consumer to CommonJS JavaScript in a fresh directory outside the workspace and runs it there under plain Node, no runtime dependency resolvable (SPEC 13.1, H-2)", async () => {
  const workspace = await makeWorkspace({
    files: {
      "util.ts":
        "export function double(n: number): number {\n  return n * 2;\n}\n",
      "main.ts": [
        'import { double } from "./util.js";',
        "",
        "declare const process: { readonly argv: readonly string[] };",
        "",
        'console.log(`double:${double(3)} argv:${process.argv[2] ?? "none"}`);',
        "",
      ].join("\n"),
    },
  });
  const sources = {
    rootDir: workspace.root,
    rootFiles: ["main.ts", "util.ts"],
  };
  // The consumer program is valid under both configurations (H-2).
  await forEachConsumerProject(sources, (project) =>
    assertTypeChecksClean(project, "runtime consumer"),
  );
  const project = await ConsumerProject.load({
    ...sources,
    configuration: COMMONJS_CONFIGURATION,
  });
  let outputDir = "";
  const result = await withCompiledConsumer(
    project,
    "S-4 runtime consumer",
    async (compiled) => {
      outputDir = compiled.dir;
      // A fresh directory under the OS temporary directory, outside the
      // workspace.
      expect(path.isAbsolute(compiled.dir)).toBe(true);
      expect(liesInside(compiled.dir, os.tmpdir())).toBe(true);
      expect(liesInside(compiled.dir, workspace.root)).toBe(false);
      expect(liesInside(workspace.root, compiled.dir)).toBe(false);
      // Exactly the compiler's output, the project root's layout kept.
      expect(compiled.emittedFiles).toEqual(["main.js", "util.js"]);
      expect((await fsp.readdir(compiled.dir)).sort()).toEqual([
        "main.js",
        "util.js",
      ]);
      expect(compiled.outputOf("main.ts")).toBe("main.js");
      expect(compiled.outputOf("./util.ts")).toBe("util.js");
      expect(() => compiled.outputOf("absent.ts")).toThrowError(
        HarnessAssertionError,
      );
      // CommonJS JavaScript: the import compiled to a `require`.
      const main = await fsp.readFile(
        path.join(compiled.dir, "main.js"),
        "utf8",
      );
      expect(main).toContain('require("./util.js")');
      expect(main).not.toMatch(/^import /m);
      // Nothing written into the workspace: standard tooling only, no
      // runtime dependency installed beside the consumer.
      expect(await workspace.readdirNames()).toEqual(["main.ts", "util.ts"]);
      return await compiled.run("main.ts", { argv: ["extra"] });
    },
  );
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("double:6 argv:extra\n");
  expect(result.stderr).toBe("");
  // The output directory is removed once the body settles.
  await expect(fsp.lstat(outputDir)).rejects.toThrowError(/ENOENT/);
});

test("captures a compiled consumer's failure exit code and stderr", async () => {
  const workspace = await makeWorkspace({
    files: {
      "fail.ts": [
        "declare const process: { exit(code: number): never };",
        "",
        'console.error("consumer-failure-marker");',
        "process.exit(3);",
        "",
        "export {};",
        "",
      ].join("\n"),
    },
  });
  const sources = { rootDir: workspace.root, rootFiles: ["fail.ts"] };
  await forEachConsumerProject(sources, (project) =>
    assertTypeChecksClean(project, "failing consumer"),
  );
  const result = await withCompiledConsumer(
    await ConsumerProject.load({
      ...sources,
      configuration: COMMONJS_CONFIGURATION,
    }),
    "S-4 failing consumer",
    async (compiled) => await compiled.run("fail.ts"),
  );
  expect(result.exitCode).toBe(3);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("consumer-failure-marker\n");
});

test("the compiled output is the compiler's alone: a hand-written JavaScript file beside a declaration module is never copied, so a run requiring it fails (H-2)", async () => {
  const workspace = await makeWorkspace({
    files: {
      "shout.d.ts": "export declare function shout(text: string): string;\n",
      "shout.js":
        '"use strict";\nexports.shout = (text) => text.toUpperCase();\n',
      "main.ts":
        'import { shout } from "./shout.js";\n\nconsole.log(shout("quiet"));\n',
    },
  });
  const sources = { rootDir: workspace.root, rootFiles: ["main.ts"] };
  await forEachConsumerProject(sources, (project) =>
    assertTypeChecksClean(project, "consumer of a declaration module"),
  );
  const result = await withCompiledConsumer(
    await ConsumerProject.load({
      ...sources,
      configuration: COMMONJS_CONFIGURATION,
    }),
    "S-4 declaration-module consumer",
    async (compiled) => {
      // The declaration module compiles to nothing, and the JavaScript file
      // beside it is no compiler output.
      expect(compiled.emittedFiles).toEqual(["main.js"]);
      return await compiled.run("main.ts");
    },
  );
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Cannot find module './shout.js'");
});

test("H-2's runtime refuses the ES-module configuration and an output directory inside the project root, and the type-error assertion an empty expectation list — harness misuse, never a verdict", async () => {
  const workspace = await stageFixtureProject();
  const rootFiles = ["greeting.ts", "main.ts"];
  const esModule = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles,
    configuration: ES_MODULE_CONFIGURATION,
  });
  const commonJs = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles,
    configuration: COMMONJS_CONFIGURATION,
  });
  const misuses: (() => unknown)[] = [
    // H-2's runtime is the CommonJS configuration's alone.
    () => esModule.emitTo(path.join(os.tmpdir(), "never-written")),
    // Its output lies outside the project root.
    () => commonJs.emitTo(path.join(workspace.root, "out")),
    () => commonJs.emitTo("relative-out"),
    // An empty expectation list is the clean verdict's, never this one's.
    () => assertTypeErrorsAt(commonJs, []),
  ];
  for (const misuse of misuses) {
    let thrown: unknown;
    try {
      misuse();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  }
  const refused: unknown = await withCompiledConsumer(
    esModule,
    "S-4 misuse probe",
    async () => "entered",
  ).catch((error: unknown) => error);
  expect(refused).toBeInstanceOf(Error);
  expect(refused).not.toBeInstanceOf(HarnessAssertionError);
  expect((refused as Error).message).toMatch(
    /type-checked and served, never executed/,
  );
  expect(await workspace.readdirNames()).not.toContain("out");
});

// H-1's isolation of a consumer program (TEST-SPEC H-1, H-2, T13.1-2;
// helpers/staging-isolation.ts through helpers/tooling.ts). Every staging
// lies in a fresh temporary directory, never under this repository, whose
// own package.json and node_modules lie above it; every symbolic link points
// inside its own workspace.

/** A text of `lines`, each ended by a line feed (U+000A). */
function textOf(...lines: readonly string[]): string {
  const lineFeed = String.fromCodePoint(0x0a);
  return lines.map((line) => line + lineFeed).join("");
}

/**
 * An entry named `name`, in the workspace directory `at` ("" for the root),
 * of each kind H-1's examination judges by `lstat`: a directory, a plain
 * file, and a dangling symbolic link pointing inside the workspace.
 */
function entryOfEachKind(
  name: string,
  at: string,
): readonly (readonly [string, WorkspaceDecl])[] {
  const rel = at === "" ? name : `${at}/${name}`;
  return [
    ["a directory", { dirs: [rel] }],
    ["a plain file", { files: { [rel]: "" } }],
    ["a symbolic link", { symlinks: { [rel]: "nowhere" } }],
  ];
}

/**
 * A consumer that writes the marker file its first argument names, if any,
 * and prints `ran` — so a run refused before the consumer starts leaves no
 * marker. H-2 supplies no `@types/node`: it declares what it reads.
 */
const MARKING_CONSUMER = textOf(
  "declare const process: { readonly argv: readonly string[] };",
  "declare const module: {",
  '  require(id: "node:fs"): {',
  "    writeFileSync(path: string, data: string): void;",
  "  };",
  "};",
  "",
  "const marker = process.argv[2];",
  "if (marker !== undefined) {",
  '  module.require("node:fs").writeFileSync(marker, "ran");',
  "}",
  'console.log("ran");',
  "",
  "export {};",
);

/**
 * A consumer reporting, as one JSON line, the `HOME` and `NODE_PATH` it
 * runs under and the entries of that `HOME`.
 */
const HOME_REPORTING_CONSUMER = textOf(
  "declare const process: {",
  "  readonly env: Readonly<Record<string, string | undefined>>;",
  "};",
  "declare const module: {",
  '  require(id: "node:fs"): { readdirSync(path: string): string[] };',
  "};",
  "",
  "const home = process.env.HOME;",
  "console.log(",
  "  JSON.stringify({",
  "    home: home ?? null,",
  "    entries:",
  "      home === undefined",
  "        ? null",
  '        : module.require("node:fs").readdirSync(home),',
  "    nodePath: process.env.NODE_PATH ?? null,",
  "  }),",
  ");",
  "",
  "export {};",
);

test("H-1's isolation of a consumer program: a project whose root has a package.json or node_modules entry above it, or a node_modules entry in it, is refused as a staging error — the fixture directory in this repository among them (TEST-SPEC H-1, T13.1-2)", async () => {
  for (const [name, at] of [
    ["package.json", ""],
    ["node_modules", ""],
    ["node_modules", "project"],
  ] as const) {
    for (const [kind, decl] of entryOfEachKind(name, at)) {
      const workspace = await makeWorkspace({
        ...decl,
        files: {
          ...(decl.files ?? {}),
          "project/main.ts": textOf("export const value = 1;"),
        },
      });
      const entry = path.join(workspace.root, at, name);
      const expected =
        at === ""
          ? `the ancestor directory ${workspace.root} holds an entry named ` +
            `${name} (${kind}, ${entry})`
          : `the consumer project root ${workspace.path("project")} itself ` +
            `holds an entry named ${name} (${kind}, ${entry})`;
      for (const configuration of CONSUMER_CONFIGURATIONS) {
        const error: unknown = await ConsumerProject.load({
          rootDir: workspace.path("project"),
          rootFiles: ["main.ts"],
          configuration,
        }).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(HarnessStagingError);
        expect((error as HarnessStagingError).mode).toBe("consumer-isolation");
        expect((error as Error).message).toContain(expected);
      }
    }
  }
  // The fixture directory in place lies below this repository's own
  // package.json and node_modules — hence S-4's copies.
  const inPlace: unknown = await ConsumerProject.load({
    rootDir: fixtureRoot,
    rootFiles: ["greeting.ts", "main.ts"],
    configuration: COMMONJS_CONFIGURATION,
  }).catch((caught: unknown) => caught);
  expect(inPlace).toBeInstanceOf(HarnessStagingError);
  expect((inPlace as HarnessStagingError).mode).toBe("consumer-isolation");
});

test("H-1's isolation of a consumer program: a runtime output directory with a package.json or node_modules entry above it is refused before anything is compiled into it, and removed (TEST-SPEC H-1)", async () => {
  const workspace = await makeWorkspace({
    files: {
      "main.ts": textOf('console.log("never run");', "", "export {};"),
    },
  });
  const project = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles: ["main.ts"],
    configuration: COMMONJS_CONFIGURATION,
  });
  for (const [name, kind, decl] of [
    ["node_modules", "a directory", { dirs: ["node_modules", "tmp"] }],
    [
      "package.json",
      "a plain file",
      { dirs: ["tmp"], files: { "package.json": textOf("{}") } },
    ],
  ] as const) {
    // The OS temporary directory, as `os.tmpdir()` reads it at each call,
    // moved below a directory holding the entry for this one call.
    const decoy = await makeWorkspace(decl);
    const ambient = process.env["TMPDIR"];
    process.env["TMPDIR"] = decoy.path("tmp");
    let entered = false;
    let refused: unknown;
    try {
      refused = await withCompiledConsumer(
        project,
        "S-4 isolation probe",
        async () => {
          entered = true;
        },
      ).catch((error: unknown) => error);
    } finally {
      if (ambient === undefined) {
        delete process.env["TMPDIR"];
      } else {
        process.env["TMPDIR"] = ambient;
      }
    }
    expect(entered).toBe(false);
    expect(refused).toBeInstanceOf(HarnessStagingError);
    expect((refused as HarnessStagingError).mode).toBe("consumer-isolation");
    expect((refused as Error).message).toContain(
      `the ancestor directory ${decoy.root} holds an entry named ${name} ` +
        `(${kind}, ${path.join(decoy.root, name)})`,
    );
    expect(await decoy.readdirNames("tmp")).toEqual([]);
  }
});

test("H-1's isolation of a consumer program: a run whose environment gives Node.js's resolver a global folder holding a package — under any name, xspec's or another — is refused before the consumer runs, and an empty global folder holds none (TEST-SPEC H-1, H-2)", async () => {
  const folders = await makeWorkspace({
    dirs: [
      "other/.node_modules/left-pad",
      "named/.node_modules/xspec",
      "path/@acme/config-kit",
      "empty/.node_modules",
      "empty/.node_libraries",
    ],
    files: { "module/.node_libraries/helper.js": textOf("exports.x = 1;") },
  });
  const markers = await makeWorkspace();
  const workspace = await makeWorkspace({
    files: { "main.ts": MARKING_CONSUMER },
  });
  const sources = { rootDir: workspace.root, rootFiles: ["main.ts"] };
  await forEachConsumerProject(sources, (project) =>
    assertTypeChecksClean(project, "marking consumer"),
  );
  const project = await ConsumerProject.load({
    ...sources,
    configuration: COMMONJS_CONFIGURATION,
  });
  const refusals = [
    // `$HOME/.node_modules`, holding a package under another name.
    {
      marker: "other",
      env: { HOME: folders.path("other") },
      folder: folders.path("other/.node_modules"),
      holds: 'the entry "left-pad"',
    },
    // `$HOME/.node_libraries`, holding a plain-file module.
    {
      marker: "module",
      env: { HOME: folders.path("module") },
      folder: folders.path("module/.node_libraries"),
      holds: 'the entry "helper.js"',
    },
    // `$HOME/.node_modules`, holding a package named xspec.
    {
      marker: "named",
      env: { HOME: folders.path("named") },
      folder: folders.path("named/.node_modules"),
      holds: 'the entry "xspec"',
    },
    // A NODE_PATH entry, which a run drops unless its environment sets it,
    // holding a scope.
    {
      marker: "path",
      env: { NODE_PATH: folders.path("path") },
      folder: folders.path("path"),
      holds: 'the entry "@acme"',
    },
  ];
  await withCompiledConsumer(
    project,
    "S-4 global-folder probe",
    async (compiled) => {
      for (const refusal of refusals) {
        const marker = markers.path(`${refusal.marker}.ran`);
        const refused: unknown = await compiled
          .run("main.ts", { argv: [marker], env: refusal.env })
          .catch((error: unknown) => error);
        expect(refused).toBeInstanceOf(HarnessStagingError);
        expect((refused as HarnessStagingError).mode).toBe(
          "consumer-isolation",
        );
        expect((refused as Error).message).toContain(
          `the global folder ${refusal.folder}, which Node.js's resolver ` +
            `searches for a bare specifier under the run's environment, ` +
            `holds ${refusal.holds}`,
        );
      }
      // Refused before the consumer ran: no marker written.
      expect(await markers.readdirNames()).toEqual([]);
      // Global folders that exist but hold nothing hold no package, and
      // under the ambient environment, with the run's own fresh HOME, the
      // run proceeds too.
      for (const [name, env] of [
        ["empty", { HOME: folders.path("empty") }],
        ["ambient", undefined],
      ] as const) {
        const ran = await compiled.run("main.ts", {
          argv: [markers.path(`${name}.ran`)],
          env,
        });
        expect(ran.exitCode).toBe(0);
        expect(ran.stdout).toBe(textOf("ran"));
        expect(ran.stderr).toBe("");
      }
      expect((await markers.readdirNames()).sort()).toEqual([
        "ambient.ran",
        "empty.ran",
      ]);
    },
  );
});

test("H-1's isolation of a consumer program: each run gets a fresh, empty HOME of its own — never the ambient one — under the OS temporary directory, outside the workspace and the output directory, with no NODE_PATH, removed once the run ends (TEST-SPEC H-1)", async () => {
  const workspace = await makeWorkspace({
    files: { "main.ts": HOME_REPORTING_CONSUMER },
  });
  const sources = { rootDir: workspace.root, rootFiles: ["main.ts"] };
  await forEachConsumerProject(sources, (project) =>
    assertTypeChecksClean(project, "HOME-reporting consumer"),
  );
  const project = await ConsumerProject.load({
    ...sources,
    configuration: COMMONJS_CONFIGURATION,
  });
  const ambientHome = process.env["HOME"];
  const homes: string[] = [];
  await withCompiledConsumer(
    project,
    "S-4 fresh-HOME probe",
    async (compiled) => {
      for (let index = 0; index < 2; index += 1) {
        const result = await compiled.run("main.ts");
        expect(result.exitCode).toBe(0);
        expect(result.stderr).toBe("");
        const report = JSON.parse(result.stdout) as {
          readonly home: unknown;
          readonly entries: unknown;
          readonly nodePath: unknown;
        };
        expect(typeof report.home).toBe("string");
        const home = report.home as string;
        expect(path.isAbsolute(home)).toBe(true);
        expect(home).not.toBe(ambientHome);
        expect(liesInside(home, os.tmpdir())).toBe(true);
        for (const other of [workspace.root, compiled.dir]) {
          expect(home).not.toBe(other);
          expect(liesInside(home, other)).toBe(false);
          expect(liesInside(other, home)).toBe(false);
        }
        expect(report.entries).toEqual([]);
        expect(report.nodePath).toBeNull();
        // Removed once the run ends.
        await expect(fsp.lstat(home)).rejects.toThrowError(/ENOENT/);
        homes.push(home);
      }
    },
  );
  // Each run its own.
  expect(new Set(homes).size).toBe(2);
});

test("H-1's isolation: lib/node under the prefix of each Node.js executable that will run — as spelled and along its physical path — is a global module folder too, a folder that is no directory holding none, and an executable whose physical path cannot be read leaving the isolation unverified (helpers/staging-isolation.ts)", async () => {
  const staging = await makeWorkspace({
    dirs: ["root", "real/lib/node/some-package", "linked/bin", "plain/lib"],
    files: { "real/bin/node": "", "plain/bin/node": "", "plain/lib/node": "" },
    symlinks: { "linked/bin/node": "../../real/bin/node" },
  });
  const isolation = (executable: string): Promise<void> =>
    verifyStagingIsolation({
      root: staging.path("root"),
      role: "the S-4 probe's staging root",
      context: "S-4 executable-prefix probe",
      mode: "consumer-isolation",
      run: {
        environment: {},
        cwd: staging.path("root"),
        executables: [executable],
      },
    });
  const realFolder = path.join(
    await fsp.realpath(staging.path("real")),
    "lib",
    "node",
  );
  for (const [executable, folder] of [
    [staging.path("real/bin/node"), staging.path("real/lib/node")],
    [staging.path("linked/bin/node"), realFolder],
  ] as const) {
    const refused: unknown = await isolation(executable).catch(
      (error: unknown) => error,
    );
    expect(refused).toBeInstanceOf(HarnessStagingError);
    expect((refused as HarnessStagingError).mode).toBe("consumer-isolation");
    expect((refused as Error).message).toContain(
      `the global folder ${folder}, which Node.js's resolver searches for ` +
        `a bare specifier under the run's environment, holds the entry ` +
        `"some-package"`,
    );
  }
  await expect(isolation(staging.path("plain/bin/node"))).resolves.toBe(
    undefined,
  );
  const unverified: unknown = await isolation(
    staging.path("missing/bin/node"),
  ).catch((error: unknown) => error);
  expect(unverified).toBeInstanceOf(HarnessStagingError);
  expect((unverified as Error).message).toContain(
    `the physical path of the Node.js executable ` +
      `${staging.path("missing/bin/node")} cannot be read`,
  );
});

// `moduleSkeleton`'s fixture (T1.1-2: two generated modules expose the same
// skeleton, SPEC 1.1, 4.1). A hand-written module in the generated
// arrangement — the module re-exporting a companion that declares one
// interface per node — whose member tree exercises every rule: own members
// expanded, a member declared elsewhere (another project file, TypeScript's
// lib) a leaf, symbol-keyed and non-identifier names, an index signature
// expanded through its own value type, call and construct signatures, an
// optional member expanded through its non-nullable type, a cycle back to
// the root, and a generic chain stopped at the depth bound. Valid under
// both of H-2's configurations: the type re-export and the type import
// carry their `type` modifiers.
const SKELETON_SHARED = [
  "export interface Shared {",
  "  readonly inner: { readonly deeper: number };",
  "}",
  "",
].join("\n");

function skeletonCompanion(
  options: {
    readonly names?: Readonly<Record<string, string>>;
    readonly extraOnN1?: boolean;
    readonly loopTo?: "N0" | "N1";
  } = {},
): string {
  const name = (base: string): string => options.names?.[base] ?? base;
  return [
    'import type { Shared } from "../shared.js";',
    "declare const BRAND: unique symbol;",
    `interface ${name("Base")} {`,
    "  readonly [BRAND]: unknown;",
    "}",
    `interface ${name("N0")} extends ${name("Base")} {`,
    `  readonly alpha: ${name("N1")};`,
    `  readonly "kebab-case": ${name("N2")};`,
    `  readonly loop: ${name(options.loopTo ?? "N0")};`,
    "  readonly shared: Shared;",
    "  readonly label: string;",
    `  readonly deep: ${name("Deep")}<0>;`,
    `  readonly maybe?: ${name("N1")};`,
    "}",
    `interface ${name("N1")} extends ${name("Base")} {`,
    `  new (): ${name("Base")};`,
    `  readonly beta: ${name("N2")};`,
    ...(options.extraOnN1 === true
      ? [`  readonly extra: ${name("Base")};`]
      : []),
    "}",
    `interface ${name("N2")} extends ${name("Base")} {`,
    "  (): void;",
    `  readonly [key: string]: ${name("Base")};`,
    "}",
    `interface ${name("Deep")}<T> {`,
    `  readonly next: ${name("Deep")}<[T]>;`,
    "}",
    `declare const root: ${name("N0")};`,
    "export default root;",
    `export declare function text(node: ${name("Base")}): string;`,
    "",
  ].join("\n");
}

const SKELETON_MODULE = [
  'export { default, text } from "./m.xspec.impl.js";',
  'export type { Shared } from "../shared.js";',
  "",
].join("\n");

const SKELETON_MAIN = 'import ROOT from "./gen/m.xspec";\n\nROOT.alpha.beta;\n';

const isSkeletonOwnFile = (file: string): boolean =>
  file.startsWith("gen/m.xspec.");

async function loadSkeletonProject(
  configuration: ConsumerConfiguration,
  companion: string,
  module: string = SKELETON_MODULE,
): Promise<ConsumerProject> {
  const workspace = await makeWorkspace({
    files: {
      "shared.ts": SKELETON_SHARED,
      "gen/m.xspec.ts": module,
      // A `.ts` companion rather than a product's `.d.ts`: both are checked
      // under H-2's configurations, which leave `skipLibCheck` at its
      // default, so the clean verdict below stands the vectors on valid
      // TypeScript either way.
      "gen/m.xspec.impl.ts": companion,
      "main.ts": SKELETON_MAIN,
      // A global declaration file: no module (under the configurations'
      // default module detection, a file holding no import or export is a
      // script).
      "globals.d.ts": "declare const scriptOnly: number;\n",
    },
  });
  const project = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles: ["main.ts", "globals.d.ts"],
    configuration,
  });
  assertTypeChecksClean(project, "module-skeleton fixture");
  return project;
}
