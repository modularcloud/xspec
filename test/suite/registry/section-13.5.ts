// TEST-SPEC §13.5 (concurrency and isolation) — SUITE-48: T13.5-1 (hold-seam
// basics: five held mutating-command arms each compared byte-identically
// against its no-seam twin (seam neutrality), the stale-workspace arm — the
// hold precedes the 13.3 refresh, graph data byte-identical while held — the
// occupied-hold-path exit-2 arms, the non-mutating unknown-flag arm, and
// `build --test-hold --json` consuming `--json` as the hold path — the flag
// value-taking by name on every command, JSON out of effect, stdout empty),
// T13.5-2 (mutual exclusion),
// T13.5-3 (exclusivity ends with the process), T13.5-4 (readers during
// mutation + build/query storm), T13.5-5 (atomic visibility via a polling
// reader), T13.5-6 (workspace isolation), T13.5-7 (interrupted or
// write-refused mutation: the pinned write order — the refusal arms (a)–(f)
// composed from write-refusal-staging.ts, and the kill arm), T13.5-8 (acquisition before every later check: the
// exclusion-first refusals on a failing workspace, the hold seam engaging on
// invocations the 12.0 argument checks, baseline resolution, or the 13.3
// gate refuse, and the non-mutating preview boundary).
//
// All mutual-exclusion choreography goes through the `--test-hold <path>`
// seam (SPEC 13.5) via the subprocess driver's background-start, hold-file,
// and kill support (helpers/subprocess.ts, HARNESS-02). Hold paths live in
// the workspace's tempRoot — outside the workspace root — so whole-root byte
// snapshots never see them; `--test-hold` resolves against the working
// directory (SPEC 12.0; T12.0-5), so the absolute path is exact.
//
// CERTIFICATIONS.md staging constraints (binding; T13.5-1…T13.5-5 and
// T13.5-8 are §CONF-CORE in-scope):
// - Every mutating command these tests drive is `rename`, file-form `move`
//   (never the section form), or a mutating `review` subcommand with
//   `create` under `--strategy audit` (§CONF-CORE), and the in-scope
//   fixtures stay in CONF-CORE's workspace shape: one spec group of
//   importless, tagless `.mdx` sources; no `code`, `markdown`, `coverage`,
//   or `policy` keys; no git.
// - T13.5-1's seam-neutrality twin drives the exact command sequence of the
//   held workspace — the staging `build` and the `review status` item
//   lookup included — with the seam flag alone removed, and its whole-tree
//   compare includes the journal (§VIOL-CORE-CHATTYREADS's passing analysis
//   leans on exactly that sequence equality).
// - T13.5-1's stale-workspace arm is the only in-scope mutating command
//   started on stale graph data (§CONF-CORE's freshness constraint, which
//   §VIOL-CORE-EARLYREFRESH's passing side leans on): it stages its own
//   workspaces, and every other mutating command these tests start —
//   T13.5-1's basic arms, T13.5-2's held and excluded commands, T13.5-3's
//   killed and subsequent commands, T13.5-4's held mutator — starts on a
//   freshly built workspace with no refresh pending (T10.1-1).
// - T13.5-2's excluded commands carry no `--test-hold` (§VIOL-CORE-NOLOCK),
//   and its modifies-nothing compare brackets each excluded command alone,
//   with the baseline snapshot taken while command 1 is already held
//   (§VIOL-CORE-EARLYWRITE).
// - T13.5-8's failing workspace is a second spec source beginning with a
//   byte-order mark (14.20 at offset 0), added after the valid `build` and
//   the audit session's creation, masked and never an operand; the `build`
//   establishing it runs outside every bracket and before anything is held
//   (§VIOL-CORE-CHATTYREADS); its excluded commands carry no `--test-hold`
//   (§VIOL-CORE-NOLOCK) and its modifies-nothing compares bracket each
//   excluded or refused invocation alone (§VIOL-CORE-EARLYWRITE); its
//   refused valid-workspace commands start on a freshly built workspace
//   lying in no repository, where every `--base` ref is unresolvable
//   (§CONF-CORE); and its waits for a refused invocation's hold file fail
//   loud, never proceeding on the command's exit or on a timeout
//   (§VIOL-CORE-LATELOCK).
// - T13.5-3's subsequent mutating command succeeds whether or not the killed
//   operation's writes landed — `rename specs/A.mdx g g2`, independent of
//   the killed `a`→`a2` and never a retry of it (§VIOL-CORE-EARLYWRITE).
// - T13.5-4's storm arm asserts termination only — the storm commands' exit
//   codes are deliberately unasserted — plus the final `build`'s
//   byte-equality to a clean build; its held-phase reads run while the
//   mutator is held (§VIOL-CORE-PARTIALWRITE's expected-failure analysis
//   depends on exactly this shape). The clean-build compare excludes the
//   journal — durable, not derived (SPEC 13.4): the 13.5 tests assert hold,
//   exclusion, and derived-file behavior, never journal bytes
//   (§VIOL-CORE-CHATTYREADS's expected-failure analysis depends on exactly
//   that); whether `build` and read commands modify the journal is T6.1-1's
//   and T13.4-5's charter.
//
// Conservative operationalizations (noted per H-3/H-4):
// - "Proceeds only once the file is deleted" (T13.5-1): the deterministic
//   check is the whole-root byte snapshot while held (nothing modified) —
//   certified via VIOL-CORE-EARLYWRITE — plus: the process is still running
//   after that snapshot's full-tree read completes, and exits 0 only after
//   the harness deletes the hold file.
// - Seam neutrality (T13.5-1): one identical twin workspace replays each
//   held arm's operation without `--test-hold` and the two whole trees —
//   sources, journal, sessions, derived files, graph data — are compared
//   after each arm (H-4 product-to-itself, H-6 across directories). The
//   per-arm compare makes the twin byte-identical at each next arm's start,
//   so every arm runs "the same operation on an identical twin workspace";
//   arms 4/5 pass each side its own workspace's reported item ID — the same
//   operation by item scope, never an assumed cross-directory ID equality.
// - "Fails promptly" (T13.5-1 occupied path, T13.5-2): a bounded foreground
//   run — a product that blocks instead of failing is killed at the bound
//   and fails diagnosed (H-8; the bound is a hang guard, never an assertion
//   input, H-10) — and for T13.5-2 the excluded command's exit is observed
//   while command 1 is still held (asserted: command 1 has not exited).
// - "Observe the prior state" (T13.5-4): each read command's exit code and
//   stdout bytes while the rename is held equal the same invocation's from
//   before the rename started (SPEC 12.0 byte-determinism: identical
//   workspace bytes, identical answers).
// - "Never a partial file" (T13.5-5): every distinct content the polling
//   reader observes must byte-equal one of the completed builds' contents
//   for the polled path (the set of post-build reads), and no absence may
//   be observed after content has been observed or after the first build
//   completed. A build's "new content" is thus its completed content — the
//   only enumerable reading of "prior content, complete new content, or
//   absence-before-first-write" from the observer side.
// - T13.5-6 stages two *differing* workspaces (different file names, IDs,
//   and texts), so cross-workspace interference cannot cancel out: a
//   held-overlap probe (workspace 2's mutating command succeeds while
//   workspace 1's is held — exclusion is per workspace) plus a
//   concurrent-vs-serial compare of a six-command script (per-step exit
//   codes and stdout bytes, and the final workspace trees, H-6
//   two-directory style).
// - T13.5-7's refusal arms stage each 14.24 refusal by permission removal
//   while the command is held at the seam (after acquisition, before any
//   modification — seam neutrality) and read every rewritten-byte
//   expectation from a twin on which the same operation ran unrefused
//   (H-6); the states are asserted entry by entry against 13.5's pinned
//   per-command write order (write-refusal-staging.ts). Its kill-timing
//   spread is a fixed delay list — kill scheduling is choreography, never
//   an assertion input (H-10); the operative assertion is delay-independent
//   and disjunctive exactly as 13.5 admits: after a post-release kill,
//   `check` exits 0 or 1 (never a signal death, never another code — the
//   configuration is intact, so the exit-2 class is not stageable) with
//   condition 5–7 findings alone or condition 10 findings alone, and after
//   a held-point kill it exits 0 (the hold precedes all modification).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type {
  Finding,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  decodeFindingsReport,
  decodeSessionStatusReport,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  describeByteDifference,
  fail,
  HarnessAssertionError,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertDirectoriesEqual,
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type {
  ProductBinding,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  pathExists,
  releaseHoldFile,
  runProduct,
  startProduct,
  summarizeResult,
} from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import { assertOutsideAnyRepository } from "./section-6.3.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  buildFindings,
  buildOk,
  expectExit,
  runCli,
  runJson,
} from "./support.js";
import {
  awaitHoldFile,
  holdPathFor,
  renameTwin,
  runKillArm,
  runWriteRefusalArms,
  WRITE_REFUSALS_STAGED,
} from "./write-refusal-staging.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group, no
// other keys — the CONF-CORE workspace shape (CERTIFICATIONS.md).
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// Importless, tagless `.mdx` source (the CONF-CORE shape): `a` carries a
// child so `rename` rewrites a descendant and `review split` has a child
// subtree; `g` is a second top-level leaf whose audit item is unblocked
// (SPEC 10.6).
const A_MDX = [
  '<S id="a">',
  "Alpha text.",
  '<S id="a.k">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
  '<S id="g">',
  "Gamma text.",
  "</S>",
  "",
].join("\n");

/**
 * The CONF-CORE-shaped staging shared by the 13.5 lock tests — and by
 * T6.6-3's runs-while-held arm, which per CERTIFICATIONS.md shares this
 * drive-during-hold choreography (T13.5-2's staging).
 */
export const CORE_DECL: WorkspaceDecl = {
  files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/A.mdx": A_MDX },
};

const REVIEWS_REL = ".xspec/reviews";

/** A session file's workspace-relative path (SPEC 10.1). */
function sessionRel(name: string): string {
  return `${REVIEWS_REL}/${name}.json`;
}

/** Stage a fresh workspace with the given declaration, run `body`, dispose. */
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

// The hold-path and hold-await helpers live in write-refusal-staging.ts (the
// seam-held staging choreography shared with T14-9); re-exported here for
// T6.6-3, which shares this module's drive-during-hold choreography
// (CERTIFICATIONS.md).
export { awaitHoldFile, holdPathFor };

/** The hold file must be an empty plain file ("creates an empty file"). */
async function assertEmptyHoldFile(
  absPath: string,
  context: string,
): Promise<void> {
  let stats;
  try {
    stats = await fsp.lstat(absPath);
  } catch (error) {
    return fail(
      `${context}: the hold file at ${absPath} must exist while held (SPEC ` +
        `13.5) — ${(error as Error).message}`,
    );
  }
  if (!stats.isFile()) {
    fail(
      `${context}: the hold file at ${absPath} must be a plain file (SPEC ` +
        `13.5: the command creates an empty file at the path)`,
    );
  }
  if (stats.size !== 0) {
    fail(
      `${context}: the hold file at ${absPath} must be empty (SPEC 13.5); ` +
        `found ${String(stats.size)} bytes`,
    );
  }
}

/** One-line outcome of a settled run, for premature-exit diagnoses. */
export async function describeExit(running: RunningProduct): Promise<string> {
  try {
    return summarizeResult(await running.waitForExit());
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Run a command to completion under a bound, converting a rejection (a
 * product that blocks or hangs instead of exiting, killed at the bound) into
 * a diagnosed assertion failure (H-8). The bound is a hang guard, never an
 * assertion input (H-10).
 */
export async function runBounded(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  context: string,
  timeoutMs = 15_000,
): Promise<RunResult> {
  try {
    return await runProduct(product, { cwd, argv, timeoutMs });
  } catch (error) {
    return fail(
      `${context}: the command must terminate on its own rather than block ` +
        `or hang (SPEC 13.5, 12.0; H-8: hangs become diagnosed failures) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** `review status <name> --json`, decoded (SPEC 10.7). */
async function sessionStatus(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<SessionStatusReport> {
  const label = `${context} \`review status ${name} --json\``;
  return decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", name, "--json"],
      label,
    ),
    label,
  );
}

/**
 * The unique status row scoped at `scope`, diagnosed loudly when missing or
 * duplicated (SPEC 10.1: at most one item per kind and scope node — audit
 * items are all `subtree-coherence`, so scope alone is unique here).
 */
function requireRowByScope(
  report: SessionStatusReport,
  scope: string,
  context: string,
): SessionStatusRow {
  const rows = report.items.filter((row) => row.scope === scope);
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one item scoped at ${scope} (SPEC 10.1, ` +
        `10.6); found ${String(rows.length)} among ` +
        JSON.stringify(
          report.items.map((row) => ({ scope: row.scope, kind: row.kind })),
        ),
    );
  }
  return rows[0] as SessionStatusRow;
}

// ---------------------------------------------------------------------------
// T13.5-1 — hold seam basics
// ---------------------------------------------------------------------------

// The staleness edit for T13.5-1's stale-workspace arm, as T10.1-1 stages
// it: same structure and identities, different leaf text — the graph data the
// earlier `build` wrote no longer matches the sources (SPEC 13.3), while the
// workspace stays valid.
const A_MDX_EDITED = A_MDX.replace("Kid text.", "Kid text, edited.");

/**
 * Snapshot scope "graph data alone": everything under `.xspec/` except the
 * durable files there — the journal (`.xspec/journal`, SPEC 6.1) and the
 * review sessions (`.xspec/reviews/`, SPEC 10.1) — with everything outside
 * `.xspec/` pruned. SPEC 13.3 leaves graph data's layout unenumerated, so
 * the scope is the graph-data area (11.6) minus its durable occupants; in a
 * harness-staged workspace nothing foreign lives there.
 */
function excludeAllButGraphData(relPathBytes: Uint8Array): boolean {
  const rel = Buffer.from(relPathBytes).toString("latin1");
  if (rel === ".xspec") return false;
  if (!rel.startsWith(".xspec/")) return true;
  return (
    rel === ".xspec/journal" ||
    rel === ".xspec/reviews" ||
    rel.startsWith(".xspec/reviews/")
  );
}

/**
 * T13.5-1's stale-workspace arm (SPEC 13.5: the hold precedes every
 * modification, the 13.3 refresh included). Three identically staged
 * CONF-CORE-shaped workspaces: `build`, then one section's own text edited so
 * the graph data is stale while the workspace stays valid (as T10.1-1 stages
 * it). The held workspace runs `review create --strategy audit --test-hold`:
 * while held, every workspace file — `.xspec/graph.json` included, the one
 * file a pre-hold refresh would change — is byte-identical to its
 * pre-invocation state; after release the command exits 0 and the session
 * file exists; the final tree equals the no-seam twin's (seam neutrality on
 * this arm too — both refresh, to the same final state), and the graph data
 * equals what `build` writes on the build twin (13.3: the refresh writes
 * exactly what `build` would write, the recorded derived-file paths — which
 * this edit leaves unchanged — excepted): product-to-itself compares under
 * H-4, well-defined across directories per H-6. This is the only in-scope
 * mutating command the 13.5 tests start on stale graph data
 * (CERTIFICATIONS.md §CONF-CORE's freshness constraint, which
 * §VIOL-CORE-EARLYREFRESH's passing side leans on); every other arm stages
 * itself freshly built.
 */
async function staleWorkspaceArm(product: ProductBinding): Promise<void> {
  const create = ["review", "create", "--strategy", "audit", "--name", "n"];
  const context =
    "T13.5-1 (stale workspace, held `review create --strategy audit --name n`)";
  await withWorkspace(CORE_DECL, async (workspace) => {
    await withWorkspace(CORE_DECL, async (twinNoSeam) => {
      await withWorkspace(CORE_DECL, async (twinBuild) => {
        // Identical staging on all three: `build`, then the staleness edit.
        await buildOk(product, workspace, "T13.5-1 stale arm staging `build`");
        await buildOk(
          product,
          twinNoSeam,
          "T13.5-1 stale arm no-seam twin staging `build`",
        );
        await buildOk(
          product,
          twinBuild,
          "T13.5-1 stale arm build twin staging `build`",
        );
        for (const staged of [workspace, twinNoSeam, twinBuild]) {
          await staged.file("specs/A.mdx", A_MDX_EDITED);
        }

        // What `build` writes on the edited sources (the build twin), and the
        // staging premise: it differs from the held workspace's current graph
        // data, so a refresh is pending there (SPEC 13.3: graph data carries
        // the sources' hashes and source ranges, so an edited text cannot
        // leave it current) — otherwise the arm could discriminate nothing.
        await buildOk(
          product,
          twinBuild,
          "T13.5-1 stale arm build twin `build` on the edited sources",
        );
        const staleGraphData = await snapshotDirectory(workspace.root, {
          exclude: excludeAllButGraphData,
        });
        const builtGraphData = await snapshotDirectory(twinBuild.root, {
          exclude: excludeAllButGraphData,
        });
        if (diffSnapshots(staleGraphData, builtGraphData).length === 0) {
          fail(
            `${context}: staging premise — after the edit the workspace's ` +
              `graph data must be stale, i.e. differ from what \`build\` ` +
              `writes on an identically edited twin (SPEC 13.3: graph data ` +
              `carries the sources' hashes and source ranges), but the two ` +
              `are byte-identical, so no refresh is pending and the arm ` +
              `cannot discriminate (H-8)`,
          );
        }

        // Pre-invocation state: every workspace file, `.xspec/` included.
        const before = await snapshotDirectory(workspace.root);
        const hold = holdPathFor(workspace, "hold-stale.tmp");
        const running = await startProduct(product, {
          cwd: workspace.root,
          argv: [...create, "--test-hold", hold],
        });
        try {
          await awaitHoldFile(running, hold, context);
          await assertEmptyHoldFile(hold, context);
          const whileHeld = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            before,
            whileHeld,
            `${context}: the workspace while held vs before the command ` +
              `started — graph data (.xspec/graph.json, the one file the ` +
              `pending 13.3 refresh changes) and every other workspace ` +
              `file: the hold is created after acquiring exclusivity and ` +
              `before every modification, the refresh included, so a ` +
              `product that refreshes before acquiring exclusivity fails ` +
              `here (SPEC 13.5, 13.3)`,
          );
          if (running.hasExited()) {
            fail(
              `${context}: the command must proceed only once the hold ` +
                `file is deleted, but it exited while the hold file still ` +
                `existed (SPEC 13.5) — ${await describeExit(running)}`,
            );
          }
          await releaseHoldFile(hold);
          let result: RunResult;
          try {
            result = await running.waitForExit();
          } catch (error) {
            return fail(
              `${context}: once the hold file is deleted the command must ` +
                `proceed and complete normally (SPEC 13.5) — ` +
                `${error instanceof Error ? error.message : String(error)}`,
            );
          }
          assertExitCode(
            result,
            0,
            `${context}: completes normally once the hold file is deleted ` +
              `(SPEC 13.5)`,
          );
        } finally {
          running.kill();
          await releaseHoldFile(hold);
        }
        const kind = await workspace.kind(sessionRel("n"));
        if (kind !== "file") {
          fail(
            `${context}: after completing normally, the session file exists ` +
              `as a plain file at ${sessionRel("n")} (SPEC 10.1); found ${kind}`,
          );
        }

        // Seam neutrality on this arm: the no-seam twin runs the same
        // operation on the same stale state without `--test-hold`, and the
        // final trees are compared whole — sources, journal, sessions,
        // derived files, and graph data (both refresh, to the same state).
        await expectExit(
          product,
          twinNoSeam,
          create,
          0,
          "T13.5-1 (stale workspace, twin) `review create --strategy audit " +
            "--name n` run without --test-hold on the identical stale twin " +
            "workspace (SPEC 13.5)",
        );
        await assertDirectoriesEqual(
          workspace.root,
          twinNoSeam.root,
          `${context} vs its no-seam twin: the final workspace state of the ` +
            `held-then-released run — sources, journal, sessions, derived ` +
            `files, and graph data — is byte-identical to the same operation ` +
            `run without --test-hold on an identical twin workspace (SPEC ` +
            `13.5 seam neutrality; a product-to-itself comparison under H-4, ` +
            `well-defined across directories per H-6)`,
        );

        // The refresh (SPEC 13.3, T10.1-1): after release the graph data is
        // refreshed — byte-identical to what `build` writes on the build
        // twin, the edit leaving the recorded derived-file paths unchanged.
        await assertDirectoriesEqual(
          workspace.root,
          twinBuild.root,
          `${context} vs its build twin, graph data alone (everything ` +
            `under .xspec/ but the journal and .xspec/reviews/): after ` +
            `release the 13.3 refresh has run, writing exactly what ` +
            `\`build\` writes on an identically edited twin — the recorded ` +
            `derived-file paths, which the edit leaves unchanged, excepted ` +
            `(SPEC 13.3, 13.5; T10.1-1; a product-to-itself comparison ` +
            `under H-4/H-6)`,
          { exclude: excludeAllButGraphData },
        );
      });
    });
  });
}

const T13_5_1 = defineProductTest({
  id: "T13.5-1",
  title:
    "each mutating command (`rename`, file-form `move`, `review create/resolve/split`) with `--test-hold` creates an empty file at the path after acquiring exclusivity and before modifying anything (workspace byte-identical while held), proceeds only once the file is deleted, and completes normally, the held-then-released run's final workspace state — sources, journal, sessions, derived files, and graph data — byte-identical to the same operation run without `--test-hold` on an identical twin workspace (seam neutrality: the seam changes no other behavior; H-4/H-6); on a workspace whose graph data is stale (a section's text edited after `build`, the workspace still valid) `review create --strategy audit --test-hold` leaves graph data and every other workspace file byte-identical while held — the hold precedes the 13.3 refresh too — and after release creates the session and refreshes the graph data to what `build` writes on an identical twin; anything at the hold path — file, directory, or symlink — fails the command exit 2 without modifying anything; `build` and `query` given `--test-hold` fail exit 2 as an unknown flag, and `build --test-hold --json` — the flag value-taking by name on every command — consumes `--json` as the hold path and leaves JSON out of effect: exit 2, stdout empty, no hold file (SPEC 13.5, 13.3, 12.0)",
  run: async (product) => {
    // Every arm below stages itself on a freshly built workspace with no
    // refresh pending (CERTIFICATIONS.md §CONF-CORE's freshness constraint);
    // the stale-workspace arm at the end stages its own.
    await withWorkspace(CORE_DECL, async (workspace) => {
      // Seam neutrality (SPEC 13.5: the seam changes no other behavior): an
      // identical twin workspace is driven through the exact same command
      // sequence — the staging `build` and the `review status` item lookup
      // included — with the seam flag alone removed, and after each
      // held-then-released arm the two whole trees (sources, journal,
      // sessions, derived files, graph data) are compared byte-identically:
      // a product-to-itself comparison under H-4, well-defined across
      // directories per H-6, the hold path outside the workspace. The
      // per-arm compare makes the twin byte-identical at each next arm's
      // start, so every arm runs "the same operation on an identical twin
      // workspace"; the two sides' sequences matching exactly — reads
      // included — is the staging §VIOL-CORE-CHATTYREADS's passing analysis
      // leans on (CERTIFICATIONS.md).
      await withWorkspace(CORE_DECL, async (twin) => {
        await buildOk(product, workspace, "T13.5-1 staging `build`");
        await buildOk(product, twin, "T13.5-1 twin staging `build`");

        let armIndex = 0;
        const heldArm = async (
          argv: readonly string[],
          what: string,
          onCompleted: () => Promise<void>,
          twinArgv: readonly string[] = argv,
        ): Promise<void> => {
          armIndex += 1;
          const hold = holdPathFor(workspace, `hold-${String(armIndex)}.tmp`);
          const context = `T13.5-1 (held ${what})`;
          const before = await snapshotDirectory(workspace.root);
          const running = await startProduct(product, {
            cwd: workspace.root,
            argv: [...argv, "--test-hold", hold],
          });
          try {
            await awaitHoldFile(running, hold, context);
            await assertEmptyHoldFile(hold, context);
            const whileHeld = await snapshotDirectory(workspace.root);
            assertSnapshotsEqual(
              before,
              whileHeld,
              `${context}: the workspace while held vs before the command ` +
                `started — the hold file is created after acquiring ` +
                `exclusivity and before modifying anything, so the workspace ` +
                `is byte-identical while held (SPEC 13.5)`,
            );
            if (running.hasExited()) {
              fail(
                `${context}: the command must proceed only once the hold ` +
                  `file is deleted, but it exited while the hold file still ` +
                  `existed (SPEC 13.5) — ${await describeExit(running)}`,
              );
            }
            await releaseHoldFile(hold);
            let result: RunResult;
            try {
              result = await running.waitForExit();
            } catch (error) {
              return fail(
                `${context}: once the hold file is deleted the command must ` +
                  `proceed and complete normally (SPEC 13.5) — ` +
                  `${error instanceof Error ? error.message : String(error)}`,
              );
            }
            assertExitCode(
              result,
              0,
              `${context}: completes normally once the hold file is deleted ` +
                `(SPEC 13.5)`,
            );
            await onCompleted();
          } finally {
            running.kill();
            await releaseHoldFile(hold);
          }

          // Seam neutrality: the twin runs the same operation without
          // `--test-hold`, and the final workspace states are compared
          // whole — no exclusions, the journal included.
          await expectExit(
            product,
            twin,
            twinArgv,
            0,
            `T13.5-1 (twin ${what}) run without --test-hold on the ` +
              `identical twin workspace (SPEC 13.5)`,
          );
          await assertDirectoriesEqual(
            workspace.root,
            twin.root,
            `${context} vs its no-seam twin: the final workspace state of ` +
              `the held-then-released run — sources, journal, sessions, ` +
              `derived files, and graph data — is byte-identical to the ` +
              `same operation run without --test-hold on an identical twin ` +
              `workspace (SPEC 13.5 seam neutrality: the seam changes no ` +
              `other behavior; a product-to-itself comparison under H-4, ` +
              `well-defined across directories per H-6)`,
          );
        };

        // Arm 1 — `review create` (audit strategy per §CONF-CORE).
        await heldArm(
          ["review", "create", "--strategy", "audit", "--name", "s"],
          "`review create --strategy audit --name s`",
          async () => {
            const kind = await workspace.kind(sessionRel("s"));
            if (kind !== "file") {
              fail(
                "T13.5-1 (held `review create`): after completing normally, " +
                  `the session file exists as a plain file at ` +
                  `${sessionRel("s")} (SPEC 10.1); found ${kind}`,
              );
            }
          },
        );

        // Arm 2 — `rename`.
        await heldArm(
          ["rename", "specs/A.mdx", "a", "a2"],
          "`rename specs/A.mdx a a2`",
          async () => {
            const text = new TextDecoder("utf-8", { fatal: false }).decode(
              await workspace.readBytes("specs/A.mdx"),
            );
            if (!text.includes('id="a2"')) {
              fail(
                "T13.5-1 (held `rename`): after completing normally, " +
                  'specs/A.mdx carries the renamed id="a2" (SPEC 6.4)',
              );
            }
          },
        );

        // Arm 3 — file-form `move` (never the section form, §CONF-CORE).
        await heldArm(
          ["move", "specs/A.mdx", "specs/Moved.mdx"],
          "`move specs/A.mdx specs/Moved.mdx`",
          async () => {
            const moved = await workspace.kind("specs/Moved.mdx");
            const original = await workspace.kind("specs/A.mdx");
            if (moved !== "file" || original !== "absent") {
              fail(
                "T13.5-1 (held `move`): after completing normally, the " +
                  `file moved — specs/Moved.mdx is a plain file (found ` +
                  `${moved}) and specs/A.mdx is absent (found ${original}) ` +
                  `(SPEC 6.5)`,
              );
            }
          },
        );

        // Arms 4 and 5 need item IDs: read them once — identities are
        // presented under the current (post-rename, post-move) identity
        // (SPEC 10.4). The twin replays the same read at the same sequence
        // position, and each arm passes each side its own workspace's
        // reported item ID — the same operation by item scope, never an
        // assumed cross-directory ID equality (H-4 product-to-itself).
        const status = await sessionStatus(
          product,
          workspace,
          "s",
          "T13.5-1 item lookup",
        );
        const gItem = requireRowByScope(
          status,
          "specs/Moved.mdx#g",
          "T13.5-1 item lookup (leaf item)",
        );
        const aItem = requireRowByScope(
          status,
          "specs/Moved.mdx#a2",
          "T13.5-1 item lookup (parent item)",
        );
        const twinStatus = await sessionStatus(
          product,
          twin,
          "s",
          "T13.5-1 twin item lookup",
        );
        const twinGItem = requireRowByScope(
          twinStatus,
          "specs/Moved.mdx#g",
          "T13.5-1 twin item lookup (leaf item)",
        );
        const twinAItem = requireRowByScope(
          twinStatus,
          "specs/Moved.mdx#a2",
          "T13.5-1 twin item lookup (parent item)",
        );

        // Arm 4 — `review resolve` (the unblocked leaf item, SPEC 10.6).
        await heldArm(
          ["review", "resolve", "s", gItem.id, "--status", "no-change"],
          "`review resolve s <leaf item> --status no-change`",
          async () => Promise.resolve(),
          ["review", "resolve", "s", twinGItem.id, "--status", "no-change"],
        );

        // Arm 5 — `review split` (the parent item's scope root has a child,
        // SPEC 10.7).
        await heldArm(
          ["review", "split", "s", aItem.id],
          "`review split s <parent item>`",
          async () => Promise.resolve(),
          ["review", "split", "s", twinAItem.id],
        );
      });

      // Occupied hold path: anything at the path — a file, directory, or
      // symbolic link (staged dangling: a create that follows the link
      // instead of failing would succeed) — fails the command exit 2
      // without modifying anything. `rename` is the representative mutating
      // command; the workspace state is untouched by every refusal, so the
      // arms chain.
      const occupants: readonly {
        readonly kind: string;
        readonly stage: (abs: string) => Promise<void>;
        readonly verifyUntouched: (abs: string) => Promise<void>;
      }[] = [
        {
          kind: "file",
          stage: async (abs) => {
            await fsp.writeFile(abs, "occupant bytes\n");
          },
          verifyUntouched: async (abs) => {
            assertBytesEqual(
              await fsp.readFile(abs),
              "occupant bytes\n",
              "T13.5-1 (occupied by a file): the occupant's bytes after " +
                "the refusal — untouched (SPEC 13.5: creation fails; " +
                "nothing is modified)",
            );
          },
        },
        {
          kind: "directory",
          stage: async (abs) => {
            await fsp.mkdir(abs);
          },
          verifyUntouched: async (abs) => {
            const stats = await fsp.lstat(abs);
            if (!stats.isDirectory()) {
              fail(
                "T13.5-1 (occupied by a directory): the occupant after the " +
                  "refusal must still be a directory (SPEC 13.5)",
              );
            }
          },
        },
        {
          kind: "symlink",
          stage: async (abs) => {
            await fsp.symlink("dangling-hold-target", abs);
          },
          verifyUntouched: async (abs) => {
            const stats = await fsp.lstat(abs);
            if (!stats.isSymbolicLink()) {
              fail(
                "T13.5-1 (occupied by a symlink): the occupant after the " +
                  "refusal must still be a symbolic link — creation fails " +
                  "if anything, a symbolic link included, exists at the " +
                  "path (SPEC 13.5)",
              );
            }
            const target = await fsp.readlink(abs);
            if (target !== "dangling-hold-target") {
              fail(
                "T13.5-1 (occupied by a symlink): the link's target after " +
                  `the refusal — untouched (SPEC 13.5); got ` +
                  `${JSON.stringify(target)}`,
              );
            }
            if (
              await pathExists(
                path.join(workspace.tempRoot, "dangling-hold-target"),
              )
            ) {
              fail(
                "T13.5-1 (occupied by a symlink): nothing may be created " +
                  "through the dangling link — creation must fail on the " +
                  "occupied path itself (SPEC 13.5)",
              );
            }
          },
        },
      ];
      for (const occupant of occupants) {
        const abs = holdPathFor(workspace, `occupied-${occupant.kind}`);
        await occupant.stage(abs);
        const context = `T13.5-1 (hold path occupied by a ${occupant.kind}) \`rename specs/Moved.mdx a2 a3 --test-hold <occupied>\``;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await runBounded(
              product,
              workspace.root,
              ["rename", "specs/Moved.mdx", "a2", "a3", "--test-hold", abs],
              context,
            );
            assertExitCode(
              result,
              2,
              `${context}: the hold file cannot be created, so the command ` +
                `fails with a usage error (SPEC 13.5, 12.0)`,
            );
          },
          `${context}: fails without modifying anything (SPEC 13.5)`,
        );
        await occupant.verifyUntouched(abs);
      }

      // Non-mutating commands: `--test-hold` is an unknown flag — 13.5
      // grants the seam to mutating commands alone, and unknown flags are
      // usage errors (12.0). The workspace sits at a built fixed point, so
      // the exit code and hold-file absence carry the arm (a flag-accepting
      // `build` would rewrite identical bytes — but it would also create the
      // hold file and wait, failing the bounded run or the absence check).
      const nonMutating: readonly (readonly [readonly string[], string])[] = [
        [["build"], "`build`"],
        [["query", "nodes"], "`query nodes`"],
      ];
      for (const [argv, what] of nonMutating) {
        const abs = holdPathFor(
          workspace,
          `nonmutating-${argv.join("-").replace(/[^a-z]/g, "")}`,
        );
        const context = `T13.5-1 (non-mutating ${what} given --test-hold)`;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await runBounded(
              product,
              workspace.root,
              [...argv, "--test-hold", abs],
              context,
            );
            assertExitCode(
              result,
              2,
              `${context}: 13.5 grants the seam to mutating commands ` +
                `alone, so --test-hold on ${what} is an unknown flag — a ` +
                `usage error (SPEC 13.5, 12.0)`,
            );
            if (await pathExists(abs)) {
              fail(
                `${context}: no hold file may be created at the path — the ` +
                  `flag is refused, not honored (SPEC 13.5, 12.0)`,
              );
            }
          },
          `${context}: the usage error modifies nothing (SPEC 12.0)`,
        );
      }

      // `--test-hold` is value-taking by name on every command (SPEC 12.0: a
      // flag's arity is fixed by its name, known before the command word is
      // identified, and a value-taking flag takes the whole next token
      // whatever it looks like), so `build --test-hold --json` consumes
      // `--json` as the hold path — a filesystem path resolved against the
      // working directory, the workspace root here — and leaves JSON out of
      // effect: the unknown flag's usage error exits 2 with empty stdout. A
      // product reading `--json` as the JSON flag answers the error document
      // on stdout and fails here; one honoring the flag would create
      // `./--json` and wait, failing the bounded run or the absence check.
      {
        const context =
          "T13.5-1 (`build --test-hold --json`: `--json` consumed as the " +
          "hold path)";
        const consumed = path.join(workspace.root, "--json");
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await runBounded(
              product,
              workspace.root,
              ["build", "--test-hold", "--json"],
              context,
            );
            assertExitCode(
              result,
              2,
              `${context}: --test-hold on \`build\` is an unknown flag — a ` +
                `usage error (SPEC 13.5, 12.0)`,
            );
            if (result.stdoutBytes.length !== 0) {
              fail(
                `${context}: \`--json\` is the value of \`--test-hold\`, not ` +
                  `the JSON flag (SPEC 12.0: a value-taking flag takes the ` +
                  `whole next token, a \`--\`-prefixed one included), so ` +
                  `JSON is out of effect and stdout is empty — got ` +
                  `${String(result.stdoutBytes.length)} bytes; ` +
                  summarizeResult(result),
              );
            }
            if (await pathExists(consumed)) {
              fail(
                `${context}: no hold file may be created at the consumed ` +
                  `path \`--json\` (resolved against the working directory) ` +
                  `— the flag is refused, not honored (SPEC 13.5, 12.0)`,
              );
            }
          },
          `${context}: the usage error modifies nothing (SPEC 12.0)`,
        );
      }
    });

    // Stale-workspace arm (SPEC 13.5: the hold precedes every modification,
    // the 13.3 refresh included) — on its own workspaces, the only in-scope
    // mutating command started on stale graph data.
    await staleWorkspaceArm(product);
  },
});

// ---------------------------------------------------------------------------
// T13.5-2 — mutual exclusion
// ---------------------------------------------------------------------------

const T13_5_2 = defineProductTest({
  id: "T13.5-2",
  title:
    "while a mutating command is held, each other mutating command (`rename`, file-form `move`, `review create/resolve/split`) fails promptly with exit 2 and modifies nothing — journal, sessions, and sources byte-identical, the compare bracketing each excluded command alone with its baseline taken while command 1 is already held; after command 1 completes, the second command succeeds (SPEC 13.5, 12.0)",
  run: async (product) => {
    await withWorkspace(CORE_DECL, async (workspace) => {
      await buildOk(product, workspace, "T13.5-2 staging `build`");
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        "T13.5-2 staging `review create --strategy audit --name s`",
      );
      const status = await sessionStatus(
        product,
        workspace,
        "s",
        "T13.5-2 staging",
      );
      const gItem = requireRowByScope(
        status,
        "specs/A.mdx#g",
        "T13.5-2 staging (leaf item)",
      );
      const aItem = requireRowByScope(
        status,
        "specs/A.mdx#a",
        "T13.5-2 staging (parent item)",
      );

      const hold = holdPathFor(workspace, "hold-primary.tmp");
      const context1 =
        "T13.5-2 command 1 `rename specs/A.mdx a a2 --test-hold <path>`";
      const running = await startProduct(product, {
        cwd: workspace.root,
        argv: ["rename", "specs/A.mdx", "a", "a2", "--test-hold", hold],
      });
      try {
        await awaitHoldFile(running, hold, context1);
        // Staging constraint (§VIOL-CORE-EARLYWRITE): the baseline snapshot
        // is taken while command 1 is already held, so each excluded
        // command's compare brackets that command alone.
        const heldBaseline = await snapshotDirectory(workspace.root);

        // Each other mutating command, valid in its own right (so exit 2 is
        // attributable to the exclusion alone) and carrying no --test-hold
        // (§VIOL-CORE-NOLOCK staging constraint).
        const excluded: readonly (readonly [readonly string[], string])[] = [
          [["rename", "specs/A.mdx", "g", "g2"], "`rename specs/A.mdx g g2`"],
          [
            ["move", "specs/A.mdx", "specs/B.mdx"],
            "`move specs/A.mdx specs/B.mdx`",
          ],
          [
            ["review", "create", "--strategy", "audit", "--name", "t"],
            "`review create --strategy audit --name t`",
          ],
          [
            ["review", "resolve", "s", gItem.id, "--status", "no-change"],
            "`review resolve s <leaf item> --status no-change`",
          ],
          [
            ["review", "split", "s", aItem.id],
            "`review split s <parent item>`",
          ],
        ];
        for (const [argv, what] of excluded) {
          const context = `T13.5-2 excluded ${what} while command 1 is held`;
          const result = await runBounded(
            product,
            workspace.root,
            argv,
            context,
          );
          assertExitCode(
            result,
            2,
            `${context}: a mutating command refused because another is ` +
              `running is a usage error (SPEC 13.5, 12.0)`,
          );
          if (running.hasExited()) {
            fail(
              `${context}: command 1 must still be held when the excluded ` +
                `command exits — the refusal is prompt, not a wait for ` +
                `command 1 (SPEC 13.5) — ${await describeExit(running)}`,
            );
          }
          const now = await snapshotDirectory(workspace.root);
          assertSnapshotsEqual(
            heldBaseline,
            now,
            `${context}: modifies nothing — journal, sessions, and sources ` +
              `byte-identical (SPEC 13.5)`,
          );
        }

        await releaseHoldFile(hold);
        let result1: RunResult;
        try {
          result1 = await running.waitForExit();
        } catch (error) {
          return fail(
            `${context1}: command 1 must complete normally once the hold ` +
              `file is deleted (SPEC 13.5) — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
        assertExitCode(
          result1,
          0,
          `${context1}: completes normally after release, so the exclusions ` +
            `above are attributable to the held command alone (SPEC 13.5)`,
        );
      } finally {
        running.kill();
        await releaseHoldFile(hold);
      }

      // After command 1 completes, the second command succeeds.
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "t"],
        0,
        "T13.5-2 `review create --strategy audit --name t` after command 1 " +
          "completed — exclusivity ended with normal completion (SPEC 13.5)",
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T13.5-3 — exclusivity ends with the process
// ---------------------------------------------------------------------------

const T13_5_3 = defineProductTest({
  id: "T13.5-3",
  title:
    "killing a held mutating command never blocks later commands: a subsequent mutating command — one that succeeds whether or not the killed operation's writes landed, not a retry of it — exits 0 (SPEC 13.5)",
  run: async (product) => {
    await withWorkspace(CORE_DECL, async (workspace) => {
      await buildOk(product, workspace, "T13.5-3 staging `build`");

      const hold = holdPathFor(workspace, "hold-killed.tmp");
      const context1 =
        "T13.5-3 held `rename specs/A.mdx a a2 --test-hold <path>`";
      const running = await startProduct(product, {
        cwd: workspace.root,
        argv: ["rename", "specs/A.mdx", "a", "a2", "--test-hold", hold],
      });
      try {
        await awaitHoldFile(running, hold, context1);
        running.kill("SIGKILL");
        // The kill settles the run; the death's shape is not asserted.
        await running.waitForExit();
      } finally {
        running.kill();
        // Deliberately no hold-file cleanup before the subsequent command:
        // everything the terminated holder left behind stays exactly as the
        // kill left it — a terminated holder never blocks (SPEC 13.5).
      }

      const context2 =
        "T13.5-3 subsequent `rename specs/A.mdx g g2` after the holder was " +
        "killed";
      const result = await runBounded(
        product,
        workspace.root,
        ["rename", "specs/A.mdx", "g", "g2"],
        context2,
      );
      assertExitCode(
        result,
        0,
        `${context2}: a terminated holder never blocks — the subsequent ` +
          `mutating command succeeds whether or not the killed operation's ` +
          `writes landed (SPEC 13.5; it renames \`g\`, independent of the ` +
          `killed \`a\`→\`a2\`, never a retry of it)`,
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T13.5-4 — readers during mutation; build/query storm
// ---------------------------------------------------------------------------

/** How many of each command the storm launches concurrently. */
const STORM_BUILDS = 4;
const STORM_QUERIES = 4;

/**
 * Snapshot exclusion for the storm arm's clean-build compare: omit the
 * journal — durable, not derived (SPEC 13.4). T13.5-4's charter is that any
 * derived-file inconsistency is resolved by the final `build`; whether
 * `build` and read commands modify the journal is T6.1-1's and T13.4-5's,
 * and CERTIFICATIONS.md's §VIOL-CORE-CHATTYREADS expected-failure set
 * depends on the 13.5 tests asserting derived-file behavior, never journal
 * bytes.
 */
function excludeJournalFile(relPathBytes: Uint8Array): boolean {
  return Buffer.from(relPathBytes).toString("latin1") === ".xspec/journal";
}

const T13_5_4 = defineProductTest({
  id: "T13.5-4",
  title:
    "while a mutating command is held, read commands still run and observe the prior state (exit codes and stdout bytes equal the pre-hold runs); non-mutating commands run concurrently with each other — a parallel build/query storm on one workspace terminates, and one final `build` resolves any derived-file inconsistency, byte-equal to a clean build (SPEC 13.5, 12.0)",
  run: async (product) => {
    // --- Held-phase reads: prior state ---
    await withWorkspace(CORE_DECL, async (workspace) => {
      await buildOk(product, workspace, "T13.5-4 staging `build`");
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        "T13.5-4 staging `review create --strategy audit --name s`",
      );

      // Representative read commands over the 13.3 read surface (§CONF-CORE).
      const reads: readonly (readonly [readonly string[], string])[] = [
        [["check"], "`check`"],
        [["ids", "--json"], "`ids --json`"],
        [["show", "specs/A.mdx#a", "--json"], "`show specs/A.mdx#a --json`"],
        [["query", "nodes"], "`query nodes`"],
        [["coverage", "--json"], "`coverage --json`"],
        [["review", "list", "--json"], "`review list --json`"],
      ];
      const before = new Map<string, RunResult>();
      for (const [argv, what] of reads) {
        const result = await runCli(product, workspace, argv);
        assertExitCode(result, 0, `T13.5-4 pre-hold ${what}`);
        before.set(what, result);
      }

      const hold = holdPathFor(workspace, "hold-reads.tmp");
      const contextHeld =
        "T13.5-4 held `rename specs/A.mdx a a2 --test-hold <path>`";
      const running = await startProduct(product, {
        cwd: workspace.root,
        argv: ["rename", "specs/A.mdx", "a", "a2", "--test-hold", hold],
      });
      try {
        await awaitHoldFile(running, hold, contextHeld);
        for (const [argv, what] of reads) {
          const context = `T13.5-4 ${what} while the rename is held`;
          const result = await runBounded(
            product,
            workspace.root,
            argv,
            context,
          );
          assertExitCode(
            result,
            0,
            `${context}: read commands still run while a mutating command ` +
              `is held (SPEC 13.5)`,
          );
          const reference = before.get(what);
          if (reference === undefined) {
            throw new Error(`T13.5-4 internal error: no pre-hold ${what}`);
          }
          assertBytesEqual(
            result.stdoutBytes,
            reference.stdoutBytes,
            `${context}: observes the prior state — stdout byte-identical ` +
              `to the same read before the mutation started (SPEC 13.5; ` +
              `12.0 byte-determinism: identical workspace bytes, identical ` +
              `answers)`,
          );
        }
        await releaseHoldFile(hold);
        let result: RunResult;
        try {
          result = await running.waitForExit();
        } catch (error) {
          return fail(
            `${contextHeld}: the held rename must complete normally once ` +
              `the hold file is deleted (SPEC 13.5) — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
        assertExitCode(
          result,
          0,
          `${contextHeld}: completes normally after release, so the ` +
            `held-phase observations are attributable to the hold (SPEC 13.5)`,
        );
      } finally {
        running.kill();
        await releaseHoldFile(hold);
      }
    });

    // --- Storm: non-mutating commands run concurrently with each other ---
    const storm = await TestWorkspace.create(CORE_DECL);
    const reference = await TestWorkspace.create(CORE_DECL);
    try {
      await buildOk(product, storm, "T13.5-4 storm workspace initial `build`");

      const stormCommands: readonly string[][] = [
        ...Array.from({ length: STORM_BUILDS }, () => ["build"]),
        ...Array.from({ length: STORM_QUERIES }, () => ["query", "nodes"]),
      ];
      const started: RunningProduct[] = [];
      try {
        for (const argv of stormCommands) {
          started.push(await startProduct(product, { cwd: storm.root, argv }));
        }
        const settled = await Promise.allSettled(
          started.map((running) => running.waitForExit()),
        );
        settled.forEach((outcome, index) => {
          if (outcome.status === "rejected") {
            const reason = outcome.reason as unknown;
            fail(
              `T13.5-4 storm: every concurrent non-mutating command must ` +
                `terminate (SPEC 13.5; the storm asserts termination — ` +
                `exit codes deliberately unasserted); ` +
                `\`${(stormCommands[index] ?? []).join(" ")}\` did not — ` +
                `${reason instanceof Error ? reason.message : String(reason)}`,
            );
          }
        });
      } finally {
        for (const running of started) {
          running.kill();
        }
      }

      // Any derived-file inconsistency is resolved by one final `build`,
      // byte-equal to a clean build of the identical fixture (H-6
      // two-directory style). The journal is excluded (see
      // excludeJournalFile): the compare's subject is derived files, and the
      // journal — durable, not derived — belongs to T6.1-1/T13.4-5.
      await buildOk(
        product,
        storm,
        "T13.5-4 final `build` after the storm (SPEC 13.5, 12.1)",
      );
      await buildOk(product, reference, "T13.5-4 clean reference `build`");
      await assertDirectoriesEqual(
        storm.root,
        reference.root,
        "T13.5-4: the storm workspace after one final `build` vs a clean " +
          "build of the identical fixture — any derived-file inconsistency " +
          "is resolved, byte-equal to a clean build (SPEC 13.5, 12.0; the " +
          "journal, durable rather than derived, is outside this compare)",
        { exclude: excludeJournalFile },
      );
    } finally {
      await storm.dispose();
      await reference.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T13.5-5 — atomic visibility
// ---------------------------------------------------------------------------

const POLL_FILE = "specs/P.mdx";
const POLL_MODULE = "specs/P.xspec.ts";
const POLL_TEXT_ONE = "Poll text state one.";
const POLL_TEXT_TWO =
  "A considerably longer poll text for state two, differing from the very " +
  "first byte on.";
/** Alternating builds after the first (property-style loop, TEST-SPEC 16). */
const POLL_ALTERNATIONS = 10;

function pollSource(text: string): string {
  return ['<S id="p">', text, "</S>", ""].join("\n");
}

const T13_5_5 = defineProductTest({
  id: "T13.5-5",
  title:
    "a concurrent reader polling a derived file during repeated builds only ever observes prior content, complete new content, or absence-before-first-write — never a partial file (SPEC 13.5; property-style loop, TEST-SPEC 16)",
  run: async (product) => {
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [POLL_FILE]: pollSource(POLL_TEXT_ONE),
        },
      },
      async (workspace) => {
        const moduleAbs = workspace.path(POLL_MODULE);

        // The polling reader: a tight read loop recording every distinct
        // observed content (deduplicated byte-exactly) and the absence
        // bookkeeping the validation rules need. It never throws — errors
        // are recorded and diagnosed after the loop (H-8).
        let stop = false;
        let observationCount = 0;
        let firstContentIndex = -1;
        let lastAbsentIndex = -1;
        let pollError: string | undefined;
        const distinctContents = new Map<
          string,
          { readonly bytes: Uint8Array; readonly firstIndex: number }
        >();
        const poller = (async () => {
          while (!stop) {
            const index = observationCount;
            observationCount += 1;
            try {
              const bytes: Uint8Array = await fsp.readFile(moduleAbs);
              if (firstContentIndex === -1) firstContentIndex = index;
              const key = Buffer.from(bytes).toString("latin1");
              if (!distinctContents.has(key)) {
                distinctContents.set(key, { bytes, firstIndex: index });
              }
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                lastAbsentIndex = index;
              } else {
                pollError ??= `observation #${String(index)}: ${(error as Error).message}`;
              }
            }
            await sleep(1);
          }
        })();

        // The legitimate complete contents: the polled path's bytes after
        // each completed build (SPEC 12.0 byte-determinism makes each state's
        // content a fixed point, so the set has one entry per distinct
        // source state).
        const legit = new Map<string, Uint8Array>();
        let buildOneDoneCount = 0;
        try {
          const buildAndRecord = async (label: string): Promise<void> => {
            await buildOk(product, workspace, label);
            const kind = await workspace.kind(POLL_MODULE);
            if (kind !== "file") {
              fail(
                `${label}: staging premise — \`build\` generates ` +
                  `${POLL_MODULE} as a plain file (SPEC 13.1); found ${kind}`,
              );
            }
            const bytes = await workspace.readBytes(POLL_MODULE);
            legit.set(Buffer.from(bytes).toString("latin1"), bytes);
          };

          await buildAndRecord("T13.5-5 `build` #1 (state one)");
          buildOneDoneCount = observationCount;
          for (let i = 0; i < POLL_ALTERNATIONS; i += 1) {
            const stateTwo = i % 2 === 0;
            await workspace.file(
              POLL_FILE,
              pollSource(stateTwo ? POLL_TEXT_TWO : POLL_TEXT_ONE),
            );
            await buildAndRecord(
              `T13.5-5 \`build\` #${String(i + 2)} (state ${stateTwo ? "two" : "one"})`,
            );
          }
        } finally {
          stop = true;
          await poller;
        }

        if (pollError !== undefined) {
          fail(
            `T13.5-5: the polling reader hit an unexpected filesystem ` +
              `error — ${pollError}`,
          );
        }
        if (observationCount === 0 || firstContentIndex === -1) {
          fail(
            "T13.5-5 staging premise: the polling reader must observe the " +
              "derived file during the builds (it recorded " +
              `${String(observationCount)} observations, first content at ` +
              `#${String(firstContentIndex)}) — the polling cadence or the ` +
              "build staging is broken",
          );
        }

        // Rule 1: every distinct observed content is a completed build's
        // content — never a partial file.
        for (const [key, observed] of distinctContents) {
          if (legit.has(key)) continue;
          const completeSizes = [...legit.values()]
            .map((bytes) => String(bytes.length))
            .join(", ");
          let nearest: Uint8Array | undefined;
          for (const candidate of legit.values()) {
            if (
              nearest === undefined ||
              Math.abs(candidate.length - observed.bytes.length) <
                Math.abs(nearest.length - observed.bytes.length)
            ) {
              nearest = candidate;
            }
          }
          fail(
            `T13.5-5: observation #${String(observed.firstIndex)} of ` +
              `${POLL_MODULE} matches no completed build's content — a ` +
              `concurrent reader only ever observes prior content or ` +
              `complete new content, never a partial file (SPEC 13.5). ` +
              `Observed ${String(observed.bytes.length)} bytes; completed ` +
              `contents have ${completeSizes} bytes.` +
              (nearest === undefined
                ? ""
                : `\n${describeByteDifference(observed.bytes, nearest, "observed", "complete")}`),
          );
        }
        // Rule 2: no absence after content has been observed.
        if (lastAbsentIndex > firstContentIndex) {
          fail(
            `T13.5-5: the polling reader observed absence at observation ` +
              `#${String(lastAbsentIndex)}, after first observing content ` +
              `at #${String(firstContentIndex)} — once the first write ` +
              `lands, the path holds prior or new content at every moment, ` +
              `never absence (SPEC 13.5)`,
          );
        }
        // Rule 3: no absence after the first build completed.
        if (lastAbsentIndex >= buildOneDoneCount) {
          fail(
            `T13.5-5: the polling reader observed absence at observation ` +
              `#${String(lastAbsentIndex)}, after the first \`build\` had ` +
              `already completed (observation count ` +
              `${String(buildOneDoneCount)} at completion) — absence is ` +
              `legal only before the first write (SPEC 13.5)`,
          );
        }
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T13.5-6 — workspace isolation
// ---------------------------------------------------------------------------

// The second workspace differs from the first in file name, IDs, and texts,
// so cross-workspace interference cannot cancel out.
const ISO_TWO_MDX = [
  '<S id="b">',
  "Bravo isolated text.",
  '<S id="b.k">',
  "Bravo kid text.",
  "</S>",
  "</S>",
  "",
  '<S id="h">',
  "Hotel isolated text.",
  "</S>",
  "",
].join("\n");

const ISO_TWO_DECL: WorkspaceDecl = {
  files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/B.mdx": ISO_TWO_MDX },
};

interface ScriptStep {
  readonly argv: readonly string[];
  readonly what: string;
}

/** The six-command scenario each "harness instance" drives. */
function scriptSteps(file: string, top: string): readonly ScriptStep[] {
  return [
    { argv: ["build"], what: "`build`" },
    {
      argv: ["review", "create", "--strategy", "audit", "--name", "s"],
      what: "`review create --strategy audit --name s`",
    },
    {
      argv: ["rename", file, top, `${top}2`],
      what: `\`rename ${file} ${top} ${top}2\``,
    },
    {
      argv: ["review", "status", "s", "--json"],
      what: "`review status s --json`",
    },
    { argv: ["ids", "--json"], what: "`ids --json`" },
    { argv: ["check"], what: "`check`" },
  ];
}

async function runScript(
  product: ProductBinding,
  workspace: TestWorkspace,
  steps: readonly ScriptStep[],
  contextPrefix: string,
): Promise<readonly RunResult[]> {
  const results: RunResult[] = [];
  for (const step of steps) {
    const result = await runCli(product, workspace, step.argv);
    assertExitCode(result, 0, `${contextPrefix} ${step.what}`);
    results.push(result);
  }
  return results;
}

const T13_5_6 = defineProductTest({
  id: "T13.5-6",
  title:
    "two workspaces driven concurrently by parallel harness instances never interfere: a mutating command in workspace 2 succeeds while workspace 1's is held (exclusion is per workspace), and a concurrently driven command script's outputs and final workspace trees equal serial runs (SPEC 13.5, H-1)",
  run: async (product) => {
    const stepsOne = scriptSteps("specs/A.mdx", "a");
    const stepsTwo = scriptSteps("specs/B.mdx", "b");
    const disposables: TestWorkspace[] = [];
    const create = async (decl: WorkspaceDecl): Promise<TestWorkspace> => {
      const workspace = await TestWorkspace.create(decl);
      disposables.push(workspace);
      return workspace;
    };
    try {
      // --- Held-overlap probe: exclusion is per workspace ---
      const heldOne = await create(CORE_DECL);
      const heldTwo = await create(ISO_TWO_DECL);
      await buildOk(product, heldOne, "T13.5-6 workspace 1 staging `build`");
      await buildOk(product, heldTwo, "T13.5-6 workspace 2 staging `build`");
      const hold = holdPathFor(heldOne, "hold-iso.tmp");
      const contextHeld =
        "T13.5-6 workspace 1 held `rename specs/A.mdx a a2 --test-hold <path>`";
      const running = await startProduct(product, {
        cwd: heldOne.root,
        argv: ["rename", "specs/A.mdx", "a", "a2", "--test-hold", hold],
      });
      try {
        await awaitHoldFile(running, hold, contextHeld);
        const context =
          "T13.5-6 `rename specs/B.mdx b b2` in workspace 2 while " +
          "workspace 1's rename is held";
        const result = await runBounded(
          product,
          heldTwo.root,
          ["rename", "specs/B.mdx", "b", "b2"],
          context,
        );
        assertExitCode(
          result,
          0,
          `${context}: instances operating on different workspaces never ` +
            `interfere — mutual exclusion is per workspace (SPEC 13.5, H-1)`,
        );
        if (running.hasExited()) {
          fail(
            `${context}: workspace 1's held command must still be running ` +
              `when workspace 2's completes — otherwise the success is not ` +
              `attributable to per-workspace exclusion (SPEC 13.5) — ` +
              `${await describeExit(running)}`,
          );
        }
        await releaseHoldFile(hold);
        let result1: RunResult;
        try {
          result1 = await running.waitForExit();
        } catch (error) {
          return fail(
            `${contextHeld}: workspace 1's rename must complete normally ` +
              `once the hold file is deleted (SPEC 13.5) — ` +
              `${error instanceof Error ? error.message : String(error)}`,
          );
        }
        assertExitCode(
          result1,
          0,
          `${contextHeld}: completes normally after release (SPEC 13.5)`,
        );
      } finally {
        running.kill();
        await releaseHoldFile(hold);
      }

      // --- Concurrent runs equal serial runs ---
      const serialOne = await create(CORE_DECL);
      const serialTwo = await create(ISO_TWO_DECL);
      const serialResultsOne = await runScript(
        product,
        serialOne,
        stepsOne,
        "T13.5-6 serial workspace 1",
      );
      const serialResultsTwo = await runScript(
        product,
        serialTwo,
        stepsTwo,
        "T13.5-6 serial workspace 2",
      );

      const concurrentOne = await create(CORE_DECL);
      const concurrentTwo = await create(ISO_TWO_DECL);
      const settled = await Promise.allSettled([
        runScript(
          product,
          concurrentOne,
          stepsOne,
          "T13.5-6 concurrent workspace 1",
        ),
        runScript(
          product,
          concurrentTwo,
          stepsTwo,
          "T13.5-6 concurrent workspace 2",
        ),
      ]);
      for (const outcome of settled) {
        if (outcome.status === "rejected") {
          const reason = outcome.reason as unknown;
          if (reason instanceof HarnessAssertionError) throw reason;
          fail(
            `T13.5-6 concurrent phase: ` +
              `${reason instanceof Error ? reason.message : String(reason)}`,
          );
        }
      }
      const [concurrentResultsOne, concurrentResultsTwo] = settled.map(
        (outcome) =>
          (outcome as PromiseFulfilledResult<readonly RunResult[]>).value,
      );

      const compareRuns = (
        concurrent: readonly RunResult[] | undefined,
        serial: readonly RunResult[],
        steps: readonly ScriptStep[],
        which: string,
      ): void => {
        if (concurrent === undefined) {
          throw new Error("T13.5-6 internal error: missing concurrent runs");
        }
        for (let i = 0; i < steps.length; i += 1) {
          const step = steps[i] as ScriptStep;
          assertBytesEqual(
            (concurrent[i] as RunResult).stdoutBytes,
            (serial[i] as RunResult).stdoutBytes,
            `T13.5-6 ${which} ${step.what}: the concurrently driven run's ` +
              `stdout equals the serial run's byte-for-byte — concurrent ` +
              `results equal serial runs (SPEC 13.5, 12.0)`,
          );
        }
      };
      compareRuns(
        concurrentResultsOne,
        serialResultsOne,
        stepsOne,
        "workspace 1",
      );
      compareRuns(
        concurrentResultsTwo,
        serialResultsTwo,
        stepsTwo,
        "workspace 2",
      );

      await assertDirectoriesEqual(
        concurrentOne.root,
        serialOne.root,
        "T13.5-6 workspace 1: the concurrently driven workspace's final " +
          "byte tree vs the serial run's — never interferes (SPEC 13.5, H-1)",
      );
      await assertDirectoriesEqual(
        concurrentTwo.root,
        serialTwo.root,
        "T13.5-6 workspace 2: the concurrently driven workspace's final " +
          "byte tree vs the serial run's — never interferes (SPEC 13.5, H-1)",
      );
    } finally {
      for (const workspace of disposables) {
        await workspace.dispose();
      }
    }
  },
});

// ---------------------------------------------------------------------------
// T13.5-7 — interrupted or write-refused mutation: the pinned write order
// ---------------------------------------------------------------------------

// The refusal arms (a)–(f), their fixtures, stagings, twins, and the
// pinned-state laws live in write-refusal-staging.ts (shared with T14-9);
// this entry composes them: the rename twin once (arms (a), (b), and the
// kill arm read their expectations from it), the refusal arms on the Linux
// leg (E-1: permission stagings are Linux-only; elsewhere they are not
// staged — the NU3_STAGED pattern of section-11.5 — and the Windows subset
// selects T13.5-7 nowhere), then the platform-safe kill arm.
const T13_5_7 = defineProductTest({
  id: "T13.5-7",
  title:
    "interrupted or write-refused mutation: a write the environment refuses stops the command at that write — exit 2 with the error document (`write-failure`, the concerned path) — leaving every earlier write of 13.5's pinned per-command order complete and no later one attempted, each state read from a twin on which the same operation ran unrefused: (a) source edits first in preview `files` order, (b) the journal append as the commit point, (c) the identity effect complete once appended, (d) a relocation's two writes, (e) `review` mutators writing the session file once, last, after the refresh, (f) `build` and a refresh each file complete with the order unpinned, and a refreshing read refused at its graph-data write; the kill arm: `check` never crashes and reports exactly a state 13.5 admits (SPEC 13.5, 14.24, 12.0, 12.7, 6.4, 6.7, 13.3)",
  // A hang guard only (H-10): some twenty workspaces, each built, renamed,
  // checked, and driven — generous under a saturated box.
  timeoutMs: 600_000,
  run: async (product) => {
    const rename = await renameTwin(product);
    if (WRITE_REFUSALS_STAGED) {
      await runWriteRefusalArms(product, rename);
    }
    await runKillArm(product, rename);
  },
});

/** TEST-SPEC §13.5, in canonical ID order (SUITE-48). */
// ---------------------------------------------------------------------------
// T13.5-8 — acquisition before every later check
// ---------------------------------------------------------------------------

// The one condition CONF-CORE's failing workspace stages (CERTIFICATIONS.md
// §CONF-CORE's staging constraint on T13.5-8): a second spec source beginning
// with a UTF-8 byte-order mark — unparseable (SPEC 1.6, 14.20), its finding
// the zero-length range at offset 0 (SPEC 14), the file masked and never an
// operand of any arm's command — added after the workspace was built valid
// and after the session the held `review resolve` names was created under
// `--strategy audit`. U+FEFF encodes to EF BB BF; the workspace builder
// writes string contents with BOMs kept (S-2). The code point is spelled
// numerically so the source carries no escape sequence to misread.
const BOM_FILE = "specs/B.mdx";
const BOM_MDX =
  String.fromCodePoint(0xfeff) + '<S id="b">\nBom content.\n</S>\n';

/**
 * The failing workspace's findings as `build` and the gate of 13.3 report
 * them: exactly one finding, condition 20 (unparseable source), located in
 * the BOM-led file — the one condition the staging presents (§CONF-CORE).
 * The finding's identity and file carry the arm; the range SPEC 14 pins for
 * a byte-order mark (zero-length, at offset 0) is 14.20's own subject
 * (T1.6-5, T14), not this test's, so it is not re-asserted here.
 */
function assertGateFindings(
  findings: readonly Finding[],
  context: string,
): void {
  assertConditionCounts(
    findings,
    { "14.20": 1 },
    `${context}: exactly the one condition the failing workspace stages — ` +
      `the BOM-led source's unparseability (SPEC 14.20, 13.3)`,
  );
  assertFindingLocated(
    findings[0]!,
    { file: BOM_FILE },
    `${context}: the condition-20 finding locates the BOM-led file ` +
      `${BOM_FILE} — the masked source, never an operand (SPEC 14, 14.20)`,
  );
}

/**
 * Drive one invocation a later check refuses or the gate turns back, under
 * `--test-hold` with no other holder (SPEC 13.5: exclusivity is acquired
 * before the argument checks of 12.0, baseline resolution (6.3), and the
 * gate of 13.3, so the seam engages on such an invocation too): the hold
 * file is created first — the wait fails loud, a diagnosed product failure,
 * when the command exits before creating it, as a product acquiring late
 * does, reporting the refusal at once with no hold file (§CONF-CORE's
 * justification; H-8, H-9: never a pass on the command's exit or on a
 * timeout) — the workspace is byte-identical while held, the command is
 * still running after the while-held snapshot, and only once the harness
 * deletes the hold file does it exit, with `expectedExit` and nothing
 * modified. Returns the run for the caller's own report assertions.
 */
async function refusedSeamArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  holdName: string,
  expectedExit: number,
  context: string,
  ordering: string,
): Promise<RunResult> {
  const hold = holdPathFor(workspace, holdName);
  const before = await snapshotDirectory(workspace.root);
  const running = await startProduct(product, {
    cwd: workspace.root,
    argv: [...argv, "--test-hold", hold],
  });
  try {
    await awaitHoldFile(
      running,
      hold,
      `${context}: ${ordering}, so the hold file is created before the ` +
        `refusal is judged — a product judging it first reports it without ` +
        `ever creating the hold file`,
    );
    await assertEmptyHoldFile(hold, context);
    const whileHeld = await snapshotDirectory(workspace.root);
    assertSnapshotsEqual(
      before,
      whileHeld,
      `${context}: the workspace while held vs before the command started — ` +
        `byte-identical: the hold precedes every later check and every ` +
        `modification, and a refused invocation modifies nothing (SPEC 13.5)`,
    );
    if (running.hasExited()) {
      fail(
        `${context}: the command must exit only after the hold file is ` +
          `deleted — its refusal follows the hold — but it exited while the ` +
          `hold file still existed (SPEC 13.5) — ${await describeExit(running)}`,
      );
    }
    await releaseHoldFile(hold);
    let result: RunResult;
    try {
      result = await running.waitForExit();
    } catch (error) {
      return fail(
        `${context}: once the hold file is deleted the command must proceed ` +
          `to its own refusal and exit (SPEC 13.5) — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
    assertExitCode(
      result,
      expectedExit,
      `${context}: after the hold's deletion the command exits with its ` +
        `own outcome — ${ordering} (SPEC 13.5, 12.0)`,
    );
    assertSnapshotsEqual(
      before,
      await snapshotDirectory(workspace.root),
      `${context}: the refused invocation modifies nothing — before, while ` +
        `held, and after (SPEC 13.5, 12.0)`,
    );
    return result;
  } finally {
    running.kill();
    await releaseHoldFile(hold);
  }
}

/**
 * The failing-workspace arms — exclusion first, then the gate's seam
 * ordering — on one workspace built valid, its audit session created, and
 * only then failed by the BOM-led second source (§CONF-CORE): the gate
 * writes nothing on it (SPEC 13.3), so every command here starts where no
 * refresh is pending (§VIOL-CORE-EARLYREFRESH's passing side). The `build`
 * that establishes the failing workspace runs outside every bracket and
 * before anything is held (§VIOL-CORE-CHATTYREADS's passing side).
 */
async function failingWorkspaceArms(product: ProductBinding): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    await buildOk(product, workspace, "T13.5-8 staging `build`");
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", "s"],
      0,
      "T13.5-8 staging `review create --strategy audit --name s`",
    );
    const status = await sessionStatus(
      product,
      workspace,
      "s",
      "T13.5-8 staging",
    );
    const gItem = requireRowByScope(
      status,
      "specs/A.mdx#g",
      "T13.5-8 staging (leaf item)",
    );

    // The workspace now fails `build`'s validations: the staging premise,
    // established through `build --json` itself — exit 1, exactly the
    // condition-20 finding at the BOM file's offset 0 — before any command
    // is held and outside every bracket.
    await workspace.file(BOM_FILE, BOM_MDX, { mdx: "unparseable" });
    const premise =
      "T13.5-8 staging premise `build --json` on the failing workspace " +
      `(${BOM_FILE} begins with a byte-order mark)`;
    assertGateFindings(
      await buildFindings(product, workspace, premise),
      premise,
    );

    // Exclusion first (SPEC 13.5: the refusal precedes the gate's findings
    // and the precondition's): command 1 is `review resolve` under
    // `--test-hold` — acquisition precedes the gate of 13.3, so it holds
    // rather than exiting 1 at the gate — and each other mutating command,
    // valid in its own right and carrying no `--test-hold`
    // (§VIOL-CORE-NOLOCK's staging constraint), is refused exit 2 while it
    // is held, never the gate's or the precondition's exit 1, modifying
    // nothing — the compare bracketing each excluded command alone with its
    // baseline taken while command 1 is already held (§CONF-CORE,
    // §VIOL-CORE-EARLYWRITE; T13.5-2's compare).
    const hold = holdPathFor(workspace, "hold-resolve.tmp");
    const context1 =
      "T13.5-8 command 1 `review resolve s <leaf item> --status skipped " +
      "--test-hold <path>` on the failing workspace";
    const running = await startProduct(product, {
      cwd: workspace.root,
      argv: [
        "review",
        "resolve",
        "s",
        gItem.id,
        "--status",
        "skipped",
        "--test-hold",
        hold,
      ],
    });
    try {
      await awaitHoldFile(
        running,
        hold,
        `${context1}: exclusivity is acquired before the gate of 13.3, so ` +
          `the hold file is created before the gate turns the command back ` +
          `— a product running the gate first exits 1 there without ever ` +
          `creating it`,
      );
      await assertEmptyHoldFile(hold, context1);
      const heldBaseline = await snapshotDirectory(workspace.root);
      const excluded: readonly (readonly [
        readonly string[],
        string,
        string,
      ])[] = [
        [
          ["review", "create", "--strategy", "audit", "--name", "n"],
          "`review create --strategy audit --name n`",
          "the gate of 13.3",
        ],
        [
          ["review", "resolve", "s", gItem.id, "--status", "skipped"],
          "`review resolve s <leaf item> --status skipped`",
          "the gate of 13.3",
        ],
        [
          ["rename", "specs/A.mdx", "a", "b"],
          "`rename specs/A.mdx a b`",
          "rename's valid-workspace precondition (6.4)",
        ],
      ];
      for (const [argv, what, later] of excluded) {
        const context = `T13.5-8 excluded ${what} while command 1 is held on the failing workspace`;
        const result = await runBounded(product, workspace.root, argv, context);
        assertExitCode(
          result,
          2,
          `${context}: the mutual-exclusion refusal precedes ${later} — a ` +
            `usage error, exit 2, never the exit 1 of a product that runs ` +
            `${later} before acquiring exclusivity (SPEC 13.5, 13.3, 12.0)`,
        );
        if (running.hasExited()) {
          fail(
            `${context}: command 1 must still be held when the excluded ` +
              `command exits — the refusal is prompt, not a wait for ` +
              `command 1 (SPEC 13.5) — ${await describeExit(running)}`,
          );
        }
        assertSnapshotsEqual(
          heldBaseline,
          await snapshotDirectory(workspace.root),
          `${context}: modifies nothing — journal, sessions, and sources ` +
            `byte-identical (SPEC 13.5; T13.5-2's compare)`,
        );
      }

      await releaseHoldFile(hold);
      let result1: RunResult;
      try {
        result1 = await running.waitForExit();
      } catch (error) {
        return fail(
          `${context1}: once the hold file is deleted command 1 must ` +
            `proceed to the gate and exit (SPEC 13.5, 13.3) — ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
      assertExitCode(
        result1,
        1,
        `${context1}: after the hold's deletion the gate of 13.3 turns the ` +
          `command back with the failing workspace's findings, exit 1 (SPEC ` +
          `13.3, 13.5)`,
      );
      assertSnapshotsEqual(
        heldBaseline,
        await snapshotDirectory(workspace.root),
        `${context1}: the gate writes nothing — the session file unchanged, ` +
          `no refresh on a failing workspace (SPEC 13.3)`,
      );
    } finally {
      running.kill();
      await releaseHoldFile(hold);
    }

    // Seam ordering at the gate (SPEC 13.3: for a mutating `review`
    // subcommand, exclusivity acquisition precedes the gate's report; 13.5):
    // with no other holder, `review create --strategy audit --name n` on the
    // failing workspace creates the hold file first, holds the workspace
    // byte-identical, and only after the hold's deletion exits 1 with the
    // condition-20 finding, creating no session.
    const gateContext =
      "T13.5-8 (seam ordering at the gate: `review create --strategy audit " +
      "--name n --json --test-hold <path>` on the failing workspace)";
    const gateResult = await refusedSeamArm(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", "n", "--json"],
      "hold-gate.tmp",
      1,
      gateContext,
      "exclusivity is acquired before the gate of 13.3",
    );
    assertGateFindings(
      decodeFindingsReport(
        parseJsonStdout(
          gateResult,
          `${gateContext} — the gate's report is the findings report of ` +
            `12.7 as the entire stdout (SPEC 13.3, 12.0, H-5)`,
        ),
        gateContext,
      ).findings,
      gateContext,
    );
  });
}

/**
 * The valid-workspace arms: the seam ordering of the 12.0 argument checks
 * and of baseline resolution (6.3), then the non-mutating boundary of 6.6 —
 * each refused invocation started on a freshly built workspace with no
 * refresh pending (§CONF-CORE's freshness constraint) that lies in no
 * repository (§CONF-CORE's staging constraint on the baseline arm: every
 * ref is unresolvable there, whatever its spelling).
 */
async function validWorkspaceArms(product: ProductBinding): Promise<void> {
  await withWorkspace(CORE_DECL, async (workspace) => {
    await buildOk(
      product,
      workspace,
      "T13.5-8 staging `build` (valid workspace)",
    );
    await assertOutsideAnyRepository(
      workspace.root,
      "T13.5-8 (seam ordering: `review create --base <unresolvable-ref>`)",
    );

    // A nonexistent old ID: the argument checks of 12.0 refuse it (6.4),
    // after acquisition and the hold.
    await refusedSeamArm(
      product,
      workspace,
      ["rename", "specs/A.mdx", "nope", "x"],
      "hold-nope.tmp",
      2,
      "T13.5-8 (seam ordering: `rename specs/A.mdx nope x --test-hold " +
        "<path>`, a nonexistent old ID)",
      "exclusivity is acquired before the argument checks of 12.0 — a " +
        "nonexistent old ID's usage error (6.4)",
    );

    // An unresolvable baseline: in no repository, no ref can be read — a
    // usage error (6.3, 12.0), judged after acquisition and the hold.
    await refusedSeamArm(
      product,
      workspace,
      ["review", "create", "--base", "no-such-ref", "--name", "n"],
      "hold-base.tmp",
      2,
      "T13.5-8 (seam ordering: `review create --base no-such-ref --name n " +
        "--test-hold <path>`, the workspace in no repository)",
      "exclusivity is acquired before baseline resolution — a baseline " +
        "that cannot be read is a usage error (6.3)",
    );

    // The non-mutating boundary (SPEC 6.6: a preview acquires no
    // exclusivity and does not take the acquisition-tied seam): the refused
    // preview exits 2 at once, and `--test-hold` beside `--preview` is
    // itself a usage error creating no hold file (T6.6-3).
    const previewContext =
      "T13.5-8 (non-mutating boundary: `rename specs/A.mdx nope x --preview`)";
    await assertLeavesUnchanged(
      workspace.root,
      async () => {
        const result = await runBounded(
          product,
          workspace.root,
          ["rename", "specs/A.mdx", "nope", "x", "--preview"],
          previewContext,
        );
        assertExitCode(
          result,
          2,
          `${previewContext}: the refused preview — a nonexistent old ID's ` +
            `usage error — exits 2 at once, a preview acquiring no ` +
            `exclusivity and taking no seam (SPEC 6.6, 6.4, 12.0)`,
        );
      },
      `${previewContext}: a preview modifies nothing (SPEC 6.6)`,
    );
    const previewHold = holdPathFor(workspace, "hold-preview.tmp");
    const combinedContext =
      "T13.5-8 (non-mutating boundary: `rename specs/A.mdx nope x --preview " +
      "--test-hold <path>`)";
    await assertLeavesUnchanged(
      workspace.root,
      async () => {
        const result = await runBounded(
          product,
          workspace.root,
          [
            "rename",
            "specs/A.mdx",
            "nope",
            "x",
            "--preview",
            "--test-hold",
            previewHold,
          ],
          combinedContext,
        );
        assertExitCode(
          result,
          2,
          `${combinedContext}: --test-hold beside --preview is a usage ` +
            `error — a preview does not take the acquisition-tied seam ` +
            `(SPEC 6.6, 12.0; T6.6-3)`,
        );
        if (await pathExists(previewHold)) {
          fail(
            `${combinedContext}: no hold file may be created — a preview ` +
              `acquires nothing, and the flag is refused, not honored ` +
              `(SPEC 6.6, 13.5)`,
          );
        }
      },
      `${combinedContext}: the usage error modifies nothing (SPEC 6.6, 12.0)`,
    );
  });
}

const T13_5_8 = defineProductTest({
  id: "T13.5-8",
  title:
    "acquisition precedes every later check: while `review resolve --test-hold` is held on a workspace failing `build`'s validations (a second spec source beginning with a byte-order mark, 14.20), `review create --strategy audit --name n`, `review resolve s <item> --status skipped`, and `rename specs/A.mdx a b` each fail promptly with the exclusion usage error, exit 2 — never the gate's or the precondition's exit 1 — modifying nothing; under `--test-hold` with no other holder, `rename specs/A.mdx nope x` (a nonexistent old ID, 12.0), `review create --base <unresolvable-ref> --name n` (6.3, the workspace in no repository), and, on the failing workspace, `review create --strategy audit --name n` (13.3's gate) each create the hold file first — the wait failing loud when the command exits without creating it — the workspace byte-identical while held, and exit 2, 2, and 1 with their own usage error or the condition-20 finding only after the hold's deletion, nothing modified; the non-mutating boundary: `rename specs/A.mdx nope x --preview` exits 2 at once acquiring nothing, and `--test-hold` beside `--preview` is exit 2 creating no hold file (SPEC 13.5, 13.3, 6.3, 6.4, 6.6, 12.0, 14)",
  run: async (product) => {
    await failingWorkspaceArms(product);
    await validWorkspaceArms(product);
  },
});

export const section135Tests: readonly ProductTestEntry[] = [
  T13_5_1,
  T13_5_2,
  T13_5_3,
  T13_5_4,
  T13_5_5,
  T13_5_6,
  T13_5_7,
  T13_5_8,
];
