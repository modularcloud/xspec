// TEST-SPEC §2.1 (imports) — SUITE-06: T2.1-1 … T2.1-6.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 2.1: the only imports permitted in an xspec source file are other spec
// modules, as a single default binding of a relative `./`/`../` specifier
// ending in `.xspec`, resolved lexically against the importing file's
// directory (a specifier whose depth falls below zero designates nothing),
// whose designated `.mdx` file is a discovered source of a configured spec
// group; any other specifier, target, or binding form is invalid (14.15),
// import cycles are invalid (14.9), and an unused import is valid and records
// no edges. An identifier two imports bind roots no resolving chain (2.4).
//
// Location assertions: everything staged is pure ASCII, so string lengths
// are byte offsets. Every offending import statement of the single-import
// arms is staged at the very start of its file (prefix ""), and the 14.15
// finding — or, for T2.1-5's spec import cycles, each 14.9 location — must
// fall within the import statement's own byte window (end-widened by one
// byte for line-granular locations, see support.ts byteWindow); every other
// staged construct lies beyond the following blank line, outside the
// widened window. The arms the revised TEST-SPEC text adds — T2.1-2's
// case-only `./B.XSPEC` and root-re-entering arms, T2.1-3's
// colliding-identifier chain — are pinned form-exact instead (`findingForm`):
// each finding's stable code, every location's exact range against
// precomputed offsets (SPEC 14: an import declaration by its own characters,
// the import range of 11.4; a `d` entry by its own characters; an embedding
// by its full braced container), and `path` `null`.

import * as path from "node:path";
import type {
  Finding,
  FindingLocation,
  PathValue,
  SourceRange,
  ViewImportEntry,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  DEPENDENCY_EDGE_KINDS,
  decodeEdgesReport,
  decodeNodeReport,
  decodeOccurrencesReport,
  decodeViewReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertFileBytes,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  TestWorkspace,
  WORKSPACE_ROOT_DIRECTORY_NAME,
} from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectExit,
  expectFindingFreeReport,
  runFindingsReport,
  runJson,
  stageBesideRoot,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. Files
// outside `specs/` (the exists-but-undiscovered arm) belong to no group. A
// staged-source record (S-9's timing clause): the arm workspaces of T2.1-2,
// T2.1-3, and T2.1-5 after each body's first are created after its first
// invocation.
const SPECS_ONLY_CONFIG = stagedTs(
  "T2.1-2/T2.1-3/T2.1-5 xspec.config.ts — the specs-only configuration of every arm workspace",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// The same plus one code group whose glob matches `.mdx` files under `docs/`
// (SPEC 7.2): a file so matched is a discovered code source and no spec
// source, the target class of T2.1-2's code-group-only arm (2.1; T11.4-4's
// unavailable view target). That arm's workspace is created after the
// body's first invocation: a staged-source record (S-9's timing clause).
const SPECS_AND_DOCS_CODE_CONFIG = stagedTs(
  "T2.1-2 xspec.config.ts — one spec group and the `docs` code group globbing `.mdx` names",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    docs: ["docs/**/*.mdx"]
  }
})
`,
);

// The escape character, built from its code point so that no tool layer
// decodes the six-character escape spellings staged below on their way into
// the file (the pattern of section-1.4.ts).
const BACKSLASH = String.fromCodePoint(0x5c);

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
  config: string | StagedTs = SPECS_ONLY_CONFIG,
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
 * A finding's asserted form, the form-exact arms' projection (the T11.2-3
 * discipline): its stable code, every location — the file and the exact
 * byte range, in 12.7's within-finding order (file bytes, then start, then
 * end) — and its concerned path, `null` for a located condition (SPEC 14,
 * 12.7). Message and identities stay unpinned (informational for every
 * condition these arms stage, 12.7).
 */
interface FindingForm {
  readonly code: string | null;
  readonly locations: readonly FindingLocation[];
  readonly path: PathValue | null;
}

function findingForm(finding: Finding): FindingForm {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

/**
 * A located condition's expected form: `code`, one location in `file` per
 * range (given in 12.7's within-finding order), `path` `null` (SPEC 12.7).
 */
function locatedFindingForm(
  code: string,
  file: string,
  ranges: readonly SourceRange[],
): FindingForm {
  return {
    code,
    locations: ranges.map((range) => ({ file, range })),
    path: null,
  };
}

/**
 * A staged source composed from its parts, each part's byte range recorded
 * as it is appended (the T11.4-* pattern), so every pinned offset derives
 * from the very strings the file is built from.
 */
class ByteFixture {
  private readonly parts: string[] = [];
  private bytes = 0;

  get source(): string {
    return this.parts.join("");
  }

  add(segment: string): SourceRange {
    const start = this.bytes;
    this.parts.push(segment);
    this.bytes += Buffer.byteLength(segment, "utf8");
    return { start, end: this.bytes };
  }
}

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

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
  /**
   * Configuration override (defaults to SPECS_ONLY_CONFIG) — a staged-source
   * record, as every arm workspace after a body's first is created after
   * its first invocation (S-9's timing clause).
   */
  readonly config?: StagedTs;
  /**
   * Files staged OUTSIDE the workspace root, at paths relative to the root's
   * parent directory (support.ts stageBesideRoot) — the above-root arm's real
   * `outside/BASE.mdx`, which resolution must never reach (SPEC 2.1).
   */
  readonly outsideFiles?: Readonly<Record<string, string>>;
  /**
   * An arm the revised TEST-SPEC text adds, pinned form-exact (module
   * header): the one 14.15's code `invalid-import`, its one location the
   * import declaration by its own characters — the import range of 11.4,
   * the whole staged import line — and `path` `null` (SPEC 14, 12.7), where
   * the older arms assert the location within the declaration's
   * end-widened byte window.
   */
  readonly formExact?: true;
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
 * window in the importing file (SPEC 14: errors identify file and location)
 * — or, for a form-exact arm, located exactly at the import declaration's
 * own characters, its code and `path` pinned (SPEC 14, 12.7).
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
      if (arm.formExact === true) {
        // The import line opens the file (prefix ""), so its own
        // characters span bytes 0 through its length.
        const declaration: SourceRange = {
          start: 0,
          end: Buffer.byteLength(arm.importLine, "utf8"),
        };
        assertSameJson(
          findings.map(findingForm),
          [locatedFindingForm("invalid-import", "specs/A.mdx", [declaration])],
          `${context}: the one 14.15, form-exact — code \`invalid-import\`, ` +
            `its one location the import declaration by its own characters ` +
            `(the import range of 11.4) in specs/A.mdx, \`path\` null ` +
            `(SPEC 14, 12.7)`,
        );
        return;
      }
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
    // `./B.XSPEC` beside a discovered `specs/B.mdx`: its ending differs
    // from `.xspec` in case alone, and paths compare byte-wise and
    // case-sensitively, no case folding anywhere (SPEC 12.0), so the
    // specifier does not end in `.xspec` (2.1) — a single-casing arm: a
    // product folding case in the suffix test resolves it to the
    // discovered `specs/B.mdx`, its binding unused, and builds clean.
    name: "a relative specifier whose ending differs from `.xspec` in case alone (`./B.XSPEC` beside a discovered `specs/B.mdx`)",
    importLine: 'import B from "./B.XSPEC"',
    extraFiles: {
      ...VALID_BASE_FILES,
      "specs/B.mdx": stagedMdx(
        "T2.1-2 case-only arm specs/B.mdx (the discovered source `./B.XSPEC` would name under case folding)",
        '<S id="b">\nB behavior.\n</S>\n',
      ),
    },
    formExact: true,
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
    // finding and the import's 14.15 stands alone. The record carries both
    // S-9 declarations — the path is an `.mdx` path and a code source whose
    // name the TypeScript default does not reach — and the arm's workspace
    // is created after the body's first invocation (S-9's timing clause).
    name: "a specifier designating an `.mdx` file matched only by a code group (a discovered code source)",
    importLine: 'import EXTRA from "../docs/EXTRA.xspec"',
    extraFiles: {
      ...VALID_BASE_FILES,
      "docs/EXTRA.mdx": stagedMdx(
        "T2.1-2 docs/EXTRA.mdx matched only by a code group",
        "export {};\n",
        "well-formed",
        "well-formed",
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
// spelling is required to be canonical). Five importers in `specs/`, each
// spelling `specs/BASE.mdx` non-canonically, share one workspace that holds
// no `specs/sub/` and no `specs/**` at all, so `./sub/../BASE.xspec` resolves
// only lexically — a product resolving through the filesystem, or requiring
// the canonical spelling, fails that arm — and `./**/../../specs/BASE.xspec`
// only under 2.1's depth rule, `**` an entry name raising the depth by one
// like any other segment (starting at 1 for `specs/`, the depth reads 1, 2,
// 1, 0, 1, 2 after the six segments — never below zero): a product counting
// the depth by 7's glob rule, under which a `**` segment leaves it
// unchanged, finds it below zero at the second `..` and reports 14.15. Each
// import line is its file's only import declaration.
const LEXICAL_IMPORTERS: readonly {
  readonly file: string;
  readonly section: string;
  readonly specifier: string;
}[] = [
  { file: "specs/P1.mdx", section: "p1", specifier: "./sub/../BASE.xspec" },
  { file: "specs/P2.mdx", section: "p2", specifier: ".//BASE.xspec" },
  { file: "specs/P3.mdx", section: "p3", specifier: "././BASE.xspec" },
  { file: "specs/P4.mdx", section: "p4", specifier: "../specs/BASE.xspec" },
  {
    file: "specs/P5.mdx",
    section: "p5",
    specifier: "./**/../../specs/BASE.xspec",
  },
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
// its five importers are staged-source records, computed once at module
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

// T2.1-2, the root-re-entering arm (SPEC 2.1). From `specs/` the depth
// starts at 1 and the two `..` segments lower it to -1 — the ascent passes
// above the workspace root — before `<R>/specs/BASE.xspec` raises it again,
// so the specifier designates nothing (14.15), though read as a filesystem
// path its position is the discovered `specs/BASE.mdx` itself: `<R>` is the
// root's own directory name, the builder's `WORKSPACE_ROOT_DIRECTORY_NAME`
// (helpers/workspace.ts), checked against the created workspace before the
// arm's first invocation. The discriminator against a product resolving
// specifiers to absolute paths and relativizing them against the root,
// which the above-root arm's undiscovered `outside/BASE.mdx` rejects by
// accident: such a product resolves this import to `specs/BASE.mdx`, which
// holds `a`, so `d={BASE.a}` resolves — an edge, an occurrence, a clean
// build. Here the `d` entry names no target, its import designating
// nothing, so it does not resolve: no occurrence (5.7), and its own 14.5
// beside the import's 14.15 (SPEC 11.2: each `d` entry resolves or not on
// its own — an occurrence, or a finding (14.5) — and the two surfaces
// jointly locate every reference spelling of a parseable file; 14: a
// condition goes unreported only where another error makes it
// undetectable, and the entry's non-resolution is detectable whatever the
// import's invalidity). Both are pinned form-exact: the 14.15 at the
// declaration's own characters, the 14.5 at the entry's (SPEC 14). The
// arm's workspace is created after the body's first invocation, so both
// sources are staged-source records (S-9's timing clause).
const REENTERING_FILE = "specs/A.mdx";
const REENTERING = new ByteFixture();
const REENTERING_DECLARATION = REENTERING.add(
  `import BASE from "../../${WORKSPACE_ROOT_DIRECTORY_NAME}/specs/BASE.xspec"`,
);
REENTERING.add('\n\n<S id="s" d={');
const REENTERING_REFERENCE = REENTERING.add("BASE.a");
REENTERING.add("}>\nDepends through the re-entering specifier.\n</S>\n");
const REENTERING_SOURCE = stagedMdx(
  "T2.1-2 root-re-entering arm specs/A.mdx",
  REENTERING.source,
);
const REENTERING_TARGET = stagedMdx(
  "T2.1-2 root-re-entering arm specs/BASE.mdx (holding the `a` a relativizing product would resolve)",
  '<S id="a">\nBehavior a.\n</S>\n',
);

/**
 * The importing file's findings, in 12.7's order — numbered conditions by
 * ordinal, so the `d` entry's 14.5 before the import's 14.15 — each
 * form-exact (SPEC 14, 12.7).
 */
const REENTERING_FINDINGS: readonly FindingForm[] = [
  locatedFindingForm("unknown-dependency", REENTERING_FILE, [
    REENTERING_REFERENCE,
  ]),
  locatedFindingForm("invalid-import", REENTERING_FILE, [
    REENTERING_DECLARATION,
  ]),
];

/**
 * The root-re-entering arm (module comment above): `build --json` exits 1
 * with exactly the two findings; `view specs/A.mdx` carries them and lists
 * the declaration with its target explicitly unavailable (SPEC 11.4, 11.2;
 * T11.4-4); and `occurrences --file specs/A.mdx` carries them and lists no
 * record — the `d` entry through the import records none (5.7, 11.2).
 */
async function runReenteringSpecifierArm(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(
    {
      "specs/BASE.mdx": REENTERING_TARGET,
      [REENTERING_FILE]: REENTERING_SOURCE,
    },
    async (workspace) => {
      const rootName = path.basename(workspace.root);
      if (rootName !== WORKSPACE_ROOT_DIRECTORY_NAME) {
        throw new Error(
          `T2.1-2 fixture self-check: the root-re-entering specifier spells ` +
            `the root's directory name ` +
            `${JSON.stringify(WORKSPACE_ROOT_DIRECTORY_NAME)}, but the ` +
            `workspace root is named ${JSON.stringify(rootName)}`,
        );
      }
      const context =
        "T2.1-2 the root-re-entering specifier " +
        `\`../../${WORKSPACE_ROOT_DIRECTORY_NAME}/specs/BASE.xspec\` from ` +
        "specs/ (its depth below zero)";

      const buildContext = `${context} — \`build --json\``;
      const findings = await buildFindings(product, workspace, buildContext);
      assertConditionCounts(
        findings,
        { "14.5": 1, "14.15": 1 },
        `${buildContext} — the import designates nothing (14.15), and the ` +
          `\`d\` entry through its binding, naming no target, does not ` +
          `resolve: its own 14.5 locates it beside the 14.15 — no other ` +
          `error makes its non-resolution undetectable (SPEC 2.1, 11.2: ` +
          `each \`d\` entry resolves or not on its own, an occurrence or a ` +
          `finding (14.5); 14)`,
      );
      assertSameJson(
        findings.map(findingForm),
        REENTERING_FINDINGS,
        `${buildContext} — the findings form-exact in 12.7's order: the 14.5 ` +
          `at the \`d\` entry's own characters, then the 14.15 at the import ` +
          `declaration's own characters (the import range of 11.4), each ` +
          `\`path\` null (SPEC 14, 12.7)`,
      );

      const viewContext = `${context} — \`view ${REENTERING_FILE}\``;
      const viewResult = await expectExit(
        product,
        workspace,
        ["view", REENTERING_FILE],
        1,
        `${viewContext} — the answer carries its domain's findings and an ` +
          `explicitly-unavailable datum, so exit 1 with the full answer ` +
          `document emitted (SPEC 11.2, 11.4)`,
      );
      const view = decodeViewReport(
        parseJsonStdout(viewResult, viewContext),
        { text: false },
        viewContext,
      );
      assertSameJson(
        view.findings.map(findingForm),
        REENTERING_FINDINGS,
        `${viewContext} — the requested file's findings accompany the ` +
          `answer, form-exact (SPEC 11.2, 11.4)`,
      );
      const expectedImports: readonly ViewImportEntry[] = [
        { range: REENTERING_DECLARATION, name: "BASE", target: UNAVAILABLE },
      ];
      assertSameJson(
        view.views.map((entry) => ({
          file: entry.file,
          imports: entry.imports,
        })),
        [{ file: REENTERING_FILE, imports: expectedImports }],
        `${viewContext} — the one view lists the declaration with its range ` +
          `and binding name, its resolved target exactly the unavailability ` +
          `marker: the specifier designates nothing, so discovery defines no ` +
          `target — never the plain "specs/BASE.mdx" its position names, ` +
          `never null (SPEC 2.1, 11.2, 11.4; T11.4-4)`,
      );

      const occContext = `${context} — \`occurrences --file ${REENTERING_FILE}\``;
      const occResult = await expectExit(
        product,
        workspace,
        ["occurrences", "--file", REENTERING_FILE],
        1,
        `${occContext} — the answer carries its domain's findings, so exit 1 ` +
          `with the full answer document (SPEC 11.2, 11.3)`,
      );
      const occurrences = decodeOccurrencesReport(
        parseJsonStdout(
          occResult,
          `${occContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        occContext,
      );
      assertSameJson(
        occurrences.findings.map(findingForm),
        REENTERING_FINDINGS,
        `${occContext} — the admitted file's findings accompany the answer, ` +
          `form-exact (SPEC 11.2, 11.3)`,
      );
      assertSameJson(
        occurrences.occurrences,
        [],
        `${occContext} — no record for the \`d={BASE.a}\` entry through the ` +
          `import: it does not resolve, so it records no occurrence, its ` +
          `position reaching consumers through its finding's range alone ` +
          `(SPEC 5.7, 11.2, 11.3)`,
      );
    },
  );
}

const T2_1_2 = defineProductTest({
  id: "T2.1-2",
  title: `\`../\` specifiers resolve against the importing file's directory, and resolution is lexical: \`./sub/../BASE.xspec\` (no \`sub/\` on disk), \`.//BASE.xspec\`, \`././BASE.xspec\`, \`../specs/BASE.xspec\`, and \`./**/../../specs/BASE.xspec\` (no \`specs/**\` on disk — \`**\` an entry name raising the depth by one, never 7's depth-neutral glob segment) each designate specs/BASE.mdx — the import valid, the reference through it resolving, \`view\` reporting the resolved target; absolute, bare, non-\`.xspec\` (\`./BASE.mdx\`; \`./B.XSPEC\` beside a discovered specs/B.mdx, its ending differing in case alone — byte-wise and case-sensitive, its 14.15 form-exact), undiscovered-target (an \`.mdx\` matched by no group; one matched only by a code group), nonexistent-target, above-the-root (a real \`outside/BASE.mdx\` at the root's parent), root-re-entering (\`../../<R>/specs/BASE.xspec\`, \`<R>\` the root's own directory name: its depth below zero, it designates nothing though its position is the discovered specs/BASE.mdx — \`build\` reporting exactly its 14.15 at the declaration and the 14.5 of the \`d={BASE.a}\` entry through it, form-exact, \`view\` its target explicitly unavailable, \`occurrences --file\` no record), and escape-spelled ("./B${BACKSLASH}u0041SE.xspec", read verbatim) specifiers each fail with 14.15 (SPEC 2.1, 2.4, 5.7, 11.2, 11.3, 11.4, 12.0, 14.5, 14.15; T11.4-4)`,
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
    // Lexical positives: one workspace, five non-canonical spellings of
    // specs/BASE.mdx, no specs/sub/ and no specs/** on disk (module comment
    // above).
    await withWorkspace(
      { ...VALID_BASE_FILES, ...LEXICAL_IMPORTER_FILES },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T2.1-2 `build` with five non-canonical specifiers of " +
            "specs/BASE.mdx (`./sub/../`, `.//`, `././`, `../specs/`, " +
            "`./**/../../specs/`; no specs/sub/ and no specs/** on disk) — " +
            "each import is valid, `**` an entry name raising the depth by " +
            "one (SPEC 2.1)",
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
        // bare whole-domain `view`: the six discovered sources in byte
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
    await runReenteringSpecifierArm(product);
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
 * statements' byte windows. SPEC 14 fixes one 14.15 finding locating every
 * colliding declaration. This arm deliberately accepts one finding for the
 * collision or one per import — every one of them must be 14.15, name the
 * file, and point at one of the two import statements — because TEST-SPEC
 * assigns the every-participant cardinality to T14-8 and the exact ranges to
 * T14-11 (its §14 preamble), which assert them strictly; the
 * colliding-chain arms below pin both, their revised text requiring the
 * collision's one finding to locate both declarations.
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

// T2.1-3, the colliding-identifier chain (SPEC 2.4: an identifier two
// imports bind roots no resolving chain — the language names no single
// binding, so a chain rooted at it names no target: no edge and no
// occurrence (5.7, 11.2), its spellings reporting as unresolved — 14.5 for
// the `d` entry, 14.6 for the embedding — beside the collision's 14.15,
// which locates every colliding declaration, each by its own characters
// (2.1; 14)). `specs/A.mdx` and `specs/B.mdx` each hold `a`, so either
// binding alone would resolve `X.a`: a product rooting the chain at either
// declaration records the edges and the occurrences and reports neither
// 14.5 nor 14.6. The two declarations stand in separate ESM blocks (a blank
// line between, 2.7) of `specs/C.mdx`, staged in both declaration orders,
// beside `<S id="s" d={X.a}>` holding `{text(X.a)}`; every finding is pinned
// form-exact against offsets composed from the staged parts. Each arm's
// workspace is created after the body's first invocation, so its sources
// are staged-source records (S-9's timing clause), the importing file's
// carrying S-9's `duplicate-import-binding` allowance (the stock parser
// judges every ESM block of a file as one module, `duplicateBindingArm`).
const CHAIN_FILE = "specs/C.mdx";
const CHAIN_TARGET_FILES = {
  "specs/A.mdx": stagedMdx(
    "T2.1-3 colliding-chain arms specs/A.mdx (holding `a`)",
    '<S id="a">\nBehavior a of A.\n</S>\n',
  ),
  "specs/B.mdx": stagedMdx(
    "T2.1-3 colliding-chain arms specs/B.mdx (holding `a`)",
    '<S id="a">\nBehavior a of B.\n</S>\n',
  ),
} as const;
const CHAIN_IMPORT_A = 'import X from "./A.xspec"';
const CHAIN_IMPORT_B = 'import X from "./B.xspec"';

/** One declaration order of the colliding-chain staging. */
interface CollidingChainArm {
  readonly name: string;
  /** The staged `specs/C.mdx`. */
  readonly source: StagedMdx;
  /** Its findings in 12.7's order, form-exact (SPEC 14, 12.7). */
  readonly findings: readonly FindingForm[];
}

/**
 * Compose one declaration order: the two declarations, then the section
 * whose `d` entry and embedding each spell `X.a`, recording every
 * construct's byte range as the file is built. Findings order by ordinal —
 * 14.5, 14.6, 14.15 — and the collision's two locations by start (12.7).
 */
function collidingChainArm(
  name: string,
  first: string,
  second: string,
): CollidingChainArm {
  const file = new ByteFixture();
  const firstDeclaration = file.add(first);
  file.add("\n\n");
  const secondDeclaration = file.add(second);
  file.add('\n\n<S id="s" d={');
  const reference = file.add("X.a");
  file.add("}>\n");
  const embedding = file.add("{text(X.a)}");
  file.add("\n</S>\n");
  return {
    name,
    source: stagedMdx(
      `T2.1-3 colliding-chain arm specs/C.mdx, ${name}`,
      file.source,
      { allowances: ["duplicate-import-binding"] },
    ),
    findings: [
      locatedFindingForm("unknown-dependency", CHAIN_FILE, [reference]),
      locatedFindingForm("unknown-text-target", CHAIN_FILE, [embedding]),
      locatedFindingForm("invalid-import", CHAIN_FILE, [
        firstDeclaration,
        secondDeclaration,
      ]),
    ],
  };
}

const COLLIDING_CHAIN_ARMS: readonly CollidingChainArm[] = [
  collidingChainArm("A's declaration first", CHAIN_IMPORT_A, CHAIN_IMPORT_B),
  collidingChainArm("B's declaration first", CHAIN_IMPORT_B, CHAIN_IMPORT_A),
];

/**
 * One colliding-chain arm: `build --json`, then `check --json` on the
 * never-built workspace — whose mismatch forms of 14.10 are undetectable
 * while `build`'s validations fail, and whose record forms cannot arise
 * with no record written, so its findings are `build`'s exactly (14.10) —
 * each exit 1 with exactly the 14.5, the 14.6, and the 14.15 locating both
 * declarations, form-exact; and `occurrences --file specs/C.mdx` carries
 * those findings and lists no record (SPEC 11.2, 11.3; T5.7-4).
 */
async function runCollidingChainArm(
  product: ProductBinding,
  arm: CollidingChainArm,
): Promise<void> {
  await withWorkspace(
    { ...CHAIN_TARGET_FILES, [CHAIN_FILE]: arm.source },
    async (workspace) => {
      const context = `T2.1-3 the chain rooted at the colliding identifier X, ${arm.name}`;
      for (const command of ["build", "check"] as const) {
        const commandContext = `${context} — \`${command} --json\``;
        const findings = await runFindingsReport(
          product,
          workspace,
          [command, "--json"],
          1,
          `${commandContext} — the findings make the report exit 1 (SPEC ` +
            `12.0, ${command === "build" ? "12.1" : "12.2"})`,
        );
        assertConditionCounts(
          findings,
          { "14.5": 1, "14.6": 1, "14.15": 1 },
          `${commandContext} — the collision's one 14.15, and the chain ` +
            `rooted at X resolving nowhere: the \`d\` entry's 14.5 and the ` +
            `embedding's 14.6, never an edge from either declaration (SPEC ` +
            `2.1, 2.4, 14)`,
        );
        assertSameJson(
          findings.map(findingForm),
          arm.findings,
          `${commandContext} — the findings form-exact in 12.7's order: the ` +
            `14.5 at the \`d\` entry's own characters, the 14.6 at the ` +
            `embedding's full braced container, and the 14.15 locating both ` +
            `declarations, each by its own characters, in start order — one ` +
            `finding, no representative chosen (SPEC 14, 12.7)`,
        );
      }

      const occContext = `${context} — \`occurrences --file ${CHAIN_FILE}\``;
      const occResult = await expectExit(
        product,
        workspace,
        ["occurrences", "--file", CHAIN_FILE],
        1,
        `${occContext} — the answer carries its domain's findings, so exit 1 ` +
          `with the full answer document (SPEC 11.2, 11.3)`,
      );
      const report = decodeOccurrencesReport(
        parseJsonStdout(
          occResult,
          `${occContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        occContext,
      );
      assertSameJson(
        report.findings.map(findingForm),
        arm.findings,
        `${occContext} — the admitted file's findings accompany the answer, ` +
          `form-exact (SPEC 11.2, 11.3)`,
      );
      assertSameJson(
        report.occurrences,
        [],
        `${occContext} — no record for the \`d\` entry or the embedding: a ` +
          `chain rooted at an identifier two imports bind names no target, ` +
          `so it records no occurrence, each spelling positioned by its ` +
          `finding's range alone (SPEC 2.4, 5.7, 11.2)`,
      );
    },
  );
}

const T2_1_3 = defineProductTest({
  id: "T2.1-3",
  title:
    'named, namespace, and side-effect-only imports, duplicate-identifier bindings (in one ESM block and in separate blocks — 14.15 in a well-formed file, never 14.20), and bindings of `S`/`Spec`/`text` each fail with 14.15; two imports binding one module under different names are valid; and a chain rooted at a colliding identifier resolves nowhere — with specs/A.mdx and specs/B.mdx each holding `a`, `import X from "./A.xspec"` and `import X from "./B.xspec"` in separate blocks, in both declaration orders, beside `<S id="s" d={X.a}>` holding `{text(X.a)}`: `build` and `check` each exit 1 with exactly the 14.5 for the `d` entry, the 14.6 for the embedding, and the 14.15 collision locating both declarations, form-exact, and `occurrences --file` lists no record beside those findings — failing a product that roots the chain at either declaration (SPEC 2.1, 2.4, 5.7, 11.2, 11.3, 14.5, 14.6, 14.15, 14.20)',
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

    // The chain rooted at a colliding identifier resolves nowhere, in both
    // declaration orders.
    for (const arm of COLLIDING_CHAIN_ARMS) {
      await runCollidingChainArm(product, arm);
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
// can only be the spec import cycle. Each file begins with its participating
// import declaration (prefix ""), the construct each 14.9 location in that
// file must fall within (SPEC 14: a spec import cycle locates each
// participating import declaration; the module header's window convention).
const CYCLE_A_DECLARATION = 'import B from "./B.xspec"';
const CYCLE_B_DECLARATION = 'import A from "./A.xspec"';

const CYCLE_A_SOURCE = [
  CYCLE_A_DECLARATION,
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
  CYCLE_B_DECLARATION,
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
// source is a staged-source record (S-9's timing clause). Its import
// declaration begins the file, as in the two-file arm.
const SELF_IMPORT_DECLARATION = 'import SELF from "./SELF.xspec"';
const SELF_IMPORT_SOURCE = stagedMdx(
  "T2.1-5 self-import specs/SELF.mdx",
  SELF_IMPORT_DECLARATION + IMPORTING_FILE_REST,
);

/**
 * One participant of a staged spec import cycle: its workspace-relative file
 * and the participating import declaration that begins it (prefix ""), whose
 * `byteWindow` every 14.9 location in that file must fall within.
 */
interface ImportCycleParticipant {
  readonly file: string;
  readonly declaration: string;
}

/**
 * Assert an import-cycle report (SPEC 14: "a cycle locates its full path in
 * source, … or each participating import declaration of a spec import
 * cycle", every located condition carrying the containing file and a range
 * for each offending construct; 14.9): every finding is 14.9 (nothing else
 * is present in these fixtures — both files parse, and every reference
 * resolves); every finding carries at least one location, and every
 * location lies in a participating file within that file's import
 * declaration window, `byteWindow("", declaration)` (the declaration begins
 * its file; the one-byte end-widening tolerates a line-granular location);
 * and every participating declaration is located by some finding. The count
 * stays bounded rather than exact — one finding for the cycle, or at most
 * one per participating file — although SPEC 14 fixes one 14.9 finding
 * locating every participating import declaration, because TEST-SPEC
 * assigns that every-participant cardinality to T14-8 and the exact
 * per-condition ranges to T14-11 (its §14 preamble). T14-8 asserts its own
 * import cycle strictly — one 14.9 finding, exactly one location per
 * participating import declaration, each within that declaration's own
 * characters.
 */
function assertImportCycleFindings(
  findings: readonly Finding[],
  participants: readonly ImportCycleParticipant[],
  context: string,
): void {
  const files = JSON.stringify(participants.map(({ file }) => file));
  const conditions = findings.map((finding) => finding.condition);
  if (
    findings.length < 1 ||
    findings.length > participants.length ||
    conditions.some((condition) => condition !== "14.9")
  ) {
    fail(
      `${context}: expected the spec import cycle over the participating ` +
        `file(s) ${files} to report condition 14.9 — one finding for the ` +
        `cycle, or at most one per participating file ` +
        `(${String(participants.length)}) — got ${JSON.stringify(conditions)} ` +
        `(SPEC 14, 14.9)`,
    );
  }
  const windowOf = (
    participant: ImportCycleParticipant,
  ): { start: number; end: number } => byteWindow("", participant.declaration);
  for (const finding of findings) {
    if (finding.locations.length === 0) {
      fail(
        `${context}: a 14.9 finding locates each participating import ` +
          `declaration of the spec import cycle in the file containing it — ` +
          `the participating file(s) ${files} — but this one carries no ` +
          `location (SPEC 14, 14.9; 12.7 locations); finding: ` +
          `${JSON.stringify(finding)}`,
      );
    }
    for (const location of finding.locations) {
      const rendered =
        `${renderPathValue(location.file)} [${String(location.range.start)}, ` +
        `${String(location.range.end)})`;
      const participant = participants.find(
        ({ file }) => file === location.file,
      );
      if (participant === undefined) {
        fail(
          `${context}: a 14.9 finding's locations lie in the spec import ` +
            `cycle's participating file(s) ${files}, each at its import ` +
            `declaration (SPEC 14, 14.9); got the location ${rendered} ` +
            `(message: ${JSON.stringify(finding.message)})`,
        );
      }
      const window = windowOf(participant);
      if (
        location.range.start < window.start ||
        location.range.end > window.end
      ) {
        fail(
          `${context}: a 14.9 location in the participating file ` +
            `${JSON.stringify(participant.file)} must fall within its import ` +
            `declaration ${JSON.stringify(participant.declaration)}'s byte ` +
            `window [${String(window.start)}, ${String(window.end)}] (SPEC 14, ` +
            `14.9: a spec import cycle locates each participating import ` +
            `declaration); got ${rendered} (message: ` +
            `${JSON.stringify(finding.message)})`,
        );
      }
    }
  }
  for (const participant of participants) {
    const window = windowOf(participant);
    const located = findings.some((finding) =>
      finding.locations.some(
        (location) =>
          location.file === participant.file &&
          location.range.start >= window.start &&
          location.range.end <= window.end,
      ),
    );
    if (!located) {
      fail(
        `${context}: the participating file ${JSON.stringify(participant.file)}'s ` +
          `import declaration ${JSON.stringify(participant.declaration)} must ` +
          `be located by a 14.9 finding within its byte window ` +
          `[${String(window.start)}, ${String(window.end)}] (SPEC 14, 14.9: a ` +
          `spec import cycle locates each participating import declaration, ` +
          `each in the file containing it); findings: ${JSON.stringify(findings)}`,
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
          [
            { file: "specs/A.mdx", declaration: CYCLE_A_DECLARATION },
            { file: "specs/B.mdx", declaration: CYCLE_B_DECLARATION },
          ],
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
          [{ file: "specs/SELF.mdx", declaration: SELF_IMPORT_DECLARATION }],
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
