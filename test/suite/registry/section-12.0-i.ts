// TEST-SPEC §12.0 I (global command conventions) — SUITE-41: T12.0-1 … T12.0-6.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes and stream separation (H-5), and rejects a product
// only via diagnosed assertion failures (H-8).
//
// SPEC 12.0: every command supports `--json` (one JSON document as the entire
// stdout; an exit-2 error emits the 12.7 error document as that document,
// while exit-2 stdout is empty only when JSON output is NOT in effect) and
// `--config <path>` (a filesystem path resolved against the working
// directory); reports — findings included — are stdout content while usage
// and configuration error messages and all other diagnostic text are stderr
// content; a flag may be given at most once per invocation and list-valued
// flags take one comma-separated value; node/graph-node/file/glob arguments
// are workspace-relative in the form of 1.5, independent of the working
// directory, while `--test-hold <path>` resolves against the working
// directory (13.5); argument values are interpreted as UTF-8 and a non-UTF-8
// value is a usage error; IDs, tags, identities, session names, and paths
// compare byte-wise and case-sensitively with no Unicode normalization or
// case folding anywhere (10.1's create-time session-name restriction is the
// sole exception).
//
// The full-surface sweep (T12.0-1, T12.0-3, T12.0-4) drives every command and
// subcommand this specification covers over one evolving fixture story:
// build, check, ids, show, coverage, impact, the six query subcommands,
// occurrences, view, at, inventory, version, the eight review subcommands,
// rename, and file-form move — mutations last, so every step runs at a state
// its arguments are valid in.
//
// Conservative operationalizations (noted per H-3/H-4):
// - T12.0-1 asserts, per command, the specified exit code and that the entire
//   stdout parses as exactly one JSON document; information parity with the
//   human report is adapter-verified by the per-command tests in the sections
//   above (the test's own text delegates it there).
// - T12.0-1's JSON-only parity arms: the JSON-only surfaces of 10.7, 11, and
//   12.6 — review export; the query subcommands, occurrences, view, at, and
//   inventory; version — emit the same single document with the flag as
//   without. Each such step (all reads, so rerunnable) is rerun without
//   `--json` at the same story state, asserting the same exit code (0), a
//   single JSON document as the entire stdout (H-5's JSON-only clause), and
//   that the two decoded documents carry the same information: deep
//   equality of the parsed documents with array order significant and
//   object key order not (key order is formatting, not information).
//   Byte-identity across the flagged/flag-less pair is NOT asserted —
//   TEST-SPEC §11: SPEC.md does not require it, and H-4/H-6 license byte
//   comparison only across identical invocations, which a flagged and a
//   flag-less run are not.
// - T12.0-4 doubles `--config` with an identical value across the whole sweep
//   — a repetition regardless of value, and the strictest probe (it fails a
//   product that dedupes repeated identical values). Each doubled run's argv
//   minus one repetition is exactly the paired normal step that follows, so
//   exit 2 is attributable to the repetition alone. The repeated-`--json` arm
//   asserts the exit code only: whether that ill-formed invocation still
//   counts as "under --json" for the empty-stdout rule is exactly what is
//   ill-formed about it, so the arm does not over-assert the stream.
// - T12.0-2 asserts non-empty stderr on the exit-2 arms (the test's own text:
//   usage/configuration errors *print diagnostics* to standard error) and
//   leaves stderr unasserted on the exit-1 arms (12.0 lets diagnostic text
//   ride stderr beside a stdout report). Its stderr-invariance arms compare
//   stderr bytes across the two output forms of one invocation (H-4,
//   product-to-itself): 12.0 — the output form never changes an exit code or
//   standard-error content. Exit-2 arms with `--json` decode the 12.7 error
//   document (12.0); the human exit-2 arms assert byte-empty stdout (JSON
//   not in effect).
// - T12.0-5 uses exit 0 from a subdirectory as the resolution observable for
//   `<node>`/`<graph-node>`/`<file>` arguments — resolved against the cwd
//   each would name a nonexistent file and exit 2 — and content for `--file`,
//   where a glob matching nothing is a valid empty restriction that exit
//   codes cannot discriminate. Its malformed-value table (U+FFFD in every
//   argument position; the non-UTF-8 bytes on the Linux leg) runs through
//   the shared syntax-class discipline (`expectSyntaxClassUsageError`,
//   T12.0-10: the plain usage error, byte-identical with the configuration
//   invalid or missing) ahead of the `show`/`view` normalization negatives,
//   so a product normalizing `./` or `//` spellings fails at those after
//   the value-level arms have run.
//   The positive side of the backslash (Linux leg, gated inside the body
//   beside the non-UTF-8 arm, so the Windows leg reruns the entry and
//   skips no arm, E-6) closes the body over two workspaces of its own,
//   created after the first invocation, so every file they stage is a
//   staged-source record (S-9): a code side — `occurrences --file` over
//   `src/a`, backslash, `b.ts` beside `src/ab.ts`, after a `src/*.ts`
//   control showing both discovered, each marking its node — and a spec
//   side — `view` and `at … 0` over the invalid-path `specs/a`,
//   backslash, `b.mdx`, pinned as T12.0-13 pins its `#` path (exactly
//   the condition-19 finding; identities unavailable, ranges on view).
// - T12.0-6 stages the two-casing tree (`specs/A.mdx` beside `specs/a.mdx`)
//   on Linux only — such trees exist only on case-sensitive filesystems (the
//   suite leg is Linux); the single-casing probe, tag, ID, and session-name
//   arms are platform-portable, and CI-01 reruns the probe on the Windows
//   leg (E-6).

import { Buffer } from "node:buffer";
import {
  assertReportMentions,
  decodeAtReport,
  decodeExportReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeNodeReport,
  decodeNodeRowsReport,
  decodeOccurrencesReport,
  decodeReachableReport,
  decodeViewReport,
} from "../../helpers/adapters/index.js";
import type {
  Finding,
  OccurrenceRecord,
  SourceRange,
  ViewNode,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  assertStdoutEmpty,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import {
  releaseHoldFile,
  runProduct,
  startProduct,
} from "../../helpers/subprocess.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { stagedTs } from "../../helpers/staged-ts.js";
import type { StagedTs } from "../../helpers/staged-ts.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import {
  REPLACEMENT_CHARACTER,
  REPLACEMENT_CHARACTER_SPEC_PATH,
  assertSameJson,
  buildOk,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  expectPlainUsageError,
  expectSyntaxClassUsageError,
  runCli,
  runJson,
  sortedIdentities,
  stageConfigurationStateTwins,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group. A
// TypeScript staged-source record (helpers/staged-ts.ts; S-9's TypeScript
// and timing clauses), staged wherever it is used: T12.0-2's, T12.0-3's,
// and T12.0-6's later workspaces stage it after a product invocation.
const SPECS_ONLY_CONFIG = stagedTs(
  "T12.0-2/T12.0-3/T12.0-6 xspec.config.ts — one spec group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

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

/** Diagnosed non-empty-stderr assertion (T12.0-2: diagnostics are printed). */
function assertStderrNonEmpty(result: RunResult, context: string): void {
  if (result.stderrBytes.length > 0) return;
  fail(
    `${context}: usage and configuration error messages are standard-error ` +
      `content (SPEC 12.0), and the diagnostics must actually be printed — ` +
      `stderr is empty (exit code ${String(result.exitCode)}, stdout ` +
      `${String(result.stdoutBytes.length)} bytes)`,
  );
}

// ---------------------------------------------------------------------------
// The full-surface sweep story (T12.0-1, T12.0-3, T12.0-4)
// ---------------------------------------------------------------------------

// One spec group plus one coverage profile, so `coverage` runs over a real
// profile (target and boundary are the same unambiguous spec group, so
// `boundaryKind` is inferred; SPEC 7.4).
const SWEEP_CONFIG = `import { defineConfig } from "xspec"

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

// alpha (with a child, so its audit item is splittable) depends on omega
// (tagged, and directly covered through the boundary edge alpha → omega).
const SWEEP_FILE = "specs/A.mdx";
const SWEEP_SOURCE = [
  '<S id="alpha" d={"omega"}>',
  "Alpha intro.",
  "",
  '<S id="alpha.kid">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
  '<S id="omega" tags="keep">',
  "Omega text.",
  "</S>",
  "",
].join("\n");
const SWEEP_ALPHA = "specs/A.mdx#alpha";
const SWEEP_KID = "specs/A.mdx#alpha.kid";
const SWEEP_OMEGA = "specs/A.mdx#omega";
const SWEEP_SESSION = "sweep";

/** Mutable per-story state: the baseline ref and harvested item ids. */
interface SweepState {
  /** Commit hash of the staged sources (the `impact --base` argument). */
  readonly baseRef: string;
  /** Audit item scoped to alpha.kid, harvested from `review export`. */
  kidItemId?: string;
  /** Audit item scoped to alpha (a node with a child, so `split` applies). */
  alphaItemId?: string;
}

interface SweepStep {
  /** Command summary for diagnoses (e.g. "review export"). */
  readonly what: string;
  /** The step's argv, without `--json` or sweep-wide extra flags. */
  readonly argv: (state: SweepState) => readonly string[];
  /** Harvest from the step's decoded `--json` document. */
  readonly harvest?: (doc: unknown, state: SweepState, context: string) => void;
  /**
   * The step drives a JSON-only surface (SPEC 10.7, 11, 12.6): a single JSON
   * document is its only output form, with or without `--json`. T12.0-1's
   * parity arm reruns the step without the flag and asserts the same single
   * document (same information; byte-identity not asserted — see the module
   * header).
   */
  readonly jsonOnly?: true;
}

/** A harvested id the story guarantees is set by the time it is consumed. */
function requireHarvested(value: string | undefined, what: string): string {
  if (value === undefined) {
    // The export step harvests or fails diagnosed before any consumer runs,
    // so a missing id here is a harness sequencing bug, not a product
    // observation.
    throw new Error(
      `sweep story bug: ${what} consumed before it was harvested`,
    );
  }
  return value;
}

function harvestItemIds(
  doc: unknown,
  state: SweepState,
  context: string,
): void {
  const report = decodeExportReport(doc, context);
  const itemScopedTo = (identity: string): string => {
    const item = report.items.find(
      (candidate) =>
        candidate.kind === "subtree-coherence" &&
        candidate.scope.node === identity,
    );
    if (item === undefined) {
      fail(
        `${context}: an audit session contains one subtree-coherence item ` +
          `per requirement node (SPEC 10.6), so an item scoped to ` +
          `${identity} must exist — the sweep needs its id for the ` +
          `\`review show\`/\`resolve\`/\`split\` steps; got items scoped to ` +
          `${JSON.stringify(report.items.map((candidate) => candidate.scope.node))}`,
      );
    }
    return item.id;
  };
  state.kidItemId = itemScopedTo(SWEEP_KID);
  state.alphaItemId = itemScopedTo(SWEEP_ALPHA);
}

// Every command and subcommand this specification covers, in one evolving
// story (mutations last). Every step exits 0 — the informational-success
// class of 12.0 — and emits exactly one JSON document under `--json`.
const SWEEP_STEPS: readonly SweepStep[] = [
  { what: "build", argv: () => ["build"] },
  { what: "check", argv: () => ["check"] },
  { what: "ids", argv: () => ["ids"] },
  { what: "show", argv: () => ["show", SWEEP_ALPHA] },
  { what: "coverage", argv: () => ["coverage"] },
  { what: "impact", argv: (state) => ["impact", "--base", state.baseRef] },
  {
    what: "query node",
    argv: () => ["query", "node", SWEEP_ALPHA],
    jsonOnly: true,
  },
  { what: "query nodes", argv: () => ["query", "nodes"], jsonOnly: true },
  { what: "query edges", argv: () => ["query", "edges"], jsonOnly: true },
  {
    what: "query subtree",
    argv: () => ["query", "subtree", SWEEP_ALPHA],
    jsonOnly: true,
  },
  {
    what: "query ancestors",
    argv: () => ["query", "ancestors", SWEEP_KID],
    jsonOnly: true,
  },
  {
    what: "query reachable",
    argv: () => [
      "query",
      "reachable",
      "--from",
      SWEEP_ALPHA,
      "--to",
      SWEEP_OMEGA,
    ],
    jsonOnly: true,
  },
  // The JSON-only read surfaces of SPEC 11.3–11.6 and 12.6 — clean-domain
  // invocations over the valid story workspace, so each is a complete,
  // finding-free answer, exit 0 (11.2, 11.6, 12.6).
  { what: "occurrences", argv: () => ["occurrences"], jsonOnly: true },
  { what: "view", argv: () => ["view"], jsonOnly: true },
  { what: "at", argv: () => ["at", SWEEP_FILE, "0"], jsonOnly: true },
  { what: "inventory", argv: () => ["inventory"], jsonOnly: true },
  { what: "version", argv: () => ["version"], jsonOnly: true },
  {
    what: "review create",
    argv: () => [
      "review",
      "create",
      "--strategy",
      "audit",
      "--name",
      SWEEP_SESSION,
    ],
  },
  { what: "review list", argv: () => ["review", "list"] },
  { what: "review status", argv: () => ["review", "status", SWEEP_SESSION] },
  { what: "review next", argv: () => ["review", "next", SWEEP_SESSION] },
  {
    what: "review export",
    argv: () => ["review", "export", SWEEP_SESSION],
    harvest: harvestItemIds,
    jsonOnly: true,
  },
  {
    what: "review show",
    argv: (state) => [
      "review",
      "show",
      SWEEP_SESSION,
      requireHarvested(state.kidItemId, "the alpha.kid item id"),
    ],
  },
  {
    what: "review resolve",
    argv: (state) => [
      "review",
      "resolve",
      SWEEP_SESSION,
      requireHarvested(state.kidItemId, "the alpha.kid item id"),
      "--status",
      "no-change",
    ],
  },
  {
    what: "review split",
    argv: (state) => [
      "review",
      "split",
      SWEEP_SESSION,
      requireHarvested(state.alphaItemId, "the alpha item id"),
    ],
  },
  { what: "rename", argv: () => ["rename", SWEEP_FILE, "omega", "omega2"] },
  { what: "move", argv: () => ["move", SWEEP_FILE, "specs/B.mdx"] },
];

/** Stage the sweep workspace: sources committed as the impact baseline. */
async function createSweepWorkspace(): Promise<{
  workspace: TestWorkspace;
  state: SweepState;
}> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": SWEEP_CONFIG, [SWEEP_FILE]: SWEEP_SOURCE },
  });
  try {
    await workspace.gitInit();
    const baseRef = await workspace.gitCommitAll("sweep baseline");
    return { workspace, state: { baseRef } };
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

interface SweepStoryOptions {
  readonly product: ProductBinding;
  readonly workspace: TestWorkspace;
  readonly state: SweepState;
  /** Flags appended to every step's argv, before `--json`. */
  readonly extraFlags?: readonly string[];
  /** Runs before each step (T12.0-4's repeated-flag variant). */
  readonly beforeStep?: (step: SweepStep, state: SweepState) => Promise<void>;
  /**
   * T12.0-1's parity arm: rerun each JSON-only step (SPEC 10.7, 11, 12.6)
   * without `--json` and assert it emits the same single document — same
   * exit code, one JSON document as the entire stdout, decoding to the same
   * information as the flagged run's (key-order-insensitive deep equality;
   * byte-identity not asserted — see the module header).
   */
  readonly assertJsonOnlyParity?: boolean;
  /** Test id labelling every diagnosis (e.g. "T12.0-1"). */
  readonly label: string;
}

/**
 * Recursively sort object keys so two decoded JSON documents that differ
 * only in key order render identically under `assertSameJson`'s
 * `JSON.stringify` comparison (which is key-order-sensitive). Arrays are
 * mapped element-wise, never reordered — array order stays significant;
 * object key order is formatting, not information (TEST-SPEC §11).
 */
export function canonicalizeJson(value: unknown): unknown {
  // H-11: an explicit stack, never native recursion per nesting level.
  type Container = unknown[] | Record<string, unknown>;
  const isContainer = (candidate: unknown): candidate is Container =>
    candidate !== null && typeof candidate === "object";
  if (!isContainer(value)) return value;
  const root: Container = Array.isArray(value) ? [] : {};
  const pending: { readonly source: Container; readonly copy: Container }[] = [
    { source: value, copy: root },
  ];
  // A leaf is placed as is; a container is placed as a fresh empty copy —
  // attached in its parent's sorted member order, filled when its own frame
  // is popped.
  const placed = (member: unknown): unknown => {
    if (!isContainer(member)) return member;
    const copy: Container = Array.isArray(member) ? [] : {};
    pending.push({ source: member, copy });
    return copy;
  };
  while (pending.length > 0) {
    const frame = pending.pop();
    if (frame === undefined) break;
    const { source, copy } = frame;
    if (Array.isArray(source)) {
      const target = copy as unknown[];
      for (let index = 0; index < source.length; index += 1) {
        target[index] = placed(source[index]);
      }
    } else {
      const target = copy as Record<string, unknown>;
      for (const key of Object.keys(source).sort()) {
        target[key] = placed(source[key]);
      }
    }
  }
  return root;
}

/**
 * Run the full-surface story: every step with `--json` (and the sweep's extra
 * flags), asserting exit 0 exactly (H-5) and that the entire stdout is one
 * JSON document (SPEC 12.0).
 */
async function runSweepStory(options: SweepStoryOptions): Promise<void> {
  for (const step of SWEEP_STEPS) {
    await options.beforeStep?.(step, options.state);
    const argv = [
      ...step.argv(options.state),
      ...(options.extraFlags ?? []),
      "--json",
    ];
    const context = `${options.label} \`${argv.join(" ")}\``;
    const result = await expectExit(
      options.product,
      options.workspace,
      argv,
      0,
      `${context} — the ${step.what} step of the full-surface sweep runs at ` +
        `a state its arguments are valid in, so it succeeds (SPEC 12.0)`,
    );
    const doc = parseJsonStdout(
      result,
      `${context} — under --json the single JSON document is the entire ` +
        `standard output (SPEC 12.0, H-5)`,
    );
    if (options.assertJsonOnlyParity === true && step.jsonOnly === true) {
      // All JSON-only steps are reads, so the rerun observes the same story
      // state the flagged run did and evolves nothing.
      const bareArgv = [
        ...step.argv(options.state),
        ...(options.extraFlags ?? []),
      ];
      const bareContext =
        `${options.label} \`${bareArgv.join(" ")}\` ` +
        `(JSON-only surface, no --json)`;
      const bare = await expectExit(
        options.product,
        options.workspace,
        bareArgv,
        0,
        `${bareContext} — ${step.what} is a JSON-only surface (SPEC 10.7, ` +
          `11, 12.6), and the output form never changes an exit code ` +
          `(SPEC 12.0)`,
      );
      const bareDoc = parseJsonStdout(
        bare,
        `${bareContext} — on a JSON-only surface a single JSON document is ` +
          `the entire standard output with or without --json (SPEC 10.7, ` +
          `11, 12.6, H-5)`,
      );
      assertSameJson(
        canonicalizeJson(bareDoc),
        canonicalizeJson(doc),
        `${bareContext} — the JSON-only surfaces of 10.7, 11, and 12.6 emit ` +
          `the same single document with the flag as without: the two ` +
          `decoded documents carry the same information, compared with ` +
          `array order significant and object key order not (SPEC 10.7, ` +
          `11, 12.6; TEST-SPEC §11 — byte-identity between the two forms ` +
          `is not asserted)`,
      );
    }
    step.harvest?.(doc, options.state, context);
  }
}

// ---------------------------------------------------------------------------
// T12.0-1 — `--json` everywhere
// ---------------------------------------------------------------------------

const T12_0_1 = defineProductTest({
  id: "T12.0-1",
  title:
    "`--json` everywhere: every command and subcommand — build, check, ids, show, coverage, impact, all six query subcommands, occurrences, view, at, inventory, version, all eight review subcommands, rename, and file-form move — accepts the flag and emits exactly one JSON document as the entire standard output at its specified exit code; the JSON-only surfaces of 10.7, 11, and 12.6 (review export; the query subcommands, occurrences, view, at, and inventory; version) emit the same single document with the flag as without — same information at the same exit code, one JSON document as the entire stdout each way; byte-identity between the two forms is not asserted (TEST-SPEC §11); information parity with the human report is adapter-verified per command by the per-section tests (SPEC 12.0, 11, 12.6, 10.7)",
  timeoutMs: 240_000,
  run: async (product) => {
    const { workspace, state } = await createSweepWorkspace();
    try {
      await runSweepStory({
        product,
        workspace,
        state,
        assertJsonOnlyParity: true,
        label: "T12.0-1",
      });
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T12.0-2 — streams
// ---------------------------------------------------------------------------

// One unresolved same-file `d` reference (SPEC 14.5): the finding family is
// arbitrary — the arms assert streams, not the error catalog.
// Staged-source records (helpers/staged-mdx.ts; S-9's before-any-product
// clause): the findings source of T12.0-2's first workspace, which
// T12.0-9's findings arm stages after its first invocation (by import),
// and the minimal valid source the later workspaces of this section's
// three modules stage (and section-13.4.ts's T13.4-8, by import) — one
// record each, named with every staging test.
export const STREAMS_INVALID_SOURCE = stagedMdx(
  "T12.0-2/T12.0-9 specs/A.mdx with an unresolved d reference (T12.0-2's findings workspace; T12.0-9's findings arm)",
  ['<S id="a" d={"missing"}>', "Alpha text.", "</S>", ""].join("\n"),
);
export const STREAMS_VALID_SOURCE = stagedMdx(
  "T12.0-2/T12.0-3/T12.0-9/T12.0-10/T12.0-14/T13.4-8 specs/A.mdx (the minimal section a: T12.0-2's usage-error and configuration-error arms, T12.0-3's relative-resolution workspace, T12.0-9's corrupt-session and configuration-error arms, T12.0-10's past-the-gate workspace, T12.0-14's grammar workspace; T13.4-8's relocated file, its file-form move and emission arms)",
  ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
);
// An unknown top-level key is a configuration error (SPEC 7, 14.14). T12.0-2
// stages it after its first workspace's invocations: a TypeScript
// staged-source record, well-formed TypeScript (14.20) though an invalid
// configuration.
const STREAMS_BAD_CONFIG = stagedTs(
  "T12.0-2 configuration-error workspace xspec.config.ts — an unknown top-level key",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`,
);

const T12_0_2 = defineProductTest({
  id: "T12.0-2",
  title:
    "streams: a failing `build`'s validation errors and `check`'s findings are standard-output content (exit 1) in both output forms; usage and configuration errors print diagnostics to standard error, with JSON output in effect an exit-2 invocation emits the 12.7 error document as its entire stdout, and without JSON in effect exit-2 stdout is empty; non-JSON diagnostics never contaminate a JSON stdout, and the output form never changes an exit code or standard-error content — a representative exit-2 usage error and a failing `build`, each run with and without `--json`, exit identically with stderr byte-identical across the two forms (SPEC 12.0, 12.7, 14.14, H-4, H-5)",
  run: async (product) => {
    // Findings are stdout content (exit 1) — human and --json forms of a
    // failing `build` and of `check` over the same invalid workspace. The
    // failing `build` pair is also the exit-1 stderr-invariance arm: stderr
    // byte-identical across the two output forms (12.0, H-4).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": STREAMS_INVALID_SOURCE,
        },
      },
      async (workspace) => {
        for (const command of ["build", "check"] as const) {
          const humanContext = `T12.0-2 \`${command}\` (human form)`;
          const human = await expectExit(
            product,
            workspace,
            [command],
            1,
            `${humanContext} — the staged unresolved d reference (SPEC 14.5) ` +
              `is a finding: exit 1 (SPEC 12.0)`,
          );
          assertReportMentions(
            human,
            ["specs/A.mdx"],
            `${humanContext}: findings are standard-output content and ` +
              `identify the offending file (SPEC 12.0, 14)`,
          );
          const jsonContext = `T12.0-2 \`${command} --json\``;
          const result = await expectExit(
            product,
            workspace,
            [command, "--json"],
            1,
            jsonContext,
          );
          const findings = decodeFindingsReport(
            parseJsonStdout(
              result,
              `${jsonContext} — the entire stdout is exactly one JSON ` +
                `document: non-JSON diagnostics never contaminate a --json ` +
                `stdout (SPEC 12.0, H-5)`,
            ),
            jsonContext,
          ).findings;
          if (
            !findings.some((finding) =>
              finding.locations.some(
                (location) => location.file === "specs/A.mdx",
              ),
            )
          ) {
            fail(
              `${jsonContext}: the findings report carries the same ` +
                `information as the human report (SPEC 12.0) — expected a ` +
                `finding locating in specs/A.mdx, got ` +
                `${JSON.stringify(findings)}`,
            );
          }
          if (command === "build") {
            assertBytesEqual(
              result.stderrBytes,
              human.stderrBytes,
              `T12.0-2 stderr invariance, exit 1: a failing \`build\` run ` +
                `with and without --json — the output form never changes ` +
                `standard-error content (SPEC 12.0; product-to-itself, H-4)`,
            );
          }
        }
      },
    );

    // Usage errors: diagnostics on stderr; without --json stdout is empty;
    // with --json the 12.7 error document is the entire stdout. The unknown
    // -flag pair is the exit-2 stderr-invariance arm (12.0, H-4).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": STREAMS_VALID_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T12.0-2 `build` over the valid usage-arm workspace",
        );
        const humanUsageContext = "T12.0-2 `ids --definitely-not-a-flag`";
        const humanUsage = await expectExit(
          product,
          workspace,
          ["ids", "--definitely-not-a-flag"],
          2,
          `${humanUsageContext} — an unknown flag is a usage error (SPEC 12.0)`,
        );
        assertStdoutEmpty(
          humanUsage,
          `${humanUsageContext} — without JSON output in effect, an exit-2 ` +
            `error leaves standard output empty (SPEC 12.0, H-5)`,
        );
        assertStderrNonEmpty(humanUsage, humanUsageContext);
        const jsonUsageContext = "T12.0-2 `ids --definitely-not-a-flag --json`";
        const jsonUsage = await expectExit(
          product,
          workspace,
          ["ids", "--definitely-not-a-flag", "--json"],
          2,
          jsonUsageContext,
        );
        expectErrorDocument(
          jsonUsage,
          `${jsonUsageContext} — --json among the arguments puts JSON ` +
            `output in effect even when the arguments are themselves the ` +
            `error, so the exit-2 invocation emits the 12.7 error document ` +
            `as its entire stdout (SPEC 12.0, 12.7)`,
        );
        assertStderrNonEmpty(jsonUsage, jsonUsageContext);
        assertBytesEqual(
          jsonUsage.stderrBytes,
          humanUsage.stderrBytes,
          `T12.0-2 stderr invariance, exit 2: \`ids ` +
            `--definitely-not-a-flag\` run with and without --json — the ` +
            `output form never changes standard-error content, failing a ` +
            `product that appends or substitutes stderr diagnostics when ` +
            `JSON output is in effect (SPEC 12.0; product-to-itself, H-4)`,
        );
        const unknownFileContext = "T12.0-2 `show specs/Missing.mdx --json`";
        const unknownFile = await expectExit(
          product,
          workspace,
          ["show", "specs/Missing.mdx", "--json"],
          2,
          `${unknownFileContext} — an unknown file named in arguments is a ` +
            `usage error (SPEC 12.0)`,
        );
        expectErrorDocument(
          unknownFile,
          `${unknownFileContext} — the exit-2 error document is the entire ` +
            `stdout under --json (SPEC 12.0, 12.7)`,
        );
        assertStderrNonEmpty(unknownFile, unknownFileContext);
      },
    );

    // Configuration errors: stderr diagnostics; the error document under
    // --json (expectConfigurationError asserts it, stable code and concerned
    // path included); empty stdout without JSON in effect.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": STREAMS_BAD_CONFIG,
          "specs/A.mdx": STREAMS_VALID_SOURCE,
        },
      },
      async (workspace) => {
        await expectConfigurationError(
          product,
          workspace,
          ["build"],
          "T12.0-2 `build --json` under an unknown-key configuration (SPEC 14.14)",
        );
        const humanConfigContext =
          "T12.0-2 `build` under an unknown-key configuration (human form)";
        const humanConfig = await expectExit(
          product,
          workspace,
          ["build"],
          2,
          `${humanConfigContext} — a configuration error is a usage-class ` +
            `error, exit 2 (SPEC 14.14, 12.0)`,
        );
        assertStdoutEmpty(
          humanConfig,
          `${humanConfigContext} — without JSON output in effect, an exit-2 ` +
            `error leaves standard output empty (SPEC 12.0, H-5)`,
        );
        assertStderrNonEmpty(humanConfig, humanConfigContext);
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.0-3 — `--config`
// ---------------------------------------------------------------------------

// A second, self-contained configuration whose directory (alt/) is its own
// workspace root (SPEC 7: configured globs resolve relative to the
// configuration file's directory). T12.0-3's relative-resolution workspace
// follows its sweep story, so this is a TypeScript staged-source record, as
// SPECS_ONLY_CONFIG beside it is.
const ALT_CONFIG = stagedTs(
  "T12.0-3 alt/xspec.config.ts — the alternate root's configuration (the spec group alt)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    alt: ["aspecs/**/*.mdx"]
  }
})
`,
);
// T12.0-3's relative-resolution workspace follows its sweep story: the
// alternate root's source is a staged-source record.
const ALT_SOURCE = stagedMdx(
  "T12.0-3 alt/aspecs/B.mdx (the alternate root's source)",
  ['<S id="b">', "Bee text.", "</S>", ""].join("\n"),
);

const T12_0_3 = defineProductTest({
  id: "T12.0-3",
  title:
    "every command accepts `--config <path>`, swept across the full command surface with a working-directory-relative path; a relative path resolves against the working directory, not the workspace root — from a subdirectory `../xspec.config.ts` reaches the root configuration and a bare `xspec.config.ts` is a missing-configuration error even though the workspace root holds one; the named file is the configuration actually used and its directory is the workspace root (SPEC 12.0, 7, 14.14)",
  timeoutMs: 240_000,
  run: async (product) => {
    // Acceptance sweep: the full command surface, each invocation carrying a
    // cwd-relative --config naming the root configuration.
    {
      const { workspace, state } = await createSweepWorkspace();
      try {
        await runSweepStory({
          product,
          workspace,
          state,
          extraFlags: ["--config", "xspec.config.ts"],
          label: "T12.0-3",
        });
      } finally {
        await workspace.dispose();
      }
    }

    // Relative resolution against the working directory.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": STREAMS_VALID_SOURCE,
          "alt/xspec.config.ts": ALT_CONFIG,
          "alt/aspecs/B.mdx": ALT_SOURCE,
        },
        dirs: ["tools"],
      },
      async (workspace) => {
        const tools = workspace.path("tools");

        // From tools/, `../xspec.config.ts` resolves against the working
        // directory to the root configuration. A product resolving the path
        // against the upward-search workspace root would look one level
        // above the workspace — no configuration there — and exit 2.
        const buildContext =
          "T12.0-3 `build --config ../xspec.config.ts --json` from tools/";
        const buildResult = await runProduct(product, {
          cwd: tools,
          argv: ["build", "--config", "../xspec.config.ts", "--json"],
        });
        assertExitCode(
          buildResult,
          0,
          `${buildContext} — the relative --config path resolves against ` +
            `the working directory (SPEC 12.0)`,
        );
        parseJsonStdout(buildResult, buildContext);
        if ((await workspace.kind("specs/A.xspec.ts")) !== "file") {
          fail(
            `${buildContext}: the build ran against the root configuration, ` +
              `so the generated module specs/A.xspec.ts must exist ` +
              `(SPEC 13.1)`,
          );
        }

        // From tools/, a bare `xspec.config.ts` names tools/xspec.config.ts,
        // which does not exist: a missing configuration, exit 2 (14.14). A
        // product resolving the path against the workspace root would find
        // the root configuration and succeed — failing this arm.
        await expectConfigurationError(
          product,
          workspace,
          ["check", "--config", "xspec.config.ts"],
          "T12.0-3 `check --config xspec.config.ts` from tools/ — the " +
            "relative path resolves against the working directory, where no " +
            "configuration exists (SPEC 12.0, 14.14)",
          tools,
        );

        // The named file is the configuration actually used, and its
        // directory is the workspace root: paths report relative to alt/.
        const idsContext = "T12.0-3 `ids --config alt/xspec.config.ts --json`";
        const idsReport = decodeIdsReport(
          await runJson(
            product,
            workspace,
            ["ids", "--config", "alt/xspec.config.ts", "--json"],
            idsContext,
          ),
          idsContext,
        );
        assertSameJson(
          idsReport.files.map((entry) => [entry.file, entry.ids]),
          [["aspecs/B.mdx", ["b"]]],
          `${idsContext}: the configuration at the given path is the one ` +
            `used, and its directory (alt/) is the workspace root — the ` +
            `listing holds exactly aspecs/B.mdx with its one ID (SPEC 7, 12.0)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T12.0-4 — flag repetition; comma-separated list values
// ---------------------------------------------------------------------------

const REPEAT_FLAG_PAIR = ["--config", "xspec.config.ts"] as const;

const T12_0_4 = defineProductTest({
  id: "T12.0-4",
  title:
    "a flag may be given at most once per invocation: repeating a flag on any command is a usage error, exit 2 — swept across the full command surface by doubling `--config` (each paired single-`--config` run proving the argv otherwise valid) plus repeated value (`--tag`) and boolean (`--json`) flags — while list-valued flags take one comma-separated value: `--kinds depends,embeds` is accepted and repeating `--kinds` exits 2 (SPEC 12.0, 11)",
  timeoutMs: 240_000,
  run: async (product) => {
    const { workspace, state } = await createSweepWorkspace();
    try {
      // Every step runs its doubled-`--config` variant first (exit 2, empty
      // stdout under the single --json), then the identical invocation with
      // `--config` given once — which succeeds and evolves the story,
      // proving the doubled variant's argv was otherwise valid.
      await runSweepStory({
        product,
        workspace,
        state,
        extraFlags: [...REPEAT_FLAG_PAIR],
        label: "T12.0-4",
        beforeStep: async (step, current) => {
          const argv = [
            ...step.argv(current),
            ...REPEAT_FLAG_PAIR,
            ...REPEAT_FLAG_PAIR,
            "--json",
          ];
          const context = `T12.0-4 \`${argv.join(" ")}\``;
          const result = await runCli(product, workspace, argv);
          assertExitCode(
            result,
            2,
            `${context} — \`--config\` is given twice: a flag may be given ` +
              `at most once per invocation, and repetition is a usage error ` +
              `even with identical values; the ${step.what} invocation with ` +
              `\`--config\` given once, run next, succeeds (SPEC 12.0)`,
          );
          expectErrorDocument(
            result,
            `${context} — under --json, the exit-2 error document is the ` +
              `entire stdout (SPEC 12.0, 12.7, H-5)`,
          );
        },
      });

      // List-valued flags take one comma-separated value…
      const kindsContext =
        "T12.0-4 `query edges --kinds depends,embeds --json`";
      const kindsOk = await expectExit(
        product,
        workspace,
        ["query", "edges", "--kinds", "depends,embeds", "--json"],
        0,
        `${kindsContext} — a list-valued flag takes one comma-separated ` +
          `value (SPEC 12.0, 11)`,
      );
      parseJsonStdout(kindsOk, kindsContext);
      // …and repeating one is a usage error like any other flag.
      const kindsRepeatedContext =
        "T12.0-4 `query edges --kinds depends --kinds embeds --json`";
      const kindsRepeated = await runCli(product, workspace, [
        "query",
        "edges",
        "--kinds",
        "depends",
        "--kinds",
        "embeds",
        "--json",
      ]);
      assertExitCode(
        kindsRepeated,
        2,
        `${kindsRepeatedContext} — the list belongs in one comma-separated ` +
          `value; repeating --kinds is a usage error (SPEC 12.0, 11)`,
      );
      expectErrorDocument(
        kindsRepeated,
        `${kindsRepeatedContext} — under --json, the exit-2 error document ` +
          `is the entire stdout (SPEC 12.0, 12.7, H-5)`,
      );

      // A repeated single-valued flag (`--tag`): the single form is valid.
      const tagContext = "T12.0-4 `query nodes --tag keep --json`";
      parseJsonStdout(
        await expectExit(
          product,
          workspace,
          ["query", "nodes", "--tag", "keep", "--json"],
          0,
          `${tagContext} — the single \`--tag\` form is valid (SPEC 11)`,
        ),
        tagContext,
      );
      const tagRepeatedContext =
        "T12.0-4 `query nodes --tag keep --tag keep --json`";
      const tagRepeated = await runCli(product, workspace, [
        "query",
        "nodes",
        "--tag",
        "keep",
        "--tag",
        "keep",
        "--json",
      ]);
      assertExitCode(
        tagRepeated,
        2,
        `${tagRepeatedContext} — repeating a value flag is a usage error ` +
          `(SPEC 12.0)`,
      );
      expectErrorDocument(
        tagRepeated,
        `${tagRepeatedContext} — under --json, the exit-2 error document ` +
          `is the entire stdout (SPEC 12.0, 12.7, H-5)`,
      );

      // A repeated boolean flag (`--json --json`): exit code only — see the
      // module header on why the stream stays unasserted here.
      const jsonRepeated = await runCli(product, workspace, [
        "ids",
        "--json",
        "--json",
      ]);
      assertExitCode(
        jsonRepeated,
        2,
        "T12.0-4 `ids --json --json` — repeating the boolean --json flag is " +
          "a usage error (SPEC 12.0)",
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T12.0-5 — argument addressing
// ---------------------------------------------------------------------------

// The addressing source: the body's first workspace and, after its
// invocations, the configuration-state twins — a staged-source record.
const ADDRESSING_SOURCE = stagedMdx(
  "T12.0-5 specs/A.mdx (the addressing workspace and its configuration-state twins)",
  [
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
  ].join("\n"),
);

// "specs/" + 0xFF + "A.mdx": 0xFF never occurs in valid UTF-8, so the
// argument value is not valid UTF-8 (SPEC 12.0) — stageable on Linux, where
// the OS argument vector is a byte channel (the driver's POSIX trampoline).
const NON_UTF8_NODE_ARG = Uint8Array.from([
  ...Buffer.from("specs/", "utf8"),
  0xff,
  ...Buffer.from("A.mdx", "utf8"),
]);

// The native-separator and normalization negatives (SPEC 12.0: arguments
// naming files are read as spelled and compared byte-wise against
// workspace-relative paths, which no normalization touches): each spelling
// names no discovered file — discovered paths carry no `\`, `.` segment, or
// empty segment (SPEC 7) — so each is an unknown-file usage error on `show`
// and `view` alike. The `\` arm discriminates on the Windows leg (E-6),
// where `\` is the native separator; the other two on either leg.
const UNNORMALIZED_SPELLINGS: readonly (readonly [string, string])[] = [
  ["specs\\A.mdx", "the native separator `\\`"],
  ["./specs/A.mdx", "a `.` segment"],
  ["specs//A.mdx", "an empty segment"],
];

// U+FFFD in every argument position (SPEC 12.0, the value-level rule: an
// argument value containing U+FFFD is a malformed value, a usage error of
// the syntax class judged before every per-flag and per-operand check).
// Every other value of each invocation is well-formed and, where a later
// check would consult it, names something that exists (the `<new-id>` arm
// renames an existing ID; the `--test-hold` arm is an otherwise-performable
// rename), so the malformed value is each invocation's only defect and the
// arm is sharp against a product judging positions in another order. The
// character is built from its code point (REPLACEMENT_CHARACTER) so no
// tool layer can normalize the spelling away.
const T12_0_5_MALFORMED_VALUES: readonly (readonly [
  readonly string[],
  string,
])[] = [
  [["show", `${SWEEP_ALPHA}${REPLACEMENT_CHARACTER}`, "--json"], "a `<node>`"],
  [["view", REPLACEMENT_CHARACTER_SPEC_PATH, "--json"], "a `<file>` operand"],
  [
    ["ids", "--file", REPLACEMENT_CHARACTER_SPEC_PATH, "--json"],
    "a `--file` glob",
  ],
  [
    ["query", "nodes", "--tag", `green${REPLACEMENT_CHARACTER}`, "--json"],
    "a `--tag`",
  ],
  [
    ["occurrences", "--to", `${SWEEP_ALPHA}${REPLACEMENT_CHARACTER}`, "--json"],
    "a `--to`",
  ],
  [
    ["rename", SWEEP_FILE, "alpha", `alpha${REPLACEMENT_CHARACTER}`, "--json"],
    "a `<new-id>` (never `refused-invalid-id`: the value never reaches the " +
      "1.4 check, SPEC 6.4)",
  ],
  [
    ["review", "status", `s${REPLACEMENT_CHARACTER}`, "--json"],
    "a session name",
  ],
  [
    [
      "review",
      "resolve",
      "s",
      "r1",
      "--status",
      "updated",
      "--note",
      `note${REPLACEMENT_CHARACTER}`,
      "--json",
    ],
    "a `--note` text",
  ],
  [
    ["impact", "--base", `main${REPLACEMENT_CHARACTER}`, "--json"],
    "a `--base` ref",
  ],
  [
    ["ids", "--config", `xspec${REPLACEMENT_CHARACTER}.config.ts`, "--json"],
    "a `--config` path",
  ],
  [
    [
      "rename",
      SWEEP_FILE,
      "alpha",
      "alpha2",
      "--test-hold",
      `hold${REPLACEMENT_CHARACTER}.tmp`,
      "--json",
    ],
    "a `--test-hold` path (no hold file appears: the value is judged before " +
      "acquisition, SPEC 12.0, 13.5)",
  ],
];

// The positive side of the backslash (T12.0-5; SPEC 12.0, 7, 7.1). SPEC
// 12.0: the backslash is an ordinary byte, no separator, so an argument
// spelled with it names or matches only a discovered file of that very path
// (1.5); SPEC 7: a glob supports exactly `*`, `?`, and `**`, every other
// byte a literal, so the backslash in a `--file` pattern is never an escape.
// Linux leg only, where a file name can hold the byte: E-6 reruns the whole
// entry on Windows "less its Linux-leg arms" (no Windows filesystem admits
// the staged names), so the body gates these arms itself, beside the
// non-UTF-8 arm, and the Windows leg skips no arm. The backslash is built
// from its code point (U+005C), never spelled as an escape in this source;
// the record names spell it in words.
const BACKSLASH = String.fromCharCode(0x5c);

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

// The spec side: a discovered spec-group file `specs/a`, backslash, `b.mdx`
// — an invalid source path (condition 19: 7.1 bars the backslash from a
// spec-group file's path, 14.19) whose content is condition-free (one
// well-formed, unique id), so the path is the file's one defect. Prose
// precedes the section, so offset 0 lies in no section and `at … 0`
// resolves to the root construct. Every expected range is composed from
// the same parts the staged file is.
const BACKSLASH_SPEC_FILE = `specs/a${BACKSLASH}b.mdx`;
const BACKSLASH_SPEC_PROSE = "Backslash-path prose.\n\n";
const BACKSLASH_SPEC_SECTION = [
  '<S id="pb">',
  "Backslash-path text.",
  "</S>",
].join("\n");
const BACKSLASH_SPEC_TEXT = `${BACKSLASH_SPEC_PROSE}${BACKSLASH_SPEC_SECTION}\n`;
const BACKSLASH_SPEC_ROOT_RANGE: SourceRange = {
  start: 0,
  end: Buffer.byteLength(BACKSLASH_SPEC_TEXT, "utf8"),
};
const BACKSLASH_SPEC_SECTION_RANGE: SourceRange = {
  start: Buffer.byteLength(BACKSLASH_SPEC_PROSE, "utf8"),
  end: Buffer.byteLength(
    `${BACKSLASH_SPEC_PROSE}${BACKSLASH_SPEC_SECTION}`,
    "utf8",
  ),
};
// Staged in a workspace the body creates after its first product
// invocation: a staged-source record (S-9), beside SPECS_ONLY_CONFIG's.
const BACKSLASH_SPEC_SOURCE = stagedMdx(
  "T12.0-5 specs/a, a backslash, b.mdx (the positive side of the " +
    "backslash, spec side: a discovered spec-group file at an invalid " +
    "source path)",
  BACKSLASH_SPEC_TEXT,
);

/**
 * The asserted projection of a finding (SPEC 14, 12.7): its stable code,
 * its in-source locations, and its concerned path — message and identities
 * stay unpinned (informational).
 */
function projectPathFinding(finding: Finding): {
  readonly code: string | null;
  readonly locations: readonly unknown[];
  readonly path: unknown;
} {
  return {
    code: finding.code,
    locations: finding.locations,
    path: finding.path,
  };
}

/** The condition-19 finding concerning the backslash-named spec file. */
const BACKSLASH_SPEC_FINDING = {
  code: "invalid-source-path",
  locations: [],
  path: BACKSLASH_SPEC_FILE,
} as const;

/** A view tree's identities and construct ranges, children in order. */
interface IdentityTree {
  readonly identity: ViewNode["identity"];
  readonly range: SourceRange;
  readonly children: readonly IdentityTree[];
}

function projectIdentityTree(node: ViewNode): IdentityTree {
  return {
    identity: node.identity,
    range: node.range,
    children: node.children.map(projectIdentityTree),
  };
}

/**
 * T12.0-5's spec-side positive arm (Linux leg): `view` and `at … 0` given
 * the backslash-named discovered file name that very file — membership
 * holds, never the unknown-file exit 2 of a product reading the backslash
 * as a separator — its structure on view with every identity explicitly
 * unavailable, and exactly its condition-19 finding accompanying: exit 1
 * (SPEC 12.0, 11.4, 11.5, 11.2, 7.1, 14.19; T11.2-3, and T12.0-13 for `#`).
 */
async function expectBackslashSpecArms(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [BACKSLASH_SPEC_FILE]: BACKSLASH_SPEC_SOURCE,
      },
    },
    async (workspace) => {
      const spelled = JSON.stringify(BACKSLASH_SPEC_FILE);
      const viewContext =
        `T12.0-5 \`view ${spelled}\` (the positive side of the backslash, ` +
        `Linux leg; the operand JSON-spelled)`;
      const viewResult = await runCli(product, workspace, [
        "view",
        BACKSLASH_SPEC_FILE,
      ]);
      assertExitCode(
        viewResult,
        1,
        `${viewContext} — the operand names the discovered file of that ` +
          `very path (the backslash an ordinary byte, no separator), so ` +
          `membership holds — never the unknown-file exit 2 — and the ` +
          `answer carries the file's condition-19 finding: exit 1 (SPEC ` +
          `12.0, 11.4, 7.1, 14.19)`,
      );
      const viewReport = decodeViewReport(
        parseJsonStdout(
          viewResult,
          `${viewContext} — a single JSON document is the only output ` +
            `form (SPEC 11)`,
        ),
        { text: false },
        viewContext,
      );
      assertSameJson(
        viewReport.findings.map(projectPathFinding),
        [BACKSLASH_SPEC_FINDING],
        `${viewContext} — the consulted domain is the requested file ` +
          `alone, so exactly its condition-19 finding accompanies: the ` +
          `stable code "invalid-source-path", no in-source locations, the ` +
          `file as its concerned path (SPEC 7.1, 14.19, 11.2, 11.4, 12.7)`,
      );
      assertSameJson(
        viewReport.views.map((view) => view.file),
        [BACKSLASH_SPEC_FILE],
        `${viewContext} — exactly one per-file view, for the requested ` +
          `path presented as spelled (SPEC 11.4, 12.0, 1.5)`,
      );
      assertSameJson(
        projectIdentityTree(viewReport.views[0]!.root),
        {
          identity: UNAVAILABLE,
          range: BACKSLASH_SPEC_ROOT_RANGE,
          children: [
            {
              identity: UNAVAILABLE,
              range: BACKSLASH_SPEC_SECTION_RANGE,
              children: [],
            },
          ],
        },
        `${viewContext} — the invalid-path file keeps its positional tree ` +
          `and construct ranges on view while every node identity, root ` +
          `included, is explicitly unavailable (SPEC 11.2, 1.5)`,
      );

      const atContext =
        `T12.0-5 \`at ${spelled} 0\` (the positive side of the ` +
        `backslash, Linux leg; the operand JSON-spelled)`;
      const atResult = await runCli(product, workspace, [
        "at",
        BACKSLASH_SPEC_FILE,
        "0",
      ]);
      assertExitCode(
        atResult,
        1,
        `${atContext} — the \`<file>\` operand names the discovered file ` +
          `exactly as a view operand does — never the unknown-file exit 2 ` +
          `— and the answer carries the file's condition-19 finding and an ` +
          `unavailable identity: exit 1 (SPEC 12.0, 11.5, 7.1, 14.19)`,
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
        [BACKSLASH_SPEC_FINDING],
        `${atContext} — the consulted domain is the named file alone: ` +
          `exactly its condition-19 finding (SPEC 7.1, 14.19, 11.2, 11.5)`,
      );
      assertSameJson(
        atReport.resolution,
        {
          section: {
            identity: UNAVAILABLE,
            range: BACKSLASH_SPEC_ROOT_RANGE,
          },
          occurrence: null,
        },
        `${atContext} — offset 0 (prose) resolves to the root construct, ` +
          `its identity explicitly unavailable, within no occurrence ` +
          `(SPEC 11.5, 11.2)`,
      );
    },
  );
}

// The code side: two valid code sources — `src/a`, backslash, `b.ts` (a
// code source's path may hold the byte: 14.19 bars it from spec-group
// paths alone) and its sibling `src/ab.ts` — each marking its own node of
// `specs/A.mdx` from its own function unit, so every occurrence record
// individuates its file. Under the pattern `src/a`, backslash, `*.ts` the
// backslash is a literal byte (SPEC 7), matching the first file alone; a
// product reading it as an escape of `*` matches neither file (the
// configured-glob twin is T7-4's literal-backslash arm), and one reading the
// path operand's backslash as an escape or a separator lists the sibling's
// occurrence or none. All four files are staged in a workspace the body
// creates after its first product invocation: staged-source records (S-9).
const BACKSLASH_CODE_FILE = `src/a${BACKSLASH}b.ts`;
const BACKSLASH_CODE_SIBLING = "src/ab.ts";
const BACKSLASH_CODE_PATTERN = `src/a${BACKSLASH}*.ts`;
const BACKSLASH_CODE_SPEC_FILE = "specs/A.mdx";
const BACKSLASH_CODE_CONFIG = stagedTs(
  "T12.0-5 xspec.config.ts (the positive side of the backslash, code " +
    "side: one spec group and one code group)",
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
const BACKSLASH_CODE_SPEC = stagedMdx(
  "T12.0-5 specs/A.mdx (the positive side of the backslash, code side: " +
    "the two marked nodes)",
  [
    '<S id="alpha">',
    "Alpha text.",
    "</S>",
    "",
    '<S id="omega">',
    "Omega text.",
    "</S>",
    "",
  ].join("\n"),
);
const BACKSLASH_CODE_SOURCES: Readonly<Record<string, StagedTs>> = {
  [BACKSLASH_CODE_FILE]: stagedTs(
    "T12.0-5 src/a, a backslash, b.ts (the positive side of the " +
      "backslash, code side: the backslash-named code source, marking " +
      "alpha)",
    [
      'import SPEC from "../specs/A.xspec";',
      "",
      "export function inBackslash(): void {",
      "  SPEC.alpha;",
      "}",
      "",
    ].join("\n"),
  ),
  [BACKSLASH_CODE_SIBLING]: stagedTs(
    "T12.0-5 src/ab.ts (the positive side of the backslash, code side: " +
      "the sibling, marking omega)",
    [
      'import SPEC from "../specs/A.xspec";',
      "",
      "export function inSibling(): void {",
      "  SPEC.omega;",
      "}",
      "",
    ].join("\n"),
  ),
};

/** An occurrence record's individuating tuple (SPEC 12.7, 5.7). */
interface OccurrenceTuple {
  readonly file: unknown;
  readonly kind: string;
  readonly source: unknown;
  readonly target: string;
}

function projectOccurrence(record: OccurrenceRecord): OccurrenceTuple {
  return {
    file: record.file,
    kind: record.kind,
    source:
      "identity" in record.source ? record.source.identity : record.source,
    target: record.target,
  };
}

/** The first file's one occurrence: its marker of `alpha`. */
const BACKSLASH_CODE_OCCURRENCE: OccurrenceTuple = {
  file: BACKSLASH_CODE_FILE,
  kind: "references",
  source: `${BACKSLASH_CODE_FILE}#inBackslash`,
  target: `${BACKSLASH_CODE_SPEC_FILE}#alpha`,
};

/** The sibling's one occurrence: its marker of `omega`. */
const BACKSLASH_SIBLING_OCCURRENCE: OccurrenceTuple = {
  file: BACKSLASH_CODE_SIBLING,
  kind: "references",
  source: `${BACKSLASH_CODE_SIBLING}#inSibling`,
  target: `${BACKSLASH_CODE_SPEC_FILE}#omega`,
};

/** Tuples as a bytewise-sorted multiset (membership, not 5.7's order). */
function sortedTuples(tuples: readonly OccurrenceTuple[]): string[] {
  return tuples.map((tuple) => JSON.stringify(tuple)).sort();
}

/**
 * `occurrences --file <pattern>` over the valid code-side workspace: exit
 * 0, a finding-free answer (the admitted files are valid sources), and the
 * records' individuating tuples (SPEC 11.3, 12.7).
 */
async function backslashOccurrences(
  product: ProductBinding,
  workspace: TestWorkspace,
  pattern: string,
  context: string,
): Promise<OccurrenceTuple[]> {
  const result = await runCli(product, workspace, [
    "occurrences",
    "--file",
    pattern,
  ]);
  assertExitCode(
    result,
    0,
    `${context} — the workspace is valid and the admitted files are ` +
      `valid sources: a finding-free answer, exit 0 (SPEC 11.3)`,
  );
  const report = decodeOccurrencesReport(
    parseJsonStdout(
      result,
      `${context} — a single JSON document is the only output form ` +
        `(SPEC 11)`,
    ),
    context,
  );
  assertSameJson(
    report.findings.map(projectPathFinding),
    [],
    `${context} — no finding accompanies: both code sources are valid ` +
      `(a code source's path may hold the backslash, SPEC 14.19, 7.2)`,
  );
  return report.occurrences.map(projectOccurrence);
}

/**
 * T12.0-5's code-side positive arm (Linux leg): `occurrences --file` given
 * the first file's path, and given the pattern `src/a`, backslash, `*.ts`,
 * lists the first file's occurrence alone (SPEC 12.0, 7, 11.3) — after the
 * control `src/*.ts` shows both files discovered, each marking its node,
 * so "alone" is attributable to the spelling.
 */
async function expectBackslashCodeArms(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": BACKSLASH_CODE_CONFIG,
        [BACKSLASH_CODE_SPEC_FILE]: BACKSLASH_CODE_SPEC,
        ...BACKSLASH_CODE_SOURCES,
      },
    },
    async (workspace) => {
      const controlContext =
        "T12.0-5 `occurrences --file src/*.ts` (the positive side of the " +
        "backslash, Linux leg: the staging control)";
      assertSameJson(
        sortedTuples(
          await backslashOccurrences(
            product,
            workspace,
            "src/*.ts",
            controlContext,
          ),
        ),
        sortedTuples([BACKSLASH_CODE_OCCURRENCE, BACKSLASH_SIBLING_OCCURRENCE]),
        `${controlContext} — both code sources are discovered, each ` +
          `marking its own node, so the arms below discriminate by ` +
          `spelling alone (records compared as a sorted multiset; SPEC ` +
          `11.3, 4.5, 4.6)`,
      );
      const arms: readonly (readonly [string, string])[] = [
        [
          BACKSLASH_CODE_FILE,
          "the first file's path — the backslash an ordinary byte, no " +
            "separator, and no escape of the `b` after it (SPEC 12.0, 7)",
        ],
        [
          BACKSLASH_CODE_PATTERN,
          "the pattern src/a, a backslash, *.ts — the backslash a literal " +
            "byte of the pattern, never an escape of `*`: a product " +
            "reading it as one matches neither file (SPEC 7, 12.0)",
        ],
      ];
      for (const [pattern, what] of arms) {
        const context =
          `T12.0-5 \`occurrences --file ${JSON.stringify(pattern)}\` (the ` +
          `positive side of the backslash, Linux leg; the pattern ` +
          `JSON-spelled)`;
        assertSameJson(
          await backslashOccurrences(product, workspace, pattern, context),
          [BACKSLASH_CODE_OCCURRENCE],
          `${context} — ${what}: the first file's occurrence alone`,
        );
      }
    },
  );
}

const T12_0_5 = defineProductTest({
  id: "T12.0-5",
  title:
    "argument addressing: `<node>`, `<graph-node>`, and `<file>` arguments and `--file` globs are workspace-relative with `/` separators, independent of the working directory (representative commands run from a subdirectory), while `--test-hold <path>` resolves against the working directory; native-separator and normalization negatives — an argument spelled with `\\` (`specs\\A.mdx`), with a `.` segment (`./specs/A.mdx`), or with an empty segment (`specs//A.mdx`) is read as spelled and compared byte-wise, so it names no workspace file: an unknown-file usage error, exit 2, on `show` and `view` as representatives (the `\\` arm discriminating on the Windows leg, E-6); the positive side of the backslash (Linux leg, gated inside the body, E-6) — with a discovered spec-group file `specs/a`, backslash, `b.mdx` staged (an invalid source path, condition 19), `view` and `at … 0` name that very file: membership holds, every node identity unavailable, exit 1 with exactly its condition-19 finding, never the unknown-file exit 2; with valid code sources `src/a`, backslash, `b.ts` and `src/ab.ts` each marking a node (both discovered, the `src/*.ts` control), `occurrences --file` given the first file's path or the pattern `src/a`, backslash, `*.ts` lists the first file's occurrence alone — the backslash an ordinary byte, never a separator or an escape; malformed values — an argument value that is not valid UTF-8 (raw bytes in the OS argument vector, Linux leg) and an argument value containing U+FFFD in every position (a `<node>`, a `<file>` operand, a `--file` glob, a `--tag`, a `--to`, a `<new-id>` — never `refused-invalid-id` — a session name, a `--note` text, a `--base` ref, a `--config` path, and a `--test-hold` path) — are usage errors of the syntax class: exit 2 with the plain usage error's document (`code` null), reported without loading configuration — byte-identical with the configuration file invalid or missing (T12.0-10's discipline) — and modifying nothing (SPEC 12.0, 12.7, 13.5, 6.4, 1.5, 7, 7.1, 11.3, 11.4, 11.5, 14.19)",
  run: async (product) => {
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [SWEEP_FILE]: ADDRESSING_SOURCE,
        },
        dirs: ["tools"],
      },
      async (workspace) => {
        await buildOk(product, workspace, "T12.0-5 `build`");
        const tools = workspace.path("tools");

        // <node> from a subdirectory: resolved against the cwd the argument
        // would name tools/specs/A.mdx, which does not exist.
        const showContext =
          "T12.0-5 `show specs/A.mdx#alpha --json` from tools/";
        const showResult = await runProduct(product, {
          cwd: tools,
          argv: ["show", SWEEP_ALPHA, "--json"],
        });
        assertExitCode(
          showResult,
          0,
          `${showContext} — <node> arguments are workspace-relative in the ` +
            `form of 1.5, independent of the working directory (SPEC 12.0)`,
        );
        parseJsonStdout(showResult, showContext);

        // <graph-node> from a subdirectory (`query reachable --from/--to`).
        const reachableContext =
          "T12.0-5 `query reachable --from specs/A.mdx#alpha --to specs/A.mdx#omega --json` from tools/";
        const reachableResult = await runProduct(product, {
          cwd: tools,
          argv: [
            "query",
            "reachable",
            "--from",
            SWEEP_ALPHA,
            "--to",
            SWEEP_OMEGA,
            "--json",
          ],
        });
        assertExitCode(
          reachableResult,
          0,
          `${reachableContext} — <graph-node> arguments are ` +
            `workspace-relative, independent of the working directory ` +
            `(SPEC 12.0, 11)`,
        );
        const reachable = decodeReachableReport(
          parseJsonStdout(reachableResult, reachableContext),
          reachableContext,
        );
        if (!reachable.reachable) {
          fail(
            `${reachableContext}: the staged alpha → omega \`d\` edge is a ` +
              `dependency path, so the workspace-relative endpoints resolve ` +
              `and the report states a path exists (SPEC 11, 12.0)`,
          );
        }

        // --file from a subdirectory. Content-discriminated: a glob resolved
        // against the cwd would match nothing, and a glob matching nothing
        // is a valid empty restriction — exit codes alone cannot tell.
        const idsContext =
          "T12.0-5 `ids --file specs/*.mdx --json` from tools/";
        const idsResult = await runProduct(product, {
          cwd: tools,
          argv: ["ids", "--file", "specs/*.mdx", "--json"],
        });
        assertExitCode(idsResult, 0, idsContext);
        const idsReport = decodeIdsReport(
          parseJsonStdout(idsResult, idsContext),
          idsContext,
        );
        assertSameJson(
          idsReport.files.map((entry) => entry.file),
          ["specs/A.mdx"],
          `${idsContext}: the --file glob is workspace-relative (the rules ` +
            `of SPEC 7), independent of the working directory, so the ` +
            `listing is restricted to exactly specs/A.mdx (SPEC 12.0, 12.3)`,
        );

        // Malformed values (SPEC 12.0, the value-level rule): an argument
        // value containing U+FFFD — stageable on both legs — is a malformed
        // value in every position, a usage error of the syntax class judged
        // before every per-flag and per-operand check: exit 2 with the plain
        // usage error's document (`code` null, 12.7), reported without
        // loading configuration — byte-identical with the workspace's
        // configuration file invalid or missing (T12.0-10's discipline,
        // through the shared helper) — never the check the position would
        // otherwise reach (the `<new-id>` arm: never `refused-invalid-id`,
        // 6.4; the `--test-hold` arm: no hold file, no acquisition, 13.5).
        // The whole table runs inside one modifies-nothing compare over the
        // built workspace; the twins hold the same source under the two
        // other configuration states.
        const twins = await stageConfigurationStateTwins({
          [SWEEP_FILE]: ADDRESSING_SOURCE,
        });
        try {
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              for (const [argv, position] of T12_0_5_MALFORMED_VALUES) {
                await expectSyntaxClassUsageError(
                  product,
                  workspace,
                  twins,
                  argv,
                  `T12.0-5 \`${argv.join(" ")}\` — U+FFFD in ${position}`,
                );
              }
              // Non-UTF-8 argument value — Linux leg only: argv is a byte
              // channel there (the driver's POSIX trampoline); other
              // platforms cannot carry the argument at all.
              if (process.platform === "linux") {
                await expectSyntaxClassUsageError(
                  product,
                  workspace,
                  twins,
                  ["show", NON_UTF8_NODE_ARG, "--json"],
                  "T12.0-5 `show <specs/\\xffA.mdx bytes> --json` (Linux " +
                    "leg) — an argument value that is not valid UTF-8 is a " +
                    "malformed value, the same syntax-class usage error",
                );
              }
            },
            "T12.0-5: a malformed argument value modifies nothing — the " +
              "usage error precedes every per-flag and per-operand check " +
              "(SPEC 12.0)",
          );
        } finally {
          await twins.dispose();
        }

        // Native-separator and normalization negatives (SPEC 12.0: read as
        // spelled, compared byte-wise, no normalization) on `show` and
        // `view` as representatives. Controls first: the exactly-spelled
        // path resolves on both commands, so each negative is attributable
        // to its spelling alone.
        for (const command of ["show", "view"] as const) {
          const controlContext = `T12.0-5 \`${command} ${SWEEP_FILE} --json\` (control)`;
          parseJsonStdout(
            await expectExit(
              product,
              workspace,
              [command, SWEEP_FILE, "--json"],
              0,
              `${controlContext} — the exactly-spelled path names the ` +
                `discovered file, so the negatives below are attributable ` +
                `to their spellings alone (SPEC 12.0)`,
            ),
            controlContext,
          );
          for (const [spelling, defect] of UNNORMALIZED_SPELLINGS) {
            await expectPlainUsageError(
              product,
              workspace,
              [command, spelling, "--json"],
              `T12.0-5 \`${command} ${spelling} --json\` — an argument ` +
                `spelled with ${defect} is read as spelled and compared ` +
                `byte-wise, so it names no workspace file (discovered ` +
                `paths carry none, SPEC 7): an unknown-file usage error, ` +
                `exit 2, never a normalized match (SPEC 12.0` +
                (spelling.includes("\\")
                  ? "; discriminating on the Windows leg, E-6)"
                  : ")"),
            );
          }
        }

        // --test-hold resolves against the working directory (13.5); the
        // same run's <file> argument resolves workspace-relative — one
        // invocation from tools/ exercises both rules.
        const holdAbs = workspace.path("tools/hold.tmp");
        const holdContext =
          "T12.0-5 `rename specs/A.mdx omega omega2 --test-hold hold.tmp` from tools/";
        const running = await startProduct(product, {
          cwd: tools,
          argv: [
            "rename",
            SWEEP_FILE,
            "omega",
            "omega2",
            "--test-hold",
            "hold.tmp",
          ],
        });
        try {
          try {
            await running.waitForFile(holdAbs);
          } catch (error) {
            fail(
              `${holdContext}: --test-hold <path> is a filesystem path ` +
                `resolved against the working directory, so the hold file ` +
                `must appear at tools/hold.tmp (SPEC 12.0, 13.5) — ` +
                `${error instanceof Error ? error.message : String(error)}`,
            );
          }
          if ((await workspace.kind("hold.tmp")) !== "absent") {
            fail(
              `${holdContext}: a hold file appeared at the workspace root — ` +
                `--test-hold resolves against the working directory, not ` +
                `the workspace root (SPEC 12.0, 13.5)`,
            );
          }
          await releaseHoldFile(holdAbs);
          const renameResult = await running.waitForExit();
          assertExitCode(
            renameResult,
            0,
            `${holdContext} — once the hold file is deleted the rename ` +
              `proceeds normally; its <file> argument resolved ` +
              `workspace-relative from the subdirectory (SPEC 13.5, 12.0, 6.4)`,
          );
        } finally {
          running.kill();
          await releaseHoldFile(holdAbs);
        }
      },
    );

    // The positive side of the backslash (SPEC 12.0, 7, 7.1) — Linux leg
    // only, where a file name can hold the byte: gated here inside the
    // shared body, as the non-UTF-8 arm is, so the Windows leg (E-6: "less
    // its Linux-leg arms") reruns the whole entry and skips no arm. Each
    // side stages its own workspace.
    if (process.platform === "linux") {
      await expectBackslashCodeArms(product);
      await expectBackslashSpecArms(product);
    }
  },
});

// ---------------------------------------------------------------------------
// T12.0-6 — case and bytes
// ---------------------------------------------------------------------------

const PROBE_SOURCE = ['<S id="a1">', "Alpha text.", "</S>", ""].join("\n");

const CASE_FILE = "specs/T.mdx";
// One tag in its two Unicode spellings: NFC (U+00E9) and NFD (e + U+0301),
// spelled as escapes so no editor or formatter can silently normalize
// them. Byte-wise comparison makes them two distinct tags (SPEC 12.0).
const NFC_TAG = "caf\u00e9";
const NFD_TAG = "cafe\u0301";
const CASE_SOURCE = stagedMdx(
  "T12.0-6 casing workspace specs/T.mdx",
  [
    '<S id="case" tags="foo">',
    "Lower case node.",
    "</S>",
    "",
    '<S id="Case" tags="Foo">',
    "Upper case node.",
    "</S>",
    "",
    `<S id="nfc" tags="${NFC_TAG}">`,
    "NFC-tagged node.",
    "</S>",
    "",
    `<S id="nfd" tags="${NFD_TAG}">`,
    "NFD-tagged node.",
    "</S>",
    "",
  ].join("\n"),
);

/**
 * T12.0-6's single-casing path probe as one shared code path: called by the
 * registered T12.0-6 body on the suite leg and rerun verbatim by the Windows
 * leg (TEST-SPEC E-6; test/windows/e6-subset.test.ts). Paths compare
 * byte-wise case-sensitively (SPEC 12.0): in a workspace whose only source is
 * `specs/A.mdx`, the argument `specs/a.mdx` names no workspace file — exit 2
 * — even where a case-insensitive filesystem lookup would find the file. The
 * fixture stages exactly one casing, so it stages identically everywhere.
 */
export async function runT1206SingleCasingPathProbe(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": PROBE_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(product, workspace, "T12.0-6 probe `build`");
      const controlContext =
        "T12.0-6 `show specs/A.mdx --json` (probe control)";
      parseJsonStdout(
        await expectExit(
          product,
          workspace,
          ["show", "specs/A.mdx", "--json"],
          0,
          `${controlContext} — the exactly-spelled path resolves, so the ` +
            `probe's failure below is attributable to casing alone`,
        ),
        controlContext,
      );
      const probeContext = "T12.0-6 `show specs/a.mdx --json` (probe)";
      const probe = await expectExit(
        product,
        workspace,
        ["show", "specs/a.mdx", "--json"],
        2,
        `${probeContext} — the workspace's only source is specs/A.mdx: ` +
          `paths compare byte-wise case-sensitively, so specs/a.mdx names ` +
          `no workspace file — an unknown-file usage error, even where a ` +
          `case-insensitive filesystem lookup would find the file ` +
          `(SPEC 12.0)`,
      );
      expectErrorDocument(
        probe,
        `${probeContext} — under --json, the exit-2 error document is the ` +
          `entire stdout (SPEC 12.0, 12.7, H-5)`,
      );
    },
  );
}

// The two-casing workspace's sources (T12.0-6's third workspace, after the
// probe's and the casing workspace's invocations): staged-source records,
// the literals moved to module level.
const T12_0_6_UPPER_CASING = stagedMdx(
  "T12.0-6 two-casing workspace specs/A.mdx",
  ['<S id="upper">', "Upper file text.", "</S>", ""].join("\n"),
);
const T12_0_6_LOWER_CASING = stagedMdx(
  "T12.0-6 two-casing workspace specs/a.mdx",
  ['<S id="lower">', "Lower file text.", "</S>", ""].join("\n"),
);

const T12_0_6 = defineProductTest({
  id: "T12.0-6",
  title:
    "case and bytes: IDs, tags, identities, session names, and paths compare byte-wise case-sensitively with no Unicode normalization — `case`/`Case` are distinct IDs, `--tag Foo` does not match `foo`, NFC and NFD spellings of one tag are two tags, `A.mdx`/`a.mdx` are distinct identities (Linux-staged), and session lookups outside creation match exactly; single-casing path probe: in a workspace whose only source is specs/A.mdx, the argument specs/a.mdx (`show`, representative) is an unknown-file usage error, exit 2 (rerun on the Windows leg, E-6; SPEC 12.0, 10.1)",
  run: async (product) => {
    // Single-casing path probe — stageable on any filesystem: the argument
    // must miss byte-wise even where a case-insensitive filesystem lookup
    // would find the file. Shared code path with the Windows-leg rerun
    // (E-6/CI-01).
    await runT1206SingleCasingPathProbe(product);

    // IDs, tags, and session names (platform-portable staging).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [CASE_FILE]: CASE_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T12.0-6 `build` over the casing workspace — `case` and `Case` " +
            "are distinct IDs byte-wise (SPEC 12.0, 1.3), not a collision",
        );

        // IDs compare byte-wise: two distinct nodes, each with its own text.
        for (const [id, ownText] of [
          ["case", "Lower case node.\n"],
          ["Case", "Upper case node.\n"],
        ] as const) {
          const context = `T12.0-6 \`query node ${CASE_FILE}#${id} --json\``;
          const report = decodeNodeReport(
            await runJson(
              product,
              workspace,
              ["query", "node", `${CASE_FILE}#${id}`, "--json"],
              context,
            ),
            context,
          );
          assertSameJson(
            report.ownText,
            ownText,
            `${context}: IDs compare byte-wise case-sensitively, so ` +
              `\`${id}\` names exactly its own node (SPEC 12.0, 1.3)`,
          );
        }

        // Tags compare byte-wise: Foo ≠ foo; NFC ≠ NFD (no normalization).
        const tagArms: readonly {
          readonly tag: string;
          readonly expected: readonly string[];
          readonly what: string;
        }[] = [
          {
            tag: "foo",
            expected: [`${CASE_FILE}#case`],
            what: "`--tag foo` does not match the `Foo`-tagged node",
          },
          {
            tag: "Foo",
            expected: [`${CASE_FILE}#Case`],
            what: "`--tag Foo` does not match the `foo`-tagged node",
          },
          {
            tag: NFC_TAG,
            expected: [`${CASE_FILE}#nfc`],
            what: "the NFC spelling matches only the NFC-tagged node",
          },
          {
            tag: NFD_TAG,
            expected: [`${CASE_FILE}#nfd`],
            what: "the NFD spelling matches only the NFD-tagged node",
          },
        ];
        for (const arm of tagArms) {
          const context = `T12.0-6 \`query nodes --tag ${arm.tag} --json\` — ${arm.what}`;
          const rows = decodeNodeRowsReport(
            await runJson(
              product,
              workspace,
              ["query", "nodes", "--tag", arm.tag, "--json"],
              context,
            ),
            context,
          );
          assertSameJson(
            sortedIdentities(rows),
            [...arm.expected],
            `${context}: tags compare byte-wise, with no case folding and ` +
              `no Unicode normalization (SPEC 12.0, 2.6)`,
          );
        }

        // Session names compare byte-wise outside creation (10.1's
        // create-time ASCII-case fold is the sole exception, T10.1-2).
        const createContext =
          "T12.0-6 `review create --strategy audit --name Case-Session --json`";
        await runJson(
          product,
          workspace,
          [
            "review",
            "create",
            "--strategy",
            "audit",
            "--name",
            "Case-Session",
            "--json",
          ],
          createContext,
        );
        const statusContext = "T12.0-6 `review status Case-Session --json`";
        await runJson(
          product,
          workspace,
          ["review", "status", "Case-Session", "--json"],
          statusContext,
        );
        for (const wrong of ["case-session", "CASE-SESSION"]) {
          const context = `T12.0-6 \`review status ${wrong} --json\``;
          const result = await expectExit(
            product,
            workspace,
            ["review", "status", wrong, "--json"],
            2,
            `${context} — every subcommand but \`create\` matches session ` +
              `names exactly (SPEC 10.1), and names compare byte-wise ` +
              `case-sensitively: no session bears this spelling, an ` +
              `unknown-session usage error (SPEC 12.0, 10.7)`,
          );
          expectErrorDocument(
            result,
            `${context} — under --json, the exit-2 error document is the ` +
              `entire stdout (SPEC 12.0, 12.7, H-5)`,
          );
        }
      },
    );

    // Distinct-casing path identities need both spellings on disk, which
    // only a case-sensitive filesystem holds: Linux-gated (the suite leg);
    // the portable probe above carries the byte-wise path rule elsewhere.
    if (process.platform === "linux") {
      await withWorkspace(
        {
          files: {
            "xspec.config.ts": SPECS_ONLY_CONFIG,
            "specs/A.mdx": T12_0_6_UPPER_CASING,
            "specs/a.mdx": T12_0_6_LOWER_CASING,
          },
        },
        async (workspace) => {
          await buildOk(
            product,
            workspace,
            "T12.0-6 `build` over the two-casing workspace",
          );
          const idsContext = "T12.0-6 `ids --json` (two casings)";
          const idsReport = decodeIdsReport(
            await runJson(product, workspace, ["ids", "--json"], idsContext),
            idsContext,
          );
          assertSameJson(
            idsReport.files.map((entry) => [entry.file, entry.ids]),
            [
              ["specs/A.mdx", ["upper"]],
              ["specs/a.mdx", ["lower"]],
            ],
            `${idsContext}: specs/A.mdx and specs/a.mdx are distinct ` +
              `identities, each with its own IDs, files in byte order — ` +
              `"A" (0x41) before "a" (0x61) (SPEC 12.0, 12.3)`,
          );
          for (const identity of ["specs/A.mdx#upper", "specs/a.mdx#lower"]) {
            const context = `T12.0-6 \`query node ${identity} --json\``;
            parseJsonStdout(
              await expectExit(
                product,
                workspace,
                ["query", "node", identity, "--json"],
                0,
                `${context} — each casing's node resolves under its own ` +
                  `identity (SPEC 12.0, 1.5)`,
              ),
              context,
            );
          }
          const crossContext = "T12.0-6 `query node specs/a.mdx#upper --json`";
          const cross = await expectExit(
            product,
            workspace,
            ["query", "node", "specs/a.mdx#upper", "--json"],
            2,
            `${crossContext} — \`upper\` lives only in specs/A.mdx: ` +
              `identities compare byte-wise, so specs/a.mdx#upper names no ` +
              `node — an unknown-node usage error (SPEC 12.0, 1.5)`,
          );
          expectErrorDocument(
            cross,
            `${crossContext} — under --json, the exit-2 error document is ` +
              `the entire stdout (SPEC 12.0, 12.7, H-5)`,
          );
        },
      );
    }
  },
});

export const section120iTests: readonly ProductTestEntry[] = [
  T12_0_1,
  T12_0_2,
  T12_0_3,
  T12_0_4,
  T12_0_5,
  T12_0_6,
];
