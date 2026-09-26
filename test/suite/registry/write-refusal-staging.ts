// TEST-SPEC T13.5-7 / T14-9 — the write-refusal stagings (a)–(f) and the
// choreography that applies them while a mutating command is held at the
// seam of SPEC 13.5, shared by T13.5-7 (the per-command states a refused
// write leaves; section-13.5.ts) and T14-9 (the 14.24 contract; section-14).
//
// Staging discipline (TEST-SPEC T14-9, E-1): an environment refusal is staged
// by permission removal alone through helpers/permissions.ts — the directory
// holding the concerned path made read-only and its occupant, where one
// exists, unwritable — so creation, replacement in place or by renaming,
// appending, and removal are all refused whatever write strategy the product
// uses; each staging verifies itself on the harness's own process before the
// product proceeds and throws `HarnessStagingError` (a harness error, never a
// diagnosed failure or a skip, H-9/H-11) when the runner is privileged. For a
// mutating command the staging is applied while the command is held at the
// seam — after acquisition and before any modification — so the product's
// exclusivity mechanism, wherever it keeps state, never meets the staging
// (seam neutrality, T13.5-1); `build` and the reads take no hold (13.5 lists
// them among the non-exclusive commands), so their staging precedes the
// invocation. Every staging is restored the moment the staged command exits.
//
// Expectations are read from twins (H-6): every rewritten-byte expectation is
// the state an identical twin workspace reaches when the same operation runs
// unrefused, and every "untouched" expectation is the workspace's own
// pre-invocation snapshot — SPEC 13.5 pins the state a stopped command
// leaves as "every earlier write complete, no later one attempted" in the
// per-command write order, which `assertPinnedState` asserts entry by entry;
// where 13.5 leaves an order unpinned (a regeneration's derived-file writes)
// `assertEachWriteComplete` asserts the weaker law — each entry is its prior
// state or its complete new content — and `check`'s expected staleness set
// is computed by comparison with the twin (`derivedPathsDifferingFrom`,
// `graphDataDiffers`; TEST-SPEC T13.5-7 (b), (f)).
//
// Every arm starts from a freshly built, valid, journal-bearing workspace
// with no refresh pending (`prepareRefusalWorkspace`): `build`, then a prior
// journaled rename (SPEC 6.1: the journal comes into existence with the first
// journaled operation — `build` need not create it), then `check` clean,
// then a git commit serving as the `impact --base` baseline of the recovery
// assertions (6.3, 6.7). The fixtures deliberately leave CONF-CORE's in-scope
// shape (imports, a code group, Markdown emission): T13.5-7 and T14-9 are
// uncertified (CERTIFICATIONS.md §Exclusions).

import { Buffer } from "node:buffer";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import type {
  Finding,
  ImpactReport,
  SessionStatusReport,
} from "../../helpers/adapters/index.js";
import {
  decodeFindingsReport,
  decodeImpactReport,
  decodeSessionStatusReport,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import type { PermissionStaging } from "../../helpers/permissions.js";
import {
  stageWriteRefusal,
  stageWriteRefusalUnder,
} from "../../helpers/permissions.js";
import type {
  DirectorySnapshot,
  SnapshotEntry,
} from "../../helpers/snapshot.js";
import {
  assertLeavesUnchanged,
  assertSnapshotsEqual,
  describeEntry,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type {
  ProductBinding,
  RunningProduct,
  RunResult,
} from "../../helpers/subprocess.js";
import {
  releaseHoldFile,
  runProduct,
  startProduct,
  summarizeResult,
} from "../../helpers/subprocess.js";
import type { WorkspaceDecl } from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  buildOk,
  expectErrorDocument,
  expectExit,
  runJson,
} from "./support.js";

/** The refusal arms are staged on the Linux leg only (TEST-SPEC E-1). */
export const WRITE_REFUSALS_STAGED = process.platform === "linux";

// ---------------------------------------------------------------------------
// Hold-seam helpers (SPEC 13.5's `--test-hold`), shared with section-13.5.ts
// and, through its re-export, T6.6-3.
// ---------------------------------------------------------------------------

/**
 * An absolute hold-file path in the workspace's temporary directory — beside
 * the workspace root, never inside it, so whole-root byte snapshots are
 * unaffected and disposal cleans it up.
 */
export function holdPathFor(workspace: TestWorkspace, name: string): string {
  return path.join(workspace.tempRoot, name);
}

/**
 * Await the hold file's appearance, converting the driver's diagnosed
 * rejection (the process exited first, or the wait timed out) into a
 * diagnosed assertion failure (H-8).
 */
export async function awaitHoldFile(
  running: RunningProduct,
  absPath: string,
  context: string,
): Promise<void> {
  try {
    await running.waitForFile(absPath);
  } catch (error) {
    fail(
      `${context}: the mutating command must create the hold file at ` +
        `${absPath} immediately after acquiring workspace exclusivity and ` +
        `before modifying anything (SPEC 13.5) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A fixture and the prior journaled rename that makes it journal-bearing. */
export interface RefusalFixture {
  readonly decl: WorkspaceDecl;
  readonly priorRename: readonly string[];
}

// The rename fixture (T13.5-7 (a), (b), (e), (f), and the kill arm): one spec
// group with Markdown emitted beside each source, and a rename whose section
// lives in `specs/b/B.mdx`, referenced from `specs/a/A.mdx` (a `d`
// reference) and `specs/c/C.mdx` (an embedding) — the preview's `files`
// order by path bytes is A, B, C (SPEC 6.6, 12.7). The sources are staged
// under `b0`; the prior journaled rename `b0` → `b` leaves them under `b`, so
// the arms' rename is `b` → `b2`.
const RENAME_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true }
})
`;
const RENAME_A = [
  'import B from "../b/B.xspec"',
  "",
  '<S id="a" d={B.b0}>',
  "Alpha text.",
  "</S>",
  "",
].join("\n");
const RENAME_B = [
  '<S id="b0">',
  "Beta text.",
  '<S id="b0.k">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
].join("\n");
const RENAME_C = [
  'import B from "../b/B.xspec"',
  "",
  '<S id="c">',
  "Ceta embeds: {text(B.b0)}",
  "</S>",
  "",
].join("\n");

export const RENAME_A_PATH = "specs/a/A.mdx";
export const RENAME_B_PATH = "specs/b/B.mdx";
export const RENAME_C_PATH = "specs/c/C.mdx";
export const RENAME_B_DIR = "specs/b";
export const RENAME_B_MODULE = "specs/b/B.xspec.ts";
export const RENAME_OLD_IDENTITY = "specs/b/B.mdx#b";
export const RENAME_NEW_IDENTITY = "specs/b/B.mdx#b2";
/** The arms' rename: `b` → `b2` in `specs/b/B.mdx` (SPEC 6.4). */
export const RENAME_ARGV: readonly string[] = [
  "rename",
  RENAME_B_PATH,
  "b",
  "b2",
];

export const RENAME_FIXTURE: RefusalFixture = {
  decl: {
    files: {
      "xspec.config.ts": RENAME_CONFIG,
      [RENAME_A_PATH]: RENAME_A,
      [RENAME_B_PATH]: RENAME_B,
      [RENAME_C_PATH]: RENAME_C,
    },
  },
  priorRename: ["rename", RENAME_B_PATH, "b0", "b"],
};

// The move fixture (T13.5-7 (c), (d)): a file-form move `specs/A.mdx` →
// `specs/sub/B.mdx` under `markdown: { emit: true, outDir: "out" }`, the
// moved file importing `docs/Other.mdx` (its own specifier is rewritten
// across the directory change, so the destination's bytes differ from the
// origin's) and imported by the code source `src/app.ts` (the importer whose
// specifier the move rewrites) — `files` order: the relocation's entry
// `specs/A.mdx`, then `src/app.ts` (SPEC 6.5, 6.6, 12.7). The imported file
// lives under a second glob root, `docs/`, so that `out/specs` holds exactly
// the two Markdown files the move concerns — `out/specs/A.md` to remove and
// `out/specs/sub/B.md` to create — whatever else a regeneration rewrites
// (arm (c) stages `out/specs` unwritable and admits exactly those two
// writes). The prior journaled rename `oth0` → `oth` in `docs/Other.mdx`
// makes the workspace journal-bearing.
const MOVE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx", "docs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  },
  markdown: { emit: true, outDir: "out" }
})
`;
const MOVE_OTHER = ['<S id="oth0">', "Other text.", "</S>", ""].join("\n");
const MOVE_A = [
  'import Other from "../docs/Other.xspec"',
  "",
  '<S id="a" d={Other.oth0}>',
  "Alpha text.",
  "</S>",
  "",
].join("\n");
const MOVE_APP = ['import A from "../specs/A.xspec";', "", "A.a;", ""].join(
  "\n",
);

export const MOVE_ORIGIN = "specs/A.mdx";
export const MOVE_DESTINATION = "specs/sub/B.mdx";
export const MOVE_DESTINATION_DIR = "specs/sub";
export const MOVE_IMPORTER = "src/app.ts";
export const MOVE_OTHER_PATH = "docs/Other.mdx";
/** The emitted-Markdown area the regeneration writes under (T13.5-7 (c)). */
export const MOVE_MARKDOWN_DIR = "out/specs";
/** The two Markdown writes the move's regeneration owes under `out/specs`. */
export const MOVE_MARKDOWN_WRITES: readonly string[] = [
  "out/specs/sub/B.md",
  "out/specs/A.md",
];
/** The arms' file-form move (SPEC 6.5). */
export const MOVE_ARGV: readonly string[] = [
  "move",
  MOVE_ORIGIN,
  MOVE_DESTINATION,
];

export const MOVE_FIXTURE: RefusalFixture = {
  decl: {
    files: {
      "xspec.config.ts": MOVE_CONFIG,
      [MOVE_OTHER_PATH]: MOVE_OTHER,
      [MOVE_ORIGIN]: MOVE_A,
      [MOVE_IMPORTER]: MOVE_APP,
    },
  },
  priorRename: ["rename", MOVE_OTHER_PATH, "oth0", "oth"],
};

export const JOURNAL_PATH = ".xspec/journal";
export const GRAPH_DATA_AREA = ".xspec";
export const REVIEWS_DIR = ".xspec/reviews";

// ---------------------------------------------------------------------------
// Workspace preparation and twins
// ---------------------------------------------------------------------------

/** A prepared workspace, its `impact` baseline, and its pre-operation state. */
export interface PreparedWorkspace {
  readonly workspace: TestWorkspace;
  /** The commit holding the prepared sources and journal (SPEC 6.3). */
  readonly baseline: string;
  /** Every workspace entry at the end of preparation (`.git` excluded). */
  readonly before: DirectorySnapshot;
}

const GIT_DIR_BYTES = Buffer.from(".git", "utf8");

/** Exclude exactly the top-level `.git` tree (the harness's own baseline). */
function excludeGitTree(relPathBytes: Uint8Array): boolean {
  return Buffer.compare(Buffer.from(relPathBytes), GIT_DIR_BYTES) === 0;
}

/** The byte state of every workspace entry, `.git` excluded. */
export async function snapshotWorkspace(
  root: string,
): Promise<DirectorySnapshot> {
  return await snapshotDirectory(root, { exclude: excludeGitTree });
}

/**
 * Stage T13.5-7's common start: a freshly built, valid, journal-bearing
 * workspace with no refresh pending — `build`, the fixture's prior journaled
 * rename (SPEC 6.1), `check` clean — committed as the `impact --base`
 * baseline of the recovery assertions (SPEC 6.3). The caller disposes the
 * workspace.
 */
export async function prepareRefusalWorkspace(
  product: ProductBinding,
  fixture: RefusalFixture,
  context: string,
): Promise<PreparedWorkspace> {
  const workspace = await TestWorkspace.create(fixture.decl);
  try {
    await buildOk(
      product,
      workspace,
      `${context} staging \`build\` (SPEC 12.1)`,
    );
    await expectExit(
      product,
      workspace,
      fixture.priorRename,
      0,
      `${context} staging \`${fixture.priorRename.join(" ")}\` — the prior ` +
        `journaled rename makes the workspace journal-bearing (SPEC 6.1, 6.4)`,
    );
    const journalKind = await workspace.kind(JOURNAL_PATH);
    if (journalKind !== "file") {
      fail(
        `${context}: after the prior journaled rename the journal exists as ` +
          `a plain file at ${JOURNAL_PATH} (SPEC 6.1: the file comes into ` +
          `existence with the first journaled operation); found ${journalKind}`,
      );
    }
    await expectExit(
      product,
      workspace,
      ["check"],
      0,
      `${context} staging \`check\` — a freshly built, valid workspace with ` +
        `no refresh pending (SPEC 12.2, 6.4)`,
    );
    await workspace.gitInit();
    const baseline = await workspace.gitCommitAll("pre-operation");
    const before = await snapshotWorkspace(workspace.root);
    return { workspace, baseline, before };
  } catch (error) {
    await workspace.dispose();
    throw error;
  }
}

/** The states an identically prepared twin passes through (H-6). */
export interface TwinOutcome {
  /** The twin right before the operation — the common pre-state. */
  readonly before: DirectorySnapshot;
  /** The twin once the operation completed unrefused. */
  readonly after: DirectorySnapshot;
}

/**
 * Run `argv` unrefused on an identically prepared twin — `prepare` applying
 * the arm's own pre-invocation staging (an edit, a session) on it too — and
 * capture its state before and after: every rewritten-byte expectation is
 * read from here (H-6), never composed by the harness.
 */
export async function completeOnTwin(
  product: ProductBinding,
  fixture: RefusalFixture,
  argv: readonly string[],
  prepare: ((workspace: TestWorkspace) => Promise<void>) | undefined,
  context: string,
): Promise<TwinOutcome> {
  const twin = await prepareRefusalWorkspace(
    product,
    fixture,
    `${context} twin`,
  );
  try {
    if (prepare !== undefined) await prepare(twin.workspace);
    const before = await snapshotWorkspace(twin.workspace.root);
    await expectExit(
      product,
      twin.workspace,
      argv,
      0,
      `${context} twin \`${argv.join(" ")}\` — the same operation completes ` +
        `unrefused on the identical twin (H-6)`,
    );
    const after = await snapshotWorkspace(twin.workspace.root);
    return { before, after };
  } finally {
    await twin.workspace.dispose();
  }
}

/**
 * The comparison premise: the workspace and its twin are byte-identical
 * before the operation, so the twin's post-operation state is the
 * workspace's own expectation (H-6).
 */
export function assertTwinsIdentical(
  workspaceBefore: DirectorySnapshot,
  twinBefore: DirectorySnapshot,
  context: string,
): void {
  assertSnapshotsEqual(
    workspaceBefore,
    twinBefore,
    `${context}: the workspace vs its identically staged twin before the ` +
      `operation — byte-identical staging is the premise of every ` +
      `twin-read expectation (H-6; a product whose output varies across ` +
      `directories cannot be compared)`,
  );
}

// ---------------------------------------------------------------------------
// Snapshot entries and workspace-file classes (SPEC 13.4)
// ---------------------------------------------------------------------------

function sameEntry(
  a: SnapshotEntry | undefined,
  b: SnapshotEntry | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === "file" && b.kind === "file") {
    return Buffer.compare(a.bytes, b.bytes) === 0;
  }
  if (a.kind === "symlink" && b.kind === "symlink") {
    return Buffer.compare(a.target, b.target) === 0;
  }
  return true;
}

function renderEntry(entry: SnapshotEntry | undefined): string {
  return entry === undefined ? "absent" : describeEntry(entry);
}

function unionKeys(...snapshots: readonly DirectorySnapshot[]): string[] {
  const keys = new Set<string>();
  for (const snapshot of snapshots) {
    for (const key of snapshot.entries.keys()) keys.add(key);
  }
  return [...keys].sort();
}

/** The graph-data area or anything beneath it (SPEC 11.6, 13.3). */
export function isAreaPath(rel: string): boolean {
  return rel === GRAPH_DATA_AREA || rel.startsWith(`${GRAPH_DATA_AREA}/`);
}

/** Graph data: the area minus its durable occupants — journal and sessions. */
export function isGraphDataPath(rel: string): boolean {
  if (rel === JOURNAL_PATH) return false;
  if (rel === REVIEWS_DIR || rel.startsWith(`${REVIEWS_DIR}/`)) return false;
  return isAreaPath(rel);
}

/** A source of either fixture: the configuration, spec sources, code sources. */
export function isSourcePath(rel: string): boolean {
  return (
    rel === "xspec.config.ts" || rel.endsWith(".mdx") || rel.startsWith("src/")
  );
}

/**
 * A derived file (SPEC 13.4): a plain file that is neither a source nor under
 * the graph-data area — generated modules and companions, emitted Markdown.
 */
export function isDerivedFile(
  rel: string,
  entry: SnapshotEntry | undefined,
): boolean {
  return entry?.kind === "file" && !isSourcePath(rel) && !isAreaPath(rel);
}

/** The derived scope for whole-entry laws: everything outside sources and the area. */
export function isDerivedScope(rel: string): boolean {
  return !isSourcePath(rel) && !isAreaPath(rel);
}

// ---------------------------------------------------------------------------
// The state a stopped command leaves (SPEC 13.5, 14.24)
// ---------------------------------------------------------------------------

/**
 * SPEC 13.5's pinned-order law, entry by entry over the union of the three
 * snapshots: every entry in `completed` — the writes preceding the refused
 * one — holds the twin's post-operation state (a removal's absence
 * included), and every other entry holds its pre-invocation state (no later
 * write attempted).
 */
export function assertPinnedState(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  twinAfter: DirectorySnapshot,
  completed: readonly string[],
  context: string,
): void {
  const completedSet = new Set(completed);
  for (const key of unionKeys(before, after, twinAfter)) {
    const isCompleted = completedSet.has(key);
    const expected = isCompleted
      ? twinAfter.entries.get(key)
      : before.entries.get(key);
    const actual = after.entries.get(key);
    if (sameEntry(actual, expected)) continue;
    fail(
      `${context}: ${key} must hold ${
        isCompleted
          ? "the complete new content — an earlier write in the pinned " +
            "order, byte-equal to the twin's post-operation state"
          : "its pre-invocation state — a later write in the pinned order " +
            "is never attempted"
      } (SPEC 13.5, 14.24); expected ${renderEntry(expected)}, found ` +
        renderEntry(actual),
    );
  }
}

/**
 * SPEC 13.5's weaker law where the write order is unpinned (a regeneration's
 * derived-file writes): every entry in `scope` holds either its prior state
 * or its complete new content — the twin's — never a partial write.
 */
export function assertEachWriteComplete(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  twinAfter: DirectorySnapshot,
  scope: (rel: string) => boolean,
  context: string,
): void {
  for (const key of unionKeys(before, after, twinAfter)) {
    if (!scope(key)) continue;
    const actual = after.entries.get(key);
    if (sameEntry(actual, before.entries.get(key))) continue;
    if (sameEntry(actual, twinAfter.entries.get(key))) continue;
    fail(
      `${context}: ${key} must hold either its prior state or its complete ` +
        `new content — each write complete, never partial (SPEC 13.5); ` +
        `prior ${renderEntry(before.entries.get(key))}, complete ` +
        `${renderEntry(twinAfter.entries.get(key))}, found ` +
        renderEntry(actual),
    );
  }
}

/** Derived paths whose occupant differs from the twin's derived state. */
export function derivedPathsDifferingFrom(
  after: DirectorySnapshot,
  twinAfter: DirectorySnapshot,
): string[] {
  const paths: string[] = [];
  for (const key of unionKeys(after, twinAfter)) {
    const actual = after.entries.get(key);
    const twin = twinAfter.entries.get(key);
    if (!isDerivedFile(key, actual) && !isDerivedFile(key, twin)) continue;
    if (!sameEntry(actual, twin)) paths.push(key);
  }
  return paths;
}

/** Whether graph data differs from the twin's (the 14.10 unit form's premise). */
export function graphDataDiffers(
  after: DirectorySnapshot,
  twinAfter: DirectorySnapshot,
): boolean {
  return unionKeys(after, twinAfter).some(
    (key) =>
      isGraphDataPath(key) &&
      !sameEntry(after.entries.get(key), twinAfter.entries.get(key)),
  );
}

// ---------------------------------------------------------------------------
// Choreography: a refusal staged while the command is held at the seam
// ---------------------------------------------------------------------------

/** How a refusal is staged: the permission helper applied at a workspace root. */
export type StagingApplier = (root: string) => Promise<PermissionStaging>;

/** T14-9's path-form discipline at a workspace-relative path. */
export function refusalAt(rel: string): StagingApplier {
  return async (root) => await stageWriteRefusal(path.join(root, rel));
}

/** T14-9's area-form discipline beneath a workspace-relative directory. */
export function refusalUnder(rel: string): StagingApplier {
  return async (root) => await stageWriteRefusalUnder(path.join(root, rel));
}

/**
 * Run a command to completion under a hang guard (never an assertion input,
 * H-10), converting a rejection — a product that blocks or hangs, killed at
 * the bound — into a diagnosed failure (H-8).
 */
export async function runSettled(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  context: string,
): Promise<RunResult> {
  try {
    return await runProduct(product, {
      cwd: workspace.root,
      argv,
      timeoutMs: 30_000,
    });
  } catch (error) {
    return fail(
      `${context}: the command must terminate on its own rather than block ` +
        `or hang (SPEC 12.0; H-8: hangs become diagnosed failures) — ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Start `argv` under `--test-hold`, wait for the hold (loud when absent),
 * apply the staging at the seam, release the hold, and wait for the exit.
 * The staging is restored, the hold released, and the process killed
 * whatever happens (a `HarnessStagingError` from `apply` included).
 */
export async function runHeldWithStaging(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  holdName: string,
  apply: StagingApplier,
  context: string,
): Promise<RunResult> {
  const hold = holdPathFor(workspace, holdName);
  const running = await startProduct(product, {
    cwd: workspace.root,
    argv: [...argv, "--test-hold", hold],
  });
  let staging: PermissionStaging | undefined;
  try {
    await awaitHoldFile(running, hold, context);
    staging = await apply(workspace.root);
    await releaseHoldFile(hold);
    try {
      return await running.waitForExit();
    } catch (error) {
      return fail(
        `${context}: once the hold file is deleted the command must proceed ` +
          `and terminate on its own, stopping at the refused write (SPEC ` +
          `13.5, 14.24; H-8: hangs become diagnosed failures) — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } finally {
    running.kill();
    await releaseHoldFile(hold);
    if (staging !== undefined) await staging.restore();
  }
}

/** Stage before the invocation (commands taking no hold), run, restore. */
export async function runStaged(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  apply: StagingApplier,
  context: string,
): Promise<RunResult> {
  const staging = await apply(workspace.root);
  try {
    return await runSettled(product, workspace, argv, context);
  } finally {
    await staging.restore();
  }
}

// ---------------------------------------------------------------------------
// The 14.24 contract and the states `check` reports
// ---------------------------------------------------------------------------

/** 14.24's stable code, carried only by the exit-2 error document (SPEC 14). */
export const WRITE_FAILURE_CODE = "write-failure";

/**
 * A refused write's contract (SPEC 14.24, 12.0, 12.7; T13.5-7, T14-9): exit
 * 2; the error document as the entire stdout; its finding's stable code
 * `write-failure`; its `path` one of the admissible concerned paths — the
 * workspace-relative path of the file the write would have produced or
 * removed (or the graph-data area for a graph-data write).
 */
export function expectWriteFailure(
  result: RunResult,
  concerned: readonly string[],
  context: string,
): Finding {
  assertExitCode(
    result,
    2,
    `${context} — a write the environment refuses is a usage error: the ` +
      `command stops at that write and exits 2, never a finding, never an ` +
      `internal error (SPEC 14.24, 12.0)`,
  );
  const finding = expectErrorDocument(result, context);
  if (finding.code !== WRITE_FAILURE_CODE) {
    fail(
      `${context} — the error document's finding carries the stable code ` +
        `${JSON.stringify(WRITE_FAILURE_CODE)} (SPEC 14.24, 14, 12.7); got ` +
        `${JSON.stringify(finding.code)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  if (typeof finding.path !== "string" || !concerned.includes(finding.path)) {
    fail(
      `${context} — the concerned path is the workspace-relative path of ` +
        `the file the refused write would have produced or removed: ` +
        `${concerned.length === 1 ? JSON.stringify(concerned[0]) : `one of ${JSON.stringify(concerned)}`} ` +
        `(SPEC 14.24, 12.7); got ${JSON.stringify(finding.path)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  return finding;
}

/** `check --json` on a workspace carrying findings, decoded (SPEC 12.2). */
export async function checkFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly Finding[]> {
  const label = `${context} \`check --json\``;
  const result = await expectExit(
    product,
    workspace,
    ["check", "--json"],
    1,
    `${label} — \`check\` exits 1 on any finding (SPEC 12.2, 12.0)`,
  );
  return decodeFindingsReport(parseJsonStdout(result, label), label).findings;
}

/** The condition-10 forms `check` is expected to report (SPEC 14.10). */
export interface StalenessExpectation {
  /** Exactly the derived paths reported in the per-file form. */
  readonly perFile: readonly string[];
  /** Whether the graph-data unit form (concerning the area) is reported. */
  readonly unit: boolean;
}

/**
 * `check` reports condition 10 alone, in exactly the expected forms: one
 * per-file finding per expected derived path, concerning it, and the unit
 * form — concerning the graph-data area — exactly when expected (SPEC 14.10,
 * 12.7, 11.6).
 */
export function assertStalenessAlone(
  findings: readonly Finding[],
  expected: StalenessExpectation,
  context: string,
): void {
  for (const finding of findings) {
    if (finding.condition !== "14.10") {
      fail(
        `${context}: every finding must be condition 10 — the state ` +
          `manifests as staleness alone (SPEC 13.5, 14.10); got ` +
          `${JSON.stringify(finding.code)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  }
  const unitCount = findings.filter(
    (finding) => finding.path === GRAPH_DATA_AREA,
  ).length;
  const perFile = findings
    .filter((finding) => finding.path !== GRAPH_DATA_AREA)
    .map((finding) =>
      typeof finding.path === "string"
        ? finding.path
        : JSON.stringify(finding.path),
    )
    .sort();
  const expectedPerFile = [...expected.perFile].sort();
  if (
    perFile.length !== expectedPerFile.length ||
    perFile.some((rel, index) => rel !== expectedPerFile[index])
  ) {
    fail(
      `${context}: the per-file condition-10 findings must name exactly the ` +
        `derived paths whose occupant differs from what the current sources ` +
        `and configuration generate — one finding per path, concerning it ` +
        `(SPEC 14.10, 12.7); expected ${JSON.stringify(expectedPerFile)}, ` +
        `got ${JSON.stringify(perFile)}`,
    );
  }
  const expectedUnit = expected.unit ? 1 : 0;
  if (unitCount !== expectedUnit) {
    fail(
      `${context}: the graph-data unit form — one condition-10 finding ` +
        `concerning the graph-data area ${GRAPH_DATA_AREA} — is reported ` +
        `exactly when graph data does not match the current sources (SPEC ` +
        `14.10, 11.6); expected ${String(expectedUnit)}, got ` +
        `${String(unitCount)}`,
    );
  }
}

/** `impact --base <baseline> --json`, decoded (SPEC 9.3, 6.3). */
export async function impactAgainst(
  product: ProductBinding,
  workspace: TestWorkspace,
  baseline: string,
  context: string,
): Promise<ImpactReport> {
  const label = `${context} \`impact --base <pre-operation ref> --json\``;
  return decodeImpactReport(
    await runJson(
      product,
      workspace,
      ["impact", "--base", baseline, "--json"],
      label,
    ),
    label,
  );
}

/**
 * A rename stopped before its journal append left manual restructuring
 * (SPEC 6.7): against the pre-rename baseline the old identity is reported
 * deleted and the new one added (`changed`, not deleted).
 */
export function assertManualRestructuring(
  report: ImpactReport,
  oldIdentity: string,
  newIdentity: string,
  context: string,
): void {
  const deleted = report.requirements.find(
    (entry) => entry.deleted && entry.nodes.includes(oldIdentity),
  );
  if (deleted === undefined) {
    fail(
      `${context}: the old identity ${oldIdentity} is reported deleted — no ` +
        `entry having been journaled, the completed source edits stand as ` +
        `manual restructuring, deletions plus additions (SPEC 6.7, 13.5, ` +
        `6.3); got ${JSON.stringify(report.requirements)}`,
    );
  }
  const added = report.requirements.find(
    (entry) =>
      !entry.deleted &&
      entry.nodes.includes(newIdentity) &&
      entry.categories.some((category) => category.category === "changed"),
  );
  if (added === undefined) {
    fail(
      `${context}: the new identity ${newIdentity} is reported added — a ` +
        `\`changed\` entry, not deleted (SPEC 6.7, 5.6); got ` +
        JSON.stringify(report.requirements),
    );
  }
}

/** A journaled file move is pure: no change categories, no impacted code. */
export function assertNoChangeCategories(
  report: ImpactReport,
  context: string,
): void {
  if (
    report.requirements.length !== 0 ||
    report.code.direct.length !== 0 ||
    report.code.transitive.length !== 0
  ) {
    fail(
      `${context}: a journaled file move produces no change categories ` +
        `relative to the pre-move baseline — the identity effect is ` +
        `observable through the journal's effects alone (SPEC 6.2, 13.5); ` +
        `got ${JSON.stringify(report)}`,
    );
  }
}

/** `review status <name> --json`, decoded (SPEC 10.7). */
export async function sessionStatus(
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

/** The unique status row scoped at `scope` (SPEC 10.1: one audit item per node). */
export function requireItemByScope(
  report: SessionStatusReport,
  scope: string,
  context: string,
): SessionStatusReport["items"][number] {
  const rows = report.items.filter((row) => row.scope === scope);
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    fail(
      `${context}: expected exactly one item scoped at ${scope} (SPEC 10.1, ` +
        `10.6); found ${String(rows.length)} among ` +
        JSON.stringify(report.items.map((item) => item.scope)),
    );
  }
  return row;
}

// ---------------------------------------------------------------------------
// T13.5-7's arms (TEST-SPEC T13.5-7 (a)–(f) and the kill arm)
// ---------------------------------------------------------------------------

const RENAME_JSON: readonly string[] = [...RENAME_ARGV, "--json"];
const MOVE_JSON: readonly string[] = [...MOVE_ARGV, "--json"];

/** The rename twin — arms (a), (b), and the kill arm share its outcome. */
export async function renameTwin(
  product: ProductBinding,
): Promise<TwinOutcome> {
  return await completeOnTwin(
    product,
    RENAME_FIXTURE,
    RENAME_ARGV,
    undefined,
    "T13.5-7 rename",
  );
}

/** The move twin — arms (c) and (d) share its outcome. */
export async function moveTwin(product: ProductBinding): Promise<TwinOutcome> {
  return await completeOnTwin(
    product,
    MOVE_FIXTURE,
    MOVE_ARGV,
    undefined,
    "T13.5-7 move",
  );
}

/**
 * The byte window of `needle`'s first occurrence in the snapshot's plain
 * file at `rel` — the offending construct's own range, read from the twin's
 * rewritten bytes (never composed by the harness).
 */
function bytesWindow(
  snapshot: DirectorySnapshot,
  rel: string,
  needle: string,
  context: string,
): { readonly start: number; readonly end: number } {
  const entry = snapshot.entries.get(rel);
  if (entry === undefined || entry.kind !== "file") {
    return fail(
      `${context}: the twin's ${rel} must be a plain file after the ` +
        `operation (SPEC 6.4); found ${renderEntry(entry)}`,
    );
  }
  const start = Buffer.from(entry.bytes).indexOf(Buffer.from(needle, "utf8"));
  if (start < 0) {
    return fail(
      `${context}: the twin's rewritten ${rel} must contain ` +
        `${JSON.stringify(needle)} (SPEC 6.4: the rename rewrites the ` +
        `reference spelling); found ${JSON.stringify(Buffer.from(entry.bytes).toString("utf8"))}`,
    );
  }
  return { start, end: start + Buffer.byteLength(needle, "utf8") };
}

/**
 * (a) Source edits first, one write per file, in preview `files` order
 * (A, B, C by path bytes): with `specs/b` staged unwritable, A is rewritten
 * and byte-equal to the twin's, B and C are byte-untouched, and the journal,
 * derived files, and graph data are byte-unchanged; the error document
 * concerns `specs/b/B.mdx`; `check` reports exactly one finding, condition
 * 5 for A's now-unresolved spelling.
 */
export async function sourceEditsArm(
  product: ProductBinding,
  twin: TwinOutcome,
): Promise<void> {
  const context =
    "T13.5-7 (a) `rename specs/b/B.mdx b b2 --json` with specs/b unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    assertTwinsIdentical(prepared.before, twin.before, context);
    const result = await runHeldWithStaging(
      product,
      workspace,
      RENAME_JSON,
      "hold-a.tmp",
      refusalUnder(RENAME_B_DIR),
      context,
    );
    expectWriteFailure(result, [RENAME_B_PATH], context);
    const after = await snapshotWorkspace(workspace.root);
    assertPinnedState(
      prepared.before,
      after,
      twin.after,
      [RENAME_A_PATH],
      `${context}: the state left — A rewritten (the first source edit, ` +
        `complete and byte-equal to the twin's), B and C byte-untouched ` +
        `(the refused write and the later one), the journal byte-unchanged ` +
        `(no entry: the append is the commit point, reached only once every ` +
        `source edit is in place), derived files and graph data byte-unchanged`,
    );
    const findings = await checkFindings(product, workspace, context);
    assertConditionCounts(
      findings,
      { "14.5": 1 },
      `${context}: \`check\` reports exactly one finding — condition 5 for ` +
        `A's now-unresolved \`d\` reference (SPEC 13.5: a partly applied ` +
        `rewrite manifests as 14.5–14.7; 14.10's mismatch forms are ` +
        `undetectable on a failing workspace, T12.2-4)`,
    );
    const finding = findings[0];
    if (finding === undefined) {
      return fail(`${context}: one condition-5 finding expected (SPEC 14.5)`);
    }
    assertFindingLocated(
      finding,
      {
        file: RENAME_A_PATH,
        window: bytesWindow(twin.after, RENAME_A_PATH, "d={B.b2}", context),
      },
      `${context}: the condition-5 finding locates A's unresolved \`d\` ` +
        `spelling (SPEC 14.5, 12.7)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * (b) The journal append as the commit point: with `.xspec/journal` staged
 * unwritable (`.xspec` read-only, graph data untouched) every source edit is
 * made (A, B, C byte-equal to the twin's), no journal entry is appended, and
 * derived files and graph data are byte-unchanged; the error document
 * concerns `.xspec/journal`; `check` reports condition 10 alone — per-file
 * staleness for B's module and companions and the graph-data unit form;
 * once restored, `impact --base <pre-rename ref>` reports the old identity
 * deleted and the new one added (manual restructuring, 6.7) and the next
 * `build` leaves `check` clean.
 */
export async function journalCommitPointArm(
  product: ProductBinding,
  twin: TwinOutcome,
): Promise<void> {
  const context =
    "T13.5-7 (b) `rename specs/b/B.mdx b b2 --json` with .xspec/journal unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace, baseline } = prepared;
  try {
    assertTwinsIdentical(prepared.before, twin.before, context);
    const result = await runHeldWithStaging(
      product,
      workspace,
      RENAME_JSON,
      "hold-b.tmp",
      refusalAt(JOURNAL_PATH),
      context,
    );
    expectWriteFailure(result, [JOURNAL_PATH], context);
    const after = await snapshotWorkspace(workspace.root);
    assertPinnedState(
      prepared.before,
      after,
      twin.after,
      [RENAME_A_PATH, RENAME_B_PATH, RENAME_C_PATH],
      `${context}: the state left — every source edit made (A, B, C ` +
        `byte-equal to the twin's), no journal entry (the file ` +
        `byte-unchanged), derived files and graph data byte-unchanged (the ` +
        `finishing regeneration follows the append)`,
    );
    const perFile = derivedPathsDifferingFrom(after, twin.after);
    if (!perFile.includes(RENAME_B_MODULE)) {
      fail(
        `${context}: B's generated module ${RENAME_B_MODULE} must differ ` +
          `from the twin's regenerated one — the rename changed the ` +
          `identities it exports (SPEC 13.1) — so it is certainly among the ` +
          `stale derived paths; differing: ${JSON.stringify(perFile)}`,
      );
    }
    if (!graphDataDiffers(after, twin.after)) {
      fail(
        `${context}: graph data must differ from the twin's regenerated ` +
          `graph data — it carries the identities the rename changed (SPEC ` +
          `13.3) — so the unit form is certainly reported; found it ` +
          `byte-identical`,
      );
    }
    assertStalenessAlone(
      await checkFindings(product, workspace, context),
      { perFile, unit: true },
      `${context}: \`check\` after the refused append — condition 10 alone: ` +
        `per-file staleness for the derived paths whose occupant differs ` +
        `from the twin's regenerated state (B's module and companions) and ` +
        `the graph-data unit form, the workspace being valid and ` +
        `consistently rewritten (SPEC 13.5, 14.10)`,
    );
    // Recovery, the permissions restored (SPEC 6.7, 12.1).
    assertManualRestructuring(
      await impactAgainst(product, workspace, baseline, context),
      RENAME_OLD_IDENTITY,
      RENAME_NEW_IDENTITY,
      context,
    );
    await buildOk(
      product,
      workspace,
      `${context}: the next \`build\` (SPEC 12.1)`,
    );
    await expectExit(
      product,
      workspace,
      ["check"],
      0,
      `${context}: after the next \`build\`, \`check\` is clean (SPEC 12.2, 13.5)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/** The snapshot restricted to the entries `scope` admits. */
function restrictSnapshot(
  snapshot: DirectorySnapshot,
  scope: (rel: string) => boolean,
): DirectorySnapshot {
  const entries = new Map<string, SnapshotEntry>();
  for (const [key, entry] of snapshot.entries) {
    if (scope(key)) entries.set(key, entry);
  }
  return { root: snapshot.root, entries };
}

/** Sources and the journal: the writes 13.5 orders for a rename or move. */
function isOrderedWritePath(rel: string): boolean {
  return isSourcePath(rel) || rel === JOURNAL_PATH;
}

/** The regeneration's scope: derived files and graph data (order unpinned). */
function isRegenerationPath(rel: string): boolean {
  return isDerivedScope(rel) || isGraphDataPath(rel);
}

/**
 * (c) Stopped after the append, the identity effect complete: the file-form
 * move with `out/specs` staged unwritable — every source edit made and the
 * relocation complete (origin absent, destination present, the importer
 * rewritten), the journal holding exactly one new entry byte-equal to the
 * twin's, the error document concerning one of the two Markdown writes the
 * regeneration owes under `out/specs` (`out/specs/sub/B.md`'s creation —
 * the directory it needs is part of that write — or `out/specs/A.md`'s
 * removal; the order among a regeneration's derived-file writes is
 * unpinned) as the entire stdout (no `mapping`); every derived-file and
 * graph-data entry its prior state or the twin's; `check` reports condition
 * 10 alone — the stale remainder, the destination's Markdown certainly
 * missing; restored, `impact` reports no change categories and the next
 * `build` leaves `check` clean.
 */
export async function afterAppendArm(
  product: ProductBinding,
  twin: TwinOutcome,
): Promise<void> {
  const context =
    "T13.5-7 (c) `move specs/A.mdx specs/sub/B.mdx --json` with out/specs unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace, baseline } = prepared;
  try {
    assertTwinsIdentical(prepared.before, twin.before, context);
    const result = await runHeldWithStaging(
      product,
      workspace,
      MOVE_JSON,
      "hold-c.tmp",
      refusalUnder(MOVE_MARKDOWN_DIR),
      context,
    );
    expectWriteFailure(result, MOVE_MARKDOWN_WRITES, context);
    const after = await snapshotWorkspace(workspace.root);
    assertPinnedState(
      restrictSnapshot(prepared.before, isOrderedWritePath),
      restrictSnapshot(after, isOrderedWritePath),
      restrictSnapshot(twin.after, isOrderedWritePath),
      [MOVE_ORIGIN, MOVE_DESTINATION, MOVE_IMPORTER, JOURNAL_PATH],
      `${context}: the state left — every source edit made, the relocation ` +
        `complete (origin absent, destination present, the importer ` +
        `rewritten, each byte-equal to the twin's), the journal holding ` +
        `exactly one new entry byte-equal to the twin's (the append ` +
        `precedes the finishing regeneration)`,
    );
    assertEachWriteComplete(
      prepared.before,
      after,
      twin.after,
      isRegenerationPath,
      `${context}: the finishing regeneration, stopped at the refused ` +
        `Markdown write — every derived file and graph-data entry`,
    );
    const findings = await checkFindings(product, workspace, context);
    const stalePaths = findings.map((finding) => finding.path);
    for (const finding of findings) {
      if (finding.condition !== "14.10") {
        fail(
          `${context}: \`check\` reports condition 10 alone — the stale ` +
            `remainder of an operation stopped after its commit point ` +
            `(SPEC 13.5, 14.10); got ${JSON.stringify(finding.code)} ` +
            `(message: ${JSON.stringify(finding.message)})`,
        );
      }
    }
    const destinationMarkdown = MOVE_MARKDOWN_WRITES[0];
    if (!stalePaths.includes(destinationMarkdown)) {
      fail(
        `${context}: the destination's emitted Markdown ` +
          `${JSON.stringify(destinationMarkdown)} — never produced, its ` +
          `creation refused or not attempted — is certainly among the ` +
          `stale derived paths \`check\` names (SPEC 14.10, 13.2); named: ` +
          JSON.stringify(stalePaths),
      );
    }
    // Recovery, the permissions restored (SPEC 6.2, 12.1).
    assertNoChangeCategories(
      await impactAgainst(product, workspace, baseline, context),
      context,
    );
    await buildOk(
      product,
      workspace,
      `${context}: the next \`build\` (SPEC 12.1)`,
    );
    await expectExit(
      product,
      workspace,
      ["check"],
      0,
      `${context}: after the next \`build\`, \`check\` is clean (SPEC 12.2, 13.5)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * (d) A relocation is two writes, the destination produced and then the
 * origin removed: the same move with `specs/sub` present and writable and
 * `specs` staged unwritable — the destination present with the moved file's
 * rewritten bytes (the twin's), the origin still present and byte-unchanged,
 * the error document concerning `specs/A.mdx` (the removal), no journal
 * entry, no importer rewritten (the relocation's entry precedes `src/` in
 * `files` order), and `check` reporting condition 10 alone — both files
 * valid, the destination's derived files missing.
 */
export async function relocationArm(
  product: ProductBinding,
  twin: TwinOutcome,
): Promise<void> {
  const context =
    "T13.5-7 (d) `move specs/A.mdx specs/sub/B.mdx --json` with specs unwritable, specs/sub present and writable";
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    assertTwinsIdentical(prepared.before, twin.before, context);
    await workspace.dir(MOVE_DESTINATION_DIR);
    const before = await snapshotWorkspace(workspace.root);
    const result = await runHeldWithStaging(
      product,
      workspace,
      MOVE_JSON,
      "hold-d.tmp",
      refusalAt(MOVE_ORIGIN),
      context,
    );
    expectWriteFailure(result, [MOVE_ORIGIN], context);
    const after = await snapshotWorkspace(workspace.root);
    assertPinnedState(
      before,
      after,
      twin.after,
      [MOVE_DESTINATION],
      `${context}: the state left — the destination present with the moved ` +
        `file's rewritten bytes (the twin's), the origin still present and ` +
        `byte-unchanged (its removal, the relocation's second write, ` +
        `refused), no importer rewritten, no journal entry, derived files ` +
        `and graph data byte-unchanged`,
    );
    const destinationDerived = [...twin.after.entries.keys()].filter(
      (rel) =>
        isDerivedFile(rel, twin.after.entries.get(rel)) &&
        (rel.startsWith(`${MOVE_DESTINATION_DIR}/`) ||
          rel.startsWith(`${MOVE_MARKDOWN_DIR}/sub/`)),
    );
    if (destinationDerived.length === 0) {
      fail(
        `${context}: the twin's completed move generates derived files for ` +
          `the destination under ${MOVE_DESTINATION_DIR}/ and ` +
          `${MOVE_MARKDOWN_DIR}/sub/ (SPEC 13.1, 13.2); found none among ` +
          JSON.stringify([...twin.after.entries.keys()]),
      );
    }
    assertStalenessAlone(
      await checkFindings(product, workspace, context),
      { perFile: destinationDerived, unit: true },
      `${context}: \`check\` — condition 10 alone: both files valid, the ` +
        `destination's derived files missing (one per-file finding each) ` +
        `and graph data not matching the current sources, the destination ` +
        `being unrecorded (the unit form) (SPEC 13.5, 14.10)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/** One entry of `actual` must equal the same entry of `expected`. */
function assertSameEntry(
  actual: DirectorySnapshot,
  expected: DirectorySnapshot,
  rel: string,
  context: string,
): void {
  const found = actual.entries.get(rel);
  const wanted = expected.entries.get(rel);
  if (sameEntry(found, wanted)) return;
  fail(
    `${context}: ${rel} — expected ${renderEntry(wanted)}, found ` +
      renderEntry(found),
  );
}

/** Everything outside the graph-data area: sources and derived files. */
function isOutsideArea(rel: string): boolean {
  return !isAreaPath(rel);
}

const SESSION = "s";
const NEW_SESSION = "n";
const SESSION_FILE = `${REVIEWS_DIR}/${SESSION}.json`;
const NEW_SESSION_FILE = `${REVIEWS_DIR}/${NEW_SESSION}.json`;
/** An unblocked leaf item's scope (SPEC 10.6) — not the edited source's. */
const RESOLVE_SCOPE = "specs/c/C.mdx#c";
/** A parent item's scope, its node holding a child subtree (`split`). */
const SPLIT_SCOPE = "specs/b/B.mdx#b";
const E_EDIT_FROM = "Alpha text.";
const E_EDIT_TO = "Alpha text, edited.";

/**
 * (e) `review` mutators write the session file once, last: on a stale,
 * valid workspace (A's text edited after `build`) with `.xspec/reviews` and
 * the session file staged unwritable and `.xspec` itself writable,
 * `review resolve s <item> --status no-change` exits 2 with the error
 * document concerning `.xspec/reviews/s.json`, the session file
 * byte-unchanged (`status`, once restored, reports the item still
 * `unresolved`), and the refresh already made: `check` afterwards reports
 * the edited source's per-file staleness and no unit-form finding — graph
 * data matching the current sources — where a product writing the session
 * before refreshing, or refusing the refresh, fails; `review create
 * --strategy audit --name n` and `split` on the same staging behave alike,
 * no `n.json` created and no decomposition recorded.
 */
export async function reviewMutatorsArm(
  product: ProductBinding,
): Promise<void> {
  const context =
    "T13.5-7 (e) review mutators with .xspec/reviews and the session file unwritable";
  const editA = (workspace: TestWorkspace): Promise<void> =>
    workspace.edit(RENAME_A_PATH, E_EDIT_FROM, E_EDIT_TO);
  // The build twin: the same fixture and edit, then `build` — the derived
  // state the current sources generate (SPEC 13.3: the refresh writes what
  // `build` would write).
  const buildTwin = await completeOnTwin(
    product,
    RENAME_FIXTURE,
    ["build"],
    editA,
    `${context} build`,
  );
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", SESSION],
      0,
      `${context} staging \`review create --strategy audit --name s\` (SPEC 10.7)`,
    );
    // The item lookup precedes the staleness edit: `review status` is itself
    // a refreshing read (SPEC 13.3), so it runs while nothing is stale.
    const status = await sessionStatus(
      product,
      workspace,
      SESSION,
      `${context} staging`,
    );
    const resolveItem = requireItemByScope(
      status,
      RESOLVE_SCOPE,
      `${context} staging`,
    );
    const splitItem = requireItemByScope(
      status,
      SPLIT_SCOPE,
      `${context} staging`,
    );
    await editA(workspace);
    const staged = await snapshotWorkspace(workspace.root);
    assertTwinsIdentical(
      restrictSnapshot(staged, isOutsideArea),
      restrictSnapshot(buildTwin.before, isOutsideArea),
      `${context} (sources and derived files; the session and graph data set aside)`,
    );
    const sessionEntry = staged.entries.get(SESSION_FILE);
    if (sessionEntry === undefined || sessionEntry.kind !== "file") {
      fail(
        `${context}: the session file exists as a plain file at ` +
          `${SESSION_FILE} after \`review create\` (SPEC 10.1); found ` +
          renderEntry(sessionEntry),
      );
    }

    // `resolve`: the session write, last, refused; the refresh already made.
    const resolveContext = `${context} \`review resolve s ${resolveItem.id} --status no-change --json\``;
    expectWriteFailure(
      await runHeldWithStaging(
        product,
        workspace,
        [
          "review",
          "resolve",
          SESSION,
          resolveItem.id,
          "--status",
          "no-change",
          "--json",
        ],
        "hold-e-resolve.tmp",
        refusalAt(SESSION_FILE),
        resolveContext,
      ),
      [SESSION_FILE],
      resolveContext,
    );
    const afterResolve = await snapshotWorkspace(workspace.root);
    assertSameEntry(
      afterResolve,
      staged,
      SESSION_FILE,
      `${resolveContext}: the session file byte-unchanged — the session ` +
        `write is the last write, refused (SPEC 13.5, 14.24)`,
    );
    assertSnapshotsEqual(
      restrictSnapshot(staged, isOrderedWritePath),
      restrictSnapshot(afterResolve, isOrderedWritePath),
      `${resolveContext}: sources and the journal byte-unchanged (a review ` +
        `mutator edits neither, SPEC 10.7, 13.5)`,
    );
    const perFile = derivedPathsDifferingFrom(afterResolve, buildTwin.after);
    if (perFile.length === 0) {
      fail(
        `${resolveContext}: the edited source's derived files must differ ` +
          `from what \`build\` writes on the identically edited twin — its ` +
          `emitted Markdown carries the edited text (SPEC 13.2) — so some ` +
          `per-file staleness is certainly reported; found every derived ` +
          `file byte-identical to the twin's`,
      );
    }
    assertStalenessAlone(
      await checkFindings(product, workspace, resolveContext),
      { perFile, unit: false },
      `${resolveContext}: \`check\` afterwards — the edited source's ` +
        `per-file staleness (the derived paths differing from the build ` +
        `twin's) and no unit-form finding: the refresh of 13.3 was already ` +
        `made, graph data matching the current sources — a product writing ` +
        `the session before refreshing, or refusing the refresh, fails here ` +
        `(SPEC 13.5, 13.3, 14.10)`,
    );
    const restored = requireItemByScope(
      await sessionStatus(
        product,
        workspace,
        SESSION,
        `${resolveContext} restored`,
      ),
      RESOLVE_SCOPE,
      `${resolveContext} restored`,
    );
    if (restored.status !== "unresolved") {
      fail(
        `${resolveContext}: once the permissions are restored, \`status\` ` +
          `reports the item still unresolved — nothing was recorded (SPEC ` +
          `13.5, 10.7); got ${JSON.stringify(restored.status)}`,
      );
    }

    // `create`: no `n.json` created.
    const createContext = `${context} \`review create --strategy audit --name n --json\``;
    expectWriteFailure(
      await runHeldWithStaging(
        product,
        workspace,
        [
          "review",
          "create",
          "--strategy",
          "audit",
          "--name",
          NEW_SESSION,
          "--json",
        ],
        "hold-e-create.tmp",
        refusalAt(NEW_SESSION_FILE),
        createContext,
      ),
      [NEW_SESSION_FILE],
      createContext,
    );
    const afterCreate = await snapshotWorkspace(workspace.root);
    if (afterCreate.entries.has(NEW_SESSION_FILE)) {
      fail(
        `${createContext}: no ${NEW_SESSION_FILE} is created — the session ` +
          `write, refused, is the command's only write (SPEC 13.5, 14.24); ` +
          `found ${renderEntry(afterCreate.entries.get(NEW_SESSION_FILE))}`,
      );
    }
    assertSameEntry(
      afterCreate,
      staged,
      SESSION_FILE,
      `${createContext}: the existing session file byte-unchanged`,
    );

    // `split`: no decomposition recorded.
    const splitContext = `${context} \`review split s ${splitItem.id} --json\``;
    expectWriteFailure(
      await runHeldWithStaging(
        product,
        workspace,
        ["review", "split", SESSION, splitItem.id, "--json"],
        "hold-e-split.tmp",
        refusalAt(SESSION_FILE),
        splitContext,
      ),
      [SESSION_FILE],
      splitContext,
    );
    assertSameEntry(
      await snapshotWorkspace(workspace.root),
      staged,
      SESSION_FILE,
      `${splitContext}: the session file byte-unchanged — no decomposition ` +
        `recorded (SPEC 13.5, 10.7)`,
    );
  } finally {
    await workspace.dispose();
  }
}

const F_EDIT_FROM = "Beta text.";
const F_EDIT_TO = "Beta text, edited.";

/**
 * (f) `build` and a refresh, each file complete, the order unpinned: a built
 * workspace whose `specs/b/B.mdx` is edited (the workspace valid) before
 * `specs/b` is staged unwritable — `build` exits 2 with the error document
 * concerning a derived path under `specs/b/` (B's module or a companion,
 * the first `specs/b/` write in the product's order); every derived file
 * present afterwards is complete — its prior state or byte-equal to the
 * twin's — and `check` reports exactly the derived paths whose occupant
 * differs from the twin's derived state (computed by comparison, B's module
 * and companions certainly in it), the graph-data unit form exactly when
 * graph data differs; the next `build`, permissions restored, exits 0 with
 * `check` clean (12.1, 13.4).
 */
export async function buildArm(product: ProductBinding): Promise<void> {
  const context =
    "T13.5-7 (f) `build --json` with specs/b unwritable on the B-edited workspace";
  const editB = (workspace: TestWorkspace): Promise<void> =>
    workspace.edit(RENAME_B_PATH, F_EDIT_FROM, F_EDIT_TO);
  const buildTwin = await completeOnTwin(
    product,
    RENAME_FIXTURE,
    ["build"],
    editB,
    `${context} build`,
  );
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await editB(workspace);
    const staged = await snapshotWorkspace(workspace.root);
    assertTwinsIdentical(staged, buildTwin.before, context);
    const derivedUnderB = [...buildTwin.after.entries.keys()].filter(
      (rel) =>
        isDerivedFile(rel, buildTwin.after.entries.get(rel)) &&
        rel.startsWith(`${RENAME_B_DIR}/`),
    );
    if (!derivedUnderB.includes(RENAME_B_MODULE)) {
      fail(
        `${context}: the twin's \`build\` generates B's module ` +
          `${RENAME_B_MODULE} beside its source (SPEC 13.1); found ` +
          JSON.stringify(derivedUnderB),
      );
    }
    const result = await runStaged(
      product,
      workspace,
      ["build", "--json"],
      refusalUnder(RENAME_B_DIR),
      context,
    );
    expectWriteFailure(
      result,
      derivedUnderB,
      `${context} — the first \`specs/b/\` write in the product's order, a ` +
        `derived path (B's module or a companion), is the refused one`,
    );
    const after = await snapshotWorkspace(workspace.root);
    assertSnapshotsEqual(
      restrictSnapshot(staged, isOrderedWritePath),
      restrictSnapshot(after, isOrderedWritePath),
      `${context}: \`build\` writes no source and no journal (SPEC 12.1, 6.1)`,
    );
    assertEachWriteComplete(
      staged,
      after,
      buildTwin.after,
      isRegenerationPath,
      `${context}: every derived file present afterwards is complete — its ` +
        `prior state or byte-equal to the twin's — and so is graph data ` +
        `(the order among a \`build\`'s derived-file writes is unpinned)`,
    );
    const perFile = derivedPathsDifferingFrom(after, buildTwin.after);
    if (!perFile.includes(RENAME_B_MODULE)) {
      fail(
        `${context}: B's module ${RENAME_B_MODULE}, whose regeneration was ` +
          `refused or never attempted, certainly differs from the twin's ` +
          `(the edited text changes it, SPEC 13.1); differing: ` +
          JSON.stringify(perFile),
      );
    }
    assertStalenessAlone(
      await checkFindings(product, workspace, context),
      { perFile, unit: graphDataDiffers(after, buildTwin.after) },
      `${context}: \`check\` reports exactly the derived paths whose ` +
        `occupant differs from the twin's derived state (B's module and ` +
        `companions certainly among them) and the graph-data unit form ` +
        `exactly when graph data differs (SPEC 14.10, 12.1, 13.4)`,
    );
    await buildOk(
      product,
      workspace,
      `${context}: the next \`build\`, permissions restored (SPEC 12.1)`,
    );
    await expectExit(
      product,
      workspace,
      ["check"],
      0,
      `${context}: after the next \`build\`, \`check\` is clean (SPEC 12.2, 13.4)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * (f), the refreshing reads: on the same edited-but-not-rebuilt workspace
 * with `.xspec` staged unwritable, `query nodes` and `view specs/a/A.mdx`
 * each exit 2 with the error document concerning `.xspec` (14.24: a
 * graph-data write concerns the area), stdout exactly that document and no
 * answer (13.3, 11.2), while `check` on the same state exits 1 reporting the
 * staleness (never a 14.24 reporter) and a `move --preview` exits 0 writing
 * nothing (6.6).
 */
export async function refreshingReadsArm(
  product: ProductBinding,
): Promise<void> {
  const context =
    "T13.5-7 (f) refreshing reads with .xspec unwritable on the B-edited workspace";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await workspace.edit(RENAME_B_PATH, F_EDIT_FROM, F_EDIT_TO);
    const staged = await snapshotWorkspace(workspace.root);
    const staging = await stageWriteRefusalUnder(
      path.join(workspace.root, GRAPH_DATA_AREA),
    );
    try {
      for (const argv of [
        ["query", "nodes", "--json"],
        ["view", RENAME_A_PATH, "--json"],
      ]) {
        const label = `${context} \`${argv.join(" ")}\``;
        expectWriteFailure(
          await runSettled(product, workspace, argv, label),
          [GRAPH_DATA_AREA],
          `${label} — a refreshing read of 13.3 whose graph-data write the ` +
            `environment refuses concerns the graph-data area, never a ` +
            `path inside it, and answers nothing (SPEC 14.24, 13.3, 11.2)`,
        );
      }
      const checkLabel = `${context} \`check --json\``;
      const checkResult = await runSettled(
        product,
        workspace,
        ["check", "--json"],
        checkLabel,
      );
      assertExitCode(
        checkResult,
        1,
        `${checkLabel} — \`check\` reports the staleness on the same state, ` +
          `exit 1: it writes nothing, so it is never a 14.24 reporter (SPEC ` +
          `14.24, 12.2)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(checkResult, checkLabel),
        checkLabel,
      ).findings;
      if (findings.length === 0) {
        fail(
          `${checkLabel}: exit 1 carries the staleness findings (SPEC 12.2)`,
        );
      }
      for (const finding of findings) {
        if (finding.condition !== "14.10") {
          fail(
            `${checkLabel}: \`check\` reports the staleness alone — ` +
              `condition 10, never a write failure (SPEC 14.24, 14.10); got ` +
              `${JSON.stringify(finding.code)} (message: ` +
              `${JSON.stringify(finding.message)})`,
          );
        }
      }
      const previewArgv = [
        "move",
        RENAME_A_PATH,
        "specs/a/A2.mdx",
        "--preview",
        "--json",
      ];
      const previewLabel = `${context} \`${previewArgv.join(" ")}\``;
      const preview = await assertLeavesUnchanged(
        workspace.root,
        () => runSettled(product, workspace, previewArgv, previewLabel),
        `${previewLabel}: a preview writes nothing — no sources, no journal, ` +
          `no derived files, no graph data (SPEC 6.6)`,
        { exclude: excludeGitTree },
      );
      assertExitCode(
        preview,
        0,
        `${previewLabel} — a preview exits 0 on the valid, stale workspace, ` +
          `refreshing nothing (SPEC 6.6, 13.3)`,
      );
    } finally {
      await staging.restore();
    }
    assertSnapshotsEqual(
      restrictSnapshot(staged, isOrderedWritePath),
      restrictSnapshot(
        await snapshotWorkspace(workspace.root),
        isOrderedWritePath,
      ),
      `${context}: sources and the journal byte-unchanged around the reads ` +
        `(SPEC 13.3, 6.1)`,
    );
  } finally {
    await workspace.dispose();
  }
}

// Post-release kill delays in milliseconds — scheduling choreography only,
// never an assertion input (H-10): the operative assertion is
// delay-independent and disjunctive exactly as 13.5 admits.
const KILL_DELAYS_MS: readonly number[] = [0, 2, 5, 10, 20, 40, 80, 160];

/**
 * The kill arm, a robustness check only — a kill lands nondeterministically,
 * the refused write being the deterministic seam: a kill at the held point
 * leaves the workspace consistent (`check` exits 0: the hold precedes all
 * modification), and across a spread of post-release kill timings on (a)'s
 * rename `check` never crashes and reports exactly a state 13.5 admits —
 * clean, or condition 5–7 findings alone (a partly applied rewrite), or
 * condition 10 findings alone (the journal appended, derived files not yet
 * regenerated) — while the journal is byte-equal either to its prior bytes
 * or to the twin's post-operation bytes (13.5: each write complete).
 * Platform-safe: no permission staging.
 */
export async function runKillArm(
  product: ProductBinding,
  twin: TwinOutcome,
): Promise<void> {
  const probe = async (delayMs: number | null): Promise<void> => {
    const label =
      delayMs === null ? "held point" : `${String(delayMs)} ms after release`;
    const context = `T13.5-7 (kill, ${label}) \`rename specs/b/B.mdx b b2 --test-hold <path>\``;
    const prepared = await prepareRefusalWorkspace(
      product,
      RENAME_FIXTURE,
      context,
    );
    const { workspace } = prepared;
    try {
      assertTwinsIdentical(prepared.before, twin.before, context);
      const hold = holdPathFor(workspace, "hold-kill.tmp");
      const running = await startProduct(product, {
        cwd: workspace.root,
        argv: [...RENAME_ARGV, "--test-hold", hold],
      });
      try {
        await awaitHoldFile(running, hold, context);
        if (delayMs === null) {
          // Held-point kill: the hold file is never deleted.
          running.kill("SIGKILL");
        } else {
          await releaseHoldFile(hold);
          if (delayMs > 0) await sleep(delayMs);
          running.kill("SIGKILL");
        }
        // The run settles for kills and for completions that beat the kill
        // alike; the death's shape is not asserted (a post-release kill
        // lands nondeterministically).
        await running.waitForExit();
      } finally {
        running.kill();
        await releaseHoldFile(hold);
      }
      const after = await snapshotWorkspace(workspace.root);
      const journal = after.entries.get(JOURNAL_PATH);
      if (
        !sameEntry(journal, prepared.before.entries.get(JOURNAL_PATH)) &&
        !sameEntry(journal, twin.after.entries.get(JOURNAL_PATH))
      ) {
        fail(
          `${context}: after the kill the journal is byte-equal either to ` +
            `its prior bytes or to the twin's post-operation bytes — each ` +
            `write complete, never partial (SPEC 13.5, 6.1); found ` +
            renderEntry(journal),
        );
      }
      const checkContext = `${context} \`check --json\` after the kill`;
      const result = await runSettled(
        product,
        workspace,
        ["check", "--json"],
        checkContext,
      );
      if (delayMs === null) {
        assertExitCode(
          result,
          0,
          `${checkContext}: a kill at the held point demonstrably leaves the ` +
            `workspace consistent — the hold precedes all modification ` +
            `(SPEC 13.5), so \`check\` passes`,
        );
        return;
      }
      if (
        result.signal !== null ||
        (result.exitCode !== 0 && result.exitCode !== 1)
      ) {
        fail(
          `${checkContext}: \`check\` never crashes and either passes on a ` +
            `consistent state (exit 0) or reports findings (exit 1) — the ` +
            `configuration is intact, so no other outcome is stageable ` +
            `(SPEC 13.5, 14, 12.0); got ${summarizeResult(result)}`,
        );
      }
      if (result.exitCode === 1) {
        const findings = decodeFindingsReport(
          parseJsonStdout(result, checkContext),
          checkContext,
        ).findings;
        const conditions = [...new Set(findings.map((f) => f.condition))];
        const partlyApplied = conditions.every(
          (condition) =>
            condition === "14.5" ||
            condition === "14.6" ||
            condition === "14.7",
        );
        const staleOnly = conditions.every(
          (condition) => condition === "14.10",
        );
        if (findings.length === 0 || !(partlyApplied || staleOnly)) {
          fail(
            `${checkContext}: \`check\` reports exactly a state 13.5 admits ` +
              `— clean, or condition 5–7 findings alone (a partly applied ` +
              `rewrite, 14.5–14.7), or condition 10 findings alone (the ` +
              `journal appended, derived files not yet regenerated) (SPEC ` +
              `13.5, 14); got ${JSON.stringify(findings.map((f) => f.code))}`,
          );
        }
      }
    } finally {
      await workspace.dispose();
    }
  };

  await probe(null);
  for (const delayMs of KILL_DELAYS_MS) {
    await probe(delayMs);
  }
}

/**
 * T13.5-7's refusal arms (a)–(f) on the Linux leg, each starting from a
 * freshly prepared workspace; the rename twin is the caller's (shared with
 * the kill arm), the move twin is built here.
 */
export async function runWriteRefusalArms(
  product: ProductBinding,
  rename: TwinOutcome,
): Promise<void> {
  await sourceEditsArm(product, rename);
  await journalCommitPointArm(product, rename);
  const move = await moveTwin(product);
  await afterAppendArm(product, move);
  await relocationArm(product, move);
  await reviewMutatorsArm(product);
  await buildArm(product);
  await refreshingReadsArm(product);
}
