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
// directory, as a consumer workspace is compiled — no `node_modules` above
// it, so the release's default `types` brings no `@types` package of this
// repository into the program (H-2: every option H-2 does not name at the
// release's default), and H-2's isolation holds: a known type error, a known
// definition location, and a known hover text must all be detected, so
// section 4's consumer assertions cannot pass vacuously — among the type
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
// fail loudly rather than vacuously green; H-2's isolation is a staging
// error, never a verdict; and each path's helpers refuse the other's
// projects. The skeleton reader T1.1-2 compares two generated modules
// through (`moduleSkeleton`, `skeletonChains`, `diffModuleSkeletons`) is
// pinned, in each configuration, against a hand-written module in the
// generated arrangement: its exact member tree, the compare's blindness to
// declaration names and its topmost differences, and its loud failures.
// The NodeNext path, which the driver keeps only until every consumer test
// has moved onto H-2's configurations, keeps two vectors of its own,
// removed with it.

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
// The harness's own pinned TypeScript, as the tooling driver uses it.
import ts from "typescript-5.9.3";
import { describe, expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import {
  assertCompileErrorAt,
  assertNoCompileErrors,
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
  runConsumer,
  skeletonChains,
  withCompiledConsumer,
} from "../helpers/tooling.js";
import type { ConsumerConfiguration } from "../helpers/tooling.js";
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
 * is (module header): no `node_modules` above it.
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
  // Any other configuration object — a copy of one included — and
  // compilerOptions beside a configuration are refused, as harness misuse.
  await expect(
    ConsumerProject.load({
      rootDir: workspace.root,
      rootFiles: ["greeting.ts", "main.ts"],
      configuration: { ...COMMONJS_CONFIGURATION },
    }),
  ).rejects.toThrowError(/one of H-2's two fixed configurations exactly/);
  await expect(
    ConsumerProject.load({
      rootDir: workspace.root,
      rootFiles: ["greeting.ts", "main.ts"],
      configuration: ES_MODULE_CONFIGURATION,
      compilerOptions: { skipLibCheck: true },
    }),
  ).rejects.toThrowError(/compilerOptions is the NodeNext path's alone/);
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

test("each path's helpers refuse the other's projects, and H-2's runtime refuses the ES-module configuration — harness misuse, never a verdict", async () => {
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
  const nodeNext = await ConsumerProject.load({
    rootDir: fixtureRoot,
    rootFiles,
  });
  expect(nodeNext.configuration).toBeUndefined();
  const misuses: (() => unknown)[] = [
    // H-2's runtime is the CommonJS configuration's alone.
    () => esModule.emitTo(path.join(os.tmpdir(), "never-written")),
    () => nodeNext.emitTo(path.join(os.tmpdir(), "never-written")),
    // Its output lies outside the project root.
    () => commonJs.emitTo(path.join(workspace.root, "out")),
    () => commonJs.emitTo("relative-out"),
    // The NodeNext path's helpers refuse a project under H-2.
    () => commonJs.emit(),
    () => assertNoCompileErrors(commonJs),
    () =>
      assertCompileErrorAt(
        commonJs,
        commonJs.locate("main.ts", 'greet("world")'),
      ),
    // H-2's helpers refuse the NodeNext path's project.
    () => assertTypeChecksClean(nodeNext),
    () =>
      assertTypeErrorsAt(nodeNext, [
        { at: nodeNext.locate("main.ts", 'greet("world")') },
      ]),
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
  for (const project of [esModule, nodeNext]) {
    const refused: unknown = await withCompiledConsumer(
      project,
      "S-4 misuse probe",
      async () => "entered",
    ).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(Error);
    expect(refused).not.toBeInstanceOf(HarnessAssertionError);
  }
  await expect(
    withCompiledConsumer(esModule, "S-4 misuse probe", async () => "entered"),
  ).rejects.toThrowError(/type-checked and served, never executed/);
});

test("H-2's isolation: a configured project whose root has a node_modules entry above it is refused as a staging error — the fixture directory in this repository among them", async () => {
  for (const [kind, decl] of [
    ["a directory", { dirs: ["node_modules"] }],
    ["a plain file", { files: { node_modules: "" } }],
    ["a symbolic link", { symlinks: { node_modules: "nowhere" } }],
  ] as const) {
    const workspace = await makeWorkspace({
      ...decl,
      files: {
        ...("files" in decl ? decl.files : {}),
        "project/main.ts": "export const value = 1;\n",
      },
    });
    for (const configuration of CONSUMER_CONFIGURATIONS) {
      const error: unknown = await ConsumerProject.load({
        rootDir: workspace.path("project"),
        rootFiles: ["main.ts"],
        configuration,
      }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(HarnessStagingError);
      expect((error as HarnessStagingError).mode).toBe("consumer-isolation");
      expect((error as Error).message).toContain(
        `holds an entry named node_modules (${kind}, ` +
          `${path.join(workspace.root, "node_modules")})`,
      );
    }
  }
  // The fixture directory in place lies below this repository's own
  // node_modules — hence S-4's copies.
  const inPlace: unknown = await ConsumerProject.load({
    rootDir: fixtureRoot,
    rootFiles: ["greeting.ts", "main.ts"],
    configuration: COMMONJS_CONFIGURATION,
  }).catch((caught: unknown) => caught);
  expect(inPlace).toBeInstanceOf(HarnessStagingError);
  expect((inPlace as HarnessStagingError).mode).toBe("consumer-isolation");
});

test("H-2's isolation: a runtime output directory with a node_modules entry above it is refused before anything is compiled into it, and removed", async () => {
  const workspace = await makeWorkspace({
    files: { "main.ts": 'console.log("never run");\n\nexport {};\n' },
  });
  const project = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles: ["main.ts"],
    configuration: COMMONJS_CONFIGURATION,
  });
  // The OS temporary directory, as `os.tmpdir()` reads it at each call, moved
  // below a node_modules-holding directory for this one call.
  const decoy = await makeWorkspace({ dirs: ["node_modules", "tmp"] });
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
    `holds an entry named node_modules (a directory, ` +
      `${path.join(decoy.root, "node_modules")})`,
  );
  expect(await decoy.readdirNames("tmp")).toEqual([]);
});

test("H-2's isolation: a run whose environment lets Node.js's resolver find a package named xspec in a global folder is refused before the consumer runs", async () => {
  const home = await makeWorkspace({
    dirs: [".node_modules/xspec", "path/xspec"],
  });
  const workspace = await makeWorkspace({
    files: { "main.ts": 'console.log("ran");\n\nexport {};\n' },
  });
  const project = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles: ["main.ts"],
    configuration: COMMONJS_CONFIGURATION,
  });
  await withCompiledConsumer(
    project,
    "S-4 global-folder probe",
    async (compiled) => {
      // `$HOME/.node_modules`, which Node.js's resolver searches.
      const viaHome: unknown = await compiled
        .run("main.ts", { env: { HOME: home.root } })
        .catch((error: unknown) => error);
      expect(viaHome).toBeInstanceOf(HarnessStagingError);
      expect((viaHome as HarnessStagingError).mode).toBe("consumer-isolation");
      expect((viaHome as Error).message).toContain(
        `holds an entry named xspec (a directory, ` +
          `${path.join(home.root, ".node_modules", "xspec")})`,
      );
      // A NODE_PATH entry, which a run drops unless its environment sets it.
      const viaNodePath: unknown = await compiled
        .run("main.ts", { env: { NODE_PATH: home.path("path") } })
        .catch((error: unknown) => error);
      expect(viaNodePath).toBeInstanceOf(HarnessStagingError);
      expect((viaNodePath as Error).message).toContain(
        `${path.join(home.root, "path", "xspec")}`,
      );
      // Under the ambient environment the run proceeds.
      const ran = await compiled.run("main.ts");
      expect(ran.exitCode).toBe(0);
      expect(ran.stdout).toBe("ran\n");
    },
  );
});

test("the transitional NodeNext path keeps its verdicts until its removal: the fixture project in place, its type error, both collision kinds, and its clean subset", async () => {
  const load = async (rootFiles: readonly string[]): Promise<ConsumerProject> =>
    await ConsumerProject.load({ rootDir: fixtureRoot, rootFiles });
  const typeError = await load(["greeting.ts", "main.ts", "type-error.ts"]);
  const marker = typeError.locate("type-error.ts", "12345");
  const diagnostic = assertCompileErrorAt(typeError, marker, {
    code: 2345,
    messageIncludes: ["number", "string"],
  });
  expect(diagnostic.start).toEqual(marker);
  expect(typeError.errors()).toHaveLength(1);
  const conflict = await load(["greeting.ts", "import-conflict.ts"]);
  expect(() => assertNoCompileErrors(conflict)).toThrowError(/TS2440/);
  const duplicate = await load([
    "greeting.ts",
    "other-greeting.ts",
    "import-duplicate.ts",
  ]);
  expect(() => assertNoCompileErrors(duplicate)).toThrowError(/TS2300/);
  assertNoCompileErrors(await load(["greeting.ts", "main.ts"]));
});

test("the transitional NodeNext path keeps its runtime until its removal: emitted beside the sources, run under plain Node", async () => {
  const workspace = await makeWorkspace({
    files: {
      "package.json": '{ "type": "module" }\n',
      "util.ts":
        "export function double(n: number): number {\n  return n * 2;\n}\n",
      "main.ts":
        'import { double } from "./util.js";\n\nprocess.stdout.write(`double:${double(3)} argv:${process.argv[2] ?? "none"}\\n`);\n',
    },
  });
  const project = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles: ["main.ts", "util.ts"],
  });
  assertNoCompileErrors(project, "runtime consumer");
  const emitted = project.emit();
  expect(emitted.emitSkipped).toBe(false);
  expect(emitted.emittedFiles).toEqual(["main.js", "util.js"]);
  const result = await runConsumer({
    dir: workspace.root,
    entry: "main.js",
    argv: ["extra"],
  });
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("double:6 argv:extra\n");
  expect(result.stderr).toBe("");
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
