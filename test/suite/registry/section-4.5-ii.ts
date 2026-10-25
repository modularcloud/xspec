// TEST-SPEC §4.5 (dependency markers), second part — SUITE-15 (continued):
// T4.5-10, the scope a nested import declaration declares its bindings in
// and the chains it roots. T4.5-1 … T4.5-9 are section-4.5.ts's business;
// this module keeps that file's edits bounded (the section-6.5-v
// precedent).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 4.5: an import declaration declares its bindings in its own scope —
// the file's for a top-level declaration and, for a nested one (TypeScript's
// parser admits an import declaration wherever a statement may stand,
// 14.20), that of the innermost function, class static block, or namespace
// or module declaration enclosing it, never a block's, as TypeScript at
// release 5.9.3 declares them — so the marker of `function g() { { import A
// from "../specs/A.xspec"; } A.a.b; }` is rooted at that import. Which
// binding roots a chain is the language's scoping question (2.4), an import
// binding its identifier throughout its scope; a rooted marker records a
// `references` edge from the innermost enclosing named code unit, or the
// file where none encloses it (4.5, 4.6), and its occurrence (5.7).
//
// Conservative operationalizations (noted per H-4 — wording is free, so only
// the stated observables are asserted):
// - T4.5-10's arms each stage a workspace of their own (H-1): `specs/A.mdx`
//   holding `a` and its child `a.b`, the arm's code sources together under
//   `src/`, and a configuration with one spec group (`specs/**/*.mdx`) and
//   one code group (`src/**/*.ts`), emission disabled. Every staged file is
//   a staged-source record (S-9's timing clause: every arm's workspace past
//   the body's first is created after a product invocation), each code text
//   TEST-SPEC's exactly — a trailing U+000A where TEST-SPEC spells one and
//   none where it spells none; (c)'s two functions, which TEST-SPEC places
//   "beside" each other, are joined by one U+000A, no trailing one. TEST-SPEC
//   fixes the texts and the locations, the harness the file names. Each text
//   is accepted by TypeScript 5.9.3 both as module code and as script code
//   (S-9's judge, test/self/s9-staged-sources.test.ts): its diagnostics on a
//   nested import declaration, on a statement in an ambient context, and on
//   an undeclared string-named module declaration are post-parse checks
//   (14.20).
// - None is compiled under H-2's channel: TypeScript's checker rejects a
//   nested import declaration after parsing, so each arm observes xspec's
//   surfaces alone — `build --json`, then `check --json` on the freshly
//   built workspace, each exactly `{"findings": []}` (exit 0), then `query
//   edges` and `occurrences`.
// - Edges: (a)'s "`query edges` reports one `references` edge" and (b)'s
//   "each marker records its `references` edge … from the location named"
//   are the workspace's complete dependency-edge set — the spec source's
//   structural `contains` edges set aside (SPEC 5.2) — compared with
//   exactly those edges, one per marker; (c)'s "lists no edge from its
//   location" is that set compared with none, its workspace holding no
//   other spelling that could record one; (f)'s "lists no edge from
//   `src/q.ts`" is the answer's edges from `src/q.ts` or a unit within it
//   compared with none.
// - Occurrences: (a)'s "one marker occurrence spanning `A.a.b`, its source
//   `src/g.ts#g`" is the complete record set of a bare `occurrences`, the
//   one record's every datum pinned from the exact bytes — the chain's own
//   span, its `;` excluded, kind `references`, its source `src/g.ts#g` with
//   that unit's own range (the function declaration, `function` through its
//   closing brace, 1.7), its target `specs/A.mdx#a.b` — beside no finding
//   (11.3); (c)'s "no occurrence" is a bare `occurrences` answering no
//   record and no finding; (f)'s, `occurrences --file src/q.ts` likewise.
// - Every arm runs; each one's diagnosed failure is collected and the body
//   fails once at the end, naming every arm that failed (T6.5-23's
//   discipline, section-6.5-v.ts), so one product failure hides no other
//   arm's verdict. A harness error — anything but a diagnosed assertion
//   failure, a hang included — propagates at once.

import { Buffer } from "node:buffer";
import type { GraphEdge } from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodeOccurrencesReport,
} from "../../helpers/adapters/index.js";
import { fail, HarnessAssertionError } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { occurrenceTuple } from "./section-4.5.js";
import {
  assertEdgeSetEqual,
  assertSameJson,
  expectFindingFreeReport,
  runJson,
} from "./support.js";

/**
 * Stage a fresh workspace — the configuration record plus `files` — run
 * `body`, and dispose of it (H-1). Every entry is a staged-source record,
 * staged under the record's own declaration (S-9; helpers/workspace.ts).
 */
async function withWorkspace<T>(
  config: StagedTs,
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

/**
 * `build --json`, then `check --json` on the freshly built workspace, each
 * finding-free — exit 0 and exactly `{"findings": []}` (SPEC 12.1, 12.2,
 * 12.7).
 */
async function expectCleanBuildAndCheck(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
  why: string,
): Promise<void> {
  await expectFindingFreeReport(
    product,
    workspace,
    ["build", "--json"],
    `${context}: \`build --json\` — ${why}`,
  );
  await expectFindingFreeReport(
    product,
    workspace,
    ["check", "--json"],
    `${context}: \`check --json\` on the freshly built workspace (SPEC ` +
      `12.2) — ${why}`,
  );
}

/**
 * The workspace's dependency edges: `query edges` decoded (SPEC 11.1), the
 * spec sources' structural `contains` edges set aside (5.2).
 */
async function queryDependencyEdges(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly GraphEdge[]> {
  const label = `${context}: \`query edges\``;
  return decodeEdgesReport(
    await runJson(product, workspace, ["query", "edges"], label),
    label,
  ).filter((edge) => edge.kind !== "contains");
}

/**
 * An `occurrences` invocation on a valid workspace (`argv` naming the
 * subcommand and its filters): exit 0 with exactly one JSON document, its
 * findings none (SPEC 11.2, 11.3: a complete, finding-free answer), its
 * records returned as `occurrenceTuple`s, every datum of 5.7 per record.
 */
async function validOccurrenceRecords(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<readonly (readonly unknown[])[]> {
  const label = `${context}: \`${argv.join(" ")}\``;
  const report = decodeOccurrencesReport(
    await runJson(product, workspace, argv, label),
    label,
  );
  assertSameJson(
    report.findings,
    [],
    `${label}: the valid workspace's answer carries no finding (SPEC 11.2, ` +
      `11.3)`,
  );
  return report.occurrences.map(occurrenceTuple);
}

// ---------------------------------------------------------------------------
// T4.5-10
// ---------------------------------------------------------------------------

// One spec group plus one code group (SPEC 7.2), emission disabled: the
// TypeScript files under `src/` are discovered code sources, so `build`
// analyzes their imports and markers (4, 4.5). A staged-source record (S-9's
// timing clause): every arm's workspace past the body's first is created
// after a product invocation.
const T4_5_10_CONFIG = stagedTs(
  "T4.5-10 xspec.config.ts — one spec group and one code group, every arm's workspace",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

// `specs/A.mdx`, `a` and its child `a.b`: every arm's spec source, holding
// the node every staged chain names. A staged-source record (S-9's timing
// clause).
const T4_5_10_SPEC_SOURCE = stagedMdx(
  "T4.5-10 specs/A.mdx — `a` and its child `a.b`, every arm's spec source",
  '<S id="a">\nAlpha behavior.\n<S id="a.b">\nBeta behavior.\n</S>\n</S>\n',
);

/** The chain every T4.5-10 marker spells, and the node it names. */
const T4_5_10_CHAIN = "A.a.b";
const T4_5_10_TARGET = "specs/A.mdx#a.b";

/** One T4.5-10 code source as staged: its path and TEST-SPEC's exact text. */
interface T4510Staging {
  /** The code source's workspace-relative path, under `src/`. */
  readonly file: string;
  /** What the file stages (record names and failure diagnostics). */
  readonly what: string;
  /** The file's exact text — pure ASCII, spelling `A.a.b` exactly once. */
  readonly text: string;
}

/**
 * A (b) file, whose chain the import roots: the code location its marker's
 * `references` edge comes from is the innermost enclosing named unit,
 * dot-joined under the file's path (`unit`), or the file itself where none
 * encloses the chain (`null`; SPEC 4.6).
 */
interface T4510RootedStaging extends T4510Staging {
  readonly unit: string | null;
}

/** A staging laid out at module load, its text a staged-source record. */
interface LaidOutT4510Staging<S extends T4510Staging> {
  readonly staging: S;
  readonly source: StagedTs;
}

/**
 * Lay out one staging: check that its text spells the chain exactly once,
 * throwing otherwise (a harness defect, never a product verdict), and
 * register its record. It registers a record, so it runs at module load
 * only (the tables below).
 */
function layOutT4510Staging<S extends T4510Staging>(
  arm: string,
  staging: S,
): LaidOutT4510Staging<S> {
  const at = staging.text.indexOf(T4_5_10_CHAIN);
  if (at === -1 || staging.text.lastIndexOf(T4_5_10_CHAIN) !== at) {
    throw new Error(
      `T4.5-10 fixture self-check: arm (${arm})'s ${staging.file} (` +
        `${staging.what}) must spell the chain \`${T4_5_10_CHAIN}\` exactly ` +
        `once (harness bug)`,
    );
  }
  return {
    staging,
    source: stagedTs(
      `T4.5-10 (${arm}) ${staging.file} — ${staging.what}`,
      staging.text,
    ),
  };
}

/** A rooted staging's code location: `path#unit`, or `path` (SPEC 4.6). */
function stagingLocation(staging: T4510RootedStaging): string {
  return staging.unit === null
    ? staging.file
    : `${staging.file}#${staging.unit}`;
}

// Arm (a), SPEC.md's example (4.5) as TEST-SPEC stages it: the marker after
// the block is rooted at the block-nested import, whose scope is `g`'s, not
// the block's.
const T4_5_10_A: LaidOutT4510Staging<T4510Staging> = layOutT4510Staging("a", {
  file: "src/g.ts",
  what: "SPEC.md's example, `A.a.b` after `g`'s block-nested import",
  text: 'function g() { { import A from "../specs/A.xspec"; } A.a.b; }\n',
});

/**
 * Arm (a)'s one occurrence record (SPEC 5.7) as a JSON-safe tuple, in the
 * order of `occurrenceTuple` (section-4.5.ts) — file, own range, kind,
 * source (identity and range), target — pinned from the exact bytes: the
 * bare chain `A.a.b`, its `;` excluded; its source the unit `g`, whose range
 * is the function declaration by its own characters, `function` through the
 * closing brace ending the file's one line (1.7).
 */
const T4_5_10_A_RECORD: readonly unknown[] = (() => {
  const { file, text } = T4_5_10_A.staging;
  const unitStart = text.indexOf("function g() {");
  const unitEnd = text.lastIndexOf("}") + 1;
  if (unitStart !== 0 || text.slice(unitEnd) !== "\n") {
    throw new Error(
      "T4.5-10 fixture self-check: arm (a)'s src/g.ts must be the one " +
        "declaration `function g() { … }` on a line of its own (harness bug)",
    );
  }
  const bytes = (slice: string): number => Buffer.byteLength(slice, "utf8");
  const chainStart = bytes(text.slice(0, text.indexOf(T4_5_10_CHAIN)));
  return [
    file,
    chainStart,
    chainStart + bytes(T4_5_10_CHAIN),
    "references",
    [
      `${file}#g`,
      bytes(text.slice(0, unitStart)),
      bytes(text.slice(0, unitEnd)),
    ],
    T4_5_10_TARGET,
  ];
})();

// Arm (b): each container 4.5 names, one file each, the chain following the
// import within it — a function's body, an arrow function's, a class
// method's, a class static block (which binds no unit: `path#C`, T4.6-1), a
// namespace and its legacy `module` spelling (the same declaration, 4.6),
// and a string-named module declaration (binding no unit: `path`, 4.6) —
// then an import inside a top-level `if` block and, separately, inside a
// bare block, binding in the file's scope (no function, class static block,
// or namespace or module declaration enclosing it; TypeScript 5.9.3's binder
// places each in the file's own symbol table), so that the chain after the
// block is rooted at it (`path`); and a chain preceding the import in a
// function's body, an import binding its identifier throughout its scope,
// never from its position onward (`path#g`). Every file is a script (no
// top-level import or export), the if-block and bare-block files among them
// on the arm's one workspace, each rooting its chain at its own import.
const T4_5_10_B: readonly LaidOutT4510Staging<T4510RootedStaging>[] = (
  [
    {
      file: "src/function.ts",
      what: "the chain after the import in a function's body",
      text: 'function g() { import A from "../specs/A.xspec"; A.a.b }',
      unit: "g",
    },
    {
      file: "src/arrow.ts",
      what: "the chain after a block-nested import in an arrow function's body",
      text: 'const h = () => { { import A from "../specs/A.xspec" } A.a.b }',
      unit: "h",
    },
    {
      file: "src/method.ts",
      what: "the chain after a block-nested import in a class method's body",
      text: 'class C { m() { { import A from "../specs/A.xspec" } A.a.b } }',
      unit: "C.m",
    },
    {
      file: "src/static-block.ts",
      what: "the chain after a block-nested import in a class static block",
      text: 'class C { static { { import A from "../specs/A.xspec" } A.a.b } }',
      unit: "C",
    },
    {
      file: "src/namespace.ts",
      what: "the chain after a block-nested import in a namespace body",
      text: 'namespace N { { import A from "../specs/A.xspec" } A.a.b }',
      unit: "N",
    },
    {
      file: "src/legacy-module.ts",
      what: "the chain after the import in a namespace spelled `module M`",
      text: 'module M { import A from "../specs/A.xspec"; A.a.b }',
      unit: "M",
    },
    {
      file: "src/module-declaration.ts",
      what: 'the chain after the import in a string-named `declare module "m"`',
      text: 'declare module "m" { import A from "../specs/A.xspec"; A.a.b }',
      unit: null,
    },
    {
      file: "src/if-block.ts",
      what: "the chain after a top-level `if` block holding the import",
      text: 'if (c) { import A from "../specs/A.xspec" }\nA.a.b\n',
      unit: null,
    },
    {
      file: "src/bare-block.ts",
      what: "the chain after a top-level bare block holding the import",
      text: '{ import A from "../specs/A.xspec" }\nA.a.b\n',
      unit: null,
    },
    {
      file: "src/preceding.ts",
      what: "the chain preceding the import in a function's body",
      text: 'function g() { A.a.b; import A from "../specs/A.xspec" }',
      unit: "g",
    },
  ] satisfies readonly T4510RootedStaging[]
).map((staging) => layOutT4510Staging("b", staging));

// Arm (c): the visibility boundary — the chain spelled where the import's
// scope does not reach, one file each: after the function whose body holds
// the import; in a sibling function; in a method of the class whose static
// block holds it; in a second declaration of the namespace whose first
// holds it (a namespace declaration's scope, never the merged namespace's);
// and after a string-named module declaration holding it, `declare` or not
// (4). No binding of `A` is visible at any of these chains, so each is
// rooted at nothing — no edge, no occurrence, and no finding, none being a
// spec module reference.
const T4_5_10_C: readonly LaidOutT4510Staging<T4510Staging>[] = (
  [
    {
      file: "src/after-function.ts",
      what: "the chain after the function whose body holds the import",
      text: 'function g() { import A from "../specs/A.xspec" }\nA.a.b\n',
    },
    {
      file: "src/sibling-function.ts",
      what: "the chain in a sibling of the function holding the import",
      text: 'function g() { import A from "../specs/A.xspec" }\nfunction h() { A.a.b }',
    },
    {
      file: "src/static-block-method.ts",
      what: "the chain in a method of the class whose static block holds the import",
      text: 'class C { static { import A from "../specs/A.xspec" } m() { A.a.b } }',
    },
    {
      file: "src/namespace-redeclared.ts",
      what: "the chain in a second declaration of the namespace whose first holds the import",
      text: 'namespace N { import A from "../specs/A.xspec" }\nnamespace N { A.a.b }',
    },
    {
      file: "src/after-module-declaration.ts",
      what: 'the chain after a string-named `declare module "m"` holding the import',
      text: 'declare module "m" { import A from "../specs/A.xspec" }\nA.a.b\n',
    },
    {
      file: "src/after-undeclared-module.ts",
      what: 'the chain after an undeclared string-named `module "m"` holding the import',
      text: 'module "m" { import A from "../specs/A.xspec" }\nA.a.b\n',
    },
  ] satisfies readonly T4510Staging[]
).map((staging) => layOutT4510Staging("c", staging));

// Arm (f): the file boundary — an import's scope is at widest its own
// file's. `src/p.ts` holds a bare block's import of `A` and `src/q.ts` the
// chain alone, each a script to TypeScript (no top-level import or export),
// whose checker would merge their file-level declarations into one global
// scope and resolve `q.ts`'s `A` to `p.ts`'s import: under 4.5 that import
// binds in `p.ts`'s scope alone, so `q.ts`'s chain is rooted at nothing.
const T4_5_10_F_IMPORTING_FILE = "src/p.ts";
const T4_5_10_F_IMPORTING_SOURCE = stagedTs(
  "T4.5-10 (f) src/p.ts — a script whose bare block holds the import of `A`",
  '{ import A from "../specs/A.xspec" }\n',
);
const T4_5_10_F: LaidOutT4510Staging<T4510Staging> = layOutT4510Staging("f", {
  file: "src/q.ts",
  what: "a script spelling the chain `A.a.b` alone",
  text: "A.a.b\n",
});

/** The `files` of a workspace holding `specs/A.mdx` and the given stagings. */
function t4510Files(
  stagings: readonly LaidOutT4510Staging<T4510Staging>[],
): Record<string, InitialFileContents> {
  return {
    "specs/A.mdx": T4_5_10_SPEC_SOURCE,
    ...Object.fromEntries(
      stagings.map((laid) => [laid.staging.file, laid.source]),
    ),
  };
}

/**
 * Arm (a): SPEC.md's example builds and checks finding-free; the
 * workspace's one dependency edge is the marker's `references` edge from
 * `src/g.ts#g` to `specs/A.mdx#a.b`; and a bare `occurrences` answers
 * exactly the marker's record, its source `src/g.ts#g`.
 */
async function runT4510ArmA(product: ProductBinding): Promise<void> {
  await withWorkspace(T4_5_10_CONFIG, t4510Files([T4_5_10_A]), async (ws) => {
    const context = "T4.5-10 (a) over src/g.ts, SPEC.md's example";
    await expectCleanBuildAndCheck(
      product,
      ws,
      context,
      "the block-nested import declares `A` in `g`'s scope, so the chain " +
        "after the block is a marker rooted at it (SPEC 4.5)",
    );
    assertEdgeSetEqual(
      await queryDependencyEdges(product, ws, context),
      [{ from: "src/g.ts#g", to: T4_5_10_TARGET, kind: "references" }],
      `${context}: \`query edges\` — the marker's \`references\` edge from ` +
        `\`src/g.ts#g\`, the innermost enclosing named unit, to ` +
        `\`specs/A.mdx#a.b\` is the workspace's one dependency edge (SPEC ` +
        `4.5, 4.6) — never none, as from a product ignoring nested imports ` +
        `or scoping one to its block, which finds the marker rooted at nothing`,
    );
    assertSameJson(
      await validOccurrenceRecords(product, ws, ["occurrences"], context),
      [T4_5_10_A_RECORD],
      `${context}: \`occurrences\` lists exactly the marker's occurrence — ` +
        `spanning the bare chain \`A.a.b\`, its \`;\` excluded, kind ` +
        `\`references\`, its source \`src/g.ts#g\` with the unit's own range ` +
        `(\`function\` through the closing brace), its target ` +
        `\`specs/A.mdx#a.b\` (SPEC 5.7, 4.6, 1.7)`,
    );
  });
}

/**
 * Arm (b): the workspace holding every container's file builds and checks
 * finding-free, and its dependency edges are exactly one `references` edge
 * per file, from the location TEST-SPEC names to `specs/A.mdx#a.b`.
 */
async function runT4510ArmB(product: ProductBinding): Promise<void> {
  await withWorkspace(T4_5_10_CONFIG, t4510Files(T4_5_10_B), async (ws) => {
    const context =
      "T4.5-10 (b) over the chain beside its import in each container 4.5 " +
      "names, in top-level blocks, and before the import";
    await expectCleanBuildAndCheck(
      product,
      ws,
      context,
      "each import declares `A` in its own scope — the innermost function, " +
        "class static block, or namespace or module declaration enclosing " +
        "it, the file's where none does, never a block's — throughout that " +
        "scope, so each chain is a marker rooted at it (SPEC 4.5)",
    );
    assertEdgeSetEqual(
      await queryDependencyEdges(product, ws, context),
      T4_5_10_B.map(({ staging }) => ({
        from: stagingLocation(staging),
        to: T4_5_10_TARGET,
        kind: "references" as const,
      })),
      `${context}: \`query edges\` — each marker records its \`references\` ` +
        `edge to \`specs/A.mdx#a.b\` from its innermost enclosing named unit, ` +
        `or its file where none encloses it (a static block and a ` +
        `string-named module declaration binding no unit), and nothing else ` +
        `records one (SPEC 4.5, 4.6, T4.6-1): ` +
        T4_5_10_B.map(
          ({ staging }) => `${staging.what} → ${stagingLocation(staging)}`,
        ).join("; "),
    );
  });
}

/**
 * Arm (c): the workspace holding every boundary file builds and checks
 * finding-free, records no dependency edge, and `occurrences` answers no
 * record.
 */
async function runT4510ArmC(product: ProductBinding): Promise<void> {
  await withWorkspace(T4_5_10_CONFIG, t4510Files(T4_5_10_C), async (ws) => {
    const context =
      "T4.5-10 (c) over the chain spelled where the nested import's scope " +
      "does not reach";
    const visibility =
      "no binding of `A` is visible at any of the chains — a nested " +
      "import's scope is the declaration enclosing it, never the file's, a " +
      "sibling's, or a merged namespace's (SPEC 4.5) — so each is rooted at " +
      "nothing, no spec module reference: " +
      T4_5_10_C.map(({ staging }) => staging.what).join("; ");
    await expectCleanBuildAndCheck(
      product,
      ws,
      context,
      `${visibility} — never the unresolved spec module reference a ` +
        `product reading the chain as one reports`,
    );
    assertEdgeSetEqual(
      await queryDependencyEdges(product, ws, context),
      [],
      `${context}: \`query edges\` lists no dependency edge, none from any ` +
        `chain's location — ${visibility} — never the edges of a product ` +
        `rooting by name file-wide, or counting identifier-named namespace ` +
        `declarations alone among the containers`,
    );
    assertSameJson(
      await validOccurrenceRecords(product, ws, ["occurrences"], context),
      [],
      `${context}: \`occurrences\` lists no record — a chain rooted at ` +
        `nothing records no occurrence (SPEC 5.7, 11.2)`,
    );
  });
}

/**
 * Arm (f): the two scripts build and check finding-free, `query edges`
 * lists no edge from `src/q.ts`, and `occurrences --file src/q.ts` answers
 * no record.
 */
async function runT4510ArmF(product: ProductBinding): Promise<void> {
  const chainFile = T4_5_10_F.staging.file;
  await withWorkspace(
    T4_5_10_CONFIG,
    {
      ...t4510Files([T4_5_10_F]),
      [T4_5_10_F_IMPORTING_FILE]: T4_5_10_F_IMPORTING_SOURCE,
    },
    async (ws) => {
      const context =
        "T4.5-10 (f) over script src/q.ts's chain beside script src/p.ts's " +
        "bare-block import";
      const boundary =
        "an import's scope is at widest its own file's — `src/p.ts`'s " +
        "bare-block import binds in that file's scope alone (SPEC 4.5) — so " +
        "`src/q.ts`'s chain is rooted at nothing";
      await expectCleanBuildAndCheck(product, ws, context, boundary);
      assertEdgeSetEqual(
        (await queryDependencyEdges(product, ws, context)).filter(
          (edge) =>
            edge.from === chainFile || edge.from.startsWith(`${chainFile}#`),
        ),
        [],
        `${context}: \`query edges\` lists no edge from \`${chainFile}\` or ` +
          `a unit within it — ${boundary} — never the edge of a product ` +
          `rooting chains through a whole-program checker, which merges ` +
          `the two scripts' file-level declarations into one global scope`,
      );
      assertSameJson(
        await validOccurrenceRecords(
          product,
          ws,
          ["occurrences", "--file", chainFile],
          context,
        ),
        [],
        `${context}: \`occurrences --file ${chainFile}\` lists no record — ` +
          `a chain rooted at nothing records no occurrence (SPEC 5.7, 11.2)`,
      );
    },
  );
}

/** T4.5-10's arms in TEST-SPEC's order, each on a workspace of its own. */
const T4_5_10_ARMS: readonly {
  readonly key: string;
  readonly run: (product: ProductBinding) => Promise<void>;
}[] = [
  { key: "(a)", run: runT4510ArmA },
  { key: "(b)", run: runT4510ArmB },
  { key: "(c)", run: runT4510ArmC },
  { key: "(f)", run: runT4510ArmF },
];

/**
 * T4.5-10, nested import declarations' scope and rooting (SPEC 4.5): an
 * import declaration declares its bindings in its own scope — the file's at
 * top level, and for a nested one that of the innermost function, class
 * static block, or namespace or module declaration enclosing it, never a
 * block's — throughout that scope, and a chain rooted at it records its
 * `references` edge from its innermost enclosing unit (4.6) and its
 * occurrence (5.7). Arms (a), (b), (c), and (f), each on a workspace of its
 * own beside `specs/A.mdx` holding `a` and `a.b`, every file S-9
 * well-formed and none compiled (module header): (a) SPEC.md's example
 * roots its marker at the block-nested import, `g`'s edge and record; (b)
 * each container's chain, the top-level blocks' (scripts sharing the
 * workspace, each rooted at its own import), and a chain preceding its
 * import record their edges from the locations TEST-SPEC names; (c) a chain
 * where the import's scope does not reach records nothing and raises
 * nothing; (f) a script's chain beside another script's block-nested import
 * records nothing. Every arm runs, the diagnosed failures collected.
 */
const T4_5_10 = defineProductTest({
  id: "T4.5-10",
  title:
    "nested import declarations: scope and rooting — an import declares its bindings in its own scope, the file's at top level and a nested one's that of the innermost function, class static block, or namespace or module declaration enclosing it, never a block's, throughout that scope; every file S-9 well-formed and none compiled, each arm on a workspace of its own beside `specs/A.mdx` holding `a` and its child `a.b`, `build` and `check` exiting 0 with no finding on each: (a) SPEC.md's example, `src/g.ts` = `function g() { { import A from \"../specs/A.xspec\"; } A.a.b; }`, `query edges` holding exactly the marker's `references` edge from `src/g.ts#g` to `specs/A.mdx#a.b` and `occurrences` exactly its record spanning `A.a.b`, its source `src/g.ts#g` with the unit's own range; (b) the chain after the import in a function's body (`path#g`), after a block-nested import in an arrow function (`path#h`), a class method (`path#C.m`), a class static block (`path#C`), and a namespace (`path#N`), after the import in the legacy `module M` (`path#M`) and in `declare module \"m\"` (`path`), after a top-level `if` block and a bare block holding the import (scripts, each rooted at its own import, `path`), and before the import in a function's body (`path#g`) — `query edges` holding exactly each marker's `references` edge to `specs/A.mdx#a.b` from the location named; (c) the chain after the function holding the import, in a sibling function, in a method of the class whose static block holds it, in a second declaration of the namespace, and after a string-named module declaration holding it, `declare` or not — rooted at nothing: no dependency edge and no occurrence; (f) script `src/q.ts`'s `A.a.b` beside script `src/p.ts`'s bare-block import — no edge from `src/q.ts` and no record in `occurrences --file src/q.ts`; never the silence of a product ignoring nested imports, scoping one to its block, or binding one from its position onward, nor the edges of one rooting by name file-wide or through a whole-program checker (SPEC 4.5, 1.7, 2.4, 4.6, 5.7, 11.3)",
  run: async (product) => {
    const failures: string[] = [];
    for (const arm of T4_5_10_ARMS) {
      try {
        await arm.run(product);
      } catch (error) {
        if (!(error instanceof HarnessAssertionError)) throw error;
        // A failure diagnosed outside the arm's own assertions — the
        // subprocess driver's, say — is named by its arm too.
        const context = `T4.5-10 ${arm.key}`;
        failures.push(
          error.message.startsWith(context)
            ? error.message
            : `${context}: ${error.message}`,
        );
      }
    }
    if (failures.length > 0) {
      fail(
        `T4.5-10: ${String(failures.length)} of ` +
          `${String(T4_5_10_ARMS.length)} arms failed, each diagnosed:\n` +
          failures.map((failure) => `* ${failure}`).join("\n"),
      );
    }
  },
});

/** TEST-SPEC §4.5, second part, in canonical ID order (SUITE-15). */
export const section45iiTests: readonly ProductTestEntry[] = [T4_5_10];
