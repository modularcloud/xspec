// S-4 TypeScript tooling driver self-test (TEST-SPEC 17). Section 4's
// consumer-side assertions — type errors at exact locations, hover text, and
// go-to-definition targets (SPEC.md 4, 13.1) — reach TypeScript only through
// the tooling driver (test/helpers/tooling.ts), so S-4 pins that driver
// against a hand-written, non-xspec fixture project
// (test/fixtures/s4-tooling/): a known type error, a known definition
// location, and a known hover text must all be detected, so section 4's
// consumer assertions cannot pass vacuously. A driver blind to a diagnostic
// kind passes conformer and violator alike wherever no violator targets that
// kind, so each kind's detection is checked directly (S-4): beside the
// argument-type error (TS2345), the two collision kinds T6.5-9's
// compile-clean observation turns on when a product-chosen import
// identifier collides with a binding the receiving file already holds — an
// import binding conflicting with a module-scope local declaration (TS2440:
// the file's own `const`, `function`, or `class`) and an import binding
// duplicated by another import binding (TS2300: a non-spec import the file
// already carries) — neither of which any certification fixture targets
// (CERTIFICATIONS.md, Exclusions: "Section 4 consumer-side and type-level
// tests"). Alongside the S-4 probes, the
// driver's remaining surfaces are pinned the same way: compiled consumers
// run under plain Node with no runtime dependency in the consumer workspace
// (SPEC.md 13.1; IMPLEMENTATION.md), an import nothing makes resolvable is a
// diagnosed compile error (the red path for section 4 tests against the
// stub product, H-8), and marker addressing and project loading fail loudly
// rather than vacuously green.

import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  assertCompileErrorAt,
  assertNoCompileErrors,
  ConsumerProject,
  runConsumer,
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

async function loadFixtureProject(
  rootFiles: readonly string[],
): Promise<ConsumerProject> {
  return await ConsumerProject.load({ rootDir: fixtureRoot, rootFiles });
}

test("S-4: detects the known type error at its exact location", async () => {
  const project = await loadFixtureProject([
    "greeting.ts",
    "main.ts",
    "type-error.ts",
  ]);
  const marker = project.locate("type-error.ts", "12345");
  const diagnostic = assertCompileErrorAt(project, marker, {
    code: 2345,
    messageIncludes: ["number", "string"],
  });
  // The error spans exactly the offending argument, and the location math is
  // pinned against hand-counted ground truth in the frozen fixture file.
  expect(diagnostic.start).toEqual(marker);
  expect(diagnostic.length).toBe("12345".length);
  expect(marker.file).toBe("type-error.ts");
  expect(marker.line).toBe(8);
  expect(marker.column).toBe(36);
  // And it is the only error: detection is specific, not "everything fails".
  expect(project.errors()).toHaveLength(1);
});

test("S-4: detects an import binding conflicting with a module-scope local declaration (TS2440, the kind T6.5-9 turns on)", async () => {
  // T6.5-9's compile-clean observation rides assertNoCompileErrors over a
  // consumer whose receiving file pre-empts the product-chosen import
  // identifier with its own `const` — a collision TypeScript reports as
  // TS2440 on the import binding. No certification fixture targets the kind,
  // so its detection is pinned here directly (S-4), on a fixture file whose
  // only defect is that collision.
  const project = await loadFixtureProject([
    "greeting.ts",
    "import-conflict.ts",
  ]);
  const marker = project.locate("import-conflict.ts", "import { greet }", {
    charOffset: "import { ".length,
  });
  const diagnostic = assertCompileErrorAt(project, marker, {
    code: 2440,
    messageIncludes: [
      "Import declaration conflicts with local declaration",
      "greet",
    ],
  });
  // The error spans exactly the import clause's binding identifier, and the
  // location math is pinned against hand-counted ground truth in the frozen
  // fixture file.
  expect(diagnostic.start).toEqual(marker);
  expect(diagnostic.length).toBe("greet".length);
  expect(marker.file).toBe("import-conflict.ts");
  expect(marker.line).toBe(10);
  expect(marker.column).toBe(10);
  // Detection is specific: the import binding is the only error — the local
  // declaration it collides with (and the use) carry no diagnostic.
  expect(project.errors()).toHaveLength(1);
  const local = project.locate("import-conflict.ts", "const greet", {
    charOffset: "const ".length,
  });
  expect(() =>
    assertCompileErrorAt(project, local, { code: 2440 }),
  ).toThrowError(HarnessAssertionError);
  // The clean-compile assertion T6.5-9 rides diagnoses the state instead of
  // passing.
  expect(() => assertNoCompileErrors(project)).toThrowError(
    HarnessAssertionError,
  );
  expect(() => assertNoCompileErrors(project)).toThrowError(/TS2440/);
});

test("S-4: detects an import binding duplicated by another import binding (TS2300, the other collision kind T6.5-9 turns on)", async () => {
  // T6.5-9's pre-empted set also holds a non-spec import binding: a
  // product-chosen import identifier equal to one the receiving file already
  // imports is a collision TypeScript reports as TS2300 on both import
  // bindings. No certification fixture targets the kind, so its detection is
  // pinned here directly (S-4), on a fixture file whose only defect is that
  // duplication. Fixture self-check first: both imported modules are valid
  // on their own, so every diagnostic below is the duplication's.
  assertNoCompileErrors(
    await loadFixtureProject(["greeting.ts", "other-greeting.ts"]),
    "s4-tooling duplicate-import premise",
  );
  const project = await loadFixtureProject([
    "greeting.ts",
    "other-greeting.ts",
    "import-duplicate.ts",
  ]);
  // The marker occurs once per import declaration, so each binding is
  // addressed by occurrence index; the offset lands on the identifier.
  const bindings = [
    { index: 0, line: 9 },
    { index: 1, line: 10 },
  ] as const;
  for (const { index, line } of bindings) {
    const marker = project.locate("import-duplicate.ts", "import { greet }", {
      index,
      charOffset: "import { ".length,
    });
    const diagnostic = assertCompileErrorAt(project, marker, {
      code: 2300,
      messageIncludes: ["Duplicate identifier", "greet"],
    });
    // Each error spans exactly its import clause's binding identifier, and
    // the location math is pinned against hand-counted ground truth in the
    // frozen fixture file.
    expect(diagnostic.start).toEqual(marker);
    expect(diagnostic.length).toBe("greet".length);
    expect(marker.file).toBe("import-duplicate.ts");
    expect(marker.line).toBe(line);
    expect(marker.column).toBe(10);
  }
  // Detection is specific: the two import bindings are the only errors — the
  // use carries no diagnostic.
  expect(project.errors()).toHaveLength(2);
  const use = project.locate("import-duplicate.ts", 'greet("world")');
  expect(() => assertCompileErrorAt(project, use, { code: 2300 })).toThrowError(
    HarnessAssertionError,
  );
  // The clean-compile assertion T6.5-9 rides diagnoses the state instead of
  // passing.
  expect(() => assertNoCompileErrors(project)).toThrowError(
    HarnessAssertionError,
  );
  expect(() => assertNoCompileErrors(project)).toThrowError(/TS2300/);
});

test("S-4 control: the fixture's clean files compile with zero errors", async () => {
  const project = await loadFixtureProject(["greeting.ts", "main.ts"]);
  assertNoCompileErrors(project, "s4-tooling clean subset");
  expect(project.errors()).toEqual([]);
});

test("S-4: resolves the known definition location for the imported reference", async () => {
  const project = await loadFixtureProject(["greeting.ts", "main.ts"]);
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
  const project = await loadFixtureProject(["greeting.ts", "main.ts"]);
  const reference = project.locate("main.ts", 'greet("world")');
  const hover = project.hoverAt(reference);
  expect(hover).toBeDefined();
  expect(hover!.display).toContain("greet(name: string): string");
  expect(hover!.documentation).toBe("Builds the standard greeting for a name.");
  // The hovered span is the referenced identifier itself.
  expect(hover!.start.offset).toBe(reference.offset);
  expect(hover!.length).toBe("greet".length);
});

test("compiles, emits, and runs a consumer under plain Node with no runtime dependencies (SPEC 13.1)", async () => {
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
  // Standard tooling only: nothing was installed into the consumer workspace
  // — the compiled program's imports are satisfied by its own files alone.
  expect(await workspace.readdirNames()).toEqual([
    "main.js",
    "main.ts",
    "package.json",
    "util.js",
    "util.ts",
  ]);
  const result = await runConsumer({
    dir: workspace.root,
    entry: "main.js",
    argv: ["extra"],
  });
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("double:6 argv:extra\n");
  expect(result.stderr).toBe("");
});

test("captures a consumer program's failure exit code and stderr", async () => {
  const workspace = await makeWorkspace({
    files: {
      "package.json": '{ "type": "module" }\n',
      "fail.ts":
        'process.stderr.write("consumer-failure-marker\\n");\nprocess.exit(3);\n',
    },
  });
  const project = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles: ["fail.ts"],
  });
  assertNoCompileErrors(project, "failing consumer");
  project.emit();
  const result = await runConsumer({ dir: workspace.root, entry: "fail.js" });
  expect(result.exitCode).toBe(3);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("consumer-failure-marker\n");
});

test("an unresolvable import is a diagnosed compile error at the specifier (H-8 red path)", async () => {
  const workspace = await makeWorkspace({
    files: {
      "package.json": '{ "type": "module" }\n',
      "main.ts":
        'import { nope } from "./nope.js";\n\nexport const value = nope;\n',
    },
  });
  const project = await ConsumerProject.load({
    rootDir: workspace.root,
    rootFiles: ["main.ts"],
  });
  const specifier = project.locate("main.ts", '"./nope.js"');
  const diagnostic = assertCompileErrorAt(project, specifier, { code: 2307 });
  expect(diagnostic.file).toBe("main.ts");
  // The clean-compile assertion diagnoses the same state instead of passing.
  expect(() => assertNoCompileErrors(project)).toThrowError(
    HarnessAssertionError,
  );
  expect(() => assertNoCompileErrors(project)).toThrowError(/TS2307/);
  // And a location/code that does not match is a diagnosed failure, not a
  // silent pass.
  expect(() =>
    assertCompileErrorAt(project, specifier, { code: 9999 }),
  ).toThrowError(HarnessAssertionError);
});

test("marker addressing is loud: unknown and ambiguous markers fail, indexing disambiguates", async () => {
  const project = await loadFixtureProject(["greeting.ts", "main.ts"]);
  expect(() => project.locate("main.ts", "no-such-marker")).toThrowError(
    /no-such-marker/,
  );
  expect(() => project.locate("main.ts", "greet")).toThrowError(/ambiguous/);
  const first = project.locate("main.ts", "greet", { index: 0 });
  const second = project.locate("main.ts", "greet", { index: 1 });
  expect(second.offset).toBeGreaterThan(first.offset);
});

test("loading a project with a missing root file fails diagnosed", async () => {
  await expect(
    ConsumerProject.load({ rootDir: fixtureRoot, rootFiles: ["absent.ts"] }),
  ).rejects.toThrowError(/absent\.ts/);
});

// This test builds two TypeScript programs (the declaration-map emit and the
// consumer project), the file's heaviest CPU work: under the self project's
// full parallel load — certification runs spawn many fixture subprocesses —
// Vitest's default 5 s budget is intermittently exceeded. The explicit budget
// is a hang guard only, never an assertion input (H-10).
const DECLARATION_MAP_TEST_TIMEOUT_MS = 60_000;

test(
  "S-4: source definitions map through a declaration map into a non-TypeScript original (SPEC.md 4.2, 13.1)",
  { timeout: DECLARATION_MAP_TEST_TIMEOUT_MS },
  async () => {
    // SPEC.md 13.1 lets a product ship companion files so editor
    // go-to-definition resolves into the source `.mdx`; the standard-tooling
    // mechanism is a `.d.ts` with a declaration map whose `sources` names the
    // original. Raw `getDefinitionAtPosition` never applies that mapping (it
    // can only land in program files) — tsserver does, via the language
    // service's internal source mapper — so `sourceDefinitionsAt` must (a)
    // reach the internal mapper at runtime and (b) map a declaration-mapped
    // target into the named original, or section 4.2's navigation assertions
    // could never be satisfied by any product. This pins both, against a
    // declaration map generated by the pinned TypeScript itself.
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
    // Emit out/orig.d.ts + out/orig.d.ts.map from gen/orig.ts, then point the
    // map's `sources` at doc.mdx — exactly the companion-file arrangement a
    // product would generate.
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
    });
    assertNoCompileErrors(project, "declaration-map fixture consumer");
    const reference = project.locate("main.ts", "ROOT.alpha;", {
      charOffset: "ROOT.".length,
    });

    // Raw targets stay in the declaring .d.ts: the mapping is a distinct step.
    const raw = project.definitionsAt(reference);
    expect(raw).toHaveLength(1);
    expect(raw[0]!.file).toBe("out/orig.d.ts");

    // Mapped targets land in the named original, at the exact mapped position
    // (the property name in doc.mdx — same layout as the compiled source).
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
  },
);

test("hover and definitions at an inert position report nothing (tests then fail diagnosed, not crash)", async () => {
  const project = await loadFixtureProject(["greeting.ts", "main.ts"]);
  // The blank between `import` and its clause carries no symbol.
  const blank = project.locate("main.ts", "import { greet }", {
    charOffset: "import".length,
  });
  expect(project.hoverAt(blank)).toBeUndefined();
  expect(project.definitionsAt(blank)).toEqual([]);
});
