// TEST-SPEC §12.0 II (global command conventions, second half) — SUITE-42:
// T12.0-7, T12.0-8, T12.0-9, T12.0-10, T12.0-11, T12.0-12, T12.0-13.
//
// T12.0-10's rename/move and baseline arms stay cross-references in
// TEST-SPEC ("Rename/move and baseline arms: T6.4-4/T6.5-5 (existence,
// kind, and masking) and T6.3-4"): that content runs as the ordering/masking
// arms of section-6.4.ts, section-6.5.ts, and section-6.3.ts — the H-7 map
// keeps "12.0" on those three — and a re-registration here would re-run
// those bodies (duplicated execution). The gated-read, masking,
// past-the-gate, and within-class-2 precedence arms are T12.0-10's own
// registered body below.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8).
//
// SPEC 12.0: all output, generated files, and stored data are
// byte-deterministic for identical input — no wall-clock values, no
// randomness, no absolute paths, no environment-dependent content; where one
// shortest path is called for and several qualify, the reported one is the
// least by element-wise byte comparison of the paths' node-identity
// sequences; exit codes partition all outcomes into 0 (success and
// informational reports), 1 (findings), and 2 (usage and configuration
// errors); and — SPEC.md's preamble — git data is read only where explicitly
// stated and never written, with only baseline-taking invocations requiring
// git at all.
//
// Conservative operationalizations (noted per H-3/H-4):
// - T12.0-7 compares the product to itself (the one case H-4 admits for
//   opaque bytes): a representative story — build, reads in human and
//   `--json` forms, review-session creation under both git-less strategies,
//   journaled rename and file-form move — runs in two content-identical
//   workspaces at different absolute paths, asserting per-step byte-identical
//   outputs and finally byte-identical whole trees. `.git/` is excluded from
//   the cross-directory compare: git internals (index stat cache, reflog
//   timestamps) legitimately embed machine state even for identically
//   scripted repositories, and the product never writes them (T12.0-11). The
//   irrelevant-environment arm varies TZ/LANG/LC_ALL/TERM/COLUMNS/LINES/
//   NO_COLOR/FORCE_COLOR plus a nonsense variable — none is given meaning by
//   SPEC.md, so output depending on any of them is environment-dependent
//   content (SPEC 12.0).
// - T12.0-8 stages, per command, a fixture whose shortest-path candidates are
//   exactly two equal-length sequences diverging in one element, so the
//   asserted path is attributable to the byte-least tie-break alone.
// - T12.0-9 asserts exact exit codes (the partition is the contract under
//   test); stream separation is T12.0-2's. Rows whose class is only
//   meaningful under a premise (impact *with differences*, coverage with an
//   uncovered node, fully-resolved `next`, a *blocked* resolve, a code
//   source *discovered* so a wrong-kind exit 2 is attributable to operand
//   kind rather than to an unconfigured path) carry a light premise probe so
//   the asserted exit code is attributable to its class. The class-1
//   "answers carrying findings or explicitly-unavailable data — emitted in
//   full" rows assert emission at H-5's protocol grain — stdout parses as
//   exactly one JSON document (the 11.2 surfaces are JSON-only) — T11.2-5
//   pinning the full-answer contract; preview rows assert exit codes only,
//   T6.6-* owning modifies-nothing and report content.
// - T12.0-10 operationalizes "the same names on a valid twin workspace
//   giving the same exit-2 errors" and "identically with the workspace's
//   configuration file invalid or missing" as byte-identical exit-2 stdout —
//   the entire 12.7 error document (H-5) — across the paired workspaces:
//   H-4's product-to-itself compare, sound because each check consults
//   identical state in both (configuration, the session directory, the
//   named files' parses) and a plain usage error describes the invocation,
//   never workspace content (SPEC 14). Stderr is asserted nonempty on each
//   side only — its wording, like all diagnostic text, is unpinned (H-3).
//   "Reports no validation findings" is asserted at H-5's protocol grain:
//   the exit-2 stdout is exactly the one 12.7 error document, a form with
//   no findings member (12.7). "Reports the corruption" reuses T10.1-4's
//   operationalization (exit 1, stdout matching /corrupt/i — SPEC.md's
//   fixed vocabulary for the state; information presence, not wording).
// - T12.0-11 partitions a whole-workspace byte diff around each git-reading
//   invocation: any change under `.git/` fails (same file set, same bytes),
//   and every change outside it must be a write the command's own
//   specification calls for (the session file; nothing for `impact`).
// - T12.0-12 guards its own staging: the sweep workspace must have no
//   enclosing git repository (walked to the filesystem root), thrown as a
//   harness staging error — an ambient repository would mask a product that
//   wrongly requires git.
// - T12.0-13 stages the entry's `specs/a#b.mdx` on every platform (`#` is a
//   legal file-name byte on every filesystem the harness supports — the
//   T11.2-3 operationalization of the entry's "(Linux leg)" note, which
//   exists for that entry's non-UTF-8 siblings, staged nowhere in this
//   test — so no platform skips it, H-9). Its multi-`#` spellings pair the
//   entry's literal `a#b#c` with `specs/a#b.mdx#pa`, whose last-`#` split
//   names a DISCOVERED file plus a SPELLED id: a product splitting at the
//   last `#` instead of rejecting the value proceeds into the gated read /
//   move machinery and answers exit 1 on this failing workspace — an
//   observably different exit — while the first-`#` split's unknown-file
//   error stays inside exit class 2 and is discriminated by T12.0-10's
//   valid-twin machinery, not re-staged here. "Malformed value → exit 2" is
//   asserted with the FP-002 protocol (single 12.7 error document under
//   JSON output, stderr message present); the no-configuration-load half of
//   malformed-value precedence is T12.0-10's within-class-2 arm.

import { Buffer } from "node:buffer";
import * as path from "node:path";
import {
  assertReportMentions,
  decodeAtReport,
  decodeCoverageReport,
  decodeExportReport,
  decodeFindingsReport,
  decodeNextReport,
  decodeOccurrencesReport,
  decodeReachableReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import type {
  ExportReport,
  Finding,
  PathValue,
  SourceRange,
  ViewAttributeEntry,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import {
  assertRunOutcomesEqual,
  assertRunTwiceDeterministic,
} from "../../helpers/determinism.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertDirectoriesEqual,
  assertLeavesUnchanged,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { SnapshotChange } from "../../helpers/snapshot.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import {
  pathExists,
  releaseHoldFile,
  runProduct,
  startProduct,
} from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { impactAgainst, SPECS_ONLY_CONFIG } from "./section-5.6.js";
import { assertImpactedCode, SPEC_AND_CODE_CONFIG } from "./section-9.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  buildOk,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  runCli,
  runJson,
} from "./support.js";

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

/** Whether a snapshot key lies under the fixture's `.git/` directory. */
function isGitKey(key: string): boolean {
  return key === ".git" || key.startsWith(".git/");
}

/** Snapshot exclusion pruning the `.git` subtree (fixture machinery). */
function excludeGitDir(relPathBytes: Uint8Array): boolean {
  return Buffer.from(relPathBytes).toString("latin1") === ".git";
}

function renderChanges(changes: readonly SnapshotChange[]): string {
  const lines = changes
    .slice(0, 10)
    .map(
      (change) =>
        `  - ${change.change} ${change.path}: ${change.detail.split("\n").join("\n    ")}`,
    );
  if (changes.length > 10) {
    lines.push(`  … and ${String(changes.length - 10)} more`);
  }
  return lines.join("\n");
}

/**
 * Find the id of a session item by kind and scope node in a decoded export
 * report, failing diagnosed when absent (the fixtures below stage sessions
 * whose derivations must contain these items; SPEC 10.5/10.6/10.7).
 */
function findItemId(
  report: ExportReport,
  kind: string,
  scopeNode: string,
  context: string,
): string {
  const item = report.items.find(
    (candidate) =>
      candidate.kind === kind && candidate.scope.node === scopeNode,
  );
  if (item === undefined) {
    fail(
      `${context}: the session must contain a ${kind} item scoped to ` +
        `${scopeNode} (SPEC 10.5, 10.6, 10.7) — got items ` +
        `${JSON.stringify(
          report.items.map((candidate) => ({
            kind: candidate.kind,
            scope: candidate.scope.node,
          })),
        )}`,
    );
  }
  return item.id;
}

// ---------------------------------------------------------------------------
// Shared story fixture (T12.0-7, T12.0-9): one spec group with Markdown
// emission and a coverage profile; `alpha` (with a child) depends on `omega`,
// so `omega` is covered while `alpha.kid` and `beta` stay uncovered; sources
// are committed as the git baseline and `omega` is edited afterwards, so
// `impact --base` reports differences.
// ---------------------------------------------------------------------------

const STORY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true },
  coverage: [
    {
      name: "prof",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

const STORY_FILE_A = "specs/A.mdx";
const STORY_FILE_B = "specs/B.mdx";
const STORY_ALPHA = "specs/A.mdx#alpha";
const STORY_OMEGA = "specs/A.mdx#omega";

const storyASource = (omegaText: string): string =>
  [
    '<S id="alpha" d={"omega"}>',
    "Alpha intro.",
    "",
    '<S id="alpha.kid">',
    "Kid text.",
    "</S>",
    "</S>",
    "",
    '<S id="omega" tags="keep">',
    omegaText,
    "</S>",
    "",
  ].join("\n");

const STORY_B_SOURCE = ['<S id="beta">', "Beta text.", "</S>", ""].join("\n");

/**
 * Stage the story workspace: v1 sources committed as the baseline, then
 * `omega` edited to v2 — a deterministic factory (pinned git identities and
 * timestamps make the commit hash platform- and directory-independent).
 */
async function makeStoryWorkspace(): Promise<{
  workspace: TestWorkspace;
  baseRef: string;
}> {
  const workspace = await TestWorkspace.create({
    files: {
      "xspec.config.ts": STORY_CONFIG,
      [STORY_FILE_A]: storyASource("Omega text v1."),
      [STORY_FILE_B]: STORY_B_SOURCE,
    },
  });
  try {
    await workspace.gitInit();
    const baseRef = await workspace.gitCommitAll("story baseline");
    await workspace.file(STORY_FILE_A, storyASource("Omega text v2."));
    return { workspace, baseRef };
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// T12.0-7 — determinism
// ---------------------------------------------------------------------------

interface DeterminismStep {
  /** Step summary for diagnoses. */
  readonly what: string;
  readonly argv: (baseRef: string) => readonly string[];
  /** Whether the step's entire stdout must parse as one JSON document. */
  readonly json: boolean;
}

// The representative story: build products, every report in human and/or
// `--json` form, session creation under both git-less strategies, then the
// journaled mutations (last, so every step runs at a state its arguments are
// valid in) and a post-mutation report.
const DETERMINISM_STEPS: readonly DeterminismStep[] = [
  { what: "build", json: true, argv: () => ["build", "--json"] },
  { what: "check (human)", json: false, argv: () => ["check"] },
  { what: "check --json", json: true, argv: () => ["check", "--json"] },
  { what: "ids (human)", json: false, argv: () => ["ids"] },
  { what: "ids --json", json: true, argv: () => ["ids", "--json"] },
  { what: "show (human)", json: false, argv: () => ["show", STORY_ALPHA] },
  { what: "coverage (human)", json: false, argv: () => ["coverage"] },
  { what: "coverage --json", json: true, argv: () => ["coverage", "--json"] },
  {
    what: "impact (human)",
    json: false,
    argv: (baseRef) => ["impact", "--base", baseRef],
  },
  {
    what: "impact --json",
    json: true,
    argv: (baseRef) => ["impact", "--base", baseRef, "--json"],
  },
  {
    what: "query node",
    json: true,
    argv: () => ["query", "node", STORY_ALPHA],
  },
  {
    what: "query edges --json",
    json: true,
    argv: () => ["query", "edges", "--json"],
  },
  {
    what: "review create (audit)",
    json: true,
    argv: () => [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      "aud",
      "--json",
    ],
  },
  {
    what: "review create (coverage)",
    json: true,
    argv: () => [
      "review",
      "create",
      "--coverage",
      "prof",
      "--name",
      "cov",
      "--json",
    ],
  },
  {
    what: "review status aud (human)",
    json: false,
    argv: () => ["review", "status", "aud"],
  },
  {
    what: "review export aud",
    json: true,
    argv: () => ["review", "export", "aud", "--json"],
  },
  {
    what: "review next cov",
    json: true,
    argv: () => ["review", "next", "cov", "--json"],
  },
  {
    what: "rename",
    json: true,
    argv: () => ["rename", STORY_FILE_A, "alpha", "alpha2", "--json"],
  },
  {
    what: "move",
    json: true,
    argv: () => ["move", STORY_FILE_B, "specs/moved/B2.mdx", "--json"],
  },
  { what: "post-mutation check (human)", json: false, argv: () => ["check"] },
];

// Post-story identities (`alpha` renamed to `alpha2` by the story).
const STORY_ALPHA2 = "specs/A.mdx#alpha2";

// Two environments differing only in variables SPEC.md gives no meaning to
// (module header): identical behavior and bytes are required (SPEC 12.0).
const IRRELEVANT_ENV_A: Readonly<Record<string, string | undefined>> = {
  TZ: "UTC",
  LANG: "C",
  LC_ALL: "C",
  TERM: "dumb",
  COLUMNS: "80",
  LINES: "24",
  NO_COLOR: "1",
  FORCE_COLOR: undefined,
  XSPEC_HARNESS_IRRELEVANT: "one",
};
const IRRELEVANT_ENV_B: Readonly<Record<string, string | undefined>> = {
  TZ: "America/New_York",
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
  TERM: "xterm-256color",
  COLUMNS: "213",
  LINES: "62",
  NO_COLOR: undefined,
  FORCE_COLOR: "3",
  XSPEC_HARNESS_IRRELEVANT: "two",
};

/**
 * Run one command twice with the two irrelevant environments: exit outcome,
 * stdout, and stderr byte-identical, and the workspace byte state after the
 * environment-B run identical to the state after the environment-A run
 * (SPEC 12.0: no environment leakage; H-6).
 */
async function assertEnvironmentInsensitive(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const first = await runProduct(product, {
    cwd: workspace.root,
    argv,
    env: IRRELEVANT_ENV_A,
  });
  assertExitCode(
    first,
    0,
    `${context} under irrelevant environment A — the command runs at a ` +
      `state its arguments are valid in, so it succeeds (SPEC 12.0)`,
  );
  const afterA = await snapshotDirectory(workspace.root);
  const second = await runProduct(product, {
    cwd: workspace.root,
    argv,
    env: IRRELEVANT_ENV_B,
  });
  assertRunOutcomesEqual(
    second,
    first,
    `${context}: differing irrelevant environment variables (TZ, LANG, ` +
      `LC_ALL, TERM, COLUMNS, LINES, NO_COLOR, FORCE_COLOR, a nonsense ` +
      `variable) must not change any output byte — no environment-dependent ` +
      `content (SPEC 12.0)`,
    "the environment-B run",
    "the environment-A run",
  );
  const afterB = await snapshotDirectory(workspace.root);
  const changes = diffSnapshots(afterA, afterB);
  if (changes.length > 0) {
    fail(
      `${context}: workspace byte state after the environment-B run differs ` +
        `from the state after the environment-A run — generated files and ` +
        `stored data carry environment-dependent content (SPEC 12.0):\n` +
        renderChanges(changes),
    );
  }
}

const T12_0_7 = defineProductTest({
  id: "T12.0-7",
  title:
    "determinism: a representative story — build products (generated modules, Markdown, graph data), every report in human and `--json` forms, audit and coverage review sessions, journaled rename and file-form move — produces byte-identical outputs per step across content-identical workspaces at different absolute paths, and byte-identical resulting trees (sources, generated files, Markdown, graph data, journal, session files; `.git/` internals excluded as fixture machinery); reports and rebuilds are byte-identical across repeated runs, and runs with differing irrelevant environment variables are byte-identical in output and workspace state — no wall-clock, randomness, absolute paths, or environment leakage (SPEC 12.0, H-6)",
  timeoutMs: 360_000,
  run: async (product) => {
    const first = await makeStoryWorkspace();
    try {
      const second = await makeStoryWorkspace();
      try {
        if (first.workspace.root === second.workspace.root) {
          throw new Error(
            "T12.0-7: the workspace factory returned the same root twice — " +
              "the two-directory protocol needs two separate directories",
          );
        }
        if (first.baseRef !== second.baseRef) {
          throw new Error(
            `T12.0-7: the two identically scripted git fixtures realized ` +
              `different commit hashes (${first.baseRef} vs ${second.baseRef}) — ` +
              `pinned identities and timestamps must make them equal; this ` +
              `is a harness bug, not a product observation`,
          );
        }
        const preFirst = await snapshotDirectory(first.workspace.root, {
          exclude: excludeGitDir,
        });
        const preSecond = await snapshotDirectory(second.workspace.root, {
          exclude: excludeGitDir,
        });
        const drift = diffSnapshots(preFirst, preSecond);
        if (drift.length > 0) {
          throw new Error(
            `T12.0-7: the workspace factory did not rebuild an identical ` +
              `workspace — the two-directory conclusion is only meaningful ` +
              `over identical inputs (harness bug):\n${renderChanges(drift)}`,
          );
        }

        // Part A — the story, step by step, in both directories: exit 0 in
        // each, outputs byte-identical across directories (an absolute path
        // leaking into any report differs between the two roots and fails).
        for (const step of DETERMINISM_STEPS) {
          const argv = step.argv(first.baseRef);
          const context = `T12.0-7 \`${argv.join(" ")}\``;
          const resultFirst = await runCli(product, first.workspace, argv);
          assertExitCode(
            resultFirst,
            0,
            `${context} in directory 1 — the ${step.what} step of the ` +
              `determinism story runs at a state its arguments are valid ` +
              `in, so it succeeds (SPEC 12.0)`,
          );
          const resultSecond = await runCli(product, second.workspace, argv);
          assertExitCode(resultSecond, 0, `${context} in directory 2`);
          assertRunOutcomesEqual(
            resultSecond,
            resultFirst,
            `${context}: content-identical workspaces at different absolute ` +
              `paths produce byte-identical reports — no absolute paths, ` +
              `wall-clock values, or randomness in any output (SPEC 12.0, H-6)`,
            "the run in directory 2",
            "the run in directory 1",
          );
          if (step.json) {
            parseJsonStdout(
              resultFirst,
              `${context} — under --json the single JSON document is the ` +
                `entire standard output (SPEC 12.0, H-5)`,
            );
          }
        }

        // The trees the story left behind: generated modules and companions,
        // emitted Markdown, graph data, the two-line journal, both session
        // files, and the rewritten sources — byte-identical across the two
        // directories (SPEC 12.0; H-4's product-to-itself compare).
        await assertDirectoriesEqual(
          first.workspace.root,
          second.workspace.root,
          "T12.0-7: after the full story, the two directories' workspace " +
            "trees (sources, generated files, Markdown, graph data, " +
            "journal, session files) must be byte-identical — stored data " +
            "contains no absolute paths, wall-clock values, randomness, or " +
            "environment-dependent content (SPEC 12.0, H-6)",
          { exclude: excludeGitDir },
        );

        // Part B — repeated runs in directory 1: outputs byte-identical and
        // the workspace byte state stable across the second run (H-6).
        const runTwice: readonly {
          readonly argv: readonly string[];
          readonly json: boolean;
        }[] = [
          { argv: ["build", "--json"], json: true },
          { argv: ["check"], json: false },
          { argv: ["ids"], json: false },
          { argv: ["show", STORY_ALPHA2], json: false },
          { argv: ["coverage", "--json"], json: true },
          {
            argv: ["impact", "--base", first.baseRef, "--json"],
            json: true,
          },
          { argv: ["query", "node", STORY_ALPHA2], json: true },
          { argv: ["review", "export", "aud", "--json"], json: true },
          { argv: ["review", "status", "cov"], json: false },
        ];
        for (const command of runTwice) {
          const context = `T12.0-7 run-twice \`${command.argv.join(" ")}\``;
          const pair = await assertRunTwiceDeterministic({
            binding: product,
            run: { cwd: first.workspace.root, argv: command.argv },
            context,
          });
          assertExitCode(
            pair.first,
            0,
            `${context} — the command succeeds over the post-story ` +
              `workspace (SPEC 12.0)`,
          );
          if (command.json) parseJsonStdout(pair.first, context);
        }

        // Part C — differing irrelevant environment variables, directory 2.
        const envCommands: readonly (readonly string[])[] = [
          ["build", "--json"],
          ["check"],
          ["ids", "--json"],
          ["coverage"],
          ["query", "node", STORY_ALPHA2],
          ["review", "export", "aud", "--json"],
        ];
        for (const argv of envCommands) {
          await assertEnvironmentInsensitive(
            product,
            second.workspace,
            argv,
            `T12.0-7 irrelevant-environment \`${argv.join(" ")}\``,
          );
        }
      } finally {
        await second.workspace.dispose();
      }
    } finally {
      await first.workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T12.0-8 — shortest-path tie-break
// ---------------------------------------------------------------------------

// `query reachable` fixture: exactly two shortest src → zz paths, diverging
// only in the middle element (`ma` < `mb` byte-wise).
const TIE_REACHABLE_SOURCE = [
  '<S id="src" d={["ma", "mb"]}>',
  "Source text.",
  "</S>",
  "",
  '<S id="ma" d={"zz"}>',
  "Middle a text.",
  "</S>",
  "",
  '<S id="mb" d={"zz"}>',
  "Middle b text.",
  "</S>",
  "",
  '<S id="zz">',
  "End target text.",
  "</S>",
  "",
].join("\n");

// Coverage fixture: boundary group `bnd` (only `b`), target group `tgt`;
// transitive mode; two equal-length covering paths to `zz` via `ma`/`mb`.
const TIE_COVERAGE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    bnd: ["specs/bnd/**/*.mdx"],
    tgt: ["specs/tgt/**/*.mdx"]
  },
  coverage: [
    {
      name: "prof",
      target: "tgt",
      boundary: "bnd",
      mode: "transitive"
    }
  ]
})
`;
const TIE_BOUNDARY_SOURCE = [
  'import T from "../tgt/T.xspec"',
  "",
  '<S id="b" d={[T.ma, T.mb]}>',
  "Boundary text.",
  "</S>",
  "",
].join("\n");
const TIE_TARGET_SOURCE = [
  '<S id="ma" d={"zz"}>',
  "Middle a text.",
  "</S>",
  "",
  '<S id="mb" d={"zz"}>',
  "Middle b text.",
  "</S>",
  "",
  '<S id="zz">',
  "End target text.",
  "</S>",
  "",
].join("\n");

// Impact fixture: `src/app.ts` references `n`; `n` depends on `ca` and `cb`,
// both edited since the baseline — two equal-length witness paths from `n`.
const TIE_IMPACT_SPEC = "specs/M.mdx";
const tieImpactSpecSource = (caText: string, cbText: string): string =>
  [
    '<S id="n" d={["ca", "cb"]}>',
    "Anchor text.",
    "</S>",
    "",
    '<S id="ca">',
    caText,
    "</S>",
    "",
    '<S id="cb">',
    cbText,
    "</S>",
    "",
  ].join("\n");
const TIE_IMPACT_APP = "src/app.ts";
const TIE_IMPACT_APP_SOURCE = [
  'import M from "../specs/M.xspec";',
  "",
  "M.n;",
  "",
].join("\n");

const T12_0_8 = defineProductTest({
  id: "T12.0-8",
  title:
    "shortest-path tie-break: where one shortest path is reported — a covered node's covering path (coverage, 8.2), an impacted code location's witness path (impact, 9.3), and `query reachable`'s witness path (11) — a dedicated two-equal-candidates fixture per command shows the element-wise byte-least node-identity sequence reported (SPEC 12.0)",
  run: async (product) => {
    // `query reachable` (SPEC 11, 12.0).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/R.mdx": TIE_REACHABLE_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T12.0-8 reachable-arm `build`");
        const context =
          "T12.0-8 `query reachable --from specs/R.mdx#src --to specs/R.mdx#zz`";
        const report = decodeReachableReport(
          await runJson(
            product,
            workspace,
            [
              "query",
              "reachable",
              "--from",
              "specs/R.mdx#src",
              "--to",
              "specs/R.mdx#zz",
            ],
            context,
          ),
          context,
        );
        if (!report.reachable) {
          fail(
            `${context}: two staged dependency paths lead from src to zz, ` +
              `so a path exists (SPEC 11)`,
          );
        }
        assertSameJson(
          report.path,
          ["specs/R.mdx#src", "specs/R.mdx#ma", "specs/R.mdx#zz"],
          `${context}: exactly two shortest witness paths exist, via ma and ` +
            `via mb; the element-wise byte-least node-identity sequence — ` +
            `through ma ("…#ma" < "…#mb") — is the reported one (SPEC 12.0, 11)`,
        );
      },
    );

    // `coverage` (SPEC 8.2, 12.0).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": TIE_COVERAGE_CONFIG,
          "specs/bnd/B.mdx": TIE_BOUNDARY_SOURCE,
          "specs/tgt/T.mdx": TIE_TARGET_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T12.0-8 coverage-arm `build`");
        const context = "T12.0-8 `coverage --json`";
        const report = decodeCoverageReport(
          await runJson(product, workspace, ["coverage", "--json"], context),
          context,
        );
        const profile = report.profiles.find((entry) => entry.name === "prof");
        if (profile === undefined) {
          fail(
            `${context}: the configured profile "prof" must be reported ` +
              `(SPEC 8.2); got ${JSON.stringify(
                report.profiles.map((entry) => entry.name),
              )}`,
          );
        }
        const covered = profile.covered.find(
          (entry) => entry.identity === "specs/tgt/T.mdx#zz",
        );
        if (covered === undefined) {
          fail(
            `${context}: zz is covered — transitive paths b → ma → zz and ` +
              `b → mb → zz exist (SPEC 8) — so it must appear among the ` +
              `covered nodes; got ${JSON.stringify(
                profile.covered.map((entry) => entry.identity),
              )}`,
          );
        }
        assertSameJson(
          covered.path,
          ["specs/bnd/B.mdx#b", "specs/tgt/T.mdx#ma", "specs/tgt/T.mdx#zz"],
          `${context}: zz's two shortest covering paths run through ma and ` +
            `mb; the element-wise byte-least sequence — through ma — is the ` +
            `reported one (SPEC 8.2, 12.0)`,
        );
      },
    );

    // `impact` (SPEC 9.3, 12.0).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPEC_AND_CODE_CONFIG,
          [TIE_IMPACT_SPEC]: tieImpactSpecSource(
            "Changed a v1.",
            "Changed b v1.",
          ),
          [TIE_IMPACT_APP]: TIE_IMPACT_APP_SOURCE,
        },
      },
      async (workspace) => {
        await workspace.gitInit();
        const base = await workspace.gitCommitAll("tie-break baseline");
        await workspace.file(
          TIE_IMPACT_SPEC,
          tieImpactSpecSource("Changed a v2.", "Changed b v2."),
        );
        await buildOk(
          product,
          workspace,
          "T12.0-8 impact-arm `build` over the doubly-edited workspace",
        );
        const context = "T12.0-8 `impact --base <baseline> --json`";
        assertImpactedCode(
          await impactAgainst(product, workspace, base, context),
          {
            // n's own subtree is untouched, so the location is transitively
            // impacted only; the two equal-length witness candidates from n
            // end at the edited ca and cb, and the byte-least sequence —
            // [n, ca] — is reported (SPEC 9.2, 9.3, 12.0).
            direct: [],
            transitive: [
              {
                location: TIE_IMPACT_APP,
                edge: {
                  from: TIE_IMPACT_APP,
                  to: "specs/M.mdx#n",
                  kind: "references",
                },
                path: ["specs/M.mdx#n", "specs/M.mdx#ca"],
              },
            ],
          },
          context,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.0-9 — exit-code partition
// ---------------------------------------------------------------------------

/** One partition row: an invocation and the exact class exit code. */
interface PartitionRow {
  /** The SPEC 12.0 class instance the row represents. */
  readonly what: string;
  readonly argv: readonly string[];
  readonly expect: 0 | 1 | 2;
  /**
   * Assert the answer document is still emitted beside the exit code: stdout
   * parses as exactly one JSON document. For the class-1 rows of the 11.2
   * surfaces (JSON-only, SPEC 11), whose class is "answers carrying findings
   * or explicitly-unavailable data — emitted in full": exit 1 signals
   * imperfection and never withholds the answer (SPEC 11.2), asserted here
   * at H-5's protocol grain — T11.2-5 pins the full-answer contract.
   */
  readonly emitsAnswer?: true;
}

async function runPartitionRows(
  product: ProductBinding,
  workspace: TestWorkspace,
  rows: readonly PartitionRow[],
): Promise<void> {
  for (const row of rows) {
    const result = await expectExit(
      product,
      workspace,
      row.argv,
      row.expect,
      `T12.0-9 \`${row.argv.join(" ")}\` — ${row.what}: exit codes ` +
        `partition all outcomes, and this outcome is in the ` +
        `${String(row.expect)} class (SPEC 12.0)`,
    );
    if (row.emitsAnswer === true) {
      parseJsonStdout(
        result,
        `T12.0-9 \`${row.argv.join(" ")}\` — ${row.what}: the answer is ` +
          `emitted in full beside exit ${String(row.expect)} — exit 1 ` +
          `signals imperfection and never withholds the answer, and the ` +
          `surface is JSON-only, so stdout is exactly one JSON document ` +
          `(SPEC 11.2, 11, H-5)`,
      );
    }
  }
}

const T12_0_9 = defineProductTest({
  id: "T12.0-9",
  title:
    "exit-code partition: a table-driven sweep asserting one representative per class per command family — 0 for success and informational reports (`ids`, `show`, `impact` with differences, `query`, review reads including fully-resolved `next`, `coverage` without `--check`, `version`, and complete finding-free answers: `occurrences`/`view`/`at` over a clean domain, `inventory`, a successful preview); 1 for findings (failing `build`, `check` findings, `coverage --check` uncovered, refused `rename`/`move` and their refused previews, refused review operations, corrupt-session reports, and answers carrying findings or explicitly-unavailable data — emitted in full); 2 for usage and configuration errors (unknown command/flag, missing required flag and argument, invalid flag value, unknown profile/session/group/item/node/file — except `occurrences --to`, where only a malformed spelling is a usage error — wrong-kind operands: a code source where a spec source or a requirement-node identity is required, invalid session name, configuration errors, unreadable baseline, mutual-exclusion refusal) (SPEC 12.0, 11.2, 11.6, 6.6, 12.6)",
  timeoutMs: 360_000,
  run: async (product) => {
    // --- The valid story workspace: informational, refusal, and usage rows.
    const { workspace, baseRef } = await makeStoryWorkspace();
    try {
      await buildOk(product, workspace, "T12.0-9 `build` (story workspace)");
      await runJson(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "aud", "--json"],
        "T12.0-9 staging `review create --strategy audit --name aud`",
      );

      // Premise: the audit session's alpha item is blocked by its child's
      // item (SPEC 10.6), so resolving it exercises the refused-review class.
      const audExportContext = "T12.0-9 staging `review export aud --json`";
      const audReport = decodeExportReport(
        await runJson(
          product,
          workspace,
          ["review", "export", "aud", "--json"],
          audExportContext,
        ),
        audExportContext,
      );
      const alphaItemId = findItemId(
        audReport,
        "subtree-coherence",
        STORY_ALPHA,
        audExportContext,
      );
      const alphaItem = audReport.items.find((item) => item.id === alphaItemId);
      if (alphaItem === undefined || !alphaItem.blocked) {
        fail(
          `${audExportContext}: alpha's audit item is blocked by its child ` +
            `section's unresolved item (SPEC 10.6), so the refused-resolve ` +
            `row below is attributable to blocking; got ` +
            `${JSON.stringify(alphaItem)}`,
        );
      }

      // Premise: a drained session, so `next` reports fully resolved. The
      // acyclic `blockedBy` of 10.1 guarantees the next/resolve loop below
      // reaches every item (a minimal needing-review item is always
      // unblocked); the iteration bound is the item count plus one.
      await runJson(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "done", "--json"],
        "T12.0-9 staging `review create --strategy audit --name done`",
      );
      const doneExportContext = "T12.0-9 staging `review export done --json`";
      const doneReport = decodeExportReport(
        await runJson(
          product,
          workspace,
          ["review", "export", "done", "--json"],
          doneExportContext,
        ),
        doneExportContext,
      );
      let drained = false;
      for (let i = 0; i <= doneReport.items.length; i += 1) {
        const nextContext = `T12.0-9 staging \`review next done --json\` (round ${String(i + 1)})`;
        const next = decodeNextReport(
          await runJson(
            product,
            workspace,
            ["review", "next", "done", "--json"],
            nextContext,
          ),
          nextContext,
        );
        if (next.fullyResolved) {
          drained = true;
          break;
        }
        if (next.item === undefined) {
          fail(
            `${nextContext}: a not-fully-resolved \`next\` report carries ` +
              `the first actionable item (SPEC 10.7)`,
          );
        }
        await expectExit(
          product,
          workspace,
          [
            "review",
            "resolve",
            "done",
            next.item.id,
            "--status",
            "no-change",
            "--json",
          ],
          0,
          `T12.0-9 staging: resolving the unblocked item ${next.item.id} of ` +
            `session done succeeds (SPEC 10.7)`,
        );
      }
      if (!drained) {
        fail(
          `T12.0-9 staging: resolving ${String(doneReport.items.length)} ` +
            `items one \`next\` at a time must drain the session — with ` +
            `acyclic blockedBy a minimal needing-review item is always ` +
            `unblocked (SPEC 10.1, 10.7)`,
        );
      }

      // Premise probes for the informational rows: impact reports an actual
      // difference (the staged omega edit) and the profile has an uncovered
      // node, so their exit-0/exit-1 rows carry their classes.
      const impactContext = "T12.0-9 `impact --base <ref> --json` (premise)";
      const impact = await impactAgainst(
        product,
        workspace,
        baseRef,
        impactContext,
      );
      if (impact.requirements.length === 0) {
        fail(
          `${impactContext}: omega was edited after the baseline commit, so ` +
            `the report contains requirement impact — the exit-0 row below ` +
            `is \`impact\` *with differences* (SPEC 9.3, 12.0)`,
        );
      }
      const coverageContext = "T12.0-9 `coverage --json` (premise)";
      const coverage = decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "--json"],
          coverageContext,
        ),
        coverageContext,
      );
      if (!coverage.profiles.some((profile) => profile.uncovered.length > 0)) {
        fail(
          `${coverageContext}: alpha.kid and beta have no incoming ` +
            `dependency edges, so the profile reports uncovered required ` +
            `nodes — the \`coverage\`/\`coverage --check\` rows below carry ` +
            `their classes (SPEC 8, 12.0)`,
        );
      }

      // Fully-resolved `next` (exit 0) with its premise asserted.
      const doneNextContext =
        "T12.0-9 `review next done --json` (fully resolved)";
      const doneNext = decodeNextReport(
        await runJson(
          product,
          workspace,
          ["review", "next", "done", "--json"],
          doneNextContext,
        ),
        doneNextContext,
      );
      if (!doneNext.fullyResolved) {
        fail(
          `${doneNextContext}: every item of the session was resolved, so ` +
            `\`next\` reports the session fully resolved and exits 0 ` +
            `(SPEC 10.7, 12.0)`,
        );
      }
      // Not-fully-resolved `next` is informational success too.
      const audNextContext = "T12.0-9 `review next aud --json`";
      const audNext = decodeNextReport(
        await runJson(
          product,
          workspace,
          ["review", "next", "aud", "--json"],
          audNextContext,
        ),
        audNextContext,
      );
      if (audNext.fullyResolved) {
        fail(
          `${audNextContext}: session aud has unresolved items, so \`next\` ` +
            `returns the first actionable one (SPEC 10.7) — the exit-0 ` +
            `class covers review reads with and without work remaining`,
        );
      }

      await runPartitionRows(product, workspace, [
        // 0 — success and informational reports.
        { what: "informational `ids`", argv: ["ids"], expect: 0 },
        {
          what: "informational `show`",
          argv: ["show", STORY_ALPHA],
          expect: 0,
        },
        {
          what: "`impact` with differences is informational",
          argv: ["impact", "--base", baseRef],
          expect: 0,
        },
        {
          what: "informational `query`",
          argv: ["query", "node", STORY_ALPHA],
          expect: 0,
        },
        {
          what: "review read `status`",
          argv: ["review", "status", "aud"],
          expect: 0,
        },
        { what: "review read `list`", argv: ["review", "list"], expect: 0 },
        {
          what: "review read `export`",
          argv: ["review", "export", "aud"],
          expect: 0,
        },
        {
          what: "`coverage` without `--check` reports uncovered nodes informationally",
          argv: ["coverage"],
          expect: 0,
        },
        // Complete finding-free answers over the clean domain (SPEC 11.2):
        // the premise — every discovered source finding-free — is the
        // staging `build`'s exit 0 above.
        {
          what: "workspace-independent `version` (SPEC 12.6)",
          argv: ["version"],
          expect: 0,
        },
        {
          what: "complete finding-free `occurrences` answer over the clean domain (SPEC 11.2, 11.3)",
          argv: ["occurrences"],
          expect: 0,
        },
        {
          what: "`occurrences --to` accepts a well-formed unknown identity — unknown is not a usage error on this filter, the selection empty over the finding-free domain (SPEC 11.3)",
          argv: ["occurrences", "--to", "specs/NoSuch.mdx#nope"],
          expect: 0,
        },
        {
          what: "complete finding-free `view` answer over the clean domain (SPEC 11.2, 11.4)",
          argv: ["view"],
          expect: 0,
        },
        {
          what: "complete finding-free `at` answer over the clean domain (SPEC 11.2, 11.5)",
          argv: ["at", STORY_FILE_A, "0"],
          expect: 0,
        },
        {
          what: "finding-free `inventory` (SPEC 11.6)",
          argv: ["inventory"],
          expect: 0,
        },
        {
          what: "successful preview — the real rename would proceed (`gamma` claimed by nothing in the fixture), so its `--preview` succeeds, modifying nothing (SPEC 6.6)",
          argv: ["rename", STORY_FILE_A, "alpha", "gamma", "--preview"],
          expect: 0,
        },
        // 1 — findings.
        {
          what: "`coverage --check` with uncovered requirements",
          argv: ["coverage", "--check"],
          expect: 1,
        },
        {
          what: "refused `rename` (the new ID collides with an existing ID, SPEC 6.4)",
          argv: ["rename", STORY_FILE_A, "alpha", "omega"],
          expect: 1,
        },
        {
          what: "refused `move` (the destination file already exists, SPEC 6.5)",
          argv: ["move", STORY_FILE_A, STORY_FILE_B],
          expect: 1,
        },
        // Refused previews: a preview is refused exactly when the real
        // operation would be (SPEC 6.6) — each twin rides the refusal its
        // real row above just demonstrated on this same state.
        {
          what: "refused rename preview (the same ID collision as the real refusal, SPEC 6.6, 6.4)",
          argv: ["rename", STORY_FILE_A, "alpha", "omega", "--preview"],
          expect: 1,
        },
        {
          what: "refused move preview (the same occupied destination as the real refusal, SPEC 6.6, 6.5)",
          argv: ["move", STORY_FILE_A, STORY_FILE_B, "--preview"],
          expect: 1,
        },
        {
          what: "refused review operation (resolving a blocked item, SPEC 10.7)",
          argv: [
            "review",
            "resolve",
            "aud",
            alphaItemId,
            "--status",
            "no-change",
          ],
          expect: 1,
        },
        // 2 — usage errors.
        {
          what: "unknown command",
          argv: ["definitely-not-a-command"],
          expect: 2,
        },
        {
          what: "unknown flag",
          argv: ["ids", "--definitely-not-a-flag"],
          expect: 2,
        },
        {
          what: "missing required flag (`impact` without `--base`)",
          argv: ["impact"],
          expect: 2,
        },
        {
          what: "missing required argument (`show` without `<node>`)",
          argv: ["show"],
          expect: 2,
        },
        {
          what: "invalid flag value (`reachable` accepts only dependency kinds, SPEC 11)",
          argv: [
            "query",
            "reachable",
            "--from",
            STORY_ALPHA,
            "--to",
            STORY_OMEGA,
            "--kinds",
            "contains",
          ],
          expect: 2,
        },
        {
          what: "unknown profile named in arguments",
          argv: ["coverage", "no-such-profile"],
          expect: 2,
        },
        {
          what: "unknown session named in arguments",
          argv: ["review", "status", "no-such-session"],
          expect: 2,
        },
        {
          what: "unknown group named in arguments",
          argv: ["query", "nodes", "--group", "no-such-group"],
          expect: 2,
        },
        {
          what: "unknown review item named in arguments",
          argv: ["review", "show", "aud", "xspec-harness-no-such-item"],
          expect: 2,
        },
        {
          what: "unknown node identity named in arguments",
          argv: ["show", "specs/A.mdx#no-such-id"],
          expect: 2,
        },
        {
          what: "unknown file named in arguments",
          argv: ["show", "specs/NoSuch.mdx"],
          expect: 2,
        },
        {
          what: "`occurrences --to` malformed spelling (an empty segment) — the exception to the unknown class: on this filter only a malformed spelling is a usage error, the well-formed unknown row above exiting 0 (SPEC 11.3)",
          argv: ["occurrences", "--to", "a#b..c"],
          expect: 2,
        },
        {
          what: "invalid session name (a leading `.`, SPEC 10.1)",
          argv: ["review", "create", "--strategy", "audit", "--name", ".bad"],
          expect: 2,
        },
        {
          what: "a baseline that cannot be resolved (SPEC 6.3)",
          argv: ["impact", "--base", "no-such-ref-xspec"],
          expect: 2,
        },
      ]);
    } finally {
      await workspace.dispose();
    }

    // --- Corrupt-session reports (exit 1, SPEC 14.21): a session the
    // product wrote, overwritten with unparseable bytes (shape-independent).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
        },
      },
      async (corruptWorkspace) => {
        await buildOk(product, corruptWorkspace, "T12.0-9 corrupt-arm `build`");
        await runJson(
          product,
          corruptWorkspace,
          [
            "review",
            "create",
            "--strategy",
            "audit",
            "--name",
            "corrupt",
            "--json",
          ],
          "T12.0-9 staging `review create --strategy audit --name corrupt`",
        );
        const sessionRel = ".xspec/reviews/corrupt.json";
        if ((await corruptWorkspace.kind(sessionRel)) !== "file") {
          fail(
            `T12.0-9 staging: \`review create\` must store the session at ` +
              `${sessionRel} (SPEC 10.1) — the corruption arm overwrites the ` +
              `file the product wrote`,
          );
        }
        await corruptWorkspace.file(
          sessionRel,
          "this is not a JSON document {{{\n",
        );
        await runPartitionRows(product, corruptWorkspace, [
          {
            what: "a `review` subcommand naming a corrupt session reports the corruption (SPEC 14.21)",
            argv: ["review", "status", "corrupt"],
            expect: 1,
          },
          {
            what: "`review list` reporting a corrupt session (SPEC 10.7, 14.21)",
            argv: ["review", "list"],
            expect: 1,
          },
        ]);
      },
    );

    // --- Findings (exit 1): failing build and check over invalid sources,
    // and the 11.2 surfaces answering on the same failing workspace — the
    // domain's findings accompany, an id-less section's identity is
    // explicitly unavailable (SPEC 11.2), and each answer is emitted in
    // full beside its exit 1 (`emitsAnswer`).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": [
            '<S id="a" d={"missing"}>',
            "Alpha text.",
            "</S>",
            "",
          ].join("\n"),
          // A parseable section spelling no identity: its 14.1 finding and
          // its explicitly-unavailable identity ride the answers below.
          "specs/U.mdx": [
            "<S>",
            "Section spelling no identity.",
            "</S>",
            "",
          ].join("\n"),
        },
      },
      async (invalidWorkspace) => {
        await runPartitionRows(product, invalidWorkspace, [
          {
            what: "failing `build` (an unresolved reference, SPEC 14.5; a missing ID, SPEC 14.1)",
            argv: ["build"],
            expect: 1,
          },
          {
            what: "`check` findings over the same invalid sources",
            argv: ["check"],
            expect: 1,
          },
          {
            what: "`occurrences` answer carrying the consulted domain's findings — emitted in full (SPEC 11.2, 11.3)",
            argv: ["occurrences"],
            expect: 1,
            emitsAnswer: true,
          },
          {
            what: "`view` answer carrying findings and an explicitly-unavailable identity (the id-less section) — emitted in full (SPEC 11.2, 11.4)",
            argv: ["view"],
            expect: 1,
            emitsAnswer: true,
          },
          {
            what: "`at` answer carrying an explicitly-unavailable identity and its file's finding — emitted in full (SPEC 11.2, 11.5)",
            argv: ["at", "specs/U.mdx", "0"],
            expect: 1,
            emitsAnswer: true,
          },
        ]);
      },
    );

    // --- Wrong-kind operands (exit 2, SPEC 12.0): a code source named where
    // a spec source or a requirement-node identity is required. The premise
    // probe pins `src/app.ts` as discovered: `query edges --from` on it
    // answers an edgeless known graph node with an empty answer, exit 0,
    // where a path in no configured group would be unknown, exit 2 (SPEC
    // 11.1) — so the rows' exit 2 is attributable to operand kind alone.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPEC_AND_CODE_CONFIG,
          "specs/A.mdx": ['<S id="alpha">', "Alpha text.", "</S>", ""].join(
            "\n",
          ),
          // Valid, reference-free TypeScript: discovered through the code
          // group's glob, bearing no requirement nodes (SPEC 7.2).
          "src/app.ts": "export function noop(): void {}\n",
        },
      },
      async (kindWorkspace) => {
        await buildOk(product, kindWorkspace, "T12.0-9 wrong-kind-arm `build`");
        await expectExit(
          product,
          kindWorkspace,
          ["query", "edges", "--from", "src/app.ts"],
          0,
          "T12.0-9 wrong-kind-arm premise `query edges --from src/app.ts` — " +
            "the reference-free code source is discovered, a known graph " +
            "node answering an empty edge set (SPEC 11.1, 7.2), so the " +
            "wrong-kind rows are attributable to operand kind, not to an " +
            "unconfigured path",
        );
        await runPartitionRows(product, kindWorkspace, [
          {
            what: "wrong-kind operand: a code source named where a requirement-node identity is required (`show`, SPEC 12.4, 12.0)",
            argv: ["show", "src/app.ts"],
            expect: 2,
          },
          {
            what: "wrong-kind operand: a code source named where a spec source is required (`view`, SPEC 11.4, 12.0)",
            argv: ["view", "src/app.ts"],
            expect: 2,
          },
        ]);
      },
    );

    // --- Configuration errors (exit 2, SPEC 14.14).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`,
          "specs/A.mdx": ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
        },
      },
      async (configWorkspace) => {
        await expectConfigurationError(
          product,
          configWorkspace,
          ["build"],
          "T12.0-9 `build` under an unknown-key configuration — " +
            "configuration errors are the 2 class (SPEC 14.14, 12.0)",
        );
      },
    );

    // --- Mutual-exclusion refusal (exit 2, SPEC 13.5): while one mutating
    // command holds workspace exclusivity at its `--test-hold` point, a
    // second mutating command is refused as a usage error.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": ['<S id="alpha">', "Alpha text.", "</S>", ""].join(
            "\n",
          ),
        },
      },
      async (holdWorkspace) => {
        await buildOk(product, holdWorkspace, "T12.0-9 exclusion-arm `build`");
        const holdPath = path.join(holdWorkspace.tempRoot, "hold.tmp");
        const holdContext =
          "T12.0-9 `rename specs/A.mdx alpha alpha2 --test-hold <path>`";
        const running = await startProduct(product, {
          cwd: holdWorkspace.root,
          argv: [
            "rename",
            "specs/A.mdx",
            "alpha",
            "alpha2",
            "--test-hold",
            holdPath,
          ],
        });
        try {
          try {
            await running.waitForFile(holdPath);
          } catch (error) {
            fail(
              `${holdContext}: the mutating command creates the hold file ` +
                `immediately after acquiring workspace exclusivity ` +
                `(SPEC 13.5) — ` +
                `${error instanceof Error ? error.message : String(error)}`,
            );
          }
          await expectExit(
            product,
            holdWorkspace,
            ["review", "create", "--strategy", "audit", "--name", "z"],
            2,
            "T12.0-9 `review create --strategy audit --name z` while the " +
              "rename holds exclusivity — a mutating command refused " +
              "because another is running is a usage error, the 2 class " +
              "(SPEC 13.5, 12.0)",
          );
          await releaseHoldFile(holdPath);
          const renameResult = await running.waitForExit();
          assertExitCode(
            renameResult,
            0,
            `${holdContext} — once the hold file is deleted the rename ` +
              `proceeds normally (SPEC 13.5), so the excluded command's ` +
              `exit 2 above is attributable to the exclusion alone`,
          );
        } finally {
          running.kill();
          await releaseHoldFile(holdPath);
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.0-10 — argument-check precedence
// ---------------------------------------------------------------------------

// The precedence pair: a failing workspace and its valid twin, identical in
// everything the six gated argument checks consult — the configuration (a
// spec group, a code group, one coverage profile), the parseable named spec
// source, and the discovered code source with one named unit — differing
// exactly in the unparseable file that makes `build` fail (14.20).
const PRECEDENCE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  coverage: [
    {
      name: "prof",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

const PREC_SPEC_FILE = "specs/A.mdx";
const PREC_CODE_FILE = "src/app.ts";
const PREC_BROKEN_FILE = "specs/Broken.mdx";

const PRECEDENCE_TWIN_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": PRECEDENCE_CONFIG,
  [PREC_SPEC_FILE]: ['<S id="alpha">', "Alpha text.", "</S>", ""].join("\n"),
  [PREC_CODE_FILE]: "export function known(): void {}\n",
};

const PRECEDENCE_FAILING_FILES: Readonly<Record<string, string>> = {
  ...PRECEDENCE_TWIN_FILES,
  // An unclosed section tag: unparseable MDX (14.20), the workspace's one
  // validation finding — staged in a file no gated row names, so every
  // argument check below is judged from consulted state identical to the
  // twin's; only the masking arm names this file, deliberately.
  [PREC_BROKEN_FILE]: ['<S id="broken">', "Text that never closes.", ""].join(
    "\n",
  ),
};

/** One gated-read row: a usage-error argument checked before the 13.3 gate. */
interface GatedUsageRow {
  /** What the row's check consults and why the argument is a usage error. */
  readonly what: string;
  readonly argv: readonly string[];
}

const GATED_USAGE_ROWS: readonly GatedUsageRow[] = [
  {
    what: "an unknown profile, judged against the configuration (SPEC 7.4)",
    argv: ["coverage", "no-such-profile"],
  },
  {
    what:
      "a code group's name where `--group` requires a configured spec " +
      "group's — an invalid flag value (SPEC 11.1)",
    argv: ["query", "nodes", "--group", "app"],
  },
  {
    what: "an unknown session, judged against the session directory (SPEC 10.1)",
    argv: ["review", "status", "no-such-session"],
  },
  {
    what:
      "an unknown id, judged parse-local over the named file's spelled " +
      "identities (SPEC 11.2)",
    argv: ["show", `${PREC_SPEC_FILE}#unspelled`],
  },
  {
    what:
      "a wrong-kind operand — a code source where a requirement-node " +
      "identity is required (SPEC 11.1, 12.0)",
    argv: ["query", "node", PREC_CODE_FILE],
  },
  {
    what:
      "an unknown code unit, judged parse-local over the named file's " +
      "named units (SPEC 4.6)",
    argv: ["query", "edges", "--from", `${PREC_CODE_FILE}#unspelled`],
  },
];

/**
 * Run one usage-error invocation (the caller's argv puts JSON output in
 * effect): exit 2 exactly; stdout exactly the single 12.7 error document —
 * a form with no findings member, so no validation finding rides the error
 * report (SPEC 12.0, 12.7, H-5) — and a nonempty stderr (usage and
 * configuration error messages are standard-error content, their wording
 * free, H-3).
 */
async function expectUsageErrorDocument(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<{ readonly result: RunResult; readonly error: Finding }> {
  const result = await expectExit(product, workspace, argv, 2, context);
  const error = expectErrorDocument(result, context);
  if (result.stderrBytes.length === 0) {
    fail(
      `${context}: usage and configuration error messages are ` +
        `standard-error content (SPEC 12.0), but stderr is empty`,
    );
  }
  return { result, error };
}

// The unknown item ID named by the past-the-gate arm (no session ever
// contains it; harness-prefixed so a collision is impossible by staging).
const PRECEDENCE_NO_SUCH_ITEM = "xspec-harness-no-such-item";

const T12_0_10 = defineProductTest({
  id: "T12.0-10",
  title:
    "argument-check precedence: the rename/move and baseline arms ride on T6.4-4/T6.5-5/T6.3-4; on one workspace failing `build`'s validations each gated read given a usage-error argument exits 2 with that error and reports no validation findings (the exit-2 stdout is exactly the one 12.7 error document) — `coverage <unknown-profile>`, `query nodes --group <code-group>`, `review status <unknown-session>`, `show <file>#<unspelled-id>`, `query node <code-source-path>`, `query edges --from <code-source-path>#<unspelled-unit>` — each check judged from what it consults (configuration; the session directory; parse-local spelled identities or named units of the named file), the same names on a valid twin workspace giving the same exit-2 errors (byte-identical error documents); masking: `show <unparseable-file>#<id>` on the failing workspace yields the gated report of 13.3, exit 1, carrying exactly the workspace's findings; past the gate: on a passing workspace `review resolve <corrupt-session> <any-item-id> --status updated` reports the corruption, exit 1 — the item ID judged only against session content, which the corruption withholds (the same unknown item ID in the well-formed session exits 2 as the pre-corruption premise); within class 2: an unknown command, a repeated flag, and the malformed value `show a#b#c` are reported without loading configuration — byte-identical error documents with the configuration file invalid or missing, each the plain usage error (`code` and `path` null) — while a configuration error precedes every check that consults configuration: `coverage <unknown-profile>` with invalid configuration reports 14.14 (`configuration-error`), not the unknown profile (SPEC 12.0, 13.3, 11.1, 11.2, 4.6, 10.1, 14.14, 14.20, 14.21, 12.7)",
  timeoutMs: 240_000,
  run: async (product) => {
    // --- Gated reads: usage-error arguments precede the 13.3 gate, judged
    // from what they consult, identically on the failing workspace and its
    // valid twin; masking flips `show` on the unparseable file to the gated
    // report.
    await withWorkspace(
      { files: PRECEDENCE_FAILING_FILES },
      async (failing) => {
        await withWorkspace({ files: PRECEDENCE_TWIN_FILES }, async (twin) => {
          // Twin premises: the twin is valid, and every name the rows turn
          // on resolves there — the profile, the spec group, the named
          // file's spelled id, the discovered code source (a known graph
          // node, SPEC 11.1) and its named unit — so each row's exit 2 is
          // attributable to its staged usage error alone.
          await buildOk(product, twin, "T12.0-10 valid-twin `build`");
          const controls: readonly (readonly string[])[] = [
            ["coverage", "prof"],
            ["query", "nodes", "--group", "main"],
            ["show", `${PREC_SPEC_FILE}#alpha`],
            ["query", "edges", "--from", PREC_CODE_FILE],
            ["query", "edges", "--from", `${PREC_CODE_FILE}#known`],
          ];
          for (const argv of controls) {
            await expectExit(
              product,
              twin,
              argv,
              0,
              `T12.0-10 twin control \`${argv.join(" ")}\` — the configured ` +
                `profile, the spec group, the named file's spelled id, and ` +
                `the discovered code source with its named unit all resolve ` +
                `on the valid twin (SPEC 8.2, 11.1, 11.2, 4.6), so each ` +
                `precedence row's exit 2 is attributable to its staged ` +
                `usage error alone`,
            );
          }

          // Failing-workspace premise: the workspace fails `build`'s
          // validations with exactly the staged 14.20 — the finding whose
          // non-appearance the exit-2 rows assert and whose report the
          // masking arm expects.
          const premiseContext =
            "T12.0-10 failing-workspace `build --json` premise";
          const premiseFindings = await buildFindings(
            product,
            failing,
            `${premiseContext} — the staged workspace fails build ` +
              `validation (an unparseable source, SPEC 14.20)`,
          );
          assertConditionCounts(
            premiseFindings,
            { "14.20": 1 },
            `${premiseContext}: the unparseable file is the workspace's ` +
              `one validation finding (SPEC 14, 14.20)`,
          );
          assertFindingLocated(
            premiseFindings[0]!,
            { file: PREC_BROKEN_FILE },
            `${premiseContext}: the 14.20 finding locates the parse ` +
              `failure in the staged unparseable file (SPEC 14, 14.20)`,
          );

          for (const row of GATED_USAGE_ROWS) {
            const argv = [...row.argv, "--json"];
            const command = argv.join(" ");
            const onFailing = await expectUsageErrorDocument(
              product,
              failing,
              argv,
              `T12.0-10 \`${command}\` on the failing workspace — ` +
                `${row.what}: a gated read's argument checks precede the ` +
                `invalid-workspace report of 13.3, so the usage error is ` +
                `reported, exit 2, whatever findings the workspace ` +
                `carries, and no validation finding rides the report ` +
                `(SPEC 12.0, 13.3)`,
            );
            const onTwin = await expectUsageErrorDocument(
              product,
              twin,
              argv,
              `T12.0-10 \`${command}\` on the valid twin — ${row.what}: ` +
                `the same name is the same usage error on a valid ` +
                `workspace (SPEC 12.0)`,
            );
            assertBytesEqual(
              onFailing.result.stdoutBytes,
              onTwin.result.stdoutBytes,
              `T12.0-10 \`${command}\`: the check is judged from what it ` +
                `consults — configuration, the session directory, the ` +
                `named file's parse, identical in both workspaces — ` +
                `identically on valid and failing workspaces, so the same ` +
                `name gives the same exit-2 error document (SPEC 12.0, 14: ` +
                `a plain usage error describes the invocation, never ` +
                `workspace content; H-4's product-to-itself compare)`,
            );
          }

          // Masking: the named file itself is unparseable, so the id check
          // cannot be judged — the gated report of 13.3 takes its place,
          // exit 1 (as in 6.4). The file even contains the bytes
          // `id="broken"`, so a product scraping identities out of the
          // unparseable text and answering (exit 0), or reporting an
          // unknown id (exit 2), fails either way.
          const maskCommand = `show ${PREC_BROKEN_FILE}#broken --json`;
          const maskContext = `T12.0-10 \`${maskCommand}\` (masking)`;
          const maskResult = await expectExit(
            product,
            failing,
            ["show", `${PREC_BROKEN_FILE}#broken`, "--json"],
            1,
            `${maskContext} — an unparseable named file masks the ` +
              `parse-local id check as in 6.4: the gated report of 13.3 is ` +
              `emitted and the command exits 1, never 2 (SPEC 12.0, 13.3, ` +
              `14.20)`,
          );
          const maskFindings = decodeFindingsReport(
            parseJsonStdout(maskResult, maskContext),
            maskContext,
          ).findings;
          assertConditionCounts(
            maskFindings,
            { "14.20": 1 },
            `${maskContext}: the gated report carries exactly the findings ` +
              `a \`build\` would now report — the one unparseable-source ` +
              `condition (SPEC 13.3, 14.20)`,
          );
          assertFindingLocated(
            maskFindings[0]!,
            { file: PREC_BROKEN_FILE },
            `${maskContext}: the 14.20 finding locates the parse failure ` +
              `in the unparseable named file (SPEC 14, 14.20)`,
          );
        });
      },
    );

    // --- Past the gate: an item ID is judged only against session content,
    // which a corrupt session withholds (SPEC 12.0, 10.1, 14.21).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T12.0-10 past-the-gate `build`");
        await runJson(
          product,
          workspace,
          [
            "review",
            "create",
            "--strategy",
            "audit",
            "--name",
            "corrupt",
            "--json",
          ],
          "T12.0-10 staging `review create --strategy audit --name corrupt`",
        );
        const sessionRel = ".xspec/reviews/corrupt.json";
        if ((await workspace.kind(sessionRel)) !== "file") {
          fail(
            `T12.0-10 staging: \`review create\` must store the session at ` +
              `${sessionRel} (SPEC 10.1) — the corruption arm overwrites ` +
              `the file the product wrote`,
          );
        }
        // Premise: with the session well-formed, the unknown item ID stays
        // a usage error (SPEC 10.7, 12.0; T10.7-10's contract) — so the
        // exit-1 flip below is attributable to the corruption withholding
        // the session content the ID would be judged against.
        await expectExit(
          product,
          workspace,
          [
            "review",
            "resolve",
            "corrupt",
            PRECEDENCE_NO_SUCH_ITEM,
            "--status",
            "updated",
          ],
          2,
          "T12.0-10 pre-corruption premise `review resolve corrupt " +
            "<no-such-item> --status updated` — an unknown item ID in a " +
            "well-formed session is a usage error, exit 2 (SPEC 10.7, " +
            "12.0; T10.7-10)",
        );
        await workspace.file(sessionRel, "this is not a JSON document {{{\n");
        const context =
          "T12.0-10 `review resolve corrupt <no-such-item> --status " +
          "updated` (corrupt session)";
        const result = await runCli(product, workspace, [
          "review",
          "resolve",
          "corrupt",
          PRECEDENCE_NO_SUCH_ITEM,
          "--status",
          "updated",
        ]);
        assertExitCode(
          result,
          1,
          `${context} — one check runs past the gate: the item ID is ` +
            `judged only against session content, which the corruption ` +
            `withholds, so the corruption is reported in the check's ` +
            `place, exit 1 — never the well-formed session's exit-2 ` +
            `unknown-item error (SPEC 12.0, 10.1, 14.21)`,
        );
        assertReportMentions(
          result,
          [/corrupt/i],
          `${context} — the report identifies the session as corrupt ` +
            `(SPEC 10.1/14.21 vocabulary; T10.1-4's operationalization: ` +
            `information presence, never exact wording, H-3)`,
        );
      },
    );

    // --- Within class 2: an error the invocation's syntax alone determines
    // is reported without loading configuration — identically with the
    // configuration file invalid or missing — while a configuration error
    // precedes every check that consults configuration (SPEC 12.0, 14.14).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`,
        },
      },
      async (invalidConfig) => {
        await withWorkspace({}, async (missingConfig) => {
          const syntaxRows: readonly {
            readonly what: string;
            readonly argv: readonly string[];
          }[] = [
            {
              what: "an unknown command",
              argv: ["definitely-not-a-command", "--json"],
            },
            {
              what: "a repeated flag",
              argv: ["ids", "--json", "--json"],
            },
            {
              what: "the malformed multi-`#` value (T12.0-13's spelling)",
              argv: ["show", "a#b#c", "--json"],
            },
          ];
          for (const row of syntaxRows) {
            const command = row.argv.join(" ");
            const onInvalid = await expectUsageErrorDocument(
              product,
              invalidConfig,
              row.argv,
              `T12.0-10 \`${command}\` with the configuration file invalid ` +
                `— ${row.what} is determined by the invocation's syntax ` +
                `alone and reported without loading configuration ` +
                `(SPEC 12.0)`,
            );
            const onMissing = await expectUsageErrorDocument(
              product,
              missingConfig,
              row.argv,
              `T12.0-10 \`${command}\` with the configuration file missing ` +
                `— ${row.what} is reported without loading configuration ` +
                `(SPEC 12.0)`,
            );
            for (const [error, state] of [
              [onInvalid.error, "invalid"],
              [onMissing.error, "missing"],
            ] as const) {
              if (error.code !== null || error.path !== null) {
                fail(
                  `T12.0-10 \`${command}\` (configuration ${state}): the ` +
                    `reported error must be the plain usage error — ` +
                    `\`code\` and \`path\` null (SPEC 12.7, 14) — never a ` +
                    `configuration error: the syntax-alone check loads no ` +
                    `configuration (SPEC 12.0); got code ` +
                    `${JSON.stringify(error.code)}, path ` +
                    `${JSON.stringify(error.path)} (message: ` +
                    `${JSON.stringify(error.message)})`,
                );
              }
            }
            assertBytesEqual(
              onInvalid.result.stdoutBytes,
              onMissing.result.stdoutBytes,
              `T12.0-10 \`${command}\`: reported identically with the ` +
                `workspace's configuration file invalid or missing — the ` +
                `error document depends on the invocation's syntax alone, ` +
                `never on configuration state (SPEC 12.0; H-4's ` +
                `product-to-itself compare)`,
            );
          }

          // A configuration error precedes every check that consults
          // configuration or discovery: the unknown-profile check of the
          // gated-read arm, run under invalid configuration, reports 14.14
          // — the stable code `configuration-error`, where the unknown
          // profile's plain usage error carries a null code.
          await expectConfigurationError(
            product,
            invalidConfig,
            ["coverage", "no-such-profile"],
            "T12.0-10 `coverage no-such-profile` with invalid " +
              "configuration — a configuration error precedes every " +
              "argument check that consults configuration or discovery: " +
              "14.14 is reported, not the unknown profile (SPEC 12.0, " +
              "14.14)",
          );
        });
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.0-11 — git is read-only
// ---------------------------------------------------------------------------

const GITRO_FILE = "specs/G.mdx";
const gitroSource = (omegaText: string): string =>
  [
    '<S id="alpha">',
    "Alpha text.",
    "</S>",
    "",
    '<S id="omega">',
    omegaText,
    "</S>",
    "",
  ].join("\n");

/** What a git-reading invocation may write outside `.git/` (T12.0-11). */
interface GitReadOnlyExpectation {
  /** Non-`.git/` keys allowed to change, with the expected change kind. */
  readonly allowed: Readonly<Record<string, "added" | "changed">>;
  /** Keys that MUST appear in the delta (the command's specified writes). */
  readonly required: readonly string[];
}

/**
 * Run one git-reading invocation (exit 0, `--json` parsed) bracketed by
 * whole-workspace byte snapshots: everything under `.git/` byte-identical
 * before and after — same file set, same bytes: refs, HEAD, index, and
 * objects untouched — and no workspace file changed except those the
 * command's own specification writes (SPEC.md preamble; T12.0-11).
 */
async function runGitReadingCommand(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  expectation: GitReadOnlyExpectation,
  context: string,
): Promise<unknown> {
  const before = await snapshotDirectory(workspace.root);
  const result = await runCli(product, workspace, argv);
  assertExitCode(result, 0, context);
  const doc = parseJsonStdout(result, context);
  const after = await snapshotDirectory(workspace.root);
  const changes = diffSnapshots(before, after);
  const gitChanges = changes.filter((change) => isGitKey(change.key));
  if (gitChanges.length > 0) {
    fail(
      `${context}: git data is read only where explicitly stated and never ` +
        `written (SPEC.md preamble) — everything under .git/ must be ` +
        `byte-identical around the invocation (same file set, same bytes: ` +
        `refs, HEAD, index, and objects untouched), but it changed:\n` +
        renderChanges(gitChanges),
    );
  }
  const others = changes.filter((change) => !isGitKey(change.key));
  for (const change of others) {
    const want = expectation.allowed[change.key];
    if (want === undefined || change.change !== want) {
      fail(
        `${context}: no workspace file changes except those the command's ` +
          `own specification writes (T12.0-11; the session file for ` +
          `session-writing commands, nothing for \`impact\` or review ` +
          `reads) — unexpected change:\n${renderChanges([change])}`,
      );
    }
  }
  for (const key of expectation.required) {
    if (!others.some((change) => change.key === key)) {
      fail(
        `${context}: the command's specified write did not land — expected ` +
          `${key} to be ${expectation.allowed[key] ?? "written"} ` +
          `(SPEC 10.1, 10.7)`,
      );
    }
  }
  return doc;
}

const T12_0_11 = defineProductTest({
  id: "T12.0-11",
  title:
    "git is read-only: on a freshly built git fixture, around each git-reading invocation — `impact --base`, `review create --base`, and `review status`/`next`/`resolve` on the resulting baseline session, whose generator runs reconstruct the recorded baseline (6.3, 10.4) — everything under `.git/` is byte-identical before and after (same file set, same bytes: refs, HEAD, index, and objects untouched), and no workspace file changes except those the command's own specification writes: the session file for `create` and `resolve`, nothing for `impact` and the reads (SPEC.md preamble, 12.0)",
  run: async (product) => {
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [GITRO_FILE]: gitroSource("Omega text v1."),
        },
      },
      async (workspace) => {
        await workspace.gitInit();
        const baseRef = await workspace.gitCommitAll("read-only baseline");
        // Edit omega after the commit, so the baseline session derives one
        // unblocked path-blocks item (omega's subtree-coherence item; omega
        // has no non-root ancestor, SPEC 10.5) for `next` and `resolve`.
        await workspace.file(GITRO_FILE, gitroSource("Omega text v2."));
        await buildOk(product, workspace, "T12.0-11 `build` (fresh fixture)");

        await runGitReadingCommand(
          product,
          workspace,
          ["impact", "--base", baseRef, "--json"],
          { allowed: {}, required: [] },
          "T12.0-11 `impact --base <ref> --json`",
        );

        const sessionKey = ".xspec/reviews/pb.json";
        await runGitReadingCommand(
          product,
          workspace,
          ["review", "create", "--base", baseRef, "--name", "pb", "--json"],
          {
            allowed: {
              ".xspec/reviews": "added",
              [sessionKey]: "added",
            },
            required: [sessionKey],
          },
          "T12.0-11 `review create --base <ref> --name pb --json`",
        );

        await runGitReadingCommand(
          product,
          workspace,
          ["review", "status", "pb", "--json"],
          { allowed: {}, required: [] },
          "T12.0-11 `review status pb --json`",
        );

        const nextContext = "T12.0-11 `review next pb --json`";
        const next = decodeNextReport(
          await runGitReadingCommand(
            product,
            workspace,
            ["review", "next", "pb", "--json"],
            { allowed: {}, required: [] },
            nextContext,
          ),
          nextContext,
        );
        if (next.fullyResolved || next.item === undefined) {
          fail(
            `${nextContext}: the staged omega edit derives one unblocked ` +
              `path-blocks item (SPEC 10.5), so \`next\` returns it — ` +
              `needed for the \`resolve\` leg of this test`,
          );
        }

        await runGitReadingCommand(
          product,
          workspace,
          [
            "review",
            "resolve",
            "pb",
            next.item.id,
            "--status",
            "no-change",
            "--json",
          ],
          {
            allowed: { [sessionKey]: "changed" },
            required: [sessionKey],
          },
          "T12.0-11 `review resolve pb <item> --status no-change --json`",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.0-12 — git-less operation
// ---------------------------------------------------------------------------

/**
 * Staging guard: the sweep workspace must sit under no git repository at all
 * (an enclosing repository would mask a product that wrongly requires git).
 * A violation is a harness staging error, not a product observation.
 */
async function assertNoEnclosingGitRepository(startAbs: string): Promise<void> {
  let dir = startAbs;
  for (;;) {
    if (await pathExists(path.join(dir, ".git"))) {
      throw new Error(
        `T12.0-12 staging: ${dir} contains a .git entry — the git-less ` +
          `sweep needs a workspace that is not a git repository and has no ` +
          `enclosing repository (harness staging error)`,
      );
    }
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

const GITLESS_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "prof",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

// alpha (with a child, so its audit item is splittable) depends on omega;
// alpha.kid stays uncovered, so the coverage-strategy session has one item.
const GITLESS_FILE = "specs/A.mdx";
const GITLESS_SOURCE = [
  '<S id="alpha" d={"omega"}>',
  "Alpha intro.",
  "",
  '<S id="alpha.kid">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
  '<S id="omega">',
  "Omega text.",
  "</S>",
  "",
].join("\n");
const GITLESS_ALPHA = "specs/A.mdx#alpha";
const GITLESS_KID = "specs/A.mdx#alpha.kid";

interface GitlessState {
  audKidItemId?: string;
  audAlphaItemId?: string;
  covKidItemId?: string;
}

interface GitlessStep {
  readonly what: string;
  readonly argv: (state: GitlessState) => readonly string[];
  readonly harvest?: (
    doc: unknown,
    state: GitlessState,
    context: string,
  ) => void;
}

/** A harvested id the sweep guarantees is set by the time it is consumed. */
function requireHarvested(value: string | undefined, what: string): string {
  if (value === undefined) {
    throw new Error(
      `T12.0-12 sweep bug: ${what} consumed before it was harvested`,
    );
  }
  return value;
}

// The non-baseline surface (SPEC 12.0): every command below runs to its
// specified outcome — exit 0 at a state its arguments are valid in — with no
// git repository anywhere. Only baseline-taking invocations require git.
const GITLESS_STEPS: readonly GitlessStep[] = [
  { what: "build", argv: () => ["build"] },
  { what: "check", argv: () => ["check"] },
  { what: "ids", argv: () => ["ids"] },
  { what: "show", argv: () => ["show", GITLESS_ALPHA] },
  { what: "coverage", argv: () => ["coverage"] },
  { what: "query node", argv: () => ["query", "node", GITLESS_ALPHA] },
  { what: "query edges", argv: () => ["query", "edges"] },
  // The 11.3–11.6 surfaces answer over the clean domain — complete,
  // finding-free, exit 0 (SPEC 11.2) — and `version` (12.6) is
  // workspace-independent; none consults git. All five are JSON-only
  // surfaces that accept `--json` per T12.0-1, so the sweep's uniform
  // `--json` append holds for them too.
  { what: "occurrences", argv: () => ["occurrences"] },
  { what: "view", argv: () => ["view"] },
  { what: "at", argv: () => ["at", GITLESS_FILE, "0"] },
  { what: "inventory", argv: () => ["inventory"] },
  { what: "version", argv: () => ["version"] },
  {
    what: "review create (audit)",
    argv: () => ["review", "create", "--strategy", "audit", "--name", "aud"],
  },
  { what: "review list", argv: () => ["review", "list"] },
  { what: "review status aud", argv: () => ["review", "status", "aud"] },
  { what: "review next aud", argv: () => ["review", "next", "aud"] },
  {
    what: "review export aud",
    argv: () => ["review", "export", "aud"],
    harvest: (doc, state, context) => {
      const report = decodeExportReport(doc, context);
      state.audKidItemId = findItemId(
        report,
        "subtree-coherence",
        GITLESS_KID,
        context,
      );
      state.audAlphaItemId = findItemId(
        report,
        "subtree-coherence",
        GITLESS_ALPHA,
        context,
      );
    },
  },
  {
    what: "review show aud",
    argv: (state) => [
      "review",
      "show",
      "aud",
      requireHarvested(state.audKidItemId, "the aud kid item id"),
    ],
  },
  {
    what: "review resolve aud",
    argv: (state) => [
      "review",
      "resolve",
      "aud",
      requireHarvested(state.audKidItemId, "the aud kid item id"),
      "--status",
      "no-change",
    ],
  },
  {
    what: "review split aud",
    argv: (state) => [
      "review",
      "split",
      "aud",
      requireHarvested(state.audAlphaItemId, "the aud alpha item id"),
    ],
  },
  {
    what: "review create (coverage)",
    argv: () => ["review", "create", "--coverage", "prof", "--name", "cov"],
  },
  { what: "review status cov", argv: () => ["review", "status", "cov"] },
  { what: "review next cov", argv: () => ["review", "next", "cov"] },
  {
    what: "review export cov",
    argv: () => ["review", "export", "cov"],
    harvest: (doc, state, context) => {
      state.covKidItemId = findItemId(
        decodeExportReport(doc, context),
        "uncovered-requirement",
        GITLESS_KID,
        context,
      );
    },
  },
  {
    what: "review show cov",
    argv: (state) => [
      "review",
      "show",
      "cov",
      requireHarvested(state.covKidItemId, "the cov kid item id"),
    ],
  },
  {
    // `--status updated` re-runs the coverage generator with the recorded
    // profile (SPEC 10.5) — a git-less re-derivation.
    what: "review resolve cov (updated)",
    argv: (state) => [
      "review",
      "resolve",
      "cov",
      requireHarvested(state.covKidItemId, "the cov kid item id"),
      "--status",
      "updated",
    ],
  },
  { what: "review list (both sessions)", argv: () => ["review", "list"] },
  // Each `--preview` invocation performs the real operation's full
  // validation and planning while modifying nothing (SPEC 6.6) — a
  // git-less planning run at the same state as the real operation that
  // follows it, and a successful preview since the real operation
  // proceeds (exit 0, T12.0-9).
  {
    what: "rename --preview",
    argv: () => ["rename", GITLESS_FILE, "omega", "omega2", "--preview"],
  },
  {
    what: "rename",
    argv: () => ["rename", GITLESS_FILE, "omega", "omega2"],
  },
  {
    what: "move --preview",
    argv: () => ["move", GITLESS_FILE, "specs/B.mdx", "--preview"],
  },
  { what: "move", argv: () => ["move", GITLESS_FILE, "specs/B.mdx"] },
];

const T12_0_12 = defineProductTest({
  id: "T12.0-12",
  title:
    "git-less operation: the non-baseline surface — `build`, `check`, `ids`, `show`, `coverage`, `query`, `occurrences`, `view`, `at`, `inventory`, `version`, `rename` and file-form `move` (their `--preview` invocations included), and `review` with the audit and coverage strategies through create/list/status/next/show/split/resolve/export (an `updated` resolve re-running the recorded-profile generator included) — runs to its specified outcomes in a workspace that is not a git repository and has no enclosing repository; only baseline-taking invocations require git (SPEC 12.0, 11.2, 12.6, 6.6, SPEC.md preamble; T10.6-1's git-less audit is one instance)",
  timeoutMs: 240_000,
  run: async (product) => {
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": GITLESS_CONFIG,
          [GITLESS_FILE]: GITLESS_SOURCE,
        },
      },
      async (workspace) => {
        await assertNoEnclosingGitRepository(workspace.root);
        const state: GitlessState = {};
        for (const step of GITLESS_STEPS) {
          const argv = [...step.argv(state), "--json"];
          const context = `T12.0-12 \`${argv.join(" ")}\``;
          const result = await expectExit(
            product,
            workspace,
            argv,
            0,
            `${context} — the ${step.what} step of the git-less sweep runs ` +
              `at a state its arguments are valid in, and no command of the ` +
              `non-baseline surface requires a git repository (SPEC 12.0)`,
          );
          const doc = parseJsonStdout(
            result,
            `${context} — under --json the single JSON document is the ` +
              `entire standard output (SPEC 12.0, H-5)`,
          );
          step.harvest?.(doc, state, context);
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.0-13 — `#` in operands
// ---------------------------------------------------------------------------
//
// SPEC 12.0: `<node>` and `<graph-node>` values are identities in the form of
// 1.5, their `#` splitting path from id or unit, and the split applies
// equally to an operand spelled `<file>#<id>` (6.5); at most one `#` is
// well-formed in any such value — 11.3 pins the same bound for `--to` — so a
// spelling containing more than one `#` is a malformed value, a usage error,
// and the split is never ambiguous. A bare `<file>` operand and a `--file`
// glob are instead a whole path or pattern: `#` has no delimiter role in
// them, so a `#`-containing spelling names the discovered file of that
// invalid path (14.19, 11.4), never a `path#id` pair.
//
// One workspace serves both halves: valid `specs/OK.mdx` (the move origin
// and valid-side contrast) beside `specs/a#b.mdx` — the entry's literal
// name, its content deliberately condition-free (well-formed unique id `pa`,
// multi-byte prose prefix shifting every later byte offset, SPEC 1.7) so the
// staging premise `build --json` reports EXACTLY one 14.19 and every later
// observation is attributable to the path alone. The workspace failing
// `build` is itself load-bearing twice over: the malformed-value exit 2 must
// precede the gated report (12.0 — argument checks precede the invalid-
// workspace report), and a product that instead splits `specs/a#b.mdx#pa`
// at the last `#` finds a discovered file whose spelled identities include
// `pa`, passes its parse-local argument check, and answers the gated report
// exit 1 — the sharpest observable divergence from the required exit 2.
// The `--file` control `specs/zz#*` (a `#`-containing pattern matching
// nothing) pins the other side: the empty admitted set is an empty,
// finding-free answer, exit 0 (11.3), so the exit-1-with-14.19 answer on
// `specs/a#*` is attributable to the pattern MATCHING the invalid path.

/**
 * Running byte-offset fixture assembler (the T5.7-2/T1.7-2 discipline;
 * the module-local class of section-11.2/-11.4/-11.5): `add` appends a
 * segment and returns its byte range, `attr` an attribute segment as the
 * expected `{name, range, text}` view entry (SPEC 11.4). Every expected
 * offset is composed from the same parts the staged file is.
 */
class ByteFixture {
  private readonly parts: string[] = [];
  private bytes = 0;

  get pos(): number {
    return this.bytes;
  }

  get source(): string {
    return this.parts.join("");
  }

  add(segment: string): SourceRange {
    const start = this.bytes;
    this.parts.push(segment);
    this.bytes += Buffer.byteLength(segment, "utf8");
    return { start, end: this.bytes };
  }

  attr(name: string, text: string): ViewAttributeEntry {
    return { name, range: this.add(text), text };
  }
}

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

/** Fixture self-check (T5.7-2 discipline): a claimed range slices the staged bytes to exactly `expected` — before the product is ever invoked. */
function sliceCheck(
  source: string,
  range: SourceRange,
  expected: string,
  what: string,
): void {
  const actual = Buffer.from(source, "utf8")
    .subarray(range.start, range.end)
    .toString("utf8");
  if (actual !== expected) {
    throw new Error(
      `section-12.0-ii fixture self-check: ${what} — expected the range ` +
        `[${String(range.start)}, ${String(range.end)}) to slice to ` +
        `${JSON.stringify(expected)}, got ${JSON.stringify(actual)}; the ` +
        `staging arithmetic is wrong (harness defect, not a product result)`,
    );
  }
}

// --- specs/OK.mdx — valid path: the move origin and valid-side contrast -----
const H13_OK_FILE = "specs/OK.mdx";
const H13_OK_SOURCE = ['<S id="ok">', "Anchor text.", "</S>", ""].join("\n");

// --- specs/a#b.mdx — the `#`-containing discovered spec source (14.19) ------
// The path is the file's ONLY defect: `pa` is well-formed, unique, and
// structurally valid, so the premise `build` reports exactly one 14.19. The
// section deliberately spells `pa` so the multi-`#` operand
// `specs/a#b.mdx#pa` below is a last-`#`-split trap: both split halves name
// real staged things, and only rejecting the value gives exit 2.
const H13_FILE = "specs/a#b.mdx";
const H13 = new ByteFixture();
H13.add("Ancré — préfixe multi-octets.\n\n");
const H13_PA_START = H13.pos;
H13.add("<S ");
const H13_PA_ID = H13.attr("id", 'id="pa"');
H13.add(">\nHash-path text.\n</S>");
const H13_PA_RANGE: SourceRange = { start: H13_PA_START, end: H13.pos };
H13.add("\n");
const H13_SOURCE = H13.source;
const H13_ROOT_RANGE: SourceRange = { start: 0, end: H13.pos };

/**
 * The asserted projection of the 14.19 finding (SPEC 14, 12.7): the stable
 * code token, the empty locations of a path-level condition, and the
 * concerned path. Message and identities stay unpinned (informational).
 */
interface PathFindingExpectation {
  readonly code: string | null;
  readonly locations: readonly unknown[];
  readonly path: PathValue | null;
}

function projectPathFinding(finding: Finding): PathFindingExpectation {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

const H13_19: PathFindingExpectation = {
  code: "invalid-source-path",
  locations: [],
  path: H13_FILE,
};

/**
 * One malformed multi-`#` operand invocation (SPEC 12.0): run with `--json`,
 * assert exit 2 exactly — reported whatever findings the workspace carries
 * (the argument checks precede the gated report and source validation,
 * 12.0) — the single 12.7 error document as the entire stdout (no report, no
 * validation findings; H-5), and a usage error message on stderr (presence,
 * not wording — H-3).
 */
async function expectMalformedOperandError(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<void> {
  const rendered = ["xspec", ...argv, "--json"].join(" ");
  const result = await runCli(product, workspace, [...argv, "--json"]);
  assertExitCode(
    result,
    2,
    `${context}: \`${rendered}\` — a value containing more than one \`#\` ` +
      `is a malformed value, a usage error: exit 2, whatever findings the ` +
      `workspace carries (SPEC 12.0)`,
  );
  expectErrorDocument(
    result,
    `${context}: \`${rendered}\` — with JSON output in effect, the exit-2 ` +
      `error document is the entire stdout: the malformed value emits no ` +
      `report and no validation findings (SPEC 12.0, 12.7, H-5)`,
  );
  if (result.stderrBytes.length === 0) {
    fail(
      `${context}: \`${rendered}\` — usage error messages are ` +
        `standard-error content (SPEC 12.0), but stderr is empty`,
    );
  }
}

/** The malformed spellings: the entry's literal, and the last-`#`-split trap. */
const H13_MULTI_HASH_VALUES: readonly { value: string; trap: string }[] = [
  {
    value: "a#b#c",
    trap: "the entry's literal spelling — no staged interpretation",
  },
  {
    value: `${H13_FILE}#pa`,
    trap:
      "the last-`#` split names the discovered file specs/a#b.mdx plus its " +
      "spelled id `pa`, so an accepting product proceeds and answers exit 1 " +
      "on this failing workspace",
  },
];

/**
 * The tree projection the view arm pins (T11.2-1's named clauses): per node,
 * the identity datum (the 11.2 three-state), the construct range (1.7), the
 * raw attribute entries as parsed, and the children in document order. The
 * opening/closing decompositions and interpreted tags/coverage stay outside
 * (T11.4-1, T11.2-2/T11.4-3 pin those); the form-exact decode has already
 * validated their forms.
 */
interface ViewTreeExpectation {
  readonly identity: string | { readonly unavailable: true };
  readonly range: SourceRange;
  readonly attributes: readonly ViewAttributeEntry[];
  readonly children: readonly ViewTreeExpectation[];
}

function projectViewNode(node: ViewNode): ViewTreeExpectation {
  return {
    identity: node.identity,
    range: node.range,
    attributes: node.attributes.map((entry) => ({
      name: entry.name,
      range: entry.range,
      text: entry.text,
    })),
    children: node.children.map(projectViewNode),
  };
}

const T12_0_13 = defineProductTest({
  id: "T12.0-13",
  title:
    "`#` in operands: a `<node>`, `<graph-node>`, `--to`, or move-operand value containing more than one `#` (the literal `a#b#c`, and `specs/a#b.mdx#pa` — whose last-`#` split would name a discovered file plus a spelled id) is a malformed value — exit 2 with the single 12.7 error document on `show`, `query node`, `occurrences --to`, and `move` (origin and destination operands alike, the destination the T6.5-4 dead-letter spelling — `#` in the section form's target-file part; each move wrapped in a whole-root modifies-nothing compare), the usage error preceding the failing workspace's findings; a bare `<file>` operand or `--file` glob is a whole path or pattern with no delimiter role for `#`: with `specs/a#b.mdx` discovered (condition 19 — the staging premise `build --json` fails with exactly that one pinned 14.19, modifying nothing), `view specs/a#b.mdx` names the discovered file — membership holds: exactly its one per-file view, tree and ranges on view with every node identity explicitly unavailable, its condition-19 finding accompanying, exit 1 — never a `specs/a` + `b.mdx` pair (which would be exit 2, unknown file); `at specs/a#b.mdx 0` resolves the same way (the root construct, identity unavailable, no containing occurrence); and `occurrences --file specs/a#*` matches it as a pattern — domain membership proven by the accompanying 14.19, exit 1, against the matching-nothing control `specs/zz#*` (empty, finding-free, exit 0) (SPEC 12.0, 11.2-11.5, 12.7, 14)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline): composed ranges sliced back
    // out of the staged bytes before any product invocation.
    sliceCheck(
      H13_SOURCE,
      H13_PA_RANGE,
      '<S id="pa">\nHash-path text.\n</S>',
      "the pa section construct",
    );
    sliceCheck(
      H13_SOURCE,
      H13_PA_ID.range,
      H13_PA_ID.text,
      "pa's id attribute",
    );
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [H13_OK_FILE]: H13_OK_SOURCE,
        [H13_FILE]: H13_SOURCE,
      },
    });
    try {
      // --- Staging premise: `build --json` fails with EXACTLY one 14.19 —
      // the content of both files stages no other condition, so the path is
      // the sole defect — the finding pinned (stable code, no in-source
      // locations, the file as concerned path; SPEC 14, 12.7), and a
      // failing build modifies nothing (SPEC 12.1).
      const buildContext =
        "T12.0-13 `build --json` (staging premise: the `#` path is the " +
        "workspace's one defect)";
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          const result = await expectExit(
            product,
            workspace,
            ["build", "--json"],
            1,
            buildContext,
          );
          const findings = decodeFindingsReport(
            parseJsonStdout(result, buildContext),
            buildContext,
          ).findings;
          assertConditionCounts(
            findings,
            { "14.19": 1 },
            `${buildContext} — exactly one condition-19 finding for the ` +
              `discovered \`#\` path and nothing else: both files' content ` +
              `is condition-free (SPEC 14.19)`,
          );
          assertSameJson(
            findings.map(projectPathFinding),
            [H13_19],
            `${buildContext} — the finding carries the stable code ` +
              `"invalid-source-path", no in-source locations (a path-level ` +
              `condition), and the offending file as its concerned path ` +
              `(SPEC 14, 12.7)`,
          );
        },
        `${buildContext} — a failing build modifies nothing (SPEC 12.1)`,
      );

      // --- Malformed multi-`#` values: exit 2 on `show`, `query node`, and
      // `occurrences --to` (SPEC 12.0; 11.3 pins the `--to` bound — a lax
      // product reading the spelling as well-formed selects the empty set
      // and answers exit 1 with the domain's findings, never 2).
      for (const spelling of H13_MULTI_HASH_VALUES) {
        const rows: readonly { argv: readonly string[]; what: string }[] = [
          {
            argv: ["show", spelling.value],
            what: "`show <node>`",
          },
          {
            argv: ["query", "node", spelling.value],
            what: "`query node <node>`",
          },
          {
            argv: ["occurrences", "--to", spelling.value],
            what: "`occurrences --to <node>`",
          },
        ];
        for (const row of rows) {
          await expectMalformedOperandError(
            product,
            workspace,
            row.argv,
            `T12.0-13 ${row.what}, value ${JSON.stringify(spelling.value)} ` +
              `(${spelling.trap})`,
          );
        }
      }

      // --- Malformed multi-`#` move operands (SPEC 12.0, 6.5): the
      // destination arm is T6.5-4's dead letter realized — a `#` in the
      // section form's target-file part makes a two-`#` operand — and an
      // accepting product's last-`#` split names the discovered
      // specs/a#b.mdx as target file (or as origin), proceeds, and answers
      // exit 1 (the invalid-workspace refusal) or worse, writes; each arm
      // rides a whole-root modifies-nothing compare.
      const moveRows: readonly {
        readonly argv: readonly string[];
        readonly what: string;
      }[] = [
        {
          argv: ["move", `${H13_OK_FILE}#ok`, `${H13_FILE}#pa`],
          what:
            "destination operand with two `#` (the T6.5-4 dead-letter " +
            "spelling: `#` in the section form's target-file part)",
        },
        {
          argv: [`move`, `${H13_FILE}#pa`, `${H13_OK_FILE}#zz`],
          what: "origin operand with two `#`",
        },
      ];
      for (const row of moveRows) {
        const context = `T12.0-13 \`move\`, ${row.what}`;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            await expectMalformedOperandError(
              product,
              workspace,
              row.argv,
              context,
            );
          },
          `${context} — a usage error modifies nothing (SPEC 6.5, 12.0)`,
        );
      }

      // --- `view specs/a#b.mdx`: a bare `<file>` operand is a whole path —
      // the `#`-containing spelling names the DISCOVERED file, so
      // membership holds (never a `specs/a` + `b.mdx` pair, which would be
      // exit 2, unknown file): exactly its one per-file view is served,
      // structure on view, every node identity explicitly unavailable, its
      // condition-19 finding accompanying, exit 1 (SPEC 12.0, 11.4, 11.2).
      const viewContext = `T12.0-13 \`view ${H13_FILE}\``;
      const viewResult = await runCli(product, workspace, ["view", H13_FILE]);
      assertExitCode(
        viewResult,
        1,
        `${viewContext} — the \`#\`-containing operand names the ` +
          `discovered file (membership holds, never an unknown-file exit ` +
          `2), and the answer carries its finding and unavailable ` +
          `identities: exit 1 with the full document (SPEC 12.0, 11.4, 11.2)`,
      );
      const viewReport = decodeViewReport(
        parseJsonStdout(
          viewResult,
          `${viewContext} — a single JSON document is the only output ` +
            `form, with or without --json (SPEC 11)`,
        ),
        { text: false },
        viewContext,
      );
      assertSameJson(
        viewReport.findings.map(projectPathFinding),
        [H13_19],
        `${viewContext} — the consulted domain is the requested file ` +
          `alone: exactly its condition-19 finding accompanies (SPEC 11.2, ` +
          `11.4)`,
      );
      assertSameJson(
        viewReport.views.map((view) => view.file),
        [H13_FILE],
        `${viewContext} — exactly one per-file view, for the requested ` +
          `\`#\` path presented as the whole workspace-relative path ` +
          `(SPEC 11.4, 12.0)`,
      );
      const h13View = viewReport.views[0]!;
      assertSameJson(
        projectViewNode(h13View.root),
        {
          identity: UNAVAILABLE,
          range: H13_ROOT_RANGE,
          attributes: [],
          children: [
            {
              identity: UNAVAILABLE,
              range: H13_PA_RANGE,
              attributes: [H13_PA_ID],
              children: [],
            },
          ],
        },
        `${viewContext} — the invalid-path file keeps its full positional ` +
          `tree with byte-exact construct ranges and raw attribute entries ` +
          `while every node identity, root included, is explicitly ` +
          `unavailable (SPEC 11.2, 1.5)`,
      );
      assertSameJson(
        [h13View.imports, h13View.occurrences, h13View.comments],
        [[], [], []],
        `${viewContext} — the file holds no imports, occurrences, or ` +
          `comments: empty arrays, never null (SPEC 12.7)`,
      );

      // --- `at specs/a#b.mdx 0` resolves the same way (SPEC 11.5): the
      // operand names the discovered file; offset 0 lies in the prose
      // before any section, so the innermost enclosing construct is the
      // ROOT, its identity explicitly unavailable; no containing
      // occurrence; exactly the file's own finding; exit 1.
      const atContext = `T12.0-13 \`at ${H13_FILE} 0\``;
      const atResult = await runCli(product, workspace, ["at", H13_FILE, "0"]);
      assertExitCode(
        atResult,
        1,
        `${atContext} — the \`<file>\` operand asserts membership exactly ` +
          `as a view operand does; the answer carries the file's finding ` +
          `and an unavailable identity: exit 1 (SPEC 11.5, 11.2, 12.0)`,
      );
      const atReport = decodeAtReport(
        parseJsonStdout(
          atResult,
          `${atContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        atContext,
      );
      assertSameJson(
        atReport.findings.map(projectPathFinding),
        [H13_19],
        `${atContext} — the consulted domain is the named file alone: ` +
          `exactly its condition-19 finding (SPEC 11.2, 11.5)`,
      );
      assertSameJson(
        atReport.resolution,
        {
          section: { identity: UNAVAILABLE, range: H13_ROOT_RANGE },
          occurrence: null,
        },
        `${atContext} — offset 0 (prose) resolves to the root construct, ` +
          `its identity explicitly unavailable, within no occurrence ` +
          `(SPEC 11.5, 11.2)`,
      );

      // --- `occurrences --file specs/a#*` matches the file as a PATTERN
      // (SPEC 12.0, 11.3, 7): `#` is a literal glob byte, `*` any run of
      // bytes within the segment, so the admitted set is {specs/a#b.mdx} —
      // proven by the accompanying condition-19 finding (a finding is a
      // domain file's exactly when that file is its concerned path, 11.2) —
      // while the control pattern admits the empty set: an empty,
      // finding-free answer, exit 0 (11.3), pinning that the exit-1 answer
      // is attributable to the pattern MATCHING the `#` path.
      const occContext = `T12.0-13 \`occurrences --file specs/a#*\``;
      const occResult = await runCli(product, workspace, [
        "occurrences",
        "--file",
        "specs/a#*",
      ]);
      assertExitCode(
        occResult,
        1,
        `${occContext} — the pattern matches the discovered \`#\` path ` +
          `(no delimiter role in a --file glob), whose finding accompanies ` +
          `the answer: exit 1 (SPEC 12.0, 11.3, 11.2)`,
      );
      const occReport = decodeOccurrencesReport(
        parseJsonStdout(
          occResult,
          `${occContext} — a single JSON document is the only output form ` +
            `(SPEC 11)`,
        ),
        occContext,
      );
      assertSameJson(
        occReport.findings.map(projectPathFinding),
        [H13_19],
        `${occContext} — the admitted set is exactly {${H13_FILE}}: its ` +
          `condition-19 finding accompanies, and no other file's finding ` +
          `can (SPEC 11.2, 11.3)`,
      );
      assertSameJson(
        occReport.occurrences,
        [],
        `${occContext} — the file spells no references: an empty ` +
          `enumeration, [] never null (SPEC 11.3, 12.7)`,
      );
      const ctrlContext = `T12.0-13 \`occurrences --file specs/zz#*\` (control)`;
      const ctrlResult = await runCli(product, workspace, [
        "occurrences",
        "--file",
        "specs/zz#*",
      ]);
      assertExitCode(
        ctrlResult,
        0,
        `${ctrlContext} — a \`#\`-containing pattern matching nothing ` +
          `admits the empty set: an empty, finding-free answer, exit 0 — ` +
          `never an unknown-file usage error (SPEC 11.3)`,
      );
      assertSameJson(
        decodeOccurrencesReport(
          parseJsonStdout(
            ctrlResult,
            `${ctrlContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          ctrlContext,
        ),
        { findings: [], occurrences: [] },
        `${ctrlContext} — empty and finding-free: the empty admitted set ` +
          `consults no file (SPEC 11.3, 11.2)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

export const section120iiTests: readonly ProductTestEntry[] = [
  T12_0_7,
  T12_0_8,
  T12_0_9,
  T12_0_10,
  T12_0_11,
  T12_0_12,
  T12_0_13,
];
