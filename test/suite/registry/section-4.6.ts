// TEST-SPEC §4.6 (code locations and attribution) — SUITE-16: T4.6-1 … T4.6-4.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes reports through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8). Files
// under `src/` are discovered code-group sources (SPEC 7.2), so `build`
// analyzes their spec-module usage and `query edges` exposes the recorded
// edges with their attributed source locations (SPEC 4.6, 11).
//
// Attribution is observed through edge sources: each staged reference targets
// a placement-dedicated spec section — or, in T4.6-3's one-file arms, is its
// file's only reference — so the workspace's complete per-kind edge set —
// asserted with `query edges --kinds` — pins every placement's attributed
// unit exactly, and any extra, missing, or misattributed edge (e.g. one
// sourced at a `#`-named unit, T4.6-3) fails the set equality.
//
// Conservative operationalizations (noted per H-4 — wording is free, so only
// the stated observables are asserted):
// - T4.6-1 "markers' `references` edges and `text(...)` calls' `embeds`
//   edges attribute to the same innermost enclosing named unit": both
//   expected edge sets are built from one placement table — each placement
//   stages its marker and its `text(...)` call in the same syntactic
//   position, targeting the same section — so the two set-equality
//   assertions accept only a product attributing both forms to the table's
//   one unit per placement.
// - T4.6-1 constructor, legacy `module`, and decorated arms: the constructor
//   is a member of the matrix's class (`Service.constructor`); `module
//   legacy` and `module P.Q` are staged beside `namespace ns` and `namespace
//   A.B` under fresh names, so each chain occurs once (no `@N`); `dec` is a
//   plain function declared in the file (itself a unit, `path#dec`,
//   recording no edge). Only attribution is observed here — the decorated
//   declarations' ranges are T1.7-2's.
// - T4.6-1 `using` and `await using` arms: staged under the names TEST-SPEC
//   spells (`using f` at top level, `await using h` inside an async function
//   `g`), each initialized with an arrow function holding the placement's
//   marker and `text(...)` call; the module-scope `f` and the
//   namespace-scoped `A.B.f` are distinct chains, so neither takes an `@N`
//   suffix. The file
//   stays accepted by TypeScript 5.9.3 both as module code and as script
//   code (14.20), which the workspace builder's staging-time judge confirms
//   (S-9). Their ranges are T1.7-2's.
// - T4.6-3 "value-side boundary … never to a unit named `s` (asserted via
//   `query edges`)": the two value-side `text(...)` calls target dedicated
//   sections, so the workspace's complete `embeds` edge set (`--kinds
//   embeds`) pins each call's attributed unit — `path#f` and `path` —
//   exactly; additionally every endpoint of the unfiltered `query edges`
//   answer is swept for a unit chain spelled after either constant (`#s`,
//   `#t`, the nested `#f.s`, and their `@N`-suffixed forms), so a product
//   that made a plain-identifier constant a named unit fails on the whole
//   answer, not only on the `embeds` set.
// - T4.6-3 "binds no unit" (wrappers, default exports of non-constructs,
//   body-less and `declare` declarations, the escape-spelled name, the
//   declaration files): `query nodes` lists requirement nodes only (SPEC
//   11.1), so a unit's non-existence is observed through attribution —
//   every marker targets a dedicated section (a one-file arm's marker is its
//   file's only reference), so the complete `references` set pins the file
//   (or the enclosing named unit) as its source, and the unfiltered endpoint
//   sweep additionally rejects any identity spelled after a forbidden name
//   (`#w1`, `#default`, `#foo`, a `.d.ts` file's `#f`) or `@N`-suffixed in
//   the body-less file, and any unit of a one-file arm's file or of a
//   declaration-file control but the one its marker attributes to. The
//   escape spelling is composed from the backslash's code point
//   (`BACKSLASH`), never written as a six-character sequence in this source
//   (the tool-parameter layer would decode it), and the fixture is
//   byte-checked for it.
// - T4.6-3 "attribution asserted via `query edges` and the occurrence's
//   `source` range (T1.7-2)" (the object-literal members, the named
//   expressions, and the default-export wrappers; and, beside them, the
//   `declare namespace` pair, the declaration files, and their controls):
//   each one-file arm is a file of its own holding one marker spelled as
//   TEST-SPEC spells it, so its edge pins the attributed unit, and its
//   occurrence record pins that unit's own range (SPEC 1.7) against offsets
//   composed from the file's string parts and sliced back out of the staged
//   bytes before the body's first invocation (T1.7-2's discipline). In the
//   first workspace the unfiltered `occurrences` answer is narrowed to the
//   one-file arms' files — the other files' ranges are no T4.6-3 arm's — and
//   in the declaration-file workspace the complete enumeration is pinned.
//   TEST-SPEC names no range for the namespace pair or the controls; theirs
//   are the ones SPEC 1.7 fixes for the unit each arm asserts — the
//   non-ambient `namespace N { SPEC.a }`, and a control's `f` declaration.
// - T4.6-4 "coverage boundary membership": SPEC 8 covers a target when a
//   permitted path exists from a boundary node to it, and 8.2 reports one
//   shortest covering path as a node-identity sequence (12.0) — from the
//   boundary node to the target, so in `direct` mode (single edge) the path
//   is exactly [boundary unit, target]. With each target reached by exactly
//   one edge, every reported path is forced; the `@2` units must appear as
//   the boundary members of their targets' paths.

import { Buffer } from "node:buffer";
import type {
  GraphEdge,
  OccurrenceRecord,
  OccurrenceSourceNode,
  SourceRange,
} from "../../helpers/adapters/index.js";
import {
  decodeCoverageReport,
  decodeEdgesReport,
  decodeOccurrencesReport,
} from "../../helpers/adapters/index.js";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { defineProductTest } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs, tsGrammarOf } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertEdgeSetEqual,
  assertSameJson,
  buildOk,
  expectFindingFreeReport,
  runJson,
} from "./support.js";

// One spec group plus one code group (SPEC 7.2): TypeScript files under
// `src/` are discovered code sources, so `build` analyzes their spec-module
// usage (4, 4.5, 4.6).
const SPEC_AND_CODE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  config: string | StagedTs,
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": config, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/** Workspace-wide `query edges --kinds <kind>`, decoded (SPEC 11). */
async function queryEdgesOfKind(
  product: ProductBinding,
  workspace: TestWorkspace,
  kind: string,
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges --kinds ${kind}\``;
  return decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--kinds", kind],
      label,
    ),
    label,
  );
}

/** `query edges --from <graph-node>`, decoded (SPEC 11). */
async function queryEdgesFrom(
  product: ProductBinding,
  workspace: TestWorkspace,
  from: string,
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges --from ${from}\``;
  return decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--from", from],
      label,
    ),
    label,
  );
}

/** Unfiltered workspace-wide `query edges` — every kind, decoded (SPEC 11.1). */
async function queryAllEdges(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context} \`query edges\``;
  return decodeEdgesReport(
    await runJson(product, workspace, ["query", "edges"], label),
    label,
  );
}

// ---------------------------------------------------------------------------
// T4.6-1 — the attribution matrix over all named-unit forms
// ---------------------------------------------------------------------------

/** Which of the two reference forms a placement stages. */
type PlacementForms = "both" | "marker-only" | "text-only";

/** One syntactic placement of the T4.6-1 matrix. */
interface AttributionPlacement {
  /** The TEST-SPEC arm (diagnostics only). */
  readonly name: string;
  /** The expected attributed code location — the edges' `from` (SPEC 4.6). */
  readonly unit: string;
  /** The placement's dedicated target section in `specs/U.mdx`. */
  readonly target: string;
  readonly forms: PlacementForms;
}

// The placement table drives the spec document and both expected edge sets;
// the fixture sources below stage, per placement, the marker `SPEC.<target>;`
// and/or the call `text(SPEC.<target>);` in the placement's syntactic
// position (consistency enforced at module load, below). The class `static`
// block arm is marker-only and the plain non-function property initializer
// arm is text-only, exactly as TEST-SPEC words them — an initializer is no
// statement position, so no marker can be staged there (SPEC 4.5).
const T4_6_1_PLACEMENTS: readonly AttributionPlacement[] = [
  {
    name: "file top level (attributed to the file)",
    unit: "src/app.ts",
    target: "file",
    forms: "both",
  },
  {
    name: "inside a function declaration",
    unit: "src/app.ts#fnDecl",
    target: "fndecl",
    forms: "both",
  },
  {
    name: "in a class static block (binds no name — bare class unit)",
    unit: "src/app.ts#Service",
    target: "staticblock",
    forms: "marker-only",
  },
  {
    name: "in a plain non-function property initializer (bare class unit)",
    unit: "src/app.ts#Service",
    target: "plainprop",
    forms: "text-only",
  },
  {
    name: "inside a constructor (a unit named `constructor`: `Service.constructor`)",
    unit: "src/app.ts#Service.constructor",
    target: "ctor",
    forms: "both",
  },
  {
    name: "a class member property initialized with an arrow function",
    unit: "src/app.ts#Service.arrowProp",
    target: "arrowprop",
    forms: "both",
  },
  {
    name: "a class member property initialized with a function expression",
    unit: "src/app.ts#Service.fnProp",
    target: "fnprop",
    forms: "both",
  },
  {
    name:
      "a class member property initialized with a class expression (staged " +
      "in the class expression's static block, which binds no name)",
    unit: "src/app.ts#Service.classProp",
    target: "classprop",
    forms: "both",
  },
  {
    name: "a class method (nested chain Class.method)",
    unit: "src/app.ts#Service.method",
    target: "method",
    forms: "both",
  },
  {
    name: "a getter",
    unit: "src/app.ts#Service.reader",
    target: "getter",
    forms: "both",
  },
  {
    name: "a setter",
    unit: "src/app.ts#Service.writer",
    target: "setter",
    forms: "both",
  },
  {
    name: "a variable declaration initialized with an arrow function",
    unit: "src/app.ts#varArrow",
    target: "vararrow",
    forms: "both",
  },
  {
    name: "a variable declaration initialized with a function expression",
    unit: "src/app.ts#varFn",
    target: "varfn",
    forms: "both",
  },
  {
    name:
      "a variable declaration initialized with a class expression (staged " +
      "in the class expression's static block)",
    unit: "src/app.ts#VarClass",
    target: "varclass",
    forms: "both",
  },
  {
    name:
      "a `using` declaration initialized with an arrow function, at top " +
      "level (`using f = () => { ... }` — SPEC 4.6 counts it as a variable " +
      "declaration)",
    unit: "src/app.ts#f",
    target: "usingdecl",
    forms: "both",
  },
  {
    name:
      "an `await using` declaration initialized with an arrow function " +
      "inside an async function `g` (`await using h = () => { ... }` — a " +
      "variable declaration too; nested chain g.h)",
    unit: "src/app.ts#g.h",
    target: "awaitusing",
    forms: "both",
  },
  {
    name: "directly inside a namespace",
    unit: "src/app.ts#ns",
    target: "ns",
    forms: "both",
  },
  {
    name: "inside a function declared in a namespace (nested chain ns.fn)",
    unit: "src/app.ts#ns.fn",
    target: "nsfn",
    forms: "both",
  },
  {
    name:
      "directly inside a dotted namespace (namespace A.B declares one unit " +
      "per dot-separated name)",
    unit: "src/app.ts#A.B",
    target: "dotted",
    forms: "both",
  },
  {
    name: "inside a function declared in a dotted namespace (A.B.f)",
    unit: "src/app.ts#A.B.f",
    target: "dottedfn",
    forms: "both",
  },
  {
    name:
      "directly inside a legacy `module X` namespace (the same declaration " +
      "as `namespace X`: the unit named exactly as `namespace X` derives)",
    unit: "src/app.ts#legacy",
    target: "legacy",
    forms: "both",
  },
  {
    name:
      "directly inside a legacy dotted `module P.Q` (as `namespace P.Q`: one " +
      "unit per dot-separated name)",
    unit: "src/app.ts#P.Q",
    target: "legacydotted",
    forms: "both",
  },
  {
    name:
      "inside a decorated method of a decorated class (`@dec class Deco { " +
      "@dec m() { ... } }`, `dec` declared in the file)",
    unit: "src/app.ts#Deco.m",
    target: "decomethod",
    forms: "both",
  },
  {
    name: "in a decorated class's static block (bare class unit)",
    unit: "src/app.ts#Deco",
    target: "decostatic",
    forms: "marker-only",
  },
  {
    name:
      "inside a method of an exported decorated class (`export @dec class " +
      "DecoExport { m() { ... } }`)",
    unit: "src/app.ts#DecoExport.m",
    target: "expdeco",
    forms: "both",
  },
  {
    name: "inside a named default export",
    unit: "src/named.ts#namedDefault",
    target: "nameddefault",
    forms: "both",
  },
];

// One flat leaf section per placement (SPEC 1.3: a top-level section's ID is
// exactly one segment), generated from the table so targets never drift.
const T4_6_1_SPEC_SOURCE = T4_6_1_PLACEMENTS.map(
  (placement) =>
    `<S id="${placement.target}">\n` +
    `Target for the ${placement.target} placement.\n` +
    `</S>\n`,
).join("\n");

const T4_6_1_APP_SOURCE = [
  'import SPEC, { text } from "../specs/U.xspec";',
  "",
  "SPEC.file;",
  "text(SPEC.file);",
  "",
  "function fnDecl(): void {",
  "  SPEC.fndecl;",
  "  text(SPEC.fndecl);",
  "}",
  "",
  "class Service {",
  "  static {",
  "    SPEC.staticblock;",
  "  }",
  "",
  "  constructor() {",
  "    SPEC.ctor;",
  "    text(SPEC.ctor);",
  "  }",
  "",
  "  plainProp = text(SPEC.plainprop);",
  "",
  "  arrowProp = () => {",
  "    SPEC.arrowprop;",
  "    text(SPEC.arrowprop);",
  "  };",
  "",
  "  fnProp = function () {",
  "    SPEC.fnprop;",
  "    text(SPEC.fnprop);",
  "  };",
  "",
  "  classProp = class {",
  "    static {",
  "      SPEC.classprop;",
  "      text(SPEC.classprop);",
  "    }",
  "  };",
  "",
  "  method(): void {",
  "    SPEC.method;",
  "    text(SPEC.method);",
  "  }",
  "",
  "  get reader(): string {",
  "    SPEC.getter;",
  "    text(SPEC.getter);",
  '    return "reader";',
  "  }",
  "",
  "  set writer(value: string) {",
  "    SPEC.setter;",
  "    text(SPEC.setter);",
  "    void value;",
  "  }",
  "}",
  "",
  "const varArrow = () => {",
  "  SPEC.vararrow;",
  "  text(SPEC.vararrow);",
  "};",
  "",
  "const varFn = function (): void {",
  "  SPEC.varfn;",
  "  text(SPEC.varfn);",
  "};",
  "",
  "const VarClass = class {",
  "  static {",
  "    SPEC.varclass;",
  "    text(SPEC.varclass);",
  "  }",
  "};",
  "",
  "using f = () => {",
  "  SPEC.usingdecl;",
  "  text(SPEC.usingdecl);",
  "};",
  "",
  "async function g(): Promise<void> {",
  "  await using h = () => {",
  "    SPEC.awaitusing;",
  "    text(SPEC.awaitusing);",
  "  };",
  "}",
  "",
  "namespace ns {",
  "  SPEC.ns;",
  "  text(SPEC.ns);",
  "",
  "  export function fn(): void {",
  "    SPEC.nsfn;",
  "    text(SPEC.nsfn);",
  "  }",
  "}",
  "",
  "namespace A.B {",
  "  SPEC.dotted;",
  "  text(SPEC.dotted);",
  "",
  "  export function f(): void {",
  "    SPEC.dottedfn;",
  "    text(SPEC.dottedfn);",
  "  }",
  "}",
  "",
  "module legacy {",
  "  SPEC.legacy;",
  "  text(SPEC.legacy);",
  "}",
  "",
  "module P.Q {",
  "  SPEC.legacydotted;",
  "  text(SPEC.legacydotted);",
  "}",
  "",
  "function dec(_value: unknown, _context: unknown): void {}",
  "",
  "@dec class Deco {",
  "  static {",
  "    SPEC.decostatic;",
  "  }",
  "",
  "  @dec m(): void {",
  "    SPEC.decomethod;",
  "    text(SPEC.decomethod);",
  "  }",
  "}",
  "",
  "export @dec class DecoExport {",
  "  m(): void {",
  "    SPEC.expdeco;",
  "    text(SPEC.expdeco);",
  "  }",
  "}",
  "",
].join("\n");

// A file holds at most one default export, so the named-default arm lives in
// its own discovered code file.
const T4_6_1_NAMED_SOURCE = [
  'import SPEC, { text } from "../specs/U.xspec";',
  "",
  "export default function namedDefault(): void {",
  "  SPEC.nameddefault;",
  "  text(SPEC.nameddefault);",
  "}",
  "",
].join("\n");

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

// Module-load consistency guard (a harness defect, never a product failure):
// each placement's staged forms in the hand-written sources must match its
// table row — the marker statement `SPEC.<target>;` and the call
// `text(SPEC.<target>);` each exactly once when staged, never otherwise. The
// trailing `;` / `);` keeps needles from matching longer target names or the
// other form.
{
  const staged = T4_6_1_APP_SOURCE + T4_6_1_NAMED_SOURCE;
  for (const placement of T4_6_1_PLACEMENTS) {
    const markers = countOccurrences(staged, `SPEC.${placement.target};`);
    const texts = countOccurrences(staged, `text(SPEC.${placement.target});`);
    const expectMarker = placement.forms !== "text-only" ? 1 : 0;
    const expectText = placement.forms !== "marker-only" ? 1 : 0;
    if (markers !== expectMarker || texts !== expectText) {
      throw new Error(
        `T4.6-1 fixture broke: placement "${placement.name}" ` +
          `(target ${placement.target}, forms ${placement.forms}) staged ` +
          `${String(markers)} marker(s) and ${String(texts)} text call(s) — ` +
          `fix the placement table or the sources in section-4.6.ts`,
      );
    }
  }
}

const T4_6_1_EXPECTED_REFERENCES: readonly GraphEdge[] =
  T4_6_1_PLACEMENTS.filter((placement) => placement.forms !== "text-only").map(
    (placement): GraphEdge => ({
      from: placement.unit,
      to: `specs/U.mdx#${placement.target}`,
      kind: "references",
    }),
  );

const T4_6_1_EXPECTED_EMBEDS: readonly GraphEdge[] = T4_6_1_PLACEMENTS.filter(
  (placement) => placement.forms !== "marker-only",
).map((placement): GraphEdge => ({
  from: placement.unit,
  to: `specs/U.mdx#${placement.target}`,
  kind: "embeds",
}));

const T4_6_1 = defineProductTest({
  id: "T4.6-1",
  title:
    "markers and `text(...)` calls attribute to the innermost enclosing named unit — file top level to the file; function declarations, class methods, a constructor (`Service.constructor`, a unit named `constructor`), getters, setters, function-, arrow-, and class-valued class properties and variables, `using` and `await using` declarations initialized with an arrow function (variable declarations: `using f` at top level to `f`, `await using h` in an async function `g` to `g.h`), namespaces — `namespace X` and the legacy `module X`, the same declaration — and a named default export to `path#unit` with the dot-joined chain outermost first (`Service.method`, `ns.fn`); a class static block and a plain non-function property initializer to the bare class unit; `namespace A.B` and the legacy `module P.Q` each declare one unit per dot-separated name; decorated declarations are units like undecorated ones (`dec` declared in the file: `@dec class Deco { @dec m() { ... } }` to `Deco.m`, its static block to the bare `Deco`, `export @dec class DecoExport { m() { ... } }` to `DecoExport.m`) — with each placement's `references` and `embeds` edges sourced at the same unit (SPEC 4.6, 4.5, 4.3)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        "specs/U.mdx": T4_6_1_SPEC_SOURCE,
        "src/app.ts": T4_6_1_APP_SOURCE,
        "src/named.ts": T4_6_1_NAMED_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.6-1 `build` over the attribution-matrix workspace (every " +
            "staged use is sanctioned, SPEC 4.5)",
        );
        // The complete per-kind edge sets: every placement's edge originates
        // at exactly the table's unit, and nothing else records edges — a
        // misattributed, extra, or missing edge fails the set equality. Both
        // expected sets carry the same `from` per placement, so passing both
        // assertions is passing the same-innermost-unit clause (SPEC 4.6).
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", "T4.6-1"),
          T4_6_1_EXPECTED_REFERENCES,
          "T4.6-1 every marker's `references` edge is sourced at the " +
            "innermost enclosing named unit — the file at top level, the " +
            "dot-joined chain outermost first inside named units, the bare " +
            "class unit from its static block (SPEC 4.6, 4.5)",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "embeds", "T4.6-1"),
          T4_6_1_EXPECTED_EMBEDS,
          "T4.6-1 every `text(...)` call's `embeds` edge is sourced at the " +
            "same innermost enclosing named unit as the placement's marker; " +
            "the plain non-function property initializer attributes to the " +
            "bare class unit — such a property is not a named unit " +
            "(SPEC 4.6, 4.3)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.6-2 — anonymous default export: the unit is named `default`
// ---------------------------------------------------------------------------

const T4_6_2_SPEC_SOURCE =
  '<S id="anon">\nTarget for the anonymous default placement.\n</S>\n';

const T4_6_2_APP_SOURCE = [
  'import SPEC from "../specs/U.xspec";',
  "",
  "export default function (): void {",
  "  SPEC.anon;",
  "}",
  "",
].join("\n");

const T4_6_2 = defineProductTest({
  id: "T4.6-2",
  title:
    "a marker inside an anonymous default-exported function is attributed to `path#default` — a default export's unit name is `default` when the exported construct is anonymous (SPEC 4.6)",
  run: async (product) => {
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        "specs/U.mdx": T4_6_2_SPEC_SOURCE,
        "src/anon.ts": T4_6_2_APP_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.6-2 `build` over the anonymous-default workspace",
        );
        const expected: readonly GraphEdge[] = [
          {
            from: "src/anon.ts#default",
            to: "specs/U.mdx#anon",
            kind: "references",
          },
        ];
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", "T4.6-2"),
          expected,
          "T4.6-2 the marker inside the anonymous default-exported " +
            "function is attributed to `path#default`, and nothing else " +
            "records a `references` edge (SPEC 4.6)",
        );
        // The `default` unit is an addressable graph node (SPEC 11).
        assertEdgeSetEqual(
          await queryEdgesFrom(
            product,
            workspace,
            "src/anon.ts#default",
            "T4.6-2",
          ),
          expected,
          "T4.6-2 `src/anon.ts#default` addresses the anonymous default " +
            "export's unit, whose complete edge set is the marker's edge " +
            "(SPEC 4.6, 11)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.6-3 — not named units: nearest enclosing named unit or the file
// ---------------------------------------------------------------------------

// Every construct here fails to statically bind a plain identifier
// (SPEC 4.6): an IIFE (twice — once at top level, once inside a named
// function, so both fallback outcomes are exercised), a function stored via a
// destructuring binding, and computed-, string-literal-, numeric-literal-,
// and private-named members of class `Carrier`. Each marker targets its own
// section, so the complete `references` edge set pins each arm's attribution
// — in particular, an edge sourced at a `#`-named unit such as
// `src/app.ts#Carrier.#priv` fails the equality.
//
// Value-side boundary (SPEC 4.6: a variable declaration is a named unit only
// when its initializer is a function expression, an arrow function, or a
// class expression): `const s = text(SPEC.valfn)` inside `f` and
// `const t = text(SPEC.valtop)` at top level bind the calls' returned
// strings — no node and no `text` binding is stored, so 4.5 is untouched and
// `build` succeeds — and each call's `embeds` edge (4.3, from the calling
// code location) attributes to the innermost enclosing named unit,
// `src/app.ts#f`, or to the file, never to a unit named after the constant.
const T4_6_3_SPEC_SOURCE = [
  '<S id="iife">',
  "Target for the top-level IIFE placement.",
  "</S>",
  "",
  '<S id="hosted">',
  "Target for the IIFE nested in a named function.",
  "</S>",
  "",
  '<S id="destr">',
  "Target for the destructuring-stored function.",
  "</S>",
  "",
  '<S id="computed">',
  "Target for the computed-name class member.",
  "</S>",
  "",
  '<S id="strname">',
  "Target for the string-literal-name class member.",
  "</S>",
  "",
  '<S id="numname">',
  "Target for the numeric-literal-name class member.",
  "</S>",
  "",
  '<S id="priv">',
  "Target for the private-name class member.",
  "</S>",
  "",
  '<S id="valfn">',
  "Target for the value-side text call inside a named function.",
  "</S>",
  "",
  '<S id="valtop">',
  "Target for the value-side text call at file top level.",
  "</S>",
  "",
  '<S id="wrapparen">',
  "Target for the parenthesized arrow initializer.",
  "</S>",
  "",
  '<S id="wrapas">',
  "Target for the as-cast arrow initializer.",
  "</S>",
  "",
  '<S id="wrapsat">',
  "Target for the satisfies-qualified function-expression initializer.",
  "</S>",
  "",
  '<S id="wrapnn">',
  "Target for the non-null-asserted arrow initializer.",
  "</S>",
  "",
  '<S id="wraphosted">',
  "Target for the wrapped initializer inside a named function.",
  "</S>",
  "",
  '<S id="dobj">',
  "Target for the arrow held by a default-exported object literal.",
  "</S>",
  "",
  '<S id="dident">',
  "Target for the arrow-valued variable exported by identifier.",
  "</S>",
  "",
  '<S id="dcall">',
  "Target for the arrow argument of a default-exported call.",
  "</S>",
  "",
  '<S id="dlit">',
  "Target for the top-level marker beside a default-exported literal.",
  "</S>",
  "",
  '<S id="overload">',
  "Target for the function implementation behind two overloads.",
  "</S>",
  "",
  '<S id="methodoverload">',
  "Target for the method implementation behind two overloads.",
  "</S>",
  "",
  '<S id="abstractgetter">',
  "Target for the getter behind a sibling class's abstract getter.",
  "</S>",
  "",
  '<S id="ambient">',
  "Target for the method behind a declare class's body-less method.",
  "</S>",
  "",
  '<S id="escaped">',
  "Target for the function whose name is spelled with an escape.",
  "</S>",
  "",
].join("\n");

const T4_6_3_APP_SOURCE = [
  'import SPEC, { text } from "../specs/N.xspec";',
  "",
  "(function () {",
  "  SPEC.iife;",
  "})();",
  "",
  "function host(): void {",
  "  (() => {",
  "    SPEC.hosted;",
  "  })();",
  "}",
  "",
  "const { helper } = {",
  "  helper: () => {",
  "    SPEC.destr;",
  "  },",
  "};",
  "",
  'const memberKey = "computedMember";',
  "",
  "class Carrier {",
  "  [memberKey]() {",
  "    SPEC.computed;",
  "  }",
  "",
  '  "string name"() {',
  "    SPEC.strname;",
  "  }",
  "",
  "  123() {",
  "    SPEC.numname;",
  "  }",
  "",
  "  #priv(): void {",
  "    SPEC.priv;",
  "  }",
  "}",
  "",
  "function f(): void {",
  "  const s = text(SPEC.valfn);",
  "}",
  "",
  "const t = text(SPEC.valtop);",
  "",
].join("\n");

// Wrappers and value forms (SPEC 4.6: an initializer that merely wraps a
// named form — parenthesized, `as`-cast, `satisfies`-qualified, or non-null-
// asserted — is another expression and binds no unit): four top-level
// constants whose markers attribute to the file, and one inside `wrapHost`
// whose marker attributes to that enclosing named unit — never to `#w1` …
// `#w5`.
const T4_6_3_WRAP_SOURCE = [
  'import SPEC from "../specs/N.xspec";',
  "",
  "const w1 = (() => {",
  "  SPEC.wrapparen;",
  "});",
  "",
  "const w2 = ((): void => {",
  "  SPEC.wrapas;",
  "}) as () => void;",
  "",
  "const w3 = (function () {",
  "  SPEC.wrapsat;",
  "}) satisfies () => void;",
  "",
  "const w4 = (() => {",
  "  SPEC.wrapnn;",
  "})!;",
  "",
  "function wrapHost(): void {",
  "  const w5 = ((): void => {",
  "    SPEC.wraphosted;",
  "  }) as () => void;",
  "}",
  "",
].join("\n");

// Default exports of an object literal, an identifier, a call, and a literal
// value bind no unit (SPEC 4.6) — a file holds at most one default export, so
// each form has its own file. The marker inside the arrow held by the object
// literal's property attributes to the file (an object-literal property is no
// class member); the arrow argument of the exported call is anonymous and
// nothing named encloses it — the file; the identifier form's marker sits in
// the arrow-valued variable `impl`, a named unit in its own right, so the
// export adds no `default` unit above or beside it; the literal form can hold
// no marker, so its file carries a top-level one. A product making any of
// these a `default` unit sources an edge at `path#default`, failing the set.
const T4_6_3_DEFAULT_OBJECT_SOURCE = [
  'import SPEC from "../specs/N.xspec";',
  "",
  "export default {",
  "  run: () => {",
  "    SPEC.dobj;",
  "  },",
  "};",
  "",
].join("\n");

const T4_6_3_DEFAULT_IDENTIFIER_SOURCE = [
  'import SPEC from "../specs/N.xspec";',
  "",
  "const impl = (): void => {",
  "  SPEC.dident;",
  "};",
  "",
  "export default impl;",
  "",
].join("\n");

const T4_6_3_DEFAULT_CALL_SOURCE = [
  'import SPEC from "../specs/N.xspec";',
  "",
  "function wrap(fn: () => void): () => void {",
  "  return fn;",
  "}",
  "",
  "export default wrap(() => {",
  "  SPEC.dcall;",
  "});",
  "",
].join("\n");

const T4_6_3_DEFAULT_LITERAL_SOURCE = [
  'import SPEC from "../specs/N.xspec";',
  "",
  "SPEC.dlit;",
  "",
  "export default 42;",
  "",
].join("\n");

// Declarations binding no executable code — overload signatures, body-less
// method signatures, abstract members, and `declare` ambient declarations —
// are no units and occupy no document-order slot (SPEC 4.6): the function
// implementation behind two overloads is `#f`, never `#f@3`; the method
// implementation behind two overloads is `#M.m`; with two block-scoped
// classes `C` in sibling blocks, the first abstract with `abstract get v()`,
// the second's getter is `#C.v`, never `#C.v@2` (the chain `C.v` occurs once
// — the abstract getter takes no slot); and the method of the block-scoped
// class `Amb` behind a top-level `declare class Amb` with a body-less `m` is
// `#Amb.m`, never `#Amb.m@2`.
const T4_6_3_DECL_SOURCE = [
  'import SPEC from "../specs/N.xspec";',
  "",
  "function f(a: string): void;",
  "function f(a: number): void;",
  "function f(a: string | number): void {",
  "  SPEC.overload;",
  "  void a;",
  "}",
  "",
  "class M {",
  "  m(a: string): void;",
  "  m(a: number): void;",
  "  m(a: string | number): void {",
  "    SPEC.methodoverload;",
  "    void a;",
  "  }",
  "}",
  "",
  "{",
  "  abstract class C {",
  "    abstract get v(): number;",
  "  }",
  "}",
  "",
  "{",
  "  class C {",
  "    get v(): number {",
  "      SPEC.abstractgetter;",
  "      return 1;",
  "    }",
  "  }",
  "}",
  "",
  "declare class Amb {",
  "  m(): void;",
  "}",
  "",
  "{",
  "  class Amb {",
  "    m(): void {",
  "      SPEC.ambient;",
  "    }",
  "  }",
  "}",
  "",
].join("\n");

/** The backslash, built from its code point (see the module header). */
const BACKSLASH = String.fromCodePoint(0x5c);

/** The escape-spelled function name: `f`, the six-character escape of `o`, `o`. */
const T4_6_3_ESCAPED_NAME = `f${BACKSLASH}u006Fo`;

// A unit name spelled with an escape sequence binds no unit (SPEC 4.6, 2.4:
// read as spelled, never interpreted to `foo`), so the marker attributes to
// the file — never to `#foo`, nor to a unit spelled after the escape.
const T4_6_3_ESCAPED_SOURCE = [
  'import SPEC from "../specs/N.xspec";',
  "",
  `function ${T4_6_3_ESCAPED_NAME}(): void {`,
  "  SPEC.escaped;",
  "}",
  "",
].join("\n");

// --- T4.6-3's pinned occurrences: attribution with its `source` range ------

/** The byte length of a string's UTF-8 encoding (SPEC 1.7: byte offsets). */
function utf8Length(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** Byte range of `span` where it follows exactly `prefix` in a file. */
function rangeAfter(prefix: string, span: string): SourceRange {
  const start = utf8Length(prefix);
  return { start, end: start + utf8Length(span) };
}

/**
 * One expected marker occurrence of T4.6-3 with its fixture self-check data
 * (T1.7-2's discipline): the record — the attributed unit's identity
 * together with that unit's own source range (SPEC 5.7, 1.7) — is composed
 * from the very string parts its file is, never measured from product
 * output, and {@link assertPinnedSpans} slices both its ranges back out of
 * the staged bytes before the body's first product invocation.
 */
interface PinnedOccurrence {
  /** The arm (diagnostics). */
  readonly what: string;
  readonly file: string;
  /** The staged file's exact contents (the self-check's ground). */
  readonly fileSource: string;
  /** The exact characters the occurrence's own range slices to. */
  readonly occurrenceSpan: string;
  /** The exact characters the source unit's range slices to. */
  readonly unitSpan: string;
  readonly record: OccurrenceRecord & {
    readonly source: OccurrenceSourceNode;
  };
}

/** The parts one marker occurrence's pinned record is composed from. */
interface MarkerOccurrenceParts {
  readonly what: string;
  readonly file: string;
  readonly fileSource: string;
  /** The file's text before the marker. */
  readonly markerPrefix: string;
  /** The marker's bare chain — its occurrence's span (SPEC 5.7). */
  readonly marker: string;
  /** The resolved target's identity. */
  readonly target: string;
  /** The attributed location: the file itself, or `path#unit` (SPEC 4.6). */
  readonly unit: string;
  /**
   * For a named unit, the file's text before the construct binding its
   * name and that construct by its own characters (SPEC 1.7); absent for
   * the whole-file location, whose range is the entire file.
   */
  readonly construct?: { readonly prefix: string; readonly span: string };
}

/** Compose a marker occurrence's pinned record from its file's parts. */
function pinnedMarkerOccurrence(
  parts: MarkerOccurrenceParts,
): PinnedOccurrence {
  const unitSpan = parts.construct?.span ?? parts.fileSource;
  return {
    what: parts.what,
    file: parts.file,
    fileSource: parts.fileSource,
    occurrenceSpan: parts.marker,
    unitSpan,
    record: {
      file: parts.file,
      range: rangeAfter(parts.markerPrefix, parts.marker),
      kind: "references",
      source: {
        identity: parts.unit,
        range: rangeAfter(parts.construct?.prefix ?? "", unitSpan),
      },
      target: parts.target,
    },
  };
}

/**
 * Pinned occurrences in occurrence order (SPEC 5.7): by referencing file
 * path bytes, then range start.
 */
function inOccurrenceOrder(
  pinned: readonly PinnedOccurrence[],
): readonly PinnedOccurrence[] {
  return [...pinned].sort(
    (a, b) =>
      Buffer.compare(
        Buffer.from(a.file, "utf8"),
        Buffer.from(b.file, "utf8"),
      ) || a.record.range.start - b.record.range.start,
  );
}

/**
 * Fixture self-check (harness-side, before the body's first product
 * invocation): each pinned range slices the staged bytes to exactly the
 * span it claims — a plain `Error` otherwise, a staging-arithmetic defect of
 * this test (H-8), never a product failure.
 */
function assertPinnedSpans(pinned: readonly PinnedOccurrence[]): void {
  for (const occurrence of pinned) {
    const bytes = Buffer.from(occurrence.fileSource, "utf8");
    const claims: readonly [SourceRange, string, string][] = [
      [
        occurrence.record.range,
        occurrence.occurrenceSpan,
        "the occurrence's own range",
      ],
      [
        occurrence.record.source.range,
        occurrence.unitSpan,
        "the source unit's range",
      ],
    ];
    for (const [range, span, which] of claims) {
      const sliced = bytes.subarray(range.start, range.end).toString("utf8");
      if (sliced !== span) {
        throw new Error(
          `T4.6-3 fixture self-check — ${occurrence.what}, ${which}: ` +
            `[${String(range.start)}, ${String(range.end)}) slices the ` +
            `staged bytes to ${JSON.stringify(sliced)}, expected ` +
            `${JSON.stringify(span)} (a harness-side staging error, not a ` +
            `product failure)`,
        );
      }
    }
  }
}

/**
 * Assert an `occurrences` enumeration — complete, or narrowed to the files
 * holding the pinned occurrences — is exactly `pinned`, in occurrence order:
 * every record member compared before the verdict, so one run diagnoses
 * each deviating arm at once (T1.7-2's comparison).
 */
function assertPinnedOccurrences(
  actual: readonly OccurrenceRecord[],
  pinned: readonly PinnedOccurrence[],
  context: string,
): void {
  if (actual.length !== pinned.length) {
    fail(
      `${context}: expected exactly ${String(pinned.length)} occurrence ` +
        `records — one per staged marker; import declarations record none ` +
        `(SPEC 5.7) — got ${String(actual.length)}: ${JSON.stringify(actual)}`,
    );
  }
  const mismatches: string[] = [];
  pinned.forEach((occurrence, index) => {
    try {
      assertSameJson(
        actual[index],
        occurrence.record,
        `${context} record [${String(index)}] — ${occurrence.what}`,
      );
    } catch (error) {
      if (!(error instanceof HarnessAssertionError)) throw error;
      mismatches.push(error.message);
    }
  });
  if (mismatches.length > 0) {
    fail(
      `${context}: ${String(mismatches.length)} of ` +
        `${String(pinned.length)} occurrence records differ from the pinned ` +
        `ones:\n${mismatches.join("\n")}`,
    );
  }
}

// Object-literal members and named expressions (SPEC 4.6: a member binds a
// unit only as a class member, and a function or class expression binds
// none under its own name — only the declaration, class property, or
// default export holding it does), the default exports that merely wrap a
// named form (4.6: an exported expression is read by its own form, as an
// initializer is), and the `declare namespace` pair: each arm a file of its
// own holding exactly one reference — a marker spelled as TEST-SPEC spells
// it, into `specs/O.mdx`'s `a` … `e` — so the complete `references` set pins
// each file's attributed unit, and the file's one occurrence record pins
// that unit's `source` range (T1.7-2, SPEC 1.7, 5.7). The arms share
// targets, so their edges differ by source alone: a misattributed marker
// leaves its file's expected edge missing.
const T4_6_3_ONE_FILE_SPEC_SOURCE = ["a", "b", "c", "d", "e"]
  .flatMap((id) => [
    `<S id="${id}">`,
    `Target ${id} of the one-file arms.`,
    "</S>",
    "",
  ])
  .join("\n");

/** Every one-file arm opens with the import of `specs/O.mdx`. */
const T4_6_3_ONE_FILE_HEAD = 'import SPEC from "../specs/O.xspec";\n\n';

/** The marker TEST-SPEC spells in each one-file arm but the object members. */
const T4_6_3_ONE_FILE_MARKER = "SPEC.a";

/** The section of `specs/O.mdx` a one-file arm's marker `SPEC.<id>` targets. */
function oneFileTarget(marker: string): string {
  return `specs/O.mdx#${marker.slice("SPEC.".length)}`;
}

/** One object-literal member form, spelled exactly as TEST-SPEC spells it. */
interface ObjectMemberForm {
  /** The member's name — and its two arm files' name key. */
  readonly name: string;
  readonly what: string;
  /** The member's characters before its marker. */
  readonly pre: string;
  /** Its marker: `SPEC.a` … `SPEC.e`, one target per form. */
  readonly marker: string;
  /** The member's characters after its marker. */
  readonly post: string;
}

const T4_6_3_OBJECT_MEMBER_FORMS: readonly ObjectMemberForm[] = [
  {
    name: "m",
    what: "method shorthand",
    pre: "m() { ",
    marker: "SPEC.a",
    post: " }",
  },
  {
    name: "g",
    what: "getter",
    pre: "get g() { ",
    marker: "SPEC.b",
    post: "; return 1 }",
  },
  {
    name: "s",
    what: "setter",
    pre: "set s(v: number) { ",
    marker: "SPEC.c",
    post: " }",
  },
  {
    name: "p",
    what: "function-expression-valued property",
    pre: "p: function () { ",
    marker: "SPEC.d",
    post: " }",
  },
  {
    name: "q",
    what: "arrow-function-valued property",
    pre: "q: () => { ",
    marker: "SPEC.e",
    post: " }",
  },
];

// Each member form twice: the literal a top-level `const o`'s initializer
// (`src/olit-<name>.ts`), where no named unit encloses the marker — neither
// the member nor `o`, an object literal being no function or class
// expression — so it attributes to the file, `source` the entire file; and
// the same `const o` declared inside a function `f` (`src/olitf-<name>.ts`),
// attributing to `path#f`, `source` `f`'s declaration — never to a unit
// named for the member or for `o` (`path#m`, `path#o.m`, `path#f.q`, …).
const T4_6_3_OBJECT_LITERAL_ARMS: readonly PinnedOccurrence[] =
  T4_6_3_OBJECT_MEMBER_FORMS.flatMap((form): PinnedOccurrence[] => {
    const member = form.pre + form.marker + form.post;
    const topFile = `src/olit-${form.name}.ts`;
    const topLinePre = "const o = { ";
    const topSource = T4_6_3_ONE_FILE_HEAD + topLinePre + member + " }\n";
    const hostedFile = `src/olitf-${form.name}.ts`;
    const hostedDeclPre = "function f() {\n  const o = { ";
    const hostedDecl = hostedDeclPre + member + " }\n}";
    const hostedSource = T4_6_3_ONE_FILE_HEAD + hostedDecl + "\n";
    return [
      pinnedMarkerOccurrence({
        what:
          `the object literal's ${form.what} \`${member}\` in a top-level ` +
          "`const o` — the file, `source` the entire file",
        file: topFile,
        fileSource: topSource,
        markerPrefix: T4_6_3_ONE_FILE_HEAD + topLinePre + form.pre,
        marker: form.marker,
        target: oneFileTarget(form.marker),
        unit: topFile,
      }),
      pinnedMarkerOccurrence({
        what:
          `the object literal's ${form.what} \`${member}\` in \`const o\` ` +
          "inside function `f` — `path#f`, `source` `f`'s declaration",
        file: hostedFile,
        fileSource: hostedSource,
        markerPrefix: T4_6_3_ONE_FILE_HEAD + hostedDeclPre + form.pre,
        marker: form.marker,
        target: oneFileTarget(form.marker),
        unit: `${hostedFile}#f`,
        construct: { prefix: T4_6_3_ONE_FILE_HEAD, span: hostedDecl },
      }),
    ];
  });

// `const f = function g() { SPEC.a }`: the variable declaration binds `f`
// (its initializer a function expression) and the expression's own name `g`
// binds nothing — `path#f`, never `path#g` or `path#f.g`, its `source` the
// declarator, `f` through its initializer (1.7):
// `f = function g() { SPEC.a }`.
const T4_6_3_FN_EXPR_FILE = "src/fexpr.ts";
const T4_6_3_FN_EXPR_STATEMENT_PRE = "const ";
const T4_6_3_FN_EXPR_UNIT_PRE = "f = function g() { ";
const T4_6_3_FN_EXPR_UNIT =
  T4_6_3_FN_EXPR_UNIT_PRE + T4_6_3_ONE_FILE_MARKER + " }";
const T4_6_3_FN_EXPR_SOURCE =
  T4_6_3_ONE_FILE_HEAD +
  T4_6_3_FN_EXPR_STATEMENT_PRE +
  T4_6_3_FN_EXPR_UNIT +
  "\n";

// `const C = class D { m() { SPEC.a } }`: the variable declaration binds `C`
// (its initializer a class expression), whose method `m` is a class member —
// `path#C.m`, `source` the member `m() { SPEC.a }` — while the expression's
// own name `D` binds nothing: never `path#D.m` or `path#C.D.m`.
const T4_6_3_CLASS_EXPR_FILE = "src/cexpr.ts";
const T4_6_3_CLASS_EXPR_PRE = "const C = class D { ";
const T4_6_3_CLASS_EXPR_MEMBER_PRE = "m() { ";
const T4_6_3_CLASS_EXPR_MEMBER =
  T4_6_3_CLASS_EXPR_MEMBER_PRE + T4_6_3_ONE_FILE_MARKER + " }";
const T4_6_3_CLASS_EXPR_SOURCE =
  T4_6_3_ONE_FILE_HEAD +
  T4_6_3_CLASS_EXPR_PRE +
  T4_6_3_CLASS_EXPR_MEMBER +
  " }\n";

/** One default-export wrapper form, spelled exactly as TEST-SPEC spells it. */
interface DefaultWrapperForm {
  /** The wrapper's arm file's name key. */
  readonly name: string;
  readonly what: string;
  /** The export declaration's characters before its marker. */
  readonly pre: string;
  /** Its characters after the marker. */
  readonly post: string;
}

// A default export that merely wraps a named form binds no unit — one file
// per wrapper, a file holding at most one default export — so its marker
// attributes to the file, `source` the entire file, never to `path#default`
// (T4.6-2's unwrapped form).
const T4_6_3_DEFAULT_WRAPPER_FORMS: readonly DefaultWrapperForm[] = [
  {
    name: "paren",
    what: "parenthesized",
    pre: "export default (() => { ",
    post: " })",
  },
  {
    name: "as",
    what: "`as`-cast",
    pre: "export default (() => { ",
    post: " }) as () => void",
  },
  {
    name: "sat",
    what: "`satisfies`-qualified",
    pre: "export default (function () { ",
    post: " }) satisfies () => void",
  },
  {
    name: "nn",
    what: "non-null-asserted",
    pre: "export default (() => { ",
    post: " })!",
  },
];

const T4_6_3_DEFAULT_WRAPPER_ARMS: readonly PinnedOccurrence[] =
  T4_6_3_DEFAULT_WRAPPER_FORMS.map((form) => {
    const file = `src/dwrap-${form.name}.ts`;
    const declaration = form.pre + T4_6_3_ONE_FILE_MARKER + form.post;
    return pinnedMarkerOccurrence({
      what:
        `the ${form.what} default export \`${declaration}\` — the file, ` +
        "`source` the entire file, never `path#default`",
      file,
      fileSource: T4_6_3_ONE_FILE_HEAD + declaration + "\n",
      markerPrefix: T4_6_3_ONE_FILE_HEAD + form.pre,
      marker: T4_6_3_ONE_FILE_MARKER,
      target: oneFileTarget(T4_6_3_ONE_FILE_MARKER),
      unit: file,
    });
  });

// `declare namespace N {}` followed by `namespace N { SPEC.a }`: the
// `declare` modifier makes the first ambient — no unit, no document-order
// slot (4.6) — so the second is the chain `N`'s only unit: `path#N`, never
// `path#N@2`, `source` its own construct `namespace N { SPEC.a }`.
const T4_6_3_AMBIENT_NS_FILE = "src/declns.ts";
const T4_6_3_AMBIENT_NS_PRE = "declare namespace N {}\n\n";
const T4_6_3_NS_UNIT_PRE = "namespace N { ";
const T4_6_3_NS_UNIT = T4_6_3_NS_UNIT_PRE + T4_6_3_ONE_FILE_MARKER + " }";
const T4_6_3_AMBIENT_NS_SOURCE =
  T4_6_3_ONE_FILE_HEAD + T4_6_3_AMBIENT_NS_PRE + T4_6_3_NS_UNIT + "\n";

/** Every one-file arm, as TEST-SPEC lists them. */
const T4_6_3_ONE_FILE_ARMS: readonly PinnedOccurrence[] = [
  ...T4_6_3_OBJECT_LITERAL_ARMS,
  pinnedMarkerOccurrence({
    what:
      "`const f = function g() { SPEC.a }` — `path#f`, `source` " +
      "`f = function g() { SPEC.a }`, never `path#g` or `path#f.g`",
    file: T4_6_3_FN_EXPR_FILE,
    fileSource: T4_6_3_FN_EXPR_SOURCE,
    markerPrefix:
      T4_6_3_ONE_FILE_HEAD +
      T4_6_3_FN_EXPR_STATEMENT_PRE +
      T4_6_3_FN_EXPR_UNIT_PRE,
    marker: T4_6_3_ONE_FILE_MARKER,
    target: oneFileTarget(T4_6_3_ONE_FILE_MARKER),
    unit: `${T4_6_3_FN_EXPR_FILE}#f`,
    construct: {
      prefix: T4_6_3_ONE_FILE_HEAD + T4_6_3_FN_EXPR_STATEMENT_PRE,
      span: T4_6_3_FN_EXPR_UNIT,
    },
  }),
  pinnedMarkerOccurrence({
    what:
      "`const C = class D { m() { SPEC.a } }` — `path#C.m`, `source` " +
      "`m() { SPEC.a }`, never `path#D.m` or `path#C.D.m`",
    file: T4_6_3_CLASS_EXPR_FILE,
    fileSource: T4_6_3_CLASS_EXPR_SOURCE,
    markerPrefix:
      T4_6_3_ONE_FILE_HEAD +
      T4_6_3_CLASS_EXPR_PRE +
      T4_6_3_CLASS_EXPR_MEMBER_PRE,
    marker: T4_6_3_ONE_FILE_MARKER,
    target: oneFileTarget(T4_6_3_ONE_FILE_MARKER),
    unit: `${T4_6_3_CLASS_EXPR_FILE}#C.m`,
    construct: {
      prefix: T4_6_3_ONE_FILE_HEAD + T4_6_3_CLASS_EXPR_PRE,
      span: T4_6_3_CLASS_EXPR_MEMBER,
    },
  }),
  ...T4_6_3_DEFAULT_WRAPPER_ARMS,
  pinnedMarkerOccurrence({
    what:
      "`declare namespace N {}` then `namespace N { SPEC.a }` — `path#N`, " +
      "never `path#N@2`, `source` `namespace N { SPEC.a }`",
    file: T4_6_3_AMBIENT_NS_FILE,
    fileSource: T4_6_3_AMBIENT_NS_SOURCE,
    markerPrefix:
      T4_6_3_ONE_FILE_HEAD + T4_6_3_AMBIENT_NS_PRE + T4_6_3_NS_UNIT_PRE,
    marker: T4_6_3_ONE_FILE_MARKER,
    target: oneFileTarget(T4_6_3_ONE_FILE_MARKER),
    unit: `${T4_6_3_AMBIENT_NS_FILE}#N`,
    construct: {
      prefix: T4_6_3_ONE_FILE_HEAD + T4_6_3_AMBIENT_NS_PRE,
      span: T4_6_3_NS_UNIT,
    },
  }),
];

/** The one-file arms' files, staged in T4.6-3's first workspace. */
const T4_6_3_ONE_FILE_FILES: Readonly<Record<string, string>> =
  Object.fromEntries(
    T4_6_3_ONE_FILE_ARMS.map((arm) => [arm.file, arm.fileSource]),
  );

/** Each one-file arm's attributed location, by file. */
const T4_6_3_ONE_FILE_UNITS: ReadonlyMap<string, string> = new Map(
  T4_6_3_ONE_FILE_ARMS.map((arm) => [arm.file, arm.record.source.identity]),
);

/** The one-file arms' records, in occurrence order (SPEC 5.7). */
const T4_6_3_ONE_FILE_OCCURRENCES = inOccurrenceOrder(T4_6_3_ONE_FILE_ARMS);

/** The edge each one-file arm owes: its file's one marker, from its unit. */
const T4_6_3_ONE_FILE_REFERENCES: readonly GraphEdge[] =
  T4_6_3_ONE_FILE_ARMS.map((arm): GraphEdge => ({
    from: arm.record.source.identity,
    to: arm.record.target,
    kind: "references",
  }));

/**
 * Whether an identity names a code unit of a one-file arm's file other than
 * the arm's attributed unit: each such file holds one reference, so no other
 * unit of it is an edge endpoint — not a member- or `o`-named unit
 * (`path#m`, `path#o.m`, `path#f.q`), `path#g` or `path#f.g`, `path#D.m` or
 * `path#C.D.m`, `path#default`, nor `path#N@2` (SPEC 4.6).
 */
function namesStrayOneFileUnit(identity: string): boolean {
  const hash = identity.indexOf("#");
  if (hash < 0) return false;
  const unit = T4_6_3_ONE_FILE_UNITS.get(identity.slice(0, hash));
  return unit !== undefined && identity !== unit;
}

/** The edges the wrapper, default-export, body-less, and escape arms owe. */
const T4_6_3_FORM_REFERENCES: readonly GraphEdge[] = [
  { from: "src/wrap.ts", to: "specs/N.mdx#wrapparen", kind: "references" },
  { from: "src/wrap.ts", to: "specs/N.mdx#wrapas", kind: "references" },
  { from: "src/wrap.ts", to: "specs/N.mdx#wrapsat", kind: "references" },
  { from: "src/wrap.ts", to: "specs/N.mdx#wrapnn", kind: "references" },
  {
    from: "src/wrap.ts#wrapHost",
    to: "specs/N.mdx#wraphosted",
    kind: "references",
  },
  { from: "src/dobj.ts", to: "specs/N.mdx#dobj", kind: "references" },
  { from: "src/dident.ts#impl", to: "specs/N.mdx#dident", kind: "references" },
  { from: "src/dcall.ts", to: "specs/N.mdx#dcall", kind: "references" },
  { from: "src/dlit.ts", to: "specs/N.mdx#dlit", kind: "references" },
  { from: "src/decl.ts#f", to: "specs/N.mdx#overload", kind: "references" },
  {
    from: "src/decl.ts#M.m",
    to: "specs/N.mdx#methodoverload",
    kind: "references",
  },
  {
    from: "src/decl.ts#C.v",
    to: "specs/N.mdx#abstractgetter",
    kind: "references",
  },
  { from: "src/decl.ts#Amb.m", to: "specs/N.mdx#ambient", kind: "references" },
  { from: "src/esc.ts", to: "specs/N.mdx#escaped", kind: "references" },
];

/**
 * Per file, the unit-chain segments no named unit may be spelled after: the
 * value-side constants `s` and `t` of `src/app.ts` (`src/app.ts#s`, the
 * nested `src/app.ts#f.s`), the wrapper constants `w1` … `w5`, `default` and
 * the object-literal property `run` in the four default-export files, and
 * `foo` beside the escape spelling itself in `src/esc.ts` — each in its bare
 * and `@N`-suffixed forms — the misattributions the arms forbid (SPEC 4.6).
 */
const T4_6_3_FORBIDDEN_SEGMENTS: Readonly<Record<string, readonly string[]>> = {
  "src/app.ts": ["s", "t"],
  "src/wrap.ts": ["w1", "w2", "w3", "w4", "w5"],
  "src/dobj.ts": ["default", "run"],
  "src/dident.ts": ["default"],
  "src/dcall.ts": ["default"],
  "src/dlit.ts": ["default"],
  "src/esc.ts": ["foo", T4_6_3_ESCAPED_NAME],
};

/**
 * Whether a graph-node identity names a forbidden code unit: a chain of a
 * listed file with a segment spelled after one of its forbidden names, or
 * any `@N`-suffixed chain of `src/decl.ts` — its body-less declarations
 * occupy no document-order slot, so no unit there is disambiguated.
 */
function namesForbiddenUnit(identity: string): boolean {
  const hash = identity.indexOf("#");
  if (hash < 0) return false;
  const file = identity.slice(0, hash);
  const chain = identity.slice(hash + 1);
  if (file === "src/decl.ts") return /@\d+$/u.test(chain);
  const forbidden = T4_6_3_FORBIDDEN_SEGMENTS[file];
  if (forbidden === undefined) return false;
  return chain
    .replace(/@\d+$/u, "")
    .split(".")
    .some((segment) => forbidden.includes(segment));
}

// Declaration files, ambient by kind (SPEC 4.6; TypeScript's file-name rule:
// a name ending in `.d.mts` or `.d.cts`, or in `.ts` with `.d.` earlier in
// its last path segment): `x.d.ts`, `x.d.mts`, `x.d.cts`, and `x.d.css.ts`
// are code-group sources, each holding a body-bearing `function f` around a
// marker and a top-level marker. Every such file is well-formed (14.20:
// TypeScript's ambient-context checks are post-parse), so `build` and
// `check` exit 0 on the otherwise valid workspace; `f` is no unit, so both
// markers attribute to the whole file — never to `path#f`. The controls hold
// the same `f` and marker, well-formed, and are no declaration file under
// the rule, so `f`'s marker keeps `path#f`: `x.dts.ts` (no `.d.` in its last
// path segment); `src/a.d.b/x.ts` (`.d.` in a directory component alone);
// `x.d.tsx` (TSX by its name, 14.20) and `x.d.css.mts` (`.d.` in the last
// segment, the name ending in none of `.d.mts`, `.d.cts`, and `.ts`); and,
// the rule's name tests byte-wise and case-sensitive (12.0: no case folding
// anywhere), the single-casing controls `src/c1/x.D.ts`, `src/c2/x.d.TS`,
// `src/c3/x.d.MTS`, and `src/c4/x.d.CTS`, each in a directory of its own so
// that no two staged paths differ by case alone (stageable on any
// filesystem). The group's globs `src/**/*.ts`, `src/**/*.mts`, and
// `src/**/*.cts` gain `src/**/*.tsx`, `src/**/*.TS`, `src/**/*.MTS`, and
// `src/**/*.CTS`, so every control is discovered. Each marker targets its
// own section, so the complete `references` set pins every attribution, and
// the complete `occurrences` document pins every occurrence's `source` — the
// whole file, or a control's `f` declaration (T1.7-2's assertion, SPEC 1.7,
// 5.7). The arm's workspace is created after the body's first invocation,
// so its configuration and its twelve code files are staged-source records
// (S-9's timing clause; test/self/s9-staged-sources.test.ts), `x.d.tsx`
// judged as TSX — the grammar its name selects (14.20).
const T4_6_3_DECLARATION_FILE_CONFIG = stagedTs(
  "T4.6-3 xspec.config.ts — a code group spanning `.ts`, `.mts`, `.cts`, `.tsx`, `.TS`, `.MTS`, and `.CTS`, the declaration-file arm's",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: [
      "src/**/*.ts",
      "src/**/*.mts",
      "src/**/*.cts",
      "src/**/*.tsx",
      "src/**/*.TS",
      "src/**/*.MTS",
      "src/**/*.CTS"
    ]
  }
})
`,
);

/** One code file of the declaration-file arm. */
interface DeclarationFileArm {
  readonly file: string;
  /** The section the marker inside `f` targets. */
  readonly inner: string;
  /** The section the top-level marker targets. */
  readonly top: string;
  /**
   * Whether the file is a declaration file — ambient by kind under SPEC
   * 4.6's file-name rule, so `f` is no unit and its marker attributes to the
   * file — or a control, whose `f` marker keeps `path#f`.
   */
  readonly ambient: boolean;
  /** How the rule reads the name (diagnostics). */
  readonly why: string;
}

const T4_6_3_DECLARATION_FILE_ARMS: readonly DeclarationFileArm[] = [
  {
    file: "src/x.d.ts",
    inner: "dtsfn",
    top: "dtstop",
    ambient: true,
    why: "ends in `.ts`, `.d.` earlier in its last path segment",
  },
  {
    file: "src/x.d.mts",
    inner: "dmtsfn",
    top: "dmtstop",
    ambient: true,
    why: "ends in `.d.mts`",
  },
  {
    file: "src/x.d.cts",
    inner: "dctsfn",
    top: "dctstop",
    ambient: true,
    why: "ends in `.d.cts`",
  },
  {
    file: "src/x.d.css.ts",
    inner: "dcssfn",
    top: "dcsstop",
    ambient: true,
    why: "ends in `.ts`, `.d.` earlier in its last path segment",
  },
  {
    file: "src/x.dts.ts",
    inner: "ctrlfn",
    top: "ctrltop",
    ambient: false,
    why: "no `.d.` in its last path segment",
  },
  {
    file: "src/a.d.b/x.ts",
    inner: "adbfn",
    top: "adbtop",
    ambient: false,
    why: "`.d.` in a directory component alone — no `.d.` in its last path segment",
  },
  {
    file: "src/x.d.tsx",
    inner: "dtsxfn",
    top: "dtsxtop",
    ambient: false,
    why: "`.d.` in its last path segment, the name ending in none of `.d.mts`, `.d.cts`, and `.ts`",
  },
  {
    file: "src/x.d.css.mts",
    inner: "dcssmfn",
    top: "dcssmtop",
    ambient: false,
    why: "`.d.` in its last path segment, the name ending in none of `.d.mts`, `.d.cts`, and `.ts`",
  },
  {
    file: "src/c1/x.D.ts",
    inner: "c1fn",
    top: "c1top",
    ambient: false,
    why: "`.D.` is no `.d.` — byte-wise, case-sensitive",
  },
  {
    file: "src/c2/x.d.TS",
    inner: "c2fn",
    top: "c2top",
    ambient: false,
    why: "the name ends in no `.ts` — byte-wise, case-sensitive",
  },
  {
    file: "src/c3/x.d.MTS",
    inner: "c3fn",
    top: "c3top",
    ambient: false,
    why: "ending in neither `.d.mts` nor `.d.cts` — byte-wise, case-sensitive",
  },
  {
    file: "src/c4/x.d.CTS",
    inner: "c4fn",
    top: "c4top",
    ambient: false,
    why: "ending in neither `.d.mts` nor `.d.cts` — byte-wise, case-sensitive",
  },
];

/** The attributed location of a declaration-arm file's marker inside `f`. */
function declarationInnerUnit(arm: DeclarationFileArm): string {
  return arm.ambient ? arm.file : `${arm.file}#f`;
}

// Staged in T4.6-3's second workspace, created after the first's invocations:
// a staged-source record (S-9, test/self/s9-staged-sources.test.ts).
const T4_6_3_DECLARATION_SPEC_SOURCE = stagedMdx(
  "T4.6-3 specs/D.mdx of the declaration-file arm",
  T4_6_3_DECLARATION_FILE_ARMS.flatMap((arm) => [
    `<S id="${arm.inner}">`,
    `Target for the marker inside f of ${arm.file}.`,
    "</S>",
    "",
    `<S id="${arm.top}">`,
    `Target for the top-level marker of ${arm.file}.`,
    "</S>",
    "",
  ]).join("\n"),
);

/** The string parts every declaration-arm file is composed of. */
interface DeclarationFileParts {
  /** The import of `specs/D.mdx` and the blank line after it. */
  readonly head: string;
  /** `f`'s declaration before its marker. */
  readonly fnPre: string;
  readonly innerMarker: string;
  /** `f`'s declaration, by its own characters (SPEC 1.7). */
  readonly fnDecl: string;
  /** The text between `f`'s declaration and the top-level marker. */
  readonly between: string;
  readonly topMarker: string;
  /** The whole file. */
  readonly source: string;
}

/**
 * The one shape every declaration-arm file takes (the controls included):
 * the import — its specifier climbing from the file's own directory to the
 * workspace root — `function f` around one marker, and a top-level marker.
 */
function declarationFileParts(arm: DeclarationFileArm): DeclarationFileParts {
  const climb = "../".repeat(arm.file.split("/").length - 1);
  const head = `import SPEC from "${climb}specs/D.xspec";\n\n`;
  const fnPre = "function f(): void {\n  ";
  const innerMarker = `SPEC.${arm.inner}`;
  const fnDecl = fnPre + innerMarker + ";\n}";
  const between = "\n\n";
  const topMarker = `SPEC.${arm.top}`;
  return {
    head,
    fnPre,
    innerMarker,
    fnDecl,
    between,
    topMarker,
    source: head + fnDecl + between + topMarker + ";\n",
  };
}

// One record per declaration-arm file, laid out at module load (S-9), under
// the grammar its name selects (14.20: TSX for `x.d.tsx`).
const T4_6_3_DECLARATION_FILES: Readonly<Record<string, StagedTs>> =
  Object.fromEntries(
    T4_6_3_DECLARATION_FILE_ARMS.map((arm) => [
      arm.file,
      stagedTs(
        `T4.6-3 ${arm.file} of the declaration-file arm`,
        declarationFileParts(arm).source,
        "well-formed",
        tsGrammarOf(arm.file),
      ),
    ]),
  );

const T4_6_3_DECLARATION_REFERENCES: readonly GraphEdge[] =
  T4_6_3_DECLARATION_FILE_ARMS.flatMap((arm): GraphEdge[] => [
    {
      from: declarationInnerUnit(arm),
      to: `specs/D.mdx#${arm.inner}`,
      kind: "references",
    },
    { from: arm.file, to: `specs/D.mdx#${arm.top}`, kind: "references" },
  ]);

// The declaration-file workspace's complete occurrence enumeration, two per
// file: the marker inside `f` — sourced at the whole file in a declaration
// file, at `path#f` with `f`'s declaration's range in a control — and the
// top-level marker, at the whole file (SPEC 1.7, 4.6, 5.7).
const T4_6_3_DECLARATION_OCCURRENCES: readonly PinnedOccurrence[] =
  inOccurrenceOrder(
    T4_6_3_DECLARATION_FILE_ARMS.flatMap((arm): PinnedOccurrence[] => {
      const parts = declarationFileParts(arm);
      return [
        pinnedMarkerOccurrence({
          what:
            `${arm.file}'s marker inside \`f\` — ` +
            (arm.ambient
              ? "the whole file, a declaration file"
              : "`path#f`, `source` `f`'s declaration, a control") +
            ` (${arm.why})`,
          file: arm.file,
          fileSource: parts.source,
          markerPrefix: parts.head + parts.fnPre,
          marker: parts.innerMarker,
          target: `specs/D.mdx#${arm.inner}`,
          unit: declarationInnerUnit(arm),
          ...(arm.ambient
            ? {}
            : { construct: { prefix: parts.head, span: parts.fnDecl } }),
        }),
        pinnedMarkerOccurrence({
          what: `${arm.file}'s top-level marker — the whole file`,
          file: arm.file,
          fileSource: parts.source,
          markerPrefix: parts.head + parts.fnDecl + parts.between,
          marker: parts.topMarker,
          target: `specs/D.mdx#${arm.top}`,
          unit: arm.file,
        }),
      ];
    }),
  );

/**
 * Whether an identity names a code unit of the declaration-file arm other
 * than a control's `path#f`: no chain of a declaration file (`src/x.d.ts#f`
 * or any other) — a declaration in an ambient context is no unit — and no
 * other chain of a control.
 */
function namesStrayDeclarationArmUnit(identity: string): boolean {
  return T4_6_3_DECLARATION_FILE_ARMS.some(
    (arm) =>
      identity.startsWith(`${arm.file}#`) &&
      identity !== declarationInnerUnit(arm),
  );
}

const T4_6_3 = defineProductTest({
  id: "T4.6-3",
  title:
    "markers inside constructs that are not named units — an IIFE, a function stored via destructuring, and computed-name, string-literal-name, numeric-literal-name (`123() {}`), and private (`#priv() {}`) class members — attribute to the nearest enclosing named unit or the file; the private-member arm attributes to the bare class unit, never to a `#`-named unit; value-side boundary: `const s = text(SPEC.a)` attributes to `path#f` inside `f` and to `path` at top level, never to a unit named after the constant; object-literal members and named expressions, each arm a file of its own, attribution asserted with the occurrence's `source` range: markers in an object literal's method shorthand (`m() { SPEC.a }`), getter, setter, and function-valued properties (`p: function () { SPEC.d }`, `q: () => { SPEC.e }`) attribute, the literal a top-level `const o`'s initializer, to the file (`source` the entire file) and, the same `const o` inside a function `f`, to `path#f` (`source` `f`'s declaration) — never to a unit named for a member or for `o`; `const f = function g() { SPEC.a }` to `path#f` (`source` `f = function g() { SPEC.a }`), never `path#g` or `path#f.g`; `const C = class D { m() { SPEC.a } }` to `path#C.m` (`source` `m() { SPEC.a }`), never `path#D.m` or `path#C.D.m`; wrappers and value forms — a parenthesized, `as`-cast, `satisfies`-qualified, or non-null-asserted initializer — bind no unit (the file, or the enclosing named unit); a default export of an object literal, an identifier, a call, or a literal value binds no unit, and neither does a default export merely wrapping a named form (`export default (() => { SPEC.a })` and its `as`, `satisfies`, and `!` twins, one file each: the file, `source` the entire file, never `path#default`); overload signatures, body-less method signatures, abstract members, and `declare` ambient declarations are no units and occupy no document-order slot (`path#f`, never `path#f@3`; `path#C.m`; `path#C.v`, never `path#C.v@2`; `declare namespace N {}` then `namespace N { SPEC.a }` is `path#N`, never `path#N@2`); an escape-spelled function name binds no unit (the file, never `path#foo`); declaration files ambient by kind (`x.d.ts`, `x.d.mts`, `x.d.cts`, `x.d.css.ts`) are well-formed, `build` and `check` exit 0, and both their markers attribute to the whole file, never to `path#f`, while the controls — `x.dts.ts`, `src/a.d.b/x.ts`, `x.d.tsx` (the group adding `src/**/*.tsx`), `x.d.css.mts`, and, the rule's name tests byte-wise and case-sensitive, the single-casing `src/c1/x.D.ts`, `src/c2/x.d.TS`, `src/c3/x.d.MTS`, and `src/c4/x.d.CTS` (the group adding `src/**/*.TS`, `src/**/*.MTS`, and `src/**/*.CTS`) — keep `path#f`, every occurrence's `source` the whole file or a control's `f` declaration (SPEC 4.6, 1.7, 2.4, 5.7, 11.3, 12.0, 14.20)",
  run: async (product) => {
    // Fixture self-checks, before the body's first product invocation: every
    // pinned range slices its staged file to the span it claims.
    assertPinnedSpans(T4_6_3_ONE_FILE_OCCURRENCES);
    assertPinnedSpans(T4_6_3_DECLARATION_OCCURRENCES);
    await withWorkspace(
      SPEC_AND_CODE_CONFIG,
      {
        "specs/N.mdx": T4_6_3_SPEC_SOURCE,
        "src/app.ts": T4_6_3_APP_SOURCE,
        "src/wrap.ts": T4_6_3_WRAP_SOURCE,
        "src/dobj.ts": T4_6_3_DEFAULT_OBJECT_SOURCE,
        "src/dident.ts": T4_6_3_DEFAULT_IDENTIFIER_SOURCE,
        "src/dcall.ts": T4_6_3_DEFAULT_CALL_SOURCE,
        "src/dlit.ts": T4_6_3_DEFAULT_LITERAL_SOURCE,
        "src/decl.ts": T4_6_3_DECL_SOURCE,
        "src/esc.ts": T4_6_3_ESCAPED_SOURCE,
        "specs/O.mdx": T4_6_3_ONE_FILE_SPEC_SOURCE,
        ...T4_6_3_ONE_FILE_FILES,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.6-3 `build` over the not-named-units workspace",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", "T4.6-3"),
          [
            // Top-level IIFE: no named unit encloses it — the file.
            { from: "src/app.ts", to: "specs/N.mdx#iife", kind: "references" },
            // IIFE inside `host`: the anonymous arrow binds no name, so the
            // nearest enclosing named unit is the function declaration.
            {
              from: "src/app.ts#host",
              to: "specs/N.mdx#hosted",
              kind: "references",
            },
            // Destructuring binds no named unit, and an object-literal
            // property is no class member — the file.
            {
              from: "src/app.ts",
              to: "specs/N.mdx#destr",
              kind: "references",
            },
            // The four member arms: computed, string-literal, numeric-
            // literal, and private names bind no plain identifier, so each
            // marker attributes to the bare class unit — for `#priv` never
            // to a `#`-named unit.
            {
              from: "src/app.ts#Carrier",
              to: "specs/N.mdx#computed",
              kind: "references",
            },
            {
              from: "src/app.ts#Carrier",
              to: "specs/N.mdx#strname",
              kind: "references",
            },
            {
              from: "src/app.ts#Carrier",
              to: "specs/N.mdx#numname",
              kind: "references",
            },
            {
              from: "src/app.ts#Carrier",
              to: "specs/N.mdx#priv",
              kind: "references",
            },
            // The wrapper, default-export, body-less/`declare`, and
            // escape-spelled arms, one dedicated target each.
            ...T4_6_3_FORM_REFERENCES,
            // The one-file arms, each its file's one marker: the object
            // literals' members, the named expressions, the default-export
            // wrappers, and the `declare namespace` pair.
            ...T4_6_3_ONE_FILE_REFERENCES,
          ],
          "T4.6-3 markers inside not-named-units attribute to the nearest " +
            "enclosing named unit or the file: the top-level IIFE and the " +
            "destructuring-stored function to the file, the nested IIFE to " +
            "its hosting function, and every oddly-named class member to " +
            "the bare class unit — never to a `#`-named unit; a merely " +
            "wrapping initializer (parenthesized, `as`, `satisfies`, `!`) " +
            "binds no unit — the file, or the enclosing `wrapHost`; a " +
            "default export of an object literal, an identifier, a call, or " +
            "a literal binds no `default` unit; overload signatures, " +
            "body-less methods, abstract members, and `declare` " +
            "declarations are no units and take no document-order slot " +
            "(`#f`, `#M.m`, `#C.v`, `#Amb.m` — never `@N`); an " +
            "escape-spelled function name binds no unit — the file, never " +
            "`#foo`; an object literal's members bind no unit, nor does " +
            "`const o` — the file at top level (`src/olit-*.ts`), `#f` " +
            "inside `f` (`src/olitf-*.ts`); `const f = function g() {…}` " +
            "is `src/fexpr.ts#f` and `const C = class D { m() {…} }`'s " +
            "method `src/cexpr.ts#C.m` — a function or class expression's " +
            "own name binds nothing; a default export merely wrapping a " +
            "named form binds no `default` unit — the file " +
            "(`src/dwrap-*.ts`); and `namespace N` behind `declare " +
            "namespace N {}` is `src/declns.ts#N`, never `#N@2` (SPEC 4.6, " +
            "2.4)",
        );
        // Value-side boundary: the complete `embeds` set pins each call's
        // attributed unit — the constant's enclosing function, or the file.
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "embeds", "T4.6-3"),
          [
            {
              from: "src/app.ts#f",
              to: "specs/N.mdx#valfn",
              kind: "embeds",
            },
            {
              from: "src/app.ts",
              to: "specs/N.mdx#valtop",
              kind: "embeds",
            },
          ],
          "T4.6-3 value-side boundary: `const s = text(SPEC.valfn)` inside " +
            "`f` attributes its `embeds` edge to `src/app.ts#f`, and the " +
            "top-level `const t = text(SPEC.valtop)` to the file " +
            "`src/app.ts` — never to a unit named after the constant " +
            "(SPEC 4.6; the stored value is the returned string, 4.5)",
        );
        // … and no location spelled after either constant exists anywhere
        // in the unfiltered edge enumeration — as a source or a target —
        // nor any unit of a one-file arm's file but its attributed one.
        const allEdges = await queryAllEdges(product, workspace, "T4.6-3");
        assertSameJson(
          allEdges
            .flatMap((edge) => [edge.from, edge.to])
            .filter(
              (identity) =>
                namesForbiddenUnit(identity) || namesStrayOneFileUnit(identity),
            )
            .sort(),
          [],
          "T4.6-3: no endpoint of the unfiltered `query edges` answer names " +
            "a forbidden code unit — one spelled after the plain-identifier " +
            "constants `s` or `t` (`src/app.ts#s`, `src/app.ts#f.s`), the " +
            "wrapper constants `w1` … `w5`, `default` or `run` in a " +
            "default-export file, `foo` or the escape spelling itself in " +
            "`src/esc.ts`, or any `@N`-suffixed chain of `src/decl.ts` — " +
            "a variable whose initializer is a call or a mere wrapper, a " +
            "default export of a non-construct, a body-less declaration, " +
            "and an escape-spelled name are no named units — nor any unit " +
            "of a one-file arm's file but the one its marker attributes to " +
            "(not `#m`, `#o.m`, or `#f.q`; `#g` or `#f.g`; `#D.m` or " +
            "`#C.D.m`; `#default`; `#N@2`) (SPEC 4.6, 2.4)",
        );
        // The one-file arms' occurrence records: each file's one marker
        // sourced at its attributed unit with that unit's own range — the
        // entire file, `f`'s declaration, the declarator, the member, or the
        // non-ambient namespace declaration (T1.7-2's assertion).
        const occurrencesContext = "T4.6-3 `occurrences`";
        const occurrences = decodeOccurrencesReport(
          await runJson(
            product,
            workspace,
            ["occurrences"],
            occurrencesContext,
          ),
          occurrencesContext,
        );
        assertSameJson(
          occurrences.findings,
          [],
          `${occurrencesContext}: a complete, finding-free answer — the ` +
            "consulted domain (the entire discovered set, no `--file`) " +
            "carries no finding (SPEC 11.2, 11.3)",
        );
        assertPinnedOccurrences(
          occurrences.occurrences.filter(
            (record) =>
              typeof record.file === "string" &&
              T4_6_3_ONE_FILE_UNITS.has(record.file),
          ),
          T4_6_3_ONE_FILE_OCCURRENCES,
          `${occurrencesContext}, the one-file arms' records: each file's ` +
            "one marker occurrence carries its attributed unit's identity " +
            "with that unit's own source range — the entire file for " +
            "`src/olit-*.ts` and `src/dwrap-*.ts`, `f`'s declaration for " +
            "`src/olitf-*.ts`, `f = function g() { SPEC.a }` for " +
            "`src/fexpr.ts#f`, `m() { SPEC.a }` for `src/cexpr.ts#C.m`, and " +
            "`namespace N { SPEC.a }` for `src/declns.ts#N` — zero-based " +
            "byte offsets, start-inclusive, end-exclusive (SPEC 1.7, 4.6, " +
            "5.7)",
        );
      },
    );
    // Declaration files, ambient by kind, and their controls: a second
    // workspace whose code group spans `.ts`, `.mts`, `.cts`, `.tsx`, `.TS`,
    // `.MTS`, and `.CTS` (SPEC 4.6, 12.0, 14.20).
    await withWorkspace(
      T4_6_3_DECLARATION_FILE_CONFIG,
      {
        "specs/D.mdx": T4_6_3_DECLARATION_SPEC_SOURCE,
        ...T4_6_3_DECLARATION_FILES,
      },
      async (workspace) => {
        const context = "T4.6-3 declaration files";
        await buildOk(
          product,
          workspace,
          `${context}: \`build\` exits 0 — \`x.d.ts\`, \`x.d.mts\`, ` +
            "`x.d.cts`, and `x.d.css.ts`, each holding a body-bearing " +
            "`function f` and a top-level marker, are well-formed (14.20: " +
            "TypeScript's ambient-context checks are post-parse), as are " +
            "the controls holding the same — `x.d.tsx` under the TSX " +
            "grammar its name selects — so the otherwise valid workspace " +
            "builds",
        );
        await expectFindingFreeReport(
          product,
          workspace,
          ["check", "--json"],
          `${context}: \`check\` exits 0 finding-free over the built ` +
            "workspace — the declaration files and their controls carry no " +
            "finding (SPEC 12.2, 14.20)",
        );
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", context),
          T4_6_3_DECLARATION_REFERENCES,
          `${context}: in \`x.d.ts\`, \`x.d.mts\`, \`x.d.cts\`, and ` +
            "`x.d.css.ts` the body-bearing `function f` is no unit — a " +
            "declaration in an ambient context, the file ambient by kind — " +
            "so its marker and the top-level marker both attribute to the " +
            "whole file `path`, never to `path#f`, while the controls, no " +
            "declaration file under the rule, keep `path#f`: `x.dts.ts` (no " +
            "`.d.` in its last path segment), `src/a.d.b/x.ts` (`.d.` in a " +
            "directory component alone), `x.d.tsx` and `x.d.css.mts` (`.d.` " +
            "in the last segment, the name ending in none of `.d.mts`, " +
            "`.d.cts`, and `.ts`), and — the rule's name tests byte-wise " +
            "and case-sensitive — `src/c1/x.D.ts`, `src/c2/x.d.TS`, " +
            "`src/c3/x.d.MTS`, and `src/c4/x.d.CTS` (SPEC 4.6, 12.0)",
        );
        const allEdges = await queryAllEdges(product, workspace, context);
        assertSameJson(
          allEdges
            .flatMap((edge) => [edge.from, edge.to])
            .filter(namesStrayDeclarationArmUnit)
            .sort(),
          [],
          `${context}: no endpoint of the unfiltered \`query edges\` answer ` +
            "names a code unit of a declaration file (`src/x.d.ts#f` or any " +
            "other chain) — a declaration in an ambient context is no unit " +
            "— nor any unit of a control but its `path#f` (SPEC 4.6)",
        );
        const occurrencesContext = `${context} \`occurrences\``;
        const occurrences = decodeOccurrencesReport(
          await runJson(
            product,
            workspace,
            ["occurrences"],
            occurrencesContext,
          ),
          occurrencesContext,
        );
        assertSameJson(
          occurrences.findings,
          [],
          `${occurrencesContext}: a complete, finding-free answer over the ` +
            "valid workspace (SPEC 11.2, 11.3)",
        );
        assertPinnedOccurrences(
          occurrences.occurrences,
          T4_6_3_DECLARATION_OCCURRENCES,
          `${occurrencesContext}: the workspace's complete enumeration, two ` +
            "records per file — each declaration file's markers both " +
            "sourced at the whole file with the entire file's range, each " +
            "control's marker inside `f` at `path#f` with `f`'s " +
            "declaration's range and its top-level marker at the whole file " +
            "— zero-based byte offsets, start-inclusive, end-exclusive " +
            "(SPEC 1.7, 4.6, 5.7)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T4.6-4 — duplicate chains: 1-based document-order `@2` suffix
// ---------------------------------------------------------------------------

// One direct-mode coverage profile over the same groups, so each `@2` unit
// must also surface as the boundary member of its target's covering path
// (SPEC 7.4, 8; `boundaryKind` inferred — the group names are unambiguous).
const T4_6_4_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  coverage: [
    {
      name: "units",
      target: "main",
      boundary: "app",
      mode: "direct"
    }
  ]
})
`;

const T4_6_4_SPEC_SOURCE = [
  '<S id="viagetter">',
  "Target of the getter marker.",
  "</S>",
  "",
  '<S id="viasetter">',
  "Target of the setter marker.",
  "</S>",
  "",
  '<S id="first">',
  "Target of the first sibling-scope declaration.",
  "</S>",
  "",
  '<S id="second">',
  "Target of the second sibling-scope declaration.",
  "</S>",
  "",
].join("\n");

// Two duplicate chains in one file (SPEC 4.6): the getter/setter pair `value`
// in class `Pair` (chain `Pair.value` twice), and the variable `worker` —
// a named unit each time — declared in two sibling top-level blocks, which
// bind no name and so leave both chains as the bare `worker`. Document order:
// the getter precedes the setter, the first block precedes the second, so
// each second occurrence is `@2` (1-based; the first stays unsuffixed).
const T4_6_4_APP_SOURCE = [
  'import SPEC from "../specs/D.xspec";',
  "",
  "class Pair {",
  "  get value(): string {",
  "    SPEC.viagetter;",
  '    return "current";',
  "  }",
  "",
  "  set value(next: string) {",
  "    SPEC.viasetter;",
  "    void next;",
  "  }",
  "}",
  "",
  "{",
  "  const worker = () => {",
  "    SPEC.first;",
  "  };",
  "  worker();",
  "}",
  "",
  "{",
  "  const worker = () => {",
  "    SPEC.second;",
  "  };",
  "  worker();",
  "}",
  "",
].join("\n");

const T4_6_4_GETTER_EDGE: GraphEdge = {
  from: "src/dup.ts#Pair.value",
  to: "specs/D.mdx#viagetter",
  kind: "references",
};
const T4_6_4_SETTER_EDGE: GraphEdge = {
  from: "src/dup.ts#Pair.value@2",
  to: "specs/D.mdx#viasetter",
  kind: "references",
};
const T4_6_4_FIRST_EDGE: GraphEdge = {
  from: "src/dup.ts#worker",
  to: "specs/D.mdx#first",
  kind: "references",
};
const T4_6_4_SECOND_EDGE: GraphEdge = {
  from: "src/dup.ts#worker@2",
  to: "specs/D.mdx#second",
  kind: "references",
};

const T4_6_4 = defineProductTest({
  id: "T4.6-4",
  title:
    "when the same unit chain occurs more than once in a file — a getter/setter pair, two same-named declarations in sibling scopes — the second occurrence in document order is `path#unit@2` (1-based, the first unsuffixed), asserted via `query edges` and as coverage boundary membership (SPEC 4.6, 8, 11)",
  run: async (product) => {
    await withWorkspace(
      T4_6_4_CONFIG,
      {
        "specs/D.mdx": T4_6_4_SPEC_SOURCE,
        "src/dup.ts": T4_6_4_APP_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T4.6-4 `build` over the duplicate-chains workspace",
        );

        // The complete `references` edge set: first occurrences unsuffixed,
        // each second occurrence carrying the 1-based `@2` suffix.
        assertEdgeSetEqual(
          await queryEdgesOfKind(product, workspace, "references", "T4.6-4"),
          [
            T4_6_4_GETTER_EDGE,
            T4_6_4_SETTER_EDGE,
            T4_6_4_FIRST_EDGE,
            T4_6_4_SECOND_EDGE,
          ],
          "T4.6-4 duplicate unit chains disambiguate with the 1-based " +
            "document-order suffix: the getter keeps `Pair.value` and the " +
            "setter is `Pair.value@2`; the first sibling-scope `worker` is " +
            "unsuffixed and the second is `worker@2` (SPEC 4.6)",
        );

        // Each `@2` identity is an addressable graph node (SPEC 11:
        // `path#unit@N`), reached by `query edges --from`.
        assertEdgeSetEqual(
          await queryEdgesFrom(
            product,
            workspace,
            "src/dup.ts#Pair.value@2",
            "T4.6-4",
          ),
          [T4_6_4_SETTER_EDGE],
          "T4.6-4 `src/dup.ts#Pair.value@2` addresses the setter — the " +
            "second occurrence of the `Pair.value` chain — whose complete " +
            "edge set is its marker's edge (SPEC 4.6, 11)",
        );
        assertEdgeSetEqual(
          await queryEdgesFrom(
            product,
            workspace,
            "src/dup.ts#worker@2",
            "T4.6-4",
          ),
          [T4_6_4_SECOND_EDGE],
          "T4.6-4 `src/dup.ts#worker@2` addresses the second sibling-scope " +
            "declaration, whose complete edge set is its marker's edge " +
            "(SPEC 4.6, 11)",
        );

        // Coverage boundary membership: in the direct-mode profile each
        // target is reached by exactly one edge, so its one shortest
        // covering path is forced to [boundary unit, target] — the `@2`
        // units appear as boundary members (SPEC 8, 8.2).
        const coverageLabel = "T4.6-4 `coverage --json`";
        const coverage = decodeCoverageReport(
          await runJson(
            product,
            workspace,
            ["coverage", "--json"],
            coverageLabel,
          ),
          coverageLabel,
        );
        assertSameJson(
          coverage.profiles.map((profile) => profile.name),
          ["units"],
          `${coverageLabel}: the one configured profile runs (SPEC 8.2)`,
        );
        const profile = coverage.profiles[0]!;
        assertSameJson(
          [...profile.uncovered].sort(),
          [],
          `${coverageLabel}: every required node is covered by its ` +
            "marker's edge (SPEC 8)",
        );
        assertSameJson(
          profile.covered
            .map((node) => `${node.identity} <= ${node.path.join(" > ")}`)
            .sort(),
          [
            "specs/D.mdx#first <= src/dup.ts#worker > specs/D.mdx#first",
            "specs/D.mdx#second <= src/dup.ts#worker@2 > specs/D.mdx#second",
            "specs/D.mdx#viagetter <= src/dup.ts#Pair.value > " +
              "specs/D.mdx#viagetter",
            "specs/D.mdx#viasetter <= src/dup.ts#Pair.value@2 > " +
              "specs/D.mdx#viasetter",
          ],
          `${coverageLabel}: each covered target's one covering path runs ` +
            "from its marker's unit — the `@2` identities appearing as the " +
            "boundary members of their targets' paths (SPEC 4.6, 8, 8.2)",
        );
      },
    );
  },
});

/** TEST-SPEC §4.6, in canonical ID order (SUITE-16). */
export const section46Tests: readonly ProductTestEntry[] = [
  T4_6_1,
  T4_6_2,
  T4_6_3,
  T4_6_4,
];
