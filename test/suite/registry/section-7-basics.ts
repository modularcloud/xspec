// TEST-SPEC §7 basics (configuration location, declarative form, keys) —
// SUITE-26: T7-1…T7-3. Discovery (T7-4…T7-6) and the §7.1–7.5 tests belong
// to later tasks (SUITE-27…SUITE-29), not this module.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes reports through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 7: projects are configured by `xspec.config.ts`, located by upward
// search for that name from the working directory or by the global
// `--config <path>` option (a filesystem path resolved against the working
// directory, 12.0); the configuration file's directory is the workspace
// root. The configuration is declarative — exactly an import of
// `defineConfig` from `"xspec"` (optionally aliased) and a default export of
// one call to that binding with a statically literal argument; anything else
// is a configuration error (14.14), reported by every command at
// configuration load as a usage error (exit 2), before all source analysis.
// `specs` is required; `code`, `markdown`, `coverage`, and `policy` are
// optional with defined omission semantics; empty `coverage`/`policy` lists
// equal omission; unknown keys anywhere in the argument are 14.14, as is a
// value of the wrong shape — 14.14's "otherwise invalid group shape" (7.1,
// 7.2, 7.4, 7.5: `specs` and `code` are maps of named groups, each a list
// of glob strings; `coverage` and `policy` are lists).
//
// Conservative operationalizations (noted per H-3/H-4):
// - 14.14 contract: `expectConfigurationError` (shared, ./support.ts) — run
//   with `--json`, exit 2 exactly, stdout exactly the single 12.7 error
//   document carrying the stable code `configuration-error` and a concerned
//   path (12.0/12.7, H-5), and a standard-error message matching /config/i —
//   the actionable configuration-error message must identify the
//   configuration as the failing subject, and any phrasing naming either
//   the file (`xspec.config.ts`) or the condition ("configuration",
//   "config…") qualifies; wording is otherwise free (H-3).
// - T7-1 "no configuration reachable": the workspace is a fresh unique
//   temporary directory (H-1) whose filesystem ancestors (the OS temp
//   directory and its parents) hold no `xspec.config.ts`, so the upward
//   search exhausts without a hit.
// - T7-1 `--config` naming a nonexistent file: run from the location
//   fixture's root, whose own `xspec.config.ts` the upward search would
//   find, naming `alt/missing.config.ts` — absent, beside `alt/`'s valid
//   configuration — so a product falling back to the search, or to a
//   configuration near the named path, builds and exits 0, and a product
//   classing the failed `--config` as a plain usage error reports `code`
//   and `path` null (T12.7-3). The concerned path is asserted exactly as
//   the argument spells it: zero ascent segments, two descending ones, no
//   `.` segment — already 11.6's canonical form (the sibling-directory
//   ascent spelling is T12.7-3's arm); a whole-root snapshot compare around
//   the invocation pins that nothing is written (SPEC 12.1).
// - T7-1 occupancy (SPEC 7: the upward search stops at the nearest directory
//   holding an entry named `xspec.config.ts`, whatever occupies it, and the
//   occupant is read only when it is a plain file; a directory or a symbolic
//   link, whatever it targets, is missing or invalid configuration, 14.14,
//   never read through): one workspace with a valid root configuration and
//   two working directories beneath it, `dirocc/` holding an empty directory
//   named `xspec.config.ts` and `linkocc/` a symbolic link of that name to
//   the valid root configuration itself — so a product skipping the
//   occupant, or following the link, loads a valid configuration and exits
//   0. "Every command but `version`" is operationalized as the complete
//   command set of SPEC 12 with `review` and `query` by every subcommand
//   (26 invocations), each spelled syntactically complete so that no
//   syntax-class usage error, reported without loading configuration (12.0),
//   can precede the configuration load; every invocation is pinned to exit
//   2 with the error document's finding — `configuration-error`, locations
//   [], the concerned path the occupied entry itself in 11.6's anchoring
//   form: `xspec.config.ts` from its own directory, never `../xspec.config.ts`
//   (the valid file above) and never the link's target. The same set names
//   each entry through `--config` from the root (`dirocc/xspec.config.ts`,
//   `linkocc/xspec.config.ts`: the path as given, already canonical, so the
//   two conventions of T12.7-3 coincide). `version` answers exit 0 from both
//   working directories (12.6), a whole-root compare brackets the sweeps
//   (12.1), and the premise — the root configuration valid, discovering
//   `specs/A.mdx` — is driven last (`ids` regenerates graph data, 13.3) so
//   the sweeps observe a tree holding no derived file or graph data.
// - T7-2 single-deviation staging: every invalid fixture is the valid
//   canonical configuration with exactly one deviation, so the refusal is
//   attributable to the arm's malformation and nothing else.
// - T7-2 string-literal keys arm: "both groups discover their globs' files"
//   is observed as the spec group's exact `ids` listing plus whole-graph
//   edge-set equality carrying the code file's marker edge (T7-3's
//   contrapositive: an undiscovered code file sources no edge); "resolve"
//   is observed as the quoted-name coverage profile's covered/uncovered
//   rows (counts and ignored composition stay T8.2-1's subject, the
//   section-8 discipline) and as the policy selector's violation reported
//   per the SPEC 14.12 contract — identities in order the rule name and the
//   offending edge's source, kind token, and target; `locations` [], `path`
//   `null`.
// - T7-3 "the unfiltered `query edges` list carries no edge from it":
//   asserted as exact whole-graph edge-set equality — the minimal fixture's
//   complete edge set is spec-forced (SPEC 5.1–5.2: one contains edge per
//   parent/child pair and nothing else), so an edge sourced at the
//   undiscovered `.ts` file, or any other stray edge, fails the equality.
// - T7-3 "no `.md` is written for any source": after `build`, a full
//   recursive scan of the workspace tree finds no file whose name ends in
//   `.md` (stronger than probing the default next-to-source destinations:
//   emission anywhere would fail it).
// - T7-3 `--from` unknown: exit 2 with the single 12.7 error document as
//   the entire stdout (SPEC 11: `query` is a JSON-only surface, so JSON
//   output is in effect without `--json`, and 12.0 makes an exit-2 error
//   emit the error document) and a non-empty stderr diagnostic (12.0: usage
//   error messages are standard-error content). This usage error is not a
//   14.14, so no /config/i duty applies.
// - T7-3 value shapes: seven fixtures — TEST-SPEC's "one arm each" over a
//   spec group and a code group valued by a single string, a glob list
//   holding `true`, `coverage` and `policy` given as `{}`, and `specs` and
//   `code` given as lists — each SPECS_ONLY_CONFIG with one shape deviation
//   the declarative form of 7 admits, so the refusal is 14.14's
//   non-conformance (an invalid group shape), never a form error (T7-2).
//   The `[true]` fixture matches no staged file: a product tolerating it
//   (dropping or stringifying the element) discovers no source and builds
//   anyway — a group matching no files is valid (7) — so exit 0 still
//   discriminates it.
// - every `expectConfigRefused` arm (T7-2, T7-3): the finding's concerned
//   path is exactly `xspec.config.ts` — the file the upward search found,
//   in 11.6's anchoring form relative to the invocation working directory,
//   the workspace root (SPEC 14, 12.7) — its locations [] (a configuration
//   condition carries the file it concerns, no source range; 14), and a
//   whole-root snapshot compare around the invocation pins that nothing is
//   written (12.1).
// - T7-2 verbatim literals (SPEC 7, 2.4): the escape spellings are built
//   from the backslash's code point (`BACKSLASH`), never written as an
//   escape in harness source, which would interpret it. "Matching no
//   discovered file, discovering zero sources" is observed twice — the
//   inventory's `sources` (discovery reported directly, no source parsed,
//   11.6) and `ids`'s file listing, both exactly empty — beside the
//   inventory's resolved configuration view carrying the glob and, in the
//   group-name arm, the group name as spelled (the six escape characters
//   included), so a product interpreting the escape fails on the
//   reported spelling as well as on the file it then discovers. "Resolves"
//   for the escape-spelled target is the profile's reported rows: with the
//   boundary the same group, the target set is the group's one leaf,
//   uncovered (8.1, 8.2); the `target: "product"` twin differs in that one
//   value alone and is refused as an unknown group (7.4, 14.14).
// - T7-2 encoding: the non-UTF-8 fixture carries its one invalid byte
//   (0xFF) inside a trailing line comment, so the decoded text is a valid
//   configuration and the encoding is the sole defect; the BOM fixture is
//   the canonical text prefixed by EF BB BF. Both are staged as bytes
//   (`FileContents`), never as strings.
// - T7-2 repeated keys: 14.14 whatever TypeScript's own diagnosis of the
//   repetition (SPEC 7) — the arms pin the 14.14 contract alone, so a
//   product reporting it through a compiler diagnostic and one detecting
//   it itself pass alike, while one taking the last member loads and
//   builds (exit 0).
// - T7-2 comments: "inventory's `configuration` byte-identical to its
//   comment-free twin's" is compared as the `configuration` member of each
//   `inventory --json` document (form-decoded first), as values and as
//   serializations — member order included.
// - T7-3 U+FFFD names: the character is staged as the validly encoded code
//   point EF BF BD between two letters — a string-literal group key, a
//   profile name, a rule name — so 14.14's name rule, never the encoding
//   rule, is at stake; each fixture is otherwise valid.
// - Staged-source records (TEST-SPEC S-9's before-any-product clause;
//   helpers/staged-mdx.ts): every `.mdx` file a body stages in a workspace
//   created after its first product invocation — `expectConfigRefused`'s
//   one staging site (serving every arm, the first included), T7-1's
//   no-configuration and occupancy workspaces, T7-2's and T7-3's later
//   arms — is a ledger record, judged by test/self/s9-staged-sources.test.ts
//   before any product exists. The minimal `mdxSection("a")` and
//   `mdxSection("b")` sources are staged byte-identically by this module,
//   section-7-discovery.ts, and section-7.1-7.3.ts, so each is ONE record,
//   exported from here and named with every staging test in ID order and
//   every path. T7-1's first workspace (`LOCATION_FILES`) precedes any
//   invocation and stays plain.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import type { GraphEdge } from "../../helpers/adapters/index.js";
import {
  decodeCoverageReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeInventoryDocument,
  decodeVersionDocument,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type {
  FileContents,
  InitialFileContents,
  WorkspaceDecl,
} from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertSameJson,
  buildOk,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  REPLACEMENT_CHARACTER,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material
// ---------------------------------------------------------------------------

/** A minimal single-section source: one node `<id>` under the file root. */
function mdxSection(id: string): string {
  return `<S id="${id}">\nText for ${id}.\n</S>\n`;
}

// The minimal sources the §7 modules stage in workspaces created after a
// body's first product invocation (module header): byte-identical wherever
// they are staged — `mdxSection("a")` at `specs/A.mdx` here and in
// section-7-discovery.ts and section-7.1-7.3.ts; `mdxSection("b")` at
// `specs/sub/B.mdx` (T7-3, T7-6, T7.3-1) and `specs2/B.mdx` (T7-4) — so each
// is ONE staged-source record, named with every staging test in ID order and
// every path; the other two modules import them.
export const SECTION_A_SOURCE = stagedMdx(
  "T7-1/T7-2/T7-3/T7-4/T7-6/T7.1-1/T7.3-1 specs/A.mdx (the minimal section a)",
  mdxSection("a"),
);
export const SECTION_B_SOURCE = stagedMdx(
  "T7-3/T7-4/T7-6/T7.3-1 the minimal section b (specs/sub/B.mdx; T7-4's specs2/B.mdx)",
  mdxSection("b"),
);

// The canonical valid configuration (SPEC 7): exactly one spec group, no
// optional keys. Every T7-2 violation below is this file with one deviation.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

/** Stage a fresh workspace, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  decl: WorkspaceDecl,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create(decl);
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Stage a workspace whose only defect is the given configuration text and
 * assert `build --json` refuses it per 14.14. The staged source file is
 * valid and matched by every fixture's `specs/**\/*.mdx` glob (or, where
 * the deviation replaces that glob, by nothing — a group matching no files
 * is valid, SPEC 7), so a product that wrongly accepts the configuration
 * proceeds to a successful build (exit 0) and fails the exit-code
 * assertion — never exits 2 for a side reason. Beyond the shared 14.14
 * contract (`expectConfigurationError`), the finding is pinned to the
 * configuration file: its concerned path is exactly `xspec.config.ts` —
 * the file the upward search found, in the anchoring form of 11.6
 * relative to the invocation working directory, here the workspace root,
 * so the bare name (SPEC 14, 12.7) — and its locations are [] (a
 * configuration condition carries the file it concerns, no source range;
 * SPEC 14); a whole-root snapshot compare around the invocation pins that
 * a build failing at configuration load writes nothing (SPEC 12.1).
 */
async function expectConfigRefused(
  product: ProductBinding,
  config: FileContents,
  context: string,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": config,
        "specs/A.mdx": SECTION_A_SOURCE,
      },
    },
    async (workspace) => {
      const before = await snapshotDirectory(workspace.root);
      const result = await expectConfigurationError(
        product,
        workspace,
        ["build"],
        context,
      );
      const finding = expectErrorDocument(result, context);
      assertSameJson(
        {
          code: finding.code,
          path: finding.path,
          locations: finding.locations.map((location) => location.file),
        },
        {
          code: "configuration-error",
          path: "xspec.config.ts",
          locations: [],
        },
        `${context}: the error document's one finding carries the stable ` +
          `code "configuration-error", locations [] (a configuration ` +
          `condition carries the file it concerns, never a source range), ` +
          `and as its concerned path the configuration file the upward ` +
          `search found, in the anchoring form of 11.6 relative to the ` +
          `invocation working directory — the workspace root, so exactly ` +
          `"xspec.config.ts" (SPEC 14, 12.7, 11.6)`,
      );
      assertSnapshotsEqual(
        before,
        await snapshotDirectory(workspace.root),
        `${context}: a build failing at configuration load modifies ` +
          `nothing (SPEC 12.1, 12.0) — no derived file or graph data ` +
          `appears anywhere under the root`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T7-1 — configuration location
// ---------------------------------------------------------------------------

// Two complete projects in one tree: the root configuration (found by upward
// search) discovers specs/A.mdx; the alternative configuration at
// alt/xspec.config.ts — same text, so its identical glob resolves relative
// to *its* directory (SPEC 7: the configuration file's directory is the
// workspace root) — discovers alt/specs/B.mdx as `specs/B.mdx`. The two
// listings differ in both file and ID, so which configuration served a run
// is unambiguous.
const LOCATION_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  "specs/A.mdx": mdxSection("a"),
  "alt/xspec.config.ts": SPECS_ONLY_CONFIG,
  "alt/specs/B.mdx": mdxSection("b"),
};

// The nested working directories: `nested/inner` for the upward-search run
// (two levels below the root configuration), `nested` for the --config run
// (so the relative --config path resolves correctly only against the
// working directory: against the workspace root or the search result it
// names a nonexistent file).
const SEARCH_CWD = "nested/inner";
const OVERRIDE_CWD = "nested";
const OVERRIDE_CONFIG_ARG = "../alt/xspec.config.ts";
// The nonexistent --config path, run from the workspace root: two
// descending segments, no `.` segment — the argument's own spelling is
// already the canonical anchoring form (SPEC 11.6), so the concerned path is
// asserted exactly as given (SPEC 14; T12.7-3).
const MISSING_CONFIG_ARG = "alt/missing.config.ts";

// --- T7-1 occupancy (SPEC 7, 14.14) ---------------------------------------

// A valid configuration at the root discovers specs/A.mdx; beneath it, two
// working directories each hold an entry named `xspec.config.ts` that is not
// a plain file: OCCUPANCY_DIR_CWD's is an empty directory, OCCUPANCY_LINK_CWD's
// a symbolic link to the valid root configuration itself. SPEC 7: the upward
// search stops at the nearest directory holding an entry of that name —
// whatever occupies it — and the occupant is read only when it is a plain
// file; any other occupant is missing or invalid configuration (14.14), never
// read through. The discriminating structure: a product skipping a non-file
// entry and continuing upward finds the valid root configuration and exits 0;
// a product following the link loads that same valid configuration and exits
// 0 (rooted at the link's directory or at the root, either way exit 0) —
// both fail the exit-2 assertion, and a product reporting the file above
// (`../xspec.config.ts`) or the link's target fails the concerned-path pin.
const OCCUPANCY_DIR_CWD = "dirocc";
const OCCUPANCY_LINK_CWD = "linkocc";
const OCCUPANT_NAME = "xspec.config.ts";
const OCCUPANCY_DIR_ENTRY = `${OCCUPANCY_DIR_CWD}/${OCCUPANT_NAME}`;
const OCCUPANCY_LINK_ENTRY = `${OCCUPANCY_LINK_CWD}/${OCCUPANT_NAME}`;
const OCCUPANCY_WORKSPACE: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/A.mdx": SECTION_A_SOURCE,
  },
  dirs: [OCCUPANCY_DIR_ENTRY],
  // The link's target is spelled relative to the link's own directory: the
  // valid configuration one level up.
  symlinks: { [OCCUPANCY_LINK_ENTRY]: `../${OCCUPANT_NAME}` },
};

// Every command but `version` (SPEC 14 condition 14 is reported by every
// command that loads the configuration; 12.6: `version` loads none), `review`
// and `query` by every subcommand, each spelled syntactically complete — its
// required operands and flags present, every value well-formed and inside its
// fixed vocabulary — so that no syntax-class usage error, which 12.0 reports
// without loading configuration, can precede the configuration load. The
// operands name nothing that must exist: a configuration error precedes every
// other exit-2 error consulting the configuration or the workspace (12.0), so
// an unknown node, session, item, profile, or baseline is never reached; the
// mutating commands (`review create`, `review split`, `review resolve`,
// `rename`, `move`) fail before acquisition and modify nothing (12.0, 13.5).
// The driver appends `--json`.
const EVERY_LOADING_COMMAND: readonly (readonly string[])[] = [
  ["build"],
  ["check"],
  ["ids"],
  ["show", "specs/A.mdx#a"],
  ["coverage"],
  ["impact", "--base", "HEAD"],
  ["review", "create", "--strategy", "audit", "--name", "s"],
  ["review", "list"],
  ["review", "status", "s"],
  ["review", "next", "s"],
  ["review", "show", "s", "i1"],
  ["review", "split", "s", "i1"],
  ["review", "resolve", "s", "i1", "--status", "updated"],
  ["review", "export", "s"],
  ["query", "node", "specs/A.mdx#a"],
  ["query", "nodes"],
  ["query", "edges"],
  ["query", "subtree", "specs/A.mdx#a"],
  ["query", "ancestors", "specs/A.mdx#a"],
  ["query", "reachable", "--from", "specs/A.mdx#a", "--to", "specs/A.mdx#a"],
  ["occurrences"],
  ["view"],
  ["at", "specs/A.mdx", "0"],
  ["inventory"],
  ["rename", "specs/A.mdx", "a", "b"],
  ["move", "specs/A.mdx", "specs/B.mdx"],
];

interface OccupancySweep {
  /** Workspace-relative working directory, or "." for the root. */
  readonly cwd: string;
  /** The `--config` value, spelled as given; absent for the upward search. */
  readonly configArg?: string;
  /** The concerned path 14 pins: the occupied entry, in 11.6's form. */
  readonly expectedPath: string;
  /** What occupies the entry, for the diagnosis. */
  readonly occupant: string;
}

/**
 * Drive every configuration-loading command from `sweep.cwd` (naming the
 * entry through `--config` when `sweep.configArg` is given) and assert each
 * reports 14.14 concerning exactly `sweep.expectedPath`: exit 2, the error
 * document's one finding carrying the stable code `configuration-error`,
 * locations [] (an unlocated condition), and as its concerned path the
 * occupied entry itself in the anchoring form of 11.6 — for the search, the
 * working directory's own `xspec.config.ts`; for `--config`, the path as
 * given, which from the root is already canonical (SPEC 14, 12.7; T12.7-3) —
 * never the valid file above it and never what the link targets.
 */
async function sweepOccupiedConfiguration(
  product: ProductBinding,
  workspace: TestWorkspace,
  sweep: OccupancySweep,
): Promise<void> {
  const cwd = sweep.cwd === "." ? workspace.root : workspace.path(sweep.cwd);
  const where =
    sweep.cwd === "."
      ? "the workspace root"
      : `the working directory ${sweep.cwd}`;
  for (const command of EVERY_LOADING_COMMAND) {
    const argv =
      sweep.configArg === undefined
        ? command
        : [...command, "--config", sweep.configArg];
    const label =
      `T7-1 \`${argv.join(" ")} --json\` run from ${where} ` +
      `(${sweep.occupant})`;
    const result = await expectConfigurationError(
      product,
      workspace,
      argv,
      `${label} — the ${sweep.configArg === undefined ? "upward search stops at the nearest directory holding an entry named xspec.config.ts, whatever occupies it, and the" : "named path's"} ` +
        `occupant is read only when it is a plain file: a directory or a ` +
        `symbolic link, whatever it targets, is missing or invalid ` +
        `configuration, never read through — reported by every command but ` +
        `version at configuration load (SPEC 7, 14.14, 12.0)`,
      cwd,
    );
    const finding = expectErrorDocument(result, label);
    assertSameJson(
      {
        code: finding.code,
        path: finding.path,
        locations: finding.locations.map((location) => location.file),
      },
      {
        code: "configuration-error",
        path: sweep.expectedPath,
        locations: [],
      },
      `${label}: the error document's one finding carries the stable code ` +
        `"configuration-error", locations [] (an unlocated condition), and ` +
        `as its concerned path the occupied entry itself in the anchoring ` +
        `form of 11.6 — ${JSON.stringify(sweep.expectedPath)} — never the ` +
        `valid configuration above it (../xspec.config.ts) and never the ` +
        `link's target (SPEC 14, 12.7, 7; T12.7-3)`,
    );
  }
}

/**
 * T7-1's occupancy arms (SPEC 7, 14.14): the directory and the symbolic-link
 * occupants found by the upward search from their own directories, then each
 * named through `--config` from the root; `version` answering beside them
 * (12.6); a whole-root compare around all of it (12.1); and, last — so the
 * arms observe a tree holding no graph data or derived file — the premise
 * that the root configuration is valid and discovers specs/A.mdx, without
 * which every exit 2 above would be vacuous.
 */
async function runOccupancyArms(product: ProductBinding): Promise<void> {
  await withWorkspace(OCCUPANCY_WORKSPACE, async (workspace) => {
    // Staging self-check (H-9): an ineffective staging is a harness error,
    // never a pass and never a diagnosed product failure.
    const stagedKinds: readonly (readonly [string, "dir" | "symlink"])[] = [
      [OCCUPANCY_DIR_ENTRY, "dir"],
      [OCCUPANCY_LINK_ENTRY, "symlink"],
    ];
    for (const [rel, expected] of stagedKinds) {
      const kind = await workspace.kind(rel);
      if (kind !== expected) {
        throw new Error(
          `T7-1 harness staging: expected a ${expected} at ${rel}, found ` +
            `${kind} — the occupancy arms cannot run (H-9)`,
        );
      }
    }

    const before = await snapshotDirectory(workspace.root);
    const sweeps: readonly OccupancySweep[] = [
      {
        cwd: OCCUPANCY_DIR_CWD,
        expectedPath: OCCUPANT_NAME,
        occupant: "the working directory's xspec.config.ts is a directory",
      },
      {
        cwd: OCCUPANCY_LINK_CWD,
        expectedPath: OCCUPANT_NAME,
        occupant:
          "the working directory's xspec.config.ts is a symbolic link to " +
          "the valid root configuration",
      },
      {
        cwd: ".",
        configArg: OCCUPANCY_DIR_ENTRY,
        expectedPath: OCCUPANCY_DIR_ENTRY,
        occupant: "--config names a directory",
      },
      {
        cwd: ".",
        configArg: OCCUPANCY_LINK_ENTRY,
        expectedPath: OCCUPANCY_LINK_ENTRY,
        occupant:
          "--config names a symbolic link to the valid root configuration",
      },
    ];
    for (const sweep of sweeps) {
      await sweepOccupiedConfiguration(product, workspace, sweep);
    }

    // `version` loads no configuration (SPEC 12.6): from either occupied
    // working directory it answers, exit 0, the version document decoded
    // form-exact — the occupant is met only by a configuration load.
    for (const cwd of [OCCUPANCY_DIR_CWD, OCCUPANCY_LINK_CWD]) {
      const versionLabel = `T7-1 \`version --json\` run from the working directory ${cwd} (its xspec.config.ts occupied)`;
      const versionRun = await runProduct(product, {
        cwd: workspace.path(cwd),
        argv: ["version", "--json"],
      });
      assertExitCode(
        versionRun,
        0,
        `${versionLabel} — version consults no configuration, so the ` +
          `occupied entry is never met: exit 0 with its answer (SPEC 12.6, ` +
          `14.14)`,
      );
      decodeVersionDocument(
        parseJsonStdout(versionRun, versionLabel),
        versionLabel,
      );
    }

    assertSnapshotsEqual(
      before,
      await snapshotDirectory(workspace.root),
      `T7-1 occupancy sweeps: a command failing at configuration load ` +
        `modifies nothing (SPEC 12.1, 12.0) — no derived file, graph data, ` +
        `session, or hold file appears anywhere under the root, the ` +
        `occupants and the valid configuration are byte-untouched`,
    );

    // The premise, last: the root configuration is valid and discovers
    // specs/A.mdx — the configuration a product skipping the occupant, or
    // reading through the link, would have loaded (module header).
    const premiseLabel =
      "T7-1 occupancy premise: `ids --json` run from the workspace root";
    const premise = decodeIdsReport(
      await runJson(product, workspace, ["ids", "--json"], premiseLabel),
      premiseLabel,
    );
    assertSameJson(
      premise.files,
      [{ file: "specs/A.mdx", ids: ["a"] }],
      `${premiseLabel}: the root configuration is valid and discovers ` +
        `specs/A.mdx (SPEC 7) — the occupancy arms' exit-2 answers are ` +
        `meaningful only because a product reading past the occupant would ` +
        `have found this configuration and exited 0`,
    );
  });
}

const T7_1 = defineProductTest({
  id: "T7-1",
  title:
    "configuration location: upward search from a nested working " +
    "directory; --config, resolved against the working directory, " +
    "overrides the search; no configuration reachable is a configuration " +
    "error — by a failed upward search, and by --config naming a " +
    "nonexistent file, never a plain usage error; occupancy — the search " +
    "stops at the nearest entry named xspec.config.ts whatever occupies " +
    "it, and a found or named entry that is a directory or a symbolic " +
    "link is 14.14 for every command but version, the concerned path that " +
    "entry, never read through (SPEC 7, 12.0, 12.6, 12.7, 14.14)",
  // Four sweeps of every configuration-loading command (~26 invocations
  // each) join the location arms; the default budget is kept only for
  // margin under suite contention.
  timeoutMs: 240_000,
  run: async (product) => {
    await withWorkspace(
      { files: LOCATION_FILES, dirs: [SEARCH_CWD] },
      async (workspace) => {
        // Upward search: from nested/inner the nearest (and only)
        // xspec.config.ts on the upward path is the workspace root's.
        const searchLabel = `T7-1 \`ids --json\` run from ${SEARCH_CWD}`;
        const searchRun = await runProduct(product, {
          cwd: workspace.path(SEARCH_CWD),
          argv: ["ids", "--json"],
        });
        assertExitCode(
          searchRun,
          0,
          `${searchLabel} — the configuration is located by upward search ` +
            `for xspec.config.ts from the working directory (SPEC 7)`,
        );
        const searchReport = decodeIdsReport(
          parseJsonStdout(searchRun, searchLabel),
          searchLabel,
        );
        assertSameJson(
          searchReport.files,
          [{ file: "specs/A.mdx", ids: ["a"] }],
          `${searchLabel}: the upward search finds the root configuration, ` +
            `whose directory is the workspace root — the listing carries ` +
            `exactly its sources, by workspace-relative path (SPEC 7, ` +
            `12.3, 1.5)`,
        );

        // --config override: the upward search from `nested` would find the
        // root configuration (source A); the named configuration must win
        // (source B), and its relative path must resolve against the
        // working directory (SPEC 12.0) — resolved anywhere else it names
        // no file.
        const overrideLabel =
          `T7-1 \`ids --json --config ${OVERRIDE_CONFIG_ARG}\` run from ` +
          OVERRIDE_CWD;
        const overrideRun = await runProduct(product, {
          cwd: workspace.path(OVERRIDE_CWD),
          argv: ["ids", "--json", "--config", OVERRIDE_CONFIG_ARG],
        });
        assertExitCode(
          overrideRun,
          0,
          `${overrideLabel} — --config <path> is a filesystem path ` +
            `resolved against the working directory (SPEC 12.0) and ` +
            `overrides the upward search (SPEC 7)`,
        );
        const overrideReport = decodeIdsReport(
          parseJsonStdout(overrideRun, overrideLabel),
          overrideLabel,
        );
        assertSameJson(
          overrideReport.files,
          [{ file: "specs/B.mdx", ids: ["b"] }],
          `${overrideLabel}: the named configuration wins over the one the ` +
            `upward search would find, and its own directory (alt/) is the ` +
            `workspace root — the listing carries alt/specs/B.mdx as ` +
            `specs/B.mdx and nothing of the root project (SPEC 7, 12.0)`,
        );

        // --config naming a nonexistent file: missing configuration, a
        // configuration error (SPEC 14.14) — never a plain usage error and
        // never a fallback. Run from the root, whose own xspec.config.ts the
        // upward search would find, naming alt/missing.config.ts — absent,
        // beside alt/'s valid configuration — so a product falling back to
        // the search, or to a configuration near the named path, builds and
        // exits 0 (module header). The error document's finding carries the
        // stable code, locations [] (an unlocated condition, SPEC 14), and
        // the concerned path: the path --config names, in the anchoring
        // form of 11.6 — spelled here exactly as given (SPEC 14, 12.7; the
        // sibling-directory ascent spelling is T12.7-3's arm). A build
        // failing at configuration load modifies nothing (SPEC 12.1):
        // whole-root compare around the run.
        const missingLabel =
          `T7-1 \`build --config ${MISSING_CONFIG_ARG} --json\` run from ` +
          `the workspace root (--config naming a nonexistent file)`;
        const beforeMissing = await snapshotDirectory(workspace.root);
        const missingRun = await expectConfigurationError(
          product,
          workspace,
          ["build", "--config", MISSING_CONFIG_ARG],
          missingLabel,
        );
        const missingFinding = expectErrorDocument(missingRun, missingLabel);
        assertSameJson(
          {
            code: missingFinding.code,
            path: missingFinding.path,
            locations: missingFinding.locations.map(
              (location) => location.file,
            ),
          },
          {
            code: "configuration-error",
            path: MISSING_CONFIG_ARG,
            locations: [],
          },
          `${missingLabel}: --config naming a nonexistent file is missing ` +
            `configuration (SPEC 14.14) — the error document's one finding ` +
            `carries the stable code "configuration-error", locations [] ` +
            `(an unlocated condition), and as its concerned path the path ` +
            `--config names, in the anchoring form of 11.6 relative to the ` +
            `invocation working directory (SPEC 14, 12.7; T12.7-3) — never ` +
            `a plain usage error's null code and path, and never "." (the ` +
            `failed-upward-search spelling, reserved for no --config given)`,
        );
        assertSnapshotsEqual(
          beforeMissing,
          await snapshotDirectory(workspace.root),
          `${missingLabel}: a build failing at configuration load modifies ` +
            `nothing (SPEC 12.1, 12.0) — the configurations at the root and ` +
            `beside the named path are never consulted, so no derived file ` +
            `or graph data appears anywhere under the root`,
        );
      },
    );

    // No configuration reachable: a fresh temporary workspace with no
    // xspec.config.ts anywhere on the upward path (module header) — a
    // configuration error, not a crash and not an empty success.
    await withWorkspace(
      { files: { "specs/A.mdx": SECTION_A_SOURCE } },
      async (workspace) => {
        await expectConfigurationError(
          product,
          workspace,
          ["build"],
          "T7-1 `build --json` with no xspec.config.ts reachable by upward " +
            "search and no --config",
        );
      },
    );

    // Occupancy: a found or named xspec.config.ts that is a directory or a
    // symbolic link (SPEC 7, 14.14; helpers above).
    await runOccupancyArms(product);
  },
});

// ---------------------------------------------------------------------------
// T7-2 — declarative form
// ---------------------------------------------------------------------------

// Each fixture is SPECS_ONLY_CONFIG with exactly one deviation (module
// header). SPEC 7: the file MUST consist of exactly an import of
// `defineConfig` from `"xspec"` (optionally aliased) and a default export of
// one call to that binding whose sole argument is statically literal —
// object literals with non-computed identifier or string-literal keys, array
// literals, static string literals, and the boolean literals; no other
// statement or expression form, no spread, no computed value.
const FORM_VIOLATIONS: readonly { label: string; config: string }[] = [
  {
    label: "not well-formed TypeScript — a syntax error (unclosed braces)",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
`,
  },
  {
    label: "missing defineConfig import",
    config: `export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: 'import from a specifier other than "xspec"',
    config: `import { defineConfig } from "not-xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: "extra statements beside the import and the default export",
    config: `import { defineConfig } from "xspec"

const extra = true

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: "non-literal argument: a spread in the object literal",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  ...{},
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: "non-literal argument: a computed key",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    ["main"]: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      "non-literal argument: a template literal where a static string " +
      "belongs",
    config: [
      'import { defineConfig } from "xspec"',
      "",
      "export default defineConfig({",
      "  specs: {",
      "    main: [`specs/**/*.mdx`]",
      "  }",
      "})",
      "",
    ].join("\n"),
  },
  {
    label:
      "non-literal argument: an identifier reference (undefined) where a " +
      "literal belongs",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: [undefined]
  }
})
`,
  },
  {
    label: "non-literal argument: a function call producing the value",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/".concat("**/*.mdx")]
  }
})
`,
  },
  {
    label:
      "non-literal argument: a number literal where a boolean is expected " +
      "(markdown.emit)",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: 1 }
})
`,
  },
  {
    label:
      "a default export that is not one call to the binding: the bare " +
      "argument object",
    config: `import { defineConfig } from "xspec"

export default {
  specs: {
    main: ["specs/**/*.mdx"]
  }
}
`,
  },
  {
    label:
      "a default export that is not one call to the binding: the uncalled " +
      "defineConfig reference",
    config: `import { defineConfig } from "xspec"

export default defineConfig
`,
  },
];

// The valid arm: an aliased defineConfig import (SPEC 7: optionally aliased).
const ALIASED_CONFIG = `import { defineConfig as makeConfig } from "xspec"

export default makeConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// The string-literal keys arm (SPEC 7: the statically literal argument's
// object literals carry "non-computed identifier or string-literal keys"):
// a spec group and a code group whose names are not TypeScript identifiers
// ("my-group", "test-code") have only the string-literal spelling — a
// product accepting identifier keys alone refuses a valid configuration no
// other spelling can declare. The quoted names are referenced from every
// place group names resolve that this arm asserts: the coverage profile's
// `target` and `boundary` (both unambiguous, so their kinds are inferred,
// SPEC 7.4) and both policy selectors (SPEC 7.5).
const QUOTED_KEYS_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    "my-group": ["specs/**/*.mdx"]
  },
  code: {
    "test-code": ["src/**/*.ts"]
  },
  coverage: [
    {
      name: "quoted",
      target: "my-group",
      boundary: "test-code",
      mode: "direct"
    }
  ],
  policy: [
    {
      name: "no-internal-deps",
      type: "forbidden",
      from: { group: "my-group" },
      to: { group: "my-group" }
    }
  ]
})
`;

// The quoted-keys workspace: the spec group's file holds two leaves — `a`,
// covered through the code marker's references edge, and `p`, depending
// locally on `a` (SPEC 2.2's string form) — and the code group's file holds
// one top-level marker, so its code location is the file itself (SPEC 4.5,
// 4.6; the T8-3 shape).
const QUOTED_KEYS_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": QUOTED_KEYS_CONFIG,
  "specs/A.mdx": stagedMdx(
    "T7-2 string-literal keys specs/A.mdx",
    `<S id="a">
Covered leaf.
</S>

<S id="p" d={"a"}>
Dependent leaf.
</S>
`,
  ),
  "src/impl.ts": `import SPEC from "../specs/A.xspec";

SPEC.a;
`,
};

// The quoted-keys fixture's complete edge set (SPEC 5.1–5.2, 2.2, 4.5).
// Whole-graph equality makes both discovery observations exact: the spec
// group's nodes carry their contains/depends edges, the code group's marker
// its references edge — an undiscovered src/impl.ts would drop it (T7-3's
// contrapositive) — and nothing stray exists. The depends edge doubles as
// the policy premise: both its endpoints are "my-group" nodes, so the
// forbidden rule below has exactly one violation to report.
const QUOTED_KEYS_EDGES: readonly GraphEdge[] = [
  { from: "specs/A.mdx", to: "specs/A.mdx#a", kind: "contains" },
  { from: "specs/A.mdx", to: "specs/A.mdx#p", kind: "contains" },
  { from: "specs/A.mdx#p", to: "specs/A.mdx#a", kind: "depends" },
  { from: "src/impl.ts", to: "specs/A.mdx#a", kind: "references" },
];

// Verbatim literals (SPEC 7, 2.4: configuration literals are static string
// literals read exactly as spelled). The escape spellings below are built
// from the backslash's code point so the six characters reach the staged
// file exactly — a template literal would itself interpret a backslash-u
// escape (the header's verbatim-literal note).
const BACKSLASH = String.fromCodePoint(0x5c);

// A glob spelled with the six-character escape of `*` (backslash, `u002A`)
// is read as those characters: it names only a file literally so called,
// so with `specs/A.mdx` the sole source the group discovers nothing — valid,
// a group matching no files being valid (7). A product interpreting the
// escape reads `specs/*.mdx`, discovers `specs/A.mdx`, and fails the empty
// listings and the inventory's verbatim glob.
const VERBATIM_GLOB = `specs/${BACKSLASH}u002A.mdx`;
const VERBATIM_GLOB_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["${VERBATIM_GLOB}"]
  }
})
`;

// A group name spelled with the escape of `u` (`prod`, backslash, `u0075`,
// `ct`) names a group whose spelling contains a backslash: a profile's
// `target: "product"` is then an unknown group (14.14, SPEC 7.4) while the
// same escape spelling resolves. `boundary` carries the verbatim spelling
// in both fixtures, so the profile's target is their only difference.
const VERBATIM_GROUP_NAME = `prod${BACKSLASH}u0075ct`;
function verbatimNameConfig(target: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    "${VERBATIM_GROUP_NAME}": ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "verbatim",
      target: "${target}",
      boundary: "${VERBATIM_GROUP_NAME}",
      mode: "direct"
    }
  ]
})
`;
}

// Encoding (SPEC 7: the file's bytes MUST be valid UTF-8 and MUST NOT begin
// with a byte-order mark; either violation is 14.14). The non-UTF-8 fixture
// is the canonical configuration plus one trailing line comment holding the
// byte 0xFF, valid in no UTF-8 sequence: a product decoding leniently (0xFF
// → U+FFFD) sees the valid configuration and a comment contributing nothing,
// loads, and builds (exit 0). The BOM fixture is the canonical text prefixed
// by EF BB BF, which TypeScript tooling strips silently, so a product
// reading through the compiler alone loads it too.
const NON_UTF8_CONFIG: Uint8Array = Buffer.concat([
  Buffer.from(SPECS_ONLY_CONFIG, "utf8"),
  Buffer.from("// ", "utf8"),
  Buffer.from([0xff]),
  Buffer.from("\n", "utf8"),
]);
const BOM_CONFIG: Uint8Array = Buffer.concat([
  Buffer.from([0xef, 0xbb, 0xbf]),
  Buffer.from(SPECS_ONLY_CONFIG, "utf8"),
]);

// Object-literal keys and names (SPEC 7, 14.14): a key repeated within one
// object literal — an identifier key and a string-literal key spelling the
// same name included, whatever TypeScript's own diagnosis of the
// repetition — and an empty group, profile, or rule name (`""`). Every
// fixture is otherwise valid: each repeated member is a valid group, and
// the empty-named profile and rule reference the existing unambiguous
// group `main`, so the repetition or the empty name is the only defect.
const KEY_AND_NAME_VIOLATIONS: readonly { label: string; config: string }[] = [
  {
    label: "repeated key: `specs` twice within the top-level object literal",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      "repeated key: an identifier key and a string-literal key spelling " +
      "the same group name within `specs`",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    product: ["specs/**/*.mdx"],
    "product": ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: 'empty name: a spec group ""',
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    "": ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: 'empty name: a coverage profile whose name is ""',
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
  },
  {
    label: 'empty name: a policy rule whose name is ""',
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: [
    {
      name: "",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "main" }
    }
  ]
})
`,
  },
];

// Comments (SPEC 7: permitted anywhere, contributing nothing). The commented
// fixture places line and block comments before the import, after it,
// before the first key, between keys, inside the glob list (after a glob
// and between two globs), after the list, after the export, and after
// everything; its twin is the same configuration with every comment
// removed. Two globs and a `markdown` key give the "between" positions
// something to stand between (`docs/` matches nothing: valid, 7).
const COMMENT_FREE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: [
      "specs/**/*.mdx",
      "docs/**/*.mdx"
    ]
  },
  markdown: { emit: false }
})
`;
const COMMENTED_CONFIG = `// a line comment before the import
/* a block comment
   before the import */
import { defineConfig } from "xspec" // after the import

export default defineConfig({
  // before the first key
  specs: {
    main: [
      "specs/**/*.mdx", // after a glob
      /* between two globs */ "docs/**/*.mdx"
    ] /* after the glob list */
  }, // after a key
  /* between keys */
  markdown: { emit: false }
}) // after the export
/* after everything */
`;

const T7_2 = defineProductTest({
  id: "T7-2",
  title:
    "declarative form: a syntax error, a missing or misdirected " +
    "defineConfig import, extra statements, each non-literal argument " +
    "form, and a non-call default export are configuration errors (14.14, " +
    "exit 2); an aliased defineConfig import is valid; string-literal " +
    "group-name keys are part of the accepted form — they load, discover, " +
    "and resolve in a coverage profile and a policy selector (SPEC 7, 7.4, " +
    "7.5, 8); literals are read verbatim — an escape-spelled glob matches " +
    "nothing and an escape-spelled group name is named only by the same " +
    "spelling (2.4); a non-UTF-8 file, a byte-order mark, a repeated key, " +
    "and an empty group, profile, or rule name are configuration errors; " +
    "comments anywhere contribute nothing (inventory's configuration " +
    "byte-identical to the comment-free twin's)",
  timeoutMs: 240_000,
  run: async (product) => {
    for (const arm of FORM_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-2 (${arm.label})`);
    }

    await withWorkspace(
      {
        files: {
          "xspec.config.ts": ALIASED_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-2 (aliased defineConfig import): `build` accepts the " +
            "configuration — the import binding is optionally aliased " +
            "(SPEC 7)",
        );
        const label = "T7-2 (aliased defineConfig import) `ids --json`";
        const report = decodeIdsReport(
          await runJson(product, workspace, ["ids", "--json"], label),
          label,
        );
        assertSameJson(
          report.files,
          [{ file: "specs/A.mdx", ids: ["a"] }],
          `${label}: the aliased configuration took effect — its spec ` +
            `group drives discovery (SPEC 7)`,
        );
      },
    );

    // String-literal group-name keys are part of the accepted form (SPEC 7):
    // the quoted-key groups load, discover, and resolve in a coverage
    // profile and in a policy selector.
    await withWorkspace({ files: QUOTED_KEYS_FILES }, async (workspace) => {
      // Loads without error: a product accepting identifier keys alone
      // refuses this configuration (14.14, exit 2) and fails here. The
      // staged policy violation cannot fail the build — build never
      // evaluates policy (SPEC 7.5, 12.1).
      await buildOk(
        product,
        workspace,
        "T7-2 (string-literal keys): `build` — a spec group and a code " +
          'group under string-literal keys ("my-group", "test-code") whose ' +
          "names are not TypeScript identifiers load without error (SPEC 7)",
      );

      // Both groups discover their globs' files.
      const idsLabel = "T7-2 (string-literal keys) `ids --json`";
      const ids = decodeIdsReport(
        await runJson(product, workspace, ["ids", "--json"], idsLabel),
        idsLabel,
      );
      assertSameJson(
        ids.files,
        [{ file: "specs/A.mdx", ids: ["a", "p"] }],
        `${idsLabel}: the "my-group" spec group discovered its glob's file ` +
          `(SPEC 7, 7.1)`,
      );
      const edgesLabel =
        "T7-2 (string-literal keys) `query edges` (unfiltered)";
      const edges = decodeEdgesReport(
        await runJson(product, workspace, ["query", "edges"], edgesLabel),
        edgesLabel,
      );
      assertEdgeSetEqual(
        edges,
        QUOTED_KEYS_EDGES,
        `${edgesLabel}: the complete edge set carries the references edge ` +
          `sourced at src/impl.ts — the "test-code" code group discovered ` +
          `its glob's file (SPEC 7, 7.2, 4.5; an undiscovered code file ` +
          `sources no edge, as T7-3 asserts) — and nothing stray`,
      );

      // The names resolve in a coverage profile: target "my-group" with
      // boundary "test-code" reports its coverage (SPEC 7.4, 8).
      const coverageLabel = "T7-2 (string-literal keys) `coverage --json`";
      const coverage = decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "--json"],
          coverageLabel,
        ),
        coverageLabel,
      );
      const profile = coverage.profiles.find((row) => row.name === "quoted");
      if (profile === undefined) {
        fail(
          `${coverageLabel}: the report must carry profile "quoted" — its ` +
            `target "my-group" and boundary "test-code" resolve to the ` +
            `string-literal-keyed groups (SPEC 7, 7.4, 8.2); got profiles ` +
            `${JSON.stringify(coverage.profiles.map((row) => row.name))}`,
        );
      }
      assertSameJson(
        profile.covered.map((row) => ({
          identity: row.identity,
          path: row.path,
        })),
        [{ identity: "specs/A.mdx#a", path: ["src/impl.ts", "specs/A.mdx#a"] }],
        `${coverageLabel} profile quoted: the "test-code" boundary's ` +
          `references edge covers \`a\` over the path [code location, ` +
          `target] — both quoted names resolved (SPEC 7.4, 8, 8.2)`,
      );
      assertSameJson(
        [...profile.uncovered].sort(),
        ["specs/A.mdx#p"],
        `${coverageLabel} profile quoted: \`p\`, with no boundary edge into ` +
          `it, is uncovered — the target set is the quoted spec group's ` +
          `leaves (SPEC 7.4, 8.1, 8.2)`,
      );

      // The name resolves in a policy selector: { group: "my-group" }
      // matches the group's nodes (SPEC 7.5) — the staged depends edge,
      // both endpoints "my-group" nodes (premise pinned by the edge-set
      // equality above), is the forbidden rule's one violation.
      const checkLabel = "T7-2 (string-literal keys) `check --json`";
      const checkResult = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkLabel} — the forbidden rule's selectors match through the ` +
          `string-literal group name, so the depends edge violates it and ` +
          `check exits 1 (SPEC 7.5, 14.12, 12.0)`,
      );
      const checkFindings = decodeFindingsReport(
        parseJsonStdout(checkResult, checkLabel),
        checkLabel,
      ).findings;
      assertConditionCounts(checkFindings, { "14.12": 1 }, checkLabel);
      assertSameJson(
        checkFindings.map((finding) => ({
          locations: finding.locations,
          path: finding.path,
          identities: finding.identities,
        })),
        [
          {
            locations: [],
            path: null,
            identities: [
              "no-internal-deps",
              "specs/A.mdx#p",
              "depends",
              "specs/A.mdx#a",
            ],
          },
        ],
        `${checkLabel}: the one policy finding names the rule and the ` +
          `offending edge — identities in order rule name, source, kind ` +
          `token, target; no in-source locations, no concerned path ` +
          `(SPEC 7.5, 14.12, 12.7): { group: "my-group" } matched the ` +
          `quoted group's nodes`,
      );
    });

    // Verbatim literals (SPEC 7, 2.4): the glob spelled with the escape of
    // `*` is read as its characters — the inventory reports it as spelled
    // and its group discovers nothing.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": VERBATIM_GLOB_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-2 (verbatim glob): `build` — the escape-spelled glob names " +
            "no file, and a group matching no files is valid, discovery " +
            "yielding zero sources (SPEC 7, 2.4)",
        );
        const inventoryLabel = "T7-2 (verbatim glob) `inventory --json`";
        const inventory = decodeInventoryDocument(
          await runJson(
            product,
            workspace,
            ["inventory", "--json"],
            inventoryLabel,
          ),
          inventoryLabel,
        );
        assertSameJson(
          inventory.configuration.specs,
          [{ name: "main", globs: [VERBATIM_GLOB] }],
          `${inventoryLabel}: the configured glob is reported as spelled — ` +
            `thirteen characters, the six of the escape included — never ` +
            `the interpreted "specs/*.mdx" (SPEC 7, 2.4, 11.6)`,
        );
        assertSameJson(
          inventory.sources,
          [],
          `${inventoryLabel}: the verbatim glob matches no discovered ` +
            `file — specs/A.mdx is not "specs/${BACKSLASH}u002A.mdx" — so ` +
            `the group discovers zero sources (SPEC 7, 2.4)`,
        );
        const idsLabel = "T7-2 (verbatim glob) `ids --json`";
        const ids = decodeIdsReport(
          await runJson(product, workspace, ["ids", "--json"], idsLabel),
          idsLabel,
        );
        assertSameJson(
          ids.files,
          [],
          `${idsLabel}: zero discovered spec sources list zero files ` +
            `(SPEC 7, 2.4, 12.3)`,
        );
      },
    );

    // A group name spelled with the escape of `u` names a group whose
    // spelling contains a backslash: a profile's target spelled `product`
    // is an unknown group (14.14), the escape spelling resolves.
    await expectConfigRefused(
      product,
      verbatimNameConfig("product"),
      'T7-2 (verbatim group name: a profile\'s target "product" names no ' +
        "configured group — the group's spelling contains a backslash)",
    );
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": verbatimNameConfig(VERBATIM_GROUP_NAME),
          "specs/A.mdx": SECTION_A_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-2 (verbatim group name): `build` — the profile's target and " +
            "boundary, spelled as the group's key is, resolve (SPEC 7, " +
            "2.4, 7.4)",
        );
        const inventoryLabel = "T7-2 (verbatim group name) `inventory --json`";
        const inventory = decodeInventoryDocument(
          await runJson(
            product,
            workspace,
            ["inventory", "--json"],
            inventoryLabel,
          ),
          inventoryLabel,
        );
        assertSameJson(
          inventory.configuration.specs.map((group) => group.name),
          [VERBATIM_GROUP_NAME],
          `${inventoryLabel}: the group is named as spelled — eleven ` +
            `characters, the six of the escape included — never the ` +
            `interpreted "product" (SPEC 7, 2.4, 11.6)`,
        );
        const coverageLabel = "T7-2 (verbatim group name) `coverage --json`";
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
          coverage.profiles.map((row) => ({
            name: row.name,
            covered: row.covered.map((entry) => entry.identity),
            uncovered: [...row.uncovered].sort(),
          })),
          [{ name: "verbatim", covered: [], uncovered: ["specs/A.mdx#a"] }],
          `${coverageLabel}: the profile resolved its target — the ` +
            `group's one leaf is its target set, uncovered under a ` +
            `boundary sourcing no edge into it (SPEC 7, 2.4, 7.4, 8.1, 8.2)`,
        );
      },
    );

    // Encoding (SPEC 7, 14.14): bytes that are not valid UTF-8; a
    // byte-order mark.
    await expectConfigRefused(
      product,
      NON_UTF8_CONFIG,
      "T7-2 (encoding: the byte 0xFF inside a trailing line comment — the " +
        "file's bytes are not valid UTF-8)",
    );
    await expectConfigRefused(
      product,
      BOM_CONFIG,
      "T7-2 (encoding: the file begins with a byte-order mark)",
    );

    // Object-literal keys and names (SPEC 7, 14.14): repeated keys, empty
    // names — each 14.14, exit 2.
    for (const arm of KEY_AND_NAME_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-2 (${arm.label})`);
    }

    // Comments (SPEC 7): the commented configuration loads, and the
    // inventory's resolved `configuration` view is byte-identical to its
    // comment-free twin's — compared as the member's serialization, member
    // order and spellings included.
    const configurationViewOf = async (
      config: string,
      label: string,
    ): Promise<unknown> =>
      await withWorkspace(
        {
          files: {
            "xspec.config.ts": config,
            "specs/A.mdx": SECTION_A_SOURCE,
          },
        },
        async (workspace) => {
          await buildOk(
            product,
            workspace,
            `${label}: \`build\` — the configuration loads (SPEC 7)`,
          );
          const inventoryLabel = `${label} \`inventory --json\``;
          const raw = await runJson(
            product,
            workspace,
            ["inventory", "--json"],
            inventoryLabel,
          );
          decodeInventoryDocument(raw, inventoryLabel);
          return (raw as { readonly configuration: unknown }).configuration;
        },
      );
    const commented = await configurationViewOf(
      COMMENTED_CONFIG,
      "T7-2 (comments)",
    );
    const commentFree = await configurationViewOf(
      COMMENT_FREE_CONFIG,
      "T7-2 (comment-free twin)",
    );
    const commentsContext =
      "T7-2 (comments): `inventory`'s `configuration` member under the " +
      "commented configuration is byte-identical to the comment-free " +
      "twin's — line and block comments before the import, after it, " +
      "between keys, inside the glob list, and after the export " +
      "contribute nothing (SPEC 7, 11.6)";
    assertSameJson(commented, commentFree, commentsContext);
    if (JSON.stringify(commented) !== JSON.stringify(commentFree)) {
      fail(
        `${commentsContext}; the members are equal as values but ` +
          `serialize differently (member order): ` +
          `${JSON.stringify(commented)} vs ${JSON.stringify(commentFree)}`,
      );
    }
  },
});

// ---------------------------------------------------------------------------
// T7-3 — keys
// ---------------------------------------------------------------------------

// 14.14 arms: `specs` missing, and an unknown key at each defined position —
// top level, in `markdown`, in a profile, in a rule, and in a selector. In
// every unknown-key fixture the surrounding configuration is valid (existing
// unambiguous group references, all required fields present, permitted
// literal values), so the unknown key is the only defect.
const KEY_VIOLATIONS: readonly { label: string; config: string }[] = [
  {
    label: "`specs` missing",
    config: `import { defineConfig } from "xspec"

export default defineConfig({})
`,
  },
  {
    label: "unknown key at top level",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  extra: true
})
`,
  },
  {
    label: "unknown key in `markdown`",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, extra: true }
})
`,
  },
  {
    label: "unknown key in a coverage profile",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"],
    aux: ["aux/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      boundary: "aux",
      mode: "direct",
      extra: true
    }
  ]
})
`,
  },
  {
    label: "unknown key in a policy rule",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"],
    aux: ["aux/**/*.mdx"]
  },
  policy: [
    {
      name: "r",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "aux" },
      extra: true
    }
  ]
})
`,
  },
  {
    label: "unknown key in a selector",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"],
    aux: ["aux/**/*.mdx"]
  },
  policy: [
    {
      name: "r",
      type: "forbidden",
      from: { group: "main", extra: true },
      to: { group: "aux" }
    }
  ]
})
`,
  },
];

// Value shapes (SPEC 7, 7.1, 7.2; 14.14: a configuration that does not
// conform, an otherwise invalid group shape) — TEST-SPEC T7-3's "one arm
// each": seven fixtures, every one SPECS_ONLY_CONFIG with exactly one shape
// deviation, so the refusal is attributable to it alone. Each deviating
// value is admitted by the declarative form of 7 (a static string literal,
// the boolean literal `true`, an object or array literal — never a T7-2
// form error) and excluded by the shapes 7.1, 7.2, 7.4, and 7.5 prescribe:
// a group's value is a list of globs, a glob is a string, `coverage` and
// `policy` are lists, and `specs` and `code` are maps of named groups —
// discriminating a product that reads the declarative form loosely,
// accepting whatever its own loader tolerates.
const VALUE_SHAPE_VIOLATIONS: readonly { label: string; config: string }[] = [
  {
    label: "a spec group whose value is a single string rather than a list",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: "specs/**/*.mdx"
  }
})
`,
  },
  {
    label: "a code group whose value is a single string rather than a list",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    impl: "src/**/*.ts"
  }
})
`,
  },
  {
    label: "a glob list holding a non-string element ([true])",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: [true]
  }
})
`,
  },
  {
    label: "`coverage` given as an object rather than a list ({})",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: {}
})
`,
  },
  {
    label: "`policy` given as an object rather than a list ({})",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: {}
})
`,
  },
  {
    label: "`specs` given as a list rather than a map of groups",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: ["specs/**/*.mdx"]
})
`,
  },
  {
    label: "`code` given as a list rather than a map of groups",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: ["src/**/*.ts"]
})
`,
  },
];

// `code` omitted: a marker-bearing TypeScript file that WOULD be a valid
// code source (a spec module import plus a marker recording a `references`
// edge, SPEC 4.5) — so a product that wrongly discovers `.ts` files without
// a `code` key records an edge from it and fails the edge-set equality.
const MARKER_TS = `import SPEC from "../specs/A.xspec"

export function impl(): void {
  SPEC.a
}
`;

// The complete edge set of the `code`-omitted fixture (SPEC 5.1–5.2): one
// contains edge from A.mdx's root to its only section — and nothing sourced
// at the undiscovered src/impl.ts.
const CODE_OMITTED_EDGES: readonly GraphEdge[] = [
  { from: "specs/A.mdx", to: "specs/A.mdx#a", kind: "contains" },
];

// `policy` omitted / empty lists: two spec groups joined by one depends edge
// (external-form d prop, SPEC 2.2) — the edge T7.5-2's forbidden rule
// (from group product to group other) would flag if the rule existed.
const TWO_GROUP_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    product: ["specs/product/**/*.mdx"],
    other: ["specs/other/**/*.mdx"]
  }
})
`;

const EMPTY_LISTS_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    product: ["specs/product/**/*.mdx"],
    other: ["specs/other/**/*.mdx"]
  },
  coverage: [],
  policy: []
})
`;

const PRODUCT_MDX = stagedMdx(
  "T7-3 specs/product/P.mdx",
  `import O from "../other/O.xspec"

<S id="p" d={O.o}>
Product behavior depending on other.
</S>
`,
);

const OTHER_MDX = stagedMdx("T7-3 specs/other/O.mdx", mdxSection("o"));

const VIOLATING_EDGE_FILES: Readonly<Record<string, InitialFileContents>> = {
  "specs/product/P.mdx": PRODUCT_MDX,
  "specs/other/O.mdx": OTHER_MDX,
};

/** The depends edge the omitted/empty policy would have forbidden. */
const WOULD_VIOLATE_EDGE: readonly GraphEdge[] = [
  { from: "specs/product/P.mdx#p", to: "specs/other/O.mdx#o", kind: "depends" },
];

/** Every regular file under `rel`, workspace-relative, sorted (recursive). */
async function listFiles(
  workspace: TestWorkspace,
  rel: string,
): Promise<string[]> {
  const out: string[] = [];
  const entries = await fsp.readdir(workspace.path(rel), {
    withFileTypes: true,
  });
  for (const entry of entries) {
    const childRel = rel === "." ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...(await listFiles(workspace, childRel)));
    } else {
      out.push(childRel);
    }
  }
  return out.sort();
}

/**
 * Assert the depends edge the omitted/empty rule would flag exists — the
 * fixture premise of the `policy` arms; without it "check reports no policy
 * findings" would be vacuous.
 */
async function assertViolatingEdgePresent(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const label = `${context} \`query edges --kinds depends\` (fixture premise)`;
  const depends = decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--kinds", "depends"],
      label,
    ),
    label,
  );
  assertEdgeSetEqual(
    depends,
    WOULD_VIOLATE_EDGE,
    `${label}: the depends edge the absent forbidden rule (T7.5-2's shape: ` +
      `from group product to group other) would flag is present — the ` +
      `no-findings assertion below is not vacuous (SPEC 2.2, 7.5)`,
  );
}

// Names containing U+FFFD (SPEC 7, 14.14; 12.0: no argument value carries
// the character, and configured names are named in arguments): a spec
// group, a profile, and a rule, one arm each. The character is staged as
// its validly encoded code point (EF BF BD) between two letters, so 14.14's
// name rule — never the encoding rule — is at stake; the group key takes
// the string-literal form (U+FFFD is no identifier character), and the
// profile and rule reference the existing unambiguous group `main`, so the
// name is each fixture's only defect. A product not checking names loads
// each and builds (exit 0).
const REPLACEMENT_NAME_VIOLATIONS: readonly {
  label: string;
  config: string;
}[] = [
  {
    label: "a spec group named with U+FFFD",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    "a${REPLACEMENT_CHARACTER}b": ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: "a coverage profile named with U+FFFD",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p${REPLACEMENT_CHARACTER}q",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
  },
  {
    label: "a policy rule named with U+FFFD",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: [
    {
      name: "r${REPLACEMENT_CHARACTER}s",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "main" }
    }
  ]
})
`,
  },
];

const T7_3 = defineProductTest({
  id: "T7-3",
  title:
    "keys: specs is required; omitted code/markdown/coverage/policy mean " +
    "no code groups, no emission, zero profiles, and no policy findings; " +
    "empty coverage/policy lists equal omission; unknown keys at every " +
    "position, values of the wrong shape (a group valued by a single " +
    "string, a glob list holding true, coverage/policy given as objects, " +
    "specs/code given as lists), and a spec group, a profile, or a rule " +
    "named with U+FFFD are configuration errors (SPEC 7, 7.1, 7.2, 14.14)",
  run: async (product) => {
    // (a) `specs` missing and the unknown-key matrix — each 14.14, exit 2.
    for (const arm of KEY_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-3 (${arm.label})`);
    }

    // (a′) value shapes — each 14.14, exit 2, the configuration file named
    // and nothing written (SPEC 7, 7.1, 7.2; 14.14).
    for (const arm of VALUE_SHAPE_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-3 (${arm.label})`);
    }

    // (a″) names containing U+FFFD — a spec group, a profile, a rule —
    // each 14.14, exit 2 (SPEC 7, 14.14).
    for (const arm of REPLACEMENT_NAME_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-3 (${arm.label})`);
    }

    // (b) `code` omitted — no code groups: the marker-bearing .ts file is
    // undiscovered, no edge is sourced at it, and naming it in --from is
    // unknown (exit 2; SPEC 7, 11).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
          "src/impl.ts": MARKER_TS,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-3 (code omitted): `build` — with no code groups the " +
            "marker-bearing src/impl.ts is no source, so nothing validates " +
            "or analyzes it (SPEC 7)",
        );
        const edgesLabel = "T7-3 (code omitted) `query edges` (unfiltered)";
        const edges = decodeEdgesReport(
          await runJson(product, workspace, ["query", "edges"], edgesLabel),
          edgesLabel,
        );
        assertEdgeSetEqual(
          edges,
          CODE_OMITTED_EDGES,
          `${edgesLabel}: the complete edge list carries no edge from the ` +
            `undiscovered src/impl.ts — omitting the code key means no ` +
            `code groups (SPEC 7, 4.5, 5.2)`,
        );
        const fromLabel =
          "T7-3 (code omitted) `query edges --from src/impl.ts`";
        const fromResult = await expectExit(
          product,
          workspace,
          ["query", "edges", "--from", "src/impl.ts"],
          2,
          `${fromLabel} — a path in no configured group is unknown, a ` +
            `usage error (SPEC 11, 12.0)`,
        );
        expectErrorDocument(
          fromResult,
          `${fromLabel} — query's single JSON document is its only output ` +
            `form, so JSON output is in effect without --json and the ` +
            `exit-2 error document is the entire stdout (SPEC 11, 12.0, ` +
            `12.7, H-5)`,
        );
        if (fromResult.stderrBytes.length === 0) {
          fail(
            `${fromLabel}: the usage error must be a standard-error ` +
              `diagnostic (SPEC 12.0); stderr is empty — ` +
              summarizeResult(fromResult),
          );
        }
      },
    );

    // (c) `markdown` omitted — no emission for any source (SPEC 7.3; T3-6).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
          "specs/sub/B.mdx": SECTION_B_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T7-3 (markdown omitted): `build`");
        const files = await listFiles(workspace, ".");
        assertSameJson(
          files.filter((relPath) => relPath.endsWith(".md")),
          [],
          "T7-3 (markdown omitted): after `build`, no file anywhere in the " +
            "workspace tree has a .md name — omitting the markdown key " +
            "means no Markdown emission for any source (SPEC 7, 7.3; " +
            `full file list: ${JSON.stringify(files)})`,
        );
      },
    );

    // (d) `coverage` omitted — zero profiles reported, exit 0 (SPEC 7, 8.2).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T7-3 (coverage omitted): `build`");
        const label = "T7-3 (coverage omitted) `coverage --json`";
        const report = decodeCoverageReport(
          await runJson(product, workspace, ["coverage", "--json"], label),
          label,
        );
        assertSameJson(
          report.profiles,
          [],
          `${label}: omitting the coverage key means no profiles — the ` +
            `report carries zero profiles and the command exits 0 ` +
            `(SPEC 7, 8.2)`,
        );
      },
    );

    // (e) `policy` omitted — no rules: `check` over the would-violate edge
    // reports no policy findings and exits 0 (SPEC 7, 7.5).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": TWO_GROUP_CONFIG,
          ...VIOLATING_EDGE_FILES,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T7-3 (policy omitted): `build`");
        await assertViolatingEdgePresent(
          product,
          workspace,
          "T7-3 (policy omitted)",
        );
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T7-3 (policy omitted): `check` — with the rule omitted there " +
            "are no policy rules, so the edge yields no finding and check " +
            "exits 0 (SPEC 7, 7.5, 14.12)",
        );
      },
    );

    // (f) `coverage: []` and `policy: []` — valid, equivalent to omission:
    // zero profiles reported, no policy findings (SPEC 7).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": EMPTY_LISTS_CONFIG,
          ...VIOLATING_EDGE_FILES,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-3 (empty lists): `build` — coverage: [] and policy: [] are " +
            "valid configuration (SPEC 7)",
        );
        const label = "T7-3 (empty lists) `coverage --json`";
        const report = decodeCoverageReport(
          await runJson(product, workspace, ["coverage", "--json"], label),
          label,
        );
        assertSameJson(
          report.profiles,
          [],
          `${label}: coverage: [] is equivalent to omitting the key — ` +
            `zero profiles reported, exit 0 (SPEC 7, 8.2)`,
        );
        await assertViolatingEdgePresent(
          product,
          workspace,
          "T7-3 (empty lists)",
        );
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T7-3 (empty lists): `check` — policy: [] is equivalent to " +
            "omitting the key: no rules, no policy findings, exit 0 " +
            "(SPEC 7, 7.5)",
        );
      },
    );
  },
});

/** TEST-SPEC §7 basics T7-1…T7-3, in canonical ID order (SUITE-26). */
export const section7BasicsTests: readonly ProductTestEntry[] = [
  T7_1,
  T7_2,
  T7_3,
];
