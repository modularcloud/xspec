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
// equal omission; unknown keys anywhere in the argument are 14.14.
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

import * as fsp from "node:fs/promises";
import type { GraphEdge } from "../../helpers/adapters/index.js";
import {
  decodeCoverageReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeIdsReport,
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
import type { ProductBinding } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertSameJson,
  buildOk,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material
// ---------------------------------------------------------------------------

/** A minimal single-section source: one node `<id>` under the file root. */
function mdxSection(id: string): string {
  return `<S id="${id}">\nText for ${id}.\n</S>\n`;
}

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
 * valid and matched by every fixture's `specs/**\/*.mdx` glob, so a product
 * that wrongly accepts the configuration proceeds to a successful build
 * (exit 0) and fails the exit-code assertion — never exits 2 for a
 * side reason.
 */
async function expectConfigRefused(
  product: ProductBinding,
  config: string,
  context: string,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": config,
        "specs/A.mdx": mdxSection("a"),
      },
    },
    async (workspace) => {
      await expectConfigurationError(product, workspace, ["build"], context);
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

const T7_1 = defineProductTest({
  id: "T7-1",
  title:
    "configuration location: upward search from a nested working " +
    "directory; --config, resolved against the working directory, " +
    "overrides the search; no configuration reachable is a configuration " +
    "error — by a failed upward search, and by --config naming a " +
    "nonexistent file, never a plain usage error (SPEC 7, 12.0, 12.7, " +
    "14.14)",
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
      { files: { "specs/A.mdx": mdxSection("a") } },
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
const QUOTED_KEYS_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": QUOTED_KEYS_CONFIG,
  "specs/A.mdx": `<S id="a">
Covered leaf.
</S>

<S id="p" d={"a"}>
Dependent leaf.
</S>
`,
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

const T7_2 = defineProductTest({
  id: "T7-2",
  title:
    "declarative form: a syntax error, a missing or misdirected " +
    "defineConfig import, extra statements, each non-literal argument " +
    "form, and a non-call default export are configuration errors (14.14, " +
    "exit 2); an aliased defineConfig import is valid; string-literal " +
    "group-name keys are part of the accepted form — they load, discover, " +
    "and resolve in a coverage profile and a policy selector (SPEC 7, 7.4, " +
    "7.5, 8)",
  run: async (product) => {
    for (const arm of FORM_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-2 (${arm.label})`);
    }

    await withWorkspace(
      {
        files: {
          "xspec.config.ts": ALIASED_CONFIG,
          "specs/A.mdx": mdxSection("a"),
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

const PRODUCT_MDX = `import O from "../other/O.xspec"

<S id="p" d={O.o}>
Product behavior depending on other.
</S>
`;

const OTHER_MDX = mdxSection("o");

const VIOLATING_EDGE_FILES: Readonly<Record<string, string>> = {
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

const T7_3 = defineProductTest({
  id: "T7-3",
  title:
    "keys: specs is required; omitted code/markdown/coverage/policy mean " +
    "no code groups, no emission, zero profiles, and no policy findings; " +
    "empty coverage/policy lists equal omission; unknown keys at every " +
    "position are configuration errors (SPEC 7, 14.14)",
  run: async (product) => {
    // (a) `specs` missing and the unknown-key matrix — each 14.14, exit 2.
    for (const arm of KEY_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-3 (${arm.label})`);
    }

    // (b) `code` omitted — no code groups: the marker-bearing .ts file is
    // undiscovered, no edge is sourced at it, and naming it in --from is
    // unknown (exit 2; SPEC 7, 11).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": mdxSection("a"),
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
          "specs/A.mdx": mdxSection("a"),
          "specs/sub/B.mdx": mdxSection("b"),
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
          "specs/A.mdx": mdxSection("a"),
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
