// TEST-SPEC §1.5 (node identity) — SUITE-04: T1.5-1, T1.5-2, T1.5-3.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5) and exact bytes where SPEC.md fixes bytes
// (H-4), decodes output through the H-3 adapters, and rejects a product only
// via diagnosed assertion failures (H-8).
//
// - T1.5-1 runs every identity- and path-bearing command (`query`, `show`,
//   `ids`, `coverage`, `impact`, and the `occurrences`, `view`, and `at`
//   documents) twice — from the workspace root and from a nested directory —
//   byte-compares the outputs, and asserts the identities and file paths
//   decoded from them are exactly the workspace-relative, `/`-separated forms
//   of SPEC 1.5 (a nested `specs/sub/` path keeps the separator at stake).
//   The workspace makes every kind of path appear: `specs/sub/B.mdx` imports
//   `specs/A.mdx` across directories and references it through the binding
//   (a view's import target, an occurrence's `file`), and a code group's
//   nested `src/sub/c.ts` marks a node from a named unit (a code-location
//   path in `query node`/`show` edges, occurrence records, a covering path,
//   and impacted code). Both coverage profiles use `targets: "all"` so the
//   roots' only exclusion reason is `root node` (SPEC 8.1/8.2) — the
//   leaves-mode reason wording is T8's business, not this test's. `view` and
//   `at` take workspace-relative `<file>` operands (SPEC 12.0), so one argv
//   serves both working directories. T1.5-1 and T1.5-3 rerun on the Windows
//   leg via CI-01 (the registry entries are shared; TEST-SPEC E-6), so every
//   T1.5-1 staging is an ordinary file and directory, stageable on both legs
//   (no symbolic link or other POSIX-only feature).
//   The entry's inventory clause cross-references T11.6-1, whose
//   member-invariance arm (section-11.6.ts; on the Windows leg, its
//   drive-mismatch arm) holds every inventory member but the anchoring
//   byte-identical across working directories, so no copy runs here.
//   The human (non-`--json`) reports of `show` (of alpha and of gamma),
//   `ids`, `coverage`, and `impact --base HEAD` run the same two-directory
//   protocol, each directly after its `--json` document's assertions (every
//   run is a read, so each report is at its document's state), and each
//   must name every identity and file path that document carries
//   (`assertHumanIdentities`): `show` the node's identity and every
//   incoming and outgoing edge's endpoints, the `contains` edges' roots
//   included; `ids` the file of every entry listing an ID and every listed
//   ID; `coverage` every profile's covered identities and covering-path
//   nodes, its uncovered identities, and its ignored roots; `impact` every
//   requirement entry's nodes and attribution identities and every
//   impacted-code entry's location, witness edge endpoints, and witness
//   path nodes. Each is an `identityMention` (helpers/adapters/human.ts),
//   bounded as a token rather than matched as a plain substring: the byte
//   comparison cannot see a path printed under a prefix the working
//   directory does not change (the absolute workspace root, `./`), and a
//   substring finds `specs/A.mdx#alpha` inside such a prefixed spelling,
//   so a report printing its paths that way fails though both runs agree
//   byte for byte. Limits (H-3: robust matching, never wording): no
//   mention is associated with another, so which identity lies on which
//   edge, row, path, or entry stays with the JSON assertions; and the
//   fixture's data are ASCII and hold no escapable character, so no datum
//   goes unasked.
// - T1.5-2's non-UTF-8 arms — the spec-group arm, the code-group arm, and
//   the located arm — are staged on the Linux leg per its TEST-SPEC text
//   ("where file names are byte strings"): other platforms' filesystems
//   refuse such names outright, so each runs exactly where its fixture is
//   realizable; wherever an output carries such a path — a finding's
//   concerned path or location file, an occurrence's referencing file — it
//   is the marked byte form (SPEC 12.0, 12.7), composed from the same bytes
//   that stage the file. The `#` arms and the U+FFFD-pathed arms run
//   everywhere: the spec arm stages specs/A<U+FFFD>.mdx (the spelling shared
//   with T11.5-3 through support.ts; valid UTF-8, so a name every platform
//   holds) and the code arm src/a<U+FFFD>.ts, each presenting its path as
//   the plain string form, never the byte form (SPEC 12.0: a U+FFFD path has
//   a plain string form). The code-group arms (U+FFFD and non-UTF-8) fail a
//   product that vets spec-group paths alone: each code source imports a
//   valid spec source and spells one bare marker, so `build` and `check`
//   each report exactly its 14.19, and bare `occurrences` — whose consulted
//   domain is the entire discovered set — carries that finding beside the
//   marker's one record, `source` exactly the unavailability marker (the
//   file defines no identity for its whole-file location, SPEC 11.2) while
//   `file`, `range`, `kind`, and `target` are present (5.7, 12.7). The
//   located arm fails a product that marks concerned paths alone: a
//   non-UTF-8-named spec source holding an id-less non-root section after a
//   multi-byte prelude, so `build` and `check` each report its 14.1 —
//   located at the section's opening tag (SPEC 14: the opening-tag range of
//   11.4), its location file the marked byte form — beside its 14.19. No arm
//   ever builds, so `check` reports `build`'s findings exactly: on a
//   workspace failing `build`'s validations the mismatch forms of 14.10 are
//   undetectable, and with no record the other two forms cannot arise (SPEC
//   12.2, 14.10). That a file is reachable by glob through `view` and
//   nameable by no argument is T11.5-3's business (T11.2-3's discipline).
//   Every arm is staged through one table, `T1_5_2_ARMS` (`stageT152Arm`),
//   each entry carrying the findings T1.5-2 pins for it, which T12.0-15
//   restages for its human-form twins of `build` and `check` and its
//   non-UTF-8 marking clause (section-12.0-iv.ts).
// - T1.5-3 exercises the `path#id` vs bare `path` addressing duality across
//   `query node`, `show`, and `rename`/`move` arguments; sections and roots
//   carry distinct byte-anchored texts so the two address forms are
//   discriminated by content, not just by echoed identity.

import { Buffer } from "node:buffer";
import type {
  CoverageProfileReport,
  CoverageReport,
  FileView,
  Finding,
  FindingLocation,
  IdsReport,
  ImpactReport,
  NodeReport,
  OccurrenceRecord,
  PathValue,
  SourceRange,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  assertReportMentions,
  classifyIgnoredReasons,
  decodeAtReport,
  decodeCoverageReport,
  decodeIdsReport,
  decodeImpactReport,
  decodeNodeReport,
  decodeNodeRowsReport,
  decodeOccurrencesReport,
  decodeViewReport,
  identityMention,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { StagedMdx } from "../../helpers/staged-mdx.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import { runProduct } from "../../helpers/subprocess.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { assertImpactedCode } from "./section-9.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertSameJson,
  buildFindings,
  buildOk,
  expectExit,
  REPLACEMENT_CHARACTER,
  REPLACEMENT_CHARACTER_SPEC_PATH,
  runCli,
  runFindingsReport,
  runJson,
  sortedIdentities,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): one spec group. A
// staged-source record (S-9's timing clause): T1.5-2's non-UTF-8, U+FFFD,
// and located spec-group arms stage it after the body's first invocation.
const SPECS_ONLY_CONFIG = stagedTs(
  "T1.5-2/T12.0-15 xspec.config.ts — the specs-only configuration of the non-UTF-8, U+FFFD, and located spec-group arms",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// ---------------------------------------------------------------------------
// T1.5-1
// ---------------------------------------------------------------------------

// One spec group, one code group, and two coverage profiles over the spec
// group — `p` with the spec group as its boundary, `q` with the code group —
// so `coverage` reports identities and, in q's covering path, a code
// location (SPEC 7.2, 7.4, 8.2). `targets: "all"` keeps the roots' exclusion
// reasons at exactly `root node` (SPEC 8.1/8.2; see the module header). A
// staged-source record (S-9), like B's sources and the code source; A's
// source stays plain contents, judged as the builder stages it before the
// body's first invocation (helpers/staged-mdx.ts).
const IDENTITY_CONFIG = stagedTs(
  "T1.5-1 xspec.config.ts — one spec group, one code group, and a coverage profile with each as its boundary",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      targets: "all",
      boundary: "main",
      mode: "direct"
    },
    {
      name: "q",
      target: "main",
      targets: "all",
      boundary: "app",
      mode: "direct"
    }
  ]
})
`,
);

const IDENTITY_A_SOURCE = [
  '<S id="alpha" d={["beta"]}>',
  "Alpha depends on beta.",
  "</S>",
  "",
  '<S id="beta">',
  "Beta text.",
  "</S>",
  "",
].join("\n");

// specs/sub/B.mdx imports specs/A.mdx across directories (`../A.xspec`,
// SPEC 2.1) and gamma depends on alpha through that binding (2.2): the view
// of B carries an import whose target is another directory's file, and the
// `occurrences`, `view`, and `at` documents an occurrence whose `file` is
// the nested path (5.7, 11.3–11.5). Only gamma's text differs between the
// baseline commit and the edit `impact --base` measures.
const B_IMPORT = 'import A from "../A.xspec"';
const B_GAMMA_OPEN_HEAD = '<S id="gamma" d={';
const B_REFERENCE = "A.alpha";
const identityBSource = (gammaText: string): string =>
  [
    B_IMPORT,
    "",
    `${B_GAMMA_OPEN_HEAD}${B_REFERENCE}}>`,
    gammaText,
    "</S>",
    "",
  ].join("\n");

const B_BASELINE_SOURCE = identityBSource("Gamma original text.");
const B_EDITED_SOURCE = identityBSource("Gamma edited text.");

const IDENTITY_B_BASELINE = stagedMdx(
  "T1.5-1 specs/sub/B.mdx — the baseline: an import of ../A.xspec and gamma's reference through it",
  B_BASELINE_SOURCE,
);

const IDENTITY_B_EDITED = stagedMdx(
  "T1.5-1 specs/sub/B.mdx — gamma's text edited after the baseline commit",
  B_EDITED_SOURCE,
);

// `at`'s offset: inside gamma's reference `A.alpha`, at the first byte of
// `alpha`, so the resolution carries that occurrence's record (SPEC 11.5) —
// composed from the parts the source is, and checked against the staged
// bytes at module load (a harness staging defect, never a product failure).
const AT_OFFSET = Buffer.byteLength(
  `${B_IMPORT}\n\n${B_GAMMA_OPEN_HEAD}A.`,
  "utf8",
);
for (const source of [B_BASELINE_SOURCE, B_EDITED_SOURCE]) {
  const window = Buffer.from(source, "utf8")
    .subarray(AT_OFFSET - 2, AT_OFFSET + 5)
    .toString("utf8");
  if (window !== B_REFERENCE) {
    throw new Error(
      `T1.5-1 fixture self-check: the bytes around the \`at\` offset ` +
        `${String(AT_OFFSET)} read ${JSON.stringify(window)}, not ` +
        `${JSON.stringify(B_REFERENCE)} (a harness staging defect)`,
    );
  }
}

// A code source in a nested directory of the code group: its named unit
// `useGamma` marks gamma (SPEC 4.5, 4.6), so the code location
// `src/sub/c.ts#useGamma` — a path in an identity of no requirement node —
// enters `query node`'s and `show`'s edges, the occurrence records, profile
// q's covering path, and impact's impacted code.
const IDENTITY_CODE_SOURCE = stagedTs(
  "T1.5-1 src/sub/c.ts — a nested code source whose named unit marks specs/sub/B.mdx#gamma",
  [
    'import B from "../../specs/sub/B.xspec"',
    "",
    "export function useGamma() {",
    "  B.gamma",
    "}",
    "",
  ].join("\n"),
);

// The staged workspace's identities and file paths, in the exact form SPEC
// 1.5 fixes: workspace-relative, `/`-separated (the nested `specs/sub/` and
// `src/sub/` paths keep the separator at stake), `#` joining path and ID (or
// a code unit's name, 4.6), bare path for a root.
const A_FILE = "specs/A.mdx";
const B_FILE = "specs/sub/B.mdx";
const CODE_FILE = "src/sub/c.ts";
const A_ROOT = A_FILE;
const ALPHA = "specs/A.mdx#alpha";
const BETA = "specs/A.mdx#beta";
const B_ROOT = B_FILE;
const GAMMA = "specs/sub/B.mdx#gamma";
const CODE_UNIT = "src/sub/c.ts#useGamma";
// The requirement nodes' identities (`query nodes` rows, impact
// attribution): the code location is no requirement node (SPEC 5.1, 11.1).
const KNOWN_IDENTITIES: readonly string[] = [
  A_ROOT,
  ALPHA,
  BETA,
  B_ROOT,
  GAMMA,
];

// The nested working directory for T1.5-1's second run of each command: a
// real subdirectory holding a source file, so a product reporting
// cwd-relative paths (`B.mdx`, `../A.mdx`, `../../src/sub/c.ts`) or native
// separators diverges.
const NESTED_DIR = "specs/sub";

/**
 * Run one command from the workspace root and again from the nested
 * directory: both must exit 0 with byte-identical stdout (T1.5-1's protocol —
 * identities and file paths in outputs are workspace-relative, independent
 * of the working directory; SPEC 1.5, 12.0). Returns the root run for
 * decoding.
 */
async function runFromRootAndNested(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  const fromRoot = await runProduct(product, {
    cwd: workspace.root,
    argv,
  });
  assertExitCode(fromRoot, 0, `${context} (run from the workspace root)`);
  const fromNested = await runProduct(product, {
    cwd: workspace.path(NESTED_DIR),
    argv,
  });
  assertExitCode(
    fromNested,
    0,
    `${context} (run from the nested directory ${NESTED_DIR})`,
  );
  assertBytesEqual(
    fromNested.stdoutBytes,
    fromRoot.stdoutBytes,
    `${context}: stdout of the nested-directory run vs the workspace-root run — ` +
      `outputs are byte-identical regardless of the working directory, because ` +
      `identities and file paths are workspace-relative and /-separated (SPEC 1.5, 12.0)`,
  );
  return fromRoot;
}

/**
 * A human report of T1.5-1 — the root run of `runFromRootAndNested`,
 * byte-equal to the nested run — names every identity and file path its
 * decoded `--json` document carries (after that document's own
 * assertions), each distinct one an `identityMention`, all in one call.
 * The mention is token-bounded (helpers/adapters/human.ts): not preceded by
 * a word character, `-`, `.`, or `/`, and not followed by a word character,
 * `-`, `#`, `/`, or `.` and a word character. So a path printed under a
 * prefix the working directory does not change — the absolute workspace
 * root, `./` — is no mention, though both runs agree byte for byte (SPEC
 * 1.5); nor does a root's bare path count inside its sections' identities,
 * nor an ID inside a path. Robust matching (H-3): presence, never wording,
 * and no mention associated with another.
 */
function assertHumanIdentities(
  human: RunResult,
  identities: Iterable<string>,
  label: string,
): void {
  assertReportMentions(
    human,
    [...new Set(identities)].map(identityMention),
    `${label}: every identity and file path the \`--json\` document carries ` +
      `appears token-bounded, workspace-relative and /-separated — never ` +
      `under a prefix such as the absolute workspace root or \`./\` (SPEC ` +
      `1.5, 12.0; robust matching, never wording — H-3)`,
  );
}

/**
 * A decoded `show` report's identities (SPEC 12.4): the node's own and
 * every incoming and outgoing edge's `from` and `to` — the roots of its
 * `contains` edges and a code location included.
 */
function nodeReportIdentities(report: NodeReport): string[] {
  return [
    report.identity,
    ...[...report.incomingEdges, ...report.outgoingEdges].flatMap((edge) => [
      edge.from,
      edge.to,
    ]),
  ];
}

/**
 * A decoded `ids` listing's paths and IDs (SPEC 12.3): the file of every
 * entry listing at least one ID, and every listed ID.
 */
function idsReportIdentities(report: IdsReport): string[] {
  return report.files
    .filter((entry) => entry.ids.length > 0)
    .flatMap((entry) => [entry.file, ...entry.ids]);
}

/**
 * A decoded `coverage` report's identities (SPEC 8.2): every profile's
 * covered identities and every node of each covering path, every uncovered
 * identity, and every ignored identity.
 */
function coverageReportIdentities(report: CoverageReport): string[] {
  return report.profiles.flatMap((profile) => [
    ...profile.covered.flatMap((row) => [row.identity, ...row.path]),
    ...profile.uncovered,
    ...profile.ignored.map((row) => row.identity),
  ]);
}

/**
 * A decoded `impact` report's identities (SPEC 5.6, 9.1–9.3) — those
 * section-9.ts's `assertHumanImpactReport` asks in its first call, collected
 * the same way: every requirement entry's nodes and every category's
 * attribution identities, and every impacted-code entry's location, witness
 * edge `from` and `to`, and witness path nodes.
 */
function impactReportIdentities(report: ImpactReport): string[] {
  const identities: string[] = [];
  for (const entry of report.requirements) {
    identities.push(...entry.nodes);
    for (const category of entry.categories) {
      identities.push(...category.attributedTo);
    }
  }
  for (const group of ["direct", "transitive"] as const) {
    for (const entry of report.code[group]) {
      identities.push(
        entry.location,
        entry.edge.from,
        entry.edge.to,
        ...entry.path,
      );
    }
  }
  return identities;
}

/** Every reported identity must be one of the staged workspace's (SPEC 1.5). */
function assertKnownIdentities(
  identities: readonly string[],
  context: string,
): void {
  for (const identity of identities) {
    if (!KNOWN_IDENTITIES.includes(identity)) {
      fail(
        `${context}: reported identity ${JSON.stringify(identity)} is not one of the ` +
          `staged workspace's workspace-relative, /-separated identities (SPEC 1.5); ` +
          `expected one of ${JSON.stringify(KNOWN_IDENTITIES)}`,
      );
    }
  }
}

/**
 * An occurrence record's path- and identity-bearing members (SPEC 5.7,
 * 12.7): the referencing file, the edge kind, the source graph node's
 * identity — or the unavailability marker, compared as itself — and the
 * resolved target's identity. The ranges are T5.7's, T11.3's, and T11.5's
 * business; the byte comparison of the two runs holds them independent of
 * the working directory too.
 */
interface OccurrencePaths {
  readonly file: PathValue;
  readonly kind: string;
  readonly source: string | { readonly unavailable: true };
  readonly target: string;
}

function occurrencePaths(record: OccurrenceRecord): OccurrencePaths {
  return {
    file: record.file,
    kind: record.kind,
    source:
      "unavailable" in record.source
        ? { unavailable: true }
        : record.source.identity,
    target: record.target,
  };
}

/** A view's positional section tree, projected to its node identities. */
interface IdentityTree {
  readonly identity: string | { readonly unavailable: true };
  readonly children: readonly IdentityTree[];
}

function identityTree(node: ViewNode): IdentityTree {
  return {
    identity: node.identity,
    children: node.children.map(identityTree),
  };
}

/**
 * A per-file view's path- and identity-bearing members (SPEC 11.4, 12.7):
 * its `file`, its nodes' identities, each import's binding name and resolved
 * target, and its occurrence records' paths and identities.
 */
interface ViewPaths {
  readonly file: PathValue;
  readonly root: IdentityTree;
  readonly imports: readonly {
    readonly name: string | null;
    readonly target: PathValue | { readonly unavailable: true };
  }[];
  readonly occurrences: readonly OccurrencePaths[];
}

function viewPaths(view: FileView): ViewPaths {
  return {
    file: view.file,
    root: identityTree(view.root),
    imports: view.imports.map((entry) => ({
      name: entry.name,
      target: entry.target,
    })),
    occurrences: view.occurrences.map(occurrencePaths),
  };
}

// The workspace's three occurrences, in occurrence order (SPEC 5.7: by
// referencing file path bytes, then range start): alpha's local reference to
// beta, gamma's cross-directory reference to alpha through the import, and
// the marker in `useGamma`.
const A_OCCURRENCE: OccurrencePaths = {
  file: A_FILE,
  kind: "depends",
  source: ALPHA,
  target: BETA,
};
const B_OCCURRENCE: OccurrencePaths = {
  file: B_FILE,
  kind: "depends",
  source: GAMMA,
  target: ALPHA,
};
const CODE_OCCURRENCE: OccurrencePaths = {
  file: CODE_FILE,
  kind: "references",
  source: CODE_UNIT,
  target: GAMMA,
};

// The two spec sources' views (SPEC 11.4), projected: B's import resolves to
// A's file across directories.
const A_VIEW: ViewPaths = {
  file: A_FILE,
  root: {
    identity: A_ROOT,
    children: [
      { identity: ALPHA, children: [] },
      { identity: BETA, children: [] },
    ],
  },
  imports: [],
  occurrences: [A_OCCURRENCE],
};
const B_VIEW: ViewPaths = {
  file: B_FILE,
  root: { identity: B_ROOT, children: [{ identity: GAMMA, children: [] }] },
  imports: [{ name: "A", target: A_FILE }],
  occurrences: [B_OCCURRENCE],
};

/** One coverage profile's expected identities (SPEC 8.1, 8.2). */
interface ProfileExpectation {
  readonly name: string;
  readonly counts: {
    readonly required: number;
    readonly covered: number;
    readonly uncovered: number;
    readonly ignored: number;
  };
  /** In identity byte order. */
  readonly covered: readonly {
    readonly identity: string;
    readonly path: readonly string[];
  }[];
  /** Sorted. */
  readonly uncovered: readonly string[];
  /** How the counts arise, for the diagnosis. */
  readonly derivation: string;
}

/**
 * Assert one profile of a decoded coverage report: its counts, every covered
 * node with its one covering path (boundary node first — for profile q a
 * code location), every uncovered node, and the two ignored roots, each a
 * workspace-relative, `/`-separated identity (SPEC 1.5, 8.2).
 */
function assertIdentityProfile(
  profiles: readonly CoverageProfileReport[],
  expected: ProfileExpectation,
  label: string,
): void {
  const profile = profiles.find((each) => each.name === expected.name);
  if (profile === undefined) {
    fail(
      `${label}: expected the configured profile ${JSON.stringify(expected.name)} ` +
        `(SPEC 8.2: \`coverage\` runs all profiles); got ` +
        JSON.stringify(profiles.map((each) => each.name)),
    );
  }
  const context = `${label} profile ${expected.name}`;
  assertSameJson(
    profile.counts,
    expected.counts,
    `${context}: counts — ${expected.derivation} (SPEC 8.1, 8.2)`,
  );
  assertSameJson(
    profile.covered
      .map((node) => ({ identity: node.identity, path: [...node.path] }))
      .sort((a, b) =>
        Buffer.compare(
          Buffer.from(a.identity, "utf8"),
          Buffer.from(b.identity, "utf8"),
        ),
      ),
    expected.covered,
    `${context}: each covered node and its one covering path are ` +
      `workspace-relative identities (SPEC 1.5, 8.2)`,
  );
  assertSameJson(
    [...profile.uncovered].sort(),
    expected.uncovered,
    `${context}: uncovered identities are workspace-relative and /-separated`,
  );
  assertSameJson(
    sortedIdentities(profile.ignored),
    [A_ROOT, B_ROOT],
    `${context}: the ignored roots are identified by bare workspace-relative path (SPEC 1.5)`,
  );
  for (const ignored of profile.ignored) {
    // Reason spellings are output shape (SPEC 8.2 pins no wording):
    // classified onto their SPEC 8.2 identities through the coverage
    // adapter, as T8.2-1 and T1.2-3 do (H-3).
    assertSameJson(
      classifyIgnoredReasons(
        ignored.reasons,
        `${context} ignored ${ignored.identity}`,
      ),
      ["root"],
      `${context}: ${ignored.identity} exclusion reasons (targets: "all" — the root-node reason and nothing else, SPEC 8.2)`,
    );
  }
}

const T1_5_1 = defineProductTest({
  id: "T1.5-1",
  title:
    "identities and file paths in every output (query, show, ids, coverage, impact, and the occurrences, view, and at documents — identities, file members, import targets) are workspace-relative and /-separated, regardless of the working directory; and the human show, ids, coverage, and impact reports name every identity and path their --json documents carry, token-bounded, so none counts under a prefix such as the absolute workspace root (robust matching, H-3) (SPEC 1.5, 12.0)",
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": IDENTITY_CONFIG,
        [A_FILE]: IDENTITY_A_SOURCE,
        [B_FILE]: IDENTITY_B_BASELINE,
        [CODE_FILE]: IDENTITY_CODE_SOURCE,
      },
    });
    try {
      // Baseline commit (sources only), then a leaf edit, so `impact --base`
      // has categories to attribute to identities and a code location to
      // impact (SPEC 5.6, 9).
      await workspace.gitInit();
      await workspace.gitCommitAll("baseline");
      await workspace.file(B_FILE, IDENTITY_B_EDITED);

      // `query node` (JSON-only surface, SPEC 11).
      const nodeLabel = `T1.5-1 \`query node ${GAMMA}\``;
      const gamma = decodeNodeReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["query", "node", GAMMA],
            nodeLabel,
          ),
          nodeLabel,
        ),
        nodeLabel,
      );
      if (gamma.identity !== GAMMA) {
        fail(
          `${nodeLabel}: expected the workspace-relative identity ${JSON.stringify(GAMMA)} ` +
            `(SPEC 1.5), got ${JSON.stringify(gamma.identity)}`,
        );
      }
      assertBytesEqual(
        gamma.subtreeText,
        "Gamma edited text.\n",
        `${nodeLabel}: subtree text reflects the current (edited) source`,
      );
      // Edge endpoints are identities too: the structural edge names the
      // nested root by its bare workspace-relative path, the marker's
      // `references` edge the code location by its path and unit, and the
      // `depends` edge crosses directories (SPEC 1.5, 4.6, 5.2).
      assertEdgeSetEqual(
        gamma.incomingEdges,
        [
          { from: B_ROOT, to: GAMMA, kind: "contains" },
          { from: CODE_UNIT, to: GAMMA, kind: "references" },
        ],
        `${nodeLabel}: incoming edges name workspace-relative identities, the code location's included`,
      );
      assertEdgeSetEqual(
        gamma.outgoingEdges,
        [{ from: GAMMA, to: ALPHA, kind: "depends" }],
        `${nodeLabel}: outgoing edges name workspace-relative identities`,
      );

      // `query nodes`: every row's identity is a known workspace-relative
      // identity, and all three sections are present. (Whether roots appear
      // as rows is T11-2's business, not this test's.)
      const rowsLabel = "T1.5-1 `query nodes`";
      const rows = decodeNodeRowsReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["query", "nodes"],
            rowsLabel,
          ),
          rowsLabel,
        ),
        rowsLabel,
      );
      assertKnownIdentities(
        rows.map((row) => row.identity),
        rowsLabel,
      );
      for (const identity of [ALPHA, BETA, GAMMA]) {
        if (!rows.some((row) => row.identity === identity)) {
          fail(
            `${rowsLabel}: expected ${identity} among the reported rows; got ` +
              JSON.stringify(sortedIdentities(rows)),
          );
        }
      }

      // `show`, machine form: identity plus edges by kind (SPEC 12.4) — for
      // alpha, whose incoming edges come from its root and, across
      // directories, from gamma; for gamma, whose incoming edges include the
      // code location's.
      const showLabel = `T1.5-1 \`show ${ALPHA} --json\``;
      const alpha = decodeNodeReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["show", ALPHA, "--json"],
            showLabel,
          ),
          showLabel,
        ),
        showLabel,
      );
      if (alpha.identity !== ALPHA) {
        fail(
          `${showLabel}: expected the workspace-relative identity ${JSON.stringify(ALPHA)} ` +
            `(SPEC 1.5), got ${JSON.stringify(alpha.identity)}`,
        );
      }
      assertEdgeSetEqual(
        alpha.outgoingEdges,
        [{ from: ALPHA, to: BETA, kind: "depends" }],
        `${showLabel}: outgoing edges name workspace-relative identities`,
      );
      assertEdgeSetEqual(
        alpha.incomingEdges,
        [
          { from: A_ROOT, to: ALPHA, kind: "contains" },
          { from: GAMMA, to: ALPHA, kind: "depends" },
        ],
        `${showLabel}: incoming edges name workspace-relative identities`,
      );
      const showGammaLabel = `T1.5-1 \`show ${GAMMA} --json\``;
      const shownGamma = decodeNodeReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["show", GAMMA, "--json"],
            showGammaLabel,
          ),
          showGammaLabel,
        ),
        showGammaLabel,
      );
      if (shownGamma.identity !== GAMMA) {
        fail(
          `${showGammaLabel}: expected the workspace-relative identity ${JSON.stringify(GAMMA)} ` +
            `(SPEC 1.5), got ${JSON.stringify(shownGamma.identity)}`,
        );
      }
      assertEdgeSetEqual(
        shownGamma.incomingEdges,
        [
          { from: B_ROOT, to: GAMMA, kind: "contains" },
          { from: CODE_UNIT, to: GAMMA, kind: "references" },
        ],
        `${showGammaLabel}: incoming edges name workspace-relative identities, the code location's included`,
      );
      assertEdgeSetEqual(
        shownGamma.outgoingEdges,
        [{ from: GAMMA, to: ALPHA, kind: "depends" }],
        `${showGammaLabel}: outgoing edges name workspace-relative identities`,
      );

      // `show`, human form: the identity and every edge's endpoints are
      // required information (SPEC 12.4), each taken from the decoded
      // `--json` report above — the `contains` edges' roots and the code
      // location included — and asked token-bounded (`assertHumanIdentities`;
      // robust matching, never exact wording, H-3).
      const showHumanLabel = `T1.5-1 \`show ${ALPHA}\` (human report)`;
      assertHumanIdentities(
        await runFromRootAndNested(
          product,
          workspace,
          ["show", ALPHA],
          showHumanLabel,
        ),
        nodeReportIdentities(alpha),
        `${showHumanLabel}: the node's identity and every incoming and outgoing edge's endpoints`,
      );
      const showGammaHumanLabel = `T1.5-1 \`show ${GAMMA}\` (human report)`;
      assertHumanIdentities(
        await runFromRootAndNested(
          product,
          workspace,
          ["show", GAMMA],
          showGammaHumanLabel,
        ),
        nodeReportIdentities(shownGamma),
        `${showGammaHumanLabel}: the node's identity and every incoming and outgoing edge's endpoints, the code location's included`,
      );

      // `ids`: files in byte order of workspace-relative path, IDs in
      // document order (SPEC 12.3) — fully pinned for this workspace (the
      // code source holds no requirement ID).
      const idsLabel = "T1.5-1 `ids --json`";
      const ids = decodeIdsReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["ids", "--json"],
            idsLabel,
          ),
          idsLabel,
        ),
        idsLabel,
      );
      assertSameJson(
        ids.files,
        [
          { file: A_FILE, ids: ["alpha", "beta"] },
          { file: B_FILE, ids: ["gamma"] },
        ],
        `${idsLabel}: files listed by workspace-relative, /-separated path (SPEC 1.5, 12.3)`,
      );
      // `ids`, human form: the file of every entry listing an ID and every
      // listed ID, from the decoded listing, token-bounded (an ID never
      // counts inside a path).
      const idsHumanLabel = "T1.5-1 `ids` (human report)";
      assertHumanIdentities(
        await runFromRootAndNested(product, workspace, ["ids"], idsHumanLabel),
        idsReportIdentities(ids),
        `${idsHumanLabel}: every listed file by its workspace-relative path, and every listed ID`,
      );

      // `coverage`: covered/uncovered/ignored identities and the covering
      // paths all carry workspace-relative identities (SPEC 8.2) — profile
      // q's covering path starts at the code location.
      const coverageLabel = "T1.5-1 `coverage --json`";
      const coverage = decodeCoverageReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["coverage", "--json"],
            coverageLabel,
          ),
          coverageLabel,
        ),
        coverageLabel,
      );
      assertSameJson(
        coverage.profiles.map((profile) => profile.name).sort(),
        ["p", "q"],
        `${coverageLabel}: exactly the two configured profiles (SPEC 8.2: \`coverage\` runs all profiles)`,
      );
      assertIdentityProfile(
        coverage.profiles,
        {
          name: "p",
          counts: { required: 3, covered: 2, uncovered: 1, ignored: 2 },
          covered: [
            { identity: ALPHA, path: [GAMMA, ALPHA] },
            { identity: BETA, path: [ALPHA, BETA] },
          ],
          uncovered: [GAMMA],
          derivation:
            "required {alpha, beta, gamma}, covered {alpha (from gamma), " +
            "beta (from alpha)}, ignored the two roots",
        },
        coverageLabel,
      );
      assertIdentityProfile(
        coverage.profiles,
        {
          name: "q",
          counts: { required: 3, covered: 1, uncovered: 2, ignored: 2 },
          covered: [{ identity: GAMMA, path: [CODE_UNIT, GAMMA] }],
          uncovered: [ALPHA, BETA],
          derivation:
            "required {alpha, beta, gamma}, covered {gamma (from the code " +
            "location's marker)}, ignored the two roots",
        },
        coverageLabel,
      );
      // `coverage`, human form: every identity the decoded report carries —
      // the ignored roots included — token-bounded.
      const coverageHumanLabel = "T1.5-1 `coverage` (human report)";
      assertHumanIdentities(
        await runFromRootAndNested(
          product,
          workspace,
          ["coverage"],
          coverageHumanLabel,
        ),
        coverageReportIdentities(coverage),
        `${coverageHumanLabel}: every profile's covered identities and covering-path nodes, uncovered identities, and ignored identities`,
      );

      // `impact --base`: the leaf edit's worked example of SPEC 5.6 — gamma
      // `changed`, its root `descendant-changed` attributed to gamma — with
      // every identity in the workspace-relative form, and the code location
      // marking gamma directly impacted (SPEC 9.2, 9.3).
      const impactLabel = "T1.5-1 `impact --base HEAD --json`";
      const impact = decodeImpactReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["impact", "--base", "HEAD", "--json"],
            impactLabel,
          ),
          impactLabel,
        ),
        impactLabel,
      );
      if (impact.requirements.length !== 2) {
        fail(
          `${impactLabel}: a single leaf edit categorizes exactly the leaf (changed) and ` +
            `its root (descendant-changed) — two entries (SPEC 5.6, 9.3); got ` +
            JSON.stringify(impact.requirements),
        );
      }
      const gammaEntry = impact.requirements.find((entry) =>
        entry.nodes.includes(GAMMA),
      );
      const rootEntry = impact.requirements.find((entry) =>
        entry.nodes.includes(B_ROOT),
      );
      if (gammaEntry === undefined || rootEntry === undefined) {
        fail(
          `${impactLabel}: expected one entry for ${GAMMA} and one for ${B_ROOT} ` +
            `(SPEC 5.6, 1.5); got entries for ` +
            JSON.stringify(impact.requirements.map((entry) => entry.nodes)),
        );
      }
      assertSameJson(
        gammaEntry.nodes,
        [GAMMA],
        `${impactLabel}: the edited leaf's entry names its workspace-relative identity`,
      );
      assertSameJson(
        gammaEntry.deleted,
        false,
        `${impactLabel}: the edited leaf is present on both sides`,
      );
      assertSameJson(
        gammaEntry.categories.map((category) => category.category),
        ["changed"],
        `${impactLabel}: the edited leaf's only category (SPEC 5.6)`,
      );
      // Attribution of `changed` beyond the originating node itself is
      // T5.6-1's business; here only the identity form is at stake.
      assertKnownIdentities(
        gammaEntry.categories.flatMap((category) => category.attributedTo),
        `${impactLabel}: attribution identities of the leaf's entry`,
      );
      assertSameJson(
        rootEntry.nodes,
        [B_ROOT],
        `${impactLabel}: the ancestor entry names the root by bare workspace-relative path (SPEC 1.5)`,
      );
      assertSameJson(
        rootEntry.deleted,
        false,
        `${impactLabel}: the root is present on both sides`,
      );
      assertSameJson(
        rootEntry.categories,
        [{ category: "descendant-changed", attributedTo: [GAMMA] }],
        `${impactLabel}: the root's category is attributed to the edited leaf's ` +
          `workspace-relative identity (SPEC 5.6)`,
      );
      assertImpactedCode(
        impact,
        {
          direct: [
            {
              location: CODE_UNIT,
              edge: { from: CODE_UNIT, to: GAMMA, kind: "references" },
              path: [GAMMA],
            },
          ],
          transitive: [],
        },
        `${impactLabel}: the code location marking the edited leaf is directly ` +
          `impacted, its location, edge, and path workspace-relative identities`,
      );
      // `impact --base`, human form: every identity the decoded report
      // carries — the categorized nodes, the attribution identities, and the
      // impacted code's location, witness edge, and witness path —
      // token-bounded.
      const impactHumanLabel = "T1.5-1 `impact --base HEAD` (human report)";
      assertHumanIdentities(
        await runFromRootAndNested(
          product,
          workspace,
          ["impact", "--base", "HEAD"],
          impactHumanLabel,
        ),
        impactReportIdentities(impact),
        `${impactHumanLabel}: every requirement entry's nodes and attribution identities, and every impacted-code entry's location, witness edge endpoints, and witness path nodes`,
      );

      // `occurrences` (JSON-only, the 12.7 form, SPEC 11.3): every record's
      // referencing file, source identity, and target — spec and code
      // sources alike.
      const occurrencesLabel = "T1.5-1 `occurrences`";
      const occurrences = decodeOccurrencesReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["occurrences"],
            occurrencesLabel,
          ),
          occurrencesLabel,
        ),
        occurrencesLabel,
      );
      assertSameJson(
        occurrences.occurrences.map(occurrencePaths),
        [A_OCCURRENCE, B_OCCURRENCE, CODE_OCCURRENCE],
        `${occurrencesLabel}: each record's file, source identity, and target ` +
          `are workspace-relative and /-separated (SPEC 1.5, 5.7, 12.7)`,
      );

      // `view` (JSON-only, the 12.7 form, SPEC 11.4): every discovered spec
      // source, then B alone through a workspace-relative `<file>` operand
      // (SPEC 12.0) — each view's `file`, node identities, import targets,
      // and occurrence records.
      const viewLabel = "T1.5-1 `view`";
      const view = decodeViewReport(
        parseJsonStdout(
          await runFromRootAndNested(product, workspace, ["view"], viewLabel),
          viewLabel,
        ),
        { text: false },
        viewLabel,
      );
      assertSameJson(
        view.views.map(viewPaths),
        [A_VIEW, B_VIEW],
        `${viewLabel}: each view's file, identities, import targets, and ` +
          `occurrence records are workspace-relative and /-separated (SPEC 1.5, 11.4, 12.7)`,
      );
      const viewBLabel = `T1.5-1 \`view ${B_FILE}\``;
      const viewB = decodeViewReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["view", B_FILE],
            viewBLabel,
          ),
          viewBLabel,
        ),
        { text: false },
        viewBLabel,
      );
      assertSameJson(
        viewB.views.map(viewPaths),
        [B_VIEW],
        `${viewBLabel}: the view's file, identities, import target, and ` +
          `occurrence record are workspace-relative and /-separated (SPEC 1.5, 11.4, 12.7)`,
      );

      // `at` (JSON-only, the 12.7 form, SPEC 11.5): an offset inside
      // gamma's reference resolves to gamma and that occurrence's record.
      const atLabel = `T1.5-1 \`at ${B_FILE} ${String(AT_OFFSET)}\``;
      const atReport = decodeAtReport(
        parseJsonStdout(
          await runFromRootAndNested(
            product,
            workspace,
            ["at", B_FILE, String(AT_OFFSET)],
            atLabel,
          ),
          atLabel,
        ),
        atLabel,
      );
      const resolution = atReport.resolution;
      if ("unavailable" in resolution) {
        fail(
          `${atLabel}: the resolution of an offset in a parseable file is ` +
            `available (SPEC 11.5, 11.2); got the unavailability marker`,
        );
      }
      assertSameJson(
        {
          section: resolution.section.identity,
          occurrence:
            resolution.occurrence === null
              ? null
              : occurrencePaths(resolution.occurrence),
        },
        { section: GAMMA, occurrence: B_OCCURRENCE },
        `${atLabel}: the enclosing section's identity and the occurrence ` +
          `record's file, source identity, and target are workspace-relative ` +
          `and /-separated (SPEC 1.5, 11.5, 12.7)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T1.5-2
// ---------------------------------------------------------------------------

// The `#` code arm's code source at `src/a#b.ts`, staged after the spec
// arm's invocation: a staged-source record (S-9's timing clause).
const CODE_ARM_SOURCE = stagedTs(
  "T1.5-2/T12.0-15 code arm src/a#b.ts",
  "export const ok = 1;\n",
);

// One spec group plus one code group, for the code-group arms (SPEC 7.2) —
// the `#` arm, the U+FFFD arm, and the non-UTF-8 arm — each staged after
// the spec arm's invocation: a staged-source record (S-9).
const SPEC_AND_CODE_CONFIG = stagedTs(
  "T1.5-2/T12.0-15 the code-group arms' xspec.config.ts (one spec group, one code group)",
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

// Valid content everywhere but the located arm's: the invalid-path
// condition (14.19) must be the only condition present, so the exact-count
// assertion has teeth.
// The valid section source, one staged-source record staged at the spec
// path of every arm but the located one: the spec arm's `specs/a#b.mdx`
// (the body's first workspace), the code-group arms' `specs/OK.mdx` and the
// U+FFFD spec arm's `specs/A<U+FFFD>.mdx` (initial files of workspaces
// created after the spec arm's invocation), and, on the Linux leg, the
// non-UTF-8 spec arm's byte-path `file()` staging (a byte path cannot key a
// `files` entry) — judged before any product exists (S-9,
// test/self/s9-staged-sources.test.ts). Its section `ok` is the code-group
// arms' marker target.
const VALID_SECTION_SOURCE = stagedMdx(
  "T1.5-2/T12.0-15 the valid section source at the spec path of every arm but the located one",
  '<S id="ok">\nValid content.\n</S>\n',
);

// `specs/b<0xFF>.mdx`: 0xFF can occur in no valid UTF-8 sequence, so the
// workspace-relative path is not valid UTF-8. The glob rules of SPEC 7 match
// byte-wise, so `specs/**/*.mdx` discovers it. Realizable only where file
// names are byte strings — the Linux leg (TEST-SPEC T1.5-2). The non-UTF-8
// spec arm and the located arm, each in its own workspace, stage it.
const NON_UTF8_SPEC_PATH = Buffer.concat([
  Buffer.from("specs/b", "utf8"),
  Buffer.from([0xff]),
  Buffer.from(".mdx", "utf8"),
]);

// The marked byte form of that path — the concerned path a 14.19 finding
// presents for a non-UTF-8 path, and the located arm's 14.1 location file
// (SPEC 12.0, 12.7) — composed from the SAME bytes that stage the file,
// never measured from product output.
const NON_UTF8_MARKED_PATH = {
  bytes: NON_UTF8_SPEC_PATH.toString("hex"),
} as const;

/**
 * A construct's byte range inside a fixture beginning `prefix + construct`
 * (SPEC 1.7: offsets count bytes).
 */
function byteRangeAfter(prefix: string, construct: string): SourceRange {
  const start = Buffer.byteLength(prefix, "utf8");
  return { start, end: start + Buffer.byteLength(construct, "utf8") };
}

/**
 * Fixture self-check (the T5.7-2 discipline), made before the body's first
 * product invocation: a composed range slices the staged text's bytes to
 * exactly the construct it names — a plain `Error` otherwise, a harness
 * defect (H-8).
 */
function assertRangeSlices(
  text: string,
  range: SourceRange,
  construct: string,
  what: string,
): void {
  const sliced = Buffer.from(text, "utf8")
    .subarray(range.start, range.end)
    .toString("utf8");
  if (sliced !== construct) {
    throw new Error(
      `T1.5-2 fixture self-check: ${what}'s range [${String(range.start)}, ` +
        `${String(range.end)}) slices ${JSON.stringify(sliced)}, not ` +
        JSON.stringify(construct),
    );
  }
}

// The code-group arms' code source: an import of the valid spec source and
// one bare top-level marker (SPEC 4.5), whose occurrence spans its reference
// chain alone, exclusive of the `;` (5.7), its source the whole-file
// location (4.6) — which has no defined identity over an invalid path
// (11.2), so the record's `source` is explicitly unavailable. The
// multi-byte comment shifts every later offset (1.7). One staged-source
// record (S-9's timing clause), staged at both arms' paths after the spec
// arm's invocation.
const CODE_MARKER_PREFIX =
  "// Präambel — a code source at an invalid path.\n" +
  'import SPEC from "../specs/OK.xspec";\n\n';
const CODE_MARKER = "SPEC.ok";
const CODE_MARKER_TEXT = `${CODE_MARKER_PREFIX}${CODE_MARKER};\n`;
const CODE_MARKER_SOURCE = stagedTs(
  "T1.5-2/T12.0-15 the code-group arms' code source (an import of specs/OK.xspec and the bare marker SPEC.ok), staged at src/a<U+FFFD>.ts and, on the Linux leg, src/c<0xFF>.ts",
  CODE_MARKER_TEXT,
);
const CODE_MARKER_RANGE = byteRangeAfter(CODE_MARKER_PREFIX, CODE_MARKER);

// The marker's target: the valid spec source's section, a defined identity
// over a valid path, so the spelling resolves and records an occurrence
// (SPEC 11.2) — a plain string (no identity carries an invalid path, 12.0).
const CODE_MARKER_TARGET = "specs/OK.mdx#ok";

// `src/a<U+FFFD>.ts` (TEST-SPEC T1.5-2's spelling): valid UTF-8 (U+FFFD
// encodes as EF BF BD), so every leg holds the name and `src/**/*.ts`
// discovers it (SPEC 7); a U+FFFD path is presented as its plain string,
// never the marked byte form (12.0).
const REPLACEMENT_CHARACTER_CODE_PATH = `src/a${REPLACEMENT_CHARACTER}.ts`;

// `src/c<0xFF>.ts`: a non-UTF-8 code path, realizable only where file names
// are byte strings — the Linux leg — and its marked byte form, composed
// from the SAME bytes that stage the file (SPEC 12.0, 12.7).
const NON_UTF8_CODE_PATH = Buffer.concat([
  Buffer.from("src/c", "utf8"),
  Buffer.from([0xff]),
  Buffer.from(".ts", "utf8"),
]);
const NON_UTF8_CODE_MARKED_PATH = {
  bytes: NON_UTF8_CODE_PATH.toString("hex"),
} as const;

// The located arm's spec source, staged at `specs/b<0xFF>.mdx` (Linux leg):
// a multi-byte prelude — so a product counting code points rather than
// bytes misses the offsets (SPEC 1.7) — then one non-root section with no
// `id` (14.1), whose opening tag carries an attribute, so the tag's range
// differs from the construct's and from the tag name's (T14-11's arm (i)
// form). Staged after the spec arm's invocation: a staged-source record
// (S-9).
const LOCATED_PRELUDE = "Prólogo — a non-UTF-8-named spec source.\n\n";
const LOCATED_OPENING_TAG = '<S coverage="none">';
const LOCATED_TEXT = `${LOCATED_PRELUDE}${LOCATED_OPENING_TAG}\nNo id here.\n</S>\n`;
const LOCATED_SOURCE = stagedMdx(
  "T1.5-2/T12.0-15 located arm specs/b<0xFF>.mdx (Linux leg: a non-root section with no id after a multi-byte prelude)",
  LOCATED_TEXT,
);
const LOCATED_OPENING_TAG_RANGE = byteRangeAfter(
  LOCATED_PRELUDE,
  LOCATED_OPENING_TAG,
);

/**
 * The asserted projection of a finding (the T11.2-3 discipline): the stable
 * code, every location — its file in the form 12.0 fixes for it and its
 * byte range, `[]` for a path-level condition — and the concerned path in
 * that form, `null` for a located condition (SPEC 14, 12.7). Message and
 * identities stay unpinned (informational for 14.1 and 14.19 alike, 12.7).
 */
export interface FindingProjection {
  readonly code: string | null;
  readonly locations: readonly FindingLocation[];
  readonly path: PathValue | null;
}

function projectFindingForm(finding: Finding): FindingProjection {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

/**
 * A 14.19 finding's projection: the stable code, no in-source locations (a
 * path-level condition), and `path` as the concerned path (SPEC 14, 12.7).
 */
function invalidPathFinding(path: PathValue): FindingProjection {
  return { code: "invalid-source-path", locations: [], path };
}

/**
 * One arm of T1.5-2 as its body stages it — and as T12.0-15 restages it
 * (section-12.0-iv.ts: `build` and `check` in both output forms on every
 * arm, each human report's paths held to the forms 12.0 fixes, and the
 * non-UTF-8 arms' reports to byte-identity across two runs): a fresh
 * workspace holding `files`, then `staged` written through the builder (a
 * path no `files` key holds — a byte path — or the code-group arms' code
 * source, staged beside the spec source they import), and its findings as
 * T1.5-2 pins them, each projected onto its code, locations, and concerned
 * path (`projectFindingForm`).
 */
export interface T152Arm {
  /** The arm, for diagnostics. */
  readonly label: string;
  /**
   * Its staged path is not valid UTF-8: staged on the Linux leg alone,
   * where file names are byte strings (TEST-SPEC T1.5-2).
   */
  readonly nonUtf8: boolean;
  /** The workspace's initial files. */
  readonly files: Readonly<Record<string, InitialFileContents>>;
  /** The file written once the workspace exists, where the arm stages one. */
  readonly staged?: {
    readonly path: string | Buffer;
    readonly source: StagedMdx | StagedTs;
  };
  /**
   * Its findings as T1.5-2 pins them, in 12.7's order — at the `#` arms,
   * whose body pins the one 14.19's count and concerned path, the code and
   * the `locations` `[]` 14 and 12.7 fix for that path-level condition.
   */
  readonly expected: readonly FindingProjection[];
}

/** Stage `arm` on a fresh workspace (H-1), disposed by the caller. */
export async function stageT152Arm(arm: T152Arm): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create({ files: arm.files });
  try {
    if (arm.staged !== undefined) {
      await workspace.file(arm.staged.path, arm.staged.source);
    }
    return workspace;
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/** The spec-group arm: a discovered `.mdx` whose path contains `#`. */
const T1_5_2_HASH_SPEC_ARM: T152Arm = {
  label: "a spec-group file at specs/a#b.mdx",
  nonUtf8: false,
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/a#b.mdx": VALID_SECTION_SOURCE,
  },
  expected: [invalidPathFinding("specs/a#b.mdx")],
};

/** The `#` code-group arm: the spec source beside it valid. */
const T1_5_2_HASH_CODE_ARM: T152Arm = {
  label: "a code-group file at src/a#b.ts",
  nonUtf8: false,
  files: {
    "xspec.config.ts": SPEC_AND_CODE_CONFIG,
    "specs/OK.mdx": VALID_SECTION_SOURCE,
    "src/a#b.ts": CODE_ARM_SOURCE,
  },
  expected: [invalidPathFinding("src/a#b.ts")],
};

/** The non-UTF-8 spec-group arm (Linux leg): `specs/b<0xFF>.mdx`. */
const T1_5_2_NON_UTF8_SPEC_ARM: T152Arm = {
  label: "a discovered spec source whose path is not valid UTF-8 (Linux leg)",
  nonUtf8: true,
  files: { "xspec.config.ts": SPECS_ONLY_CONFIG },
  staged: { path: NON_UTF8_SPEC_PATH, source: VALID_SECTION_SOURCE },
  expected: [invalidPathFinding(NON_UTF8_MARKED_PATH)],
};

/** The U+FFFD spec-group arm, both legs: `specs/A<U+FFFD>.mdx`. */
const T1_5_2_REPLACEMENT_SPEC_ARM: T152Arm = {
  label:
    "a discovered spec source whose path contains U+FFFD (specs/A<U+FFFD>.mdx, both legs)",
  nonUtf8: false,
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    [REPLACEMENT_CHARACTER_SPEC_PATH]: VALID_SECTION_SOURCE,
  },
  expected: [invalidPathFinding(REPLACEMENT_CHARACTER_SPEC_PATH)],
};

/** The U+FFFD code-group arm, both legs: `src/a<U+FFFD>.ts`. */
const T1_5_2_REPLACEMENT_CODE_ARM: T152Arm = {
  label: "src/a<U+FFFD>.ts, both legs",
  nonUtf8: false,
  files: {
    "xspec.config.ts": SPEC_AND_CODE_CONFIG,
    "specs/OK.mdx": VALID_SECTION_SOURCE,
  },
  staged: { path: REPLACEMENT_CHARACTER_CODE_PATH, source: CODE_MARKER_SOURCE },
  expected: [invalidPathFinding(REPLACEMENT_CHARACTER_CODE_PATH)],
};

/** The non-UTF-8 code-group arm (Linux leg): `src/c<0xFF>.ts`. */
const T1_5_2_NON_UTF8_CODE_ARM: T152Arm = {
  label: "src/c<0xFF>.ts, not valid UTF-8, Linux leg",
  nonUtf8: true,
  files: {
    "xspec.config.ts": SPEC_AND_CODE_CONFIG,
    "specs/OK.mdx": VALID_SECTION_SOURCE,
  },
  staged: { path: NON_UTF8_CODE_PATH, source: CODE_MARKER_SOURCE },
  expected: [invalidPathFinding(NON_UTF8_CODE_MARKED_PATH)],
};

/**
 * The located arm (Linux leg): `specs/b<0xFF>.mdx` holding an id-less
 * non-root section — its 14.1, located at the opening tag, its location
 * file the marked byte form, then its 14.19 (12.7's order).
 */
const T1_5_2_LOCATED_ARM: T152Arm = {
  label:
    "a non-UTF-8-named spec source holding a non-root section with no id, Linux leg",
  nonUtf8: true,
  files: { "xspec.config.ts": SPECS_ONLY_CONFIG },
  staged: { path: NON_UTF8_SPEC_PATH, source: LOCATED_SOURCE },
  expected: [
    {
      code: "missing-id",
      locations: [
        { file: NON_UTF8_MARKED_PATH, range: LOCATED_OPENING_TAG_RANGE },
      ],
      path: null,
    },
    invalidPathFinding(NON_UTF8_MARKED_PATH),
  ],
};

/**
 * T1.5-2's every arm, in its body's order (TEST-SPEC T1.5-2; T12.0-15's
 * fixtures): the `#` spec and code arms, the non-UTF-8 spec arm, the U+FFFD
 * spec arm, the U+FFFD and non-UTF-8 code-group arms, and the located arm
 * — the non-UTF-8 arms (`nonUtf8`) staged on the Linux leg alone.
 */
export const T1_5_2_ARMS: readonly T152Arm[] = [
  T1_5_2_HASH_SPEC_ARM,
  T1_5_2_HASH_CODE_ARM,
  T1_5_2_NON_UTF8_SPEC_ARM,
  T1_5_2_REPLACEMENT_SPEC_ARM,
  T1_5_2_REPLACEMENT_CODE_ARM,
  T1_5_2_NON_UTF8_CODE_ARM,
  T1_5_2_LOCATED_ARM,
];

/**
 * `build --json`, then `check --json`, on a never-built workspace whose
 * sources fail `build`'s validations: each exits 1 (H-5) with exactly the
 * expected condition counts and findings in 12.7's order (SPEC 12.1, 12.2,
 * 12.7, 14). `check` performs every build validation (12.2); on a
 * workspace failing them the mismatch forms of 14.10 are undetectable and
 * go unreported, and with no record neither the unreadable-record form nor
 * the recorded-file form can arise (14.10), so `check`'s findings are
 * `build`'s exactly.
 */
async function expectBuildAndCheckFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
  counts: Readonly<Record<string, number>>,
  expected: readonly FindingProjection[],
  context: string,
  what: string,
): Promise<void> {
  for (const command of ["build", "check"] as const) {
    const commandContext = `${context} — \`${command} --json\``;
    const exitWhy =
      command === "build"
        ? "a `build` failing validation reports its findings and exits 1 " +
          "(SPEC 12.0, 12.1)"
        : "`check` performs every build validation and exits 1 on any " +
          "finding (SPEC 12.2)";
    const findings = await runFindingsReport(
      product,
      workspace,
      [command, "--json"],
      1,
      `${commandContext} — ${exitWhy}`,
    );
    assertConditionCounts(findings, counts, commandContext);
    assertSameJson(
      findings.map(projectFindingForm),
      expected,
      `${commandContext} — ${what}`,
    );
  }
}

/**
 * A code-group arm: `build` and `check` each report exactly the code
 * source's 14.19, its concerned path in the arm's presentation, and bare
 * `occurrences` — its consulted domain the entire discovered set (SPEC
 * 11.3) — carries that one finding and the marker's one record: `file` the
 * same presentation (the marked form's hex is the staged bytes exactly),
 * the chain's byte range, kind `references`, `source` exactly the
 * unavailability marker — the whole-file location of an invalid-path file
 * has no defined identity, withheld with its range as one datum (11.2, 5.7)
 * — and the defined target (12.7). A product vetting spec-group paths
 * alone builds finding-free and fails `build`'s exit code.
 */
async function runInvalidCodePathArm(
  product: ProductBinding,
  arm: T152Arm,
): Promise<void> {
  const workspace = await stageT152Arm(arm);
  try {
    const context = `T1.5-2 code-group arm (${arm.label})`;
    const expected19 = arm.expected[0]!;
    const presented = expected19.path!;
    await expectBuildAndCheckFindings(
      product,
      workspace,
      { "14.19": 1 },
      [expected19],
      context,
      `the code source's condition-19 finding alone, carrying the stable ` +
        `code, no in-source locations, and its path as the concerned path ` +
        `in the form 12.0 fixes — 14.19 covers code sources too (SPEC 14, ` +
        `7, 12.0, 12.7)`,
    );

    const occContext = `${context} — bare \`occurrences\``;
    const occResult = await runCli(product, workspace, ["occurrences"]);
    assertExitCode(
      occResult,
      1,
      `${occContext} — the answer carries the domain's finding and an ` +
        `explicitly-unavailable source datum, so exit 1 with the full ` +
        `document emitted (SPEC 11.2, 11.3)`,
    );
    const occReport = decodeOccurrencesReport(
      parseJsonStdout(
        occResult,
        `${occContext} — a single JSON document is the only output form, ` +
          `with or without --json (SPEC 11)`,
      ),
      occContext,
    );
    assertSameJson(
      occReport.findings.map(projectFindingForm),
      [expected19],
      `${occContext} — the consulted domain is the entire discovered set, ` +
        `so the code source's condition-19 finding accompanies the answer, ` +
        `the valid spec source contributing none (SPEC 11.2, 11.3)`,
    );
    const expectedRecord: OccurrenceRecord = {
      file: presented,
      range: CODE_MARKER_RANGE,
      kind: "references",
      source: { unavailable: true },
      target: CODE_MARKER_TARGET,
    };
    assertSameJson(
      occReport.occurrences,
      [expectedRecord],
      `${occContext} — the marker still records its one occurrence: ` +
        `\`file\` the referencing file in the form 12.0 fixes, \`range\` ` +
        `the bare chain's bytes, \`kind\` "references", \`source\` exactly ` +
        `the unavailability marker — no identity over an invalid path, ` +
        `identity and range withheld together as one datum, never a picked ` +
        `identity, never a dropped record — and \`target\` the defined ` +
        `section (SPEC 5.7, 11.2, 11.3, 12.0, 12.7)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * A 14.19 finding must identify the offending source by its exact
 * workspace-relative path (SPEC 14, 1.5). The condition is about the path
 * itself, so no in-file location is required of it.
 */
function assertFindingFile(
  finding: Finding,
  expectedFile: string,
  context: string,
): void {
  // 14.19 is a path-level condition: it carries the file's path as the
  // concerned path (SPEC 14, 12.7 — no in-source location).
  if (finding.path !== expectedFile) {
    fail(
      `${context}: the finding must identify the offending workspace-relative source ` +
        `path as its concerned path (SPEC 14, 1.5, 12.7); expected ` +
        `${JSON.stringify(expectedFile)}, got ${JSON.stringify(finding.path)} ` +
        `(message: ${JSON.stringify(finding.message)})`,
    );
  }
}

const T1_5_2 = defineProductTest({
  id: "T1.5-2",
  title:
    "a discovered source path containing `#` fails with 14.19 (spec-group and code-group arms); a non-UTF-8 discovered path fails with 14.19 with its concerned path in the marked byte form, staged on the Linux leg; a discovered path containing U+FFFD (specs/A<U+FFFD>.mdx) fails with 14.19 on both legs — stable code `invalid-source-path`, locations [], the concerned path presented as the plain string, never the byte form; the U+FFFD and non-UTF-8 arms are staged for a code-group file too (src/a<U+FFFD>.ts on both legs, src/c<0xFF>.ts on the Linux leg), its code source importing a valid spec source and spelling one bare marker: `build` and `check` each exit 1 with exactly its 14.19, the concerned path the plain string, respectively the marked byte form, and bare `occurrences` carries that finding beside the marker's one record, `source` exactly the unavailability marker and `file` that same presentation, `range`, `kind`, and `target` present — failing a product that vets spec-group paths alone; a located arm (Linux leg): a non-UTF-8-named `.mdx` holding a non-root section with no `id` — `build` and `check` each exit 1 with exactly its 14.1 beside its 14.19, the 14.1's location file the marked byte form and its range exactly the section's opening tag, failing a product that marks concerned paths alone (SPEC 1.5, 5.7, 7, 11.2, 11.3, 11.4, 12.0, 12.2, 12.7, 14.1, 14.19)",
  run: async (product) => {
    // Fixture self-checks (the T5.7-2 discipline), before the body's first
    // product invocation: each precomputed range slices the staged bytes
    // back to its construct.
    assertRangeSlices(
      CODE_MARKER_TEXT,
      CODE_MARKER_RANGE,
      CODE_MARKER,
      "the code-group arms' bare marker chain",
    );
    assertRangeSlices(
      LOCATED_TEXT,
      LOCATED_OPENING_TAG_RANGE,
      LOCATED_OPENING_TAG,
      "the located arm's opening tag",
    );

    // Spec-group arm: a discovered `.mdx` whose path contains `#`.
    const specArm = await stageT152Arm(T1_5_2_HASH_SPEC_ARM);
    try {
      const context =
        "T1.5-2 `build --json` with a spec-group file at specs/a#b.mdx";
      const findings = await buildFindings(product, specArm, context);
      assertConditionCounts(findings, { "14.19": 1 }, context);
      assertFindingFile(findings[0]!, "specs/a#b.mdx", context);
    } finally {
      await specArm.dispose();
    }

    // `#` code-group arm: 14.19 covers code sources too (SPEC 14.19 names
    // both kinds); the spec source beside it is valid, so the one condition
    // is the code file's path.
    const codeArm = await stageT152Arm(T1_5_2_HASH_CODE_ARM);
    try {
      const context =
        "T1.5-2 `build --json` with a code-group file at src/a#b.ts";
      const findings = await buildFindings(product, codeArm, context);
      assertConditionCounts(findings, { "14.19": 1 }, context);
      assertFindingFile(findings[0]!, "src/a#b.ts", context);
    } finally {
      await codeArm.dispose();
    }

    // Non-UTF-8 arm, staged on the Linux leg per T1.5-2's own text: Linux
    // file names are byte strings, so the fixture stages verbatim (the
    // builder's byte-path `file`, S-2's round-trip); other platforms'
    // filesystems cannot hold the path at all. The finding's concerned path
    // is the marked byte form — the path's exact bytes, the one presentation
    // 12.0 admits for a non-UTF-8 path (SPEC 12.0, 12.7).
    if (process.platform === "linux") {
      const nonUtf8Arm = await stageT152Arm(T1_5_2_NON_UTF8_SPEC_ARM);
      try {
        const context =
          "T1.5-2 `build --json` with a discovered spec source whose path is not valid UTF-8 (Linux leg)";
        const findings = await buildFindings(product, nonUtf8Arm, context);
        assertConditionCounts(findings, { "14.19": 1 }, context);
        assertSameJson(
          projectFindingForm(findings[0]!),
          T1_5_2_NON_UTF8_SPEC_ARM.expected[0],
          `${context} — the condition-19 finding carries the stable code, ` +
            `no in-source locations, and the non-UTF-8 concerned path in ` +
            `the marked byte form (SPEC 14, 12.0, 12.7)`,
        );
      } finally {
        await nonUtf8Arm.dispose();
      }
    }

    // U+FFFD arm, both legs: the path is valid UTF-8 (U+FFFD encodes as
    // EF BF BD), so every platform holds the name and the byte-wise glob
    // `specs/**/*.mdx` discovers it (SPEC 7); a path containing U+FFFD is an
    // invalid source path (14.19) with a plain string form — the finding's
    // concerned path is exactly that string, never the marked byte form,
    // which 12.0 reserves for a non-UTF-8 path (SPEC 12.0, 12.7). A product
    // discovering the file as valid builds finding-free and fails the count;
    // one presenting the path in the byte form fails the projection.
    const replacementArm = await stageT152Arm(T1_5_2_REPLACEMENT_SPEC_ARM);
    try {
      const context =
        "T1.5-2 `build --json` with a discovered spec source whose path contains U+FFFD (specs/A<U+FFFD>.mdx, both legs)";
      const findings = await buildFindings(product, replacementArm, context);
      assertConditionCounts(findings, { "14.19": 1 }, context);
      assertSameJson(
        projectFindingForm(findings[0]!),
        T1_5_2_REPLACEMENT_SPEC_ARM.expected[0],
        `${context} — the condition-19 finding carries the stable code, no ` +
          `in-source locations, and the U+FFFD concerned path as a plain ` +
          `string — never the marked byte form, which 12.0 reserves for a ` +
          `non-UTF-8 path (SPEC 14, 12.0, 12.7)`,
      );
    } finally {
      await replacementArm.dispose();
    }

    // The U+FFFD and non-UTF-8 arms staged for a code-group file (TEST-SPEC
    // T1.5-2; 14.19 covers both kinds): src/a<U+FFFD>.ts on every leg the
    // test runs, its path presented as the plain string, and — where file
    // names are byte strings, the Linux leg — src/c<0xFF>.ts, presented in
    // the marked byte form (SPEC 12.0, 12.7).
    await runInvalidCodePathArm(product, T1_5_2_REPLACEMENT_CODE_ARM);
    if (process.platform === "linux") {
      await runInvalidCodePathArm(product, T1_5_2_NON_UTF8_CODE_ARM);
    }

    // Located arm (Linux leg): the non-UTF-8-named spec source holds an
    // id-less non-root section, so beside its 14.19 the file carries a
    // located finding — structure and validation are parse-local (SPEC
    // 11.2) — whose location file is the path in the marked byte form
    // (12.0) and whose range is exactly the section's opening tag (14: the
    // opening-tag range of 11.4). In 12.7's order: 14.1, then 14.19.
    if (process.platform === "linux") {
      const locatedArm = await stageT152Arm(T1_5_2_LOCATED_ARM);
      try {
        await expectBuildAndCheckFindings(
          product,
          locatedArm,
          { "14.1": 1, "14.19": 1 },
          T1_5_2_LOCATED_ARM.expected,
          "T1.5-2 located arm (a non-UTF-8-named spec source holding a non-root section with no id, Linux leg)",
          `the condition-1 finding, located — its location file the ` +
            `non-UTF-8 path in the marked byte form, its range exactly the ` +
            `section's opening tag, \`path\` null — then the file's ` +
            `condition-19 finding, its concerned path the same marked form ` +
            `(SPEC 14, 11.4, 12.0, 12.7)`,
        );
      } finally {
        await locatedArm.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T1.5-3
// ---------------------------------------------------------------------------

// Root-level prose distinct from the section's text, so `path#id` vs bare
// `path` addressing is discriminated by byte-anchored content (SPEC 1.6, 3),
// never just by an echoed identity.
const ADDRESSING_SOURCE = [
  "Intro prose.",
  "",
  '<S id="sec">',
  "Section text.",
  "</S>",
  "",
].join("\n");

// Compiled output of the file (SPEC 3: the tag-only lines are dropped with
// their terminators) — the root's subtree text (SPEC 1.2, 1.6).
const ROOT_COMPILED_TEXT = "Intro prose.\n\nSection text.\n";
// The section's contribution — its subtree text.
const SECTION_TEXT = "Section text.\n";

/** `query node <identity>` must resolve to the node with the given text. */
async function assertNodeAt(
  product: ProductBinding,
  workspace: TestWorkspace,
  identity: string,
  subtreeText: string,
  context: string,
): Promise<void> {
  const label = `${context} \`query node ${identity}\``;
  const node = decodeNodeReport(
    await runJson(product, workspace, ["query", "node", identity], label),
    label,
  );
  if (node.identity !== identity) {
    fail(
      `${label}: expected the address to resolve to ${JSON.stringify(identity)} ` +
        `(SPEC 1.5), got ${JSON.stringify(node.identity)}`,
    );
  }
  assertBytesEqual(
    node.subtreeText,
    subtreeText,
    `${label}: subtree text of the addressed node`,
  );
}

const T1_5_3 = defineProductTest({
  id: "T1.5-3",
  title:
    "`path#id` addresses a section and bare `path` addresses the root across `query node`, `show`, and `move`/`rename` arguments (SPEC 1.5, 6.4, 6.5, 11, 12.4)",
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": ADDRESSING_SOURCE,
      },
    });
    try {
      await buildOk(product, workspace, "T1.5-3 `build`");

      // `query node`: `path#id` → the section; bare `path` → the root.
      await assertNodeAt(
        product,
        workspace,
        "specs/A.mdx#sec",
        SECTION_TEXT,
        "T1.5-3",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/A.mdx",
        ROOT_COMPILED_TEXT,
        "T1.5-3",
      );

      // `show`: the same addressing duality (SPEC 12.4; --json for decoding —
      // the JSON form carries the same information, SPEC 12.0).
      for (const [address, expectedText] of [
        ["specs/A.mdx#sec", SECTION_TEXT],
        ["specs/A.mdx", ROOT_COMPILED_TEXT],
      ] as const) {
        const label = `T1.5-3 \`show ${address} --json\``;
        const shown = decodeNodeReport(
          await runJson(product, workspace, ["show", address, "--json"], label),
          label,
        );
        if (shown.identity !== address) {
          fail(
            `${label}: expected the address to resolve to ${JSON.stringify(address)} ` +
              `(SPEC 1.5, 12.4), got ${JSON.stringify(shown.identity)}`,
          );
        }
        assertBytesEqual(
          shown.subtreeText,
          expectedText,
          `${label}: subtree text of the addressed node`,
        );
      }

      // `rename <file> <old-id> <new-id>`: the file argument is a bare
      // workspace-relative path (SPEC 6.4, 12.0).
      await expectExit(
        product,
        workspace,
        ["rename", "specs/A.mdx", "sec", "renamed"],
        0,
        "T1.5-3 `rename specs/A.mdx sec renamed`",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/A.mdx#renamed",
        SECTION_TEXT,
        "T1.5-3 after rename:",
      );

      // File-form `move`: two bare paths address whole files — IDs are
      // unchanged, identities change only in their file part (SPEC 6.5).
      await expectExit(
        product,
        workspace,
        ["move", "specs/A.mdx", "specs/moved/AA.mdx"],
        0,
        "T1.5-3 `move specs/A.mdx specs/moved/AA.mdx` (file form)",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/moved/AA.mdx",
        ROOT_COMPILED_TEXT,
        "T1.5-3 after file move:",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/moved/AA.mdx#renamed",
        SECTION_TEXT,
        "T1.5-3 after file move:",
      );

      // Section-form `move`: `path#id` on both sides addresses the section
      // subtree — extracted from the origin, re-identified at the target
      // (SPEC 6.5).
      await expectExit(
        product,
        workspace,
        ["move", "specs/moved/AA.mdx#renamed", "specs/Target.mdx#extracted"],
        0,
        "T1.5-3 `move specs/moved/AA.mdx#renamed specs/Target.mdx#extracted` (section form)",
      );
      await assertNodeAt(
        product,
        workspace,
        "specs/Target.mdx#extracted",
        SECTION_TEXT,
        "T1.5-3 after section move:",
      );
      // The created target file's root is addressable by bare path, and the
      // moved section is its whole content.
      await assertNodeAt(
        product,
        workspace,
        "specs/Target.mdx",
        SECTION_TEXT,
        "T1.5-3 after section move:",
      );
      // The `path#id` argument extracted the section, not the file: the
      // origin file remains, holding only its root.
      const subtreeLabel =
        "T1.5-3 after section move: `query subtree specs/moved/AA.mdx`";
      const originRows = decodeNodeRowsReport(
        await runJson(
          product,
          workspace,
          ["query", "subtree", "specs/moved/AA.mdx"],
          subtreeLabel,
        ),
        subtreeLabel,
      );
      assertSameJson(
        originRows.map((row) => row.identity),
        ["specs/moved/AA.mdx"],
        `${subtreeLabel}: only the origin root remains — the section subtree was extracted`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

/** TEST-SPEC §1.5, in canonical ID order (SUITE-04). */
export const section15Tests: readonly ProductTestEntry[] = [
  T1_5_1,
  T1_5_2,
  T1_5_3,
];
