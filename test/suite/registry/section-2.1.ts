// TEST-SPEC §2.1 (imports) — SUITE-06: T2.1-1 … T2.1-6.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 2.1: the only imports permitted in an xspec source file are other spec
// modules, as a single default binding of a relative `./`/`../` specifier
// ending in `.xspec` whose designated `.mdx` file is a discovered source of a
// configured spec group; any other specifier, target, or binding form is
// invalid (14.15), import cycles are invalid (14.9), and an unused import is
// valid and records no edges.
//
// Location assertions: every offending import statement is staged at the very
// start of its file (prefix ""), all pure ASCII, so string indices are byte
// offsets and the 14.15 finding must fall within the import statement's own
// byte window (end-widened by one byte for line-granular locations, see
// support.ts byteWindow); every other staged construct lies beyond the
// following blank line, outside the widened window.

import type { Finding, ViewNode } from "../../helpers/adapters/index.js";
import {
  DEPENDENCY_EDGE_KINDS,
  decodeEdgesReport,
  decodeNodeReport,
  decodeViewReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertFileBytes,
  fail,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectFindingFreeReport,
  runJson,
  stageBesideRoot,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. Files
// outside `specs/` (the exists-but-undiscovered arm) belong to no group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// The same plus one code group whose glob matches `.mdx` files under `docs/`
// (SPEC 7.2): a file so matched is a discovered code source and no spec
// source, the target class of T2.1-2's code-group-only arm (2.1; T11.4-4's
// unavailable view target).
const SPECS_AND_DOCS_CODE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    docs: ["docs/**/*.mdx"]
  }
})
`;

// The escape character, built from its code point so that no tool layer
// decodes the six-character escape spellings staged below on their way into
// the file (the pattern of section-1.4.ts).
const BACKSLASH = String.fromCodePoint(0x5c);

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
  config: string = SPECS_ONLY_CONFIG,
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

// The importing file's body after its import statement(s): a blank separator
// line plus one ordinary section. It starts two bytes past the last import
// line's end, so it lies outside every import's end-widened byte window — and
// for the `S`/`Spec` binding arms it is the probe that construct recognition
// stays unambiguous (SPEC 2.1: the compiler-provided names are never
// shadowed), since a product that lets the offending import shadow `<S>`
// would report phantom conditions beside the one 14.15 and fail the
// exact-count assertion.
const IMPORTING_FILE_REST = '\n\n<S id="alpha">\nAlpha behavior.\n</S>\n';

// A valid imported module for arms where the target file legitimately
// exists — a staged-source record, since T2.1-2's and T2.1-3's later arms
// stage it after their bodies' first invocations (S-9's timing clause).
const VALID_BASE_FILES = {
  "specs/BASE.mdx": stagedMdx(
    "T2.1-2/T2.1-3 specs/BASE.mdx",
    '<S id="core">\nCore behavior.\n</S>\n',
  ),
} as const;

/** One invalid-import arm: a workspace differing only in its import line. */
interface InvalidImportArm {
  /** Which SPEC 2.1 invalid case this is (failure diagnostics). */
  readonly name: string;
  /** The offending import statement, staged at the very start of the file. */
  readonly importLine: string;
  /** Files staged beside the importing file and the configuration. */
  readonly extraFiles: Readonly<Record<string, InitialFileContents>>;
  /** Configuration override (defaults to SPECS_ONLY_CONFIG). */
  readonly config?: string;
  /**
   * Files staged OUTSIDE the workspace root, at paths relative to the root's
   * parent directory (support.ts stageBesideRoot) — the above-root arm's real
   * `outside/BASE.mdx`, which resolution must never reach (SPEC 2.1).
   */
  readonly outsideFiles?: Readonly<Record<string, string>>;
}

/** An invalid-import arm with its staged `specs/A.mdx` as a record. */
interface InvalidImportStaging {
  readonly arm: InvalidImportArm;
  /** `arm.importLine + IMPORTING_FILE_REST`, the file the arm stages. */
  readonly source: StagedMdx;
}

/**
 * Pair each arm of `testId` with its importing file as a staged-source
 * record, composed once at module load — the arms' workspaces (all but a
 * body's first) are created after the body's first product invocation, so
 * S-9's timing clause makes each a ledger record; the whole table converts
 * uniformly.
 */
function invalidImportStagings(
  testId: string,
  arms: readonly InvalidImportArm[],
): readonly InvalidImportStaging[] {
  return arms.map((arm) => ({
    arm,
    source: stagedMdx(
      `${testId} ${arm.name} specs/A.mdx`,
      arm.importLine + IMPORTING_FILE_REST,
    ),
  }));
}

/**
 * Run one invalid-import arm: `build --json` exits 1 with exactly one
 * finding, condition 14.15, located within the import statement's own byte
 * window in the importing file (SPEC 14: errors identify file and location).
 */
async function runInvalidImportArm(
  product: ProductBinding,
  { arm, source }: InvalidImportStaging,
  testId: string,
): Promise<void> {
  const context = `${testId} \`build --json\` over ${arm.name}`;
  await withWorkspace(
    {
      ...arm.extraFiles,
      "specs/A.mdx": source,
    },
    async (workspace) => {
      await stageBesideRoot(workspace, arm.outsideFiles ?? {});
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(findings, { "14.15": 1 }, context);
      assertFindingLocated(
        findings[0]!,
        { file: "specs/A.mdx", window: byteWindow("", arm.importLine) },
        `${context}: the 14.15 finding`,
      );
    },
    arm.config,
  );
}

// T2.1-1: the SPEC 2.1 worked form. `BASE.mdx` is a discovered file of the
// configured spec group; a `d` reference through the binding must resolve to
// the imported file's node (an unresolved reference would be 14.5, and a
// misresolved one records the wrong edge target).
const T2_1_1_BASE_SOURCE = [
  '<S id="auth">',
  "Auth behavior.",
  "",
  '<S id="auth.login">',
  "Login behavior.",
  "</S>",
  "</S>",
  "",
].join("\n");

const T2_1_1_IMPORTER_SOURCE = [
  'import BASE from "./BASE.xspec"',
  "",
  '<S id="derived" d={BASE.auth.login}>',
  "Derived behavior.",
  "</S>",
  "",
].join("\n");

const T2_1_1 = defineProductTest({
  id: "T2.1-1",
  title:
    "a valid default import of a discovered spec-group file builds, and references through the binding resolve (SPEC 2.1)",
  run: async (product) => {
    await withWorkspace(
      {
        "specs/BASE.mdx": T2_1_1_BASE_SOURCE,
        "specs/A.mdx": T2_1_1_IMPORTER_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.1-1 `build` with a valid spec import",
        );
        const context = "T2.1-1 `query edges --from specs/A.mdx#derived`";
        const edges = decodeEdgesReport(
          await runJson(
            product,
            workspace,
            ["query", "edges", "--from", "specs/A.mdx#derived"],
            context,
          ),
          context,
        );
        // `derived` is a childless section, so the reference through the
        // binding is its complete outgoing edge set: exactly one `depends`
        // edge to the imported file's node (SPEC 2.1, 2.2, 5.2).
        assertEdgeSetEqual(
          edges,
          [
            {
              from: "specs/A.mdx#derived",
              to: "specs/BASE.mdx#auth.login",
              kind: "depends",
            },
          ],
          `${context}: the reference through the import binding resolves to the ` +
            "imported file's node (SPEC 2.1)",
        );
      },
    );
  },
});

// T2.1-2, invalid-specifier arms (SPEC 2.1: a specifier must be relative,
// begin with `./` or `../`, end in `.xspec`, and designate a discovered
// spec-group source). Each arm stages a legitimately existing `specs/BASE.mdx`
// so the specifier's form or target is the only defect.
const INVALID_SPECIFIER_ARMS: readonly InvalidImportArm[] = [
  {
    name: "an absolute specifier",
    importLine: 'import BASE from "/specs/BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    name: "a bare (non-relative) specifier",
    importLine: 'import BASE from "BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    name: "a relative specifier not ending in `.xspec` (naming the `.mdx` file directly)",
    importLine: 'import BASE from "./BASE.mdx"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    // `../docs/EXTRA.xspec` from `specs/` designates `docs/EXTRA.mdx`, which
    // exists on disk but is matched by no configured spec group.
    name: "a specifier designating a file that exists but is not a discovered source of any configured spec group",
    importLine: 'import EXTRA from "../docs/EXTRA.xspec"',
    extraFiles: {
      ...VALID_BASE_FILES,
      "docs/EXTRA.mdx": stagedMdx(
        "T2.1-2 docs/EXTRA.mdx matched by no spec group",
        '<S id="extra">\nOutside every spec group.\n</S>\n',
      ),
    },
  },
  {
    name: "a relative `.xspec` specifier whose designated file does not exist (`./typo.xspec` with no `typo.mdx`)",
    importLine: 'import TYPO from "./typo.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    // `docs/EXTRA.mdx` is matched only by the code group `docs` (SPEC 7.2):
    // a discovered code source, never a spec source. Its content is
    // well-formed TypeScript, so the code source itself contributes no
    // finding and the import's 14.15 stands alone.
    name: "a specifier designating an `.mdx` file matched only by a code group (a discovered code source)",
    importLine: 'import EXTRA from "../docs/EXTRA.xspec"',
    extraFiles: {
      ...VALID_BASE_FILES,
      "docs/EXTRA.mdx": stagedMdx(
        "T2.1-2 docs/EXTRA.mdx matched only by a code group",
        "export {};\n",
      ),
    },
    config: SPECS_AND_DOCS_CODE_CONFIG,
  },
  {
    // From `specs/` (depth 1) the two `..` segments reach depth -1: the
    // ascent passes above the workspace root, so the specifier designates
    // nothing (SPEC 2.1) although the root's parent really holds
    // `outside/BASE.mdx` — the discriminator against filesystem resolution.
    name: "a specifier whose ascent passes above the workspace root, the root's parent holding a real `outside/BASE.mdx`",
    importLine: 'import BASE from "../../outside/BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
    outsideFiles: {
      "outside/BASE.mdx": '<S id="core">\nCore behavior, outside.\n</S>\n',
    },
  },
  {
    // The six-character escape of `A` in the name segment is read verbatim
    // (SPEC 2.4): the segment spells a name containing the escape character,
    // which no discovered path spells. `specs/BASE.mdx` exists, so a product
    // interpreting the escape resolves the import, builds clean, and fails
    // the arm.
    name: `a specifier spelled with an escape sequence ("./B${BACKSLASH}u0041SE.xspec"), read verbatim`,
    importLine: `import BASE from "./B${BACKSLASH}u0041SE.xspec"`,
    extraFiles: VALID_BASE_FILES,
  },
];

const INVALID_SPECIFIER_STAGINGS = invalidImportStagings(
  "T2.1-2",
  INVALID_SPECIFIER_ARMS,
);

// T2.1-2, positive arm: `../` resolves against the importing file's
// directory. Run from the workspace root, `../BASE.xspec` resolves correctly
// only relative to `specs/sub/` — a product resolving against the working
// directory or the workspace root would escape the root or miss the file, and
// one resolving to any other node records the wrong edge target.
const PARENT_SPECIFIER_IMPORTER = [
  'import BASE from "../BASE.xspec"',
  "",
  '<S id="derived" d={BASE.core}>',
  "Derived behavior.",
  "</S>",
  "",
].join("\n");

// T2.1-2, lexical positives (SPEC 2.1: resolution is lexical — a `.` or
// empty segment designates the same directory and `..` the parent — and no
// spelling is required to be canonical). Four importers in `specs/`, each
// spelling `specs/BASE.mdx` non-canonically, share one workspace that holds
// no `specs/sub/` at all, so `./sub/../BASE.xspec` resolves only lexically —
// a product resolving through the filesystem, or requiring the canonical
// spelling, fails that arm. Each import line is its file's only import
// declaration.
const LEXICAL_IMPORTERS: readonly {
  readonly file: string;
  readonly section: string;
  readonly specifier: string;
}[] = [
  { file: "specs/P1.mdx", section: "p1", specifier: "./sub/../BASE.xspec" },
  { file: "specs/P2.mdx", section: "p2", specifier: ".//BASE.xspec" },
  { file: "specs/P3.mdx", section: "p3", specifier: "././BASE.xspec" },
  { file: "specs/P4.mdx", section: "p4", specifier: "../specs/BASE.xspec" },
];

function lexicalImporterSource(importer: {
  readonly section: string;
  readonly specifier: string;
}): string {
  return [
    `import BASE from "${importer.specifier}"`,
    "",
    `<S id="${importer.section}" d={BASE.core}>`,
    "Derived behavior.",
    "</S>",
    "",
  ].join("\n");
}

// The lexical workspace is created after the `../` arm's invocations, so
// its four importers are staged-source records, computed once at module
// load from the table above (S-9's timing clause).
const LEXICAL_IMPORTER_FILES: Readonly<Record<string, StagedMdx>> =
  Object.fromEntries(
    LEXICAL_IMPORTERS.map((importer) => [
      importer.file,
      stagedMdx(
        `T2.1-2 lexical importer ${importer.file}`,
        lexicalImporterSource(importer),
      ),
    ]),
  );

const T2_1_2 = defineProductTest({
  id: "T2.1-2",
  title: `\`../\` specifiers resolve against the importing file's directory, and resolution is lexical: \`./sub/../BASE.xspec\` (no \`sub/\` on disk), \`.//BASE.xspec\`, \`././BASE.xspec\`, and \`../specs/BASE.xspec\` each designate specs/BASE.mdx — the import valid, the reference through it resolving, \`view\` reporting the resolved target; absolute, bare, non-\`.xspec\`, undiscovered-target (an \`.mdx\` matched by no group; one matched only by a code group), nonexistent-target, above-the-root (a real \`outside/BASE.mdx\` at the root's parent), and escape-spelled ("./B${BACKSLASH}u0041SE.xspec", read verbatim) specifiers each fail with 14.15 (SPEC 2.1, 2.4, 14.15; T11.4-4)`,
  run: async (product) => {
    await withWorkspace(
      {
        ...VALID_BASE_FILES,
        "specs/sub/A.mdx": PARENT_SPECIFIER_IMPORTER,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.1-2 `build` with a `../` specifier",
        );
        const context = "T2.1-2 `query edges --from specs/sub/A.mdx#derived`";
        const edges = decodeEdgesReport(
          await runJson(
            product,
            workspace,
            ["query", "edges", "--from", "specs/sub/A.mdx#derived"],
            context,
          ),
          context,
        );
        assertEdgeSetEqual(
          edges,
          [
            {
              from: "specs/sub/A.mdx#derived",
              to: "specs/BASE.mdx#core",
              kind: "depends",
            },
          ],
          `${context}: \`../BASE.xspec\` resolves against the importing file's ` +
            "directory (specs/sub/) to specs/BASE.mdx (SPEC 2.1)",
        );
      },
    );
    // Lexical positives: one workspace, four non-canonical spellings of
    // specs/BASE.mdx, no specs/sub/ on disk (module comment above).
    await withWorkspace(
      { ...VALID_BASE_FILES, ...LEXICAL_IMPORTER_FILES },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.1-2 `build` with four non-canonical specifiers of " +
            "specs/BASE.mdx (`./sub/../`, `.//`, `././`, `../specs/`; no " +
            "specs/sub/ on disk) — each import is valid (SPEC 2.1)",
        );
        for (const importer of LEXICAL_IMPORTERS) {
          const node = `${importer.file}#${importer.section}`;
          const context = `T2.1-2 \`query edges --from ${node}\``;
          const edges = decodeEdgesReport(
            await runJson(
              product,
              workspace,
              ["query", "edges", "--from", node],
              context,
            ),
            context,
          );
          assertEdgeSetEqual(
            edges,
            [{ from: node, to: "specs/BASE.mdx#core", kind: "depends" }],
            `${context}: \`${importer.specifier}\` resolves lexically to ` +
              "specs/BASE.mdx, so the reference through the binding " +
              "resolves to its node (SPEC 2.1, 2.2)",
          );
        }
        // `view` reports each import's resolved target — the designated
        // file, never the specifier's spelling (SPEC 11.4; T11.4-4). One
        // bare whole-domain `view`: the five discovered sources in byte
        // order of path, BASE first.
        const viewContext = "T2.1-2 bare `view` over the lexical workspace";
        const report = decodeViewReport(
          await runJson(product, workspace, ["view"], viewContext),
          { text: false },
          viewContext,
        );
        assertConditionCounts(
          report.findings,
          {},
          `${viewContext}: every non-canonical specifier is valid, so no ` +
            "finding accompanies the view (SPEC 2.1, 11.4)",
        );
        assertSameJson(
          report.views.map((view) => view.file),
          ["specs/BASE.mdx", ...LEXICAL_IMPORTERS.map((i) => i.file)],
          `${viewContext}: every discovered spec source is viewed, in byte ` +
            "order of workspace-relative path (SPEC 11.4, 12.7)",
        );
        for (const [index, importer] of LEXICAL_IMPORTERS.entries()) {
          const view = report.views[index + 1]!;
          assertSameJson(
            view.imports.map((entry) => ({
              name: entry.name,
              target: entry.target,
            })),
            [{ name: "BASE", target: "specs/BASE.mdx" }],
            `${viewContext} — ${importer.file}: its one import declaration ` +
              `(\`${importer.specifier}\`) binds BASE and reports the ` +
              "resolved target specs/BASE.mdx — the designated file, not " +
              "the specifier's spelling (SPEC 2.1, 11.4; T11.4-4)",
          );
        }
      },
    );
    for (const staging of INVALID_SPECIFIER_STAGINGS) {
      await runInvalidImportArm(product, staging, "T2.1-2");
    }
  },
});

// T2.1-3, invalid binding forms (SPEC 2.1: the only permitted form is a
// single default binding, and no import may bind `S`, `Spec`, or `text`).
const INVALID_BINDING_ARMS: readonly InvalidImportArm[] = [
  {
    name: "a named import from a `.xspec` specifier",
    importLine: 'import { core } from "./BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    name: "a namespace import from a `.xspec` specifier",
    importLine: 'import * as BASE from "./BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    name: "a side-effect-only import from a `.xspec` specifier",
    importLine: 'import "./BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    name: "an import binding the compiler-provided identifier `S`",
    importLine: 'import S from "./BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    name: "an import binding the compiler-provided identifier `Spec`",
    importLine: 'import Spec from "./BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
  {
    name: "an import binding the compiler-provided identifier `text`",
    importLine: 'import text from "./BASE.xspec"',
    extraFiles: VALID_BASE_FILES,
  },
];

const INVALID_BINDING_STAGINGS = invalidImportStagings(
  "T2.1-3",
  INVALID_BINDING_ARMS,
);

// T2.1-3, positive arm: two imports binding the same module under different
// names. Each binding is exercised by its own section's `d` reference, so
// validity is grounded in both bindings actually resolving. The arm's
// workspace is created after the invalid-binding arms' invocations, so both
// sources are staged-source records (S-9's timing clause).
const TWO_LEAF_BASE_SOURCE = stagedMdx(
  "T2.1-3 two-names arm specs/BASE.mdx",
  [
    '<S id="a">',
    "Leaf a.",
    "</S>",
    "",
    '<S id="b">',
    "Leaf b.",
    "</S>",
    "",
  ].join("\n"),
);

const TWO_NAMES_IMPORTER_SOURCE = stagedMdx(
  "T2.1-3 two-names arm specs/A.mdx",
  [
    'import BASE from "./BASE.xspec"',
    'import ALSO from "./BASE.xspec"',
    "",
    '<S id="one" d={BASE.a}>',
    "Uses the first binding.",
    "</S>",
    "",
    '<S id="two" d={ALSO.b}>',
    "Uses the second binding.",
    "</S>",
    "",
  ].join("\n"),
);

// T2.1-3, duplicate-binding arms: two imports of two different modules
// binding the one identifier `BASE` (SPEC 2.1: no two imports in a file may
// bind the same identifier — 14.15 in a well-formed file, never 14.20). SPEC
// 14.20 decides well-formedness by derivability alone, and a duplicate
// lexically declared name is an ECMAScript early error — excluded from
// derivability — so the file is well-formed under both stagings the condition
// distinguishes: the two declarations in one ESM block (consecutive lines, no
// blank line between — the arm a product delegating ECMAScript's early errors
// to its parser fails, T14-12) and in separate blocks (a blank line between
// them ends the first block, 2.7). Each import line is a known byte range for
// the location assertion.
const DUP_BINDING_FIRST = 'import BASE from "./B1.xspec"';
const DUP_BINDING_SECOND = 'import BASE from "./B2.xspec"';

/** One duplicate-binding staging: the two declarations joined by `separator`. */
interface DuplicateBindingArm {
  readonly name: string;
  /** What stands between the declarations: one ESM block, or two. */
  readonly separator: "\n" | "\n\n";
  /** The staged `specs/A.mdx`: both declarations, then the file's rest. */
  readonly source: StagedMdx;
}

/**
 * Compose an arm's `specs/A.mdx` into its staged-source record — the arms'
 * workspaces are created after the body's first invocation (S-9's timing
 * clause). S-9: two imports binding one identifier are an ECMAScript early
 * error 14.20 admits — the named allowance. It covers the separate-blocks
 * staging too: the stock parser judges all of a file's ESM blocks as one
 * module, so it rejects the second declaration under the same rule beyond
 * derivability ("Identifier 'BASE' has already been declared").
 */
function duplicateBindingArm(
  name: string,
  separator: DuplicateBindingArm["separator"],
): DuplicateBindingArm {
  return {
    name,
    separator,
    source: stagedMdx(
      `T2.1-3 two imports binding one identifier in ${name} specs/A.mdx`,
      `${DUP_BINDING_FIRST}${separator}${DUP_BINDING_SECOND}${IMPORTING_FILE_REST}`,
      { allowances: ["duplicate-import-binding"] },
    ),
  };
}

const DUPLICATE_BINDING_ARMS: readonly DuplicateBindingArm[] = [
  duplicateBindingArm("one ESM block (consecutive lines)", "\n"),
  duplicateBindingArm("separate ESM blocks (a blank line between)", "\n\n"),
];

// The two modules the colliding imports designate, staged in both arms.
const DUP_BINDING_B1 = stagedMdx(
  "T2.1-3 duplicate-binding arms specs/B1.mdx",
  '<S id="b1">\nFirst module.\n</S>\n',
);
const DUP_BINDING_B2 = stagedMdx(
  "T2.1-3 duplicate-binding arms specs/B2.mdx",
  '<S id="b2">\nSecond module.\n</S>\n',
);

/**
 * Run one duplicate-binding arm: `build --json` exits 1 and every finding is
 * 14.15 — never 14.20 — located within one of the two colliding import
 * statements' byte windows. SPEC 2.1 defines one condition over the colliding
 * pair; whether a product reports the collision once or per import is not
 * fixed, so one or two findings are accepted — every one of them must be
 * 14.15, name the file, and point at one of the two import statements.
 */
async function runDuplicateBindingArm(
  product: ProductBinding,
  arm: DuplicateBindingArm,
): Promise<void> {
  const context =
    "T2.1-3 `build --json` over two imports binding the same identifier in " +
    arm.name;
  await withWorkspace(
    {
      "specs/B1.mdx": DUP_BINDING_B1,
      "specs/B2.mdx": DUP_BINDING_B2,
      "specs/A.mdx": arm.source,
    },
    async (workspace) => {
      const findings = await buildFindings(product, workspace, context);
      const conditions = findings.map((finding) => finding.condition);
      if (
        findings.length < 1 ||
        findings.length > 2 ||
        conditions.some((condition) => condition !== "14.15")
      ) {
        fail(
          `${context}: expected the colliding pair to report condition 14.15 — ` +
            `one finding for the collision, or one per import — and never ` +
            `14.20: the file is well-formed, a duplicate lexically declared ` +
            `name being an early error excluded from derivability (SPEC ` +
            `14.20); got ${JSON.stringify(conditions)}`,
        );
      }
      const windows = [
        byteWindow("", DUP_BINDING_FIRST),
        byteWindow(`${DUP_BINDING_FIRST}${arm.separator}`, DUP_BINDING_SECOND),
      ];
      for (const finding of findings) {
        const findingContext = `${context}: a 14.15 finding`;
        assertFindingLocated(finding, { file: "specs/A.mdx" }, findingContext);
        for (const { range } of finding.locations) {
          const within = windows.some(
            (window) => range.start >= window.start && range.end <= window.end,
          );
          if (!within) {
            fail(
              `${findingContext}: every location [${String(range.start)}, ` +
                `${String(range.end)}) must point at one of the two colliding ` +
                `import statements (byte windows ${JSON.stringify(windows)})`,
            );
          }
        }
      }
    },
  );
}

const T2_1_3 = defineProductTest({
  id: "T2.1-3",
  title:
    "named, namespace, and side-effect-only imports, duplicate-identifier bindings (in one ESM block and in separate blocks — 14.15 in a well-formed file, never 14.20), and bindings of `S`/`Spec`/`text` each fail with 14.15; two imports binding one module under different names are valid (SPEC 2.1, 14.15, 14.20)",
  run: async (product) => {
    for (const staging of INVALID_BINDING_STAGINGS) {
      await runInvalidImportArm(product, staging, "T2.1-3");
    }

    // Positive arm: same module, two names — valid, and both bindings work.
    await withWorkspace(
      {
        "specs/BASE.mdx": TWO_LEAF_BASE_SOURCE,
        "specs/A.mdx": TWO_NAMES_IMPORTER_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.1-3 `build` with two imports binding one module under different names",
        );
        const context = "T2.1-3 `query edges --kinds depends`";
        const edges = decodeEdgesReport(
          await runJson(
            product,
            workspace,
            ["query", "edges", "--kinds", "depends"],
            context,
          ),
          context,
        );
        assertEdgeSetEqual(
          edges,
          [
            {
              from: "specs/A.mdx#one",
              to: "specs/BASE.mdx#a",
              kind: "depends",
            },
            {
              from: "specs/A.mdx#two",
              to: "specs/BASE.mdx#b",
              kind: "depends",
            },
          ],
          `${context}: both bindings of the one module resolve (SPEC 2.1)`,
        );
      },
    );

    // Duplicate-binding arms: the two declarations in one ESM block, then in
    // separate blocks — 14.15 under both, never 14.20.
    for (const arm of DUPLICATE_BINDING_ARMS) {
      await runDuplicateBindingArm(product, arm);
    }
  },
});

const T2_1_4 = defineProductTest({
  id: "T2.1-4",
  title:
    "an import whose binding is never used builds successfully and records no edges (SPEC 2.1, 5.2)",
  run: async (product) => {
    await withWorkspace(
      {
        "specs/BASE.mdx": '<S id="beta">\nBeta behavior.\n</S>\n',
        "specs/A.mdx": 'import BASE from "./BASE.xspec"' + IMPORTING_FILE_REST,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.1-4 `build` with an unused import",
        );
        // `query edges --from` each of the importing file's nodes (the root
        // and its one section): the unused import records no edges, so no
        // dependency-kind edge (depends/embeds/references — the only kinds
        // source constructs record, SPEC 5.2) and no edge toward the imported
        // file may leave them. Structural `contains` edges inside the
        // importing file are document structure, present with or without the
        // import, and permitted.
        for (const node of ["specs/A.mdx", "specs/A.mdx#alpha"]) {
          const context = `T2.1-4 \`query edges --from ${node}\``;
          const edges = decodeEdgesReport(
            await runJson(
              product,
              workspace,
              ["query", "edges", "--from", node],
              context,
            ),
            context,
          );
          const recorded = edges.filter(
            (edge) =>
              (DEPENDENCY_EDGE_KINDS as readonly string[]).includes(
                edge.kind,
              ) || edge.to.startsWith("specs/BASE.mdx"),
          );
          if (recorded.length > 0) {
            fail(
              `${context}: an unused import records no edges (SPEC 2.1) — no ` +
                `dependency-kind edge, and none toward the imported file, may ` +
                `leave the importing file's nodes; got ${JSON.stringify(recorded)}`,
            );
          }
        }
      },
    );
  },
});

// T2.1-5, two-file arm. The import cycle is A ↔ B, while the requirement-
// level dependency edges are acyclic by construction — `x → y` and `z → w`
// reach only childless sections with no outgoing dependency edges, so the
// combined contains/depends/embeds graph of SPEC 5.3 has no cycle and 14.9
// can only be the spec import cycle.
const CYCLE_A_SOURCE = [
  'import B from "./B.xspec"',
  "",
  '<S id="x" d={B.y}>',
  "Depends across files, acyclically.",
  "</S>",
  "",
  '<S id="w">',
  "Target of the other file's dependency.",
  "</S>",
  "",
].join("\n");

const CYCLE_B_SOURCE = [
  'import A from "./A.xspec"',
  "",
  '<S id="y">',
  "Target of the other file's dependency.",
  "</S>",
  "",
  '<S id="z" d={A.w}>',
  "Depends across files, acyclically.",
  "</S>",
  "",
].join("\n");

// The self-import arm: the import cycle of length one exists whether or not
// the binding is used, so it stays unused — the import itself is the defect.
// Its workspace is created after the two-file arm's invocation, so the
// source is a staged-source record (S-9's timing clause).
const SELF_IMPORT_SOURCE = stagedMdx(
  "T2.1-5 self-import specs/SELF.mdx",
  'import SELF from "./SELF.xspec"' + IMPORTING_FILE_REST,
);

/**
 * Assert an import-cycle report: every finding is 14.9 (nothing else is
 * present in these fixtures — both files parse, and every reference
 * resolves), at most one finding per participating file (whether a product
 * reports a cycle once or per file is not fixed), and the report identifies
 * every participating file (SPEC 14: actionable errors identify the file —
 * each participating import declaration located in the file containing it)
 * through any of a finding's located files, message, or identity context.
 */
function assertImportCycleFindings(
  findings: readonly Finding[],
  expectedFiles: readonly string[],
  context: string,
): void {
  const conditions = findings.map((finding) => finding.condition);
  if (
    findings.length < 1 ||
    findings.length > expectedFiles.length ||
    conditions.some((condition) => condition !== "14.9")
  ) {
    fail(
      `${context}: expected the spec import cycle to report condition 14.9 — one ` +
        `finding for the cycle, or at most one per participating file ` +
        `(${String(expectedFiles.length)}) — got ${JSON.stringify(conditions)}`,
    );
  }
  const identified = findings
    .map((finding) =>
      [
        finding.message,
        ...finding.locations.map((location) => renderPathValue(location.file)),
        ...finding.identities,
      ].join("\n"),
    )
    .join("\n");
  for (const file of expectedFiles) {
    if (!identified.includes(file)) {
      fail(
        `${context}: the 14.9 report must identify the cycle's participating file ` +
          `${JSON.stringify(file)} (SPEC 14: actionable errors identify the file); ` +
          `findings: ${JSON.stringify(findings)}`,
      );
    }
  }
}

const T2_1_5 = defineProductTest({
  id: "T2.1-5",
  title:
    "a two-file spec import cycle fails with 14.9 even when no requirement-level dependency cycle exists; a file importing itself fails as a length-one import cycle (SPEC 2.1, 14.9)",
  run: async (product) => {
    await withWorkspace(
      { "specs/A.mdx": CYCLE_A_SOURCE, "specs/B.mdx": CYCLE_B_SOURCE },
      async (workspace) => {
        const context =
          "T2.1-5 `build --json` over a two-file spec import cycle " +
          "(requirement-level dependencies acyclic)";
        assertImportCycleFindings(
          await buildFindings(product, workspace, context),
          ["specs/A.mdx", "specs/B.mdx"],
          context,
        );
      },
    );
    await withWorkspace(
      { "specs/SELF.mdx": SELF_IMPORT_SOURCE },
      async (workspace) => {
        const context = "T2.1-5 `build --json` over a file importing itself";
        assertImportCycleFindings(
          await buildFindings(product, workspace, context),
          ["specs/SELF.mdx"],
          context,
        );
      },
    );
  },
});

/** TEST-SPEC §2.1, in canonical ID order (SUITE-06). */
// T2.1-6: an ESM block inside a section element. SPEC 14.20 decides
// well-formedness by derivability alone, and the MDX grammar derives an ESM
// block wherever flow content may stand — inside a section element too, the
// form 6.5's in-section exclusion presupposes and T6.5-17 refuses as moved
// text. The block is separated from the tag line and from the body line by a
// blank line on each side, so it interrupts no paragraph and runs to its
// blank line (2.7). A sibling section outside `m` references the binding
// through its `d` value, so the binding resolves from inside the section (the
// embedding) and from outside it (SPEC 2.1). Everything staged is ASCII, so
// string lengths are byte counts (SPEC 1.7).
const T2_1_6_DECLARATION = 'import X from "./X.xspec"';
const T2_1_6_DECLARATION_PREFIX = '<S id="m">\n\n';
const T2_1_6_SOURCE =
  T2_1_6_DECLARATION_PREFIX +
  T2_1_6_DECLARATION +
  "\n\nbody {text(X.a)}\n</S>\n\n" +
  '<S id="n" d={X.a}>\nSibling uses the binding.\n</S>\n';
// The target: an in-line section whose subtree text is exactly `Alpha text.`
// (SPEC 3: the tag pair deleted in place; the line's terminator lies outside
// the construct), so the embedding above expands mid-line with no terminator
// of its own.
const T2_1_6_TARGET_SOURCE = '<S id="a">Alpha text.</S>\n';
// The declaration's source range — its own characters (SPEC 11.4, 1.7).
const T2_1_6_DECLARATION_RANGE = {
  start: Buffer.byteLength(T2_1_6_DECLARATION_PREFIX, "utf8"),
  end:
    Buffer.byteLength(T2_1_6_DECLARATION_PREFIX, "utf8") +
    Buffer.byteLength(T2_1_6_DECLARATION, "utf8"),
};
// Hand-derived per SPEC 3: `m`'s tag-only lines and the declaration's line
// each drop with their terminators (left empty purely by removals); the blank
// source lines keep theirs; the embedding is replaced in place by `a`'s
// subtree text. `m` has no child, so its own text is its subtree text — the
// construct's whole contribution (SPEC 1.6).
const T2_1_6_M_TEXT = "\n\nbody Alpha text.\n";
// The file: `m`'s contribution, the blank line between the sections, then
// `n`'s (its tag-only lines dropping alike).
const T2_1_6_COMPILED = `${T2_1_6_M_TEXT}\nSibling uses the binding.\n`;

// SPECS_ONLY_CONFIG plus Markdown emission enabled (SPEC 7.3), for the
// byte-asserted compiled output.
const SPECS_ONLY_EMITTING_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;

/** The positional section tree's identities and nesting (SPEC 11.4). */
function treeShape(node: ViewNode): unknown {
  return { identity: node.identity, children: node.children.map(treeShape) };
}

const T2_1_6 = defineProductTest({
  id: "T2.1-6",
  title:
    "an ESM block inside a section element derives: the file builds with `check` clean, the binding resolves from inside the section and from a sibling outside it, the declaration's line drops from the compiled Markdown and from the section's own text, `view` lists the declaration under `imports`, and the `contains` structure is as without the block (SPEC 2.1, 14.20, 3, 1.6, 11.4)",
  run: async (product) => {
    await withWorkspace(
      {
        "specs/X.mdx": T2_1_6_TARGET_SOURCE,
        "specs/A.mdx": T2_1_6_SOURCE,
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.1-6 `build` over an ESM block inside a section element — " +
            "well-formed, derivability alone deciding (SPEC 14.20, 2.1)",
        );
        await expectFindingFreeReport(
          product,
          workspace,
          ["check", "--json"],
          "T2.1-6 `check` after the build (SPEC 12.2)",
        );

        // References through the binding resolve from inside the section
        // (the embedding) and from the sibling outside it (the `d` value):
        // exactly one edge leaves each node — in particular no `contains`
        // edge leaves `m`, which holds no node (SPEC 2.1, 5.2).
        const referencingNodes = [
          { node: "specs/A.mdx#m", kind: "embeds" },
          { node: "specs/A.mdx#n", kind: "depends" },
        ] as const;
        for (const { node, kind } of referencingNodes) {
          const context = `T2.1-6 \`query edges --from ${node}\``;
          const edges = decodeEdgesReport(
            await runJson(
              product,
              workspace,
              ["query", "edges", "--from", node],
              context,
            ),
            context,
          );
          assertEdgeSetEqual(
            edges,
            [{ from: node, to: "specs/X.mdx#a", kind }],
            `${context}: the reference through the in-section binding ` +
              `resolves (SPEC 2.1), and no other edge leaves the node`,
          );
        }

        // The `contains` structure is as without the block: the root
        // containing `m` and its sibling, `m` containing no node.
        const containsContext = "T2.1-6 `query edges --kinds contains`";
        const contains = decodeEdgesReport(
          await runJson(
            product,
            workspace,
            ["query", "edges", "--kinds", "contains"],
            containsContext,
          ),
          containsContext,
        );
        assertEdgeSetEqual(
          contains,
          [
            { from: "specs/A.mdx", to: "specs/A.mdx#m", kind: "contains" },
            { from: "specs/A.mdx", to: "specs/A.mdx#n", kind: "contains" },
            { from: "specs/X.mdx", to: "specs/X.mdx#a", kind: "contains" },
          ],
          `${containsContext}: the root contains \`m\` and its sibling, and ` +
            `\`m\` contains no node — the structure as without the block ` +
            `(SPEC 1.2, 5.2)`,
        );

        // Compiled Markdown, byte-asserted with emission enabled (SPEC 3).
        await assertFileBytes(
          workspace.path("specs/A.md"),
          T2_1_6_COMPILED,
          "T2.1-6 specs/A.md: the declaration removed and its line dropped " +
            "with its terminator, the tag-only lines dropped, the blank " +
            "lines kept, the embedding replaced in place (SPEC 3, 13.2)",
        );

        // The section's own text (SPEC 1.6): the empty lines kept, the
        // declaration's line gone.
        const nodeContext = "T2.1-6 `query node specs/A.mdx#m`";
        const node = decodeNodeReport(
          await runJson(
            product,
            workspace,
            ["query", "node", "specs/A.mdx#m"],
            nodeContext,
          ),
          nodeContext,
        );
        if (node.identity !== "specs/A.mdx#m") {
          fail(
            `${nodeContext}: expected the report to be about ` +
              `"specs/A.mdx#m" (SPEC 1.5), got identity ` +
              `${JSON.stringify(node.identity)}`,
          );
        }
        assertBytesEqual(
          node.ownText,
          T2_1_6_M_TEXT,
          `${nodeContext}: own text — the empty lines kept, the ` +
            `declaration's line gone, the embedding expanded (SPEC 1.6, 3)`,
        );
        assertBytesEqual(
          node.subtreeText,
          T2_1_6_M_TEXT,
          `${nodeContext}: subtree text — a childless section's own text ` +
            `(SPEC 1.6)`,
        );

        // `view`: the declaration listed under `imports` with its range and
        // resolved target; the positional tree as without the block.
        const viewContext = "T2.1-6 `view specs/A.mdx`";
        const report = decodeViewReport(
          await runJson(
            product,
            workspace,
            ["view", "specs/A.mdx"],
            viewContext,
          ),
          { text: false },
          viewContext,
        );
        assertSameJson(
          report.findings,
          [],
          `${viewContext}: the consulted domain is finding-free (SPEC 11.2)`,
        );
        if (report.views.length !== 1) {
          fail(
            `${viewContext}: expected exactly one per-file view (SPEC 11.4), ` +
              `got ${String(report.views.length)}`,
          );
        }
        const view = report.views[0]!;
        assertSameJson(
          view.imports,
          [
            {
              range: T2_1_6_DECLARATION_RANGE,
              name: "X",
              target: "specs/X.mdx",
            },
          ],
          `${viewContext}: the in-section declaration listed under imports ` +
            `with the range of its own characters, its binding name, and ` +
            `its resolved target (SPEC 11.4, 1.7, 2.1)`,
        );
        assertSameJson(
          treeShape(view.root),
          {
            identity: "specs/A.mdx",
            children: [
              { identity: "specs/A.mdx#m", children: [] },
              { identity: "specs/A.mdx#n", children: [] },
            ],
          },
          `${viewContext}: the positional tree — the root containing \`m\` ` +
            `and its sibling, \`m\` containing no node (SPEC 11.4)`,
        );
      },
      SPECS_ONLY_EMITTING_CONFIG,
    );
  },
});

export const section21Tests: readonly ProductTestEntry[] = [
  T2_1_1,
  T2_1_2,
  T2_1_3,
  T2_1_4,
  T2_1_5,
  T2_1_6,
];
